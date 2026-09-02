#!/usr/bin/env node
/**
 * Static theme architecture checks for Issue #199.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const repoRoot = join(root, '../..');
const errors = [];
const fail = (message) => errors.push(message);

/**
 * Style-/Token-Einstiegspunkte: bei Diff hier muss apps/frontend unberührt bleiben
 * (Issue #199 – keine Angular-Material-/Frontend-Vermischung in Landing-Tokens).
 */
export const LANDING_THEME_STYLE_SCOPE = [
  'apps/landing/src/styles/landing-theme.css',
  'apps/landing/src/styles/global.css',
  'apps/landing/src/components/ThemeSwitcher.astro',
  'apps/landing/src/components/LanguageSwitcher.astro',
  'apps/landing/tailwind.config.mjs',
];

/**
 * Vollständiger Theme-Scope inkl. FOUC-/Layout-Skript.
 * Exportiert für Unit-Regressionstests.
 */
export const LANDING_THEME_SCOPE = [
  ...LANDING_THEME_STYLE_SCOPE,
  'apps/landing/src/layouts/BaseLayout.astro',
];

/**
 * Erlaubte Frontend-Brücke für Cross-Origin-Theme-Übergabe (Issue #207).
 * Nur wirksam zusammen mit BaseLayout, nicht mit Style-/Token-Dateien.
 */
export const INFO_LANDING_THEME_BRIDGE_FRONTEND = [
  'apps/frontend/src/app/core/info-landing-url.ts',
  'apps/frontend/src/app/core/info-landing-url.spec.ts',
  'apps/frontend/src/app/shared/info-landing-link/info-landing-link.component.ts',
  'apps/frontend/src/app/shared/info-landing-link/info-landing-link.component.spec.ts',
  'apps/frontend/src/app/shared/info-landing-link/info-landing-link.component.html',
  'apps/frontend/src/app/shared/info-landing-link/info-landing-link.component.scss',
  'apps/frontend/src/app/app.component.ts',
  'apps/frontend/src/app/app.component.html',
  'apps/frontend/src/app/app.component.spec.ts',
  'apps/frontend/src/app/features/help/help.component.spec.ts',
];

/**
 * Pure Prüfung: unzulässige Theme-/Frontend-Vermischung?
 * Style-Scope + jedes Frontend = Verstoß (Issue #199, keine Token-Vermischung).
 * BaseLayout-FOUC ohne Style-Dateien darf mit App-Frontend zusammenliegen
 * (Default-Theme muss in App und Landing gleich sein).
 * @param {string[]} changedPaths relative Repo-Pfade aus git diff --name-only
 */
export function frontendIsolationViolation(changedPaths) {
  const paths = Array.isArray(changedPaths) ? changedPaths : [];
  const frontendPaths = paths.filter(
    (path) => path === 'apps/frontend' || path.startsWith('apps/frontend/'),
  );
  if (frontendPaths.length === 0) return false;

  const styleTouched = paths.some((path) => LANDING_THEME_STYLE_SCOPE.includes(path));
  return styleTouched;
}

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
  // Always rebuild — never trust a stale dist alone.
  if (existsSync(dist)) {
    rmSync(dist, { recursive: true, force: true });
  }
  console.log('Running fresh landing build for theme-static checks…');
  // Do not leak Playwright BASE_URL into Vite/Astro import.meta.env.BASE_URL.
  const env = { ...process.env };
  delete env.BASE_URL;
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
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
  if (tw.includes('brand:') || tw.includes('brand :')) {
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

function resolveBaseSha() {
  const envBase = (process.env.GITHUB_BASE_SHA || '').trim();
  // GitHub may send 40 zeros for the first push of a branch.
  if (envBase && !/^0+$/.test(envBase)) return envBase;

  const remoteCandidates = ['origin/main', 'main'];
  for (const candidate of remoteCandidates) {
    const mb = spawnSync('git', ['merge-base', 'HEAD', candidate], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (mb.status === 0) {
      const sha = (mb.stdout || '').trim();
      if (sha) return sha;
    }
  }
  fail(
    `Could not resolve merge-base for frontend untouched check (GITHUB_BASE_SHA=${envBase ? JSON.stringify(envBase) : 'unset'}; tried origin/main, main). Checkout with fetch-depth: 0 or pass GITHUB_BASE_SHA.`,
  );
  return '';
}

function diffNameOnly(base, head, paths) {
  const result = spawnSync('git', ['diff', '--name-only', `${base}...${head}`, '--', ...paths], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail(
      `git diff ${base}...${head} -- ${paths.join(' ')} failed (status=${result.status}): ${(result.stderr || result.stdout || '').trim()}`,
    );
    return null;
  }
  return (result.stdout || '').trim();
}

function checkFrontendUntouched() {
  const base = resolveBaseSha();
  if (!base) return;
  const head = (process.env.GITHUB_SHA || 'HEAD').trim() || 'HEAD';

  const cat = spawnSync('git', ['cat-file', '-e', `${base}^{commit}`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (cat.status !== 0) {
    fail(
      `Base SHA ${base} is not available locally for frontend untouched check (${(cat.stderr || '').trim()}). Use fetch-depth: 0 or fetch the base commit.`,
    );
    return;
  }

  // Nur bei Landing-Theme-Änderungen: Frontend muss unberührt bleiben.
  // Reine Frontend-/App-PRs (z. B. Footer) dürfen theme-static nicht blockieren.
  const landingThemeChanged = diffNameOnly(base, head, LANDING_THEME_SCOPE);
  if (landingThemeChanged === null) return;
  const frontendChanged = diffNameOnly(base, head, ['apps/frontend']);
  if (frontendChanged === null) return;

  const changedPaths = [
    ...landingThemeChanged.split('\n').filter(Boolean),
    ...frontendChanged.split('\n').filter(Boolean),
  ];
  if (frontendIsolationViolation(changedPaths)) {
    fail(`apps/frontend must remain untouched, but git reports:\n${frontendChanged}`);
  }
}

function checkAlphaCapableTailwind() {
  const tw = readFileSync(join(root, 'tailwind.config.mjs'), 'utf8');
  for (const token of [
    '--landing-background-rgb',
    '--landing-primary-rgb',
    '--landing-focus-rgb',
    '<alpha-value>',
  ]) {
    if (!tw.includes(token)) fail(`tailwind.config.mjs missing alpha-capable token ${token}`);
  }
  const themeCss = readFileSync(join(root, 'src/styles/landing-theme.css'), 'utf8');
  if (!themeCss.includes('--landing-primary-rgb')) {
    fail('landing-theme.css missing --landing-*-rgb channel variables');
  }
  if (!themeCss.includes(':where(:root)') || !themeCss.includes(':where(html.light)')) {
    fail(
      'landing-theme.css must use :where(:root)/:where(html.light) so dark + forced-colors can win',
    );
  }
  if (!themeCss.includes(':where(:root:not(.light))')) {
    fail('landing-theme.css must use :where(:root:not(.light)) for system dark');
  }
  if (!themeCss.includes(':where(html.dark)')) {
    fail('landing-theme.css must use :where(html.dark) for class dark');
  }
  if (/a,\s*button\s*\{\s*forced-color-adjust:\s*none/.test(themeCss)) {
    fail('landing-theme.css must not blanket-disable forced-color-adjust on a, button');
  }
}

function checkBuiltThemeArtifacts() {
  if (errors.length) return;
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
  if (html.includes('role="menu"') || html.includes("role='menu'")) {
    fail('Built /de/ must not use role="menu" for theme switcher');
  }
  if (html.includes('menuitemradio')) {
    fail('Built /de/ must not use menuitemradio');
  }
  if (html.includes('role="radiogroup"') || html.includes('role="radio"')) {
    fail('Built /de/ must use aria-pressed disclosure buttons, not radiogroup/radio');
  }
  if (!html.includes('aria-pressed')) {
    fail('Built /de/ missing aria-pressed on theme options');
  }
  if (!html.includes('__arsnovaLandingTheme')) fail('Built /de/ missing theme runtime');
  if (
    !html.includes("URLSearchParams(window.location.search).get('theme')") &&
    !html.includes('URLSearchParams(window.location.search).get("theme")')
  ) {
    fail('Built /de/ missing ?theme= query transfer (Issue #207)');
  }
  if (!html.includes('searchParams.delete') || !html.includes('replaceState')) {
    fail('Built /de/ missing theme query cleanup via history.replaceState');
  }
  if (html.includes('aria-haspopup')) {
    fail('Built /de/ must not use aria-haspopup on disclosure controls');
  }
  if (
    !html.includes('data-landing-theme-color="light"') ||
    !html.includes('data-landing-theme-color="dark"')
  ) {
    fail('Built /de/ missing media theme-color metas for no-JS');
  }
  if (!html.includes('data-landing-theme-color="explicit"')) {
    fail('Built /de/ missing explicit theme-color meta');
  }

  for (const phrase of [
    'Darstellung',
    'Systemeinstellung',
    'Hell',
    'Dunkel',
    'Darstellung wählen',
  ]) {
    if (!html.includes(phrase)) fail(`Built /de/ missing theme phrase ${JSON.stringify(phrase)}`);
  }

  const en = readFileSync(join(dist, 'en', 'index.html'), 'utf8');
  for (const phrase of ['Appearance', 'System setting', 'Light', 'Dark', 'Choose appearance']) {
    if (!en.includes(phrase)) fail(`Built /en/ missing theme phrase ${JSON.stringify(phrase)}`);
  }
  for (const dePhrase of ['Darstellung wählen', 'Systemeinstellung']) {
    if (en.includes(dePhrase))
      fail(`Built /en/ contains German theme phrase ${JSON.stringify(dePhrase)}`);
  }

  if (/fonts\.googleapis|fonts\.gstatic|use\.typekit|cdn\.fonts/.test(html)) {
    fail('Built page requests external fonts');
  }
}

function main() {
  ensureBuild();
  if (!errors.length) {
    checkNoSkyBrand();
    checkNoMatSys();
    checkFrontendUntouched();
    checkAlphaCapableTailwind();
    checkBuiltThemeArtifacts();
  }

  if (errors.length) {
    console.error('\nLanding theme static checks failed:\n- ' + errors.join('\n- '));
    process.exit(1);
  }

  console.log('Landing theme static checks passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
