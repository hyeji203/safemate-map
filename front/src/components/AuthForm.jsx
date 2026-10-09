// 로그인·회원가입 화면 공통 틀 (마이페이지와 같은 다크 테마)
export function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-full bg-night font-sans text-slate-200">
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-6 px-4 pt-10 pb-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/logo.svg" alt="도와줘, 맵!" width={64} height={64} />
          <h1 className="m-0 text-[22px] font-bold text-white">{title}</h1>
          {subtitle && <p className="m-0 text-sm break-keep text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

export function AuthField({ label, ...inputProps }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] text-muted">
      {label}
      <input
        {...inputProps}
        className="rounded-xl border border-solid border-line bg-card px-3.5 py-3 text-[15px] text-white outline-none placeholder:text-muted/60 focus:border-accent"
      />
    </label>
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
