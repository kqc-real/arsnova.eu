import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
      {
        name: 'CI-CD',
        id: 1,
        enforcement: 'active',
        target: 'branch',
        conditions: { refName: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
        checks: ['Build (22)', 'Build (24)', 'Workflow Lint'].map((context) => ({
          context,
          integrationId: 15368,
        })),
      },
      {
        name: 'main protected',
        id: 2,
        enforcement: 'active',
        target: 'branch',
        conditions: { refName: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
        checks: [{ context: 'PR-Template vollständig', integrationId: null }],
      },
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
  'on: pull_request',
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

test('rejects a recorded Ruleset that does not apply to the target branch', () => {
  withFixture(
    (state) => {
      state.manifest.rulesets[0].conditions.refName.include = ['refs/heads/release'];
    },
    (rootDir) => {
      assert.match(
        validateRepository({ rootDir }).errors.join('\n'),
        /CI-CD: ruleset conditions do not apply to main/,
      );
    },
  );
});

test('anchors the canonical target branch to main', () => {
  withFixture(
    (state) => {
      state.manifest.targetBranch = 'release';
    },
    (rootDir) => {
      assert.match(
        validateRepository({ rootDir }).errors.join('\n'),
        /manifest\/targetBranch must be equal to constant/,
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

test('rejects a required producer without a pull_request trigger', () => {
  withFixture(
    (state) => {
      state.workflow = state.workflow.replace('on: pull_request', 'on: push');
    },
    (rootDir) => {
      assert.match(
        validateRepository({ rootDir }).errors.join('\n'),
        /Build \(22\): no producer runs for pull requests targeting main;.*no pull_request trigger/,
      );
    },
  );
});

test('rejects a required producer that targets a different PR branch', () => {
  withFixture(
    (state) => {
      state.workflow = state.workflow.replace(
        'on: pull_request',
        'on:\n  pull_request:\n    branches: [release]',
      );
    },
    (rootDir) => {
      assert.match(
        validateRepository({ rootDir }).errors.join('\n'),
        /Build \(22\): no producer runs for pull requests targeting main;.*does not target main/,
      );
    },
  );
});

test('rejects a required producer with restrictive PR path filters', () => {
  withFixture(
    (state) => {
      state.workflow = state.workflow.replace(
        'on: pull_request',
        "on:\n  pull_request:\n    paths: ['src/**']",
      );
    },
    (rootDir) => {
      assert.match(
        validateRepository({ rootDir }).errors.join('\n'),
        /Build \(22\): no producer runs for pull requests targeting main;.*path filters/,
      );
    },
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

function matchingLiveRulesets(manifest) {
  return manifest.rulesets.map((ruleset) => ({
    id: ruleset.id,
    name: ruleset.name,
    enforcement: ruleset.enforcement,
    target: ruleset.target,
    conditions: {
      ref_name: {
        include: [...ruleset.conditions.refName.include],
        exclude: [...ruleset.conditions.refName.exclude],
      },
    },
    rules: [
      {
        type: 'required_status_checks',
        parameters: {
          required_status_checks: ruleset.checks.map((check) => ({
            context: check.context,
            ...(check.integrationId === null ? {} : { integration_id: check.integrationId }),
          })),
        },
      },
    ],
  }));
}

test('live Ruleset comparison fails closed for missing and jointly weakened assignments', () => {
  const manifest = fixtureManifest();
  const matching = matchingLiveRulesets(manifest);
  assert.deepEqual(compareLiveRulesets(manifest, matching), []);
  const jointlyWeakened = structuredClone(manifest);
  jointlyWeakened.checks = jointlyWeakened.checks.filter((check) => check.context !== 'Build (24)');
  jointlyWeakened.rulesets[0].checks = jointlyWeakened.rulesets[0].checks.filter(
    (check) => check.context !== 'Build (24)',
  );
  assert.match(compareLiveRulesets(jointlyWeakened, matching).join('\n'), /live rulesets differ/);
  matching[0].rules[0].parameters.required_status_checks.pop();
  assert.match(compareLiveRulesets(manifest, matching).join('\n'), /live rulesets differ/);
});

test('live Ruleset comparison retains enforcement, target and ref applicability', () => {
  const manifest = fixtureManifest();
  for (const mutate of [
    (ruleset) => {
      ruleset.enforcement = 'evaluate';
    },
    (ruleset) => {
      ruleset.target = 'tag';
    },
    (ruleset) => {
      ruleset.conditions.ref_name.include = ['refs/heads/release'];
    },
    (ruleset) => {
      ruleset.conditions.ref_name.exclude = ['refs/heads/main'];
    },
  ]) {
    const live = matchingLiveRulesets(manifest);
    mutate(live[0]);
    assert.match(compareLiveRulesets(manifest, live).join('\n'), /live rulesets differ/);
  }
});

test('live Ruleset comparison retains required-check integration bindings', () => {
  const manifest = fixtureManifest();
  const live = matchingLiveRulesets(manifest);
  live[0].rules[0].parameters.required_status_checks[0].integration_id = 99999;
  assert.match(compareLiveRulesets(manifest, live).join('\n'), /live rulesets differ/);
});

test('explicit null live Ruleset evidence fails closed in API and CLI paths', () => {
  withFixture(undefined, (rootDir) => {
    assert.match(
      validateRepository({ rootDir, liveRulesets: null }).errors.join('\n'),
      /live ruleset evidence must be a JSON array/,
    );
  });

  const tempRoot = mkdtempSync(resolve(tmpdir(), 'required-checks-null-'));
  const evidencePath = resolve(tempRoot, 'live.json');
  try {
    writeFileSync(evidencePath, 'null\n');
    const result = spawnSync(
      process.execPath,
      [
        resolve(repositoryRoot, 'scripts/validate-required-checks.mjs'),
        '--live-rulesets',
        evidencePath,
      ],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /live ruleset evidence must be a JSON array/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('owner acquisition documentation paginates repository Rulesets', () => {
  const documentation = readFileSync(resolve(repositoryRoot, 'docs/CI-WORKFLOW.md'), 'utf8');
  assert.match(
    documentation,
    /gh api --paginate repos\/kqc-real\/arsnova\.eu\/rulesets --jq '\.\[\]\.id'/,
  );
});
