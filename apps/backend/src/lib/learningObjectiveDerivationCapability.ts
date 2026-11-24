import type {
  PrepareLearningObjectiveDerivationInput,
  PrepareLearningObjectiveDerivationOutput,
  RunLearningObjectiveDerivationInput,
} from '@arsnova/shared-types';
import {
  LearningObjectiveDerivationCapabilitySchema,
  PrepareLearningObjectiveDerivationOutputSchema,
} from '@arsnova/shared-types';
import { getRedis } from '../redis';
import { createOpaqueCapability, hashCapability } from './capabilityCrypto';
import { LEARNING_OBJECTIVE_DERIVATION_OVERALL_TIMEOUT_MS } from './learningObjectiveDerivation';
import { isOpenWeightLlmPriorityEnabled } from './openWeightLlmPriority';

export const LEARNING_OBJECTIVE_DERIVATION_CAPABILITY_TTL_SECONDS = 5 * 60;

const CAPABILITY_PREFIX = 'learning-objective-derivation:capability:v1:';
const RESERVATION_PREFIX = 'learning-objective-derivation:reservation:v1:';
const OPERATION_PREFIX = 'learning-objective-derivation:operation:v1:';
const StoredCapabilitySchema = PrepareLearningObjectiveDerivationOutputSchema.omit({
  capability: true,
}).strict();

const RESERVE_CAPABILITY_SCRIPT = `
local stored = redis.call('GET', KEYS[1])
if stored == false or stored ~= ARGV[1] then
  return 0
end

if KEYS[3] and redis.call('EXISTS', KEYS[3]) == 1 then return 0 end
local reserved = redis.call('SET', KEYS[2], '1', 'EX', ARGV[2], 'NX')
if reserved == false then
  return 0
end

if KEYS[3] then redis.call('SET', KEYS[3], '1', 'EX', ARGV[2]) end
redis.call('DEL', KEYS[1])
return 1
`;

type CapabilityBinding = Pick<
  RunLearningObjectiveDerivationInput,
  'schemaVersion' | 'operationId' | 'quizId' | 'expectedBundleRevision' | 'capability'
>;

function capabilityKey(capabilityHash: string): string {
  return `${CAPABILITY_PREFIX}${capabilityHash}`;
}

function reservationKey(capabilityHash: string): string {
  return `${RESERVATION_PREFIX}${capabilityHash}`;
}

function hasExpectedBinding(
  stored: Omit<PrepareLearningObjectiveDerivationOutput, 'capability'>,
  expected: CapabilityBinding,
): boolean {
  return (
    stored.schemaVersion === expected.schemaVersion &&
    stored.operationId === expected.operationId &&
    stored.quizId === expected.quizId &&
    stored.expectedBundleRevision === expected.expectedBundleRevision
  );
}

/**
 * Issues a short-lived CPU-work capability. Redis sees only its SHA-256 hash;
 * the raw bearer is returned exactly once to the caller.
 */
export async function issueLearningObjectiveDerivationCapability(
  binding: PrepareLearningObjectiveDerivationInput,
): Promise<PrepareLearningObjectiveDerivationOutput> {
  const redis = getRedis();
  const expiresAt = new Date(
    Date.now() + LEARNING_OBJECTIVE_DERIVATION_CAPABILITY_TTL_SECONDS * 1000,
  ).toISOString();
  const stored = StoredCapabilitySchema.parse({ ...binding, expiresAt });

  // A SHA-256 collision is not expected, but NX makes issuance fail closed and
  // retries with fresh entropy instead of replacing another live capability.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const capability = LearningObjectiveDerivationCapabilitySchema.parse(createOpaqueCapability());
    const capabilityHash = hashCapability(capability);
    const written = await redis.set(
      capabilityKey(capabilityHash),
      JSON.stringify(stored),
      'EX',
      LEARNING_OBJECTIVE_DERIVATION_CAPABILITY_TTL_SECONDS,
      'NX',
    );
    if (written === 'OK') {
      return PrepareLearningObjectiveDerivationOutputSchema.parse({ ...stored, capability });
    }
  }
  throw new Error('LEARNING_OBJECTIVE_DERIVATION_CAPABILITY_ISSUE_FAILED');
}

/**
 * Reserves and consumes the bearer atomically before model-backed work starts.
 * The Lua compare closes the delayed-reader race: a request that read the old
 * payload before another request consumed it cannot recreate a reservation
 * after finalize. Missing, expired, replayed, corrupt, or differently bound
 * values are all rejected without revealing which check failed.
 */
export async function reserveLearningObjectiveDerivationCapability(
  expected: CapabilityBinding,
): Promise<boolean> {
  const parsedCapability = LearningObjectiveDerivationCapabilitySchema.safeParse(
    expected.capability,
  );
  if (!parsedCapability.success) return false;

  const redis = getRedis();
  const capabilityHash = hashCapability(parsedCapability.data);
  const raw = await redis.get(capabilityKey(capabilityHash));
  if (!raw) return false;

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return false;
  }
  const stored = StoredCapabilitySchema.safeParse(decoded);
  if (
    !stored.success ||
    Date.parse(stored.data.expiresAt) <= Date.now() ||
    !hasExpectedBinding(stored.data, expected)
  ) {
    return false;
  }

  const priorityEnabled = isOpenWeightLlmPriorityEnabled();
  const keys = [capabilityKey(capabilityHash), reservationKey(capabilityHash)];
  if (priorityEnabled) {
    const operation = JSON.stringify([
      expected.quizId,
      expected.operationId,
      expected.expectedBundleRevision,
    ]);
    keys.push(`${OPERATION_PREFIX}${hashCapability(operation)}`);
  }
  const reserved = await redis.eval(
    RESERVE_CAPABILITY_SCRIPT,
    keys.length,
    ...keys,
    raw,
    String(
      priorityEnabled
        ? Math.ceil(LEARNING_OBJECTIVE_DERIVATION_OVERALL_TIMEOUT_MS / 1000) + 15
        : LEARNING_OBJECTIVE_DERIVATION_CAPABILITY_TTL_SECONDS,
    ),
  );
  return Number(reserved) === 1;
}

export async function isLearningObjectiveDerivationReserved(capability: string): Promise<boolean> {
  return (await getRedis().exists(reservationKey(hashCapability(capability)))) === 1;
}

/** Removes the TTL-bound reservation tombstone after success, failure, or abort. */
export async function finalizeLearningObjectiveDerivationCapability(
  capability: string,
): Promise<void> {
  const parsed = LearningObjectiveDerivationCapabilitySchema.safeParse(capability);
  if (!parsed.success) return;
  const redis = getRedis();
  const capabilityHash = hashCapability(parsed.data);
  await redis.del(capabilityKey(capabilityHash), reservationKey(capabilityHash));
}
