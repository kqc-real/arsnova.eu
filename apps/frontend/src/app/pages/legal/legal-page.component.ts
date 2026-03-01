import { Component, inject, NgZone, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { marked } from 'marked';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-legal-page',
  imports: [RouterLink, MatButton, MatIcon],
  template: `
    <div class="legal-page l-page">
      <a matButton routerLink="/" class="legal-back" aria-label="Zurück zur Startseite">
        <mat-icon>arrow_back</mat-icon>
        Startseite
      </a>

      @if (loading()) {
        <p class="legal-loading">Wird geladen…</p>
      } @else if (error()) {
        <p class="legal-error" role="alert">{{ error() }}</p>
      } @else if (content()) {
        <article class="legal-article" [innerHTML]="content()"></article>
      }
    </div>
  `,
  styles: [`
    .legal-page {
      padding-bottom: 3rem;
      padding-inline: 1.5rem;
      min-width: 0;
      overflow-x: clip;
    }

    @media (min-width: 600px) {
      .legal-page {
        padding-inline: 2rem;
      }
    }

    @media (min-width: 840px) {
      .legal-page {
        padding-inline: 2.5rem;
      }
    }

    .legal-back {
      margin-bottom: 2rem;
    }

    .legal-loading,
    .legal-error {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-large);
    }

    .legal-error {
      color: var(--mat-sys-error);
    }

    .legal-article {
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface);
      line-height: 1.7;
      max-inline-size: min(65ch, 100%);
      margin-inline: auto;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    .legal-article :deep(h1) {
      font: var(--mat-sys-headline-large);
      color: var(--mat-sys-on-surface);
      margin: 0 0 0.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    .legal-article :deep(h1 + p) {
      margin-top: 0;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .legal-article :deep(h2) {
      font: var(--mat-sys-title-large);
      color: var(--mat-sys-on-surface);
      margin: 2rem 0 0.5rem;
    }

    .legal-article :deep(h2:first-of-type) {
      margin-top: 1.5rem;
    }

    .legal-article :deep(p) {
      margin: 0 0 1rem;
    }

    .legal-article :deep(p:last-child) {
      margin-bottom: 0;
    }

    .legal-article :deep(ul) {
      margin: 0 0 1rem;
      padding-left: 1.5rem;
    }

    .legal-article :deep(li) {
      margin-bottom: 0.5rem;
    }

    .legal-article :deep(li::marker) {
      color: var(--mat-sys-primary);
    }

    .legal-article :deep(hr) {
      border: none;
      border-top: 1px solid var(--mat-sys-outline-variant);
      margin: 2rem 0;
    }

    .legal-article :deep(strong) {
      font-weight: 600;
      color: var(--mat-sys-on-surface);
    }

    .legal-article :deep(a) {
      color: var(--mat-sys-primary);
      text-decoration: none;
      border-radius: 2px;
      transition: text-decoration 0.15s ease;
    }

    .legal-article :deep(a:hover) {
      text-decoration: underline;
    }

    .legal-article :deep(a:focus-visible) {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
  `],
})
export class LegalPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly ngZone = inject(NgZone);
  private readonly destroy$ = new Subject<void>();

  loading = signal(true);
  error = signal<string | null>(null);
  content = signal<SafeHtml | null>(null);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((paramMap) => {
      const slug = paramMap.get('slug') ?? '';
      this.loading.set(true);
      this.error.set(null);
      this.content.set(null);

      if (slug !== 'imprint' && slug !== 'privacy') {
        this.error.set('Seite nicht gefunden.');
        this.loading.set(false);
        return;
      }

      const lang = 'de';
      const baseHref = document.querySelector('base')?.getAttribute('href') ?? '/';
      const baseUrl = `${window.location.origin}${baseHref.endsWith('/') ? baseHref : baseHref + '/'}`;
      const path = `${baseUrl.replace(/\/$/, '')}/assets/legal/${slug}.${lang}.md`;

      this.http.get(path, { responseType: 'text' }).subscribe({
        next: (md) => {
          Promise.resolve(marked.parse(md)).then((html: string) => {
            this.ngZone.run(() => {
              this.content.set(this.sanitizer.bypassSecurityTrustHtml(html));
              this.loading.set(false);
            });
          });
        },
        error: () => {
          this.error.set('Seite konnte nicht geladen werden.');
          this.loading.set(false);
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
