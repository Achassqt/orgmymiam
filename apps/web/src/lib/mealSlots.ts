import type { MealSlot, MealType } from '@orgmymiam/shared';

export function mealSlotKey(slot: {
  date: string;
  mealType: MealType;
  recipeId: string;
}): string {
  return `${slot.date}|${slot.mealType}|${slot.recipeId}`;
}

/**
 * Ajoute ou fusionne un créneau : même date + mealType + recipeId → un seul slot
 * (conserve l’id existant, applique servingsOverride).
 * En édition, retire d’abord le slot édité puis fusionne.
 */
export function upsertMealSlot(
  slots: MealSlot[],
  next: Omit<MealSlot, 'id'> & { id?: string },
  editingSlotId: string | null = null,
): MealSlot[] {
  const withoutEdited =
    editingSlotId != null ? slots.filter((s) => s.id !== editingSlotId) : slots;

  const key = mealSlotKey(next);
  const existing = withoutEdited.find((s) => mealSlotKey(s) === key);
  if (existing) {
    return withoutEdited.map((s) =>
      s.id === existing.id
        ? {
            ...s,
            date: next.date,
            mealType: next.mealType,
            recipeId: next.recipeId,
            servingsOverride: next.servingsOverride,
          }
        : s,
    );
  }

  const id = editingSlotId ?? next.id;
  if (!id) {
    throw new Error('Slot id requis pour un nouveau créneau');
  }

  return [
    ...withoutEdited,
    {
      id,
      date: next.date,
      mealType: next.mealType,
      recipeId: next.recipeId,
      servingsOverride: next.servingsOverride,
    },
  ];
}

/**
 * Un repas par jour + type : remplace tout créneau existant pour cette paire
 * (conservé l’id si on édite ou s’il en existe déjà un).
 */
export function replaceMealSlotForDayType(
  slots: MealSlot[],
  next: Omit<MealSlot, 'id'> & { id?: string },
  editingSlotId: string | null = null,
): MealSlot[] {
  const kept = slots.filter((s) => {
    if (editingSlotId != null && s.id === editingSlotId) return false;
    if (s.date === next.date && s.mealType === next.mealType) return false;
    return true;
  });

  const sameDayTypeId = slots.find(
    (s) => s.date === next.date && s.mealType === next.mealType,
  )?.id;
  const reusedId = editingSlotId ?? sameDayTypeId ?? next.id ?? crypto.randomUUID();

  return [
    ...kept,
    {
      id: reusedId,
      date: next.date,
      mealType: next.mealType,
      recipeId: next.recipeId,
      servingsOverride: next.servingsOverride,
    },
  ];
}

/** Retire un créneau du planning (créneau redevient vide). */
export function removeMealSlot(slots: MealSlot[], slotId: string): MealSlot[] {
  return slots.filter((s) => s.id !== slotId);
}
