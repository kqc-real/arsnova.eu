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
    .match(/\n  [A-Za-z0-9._-]+:\n|\n[A-Za-z0-9._-]+:\n/);
  const end = nextMatch ? afterHeading + (nextMatch.index ?? 0) : composeText.length;
  return composeText.slice(start + 1, end);
}

function assertSidecarHardening(block, label) {
  assert.match(block, /profiles:\s*\['nlp'\]/, `${label}: Profil nlp`);
  assert.match(block, /network_mode:\s*none\b/, `${label}: kein Docker-Netz`);
  assert.doesNotMatch(block, /^\s+ports:/m, `${label}: kein TCP-Port`);
  assert.match(block, /read_only:\s*true\b/, `${label}: read-only Rootfs`);
  assert.match(block, /spacy_socket/, `${label}: Socket-Volume`);
  assert.match(block, /NLP_SOCKET_PATH:\s*\/run\/spacy\/nlp\.sock/, `${label}: Socket-Pfad`);
}

test('docker-compose.yml startet spaCy nur über Profil nlp ohne öffentlichen Port', () => {
  const compose = readCompose('docker-compose.yml');
  assertSidecarHardening(extractServiceBlock(compose, 'spacy'), 'local');
  const app = extractServiceBlock(compose, 'app');
  assert.match(app, /NLP_ENABLED:\s*'false'/);
  assert.match(app, /NLP_CACHE_TTL_SECONDS:\s*'1800'/);
});

test('docker-compose.prod.yml koppelt den Sidecar an SPACY_IMAGE, nicht ARSNOVA_IMAGE', () => {
  const compose = readCompose('docker-compose.prod.yml');
  const spacy = extractServiceBlock(compose, 'spacy');
  assertSidecarHardening(spacy, 'prod');
  assert.match(spacy, /image:\s*\$\{SPACY_IMAGE:-arsnova-spacy:3\.8\.15\}/);
  assert.doesNotMatch(spacy, /ARSNOVA_IMAGE/);
  const app = extractServiceBlock(compose, 'app');
  assert.match(app, /NLP_CACHE_TTL_SECONDS:\s*'1800'/);
});
