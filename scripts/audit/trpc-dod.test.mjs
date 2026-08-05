import assert from 'node:assert/strict';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const auditScript = join(repoRoot, 'scripts/audit-trpc-dod.mjs');
const helperImport = '../test-utils/trpc-dod-evidence';

function addFormalEvidence(procedure, ...dimensions) {
  for (const dimension of dimensions) {
    procedure.evidence[dimension].push({
      mode: 'direct',
      contract: dimension === 'error' ? 'NOT_FOUND' : null,
      rationale: null,
      title: `${procedure.id} ${dimension}`,
      testFile: 'demo.test.ts',
    });
  }
}

function buildRealReport(buildReport, procedures, baseline) {
  return buildReport({
    mode: 'real',
    procedures,
    invalid: [],
    orphanEvidence: [],
    baseline,
    baselineErrors: [],
  });
}

async function loadAudit() {
  return import(new URL('../audit-trpc-dod.mjs', import.meta.url).href);
}

function writeTempRouter(dir, body) {
  const file = join(dir, 'router.ts');
  writeFileSync(file, body);
  return file;
}

function writeTempEvidence(dir, body, name = 'evidence.test.ts') {
  const file = join(dir, name);
  writeFileSync(file, body);
  return file;
}

function withCanonicalImport(body) {
  return `import { trpcDodIt } from '${helperImport}';\n${body}`;
}

function runCommand(command, args, cwd) {
  const run = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  return run.stdout.trim();
}

function createHistoryFixture(root) {
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'apps/backend/src/routers'), { recursive: true });
  mkdirSync(join(root, 'apps/backend/src/__tests__/test-utils'), { recursive: true });
  copyFileSync(auditScript, join(root, 'scripts/audit-trpc-dod.mjs'));
  symlinkSync(join(repoRoot, 'node_modules'), join(root, 'node_modules'), 'dir');
  writeFileSync(
    join(root, 'apps/backend/vitest.config.ts'),
    `export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });\n`,
  );
  writeFileSync(
    join(root, 'apps/backend/src/routers/index.ts'),
    `import { demoRouter } from './demo';
export const appRouter = router({ demo: demoRouter });
`,
  );
  writeFileSync(
    join(root, 'apps/backend/src/routers/demo.ts'),
    `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 1),
});
`,
  );
  writeFileSync(
    join(root, 'apps/backend/src/__tests__/test-utils/trpc-dod-evidence.ts'),
    `export const TRPC_DOD_KNOWN_CONTRACTS = ['NOT_FOUND'] as const;\n`,
  );

  runCommand('git', ['init', '-b', 'main'], root);
  runCommand('git', ['config', 'user.name', 'tRPC DoD Test'], root);
  runCommand('git', ['config', 'user.email', 'trpc-dod@example.invalid'], root);
  runCommand('git', ['config', 'core.hooksPath', '/dev/null'], root);
  runCommand('git', ['add', 'apps', 'scripts'], root);
  runCommand('git', ['commit', '-m', 'origin'], root);
  const originCommit = runCommand('git', ['rev-parse', 'HEAD'], root);

  runCommand('git', ['switch', '-c', 'feature'], root);
  runCommand(
    process.execPath,
    [
      join(root, 'scripts/audit-trpc-dod.mjs'),
      '--real',
      '--write-baseline',
      '--origin-commit',
      originCommit,
    ],
    root,
  );
  runCommand('git', ['add', '.github/trpc-dod-baseline.json'], root);
  runCommand('git', ['commit', '-m', 'introduce baseline'], root);
  return originCommit;
}

function advanceMain(root, label) {
  runCommand('git', ['switch', 'main'], root);
  writeFileSync(join(root, `${label}.md`), `${label}\n`);
  runCommand('git', ['add', `${label}.md`], root);
  runCommand('git', ['commit', '-m', `advance main for ${label}`], root);
}

function writeHistoryEvidence(root, includeError = true) {
  const errorEvidence = includeError
    ? `
trpcDodIt(
  {
    procedure: 'demo.alpha',
    case: 'error',
    mode: 'direct',
    contract: 'NOT_FOUND',
    title: 'alpha error',
  },
  async () => { await caller.demo.alpha(); },
);
`
    : '';
  writeFileSync(
    join(root, 'apps/backend/src/routers/demo.test.ts'),
    `import { trpcDodIt } from '../__tests__/test-utils/trpc-dod-evidence';
trpcDodIt(
  {
    procedure: 'demo.alpha',
    case: 'happy',
    mode: 'direct',
    title: 'alpha happy',
  },
  async () => { await caller.demo.alpha(); },
);
${errorEvidence}`,
  );
}

function assertHistoryAuditPasses(root, label) {
  const reportPath = join(root, `${label}-report.json`);
  runCommand(
    process.execPath,
    [join(root, 'scripts/audit-trpc-dod.mjs'), '--real', '--json-out', reportPath],
    root,
  );
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.equal(report.summary.queriesMutations, 1);
  assert.equal(report.summary.structuralErrors, 0);
}

test('poc mode: ping complete, echo incomplete, subscription report-only; caller it ignored', () => {
  const run = spawnSync(process.execPath, [auditScript, '--poc'], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /dodPoc\.ping.*complete/s);
  assert.match(run.stdout, /dodPoc\.echo.*incomplete/s);
  assert.match(run.stdout, /dodPoc\.onTick.*subscription_report_only/s);
  assert.match(run.stdout, /Incomplete: 1/);
  assert.match(run.stdout, /Complete: 1/);
});

test('poc JSON report is byte-stable across runner environments and covers indirect evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const outA = join(dir, 'a.json');
    const outB = join(dir, 'b.json');
    const environmentWithoutSourceDateEpoch = { ...process.env };
    delete environmentWithoutSourceDateEpoch.SOURCE_DATE_EPOCH;
    const runs = [
      { out: outA, env: environmentWithoutSourceDateEpoch },
      { out: outB, env: { ...process.env, SOURCE_DATE_EPOCH: '1234567890' } },
    ];
    for (const { out, env } of runs) {
      const run = spawnSync(process.execPath, [auditScript, '--poc', '--json-out', out], {
        encoding: 'utf8',
        cwd: repoRoot,
        env,
      });
      assert.equal(run.status, 0, run.stderr || run.stdout);
    }
    assert.equal(readFileSync(outA, 'utf8'), readFileSync(outB, 'utf8'));
    const report = JSON.parse(readFileSync(outA, 'utf8'));
    assert.equal('sourceDateEpoch' in report, false);
    const ping = report.procedures.find((procedure) => procedure.id === 'dodPoc.ping');
    assert.ok(ping);
    const indirectError = ping.evidence.error.find((entry) => entry.mode === 'indirect');
    assert.ok(indirectError);
    assert.match(indirectError.rationale, /shared contract assertion/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fingerprint preserves string/template/regex literals; format/comments are stable', async () => {
  const { inventariseRouterFile, fingerprintSource, normalizeProcedureSource } = await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const urlOld = writeTempRouter(
      dir,
      `export const demoRouter = router({
  x: publicProcedure.query(async () => ({ u: "https://old.example" })),
});
`,
    );
    const fpOld = inventariseRouterFile(urlOld, 'demo')[0].fingerprint;
    writeFileSync(
      urlOld,
      `export const demoRouter = router({
  x: publicProcedure.query(async () => ({ u: "https://new.example" })),
});
`,
    );
    const fpNew = inventariseRouterFile(urlOld, 'demo')[0].fingerprint;
    assert.notEqual(fpOld, fpNew);

    const spaceA = 'return "a  b"';
    const spaceB = 'return "a b"';
    assert.notEqual(
      fingerprintSource('query', 'demo.x', spaceA),
      fingerprintSource('query', 'demo.x', spaceB),
    );

    const tmplA = 'return `x${1}`';
    const tmplB = 'return `y${1}`';
    assert.notEqual(
      fingerprintSource('query', 'demo.x', tmplA),
      fingerprintSource('query', 'demo.x', tmplB),
    );

    const reA = 'return /ab+/';
    const reB = 'return /ab*/';
    assert.notEqual(
      fingerprintSource('query', 'demo.x', reA),
      fingerprintSource('query', 'demo.x', reB),
    );

    const formatted = normalizeProcedureSource('query(  async () => 1 )');
    const compact = normalizeProcedureSource('query(async () => 1)');
    assert.equal(formatted, compact);

    const withComment = normalizeProcedureSource('query(async () => /* c */ 1)');
    const withoutComment = normalizeProcedureSource('query(async () => 1)');
    assert.equal(withComment, withoutComment);

    const adjacentOperatorsA = 'return a + ++b';
    const adjacentOperatorsB = 'return a++ + b';
    assert.notEqual(
      normalizeProcedureSource(adjacentOperatorsA),
      normalizeProcedureSource(adjacentOperatorsB),
    );
    assert.notEqual(
      fingerprintSource('query', 'demo.x', adjacentOperatorsA),
      fingerprintSource('query', 'demo.x', adjacentOperatorsB),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('happy without error stays incomplete; bare caller does not count', async () => {
  const {
    inventariseRouterFile,
    collectEvidenceFromFile,
    attachEvidence,
    buildReport,
    loadKnownContractsFromHelper,
  } = await loadAudit();
  const known = loadKnownContractsFromHelper();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    // Place evidence under a path that can resolve the helper via relative import
    // matching production layout: .../trpc-dod-poc style from a temp tree is hard.
    // Instead write next to a fake structure OR use absolute-style by putting file
    // under apps/backend/src/__tests__/trpc-dod-poc/.tmp — prefer inline absolute
    // re-export path: use the real helper relative from a file in trpc-dod-poc.
    const evidenceDir = join(repoRoot, 'apps/backend/src/__tests__/trpc-dod-poc');
    const evidenceFile = join(evidenceDir, '_tmp-happy-only.evidence.test.ts');
    writeFileSync(
      evidenceFile,
      withCanonicalImport(`
import { it } from 'vitest';
trpcDodIt({
  procedure: 'demo.alpha',
  case: 'happy',
  mode: 'direct',
  title: 'alpha happy',
}, async () => { expect(1).toBe(1); });

it('caller.alpha without helper', async () => {
  await caller.alpha();
});
`),
    );
    const router = writeTempRouter(
      dir,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 1),
});
`,
    );
    try {
      const procedures = inventariseRouterFile(router, 'demo');
      const { entries, rejected } = collectEvidenceFromFile(evidenceFile, known);
      const { invalid, orphanEvidence } = attachEvidence(procedures, entries, rejected, known);
      const report = buildReport({ mode: 'custom', procedures, invalid, orphanEvidence });
      assert.equal(report.procedures[0].status, 'incomplete');
      assert.deepEqual(report.procedures[0].missing, ['error']);
      assert.equal(report.procedures[0].evidence.happy.length, 1);
      assert.equal(report.procedures[0].evidence.error.length, 0);
    } finally {
      rmSync(evidenceFile, { force: true });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('error without happy stays incomplete', async () => {
  const {
    inventariseRouterFile,
    collectEvidenceFromFile,
    attachEvidence,
    buildReport,
    loadKnownContractsFromHelper,
  } = await loadAudit();
  const known = loadKnownContractsFromHelper();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  const evidenceDir = join(repoRoot, 'apps/backend/src/__tests__/trpc-dod-poc');
  const evidenceFile = join(evidenceDir, '_tmp-error-only.evidence.test.ts');
  try {
    const router = writeTempRouter(
      dir,
      `export const demoRouter = router({
  beta: publicProcedure.mutation(async () => 1),
});
`,
    );
    writeFileSync(
      evidenceFile,
      withCanonicalImport(`
trpcDodIt({
  procedure: 'demo.beta',
  case: 'error',
  mode: 'direct',
  contract: 'NOT_FOUND',
  title: 'beta error',
}, async () => { throw new Error('x'); });
`),
    );
    const procedures = inventariseRouterFile(router, 'demo');
    const { entries, rejected } = collectEvidenceFromFile(evidenceFile, known);
    const { invalid, orphanEvidence } = attachEvidence(procedures, entries, rejected, known);
    const report = buildReport({ mode: 'custom', procedures, invalid, orphanEvidence });
    assert.equal(report.procedures[0].status, 'incomplete');
    assert.deepEqual(report.procedures[0].missing, ['happy']);
  } finally {
    rmSync(evidenceFile, { force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});

test('meaningless contract and indirect without rationale are invalid', async () => {
  const { collectEvidenceFromFile, validateEvidenceMeta, loadKnownContractsFromHelper } =
    await loadAudit();
  const known = loadKnownContractsFromHelper();
  const evidenceDir = join(repoRoot, 'apps/backend/src/__tests__/trpc-dod-poc');
  const evidenceFile = join(evidenceDir, '_tmp-invalid-meta.evidence.test.ts');
  try {
    writeFileSync(
      evidenceFile,
      withCanonicalImport(`
trpcDodIt({
  procedure: 'demo.x',
  case: 'error',
  mode: 'direct',
  contract: 'nope',
  title: 'bad contract',
}, async () => { expect(1).toBe(1); });

trpcDodIt({
  procedure: 'demo.x',
  case: 'happy',
  mode: 'indirect',
  title: 'no rationale',
}, async () => { expect(1).toBe(1); });
`),
    );
    const { entries } = collectEvidenceFromFile(evidenceFile, known);
    assert.equal(entries.length, 2);
    assert.ok(validateEvidenceMeta(entries[0], known).some((p) => /meaningless contract/.test(p)));
    assert.ok(validateEvidenceMeta(entries[1], known).some((p) => /rationale/.test(p)));
  } finally {
    rmSync(evidenceFile, { force: true });
  }
});

test('skip and curried skipIf evidence are rejected; wrong imports and shadowing do not count', async () => {
  const { collectEvidenceFromFile, loadKnownContractsFromHelper } = await loadAudit();
  const known = loadKnownContractsFromHelper();
  const evidenceDir = join(repoRoot, 'apps/backend/src/__tests__/trpc-dod-poc');
  const skippedFile = join(evidenceDir, '_tmp-skipped.evidence.test.ts');
  const skipIfFile = join(evidenceDir, '_tmp-skip-if.evidence.test.ts');
  const wrongImportFile = join(evidenceDir, '_tmp-wrong-import.evidence.test.ts');
  const shadowFile = join(evidenceDir, '_tmp-shadow.evidence.test.ts');
  try {
    writeFileSync(
      skippedFile,
      withCanonicalImport(`
import { describe } from 'vitest';
describe.skip('skipped suite', () => {
  trpcDodIt({
    procedure: 'demo.x',
    case: 'happy',
    mode: 'direct',
    title: 'skipped happy',
  }, async () => { expect(1).toBe(1); });
});
`),
    );
    writeFileSync(
      skipIfFile,
      withCanonicalImport(`
import { describe, it } from 'vitest';
describe.skipIf(true)('skipped suite', () => {
  trpcDodIt({
    procedure: 'demo.x',
    case: 'happy',
    mode: 'direct',
    title: 'skipIf suite happy',
  }, async () => { expect(1).toBe(1); });
});
it.skipIf(true)('skipped test', () => {
  trpcDodIt({
    procedure: 'demo.x',
    case: 'error',
    mode: 'direct',
    contract: 'NOT_FOUND',
    title: 'skipIf test error',
  }, async () => { throw new Error('x'); });
});
`),
    );
    writeFileSync(
      wrongImportFile,
      `import { trpcDodIt } from './nonexistent-helper';
trpcDodIt({
  procedure: 'demo.x',
  case: 'happy',
  mode: 'direct',
  title: 'wrong import',
}, async () => { expect(1).toBe(1); });
`,
    );
    writeFileSync(
      shadowFile,
      withCanonicalImport(`
function fake(_options: unknown, _fn: unknown) {}
function registerShadowedEvidence() {
  const trpcDodIt = fake;
  trpcDodIt({
    procedure: 'demo.x',
    case: 'happy',
    mode: 'direct',
    title: 'shadowed canonical import',
  }, async () => { expect(1).toBe(1); });
}
registerShadowedEvidence();
`),
    );

    const skipped = collectEvidenceFromFile(skippedFile, known);
    assert.equal(skipped.entries.length, 0);
    assert.ok(skipped.rejected.some((r) => /skipped/i.test(r.problems.join(' '))));

    const skipIf = collectEvidenceFromFile(skipIfFile, known);
    assert.equal(skipIf.entries.length, 0);
    assert.equal(skipIf.rejected.length, 2);
    assert.ok(skipIf.rejected.every((r) => /skipped/i.test(r.problems.join(' '))));

    const wrong = collectEvidenceFromFile(wrongImportFile, known);
    assert.equal(wrong.entries.length, 0);
    assert.ok(
      wrong.rejected.some((r) => /not bound to canonical helper/i.test(r.problems.join(' '))),
    );

    const shadow = collectEvidenceFromFile(shadowFile, known);
    assert.equal(shadow.entries.length, 0);
    assert.ok(
      shadow.rejected.some((r) => /not bound to canonical helper/i.test(r.problems.join(' '))),
    );
  } finally {
    rmSync(skippedFile, { force: true });
    rmSync(skipIfFile, { force: true });
    rmSync(wrongImportFile, { force: true });
    rmSync(shadowFile, { force: true });
  }
});

test('canonical import alias trpcDodIt as dodIt is accepted', async () => {
  const { collectEvidenceFromFile, loadKnownContractsFromHelper } = await loadAudit();
  const known = loadKnownContractsFromHelper();
  const evidenceDir = join(repoRoot, 'apps/backend/src/__tests__/trpc-dod-poc');
  const evidenceFile = join(evidenceDir, '_tmp-alias.evidence.test.ts');
  try {
    writeFileSync(
      evidenceFile,
      `import { trpcDodIt as dodIt } from '../test-utils/trpc-dod-evidence';
dodIt({
  procedure: 'demo.x',
  case: 'happy',
  mode: 'direct',
  title: 'aliased',
}, async () => { expect(1).toBe(1); });
`,
    );
    const { entries, rejected } = collectEvidenceFromFile(evidenceFile, known);
    assert.equal(rejected.length, 0);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].title, 'aliased');
  } finally {
    rmSync(evidenceFile, { force: true });
  }
});

test('subscription is outside query/mutation denominator', async () => {
  const { inventariseRouterFile, buildReport } = await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const router = writeTempRouter(
      dir,
      `export const demoRouter = router({
  onX: publicProcedure.subscription(async function* () { yield 1; }),
  gamma: publicProcedure.query(async () => 1),
});
`,
    );
    const procedures = inventariseRouterFile(router, 'demo');
    const report = buildReport({
      mode: 'custom',
      procedures,
      invalid: [],
      orphanEvidence: [],
    });
    assert.equal(report.summary.subscriptions, 1);
    assert.equal(report.summary.queriesMutations, 1);
    assert.equal(report.summary.untested, 1);
    const sub = report.procedures.find((p) => p.id === 'demo.onX');
    assert.equal(sub.status, 'subscription_report_only');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('report collections are byte-stable when evidence input order is reversed', async () => {
  const { runAudit } = await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const router = writeTempRouter(
      dir,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 1),
});
`,
    );
    const helperPath = join(repoRoot, 'apps/backend/src/__tests__/test-utils/trpc-dod-evidence.ts');
    const relativeHelperPath = relative(dir, helperPath).replaceAll('\\', '/');
    const helperSpecifier = relativeHelperPath.startsWith('.')
      ? relativeHelperPath
      : `./${relativeHelperPath}`;
    const happy = writeTempEvidence(
      dir,
      `import { trpcDodIt } from '${helperSpecifier}';
trpcDodIt({
  procedure: 'demo.alpha',
  case: 'happy',
  mode: 'direct',
  title: 'alpha happy',
}, async () => { expect(1).toBe(1); });
`,
      'z-happy.evidence.test.ts',
    );
    const error = writeTempEvidence(
      dir,
      `import { trpcDodIt } from '${helperSpecifier}';
trpcDodIt({
  procedure: 'demo.alpha',
  case: 'error',
  mode: 'direct',
  contract: 'NOT_FOUND',
  title: 'alpha error',
}, async () => { throw new Error('x'); });
`,
      'a-error.evidence.test.ts',
    );
    const forward = runAudit({
      routerPath: router,
      prefix: 'demo',
      evidencePaths: [happy, error],
      mode: 'custom',
    });
    const reversed = runAudit({
      routerPath: router,
      prefix: 'demo',
      evidencePaths: [error, happy],
      mode: 'custom',
    });
    assert.equal(JSON.stringify(forward), JSON.stringify(reversed));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fingerprint changes on rename and body change', async () => {
  const { inventariseRouterFile } = await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const a = writeTempRouter(
      dir,
      `export const demoRouter = router({
  oldName: publicProcedure.query(async () => 1),
});
`,
    );
    const first = inventariseRouterFile(a, 'demo');
    writeFileSync(
      a,
      `export const demoRouter = router({
  newName: publicProcedure.query(async () => 1),
});
`,
    );
    const second = inventariseRouterFile(a, 'demo');
    assert.equal(first[0].id, 'demo.oldName');
    assert.equal(second[0].id, 'demo.newName');
    writeFileSync(
      a,
      `export const demoRouter = router({
  newName: publicProcedure.query(async () => 2),
});
`,
    );
    const third = inventariseRouterFile(a, 'demo');
    assert.notEqual(second[0].fingerprint, third[0].fingerprint);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('compareMissingDebt detects improve, worsen, and happy/error swap', async () => {
  const { compareMissingDebt } = await loadAudit();
  const improve = compareMissingDebt({ 'r.a': ['error'] }, { 'r.a': [] });
  assert.equal(improve.ok, true);
  assert.deepEqual(improve.improved, ['r.a']);

  const worsen = compareMissingDebt({ 'r.a': ['error'] }, { 'r.a': ['happy', 'error'] });
  assert.equal(worsen.ok, false);
  assert.deepEqual(worsen.worsened, ['r.a']);

  const swap = compareMissingDebt({ 'r.a': ['error'] }, { 'r.a': ['happy'] });
  assert.equal(swap.ok, false);
  assert.deepEqual(swap.worsened, ['r.a']);
});

test('fail-on-incomplete exits non-zero for poc incomplete echo', () => {
  const run = spawnSync(process.execPath, [auditScript, '--poc', '--fail-on-incomplete'], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  assert.equal(run.status, 1, run.stderr || run.stdout);
});

test('real mode rejects fail-on-incomplete instead of overriding the Slice 2C gate', () => {
  const run = spawnSync(process.execPath, [auditScript, '--real', '--fail-on-incomplete'], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  assert.equal(run.status, 2, run.stderr || run.stdout);
  assert.match(
    run.stderr,
    /--fail-on-incomplete is not supported with --real; real mode always runs the Slice 2C gate/,
  );
});

test('real router tree inventory follows mounted and nested routers exactly', async () => {
  const { inventariseRouterTree } = await loadAudit();
  const procedures = inventariseRouterTree(join(repoRoot, 'apps/backend/src/routers/index.ts'));
  assert.equal(procedures.length, 121);
  assert.equal(procedures.filter((procedure) => procedure.kind === 'query').length, 50);
  assert.equal(procedures.filter((procedure) => procedure.kind === 'mutation').length, 63);
  assert.equal(procedures.filter((procedure) => procedure.kind === 'subscription').length, 8);
  assert.ok(procedures.some((procedure) => procedure.id === 'admin.motd.motdCreate'));
  assert.equal(
    procedures.some((procedure) => procedure.id.startsWith('adminMotd.')),
    false,
  );
});

test('real evidence scope matches backend Vitest src/**/*.test.ts include', async () => {
  const { isBackendVitestTestFile, readBackendVitestIncludes } = await loadAudit();
  assert.deepEqual(readBackendVitestIncludes(join(repoRoot, 'apps/backend/vitest.config.ts')), [
    'src/**/*.test.ts',
  ]);
  assert.equal(
    isBackendVitestTestFile(join(repoRoot, 'apps/backend/src/lib/example.test.ts')),
    true,
  );
  assert.equal(
    isBackendVitestTestFile(join(repoRoot, 'apps/backend/src/__tests__/example.test.ts')),
    true,
  );
  assert.equal(
    isBackendVitestTestFile(join(repoRoot, 'apps/backend/src/lib/example.spec.ts')),
    false,
  );

  const evidenceFile = join(repoRoot, 'apps/backend/src/lib/_tmp-trpc-dod-scope.test.ts');
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  const reportFile = join(dir, 'report.json');
  try {
    writeFileSync(
      evidenceFile,
      `import { trpcDodIt } from '../__tests__/test-utils/trpc-dod-evidence';
trpcDodIt({
  procedure: 'health.check',
  case: 'happy',
  mode: 'direct',
  title: 'evidence outside __tests__',
}, async () => { expect(1).toBe(1); });
`,
    );
    const run = spawnSync(
      process.execPath,
      [auditScript, '--real', '--origin-snapshot', '--json-out', reportFile],
      { encoding: 'utf8', cwd: repoRoot },
    );
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const report = JSON.parse(readFileSync(reportFile, 'utf8'));
    const healthCheck = report.procedures.find((procedure) => procedure.id === 'health.check');
    assert.equal(healthCheck.evidence.happy.length, 1);
    assert.deepEqual(healthCheck.missing, ['error']);
  } finally {
    rmSync(evidenceFile, { force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});

test('conflicting duplicate evidence and unknown procedure ids become structural errors', async () => {
  const { attachEvidence, buildReport, inventariseRouterFile, loadKnownContractsFromHelper } =
    await loadAudit();
  const known = loadKnownContractsFromHelper();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const router = writeTempRouter(
      dir,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 1),
});
`,
    );
    const procedures = inventariseRouterFile(router, 'demo');
    const common = {
      procedure: 'demo.alpha',
      case: 'error',
      mode: 'direct',
      title: 'same evidence key',
      testFile: 'demo.test.ts',
      emptyBody: false,
      skipped: false,
    };
    const entries = [
      { ...common, contract: 'NOT_FOUND' },
      { ...common, contract: 'FORBIDDEN' },
      {
        ...common,
        procedure: 'demo.unknown',
        case: 'happy',
        title: 'unknown procedure',
        contract: undefined,
      },
    ];
    const { invalid, orphanEvidence } = attachEvidence(procedures, entries, [], known);
    const report = buildReport({ mode: 'real', procedures, invalid, orphanEvidence });
    assert.ok(report.structuralErrors.some((error) => /conflicting metadata/.test(error)));
    assert.ok(report.structuralErrors.some((error) => /unknown procedure evidence/.test(error)));
    assert.equal(report.procedures[0].evidence.error.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('baseline requires deleted entries to be removed and blocks incomplete new procedures', async () => {
  const { buildReport, createBaseline, inventariseRouterFile, readAndValidateBaseline } =
    await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const router = writeTempRouter(
      dir,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 1),
});
`,
    );
    const procedures = inventariseRouterFile(router, 'demo');
    const baselineFile = join(dir, 'baseline.json');
    const baseline = createBaseline(procedures, '1'.repeat(40));

    const withOrphan = structuredClone(baseline);
    withOrphan.procedures['demo.deleted'] = { ...withOrphan.procedures['demo.alpha'] };
    writeFileSync(baselineFile, `${JSON.stringify(withOrphan)}\n`);
    let checked = readAndValidateBaseline(baselineFile);
    assert.deepEqual(checked.errors, []);
    let report = buildRealReport(buildReport, procedures, checked.baseline);
    assert.ok(
      report.baselineChanges.some(
        (change) => change.procedure === 'demo.deleted' && change.change === 'remove_deleted',
      ),
    );

    writeFileSync(
      router,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 1),
  beta: publicProcedure.mutation(async () => 2),
});
`,
    );
    const withNewProcedure = inventariseRouterFile(router, 'demo');
    writeFileSync(baselineFile, `${JSON.stringify(baseline)}\n`);
    checked = readAndValidateBaseline(baselineFile);
    assert.deepEqual(checked.errors, []);
    report = buildRealReport(buildReport, withNewProcedure, checked.baseline);
    assert.equal(report.summary.newSinceBaseline, 1);
    assert.equal(report.summary.structuralErrors, 0);
    assert.deepEqual(report.gateViolations[0], {
      procedure: 'demo.beta',
      kind: 'mutation',
      change: 'new',
      missing: ['happy', 'error'],
      message: 'demo.beta: new mutation missing happy, error evidence',
    });
    assert.equal(
      report.procedures.find((procedure) => procedure.id === 'demo.beta').baseline.new,
      true,
    );

    // Deliberately inject exactly one second root key to test duplicate-key detection.
    const serializedBaseline = JSON.stringify(baseline);
    const duplicateVersion = `{"version":1,${serializedBaseline.slice(1)}`;
    writeFileSync(baselineFile, duplicateVersion);
    checked = readAndValidateBaseline(baselineFile);
    assert.ok(
      checked.errors.some((error) => /duplicate baseline JSON key \$\.version/.test(error)),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('complete new query is accepted after a monotonic baseline addition', async () => {
  const { buildReport, createBaseline, inventariseRouterFile, validateBaselineEvolution } =
    await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const router = writeTempRouter(
      dir,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 1),
});
`,
    );
    const originCommit = '2'.repeat(40);
    const initial = createBaseline(inventariseRouterFile(router, 'demo'), originCommit);
    writeFileSync(
      router,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 1),
  beta: publicProcedure.query(async () => 2),
});
`,
    );
    const current = inventariseRouterFile(router, 'demo');
    assert.ok(
      validateBaselineEvolution(createBaseline(current, originCommit), initial, [initial]).some(
        (error) => /demo\.beta is new and carries missing happy, error evidence/.test(error),
      ),
    );
    addFormalEvidence(
      current.find((procedure) => procedure.id === 'demo.beta'),
      'happy',
      'error',
    );

    const beforeRefresh = buildRealReport(buildReport, current, initial);
    assert.deepEqual(beforeRefresh.gateViolations, []);
    assert.equal(beforeRefresh.baselineChanges[0].change, 'add');

    const refreshed = createBaseline(current, originCommit);
    assert.deepEqual(validateBaselineEvolution(refreshed, initial, [initial]), []);
    const accepted = buildRealReport(buildReport, current, refreshed);
    assert.deepEqual(accepted.gateViolations, []);
    assert.deepEqual(accepted.baselineChanges, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('real audit reports invalid baseline missing values without throwing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-invalid-baseline-'));
  try {
    createHistoryFixture(dir);
    const baselineFile = join(dir, '.github/trpc-dod-baseline.json');
    const validBaseline = JSON.parse(readFileSync(baselineFile, 'utf8'));

    for (const [label, invalidMissing] of [
      ['null', null],
      ['string', 'happy'],
    ]) {
      const invalidBaseline = structuredClone(validBaseline);
      invalidBaseline.procedures['demo.alpha'].missing = invalidMissing;
      writeFileSync(baselineFile, `${JSON.stringify(invalidBaseline, null, 2)}\n`);
      const reportPath = join(dir, `${label}-report.json`);
      const audit = spawnSync(
        process.execPath,
        [join(dir, 'scripts/audit-trpc-dod.mjs'), '--real', '--json-out', reportPath],
        { cwd: dir, encoding: 'utf8' },
      );

      assert.equal(audit.status, 2, audit.stderr || audit.stdout);
      assert.doesNotMatch(audit.stderr, /TypeError/);
      assert.match(audit.stdout, /baseline procedure demo\.alpha has invalid missing dimensions/);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      assert.deepEqual(report.structuralErrors, [
        'baseline procedure demo.alpha has invalid missing dimensions',
      ]);
      assert.equal(report.summary.structuralErrors, 1);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('changed query requires both evidence dimensions before fingerprint refresh', async () => {
  const { buildReport, createBaseline, inventariseRouterFile, validateBaselineEvolution } =
    await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const router = writeTempRouter(
      dir,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 1),
});
`,
    );
    const originCommit = '3'.repeat(40);
    const initial = createBaseline(inventariseRouterFile(router, 'demo'), originCommit);
    writeFileSync(
      router,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 2),
});
`,
    );
    const current = inventariseRouterFile(router, 'demo');
    addFormalEvidence(current[0], 'happy');
    let report = buildRealReport(buildReport, current, initial);
    assert.deepEqual(
      report.gateViolations.map((violation) => violation.message),
      ['demo.alpha: changed query missing error evidence'],
    );
    assert.ok(
      validateBaselineEvolution(createBaseline(current, originCommit), initial, [initial]).some(
        (error) =>
          /demo\.alpha changed kind or fingerprint and carries missing error evidence/.test(error),
      ),
    );

    addFormalEvidence(current[0], 'error');
    report = buildRealReport(buildReport, current, initial);
    assert.deepEqual(report.gateViolations, []);
    const refreshed = createBaseline(current, originCommit);
    assert.deepEqual(validateBaselineEvolution(refreshed, initial, [initial]), []);
    assert.deepEqual(buildRealReport(buildReport, current, refreshed).baselineChanges, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('legacy debt stays non-blocking, reductions persist, and regressions are rejected', async () => {
  const { buildReport, createBaseline, inventariseRouterFile, validateBaselineEvolution } =
    await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const router = writeTempRouter(
      dir,
      `export const demoRouter = router({
  alpha: publicProcedure.mutation(async () => 1),
});
`,
    );
    const originCommit = '4'.repeat(40);
    const initialProcedures = inventariseRouterFile(router, 'demo');
    addFormalEvidence(initialProcedures[0], 'happy');
    const initial = createBaseline(initialProcedures, originCommit);

    const unchanged = inventariseRouterFile(router, 'demo');
    addFormalEvidence(unchanged[0], 'happy');
    let report = buildRealReport(buildReport, unchanged, initial);
    assert.deepEqual(report.gateViolations, []);
    assert.deepEqual(report.baselineChanges, []);

    addFormalEvidence(unchanged[0], 'error');
    report = buildRealReport(buildReport, unchanged, initial);
    assert.deepEqual(report.gateViolations, []);
    assert.equal(report.baselineChanges[0].change, 'reduce_debt');
    const improved = createBaseline(unchanged, originCommit);
    assert.deepEqual(validateBaselineEvolution(improved, initial, [initial]), []);

    const regressed = inventariseRouterFile(router, 'demo');
    addFormalEvidence(regressed[0], 'error');
    report = buildRealReport(buildReport, regressed, improved);
    assert.deepEqual(
      report.gateViolations.map((violation) => violation.message),
      ['demo.alpha: unchanged mutation lost happy evidence'],
    );

    const weakened = structuredClone(improved);
    weakened.procedures['demo.alpha'].missing = ['happy'];
    assert.ok(
      validateBaselineEvolution(weakened, initial, [initial, improved]).some((error) =>
        /reintroduces missing happy evidence/.test(error),
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('subscriptions remain report-only while rename is deletion plus a gated new id', async () => {
  const { buildReport, createBaseline, inventariseRouterFile } = await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const router = writeTempRouter(
      dir,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 1),
});
`,
    );
    const originCommit = '5'.repeat(40);
    const initial = createBaseline(inventariseRouterFile(router, 'demo'), originCommit);
    writeFileSync(
      router,
      `export const demoRouter = router({
  beta: publicProcedure.query(async () => 1),
  onTick: publicProcedure.subscription(() => observable(() => () => {})),
});
`,
    );
    const current = inventariseRouterFile(router, 'demo');
    const report = buildRealReport(buildReport, current, initial);
    assert.deepEqual(
      report.gateViolations.map((violation) => violation.procedure),
      ['demo.beta'],
    );
    assert.equal(
      report.gateViolations.some((violation) => violation.procedure === 'demo.onTick'),
      false,
    );
    assert.deepEqual(
      report.baselineChanges.map((change) => [change.procedure, change.change]),
      [
        ['demo.alpha', 'remove_deleted'],
        ['demo.beta', 'add'],
        ['demo.onTick', 'add'],
      ],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('originCommit regeneration rejects jointly recomputed baseline weakening and input drift', async () => {
  const { createBaseline, inventariseRouterFile, validateBaselineSnapshots } = await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const router = writeTempRouter(
      dir,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 1),
});
`,
    );
    const originProcedures = inventariseRouterFile(router, 'demo');
    originProcedures[0].evidence.happy.push({
      mode: 'direct',
      contract: null,
      rationale: null,
      title: 'origin happy evidence',
      testFile: 'origin.test.ts',
    });
    const originCommit = '3'.repeat(40);
    const baseline = createBaseline(originProcedures, originCommit);
    const introductionProcedures = structuredClone(originProcedures);
    assert.deepEqual(baseline.procedures['demo.alpha'].missing, ['error']);
    assert.deepEqual(
      validateBaselineSnapshots(baseline, originCommit, originProcedures, introductionProcedures),
      [],
    );

    const weakened = structuredClone(baseline);
    weakened.procedures['demo.alpha'].missing = ['happy', 'error'];
    assert.ok(
      validateBaselineSnapshots(
        weakened,
        originCommit,
        originProcedures,
        introductionProcedures,
      ).some((error) => /do not match the audit regenerated/.test(error)),
    );

    weakened.originCommit = '4'.repeat(40);
    assert.ok(
      validateBaselineSnapshots(
        weakened,
        originCommit,
        originProcedures,
        introductionProcedures,
      ).some((error) => /immutable initial origin/.test(error)),
    );

    introductionProcedures[0].evidence.error.push({
      mode: 'direct',
      contract: 'NOT_FOUND',
      rationale: null,
      title: 'introduced error evidence',
      testFile: 'introduction.test.ts',
    });
    assert.ok(
      validateBaselineSnapshots(
        baseline,
        originCommit,
        originProcedures,
        introductionProcedures,
      ).some((error) => /changed between originCommit and baseline introduction/.test(error)),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('baseline history anchor is independent of merge, squash, and rebase parent topology', async () => {
  const { createBaseline, readBaselineHistoryAnchor } = await loadAudit();
  const baselinePath = join(repoRoot, '.github/trpc-dod-baseline.json');
  const originCommit = '7'.repeat(40);
  const initialBaseline = createBaseline([], originCommit);

  for (const introductionCommit of ['8'.repeat(40), '9'.repeat(40), 'a'.repeat(40)]) {
    const anchor = readBaselineHistoryAnchor(baselinePath, (args) => {
      if (args[0] === 'log') return introductionCommit;
      if (args[0] === 'show') return JSON.stringify(initialBaseline);
      throw new Error(`unexpected git call: ${args.join(' ')}`);
    });
    assert.deepEqual(anchor, { introductionCommit, originCommit });
  }
});

test('real history audit survives squash and rebase introduction commits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-history-'));
  try {
    const squashRoot = join(dir, 'squash');
    mkdirSync(squashRoot);
    createHistoryFixture(squashRoot);
    advanceMain(squashRoot, 'squash');
    runCommand('git', ['merge', '--squash', 'feature'], squashRoot);
    runCommand('git', ['commit', '-m', 'squash merge baseline'], squashRoot);
    assertHistoryAuditPasses(squashRoot, 'squash');

    const rebaseRoot = join(dir, 'rebase');
    mkdirSync(rebaseRoot);
    createHistoryFixture(rebaseRoot);
    advanceMain(rebaseRoot, 'rebase');
    runCommand('git', ['switch', 'feature'], rebaseRoot);
    runCommand('git', ['rebase', 'main'], rebaseRoot);
    assertHistoryAuditPasses(rebaseRoot, 'rebase');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('real history rejects incomplete same-fingerprint reintroduction after committed absence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-reintroduction-'));
  try {
    createHistoryFixture(dir);
    const routerFile = join(dir, 'apps/backend/src/routers/demo.ts');
    const baselineFile = join(dir, '.github/trpc-dod-baseline.json');
    const initialBaseline = JSON.parse(readFileSync(baselineFile, 'utf8'));

    writeFileSync(routerFile, 'export const demoRouter = router({});\n');
    runCommand(
      process.execPath,
      [join(dir, 'scripts/audit-trpc-dod.mjs'), '--real', '--update-baseline'],
      dir,
    );
    const deletedBaseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
    assert.equal('demo.alpha' in deletedBaseline.procedures, false);
    runCommand('git', ['add', 'apps/backend/src/routers/demo.ts', baselineFile], dir);
    runCommand('git', ['commit', '-m', 'delete legacy alpha'], dir);
    const deletedReportPath = join(dir, 'deleted-report.json');
    runCommand(
      process.execPath,
      [join(dir, 'scripts/audit-trpc-dod.mjs'), '--real', '--json-out', deletedReportPath],
      dir,
    );
    const deletedReport = JSON.parse(readFileSync(deletedReportPath, 'utf8'));
    assert.equal(deletedReport.summary.queriesMutations, 0);
    assert.equal(deletedReport.summary.structuralErrors, 0);

    writeFileSync(
      routerFile,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 1),
});
`,
    );
    writeFileSync(baselineFile, `${JSON.stringify(initialBaseline, null, 2)}\n`);
    runCommand('git', ['add', 'apps/backend/src/routers/demo.ts', baselineFile], dir);
    runCommand('git', ['commit', '-m', 'reintroduce incomplete legacy alpha'], dir);
    const reintroductionCommit = runCommand('git', ['rev-parse', 'HEAD'], dir);

    const audit = spawnSync(process.execPath, [join(dir, 'scripts/audit-trpc-dod.mjs'), '--real'], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.equal(audit.status, 2, audit.stderr || audit.stdout);
    assert.match(
      audit.stdout,
      new RegExp(
        `committed baseline ${reintroductionCommit}: baseline procedure demo\\.alpha is reintroduced after absence and carries missing happy, error evidence`,
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('baseline updater persists an improvement and refuses a later evidence regression', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-update-'));
  try {
    createHistoryFixture(dir);
    writeHistoryEvidence(dir);
    const baselineFile = join(dir, '.github/trpc-dod-baseline.json');
    runCommand(
      process.execPath,
      [join(dir, 'scripts/audit-trpc-dod.mjs'), '--real', '--update-baseline'],
      dir,
    );
    let baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
    assert.deepEqual(baseline.procedures['demo.alpha'].missing, []);
    runCommand('git', ['add', 'apps/backend/src/routers/demo.test.ts', baselineFile], dir);
    runCommand('git', ['commit', '-m', 'accept complete alpha evidence'], dir);
    assertHistoryAuditPasses(dir, 'improved');

    writeHistoryEvidence(dir, false);
    const beforeRejectedUpdate = readFileSync(baselineFile, 'utf8');
    const audit = spawnSync(process.execPath, [join(dir, 'scripts/audit-trpc-dod.mjs'), '--real'], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.equal(audit.status, 1, audit.stderr || audit.stdout);
    assert.match(audit.stdout, /demo\.alpha: unchanged query lost error evidence/);
    const update = spawnSync(
      process.execPath,
      [join(dir, 'scripts/audit-trpc-dod.mjs'), '--real', '--update-baseline'],
      { cwd: dir, encoding: 'utf8' },
    );
    assert.equal(update.status, 1, update.stderr || update.stdout);
    assert.match(update.stderr, /Refusing baseline update with gate violations/);
    assert.equal(readFileSync(baselineFile, 'utf8'), beforeRejectedUpdate);
    baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
    assert.deepEqual(baseline.procedures['demo.alpha'].missing, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('changed incomplete procedure is an actionable Slice 2C gate violation', async () => {
  const { buildReport, createBaseline, inventariseRouterFile, readAndValidateBaseline } =
    await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const router = writeTempRouter(
      dir,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 1),
});
`,
    );
    const before = inventariseRouterFile(router, 'demo');
    const baseline = createBaseline(before, '2'.repeat(40));
    const baselineFile = join(dir, 'baseline.json');
    writeFileSync(baselineFile, `${JSON.stringify(baseline)}\n`);
    writeFileSync(
      router,
      `export const demoRouter = router({
  alpha: publicProcedure.query(async () => 2),
});
`,
    );
    const after = inventariseRouterFile(router, 'demo');
    const checked = readAndValidateBaseline(baselineFile);
    assert.deepEqual(checked.errors, []);
    const report = buildReport({
      mode: 'real',
      procedures: after,
      invalid: [],
      orphanEvidence: [],
      baseline: checked.baseline,
      baselineErrors: checked.errors,
    });
    assert.equal(report.summary.changedSinceBaseline, 1);
    assert.equal(report.summary.gateViolations, 1);
    assert.equal(report.gateViolations[0].procedure, 'demo.alpha');
    assert.equal(report.gateViolations[0].change, 'changed');
    assert.deepEqual(report.gateViolations[0].missing, ['happy', 'error']);
    assert.equal(report.summary.structuralErrors, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('real gate report is deterministic and unchanged legacy debt is non-blocking', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const baseline = join(repoRoot, '.github/trpc-dod-baseline.json');
    const outputs = [join(dir, 'first.json'), join(dir, 'second.json')];
    for (const output of outputs) {
      const run = spawnSync(
        process.execPath,
        [auditScript, '--real', '--baseline', baseline, '--json-out', output],
        { encoding: 'utf8', cwd: repoRoot },
      );
      assert.equal(run.status, 0, run.stderr || run.stdout);
    }
    assert.equal(readFileSync(outputs[0], 'utf8'), readFileSync(outputs[1], 'utf8'));
    const report = JSON.parse(readFileSync(outputs[0], 'utf8'));
    assert.equal(report.summary.queriesMutations, 113);
    assert.equal(report.summary.complete, 11);
    assert.equal(report.summary.untested, 102);
    assert.equal(report.summary.legacyProcedures, 102);
    assert.equal(report.summary.legacyMissingDimensions, 204);
    assert.equal(report.summary.newSinceBaseline, 0);
    assert.equal(report.summary.gateViolations, 0);
    assert.equal(report.summary.baselineChanges, 0);
    assert.equal(report.summary.structuralErrors, 0);
    assert.equal('integrity' in report.baseline, false);
    const migrated = report.procedures.filter((procedure) =>
      procedure.id.startsWith('admin.motd.'),
    );
    assert.equal(migrated.length, 11);
    assert.ok(
      migrated.every(
        (procedure) => procedure.status === 'complete' && procedure.baseline?.legacyDebt === false,
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('baseline initialization uses an exclusive create and preserves an existing file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const baselineFile = join(dir, 'baseline.json');
    writeFileSync(baselineFile, 'do not overwrite\n');
    const run = spawnSync(
      process.execPath,
      [
        auditScript,
        '--real',
        '--write-baseline',
        '--baseline',
        baselineFile,
        '--origin-commit',
        '5'.repeat(40),
      ],
      { encoding: 'utf8', cwd: repoRoot },
    );
    assert.equal(run.status, 2, run.stderr || run.stdout);
    assert.match(run.stderr, /Refusing to overwrite existing baseline/);
    assert.equal(readFileSync(baselineFile, 'utf8'), 'do not overwrite\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('atomic baseline update uses an exclusive lock and never overwrites through contention', async () => {
  const { writeBaselineAtomically } = await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-lock-'));
  try {
    const baselineFile = join(dir, 'baseline.json');
    const oldBaseline = { version: 1, originCommit: '6'.repeat(40), procedures: {} };
    const newBaseline = { version: 1, originCommit: '7'.repeat(40), procedures: {} };
    writeFileSync(baselineFile, `${JSON.stringify(oldBaseline)}\n`);
    writeFileSync(`${baselineFile}.lock`, 'other process\n');
    assert.throws(
      () => writeBaselineAtomically(baselineFile, newBaseline),
      /Refusing concurrent baseline update/,
    );
    assert.deepEqual(JSON.parse(readFileSync(baselineFile, 'utf8')), oldBaseline);
    rmSync(`${baselineFile}.lock`);
    writeBaselineAtomically(baselineFile, newBaseline);
    assert.deepEqual(JSON.parse(readFileSync(baselineFile, 'utf8')), newBaseline);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
