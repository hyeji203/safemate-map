import { useNavigate } from 'react-router-dom'
import { colors } from '../styles/colors'

// 경로 탐색 화면 (필수 MVP). 출발지/도착지 입력 -> 카카오 주소 검색(백엔드 REST API) 연동은 1~2단계에서 추가.
export default function RouteSearchPage() {
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    // TODO: 출발지/도착지 좌표 확정 -> 백엔드 경로 계산 API 호출 -> 결과를 RouteDetailPage로 전달
    navigate('/route-detail')
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ color: colors.navy }}>경로 탐색</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input placeholder="출발지" style={inputStyle} />
        <input placeholder="도착지" style={inputStyle} />
        <button type="submit" style={buttonStyle}>
          안심 경로 찾기
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
