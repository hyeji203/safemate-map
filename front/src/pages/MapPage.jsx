import { useCallback, useEffect, useMemo, useState } from 'react'
import { routeApi } from '../api/routeApi'
import KakaoMap from '../components/KakaoMap'
import PlaceSearchBar from '../components/PlaceSearchBar'
import PlaceSheet from '../components/PlaceSheet'
import { usePlaceSearch } from '../hooks/usePlaceSearch'
import ReportModal from '../components/ReportModal'
import ReportDetail from '../components/ReportDetail'
import { reportApi } from '../api/reportApi'
import { colors } from '../styles/colors'
import { categoryLabel } from '../constants/reportCategories'

// 신구대학교 인근 시연 지역 중심 (tools/build_osm_graph.py의 CENTER와 동일)
const DEMO_CENTER = { lat: 37.4488, lng: 127.1677 }

// 가로등은 이 줌 레벨 이하(= 확대했을 때)에서만 표시 (카카오맵은 숫자가 작을수록 확대)
const STREETLIGHT_MAX_LEVEL = 2
// 보행로 그래프 노드(교차로)도 반경 확대(1150m)로 1,200개가 넘어 가로등과 같은 방식으로 확대했을 때만 표시
const GRAPH_NODE_MAX_LEVEL = 3

// 메인 지도 화면 (필수 MVP).
// - 상단 검색창에서 장소를 고르면 지도가 그 위치로 이동하고, 하단 정보 카드에서 출발/도착으로 지정한다
// - 출발/도착이 정해지면 최단경로(회색)와 안심경로(노랑)를 함께 그린다
// - 노드 마커를 차례로 클릭해서 출발/도착을 정할 수도 있다 (검증용, 세 번째 클릭은 초기화)
// - 가로등(노란 작은 점) 표시
// - 제보 마커 표시 + 지도 빈 공간 클릭으로 제보 등록까지 연결됨
export default function MapPage() {

  // 경로 탐색 (지도&경로 담당)
  const [nodes, setNodes] = useState([])
  const [streetLights, setStreetLights] = useState([])
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [routes, setRoutes] = useState(null) // { shortest, safe }
  const [routeRefreshKey, setRouteRefreshKey] = useState(0) // 제보 등록 후 경로를 다시 계산하기 위한 트리거
  const [error, setError] = useState(null)

  // 지도 상단 장소 검색. 결과를 고르면 search.selected가 정보 카드로 표시된다
  const search = usePlaceSearch()
  const selectedPlace = search.selected

  // 제보 (제보하기 담당)
  const [reports, setReports] = useState([])
  const [reportMode, setReportMode] = useState(false)
  const [pendingLocation, setPendingLocation] = useState(null)
  const [selectedReport, setSelectedReport] = useState(null)

  useEffect(() => {
    routeApi
      .findNodes()
      .then((res) => setNodes(res.data))
      .catch(() => setError('노드 목록을 불러오지 못했습니다.'))
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

  const handleNodeClick = useCallback(
    (marker) => {
      if (!start) {
        setStart(marker) // 검색으로 도착지만 먼저 정한 경우 도착지는 유지
      } else if (end) {
        setStart(marker)
        setEnd(null)
      } else {
        setEnd(marker)
      }
    },
    [start, end],
  )

  const routeMarkers = useMemo(
    () => [
      ...streetLights.map((l) => ({
        id: `light-${l.id}`,
        lat: l.latitude,
        lng: l.longitude,
        title: '가로등',
        color: colors.amber,
        size: 6,
        subtle: true,
        maxLevel: STREETLIGHT_MAX_LEVEL,
      })),
      ...nodes.map((n) => {
        const isSelected = n.id === start?.id || n.id === end?.id
        return {
          id: n.id,
          lat: n.latitude,
          lng: n.longitude,
          title: n.name,
          color: n.id === start?.id ? colors.amber : n.id === end?.id ? colors.red : colors.navy,
          onClick: handleNodeClick,
          // 선택된 출발/도착 노드는 줌 레벨과 무관하게 계속 보이고, 나머지 노드(1,200개+)는 확대했을 때만 표시
          maxLevel: isSelected ? undefined : GRAPH_NODE_MAX_LEVEL,
        }
      }),
    ],
    [nodes, streetLights, start, end, handleNodeClick],
  )

  // 주소 검색으로 정한 출발/도착은 그래프 노드가 아닐 수 있으므로, 그럴 때만 별도 핀으로 표시한다
  // 정보 카드를 보고 있는 장소도 큰 네이비 핀으로 표시한다
  const searchedPointMarkers = useMemo(() => {
    const points = []
    if (selectedPlace) {
      points.push({
        id: 'selected-place',
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        title: selectedPlace.name,
        color: colors.navy,
        size: 24,
      })
    }
    if (start && !nodes.some((n) => n.id === start.id)) {
      points.push({ id: start.id, lat: start.lat, lng: start.lng, title: start.title ?? '출발지', color: colors.amber, size: 20 })
    }
    if (end && !nodes.some((n) => n.id === end.id)) {
      points.push({ id: end.id, lat: end.lat, lng: end.lng, title: end.title ?? '도착지', color: colors.red, size: 20 })
    }
    return points
  }, [start, end, nodes, selectedPlace])

  // 장소를 고르면 지도를 그 위치로 확대 이동한다 (레벨 3: 교차로 노드까지 보이는 정도)
  const focus = useMemo(
    () => (selectedPlace ? { lat: selectedPlace.lat, lng: selectedPlace.lng, level: 3 } : null),
    [selectedPlace],
  )

  const setPlaceAs = (setter, id) => {
    setter({ id, lat: selectedPlace.lat, lng: selectedPlace.lng, title: selectedPlace.name })
    search.reset()
  }

  const reportMarkers = useMemo(
    () =>
      reports.map((r) => ({
        id: `report-${r.id}`,
        lat: r.latitude,
        lng: r.longitude,
        title: categoryLabel(r.category),
        color: colors.red,
        onClick: () => setSelectedReport(r),
      })),
    [reports],
  )

  const allMarkers = useMemo(
    () => [...routeMarkers, ...reportMarkers, ...searchedPointMarkers],
    [routeMarkers, reportMarkers, searchedPointMarkers],
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

  const handleMapClick = (latlng) => {
    if (!reportMode) return
    setPendingLocation(latlng)
    setReportMode(false)
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
        onMapClick={reportMode ? handleMapClick : undefined}
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
        <PlaceSearchBar search={search} />
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

      <div
        style={{
          position: 'absolute',
          zIndex: 10, // 카카오맵 내부 레이어보다 위에 표시
          bottom: 16,
          left: 12,
          right: 84,
          display: selectedPlace ? 'none' : 'block', // 장소 정보 카드가 떠 있을 때는 카드에 자리를 내준다
          background: colors.white,
          borderRadius: 8,
          padding: '10px 14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          color: colors.navy,
          fontSize: 14,
        }}
      >
        {error ??
          (visibleRoutes ? (
            <>
              <RouteLine label="안심" color={colors.amber} route={visibleRoutes.safe} />
              <RouteLine label="최단" color={colors.gray} route={visibleRoutes.shortest} />
              <div style={{ color: colors.gray, fontSize: 12, marginTop: 4 }}>
                {start.title ?? '출발지'} → {end.title ?? '도착지'}
              </div>
            </>
          ) : start ? (
            `출발: ${start.title ?? '선택한 지점'} · 도착지를 검색하거나 노드를 클릭하세요`
          ) : end ? (
            `도착: ${end.title ?? '선택한 지점'} · 출발지를 검색하거나 노드를 클릭하세요`
          ) : (
            '장소를 검색하거나 노드를 클릭해 출발지를 정하세요'
          ))}
      </div>

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
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        onDeleted={() => {
          setSelectedReport(null)
          loadReports()
        }}
        onAddReport={(location) => {
          setSelectedReport(null)
          setPendingLocation(location)
        }}
      />
    </div>
  )
}

function RouteLine({ label, color, route }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 20, height: 6, borderRadius: 3, background: color, flexShrink: 0 }} />
      <strong>{label}</strong>
      <span>
        {Math.round(route.totalDistanceMeters)}m · 약 {route.estimatedMinutes}분 · 어두운 구간{' '}
        {Math.round(route.darkDistanceMeters)}m · 제보 구간 {Math.round(route.reportedDistanceMeters)}m
      </span>
    </div>
  )
}
