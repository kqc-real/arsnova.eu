import { QaNlpResultSchema, type QaNlpResult } from '@arsnova/shared-types';
import { QA_NLP_GATEKEEPER_MODEL_VERSION, resolveQaNlpMinConfidence } from './qaNlpConfig';
import { predictQaNlpNaiveBayes, trainQaNlpNaiveBayes } from './qaNlpNaiveBayes';
import { qaNlpSeedBySplit } from './qaNlpSeed';
import type { QaNlpAnalysisSnapshot } from './qaNlpSnapshot';

let cachedModel: ReturnType<typeof trainQaNlpNaiveBayes> | null = null;

export function getQaNlpGatekeeperModel(): ReturnType<typeof trainQaNlpNaiveBayes> {
  cachedModel ??= trainQaNlpNaiveBayes(
    qaNlpSeedBySplit('train').map((example) => ({
      text: example.text,
      category: example.category,
    })),
    QA_NLP_GATEKEEPER_MODEL_VERSION,
  );
  return cachedModel;
}

export function resetQaNlpGatekeeperModelForTests(): void {
  cachedModel = null;
}

export function classifyQaNlpSnapshot(
  snapshot: QaNlpAnalysisSnapshot,
  minConfidence = resolveQaNlpMinConfidence(),
  analyzedAt = new Date(),
): QaNlpResult {
  const text = snapshot.text.trim();
  if (!text) {
    return QaNlpResultSchema.parse({
      status: 'uncertain',
      modelVersion: QA_NLP_GATEKEEPER_MODEL_VERSION,
      analyzedAt: analyzedAt.toISOString(),
    });
  }

  const prediction = predictQaNlpNaiveBayes(getQaNlpGatekeeperModel(), text);
  const status = prediction.confidence >= minConfidence ? 'classified' : 'uncertain';
  return QaNlpResultSchema.parse({
    status,
    category: prediction.category,
    confidence: Number(prediction.confidence.toFixed(4)),
    modelVersion: QA_NLP_GATEKEEPER_MODEL_VERSION,
    analyzedAt: analyzedAt.toISOString(),
  });
}
