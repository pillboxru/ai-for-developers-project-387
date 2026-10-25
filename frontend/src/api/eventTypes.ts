import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import {
  deleteEventTypeMutation,
  getEventTypeOptions,
  listAdminEventTypesOptions,
  listAdminEventTypesQueryKey,
  listEventTypesOptions,
  listEventTypesQueryKey,
} from './generated/@tanstack/react-query.gen.ts'
import { createEventType, updateEventType } from './generated/sdk.gen.ts'
import type { CreateEventType } from './generated/types.gen.ts'

export const adminEventTypesQuery = () => listAdminEventTypesOptions()

export const eventTypesQuery = () => listEventTypesOptions()

// Тип, на который записывается гость. Скрытый отвечает 404, как несуществующий
export const eventTypeQuery = (eventTypeId: string) =>
  getEventTypeOptions({ path: { eventTypeId } })

// Создание и правка — одна форма с одним телом: без id тип создаётся, с id
// меняется полной моделью (23.1)
export const saveEventTypeMutationOptions = (eventTypeId?: string) =>
  mutationOptions({
    mutationFn: async (body: CreateEventType) => {
      const { data } = eventTypeId
        ? await updateEventType({
            path: { eventTypeId },
            body,
            throwOnError: true,
          })
        : await createEventType({ body, throwOnError: true })
      return data
    },
  })

export const deleteEventTypeMutationOptions = () => deleteEventTypeMutation()

// После любого изменения типа событий: перечитываются списки владельца и гостя
export function invalidateEventTypes(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: listAdminEventTypesQueryKey() }),
    queryClient.invalidateQueries({ queryKey: listEventTypesQueryKey() }),
  ])
}
