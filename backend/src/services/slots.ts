import { Temporal } from 'temporal-polyfill'
import type {
  Booking,
  BookingWindow,
  EventType,
  Slot,
  SlotList,
  TimeOfDay,
  WeeklySchedule,
} from '../generated/types.gen.js'
import type { BookingRepository } from '../repositories/bookings.js'
import type { EventTypeRepository } from '../repositories/eventTypes.js'
import type {
  ScheduleRecord,
  ScheduleRepository,
} from '../repositories/schedule.js'
import { listAllBookings } from './bookings.js'

export interface SlotInput {
  eventType: Pick<EventType, 'durationMinutes' | 'slotStepMinutes'>
  // Доступное время: расписание с исключениями
  availability: ScheduleRecord
  bookings: Pick<Booking, 'start' | 'end' | 'cancelled'>[]
  now: Date
  // IANA-имя пояса владельца
  timeZone: string
}

const windowDays = 14
// Минимальный запас: гостю нужен хотя бы час до начала звонка
const minimumNotice = { hours: 1 }

type Weekday = keyof Pick<
  WeeklySchedule,
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'
>

// Индекс — dayOfWeek из Temporal минус один: 1 — понедельник, 7 — воскресенье
export const weekdays: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

interface Piece {
  start: Temporal.PlainDateTime
  end: Temporal.PlainDateTime
}

// 24:00 — конец дня, то есть 00:00 следующей даты
function atTime(date: Temporal.PlainDate, time: TimeOfDay) {
  return time === '24:00'
    ? date.add({ days: 1 }).toPlainDateTime()
    : date.toPlainDateTime(Temporal.PlainTime.from(time))
}

// Доступное время по часам владельца: куски от даты from до даты to
// включительно
function availablePieces(
  { weekly, overrides }: ScheduleRecord,
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
): Piece[] {
  const overrideRanges = new Map(
    overrides.map((override) => [override.date, override.ranges]),
  )
  const pieces: Piece[] = []
  for (
    let date = from;
    Temporal.PlainDate.compare(date, to) <= 0;
    date = date.add({ days: 1 })
  ) {
    // Исключение заменяет расписание на дату целиком, пустое закрывает её
    const ranges =
      overrideRanges.get(date.toString()) ??
      weekly[weekdays[date.dayOfWeek - 1]]
    for (const range of ranges) {
      const start = atTime(date, range.start)
      const end = atTime(date, range.end)
      // Промежутки одного дня не соприкасаются, поэтому стык бывает только
      // в полночь: 24:00 одной даты и 00:00 следующей — один кусок
      const last = pieces.at(-1)
      if (last && last.end.equals(start)) {
        last.end = end
      } else {
        pieces.push({ start, end })
      }
    }
  }
  return pieces
}

// Входит ли промежуток целиком в доступное время. Куски склеены через
// полночь, поэтому звонок с 23:30 до 00:30 помещается в стык 24:00 и 00:00
export function isWithinAvailability(
  availability: ScheduleRecord,
  interval: Pick<Booking, 'start' | 'end'>,
  timeZone: string,
) {
  const start = Temporal.Instant.from(interval.start)
  const end = Temporal.Instant.from(interval.end)
  const dateOf = (instant: Temporal.Instant) =>
    instant.toZonedDateTimeISO(timeZone).toPlainDate()
  // С предыдущей даты: кусок мог начаться до полуночи
  return availablePieces(
    availability,
    dateOf(start).subtract({ days: 1 }),
    dateOf(end),
  ).some(
    (piece) =>
      Temporal.Instant.compare(
        piece.start.toZonedDateTime(timeZone).toInstant(),
        start,
      ) <= 0 &&
      Temporal.Instant.compare(
        end,
        piece.end.toZonedDateTime(timeZone).toInstant(),
      ) <= 0,
  )
}

// Сегодняшняя дата по часам владельца
export function todayIn(now: Date, timeZone: string) {
  return Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
}

export function bookingWindowAt(now: Date, timeZone: string): BookingWindow {
  const today = todayIn(now, timeZone)
  // PlainDate.toZonedDateTime без времени даёт начало дня, а не 00:00: в
  // некоторых поясах переход на летнее время выпадает на полночь, и 00:00
  // в этот день не существует
  return {
    start: today.toZonedDateTime(timeZone).toInstant().toString(),
    end: today
      .add({ days: windowDays })
      .toZonedDateTime(timeZone)
      .toInstant()
      .toString(),
  }
}

export function computeSlots({
  eventType,
  availability,
  bookings,
  now,
  timeZone,
}: SlotInput): SlotList {
  const nowInstant = Temporal.Instant.fromEpochMilliseconds(now.getTime())
  const earliestStart = nowInstant.add(minimumNotice)
  const today = todayIn(now, timeZone)

  // Бронирования любых типов; отменённые время не занимают
  const busy = bookings
    .filter((booking) => !booking.cancelled)
    .map((booking) => ({
      start: Temporal.Instant.from(booking.start),
      end: Temporal.Instant.from(booking.end),
    }))

  const duration = { minutes: eventType.durationMinutes }
  const step = { minutes: eventType.slotStepMinutes }
  const slots: Slot[] = []
  // С предыдущей даты: кусок, начатый до окна записи, задаёт сетку и в
  // первый день окна. Слоты до начала окна отсечёт минимальный запас.
  // По последнюю дату окна: её куски кончаются не позже 00:00 следующей
  // даты, то есть конца окна, и слот за окно не выйдет
  for (const piece of availablePieces(
    availability,
    today.subtract({ days: 1 }),
    today.add({ days: windowDays - 1 }),
  )) {
    // Сетка строится по часам владельца: владелец задаёт расписание в них,
    // и переход на летнее время не должен сдвигать начала слотов
    for (
      let start = piece.start;
      Temporal.PlainDateTime.compare(start.add(duration), piece.end) <= 0;
      start = start.add(step)
    ) {
      // Время из повторяющегося часа при переводе назад берётся по первому
      // смещению (disambiguation 'compatible' по умолчанию)
      const zonedStart = start.toZonedDateTime(timeZone)
      const zonedEnd = zonedStart.add(duration)
      // Несуществующее время 'compatible' сдвигает вперёд, поэтому начало в
      // пропущенном при переводе вперёд часе не совпадает с сеткой
      if (!zonedStart.toPlainDateTime().equals(start)) {
        continue
      }
      // Перевод вперёд строго внутри звонка: слот пересекает несуществующий
      // час. Слот, который кончается ровно в момент перевода, его не задевает
      const transition = zonedStart.getTimeZoneTransition('next')
      if (
        transition &&
        transition.offsetNanoseconds > zonedStart.offsetNanoseconds &&
        Temporal.ZonedDateTime.compare(transition, zonedEnd) < 0
      ) {
        continue
      }
      const slotStart = zonedStart.toInstant()
      const slotEnd = zonedEnd.toInstant()
      // Полуоткрытые промежутки: бронирования могут стоять впритык
      const overlapsBooking = busy.some(
        (booking) =>
          Temporal.Instant.compare(slotStart, booking.end) < 0 &&
          Temporal.Instant.compare(booking.start, slotEnd) < 0,
      )
      if (
        Temporal.Instant.compare(slotStart, earliestStart) < 0 ||
        overlapsBooking
      ) {
        continue
      }
      slots.push({ start: slotStart.toString(), end: slotEnd.toString() })
    }
  }

  return { bookingWindow: bookingWindowAt(now, timeZone), slots }
}

export interface SlotServiceDeps {
  schedule: ScheduleRepository
  bookings: BookingRepository
  // Конец бронирования считается по длительности его типа (ADR 0002)
  eventTypes: EventTypeRepository
  now: () => Date
  timeZone: string
}

export type SlotService = ReturnType<typeof createSlotService>

export function createSlotService({
  schedule,
  bookings,
  eventTypes,
  now,
  timeZone,
}: SlotServiceDeps) {
  return {
    listSlots: (eventType: SlotInput['eventType']): SlotList =>
      computeSlots({
        eventType,
        availability: schedule.get(),
        // Бронирования всех типов: неотменённые не пересекаются, даже если у
        // них разные типы событий
        bookings: listAllBookings(bookings, eventTypes),
        now: now(),
        timeZone,
      }),
  }
}
