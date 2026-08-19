import { describe, expect, it } from 'vitest';
import { QaNlpResultSchema, QaNlpRuntimeDTOSchema, QaQuestionDTOSchema } from './schemas.js';

const questionBase = {
  id: '11111111-1111-4111-8111-111111111111',
  text: 'Kommt Kapitel 4 in der Klausur vor?',
  upvoteCount: 2,
  status: 'ACTIVE' as const,
  createdAt: '2026-08-19T10:00:00.000Z',
  hasUpvoted: false,
  isOwn: false,
  myVote: null,
};

const emptyMetrics = {
  queueLength: 0,
  lastLatencyMs: null,
  completed: 0,
  failed: 0,
  skipped: 0,
  earlyExit: 0,
  fallback: 0,
  unclassified: 0,
  earlyExitRate: 0,
  fallbackRate: 0,
  unclassifiedRate: 0,
};

describe('Q&A-NLP-Vertrag (Story 8.9b)', () => {
  it('akzeptiert pending ohne Kategorie und Konfidenz', () => {
    const parsed = QaNlpResultSchema.parse({ status: 'pending' });
    expect(parsed).toEqual({ status: 'pending' });
  });

  it('fordert bei classified ein Themenlabel', () => {
    expect(QaNlpResultSchema.safeParse({ status: 'classified' }).success).toBe(false);
    const parsed = QaNlpResultSchema.parse({
      status: 'classified',
      category: 'content',
      confidence: 0.91,
      modelVersion: 'stub',
      analyzedAt: '2026-08-19T10:00:01.000Z',
    });
    expect(parsed.category).toBe('content');
  });

  it('lehnt Konfidenz ausserhalb 0..1 ab', () => {
    expect(
      QaNlpResultSchema.safeParse({
        status: 'uncertain',
        confidence: 1.2,
      }).success,
    ).toBe(false);
  });

  it('haelt den Runtime-Kill-Switch als Host-only-DTO', () => {
    expect(QaNlpRuntimeDTOSchema.parse({ enabled: false, metrics: emptyMetrics })).toEqual({
      enabled: false,
      metrics: emptyMetrics,
    });
  });

  it('laesst Teilnehmer-Fragen ohne nlp zu und streift unbekannte Moderationsartefakte', () => {
    const parsed = QaQuestionDTOSchema.parse({
      ...questionBase,
      moderationCompass: { cards: [] },
      nlpDebugSnapshot: { participantId: 'secret' },
    });
    expect(parsed).not.toHaveProperty('nlp');
    expect(parsed).not.toHaveProperty('moderationCompass');
    expect(parsed).not.toHaveProperty('nlpDebugSnapshot');
  });

  it('behaelt nlp nur wenn das Feld explizit gesetzt ist', () => {
    const parsed = QaQuestionDTOSchema.parse({
      ...questionBase,
      nlp: { status: 'failed', modelVersion: 'stub', analyzedAt: '2026-08-19T10:00:02.000Z' },
    });
    expect(parsed.nlp?.status).toBe('failed');
  });
});
