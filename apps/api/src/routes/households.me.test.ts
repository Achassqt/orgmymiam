/**
 * GET /households/me sans foyer → 200 { household: null } (pas 404).
 * Usage: npx tsx --test src/routes/households.me.test.ts
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { AuthResponse, MyHouseholdResponse } from '@orgmymiam/shared';

describe('GET /households/me', () => {
  let mongod: MongoMemoryServer;
  let base = '';
  let closeApp: (() => Promise<void>) | null = null;
  let closeMongo: (() => Promise<void>) | null = null;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('orgmymiam_households_me');
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-characters!!!!';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-characters!!!';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '30d';
    process.env.API_HOST = '127.0.0.1';
    process.env.API_PORT = '3461';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.CATALOG_VERSION = '1';
    process.env.NODE_ENV = 'test';

    const mongo = await import('../db/mongo.js');
    const { buildApp } = await import('../app.js');
    closeMongo = mongo.closeMongo;
    await mongo.connectMongo();
    const app = await buildApp();
    await app.listen({ host: '127.0.0.1', port: 3461 });
    base = 'http://127.0.0.1:3461';
    closeApp = async () => {
      await app.close();
    };
  });

  after(async () => {
    if (closeApp) await closeApp();
    if (closeMongo) await closeMongo();
    await mongod.stop();
  });

  it('répond 200 avec household null si aucun foyer', async () => {
    const stamp = Date.now();
    const reg = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `solo-${stamp}@example.com`,
        password: 'password12',
        displayName: 'Solo',
      }),
    });
    assert.equal(reg.status, 201);
    const auth = (await reg.json()) as AuthResponse;
    const me = await fetch(`${base}/households/me`, {
      headers: { authorization: `Bearer ${auth.tokens.accessToken}` },
    });
    assert.equal(me.status, 200);
    const body = (await me.json()) as MyHouseholdResponse;
    assert.equal(body.household, null);
  });
});
