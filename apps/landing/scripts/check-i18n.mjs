#!/usr/bin/env node
/**
 * Automated i18n checks for the landing page (Issue #192).
 * Expects a production build in dist/ (runs build when locale pages are missing).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const locales = ['de', 'en', 'fr', 'it', 'es'];
const legacyAliases = [
  'schaetzfrage',
  'selbsteinschaetzung',
  'fragenwand',
  'ablauf',
  'barrierefreiheit',
  'vertrauen',
  'vergleich',
];
const canonicalAnchors = [
  'workflow',
  'numeric-estimate',
  'confidence',
  'qa-wall',
  'features',
  'accessibility',
  'trust',
  'comparison',
  'faq',
];
const deSmokePhrases = [
  'Jetzt ausprobieren',
  'Zum Inhalt springen',
  'Menü öffnen',
  'So funktioniert’s',
  'Jetzt live ausprobieren',
  'Häufige Fragen vor dem ersten Einsatz',
  'Bereit für die nächste Live-Session?',
];

const errors = [];
const fail = (message) => errors.push(message);

function ensureBuild() {
  const hasLocales = locales.every((locale) => existsSync(join(dist, locale, 'index.html')));
  if (hasLocales) return;
  console.log('dist/ incomplete — running landing build…');
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) fail('Landing build failed');
}

function assertDictionaries() {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', join(root, 'scripts/probe-dicts.ts')],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );
  if (result.status !== 0 || !result.stdout.includes('dictionaries-ok')) {
    fail(`Dictionary key check failed:\n${result.stderr || result.stdout}`);
  }
}

function checkLocalePaths() {
  for (const locale of locales) {
    const indexPath = join(dist, locale, 'index.html');
    if (!existsSync(indexPath)) {
      fail(`Missing built locale path: /${locale}/`);
      continue;
    }
    const html = readFileSync(indexPath, 'utf8');
    if (!html.includes(`lang="${locale}"`)) fail(`/${locale}/ missing html lang="${locale}"`);
    if (!html.includes('hreflang="x-default"')) fail(`/${locale}/ missing hreflang x-default`);
    for (const other of locales) {
      if (!html.includes(`hreflang="${other}"`)) fail(`/${locale}/ missing hreflang="${other}"`);
    }
    for (const anchor of canonicalAnchors) {
      if (!html.includes(`id="${anchor}"`)) fail(`/${locale}/ missing canonical anchor #${anchor}`);
    }
    for (const alias of legacyAliases) {
      if (!html.includes(`id="${alias}"`)) fail(`/${locale}/ missing legacy alias #${alias}`);
    }
    if (!html.includes(`https://arsnova.eu/${locale}/`)) {
      fail(`/${locale}/ missing locale-safe app URL https://arsnova.eu/${locale}/`);
    }
  }
}

function checkNoGermanFallback() {
  for (const locale of locales) {
    if (locale === 'de') continue;
    const html = readFileSync(join(dist, locale, 'index.html'), 'utf8');
    for (const phrase of deSmokePhrases) {
      if (html.includes(phrase)) {
        fail(`/${locale}/ contains German UI phrase: ${JSON.stringify(phrase)}`);
      }
    }
  }
}

function checkSitemap() {
  const sitemapPath = join(dist, 'sitemap.xml');
  if (!existsSync(sitemapPath)) {
    fail('Missing dist/sitemap.xml');
    return;
  }
  const xml = readFileSync(sitemapPath, 'utf8');
  for (const locale of locales) {
    if (!xml.includes(`/${locale}/`)) fail(`Sitemap missing locale /${locale}/`);
  }
}

ensureBuild();
if (!errors.length) assertDictionaries();
if (!errors.length) {
  checkLocalePaths();
  checkNoGermanFallback();
  checkSitemap();
}

if (errors.length) {
  console.error('\nLanding i18n checks failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}

console.log('Landing i18n checks passed:');
console.log(`- locales: ${locales.join(', ')}`);
console.log(`- dictionaries: matching keys`);
console.log(`- canonical anchors + legacy aliases present`);
console.log('- sitemap includes all locales');
console.log('- no German UI smoke phrases in en/fr/it/es');
