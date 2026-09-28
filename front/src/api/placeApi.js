import { apiClient } from './client'

// 지도 화면의 장소·주소 검색 (카카오 로컬 API를 백엔드 경유로 호출)
export const placeApi = {
  search: (query) => apiClient.get('/places/search', { params: { query } }),
  // 지도에서 누른 좌표의 장소 이름·주소 (찾을 수 없는 곳이면 204, data 없음)
  findAt: (lat, lng) => apiClient.get('/places/at', { params: { lat, lng } }),
}
