import type { RouteHandlers } from '../generated/fastify.gen.js'
import type { Owner } from '../generated/types.gen.js'

export const ownerHandlers = (
  owner: Owner,
): Pick<RouteHandlers, 'getOwner'> => ({
  getOwner: async (_request, reply) => reply.code(200).send(owner),
})
