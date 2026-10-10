import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

// 새 제보 실시간 수신용 STOMP 클라이언트. 앱 전체에서 NotificationsProvider(hooks/useNotifications)가 한 번만 연결한다.
export function createStompClient(onReportReceived) {
  const client = new Client({
    webSocketFactory: () => new SockJS('/ws-stomp'),
    reconnectDelay: 5000,
    onConnect: () => {
      client.subscribe('/topic/reports', (message) => {
        onReportReceived?.(JSON.parse(message.body))
      })
    },
  })
  return client
}
