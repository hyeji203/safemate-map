import { apiClient } from './client'
import { getDeviceId } from '../utils/deviceId'

// 위험구간 제보 CRUD.
export const reportApi = {
  create: ({ latitude, longitude, category, image }) => {
    const formData = new FormData()
    formData.append('deviceId', getDeviceId())
    formData.append('latitude', latitude)
    formData.append('longitude', longitude)
    formData.append('category', category)
    if (image) formData.append('image', image)

    return apiClient.post('/reports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  findAll: () => apiClient.get('/reports'),
  findMine: () => apiClient.get('/reports/mine', { params: { deviceId: getDeviceId() } }),
  remove: (id) => apiClient.delete(`/reports/${id}`, { params: { deviceId: getDeviceId() } }),
}
