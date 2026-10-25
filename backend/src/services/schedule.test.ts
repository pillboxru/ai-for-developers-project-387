import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type {
  Minutes15,
  UpdateSchedule,
  WeeklySchedule,
} from '../generated/types.gen.js'
import { createBookingRepository } from '../repositories/bookings.js'
import { createEventTypeRepository } from '../repositories/eventTypes.js'
import { createScheduleRepository } from '../repositories/schedule.js'
import { createBookingService } from './bookings.js'
import { createEventTypeService } from './eventTypes.js'
import { createScheduleService } from './schedule.js'
import { createSlotService } from './slots.js'

const workday = [{ start: '09:00', end: '18:00' }]

const defaultWeekly: WeeklySchedule = {
  monday: workday,
  tuesday: workday,
  wednesday: workday,
  thursday: workday,
  friday: workday,
  saturday: [],
  sunday: [],
}

// Сервисы с общим хранилищем, как в buildApp. Часы можно переставить:
// бронирование создаётся на слот, а проверяется уже в другой момент.
// По умолчанию понедельник 2 ноября, 09:00 по Москве
function services() {
  const clock = { now: new Date('2026-11-02T06:00:00Z') }
  const now = () => clock.now
  const timeZone = 'Europe/Moscow'
  const eventTypes = createEventTypeRepository()
  const bookings = createBookingRepository()
  const schedule = createScheduleRepository()
  const eventTypeService = createEventTypeService({ eventTypes, bookings })
  const slotService = createSlotService({
    schedule,
    bookings,
    eventTypes,
    now,
    timeZone,
  })
  const bookingService = createBookingService({
    bookings,
    eventTypes,
    eventTypeService,
    slotService,
    now,
  })
  const scheduleService = createScheduleService({
    schedule,
    bookingService,
    now,
    timeZone,
  })

  const createEventType = (durationMinutes: Minutes15) => {
    const created = eventTypeService.create({
      title: `Звонок ${eventTypes.list().length + 1}`,
      durationMinutes,
      slotStepMinutes: 30,
      hidden: false,
    })
    if (created.kind !== 'created') {
      throw new Error('тип события не создан')
    }
    return created.eventType.id
  }

  const book = (start: string, durationMinutes: Minutes15 = 30) => {
    const booked = bookingService.create(createEventType(durationMinutes), {
      start,
      name: 'Иван Петров',
      email: 'ivan@example.com',
    })
    if (booked.kind !== 'created') {
      throw new Error(`слот ${start} не забронирован`)
    }
    return booked.booking
  }

  // Отмены владельцем в сервисе ещё нет (#51): отменённое бронирование
  // кладётся прямо в хранилище
  const bookCancelled = (start: string) =>
    bookings.insert({
      id: randomUUID(),
      eventTypeId: createEventType(30),
      start,
      name: 'Иван Петров',
      email: 'ivan@example.com',
      cancelled: true,
    })

  return { clock, scheduleService, book, bookCancelled }
}

const weekly = (change: Partial<WeeklySchedule>): UpdateSchedule => ({
  weekly: { ...defaultWeekly, ...change },
  overrides: [],
})

describe('сохранение расписания при бронированиях', () => {
  // Вторник 3 ноября, 10:00 по Москве
  const tuesdayAt10 = '2026-11-03T07:00:00Z'

  it('закрытый день с предстоящим бронированием не сохраняется', () => {
    const { scheduleService, book } = services()
    const booking = book(tuesdayAt10)

    const result = scheduleService.update(weekly({ tuesday: [] }))

    expect(result).toEqual({ kind: 'conflict', bookings: [booking] })
    expect(scheduleService.get().weekly).toEqual(defaultWeekly)
  })

  it('бронирование, которое выходит за доступное время частично, мешает', () => {
    const { scheduleService, book } = services()
    // 10:00–11:00, а доступно до 10:30
    const booking = book(tuesdayAt10, 60)

    const result = scheduleService.update(
      weekly({ tuesday: [{ start: '09:00', end: '10:30' }] }),
    )

    expect(result).toEqual({ kind: 'conflict', bookings: [booking] })
  })

  it('бронирование, которое целиком в доступном времени, не мешает', () => {
    const { scheduleService, book } = services()
    book(tuesdayAt10, 60)

    const result = scheduleService.update(
      weekly({ tuesday: [{ start: '10:00', end: '11:00' }] }),
    )

    expect(result.kind).toBe('updated')
  })

  it('исключение закрывает дату с бронированием — конфликт', () => {
    const { scheduleService, book } = services()
    const booking = book(tuesdayAt10)

    const result = scheduleService.update({
      weekly: defaultWeekly,
      overrides: [{ date: '2026-11-03', ranges: [] }],
    })

    expect(result).toEqual({ kind: 'conflict', bookings: [booking] })
  })

  it('исключение оставляет время бронирования, хотя день недели закрыт', () => {
    const { scheduleService, book } = services()
    book(tuesdayAt10)

    const result = scheduleService.update({
      weekly: { ...defaultWeekly, tuesday: [] },
      overrides: [
        { date: '2026-11-03', ranges: [{ start: '10:00', end: '10:30' }] },
      ],
    })

    expect(result.kind).toBe('updated')
  })

  it('в списке конфликта только мешающие бронирования, по началу', () => {
    const { scheduleService, book } = services()
    // Среда 4 ноября 10:00 и вторник 3 ноября 10:00 и 15:00 по Москве
    const wednesday = book('2026-11-04T07:00:00Z')
    const tuesdayMorning = book(tuesdayAt10)
    book('2026-11-03T12:00:00Z')

    const result = scheduleService.update(
      weekly({
        tuesday: [{ start: '12:00', end: '18:00' }],
        wednesday: [],
      }),
    )

    expect(result).toEqual({
      kind: 'conflict',
      bookings: [tuesdayMorning, wednesday],
    })
  })

  it('отменённое бронирование не мешает', () => {
    const { scheduleService, bookCancelled } = services()
    bookCancelled(tuesdayAt10)

    const result = scheduleService.update(weekly({ tuesday: [] }))

    expect(result.kind).toBe('updated')
  })

  it('прошедшее бронирование не мешает', () => {
    const { scheduleService, book, clock } = services()
    book(tuesdayAt10)
    // Среда 4 ноября, 09:00 по Москве
    clock.now = new Date('2026-11-04T06:00:00Z')

    const result = scheduleService.update(weekly({ tuesday: [] }))

    expect(result.kind).toBe('updated')
  })

  it('идущий звонок ещё предстоящий и мешает', () => {
    const { scheduleService, book, clock } = services()
    const booking = book(tuesdayAt10, 60)
    // Вторник 3 ноября, 10:30 по Москве: звонок идёт
    clock.now = new Date('2026-11-03T07:30:00Z')

    const result = scheduleService.update(weekly({ tuesday: [] }))

    expect(result).toEqual({ kind: 'conflict', bookings: [booking] })
  })

  it('бронирование через полночь входит в стык 24:00 и 00:00', () => {
    const { scheduleService, book } = services()
    scheduleService.update(
      weekly({
        saturday: [{ start: '20:00', end: '24:00' }],
        sunday: [{ start: '00:00', end: '02:00' }],
      }),
    )
    // Суббота 7 ноября, 23:30–00:30 по Москве
    const booking = book('2026-11-07T20:30:00Z', 60)

    const kept = scheduleService.update(
      weekly({
        saturday: [{ start: '22:00', end: '24:00' }],
        sunday: [{ start: '00:00', end: '01:00' }],
      }),
    )
    const cut = scheduleService.update(
      weekly({
        saturday: [{ start: '22:00', end: '24:00' }],
        sunday: [{ start: '01:00', end: '02:00' }],
      }),
    )

    expect(kept.kind).toBe('updated')
    expect(cut).toEqual({ kind: 'conflict', bookings: [booking] })
  })
})
