import { describe, expect, it } from 'vitest'
import type {
  CreateBooking,
  CreateEventType,
  Minutes15,
} from '../generated/types.gen.js'
import { buildTestApp } from '../test/buildTestApp.js'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

type TestApp = ReturnType<typeof buildTestApp>

async function createEventType(
  app: TestApp,
  overrides: Partial<CreateEventType> = {},
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/event-types',
    payload: {
      title: 'Консультация',
      durationMinutes: 30,
      slotStepMinutes: 30,
      hidden: false,
      ...overrides,
    } satisfies CreateEventType,
  })
  return response.json<{ id: string }>().id
}

// Тип на duration минут с шагом в ту же длительность: сетка с начала часа
const createEventTypeOf = (app: TestApp, durationMinutes: Minutes15) =>
  createEventType(app, {
    title: `Звонок на ${durationMinutes} мин`,
    durationMinutes,
    slotStepMinutes: durationMinutes,
  })

function book(
  app: TestApp,
  eventTypeId: string,
  overrides: Partial<CreateBooking> = {},
) {
  return app.inject({
    method: 'POST',
    url: `/api/event-types/${eventTypeId}/bookings`,
    payload: {
      // Вторник 3 ноября, 10:00 по Москве; сейчас понедельник 09:00
      start: '2026-11-03T07:00:00Z',
      name: 'Иван Петров',
      email: 'ivan@example.com',
      ...overrides,
    },
  })
}

describe('POST /api/event-types/:eventTypeId/bookings', () => {
  it('бронирует свободный слот: 201, конец — начало плюс длительность типа', async () => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app, { durationMinutes: 45 })

    const response = await book(app, eventTypeId, {
      comment: 'Хочу обсудить\nархитектуру',
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual({
      id: expect.stringMatching(uuid),
      eventType: { id: eventTypeId, title: 'Консультация', hidden: false },
      start: '2026-11-03T07:00:00Z',
      end: '2026-11-03T07:45:00Z',
      name: 'Иван Петров',
      email: 'ivan@example.com',
      comment: 'Хочу обсудить\nархитектуру',
      cancelled: false,
    })
  })

  it('скрытый тип события: 404', async () => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app, { hidden: true })

    const response = await book(app, eventTypeId)

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'not_found' })
  })

  it('несуществующий тип события: 404', async () => {
    const app = buildTestApp()

    const response = await book(app, '7b0c4c3e-8a43-4d5e-9d6a-2f1e0a7f0c11')

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'not_found' })
  })

  it('start со смещением принимается и отдаётся в UTC', async () => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app)

    const response = await book(app, eventTypeId, {
      start: '2026-11-03T10:00:00.000+03:00',
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      start: '2026-11-03T07:00:00Z',
      end: '2026-11-03T07:30:00Z',
    })
  })

  it('start без смещения: 400', async () => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app)

    const response = await book(app, eventTypeId, {
      start: '2026-11-03T10:00:00',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      code: 'validation_error',
      message: expect.any(String),
      fieldErrors: [{ field: 'start', message: 'Неверный формат' }],
    })
  })

  it('ошибки полей: 400 с fieldErrors по каждому полю', async () => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app)

    const response = await book(app, eventTypeId, {
      name: ' Иван ',
      email: 'ivan@example',
      comment: '   ',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      code: 'validation_error',
      message: expect.any(String),
      fieldErrors: expect.arrayContaining([
        { field: 'name', message: 'Неверный формат' },
        { field: 'email', message: 'Неверный формат' },
        { field: 'comment', message: 'Неверный формат' },
      ]),
    })
    expect(response.json().fieldErrors).toHaveLength(3)
  })

  it.each([
    ['id', { id: '7b0c4c3e-8a43-4d5e-9d6a-2f1e0a7f0c11' }],
    ['end', { end: '2026-11-03T07:30:00Z' }],
    ['cancelled', { cancelled: false }],
  ])('присланное поле %s даёт 400 «Неизвестное поле»', async (field, extra) => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app)

    const response = await book(app, eventTypeId, extra)

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      code: 'validation_error',
      message: expect.any(String),
      fieldErrors: [{ field, message: 'Неизвестное поле' }],
    })
  })

  it('длиннее лимитов: 400 с сообщением о длине', async () => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app)

    const response = await book(app, eventTypeId, {
      name: 'я'.repeat(101),
      email: `${'a'.repeat(250)}@x.ru`,
      comment: 'я'.repeat(1001),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().fieldErrors).toEqual(
      expect.arrayContaining([
        { field: 'name', message: 'Не больше 100 символов' },
        { field: 'email', message: 'Не больше 254 символов' },
        { field: 'comment', message: 'Не больше 1000 символов' },
      ]),
    )
  })

  it('один email бронирует сколько угодно слотов', async () => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app)

    const first = await book(app, eventTypeId, {
      start: '2026-11-03T07:00:00Z',
    })
    const second = await book(app, eventTypeId, {
      start: '2026-11-03T08:00:00Z',
    })

    expect(first.statusCode).toBe(201)
    expect(second.statusCode).toBe(201)
  })

  it.each([
    ['занятый слот', '2026-11-03T07:00:00Z'],
    ['не на сетке слотов', '2026-11-03T07:15:00Z'],
    ['раньше минимального запаса', '2026-11-02T06:30:00Z'],
    ['вне доступного времени', '2026-11-03T16:00:00Z'],
    ['за окном записи', '2026-11-16T07:00:00Z'],
  ])('%s: 409 slot_unavailable', async (_case, start) => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app)
    await book(app, eventTypeId, { start: '2026-11-03T07:00:00Z' })

    const response = await book(app, eventTypeId, {
      start,
      email: 'other@example.com',
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      code: 'slot_unavailable',
      message: 'Это время уже недоступно. Выберите другое.',
    })
  })

  describe('частичное наложение бронирований разных типов', () => {
    // Вторник 3 ноября по Москве
    const at10 = '2026-11-03T07:00:00Z'
    const at1030 = '2026-11-03T07:30:00Z'

    it('после 60 минут в 10:00 запись на 30 минут в 10:30 — 409 slot_unavailable', async () => {
      const app = buildTestApp()
      const hour = await createEventTypeOf(app, 60)
      const halfHour = await createEventTypeOf(app, 30)

      const first = await book(app, hour, { start: at10 })
      const second = await book(app, halfHour, { start: at1030 })

      expect(first.statusCode).toBe(201)
      expect(second.statusCode).toBe(409)
      expect(second.json()).toEqual({
        code: 'slot_unavailable',
        message: 'Это время уже недоступно. Выберите другое.',
      })
    })

    it('после 30 минут в 10:30 запись на 60 минут в 10:00 — 409 slot_unavailable', async () => {
      const app = buildTestApp()
      const hour = await createEventTypeOf(app, 60)
      const halfHour = await createEventTypeOf(app, 30)

      const first = await book(app, halfHour, { start: at1030 })
      const second = await book(app, hour, { start: at10 })

      expect(first.statusCode).toBe(201)
      expect(second.statusCode).toBe(409)
      expect(second.json()).toEqual({
        code: 'slot_unavailable',
        message: 'Это время уже недоступно. Выберите другое.',
      })
    })
  })
})
