import { signal } from '@angular/core';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, expect, it, vi } from 'vitest';
import type {
  QaQuestionSortMode,
  WordCloudAnalysisEntryDTO,
  WordCloudAnalysisVariant,
} from '@arsnova/shared-types';
import {
  QaWordCloudDialogComponent,
  type QaWordCloudDialogData,
} from './qa-word-cloud-dialog.component';

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
      presenterViewActionLabel: () => 'Präsentationsansicht öffnen',
      projectionControlsOffered: () => true,
      responses: () => [],
      responseTextsBySourceId: () => ({}),
      weightedResponses: () => [],
      terms: () => null,
      analysisEntries: () => null,
      title: () => 'Q&A-Wortwolke',
      analysisLabel: 'Q&A-Analyse',
      wordLabelSingular: () => 'Begriff',
      wordLabelPlural: () => 'Begriffe',
      weightingHint: () => null,
      tooltipMetricLabel: () => 'Stimmensaldo',
      analyzedQuestionCount: () => 12,
      eligibleQuestionCount: () => 18,
      analysisModelVersion: () => null,
      analysisVariant: () => analysisVariant,
      displayMode: () => analysisVariant,
      setAnalysisVariant,
      themeModeAvailable: () => true,
      themeFallbackHint: () =>
        analysisVariant === 'SEMANTIC'
          ? 'Themen sind hier nicht verfügbar. Nutze Wörter oder Wortgruppen. Es gelten Wörter und Wortgruppen.'
          : null,
      themeWaitHint: () => null,
      sortMode: () => 'TOP',
      setSortMode,
      frozen: () => false,
      freezeLabel: () => 'Anzeige anhalten',
      toggleFreeze: vi.fn(),
      smoothingStatus: () => 'idle',
      smoothingLabel: () => 'Nach Grundform bündeln',
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

  it('blendet Projektionsstatus und -aktionen auf Smartphones aus', () => {
    const { fixture } = setup('SEMANTIC', {
      projected: () => true,
      projectionControlsOffered: () => false,
    });

    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__project')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Präsentation');
  });

  it.each([
    ['LEXICAL', 'Einzelne Wörter in der eingegebenen Form'],
    ['THEME', 'Wörter und kurze Wortgruppen'],
    ['SEMANTIC', 'zusammengefasst als Themen'],
  ] as const)('erklärt die Ansicht %s passend zur Auswahl', (analysisVariant, expected) => {
    const { fixture } = setup(analysisVariant);
    const hint = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__view-hint',
    ) as HTMLElement;

    expect(hint.textContent).toContain(expected);
    expect(hint.closest('details')?.open).toBe(false);
  });

  it('behält den Analysezustand bei Anzeigewahl mit verspätetem Gruppenfokus bei', async () => {
    const variant = signal<WordCloudAnalysisVariant>('THEME');
    const focusedGroupKey = signal<string | null>(null);
    const analysisEntries = signal<WordCloudAnalysisEntryDTO[]>([]);
    const setAnalysisVariant = (mode: WordCloudAnalysisVariant) => {
      variant.set(mode);
      focusedGroupKey.set(null);
      analysisEntries.set([]);
    };
    const resolveGroup = (key: string) => {
      analysisEntries.set([
        {
          key,
          label: 'Orbit',
          count: 2,
          basisLabel: null,
          members: [{ sourceId: 'question-1', text: 'Wie entsteht ein Orbit?', weight: 2 }],
          variants: ['Orbit'],
          confidence: null,
        },
      ]);
      focusedGroupKey.set(key);
    };
    const { fixture } = setup('THEME', {
      analysisVariant: variant,
      displayMode: variant,
      analysisEntries,
      focusedGroupKey,
      setAnalysisVariant,
    });
    const root = fixture.nativeElement as HTMLElement;
    const analysis = root.querySelector<HTMLDetailsElement>('.word-cloud__analysis-disclosure')!;
    const summary = analysis.querySelector('summary')!;
    expect(analysis.open).toBe(false);
    summary.click();
    expect(analysis.open).toBe(true);
    summary.click();

    for (const mode of ['LEXICAL', 'SEMANTIC', 'THEME'] as const) {
      const button = root.querySelector<HTMLButtonElement>(
        `mat-button-toggle[value="${mode}"] button`,
      )!;
      button.focus();
      button.click();
      fixture.detectChanges();
      expect(variant()).toBe(mode);
      expect(analysis.open).toBe(false);

      resolveGroup(mode.toLowerCase());
      await fixture.whenStable();
      fixture.detectChanges();
      expect(analysis.open).toBe(false);
      expect(document.activeElement).toBe(button);
      expect(root.querySelector('.word-cloud__word[aria-pressed="true"]')).not.toBeNull();
    }

    summary.click();
    root.querySelector<HTMLButtonElement>('mat-button-toggle[value="SEMANTIC"] button')!.click();
    fixture.detectChanges();
    resolveGroup('semantic');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(analysis.open).toBe(true);
  });

  it('nennt die Grundform nur bei einer tatsächlich sichtbaren Bündelung', () => {
    const { fixture } = setup('LEXICAL', { smoothingStatus: () => 'active' });

    expect(
      fixture.nativeElement.querySelector('.qa-word-cloud-dialog__view-hint')?.textContent,
    ).toContain('»lernen« und »gelernt« zählen gemeinsam als »lernen«');
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
    expect(button.textContent).toContain('Präsentationsansicht öffnen');
    const presenterIcon = button.querySelector('app-presenter-icon');
    expect(presenterIcon).not.toBeNull();
    expect(presenterIcon?.classList).toContain('qa-word-cloud-dialog__presenter-icon');
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
    expect(button.textContent).toContain('Auf der Präsentation ausblenden');
    expect(button.querySelector('app-presenter-icon')).toBeNull();
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

  it('zeigt Ansicht, Groesse und Freeze auf einen Blick', async () => {
    const { fixture } = setup('THEME');
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Wörter');
    expect(text).toContain('Wortgruppen');
    expect(text).toContain('Themen');
    expect(text).toContain('Größe nach:');
    expect(text).toContain('Stimmensaldo');
    expect(text).not.toContain('Meist unterstützt');
    expect(fixture.nativeElement.querySelector('mat-select[role="combobox"]')).not.toBeNull();
    expect(text).toContain('Nach Grundform bündeln');

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

  it('zeigt bei Haeufigkeit die Groessenoption ohne Coverage-Zeile', async () => {
    const { fixture } = setup('THEME', {
      sortMode: () => 'TIME',
      tooltipMetricLabel: () => 'Vorkommen in Fragen',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-select')?.textContent).toContain(
      'Vorkommen in Fragen',
    );
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__coverage')).toBeNull();
  });

  it('öffnet vier Material-Optionen und übernimmt die ausgewählte Gewichtung', async () => {
    TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
    const sortMode = signal<QaQuestionSortMode>('TOP');
    const setSortMode = vi.fn((mode: QaQuestionSortMode) => sortMode.set(mode));
    const { fixture } = setup('THEME', { sortMode, setSortMode });
    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);

    await select.open();
    const options = [...document.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]')];
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'Geteilte Stimmen',
      'Klare Zustimmung',
      'Stimmensaldo',
      'Vorkommen in Fragen',
    ]);
    options.at(-1)!.click();
    expect(setSortMode).toHaveBeenCalledExactlyOnceWith('TIME');
    expect(await select.getValueText()).toBe('Vorkommen in Fragen');
    expect(await select.isOpen()).toBe(false);
  });

  it('schließt per Escape erst die Auswahlliste und dann die Wortwolke', async () => {
    TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
    const { fixture } = setup();
    const ref = fixture.debugElement.injector.get(MatDialogRef);
    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);
    await select.open();
    const trigger = fixture.nativeElement.querySelector('mat-select') as HTMLElement;
    trigger.focus();

    const escape = () =>
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    escape();
    expect(ref.close).not.toHaveBeenCalled();
    expect(await select.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
    escape();
    await fixture.whenStable();
    expect(ref.close).toHaveBeenCalledOnce();
  });

  it('sperrt die Gewichtung bei eingefrorener Wolke und laufender Projektionsänderung', async () => {
    const frozen = signal(true);
    const { fixture } = setup('THEME', { frozen });
    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);
    expect(await select.isDisabled()).toBe(true);
    frozen.set(false);
    expect(await select.isDisabled()).toBe(false);
    fixture.componentInstance.projectionPending.set(true);
    expect(await select.isDisabled()).toBe(true);
  });

  it('lässt die Hilfe sichtbar und bündelt Kennzahlen, Optionen, Belege und Exporte', () => {
    const setAnalysisLanguage = vi.fn();
    const { fixture } = setup('SEMANTIC', {
      analysisLanguage: () => 'de',
      setAnalysisLanguage,
      analysisInfo: () => ({ mode: 'SEMANTIC', result: null }),
      analysisEntries: () => [
        {
          key: 'stichprobe',
          label: 'Stichprobe',
          count: 3,
          basisLabel: 'Beispiel mit Stichproben',
          confidence: 0.8,
          variants: [],
          members: [],
        },
      ],
      weightingHint: () => 'Gewichtung nach Stimmensaldo',
    });
    const root = fixture.nativeElement as HTMLElement;
    const disclosure = root.querySelector<HTMLDetailsElement>('.word-cloud__analysis-disclosure')!;
    const summary = disclosure.querySelector('summary')!;
    const language = disclosure.querySelector<HTMLSelectElement>('select')!;
    expect(summary.querySelector('span')?.textContent?.trim()).toBe('Q&A-Analyse');
    expect(disclosure.open).toBe(false);
    expect(root.querySelector('.word-cloud__header')).toBeNull();
    expect(root.querySelector('.word-cloud__word')?.closest('details')).toBeNull();
    expect(root.querySelector('.word-cloud__visual--wrapped-presentation')).not.toBeNull();
    expect(root.querySelector('.word-cloud__responses-summary')?.textContent).toContain(
      'Zugehörige Fragen',
    );
    expect(root.querySelector('.qa-word-cloud-dialog__freeze')?.closest('details')).toBeNull();
    const info = root.querySelector('.word-cloud__analysis-info');
    expect(info?.closest('details')).toBeNull();
    expect(info?.querySelector('button[aria-haspopup="dialog"]')).not.toBeNull();
    expect(root.querySelectorAll('.word-cloud__analysis-info')).toHaveLength(1);
    for (const selector of [
      '.word-cloud__meta',
      '.word-cloud__reading-hint',
      '.word-cloud__grouping-details',
      '.word-cloud__summary-hero',
      '.word-cloud__responses-panel',
      '.word-cloud__actions',
      '.qa-word-cloud-dialog__language',
    ]) {
      expect(root.querySelector(selector)?.closest('.word-cloud__analysis-disclosure')).toBe(
        disclosure,
      );
    }

    summary.click();
    expect(disclosure.open).toBe(true);
    language.value = 'fr';
    language.dispatchEvent(new Event('change'));
    expect(setAnalysisLanguage).toHaveBeenCalledWith('fr');
    summary.click();
    expect(disclosure.open).toBe(false);
  });

  it('zeigt Glaettung bei Woertern ohne Sprachschalter', () => {
    const { fixture } = setup('LEXICAL');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Nach Grundform bündeln');
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

  it('zeigt bei angehaltener Q&A-Ansicht ohne Ergebnis einen neutralen Leerzustand', () => {
    const { fixture } = setup('SEMANTIC', {
      frozen: () => true,
      freezeLabel: () => 'Anzeige fortsetzen',
      themeFallbackHint: () => null,
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Für diese Ansicht liegt noch keine Wortwolke vor.');
    expect(root.textContent).toContain('Anzeige fortsetzen');
    expect(root.querySelector('.qa-word-cloud-dialog__progress')).toBeNull();
  });

  it('zeigt einen Fortschritt, solange Themen vorbereitet werden', () => {
    const { fixture } = setup('SEMANTIC', {
      smoothingStatus: () => 'pending',
      themeFallbackHint: () => 'Themen werden vorbereitet.',
    });

    const stage = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__stage',
    ) as HTMLElement | null;
    const progress = stage?.querySelector(
      '.word-cloud__visual-frame .qa-word-cloud-dialog__progress',
    );
    expect(stage).not.toBeNull();
    expect(progress).not.toBeNull();
    expect(progress?.getAttribute('aria-busy')).toBe('true');
    expect(progress?.textContent).toContain('Themen werden gesucht …');
    expect(progress?.textContent).not.toContain('Es gelten Wörter und Wortgruppen.');
    expect(progress?.querySelector('mat-progress-bar')).not.toBeNull();
    expect(progress?.textContent).not.toContain('Das kann einen Moment dauern');
    expect(
      fixture.nativeElement.querySelector('.qa-word-cloud-dialog__view-hint')?.textContent,
    ).toContain('Ähnliche Beiträge, zusammengefasst als Themen');
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

  it('zeigt den Fortschritt auf der Bühne, solange nur der lexikalische Fallback vorliegt', () => {
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
    expect(progress?.closest('.word-cloud__visual-frame')).not.toBeNull();
    expect(progress?.querySelector('mat-progress-bar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.word-cloud__word')).toBeNull();
  });

  it('behält die bisherige Wolke beim Refresh und kündigt den Stand außerhalb der Analyse an', () => {
    const { fixture } = setup('SEMANTIC', {
      smoothingStatus: () => 'pending',
      hasPreparedThemes: () => true,
      analysisInfo: () => ({
        mode: 'SEMANTIC',
        result: null,
        topicState: {
          channel: 'qa',
          progress: 'refreshing',
          freshness: null,
          failed: false,
          outcome: null,
        },
      }),
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
    const root = fixture.nativeElement as HTMLElement;
    const status = root.querySelector('.word-cloud__analysis-tools [role="status"]');
    expect(root.querySelector<HTMLDetailsElement>('.word-cloud__analysis-disclosure')?.open).toBe(
      false,
    );
    expect(status?.closest('details')).toBeNull();
    expect(status?.textContent).toContain('Der bisherige Stand bleibt sichtbar.');
    expect(root.querySelector('.word-cloud__word')).not.toBeNull();
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
    expect(panelStyles).toMatch(
      /\.cdk-overlay-pane\.word-cloud-dialog-panel \.mat-mdc-dialog-surface > \* \{[^}]*height:\s*100%/,
    );
    expect(panelStyles).toMatch(
      /\.cdk-overlay-pane\.word-cloud-dialog-panel \.mat-mdc-dialog-surface \{[^}]*overflow-y:\s*auto/,
    );
    expect(dialogStyles).toMatch(
      /\.qa-word-cloud-dialog__language-label \{[^}]*color:\s*var\(--mat-sys-on-surface-variant\)/,
    );
    expect(dialogStyles).not.toMatch(/on-surface\) 78%, white/);
  });
});
