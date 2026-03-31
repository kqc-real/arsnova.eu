import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReplaySubject } from 'rxjs';
import { LegalPageComponent } from './legal-page.component';

describe('LegalPageComponent', () => {
  let httpMock: HttpTestingController;
  const data$ = new ReplaySubject<Record<string, unknown>>(1);

  beforeEach(async () => {
    data$.next({});
    await TestBed.configureTestingModule({
      imports: [LegalPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: {
            data: data$.asObservable(),
            snapshot: {
              data: { slug: 'imprint' },
              paramMap: { get: () => null },
            },
          },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lädt Markdown per HttpClient und rendert Inhalt (kein leerer SSR-Abbruch)', async () => {
    const fixture = TestBed.createComponent(LegalPageComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('assets/legal/imprint.de.md'));
    expect(req.request.method).toBe('GET');
    req.flush('# Titel\n\nHallo **Welt**.');

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.content()).toBeTruthy();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.legal-page__md')?.textContent).toContain('Welt');
  });
});
