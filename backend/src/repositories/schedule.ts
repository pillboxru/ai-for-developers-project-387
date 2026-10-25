import type { UpdateSchedule, TimeRange } from '../generated/types.gen.js'

// Расписание и исключения в том виде, в каком их сохраняет владелец. Окно
// записи не хранится: оно зависит от текущего момента
export type ScheduleRecord = Pick<UpdateSchedule, 'weekly' | 'overrides'>

export interface ScheduleRepository {
  get(): ScheduleRecord
  // Заменяет расписание и исключения целиком: сохранение атомарно
  replace(record: ScheduleRecord): void
}

const workday = (): TimeRange[] => [{ start: '09:00', end: '18:00' }]

// Без расписания по умолчанию у гостя не было бы слотов сразу после
// создания первого типа события (ADR 0004)
const defaultSchedule = (): ScheduleRecord => ({
  weekly: {
    monday: workday(),
    tuesday: workday(),
    wednesday: workday(),
    thursday: workday(),
    friday: workday(),
    saturday: [],
    sunday: [],
  },
  overrides: [],
})

// Хранилище в памяти процесса (ADR 0001): одно расписание на приложение
export function createScheduleRepository(): ScheduleRepository {
  let schedule = defaultSchedule()

  return {
    get: () => schedule,
    replace: (record) => {
      schedule = record
    },
  }
}
