/**
 * GitHub-Repo-URL für alle CTAs und Links.
 * Gesetzt via PUBLIC_GITHUB_REPO (z. B. owner/repo) beim Build;
 * in CI: PUBLIC_GITHUB_REPO=${{ github.repository }}.
 * Lokal: PUBLIC_GITHUB_REPO=$(node scripts/get-github-repo.mjs) oder Fallback.
 */
const repo = import.meta.env.PUBLIC_GITHUB_REPO || 'kqc-real/arsnova.eu';
export const GITHUB_REPO = repo;
export const GITHUB_URL = `https://github.com/${repo}`;
export const GITHUB_DOCS_URL = `${GITHUB_URL}/blob/main/docs/ARS-comparison/Kahoot-Mentimeter-Slido-arsnova.click-v3.md`;

/** App origin without trailing slash (override via PUBLIC_APP_URL_V3). */
export const APP_URL_V3 = (import.meta.env.PUBLIC_APP_URL_V3 || 'https://arsnova.eu').replace(
  /\/$/,
  '',
);

/** Locale-prefixed app home, e.g. https://arsnova.eu/de/ */
export function appHomeUrl(locale: string): string {
  return `${APP_URL_V3}/${locale}/`;
}

/** Locale-prefixed legal pages in the SPA. */
export function appLegalUrl(slug: 'imprint' | 'privacy' | 'accessibility', locale = 'de'): string {
  return `${APP_URL_V3}/${locale}/legal/${slug}`;
}

export function appAccessibilityUrl(locale: string): string {
  return appLegalUrl('accessibility', locale);
}
