/**
 * Wartet auf ein erreichbares Backend via tRPC health.check (nicht /health — SPA-Fallback).
 */
export function buildHealthCheckUrl(trpcUrl) {
  const base = String(trpcUrl || 'http://127.0.0.1:3000/trpc')
    .trim()
    .replace(/\/$/, '');
  return `${base}/health.check`;
}

export async function waitForBackend(trpcUrl, options = {}) {
  const healthUrl = buildHealthCheckUrl(trpcUrl);
  const attempts = Math.max(1, Number(options.attempts ?? 40));
  const delayMs = Math.max(100, Number(options.delayMs ?? 500));

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) return;
    } catch {
      // Backend not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`Backend unter ${healthUrl} ist nicht erreichbar.`);
}
