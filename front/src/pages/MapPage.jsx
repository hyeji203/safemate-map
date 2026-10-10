import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { routeApi } from '../api/routeApi'
import { placeApi } from '../api/placeApi'
import KakaoMap from '../components/KakaoMap'
import PlaceSearchBar, { PlaceResults } from '../components/PlaceSearchBar'
import PlaceSheet from '../components/PlaceSheet'
import { usePlaceSearch } from '../hooks/usePlaceSearch'
import { useRouteHistory } from '../hooks/useRouteHistory'
import ReportModal from '../components/ReportModal'
import ReportDetail from '../components/ReportDetail'
import { reportApi } from '../api/reportApi'
import { colors } from '../styles/colors'
import { categoryLabel, categoryIcon } from '../constants/reportCategories'

// 시연 지역(가천대역~상대원동) 중심 (tools/build_osm_graph.py의 BBOX 가운데)
const DEMO_CENTER = { lat: 37.4465, lng: 127.1565 }

// 가로등은 이 줌 레벨 이하(= 확대했을 때)에서만 표시 (카카오맵은 숫자가 작을수록 확대)
// 장소 검색 후 이동하는 레벨(2)에서도 보이도록 2으로 맞춘다
const STREETLIGHT_MAX_LEVEL = 2

// 횡단보도 좌표 찍기 모드: 개발 모드에서 루트 .env에 REACT_APP_CROSSWALK_SURVEY=true 를 넣었을 때만 켜진다.
// 시연 때 개발 서버(npm run dev)로 띄워도 줄 번호 마커·좌표 안내가 보이지 않도록 기본은 꺼 둔다. 배포 빌드에는 들어가지 않는다.
const CROSSWALK_SURVEY = import.meta.env.DEV && import.meta.env.REACT_APP_CROSSWALK_SURVEY === 'true'

// 좌표 찍기 모드 전용: 직접 찍은 횡단보도(crosswalks-surveyed.csv)를 지도에 CSV 줄 번호로 표시한다.
// 파일을 저장하면 바로 다시 그려진다 (백엔드 경로 계산에 반영하려면 백엔드는 재시작해야 함).
const SURVEYED_CROSSWALK_CSV = CROSSWALK_SURVEY
  ? (Object.values(
      import.meta.glob('../../../back/src/main/resources/data/crosswalks-surveyed.csv', {
        query: '?raw',
        import: 'default',
        eager: true,
      }),
    )[0] ?? '')
  : ''

function parseSurveyedCrosswalks(csv) {
  return csv
    .split(/\r?\n/)
    .map((text, i) => ({ text, lineNo: i + 1 }))
    .slice(1) // 헤더
    .filter(({ text }) => text.trim())
    .map(({ text, lineNo }) => {
      const cols = text.split(',').map((c) => c.trim())
      return { lineNo, text, lat: Number(cols[1]), lng: Number(cols[2]), diagonal: cols[4] === 'true' }
    })
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
}

// 가로등 점 색: 카카오 POI 아이콘(주황 계열)과 헷갈리지 않도록 amber보다 밝은 노랑을 쓴다
const STREETLIGHT_COLOR = '#FFD21F'

// 경로선·경로 카드 색 (안심경로 = 노랑, 최단경로 = 회색)
const ROUTE_COLORS = { safe: colors.amber, shortest: colors.gray }

// 메인 지도 화면 (필수 MVP).
// - 상단 검색창에서 장소를 고르면 지도가 그 위치로 이동하고, 하단 정보 카드에서 출발/도착으로 지정한다
// - 지도 빈 곳을 누르면 그 곳의 장소 이름(없으면 주소)이 정보 카드로 뜬다
// - 출발/도착이 정해지면 최단경로(회색)와 안심경로(노랑)를 함께 그린다
// - 가로등(빛 번짐이 있는 노란 작은 점) 표시
// - 제보 마커 표시 + 지도 빈 공간 클릭으로 제보 등록까지 연결됨
export default function MapPage() {

  // 경로 탐색 (지도&경로 담당)
  const [streetLights, setStreetLights] = useState([])
  const [start, setStart] = useState(null)
  const [editingPoint, setEditingPoint] = useState(null) // 위쪽 바에서 바꾸는 중인 지점: 'start' | 'end' | null
  const [end, setEnd] = useState(null)
  const [routes, setRoutes] = useState(null) // { shortest, safe }
  const [selectedRouteKey, setSelectedRouteKey] = useState('safe') // 아래 카드에서 고른 경로: 'safe' | 'shortest'
  const [routeRefreshKey, setRouteRefreshKey] = useState(0) // 제보 등록 후 경로를 다시 계산하기 위한 트리거
  const [error, setError] = useState(null)

  // 지도 상단 장소 검색. 결과를 고르면 search.selected가 정보 카드로 표시된다
  const search = usePlaceSearch()
  const routeHistory = useRouteHistory() // 최근 길찾기 (이 브라우저에만 저장)
  const addRouteHistory = routeHistory.add
  const selectedPlace = search.selected
  const mapClickSeqRef = useRef(0) // 지도 클릭 장소 조회 순번 (늦게 도착한 이전 응답 무시용)
  const [devCoord, setDevCoord] = useState(null) // 좌표 찍기 모드 전용: 마지막으로 누른 곳의 횡단보도 CSV 한 줄 + 복사 여부

  // 제보 (제보하기 담당)
  const [reports, setReports] = useState([])
  const [reportMode, setReportMode] = useState(false)
  const [pendingLocation, setPendingLocation] = useState(null)
  const [selectedReportGroup, setSelectedReportGroup] = useState(null) // 같은 좌표에 쌓인 제보 전체 (배열)

  // 현재 위치는 화면 진입 시부터 계속 추적해서 항상 파란 점 + 바라보는 방향으로 표시한다.
  // (안드로이드 전용이라 iOS의 별도 방향 센서 권한 처리는 필요 없음)
  // 개인정보 원칙: 현재 위치는 화면 표시에만 쓰고 저장하지 않는다.
  // 서버 API로 보내거나 DB·localStorage 등에 남기지 말 것 (팀 결정)
  const [myLocation, setMyLocation] = useState(null)
  const [locationFocus, setLocationFocus] = useState(null) // "현재 위치로 이동" 버튼 누르면 갱신 -> 지도 이동
  const watchIdRef = useRef(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('이 브라우저에서는 현재 위치를 지원하지 않습니다.')
      return
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError('현재 위치를 가져오지 못했습니다. 위치 권한을 확인해주세요.'),
      { enableHighAccuracy: true },
    )
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  const handleLocateMe = () => {
    // level을 안 주면 KakaoMap의 focus 이펙트가 확대/축소는 안 바꾸고 이동만 한다 (지금 보던 배율 유지)
    if (myLocation) setLocationFocus({ lat: myLocation.lat, lng: myLocation.lng })
  }

  // 기기가 바라보는 방향(정북 기준 시계방향 도). 센서가 없으면 계속 null.
  const [heading, setHeading] = useState(null)

  useEffect(() => {
    const handleOrientation = (e) => {
      if (typeof e.webkitCompassHeading === 'number') {
        // iOS Safari: 이미 정북 기준 시계방향 각도로 줌
        setHeading(e.webkitCompassHeading)
      } else if (e.absolute && e.alpha != null) {
        // Android 등: alpha는 반시계 방향 기준이라 보정
        setHeading((360 - e.alpha) % 360)
      }
    }
    window.addEventListener('deviceorientationabsolute', handleOrientation, true)
    window.addEventListener('deviceorientation', handleOrientation, true)
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true)
      window.removeEventListener('deviceorientation', handleOrientation, true)
    }
  }, [])

  useEffect(() => {
    routeApi
      .findStreetLights()
      .then((res) => setStreetLights(res.data))
      .catch(() => setError('가로등 목록을 불러오지 못했습니다.'))
  }, [])

  useEffect(() => {
    if (!start || !end) return
    routeApi
      .findRoute({
        fromLat: start.lat,
        fromLng: start.lng,
        toLat: end.lat,
        toLng: end.lng,
        fromAddress: start.address,
        toAddress: end.address,
      })
      .then((res) => {
        setRoutes(res.data)
        setError(null)
        addRouteHistory(start, end)
      })
      .catch(() => setError('경로를 찾지 못했습니다.'))
    // addRouteHistory는 useCallback이라 바뀌지 않아서 경로를 다시 찾게 만들지 않는다
  }, [start, end, routeRefreshKey, addRouteHistory])

  const loadReports = useCallback(async () => {
    try {
      const { data } = await reportApi.findAll()
      setReports(data)
    } catch (err) {
      console.error('[MapPage] 제보 목록 조회 실패', err)
    }
  }, [])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  // 보행로 그래프 노드(교차로)는 경로 계산에만 쓰고 지도에는 표시하지 않는다
  const streetLightMarkers = useMemo(
    () =>
      streetLights.map((l) => ({
        id: `light-${l.id}`,
        lat: l.latitude,
        lng: l.longitude,
        title: '가로등',
        color: STREETLIGHT_COLOR,
        size: 8,
        glow: true, // 빛 번짐으로 가로등이 모인 골목은 환하게, 없는 곳은 어둡게 보이도록
        maxLevel: STREETLIGHT_MAX_LEVEL,
      })),
    [streetLights],
  )

  // 검색으로 정한 출발/도착은 별도 핀으로 표시한다
  // 정보 카드를 보고 있는 장소는 남색 물방울 핀 + 이름표로 표시한다 (빨강은 위험 제보 전용이라 쓰지 않는다)
  const searchedPointMarkers = useMemo(() => {
    const points = []
    if (selectedPlace) {
      points.push({
        id: 'selected-place',
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        title: selectedPlace.name,
        label: selectedPlace.name,
        color: colors.navy,
        pin: true,
      })
    }
    if (start) {
      points.push({ id: start.id, lat: start.lat, lng: start.lng, title: start.title ?? '출발지', color: colors.navy, size: 20 })
    }
    if (end) {
      points.push({ id: end.id, lat: end.lat, lng: end.lng, title: end.title ?? '도착지', color: colors.red, size: 20 })
    }
    return points
  }, [start, end, selectedPlace])

  // 검색으로 장소를 고르면 지도를 그 위치로 확대 이동한다 (레벨 3: 골목 단위까지 보이는 정도)
  // 지도를 눌러서 고른 장소는 이미 보고 있는 곳이라 이동하지 않고, 그것도 아니면
  // "현재 위치로 이동" 버튼을 눌렀을 때(locationFocus)만 이동한다
  const focus = useMemo(
    () =>
      selectedPlace && !selectedPlace.fromMap
        ? { lat: selectedPlace.lat, lng: selectedPlace.lng, level: 3 }
        : locationFocus,
    [selectedPlace, locationFocus],
  )

  const setPlaceAs = (setter, id) => {
    setter({
      id,
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
      title: selectedPlace.name,
      address: selectedPlace.address, // 도로명주소면 서버가 출입구 쪽 도로를 고르는 데 쓴다
    })
    search.reset()
  }

  // 같은 좌표(정확히 일치)에 등록된 제보는 마커가 완전히 겹쳐서 하나만 클릭되므로, 좌표 기준으로 묶어서
  // 마커 하나당 그 위치의 제보 전체를 들고 있게 한다 ("+ 추가 제보"는 항상 원본과 동일한 좌표를 쓰므로 안전하게 묶임).
  const reportGroups = useMemo(() => {
    const groups = new Map()
    reports.forEach((r) => {
      const key = `${r.latitude},${r.longitude}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(r)
    })
    return [...groups.values()]
  }, [reports])

  const reportMarkers = useMemo(
    () =>
      reportGroups.map((group) => {
        const latest = group[group.length - 1]
        return {
          id: `report-${latest.id}`,
          lat: latest.latitude,
          lng: latest.longitude,
          title: group.length > 1 ? `${categoryLabel(latest.category)} 외 ${group.length - 1}건` : categoryLabel(latest.category),
          color: colors.red,
          size: 22,
          icon: categoryIcon(latest.category),
          badge: group.length > 1 ? group.length : undefined,
          onClick: () => setSelectedReportGroup(group),
        }
      }),
    [reportGroups],
  )

  // 좌표 찍기 모드 전용: 직접 찍은 횡단보도. 숫자 = CSV 줄 번호, 보라 = 일반, 분홍 = 대각선
  const surveyedCrosswalkMarkers = useMemo(
    () =>
      !CROSSWALK_SURVEY
        ? []
        : parseSurveyedCrosswalks(SURVEYED_CROSSWALK_CSV).map((c) => ({
            id: `surveyed-crosswalk-${c.lineNo}`,
            lat: c.lat,
            lng: c.lng,
            title: `crosswalks-surveyed.csv ${c.lineNo}번째 줄${c.diagonal ? ' (대각선)' : ''}: ${c.text}`,
            color: c.diagonal ? '#DB2777' : '#7C3AED',
            size: 18,
            icon: String(c.lineNo),
            maxLevel: 4,
          })),
    [],
  )

  // 출발/도착 중 하나라도 초기화되면 이전 경로는 숨긴다
  const visibleRoutes = start && end ? routes : null

  // 고른 경로에서 큰 도로를 건너는 곳은 네이버지도처럼 건너기 시작하는 지점에 횡단보도 배지를 단다
  // (경로선은 끊지 않고 그대로 둔다)
  const crossingMarkers = useMemo(() => {
    if (!visibleRoutes) return []
    return (visibleRoutes[selectedRouteKey].crossings ?? []).map((c) => ({
      id: `crossing-${c.start.latitude},${c.start.longitude}`,
      lat: c.start.latitude,
      lng: c.start.longitude,
      title: c.hasSignal ? '신호등 있는 횡단보도' : '횡단보도',
      crosswalk: true,
    }))
  }, [visibleRoutes, selectedRouteKey])

  const allMarkers = useMemo(
    () => [
      ...streetLightMarkers,
      ...surveyedCrosswalkMarkers,
      ...reportMarkers,
      ...crossingMarkers,
      ...searchedPointMarkers,
    ],
    [streetLightMarkers, surveyedCrosswalkMarkers, reportMarkers, crossingMarkers, searchedPointMarkers],
  )

  // 고른 경로는 굵고 진하게 맨 위에, 다른 경로는 가늘고 흐리게 아래에 깔아 비교만 할 수 있게 한다
  const paths = useMemo(() => {
    if (!visibleRoutes) return []
    // geometry = 실제 도로 모양(굽은 길 포함), 없으면 교차로만 직선으로 잇는다
    const toPoints = (route) =>
      (route.geometry?.length ? route.geometry : route.path).map((p) => ({ lat: p.latitude, lng: p.longitude }))
    const otherKey = selectedRouteKey === 'safe' ? 'shortest' : 'safe'
    return [
      { id: otherKey, points: toPoints(visibleRoutes[otherKey]), color: ROUTE_COLORS[otherKey], weight: 5, opacity: 0.4 },
      { id: selectedRouteKey, points: toPoints(visibleRoutes[selectedRouteKey]), color: ROUTE_COLORS[selectedRouteKey], weight: 9 },
    ]
  }, [visibleRoutes, selectedRouteKey])

  // 정한 출발/도착과 그려진 경로를 모두 지우고 처음 상태로 돌아간다
  const resetRoute = () => {
    setStart(null)
    setEnd(null)
    setRoutes(null)
    setSelectedRouteKey('safe')
    setError(null)
    setEditingPoint(null)
  }

  // 위쪽 "출발 → 도착" 바에서 한쪽을 누르면 그 자리가 검색창으로 바뀐다.
  // 지금 장소 이름을 그대로 채워 두고 고쳐 쓰게 한다 (비우면 원래 글자가 지워진 것처럼 보여서)
  const startEditingPoint = (which) => {
    search.reset((which === 'start' ? start : end)?.title ?? '')
    setEditingPoint(which)
  }

  const cancelEditingPoint = () => {
    search.reset()
    setEditingPoint(null)
  }

  // 변경 중인 검색창에서 결과를 고르면 정보 카드 없이 바로 출발/도착을 바꾼다 (경로는 자동으로 다시 계산됨)
  const applyEditedPoint = (place) => {
    const point = { lat: place.latitude, lng: place.longitude, title: place.placeName, address: place.addressName }
    if (editingPoint === 'start') setStart({ id: 'place-start', ...point })
    else setEnd({ id: 'place-end', ...point })
    cancelEditingPoint()
  }

  // 지도 빈 곳을 누르면: 제보 모드일 때는 제보 위치로 쓰고, 아닐 때는 그 곳의 장소 이름을 찾아 정보 카드로 띄운다
  const handleMapClick = async (latlng) => {
    // 좌표 찍기 모드 전용: 횡단보도 좌표 보정용. 지도를 최대로 확대해 줄무늬 가운데를 누르면
    // back/src/main/resources/data/crosswalks-surveyed.csv 에 붙여 넣을 한 줄을 화면에 띄우고 클립보드에 복사한다
    // (도로명·신호등 유무는 붙여 넣은 뒤 직접 고침)
    if (CROSSWALK_SURVEY) {
      const line = `도로명,${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)},true`
      console.log(`[횡단보도 좌표] ${line}`)
      setDevCoord({ line, copied: false })
      navigator.clipboard
        ?.writeText(line)
        .then(() => setDevCoord((cur) => (cur?.line === line ? { line, copied: true } : cur)))
        .catch(() => {})
    }
    // 빠르게 여러 번 누르면 마지막으로 누른 곳의 결과만 보여준다
    const seq = ++mapClickSeqRef.current
    if (reportMode) {
      setPendingLocation(latlng)
      setReportMode(false)
      return
    }
    setEditingPoint(null) // 출발/도착 변경 중에 지도를 누르면 변경은 그만두고 누른 장소를 보여준다
    try {
      const { data } = await placeApi.findAt(latlng.lat, latlng.lng)
      if (seq !== mapClickSeqRef.current || !data) return
      search.onSelect(data, { fromMap: true })
    } catch (err) {
      console.error('[MapPage] 지도 위치 장소 조회 실패', err)
    }
  }

  const handleSubmitted = () => {
    setPendingLocation(null)
    loadReports()
    // 새 제보가 위험도에 반영되도록, 이미 경로가 표시돼 있으면 다시 계산한다
    setRouteRefreshKey((k) => k + 1)
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <KakaoMap
        center={DEMO_CENTER}
        level={6} // 시연 지역(약 5.9km x 2.6km)이 처음부터 한눈에 보이도록 축소
        markers={allMarkers}
        paths={paths}
        onMapClick={handleMapClick}
        crosshair={reportMode}
        focus={focus}
        myLocation={myLocation}
        heading={heading}
      />

      {CROSSWALK_SURVEY && devCoord && (
        // 좌표 찍기 모드 전용 좌표 표시. 누르면 닫힌다
        <div
          onClick={() => setDevCoord(null)}
          style={{
            position: 'absolute',
            zIndex: 20,
            top: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 10px',
            borderRadius: 6,
            background: 'rgba(26,43,76,.9)',
            color: '#fff',
            fontSize: 13,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          {devCoord.line} {devCoord.copied ? '(복사됨)' : ''}
        </div>
      )}


      <div
        style={{
          position: 'absolute',
          zIndex: 10, // 카카오맵 내부 레이어보다 위에 표시
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          gap: 8,
        }}
      >
        {start && end ? (
          // 출발/도착이 모두 정해지면 검색창 자리에 "출발 → 도착"을 띄운다
          // 한쪽 이름을 누르면 그 자리만 입력칸으로 바뀌고 반대쪽은 그대로 보인다 (결과 목록은 바 아래로 펼쳐짐)
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: colors.white,
                borderRadius: 24,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                padding: '12px 12px 12px 16px',
                color: colors.navy,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {/* 오른쪽 ✕와 같은 폭의 빈 칸. 출발지 칸과 도착지 칸이 같은 폭이 되게 한다 */}
              <span style={{ width: 24, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <RoutePoint
                  color={colors.navy}
                  name={start.title ?? '출발지'}
                  label="출발지"
                  editing={editingPoint === 'start'}
                  search={search}
                  onEdit={() => startEditingPoint('start')}
                  onCancel={cancelEditingPoint}
                />
                <span style={{ color: colors.gray, flexShrink: 0 }}>→</span>
                <RoutePoint
                  color={colors.red}
                  name={end.title ?? '도착지'}
                  label="도착지"
                  editing={editingPoint === 'end'}
                  search={search}
                  onEdit={() => startEditingPoint('end')}
                  onCancel={cancelEditingPoint}
                />
              </div>
              {/* 변경 중에는 변경만 취소하고, 아닐 때는 경로 전체를 취소한다 */}
              <button
                type="button"
                onClick={editingPoint ? cancelEditingPoint : resetRoute}
                style={closeButtonStyle}
                aria-label={editingPoint ? '변경 취소' : '경로 취소'}
              >
                ✕
              </button>
            </div>
            {editingPoint && <PlaceResults search={search} onSelect={applyEditedPoint} />}
          </div>
        ) : (
          <PlaceSearchBar
            search={search}
            history={{
              items: routeHistory.items,
              // 최근 길찾기를 누르면 그 출발→도착을 그대로 다시 찾는다 (경로는 자동으로 계산됨)
              onPick: (item) => {
                setStart({ id: 'place-start', ...item.start })
                setEnd({ id: 'place-end', ...item.end })
              },
              onRemove: routeHistory.remove,
              onClear: routeHistory.clear,
            }}
          />
        )}
      </div>

      {reportMode && (
        <div
          style={{
            position: 'absolute',
            zIndex: 10,
            top: 64,
            left: 12,
            right: 12,
            background: colors.navy,
            color: colors.white,
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          제보할 위치를 지도에서 클릭하세요
        </div>
      )}

      {visibleRoutes && !error && !selectedPlace ? (
        // 경로가 나오면 아래에 안심경로·최단경로 카드를 따로따로 띄운다 (테두리 색 = 지도 위 경로선 색).
        // 카드를 누르면 그 경로를 골라 지도에 강조한다
        <div
          style={{
            position: 'absolute',
            zIndex: 10, // 카카오맵 내부 레이어보다 위에 표시
            bottom: 16,
            left: 12,
            right: 84, // 제보 버튼 자리
            display: 'flex',
            gap: 8,
            color: colors.navy,
          }}
        >
          <RouteCard
            label="안심경로"
            color={ROUTE_COLORS.safe}
            route={visibleRoutes.safe}
            selected={selectedRouteKey === 'safe'}
            onSelect={() => setSelectedRouteKey('safe')}
          />
          <RouteCard
            label="최단경로"
            color={ROUTE_COLORS.shortest}
            route={visibleRoutes.shortest}
            selected={selectedRouteKey === 'shortest'}
            onSelect={() => setSelectedRouteKey('shortest')}
          />
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            zIndex: 10, // 카카오맵 내부 레이어보다 위에 표시
            bottom: 16,
            left: 12,
            right: 84,
            display: selectedPlace ? 'none' : 'flex', // 장소 정보 카드가 떠 있을 때는 카드에 자리를 내준다
            alignItems: 'flex-start',
            gap: 8,
            background: colors.white,
            borderRadius: 8,
            padding: '10px 14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            color: colors.navy,
            fontSize: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {error ??
              (start && end
                ? '경로를 찾는 중...'
                : start
                  ? `출발: ${start.title ?? '선택한 지점'} · 도착지를 검색하세요`
                  : end
                    ? `도착: ${end.title ?? '선택한 지점'} · 출발지를 검색하세요`
                    : '장소를 검색해 출발지를 정하세요')}
          </div>
          {/* 출발/도착 중 하나만 정했을 때의 취소 버튼 (둘 다 정하면 위쪽 "출발 → 도착" 바의 ✕를 쓴다) */}
          {(start || end) && !(start && end) && (
            <button type="button" onClick={resetRoute} style={closeButtonStyle} aria-label="경로 취소">
              ✕
            </button>
          )}
        </div>
      )}

      {/* 장소 정보 카드가 떠 있을 때는 카드에 자리를 내준다 */}
      {!selectedPlace && (
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={!myLocation}
          style={{
            position: 'absolute',
            zIndex: 10,
            bottom: 84,
            right: 16,
            width: 52,
            height: 52,
            borderRadius: '50%',
            border: 'none',
            background: colors.navy,
            color: colors.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            cursor: myLocation ? 'pointer' : 'default',
            opacity: myLocation ? 1 : 0.5,
          }}
          aria-label="현재 위치로 이동"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="1" x2="12" y2="4" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="20" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
            <line x1="1" y1="12" x2="4" y2="12" stroke="currentColor" strokeWidth="2" />
            <line x1="20" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      )}

      {/* 장소 정보 카드가 떠 있을 때는 카드에 자리를 내준다 */}
      {!selectedPlace && (
        <button
          type="button"
          onClick={() => setReportMode((v) => !v)}
          style={{
            position: 'absolute',
            zIndex: 10, // 카카오맵 내부 레이어보다 위에 표시
            bottom: 16,
            right: 16,
            width: 52,
            height: 52,
            borderRadius: '50%',
            border: 'none',
            background: reportMode ? colors.red : colors.navy,
            color: colors.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            cursor: 'pointer',
          }}
          aria-label={reportMode ? '제보 취소' : '위험구간 제보'}
        >
          {/* 이모지(⚠️)는 글꼴 아래 여백 때문에 원 안에서 아래로 처져 보여서 SVG로 그려 정가운데에 맞춘다 */}
          {reportMode ? (
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style={{ display: 'block' }}>
              <path d="M5 5l12 12M17 5L5 17" stroke={colors.white} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="28" height="26" viewBox="0 0 28 26" aria-hidden="true" style={{ display: 'block' }}>
              <path
                d="M12.27 2a2 2 0 0 1 3.46 0l11 19a2 2 0 0 1-1.73 3H3a2 2 0 0 1-1.73-3z"
                fill={colors.amber}
              />
              <rect x="12.6" y="8.5" width="2.8" height="8.5" rx="1.4" fill={colors.navy} />
              <circle cx="14" cy="20.3" r="1.6" fill={colors.navy} />
            </svg>
          )}
        </button>
      )}

      <PlaceSheet
        place={selectedPlace}
        onClose={search.reset}
        onSetStart={() => setPlaceAs(setStart, 'place-start')}
        onSetEnd={() => setPlaceAs(setEnd, 'place-end')}
      />

      <ReportModal
        location={pendingLocation}
        onClose={() => setPendingLocation(null)}
        onSubmitted={handleSubmitted}
      />

      <ReportDetail
        reports={selectedReportGroup}
        onClose={() => setSelectedReportGroup(null)}
        onDeleted={(deletedId) => {
          setSelectedReportGroup((prev) => {
            if (!prev) return prev
            const remaining = prev.filter((r) => r.id !== deletedId)
            return remaining.length > 0 ? remaining : null
          })
          loadReports()
        }}
        onAddReport={(location) => {
          setSelectedReportGroup(null)
          setPendingLocation(location)
        }}
      />
    </div>
  )
}

const closeButtonStyle = {
  flexShrink: 0,
  width: 24,
  height: 24,
  padding: 0,
  border: 'none',
  background: 'none',
  color: colors.gray,
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
}

// 상단 "출발 → 도착" 바의 한쪽 지점 (지도 위 출발/도착 표시와 같은 색 점 + 이름)
// 이름을 누르면 그 자리가 입력칸으로 바뀌고, 입력칸에서 Esc를 누르면 변경을 취소한다
function RoutePoint({ color, name, label, editing, search, onEdit, onCancel }) {
  const dot = <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />

  if (editing) {
    return (
      <span style={{ ...routePointStyle, boxShadow: `inset 0 -2px 0 ${color}` }}>
        {dot}
        <input
          autoFocus
          // 채워 둔 장소 이름 끝에 커서를 둔다 (이어서 고치거나 지울 수 있게)
          onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
          value={search.query}
          onChange={(e) => search.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          placeholder={`${label} 검색`}
          aria-label={`${label} 검색`}
          style={{
            flex: 1,
            minWidth: 0,
            padding: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            fontWeight: 400,
          }}
        />
      </span>
    )
  }

  return (
    <button type="button" onClick={onEdit} aria-label={`${label} 변경`} title={`${label} 변경`} style={routePointStyle}>
      {dot}
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
    </button>
  )
}

const routePointStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flex: 1, // 출발지·도착지가 바를 반씩 나눠 갖고, 각 칸 안에서 이름을 가운데 정렬한다
  justifyContent: 'center',
  minWidth: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
}

// 경로 한 개의 요약 카드. 테두리와 제목 글자 색(color)은 지도 위 경로선 색과 같다.
// 고른 카드(selected)는 진하게, 안 고른 카드는 흐리게 보여 지금 어느 경로를 안내 중인지 알 수 있게 한다
function RouteCard({ label, color, route, selected, onSelect }) {
  const crossings = route.crossings ?? []
  // 공공데이터(횡단보도 표준데이터)로 보행자 신호등이 확인된 곳만 센다
  const signalCount = crossings.filter((c) => c.hasSignal).length
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        flex: 1,
        minWidth: 0,
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
        opacity: selected ? 1 : 0.6,
        transform: selected ? 'translateY(-4px)' : 'none',
        transition: 'opacity .15s, transform .15s',
        border: `3px solid ${color}`,
        borderRadius: 10,
        padding: '10px 12px',
        background: colors.white,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
        {route.estimatedMinutes}
        <span style={{ fontSize: 14, fontWeight: 600 }}>분</span>
      </div>
      <div style={{ fontSize: 13, marginTop: 2 }}>{Math.round(route.totalDistanceMeters)}m</div>
      <div style={{ fontSize: 12, color: colors.gray, marginTop: 4 }}>
        어두운 구간 {Math.round(route.darkDistanceMeters)}m
      </div>
      <div style={{ fontSize: 12, color: colors.gray }}>제보 구간 {Math.round(route.reportedDistanceMeters)}m</div>
      <div style={{ fontSize: 12, color: colors.gray }}>
        횡단보도 {crossings.length}회{signalCount > 0 && ` · 신호등 ${signalCount}곳`}
      </div>
    </button>
  )
}
