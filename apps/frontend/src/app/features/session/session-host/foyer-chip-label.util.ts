export type FoyerChipLabelKind = 'anonymous' | 'text' | 'emoji-only' | 'emoji-with-text';

export type FoyerChipLabel = {
  kind: FoyerChipLabelKind;
  fullLabel: string;
  ariaLabel: string;
  emoji: string | null;
  text: string;
};

export type BuildFoyerChipLabelOptions = {
  nickname: string;
  anonymousMode?: boolean;
  kindergartenEmoji?: string | null;
  dense?: boolean;
  preferEmojiOnly?: boolean;
  preferFullText?: boolean;
  preferReadableText?: boolean;
};

const RELAXED_TOKEN_MAX_GRAPHEMES = 7;
const DENSE_SINGLE_WORD_MAX_GRAPHEMES = 2;
const DENSE_EMOJI_TEXT_MAX_GRAPHEMES = 4;
const FOYER_ANONYMOUS_ARIA = $localize`:@@sessionHost.foyerChipAnonymousAria:Teilnehmende Person`;

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function getGraphemeSegments(value: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('de', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), (entry) => entry.segment);
  }

  return Array.from(value);
}

export function truncateLabelGraphemes(value: string, maxGraphemes: number): string {
  const normalized = normalizeLabel(value);
  if (!normalized || maxGraphemes <= 0) {
    return '';
  }

  const graphemes = getGraphemeSegments(normalized);
  if (graphemes.length <= maxGraphemes) {
    return normalized;
  }

  return `${graphemes.slice(0, maxGraphemes).join('')}…`;
}

function firstMeaningfulWord(value: string): string {
  const normalized = normalizeLabel(value);
  if (!normalized) {
    return '';
  }

  return normalized.split(' ')[0] ?? normalized;
}

function compactInitials(value: string): string {
  const normalized = normalizeLabel(value);
  if (!normalized) {
    return '';
  }

  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return parts
      .slice(0, 2)
      .map((part) => getGraphemeSegments(part)[0] ?? '')
      .join('')
      .toUpperCase();
  }

  return truncateLabelGraphemes(parts[0] ?? normalized, DENSE_SINGLE_WORD_MAX_GRAPHEMES);
}

export function buildFoyerChipLabel(options: BuildFoyerChipLabelOptions): FoyerChipLabel {
  const fullLabel = normalizeLabel(options.nickname);

  if (options.anonymousMode) {
    return {
      kind: 'anonymous',
      fullLabel,
      ariaLabel: FOYER_ANONYMOUS_ARIA,
      emoji: null,
      text: '?',
    };
  }

  const ariaLabel = fullLabel || FOYER_ANONYMOUS_ARIA;
  if (options.kindergartenEmoji) {
    if (options.preferFullText) {
      return {
        kind: 'emoji-with-text',
        fullLabel,
        ariaLabel,
        emoji: options.kindergartenEmoji,
        text: fullLabel,
      };
    }

    if (options.dense || options.preferEmojiOnly) {
      return {
        kind: 'emoji-only',
        fullLabel,
        ariaLabel,
        emoji: options.kindergartenEmoji,
        text: '',
      };
    }

    return {
      kind: 'emoji-with-text',
      fullLabel,
      ariaLabel,
      emoji: options.kindergartenEmoji,
      text: truncateLabelGraphemes(firstMeaningfulWord(fullLabel), DENSE_EMOJI_TEXT_MAX_GRAPHEMES),
    };
  }

  if (options.dense) {
    if (options.preferReadableText) {
      return {
        kind: 'text',
        fullLabel,
        ariaLabel,
        emoji: null,
        text: firstMeaningfulWord(fullLabel),
      };
    }

    return {
      kind: 'text',
      fullLabel,
      ariaLabel,
      emoji: null,
      text: compactInitials(fullLabel),
    };
  }

  return {
    kind: 'text',
    fullLabel,
    ariaLabel,
    emoji: null,
    text: truncateLabelGraphemes(firstMeaningfulWord(fullLabel), RELAXED_TOKEN_MAX_GRAPHEMES),
  };
}
