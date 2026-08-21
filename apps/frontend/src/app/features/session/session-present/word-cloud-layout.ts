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
