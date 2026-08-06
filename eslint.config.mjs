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
  'addInitScript',
  'evaluate',
  'evaluateAll',
  'evaluateHandle',
  'waitForFunction',
]);
const playwrightReceiverFactoryMethods = new Set([
  'contentFrame',
  'filter',
  'first',
  'frame',
  'frameLocator',
  'getByAltText',
  'getByLabel',
  'getByPlaceholder',
  'getByRole',
  'getByTestId',
  'getByText',
  'getByTitle',
  'last',
  'launch',
  'locator',
  'newContext',
  'newPage',
  'nth',
  'owner',
]);
const playwrightScriptFiles = [
  'apps/frontend/scripts/**/*.{js,mjs,cjs,ts,mts}',
  'apps/landing/scripts/**/*.{js,mjs,cjs,ts,mts}',
  'scripts/verify-csp-browser.mjs',
];

const runtimeProfilePlugin = {
  rules: {
    'no-browser-global-outside-playwright-callback': {
      meta: {
        type: 'problem',
        schema: [
          {
            type: 'object',
            properties: {
              allowPlaywrightCallbacks: { type: 'boolean' },
              checkBareBrowserGlobals: { type: 'boolean' },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          browserGlobal:
            'Browser-Global ist außerhalb eines Playwright-Browsercallbacks nicht verfügbar.',
        },
      },
      create(context) {
        const sourceCode = context.sourceCode;
        const namedBrowserCallbacks = new Set();
        const playwrightReceiverVariables = new Set();
        const untrustedPlaywrightReceiverVariables = new Set();
        const playwrightReceiverFactories = new Set();
        const untrustedPlaywrightReceiverFactories = new Set();
        const playwrightReceiverFactoryProperties = new Map();
        const allowPlaywrightCallbacks = context.options[0]?.allowPlaywrightCallbacks === true;
        const checkBareBrowserGlobals = context.options[0]?.checkBareBrowserGlobals === true;
        const isGlobalReference = (node) => {
          for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
            const reference = scope.references.find((candidate) => candidate.identifier === node);
            if (reference) {
              return reference.resolved === null || reference.resolved.scope.type === 'global';
            }
          }
          return false;
        };
        const isMemberProperty = (node) =>
          node.parent?.type === 'MemberExpression' &&
          node.parent.property === node &&
          !node.parent.computed;
        const isObjectPropertyKey = (node) =>
          node.parent?.type === 'Property' && node.parent.key === node && !node.parent.computed;
        const unwrapExpression = (node) => {
          let current = node;
          while (current) {
            if (current.type === 'AwaitExpression') {
              current = current.argument;
              continue;
            }
            if (
              ['ChainExpression', 'TSAsExpression', 'TSNonNullExpression'].includes(current.type)
            ) {
              current = current.expression;
              continue;
            }
            break;
          }
          return current;
        };
        const resolveVariable = (node) => {
          for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
            const reference = scope.references.find((candidate) => candidate.identifier === node);
            if (reference) return reference.resolved;
            const declared = scope.variables.find((variable) =>
              variable.identifiers.includes(node),
            );
            if (declared) return declared;
          }
          return null;
        };
        const resolvesToPlaywrightImport = (node) => {
          const variable = resolveVariable(node);
          return variable?.defs.some(
            (definition) =>
              definition.type === 'ImportBinding' &&
              definition.node.type === 'ImportSpecifier' &&
              definition.node.imported.type === 'Identifier' &&
              ['chromium', 'firefox', 'webkit'].includes(definition.node.imported.name) &&
              ['playwright', '@playwright/test'].includes(
                definition.parent?.source?.value ?? definition.node.parent?.source?.value,
              ),
          );
        };
        const resolvesToFactory = (node) => {
          const variable = resolveVariable(node);
          return variable?.defs.some((definition) => {
            const factory =
              definition.node.type === 'FunctionDeclaration'
                ? definition.node
                : definition.node.type === 'VariableDeclarator'
                  ? definition.node.init
                  : null;
            return (
              playwrightReceiverFactories.has(factory) &&
              !untrustedPlaywrightReceiverFactories.has(factory)
            );
          });
        };
        const resolvedFunctions = (node) => {
          const variable = resolveVariable(node);
          const functions = [];
          for (const definition of variable?.defs ?? []) {
            const fn =
              definition.node.type === 'FunctionDeclaration'
                ? definition.node
                : definition.node.type === 'VariableDeclarator'
                  ? definition.node.init
                  : null;
            if (fn && 'params' in fn) functions.push(fn);
          }
          return functions;
        };
        const isPlaywrightReceiver = (node, seen = new Set()) => {
          const current = unwrapExpression(node);
          if (!current || seen.has(current)) return false;
          seen.add(current);
          if (current.type === 'Identifier') {
            const variable = resolveVariable(current);
            return (
              resolvesToPlaywrightImport(current) ||
              (variable !== null &&
                playwrightReceiverVariables.has(variable) &&
                !untrustedPlaywrightReceiverVariables.has(variable))
            );
          }
          if (current.type === 'ConditionalExpression') {
            return (
              isPlaywrightReceiver(current.consequent, seen) &&
              isPlaywrightReceiver(current.alternate, seen)
            );
          }
          if (current.type !== 'CallExpression') return false;
          if (current.callee.type === 'Identifier') return resolvesToFactory(current.callee);
          if (
            current.callee.type !== 'MemberExpression' ||
            current.callee.computed ||
            current.callee.property.type !== 'Identifier' ||
            !playwrightReceiverFactoryMethods.has(current.callee.property.name)
          ) {
            return false;
          }
          return isPlaywrightReceiver(current.callee.object, seen);
        };
        const combineBranches = (...branches) => ({
          returns: branches.flatMap((branch) => branch.returns),
          canContinue: branches.some((branch) => branch.canContinue),
          unknown: branches.some((branch) => branch.unknown),
        });
        const analyzeStatements = (statements) => {
          const result = { returns: [], canContinue: true, unknown: false };
          for (const statement of statements) {
            if (!result.canContinue) break;
            const outcome = analyzeStatement(statement);
            result.returns.push(...outcome.returns);
            result.canContinue = outcome.canContinue;
            result.unknown ||= outcome.unknown;
          }
          return result;
        };
        const analyzeStatement = (statement) => {
          switch (statement.type) {
            case 'ReturnStatement':
              return statement.argument
                ? { returns: [statement.argument], canContinue: false, unknown: false }
                : { returns: [], canContinue: false, unknown: true };
            case 'ThrowStatement':
              return { returns: [], canContinue: false, unknown: false };
            case 'BlockStatement':
              return analyzeStatements(statement.body);
            case 'IfStatement':
              return combineBranches(
                analyzeStatement(statement.consequent),
                statement.alternate
                  ? analyzeStatement(statement.alternate)
                  : { returns: [], canContinue: true, unknown: false },
              );
            case 'TryStatement': {
              if (statement.finalizer?.body.length) {
                return { returns: [], canContinue: true, unknown: true };
              }
              const body = analyzeStatement(statement.block);
              return statement.handler
                ? combineBranches(body, analyzeStatement(statement.handler.body))
                : body;
            }
            case 'LabeledStatement':
              return analyzeStatement(statement.body);
            case 'ForStatement':
            case 'ForInStatement':
            case 'ForOfStatement':
            case 'WhileStatement': {
              const body = analyzeStatement(statement.body);
              return { ...body, canContinue: true };
            }
            case 'DoWhileStatement':
              return analyzeStatement(statement.body);
            case 'BreakStatement':
            case 'ContinueStatement':
            case 'SwitchStatement':
            case 'WithStatement':
              return { returns: [], canContinue: true, unknown: true };
            default:
              return { returns: [], canContinue: true, unknown: false };
          }
        };
        const analyzeFunctionReturns = (fn) => {
          if (fn.type === 'ArrowFunctionExpression' && fn.expression) {
            return { returns: [fn.body], canContinue: false, unknown: false };
          }
          return analyzeStatement(fn.body);
        };
        const receiverPropertiesReturnedBy = (summary) => {
          if (summary.unknown || summary.canContinue || summary.returns.length === 0) return [];
          const returnedObjects = summary.returns.map(unwrapExpression);
          if (returnedObjects.some((returned) => returned?.type !== 'ObjectExpression')) return [];
          const [first, ...rest] = returnedObjects;
          return first.properties
            .filter(
              (property) =>
                property.type === 'Property' &&
                property.key.type === 'Identifier' &&
                isPlaywrightReceiver(property.value),
            )
            .map((property) => property.key.name)
            .filter((name) =>
              rest.every((returned) =>
                returned.properties.some(
                  (property) =>
                    property.type === 'Property' &&
                    property.key.type === 'Identifier' &&
                    property.key.name === name &&
                    isPlaywrightReceiver(property.value),
                ),
              ),
            );
        };
        const isSupportedBrowserCallbackCall = (call, callback) =>
          call?.type === 'CallExpression' &&
          call.arguments[0] === callback &&
          call.callee.type === 'MemberExpression' &&
          !call.callee.computed &&
          call.callee.property.type === 'Identifier' &&
          browserCallbackMethods.has(call.callee.property.name) &&
          isPlaywrightReceiver(call.callee.object);
        const isBrowserCallback = (node) => {
          for (let current = node; current; current = current.parent) {
            if (
              !['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(
                current.type,
              )
            ) {
              continue;
            }
            if (namedBrowserCallbacks.has(current)) return true;
            if (isSupportedBrowserCallbackCall(current.parent, current)) return true;
          }
          return false;
        };
        return {
          Program(node) {
            const pending = [node];
            const nodes = [];
            while (pending.length > 0) {
              const current = pending.pop();
              nodes.push(current);
              for (const [key, value] of Object.entries(current)) {
                if (key === 'parent') continue;
                if (Array.isArray(value)) {
                  pending.push(...value.filter((item) => item?.type));
                } else if (value?.type) {
                  pending.push(value);
                }
              }
            }

            let changed = true;
            while (changed) {
              changed = false;
              for (const fn of nodes.filter((current) =>
                ['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(
                  current.type,
                ),
              )) {
                const summary = analyzeFunctionReturns(fn);
                if (
                  !summary.unknown &&
                  !summary.canContinue &&
                  summary.returns.length > 0 &&
                  summary.returns.every((returned) => isPlaywrightReceiver(returned)) &&
                  !playwrightReceiverFactories.has(fn)
                ) {
                  playwrightReceiverFactories.add(fn);
                  changed = true;
                }
                const properties = receiverPropertiesReturnedBy(summary);
                const knownProperties = playwrightReceiverFactoryProperties.get(fn) ?? new Set();
                for (const property of properties) {
                  if (!knownProperties.has(property)) {
                    knownProperties.add(property);
                    changed = true;
                  }
                }
                playwrightReceiverFactoryProperties.set(fn, knownProperties);
              }
              for (const current of nodes) {
                if (
                  current.type === 'VariableDeclarator' &&
                  current.id.type === 'Identifier' &&
                  isPlaywrightReceiver(current.init)
                ) {
                  const variable = resolveVariable(current.id);
                  if (variable && !playwrightReceiverVariables.has(variable)) {
                    playwrightReceiverVariables.add(variable);
                    changed = true;
                  }
                }
                if (current.type === 'VariableDeclarator' && current.id.type === 'ObjectPattern') {
                  const initializer = unwrapExpression(current.init);
                  if (
                    initializer?.type === 'CallExpression' &&
                    initializer.callee.type === 'Identifier'
                  ) {
                    const returnedProperties = new Set(
                      resolvedFunctions(initializer.callee).flatMap((fn) => [
                        ...(playwrightReceiverFactoryProperties.get(fn) ?? []),
                      ]),
                    );
                    for (const property of current.id.properties) {
                      if (
                        property.type !== 'Property' ||
                        property.key.type !== 'Identifier' ||
                        property.value.type !== 'Identifier' ||
                        !returnedProperties.has(property.key.name)
                      ) {
                        continue;
                      }
                      const variable = resolveVariable(property.value);
                      if (variable && !playwrightReceiverVariables.has(variable)) {
                        playwrightReceiverVariables.add(variable);
                        changed = true;
                      }
                    }
                  }
                }
                if (
                  current.type === 'AssignmentExpression' &&
                  current.left.type === 'Identifier' &&
                  isPlaywrightReceiver(current.right)
                ) {
                  const variable = resolveVariable(current.left);
                  if (variable && !playwrightReceiverVariables.has(variable)) {
                    playwrightReceiverVariables.add(variable);
                    changed = true;
                  }
                }
                if (current.type === 'CallExpression' && current.callee.type === 'Identifier') {
                  for (const fn of resolvedFunctions(current.callee)) {
                    current.arguments.forEach((argument, index) => {
                      const parameter = fn.params[index];
                      if (parameter?.type !== 'Identifier' || !isPlaywrightReceiver(argument)) {
                        return;
                      }
                      const variable = resolveVariable(parameter);
                      if (variable && !playwrightReceiverVariables.has(variable)) {
                        playwrightReceiverVariables.add(variable);
                        changed = true;
                      }
                    });
                  }
                }
              }
            }

            let trustChanged = true;
            while (trustChanged) {
              trustChanged = false;
              for (const factory of playwrightReceiverFactories) {
                const summary = analyzeFunctionReturns(factory);
                if (
                  !untrustedPlaywrightReceiverFactories.has(factory) &&
                  (summary.unknown ||
                    summary.canContinue ||
                    summary.returns.length === 0 ||
                    !summary.returns.every((returned) => isPlaywrightReceiver(returned)))
                ) {
                  untrustedPlaywrightReceiverFactories.add(factory);
                  trustChanged = true;
                }
              }
              for (const current of nodes) {
                if (
                  current.type === 'VariableDeclarator' &&
                  current.id.type === 'Identifier' &&
                  current.init !== null
                ) {
                  const variable = resolveVariable(current.id);
                  if (
                    variable &&
                    playwrightReceiverVariables.has(variable) &&
                    !untrustedPlaywrightReceiverVariables.has(variable) &&
                    !isPlaywrightReceiver(current.init)
                  ) {
                    untrustedPlaywrightReceiverVariables.add(variable);
                    trustChanged = true;
                  }
                }
                if (current.type === 'VariableDeclarator' && current.id.type === 'ObjectPattern') {
                  const initializer = unwrapExpression(current.init);
                  const factories =
                    initializer?.type === 'CallExpression' &&
                    initializer.callee.type === 'Identifier'
                      ? resolvedFunctions(initializer.callee)
                      : [];
                  for (const property of current.id.properties) {
                    if (
                      property.type !== 'Property' ||
                      property.key.type !== 'Identifier' ||
                      property.value.type !== 'Identifier'
                    ) {
                      continue;
                    }
                    const variable = resolveVariable(property.value);
                    const isProvenProperty =
                      factories.length > 0 &&
                      factories.every((factory) =>
                        receiverPropertiesReturnedBy(analyzeFunctionReturns(factory)).includes(
                          property.key.name,
                        ),
                      );
                    if (
                      variable &&
                      playwrightReceiverVariables.has(variable) &&
                      !untrustedPlaywrightReceiverVariables.has(variable) &&
                      !isProvenProperty
                    ) {
                      untrustedPlaywrightReceiverVariables.add(variable);
                      trustChanged = true;
                    }
                  }
                }
                if (current.type === 'AssignmentExpression' && current.left.type === 'Identifier') {
                  const variable = resolveVariable(current.left);
                  if (
                    variable &&
                    playwrightReceiverVariables.has(variable) &&
                    !untrustedPlaywrightReceiverVariables.has(variable) &&
                    !isPlaywrightReceiver(current.right)
                  ) {
                    untrustedPlaywrightReceiverVariables.add(variable);
                    trustChanged = true;
                  }
                }
                if (current.type !== 'CallExpression' || current.callee.type !== 'Identifier') {
                  continue;
                }
                for (const fn of resolvedFunctions(current.callee)) {
                  current.arguments.forEach((argument, index) => {
                    const parameter = fn.params[index];
                    if (parameter?.type !== 'Identifier') return;
                    const variable = resolveVariable(parameter);
                    if (
                      variable &&
                      playwrightReceiverVariables.has(variable) &&
                      !untrustedPlaywrightReceiverVariables.has(variable) &&
                      !isPlaywrightReceiver(argument)
                    ) {
                      untrustedPlaywrightReceiverVariables.add(variable);
                      trustChanged = true;
                    }
                  });
                }
              }
            }

            for (const current of nodes) {
              const callback = current.type === 'CallExpression' ? current.arguments[0] : null;
              if (!callback || !isSupportedBrowserCallbackCall(current, callback)) continue;
              if (callback.type !== 'Identifier') continue;
              const variable = resolveVariable(callback);
              for (const definition of variable?.defs ?? []) {
                if (definition.node.type === 'FunctionDeclaration') {
                  namedBrowserCallbacks.add(definition.node);
                } else if (
                  definition.node.type === 'VariableDeclarator' &&
                  ['ArrowFunctionExpression', 'FunctionExpression'].includes(
                    definition.node.init?.type,
                  )
                ) {
                  namedBrowserCallbacks.add(definition.node.init);
                }
              }
            }
          },
          Identifier(node) {
            if (
              !checkBareBrowserGlobals ||
              !browserOnlyGlobalNames.includes(node.name) ||
              !isGlobalReference(node) ||
              isMemberProperty(node) ||
              isObjectPropertyKey(node) ||
              (allowPlaywrightCallbacks && isBrowserCallback(node))
            ) {
              return;
            }
            context.report({ node, messageId: 'browserGlobal' });
          },
          MemberExpression(node) {
            if (
              node.object.type !== 'Identifier' ||
              node.object.name !== 'globalThis' ||
              node.computed ||
              node.property.type !== 'Identifier' ||
              !browserOnlyGlobalNames.includes(node.property.name) ||
              (allowPlaywrightCallbacks && isBrowserCallback(node))
            ) {
              return;
            }
            context.report({ node: node.property, messageId: 'browserGlobal' });
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
      '.github/scripts/**/*.{js,mjs,cjs,ts,mts}',
    ],
    ignores: ['scripts/load/k6-*.js', ...playwrightScriptFiles],
    languageOptions: { globals: globals.node },
  },
  {
    files: [
      'scripts/**/*.{js,mjs,cjs,ts,mts}',
      'apps/backend/scripts/**/*.{js,mjs,cjs,ts,mts}',
      'apps/landing/scripts/**/*.{js,mjs,cjs,ts,mts}',
      'libs/**/scripts/**/*.{js,mjs,cjs,ts,mts}',
      '.github/scripts/**/*.{js,mjs,cjs,ts,mts}',
    ],
    ignores: ['scripts/load/k6-*.js', ...playwrightScriptFiles],
    plugins: { 'runtime-profile': runtimeProfilePlugin },
    rules: {
      'runtime-profile/no-browser-global-outside-playwright-callback': [
        'error',
        { allowPlaywrightCallbacks: false, checkBareBrowserGlobals: false },
      ],
    },
  },
  {
    files: playwrightScriptFiles,
    // Playwright startet unter Node, evaluiert ausgewählte Callbacks aber im
    // Browser. Die Regel unten begrenzt Browser-Globals auf genau diese APIs.
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  // typescript-eslint deaktiviert no-undef für TS-Dateien. Diese explizite
  // Regel hält den Laufzeitvertrag auch für .ts/.mts durchsetzbar.
  {
    files: [
      'scripts/**/*.{ts,mts}',
      'apps/backend/scripts/**/*.{ts,mts}',
      'libs/**/scripts/**/*.{ts,mts}',
      '.github/scripts/**/*.{ts,mts}',
    ],
    ignores: playwrightScriptFiles,
    rules: { 'no-restricted-globals': forbidBrowserGlobalsInNodeScripts },
  },
  {
    files: playwrightScriptFiles,
    plugins: { 'runtime-profile': runtimeProfilePlugin },
    rules: {
      'runtime-profile/no-browser-global-outside-playwright-callback': [
        'error',
        { allowPlaywrightCallbacks: true, checkBareBrowserGlobals: true },
      ],
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
