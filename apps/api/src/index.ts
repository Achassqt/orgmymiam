import { env } from './config/env.js';
import { buildApp } from './app.js';
import { closeMongo, connectMongo } from './db/mongo.js';

async function main(): Promise<void> {
  await connectMongo();
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Arrêt (${signal})…`);
    await app.close();
    await closeMongo();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.API_HOST, port: env.API_PORT });
  app.log.info(`API OrgMyMiam sur http://${env.API_HOST}:${env.API_PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
