import { createHash } from 'node:crypto';
import {
  AbcdValueEnum,
  MoodValueEnum,
  ModerationPromptLimitationSchema,
  ModerationPromptSourceSchema,
  QuickFeedbackResultSchema,
  StarsValueEnum,
  TempoValueEnum,
  TrueFalseUnknownValueEnum,
  YesNoBinaryValueEnum,
  YesNoValueEnum,
  type ModerationAnalysisDomainContextV1,
  type ModerationPromptSource,
  type QuickFeedbackType,
} from '@arsnova/shared-types';
import { z } from 'zod';
import { getRedis } from '../redis';
import { buildQuickFeedbackSessionPurgeFenceKey } from './quickFeedbackSessionPurge';

const READ_SESSION_QUICK_FEEDBACK_LUA = `
-- QUICK_FEEDBACK_READ_MODERATION_SNAPSHOT
if redis.call('EXISTS', KEYS[2]) == 1 then
  return {'PURGED', ''}
end
local raw = redis.call('GET', KEYS[1])
if not raw then
  return {'MISSING', ''}
end
return {'OK', raw}
`;

type ModerationFeedbackSection = ModerationAnalysisDomainContextV1['feedback'];
type ModerationLimitation = ModerationAnalysisDomainContextV1['limitations'][number];
type ModerationSourceRevision = ModerationAnalysisDomainContextV1['meta']['revisions']['feedback'];

export type ModerationFeedbackRuleInput = {
  readonly type: QuickFeedbackType;
  readonly totalVotes: number;
  readonly distribution: Readonly<Record<string, number>>;
};

export type QuickFeedbackModerationProjection = {
  readonly feedback: ModerationFeedbackSection;
  readonly sources: readonly ModerationPromptSource[];
  readonly limitations: readonly ModerationLimitation[];
  readonly revision: ModerationSourceRevision;
  readonly fingerprint: string;
  readonly ruleInput: ModerationFeedbackRuleInput | null;
};

type RedisSnapshotReader = {
  eval(script: string, numberOfKeys: number, ...args: string[]): Promise<unknown>;
};

const RoundStartedAtSchema = z.string().datetime();

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function feedbackKey(code: string): string {
  return `qf:${code.trim().toUpperCase()}`;
}

function limitation(detail: string, code: 'module-unavailable' | 'source-redacted') {
  return ModerationPromptLimitationSchema.parse({
    code,
    section: 'feedback',
    detail,
  });
}

function unavailableProjection(input: {
  readonly reason: 'no-data' | 'not-collected' | 'not-supported';
  readonly detail: string;
  readonly fingerprint: string;
  readonly limitationCode?: 'module-unavailable' | 'source-redacted';
  readonly revision?: ModerationSourceRevision;
}): QuickFeedbackModerationProjection {
  return {
    feedback: { state: 'unavailable', reason: input.reason },
    sources: [],
    limitations: [limitation(input.detail, input.limitationCode ?? 'module-unavailable')],
    revision: input.revision ?? { state: 'unavailable', reason: input.reason },
    fingerprint: input.fingerprint,
    ruleInput: null,
  };
}

function validValues(type: QuickFeedbackType): readonly string[] {
  switch (type) {
    case 'MOOD':
      return MoodValueEnum.options;
    case 'YESNO':
      return YesNoValueEnum.options;
    case 'YESNO_BINARY':
      return YesNoBinaryValueEnum.options;
    case 'TRUEFALSE_UNKNOWN':
      return TrueFalseUnknownValueEnum.options;
    case 'STARS':
      return StarsValueEnum.options;
    case 'ABCD':
      return AbcdValueEnum.options;
    case 'TEMPO':
      return TempoValueEnum.options;
  }
}

function feedbackAggregation(
  type: Exclude<QuickFeedbackType, 'TEMPO'>,
  distribution: Readonly<Record<string, number>>,
): Extract<ModerationPromptSource, { kind: 'feedback-aggregate' }>['aggregation'] {
  switch (type) {
    case 'STARS':
      return {
        feedbackType: type,
        rule: 'rating-distribution',
        unit: 'votes',
        buckets: StarsValueEnum.options.map((value) => ({
          value,
          count: distribution[value] ?? 0,
        })),
      };
    case 'MOOD':
      return {
        feedbackType: type,
        rule: 'flashlight-distribution',
        unit: 'votes',
        buckets: MoodValueEnum.options.map((value) => ({
          value,
          count: distribution[value] ?? 0,
        })),
      };
    case 'YESNO':
      return {
        feedbackType: type,
        rule: 'flashlight-distribution',
        unit: 'votes',
        buckets: YesNoValueEnum.options.map((value) => ({
          value,
          count: distribution[value] ?? 0,
        })),
      };
    case 'YESNO_BINARY':
      return {
        feedbackType: type,
        rule: 'flashlight-distribution',
        unit: 'votes',
        buckets: YesNoBinaryValueEnum.options.map((value) => ({
          value,
          count: distribution[value] ?? 0,
        })),
      };
    case 'TRUEFALSE_UNKNOWN':
      return {
        feedbackType: type,
        rule: 'flashlight-distribution',
        unit: 'votes',
        buckets: TrueFalseUnknownValueEnum.options.map((value) => ({
          value,
          count: distribution[value] ?? 0,
        })),
      };
    case 'ABCD':
      return {
        feedbackType: type,
        rule: 'flashlight-distribution',
        unit: 'votes',
        buckets: AbcdValueEnum.options.map((value) => ({
          value,
          count: distribution[value] ?? 0,
        })),
      };
  }
}

function canonicalStoredSnapshot(input: {
  readonly sessionId: string;
  readonly roundStartedAt: string;
  readonly type: QuickFeedbackType;
  readonly totalVotes: number;
  readonly distribution: Readonly<Record<string, number>>;
}): string {
  return JSON.stringify({
    sessionId: input.sessionId,
    roundStartedAt: input.roundStartedAt,
    type: input.type,
    totalVotes: input.totalVotes,
    distribution: Object.fromEntries(
      Object.entries(input.distribution).sort(([left], [right]) => left.localeCompare(right)),
    ),
  });
}

function parseAtomicRead(result: unknown): { status: 'OK' | 'MISSING' | 'PURGED'; raw: string } {
  if (
    !Array.isArray(result) ||
    result.length !== 2 ||
    !['OK', 'MISSING', 'PURGED'].includes(String(result[0])) ||
    typeof result[1] !== 'string'
  ) {
    throw new Error('QUICK_FEEDBACK_MODERATION_SNAPSHOT_READ_FAILED');
  }
  return { status: String(result[0]) as 'OK' | 'MISSING' | 'PURGED', raw: result[1] };
}

function parseStoredSnapshot(input: {
  readonly raw: string;
  readonly sessionId: string;
  readonly observedAt: Date;
}):
  | {
      readonly success: true;
      readonly type: QuickFeedbackType;
      readonly totalVotes: number;
      readonly distribution: Readonly<Record<string, number>>;
      readonly roundStartedAt: string;
      readonly fingerprint: string;
    }
  | { readonly success: false; readonly fingerprint: string } {
  const invalid = { success: false as const, fingerprint: `feedback-invalid:${sha256(input.raw)}` };
  let decoded: unknown;
  try {
    decoded = JSON.parse(input.raw) as unknown;
  } catch {
    return invalid;
  }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return invalid;
  const record = decoded as Record<string, unknown>;
  if (
    record.sessionBound !== true ||
    record.sessionId !== input.sessionId ||
    record.participantVotesValidated !== true
  ) {
    return invalid;
  }
  const roundStartedAt = RoundStartedAtSchema.safeParse(record.roundStartedAt);
  const publicResult = QuickFeedbackResultSchema.safeParse(decoded);
  if (!roundStartedAt.success || !publicResult.success) return invalid;
  const startedAtMs = Date.parse(roundStartedAt.data);
  if (!Number.isFinite(startedAtMs) || startedAtMs > input.observedAt.getTime()) return invalid;

  const type = publicResult.data.type;
  const expectedValues = validValues(type);
  const actualKeys = Object.keys(publicResult.data.distribution).sort();
  if (
    actualKeys.length !== expectedValues.length ||
    actualKeys.some((key, index) => key !== [...expectedValues].sort()[index])
  ) {
    return invalid;
  }
  const distribution: Record<string, number> = {};
  for (const value of expectedValues) {
    const count = publicResult.data.distribution[value];
    if (!Number.isSafeInteger(count) || count < 0) return invalid;
    distribution[value] = count;
  }
  const totalVotes = publicResult.data.totalVotes;
  if (
    !Number.isSafeInteger(totalVotes) ||
    totalVotes < 0 ||
    Object.values(distribution).reduce((sum, count) => sum + count, 0) !== totalVotes
  ) {
    return invalid;
  }
  if (
    type !== 'TEMPO' &&
    (!Number.isSafeInteger(record.validatedParticipantVoteCount) ||
      record.validatedParticipantVoteCount !== totalVotes)
  ) {
    return invalid;
  }
  const material = canonicalStoredSnapshot({
    sessionId: input.sessionId,
    roundStartedAt: roundStartedAt.data,
    type,
    totalVotes,
    distribution,
  });
  return {
    success: true,
    type,
    totalVotes,
    distribution,
    roundStartedAt: roundStartedAt.data,
    fingerprint: `feedback-v1:${sha256(material)}`,
  };
}

/**
 * Reads one bounded, purge-fenced feedback record. TEMPO deliberately degrades:
 * exact host semantics require an unbounded choices hash and live presence set.
 */
export async function loadQuickFeedbackModerationSnapshot(input: {
  readonly sessionId: string;
  readonly sessionCode: string;
  readonly enabled: boolean;
  readonly eligibleResponses: number;
  readonly observedAt: Date;
  readonly redis?: RedisSnapshotReader;
}): Promise<QuickFeedbackModerationProjection> {
  if (!input.enabled) {
    const reason = 'Quick feedback is disabled for this session.';
    return {
      feedback: { state: 'disabled', reason },
      sources: [],
      limitations: [
        ModerationPromptLimitationSchema.parse({
          code: 'module-disabled',
          section: 'feedback',
          detail: reason,
        }),
      ],
      revision: { state: 'not-applicable', reason },
      fingerprint: 'feedback:disabled',
      ruleInput: null,
    };
  }

  const redis = input.redis ?? getRedis();
  const read = parseAtomicRead(
    await redis.eval(
      READ_SESSION_QUICK_FEEDBACK_LUA,
      2,
      feedbackKey(input.sessionCode),
      buildQuickFeedbackSessionPurgeFenceKey(input.sessionId),
    ),
  );
  if (read.status === 'MISSING') {
    return unavailableProjection({
      reason: 'no-data',
      detail: 'No current session-bound quick-feedback round is available.',
      fingerprint: 'feedback:missing',
    });
  }
  if (read.status === 'PURGED') {
    return unavailableProjection({
      reason: 'not-collected',
      detail: 'The session-bound quick-feedback round was removed by retention.',
      fingerprint: 'feedback:purged',
      limitationCode: 'source-redacted',
    });
  }

  const parsed = parseStoredSnapshot({
    raw: read.raw,
    sessionId: input.sessionId,
    observedAt: input.observedAt,
  });
  if (!parsed.success) {
    return unavailableProjection({
      reason: 'not-collected',
      detail:
        'The stored quick-feedback round is legacy, malformed, or belongs to another session.',
      fingerprint: parsed.fingerprint,
    });
  }
  if (
    !Number.isSafeInteger(input.eligibleResponses) ||
    input.eligibleResponses < 0 ||
    parsed.totalVotes > input.eligibleResponses
  ) {
    return unavailableProjection({
      reason: 'not-collected',
      detail: 'The feedback population exceeds the authorized session participant basis.',
      fingerprint: `feedback-invalid-population:${sha256(
        `${parsed.fingerprint}:${input.eligibleResponses}`,
      )}`,
    });
  }
  const fingerprint = `feedback-v1:${sha256(
    `${parsed.fingerprint}:eligible:${input.eligibleResponses}`,
  )}`;
  const revision = { state: 'available', value: fingerprint } as const;
  if (parsed.type === 'TEMPO') {
    return unavailableProjection({
      reason: 'not-supported',
      detail:
        'A bounded exact TEMPO population is unavailable without reading the unbounded live-choice set.',
      fingerprint,
      revision,
    });
  }

  const sourceId = `feedback-aggregate:${sha256(
    `${input.sessionId}:${parsed.type}:${parsed.roundStartedAt}`,
  )}`;
  const observedAt = new Date(
    Math.max(Date.parse(parsed.roundStartedAt), input.observedAt.getTime()),
  ).toISOString();
  const source = ModerationPromptSourceSchema.parse({
    id: sourceId,
    kind: 'feedback-aggregate',
    label: `Quick feedback ${parsed.type}`,
    scope: {
      channel: 'quickFeedback',
      timeWindow: { kind: 'interval', from: parsed.roundStartedAt, to: observedAt },
    },
    population: {
      kind: 'eligible-feedback-responses',
      eligible: input.eligibleResponses,
      included: parsed.totalVotes,
    },
    aggregation: feedbackAggregation(parsed.type, parsed.distribution),
  });
  return {
    feedback: { state: 'available', aggregates: [{ sourceId }] },
    sources: [source],
    limitations: [],
    revision,
    fingerprint,
    ruleInput: {
      type: parsed.type,
      totalVotes: parsed.totalVotes,
      distribution: parsed.distribution,
    },
  };
}

export const quickFeedbackModerationSnapshotInternals = {
  parseStoredSnapshot,
};
