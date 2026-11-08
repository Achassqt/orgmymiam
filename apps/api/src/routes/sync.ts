import type { FastifyPluginAsync } from 'fastify';
import { syncPullQuerySchema, syncPushBodySchema } from '@orgmymiam/shared';
import { pullChanges, pushMutations } from '../services/sync.js';

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/sync/push',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = syncPushBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
      }

      const userId = request.user!.sub;
      const result = await pushMutations(userId, parsed.data.deviceId, parsed.data.mutations);
      return reply.send(result);
    },
  );

  app.get(
    '/sync/pull',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = syncPullQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
      }

      const userId = request.user!.sub;
      const result = await pullChanges(userId, parsed.data.deviceId, parsed.data.since);
      return reply.send(result);
    },
  );
};
