import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import angular from 'angular-eslint';

const browserGlobalNames = Object.keys(globals.browser);
const forbidBrowserGlobalsInNodeScripts = [
  'error',
  ...browserGlobalNames.map((name) => ({
    name,
    message: 'Browser-Global ist in diesem Node-Laufzeitprofil nicht verfügbar.',
  })),
];

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.mts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      'no-irregular-whitespace': 'off',
    },
  },
  {
    files: ['apps/frontend/src/**/*.ts'],
    languageOptions: { globals: globals.browser },
    processor: angular.processInlineTemplates,
  },
  {
    files: ['apps/backend/**/*.{ts,mts}', 'libs/**/*.{ts,mts}'],
    languageOptions: { globals: globals.node },
  },
  // Laufzeitprofile für operative Skripte. Die vollständige Zuordnung wird
  // durch scripts/script-lint-inventory.json und dessen Validator erzwungen.
  {
    files: [
      'scripts/**/*.{js,mjs,cjs,ts,mts}',
      'apps/backend/scripts/**/*.{js,mjs,cjs,ts,mts}',
      'apps/landing/scripts/**/*.{js,mjs,cjs,ts,mts}',
      'libs/**/scripts/**/*.{js,mjs,cjs,ts,mts}',
    ],
    ignores: ['scripts/load/k6-*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/frontend/scripts/**/*.{js,mjs,cjs,ts,mts}'],
    // Playwright startet hier unter Node. Browser-Code läuft ausschließlich
    // innerhalb der vom Browser evaluierten Callbacks und erhält keine
    // Browser-Globals im Node-Prozess.
    languageOptions: { globals: globals.node },
  },
  {
    files: ['.github/scripts/**/*.{js,mjs,cjs,ts,mts}'],
    languageOptions: { globals: globals.node },
  },
  // typescript-eslint deaktiviert no-undef für TS-Dateien. Diese explizite
  // Regel hält den Laufzeitvertrag auch für .ts/.mts durchsetzbar.
  {
    files: [
      'scripts/**/*.{ts,mts}',
      'apps/backend/scripts/**/*.{ts,mts}',
      'apps/frontend/scripts/**/*.{ts,mts}',
      'apps/landing/scripts/**/*.{ts,mts}',
      'libs/**/scripts/**/*.{ts,mts}',
      '.github/scripts/**/*.{ts,mts}',
    ],
    rules: { 'no-restricted-globals': forbidBrowserGlobalsInNodeScripts },
  },
  {
    files: ['scripts/load/k6-*.js'],
    languageOptions: {
      globals: {
        __ENV: 'readonly',
        __ITER: 'readonly',
        __VU: 'readonly',
      },
    },
  },
  {
    files: ['apps/frontend/src/**/*.html'],
    extends: [...angular.configs.templateAccessibility],
    rules: {
      // German source copy deliberately uses narrow/non-breaking spaces.
      'no-irregular-whitespace': 'off',
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.angular/**',
      '**/.astro/**',
      '**/coverage/**',
      '**/tmp/**',
      // Das reguläre Anwendungs-Lint bleibt in Slice 3A unverändert. Das
      // spezialisierte Skript-Lint deaktiviert diese Ignore-Regel gezielt.
      '**/scripts/**',
      '**/*.config.mjs',
    ],
  },
);
