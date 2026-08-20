import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function readCompose(fileName) {
  return readFileSync(join(repoRoot, fileName), 'utf8');
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
  assert.match(block, /cpus:\s*'1\.0'/, `${label}: CPU-cgroup`);
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
