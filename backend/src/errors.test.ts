import { describe, expect, it } from 'vitest'
import { buildTestApp } from './test/buildTestApp.js'

describe('ошибки API', () => {
  it('неизвестный путь под /api отдаёт 404 not_found', async () => {
    const app = buildTestApp()
    const response = await app.inject({ method: 'GET', url: '/api/unknown' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      code: 'not_found',
      message: expect.any(String),
    })
  })

  it('тело без обязательных полей отдаёт 400 validation_error по каждому полю', async () => {
    const app = buildTestApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/event-types',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      code: 'validation_error',
      message: expect.any(String),
      fieldErrors: [
        { field: 'title', message: 'Обязательное поле' },
        { field: 'durationMinutes', message: 'Обязательное поле' },
        { field: 'slotStepMinutes', message: 'Обязательное поле' },
        { field: 'hidden', message: 'Обязательное поле' },
      ],
    })
  })

  it('длинное и лишнее поле отдают свои сообщения', async () => {
    const app = buildTestApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/event-types',
      payload: {
        id: '7b0c4c3e-8a43-4d5e-9d6a-2f1e0a7f0c11',
        title: 'а'.repeat(101),
        durationMinutes: 30,
        slotStepMinutes: 30,
        hidden: false,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().fieldErrors).toEqual([
      { field: 'id', message: 'Неизвестное поле' },
      { field: 'title', message: 'Не больше 100 символов' },
    ])
  })

  it('путь вложенного поля идёт через точки от корня тела', async () => {
    const app = buildTestApp()
    const day: never[] = []
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/schedule',
      payload: {
        weekly: {
          monday: day,
          tuesday: day,
          wednesday: day,
          thursday: day,
          friday: day,
          saturday: day,
          sunday: day,
        },
        overrides: [
          { date: '2026-11-02', ranges: [{ start: '09:00', end: '25:00' }] },
        ],
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().fieldErrors).toEqual([
      { field: 'overrides.0.ranges.0.end', message: 'Неверный формат' },
    ])
  })

  it('невалидный JSON в теле отдаёт 400 validation_error', async () => {
    const app = buildTestApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/event-types',
      headers: { 'content-type': 'application/json' },
      payload: '{"title":',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      code: 'validation_error',
      message: expect.any(String),
    })
  })

  it('неверный параметр пути отдаёт 400 только с сообщением', async () => {
    const app = buildTestApp()
    const response = await app.inject({
      method: 'GET',
      url: '/api/event-types/not-a-uuid',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      code: 'validation_error',
      message: expect.any(String),
    })
  })

  it('непредвиденная ошибка отдаёт 500 internal_error', async () => {
    const app = buildTestApp()
    app.get('/api/test-failure', async () => {
      throw new Error('boom')
    })
    const response = await app.inject({
      method: 'GET',
      url: '/api/test-failure',
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      code: 'internal_error',
      message: expect.any(String),
    })
  })
})
