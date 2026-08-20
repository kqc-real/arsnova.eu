import { describe, expect, it } from 'vitest';
import {
  buildModerationCompassCards,
  collectModerationQuizFacts,
  collectQaNlpCategorySources,
  compassQuestionStem,
  compassTermsFromAnalysisEntries,
  extraModerationCompassSources,
  mergeModerationQuizSources,
  moderationCompassSourceDestination,
  notableQuickFeedbackSplit,
  rememberModerationQuizSnapshot,
  resolveModerationCompassAnalysisMode,
  splitModerationSummaryLead,
  truncateCompassLabel,
  visibleModerationCompassSources,
  type ModerationCompassSnapshot,
} from './moderation-compass';

const emptySnapshot: ModerationCompassSnapshot = {
  qaQuestions: [],
  qaTerms: [],
  freetextTerms: [],
  extraTopicSources: [],
  topicWeightLabel: null,
  tempo: null,
  quizSources: [],
};

describe('truncateCompassLabel', () => {
  it('lässt kurze Quellen unverändert', () => {
    expect(truncateCompassLabel('Was ist ein Median?')).toBe('Was ist ein Median?');
  });

  it('kürzt lange Quellen mit Auslassung', () => {
    const label = truncateCompassLabel('a'.repeat(120), 20);
    expect(label.endsWith('…')).toBe(true);
    expect(label.length).toBeLessThanOrEqual(20);
  });
});

describe('splitModerationSummaryLead', () => {
  it('trennt Thema und Klausel am Doppelpunkt', () => {
    expect(splitModerationSummaryLead('Median: Formel und Berechnung sind unklar.')).toEqual({
      lead: 'Median',
      body: 'Formel und Berechnung sind unklar.',
    });
  });

  it('lässt Fließsätze ohne Lead unverändert', () => {
    const text = 'Es gibt eine Frage zur Klausur.';
    expect(splitModerationSummaryLead(text)).toEqual({ lead: null, body: text });
  });

  it('macht Gemini-Protokolle zu Thema plus Klausel', () => {
    expect(
      splitModerationSummaryLead(
        'Es gibt konkrete Fragen zur Berechnung des Medians und der dazu passenden Formel.',
      ),
    ).toEqual({
      lead: 'Median',
      body: 'Berechnung und Formel.',
    });
  });

  it('lässt englische Kommalisten nicht zu deutschen und-Ketten werden', () => {
    expect(splitModerationSummaryLead('Topics: inputs, outputs, and errors.', 'en')).toEqual({
      lead: 'Topics',
      body: 'Inputs, outputs, and errors.',
    });
  });
});

describe('compassQuestionStem', () => {
  it('nimmt die Markdown-Überschrift ohne Medien', () => {
    expect(
      compassQuestionStem(
        '### Ordne die Schritte der Genexpression in einer eukaryotischen Zelle.\n\n![Schema](https://example.com/x.png)\n\nBringe die sechs Schritte in die korrekte Abfolge.',
        80,
      ),
    ).toBe('Ordne die Schritte der Genexpression in einer eukaryotischen Zelle.');
  });

  it('kürzt lange Titel an der Wortgrenze', () => {
    const stem = compassQuestionStem(
      '### Ordne den historischen Daten der Weimarer Republik das passende Ereignis zu.',
      48,
    );
    expect(stem).toBe('Ordne den historischen Daten der Weimarer…');
    expect(stem.includes('Repub')).toBe(false);
  });
});

describe('buildModerationCompassCards', () => {
  it('zeigt keinen Kompass ohne belastbare Signale', () => {
    expect(buildModerationCompassCards(emptySnapshot)).toEqual([]);
  });

  it('bildet Themenkarten nur aus mehrfach belegten Begriffen', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      qaTerms: [
        {
          label: 'Median',
          documentFrequency: 4,
          sourceCount: 4,
          memberTexts: ['Wie berechnet man den Median?'],
          memberSourceIds: ['question-median'],
          sortMode: 'BEST',
          analysisVariant: 'THEME',
        },
        {
          label: 'einmalig',
          documentFrequency: 1,
          sourceCount: 1,
          memberTexts: ['einmalig'],
        },
      ],
    });

    const topics = cards.find((card) => card.kind === 'topics');
    expect(topics?.sources).toEqual([
      {
        kind: 'qa-term',
        label: 'Median · Wie berechnet man den Median?',
        focusHint: 'Median',
        target: {
          channel: 'qa',
          surface: 'word-cloud',
          termLabel: 'Median',
          memberText: 'Wie berechnet man den Median?',
          memberTexts: ['Wie berechnet man den Median?'],
          questionId: 'question-median',
          questionIds: ['question-median'],
          sortMode: 'BEST',
          analysisVariant: 'THEME',
        },
      },
    ]);
    expect(cards.some((card) => card.kind === 'nextStep')).toBe(false);
    expect(cards.find((card) => card.kind === 'topics')?.nextStepReason).toBeUndefined();
  });

  it('mischt Q&A- und Freitext-Begriffe in der Themenkarte', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      qaTerms: [
        {
          label: 'Median',
          documentFrequency: 4,
          sourceCount: 4,
          memberTexts: ['Wie berechnet man den Median?', 'Median bitte erklären'],
          memberSourceIds: ['q-median-1', 'q-median-2'],
        },
      ],
      freetextTerms: [
        {
          label: 'Gruppenarbeit',
          documentFrequency: 3,
          sourceCount: 3,
          memberTexts: ['Mehr Gruppenarbeit'],
        },
      ],
    });

    const topics = cards.find((card) => card.kind === 'topics');
    expect(topics?.sources.map((source) => source.kind)).toEqual(['qa-term', 'freetext-term']);
    expect(topics?.sources[0]?.target).toEqual({
      channel: 'qa',
      surface: 'word-cloud',
      termLabel: 'Median',
      memberText: 'Wie berechnet man den Median?',
      memberTexts: ['Wie berechnet man den Median?', 'Median bitte erklären'],
      questionId: 'q-median-1',
      questionIds: ['q-median-1', 'q-median-2'],
    });
  });

  it('mischt Q&A, Freitext und hervorgehobene Fragen in der Themenkarte', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      qaTerms: [
        {
          label: 'Median',
          documentFrequency: 4,
          sourceCount: 4,
          memberTexts: ['Wie berechnet man den Median?'],
        },
        {
          label: 'Varianz',
          documentFrequency: 3,
          sourceCount: 3,
          memberTexts: ['Was ist Varianz?'],
        },
        {
          label: 'Quartil',
          documentFrequency: 3,
          sourceCount: 3,
          memberTexts: ['Was ist ein Quartil?'],
        },
      ],
      freetextTerms: [
        {
          label: 'Gruppenarbeit',
          documentFrequency: 3,
          sourceCount: 3,
          memberTexts: ['Mehr Gruppenarbeit'],
        },
      ],
      extraTopicSources: [
        {
          kind: 'qa-question',
          label: 'Hervorgehoben: Bitte Kapitel 4 erklären',
          target: { channel: 'qa', questionId: '11111111-1111-4111-8111-111111111111' },
        },
      ],
    });

    const kinds =
      cards.find((card) => card.kind === 'topics')?.sources.map((source) => source.kind) ?? [];
    expect(kinds.slice(0, 3)).toEqual(['qa-term', 'freetext-term', 'qa-question']);
    expect(kinds.length).toBeGreaterThan(3);
  });

  it('stellt NLP-Kategorien in der Themenkarte vor Wortwolken-Begriffe', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      qaTerms: [
        {
          label: 'Median',
          documentFrequency: 4,
          sourceCount: 4,
          memberTexts: ['Wie berechnet man den Median?'],
        },
      ],
      freetextTerms: [
        {
          label: 'Gruppenarbeit',
          documentFrequency: 3,
          sourceCount: 3,
          memberTexts: ['Mehr Gruppenarbeit'],
        },
      ],
      nlpTopicSources: [
        {
          kind: 'qa-question',
          label: 'Inhaltliche Fragen · 2',
          target: {
            channel: 'qa',
            questionId: '11111111-1111-4111-8111-111111111111',
            questionIds: [
              '11111111-1111-4111-8111-111111111111',
              '33333333-3333-4333-8333-333333333333',
            ],
          },
        },
        {
          kind: 'qa-question',
          label: 'Fragen zum Ablauf',
          target: { channel: 'qa', questionId: '22222222-2222-4222-8222-222222222222' },
        },
        {
          kind: 'qa-question',
          label: 'Technische Fragen',
          target: { channel: 'qa', questionId: '44444444-4444-4444-8444-444444444444' },
        },
      ],
    });

    const labels =
      cards.find((card) => card.kind === 'topics')?.sources.map((source) => source.label) ?? [];
    expect(labels.slice(0, 3)).toEqual([
      'Inhaltliche Fragen · 2',
      'Fragen zum Ablauf',
      'Technische Fragen',
    ]);
    expect(labels).toContain('Median · Wie berechnet man den Median?');
  });

  it('bildet Themenkarten auch nur aus Freitext-Begriffen', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      freetextTerms: [
        {
          label: 'Gruppenarbeit',
          documentFrequency: 3,
          sourceCount: 3,
          memberTexts: ['Mehr Gruppenarbeit'],
        },
      ],
    });

    expect(cards.find((card) => card.kind === 'topics')?.sources[0]?.kind).toBe('freetext-term');
  });

  it('zeigt Klärung aus offenen Moderationsfragen', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      qaQuestions: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Kommt Kapitel 4 in der Klausur vor?',
          status: 'PENDING',
        },
      ],
    });

    expect(cards.find((card) => card.kind === 'clarification')?.sources).toEqual([
      {
        kind: 'qa-question',
        label: 'Kommt Kapitel 4 in der Klausur vor?',
        target: { channel: 'qa', questionId: '11111111-1111-4111-8111-111111111111' },
      },
    ]);
    expect(cards.find((card) => card.kind === 'clarification')?.nextStepReason).toBeUndefined();
    expect(cards.some((card) => card.kind === 'nextStep')).toBe(false);
  });

  it('hängt den nächsten Schritt an die auslösende Karte', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      qaTerms: [
        {
          label: 'Median',
          documentFrequency: 4,
          sourceCount: 4,
          memberTexts: ['Wie berechnet man den Median?'],
        },
      ],
      qaQuestions: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Kommt Kapitel 4 in der Klausur vor?',
          status: 'PENDING',
        },
      ],
    });

    const clarification = cards.find((card) => card.kind === 'clarification');
    expect(cards.some((card) => card.kind === 'nextStep')).toBe(false);
    expect(clarification?.nextStepReason).toBe('pending-qa');
    expect(clarification?.sources[0]?.label).toBe('Kommt Kapitel 4 in der Klausur vor?');
    expect(cards.find((card) => card.kind === 'topics')?.nextStepReason).toBeUndefined();
  });

  it('nimmt Quiz-Verwirrung erst nach Ergebnisfreigabe auf', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      quizInsightKind: 'scorable',
      quizSources: [
        {
          kind: 'quiz-result',
          label: '22 von 30 liegen daneben · Was ist 2+2?',
        },
      ],
    });

    const clarification = cards.find((card) => card.kind === 'clarification');
    expect(clarification?.sources.some((source) => source.kind === 'quiz-result')).toBe(true);
    expect(clarification?.nextStepReason).toBe('quiz-confusion');
    expect(cards.some((card) => card.kind === 'nextStep')).toBe(false);
  });

  it('nutzt für Umfragen keinen Lösungshinweis', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      quizInsightKind: 'survey',
      quizSources: [
        {
          kind: 'quiz-result',
          label: 'Häufigste Antwort: :neutral_face: Ganz okay',
        },
      ],
    });

    const clarification = cards.find((card) => card.kind === 'clarification');
    expect(clarification?.nextStepReason).toBe('quiz-survey');
    expect(clarification?.nextStepReason).not.toBe('quiz-confusion');
  });

  it('nutzt für Bewertungen einen eigenen Moderationshinweis', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      quizInsightKind: 'rating',
      quizSources: [
        {
          kind: 'quiz-result',
          label: 'Durchschnitt 2,0 von 5',
        },
      ],
    });

    expect(cards.find((card) => card.kind === 'clarification')?.nextStepReason).toBe('quiz-rating');
  });

  it('stellt Quiz-Verwirrung vor offenen Moderationsfragen', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      quizInsightKind: 'scorable',
      qaQuestions: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Kommt Kapitel 4 in der Klausur vor?',
          status: 'PENDING',
        },
      ],
      quizSources: [
        {
          kind: 'quiz-result',
          label: '22 von 30 liegen daneben · Was ist 2+2?',
        },
      ],
    });

    expect(cards.find((card) => card.kind === 'clarification')?.nextStepReason).toBe(
      'quiz-confusion',
    );
    expect(cards.some((card) => card.kind === 'nextStep')).toBe(false);
  });

  it('stellt Tempo-Alarm vor Quiz-Verwirrung', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      tempo: { label: 'Viele kommen nicht mehr mit.', tone: 'alert' },
      quizSources: [
        {
          kind: 'quiz-result',
          label: '22 von 30 liegen daneben · Was ist 2+2?',
        },
      ],
      qaQuestions: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Kommt Kapitel 4 in der Klausur vor?',
          status: 'PENDING',
        },
      ],
    });

    expect(cards.find((card) => card.kind === 'tempo')?.nextStepReason).toBe('tempo');
    expect(cards.find((card) => card.kind === 'tempo')?.tone).toBe('alert');
    expect(cards.some((card) => card.kind === 'nextStep')).toBe(false);
  });

  it('bildet Reibung nur aus kontroversen, nicht archivierten Fragen', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      qaQuestions: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Ist die Klausur open book?',
          status: 'ACTIVE',
          isControversial: true,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          text: 'Alte Debatte',
          status: 'ARCHIVED',
          isControversial: true,
          controversyScore: 0.9,
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          text: 'Gelöschte Debatte',
          status: 'DELETED',
          isControversial: true,
          controversyScore: 0.95,
        },
      ],
    });

    expect(cards.find((card) => card.kind === 'friction')?.sources).toEqual([
      {
        kind: 'qa-question',
        label: 'Ist die Klausur open book?',
        target: { channel: 'qa', questionId: '11111111-1111-4111-8111-111111111111' },
      },
    ]);
  });

  it('reiht offene Fragen nach dem aktiven Q&A-Sortiermodus', () => {
    const questions = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Weniger Zustimmung',
        status: 'PENDING' as const,
        score: 1,
        bestScore: 0.8,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        text: 'Mehr Zustimmung',
        status: 'PENDING' as const,
        score: 8,
        bestScore: 0.2,
      },
    ];

    expect(
      buildModerationCompassCards({
        ...emptySnapshot,
        qaSortMode: 'TOP',
        qaQuestions: questions,
      })
        .find((card) => card.kind === 'clarification')
        ?.sources.map((source) => source.label),
    ).toEqual(['Mehr Zustimmung', 'Weniger Zustimmung']);

    expect(
      buildModerationCompassCards({
        ...emptySnapshot,
        qaSortMode: 'BEST',
        qaQuestions: questions,
      })
        .find((card) => card.kind === 'clarification')
        ?.sources.map((source) => source.label),
    ).toEqual(['Weniger Zustimmung', 'Mehr Zustimmung']);
  });

  it('reiht Reibung nach controversyScore und nutzt den Score auch ohne Flag', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      qaQuestions: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Leicht umstritten',
          status: 'ACTIVE',
          isControversial: true,
          controversyScore: 0.55,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          text: 'Stark umstritten',
          status: 'PINNED',
          controversyScore: 0.82,
        },
      ],
    });

    expect(
      cards.find((card) => card.kind === 'friction')?.sources.map((source) => source.label),
    ).toEqual(['Stark umstritten', 'Leicht umstritten']);
  });

  it('übernimmt Tempo nur mit vorhandener Tendenz', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      tempo: { label: 'Es wirkt zu schnell.', tone: 'caution' },
    });

    expect(cards.find((card) => card.kind === 'tempo')?.sources).toEqual([
      { kind: 'tempo', label: 'Es wirkt zu schnell.', target: { channel: 'quickFeedback' } },
    ]);
    expect(cards.find((card) => card.kind === 'tempo')?.nextStepReason).toBe('tempo');
    expect(cards.some((card) => card.kind === 'nextStep')).toBe(false);
  });

  it('unterdrückt Karten ohne nachvollziehbare Quelle', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      qaTerms: [{ label: '  ', documentFrequency: 5, sourceCount: 5, memberTexts: ['   '] }],
      qaQuestions: [{ id: '1', text: '   ', status: 'PENDING' }],
    });

    expect(cards).toEqual([]);
  });

  it('lässt in der Klärung Platz für Quiz-Quellen neben offenen Fragen', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      qaQuestions: [
        { id: '11111111-1111-4111-8111-111111111111', text: 'Frage eins?', status: 'PENDING' },
        { id: '22222222-2222-4222-8222-222222222222', text: 'Frage zwei?', status: 'PENDING' },
        { id: '33333333-3333-4333-8333-333333333333', text: 'Frage drei?', status: 'PENDING' },
      ],
      quizSources: [
        {
          kind: 'quiz-result',
          label: '22 von 30 liegen daneben · Was ist 2+2?',
        },
      ],
    });

    const clarification = cards.find((card) => card.kind === 'clarification');
    expect(clarification?.sources).toHaveLength(4);
    expect(clarification?.sources.filter((source) => source.kind === 'qa-question')).toHaveLength(
      3,
    );
    expect(clarification?.sources.some((source) => source.kind === 'quiz-result')).toBe(true);
  });

  it('hängt die Gewichtungsbasis an, wenn in der Themenkarte Platz ist', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      qaTerms: [
        {
          label: 'Median',
          documentFrequency: 4,
          sourceCount: 4,
          memberTexts: ['Wie berechnet man den Median?'],
        },
      ],
      topicWeightLabel: 'Gewichtung: beste Fragen',
    });

    expect(
      cards.find((card) => card.kind === 'topics')?.sources.map((source) => source.label),
    ).toEqual(['Median · Wie berechnet man den Median?', 'Gewichtung: beste Fragen']);
  });

  it('nimmt hervorgehobene Fragen als zusätzliche Themenquellen', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      extraTopicSources: [
        { kind: 'qa-question', label: 'Hervorgehoben: Bitte Kapitel 4 erklären' },
      ],
    });

    expect(cards.find((card) => card.kind === 'topics')?.sources[0]?.label).toBe(
      'Hervorgehoben: Bitte Kapitel 4 erklären',
    );
  });

  it('leitet bei Blitzlicht-Rückmeldungen den nächsten Schritt auf Feedback', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      tempo: {
        label: 'Die Rückmeldungen sind geteilt.',
        tone: 'caution',
        variant: 'feedback',
        title: 'Rückmeldungen',
      },
    });

    expect(cards.find((card) => card.kind === 'tempo')?.title).toBe('Rückmeldungen');
    expect(cards.find((card) => card.kind === 'tempo')?.nextStepReason).toBe('feedback');
    expect(cards.some((card) => card.kind === 'nextStep')).toBe(false);
  });

  it('stellt Tempo-Vorsicht vor offenen Moderationsfragen', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      tempo: { label: 'Es wirkt zu schnell.', tone: 'caution' },
      qaQuestions: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Kommt Kapitel 4 in der Klausur vor?',
          status: 'PENDING',
        },
      ],
    });

    expect(cards.find((card) => card.kind === 'tempo')?.nextStepReason).toBe('tempo');
    expect(cards.find((card) => card.kind === 'clarification')?.nextStepReason).toBeUndefined();
    expect(cards.find((card) => card.kind === 'clarification')?.tone).toBe('caution');
  });

  it('zeigt Tempo und Reibung vor Themen', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      tempo: { label: 'Viele kommen nicht mehr mit.', tone: 'alert' },
      qaTerms: [
        {
          label: 'Median',
          documentFrequency: 4,
          sourceCount: 4,
          memberTexts: ['Wie berechnet man den Median?'],
        },
      ],
      qaQuestions: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Ist die Klausur open book?',
          status: 'ACTIVE',
          isControversial: true,
        },
      ],
    });

    expect(cards.map((card) => card.kind)).toEqual(['tempo', 'friction', 'topics']);
  });

  it('bewahrt zusätzliche Quellen hinter den ersten drei', () => {
    const cards = buildModerationCompassCards({
      ...emptySnapshot,
      qaQuestions: [
        { id: '11111111-1111-4111-8111-111111111111', text: 'Frage eins?', status: 'PENDING' },
        { id: '22222222-2222-4222-8222-222222222222', text: 'Frage zwei?', status: 'PENDING' },
        { id: '33333333-3333-4333-8333-333333333333', text: 'Frage drei?', status: 'PENDING' },
        { id: '44444444-4444-4444-8444-444444444444', text: 'Frage vier?', status: 'PENDING' },
        { id: '55555555-5555-4555-8555-555555555555', text: 'Frage fünf?', status: 'PENDING' },
      ],
    });

    const sources = cards.find((card) => card.kind === 'clarification')?.sources ?? [];
    expect(sources).toHaveLength(5);
    expect(visibleModerationCompassSources(sources)).toHaveLength(3);
    expect(extraModerationCompassSources(sources).map((source) => source.label)).toEqual([
      'Frage vier?',
      'Frage fünf?',
    ]);
  });
});

describe('moderationCompassSourceDestination', () => {
  it('erkennt Wortwolke, Quiz, Blitzlicht und Q&A', () => {
    expect(
      moderationCompassSourceDestination({
        kind: 'qa-term',
        label: 'Median',
        target: { channel: 'qa', surface: 'word-cloud', termLabel: 'Median' },
      }),
    ).toBe('word-cloud');
    expect(
      moderationCompassSourceDestination({
        kind: 'quiz-result',
        label: '22 von 30 liegen daneben',
        target: { channel: 'quiz' },
      }),
    ).toBe('quiz');
    expect(
      moderationCompassSourceDestination({
        kind: 'tempo',
        label: 'Viele kommen nicht mehr mit.',
        target: { channel: 'quickFeedback' },
      }),
    ).toBe('quickFeedback');
    expect(
      moderationCompassSourceDestination({
        kind: 'qa-question',
        label: 'Was ist der Median?',
        target: { channel: 'qa', questionId: '11111111-1111-4111-8111-111111111111' },
      }),
    ).toBe('qa');
  });
});

describe('collectModerationQuizFacts', () => {
  it('sammelt Mehrheitsfehler, Schätzlage und typische Strukturfehler', () => {
    const facts = collectModerationQuizFacts({
      totalVotes: 30,
      correctVoterCount: 8,
      incorrectVoterCount: 22,
      voteDistribution: [
        { text: '4', isCorrect: true, voteCount: 8 },
        { text: '5', isCorrect: false, voteCount: 18 },
      ],
      numericReferenceValue: 100,
      numericIntervalLeft: 90,
      numericIntervalRight: 110,
      numericStats: {
        n: 30,
        median: 70,
        stdDev: 40,
        inBandPercent: 20,
      },
      numericRoundComparison: {
        inBandPercentDelta: -12,
        pairedAnalysis: { fartherCount: 18, closerCount: 4 },
      },
      matchingStats: {
        totalVotes: 20,
        fullyCorrectCount: 2,
        commonConfusions: [{ left: 'IaaS', wrongRight: 'SaaS', count: 9 }],
      },
      orderingStats: {
        totalVotes: 20,
        fullyCorrectCount: 3,
        commonSwaps: [{ itemAText: 'Schritt 2', itemBText: 'Schritt 3', count: 7 }],
      },
      categorizationStats: {
        totalVotes: 20,
        fullyCorrectCount: 4,
        commonMisclassifications: [{ itemText: 'Dropbox', wrongCategoryName: 'IaaS', count: 8 }],
      },
      ratingAvg: 2.1,
      ratingCount: 12,
      freeTextResponses: ['zu schnell erklärt', 'zu schnell erklärt', 'alles klar'],
    });

    expect(facts.map((fact) => fact.type)).toEqual([
      'wrong-majority',
      'in-band',
      'numeric-round-worse',
      'numeric-round-farther',
      'matching-confusion',
      'ordering-swap',
    ]);
  });

  it('erkennt niedrige Bewertungen und wiederholte Freitexte', () => {
    expect(
      collectModerationQuizFacts({
        type: 'RATING',
        ratingAvg: 2.0,
        ratingCount: 5,
        freeTextResponses: ['Bitte langsamer sprechen', 'Bitte langsamer sprechen'],
      }).map((fact) => fact.type),
    ).toEqual(['rating-low', 'freetext-repeat']);
  });

  it('leitet Umfragen ohne Lösungslogik und mit häufigster Antwort', () => {
    expect(
      collectModerationQuizFacts({
        type: 'SURVEY',
        totalVotes: 10,
        voteDistribution: [
          { text: ':neutral_face: Ganz okay', isCorrect: false, voteCount: 6 },
          { text: 'Genervt', isCorrect: false, voteCount: 4 },
        ],
      }).map((fact) => fact.type),
    ).toEqual(['survey-top']);
    expect(
      collectModerationQuizFacts({
        type: 'SURVEY',
        totalVotes: 10,
        voteDistribution: [
          { text: 'Ja', isCorrect: false, voteCount: 6 },
          { text: 'Nein', isCorrect: false, voteCount: 4 },
        ],
      }).some((fact) => fact.type === 'wrong-option'),
    ).toBe(false);
  });

  it('nimmt den häufigsten Histogramm-Bereich außerhalb des Bands auf', () => {
    expect(
      collectModerationQuizFacts({
        numericHistogram: [
          { from: 40, to: 60, count: 12, inBand: false },
          { from: 90, to: 110, count: 4, inBand: true },
        ],
      }),
    ).toEqual([{ type: 'histogram-peak-out', from: 40, to: 60, share: 75 }]);
  });
});

describe('notableQuickFeedbackSplit', () => {
  it('erkennt geteilte Rückmeldungen ohne klare Mehrheit', () => {
    expect(notableQuickFeedbackSplit(10, { POSITIVE: 5, NEGATIVE: 5 })).toMatchObject({
      split: true,
      majorityRatio: 0.5,
    });
  });

  it('bildet den Sterne-Durchschnitt', () => {
    expect(notableQuickFeedbackSplit(10, { '1': 4, '2': 4, '5': 2 }).starAverage).toBe(2.2);
  });
});

describe('compassTermsFromAnalysisEntries', () => {
  it('übernimmt sichtbare Lemma- oder Themen-Einträge', () => {
    expect(
      compassTermsFromAnalysisEntries(
        [
          {
            label: 'Kapitel',
            count: 4,
            members: [
              { text: 'Kommt Kapitel 4?', sourceId: 'q1' },
              { text: 'Kapitel 4 erklären', sourceId: 'q2' },
            ],
          },
        ],
        { sortMode: 'TOP', analysisVariant: 'LEXICAL' },
      ),
    ).toEqual([
      {
        label: 'Kapitel',
        documentFrequency: 4,
        sourceCount: 2,
        memberTexts: ['Kommt Kapitel 4?', 'Kapitel 4 erklären'],
        memberSourceIds: ['q1', 'q2'],
        sortMode: 'TOP',
        analysisVariant: 'LEXICAL',
      },
    ]);
  });

  it('liefert null ohne Einträge', () => {
    expect(compassTermsFromAnalysisEntries([])).toBeNull();
    expect(compassTermsFromAnalysisEntries(null)).toBeNull();
  });
});

describe('mergeModerationQuizSources', () => {
  it('behält die aktuelle Frage vorn und füllt mit dem letzten RESULTS-Snapshot auf', () => {
    const current = [
      {
        kind: 'quiz-result' as const,
        label: '22 von 30 liegen daneben · Was ist 2+2?',
        target: { channel: 'quiz' as const },
      },
    ];
    const merged = mergeModerationQuizSources(
      current,
      rememberModerationQuizSnapshot([], 'aaaaaaaa-1111-4111-8111-111111111111', [
        { kind: 'quiz-result', label: 'Die Schätzungen liegen weit auseinander · π' },
      ]),
      'bbbbbbbb-2222-4222-8222-222222222222',
    );

    expect(merged.map((source) => source.label)).toEqual([
      '22 von 30 liegen daneben · Was ist 2+2?',
      'Die Schätzungen liegen weit auseinander · π',
    ]);
    expect(merged.every((source) => source.target?.channel === 'quiz')).toBe(true);
  });
});

describe('resolveModerationCompassAnalysisMode', () => {
  it('zeigt disabled wenn die Kaskade aus ist', () => {
    expect(resolveModerationCompassAnalysisMode({ enabled: false, statuses: ['pending'] })).toBe(
      'disabled',
    );
  });

  it('priorisiert pending vor failed und classified', () => {
    expect(
      resolveModerationCompassAnalysisMode({
        enabled: true,
        statuses: ['classified', 'pending', 'failed'],
      }),
    ).toBe('pending');
  });

  it('faellt ohne NLP-Status auf die regelbasierte Basis zurueck', () => {
    expect(resolveModerationCompassAnalysisMode({ enabled: true, statuses: ['disabled'] })).toBe(
      'rule-based',
    );
  });
});

describe('collectQaNlpCategorySources', () => {
  it('buendelt klassifizierte Fragen nach Label', () => {
    const sources = collectQaNlpCategorySources(
      [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Kommt Kapitel 4?',
          status: 'ACTIVE',
          nlp: { status: 'classified', category: 'content' },
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          text: 'Wann ist die Klausur?',
          status: 'ACTIVE',
          nlp: { status: 'classified', category: 'organization' },
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          text: 'Was ist der Median?',
          status: 'ACTIVE',
          nlp: { status: 'classified', category: 'content' },
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          text: 'WLAN tot',
          status: 'ACTIVE',
          nlp: { status: 'uncertain' },
        },
      ],
      {
        content: 'Inhaltliche Fragen',
        organization: 'Fragen zum Ablauf',
        technical: 'Technische Fragen',
      },
    );

    expect(sources.map((source) => source.label)).toEqual([
      'Inhaltliche Fragen · 2',
      'Fragen zum Ablauf',
    ]);
    expect(sources[0]?.focusHint).toBe('Inhaltliche Fragen');
    expect(sources[0]?.target?.questionIds).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
    ]);
  });
});
