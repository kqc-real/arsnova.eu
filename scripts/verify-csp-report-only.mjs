#!/usr/bin/env node

const base = process.argv[2] || 'http://localhost:3000';
const expectEnabled = process.env.CSP_SMOKE_EXPECT_ENABLED !== 'false';
const reportOnlyHeader = 'content-security-policy-report-only';
const enforcementHeader = 'content-security-policy';

let failures = 0;

function check(label, condition, detail = '') {
  console.log(`${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures += 1;
}

function cspHeaders(response) {
  return {
    reportOnly: response.headers.get(reportOnlyHeader),
    enforcement: response.headers.get(enforcementHeader),
  };
}

function checkNoCsp(label, response) {
  const headers = cspHeaders(response);
  check(`${label}: kein Report-Only`, headers.reportOnly === null, headers.reportOnly ?? '');
  check(`${label}: kein Enforcement`, headers.enforcement === null, headers.enforcement ?? '');
}

async function request(path, init) {
  return fetch(`${base}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
    ...init,
  });
}

async function main() {
  console.log(`Prüfe W2.4b-Header-Scope auf ${base} (enabled=${expectEnabled})`);

  const html = await request('/de/');
  check('HTML Status 200', html.status === 200, String(html.status));
  check('HTML Content-Type', html.headers.get('content-type')?.startsWith('text/html') === true);
  const htmlHeaders = cspHeaders(html);
  check('Kein Enforcement-Header', htmlHeaders.enforcement === null);

  if (expectEnabled) {
    const policy = htmlHeaders.reportOnly ?? '';
    check('Genau ein Report-Only-Header', policy.length > 0 && !policy.includes(','));
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "script-src-attr 'unsafe-inline'",
      "connect-src 'self' wss:",
      "worker-src 'self' blob:",
      'report-uri /csp-report',
    ]) {
      check(`Policy enthält ${directive}`, policy.includes(directive));
    }
    check('report-uri genau einmal', policy.split('report-uri /csp-report').length === 2, policy);
  } else {
    check('Rollback entfernt Report-Only', htmlHeaders.reportOnly === null);
  }

  const htmlBody = await html.text();
  const jsPath = htmlBody.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
  const cssPath = htmlBody.match(/<link[^>]+href="([^"]+\.css)"/)?.[1];
  check('Produktions-JS im HTML gefunden', typeof jsPath === 'string');
  check('Produktions-CSS im HTML gefunden', typeof cssPath === 'string');

  const assetUrl = (assetPath) => new URL(assetPath, `${base}/de/`).pathname;
  const staticPaths = [
    '/de/manifest.webmanifest',
    '/de/ngsw-worker.js',
    ...(jsPath ? [assetUrl(jsPath)] : []),
    ...(cssPath ? [assetUrl(cssPath)] : []),
  ];
  for (const path of staticPaths) {
    const response = await request(path);
    check(`${path}: erreichbar`, response.ok, String(response.status));
    checkNoCsp(path, response);
  }

  const api = await request('/trpc/health.check');
  check('/trpc/health.check: kein HTML', !api.headers.get('content-type')?.startsWith('text/html'));
  checkNoCsp('/trpc/health.check', api);

  const report = await request('/csp-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/csp-report' },
    body: JSON.stringify({
      'csp-report': { 'effective-directive': 'script-src', 'blocked-uri': 'inline' },
    }),
  });
  check('/csp-report: 204', report.status === 204, String(report.status));
  checkNoCsp('/csp-report', report);

  if (failures > 0) {
    throw new Error(`${failures} CSP-Header-Prüfung(en) fehlgeschlagen`);
  }
}

await main();
