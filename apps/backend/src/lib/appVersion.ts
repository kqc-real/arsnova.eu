const FALLBACK_APP_VERSION = '0.1.0';

/** Stabile Releasekennung; Clientwert dient nur alten Deployments als Fallback. */
export function resolveAppVersion(clientVersion?: string | null): string {
  return (
    process.env['APP_VERSION']?.trim().slice(0, 64) ||
    process.env['GITHUB_SHA']?.trim().slice(0, 12) ||
    clientVersion?.trim().slice(0, 64) ||
    FALLBACK_APP_VERSION
  );
}
