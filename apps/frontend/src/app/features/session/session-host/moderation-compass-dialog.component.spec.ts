import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  qaSummaryQuestionSourceId,
  QA_SUMMARY_TECHNICAL_INSTRUCTION_VERSION,
  type QaSummaryContextPreviewDTO,
  type QaSummaryRuntimeCompatibleDTO,
  type QaSummaryRuntimeV2DTO,
  type ModerationCompassRecommendation,
} from '@arsnova/shared-types';
import { ModerationCompassDialogComponent } from './moderation-compass-dialog.component';
import { buildModerationCompassView, type ModerationCompassCard } from './moderation-compass';

describe('ModerationCompassDialogComponent', () => {
  function v2Runtime(
    input: Pick<QaSummaryRuntimeV2DTO, 'inferenceConfigured' | 'result'>,
  ): QaSummaryRuntimeV2DTO {
    return {
      schemaVersion: 2,
      enabled: true,
      inferenceConfigured: input.inferenceConfigured,
      capabilities: {
        contractVersion: 'qa-summary-adapter-capabilities-v1',
        adapterId: 'arsnova-summary-adapter-v2',
        modes: [
          {
            kind: 'full-context',
            requestContract: 'qa-summary-context-v2',
            outputContract: 'qa-summary-model-output-v3',
            promptContextContract: 'moderation-prompt-context-v1',
            definitionVersion: 'moderation-prompt-definitions-v1',
          },
          { kind: 'legacy-text' },
        ],
      },
      result: input.result,
    };
  }

  function contextPreviewFixture(): QaSummaryContextPreviewDTO {
    return {
      schemaVersion: 1,
      contractVersion: 'qa-summary-context-preview-v1',
      instructionVersion: QA_SUMMARY_TECHNICAL_INSTRUCTION_VERSION,
      definitionVersion: 'moderation-prompt-definitions-v1',
      capabilities: v2Runtime({ inferenceConfigured: false, result: null }).capabilities,
      selectedMode: null,
      fallback: {
        contractVersion: 'qa-summary-fallback-v1',
        requestedRequestContract: 'qa-summary-context-v2',
        requestedOutputContract: 'qa-summary-model-output-v3',
        mode: 'extractive',
        reason: 'disabled',
        retry: 'not-applicable',
      },
      cache: 'miss',
      promptContext: {
        schemaVersion: 1,
        contractVersion: 'moderation-prompt-context-v1',
        packedAt: '2026-10-05T17:00:00.000Z',
        hashAlgorithm: 'sha-256',
        hashMaterialVersion: 'moderation-prompt-hash-v1',
        snapshotHash: 'a'.repeat(64),
        context: {
          questions: {
            state: 'available',
            corpus: {
              total: 2500,
              eligible: 2500,
              analyzed: 2500,
              deduplicated: 2500,
              represented: 1,
            },
            items: [],
          },
          topics: { state: 'disabled', reason: 'hidden fixture detail' },
          compass: { state: 'unavailable', reason: 'outside-scope' },
          learningContext: { state: 'unavailable', reason: 'outside-scope' },
          releasedResults: { state: 'not-released', reason: 'hidden fixture detail' },
          feedback: { state: 'not-applicable', reason: 'hidden fixture detail' },
          sources: [
            { id: 'semantic-topic:hidden', kind: 'semantic-topic', label: 'GEHEIMER QUELLENTEXT' },
          ],
          limitations: [
            {
              code: 'budget-truncated',
              section: 'topics',
              detail: 'GEHEIMES LIMITDETAIL',
            },
          ],
        },
        budget: {
          packedInputTokens: 3138,
          contextWindowTokens: 8192,
          reservedOutputTokens: 640,
          safetyMarginTokens: 128,
          truncations: [{ section: 'questions', omittedItems: 2499, reason: 'token-budget' }],
        },
      },
    } as unknown as QaSummaryContextPreviewDTO;
  }

  function setup(
    cards: readonly ModerationCompassCard[],
    onSourceActivate: (source: ModerationCompassCard['sources'][number]) => void = vi.fn(),
    analysisMode:
      'rule-based' | 'disabled' | 'pending' | 'uncertain' | 'failed' | 'classified' = 'rule-based',
    summary?: {
      enabled?: boolean;
      visibleQuestionCount?: number;
      runtime?: QaSummaryRuntimeCompatibleDTO | null;
      onRequestSummary?: () => void;
      onSummarySourceActivate?: (source: {
        id: string;
        label: string;
      }) => void | boolean | Promise<void | boolean>;
      onRequestSummaryContextPreview?: () => Promise<QaSummaryContextPreviewDTO>;
    },
    moreSourcesContext?: {
      recommendation?: ModerationCompassRecommendation | null;
      qaSortMode?: 'TOP' | 'BEST' | 'CONTROVERSIAL' | 'TIME';
      wordCloudSmoothingActive?: boolean;
      wordCloudSingleWordsOnly?: boolean;
    },
  ) {
    const closed = new Subject<void>();
    const dialogRef = {
      close: vi.fn(() => {
        closed.next();
        closed.complete();
      }),
      afterClosed: () => closed.asObservable(),
      disableClose: false,
    };
    TestBed.configureTestingModule({
      imports: [ModerationCompassDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            cards: () => cards,
            recommendation: () => moreSourcesContext?.recommendation ?? null,
            analysisMode,
            onSourceActivate,
            summaryEnabled: () => summary?.enabled === true,
            summaryVisibleQuestionCount: () => summary?.visibleQuestionCount ?? 0,
            summary: () => summary?.runtime ?? null,
            onRequestSummary: summary?.onRequestSummary,
            onSummarySourceActivate: summary?.onSummarySourceActivate,
            onRequestSummaryContextPreview: summary?.onRequestSummaryContextPreview,
            qaSortMode: () => moreSourcesContext?.qaSortMode ?? 'BEST',
            wordCloudSmoothingActive: () => moreSourcesContext?.wordCloudSmoothingActive === true,
            wordCloudSingleWordsOnly: () => moreSourcesContext?.wordCloudSingleWordsOnly === true,
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
      'Noch keine Hinweise. Sobald Fragen, Ergebnisse oder Tempo-Rückmeldungen vorliegen, unterstützt dich der Kompass bei der Wahl des nächsten Schritts.',
    );
    expect(text).toContain('Du entscheidest, was du als Nächstes aufgreifst.');
    expect(text).not.toContain(
      'Wähle einen Eintrag, um die zugehörige Frage, Wortwolke, das Ergebnis oder die Rückmeldung zu öffnen.',
    );
    expect(text).not.toContain('Aus der Live-Runde');
    expect(text).not.toContain('Die automatische Sortierung der Fragen ist aus.');
    expect(
      fixture.nativeElement.querySelector('.dialog-title-header__icon .moderation-compass-icon'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.moderation-compass-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="moderation-next-step"]')).toBeNull();
  });

  it('zeigt den naechsten Schritt und die Direktaktion auch bei nur einer Themenkarte', () => {
    const view = buildModerationCompassView({
      qaQuestions: [],
      qaTerms: [{ label: 'Stichprobe', documentFrequency: 3, sourceCount: 3, memberTexts: [] }],
      freetextTerms: [],
      extraTopicSources: [],
      topicWeightLabel: null,
      tempo: null,
      quizSources: [],
    });
    expect(view.cards).toHaveLength(1);
    expect(view.cards[0]?.nextStepReason).toBeUndefined();
    expect(view.recommendation?.reason).toBe('topics');
    const { fixture } = setup(view.cards, vi.fn(), 'rule-based', undefined, {
      recommendation: view.recommendation,
    });
    expect(
      fixture.nativeElement.querySelector('[data-testid="moderation-next-step"]')?.textContent,
    ).toContain('Fass die häufigsten Themen kurz zusammen.');
    expect(
      fixture.nativeElement.querySelector('.moderation-compass-dialog__primary-source')
        ?.textContent,
    ).toContain('Wortwolke öffnen');
  });

  it('zeigt quellenbelegte Moderationskarten', () => {
    const { fixture } = setup([
      {
        kind: 'topics',
        nextStepReason: 'topics',
        sources: [
          {
            kind: 'qa-term',
            label: 'Median',
            evidence: 'Wie berechnet man den Median?',
          },
        ],
      },
    ]);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Häufige Themen');
    expect(text).toContain('Median');
    expect(text).toContain('Wie berechnet man den Median?');
    expect(text).not.toContain('Median · Wie berechnet man den Median?');
    expect(text).toContain('Als Nächstes');
    expect(text).toContain('Fass die häufigsten Themen kurz zusammen.');
    expect(
      fixture.nativeElement.querySelector('.moderation-compass-dialog__now-action')?.textContent,
    ).toContain('Fass die häufigsten Themen kurz zusammen.');
    expect(text).toContain('Aus der Live-Runde');
    expect(text).toContain(
      'Wähle einen Eintrag, um die zugehörige Frage, Wortwolke, das Ergebnis oder die Rückmeldung zu öffnen.',
    );
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

  it('zeigt den ruhigen Zustand ohne Hinweis auf ausgeschaltete Sortierung', () => {
    const { fixture } = setup([], vi.fn(), 'disabled');
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Die automatische Sortierung der Fragen ist aus.');
    expect(text).toContain('Noch keine Hinweise.');
    expect(text).not.toContain('Aus der Live-Runde');
  });

  it('zeigt pending zurückhaltend', () => {
    const { fixture } = setup([], vi.fn(), 'pending');
    expect(fixture.nativeElement.textContent).toContain('Die Fragen werden gerade geordnet.');
  });

  it('zeigt uncertain zurückhaltend', () => {
    const { fixture } = setup([], vi.fn(), 'uncertain');
    expect(fixture.nativeElement.textContent).toContain(
      'Einige Fragen konnten nicht eindeutig zugeordnet werden.',
    );
  });

  it('zeigt failed zurückhaltend', () => {
    const { fixture } = setup([], vi.fn(), 'failed');
    expect(fixture.nativeElement.textContent).toContain(
      'Die Fragen können gerade nicht automatisch geordnet werden.',
    );
  });

  it('zeigt classified mit Hinweis auf Inhalt, Ablauf und Technik', () => {
    const { fixture } = setup([], vi.fn(), 'classified');
    expect(fixture.nativeElement.textContent).toContain(
      'Die Fragen sind nach Inhalt, Organisation und Technik geordnet.',
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

  it('benennt neutrales Tempo-Signal als Feedback zum Vortragstempo', () => {
    const { fixture } = setup([
      {
        kind: 'tempo',
        sources: [{ kind: 'tempo', label: 'Die meisten können folgen.' }],
      },
    ]);

    expect(fixture.nativeElement.textContent).toContain('Feedback zum Vortragstempo');
    expect(fixture.nativeElement.textContent).not.toContain('Kommen nicht mit');
  });

  it('normalisiert Emoji-Shortcodes in der Summary-Quellen-Aria', () => {
    const { fixture } = setup([]);
    const aria = fixture.componentInstance.summarySourceJumpAria({
      id: 'qa-question:11111111-1111-4111-8111-111111111111',
      kind: 'qa-question',
      label: ':cry: Gerade etwas überfordert',
    });

    expect(aria).toContain('😭');
    expect(aria).toContain('Gerade etwas überfordert');
    expect(aria).not.toContain(':cry:');
  });

  it('zeigt Emoji-Shortcodes in Quiz-Quellen als Icon', () => {
    const { fixture } = setup([
      {
        kind: 'clarification',
        nextStepReason: 'quiz-survey',
        sources: [
          {
            kind: 'quiz-result',
            label: 'Häufigste Antwort: :cry: Gerade etwas überfordert',
          },
        ],
      },
    ]);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('😭');
    expect(text).toContain('Gerade etwas überfordert');
    expect(text).not.toContain(':cry:');
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

  it('oeffnet die erste erreichbare Quelle direkt aus dem naechsten Schritt und erlaubt Retry', async () => {
    const source = {
      kind: 'qa-question' as const,
      label: 'Warum diese Verteilung?',
      target: { channel: 'qa' as const },
    };
    let reject!: (error: Error) => void;
    const onSourceActivate = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, rejectPromise) => {
            reject = rejectPromise;
          }),
      )
      .mockResolvedValueOnce(true);
    const { fixture, dialogRef } = setup(
      [
        {
          kind: 'friction',
          nextStepReason: 'controversy',
          sources: [{ kind: 'qa-question', label: 'Nur Kontext' }, source],
        },
      ],
      onSourceActivate,
    );
    const button = fixture.nativeElement.querySelector(
      '.moderation-compass-dialog__primary-source',
    ) as HTMLButtonElement;
    expect(button.textContent).toContain('Frage öffnen');
    expect(button.getAttribute('aria-label')).toContain('Warum diese Verteilung?');
    button.focus();
    button.click();
    fixture.detectChanges();
    button.click();
    expect(onSourceActivate).toHaveBeenCalledTimes(1);
    expect(onSourceActivate).toHaveBeenCalledWith(source, 'friction');
    expect(button.getAttribute('aria-busy')).toBe('true');
    reject(new Error('offline'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Versuche es erneut.',
    );
    expect(document.activeElement).toBe(button);
    button.click();
    await fixture.whenStable();
    expect(dialogRef.close).toHaveBeenCalledOnce();
  });

  it('macht Quellen klickbar und schließt den Dialog', async () => {
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
    expect(button?.textContent).toContain('Fragen');
    expect(
      button?.querySelector('.moderation-compass-card__source-label')?.textContent?.trim(),
    ).toBe('Kommt Kapitel 4 in der Klausur vor?');
    expect(fixture.nativeElement.querySelector('[data-tone="caution"]')).not.toBeNull();
    button?.click();

    await fixture.whenStable();
    expect(onSourceActivate).toHaveBeenCalledWith(source, 'clarification');
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('übergibt den Fokus nach einem Wortwolken-Sprung an den Zieldialog', async () => {
    const source = {
      kind: 'qa-term' as const,
      label: 'Stichprobe',
      target: { channel: 'qa' as const, surface: 'word-cloud' as const },
    };
    const destinationClose = document.createElement('button');
    destinationClose.className = 'qa-word-cloud-dialog__close';
    document.body.append(destinationClose);
    const { fixture } = setup([
      {
        kind: 'topics',
        sources: [source],
      },
    ]);

    const button = fixture.nativeElement.querySelector(
      '.moderation-compass-card__source-button',
    ) as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    await Promise.resolve();

    expect(document.activeElement).toBe(destinationClose);
    destinationClose.remove();
  });

  it('lässt den Dialog offen, wenn der Sprung fehlschlägt', async () => {
    const source = {
      kind: 'quiz-result' as const,
      label: 'Viele falsche Antworten',
      target: {
        channel: 'quiz' as const,
        questionId: '11111111-1111-4111-8111-111111111111',
      },
    };
    const onSourceActivate = vi.fn().mockResolvedValue(false);
    const { fixture, dialogRef } = setup(
      [
        {
          kind: 'clarification',
          sources: [source],
        },
      ],
      onSourceActivate,
    );

    const button = fixture.nativeElement.querySelector(
      '.moderation-compass-card__source-button',
    ) as HTMLButtonElement | null;
    button?.click();
    await fixture.whenStable();

    expect(onSourceActivate).toHaveBeenCalledWith(source, 'clarification');
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('.moderation-compass-card__source-button'),
    ).not.toBeNull();
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
    expect(fixture.nativeElement.textContent).toContain('Weitere Hinweise (2)');
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

  it('zeigt Top-Themen der Wortwolke bei BEST, Glättung und Einzelwörtern', () => {
    const { fixture } = setup(
      [
        {
          kind: 'topics',
          sources: [
            {
              kind: 'qa-term',
              label: 'eins',
              target: { channel: 'qa', surface: 'word-cloud', termLabel: 'eins' },
            },
            {
              kind: 'qa-term',
              label: 'zwei',
              target: { channel: 'qa', surface: 'word-cloud', termLabel: 'zwei' },
            },
            {
              kind: 'qa-term',
              label: 'drei',
              target: { channel: 'qa', surface: 'word-cloud', termLabel: 'drei' },
            },
            {
              kind: 'qa-term',
              label: 'vier',
              target: { channel: 'qa', surface: 'word-cloud', termLabel: 'vier' },
            },
            {
              kind: 'qa-term',
              label: 'fünf',
              target: { channel: 'qa', surface: 'word-cloud', termLabel: 'fünf' },
            },
          ],
        },
      ],
      vi.fn(),
      'rule-based',
      undefined,
      {
        qaSortMode: 'BEST',
        wordCloudSmoothingActive: true,
        wordCloudSingleWordsOnly: true,
      },
    );

    expect(fixture.nativeElement.textContent).toContain('Top-Themen der Wortwolke');
    expect(fixture.nativeElement.textContent).not.toContain('Weitere Wortwolken-Themen');

    const details = fixture.nativeElement.querySelector(
      '.moderation-compass-card__more',
    ) as HTMLDetailsElement;
    details.open = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Zuerst der Begriff aus der Wortwolke, danach ein Beispiel aus einer zugehörigen Frage.',
    );
  });

  it('zeigt Weitere Wortwolken-Themen wenn Phrasen aktiv sind', () => {
    const { fixture } = setup(
      [
        {
          kind: 'topics',
          sources: [
            {
              kind: 'qa-term',
              label: 'eins',
              target: { channel: 'qa', surface: 'word-cloud', termLabel: 'eins' },
            },
            {
              kind: 'qa-term',
              label: 'zwei',
              target: { channel: 'qa', surface: 'word-cloud', termLabel: 'zwei' },
            },
            {
              kind: 'qa-term',
              label: 'drei',
              target: { channel: 'qa', surface: 'word-cloud', termLabel: 'drei' },
            },
            {
              kind: 'qa-term',
              label: 'vier',
              target: { channel: 'qa', surface: 'word-cloud', termLabel: 'vier' },
            },
          ],
        },
      ],
      vi.fn(),
      'rule-based',
      undefined,
      {
        qaSortMode: 'BEST',
        wordCloudSmoothingActive: true,
        wordCloudSingleWordsOnly: false,
      },
    );

    expect(fixture.nativeElement.textContent).toContain('Weitere Wortwolken-Themen');
    expect(fixture.nativeElement.textContent).not.toContain('Top-Themen der Wortwolke');
  });

  it('blendet die Zusammenfassung aus wenn der Kill-Switch aus ist', () => {
    const { fixture } = setup([]);
    expect(fixture.nativeElement.querySelector('[data-testid="moderation-summary"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Zusammenfassung');
  });

  it('blendet die Legacy-Zusammenfassung ohne Inferenz-Endpunkt aus', () => {
    const { fixture } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      visibleQuestionCount: 5,
      runtime: { enabled: true, inferenceConfigured: false, result: null },
    });
    expect(fixture.nativeElement.querySelector('[data-testid="moderation-summary"]')).toBeNull();
  });

  it('zeigt V2 mit lokalem Fallback auch ohne Inferenz-Endpunkt', () => {
    const onRequestSummary = vi.fn();
    const { fixture } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      visibleQuestionCount: 5,
      runtime: v2Runtime({ inferenceConfigured: false, result: null }),
      onRequestSummary,
    });

    const card = fixture.nativeElement.querySelector('[data-testid="moderation-summary"]');
    expect(card).not.toBeNull();
    (card.querySelector('.moderation-compass-dialog__summary-button') as HTMLButtonElement).click();
    expect(onRequestSummary).toHaveBeenCalledTimes(1);
  });

  it('blendet die Zusammenfassung bei weniger als drei sichtbaren Fragen aus', () => {
    const { fixture } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      visibleQuestionCount: 2,
      runtime: { enabled: true, inferenceConfigured: true, result: null },
    });
    expect(fixture.nativeElement.querySelector('[data-testid="moderation-summary"]')).toBeNull();
  });

  it('zeigt die Zusammenfassungskarte bei konfiguriertem Endpunkt und drei Fragen', () => {
    const { fixture } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      visibleQuestionCount: 3,
      runtime: { enabled: true, inferenceConfigured: true, result: null },
    });
    expect(
      fixture.nativeElement.querySelector('[data-testid="moderation-summary"]'),
    ).not.toBeNull();
  });

  it('zeigt pending und ready quellengebunden', async () => {
    const sourceId = qaSummaryQuestionSourceId('11111111-1111-4111-8111-111111111111');
    const onRequestSummary = vi.fn();
    const onSummarySourceActivate = vi.fn();
    const { fixture, dialogRef } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      visibleQuestionCount: 3,
      onRequestSummary,
      onSummarySourceActivate,
      runtime: {
        enabled: true,
        inferenceConfigured: true,
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
    expect(text).toContain('Fragen zusammenfassen');
    expect(text).toContain('Wichtige offene Fragen');
    expect(text).toContain(
      'Hier siehst du die wichtigsten Fragen aus der Session auf einen Blick.',
    );
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
    expect(text).toContain('Zusammenfassung aktualisieren');
    expect(text).not.toContain('Fragen zusammenfassen');
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
    await fixture.whenStable();
    expect(onSummarySourceActivate).toHaveBeenCalledWith({
      id: sourceId,
      kind: 'qa-question',
      label: 'Kommt Kapitel 4 in der Klausur vor?',
    });
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('wartet beim Sprung aus den verwendeten Beiträgen und bleibt bei Fehler offen', async () => {
    const sourceId = qaSummaryQuestionSourceId('11111111-1111-4111-8111-111111111111');
    let resolveJump!: (value: boolean) => void;
    const onSummarySourceActivate = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            resolveJump = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error('temporär'));
    const { fixture, dialogRef } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      visibleQuestionCount: 3,
      onSummarySourceActivate,
      runtime: v2Runtime({
        inferenceConfigured: false,
        result: {
          schemaVersion: 2,
          contractVersion: 'qa-summary-result-v2',
          status: 'ready',
          statements: [{ text: 'Klausur: Der Umfang ist noch offen.', sourceIds: [sourceId] }],
          suggestedNextSteps: [],
          limitations: [],
          sources: [
            { id: sourceId, kind: 'qa-question', label: 'Kommt Kapitel 4 in der Klausur vor?' },
          ],
          snapshotHash: 'a'.repeat(64),
          locale: 'de',
          execution: {
            attemptedMode: null,
            effectiveMode: 'extractive',
            fallback: {
              contractVersion: 'qa-summary-fallback-v1',
              requestedRequestContract: 'qa-summary-context-v2',
              requestedOutputContract: 'qa-summary-model-output-v3',
              mode: 'extractive',
              reason: 'disabled',
              retry: 'not-applicable',
            },
          },
        },
      }),
    });

    (
      fixture.nativeElement.querySelector(
        '.moderation-compass-dialog__summary-button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const details = fixture.nativeElement.querySelector(
      '.moderation-compass-dialog__summary-sources',
    ) as HTMLDetailsElement;
    details.open = true;
    fixture.detectChanges();
    const sourceButton = fixture.nativeElement.querySelector(
      '[data-testid="moderation-summary"] .moderation-compass-card__source-button',
    ) as HTMLButtonElement;

    sourceButton.click();
    fixture.detectChanges();
    expect(sourceButton.getAttribute('aria-disabled')).toBe('true');
    expect(dialogRef.close).not.toHaveBeenCalled();
    resolveJump(false);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(sourceButton.getAttribute('aria-disabled')).toBeNull();

    sourceButton.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Der Eintrag konnte nicht geöffnet werden.',
    );
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
      runtime: v2Runtime({
        inferenceConfigured: true,
        result: {
          schemaVersion: 2,
          contractVersion: 'qa-summary-result-v2',
          status: 'pending',
          statements: [],
          suggestedNextSteps: [],
          limitations: [],
          sources: [],
          snapshotHash: 'b'.repeat(64),
          locale: 'de',
          execution: {
            attemptedMode: 'full-context',
            effectiveMode: 'full-context',
            fallback: null,
          },
        },
      }),
    });
    expect(pending.fixture.nativeElement.textContent).toContain(
      'Die wichtigsten Fragen werden zusammengestellt. Ähnliche Fragen werden gebündelt.',
    );
    expect(pending.fixture.nativeElement.textContent).toContain(
      'Das kann bei vielen Fragen etwas dauern.',
    );
    expect(pending.fixture.nativeElement.textContent).toContain('Was wird ausgewertet?');
    expect(pending.fixture.nativeElement.textContent).not.toContain('Was wurde ausgewertet?');
    const progress = pending.fixture.nativeElement.querySelector(
      'mat-progress-bar.moderation-compass-dialog__summary-progress-bar',
    ) as HTMLElement | null;
    expect(progress).not.toBeNull();
    expect(progress?.getAttribute('aria-label')).toBe(
      'Die wichtigsten Fragen werden zusammengestellt. Ähnliche Fragen werden gebündelt.',
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
      visibleQuestionCount: 5,
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
    expect(
      failed.fixture.nativeElement.querySelector('[data-testid="moderation-summary"]'),
    ).toBeNull();
    expect(failed.fixture.nativeElement.textContent).not.toContain(
      'Kein privater Inferenzserver konfiguriert.',
    );

    TestBed.resetTestingModule();
    const failedDuplicate = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      visibleQuestionCount: 3,
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
    expect(
      failedDuplicate.fixture.nativeElement.querySelector(
        '.moderation-compass-dialog__summary-heading',
      ),
    ).toBeNull();

    TestBed.resetTestingModule();
    const emptySnapshot = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      visibleQuestionCount: 2,
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
    expect(
      emptySnapshot.fixture.nativeElement.querySelector('[data-testid="moderation-summary"]'),
    ).toBeNull();
    expect(emptySnapshot.fixture.nativeElement.textContent).not.toContain(
      'Es gibt noch zu wenige sichtbare Fragen für eine Zusammenfassung.',
    );
  });

  it('behält eine ready-Kurzfassung unter drei Fragen und fordert keine neue an', () => {
    const sourceId = qaSummaryQuestionSourceId('11111111-1111-4111-8111-111111111111');
    const onRequestSummary = vi.fn();
    const { fixture } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      visibleQuestionCount: 1,
      onRequestSummary,
      runtime: {
        enabled: true,
        inferenceConfigured: true,
        result: {
          status: 'ready',
          statements: [{ text: 'Es gibt eine Frage zur Klausur.', sourceIds: [sourceId] }],
          suggestedNextSteps: [],
          limitations: [],
          sources: [
            { id: sourceId, kind: 'qa-question', label: 'Kommt Kapitel 4 in der Klausur vor?' },
          ],
          snapshotHash: 'a'.repeat(64),
          locale: 'de',
        },
      },
    });

    expect(
      fixture.nativeElement.querySelector('[data-testid="moderation-summary"]'),
    ).not.toBeNull();
    (
      fixture.nativeElement.querySelector(
        '.moderation-compass-dialog__summary-button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(onRequestSummary).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Es gibt eine Frage zur Klausur.');
  });

  it('zeigt V2-Belege außerhalb von Q&A statisch an', () => {
    const sourceId = 'semantic-topic:median';
    const onSummarySourceActivate = vi.fn();
    const { fixture } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      visibleQuestionCount: 3,
      onSummarySourceActivate,
      runtime: v2Runtime({
        inferenceConfigured: false,
        result: {
          schemaVersion: 2,
          contractVersion: 'qa-summary-result-v2',
          status: 'ready',
          statements: [{ text: 'Median: Berechnung und Formel.', sourceIds: [sourceId] }],
          suggestedNextSteps: [],
          limitations: [],
          sources: [{ id: sourceId, kind: 'semantic-topic', label: 'Median und Formel' }],
          snapshotHash: 'a'.repeat(64),
          locale: 'de',
          execution: {
            attemptedMode: null,
            effectiveMode: 'extractive',
            fallback: {
              contractVersion: 'qa-summary-fallback-v1',
              requestedRequestContract: 'qa-summary-context-v2',
              requestedOutputContract: 'qa-summary-model-output-v3',
              mode: 'extractive',
              reason: 'disabled',
              retry: 'not-applicable',
            },
          },
        },
      }),
    });

    (
      fixture.nativeElement.querySelector(
        '.moderation-compass-dialog__summary-button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Verwendete Beiträge (1)');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="moderation-summary"] .moderation-compass-card__source-static',
      )?.textContent,
    ).toContain('Thema:');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="moderation-summary"] .moderation-compass-card__source-static',
      ),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="moderation-summary"] .moderation-compass-card__source-button',
      ),
    ).toBeNull();
    expect(onSummarySourceActivate).not.toHaveBeenCalled();
  });

  it('lässt extraktive Fragen mit nachgestelltem Antwortwunsch vollständig im Wortlaut', () => {
    const firstSourceId = qaSummaryQuestionSourceId('11111111-1111-4111-8111-111111111111');
    const secondSourceId = qaSummaryQuestionSourceId('22222222-2222-4222-8222-222222222222');
    const firstQuestion =
      'Welche Beispiele zu »roter Faden« würden helfen, wenn Pausen das Lernen stützen? Bitte mit Visualisierung oder Gegenbeispiel antworten.';
    const secondQuestion =
      'Wie hängt »Fragen im Q&A« mit den Übungen zusammen, damit Rückmeldungen rechtzeitig kommen? Kontext: Lernen mit Beispielen und Übungen.';
    const { fixture } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      visibleQuestionCount: 4,
      runtime: v2Runtime({
        inferenceConfigured: false,
        result: {
          schemaVersion: 2,
          contractVersion: 'qa-summary-result-v2',
          status: 'ready',
          statements: [
            { text: firstQuestion, sourceIds: [firstSourceId] },
            { text: secondQuestion, sourceIds: [secondSourceId] },
          ],
          suggestedNextSteps: [],
          limitations: [
            'Eine ausführliche Zusammenfassung war diesmal nicht möglich. Deshalb werden die wichtigsten Fragen im Wortlaut angezeigt.',
          ],
          sources: [
            { id: firstSourceId, kind: 'qa-question', label: firstQuestion },
            { id: secondSourceId, kind: 'qa-question', label: secondQuestion },
          ],
          modelVersion: 'extractive-v2',
          snapshotHash: 'a'.repeat(64),
          locale: 'de',
          execution: {
            attemptedMode: 'full-context',
            effectiveMode: 'extractive',
            fallback: {
              contractVersion: 'qa-summary-fallback-v1',
              requestedRequestContract: 'qa-summary-context-v2',
              requestedOutputContract: 'qa-summary-model-output-v3',
              mode: 'extractive',
              reason: 'invalid_response',
              retry: 'manual',
            },
          },
        },
      }),
    });

    (
      fixture.nativeElement.querySelector(
        '.moderation-compass-dialog__summary-button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const statements = Array.from(
      fixture.nativeElement.querySelectorAll('.moderation-compass-dialog__summary-statements li'),
      (item) => (item as HTMLElement).textContent?.trim(),
    );
    expect(statements).toEqual([firstQuestion, secondQuestion]);
    expect(fixture.nativeElement.textContent).not.toContain('Beispiele: Welche zu');
    expect(fixture.nativeElement.textContent).not.toContain('Übungen: Wie hängt');

    const sources = fixture.nativeElement.querySelector(
      '.moderation-compass-dialog__summary-sources',
    ) as HTMLDetailsElement;
    sources.open = true;
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="moderation-summary"] .moderation-compass-card__source-button',
      )?.textContent,
    ).toContain(`Fragen:\u00a0${firstQuestion}`);
  });

  it('erklärt die Auswertung verständlich und verbirgt Fachbegriffe in technischen Details', async () => {
    const preview = contextPreviewFixture();
    const onRequestSummaryContextPreview = vi
      .fn<() => Promise<QaSummaryContextPreviewDTO>>()
      .mockRejectedValueOnce(new Error('temporär'))
      .mockResolvedValueOnce(preview);
    const { fixture } = setup([], vi.fn(), 'rule-based', {
      enabled: true,
      visibleQuestionCount: 3,
      runtime: v2Runtime({ inferenceConfigured: false, result: null }),
      onRequestSummaryContextPreview,
    });

    const diagnosis = fixture.nativeElement.querySelector(
      '[data-testid="moderation-summary-diagnosis"]',
    ) as HTMLDetailsElement;
    expect(diagnosis).not.toBeNull();
    expect(diagnosis.open).toBe(false);
    diagnosis.open = true;
    fixture.detectChanges();
    expect(onRequestSummaryContextPreview).not.toHaveBeenCalled();

    const loadButton = diagnosis.querySelector(
      '.moderation-compass-dialog__preview-button',
    ) as HTMLButtonElement;
    loadButton.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Informationen zur Auswertung konnten nicht geladen werden.',
      );
    });
    expect(loadButton.disabled).toBe(false);

    loadButton.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="summary-context-preview"]'),
      ).not.toBeNull();
    });

    const text = fixture.nativeElement.textContent as string;
    expect(onRequestSummaryContextPreview).toHaveBeenCalledTimes(2);
    expect(text).toContain('Überblick');
    expect(text).toContain('Die wichtigsten offenen Fragen werden direkt ausgewählt');
    expect(text).toContain('Direkt ausgewertete Beiträge');
    expect(text).toContain('Themen: 1');
    expect(text).not.toContain('Q&A:');
    expect(text).toContain('wurde nicht in die Auswertung einbezogen');
    expect(text).not.toContain('ist ausgeschaltet');
    expect(text).toContain(
      'Diese Beiträge wurden direkt ausgewertet. Ähnliche Fragen sind darin mitberücksichtigt.',
    );
    expect(text).toContain('Oct 5, 2026');
    expect(text).not.toContain('2026-10-05T17:00:00.000Z');
    expect(text).not.toContain('Zusammengefasste Inhalte');
    expect(text).toContain('Nur die wichtigsten Beiträge wurden ausgewählt.');
    const technicalDetails = fixture.nativeElement.querySelector(
      '.moderation-compass-dialog__technical-details',
    ) as HTMLDetailsElement;
    expect(technicalDetails).not.toBeNull();
    expect(technicalDetails.open).toBe(false);
    expect(text).toContain('qa-summary-context-preview-v1');
    expect(text).toContain('moderation-prompt-context-v1');
    expect(text).toContain('1 von 2500 ausgewählt');
    const technicalValues = [...fixture.nativeElement.querySelectorAll('dd')].map((entry) =>
      (entry.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(technicalValues).toContain('3138 / 8192 Tokens');
    expect(technicalValues).toContain('640 Tokens');
    expect(technicalValues).toContain('128 Tokens');
    expect(text).toContain('Die Auswahl wurde neu erstellt.');
    expect(text).toContain('nicht alle Beiträge konnten einzeln ausgewertet werden');
    expect(text).not.toContain('budget-truncated');
    expect(text).not.toContain('token-budget');
    expect(text).not.toContain('GEHEIMER QUELLENTEXT');
    expect(text).not.toContain('GEHEIMES LIMITDETAIL');
    expect(text).not.toContain('hidden fixture detail');
  });
});
