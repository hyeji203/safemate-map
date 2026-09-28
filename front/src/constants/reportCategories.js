// icon: 지도 마커 안에 표시할 문자. 마커 색은 "위험구간=빨강" 원칙을 지키려고 전부 동일하게 두고,
// 카테고리 구분은 아이콘으로만 한다.
export const REPORT_CATEGORIES = [
  { value: 'STREETLIGHT_BROKEN', label: '가로등 고장', icon: '💡' },
  { value: 'DARK_ALLEY', label: '어두움', icon: '🌙' },
  { value: 'EMPTY_STREET', label: '인적 드묾', icon: '🚶' },
  { value: 'SIDEWALK_DAMAGED', label: '인도 파손', icon: '🚧' },
]

export function categoryLabel(value) {
  return REPORT_CATEGORIES.find((c) => c.value === value)?.label ?? value
}

export function categoryIcon(value) {
  return REPORT_CATEGORIES.find((c) => c.value === value)?.icon ?? '⚠️'
}
