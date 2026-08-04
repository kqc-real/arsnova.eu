import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  chmodSync,
  existsSync,
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
    join(repoRoot, 'scripts/deploy/lib-deploy-state.sh'),
  ];
  const forbidden =
    /\b(docker\s+build|docker\s+compose\s+build|compose\s+build)\b/;

  for (const file of files) {
    const executableLines = readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#');
      })
      .join('\n');
    assert.doesNotMatch(
      executableLines,
      forbidden,
      `${file} must not contain build commands`,
    );
  }

  // Positive: pull path must exist
  assert.match(readFileSync(deployScript, 'utf8'), /compose pull app pdf-worker/);
  assert.match(readFileSync(deployScript, 'utf8'), /--rollback/);
});

test('atomic state rotation writes current and previous with safe modes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-deploy-state-'));
  const stateDir = join(dir, '.deploy-state');
  const firstImage = VALID_DIGEST;
  const secondImage = `ghcr.io/kqc-real/arsnova.eu@sha256:${'cd'.repeat(32)}`;
  const firstSha = VALID_SHA;
  const secondSha = 'b'.repeat(40);

  let result = sourceCheck(
    `rotate_deploy_state "${stateDir}" "${firstImage}" "${firstSha}"`,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(stateDir, 'current.image'), 'utf8').trim(), firstImage);
  assert.equal(readFileSync(join(stateDir, 'current.sha'), 'utf8').trim(), firstSha);
  assert.equal(existsSync(join(stateDir, 'previous.image')), false);

  result = sourceCheck(
    `rotate_deploy_state "${stateDir}" "${secondImage}" "${secondSha}"`,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(stateDir, 'current.image'), 'utf8').trim(), secondImage);
  assert.equal(readFileSync(join(stateDir, 'current.sha'), 'utf8').trim(), secondSha);
  assert.equal(
    readFileSync(join(stateDir, 'previous.image'), 'utf8').trim(),
    firstImage,
  );
  assert.equal(readFileSync(join(stateDir, 'previous.sha'), 'utf8').trim(), firstSha);

  // Directory 0700, files 0600 (Linux stat -c / macOS stat -f)
  const dirModeResult = spawnSync(
    'bash',
    [
      '-c',
      `stat -c '%a' "${stateDir}" 2>/dev/null || stat -f '%Lp' "${stateDir}"`,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(dirModeResult.stdout.trim(), '700');
  const fileModeResult = spawnSync(
    'bash',
    [
      '-c',
      `stat -c '%a' "${stateDir}/current.image" 2>/dev/null || stat -f '%Lp' "${stateDir}/current.image"`,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(fileModeResult.stdout.trim(), '600');
});

test('missing previous deploy state fails with operator guidance', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-deploy-state-missing-'));
  const stateDir = join(dir, '.deploy-state');
  mkdirSync(stateDir, { mode: 0o700 });

  const result = sourceCheck(
    `load_previous_deploy_state "${stateDir}" DEPLOY_IMAGE DEPLOY_SHA`,
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Previous-Deploy-State/);
  assert.match(result.stderr, /Manuelles Rollback/);
  assert.match(result.stderr, /keine Datenbankmigrationen/i);
});

test('compose requires ARSNOVA_IMAGE and binds app/pdf-worker to the same ref', () => {
  const docker = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
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
    [
      'compose',
      '-f',
      projectCompose,
      '--env-file',
      envFile,
      'config',
      '--quiet',
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, ARSNOVA_IMAGE: '' },
      cwd: projectDir,
    },
  );
  assert.notEqual(missing.status, 0, 'missing ARSNOVA_IMAGE must fail compose config');
  assert.match(`${missing.stderr}${missing.stdout}`, /ARSNOVA_IMAGE/);

  writeFileSync(envFile, `${baseEnv}\nARSNOVA_IMAGE=${VALID_DIGEST}\n`);
  const ok = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      projectCompose,
      '--env-file',
      envFile,
      'config',
      '--format',
      'json',
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, ARSNOVA_IMAGE: VALID_DIGEST },
      cwd: projectDir,
    },
  );
  assert.equal(ok.status, 0, ok.stderr);
  const cfg = JSON.parse(ok.stdout);
  assert.equal(cfg.services.app.image, VALID_DIGEST);
  assert.equal(cfg.services['pdf-worker'].image, VALID_DIGEST);
  assert.equal(cfg.services.app.build, undefined);
});

test('deploy.sh --rollback fails clearly without previous state (dry path)', () => {
  const work = mkdtempSync(join(tmpdir(), 'arsnova-rollback-'));
  // Minimal fake tree: copy only needed scripts + empty env so script reaches state load
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
