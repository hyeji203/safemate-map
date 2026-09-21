import { apiClient } from './client'

// 보행로 그래프 조회 / 경로 탐색 (findRoute는 { shortest, safe } 두 경로를 함께 반환)
export const routeApi = {
  findNodes: () => apiClient.get('/nodes'),
  findStreetLights: () => apiClient.get('/street-lights'),
  findRoute: ({ fromLat, fromLng, toLat, toLng }) =>
    apiClient.get('/routes', { params: { fromLat, fromLng, toLat, toLng } }),
}
