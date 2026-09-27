import { apiClient } from './client'

// 경로 탐색 화면의 출발지/도착지 주소·장소 검색 (카카오 로컬 API를 백엔드 경유로 호출)
export const placeApi = {
  search: (query) => apiClient.get('/places/search', { params: { query } }),
}
