/**
 * Standalone-Q&A wird bei session.create bereits eingerichtet.
 * INITIAL-Preview/Configure darf dann CONFLICT liefern und wird übersprungen.
 */
export function isQaAlreadyConfiguredError(error) {
  const message = String(error?.message ?? error ?? '');
  const code = error?.data?.code ?? error?.shape?.data?.code;
  return code === 'CONFLICT' || /bereits eingerichtet/i.test(message);
}

export async function configureQaSessionIfNeeded(hostTrpc, code, extras = {}) {
  const selection = extras.selection ?? { kind: 'UNTIL_SESSION_END' };
  try {
    const preview = await hostTrpc.session.previewQaConfiguration.query({
      code,
      mode: extras.mode ?? 'INITIAL',
      selection,
    });
    extras.observePreview?.(preview);
    const configured = await hostTrpc.session.configureQaChannel.mutate({
      code,
      mode: preview.mode,
      selection,
      expectedLifecycleRevision: preview.expectedLifecycleRevision,
      previewServerNow: preview.serverNow,
      confirmedQaClosesAt: preview.newQaClosesAt,
      confirmedExpiresAt: preview.newExpiresAt,
      confirmSessionExtension: preview.requiresSessionExtension,
      qaTitle: extras.qaTitle,
      moderationMode: extras.moderationMode ?? false,
      participationProfile: extras.participationProfile ?? {
        identityMode: 'CUSTOM_NICKNAME',
        nicknameTheme: 'HIGH_SCHOOL',
      },
    });
    extras.observeConfigured?.(configured);
    return configured;
  } catch (error) {
    if (!isQaAlreadyConfiguredError(error)) throw error;
    const lifecycle = await hostTrpc.session.getLifecycleForHost.query({ code });
    extras.observeConfigured?.(lifecycle);
    return lifecycle;
  }
}
