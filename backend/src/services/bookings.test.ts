import { describe, expect, it } from 'vitest'
import type { CreateEventType } from '../generated/types.gen.js'
import { createBookingRepository } from '../repositories/bookings.js'
import { createEventTypeRepository } from '../repositories/eventTypes.js'
import { createScheduleRepository } from '../repositories/schedule.js'
import { createBookingService } from './bookings.js'
import { createEventTypeService } from './eventTypes.js'
import { createSlotService } from './slots.js'

// Сервисы с общим хранилищем, как в buildApp. Понедельник 2 ноября, 09:00
// по Москве; расписание по умолчанию пн–пт 9:00–18:00
function services(now = () => new Date('2026-11-02T06:00:00Z')) {
  const eventTypes = createEventTypeRepository()
  const bookings = createBookingRepository()
  const eventTypeService = createEventTypeService({ eventTypes, bookings })
  const slotService = createSlotService({
    schedule: createScheduleRepository(),
    bookings,
    eventTypes,
    now,
    timeZone: 'Europe/Moscow',
  })
  const bookingService = createBookingService({
    bookings,
    eventTypes,
    eventTypeService,
    slotService,
    now,
  })
  return { eventTypeService, slotService, bookingService }
}

const input: CreateEventType = {
  title: 'Консультация',
  durationMinutes: 30,
  slotStepMinutes: 30,
  hidden: false,
}

describe('смена шага слотов', () => {
  it('существующее бронирование остаётся, даже если не попадает на новую сетку', () => {
    const { eventTypeService, slotService, bookingService } = services()
    const created = eventTypeService.create(input)
    if (created.kind !== 'created') {
      throw new Error('тип события не создан')
    }
    const { id } = created.eventType
    // Вторник 3 ноября, 10:00–10:30 по Москве
    const booked = bookingService.create(id, {
      start: '2026-11-03T07:00:00Z',
      name: 'Иван Петров',
      email: 'ivan@example.com',
    })
    expect(booked.kind).toBe('created')

    // Новая сетка вторника: 9:00, 9:45, 10:30… — 10:00 на неё не попадает
    const updated = eventTypeService.update(id, {
      ...input,
      slotStepMinutes: 45,
    })
    expect(updated.kind).toBe('updated')

    const starts = slotService
      .listSlots({ durationMinutes: 30, slotStepMinutes: 45 })
      .slots.map((slot) => slot.start)
    // 9:45–10:15 пересекается с бронированием, значит оно на месте
    expect(starts).not.toContain('2026-11-03T06:45:00Z')
    expect(starts).toContain('2026-11-03T06:00:00Z')
    expect(starts).toContain('2026-11-03T07:30:00Z')
  })
})

describe('отмена бронирования', () => {
  it('освобождает время, но слот возвращается, только если проходит минимальный запас', () => {
    let now = new Date('2026-11-02T06:00:00Z')
    const { eventTypeService, slotService, bookingService } = services(
      () => now,
    )
    const created = eventTypeService.create(input)
    if (created.kind !== 'created') {
      throw new Error('тип события не создан')
    }
    const { id } = created.eventType
    const bookAt = (start: string) => {
      const booked = bookingService.create(id, {
        start,
        name: 'Иван Петров',
        email: 'ivan@example.com',
      })
      if (booked.kind !== 'created') {
        throw new Error(`время ${start} не забронировано`)
      }
      return booked.booking.id
    }
    // Понедельник 2 ноября, 10:30 и 11:30 по Москве
    const soon = bookAt('2026-11-02T07:30:00Z')
    const later = bookAt('2026-11-02T08:30:00Z')

    // 09:45: до 10:30 меньше часа, до 11:30 — больше
    now = new Date('2026-11-02T06:45:00Z')
    expect(bookingService.cancel(soon).kind).toBe('cancelled')
    expect(bookingService.cancel(later).kind).toBe('cancelled')

    const starts = slotService.listSlots(input).slots.map((slot) => slot.start)
    expect(starts).not.toContain('2026-11-02T07:30:00Z')
    expect(starts).toContain('2026-11-02T08:30:00Z')
  })
})
