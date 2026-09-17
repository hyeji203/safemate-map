import { colors } from '../styles/colors'

// 로그인/회원가입 화면 (필수 MVP). 실제 인증 연동은 백엔드 Member API와 함께 다음 단계에서 구현.
export default function LoginPage() {
  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ color: colors.navy }}>로그인</h2>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="email" placeholder="이메일" style={inputStyle} />
        <input type="password" placeholder="비밀번호" style={inputStyle} />
        <button type="submit" style={buttonStyle}>
          로그인
        </button>
      </form>
    </div>
  )
}

const inputStyle = {
  padding: 12,
  borderRadius: 8,
  border: `1px solid ${colors.gray}`,
}

const buttonStyle = {
  padding: 12,
  borderRadius: 8,
  border: 'none',
  background: colors.navy,
  color: colors.white,
  fontWeight: 700,
}
