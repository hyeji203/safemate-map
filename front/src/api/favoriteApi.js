import { apiClient } from './client'
import { getDeviceId } from '../utils/deviceId'

// 즐겨찾기(자주 가는 장소) CRUD.
export const favoriteApi = {
  create: ({ label, latitude, longitude }) =>
    apiClient.post('/favorites', { deviceId: getDeviceId(), label, latitude, longitude }),
  findMine: () => apiClient.get('/favorites', { params: { deviceId: getDeviceId() } }),
  remove: (id) => apiClient.delete(`/favorites/${id}`, { params: { deviceId: getDeviceId() } }),
}
