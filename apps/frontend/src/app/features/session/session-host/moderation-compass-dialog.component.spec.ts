import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { qaSummaryQuestionSourceId, type QaSummaryRuntimeDTO } from '@arsnova/shared-types';
import { ModerationCompassDialogComponent } from './moderation-compass-dialog.component';
import type { ModerationCompassCard } from './moderation-compass';

describe('ModerationCompassDialogComponent', () => {
  function setup(
    cards: readonly ModerationCompassCard[],
    onSourceActivate: (source: ModerationCompassCard['sources'][number]) => void = vi.fn(),
    analysisMode:
      'rule-based' | 'disabled' | 'pending' | 'uncertain' | 'failed' | 'classified' = 'rule-based',
    summary?: {
      enabled?: boolean;
      runtime?: QaSummaryRuntimeDTO | null;
      onRequestSummary?: () => void;
      onSummarySourceActivate?: (source: { id: string; label: string }) => void;
    },
  ) {
    const dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ModerationCompassDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            cards: () => cards,
            analysisMode,
            onSourceActivate,
            summaryEnabled: () => summary?.enabled === true,
            summary: () => summary?.runtime ?? null,
            onRequestSummary: summary?.onRequestSummary,
            onSummarySourceActivate: summary?.onSummarySourceActivate,
          },
        },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    const fixture = TestBed.createComponent(ModerationCompassDialogComponent);
    fixture.detectChanges();
    return { fixture, dialogRef, onSourceActivate };
  }

  it('zeigt den Leerzustand ohne Signale', () => {
    const { fixture } = setup([]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Moderationskompass');
    expect(text).toContain('Dein Live-Überblick über Quiz, Q&A und Blitzlicht.');
    expect(text).toContain('Du entscheidest, welche Themen behandelt werden.');
    expect(text).toContain(
      'Hier erscheinen wichtige Trends und Auswertungen, sobald die Teilnehmenden aktiv werden.',
    );
    expect(text).toContain('Einschätzung aus den sichtbaren Live-Signalen.');
    expect(text).not.toContain('Die automatische Sortierung der Fragen ist aus.');
    expect(
      fixture.nativeElement.querySelector('.dialog-title-header__icon .moderation-compass-icon'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.moderation-compass-card')).toBeNull();
  });

  it('zeigt quellenbelegte Moderationskarten', () => {
    const { fixture } = setup([
      {
        kind: 'topics',
        nextStepReason: 'topics',
        sources: [{ kind: 'qa-term', label: 'Median · Wie berechnet man den Median?' }],
      },
    ]);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Häufige Themen');
    expect(text).toContain('Median · Wie berechnet man den Median?');
    expect(text).toContain('Nächster Schritt');
    expect(text).toContain('Fass die häufigsten Themen kurz zusammen.');
    expect(text).toContain('Einschätzung aus den sichtbaren Live-Signalen.');
    expect(fixture.nativeElement.querySelectorAll('.moderation-compass-card')).toHaveLength(1);
    expect(
      fixture.nativeElement.querySelectorAll('.moderation-compass-card__sources li'),
    ).toHaveLength(1);
  });

  it('zeigt den ruhigen Zustand wenn die Analyse aus ist', () => {
    const { fixture } = setup([], vi.fn(), 'disabled');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Die automatische Sortierung der Fragen ist aus.');
    expect(text).not.toContain('Einschätzung aus den sichtbaren Live-Signalen.');
  });

  it('zeigt pending zurückhaltend', () => {
    const { fixture } = setup([], vi.fn(), 'pending');
    expect(fixture.nativeElement.textContent).toContain('Die Fragen werden noch sortiert.');
  });

  it('zeigt uncertain zurückhaltend', () => {
    const { fixture } = setup([], vi.fn(), 'uncertain');
    expect(fixture.nativeElement.textContent).toContain('Die Sortierung der Fragen ist unsicher.');
  });

  it('zeigt failed zurückhaltend', () => {
    const { fixture } = setup([], vi.fn(), 'failed');
    expect(fixture.nativeElement.textContent).toContain(
      'Die automatische Sortierung ist gerade nicht verfügbar.',
    );
  });

  it('zeigt classified mit Hinweis auf Inhalt, Ablauf und Technik', () => {
    const { fixture } = setup([], vi.fn(), 'classified');
    expect(fixture.nativeElement.textContent).toContain(
      'Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert.',
    );
  });

  it('zeigt Blitzlicht-Rückmeldungen mit eigenem Kartentitel', () => {
    const { fixture } = setup([
      {
        kind: 'tempo',
        title: 'Rückmeldungen',
        nextStepReason: 'feedback',
        sources: [{ kind: 'tempo', label: 'Die Rückmeldungen sind geteilt.' }],
      },
    ]);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Rückmeldungen');
    expect(text).toContain('Sieh dir das Blitzlicht kurz an.');
    expect(
      fixture.nativeElement.querySelector('.moderation-compass-card__icon')?.textContent,
    ).toContain('thumbs_up_down');
  });

  it('zeigt für Umfragen keinen Lösungshinweis', () => {
    const { fixture } = setup([
      {
        kind: 'clarification',
        nextStepReason: 'quiz-survey',
        sources: [{ kind: 'quiz-result', label: 'Häufigste Antwort: Ganz okay' }],
      },
    ]);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Fass kurz die Antwortverteilung zusammen.');
    expect(text).not.toContain('Erkläre kurz die Lösung');
  });

  it('macht Quellen klickbar und schließt den Dialog', () => {
    const source = {
      kind: 'qa-question' as const,
      label: 'Kommt Kapitel 4 in der Klausur vor?',
      target: { channel: 'qa' as const, questionId: '11111111-1111-4111-8111-111111111111' },
    };
    const { fixture, dialogRef, onSourceActivate } = setup([
      {
        kind: 'clarification',
        tone: 'caution',
        sources: [source],
      },
    ]);

    const button = fixture.nativeElement.querySelector(
      '.moderation-compass-card__source-button',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-tone="caution"]')).not.toBeNull();
    button?.click();

    expect(onSourceActivate).toHaveBeenCalledWith(source, 'clarification');
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('blendet die Zusammenfassung aus wenn der Kill-Switch aus ist', () => {
    const { fixture } = setup([]);
    expect(fixture.nativeElement.querySelector('[data-testid="moderation-summary"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Zusammenfassung');
  });

  it('zeigt pending und ready quellengebunden', () => {
    const sourceId = qaSummaryQuestionSourceId('11111111-1111-4111-8111-111111111111');
    const onRequestSummary = vi.fn();
    const onSummarySourceActivate = vi.fn();
    const { fixture, dialogRef } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      onRequestSummary,
      onSummarySourceActivate,
      runtime: {
        enabled: true,
        inferenceConfigured: false,
        result: {
          status: 'ready',
          statements: [{ text: 'Es gibt eine Frage zur Klausur.', sourceIds: [sourceId] }],
          suggestedNextSteps: [{ text: 'Klär die Klausurfragen zuerst.', sourceIds: [sourceId] }],
          limitations: ['Nur sichtbare Q&A-Fragen.'],
          sources: [
            { id: sourceId, kind: 'qa-question', label: 'Kommt Kapitel 4 in der Klausur vor?' },
          ],
          snapshotHash: 'a'.repeat(64),
          locale: 'de',
        },
      },
    });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Zusammenfassung');
    expect(text).toContain('Es gibt eine Frage zur Klausur.');
    expect(text).toContain('Mögliche nächste Schritte');
    expect(text).toContain('Klär die Klausurfragen zuerst.');
    expect(text).toContain('Kommt Kapitel 4 in der Klausur vor?');
    expect(text).toContain('Nur sichtbare Q&A-Fragen.');

    const button = fixture.nativeElement.querySelector(
      '.moderation-compass-dialog__summary-button',
    ) as HTMLButtonElement;
    button.click();
    expect(onRequestSummary).toHaveBeenCalledTimes(1);

    const sourceButton = fixture.nativeElement.querySelector(
      '[data-testid="moderation-summary"] .moderation-compass-card__source-button',
    ) as HTMLButtonElement;
    sourceButton.click();
    expect(onSummarySourceActivate).toHaveBeenCalledWith({
      id: sourceId,
      kind: 'qa-question',
      label: 'Kommt Kapitel 4 in der Klausur vor?',
    });
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('zeigt failed ruhig und sperrt den Button während pending', () => {
    const pending = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      runtime: {
        enabled: true,
        inferenceConfigured: true,
        result: {
          status: 'pending',
          statements: [],
          suggestedNextSteps: [],
          limitations: [],
          sources: [],
          snapshotHash: 'b'.repeat(64),
          locale: 'de',
        },
      },
    });
    expect(pending.fixture.nativeElement.textContent).toContain(
      'Die Zusammenfassung wird erstellt.',
    );
    expect(
      (
        pending.fixture.nativeElement.querySelector(
          '.moderation-compass-dialog__summary-button',
        ) as HTMLButtonElement | null
      )?.disabled,
    ).toBe(true);

    TestBed.resetTestingModule();
    const failed = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      runtime: {
        enabled: true,
        inferenceConfigured: false,
        result: {
          status: 'failed',
          statements: [],
          suggestedNextSteps: [],
          limitations: ['Kein privater Inferenzserver konfiguriert.'],
          sources: [],
          snapshotHash: 'c'.repeat(64),
          locale: 'de',
        },
      },
    });
    expect(failed.fixture.nativeElement.textContent).toContain(
      'Die Zusammenfassung ist gerade nicht verfügbar.',
    );
    expect(failed.fixture.nativeElement.textContent).toContain(
      'Kein privater Inferenzserver konfiguriert.',
    );
  });
});
