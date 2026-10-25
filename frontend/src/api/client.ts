import type { CreateClientConfig } from './generated/client.gen.ts'

// Сгенерированный клиент вызывает эту функцию один раз при создании.
// Абсолютный адрес нужен Request из Node в тестах, относительный он не
// принимает; в браузере это тот же сервер, что отдал страницу
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: location.origin,
})
