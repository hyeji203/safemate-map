import { useState } from 'react'
import { colors } from '../styles/colors'
import { REPORT_CATEGORIES, categoryIcon, categoryLabel } from '../constants/reportCategories'
import { REPORT_PHOTO_STYLE } from '../styles/reportPhoto'

const ALL = 'ALL'

/**
 * "주변 제보" 시트. 지도 하단에서 올라오는 창(장소 정보 카드와 같은 모양)으로 주변 제보를 가까운 순으로 보여준다.
 * 위쪽에 [전체] + 제보 카테고리 버튼을 가로 한 줄로 두고, 카테고리를 고르면 그 카테고리 제보만 위치·사진과 함께 보여준다.
 * - reports: [{ ...ReportResponse, distance }] 가까운 순으로 정렬된 반경 안의 제보
 * - basisLabel: 거리 기준 설명 (예: "현재 위치 기준 1km")
 * - onSelect(report): 제보 하나를 눌렀을 때 (지도에서 그 위치·상세 보기)
 * 열 때마다 [전체]부터 보이도록 호출부에서 열려 있을 때만 렌더링한다.
 */
export default function NearbyReportsSheet({ reports, basisLabel, onClose, onSelect }) {
  const [category, setCategory] = useState(ALL)

  const visible = category === ALL ? reports : reports.filter((r) => r.category === category)
  const countOf = (value) => reports.filter((r) => r.category === value).length

  return (
    <div
      className="sheet-up"
      style={{
        position: 'absolute',
        zIndex: 15, // 하단 경로 안내/제보 버튼보다 위 (PlaceSheet와 같은 층)
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '65%',
        display: 'flex',
        flexDirection: 'column',
        background: colors.white,
        borderRadius: '16px 16px 0 0',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.15)',
        padding: '10px 0 16px',
      }}
    >
      <div style={{ width: 40, height: 4, borderRadius: 2, background: `${colors.gray}66`, margin: '0 auto 14px' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0 20px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: colors.navy }}>주변 제보 {reports.length}건</div>
          <div style={{ fontSize: 13, color: colors.gray, marginTop: 4 }}>{basisLabel} · 가까운 순</div>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" style={closeButtonStyle}>
          ✕
        </button>
      </div>

      {/* 전체 + 카테고리 버튼 한 줄. 화면이 좁으면 옆으로 밀어서 본다 */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '14px 20px 10px', flexShrink: 0 }}>
        <CategoryChip label={`전체 ${reports.length}`} active={category === ALL} onClick={() => setCategory(ALL)} />
        {REPORT_CATEGORIES.map((c) => (
          <CategoryChip
            key={c.value}
            label={`${c.icon} ${c.label} ${countOf(c.value)}`}
            active={category === c.value}
            onClick={() => setCategory(c.value)}
          />
        ))}
      </div>

      <div style={{ overflowY: 'auto', padding: '0 20px' }}>
        {visible.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 14, color: colors.gray }}>
            {category === ALL ? '주변에 등록된 제보가 없어요.' : `주변에 ${categoryLabel(category)} 제보가 없어요.`}
          </div>
        ) : (
          visible.map((report) => (
            <ReportRow key={report.id} report={report} showPhoto={category !== ALL} onClick={() => onSelect(report)} />
          ))
        )}
      </div>
    </div>
  )
}

function CategoryChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flexShrink: 0,
        padding: '7px 12px',
        borderRadius: 100,
        border: `1px solid ${active ? colors.navy : `${colors.gray}66`}`,
        background: active ? colors.navy : colors.white,
        color: active ? colors.white : colors.navy,
        fontSize: 13,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

// 제보 한 건: 카테고리·거리·위치(주소, 없으면 좌표). 카테고리를 골랐을 때는 사진이 있으면 사진도 보여준다
function ReportRow({ report, showPhoto, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '12px 0',
        border: 'none',
        borderBottom: `1px solid ${colors.background}`,
        background: 'none',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }} aria-hidden>
          {categoryIcon(report.category)}
        </span>
        <strong style={{ flex: 1, minWidth: 0, fontSize: 15, color: colors.navy }}>{categoryLabel(report.category)}</strong>
        <span style={{ flexShrink: 0, fontSize: 17, fontWeight: 800, color: colors.red }}>{formatDistance(report.distance)}</span>
      </div>
      <div style={{ marginTop: 4, paddingLeft: 26, fontSize: 13, color: colors.gray }}>
        📍 {report.address ?? `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`}
      </div>
      <div style={{ marginTop: 2, paddingLeft: 26, fontSize: 12, color: colors.gray }}>
        {new Date(report.createdAt).toLocaleString('ko-KR')} 등록
      </div>
      {showPhoto && report.imageUrl && (
        <img
          src={report.imageUrl}
          alt={`${categoryLabel(report.category)} 제보 사진`}
          style={{ ...REPORT_PHOTO_STYLE, marginTop: 8 }} // 제보를 눌렀을 때 카드의 사진과 같은 크기
        />
      )}
    </button>
  )
}

const formatDistance = (meters) => (meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`)

const closeButtonStyle = {
  width: 36,
  height: 36,
  flexShrink: 0,
  borderRadius: '50%',
  border: 'none',
  background: colors.background,
  color: colors.navy,
  fontSize: 16,
  cursor: 'pointer',
}
