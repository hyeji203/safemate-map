import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const SPOT_PADDING = 6 // 강조 영역과 버튼 사이 여백
const GAP = 12 // 강조 영역과 말풍선 사이 간격 (꼬리가 들어가는 자리)
const BUBBLE_MAX_WIDTH = 300
const EDGE = 12 // 화면 가장자리 여백
const ARROW_INSET = 18 // 꼬리가 말풍선 모서리(둥근 부분)에 붙지 않게

/**
 * 화면 위 버튼을 하나씩 밝게 뚫어 비추고, 옆에 말풍선으로 설명하는 코치마크.
 * 화면 전체(하단 탭 포함)를 덮어야 해서 body에 바로 띄우고, 위치는 화면(viewport) 기준으로 잰다.
 * - steps: [{ target, title, text }]. target은 강조할 요소의 data-coach 값 (같은 값이 여러 개면 모두 감싸는 영역)
 *   지금 화면에 대상이 없으면 그 단계는 진행 방향대로 건너뛴다
 * - onClose(dontShowAgain): 건너뛰기·시작하기·Esc로 닫을 때. "다시 표시 안 함" 체크 여부를 같이 넘긴다
 * 오버레이 바깥(어두운 부분)을 눌러도 닫히지 않는다.
 */
export default function CoachMarks({ steps, onClose }) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1) // 대상이 없는 단계를 건너뛸 방향 (다음: 1, 이전: -1)
  const [dontShow, setDontShow] = useState(false)
  const [layout, setLayout] = useState(null)
  const bubbleRef = useRef(null)
  const nextButtonRef = useRef(null)
  const checkboxId = useId()
  const step = steps[index]
  const first = index === 0
  const last = index === steps.length - 1

  const close = useCallback(() => onClose(dontShow), [onClose, dontShow])

  const go = useCallback(
    (delta) => {
      const target = index + delta
      if (target >= steps.length) close()
      else if (target >= 0) {
        setDirection(delta)
        setIndex(target)
      }
    },
    [index, steps.length, close],
  )

  // 스포트라이트·말풍선 위치 계산. 지도 이동·화면 크기 변경·스크롤·카드 등장으로 버튼이 움직여도 따라가도록
  // 열려 있는 동안 매 프레임 다시 재고, 값이 바뀐 경우에만 다시 그린다
  useLayoutEffect(() => {
    let frame
    const update = () => {
      setLayout((prev) => {
        const next = { ...computeLayout(step.target, bubbleRef.current), target: step.target }
        return sameLayout(prev, next) ? prev : next
      })
      frame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(frame)
  }, [step])

  // 대상이 지금 화면에 없으면(예: 장소 카드가 떠서 내 위치 버튼이 숨겨짐) 진행 방향대로 한 칸 더 간다.
  // 맨 앞에서 뒤로 가다 막히면 앞으로 방향을 바꾼다
  useEffect(() => {
    // 측정값이 지금 단계 것인지 확인한다 (단계가 막 바뀐 직후엔 이전 단계 측정값이 남아 있어서 두 칸 건너뛰지 않게)
    if (layout?.missing !== true || layout.target !== step.target) return
    go(direction < 0 && index === 0 ? 1 : direction)
  }, [layout, step, direction, index, go])

  useEffect(() => {
    nextButtonRef.current?.focus({ preventScroll: true })
  }, [index])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close()
      else if (event.key === 'ArrowRight') go(1)
      else if (event.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, go])

  const ready = layout && !layout.missing && layout.target === step.target
  const { spot, bubble, placement, arrow } = ready ? layout : {}

  return createPortal(
    // 화면 전체를 덮어 아래 지도·버튼이 눌리지 않게 막는다. 바깥을 눌러도 닫지 않는다
    <div className="fixed inset-0 z-[1500] overflow-hidden font-sans" role="dialog" aria-modal="true" aria-label="화면 사용법 안내">
      {ready ? (
        <div
          className="coach-spot pointer-events-none absolute"
          style={{ ...spot, borderRadius: Math.min(spot.height / 2, 24) }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(11,21,40,0.6)]" />
      )}

      <div
        ref={bubbleRef}
        className="coach-bubble absolute flex flex-col gap-2 rounded-2xl bg-[#1A2B4C] px-4 pt-3 pb-3 text-slate-200 shadow-2xl"
        style={
          ready
            ? { left: bubble.left, top: bubble.top, width: bubble.width }
            : // 첫 프레임: 높이를 재기 위해 보이지 않게 그려 둔다
              { left: EDGE, top: 0, width: Math.min(BUBBLE_MAX_WIDTH, window.innerWidth - EDGE * 2), visibility: 'hidden' }
        }
      >
        {ready && (
          // 말풍선 꼬리: 비추는 버튼 쪽을 가리킨다
          <span aria-hidden className={`coach-arrow coach-arrow-${placement}`} style={arrow} />
        )}

        {/* 단계가 바뀔 때마다 내용이 살짝 떠오르듯 바뀐다 */}
        <div key={index} className="coach-content flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-accent">
              {index + 1} / {steps.length}
            </span>
            <button
              type="button"
              onClick={close}
              className="cursor-pointer border-none bg-transparent p-1 text-[13px] text-muted underline-offset-2 hover:text-white hover:underline"
            >
              건너뛰기
            </button>
          </div>
          <b className="text-[16px] leading-snug text-white">{step.title}</b>
          <p className="m-0 text-[13px] leading-relaxed break-keep text-slate-300">{step.text}</p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <label htmlFor={checkboxId} className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted select-none">
            <input
              id={checkboxId}
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="m-0 h-4 w-4 cursor-pointer accent-[#FFB020]"
            />
            다시 표시 안 함
          </label>
          <div className="flex shrink-0 gap-1.5">
            {!first && (
              <button
                type="button"
                onClick={() => go(-1)}
                className="cursor-pointer rounded-lg border border-solid border-white/25 bg-transparent px-3 py-1.5 text-[13px] font-bold text-slate-200"
              >
                이전
              </button>
            )}
            <button
              ref={nextButtonRef}
              type="button"
              onClick={() => go(1)}
              className="cursor-pointer rounded-lg border-none bg-accent px-3.5 py-1.5 text-[13px] font-bold text-night"
            >
              {last ? '시작하기' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// 대상 요소(들)를 감싸는 영역과, 그 옆 빈 공간 중 말풍선이 들어가는 쪽(아래 → 위 → 오른쪽 → 왼쪽 순)을 찾는다
function computeLayout(target, bubbleEl) {
  const els = [...document.querySelectorAll(`[data-coach="${target}"]`)].filter((el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  })
  if (els.length === 0) return { missing: true }

  const rects = els.map((el) => el.getBoundingClientRect())
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.max(Math.min(...rects.map((r) => r.left)) - SPOT_PADDING, 2)
  const top = Math.max(Math.min(...rects.map((r) => r.top)) - SPOT_PADDING, 2)
  const right = Math.min(Math.max(...rects.map((r) => r.right)) + SPOT_PADDING, vw - 2)
  const bottom = Math.min(Math.max(...rects.map((r) => r.bottom)) + SPOT_PADDING, vh - 2)
  const spot = { left, top, width: right - left, height: bottom - top }

  const width = Math.min(BUBBLE_MAX_WIDTH, vw - EDGE * 2)
  const height = bubbleEl?.offsetHeight || 170
  const cx = left + spot.width / 2
  const cy = top + spot.height / 2
  const clampX = (x) => Math.min(Math.max(x, EDGE), vw - width - EDGE)
  const clampY = (y) => Math.min(Math.max(y, EDGE), vh - height - EDGE)

  const room = {
    bottom: vh - bottom - GAP - EDGE >= height,
    top: top - GAP - EDGE >= height,
    right: vw - right - GAP - EDGE >= width,
    left: left - GAP - EDGE >= width,
  }
  // 어디에도 다 안 들어가면 위·아래 중 넓은 쪽
  const placement =
    ['bottom', 'top', 'right', 'left'].find((side) => room[side]) ?? (vh - bottom > top ? 'bottom' : 'top')

  let bubble
  let arrow
  if (placement === 'bottom' || placement === 'top') {
    const bx = clampX(cx - width / 2)
    const by = placement === 'bottom' ? bottom + GAP : top - GAP - height
    bubble = { left: bx, top: clampY(by), width }
    arrow = { left: Math.min(Math.max(cx - bx, ARROW_INSET), width - ARROW_INSET) }
  } else {
    const bx = placement === 'right' ? right + GAP : left - GAP - width
    const by = clampY(cy - height / 2)
    bubble = { left: bx, top: by, width }
    arrow = { top: Math.min(Math.max(cy - by, ARROW_INSET), height - ARROW_INSET) }
  }
  return { spot, bubble, placement, arrow }
}

function sameLayout(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}
