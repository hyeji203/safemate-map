import { NavLink } from 'react-router-dom'
import { Bell, Map, Star, User } from 'lucide-react'

const TABS = [
  { to: '/', label: '지도', Icon: Map, end: true },
  { to: '/favorites', label: '즐겨찾기', Icon: Star },
  { to: '/notifications', label: '알림', Icon: Bell },
  { to: '/my', label: '마이페이지', Icon: User },
]

// 화면 맨 아래 고정 하단 탭. 본문이 가려지지 않도록 App의 <main>에 이 높이(BOTTOM_NAV_HEIGHT)만큼 아래 여백을 준다.
// 알림 탭은 아직 placeholder.
export const BOTTOM_NAV_HEIGHT = 64

export default function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex border-0 border-t border-solid border-line bg-[#070E1C] pb-[env(safe-area-inset-bottom)]"
      style={{ height: BOTTOM_NAV_HEIGHT }}
    >
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs no-underline ${
              isActive ? 'font-bold text-accent' : 'text-muted'
            }`
          }
        >
          <Icon size={22} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
