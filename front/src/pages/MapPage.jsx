import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { routeApi } from '../api/routeApi'
import KakaoMap from '../components/KakaoMap'
import ReportModal from '../components/ReportModal'
import { reportApi } from '../api/reportApi'
import { colors } from '../styles/colors'

// 신구대학교 인근 시연 지역 중심 (백엔드 GridSeedLoader의 임시 중심 좌표와 동일)
const DEMO_CENTER = { lat: 37.4488, lng: 127.1677 }

// 메인 지도 화면 (필수 MVP).
// - 노드 마커를 차례로 클릭하면 출발 -> 도착 최단경로를 그린다 (1단계 검증용, 세 번째 클릭은 초기화)
// - 제보 마커 표시 + 지도 빈 공간 클릭으로 제보 등록까지 연결됨
export default function MapPage() {
  // 경로 탐색 (지도&경로 담당)
  const [nodes, setNodes] = useState([])
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [route, setRoute] = useState(null)
  const [error, setError] = useState(null)

  // 제보 (제보하기 담당)
  const [reports, setReports] = useState([])
  const [reportMode, setReportMode] = useState(false)
  const [pendingLocation, setPendingLocation] = useState(null)

  useEffect(() => {
    routeApi
      .findNodes()
      .then((res) => setNodes(res.data))
      .catch(() => setError('노드 목록을 불러오지 못했습니다.'))
  }, [])

  useEffect(() => {
    if (!start || !end) return
    routeApi
      .findRoute({ fromLat: start.lat, fromLng: start.lng, toLat: end.lat, toLng: end.lng })
      .then((res) => {
        setRoute(res.data)
        setError(null)
      })
      .catch(() => setError('경로를 찾지 못했습니다.'))
  }, [start, end])

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
      if (!start || end) {
        setStart(marker)
        setEnd(null)
      } else {
        setEnd(marker)
      }
    },
    [start, end],
  )

  const routeMarkers = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        lat: n.latitude,
        lng: n.longitude,
        title: n.name,
        color: n.id === start?.id ? colors.amber : n.id === end?.id ? colors.red : colors.navy,
        onClick: handleNodeClick,
      })),
    [nodes, start, end, handleNodeClick],
  )

  const reportMarkers = useMemo(
    () =>
      reports.map((r) => ({
        id: `report-${r.id}`,
        lat: r.latitude,
        lng: r.longitude,
        title: r.category,
        color: colors.red,
      })),
    [reports],
  )

  const allMarkers = useMemo(() => [...routeMarkers, ...reportMarkers], [routeMarkers, reportMarkers])

  // 출발/도착 중 하나라도 초기화되면 이전 경로는 숨긴다
  const visibleRoute = start && end ? route : null

  const path = useMemo(
    () => (visibleRoute ? visibleRoute.path.map((p) => ({ lat: p.latitude, lng: p.longitude })) : []),
    [visibleRoute],
  )

  const handleMapClick = (latlng) => {
    if (!reportMode) return
    setPendingLocation(latlng)
    setReportMode(false)
  }

  const handleSubmitted = () => {
    setPendingLocation(null)
    loadReports()
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <KakaoMap
        center={DEMO_CENTER}
        level={3}
        markers={allMarkers}
        path={path}
        onMapClick={reportMode ? handleMapClick : undefined}
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
        <Link
          to="/route-search"
          style={{
            flex: 1,
            background: colors.white,
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            color: colors.navy,
            textDecoration: 'none',
          }}
        >
          출발지 · 도착지 검색
        </Link>
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
          background: colors.white,
          borderRadius: 8,
          padding: '10px 14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          color: colors.navy,
          fontSize: 14,
        }}
      >
        {error ??
          (visibleRoute
            ? `${Math.round(visibleRoute.totalDistanceMeters)}m · 도보 약 ${visibleRoute.estimatedMinutes}분 (다시 클릭하면 초기화)`
            : start
              ? '도착 노드를 클릭하세요'
              : '출발 노드를 클릭하세요')}
      </div>

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
          background: reportMode ? colors.red : colors.amber,
          color: reportMode ? colors.white : colors.navy,
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

      <ReportModal
        location={pendingLocation}
        onClose={() => setPendingLocation(null)}
        onSubmitted={handleSubmitted}
      />
    </div>
  )
}
