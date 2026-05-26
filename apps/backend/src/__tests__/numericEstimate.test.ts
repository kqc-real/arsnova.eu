import { describe, expect, it } from 'vitest';
import {
  resolveNumericTolerance,
  parseNumericInput,
  isNumericValueInBand,
  AddQuestionInputSchema,
} from '@arsnova/shared-types';

type AddQuestionInput = Record<string, unknown>;

const baseAbsolute: AddQuestionInput = {
  text: 'Wie viele Einwohner hat Berlin?',
  type: 'NUMERIC_ESTIMATE',
  order: 0,
  answers: [],
  numericToleranceMode: 'ABSOLUTE_INTERVAL',
  numericIntervalLeft: 3500000,
  numericIntervalRight: 4000000,
};

const baseRelative: AddQuestionInput = {
  text: 'Wie viele Einwohner hat Berlin?',
  type: 'NUMERIC_ESTIMATE',
  order: 0,
  answers: [],
  numericToleranceMode: 'RELATIVE_PERCENT',
  numericReferenceValue: 3800000,
  numericTolerancePercent: 5,
};

const parse = (input: AddQuestionInput) => AddQuestionInputSchema.safeParse(input);
const messages = (result: ReturnType<typeof parse>): string[] =>
  result.success ? [] : result.error.issues.map((i) => i.message);

describe('resolveNumericTolerance', () => {
  describe('ABSOLUTE_INTERVAL', () => {
    it('gibt korrektes Band zurück wenn L < R', () => {
      const result = resolveNumericTolerance('ABSOLUTE_INTERVAL', {
        intervalLeft: 10,
        intervalRight: 20,
      });
      expect(result).toEqual({ left: 10, right: 20 });
    });

    it('gibt null zurück wenn L >= R', () => {
      expect(
        resolveNumericTolerance('ABSOLUTE_INTERVAL', { intervalLeft: 20, intervalRight: 10 }),
      ).toBeNull();
      expect(
        resolveNumericTolerance('ABSOLUTE_INTERVAL', { intervalLeft: 10, intervalRight: 10 }),
      ).toBeNull();
    });

    it('gibt null zurück wenn Grenzen fehlen', () => {
      expect(resolveNumericTolerance('ABSOLUTE_INTERVAL', { intervalLeft: 10 })).toBeNull();
      expect(resolveNumericTolerance('ABSOLUTE_INTERVAL', { intervalRight: 20 })).toBeNull();
      expect(resolveNumericTolerance('ABSOLUTE_INTERVAL', {})).toBeNull();
    });

    it('gibt null zurück wenn Grenzen explizit null sind', () => {
      expect(
        resolveNumericTolerance('ABSOLUTE_INTERVAL', { intervalLeft: null, intervalRight: 20 }),
      ).toBeNull();
    });

    it('funktioniert mit negativen Grenzen', () => {
      const result = resolveNumericTolerance('ABSOLUTE_INTERVAL', {
        intervalLeft: -10,
        intervalRight: -5,
      });
      expect(result).toEqual({ left: -10, right: -5 });
    });
  });

  describe('RELATIVE_PERCENT', () => {
    it('berechnet korrektes Band für positives V', () => {
      // V=100, p=10 → delta=10, Band [90, 110]
      const result = resolveNumericTolerance('RELATIVE_PERCENT', {
        referenceValue: 100,
        tolerancePercent: 10,
      });
      expect(result?.left).toBeCloseTo(90);
      expect(result?.right).toBeCloseTo(110);
    });

    it('berechnet korrektes Band für negatives V', () => {
      // V=-50, p=20 → delta=10, Band [-60, -40]
      const result = resolveNumericTolerance('RELATIVE_PERCENT', {
        referenceValue: -50,
        tolerancePercent: 20,
      });
      expect(result?.left).toBeCloseTo(-60);
      expect(result?.right).toBeCloseTo(-40);
    });

    it('gibt null zurück wenn V=0 (relativer Modus nicht definiert)', () => {
      const result = resolveNumericTolerance('RELATIVE_PERCENT', {
        referenceValue: 0,
        tolerancePercent: 10,
      });
      expect(result).toBeNull();
    });

    it('gibt null zurück wenn V fehlt', () => {
      expect(resolveNumericTolerance('RELATIVE_PERCENT', { tolerancePercent: 10 })).toBeNull();
    });

    it('gibt null zurück wenn p fehlt', () => {
      expect(resolveNumericTolerance('RELATIVE_PERCENT', { referenceValue: 100 })).toBeNull();
    });

    it('gibt null zurück wenn V oder p explizit null sind', () => {
      expect(
        resolveNumericTolerance('RELATIVE_PERCENT', { referenceValue: null, tolerancePercent: 10 }),
      ).toBeNull();
      expect(
        resolveNumericTolerance('RELATIVE_PERCENT', {
          referenceValue: 100,
          tolerancePercent: null,
        }),
      ).toBeNull();
    });

    it('p=0 ergibt Band der Größe 0 (genau richtig)', () => {
      const result = resolveNumericTolerance('RELATIVE_PERCENT', {
        referenceValue: 100,
        tolerancePercent: 0,
      });
      expect(result?.left).toBeCloseTo(100);
      expect(result?.right).toBeCloseTo(100);
    });
  });
});

describe('parseNumericInput', () => {
  it('parst gültige Ganzzahl', () => {
    expect(parseNumericInput('42', { inputType: 'INTEGER' })).toBe(42);
    expect(parseNumericInput('-7', { inputType: 'INTEGER' })).toBe(-7);
  });

  it('gibt null zurück für Dezimalzahl wenn INTEGER erwartet', () => {
    expect(parseNumericInput('3.14', { inputType: 'INTEGER' })).toBeNull();
    expect(parseNumericInput('0.5', { inputType: 'INTEGER' })).toBeNull();
  });

  it('parst Dezimalzahl korrekt', () => {
    expect(parseNumericInput('3.14', { inputType: 'DECIMAL' })).toBe(3.14);
    expect(parseNumericInput('-0.5', { inputType: 'DECIMAL' })).toBe(-0.5);
  });

  it('akzeptiert Komma als Dezimaltrennzeichen', () => {
    expect(parseNumericInput('3,14', { inputType: 'DECIMAL' })).toBe(3.14);
  });

  it('trimmt Leerzeichen', () => {
    expect(parseNumericInput(' 42 ', { inputType: 'INTEGER' })).toBe(42);
  });

  it('gibt null zurück für leeren String', () => {
    expect(parseNumericInput('', { inputType: 'INTEGER' })).toBeNull();
    expect(parseNumericInput('   ', { inputType: 'INTEGER' })).toBeNull();
  });

  it('gibt null zurück für nicht-numerischen Input', () => {
    expect(parseNumericInput('abc', { inputType: 'DECIMAL' })).toBeNull();
    expect(parseNumericInput('1e5', { inputType: 'DECIMAL' })).toBeNull();
  });

  it('erzwingt maxDecimalPlaces', () => {
    expect(parseNumericInput('3.14', { inputType: 'DECIMAL', maxDecimalPlaces: 2 })).toBe(3.14);
    expect(parseNumericInput('3.141', { inputType: 'DECIMAL', maxDecimalPlaces: 2 })).toBeNull();
    expect(parseNumericInput('3.1', { inputType: 'DECIMAL', maxDecimalPlaces: 2 })).toBe(3.1);
  });

  it('maxDecimalPlaces=0 erlaubt nur Ganzzahlen', () => {
    expect(parseNumericInput('5', { inputType: 'DECIMAL', maxDecimalPlaces: 0 })).toBe(5);
    expect(parseNumericInput('5.0', { inputType: 'DECIMAL', maxDecimalPlaces: 0 })).toBeNull();
  });

  it('ignoriert maxDecimalPlaces wenn null', () => {
    expect(parseNumericInput('3.14159', { inputType: 'DECIMAL', maxDecimalPlaces: null })).toBe(
      3.14159,
    );
  });
});

describe('isNumericValueInBand', () => {
  const band = { left: 10, right: 20 };

  it('gibt true zurück für Wert innerhalb des Bandes', () => {
    expect(isNumericValueInBand(15, band)).toBe(true);
  });

  it('gibt true zurück für Wert exakt an den Grenzen (inklusiv)', () => {
    expect(isNumericValueInBand(10, band)).toBe(true);
    expect(isNumericValueInBand(20, band)).toBe(true);
  });

  it('gibt false zurück für Wert außerhalb', () => {
    expect(isNumericValueInBand(9.99, band)).toBe(false);
    expect(isNumericValueInBand(20.01, band)).toBe(false);
  });

  it('gibt false zurück für Wert weit außerhalb', () => {
    expect(isNumericValueInBand(-100, band)).toBe(false);
    expect(isNumericValueInBand(999, band)).toBe(false);
  });

  it('funktioniert mit negativem Band', () => {
    const negativeBand = { left: -20, right: -10 };
    expect(isNumericValueInBand(-15, negativeBand)).toBe(true);
    expect(isNumericValueInBand(-5, negativeBand)).toBe(false);
    expect(isNumericValueInBand(-25, negativeBand)).toBe(false);
  });

  it('funktioniert mit Band der Größe 0 (exakter Wert)', () => {
    const exactBand = { left: 100, right: 100 };
    expect(isNumericValueInBand(100, exactBand)).toBe(true);
    expect(isNumericValueInBand(100.001, exactBand)).toBe(false);
    expect(isNumericValueInBand(99.999, exactBand)).toBe(false);
  });
});

describe('AddQuestionInputSchema – NUMERIC_ESTIMATE', () => {
  describe('akzeptiert gültige Konfigurationen', () => {
    it('akzeptiert ABSOLUTE_INTERVAL mit L < R', () => {
      expect(parse(baseAbsolute).success).toBe(true);
    });

    it('akzeptiert RELATIVE_PERCENT mit V ≠ 0 und p gesetzt', () => {
      expect(parse(baseRelative).success).toBe(true);
    });

    it('akzeptiert RELATIVE_PERCENT mit negativem Referenzwert', () => {
      expect(parse({ ...baseRelative, numericReferenceValue: -50 }).success).toBe(true);
    });

    it('akzeptiert optionale Min/Max wenn Min < Max', () => {
      expect(parse({ ...baseAbsolute, numericMin: 0, numericMax: 10000000 }).success).toBe(true);
    });

    it('akzeptiert numericTwoRounds und numericInputType ohne Querkonflikt', () => {
      expect(
        parse({
          ...baseAbsolute,
          numericTwoRounds: true,
          numericInputType: 'INTEGER',
          numericDecimalPlaces: 0,
        }).success,
      ).toBe(true);
    });
  });

  describe('lehnt ungültige Toleranzkonfiguration ab', () => {
    it('lehnt fehlenden Toleranzmodus ab', () => {
      const { numericToleranceMode, ...rest } = baseAbsolute;
      void numericToleranceMode;
      const result = parse(rest);
      expect(result.success).toBe(false);
      expect(messages(result)).toContain(
        'Toleranzmodus ist erforderlich (ABSOLUTE_INTERVAL oder RELATIVE_PERCENT).',
      );
    });

    it('lehnt ABSOLUTE_INTERVAL ohne L ab', () => {
      const { numericIntervalLeft, ...rest } = baseAbsolute;
      void numericIntervalLeft;
      const result = parse(rest);
      expect(result.success).toBe(false);
      expect(messages(result)).toContain('Linke Grenze L ist erforderlich.');
    });

    it('lehnt ABSOLUTE_INTERVAL ohne R ab', () => {
      const { numericIntervalRight, ...rest } = baseAbsolute;
      void numericIntervalRight;
      const result = parse(rest);
      expect(result.success).toBe(false);
      expect(messages(result)).toContain('Rechte Grenze R ist erforderlich.');
    });

    it('lehnt L >= R ab', () => {
      const result = parse({ ...baseAbsolute, numericIntervalLeft: 100, numericIntervalRight: 50 });
      expect(result.success).toBe(false);
      expect(messages(result)).toContain('Rechte Grenze R muss größer als linke Grenze L sein.');
    });

    it('lehnt L === R ab', () => {
      const result = parse({
        ...baseAbsolute,
        numericIntervalLeft: 100,
        numericIntervalRight: 100,
      });
      expect(result.success).toBe(false);
      expect(messages(result)).toContain('Rechte Grenze R muss größer als linke Grenze L sein.');
    });

    it('lehnt RELATIVE_PERCENT ohne Referenzwert ab', () => {
      const { numericReferenceValue, ...rest } = baseRelative;
      void numericReferenceValue;
      const result = parse(rest);
      expect(result.success).toBe(false);
      expect(messages(result)).toContain('Referenzwert V ist erforderlich.');
    });

    it('lehnt RELATIVE_PERCENT mit V = 0 ab', () => {
      const result = parse({ ...baseRelative, numericReferenceValue: 0 });
      expect(result.success).toBe(false);
      expect(messages(result)).toContain(
        'Referenzwert V darf nicht 0 sein (relative Toleranz nicht definiert).',
      );
    });

    it('lehnt RELATIVE_PERCENT ohne Toleranz-Prozent ab', () => {
      const { numericTolerancePercent, ...rest } = baseRelative;
      void numericTolerancePercent;
      const result = parse(rest);
      expect(result.success).toBe(false);
      expect(messages(result)).toContain('Toleranz in Prozent ist erforderlich.');
    });

    it('lehnt Min >= Max ab', () => {
      const result = parse({ ...baseAbsolute, numericMin: 100, numericMax: 50 });
      expect(result.success).toBe(false);
      expect(messages(result)).toContain('Max-Eingabe muss größer als Min-Eingabe sein.');
    });
  });

  describe('Cross-Typ-Isolation', () => {
    it('lehnt NUMERIC_ESTIMATE-Felder bei SINGLE_CHOICE ab', () => {
      const result = parse({
        text: 'Frage?',
        type: 'SINGLE_CHOICE',
        order: 0,
        answers: [
          { text: 'A', isCorrect: true },
          { text: 'B', isCorrect: false },
        ],
        numericToleranceMode: 'ABSOLUTE_INTERVAL',
      });
      expect(result.success).toBe(false);
      expect(messages(result)).toContain(
        'Schätzfragen-Konfiguration ist nur für NUMERIC_ESTIMATE erlaubt.',
      );
    });

    it('lehnt SHORT_TEXT-numeric-Modus (lowercase) bei NUMERIC_ESTIMATE ab', () => {
      const result = parse({ ...baseAbsolute, numericToleranceMode: 'absolute' });
      expect(result.success).toBe(false);
      expect(messages(result)).toContain(
        'Toleranzmodus ist erforderlich (ABSOLUTE_INTERVAL oder RELATIVE_PERCENT).',
      );
    });

    it('akzeptiert lowercase Toleranzmodus weiterhin bei SHORT_TEXT', () => {
      const result = parse({
        text: 'Wie schwer ist ein Apfel?',
        type: 'SHORT_TEXT',
        order: 0,
        answers: [{ text: '150 g', isCorrect: true }],
        shortTextEvaluationKind: 'numeric_unit',
        numericInputKind: 'decimal',
        numericToleranceMode: 'absolute',
        numericAbsoluteTolerance: 10,
        numericUnitFamily: 'mass',
        numericRequireUnit: true,
      });
      expect(result.success).toBe(true);
    });
  });
});
