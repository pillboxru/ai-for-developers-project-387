import type { EventType } from '../generated/types.gen.js'

// hasBookings не хранится: это производное от бронирований, его считает
// сервис. Pick, а не Omit: у моделей контракта есть индексная сигнатура,
// и Omit по ней теряет все именованные поля
export type EventTypeRecord = Pick<
  EventType,
  | 'id'
  | 'title'
  | 'description'
  | 'durationMinutes'
  | 'slotStepMinutes'
  | 'hidden'
>

export interface EventTypeRepository {
  // В порядке создания
  list(): EventTypeRecord[]
  get(id: string): EventTypeRecord | undefined
  insert(record: EventTypeRecord): void
  // Заменяет запись с тем же id, место в порядке создания сохраняется
  update(record: EventTypeRecord): void
  delete(id: string): void
}

// Хранилище в памяти процесса (ADR 0001). Map обходится в порядке вставки,
// это и есть порядок создания
export function createEventTypeRepository(): EventTypeRepository {
  const records = new Map<string, EventTypeRecord>()

  return {
    list: () => [...records.values()],
    get: (id) => records.get(id),
    insert: (record) => {
      records.set(record.id, record)
    },
    // set по существующему ключу не двигает его в порядке обхода Map
    update: (record) => {
      records.set(record.id, record)
    },
    delete: (id) => {
      records.delete(id)
    },
  }
}
