import { Location } from '@angular/common';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReplaySubject } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { LegalPageComponent, stripLeadingMarkdownTitle } from './legal-page.component';

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
        provideRouter([]),
        { provide: MatDialog, useValue: { openDialogs: [] } },
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

  it('entfernt die führende Markdown-Überschrift unabhängig vom Heading-Level', () => {
    expect(stripLeadingMarkdownTitle('<h2>Impressum</h2>\n<p>Text</p>\n')).toBe('<p>Text</p>\n');
    expect(stripLeadingMarkdownTitle('<h1>Privacy</h1><p>Body</p>')).toBe('<p>Body</p>');
    expect(stripLeadingMarkdownTitle('<h3>Barrierefreiheit</h3>\n<p>Stand</p>')).toBe(
      '<p>Stand</p>',
    );
    expect(stripLeadingMarkdownTitle('<p>Nur Text</p>')).toBe('<p>Nur Text</p>');
  });

  it('ruft bei Klick auf den Backdrop location.back auf', async () => {
    Object.defineProperty(window.history, 'length', { configurable: true, value: 3 });
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

  it('schließt per Escape und hält den Fokus im Panel', async () => {
    Object.defineProperty(window.history, 'length', { configurable: true, value: 3 });
    const fixture = TestBed.createComponent(LegalPageComponent);
    const location = TestBed.inject(Location);
    const spy = vi.spyOn(location, 'back');
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url.includes('assets/legal/imprint.de.md'));
    req.flush('# Titel\n\nText.');
    await fixture.whenStable();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.content-page-panel') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(2);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('bietet einen zweiten Zurück-Button am Seitenende', async () => {
    Object.defineProperty(window.history, 'length', { configurable: true, value: 3 });
    const fixture = TestBed.createComponent(LegalPageComponent);
    const location = TestBed.inject(Location);
    const spy = vi.spyOn(location, 'back');
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url.includes('assets/legal/imprint.de.md'));
    req.flush('# Titel\n\nText.');
    await fixture.whenStable();
    fixture.detectChanges();

    const backNavs = fixture.nativeElement.querySelectorAll('nav.legal-back');
    expect(backNavs).toHaveLength(2);
    expect(backNavs[0]?.getAttribute('aria-label')).toBe('Navigation');
    expect(backNavs[1]?.getAttribute('aria-label')).toBe('Navigation am Seitenende');
    const bottomBack = fixture.nativeElement.querySelector(
      'nav.legal-back--bottom button',
    ) as HTMLButtonElement | null;
    expect(bottomBack).toBeTruthy();
    bottomBack!.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('behält den Dialogtitel im Lade- und Fehlerzustand', async () => {
    const fixture = TestBed.createComponent(LegalPageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#legal-page-title')?.textContent).toContain(
      'Impressum',
    );

    const req = httpMock.expectOne((r) => r.url.includes('assets/legal/imprint.de.md'));
    req.flush('fail', { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#legal-page-title')?.textContent).toContain(
      'Impressum',
    );
    expect(fixture.nativeElement.querySelector('.legal-error')).toBeTruthy();
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
    const md = root.querySelector('.legal-page__md');
    expect(md?.textContent).toContain('Welt');
    expect(md?.textContent).not.toMatch(/^\s*Titel/);
    expect(md?.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
    expect(root.querySelectorAll('h1').length).toBe(1);
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
        '## Betroffenenrechte',
        '',
        '- **Auskunft** über Ihre Daten',
        '- **Berichtigung** unrichtiger Daten',
      ].join('\n'),
    );

    await fixture.whenStable();
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const md = root.querySelector('.legal-page__md');
    expect(md?.querySelector('h1')?.textContent?.trim()).not.toBe('Datenschutz');
    expect(md?.querySelector('h2')?.textContent?.trim()).toBe('Betroffenenrechte');
    const listItems = Array.from(root.querySelectorAll('.legal-page__md li'));
    expect(listItems).toHaveLength(2);
    expect(listItems[0].querySelector('strong')?.textContent).toBe('Auskunft');
    expect(listItems[1].querySelector('strong')?.textContent).toBe('Berichtigung');
    // UI-h1, dann Abschnitte als h2 (kein übersprungenes Level).
    const headingTags = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(
      (el) => el.tagName,
    );
    expect(headingTags).toEqual(['H1', 'H2']);
  });

  it('lädt Accessibility-Markdown und zeigt den Seiten-Titel Barrierefreiheit', async () => {
    const route = TestBed.inject(ActivatedRoute) as {
      snapshot: { data: { slug: string } };
    };
    route.snapshot.data.slug = 'accessibility';

    const fixture = TestBed.createComponent(LegalPageComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('assets/legal/accessibility.de.md'));
    req.flush('# Barrierefreiheit\n\n## Was du nutzen kannst\n\nText zur **Persönliche Zeit**.');

    await fixture.whenStable();
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.dialog-title-header__heading')?.textContent).toContain(
      'Barrierefreiheit',
    );
    expect(root.querySelector('.dialog-title-header__icon mat-icon')?.textContent?.trim()).toBe(
      'accessibility',
    );
    const md = root.querySelector('.legal-page__md');
    expect(md?.textContent).toContain('Persönliche Zeit');
    expect(md?.querySelector('h1, h2')?.textContent?.trim()).not.toBe('Barrierefreiheit');
    expect(md?.querySelector('h2')?.textContent?.trim()).toBe('Was du nutzen kannst');
    expect(root.querySelectorAll('h1').length).toBe(1);
  });
});
