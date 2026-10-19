import { createContext, useCallback, useContext, useRef, useState } from 'react'

const TutorialContext = createContext(null)

// 이 브라우저에서 사용 가이드를 한 번이라도 닫았는지. 기기 식별자(safemate_device_id)와는 별개다.
const STORAGE_KEY = 'safemate_tutorial_seen'

function hasSeenTutorial() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function markTutorialSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // 저장이 막혀 있으면 이번 화면에서만 닫힌다. 다음 방문에 다시 연다.
  }
}

// mode: 'ask'(써 본 적 있는지 묻기) | 'tour'(가이드 진행) | null(닫힘)
// 처음 방문이면 먼저 물어보고, 마이페이지의 다시 보기는 묻지 않고 바로 가이드를 연다.
// replayHint: 처음 방문 흐름에서 가이드를 닫은 직후, "마이페이지에서 다시 볼 수 있다"는 안내를 띄울지.
// 마이페이지에서 다시 연 경우는 이미 그 위치를 알고 있으니 띄우지 않는다.
export function TutorialProvider({ children }) {
  const [mode, setMode] = useState(() => (hasSeenTutorial() ? null : 'ask'))
  const [replayHint, setReplayHint] = useState(false)
  const openedFromMyPage = useRef(false)

  const dismiss = useCallback(() => {
    markTutorialSeen()
    setMode(null)
    if (!openedFromMyPage.current) setReplayHint(true)
    openedFromMyPage.current = false
  }, [])

  const startTour = useCallback(() => {
    setMode('tour')
  }, [])

  const reopen = useCallback(() => {
    openedFromMyPage.current = true
    setReplayHint(false)
    setMode('tour')
  }, [])

  // 로그인 화면의 "로그인 없이 시작하기": 본 적이 있어도 매번 "써 본 적 있나요?"부터 다시 묻는다
  const askAgain = useCallback(() => {
    openedFromMyPage.current = false
    setReplayHint(false)
    setMode('ask')
  }, [])

  const hideReplayHint = useCallback(() => {
    setReplayHint(false)
  }, [])

  return (
    <TutorialContext.Provider value={{ mode, dismiss, startTour, reopen, askAgain, replayHint, hideReplayHint }}>
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorial() {
  const value = useContext(TutorialContext)
  if (!value) {
    throw new Error('useTutorial는 TutorialProvider 안에서만 사용할 수 있습니다.')
  }
  return value
}
