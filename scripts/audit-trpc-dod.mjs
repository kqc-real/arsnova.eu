#!/usr/bin/env node
/**
 * tRPC DoD audit (ADR-0034 / Issue #222).
 *
 * Slice 2A: PoC mode over fixture routers + helper evidence.
 * No blocking production gate in this slice.
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_POC_ROUTER = join(
  REPO_ROOT,
  'apps/backend/src/__tests__/trpc-dod-poc/fixture-router.ts',
);
const DEFAULT_POC_EVIDENCE_GLOBS = [
  join(REPO_ROOT, 'apps/backend/src/__tests__/trpc-dod-poc'),
  join(REPO_ROOT, 'apps/backend/src/__tests__/test-utils'),
];

const HELPER_CALLEES = new Set(['trpcDodIt', 'dodIt']);

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
    else if (a === '--help' || a === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${a}\n${usage()}`);
    }
  }
  return args;
}

function walkFiles(root, acc = []) {
  const st = statSync(root);
  if (st.isFile()) {
    if (/\.(ts|tsx|mts|cts)$/.test(root)) acc.push(root);
    return acc;
  }
  for (const name of readdirSync(root)) {
    if (name === 'node_modules' || name === 'dist') continue;
    walkFiles(join(root, name), acc);
  }
  return acc;
}

function normalizeProcedureSource(text) {
  let s = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  s = s.replace(/(^|[^:])\/\/.*$/gm, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  // Collapse insignificant spaces around punctuation so formatting-only edits
  // do not change fingerprints (identifiers/keywords stay space-separated).
  s = s.replace(/\s*([()[\]{};,:])\s*/g, '$1');
  s = s.replace(/\s*=>\s*/g, '=>');
  return s;
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
        sourceFile: relative(REPO_ROOT, filePath).replaceAll('\\', '/'),
        fingerprint: fingerprintSource(found.kind, id, raw),
        evidence: { happy: [], error: [] },
      });
    }
  }

  procedures.sort((a, b) => a.id.localeCompare(b.id));
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

function collectEvidenceFromFile(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const entries = [];

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (HELPER_CALLEES.has(node.expression.text) && node.arguments.length >= 1) {
        const meta = extractEvidenceObject(node.arguments[0]);
        const fn = node.arguments[1];
        if (meta) {
          entries.push({
            ...meta,
            testFile: relative(REPO_ROOT, filePath).replaceAll('\\', '/'),
            emptyBody: isEmptyFunctionBody(fn),
            skipped: false,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return entries;
}

function validateEvidenceMeta(entry) {
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
    } else {
      const known = new Set([
        'UNAUTHORIZED',
        'FORBIDDEN',
        'VALIDATION',
        'NOT_FOUND',
        'CONFLICT',
      ]);
      if (!known.has(entry.contract) && !/^DOMAIN:[A-Za-z][A-Za-z0-9_:-]*$/.test(entry.contract)) {
        problems.push(`meaningless contract ${JSON.stringify(entry.contract)}`);
      }
    }
  }
  if (entry.mode === 'indirect' && (!entry.rationale || !String(entry.rationale).trim())) {
    problems.push('indirect evidence requires rationale');
  }
  if (entry.emptyBody) {
    problems.push('empty test body');
  }
  return problems;
}

function attachEvidence(procedures, evidenceEntries) {
  const byId = new Map(procedures.map((p) => [p.id, p]));
  const invalid = [];
  const orphanEvidence = [];

  for (const entry of evidenceEntries) {
    const problems = validateEvidenceMeta(entry);
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
    return {
      status: 'subscription_report_only',
      missing: [],
    };
  }
  const missing = [];
  if (proc.evidence.happy.length === 0) missing.push('happy');
  if (proc.evidence.error.length === 0) missing.push('error');
  if (missing.length === 2) return { status: 'untested', missing };
  if (missing.length > 0) return { status: 'incomplete', missing };
  return { status: 'complete', missing: [] };
}

function buildReport({ mode, procedures, invalid, orphanEvidence }) {
  const enriched = procedures.map((p) => {
    const { status, missing } = classifyProcedure(p);
    return { ...p, status, missing };
  });

  const qm = enriched.filter((p) => p.kind !== 'subscription');
  const subs = enriched.filter((p) => p.kind === 'subscription');

  return {
    version: 1,
    mode,
    generatedAt: new Date().toISOString(),
    limits: [
      'Static audit proves helper metadata and inventory, not assertion quality.',
      'Arbitrary caller it() tests are ignored by design.',
      'Subscriptions appear in the inventory but are outside the query/mutation gate.',
    ],
    procedures: enriched,
    invalidEvidence: invalid.map(({ entry, problems }) => ({
      procedure: entry.procedure ?? null,
      title: entry.title ?? null,
      testFile: entry.testFile,
      problems,
    })),
    orphanEvidence: orphanEvidence.map((e) => ({
      procedure: e.procedure,
      title: e.title,
      testFile: e.testFile,
    })),
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
  lines.push(`Generated: ${report.generatedAt}`);
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
    evidencePaths = DEFAULT_POC_EVIDENCE_GLOBS;
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

  const procedures = inventariseRouterFile(routerPath, prefix);
  const evidenceFiles = evidencePaths.flatMap((p) => walkFiles(resolve(p)));
  const evidenceEntries = evidenceFiles.flatMap((f) => collectEvidenceFromFile(f));
  const { invalid, orphanEvidence } = attachEvidence(procedures, evidenceEntries);
  const report = buildReport({ mode, procedures, invalid, orphanEvidence });

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
    const bad = report.procedures.some(
      (p) => p.kind !== 'subscription' && p.status !== 'complete',
    );
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
