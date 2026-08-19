import type { QaNlpCategory } from '@arsnova/shared-types';
import {
  normalizeQaNlpText,
  QA_NLP_GATEKEEPER_CATEGORIES,
  type QaNlpScoredPrediction,
} from './qaNlpNaiveBayes';

const KEYWORDS: Record<QaNlpCategory, readonly string[]> = {
  content: [
    'klausur',
    'pruefung',
    'prufungs',
    'exam',
    'median',
    'mittelwert',
    'varianz',
    'formel',
    'definition',
    'beweis',
    'proof',
    'folie',
    'slide',
    'aufgabe',
    'exercise',
    'loesung',
    'solution',
    'beispiel',
    'example',
    'erkl',
    'explain',
    'begriff',
    'konfidenz',
    'hypothese',
    'recall',
    'precision',
    'overfitting',
    'bayes',
    'herleitung',
    'relevant',
    'lernen',
  ],
  organization: [
    'abgabe',
    'frist',
    'deadline',
    'raum',
    'hoersaal',
    'aula',
    'room',
    'anwesen',
    'attendance',
    'gruppe',
    'tutorial',
    'tutorium',
    'anmeld',
    'register',
    'vorlesung',
    'lecture',
    'faellt',
    'cancel',
    'punkteliste',
    'score',
    'veroeffent',
    'publish',
    'zoom',
    'link',
    'naechste woche',
    'next week',
    'hausarbeit',
    'assignment',
    'projekt',
  ],
  technical: [
    'wlan',
    'wifi',
    'wi-fi',
    'mikro',
    'microphone',
    'audio',
    'ton',
    'pdf',
    'folie',
    'slides',
    'login',
    'moodle',
    'browser',
    'stream',
    'qr',
    'join',
    'download',
    '404',
    'safari',
    'crash',
    'laden nicht',
    'laedt nicht',
    'tot',
    'silent',
    'blank',
  ],
};

export function predictQaNlpKeywordBaseline(text: string): QaNlpScoredPrediction {
  const normalized = normalizeQaNlpText(text);
  const rawScores = QA_NLP_GATEKEEPER_CATEGORIES.map((category) => {
    const hits = KEYWORDS[category].reduce(
      (count, keyword) => count + (normalized.includes(keyword) ? 1 : 0),
      0,
    );
    return hits;
  });
  const total = rawScores.reduce((sum, value) => sum + value, 0);
  const probabilities =
    total === 0
      ? QA_NLP_GATEKEEPER_CATEGORIES.map(() => 1 / QA_NLP_GATEKEEPER_CATEGORIES.length)
      : rawScores.map((value) => value / total);
  let bestIndex = 0;
  for (let index = 1; index < probabilities.length; index += 1) {
    if ((probabilities[index] ?? 0) > (probabilities[bestIndex] ?? 0)) {
      bestIndex = index;
    }
  }
  const scores = Object.fromEntries(
    QA_NLP_GATEKEEPER_CATEGORIES.map((label, index) => [label, probabilities[index] ?? 0]),
  ) as Record<QaNlpCategory, number>;
  return {
    category: QA_NLP_GATEKEEPER_CATEGORIES[bestIndex] ?? 'content',
    confidence: probabilities[bestIndex] ?? 0,
    scores,
  };
}
