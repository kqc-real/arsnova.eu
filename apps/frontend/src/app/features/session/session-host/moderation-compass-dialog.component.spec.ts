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
    expect(text).toContain(
      'Sobald Fragen oder ein Blitzlicht da sind, siehst du hier Themen, Klärbedarf, umstrittene Fragen und Tempo.',
    );
    expect(text).toContain('Du entscheidest, welche Themen behandelt werden.');
    expect(text).not.toContain(
      'Tippe einen Eintrag an, um zur Frage oder zur Wortwolke zu springen.',
    );
    expect(text).not.toContain('Aus der Live-Runde');
    expect(text).not.toContain('Die automatische Sortierung der Fragen ist aus.');
    expect(
      fixture.nativeElement.querySelector('.dialog-title-header__icon .moderation-compass-icon'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.moderation-compass-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="moderation-next-step"]')).toBeNull();
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
    expect(text).toContain('Als Nächstes');
    expect(text).toContain('Fass die häufigsten Themen kurz zusammen.');
    expect(text).toContain('Aus der Live-Runde');
    expect(text).toContain('Tippe einen Eintrag an, um zur Frage oder zur Wortwolke zu springen.');
    expect(text).toContain('Wortwolke');
    expect(fixture.nativeElement.querySelectorAll('.moderation-compass-card')).toHaveLength(1);
    expect(
      fixture.nativeElement.querySelectorAll('.moderation-compass-card__sources li'),
    ).toHaveLength(1);
    expect(
      fixture.nativeElement.querySelector('[data-testid="moderation-next-step"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.moderation-compass-card__suggestion')).toBeNull();
  });

  it('zeigt den ruhigen Zustand wenn die Analyse aus ist', () => {
    const { fixture } = setup([], vi.fn(), 'disabled');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Die automatische Sortierung der Fragen ist aus.');
    expect(text).not.toContain('Aus der Live-Runde');
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
    expect(text).toContain('Blitzlicht');
    expect(
      fixture.nativeElement.querySelector('.moderation-compass-card__icon')?.textContent,
    ).toContain('thumbs_up_down');
  });

  it('benennt Tempo-Alarm als Kommen nicht mit', () => {
    const { fixture } = setup([
      {
        kind: 'tempo',
        tone: 'alert',
        nextStepReason: 'tempo',
        sources: [{ kind: 'tempo', label: 'Viele kommen nicht mehr mit.' }],
      },
    ]);

    expect(fixture.nativeElement.textContent).toContain('Kommen nicht mit');
    expect(fixture.nativeElement.textContent).not.toMatch(/\bTempo\b/);
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
    expect(text).toContain('Quiz');
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
    expect(button?.textContent).toContain('Q&A');
    expect(fixture.nativeElement.querySelector('[data-tone="caution"]')).not.toBeNull();
    button?.click();

    expect(onSourceActivate).toHaveBeenCalledWith(source, 'clarification');
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('klappt weitere Quellen hinter den ersten drei auf', () => {
    const { fixture } = setup([
      {
        kind: 'clarification',
        sources: [
          { kind: 'qa-question', label: 'Frage eins?' },
          { kind: 'qa-question', label: 'Frage zwei?' },
          { kind: 'qa-question', label: 'Frage drei?' },
          { kind: 'qa-question', label: 'Frage vier?' },
          { kind: 'qa-question', label: 'Frage fünf?' },
        ],
      },
    ]);

    const visible = fixture.nativeElement.querySelectorAll(
      '.moderation-compass-card > .moderation-compass-card__sources li',
    );
    expect(visible).toHaveLength(3);
    expect(fixture.nativeElement.textContent).toContain('Noch 2 anzeigen');
    expect([...visible].map((item) => item.textContent ?? '').join(' ')).not.toContain(
      'Frage fünf?',
    );

    const details = fixture.nativeElement.querySelector(
      '.moderation-compass-card__more',
    ) as HTMLDetailsElement;
    expect(details.open).toBe(false);
    details.open = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Frage fünf?');
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

    let text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Zusammenfassung');
    expect(text).toContain('Kurzfassung der offenen Fragen');
    expect(text).toContain('Optional: 2–4 kurze Stichpunkte zum Überfliegen.');
    expect(text).not.toContain('Es gibt eine Frage zur Klausur.');
    expect(text).not.toContain('Mögliche nächste Schritte');

    const summary = fixture.nativeElement.querySelector(
      'mat-dialog-content [data-testid="moderation-summary"]',
    );
    expect(summary).not.toBeNull();

    const button = fixture.nativeElement.querySelector(
      '.moderation-compass-dialog__summary-button',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(onRequestSummary).toHaveBeenCalledTimes(1);

    text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Es gibt eine Frage zur Klausur.');
    expect(text).toContain('Mögliche nächste Schritte');
    expect(text).toContain('Klär die Klausurfragen zuerst.');
    expect(text).toContain('Nur sichtbare Q&A-Fragen.');
    expect(text).toContain('Zugehörige Fragen (1)');

    const sources = fixture.nativeElement.querySelector(
      '.moderation-compass-dialog__summary-sources',
    ) as HTMLDetailsElement;
    expect(sources.open).toBe(false);
    sources.open = true;
    fixture.detectChanges();

    const sourceButton = fixture.nativeElement.querySelector(
      '[data-testid="moderation-summary"] .moderation-compass-card__source-button',
    ) as HTMLButtonElement;
    expect(fixture.nativeElement.textContent).toContain('Kommt Kapitel 4 in der Klausur vor?');
    sourceButton.click();
    expect(onSummarySourceActivate).toHaveBeenCalledWith({
      id: sourceId,
      kind: 'qa-question',
      label: 'Kommt Kapitel 4 in der Klausur vor?',
    });
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('hebt das Thema der Zusammenfassung als Lead hervor', () => {
    const sourceId = qaSummaryQuestionSourceId('11111111-1111-4111-8111-111111111111');
    const { fixture } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      runtime: {
        enabled: true,
        inferenceConfigured: true,
        result: {
          status: 'ready',
          statements: [
            { text: 'Median: Formel und Berechnung sind unklar.', sourceIds: [sourceId] },
          ],
          suggestedNextSteps: [],
          limitations: [],
          sources: [],
          snapshotHash: 'a'.repeat(64),
          locale: 'de',
        },
      },
    });

    (
      fixture.nativeElement.querySelector(
        '.moderation-compass-dialog__summary-button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const lead = fixture.nativeElement.querySelector(
      '.moderation-compass-dialog__summary-lead',
    ) as HTMLElement | null;
    expect(lead?.textContent).toBe('Median:');
    expect(fixture.nativeElement.textContent).toContain('Formel und Berechnung sind unklar.');
  });

  it('macht vorhandene Gemini-Protokolle in der Anzeige zu Stichpunkten', () => {
    const sourceId = qaSummaryQuestionSourceId('11111111-1111-4111-8111-111111111111');
    const { fixture } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      runtime: {
        enabled: true,
        inferenceConfigured: true,
        result: {
          status: 'ready',
          statements: [
            {
              text: 'Es gibt konkrete Fragen zur Berechnung des Medians und der dazu passenden Formel.',
              sourceIds: [sourceId],
            },
          ],
          suggestedNextSteps: [],
          limitations: [],
          sources: [],
          snapshotHash: 'a'.repeat(64),
          locale: 'de',
        },
      },
    });

    (
      fixture.nativeElement.querySelector(
        '.moderation-compass-dialog__summary-button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const lead = fixture.nativeElement.querySelector(
      '.moderation-compass-dialog__summary-lead',
    ) as HTMLElement | null;
    expect(lead?.textContent).toBe('Median:');
    expect(fixture.nativeElement.textContent).toContain('Berechnung und Formel.');
    expect(fixture.nativeElement.textContent).not.toContain('Es gibt konkrete Fragen');
  });

  it('zeigt Zusammenfassungsaussagen in der Reihenfolge der zugehörigen Fragen', () => {
    const medianId = qaSummaryQuestionSourceId('11111111-1111-4111-8111-111111111111');
    const chapterId = qaSummaryQuestionSourceId('22222222-2222-4222-8222-222222222222');
    const { fixture } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      runtime: {
        enabled: true,
        inferenceConfigured: true,
        result: {
          status: 'ready',
          statements: [
            { text: 'Kapitel 4: Klausurrelevanz.', sourceIds: [chapterId] },
            { text: 'Median: Formel und Berechnung.', sourceIds: [medianId] },
          ],
          suggestedNextSteps: [],
          limitations: [],
          sources: [
            { id: medianId, kind: 'qa-question', label: 'Wie berechnet man den Median?' },
            { id: chapterId, kind: 'qa-question', label: 'Kommt Kapitel 4 in der Klausur vor?' },
          ],
          snapshotHash: 'a'.repeat(64),
          locale: 'de',
        },
      },
    });

    (
      fixture.nativeElement.querySelector(
        '.moderation-compass-dialog__summary-button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const items = [
      ...fixture.nativeElement.querySelectorAll(
        '.moderation-compass-dialog__summary-statements li',
      ),
    ].map((item) => (item.textContent ?? '').replace(/\s+/g, ' ').trim());
    expect(items[0]).toContain('Median');
    expect(items[1]).toContain('Kapitel 4');
  });

  it('blendet KI-nächste-Schritte aus wenn der Kompass schon einen Vorschlag hat', () => {
    const sourceId = qaSummaryQuestionSourceId('11111111-1111-4111-8111-111111111111');
    const { fixture } = setup(
      [
        {
          kind: 'tempo',
          tone: 'alert',
          nextStepReason: 'tempo',
          sources: [{ kind: 'tempo', label: 'Viele kommen nicht mehr mit.' }],
        },
      ],
      vi.fn(),
      'rule-based',
      {
        enabled: true,
        runtime: {
          enabled: true,
          inferenceConfigured: true,
          result: {
            status: 'ready',
            statements: [{ text: 'Es gibt eine Frage zur Klausur.', sourceIds: [sourceId] }],
            suggestedNextSteps: [{ text: 'Klär die Klausurfragen zuerst.', sourceIds: [sourceId] }],
            limitations: [],
            sources: [],
            snapshotHash: 'a'.repeat(64),
            locale: 'de',
          },
        },
      },
    );

    (
      fixture.nativeElement.querySelector(
        '.moderation-compass-dialog__summary-button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Geh langsamer oder frag, wer nicht mehr folgt.');
    expect(text).toContain('Es gibt eine Frage zur Klausur.');
    expect(text).not.toContain('Mögliche nächste Schritte');
    expect(text).not.toContain('Klär die Klausurfragen zuerst.');
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
      'Kein privater Inferenzserver konfiguriert.',
    );
    expect(failed.fixture.nativeElement.textContent).not.toContain(
      'Die Zusammenfassung ist gerade nicht verfügbar.',
    );
    expect(failed.fixture.nativeElement.textContent).not.toContain('Hinweise');

    TestBed.resetTestingModule();
    const failedDuplicate = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      runtime: {
        enabled: true,
        inferenceConfigured: true,
        result: {
          status: 'failed',
          statements: [],
          suggestedNextSteps: [],
          limitations: ['Die Zusammenfassung ist gerade nicht verfügbar.'],
          sources: [],
          snapshotHash: 'd'.repeat(64),
          locale: 'de',
        },
      },
    });
    const duplicateText = failedDuplicate.fixture.nativeElement.textContent as string;
    expect(duplicateText.match(/Die Zusammenfassung ist gerade nicht verfügbar\./g)).toHaveLength(
      1,
    );
    expect(duplicateText).not.toContain('Hinweise');

    TestBed.resetTestingModule();
    const emptySnapshot = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      runtime: {
        enabled: true,
        inferenceConfigured: true,
        result: {
          status: 'uncertain',
          statements: [],
          suggestedNextSteps: [],
          limitations: ['Es gibt noch zu wenige sichtbare Fragen für eine Zusammenfassung.'],
          sources: [],
          snapshotHash: 'e'.repeat(64),
          locale: 'de',
        },
      },
    });
    (
      emptySnapshot.fixture.nativeElement.querySelector(
        '.moderation-compass-dialog__summary-button',
      ) as HTMLButtonElement
    ).click();
    emptySnapshot.fixture.detectChanges();
    const emptySnapshotText = emptySnapshot.fixture.nativeElement.textContent as string;
    expect(emptySnapshotText).toContain(
      'Es gibt noch zu wenige sichtbare Fragen für eine Zusammenfassung.',
    );
    expect(emptySnapshotText).not.toContain('Die Zusammenfassung ist unsicher.');
    expect(emptySnapshotText).not.toContain('Hinweise');
  });
});
