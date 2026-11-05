import type { WordCloudWeightMetric } from '@arsnova/shared-types';

/** Explain the displayed snapshot's metric, rather than a pending UI selection. */
export function qaWordCloudReadingHint(metric: WordCloudWeightMetric): string {
  switch (metric) {
    case 'BEST':
      return $localize`:@@sessionQa.wordCloudHintBest:Größer erscheinen Begriffe aus Fragen mit viel Zustimmung und ausreichend Bewertungen. Das sagt nichts über ihre fachliche Richtigkeit aus.`;
    case 'CONTROVERSIAL':
      return $localize`:@@sessionQa.wordCloudHintControversial:Größer erscheinen Begriffe aus Fragen mit vielen, ähnlich verteilten Dafür- und Dagegen-Stimmen.`;
    case 'TIME':
      return $localize`:@@sessionQa.wordCloudHintTime:Je mehr freigegebene Fragen einen Begriff enthalten, desto größer erscheint er. Pro Frage zählt er einmal.`;
    default:
      return $localize`:@@sessionQa.wordCloudHintTop:Größer erscheinen Begriffe aus Fragen mit mehr Dafür- als Dagegen-Stimmen. Maßgeblich ist die Differenz.`;
  }
}
