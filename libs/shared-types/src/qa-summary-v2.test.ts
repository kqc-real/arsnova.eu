import { describe, expect, it } from 'vitest';

import {
  MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1,
  MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1,
} from './moderation-prompt-context-fixtures.js';
import {
  MODERATION_PROMPT_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_DEFINITION_SET_VERSION,
} from './moderation-prompt-context.js';
import {
  OPEN_WEIGHT_LLM_SCHEMA_VERSION,
  OpenWeightLlmRequestSchema,
  OpenWeightLlmSummaryRequestSchema,
  OpenWeightLlmSummaryRequestV2Schema,
  OpenWeightLlmSummaryOutputV2Schema,
  hasOnlyAllowedOpenWeightLlmReferences,
} from './open-weight-llm.js';
import {
  QA_SUMMARY_ADAPTER_CAPABILITIES_CONTRACT_VERSION,
  QA_SUMMARY_CONTEXT_PREVIEW_CONTRACT_VERSION,
  QA_SUMMARY_CONTEXT_PREVIEW_SCHEMA_VERSION,
  QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION,
  QA_SUMMARY_FALLBACK_CONTRACT_VERSION,
  QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
  QA_SUMMARY_RESULT_V2_CONTRACT_VERSION,
  QA_SUMMARY_TECHNICAL_INSTRUCTION_VERSION,
  QA_SUMMARY_V2_SCHEMA_VERSION,
  QaSummaryAdapterCapabilitiesSchema,
  QaSummaryContextPreviewDTOSchema,
  QaSummaryExecutionV2Schema,
  QaSummaryInferenceRequestV2Schema,
  QaSummaryInferenceResponseV2Schema,
  QaSummaryResultV2Schema,
  QaSummaryRuntimeCompatibleDTOSchema,
  hasOnlyAllowedQaSummaryV2References,
  type QaSummaryInferenceRequestV2,
} from './qa-summary-v2.js';

const SOURCE_ID = MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[0].sourceId;
const INSTRUCTION_TEXT = 'I'.repeat(400);
const DEFINITION_TEXT = 'D'.repeat(400);

function requestV2(): QaSummaryInferenceRequestV2 {
  return {
    schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
    taskType: 'qa_summary',
    requestContract: QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION,
    outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
    instructionVersion: QA_SUMMARY_TECHNICAL_INSTRUCTION_VERSION,
    instructionText: INSTRUCTION_TEXT,
    definitionVersion: MODERATION_PROMPT_DEFINITION_SET_VERSION,
    definitionText: DEFINITION_TEXT,
    promptContext: structuredClone(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1),
  };
}

const capabilities = {
  contractVersion: QA_SUMMARY_ADAPTER_CAPABILITIES_CONTRACT_VERSION,
  adapterId: 'open-weight-llm-v2',
  modes: [
    {
      kind: 'full-context',
      requestContract: QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION,
      outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
      promptContextContract: MODERATION_PROMPT_CONTEXT_CONTRACT_VERSION,
      definitionVersion: MODERATION_PROMPT_DEFINITION_SET_VERSION,
    },
    { kind: 'legacy-text' },
  ],
} as const;

describe('Q&A summary V2 contracts', () => {
  it('accepts the exact full-context request without applying the legacy byte cap', () => {
    const request = requestV2();
    request.instructionText = '🧪'.repeat(800);
    request.promptContext.budget.instructionTokens = 3_200;
    request.promptContext.budget.packedInputTokens =
      request.promptContext.budget.instructionTokens +
      request.promptContext.budget.definitionTokens +
      request.promptContext.budget.dataTokens;
    request.promptContext.budget.contextWindowTokens = 8_192;

    expect(JSON.stringify(request).length).toBeGreaterThan(2_500);
    expect(QaSummaryInferenceRequestV2Schema.safeParse(request).success).toBe(true);
    expect(OpenWeightLlmSummaryRequestV2Schema.safeParse(request).success).toBe(true);
    expect(QA_SUMMARY_TECHNICAL_INSTRUCTION_VERSION).toBe('qa-summary-technical-handoff-v2');
    expect(QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION).toBe('qa-summary-model-output-v3');
    expect(
      QaSummaryInferenceRequestV2Schema.safeParse({
        ...request,
        instructionVersion: 'qa-summary-technical-handoff-v1',
      }).success,
    ).toBe(false);
    expect(
      QaSummaryInferenceRequestV2Schema.safeParse({
        ...request,
        outputContract: 'qa-summary-model-output-v2',
      }).success,
    ).toBe(false);
  });

  it('keeps the legacy 2,500-byte summary request bound unchanged', () => {
    const legacy = {
      schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
      taskType: 'qa_summary',
      locale: 'de',
      snapshotHash: 'a'.repeat(64),
      sources: [{ id: SOURCE_ID, kind: 'qa-question', text: 'x'.repeat(2_400) }],
    };
    expect(OpenWeightLlmSummaryRequestSchema.safeParse(legacy).success).toBe(false);
  });

  it('checks instruction and definition byte counts against the packed budget', () => {
    const request = requestV2();
    request.instructionText = 'ä'.repeat(400);
    expect(QaSummaryInferenceRequestV2Schema.safeParse(request).success).toBe(false);
    request.promptContext.budget.instructionTokens = 800;
    request.promptContext.budget.packedInputTokens = 1_400;
    expect(QaSummaryInferenceRequestV2Schema.safeParse(request).success).toBe(true);
  });

  it('rejects duplicate and foreign statement references', () => {
    const request = requestV2();
    const duplicate = {
      status: 'ready',
      statements: [{ text: 'Belegt.', sourceIds: [SOURCE_ID, SOURCE_ID] }],
      suggestedNextSteps: [],
      limitations: [],
    };
    expect(
      QaSummaryInferenceResponseV2Schema.safeParse({
        schemaVersion: 2,
        taskType: 'qa_summary',
        outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
        output: duplicate,
      }).success,
    ).toBe(false);

    const foreign = {
      status: 'ready' as const,
      statements: [{ text: 'Nicht belegt.', sourceIds: ['qa-question:foreign'] }],
      suggestedNextSteps: [],
      limitations: [],
    };
    expect(hasOnlyAllowedQaSummaryV2References(request, foreign)).toBe(false);
  });

  it('models adapter capabilities strictly and without fallback modes', () => {
    expect(QaSummaryAdapterCapabilitiesSchema.safeParse(capabilities).success).toBe(true);
    expect(
      QaSummaryAdapterCapabilitiesSchema.safeParse({
        ...capabilities,
        modes: [{ kind: 'extractive' }],
      }).success,
    ).toBe(false);
    expect(
      QaSummaryAdapterCapabilitiesSchema.safeParse({
        ...capabilities,
        modes: [{ kind: 'legacy-text', requestContract: 'silently-ignored' }],
      }).success,
    ).toBe(false);
  });

  it('requires coherent attempted, effective and fallback modes', () => {
    expect(
      QaSummaryExecutionV2Schema.safeParse({
        attemptedMode: 'full-context',
        effectiveMode: 'full-context',
        fallback: null,
      }).success,
    ).toBe(true);
    expect(
      QaSummaryExecutionV2Schema.safeParse({
        attemptedMode: 'full-context',
        effectiveMode: 'extractive',
        fallback: null,
      }).success,
    ).toBe(false);
    expect(
      QaSummaryExecutionV2Schema.safeParse({
        attemptedMode: 'full-context',
        effectiveMode: 'extractive',
        fallback: {
          contractVersion: QA_SUMMARY_FALLBACK_CONTRACT_VERSION,
          requestedRequestContract: QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION,
          requestedOutputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
          mode: 'extractive',
          reason: 'timeout',
          retry: 'manual',
        },
      }).success,
    ).toBe(true);
  });

  it('closes result references and accepts every moderation source kind', () => {
    const kinds = [
      'qa-question',
      'semantic-topic',
      'quiz-question',
      'learning-objective',
      'quiz-result-aggregate',
      'feedback-aggregate',
      'compass-signal',
    ] as const;
    const sources = kinds.map((kind, index) => ({ id: `${kind}:${index}`, kind, label: kind }));
    const result = {
      schemaVersion: 2,
      contractVersion: QA_SUMMARY_RESULT_V2_CONTRACT_VERSION,
      status: 'ready',
      statements: [{ text: 'Mehrere Belege.', sourceIds: sources.map(({ id }) => id) }],
      suggestedNextSteps: [],
      limitations: [],
      sources,
      snapshotHash: 'b'.repeat(64),
      locale: 'de',
      execution: {
        attemptedMode: 'full-context',
        effectiveMode: 'full-context',
        fallback: null,
      },
    };
    expect(QaSummaryResultV2Schema.safeParse(result).success).toBe(true);
    expect(
      QaSummaryResultV2Schema.safeParse({
        ...result,
        sources: result.sources.slice(1),
      }).success,
    ).toBe(false);
    expect(
      QaSummaryResultV2Schema.safeParse({
        ...result,
        sources: [...result.sources, { ...result.sources[0] }],
      }).success,
    ).toBe(false);
  });

  it('exposes the exact safe context in preview without prompt texts', () => {
    const preview = {
      schemaVersion: QA_SUMMARY_CONTEXT_PREVIEW_SCHEMA_VERSION,
      contractVersion: QA_SUMMARY_CONTEXT_PREVIEW_CONTRACT_VERSION,
      promptContext: requestV2().promptContext,
      instructionVersion: QA_SUMMARY_TECHNICAL_INSTRUCTION_VERSION,
      definitionVersion: MODERATION_PROMPT_DEFINITION_SET_VERSION,
      capabilities,
      selectedMode: 'full-context',
      fallback: null,
      cache: 'miss',
    };
    const parsed = QaSummaryContextPreviewDTOSchema.parse(preview);
    expect(parsed.promptContext).toEqual(requestV2().promptContext);
    expect(parsed).not.toHaveProperty('instructionText');
    expect(parsed).not.toHaveProperty('definitionText');
    expect(
      QaSummaryContextPreviewDTOSchema.safeParse({ ...preview, instructionText: 'secret' }).success,
    ).toBe(false);
  });

  it('parses V2 before the permissive legacy runtime DTO', () => {
    const runtime = {
      schemaVersion: 2,
      enabled: false,
      inferenceConfigured: false,
      capabilities,
      result: null,
    };
    expect(QaSummaryRuntimeCompatibleDTOSchema.parse(runtime)).toEqual(runtime);
  });

  it('keeps OpenWeight V1/V2 versions matched and reference-bound', () => {
    const request = requestV2();
    const output = {
      schemaVersion: 2 as const,
      taskType: 'qa_summary' as const,
      outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
      output: {
        status: 'ready' as const,
        statements: [{ text: 'Belegt.', sourceIds: [SOURCE_ID] }],
        suggestedNextSteps: [],
        limitations: [],
      },
    };
    expect(OpenWeightLlmRequestSchema.safeParse(request).success).toBe(true);
    expect(OpenWeightLlmSummaryOutputV2Schema.safeParse(output).success).toBe(true);
    expect(
      OpenWeightLlmSummaryOutputV2Schema.safeParse({
        ...output,
        outputContract: 'qa-summary-model-output-v2',
      }).success,
    ).toBe(false);
    expect(
      OpenWeightLlmSummaryOutputV2Schema.safeParse({
        ...output,
        output: {
          ...output.output,
          statements: Array.from({ length: 5 }, (_, index) => ({
            text: `Aussage ${index + 1}`,
            sourceIds: [SOURCE_ID],
          })),
        },
      }).success,
    ).toBe(false);
    expect(
      OpenWeightLlmSummaryOutputV2Schema.safeParse({
        ...output,
        output: {
          ...output.output,
          suggestedNextSteps: Array.from({ length: 3 }, (_, index) => ({
            text: `Schritt ${index + 1}`,
            sourceIds: [SOURCE_ID],
          })),
        },
      }).success,
    ).toBe(false);
    expect(
      OpenWeightLlmSummaryOutputV2Schema.safeParse({
        ...output,
        output: {
          ...output.output,
          limitations: ['Hinweis 1', 'Hinweis 2', 'Hinweis 3'],
        },
      }).success,
    ).toBe(false);
    expect(hasOnlyAllowedOpenWeightLlmReferences(request, output)).toBe(true);
    expect(
      hasOnlyAllowedOpenWeightLlmReferences(request, {
        schemaVersion: 1,
        taskType: 'qa_summary',
        result: output.output,
      }),
    ).toBe(false);
  });
});
