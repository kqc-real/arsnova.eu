import { DOCUMENT } from '@angular/common';
import { Injectable, inject, isDevMode, LOCALE_ID, REQUEST } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { type UrlTree, Router } from '@angular/router';
import type { SupportedLocale } from './locale-from-path';
import { SUPPORTED_LOCALES } from './locale-from-path';
import { resolveSeoForPath, type SeoRoutePayload } from './seo-route-meta';

const SITE_ORIGIN_FALLBACK = 'https://arsnova.eu';
const JSON_LD_SCRIPT_ID = 'arsnova-schema-org';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly doc = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly localeId = inject(LOCALE_ID);
  private readonly request = inject(REQUEST, { optional: true });

  /** Nach Navigation und einmal beim Init (AppComponent / SSR) aufrufen. */
  applyFromRouter(): void {
    const treeUrl = normalizeRouterUrl(
      this.router.lastSuccessfulNavigation()?.finalUrl ?? this.router.parseUrl(this.router.url),
    );
    this.applyForPath(treeUrl);
  }

  private applyForPath(treeUrl: string): void {
    const { locale, pathRest } = parseLocalePath(treeUrl, this.localeId);
    const origin = resolveSiteOrigin(this.doc, this.request);
    const canonicalPath = buildCanonicalPath(locale, pathRest);
    const absoluteUrl = `${origin}${canonicalPath}`;
    const payload = resolveSeoForPath(pathRest);

    this.title.setTitle(payload.title);
    this.meta.updateTag({ name: 'description', content: payload.description });

    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:title', content: payload.title });
    this.meta.updateTag({ property: 'og:description', content: payload.description });
    this.meta.updateTag({ property: 'og:url', content: absoluteUrl });
    this.meta.updateTag({ property: 'og:site_name', content: 'arsnova.eu' });
    this.meta.updateTag({ property: 'og:locale', content: ogLocaleFor(locale) });
    this.setOgLocaleAlternates(locale);
    this.setOgImageTags(origin, locale);

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: payload.title });
    this.meta.updateTag({ name: 'twitter:description', content: payload.description });

    this.setCanonicalHref(absoluteUrl);

    this.setJsonLdFromRoute(pathRest, payload, absoluteUrl, origin, locale);

    if (payload.noindex) {
      this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    } else {
      this.meta.removeTag('name="robots"');
    }
  }

  /** Startseite: WebSite + Organization (schema.org); andere Routen: Script entfernen. */
  private setJsonLdFromRoute(
    pathRest: string,
    payload: SeoRoutePayload,
    absoluteUrl: string,
    origin: string,
    locale: SupportedLocale,
  ): void {
    const head = this.doc.head;
    if (!head) return;
    head.querySelector(`#${JSON_LD_SCRIPT_ID}`)?.remove();
    if (payload.noindex || pathRest !== '/') {
      return;
    }
    const orgId = `${origin}/#organization`;
    const logoUrl = `${origin}/${locale}/assets/icons/icon-512x512.png`;
    const siteId = `${origin}/${locale}/#website`;
    const graph = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': orgId,
          name: 'arsnova.eu',
          url: `${origin}/${locale}/`,
          logo: logoUrl,
        },
        {
          '@type': 'WebSite',
          '@id': siteId,
          name: 'arsnova.eu',
          url: absoluteUrl,
          description: payload.description,
          inLanguage: bcp47ForLocale(locale),
          publisher: { '@id': orgId },
        },
      ],
    };
    const script = this.doc.createElement('script');
    script.id = JSON_LD_SCRIPT_ID;
    script.type = 'application/ld+json';
    script.text = JSON.stringify(graph).replace(/</g, '\\u003c');
    head.appendChild(script);
  }

  private setCanonicalHref(href: string): void {
    const head = this.doc.head;
    if (!head) return;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  private setOgLocaleAlternates(current: SupportedLocale): void {
    const head = this.doc.head;
    if (!head) return;
    head.querySelectorAll('meta[property="og:locale:alternate"]').forEach((el) => el.remove());
    for (const loc of SUPPORTED_LOCALES) {
      if (loc === current) continue;
      const meta = this.doc.createElement('meta');
      meta.setAttribute('property', 'og:locale:alternate');
      meta.setAttribute('content', ogLocaleFor(loc));
      head.appendChild(meta);
    }
  }

  private setOgImageTags(origin: string, locale: SupportedLocale): void {
    const imageUrl = `${origin}/${locale}/assets/icons/icon-512x512.png`;
    this.meta.updateTag({ property: 'og:image', content: imageUrl });
    this.meta.updateTag({ property: 'og:image:width', content: '512' });
    this.meta.updateTag({ property: 'og:image:height', content: '512' });
    this.meta.updateTag({ property: 'og:image:alt', content: 'arsnova.eu' });
    this.meta.updateTag({ name: 'twitter:image', content: imageUrl });
  }
}

function resolveSiteOrigin(doc: Document, request: Request | null | undefined): string {
  const baseUriOrigin = tryGetOriginFromDocumentBase(doc);
  if (baseUriOrigin) {
    return normalizeOrigin(baseUriOrigin);
  }

  const loc = doc.defaultView?.location;
  if (loc?.origin && loc.origin !== 'null') {
    return normalizeOrigin(loc.origin, loc.hostname);
  }

  const requestOrigin = tryGetOriginFromRequest(request);
  if (requestOrigin) {
    return normalizeOrigin(requestOrigin);
  }

  return SITE_ORIGIN_FALLBACK;
}

function normalizeRouterUrl(url: UrlTree): string {
  const serialized = url.toString();
  return serialized ? serialized.split('?')[0].split('#')[0] || '/' : '/';
}

function tryGetOriginFromUrl(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (!parsed.origin || parsed.origin === 'null' || parsed.protocol === 'about:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function tryGetOriginFromDocumentBase(doc: Document): string | null {
  try {
    return tryGetOriginFromUrl(doc.baseURI);
  } catch {
    return null;
  }
}

function tryGetOriginFromRequest(request: Request | null | undefined): string | null {
  if (!request) return null;
  try {
    const parsed = new URL(request.url);
    if (!parsed.origin || parsed.origin === 'null') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function normalizeOrigin(origin: string, hostname?: string): string {
  const protocol = safeProtocol(origin);
  if (protocol !== 'http:' && protocol !== 'https:') {
    return SITE_ORIGIN_FALLBACK;
  }
  const host = hostname ?? safeHostname(origin);
  const looksLocal =
    host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local');
  if (!isDevMode() && looksLocal) {
    return SITE_ORIGIN_FALLBACK;
  }
  return origin;
}

function safeHostname(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

function safeProtocol(origin: string): string {
  try {
    return new URL(origin).protocol;
  } catch {
    return '';
  }
}

function parseLocalePath(
  treeUrl: string,
  buildLocaleId: string,
): { locale: SupportedLocale; pathRest: string } {
  const normalized = treeUrl.startsWith('/') ? treeUrl : `/${treeUrl}`;
  const match = normalized.match(/^\/(de|en|fr|it|es)(\/.*)?$/);
  if (match) {
    const loc = match[1] as SupportedLocale;
    const tail = match[2] ?? '';
    const pathRest = tail === '' ? '/' : tail.replace(/\/+$/, '') || '/';
    return { locale: loc, pathRest };
  }
  const fallbackLocale = (SUPPORTED_LOCALES as readonly string[]).includes(buildLocaleId)
    ? (buildLocaleId as SupportedLocale)
    : 'de';
  const trimmed = normalized.replace(/\/+$/, '') || '/';
  const pathRest = trimmed === '/' ? '/' : trimmed;
  return { locale: fallbackLocale, pathRest };
}

function buildCanonicalPath(locale: SupportedLocale, pathRest: string): string {
  if (pathRest === '/' || pathRest === '') {
    return `/${locale}/`;
  }
  const withSlash = pathRest.startsWith('/') ? pathRest : `/${pathRest}`;
  return `/${locale}${withSlash}`;
}

function ogLocaleFor(locale: SupportedLocale): string {
  const map: Record<SupportedLocale, string> = {
    de: 'de_DE',
    en: 'en_US',
    fr: 'fr_FR',
    it: 'it_IT',
    es: 'es_ES',
  };
  return map[locale];
}

/** BCP 47 für schema.org `inLanguage`. */
function bcp47ForLocale(locale: SupportedLocale): string {
  const map: Record<SupportedLocale, string> = {
    de: 'de-DE',
    en: 'en-US',
    fr: 'fr-FR',
    it: 'it-IT',
    es: 'es-ES',
  };
  return map[locale];
}
