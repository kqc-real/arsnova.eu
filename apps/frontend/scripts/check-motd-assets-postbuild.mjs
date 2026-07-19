#!/usr/bin/env node
/**
 * Nach `build:localize`: prüft, dass MOTD-referenzierte Static-Assets in jedem Locale-Ordner
 * unter `dist/browser/<locale>/assets/...` liegen (sonst 404 in Produktion trotz Markdown in der DB).
 *
 * Pfade müssen zu `scripts/seed-motd-ai-revolution.mjs` und Admin-Hinweis `/assets/images/…` passen.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browserRoot = path.join(__dirname, '..', 'dist', 'browser');

/** Wie i18n-Build / App-Routen (Story 0.x, MOTD Epic 10). */
const LOCALES = ['de', 'en', 'fr', 'it', 'es'];

/** Relativ zu `dist/browser/<locale>/` — z. B. MOTD-Banner KI-Revolution. */
const REQUIRED_ASSETS = [
  'assets/images/AI-REVOLUTION.png',
  'assets/images/numeric-estimate-1789-host.png',
  // Locale-spezifische Demo-Nachbesprechungspläne (Inhalt = Dateiname-Locale)
  ...LOCALES.flatMap((locale) => [
    `assets/demo/demo-session-results-30.${locale}.pdf`,
    `assets/demo/demo-session-results-30.${locale}-pdfua.pdf`,
  ]),
  // DE-Aliase (MOTD-Backward-Compat)
  'assets/demo/demo-session-results-30.pdf',
  'assets/demo/demo-session-results-30-pdfua.pdf',
];

function main() {
  if (!fs.existsSync(browserRoot)) {
    console.error(
      `check-motd-assets-postbuild: dist fehlt: ${browserRoot} (zuerst build:localize ausführen)`,
    );
    process.exit(1);
  }

  const missing = [];
  for (const locale of LOCALES) {
    for (const rel of REQUIRED_ASSETS) {
      const p = path.join(browserRoot, locale, rel);
      if (!fs.existsSync(p)) {
        missing.push(path.join(locale, rel));
      }
    }
  }

  if (missing.length > 0) {
    console.error('check-motd-assets-postbuild: folgende Dateien fehlen im lokalisierten Build:');
    for (const m of missing) {
      console.error(`  - ${m}`);
    }
    console.error(
      'Hinweis: Datei unter apps/frontend/src/assets/… committen; Markdown in der DB verweist nur auf die URL.',
    );
    process.exit(1);
  }

  console.log(
    `check-motd-assets-postbuild: OK (${LOCALES.length} Locales × ${REQUIRED_ASSETS.length} Asset(s)).`,
  );
}

main();
