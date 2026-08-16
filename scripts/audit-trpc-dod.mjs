#!/usr/bin/env node
/**
 * tRPC DoD audit (ADR-0034 / Issue #222).
 *
 * Slice 2C: real AppRouter inventory + versioned non-regression gate.
 * Existing legacy debt remains non-blocking; new or increased debt fails.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const CANONICAL_HELPER_REL = 'apps/backend/src/__tests__/test-utils/trpc-dod-evidence.ts';
const CANONICAL_HELPER_ABS = join(REPO_ROOT, CANONICAL_HELPER_REL);
const DEFAULT_POC_ROUTER = join(
  REPO_ROOT,
  'apps/backend/src/__tests__/trpc-dod-poc/fixture-router.ts',
);
const DEFAULT_POC_EVIDENCE_DIRS = [join(REPO_ROOT, 'apps/backend/src/__tests__/trpc-dod-poc')];
const DEFAULT_REAL_ROUTER = join(REPO_ROOT, 'apps/backend/src/routers/index.ts');
const DEFAULT_REAL_EVIDENCE_DIRS = [join(REPO_ROOT, 'apps/backend/src')];
const DEFAULT_REAL_EVIDENCE_EXCLUDES = [join(REPO_ROOT, 'apps/backend/src/__tests__/trpc-dod-poc')];
const DEFAULT_BASELINE = join(REPO_ROOT, '.github/trpc-dod-baseline.json');
const BACKEND_VITEST_CONFIG = join(REPO_ROOT, 'apps/backend/vitest.config.ts');
const BACKEND_VITEST_EVIDENCE_INCLUDE = 'src/**/*.test.ts';
const BACKEND_VITEST_NON_EVIDENCE_INCLUDES = ['scripts/**/*.test.ts'];

const SKIP_CALLEES = new Set([
  'describe.skip',
  'describe.skipIf',
  'it.skip',
  'it.skipIf',
  'test.skip',
  'test.skipIf',
  'suite.skip',
  'xdescribe',
  'xit',
  'xtest',
]);

function usage() {
  return `Usage:
  node scripts/audit-trpc-dod.mjs --real [--json-out path] [--md-out path]
  node scripts/audit-trpc-dod.mjs --poc [--json-out path] [--md-out path]
  node scripts/audit-trpc-dod.mjs --router <file> --prefix <id> --evidence <dir|file> [--json-out path]

Options:
  --real                Audit the complete production AppRouter tree and baseline gate
  --poc                 Audit the Slice-2A fixture router and evidence tests
  --router <file>       TypeScript file containing router({ ... })
  --prefix <id>         Procedure id prefix (e.g. dodPoc)
  --evidence <path>     File or directory with trpcDodIt call sites (repeatable)
  --json-out <path>     Write machine-readable report
  --md-out <path>       Write human-readable markdown summary
  --baseline <path>     Versioned real-router baseline (default: .github/trpc-dod-baseline.json)
  --write-baseline      Write an initial baseline instead of running the report
  --origin-commit <sha> Required with --write-baseline (full 40-character SHA)
  --update-baseline     Atomically accept the current monotonic real-router state
  --fail-on-incomplete  Exit 1 when any query/mutation is incomplete/untested
                        (CI uses this in real mode for the Slice-2D 100% gate)
`;
}

function parseArgs(argv) {
  const args = {
    real: false,
    poc: false,
    router: null,
    prefix: null,
    evidence: [],
    jsonOut: null,
    mdOut: null,
    baseline: null,
    writeBaseline: false,
    updateBaseline: false,
    originCommit: null,
    originSnapshot: false,
    failOnIncomplete: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--real') args.real = true;
    else if (a === '--poc') args.poc = true;
    else if (a === '--write-baseline') args.writeBaseline = true;
    else if (a === '--update-baseline') args.updateBaseline = true;
    else if (a === '--fail-on-incomplete') args.failOnIncomplete = true;
    else if (a === '--router') args.router = argv[++i];
    else if (a === '--prefix') args.prefix = argv[++i];
    else if (a === '--evidence') args.evidence.push(argv[++i]);
    else if (a === '--json-out') args.jsonOut = argv[++i];
    else if (a === '--md-out') args.mdOut = argv[++i];
    else if (a === '--baseline') args.baseline = argv[++i];
    else if (a === '--origin-commit') args.originCommit = argv[++i];
    else if (a === '--origin-snapshot') args.originSnapshot = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${a}\n${usage()}`);
  }
  return args;
}

function compareCanonicalStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareCanonicalTuples(left, right) {
  return compareCanonicalStrings(JSON.stringify(left), JSON.stringify(right));
}

function walkFiles(root, acc = []) {
  const st = statSync(root);
  if (st.isFile()) {
    if (/\.(ts|tsx|mts|cts)$/.test(root)) acc.push(root);
    return acc;
  }
  for (const name of readdirSync(root).sort(compareCanonicalStrings)) {
    if (name === 'node_modules' || name === 'dist') continue;
    walkFiles(join(root, name), acc);
  }
  return acc;
}

function isPathInside(filePath, directory) {
  const rel = relative(resolve(directory), resolve(filePath));
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'));
}

function relPosix(filePath) {
  return relative(REPO_ROOT, filePath).replaceAll('\\', '/');
}

function objectProperty(object, name) {
  return object.properties.find(
    (property) => ts.isPropertyAssignment(property) && propertyNameText(property.name) === name,
  );
}

function readBackendVitestIncludes(configPath = BACKEND_VITEST_CONFIG) {
  const text = readFileSync(configPath, 'utf8');
  const sourceFile = ts.createSourceFile(configPath, text, ts.ScriptTarget.Latest, true);
  let configObject = null;

  for (const statement of sourceFile.statements) {
    if (
      ts.isExportAssignment(statement) &&
      ts.isCallExpression(statement.expression) &&
      statement.expression.arguments[0] &&
      ts.isObjectLiteralExpression(statement.expression.arguments[0])
    ) {
      configObject = statement.expression.arguments[0];
      break;
    }
  }
  const testProperty = configObject ? objectProperty(configObject, 'test') : null;
  const testObject =
    testProperty &&
    ts.isPropertyAssignment(testProperty) &&
    ts.isObjectLiteralExpression(testProperty.initializer)
      ? testProperty.initializer
      : null;
  const includeProperty = testObject ? objectProperty(testObject, 'include') : null;
  const includeArray =
    includeProperty &&
    ts.isPropertyAssignment(includeProperty) &&
    ts.isArrayLiteralExpression(includeProperty.initializer)
      ? includeProperty.initializer
      : null;
  if (!includeArray) {
    throw new Error(`Could not resolve literal test.include from ${relPosix(configPath)}`);
  }
  return includeArray.elements.map(literalString).filter((value) => value !== null);
}

function assertBackendVitestContract(configPath = BACKEND_VITEST_CONFIG) {
  const includes = readBackendVitestIncludes(configPath);
  if (!includes.includes(BACKEND_VITEST_EVIDENCE_INCLUDE)) {
    throw new Error(
      `Unsupported backend Vitest include ${JSON.stringify(includes)}; update the tRPC DoD evidence matcher`,
    );
  }
  const extras = includes.filter((pattern) => pattern !== BACKEND_VITEST_EVIDENCE_INCLUDE);
  const unsupported = extras.filter(
    (pattern) => !BACKEND_VITEST_NON_EVIDENCE_INCLUDES.includes(pattern),
  );
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported backend Vitest include ${JSON.stringify(includes)}; update the tRPC DoD evidence matcher`,
    );
  }
}

function isBackendVitestTestFile(filePath, repoRoot = REPO_ROOT) {
  const backendRelative = relative(join(repoRoot, 'apps/backend'), resolve(filePath)).replaceAll(
    '\\',
    '/',
  );
  return backendRelative.startsWith('src/') && backendRelative.endsWith('.test.ts');
}

/**
 * Semantically safe fingerprint normalization:
 * TypeScript scanner with trivia skipped (comments/whitespace), literal token
 * text preserved (strings, templates, regex). Each token is serialized as a
 * [SyntaxKind, text] tuple so adjacent operators cannot collapse together.
 */
function normalizeProcedureSource(text) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    /* skipTrivia */ true,
    ts.LanguageVariant.Standard,
    text,
  );
  const tokens = [];
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    tokens.push([token, scanner.getTokenText()]);
    token = scanner.scan();
  }
  return JSON.stringify(tokens);
}

function fingerprintSource(kind, id, source) {
  const payload = `${id}\0${kind}\0${normalizeProcedureSource(source)}`;
  return `sha256:${createHash('sha256').update(payload).digest('hex')}`;
}

function literalString(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function findProcedureKind(expr) {
  let current = expr;
  while (current) {
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      const name = current.expression.name.text;
      if (name === 'query' || name === 'mutation' || name === 'subscription') {
        return { kind: name, call: current };
      }
      current = current.expression.expression;
      continue;
    }
    if (ts.isPropertyAccessExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isCallExpression(current)) {
      current = current.expression;
      continue;
    }
    break;
  }
  return null;
}

function routerPrefixFromVarName(name) {
  return name.replace(/Router$/, '');
}

function collectRouters(sourceFile) {
  const routers = [];

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const call = node.initializer;
      const callee = call.expression;
      const isRouter =
        (ts.isIdentifier(callee) && callee.text === 'router') ||
        (ts.isPropertyAccessExpression(callee) && callee.name.text === 'router');
      if (isRouter && call.arguments[0] && ts.isObjectLiteralExpression(call.arguments[0])) {
        routers.push({
          varName: node.name.text,
          prefix: routerPrefixFromVarName(node.name.text),
          object: call.arguments[0],
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return routers;
}

function inventariseRouterFile(filePath, forcedPrefix = null) {
  const text = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const routers = collectRouters(sourceFile);
  const procedures = [];

  for (const router of routers) {
    const prefix = forcedPrefix || router.prefix;
    for (const prop of router.object.properties) {
      if (!ts.isPropertyAssignment(prop) && !ts.isMethodDeclaration(prop)) continue;
      const localName = propertyNameText(prop.name);
      if (!localName) continue;
      const expr = ts.isPropertyAssignment(prop) ? prop.initializer : prop;
      const found = findProcedureKind(expr);
      if (!found) continue;
      const id = `${prefix}.${localName}`;
      const start = prop.getStart(sourceFile);
      const end = prop.getEnd();
      const raw = text.slice(start, end);
      procedures.push({
        id,
        kind: found.kind,
        sourceFile: relPosix(filePath),
        fingerprint: fingerprintSource(found.kind, id, raw),
        evidence: { happy: [], error: [] },
      });
    }
  }

  procedures.sort((a, b) => compareCanonicalStrings(a.id, b.id));
  return procedures;
}

function collectNamedImports(sourceFile, filePath) {
  const imports = new Map();
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    const specifier = literalString(stmt.moduleSpecifier);
    const target = resolveImportTarget(filePath, specifier);
    const named = stmt.importClause.namedBindings;
    if (!target || !named || !ts.isNamedImports(named)) continue;
    for (const element of named.elements) {
      imports.set(element.name.text, {
        exportedName: (element.propertyName ?? element.name).text,
        filePath: target,
      });
    }
  }
  return imports;
}

function loadRouterModule(filePath) {
  const absolute = resolve(filePath);
  const text = readFileSync(absolute, 'utf8');
  const sourceFile = ts.createSourceFile(absolute, text, ts.ScriptTarget.Latest, true);
  return {
    filePath: absolute,
    text,
    sourceFile,
    routers: new Map(collectRouters(sourceFile).map((router) => [router.varName, router])),
    imports: collectNamedImports(sourceFile, absolute),
  };
}

/** Inventory only procedures reachable from the mounted production router tree. */
function inventariseRouterTree(entryFile, rootRouterName = 'appRouter') {
  const moduleCache = new Map();
  const procedures = [];
  const ids = new Set();

  function getModule(filePath) {
    const absolute = resolve(filePath);
    if (!moduleCache.has(absolute)) moduleCache.set(absolute, loadRouterModule(absolute));
    return moduleCache.get(absolute);
  }

  function visitRouter(filePath, routerName, prefix, stack) {
    const module = getModule(filePath);
    const router = module.routers.get(routerName);
    const key = `${module.filePath}#${routerName}`;
    if (!router) {
      throw new Error(`Could not resolve router ${routerName} in ${relPosix(module.filePath)}`);
    }
    if (stack.includes(key)) {
      throw new Error(`Router cycle detected: ${[...stack, key].join(' -> ')}`);
    }

    for (const prop of router.object.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        throw new Error(
          `Unsupported router member in ${relPosix(module.filePath)}:${sourceLine(module.sourceFile, prop)}`,
        );
      }
      const localName = propertyNameText(prop.name);
      if (!localName) {
        throw new Error(
          `Computed router member in ${relPosix(module.filePath)}:${sourceLine(module.sourceFile, prop)}`,
        );
      }
      const id = prefix ? `${prefix}.${localName}` : localName;
      const found = findProcedureKind(prop.initializer);
      if (found) {
        if (ids.has(id)) throw new Error(`Duplicate procedure id ${id}`);
        ids.add(id);
        const raw = module.text.slice(prop.getStart(module.sourceFile), prop.getEnd());
        procedures.push({
          id,
          kind: found.kind,
          sourceFile: relPosix(module.filePath),
          fingerprint: fingerprintSource(found.kind, id, raw),
          evidence: { happy: [], error: [] },
        });
        continue;
      }

      if (!ts.isIdentifier(prop.initializer)) {
        throw new Error(
          `Unresolved router entry ${id} in ${relPosix(module.filePath)}:${sourceLine(module.sourceFile, prop)}`,
        );
      }
      const nestedName = prop.initializer.text;
      if (module.routers.has(nestedName)) {
        visitRouter(module.filePath, nestedName, id, [...stack, key]);
        continue;
      }
      const imported = module.imports.get(nestedName);
      if (!imported) {
        throw new Error(
          `Unresolved router binding ${nestedName} for ${id} in ${relPosix(module.filePath)}`,
        );
      }
      visitRouter(imported.filePath, imported.exportedName, id, [...stack, key]);
    }
  }

  visitRouter(resolve(entryFile), rootRouterName, '', []);
  return procedures.sort((a, b) => compareCanonicalStrings(a.id, b.id));
}

function sourceLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function extractEvidenceObject(arg) {
  if (!arg || !ts.isObjectLiteralExpression(arg)) return null;
  const out = {};
  for (const prop of arg.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = propertyNameText(prop.name);
    if (!key) continue;
    const value = literalString(prop.initializer);
    if (value !== null) out[key] = value;
  }
  return out;
}

function isEmptyFunctionBody(fnNode) {
  if (!fnNode) return true;
  if (ts.isArrowFunction(fnNode)) {
    if (!fnNode.body) return true;
    if (!ts.isBlock(fnNode.body)) return false;
    return fnNode.body.statements.length === 0;
  }
  if (ts.isFunctionExpression(fnNode) || ts.isFunctionDeclaration(fnNode)) {
    return !fnNode.body || fnNode.body.statements.length === 0;
  }
  return false;
}

function calleeKey(expr) {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isCallExpression(expr)) return calleeKey(expr.expression);
  if (ts.isPropertyAccessExpression(expr)) {
    const left = calleeKey(expr.expression);
    return left ? `${left}.${expr.name.text}` : expr.name.text;
  }
  return null;
}

function resolveImportTarget(fromFile, specifier) {
  if (!specifier || specifier.startsWith('node:')) return null;
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const base = resolve(dirname(fromFile), specifier);
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.mts`,
      `${base}.cts`,
      `${base}.js`,
      join(base, 'index.ts'),
    ];
    for (const c of candidates) {
      if (existsSync(c) && statSync(c).isFile()) return resolve(c);
    }
    return resolve(base);
  }
  return null;
}

function isCanonicalHelperPath(absPath) {
  return resolve(absPath) === CANONICAL_HELPER_ABS;
}

/**
 * Map local binding name -> true if bound to exported `trpcDodIt` from the
 * canonical helper module (including `import { trpcDodIt as alias }`).
 */
function collectCanonicalHelperBindings(sourceFile, filePath) {
  const bindings = new Map();
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    const spec = literalString(stmt.moduleSpecifier);
    const target = resolveImportTarget(filePath, spec);
    if (!target || !isCanonicalHelperPath(target)) continue;
    const named = stmt.importClause.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const el of named.elements) {
      const imported = (el.propertyName ?? el.name).text;
      if (imported === 'trpcDodIt') {
        bindings.set(el.name.text, true);
      }
    }
  }
  return bindings;
}

function isCanonicalHelperReference(identifier, checker, filePath) {
  const symbol = checker.getSymbolAtLocation(identifier);
  if (!symbol) return false;

  return (symbol.declarations ?? []).some((declaration) => {
    if (!ts.isImportSpecifier(declaration)) return false;
    const imported = (declaration.propertyName ?? declaration.name).text;
    if (imported !== 'trpcDodIt') return false;
    const importDeclaration = declaration.parent?.parent?.parent;
    if (!importDeclaration || !ts.isImportDeclaration(importDeclaration)) return false;
    const specifier = literalString(importDeclaration.moduleSpecifier);
    const target = resolveImportTarget(filePath, specifier);
    return Boolean(target && isCanonicalHelperPath(target));
  });
}

function isInsideSkippedContext(node) {
  let current = node.parent;
  while (current) {
    if (ts.isCallExpression(current)) {
      const key = calleeKey(current.expression);
      if (key && SKIP_CALLEES.has(key)) return true;
    }
    current = current.parent;
  }
  return false;
}

function loadKnownContractsFromHelper() {
  const text = readFileSync(CANONICAL_HELPER_ABS, 'utf8');
  const sourceFile = ts.createSourceFile(CANONICAL_HELPER_ABS, text, ts.ScriptTarget.Latest, true);
  const contracts = [];

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'TRPC_DOD_KNOWN_CONTRACTS' &&
      node.initializer &&
      ts.isAsExpression(node.initializer) &&
      ts.isArrayLiteralExpression(node.initializer.expression)
    ) {
      for (const el of node.initializer.expression.elements) {
        const s = literalString(el);
        if (s) contracts.push(s);
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'TRPC_DOD_KNOWN_CONTRACTS' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const el of node.initializer.elements) {
        const s = literalString(el);
        if (s) contracts.push(s);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (contracts.length === 0) {
    throw new Error(`Could not extract TRPC_DOD_KNOWN_CONTRACTS from ${CANONICAL_HELPER_REL}`);
  }
  return new Set(contracts);
}

function isAllowedContract(value, known) {
  if (known.has(value)) return true;
  return /^DOMAIN:[A-Za-z][A-Za-z0-9_:-]*$/.test(value);
}

function collectEvidenceFromFile(filePath) {
  const absoluteFilePath = resolve(filePath);
  const program = ts.createProgram([absoluteFilePath], {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.Latest,
  });
  const sourceFile = program.getSourceFile(absoluteFilePath);
  if (!sourceFile) {
    throw new Error(`Could not parse evidence file ${absoluteFilePath}`);
  }
  const checker = program.getTypeChecker();
  const helperBindings = collectCanonicalHelperBindings(sourceFile, absoluteFilePath);
  const entries = [];
  const rejected = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.arguments.length >= 1
    ) {
      const localName = node.expression.text;
      const meta = extractEvidenceObject(node.arguments[0]);
      const fn = node.arguments[1];
      const skipped = isInsideSkippedContext(node);
      const bound =
        helperBindings.has(localName) &&
        isCanonicalHelperReference(node.expression, checker, absoluteFilePath);

      const looksLikeHelperCall = bound || localName === 'trpcDodIt' || localName === 'dodIt';
      if (!looksLikeHelperCall || !meta) {
        // continue
      } else if (!bound) {
        rejected.push({
          entry: {
            ...meta,
            testFile: relPosix(absoluteFilePath),
          },
          problems: [
            `call to ${localName} is not bound to canonical helper ${CANONICAL_HELPER_REL}`,
          ],
        });
      } else if (skipped) {
        rejected.push({
          entry: {
            ...meta,
            testFile: relPosix(absoluteFilePath),
            skipped: true,
          },
          problems: ['evidence is inside a skipped describe/it context'],
        });
      } else {
        entries.push({
          ...meta,
          testFile: relPosix(absoluteFilePath),
          emptyBody: isEmptyFunctionBody(fn),
          skipped: false,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { entries, rejected };
}

function validateEvidenceMeta(entry, knownContracts) {
  const problems = [];
  if (!entry.procedure || typeof entry.procedure !== 'string') {
    problems.push('missing procedure');
  }
  if (entry.case !== 'happy' && entry.case !== 'error') {
    problems.push('case must be happy|error');
  }
  if (entry.mode !== 'direct' && entry.mode !== 'indirect') {
    problems.push('mode must be direct|indirect');
  }
  if (!entry.title || !String(entry.title).trim()) {
    problems.push('missing title');
  }
  if (entry.case === 'error') {
    if (!entry.contract || !String(entry.contract).trim()) {
      problems.push('error evidence requires contract');
    } else if (!isAllowedContract(entry.contract, knownContracts)) {
      problems.push(`meaningless contract ${JSON.stringify(entry.contract)}`);
    }
  }
  if (entry.mode === 'indirect' && (!entry.rationale || !String(entry.rationale).trim())) {
    problems.push('indirect evidence requires rationale');
  }
  if (entry.emptyBody) {
    problems.push('empty test body');
  }
  if (entry.skipped) {
    problems.push('skipped evidence');
  }
  return problems;
}

function attachEvidence(procedures, evidenceEntries, rejected = [], knownContracts) {
  const byId = new Map(procedures.map((p) => [p.id, p]));
  const invalid = [...rejected];
  const orphanEvidence = [];
  const candidatesByKey = new Map();

  for (const entry of evidenceEntries) {
    const problems = validateEvidenceMeta(entry, knownContracts);
    if (problems.length) {
      invalid.push({ entry, problems });
      continue;
    }
    const key = JSON.stringify([entry.procedure, entry.case, entry.testFile, entry.title]);
    const signature = JSON.stringify([entry.mode, entry.contract ?? null, entry.rationale ?? null]);
    const previous = candidatesByKey.get(key);
    if (!previous) {
      candidatesByKey.set(key, { entry, signature, conflict: false });
    } else if (previous.signature !== signature) {
      previous.conflict = true;
    }
  }

  for (const { entry, conflict } of candidatesByKey.values()) {
    if (conflict) {
      invalid.push({
        entry,
        problems: [
          'duplicate evidence key (procedure/case/testFile/title) has conflicting metadata',
        ],
      });
      continue;
    }
    const proc = byId.get(entry.procedure);
    if (!proc) {
      orphanEvidence.push(entry);
      continue;
    }
    if (proc.kind === 'subscription') {
      invalid.push({
        entry,
        problems: ['subscriptions are report-only and outside the query/mutation DoD gate'],
      });
      continue;
    }
    const bucket = entry.case === 'happy' ? proc.evidence.happy : proc.evidence.error;
    bucket.push({
      mode: entry.mode,
      contract: entry.contract ?? null,
      rationale: entry.rationale ?? null,
      title: entry.title,
      testFile: entry.testFile,
    });
  }

  return { invalid, orphanEvidence };
}

function classifyProcedure(proc) {
  if (proc.kind === 'subscription') {
    return { status: 'subscription_report_only', missing: [] };
  }
  const missing = [];
  if (proc.evidence.happy.length === 0) missing.push('happy');
  if (proc.evidence.error.length === 0) missing.push('error');
  if (missing.length === 2) return { status: 'untested', missing };
  if (missing.length > 0) return { status: 'incomplete', missing };
  return { status: 'complete', missing: [] };
}

/**
 * Monotonic debt comparison per happy/error dimension.
 * Returns { improved, worsened, unchanged } id lists plus ok flag.
 */
function compareMissingDebt(baselineMissingById, currentMissingById) {
  const ids = new Set([...Object.keys(baselineMissingById), ...Object.keys(currentMissingById)]);
  const improved = [];
  const worsened = [];
  const unchanged = [];

  for (const id of [...ids].sort()) {
    const before = new Set(baselineMissingById[id] ?? []);
    const after = new Set(currentMissingById[id] ?? []);
    let lostCoverage = false;
    let gainedCoverage = false;
    for (const dim of ['happy', 'error']) {
      const had = !before.has(dim);
      const has = !after.has(dim);
      if (had && !has) lostCoverage = true;
      if (!had && has) gainedCoverage = true;
    }
    // New procedure not in baseline: any missing is new debt if incomplete
    if (!(id in baselineMissingById)) {
      if (after.size > 0) worsened.push(id);
      else unchanged.push(id);
      continue;
    }
    // Deleted procedure: ignore here (caller removes from baseline)
    if (!(id in currentMissingById)) {
      unchanged.push(id);
      continue;
    }
    if (lostCoverage) worsened.push(id);
    else if (gainedCoverage || after.size < before.size) improved.push(id);
    else unchanged.push(id);
  }

  return {
    ok: worsened.length === 0,
    improved,
    worsened,
    unchanged,
  };
}

function canonicalBaselineProcedures(procedures) {
  return Object.fromEntries(
    Object.entries(procedures)
      .sort(([left], [right]) => compareCanonicalStrings(left, right))
      .map(([id, entry]) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [id, entry];
        return [
          id,
          {
            kind: entry.kind,
            fingerprint: entry.fingerprint,
            missing: Array.isArray(entry.missing) ? [...entry.missing] : entry.missing,
          },
        ];
      }),
  );
}

function createBaseline(procedures, originCommit) {
  if (!/^[0-9a-f]{40}$/.test(originCommit)) {
    throw new Error('--origin-commit must be a full lowercase 40-character Git SHA');
  }
  const entries = {};
  for (const procedure of [...procedures].sort((a, b) => compareCanonicalStrings(a.id, b.id))) {
    entries[procedure.id] = {
      kind: procedure.kind,
      fingerprint: procedure.fingerprint,
      missing: classifyProcedure(procedure).missing,
    };
  }
  return {
    version: 1,
    originCommit,
    procedures: canonicalBaselineProcedures(entries),
  };
}

function validateBaselineEvolution(baseline, initialBaseline, previousBaselines = []) {
  const errors = [];
  if (baseline.originCommit !== initialBaseline.originCommit) {
    errors.push(
      `baseline originCommit differs from immutable initial origin ${initialBaseline.originCommit}`,
    );
    return errors;
  }

  const history = previousBaselines.length > 0 ? previousBaselines : [initialBaseline];
  for (const [id, entry] of Object.entries(baseline.procedures)) {
    if (!entry || entry.kind === 'subscription') continue;
    const immediatelyPrevious = history[0]?.procedures?.[id] ?? null;

    if (!immediatelyPrevious) {
      if (entry.missing.length > 0) {
        const existedEarlier = history.slice(1).some((previous) => previous.procedures?.[id]);
        errors.push(
          `baseline procedure ${id} ${existedEarlier ? 'is reintroduced after absence' : 'is new'} and carries missing ${entry.missing.join(', ')} evidence`,
        );
      }
      continue;
    }

    const previousEntries = history.map((previous) => previous.procedures?.[id]).filter(Boolean);
    const changed = previousEntries.some(
      (previous) => previous.kind !== entry.kind || previous.fingerprint !== entry.fingerprint,
    );
    if (changed && entry.missing.length > 0) {
      errors.push(
        `baseline procedure ${id} changed kind or fingerprint and carries missing ${entry.missing.join(', ')} evidence`,
      );
      continue;
    }

    for (const dimension of entry.missing) {
      if (previousEntries.some((previous) => !previous.missing.includes(dimension))) {
        errors.push(`baseline procedure ${id} reintroduces missing ${dimension} evidence`);
      }
    }
  }
  return errors.sort(compareCanonicalStrings);
}

function validateBaselineAgainstOrigin(baseline, lockedOriginCommit, originProcedures) {
  const errors = [];
  if (baseline.originCommit !== lockedOriginCommit) {
    errors.push(
      `baseline originCommit differs from immutable initial origin ${lockedOriginCommit}`,
    );
    return errors;
  }
  const expected = createBaseline(originProcedures, lockedOriginCommit);
  if (
    JSON.stringify(canonicalBaselineProcedures(baseline.procedures)) !==
    JSON.stringify(expected.procedures)
  ) {
    errors.push('baseline procedures do not match the audit regenerated from originCommit');
  }
  return errors;
}

function gitText(args) {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

function readBaselineHistoryAnchor(baselinePath, readGit = gitText) {
  const relativeBaseline = relPosix(baselinePath);
  if (relativeBaseline.startsWith('../')) {
    throw new Error('real baseline must be inside the repository');
  }
  const additions = readGit(['log', '--diff-filter=A', '--format=%H', '--', relativeBaseline])
    .split('\n')
    .filter(Boolean);
  if (additions.length === 0) {
    throw new Error(`baseline has no committed introduction: ${relativeBaseline}`);
  }
  const introductionCommit = additions.at(-1);
  if (!/^[0-9a-f]{40}$/.test(introductionCommit)) {
    throw new Error('baseline introduction has no valid commit id');
  }
  const initialText = readGit(['show', `${introductionCommit}:${relativeBaseline}`]);
  const duplicateErrors = duplicateJsonKeyErrors(relativeBaseline, initialText);
  if (duplicateErrors.length) {
    throw new Error(`initial committed baseline is invalid: ${duplicateErrors.join('; ')}`);
  }
  const initialBaseline = JSON.parse(initialText);
  if (!/^[0-9a-f]{40}$/.test(initialBaseline.originCommit ?? '')) {
    throw new Error('initial committed baseline has no valid originCommit');
  }
  return { introductionCommit, originCommit: initialBaseline.originCommit };
}

function readCommittedBaselineVersions(baselinePath) {
  const relativeBaseline = relPosix(baselinePath);
  const commits = gitText(['log', '--format=%H', '--', relativeBaseline])
    .split('\n')
    .filter(Boolean);
  const versions = [];
  const errors = [];
  for (const commit of commits) {
    const text = gitText(['show', `${commit}:${relativeBaseline}`]);
    const parsed = parseBaselineDocument(`${commit}:${relativeBaseline}`, text);
    if (parsed.errors.length > 0) {
      errors.push(...parsed.errors.map((error) => `committed baseline ${commit}: ${error}`));
      continue;
    }
    versions.push({ commit, baseline: parsed.baseline });
  }
  return { versions, errors };
}

function gitIsAncestor(ancestor, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 1) {
      return false;
    }
    throw error;
  }
}

function auditCommitSnapshot(commit) {
  const snapshotRoot = mkdtempSync(join(tmpdir(), 'trpc-dod-origin-'));
  try {
    const archive = execFileSync(
      'git',
      ['archive', '--format=tar', commit, 'apps/backend/src', 'apps/backend/vitest.config.ts'],
      { cwd: REPO_ROOT, maxBuffer: 100 * 1024 * 1024 },
    );
    execFileSync('tar', ['-xf', '-', '-C', snapshotRoot], {
      input: archive,
      maxBuffer: 100 * 1024 * 1024,
    });
    const snapshotScriptDir = join(snapshotRoot, 'scripts');
    mkdirSync(snapshotScriptDir, { recursive: true });
    const snapshotScript = join(snapshotScriptDir, 'audit-trpc-dod.mjs');
    copyFileSync(fileURLToPath(import.meta.url), snapshotScript);
    symlinkSync(join(REPO_ROOT, 'node_modules'), join(snapshotRoot, 'node_modules'), 'dir');
    const reportPath = join(snapshotRoot, 'origin-report.json');
    const childOutput = execFileSync(
      process.execPath,
      [snapshotScript, '--real', '--origin-snapshot', '--json-out', reportPath],
      {
        cwd: snapshotRoot,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    if (!existsSync(reportPath)) {
      throw new Error(
        `snapshot audit did not write its report: ${childOutput.slice(0, 500).trim()}`,
      );
    }
    return JSON.parse(readFileSync(reportPath, 'utf8'));
  } finally {
    rmSync(snapshotRoot, { recursive: true, force: true });
  }
}

function validateBaselineSnapshots(
  baseline,
  lockedOriginCommit,
  originProcedures,
  introductionProcedures,
) {
  const errors = validateBaselineAgainstOrigin(baseline, lockedOriginCommit, originProcedures);
  const originExpected = createBaseline(originProcedures, lockedOriginCommit);
  const introductionExpected = createBaseline(introductionProcedures, lockedOriginCommit);
  if (
    JSON.stringify(originExpected.procedures) !== JSON.stringify(introductionExpected.procedures)
  ) {
    errors.push(
      'baseline-defining router or evidence changed between originCommit and baseline introduction',
    );
  }
  return errors;
}

function verifyBaselineHistory(baselinePath, baseline) {
  if (!/^[0-9a-f]{40}$/.test(baseline.originCommit ?? '')) return [];
  const { introductionCommit, originCommit: lockedOriginCommit } =
    readBaselineHistoryAnchor(baselinePath);
  const relativeBaseline = relPosix(baselinePath);
  const initialDocument = parseBaselineDocument(
    `${introductionCommit}:${relativeBaseline}`,
    gitText(['show', `${introductionCommit}:${relativeBaseline}`]),
  );
  if (initialDocument.errors.length > 0) {
    return initialDocument.errors.map((error) => `initial committed baseline is invalid: ${error}`);
  }
  const initialBaseline = initialDocument.baseline;
  const originReport = auditCommitSnapshot(lockedOriginCommit);
  const introductionReport = auditCommitSnapshot(introductionCommit);
  const errors = originReport.structuralErrors.map(
    (error) => `originCommit audit is structurally invalid: ${error}`,
  );
  errors.push(
    ...introductionReport.structuralErrors.map(
      (error) => `baseline introduction audit is structurally invalid: ${error}`,
    ),
  );
  if (!gitIsAncestor(lockedOriginCommit, introductionCommit)) {
    errors.push('locked originCommit is not an ancestor of the baseline introduction');
  }
  errors.push(
    ...validateBaselineSnapshots(
      initialBaseline,
      lockedOriginCommit,
      originReport.procedures,
      introductionReport.procedures,
    ),
  );
  const committed = readCommittedBaselineVersions(baselinePath);
  errors.push(...committed.errors);
  const committedBaselines = committed.versions.map((version) => version.baseline);
  for (let index = 0; index < committed.versions.length - 1; index += 1) {
    const version = committed.versions[index];
    errors.push(
      ...validateBaselineEvolution(
        version.baseline,
        initialBaseline,
        committedBaselines.slice(index + 1),
      ).map((error) => `committed baseline ${version.commit}: ${error}`),
    );
  }
  const currentCanonical = JSON.stringify(canonicalBaselineProcedures(baseline.procedures));
  const currentMatchesLatestCommit =
    committedBaselines.length > 0 &&
    JSON.stringify(canonicalBaselineProcedures(committedBaselines[0].procedures)) ===
      currentCanonical &&
    committedBaselines[0].originCommit === baseline.originCommit;
  if (!currentMatchesLatestCommit) {
    errors.push(...validateBaselineEvolution(baseline, initialBaseline, committedBaselines));
  }
  return errors;
}

function duplicateJsonKeyErrors(filePath, text) {
  const sourceFile = ts.parseJsonText(filePath, text);
  const errors = sourceFile.parseDiagnostics.map(
    (diagnostic) =>
      `baseline JSON parse error: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`,
  );
  const root = sourceFile.statements[0]?.expression;

  function visit(node, path) {
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Set();
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = propertyNameText(property.name);
        if (name === null) continue;
        if (seen.has(name)) errors.push(`duplicate baseline JSON key ${path}.${name}`);
        seen.add(name);
        visit(property.initializer, `${path}.${name}`);
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach((element, index) => visit(element, `${path}[${index}]`));
    }
  }

  if (root) visit(root, '$');
  return errors;
}

function parseBaselineDocument(filePath, text) {
  const errors = duplicateJsonKeyErrors(filePath, text);
  let baseline;
  try {
    baseline = JSON.parse(text);
  } catch (error) {
    return {
      baseline: { version: null, originCommit: null, procedures: {} },
      errors: [...errors, `baseline JSON is invalid: ${error.message}`],
    };
  }

  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) {
    return {
      baseline: { version: null, originCommit: null, procedures: {} },
      errors: [...errors, 'baseline root must be an object'],
    };
  }
  const unexpectedRoot = Object.keys(baseline).filter(
    (key) => key !== 'version' && key !== 'originCommit' && key !== 'procedures',
  );
  if (unexpectedRoot.length) {
    errors.push(`baseline has unknown root fields: ${unexpectedRoot.sort().join(', ')}`);
  }
  if (baseline.version !== 1) errors.push('baseline version must be 1');
  if (!/^[0-9a-f]{40}$/.test(baseline.originCommit ?? '')) {
    errors.push('baseline originCommit must be a full lowercase 40-character Git SHA');
  }
  if (
    !baseline.procedures ||
    typeof baseline.procedures !== 'object' ||
    Array.isArray(baseline.procedures)
  ) {
    errors.push('baseline procedures must be an object');
    baseline.procedures = {};
  }
  for (const [id, entry] of Object.entries(baseline.procedures)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`baseline procedure ${id} must be an object`);
      continue;
    }
    const unexpected = Object.keys(entry).filter(
      (key) => key !== 'kind' && key !== 'fingerprint' && key !== 'missing',
    );
    if (unexpected.length) {
      errors.push(`baseline procedure ${id} has unknown fields: ${unexpected.sort().join(', ')}`);
    }
    if (!['query', 'mutation', 'subscription'].includes(entry.kind)) {
      errors.push(`baseline procedure ${id} has invalid kind`);
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(entry.fingerprint ?? '')) {
      errors.push(`baseline procedure ${id} has invalid fingerprint`);
    }
    if (
      !Array.isArray(entry.missing) ||
      entry.missing.some((dimension) => dimension !== 'happy' && dimension !== 'error') ||
      new Set(entry.missing).size !== entry.missing.length ||
      JSON.stringify(entry.missing) !==
        JSON.stringify(['happy', 'error'].filter((dimension) => entry.missing.includes(dimension)))
    ) {
      errors.push(`baseline procedure ${id} has invalid missing dimensions`);
    }
    if (entry.kind === 'subscription' && entry.missing?.length !== 0) {
      errors.push(`baseline subscription ${id} must not carry query/mutation debt`);
    }
  }
  return { baseline, errors: [...new Set(errors)].sort(compareCanonicalStrings) };
}

function readAndValidateBaseline(filePath) {
  return parseBaselineDocument(filePath, readFileSync(filePath, 'utf8'));
}

function buildReport({
  mode,
  procedures,
  invalid,
  orphanEvidence,
  baseline = null,
  baselineErrors = [],
}) {
  const enriched = procedures.map((p) => {
    const { status, missing } = classifyProcedure(p);
    const baselineEntry = baseline?.procedures?.[p.id] ?? null;
    const baselineMissing = Array.isArray(baselineEntry?.missing)
      ? baselineEntry.missing.filter((dimension) => dimension === 'happy' || dimension === 'error')
      : [];
    return {
      ...p,
      evidence: {
        happy: [...p.evidence.happy].sort((a, b) =>
          compareCanonicalTuples(
            [a.testFile, a.title, a.mode, a.contract, a.rationale],
            [b.testFile, b.title, b.mode, b.contract, b.rationale],
          ),
        ),
        error: [...p.evidence.error].sort((a, b) =>
          compareCanonicalTuples(
            [a.testFile, a.title, a.mode, a.contract, a.rationale],
            [b.testFile, b.title, b.mode, b.contract, b.rationale],
          ),
        ),
      },
      status,
      missing,
      baseline: baseline
        ? baselineEntry
          ? {
              missing: baselineMissing,
              legacyDebt: baselineMissing.length > 0,
              changed: baselineEntry.kind !== p.kind || baselineEntry.fingerprint !== p.fingerprint,
              new: false,
            }
          : {
              missing: null,
              legacyDebt: false,
              changed: false,
              new: true,
            }
        : null,
    };
  });
  enriched.sort((a, b) =>
    compareCanonicalTuples([a.id, a.kind, a.sourceFile], [b.id, b.kind, b.sourceFile]),
  );

  const qm = enriched.filter((p) => p.kind !== 'subscription');
  const subs = enriched.filter((p) => p.kind === 'subscription');
  const invalidEvidence = invalid
    .map(({ entry, problems }) => ({
      procedure: entry.procedure ?? null,
      title: entry.title ?? null,
      testFile: entry.testFile,
      problems,
    }))
    .sort((a, b) =>
      compareCanonicalTuples(
        [a.testFile, a.procedure, a.title, a.problems],
        [b.testFile, b.procedure, b.title, b.problems],
      ),
    );
  const canonicalOrphanEvidence = orphanEvidence
    .map((entry) => ({
      procedure: entry.procedure,
      title: entry.title,
      testFile: entry.testFile,
    }))
    .sort((a, b) =>
      compareCanonicalTuples(
        [a.testFile, a.procedure, a.title],
        [b.testFile, b.procedure, b.title],
      ),
    );
  const structuralErrors = [
    ...baselineErrors,
    ...invalidEvidence.map(
      (entry) =>
        `invalid evidence ${entry.testFile}:${entry.procedure ?? '<unknown>'}: ${entry.problems.join('; ')}`,
    ),
    ...canonicalOrphanEvidence.map(
      (entry) => `unknown procedure evidence ${entry.testFile}:${entry.procedure}`,
    ),
  ].sort(compareCanonicalStrings);
  const legacy = enriched.filter(
    (procedure) => procedure.kind !== 'subscription' && procedure.baseline?.legacyDebt,
  );
  const gateViolations = [];
  const baselineChanges = [];

  if (baseline && baselineErrors.length === 0) {
    for (const procedure of enriched) {
      const baselineEntry = baseline.procedures[procedure.id] ?? null;
      if (!baselineEntry) {
        baselineChanges.push({
          procedure: procedure.id,
          kind: procedure.kind,
          change: 'add',
          missing: procedure.missing,
          message: `${procedure.id}: add ${procedure.kind} to baseline (missing: ${procedure.missing.join(', ') || 'none'})`,
        });
        if (procedure.kind !== 'subscription' && procedure.missing.length > 0) {
          gateViolations.push({
            procedure: procedure.id,
            kind: procedure.kind,
            change: 'new',
            missing: procedure.missing,
            message: `${procedure.id}: new ${procedure.kind} missing ${procedure.missing.join(', ')} evidence`,
          });
        }
        continue;
      }

      const sourceChanged =
        baselineEntry.kind !== procedure.kind ||
        baselineEntry.fingerprint !== procedure.fingerprint;
      if (sourceChanged) {
        baselineChanges.push({
          procedure: procedure.id,
          kind: procedure.kind,
          change: 'refresh_fingerprint',
          missing: procedure.missing,
          message: `${procedure.id}: refresh changed ${procedure.kind} baseline (missing: ${procedure.missing.join(', ') || 'none'})`,
        });
        if (procedure.kind !== 'subscription' && procedure.missing.length > 0) {
          gateViolations.push({
            procedure: procedure.id,
            kind: procedure.kind,
            change: 'changed',
            missing: procedure.missing,
            message: `${procedure.id}: changed ${procedure.kind} missing ${procedure.missing.join(', ')} evidence`,
          });
        }
        continue;
      }

      if (procedure.kind === 'subscription') continue;
      const baselineMissing = procedure.baseline?.missing ?? [];
      const comparison = compareMissingDebt(
        { [procedure.id]: baselineMissing },
        { [procedure.id]: procedure.missing },
      );
      const newlyMissing = procedure.missing.filter(
        (dimension) => !baselineMissing.includes(dimension),
      );
      if (!comparison.ok) {
        gateViolations.push({
          procedure: procedure.id,
          kind: procedure.kind,
          change: 'evidence_regression',
          missing: newlyMissing,
          message: `${procedure.id}: unchanged ${procedure.kind} lost ${newlyMissing.join(', ')} evidence`,
        });
      }
      if (JSON.stringify(procedure.missing) !== JSON.stringify(baselineMissing)) {
        const reduced = procedure.missing.length < baselineMissing.length && comparison.ok;
        baselineChanges.push({
          procedure: procedure.id,
          kind: procedure.kind,
          change: reduced ? 'reduce_debt' : 'increase_debt',
          missing: procedure.missing,
          message: `${procedure.id}: ${reduced ? 'reduce' : 'increase'} baseline debt to ${procedure.missing.join(', ') || 'none'}`,
        });
      }
    }

    const currentIds = new Set(enriched.map((procedure) => procedure.id));
    for (const [id, entry] of Object.entries(baseline.procedures)) {
      if (currentIds.has(id)) continue;
      baselineChanges.push({
        procedure: id,
        kind: entry.kind,
        change: 'remove_deleted',
        missing: [],
        message: `${id}: remove deleted ${entry.kind} from baseline (missing: none)`,
      });
    }
  }

  gateViolations.sort((left, right) =>
    compareCanonicalTuples(
      [left.procedure, left.change, left.missing],
      [right.procedure, right.change, right.missing],
    ),
  );
  baselineChanges.sort((left, right) =>
    compareCanonicalTuples(
      [left.procedure, left.change, left.missing],
      [right.procedure, right.change, right.missing],
    ),
  );

  return {
    version: 1,
    mode,
    limits: [
      'Static audit proves helper metadata, canonical import binding, and inventory — not assertion quality.',
      'Arbitrary caller it() tests are ignored by design.',
      'Only trpcDodIt bindings imported from the canonical helper module count.',
      'Evidence inside describe.skip / it.skip (and skipIf) is rejected.',
      'Subscriptions appear in the inventory but are outside the query/mutation gate.',
    ],
    procedures: enriched,
    baseline: baseline
      ? {
          version: baseline.version,
          originCommit: baseline.originCommit,
        }
      : null,
    invalidEvidence,
    orphanEvidence: canonicalOrphanEvidence,
    structuralErrors,
    gateViolations,
    baselineChanges,
    summary: {
      queriesMutations: qm.length,
      subscriptions: subs.length,
      complete: qm.filter((p) => p.status === 'complete').length,
      incomplete: qm.filter((p) => p.status === 'incomplete').length,
      untested: qm.filter((p) => p.status === 'untested').length,
      invalidEvidence: invalid.length,
      orphanEvidence: orphanEvidence.length,
      legacyProcedures: legacy.length,
      legacyMissingDimensions: legacy.reduce(
        (sum, procedure) => sum + procedure.baseline.missing.length,
        0,
      ),
      changedSinceBaseline: enriched.filter((procedure) => procedure.baseline?.changed).length,
      newSinceBaseline: enriched.filter((procedure) => procedure.baseline?.new).length,
      gateViolations: gateViolations.length,
      baselineChanges: baselineChanges.length,
      structuralErrors: structuralErrors.length,
    },
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# tRPC DoD Audit');
  lines.push('');
  lines.push(`Mode: \`${report.mode}\``);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Queries/Mutations: ${report.summary.queriesMutations}`);
  lines.push(`- Subscriptions: ${report.summary.subscriptions}`);
  lines.push(`- Complete: ${report.summary.complete}`);
  lines.push(`- Incomplete: ${report.summary.incomplete}`);
  lines.push(`- Untested: ${report.summary.untested}`);
  if (report.baseline) {
    lines.push(`- Legacy procedures with debt: ${report.summary.legacyProcedures}`);
    lines.push(`- Legacy missing dimensions: ${report.summary.legacyMissingDimensions}`);
    lines.push(`- Changed since baseline: ${report.summary.changedSinceBaseline}`);
    lines.push(`- New since baseline: ${report.summary.newSinceBaseline}`);
    lines.push(`- Gate violations: ${report.summary.gateViolations}`);
    lines.push(`- Baseline changes required: ${report.summary.baselineChanges}`);
    lines.push(`- Structural errors: ${report.summary.structuralErrors}`);
    lines.push(`- Baseline origin: \`${report.baseline.originCommit}\``);
  }
  lines.push('');
  lines.push('## Procedures');
  lines.push('');
  for (const p of report.procedures) {
    const miss = p.missing.length ? ` missing=${p.missing.join(',')}` : '';
    const legacy = p.baseline?.legacyDebt ? ` legacy=${p.baseline.missing.join(',')}` : '';
    const changed = p.baseline?.changed ? ' changed-since-baseline' : '';
    const isNew = p.baseline?.new ? ' new-since-baseline' : '';
    lines.push(
      `- \`${p.id}\` (${p.kind}) → **${p.status}**${miss}${legacy}${changed}${isNew} · \`${p.fingerprint.slice(0, 15)}…\``,
    );
  }
  if (report.invalidEvidence.length) {
    lines.push('');
    lines.push('## Invalid evidence');
    lines.push('');
    for (const e of report.invalidEvidence) {
      lines.push(`- ${e.testFile}: ${e.problems.join('; ')}`);
    }
  }
  if (report.gateViolations.length) {
    lines.push('');
    lines.push('## Gate violations');
    lines.push('');
    for (const violation of report.gateViolations) lines.push(`- ${violation.message}`);
  }
  if (report.baselineChanges.length) {
    lines.push('');
    lines.push('## Baseline changes required');
    lines.push('');
    for (const change of report.baselineChanges) lines.push(`- ${change.message}`);
    lines.push('');
    lines.push(
      'Run `npm run audit:trpc-dod -- --update-baseline` after resolving gate violations.',
    );
  }
  if (report.structuralErrors.length) {
    lines.push('');
    lines.push('## Structural errors');
    lines.push('');
    for (const error of report.structuralErrors) lines.push(`- ${error}`);
  }
  lines.push('');
  lines.push('## Static limits');
  lines.push('');
  for (const lim of report.limits) lines.push(`- ${lim}`);
  lines.push('');
  return lines.join('\n');
}

function ensureParent(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeBaselineAtomically(filePath, baseline) {
  ensureParent(filePath);
  const lockPath = `${filePath}.lock`;
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  try {
    writeFileSync(lockPath, `${process.pid}\n`, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new Error(`Refusing concurrent baseline update; lock exists: ${lockPath}`, {
        cause: error,
      });
    }
    throw error;
  }
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(baseline, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    renameSync(temporaryPath, filePath);
  } finally {
    rmSync(temporaryPath, { force: true });
    rmSync(lockPath, { force: true });
  }
}

function runAudit({
  routerPath,
  prefix,
  evidencePaths,
  evidenceExcludes = [],
  evidenceFilePredicate = null,
  mode,
  routerTree = false,
  baselinePath = null,
  verifyHistory = false,
}) {
  const knownContracts = loadKnownContractsFromHelper();
  const procedures = routerTree
    ? inventariseRouterTree(routerPath)
    : inventariseRouterFile(routerPath, prefix);
  const evidenceFiles = evidencePaths
    .flatMap((p) => walkFiles(resolve(p)))
    .filter((filePath) => !evidenceExcludes.some((dir) => isPathInside(filePath, dir)))
    .filter((filePath) => !evidenceFilePredicate || evidenceFilePredicate(filePath))
    .filter((filePath) => {
      const text = readFileSync(filePath, 'utf8');
      return text.includes('trpc-dod-evidence') || /\b(?:trpcDodIt|dodIt)\s*\(/.test(text);
    })
    .sort((a, b) => compareCanonicalStrings(relPosix(a), relPosix(b)));
  const evidenceEntries = [];
  const rejected = [];
  for (const f of evidenceFiles) {
    const { entries, rejected: fileRejected } = collectEvidenceFromFile(f);
    evidenceEntries.push(...entries);
    rejected.push(...fileRejected);
  }
  const { invalid, orphanEvidence } = attachEvidence(
    procedures,
    evidenceEntries,
    rejected,
    knownContracts,
  );
  const baselineResult = baselinePath
    ? readAndValidateBaseline(baselinePath)
    : { baseline: null, errors: [] };
  if (baselinePath && verifyHistory && baselineResult.errors.length === 0) {
    try {
      baselineResult.errors.push(...verifyBaselineHistory(baselinePath, baselineResult.baseline));
    } catch (error) {
      baselineResult.errors.push(
        `baseline history verification failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  return buildReport({
    mode,
    procedures,
    invalid,
    orphanEvidence,
    baseline: baselineResult.baseline,
    baselineErrors: baselineResult.errors,
  });
}

function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (args.real && args.poc) throw new Error('--real and --poc are mutually exclusive');
  if (args.writeBaseline && args.updateBaseline) {
    throw new Error('--write-baseline and --update-baseline are mutually exclusive');
  }

  let routerPath;
  let prefix;
  let evidencePaths;
  let mode;
  let routerTree = false;
  let baselinePath = null;
  let evidenceExcludes = [];

  if (args.real) {
    mode = args.originSnapshot ? 'origin' : 'real';
    routerPath = DEFAULT_REAL_ROUTER;
    prefix = null;
    evidencePaths = DEFAULT_REAL_EVIDENCE_DIRS;
    evidenceExcludes = DEFAULT_REAL_EVIDENCE_EXCLUDES;
    routerTree = true;
    baselinePath = args.originSnapshot ? null : resolve(args.baseline ?? DEFAULT_BASELINE);
    assertBackendVitestContract();
  } else if (args.poc) {
    mode = 'poc';
    routerPath = DEFAULT_POC_ROUTER;
    prefix = 'dodPoc';
    evidencePaths = DEFAULT_POC_EVIDENCE_DIRS;
  } else {
    mode = 'custom';
    if (!args.router || !args.prefix || args.evidence.length === 0) {
      throw new Error(`--router, --prefix and --evidence are required (or use --poc)\n${usage()}`);
    }
    routerPath = resolve(args.router);
    prefix = args.prefix;
    evidencePaths = args.evidence.map((p) => resolve(p));
  }

  if (!existsSync(routerPath)) {
    throw new Error(`Router file not found: ${routerPath}`);
  }

  if (args.writeBaseline) {
    if (!args.real) throw new Error('--write-baseline is only supported with --real');
    if (!args.originCommit) throw new Error('--origin-commit is required with --write-baseline');
    const procedures = inventariseRouterTree(routerPath);
    const baseline = createBaseline(procedures, args.originCommit);
    ensureParent(baselinePath);
    try {
      writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, {
        flag: 'wx',
        mode: 0o600,
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
        throw new Error(`Refusing to overwrite existing baseline: ${baselinePath}`, {
          cause: error,
        });
      }
      throw error;
    }
    process.stdout.write(
      `Wrote ${procedures.length} procedures to ${relPosix(baselinePath)} (origin ${args.originCommit}).\n`,
    );
    return 0;
  }

  let report = runAudit({
    routerPath,
    prefix,
    evidencePaths,
    evidenceExcludes,
    evidenceFilePredicate:
      mode === 'real' || mode === 'origin' ? (filePath) => isBackendVitestTestFile(filePath) : null,
    mode,
    routerTree,
    baselinePath,
    verifyHistory: mode === 'real',
  });

  if (args.updateBaseline) {
    if (!args.real) throw new Error('--update-baseline is only supported with --real');
    if (report.structuralErrors.length > 0) {
      process.stderr.write(
        `Refusing baseline update with structural errors:\n${report.structuralErrors.map((error) => `- ${error}`).join('\n')}\n`,
      );
      return 2;
    }
    if (report.gateViolations.length > 0) {
      process.stderr.write(
        `Refusing baseline update with gate violations:\n${report.gateViolations.map((violation) => `- ${violation.message}`).join('\n')}\n`,
      );
      return 1;
    }
    const candidate = createBaseline(report.procedures, report.baseline.originCommit);
    const candidateHistoryErrors = verifyBaselineHistory(baselinePath, candidate);
    if (candidateHistoryErrors.length > 0) {
      process.stderr.write(
        `Refusing non-monotonic baseline update:\n${candidateHistoryErrors.map((error) => `- ${error}`).join('\n')}\n`,
      );
      return 2;
    }
    writeBaselineAtomically(baselinePath, candidate);
    report = runAudit({
      routerPath,
      prefix,
      evidencePaths,
      evidenceExcludes,
      evidenceFilePredicate: (filePath) => isBackendVitestTestFile(filePath),
      mode,
      routerTree,
      baselinePath,
      verifyHistory: true,
    });
  }
  const md = renderMarkdown(report);
  process.stdout.write(`${md}\n`);

  if (args.jsonOut) {
    const out = resolve(args.jsonOut);
    ensureParent(out);
    writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (args.mdOut) {
    const out = resolve(args.mdOut);
    ensureParent(out);
    writeFileSync(out, md.endsWith('\n') ? md : `${md}\n`);
  }

  if (mode === 'real' && report.structuralErrors.length) return 2;
  if (args.failOnIncomplete) {
    const bad = report.procedures.some((p) => p.kind !== 'subscription' && p.status !== 'complete');
    if (bad || report.invalidEvidence.length || report.orphanEvidence.length) {
      return 1;
    }
  }
  if (mode === 'real' && (report.gateViolations.length > 0 || report.baselineChanges.length > 0)) {
    return 1;
  }
  return 0;
}

export {
  inventariseRouterFile,
  inventariseRouterTree,
  collectEvidenceFromFile,
  attachEvidence,
  buildReport,
  classifyProcedure,
  fingerprintSource,
  normalizeProcedureSource,
  validateEvidenceMeta,
  compareMissingDebt,
  createBaseline,
  validateBaselineEvolution,
  validateBaselineAgainstOrigin,
  validateBaselineSnapshots,
  readBaselineHistoryAnchor,
  readAndValidateBaseline,
  writeBaselineAtomically,
  readBackendVitestIncludes,
  isBackendVitestTestFile,
  loadKnownContractsFromHelper,
  runAudit,
  CANONICAL_HELPER_REL,
  runCli,
};

const invokedAsCli =
  Boolean(process.argv[1]) &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]));

if (invokedAsCli) {
  try {
    process.exitCode = runCli();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 2;
  }
}
