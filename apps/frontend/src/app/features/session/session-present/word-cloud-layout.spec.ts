import { describe, expect, it } from 'vitest';
import {
  DESKTOP_WORD_CLOUD_PRESENTATION_LIMIT,
  DESKTOP_WORD_CLOUD_LIMIT,
  MIN_WORD_CLOUD_LAYOUT_WIDTH,
  MOBILE_WORD_CLOUD_LIMIT,
  capWordCloudFontToStage,
  containWordCloudPillsInStage,
  estimateWordCloudFontFillScale,
  estimateWordCloudPillExtent,
  fitWordCloudPositionsToStage,
  getWordCloudChipPadding,
  getWordCloudRangeScale,
  getWordCloudLayoutHeight,
  getWordCloudLayoutWordCap,
  getWordCloudRotation,
  getWordCloudWidthScale,
  scaleWordCloudFontSize,
  shouldUseWordCloudLayout,
} from './word-cloud-layout';

describe('word-cloud layout helpers', () => {
  it('aktiviert das echte Cloud-Layout erst ab sinnvoller Mindestbreite', () => {
    expect(shouldUseWordCloudLayout(MIN_WORD_CLOUD_LAYOUT_WIDTH - 1, 10)).toBe(false);
    expect(shouldUseWordCloudLayout(MIN_WORD_CLOUD_LAYOUT_WIDTH, 10)).toBe(true);
    expect(shouldUseWordCloudLayout(900, 0)).toBe(false);
  });

  it('begrenzt die Wortmenge fuer mobile und breite Ansichten unterschiedlich', () => {
    expect(getWordCloudLayoutWordCap(390)).toBe(MOBILE_WORD_CLOUD_LIMIT);
    expect(getWordCloudLayoutWordCap(900)).toBe(DESKTOP_WORD_CLOUD_LIMIT);
    expect(getWordCloudLayoutWordCap(900, true)).toBe(DESKTOP_WORD_CLOUD_PRESENTATION_LIMIT);
  });

  it('waehlt grosszuegige, aber gedeckelte Layout-Hoehen fuer mobile und Desktop', () => {
    expect(getWordCloudLayoutHeight(320, 10, true)).toBeLessThan(
      getWordCloudLayoutHeight(520, 10, true),
    );
    expect(getWordCloudLayoutHeight(640, 10, true)).toBeLessThan(
      getWordCloudLayoutHeight(960, 10, true),
    );
    expect(getWordCloudLayoutHeight(960, 10, true)).toBeLessThan(
      getWordCloudLayoutHeight(1280, 10, true),
    );
    expect(getWordCloudLayoutHeight(390, 10)).toBeLessThan(getWordCloudLayoutHeight(520, 10));
    expect(getWordCloudLayoutHeight(390, 50)).toBeLessThan(getWordCloudLayoutHeight(590, 50));
    expect(getWordCloudLayoutHeight(1280, 10)).toBe(340);
    expect(getWordCloudLayoutHeight(1280, 100)).toBe(560);
    expect(getWordCloudLayoutHeight(1280, 100, true)).toBeGreaterThan(
      getWordCloudLayoutHeight(1280, 10, true),
    );
  });

  it('rechnet fuer Chips ein paddingsicheres Mindestmass aus', () => {
    expect(getWordCloudChipPadding(14)).toBe(8);
    expect(getWordCloudChipPadding(40)).toBe(16);
    expect(getWordCloudChipPadding(20, 320)).toBeLessThan(getWordCloudChipPadding(20, 520));
  });

  it('macht das Top-Wort deutlich groesser als das Mittelfeld', () => {
    expect(scaleWordCloudFontSize(1, 14, 48)).toBe(48);
    expect(scaleWordCloudFontSize(0, 14, 48)).toBe(14);
    expect(scaleWordCloudFontSize(0.5, 14, 48)).toBeLessThan(14 + Math.round(0.5 * (48 - 14)));
  });

  it('stellt nur kurze Einzelwoerter gelegentlich senkrecht', () => {
    expect(getWordCloudRotation('Klausur', 0, 960)).toBe(0);
    expect(getWordCloudRotation('Kapitel 4', 2, 960)).toBe(0);
    expect(getWordCloudRotation('Zusammenarbeit', 2, 960)).toBe(0);
    expect(getWordCloudRotation('Quiz', 2, 390)).toBe(0);

    const shortWords = Array.from({ length: 40 }, (_, index) => `kurz${index}`);
    const vertical = shortWords.filter((word) => getWordCloudRotation(word, 2, 960) === 90).length;
    expect(vertical).toBeGreaterThanOrEqual(4);
    expect(vertical).toBeLessThanOrEqual(12);
    expect(getWordCloudRotation(shortWords[0] ?? 'kurz0', 2, 960)).toBe(
      getWordCloudRotation(shortWords[0] ?? 'kurz0', 8, 960),
    );
  });

  it('skaliert ein kleines Packing gleichmaessig und ohne Streckung', () => {
    const source = [
      { x: -40, y: -10, size: 24, x0: -70, x1: -10, y0: -22, y1: 2 },
      { x: 30, y: 8, size: 14, x0: 10, x1: 50, y0: -2, y1: 18 },
    ];
    const fitted = fitWordCloudPositionsToStage(source, 1200, 600);

    const sourceSpanX =
      Math.max(...source.map((word) => word.x1)) - Math.min(...source.map((word) => word.x0));
    const sourceSpanY =
      Math.max(...source.map((word) => word.y1)) - Math.min(...source.map((word) => word.y0));
    const fittedSpanX =
      Math.max(...fitted.map((word) => word.x1)) - Math.min(...fitted.map((word) => word.x0));
    const fittedSpanY =
      Math.max(...fitted.map((word) => word.y1)) - Math.min(...fitted.map((word) => word.y0));

    expect(fitted[0]?.size ?? 0).toBeGreaterThan(24);
    expect(fittedSpanX / sourceSpanX).toBeCloseTo(fittedSpanY / sourceSpanY, 2);
    expect(fittedSpanX).toBeGreaterThan(sourceSpanX);
    expect(fittedSpanX).toBeLessThan(1200 * 0.95);
    expect(fittedSpanY).toBeLessThan(600 * 0.95);
  });

  it('deckt lange Labels so, dass ihr Chip auf die Buehne passt', () => {
    const label = 'Standardabweichung';
    const size = capWordCloudFontToStage(label, 168, 900, 1280);
    const pad = getWordCloudChipPadding(size, 900);
    const width = Math.max(size, size * 0.62 * [...label].length) + pad * 2;

    expect(size).toBeLessThan(168);
    expect(width).toBeLessThanOrEqual(900 - 32);
  });

  it('vergroessert die D3-Schrift wenn wenige Begriffe eine grosse Buehne nicht fuellen', () => {
    const scale = estimateWordCloudFontFillScale(
      [
        { word: 'Quiz', size: 28 },
        { word: 'Klausur', size: 20 },
        { word: 'Thema', size: 16 },
      ],
      1200,
      700,
    );

    expect(scale).toBeGreaterThan(1.5);
    expect(scale).toBeLessThanOrEqual(2.6);
  });

  it('laesst ein bereits dichtes Packing auf der Ausgangsschrift', () => {
    const words = Array.from({ length: 40 }, (_, index) => ({
      word: `Begriff${index}`,
      size: 48,
    }));

    expect(estimateWordCloudFontFillScale(words, 800, 400)).toBe(1);
  });

  it('laesst fuer Chip-Innenabstand Abstand zum Buehnenrand', () => {
    const fitted = fitWordCloudPositionsToStage(
      [{ x: 0, y: 0, size: 40, x0: -200, x1: 200, y0: -80, y1: 80 }],
      500,
      220,
    );

    expect(Math.min(...fitted.map((word) => word.y0))).toBeGreaterThan(-110);
    expect(Math.max(...fitted.map((word) => word.y1))).toBeLessThan(110);
    expect(fitted[0]?.size ?? 40).toBeLessThan(40);
  });

  it('haelt grosse Kapseln vollstaendig in der Buehne', () => {
    const contained = containWordCloudPillsInStage(
      [
        {
          word: 'Verwaltung',
          x: 420,
          y: 40,
          size: 96,
          rotate: 0,
          x0: 200,
          x1: 640,
          y0: -20,
          y1: 100,
        },
      ],
      1200,
      700,
    );
    const word = contained[0];
    expect(word).toBeTruthy();
    const extent = estimateWordCloudPillExtent(
      word?.word ?? '',
      word?.size ?? 0,
      word?.rotate ?? 0,
    );
    expect(Math.abs(word?.x ?? 0) + extent.halfWidth).toBeLessThanOrEqual(1200 / 2 - 40);
    expect(Math.abs(word?.y ?? 0) + extent.halfHeight).toBeLessThanOrEqual(700 / 2 - 36);
  });

  it('skaliert die mobile Wortwolke unterhalb des Breakpoints stufenlos weiter', () => {
    expect(getWordCloudWidthScale(MIN_WORD_CLOUD_LAYOUT_WIDTH)).toBe(0);
    expect(getWordCloudWidthScale(440)).toBeCloseTo(0.5, 3);
    expect(getWordCloudWidthScale(600)).toBe(1);
    expect(getWordCloudRangeScale(1000, 600, 1400)).toBeCloseTo(0.5, 3);
  });
});
