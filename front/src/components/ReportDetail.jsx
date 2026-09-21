import { useState } from 'react'
import { colors } from '../styles/colors'
import { categoryLabel } from '../constants/reportCategories'
import { reportApi } from '../api/reportApi'

/**
 * 제보 마커 클릭 시 뜨는 상세 정보 (카테고리, 사진, 등록 시각) + 삭제 + 같은 위치에 추가 제보.
 * 삭제는 본인이 등록한 제보만 가능 (서버에서 deviceId로 확인).
 */
export default function ReportDetail({ report, onClose, onDeleted, onAddReport }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  if (!report) return null

  const createdAt = new Date(report.createdAt).toLocaleString('ko-KR')

  const handleDelete = async () => {
    if (!window.confirm('해당 제보를 삭제할까요? 되돌릴 수 없습니다.')) return
    setDeleting(true)
    setError(null)
    try {
      await reportApi.remove(report.id)
      onDeleted?.()
    } catch (err) {
      if (err.response?.status === 403) {
        setError('본인이 등록한 제보만 삭제할 수 있습니다.')
      } else {
        setError('삭제에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
      console.error('[ReportDetail]', err)
    } finally {
      setDeleting(false)
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors.red, flex: 'none' }} />
          <h2 style={{ margin: 0, color: colors.navy, flex: 1 }}>{categoryLabel(report.category)}</h2>
          <button
            type="button"
            onClick={() => onAddReport?.({ lat: report.latitude, lng: report.longitude })}
            title="이 위치에 다른 문제도 있다면 추가로 제보할 수 있어요"
            style={{
              flex: 'none',
              fontSize: 12.5,
              fontWeight: 700,
              padding: '6px 10px',
              borderRadius: 100,
              border: `1px solid ${colors.amber}`,
              background: '#FFF7E8',
              color: colors.amber,
              cursor: 'pointer',
            }}
          >
            + 추가 제보
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.gray }}>{createdAt} 등록</p>

        {report.imageUrl && (
          <img
            src={report.imageUrl}
            alt="제보 사진"
            style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }}
          />
        )}

        {error && <p style={{ color: colors.red, fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${colors.gray}`,
              background: colors.white,
            }}
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              border: 'none',
              background: colors.red,
              color: colors.white,
              fontWeight: 700,
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? '삭제 중...' : '해당 제보 삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}
