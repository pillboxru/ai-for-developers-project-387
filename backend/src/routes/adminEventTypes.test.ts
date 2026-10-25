import { describe, expect, it } from 'vitest'
import type { Booking, CreateEventType } from '../generated/types.gen.js'
import { buildTestApp } from '../test/buildTestApp.js'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function eventTypeInput(overrides: Partial<CreateEventType> = {}) {
  return {
    title: 'Консультация',
    durationMinutes: 30,
    slotStepMinutes: 30,
    hidden: false,
    ...overrides,
  } satisfies CreateEventType
}

describe('GET /api/admin/event-types', () => {
  it('на старте приложения типов нет', async () => {
    const app = buildTestApp()
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/event-types',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([])
  })

  it('отдаёт все типы, включая скрытые, в порядке создания', async () => {
    const app = buildTestApp()
    for (const input of [
      eventTypeInput({ title: 'Знакомство' }),
      eventTypeInput({ title: 'Разбор', hidden: true }),
      eventTypeInput({ title: 'Консультация' }),
    ]) {
      await app.inject({
        method: 'POST',
        url: '/api/admin/event-types',
        payload: input,
      })
    }

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/event-types',
    })

    expect(response.statusCode).toBe(200)
    expect(
      response.json().map((eventType: { title: string }) => eventType.title),
    ).toEqual(['Знакомство', 'Разбор', 'Консультация'])
    expect(response.json()[1]).toMatchObject({
      hidden: true,
      hasBookings: false,
    })
  })
})

describe('POST /api/admin/event-types', () => {
  it('создаёт тип с серверным UUID', async () => {
    const app = buildTestApp()
    const input = eventTypeInput({
      description: 'Обсудим задачу\nи сроки',
      durationMinutes: 90,
      slotStepMinutes: 15,
      hidden: true,
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/event-types',
      payload: input,
    })

    expect(response.statusCode).toBe(201)
    const created = response.json()
    expect(created).toEqual({
      ...input,
      id: expect.stringMatching(uuid),
      hasBookings: false,
    })
  })

  it('id у каждого типа свой', async () => {
    const app = buildTestApp()
    const create = (title: string) =>
      app.inject({
        method: 'POST',
        url: '/api/admin/event-types',
        payload: eventTypeInput({ title }),
      })

    const first = (await create('Знакомство')).json()
    const second = (await create('Разбор')).json()

    expect(first.id).not.toBe(second.id)
  })

  it.each([
    ['id', { id: '7b0c4c3e-8a43-4d5e-9d6a-2f1e0a7f0c11' }],
    ['hasBookings', { hasBookings: false }],
    ['color', { color: 'red' }],
  ])('присланное поле %s даёт 400 «Неизвестное поле»', async (field, extra) => {
    const app = buildTestApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/event-types',
      payload: { ...eventTypeInput(), ...extra },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      code: 'validation_error',
      fieldErrors: [{ field, message: 'Неизвестное поле' }],
    })
  })

  it.each([
    ['durationMinutes', 20],
    ['durationMinutes', 255],
    ['slotStepMinutes', 0],
  ])('%s = %i вне 15…240 с шагом 15 даёт 400 у поля', async (field, value) => {
    const app = buildTestApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/event-types',
      payload: { ...eventTypeInput(), [field]: value },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      code: 'validation_error',
      fieldErrors: [{ field, message: 'Недопустимое значение' }],
    })
  })
})

describe('уникальность названия', () => {
  async function createTitles(titles: string[]) {
    const app = buildTestApp()
    const responses = []
    for (const title of titles) {
      responses.push(
        await app.inject({
          method: 'POST',
          url: '/api/admin/event-types',
          payload: eventTypeInput({ title }),
        }),
      )
    }
    return { app, last: responses[responses.length - 1] }
  }

  it.each([
    ['то же название', 'Консультация', 'Консультация'],
    ['другой регистр', 'Консультация', 'КОНСУЛЬТАЦИЯ'],
    ['регистр «Ё»', 'Ёлка', 'ёлка'],
  ])('%s даёт 409 event_type_title_taken', async (_case, first, second) => {
    const { app, last } = await createTitles([first, second])

    expect(last.statusCode).toBe(409)
    expect(last.json()).toEqual({
      code: 'event_type_title_taken',
      message: 'Тип события с таким названием уже есть',
      fieldErrors: [
        { field: 'title', message: 'Тип события с таким названием уже есть' },
      ],
    })
    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/event-types',
    })
    expect(list.json()).toHaveLength(1)
  })

  it('со скрытым типом название тоже не повторяется', async () => {
    const app = buildTestApp()
    await app.inject({
      method: 'POST',
      url: '/api/admin/event-types',
      payload: eventTypeInput({ title: 'Разбор', hidden: true }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/event-types',
      payload: eventTypeInput({ title: 'разбор' }),
    })

    expect(response.statusCode).toBe(409)
  })

  it.each([
    ['«ё» и «е»', 'Ёлка', 'Елка'],
    ['пробелы внутри не схлопываются', 'Разбор кода', 'Разбор  кода'],
  ])('%s различаются', async (_case, first, second) => {
    const { last } = await createTitles([first, second])

    expect(last.statusCode).toBe(201)
  })
})

async function createEventType(
  app: ReturnType<typeof buildTestApp>,
  overrides: Partial<CreateEventType> = {},
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/event-types',
    payload: eventTypeInput(overrides),
  })
  expect(response.statusCode).toBe(201)
  const created: { id: string } = response.json()
  return created
}

describe('PUT /api/admin/event-types/:eventTypeId', () => {
  it('меняет тип полной моделью и отдаёт его', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app, {
      title: 'Консультация',
      description: 'Обсудим задачу',
    })
    const input = eventTypeInput({
      title: 'Разбор кода',
      description: 'Посмотрим код\nвместе',
      durationMinutes: 60,
      slotStepMinutes: 15,
      hidden: true,
    })

    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/event-types/${id}`,
      payload: input,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ...input, id, hasBookings: false })
    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/event-types',
    })
    expect(list.json()).toEqual([{ ...input, id, hasBookings: false }])
  })

  it('без описания во вводе у типа описания нет', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app, { description: 'Обсудим задачу' })

    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/event-types/${id}`,
      payload: eventTypeInput(),
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).not.toHaveProperty('description')
  })

  it('своё название можно оставить и сменить в нём регистр', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app, { title: 'Консультация' })

    for (const title of ['Консультация', 'КОНСУЛЬТАЦИЯ']) {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/event-types/${id}`,
        payload: eventTypeInput({ title }),
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({ title })
    }
  })

  it('название другого типа, в том числе скрытого, даёт 409', async () => {
    const app = buildTestApp()
    await createEventType(app, { title: 'Разбор', hidden: true })
    const { id } = await createEventType(app, { title: 'Консультация' })

    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/event-types/${id}`,
      payload: eventTypeInput({ title: 'разбор' }),
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      code: 'event_type_title_taken',
      message: 'Тип события с таким названием уже есть',
      fieldErrors: [
        { field: 'title', message: 'Тип события с таким названием уже есть' },
      ],
    })
  })

  it('несуществующий тип даёт 404', async () => {
    const app = buildTestApp()

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/event-types/7b0c4c3e-8a43-4d5e-9d6a-2f1e0a7f0c11',
      payload: eventTypeInput(),
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      code: 'not_found',
      message: 'Не найдено',
    })
  })

  it.each([
    ['id', { id: '7b0c4c3e-8a43-4d5e-9d6a-2f1e0a7f0c11' }],
    ['hasBookings', { hasBookings: false }],
  ])('присланное поле %s даёт 400 «Неизвестное поле»', async (field, extra) => {
    const app = buildTestApp()
    const { id } = await createEventType(app)

    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/event-types/${id}`,
      payload: { ...eventTypeInput(), ...extra },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      code: 'validation_error',
      fieldErrors: [{ field, message: 'Неизвестное поле' }],
    })
  })

  it('id в пути не UUID даёт 400', async () => {
    const app = buildTestApp()

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/event-types/not-a-uuid',
      payload: eventTypeInput(),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      code: 'validation_error',
      message: expect.any(String),
    })
  })
})

describe('скрытие типа правкой', () => {
  async function setHidden(
    app: ReturnType<typeof buildTestApp>,
    id: string,
    hidden: boolean,
  ) {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/event-types/${id}`,
      payload: eventTypeInput({ hidden }),
    })
    expect(response.statusCode).toBe(200)
  }

  const guestView = async (
    app: ReturnType<typeof buildTestApp>,
    id: string,
  ) => {
    const list = await app.inject({ method: 'GET', url: '/api/event-types' })
    const page = await app.inject({
      method: 'GET',
      url: `/api/event-types/${id}`,
    })
    const slots = await app.inject({
      method: 'GET',
      url: `/api/event-types/${id}/slots`,
    })
    return {
      listed: list
        .json<{ id: string }[]>()
        .some((eventType) => eventType.id === id),
      pageStatus: page.statusCode,
      slotsStatus: slots.statusCode,
    }
  }

  it('скрытый тип пропадает у гостя и остаётся у владельца', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app)

    await setHidden(app, id, true)

    expect(await guestView(app, id)).toEqual({
      listed: false,
      pageStatus: 404,
      slotsStatus: 404,
    })
    const admin = await app.inject({
      method: 'GET',
      url: '/api/admin/event-types',
    })
    expect(admin.json()).toEqual([
      expect.objectContaining({ id, hidden: true }),
    ])
  })

  it('вернуть тип гостям можно в любой момент', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app, { hidden: true })

    await setHidden(app, id, false)

    expect(await guestView(app, id)).toEqual({
      listed: true,
      pageStatus: 200,
      slotsStatus: 200,
    })
  })
})

describe('DELETE /api/admin/event-types/:eventTypeId', () => {
  it('удаляет тип без бронирований: 204, у владельца и гостя его нет', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app, { title: 'Консультация' })
    const kept = await createEventType(app, { title: 'Разбор' })

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/event-types/${id}`,
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')
    const admin = await app.inject({
      method: 'GET',
      url: '/api/admin/event-types',
    })
    expect(admin.json()).toEqual([expect.objectContaining({ id: kept.id })])
    const page = await app.inject({
      method: 'GET',
      url: `/api/event-types/${id}`,
    })
    expect(page.statusCode).toBe(404)
  })

  it('название удалённого типа снова свободно', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app, { title: 'Консультация' })
    await app.inject({ method: 'DELETE', url: `/api/admin/event-types/${id}` })

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/event-types',
      payload: eventTypeInput({ title: 'Консультация' }),
    })

    expect(response.statusCode).toBe(201)
  })

  it('несуществующий тип даёт 404, в том числе повторное удаление', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app)
    await app.inject({ method: 'DELETE', url: `/api/admin/event-types/${id}` })

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/event-types/${id}`,
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      code: 'not_found',
      message: 'Не найдено',
    })
  })

  it('id в пути не UUID даёт 400', async () => {
    const app = buildTestApp()

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/admin/event-types/not-a-uuid',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      code: 'validation_error',
      message: expect.any(String),
    })
  })
})

describe('защита бронирований', () => {
  const guest = { name: 'Иван Петров', email: 'ivan@example.com' }

  // Бронирует первый свободный слот типа; часы приложения передвигает тест
  async function bookFirstSlot(
    app: ReturnType<typeof buildTestApp>,
    eventTypeId: string,
  ) {
    const slots = await app.inject({
      method: 'GET',
      url: `/api/event-types/${eventTypeId}/slots`,
    })
    const start = slots.json<{ slots: { start: string }[] }>().slots[0]?.start
    const response = await app.inject({
      method: 'POST',
      url: `/api/event-types/${eventTypeId}/bookings`,
      payload: { ...guest, start },
    })
    expect(response.statusCode).toBe(201)
    return response.json<{ id: string }>()
  }

  const cancel = (app: ReturnType<typeof buildTestApp>, bookingId: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${bookingId}/cancel`,
    })

  const listBookings = async (app: ReturnType<typeof buildTestApp>) =>
    (await app.inject({ method: 'GET', url: '/api/admin/bookings' })).json<
      Booking[]
    >()

  const put = (
    app: ReturnType<typeof buildTestApp>,
    id: string,
    input: CreateEventType,
  ) =>
    app.inject({
      method: 'PUT',
      url: `/api/admin/event-types/${id}`,
      payload: input,
    })

  const remove = (app: ReturnType<typeof buildTestApp>, id: string) =>
    app.inject({ method: 'DELETE', url: `/api/admin/event-types/${id}` })

  it('hasBookings: есть неотменённое — true, после отмены — false', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app, {})
    const booking = await bookFirstSlot(app, id)
    const hasBookings = async () =>
      (await app.inject({ method: 'GET', url: '/api/admin/event-types' })).json<
        { hasBookings: boolean }[]
      >()[0]?.hasBookings

    expect(await hasBookings()).toBe(true)
    await cancel(app, booking.id)
    expect(await hasBookings()).toBe(false)
  })

  it('hasBookings считает и прошедшие бронирования', async () => {
    let now = new Date('2026-11-02T06:00:00Z')
    const app = buildTestApp({ now: () => now })
    const { id } = await createEventType(app, {})
    await bookFirstSlot(app, id)
    now = new Date('2026-12-01T06:00:00Z')

    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/event-types',
    })
    expect(list.json()[0]).toMatchObject({ hasBookings: true })
  })

  it('смена длительности при неотменённом бронировании даёт 409', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app, {})
    await bookFirstSlot(app, id)

    const response = await put(app, id, eventTypeInput({ durationMinutes: 60 }))

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'event_type_has_bookings' })
  })

  it('прошедшее бронирование тоже защищает длительность', async () => {
    let now = new Date('2026-11-02T06:00:00Z')
    const app = buildTestApp({ now: () => now })
    const { id } = await createEventType(app, {})
    await bookFirstSlot(app, id)
    now = new Date('2026-12-01T06:00:00Z')

    const response = await put(app, id, eventTypeInput({ durationMinutes: 60 }))

    expect(response.statusCode).toBe(409)
  })

  it('остальные поля при бронированиях меняются, длительность без изменения тоже', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app, {})
    await bookFirstSlot(app, id)

    const response = await put(
      app,
      id,
      eventTypeInput({ title: 'Новое имя', slotStepMinutes: 15, hidden: true }),
    )

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      title: 'Новое имя',
      hasBookings: true,
    })
  })

  it('только отменённые: длительность меняется, конец отменённого пересчитан', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app, {})
    const booking = await bookFirstSlot(app, id)
    await cancel(app, booking.id)

    const response = await put(app, id, eventTypeInput({ durationMinutes: 60 }))

    expect(response.statusCode).toBe(200)
    const [listed] = await listBookings(app)
    expect(listed).toMatchObject({ id: booking.id, cancelled: true })
    const { start, end } = listed
    expect(Date.parse(end) - Date.parse(start)).toBe(60 * 60_000)
  })

  it('удаление при неотменённом бронировании даёт 409, тип и бронирование остаются', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app, {})
    await bookFirstSlot(app, id)

    const response = await remove(app, id)

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'event_type_has_bookings' })
    expect(await listBookings(app)).toHaveLength(1)
    const page = await app.inject({
      method: 'GET',
      url: `/api/event-types/${id}/slots`,
    })
    expect(page.statusCode).toBe(200)
  })

  it('только отменённые: 204, они удаляются с типом, слоты других типов целы', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app, { title: 'Первый' })
    const other = await createEventType(app, { title: 'Второй' })
    const cancelled = await bookFirstSlot(app, id)
    await cancel(app, cancelled.id)
    const kept = await bookFirstSlot(app, other.id)

    const response = await remove(app, id)

    expect(response.statusCode).toBe(204)
    expect((await listBookings(app)).map((b) => b.id)).toEqual([kept.id])
    const slots = await app.inject({
      method: 'GET',
      url: `/api/event-types/${other.id}/slots`,
    })
    expect(slots.statusCode).toBe(200)
  })

  it('бронирование скрытого типа остаётся у владельца и отменяется; новое — 404', async () => {
    const app = buildTestApp()
    const { id } = await createEventType(app, {})
    const booking = await bookFirstSlot(app, id)
    await put(app, id, eventTypeInput({ hidden: true }))

    expect(await listBookings(app)).toHaveLength(1)
    const again = await app.inject({
      method: 'POST',
      url: `/api/event-types/${id}/bookings`,
      payload: { ...guest, start: '2026-11-03T07:00:00Z' },
    })
    expect(again.statusCode).toBe(404)
    expect((await cancel(app, booking.id)).statusCode).toBe(200)
  })
})
