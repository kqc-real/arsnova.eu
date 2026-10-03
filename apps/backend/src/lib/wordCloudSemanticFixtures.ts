import type { WordCloudAnalysisSourceItem } from '@arsnova/shared-types';
import type { WordCloudEmbedding } from './wordCloudSemanticCluster';

/** Drei Klausur-Paraphrasen zu Kapitel 4; Folien und Beamer-Hänger bleiben getrennt. */
export const WORD_CLOUD_SEMANTIC_DE_SEED = [
  {
    id: 'de-klausur-1',
    text: 'Kommt Kapitel 4 in die Klausur?',
  },
  {
    id: 'de-klausur-2',
    text: 'Ist Kapitel 4 klausurrelevant?',
  },
  {
    id: 'de-klausur-3',
    text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
  },
  {
    id: 'de-folien',
    text: 'Die Folien von letzter Woche fehlen im Moodle.',
  },
  {
    id: 'de-beamer',
    text: 'Der Beamer-Haenger in Hoersaal 2 ist wieder defekt.',
  },
] as const satisfies readonly { id: string; text: string }[];

export const WORD_CLOUD_SEMANTIC_EN_SEED = [
  {
    id: 'en-exam-1',
    text: 'Will chapter 4 be on the exam?',
  },
  {
    id: 'en-exam-2',
    text: 'Is chapter 4 relevant for the exam?',
  },
  {
    id: 'en-exam-3',
    text: 'Do we need chapter 4 for the test?',
  },
  {
    id: 'en-slides',
    text: 'Last week slides are missing from Moodle.',
  },
  {
    id: 'en-projector',
    text: 'The projector in lecture hall 2 is broken again.',
  },
] as const satisfies readonly { id: string; text: string }[];

/**
 * Freitext-Fixtures fuer Story 1.14d. Jede Sprache deckt drei bewusst
 * unterschiedliche Antwortformen ab; die Gegenbeispiele duerfen mit keiner
 * Familie verschmelzen.
 */
export const WORD_CLOUD_SEMANTIC_FREETEXT_DE_SEED = [
  {
    id: 'de-freetext-mood-1',
    text: 'Ich fuehle mich heute entspannt und zuversichtlich.',
  },
  {
    id: 'de-freetext-mood-2',
    text: 'Gerade bin ich ruhig und optimistisch.',
  },
  {
    id: 'de-freetext-mood-3',
    text: 'Im Moment fuehle ich mich gelassen und guter Dinge.',
  },
  {
    id: 'de-freetext-synonym-1',
    text: 'verwirrt',
  },
  {
    id: 'de-freetext-synonym-2',
    text: 'ratlos',
  },
  {
    id: 'de-freetext-synonym-3',
    text: 'orientierungslos',
  },
  {
    id: 'de-freetext-technical-1',
    text: 'Der TCP-Dreiwege-Handshake synchronisiert Sequenznummern, bevor die Verbindung Nutzdaten uebertraegt.',
  },
  {
    id: 'de-freetext-technical-2',
    text: 'Vor dem Austausch von Nutzdaten stimmt der TCP-Handshake in drei Schritten die Sequenznummern beider Seiten ab.',
  },
  {
    id: 'de-freetext-technical-3',
    text: 'TCP etabliert mit SYN, SYN-ACK und ACK zuerst die Sequenznummern, bevor Anwendungsdaten fliessen.',
  },
  {
    id: 'de-freetext-counter-projector',
    text: 'Der Beamer im Hoersaal ist ausgefallen.',
  },
  {
    id: 'de-freetext-counter-break',
    text: 'Die Kaffeepause sollte laenger sein.',
  },
  {
    id: 'de-freetext-counter-exam',
    text: 'Kapitel 4 ist fuer die Klausur relevant.',
  },
] as const satisfies readonly { id: string; text: string }[];

export const WORD_CLOUD_SEMANTIC_FREETEXT_EN_SEED = [
  {
    id: 'en-freetext-mood-1',
    text: 'I feel relaxed and confident today.',
  },
  {
    id: 'en-freetext-mood-2',
    text: 'Right now I am calm and optimistic.',
  },
  {
    id: 'en-freetext-mood-3',
    text: 'At the moment I feel composed and positive.',
  },
  {
    id: 'en-freetext-synonym-1',
    text: 'confused',
  },
  {
    id: 'en-freetext-synonym-2',
    text: 'puzzled',
  },
  {
    id: 'en-freetext-synonym-3',
    text: 'perplexed',
  },
  {
    id: 'en-freetext-technical-1',
    text: 'The TCP three-way handshake synchronizes sequence numbers before the connection transfers payload data.',
  },
  {
    id: 'en-freetext-technical-2',
    text: 'Before payload data is exchanged, the TCP handshake aligns both peers sequence numbers in three steps.',
  },
  {
    id: 'en-freetext-technical-3',
    text: 'TCP establishes sequence numbers with SYN, SYN-ACK, and ACK before application data starts flowing.',
  },
  {
    id: 'en-freetext-counter-projector',
    text: 'The projector in the lecture hall has failed.',
  },
  {
    id: 'en-freetext-counter-break',
    text: 'The coffee break should be longer.',
  },
  {
    id: 'en-freetext-counter-exam',
    text: 'Chapter 4 is relevant for the exam.',
  },
] as const satisfies readonly { id: string; text: string }[];

export const WORD_CLOUD_SEMANTIC_FREETEXT_FAMILY_IDS = {
  de: {
    mood: ['de-freetext-mood-1', 'de-freetext-mood-2', 'de-freetext-mood-3'],
    synonyms: ['de-freetext-synonym-1', 'de-freetext-synonym-2', 'de-freetext-synonym-3'],
    technical: ['de-freetext-technical-1', 'de-freetext-technical-2', 'de-freetext-technical-3'],
    counterexamples: [
      'de-freetext-counter-projector',
      'de-freetext-counter-break',
      'de-freetext-counter-exam',
    ],
  },
  en: {
    mood: ['en-freetext-mood-1', 'en-freetext-mood-2', 'en-freetext-mood-3'],
    synonyms: ['en-freetext-synonym-1', 'en-freetext-synonym-2', 'en-freetext-synonym-3'],
    technical: ['en-freetext-technical-1', 'en-freetext-technical-2', 'en-freetext-technical-3'],
    counterexamples: [
      'en-freetext-counter-projector',
      'en-freetext-counter-break',
      'en-freetext-counter-exam',
    ],
  },
} as const;

function unit(values: readonly number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return [...values];
  }
  return values.map((value) => value / norm);
}

/**
 * Geometrische e5-Näherung für CI ohne Modell-Download:
 * Paraphrasen liegen eng, Folien und Beamer stehen orthogonal.
 */
export function geometricEmbeddingForSeedText(text: string): number[] {
  const normalized = text.toLowerCase();
  if (
    normalized.includes('kapitel 4') ||
    normalized.includes('klausur') ||
    normalized.includes('pruefung') ||
    normalized.includes('chapter 4') ||
    normalized.includes('exam') ||
    normalized.includes('test')
  ) {
    const jitter = normalized.includes('relevant')
      ? 0.08
      : normalized.includes('need') || normalized.includes('brauchen')
        ? 0.12
        : 0;
    return unit([1, jitter, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  }
  if (
    normalized.includes('folie') ||
    normalized.includes('slide') ||
    normalized.includes('moodle')
  ) {
    return unit([0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  }
  if (
    normalized.includes('beamer') ||
    normalized.includes('haenger') ||
    normalized.includes('projector')
  ) {
    return unit([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
  }
  if (
    normalized.includes('entspannt') ||
    normalized.includes('zuversichtlich') ||
    normalized.includes('ruhig') ||
    normalized.includes('optimistisch') ||
    normalized.includes('gelassen') ||
    normalized.includes('guter dinge') ||
    normalized.includes('relaxed') ||
    normalized.includes('confident') ||
    normalized.includes('calm') ||
    normalized.includes('optimistic') ||
    normalized.includes('composed') ||
    normalized.includes('positive')
  ) {
    const jitter = normalized.includes('optim') ? 0.08 : normalized.includes('gelassen') ? 0.12 : 0;
    return unit([0, 0, 0, 0, 1, jitter, 0, 0, 0, 0, 0, 0]);
  }
  if (
    ['verwirrt', 'ratlos', 'orientierungslos', 'confused', 'puzzled', 'perplexed'].includes(
      normalized.trim(),
    )
  ) {
    const jitter = normalized.includes('los') || normalized === 'perplexed' ? 0.1 : 0;
    return unit([0, 0, 0, 0, 0, jitter, 1, 0, 0, 0, 0, 0]);
  }
  if (
    normalized.includes('tcp') ||
    normalized.includes('dreiwege-handshake') ||
    normalized.includes('three-way handshake')
  ) {
    const jitter = normalized.includes('syn-ack')
      ? 0.08
      : normalized.includes('payload')
        ? 0.12
        : 0;
    return unit([0, 0, 0, 0, 0, 0, 0, 1, jitter, 0, 0, 0]);
  }
  if (normalized.includes('kaffeepause') || normalized.includes('coffee break')) {
    return unit([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]);
  }
  return unit([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
}

export function embeddingsForSemanticSeed(
  seed: readonly { id: string; text: string }[],
): WordCloudEmbedding[] {
  return seed.map((item) => ({
    id: item.id,
    text: item.text,
    vector: geometricEmbeddingForSeedText(item.text),
  }));
}

export function sourceItemsForSemanticSeed(
  seed: readonly { id: string; text: string }[],
  weight = 3,
): WordCloudAnalysisSourceItem[] {
  return seed.map((item) => ({
    id: item.id,
    text: item.text,
    weight,
  }));
}
