const STORAGE_KEY = 'safemate_device_id'

// 로그인 없이 제보자를 구분하기 위한 임시 식별자. 마이페이지 담당자가 정식 사용자 처리를
// 붙이기 전까지, 브라우저별로 하나씩 발급해서 재사용한다.
export function getDeviceId() {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = createUuid()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

// crypto.randomUUID는 localhost나 HTTPS에서만 있다. 휴대폰으로 http://<PC IP>:5173 에 접속하면 없어서
// 앱이 흰 화면으로 멈추므로, 그때는 어디서나 쓸 수 있는 crypto.getRandomValues로 같은 형식(UUID v4)을 만든다.
function createUuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // 버전 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
