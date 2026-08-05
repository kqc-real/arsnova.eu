#!/usr/bin/env node
/**
 * tRPC DoD audit (ADR-0034 / Issue #222).
 *
 * Slice 2A: PoC mode over fixture routers + helper evidence.
 * No blocking production gate in this slice.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
  node scripts/audit-trpc-dod.mjs --poc [--json-out path] [--md-out path]
  node scripts/audit-trpc-dod.mjs --router <file> --prefix <id> --evidence <dir|file> [--json-out path]

Options:
  --poc                 Audit the Slice-2A fixture router and evidence tests
  --router <file>       TypeScript file containing router({ ... })
  --prefix <id>         Procedure id prefix (e.g. dodPoc)
  --evidence <path>     File or directory with trpcDodIt call sites (repeatable)
  --json-out <path>     Write machine-readable report
  --md-out <path>       Write human-readable markdown summary
  --fail-on-incomplete  Exit 1 when any query/mutation is incomplete/untested
                        (default: off; not a CI gate in Slice 2A)
`;
}

function parseArgs(argv) {
  const args = {
    poc: false,
    router: null,
    prefix: null,
    evidence: [],
    jsonOut: null,
    mdOut: null,
    failOnIncomplete: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--poc') args.poc = true;
    else if (a === '--fail-on-incomplete') args.failOnIncomplete = true;
    else if (a === '--router') args.router = argv[++i];
    else if (a === '--prefix') args.prefix = argv[++i];
    else if (a === '--evidence') args.evidence.push(argv[++i]);
    else if (a === '--json-out') args.jsonOut = argv[++i];
    else if (a === '--md-out') args.mdOut = argv[++i];
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

function relPosix(filePath) {
  return relative(REPO_ROOT, filePath).replaceAll('\\', '/');
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

function collectEvidenceFromFile(filePath, knownContracts) {
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

  for (const entry of evidenceEntries) {
    const problems = validateEvidenceMeta(entry, knownContracts);
    if (problems.length) {
      invalid.push({ entry, problems });
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

function buildReport({ mode, procedures, invalid, orphanEvidence }) {
  const enriched = procedures.map((p) => {
    const { status, missing } = classifyProcedure(p);
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
    invalidEvidence,
    orphanEvidence: canonicalOrphanEvidence,
    summary: {
      queriesMutations: qm.length,
      subscriptions: subs.length,
      complete: qm.filter((p) => p.status === 'complete').length,
      incomplete: qm.filter((p) => p.status === 'incomplete').length,
      untested: qm.filter((p) => p.status === 'untested').length,
      invalidEvidence: invalid.length,
      orphanEvidence: orphanEvidence.length,
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
  lines.push('');
  lines.push('## Procedures');
  lines.push('');
  for (const p of report.procedures) {
    const miss = p.missing.length ? ` missing=${p.missing.join(',')}` : '';
    lines.push(
      `- \`${p.id}\` (${p.kind}) → **${p.status}**${miss} · \`${p.fingerprint.slice(0, 15)}…\``,
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

function runAudit({ routerPath, prefix, evidencePaths, mode }) {
  const knownContracts = loadKnownContractsFromHelper();
  const procedures = inventariseRouterFile(routerPath, prefix);
  const evidenceFiles = evidencePaths
    .flatMap((p) => walkFiles(resolve(p)))
    .sort((a, b) => compareCanonicalStrings(relPosix(a), relPosix(b)));
  const evidenceEntries = [];
  const rejected = [];
  for (const f of evidenceFiles) {
    const { entries, rejected: fileRejected } = collectEvidenceFromFile(f, knownContracts);
    evidenceEntries.push(...entries);
    rejected.push(...fileRejected);
  }
  const { invalid, orphanEvidence } = attachEvidence(
    procedures,
    evidenceEntries,
    rejected,
    knownContracts,
  );
  return buildReport({ mode, procedures, invalid, orphanEvidence });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  let routerPath;
  let prefix;
  let evidencePaths;
  let mode;

  if (args.poc) {
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

  const report = runAudit({ routerPath, prefix, evidencePaths, mode });
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

  if (args.failOnIncomplete) {
    const bad = report.procedures.some((p) => p.kind !== 'subscription' && p.status !== 'complete');
    if (bad || report.invalidEvidence.length || report.orphanEvidence.length) {
      return 1;
    }
  }
  return 0;
}

export {
  inventariseRouterFile,
  collectEvidenceFromFile,
  attachEvidence,
  buildReport,
  classifyProcedure,
  fingerprintSource,
  normalizeProcedureSource,
  validateEvidenceMeta,
  compareMissingDebt,
  loadKnownContractsFromHelper,
  runAudit,
  CANONICAL_HELPER_REL,
};

const invokedAsCli =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedAsCli) {
  try {
    process.exitCode = main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 2;
  }
}
