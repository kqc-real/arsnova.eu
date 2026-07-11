#!/usr/bin/env node
/**
 * Preloadet den selbst gehosteten Material-Icons-Font in allen prerendered Seiten.
 * Der Angular-Build hasht den Font-Dateinamen; deshalb wird der Link nach dem
 * Browser-Build anhand des tatsächlich erzeugten Assets ergänzt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browserRoot = path.join(__dirname, '..', 'dist', 'browser');
const locales = ['de', 'en', 'fr', 'es', 'it'];

function collectIndexHtmlFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectIndexHtmlFiles(entryPath));
    else if (entry.name === 'index.html') files.push(entryPath);
  }
  return files;
}

let patchedFiles = 0;
for (const locale of locales) {
  const localeDir = path.join(browserRoot, locale);
  const fontFile = fs
    .readdirSync(localeDir)
    .find((name) => /^material-icons\.[a-f0-9]+\.woff2$/.test(name));
  if (!fontFile) {
    throw new Error(`Material-Icons-Font für ${locale} nicht gefunden.`);
  }

  const preload = `<link rel="preload" href="${fontFile}" as="font" type="font/woff2" crossorigin>`;
  for (const file of collectIndexHtmlFiles(localeDir)) {
    const html = fs.readFileSync(file, 'utf8');
    if (html.includes(preload)) continue;
    if (!html.includes('</head>')) {
      throw new Error(`Kein </head>-Element in ${file}.`);
    }
    fs.writeFileSync(file, html.replace('</head>', `${preload}</head>`), 'utf8');
    patchedFiles += 1;
  }
}

console.log(`patch-prerender-font-preload: ${patchedFiles} Datei(en) angepasst.`);
