import { sendNotFound } from '../errors.js'
import type { RouteHandlers } from '../generated/fastify.gen.js'
import type { ApiError } from '../generated/types.gen.js'
import type { BookingService } from '../services/bookings.js'

const slotUnavailable: ApiError = {
  code: 'slot_unavailable',
  message: 'Это время уже недоступно. Выберите другое.',
}

export const bookingHandlers = (
  bookingService: BookingService,
): Pick<RouteHandlers, 'createBooking'> => ({
  createBooking: async (request, reply) => {
    const result = bookingService.create(
      request.params.eventTypeId,
      request.body,
    )
    if (result.kind === 'not_found') {
      return sendNotFound(reply)
    }
    if (result.kind === 'slot_unavailable') {
      return reply.code(409).send(slotUnavailable)
    }
    return reply.code(201).send(result.booking)
  },
})
