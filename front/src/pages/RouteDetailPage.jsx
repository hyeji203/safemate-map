import { colors } from '../styles/colors'

// 경로 상세/안내 화면 (필수 MVP). 최단/안심 경로 비교 표시는 2단계에서 실제 데이터 연결 후 완성.
export default function RouteDetailPage() {
  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ color: colors.navy }}>경로 상세</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <RouteSummaryCard label="안심 경로" color={colors.amber} />
        <RouteSummaryCard label="최단 경로" color={colors.gray} />
      </div>
    </div>
  )
}

function RouteSummaryCard({ label, color }) {
  return (
    <div
      style={{
        borderLeft: `6px solid ${color}`,
        padding: 12,
        borderRadius: 4,
        background: colors.background,
      }}
    >
      <strong>{label}</strong>
      <p style={{ color: colors.gray, margin: '4px 0 0' }}>거리/소요시간은 2단계에서 연결됩니다.</p>
    </div>
  )
}
