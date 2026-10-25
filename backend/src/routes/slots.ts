import { sendNotFound } from '../errors.js'
import type { RouteHandlers } from '../generated/fastify.gen.js'
import type { EventTypeService } from '../services/eventTypes.js'
import type { SlotService } from '../services/slots.js'

export const slotHandlers = ({
  eventTypeService,
  slotService,
}: {
  eventTypeService: EventTypeService
  slotService: SlotService
}): Pick<RouteHandlers, 'listSlots'> => ({
  listSlots: async (request, reply) => {
    const eventType = eventTypeService.findVisible(request.params.eventTypeId)
    if (!eventType) {
      return sendNotFound(reply)
    }
    return reply.code(200).send(slotService.listSlots(eventType))
  },
})
