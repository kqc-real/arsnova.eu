import { describe, expect, it } from 'vitest';
import {
  resolveNumericTolerance,
  parseNumericInput,
  isNumericValueInBand,
} from '@arsnova/shared-types';

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
