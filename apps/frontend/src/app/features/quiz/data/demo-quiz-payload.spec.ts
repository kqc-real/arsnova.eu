import { describe, expect, it } from 'vitest';
import { getDemoQuizPayload, getDemoQuizSeedFingerprint } from './demo-quiz-payload';

describe('getDemoQuizSeedFingerprint', () => {
  it('ändert sich mit exportVersion, Motiv-URL und Beschreibung (Demo-Reseed)', () => {
    const de = getDemoQuizSeedFingerprint('de');
    expect(de).toMatch(/^de\|22\|/);
    expect(de).toContain(
      'https://upload.wikimedia.org/wikipedia/commons/b/b4/Sixteen_faces_expressing_the_human_passions._Wellcome_L0068375_%28cropped%29.jpg',
    );
    expect(de.split('|').length).toBeGreaterThanOrEqual(5);
  });

  it('unterscheidet Locales', () => {
    expect(getDemoQuizSeedFingerprint('de')).not.toBe(getDemoQuizSeedFingerprint('en'));
  });

  it('markiert Frage 2 und 4 im Showcase explizit ohne Lesephase', () => {
    const payload = getDemoQuizPayload('de') as {
      quiz?: { questions?: Array<{ skipReadingPhase?: boolean }> };
    };

    expect(payload.quiz?.questions?.[1]?.skipReadingPhase).toBe(true);
    expect(payload.quiz?.questions?.[3]?.skipReadingPhase).toBe(true);
  });

  it('enthält eine anspruchsvolle SHORT_TEXT-Frage mit toleranter Auswertung', () => {
    const payload = getDemoQuizPayload('de') as {
      quiz?: {
        questions?: Array<{
          text?: string;
          type?: string;
          difficulty?: string;
          answers?: Array<{ text?: string; isCorrect?: boolean }>;
          shortTextMaxLength?: number;
          shortTextEvaluationMode?: string;
          shortTextToleranceLevel?: string;
          shortTextAllowPartialCredit?: boolean;
          shortTextTrimWhitespace?: boolean;
          shortTextNormalizeWhitespace?: boolean;
        }>;
      };
    };

    const shortTextQuestion = payload.quiz?.questions?.find(
      (question) => question.type === 'SHORT_TEXT',
    );

    expect(shortTextQuestion?.text).toContain('individuell abstimmen');
    expect(shortTextQuestion?.difficulty).toBe('HARD');
    expect(shortTextQuestion?.shortTextMaxLength).toBe(32);
    expect(shortTextQuestion?.shortTextEvaluationMode).toBe('auto');
    expect(shortTextQuestion?.shortTextToleranceLevel).toBe('medium');
    expect(shortTextQuestion?.shortTextAllowPartialCredit).toBe(true);
    expect(shortTextQuestion?.shortTextTrimWhitespace).toBe(true);
    expect(shortTextQuestion?.shortTextNormalizeWhitespace).toBe(true);
    expect(shortTextQuestion?.answers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Peer Instruction', isCorrect: true }),
        expect.objectContaining({ text: 'Peer-Instruction', isCorrect: true }),
        expect.objectContaining({ text: 'Mazur-Methode', isCorrect: true }),
      ]),
    );
  });
});
