import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

// 제보 등록/삭제 실시간 수신용 STOMP 클라이언트. 앱 전체에서 NotificationsProvider(hooks/useNotifications)가 한 번만 연결한다.
// - /topic/reports          새 제보 (ReportResponse)
// - /topic/reports/deleted  삭제된 제보 ({ id })
export function createStompClient(onReportReceived, onReportDeleted) {
  const client = new Client({
    webSocketFactory: () => new SockJS('/ws-stomp'),
    reconnectDelay: 5000,
    onConnect: () => {
      client.subscribe('/topic/reports', (message) => {
        onReportReceived?.(JSON.parse(message.body))
      })
      client.subscribe('/topic/reports/deleted', (message) => {
        onReportDeleted?.(JSON.parse(message.body).id)
      })
    },
  })
  return client
}
