import '@testing-library/jest-dom/vitest'
import { notifications } from '@mantine/notifications'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, expect } from 'vitest'
import { server } from './test/server.ts'

// Первый тест файла платит за холодный старт: первый рендер Mantine и первый
// запрос через MSW в свежем воркере в несколько раз медленнее следующих, а
// при параллельном прогоне под нагрузкой не укладываются в 1 с по умолчанию.
// findBy ждёт только до появления элемента, поэтому запас зелёные тесты
// не замедляет
configure({ asyncUtilTimeout: 3000 })

// Стратегия 'error' в MSW 3 только пишет в консоль и отклоняет запрос:
// компонент показывает ошибку загрузки, и тест, который её не проверяет,
// проходит. Поэтому запросы без хендлера копятся и валят тест в afterEach
const unhandledRequests: string[] = []

beforeAll(() =>
  server.listen({
    onUnhandledFrame: async ({ frame }) => {
      const message = await frame.getUnhandledMessage()
      unhandledRequests.push(message)
      // Если колбэк не бросит, MSW пропустит запрос в настоящую сеть
      throw new Error(message)
    },
  }),
)

afterEach(() => {
  cleanup()
  server.resetHandlers()
  // Хранилище уведомлений общее на модуль: без очистки уведомление одного
  // теста всплывёт в следующем
  notifications.clean()
  // expect в afterEach относится к тесту, который только что прошёл
  // oxlint-disable-next-line vitest/no-standalone-expect
  expect(unhandledRequests.splice(0)).toEqual([])
})

afterAll(() => server.close())

// jsdom не реализует эти API, а Mantine их использует
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver

// Combobox (Select) прокручивает список к выбранному варианту
window.HTMLElement.prototype.scrollIntoView = () => {}

// Textarea с autosize подписывается на загрузку шрифтов
Object.defineProperty(document, 'fonts', {
  value: {
    addEventListener: () => {},
    removeEventListener: () => {},
  },
})
