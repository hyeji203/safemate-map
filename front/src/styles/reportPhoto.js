import { colors } from './colors'

// 제보 사진을 자르지 않고 전체가 보이게 하는 공통 크기.
// 주변 제보 목록(NearbyReportsSheet)과, 거기서 고른 제보 카드(ReportDetail의 지도 위 카드)가 같이 쓴다
export const REPORT_PHOTO_STYLE = {
  display: 'block',
  width: '100%',
  maxHeight: 260,
  objectFit: 'contain',
  background: colors.background,
  borderRadius: 8,
}
