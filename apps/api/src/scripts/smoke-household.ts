/**
 * Smoke foyer + sync authz (2 comptes) via mongodb-memory-server.
 * Usage: npx tsx src/scripts/smoke-household.ts
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { AuthResponse, HouseholdResponse, Recipe, SyncPullResponse } from '@orgmymiam/shared';

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('orgmymiam_smoke');
  process.env.JWT_ACCESS_SECRET = 'smoke-access-secret-min-32-characters!!';
  process.env.JWT_REFRESH_SECRET = 'smoke-refresh-secret-min-32-characters!';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '30d';
  process.env.API_HOST = '127.0.0.1';
  process.env.API_PORT = '3457';
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  process.env.CATALOG_VERSION = '2';
  process.env.NODE_ENV = 'test';

  // Imports après env (config lit process.env au load)
  const { connectMongo, closeMongo } = await import('../db/mongo.js');
  const { buildApp } = await import('../app.js');

  await connectMongo();
  const app = await buildApp();
  await app.listen({ host: '127.0.0.1', port: 3457 });
  const base = 'http://127.0.0.1:3457';

  async function req<T>(
    path: string,
    init: RequestInit & { token?: string } = {},
  ): Promise<{ status: number; body: T }> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    if (init.token) headers.set('authorization', `Bearer ${init.token}`);
    const res = await fetch(`${base}${path}`, { ...init, headers });
    const body = (await res.json()) as T;
    return { status: res.status, body };
  }

  const stamp = Date.now();
  const a = await req<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `a-${stamp}@example.com`,
      password: 'password12',
      displayName: 'Alice',
    }),
  });
  const b = await req<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `b-${stamp}@example.com`,
      password: 'password12',
      displayName: 'Bob',
    }),
  });
  if (a.status !== 201 || b.status !== 201) {
    throw new Error(`register failed ${a.status}/${b.status}`);
  }
  const tokenA = a.body.tokens.accessToken;
  const tokenB = b.body.tokens.accessToken;
  const userA = a.body.user._id;
  const userB = b.body.user._id;

  const meEmpty = await req<{ household: null }>('/households/me', { token: tokenA });
  if (meEmpty.status !== 200 || meEmpty.body.household !== null) {
    throw new Error('expected empty household 200 { household: null }');
  }

  const created = await req<HouseholdResponse>('/households', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({ name: 'Foyer Smoke' }),
  });
  if (created.status !== 201) throw new Error(`create household ${created.status}`);
  const code = created.body.household.inviteCode;
  console.log('invite code', code);

  const joined = await req<HouseholdResponse>('/households/join', {
    method: 'POST',
    token: tokenB,
    body: JSON.stringify({ code }),
  });
  if (joined.status !== 200) throw new Error(`join ${joined.status} ${JSON.stringify(joined.body)}`);
  if (joined.body.household.memberIds.length !== 2) {
    throw new Error('expected 2 members');
  }

  const meB = await req<HouseholdResponse>('/households/me', { token: tokenB });
  if (meB.status !== 200) throw new Error('me B failed');

  const now = new Date().toISOString();
  const recipeId = crypto.randomUUID();
  const deviceA = crypto.randomUUID();
  const deviceB = crypto.randomUUID();
  const householdId = created.body.household._id;

  const recipe: Recipe = {
    _id: recipeId,
    userId: userA,
    title: 'Pâtes foyer',
    servings: 2,
    ingredients: [],
    notes: '',
    householdId,
    visibility: 'household',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    rev: 1,
  };

  const pushA = await req<{ results: Array<{ status: string; reason?: string }> }>('/sync/push', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({
      deviceId: deviceA,
      mutations: [{ entity: 'recipes', op: 'create', payload: recipe }],
    }),
  });
  if (pushA.status !== 200 || pushA.body.results[0]?.status !== 'accepted') {
    throw new Error(`push A failed ${JSON.stringify(pushA.body)}`);
  }

  const pullB = await req<SyncPullResponse>(
    `/sync/pull?deviceId=${deviceB}&since=1970-01-01T00:00:00.000Z`,
    { token: tokenB },
  );
  if (pullB.status !== 200) throw new Error(`pull B ${pullB.status}`);
  const found = pullB.body.recipes.find((r) => r._id === recipeId);
  if (!found || found.visibility !== 'household') {
    throw new Error('Bob did not pull household recipe');
  }

  // Bob update (co-edit) with updatedAt newer
  const later = new Date(Date.now() + 1000).toISOString();
  const edited: Recipe = {
    ...found,
    title: 'Pâtes foyer (Bob)',
    updatedAt: later,
    rev: found.rev + 1,
  };
  const pushB = await req<{ results: Array<{ status: string }> }>('/sync/push', {
    method: 'POST',
    token: tokenB,
    body: JSON.stringify({
      deviceId: deviceB,
      mutations: [{ entity: 'recipes', op: 'update', payload: edited }],
    }),
  });
  if (pushB.body.results[0]?.status !== 'accepted') {
    throw new Error(`push B co-edit failed ${JSON.stringify(pushB.body)}`);
  }

  const rotate = await req<HouseholdResponse>('/households/rotate-code', {
    method: 'POST',
    token: tokenA,
    body: '{}',
  });
  if (rotate.status !== 200 || rotate.body.household.inviteCode === code) {
    throw new Error('rotate code failed');
  }

  const leave = await req<{ left: true }>('/households/leave', {
    method: 'POST',
    token: tokenB,
    body: '{}',
  });
  if (leave.status !== 200) throw new Error('leave failed');

  const meB2 = await req<{ household: null }>('/households/me', { token: tokenB });
  if (meB2.status !== 200 || meB2.body.household !== null) {
    throw new Error('expected B out of household with 200 { household: null }');
  }

  console.log('SMOKE_OK', { userA, userB, householdId, recipeId });

  await app.close();
  await closeMongo();
  await mongod.stop();
}

main().catch((err) => {
  console.error('SMOKE_FAIL', err);
  process.exit(1);
});
