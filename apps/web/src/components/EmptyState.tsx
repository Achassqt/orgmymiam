import type { ReactNode } from 'react';
import {
  IlloBowl,
  IlloBurger,
  IlloCalendar,
  IlloCart,
  IlloChef,
} from './FoodIllos';

export type EmptyIllo = 'burger' | 'bowl' | 'cart' | 'calendar' | 'chef';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  illo?: EmptyIllo;
}

const ILLOS: Record<EmptyIllo, (props: { className?: string }) => ReactNode> = {
  burger: IlloBurger,
  bowl: IlloBowl,
  cart: IlloCart,
  calendar: IlloCalendar,
  chef: IlloChef,
};

export function EmptyState({ title, description, action, illo = 'bowl' }: EmptyStateProps) {
  const Illo = ILLOS[illo];
  return (
    <div className="empty-state">
      <div className="empty-state-illo float-soft" aria-hidden>
        <Illo className="food-illo" />
      </div>
      <p className="empty-state-title">{title}</p>
      {description ? <p className="empty-state-desc">{description}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
