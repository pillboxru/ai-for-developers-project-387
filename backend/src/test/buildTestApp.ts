import { buildApp, type AppOptions } from '../app.js'

// Понедельник, 09:00 по Москве: от этой точки тесты считают окно записи
export const testNow = new Date('2026-11-02T06:00:00Z')

export const testOwner = {
  name: 'Анна Смирнова',
  timeZone: 'Europe/Moscow',
}

// Тесты маршрутов задают время и пояс явно и всегда проверяют ответы по
// контракту; в опциях передают только то, чем тест отличается
export function buildTestApp(options: Partial<AppOptions> = {}) {
  return buildApp({
    now: () => testNow,
    ownerName: testOwner.name,
    ownerTimeZone: testOwner.timeZone,
    validateResponses: true,
    ...options,
  })
}
