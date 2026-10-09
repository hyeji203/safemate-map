import { apiClient } from './client'
import { getDeviceId } from '../utils/deviceId'

// 회원가입/로그인. 로그인 상태는 서버 세션 쿠키로 유지된다.
// deviceId를 같이 보내면 로그인 전 이 브라우저에서 익명으로 남긴 제보·즐겨찾기가 계정으로 옮겨진다.
export const memberApi = {
  signup: ({ email, password, nickname }) =>
    apiClient.post('/members/signup', { email, password, nickname, deviceId: getDeviceId() }),
  login: ({ email, password }) => apiClient.post('/members/login', { email, password, deviceId: getDeviceId() }),
  logout: () => apiClient.post('/members/logout'),
  // 로그인 안 한 상태면 204(본문 없음) -> null
  me: () => apiClient.get('/members/me').then((res) => (res.status === 204 ? null : res.data)),
}
