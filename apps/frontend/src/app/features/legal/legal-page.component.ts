import { Location } from '@angular/common';
import { Component, inject, LOCALE_ID, NgZone, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import {
  getEffectiveLocale,
  localeIdToSupported,
  resolveAssetUrlFromBase,
  type SupportedLocale,
} from '../../core/locale-from-path';
import { renderMarkdownWithoutKatex } from '../../shared/markdown-katex.util';

/** Entfernt die erste Markdown-Überschrift (h1–h6), die den Dialog-Titel doppelt. */
export function stripLeadingMarkdownTitle(html: string): string {
  return html.replace(/^\s*<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>\s*/i, '');
}

@Component({
  selector: 'app-legal-page',
  imports: [MatButton, MatIcon],
  templateUrl: './legal-page.component.html',
  styleUrls: [
    '../../shared/styles/dialog-title-header.scss',
    '../../shared/styles/content-page-backdrop.scss',
    './legal-page.component.scss',
  ],
})
export class LegalPageComponent implements OnInit, OnDestroy {
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly localeId = inject(LOCALE_ID);
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly ngZone = inject(NgZone);
  private readonly destroy$ = new Subject<void>();

  loading = signal(true);
  error = signal<string | null>(null);
  content = signal<SafeHtml | null>(null);
  /** Aktuelle Legal-Route (für Kopfzeile); leer während des ersten Ladens. */
  slug = signal<'imprint' | 'privacy' | 'accessibility' | ''>('');

  back(): void {
    this.location.back();
  }

  private getSlug(): string {
    return (this.route.snapshot.data['slug'] ??
      this.route.snapshot.paramMap.get('slug') ??
      '') as string;
  }

  private isKnownSlug(slug: string): slug is 'imprint' | 'privacy' | 'accessibility' {
    return slug === 'imprint' || slug === 'privacy' || slug === 'accessibility';
  }

  ngOnInit(): void {
    this.route.data.pipe(takeUntil(this.destroy$)).subscribe(() => {
      const slug = this.getSlug();
      this.loading.set(true);
      this.error.set(null);
      this.content.set(null);
      this.slug.set(this.isKnownSlug(slug) ? slug : '');

      if (!this.isKnownSlug(slug)) {
        this.error.set($localize`Seite nicht gefunden.`);
        this.loading.set(false);
        return;
      }

      const locale: SupportedLocale = getEffectiveLocale(localeIdToSupported(this.localeId));

      const tryLoad = (lang: SupportedLocale) => {
        const path = resolveAssetUrlFromBase(`assets/legal/${slug}.${lang}.md`);
        this.http.get(path, { responseType: 'text' }).subscribe({
          next: (md) => {
            this.ngZone.run(() => {
              // Legal-Markdown: `#` → h1 (wird gestrippt), `##` → h2 unter dem UI-h1.
              // Default headingStartLevel 2 würde nach dem Strip h1→h3 erzeugen (heading-order).
              const html = renderMarkdownWithoutKatex(md, { headingStartLevel: 1 });
              const withoutLeadingTitle = stripLeadingMarkdownTitle(html);
              this.content.set(this.sanitizer.bypassSecurityTrustHtml(withoutLeadingTitle));
              this.loading.set(false);
            });
          },
          error: () => {
            if (lang !== 'de') {
              tryLoad('de');
            } else {
              this.error.set($localize`Seite konnte nicht geladen werden.`);
              this.loading.set(false);
            }
          },
        });
      };
      tryLoad(locale);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
