import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, MapPin, User } from 'lucide-react'
import { reportApi } from '../api/reportApi'
import { categoryIcon, categoryLabel } from '../constants/reportCategories'
import { useAuth } from '../hooks/useAuth'
import { useTutorial } from '../hooks/useTutorial'
import { useNotifications } from '../hooks/useNotifications'
import { PasswordInput } from '../components/AuthForm'

// 마이페이지: 프로필, 사용가이드 다시 보기, 내 제보 내역. 하단 탭은 App 공통 BottomNav가 그린다.
export default function MyPage() {
  const navigate = useNavigate()
  const { member } = useAuth()
  const { reopen } = useTutorial()
  const { markMineDeleted } = useNotifications()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelingId, setCancelingId] = useState(null)

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await reportApi.findMine()
      setReports(data)
    } catch (err) {
      console.error('[MyPage] 내 제보 조회 실패', err)
      setError('제보 내역을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  // 서버가 로그인 회원 → deviceId 순으로 "내 것"을 판단하므로, 로그인/로그아웃하면 목록을 다시 불러온다
  const memberEmail = member?.email
  useEffect(() => {
    loadReports()
  }, [loadReports, memberEmail])

  const handleCancel = async (id) => {
    if (!window.confirm('이 제보를 취소할까요?')) return
    setCancelingId(id)
    try {
      await reportApi.remove(id)
      setReports((prev) => prev.filter((r) => r.id !== id))
      markMineDeleted()
    } catch (err) {
      console.error('[MyPage] 제보 취소 실패', err)
      window.alert('제보를 취소하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setCancelingId(null)
    }
  }

  // 카드를 누르면 지도 화면에서 그 제보 위치를 보여준다 (MapPage가 state.focus를 초기 중심으로 사용)
  const showOnMap = (report) => {
    navigate('/', { state: { focus: { lat: report.latitude, lng: report.longitude } } })
  }

  return (
    <div className="min-h-full bg-night font-sans text-slate-200">
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-4 pt-5 pb-6">
        <h1 className="m-0 text-[22px] font-bold text-white">마이페이지</h1>

        <ProfileCard />
        <button
          type="button"
          onClick={reopen}
          data-testid="usage-guide-replay"
          className="flex cursor-pointer items-center gap-3 rounded-2xl border border-solid border-line bg-card px-4 py-3.5 text-left text-white"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent" aria-hidden>
            <BookOpen size={20} />
          </span>
          <span className="min-w-0 flex-1 text-[15px] font-bold">사용가이드 다시 보기</span>
          <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
        </button>

        <section className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-[17px] font-bold text-white">내 제보 내역</h2>
            {!loading && !error && <span className="text-sm text-muted">{reports.length}건</span>}
          </div>

          {loading ? (
            <p className="m-0 py-12 text-center text-sm text-muted">불러오는 중...</p>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <p className="m-0 text-center text-sm text-muted">{error}</p>
              <button
                type="button"
                onClick={loadReports}
                className="cursor-pointer rounded-lg border border-solid border-line bg-transparent px-3 py-1.5 text-[13px] text-accent"
              >
                다시 시도
              </button>
            </div>
          ) : reports.length === 0 ? (
            <p className="m-0 py-12 text-center text-sm text-muted">아직 등록한 제보가 없습니다.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  canceling={cancelingId === report.id}
                  onSelect={() => showOnMap(report)}
                  onCancel={() => handleCancel(report.id)}
                />
              ))}
            </ul>
          )}
        </section>

        {member && <WithdrawSection />}
      </div>
    </div>
  )
}

// 회원탈퇴: 맨 아래 작은 글씨 버튼을 누르면 안내와 비밀번호 확인 칸을 펼친다. 탈퇴하면 로그인 화면으로 간다
function WithdrawSection() {
  const navigate = useNavigate()
  const { withdraw } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const close = () => {
    setOpen(false)
    setPassword('')
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password) {
      setError('비밀번호를 입력해주세요.')
      return
    }
    if (!window.confirm('정말 탈퇴할까요? 되돌릴 수 없습니다.')) return
    setSubmitting(true)
    setError(null)
    try {
      await withdraw(password)
      window.alert('탈퇴했어요. 그동안 이용해 주셔서 감사합니다.')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(
        err.response?.status === 401 ? '비밀번호가 올바르지 않습니다.' : '탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 cursor-pointer self-center border-none bg-transparent p-2 text-[13px] text-muted underline underline-offset-2"
      >
        회원탈퇴
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex flex-col gap-3 rounded-2xl border border-solid border-red-400/40 bg-card p-4"
      noValidate
    >
      <h2 className="m-0 text-[16px] font-bold text-white">회원탈퇴</h2>
      <ul className="m-0 flex flex-col gap-1 pl-5 text-[13px] break-keep text-slate-300">
        <li>계정과 즐겨찾기는 모두 삭제돼요.</li>
        <li>
          올린 제보는 다른 사람의 안심경로를 위해 &quot;탈퇴한 사용자&quot;의 익명 제보로 남아요. 이후에는 직접 지울 수 없고,
          다른 사용자가 해결됐다고 알려 주면 사라져요.
        </li>
        <li>탈퇴하면 되돌릴 수 없어요.</li>
      </ul>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">
        비밀번호 확인
        <PasswordInput
          autoComplete="current-password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-solid border-line bg-night px-3.5 py-3 text-[15px] text-white outline-none placeholder:text-muted/60 focus:border-red-400"
        />
      </label>
      {error && (
        <p role="alert" className="m-0 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={close}
          className="flex-1 cursor-pointer rounded-xl border border-solid border-line bg-transparent py-2.5 text-[14px] text-slate-200"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 cursor-pointer rounded-xl border-none bg-red-500 py-2.5 text-[14px] font-bold text-white disabled:cursor-default disabled:opacity-60"
        >
          {submitting ? '탈퇴 중…' : '탈퇴하기'}
        </button>
      </div>
    </form>
  )
}

// 로그인했으면 계정 정보 + 로그아웃, 아니면 익명 이용 안내 + 로그인 버튼
function ProfileCard() {
  const navigate = useNavigate()
  const { member, loading, logout } = useAuth()

  const handleLogout = async () => {
    if (!window.confirm('로그아웃할까요?')) return
    try {
      await logout()
      // 로그아웃하면 앱 첫 화면처럼 로그인 화면으로 돌아간다
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('[MyPage] 로그아웃 실패', err)
      window.alert('로그아웃에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  return (
    <section className="flex items-center gap-3 rounded-2xl bg-card p-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-line" aria-hidden>
        <User size={26} className="text-muted" />
      </div>
      <div className="min-w-0 flex-1">
        {member ? (
          <>
            <div className="truncate text-base font-bold text-white">{member.nickname}</div>
            <div className="truncate text-[13px] text-muted">{member.email}</div>
          </>
        ) : (
          <>
            <div className="text-base font-bold text-white">익명 사용자</div>
            <div className="text-[13px] break-keep text-muted">
              {loading ? '로그인 상태 확인 중…' : '로그인하면 다른 기기에서도 내 기록을 볼 수 있어요'}
            </div>
          </>
        )}
      </div>
      {member ? (
        <button
          type="button"
          onClick={handleLogout}
          className="shrink-0 cursor-pointer rounded-full border border-solid border-line bg-transparent px-3 py-1.5 text-[13px] text-muted"
        >
          로그아웃
        </button>
      ) : (
        !loading && (
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="shrink-0 cursor-pointer rounded-full border-none bg-accent px-3 py-1.5 text-[13px] font-bold text-night"
          >
            로그인
          </button>
        )
      )}
    </section>
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

function ReportCard({ report, canceling, onSelect, onCancel }) {
  return (
    <li className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`${categoryLabel(report.category)} 제보 위치를 지도에서 보기`}
        className="flex cursor-pointer flex-col gap-2.5 border-0 bg-transparent p-0 text-left font-[inherit] text-inherit"
      >
        <div className="flex w-full items-center gap-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-xl" aria-hidden>
            {categoryIcon(report.category)}
          </div>
          <span className="min-w-0 flex-1 text-[15px] font-bold text-white">{categoryLabel(report.category)}</span>
          <time dateTime={report.createdAt} className="shrink-0 self-start text-xs text-muted">
            {formatDateTime(report.createdAt)}
          </time>
        </div>
        <div className="flex gap-1.5 text-[13px] break-keep text-slate-200">
          <MapPin size={14} className="mt-[3px] shrink-0 text-muted" aria-hidden />
          <span>{formatLocation(report)}</span>
        </div>
      </button>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={canceling}
          className="cursor-pointer rounded-lg border border-solid border-line bg-transparent px-3 py-1.5 text-[13px] text-muted disabled:cursor-default disabled:opacity-60"
        >
          {canceling ? '취소 중...' : '제보 취소'}
        </button>
      </div>
    </li>
  )
}
