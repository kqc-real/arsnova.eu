import { Component, inject, NgZone, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-legal-page',
  imports: [],
  templateUrl: './legal-page.component.html',
  styleUrls: ['./legal-page.component.scss'],
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

  private getSlug(): string {
    return (this.route.snapshot.data['slug'] ?? this.route.snapshot.paramMap.get('slug') ?? '') as string;
  }

  ngOnInit(): void {
    this.route.data.pipe(takeUntil(this.destroy$)).subscribe(() => {
      const slug = this.getSlug();
      this.loading.set(true);
      this.error.set(null);
      this.content.set(null);

      if (slug !== 'imprint' && slug !== 'privacy') {
        this.error.set('Seite nicht gefunden.');
        this.loading.set(false);
        return;
      }

      if (typeof document === 'undefined') {
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
