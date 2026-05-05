#!/usr/bin/env node
/**
 * Prüft den aktuellen lokalen Production-Serve:
 * - Root-Redirect-Seite auf /
 * - lokalisierte App unter /de/
 * - Compression und API-Erreichbarkeit
 *
 * Voraussetzung: Backend läuft (z. B. `npm run start:prod`).
 *
 * Aufruf: node scripts/verify-production-serving.mjs [BASE_URL]
 * Default BASE_URL: http://localhost:3000
 */
const base = process.argv[2] || 'http://localhost:3000';

function printCheck(label, ok, detail) {
  console.log(`${label}:`, ok ? '✓' : '✗', detail ? `(${detail})` : '');
}

async function fetchText(path) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    redirect: 'follow',
  });

  return {
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get('content-type') || '',
    encoding: res.headers.get('content-encoding') || '',
    text: await res.text(),
  };
}

async function fetchJson(path) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Accept-Encoding': 'gzip, deflate, br' },
  });

  return {
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get('content-type') || '',
    json: await res.json(),
  };
}

async function main() {
  console.log('Prüfe Production-Serve auf:', base);
  console.log('');

  try {
    const root = await fetchText('/');
    const locale = await fetchText('/de/');
    const api = await fetchJson(
      '/trpc/health.stats?batch=1&input=%7B%220%22%3A%7B%7D%7D',
    );

    console.log('Root /');
    printCheck('Status 200', root.ok, String(root.status));
    printCheck('Content-Type HTML', root.contentType.includes('text/html'), root.contentType);
    printCheck('Compression aktiv', Boolean(root.encoding), root.encoding || 'keine');
    printCheck(
      'Locale-Redirect-Hinweis',
      root.text.includes("location.replace('/" ) && root.text.includes('/de/'),
      'Root-Index leitet per Script auf Locale um',
    );
    printCheck(
      'Locale-Auswahl vorhanden',
      root.text.includes('<a href="/de/">') && root.text.includes('<a href="/en/">'),
      'noscript / manueller Fallback',
    );
    console.log('');

    console.log('Locale /de/');
    printCheck('Status 200', locale.ok, String(locale.status));
    printCheck(
      'Content-Type HTML',
      locale.contentType.includes('text/html'),
      locale.contentType,
    );
    printCheck('HTML lang=de', locale.text.includes('<html lang="de"'), 'de locale');
    printCheck('base href /de/', locale.text.includes('<base href="/de/">'), '/de/');
    printCheck('Angular app-root', locale.text.includes('<app-root'), 'SSR/SSG entry');
    printCheck(
      'Theme-CSS inline',
      locale.text.includes('--mat-sys-surface-container'),
      'critical theme tokens',
    );
    console.log('');

    console.log('API /trpc/health.stats');
    printCheck('Status 200', api.ok, String(api.status));
    printCheck(
      'Content-Type JSON',
      api.contentType.includes('application/json'),
      api.contentType,
    );
    const stats = Array.isArray(api.json) ? api.json[0]?.result?.data : null;
    printCheck(
      'ServerStatsDTO plausibel',
      Boolean(
        stats && typeof stats.serviceStatus === 'string' && typeof stats.loadStatus === 'string',
      ),
      stats ? `${stats.serviceStatus} / ${stats.loadStatus}` : 'keine Daten',
    );

    if (!root.ok || !locale.ok || !api.ok) {
      console.log(
        '\nHinweis: Mindestens ein Prüfschritt war nicht erfolgreich. Backend läuft und liefert dist/browser sowie /trpc korrekt aus?',
      );
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('Fehler:', e.message);
    console.log(
      '\nStelle sicher, dass das Backend läuft (z. B. npm run start:prod oder npm run build -w @arsnova/backend && NODE_ENV=production node apps/backend/dist/index.js).',
    );
    process.exitCode = 1;
  }
}

await main();
