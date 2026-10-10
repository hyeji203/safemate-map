import { useNavigate } from 'react-router-dom'
import { Bell, MapPin, Star } from 'lucide-react'
import { categoryIcon, categoryLabel } from '../constants/reportCategories'
import { useNotifications } from '../hooks/useNotifications'

// 알림: 다른 사용자가 새로 올린 제보 목록. 즐겨찾기 장소 근처 제보는 강조해서 보여준다.
export default function NotificationsPage() {
  const navigate = useNavigate()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()

  // 알림을 누르면 읽음 처리하고 지도 화면에서 그 제보 위치를 보여준다 (MapPage가 state.focus를 초기 중심으로 사용)
  const showOnMap = (notification) => {
    markRead(notification.id)
    navigate('/', { state: { focus: { lat: notification.latitude, lng: notification.longitude } } })
  }

  return (
    <div className="min-h-full bg-night font-sans text-slate-200">
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-4 pt-5 pb-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="m-0 text-[22px] font-bold text-white">
            알림
            {unreadCount > 0 && <span className="ml-2 text-base font-bold text-accent">{unreadCount}</span>}
          </h1>
          <button
            type="button"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="cursor-pointer rounded-lg border border-solid border-line bg-transparent px-3 py-1.5 text-[13px] text-accent disabled:cursor-default disabled:text-muted disabled:opacity-60"
          >
            모두 읽음
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-4 py-10 text-center">
            <Bell size={28} className="text-muted" aria-hidden />
            <p className="m-0 text-sm break-keep text-muted">
              아직 알림이 없습니다.
              <br />
              다른 사용자가 새 위험구간을 제보하면 여기에 표시돼요.
            </p>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {notifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} onSelect={() => showOnMap(notification)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// 서버의 LocalDateTime 문자열(예: 2026-09-26T21:30:12)을 "2026.09.26 21:30"으로 표시
function formatDateTime(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 주소가 없으면(주소 변환 실패 등) 좌표로, 좌표도 없으면 안내 문구로 대신한다
function formatLocation({ address, latitude, longitude }) {
  if (address) return address
  if (latitude != null && longitude != null) return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
  return '주소 정보 없음'
}

function NotificationCard({ notification, onSelect }) {
  const { read, nearFavorite } = notification
  const label = categoryLabel(notification.category)
  // 즐겨찾기 근처 > 안 읽음 > 읽음 순으로 테두리를 강조한다
  const borderClass = nearFavorite ? 'border-accent/70' : read ? 'border-transparent' : 'border-line'

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-label={`${read ? '' : '안 읽은 알림, '}${label} 제보 위치를 지도에서 보기`}
        className={`flex w-full cursor-pointer flex-col gap-2.5 rounded-2xl border border-solid ${borderClass} bg-card p-4 text-left font-[inherit] text-inherit ${
          read ? 'opacity-70' : ''
        }`}
      >
        {nearFavorite && (
          <div className="flex items-center gap-1.5 text-[13px] font-bold break-keep text-accent">
            <Star size={14} className="shrink-0" fill="currentColor" aria-hidden />
            <span>
              즐겨찾기한 &lsquo;{nearFavorite.label}&rsquo; 근처에 새 제보
              <span className="ml-1 font-normal text-muted">({nearFavorite.distance}m)</span>
            </span>
          </div>
        )}
        <div className="flex w-full items-center gap-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-xl" aria-hidden>
            {categoryIcon(notification.category)}
          </div>
          <span className={`min-w-0 flex-1 text-[15px] text-white ${read ? 'font-medium' : 'font-bold'}`}>{label}</span>
          <span className="flex shrink-0 items-center gap-2 self-start">
            <time dateTime={notification.createdAt} className="text-xs text-muted">
              {formatDateTime(notification.createdAt)}
            </time>
            {!read && <span className="size-2 rounded-full bg-accent" aria-hidden />}
          </span>
        </div>
        <div className="flex gap-1.5 text-[13px] break-keep text-slate-200">
          <MapPin size={14} className="mt-[3px] shrink-0 text-muted" aria-hidden />
          <span>{formatLocation(notification)}</span>
        </div>
      </button>
    </li>
  )
}
