import {
  type AnalyzeWordCloudInput,
  AnalyzeWordCloudInputSchema,
  AnalyzeWordCloudOutputSchema,
  type AnalyzeWordCloudOutput,
} from '@arsnova/shared-types';
import {
  buildLexicalWordCloudEntries,
  buildThemeWordCloudAnalysis,
} from '../lib/wordCloudAnalysis';
import { normalizeWordCloudItems } from '../lib/wordCloudNormalizer';
import type { WordCloudNormalizationMeta } from '../lib/wordCloudNormalization';
import { hostProcedure, router } from '../trpc';

function buildAnalysisOutput(
  input: AnalyzeWordCloudInput,
  entries: AnalyzeWordCloudOutput['entries'],
  themeFallbackUsed: boolean,
  meta: WordCloudNormalizationMeta,
): AnalyzeWordCloudOutput {
  return AnalyzeWordCloudOutputSchema.parse({
    mode: input.mode,
    locale: input.locale,
    metric: input.metric,
    generatedAt: new Date().toISOString(),
    fallbackUsed: themeFallbackUsed,
    entries,
    ...meta,
  });
}

async function analyzeWordCloudSnapshot(
  input: AnalyzeWordCloudInput,
): Promise<AnalyzeWordCloudOutput> {
  const normalized = await normalizeWordCloudItems(input);
  if (input.mode === 'THEME') {
    const analysis = buildThemeWordCloudAnalysis(input);
    if (!analysis.usedThemeAnchors || analysis.entries.length === 0) {
      return buildAnalysisOutput(
        input,
        buildLexicalWordCloudEntries(
          input.items,
          input.locale,
          input.maxEntries,
          normalized.tokensByItemId,
        ),
        true,
        normalized.meta,
      );
    }
    return buildAnalysisOutput(input, analysis.entries, false, normalized.meta);
  }

  return buildAnalysisOutput(
    input,
    buildLexicalWordCloudEntries(
      input.items,
      input.locale,
      input.maxEntries,
      normalized.tokensByItemId,
    ),
    false,
    normalized.meta,
  );
}

/**
 * Word-Cloud-Analysepfad für den Host.
 * THEME bleibt der deterministische Phrasen-/Anchor-Pfad ohne spaCy.
 * LEXICAL + LEMMA glättet über den Sidecar und fällt hart auf Identity zurück.
 */
export const wordCloudRouter = router({
  analyze: hostProcedure
    .input(AnalyzeWordCloudInputSchema)
    .output(AnalyzeWordCloudOutputSchema)
    .mutation(({ input }) => analyzeWordCloudSnapshot(input)),
});
