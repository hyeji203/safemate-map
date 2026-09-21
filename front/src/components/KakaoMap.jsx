import { useEffect, useRef, useState } from 'react'

const KAKAO_JS_KEY = import.meta.env.REACT_APP_KAKAO_JS_KEY

let sdkLoadPromise = null

// Kakao Maps SDK는 앱 전체에서 한 번만 로드하면 되므로 Promise를 캐싱해서 중복 로드를 막는다.
function loadKakaoMapSdk() {
  if (window.kakao?.maps) return Promise.resolve()

  if (!sdkLoadPromise) {
    sdkLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`
      console.log('[KakaoMap] SDK 요청 URL:', script.src)
      script.onload = () => window.kakao.maps.load(resolve)
      script.onerror = () => reject(new Error(`카카오맵 SDK 로드 실패: ${script.src}`))
      document.head.appendChild(script)
    })
  }
  return sdkLoadPromise
}

/**
 * 메인 지도 컴포넌트.
 * - markers: [{ id, lat, lng, title, color?, onClick? }] 지도 위 점 표시 (color 미지정 시 네이비)
 * - path: [{ lat, lng }] 경로 폴리라인 (빈 배열이면 표시 안 함)
 * - pathColor: 폴리라인 색
 * center/level은 최초 렌더링에만 적용된다.
 */
export default function KakaoMap({
  center = { lat: 37.5665, lng: 126.978 },
  level = 4,
  markers = [],
  path = [],
  pathColor = '#FFB020',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (!KAKAO_JS_KEY) {
      console.warn('REACT_APP_KAKAO_JS_KEY가 설정되지 않았습니다. 루트 .env를 확인하세요.')
      return
    }

    let cancelled = false

    loadKakaoMapSdk()
      .then(() => {
        if (cancelled || !containerRef.current) return
        mapRef.current = new window.kakao.maps.Map(containerRef.current, {
          center: new window.kakao.maps.LatLng(center.lat, center.lng),
          level,
        })
        setMapReady(true)
      })
      .catch((err) => console.error('[KakaoMap]', err.message))

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 마커: markers가 바뀔 때마다 기존 것을 지우고 다시 그린다
  useEffect(() => {
    if (!mapReady) return
    const { kakao } = window
    const overlays = markers.map((m) => {
      const el = document.createElement('div')
      el.title = m.title ?? ''
      el.style.cssText = `width:14px;height:14px;border-radius:50%;border:2px solid #fff;background:${
        m.color ?? '#1A2B4C'
      };box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer`
      if (m.onClick) el.addEventListener('click', () => m.onClick(m))
      return new kakao.maps.CustomOverlay({
        map: mapRef.current,
        position: new kakao.maps.LatLng(m.lat, m.lng),
        content: el,
        yAnchor: 0.5,
        xAnchor: 0.5,
      })
    })
    return () => overlays.forEach((o) => o.setMap(null))
  }, [mapReady, markers])

  // 경로선
  useEffect(() => {
    if (!mapReady || path.length < 2) return
    const { kakao } = window
    const line = new kakao.maps.Polyline({
      map: mapRef.current,
      path: path.map((p) => new kakao.maps.LatLng(p.lat, p.lng)),
      strokeWeight: 6,
      strokeColor: pathColor,
      strokeOpacity: 0.9,
    })
    return () => line.setMap(null)
  }, [mapReady, path, pathColor])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
