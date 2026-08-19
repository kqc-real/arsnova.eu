import { describe, expect, it } from 'vitest';
import {
  AppLocaleEnum,
  QaQuestionDTOSchema,
  QaSummaryLocaleEnum,
  QaSummaryModelOutputSchema,
  QaSummaryResultSchema,
  QaSummaryRuntimeDTOSchema,
  parseQaSummaryQuestionSourceId,
  qaSummaryQuestionSourceId,
} from './schemas.js';

const QUESTION_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = qaSummaryQuestionSourceId(QUESTION_ID);

const readyResult = {
  status: 'ready' as const,
  statements: [{ text: 'Mehrere Fragen zielen auf die Klausur.', sourceIds: [SOURCE_ID] }],
  suggestedNextSteps: [{ text: 'Klär zuerst die Klausurfragen.', sourceIds: [SOURCE_ID] }],
  limitations: ['Nur sichtbare Q&A-Fragen, keine Teilnehmendenbewertung.'],
  sources: [
    { id: SOURCE_ID, kind: 'qa-question' as const, label: 'Kommt Kapitel 4 in der Klausur vor?' },
  ],
  modelVersion: 'stub',
  analyzedAt: '2026-08-19T16:00:00.000Z',
  snapshotHash: 'a'.repeat(64),
  locale: 'de' as const,
};

describe('Q&A-Zusammenfassungsvertrag (Story 8.9c)', () => {
  it('haelt AppLocale und Summary-Locale deckungsgleich', () => {
    expect(QaSummaryLocaleEnum.options).toEqual(AppLocaleEnum.options);
  });

  it('bildet und parst stabile Q&A-Quellen-IDs', () => {
    expect(SOURCE_ID).toBe(`qa-question:${QUESTION_ID}`);
    expect(parseQaSummaryQuestionSourceId(SOURCE_ID)).toBe(QUESTION_ID);
    expect(parseQaSummaryQuestionSourceId('qa-term:median')).toBeNull();
    expect(parseQaSummaryQuestionSourceId('qa-question:not-a-uuid')).toBeNull();
  });

  it('akzeptiert pending ohne Aussagen', () => {
    const parsed = QaSummaryResultSchema.parse({
      status: 'pending',
      statements: [],
      suggestedNextSteps: [],
      limitations: [],
      sources: [],
      snapshotHash: 'b'.repeat(64),
      locale: 'en',
    });
    expect(parsed.status).toBe('pending');
    expect(parsed.statements).toEqual([]);
  });

  it('fordert bei ready mindestens eine quellengebundene Aussage', () => {
    expect(
      QaSummaryResultSchema.safeParse({
        ...readyResult,
        statements: [],
      }).success,
    ).toBe(false);
    expect(QaSummaryResultSchema.parse(readyResult).statements).toHaveLength(1);
  });

  it('lehnt Aussagen ohne Quelle ab', () => {
    expect(
      QaSummaryResultSchema.safeParse({
        ...readyResult,
        statements: [{ text: 'Ohne Beleg.', sourceIds: [] }],
      }).success,
    ).toBe(false);
  });

  it('haelt den Runtime-Kill-Switch als Host-only-DTO', () => {
    expect(
      QaSummaryRuntimeDTOSchema.parse({
        enabled: false,
        inferenceConfigured: false,
        result: null,
      }),
    ).toEqual({
      enabled: false,
      inferenceConfigured: false,
      result: null,
    });
  });

  it('laesst Teilnehmer-Fragen ohne Summary-Artefakte zu', () => {
    const parsed = QaQuestionDTOSchema.parse({
      id: QUESTION_ID,
      text: 'Kommt Kapitel 4 in der Klausur vor?',
      upvoteCount: 2,
      status: 'ACTIVE',
      createdAt: '2026-08-19T10:00:00.000Z',
      hasUpvoted: false,
      isOwn: false,
      myVote: null,
      summary: readyResult,
      qaSummary: readyResult,
      moderationSummary: { status: 'ready' },
    });
    expect(parsed).not.toHaveProperty('summary');
    expect(parsed).not.toHaveProperty('qaSummary');
    expect(parsed).not.toHaveProperty('moderationSummary');
  });

  it('validiert die Modellantwort vor der Quellenbindung', () => {
    const parsed = QaSummaryModelOutputSchema.parse({
      status: 'ready',
      statements: [{ text: 'Zwei Fragen zur Klausur.', sourceIds: [SOURCE_ID] }],
      suggestedNextSteps: [],
      limitations: [],
    });
    expect(parsed.status).toBe('ready');
    expect(
      QaSummaryModelOutputSchema.safeParse({
        status: 'pending',
        statements: [],
        suggestedNextSteps: [],
        limitations: [],
      }).success,
    ).toBe(false);
  });
});
