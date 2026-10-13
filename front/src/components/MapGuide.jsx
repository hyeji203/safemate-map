import { X } from 'lucide-react'

/**
 * 지도 화면 검색창 아래(주변 제보 버튼 줄 밑)에 뜨는 짧은 사용 안내 카드.
 * 한 줄 안내 + 누르면 바로 그 기능으로 가는 칩 3개. X로 닫으면 MapPage가 localStorage에 기억해 다시 띄우지 않는다.
 * - top: 지도 화면 기준 세로 위치(px)
 * - onSearch / onNearby / onReport: 칩을 눌렀을 때 (기능 로직은 MapPage의 기존 함수를 그대로 부른다)
 */
export default function MapGuide({ top, onSearch, onNearby, onReport, onClose }) {
  const chips = [
    { label: '안심경로 찾기', onClick: onSearch, primary: true },
    { label: '주변 제보 보기', onClick: onNearby },
    { label: '위험 제보하기', onClick: onReport },
  ]

  return (
    <div className="map-guide absolute inset-x-3 z-[9] flex flex-col gap-2 rounded-2xl px-3 py-2.5 font-sans" style={{ top }}>
      <div className="flex items-center gap-2">
        <p className="m-0 min-w-0 flex-1 text-[13px] font-semibold break-keep text-[#1A2B4C]">
          📍 목적지를 검색하면 안심경로를 알려드려요
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="안내 닫기"
          className="flex shrink-0 cursor-pointer items-center border-none bg-transparent p-0.5 text-[#1A2B4C]/60"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={chip.onClick}
            className={`map-guide-chip cursor-pointer rounded-full px-2.5 py-1.5 text-[13px] font-bold whitespace-nowrap${
              chip.primary ? ' is-primary' : ''
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  )
}
