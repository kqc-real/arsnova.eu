import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';
import {
  classifyFile,
  globMatches,
  isDocumentedException,
  validateInventory,
} from './validate-script-lint-inventory.mjs';

const inventory = {
  extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts'],
  scope: ['scripts/**', 'apps/**/scripts/**'],
  exceptions: [{ glob: 'scripts/generated/**', reason: 'generated fixture output' }],
  profiles: [
    { name: 'k6', include: ['scripts/load/k6-*.js'], exclude: [] },
    {
      name: 'node',
      include: ['scripts/**'],
      exclude: ['scripts/load/k6-*.js', 'scripts/verify-csp-browser.mjs'],
    },
    {
      name: 'playwright-node',
      include: [
        'apps/frontend/scripts/**',
        'apps/landing/scripts/**',
        'scripts/verify-csp-browser.mjs',
      ],
      exclude: [],
    },
  ],
};

const withPlaywrightPage = (source) => `
  import { chromium } from 'playwright';
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  ${source}
`;

const runtimeProfileErrors = async (
  source,
  filePath = 'apps/frontend/scripts/check-runtime.mjs',
) => {
  const eslint = new ESLint({ ignore: false });
  const result = await eslint.lintText(source, { filePath });
  return result[0].messages.filter(
    (message) => message.ruleId === 'runtime-profile/no-browser-global-outside-playwright-callback',
  );
};

test('classifies k6 and Node scripts without overlapping globals', () => {
  assert.deepEqual(classifyFile('scripts/load/k6-health.js', inventory), ['k6']);
  assert.deepEqual(classifyFile('scripts/load/run-k6.mjs', inventory), ['node']);
  assert.deepEqual(classifyFile('apps/landing/scripts/check-theme.mjs', inventory), [
    'playwright-node',
  ]);
});

test('recognizes a new script path without silently assigning a profile', () => {
  const result = validateInventory(inventory, ['apps/unknown/scripts/new-check.mjs']);
  assert.equal(result.rows.length, 0);
  assert.deepEqual(result.errors, [
    'apps/unknown/scripts/new-check.mjs: script path is in scope but has no profile',
  ]);
  assert.equal(globMatches('apps/unknown/scripts/new-check.mjs', 'apps/**/scripts/**'), true);
});

test('does not require a runtime profile for a documented generated exception', () => {
  assert.equal(isDocumentedException('scripts/generated/report.mjs', inventory), true);
  assert.deepEqual(validateInventory(inventory, ['scripts/generated/report.mjs']), {
    errors: [],
    rows: [],
  });
});

test('runtime profiles expose only their declared globals', async () => {
  const eslint = new ESLint({ ignore: false });
  const nodeResult = await eslint.lintText('process.stdout.write("ok"); window.alert("no");', {
    filePath: 'scripts/check-runtime.mjs',
  });
  assert.deepEqual(
    nodeResult[0].messages
      .filter((message) => message.ruleId === 'no-undef')
      .map((message) => message.message),
    ["'window' is not defined."],
  );

  const playwrightResult = await eslint.lintText(
    'process.stdout.write("ok"); window.alert("no");',
    {
      filePath: 'apps/frontend/scripts/check-runtime.mjs',
    },
  );
  assert.deepEqual(
    playwrightResult[0].messages
      .filter(
        (message) =>
          message.ruleId === 'runtime-profile/no-browser-global-outside-playwright-callback',
      )
      .map((message) => message.message),
    ['Browser-Global ist außerhalb eines Playwright-Browsercallbacks nicht verfügbar.'],
  );

  const githubResult = await eslint.lintText('process.stdout.write("ok"); window.alert("no");', {
    filePath: '.github/scripts/check-runtime.mjs',
  });
  assert.deepEqual(
    githubResult[0].messages
      .filter((message) => message.ruleId === 'no-undef')
      .map((message) => message.message),
    ["'window' is not defined."],
  );

  const k6Result = await eslint.lintText('__ENV.TARGET; process.stdout.write("no");', {
    filePath: 'scripts/load/k6-runtime.js',
  });
  assert.deepEqual(
    k6Result[0].messages
      .filter((message) => message.ruleId === 'no-undef')
      .map((message) => message.message),
    ["'process' is not defined."],
  );
});

test('Node TypeScript profiles reject browser-only globals while keeping Node Web APIs', async () => {
  const eslint = new ESLint({ ignore: false });
  for (const filePath of ['scripts/check-runtime.ts', 'scripts/check-runtime.mts']) {
    const config = await eslint.calculateConfigForFile(filePath);
    assert.equal(Object.hasOwn(config.languageOptions.globals, 'process'), true);
    assert.equal('window' in config.languageOptions.globals, false);
    const result = await eslint.lintText(
      'console.log(new URL("https://example.org")); window.alert("no");',
      {
        filePath,
      },
    );
    const restrictedMessages = result[0].messages.filter(
      (message) => message.ruleId === 'no-restricted-globals',
    );
    assert.equal(restrictedMessages.length, 1);
    assert.match(
      restrictedMessages[0].message,
      /Browser-Global ist in diesem Node-Laufzeitprofil nicht verfügbar\./,
    );
  }
});

test('Playwright TypeScript profiles allow browser callbacks but reject browser-only globals elsewhere', async () => {
  const eslint = new ESLint({ ignore: false });
  const outsideCallback = await eslint.lintText('window.location.href;', {
    filePath: 'apps/frontend/scripts/check-runtime.mts',
  });
  assert.deepEqual(
    outsideCallback[0].messages
      .filter(
        (message) =>
          message.ruleId === 'runtime-profile/no-browser-global-outside-playwright-callback',
      )
      .map((message) => message.message),
    ['Browser-Global ist außerhalb eines Playwright-Browsercallbacks nicht verfügbar.'],
  );

  const browserCallback = await eslint.lintText(
    withPlaywrightPage('page.evaluate(() => window.location.href);'),
    { filePath: 'apps/frontend/scripts/check-runtime.mts' },
  );
  assert.equal(
    browserCallback[0].messages.some(
      (message) =>
        message.ruleId === 'runtime-profile/no-browser-global-outside-playwright-callback',
    ),
    false,
  );

  const nestedBrowserCallback = await eslint.lintText(
    withPlaywrightPage('page.evaluate(() => [1].map(() => window.location.href));'),
    { filePath: 'apps/frontend/scripts/check-runtime.mts' },
  );
  assert.equal(
    nestedBrowserCallback[0].messages.some(
      (message) =>
        message.ruleId === 'runtime-profile/no-browser-global-outside-playwright-callback',
    ),
    false,
  );

  const browserJavaScriptCallback = await eslint.lintText(
    withPlaywrightPage('page.evaluate(() => window.location.href);'),
    { filePath: 'apps/frontend/scripts/check-runtime.mjs' },
  );
  assert.equal(
    browserJavaScriptCallback[0].messages.some(
      (message) =>
        message.ruleId === 'runtime-profile/no-browser-global-outside-playwright-callback',
    ),
    false,
  );

  const namedBrowserCallback = await eslint.lintText(
    withPlaywrightPage(
      'const readLocation = () => window.location.href; page.waitForFunction(readLocation);',
    ),
    { filePath: 'apps/frontend/scripts/check-runtime.mjs' },
  );
  assert.equal(
    namedBrowserCallback[0].messages.some(
      (message) =>
        message.ruleId === 'runtime-profile/no-browser-global-outside-playwright-callback',
    ),
    false,
  );

  const shadowedCallbackName = await eslint.lintText(
    withPlaywrightPage(
      'const readLocation = () => "ok"; { const readLocation = () => window.location.href; } page.waitForFunction(readLocation);',
    ),
    { filePath: 'apps/frontend/scripts/check-runtime.mjs' },
  );
  assert.equal(
    shadowedCallbackName[0].messages.filter(
      (message) =>
        message.ruleId === 'runtime-profile/no-browser-global-outside-playwright-callback',
    ).length,
    1,
  );
});

test('Node scripts reject explicit globalThis browser-only access', async () => {
  const eslint = new ESLint({ ignore: false });
  const result = await eslint.lintText(
    'globalThis.window.alert("no"); globalThis.document.title;',
    {
      filePath: 'scripts/check-runtime.mts',
    },
  );
  assert.deepEqual(
    result[0].messages
      .filter(
        (message) =>
          message.ruleId === 'runtime-profile/no-browser-global-outside-playwright-callback',
      )
      .map((message) => message.message),
    [
      'Browser-Global ist außerhalb eines Playwright-Browsercallbacks nicht verfügbar.',
      'Browser-Global ist außerhalb eines Playwright-Browsercallbacks nicht verfügbar.',
    ],
  );
});

test('Playwright browser callbacks reject Node globals while the controller keeps them', async () => {
  const outside = await runtimeProfileErrors(
    withPlaywrightPage('process.stdout.write("controller");'),
  );
  const inside = await runtimeProfileErrors(
    withPlaywrightPage('page.evaluate(() => process.cwd());'),
  );
  assert.equal(outside.length, 0);
  assert.equal(inside.length, 1);
  assert.match(inside[0].message, /Node-Global ist innerhalb/);
});

test('k6 globals are rejected by Node and Playwright TypeScript profiles', async () => {
  const eslint = new ESLint({ ignore: false });
  for (const filePath of ['scripts/check-runtime.mts', 'apps/frontend/scripts/check-runtime.mts']) {
    const [bareResult, memberResult] = await Promise.all([
      eslint.lintText('__ENV.TARGET;', { filePath }),
      eslint.lintText('globalThis.__ENV.TARGET; globalThis["__VU"];', { filePath }),
    ]);
    const bareMessages = bareResult[0].messages.filter(
      (message) => message.ruleId === 'no-restricted-globals',
    );
    const memberMessages = memberResult[0].messages.filter(
      (message) =>
        message.ruleId === 'runtime-profile/no-browser-global-outside-playwright-callback',
    );
    assert.equal(bareMessages.length, 1);
    assert.match(bareMessages[0].message, /k6-Global ist außerhalb/);
    assert.equal(memberMessages.length, 2);
    assert.equal(
      memberMessages.every((message) => /k6-Global ist außerhalb/.test(message.message)),
      true,
    );
  }
});

test('Playwright callbacks outside frontend scripts include addInitScript', async () => {
  const eslint = new ESLint({ ignore: false });
  for (const [filePath, source] of [
    [
      'apps/landing/scripts/check-runtime.mjs',
      withPlaywrightPage('page.addInitScript(() => localStorage.setItem("theme", "dark"));'),
    ],
    [
      'scripts/verify-csp-browser.mjs',
      withPlaywrightPage(
        'context.addInitScript(() => document.documentElement.dataset.test = "ok");',
      ),
    ],
  ]) {
    const result = await eslint.lintText(source, { filePath });
    assert.equal(
      result[0].messages.some(
        (message) =>
          message.ruleId === 'runtime-profile/no-browser-global-outside-playwright-callback',
      ),
      false,
    );
  }

  const outsideCallback = await eslint.lintText('document.title = "no";', {
    filePath: 'apps/landing/scripts/check-runtime.mjs',
  });
  assert.deepEqual(
    outsideCallback[0].messages
      .filter(
        (message) =>
          message.ruleId === 'runtime-profile/no-browser-global-outside-playwright-callback',
      )
      .map((message) => message.message),
    ['Browser-Global ist außerhalb eines Playwright-Browsercallbacks nicht verfügbar.'],
  );
});

test('Playwright callback exemptions require a proven receiver and argument zero', async () => {
  for (const source of [
    'const helper = { evaluate(callback) { return callback(); } }; helper.evaluate(() => window.location.href);',
    withPlaywrightPage('page.evaluate(() => "ok", () => window.location.href);'),
    'import { devices } from "playwright"; devices.launch().evaluate(() => window.location.href);',
    withPlaywrightPage(
      'const helper = { evaluate(callback) { return callback(); } }; page = helper; page.evaluate(() => window.location.href);',
    ),
    withPlaywrightPage(
      'const helper = { evaluate(callback) { return callback(); } }; function read(target) { target.evaluate(() => window.location.href); } read(page); read(helper);',
    ),
  ]) {
    assert.equal((await runtimeProfileErrors(source)).length, 1);
  }
});

test('mixed factory returns cannot authorize a foreign receiver', async () => {
  const allowed = await runtimeProfileErrors(
    withPlaywrightPage('page.evaluate(() => document.title);'),
  );
  const rejected = await runtimeProfileErrors(
    withPlaywrightPage(`
      const helper = { evaluate(callback) { return callback(); } };
      function makeTarget(usePage) {
        if (usePage) return page;
        return helper;
      }
      makeTarget(false).evaluate(() => window.location.href);
    `),
  );
  assert.equal(allowed.length, 0);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].message, /außerhalb eines Playwright-Browsercallbacks/);
});

test('expression-bodied factories require every conditional result to be Playwright', async () => {
  const allowed = await runtimeProfileErrors(
    withPlaywrightPage(`
      const makeTarget = (usePage) => usePage ? page : page.locator('body');
      makeTarget(false).evaluate(() => document.title);
    `),
  );
  const rejected = await runtimeProfileErrors(
    withPlaywrightPage(`
      const helper = { evaluate(callback) { return callback(); } };
      const makeHelper = () => helper;
      makeHelper().evaluate(() => window.location.href);
    `),
  );
  assert.equal(allowed.length, 0);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].message, /außerhalb eines Playwright-Browsercallbacks/);
});

test('block factories allow callbacks only when every value return is Playwright', async () => {
  const allowed = await runtimeProfileErrors(
    withPlaywrightPage(`
      function makeTarget(usePage) {
        if (usePage) return page;
        return page.locator('body');
      }
      makeTarget(false).evaluate(() => document.title);
    `),
  );
  const rejected = await runtimeProfileErrors(
    withPlaywrightPage(`
      const helper = { evaluate(callback) { return callback(); } };
      helper.evaluate(() => window.location.href);
    `),
  );
  assert.equal(allowed.length, 0);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].message, /außerhalb eines Playwright-Browsercallbacks/);
});

test('unknown and valueless factory paths are rejected conservatively', async () => {
  const allowed = await runtimeProfileErrors(
    withPlaywrightPage(`
      function makeKnownTarget(usePage) {
        if (usePage) return page;
        throw new Error('unavailable');
      }
      makeKnownTarget(true).evaluate(() => document.title);
    `),
  );
  const rejected = await runtimeProfileErrors(
    withPlaywrightPage(`
      function makeTarget(usePage) {
        if (usePage) return page;
        return;
      }
      makeTarget(false).evaluate(() => window.location.href);
    `),
  );
  assert.equal(allowed.length, 0);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].message, /außerhalb eines Playwright-Browsercallbacks/);
});

test('object factory properties remain trusted only across proven call sites', async () => {
  const allowed = await runtimeProfileErrors(
    withPlaywrightPage(`
      function wrap(target) { return { target }; }
      const { target } = wrap(page);
      target.evaluate(() => document.title);
    `),
  );
  const rejected = await runtimeProfileErrors(
    withPlaywrightPage(`
      const helper = { evaluate(callback) { return callback(); } };
      function wrap(target) { return { target }; }
      wrap(page);
      const { target } = wrap(helper);
      target.evaluate(() => window.location.href);
    `),
  );
  assert.equal(allowed.length, 0);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].message, /außerhalb eines Playwright-Browsercallbacks/);
});
