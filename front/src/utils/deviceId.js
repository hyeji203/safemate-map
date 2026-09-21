const STORAGE_KEY = 'safemate_device_id'

// 로그인 없이 제보자를 구분하기 위한 임시 식별자. 마이페이지 담당자가 정식 사용자 처리를
// 붙이기 전까지, 브라우저별로 하나씩 발급해서 재사용한다.
export function getDeviceId() {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}
