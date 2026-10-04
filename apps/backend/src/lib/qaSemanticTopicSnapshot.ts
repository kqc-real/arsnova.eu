import {
  WordCloudWeightMetricEnum,
  type AnalyzeQaWordCloudInput,
  type AnalyzeWordCloudOutput,
  type WordCloudAnalysisSourceItem,
} from '@arsnova/shared-types';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { WordCloudAnalysisCache, WordCloudSnapshotCacheScope } from './wordCloudAnalysisCache';

export const QA_SEMANTIC_TOPIC_SNAPSHOT_VERSION = 'qa-semantic-topic-snapshot-v1' as const;

const QaSemanticTopicSnapshotMemberSchema = z
  .object({
    questionId: z.string().trim().min(1).max(160),
    textDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const QaSemanticTopicSnapshotItemSchema = z
  .object({
    topicId: z.string().regex(/^[a-f0-9]{64}$/),
    confidence: z.number().min(0).max(1),
    labelSourceQuestionId: z.string().trim().min(1).max(160),
    members: z.array(QaSemanticTopicSnapshotMemberSchema).min(1).max(500),
  })
  .strict()
  .superRefine((value, ctx) => {
    const memberIds = new Set<string>();
    value.members.forEach((member, index) => {
      if (memberIds.has(member.questionId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['members', index, 'questionId'],
          message: 'Semantic topic membership must not contain duplicate question IDs.',
        });
      }
      memberIds.add(member.questionId);
    });
    if (!memberIds.has(value.labelSourceQuestionId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['labelSourceQuestionId'],
        message: 'The extractive label source must be a topic member.',
      });
    }
  });

/**
 * Internal, purge-bound representation of the latest usable Q&A semantic analysis.
 * It deliberately stores neither question nor label text. Current text is loaded
 * authoritatively later and matched against the per-member digest.
 */
export const QaSemanticTopicSnapshotSchema = z
  .object({
    version: z.literal(QA_SEMANTIC_TOPIC_SNAPSHOT_VERSION),
    status: z.enum(['ready', 'uncertain']),
    metric: WordCloudWeightMetricEnum,
    corpusRevision: z.string().trim().min(1).max(120),
    analyzedAt: z.string().datetime(),
    analysisVersion: z.string().trim().min(1).max(120),
    model: z
      .object({
        id: z.string().trim().min(1).max(120),
        version: z.string().trim().min(1).max(120),
      })
      .strict(),
    eligibleQuestionCount: z.number().int().nonnegative(),
    analyzedQuestionCount: z.number().int().nonnegative(),
    topics: z.array(QaSemanticTopicSnapshotItemSchema).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.analyzedQuestionCount > value.eligibleQuestionCount) {
      ctx.addIssue({
        code: 'custom',
        path: ['analyzedQuestionCount'],
        message: 'Analyzed Q&A questions cannot exceed the eligible corpus.',
      });
    }
    const topicIds = new Set<string>();
    const assignedQuestionIds = new Set<string>();
    value.topics.forEach((topic, topicIndex) => {
      if (topicIds.has(topic.topicId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['topics', topicIndex, 'topicId'],
          message: 'Semantic topic IDs must be unique.',
        });
      }
      topicIds.add(topic.topicId);
      topic.members.forEach((member, memberIndex) => {
        if (assignedQuestionIds.has(member.questionId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['topics', topicIndex, 'members', memberIndex, 'questionId'],
            message: 'A question can belong to only one semantic topic.',
          });
        }
        assignedQuestionIds.add(member.questionId);
      });
    });
    if (assignedQuestionIds.size > value.analyzedQuestionCount) {
      ctx.addIssue({
        code: 'custom',
        path: ['topics'],
        message: 'Semantic topic membership cannot exceed the analyzed Q&A corpus.',
      });
    }
  });

export type QaSemanticTopicSnapshot = z.infer<typeof QaSemanticTopicSnapshotSchema>;

export interface QaSemanticTopicSnapshotBuildInput {
  readonly request: Pick<AnalyzeQaWordCloudInput, 'mode' | 'filter' | 'metric'>;
  readonly analysis: AnalyzeWordCloudOutput;
  readonly corpusRevision: string;
  readonly eligibleQuestionCount: number;
  readonly corpusItems: readonly WordCloudAnalysisSourceItem[];
}

export interface RecordLatestQaSemanticTopicSnapshotInput extends QaSemanticTopicSnapshotBuildInput {
  readonly cache: WordCloudAnalysisCache;
  readonly scope: WordCloudSnapshotCacheScope;
}

export function hashQaSemanticTopicMemberText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function buildTopicId(
  members: readonly { readonly questionId: string }[],
  labelSourceQuestionId: string,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        members: members.map((member) => member.questionId),
        labelSourceQuestionId,
      }),
      'utf8',
    )
    .digest('hex');
}

/**
 * Builds only reusable full-corpus semantic results. Compact presenter output,
 * lexical fallbacks, pinned-only analyses and partial membership are rejected.
 */
export function buildQaSemanticTopicSnapshot(
  input: QaSemanticTopicSnapshotBuildInput,
): QaSemanticTopicSnapshot | null {
  const { request, analysis } = input;
  if (
    request.mode !== 'SEMANTIC' ||
    request.filter !== 'ALL_ELIGIBLE' ||
    analysis.mode !== 'SEMANTIC' ||
    (analysis.status !== 'ready' && analysis.status !== 'uncertain') ||
    analysis.fallbackUsed ||
    analysis.metric !== request.metric ||
    analysis.modelId === null ||
    analysis.modelVersion === null
  ) {
    return null;
  }

  const corpusById = new Map<string, WordCloudAnalysisSourceItem>();
  for (const item of input.corpusItems) {
    if (corpusById.has(item.id)) {
      return null;
    }
    corpusById.set(item.id, item);
  }
  if (input.eligibleQuestionCount < corpusById.size) {
    return null;
  }

  const topics: QaSemanticTopicSnapshot['topics'][number][] = [];
  for (const entry of analysis.entries) {
    const declaredMemberCount = entry.memberCount ?? entry.members.length;
    if (entry.membersTruncated === true || declaredMemberCount !== entry.members.length) {
      return null;
    }
    if (entry.confidence === null) {
      return null;
    }

    const members = entry.members
      .map((member) => {
        const corpusItem = corpusById.get(member.sourceId);
        if (!corpusItem || corpusItem.text !== member.text) {
          return null;
        }
        return {
          questionId: member.sourceId,
          textDigest: hashQaSemanticTopicMemberText(corpusItem.text),
        };
      })
      .sort((left, right) => (left?.questionId ?? '').localeCompare(right?.questionId ?? ''));
    if (members.some((member) => member === null)) {
      return null;
    }
    const completeMembers = members.filter(
      (member): member is NonNullable<typeof member> => member !== null,
    );
    const labelText = entry.basisLabel ?? entry.label;
    const labelSourceQuestionId = entry.members
      .filter((member) => member.text === labelText)
      .map((member) => member.sourceId)
      .sort((left, right) => left.localeCompare(right))[0];
    if (!labelSourceQuestionId) {
      return null;
    }
    topics.push({
      topicId: buildTopicId(completeMembers, labelSourceQuestionId),
      confidence: entry.confidence,
      labelSourceQuestionId,
      members: completeMembers,
    });
  }

  const parsed = QaSemanticTopicSnapshotSchema.safeParse({
    version: QA_SEMANTIC_TOPIC_SNAPSHOT_VERSION,
    status: analysis.status,
    metric: analysis.metric,
    corpusRevision: input.corpusRevision,
    analyzedAt: analysis.generatedAt,
    analysisVersion: analysis.analysisVersion,
    model: {
      id: analysis.modelId,
      version: analysis.modelVersion,
    },
    eligibleQuestionCount: input.eligibleQuestionCount,
    analyzedQuestionCount: input.corpusItems.length,
    topics,
  });
  return parsed.success ? parsed.data : null;
}

export async function recordLatestQaSemanticTopicSnapshot(
  input: RecordLatestQaSemanticTopicSnapshotInput,
): Promise<QaSemanticTopicSnapshot | null> {
  const snapshot = buildQaSemanticTopicSnapshot(input);
  if (snapshot === null) {
    return null;
  }
  await input.cache.setLatestQaSemanticTopicSnapshot(snapshot, input.scope);
  return snapshot;
}
