import { sendNotFound } from '../errors.js'
import type { RouteHandlers } from '../generated/fastify.gen.js'
import {
  toPublicEventType,
  type EventTypeService,
} from '../services/eventTypes.js'

export const eventTypeHandlers = (
  eventTypeService: EventTypeService,
): Pick<RouteHandlers, 'listEventTypes' | 'getEventType'> => ({
  listEventTypes: async (_request, reply) =>
    reply.code(200).send(eventTypeService.listVisible()),

  getEventType: async (request, reply) => {
    const record = eventTypeService.findVisible(request.params.eventTypeId)
    if (!record) {
      return sendNotFound(reply)
    }
    return reply.code(200).send(toPublicEventType(record))
  },
})
