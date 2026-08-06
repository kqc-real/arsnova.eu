import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import angular from 'angular-eslint';

const browserOnlyGlobalNames = Object.keys(globals.browser).filter(
  (name) => !Object.hasOwn(globals.node, name),
);
const forbidBrowserGlobalsInNodeScripts = [
  'error',
  ...browserOnlyGlobalNames.map((name) => ({
    name,
    message: 'Browser-Global ist in diesem Node-Laufzeitprofil nicht verfügbar.',
  })),
];
const browserCallbackMethods = new Set([
  'evaluate',
  'evaluateAll',
  'evaluateHandle',
  'waitForFunction',
]);

const runtimeProfilePlugin = {
  rules: {
    'no-browser-global-outside-playwright-callback': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          browserGlobal:
            'Browser-Global ist außerhalb eines Playwright-Browsercallbacks nicht verfügbar.',
        },
      },
      create(context) {
        const sourceCode = context.sourceCode;
        const isGlobalReference = (node) => {
          let scope = sourceCode.getScope(node);
          while (scope) {
            const reference = scope.references.find((candidate) => candidate.identifier === node);
            if (reference) return reference.resolved === null;
            scope = scope.upper;
          }
          return false;
        };
        const isBrowserCallback = (node) => {
          for (let current = node; current; current = current.parent) {
            if (
              !['ArrowFunctionExpression', 'FunctionExpression'].includes(current.type) ||
              current.parent?.type !== 'CallExpression' ||
              !current.parent.arguments.includes(current)
            ) {
              continue;
            }
            const property =
              current.parent.callee.type === 'MemberExpression'
                ? current.parent.callee.property
                : null;
            return property?.type === 'Identifier' && browserCallbackMethods.has(property.name);
          }
          return false;
        };
        return {
          Identifier(node) {
            if (
              !browserOnlyGlobalNames.includes(node.name) ||
              !isGlobalReference(node) ||
              isBrowserCallback(node)
            ) {
              return;
            }
            context.report({ node, messageId: 'browserGlobal' });
          },
        };
      },
    },
  },
};

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
      'apps/landing/scripts/**/*.{ts,mts}',
      'libs/**/scripts/**/*.{ts,mts}',
      '.github/scripts/**/*.{ts,mts}',
    ],
    rules: { 'no-restricted-globals': forbidBrowserGlobalsInNodeScripts },
  },
  {
    files: ['apps/frontend/scripts/**/*.{ts,mts}'],
    plugins: { 'runtime-profile': runtimeProfilePlugin },
    rules: {
      'runtime-profile/no-browser-global-outside-playwright-callback': 'error',
    },
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
