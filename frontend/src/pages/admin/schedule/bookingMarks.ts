import type {
  Booking,
  BookingWindow,
} from '../../../api/generated/types.gen.ts'
import { wallTimeIn } from '../../../format/dateTime.ts'
import {
  availabilityOn,
  minutesOf,
  weekdayOf,
  type ScheduleDraft,
} from './scheduleDraft.ts'

const dayMinutes = 24 * 60
const dayMs = 24 * 60 * 60 * 1000

// Номер даты 'YYYY-MM-DD' в днях от 1970-01-01 и обратно: так соседние
// даты складываются в одну шкалу минут
const dayNumber = (dateKey: string) =>
  Date.parse(`${dateKey}T00:00:00Z`) / dayMs
const dateKeyOf = (day: number) =>
  new Date(day * dayMs).toISOString().slice(0, 10)

// Начало и конец бронирования в минутах настенных часов владельца от
// 1970-01-01: звонок может перейти через полночь
function wallSpan(booking: Booking, timeZone: string) {
  const at = (instant: string) => {
    const { date, minutes } = wallTimeIn(instant, timeZone)
    return dayNumber(date) * dayMinutes + minutes
  }
  return { start: at(booking.start), end: at(booking.end) }
}

// Входит ли бронирование целиком в доступное время черновика. Окончательно
// решает сервер (409), здесь — подсказка до сохранения. Промежутки соседних
// дат склеиваются в полночь, как на сервере
function isWithinDraft(
  draft: ScheduleDraft,
  booking: Booking,
  timeZone: string,
) {
  const span = wallSpan(booking, timeZone)
  const firstDay = Math.floor(span.start / dayMinutes) - 1
  const lastDay = Math.floor(span.end / dayMinutes)
  const pieces: { start: number; end: number }[] = []
  for (let day = firstDay; day <= lastDay; day++) {
    for (const range of availabilityOn(draft, dateKeyOf(day))) {
      const start = day * dayMinutes + minutesOf(range.start)
      const end = day * dayMinutes + minutesOf(range.end)
      const last = pieces.at(-1)
      if (last && last.end === start) {
        last.end = end
      } else {
        pieces.push({ start, end })
      }
    }
  }
  return pieces.some(
    (piece) => piece.start <= span.start && span.end <= piece.end,
  )
}

// Неотменённые бронирования, которые черновик оставил бы вне доступного
// времени: с ними сохранить нельзя (33.2)
export function outsideBookings(
  draft: ScheduleDraft,
  bookings: Booking[],
  timeZone: string,
) {
  return bookings.filter(
    (booking) => !booking.cancelled && !isWithinDraft(draft, booking, timeZone),
  )
}

// Полоска бронирования в матрице недели: день недели и минуты суток
export interface BookingMark {
  booking: Booking
  // 0 — понедельник
  day: number
  from: number
  to: number
  outside: boolean
}

// Матрица показывает неделю, а не даты: на неё ложатся бронирования окна
// записи с дат, где действует расписание. Бронирование на дате с
// исключением от недели не зависит (30.4)
export function bookingMarks(
  draft: ScheduleDraft,
  bookings: Booking[],
  bookingWindow: BookingWindow,
  timeZone: string,
): BookingMark[] {
  const windowStart = Date.parse(bookingWindow.start)
  const windowEnd = Date.parse(bookingWindow.end)
  const outside = new Set(
    outsideBookings(draft, bookings, timeZone).map((booking) => booking.id),
  )
  return bookings.flatMap((booking) => {
    const start = Date.parse(booking.start)
    if (booking.cancelled || start < windowStart || start >= windowEnd) {
      return []
    }
    const { date, minutes } = wallTimeIn(booking.start, timeZone)
    if (draft.overrides.some((override) => override.date === date)) {
      return []
    }
    const span = wallSpan(booking, timeZone)
    return [
      {
        booking,
        day: weekdayOf(date),
        from: minutes,
        // Хвост после полуночи в матрице не рисуется: он на другом дне
        to: Math.min(minutes + span.end - span.start, dayMinutes),
        outside: outside.has(booking.id),
      },
    ]
  })
}
