/**
 * Formale tRPC-DoD-Evidenz für Vitest (ADR-0034 / Issue #222).
 *
 * Nur Aufrufe von `trpcDodIt` mit literal auswertbaren Metadaten zählen für das
 * Audit — und nur, wenn der Bezeichner aus diesem Modul gebunden ist.
 * Beliebige `it(...)`-Tests mit Caller-Aufrufen zählen nicht.
 */
import { it } from 'vitest';

/**
 * Repo-taugliche Fehlervertrags-Taxonomie.
 * Standardisierte tRPC-Codes plus semantisches `VALIDATION` und `DOMAIN:<name>`.
 * Single source for the TS helper; the audit extracts this array via AST.
 */
export const TRPC_DOD_KNOWN_CONTRACTS = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'BAD_REQUEST',
  'TIMEOUT',
  'PRECONDITION_FAILED',
  'PAYLOAD_TOO_LARGE',
  'TOO_MANY_REQUESTS',
  'CLIENT_CLOSED_REQUEST',
  'METHOD_NOT_SUPPORTED',
  'INTERNAL_SERVER_ERROR',
  'SERVICE_UNAVAILABLE',
  'PARSE_ERROR',
  /** Semantic input/schema validation contract (may surface as BAD_REQUEST at runtime). */
  'VALIDATION',
] as const;

export type TrpcDodKnownContract = (typeof TRPC_DOD_KNOWN_CONTRACTS)[number];
export type TrpcDodCase = 'happy' | 'error';
export type TrpcDodMode = 'direct' | 'indirect';

/** Named domain contracts use the prefix `DOMAIN:` (e.g. `DOMAIN:SESSION_ENDED`). */
export type TrpcDodContract = TrpcDodKnownContract | `DOMAIN:${string}`;

export interface TrpcDodEvidenceOptions {
  /** Stable procedure id, e.g. `session.create`. */
  procedure: string;
  case: TrpcDodCase;
  mode: TrpcDodMode;
  /** Required when `case === 'error'`. */
  contract?: TrpcDodContract;
  /** Required when `mode === 'indirect'`. */
  rationale?: string;
  /** Vitest title; also appears in the audit report. */
  title: string;
}

const PROCEDURE_ID = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+$/;
const KNOWN = new Set<string>(TRPC_DOD_KNOWN_CONTRACTS);

export function isTrpcDodContract(value: string): boolean {
  if (KNOWN.has(value)) return true;
  return /^DOMAIN:[A-Za-z][A-Za-z0-9_:-]*$/.test(value);
}

export function assertTrpcDodEvidenceOptions(options: TrpcDodEvidenceOptions): void {
  if (!options || typeof options !== 'object') {
    throw new Error('trpcDodIt: options object is required');
  }
  if (typeof options.procedure !== 'string' || !PROCEDURE_ID.test(options.procedure)) {
    throw new Error(
      `trpcDodIt: procedure must be a dotted id like "router.procedure" (got ${JSON.stringify(options.procedure)})`,
    );
  }
  if (options.case !== 'happy' && options.case !== 'error') {
    throw new Error(
      `trpcDodIt: case must be "happy" or "error" (got ${JSON.stringify(options.case)})`,
    );
  }
  if (options.mode !== 'direct' && options.mode !== 'indirect') {
    throw new Error(
      `trpcDodIt: mode must be "direct" or "indirect" (got ${JSON.stringify(options.mode)})`,
    );
  }
  if (typeof options.title !== 'string' || options.title.trim().length === 0) {
    throw new Error('trpcDodIt: title must be a non-empty string');
  }
  if (options.case === 'error') {
    if (typeof options.contract !== 'string' || options.contract.trim().length === 0) {
      throw new Error('trpcDodIt: contract is required for error evidence');
    }
    if (!isTrpcDodContract(options.contract)) {
      throw new Error(
        `trpcDodIt: contract must be a known code or DOMAIN:<name> (got ${JSON.stringify(options.contract)})`,
      );
    }
  } else if (options.contract !== undefined) {
    throw new Error('trpcDodIt: contract is only allowed for error evidence');
  }
  if (options.mode === 'indirect') {
    if (typeof options.rationale !== 'string' || options.rationale.trim().length === 0) {
      throw new Error('trpcDodIt: rationale is required for indirect evidence');
    }
  }
}

/**
 * Registers a formal DoD evidence test. The audit extracts the object-literal
 * metadata from call sites; keep fields as string/enum literals.
 */
export function trpcDodIt(options: TrpcDodEvidenceOptions, fn: () => void | Promise<void>): void {
  assertTrpcDodEvidenceOptions(options);
  it(options.title, fn);
}
