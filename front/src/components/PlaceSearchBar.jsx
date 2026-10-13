import { Fragment, useEffect, useState } from 'react'
import { colors } from '../styles/colors'
import { routeHistoryKey } from '../hooks/useRouteHistory'

/**
 * 지도 상단 장소 검색창. 입력하면 아래로 검색 결과 목록이 펼쳐지고, 하나를 고르면 search.selected가 채워진다.
 * - search: usePlaceSearch() 반환값
 * - history: 최근 길찾기 { items, onPick, onRemove, onClear } (선택). 검색창을 눌렀는데 입력한 글자가 없으면 목록을 띄운다
 * - hints: 안내 문구 배열 (선택). 주면 placeholder 대신 입력칸 위에 겹친 글자로 HINT_INTERVAL_MS마다 돌려 보여준다.
 *   검색창을 누르거나 글자를 입력하면 멈추고, 비운 채로 포커스가 빠지면 다시 돈다. 스크린리더에는 "장소, 주소 검색"으로 고정해 읽힌다
 */
const HINT_INTERVAL_MS = 3500
const SEARCH_LABEL = '장소, 주소 검색'

export default function PlaceSearchBar({ search, history, placeholder = SEARCH_LABEL, hints }) {
  const { query, selected, onQueryChange, onSelect, reset } = search
  const [focused, setFocused] = useState(false)
  const showHistory = focused && !query && !selected && history?.items.length > 0

  // 안내 문구 돌리기. 다른 화면으로 가서 이 검색창이 사라지면 타이머도 정리된다
  const [hintIndex, setHintIndex] = useState(0)
  const hintCount = hints?.length ?? 0
  const rotating = hintCount > 1 && !focused && !query
  useEffect(() => {
    if (!rotating) return
    const timer = setInterval(() => setHintIndex((i) => (i + 1) % hintCount), HINT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [rotating, hintCount])

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
        <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
        <input
          placeholder={hintCount > 0 ? '' : placeholder}
          aria-label={hintCount > 0 ? SEARCH_LABEL : undefined}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
        {hintCount > 0 && !query && (
          // 입력칸 위에 겹친 안내 문구 (누르면 아래 입력칸이 눌리게 pointer-events: none). 바뀔 때마다 위로 살짝 올라오며 나타난다
          <span aria-hidden className="search-hint-box">
            <span key={hintIndex} className="search-hint">
              {hints[hintIndex % hintCount]}
            </span>
          </span>
        )}
        </div>
        {query && (
          <button type="button" onClick={reset} aria-label="검색어 지우기" style={clearButtonStyle}>
            ✕
          </button>
        )}
      </div>

      <PlaceResults search={search} onSelect={onSelect} />
      {showHistory && <RouteHistory history={history} />}
    </div>
  )
}

/** 검색창 아래로 펼쳐지는 최근 길찾기 목록. 누르면 그 출발→도착으로 바로 길찾기 */
function RouteHistory({ history }) {
  const { items, onPick, onRemove, onClear } = history
  return (
    // 목록을 누를 때 검색창 blur로 목록이 먼저 닫히지 않게 막는다
    <div style={dropdownStyle} onMouseDown={(e) => e.preventDefault()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 6px' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>최근 길찾기</span>
        <button type="button" onClick={onClear} style={{ ...textButtonStyle, fontSize: 12 }}>
          전체 삭제
        </button>
      </div>
      {items.map((item) => (
        <div key={routeHistoryKey(item)} style={historyRowStyle}>
          <button type="button" onClick={() => onPick(item)} style={historyItemStyle}>
            <span style={{ ...dotStyle, background: colors.navy }} />
            <span style={ellipsisStyle}>{item.start.title ?? '출발지'}</span>
            <span style={{ color: colors.gray, flexShrink: 0 }}>→</span>
            <span style={{ ...dotStyle, background: colors.red }} />
            <span style={ellipsisStyle}>{item.end.title ?? '도착지'}</span>
          </button>
          <button
            type="button"
            onClick={() => onRemove(item)}
            aria-label="이 기록 삭제"
            style={{ ...textButtonStyle, fontSize: 14, padding: '8px 12px' }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

/**
 * 검색창 아래로 펼쳐지는 검색 결과 목록. 부모 요소(position: relative) 바로 아래에 붙는다.
 * 출발/도착 변경 입력칸에서도 같이 쓴다.
 * - search: usePlaceSearch() 반환값
 * - onSelect: 결과 하나를 골랐을 때 부를 함수
 */
export function PlaceResults({ search, onSelect }) {
  const { results, selected, loading, error } = search
  if (selected || !(results.length > 0 || loading || error)) return null

  return (
    <div style={dropdownStyle}>
      {loading && <div style={messageStyle}>검색 중...</div>}
      {!loading && error && <div style={{ ...messageStyle, color: colors.red }}>{error}</div>}
      {!loading &&
        !error &&
        results.map((place, i) => (
          <Fragment key={`${place.placeName}-${place.latitude}-${place.longitude}-${i}`}>
            {/* 서버가 검색어와 잘 맞는 결과 → 가까운 결과(nearby) 순으로 주므로, 가까운 결과가 시작되는 곳에 구분선 */}
            {place.nearby && !results[i - 1]?.nearby && <div style={sectionDividerStyle}>가까운 곳</div>}
            <button type="button" onClick={() => onSelect(place)} style={resultItemStyle}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontWeight: 700, color: colors.navy }}>{place.placeName}</span>
                {place.categoryName && (
                  <span style={{ fontSize: 12, color: colors.gray }}>{place.categoryName}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: colors.gray, marginTop: 2 }}>{place.addressName}</div>
            </button>
          </Fragment>
        ))}
    </div>
  )
}

const dropdownStyle = {
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
}

const textButtonStyle = {
  border: 'none',
  background: 'transparent',
  color: colors.gray,
  cursor: 'pointer',
  padding: 0,
}

const historyRowStyle = {
  display: 'flex',
  alignItems: 'center',
  borderBottom: `1px solid ${colors.gray}22`,
}

const historyItemStyle = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '12px 0 12px 16px',
  border: 'none',
  background: 'transparent',
  textAlign: 'left',
  fontSize: 14,
  color: colors.navy,
  cursor: 'pointer',
}

const dotStyle = { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }

const ellipsisStyle = { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

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

const sectionDividerStyle = {
  padding: '8px 16px 6px',
  fontSize: 12,
  fontWeight: 700,
  color: colors.gray,
  background: colors.background,
  borderTop: `1px solid ${colors.gray}33`,
  borderBottom: `1px solid ${colors.gray}22`,
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
