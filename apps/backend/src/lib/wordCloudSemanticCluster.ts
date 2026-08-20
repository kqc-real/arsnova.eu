import {
  WORD_CLOUD_SEMANTIC_COSINE_THRESHOLD,
  WORD_CLOUD_SEMANTIC_MAX_TOPICS,
  WORD_CLOUD_SEMANTIC_MIN_CLUSTER_SIZE,
  type AnalyzeWordCloudOutput,
  type WordCloudAnalysisSourceItem,
} from '@arsnova/shared-types';

export interface WordCloudEmbedding {
  readonly id: string;
  readonly text: string;
  readonly vector: readonly number[];
}

export interface WordCloudSemanticCluster {
  readonly memberIds: readonly string[];
  readonly label: string;
  readonly confidence: number;
  readonly variants: readonly string[];
}

function l2Norm(vector: readonly number[]): number {
  let sum = 0;
  for (const value of vector) {
    sum += value * value;
  }
  return Math.sqrt(sum);
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return 0;
  }
  let dot = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += (left[index] ?? 0) * (right[index] ?? 0);
  }
  const denominator = l2Norm(left) * l2Norm(right);
  if (denominator === 0) {
    return 0;
  }
  return dot / denominator;
}

function pairwiseCosineMatrix(vectors: readonly (readonly number[])[]): number[][] {
  const size = vectors.length;
  const matrix: number[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0),
  );
  for (let i = 0; i < size; i += 1) {
    const row = matrix[i]!;
    row[i] = 1;
    const left = vectors[i];
    if (!left) continue;
    for (let j = i + 1; j < size; j += 1) {
      const right = vectors[j];
      const score = right ? cosineSimilarity(left, right) : 0;
      row[j] = score;
      matrix[j]![i] = score;
    }
  }
  return matrix;
}

/** Complete-Linkage: schwächste Kosinusähnlichkeit zwischen den zwei Gruppen (Schwelle 0,87). */
function completeLinkage(
  left: readonly number[],
  right: readonly number[],
  matrix: readonly (readonly number[])[],
): number {
  let min = Number.POSITIVE_INFINITY;
  for (const leftIndex of left) {
    const row = matrix[leftIndex];
    if (!row) continue;
    for (const rightIndex of right) {
      const score = row[rightIndex];
      if (score === undefined) continue;
      if (score < min) {
        min = score;
      }
    }
  }
  return Number.isFinite(min) ? min : 0;
}

function meanPairwiseCosine(
  memberIndexes: readonly number[],
  matrix: readonly (readonly number[])[],
): number {
  if (memberIndexes.length < 2) {
    return 0.4;
  }
  let sum = 0;
  let count = 0;
  for (let i = 0; i < memberIndexes.length; i += 1) {
    const row = matrix[memberIndexes[i] ?? -1];
    if (!row) continue;
    for (let j = i + 1; j < memberIndexes.length; j += 1) {
      const score = row[memberIndexes[j] ?? -1];
      if (score === undefined) continue;
      sum += score;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

function centroid(
  memberIndexes: readonly number[],
  vectors: readonly (readonly number[])[],
): number[] {
  const first = vectors[memberIndexes[0] ?? -1];
  if (!first) {
    return [];
  }
  const acc = Array.from({ length: first.length }, () => 0);
  let count = 0;
  for (const index of memberIndexes) {
    const vector = vectors[index];
    if (!vector || vector.length !== acc.length) continue;
    for (let dim = 0; dim < acc.length; dim += 1) {
      acc[dim] = (acc[dim] ?? 0) + (vector[dim] ?? 0);
    }
    count += 1;
  }
  if (count === 0) {
    return acc;
  }
  return acc.map((value) => value / count);
}

function extractiveLabel(
  memberIndexes: readonly number[],
  embeddings: readonly WordCloudEmbedding[],
  vectors: readonly (readonly number[])[],
): { label: string; variants: string[] } {
  const members = memberIndexes
    .map((index) => embeddings[index])
    .filter((item): item is WordCloudEmbedding => Boolean(item));
  if (members.length === 0) {
    return { label: 'Thema', variants: [] };
  }
  const center = centroid(memberIndexes, vectors);
  const scored = memberIndexes.flatMap((index) => {
    const embedding = embeddings[index];
    const vector = vectors[index];
    if (!embedding || !vector) {
      return [];
    }
    return [{ embedding, score: cosineSimilarity(vector, center) }];
  });
  scored.sort(
    (left, right) =>
      right.score - left.score || left.embedding.text.length - right.embedding.text.length,
  );
  const chosen = scored[0]?.embedding ?? members[0]!;
  return {
    label: chosen.text,
    variants: [...new Set(members.map((member) => member.text))],
  };
}

/**
 * Agglomeratives Clustering (Complete-Linkage, Kosinus). Kein festes k.
 * Mindestgröße 2; Singletons bleiben unsichere Einzelthemen.
 */
export function clusterWordCloudEmbeddings(
  embeddings: readonly WordCloudEmbedding[],
  threshold = WORD_CLOUD_SEMANTIC_COSINE_THRESHOLD,
): WordCloudSemanticCluster[] {
  if (embeddings.length === 0) {
    return [];
  }
  const vectors = embeddings.map((item) => item.vector);
  const matrix = pairwiseCosineMatrix(vectors);
  const nodes: Array<{ members: number[] }> = embeddings.map((_, index) => ({ members: [index] }));

  while (nodes.length > 1) {
    let bestLeft = 0;
    let bestRight = 1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const score = completeLinkage(nodes[i]!.members, nodes[j]!.members, matrix);
        if (score > bestScore) {
          bestScore = score;
          bestLeft = i;
          bestRight = j;
        }
      }
    }
    if (bestScore < threshold) {
      break;
    }
    const merged = {
      members: [...nodes[bestLeft]!.members, ...nodes[bestRight]!.members],
    };
    nodes.splice(bestRight, 1);
    nodes.splice(bestLeft, 1);
    nodes.push(merged);
  }

  return nodes.map((node) => {
    const confidence = meanPairwiseCosine(node.members, matrix);
    const labelSource = extractiveLabel(node.members, embeddings, vectors);
    return {
      memberIds: node.members
        .map((index) => embeddings[index]?.id)
        .filter((id): id is string => Boolean(id)),
      label: labelSource.label,
      confidence: Math.min(1, Math.max(0, confidence)),
      variants: labelSource.variants,
    };
  });
}

function clusterWeight(
  memberIds: readonly string[],
  itemsById: ReadonlyMap<string, WordCloudAnalysisSourceItem>,
): number {
  return memberIds.reduce((sum, id) => sum + (itemsById.get(id)?.weight ?? 0), 0);
}

export function rankSemanticClusters(
  clusters: readonly WordCloudSemanticCluster[],
  items: readonly WordCloudAnalysisSourceItem[],
  maxTopics = WORD_CLOUD_SEMANTIC_MAX_TOPICS,
): WordCloudSemanticCluster[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return [...clusters]
    .sort((left, right) => {
      const weightDelta =
        clusterWeight(right.memberIds, itemsById) - clusterWeight(left.memberIds, itemsById);
      if (weightDelta !== 0) {
        return weightDelta;
      }
      const sizeDelta = right.memberIds.length - left.memberIds.length;
      if (sizeDelta !== 0) {
        return sizeDelta;
      }
      return right.confidence - left.confidence;
    })
    .slice(0, maxTopics);
}

export function semanticClustersToEntries(
  clusters: readonly WordCloudSemanticCluster[],
  items: readonly WordCloudAnalysisSourceItem[],
): AnalyzeWordCloudOutput['entries'] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return clusters.flatMap((cluster, index) => {
    const members = cluster.memberIds
      .map((id) => itemsById.get(id))
      .filter((item): item is WordCloudAnalysisSourceItem => Boolean(item))
      .map((item) => ({
        sourceId: item.id,
        text: item.text,
        weight: item.weight,
      }));
    if (members.length === 0) {
      return [];
    }
    const count = members.reduce((sum, member) => sum + member.weight, 0);
    return [
      {
        key: `semantic-${index}-${members[0]!.sourceId}`,
        label: cluster.label,
        count,
        basisLabel: cluster.label,
        members,
        variants: cluster.variants.length > 0 ? [...cluster.variants] : [cluster.label],
        confidence: cluster.confidence,
      },
    ];
  });
}

export function hasReliableSemanticCluster(clusters: readonly WordCloudSemanticCluster[]): boolean {
  return clusters.some(
    (cluster) =>
      cluster.memberIds.length >= WORD_CLOUD_SEMANTIC_MIN_CLUSTER_SIZE &&
      cluster.confidence >= 0.65,
  );
}
