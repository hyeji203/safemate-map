import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // front/.env가 아니라 저장소 루트(help_map/)의 .env 하나를 읽음
  envDir: '..',
  // 기획 문서 관례상 REACT_APP_ 접두사를 쓰기로 했으므로 Vite 기본(VITE_)에 추가로 허용
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws-stomp': {
        target: 'http://localhost:8080',
        ws: true,
      },
    },
  },
})
