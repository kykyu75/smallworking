import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// 로컬 FastAPI 주소 (DEC-007: 운영과 같은 "같은 도메인" 구조를 프록시로 재현)
// E2E는 SW_BACKEND_URL로 E2E 전용 Backend(8001)를 가리킨다 (playwright.config.ts)
const BACKEND_URL = process.env.SW_BACKEND_URL ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND_URL, changeOrigin: false },
      '/uploads': { target: BACKEND_URL, changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'], // e2e/는 Playwright가 실행한다
  },
})
