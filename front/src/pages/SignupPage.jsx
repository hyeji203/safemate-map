import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AuthError, AuthField, AuthLayout, AuthSubmit } from '../components/AuthForm'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_ERROR = '올바른 이메일 주소를 입력해주세요. (예: example@email.com)'
// 백엔드 SignupRequest 검증 규칙과 맞춘다
const PASSWORD_MIN = 8
const PASSWORD_MAX = 64
const NICKNAME_MAX = 20

function validate({ nickname, email, password, passwordConfirm }) {
  if (!nickname.trim()) return '닉네임을 입력해주세요.'
  if (nickname.trim().length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MAX}자 이하로 입력해주세요.`
  if (!EMAIL_PATTERN.test(email.trim())) return EMAIL_ERROR
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)
    return `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자로 입력해주세요.`
  if (password !== passwordConfirm) return '비밀번호가 서로 다릅니다.'
  return null
}

export default function SignupPage() {
  const { member, signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nickname: '', email: '', password: '', passwordConfirm: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  // 이메일 칸을 한 번 벗어난 뒤부터 형식 안내를 칸 아래에 띄운다 (입력 도중 첫 글자부터 경고가 뜨지 않게)
  const [emailTouched, setEmailTouched] = useState(false)

  // 로그인한 상태면(방금 로그인·가입한 경우 포함) 지도 화면으로 보낸다
  if (member) return <Navigate to="/" replace />

  const emailError =
    emailTouched && form.email.trim() && !EMAIL_PATTERN.test(form.email.trim()) ? EMAIL_ERROR : null

  // 이 앱 안에서 넘어왔으면 바로 전 화면으로, 회원가입 주소로 바로 들어왔으면 로그인 화면으로 돌아간다
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/login', { replace: true })
  }

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const message = validate(form)
    setEmailTouched(true)
    if (message) {
      setError(message)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await signup({ nickname: form.nickname.trim(), email: form.email.trim(), password: form.password })
      // 가입하면 로그인한 상태로 바로 지도 화면으로 간다
      navigate('/', { replace: true })
    } catch (err) {
      setError(
        err.response?.status === 409
          ? '이미 가입된 이메일입니다.'
          : '회원가입에 실패했습니다. 입력값을 확인하고 다시 시도해주세요.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="회원가입"
      subtitle="지금까지 이 기기에서 남긴 제보와 즐겨찾기는 새 계정으로 옮겨져요."
      onBack={goBack}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        <AuthField
          label="닉네임"
          autoComplete="nickname"
          placeholder="밤길지킴이"
          maxLength={NICKNAME_MAX}
          value={form.nickname}
          onChange={update('nickname')}
        />
        <AuthField
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="example@email.com"
          value={form.email}
          onChange={update('email')}
          onBlur={() => setEmailTouched(true)}
          error={emailError}
        />
        <AuthField
          label={`비밀번호 (${PASSWORD_MIN}자 이상)`}
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호"
          maxLength={PASSWORD_MAX}
          value={form.password}
          onChange={update('password')}
        />
        <AuthField
          label="비밀번호 확인"
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호 다시 입력"
          maxLength={PASSWORD_MAX}
          value={form.passwordConfirm}
          onChange={update('passwordConfirm')}
        />
        <AuthError message={error} />
        <AuthSubmit disabled={submitting}>{submitting ? '가입 중…' : '가입하기'}</AuthSubmit>
      </form>

      <p className="m-0 text-center text-sm text-muted">
        이미 계정이 있나요?{' '}
        <Link to="/login" className="font-bold text-accent no-underline">
          로그인
        </Link>
      </p>
    </AuthLayout>
  )
}
