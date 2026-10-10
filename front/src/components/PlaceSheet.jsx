import { colors } from '../styles/colors'

// 경로 탐색이 가능한 시연 지역 범위. 도로망 그래프가 이 안에만 있다 (tools/build_osm_graph.py의 BBOX와 동일)
const DEMO_BOUNDS = { south: 37.435, west: 127.123, north: 37.458, east: 127.19 }

/**
 * 검색으로 고른 장소의 정보 카드 (지도 하단에서 올라오는 시트). 출발/도착 버튼으로 경로 지점을 지정한다.
 * - place: usePlaceSearch().selected
 */
export default function PlaceSheet({ place, onClose, onSetStart, onSetEnd }) {
  if (!place) return null

  const outOfArea =
    place.lat < DEMO_BOUNDS.south ||
    place.lat > DEMO_BOUNDS.north ||
    place.lng < DEMO_BOUNDS.west ||
    place.lng > DEMO_BOUNDS.east

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 15, // 하단 경로 안내/제보 버튼보다 위
        left: 0,
        right: 0,
        bottom: 0,
        background: colors.white,
        borderRadius: '16px 16px 0 0',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.15)',
        padding: '10px 20px 20px',
      }}
    >
      <div style={{ width: 40, height: 4, borderRadius: 2, background: `${colors.gray}66`, margin: '0 auto 14px' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: colors.navy }}>{place.name}</div>
          {place.category && <div style={{ fontSize: 13, color: colors.gray, marginTop: 4 }}>{place.category}</div>}
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" style={closeButtonStyle}>
          ✕
        </button>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: colors.navy }}>
        <div>{place.address}</div>
        {place.phone && <div style={{ color: colors.gray }}>{place.phone}</div>}
        {place.placeUrl && (
          <a href={place.placeUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: colors.gray }}>
            카카오맵에서 상세정보 보기
          </a>
        )}
      </div>

      {outOfArea && (
        <div style={{ marginTop: 12, fontSize: 12, color: colors.red }}>
          안심경로 시연 지역(가천대역~상대원동) 밖이라 경로가 나오지 않을 수 있어요.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          type="button"
          onClick={onSetStart}
          style={{ ...actionButtonStyle, background: `${colors.amber}33`, color: colors.navy }}
        >
          출발
        </button>
        <button type="button" onClick={onSetEnd} style={{ ...actionButtonStyle, background: colors.navy, color: colors.white }}>
          도착
        </button>
      </div>
    </div>
  )
}

const closeButtonStyle = {
  width: 36,
  height: 36,
  flexShrink: 0,
  borderRadius: '50%',
  border: 'none',
  background: colors.background,
  color: colors.navy,
  fontSize: 16,
  cursor: 'pointer',
}

const actionButtonStyle = {
  flex: 1,
  padding: '12px 0',
  borderRadius: 24,
  border: 'none',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
}
