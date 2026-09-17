import { apiClient } from './client'

// 위험구간 제보 CRUD. 2단계에서 실제 화면과 연결.
export const reportApi = {
  create: (report) => apiClient.post('/reports', report),
  findAll: () => apiClient.get('/reports'),
}
