import { useEffect, useId, useState } from 'react'
import {
  BookOpen,
  Camera,
  Footprints,
  MapPin,
  Moon,
  MousePointerClick,
  RotateCcw,
  Route,
  Search,
  Star,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useTutorial } from '../hooks/useTutorial'
import { CompareScene, FavoritesScene, IntroScene, ReportScene, SearchScene } from './TutorialScenes'

// 처음 방문과 마이페이지 "사용가이드 다시 보기"가 같은 안내를 쓴다.
// 한 단계 = 움짤(Scene) + 한 줄 요약(lead) + 짧은 항목(points). 긴 문단 대신 훑어볼 수 있게 짧게 유지한다.
// 숫자는 화면 설명용 예시다. 실제 경로 계산 결과가 아니다.
const STEPS = [
  {
    title: '도와줘, 맵!',
    Scene: IntroScene,
    lead: '밤길, 더 안심되는 길로 안내해요.',
    points: [
      { Icon: Route, text: '최단경로와 안심경로를 함께 비교' },
      { Icon: UserRound, text: '로그인 없이 바로 사용 가능' },
    ],
  },
  {
    title: '출발지·도착지 정하기',
    Scene: SearchScene,
    lead: '검색하거나 지도를 눌러 고르세요.',
    points: [
      { Icon: Search, text: '검색창에 장소·주소 입력' },
      { Icon: MapPin, text: '카드에서 출발 / 도착 선택' },
      { Icon: Footprints, text: '신구대 ↔ 단대오거리역 구간 지원' },
    ],
  },
  {
    title: '경로 비교하기',
    Scene: CompareScene,
    lead: '노란 선이 안심, 회색 선이 최단이에요.',
    points: [
      { Icon: Moon, text: '시간 · 거리 · 어두운 구간 비교' },
      { Icon: MousePointerClick, text: '위쪽 막대를 눌러 지점 변경' },
      { Icon: X, text: '✕ 를 누르면 경로 지우기' },
    ],
  },
  {
    title: '위험구간 제보',
    Scene: ReportScene,
    lead: '오른쪽 아래 ⚠ 버튼 → 지도에서 위치 선택',
    points: [
      { Icon: Camera, text: '종류만 고르면 끝, 사진은 선택' },
      { Icon: Route, text: '등록 즉시 경로에 반영' },
      { Icon: Trash2, text: '내 제보만 삭제 가능' },
    ],
  },
  {
    title: '즐겨찾기 & 다시 보기',
    Scene: FavoritesScene,
    lead: '자주 가는 곳은 저장해 두세요.',
    points: [
      { Icon: Star, text: '하단 즐겨찾기에 장소 저장' },
      { Icon: UserRound, text: '로그인하면 다른 기기에서도 보기' },
      { Icon: RotateCcw, text: '마이페이지에서 가이드 다시 보기' },
    ],
  },
]

export default function UsageTutorial() {
  const { mode, dismiss, startTour, replayHint, hideReplayHint } = useTutorial()
  if (mode === 'ask') return <FirstVisitDialog onStart={startTour} onSkip={dismiss} />
  if (mode !== 'tour') return replayHint ? <ReplayHint onClose={hideReplayHint} /> : null
  // 닫히면 이 화면이 언마운트되므로, 다시 열면 항상 첫 단계부터 시작한다.
  return <TutorialDialog dismiss={dismiss} />
}

// 가이드를 닫은 직후 잠깐 떠서, 마이페이지에서 다시 볼 수 있다고 알려 준다.
function ReplayHint({ onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      // 아래쪽 제보·현재 위치 버튼을 가리지 않도록 지도 검색창 바로 아래에 띄운다
      className="pointer-events-none fixed inset-x-0 top-[72px] z-[2000] flex justify-center px-4 font-sans"
    >
      <div
        role="status"
        data-testid="usage-tutorial-replay-hint"
        className="pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-2xl border border-solid border-line bg-card px-4 py-3 text-slate-200 shadow-2xl"
      >
        <BookOpen size={20} className="shrink-0 text-accent" aria-hidden />
        <p className="m-0 min-w-0 flex-1 text-[14px] break-keep">
          사용가이드는 <b className="text-white">마이페이지</b>에서 언제든 다시 볼 수 있어요.
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="안내 닫기"
          className="flex shrink-0 cursor-pointer items-center border-none bg-transparent p-1 text-muted"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

// 처음 방문했을 때만 뜬다. 써 본 적 있다고 하면 가이드를 보여 주지 않고, 다시 묻지도 않는다.
function FirstVisitDialog({ onStart, onSkip }) {
  const titleId = useId()

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4 font-sans">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="usage-tutorial-ask"
        className="flex w-full max-w-[420px] flex-col gap-4 rounded-3xl bg-night p-5 text-slate-200 shadow-2xl"
      >
        <img src="/logo.svg" alt="" width={56} height={56} className="mx-auto block" />
        <div className="flex flex-col gap-2 text-center">
          <h2 id={titleId} className="m-0 text-[22px] font-bold text-white">
            도와줘, 맵!을 써 본 적 있나요?
          </h2>
          <p className="m-0 text-[15px] leading-relaxed break-keep text-muted">
            처음이라면 사용법을 짧게 안내해 드릴게요. 나중에 마이페이지에서 언제든 다시 볼 수 있어요.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onStart}
            data-testid="usage-tutorial-start"
            className="cursor-pointer rounded-xl border-none bg-accent py-3 text-[15px] font-bold text-night"
          >
            처음이에요, 사용법 볼게요
          </button>
          <button
            type="button"
            onClick={onSkip}
            data-testid="usage-tutorial-used-before"
            className="cursor-pointer rounded-xl border border-solid border-line bg-transparent py-3 text-[15px] font-bold text-muted"
          >
            써 본 적 있어요
          </button>
        </div>
      </div>
    </div>
  )
}

function TutorialDialog({ dismiss }) {
  const [step, setStep] = useState(0)
  const titleId = useId()
  const current = STEPS[step]
  const StepScene = current.Scene
  const last = step === STEPS.length - 1

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismiss])

  const goNext = () => {
    if (last) dismiss()
    else setStep((prev) => prev + 1)
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4 font-sans">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="usage-tutorial"
        className="flex max-h-full w-full max-w-[420px] flex-col gap-4 overflow-y-auto rounded-3xl bg-night p-5 text-slate-200 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-sm font-bold text-accent">
            {step + 1} / {STEPS.length}
          </p>
          <button
            type="button"
            onClick={dismiss}
            data-testid="usage-tutorial-skip"
            className="cursor-pointer rounded-full border border-solid border-line bg-transparent px-3 py-1.5 text-[13px] font-bold text-muted"
          >
            건너뛰기
          </button>
        </div>

        {/* 단계가 바뀌면 key가 달라져 움짤이 처음부터 다시 재생된다 */}
        <StepScene key={step} />

        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="m-0 text-[22px] font-bold text-white">
            {current.title}
          </h2>
          <p className="m-0 text-[15px] font-semibold break-keep text-accent">{current.lead}</p>
        </div>

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {current.points.map(({ Icon: PointIcon, text }) => (
            <li key={text} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5">
              <PointIcon size={18} className="shrink-0 text-accent" aria-hidden />
              <span className="text-[14px] break-keep text-slate-200">{text}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-center gap-1.5" aria-hidden>
          {STEPS.map((item, index) => (
            <span
              key={item.title}
              className={`h-1.5 rounded-full ${index === step ? 'w-6 bg-accent' : 'w-1.5 bg-line'}`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep((prev) => prev - 1)}
            disabled={step === 0}
            className="flex-1 cursor-pointer rounded-xl border border-solid border-line bg-transparent py-3 text-[15px] font-bold text-muted disabled:cursor-default disabled:opacity-40"
          >
            이전
          </button>
          <button
            type="button"
            onClick={goNext}
            data-testid="usage-tutorial-next"
            className="flex-[2] cursor-pointer rounded-xl border-none bg-accent py-3 text-[15px] font-bold text-night"
          >
            {last ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}

