import { sendNotFound } from '../errors.js'
import type { RouteHandlers } from '../generated/fastify.gen.js'
import type { ApiError } from '../generated/types.gen.js'
import type { EventTypeService } from '../services/eventTypes.js'

const titleTakenMessage = 'Тип события с таким названием уже есть'

// fieldErrors, чтобы форма показала текст под полем «Название»
const titleTaken: ApiError = {
  code: 'event_type_title_taken',
  message: titleTakenMessage,
  fieldErrors: [{ field: 'title', message: titleTakenMessage }],
}

const hasBookings: ApiError = {
  code: 'event_type_has_bookings',
  message: 'У типа события есть бронирования',
}

export const adminEventTypeHandlers = (
  eventTypeService: EventTypeService,
): Pick<
  RouteHandlers,
  | 'listAdminEventTypes'
  | 'createEventType'
  | 'updateEventType'
  | 'deleteEventType'
> => ({
  listAdminEventTypes: async (_request, reply) =>
    reply.code(200).send(eventTypeService.listAll()),

  createEventType: async (request, reply) => {
    const result = eventTypeService.create(request.body)
    if (result.kind === 'title_taken') {
      return reply.code(409).send(titleTaken)
    }
    return reply.code(201).send(result.eventType)
  },

  updateEventType: async (request, reply) => {
    const result = eventTypeService.update(
      request.params.eventTypeId,
      request.body,
    )
    if (result.kind === 'not_found') {
      return sendNotFound(reply)
    }
    if (result.kind === 'title_taken') {
      return reply.code(409).send(titleTaken)
    }
    if (result.kind === 'has_bookings') {
      return reply.code(409).send({
        ...hasBookings,
        message:
          'Длительность нельзя изменить: у типа есть бронирования. Для другой длительности создайте новый тип',
      })
    }
    return reply.code(200).send(result.eventType)
  },

  deleteEventType: async (request, reply) => {
    const result = eventTypeService.delete(request.params.eventTypeId)
    if (result.kind === 'not_found') {
      return sendNotFound(reply)
    }
    if (result.kind === 'has_bookings') {
      return reply.code(409).send({
        ...hasBookings,
        message:
          'Тип нельзя удалить: у него есть бронирования. Скройте тип, чтобы гости его не видели',
      })
    }
    return reply.code(204).send()
  },
})
