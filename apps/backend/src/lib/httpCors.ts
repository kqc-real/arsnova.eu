import cors from 'cors';
import type { RequestHandler } from 'express';

const MAX_ORIGIN_LENGTH = 256;
const DEV_ALLOWED_ORIGINS = new Set([
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://[::1]:4200',
]);

const DEV_ALLOWED_HEADERS = [
  'Content-Type',
  'X-Host-Token',
  'X-Admin-Token',
  'X-Feedback-Host-Token',
  'X-Admin-Diagnostic-Secret',
];

/**
 * Browser-Origin-Header streng gegen seine kanonische URL-Origin prüfen.
 * Dadurch werden u. a. Userinfo, Pfade, abweichende Ports und normalisierte
 * Schreibweisen nicht versehentlich als exakter Allowlist-Treffer akzeptiert.
 */
function isAllowedDevOrigin(origin: string): boolean {
  if (origin === 'null' || origin.length > MAX_ORIGIN_LENGTH) return false;
  try {
    const parsed = new URL(origin);
    return (
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.origin === origin &&
      DEV_ALLOWED_ORIGINS.has(parsed.origin)
    );
  } catch {
    return false;
  }
}

/**
 * Produktion ist eine reine Same-Origin-Auslieferung und installiert deshalb
 * keine CORS-Middleware. Requests ohne Origin (CLI, Healthchecks, Lasttests)
 * bleiben davon unberührt. Nur Angular-Dev auf :4200 erhält eine enge Freigabe.
 */
export function createHttpCorsMiddleware(nodeEnv = process.env['NODE_ENV']): RequestHandler | null {
  if (nodeEnv !== 'development') return null;

  return cors({
    origin(origin, callback) {
      callback(null, origin === undefined || isAllowedDevOrigin(origin));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: DEV_ALLOWED_HEADERS,
    credentials: false,
    optionsSuccessStatus: 204,
  });
}
