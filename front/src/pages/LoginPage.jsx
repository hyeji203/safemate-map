import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AuthError, AuthField, AuthLayout, AuthSubmit } from '../components/AuthForm'

// 로그인은 선택 사항. 로그인하지 않아도 지도·제보·즐겨찾기는 익명으로 그대로 쓸 수 있다.
export default function LoginPage() {
  const { member, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (member) return <Navigate to="/my" replace />

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
      navigate('/my', { replace: true })
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
    <AuthLayout title="로그인" subtitle="로그인하면 다른 기기에서도 내 제보와 즐겨찾기를 볼 수 있어요.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
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
        <Link to="/" className="text-muted">
          로그인 없이 둘러보기
        </Link>
      </div>
    </AuthLayout>
  )
}
