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

/**
 * Locale-sichere URL zur Informationsseite.
 * Niemals nur die Domainwurzel — immer `/{locale}/` (+ optionaler kanonischer Hash).
 */
export function infoLandingUrl(
  anchor?: InfoLandingAnchor | null,
  locale: SupportedLocale = getEffectiveLocale(),
): string {
  const path = `${INFO_LANDING_ORIGIN.replace(/\/$/, '')}/${locale}/`;
  if (!anchor) {
    return path;
  }
  return `${path}#${anchor}`;
}
