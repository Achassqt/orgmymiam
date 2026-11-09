import jwt from 'jsonwebtoken';
import type { AuthResponse, PublicUser, User } from '@orgmymiam/shared';
import { env } from '../config/env.js';
import { getCollections } from '../db/mongo.js';
import { hashPassword, hashToken, newId, nowIso, verifyPassword } from '../utils/crypto.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

function toPublicUser(user: User): PublicUser {
  return {
    _id: user._id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function accessExpiresSeconds(): number {
  const raw = env.JWT_ACCESS_EXPIRES_IN;
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return 15 * 60;
  const value = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 15 * 60;
  }
}

function refreshExpiresDate(): Date {
  const raw = env.JWT_REFRESH_EXPIRES_IN;
  const match = /^(\d+)([smhd])$/.exec(raw);
  const now = Date.now();
  if (!match) return new Date(now + 30 * 86400_000);
  const value = Number(match[1]);
  const unit = match[2];
  const ms =
    unit === 's'
      ? value * 1000
      : unit === 'm'
        ? value * 60_000
        : unit === 'h'
          ? value * 3_600_000
          : value * 86_400_000;
  return new Date(now + ms);
}

async function issueTokens(user: User): Promise<AuthResponse> {
  const cols = getCollections();
  const jti = newId();
  const accessToken = jwt.sign(
    { sub: user._id, email: user.email, type: 'access' } satisfies AccessTokenPayload,
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions,
  );
  const refreshToken = jwt.sign(
    { sub: user._id, jti, type: 'refresh' } satisfies RefreshTokenPayload,
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions,
  );

  const expiresAt = refreshExpiresDate();
  await cols.refreshTokens.insertOne({
    _id: jti,
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    createdAt: nowIso(),
    revokedAt: null,
  });

  return {
    user: toPublicUser(user),
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresSeconds(),
    },
  };
}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthResponse> {
  const cols = getCollections();
  const email = input.email.trim().toLowerCase();
  const existing = await cols.users.findOne({ email });
  if (existing) {
    const err = new Error('EMAIL_TAKEN');
    throw err;
  }

  const now = nowIso();
  const user: User = {
    _id: newId(),
    email,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName.trim(),
    createdAt: now,
    updatedAt: now,
  };

  await cols.users.insertOne(user);
  return issueTokens(user);
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const cols = getCollections();
  const email = input.email.trim().toLowerCase();
  const user = await cols.users.findOne({ email });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    const err = new Error('INVALID_CREDENTIALS');
    throw err;
  }
  return issueTokens(user);
}

export async function refreshTokens(refreshToken: string): Promise<AuthResponse> {
  const cols = getCollections();
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    throw new Error('INVALID_REFRESH');
  }

  if (payload.type !== 'refresh') {
    throw new Error('INVALID_REFRESH');
  }

  const stored = await cols.refreshTokens.findOne({ _id: payload.jti });
  if (!stored || stored.revokedAt || stored.tokenHash !== hashToken(refreshToken)) {
    throw new Error('INVALID_REFRESH');
  }

  const user = await cols.users.findOne({ _id: payload.sub });
  if (!user) {
    throw new Error('INVALID_REFRESH');
  }

  await cols.refreshTokens.updateOne(
    { _id: payload.jti },
    { $set: { revokedAt: nowIso() } },
  );

  return issueTokens(user);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  if (payload.type !== 'access') {
    throw new Error('INVALID_ACCESS');
  }
  return payload;
}
