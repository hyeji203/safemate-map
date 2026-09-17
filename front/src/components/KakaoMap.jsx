import { useEffect, useRef } from 'react'

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
      script.onerror = reject
      document.head.appendChild(script)
    })
  }
  return sdkLoadPromise
}

/**
 * 메인 지도 화면(필수 MVP)의 뼈대. 지도만 띄우는 상태이며,
 * 마커 표시/경로 렌더링은 2단계에서 이 컴포넌트에 props로 확장 예정.
 */
export default function KakaoMap({ center = { lat: 37.5665, lng: 126.978 }, level = 4 }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!KAKAO_JS_KEY) {
      console.warn('REACT_APP_KAKAO_JS_KEY가 설정되지 않았습니다. front/.env를 확인하세요.')
      return
    }

    let cancelled = false

    loadKakaoMapSdk().then(() => {
      if (cancelled || !containerRef.current) return
      new window.kakao.maps.Map(containerRef.current, {
        center: new window.kakao.maps.LatLng(center.lat, center.lng),
        level,
      })
    })

    return () => {
      cancelled = true
    }
  }, [center.lat, center.lng, level])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
