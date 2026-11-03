// E2E 테스트 설정 (TEST_CASES v1.0 §15, DEC-008)
// - E2E 전용 Backend(8001, smallworking_e2e DB)와 Frontend(5174)를 자동으로 띄운다.
// - 개발 서버(8000/5173)·개발 DB와 겹치지 않는다.
// - 테스트끼리 같은 DB를 쓰므로 한 번에 하나씩(workers: 1) 실행한다.
import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const BACKEND_DIR = path.resolve(import.meta.dirname, '../backend')
const PYTHON =
  process.platform === 'win32'
    ? path.join(BACKEND_DIR, '.venv', 'Scripts', 'python.exe')
    : path.join(BACKEND_DIR, '.venv', 'bin', 'python')

export const E2E_BASE_URL = 'http://localhost:5174'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: E2E_BASE_URL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `"${PYTHON}" -m tests.e2e_server`,
      cwd: BACKEND_DIR,
      url: 'http://127.0.0.1:8001/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --port 5174 --strictPort',
      url: E2E_BASE_URL,
      env: { SW_BACKEND_URL: 'http://127.0.0.1:8001' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
