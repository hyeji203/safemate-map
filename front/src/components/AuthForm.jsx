import { useState } from 'react'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react'

// 로그인·회원가입 화면 공통 틀 (마이페이지와 같은 다크 테마)
// onBack을 주면 왼쪽 위에 이전 화면으로 돌아가는 버튼을 띄운다.
// header를 주면 기본 머리말(로고 + 제목 + 설명) 대신 그것을 그린다 (앱 첫 화면인 로그인 화면의 앱 소개용)
export function AuthLayout({ title, subtitle, header, onBack, children }) {
  return (
    <div className="min-h-full bg-night font-sans text-slate-200">
      <div className="relative mx-auto flex w-full max-w-[430px] flex-col gap-6 px-4 pt-10 pb-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="이전 화면으로"
            className="absolute top-3 left-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-slate-200 hover:bg-white/10"
          >
            <ChevronLeft size={26} aria-hidden />
          </button>
        )}
        {header ?? (
          <div className="flex flex-col items-center gap-3 text-center">
            <img src="/logo.svg" alt="도와줘, 맵!" width={64} height={64} />
            <h1 className="m-0 text-[22px] font-bold text-white">{title}</h1>
            {subtitle && <p className="m-0 text-sm break-keep text-muted">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// error를 주면 칸 테두리를 빨갛게 하고 칸 바로 아래에 안내를 띄운다
export function AuthField({ label, error, ...inputProps }) {
  const Input = inputProps.type === 'password' ? PasswordInput : 'input'
  return (
    <label className="flex flex-col gap-1.5 text-[13px] text-muted">
      {label}
      <Input
        {...inputProps}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-xl border border-solid bg-card px-3.5 py-3 text-[15px] text-white outline-none placeholder:text-muted/60 ${
          error ? 'border-red-400 focus:border-red-400' : 'border-line focus:border-accent'
        }`}
      />
      {error && <span className="text-[12px] text-red-300">{error}</span>}
    </label>
  )
}

// 비밀번호 칸: 오른쪽 눈 버튼으로 입력한 글자를 보였다 숨겼다 한다 (처음엔 숨김)
export function PasswordInput({ className = '', ...inputProps }) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative flex">
      <input {...inputProps} type={visible ? 'text' : 'password'} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-1 flex w-10 cursor-pointer items-center justify-center border-none bg-transparent text-muted hover:text-slate-200"
      >
        {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </span>
  )
}

export function AuthError({ message }) {
  if (!message) return null
  return (
    <p role="alert" className="m-0 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
      {message}
    </p>
  )
}

export function AuthSubmit({ children, disabled }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-1 cursor-pointer rounded-xl border-none bg-accent py-3 text-[15px] font-bold text-night disabled:cursor-default disabled:opacity-60"
    >
      {children}
    </button>
  )
}
