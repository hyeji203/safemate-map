import axios from 'axios'

// vite.config.js의 dev proxy 덕분에 baseURL을 /api로 두면 자동으로 8080 백엔드로 전달됨
export const apiClient = axios.create({
  baseURL: import.meta.env.REACT_APP_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})
