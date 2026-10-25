import type { RouteHandlers } from '../generated/fastify.gen.js'

export const healthHandlers: Pick<RouteHandlers, 'getHealth'> = {
  getHealth: async (_request, reply) => reply.code(200).send({ status: 'ok' }),
}
