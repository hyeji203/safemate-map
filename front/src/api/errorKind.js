// axios 오류를 화면 문구를 고르기 쉬운 종류로 나눈다.
// 개발 환경은 Vite 프록시(/api → 8080)를 거쳐서 백엔드가 꺼져도 브라우저엔 500이 오므로 5xx도 'server'로 본다 (MySQL이 꺼져도 500)
// 'server' | 'notFound' | 'badRequest' | 'auth' | 'unknown'
export const getErrorKind = (err) => {
  const status = err?.response?.status
  if (!status || status >= 500) return 'server' // 응답 없음(네트워크 오류·타임아웃) 또는 5xx
  if (status === 404) return 'notFound'
  if (status === 400) return 'badRequest'
  if (status === 401 || status === 403) return 'auth'
  return 'unknown'
}
