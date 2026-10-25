import { sendValidationError } from '../errors.js'
import type { RouteHandlers } from '../generated/fastify.gen.js'
import type { ApiError } from '../generated/types.gen.js'
import type { ScheduleService } from '../services/schedule.js'

export const scheduleHandlers = (
  scheduleService: ScheduleService,
): Pick<RouteHandlers, 'getSchedule' | 'updateSchedule'> => ({
  getSchedule: async (_request, reply) =>
    reply.code(200).send(scheduleService.get()),
  updateSchedule: async (request, reply) => {
    const result = scheduleService.update(request.body)
    if (result.kind === 'invalid') {
      return sendValidationError(reply, result.fieldErrors)
    }
    if (result.kind === 'conflict') {
      const body: ApiError = {
        code: 'schedule_conflicts_with_bookings',
        message:
          'Бронирования окажутся вне доступного времени. Сначала отмените их или оставьте для них время.',
        bookings: result.bookings,
      }
      return reply.code(409).send(body)
    }
    return reply.code(200).send(result.schedule)
  },
})
