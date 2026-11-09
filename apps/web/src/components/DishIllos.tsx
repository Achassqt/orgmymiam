import type { CSSProperties, ReactNode } from 'react';
import carbonaraUrl from '../assets/illos/carbonara.svg';
import fondantUrl from '../assets/illos/fondant.svg';
import pouletUrl from '../assets/illos/poulet.svg';
import saladeUrl from '../assets/illos/salade.svg';
import soupeUrl from '../assets/illos/soupe.svg';

/** Dish illustration keys from the Figma refonte assets. */
export const DISH_ILLO_KEYS = ['carbonara', 'fondant', 'poulet', 'salade', 'soupe'] as const;

export type DishIlloKey = (typeof DISH_ILLO_KEYS)[number];

/** Pastel category backgrounds used behind dish SVGs in Accueil / Planning. */
export const DISH_PASTEL: Record<DishIlloKey, string> = {
  carbonara: 'var(--terra-tint)',
  fondant: 'var(--cocoa-tint)',
  poulet: 'var(--sand-tint)',
  salade: 'var(--sage-tint)',
  soupe: 'var(--terra-tint)',
};

const DISH_SRC: Record<DishIlloKey, string> = {
  carbonara: carbonaraUrl,
  fondant: fondantUrl,
  poulet: pouletUrl,
  salade: saladeUrl,
  soupe: soupeUrl,
};

type DishIlloProps = {
  dish: DishIlloKey;
  className?: string;
  alt?: string;
};

/** Raw dish SVG (no pastel frame). */
export function DishIllo({ dish, className, alt = '' }: DishIlloProps) {
  return <img className={className} src={DISH_SRC[dish]} alt={alt} draggable={false} />;
}

type DishIlloFrameProps = DishIlloProps & {
  /** Override pastel token; defaults to category tint for the dish. */
  pastel?: string;
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
};

const SIZE_CLASS: Record<NonNullable<DishIlloFrameProps['size']>, string> = {
  sm: 'dish-illo-frame-sm',
  md: 'dish-illo-frame-md',
  lg: 'dish-illo-frame-lg',
};

/** Dish SVG on a pastel circular / rounded category background. */
export function DishIlloFrame({
  dish,
  className,
  alt = '',
  pastel,
  size = 'md',
  children,
}: DishIlloFrameProps) {
  const style = {
    '--dish-pastel': pastel ?? DISH_PASTEL[dish],
  } as CSSProperties;

  return (
    <div
      className={['dish-illo-frame', SIZE_CLASS[size], className].filter(Boolean).join(' ')}
      style={style}
      aria-hidden={alt ? undefined : true}
    >
      <DishIllo dish={dish} className="dish-illo" alt={alt} />
      {children}
    </div>
  );
}

export function dishPastel(dish: DishIlloKey): string {
  return DISH_PASTEL[dish];
}
