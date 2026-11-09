import type { FastifyPluginAsync } from 'fastify';
import { getCollections } from '../db/mongo.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    let mongo: 'ok' | 'error' = 'ok';
    try {
      await getCollections().users.findOne({}, { projection: { _id: 1 } });
    } catch {
      mongo = 'error';
    }

    return {
      status: mongo === 'ok' ? 'ok' : 'degraded',
      service: 'orgmymiam-api',
      mongo,
      time: new Date().toISOString(),
    };
  });
};
