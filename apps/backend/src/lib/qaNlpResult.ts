import type { QaNlpCategory, QaNlpResult, QaNlpStatus } from '@arsnova/shared-types';
import { QaNlpResultSchema } from '@arsnova/shared-types';
import { QA_NLP_STUB_MODEL_VERSION } from './qaNlpConfig';

export type QaNlpPersistStatus = 'PENDING' | 'CLASSIFIED' | 'UNCERTAIN' | 'DISABLED' | 'FAILED';
export type QaNlpPersistCategory = 'CONTENT' | 'ORGANIZATION' | 'TECHNICAL';

const STATUS_TO_DTO: Record<QaNlpPersistStatus, QaNlpStatus> = {
  PENDING: 'pending',
  CLASSIFIED: 'classified',
  UNCERTAIN: 'uncertain',
  DISABLED: 'disabled',
  FAILED: 'failed',
};

const STATUS_TO_PERSIST: Record<QaNlpStatus, QaNlpPersistStatus> = {
  pending: 'PENDING',
  classified: 'CLASSIFIED',
  uncertain: 'UNCERTAIN',
  disabled: 'DISABLED',
  failed: 'FAILED',
};

const CATEGORY_TO_DTO: Record<QaNlpPersistCategory, QaNlpCategory> = {
  CONTENT: 'content',
  ORGANIZATION: 'organization',
  TECHNICAL: 'technical',
};

const CATEGORY_TO_PERSIST: Record<QaNlpCategory, QaNlpPersistCategory> = {
  content: 'CONTENT',
  organization: 'ORGANIZATION',
  technical: 'TECHNICAL',
};

export type QaNlpStoredFields = {
  nlpStatus?: QaNlpPersistStatus | null;
  nlpCategory?: QaNlpPersistCategory | null;
  nlpConfidence?: number | null;
  nlpModelVersion?: string | null;
  nlpAnalyzedAt?: Date | null;
};

export function toQaNlpDtoStatus(status: QaNlpPersistStatus): QaNlpStatus {
  return STATUS_TO_DTO[status];
}

export function toQaNlpPersistStatus(status: QaNlpStatus): QaNlpPersistStatus {
  return STATUS_TO_PERSIST[status];
}

export function toQaNlpDtoCategory(
  category: QaNlpPersistCategory | null | undefined,
): QaNlpCategory | undefined {
  return category ? CATEGORY_TO_DTO[category] : undefined;
}

export function toQaNlpPersistCategory(
  category: QaNlpCategory | undefined,
): QaNlpPersistCategory | undefined {
  return category ? CATEGORY_TO_PERSIST[category] : undefined;
}

export function mapStoredQaNlpResult(fields: QaNlpStoredFields): QaNlpResult {
  let status = toQaNlpDtoStatus(fields.nlpStatus ?? 'DISABLED');
  const category = toQaNlpDtoCategory(fields.nlpCategory);
  if (status === 'classified' && category === undefined) {
    status = 'failed';
  }
  return QaNlpResultSchema.parse({
    status,
    ...(category ? { category } : {}),
    ...(typeof fields.nlpConfidence === 'number' ? { confidence: fields.nlpConfidence } : {}),
    ...(fields.nlpModelVersion ? { modelVersion: fields.nlpModelVersion } : {}),
    ...(fields.nlpAnalyzedAt ? { analyzedAt: fields.nlpAnalyzedAt.toISOString() } : {}),
  });
}

export function createPendingQaNlpResult(): QaNlpResult {
  return QaNlpResultSchema.parse({ status: 'pending' });
}

export function createStubUnclassifiedQaNlpResult(analyzedAt = new Date()): QaNlpResult {
  return QaNlpResultSchema.parse({
    status: 'disabled',
    modelVersion: QA_NLP_STUB_MODEL_VERSION,
    analyzedAt: analyzedAt.toISOString(),
  });
}

export function createFailedQaNlpResult(
  reason: 'timeout' | 'queue-limit' | 'error' = 'error',
  analyzedAt = new Date(),
): QaNlpResult {
  return QaNlpResultSchema.parse({
    status: 'failed',
    modelVersion: `${QA_NLP_STUB_MODEL_VERSION}:${reason}`,
    analyzedAt: analyzedAt.toISOString(),
  });
}

export function toQaNlpPersistFields(result: QaNlpResult): {
  nlpStatus: QaNlpPersistStatus;
  nlpCategory: QaNlpPersistCategory | null;
  nlpConfidence: number | null;
  nlpModelVersion: string | null;
  nlpAnalyzedAt: Date | null;
} {
  return {
    nlpStatus: toQaNlpPersistStatus(result.status),
    nlpCategory: toQaNlpPersistCategory(result.category) ?? null,
    nlpConfidence: result.confidence ?? null,
    nlpModelVersion: result.modelVersion ?? null,
    nlpAnalyzedAt: result.analyzedAt ? new Date(result.analyzedAt) : null,
  };
}
