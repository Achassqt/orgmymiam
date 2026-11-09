import type { FastifyPluginAsync } from 'fastify';
import { createHouseholdSchema, joinHouseholdSchema } from '@orgmymiam/shared';
import {
  createHousehold,
  getMyHousehold,
  joinHousehold,
  leaveHousehold,
  rotateInviteCode,
} from '../services/households.js';

export const householdRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/households',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createHouseholdSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
      }
      try {
        const result = await createHousehold(request.user!.sub, parsed.data.name);
        return reply.code(201).send(result);
      } catch (err) {
        if (err instanceof Error && err.message === 'ALREADY_IN_HOUSEHOLD') {
          return reply
            .code(409)
            .send({ error: 'ALREADY_IN_HOUSEHOLD', message: 'Tu es déjà dans un foyer' });
        }
        throw err;
      }
    },
  );

  app.post(
    '/households/join',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = joinHouseholdSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
      }
      try {
        const result = await joinHousehold(request.user!.sub, parsed.data.code);
        return reply.send(result);
      } catch (err) {
        if (!(err instanceof Error)) throw err;
        if (err.message === 'ALREADY_IN_HOUSEHOLD') {
          return reply
            .code(409)
            .send({ error: 'ALREADY_IN_HOUSEHOLD', message: 'Tu es déjà dans un foyer' });
        }
        if (err.message === 'INVALID_CODE') {
          return reply.code(404).send({ error: 'INVALID_CODE', message: 'Code foyer invalide' });
        }
        if (err.message === 'HOUSEHOLD_FULL') {
          return reply
            .code(409)
            .send({ error: 'HOUSEHOLD_FULL', message: 'Ce foyer est complet (8 membres max)' });
        }
        throw err;
      }
    },
  );

  app.get(
    '/households/me',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = await getMyHousehold(request.user!.sub);
      if (!result) {
        return reply.send({ household: null });
      }
      return reply.send(result);
    },
  );

  app.post(
    '/households/leave',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const result = await leaveHousehold(request.user!.sub);
        return reply.send(result);
      } catch (err) {
        if (err instanceof Error && err.message === 'NOT_IN_HOUSEHOLD') {
          return reply
            .code(404)
            .send({ error: 'NOT_IN_HOUSEHOLD', message: 'Tu n’es pas dans un foyer' });
        }
        throw err;
      }
    },
  );

  app.post(
    '/households/rotate-code',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const result = await rotateInviteCode(request.user!.sub);
        return reply.send(result);
      } catch (err) {
        if (!(err instanceof Error)) throw err;
        if (err.message === 'NOT_IN_HOUSEHOLD') {
          return reply
            .code(404)
            .send({ error: 'NOT_IN_HOUSEHOLD', message: 'Tu n’es pas dans un foyer' });
        }
        if (err.message === 'FORBIDDEN') {
          return reply
            .code(403)
            .send({ error: 'FORBIDDEN', message: 'Seul le propriétaire peut renouveler le code' });
        }
        throw err;
      }
    },
  );
};
