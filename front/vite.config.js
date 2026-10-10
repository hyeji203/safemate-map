import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // front/.env가 아니라 저장소 루트(help_map/)의 .env 하나를 읽음
  envDir: '..',
  // 기획 문서 관례상 REACT_APP_ 접두사를 쓰기로 했으므로 Vite 기본(VITE_)에 추가로 허용
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    port: 5173,
    // npm run dev 실행 시 브라우저를 메인화면(지도)으로 연다
    open: '/',
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
})
