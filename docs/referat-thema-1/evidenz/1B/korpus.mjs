import {
  MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1 as ranking,
  MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1 as texte,
} from '@arsnova/shared-types';

export function laborKorpus(consumer) {
  if (consumer === 'label') {
    // Identische Texte verschiedener synthetischer Fragen ergeben dasselbe
    // Embedding. Nur Last-/Fehlerpfad testen, keine semantische Modellqualität.
    const pairedText = 'Ist Kapitel 4 für die Klausur relevant?';
    return {
      id: 'label-identical-pair-v1',
      texte: texte.map((q) => (['B', 'C'].includes(q.key) ? { ...q, text: pairedText } : q)),
      ranking,
    };
  }
  return { id: 'summary-reference-v1', texte, ranking };
}
