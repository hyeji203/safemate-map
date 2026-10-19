import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTutorial } from '../hooks/useTutorial'
import { AuthError, AuthField, AuthLayout, AuthSubmit } from '../components/AuthForm'

// 앱 첫 화면이기도 해서, 로그인 칸 위에 어떤 앱인지(이름·한 줄 소개)를 먼저 보여 준다

function AppIntro() {
  return (
    <div className="flex flex-col items-center gap-3 pt-4 text-center">
      <img src="/logo.svg" alt="" width={80} height={80} />
      <h1 className="m-0 text-[28px] font-extrabold tracking-tight text-white">도와줘, 맵!</h1>
      <p className="m-0 text-[15px] break-keep text-slate-300">늦은 밤 귀갓길, 더 안심되는 길을 알려 드려요</p>
    </div>
  )
}

// 로그인은 선택 사항. 로그인하지 않아도 지도·제보·즐겨찾기는 익명으로 그대로 쓸 수 있다.
// 로그인하거나 "로그인 없이 시작하기"를 누르면 바로 지도 화면으로 간다
export default function LoginPage() {
  const { member, login } = useAuth()
  const { askAgain } = useTutorial()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // 로그인한 상태면(방금 로그인·가입한 경우 포함) 지도 화면으로 보낸다
  if (member) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await login({ email: email.trim(), password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(
        err.response?.status === 401
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout header={<AppIntro />}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" aria-label="로그인" noValidate>
        <AuthField
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="example@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <AuthError message={error} />
        <AuthSubmit disabled={submitting}>{submitting ? '로그인 중…' : '로그인'}</AuthSubmit>
      </form>

      <div className="flex flex-col items-center gap-2 text-sm text-muted">
        <p className="m-0">
          아직 계정이 없나요?{' '}
          <Link to="/signup" className="font-bold text-accent no-underline">
            회원가입
          </Link>
        </p>
        {/* 로그인 없이 시작하면 저장된 "이미 봤음" 기록과 상관없이 매번 사용 가이드 → 화면 버튼 안내(코치마크)를 띄운다 */}
        <Link to="/" replace state={{ guestStart: true }} onClick={askAgain} className="text-muted">
          로그인 없이 시작하기
        </Link>
      </div>
    </AuthLayout>
  )
}
