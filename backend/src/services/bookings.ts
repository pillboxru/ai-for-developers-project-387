import { randomUUID } from 'node:crypto'
import { Temporal } from 'temporal-polyfill'
import type { Booking, CreateBooking } from '../generated/types.gen.js'
import type {
  BookingRecord,
  BookingRepository,
} from '../repositories/bookings.js'
import type {
  EventTypeRecord,
  EventTypeRepository,
} from '../repositories/eventTypes.js'
import type { EventTypeService } from './eventTypes.js'
import type { SlotService } from './slots.js'

export interface BookingServiceDeps {
  bookings: BookingRepository
  // Репозиторий, а не сервис типов: владельцу нужны и скрытые типы
  eventTypes: EventTypeRepository
  eventTypeService: EventTypeService
  slotService: SlotService
  now: () => Date
}

export type CreateBookingResult =
  | { kind: 'created'; booking: Booking }
  | { kind: 'not_found' }
  | { kind: 'slot_unavailable' }

export type CancelBookingResult =
  | { kind: 'cancelled'; booking: Booking }
  | { kind: 'not_found' }
  | { kind: 'booking_ended' }

// Конец не хранится: начало плюс длительность типа (ADR 0002)
export function toBooking(
  record: BookingRecord,
  eventType: EventTypeRecord,
): Booking {
  return {
    id: record.id,
    eventType: {
      id: eventType.id,
      title: eventType.title,
      hidden: eventType.hidden,
    },
    start: record.start,
    end: Temporal.Instant.from(record.start)
      .add({ minutes: eventType.durationMinutes })
      .toString(),
    name: record.name,
    email: record.email,
    comment: record.comment,
    cancelled: record.cancelled,
  }
}

function eventTypeOf(
  record: BookingRecord,
  eventTypes: EventTypeRepository,
): EventTypeRecord {
  const eventType = eventTypes.get(record.eventTypeId)
  // Тип с бронированиями не удаляется: без него конец бронирования не из
  // чего вычислить (ADR 0002)
  if (!eventType) {
    throw new Error(
      `Бронирование ${record.id} ссылается на несуществующий тип события ${record.eventTypeId}`,
    )
  }
  return eventType
}

// Бронирования всех типов в порядке создания, с концом по длительности типа
export function listAllBookings(
  bookings: BookingRepository,
  eventTypes: EventTypeRepository,
): Booking[] {
  return bookings
    .list()
    .map((record) => toBooking(record, eventTypeOf(record, eventTypes)))
}

// Предстоящее: звонок ещё не закончился, идущий сейчас тоже. Конец не входит
function isUpcoming(booking: Booking, now: Date): boolean {
  return (
    Temporal.Instant.compare(
      Temporal.Instant.from(booking.end),
      Temporal.Instant.fromEpochMilliseconds(now.getTime()),
    ) > 0
  )
}

export type BookingService = ReturnType<typeof createBookingService>

export function createBookingService({
  bookings,
  eventTypes,
  eventTypeService,
  slotService,
  now,
}: BookingServiceDeps) {
  return {
    // Предстоящие: звонок ещё не закончился, идущий сейчас тоже здесь.
    // Отменённые и бронирования скрытых типов остаются, владелец видит всё.
    // Сортировка устойчивая: на одном начале отменённое стоит раньше
    // созданного после него
    listUpcoming: (): Booking[] => {
      const current = now()
      return listAllBookings(bookings, eventTypes)
        .filter((booking) => isUpcoming(booking, current))
        .sort((a, b) =>
          Temporal.Instant.compare(
            Temporal.Instant.from(a.start),
            Temporal.Instant.from(b.start),
          ),
        )
    },

    // Принимается только начало одного из слотов, которые та же функция
    // вычисляет сейчас. Причину отказа гостю не различаем (14.1): занято,
    // прошёл запас, закрыто владельцем или не на сетке — исход один
    create: (
      eventTypeId: string,
      input: CreateBooking,
    ): CreateBookingResult => {
      const eventType = eventTypeService.findVisible(eventTypeId)
      if (!eventType) {
        return { kind: 'not_found' }
      }
      // Сравниваются моменты, а не строки: гость может прислать то же время
      // со смещением или миллисекундами
      const start = Temporal.Instant.from(input.start)
      const slot = slotService
        .listSlots(eventType)
        .slots.find((candidate) =>
          Temporal.Instant.from(candidate.start).equals(start),
        )
      if (!slot) {
        return { kind: 'slot_unavailable' }
      }

      const record: BookingRecord = {
        id: randomUUID(),
        eventTypeId: eventType.id,
        // В записи слота: моменты в UTC с Z, как в списке слотов
        start: slot.start,
        name: input.name,
        email: input.email,
        comment: input.comment,
        cancelled: false,
      }
      bookings.insert(record)
      return { kind: 'created', booking: toBooking(record, eventType) }
    },

    cancel: (bookingId: string): CancelBookingResult => {
      const record = bookings.get(bookingId)
      if (!record) {
        return { kind: 'not_found' }
      }
      const eventType = eventTypeOf(record, eventTypes)
      // Повтор (двойной щелчок, второе окно) отвечает уже отменённым, даже
      // если звонок успел закончиться: отмена состоялась. Вернуть её нельзя
      if (record.cancelled) {
        return { kind: 'cancelled', booking: toBooking(record, eventType) }
      }
      if (!isUpcoming(toBooking(record, eventType), now())) {
        return { kind: 'booking_ended' }
      }
      const cancelled: BookingRecord = { ...record, cancelled: true }
      bookings.update(cancelled)
      return { kind: 'cancelled', booking: toBooking(cancelled, eventType) }
    },
  }
}
