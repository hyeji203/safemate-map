import { useState } from 'react'
import { colors } from '../styles/colors'
import { reportApi } from '../api/reportApi'
import { REPORT_CATEGORIES as CATEGORIES } from '../constants/reportCategories'

/**
 * 지도 클릭으로 좌표를 받은 뒤 뜨는 제보 등록 모달.
 * location: { lat, lng } — 필수. 이게 없으면 모달을 열지 않는다.
 */
export default function ReportModal({ location, onClose, onSubmitted }) {
  const [category, setCategory] = useState(CATEGORIES[0].value)
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (!location) return null

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] ?? null
    setImage(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await reportApi.create({
        latitude: location.lat,
        longitude: location.lng,
        category,
        image,
      })
      onSubmitted?.()
    } catch (err) {
      setError('제보 등록에 실패했습니다. 잠시 후 다시 시도해주세요.')
      console.error('[ReportModal]', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.white,
          borderRadius: '16px 16px 0 0',
          padding: 20,
          width: '100%',
          maxWidth: 480,
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 4px', color: colors.navy }}>위험구간 제보</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.gray }}>
          선택 위치: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          </div>

          <label style={{ fontSize: 14, color: colors.navy }}>
            사진 첨부 (선택)
            <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'block', marginTop: 6 }} />
          </label>
          {preview && (
            <img src={preview} alt="첨부 미리보기" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8 }} />
          )}

          {error && <p style={{ color: colors.red, fontSize: 13, margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${colors.gray}`, background: colors.white }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: 2,
                padding: 12,
                borderRadius: 8,
                border: 'none',
                background: colors.red,
                color: colors.white,
                fontWeight: 700,
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? '등록 중...' : '제보 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
