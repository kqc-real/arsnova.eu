import { Component, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import type { WordCloudAnalysisVariant } from '@arsnova/shared-types';
import {
  QaWordCloudDialogComponent,
  type QaWordCloudDialogData,
} from './qa-word-cloud-dialog.component';
import { WordCloudComponent } from '../session-present/word-cloud.component';

@Component({
  selector: 'app-word-cloud',
  standalone: true,
  template: '',
})
class WordCloudStubComponent {}

describe('QaWordCloudDialogComponent', () => {
  function setup(
    analysisVariant: WordCloudAnalysisVariant = 'THEME',
    overrides: Partial<QaWordCloudDialogData> = {},
  ) {
    const setAnalysisVariant = vi.fn();
    const setSortMode = vi.fn();
    const data: QaWordCloudDialogData = {
      projected: () => false,
      ownsProjection: () => false,
      setProjected: vi.fn().mockResolvedValue(undefined),
      responses: () => [],
      responseTextsBySourceId: () => ({}),
      weightedResponses: () => [],
      terms: () => null,
      analysisEntries: () => null,
      title: () => 'Q&A-Wortwolke',
      eyebrow: 'Q&A-Analyse',
      description: () => 'Wörter und Wortgruppen, zum Beispiel »klare Erklärung«.',
      wordLabelSingular: () => 'Begriff',
      wordLabelPlural: () => 'Begriffe',
      weightingHint: () => null,
      tooltipMetricLabel: () => 'Stimmensaldo',
      analyzedQuestionCount: () => 12,
      eligibleQuestionCount: () => 18,
      analysisModelVersion: () => null,
      analysisVariant: () => analysisVariant,
      setAnalysisVariant,
      themeModeAvailable: () => true,
      themeFallbackHint: () =>
        analysisVariant === 'SEMANTIC'
          ? 'Themen sind hier nicht verfügbar. Nutze Wörter oder Wortgruppen. Es gelten Wörter und Phrasen.'
          : null,
      themeWaitHint: () => null,
      sortMode: () => 'TOP',
      setSortMode,
      frozen: () => false,
      freezeLabel: () => 'Anzeige anhalten',
      toggleFreeze: vi.fn(),
      smoothingStatus: () => 'idle',
      smoothingLabel: () => 'Wortformen bündeln',
      smoothingHint: () => null,
      smoothingDisabled: () => analysisVariant === 'SEMANTIC',
      toggleSmoothing: vi.fn(),
      itemLabelSingular: 'Frage',
      itemLabelPlural: 'Fragen',
      focusedTermLabel: () => null,
      ...overrides,
    };

    TestBed.configureTestingModule({
      imports: [QaWordCloudDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(QaWordCloudDialogComponent, {
      remove: { imports: [WordCloudComponent] },
      add: { imports: [WordCloudStubComponent], schemas: [NO_ERRORS_SCHEMA] },
    });

    const fixture = TestBed.createComponent(QaWordCloudDialogComponent);
    fixture.detectChanges();
    return { fixture, setAnalysisVariant, setSortMode };
  }

  it('bietet beim Kompass-Einstieg den direkten Rückweg an', async () => {
    const { fixture } = setup('SEMANTIC', { returnToCompassVisible: () => true });
    const ref = fixture.debugElement.injector.get(MatDialogRef);
    const button = fixture.nativeElement.querySelector(
      '[data-testid="qa-word-cloud-return-to-compass"]',
    ) as HTMLButtonElement;

    expect(button.textContent).toContain('Zurück zum Kompass');
    button.click();
    await fixture.whenStable();

    expect(ref.close).toHaveBeenCalledWith({ action: 'return-to-compass' });
  });

  it('blendet eine eigene Projektion vor dem Rückweg aus und bleibt bei Fehler offen', async () => {
    const projected = signal(true);
    const setProjected = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(async () => projected.set(false));
    const { fixture } = setup('SEMANTIC', {
      projected,
      ownsProjection: () => true,
      setProjected,
      returnToCompassVisible: () => true,
    });
    const ref = fixture.debugElement.injector.get(MatDialogRef);

    await fixture.componentInstance.returnToCompass();
    expect(ref.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.projectionError()).toContain('Versuche es erneut');

    await fixture.componentInstance.returnToCompass();
    expect(setProjected).toHaveBeenNthCalledWith(2, false);
    expect(ref.close).toHaveBeenCalledWith({ action: 'return-to-compass' });
  });

  it('zeigt den Rückweg bei einem regulären Wortwolken-Einstieg nicht', () => {
    const { fixture } = setup('SEMANTIC');

    expect(
      fixture.nativeElement.querySelector('[data-testid="qa-word-cloud-return-to-compass"]'),
    ).toBeNull();
  });

  it('projiziert erst auf ausdruecklichen Wunsch und behaelt Fokus und Sperre bis zur Bestaetigung', async () => {
    const projected = signal(false);
    let finish!: () => void;
    const setProjected = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            projected.set(true);
            resolve();
          };
        }),
    );
    const { fixture } = setup('THEME', { projected, ownsProjection: () => true, setProjected });
    const ref = fixture.debugElement.injector.get(MatDialogRef);
    const button = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__project',
    ) as HTMLButtonElement;
    expect(fixture.nativeElement.textContent).toContain('Nicht auf der Präsentation.');
    expect(fixture.nativeElement.textContent).not.toContain('Nur für dich sichtbar.');
    expect(setProjected).not.toHaveBeenCalled();
    button.focus();
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Präsentation wird geändert');
    button.click();
    await fixture.componentInstance.close();
    expect(setProjected).toHaveBeenCalledTimes(1);
    expect(ref.close).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button);
    finish();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Auf der Präsentation sichtbar.');
    expect(fixture.nativeElement.textContent).toContain(
      'Beim Schließen erscheint dort wieder die Fragenwand.',
    );
    expect(document.activeElement).toBe(button);
  });

  it('laesst eine fehlgeschlagene Projektion erneut versuchen', async () => {
    const projected = signal(false);
    const setProjected = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(async () => projected.set(true));
    const { fixture } = setup('THEME', { projected, setProjected });
    const button = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__project',
    ) as HTMLButtonElement;
    button.focus();
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Versuche es erneut.',
    );
    expect(fixture.componentInstance.projected()).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(document.activeElement).toBe(button);
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(projected()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('schliesst die eigene Projektion erst nach bestaetigtem Ausblenden und bleibt bei Fehler offen', async () => {
    const projected = signal(true);
    const setProjected = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(async () => projected.set(false));
    const { fixture } = setup('THEME', { projected, ownsProjection: () => true, setProjected });
    const ref = fixture.debugElement.injector.get(MatDialogRef);
    await fixture.componentInstance.close();
    expect(ref.close).not.toHaveBeenCalled();
    expect(projected()).toBe(true);
    await fixture.componentInstance.close();
    expect(setProjected).toHaveBeenNthCalledWith(2, false);
    expect(ref.close).toHaveBeenCalledOnce();
  });

  it('schliesst die private Ansicht per Escape ohne die Praesentation zu veraendern', async () => {
    const setProjected = vi.fn();
    const { fixture } = setup('THEME', { setProjected });
    const ref = fixture.debugElement.injector.get(MatDialogRef);
    fixture.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await fixture.whenStable();
    expect(ref.close).toHaveBeenCalledOnce();
    expect(setProjected).not.toHaveBeenCalled();
  });

  it('zeigt Ansicht, Groesse und Freeze auf einen Blick', () => {
    const { fixture } = setup('THEME');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Wörter');
    expect(text).toContain('Wortgruppen');
    expect(text).toContain('Themen');
    expect(text).toContain('Größe nach:');
    expect(text).toContain('Stimmensaldo');
    expect(text).not.toContain('Meist unterstützt');
    expect(
      [...fixture.nativeElement.querySelectorAll('.qa-word-cloud-dialog__size-select option')].map(
        (option: HTMLOptionElement) => option.value,
      ),
    ).toEqual(['CONTROVERSIAL', 'BEST', 'TOP', 'TIME']);
    expect(text).toContain('Wortformen bündeln');

    const values = [...fixture.nativeElement.querySelectorAll('mat-button-toggle')]
      .map((toggle) => toggle.getAttribute('value'))
      .filter((value): value is string => value !== null);
    expect(values).toEqual(['LEXICAL', 'THEME', 'SEMANTIC']);

    const freeze = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__freeze',
    ) as HTMLButtonElement;
    expect(freeze.textContent).toContain('Anzeige anhalten');
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__smooth')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__coverage')).toBeNull();
    expect(text).not.toContain('ausgewertete Fragen');
    expect(text).not.toContain('berücksichtigten Fragen');
  });

  it('kennzeichnet die Analysesprache mit einem Doppelpunkt', () => {
    const { fixture } = setup('THEME', {
      analysisLanguage: () => 'de',
    });

    expect(fixture.nativeElement.textContent).toContain('Sprache der Beiträge:');
  });

  it('zeigt bei Haeufigkeit die Groessenoption ohne Coverage-Zeile', () => {
    const { fixture } = setup('THEME', {
      sortMode: () => 'TIME',
      tooltipMetricLabel: () => 'Vorkommen in Fragen',
    });
    const timeOption = fixture.nativeElement.querySelector(
      'option[value="TIME"]',
    ) as HTMLOptionElement;
    expect(timeOption.textContent?.replace(/\s+/g, ' ').trim()).toBe('Vorkommen in Fragen');
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__coverage')).toBeNull();
  });

  it('zeigt Glaettung bei Woertern ohne Sprachschalter', () => {
    const { fixture } = setup('LEXICAL');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Wortformen bündeln');
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__smooth')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-word-cloud-lemma-locale-select')).toBeNull();
  });

  it('zeigt den 2.x-Hinweis im semantischen Modus statt Glaettung', () => {
    const { fixture } = setup('SEMANTIC');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Themen sind hier nicht verfügbar');
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__cloud')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__smooth')).toBeNull();
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__refresh')).toBeNull();
  });

  it('zeigt einen Fortschritt, solange Themen vorbereitet werden', () => {
    const { fixture } = setup('SEMANTIC', {
      smoothingStatus: () => 'pending',
      themeFallbackHint: () => 'Themen werden vorbereitet.',
    });

    const stage = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__stage',
    ) as HTMLElement | null;
    const status = stage?.querySelector('.qa-word-cloud-dialog__status') as HTMLElement | null;
    const progress = status?.querySelector('.qa-word-cloud-dialog__progress') as HTMLElement | null;
    expect(stage).not.toBeNull();
    expect(status).not.toBeNull();
    expect(status?.classList.contains('qa-word-cloud-dialog__status--cover')).toBe(true);
    expect(progress).not.toBeNull();
    expect(progress?.getAttribute('aria-busy')).toBe('true');
    expect(progress?.textContent).toContain('Themen werden vorbereitet.');
    expect(progress?.textContent).not.toContain('Es gelten Wörter und Phrasen.');
    expect(progress?.querySelector('mat-progress-bar')).not.toBeNull();
    expect(progress?.textContent).not.toContain('Das kann einen Moment dauern');
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__mode-note')).toBeNull();
    expect(stage?.querySelector('.qa-word-cloud-dialog__cloud')).not.toBeNull();
  });

  it('ergaenzt nach laengerem Warten einen groben Zeit-Hinweis', () => {
    const { fixture } = setup('SEMANTIC', {
      smoothingStatus: () => 'pending',
      themeFallbackHint: () => 'Themen werden vorbereitet.',
      themeWaitHint: () => 'Das kann einen Moment dauern.',
    });

    const progress = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__progress',
    ) as HTMLElement | null;
    expect(progress?.textContent).toContain('Das kann einen Moment dauern.');
    expect(progress?.getAttribute('aria-label')).toContain('Das kann einen Moment dauern.');
  });

  it('nennt bei vielen Fragen eine grobe Minute statt einer Zahl', () => {
    const { fixture } = setup('SEMANTIC', {
      smoothingStatus: () => 'pending',
      themeFallbackHint: () => 'Themen werden vorbereitet.',
      themeWaitHint: () => 'Bei vielen Fragen kann das eine Minute dauern.',
    });

    expect(fixture.nativeElement.textContent).toContain(
      'Bei vielen Fragen kann das eine Minute dauern.',
    );
  });

  it('zeigt den Fortschritt auch wenn Wörter und Phrasen als Fallback sichtbar bleiben', () => {
    const { fixture } = setup('SEMANTIC', {
      smoothingStatus: () => 'pending',
      hasPreparedThemes: () => false,
      themeFallbackHint: () => 'Themen werden vorbereitet.',
      analysisEntries: () => [
        {
          key: 'kapitel-4',
          label: 'Kapitel 4',
          count: 13,
          basisLabel: 'Kapitel 4',
          confidence: 0.8,
          variants: ['Kapitel 4'],
          members: [],
        },
      ],
    });

    const progress = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__progress',
    ) as HTMLElement | null;
    expect(progress).not.toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('.qa-word-cloud-dialog__status')
        ?.classList.contains('qa-word-cloud-dialog__status--cover'),
    ).toBe(true);
    expect(progress?.querySelector('mat-progress-bar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__sr-status')).toBeNull();
  });

  it('kennzeichnet vorhandene Themen während des Refreshs sichtbar als bisherigen Stand', () => {
    const { fixture } = setup('SEMANTIC', {
      smoothingStatus: () => 'pending',
      hasPreparedThemes: () => true,
      themeFallbackHint: () => 'Themen werden vorbereitet.',
      analysisEntries: () => [
        {
          key: 'kapitel-4',
          label: 'Klausurrelevanz Kapitel 4',
          count: 42,
          basisLabel: 'Klausurrelevanz Kapitel 4',
          confidence: 0.91,
          variants: [],
          members: [],
        },
      ],
    });

    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__progress')).toBeNull();
    const status = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__stage .qa-word-cloud-dialog__mode-note[role="status"]',
    ) as HTMLElement | null;
    expect(status?.classList.contains('sr-only')).toBe(false);
    expect(status?.textContent).toContain('Der bisherige Stand bleibt sichtbar.');
  });

  it('bietet Themen aktualisieren mit einem verständlichen Veraltet-Hinweis', () => {
    const toggleSmoothing = vi.fn();
    const { fixture } = setup('SEMANTIC', {
      smoothingStatus: () => 'stale',
      smoothingDisabled: () => false,
      themeFallbackHint: () => 'Neue Fragen seit der letzten Themenanalyse',
      toggleSmoothing,
    });

    const refresh = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__refresh',
    ) as HTMLButtonElement;
    expect(refresh).not.toBeNull();
    expect(refresh.textContent).toContain('Themen aktualisieren');
    expect(fixture.nativeElement.textContent).toContain(
      'Neue Fragen seit der letzten Themenanalyse',
    );

    refresh.click();
    expect(toggleSmoothing).toHaveBeenCalledTimes(1);
  });

  it('lässt einen ausgelösten Refresh fokussierbar und sperrt weitere Aktivierungen', () => {
    const pending = signal(false);
    const available = signal(true);
    const toggleSmoothing = vi.fn(() => pending.set(true));
    const { fixture } = setup('SEMANTIC', {
      showThemeRefresh: available,
      smoothingStatus: () => (pending() ? 'pending' : 'idle'),
      smoothingDisabled: pending,
      toggleSmoothing,
    });
    const refresh = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__refresh',
    ) as HTMLButtonElement;
    refresh.focus();
    refresh.click();
    available.set(false);
    fixture.detectChanges();
    expect(refresh.isConnected).toBe(true);
    expect(refresh.disabled).toBe(false);
    expect(refresh.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(refresh);
    refresh.click();
    expect(toggleSmoothing).toHaveBeenCalledTimes(1);
  });

  it('fuellt die Dialog-Restflaeche und erlaubt vertikalen Zoom-Scroll', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const componentDir = dirname(fileURLToPath(import.meta.url));
    const dialogStyles = readFileSync(
      join(componentDir, 'qa-word-cloud-dialog.component.scss'),
      'utf8',
    );
    const panelStyles = readFileSync(join(componentDir, '../../../../styles.scss'), 'utf8');

    expect(dialogStyles).toMatch(/:host \{[^}]*display:\s*flex/);
    expect(dialogStyles).toMatch(/\.qa-word-cloud-dialog__stage \{[^}]*flex:\s*1 1 0%/);
    expect(dialogStyles).toMatch(/\.qa-word-cloud-dialog__stage \{[^}]*height:\s*0/);
    expect(dialogStyles).toMatch(/\.qa-word-cloud-dialog__status--cover \{[^}]*inset:\s*0/);
    expect(panelStyles).toMatch(
      /\.cdk-overlay-pane\.word-cloud-dialog-panel \.mat-mdc-dialog-surface > \* \{[^}]*height:\s*100%/,
    );
    expect(panelStyles).toMatch(
      /\.cdk-overlay-pane\.word-cloud-dialog-panel \.mat-mdc-dialog-surface \{[^}]*overflow-y:\s*auto/,
    );
    expect(dialogStyles).toMatch(
      /\.qa-word-cloud-dialog__size-label \{[\s\S]*color:\s*var\(--mat-sys-on-surface-variant\)/,
    );
    expect(dialogStyles).not.toMatch(/on-surface\) 78%, white/);
  });
});
