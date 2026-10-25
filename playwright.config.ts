import { defineConfig, devices } from '@playwright/test'

// Свой порт, чтобы e2e не мешали `make dev` на :3000 и друг другу при
// параллельных прогонах в разных worktree: E2E_PORT=3145 make check
const port = Number(process.env.E2E_PORT ?? 3100)
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  // Сценарии делят один сервер с хранилищем в памяти и не чистят его между
  // собой, поэтому идут по очереди
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL,
    // Пояс браузера отличен от пояса владельца: гость видит время по-своему
    timezoneId: 'Asia/Vladivostok',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Собранное приложение, как в продакшене: Fastify отдаёт /api и статику.
  // Свежий сервер на каждый запуск, поэтому чужой процесс на порту не берём
  webServer: {
    command: 'node backend/dist/server.js',
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    env: {
      PORT: String(port),
      STATIC_DIR: 'frontend/dist',
      OWNER_TIME_ZONE: 'Europe/Moscow',
    },
  },
})
