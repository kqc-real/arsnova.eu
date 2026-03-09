export interface FeedbackOption {
  value: string;
  label: string;
  icon?: string;
}

export const MOOD_OPTIONS: FeedbackOption[] = [
  { value: 'POSITIVE', label: 'Gut', icon: '😊' },
  { value: 'NEUTRAL', label: 'Okay', icon: '😐' },
  { value: 'NEGATIVE', label: 'Schlecht', icon: '😟' },
];

export const YESNO_OPTIONS: FeedbackOption[] = [
  { value: 'YES', label: 'Ja', icon: '👍' },
  { value: 'NO', label: 'Nein', icon: '👎' },
  { value: 'MAYBE', label: 'Vielleicht', icon: '🤷' },
];

export const ABCD_OPTIONS: FeedbackOption[] = [
  { value: 'A', label: 'Antwort A' },
  { value: 'B', label: 'Antwort B' },
  { value: 'C', label: 'Antwort C' },
  { value: 'D', label: 'Antwort D' },
];

export function feedbackDisplayLabel(key: string, type: string): string {
  if (type === 'MOOD') {
    const opt = MOOD_OPTIONS.find((o) => o.value === key);
    if (opt?.icon) return opt.icon;
  }
  if (type === 'YESNO') {
    const opt = YESNO_OPTIONS.find((o) => o.value === key);
    if (opt?.icon) return opt.icon;
  }
  return key;
}

export function feedbackTitle(type: string): string {
  switch (type) {
    case 'MOOD': return 'Stimmungsbild';
    case 'YESNO': return 'Ja / Nein / Vielleicht';
    case 'ABCD': return 'ABCD-Voting';
    default: return 'Feedback';
  }
}
