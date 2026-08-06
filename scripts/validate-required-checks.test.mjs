import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compareLiveRulesets,
  renderJobContexts,
  renderRequiredChecksDocumentation,
  validateRepository,
} from './validate-required-checks.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = readFileSync(resolve(repositoryRoot, '.github/required-checks.schema.json'), 'utf8');

function workflowSource(workflow, job) {
  return { type: 'workflow', producers: [{ workflow, job }] };
}

function fixtureManifest() {
  return {
    $schema: './required-checks.schema.json',
    version: 1,
    targetBranch: 'main',
    ownerVerification: {
      status: 'pending',
      capturedAt: '2026-08-06T00:00:00Z',
      endpoint: 'GET /rulesets/{id}',
      capturedBy: 'test',
      evidence: null,
    },
    rulesets: [
      { name: 'CI-CD', id: 1, contexts: ['Build (22)', 'Build (24)', 'Workflow Lint'] },
      { name: 'main protected', id: 2, contexts: ['PR-Template vollständig'] },
    ],
    checks: [
      {
        context: 'Build (22)',
        ruleset: 'CI-CD',
        purpose: 'Matrix 22',
        source: workflowSource('.github/workflows/ci.yml', 'build'),
      },
      {
        context: 'Build (24)',
        ruleset: 'CI-CD',
        purpose: 'Matrix 24',
        source: workflowSource('.github/workflows/ci.yml', 'build'),
      },
      {
        context: 'Workflow Lint',
        ruleset: 'CI-CD',
        purpose: 'Workflow validation',
        source: workflowSource('.github/workflows/ci.yml', 'actionlint'),
      },
      {
        context: 'PR-Template vollständig',
        ruleset: 'main protected',
        purpose: 'External fixture',
        source: { type: 'external', provider: 'owner-installed-pr-template-app' },
      },
    ],
    nonRequiredWorkflowChecks: [],
    observations: ['Owner verification pending.'],
  };
}

const workflow = [
  'name: CI',
  'jobs:',
  '  build:',
  '    name: Build (${{ matrix.node }})',
  '    strategy:',
  '      matrix:',
  '        node: [22, 24]',
  '    runs-on: ubuntu-latest',
  '    steps: []',
  '  actionlint:',
  '    name: Workflow Lint',
  '    runs-on: ubuntu-latest',
  '    steps: []',
  '  optional:',
  '    runs-on: ubuntu-latest',
  '    steps: []',
  '',
].join('\n');

function createFixture(mutator = () => {}) {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'required-checks-'));
  mkdirSync(resolve(rootDir, '.github/workflows'), { recursive: true });
  mkdirSync(resolve(rootDir, 'docs'), { recursive: true });
  const manifest = fixtureManifest();
  const state = { manifest, workflow, documentationOverride: null };
  mutator(state);
  writeFileSync(resolve(rootDir, '.github/required-checks.schema.json'), schema);
  writeFileSync(
    resolve(rootDir, '.github/required-checks.json'),
    `${JSON.stringify(state.manifest, null, 2)}\n`,
  );
  writeFileSync(resolve(rootDir, '.github/workflows/ci.yml'), state.workflow);
  writeFileSync(
    resolve(rootDir, 'docs/CI-WORKFLOW.md'),
    state.documentationOverride ?? `# CI\n\n${renderRequiredChecksDocumentation(state.manifest)}\n`,
  );
  return rootDir;
}

function withFixture(mutator, assertion) {
  const rootDir = createFixture(mutator);
  try {
    assertion(rootDir);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

test('accepts matrix contexts, an external check and an unrelated non-required workflow job', () => {
  withFixture(undefined, (rootDir) => {
    assert.deepEqual(validateRepository({ rootDir }).errors, []);
  });
});

test('reports a missing required workflow job with its concrete producer', () => {
  withFixture(
    (state) => {
      state.workflow = state.workflow.replace(/ {2}actionlint:[\s\S]*?(?= {2}optional:)/, '');
    },
    (rootDir) => {
      assert.match(
        validateRepository({ rootDir }).errors.join('\n'),
        /Workflow Lint: workflow producers differ.*\.github\/workflows\/ci\.yml#actionlint/s,
      );
    },
  );
});

test('reports a renamed matrix context and all newly rendered names', () => {
  withFixture(
    (state) => {
      state.workflow = state.workflow.replace(
        'name: Build (${{ matrix.node }})',
        'name: Compile (${{ matrix.node }})',
      );
    },
    (rootDir) => {
      const errors = validateRepository({ rootDir }).errors.join('\n');
      assert.match(errors, /Build \(22\): workflow producers differ/);
      assert.match(errors, /rendered contexts differ.*Compile \(22\).*Compile \(24\)/s);
    },
  );
});

test('rejects a required context assigned to the wrong ruleset', () => {
  withFixture(
    (state) => {
      state.manifest.checks[0].ruleset = 'main protected';
    },
    (rootDir) => {
      assert.match(
        validateRepository({ rootDir }).errors.join('\n'),
        /Build \(22\): manifest ruleset main protected differs from snapshot ruleset CI-CD/,
      );
    },
  );
});

test('rejects stale generated documentation', () => {
  withFixture(
    (state) => {
      state.documentationOverride =
        '# CI\n\n<!-- required-checks:start -->\nstale\n<!-- required-checks:end -->\n';
    },
    (rootDir) => {
      assert.match(validateRepository({ rootDir }).errors.join('\n'), /section is stale/);
    },
  );
});

test('rejects duplicated generated documentation markers', () => {
  withFixture(
    (state) => {
      const generated = renderRequiredChecksDocumentation(state.manifest);
      state.documentationOverride = `# CI\n\n${generated}\n\n${generated}\n`;
    },
    (rootDir) => {
      assert.match(
        validateRepository({ rootDir }).errors.join('\n'),
        /expected exactly one generated required-check section/,
      );
    },
  );
});

test('requires evidence before owner verification can be marked complete', () => {
  withFixture(
    (state) => {
      state.manifest.ownerVerification.status = 'verified';
    },
    (rootDir) => {
      assert.match(
        validateRepository({ rootDir }).errors.join('\n'),
        /ownerVerification\.evidence is required/,
      );
    },
  );
});

test('fails closed for unsupported matrix include/exclude context rendering', () => {
  assert.throws(
    () =>
      renderJobContexts(
        {
          name: 'Build (${{ matrix.node }})',
          strategy: { matrix: { node: [22, 24], exclude: [{ node: 22 }] } },
        },
        '.github/workflows/ci.yml#build',
        'build',
      ),
    /matrix include\/exclude.*must be modelled explicitly/,
  );
});

test('is byte-deterministic across repeated rendering and validation', () => {
  withFixture(undefined, (rootDir) => {
    const first = validateRepository({ rootDir });
    const second = validateRepository({ rootDir });
    assert.equal(first.expectedDocumentation, second.expectedDocumentation);
    assert.deepEqual(first.errors, second.errors);
  });
});

test('live Ruleset comparison fails closed for missing and wrong assignments', () => {
  const manifest = fixtureManifest();
  const matching = manifest.rulesets.map((ruleset) => ({
    id: ruleset.id,
    name: ruleset.name,
    rules: [
      {
        type: 'required_status_checks',
        parameters: {
          required_status_checks: ruleset.contexts.map((context) => ({ context })),
        },
      },
    ],
  }));
  assert.deepEqual(compareLiveRulesets(manifest, matching), []);
  const jointlyWeakened = structuredClone(manifest);
  jointlyWeakened.checks = jointlyWeakened.checks.filter((check) => check.context !== 'Build (24)');
  jointlyWeakened.rulesets[0].contexts = jointlyWeakened.rulesets[0].contexts.filter(
    (context) => context !== 'Build (24)',
  );
  assert.match(compareLiveRulesets(jointlyWeakened, matching).join('\n'), /live rulesets differ/);
  matching[0].rules[0].parameters.required_status_checks.pop();
  assert.match(compareLiveRulesets(manifest, matching).join('\n'), /live rulesets differ/);
});
