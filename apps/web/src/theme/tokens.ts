/**
 * Design tokens for the forêt / sauge / crème / terracotta refonte.
 * CSS variables in styles.css are the runtime source of truth;
 * this module mirrors them for JS (illustrations, future theming).
 */
export const COLORS = {
  forest: '#1F3D2B',
  sage: '#A9BFA0',
  cream: '#F6F1E7',
  terra: '#D9643A',
  white: '#FFFFFF',
  ink: '#1F2A22',
  muted: '#6B7368',
  sageTint: '#E4ECDD',
  terraTint: '#F6E2D8',
  sandTint: '#EFE6D4',
  cocoaTint: '#E8DDD6',
  line: '#DDD5C8',
} as const;

export const RADII = {
  card: '1.5rem',
  tile: '1.25rem',
  chip: '999px',
  control: '1rem',
} as const;

export const SPACING = {
  screen: '1.25rem',
  section: '1.5rem',
  item: '0.75rem',
} as const;

export const FONTS = {
  display: "'DM Serif Display', Georgia, 'Times New Roman', serif",
  body: "'Inter', 'Segoe UI', system-ui, sans-serif",
} as const;
