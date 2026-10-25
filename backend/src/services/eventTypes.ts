import { randomUUID } from 'node:crypto'
import type {
  CreateEventType,
  EventType,
  PublicEventType,
  UpdateEventType,
} from '../generated/types.gen.js'
import type { BookingRepository } from '../repositories/bookings.js'
import type {
  EventTypeRecord,
  EventTypeRepository,
} from '../repositories/eventTypes.js'

export interface EventTypeServiceDeps {
  eventTypes: EventTypeRepository
  bookings: BookingRepository
}

export type CreateEventTypeResult =
  { kind: 'created'; eventType: EventType } | { kind: 'title_taken' }

export type UpdateEventTypeResult =
  | { kind: 'updated'; eventType: EventType }
  | { kind: 'not_found' }
  | { kind: 'title_taken' }
  | { kind: 'has_bookings' }

export type DeleteEventTypeResult =
  { kind: 'deleted' } | { kind: 'not_found' } | { kind: 'has_bookings' }

// Названия сравниваются без учёта регистра по правилам русского языка.
// Больше ничего не нормализуем: «ё» и «е» разные буквы, а схлопывание
// пробелов сделало бы одинаковыми названия, которые владелец видит разными
const titleKey = (title: string) => title.toLocaleLowerCase('ru')

// Гостю уходят только поля PublicEventType: схема ответа закрыта, и шаг
// слотов или признак скрытия в ответе были бы ошибкой контракта
export const toPublicEventType = ({
  id,
  title,
  description,
  durationMinutes,
}: EventTypeRecord): PublicEventType => ({
  id,
  title,
  description,
  durationMinutes,
})

// Поля по одному, а не спредом: у типов ввода индексная сигнатура, и в
// записи не должно оказаться ничего, кроме полей типа события
const toRecord = (
  id: string,
  {
    title,
    description,
    durationMinutes,
    slotStepMinutes,
    hidden,
  }: CreateEventType | UpdateEventType,
): EventTypeRecord => ({
  id,
  title,
  description,
  durationMinutes,
  slotStepMinutes,
  hidden,
})

export type EventTypeService = ReturnType<typeof createEventTypeService>

export function createEventTypeService({
  eventTypes,
  bookings,
}: EventTypeServiceDeps) {
  // Неотменённые бронирования, в том числе прошедшие: владелец не должен
  // задним числом менять время звонков, которые состоялись (ADR 0002)
  const hasUncancelledBookings = (id: string) =>
    bookings
      .list()
      .some((booking) => booking.eventTypeId === id && !booking.cancelled)

  const toEventType = (record: EventTypeRecord): EventType => ({
    ...record,
    hasBookings: hasUncancelledBookings(record.id),
  })

  // Скрытые типы тоже участвуют: иначе вернуть скрытый тип гостям было бы
  // нельзя без переименования. Правка с собой не сравнивает (23.2): владелец
  // может сменить регистр в собственном названии
  const isTitleTaken = (title: string, exceptId?: string) => {
    const key = titleKey(title)
    return eventTypes
      .list()
      .some(
        (existing) =>
          existing.id !== exceptId && titleKey(existing.title) === key,
      )
  }

  return {
    // Владелец видит и скрытые: иначе вернуть тип гостям было бы негде (24.2)
    listAll: (): EventType[] => eventTypes.list().map(toEventType),

    // Видимые типы в порядке создания: то, из чего выбирает гость
    listVisible: (): PublicEventType[] =>
      eventTypes
        .list()
        .filter((record) => !record.hidden)
        .map(toPublicEventType),

    // Тип, на который гость может записаться. Скрытый для гостя не существует
    // (4.1): его страница, слоты и бронирование на него отвечают 404
    findVisible: (id: string): EventTypeRecord | undefined => {
      const record = eventTypes.get(id)
      return record && !record.hidden ? record : undefined
    },

    create: (input: CreateEventType): CreateEventTypeResult => {
      if (isTitleTaken(input.title)) {
        return { kind: 'title_taken' }
      }

      // id выдаёт сервер, клиент его не присылает (ADR 0003)
      const record = toRecord(randomUUID(), input)
      eventTypes.insert(record)
      return { kind: 'created', eventType: toEventType(record) }
    },

    // Правка полной моделью (23.1): описания нет во вводе — его нет и у типа
    update: (id: string, input: UpdateEventType): UpdateEventTypeResult => {
      const existing = eventTypes.get(id)
      if (!existing) {
        return { kind: 'not_found' }
      }
      if (isTitleTaken(input.title, id)) {
        return { kind: 'title_taken' }
      }
      if (
        input.durationMinutes !== existing.durationMinutes &&
        hasUncancelledBookings(id)
      ) {
        return { kind: 'has_bookings' }
      }

      const record = toRecord(id, input)
      eventTypes.update(record)
      return { kind: 'updated', eventType: toEventType(record) }
    },

    delete: (id: string): DeleteEventTypeResult => {
      if (!eventTypes.get(id)) {
        return { kind: 'not_found' }
      }
      if (hasUncancelledBookings(id)) {
        return { kind: 'has_bookings' }
      }
      // Отменённые бронирования уходят с типом: конец без типа не вычислить
      for (const booking of bookings.list()) {
        if (booking.eventTypeId === id) {
          bookings.delete(booking.id)
        }
      }
      eventTypes.delete(id)
      return { kind: 'deleted' }
    },
  }
}
