/** Canonical, language-neutral section anchors used in all locales. */
export const CANONICAL_ANCHORS = [
  'workflow',
  'numeric-estimate',
  'confidence',
  'qa-wall',
  'features',
  'accessibility',
  'trust',
  'comparison',
  'faq',
  'start',
] as const;

export type CanonicalAnchor = (typeof CANONICAL_ANCHORS)[number];

/** Legacy German hash aliases → canonical anchors (must keep working). */
export const LEGACY_ANCHOR_ALIASES: Record<string, CanonicalAnchor> = {
  ablauf: 'workflow',
  schaetzfrage: 'numeric-estimate',
  selbsteinschaetzung: 'confidence',
  fragenwand: 'qa-wall',
  barrierefreiheit: 'accessibility',
  vertrauen: 'trust',
  vergleich: 'comparison',
};

/** Alias ids that should exist as empty elements next to canonical section ids. */
export const LEGACY_ALIAS_IDS = Object.keys(LEGACY_ANCHOR_ALIASES);

export function canonicalizeHash(hash: string): string {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return '';
  const canonical = LEGACY_ANCHOR_ALIASES[raw] ?? raw;
  return `#${canonical}`;
}

export function localePath(locale: string, hash = ''): string {
  const normalized = hash ? canonicalizeHash(hash) : '';
  return `/${locale}/${normalized}`;
}
