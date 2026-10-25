import { describe, expect, it } from 'vitest'
import type { Slot } from '../generated/types.gen.js'
import { buildTestApp } from '../test/buildTestApp.js'

async function createEventType(
  app: ReturnType<typeof buildTestApp>,
  hidden = false,
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/event-types',
    payload: {
      title: hidden ? 'Скрытый разбор' : 'Консультация',
      durationMinutes: 30,
      slotStepMinutes: 30,
      hidden,
    },
  })
  return response.json<{ id: string }>().id
}

describe('GET /api/event-types/:eventTypeId/slots', () => {
  it('отдаёт окно записи и слоты на всё окно плоским списком в UTC', async () => {
    // По умолчанию сейчас понедельник 2 ноября, 09:00 по Москве
    const app = buildTestApp()
    const id = await createEventType(app)

    const response = await app.inject({
      method: 'GET',
      url: `/api/event-types/${id}/slots`,
    })

    expect(response.statusCode).toBe(200)
    const { bookingWindow, slots } = response.json<{
      bookingWindow: Slot
      slots: Slot[]
    }>()
    expect(bookingWindow).toEqual({
      start: '2026-11-01T21:00:00Z',
      end: '2026-11-15T21:00:00Z',
    })
    // Час запаса: первый слот в 10:00 по Москве
    expect(slots[0]).toEqual({
      start: '2026-11-02T07:00:00Z',
      end: '2026-11-02T07:30:00Z',
    })
    // Последний — пятница 13 ноября, 17:30 по Москве
    expect(slots.at(-1)).toEqual({
      start: '2026-11-13T14:30:00Z',
      end: '2026-11-13T15:00:00Z',
    })
    // Понедельник с 10:00 — 16 слотов, ещё девять будних дней по 18
    expect(slots).toHaveLength(16 + 9 * 18)
    for (const slot of slots) {
      expect(slot.start).toMatch(/Z$/)
      expect(slot.end).toMatch(/Z$/)
    }
  })

  it('окно записи и расписание считаются по поясу владельца', async () => {
    const app = buildTestApp({
      ownerTimeZone: 'Asia/Tokyo',
      // Понедельник 2 ноября, 08:00 по Токио
      now: () => new Date('2026-11-01T23:00:00Z'),
    })
    const id = await createEventType(app)

    const response = await app.inject({
      method: 'GET',
      url: `/api/event-types/${id}/slots`,
    })

    const { bookingWindow, slots } = response.json()
    expect(bookingWindow).toEqual({
      start: '2026-11-01T15:00:00Z',
      end: '2026-11-15T15:00:00Z',
    })
    // 09:00 по Токио
    expect(slots[0]).toEqual({
      start: '2026-11-02T00:00:00Z',
      end: '2026-11-02T00:30:00Z',
    })
  })

  it('скрытый тип события для гостя не существует: 404', async () => {
    const app = buildTestApp()
    const id = await createEventType(app, true)

    const response = await app.inject({
      method: 'GET',
      url: `/api/event-types/${id}/slots`,
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'not_found' })
  })

  it('несуществующий тип события: 404', async () => {
    const app = buildTestApp()

    const response = await app.inject({
      method: 'GET',
      url: '/api/event-types/7b0c4c3e-8a43-4d5e-9d6a-2f1e0a7f0c11/slots',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'not_found' })
  })

  it('id не UUID: 400 validation_error только с message', async () => {
    const app = buildTestApp()

    const response = await app.inject({
      method: 'GET',
      url: '/api/event-types/not-a-uuid/slots',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      code: 'validation_error',
      message: expect.any(String),
    })
  })
})
