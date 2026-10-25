import type { Booking, Uuid } from '../generated/types.gen.js'

// Бронирование хранит тип ссылкой и не копирует длительность: конец
// считается по типу (ADR 0002). Pick, а не Omit: у моделей контракта есть
// индексная сигнатура, и Omit по ней теряет все именованные поля
export type BookingRecord = Pick<
  Booking,
  'id' | 'start' | 'name' | 'email' | 'comment' | 'cancelled'
> & { eventTypeId: Uuid }

export interface BookingRepository {
  // В порядке создания
  list(): BookingRecord[]
  get(id: Uuid): BookingRecord | undefined
  insert(record: BookingRecord): void
  // Заменяет запись с тем же id, место в порядке создания сохраняется.
  // Записи с таким id нет — бросает
  update(record: BookingRecord): void
  delete(id: Uuid): void
}

// Хранилище в памяти процесса (ADR 0001)
export function createBookingRepository(): BookingRepository {
  const records: BookingRecord[] = []

  return {
    list: () => [...records],
    get: (id) => records.find((record) => record.id === id),
    insert: (record) => {
      records.push(record)
    },
    update: (record) => {
      const index = records.findIndex(({ id }) => id === record.id)
      // Сервис обновляет только найденное бронирование, так что промах —
      // ошибка в коде, а records[-1] спрятал бы её мусорным свойством
      if (index === -1) {
        throw new Error(`Бронирования ${record.id} нет в хранилище`)
      }
      records[index] = record
    },
    delete: (id) => {
      const index = records.findIndex((record) => record.id === id)
      if (index !== -1) {
        records.splice(index, 1)
      }
    },
  }
}
