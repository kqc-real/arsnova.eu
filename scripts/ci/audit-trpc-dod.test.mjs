import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const auditScript = join(repoRoot, 'scripts/audit-trpc-dod.mjs');

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

test('poc mode is deterministic for fingerprints', async () => {
  const { inventariseRouterFile } = await loadAudit();
  const router = join(
    repoRoot,
    'apps/backend/src/__tests__/trpc-dod-poc/fixture-router.ts',
  );
  const a = inventariseRouterFile(router, 'dodPoc');
  const b = inventariseRouterFile(router, 'dodPoc');
  assert.deepEqual(
    a.map((p) => [p.id, p.fingerprint]),
    b.map((p) => [p.id, p.fingerprint]),
  );
});

test('happy without error stays incomplete; bare caller does not count', async () => {
  const { inventariseRouterFile, collectEvidenceFromFile, attachEvidence, buildReport } =
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
    writeTempEvidence(
      dir,
      `import { it } from 'vitest';
import { trpcDodIt } from './helper';

trpcDodIt({
  procedure: 'demo.alpha',
  case: 'happy',
  mode: 'direct',
  title: 'alpha happy',
}, async () => { expect(1).toBe(1); });

it('caller.alpha without helper', async () => {
  await caller.alpha();
});
`,
    );
    const procedures = inventariseRouterFile(router, 'demo');
    const evidence = collectEvidenceFromFile(join(dir, 'evidence.test.ts'));
    const { invalid, orphanEvidence } = attachEvidence(procedures, evidence);
    const report = buildReport({
      mode: 'custom',
      procedures,
      invalid,
      orphanEvidence,
    });
    assert.equal(report.procedures[0].status, 'incomplete');
    assert.deepEqual(report.procedures[0].missing, ['error']);
    assert.equal(report.procedures[0].evidence.happy.length, 1);
    assert.equal(report.procedures[0].evidence.error.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('error without happy stays incomplete', async () => {
  const { inventariseRouterFile, collectEvidenceFromFile, attachEvidence, buildReport } =
    await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    const router = writeTempRouter(
      dir,
      `export const demoRouter = router({
  beta: publicProcedure.mutation(async () => 1),
});
`,
    );
    writeTempEvidence(
      dir,
      `trpcDodIt({
  procedure: 'demo.beta',
  case: 'error',
  mode: 'direct',
  contract: 'NOT_FOUND',
  title: 'beta error',
}, async () => { throw new Error('x'); });
`,
    );
    const procedures = inventariseRouterFile(router, 'demo');
    const evidence = collectEvidenceFromFile(join(dir, 'evidence.test.ts'));
    const { invalid, orphanEvidence } = attachEvidence(procedures, evidence);
    const report = buildReport({ mode: 'custom', procedures, invalid, orphanEvidence });
    assert.equal(report.procedures[0].status, 'incomplete');
    assert.deepEqual(report.procedures[0].missing, ['happy']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('meaningless error contract and indirect without rationale are invalid', async () => {
  const { collectEvidenceFromFile, validateEvidenceMeta } = await loadAudit();
  const dir = mkdtempSync(join(tmpdir(), 'trpc-dod-'));
  try {
    writeTempEvidence(
      dir,
      `trpcDodIt({
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
`,
    );
    const entries = collectEvidenceFromFile(join(dir, 'evidence.test.ts'));
    assert.equal(entries.length, 2);
    assert.ok(validateEvidenceMeta(entries[0]).some((p) => /meaningless contract/.test(p)));
    assert.ok(validateEvidenceMeta(entries[1]).some((p) => /rationale/.test(p)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
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

test('fingerprint changes when procedure source changes; rename is new id', async () => {
  const { inventariseRouterFile, fingerprintSource, normalizeProcedureSource } = await loadAudit();
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
    assert.notEqual(first[0].id, second[0].id);

    writeFileSync(
      a,
      `export const demoRouter = router({
  newName: publicProcedure.query(async () => 2),
});
`,
    );
    const third = inventariseRouterFile(a, 'demo');
    assert.equal(third[0].id, 'demo.newName');
    assert.notEqual(second[0].fingerprint, third[0].fingerprint);

    const n1 = normalizeProcedureSource('query(async () => 1)');
    const n2 = normalizeProcedureSource('query(  async () => 1 )');
    assert.equal(
      fingerprintSource('query', 'demo.x', n1),
      fingerprintSource('query', 'demo.x', n2),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fail-on-incomplete exits non-zero for poc incomplete echo', () => {
  const run = spawnSync(process.execPath, [auditScript, '--poc', '--fail-on-incomplete'], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  assert.equal(run.status, 1, run.stderr || run.stdout);
});
