import { colors } from '../styles/colors'

// 즐겨찾기/알림/마이페이지 공용 플레이스홀더.
// 문서 지침: 하단 탭 구조는 미리 잡아두되, 실제 기능은 MVP 5화면 완성 후 고도화 단계에서 구현.
export default function PlaceholderPage({ title }) {
  return (
    <div style={{ padding: 16, color: colors.gray }}>
      <h2 style={{ color: colors.navy }}>{title}</h2>
      <p>고도화 단계에서 구현 예정입니다.</p>
    </div>
  )
}
