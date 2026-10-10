import { useCallback, useState } from 'react'

// 길찾기 검색 기록 (이 브라우저에만 저장). 서버로 보내지 않는다.
// 출발/도착은 검색하거나 지도에서 고른 장소만 들어온다. 현재 위치는 저장하지 않는다는 팀 결정을 지키려고,
// 현재 위치를 출발지로 쓰는 기능이 생기면 그 경로는 기록하지 말 것.
const STORAGE_KEY = 'safemate_route_history'
const MAX_ITEMS = 10

function load() {
  try {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

function save(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // 저장이 막혀 있으면(사생활 보호 모드 등) 이번 화면에서만 기록이 남는다
  }
}

// 장소 하나에서 다시 길찾기에 필요한 값만 남긴다
const pick = (p) => ({ lat: p.lat, lng: p.lng, title: p.title, address: p.address })

const keyOf = (item) => `${item.start.lat},${item.start.lng}|${item.end.lat},${item.end.lng}`

/** 최근 길찾기 기록: [{ start, end, at }] (최신순) + 추가/삭제 함수 */
export function useRouteHistory() {
  const [items, setItems] = useState(load)

  const update = useCallback((fn) => {
    setItems((prev) => {
      const next = fn(prev)
      save(next)
      return next
    })
  }, [])

  // 같은 출발→도착을 다시 찾으면 맨 위로 올린다
  const add = useCallback(
    (start, end) => {
      const item = { start: pick(start), end: pick(end), at: Date.now() }
      update((prev) => [item, ...prev.filter((x) => keyOf(x) !== keyOf(item))].slice(0, MAX_ITEMS))
    },
    [update],
  )

  const remove = useCallback((item) => update((prev) => prev.filter((x) => keyOf(x) !== keyOf(item))), [update])

  const clear = useCallback(() => update(() => []), [update])

  return { items, add, remove, clear }
}
