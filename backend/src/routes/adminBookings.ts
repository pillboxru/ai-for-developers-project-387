import { sendNotFound } from '../errors.js'
import type { RouteHandlers } from '../generated/fastify.gen.js'
import type { ApiError } from '../generated/types.gen.js'
import type { BookingService } from '../services/bookings.js'

const bookingEnded: ApiError = {
  code: 'booking_ended',
  message: 'Бронирование уже закончилось',
}

export const adminBookingHandlers = (
  bookingService: BookingService,
): Pick<RouteHandlers, 'listBookings' | 'cancelBooking'> => ({
  listBookings: async (_request, reply) =>
    reply.code(200).send(bookingService.listUpcoming()),

  cancelBooking: async (request, reply) => {
    const result = bookingService.cancel(request.params.bookingId)
    if (result.kind === 'not_found') {
      return sendNotFound(reply)
    }
    if (result.kind === 'booking_ended') {
      return reply.code(409).send(bookingEnded)
    }
    return reply.code(200).send(result.booking)
  },
})
