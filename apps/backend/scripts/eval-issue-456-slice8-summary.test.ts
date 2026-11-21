import {
  QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
  QA_SUMMARY_V2_SCHEMA_VERSION,
} from '@arsnova/shared-types';
import { describe, expect, it } from 'vitest';
import {
  assertSecretFreeSlice8Report,
  parseSlice8CliMode,
  runSlice8SummaryEvaluation,
} from './eval-issue-456-slice8-summary';

describe('eval-issue-456-slice8-summary', () => {
  it('parst CLI-Modi deterministisch und lehnt widersprüchliche Flags ab', () => {
    expect(parseSlice8CliMode([])).toBe('pack-only');
    expect(parseSlice8CliMode(['--pack-only'])).toBe('pack-only');
    expect(parseSlice8CliMode(['--live'])).toBe('live');
    expect(() => parseSlice8CliMode(['--pack-only', '--live'])).toThrow(
      /either --pack-only or --live/,
    );
  });

  it('erzeugt im netzwerkfreien --pack-only Modus deterministische, geheimnisfreie Budget- und Wire-Berichte', async () => {
    const first = await runSlice8SummaryEvaluation({
      mode: 'pack-only',
      env: { OPEN_WEIGHT_LLM_TOKEN: 'super-secret-private-token-123456' },
    });
    const second = await runSlice8SummaryEvaluation({
      mode: 'pack-only',
      env: { OPEN_WEIGHT_LLM_TOKEN: 'super-secret-private-token-123456' },
    });

    expect(first.liveCases).toBeNull();
    expect(first.modelIdentity.contextWindowTokens).toBe(8_192);
    expect(first.modelIdentity.reservedOutputTokens).toBe(192);
    expect(first.packCases).toHaveLength(3);

    for (let index = 0; index < first.packCases.length; index += 1) {
      const left = first.packCases[index]!;
      const right = second.packCases[index]!;
      expect(left.deterministicBitIdentical).toBe(true);
      expect(left.snapshotHash).toBe(right.snapshotHash);
      expect(left.canonicalContextSha256).toBe(right.canonicalContextSha256);
      expect(left.compactWireUserSha256).toBe(right.compactWireUserSha256);
      expect(
        left.budget.packedInputTokens +
          left.budget.reservedOutputTokens +
          left.budget.safetyMarginTokens,
      ).toBeLessThanOrEqual(8_192);
      expect(left.wire.compactUserUtf8Bytes).toBeLessThan(left.wire.canonicalContextUtf8Bytes);
      expect(left.coverage.includedQaSources).toBeGreaterThan(0);
    }

    const largeCase = first.packCases.find((item) => item.caseId === 'large-corpus-8k');
    expect(largeCase?.coverage.packedTopics).toBeGreaterThan(0);
    expect(JSON.stringify(first)).not.toContain('super-secret-private-token-123456');
  });

  it('aggregiert im --live Modus TTFT-/Prefill-Telemetrie, Bitgleichheit und Qualitätsgate ohne Secrets', async () => {
    const report = await runSlice8SummaryEvaluation({
      mode: 'live',
      liveRuns: 3,
      env: { OPEN_WEIGHT_LLM_TOKEN: 'private-bearer-secret-abcdef1234' },
      runner: async (request) => {
        const firstIncludedQa = request.promptContext.context.sources.find(
          (source) => source.kind === 'qa-question' && source.content.state === 'included',
        );
        if (!firstIncludedQa || firstIncludedQa.kind !== 'qa-question') {
          throw new Error('Expected at least one included qa-question source.');
        }
        return {
          status: 'completed',
          output: {
            schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
            taskType: 'qa_summary',
            outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
            output: {
              status: 'ready',
              statements: [
                {
                  text: 'Offene Rückfragen: Welche Beispiele klären den aktuellen Vorlesungsabschnitt?',
                  sourceIds: [firstIncludedQa.id],
                },
              ],
              suggestedNextSteps: [],
              limitations: [],
            },
          },
          telemetry: {
            taskType: 'qa_summary',
            elapsedMs: 6_420,
            model: 'qwen3-4b-instruct-2507-q4_k_m',
            promptTokens: 780,
            completionTokens: 48,
            finishReason: 'stop',
            timings: {
              promptMs: 3_150,
              promptPerSecond: 247.6,
              predictedMs: 3_270,
              predictedPerSecond: 14.7,
            },
          },
        };
      },
    });

    expect(report.liveCases).toHaveLength(3);
    for (const liveCase of report.liveCases ?? []) {
      expect(liveCase.allCompletedAndAccepted).toBe(true);
      expect(liveCase.deterministicOutputAcrossRuns).toBe(true);
      expect(liveCase.medianPromptMs).toBe(3_150);
      expect(liveCase.runs[0]?.conservativeToRealPromptTokenRatio).toBeGreaterThan(1);
    }

    expect(() =>
      assertSecretFreeSlice8Report('{"leak":"private-bearer-secret-abcdef1234"}', {
        OPEN_WEIGHT_LLM_TOKEN: 'private-bearer-secret-abcdef1234',
      }),
    ).toThrow(/configured secret/);
  });
});
