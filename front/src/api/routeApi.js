import { apiClient } from './client'

// 보행로 그래프 조회 / 경로 탐색 (1단계: 거리 기준 최단경로)
export const routeApi = {
  findNodes: () => apiClient.get('/nodes'),
  findRoute: ({ fromLat, fromLng, toLat, toLng }) =>
    apiClient.get('/routes', { params: { fromLat, fromLng, toLat, toLng } }),
}
