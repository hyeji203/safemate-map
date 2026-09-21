import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { routeApi } from '../api/routeApi'
import KakaoMap from '../components/KakaoMap'
import { colors } from '../styles/colors'

// 신구대학교 인근 시연 지역 중심 (백엔드 GridSeedLoader의 임시 중심 좌표와 동일)
const DEMO_CENTER = { lat: 37.4488, lng: 127.1677 }

// 메인 지도 화면 (필수 MVP). 제보 마커는 추후 추가 예정.
// 검증용: 노드 마커를 차례로 클릭하면 출발 -> 도착 최단경로(회색)와 안심경로(노랑)를 함께 그린다 (세 번째 클릭은 초기화).
export default function MapPage() {
  const [nodes, setNodes] = useState([])
  const [streetLights, setStreetLights] = useState([])
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [routes, setRoutes] = useState(null) // { shortest, safe }
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
        setRoutes(res.data)
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
  const visibleRoutes = start && end ? routes : null

  // 최단경로(회색, 굵게)를 아래에, 안심경로(노랑, 가늘게)를 위에 그려 겹쳐도 둘 다 보이게 한다
  const paths = useMemo(() => {
    if (!visibleRoutes) return []
    const toPoints = (route) => route.path.map((p) => ({ lat: p.latitude, lng: p.longitude }))
    return [
      { id: 'shortest', points: toPoints(visibleRoutes.shortest), color: colors.gray, weight: 10 },
      { id: 'safe', points: toPoints(visibleRoutes.safe), color: colors.amber, weight: 5 },
    ]
  }, [visibleRoutes])

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <KakaoMap center={DEMO_CENTER} level={3} markers={markers} paths={paths} />

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
          (visibleRoutes ? (
            <>
              <RouteLine label="안심" color={colors.amber} route={visibleRoutes.safe} />
              <RouteLine label="최단" color={colors.gray} route={visibleRoutes.shortest} />
              <div style={{ color: colors.gray, fontSize: 12, marginTop: 4 }}>
                다시 클릭하면 초기화
              </div>
            </>
          ) : start ? (
            '도착 노드를 클릭하세요'
          ) : (
            '출발 노드를 클릭하세요'
          ))}
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

function RouteLine({ label, color, route }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 20, height: 6, borderRadius: 3, background: color, flexShrink: 0 }} />
      <strong>{label}</strong>
      <span>
        {Math.round(route.totalDistanceMeters)}m · 약 {route.estimatedMinutes}분 · 어두운 구간{' '}
        {Math.round(route.darkDistanceMeters)}m
      </span>
    </div>
  )
}
