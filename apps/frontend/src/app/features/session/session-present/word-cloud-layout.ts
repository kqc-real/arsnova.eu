export const MIN_WORD_CLOUD_LAYOUT_WIDTH = 280;
export const MOBILE_WORD_CLOUD_BREAKPOINT = 600;
export const MOBILE_WORD_CLOUD_LIMIT = 50;
export const DESKTOP_WORD_CLOUD_LIMIT = 100;
export const DESKTOP_WORD_CLOUD_PRESENTATION_LIMIT = 150;
export const WORD_CLOUD_VERTICAL_MIN_LENGTH = 2;
export const WORD_CLOUD_VERTICAL_MAX_LENGTH = 8;
const WORD_CLOUD_SIZE_EXPONENT = 1.75;
const WORD_CLOUD_VERTICAL_HASH_MODULO = 5;

const DESKTOP_WORD_CLOUD_GROWTH_WIDTH = 1400;
const WORD_CLOUD_STAGE_FIT_INSET = 0.05;
const WORD_CLOUD_STAGE_FIT_MIN_INSET_X = 16;
const WORD_CLOUD_STAGE_FIT_MIN_INSET_Y = 20;
const WORD_CLOUD_STAGE_FIT_MAX_SCALE = 3;
const WORD_CLOUD_STAGE_FIT_MAX_FONT = 200;
const WORD_CLOUD_LAYOUT_MAX_FONT = 280;
const WORD_CLOUD_FILL_TARGET_RATIO = 0.5;
const WORD_CLOUD_FILL_MAX_SCALE = 2.6;
const WORD_CLOUD_FILL_CHAR_WIDTH = 0.62;
const WORD_CLOUD_CHIP_PAD_X = 0.56;
const WORD_CLOUD_CHIP_PAD_Y = 0.32;

export function shouldUseWordCloudLayout(stageWidth: number, wordCount: number): boolean {
  return stageWidth >= MIN_WORD_CLOUD_LAYOUT_WIDTH && wordCount > 0;
}

export function getWordCloudLayoutWordCap(stageWidth: number, presentationMode = false): number {
  return stageWidth < MOBILE_WORD_CLOUD_BREAKPOINT
    ? MOBILE_WORD_CLOUD_LIMIT
    : presentationMode
      ? DESKTOP_WORD_CLOUD_PRESENTATION_LIMIT
      : DESKTOP_WORD_CLOUD_LIMIT;
}

export function getWordCloudWidthScale(
  stageWidth: number,
  upperBound = MOBILE_WORD_CLOUD_BREAKPOINT,
): number {
  return getWordCloudRangeScale(stageWidth, MIN_WORD_CLOUD_LAYOUT_WIDTH, upperBound);
}

export function getWordCloudRangeScale(
  stageWidth: number,
  lowerBound: number,
  upperBound: number,
): number {
  if (upperBound <= MIN_WORD_CLOUD_LAYOUT_WIDTH) {
    return 1;
  }

  return clamp(0, (stageWidth - lowerBound) / (upperBound - lowerBound), 1);
}

export function estimateWordCloudFontFillScale(
  words: readonly { readonly word: string; readonly size: number }[],
  stageWidth: number,
  stageHeight: number,
): number {
  if (words.length === 0 || stageWidth <= 0 || stageHeight <= 0) {
    return 1;
  }

  const insetX = Math.max(
    stageWidth * WORD_CLOUD_STAGE_FIT_INSET,
    WORD_CLOUD_STAGE_FIT_MIN_INSET_X,
  );
  const insetY = Math.max(
    stageHeight * WORD_CLOUD_STAGE_FIT_INSET,
    WORD_CLOUD_STAGE_FIT_MIN_INSET_Y,
  );
  const usableArea = Math.max(1, (stageWidth - 2 * insetX) * (stageHeight - 2 * insetY));

  let packedArea = 0;
  let topSize = 0;
  for (const word of words) {
    const pad = getWordCloudChipPadding(word.size, stageWidth);
    const charCount = Math.max(1, [...word.word.trim()].length);
    const textWidth = Math.max(word.size, word.size * WORD_CLOUD_FILL_CHAR_WIDTH * charCount);
    packedArea += (textWidth + pad * 2) * (word.size + pad * 2);
    topSize = Math.max(topSize, word.size);
  }

  if (packedArea <= 0) {
    return 1;
  }

  const areaScale = Math.sqrt((usableArea * WORD_CLOUD_FILL_TARGET_RATIO) / packedArea);
  const fontCap = topSize > 0 ? WORD_CLOUD_LAYOUT_MAX_FONT / topSize : WORD_CLOUD_FILL_MAX_SCALE;
  return clamp(1, areaScale, Math.min(WORD_CLOUD_FILL_MAX_SCALE, fontCap));
}

export function fitWordCloudPositionsToStage<
  T extends {
    readonly x: number;
    readonly y: number;
    readonly size: number;
    readonly x0: number;
    readonly x1: number;
    readonly y0: number;
    readonly y1: number;
  },
>(words: readonly T[], stageWidth: number, stageHeight: number): T[] {
  if (words.length === 0 || stageWidth <= 0 || stageHeight <= 0) {
    return [...words];
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let topSize = 0;

  for (const word of words) {
    const padX = Math.max(8, word.size * WORD_CLOUD_CHIP_PAD_X);
    const padY = Math.max(10, word.size * WORD_CLOUD_CHIP_PAD_Y);
    minX = Math.min(minX, word.x0 - padX, word.x - padX);
    maxX = Math.max(maxX, word.x1 + padX, word.x + padX);
    minY = Math.min(minY, word.y0 - padY, word.y - padY);
    maxY = Math.max(maxY, word.y1 + padY, word.y + padY);
    topSize = Math.max(topSize, word.size);
  }

  const packedWidth = maxX - minX;
  const packedHeight = maxY - minY;
  if (packedWidth <= 0 || packedHeight <= 0) {
    return [...words];
  }

  const insetX = Math.max(
    stageWidth * WORD_CLOUD_STAGE_FIT_INSET,
    WORD_CLOUD_STAGE_FIT_MIN_INSET_X,
  );
  const insetY = Math.max(
    stageHeight * WORD_CLOUD_STAGE_FIT_INSET,
    WORD_CLOUD_STAGE_FIT_MIN_INSET_Y,
  );
  const usableWidth = Math.max(1, stageWidth - 2 * insetX);
  const usableHeight = Math.max(1, stageHeight - 2 * insetY);
  const fontCap =
    topSize > 0 ? WORD_CLOUD_STAGE_FIT_MAX_FONT / topSize : WORD_CLOUD_STAGE_FIT_MAX_SCALE;
  const scale = Math.min(
    WORD_CLOUD_STAGE_FIT_MAX_SCALE,
    fontCap,
    usableWidth / packedWidth,
    usableHeight / packedHeight,
  );

  if (!Number.isFinite(scale) || Math.abs(scale - 1) < 0.02) {
    return [...words];
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return words.map((word) => ({
    ...word,
    x: (word.x - centerX) * scale,
    y: (word.y - centerY) * scale,
    size: Math.max(1, Math.round(word.size * scale)),
    x0: (word.x0 - centerX) * scale,
    x1: (word.x1 - centerX) * scale,
    y0: (word.y0 - centerY) * scale,
    y1: (word.y1 - centerY) * scale,
  }));
}

export function getWordCloudLayoutHeight(
  stageWidth: number,
  wordCount: number,
  presentationMode = false,
): number {
  const count = Math.max(1, wordCount);
  if (presentationMode) {
    if (stageWidth < MOBILE_WORD_CLOUD_BREAKPOINT) {
      const widthScale = getWordCloudWidthScale(stageWidth);
      return clamp(
        Math.round(lerp(368, 520, widthScale)),
        Math.round(lerp(248, 380, widthScale) + count * lerp(5.5, 8, widthScale)),
        Math.round(lerp(600, 860, widthScale)),
      );
    }

    const desktopWidthScale = getWordCloudRangeScale(
      stageWidth,
      MOBILE_WORD_CLOUD_BREAKPOINT,
      DESKTOP_WORD_CLOUD_GROWTH_WIDTH,
    );
    return clamp(
      Math.round(lerp(520, 720, desktopWidthScale)),
      Math.round(lerp(380, 470, desktopWidthScale) + count * lerp(8, 6, desktopWidthScale)),
      Math.round(lerp(860, 1120, desktopWidthScale)),
    );
  }

  if (stageWidth < MOBILE_WORD_CLOUD_BREAKPOINT) {
    const widthScale = getWordCloudWidthScale(stageWidth);
    return clamp(
      Math.round(lerp(300, 440, widthScale)),
      Math.round(lerp(220, 320, widthScale) + count * lerp(5, 8, widthScale)),
      Math.round(lerp(520, 760, widthScale)),
    );
  }

  return clamp(340, 260 + count * 3, 560);
}

export function getWordCloudChipPadding(
  fontSize: number,
  stageWidth = MOBILE_WORD_CLOUD_BREAKPOINT,
): number {
  const widthScale = getWordCloudWidthScale(stageWidth);
  return Math.max(
    Math.round(lerp(5, 8, widthScale)),
    Math.round(fontSize * lerp(0.28, 0.4, widthScale)),
  );
}

/** Steilere Hierarchie: das Top-Wort bleibt groß, das Mittelfeld fällt schneller ab. */
export function scaleWordCloudFontSize(ratio: number, min: number, max: number): number {
  const clamped = clamp(0, ratio, 1);
  return min + Math.round(clamped ** WORD_CLOUD_SIZE_EXPONENT * (max - min));
}

/**
 * Etwa jedes fünfte kurze Einzelwort steht senkrecht — nicht das Top-Wort, keine Phrasen,
 * nicht auf schmalen Host-Kacheln.
 */
export function getWordCloudRotation(word: string, rank: number, stageWidth: number): 0 | 90 {
  if (rank === 0 || stageWidth < MOBILE_WORD_CLOUD_BREAKPOINT) {
    return 0;
  }

  const label = word.trim();
  if (!label || /\s/u.test(label)) {
    return 0;
  }

  const length = [...label].length;
  if (length < WORD_CLOUD_VERTICAL_MIN_LENGTH || length > WORD_CLOUD_VERTICAL_MAX_LENGTH) {
    return 0;
  }

  return stableWordHash(label) % WORD_CLOUD_VERTICAL_HASH_MODULO === 0 ? 90 : 0;
}

function stableWordHash(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (Math.imul(hash, 31) + (char.codePointAt(0) ?? 0)) | 0;
  }
  return Math.abs(hash);
}

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, scale: number): number {
  return start + (end - start) * scale;
}
