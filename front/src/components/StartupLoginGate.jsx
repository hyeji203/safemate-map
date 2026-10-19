import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AUTH_PATHS } from '../constants/authPaths'

// 앱을 켜거나 새로고침했을 때 로고·앱 이름 시작 화면을 보여 주는 시간
const SPLASH_MS = 1500

/**
 * 앱을 켜거나 새로고침하면 로고·앱 이름 시작 화면을 SPLASH_MS 동안 보여 준 뒤,
 * 로그인한 상태면 지금 화면을, 아니면 로그인 화면을 띄운다.
 * 로그인은 선택 사항이라 로그인 화면의 "로그인 없이 시작하기"로 지도 화면에 갈 수 있다.
 * 로그인 상태 확인(/api/members/me)이 더 오래 걸리면 끝날 때까지 시작 화면을 유지해, 지도가 잠깐 보였다가 넘어가지 않게 한다.
 */
export default function StartupLoginGate({ children }) {
  const { member, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [splashDone, setSplashDone] = useState(false)
  const [decided, setDecided] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), SPLASH_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (decided || loading) return
    if (!member && !AUTH_PATHS.includes(location.pathname)) navigate('/login', { replace: true })
    setDecided(true)
  }, [decided, loading, member, location, navigate])

  return decided && splashDone ? children : <SplashScreen />
}

function SplashScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-night font-sans" role="status" aria-label="도와줘, 맵! 시작 중">
      <img src="/logo.svg" alt="" width={96} height={96} className="splash-fade" />
      <h1 className="splash-fade m-0 text-[30px] font-extrabold tracking-tight text-white">도와줘, 맵!</h1>
    </div>
  )
}
