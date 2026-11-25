import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { hashResourceIsolationFixture } from './lib/resource-isolation-fixture.mjs';

const execFileAsync = promisify(execFile);
const runner = fileURLToPath(new URL('./resource-isolation-fixture.mjs', import.meta.url));
const run = (args) =>
  execFileAsync(process.execPath, [runner, ...args], {
    timeout: 15_000,
    env: { ...process.env, TRPC_URL: 'https://arsnova.eu/trpc', DATABASE_URL: 'invalid' },
  });

test('validates offline and produces a reproducible summary with explicit provenance', async () => {
  const first = JSON.parse((await run(['--validate'])).stdout);
  const second = JSON.parse((await run(['--validate'])).stdout);
  assert.deepEqual(first, second);
  assert.equal(first.mode, 'network-free-validation');
  assert.equal(first.referenceQuestions, 6);
  assert.equal(first.referenceParticipantCount, 200);
  assert.equal(first.eligibleQuestions, 500);
  assert.equal(first.uniqueAnalysisTexts, 500);
  assert.equal(first.exclusionControls, 3);
  assert.equal(first.counterCases, 4);
  assert.equal(first.sharedArtifact.owner, 'Niklas');
  assert.match(first.sha256, /^[a-f0-9]{64}$/);
  assert.equal(first.seed, 0x1a202611);
});

test('prints complete fixture content whose hash matches the validation summary', async () => {
  const fixture = JSON.parse((await run(['--print', '--seed', '0'])).stdout);
  const summary = JSON.parse((await run(['--validate', '--seed', '0'])).stdout);
  assert.equal(fixture.seed, 0);
  assert.equal(hashResourceIsolationFixture(fixture), summary.sha256);
  assert.equal(fixture.analysis.questions.length, 500);
  assert.equal(fixture.reference.questions[0].context.status, 'PENDING');
  assert.doesNotMatch(
    JSON.stringify(fixture),
    /hostToken|participantId|DATABASE_URL|https:\/\/arsnova.eu/,
  );
});

test('rejects ambiguous modes, malformed seeds and unknown options without stdout data', async () => {
  for (const args of [
    [],
    ['--print', '--validate'],
    ['--unknown'],
    ['--seed'],
    ['--validate', '--seed', '-1'],
    ['--validate', '--seed', '1.5'],
    ['--validate', '--seed', '4294967296'],
    ['--validate', '--seed', ''],
    ['--validate', '--seed', '0x10'],
    ['--validate', '--seed', '1', '--seed', '2'],
    ['--validate', '--validate'],
  ]) {
    await assert.rejects(run(args), (error) => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, '');
      assert.match(error.stderr, /mode|option|seed/i);
      return true;
    });
  }
});
