import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('Encoder-Build lädt genau die artefaktgebundenen Dateien aus einer festen Revision', () => {
  const directory = join(repoRoot, 'docker/wordcloud-encoder');
  const dockerfile = readFileSync(join(directory, 'Dockerfile'), 'utf8');
  const manifest = readFileSync(join(directory, 'model.sha256'), 'utf8').trim().split('\n');
  const files = manifest.map((line) => {
    const match = /^([a-f0-9]{64}) {2}(\S+)$/.exec(line);
    assert.ok(match, `Ungültiges SHA-256-Manifest: ${line}`);
    return match[2];
  });
  assert.deepEqual(files.sort(), [
    'config.json',
    'onnx/model.onnx',
    'onnx/model_quantized.onnx',
    'tokenizer.json',
    'tokenizer_config.json',
  ]);
  assert.match(dockerfile, /snapshot_download\([^\n]*revision='[a-f0-9]{40}'/);
  assert.match(dockerfile, /allow_patterns=\[[^\n]*Path\('model\.sha256'\)/);
  assert.match(
    dockerfile,
    /cd \/models\/e5-small && sha256sum --strict --check \/app\/model\.sha256/,
  );
});

function readCompose(fileName) {
  return readFileSync(join(repoRoot, fileName), 'utf8');
}

function extractServiceBlock(composeText, serviceName) {
  const headings = [...composeText.matchAll(/^(?: {2})?[A-Za-z0-9._-]+:(?: &[A-Za-z0-9._-]+)?$/gm)];
  const heading = headings.findIndex(([line]) => line.startsWith(`  ${serviceName}:`));
  assert.notEqual(heading, -1, `Service ${serviceName} fehlt`);
  return composeText.slice(headings[heading].index, headings[heading + 1]?.index);
}

function assertEncoderHardening(block, label) {
  assert.match(block, /profiles:\s*\['encoder'\]/, `${label}: Profil encoder`);
  assert.match(block, /network_mode:\s*none\b/, `${label}: kein Docker-Netz`);
  assert.doesNotMatch(block, /^\s+ports:/m, `${label}: kein TCP-Port`);
  assert.match(block, /read_only:\s*true\b/, `${label}: read-only Rootfs`);
  assert.match(block, /wordcloud_encoder_socket/, `${label}: Socket-Volume`);
  assert.match(
    block,
    /WORD_CLOUD_ENCODER_SOCKET_PATH:\s*\/run\/wordcloud-encoder\/encoder\.sock/,
    `${label}: Socket-Pfad`,
  );
  assert.match(block, /mem_limit:\s*2g/, `${label}: RAM-cgroup`);
  assert.match(
    block,
    label === 'prod' ? /cpus:\s*'4\.0'/ : /cpus:\s*'1\.0'/,
    `${label}: CPU-cgroup`,
  );
}

test('docker-compose.yml startet den Encoder nur über Profil encoder ohne öffentlichen Port', () => {
  const compose = readCompose('docker-compose.yml');
  assertEncoderHardening(extractServiceBlock(compose, 'wordcloud-encoder'), 'local');
  const app = extractServiceBlock(compose, 'app');
  assert.match(app, /WORD_CLOUD_SEMANTIC_ENABLED:\s*'false'/);
  assert.match(app, /WORD_CLOUD_ENCODER_CACHE_TTL_SECONDS:\s*'1800'/);
});

test('docker-compose.prod.yml koppelt den Encoder an WORD_CLOUD_ENCODER_IMAGE, nicht ARSNOVA_IMAGE', () => {
  const compose = readCompose('docker-compose.prod.yml');
  const encoder = extractServiceBlock(compose, 'wordcloud-encoder');
  assertEncoderHardening(encoder, 'prod');
  assert.match(
    encoder,
    /image:\s*\$\{WORD_CLOUD_ENCODER_IMAGE:-arsnova-wordcloud-encoder:e5-small\}/,
  );
  assert.doesNotMatch(encoder, /ARSNOVA_IMAGE/);
  const app = extractServiceBlock(compose, 'app');
  assert.match(app, /WORD_CLOUD_ENCODER_CACHE_TTL_SECONDS:\s*'1800'/);
});
