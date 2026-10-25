import { describe, expect, it } from 'vitest'
import type { UpdateSchedule } from '../generated/types.gen.js'
import { buildTestApp } from '../test/buildTestApp.js'

type TestApp = ReturnType<typeof buildTestApp>

const workday = [{ start: '09:00', end: '18:00' }]

// Расписание по умолчанию: пн–пт 9:00–18:00
const defaultWeekly: UpdateSchedule['weekly'] = {
  monday: workday,
  tuesday: workday,
  wednesday: workday,
  thursday: workday,
  friday: workday,
  saturday: [],
  sunday: [],
}

const getSchedule = (app: TestApp) =>
  app.inject({ method: 'GET', url: '/api/admin/schedule' })

const updateSchedule = (app: TestApp, payload: unknown) =>
  app.inject({ method: 'PUT', url: '/api/admin/schedule', payload })

describe('GET /api/admin/schedule', () => {
  it('без правок: пн–пт 9:00–18:00, исключений нет, окно записи', async () => {
    // Сейчас понедельник 2 ноября, 09:00 по Москве
    const app = buildTestApp()

    const response = await getSchedule(app)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      weekly: defaultWeekly,
      overrides: [],
      bookingWindow: {
        start: '2026-11-01T21:00:00Z',
        end: '2026-11-15T21:00:00Z',
      },
    })
  })
})

async function createEventType(app: TestApp) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/event-types',
    payload: {
      title: 'Консультация',
      durationMinutes: 30,
      slotStepMinutes: 30,
      hidden: false,
    },
  })
  return response.json<{ id: string }>().id
}

function book(app: TestApp, eventTypeId: string, start: string) {
  return app.inject({
    method: 'POST',
    url: `/api/event-types/${eventTypeId}/bookings`,
    payload: { start, name: 'Иван Петров', email: 'ivan@example.com' },
  })
}

async function slotStarts(app: TestApp, eventTypeId: string) {
  const response = await app.inject({
    method: 'GET',
    url: `/api/event-types/${eventTypeId}/slots`,
  })
  return response
    .json<{ slots: { start: string }[] }>()
    .slots.map((slot) => slot.start)
}

describe('PUT /api/admin/schedule', () => {
  it('сохраняет расписание, отдаёт его и сразу меняет слоты гостя', async () => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app)
    const body: UpdateSchedule = {
      weekly: {
        ...defaultWeekly,
        tuesday: [],
        saturday: [
          { start: '00:00', end: '02:00' },
          { start: '20:00', end: '24:00' },
        ],
      },
      overrides: [],
    }

    const response = await updateSchedule(app, body)

    expect(response.statusCode).toBe(200)
    const saved = {
      ...body,
      bookingWindow: {
        start: '2026-11-01T21:00:00Z',
        end: '2026-11-15T21:00:00Z',
      },
    }
    expect(response.json()).toEqual(saved)
    expect((await getSchedule(app)).json()).toEqual(saved)
    const starts = await slotStarts(app, eventTypeId)
    // Вторник 3 ноября закрыт, суббота 7 ноября открыта с 20:00 по Москве
    expect(starts).not.toContain('2026-11-03T07:00:00Z')
    expect(starts).toContain('2026-11-07T17:00:00Z')
  })

  it('сохранённое исключение меняет слоты гостя на эту дату', async () => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app)

    const response = await updateSchedule(app, {
      weekly: defaultWeekly,
      overrides: [
        // Среда 4 ноября закрыта, суббота 7 ноября открыта 10:00–11:00
        { date: '2026-11-04', ranges: [] },
        { date: '2026-11-07', ranges: [{ start: '10:00', end: '11:00' }] },
        // За окном записи: сохраняется, хотя слотов на эту дату ещё нет
        { date: '2026-12-01', ranges: [] },
      ],
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().overrides).toContainEqual({
      date: '2026-12-01',
      ranges: [],
    })
    const starts = await slotStarts(app, eventTypeId)
    expect(starts.filter((start) => start.startsWith('2026-11-04'))).toEqual([])
    // По Москве 10:00 и 10:30
    expect(starts.filter((start) => start.startsWith('2026-11-07'))).toEqual([
      '2026-11-07T07:00:00Z',
      '2026-11-07T07:30:00Z',
    ])
    expect(starts).toContain('2026-11-05T06:00:00Z')
  })

  it('исключения отдаются по возрастанию даты', async () => {
    const app = buildTestApp()

    const response = await updateSchedule(app, {
      weekly: defaultWeekly,
      overrides: [
        { date: '2026-11-10', ranges: [] },
        { date: '2026-11-04', ranges: [{ start: '10:00', end: '12:00' }] },
      ],
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().overrides).toEqual([
      { date: '2026-11-04', ranges: [{ start: '10:00', end: '12:00' }] },
      { date: '2026-11-10', ranges: [] },
    ])
  })

  it('заменяет исключения с сегодня; прошедшие в теле игнорируются, сохранённые прошедшие не меняются', async () => {
    let now = new Date('2026-11-02T06:00:00Z')
    const app = buildTestApp({ now: () => now })
    await updateSchedule(app, {
      weekly: defaultWeekly,
      overrides: [
        { date: '2026-11-03', ranges: [] },
        { date: '2026-11-10', ranges: [] },
      ],
    })
    // Четверг 5 ноября, 09:00 по Москве
    now = new Date('2026-11-05T06:00:00Z')

    const response = await updateSchedule(app, {
      weekly: defaultWeekly,
      overrides: [
        { date: '2026-11-02', ranges: [] },
        { date: '2026-11-03', ranges: [{ start: '10:00', end: '12:00' }] },
        { date: '2026-11-05', ranges: [] },
        { date: '2026-11-12', ranges: [] },
      ],
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().overrides).toEqual([
      { date: '2026-11-03', ranges: [] },
      { date: '2026-11-05', ranges: [] },
      { date: '2026-11-12', ranges: [] },
    ])
  })

  const range = (start: string, end: string) => ({ start, end })

  it.each([
    [
      'время не кратно 30 минутам',
      { weekly: { ...defaultWeekly, monday: [range('09:15', '18:00')] } },
      'weekly.monday.0.start',
      'Неверный формат',
    ],
    [
      'время после 24:00',
      { weekly: { ...defaultWeekly, friday: [range('20:00', '24:30')] } },
      'weekly.friday.0.end',
      'Неверный формат',
    ],
    [
      'нет дня недели',
      { weekly: { ...defaultWeekly, sunday: undefined } },
      'weekly.sunday',
      'Обязательное поле',
    ],
    [
      'конец равен началу',
      { weekly: { ...defaultWeekly, monday: [range('09:00', '09:00')] } },
      'weekly.monday.0.end',
      'Конец должен быть позже начала',
    ],
    [
      'начало в 24:00',
      { weekly: { ...defaultWeekly, sunday: [range('24:00', '24:00')] } },
      'weekly.sunday.0.end',
      'Конец должен быть позже начала',
    ],
    [
      'конец раньше начала в исключении',
      {
        overrides: [
          { date: '2026-11-04', ranges: [] },
          { date: '2026-11-05', ranges: [] },
          { date: '2026-11-06', ranges: [range('12:00', '10:00')] },
        ],
      },
      'overrides.2.ranges.0.end',
      'Конец должен быть позже начала',
    ],
    [
      'промежутки пересекаются',
      {
        weekly: {
          ...defaultWeekly,
          tuesday: [range('09:00', '12:00'), range('11:00', '13:00')],
        },
      },
      'weekly.tuesday.1.start',
      'Начало должно быть позже конца предыдущего промежутка',
    ],
    [
      'промежутки соприкасаются',
      {
        weekly: {
          ...defaultWeekly,
          tuesday: [range('09:00', '12:00'), range('12:00', '13:00')],
        },
      },
      'weekly.tuesday.1.start',
      'Начало должно быть позже конца предыдущего промежутка',
    ],
    [
      'промежутки не по возрастанию',
      {
        overrides: [
          {
            date: '2026-11-04',
            ranges: [range('14:00', '15:00'), range('09:00', '10:00')],
          },
        ],
      },
      'overrides.0.ranges.1.start',
      'Начало должно быть позже конца предыдущего промежутка',
    ],
    [
      'дата исключения повторяется',
      {
        overrides: [
          { date: '2026-11-04', ranges: [] },
          { date: '2026-11-05', ranges: [] },
          { date: '2026-11-04', ranges: [range('10:00', '12:00')] },
        ],
      },
      'overrides.2.date',
      'Дата повторяется',
    ],
    [
      'лишнее поле',
      { weekly: { ...defaultWeekly, holiday: [] } },
      'weekly.holiday',
      'Неизвестное поле',
    ],
  ])('%s: 400 с путём поля', async (_case, change, field, message) => {
    const app = buildTestApp()

    const response = await updateSchedule(app, {
      weekly: defaultWeekly,
      overrides: [],
      ...change,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      code: 'validation_error',
      message: expect.any(String),
      fieldErrors: [{ field, message }],
    })
  })

  it('отклонённое сохранение ничего не меняет', async () => {
    const app = buildTestApp()

    await updateSchedule(app, {
      weekly: { ...defaultWeekly, monday: [] },
      overrides: [
        { date: '2026-11-04', ranges: [] },
        { date: '2026-11-04', ranges: [] },
      ],
    })

    const { weekly, overrides } = (await getSchedule(app)).json()
    expect(weekly).toEqual(defaultWeekly)
    expect(overrides).toEqual([])
  })
})

describe('PUT /api/admin/schedule при бронированиях', () => {
  it('предстоящее бронирование вне доступного времени: 409 со списком, расписание не меняется', async () => {
    const app = buildTestApp()
    const eventTypeId = await createEventType(app)
    // Вторник 3 ноября, 10:00 по Москве
    const booking = (
      await book(app, eventTypeId, '2026-11-03T07:00:00Z')
    ).json()

    const response = await updateSchedule(app, {
      weekly: defaultWeekly,
      overrides: [{ date: '2026-11-03', ranges: [] }],
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      code: 'schedule_conflicts_with_bookings',
      message: expect.any(String),
      bookings: [booking],
    })
    expect((await getSchedule(app)).json().overrides).toEqual([])
  })

  it('прошедшее бронирование не мешает', async () => {
    let now = new Date('2026-11-02T06:00:00Z')
    const app = buildTestApp({ now: () => now })
    const eventTypeId = await createEventType(app)
    await book(app, eventTypeId, '2026-11-03T07:00:00Z')
    // Среда 4 ноября, 09:00 по Москве
    now = new Date('2026-11-04T06:00:00Z')

    const response = await updateSchedule(app, {
      weekly: { ...defaultWeekly, tuesday: [] },
      overrides: [],
    })

    expect(response.statusCode).toBe(200)
  })
})
