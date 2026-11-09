import type { Household, HouseholdMemberPublic, HouseholdResponse, User } from '@orgmymiam/shared';
import { getCollections } from '../db/mongo.js';
import { newId, nowIso } from '../utils/crypto.js';

export const HOUSEHOLD_MAX_MEMBERS = 8;
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)]!;
  }
  return code;
}

export function joinPathForCode(code: string): string {
  return `/rejoindre?code=${encodeURIComponent(code)}`;
}

async function uniqueInviteCode(): Promise<string> {
  const cols = getCollections();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const inviteCode = generateInviteCode();
    const existing = await cols.households.findOne({ inviteCode });
    if (!existing) return inviteCode;
  }
  throw new Error('INVITE_CODE_EXHAUSTED');
}

export async function findHouseholdForUser(userId: string): Promise<Household | null> {
  const cols = getCollections();
  return cols.households.findOne({ memberIds: userId });
}

async function loadMembers(memberIds: string[]): Promise<HouseholdMemberPublic[]> {
  const cols = getCollections();
  const users = await cols.users
    .find({ _id: { $in: memberIds } })
    .project<Pick<User, '_id' | 'displayName' | 'email'>>({ _id: 1, displayName: 1, email: 1 })
    .toArray();
  const byId = new Map(users.map((u) => [u._id, u]));
  return memberIds
    .map((id) => byId.get(id))
    .filter((u): u is Pick<User, '_id' | 'displayName' | 'email'> => Boolean(u))
    .map((u) => ({ _id: u._id, displayName: u.displayName, email: u.email }));
}

export async function toHouseholdResponse(household: Household): Promise<HouseholdResponse> {
  const members = await loadMembers(household.memberIds);
  return {
    household,
    members,
    joinPath: joinPathForCode(household.inviteCode),
  };
}

export async function createHousehold(userId: string, name: string): Promise<HouseholdResponse> {
  const existing = await findHouseholdForUser(userId);
  if (existing) {
    throw new Error('ALREADY_IN_HOUSEHOLD');
  }

  const now = nowIso();
  const household: Household = {
    _id: newId(),
    name: name.trim(),
    inviteCode: await uniqueInviteCode(),
    ownerId: userId,
    memberIds: [userId],
    createdAt: now,
    updatedAt: now,
  };

  await getCollections().households.insertOne(household);
  return toHouseholdResponse(household);
}

export async function joinHousehold(userId: string, code: string): Promise<HouseholdResponse> {
  const cols = getCollections();
  const already = await findHouseholdForUser(userId);
  if (already) {
    throw new Error('ALREADY_IN_HOUSEHOLD');
  }

  const inviteCode = code.trim().toUpperCase();
  const household = await cols.households.findOne({ inviteCode });
  if (!household) {
    throw new Error('INVALID_CODE');
  }
  if (household.memberIds.includes(userId)) {
    return toHouseholdResponse(household);
  }
  if (household.memberIds.length >= HOUSEHOLD_MAX_MEMBERS) {
    throw new Error('HOUSEHOLD_FULL');
  }

  const updatedAt = nowIso();
  const result = await cols.households.findOneAndUpdate(
    {
      _id: household._id,
      memberIds: { $ne: userId },
      $expr: { $lt: [{ $size: '$memberIds' }, HOUSEHOLD_MAX_MEMBERS] },
    },
    {
      $addToSet: { memberIds: userId },
      $set: { updatedAt },
    },
    { returnDocument: 'after' },
  );

  if (!result) {
    const fresh = await cols.households.findOne({ _id: household._id });
    if (fresh?.memberIds.includes(userId)) {
      return toHouseholdResponse(fresh);
    }
    throw new Error('HOUSEHOLD_FULL');
  }

  return toHouseholdResponse(result);
}

export async function getMyHousehold(userId: string): Promise<HouseholdResponse | null> {
  const household = await findHouseholdForUser(userId);
  if (!household) return null;
  return toHouseholdResponse(household);
}

export async function leaveHousehold(userId: string): Promise<{ left: true; dissolved: boolean }> {
  const cols = getCollections();
  const household = await findHouseholdForUser(userId);
  if (!household) {
    throw new Error('NOT_IN_HOUSEHOLD');
  }

  const remaining = household.memberIds.filter((id) => id !== userId);
  if (remaining.length === 0) {
    await cols.households.deleteOne({ _id: household._id });
    return { left: true, dissolved: true };
  }

  const ownerId =
    household.ownerId === userId ? remaining[0]! : household.ownerId;
  const updatedAt = nowIso();
  await cols.households.updateOne(
    { _id: household._id },
    {
      $set: { memberIds: remaining, ownerId, updatedAt },
    },
  );
  return { left: true, dissolved: false };
}

export async function rotateInviteCode(userId: string): Promise<HouseholdResponse> {
  const cols = getCollections();
  const household = await findHouseholdForUser(userId);
  if (!household) {
    throw new Error('NOT_IN_HOUSEHOLD');
  }
  if (household.ownerId !== userId) {
    throw new Error('FORBIDDEN');
  }

  const inviteCode = await uniqueInviteCode();
  const updatedAt = nowIso();
  const result = await cols.households.findOneAndUpdate(
    { _id: household._id, ownerId: userId },
    { $set: { inviteCode, updatedAt } },
    { returnDocument: 'after' },
  );
  if (!result) {
    throw new Error('FORBIDDEN');
  }
  return toHouseholdResponse(result);
}
