import { describe, expect, it } from 'vitest';
import {
  clusterWordCloudEmbeddings,
  hasReliableSemanticCluster,
  rankSemanticClusters,
  semanticClustersToEntries,
} from './wordCloudSemanticCluster';
import {
  embeddingsForSemanticSeed,
  sourceItemsForSemanticSeed,
  WORD_CLOUD_SEMANTIC_DE_SEED,
  WORD_CLOUD_SEMANTIC_EN_SEED,
} from './wordCloudSemanticFixtures';

function memberSet(
  clusters: ReturnType<typeof clusterWordCloudEmbeddings>,
  ids: readonly string[],
) {
  return clusters.find((cluster) => ids.every((id) => cluster.memberIds.includes(id)));
}

describe('wordCloudSemanticCluster', () => {
  it('buendelt die drei DE-Klausur-Paraphrasen und trennt Folien von Beamer', () => {
    const clusters = clusterWordCloudEmbeddings(
      embeddingsForSemanticSeed(WORD_CLOUD_SEMANTIC_DE_SEED),
    );
    const klausur = memberSet(clusters, ['de-klausur-1', 'de-klausur-2', 'de-klausur-3']);
    expect(klausur?.memberIds).toHaveLength(3);
    expect(klausur?.confidence).toBeGreaterThanOrEqual(0.8);

    const folien = clusters.find((cluster) => cluster.memberIds.includes('de-folien'));
    const beamer = clusters.find((cluster) => cluster.memberIds.includes('de-beamer'));
    expect(folien).toBeDefined();
    expect(beamer).toBeDefined();
    expect(folien?.memberIds).not.toContain('de-beamer');
    expect(beamer?.memberIds).not.toContain('de-folien');
    expect(hasReliableSemanticCluster(clusters)).toBe(true);
  });

  it('buendelt die drei EN-Exam-Paraphrasen und trennt Slides vom Projektor', () => {
    const clusters = clusterWordCloudEmbeddings(
      embeddingsForSemanticSeed(WORD_CLOUD_SEMANTIC_EN_SEED),
    );
    const exam = memberSet(clusters, ['en-exam-1', 'en-exam-2', 'en-exam-3']);
    expect(exam?.memberIds).toHaveLength(3);
    const slides = clusters.find((cluster) => cluster.memberIds.includes('en-slides'));
    const projector = clusters.find((cluster) => cluster.memberIds.includes('en-projector'));
    expect(slides?.memberIds).not.toEqual(projector?.memberIds);
    expect(slides?.memberIds).not.toContain('en-projector');
  });

  it('liefert extraktive Labels und gewichtete Eintraege ohne erfundene Mitglieder', () => {
    const items = sourceItemsForSemanticSeed(WORD_CLOUD_SEMANTIC_DE_SEED);
    const clusters = rankSemanticClusters(
      clusterWordCloudEmbeddings(embeddingsForSemanticSeed(WORD_CLOUD_SEMANTIC_DE_SEED)),
      items,
    );
    const entries = semanticClustersToEntries(clusters, items);
    const klausur = entries.find((entry) =>
      entry.members.some((member) => member.sourceId === 'de-klausur-1'),
    );
    expect(klausur?.members).toHaveLength(3);
    expect(klausur?.label.toLowerCase()).toMatch(/kapitel 4|klausur|pruefung/);
    expect(klausur?.members.map((member) => member.sourceId).sort()).toEqual(
      ['de-klausur-1', 'de-klausur-2', 'de-klausur-3'].sort(),
    );
  });

  it('trennt zwei dichte Familien, die Average-Linkage ueber gemeinsame Wrapper verketten wuerde', () => {
    const embeddings = [
      { id: 'a1', text: 'A', vector: [1, 0, 0, 0] },
      { id: 'a-wrap', text: 'Wrap A', vector: [0.95, 0.3122499, 0, 0] },
      { id: 'b1', text: 'B', vector: [0.78, 0.18895122, 0.5965714, 0] },
      { id: 'b-wrap', text: 'Wrap B', vector: [0.8, 0.32025631, 0.44502163, 0.24370401] },
    ];
    const clusters = clusterWordCloudEmbeddings(embeddings);
    const clusterOf = (id: string) =>
      clusters
        .find((cluster) => cluster.memberIds.includes(id))
        ?.memberIds.slice()
        .sort();

    expect(clusterOf('a1')).toEqual(['a-wrap', 'a1'].sort());
    expect(clusterOf('b1')).toEqual(['b-wrap', 'b1'].sort());
  });
});
