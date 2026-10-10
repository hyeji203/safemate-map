import { useState } from 'react'
import { colors } from '../styles/colors'

// 경로 탐색이 가능한 시연 지역 범위. 도로망 그래프가 이 안에만 있다 (tools/build_osm_graph.py의 BBOX와 동일)
const DEMO_BOUNDS = { south: 37.435, west: 127.123, north: 37.458, east: 127.19 }

// 즐겨찾기 이름 최대 길이 (DB 컬럼은 255자지만 목록에서 한 줄로 보이도록 짧게 제한)
const FAVORITE_LABEL_MAX_LENGTH = 50

/**
 * 검색으로 고른 장소의 정보 카드 (지도 하단에서 올라오는 시트). 출발/도착 버튼으로 경로 지점을 지정한다.
 * - place: usePlaceSearch().selected
 * - favorite: 이 장소와 같은 위치의 즐겨찾기 (없으면 null) → "즐겨찾기됨"으로 표시
 * - onAddFavorite(label): 즐겨찾기 저장. 실패하면 예외를 던진다
 * 장소가 바뀌면 호출부에서 key를 바꿔 이름 입력 상태를 초기화한다.
 */
export default function PlaceSheet({ place, favorite, onAddFavorite, onClose, onSetStart, onSetEnd }) {
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

      <FavoriteControl place={place} favorite={favorite} onAddFavorite={onAddFavorite} />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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

// 이미 저장한 장소면 "즐겨찾기됨", 아니면 "즐겨찾기에 추가" → 이름 입력(기본값: 장소 이름) → 저장
function FavoriteControl({ place, favorite, onAddFavorite }) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(place.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (favorite) {
    return (
      <div style={{ ...favoriteButtonStyle, color: colors.amber, borderColor: colors.amber, cursor: 'default' }}>
        ★ 즐겨찾기됨 · {favorite.label}
      </div>
    )
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} style={favoriteButtonStyle}>
        ☆ 즐겨찾기에 추가
      </button>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!label.trim()) {
      setError('이름을 입력해주세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onAddFavorite(label.trim())
      // 성공하면 호출부의 favorite이 채워져 "즐겨찾기됨"으로 바뀐다
    } catch (err) {
      console.error('[PlaceSheet] 즐겨찾기 등록 실패', err)
      setError('즐겨찾기 등록에 실패했습니다.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          maxLength={FAVORITE_LABEL_MAX_LENGTH}
          placeholder="이름 (예: 집, 학교)"
          aria-label="즐겨찾기 이름"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px 12px',
            borderRadius: 10,
            border: `1px solid ${colors.gray}`,
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={saving}
          style={{ ...smallButtonStyle, background: colors.navy, color: colors.white, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? '저장 중' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          style={{ ...smallButtonStyle, background: colors.background, color: colors.navy }}
        >
          취소
        </button>
      </div>
      {error && <div style={{ marginTop: 6, fontSize: 12, color: colors.red }}>{error}</div>}
    </form>
  )
}

const favoriteButtonStyle = {
  display: 'block',
  width: '100%',
  marginTop: 16,
  padding: '10px 0',
  borderRadius: 24,
  border: `1px solid ${colors.gray}66`,
  background: 'none',
  color: colors.navy,
  fontSize: 14,
  fontWeight: 600,
  textAlign: 'center',
  cursor: 'pointer',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
}

const smallButtonStyle = {
  flexShrink: 0,
  padding: '0 14px',
  borderRadius: 10,
  border: 'none',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
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
