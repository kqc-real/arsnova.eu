import type { QuickFeedbackType, TempoTrendStatus } from '@arsnova/shared-types';

export interface FeedbackOption {
  value: string;
  label: string;
  icon?: string;
  iconKind?: 'text' | 'mat';
  tone?: 'positive' | 'negative' | 'neutral' | 'rating';
}

export interface FeedbackPresetChip {
  type: QuickFeedbackType;
  label: string;
  icons: readonly FeedbackPresetChipIcon[];
  showLabel?: boolean;
}

export interface FeedbackSpotlightTemplate extends FeedbackPresetChip {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
}

export interface FeedbackPresetChipIcon {
  value: string;
  kind?: 'text' | 'mat';
  tone?: 'positive' | 'negative' | 'neutral' | 'rating';
}

export interface FeedbackDisplayIcon {
  value: string;
  kind: 'text' | 'mat';
  tone?: 'positive' | 'negative' | 'neutral' | 'rating';
}

export const MOOD_OPTIONS: readonly FeedbackOption[] = [
  { value: 'POSITIVE', label: $localize`Gut`, icon: '😊' },
  { value: 'NEUTRAL', label: $localize`Okay`, icon: '😐' },
  { value: 'NEGATIVE', label: $localize`Schlecht`, icon: '😟' },
];

export const YESNO_OPTIONS: readonly FeedbackOption[] = [
  { value: 'YES', label: $localize`Ja`, icon: '👍' },
  { value: 'NO', label: $localize`Nein`, icon: '👎' },
  { value: 'MAYBE', label: $localize`Vielleicht`, icon: '🤷' },
];

export const YESNO_BINARY_OPTIONS: readonly FeedbackOption[] = [
  { value: 'YES', label: $localize`Ja`, icon: '👍' },
  { value: 'NO', label: $localize`Nein`, icon: '👎' },
];

export const TRUEFALSE_UNKNOWN_OPTIONS: readonly FeedbackOption[] = [
  {
    value: 'TRUE',
    label: $localize`:@@feedback.optionTrue:Wahr`,
    icon: 'check_circle',
    iconKind: 'mat',
    tone: 'positive',
  },
  {
    value: 'FALSE',
    label: $localize`:@@feedback.optionFalse:Falsch`,
    icon: 'cancel',
    iconKind: 'mat',
    tone: 'negative',
  },
  {
    value: 'UNKNOWN',
    label: $localize`:@@feedback.optionUnknown:Weiß nicht`,
    icon: 'help',
    iconKind: 'mat',
    tone: 'neutral',
  },
];

export const STARS_OPTIONS: readonly FeedbackOption[] = [
  { value: '1', label: $localize`:@@feedback.starRatingOne:1 von 5 Sternen` },
  { value: '2', label: $localize`:@@feedback.starRatingTwo:2 von 5 Sternen` },
  { value: '3', label: $localize`:@@feedback.starRatingThree:3 von 5 Sternen` },
  { value: '4', label: $localize`:@@feedback.starRatingFour:4 von 5 Sternen` },
  { value: '5', label: $localize`:@@feedback.starRatingFive:5 von 5 Sternen` },
];

export const ABCD_OPTIONS: readonly FeedbackOption[] = [
  { value: 'A', label: $localize`Antwort A` },
  { value: 'B', label: $localize`Antwort B` },
  { value: 'C', label: $localize`Antwort C` },
  { value: 'D', label: $localize`Antwort D` },
];

export const TEMPO_OPTIONS: readonly FeedbackOption[] = [
  { value: 'SPEED_UP', label: $localize`:@@feedback.tempoSpeedUp:Schneller`, icon: '🚀' },
  { value: 'FOLLOWING', label: $localize`:@@feedback.tempoFollowing:Ich folge`, icon: '🙂' },
  { value: 'SLOW_DOWN', label: $localize`:@@feedback.tempoSlowDown:Langsamer`, icon: '🐢' },
  { value: 'LOST', label: $localize`:@@feedback.tempoLost:Verloren`, icon: '😕' },
];

export const FEEDBACK_OPTIONS: Record<QuickFeedbackType, readonly FeedbackOption[]> = {
  MOOD: MOOD_OPTIONS,
  YESNO: YESNO_OPTIONS,
  YESNO_BINARY: YESNO_BINARY_OPTIONS,
  TRUEFALSE_UNKNOWN: TRUEFALSE_UNKNOWN_OPTIONS,
  STARS: STARS_OPTIONS,
  ABCD: ABCD_OPTIONS,
  TEMPO: TEMPO_OPTIONS,
};

export const QUICK_FEEDBACK_TEMPO_SPOTLIGHT: FeedbackSpotlightTemplate = {
  type: 'TEMPO',
  eyebrow: $localize`:@@feedback.tempoSpotlightEyebrow:Tempo-Blitzlicht`,
  title: $localize`:@@feedback.tempoSpotlightTitle:Vortrags\u00adtempo im Blick behalten`,
  description: $localize`:@@feedback.tempoSpotlightDescription:Mit vier Icons zeigt deine Gruppe, ob sie folgen kann.`,
  actionLabel: $localize`:@@feedback.tempoSpotlightAction:Tempo-Feedback`,
  label: $localize`:@@feedback.titleTempo:Tempo`,
  icons: [{ value: '🚀' }, { value: '🙂' }, { value: '🐢' }, { value: '😕' }],
};

export const QUICK_FEEDBACK_PRESET_CHIPS: readonly FeedbackPresetChip[] = [
  {
    type: 'MOOD',
    label: $localize`Stimmungsbild`,
    icons: [{ value: '😊' }, { value: '😐' }, { value: '😟' }],
  },
  {
    type: 'YESNO',
    label: $localize`:@@feedback.titleYesNoMaybe:Ja · Nein · Vielleicht`,
    icons: [{ value: '👍' }, { value: '👎' }, { value: '🤷' }],
  },
  {
    type: 'YESNO_BINARY',
    label: $localize`:@@feedback.titleYesNoBinary:Ja · Nein`,
    icons: [{ value: '👍' }, { value: '👎' }],
  },
  {
    type: 'TRUEFALSE_UNKNOWN',
    label: $localize`:@@feedback.titleTrueFalseUnknownCompact:Wahr · Falsch · ?`,
    icons: [
      { value: 'check_circle', kind: 'mat', tone: 'positive' },
      { value: 'cancel', kind: 'mat', tone: 'negative' },
      { value: 'help', kind: 'mat', tone: 'neutral' },
    ],
  },
  {
    type: 'STARS',
    label: $localize`:@@feedback.titleStars:Sterne`,
    icons: [
      { value: 'star', kind: 'mat', tone: 'rating' },
      { value: 'star', kind: 'mat', tone: 'rating' },
      { value: 'star', kind: 'mat', tone: 'rating' },
      { value: 'star', kind: 'mat', tone: 'rating' },
      { value: 'star', kind: 'mat', tone: 'rating' },
    ],
  },
  {
    type: 'ABCD',
    label: $localize`ABCD`,
    icons: [{ value: 'A' }, { value: 'B' }, { value: 'C' }, { value: 'D' }],
    showLabel: false,
  },
];

export function feedbackOptions(type: QuickFeedbackType): readonly FeedbackOption[] {
  return FEEDBACK_OPTIONS[type];
}

export function feedbackResultOrder(type: QuickFeedbackType): readonly string[] {
  if (type === 'STARS') {
    return ['5', '4', '3', '2', '1'];
  }
  return feedbackOptions(type).map((option) => option.value);
}

export function renderStarRating(value: string): string {
  const stars = Number.parseInt(value, 10);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return value;
  }
  return `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`;
}

export function feedbackDisplayLabel(key: string, type: QuickFeedbackType | string): string {
  if (type === 'STARS') {
    const stars = Number.parseInt(key, 10);
    if (stars === 1) {
      return $localize`:@@feedback.starRatingDisplayOne:1 Stern`;
    }
    if (stars >= 2 && stars <= 5) {
      return $localize`:@@feedback.starRatingDisplayMany:${stars}:stars: Sterne`;
    }
  }

  const options = FEEDBACK_OPTIONS[type as QuickFeedbackType] ?? [];
  const option = options.find((entry) => entry.value === key);
  if (option?.icon) {
    return option.icon;
  }
  return key;
}

export function feedbackDisplayIcon(
  key: string,
  type: QuickFeedbackType | string,
): FeedbackDisplayIcon | null {
  if (type === 'STARS') {
    return { value: renderStarRating(key), kind: 'text', tone: 'rating' };
  }

  if (type === 'TRUEFALSE_UNKNOWN') {
    if (key === 'TRUE') {
      return { value: 'check_circle', kind: 'mat', tone: 'positive' };
    }
    if (key === 'FALSE') {
      return { value: 'cancel', kind: 'mat', tone: 'negative' };
    }
    if (key === 'UNKNOWN') {
      return { value: 'help', kind: 'mat', tone: 'neutral' };
    }
  }

  const options = FEEDBACK_OPTIONS[type as QuickFeedbackType] ?? [];
  const option = options.find((entry) => entry.value === key);
  if (option?.icon) {
    return { value: option.icon, kind: 'text' };
  }

  return null;
}

export function feedbackTitle(type: QuickFeedbackType | string): string {
  switch (type) {
    case 'MOOD':
      return $localize`Stimmungsbild`;
    case 'YESNO':
      return $localize`:@@feedback.titleYesNoMaybe:Ja · Nein · Vielleicht`;
    case 'YESNO_BINARY':
      return $localize`:@@feedback.titleYesNoBinary:Ja · Nein`;
    case 'TRUEFALSE_UNKNOWN':
      return $localize`:@@feedback.titleTrueFalseUnknown:Wahr · Falsch · Weiß nicht`;
    case 'STARS':
      return $localize`:@@feedback.titleStars:Sterne`;
    case 'ABCD':
      return $localize`ABCD-Voting`;
    case 'TEMPO':
      return $localize`:@@feedback.titleTempo:Tempo`;
    default:
      return $localize`Feedback`;
  }
}

export function isTempoFeedbackType(type: QuickFeedbackType | string | null | undefined): boolean {
  return type === 'TEMPO';
}

export function tempoTrendLabel(status: TempoTrendStatus | string | null | undefined): string {
  switch (status) {
    case 'FOLLOWING':
      return $localize`:@@feedback.tempoTrendFollowing:Die Mehrheit kann folgen.`;
    case 'TOO_FAST':
      return $localize`:@@feedback.tempoTrendTooFast:Es wirkt zu schnell.`;
    case 'LOST':
      return $localize`:@@feedback.tempoTrendLost:Mehrere Teilnehmende sind abgehängt.`;
    case 'TOO_SLOW':
      return $localize`:@@feedback.tempoTrendTooSlow:Die Gruppe kann schneller mitgehen.`;
    case 'HETEROGENEOUS':
      return $localize`:@@feedback.tempoTrendHeterogeneous:Die Rückmeldungen sind gemischt.`;
    default:
      return $localize`:@@feedback.tempoTrendNeutral:Noch zu wenige Rückmeldungen.`;
  }
}

export function tempoTrendIcon(status: TempoTrendStatus | string | null | undefined): string {
  switch (status) {
    case 'FOLLOWING':
      return 'check_circle';
    case 'TOO_FAST':
      return 'speed';
    case 'LOST':
      return 'warning';
    case 'TOO_SLOW':
      return 'keyboard_double_arrow_up';
    case 'HETEROGENEOUS':
      return 'diversity_3';
    default:
      return 'radio_button_unchecked';
  }
}

export function tempoTrendTone(
  status: TempoTrendStatus | string | null | undefined,
): 'neutral' | 'good' | 'caution' | 'alert' | 'mixed' {
  switch (status) {
    case 'FOLLOWING':
      return 'good';
    case 'TOO_FAST':
    case 'TOO_SLOW':
      return 'caution';
    case 'LOST':
      return 'alert';
    case 'HETEROGENEOUS':
      return 'mixed';
    default:
      return 'neutral';
  }
}
