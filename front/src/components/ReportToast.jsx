import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Star, X } from 'lucide-react'
import { categoryIcon, categoryLabel } from '../constants/reportCategories'
import { useNotifications } from '../hooks/useNotifications'

const SHOW_MS = 3000

// 새 제보 알림 / 내 제보 등록·삭제 완료를 화면 위쪽에 잠깐 띄운다. 어느 화면에 있든 보이도록 App에 한 번만 둔다.
export default function ReportToast() {
  const navigate = useNavigate()
  const { toast, dismissToast, markRead } = useNotifications()

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(dismissToast, SHOW_MS)
    return () => clearTimeout(timer)
  }, [toast, dismissToast])

  if (!toast) return null

  // 새 제보 팝업을 누르면 알림 목록에서 누른 것과 똑같이 읽음 처리 + 지도에서 제보 위치를 보여준다
  const showOnMap = () => {
    const n = toast.notification
    markRead(n.id)
    dismissToast()
    navigate('/', { state: { focus: { lat: n.latitude, lng: n.longitude } } })
  }

  const isReport = toast.kind === 'report'
  const n = toast.notification

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[1100] flex justify-center px-4 font-sans">
      <div
        role="status"
        className={`pointer-events-auto flex w-full max-w-[430px] items-start gap-3 rounded-2xl border border-solid bg-card px-4 py-3 shadow-lg ${
          isReport && n.nearFavorite ? 'border-accent' : 'border-line'
        }`}
      >
        {isReport ? (
          <button
            type="button"
            onClick={showOnMap}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 border-0 bg-transparent p-0 text-left"
          >
            <span className="text-xl leading-6" aria-hidden>
              {categoryIcon(n.category)}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1 text-sm font-bold text-white">
                {n.nearFavorite && <Star size={14} className="shrink-0 text-accent" aria-hidden />}
                {n.nearFavorite ? `즐겨찾기한 '${n.nearFavorite.label}' 근처에 새 제보` : '새 위험 제보'}
              </span>
              <span className="truncate text-[13px] text-slate-300">
                {categoryLabel(n.category)}
                {n.address ? ` · ${n.address}` : ''}
              </span>
              <span className="text-xs text-accent">눌러서 지도에서 보기</span>
            </span>
          </button>
        ) : (
          <div className="flex flex-1 items-center gap-3">
            <CheckCircle2 size={20} className="shrink-0 text-accent" aria-hidden />
            <span className="text-sm text-white">{toast.message}</span>
          </div>
        )}
        <button
          type="button"
          onClick={dismissToast}
          aria-label="알림 닫기"
          className="cursor-pointer border-0 bg-transparent p-0.5 text-muted"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
    </div>
  )
}
