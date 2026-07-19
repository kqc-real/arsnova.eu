import { describe, expect, it } from 'vitest';
import { getDemoQuizPayload, getDemoQuizSeedFingerprint } from './demo-quiz-payload';

describe('getDemoQuizSeedFingerprint', () => {
  it('ändert sich mit exportVersion, Motiv-URL und komplettem Payload (Demo-Reseed)', () => {
    const de = getDemoQuizSeedFingerprint('de');
    expect(de).toMatch(/^de\|27\|/);
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

  it('enthält eine zweirundige Schätzfrage zur Französischen Revolution in allen Locales', () => {
    const expectedHeadlineByLocale = {
      de: 'In welchem Jahr begann die Französische Revolution?',
      en: 'In which year did the French Revolution begin?',
      es: '¿En qué año comenzó la Revolución francesa?',
      fr: 'En quelle année la Révolution française a-t-elle commencé ?',
      it: 'In quale anno iniziò la Rivoluzione francese?',
    } as const;

    for (const [locale, headline] of Object.entries(expectedHeadlineByLocale)) {
      const payload = getDemoQuizPayload(locale as keyof typeof expectedHeadlineByLocale) as {
        exportVersion?: number;
        quiz?: {
          questions?: Array<{
            text?: string;
            type?: string;
            order?: number;
            answers?: Array<{ text?: string; isCorrect?: boolean }>;
            numericToleranceMode?: string;
            numericReferenceValue?: number;
            numericTolerancePercent?: number | null;
            numericIntervalLeft?: number;
            numericIntervalRight?: number;
            numericInputType?: string;
            numericDecimalPlaces?: number;
            numericMin?: number;
            numericMax?: number;
            numericTwoRounds?: boolean;
          }>;
        };
      };

      const estimateQuestion = payload.quiz?.questions?.find(
        (question) => question.type === 'NUMERIC_ESTIMATE' && question.text?.includes(headline),
      );

      expect(payload.exportVersion).toBe(27);
      expect(payload.quiz?.questions).toHaveLength(9);
      expect(estimateQuestion?.text).toContain(headline);
      expect(estimateQuestion).toMatchObject({
        order: 7,
        answers: [],
        numericToleranceMode: 'ABSOLUTE_INTERVAL',
        numericReferenceValue: 1789,
        numericIntervalLeft: 1700,
        numericIntervalRight: 1900,
        numericInputType: 'INTEGER',
        numericMin: 1500,
        numericMax: 2000,
        numericTwoRounds: true,
      });
    }
  });

  it('enthält die Pi-Frage als numerische Schätzfrage in allen Locales', () => {
    const expectedHeadlineByLocale = {
      de: 'Runde $\\pi$ auf zwei Dezimalstellen.',
      en: 'Round $\\pi$ to two decimal places.',
      es: 'Redondea $\\pi$ a dos decimales.',
      fr: 'Arrondissez $\\pi$ à deux décimales.',
      it: 'Arrotonda $\\pi$ a due cifre decimali.',
    } as const;

    for (const [locale, headline] of Object.entries(expectedHeadlineByLocale)) {
      const payload = getDemoQuizPayload(locale as keyof typeof expectedHeadlineByLocale) as {
        quiz?: {
          questions?: Array<{
            text?: string;
            type?: string;
            order?: number;
            skipReadingPhase?: boolean;
            answers?: Array<{ text?: string; isCorrect?: boolean }>;
            numericToleranceMode?: string;
            numericReferenceValue?: number;
            numericTolerancePercent?: number | null;
            numericIntervalLeft?: number;
            numericIntervalRight?: number;
            numericInputType?: string;
            numericDecimalPlaces?: number;
            numericMin?: number;
            numericMax?: number;
            numericTwoRounds?: boolean;
          }>;
        };
      };

      const piQuestion = payload.quiz?.questions?.find(
        (question) => question.type === 'NUMERIC_ESTIMATE' && question.text?.includes(headline),
      );

      expect(piQuestion).toMatchObject({
        order: 1,
        skipReadingPhase: true,
        answers: [],
        numericToleranceMode: 'ABSOLUTE_INTERVAL',
        numericReferenceValue: 3.14,
        numericTolerancePercent: null,
        numericIntervalLeft: 3.1,
        numericIntervalRight: 3.2,
        numericInputType: 'DECIMAL',
        numericDecimalPlaces: 2,
        numericMin: 3,
        numericMax: 3.5,
        numericTwoRounds: false,
      });
    }
  });

  it('nutzt fuer die KI-oder-Foto-Frage ein lokales Asset und neutrale Alt-Texte', () => {
    const expectedAltByLocale = {
      de: 'Dachszene',
      en: 'Rooftop scene',
      es: 'Escena en una azotea',
      fr: 'Scène de toit',
      it: 'Scena sul tetto',
    } as const;

    for (const [locale, alt] of Object.entries(expectedAltByLocale)) {
      const payload = getDemoQuizPayload(locale as keyof typeof expectedAltByLocale) as {
        quiz?: { questions?: Array<{ text?: string; type?: string }> };
      };
      const question = payload.quiz?.questions?.find((q) => q.type === 'SINGLE_CHOICE');

      expect(question?.text).toContain(
        `![${alt}](/assets/demo/Bettgestell%20auf%20der%20Dachspitze.png)`,
      );
      expect(question?.text).not.toContain('cdn.imago-images.de');
      expect(question?.text).not.toContain('0105048862');
    }
  });

  it('enthält eine 1.2ea-taugliche SHORT_TEXT-Frage mit Varianten und Buchstabendrehern', () => {
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
    expect(shortTextQuestion?.text).toContain('Buchstabendreher');
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
        expect.objectContaining({ text: 'Mazur Methode', isCorrect: true }),
      ]),
    );
  });

  it('aktiviert den Sicherheitsgrad an ausgewählten bewertbaren Showcase-Fragen', () => {
    const confidenceOrders = new Set([1, 2, 3, 4, 6, 7]);

    for (const locale of ['de', 'en', 'es', 'fr', 'it'] as const) {
      const payload = getDemoQuizPayload(locale) as {
        quiz?: {
          questions?: Array<{
            order?: number;
            type?: string;
            confidenceEnabled?: boolean;
            confidenceLabelLow?: string;
            confidenceLabelHigh?: string;
          }>;
        };
      };

      for (const question of payload.quiz?.questions ?? []) {
        if (confidenceOrders.has(question.order ?? -1)) {
          expect(question.confidenceEnabled).toBe(true);
          expect(question.confidenceLabelLow?.length).toBeGreaterThan(0);
          expect(question.confidenceLabelHigh?.length).toBeGreaterThan(0);
        } else if (
          question.type === 'SINGLE_CHOICE' ||
          question.type === 'MULTIPLE_CHOICE' ||
          question.type === 'SHORT_TEXT' ||
          question.type === 'NUMERIC_ESTIMATE'
        ) {
          expect(question.confidenceEnabled).not.toBe(true);
        }
      }
    }

    const deDescription = (getDemoQuizPayload('de') as { quiz?: { description?: string } }).quiz
      ?.description;
    expect(deDescription).toContain('Selbsteinschätzung');
    expect(deDescription).toContain('selbstsicher falsche');
  });

  it('enthält keine Schallgeschwindigkeits-Frage mehr', () => {
    for (const locale of ['de', 'en', 'es', 'fr', 'it'] as const) {
      const payload = getDemoQuizPayload(locale) as {
        quiz?: {
          questions?: Array<{
            text?: string;
            type?: string;
            shortTextEvaluationKind?: string;
          }>;
        };
      };

      expect(payload.quiz?.questions).toHaveLength(9);
      expect(payload.quiz?.questions?.some((question) => question.text?.includes('58 cm'))).toBe(
        false,
      );
      expect(
        payload.quiz?.questions?.some(
          (question) =>
            question.type === 'SHORT_TEXT' && question.shortTextEvaluationKind === 'numeric_unit',
        ),
      ).toBe(false);
    }
  });
});
