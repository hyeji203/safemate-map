import { apiClient } from './client'

// 지도 화면의 장소·주소 검색 (카카오 로컬 API를 백엔드 경유로 호출)
export const placeApi = {
  search: (query) => apiClient.get('/places/search', { params: { query } }),
}
