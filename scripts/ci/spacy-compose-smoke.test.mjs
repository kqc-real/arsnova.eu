import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function readRepoFile(fileName) {
  return readFileSync(join(repoRoot, fileName), 'utf8');
}

function extractServiceBlock(composeText, serviceName) {
  const headings = [...composeText.matchAll(/^(?: {2})?[A-Za-z0-9._-]+:(?: &[A-Za-z0-9._-]+)?$/gm)];
  const heading = headings.findIndex(([line]) => line.startsWith(`  ${serviceName}:`));
  assert.notEqual(heading, -1, `Service ${serviceName} fehlt`);
  return composeText.slice(headings[heading].index, headings[heading + 1]?.index);
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
  const compose = readRepoFile('docker-compose.yml');
  assertSidecarHardening(extractServiceBlock(compose, 'spacy'), 'local');
  const app = extractServiceBlock(compose, 'app');
  assert.match(app, /NLP_ENABLED:\s*'false'/);
  assert.match(app, /NLP_CACHE_TTL_SECONDS:\s*'1800'/);
});

test('docker-compose.prod.yml koppelt den Sidecar an SPACY_IMAGE, nicht ARSNOVA_IMAGE', () => {
  const compose = readRepoFile('docker-compose.prod.yml');
  const spacy = extractServiceBlock(compose, 'spacy');
  assertSidecarHardening(spacy, 'prod');
  assert.match(spacy, /image:\s*\$\{SPACY_IMAGE:-arsnova-spacy:3\.8\.15\}/);
  assert.doesNotMatch(spacy, /ARSNOVA_IMAGE/);
  const app = extractServiceBlock(compose, 'app');
  assert.match(app, /NLP_CACHE_TTL_SECONDS:\s*'1800'/);
});

test('spaCy verifies the language models and Italian lookup data in a separate pip hash check', () => {
  const packages = readRepoFile('docker/spacy/requirements-models.txt')
    .split('\n')
    .filter((line) => line && !line.startsWith('#'));
  assert.deepEqual(
    packages.map((line) => line.split(/ @ |==/)[0]),
    [
      'de-core-news-sm',
      'en-core-web-sm',
      'fr-core-news-sm',
      'es-core-news-sm',
      'spacy-lookups-data',
    ],
  );
  for (const requirement of packages.slice(0, 4)) {
    assert.match(requirement, /\.whl --hash=sha256:[a-f0-9]{64}$/);
  }
  assert.match(packages.at(-1), /^spacy-lookups-data==1\.0\.5 --hash=sha256:[a-f0-9]{64}$/);
  assert.doesNotMatch(
    readRepoFile('docker/spacy/requirements.txt'),
    /^\s*spacy[-_]lookups[-_]data\b/im,
  );
  assert.match(
    readRepoFile('docker/spacy/Dockerfile'),
    /pip install --no-cache-dir --no-deps --require-hashes -r requirements-models\.txt/,
  );
});
