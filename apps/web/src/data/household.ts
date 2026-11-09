import type { HouseholdResponse, Visibility } from '@orgmymiam/shared';
import {
  createHouseholdRequest,
  fetchMyHousehold,
  joinHouseholdRequest,
  leaveHouseholdRequest,
  rotateHouseholdCodeRequest,
} from '../api/client';
import { getMeta, META_KEYS, setMeta, deleteMeta } from '../db/database';

export type CachedHousehold = HouseholdResponse | null;

export async function getCachedHousehold(): Promise<CachedHousehold> {
  const value = await getMeta<HouseholdResponse | null>(META_KEYS.household);
  return value ?? null;
}

export async function setCachedHousehold(value: HouseholdResponse | null): Promise<void> {
  if (value) {
    await setMeta(META_KEYS.household, value);
  } else {
    await deleteMeta(META_KEYS.household);
  }
}

/** Rafraîchit le cache foyer depuis l’API (200 + household null → null). */
export async function refreshHouseholdCache(): Promise<CachedHousehold> {
  const data = await fetchMyHousehold();
  if (!data.household) {
    await setCachedHousehold(null);
    return null;
  }
  await setCachedHousehold(data);
  return data;
}

export async function createHousehold(name: string): Promise<HouseholdResponse> {
  const data = await createHouseholdRequest(name);
  await setCachedHousehold(data);
  return data;
}

export async function joinHousehold(code: string): Promise<HouseholdResponse> {
  const data = await joinHouseholdRequest(code);
  await setCachedHousehold(data);
  return data;
}

export async function leaveHousehold(): Promise<void> {
  await leaveHouseholdRequest();
  await setCachedHousehold(null);
}

export async function rotateHouseholdCode(): Promise<HouseholdResponse> {
  const data = await rotateHouseholdCodeRequest();
  await setCachedHousehold(data);
  return data;
}

export function defaultShareFields(household: CachedHousehold): {
  householdId: string | null;
  visibility: Visibility;
} {
  if (household?.household) {
    return {
      householdId: household.household._id,
      visibility: 'household',
    };
  }
  return { householdId: null, visibility: 'private' };
}

export function absoluteJoinUrl(joinPath: string): string {
  if (typeof window === 'undefined') return joinPath;
  return `${window.location.origin}${joinPath}`;
}
