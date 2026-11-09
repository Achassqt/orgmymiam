import type { FastifyPluginAsync } from 'fastify';
import { catalogQuerySchema } from '@orgmymiam/shared';
import { getCollections } from '../db/mongo.js';
import { env } from '../config/env.js';

export const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/catalog',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = catalogQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
      }

      const cols = getCollections();
      const sinceVersion = parsed.data.sinceVersion;
      const products = await cols.catalogProducts
        .find({ catalogVersion: { $gt: sinceVersion } })
        .sort({ nameNormalized: 1 })
        .toArray();

      return {
        products,
        catalogVersion: env.CATALOG_VERSION,
      };
    },
  );
};
