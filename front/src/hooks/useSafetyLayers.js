import { useCallback, useEffect, useRef, useState } from 'react'
import { safetyApi } from '../api/safetyApi'

// 켜 둔 레이어를 이 브라우저에 기억해 두는 localStorage 키
const STORAGE_KEY = 'safemate_safety_layers'
// 처음에는 모두 꺼 둔다 (칩 줄에서 처음부터 눌린 것처럼 보이는 칩이 없게)
const DEFAULT_LAYERS = { streetlight: false, cctv: false, convenience: false, police: false }
// 지도 이동이 멈춘 뒤 이만큼 더 기다렸다가 검색한다 (드래그·확대를 이어서 할 때 매번 호출하지 않게)
const DEBOUNCE_MS = 500
// 이보다 넓게 보고 있으면(위도·경도 각 변, 도) 검색하지 않고 확대 안내만 한다. 백엔드 PlaceController와 같은 값
export const FACILITY_MAX_SPAN_DEGREES = 0.03
// 같은 범위를 다시 볼 때 쓰는 응답 캐시 크기
const CACHE_LIMIT = 40

export const FACILITY_TYPES = ['convenience', 'police']

function loadLayers() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return saved && typeof saved === 'object' ? { ...DEFAULT_LAYERS, ...saved } : DEFAULT_LAYERS
  } catch {
    return DEFAULT_LAYERS
  }
}

// 범위를 약 100m 단위로 맞춰 캐시 키로 쓴다 (조금만 움직였을 때는 같은 결과를 다시 쓰도록)
const boundsKey = (b) => [b.swLat, b.swLng, b.neLat, b.neLng].map((v) => v.toFixed(3)).join(',')

/**
 * 지도 화면 안전시설 레이어 상태 + 데이터.
 * - layers: { streetlight, cctv, convenience, police } 켜짐 여부 (localStorage에 기억)
 * - cctvs: CCTV 전체 (CCTV 레이어를 처음 켤 때 한 번만 불러온다), cctvLoaded: 불러왔는지
 * - facilities: { convenience: [], police: [] } 지금 지도 범위 안의 시설
 * - tooWide: 지도를 너무 넓게 보고 있어 편의점·파출소를 검색하지 않은 상태
 * - loading: 편의점·파출소를 검색 중인지
 * preloadCctv: true면 CCTV 레이어가 꺼져 있어도 미리 불러온다 (칩 줄에서 데이터 없음을 바로 흐리게 보여주려고).
 * bounds는 KakaoMap의 onBoundsChange 값. 지도 이동이 멈추고 DEBOUNCE_MS 뒤에 켜진 시설 종류만 검색한다.
 */
export function useSafetyLayers(bounds, { preloadCctv = false } = {}) {
  const [layers, setLayers] = useState(loadLayers)
  const [cctvs, setCctvs] = useState([])
  const [cctvLoaded, setCctvLoaded] = useState(false)
  const [facilities, setFacilities] = useState({ convenience: [], police: [] })
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef(new Map())

  const toggle = useCallback((key) => {
    setLayers((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // 저장이 막혀 있으면 이번 화면에서만 적용된다
      }
      return next
    })
  }, [])

  // CCTV는 시연 지역 전체가 많지 않아서 처음 켤 때 한 번만 받아 둔다
  useEffect(() => {
    if (!(layers.cctv || preloadCctv) || cctvLoaded) return
    safetyApi
      .findCctvs()
      .then((res) => setCctvs(res.data))
      .catch((err) => console.error('[useSafetyLayers] CCTV 조회 실패', err))
      .finally(() => setCctvLoaded(true))
  }, [layers.cctv, preloadCctv, cctvLoaded])

  const tooWide =
    !!bounds &&
    (bounds.neLat - bounds.swLat > FACILITY_MAX_SPAN_DEGREES || bounds.neLng - bounds.swLng > FACILITY_MAX_SPAN_DEGREES)
  const activeTypes = FACILITY_TYPES.filter((type) => layers[type])
  const activeKey = activeTypes.join(',')

  // 편의점·파출소: 켜진 종류만, 지도가 멈추고 잠시 뒤에, 같은 범위는 캐시로. 더 새 요청이 시작되면 이전 요청은 취소한다
  useEffect(() => {
    if (!bounds || tooWide || activeTypes.length === 0) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      const key = boundsKey(bounds)
      setLoading(true)
      try {
        const entries = await Promise.all(
          activeTypes.map(async (type) => {
            const cacheKey = `${type}|${key}`
            if (!cacheRef.current.has(cacheKey)) {
              const res = await safetyApi.findFacilities(type, bounds, controller.signal)
              cacheRef.current.set(cacheKey, res.data)
              if (cacheRef.current.size > CACHE_LIMIT) cacheRef.current.delete(cacheRef.current.keys().next().value)
            }
            return [type, cacheRef.current.get(cacheKey)]
          }),
        )
        setFacilities((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
      } catch (err) {
        if (!controller.signal.aborted) console.error('[useSafetyLayers] 안전시설 조회 실패', err)
      } finally {
        setLoading(false) // 취소된 요청이어도 끈다 (이어서 시작한 새 요청이 다시 켠다)
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // activeTypes는 activeKey로 대신 비교한다 (매 렌더 새 배열이라)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, tooWide, activeKey])

  return { layers, toggle, cctvs, cctvLoaded, facilities, tooWide, loading }
}
