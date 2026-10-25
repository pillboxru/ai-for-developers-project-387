import { focusManager, onlineManager } from '@tanstack/react-query'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { renderApp } from '../test/renderApp.tsx'
import { server } from '../test/server.ts'
import {
  handleCreateEventType,
  handleListAdminEventTypes,
} from './generated/msw.gen.ts'
import type { ApiError, EventType } from './generated/types.gen.ts'
import { createQueryClient } from './queryClient.ts'

// Тесты политики повторов: клиент той же фабрикой, что и в приложении
const renderWithAppClient = (path: string) =>
  renderApp(path, { queryClient: createQueryClient() })

const consultation: EventType = {
  id: '7b0c4c3e-8a43-4d5e-9d6a-2f1e0a7f0c11',
  title: 'Консультация',
  durationMinutes: 30,
  slotStepMinutes: 30,
  hidden: false,
  hasBookings: false,
}

const internalError = () =>
  HttpResponse.json<ApiError>(
    { code: 'internal_error', message: 'Внутренняя ошибка сервера' },
    { status: 500 },
  )

// Первый ответ — заданный сбой, дальше — список с одним типом
function failFirstListRequest(failure: () => Response) {
  const requests = { count: 0 }
  server.use(
    handleListAdminEventTypes(() => {
      requests.count += 1
      return requests.count === 1
        ? failure()
        : HttpResponse.json([consultation])
    }),
  )
  return requests
}

const loadErrorText =
  'Не удалось загрузить данные. Проверьте подключение и попробуйте ещё раз.'

// Повтор идёт через секунду (задержка TanStack Query по умолчанию)
const retryTimeout = { timeout: 3000 }

describe('политика повторов QueryClient', () => {
  afterEach(() => {
    focusManager.setFocused(undefined)
    onlineManager.setOnline(true)
  })

  it('чтение повторяется один раз после 5xx и показывает данные', async () => {
    const requests = failFirstListRequest(internalError)
    renderWithAppClient('/admin/event-types')

    expect(
      await screen.findByRole('cell', { name: 'Консультация' }, retryTimeout),
    ).toBeInTheDocument()
    expect(requests.count).toBe(2)
  })

  it('чтение повторяется один раз после сбоя сети', async () => {
    const requests = failFirstListRequest(() => HttpResponse.error())
    renderWithAppClient('/admin/event-types')

    expect(
      await screen.findByRole('cell', { name: 'Консультация' }, retryTimeout),
    ).toBeInTheDocument()
    expect(requests.count).toBe(2)
  })

  it('чтение повторяется один раз после 5xx без тела', async () => {
    // Так отвечает прокси, когда сервер приложения недоступен
    const requests = failFirstListRequest(
      () => new HttpResponse(null, { status: 502 }),
    )
    renderWithAppClient('/admin/event-types')

    expect(
      await screen.findByRole('cell', { name: 'Консультация' }, retryTimeout),
    ).toBeInTheDocument()
    expect(requests.count).toBe(2)
  })

  it('после двух сбоев подряд показывает ошибку загрузки', async () => {
    let requests = 0
    server.use(
      handleListAdminEventTypes(() => {
        requests += 1
        return internalError()
      }),
    )
    renderWithAppClient('/admin/event-types')

    expect(
      await screen.findByText(loadErrorText, {}, retryTimeout),
    ).toBeInTheDocument()
    expect(requests).toBe(2)
  })

  it('на 4xx чтение не повторяется', async () => {
    const requests = failFirstListRequest(() =>
      HttpResponse.json<ApiError>(
        { code: 'not_found', message: 'Не найдено' },
        { status: 404 },
      ),
    )
    renderWithAppClient('/admin/event-types')

    expect(await screen.findByText(loadErrorText)).toBeInTheDocument()
    expect(requests.count).toBe(1)
  })

  it('на 4xx с телом не от нашего сервера чтение не повторяется', async () => {
    const requests = failFirstListRequest(() =>
      HttpResponse.html('<h1>404 Not Found</h1>', { status: 404 }),
    )
    renderWithAppClient('/admin/event-types')

    expect(await screen.findByText(loadErrorText)).toBeInTheDocument()
    expect(requests.count).toBe(1)
  })

  it('не перечитывает данные по фокусу окна и переподключению', async () => {
    let requests = 0
    server.use(
      handleListAdminEventTypes(() => {
        requests += 1
        return HttpResponse.json([consultation])
      }),
    )
    const queryClient = createQueryClient()
    renderApp('/admin/event-types', { queryClient })
    await screen.findByRole('cell', { name: 'Консультация' })

    // Клиент реагирует на фокус и сеть после микрозадачи: act с async ждёт её
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
    })

    expect(queryClient.isFetching()).toBe(0)
    expect(requests).toBe(1)
  })

  it('мутация не повторяется после 5xx', async () => {
    let attempts = 0
    server.use(
      handleListAdminEventTypes({ body: [] }),
      handleCreateEventType(() => {
        attempts += 1
        return internalError()
      }),
    )
    renderWithAppClient('/admin/event-types')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Создать тип события' }),
    )
    const modal = within(
      await screen.findByRole('dialog', { name: 'Новый тип события' }),
    )
    fireEvent.change(modal.getByRole('textbox', { name: 'Название' }), {
      target: { value: 'Консультация' },
    })
    fireEvent.click(modal.getByRole('button', { name: 'Сохранить' }))

    expect(
      await screen.findByText('Не удалось сохранить. Попробуйте ещё раз.'),
    ).toBeInTheDocument()
    expect(attempts).toBe(1)
  })
})
