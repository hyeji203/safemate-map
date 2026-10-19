import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'

// mkcert로 만든 로컬 인증서가 front/.cert에 있으면 https로 연다 (위치 권한은 https에서만 허용됨). 없으면 기존처럼 http
// 인증서 파일(*.pem)은 .gitignore로 커밋되지 않으므로, 인증서를 만든 PC에서만 https가 켜진다
const certFile = '.cert/safemate.com.pem'
const keyFile = '.cert/safemate.com-key.pem'
const https = fs.existsSync(certFile) && fs.existsSync(keyFile)
  ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
  : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // 휴대폰 홈 화면에 앱처럼 설치(PWA): 주소창 없이 전체 화면으로 열린다. 서비스 워커는 빌드(배포)에서만 동작
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '도와줘, 맵!',
        short_name: '도와줘 맵',
        description: '안심 경로와 주변 제보를 보여주는 지도',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F5F6F8',
        theme_color: '#1A2B4C',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 화면 파일만 캐시한다. API·제보 사진·실시간 알림은 항상 서버에서 새로 받아야 하므로 앱 화면(index.html)으로 대신 응답하지 않게 뺀다
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/, /^\/ws-stomp/],
      },
    }),
  ],
  // front/.env가 아니라 저장소 루트(help_map/)의 .env 하나를 읽음
  envDir: '..',
  // 기획 문서 관례상 REACT_APP_ 접두사를 쓰기로 했으므로 Vite 기본(VITE_)에 추가로 허용
  envPrefix: ['VITE_', 'REACT_APP_'],
  // sockjs-client가 Node 전역 변수 global을 참조해서, 브라우저에서 "global is not defined"로 앱이 멈추지 않도록 globalThis로 바꿔 넣는다
  define: { global: 'globalThis' },
  server: {
    port: 5173,
    // hosts 파일의 "127.0.0.1 safemate.com"으로 접속하려면 IPv4에서 받아야 한다 (기본값 localhost는 ::1에만 열릴 수 있음)
    host: '127.0.0.1',
    https,
    // 휴대폰에서 https로 확인할 때 쓰는 터널 주소로 들어오는 접속 허용
    // (ngrok 무료 고정 도메인 xxx.ngrok-free.dev / xxx.ngrok-free.app, cloudflared 임시 터널 xxx.trycloudflare.com)
    // safemate.com은 hosts 파일로 내 PC(127.0.0.1)에 연결한 로컬 개발용 주소
    allowedHosts: ['safemate.com', '.ngrok-free.dev', '.ngrok-free.app', '.trycloudflare.com'],
    // npm run dev 실행 시 브라우저를 메인화면(지도)으로 연다
    open: `${https ? 'https' : 'http'}://safemate.com:5173/`,
    // 개발 모드에서 직접 찍은 횡단보도 CSV(백엔드 리소스)를 지도에 표시하려고 그 폴더만 추가로 읽게 허용
    fs: {
      allow: ['.', '../back/src/main/resources/data'],
    },
    proxy: {
      '/api': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080', // 제보 첨부 사진
      '/ws-stomp': {
        target: 'http://localhost:8080',
        ws: true,
      },
    },
  },
  // npm run build 후 preview로 띄워 휴대폰에서 앱 설치를 확인할 때도 같은 포트로. 터널 주소 허용·API 프록시는 위 server 설정을 그대로 이어받는다
  preview: {
    port: 5173,
  },
})
