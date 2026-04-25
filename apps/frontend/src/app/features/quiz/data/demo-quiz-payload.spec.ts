import { describe, expect, it } from 'vitest';
import { getDemoQuizPayload, getDemoQuizSeedFingerprint } from './demo-quiz-payload';

describe('getDemoQuizSeedFingerprint', () => {
  it('ändert sich mit exportVersion, Motiv-URL und Beschreibung (Demo-Reseed)', () => {
    const de = getDemoQuizSeedFingerprint('de');
    expect(de).toMatch(/^de\|21\|/);
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
});
