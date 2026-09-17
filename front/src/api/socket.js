import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

// 고도화 1단계(실시간 반영)에서 사용할 STOMP 클라이언트.
// MVP 단계에서는 연결하지 않고, 준비만 해둔 상태.
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
