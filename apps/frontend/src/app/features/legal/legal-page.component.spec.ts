import { Location } from '@angular/common';
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

  it('ruft bei Klick auf den Backdrop location.back auf', async () => {
    const fixture = TestBed.createComponent(LegalPageComponent);
    const location = TestBed.inject(Location);
    const spy = vi.spyOn(location, 'back');
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url.includes('assets/legal/imprint.de.md'));
    req.flush('# Titel\n\nText.');
    await fixture.whenStable();
    fixture.detectChanges();
    const backdrop = (fixture.nativeElement as HTMLElement).querySelector(
      '.content-page-backdrop-sheet',
    );
    expect(backdrop).toBeTruthy();
    backdrop!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(spy).toHaveBeenCalledOnce();
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

  it('rendert Listen und Fettungen aus dem Privacy-Markdown korrekt', async () => {
    const route = TestBed.inject(ActivatedRoute) as {
      snapshot: { data: { slug: string } };
    };
    route.snapshot.data.slug = 'privacy';

    const fixture = TestBed.createComponent(LegalPageComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('assets/legal/privacy.de.md'));
    req.flush(
      [
        '# Datenschutz',
        '',
        'Sie haben folgende Rechte:',
        '',
        '- **Auskunft** über Ihre Daten',
        '- **Berichtigung** unrichtiger Daten',
      ].join('\n'),
    );

    await fixture.whenStable();
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const listItems = Array.from(root.querySelectorAll('.legal-page__md li'));
    expect(listItems).toHaveLength(2);
    expect(listItems[0].querySelector('strong')?.textContent).toBe('Auskunft');
    expect(listItems[1].querySelector('strong')?.textContent).toBe('Berichtigung');
  });
});
