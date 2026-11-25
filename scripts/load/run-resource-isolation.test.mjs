import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import {
  pruefeVersuchsKonfiguration,
  waehleDiagnosefelder,
  pruefeVorlaufNachweis,
  schreibeLaufNachweis,
} from './run-resource-isolation.mjs';

const exec = promisify(execFile);
const config = {
  labAlias: 'eigener-rechner',
  baselineCommit: 'a'.repeat(40),
  baselineDirectory: '/tmp/baseline',
  applicationImage: `sha256:${'b'.repeat(64)}`,
  spacyImage: `sha256:${'c'.repeat(64)}`,
  generatorLocation: 'same-host',
};

test('validiert ohne Docker oder Backend genau 25 Pflichtläufe mit festem Zeitvertrag', async () => {
  const { stdout } = await exec(
    process.execPath,
    ['scripts/load/run-resource-isolation.mjs', '--validate'],
    {
      env: { ...process.env, DOCKER_HOST: 'ungueltig', TRPC_URL: 'ungueltig' },
      timeout: 15000,
    },
  );
  const plan = JSON.parse(stdout);
  assert.equal(plan.runs.length, 25);
  assert.equal(plan.profile.durationMs, 300000);
  assert.equal(plan.profile.revealAtMs, 270000);
  assert.equal(plan.profile.warmupMs, 60000);
  assert.equal(plan.profile.participants, 500);
  assert.doesNotMatch(stdout, /ungueltig|hostToken|sessionCode/);
});

test('weist veränderliche Images, fehlende Baseline und unklare Generatorzuordnung zurück', () => {
  assert.doesNotThrow(() => pruefeVersuchsKonfiguration(config));
  for (const aenderung of [
    { applicationImage: 'latest' },
    { spacyImage: 'arsnova-spacy:latest' },
    { baselineCommit: 'main' },
    { baselineDirectory: 'relativ' },
    { labAlias: 'http://intern' },
    { generatorLocation: '' },
    { generatorLocation: 'separate-host' },
  ])
    assert.throws(() => pruefeVersuchsKonfiguration({ ...config, ...aenderung }));
});

test('nennt vorhandene Laborcontainer als Abbruchgrund ohne Docker-Ausgaben oder Secrets offenzulegen', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'a1-abbruch-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const baseline = join(dir, 'baseline');
  await mkdir(baseline);
  const { stdout } = await exec('git', [
    'show',
    'a19ca70ff37dcb5510a77ab2745c06b70ccc3565:docker-compose.prod.yml',
  ]);
  await writeFile(join(baseline, 'docker-compose.prod.yml'), stdout);
  const docker = join(dir, 'docker');
  await writeFile(
    docker,
    `#!/bin/sh
case "$3" in
  info) printf '%s\\n' '{"OSType":"linux","CgroupVersion":"2"}' ;;
  ps) printf '%s\\n' 'vertraulicher-containerwert' ;;
  *) exit 99 ;;
esac
`,
  );
  await chmod(docker, 0o700);
  const file = join(dir, 'labor.json');
  const evidenceRoot = join(dir, 'nachweise');
  await writeFile(
    file,
    JSON.stringify({
      ...config,
      baselineCommit: 'a19ca70ff37dcb5510a77ab2745c06b70ccc3565',
      baselineDirectory: baseline,
      evidenceRoot,
    }),
  );
  await assert.rejects(
    () =>
      exec(
        process.execPath,
        ['scripts/load/run-resource-isolation.mjs', '--pilot', '--config-file', file],
        { env: { ...process.env, PATH: `${dir}:${process.env.PATH}` }, timeout: 15000 },
      ),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Es existieren bereits A1-Laborcontainer/);
      assert.doesNotMatch(error.stderr, /vertraulicher-containerwert|sha256:|stack|at main/);
      return true;
    },
  );
  await assert.rejects(() => readFile(join(evidenceRoot, 'vorlauf/abschluss.json')), {
    code: 'ENOENT',
  });
});

test('meldet Dateifehler mit Fehlercode ohne private Dateipfade zu veröffentlichen', async () => {
  await assert.rejects(
    () =>
      exec(process.execPath, [
        'scripts/load/run-resource-isolation.mjs',
        '--pilot',
        '--config-file',
        '/nicht-vorhanden/privater-pfad/labor.json',
      ]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /ENOENT/);
      assert.doesNotMatch(error.stderr, /privater-pfad|readFile|at main/);
      return true;
    },
  );
});

test('übernimmt aus Betriebsdiagnosen ausschließlich freigegebene numerische Felder', () => {
  const diagnose = waehleDiagnosefelder(
    {
      qaWordCloud: { sidecarCalls: 7, textHits: 0, lastLatencyMs: 3, secret: 'geheim' },
      qaNlp: { completed: 0, token: 'geheim' },
      sensitive: 'http://interne-adresse',
    },
    { uptime: 13, activeSessions: 2, address: 'geheim' },
  );
  assert.equal(diagnose.qaWordCloud.sidecarCalls, 7);
  assert.equal(diagnose.qaWordCloud.textHits, 0);
  assert.doesNotMatch(JSON.stringify(diagnose), /geheim|interne-adresse|secret|token/);
  assert.throws(() => waehleDiagnosefelder({ qaWordCloud: { sidecarCalls: '7' } }, {}));
});

test('lässt bestätigende Läufe nur nach vollständigem Vorlauf derselben Werkzeuge und Bedingungen zu', () => {
  const identitaet = {
    baselineCommit: 'a',
    applicationImage: 'b',
    spacyImage: 'c',
    toolsSha256: 'd',
    contractSha256: 'e',
    fixtureSha256: 'f',
    orderSeed: 7,
  };
  const nachweis = { ...identitaet, complete: true };
  assert.doesNotThrow(() => pruefeVorlaufNachweis(nachweis, identitaet));
  for (const feld of Object.keys(identitaet))
    assert.throws(() =>
      pruefeVorlaufNachweis({ ...nachweis, [feld]: 'anderer-stand' }, identitaet),
    );
  assert.throws(() => pruefeVorlaufNachweis({ ...nachweis, complete: false }, identitaet));
});

test('bewahrt Ressourcen verlustfrei komprimiert und verhindert das Überschreiben vorhandener Nachweise', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'a1-nachweise-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const resources = {
    snapshots: [
      { atMs: 0, containers: [] },
      { atMs: 300000, containers: [] },
    ],
    plannedSamples: 2,
  };
  const report = {
    complete: true,
    manifest: { variant: 'V1' },
    rollback: { verified: true },
    resources,
    warmup: { resources: { snapshots: [], plannedSamples: 0 } },
  };
  const lauf = { variant: 'V1', run: 'block-01' };
  await schreibeLaufNachweis(dir, lauf, report);
  const gespeichert = JSON.parse(await readFile(join(dir, 'V1/block-01/lauf.json'), 'utf8'));
  assert.equal(gespeichert.resources.sampleCount, 2);
  assert.equal(gespeichert.resources.snapshots, undefined);
  const komprimiert = await readFile(join(dir, 'V1/block-01/ressourcen.json.gz'));
  assert.deepEqual(JSON.parse(gunzipSync(komprimiert)), resources);
  assert.equal(
    report.resources.snapshots.length,
    2,
    'Das ursprüngliche Ergebnis bleibt unverändert.',
  );
  assert.match(await readFile(join(dir, 'V1/block-01/report.xml'), 'utf8'), /failures="0"/);
  await assert.rejects(() => schreibeLaufNachweis(dir, lauf, report));
});

test('speichert bereinigte Compose-Aufnahmen pro Phase mit Prüfsumme und ohne eingebettete Kopie', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'a1-compose-nachweis-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const aufnahme = { services: { app: { image: config.applicationImage } } };
  await schreibeLaufNachweis(
    dir,
    { variant: 'V0', run: 'block-01' },
    {
      complete: true,
      manifest: {},
      resolvedCompose: aufnahme,
      warmup: { manifest: {}, resolvedCompose: aufnahme },
    },
  );
  const basis = join(dir, 'V0/block-01');
  const nachweis = JSON.parse(await readFile(join(basis, 'lauf.json'), 'utf8'));
  assert.equal(nachweis.resolvedCompose, undefined);
  assert.equal(nachweis.manifest.resolvedCompose.file, 'compose-messung.json');
  assert.equal(
    nachweis.manifest.resolvedCompose.sha256,
    createHash('sha256')
      .update(await readFile(join(basis, 'compose-messung.json')))
      .digest('hex'),
  );
  assert.equal(nachweis.warmup.manifest.resolvedCompose.file, 'compose-aufwaermung.json');
  assert.deepEqual(
    JSON.parse(await readFile(join(basis, 'compose-messung.json'), 'utf8')),
    aufnahme,
  );
});
