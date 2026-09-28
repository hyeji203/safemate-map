import { useEffect, useState } from 'react'
import { colors } from '../styles/colors'
import { reportApi } from '../api/reportApi'
import { favoriteApi } from '../api/favoriteApi'
import { categoryLabel, categoryIcon } from '../constants/reportCategories'

// 마이페이지 (필수 MVP). 로그인 없이 브라우저 deviceId로 "내 것"을 구분한다.
// - 내가 등록한 제보 목록
// - 즐겨찾기(자주 가는 장소) 등록/조회/삭제 — 독립 탭이 아닌 마이페이지 하위 기능
export default function MyPage() {
  const [myReports, setMyReports] = useState([])
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)

  const [label, setLabel] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [reportsRes, favoritesRes] = await Promise.all([reportApi.findMine(), favoriteApi.findMine()])
      setMyReports(reportsRes.data)
      setFavorites(favoritesRes.data)
    } catch (err) {
      console.error('[MyPage] 조회 실패', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleAddFavorite = async (e) => {
    e.preventDefault()
    const lat = Number(latitude)
    const lng = Number(longitude)
    if (!label.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
      setFormError('이름과 좌표(숫자)를 모두 입력해주세요.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await favoriteApi.create({ label: label.trim(), latitude: lat, longitude: lng })
      setLabel('')
      setLatitude('')
      setLongitude('')
      loadAll()
    } catch (err) {
      setFormError('즐겨찾기 등록에 실패했습니다.')
      console.error('[MyPage]', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteFavorite = async (id) => {
    if (!window.confirm('이 즐겨찾기를 삭제할까요?')) return
    try {
      await favoriteApi.remove(id)
      loadAll()
    } catch (err) {
      console.error('[MyPage] 즐겨찾기 삭제 실패', err)
    }
  }

  if (loading) {
    return <p style={{ padding: 16, color: colors.gray }}>불러오는 중...</p>
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <section>
        <h2 style={{ color: colors.navy, margin: '0 0 12px' }}>내 제보 ({myReports.length})</h2>
        {myReports.length === 0 ? (
          <p style={{ color: colors.gray, fontSize: 14 }}>아직 등록한 제보가 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myReports.map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: colors.white,
                  borderRadius: 8,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                }}
              >
                <span style={{ fontSize: 18 }}>{categoryIcon(r.category)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: colors.navy, fontSize: 14, fontWeight: 700 }}>{categoryLabel(r.category)}</div>
                  <div style={{ color: colors.gray, fontSize: 12 }}>
                    {new Date(r.createdAt).toLocaleString('ko-KR')}
                  </div>
                </div>
                {r.imageUrl && (
                  <img
                    src={r.imageUrl}
                    alt="제보 사진"
                    style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ color: colors.navy, margin: '0 0 12px' }}>즐겨찾기 ({favorites.length})</h2>

        <form
          onSubmit={handleAddFavorite}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 12,
            background: colors.white,
            borderRadius: 8,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            marginBottom: 12,
          }}
        >
          <input
            placeholder="이름 (예: 집, 학교)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="위도"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              placeholder="경도"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          {formError && <p style={{ color: colors.red, fontSize: 13, margin: 0 }}>{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: 10,
              borderRadius: 8,
              border: 'none',
              background: colors.navy,
              color: colors.white,
              fontWeight: 700,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? '등록 중...' : '즐겨찾기 추가'}
          </button>
        </form>

        {favorites.length === 0 ? (
          <p style={{ color: colors.gray, fontSize: 14 }}>등록된 즐겨찾기가 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {favorites.map((f) => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: colors.white,
                  borderRadius: 8,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: colors.navy, fontSize: 14, fontWeight: 700 }}>{f.label}</div>
                  <div style={{ color: colors.gray, fontSize: 12 }}>
                    {f.latitude.toFixed(5)}, {f.longitude.toFixed(5)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteFavorite(f.id)}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: colors.red,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const inputStyle = {
  padding: 10,
  borderRadius: 8,
  border: `1px solid ${colors.gray}`,
}
