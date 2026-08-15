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
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const imageRefLib = join(repoRoot, 'scripts/deploy/lib-image-ref.sh');
const stateLib = join(repoRoot, 'scripts/deploy/lib-deploy-state.sh');
const archLib = join(repoRoot, 'scripts/deploy/lib-arch.sh');
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
     source "${archLib}"
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
    archLib,
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

test('normalize_docker_arch maps aarch64/x86_64 aliases', () => {
  const result = sourceCheck(`
    test "$(normalize_docker_arch aarch64)" = arm64
    test "$(normalize_docker_arch ARM64)" = arm64
    test "$(normalize_docker_arch x86_64)" = amd64
    test "$(normalize_docker_arch amd64)" = amd64
  `);
  assert.equal(result.status, 0, result.stderr);
});

test('architecture preflight accepts arm64 host + arm64 image', () => {
  const result = sourceCheck(`
    docker_host_architecture() { printf 'arm64\\n'; }
    image_architecture() { printf 'arm64\\n'; }
    require_image_compatible_with_host "${VALID_DIGEST}"
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Architektur-Preflight OK/);
});

function assertArchDiag(stderr, host, image, required = 'arm64') {
  assert.match(stderr, new RegExp(`Hostarchitektur:\\s*${host}`));
  assert.match(stderr, new RegExp(`Imagearchitektur:\\s*${image}`));
  assert.match(stderr, new RegExp(`erforderlich:\\s*${required}`));
  assert.match(stderr, /Abbruch vor Migration/);
}

test('architecture preflight rejects amd64 image on arm64 host (incident #229)', () => {
  const result = sourceCheck(`
    docker_host_architecture() { printf 'arm64\\n'; }
    image_architecture() { printf 'amd64\\n'; }
    require_image_compatible_with_host "${VALID_DIGEST}"
  `);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Image-Architektur amd64/);
  assertArchDiag(result.stderr, 'arm64', 'amd64', 'arm64');
});

test('architecture preflight rejects empty or unknown architectures with full diag', () => {
  let result = sourceCheck(`
    docker_host_architecture() { printf '\\n'; }
    image_architecture() { printf 'arm64\\n'; }
    require_image_compatible_with_host "${VALID_DIGEST}"
  `);
  assert.notEqual(result.status, 0);
  assertArchDiag(result.stderr, '<leer>', 'arm64', 'arm64');

  result = sourceCheck(`
    docker_host_architecture() { printf 'arm64\\n'; }
    image_architecture() { printf '\\n'; }
    require_image_compatible_with_host "${VALID_DIGEST}"
  `);
  assert.notEqual(result.status, 0);
  assertArchDiag(result.stderr, 'arm64', '<leer>', 'arm64');

  result = sourceCheck(`
    docker_host_architecture() { printf 'arm64\\n'; }
    image_architecture() { printf 'riscv64\\n'; }
    require_image_compatible_with_host "${VALID_DIGEST}"
  `);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unbekannt/i);
  assertArchDiag(result.stderr, 'arm64', 'riscv64', 'arm64');
});

test('architecture preflight accepts aarch64 host alias with arm64 image', () => {
  const result = sourceCheck(`
    docker_host_architecture() { printf 'aarch64\\n'; }
    image_architecture() { printf 'arm64\\n'; }
    require_image_compatible_with_host "${VALID_DIGEST}"
  `);
  assert.equal(result.status, 0, result.stderr);
});

test('deploy.sh runs arch preflight after pull and before compose up/run', () => {
  const text = readFileSync(deployScript, 'utf8');
  const pullIdx = text.indexOf('compose pull app pdf-worker');
  const archIdx = text.indexOf('require_image_compatible_with_host');
  const upIdx = text.indexOf('compose up -d --wait postgres redis');
  const migrateIdx = text.indexOf('compose run --rm --no-deps --entrypoint "" app');
  const rotateIdx = text.indexOf('rotate_deploy_state');
  const envIdx = text.indexOf('write_operator_image_env');

  assert.ok(pullIdx >= 0 && archIdx > pullIdx, 'preflight after pull');
  assert.ok(upIdx > archIdx, 'preflight before compose up');
  assert.ok(migrateIdx > upIdx, 'infra wait before migrate');
  assert.ok(migrateIdx > archIdx, 'preflight before migrate');
  assert.ok(rotateIdx > migrateIdx, 'state rotation after migrate');
  assert.ok(envIdx > archIdx, 'env write after preflight success path');
});

test('prisma migrate uses --no-deps so pdf-worker is not started as dependency', () => {
  const text = readFileSync(deployScript, 'utf8');
  const migrateLine = text.split('\n').find((line) => line.includes('prisma migrate deploy'));
  assert.ok(migrateLine, 'migrate command missing');
  assert.match(migrateLine, /compose run --rm --no-deps --entrypoint ""/);
  assert.doesNotMatch(
    migrateLine,
    /compose run --rm --entrypoint/,
    'migrate without --no-deps would start depends_on services',
  );

  // Compose-Vertrag: app depends_on pdf-worker — ohne --no-deps würde migrate ihn starten.
  const composeText = readFileSync(composeFile, 'utf8');
  assert.match(composeText, /pdf-worker:\s*\n\s*condition:\s*service_healthy/);
});

test('real deploy.sh aborts amd64 image before compose up/run and state writes', () => {
  const work = mkdtempSync(join(tmpdir(), 'arsnova-arch-e2e-'));
  const bin = join(work, 'mock-bin');
  const mockLog = join(work, 'mock-commands.log');
  mkdirSync(bin, { recursive: true });
  mkdirSync(join(work, 'scripts', 'deploy'), { recursive: true });
  mkdirSync(join(work, '.deploy-state'), { mode: 0o700 });
  copyFileSync(composeFile, join(work, 'docker-compose.prod.yml'));
  writeFileSync(
    join(work, '.env.production'),
    [
      'POSTGRES_USER=arsnova_user',
      'POSTGRES_PASSWORD=test-password',
      'POSTGRES_DB=arsnova_v3',
      'DATABASE_URL=postgresql://arsnova_user:test-password@postgres:5432/arsnova_v3?schema=public',
      'REDIS_URL=redis://redis:6379',
      'JWT_SECRET=arch-e2e-jwt-secret-00000000000000000001',
      'ADMIN_SECRET=arch-e2e-admin-secret-0000000000000001',
      'ADMIN_DIAGNOSTIC_SECRET=arch-e2e-diagnostic-0000000000001',
      'NODE_ENV=production',
    ].join('\n') + '\n',
  );
  writeFileSync(
    join(work, '.deploy-state', 'current.state'),
    `IMAGE=${VALID_DIGEST}\nSHA=${VALID_SHA}\n`,
  );
  writeFileSync(join(work, '.env.arsnova-image'), `ARSNOVA_IMAGE=${VALID_DIGEST}\n`);
  const beforeState = readFileSync(join(work, '.deploy-state', 'current.state'), 'utf8');
  const beforeEnv = readFileSync(join(work, '.env.arsnova-image'), 'utf8');

  for (const name of [
    'lib-image-ref.sh',
    'lib-deploy-state.sh',
    'lib-arch.sh',
    'checkout-deploy-sha.sh',
  ]) {
    const src = join(repoRoot, 'scripts', 'deploy', name);
    if (existsSync(src)) {
      writeFileSync(join(work, 'scripts', 'deploy', name), readFileSync(src));
    }
  }
  // Echtes produktives Deploy-Skript (nicht Mini-Harness).
  writeFileSync(join(work, 'scripts', 'deploy.sh'), readFileSync(deployScript));
  chmodSync(join(work, 'scripts', 'deploy.sh'), 0o755);

  writeFileSync(
    join(bin, 'git'),
    `#!/usr/bin/env bash
printf 'git %s\\n' "$*" >>"${mockLog}"
case "$1" in
  fetch|cat-file|checkout) exit 0 ;;
  rev-parse) printf '%s\\n' "${VALID_SHA}" ;;
  log) printf 'deadbeef test commit\\n' ;;
  *) exit 0 ;;
esac
`,
  );
  writeFileSync(
    join(bin, 'curl'),
    `#!/usr/bin/env bash
printf 'curl %s\\n' "$*" >>"${mockLog}"
exit 0
`,
  );
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
printf 'docker %s\\n' "$*" >>"${mockLog}"
if [[ "$1" == "info" ]]; then
  printf 'arm64\\n'
  exit 0
fi
if [[ "$1" == "image" && "$2" == "inspect" ]]; then
  # Host arm64, Image amd64 → Incident #229
  printf 'amd64\\n'
  exit 0
fi
if [[ "$1" == "compose" ]]; then
  shift
  args="$*"
  if [[ "$args" == *" up "* || "$args" == up* || "$args" == *" run "* || "$args" == run* ]]; then
    echo "UNEXPECTED compose mutation: $args" >&2
    exit 99
  fi
  if [[ "$args" == *config* && "$args" == *json* ]]; then
    printf '%s\\n' "{\\"services\\":{\\"app\\":{\\"image\\":\\"${VALID_DIGEST}\\"},\\"pdf-worker\\":{\\"image\\":\\"${VALID_DIGEST}\\"}}}"
    exit 0
  fi
  if [[ "$args" == *config* || "$args" == *pull* ]]; then
    exit 0
  fi
  exit 0
fi
exit 0
`,
  );
  chmodSync(join(bin, 'git'), 0o755);
  chmodSync(join(bin, 'curl'), 0o755);
  chmodSync(join(bin, 'docker'), 0o755);

  const result = spawnSync('bash', [join(work, 'scripts', 'deploy.sh')], {
    encoding: 'utf8',
    cwd: work,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      DEPLOY_IMAGE: VALID_DIGEST,
      DEPLOY_SHA: VALID_SHA,
      DEPLOY_DIR: work,
      DEPLOY_BRANCH: 'main',
    },
  });

  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assertArchDiag(`${result.stderr}${result.stdout}`, 'arm64', 'amd64', 'arm64');
  assert.match(`${result.stderr}${result.stdout}`, /nicht kompatibel/);

  const log = existsSync(mockLog) ? readFileSync(mockLog, 'utf8') : '';
  assert.match(log, /docker compose .*config/);
  assert.match(log, /docker compose .*pull/);
  assert.doesNotMatch(log, /docker compose .* up\b/);
  assert.doesNotMatch(log, /docker compose .* run\b/);
  assert.equal(readFileSync(join(work, '.deploy-state', 'current.state'), 'utf8'), beforeState);
  assert.equal(readFileSync(join(work, '.env.arsnova-image'), 'utf8'), beforeEnv);
  assert.equal(existsSync(join(work, '.deploy-state', 'previous.state')), false);
});

test('CI Trivy image scan sets TRIVY_PLATFORM=linux/arm64', () => {
  const yaml = readFileSync(ciWorkflow, 'utf8');
  const trivy = yaml.split('name: Trivy Image Scan')[1]?.split(/^ {2}[a-z]/m)[0];
  assert.ok(trivy, 'Trivy Image Scan job missing');
  assert.match(trivy, /TRIVY_PLATFORM:\s*linux\/arm64/);
});

test('Docker Build job runs natively on ubuntu-24.04-arm for linux/arm64', () => {
  const yaml = readFileSync(ciWorkflow, 'utf8');
  const dockerSection = yaml.split('name: Docker Build')[1]?.split(/^ {2}[a-z]/m)[0];
  assert.ok(dockerSection, 'Docker Build job missing');
  assert.match(dockerSection, /runs-on:\s*ubuntu-24\.04-arm/);
  assert.match(dockerSection, /platforms:\s*linux\/arm64/);
  assert.match(dockerSection, /assert-native-arm64\.sh/);
  assert.match(dockerSection, /scope=production-arm64/);
  assert.doesNotMatch(
    dockerSection.split('Build Docker image')[0] || '',
    /runs-on:\s*ubuntu-latest/,
  );
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
  assert.equal(
    cfg.services.spacy,
    undefined,
    'spaCy-Sidecar darf ohne Compose-Profil nlp nicht starten',
  );
});

function writeMinimalProdEnv(projectDir) {
  writeFileSync(
    join(projectDir, '.env.production'),
    [
      'POSTGRES_USER=arsnova_user',
      'POSTGRES_PASSWORD=test-password',
      'POSTGRES_DB=arsnova_v3',
      'DATABASE_URL=postgresql://arsnova_user:test-password@postgres:5432/arsnova_v3?schema=public',
      'REDIS_URL=redis://redis:6379',
      'JWT_SECRET=fresh-host-jwt-secret-00000000000000000001',
      'ADMIN_SECRET=fresh-host-admin-secret-0000000000000001',
      'ADMIN_DIAGNOSTIC_SECRET=fresh-host-diagnostic-00000000001',
      'NODE_ENV=production',
    ].join('\n') + '\n',
  );
}

function installProdComposeWrapper(projectDir) {
  copyFileSync(composeFile, join(projectDir, 'docker-compose.prod.yml'));
  writeMinimalProdEnv(projectDir);
  const wrapper = readFileSync(join(repoRoot, 'scripts/prod-compose.sh'), 'utf8').replace(
    'REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"',
    `REPO_ROOT="${projectDir}"`,
  );
  const wrapperPath = join(projectDir, 'prod-compose.sh');
  writeFileSync(wrapperPath, wrapper);
  chmodSync(wrapperPath, 0o755);
  return wrapperPath;
}

test('fresh-host prod-compose parses postgres without .env.arsnova-image', () => {
  const docker = spawnSync('docker', ['compose', 'version'], {
    encoding: 'utf8',
  });
  if (docker.status !== 0) {
    assert.fail('docker compose is required for fresh-host compose tests');
  }

  const projectDir = mkdtempSync(join(tmpdir(), 'arsnova-fresh-host-'));
  const wrapperPath = installProdComposeWrapper(projectDir);

  const result = spawnSync('bash', [wrapperPath, 'config', '--format', 'json'], {
    encoding: 'utf8',
    cwd: projectDir,
    env: { ...process.env, ARSNOVA_IMAGE: '' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Infra-Placeholder|Placeholder/i);
  const cfg = JSON.parse(result.stdout);
  assert.ok(cfg.services.postgres, 'postgres service must parse on fresh host');
  assert.match(
    cfg.services.app.image,
    /@sha256:0{64}$/,
    'fresh host must use infra placeholder, not a real deploy digest',
  );
  assert.equal(existsSync(join(projectDir, '.env.arsnova-image')), false);
});

test('prod-compose prefers .env.arsnova-image over shell ARSNOVA_IMAGE', () => {
  const docker = spawnSync('docker', ['compose', 'version'], {
    encoding: 'utf8',
  });
  if (docker.status !== 0) {
    assert.fail('docker compose is required for prod-compose precedence tests');
  }

  const projectDir = mkdtempSync(join(tmpdir(), 'arsnova-image-precedence-'));
  const wrapperPath = installProdComposeWrapper(projectDir);
  const fileDigest = `ghcr.io/kqc-real/arsnova.eu@sha256:${'11'.repeat(32)}`;
  const shellDigest = `ghcr.io/kqc-real/arsnova.eu@sha256:${'22'.repeat(32)}`;
  writeFileSync(join(projectDir, '.env.arsnova-image'), `ARSNOVA_IMAGE=${fileDigest}\n`);

  const result = spawnSync('bash', [wrapperPath, 'config', '--format', 'json'], {
    encoding: 'utf8',
    cwd: projectDir,
    env: { ...process.env, ARSNOVA_IMAGE: shellDigest },
  });
  assert.equal(result.status, 0, result.stderr);
  const cfg = JSON.parse(result.stdout);
  assert.equal(cfg.services.app.image, fileDigest);
  assert.equal(cfg.services['pdf-worker'].image, fileDigest);
  assert.notEqual(cfg.services.app.image, shellDigest);
});

test('deploy.sh --rollback fails clearly without previous state', () => {
  const work = mkdtempSync(join(tmpdir(), 'arsnova-rollback-'));
  mkdirSync(join(work, 'scripts', 'deploy'), { recursive: true });
  writeFileSync(join(work, '.env.production'), 'NODE_ENV=production\n');
  for (const name of ['lib-image-ref.sh', 'lib-deploy-state.sh', 'lib-arch.sh']) {
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

function listMarkdownFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

test('ops docs use prod-compose / digest-deploy, not bare compose or server build', () => {
  const files = [
    ...listMarkdownFiles(join(repoRoot, 'docs')),
    join(repoRoot, 'CONTRIBUTING.md'),
    join(repoRoot, '.env.production.example'),
  ];

  // Relativ, absolut oder per Variable: -f docker-compose.prod.yml /
  // -f $APP_DIR/docker-compose.prod.yml / -f /home/.../docker-compose.prod.yml
  const directCompose =
    /docker\s+compose\s+-f\s+(?:["']?)(?:\$\{?\w+\}?\/|\.\/|\/)?(?:\S*?\/)?docker-compose\.prod\.yml/;
  const serverBuild = /build\s+--pull\s+app/;

  // Sanity: Pattern muss auch variable/absolute Pfade erkennen.
  assert.match(
    'docker compose -f $APP_DIR/docker-compose.prod.yml --env-file $APP_DIR/.env.production',
    directCompose,
  );
  assert.match(
    'docker compose -f /home/deploy/arsnova.eu/docker-compose.prod.yml --env-file .env.production',
    directCompose,
  );

  const violations = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(repoRoot, file);
    if (directCompose.test(text)) {
      violations.push(`${rel}: direct docker-compose.prod.yml invocation`);
    }
    if (serverBuild.test(text)) {
      violations.push(`${rel}: server build --pull app`);
    }
    // Normalize markdown, then drop explicit "kein … compose build" prose.
    const normalized = text.replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');
    const withoutNegation = normalized.replace(
      /kein(?:e|en)?\s+(?:docker\s+build\s*\/\s*)?compose\s+build/gi,
      '',
    );
    if (/\b(?:docker\s+)?compose\s+build\b/i.test(withoutNegation)) {
      violations.push(`${rel}: compose build command`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `production docs must use ./scripts/prod-compose.sh or digest deploy:\n${violations.join('\n')}`,
  );
});
