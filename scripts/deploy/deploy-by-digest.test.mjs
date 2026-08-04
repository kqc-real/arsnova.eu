import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  chmodSync,
  existsSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const imageRefLib = join(repoRoot, 'scripts/deploy/lib-image-ref.sh');
const stateLib = join(repoRoot, 'scripts/deploy/lib-deploy-state.sh');
const deployScript = join(repoRoot, 'scripts/deploy.sh');
const composeFile = join(repoRoot, 'docker-compose.prod.yml');
const ciWorkflow = join(repoRoot, '.github/workflows/ci.yml');

const VALID_DIGEST = `ghcr.io/kqc-real/arsnova.eu@sha256:${'ab'.repeat(32)}`;
const VALID_SHA = 'a'.repeat(40);

function bash(script, env = {}) {
  return spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    cwd: repoRoot,
  });
}

function sourceCheck(expression, env = {}) {
  return bash(
    `set -euo pipefail
     source "${imageRefLib}"
     source "${stateLib}"
     ${expression}`,
    env,
  );
}

function readSnapshot(path) {
  const text = readFileSync(path, 'utf8');
  const image = text.match(/^IMAGE=(.+)$/m)?.[1] ?? '';
  const sha = text.match(/^SHA=(.+)$/m)?.[1] ?? '';
  return { image, sha };
}

function fileMode(path) {
  const result = spawnSync(
    'bash',
    ['-c', `stat -c '%a' "${path}" 2>/dev/null || stat -f '%Lp' "${path}"`],
    { encoding: 'utf8' },
  );
  return result.stdout.trim();
}

test('accepts canonical digest deploy image ref', () => {
  const result = sourceCheck(
    `require_canonical_deploy_image "${VALID_DIGEST}" || exit 1
     is_canonical_deploy_image "${VALID_DIGEST}" || exit 1`,
  );
  assert.equal(result.status, 0, result.stderr);
});

test('rejects invalid digest deploy image refs', () => {
  const cases = [
    '',
    'arsnova-eu:production',
    'ghcr.io/kqc-real/arsnova.eu:latest',
    'ghcr.io/kqc-real/arsnova.eu@sha256:deadbeef',
    `ghcr.io/other/arsnova.eu@sha256:${'ab'.repeat(32)}`,
    `ghcr.io/kqc-real/arsnova.eu@sha256:${'AB'.repeat(32)}`,
  ];

  for (const value of cases) {
    const result = sourceCheck(
      `require_canonical_deploy_image ${JSON.stringify(value)} "DEPLOY_IMAGE"`,
    );
    assert.notEqual(result.status, 0, `expected reject for ${value}`);
    assert.match(result.stderr, /DEPLOY_IMAGE|fehlt|ungültig/i);
  }
});

test('rejects invalid DEPLOY_SHA values', () => {
  const result = sourceCheck(`require_valid_deploy_sha "not-a-sha"`);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEPLOY_SHA|ungültig/i);
});

test('deploy.sh and helpers contain no build commands', () => {
  const files = [
    deployScript,
    imageRefLib,
    stateLib,
    join(repoRoot, 'scripts/prod-compose.sh'),
    join(repoRoot, 'scripts/deploy/checkout-deploy-sha.sh'),
  ];
  const forbidden = /\b(docker\s+build|docker\s+compose\s+build|compose\s+build)\b/;

  for (const file of files) {
    const executableLines = readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#');
      })
      .join('\n');
    assert.doesNotMatch(executableLines, forbidden, `${file} must not contain build commands`);
  }

  assert.match(readFileSync(deployScript, 'utf8'), /compose pull app pdf-worker/);
  assert.match(readFileSync(deployScript, 'utf8'), /--rollback/);
  assert.match(readFileSync(deployScript, 'utf8'), /--recover/);
});

test('atomic snapshot rotation writes current/previous with safe modes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-deploy-state-'));
  const stateDir = join(dir, '.deploy-state');
  const firstImage = VALID_DIGEST;
  const secondImage = `ghcr.io/kqc-real/arsnova.eu@sha256:${'cd'.repeat(32)}`;
  const firstSha = VALID_SHA;
  const secondSha = 'b'.repeat(40);

  let result = sourceCheck(`rotate_deploy_state "${stateDir}" "${firstImage}" "${firstSha}"`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readSnapshot(join(stateDir, 'current.state')), {
    image: firstImage,
    sha: firstSha,
  });
  assert.equal(existsSync(join(stateDir, 'previous.state')), false);

  result = sourceCheck(`rotate_deploy_state "${stateDir}" "${secondImage}" "${secondSha}"`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readSnapshot(join(stateDir, 'current.state')), {
    image: secondImage,
    sha: secondSha,
  });
  assert.deepEqual(readSnapshot(join(stateDir, 'previous.state')), {
    image: firstImage,
    sha: firstSha,
  });

  assert.equal(fileMode(stateDir), '700');
  assert.equal(fileMode(join(stateDir, 'current.state')), '600');
});

test('idempotent redeploy of same image+sha does not overwrite previous', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-deploy-idempotent-'));
  const stateDir = join(dir, '.deploy-state');
  const firstImage = VALID_DIGEST;
  const secondImage = `ghcr.io/kqc-real/arsnova.eu@sha256:${'cd'.repeat(32)}`;
  const firstSha = VALID_SHA;
  const secondSha = 'b'.repeat(40);

  assert.equal(
    sourceCheck(`rotate_deploy_state "${stateDir}" "${firstImage}" "${firstSha}"`).status,
    0,
  );
  assert.equal(
    sourceCheck(`rotate_deploy_state "${stateDir}" "${secondImage}" "${secondSha}"`).status,
    0,
  );

  const previousBefore = readSnapshot(join(stateDir, 'previous.state'));
  const result = sourceCheck(`rotate_deploy_state "${stateDir}" "${secondImage}" "${secondSha}"`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readSnapshot(join(stateDir, 'current.state')), {
    image: secondImage,
    sha: secondSha,
  });
  assert.deepEqual(readSnapshot(join(stateDir, 'previous.state')), previousBefore);
});

test('rollback commit does not promote failed current to previous', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-deploy-rollback-state-'));
  const stateDir = join(dir, '.deploy-state');
  const goodImage = VALID_DIGEST;
  const badImage = `ghcr.io/kqc-real/arsnova.eu@sha256:${'ef'.repeat(32)}`;
  const goodSha = VALID_SHA;
  const badSha = 'c'.repeat(40);

  assert.equal(
    sourceCheck(`rotate_deploy_state "${stateDir}" "${goodImage}" "${goodSha}"`).status,
    0,
  );
  assert.equal(
    sourceCheck(`rotate_deploy_state "${stateDir}" "${badImage}" "${badSha}"`).status,
    0,
  );

  // Smoke failed after successful deploy: rollback restores previous.
  const result = sourceCheck(
    `commit_rollback_deploy_state "${stateDir}" "${goodImage}" "${goodSha}"`,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readSnapshot(join(stateDir, 'current.state')), {
    image: goodImage,
    sha: goodSha,
  });
  // previous stays the good snapshot — failed release must not become next target
  assert.deepEqual(readSnapshot(join(stateDir, 'previous.state')), {
    image: goodImage,
    sha: goodSha,
  });
  assert.notEqual(readSnapshot(join(stateDir, 'previous.state')).image, badImage);
});

test('interrupted rotation never leaves mixed image/sha pair', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-deploy-abort-'));
  const stateDir = join(dir, '.deploy-state');
  const firstImage = VALID_DIGEST;
  const firstSha = VALID_SHA;
  const secondImage = `ghcr.io/kqc-real/arsnova.eu@sha256:${'cd'.repeat(32)}`;
  const secondSha = 'b'.repeat(40);

  assert.equal(
    sourceCheck(`rotate_deploy_state "${stateDir}" "${firstImage}" "${firstSha}"`).status,
    0,
  );

  // Simulate crash after previous snapshot write, before current rename:
  // new previous written, current still old — both snapshots remain consistent.
  const crash = sourceCheck(`
    ensure_deploy_state_dir "${stateDir}"
    write_atomic_snapshot "${stateDir}/previous.state" "${firstImage}" "${firstSha}"
    # intentional abort before writing current.state with second release
    exit 42
  `);
  assert.equal(crash.status, 42);
  assert.deepEqual(readSnapshot(join(stateDir, 'current.state')), {
    image: firstImage,
    sha: firstSha,
  });
  assert.deepEqual(readSnapshot(join(stateDir, 'previous.state')), {
    image: firstImage,
    sha: firstSha,
  });

  // Resume with full rotation still yields consistent pairs
  assert.equal(
    sourceCheck(`rotate_deploy_state "${stateDir}" "${secondImage}" "${secondSha}"`).status,
    0,
  );
  assert.deepEqual(readSnapshot(join(stateDir, 'current.state')), {
    image: secondImage,
    sha: secondSha,
  });
  assert.deepEqual(readSnapshot(join(stateDir, 'previous.state')), {
    image: firstImage,
    sha: firstSha,
  });
});

test('recover loads current; rollback loads previous', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-deploy-modes-'));
  const stateDir = join(dir, '.deploy-state');
  const firstImage = VALID_DIGEST;
  const secondImage = `ghcr.io/kqc-real/arsnova.eu@sha256:${'cd'.repeat(32)}`;
  const firstSha = VALID_SHA;
  const secondSha = 'b'.repeat(40);

  assert.equal(
    sourceCheck(`rotate_deploy_state "${stateDir}" "${firstImage}" "${firstSha}"`).status,
    0,
  );
  assert.equal(
    sourceCheck(`rotate_deploy_state "${stateDir}" "${secondImage}" "${secondSha}"`).status,
    0,
  );

  const recover = sourceCheck(`
    load_current_deploy_state "${stateDir}" IMG SHA
    printf '%s|%s\\n' "$IMG" "$SHA"
  `);
  assert.equal(recover.status, 0, recover.stderr);
  assert.equal(recover.stdout.trim(), `${secondImage}|${secondSha}`);

  const rollback = sourceCheck(`
    load_previous_deploy_state "${stateDir}" IMG SHA
    printf '%s|%s\\n' "$IMG" "$SHA"
  `);
  assert.equal(rollback.status, 0, rollback.stderr);
  assert.equal(rollback.stdout.trim(), `${firstImage}|${firstSha}`);
});

test('missing previous deploy state fails with operator guidance', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-deploy-state-missing-'));
  const stateDir = join(dir, '.deploy-state');
  mkdirSync(stateDir, { mode: 0o700 });

  const result = sourceCheck(`load_previous_deploy_state "${stateDir}" DEPLOY_IMAGE DEPLOY_SHA`);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Previous-Deploy-State|previous\.state/i);
  assert.match(result.stderr, /--recover/);
  assert.match(result.stderr, /keine Datenbankmigrationen/i);
});

test('write_operator_image_env persists ARSNOVA_IMAGE for compose', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-operator-env-'));
  const result = sourceCheck(`write_operator_image_env "${dir}" "${VALID_DIGEST}"`);
  assert.equal(result.status, 0, result.stderr);
  const envPath = join(dir, '.env.arsnova-image');
  assert.equal(readFileSync(envPath, 'utf8').trim(), `ARSNOVA_IMAGE=${VALID_DIGEST}`);
  assert.equal(fileMode(envPath), '600');
});

test('compose requires ARSNOVA_IMAGE and binds app/pdf-worker to the same ref', () => {
  const docker = spawnSync('docker', ['compose', 'version'], {
    encoding: 'utf8',
  });
  if (docker.status !== 0) {
    assert.fail('docker compose is required for compose contract tests');
  }

  const projectDir = mkdtempSync(join(tmpdir(), 'arsnova-compose-env-'));
  const projectCompose = join(projectDir, 'docker-compose.prod.yml');
  const envFile = join(projectDir, '.env.production');
  copyFileSync(composeFile, projectCompose);

  const baseEnv = [
    'POSTGRES_USER=arsnova_user',
    'POSTGRES_PASSWORD=test-password',
    'POSTGRES_DB=arsnova_v3',
    'DATABASE_URL=postgresql://arsnova_user:test-password@postgres:5432/arsnova_v3?schema=public',
    'REDIS_URL=redis://redis:6379',
    'JWT_SECRET=compose-contract-jwt-secret-0000000000000001',
    'ADMIN_SECRET=compose-contract-admin-secret-0000000000001',
    'ADMIN_DIAGNOSTIC_SECRET=compose-contract-diagnostic-000000001',
    'NODE_ENV=production',
  ].join('\n');

  writeFileSync(envFile, `${baseEnv}\n`);
  const missing = spawnSync(
    'docker',
    ['compose', '-f', projectCompose, '--env-file', envFile, 'config', '--quiet'],
    {
      encoding: 'utf8',
      env: { ...process.env, ARSNOVA_IMAGE: '' },
      cwd: projectDir,
    },
  );
  assert.notEqual(missing.status, 0, 'missing ARSNOVA_IMAGE must fail compose config');
  assert.match(`${missing.stderr}${missing.stdout}`, /ARSNOVA_IMAGE/);

  const imageEnv = join(projectDir, '.env.arsnova-image');
  writeFileSync(imageEnv, `ARSNOVA_IMAGE=${VALID_DIGEST}\n`);
  const ok = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      projectCompose,
      '--env-file',
      envFile,
      '--env-file',
      imageEnv,
      'config',
      '--format',
      'json',
    ],
    {
      encoding: 'utf8',
      env: { ...process.env },
      cwd: projectDir,
    },
  );
  assert.equal(ok.status, 0, ok.stderr);
  const cfg = JSON.parse(ok.stdout);
  assert.equal(cfg.services.app.image, VALID_DIGEST);
  assert.equal(cfg.services['pdf-worker'].image, VALID_DIGEST);
  assert.equal(cfg.services.app.build, undefined);
});

test('deploy.sh --rollback fails clearly without previous state', () => {
  const work = mkdtempSync(join(tmpdir(), 'arsnova-rollback-'));
  mkdirSync(join(work, 'scripts', 'deploy'), { recursive: true });
  writeFileSync(join(work, '.env.production'), 'NODE_ENV=production\n');
  for (const name of ['lib-image-ref.sh', 'lib-deploy-state.sh']) {
    writeFileSync(
      join(work, 'scripts', 'deploy', name),
      readFileSync(join(repoRoot, 'scripts', 'deploy', name)),
    );
  }
  writeFileSync(join(work, 'scripts', 'deploy.sh'), readFileSync(deployScript));
  chmodSync(join(work, 'scripts', 'deploy.sh'), 0o755);

  const result = spawnSync('bash', [join(work, 'scripts', 'deploy.sh'), '--rollback'], {
    encoding: 'utf8',
    cwd: work,
    env: { ...process.env, DEPLOY_DIR: work },
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}${result.stdout}`, /Previous-Deploy-State|previous/i);
});

test('CI deploy bootstraps DEPLOY_SHA checkout before deploy.sh', () => {
  const yaml = readFileSync(ciWorkflow, 'utf8');
  const deployJob = yaml.split('name: Deploy via SSH')[1];
  assert.ok(deployJob, 'Deploy via SSH step missing');
  const script = deployJob.split('script: |')[1]?.split(/^ {2}[A-Za-z]/m)[0];
  assert.ok(script, 'deploy SSH script missing');

  const checkoutIdx = script.indexOf('git checkout --detach --force "$DEPLOY_SHA"');
  const deployIdx = script.indexOf('./scripts/deploy.sh');
  assert.ok(checkoutIdx >= 0, 'bootstrap checkout missing in deploy SSH');
  assert.ok(deployIdx >= 0, 'deploy.sh invocation missing');
  assert.ok(checkoutIdx < deployIdx, 'DEPLOY_SHA must be checked out before ./scripts/deploy.sh');
  // Must not invoke a helper that only exists after checkout
  assert.doesNotMatch(
    script.slice(0, deployIdx),
    /(?:^|\s)(?:\.\/)?scripts\/deploy\/checkout-deploy-sha\.sh\b/,
    'bootstrap must be inline for 1B→1C cutover',
  );
});

test('CI rollback starts installed script without pre-checkout', () => {
  const yaml = readFileSync(ciWorkflow, 'utf8');
  const rollbackJob = yaml.split('name: Roll back via SSH')[1];
  assert.ok(rollbackJob, 'Roll back via SSH step missing');
  const script = rollbackJob.split('script: |')[1]?.split(/^ {2}[A-Za-z]/m)[0];
  assert.ok(script, 'rollback SSH script missing');

  assert.match(script, /\.\/scripts\/deploy\.sh --rollback/);
  assert.doesNotMatch(
    script,
    /git checkout/,
    'rollback must not checkout before reading previous.state',
  );
});

test('bootstrap regression: old checkout with compose build is not executed', () => {
  // Simulates server still on 1B tree: running old deploy.sh would build.
  // CI bootstrap must checkout first so the new script runs instead.
  const work = mkdtempSync(join(tmpdir(), 'arsnova-bootstrap-'));
  mkdirSync(join(work, 'scripts'), { recursive: true });
  writeFileSync(
    join(work, 'scripts', 'deploy.sh'),
    `#!/usr/bin/env bash
set -euo pipefail
echo "OLD_1B_SCRIPT"
# forbidden legacy path
docker compose build
`,
  );
  chmodSync(join(work, 'scripts', 'deploy.sh'), 0o755);

  const newTree = mkdtempSync(join(tmpdir(), 'arsnova-bootstrap-new-'));
  mkdirSync(join(newTree, 'scripts'), { recursive: true });
  writeFileSync(
    join(newTree, 'scripts', 'deploy.sh'),
    `#!/usr/bin/env bash
set -euo pipefail
echo "NEW_1C_SCRIPT"
echo "compose pull app pdf-worker"
`,
  );
  chmodSync(join(newTree, 'scripts', 'deploy.sh'), 0o755);

  // Without bootstrap: old script would run
  const without = spawnSync('bash', [join(work, 'scripts', 'deploy.sh')], {
    encoding: 'utf8',
    cwd: work,
  });
  assert.match(without.stdout + without.stderr, /OLD_1B_SCRIPT/);

  // With bootstrap-equivalent swap (checkout replaces tree), new script runs
  unlinkSync(join(work, 'scripts', 'deploy.sh'));
  copyFileSync(join(newTree, 'scripts', 'deploy.sh'), join(work, 'scripts', 'deploy.sh'));
  chmodSync(join(work, 'scripts', 'deploy.sh'), 0o755);
  const withBootstrap = spawnSync('bash', [join(work, 'scripts', 'deploy.sh')], {
    encoding: 'utf8',
    cwd: work,
  });
  assert.equal(withBootstrap.status, 0, withBootstrap.stderr);
  assert.match(withBootstrap.stdout, /NEW_1C_SCRIPT/);
  assert.doesNotMatch(withBootstrap.stdout + withBootstrap.stderr, /OLD_1B/);
});
