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

/** CTA: stabile Version (v2) */
export const APP_URL_V2 = import.meta.env.PUBLIC_APP_URL_V2 || 'https://arsnova.eu';
/** CTA: App (Beta) – z. B. Demo oder gleiche URL bis Server steht */
export const APP_URL_V3 = import.meta.env.PUBLIC_APP_URL_V3 || 'https://arsnova.eu';
