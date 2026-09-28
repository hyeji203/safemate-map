import { colors } from '../styles/colors'

/**
 * 지도 상단 장소 검색창. 입력하면 아래로 검색 결과 목록이 펼쳐지고, 하나를 고르면 search.selected가 채워진다.
 * - search: usePlaceSearch() 반환값
 */
export default function PlaceSearchBar({ search }) {
  const { query, results, selected, loading, error, onQueryChange, onSelect, reset } = search
  const showDropdown = !selected && (results.length > 0 || loading || error)

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: colors.white,
          borderRadius: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          padding: '0 8px 0 16px',
        }}
      >
        <span style={{ fontSize: 16, marginRight: 8 }} aria-hidden>
          🔍
        </span>
        <input
          placeholder="장소, 주소 검색"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            padding: '12px 0',
            fontSize: 15,
            fontWeight: selected ? 700 : 400,
            color: colors.navy,
            background: 'transparent',
          }}
        />
        {query && (
          <button type="button" onClick={reset} aria-label="검색어 지우기" style={clearButtonStyle}>
            ✕
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 6,
            background: colors.white,
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {loading && <div style={messageStyle}>검색 중...</div>}
          {!loading && error && <div style={{ ...messageStyle, color: colors.red }}>{error}</div>}
          {!loading &&
            !error &&
            results.map((place, i) => (
              <button
                key={`${place.placeName}-${place.latitude}-${place.longitude}-${i}`}
                type="button"
                onClick={() => onSelect(place)}
                style={resultItemStyle}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: colors.navy }}>{place.placeName}</span>
                  {place.categoryName && (
                    <span style={{ fontSize: 12, color: colors.gray }}>{place.categoryName}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: colors.gray, marginTop: 2 }}>{place.addressName}</div>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

const clearButtonStyle = {
  border: 'none',
  background: 'transparent',
  color: colors.gray,
  fontSize: 16,
  padding: 8,
  cursor: 'pointer',
}

const messageStyle = {
  padding: 14,
  fontSize: 13,
  color: colors.gray,
}

const resultItemStyle = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '12px 16px',
  border: 'none',
  borderBottom: `1px solid ${colors.gray}22`,
  background: colors.white,
  cursor: 'pointer',
}
