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
import { resolveWordCloudNormalizationMeta } from '../lib/wordCloudNormalization';
import { hostProcedure, router } from '../trpc';

function buildAnalysisOutput(
  input: AnalyzeWordCloudInput,
  entries: AnalyzeWordCloudOutput['entries'],
  themeFallbackUsed: boolean,
): AnalyzeWordCloudOutput {
  return AnalyzeWordCloudOutputSchema.parse({
    mode: input.mode,
    locale: input.locale,
    metric: input.metric,
    generatedAt: new Date().toISOString(),
    fallbackUsed: themeFallbackUsed,
    entries,
    ...resolveWordCloudNormalizationMeta(input),
  });
}

function buildFallbackAnalysisResult(input: AnalyzeWordCloudInput): AnalyzeWordCloudOutput {
  const entries = buildLexicalWordCloudEntries(input.items, input.locale, input.maxEntries);
  return buildAnalysisOutput(input, entries, input.mode === 'THEME');
}

function buildThemeAnalysisResult(input: AnalyzeWordCloudInput): AnalyzeWordCloudOutput {
  const analysis = buildThemeWordCloudAnalysis(input);
  if (!analysis.usedThemeAnchors || analysis.entries.length === 0) {
    return buildFallbackAnalysisResult(input);
  }

  return buildAnalysisOutput(input, analysis.entries, false);
}

/**
 * Word-Cloud-Analysepfad für den Host.
 * THEME bleibt der deterministische Phrasen-/Anchor-Pfad.
 * normalization ist die orthogonale 1.14b-Achse; Lemma wird erst mit Sidecar angewandt.
 */
export const wordCloudRouter = router({
  analyze: hostProcedure
    .input(AnalyzeWordCloudInputSchema)
    .output(AnalyzeWordCloudOutputSchema)
    .mutation(({ input }) =>
      input.mode === 'THEME' ? buildThemeAnalysisResult(input) : buildFallbackAnalysisResult(input),
    ),
});
