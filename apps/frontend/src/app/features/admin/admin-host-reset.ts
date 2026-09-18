import type {
  AdminResetSessionHostAccessOutput,
  HostResetEvidenceCategory,
} from '@arsnova/shared-types';
import {
  isRecoveryNetworkError,
  readRecoveryErrorCode,
} from '../session/host-recovery/host-recovery-errors';

export type AdminHostResetDraft = {
  evidenceCategory: HostResetEvidenceCategory | '';
  requester: string;
  authorization: string;
  supportCase: string;
  reason: string;
  operationId: string;
  phase: 'form' | 'confirm' | 'result';
  confirmNewReset: boolean;
  touched: boolean;
  unconfirmed: boolean;
  error: string | null;
  result: AdminResetSessionHostAccessOutput | null;
};

export type AdminHostResetErrorKind = 'unconfirmed' | 'precondition' | 'rejected';

export const EMPTY_ADMIN_HOST_RESET_DRAFT: AdminHostResetDraft = {
  evidenceCategory: '',
  requester: '',
  authorization: '',
  supportCase: '',
  reason: '',
  operationId: '',
  phase: 'form',
  confirmNewReset: false,
  touched: false,
  unconfirmed: false,
  error: null,
  result: null,
};

export function createAdminHostResetDraft(
  overrides: Partial<AdminHostResetDraft> = {},
): AdminHostResetDraft {
  return {
    evidenceCategory: '',
    requester: '',
    authorization: '',
    supportCase: '',
    reason: '',
    operationId: crypto.randomUUID(),
    phase: 'form',
    confirmNewReset: false,
    touched: false,
    unconfirmed: false,
    error: null,
    result: null,
    ...overrides,
  };
}

export function classifyAdminHostResetError(error: unknown): AdminHostResetErrorKind {
  const code = readRecoveryErrorCode(error);
  if (code === 'PRECONDITION_FAILED') return 'precondition';
  if (
    code === 'BAD_REQUEST' ||
    code === 'NOT_FOUND' ||
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN'
  ) {
    return 'rejected';
  }
  if (isRecoveryNetworkError(error) || !code) return 'unconfirmed';
  return 'unconfirmed';
}

export function isHostResetEvidenceCategory(value: string): value is HostResetEvidenceCategory {
  return (
    value === 'PREEXISTING_VERIFIED_SUPPORT_CASE' ||
    value === 'INDEPENDENT_OFFICIAL_ORGANIZATION_CONFIRMATION'
  );
}
