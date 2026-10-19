import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// 앱 아이콘(PNG) 생성 설정: npx pwa-assets-generator 로 public/logo.svg에서 다시 만든다
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // 안드로이드가 아이콘을 원/둥근 사각형으로 자를 때 빈 곳이 흰색 대신 로고 배경색(네이비)으로 보이게
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#1A2B4C' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#1A2B4C' } },
  },
  images: ['public/logo.svg'],
})
