import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken, type AccessTokenPayload } from '../services/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }

  interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Token manquant' });
  }

  try {
    request.user = verifyAccessToken(header.slice('Bearer '.length));
  } catch {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Token invalide ou expiré' });
  }
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  app.decorate('authenticate', authenticate);
  app.decorateRequest('user', undefined);
}
