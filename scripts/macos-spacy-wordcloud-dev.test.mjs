import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'macos-spacy-wordcloud-dev.sh');

function run(args) {
  return spawnSync('bash', [script, ...args], { encoding: 'utf8' });
}

test('macos-spacy-wordcloud-dev.sh ist syntaktisch gültiges Bash', () => {
  const result = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('--help nennt Demo-Quiz, Clean, Produktions-Build und Locales', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Demo-Quiz mit Freitextfrage/);
  assert.match(result.stdout, /Was hilft dir beim Lernen/);
  assert.match(result.stdout, /build:prod/);
  assert.match(result.stdout, /clean:generated/);
  assert.match(result.stdout, /start:prod/);
  assert.match(result.stdout, /serve:localize:api/);
  assert.match(result.stdout, /localhost:4200\/de\//);
  assert.match(result.stdout, /localhost:4200\/fr\//);
  assert.match(result.stdout, /seed:session-votes/);
  assert.match(result.stdout, /seed:qa-forum/);
});

test('prueft spaCy-Modelle de/en/fr/es', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /fr_core_news_sm/);
  assert.match(source, /es_core_news_sm/);
  assert.match(source, /Wolkensprache DE\/EN\/FR\/ES wählen/);
  assert.match(source, /http:\/\/localhost:4200\/it\//);
});

test('setzt ein lokales YJS_SHARE_TOKEN_SECRET fuer start:prod', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /YJS_SHARE_TOKEN_SECRET/);
  assert.match(source, /randomBytes\(32\)/);
  assert.match(source, /dump_backend_log/);
});

test('setzt npm_config_prefix zurück, bevor nvm geladen wird', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /unset npm_config_prefix NPM_CONFIG_PREFIX/);
});

test('run_seeds übergibt Q&A-Flags literal, ohne $qa_flag', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /seed:qa-forum -w @arsnova\/backend -- --code "\$CODE" --replace/);
  assert.match(source, /seed:qa-forum -w @arsnova\/backend -- --code "\$CODE" --append/);
  assert.doesNotMatch(source, /\$qa_flag/);
});

test('lehnt einen ungültigen Session-Code ab, bevor Clean oder Build startet', () => {
  const result = run(['--code', 'nope']);
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}${result.stderr}`, /Ungültiger Session-Code/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /clean:generated/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /build:prod/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /Starte Host-Sidecar/);
});
