import type { QuickFeedbackType } from '@arsnova/shared-types';

export interface FeedbackOption {
  value: string;
  label: string;
  icon?: string;
  iconKind?: 'text' | 'mat';
  tone?: 'positive' | 'negative' | 'neutral';
}

export interface FeedbackPresetChip {
  type: QuickFeedbackType;
  label: string;
  icons: readonly FeedbackPresetChipIcon[];
  showLabel?: boolean;
}

export interface FeedbackPresetChipIcon {
  value: string;
  kind?: 'text' | 'mat';
  tone?: 'positive' | 'negative' | 'neutral';
}

export interface FeedbackDisplayIcon {
  value: string;
  kind: 'text' | 'mat';
  tone?: 'positive' | 'negative' | 'neutral';
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

export const ABC_OPTIONS: readonly FeedbackOption[] = [
  { value: 'A', label: $localize`Antwort A` },
  { value: 'B', label: $localize`Antwort B` },
  { value: 'C', label: $localize`Antwort C` },
];

export const ABCD_OPTIONS: readonly FeedbackOption[] = [
  { value: 'A', label: $localize`Antwort A` },
  { value: 'B', label: $localize`Antwort B` },
  { value: 'C', label: $localize`Antwort C` },
  { value: 'D', label: $localize`Antwort D` },
];

export const FEEDBACK_OPTIONS: Record<QuickFeedbackType, readonly FeedbackOption[]> = {
  MOOD: MOOD_OPTIONS,
  YESNO: YESNO_OPTIONS,
  YESNO_BINARY: YESNO_BINARY_OPTIONS,
  TRUEFALSE_UNKNOWN: TRUEFALSE_UNKNOWN_OPTIONS,
  ABC: ABC_OPTIONS,
  ABCD: ABCD_OPTIONS,
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
    type: 'ABC',
    label: $localize`:@@feedback.titleAbcShort:ABC`,
    icons: [{ value: 'A' }, { value: 'B' }, { value: 'C' }],
    showLabel: false,
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

export function feedbackDisplayLabel(key: string, type: QuickFeedbackType | string): string {
  const options = FEEDBACK_OPTIONS[type as QuickFeedbackType] ?? [];
  const option = options.find((entry) => entry.value === key);
  if (option?.icon) {
    return option.icon;
  }
  return key;
}

export function feedbackDisplayIcon(key: string, type: QuickFeedbackType | string): FeedbackDisplayIcon | null {
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
    case 'MOOD': return $localize`Stimmungsbild`;
    case 'YESNO': return $localize`:@@feedback.titleYesNoMaybe:Ja · Nein · Vielleicht`;
    case 'YESNO_BINARY': return $localize`:@@feedback.titleYesNoBinary:Ja · Nein`;
    case 'TRUEFALSE_UNKNOWN': return $localize`:@@feedback.titleTrueFalseUnknown:Wahr · Falsch · Weiß nicht`;
    case 'ABC': return $localize`:@@feedback.titleAbcVoting:ABC-Voting`;
    case 'ABCD': return $localize`ABCD-Voting`;
    default: return $localize`Feedback`;
  }
}
