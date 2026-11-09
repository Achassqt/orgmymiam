import { useEffect, useRef } from 'react';
import { useToast } from '../components/ToastHost';
import { useHousehold } from './useHousehold';

/** Toast discret quand un nouveau membre apparaît après refresh foyer. */
export function useNewMemberToast() {
  const { members, isMember } = useHousehold();
  const showToast = useToast();
  const seenIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!isMember) {
      seenIdsRef.current = null;
      return;
    }
    const ids = new Set(members.map((m) => m._id));
    const prev = seenIdsRef.current;
    if (prev) {
      const newcomers = members.filter((m) => !prev.has(m._id));
      if (newcomers.length === 1) {
        showToast(`${newcomers[0]!.displayName} a rejoint le foyer`);
      } else if (newcomers.length > 1) {
        showToast(`${newcomers.length} nouveaux membres dans le foyer`);
      }
    }
    seenIdsRef.current = ids;
  }, [isMember, members, showToast]);
}
