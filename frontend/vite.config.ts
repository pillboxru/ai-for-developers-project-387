/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Node разрешает localhost в ::1, и без явного адреса Vite слушает только
    // IPv6, а браузер, открывший localhost по IPv4, получает отказ
    host: '127.0.0.1',
    // В разработке запросы к API уходят на бекенд. Адрес IPv4, а не
    // localhost: бекенд слушает 0.0.0.0, на ::1 его нет
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    // Пояс процесса отличен от пояса владельца (Europe/Moscow) и не зависит
    // от машины: время гостя и владельца в тестах всегда расходится
    env: { TZ: 'Asia/Vladivostok' },
  },
})
