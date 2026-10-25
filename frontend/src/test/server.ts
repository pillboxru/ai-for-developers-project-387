import { setupServer } from 'msw/node'

// Общий сервер MSW для всех тестов. Хендлеры тест добавляет сам через
// server.use() сгенерированными фабриками из api/generated/msw.gen.ts,
// после теста они сбрасываются (setupTests.ts)
export const server = setupServer()
