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
      script.onload = () => window.kakao.maps.load(resolve)
      script.onerror = () => reject(new Error(`카카오맵 SDK 로드 실패: ${script.src}`))
      document.head.appendChild(script)
    })
  }
  return sdkLoadPromise
}

/**
 * 메인 지도 컴포넌트.
 * - markers: [{ id, lat, lng, title?, color?, onClick? }] 지도 위 점 표시 (color 미지정 시 네이비).
 *   제보 마커는 color를 위험색(red)으로, 경로 노드는 선택 상태에 따른 색으로 넘기는 식으로 호출부에서 합쳐서 사용한다.
 * - path: [{ lat, lng }] 경로 폴리라인 (빈 배열이면 표시 안 함)
 * - pathColor: 폴리라인 색
 * - onMapClick: 마커가 아닌 빈 지도 영역을 클릭했을 때 좌표 콜백 (제보 위치 선택용)
 * center/level은 최초 렌더링에만 적용된다.
 */
export default function KakaoMap({
  center = { lat: 37.5665, lng: 126.978 },
  level = 4,
  markers = [],
  path = [],
  pathColor = '#FFB020',
  onMapClick,
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
    // 지도는 최초 1회만 생성 (center/level 변경으로 재생성하지 않음)
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

  // 지도 빈 공간 클릭 시 좌표 전달 (마커 클릭은 각 마커 자체의 onClick이 처리하므로 서로 안 겹침)
  useEffect(() => {
    if (!mapReady || !onMapClick) return
    const map = mapRef.current
    // removeListener는 addListener에 넘겼던 함수 자체를 다시 받아야 제거되므로, 핸들러를 변수로 따로 보관한다.
    const handleClick = (e) => {
      onMapClick({ lat: e.latLng.getLat(), lng: e.latLng.getLng() })
    }
    window.kakao.maps.event.addListener(map, 'click', handleClick)
    return () => window.kakao.maps.event.removeListener(map, 'click', handleClick)
  }, [mapReady, onMapClick])

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
