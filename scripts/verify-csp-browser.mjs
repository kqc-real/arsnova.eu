#!/usr/bin/env node
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:3000';
const routes = ['/de/', '/en/help', '/de/quiz'];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const violations = [];
const pageErrors = [];

try {
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.info(
        `__ARSNOVA_CSP__${JSON.stringify({
          directive: event.effectiveDirective,
          blocked: event.blockedURI,
          disposition: event.disposition,
          source: event.sourceFile,
          line: event.lineNumber,
          sample: event.sample,
        })}`,
      );
    });
  });

  for (const route of routes) {
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(`${route}: ${error.message}`));
    page.on('console', (message) => {
      const text = message.text();
      if (!text.startsWith('__ARSNOVA_CSP__')) return;
      violations.push({ route, ...JSON.parse(text.slice('__ARSNOVA_CSP__'.length)) });
    });
    const response = await page.goto(`${base}${route}`, {
      waitUntil: 'networkidle',
      timeout: 20_000,
    });
    if (!response?.ok()) throw new Error(`${route}: HTTP ${response?.status() ?? 'ohne Response'}`);
    const reportOnly = response.headers()['content-security-policy-report-only'];
    const enforcement = response.headers()['content-security-policy'];
    if (!reportOnly || enforcement) {
      throw new Error(`${route}: unerwarteter CSP-Header-Scope`);
    }
    await page.waitForTimeout(500);
    await page.close();
  }

  const serviceWorkerPage = await context.newPage();
  serviceWorkerPage.on('pageerror', (error) =>
    pageErrors.push(`/de/ (Service Worker): ${error.message}`),
  );
  serviceWorkerPage.on('console', (message) => {
    const text = message.text();
    if (!text.startsWith('__ARSNOVA_CSP__')) return;
    violations.push({
      route: '/de/ (Service Worker)',
      ...JSON.parse(text.slice('__ARSNOVA_CSP__'.length)),
    });
  });
  await serviceWorkerPage.goto(`${base}/de/`, { waitUntil: 'networkidle', timeout: 20_000 });
  let workerScript = context
    .serviceWorkers()
    .find((worker) => worker.url().includes('/de/'))
    ?.url();
  if (!workerScript) {
    workerScript = (
      await context.waitForEvent('serviceworker', {
        predicate: (worker) => worker.url().includes('/de/'),
        timeout: 10_000,
      })
    ).url();
  }
  if (!workerScript.endsWith('/de/ngsw-worker.js')) {
    throw new Error(`Unerwarteter Service Worker: ${workerScript || 'keiner'}`);
  }
  const controlledNavigation = await serviceWorkerPage.reload({
    waitUntil: 'networkidle',
    timeout: 20_000,
  });
  if (
    !controlledNavigation?.fromServiceWorker() ||
    !controlledNavigation.headers()['content-security-policy-report-only']
  ) {
    throw new Error('Service-Worker-Navigation lieferte nicht den aktuellen Report-Only-Header');
  }

  if (pageErrors.length > 0) {
    throw new Error(`Browserfehler:\n${pageErrors.join('\n')}`);
  }
  if (violations.length > 0) {
    throw new Error(`CSP-Report-Only-Violations:\n${JSON.stringify(violations, null, 2)}`);
  }

  console.log(
    `CSP-Browser-Smoke bestanden: ${routes.length} Routen, Service Worker ${workerScript}, 0 Violations.`,
  );
} finally {
  await context.close();
  await browser.close();
}
