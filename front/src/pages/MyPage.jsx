import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cctv, Lightbulb, MapPin, Moon, User } from 'lucide-react'

// 아직 로그인이 없어 표시용 고정 프로필을 쓴다.
const PROFILE = { nickname: '밤길지킴이', email: 'safewalker@dowajwo-map.kr' }

// Member.reliabilityScore 조회 API가 아직 없어 고정값으로 표시한다.
const RELIABILITY_SCORE = 95

// 서버 연동 전 화면 확인용 더미 제보 내역. API가 붙으면 reportApi.findMine() 결과로 교체한다.
const DUMMY_REPORTS = [
  {
    id: 1,
    category: '가로등 고장',
    address: '서울 마포구 월드컵북로 12길 34',
    date: '2026.09.26',
    Icon: Lightbulb,
    iconClass: 'bg-[#FFB800]/15 text-[#FFB800]',
  },
  {
    id: 2,
    category: '어두운 골목',
    address: '서울 마포구 성미산로 7길 인근 골목',
    date: '2026.09.21',
    Icon: Moon,
    iconClass: 'bg-[#8B5CF6]/20 text-[#A78BFA]',
  },
  {
    id: 3,
    category: 'CCTV 사각지대',
    address: '서울 서대문구 연희로 25 공영주차장 뒤편',
    date: '2026.09.14',
    Icon: Cctv,
    iconClass: 'bg-[#2DD4BF]/15 text-[#2DD4BF]',
  },
]

// 마이페이지: 프로필, 제보 신뢰도 점수, 내 제보 내역. 하단 탭은 App 공통 BottomNav가 그린다.
export default function MyPage() {
  const [reports, setReports] = useState(DUMMY_REPORTS)

  // 더미 데이터 단계라 화면 목록에서만 뺀다
  const handleCancel = (id) => {
    if (!window.confirm('이 제보를 취소할까요?')) return
    setReports((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="min-h-full bg-night font-sans text-slate-200">
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-4 pt-5 pb-6">
        <h1 className="m-0 text-[22px] font-bold text-white">마이페이지</h1>

        <ProfileCard />
        <ReliabilityScore score={RELIABILITY_SCORE} />

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-[17px] font-bold text-white">내 제보 내역</h2>
            <span className="text-sm text-muted">{reports.length}건</span>
          </div>

          {reports.length === 0 ? (
            <p className="m-0 py-4 text-center text-sm text-muted">아직 등록한 제보가 없습니다.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {reports.map((report) => (
                <ReportCard key={report.id} report={report} onCancel={() => handleCancel(report.id)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function ProfileCard() {
  const navigate = useNavigate()

  return (
    <section className="flex items-center gap-3 rounded-2xl bg-card p-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-line" aria-hidden>
        <User size={26} className="text-muted" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-base font-bold text-white">{PROFILE.nickname}</div>
        <div className="truncate text-[13px] text-muted">{PROFILE.email}</div>
      </div>
      <button
        type="button"
        onClick={() => navigate('/login')}
        className="shrink-0 cursor-pointer rounded-full border border-solid border-line bg-transparent px-3 py-1.5 text-[13px] text-muted"
      >
        로그아웃
      </button>
    </section>
  )
}

function reliabilityGrade(score) {
  if (score >= 90) return '매우 높음'
  if (score >= 70) return '높음'
  if (score >= 50) return '보통'
  return '낮음'
}

function ReliabilityScore({ score }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-[15px] font-bold text-white">내 제보 신뢰도 점수</h2>
        <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">
          {reliabilityGrade(score)}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[40px] leading-tight font-extrabold text-accent">{score}</span>
        <span className="text-[15px] text-muted">/ 100점</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="제보 신뢰도"
        className="h-2 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${score}%` }} />
      </div>
      <p className="m-0 text-xs text-muted">정확한 제보가 쌓일수록 신뢰도가 올라가요.</p>
    </section>
  )
}

function ReportCard({ report, onCancel }) {
  const { Icon } = report

  return (
    <li className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
      <div className="flex items-center gap-2.5">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${report.iconClass}`} aria-hidden>
          <Icon size={20} />
        </div>
        <span className="min-w-0 flex-1 text-[15px] font-bold text-white">{report.category}</span>
        <time className="shrink-0 self-start text-xs text-muted">{report.date}</time>
      </div>
      <div className="flex gap-1.5 text-[13px] break-keep text-slate-200">
        <MapPin size={14} className="mt-[3px] shrink-0 text-muted" aria-hidden />
        <span>{report.address}</span>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-lg border border-solid border-line bg-transparent px-3 py-1.5 text-[13px] text-muted"
        >
          제보 취소
        </button>
      </div>
    </li>
  )
}
