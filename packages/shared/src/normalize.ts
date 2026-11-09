/**
 * Normalise un nom de produit pour l'anti-doublons / recherche.
 * 1. trim
 * 2. lowercase
 * 3. translittération des ligatures (œ→oe, æ→ae, …)
 * 4. NFD + suppression des diacritiques
 * 5. collapse espaces / tirets
 * 6. singularisation légère FR (règles itératives simples)
 */
export function normalizeProductName(input: string): string {
  let value = input.trim().toLowerCase();

  // NFD ne décompose pas les ligatures typographiques : les translittérer
  // avant le filtre ASCII, sinon « Œufs » → « ufs » et « Bœuf » → « b uf ».
  value = transliterateLigatures(value);

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

/** Ligatures / digraphes courants (déjà en minuscules). */
const LIGATURE_MAP: Record<string, string> = {
  œ: 'oe',
  æ: 'ae',
  ß: 'ss',
  ø: 'o',
  đ: 'd',
  ł: 'l',
  ﬁ: 'fi',
  ﬂ: 'fl',
  ﬀ: 'ff',
  ﬃ: 'ffi',
  ﬄ: 'ffl',
};

function transliterateLigatures(value: string): string {
  return value.replace(/[œæßøđłﬁﬂﬀﬃﬄ]/g, (ch) => LIGATURE_MAP[ch] ?? ch);
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
