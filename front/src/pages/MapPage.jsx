import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import KakaoMap from '../components/KakaoMap'
import ReportModal from '../components/ReportModal'
import { reportApi } from '../api/reportApi'
import { colors } from '../styles/colors'

// 메인 지도 화면 (필수 MVP). 제보 마커 표시 + 지도 클릭으로 제보 등록까지 연결됨.
// 최단/안심 경로 듀얼 렌더링은 1번 담당자(지도&경로) 작업과 함께 다음 단계에서 추가 예정.
export default function MapPage() {
  const [reports, setReports] = useState([])
  const [reportMode, setReportMode] = useState(false)
  const [pendingLocation, setPendingLocation] = useState(null)

  const loadReports = useCallback(async () => {
    try {
      const { data } = await reportApi.findAll()
      setReports(data)
    } catch (err) {
      console.error('[MapPage] 제보 목록 조회 실패', err)
    }
  }, [])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const handleMapClick = (latlng) => {
    if (!reportMode) return
    setPendingLocation(latlng)
    setReportMode(false)
  }

  const handleSubmitted = () => {
    setPendingLocation(null)
    loadReports()
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <KakaoMap markers={reports} onMapClick={reportMode ? handleMapClick : undefined} />

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          gap: 8,
          zIndex: 10,
        }}
      >
        <Link
          to="/route-search"
          style={{
            flex: 1,
            background: colors.white,
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            color: colors.navy,
            textDecoration: 'none',
          }}
        >
          출발지 · 도착지 검색
        </Link>
      </div>

      {reportMode && (
        <div
          style={{
            position: 'absolute',
            top: 64,
            left: 12,
            right: 12,
            background: colors.navy,
            color: colors.white,
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          제보할 위치를 지도에서 클릭하세요
        </div>
      )}

      <button
        type="button"
        onClick={() => setReportMode((v) => !v)}
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          background: reportMode ? colors.red : colors.amber,
          color: reportMode ? colors.white : colors.navy,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          cursor: 'pointer',
          zIndex: 10,
        }}
        aria-label="위험구간 제보"
      >
        {reportMode ? '✕' : '⚠️'}
      </button>

      <ReportModal
        location={pendingLocation}
        onClose={() => setPendingLocation(null)}
        onSubmitted={handleSubmitted}
      />
    </div>
  )
}
