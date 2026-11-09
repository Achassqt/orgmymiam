import type { Visibility } from '@orgmymiam/shared';
import { useHousehold } from '../hooks/useHousehold';
import { setEntityVisibility } from '../data/crud';
import { useState } from 'react';

interface VisibilityToggleProps {
  entity: 'recipes' | 'meal_plans' | 'shopping_lists';
  id: string;
  value: Visibility;
  onChanged?: (next: Visibility) => void;
}

export function VisibilityToggle({ entity, id, value, onChanged }: VisibilityToggleProps) {
  const { isMember } = useHousehold();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isMember) return null;

  async function onToggle(next: Visibility) {
    if (next === value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setEntityVisibility(entity, id, next);
      onChanged?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Changement impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="visibility-toggle">
      <span className="visibility-label">Partage</span>
      <div className="visibility-switch" role="group" aria-label="Visibilité">
        <button
          type="button"
          className={value === 'private' ? 'vis-btn active' : 'vis-btn'}
          disabled={busy}
          onClick={() => void onToggle('private')}
        >
          Perso
        </button>
        <button
          type="button"
          className={value === 'household' ? 'vis-btn active' : 'vis-btn'}
          disabled={busy}
          onClick={() => void onToggle('household')}
        >
          Foyer
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

export function HouseholdBadge({ visibility }: { visibility?: Visibility | null }) {
  if (visibility !== 'household') return null;
  return <span className="household-badge">Foyer</span>;
}
