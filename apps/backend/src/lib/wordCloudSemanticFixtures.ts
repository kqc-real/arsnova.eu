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
    return unit([1, jitter, 0, 0, 0, 0, 0, 0]);
  }
  if (
    normalized.includes('folie') ||
    normalized.includes('slide') ||
    normalized.includes('moodle')
  ) {
    return unit([0, 0, 1, 0, 0, 0, 0, 0]);
  }
  if (
    normalized.includes('beamer') ||
    normalized.includes('haenger') ||
    normalized.includes('projector')
  ) {
    return unit([0, 0, 0, 1, 0, 0, 0, 0]);
  }
  return unit([0, 0, 0, 0, 1, 0, 0, 0]);
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
