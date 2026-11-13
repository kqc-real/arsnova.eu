import type { QuestionType } from '@arsnova/shared-types';

export function questionReadingHint(type: QuestionType): string {
  switch (type) {
    case 'SINGLE_CHOICE':
      return $localize`:@@questionReadingHint.singleChoice:Gleich wählst du eine Antwort aus.`;
    case 'MULTIPLE_CHOICE':
      return $localize`:@@questionReadingHint.multipleChoice:Gleich wählst du alle zutreffenden Antworten aus.`;
    case 'SURVEY':
      return $localize`:@@questionReadingHint.survey:Gleich kannst du deine Auswahl treffen.`;
    case 'RATING':
      return $localize`:@@questionReadingHint.rating:Gleich wählst du einen Wert auf der Skala.`;
    case 'NUMERIC_ESTIMATE':
      return $localize`:@@questionReadingHint.numericEstimate:Gleich gibst du deinen Schätzwert ein.`;
    case 'SHORT_TEXT':
      return $localize`:@@questionReadingHint.shortText:Gleich gibst du eine kurze Antwort ein.`;
    case 'FREETEXT':
      return $localize`:@@questionReadingHint.freeText:Gleich kannst du deine Antwort frei formulieren.`;
    case 'MATCHING':
      return $localize`:@@questionReadingHint.matching:Gleich ordnest du zusammengehörige Elemente einander zu.`;
    case 'ORDERING':
      return $localize`:@@questionReadingHint.ordering:Gleich bringst du die Elemente in die richtige Reihenfolge.`;
    case 'CATEGORIZATION':
      return $localize`:@@questionReadingHint.categorization:Gleich ordnest du jedes Element einer Kategorie zu.`;
  }
}
