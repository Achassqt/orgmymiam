import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { runSync } from '../sync/engine';

const THRESHOLD_PX = 72;
const MAX_PULL_PX = 120;

interface PullToRefreshOptions {
  /** Désactiver (ex. éditeur ouvert). */
  disabled?: boolean;
  reason?: string;
}

export function usePullToRefresh<T extends HTMLElement>(
  options: PullToRefreshOptions = {},
): {
  containerRef: RefObject<T | null>;
  pulling: boolean;
  pullDistance: number;
  refreshing: boolean;
} {
  const { disabled = false, reason = 'pull-to-refresh' } = options;
  const containerRef = useRef<T | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullingRef = useRef(false);

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true);
    setPullDistance(THRESHOLD_PX * 0.6);
    try {
      await runSync(reason);
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  }, [reason]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    const onTouchStart = (event: TouchEvent) => {
      if (refreshing) return;
      if (el.scrollTop > 0) {
        startY.current = null;
        return;
      }
      startY.current = event.touches[0]?.clientY ?? null;
      pullingRef.current = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (startY.current == null || refreshing) return;
      const currentY = event.touches[0]?.clientY ?? startY.current;
      const delta = currentY - startY.current;
      if (delta <= 0 || el.scrollTop > 0) {
        setPullDistance(0);
        pullingRef.current = false;
        return;
      }
      pullingRef.current = true;
      const dampened = Math.min(MAX_PULL_PX, delta * 0.45);
      setPullDistance(dampened);
      if (dampened > 8) {
        event.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (pullingRef.current && pullDistance >= THRESHOLD_PX) {
        void triggerRefresh();
      } else {
        setPullDistance(0);
      }
      startY.current = null;
      pullingRef.current = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [disabled, pullDistance, refreshing, triggerRefresh]);

  return {
    containerRef,
    pulling: pullDistance > 4,
    pullDistance,
    refreshing,
  };
}
