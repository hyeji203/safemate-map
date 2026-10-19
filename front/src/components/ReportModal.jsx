import { useEffect, useState } from 'react'
import { colors } from '../styles/colors'
import { reportApi } from '../api/reportApi'
import { placeApi } from '../api/placeApi'
import { useNotifications } from '../hooks/useNotifications'
import { REPORT_CATEGORIES as CATEGORIES } from '../constants/reportCategories'

/**
 * 지도 클릭으로 좌표를 받은 뒤 뜨는 제보 등록 모달.
 * location: { lat, lng } — 필수. 이게 없으면 모달을 열지 않는다.
 * 모달은 항상 마운트된 채로 열고 닫히므로(닫힐 때 unmount 안 됨), location이 바뀔 때마다
 * (=새로 열릴 때마다) 폼을 초기화한다 — 안 그러면 이전에 고른 사진/카테고리가 다음 제보에 그대로 남는다.
 */
export default function ReportModal({ location, onClose, onSubmitted }) {
  const [category, setCategory] = useState(CATEGORIES[0].value)
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  // 선택 위치의 주소. undefined = 찾는 중, null = 주소가 없는 곳(또는 조회 실패)
  const [address, setAddress] = useState(undefined)
  const { markMine } = useNotifications()

  useEffect(() => {
    if (!location) return
    setCategory(CATEGORIES[0].value)
    setImage(null)
    setPreview(null)
    setError(null)
    setAddress(undefined)
    // 응답이 오기 전에 모달이 닫히거나 다른 위치로 다시 열리면 이전 응답은 버린다
    let ignore = false
    placeApi
      .findAddress(location.lat, location.lng)
      .then((res) => !ignore && setAddress(res.data?.address ?? null))
      .catch((err) => {
        console.error('[ReportModal] 주소 조회 실패', err)
        if (!ignore) setAddress(null)
      })
    return () => {
      ignore = true
    }
    // location은 열 때마다 새 객체라서 이 effect가 매번 실행됨
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

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
      const { data } = await reportApi.create({
        latitude: location.lat,
        longitude: location.lng,
        category,
        image,
      })
      // 내가 올린 제보는 알림에서 뺀다
      markMine(data.id)
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
          선택 위치: {address === undefined ? '주소 확인 중…' : (address ?? '주소를 찾을 수 없는 위치예요')}
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
