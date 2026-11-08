import type { FastifyPluginAsync } from 'fastify';
import { loginSchema, refreshSchema, registerSchema } from '@orgmymiam/shared';
import { loginUser, refreshTokens, registerUser } from '../services/auth.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    }

    try {
      const result = await registerUser(parsed.data);
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
        return reply.code(409).send({ error: 'EMAIL_TAKEN', message: 'Cet email est déjà utilisé' });
      }
      throw err;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    }

    try {
      const result = await loginUser(parsed.data);
      return reply.send(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
        return reply
          .code(401)
          .send({ error: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe incorrect' });
      }
      throw err;
    }
  });

  app.post('/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    }

    try {
      const result = await refreshTokens(parsed.data.refreshToken);
      return reply.send(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_REFRESH') {
        return reply
          .code(401)
          .send({ error: 'INVALID_REFRESH', message: 'Refresh token invalide ou révoqué' });
      }
      throw err;
    }
  });
};
