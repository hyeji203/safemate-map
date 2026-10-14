import { apiClient } from './client'

// 지도 화면 안전시설 레이어
export const safetyApi = {
  // 지금 보이는 지도 범위 안의 편의점(convenience) / 파출소·지구대(police). 카카오 로컬 API를 백엔드 경유로 호출
  findFacilities: (type, { swLat, swLng, neLat, neLng }, signal) =>
    apiClient.get('/places/facilities', { params: { type, swLat, swLng, neLat, neLng }, signal }),
}
