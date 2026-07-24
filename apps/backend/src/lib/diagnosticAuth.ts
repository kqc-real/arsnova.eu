import { createHash, timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';

export const ADMIN_DIAGNOSTIC_SECRET_MIN_LENGTH = 32;
export const DIAGNOSTIC_AUTH_FAILURE_LIMIT = 30;
const DIAGNOSTIC_AUTH_FAILURE_WINDOW_MS = 60_000;

let failureWindowStartedAtMs = 0;
let failuresInWindow = 0;

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function equalSecret(left: string, right: string): boolean {
  return timingSafeEqual(digest(left), digest(right));
}

function configuredDiagnosticSecret(): string | null {
  const diagnosticSecret = process.env['ADMIN_DIAGNOSTIC_SECRET']?.trim() ?? '';
  if (diagnosticSecret.length < ADMIN_DIAGNOSTIC_SECRET_MIN_LENGTH) return null;

  const adminSecret = process.env['ADMIN_SECRET']?.trim() ?? '';
  if (adminSecret && equalSecret(diagnosticSecret, adminSecret)) return null;
  return diagnosticSecret;
}

export function extractAdminDiagnosticSecret(req?: IncomingMessage): string | null {
  if (!req) return null;
  const direct = req.headers['x-admin-diagnostic-secret'];
  if (typeof direct !== 'string' || direct.trim().length === 0) return null;
  return direct.trim();
}

/** Fail-closed bei fehlender, zu kurzer oder mit ADMIN_SECRET identischer Konfiguration. */
export function verifyAdminDiagnosticSecret(candidateSecret: string): boolean {
  const configured = configuredDiagnosticSecret();
  if (!configured) return false;
  return equalSecret(configured, candidateSecret.trim());
}

/**
 * Globales, speicher-konstantes Fehlerbudget. Korrekte Secrets werden vor diesem
 * Gate geprüft und deshalb auch bei ausgeschöpftem Budget niemals gesperrt.
 */
export function consumeDiagnosticAuthFailure(nowMs: number = Date.now()): boolean {
  if (
    failureWindowStartedAtMs === 0 ||
    nowMs - failureWindowStartedAtMs >= DIAGNOSTIC_AUTH_FAILURE_WINDOW_MS
  ) {
    failureWindowStartedAtMs = nowMs;
    failuresInWindow = 0;
  }
  if (failuresInWindow >= DIAGNOSTIC_AUTH_FAILURE_LIMIT) return false;
  failuresInWindow += 1;
  return true;
}

export function resetDiagnosticAuthForTests(): void {
  failureWindowStartedAtMs = 0;
  failuresInWindow = 0;
}
