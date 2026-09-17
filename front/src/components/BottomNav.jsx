import { NavLink } from 'react-router-dom'
import { colors } from '../styles/colors'

const TABS = [
  { to: '/', label: '지도', icon: '🏠', end: true },
  { to: '/favorites', label: '즐겨찾기', icon: '⭐' },
  { to: '/notifications', label: '알림', icon: '🔔' },
  { to: '/my', label: '마이페이지', icon: '👤' },
]

// 하단 4탭 네비게이션. 즐겨찾기/알림/마이페이지는 탭 구조만 먼저 잡고,
// 실제 기능은 MVP(지도/경로탐색/제보/로그인) 완료 후 고도화 단계에서 구현한다.
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
