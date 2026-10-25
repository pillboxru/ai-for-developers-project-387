import { QueryClient } from '@tanstack/react-query'
import { client } from './generated/client.gen.ts'

// Клиент бросает только тело ответа, а повтор решается по статусу: 404 с
// телом не от нашего сервера повторять незачем, 502 без тела — стоит.
// Статус запоминается за брошенной ошибкой; WeakMap не держит её в памяти
const responseStatuses = new WeakMap<object, number>()

client.interceptors.error.use((error, response) => {
  // Ответа нет при сбое сети: fetch бросил TypeError
  if (!response) {
    return error
  }
  // Тело не в JSON клиент бросает строкой, а ключ WeakMap — только объект
  const thrown =
    typeof error === 'object' && error !== null ? error : new Error(`${error}`)
  responseStatuses.set(thrown, response.status)
  return thrown
})

// Повторять стоит сбой, который может пройти сам: сеть или ошибку сервера
function isTransientError(error: unknown) {
  const status =
    typeof error === 'object' && error !== null
      ? responseStatuses.get(error)
      : undefined
  return status === undefined || status >= 500
}

// Клиент приложения. Тесты берут его только для проверки этой политики,
// остальным тестам нужен клиент без повторов (test/renderApp.tsx)
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          failureCount < 1 && isTransientError(error),
        // Данные меняет только тот, кто на них смотрит, и экран перечитывает
        // их сам после действия: лишние запросы по фокусу и сети не нужны
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      // Повтор действия мог бы создать бронирование или тип второй раз
      mutations: { retry: false },
    },
  })
}
