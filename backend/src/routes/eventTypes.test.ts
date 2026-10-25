import { describe, expect, it } from 'vitest'
import type { CreateEventType } from '../generated/types.gen.js'
import { buildTestApp } from '../test/buildTestApp.js'

function eventTypeInput(overrides: Partial<CreateEventType> = {}) {
  return {
    title: 'Консультация',
    durationMinutes: 30,
    slotStepMinutes: 30,
    hidden: false,
    ...overrides,
  } satisfies CreateEventType
}

async function createEventType(
  app: ReturnType<typeof buildTestApp>,
  input: CreateEventType,
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/event-types',
    payload: input,
  })
  expect(response.statusCode).toBe(201)
  return response.json<{ id: string }>()
}

describe('GET /api/event-types', () => {
  it('отдаёт только видимые типы в порядке создания без служебных полей', async () => {
    const app = buildTestApp()
    const first = await createEventType(
      app,
      eventTypeInput({
        title: 'Знакомство',
        description: 'Расскажу,\nкак всё устроено',
        durationMinutes: 15,
        slotStepMinutes: 15,
      }),
    )
    await createEventType(
      app,
      eventTypeInput({ title: 'Разбор', hidden: true }),
    )
    const third = await createEventType(
      app,
      eventTypeInput({ title: 'Консультация', durationMinutes: 90 }),
    )

    const response = await app.inject({
      method: 'GET',
      url: '/api/event-types',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([
      {
        id: first.id,
        title: 'Знакомство',
        description: 'Расскажу,\nкак всё устроено',
        durationMinutes: 15,
      },
      { id: third.id, title: 'Консультация', durationMinutes: 90 },
    ])
  })
})

describe('GET /api/event-types/:eventTypeId', () => {
  it('отдаёт видимый тип без служебных полей', async () => {
    const app = buildTestApp()
    const created = await createEventType(
      app,
      eventTypeInput({ description: 'Обсудим задачу' }),
    )

    const response = await app.inject({
      method: 'GET',
      url: `/api/event-types/${created.id}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      id: created.id,
      title: 'Консультация',
      description: 'Обсудим задачу',
      durationMinutes: 30,
    })
  })

  it('скрытый тип для гостя не существует: 404 not_found', async () => {
    const app = buildTestApp()
    const hidden = await createEventType(app, eventTypeInput({ hidden: true }))

    const response = await app.inject({
      method: 'GET',
      url: `/api/event-types/${hidden.id}`,
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      code: 'not_found',
      message: expect.any(String),
    })
  })

  it('несуществующий тип: 404 not_found', async () => {
    const app = buildTestApp()

    const response = await app.inject({
      method: 'GET',
      url: '/api/event-types/7b0c4c3e-8a43-4d5e-9d6a-2f1e0a7f0c11',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      code: 'not_found',
      message: expect.any(String),
    })
  })

  it('id не UUID: 400 validation_error только с message', async () => {
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
})
