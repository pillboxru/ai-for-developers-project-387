import closeWithGrace from 'close-with-grace'
import { buildApp } from './app.js'

const app = buildApp({
  staticDir: process.env.STATIC_DIR,
  logger: true,
  now: () => new Date(),
  ownerName: process.env.OWNER_NAME ?? 'Владелец календаря',
  ownerTimeZone: process.env.OWNER_TIME_ZONE ?? 'Europe/Moscow',
})
const port = Number(process.env.PORT ?? 3000)

// В контейнере node работает как PID 1 и без обработчика игнорирует SIGTERM:
// docker stop ждёт 10 секунд и убивает процесс, обрывая текущие запросы
closeWithGrace(async ({ signal, err }) => {
  if (err) {
    app.log.error({ err }, 'server closing with error')
  } else {
    app.log.info(`${signal} received, server closing`)
  }
  await app.close()
})

try {
  // 0.0.0.0, чтобы сервер был доступен снаружи Docker-контейнера
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
