import type { QueryClient } from '@tanstack/react-query'
import {
  listSlotsOptions,
  listSlotsQueryKey,
} from './generated/@tanstack/react-query.gen.ts'

// Окно записи и слоты типа события на всё окно, моменты в UTC. По дням
// гостя их раскладывает фронтенд: пояс гостя сервер не знает
export const slotsQuery = (eventTypeId: string) =>
  listSlotsOptions({ path: { eventTypeId } })

// После бронирования и отказа в нём: занятое время уходит из слотов
export function invalidateSlots(queryClient: QueryClient, eventTypeId: string) {
  return queryClient.invalidateQueries({
    queryKey: listSlotsQueryKey({ path: { eventTypeId } }),
  })
}
