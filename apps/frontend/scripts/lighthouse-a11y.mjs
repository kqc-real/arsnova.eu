#!/usr/bin/env node
/**
 * Führt Lighthouse nur für Accessibility aus (Backlog DoD: ≥ 90).
 * Startet bei fehlender LIGHTHOUSE_URL einen lokalen Serve aus dist/browser.
 *
 * Run: npm run lighthouse:a11y
 * Oder: LIGHTHOUSE_URL=http://localhost:3000/de/ npm run lighthouse:a11y
 */
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist', 'browser');
const defaultPort = 4175;

function waitForUrl(url, maxAttempts = 60) {
  return new Promise((resolve) => {
    let attempts = 0;
    const tryFetch = () => {
      fetch(url)
        .then((r) => (r.ok ? resolve(true) : tryLater()))
        .catch(tryLater);
    };
    const tryLater = () => {
      attempts++;
      if (attempts >= maxAttempts) return resolve(false);
      setTimeout(tryFetch, 500);
    };
    tryFetch();
  });
}

const reportJsonPath = join(__dirname, '..', 'lighthouse-a11y-report.json');

async function runLighthouse(url) {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '--only-categories=accessibility',
      '--output=json',
      '--output-path=' + reportJsonPath,
      '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
      '--quiet',
    ];
    const child = spawn('npx', ['lighthouse', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      cwd: join(__dirname, '..'),
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Lighthouse exit ${code}: ${stderr || stdout}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function main() {
  let url = process.env.LIGHTHOUSE_URL;
  let serverProcess = null;

  if (!url) {
    if (!existsSync(distDir)) {
      console.error('dist/browser fehlt. Bitte zuerst: npm run build:prod');
      process.exit(1);
    }
    const port = defaultPort;
    url = `http://localhost:${port}/de/`;
    console.log(`Starte Server auf ${url}…`);
    serverProcess = spawn('npx', ['serve', 'dist/browser', '-s', '-l', String(port)], {
      stdio: 'ignore',
      shell: true,
      cwd: join(__dirname, '..'),
    });
    const ready = await waitForUrl(url);
    if (!ready) {
      serverProcess.kill();
      console.error('Server nicht erreichbar.');
      process.exit(1);
    }
  }

  console.log(`Lighthouse Accessibility: ${url}`);
  try {
    await runLighthouse(url);
    if (existsSync(reportJsonPath)) {
      const data = JSON.parse(readFileSync(reportJsonPath, 'utf8'));
      const a11y = data.categories?.accessibility;
      const score = a11y?.score != null ? Math.round(a11y.score * 100) : null;
      console.log(
        `\nAccessibility Score: ${score ?? '?'} ${score != null && score >= 90 ? '✓ (DoD ≥ 90)' : score != null ? '✗ (Ziel ≥ 90)' : ''}`,
      );
      const nonBlockingModes = new Set(['manual', 'notApplicable', 'informative']);
      const failed = (data.categories?.accessibility?.auditRefs ?? []).filter((ref) => {
        const audit = data.audits?.[ref.id];
        if (!audit || nonBlockingModes.has(audit.scoreDisplayMode)) return false;
        // Gewicht 0 darf keine WCAG-relevanten Fehler verschlucken.
        return audit.score === 0 || audit.score === false;
      });
      if (failed.length) {
        console.log('Fehlgeschlagene Audits:', failed.map((r) => r.id).join(', '));
      }
      const exitScore = data.categories?.accessibility?.score;
      process.exit(exitScore == null || exitScore < 0.9 || failed.length > 0 ? 1 : 0);
    }
  } finally {
    if (serverProcess) serverProcess.kill();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
