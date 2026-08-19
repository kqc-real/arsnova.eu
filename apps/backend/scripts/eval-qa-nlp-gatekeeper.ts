#!/usr/bin/env tsx
/**
 * Druckt Precision/Recall/F1 des Q&A-NLP-Gatekeepers gegen das kuratierte Seed-Set.
 * Kein Produktiv-Freigabeersatz; dient der lokalen Messung (ADR-0032).
 */
import { format } from 'node:util';
import { QA_NLP_MIN_CONFIDENCE_DEFAULT } from '../src/lib/qaNlpConfig';
import { evaluateQaNlpPredictions } from '../src/lib/qaNlpEvaluate';
import { getQaNlpGatekeeperModel } from '../src/lib/qaNlpGatekeeper';
import { predictQaNlpKeywordBaseline } from '../src/lib/qaNlpKeywordBaseline';
import { predictQaNlpNaiveBayes } from '../src/lib/qaNlpNaiveBayes';
import { qaNlpSeedBySplit } from '../src/lib/qaNlpSeed';

function log(...values: unknown[]): void {
  process.stdout.write(`${format(...values)}\n`);
}

const model = getQaNlpGatekeeperModel();
const evalExamples = qaNlpSeedBySplit('eval').filter(
  (example) => !example.tags.includes('ambiguous'),
);
const nb = evaluateQaNlpPredictions(
  evalExamples,
  (text) => predictQaNlpNaiveBayes(model, text),
  QA_NLP_MIN_CONFIDENCE_DEFAULT,
);
const keyword = evaluateQaNlpPredictions(
  evalExamples,
  predictQaNlpKeywordBaseline,
  QA_NLP_MIN_CONFIDENCE_DEFAULT,
);

log(
  JSON.stringify(
    {
      modelVersion: model.version,
      minConfidence: QA_NLP_MIN_CONFIDENCE_DEFAULT,
      evalSize: evalExamples.length,
      naiveBayes: nb,
      keywordBaseline: keyword,
    },
    null,
    2,
  ),
);
