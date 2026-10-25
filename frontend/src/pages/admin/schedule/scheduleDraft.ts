import type {
  DateOverride,
  Schedule,
  TimeOfDay,
  TimeRange,
  UpdateSchedule,
  WeeklySchedule,
} from '../../../api/generated/types.gen.ts'
import { noonUtcOf } from '../../../format/dateTime.ts'

// Матрица редактора: получасы суток по часам владельца
export const cellMinutes = 30
export const cellsPerDay = (24 * 60) / cellMinutes

export type Weekday = keyof Pick<
  WeeklySchedule,
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'
>

// С понедельника: так неделю считает владелец (30.1)
export const weekdays: { key: Weekday; short: string; long: string }[] = [
  { key: 'monday', short: 'Пн', long: 'Понедельник' },
  { key: 'tuesday', short: 'Вт', long: 'Вторник' },
  { key: 'wednesday', short: 'Ср', long: 'Среда' },
  { key: 'thursday', short: 'Чт', long: 'Четверг' },
  { key: 'friday', short: 'Пт', long: 'Пятница' },
  { key: 'saturday', short: 'Сб', long: 'Суббота' },
  { key: 'sunday', short: 'Вс', long: 'Воскресенье' },
]

// Открыт ли каждый получас дня: cellsPerDay значений с 00:00
export type DayCells = boolean[]

// Черновик редактора. Неделя хранится ячейками: протягивание мышью меняет
// ячейки, а промежутки из них собираются только при сохранении, поэтому
// соседние ячейки сами сливаются в один промежуток. Исключения хранятся в
// виде контракта, по возрастанию даты, как их отдаёт сервер
export interface ScheduleDraft {
  // Индекс — день недели из weekdays, 0 — понедельник
  weekly: DayCells[]
  overrides: DateOverride[]
}

// 'HH:mm' → минуты от начала суток; 24:00 — 1440
export function minutesOf(time: TimeOfDay) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Минуты от начала суток → 'HH:mm'; 1440 — 24:00
export function timeOf(minutes: number): TimeOfDay {
  const hours = Math.floor(minutes / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function rangesToCells(ranges: TimeRange[]): DayCells {
  const cells: DayCells = Array.from({ length: cellsPerDay }, () => false)
  for (const range of ranges) {
    for (
      let cell = minutesOf(range.start) / cellMinutes;
      cell < minutesOf(range.end) / cellMinutes;
      cell++
    ) {
      cells[cell] = true
    }
  }
  return cells
}

// Подряд открытые ячейки — один промежуток: сервер не принимает
// соприкасающиеся промежутки
export function cellsToRanges(cells: DayCells): TimeRange[] {
  const ranges: TimeRange[] = []
  let start: number | null = null
  cells.forEach((open, cell) => {
    if (open && start === null) {
      start = cell
    }
    if (!open && start !== null) {
      ranges.push({
        start: timeOf(start * cellMinutes),
        end: timeOf(cell * cellMinutes),
      })
      start = null
    }
  })
  if (start !== null) {
    ranges.push({ start: timeOf(start * cellMinutes), end: '24:00' })
  }
  return ranges
}

export function draftFromSchedule({
  weekly,
  overrides,
}: Pick<Schedule, 'weekly' | 'overrides'>): ScheduleDraft {
  return {
    weekly: weekdays.map(({ key }) => rangesToCells(weekly[key])),
    overrides,
  }
}

// Прошедшие исключения уходят как пришли: сервер их игнорирует
export function toUpdateSchedule(draft: ScheduleDraft): UpdateSchedule {
  const weekly: WeeklySchedule = {
    monday: cellsToRanges(draft.weekly[0]),
    tuesday: cellsToRanges(draft.weekly[1]),
    wednesday: cellsToRanges(draft.weekly[2]),
    thursday: cellsToRanges(draft.weekly[3]),
    friday: cellsToRanges(draft.weekly[4]),
    saturday: cellsToRanges(draft.weekly[5]),
    sunday: cellsToRanges(draft.weekly[6]),
  }
  return { weekly, overrides: draft.overrides }
}

export function sameDraft(a: ScheduleDraft, b: ScheduleDraft) {
  return (
    JSON.stringify(toUpdateSchedule(a)) === JSON.stringify(toUpdateSchedule(b))
  )
}

// День недели даты 'YYYY-MM-DD', 0 — понедельник
export function weekdayOf(dateKey: string) {
  return (noonUtcOf(dateKey).getUTCDay() + 6) % 7
}

// Доступное время на дату: исключение заменяет расписание целиком
export function availabilityOn(
  draft: ScheduleDraft,
  dateKey: string,
): TimeRange[] {
  const override = draft.overrides.find(
    (candidate) => candidate.date === dateKey,
  )
  return override
    ? override.ranges
    : cellsToRanges(draft.weekly[weekdayOf(dateKey)])
}

// Одни и те же часы на каждую из дат: прежние исключения на этих датах
// заменяются. Порядок по дате, как у сервера
export function withOverrides(
  overrides: DateOverride[],
  dates: string[],
  ranges: TimeRange[],
): DateOverride[] {
  return [
    ...overrides.filter((override) => !dates.includes(override.date)),
    ...dates.map((date) => ({ date, ranges })),
  ].sort((a, b) => a.date.localeCompare(b.date))
}
