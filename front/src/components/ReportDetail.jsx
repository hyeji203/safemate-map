import { useState } from 'react'
import { colors } from '../styles/colors'
import { categoryLabel } from '../constants/reportCategories'
import { reportApi } from '../api/reportApi'

/**
 * 제보 마커 클릭 시 뜨는 상세 정보. 같은 위치에 여러 건이 쌓여있으면 전부 목록으로 보여준다
 * (마커가 좌표 하나에 완전히 겹치기 때문에, 최신 것만 보이지 않도록 여기서 다 모아 보여줌).
 * 삭제는 본인이 등록한 제보만 가능 (서버에서 deviceId로 확인).
 */
export default function ReportDetail({ reports, onClose, onDeleted, onAddReport }) {
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState(null)

  if (!reports || reports.length === 0) return null

  const location = { lat: reports[0].latitude, lng: reports[0].longitude }

  const handleDelete = async (id) => {
    if (!window.confirm('해당 제보를 삭제할까요? 되돌릴 수 없습니다.')) return
    setDeletingId(id)
    setError(null)
    try {
      await reportApi.remove(id)
      onDeleted?.(id)
    } catch (err) {
      if (err.response?.status === 403) {
        setError('본인이 등록한 제보만 삭제할 수 있습니다.')
      } else {
        setError('삭제에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
      console.error('[ReportDetail]', err)
    } finally {
      setDeletingId(null)
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
          maxHeight: '75vh',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <h2 style={{ margin: 0, color: colors.navy, flex: 1 }}>
            이 위치의 제보 {reports.length > 1 ? `(${reports.length}건)` : ''}
          </h2>
          <button
            type="button"
            onClick={() => onAddReport?.(location)}
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

        {error && <p style={{ color: colors.red, fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', marginBottom: 16 }}>
          {reports.map((report, i) => (
            <div
              key={report.id}
              style={{
                paddingBottom: 16,
                borderBottom: i < reports.length - 1 ? `1px solid ${colors.background}` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors.red, flex: 'none' }} />
                <strong style={{ color: colors.navy, flex: 1 }}>{categoryLabel(report.category)}</strong>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: colors.gray }}>
                {new Date(report.createdAt).toLocaleString('ko-KR')} 등록
              </p>

              {report.imageUrl && (
                <img
                  src={report.imageUrl}
                  alt="제보 사진"
                  style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                />
              )}

              <button
                type="button"
                onClick={() => handleDelete(report.id)}
                disabled={deletingId === report.id}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: colors.red,
                  color: colors.white,
                  fontWeight: 700,
                  fontSize: 13,
                  opacity: deletingId === report.id ? 0.6 : 1,
                }}
              >
                {deletingId === report.id ? '삭제 중...' : '해당 제보 삭제'}
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 'none',
            padding: 12,
            borderRadius: 8,
            border: `1px solid ${colors.gray}`,
            background: colors.white,
          }}
        >
          닫기
        </button>
      </div>
    </div>
  )
}
