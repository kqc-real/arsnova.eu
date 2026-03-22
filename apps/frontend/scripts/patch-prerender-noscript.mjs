#!/usr/bin/env node
/**
 * Ersetzt den statischen Noscript-Hinweis in allen prerendered index.html je Locale.
 * Angular @localize ersetzt i18n in <noscript> im Body nicht zuverlässig; deshalb
 * feste Zielstrings hier (alle 5 Sprachen, Duzen wie ADR-0008 – bei Copy-Änderungen mitpflegen).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browserRoot = path.join(__dirname, '..', 'dist', 'browser');

const BY_LOCALE = {
  de: 'Bitte aktiviere JavaScript, um arsnova.eu zu nutzen.',
  en: 'Please enable JavaScript to use arsnova.eu.',
  fr: 'Active JavaScript pour utiliser arsnova.eu.',
  it: 'Abilita JavaScript per usare arsnova.eu.',
  es: 'Activa JavaScript para usar arsnova.eu.',
};

function escapePcdata(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** @param {string} dir */
function collectIndexHtmlFiles(dir) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...collectIndexHtmlFiles(p));
    else if (name === 'index.html') out.push(p);
  }
  return out;
}

const re = /<noscript><p[^>]*>[\s\S]*?<\/p><\/noscript>(?=\s*\n?\s*<app-root)/;

let patchedFiles = 0;
for (const locale of Object.keys(BY_LOCALE)) {
  const localeDir = path.join(browserRoot, locale);
  const msg = escapePcdata(BY_LOCALE[locale]);
  const replacement = `<noscript><p>${msg}</p></noscript>`;
  for (const file of collectIndexHtmlFiles(localeDir)) {
    const html = fs.readFileSync(file, 'utf8');
    if (!re.test(html)) continue;
    fs.writeFileSync(file, html.replace(re, replacement), 'utf8');
    patchedFiles += 1;
  }
}

if (patchedFiles === 0) {
  console.warn('patch-prerender-noscript: keine index.html mit Noscript-Marker gefunden (Build ausgeführt?).');
} else {
  console.log(`patch-prerender-noscript: ${patchedFiles} Datei(en) angepasst.`);
}
