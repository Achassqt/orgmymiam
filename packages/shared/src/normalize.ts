/**
 * Normalise un nom de produit pour l'anti-doublons / recherche.
 * 1. trim
 * 2. lowercase
 * 3. NFD + suppression des diacritiques
 * 4. collapse espaces / tirets
 * 5. singularisation légère FR (règles itératives simples)
 */
export function normalizeProductName(input: string): string {
  let value = input.trim().toLowerCase();

  value = value.normalize('NFD').replace(/\p{M}/gu, '');

  value = value
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  value = value
    .split(' ')
    .filter(Boolean)
    .map(singularizeFrenchToken)
    .join(' ');

  return value;
}

const IRREGULAR_SINGULARS: Record<string, string> = {
  oeufs: 'oeuf',
  yeux: 'oeil',
  choux: 'chou',
  genoux: 'genou',
  cailloux: 'caillou',
  hiboux: 'hibou',
  joujoux: 'joujou',
  poux: 'pou',
};

function singularizeFrenchToken(token: string): string {
  if (token.length <= 3) return token;

  const irregular = IRREGULAR_SINGULARS[token];
  if (irregular) return irregular;

  if (token.endsWith('aux') && token.length > 4) {
    return `${token.slice(0, -3)}al`;
  }

  if (token.endsWith('eaux')) {
    return `${token.slice(0, -1)}`;
  }

  if (token.endsWith('eux') && token.length > 4) {
    return `${token.slice(0, -1)}`;
  }

  if (/(?:ss|us|is|as|os|xs)$/.test(token)) {
    return token;
  }

  if (token.endsWith('s')) {
    return token.slice(0, -1);
  }

  if (token.endsWith('x') && !token.endsWith('ix')) {
    return token.slice(0, -1);
  }

  return token;
}
