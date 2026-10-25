import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import {
  handleCreateEventType,
  handleGetOwner,
  handleGetSchedule,
  handleListAdminEventTypes,
  handleListBookings,
} from '../api/generated/msw.gen.ts'
import type { ApiError, EventType } from '../api/generated/types.gen.ts'
import { renderApp } from '../test/renderApp.tsx'
import { server } from '../test/server.ts'

// Общие состояния экранов проверяются на списке типов событий владельца:
// это первый экран с данными, остальные пользуются теми же компонентами

function eventType(title: string): EventType {
  return {
    id: crypto.randomUUID(),
    title,
    durationMinutes: 30,
    slotStepMinutes: 30,
    hidden: false,
    hasBookings: false,
  }
}

// Ответ, который приходит, только когда тест его отпустит
function gate() {
  let release = () => {}
  const opened = new Promise<void>((resolve) => {
    release = resolve
  })
  return { opened, release }
}

describe('общие состояния экранов', () => {
  it('пока данные грузятся, по центру страницы Loader, шапка на месте', async () => {
    const response = gate()
    server.use(
      handleListAdminEventTypes(async () => {
        await response.opened
        return HttpResponse.json([eventType('Консультация')])
      }),
    )
    renderApp('/admin/event-types')

    expect(
      within(screen.getByRole('main')).getByRole('status', {
        name: 'Загрузка',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()

    response.release()
    expect(
      await screen.findByRole('cell', { name: 'Консультация' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Загрузка' })).toBeNull()
  })

  it('при перезагрузке старые данные остаются до прихода новых', async () => {
    const stored = [eventType('Консультация')]
    const reload = gate()
    let requests = 0
    server.use(
      handleListAdminEventTypes(async () => {
        requests += 1
        if (requests > 1) {
          await reload.opened
        }
        return HttpResponse.json(stored)
      }),
      handleCreateEventType(async ({ request }) => {
        const created = { ...eventType(''), ...(await request.json()) }
        stored.push(created)
        return HttpResponse.json(created, { status: 201 })
      }),
    )
    renderApp('/admin/event-types')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Создать тип события' }),
    )
    const modal = within(
      await screen.findByRole('dialog', { name: 'Новый тип события' }),
    )
    fireEvent.change(modal.getByRole('textbox', { name: 'Название' }), {
      target: { value: 'Разбор' },
    })
    fireEvent.click(modal.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(requests).toBe(2))
    expect(screen.getByRole('cell', { name: 'Консультация' })).toBeVisible()
    expect(screen.queryByRole('status', { name: 'Загрузка' })).toBeNull()

    reload.release()
    expect(await screen.findByRole('cell', { name: 'Разбор' })).toBeVisible()
  })

  it('ошибка загрузки показывает Alert, «Повторить» загружает снова', async () => {
    let requests = 0
    server.use(
      handleListAdminEventTypes(() => {
        requests += 1
        return requests === 1
          ? HttpResponse.json<ApiError>(
              { code: 'internal_error', message: 'Внутренняя ошибка сервера' },
              { status: 500 },
            )
          : HttpResponse.json([eventType('Консультация')])
      }),
    )
    renderApp('/admin/event-types')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Не удалось загрузить данные. Проверьте подключение и попробуйте ещё раз.',
    )
    fireEvent.click(within(alert).getByRole('button', { name: 'Повторить' }))

    expect(
      await screen.findByRole('cell', { name: 'Консультация' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('сбой рендера заменяет страницу, шапка остаётся', async () => {
    // Ответ не по контракту: страница падает при рендере списка. React
    // пишет пойманную ошибку в консоль, в выводе тестов она не нужна
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(
      handleListAdminEventTypes(() => HttpResponse.json({})),
      // Данные раздела «Расписание», куда тест переходит после сбоя
      handleGetOwner({
        body: { name: 'Анна Смирнова', timeZone: 'Europe/Moscow' },
      }),
      handleListBookings({ body: [] }),
      handleGetSchedule({
        body: {
          weekly: {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: [],
          },
          overrides: [],
          bookingWindow: {
            start: '2026-11-01T21:00:00Z',
            end: '2026-11-15T21:00:00Z',
          },
        },
      }),
    )
    renderApp('/admin/event-types')

    expect(
      await screen.findByRole('heading', { name: 'Что-то пошло не так' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Обновить страницу' }),
    ).toBeInTheDocument()

    const header = within(screen.getByRole('banner'))
    fireEvent.click(header.getByRole('tab', { name: 'Расписание' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Расписание' }),
    ).toBeInTheDocument()
    consoleError.mockRestore()
  })
})
