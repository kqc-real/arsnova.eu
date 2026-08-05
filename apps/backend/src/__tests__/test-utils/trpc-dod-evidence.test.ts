import { describe, expect, it } from 'vitest';
import {
  assertTrpcDodEvidenceOptions,
  isTrpcDodContract,
  type TrpcDodEvidenceOptions,
} from './trpc-dod-evidence';

function base(overrides: Partial<TrpcDodEvidenceOptions> = {}): TrpcDodEvidenceOptions {
  return {
    procedure: 'dodPoc.ping',
    case: 'happy',
    mode: 'direct',
    title: 'example',
    ...overrides,
  };
}

describe('trpcDodEvidence options', () => {
  it('accepts happy direct evidence', () => {
    expect(() => assertTrpcDodEvidenceOptions(base())).not.toThrow();
  });

  it('requires contract for error evidence', () => {
    expect(() => assertTrpcDodEvidenceOptions(base({ case: 'error' }))).toThrow(/contract/i);
  });

  it('rejects meaningless error contracts', () => {
    expect(() =>
      assertTrpcDodEvidenceOptions(base({ case: 'error', contract: 'whatever' })),
    ).toThrow(/contract/i);
  });

  it('accepts DOMAIN contracts', () => {
    expect(isTrpcDodContract('DOMAIN:SESSION_ENDED')).toBe(true);
    expect(() =>
      assertTrpcDodEvidenceOptions(
        base({ case: 'error', contract: 'DOMAIN:SESSION_ENDED', title: 'domain error' }),
      ),
    ).not.toThrow();
  });

  it('requires rationale for indirect evidence', () => {
    expect(() => assertTrpcDodEvidenceOptions(base({ mode: 'indirect' }))).toThrow(/rationale/i);
  });

  it('rejects contract on happy evidence', () => {
    expect(() => assertTrpcDodEvidenceOptions(base({ contract: 'VALIDATION' }))).toThrow(
      /only allowed for error/i,
    );
  });
});
