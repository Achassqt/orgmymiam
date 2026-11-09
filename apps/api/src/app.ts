import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { registerAuth } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { catalogRoutes } from './routes/catalog.js';
import { healthRoutes } from './routes/health.js';
import { syncRoutes } from './routes/sync.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((v) => v.trim()),
    credentials: true,
  });

  await registerAuth(app);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(catalogRoutes);
  await app.register(syncRoutes);

  return app;
}
