import { NavLink } from 'react-router-dom'
import { Bell, Map, Star, User } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'

const TABS = [
  { to: '/', label: '지도', Icon: Map, end: true },
  { to: '/favorites', label: '즐겨찾기', Icon: Star },
  { to: '/notifications', label: '알림', Icon: Bell },
  { to: '/my', label: '마이페이지', Icon: User },
]

// 화면 맨 아래 고정 하단 탭. 본문이 가려지지 않도록 App의 <main>에 이 높이(BOTTOM_NAV_HEIGHT)만큼 아래 여백을 준다.
// 알림 탭에는 안 읽은 알림 개수를 배지로 붙인다.
export const BOTTOM_NAV_HEIGHT = 64

export default function BottomNav() {
  const { unreadCount } = useNotifications()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex border-0 border-t border-solid border-line bg-[#070E1C] pb-[env(safe-area-inset-bottom)]"
      // 아이폰 홈 바 영역(safe-area)만큼 높이를 더해, 그 여백 때문에 탭 아이콘이 눌려 작아지지 않게 한다
      style={{ height: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))` }}
    >
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          // 지도 화면 코치마크 마지막 단계에서 알림·마이페이지 탭을 함께 비춘다
          data-coach={to === '/notifications' || to === '/my' ? 'tabs' : undefined}
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs no-underline ${
              isActive ? 'font-bold text-accent' : 'text-muted'
            }`
          }
        >
          <span className="relative flex">
            <Icon size={22} aria-hidden />
            {to === '/notifications' && unreadCount > 0 && (
              <span
                className="absolute -top-1.5 left-3.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#E5484D] px-1 text-[11px] leading-none font-bold text-white"
                aria-label={`안 읽은 알림 ${unreadCount}개`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
