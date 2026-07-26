/**
 * Cutover-Policy für content-abgeleitete Legacy-`accessProof`s (SHA-256-Hex).
 *
 * Nach erfolgreichem Bind (`historyScopeId`) ist die Capability die Scope-UUID.
 * Legacy-Hex darf Historien-Endpunkte nicht mehr öffnen. `bindQuizHistoryScope`
 * akzeptiert Legacy auf gebundenen Kopien nur bis zum Cutoff, damit Clients ihren
 * lokalen Proof einmalig auf die UUID migrieren können.
 */

export const DEFAULT_QUIZ_HISTORY_LEGACY_PROOF_CUTOFF_AT = '2026-09-01T00:00:00.000Z';

const LEGACY_QUIZ_HISTORY_ACCESS_PROOF_REGEX = /^[a-f0-9]{64}$/i;

export function getQuizHistoryLegacyProofCutoffAt(env: NodeJS.ProcessEnv = process.env): Date {
  const raw = env.QUIZ_HISTORY_LEGACY_PROOF_CUTOFF_AT?.trim();
  if (raw) {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) {
      return new Date(parsed);
    }
  }
  return new Date(DEFAULT_QUIZ_HISTORY_LEGACY_PROOF_CUTOFF_AT);
}

export function isQuizHistoryLegacyProofCutoffReached(
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return now.getTime() >= getQuizHistoryLegacyProofCutoffAt(env).getTime();
}

export function isLegacyQuizHistoryAccessProof(proof: string): boolean {
  return LEGACY_QUIZ_HISTORY_ACCESS_PROOF_REGEX.test(proof.trim());
}

/** Legacy nach Bind nur noch für die einmalige Bind-/Upgrade-Mutation bis Cutoff. */
export function allowLegacyQuizHistoryProofAfterBind(options: {
  purpose: 'history' | 'bind';
  now?: Date;
  env?: NodeJS.ProcessEnv;
}): boolean {
  if (options.purpose !== 'bind') {
    return false;
  }
  return !isQuizHistoryLegacyProofCutoffReached(options.now, options.env);
}
