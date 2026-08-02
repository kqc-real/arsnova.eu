#!/usr/bin/env node
/**
 * Static theme architecture checks for Issue #199.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const repoRoot = join(root, '../..');
const errors = [];
const fail = (message) => errors.push(message);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.astro') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function ensureBuild() {
  if (existsSync(join(dist, 'de', 'index.html'))) return;
  console.log('dist/ incomplete — running landing build…');
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) fail('Landing build failed');
}

function checkNoSkyBrand() {
  const files = walk(join(root, 'src')).concat([join(root, 'tailwind.config.mjs')]);
  const banned = [
    '#0ea5e9',
    '#38bdf8',
    '#0284c7',
    '#0369a1',
    '14,165,233',
    'bg-brand-',
    'text-brand-',
    'border-brand-',
    'ring-brand-',
    'shadow-brand-',
    'via-brand-',
  ];
  for (const file of files) {
    if (!/\.(astro|css|mjs|ts|js)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const token of banned) {
      if (text.includes(token)) fail(`${file} still contains banned sky/brand token ${token}`);
    }
  }
  const tw = readFileSync(join(root, 'tailwind.config.mjs'), 'utf8');
  if (tw.includes("brand:") || tw.includes('brand :')) {
    fail('tailwind.config.mjs must not define a sky brand palette');
  }
}

function checkNoMatSys() {
  const files = walk(join(root, 'src')).concat([join(root, 'package.json')]);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    // Reject actual custom-property usage, not prose mentioning the prefix.
    if (/--mat-sys-[a-z0-9-]+\s*:/.test(text) || /var\(\s*--mat-sys-/.test(text)) {
      fail(`${file} must not use --mat-sys-* tokens`);
    }
    if (/@angular\/material|material-web|@material\//.test(text)) {
      fail(`${file} must not depend on Angular Material / Material Web`);
    }
  }
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of Object.keys(deps)) {
    if (/material/i.test(name)) fail(`apps/landing package.json has material dependency: ${name}`);
  }
}

function checkFrontendUntouched() {
  const result = spawnSync('git', ['diff', '--name-only', '--', 'apps/frontend'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const changed = (result.stdout || '').trim();
  if (changed) fail(`apps/frontend must remain untouched, but git reports:\n${changed}`);
}

function checkBuiltThemeArtifacts() {
  const html = readFileSync(join(dist, 'de', 'index.html'), 'utf8');
  if (!html.includes('arsnova-info-color-scheme-v1')) {
    fail('Built /de/ missing theme storage key');
  }
  if (!html.includes('data-theme-switcher') || !html.includes('data-theme-menu')) {
    fail('Built /de/ missing theme switcher markup');
  }
  if (!html.includes('id="theme-desktop-button"') || !html.includes('id="theme-mobile-button"')) {
    fail('Built /de/ missing desktop/mobile theme switchers');
  }
  if (!html.includes('--landing-primary') && !html.includes('landing-primary')) {
    // CSS may be hashed; ensure FOUC script + theme control exist at least
    if (!html.includes('__arsnovaLandingTheme')) fail('Built /de/ missing theme runtime');
  }
  if (html.includes('aria-haspopup')) {
    fail('Built /de/ must not use aria-haspopup on disclosure controls');
  }

  // Theme texts must come from dictionaries — DE page contains German labels
  for (const phrase of ['Darstellung', 'Systemeinstellung', 'Hell', 'Dunkel', 'Darstellung wählen']) {
    if (!html.includes(phrase)) fail(`Built /de/ missing theme phrase ${JSON.stringify(phrase)}`);
  }

  const en = readFileSync(join(dist, 'en', 'index.html'), 'utf8');
  for (const phrase of ['Appearance', 'System setting', 'Light', 'Dark', 'Choose appearance']) {
    if (!en.includes(phrase)) fail(`Built /en/ missing theme phrase ${JSON.stringify(phrase)}`);
  }
  for (const dePhrase of ['Darstellung wählen', 'Systemeinstellung']) {
    if (en.includes(dePhrase)) fail(`Built /en/ contains German theme phrase ${JSON.stringify(dePhrase)}`);
  }

  // No external font requests in built HTML
  if (/fonts\.googleapis|fonts\.gstatic|use\.typekit|cdn\.fonts/.test(html)) {
    fail('Built page requests external fonts');
  }
}

ensureBuild();
if (!errors.length) {
  checkNoSkyBrand();
  checkNoMatSys();
  checkFrontendUntouched();
  checkBuiltThemeArtifacts();
}

if (errors.length) {
  console.error('\nLanding theme static checks failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}

console.log('Landing theme static checks passed.');
