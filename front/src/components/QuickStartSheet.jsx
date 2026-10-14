/**
 * 지도 화면 아래쪽(하단 탭 바로 위) "빠른 출발" 시트. 아무것도 정하지 않은 처음 상태에서만 MapPage가 띄운다.
 * 오른쪽의 내 위치·제보 버튼 자리는 비워 두도록 위치(left/right/bottom)는 MapPage 아래 안내 바와 같게 쓴다.
 * - destinations: [{ key, icon, label, onClick }] 즐겨찾기·최근 길찾기 목적지 (없으면 저장 안내 한 줄)
 * - error: 위치 권한 등 안내할 오류가 있으면 맨 위에 한 줄로
 */
export default function QuickStartSheet({ style, destinations, error }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl bg-white py-2.5 font-sans shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
      style={style}
    >
      {error && <p className="m-0 px-3.5 text-[12px] leading-snug break-keep text-[#E5484D]">{error}</p>}
      <b className="px-3.5 text-[14px] text-[#1A2B4C]">어디로 갈까요?</b>
      {destinations.length > 0 ? (
        // 옆으로 밀지 않아도 다 보이게 넘치면 다음 줄로 내린다. 모두 같은 모양이라 처음부터 골라진 것처럼 보이는 칩이 없다
        <div className="flex flex-wrap gap-1.5 px-3.5">
          {destinations.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={d.onClick}
              className="quick-start-chip flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap"
            >
              <span aria-hidden>{d.icon}</span>
              <span className="min-w-0 truncate">{d.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="m-0 px-3.5 text-[13px] break-keep text-[#8A93A6]">자주 가는 곳을 ☆로 저장해 보세요</p>
      )}
    </div>
  )
}
