/**
 * Kanonische Produktions-Origin für MOTD-Bilder bei SSR/Prerender (ohne Browser).
 * Im Browser: `window.location.origin` (Staging/Preview-tauglich).
 */
export const DEFAULT_MOTD_PUBLIC_ORIGIN = 'https://arsnova.eu';

/** Für `<img src="/assets/…">` in MOTD-[innerHTML]: volle URL, konsistent mit &lt;base href&gt; pro Locale. */
export function resolveMotdAssetOrigin(): string {
  if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
    const origin = (globalThis as { location?: { origin?: string } }).location?.origin;
    if (origin && /^https?:\/\//i.test(origin)) {
      return origin;
    }
  }
  return DEFAULT_MOTD_PUBLIC_ORIGIN;
}
