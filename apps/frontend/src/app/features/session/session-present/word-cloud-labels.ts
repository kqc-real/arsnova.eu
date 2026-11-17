import type { WordCloudWeightMetric } from '@arsnova/shared-types';

/** Explain the displayed snapshot's metric, rather than a pending UI selection. */
export function qaWordCloudReadingHint(metric: WordCloudWeightMetric): string {
  switch (metric) {
    case 'BEST':
      return $localize`:@@sessionQa.wordCloudHintBest:Bei gleicher Stimmenzahl zählt ein höherer Dafür-Anteil tendenziell stärker. Bei gleichem Anteil können mehr Stimmen das Gewicht erhöhen. Durch Rundung und Obergrenze können Fragen gleiches Gewicht erhalten.`;
    case 'CONTROVERSIAL':
      return $localize`:@@sessionQa.wordCloudHintControversial:Bei gleicher Stimmenzahl zählt eine ausgewogenere Verteilung tendenziell stärker. Bei gleicher Verteilung können mehr Stimmen das Gewicht erhöhen. Durch Rundung und Obergrenze können Fragen gleiches Gewicht erhalten.`;
    case 'TIME':
      return $localize`:@@sessionQa.wordCloudHintTime:Je mehr freigegebene Fragen einen Begriff enthalten, desto größer erscheint er. Pro Frage zählt er einmal.`;
    default:
      return $localize`:@@sessionQa.wordCloudHintTop:Größer erscheinen Begriffe aus Fragen mit mehr Dafür- als Dagegen-Stimmen. Maßgeblich ist die Differenz.`;
  }
}
