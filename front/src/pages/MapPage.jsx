import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { routeApi } from '../api/routeApi'
import KakaoMap from '../components/KakaoMap'
import { colors } from '../styles/colors'

// 신구대학교 인근 시연 지역 중심 (백엔드 GridSeedLoader의 임시 중심 좌표와 동일)
const DEMO_CENTER = { lat: 37.4488, lng: 127.1677 }

// 메인 지도 화면 (필수 MVP). 2단계에서 제보 마커 + 최단/안심 경로 듀얼 렌더링 추가 예정.
// 1단계 검증용: 노드 마커를 차례로 클릭하면 출발 -> 도착 최단경로를 그린다 (세 번째 클릭은 초기화).
export default function MapPage() {
  const [nodes, setNodes] = useState([])
  const [streetLights, setStreetLights] = useState([])
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [route, setRoute] = useState(null)
  const [error, setError] = useState(null)

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
        setRoute(res.data)
        setError(null)
      })
      .catch(() => setError('경로를 찾지 못했습니다.'))
  }, [start, end])

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

  const markers = useMemo(
    () => [
      ...streetLights.map((l) => ({
        id: `light-${l.id}`,
        lat: l.latitude,
        lng: l.longitude,
        title: '가로등',
        color: colors.amber,
        size: 9,
      })),
      ...nodes.map((n) => ({
        id: n.id,
        lat: n.latitude,
        lng: n.longitude,
        title: n.name,
        color: n.id === start?.id ? colors.amber : n.id === end?.id ? colors.red : colors.navy,
        onClick: handleNodeClick,
      })),
    ],
    [nodes, streetLights, start, end, handleNodeClick],
  )

  // 출발/도착 중 하나라도 초기화되면 이전 경로는 숨긴다
  const visibleRoute = start && end ? route : null

  const path = useMemo(
    () => (visibleRoute ? visibleRoute.path.map((p) => ({ lat: p.latitude, lng: p.longitude })) : []),
    [visibleRoute],
  )

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <KakaoMap center={DEMO_CENTER} level={3} markers={markers} path={path} />

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

      <Link
        to="/report"
        style={{
          position: 'absolute',
          zIndex: 10, // 카카오맵 내부 레이어보다 위에 표시
          bottom: 16,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: colors.amber,
          color: colors.navy,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
        aria-label="위험구간 제보"
      >
        ⚠️
      </Link>
    </div>
  )
}
