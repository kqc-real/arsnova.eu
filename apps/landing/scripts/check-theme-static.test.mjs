import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LANDING_THEME_SCOPE, frontendIsolationViolation } from './check-theme-static.mjs';

test('Theme-Scope enthält global.css und landing-theme.css', () => {
  assert.ok(LANDING_THEME_SCOPE.includes('apps/landing/src/styles/global.css'));
  assert.ok(LANDING_THEME_SCOPE.includes('apps/landing/src/styles/landing-theme.css'));
});

test('reine Frontend-Änderungen lösen keine Isolation aus', () => {
  assert.equal(
    frontendIsolationViolation([
      'apps/frontend/src/app/app.component.scss',
      'apps/frontend/src/styles.scss',
    ]),
    false,
  );
});

test('global.css + apps/frontend ist eine verbotene Kombination', () => {
  assert.equal(
    frontendIsolationViolation([
      'apps/landing/src/styles/global.css',
      'apps/frontend/src/app/app.component.ts',
    ]),
    true,
  );
});

test('ThemeSwitcher + apps/frontend ist eine verbotene Kombination', () => {
  assert.equal(
    frontendIsolationViolation([
      'apps/landing/src/components/ThemeSwitcher.astro',
      'apps/frontend/package.json',
    ]),
    true,
  );
});

test('nur Landing-Theme ohne Frontend ist erlaubt', () => {
  assert.equal(frontendIsolationViolation(['apps/landing/src/styles/global.css']), false);
});
