import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function loadCompose(fileName) {
  return parseYaml(readFileSync(join(repoRoot, fileName), 'utf8'));
}

function assertSidecarHardening(service, label) {
  assert.deepEqual(service.profiles, ['nlp'], `${label}: Profil nlp`);
  assert.equal(service.network_mode, 'none', `${label}: kein Docker-Netz`);
  assert.equal(service.ports, undefined, `${label}: kein TCP-Port`);
  assert.equal(service.read_only, true, `${label}: read-only Rootfs`);
  assert.match(JSON.stringify(service.volumes ?? []), /spacy_socket/, `${label}: Socket-Volume`);
  assert.equal(service.environment?.NLP_SOCKET_PATH, '/run/spacy/nlp.sock');
}

test('docker-compose.yml startet spaCy nur über Profil nlp ohne öffentlichen Port', () => {
  const compose = loadCompose('docker-compose.yml');
  assertSidecarHardening(compose.services.spacy, 'local');
  assert.equal(compose.services.app.environment.NLP_ENABLED, 'false');
  assert.equal(compose.services.app.environment.NLP_CACHE_TTL_SECONDS, '1800');
});

test('docker-compose.prod.yml koppelt den Sidecar an SPACY_IMAGE, nicht ARSNOVA_IMAGE', () => {
  const compose = loadCompose('docker-compose.prod.yml');
  assertSidecarHardening(compose.services.spacy, 'prod');
  assert.match(String(compose.services.spacy.image), /SPACY_IMAGE/);
  assert.doesNotMatch(String(compose.services.spacy.image), /ARSNOVA_IMAGE/);
  assert.equal(compose.services.app.environment.NLP_CACHE_TTL_SECONDS, '1800');
});
