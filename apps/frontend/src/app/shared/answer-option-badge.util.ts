import type { QuestionType } from '@arsnova/shared-types';

export type AnswerOptionShapeKind =
  'triangle' | 'circle' | 'square' | 'diamond' | 'star' | 'hexagon' | 'plus' | 'heart';

export const ANSWER_OPTION_COLORS = [
  '#1565c0',
  '#e65100',
  '#2e7d32',
  '#6a1b9a',
  '#c62828',
  '#00838f',
  '#4e342e',
  '#37474f',
];

export const ANSWER_OPTION_SHAPES = [
  'triangle',
  'circle',
  'square',
  'diamond',
  'star',
  'hexagon',
  'plus',
  'heart',
] as const satisfies readonly AnswerOptionShapeKind[];

const ANSWER_OPTION_SHAPE_SYMBOLS: Record<AnswerOptionShapeKind, string> = {
  triangle: '\u25B3',
  circle: '\u25CB',
  square: '\u25A1',
  diamond: '\u25C7',
  star: '\u2606',
  hexagon: '\u2B21',
  plus: '\u271A',
  heart: '\u2661',
};

export const ANSWER_OPTION_SHAPE_SYMBOL_SEQUENCE = [
  '\u25B3',
  '\u25CB',
  '\u25A1',
  '\u25C7',
  '\u2606',
  '\u2B21',
  '\u271A',
  '\u2661',
];

export function answerOptionColor(index: number): string {
  return ANSWER_OPTION_COLORS[index % ANSWER_OPTION_COLORS.length];
}

export function showQuestionTypeIndicator(value: boolean | null | undefined): boolean {
  return value !== false;
}

export function answerOptionShapeKind(
  index: number,
  questionType?: QuestionType | null,
  showTypeIndicator: boolean | null | undefined = true,
): AnswerOptionShapeKind {
  if (showQuestionTypeIndicator(showTypeIndicator)) {
    if (questionType === 'SINGLE_CHOICE') return 'circle';
    if (questionType === 'MULTIPLE_CHOICE') return 'square';
  }

  return ANSWER_OPTION_SHAPES[index % ANSWER_OPTION_SHAPES.length];
}

export function answerOptionShape(
  index: number,
  questionType?: QuestionType | null,
  showTypeIndicator: boolean | null | undefined = true,
): string {
  return ANSWER_OPTION_SHAPE_SYMBOLS[answerOptionShapeKind(index, questionType, showTypeIndicator)];
}
