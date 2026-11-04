import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeRoot = join(repoRoot, 'docker/open-weight-llm');

test('Runtime-Image und GGUF sind unveränderlich gepinnt, das Modell bleibt außerhalb des Layers', () => {
  const dockerfile = readFileSync(join(runtimeRoot, 'Dockerfile'), 'utf8');
  assert.match(
    dockerfile,
    /FROM ghcr\.io\/ggml-org\/llama\.cpp:server-b10524@sha256:57e505f69c3a55fa5dd9c15fced47cff7a899f5b5b504ea93d75b2f401b87830/,
  );
  assert.doesNotMatch(dockerfile, /COPY[^\n]*\.gguf/i);

  const manifest = JSON.parse(readFileSync(join(runtimeRoot, 'model-manifest.json'), 'utf8'));
  assert.equal(manifest.sourceRepository, 'unsloth/gemma-3-4b-it-qat-GGUF');
  assert.equal(manifest.sourceRevision, '0f80a8ebec6d07600bc3790a042a075527692b49');
  assert.equal(manifest.filename, 'gemma-3-4b-it-qat-Q4_0.gguf');
  assert.equal(manifest.quantization, 'Q4_0');
  assert.equal(manifest.sizeBytes, 2_370_065_536);
  assert.equal(manifest.sha256, '6a9baaf400db52a6855d2a0a20a5b4747ea9febbd304b7e2ecd8ab3a20711bb2');
  assert.match(
    manifest.downloadUrl,
    /\/resolve\/0f80a8ebec6d07600bc3790a042a075527692b49\/gemma-3-4b-it-qat-Q4_0\.gguf$/,
  );
  assert.doesNotMatch(manifest.downloadUrl, /\/resolve\/(?:main|latest)\//);
  assert.doesNotMatch(manifest.downloadUrl, /mmproj/i);
});

test('Entry-Point erzwingt Auth, CPU-only, einen Slot und die vereinbarten Hartflags', () => {
  const entrypoint = readFileSync(join(runtimeRoot, 'entrypoint.sh'), 'utf8');
  for (const flag of [
    '--parallel 1',
    '--ctx-size 8192',
    '--batch-size 2048',
    '--ubatch-size 512',
    '--n-predict 768',
    '--threads-batch',
    '--flash-attn on',
    '--cache-reuse 256',
    '--no-webui',
    '--slots',
    '--api-key',
    '--reasoning off',
    '--n-gpu-layers 0',
    '--slot-prompt-similarity 0',
    '--jinja',
    '--offline',
  ]) {
    assert.ok(entrypoint.includes(flag), `missing hard flag: ${flag}`);
  }
  assert.match(entrypoint, /--alias gemma-3-4b-it-qat-q4_0/);
  assert.match(entrypoint, /gemma-3-4b-it-qat-Q4_0\.gguf/);
  assert.doesNotMatch(entrypoint, /--mmproj\b/);
  assert.match(
    entrypoint,
    /model_sha256=6a9baaf400db52a6855d2a0a20a5b4747ea9febbd304b7e2ecd8ab3a20711bb2/,
  );
  assert.match(entrypoint, /OPEN_WEIGHT_LLM_TOKEN/);
  assert.match(entrypoint, /OPEN_WEIGHT_LLM_THREADS must be an integer from 1 to 8/);
  assert.match(entrypoint, /export LC_ALL=C/);
  assert.match(entrypoint, /validate_open_weight_llm_token/);
  assert.match(entrypoint, /validate_open_weight_llm_bind_address/);
  assert.match(
    entrypoint,
    /"\$@" --host "\$socket_path" &[\s\S]*chmod 0770 "\$socket_path"[\s\S]*wait "\$server_pid"/,
  );
  const healthcheck = readFileSync(join(runtimeRoot, 'healthcheck.sh'), 'utf8');
  assert.match(healthcheck, /stat --format='%a'[\s\S]*= 770/);
  assert.doesNotMatch(entrypoint, /--(?:model-url|hf-repo|hf-file)\b/);
  for (const script of [
    'entrypoint.sh',
    'healthcheck.sh',
    'validate-bind.sh',
    'validate-token.sh',
  ]) {
    const syntax = spawnSync('sh', ['-n', join(runtimeRoot, script)], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
  }
});

test('Single-Key-Credential bleibt CSV-sicher und wird unverändert akzeptiert', () => {
  const validator = join(runtimeRoot, 'validate-token.sh');
  const validate = (token) =>
    spawnSync(
      'sh',
      ['-c', '. "$1"; validate_open_weight_llm_token "$2"', 'validator', validator, token],
      { encoding: 'utf8' },
    );
  const validToken = 'runtime-secret-000000000000000000';
  assert.equal(validate(validToken).status, 0);
  for (const token of [`a,${'x'.repeat(32)}`, `"${'x'.repeat(32)}"`, `${'x'.repeat(32)} y`]) {
    assert.equal(validate(token).status, 64, token);
  }
});

test('HTTP-Bind erlaubt lokales Loopback und private Ziele, aber keine Wildcard oder Public-IP', () => {
  const validator = join(runtimeRoot, 'validate-bind.sh');
  const validate = (address) =>
    spawnSync(
      'sh',
      ['-c', '. "$1"; validate_open_weight_llm_bind_address "$2"', 'validator', validator, address],
      { encoding: 'utf8' },
    );
  for (const address of ['127.0.0.1', '::1', '10.0.0.20', '192.168.2.20', 'fd00::20']) {
    assert.equal(validate(address).status, 0, address);
  }
  for (const address of ['', '0.0.0.0', '::', '8.8.8.8', '2001:4860:4860::8888']) {
    assert.equal(validate(address).status, 64, address);
  }
});

test('Model-Prüfer verifiziert Größe und SHA-256 ohne Netz- oder Downloadpfad', () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'arsnova-llm-model-'));
  try {
    const modelPath = join(fixtureDir, 'fixture.gguf');
    const manifestPath = join(fixtureDir, 'manifest.json');
    const bytes = Buffer.from('small deterministic model fixture');
    const digest = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(modelPath, bytes);
    writeFileSync(
      manifestPath,
      JSON.stringify({ filename: 'fixture.gguf', sizeBytes: bytes.length, sha256: digest }),
    );
    const verified = spawnSync(
      process.execPath,
      [join(repoRoot, 'scripts/open-weight-llm/verify-model.mjs'), manifestPath, modelPath],
      { encoding: 'utf8' },
    );
    assert.equal(verified.status, 0, verified.stderr);
    assert.match(verified.stdout, new RegExp(digest));

    writeFileSync(modelPath, Buffer.from('tampered'));
    const rejected = spawnSync(
      process.execPath,
      [join(repoRoot, 'scripts/open-weight-llm/verify-model.mjs'), manifestPath, modelPath],
      { encoding: 'utf8' },
    );
    assert.notEqual(rejected.status, 0);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
