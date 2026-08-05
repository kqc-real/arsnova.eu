import { describe, expect, it } from 'vitest';
import {
  assertTrpcDodEvidenceOptions,
  isTrpcDodContract,
  TRPC_DOD_KNOWN_CONTRACTS,
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
      assertTrpcDodEvidenceOptions(
        base({ case: 'error', contract: 'whatever' as TrpcDodEvidenceOptions['contract'] }),
      ),
    ).toThrow(/contract/i);
  });

  it('accepts expanded tRPC codes and DOMAIN contracts', () => {
    expect(TRPC_DOD_KNOWN_CONTRACTS).toContain('BAD_REQUEST');
    expect(TRPC_DOD_KNOWN_CONTRACTS).toContain('TOO_MANY_REQUESTS');
    expect(isTrpcDodContract('DOMAIN:SESSION_ENDED')).toBe(true);
    expect(() =>
      assertTrpcDodEvidenceOptions(
        base({ case: 'error', contract: 'TOO_MANY_REQUESTS', title: 'rate limit' }),
      ),
    ).not.toThrow();
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
