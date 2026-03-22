import { DOCUMENT } from '@angular/common';
import { Injectable, inject, isDevMode, LOCALE_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import type { SupportedLocale } from './locale-from-path';
import { SUPPORTED_LOCALES } from './locale-from-path';
import { resolveSeoForPath } from './seo-route-meta';

const SITE_ORIGIN_FALLBACK = 'https://arsnova.eu';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly doc = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly localeId = inject(LOCALE_ID);

  /** Nach Navigation und einmal beim Init (AppComponent / SSR) aufrufen. */
  applyFromRouter(): void {
    const treeUrl = this.router.url.split('?')[0].split('#')[0] || '/';
    this.applyForPath(treeUrl);
  }

  private applyForPath(treeUrl: string): void {
    const { locale, pathRest } = parseLocalePath(treeUrl, this.localeId);
    const origin = resolveSiteOrigin(this.doc);
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

    if (payload.noindex) {
      this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    } else {
      this.meta.removeTag('name="robots"');
    }
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

function resolveSiteOrigin(doc: Document): string {
  const loc = doc.defaultView?.location;
  if (loc?.origin && loc.origin !== 'null') {
    const host = loc.hostname;
    const looksLocal =
      host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local');
    // Prerender/Prod-Build: echte Canonical-/OG-URLs statt localhost-Port.
    if (!isDevMode() && looksLocal) {
      return SITE_ORIGIN_FALLBACK;
    }
    return loc.origin;
  }
  return SITE_ORIGIN_FALLBACK;
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
