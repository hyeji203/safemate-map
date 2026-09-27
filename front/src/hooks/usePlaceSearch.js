import { useEffect, useRef, useState } from 'react'
import { placeApi } from '../api/placeApi'

// 입력 후 이 시간(ms) 동안 추가 입력이 없을 때만 검색 요청을 보낸다 (타이핑마다 호출 방지)
const SEARCH_DEBOUNCE_MS = 300

// 장소 검색창 하나의 검색 상태 + 로직. 지도 화면 검색창과 경로 탐색 화면의 출발지/도착지 칸에서 같이 쓴다.
export function usePlaceSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  // 검색 결과에서 고른 장소 { lat, lng, name, address, category, phone, placeUrl, distanceMeters }
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const onQueryChange = (value) => {
    setQuery(value)
    setSelected(null) // 좌표 없는 채로 제출되지 않도록, 글자를 다시 고치면 이전 선택은 취소
    setError(null)
    clearTimeout(timerRef.current)

    if (!value.trim()) {
      setResults([])
      return
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await placeApi.search(value.trim())
        setResults(data)
      } catch {
        setResults([])
        setError('검색 중 문제가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)
  }

  const onSelect = (place) => {
    setSelected({
      lat: place.latitude,
      lng: place.longitude,
      name: place.placeName,
      address: place.addressName,
      category: place.categoryName,
      phone: place.phone,
      placeUrl: place.placeUrl,
      distanceMeters: place.distanceMeters,
    })
    setQuery(place.placeName)
    setResults([])
  }

  const reset = () => {
    clearTimeout(timerRef.current)
    setQuery('')
    setResults([])
    setSelected(null)
    setError(null)
    setLoading(false)
  }

  return { query, results, selected, loading, error, onQueryChange, onSelect, reset }
}
