import { Link } from 'react-router-dom'
import KakaoMap from '../components/KakaoMap'
import { colors } from '../styles/colors'

// 메인 지도 화면 (필수 MVP). 2단계에서 제보 마커 + 최단/안심 경로 듀얼 렌더링 추가 예정.
export default function MapPage() {
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <KakaoMap />

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          gap: 8,
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

      <Link
        to="/report"
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: colors.amber,
          color: colors.navy,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
        aria-label="위험구간 제보"
      >
        ⚠️
      </Link>
    </div>
  )
}
