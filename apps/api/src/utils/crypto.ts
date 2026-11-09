import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export function newId(): string {
  return randomUUID();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function nowIso(): string {
  return new Date().toISOString();
}
