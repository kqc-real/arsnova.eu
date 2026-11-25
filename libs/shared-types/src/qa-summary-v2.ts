import { z } from 'zod';

import {
  MODERATION_PROMPT_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_DEFINITION_SET_VERSION,
  ModerationPromptContextV1Schema,
  type ModerationPromptSource,
} from './moderation-prompt-context';
import { QaSummaryLocaleEnum, QaSummaryRuntimeDTOSchema, QaSummaryStatusEnum } from './schemas';

/** Versioned, full-context Q&A summary contracts. Legacy summary schemas stay unchanged. */
export const QA_SUMMARY_V2_SCHEMA_VERSION = 2 as const;
export const QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION = 'qa-summary-context-v2' as const;
export const QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION = 'qa-summary-model-output-v3' as const;
export const QA_SUMMARY_RESULT_V2_CONTRACT_VERSION = 'qa-summary-result-v2' as const;
export const QA_SUMMARY_CONTEXT_PREVIEW_SCHEMA_VERSION = 1 as const;
export const QA_SUMMARY_CONTEXT_PREVIEW_CONTRACT_VERSION = 'qa-summary-context-preview-v1' as const;
export const QA_SUMMARY_ADAPTER_CAPABILITIES_CONTRACT_VERSION =
  'qa-summary-adapter-capabilities-v1' as const;
export const QA_SUMMARY_FALLBACK_CONTRACT_VERSION = 'qa-summary-fallback-v1' as const;
export const QA_SUMMARY_TECHNICAL_INSTRUCTION_VERSION = 'qa-summary-technical-handoff-v12' as const;
export const QA_SUMMARY_LEGACY_HANDOFF_VERSION = 'qa-summary-technical-handoff-v8' as const;
export const QA_SUMMARY_MAX_TOPIC_LENGTH = 48;
export const QA_SUMMARY_GROUPED_MAX_TOPIC_LENGTH = 64;
export const QA_SUMMARY_REPORTING_OPENING = {
  de: 'Offen ist, ',
  en: 'Participants want to clarify ',
  fr: 'Le groupe souhaite clarifier ',
  es: 'El grupo quiere aclarar ',
  it: 'Il gruppo vuole chiarire ',
} as const satisfies Record<z.infer<typeof QaSummaryLocaleEnum>, string>;

const QaSummaryInstructionVersionSchema = z.literal([
  QA_SUMMARY_TECHNICAL_INSTRUCTION_VERSION,
  QA_SUMMARY_LEGACY_HANDOFF_VERSION,
]);

/** Short aliases for consumers that consistently call contract literals “contracts”. */
export const QA_SUMMARY_CONTEXT_V2_CONTRACT = QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION;
export const QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT = QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION;
export const QA_SUMMARY_RESULT_V2_CONTRACT = QA_SUMMARY_RESULT_V2_CONTRACT_VERSION;
export const QA_SUMMARY_CONTEXT_PREVIEW_CONTRACT = QA_SUMMARY_CONTEXT_PREVIEW_CONTRACT_VERSION;
export const QA_SUMMARY_ADAPTER_CAPABILITIES_CONTRACT =
  QA_SUMMARY_ADAPTER_CAPABILITIES_CONTRACT_VERSION;
export const QA_SUMMARY_FALLBACK_CONTRACT = QA_SUMMARY_FALLBACK_CONTRACT_VERSION;

const QaSummaryV2SchemaVersionField = z.literal(QA_SUMMARY_V2_SCHEMA_VERSION);
const QaSummarySourceReferenceV2Schema = z.string().trim().min(1).max(160);

export const QaSummaryStatementV2Schema = z
  .object({
    text: z.string().trim().min(1).max(400),
    sourceIds: z.array(QaSummarySourceReferenceV2Schema).min(1).max(8),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.sourceIds).size !== value.sourceIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceIds'],
        message: 'Quellenreferenzen einer Aussage müssen eindeutig sein.',
      });
    }
  });
export type QaSummaryStatementV2 = z.infer<typeof QaSummaryStatementV2Schema>;

const QaSummaryModelOutputV2BaseSchema = z
  .object({
    status: z.enum(['ready', 'uncertain', 'failed']),
    statements: z.array(QaSummaryStatementV2Schema).max(4),
    suggestedNextSteps: z.array(QaSummaryStatementV2Schema).max(2),
    limitations: z.array(z.string().trim().min(1).max(280)).max(2),
    modelVersion: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const QaSummaryModelOutputV2Schema = QaSummaryModelOutputV2BaseSchema.superRefine(
  (value, ctx) => {
    if (value.status === 'ready' && value.statements.length < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['statements'],
        message: 'ready requires at least one statement',
      });
    }
  },
);
export type QaSummaryModelOutputV2 = z.infer<typeof QaSummaryModelOutputV2Schema>;

/** Wire format for the private model. The adapter expands references to canonical source IDs. */
export function createQaSummaryModelWireSchema(sourceRefs: readonly string[]) {
  const refs = z.array(z.enum(sourceRefs)).min(1).max(2);
  const statement = z
    .object({
      sentence: z.string().trim().min(12).max(120),
      refs,
    })
    .strict();
  return z
    .object({
      topics: z
        .array(
          z
            .object({
              // Check the complete title after generation. A decoder maxLength can cut words.
              topic: z
                .string()
                .trim()
                .min(1)
                .refine((topic) => topic.length <= QA_SUMMARY_MAX_TOPIC_LENGTH),
              question: z
                .string()
                .trim()
                .min(12)
                .max(120)
                .refine((question) => question.endsWith('?')),
              refs,
            })
            .strict(),
        )
        .min(1)
        .max(Math.min(4, sourceRefs.length)),
      next: statement.optional(),
    })
    .strict();
}

/** Every question supplied for a topic is bound to its output as a citation. */
export function createGroupedQaSummaryModelWireSchema(
  locale: z.infer<typeof QaSummaryLocaleEnum>,
  first: readonly string[],
  second?: readonly string[],
) {
  const topicFor = (group: readonly string[]) => {
    const [lead, related] = group;
    const leadRef = z.literal(lead!);
    return z
      .object({
        summary: z
          .string()
          .trim()
          .overwrite((value) => {
            // Some completions repeat their structured citations at the end
            // of the sentence. Strip that duplicate only for this exact group.
            const annotation =
              value.match(/\s+\(?refs?:\s*\[?(\d+(?:\s*,\s*\d+)*)\]?\)?(\.)?$/iu) ??
              value.match(/(?<=\.)\s+\((\d+(?:\s*,\s*\d+)+)\)(?:\s*\},\s*\{)?$/u);
            if (annotation?.[1]?.replace(/\s+/gu, '') !== group.join(',')) return value;
            const sentence = value.slice(0, annotation.index).trimEnd();
            return annotation[2] && !sentence.endsWith('.') ? `${sentence}.` : sentence;
          })
          // Correct observed German model wording. Source labels are separate.
          .overwrite((value) =>
            locale === 'de'
              ? value
                  .replace(/\bdurchgangen\b/gu, 'durchgegangen')
                  .replace(
                    /\bdatenbankreproduzierbar(?=e[rmns]?\s+Migration(?:en)?\b)/gu,
                    'reproduzierbar',
                  )
                  .replace(/^(Offen ist, [^,]+), und ob /u, '$1 und ob ')
              : value,
          )
          .refine(
            (value) =>
              value.startsWith(QA_SUMMARY_REPORTING_OPENING[locale]) &&
              /^[^\r\n?]{14,299}\.$/u.test(value) &&
              !/\brefs?\s*:/iu.test(value),
          ),
        // The decoder constrains citations. Check prose after decoding to keep
        // free-text generation within the runtime's latency budget.
        topic: z
          .string()
          .trim()
          .overwrite((value) =>
            locale === 'de'
              ? value
                  .replace(/^Verschwinden (?=\p{Lu}[\p{L}-]*innen(?:\s|$))/u, 'Verschwinden von ')
                  .replace(
                    /^(?:Fehlende )?[Ll]ineare Modellbeurteilung$/u,
                    'Beurteilung linearer Modelle',
                  )
              : value,
          )
          .refine(
            (value) =>
              value.length >= 2 &&
              value.length <= QA_SUMMARY_GROUPED_MAX_TOPIC_LENGTH &&
              /^[^\r\n?:]+$/u.test(value),
          ),
        refs: related === undefined ? z.tuple([leadRef]) : z.tuple([leadRef, z.literal(related)]),
      })
      .strict();
  };
  const firstTopic = topicFor(first);
  return z
    .object({
      topics:
        second === undefined ? z.tuple([firstTopic]) : z.tuple([firstTopic, topicFor(second)]),
    })
    .strict();
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export const QaSummaryInferenceRequestV2Schema = z
  .object({
    schemaVersion: QaSummaryV2SchemaVersionField,
    taskType: z.literal('qa_summary'),
    requestContract: z.literal(QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION),
    outputContract: z.literal(QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION),
    instructionVersion: QaSummaryInstructionVersionSchema,
    instructionText: z.string().min(1).max(8_192),
    definitionVersion: z.literal(MODERATION_PROMPT_DEFINITION_SET_VERSION),
    definitionText: z.string().min(1).max(32_768),
    promptContext: ModerationPromptContextV1Schema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const { budget, context } = value.promptContext;
    if (
      context.qaSummaryTopicSourceIds !== undefined &&
      budget.tokenizer.method !== 'exact-tokenizer'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['promptContext', 'budget', 'tokenizer'],
        message: 'Die Zusammenfassung mit Themenbelegen erfordert eine exakte Tokenzählung.',
      });
    }
    if (budget.tokenizer.method === 'exact-tokenizer') return;
    const counters = [
      {
        path: ['instructionText'],
        actual: utf8ByteLength(value.instructionText),
        expected: value.promptContext.budget.instructionTokens,
        name: 'instructionText',
      },
      {
        path: ['definitionText'],
        actual: utf8ByteLength(value.definitionText),
        expected: value.promptContext.budget.definitionTokens,
        name: 'definitionText',
      },
    ] as const;
    for (const counter of counters) {
      if (counter.actual !== counter.expected) {
        ctx.addIssue({
          code: 'custom',
          path: [...counter.path],
          message: `${counter.name} muss exakt dem zugehörigen UTF-8-Budgetzähler entsprechen.`,
        });
      }
    }
  });
export type QaSummaryInferenceRequestV2 = z.infer<typeof QaSummaryInferenceRequestV2Schema>;

export const QaSummaryInferenceResponseV2Schema = z
  .object({
    schemaVersion: QaSummaryV2SchemaVersionField,
    taskType: z.literal('qa_summary'),
    outputContract: z.literal(QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION),
    output: QaSummaryModelOutputV2Schema,
  })
  .strict();
export type QaSummaryInferenceResponseV2 = z.infer<typeof QaSummaryInferenceResponseV2Schema>;

/** Dynamic reference integrity cannot be represented by the static response schema. */
export function hasOnlyAllowedQaSummaryV2References(
  request: QaSummaryInferenceRequestV2,
  output: QaSummaryModelOutputV2,
): boolean {
  const allowed = new Set(request.promptContext.context.sources.map((source) => source.id));
  return [...output.statements, ...output.suggestedNextSteps].every((statement) =>
    statement.sourceIds.every((sourceId) => allowed.has(sourceId)),
  );
}

/** Compatibility spelling for call sites that put the version after “References”. */
export const hasOnlyAllowedQaSummaryReferencesV2 = hasOnlyAllowedQaSummaryV2References;

export const QaSummaryAdapterCapabilityKindSchema = z.enum(['legacy-text', 'full-context']);
export type QaSummaryAdapterCapabilityKind = z.infer<typeof QaSummaryAdapterCapabilityKindSchema>;

export const QaSummaryLegacyTextCapabilitySchema = z
  .object({
    kind: z.literal('legacy-text'),
  })
  .strict();
export type QaSummaryLegacyTextCapability = z.infer<typeof QaSummaryLegacyTextCapabilitySchema>;

export const QaSummaryFullContextCapabilitySchema = z
  .object({
    kind: z.literal('full-context'),
    requestContract: z.literal(QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION),
    outputContract: z.literal(QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION),
    promptContextContract: z.literal(MODERATION_PROMPT_CONTEXT_CONTRACT_VERSION),
    definitionVersion: z.literal(MODERATION_PROMPT_DEFINITION_SET_VERSION),
  })
  .strict();
export type QaSummaryFullContextCapability = z.infer<typeof QaSummaryFullContextCapabilitySchema>;

export const QaSummaryAdapterCapabilityModeSchema = z.discriminatedUnion('kind', [
  QaSummaryLegacyTextCapabilitySchema,
  QaSummaryFullContextCapabilitySchema,
]);
export type QaSummaryAdapterCapabilityMode = z.infer<typeof QaSummaryAdapterCapabilityModeSchema>;

export const QaSummaryAdapterCapabilitiesSchema = z
  .object({
    contractVersion: z.literal(QA_SUMMARY_ADAPTER_CAPABILITIES_CONTRACT_VERSION),
    adapterId: z.string().trim().min(1).max(120),
    modes: z.array(QaSummaryAdapterCapabilityModeSchema).min(1).max(2),
  })
  .strict()
  .superRefine((value, ctx) => {
    const kinds = value.modes.map((mode) => mode.kind);
    if (new Set(kinds).size !== kinds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['modes'],
        message: 'Adapterfähigkeitsmodi müssen eindeutig sein.',
      });
    }
  });
export type QaSummaryAdapterCapabilities = z.infer<typeof QaSummaryAdapterCapabilitiesSchema>;

export const QA_SUMMARY_FALLBACK_REASONS = [
  'adapter_incompatible',
  'context_unavailable',
  'no_packed_sources',
  'disabled',
  'busy',
  'aborted',
  'timeout',
  'unavailable',
  'invalid_response',
  'misconfigured',
  'circuit_open',
  'queue_full',
  'source_changed',
  'permission_changed',
  'purged',
] as const;
export const QaSummaryFallbackReasonSchema = z.enum(QA_SUMMARY_FALLBACK_REASONS);
export type QaSummaryFallbackReason = z.infer<typeof QaSummaryFallbackReasonSchema>;

export const QaSummaryFallbackModeSchema = z.enum(['legacy-text', 'extractive', 'rule-based']);
export type QaSummaryFallbackMode = z.infer<typeof QaSummaryFallbackModeSchema>;

export const QaSummaryFallbackSchema = z
  .object({
    contractVersion: z.literal(QA_SUMMARY_FALLBACK_CONTRACT_VERSION),
    requestedRequestContract: z.literal(QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION),
    requestedOutputContract: z.literal(QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION),
    mode: QaSummaryFallbackModeSchema,
    reason: QaSummaryFallbackReasonSchema,
    retry: z.enum(['manual', 'not-applicable']),
  })
  .strict();
export type QaSummaryFallback = z.infer<typeof QaSummaryFallbackSchema>;

export const QaSummaryEffectiveModeSchema = z.enum([
  'full-context',
  'legacy-text',
  'extractive',
  'rule-based',
]);
export type QaSummaryEffectiveMode = z.infer<typeof QaSummaryEffectiveModeSchema>;

export const QaSummaryExecutionV2Schema = z
  .object({
    attemptedMode: QaSummaryAdapterCapabilityKindSchema.nullable(),
    effectiveMode: QaSummaryEffectiveModeSchema.nullable(),
    fallback: QaSummaryFallbackSchema.nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.effectiveMode === null) {
      if (value.attemptedMode !== null || value.fallback !== null) {
        ctx.addIssue({
          code: 'custom',
          message: 'Ohne effektiven Modus dürfen weder Versuch noch Fallback gesetzt sein.',
        });
      }
      return;
    }
    if (value.effectiveMode === 'full-context') {
      if (value.attemptedMode !== 'full-context' || value.fallback !== null) {
        ctx.addIssue({
          code: 'custom',
          message: 'Full-context erfordert einen Full-context-Versuch ohne Fallback.',
        });
      }
      return;
    }
    if (value.fallback === null || value.fallback.mode !== value.effectiveMode) {
      ctx.addIssue({
        code: 'custom',
        path: ['fallback'],
        message: 'Ein degradierter effektiver Modus benötigt den passenden Fallback.',
      });
    }
    if (value.effectiveMode === 'legacy-text' && value.attemptedMode === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['attemptedMode'],
        message:
          'Legacy-text als effektiver Adaptermodus muss als Adapterversuch ausgewiesen sein.',
      });
    }
  });
export type QaSummaryExecutionV2 = z.infer<typeof QaSummaryExecutionV2Schema>;

export const QA_SUMMARY_PRESENTATION_SOURCE_KINDS = [
  'qa-question',
  'semantic-topic',
  'quiz-question',
  'learning-objective',
  'quiz-result-aggregate',
  'feedback-aggregate',
  'compass-signal',
] as const satisfies readonly ModerationPromptSource['kind'][];

export const QaSummaryPresentationSourceKindSchema = z.enum(QA_SUMMARY_PRESENTATION_SOURCE_KINDS);
export type QaSummaryPresentationSourceKind = z.infer<typeof QaSummaryPresentationSourceKindSchema>;

export const QaSummaryPresentationSourceV2Schema = z
  .object({
    id: z.string().trim().min(1).max(160),
    kind: QaSummaryPresentationSourceKindSchema,
    label: z.string().trim().min(1).max(500),
  })
  .strict();
export type QaSummaryPresentationSourceV2 = z.infer<typeof QaSummaryPresentationSourceV2Schema>;

export const QaSummaryResultV2Schema = z
  .object({
    schemaVersion: QaSummaryV2SchemaVersionField,
    contractVersion: z.literal(QA_SUMMARY_RESULT_V2_CONTRACT_VERSION),
    status: QaSummaryStatusEnum,
    statements: z.array(QaSummaryStatementV2Schema).max(6),
    suggestedNextSteps: z.array(QaSummaryStatementV2Schema).max(4),
    limitations: z.array(z.string().trim().min(1).max(280)).max(6),
    sources: z.array(QaSummaryPresentationSourceV2Schema).max(80),
    modelVersion: z.string().trim().min(1).max(120).optional(),
    analyzedAt: z.string().datetime().optional(),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    locale: QaSummaryLocaleEnum,
    execution: QaSummaryExecutionV2Schema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === 'ready' && value.statements.length < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['statements'],
        message: 'ready requires at least one statement',
      });
    }

    const sourceIds = value.sources.map((source) => source.id);
    const uniqueSourceIds = new Set(sourceIds);
    if (uniqueSourceIds.size !== sourceIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['sources'],
        message: 'Das Ergebnisquellenregister muss eindeutige IDs enthalten.',
      });
    }

    const usedSourceIds = new Set(
      [...value.statements, ...value.suggestedNextSteps].flatMap(
        (statement) => statement.sourceIds,
      ),
    );
    for (const [statementIndex, statement] of [
      ...value.statements.map((item, index) => ({ section: 'statements', index, item })),
      ...value.suggestedNextSteps.map((item, index) => ({
        section: 'suggestedNextSteps',
        index,
        item,
      })),
    ].entries()) {
      void statementIndex;
      for (const [sourceIndex, sourceId] of statement.item.sourceIds.entries()) {
        if (!uniqueSourceIds.has(sourceId)) {
          ctx.addIssue({
            code: 'custom',
            path: [statement.section, statement.index, 'sourceIds', sourceIndex],
            message: `Unbekannte Ergebnisquellenreferenz: ${sourceId}`,
          });
        }
      }
    }
    for (const [sourceIndex, sourceId] of sourceIds.entries()) {
      if (!usedSourceIds.has(sourceId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sources', sourceIndex],
          message: `Nicht verwendete Ergebnisquelle: ${sourceId}`,
        });
      }
    }
  });
export type QaSummaryResultV2 = z.infer<typeof QaSummaryResultV2Schema>;

export const QaSummaryRuntimeV2DTOSchema = z
  .object({
    schemaVersion: QaSummaryV2SchemaVersionField,
    enabled: z.boolean(),
    inferenceConfigured: z.boolean(),
    capabilities: QaSummaryAdapterCapabilitiesSchema,
    result: QaSummaryResultV2Schema.nullable(),
  })
  .strict();
export type QaSummaryRuntimeV2DTO = z.infer<typeof QaSummaryRuntimeV2DTOSchema>;

/** V2 must be attempted first because the legacy DTO intentionally strips unknown fields. */
export const QaSummaryRuntimeCompatibleDTOSchema = z.union([
  QaSummaryRuntimeV2DTOSchema,
  QaSummaryRuntimeDTOSchema,
]);
export type QaSummaryRuntimeCompatibleDTO = z.infer<typeof QaSummaryRuntimeCompatibleDTOSchema>;

export const GetQaSummaryContextPreviewInputSchema = z
  .object({
    sessionId: z.uuid(),
    locale: QaSummaryLocaleEnum,
  })
  .strict();
export type GetQaSummaryContextPreviewInput = z.infer<typeof GetQaSummaryContextPreviewInputSchema>;

export const QaSummaryContextPreviewDTOSchema = z
  .object({
    schemaVersion: z.literal(QA_SUMMARY_CONTEXT_PREVIEW_SCHEMA_VERSION),
    contractVersion: z.literal(QA_SUMMARY_CONTEXT_PREVIEW_CONTRACT_VERSION),
    promptContext: ModerationPromptContextV1Schema,
    instructionVersion: QaSummaryInstructionVersionSchema,
    definitionVersion: z.literal(MODERATION_PROMPT_DEFINITION_SET_VERSION),
    capabilities: QaSummaryAdapterCapabilitiesSchema,
    selectedMode: QaSummaryAdapterCapabilityKindSchema.nullable(),
    fallback: QaSummaryFallbackSchema.nullable(),
    cache: z.enum(['hit', 'miss', 'purge-fenced']),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.selectedMode !== null &&
      !value.capabilities.modes.some((mode) => mode.kind === value.selectedMode)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['selectedMode'],
        message: 'Der gewählte Modus muss in den Adapterfähigkeiten enthalten sein.',
      });
    }
    if (value.selectedMode === 'full-context' && value.fallback !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['fallback'],
        message: 'Ein gewählter Full-context-Modus darf keinen Fallback ausweisen.',
      });
    }
    if (value.selectedMode === 'legacy-text' && value.fallback?.mode !== 'legacy-text') {
      ctx.addIssue({
        code: 'custom',
        path: ['fallback'],
        message: 'Ein gewählter Legacy-Modus benötigt den passenden Fallback.',
      });
    }
    if (value.selectedMode === null && value.fallback?.mode === 'legacy-text') {
      ctx.addIssue({
        code: 'custom',
        path: ['selectedMode'],
        message: 'Ein Legacy-Adapterfallback benötigt einen gewählten Legacy-Modus.',
      });
    }
  });
export type QaSummaryContextPreviewDTO = z.infer<typeof QaSummaryContextPreviewDTOSchema>;
