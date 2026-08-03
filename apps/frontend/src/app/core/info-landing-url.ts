import { getEffectiveLocale, type SupportedLocale } from './locale-from-path';

/** Öffentliche Informationsseite (Astro Landing). */
export const INFO_LANDING_ORIGIN = 'https://info.arsnova.eu';

/** Kanonische Deep-Link-Anker (Issue #192); sprachneutral und in allen Locales identisch. */
export const INFO_LANDING_ANCHORS = {
  workflow: 'workflow',
  numericEstimate: 'numeric-estimate',
  confidence: 'confidence',
  qaWall: 'qa-wall',
  features: 'features',
  accessibility: 'accessibility',
  trust: 'trust',
  comparison: 'comparison',
  faq: 'faq',
} as const;

export type InfoLandingAnchor = (typeof INFO_LANDING_ANCHORS)[keyof typeof INFO_LANDING_ANCHORS];

/** Darstellungsmodus für Cross-Origin-Übergabe an die Informationsseite (Issue #207). */
export type InfoLandingTheme = 'system' | 'light' | 'dark';

const INFO_LANDING_THEMES: readonly InfoLandingTheme[] = ['system', 'light', 'dark'];

function isInfoLandingTheme(value: unknown): value is InfoLandingTheme {
  return typeof value === 'string' && (INFO_LANDING_THEMES as readonly string[]).includes(value);
}

/**
 * Locale-sichere URL zur Informationsseite.
 * Niemals nur die Domainwurzel — immer `/{locale}/` (+ optionaler Theme-Query und kanonischer Hash).
 * Query steht vor dem Hash: `/{locale}/?theme=dark#features`.
 */
export function infoLandingUrl(
  anchor?: InfoLandingAnchor | null,
  locale: SupportedLocale = getEffectiveLocale(),
  theme?: InfoLandingTheme,
): string {
  const path = `${INFO_LANDING_ORIGIN.replace(/\/$/, '')}/${locale}/`;
  const query = isInfoLandingTheme(theme) ? `?theme=${theme}` : '';
  const hash = anchor ? `#${anchor}` : '';
  return `${path}${query}${hash}`;
}
