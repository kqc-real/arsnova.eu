import { Component } from '@angular/core';
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
      responses: () => [],
      weightedResponses: () => [],
      terms: () => null,
      analysisEntries: () => null,
      title: () => 'Q&A-Wortwolke',
      eyebrow: 'Q&A-Analyse',
      description: () => 'Häufige Wörter und kurze Wortgruppen.',
      wordLabelSingular: () => 'Begriff',
      wordLabelPlural: () => 'Begriffe',
      weightingHint: () => null,
      tooltipMetricLabel: () => null,
      analysisVariant: () => analysisVariant,
      setAnalysisVariant,
      themeModeAvailable: () => true,
      themeFallbackHint: () =>
        analysisVariant === 'SEMANTIC'
          ? 'Themen sind noch nicht verfügbar. Es gelten Wörter und Phrasen.'
          : null,
      sortMode: () => 'TOP',
      setSortMode,
      frozen: () => false,
      freezeLabel: () => 'Wortwolke einfrieren',
      toggleFreeze: vi.fn(),
      smoothingStatus: () => 'idle',
      smoothingLabel: () => 'Wortformen glätten',
      smoothingHint: () => null,
      smoothingDisabled: () => analysisVariant === 'SEMANTIC',
      toggleSmoothing: vi.fn(),
      lemmaLocale: () => 'de',
      setLemmaLocale: vi.fn(),
      itemLabelSingular: 'Frage',
      itemLabelPlural: 'Fragen',
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
      add: { imports: [WordCloudStubComponent] },
    });

    const fixture = TestBed.createComponent(QaWordCloudDialogComponent);
    fixture.detectChanges();
    return { fixture, setAnalysisVariant, setSortMode };
  }

  it('zeigt Ansicht, Groesse und Freeze auf einen Blick', () => {
    const { fixture } = setup('THEME');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Wörter');
    expect(text).toContain('Wörter & Phrasen');
    expect(text).toContain('Themen');
    expect(text).toContain('Größe');
    expect(text).toContain('Stimmen');
    expect(text).not.toContain('Meist unterstützt');
    expect(text).toContain('Wortformen glätten');

    const values = [...fixture.nativeElement.querySelectorAll('mat-button-toggle')]
      .map((toggle) => toggle.getAttribute('value'))
      .filter((value): value is string => value !== null);
    expect(values).toEqual(['LEXICAL', 'THEME', 'SEMANTIC']);

    const freeze = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__freeze',
    ) as HTMLButtonElement;
    expect(freeze.getAttribute('aria-label')).toBe('Wortwolke einfrieren');
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__smooth')).not.toBeNull();
  });

  it('zeigt Sprache und Glaettung bei Woertern', () => {
    const { fixture } = setup('LEXICAL');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Wortformen glätten');
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__smooth')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('app-word-cloud-lemma-locale-select'),
    ).not.toBeNull();
  });

  it('zeigt den 2.x-Hinweis im semantischen Modus statt Glaettung', () => {
    const { fixture } = setup('SEMANTIC');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Themen sind noch nicht verfügbar');
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__cloud')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__smooth')).toBeNull();
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__refresh')).toBeNull();
  });

  it('zeigt einen Fortschritt, solange Themen vorbereitet werden', () => {
    const { fixture } = setup('SEMANTIC', {
      smoothingStatus: () => 'pending',
      themeFallbackHint: () => 'Themen werden vorbereitet. Es gelten Wörter und Phrasen.',
    });

    const progress = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__progress',
    ) as HTMLElement | null;
    expect(progress).not.toBeNull();
    expect(progress?.getAttribute('aria-busy')).toBe('true');
    expect(progress?.textContent).toContain('Themen werden vorbereitet.');
    expect(progress?.textContent).toContain('Es gelten Wörter und Phrasen.');
    expect(progress?.querySelector('mat-progress-bar')).not.toBeNull();
    expect(progress?.textContent).not.toContain('Das kann einen Moment dauern');
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__mode-note')).toBeNull();
  });

  it('ergaenzt nach laengerem Warten einen groben Zeit-Hinweis', () => {
    const { fixture } = setup('SEMANTIC', {
      smoothingStatus: () => 'pending',
      themeFallbackHint: () => 'Themen werden vorbereitet. Es gelten Wörter und Phrasen.',
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
      themeFallbackHint: () => 'Themen werden vorbereitet. Es gelten Wörter und Phrasen.',
      themeWaitHint: () => 'Bei vielen Fragen kann das eine Minute dauern.',
    });

    expect(fixture.nativeElement.textContent).toContain(
      'Bei vielen Fragen kann das eine Minute dauern.',
    );
  });

  it('bietet Themen aktualisieren nur wenn die Analyse veraltet ist', () => {
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
    expect(fixture.nativeElement.textContent).not.toContain(
      'Neue Fragen seit der letzten Themenanalyse',
    );

    refresh.click();
    expect(toggleSmoothing).toHaveBeenCalledTimes(1);
  });
});
