import { apiClient } from './client'

// 보행로 그래프 조회 / 경로 탐색 (findRoute는 { shortest, safe } 두 경로를 함께 반환)
// fromAddress/toAddress: 장소 주소(선택). 도로명주소면 서버가 출입구가 면한 도로(큰 길/골목)를 고르는 데 쓴다
export const routeApi = {
  findNodes: () => apiClient.get('/nodes'),
  findStreetLights: () => apiClient.get('/street-lights'),
  // signal: AbortController.signal (선택). 출발/도착이 바뀌면 이전 요청을 취소하는 데 쓴다
  findRoute: ({ fromLat, fromLng, toLat, toLng, fromAddress, toAddress }, signal) =>
    apiClient.get('/routes', { params: { fromLat, fromLng, toLat, toLng, fromAddress, toAddress }, signal }),
}
