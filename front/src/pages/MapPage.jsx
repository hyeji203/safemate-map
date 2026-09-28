import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { routeApi } from '../api/routeApi'
import { placeApi } from '../api/placeApi'
import KakaoMap from '../components/KakaoMap'
import PlaceSearchBar, { PlaceResults } from '../components/PlaceSearchBar'
import PlaceSheet from '../components/PlaceSheet'
import { usePlaceSearch } from '../hooks/usePlaceSearch'
import ReportModal from '../components/ReportModal'
import ReportDetail from '../components/ReportDetail'
import { reportApi } from '../api/reportApi'
import { colors } from '../styles/colors'
import { categoryLabel, categoryIcon } from '../constants/reportCategories'

// 신구대학교 인근 시연 지역 중심 (tools/build_osm_graph.py의 CENTER와 동일)
const DEMO_CENTER = { lat: 37.4488, lng: 127.1677 }

// 가로등은 이 줌 레벨 이하(= 확대했을 때)에서만 표시 (카카오맵은 숫자가 작을수록 확대)
// 장소 검색 후 이동하는 레벨(2)에서도 보이도록 2으로 맞춘다
const STREETLIGHT_MAX_LEVEL = 2

// 메인 지도 화면 (필수 MVP).
// - 상단 검색창에서 장소를 고르면 지도가 그 위치로 이동하고, 하단 정보 카드에서 출발/도착으로 지정한다
// - 지도 빈 곳을 누르면 그 곳의 장소 이름(없으면 주소)이 정보 카드로 뜬다
// - 출발/도착이 정해지면 최단경로(회색)와 안심경로(노랑)를 함께 그린다
// - 가로등(노란 작은 점) 표시
// - 제보 마커 표시 + 지도 빈 공간 클릭으로 제보 등록까지 연결됨
export default function MapPage() {

  // 경로 탐색 (지도&경로 담당)
  const [streetLights, setStreetLights] = useState([])
  const [start, setStart] = useState(null)
  const [editingPoint, setEditingPoint] = useState(null) // 위쪽 바에서 바꾸는 중인 지점: 'start' | 'end' | null
  const [end, setEnd] = useState(null)
  const [routes, setRoutes] = useState(null) // { shortest, safe }
  const [routeRefreshKey, setRouteRefreshKey] = useState(0) // 제보 등록 후 경로를 다시 계산하기 위한 트리거
  const [error, setError] = useState(null)

  // 지도 상단 장소 검색. 결과를 고르면 search.selected가 정보 카드로 표시된다
  const search = usePlaceSearch()
  const selectedPlace = search.selected
  const mapClickSeqRef = useRef(0) // 지도 클릭 장소 조회 순번 (늦게 도착한 이전 응답 무시용)

  // 제보 (제보하기 담당)
  const [reports, setReports] = useState([])
  const [reportMode, setReportMode] = useState(false)
  const [pendingLocation, setPendingLocation] = useState(null)
  const [selectedReportGroup, setSelectedReportGroup] = useState(null) // 같은 좌표에 쌓인 제보 전체 (배열)

  useEffect(() => {
    routeApi
      .findStreetLights()
      .then((res) => setStreetLights(res.data))
      .catch(() => setError('가로등 목록을 불러오지 못했습니다.'))
  }, [])

  useEffect(() => {
    if (!start || !end) return
    routeApi
      .findRoute({ fromLat: start.lat, fromLng: start.lng, toLat: end.lat, toLng: end.lng })
      .then((res) => {
        setRoutes(res.data)
        setError(null)
      })
      .catch(() => setError('경로를 찾지 못했습니다.'))
  }, [start, end, routeRefreshKey])

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
        color: colors.amber,
        size: 6,
        subtle: true,
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
  // 지도를 눌러서 고른 장소는 이미 보고 있는 곳이라 이동하지 않는다
  const focus = useMemo(
    () =>
      selectedPlace && !selectedPlace.fromMap ? { lat: selectedPlace.lat, lng: selectedPlace.lng, level: 3 } : null,
    [selectedPlace],
  )

  const setPlaceAs = (setter, id) => {
    setter({ id, lat: selectedPlace.lat, lng: selectedPlace.lng, title: selectedPlace.name })
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

  const allMarkers = useMemo(
    () => [...streetLightMarkers, ...reportMarkers, ...searchedPointMarkers],
    [streetLightMarkers, reportMarkers, searchedPointMarkers],
  )

  // 출발/도착 중 하나라도 초기화되면 이전 경로는 숨긴다
  const visibleRoutes = start && end ? routes : null

  // 최단경로(회색, 굵게)를 아래에, 안심경로(노랑, 가늘게)를 위에 그려 겹쳐도 둘 다 보이게 한다
  const paths = useMemo(() => {
    if (!visibleRoutes) return []
    // geometry = 실제 도로 모양(굽은 길 포함), 없으면 교차로만 직선으로 잇는다
    const toPoints = (route) =>
      (route.geometry?.length ? route.geometry : route.path).map((p) => ({ lat: p.latitude, lng: p.longitude }))
    return [
      { id: 'shortest', points: toPoints(visibleRoutes.shortest), color: colors.gray, weight: 10 },
      { id: 'safe', points: toPoints(visibleRoutes.safe), color: colors.amber, weight: 5 },
    ]
  }, [visibleRoutes])

  // 정한 출발/도착과 그려진 경로를 모두 지우고 처음 상태로 돌아간다
  const resetRoute = () => {
    setStart(null)
    setEnd(null)
    setRoutes(null)
    setError(null)
    setEditingPoint(null)
  }

  // 위쪽 "출발 → 도착" 바에서 한쪽을 누르면 그 자리가 검색창으로 바뀐다
  const startEditingPoint = (which) => {
    search.reset()
    setEditingPoint(which)
  }

  const cancelEditingPoint = () => {
    search.reset()
    setEditingPoint(null)
  }

  // 변경 중인 검색창에서 결과를 고르면 정보 카드 없이 바로 출발/도착을 바꾼다 (경로는 자동으로 다시 계산됨)
  const applyEditedPoint = (place) => {
    const point = { lat: place.latitude, lng: place.longitude, title: place.placeName }
    if (editingPoint === 'start') setStart({ id: 'place-start', ...point })
    else setEnd({ id: 'place-end', ...point })
    cancelEditingPoint()
  }

  // 지도 빈 곳을 누르면: 제보 모드일 때는 제보 위치로 쓰고, 아닐 때는 그 곳의 장소 이름을 찾아 정보 카드로 띄운다
  const handleMapClick = async (latlng) => {
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
        level={6} // 시연 지역 반경이 1150m라 처음부터 단대오거리역까지 한눈에 보이도록 축소
        markers={allMarkers}
        paths={paths}
        onMapClick={handleMapClick}
        crosshair={reportMode}
        focus={focus}
      />


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
          <PlaceSearchBar search={search} />
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
        // 경로가 나오면 아래에 안심경로·최단경로 카드를 따로따로 띄운다 (테두리 색 = 지도 위 경로선 색)
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
          <RouteCard label="안심경로" color={colors.amber} route={visibleRoutes.safe} />
          <RouteCard label="최단경로" color={colors.gray} route={visibleRoutes.shortest} />
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
          onClick={() => setReportMode((v) => !v)}
          style={{
            position: 'absolute',
            zIndex: 10, // 카카오맵 내부 레이어보다 위에 표시
            bottom: 16,
            right: 16,
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: 'none',
            background: reportMode ? colors.red : colors.navy,
            color: colors.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            cursor: 'pointer',
          }}
          aria-label="위험구간 제보"
        >
          {reportMode ? '✕' : '⚠️'}
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
          value={search.query}
          onChange={(e) => search.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          placeholder={`${label} 검색 (${name})`}
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
  flex: 1,
  minWidth: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
}

// 경로 한 개의 요약 카드. 테두리 색(color)은 지도 위 경로선 색과 같다
function RouteCard({ label, color, route }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        border: `2px solid ${color}`,
        borderRadius: 10,
        padding: '10px 12px',
        background: colors.white,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
        {route.estimatedMinutes}
        <span style={{ fontSize: 14, fontWeight: 600 }}>분</span>
      </div>
      <div style={{ fontSize: 13, marginTop: 2 }}>{Math.round(route.totalDistanceMeters)}m</div>
      <div style={{ fontSize: 12, color: colors.gray, marginTop: 4 }}>
        어두운 구간 {Math.round(route.darkDistanceMeters)}m
      </div>
      <div style={{ fontSize: 12, color: colors.gray }}>제보 구간 {Math.round(route.reportedDistanceMeters)}m</div>
    </div>
  )
}
