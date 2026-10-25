import { describe, expect, it } from 'vitest'
import type {
  Booking,
  CreateBooking,
  CreateEventType,
  SlotList,
} from '../generated/types.gen.js'
import { buildTestApp, testNow } from '../test/buildTestApp.js'

type TestApp = ReturnType<typeof buildTestApp>

const consultation: CreateEventType = {
  title: 'Консультация',
  durationMinutes: 30,
  slotStepMinutes: 30,
  hidden: false,
}

async function createEventType(
  app: TestApp,
  overrides: Partial<CreateEventType> = {},
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/event-types',
    payload: { ...consultation, ...overrides } satisfies CreateEventType,
  })
  return response.json<{ id: string }>().id
}

async function book(app: TestApp, eventTypeId: string, input: CreateBooking) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/event-types/${eventTypeId}/bookings`,
    payload: input,
  })
  expect(response.statusCode).toBe(201)
  return response.json<Booking>()
}

function cancel(app: TestApp, bookingId: string) {
  return app.inject({
    method: 'POST',
    url: `/api/admin/bookings/${bookingId}/cancel`,
  })
}

async function listBookings(app: TestApp) {
  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/bookings',
  })
  expect(response.statusCode).toBe(200)
  return response.json<Booking[]>()
}

async function slotStarts(app: TestApp, eventTypeId: string) {
  const response = await app.inject({
    method: 'GET',
    url: `/api/event-types/${eventTypeId}/slots`,
  })
  expect(response.statusCode).toBe(200)
  return response.json<SlotList>().slots.map((slot) => slot.start)
}

const guest = { name: 'Иван Петров', email: 'ivan@example.com' }

describe('GET /api/admin/bookings', () => {
  it('без бронирований — пустой список', async () => {
    const app = buildTestApp()

    expect(await listBookings(app)).toEqual([])
  })

  it('бронирования всех типов, включая скрытые, по началу, а не по созданию', async () => {
    const app = buildTestApp()
    const consultationId = await createEventType(app)
    const reviewId = await createEventType(app, {
      title: 'Разбор',
      durationMinutes: 60,
      slotStepMinutes: 60,
    })
    // Сейчас понедельник 2 ноября, 09:00 по Москве
    await book(app, reviewId, {
      start: '2026-11-04T08:00:00Z',
      name: 'Мария',
      email: 'maria@example.com',
      comment: 'Про сроки\nи бюджет',
    })
    await book(app, consultationId, { start: '2026-11-03T07:00:00Z', ...guest })
    // Скрытый тип убран из выбора гостя, но его бронирования остаются
    await app.inject({
      method: 'PUT',
      url: `/api/admin/event-types/${reviewId}`,
      payload: {
        ...consultation,
        title: 'Разбор',
        durationMinutes: 60,
        slotStepMinutes: 60,
        hidden: true,
      },
    })

    expect(await listBookings(app)).toEqual([
      {
        id: expect.any(String),
        eventType: { id: consultationId, title: 'Консультация', hidden: false },
        start: '2026-11-03T07:00:00Z',
        end: '2026-11-03T07:30:00Z',
        name: 'Иван Петров',
        email: 'ivan@example.com',
        cancelled: false,
      },
      {
        id: expect.any(String),
        eventType: { id: reviewId, title: 'Разбор', hidden: true },
        start: '2026-11-04T08:00:00Z',
        end: '2026-11-04T09:00:00Z',
        name: 'Мария',
        email: 'maria@example.com',
        comment: 'Про сроки\nи бюджет',
        cancelled: false,
      },
    ])
  })

  it('идущий звонок в списке, закончившийся — нет', async () => {
    let now = testNow
    const app = buildTestApp({ now: () => now })
    const eventTypeId = await createEventType(app)
    // Вторник 3 ноября, 10:00–10:30 по Москве
    await book(app, eventTypeId, { start: '2026-11-03T07:00:00Z', ...guest })

    now = new Date('2026-11-03T07:29:59Z')
    expect(await listBookings(app)).toHaveLength(1)

    // Конец не входит: в 10:30 звонок уже закончился
    now = new Date('2026-11-03T07:30:00Z')
    expect(await listBookings(app)).toEqual([])
  })
})

describe('POST /api/admin/bookings/:bookingId/cancel', () => {
  it('отменяет предстоящее бронирование', async () => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app)
    // Вторник 3 ноября, 10:00–10:30 по Москве
    const booking = await book(app, eventTypeId, {
      start: '2026-11-03T07:00:00Z',
      ...guest,
    })

    const response = await cancel(app, booking.id)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ...booking, cancelled: true })
  })

  it('нет бронирования — 404', async () => {
    const app = buildTestApp()

    const response = await cancel(app, '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f')

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      code: 'not_found',
      message: 'Не найдено',
    })
  })

  it('id не UUID — 400', async () => {
    const app = buildTestApp()

    const response = await cancel(app, 'not-a-uuid')

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      code: 'validation_error',
      message: expect.any(String),
    })
  })

  it('идущий звонок можно отменить, закончившийся — 409', async () => {
    let now = testNow
    const app = buildTestApp({ now: () => now })
    const eventTypeId = await createEventType(app)
    // Вторник 3 ноября, 10:00–10:30 и 11:00–11:30 по Москве
    const ongoing = await book(app, eventTypeId, {
      start: '2026-11-03T07:00:00Z',
      ...guest,
    })
    const ended = await book(app, eventTypeId, {
      start: '2026-11-03T08:00:00Z',
      ...guest,
    })

    now = new Date('2026-11-03T07:29:59Z')
    const cancelOngoing = await cancel(app, ongoing.id)
    expect(cancelOngoing.statusCode).toBe(200)
    expect(cancelOngoing.json()).toMatchObject({ cancelled: true })

    // Конец не входит: в 11:30 звонок уже закончился
    now = new Date('2026-11-03T08:30:00Z')
    const cancelEnded = await cancel(app, ended.id)
    expect(cancelEnded.statusCode).toBe(409)
    expect(cancelEnded.json()).toEqual({
      code: 'booking_ended',
      message: 'Бронирование уже закончилось',
    })
  })

  it('повторная отмена — 200 с уже отменённым, даже если звонок закончился', async () => {
    let now = testNow
    const app = buildTestApp({ now: () => now })
    const eventTypeId = await createEventType(app)
    // Вторник 3 ноября, 10:00–10:30 по Москве
    const booking = await book(app, eventTypeId, {
      start: '2026-11-03T07:00:00Z',
      ...guest,
    })
    await cancel(app, booking.id)

    const again = await cancel(app, booking.id)
    expect(again.statusCode).toBe(200)
    expect(again.json()).toEqual({ ...booking, cancelled: true })

    // Второй щелчок мог дойти уже после конца звонка: отмена всё равно
    // состоялась, и ошибка владельца бы запутала
    now = new Date('2026-11-03T07:30:00Z')
    const afterEnd = await cancel(app, booking.id)
    expect(afterEnd.statusCode).toBe(200)
    expect(afterEnd.json()).toEqual({ ...booking, cancelled: true })
  })

  it('время снова свободно, отменённое остаётся в списке рядом с новым', async () => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app)
    // Вторник 3 ноября, 10:00–10:30 по Москве
    const start = '2026-11-03T07:00:00Z'
    const booking = await book(app, eventTypeId, { start, ...guest })
    expect(await slotStarts(app, eventTypeId)).not.toContain(start)

    await cancel(app, booking.id)

    expect(await slotStarts(app, eventTypeId)).toContain(start)
    const rebooked = await book(app, eventTypeId, {
      start,
      name: 'Мария',
      email: 'maria@example.com',
    })
    expect(await listBookings(app)).toEqual([
      { ...booking, cancelled: true },
      rebooked,
    ])
  })
})
