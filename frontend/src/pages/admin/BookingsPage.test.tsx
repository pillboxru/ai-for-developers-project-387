import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  handleCancelBooking,
  handleGetOwner,
  handleListBookings,
} from '../../api/generated/msw.gen.ts'
import type { ApiError, Booking } from '../../api/generated/types.gen.ts'
import { renderApp } from '../../test/renderApp.tsx'
import { server } from '../../test/server.ts'

// Владелец в Москве, браузер во Владивостоке (+7 ч). Сейчас 19:00 25 октября
// по Москве — у браузера уже 02:00 26 октября: дни считаются по владельцу
const now = new Date('2026-10-25T16:00:00Z')

const consultation = {
  id: '7b0c4c3e-8a43-4d5e-9d6a-2f1e0a7f0c11',
  title: 'Консультация',
  hidden: false,
}

function booking(
  start: string,
  end: string,
  overrides: Partial<Booking> = {},
): Booking {
  return {
    id: crypto.randomUUID(),
    eventType: consultation,
    start,
    end,
    name: 'Иван Петров',
    email: 'ivan@example.com',
    cancelled: false,
    ...overrides,
  }
}

function serveBookings(bookings: Booking[]) {
  server.use(
    handleGetOwner({
      body: { name: 'Анна Смирнова', timeZone: 'Europe/Moscow' },
    }),
    handleListBookings({ body: bookings }),
  )
}

// Заголовки групп и время карточек (заголовок карточки) по порядку
function groups() {
  return screen.getAllByRole('region').map((region) => ({
    day: within(region).getByRole('heading', { level: 2 }).textContent,
    times: within(region)
      .getAllByRole('article')
      .map((card) => within(card).getByRole('heading').textContent),
  }))
}

beforeEach(() => {
  vi.setSystemTime(now)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('предстоящие бронирования владельца', () => {
  it('без бронирований показывает пустое состояние', async () => {
    serveBookings([])
    renderApp('/admin/bookings')

    expect(
      await screen.findByRole('heading', {
        name: 'Предстоящих бронирований нет',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Здесь появятся бронирования гостей.'),
    ).toBeInTheDocument()
  })

  it('группирует по дням владельца: «Сегодня», «Завтра», дальше дата', async () => {
    serveBookings([
      // 20:00–20:30 25 октября по Москве, у браузера уже 26-е
      booking('2026-10-25T17:00:00Z', '2026-10-25T17:30:00Z'),
      // Через полночь: 23:30 26 октября — 00:30 27-го, день начала
      booking('2026-10-26T20:30:00Z', '2026-10-26T21:30:00Z'),
      booking('2026-10-30T07:00:00Z', '2026-10-30T07:30:00Z'),
      booking('2026-10-30T09:00:00Z', '2026-10-30T10:00:00Z'),
    ])
    renderApp('/admin/bookings')

    await screen.findByRole('region', { name: 'Сегодня' })
    expect(groups()).toEqual([
      { day: 'Сегодня', times: ['20:00–20:30'] },
      { day: 'Завтра', times: ['23:30–00:30'] },
      { day: 'пт, 30 октября', times: ['10:00–10:30', '12:00–13:00'] },
    ])
    expect(
      screen.getByText('Время указано по поясу Europe/Moscow'),
    ).toBeInTheDocument()
  })

  it('карточка: тип с пометкой «Скрыт», гость, email ссылкой, комментарий с переносами', async () => {
    serveBookings([
      booking('2026-10-26T07:00:00Z', '2026-10-26T08:00:00Z', {
        eventType: { id: crypto.randomUUID(), title: 'Разбор', hidden: true },
        name: 'Мария Иванова',
        email: 'maria@example.com',
        comment: 'Про сроки\nи бюджет',
      }),
    ])
    renderApp('/admin/bookings')

    const card = within(await screen.findByRole('article'))
    expect(card.getByRole('heading')).toHaveTextContent('10:00–11:00')
    expect(card.getByText('Разбор')).toBeInTheDocument()
    expect(card.getByText('Скрыт')).toBeInTheDocument()
    expect(card.getByText('Мария Иванова')).toBeInTheDocument()
    expect(
      card.getByRole('link', { name: 'maria@example.com' }),
    ).toHaveAttribute('href', 'mailto:maria@example.com')
    const comment = card.getByText('Про сроки и бюджет')
    expect(comment.textContent).toBe('Про сроки\nи бюджет')
    expect(comment).toHaveStyle({ whiteSpace: 'pre-line' })
  })

  it('у видимого типа нет пометки «Скрыт»', async () => {
    serveBookings([booking('2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z')])
    renderApp('/admin/bookings')

    const card = within(await screen.findByRole('article'))
    expect(card.getByText('Консультация')).toBeInTheDocument()
    expect(card.queryByText('Скрыт')).not.toBeInTheDocument()
  })

  it('идущий сейчас звонок помечен «Идёт сейчас», следующий — нет', async () => {
    serveBookings([
      // 18:30–19:30 по Москве, сейчас 19:00
      booking('2026-10-25T15:30:00Z', '2026-10-25T16:30:00Z', {
        name: 'Идущий',
      }),
      // Начинается ровно сейчас: тоже идёт
      booking('2026-10-25T16:00:00Z', '2026-10-25T16:15:00Z', {
        name: 'Только начался',
      }),
      booking('2026-10-25T17:00:00Z', '2026-10-25T17:30:00Z', {
        name: 'Следующий',
      }),
    ])
    renderApp('/admin/bookings')

    const cards = await screen.findAllByRole('article')
    expect(
      cards.map((card) => within(card).queryByText('Идёт сейчас') !== null),
    ).toEqual([true, true, false])
  })

  it('отменённый идущий звонок не помечен «Идёт сейчас»', async () => {
    serveBookings([
      // 18:30–19:30 по Москве, сейчас 19:00
      booking('2026-10-25T15:30:00Z', '2026-10-25T16:30:00Z', {
        cancelled: true,
      }),
    ])
    renderApp('/admin/bookings')

    const card = within(await screen.findByRole('article'))
    expect(card.getByText('Отменено')).toBeInTheDocument()
    expect(card.queryByText('Идёт сейчас')).not.toBeInTheDocument()
  })
})

describe('отмена бронирования', () => {
  const dialogName = 'Отменить бронирование?'

  async function openCancelModal() {
    const card = within(await screen.findByRole('article'))
    fireEvent.click(card.getByRole('button', { name: 'Отменить' }))
    return within(await screen.findByRole('dialog', { name: dialogName }))
  }

  it('подтверждение показывает тип, время и гостя; «Не отменять» закрывает без отмены', async () => {
    let cancels = 0
    serveBookings([
      booking('2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z', {
        name: 'Мария Иванова',
      }),
    ])
    server.use(
      handleCancelBooking(() => {
        cancels += 1
        return HttpResponse.json<Booking>(
          booking('2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z'),
        )
      }),
    )
    renderApp('/admin/bookings')

    const modal = await openCancelModal()
    expect(modal.getByText(/Консультация/)).toBeInTheDocument()
    expect(modal.getByText(/пн, 26 октября, 10:00–10:30/)).toBeInTheDocument()
    expect(modal.getByText(/Мария Иванова/)).toBeInTheDocument()
    // Красная: так Mantine задаёт цвет кнопки
    expect(
      modal
        .getByRole('button', { name: 'Отменить бронирование' })
        .style.getPropertyValue('--button-bg'),
    ).toBe('var(--mantine-color-red-filled)')
    fireEvent.click(modal.getByRole('button', { name: 'Не отменять' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: dialogName }),
      ).not.toBeInTheDocument(),
    )
    expect(cancels).toBe(0)
  })

  it('после подтверждения отменяет, уведомляет и показывает карточку отменённой', async () => {
    const stored = [
      booking('2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z', {
        name: 'Мария Иванова',
        email: 'maria@example.com',
      }),
    ]
    const cancelled: string[] = []
    server.use(
      handleGetOwner({
        body: { name: 'Анна Смирнова', timeZone: 'Europe/Moscow' },
      }),
      handleListBookings(() => HttpResponse.json(stored)),
      handleCancelBooking(({ params }) => {
        cancelled.push(String(params.bookingId))
        stored[0] = { ...stored[0], cancelled: true }
        return HttpResponse.json(stored[0])
      }),
    )
    renderApp('/admin/bookings')

    const modal = await openCancelModal()
    fireEvent.click(
      modal.getByRole('button', { name: 'Отменить бронирование' }),
    )

    expect(await screen.findByText('Бронирование отменено')).toBeInTheDocument()
    expect(cancelled).toEqual([stored[0].id])
    const card = within(screen.getByRole('article'))
    expect(await card.findByText('Отменено')).toBeInTheDocument()
    expect(
      card.queryByRole('button', { name: 'Отменить' }),
    ).not.toBeInTheDocument()
    expect(
      card.getByRole('link', { name: 'maria@example.com' }),
    ).toHaveAttribute('href', 'mailto:maria@example.com')
    expect(screen.getByRole('article')).toHaveStyle({ opacity: '0.6' })
    expect(
      screen.queryByRole('dialog', { name: dialogName }),
    ).not.toBeInTheDocument()
  })

  it('новое бронирование на то же время стоит рядом с отменённым', async () => {
    serveBookings([
      booking('2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z', {
        name: 'Мария Иванова',
        cancelled: true,
      }),
      booking('2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z', {
        name: 'Пётр Сидоров',
      }),
    ])
    renderApp('/admin/bookings')

    await screen.findByRole('region', { name: 'Завтра' })
    expect(groups()).toEqual([
      { day: 'Завтра', times: ['10:00–10:30', '10:00–10:30'] },
    ])
    const [cancelledCard, newCard] = screen
      .getAllByRole('article')
      .map((card) => within(card))
    expect(cancelledCard.getByText('Мария Иванова')).toBeInTheDocument()
    expect(cancelledCard.getByText('Отменено')).toBeInTheDocument()
    expect(newCard.getByText('Пётр Сидоров')).toBeInTheDocument()
    expect(newCard.queryByText('Отменено')).not.toBeInTheDocument()
    expect(
      newCard.getByRole('button', { name: 'Отменить' }),
    ).toBeInTheDocument()
  })

  it('только отменённые — не пустой список, а их карточки', async () => {
    serveBookings([
      booking('2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z', {
        cancelled: true,
      }),
    ])
    renderApp('/admin/bookings')

    expect(
      within(await screen.findByRole('article')).getByText('Отменено'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Предстоящих бронирований нет'),
    ).not.toBeInTheDocument()
  })

  describe.each([
    {
      status: 409,
      error: {
        code: 'booking_ended',
        message: 'Бронирование уже закончилось',
      } satisfies ApiError,
      notification: 'Бронирование уже закончилось',
    },
    {
      status: 404,
      error: { code: 'not_found', message: 'Не найдено' } satisfies ApiError,
      notification: 'Бронирование не найдено',
    },
  ])('$status $error.code', ({ status, error, notification }) => {
    it('уведомляет, закрывает модалку и перезагружает список', async () => {
      // Пока модалка была открыта, звонок закончился или бронирование
      // пропало: в новом списке его уже нет
      let stored = [booking('2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z')]
      server.use(
        handleGetOwner({
          body: { name: 'Анна Смирнова', timeZone: 'Europe/Moscow' },
        }),
        handleListBookings(() => HttpResponse.json(stored)),
        handleCancelBooking(() => {
          stored = []
          return HttpResponse.json<ApiError>(error, { status })
        }),
      )
      renderApp('/admin/bookings')

      const modal = await openCancelModal()
      fireEvent.click(
        modal.getByRole('button', { name: 'Отменить бронирование' }),
      )

      expect(await screen.findByText(notification)).toBeInTheDocument()
      expect(
        await screen.findByRole('heading', {
          name: 'Предстоящих бронирований нет',
        }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('dialog', { name: dialogName }),
      ).not.toBeInTheDocument()
    })
  })

  it('при прочем сбое уведомляет, модалка остаётся', async () => {
    serveBookings([booking('2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z')])
    server.use(
      handleCancelBooking(() =>
        HttpResponse.json<ApiError>(
          { code: 'internal_error', message: 'Внутренняя ошибка сервера' },
          { status: 500 },
        ),
      ),
    )
    renderApp('/admin/bookings')

    const modal = await openCancelModal()
    fireEvent.click(
      modal.getByRole('button', { name: 'Отменить бронирование' }),
    )

    expect(
      await screen.findByText(
        'Не удалось отменить бронирование. Попробуйте ещё раз.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: dialogName })).toBeInTheDocument()
  })
})
