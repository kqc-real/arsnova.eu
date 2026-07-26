import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_QUIZ_HISTORY_LEGACY_PROOF_CUTOFF_AT,
  allowLegacyQuizHistoryProofAfterBind,
  getQuizHistoryLegacyProofCutoffAt,
  isLegacyQuizHistoryAccessProof,
  isQuizHistoryLegacyProofCutoffReached,
} from './quizHistoryLegacyProofPolicy';

describe('quizHistoryLegacyProofPolicy', () => {
  afterEach(() => {
    delete process.env.QUIZ_HISTORY_LEGACY_PROOF_CUTOFF_AT;
  });

  it('nutzt den dokumentierten Default-Cutoff', () => {
    expect(getQuizHistoryLegacyProofCutoffAt({}).toISOString()).toBe(
      DEFAULT_QUIZ_HISTORY_LEGACY_PROOF_CUTOFF_AT,
    );
  });

  it('liest einen gültigen Env-Cutoff', () => {
    expect(
      getQuizHistoryLegacyProofCutoffAt({
        QUIZ_HISTORY_LEGACY_PROOF_CUTOFF_AT: '2026-12-24T12:00:00.000Z',
      }).toISOString(),
    ).toBe('2026-12-24T12:00:00.000Z');
  });

  it('ignoriert ungültige Env-Werte', () => {
    expect(
      getQuizHistoryLegacyProofCutoffAt({
        QUIZ_HISTORY_LEGACY_PROOF_CUTOFF_AT: 'not-a-date',
      }).toISOString(),
    ).toBe(DEFAULT_QUIZ_HISTORY_LEGACY_PROOF_CUTOFF_AT);
  });

  it('erkennt Legacy-Hex-Proofs', () => {
    expect(isLegacyQuizHistoryAccessProof('a'.repeat(64))).toBe(true);
    expect(isLegacyQuizHistoryAccessProof('11111111-1111-4111-8111-111111111111')).toBe(false);
  });

  it('erlaubt Legacy nach Bind nur für bind vor Cutoff', () => {
    const beforeCutoff = new Date('2026-08-31T23:59:59.000Z');
    const afterCutoff = new Date('2026-09-01T00:00:00.000Z');
    const env = {};

    expect(
      allowLegacyQuizHistoryProofAfterBind({ purpose: 'history', now: beforeCutoff, env }),
    ).toBe(false);
    expect(allowLegacyQuizHistoryProofAfterBind({ purpose: 'bind', now: beforeCutoff, env })).toBe(
      true,
    );
    expect(allowLegacyQuizHistoryProofAfterBind({ purpose: 'bind', now: afterCutoff, env })).toBe(
      false,
    );
    expect(isQuizHistoryLegacyProofCutoffReached(afterCutoff, env)).toBe(true);
  });
});
