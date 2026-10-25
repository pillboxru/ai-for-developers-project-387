import type { QueryClient } from '@tanstack/react-query'
import {
  cancelBookingMutation,
  createBookingMutation,
  listBookingsOptions,
  listBookingsQueryKey,
} from './generated/@tanstack/react-query.gen.ts'

// Бронирование слота гостем: сервер примет только начало одного из слотов,
// которые вычисляет в момент запроса, иначе 409 slot_unavailable
export const createBookingMutationOptions = () => createBookingMutation()

// Предстоящие бронирования владельца всех типов, включая скрытые
// и отменённые, по началу. Дни раскладывает экран по поясу владельца
export const bookingsQuery = () => listBookingsOptions()

// Отмена владельцем. Повтор отвечает уже отменённым бронированием,
// закончившееся — 409 booking_ended. Вернуть отмену нельзя
export const cancelBookingMutationOptions = () => cancelBookingMutation()

// После отмены, а также когда список мог устареть: сервер отказал из-за
// бронирования, которого ещё нет на экране
export function invalidateBookings(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: listBookingsQueryKey() })
}
