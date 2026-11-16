import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { QaSortHelpDialogComponent } from './qa-sort-help-dialog.component';
import type { QaSortHelpLocale } from './qa-sort-help.content';

describe('QaSortHelpDialogComponent', () => {
  async function create(
    kind: 'BEST' | 'CONTROVERSIAL',
    locale: QaSortHelpLocale = 'de',
  ): Promise<{
    fixture: ComponentFixture<QaSortHelpDialogComponent>;
    el: HTMLElement;
  }> {
    await TestBed.configureTestingModule({
      imports: [QaSortHelpDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: { kind } },
        { provide: LOCALE_ID, useValue: locale },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(QaSortHelpDialogComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('renders BEST help with Wilson formula', async () => {
    const { el } = await create('BEST');
    expect(el.querySelector('.dialog-title-header__heading')?.textContent?.trim()).toBe(
      'Klare Zustimmung',
    );
    expect(el.querySelector('.qa-sort-help-dialog__body')?.textContent).toContain('Wilson');
    expect(el.querySelector('.qa-sort-help-dialog__body .katex')).toBeTruthy();
    const body = el.querySelector('.qa-sort-help-dialog__body')!;
    expect(body.textContent).toContain('100 % dafür · 1 Stimme');
    expect(body.querySelector('.katex-display')?.textContent).toContain('Wilson-Untergrenze');
    expect(body.querySelector('.katex-display')?.textContent).not.toContain('BestScore');
    expect(body.querySelector('table')?.textContent).toContain('1 dafür, 0 dagegen');
    expect(body.querySelector('.markdown-katex-error')).toBeNull();
    expect(body.innerHTML).not.toContain('\\(');
    expect(body.innerHTML).not.toContain('\\)');
    expect(body.querySelectorAll('.katex-display').length).toBeGreaterThanOrEqual(1);
    expect(body.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(6);
  });

  it.each([
    ['de', 'Die Sortierung beruht auf den abgegebenen Stimmen.'],
    ['en', 'The ranking is based on the votes cast.'],
    ['fr', 'Le classement repose sur les votes exprimés.'],
    ['es', 'La clasificación se basa en los votos emitidos.'],
    ['it', 'L’ordinamento si basa sui voti espressi.'],
  ] as const)('renders the voting note and NIST source in %s', async (locale, note) => {
    const { el } = await create('BEST', locale);
    const body = el.querySelector('.qa-sort-help-dialog__body')!;
    expect(body.querySelector('p')?.textContent).toContain(note);
    const source = body.querySelector('a');
    expect(source?.textContent).toMatch(/NIST.*Wilson/);
    expect(source?.getAttribute('href')).toBe(
      'https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/propconf.htm',
    );
    expect(source?.getAttribute('target')).toBe('_blank');
    expect(source?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it.each([
    ['de', 'Geteilte Stimmen', 'mindestens 6 Stimmen', '0,83', 'Bei gleicher Stimmenzahl'],
    ['en', 'Split votes', 'at least 6 votes', '0.83', 'With the same number of votes'],
    ['fr', 'Votes partagés', 'au moins 6 votes', '0,83', 'À nombre de votes égal'],
    ['es', 'Votos divididos', 'al menos 6 votos', '0,83', 'Con el mismo número de votos'],
    ['it', 'Voti divisi', 'almeno 6 voti', '0,83', 'A parità di numero di voti'],
  ] as const)(
    'renders the fixed damping and minimum vote count in %s',
    async (locale, title, minimum, exampleScore, equalTotal) => {
      const { el } = await create('CONTROVERSIAL', locale);
      expect(el.querySelector('.dialog-title-header__heading')?.textContent?.trim()).toBe(title);
      const body = el.querySelector('.qa-sort-help-dialog__body')!;
      expect(body.textContent).toContain(minimum);
      const intro = body.querySelector('p')?.textContent;
      expect(intro).toContain(equalTotal);
      expect(intro).toMatch(/2:2.*0[,.]50/);
      expect(intro).toMatch(/60:30.*0[,.]64|0[,.]64.*60:30/);
      const source = body.querySelector('a');
      expect(source?.getAttribute('href')).toBe(
        'https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx',
      );
      expect(source?.closest('p')?.textContent).toMatch(/arsnova\.eu.*4:4.*60:30.*Reddit.*60:30/);
      expect(body.querySelector('.katex-display')?.textContent).not.toContain('ControversyScore');
      expect(body.querySelector('table')?.textContent).toContain(exampleScore);
      expect(body.querySelector('.markdown-katex-error')).toBeNull();
      expect(body.innerHTML).not.toContain('\\(');
      expect(body.querySelectorAll('.katex-display').length).toBeGreaterThanOrEqual(2);
    },
  );
});
