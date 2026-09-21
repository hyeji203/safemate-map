export const REPORT_CATEGORIES = [
  { value: 'STREETLIGHT_BROKEN', label: '가로등 고장' },
  { value: 'DARK_ALLEY', label: '어두움' },
  { value: 'EMPTY_STREET', label: '인적 드묾' },
  { value: 'SIDEWALK_DAMAGED', label: '인도 파손' },
]

export function categoryLabel(value) {
  return REPORT_CATEGORIES.find((c) => c.value === value)?.label ?? value
}
