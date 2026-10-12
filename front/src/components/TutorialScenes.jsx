import { Bell, BookOpen, Flag, Map, MapPin, Search, Star, TriangleAlert, User, X } from 'lucide-react'
import { colors } from '../styles/colors'
import './tutorialScenes.css'

// 사용가이드 단계별 움짤. 실제 화면을 단순화한 모형이고, 숫자·장소는 설명용 예시다.
// 지도 좌표는 viewBox(320x150) 기준이며, 그 위에 올리는 HTML 요소는 같은 비율의 %로 위치를 잡는다.
const VIEW_W = 320
const VIEW_H = 150
const START = { x: 60, y: 110 }
const END = { x: 250, y: 40 }
const SAFE_PATH = `M${START.x} ${START.y} L${END.x} ${START.y} L${END.x} ${END.y}`
const SHORT_PATH = `M${START.x} ${START.y} L150 75 L${END.x} ${END.y}`
const LAMPS = [
  [110, 110],
  [160, 110],
  [210, 110],
  [250, 85],
  [250, 60],
]

const pos = ({ x, y }) => ({ left: `${(x / VIEW_W) * 100}%`, top: `${(y / VIEW_H) * 100}%` })

// at: 6초 주기 중 누르는 시점(0~1)
function Tap({ at, style }) {
  return <span className="tut-tap" style={{ ...style, animationDelay: `calc(var(--tut-duration) * ${at - 1})` }} />
}

function SceneFrame({ children, dark = false }) {
  return (
    <div
      className={`tut-scene relative w-full overflow-hidden rounded-2xl border border-solid border-line ${dark ? 'bg-night' : ''}`}
      style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
      aria-hidden
    >
      {children}
    </div>
  )
}

function MapBackdrop({ children }) {
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 block size-full">
      <rect width={VIEW_W} height={VIEW_H} fill="#e9edf2" />
      <g fill="#dde3ea">
        <rect x="75" y="52" width="160" height="46" rx="6" />
        <rect x="0" y="0" width="50" height="95" rx="6" />
        <rect x="265" y="55" width="55" height="95" rx="6" />
        <rect x="75" y="122" width="160" height="28" rx="6" />
      </g>
      <g stroke="#fff" strokeLinecap="round" fill="none">
        <path d={`M0 ${START.y} H${VIEW_W} M0 ${END.y} H${VIEW_W} M${START.x} 0 V${VIEW_H} M${END.x} 0 V${VIEW_H}`} strokeWidth="9" />
        <path d={SHORT_PATH} strokeWidth="3" />
      </g>
      {children}
    </svg>
  )
}

function Pins() {
  return (
    <>
      <span
        className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-solid border-white"
        style={{ ...pos(START), background: colors.navy }}
      />
      <span className="absolute -translate-x-1/2 -translate-y-full" style={{ ...pos(END), color: colors.navy }}>
        <Flag size={18} fill={colors.amber} />
      </span>
    </>
  )
}

// 1단계: 안심경로를 따라 가로등이 켜지고, 사람이 걸어간다
export function IntroScene() {
  return (
    <SceneFrame>
      <MapBackdrop>
        <path d={SAFE_PATH} pathLength="1" className="tut-draw-a" stroke={colors.amber} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {LAMPS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y - 11} r="4" fill={colors.amber} className="tut-lamp" style={{ filter: 'drop-shadow(0 0 4px #ffb020)' }} />
        ))}
      </MapBackdrop>
      <Pins />
      <span
        className="tut-walker absolute size-3.5 rounded-full border-2 border-solid border-white shadow"
        style={{ background: colors.navy }}
      />
    </SceneFrame>
  )
}

// 2단계: 검색 → 핀 → 장소 카드에서 "도착" 누르기
export function SearchScene() {
  // 검색창에 가리지 않도록 핀은 지도 가운데쯤에 떨어뜨린다
  const found = { x: END.x, y: 80 }
  return (
    <SceneFrame>
      <MapBackdrop />
      <div className="absolute inset-x-2 top-2 flex h-7 items-center gap-1.5 rounded-lg bg-white px-2 text-[12px] text-slate-700 shadow">
        <Search size={13} className="shrink-0 text-slate-400" />
        <span className="tut-type">단대오거리역</span>
      </div>
      <span className="tut-drop absolute" style={{ ...pos(found), color: colors.red }}>
        <MapPin size={22} fill="#fff" />
      </span>
      <div className="tut-sheet absolute inset-x-0 bottom-0 flex items-center gap-2 rounded-t-xl bg-white px-3 py-2 shadow-lg">
        <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-800">단대오거리역</span>
        <span className="rounded-md border border-solid border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-700">출발</span>
        <span className="tut-pick relative rounded-md border border-solid border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-800">
          도착
          <Tap at={0.66} style={{ left: '50%', top: '50%' }} />
        </span>
      </div>
    </SceneFrame>
  )
}

// 3단계: 회색 최단경로, 노란 안심경로가 차례로 그려진다
export function CompareScene() {
  return (
    <div className="flex flex-col gap-2">
      <SceneFrame>
        <MapBackdrop>
          <path d={SHORT_PATH} pathLength="1" className="tut-draw-a" stroke={colors.gray} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={SAFE_PATH} pathLength="1" className="tut-draw-b" stroke={colors.amber} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </MapBackdrop>
        <Pins />
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] whitespace-nowrap text-slate-700 shadow">
          <b>신구대학교</b>→<b>단대오거리역</b>
          <X size={12} className="text-slate-400" />
        </div>
      </SceneFrame>
      <RoutePreview />
    </div>
  )
}

function RoutePreview() {
  return (
    <div className="flex gap-2" aria-hidden>
      <div className="min-w-0 flex-1 rounded-2xl border-2 border-solid border-accent bg-card px-3 py-2">
        <div className="text-xs font-bold text-accent">안심경로</div>
        <div className="text-lg font-extrabold text-white">12분</div>
        <div className="text-[11px] text-muted">예시 · 어두운 구간 적음</div>
      </div>
      <div className="min-w-0 flex-1 rounded-2xl border-2 border-solid border-muted bg-card px-3 py-2">
        <div className="text-xs font-bold text-muted">최단경로</div>
        <div className="text-lg font-extrabold text-white">9분</div>
        <div className="text-[11px] text-muted">예시 · 거리 짧음</div>
      </div>
    </div>
  )
}

// 4단계: 경고 버튼 → 지도 누르기 → 빨간 마커
export function ReportScene() {
  const spot = { x: 150, y: 75 }
  return (
    <SceneFrame>
      <MapBackdrop />
      <div className="tut-banner absolute top-2 left-1/2 rounded-full px-3 py-1 text-[11px] font-bold whitespace-nowrap text-white shadow" style={{ background: colors.red }}>
        제보할 위치를 눌러 주세요
      </div>
      <Tap at={0.42} style={pos(spot)} />
      <span
        className="tut-marker absolute flex size-6 items-center justify-center rounded-full border-2 border-solid border-white text-white shadow"
        style={{ ...pos(spot), background: colors.red }}
      >
        <TriangleAlert size={12} />
      </span>
      <div className="tut-toast absolute bottom-2 left-1/2 rounded-lg bg-slate-800 px-3 py-1 text-[11px] whitespace-nowrap text-white">
        제보가 등록됐어요
      </div>
      <span className="tut-report-btn absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-full text-white shadow">
        <TriangleAlert size={16} />
        <Tap at={0.12} style={{ left: '50%', top: '50%' }} />
      </span>
    </SceneFrame>
  )
}

// 5단계: "주변 제보" 버튼 → 목록이 올라옴 → "가로등" 버튼으로 골라 보면 사진도 보인다
export function NearbyScene() {
  const dots = [
    { x: 120, y: 75 },
    { x: 205, y: 60 },
    { x: 265, y: 100 },
  ]
  return (
    <SceneFrame>
      <MapBackdrop>
        {dots.map(({ x, y }) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill={colors.red} stroke="#fff" strokeWidth="2" />
        ))}
      </MapBackdrop>
      <div className="absolute inset-x-2 top-2 flex h-6 items-center gap-1.5 rounded-lg bg-white px-2 text-[11px] text-slate-400 shadow">
        <Search size={12} className="shrink-0" />
        장소, 주소 검색
      </div>
      <span className="tut-nb-btn absolute top-10 left-2 flex items-center gap-1 rounded-full border-2 border-solid px-2 py-0.5 text-[10px] font-bold shadow">
        주변 제보
        <span className="rounded-full px-1.5 text-[9px] text-white" style={{ background: colors.red }}>
          3
        </span>
        <Tap at={0.1} style={{ left: '50%', top: '50%' }} />
      </span>
      <div className="tut-nb-sheet absolute inset-x-0 bottom-0 flex h-[62%] flex-col gap-1 rounded-t-xl bg-white px-2.5 pt-1.5 shadow-lg">
        <div className="flex gap-1 text-[9px] font-bold whitespace-nowrap">
          <span className="tut-nb-all rounded-full border border-solid px-1.5 py-px">전체 3</span>
          <span className="tut-nb-chip relative rounded-full border border-solid px-1.5 py-px">
            💡 가로등 고장 1
            <Tap at={0.5} style={{ left: '50%', top: '50%' }} />
          </span>
          <span className="rounded-full border border-solid border-slate-300 px-1.5 py-px text-slate-700">🌙 어두운 골목 1</span>
        </div>
        <div className="relative min-h-0 flex-1">
          <div className="tut-nb-list-all absolute inset-0 flex flex-col">
            <NearbyRow icon="💡" label="가로등 고장" distance="80m" />
            <NearbyRow icon="🌙" label="어두운 골목" distance="200m" />
            <NearbyRow icon="🚶" label="인적 드묾" distance="450m" />
          </div>
          <div className="tut-nb-list-cat absolute inset-0 flex flex-col">
            <NearbyRow icon="💡" label="가로등 고장" distance="80m" />
            {/* 제보 사진 자리 (설명용 모형) */}
            <div className="mt-0.5 flex min-h-0 flex-1 items-center justify-center rounded-md bg-slate-100">
              <span className="h-full w-1/3 rounded" style={{ background: `linear-gradient(135deg, ${colors.navy}, #4a5f86)` }} />
            </div>
          </div>
        </div>
      </div>
    </SceneFrame>
  )
}

function NearbyRow({ icon, label, distance }) {
  return (
    <div className="flex items-center gap-1 border-0 border-b border-solid border-slate-100 py-0.5 text-[10px]">
      <span>{icon}</span>
      <b className="flex-1 text-slate-800">{label}</b>
      <b style={{ color: colors.red }}>{distance}</b>
    </div>
  )
}

// 6단계: 다른 사람이 제보하면 위쪽에 팝업 + 지도에 마커 + 알림 탭 배지 → 팝업을 누르면 그 위치로
export function AlertScene() {
  const spot = { x: 175, y: 80 }
  const tabs = [
    { Icon: Map, label: '지도' },
    { Icon: Star, label: '즐겨찾기' },
    { Icon: Bell, label: '알림', badge: true },
    { Icon: User, label: '마이' },
  ]
  return (
    <SceneFrame>
      <MapBackdrop />
      <span
        className="tut-al-marker absolute flex size-5 items-center justify-center rounded-full border-2 border-solid border-white text-[10px] shadow"
        style={{ ...pos(spot), background: colors.red }}
      >
        💡
      </span>
      <span className="tut-al-ring absolute size-10 rounded-full border-2 border-solid" style={{ ...pos(spot), borderColor: colors.red }} />
      <div className="tut-al-toast absolute inset-x-3 top-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 shadow-lg" style={{ background: colors.navy }}>
        <span className="text-[13px]">💡</span>
        <span className="flex min-w-0 flex-col leading-tight">
          <b className="text-[11px] text-white">새 위험 제보</b>
          <span className="truncate text-[9px] text-slate-300">가로등 고장 · 눌러서 지도에서 보기</span>
        </span>
        <Tap at={0.55} style={{ left: '50%', top: '50%' }} />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex border-0 border-t border-solid border-line bg-night py-1">
        {tabs.map(({ Icon, label, badge }) => (
          <span key={label} className="relative flex flex-1 flex-col items-center text-[9px] text-muted">
            <Icon size={13} />
            {label}
            {badge && (
              <span
                className="tut-al-badge absolute -top-1 left-1/2 ml-1 rounded-full px-1 text-[8px] leading-tight font-bold text-white"
                style={{ background: colors.red }}
              >
                1
              </span>
            )}
          </span>
        ))}
      </div>
    </SceneFrame>
  )
}

// 7단계: 즐겨찾기 탭 → 저장한 장소, 마이 탭 → 사용가이드 다시 보기
export function FavoritesScene() {
  const tabs = [
    { Icon: Map, label: '지도' },
    { Icon: Star, label: '즐겨찾기', className: 'tut-tab-1', tapAt: 0.12 },
    { Icon: Bell, label: '알림' },
    { Icon: User, label: '마이', className: 'tut-tab-2', tapAt: 0.52 },
  ]
  return (
    <SceneFrame dark>
      <div className="absolute inset-x-3 top-3">
        <div className="tut-page-1 absolute inset-x-0 top-0 flex items-center gap-2 rounded-xl bg-card px-3 py-2.5">
          <Star size={16} className="shrink-0 text-accent" fill="currentColor" />
          <span className="text-[13px] font-bold text-white">집</span>
          <span className="text-[11px] text-muted">37.44, 127.15</span>
        </div>
        <div className="tut-page-2 absolute inset-x-0 top-0 flex items-center gap-2 rounded-xl border border-solid border-accent bg-card px-3 py-2.5">
          <BookOpen size={16} className="shrink-0 text-accent" />
          <span className="text-[13px] font-bold text-white">사용가이드 다시 보기</span>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex border-0 border-t border-solid border-line bg-night py-1.5">
        {tabs.map(({ Icon, label, className = '', tapAt }) => (
          <span key={label} className={`relative flex flex-1 flex-col items-center gap-0.5 text-[10px] text-muted ${className}`}>
            <Icon size={16} />
            {label}
            {tapAt !== undefined && <Tap at={tapAt} style={{ left: '50%', top: '40%' }} />}
          </span>
        ))}
      </div>
    </SceneFrame>
  )
}
