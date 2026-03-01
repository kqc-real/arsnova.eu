#!/usr/bin/env node
/**
 * Prüft, ob LCP-Shell, Gzip und Backend-Fallback beim Aufruf von / geladen werden.
 * Voraussetzung: Backend läuft (z. B. NODE_ENV=production node apps/backend/dist/index.js).
 *
 * Aufruf: node scripts/verify-production-serving.mjs [BASE_URL]
 * Default BASE_URL: http://localhost:3000
 */
const base = process.argv[2] || 'http://localhost:3000';

async function main() {
  const url = `${base}/`;
  console.log('Prüfe:', url);
  console.log('');

  try {
    const res = await fetch(url, {
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
      redirect: 'follow',
    });

    const encoding = res.headers.get('content-encoding');
    const contentType = res.headers.get('content-type');
    const ok = res.ok;

    console.log('Status:', res.status, ok ? '✓' : '✗');
    console.log('Content-Type:', contentType || '(nicht gesetzt)');
    console.log('Content-Encoding:', encoding || '(keine – keine Komprimierung)');
    console.log('');

    const html = await res.text();

    const hasLcpShell =
      html.includes('app-shell') &&
      html.includes('LCP-Shell') &&
      html.includes('arsnova.click');
    console.log('LCP-Shell im HTML:', hasLcpShell ? '✓' : '✗');
    if (!hasLcpShell) {
      console.log('  Erwartet: <div class="app-shell" …> und "arsnova.click" im Body.');
    }

    const hasCriticalCss = html.includes('--mat-sys-surface-container');
    console.log('Critical CSS (Theme) im HTML:', hasCriticalCss ? '✓' : '✗');

    const hasAppRoot = html.includes('<app-root>');
    console.log('<app-root> vorhanden:', hasAppRoot ? '✓' : '✗');

    if (!ok) {
      console.log('\nHinweis: Request war nicht erfolgreich. Backend läuft und liefert dist/browser aus?');
    }
    if (!encoding && ok) {
      console.log('\nHinweis: Keine Content-Encoding. Backend nutzt compression()-Middleware?');
    }
  } catch (e) {
    console.error('Fehler:', e.message);
    console.log('\nStelle sicher, dass das Backend läuft (z. B. npm run build -w @arsnova/backend && NODE_ENV=production node apps/backend/dist/index.js).');
  }
}

main();
