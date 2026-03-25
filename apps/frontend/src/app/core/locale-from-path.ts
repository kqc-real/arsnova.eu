/**
 * Liest die aktuelle Locale aus dem ersten URL-Segment (z. B. /en/... → "en").
 * Wird für Toolbar und Dev mit &lt;base href="/"&gt; verwendet.
 */
export const SUPPORTED_LOCALES = ['de', 'en', 'fr', 'it', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Muss mit der Toolbar (`TopToolbarComponent`) übereinstimmen. */
export const HOME_LANGUAGE_LOCAL_STORAGE_KEY = 'home-language';

const LOCALE_REGEX = /^\/(de|en|fr|it|es)(?:\/|$)/;

export function getLocaleFromPath(): SupportedLocale | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(LOCALE_REGEX);
  return match ? (match[1] as SupportedLocale) : null;
}

/** Erkennt `/de/quiz` auch in `Router.url` (kann kurz von `location.pathname` abweichen). */
export function parseLeadingLocaleFromPathOrUrl(pathOrUrl: string): SupportedLocale | null {
  if (!pathOrUrl) return null;
  const pathOnly = pathOrUrl.split(/[?#]/)[0] ?? '';
  const withSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  const m = withSlash.match(LOCALE_REGEX);
  return m ? (m[1] as SupportedLocale) : null;
}

export function getHomeLanguagePreference(): SupportedLocale | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(HOME_LANGUAGE_LOCAL_STORAGE_KEY);
    if (raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
      return raw as SupportedLocale;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Lokalisierte Builds und `ng serve` mit `localize: ["en"]`: &lt;base href="/en/"&gt;.
 * Dann steht die Locale nicht im pathname (z. B. /legal/imprint), sondern nur in der Basis-URL.
 */
export function getLocaleFromBaseHref(): SupportedLocale | null {
  if (typeof document === 'undefined') return null;
  const raw = (document.querySelector('base')?.getAttribute('href') ?? '/').trim();
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://local';
    const pathname = new URL(raw, origin).pathname.replace(/\/+$/, '') || '/';
    const m = pathname.match(/^\/(de|en|fr|it|es)$/);
    return m ? (m[1] as SupportedLocale) : null;
  } catch {
    return null;
  }
}

/** Normalisiert Angular-`LOCALE_ID` (z. B. `en-US`) auf unsere URL-Sprachen. */
export function localeIdToSupported(localeId: string): SupportedLocale {
  const base = (localeId ?? 'de').split('-')[0]!.toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(base) ? (base as SupportedLocale) : 'de';
}

/**
 * Effektive UI-/Asset-Locale: zuerst explizites Sprachsegment im **pathname** (`/de/quiz` …),
 * dann &lt;base href&gt; (lokalisierte Ein-Sprachen-Builds ohne Präfix in der URL), dann
 * optional Build-Locale (`LOCALE_ID`), sonst `de`.
 *
 * Pfad vor Base: Der Toolbar-Sprachwechsel setzt `window.location` auf ein anderes Präfix, während
 * &lt;base href&gt; oft weiter der localize-Build-Sprache entspricht — sonst bliebe z. B. die Demo immer EN.
 */
export function getEffectiveLocale(fallbackFromBuild?: SupportedLocale): SupportedLocale {
  const fromPath = getLocaleFromPath();
  if (fromPath) return fromPath;
  const fromBase = getLocaleFromBaseHref();
  if (fromBase) return fromBase;
  return fallbackFromBuild ?? 'de';
}

/**
 * Absolute URL für Pfade unter `assets/` — auflösen wie der Browser relativ zu &lt;base href&gt;,
 * damit z. B. `ng serve` mit `localize` und `/en/` dieselbe Basis trifft wie `HttpClient`/Router.
 */
export function resolveAssetUrlFromBase(assetPathFromAppRoot: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return `/${assetPathFromAppRoot.replace(/^\/+/, '')}`;
  }
  const rawBase = (document.querySelector('base')?.getAttribute('href') ?? '/').trim();
  const baseHrefUrl = new URL(rawBase || '/', window.location.origin).href;
  const rel = assetPathFromAppRoot.replace(/^\/+/, '');
  return new URL(rel, baseHrefUrl).href;
}
