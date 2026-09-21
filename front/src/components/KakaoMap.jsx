import { useEffect, useRef, useState } from 'react'
import { colors } from '../styles/colors'

const KAKAO_JS_KEY = import.meta.env.REACT_APP_KAKAO_JS_KEY

let sdkLoadPromise = null

// Kakao Maps SDK는 앱 전체에서 한 번만 로드하면 되므로 Promise를 캐싱해서 중복 로드를 막는다.
function loadKakaoMapSdk() {
  if (window.kakao?.maps) return Promise.resolve()

  if (!sdkLoadPromise) {
    sdkLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`
      script.onload = () => window.kakao.maps.load(resolve)
      script.onerror = () => reject(new Error(`카카오맵 SDK 로드 실패: ${script.src}`))
      document.head.appendChild(script)
    })
  }
  return sdkLoadPromise
}

/**
 * 메인 지도 화면의 핵심 컴포넌트.
 * - markers: 제보 목록을 위험구간 마커(빨간 점)로 표시
 * - onMapClick: 지도를 클릭하면 좌표를 콜백으로 전달 (제보 등록 모달을 여는 용도)
 */
export default function KakaoMap({ center = { lat: 37.5665, lng: 126.978 }, level = 4, markers = [], onMapClick }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (!KAKAO_JS_KEY) {
      console.warn('REACT_APP_KAKAO_JS_KEY가 설정되지 않았습니다. .env를 확인하세요.')
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
    // 지도는 최초 1회만 생성 (center/level 변경으로 재생성하지 않음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 지도 클릭 시 좌표 전달
  useEffect(() => {
    if (!mapReady || !onMapClick) return
    const map = mapRef.current
    const listener = window.kakao.maps.event.addListener(map, 'click', (e) => {
      onMapClick({ lat: e.latLng.getLat(), lng: e.latLng.getLng() })
    })
    return () => window.kakao.maps.event.removeListener(map, 'click', listener)
  }, [mapReady, onMapClick])

  // 제보 마커 렌더링 (목록이 바뀔 때마다 새로 그림)
  useEffect(() => {
    if (!mapReady) return

    overlaysRef.current.forEach((overlay) => overlay.setMap(null))

    overlaysRef.current = markers.map((marker) => {
      const dot = document.createElement('div')
      dot.style.cssText = `width:14px;height:14px;border-radius:50%;background:${colors.red};border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4);`

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(marker.latitude, marker.longitude),
        content: dot,
        yAnchor: 0.5,
      })
      overlay.setMap(mapRef.current)
      return overlay
    })
  }, [mapReady, markers])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', // 카카오 SDK 내부 레이어(z-index 높음)가 밖으로 새어나가 다른 UI를 덮지 않도록 쌓임 맥락을 가둠
        width: '100%',
        height: '100%',
        cursor: onMapClick ? 'crosshair' : 'default',
      }}
    />
  )
}
