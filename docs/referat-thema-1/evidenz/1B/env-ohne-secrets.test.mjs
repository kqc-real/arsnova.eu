// Prüft env-ohne-secrets.sh: .env-Dateien für das Reproduktionspaket (Dossier 10.6) ohne Secrets.
// Aufruf: node --test docs/referat-thema-1/evidenz/1B/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const filter = (text) =>
  execFileSync('bash', [join(here, 'env-ohne-secrets.sh')], { input: text, encoding: 'utf8' });
const sha = (v) => createHash('sha256').update(v).digest('hex');

test('ersetzt Werte geheimer Schlüssel durch SHA-256 und lässt den Rest stehen', () => {
  const ein = [
    '# Kommentar bleibt',
    'OPEN_WEIGHT_LLM_TOKEN=abc123geheim',
    'DATABASE_URL=postgresql://user:passwort@db:5432/arsnova',
    'JWT_SECRET=xyz',
    'POSTGRES_PASSWORD="mit anfuehrung"',
    'HOST_SESSION_TTL_SECONDS=900',
    'OPEN_WEIGHT_LLM_URL=http://192.168.150.20:8080',
    'QA_SUMMARY_TIMEOUT_MS=300000',
    'LEER=',
  ].join('\n');
  const aus = filter(ein);
  assert.match(aus, /^# Kommentar bleibt$/m);
  assert.match(aus, new RegExp(`^OPEN_WEIGHT_LLM_TOKEN=sha256:${sha('abc123geheim')}$`, 'm'));
  assert.match(
    aus,
    new RegExp(`^DATABASE_URL=sha256:${sha('postgresql://user:passwort@db:5432/arsnova')}$`, 'm'),
  );
  assert.match(aus, /^JWT_SECRET=sha256:[0-9a-f]{64}$/m);
  assert.match(aus, new RegExp(`^POSTGRES_PASSWORD=sha256:${sha('mit anfuehrung')}$`, 'm'));
  assert.match(aus, /^HOST_SESSION_TTL_SECONDS=900$/m);
  assert.match(aus, /^QA_SUMMARY_TIMEOUT_MS=300000$/m);
  assert.match(aus, /^LEER=$/m);
  for (const geheim of ['abc123geheim', 'passwort', 'xyz', 'mit anfuehrung'])
    assert.ok(!aus.includes(geheim), geheim);
});

test('URLs ohne Zugangsdaten bleiben lesbar, mit Zugangsdaten werden sie gehasht', () => {
  const aus = filter(
    'OPEN_WEIGHT_LLM_URL=http://192.168.150.20:8080\nREDIS_URL=redis://:pw@redis:6379\n',
  );
  assert.match(aus, /^OPEN_WEIGHT_LLM_URL=http:\/\/192\.168\.150\.20:8080$/m);
  assert.match(aus, /^REDIS_URL=sha256:[0-9a-f]{64}$/m);
});
