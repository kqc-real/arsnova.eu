import type { WordCloudWeightMetric } from '@arsnova/shared-types';

/** Explain the displayed snapshot's metric, rather than a pending UI selection. */
export function qaWordCloudReadingHint(metric: WordCloudWeightMetric): string {
  switch (metric) {
    case 'BEST':
      return $localize`:@@sessionQa.wordCloudHintBest:Begriffe aus Fragen mit hohem Dafür-Anteil erhalten mehr Gewicht. Bei gleichem Dafür-Anteil zählen Fragen mit mehr abgegebenen Stimmen stärker.`;
    case 'CONTROVERSIAL':
      return $localize`:@@sessionQa.wordCloudHintControversial:Begriffe aus Fragen mit ähnlich vielen Dafür- und Dagegen-Stimmen erhalten mehr Gewicht. Bei gleicher Verteilung zählen Fragen mit mehr abgegebenen Stimmen stärker.`;
    case 'TIME':
      return $localize`:@@sessionQa.wordCloudHintTime:Je mehr freigegebene Fragen einen Begriff enthalten, desto größer erscheint er. Pro Frage zählt er einmal.`;
    default:
      return $localize`:@@sessionQa.wordCloudHintTop:Größer erscheinen Begriffe aus Fragen mit mehr Dafür- als Dagegen-Stimmen. Maßgeblich ist die Differenz.`;
  }
}
