import type { QueryClient } from '@tanstack/react-query'
import {
  getScheduleOptions,
  getScheduleQueryKey,
  updateScheduleMutation,
} from './generated/@tanstack/react-query.gen.ts'
import type { Schedule } from './generated/types.gen.ts'

// Расписание, все исключения по возрастанию даты и окно записи по часам
// владельца
export const scheduleQuery = () => getScheduleOptions()

// Расписание и исключения сохраняются разом. 409
// schedule_conflicts_with_bookings несёт мешающие бронирования
export const updateScheduleMutationOptions = () => updateScheduleMutation()

// Ответ сохранения — уже новое расписание: перечитывать его незачем
export function setSchedule(queryClient: QueryClient, schedule: Schedule) {
  queryClient.setQueryData(getScheduleQueryKey(), schedule)
}
