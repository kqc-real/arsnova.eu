import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts/dev-stack-status.mjs');

function run(profile, env = {}) {
  return spawnSync(process.execPath, [script, `--profile=${profile}`], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('zeigt im vollständigen KI-Profil alle Komponenten grün und verständlich', () => {
  const result = run('ai', { FORCE_COLOR: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.includes('\u001B[1;32m● AKTIV'), true);
  assert.equal(result.stdout.match(/● AKTIV/g)?.length, 5);
  assert.match(result.stdout, /Grundform zurückführen \(Lemmatisierung\)/);
  assert.match(result.stdout, /Ähnliche Beiträge zu Themen gruppieren/);
  assert.match(result.stdout, /Offene Fragen für die Lehrkraft zusammenfassen/);
  assert.match(result.stdout, /Lernziele für einen Quizentwurf vorschlagen/);
  assert.match(result.stdout, /Wo sichtbar:/);
  assert.match(result.stdout, /Texte stammen von:/);
  assert.match(result.stdout, /Aktive Locales:/);
  assert.match(result.stdout, /Modell\/Verfahren:/);
  assert.match(result.stdout, /intfloat\/multilingual-e5-small/);
  assert.match(result.stdout, /Kein kNN/);
  assert.match(result.stdout, /Complete-Linkage-Clustering/);
  assert.match(result.stdout, /Qwen3-4B-Instruct/);
  assert.match(result.stdout, /ordnet Aussagen keinen Personen zu/);
  assert.match(result.stdout, /Q&A-Fragen der Teilnehmenden/);
  assert.match(result.stdout, /zwei bis vier kurze Punkte/);
  assert.match(result.stdout, /http:\/\/localhost:4200/);
});

test('kennzeichnet nicht gestartete KI-Komponenten ausdrücklich als aus', () => {
  const result = run('nlp', { NO_COLOR: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.match(/● AKTIV/g)?.length, 2);
  assert.equal(result.stdout.match(/○ AUS/g)?.length, 3);
  assert.equal(result.stdout.includes('\u001B['), false);
});

test('bricht bei einem unbekannten Profil mit einer Hilfestellung ab', () => {
  const result = run('unbekannt');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Erlaubt sind: nlp, summary, ai/);
});

test('verdrahtet Statusübersicht und verständliche Logkanäle in allen Dev-Stacks', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  for (const name of ['dev', 'dev:de', 'dev:en', 'dev:qa-summary', 'dev:ai']) {
    assert.match(pkg.scripts[name], /^node scripts\/dev-stack\.mjs /, name);
  }
  assert.match(pkg.scripts['dev:ai'], /--profile=ai/);
  assert.match(pkg.scripts['dev:qa-summary'], /--profile=summary/);
  const freePorts = readFileSync(join(root, 'scripts/free-dev-ports.mjs'), 'utf8');
  assert.match(freePorts, /Private Text-KI erreichbar/);
  assert.match(freePorts, /Port \$\{port\} freigegeben/);
  for (const port of [3000, 3001, 3002, 4200, 8787]) {
    assert.match(freePorts, new RegExp(`\\[${port},`));
  }
});

test('Starter beschreibt das vollständige KI-Profil ohne Prozesse zu starten', () => {
  const result = spawnSync(
    process.execPath,
    [join(root, 'scripts/dev-stack.mjs'), '--profile=ai', '--locale=de', '--describe'],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  const description = JSON.parse(result.stdout);
  assert.deepEqual(description.processNames, [
    'server',
    'web',
    'zusammenfassung',
    'lemmatisierung',
    'themen',
  ]);
  assert.equal(description.killOthersOnFail, true);
  assert.match(description.commands.join('\n'), /qa-summary:dev:extractive/);
  assert.deepEqual(description.freePortArguments, [
    '--ports=3000,3001,3002,4200,8787',
    '--require-open-weight-llm',
  ]);
  assert.deepEqual(description.enabledEnvironment, { OPEN_WEIGHT_LLM_ENABLED: 'true' });
});

test('Starter aktiviert die Zusammenfassung ohne zusätzliche Einträge in .env', () => {
  const result = spawnSync(
    process.execPath,
    [join(root, 'scripts/dev-stack.mjs'), '--profile=summary', '--locale=de', '--describe'],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  const description = JSON.parse(result.stdout);
  assert.deepEqual(description.enabledEnvironment, {
    QA_NLP_ENABLED: 'true',
    QA_SUMMARY_ENABLED: 'true',
    QA_SUMMARY_INFERENCE_URL: 'http://127.0.0.1:8787/summary',
  });
});
