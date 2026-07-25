import type { RequestHandler, Response } from 'express';

export const CSP_REPORT_ONLY_HEADER = 'Content-Security-Policy-Report-Only';

/**
 * Beobachtungspolicy für den aktuellen Angular-Produktionsbuild.
 *
 * `unsafe-inline` bei Scripts ist vorerst erforderlich, weil `index.html` zwei
 * frühe Inline-Bootscripts und der Font-Preload einen Inline-onload-Handler
 * enthält. Zod 4 kompiliert optimierte Validatoren über `Function`, daher ist
 * `unsafe-eval` im aktuellen Build ebenfalls beobachtet. Styles benötigen
 * `unsafe-inline` für Angular Material, KaTeX und die Inline-LCP-Shell. Das ist
 * bewusst nur Report-Only; Nonces/Hashes und eine spätere
 * Enforcement-Entscheidung sind nicht Teil von W2.4b.
 */
export const CSP_REPORT_ONLY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "script-src-elem 'self' 'unsafe-inline'",
  "script-src-attr 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'self' blob:",
  "media-src 'self' blob:",
  'report-uri /csp-report',
].join('; ');

export function isCspReportOnlyEnabled(value: string | undefined): boolean {
  return value === 'true';
}

function isExcludedPath(path: string): boolean {
  return (
    path === '/csp-report' ||
    path.startsWith('/csp-report/') ||
    path === '/trpc' ||
    path.startsWith('/trpc/')
  );
}

function isHtmlDocumentResponse(method: string, response: Response): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (response.statusCode < 200 || response.statusCode >= 300 || response.statusCode === 204) {
    return false;
  }
  const contentType = response.getHeader('Content-Type');
  return typeof contentType === 'string' && contentType.toLowerCase().startsWith('text/html');
}

/**
 * Setzt Report-Only spät beim Schreiben der Response-Header. Damit entscheidet
 * der tatsächliche Response-Content-Type und nicht ein attacker-kontrollierter
 * Accept-Header über den Scope.
 */
export function createCspReportOnlyMiddleware(
  enabled = isCspReportOnlyEnabled(process.env['CSP_REPORT_ONLY_ENABLED']),
): RequestHandler {
  if (!enabled) return (_req, _res, next) => next();

  return (req, res, next) => {
    if (isExcludedPath(req.path)) {
      next();
      return;
    }

    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = ((...args: Parameters<Response['writeHead']>) => {
      if (
        isHtmlDocumentResponse(req.method, res) &&
        !res.hasHeader(CSP_REPORT_ONLY_HEADER) &&
        !res.hasHeader('Content-Security-Policy')
      ) {
        res.setHeader(CSP_REPORT_ONLY_HEADER, CSP_REPORT_ONLY_POLICY);
      }
      return originalWriteHead(...args);
    }) as Response['writeHead'];
    next();
  };
}
