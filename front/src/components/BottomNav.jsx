import { NavLink } from 'react-router-dom'
import { colors } from '../styles/colors'

const TABS = [
  { to: '/', label: '지도', icon: '🏠', end: true },
  { to: '/notifications', label: '알림', icon: '🔔' },
  { to: '/my', label: '마이페이지', icon: '👤' },
]

// 즐겨찾기는 독립 탭이 아니라 마이페이지 하위 기능으로 통합됨 (기획 문서 참고).
// 알림 탭은 아직 placeholder.
export default function BottomNav() {
  return (
    <nav
      style={{
        display: 'flex',
        borderTop: `1px solid ${colors.gray}33`,
        background: colors.white,
      }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          style={({ isActive }) => ({
            flex: 1,
            padding: '10px 0',
            textAlign: 'center',
            textDecoration: 'none',
            fontSize: 12,
            color: isActive ? colors.navy : colors.gray,
            fontWeight: isActive ? 700 : 400,
          })}
        >
          <div style={{ fontSize: 20 }}>{tab.icon}</div>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
