import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { shouldValidateOpenWeightLlmStart } from '../open-weight-llm/prod-compose-policy.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function extractServiceBlock(composeText, serviceName) {
  const marker = `\n  ${serviceName}:\n`;
  const start = composeText.indexOf(marker);
  assert.notEqual(start, -1, `Service ${serviceName} fehlt`);
  const afterHeading = start + marker.length;
  const nextMatch = composeText
    .slice(afterHeading)
    .match(/\n {2}[A-Za-z0-9._-]+:\n|\n[A-Za-z0-9._-]+:\n/);
  const end = nextMatch ? afterHeading + (nextMatch.index ?? 0) : composeText.length;
  return composeText.slice(start + 1, end);
}

function assertLabHardening(block, label) {
  assert.match(block, /profiles:\s*\['llm'\]/, `${label}: Profil llm`);
  assert.match(block, /network_mode:\s*none\b/, `${label}: kein Netz`);
  assert.doesNotMatch(block, /^\s+ports:/m, `${label}: kein TCP-Port`);
  assert.match(block, /read_only:\s*true\b/, `${label}: read-only Rootfs`);
  assert.match(block, /cap_drop:\s*\n\s+- ALL/, `${label}: Capabilities entfernt`);
  assert.match(block, /no-new-privileges:true/, `${label}: no-new-privileges`);
  assert.match(block, /mem_limit:\s*5g/, `${label}: RAM-cgroup`);
  assert.match(block, /cpus:\s*'4\.0'/, `${label}: CPU-cgroup`);
  assert.match(block, /open_weight_llm_socket/, `${label}: Socket-Volume`);
  assert.match(block, /\/models:ro/, `${label}: GGUF nur read-only gemountet`);
}

test('lokales und produktives Laborprofil bleiben privat und explizit optional', () => {
  const local = read('docker-compose.yml');
  assertLabHardening(extractServiceBlock(local, 'open-weight-llm'), 'local');
  assert.match(extractServiceBlock(local, 'app'), /OPEN_WEIGHT_LLM_ENABLED:/);
  assert.match(extractServiceBlock(local, 'app'), /open_weight_llm_socket/);
  assert.match(extractServiceBlock(local, 'app'), /group_add:\s*\n\s+- '65532'/);

  const production = read('docker-compose.prod.yml');
  const productionRuntime = extractServiceBlock(production, 'open-weight-llm');
  assertLabHardening(productionRuntime, 'prod-lab');
  assert.doesNotMatch(productionRuntime, /env_file:/);
  assert.match(productionRuntime, /OPEN_WEIGHT_LLM_TOKEN:/);
  assert.doesNotMatch(productionRuntime, /DATABASE_URL|JWT_SECRET|ADMIN_/);
  const app = extractServiceBlock(production, 'app');
  assert.match(app, /open_weight_llm_socket/);
  assert.match(app, /group_add:\s*\n\s+- '65532'/);
  assert.doesNotMatch(app, /OPEN_WEIGHT_LLM_ENABLED:\s*['"]?true/);
  assert.doesNotMatch(
    app,
    /OPEN_WEIGHT_LLM_SOCKET_PATH:\s*\/run\/open-weight-llm\/llm\.sock/,
    'Prod-App darf den kanonischen HTTP-Transport nicht durch einen hardcodierten Socket übersteuern',
  );
});

test('Host-npm besitzt einen expliziten Loopback-HTTP-Laborpfad', () => {
  const local = read('docker-compose.yml');
  const runtime = extractServiceBlock(local, 'open-weight-llm-http');
  assert.match(runtime, /profiles:\s*\['llm-http'\]/);
  assert.match(runtime, /network_mode:\s*host\b/);
  assert.doesNotMatch(runtime, /^\s+ports:/m);
  assert.match(runtime, /OPEN_WEIGHT_LLM_TRANSPORT:\s*http/);
  assert.match(runtime, /OPEN_WEIGHT_LLM_BIND_ADDRESS:\s*127\.0\.0\.1/);
  assert.match(runtime, /\/models:ro/);
});

test('Same-Host-Labor startet Runtime und App mit identischem aktivem Vertrag', () => {
  const scripts = JSON.parse(read('package.json')).scripts;
  const command = scripts['docker:up:llm'];
  assert.match(command, /^OPEN_WEIGHT_LLM_ENABLED=true\s+/);
  assert.match(command, /docker compose --profile llm up -d --build/);
  assert.match(command, /\bopen-weight-llm app$/);

  for (const composePath of ['docker-compose.yml', 'docker-compose.prod.yml']) {
    const app = extractServiceBlock(read(composePath), 'app');
    assert.match(
      app,
      /open-weight-llm:\s*\n\s+condition: service_healthy\s*\n\s+required: false/,
      `${composePath}: Runtime initialisiert das Socket-Volume vor der App`,
    );
  }
});

test('zweiter Produktionshost verlangt Digest-Image und bindet ohne Port-Mapping', () => {
  const compose = read('docker-compose.llm.yml');
  const runtime = extractServiceBlock(compose, 'open-weight-llm');
  assert.match(runtime, /profiles:\s*\['llm'\]/);
  assert.match(
    runtime,
    /image:\s*\$\{OPEN_WEIGHT_LLM_IMAGE:\?OPEN_WEIGHT_LLM_IMAGE must be a digest image ref\}/,
  );
  assert.match(runtime, /network_mode:\s*host\b/);
  assert.doesNotMatch(runtime, /^\s+ports:/m);
  assert.match(runtime, /mem_limit:\s*8g/, 'second-host: RAM-cgroup');
  assert.match(runtime, /memswap_limit:\s*10g/, 'second-host: RAM-plus-Swap-cgroup');
  assert.match(runtime, /cpus:\s*'8\.0'/, 'second-host: CPU-cgroup');
  assert.match(runtime, /OPEN_WEIGHT_LLM_THREADS:\s*'8'/, 'second-host: Thread-Limit');
  assert.match(runtime, /OPEN_WEIGHT_LLM_TRANSPORT:\s*http/);
  assert.match(runtime, /\/models:ro/);

  const wrapper = read('scripts/open-weight-llm/prod-compose.mjs');
  assert.match(wrapper, /@sha256:\[a-f0-9\]\{64\}/);
  assert.match(wrapper, /private IP literal/);
  assert.match(wrapper, /verify-model\.mjs/);
  assert.doesNotMatch(wrapper, /addSubnet\('127\.0\.0\.0'/);
});

test('Produktionswrapper validiert Startkonfiguration, blockiert aber keinen Rollback', () => {
  for (const command of ['up', 'create', 'start', 'restart', 'run']) {
    assert.equal(shouldValidateOpenWeightLlmStart([command, 'open-weight-llm']), true, command);
  }
  for (const command of ['stop', 'down', 'ps', 'logs', 'config', 'exec']) {
    assert.equal(shouldValidateOpenWeightLlmStart([command, 'open-weight-llm']), false, command);
  }
  const wrapper = read('scripts/open-weight-llm/prod-compose.mjs');
  assert.match(
    wrapper,
    /if \(shouldValidateOpenWeightLlmStart\(composeArguments\)\) \{[\s\S]*OPEN_WEIGHT_LLM_TOKEN must contain[\s\S]*verify-model\.mjs[\s\S]*\n {2}\}/,
  );
});

test('der normale Deploypfad startet die LLM-Runtime nicht', () => {
  const deploy = read('scripts/deploy.sh');
  assert.doesNotMatch(deploy, /open-weight-llm|docker-compose\.llm|--profile\s+llm/);
});

test('modellfreie Runtime-Verträge laufen in Standardtests und CI-Coverage', () => {
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.match(scripts.test, /test:open-weight-llm:all/);
  assert.match(scripts['test:coverage'], /test:open-weight-llm:all/);
  assert.match(
    scripts['test:open-weight-llm:all'],
    /open-weight-llm-runtime\.test\.mjs scripts\/ci\/open-weight-llm-compose-smoke\.test\.mjs/,
  );
});
