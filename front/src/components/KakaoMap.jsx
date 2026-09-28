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
 * - markers: [{ id, lat, lng, title?, color?, size?, subtle?, maxLevel?, onClick?, badge?, pin?, label? }] 지도 위 점 표시 (color 미지정 시 네이비, size 미지정 시 14px).
 *   subtle: 얇은 테두리+반투명+그림자 없음. maxLevel: 지도 줌 레벨(작을수록 확대)이 이 값 이하일 때만 표시.
 *   badge: 오른쪽 위에 작은 숫자 표시 (같은 위치에 여러 건 묶였을 때 개수 표시용).
 *   pin: true면 물방울 모양 핀으로 그림 (선택한 장소 표시용). label을 주면 핀 아래에 이름표를 붙인다.
 *   제보 마커는 color를 위험색(red)으로, 경로 노드는 선택 상태에 따른 색으로 넘기는 식으로 호출부에서 합쳐서 사용한다.
 * - paths: [{ id, points: [{ lat, lng }], color, weight? }] 경로 폴리라인 목록 (뒤쪽 항목이 위에 그려짐)
 * - onMapClick: 마커가 아닌 빈 지도 영역을 클릭했을 때 좌표 콜백 (장소 이름 보기, 제보 위치 선택)
 * - crosshair: true면 커서를 십자 모양으로 바꾼다 (제보 위치 선택 중 표시용)
 * - focus: { lat, lng, level? } 이 값이 바뀔 때마다 지도를 그 위치로 이동한다 (검색한 장소 보여주기용)
 * center/level은 최초 렌더링에만 적용된다.
 */
export default function KakaoMap({
  center = { lat: 37.5665, lng: 126.978 },
  level = 4,
  markers = [],
  paths = [],
  onMapClick,
  crosshair = false,
  focus,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(level)

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
        const map = mapRef.current
        window.kakao.maps.event.addListener(map, 'zoom_changed', () => setZoomLevel(map.getLevel()))
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
    const overlays = markers
      .filter((m) => m.maxLevel == null || zoomLevel <= m.maxLevel)
      .map((m) => {
        const el = document.createElement('div')
        el.title = m.title ?? ''

        if (m.pin) {
          // 물방울 모양 핀. 뾰족한 끝이 좌표를 가리키고, 이름표(label)는 핀 아래에 붙는다
          const pinColor = m.color ?? '#1A2B4C'
          el.style.cssText = 'position:relative;width:34px;height:44px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))'
          el.innerHTML = `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 1C8.2 1 1 8 1 16.8 1 28.5 17 43 17 43s16-14.5 16-26.2C33 8 25.8 1 17 1z" fill="${pinColor}" stroke="#fff" stroke-width="1.5"/>
            <circle cx="17" cy="16.5" r="6" fill="#fff"/></svg>`
          if (m.label) {
            const label = document.createElement('div')
            label.textContent = m.label
            label.style.cssText =
              'position:absolute;top:46px;left:50%;transform:translateX(-50%);white-space:nowrap;' +
              'font-size:14px;font-weight:700;color:#1A2B4C;' +
              'text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff,0 0 3px #fff'
            el.appendChild(label)
          }
          return new kakao.maps.CustomOverlay({
            map: mapRef.current,
            position: new kakao.maps.LatLng(m.lat, m.lng),
            content: el,
            yAnchor: 1, // 핀 끝이 좌표에 오도록 아래쪽 기준
            xAnchor: 0.5,
            zIndex: 10, // 다른 마커보다 위
          })
        }

        const size = m.size ?? 14
        const border = m.subtle ? 1 : 2
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;border:${border}px solid #fff;background:${
          m.color ?? '#1A2B4C'
        };opacity:${m.subtle ? 0.7 : 1};box-shadow:${
          m.subtle ? 'none' : '0 1px 4px rgba(0,0,0,.4)'
        };cursor:${m.onClick ? 'pointer' : 'default'}`
        if (m.icon) {
          el.style.display = 'flex'
          el.style.alignItems = 'center'
          el.style.justifyContent = 'center'
          el.style.fontSize = `${Math.round(size * 0.65)}px`
          el.style.lineHeight = '1'
          el.textContent = m.icon
        }
        if (m.badge) {
          el.style.position = 'relative'
          const badge = document.createElement('span')
          badge.textContent = m.badge > 9 ? '9+' : String(m.badge)
          badge.style.cssText =
            'position:absolute;top:-4px;right:-4px;min-width:14px;height:14px;padding:0 2px;border-radius:8px;' +
            'background:#1A2B4C;color:#fff;font-size:10px;line-height:14px;text-align:center;box-shadow:0 0 2px rgba(0,0,0,.5)'
          el.appendChild(badge)
        }
        if (m.onClick) el.addEventListener('click', () => m.onClick(m))
        return new kakao.maps.CustomOverlay({
          map: mapRef.current,
          position: new kakao.maps.LatLng(m.lat, m.lng),
          content: el,
          // 누를 수 있는 마커(제보 등)를 눌렀을 때 아래 지도 클릭(장소 이름 보기)까지 같이 일어나지 않게 막는다
          clickable: !!m.onClick,
          yAnchor: 0.5,
          xAnchor: 0.5,
          zIndex: 5,
        })
      })
    return () => overlays.forEach((o) => o.setMap(null))
  }, [mapReady, markers, zoomLevel])

  // 경로선: 배열 앞쪽이 아래, 뒤쪽이 위에 그려진다
  useEffect(() => {
    if (!mapReady) return
    const { kakao } = window
    const lines = paths
      .filter((p) => p.points.length >= 2)
      .map(
        (p) =>
          new kakao.maps.Polyline({
            map: mapRef.current,
            path: p.points.map((pt) => new kakao.maps.LatLng(pt.lat, pt.lng)),
            strokeWeight: p.weight ?? 6,
            strokeColor: p.color,
            strokeOpacity: 0.9,
          }),
      )
    return () => lines.forEach((l) => l.setMap(null))
  }, [mapReady, paths])

  // focus가 바뀌면 그 위치로 부드럽게 이동 (레벨을 먼저 맞춘 뒤 panTo)
  useEffect(() => {
    if (!mapReady || !focus) return
    const map = mapRef.current
    if (focus.level != null) map.setLevel(focus.level)
    map.panTo(new window.kakao.maps.LatLng(focus.lat, focus.lng))
  }, [mapReady, focus])

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
        cursor: crosshair ? 'crosshair' : 'default',
      }}
    />
  )
}
