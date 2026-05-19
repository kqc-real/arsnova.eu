import type { QuestionType } from '@arsnova/shared-types';

/** Kurzbezeichnungen der Frageformate (gleiche @@-IDs wie Quiz-Vorschau, ADR-0008). */
export function questionTypeLabel(type: QuestionType): string {
  switch (type) {
    case 'SINGLE_CHOICE':
      return $localize`:@@quizPreview.typeSingleChoice:Single Choice`;
    case 'MULTIPLE_CHOICE':
      return $localize`:@@quizPreview.typeMultipleChoice:Multiple Choice`;
    case 'FREETEXT':
      return $localize`:@@quizPreview.typeFreeText:Freitext`;
    case 'SHORT_TEXT':
      return $localize`:@@quizPreview.typeShortText:Kurzantwort`;
    case 'SURVEY':
      return $localize`:@@quizPreview.typeSurvey:Umfrage`;
    case 'RATING':
      return $localize`:@@quizPreview.typeRating:Bewertung`;
    case 'NUMERIC_ESTIMATE':
      return $localize`:@@quizPreview.typeNumericEstimate:Numerische Schätzfrage`;
    default: {
      const _exhaustive: never = type;
      return String(_exhaustive);
    }
  }
}
