import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportApi } from '../api/reportApi'
import { colors } from '../styles/colors'

const CATEGORIES = [
  { value: 'STREETLIGHT_BROKEN', label: '가로등 고장' },
  { value: 'DARK_ALLEY', label: '어두움' },
  { value: 'EMPTY_STREET', label: '인적 드묾' },
]

// 위험구간 제보 화면 (필수 MVP). 지도 클릭으로 좌표를 받는 기능은 2단계에서 MapPage와 연결.
export default function ReportPage() {
  const [category, setCategory] = useState(CATEGORIES[0].value)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    // TODO(2단계): 지도에서 클릭한 실제 좌표 + 로그인한 회원 id로 교체
    await reportApi.create({
      reporterId: 1,
      latitude: 37.5665,
      longitude: 126.978,
      category,
    })
    navigate('/')
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ color: colors.navy }}>위험구간 제보</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: colors.gray, fontSize: 14 }}>
          지도에서 위치를 선택하는 기능은 다음 단계에서 연결됩니다. 지금은 카테고리 선택만 확인합니다.
        </p>
        {CATEGORIES.map((c) => (
          <label key={c.value} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="category"
              value={c.value}
              checked={category === c.value}
              onChange={(e) => setCategory(e.target.value)}
            />
            {c.label}
          </label>
        ))}
        <button
          type="submit"
          style={{
            padding: 12,
            borderRadius: 8,
            border: 'none',
            background: colors.red,
            color: colors.white,
            fontWeight: 700,
          }}
        >
          제보 등록
        </button>
      </form>
    </div>
  )
}
