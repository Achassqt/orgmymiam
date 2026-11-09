import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(here, '../../.env') });
loadDotenv({ path: path.resolve(here, '../../../../.env') });

const envSchema = z.object({
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/orgmymiam'),
  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me!!'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me!'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  CATALOG_VERSION: z.coerce.number().int().positive().default(2),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
