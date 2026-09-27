import { useNavigate } from 'react-router-dom'
import { usePlaceSearch } from '../hooks/usePlaceSearch'
import { colors } from '../styles/colors'

// 경로 탐색 화면 (필수 MVP). 출발지/도착지를 카카오 로컬 API(키워드 검색)로 찾아 좌표를 확정하고,
// 실제 경로 계산/표시는 지도 화면(MapPage)에서 이어서 한다.
export default function RouteSearchPage() {
  const navigate = useNavigate()
  const start = usePlaceSearch()
  const end = usePlaceSearch()

  const canSubmit = Boolean(start.selected && end.selected)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    navigate('/', { state: { start: start.selected, end: end.selected } })
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ color: colors.navy }}>경로 탐색</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AddressField placeholder="출발지" field={start} />
        <AddressField placeholder="도착지" field={end} />
        <button type="submit" disabled={!canSubmit} style={{ ...buttonStyle, opacity: canSubmit ? 1 : 0.5 }}>
          안심 경로 찾기
        </button>
      </form>
    </div>
  )
}

function AddressField({ placeholder, field }) {
  const { query, results, selected, loading, error, onQueryChange, onSelect } = field
  const showDropdown = !selected && (results.length > 0 || loading || error)

  return (
    <div style={{ position: 'relative' }}>
      <input
        placeholder={placeholder}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        style={{ ...inputStyle, borderColor: selected ? colors.amber : colors.gray }}
      />
      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: colors.white,
            border: `1px solid ${colors.gray}55`,
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {loading && <div style={dropdownMessageStyle}>검색 중...</div>}
          {!loading && error && <div style={{ ...dropdownMessageStyle, color: colors.red }}>{error}</div>}
          {!loading &&
            !error &&
            results.map((place, i) => (
              <button
                key={`${place.placeName}-${place.latitude}-${place.longitude}-${i}`}
                type="button"
                onClick={() => onSelect(place)}
                style={resultItemStyle}
              >
                <div style={{ fontWeight: 700, color: colors.navy }}>{place.placeName}</div>
                <div style={{ fontSize: 12, color: colors.gray }}>{place.addressName}</div>
              </button>
            ))}
          {!loading && !error && results.length === 0 && (
            <div style={dropdownMessageStyle}>검색 결과가 없습니다.</div>
          )}
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  padding: 12,
  borderRadius: 8,
  border: `1px solid ${colors.gray}`,
  width: '100%',
  boxSizing: 'border-box',
}

const dropdownMessageStyle = {
  padding: 12,
  fontSize: 13,
  color: colors.gray,
}

const resultItemStyle = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '10px 12px',
  border: 'none',
  borderBottom: `1px solid ${colors.gray}22`,
  background: colors.white,
  cursor: 'pointer',
}

const buttonStyle = {
  padding: 12,
  borderRadius: 8,
  border: 'none',
  background: colors.navy,
  color: colors.white,
  fontWeight: 700,
}
