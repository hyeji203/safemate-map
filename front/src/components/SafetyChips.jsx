import { SAFETY_LAYERS } from '../constants/safetyLayers'

/**
 * 지도 화면 검색창 바로 아래 칩 줄 (카카오맵·네이버지도의 카테고리 칩 줄과 같은 구조).
 * [주변 제보 N] │ [가로등] [편의점] [파출소] →
 * 맨 왼쪽 "주변 제보" 칩은 늘 보이게 고정하고(주변 제보 시트 열기), 구분선 오른쪽의 안전시설 칩만 옆으로 밀어 본다.
 * 스크롤되는 줄의 오른쪽 끝은 흐리게 처리해 칩이 더 있다는 걸 보여준다.
 * 모든 칩은 지도 플로팅 버튼과 같은 .map-fab 스타일: 꺼짐 = 반투명(글자·배지도 살짝 흐리게), 켜짐 = 진한 남색.
 * - layers / onToggle: useSafetyLayers의 켜짐 상태와 토글 함수
 * - reports: { count, active, onClick } 주변 제보 칩 (count가 0이면 숫자 배지 숨김)
 */
export default function SafetyChips({ style, layers, onToggle, reports }) {
  return (
    <div className="safety-chips" style={style} data-coach="chips">
      <button
        type="button"
        aria-pressed={reports.active}
        onClick={reports.onClick}
        className={`map-fab safety-chip${reports.active ? ' is-active' : ''}`}
      >
        주변 제보
        {reports.count > 0 && <span className="map-fab-badge safety-chip-badge">{reports.count > 99 ? '99+' : reports.count}</span>}
      </button>
      <span aria-hidden className="safety-chips-divider" />
      <div className="safety-chips-row" role="toolbar" aria-label="안전시설 표시">
        {SAFETY_LAYERS.map(({ key, icon, label, title }) => {
          const on = !!layers[key]
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              title={title ?? label}
              onClick={() => onToggle(key)}
              className={`map-fab safety-chip${on ? ' is-active' : ''}`}
            >
              <span aria-hidden className="map-fab-icon">
                {icon}
              </span>
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
