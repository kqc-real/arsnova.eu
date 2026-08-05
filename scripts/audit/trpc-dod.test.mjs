import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const auditScript = join(repoRoot, 'scripts/audit-trpc-dod.mjs');
const helperImport = '../test-utils/trpc-dod-evidence';

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
