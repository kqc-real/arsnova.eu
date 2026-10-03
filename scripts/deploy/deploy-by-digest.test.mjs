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
const deploymentGuide = join(repoRoot, 'docs/deployment-debian-root-server.md');

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

const RUNNER_IMAGE_A = `ghcr.io/kqc-real/arsnova.eu@sha256:${'11'.repeat(32)}`;
const RUNNER_IMAGE_B = `ghcr.io/kqc-real/arsnova.eu@sha256:${'22'.repeat(32)}`;
const RUNNER_IMAGE_C = `ghcr.io/kqc-real/arsnova.eu@sha256:${'33'.repeat(32)}`;
const RUNNER_IMAGE_D = `ghcr.io/kqc-real/arsnova.eu@sha256:${'44'.repeat(32)}`;
const RUNNER_SHA_A = '1'.repeat(40);
const RUNNER_SHA_B = '2'.repeat(40);
const RUNNER_SHA_C = '3'.repeat(40);
const RUNNER_SHA_D = '4'.repeat(40);

function writeRunnerSnapshot(stateDir, name, image, sha) {
  writeFileSync(join(stateDir, name), `IMAGE=${image}\nSHA=${sha}\n`);
}

function runRunnerSelectionDeploy({
  mode,
  current,
  previous,
  known,
  candidate,
  activeImage,
  target,
  initialCheckoutSha = target.sha,
  probeOkImages = [],
  probeErrorImages = [],
  completeDeploy = false,
  failAppStart = false,
  redisMode = 'aof',
  redisPresent = true,
  redisRunning = true,
  redisVolumePresent = false,
  redisProbeValue = '1',
  redisTimeoutSeconds = 3,
}) {
  const work = mkdtempSync(join(tmpdir(), `arsnova-runner-${mode}-`));
  const bin = join(work, 'mock-bin');
  const stateDir = join(work, '.deploy-state');
  const mockLog = join(work, 'mock-commands.log');
  const mockRedisAofState = join(work, '.mock-redis-aof-enabled');
  mkdirSync(bin, { recursive: true });
  mkdirSync(join(work, 'scripts', 'deploy'), { recursive: true });
  mkdirSync(stateDir, { mode: 0o700 });
  copyFileSync(composeFile, join(work, 'docker-compose.prod.yml'));
  writeMinimalProdEnv(work);
  if (current) {
    writeFileSync(join(work, '.env.arsnova-image'), `ARSNOVA_IMAGE=${current.image}\n`);
  }

  for (const name of ['lib-image-ref.sh', 'lib-deploy-state.sh', 'lib-arch.sh']) {
    copyFileSync(join(repoRoot, 'scripts', 'deploy', name), join(work, 'scripts', 'deploy', name));
  }
  copyFileSync(deployScript, join(work, 'scripts', 'deploy.sh'));
  chmodSync(join(work, 'scripts', 'deploy.sh'), 0o755);

  if (current) {
    writeRunnerSnapshot(stateDir, 'current.state', current.image, current.sha);
  }
  if (previous) {
    writeRunnerSnapshot(stateDir, 'previous.state', previous.image, previous.sha);
  }
  if (known) {
    writeRunnerSnapshot(stateDir, 'wordcloud-purge-runner.state', known.image, known.sha);
  }
  if (candidate) {
    writeRunnerSnapshot(
      stateDir,
      'wordcloud-purge-runner-candidate.state',
      candidate.image,
      candidate.sha,
    );
  }

  writeFileSync(
    join(bin, 'git'),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'GIT %s\\n' "$*" >>"$MOCK_LOG"
case "$1" in
  fetch|cat-file) exit 0 ;;
  checkout)
    printf '%s\\n' "\${4:?checkout sha missing}" >"$MOCK_CHECKOUT_MARKER"
    exit 0
    ;;
  rev-parse)
    if [[ -e "$MOCK_CHECKOUT_MARKER" ]]; then
      cat "$MOCK_CHECKOUT_MARKER"
    else
      printf '%s\\n' "$MOCK_INITIAL_CHECKOUT_SHA"
    fi
    ;;
  log) printf 'deadbeef runner selection test\\n' ;;
  *) exit 0 ;;
esac
`,
  );
  writeFileSync(
    join(bin, 'curl'),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'CURL %s\\n' "$*" >>"$MOCK_LOG"
printf '<app-root></app-root>\\n'
`,
  );
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
set -euo pipefail

contains_image() {
  local list="\${1:-}"
  local image="\${2:-}"
  [[ ",\${list}," == *",\${image},"* ]]
}

if [[ "$1" == "info" ]]; then
  printf 'arm64\\n'
  exit 0
fi

if [[ "$1" == "image" && "$2" == "inspect" ]]; then
  if [[ "$*" == *"{{.Architecture}}"* ]]; then
    printf 'arm64\\n'
    exit 0
  fi
  if [[ "$*" == *"{{.Id}}"* ]]; then
    printf 'sha256:runner-selection-test\\n'
    exit 0
  fi
  if [[ "$*" == *"{{json .RepoDigests}}"* ]]; then
    printf '["%s"]\\n' "\${!#}"
    exit 0
  fi
  exit 1
fi

if [[ "$1" == "inspect" ]]; then
  if [[ "\${!#}" == "arsnova-v3-redis" && "$*" == *"{{.State.Running}}"* ]]; then
    if [[ "\${MOCK_REDIS_PRESENT:-0}" != "1" ]]; then
      exit 1
    fi
    printf '%s\\n' "$MOCK_REDIS_RUNNING"
    exit 0
  fi
  if [[ "$*" == *"{{.Config.Image}}"* ]]; then
    printf '%s\\n' "$MOCK_ACTIVE_IMAGE"
    exit 0
  fi
  if [[ "$*" == *"{{.State.Running}}"* ]]; then
    printf 'false\\n'
    exit 0
  fi
  if [[ "$*" == *"{{.Image}}"* ]]; then
    printf 'sha256:runner-selection-test\\n'
    exit 0
  fi
  exit 1
fi

if [[ "$1" == "start" && "$2" == "arsnova-v3-redis" ]]; then
  printf 'REDIS START\\n' >>"$MOCK_LOG"
  exit 0
fi

if [[ "$1" == "volume" && "$2" == "ls" ]]; then
  printf 'REDIS VOLUME_LS\\n' >>"$MOCK_LOG"
  if [[ "\${MOCK_REDIS_VOLUME_PRESENT:-0}" == "1" ]]; then
    printf 'arsnovaeu_redis_data\\n'
  fi
  exit 0
fi

if [[ "$1" == "exec" ]]; then
  shift
  interactive=0
  if [[ "\${1:-}" == "-i" ]]; then
    interactive=1
    shift
  fi
  container="\${1:-}"
  shift || true
  if [[ "$container" != "arsnova-v3-redis" || "\${1:-}" != "redis-cli" ]]; then
    exit 1
  fi
  shift
  if [[ "\${1:-}" == "--raw" ]]; then
    shift
  fi
  if [[ "$interactive" == "1" ]]; then
    cat >/dev/null
    printf 'REDIS AOF_PROBE\\n' >>"$MOCK_LOG"
    printf 'OK\\n1\\n0\\n'
    exit 0
  fi
  command="\${1:-}"
  case "$command" in
    PING)
      printf 'PONG\\n'
      ;;
    INFO)
      printf 'REDIS INFO\\n' >>"$MOCK_LOG"
      if [[ "$MOCK_REDIS_MODE" == "stuck" ]]; then
        aof_enabled=1
        aof_in_progress=1
        aof_scheduled=0
      elif [[ "$MOCK_REDIS_MODE" == "rdb" || "$MOCK_REDIS_MODE" == "config-fail" ]] &&
        [[ ! -e "$MOCK_REDIS_AOF_STATE" ]]; then
        aof_enabled=0
        aof_in_progress=0
        aof_scheduled=0
      else
        aof_enabled=1
        aof_in_progress=0
        aof_scheduled=0
      fi
      printf 'rdb_bgsave_in_progress:0\\r\\n'
      printf 'rdb_last_bgsave_status:ok\\r\\n'
      printf 'aof_enabled:%s\\r\\n' "$aof_enabled"
      printf 'aof_rewrite_in_progress:%s\\r\\n' "$aof_in_progress"
      printf 'aof_rewrite_scheduled:%s\\r\\n' "$aof_scheduled"
      printf 'aof_last_bgrewrite_status:ok\\r\\n'
      printf 'aof_last_write_status:ok\\r\\n'
      ;;
    BGSAVE)
      printf 'REDIS BGSAVE\\n' >>"$MOCK_LOG"
      printf 'Background saving started\\n'
      ;;
    CONFIG)
      printf 'REDIS CONFIG %s %s\\n' "\${3:-}" "\${4:-}" >>"$MOCK_LOG"
      if [[ "$MOCK_REDIS_MODE" == "config-fail" && "\${3:-}" == "appendonly" ]]; then
        exit 1
      fi
      if [[ "\${3:-}" == "appendonly" && "\${4:-}" == "yes" ]]; then
        : >"$MOCK_REDIS_AOF_STATE"
      fi
      printf 'OK\\n'
      ;;
    DBSIZE)
      printf '42\\n'
      ;;
    GET)
      printf '%s\\n' "$MOCK_REDIS_PROBE_VALUE"
      ;;
    *)
      exit 1
      ;;
  esac
  exit 0
fi

if [[ "$1" == "compose" ]]; then
  args="$*"
  if [[ "$args" == *"config --format json"* ]]; then
    printf '{"services":{"app":{"image":"%s"},"pdf-worker":{"image":"%s"}}}\\n' \
      "$ARSNOVA_IMAGE" "$ARSNOVA_IMAGE"
    exit 0
  fi
  if [[ "$args" == *"config --quiet"* || "$args" == *" pull app pdf-worker"* ]]; then
    exit 0
  fi
  if [[ "$args" == *"prisma migrate deploy"* ]]; then
    printf 'MIGRATE %s\\n' "$ARSNOVA_IMAGE" >>"$MOCK_LOG"
    exit 0
  fi
  if [[ "$args" == *"app node /app/apps/backend/dist/runWordCloudCacheMigration.js"* ]]; then
    printf 'RUN %s\\n' "$ARSNOVA_IMAGE" >>"$MOCK_LOG"
    exit 0
  fi
  if [[ "$args" == *"app sh -eu -c"* && "$args" == *"runWordCloudCacheMigration.js"* ]]; then
    printf 'PROBE %s\\n' "$ARSNOVA_IMAGE" >>"$MOCK_LOG"
    if contains_image "\${MOCK_PROBE_ERROR_IMAGES:-}" "$ARSNOVA_IMAGE"; then
      exit 71
    fi
    if contains_image "\${MOCK_PROBE_OK_IMAGES:-}" "$ARSNOVA_IMAGE"; then
      exit 0
    fi
    exit 42
  fi
  if [[ "$args" == *" stop app"* ]]; then
    printf 'STOP %s\\n' "$ARSNOVA_IMAGE" >>"$MOCK_LOG"
    exit 0
  fi
  if [[ "$args" == *"runRetentionCleanup.js"* ]]; then
    printf 'RETENTION %s\\n' "$ARSNOVA_IMAGE" >>"$MOCK_LOG"
    if [[ "\${MOCK_COMPLETE_DEPLOY:-0}" == "1" ]]; then
      exit 0
    fi
    exit 73
  fi
  if [[ "$args" == *" up -d --wait postgres redis"* ]]; then
    printf 'INFRA %s\\n' "$ARSNOVA_IMAGE" >>"$MOCK_LOG"
    exit 0
  fi
  if [[ "$args" == *" up -d pdf-worker app"* ]]; then
    printf 'START %s\\n' "$ARSNOVA_IMAGE" >>"$MOCK_LOG"
    if [[ "\${MOCK_FAIL_APP_START:-0}" == "1" ]]; then
      exit 74
    fi
    exit 0
  fi
  if [[ "$args" == *" ps app --format json"* ]]; then
    printf '{"Health":"healthy"}\\n'
    exit 0
  fi
  exit 0
fi

exit 1
`,
  );
  for (const name of ['git', 'curl', 'docker']) {
    chmodSync(join(bin, name), 0o755);
  }

  const baseEnv = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    DEPLOY_DIR: work,
    DEPLOY_BRANCH: 'main',
    DEPLOY_IMAGE: mode === 'normal' ? target.image : '',
    DEPLOY_SHA: mode === 'normal' ? target.sha : '',
    MOCK_ACTIVE_IMAGE: activeImage ?? '',
    MOCK_INITIAL_CHECKOUT_SHA: initialCheckoutSha,
    MOCK_CHECKOUT_MARKER: join(work, '.mock-checkout-complete'),
    MOCK_LOG: mockLog,
    MOCK_PROBE_OK_IMAGES: probeOkImages.join(','),
    MOCK_PROBE_ERROR_IMAGES: probeErrorImages.join(','),
    MOCK_COMPLETE_DEPLOY: completeDeploy ? '1' : '0',
    MOCK_FAIL_APP_START: failAppStart ? '1' : '0',
    MOCK_REDIS_MODE: redisMode,
    MOCK_REDIS_PRESENT: redisPresent ? '1' : '0',
    MOCK_REDIS_RUNNING: redisRunning ? 'true' : 'false',
    MOCK_REDIS_VOLUME_PRESENT: redisVolumePresent ? '1' : '0',
    MOCK_REDIS_PROBE_VALUE: redisProbeValue,
    MOCK_REDIS_AOF_STATE: mockRedisAofState,
    REDIS_AOF_MIGRATION_TIMEOUT_SECONDS: String(redisTimeoutSeconds),
  };
  const runDeploy = (nextMode = mode) => {
    const args = [join(work, 'scripts', 'deploy.sh')];
    if (nextMode !== 'normal') args.push(`--${nextMode}`);
    return spawnSync('bash', args, {
      encoding: 'utf8',
      cwd: work,
      env: baseEnv,
    });
  };
  const result = runDeploy();

  return {
    result,
    log: existsSync(mockLog) ? readFileSync(mockLog, 'utf8') : '',
    mockLog,
    runDeploy,
    stateDir,
  };
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

test('writer drain and all-cache purge gate retention and app startup', () => {
  const text = readFileSync(deployScript, 'utf8');
  const migrateIdx = text.indexOf('prisma migrate deploy');
  const stopIdx = text.indexOf('compose stop app');
  const cachePurgeIdx = text.indexOf(
    'app node /app/apps/backend/dist/runWordCloudCacheMigration.js',
  );
  const retentionIdx = text.indexOf('node /app/apps/backend/dist/runRetentionCleanup.js');
  const appStartIdx = text.indexOf('compose up -d pdf-worker app');

  assert.ok(stopIdx > migrateIdx, 'old writer must drain after compatible migrations');
  assert.ok(cachePurgeIdx > stopIdx, 'all-cache purge must run after writer drain');
  assert.ok(retentionIdx > cachePurgeIdx, 'retention must run after the all-cache purge');
  assert.ok(retentionIdx > migrateIdx, 'retention gate must run after migrations');
  assert.ok(appStartIdx > retentionIdx, 'traffic-capable app must start after retention gate');
  assert.match(text, /ACTIVE_APP_IMAGE=.*docker inspect/);
  assert.match(text, /PURGE_RUNNER_STATE_FILE/);
  assert.match(text, /WORD_CLOUD_PURGE_REQUIRE_DURABILITY=1/);
  assert.doesNotMatch(
    text,
    /npm run cleanup:retention/,
    'hardened production image has no npm; deploy must invoke node directly',
  );
});

function runnerEvents(log) {
  return log.split('\n').filter((line) => /^(MIGRATE|PROBE|STOP|RUN|RETENTION|START) /.test(line));
}

test('already-enabled Redis AOF is verified before infrastructure recreation', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'normal',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    activeImage: RUNNER_IMAGE_A,
    target: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    probeOkImages: [RUNNER_IMAGE_C],
  });

  assert.equal(scenario.result.status, 73, scenario.result.stdout + scenario.result.stderr);
  const probeIdx = scenario.log.indexOf('REDIS AOF_PROBE');
  const infraIdx = scenario.log.indexOf(`INFRA ${RUNNER_IMAGE_C}`);
  assert.ok(probeIdx >= 0, 'durable restart probe missing');
  assert.ok(infraIdx > probeIdx, 'Redis must be AOF-verified before compose can recreate it');
  assert.doesNotMatch(scenario.log, /^REDIS BGSAVE$/m);
  assert.doesNotMatch(scenario.log, /^REDIS CONFIG appendonly yes$/m);
});

test('stopped existing Redis is started and verified before infrastructure recreation', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'normal',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    activeImage: RUNNER_IMAGE_A,
    target: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    probeOkImages: [RUNNER_IMAGE_C],
    redisRunning: false,
  });

  assert.equal(scenario.result.status, 73, scenario.result.stdout + scenario.result.stderr);
  const startIdx = scenario.log.indexOf('REDIS START');
  const probeIdx = scenario.log.indexOf('REDIS AOF_PROBE');
  const infraIdx = scenario.log.indexOf(`INFRA ${RUNNER_IMAGE_C}`);
  assert.ok(startIdx >= 0, 'stopped Redis must be started with its existing configuration');
  assert.ok(probeIdx > startIdx, 'AOF verification must follow the existing container start');
  assert.ok(infraIdx > probeIdx, 'Compose recreation must follow the verified restart probe');
});

test('RDB-only Redis is snapshotted and converted live before infrastructure recreation', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'normal',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    activeImage: RUNNER_IMAGE_A,
    target: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    probeOkImages: [RUNNER_IMAGE_C],
    redisMode: 'rdb',
  });

  assert.equal(scenario.result.status, 73, scenario.result.stdout + scenario.result.stderr);
  const backupIdx = scenario.log.indexOf('REDIS BGSAVE');
  const fsyncIdx = scenario.log.indexOf('REDIS CONFIG appendfsync everysec');
  const enableIdx = scenario.log.indexOf('REDIS CONFIG appendonly yes');
  const probeIdx = scenario.log.indexOf('REDIS AOF_PROBE');
  const infraIdx = scenario.log.indexOf(`INFRA ${RUNNER_IMAGE_C}`);
  assert.ok(backupIdx >= 0, 'fresh RDB backup missing');
  assert.ok(fsyncIdx > backupIdx, 'appendfsync must follow the completed RDB backup');
  assert.ok(enableIdx > fsyncIdx, 'live appendonly enable must follow appendfsync');
  assert.ok(probeIdx > enableIdx, 'AOF durability probe must follow the completed rewrite');
  assert.ok(infraIdx > probeIdx, 'container recreation must follow live AOF conversion');
  assert.match(scenario.result.stdout, /Redis-RDB→AOF-Live-Konvertierung erfolgreich/);
  assert.match(scenario.result.stdout, /DBSIZE vorher: 42, nachher: 42/);
});

test('Redis AOF conversion failure aborts before infrastructure recreation', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'normal',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    activeImage: RUNNER_IMAGE_A,
    target: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    probeOkImages: [RUNNER_IMAGE_C],
    redisMode: 'config-fail',
  });

  assert.equal(scenario.result.status, 1, scenario.result.stdout + scenario.result.stderr);
  assert.match(scenario.result.stderr, /Redis-AOF konnte nicht live aktiviert werden/);
  assert.match(scenario.log, /^REDIS BGSAVE$/m);
  assert.doesNotMatch(scenario.log, /^(?:INFRA|MIGRATE|STOP|RUN|RETENTION|START) /m);
});

test('unfinished Redis AOF rewrite times out before infrastructure recreation', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'normal',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    activeImage: RUNNER_IMAGE_A,
    target: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    probeOkImages: [RUNNER_IMAGE_C],
    redisMode: 'stuck',
    redisTimeoutSeconds: 1,
  });

  assert.equal(scenario.result.status, 1, scenario.result.stdout + scenario.result.stderr);
  assert.match(scenario.result.stderr, /Timeout beim Warten auf die Redis-AOF-Aktivierung/);
  assert.doesNotMatch(scenario.log, /^(?:INFRA|MIGRATE|STOP|RUN|RETENTION|START) /m);
});

test('missing Redis AOF restart probe aborts after infrastructure and before migration', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'normal',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    activeImage: RUNNER_IMAGE_A,
    target: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    probeOkImages: [RUNNER_IMAGE_C],
    redisProbeValue: '',
  });

  assert.equal(scenario.result.status, 1, scenario.result.stdout + scenario.result.stderr);
  assert.match(scenario.result.stderr, /Redis-AOF-Neustartprobe fehlt/);
  assert.match(scenario.log, /^INFRA /m);
  assert.doesNotMatch(scenario.log, /^(?:MIGRATE|STOP|RUN|RETENTION|START) /m);
});

test('existing deploy without inspectable Redis fails closed before recreation', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'normal',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    activeImage: RUNNER_IMAGE_A,
    target: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    probeOkImages: [RUNNER_IMAGE_C],
    redisPresent: false,
  });

  assert.equal(scenario.result.status, 1, scenario.result.stdout + scenario.result.stderr);
  assert.match(scenario.result.stderr, /Bestehendes Deployment ohne prüfbaren Redis-Container/);
  assert.doesNotMatch(scenario.log, /^(?:INFRA|MIGRATE|STOP|RUN|RETENTION|START) /m);
});

test('retained Compose Redis volume without a container fails closed instead of fresh-starting AOF', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'normal',
    current: undefined,
    activeImage: undefined,
    target: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    probeOkImages: [RUNNER_IMAGE_C],
    redisPresent: false,
    redisVolumePresent: true,
  });

  assert.equal(scenario.result.status, 1, scenario.result.stdout + scenario.result.stderr);
  assert.match(scenario.result.stderr, /Compose-Redis-Datenvolume ist vorhanden/);
  assert.match(scenario.log, /^REDIS VOLUME_LS$/m);
  assert.doesNotMatch(scenario.log, /^(?:INFRA|MIGRATE|STOP|RUN|RETENTION|START) /m);
});

test('fresh install without Redis state, containers, or volumes may initialize AOF', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'normal',
    current: undefined,
    activeImage: undefined,
    target: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    probeOkImages: [RUNNER_IMAGE_C],
    redisPresent: false,
  });

  assert.equal(scenario.result.status, 73, scenario.result.stdout + scenario.result.stderr);
  assert.match(scenario.result.stdout, /AOF startet als Fresh-Install/);
  assert.match(scenario.log, /^REDIS VOLUME_LS$/m);
  assert.match(scenario.log, new RegExp(`^INFRA ${RUNNER_IMAGE_C}$`, 'm'));
});

test('normal first rollout uses the generation-aware target runner', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'normal',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    activeImage: RUNNER_IMAGE_A,
    target: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    probeOkImages: [RUNNER_IMAGE_C],
  });

  assert.equal(scenario.result.status, 73, scenario.result.stdout + scenario.result.stderr);
  assert.deepEqual(runnerEvents(scenario.log), [
    `PROBE ${RUNNER_IMAGE_C}`,
    `MIGRATE ${RUNNER_IMAGE_C}`,
    `PROBE ${RUNNER_IMAGE_C}`,
    `STOP ${RUNNER_IMAGE_C}`,
    `RUN ${RUNNER_IMAGE_C}`,
    `RETENTION ${RUNNER_IMAGE_C}`,
  ]);
  assert.deepEqual(readSnapshot(join(scenario.stateDir, 'wordcloud-purge-runner.state')), {
    image: RUNNER_IMAGE_C,
    sha: RUNNER_SHA_C,
  });
  assert.equal(
    existsSync(join(scenario.stateDir, 'wordcloud-purge-runner-candidate.state')),
    false,
    'target must not become a candidate before retention reaches app start',
  );
  assert.match(scenario.log, new RegExp(`GIT checkout --detach --force ${RUNNER_SHA_C}`));
});

test('normal deploy repeats the purge after retention and clears candidate only after commit', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'normal',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    activeImage: RUNNER_IMAGE_A,
    target: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    probeOkImages: [RUNNER_IMAGE_C],
    completeDeploy: true,
  });

  assert.equal(scenario.result.status, 0, scenario.result.stdout + scenario.result.stderr);
  assert.deepEqual(runnerEvents(scenario.log), [
    `PROBE ${RUNNER_IMAGE_C}`,
    `MIGRATE ${RUNNER_IMAGE_C}`,
    `PROBE ${RUNNER_IMAGE_C}`,
    `STOP ${RUNNER_IMAGE_C}`,
    `RUN ${RUNNER_IMAGE_C}`,
    `RETENTION ${RUNNER_IMAGE_C}`,
    `RUN ${RUNNER_IMAGE_C}`,
    `START ${RUNNER_IMAGE_C}`,
  ]);
  assert.deepEqual(readSnapshot(join(scenario.stateDir, 'current.state')), {
    image: RUNNER_IMAGE_C,
    sha: RUNNER_SHA_C,
  });
  assert.deepEqual(readSnapshot(join(scenario.stateDir, 'previous.state')), {
    image: RUNNER_IMAGE_A,
    sha: RUNNER_SHA_A,
  });
  assert.deepEqual(readSnapshot(join(scenario.stateDir, 'wordcloud-purge-runner.state')), {
    image: RUNNER_IMAGE_C,
    sha: RUNNER_SHA_C,
  });
  assert.equal(
    existsSync(join(scenario.stateDir, 'wordcloud-purge-runner-candidate.state')),
    false,
  );
});

test('forward fix preserves and sweeps the failed candidate before superseding it', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'normal',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    candidate: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    activeImage: RUNNER_IMAGE_C,
    target: { image: RUNNER_IMAGE_D, sha: RUNNER_SHA_D },
    probeOkImages: [RUNNER_IMAGE_C, RUNNER_IMAGE_D],
    completeDeploy: true,
    failAppStart: true,
  });

  assert.equal(scenario.result.status, 74, scenario.result.stdout + scenario.result.stderr);
  assert.deepEqual(runnerEvents(scenario.log), [
    `PROBE ${RUNNER_IMAGE_D}`,
    `MIGRATE ${RUNNER_IMAGE_D}`,
    `PROBE ${RUNNER_IMAGE_C}`,
    `STOP ${RUNNER_IMAGE_D}`,
    `RUN ${RUNNER_IMAGE_C}`,
    `RETENTION ${RUNNER_IMAGE_D}`,
    `RUN ${RUNNER_IMAGE_C}`,
    `START ${RUNNER_IMAGE_D}`,
  ]);
  assert.deepEqual(
    readSnapshot(join(scenario.stateDir, 'wordcloud-purge-runner-candidate.state')),
    { image: RUNNER_IMAGE_D, sha: RUNNER_SHA_D },
    'new candidate may replace the old one only after both old-generation purges',
  );
  assert.deepEqual(readSnapshot(join(scenario.stateDir, 'current.state')), {
    image: RUNNER_IMAGE_A,
    sha: RUNNER_SHA_A,
  });
});

test('normal deploy rejects an old checkout before fetch, compose, or state mutation', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'normal',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    activeImage: RUNNER_IMAGE_A,
    target: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    initialCheckoutSha: RUNNER_SHA_A,
    probeOkImages: [RUNNER_IMAGE_C],
  });

  assert.equal(scenario.result.status, 1, scenario.result.stdout + scenario.result.stderr);
  assert.match(scenario.result.stderr, /Normal-Deploy muss bereits am DEPLOY_SHA gestartet werden/);
  assert.deepEqual(runnerEvents(scenario.log), []);
  assert.doesNotMatch(scenario.log, /^GIT fetch /m);
  assert.equal(
    existsSync(join(scenario.stateDir, 'wordcloud-purge-runner-candidate.state')),
    false,
  );
});

test('rollback runs the current active runner before starting the previous target', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'rollback',
    current: { image: RUNNER_IMAGE_B, sha: RUNNER_SHA_B },
    previous: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    activeImage: RUNNER_IMAGE_B,
    target: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    probeOkImages: [RUNNER_IMAGE_A, RUNNER_IMAGE_B],
  });

  assert.equal(scenario.result.status, 73, scenario.result.stdout + scenario.result.stderr);
  assert.deepEqual(runnerEvents(scenario.log), [
    `PROBE ${RUNNER_IMAGE_A}`,
    `MIGRATE ${RUNNER_IMAGE_A}`,
    `PROBE ${RUNNER_IMAGE_B}`,
    `STOP ${RUNNER_IMAGE_A}`,
    `RUN ${RUNNER_IMAGE_B}`,
    `RETENTION ${RUNNER_IMAGE_A}`,
  ]);
  assert.deepEqual(readSnapshot(join(scenario.stateDir, 'wordcloud-purge-runner.state')), {
    image: RUNNER_IMAGE_B,
    sha: RUNNER_SHA_B,
  });
  assert.match(scenario.log, new RegExp(`GIT checkout --detach --force ${RUNNER_SHA_A}`));
});

test('recover requires the pending candidate even while last-known-good is active', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'recover',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    known: { image: RUNNER_IMAGE_B, sha: RUNNER_SHA_B },
    candidate: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    activeImage: RUNNER_IMAGE_B,
    target: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    probeOkImages: [RUNNER_IMAGE_A, RUNNER_IMAGE_B, RUNNER_IMAGE_C],
  });

  assert.equal(scenario.result.status, 73, scenario.result.stdout + scenario.result.stderr);
  assert.deepEqual(runnerEvents(scenario.log), [
    `PROBE ${RUNNER_IMAGE_A}`,
    `MIGRATE ${RUNNER_IMAGE_A}`,
    `PROBE ${RUNNER_IMAGE_C}`,
    `STOP ${RUNNER_IMAGE_A}`,
    `RUN ${RUNNER_IMAGE_C}`,
    `RETENTION ${RUNNER_IMAGE_A}`,
  ]);
  assert.deepEqual(readSnapshot(join(scenario.stateDir, 'wordcloud-purge-runner.state')), {
    image: RUNNER_IMAGE_C,
    sha: RUNNER_SHA_C,
  });
  assert.match(scenario.log, new RegExp(`GIT checkout --detach --force ${RUNNER_SHA_A}`));
});

test('recover fails closed when the pending candidate cannot run its generation-aware purge', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'recover',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    known: { image: RUNNER_IMAGE_B, sha: RUNNER_SHA_B },
    candidate: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    activeImage: RUNNER_IMAGE_B,
    target: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    probeOkImages: [RUNNER_IMAGE_A, RUNNER_IMAGE_B],
    probeErrorImages: [RUNNER_IMAGE_C],
  });

  assert.equal(scenario.result.status, 1, scenario.result.stdout + scenario.result.stderr);
  assert.deepEqual(runnerEvents(scenario.log), [
    `PROBE ${RUNNER_IMAGE_A}`,
    `MIGRATE ${RUNNER_IMAGE_A}`,
    `PROBE ${RUNNER_IMAGE_C}`,
  ]);
  assert.doesNotMatch(scenario.log, /^(?:STOP|RUN|RETENTION) /m);
  assert.match(scenario.result.stderr, /Potenzieller Writer/);
});

test('recover fails closed before writer drain when its started candidate lacks the gate', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'recover',
    current: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    known: { image: RUNNER_IMAGE_B, sha: RUNNER_SHA_B },
    candidate: { image: RUNNER_IMAGE_C, sha: RUNNER_SHA_C },
    activeImage: RUNNER_IMAGE_C,
    target: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    probeOkImages: [RUNNER_IMAGE_A],
  });

  assert.equal(scenario.result.status, 1, scenario.result.stdout + scenario.result.stderr);
  assert.deepEqual(runnerEvents(scenario.log), [
    `PROBE ${RUNNER_IMAGE_A}`,
    `MIGRATE ${RUNNER_IMAGE_A}`,
    `PROBE ${RUNNER_IMAGE_C}`,
  ]);
  assert.doesNotMatch(scenario.log, /^(?:STOP|RUN|RETENTION) /m);
  assert.match(scenario.result.stderr, /Potenzieller Writer/);
  assert.deepEqual(readSnapshot(join(scenario.stateDir, 'wordcloud-purge-runner.state')), {
    image: RUNNER_IMAGE_B,
    sha: RUNNER_SHA_B,
  });
});

test('rollback refuses a legacy target that would recreate unscoped caches', () => {
  const scenario = runRunnerSelectionDeploy({
    mode: 'rollback',
    current: { image: RUNNER_IMAGE_B, sha: RUNNER_SHA_B },
    previous: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    known: { image: RUNNER_IMAGE_B, sha: RUNNER_SHA_B },
    activeImage: RUNNER_IMAGE_B,
    target: { image: RUNNER_IMAGE_A, sha: RUNNER_SHA_A },
    probeOkImages: [RUNNER_IMAGE_B],
  });

  assert.equal(scenario.result.status, 1, scenario.result.stdout + scenario.result.stderr);
  assert.deepEqual(runnerEvents(scenario.log), [`PROBE ${RUNNER_IMAGE_A}`]);
  assert.doesNotMatch(scenario.log, /^(?:STOP|RUN|RETENTION) /m);
  assert.doesNotMatch(scenario.log, /^GIT checkout /m);
  assert.match(scenario.result.stderr, /Cache-unsicherer Legacy-Writer/);

  const beforeRecoverLog = scenario.log;
  const recover = scenario.runDeploy('recover');
  const recoverLog = readFileSync(scenario.mockLog, 'utf8').slice(beforeRecoverLog.length);
  assert.equal(recover.status, 73, recover.stdout + recover.stderr);
  assert.deepEqual(runnerEvents(recoverLog), [
    `PROBE ${RUNNER_IMAGE_B}`,
    `MIGRATE ${RUNNER_IMAGE_B}`,
    `PROBE ${RUNNER_IMAGE_B}`,
    `STOP ${RUNNER_IMAGE_B}`,
    `RUN ${RUNNER_IMAGE_B}`,
    `RETENTION ${RUNNER_IMAGE_B}`,
  ]);
  assert.match(recoverLog, new RegExp(`GIT checkout --detach --force ${RUNNER_SHA_B}`));
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
  assert.match(log, /docker compose .*pull/);
  assert.doesNotMatch(log, /docker compose .*config/);
  assert.doesNotMatch(log, /docker compose .* up\b/);
  assert.doesNotMatch(log, /docker compose .* run\b/);
  assert.doesNotMatch(log, /docker compose .* stop\b/);
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

test('first manual rollout bootstraps inline without assuming the target helper exists', () => {
  const guide = readFileSync(deploymentGuide, 'utf8');
  const firstRollout = guide.split('## 7. Deployment-Ablauf')[1]?.split('CI setzt')[0];
  assert.ok(firstRollout, 'first-rollout instructions missing');
  const bootstrapBlock = firstRollout.split('```bash')[1]?.split('```')[0];
  assert.ok(bootstrapBlock, 'first-rollout bootstrap command block missing');

  const fetchIdx = bootstrapBlock.indexOf('git fetch --prune origin "$DEPLOY_BRANCH"');
  const verifyIdx = bootstrapBlock.indexOf('git cat-file -e "${DEPLOY_SHA}^{commit}"');
  const checkoutIdx = bootstrapBlock.indexOf('git checkout --detach --force "$DEPLOY_SHA"');
  const headIdx = bootstrapBlock.indexOf('test "$(git rev-parse HEAD)" = "$DEPLOY_SHA"');
  const deployIdx = bootstrapBlock.indexOf('./scripts/deploy.sh');
  assert.ok(fetchIdx >= 0, 'inline fetch missing');
  assert.ok(fetchIdx < verifyIdx, 'commit must be present before checkout');
  assert.ok(verifyIdx < checkoutIdx, 'commit verification must precede checkout');
  assert.ok(checkoutIdx < headIdx, 'checked-out HEAD must be verified');
  assert.ok(headIdx < deployIdx, 'deploy.sh must start only after verified checkout');
  assert.match(bootstrapBlock.slice(fetchIdx, deployIdx), /&&[\s\S]*&&[\s\S]*&&[\s\S]*&&/);
  assert.doesNotMatch(bootstrapBlock, /checkout-deploy-sha\.sh/);
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
