export interface QuickFeedbackLockVersionState {
  lockVersion?: number;
}

/** Erhöht den monotonen Sperrstatus-Stand; alte Redis-Datensätze beginnen bei null. */
export function advanceQuickFeedbackLockVersion(state: QuickFeedbackLockVersionState): number {
  const lockVersion = (state.lockVersion ?? 0) + 1;
  state.lockVersion = lockVersion;
  return lockVersion;
}
