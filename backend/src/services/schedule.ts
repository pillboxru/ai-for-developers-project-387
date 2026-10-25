import type {
  Booking,
  FieldError,
  Schedule,
  TimeRange,
  UpdateSchedule,
} from '../generated/types.gen.js'
import type { ScheduleRepository } from '../repositories/schedule.js'
import type { BookingService } from './bookings.js'
import {
  bookingWindowAt,
  isWithinAvailability,
  todayIn,
  weekdays,
} from './slots.js'

export interface ScheduleServiceDeps {
  schedule: ScheduleRepository
  bookingService: BookingService
  now: () => Date
  timeZone: string
}

export type UpdateScheduleResult =
  | { kind: 'updated'; schedule: Schedule }
  | { kind: 'invalid'; fieldErrors: FieldError[] }
  | { kind: 'conflict'; bookings: Booking[] }

// Формат времени и семь дней проверяет схема контракта. Здесь правила,
// которые схемой не выразить. Сервер ничего не исправляет сам: слитые или
// переставленные промежутки разошлись бы с тем, что видит владелец
function rangeErrors(ranges: TimeRange[], path: string): FieldError[] {
  const errors: FieldError[] = []
  ranges.forEach((range, index) => {
    // 'HH:mm' с ведущими нулями и 24:00 сравниваются как строки
    if (range.end <= range.start) {
      errors.push({
        field: `${path}.${index}.end`,
        message: 'Конец должен быть позже начала',
      })
    }
    const previous = ranges[index - 1]
    // Соприкосновение тоже ошибка: 9–12 и 12–13 — это один промежуток 9–13
    if (previous && range.start <= previous.end) {
      errors.push({
        field: `${path}.${index}.start`,
        message: 'Начало должно быть позже конца предыдущего промежутка',
      })
    }
  })
  return errors
}

function scheduleErrors({ weekly, overrides }: UpdateSchedule): FieldError[] {
  const errors = weekdays.flatMap((day) =>
    rangeErrors(weekly[day], `weekly.${day}`),
  )
  const seen = new Set<string>()
  overrides.forEach((override, index) => {
    if (seen.has(override.date)) {
      errors.push({
        field: `overrides.${index}.date`,
        message: 'Дата повторяется',
      })
    }
    seen.add(override.date)
    errors.push(...rangeErrors(override.ranges, `overrides.${index}.ranges`))
  })
  return errors
}

export type ScheduleService = ReturnType<typeof createScheduleService>

export function createScheduleService({
  schedule,
  bookingService,
  now,
  timeZone,
}: ScheduleServiceDeps) {
  const get = (): Schedule => ({
    ...schedule.get(),
    bookingWindow: bookingWindowAt(now(), timeZone),
  })

  return {
    get,
    update: (input: UpdateSchedule): UpdateScheduleResult => {
      const fieldErrors = scheduleErrors(input)
      if (fieldErrors.length > 0) {
        return { kind: 'invalid', fieldErrors }
      }
      // Даты 'YYYY-MM-DD' сравниваются строкой. Прошедшие исключения уже
      // отработали: владелец их не правит, и черновик со старой копией их
      // не затирает
      const today = todayIn(now(), timeZone).toString()
      const overrides = [
        ...schedule.get().overrides.filter((override) => override.date < today),
        ...input.overrides.filter((override) => override.date >= today),
      ].sort((a, b) => a.date.localeCompare(b.date))
      const record = { weekly: input.weekly, overrides }
      // Неотменённое бронирование целиком входит в доступное время: иначе
      // звонок состоится в часы, которые владелец закрыл
      const conflicts = bookingService
        .listUpcoming()
        .filter(
          (booking) =>
            !booking.cancelled &&
            !isWithinAvailability(record, booking, timeZone),
        )
      if (conflicts.length > 0) {
        return { kind: 'conflict', bookings: conflicts }
      }
      schedule.replace(record)
      return { kind: 'updated', schedule: get() }
    },
  }
}
