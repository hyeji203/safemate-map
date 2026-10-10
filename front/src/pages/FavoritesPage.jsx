import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Star } from 'lucide-react'
import { favoriteApi } from '../api/favoriteApi'

// 즐겨찾기(자주 가는 장소) 조회/삭제. 등록은 지도 화면의 장소 정보 카드(PlaceSheet)에서 한다.
// 로그인 없이 브라우저 deviceId로 "내 것"을 구분한다.
export default function FavoritesPage() {
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const loadFavorites = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await favoriteApi.findMine()
      setFavorites(data)
    } catch (err) {
      console.error('[FavoritesPage] 조회 실패', err)
      setError('즐겨찾기를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  const handleDelete = async (favorite) => {
    if (!window.confirm(`'${favorite.label}' 즐겨찾기를 삭제할까요?`)) return
    setDeletingId(favorite.id)
    try {
      await favoriteApi.remove(favorite.id)
      setFavorites((prev) => prev.filter((f) => f.id !== favorite.id))
    } catch (err) {
      console.error('[FavoritesPage] 삭제 실패', err)
      window.alert('즐겨찾기를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setDeletingId(null)
    }
  }

  // 항목을 누르면 지도 화면에서 그 장소를 도착지로 정한다 (출발지는 지도에서 검색해 정하면 바로 경로가 나온다)
  // address는 경로 계산 때 서버가 출입구 쪽 도로를 고르는 데 쓴다 (없으면 좌표만으로 계산)
  const startRoute = (favorite) => {
    const { latitude: lat, longitude: lng, label: title, address } = favorite
    navigate('/', { state: { destination: { lat, lng, title, address: address ?? undefined } } })
  }

  return (
    <div className="min-h-full bg-night font-sans text-slate-200">
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-4 pt-5 pb-6">
        <div className="flex items-center justify-between">
          <h1 className="m-0 text-[22px] font-bold text-white">즐겨찾기</h1>
          {!loading && !error && <span className="text-sm text-muted">{favorites.length}곳</span>}
        </div>

        {loading ? (
          <p className="m-0 py-4 text-center text-sm text-muted">불러오는 중...</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="m-0 text-center text-sm text-muted">{error}</p>
            <button
              type="button"
              onClick={loadFavorites}
              className="cursor-pointer rounded-lg border border-solid border-line bg-transparent px-3 py-1.5 text-[13px] text-accent"
            >
              다시 시도
            </button>
          </div>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-4 py-8 text-center">
            <Star size={28} className="text-muted" aria-hidden />
            <p className="m-0 text-sm break-keep text-muted">
              아직 즐겨찾기한 장소가 없어요.
              <br />
              지도에서 장소를 검색한 뒤 ‘즐겨찾기에 추가’를 눌러보세요.
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="cursor-pointer rounded-full border-0 bg-accent px-4 py-2 text-[13px] font-bold text-night"
            >
              지도에서 찾기
            </button>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {favorites.map((favorite) => (
              <FavoriteCard
                key={favorite.id}
                favorite={favorite}
                deleting={deletingId === favorite.id}
                onSelect={() => startRoute(favorite)}
                onDelete={() => handleDelete(favorite)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// 주소가 없으면(예전에 저장했거나 검색 결과에 주소가 없던 장소) 좌표로 대신한다
function formatLocation({ address, latitude, longitude }) {
  if (address) return address
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}

function FavoriteCard({ favorite, deleting, onSelect, onDelete }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-card p-4">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`${favorite.label}을(를) 도착지로 길찾기`}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left font-[inherit] text-inherit"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent" aria-hidden>
          <Star size={20} fill="currentColor" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-white">{favorite.label}</div>
          <div className="mt-0.5 flex gap-1 text-[13px] text-muted">
            <MapPin size={14} className="mt-[3px] shrink-0" aria-hidden />
            <span className="truncate">{formatLocation(favorite)}</span>
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="shrink-0 cursor-pointer rounded-lg border border-solid border-line bg-transparent px-3 py-1.5 text-[13px] text-muted disabled:cursor-default disabled:opacity-60"
      >
        {deleting ? '삭제 중...' : '삭제'}
      </button>
    </li>
  )
}
