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
  function setup(analysisVariant: WordCloudAnalysisVariant = 'THEME') {
    const setAnalysisVariant = vi.fn();
    const data: QaWordCloudDialogData = {
      responses: () => [],
      weightedResponses: () => [],
      terms: () => null,
      analysisEntries: () => null,
      title: () => 'Q&A-Wortwolke',
      eyebrow: 'Q&A-Analyse',
      description: null,
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
      setSortMode: vi.fn(),
      frozen: () => false,
      freezeLabel: () => 'Wortwolke einfrieren',
      toggleFreeze: vi.fn(),
      smoothingStatus: () => 'idle',
      smoothingLabel: () => 'Sprachformen glätten',
      smoothingHint: () => null,
      smoothingDisabled: () => analysisVariant === 'SEMANTIC',
      toggleSmoothing: vi.fn(),
      lemmaLocale: () => 'de',
      setLemmaLocale: vi.fn(),
      itemLabelSingular: 'Frage',
      itemLabelPlural: 'Fragen',
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
    return { fixture, setAnalysisVariant };
  }

  it('trennt Einzelwoerter, Woerter & Phrasen und Themen', () => {
    const { fixture } = setup('THEME');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Einzelwörter');
    expect(text).toContain('Wörter & Phrasen');
    expect(text).toContain('Themen');

    const values = [...fixture.nativeElement.querySelectorAll('mat-button-toggle')]
      .map((toggle) => toggle.getAttribute('value'))
      .filter((value): value is string => value !== null);
    expect(values).toEqual(
      expect.arrayContaining(['LEXICAL', 'THEME', 'SEMANTIC', 'TOP', 'BEST', 'CONTROVERSIAL']),
    );
  });

  it('zeigt den 2.x-Hinweis im semantischen Modus statt einer leeren Karte', () => {
    const { fixture } = setup('SEMANTIC');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Themen sind noch nicht verfügbar');
    expect(fixture.nativeElement.querySelector('.qa-word-cloud-dialog__cloud')).not.toBeNull();

    const smoothButton = fixture.nativeElement.querySelector(
      '.qa-word-cloud-dialog__smooth',
    ) as HTMLButtonElement;
    expect(smoothButton.disabled).toBe(true);
    expect(smoothButton.getAttribute('aria-pressed')).toBe('false');
  });
});
