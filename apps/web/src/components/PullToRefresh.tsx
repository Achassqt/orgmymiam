import type { ReactNode } from 'react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface PullToRefreshProps {
  children: ReactNode;
  disabled?: boolean;
  reason?: string;
}

export function PullToRefresh({ children, disabled, reason }: PullToRefreshProps) {
  const { containerRef, pullDistance, refreshing, pulling } = usePullToRefresh<HTMLDivElement>({
    disabled,
    reason,
  });

  const progress = Math.min(1, pullDistance / 72);
  const label = refreshing
    ? 'Synchronisation…'
    : progress >= 1
      ? 'Relâche pour actualiser'
      : 'Tire pour actualiser';

  return (
    <div className="ptr-root" ref={containerRef}>
      <div
        className={`ptr-indicator${pulling || refreshing ? ' visible' : ''}`}
        style={{ height: refreshing ? 40 : pullDistance }}
        aria-live="polite"
      >
        <span className={`ptr-spinner${refreshing ? ' spinning' : ''}`} style={{ opacity: Math.max(0.25, progress) }} />
        <span className="ptr-label">{pulling || refreshing ? label : ''}</span>
      </div>
      {children}
    </div>
  );
}
