import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, cp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { ladeReihendefinition } from './lib/resource-isolation-series.mjs';
import { leseVersuchsreihe, werteVersuchsreiheAus } from './evaluate-resource-isolation.mjs';

const exec = promisify(execFile);
const quelle = resolve('docs/referat-thema-1/evidenz/1A/reihe-main-a19ca70f-20261115-122547');

test('wertet ausschließlich die 25 vollständigen gepaarten Läufe aus und bewahrt Grenzverletzungen', async () => {
  const daten = await leseVersuchsreihe(quelle);
  const auswertung = werteVersuchsreiheAus(daten);
  assert.equal(auswertung.runs.length, 25);
  assert.equal(auswertung.comparisons.length, 80);
  assert.equal(auswertung.hypotheses.H1.passed, false);
  assert.equal(auswertung.hypotheses.H2.passed, false);
  assert.equal(auswertung.hypotheses.H1.failedComparisons, 1);
  assert.equal(auswertung.hypotheses.H2.failedComparisons, 6);
  assert.equal(
    auswertung.runs.every((lauf) => lauf.live.vote.voteTargetPassed),
    true,
  );
  assert.equal(
    auswertung.runs.every((lauf) => lauf.resources.every((c) => c.oomPassed)),
    true,
  );
  const qaBlockVier = auswertung.comparisons.find(
    (x) => x.variant === 'V2' && x.block === 4 && x.action === 'qaSubmit',
  );
  assert.equal(qaBlockVier.relativePassed, false);
  assert.equal(qaBlockVier.absolutePassed, true);
  assert.ok(qaBlockVier.candidate.p95Ms > qaBlockVier.baseline.p95Ms * 1.1);
});

test('verwirft unvollständige Reihen vor dem Lesen einzelner Nachweise', async (t) => {
  const ordner = await mkdtemp(join(tmpdir(), 'a1-auswertung-fehlt-'));
  t.after(() => rm(ordner, { recursive: true, force: true }));
  await assert.rejects(() => leseVersuchsreihe(ordner));
  await writeFile(join(ordner, 'abschluss.json'), JSON.stringify({ complete: false }));
  await assert.rejects(() => leseVersuchsreihe(ordner));
});

test('prüft Ressourcen-Prüfsummen und erkennt einen nachträglich veränderten Inhalt', async (t) => {
  const ordner = await mkdtemp(join(tmpdir(), 'a1-auswertung-pruefsumme-'));
  t.after(() => rm(ordner, { recursive: true, force: true }));
  await cp(quelle, ordner, { recursive: true });
  await writeFile(join(ordner, 'V1/block-01/ressourcen.json.gz'), 'kein unverändertes Artefakt');
  await assert.rejects(() => leseVersuchsreihe(ordner), /Prüfsumme/);
});

test('erkennt veränderte Reihenfolge und abweichende Fixture- oder Werkzeugidentität', async (t) => {
  const ordner = await mkdtemp(join(tmpdir(), 'a1-auswertung-identitaet-'));
  t.after(() => rm(ordner, { recursive: true, force: true }));
  await cp(quelle, ordner, { recursive: true });
  const pfad = join(ordner, 'V1/block-01/lauf.json');
  const original = JSON.parse(await readFile(pfad, 'utf8'));
  for (const aenderung of [
    { fixtureSha256: 'a'.repeat(64) },
    { toolsSha256After: 'b'.repeat(64) },
    { position: 2 },
  ]) {
    await writeFile(
      pfad,
      JSON.stringify({ ...original, manifest: { ...original.manifest, ...aenderung } }),
    );
    await assert.rejects(() => leseVersuchsreihe(ordner));
  }
});

test('verwirft einen scheinbar vollständigen Nachweis mit String statt echtem Wahrheitswert', async (t) => {
  const ordner = await mkdtemp(join(tmpdir(), 'a1-auswertung-wahrheitswert-'));
  t.after(() => rm(ordner, { recursive: true, force: true }));
  await cp(quelle, ordner, { recursive: true });
  const pfad = join(ordner, 'abschluss.json');
  const abschluss = JSON.parse(await readFile(pfad, 'utf8'));
  await writeFile(pfad, JSON.stringify({ ...abschluss, complete: 'false' }));
  await assert.rejects(() => leseVersuchsreihe(ordner), /Abschluss/);
});

test('CLI schreibt JSON, CSV und Markdown und überschreibt keine bestehenden Auswertungen', async (t) => {
  const ordner = await mkdtemp(join(tmpdir(), 'a1-auswertung-cli-'));
  t.after(() => rm(ordner, { recursive: true, force: true }));
  const ausgabe = join(ordner, 'ergebnis');
  const args = [
    'scripts/load/evaluate-resource-isolation.mjs',
    '--run',
    '--evidence-root',
    quelle,
    '--output-dir',
    ausgabe,
  ];
  const { stdout } = await exec(process.execPath, args, { timeout: 30000 });
  assert.match(stdout, /25/);
  const json = JSON.parse(await readFile(join(ausgabe, 'auswertung.json'), 'utf8'));
  assert.equal(json.hypotheses.H1.passed, false);
  assert.match(await readFile(join(ausgabe, 'auswertung.md'), 'utf8'), /nicht bestätigt/);
  assert.equal(
    (await readFile(join(ausgabe, 'live-vergleiche.csv'), 'utf8')).trim().split('\n').length,
    81,
  );
  await assert.rejects(() => exec(process.execPath, args, { timeout: 30000 }));
});

const definitionsdatei = 'docs/referat-thema-1/specs/2026-11-14-1a-messreihe-main-a19ca70f.json';
const hash = (daten) => createHash('sha256').update(daten).digest('hex');

// Negative Prüfungen verändern ausschließlich temporäre Kopien der aktuellen Reihe.
async function neueTestreihe(t) {
  const ordner = await mkdtemp(join(tmpdir(), 'a1-aktuelle-testreihe-'));
  t.after(() => rm(ordner, { recursive: true, force: true }));
  await cp(quelle, ordner, { recursive: true });
  return { ordner, reihe: await ladeReihendefinition(definitionsdatei) };
}

test('wertet eine ausdrücklich gewählte neue Baseline mit 256 PDF-Prozessen und 50 Compose-Belegen aus', async (t) => {
  const { ordner, reihe } = await neueTestreihe(t);
  const daten = await leseVersuchsreihe(ordner, reihe);
  assert.equal(daten.files.filter((f) => /compose-/.test(f.file)).length, 50);
  assert.equal(werteVersuchsreiheAus(daten).comparisons.length, 80);
  const ausgabe = join(ordner, 'neue-auswertung');
  await exec(
    process.execPath,
    [
      'scripts/load/evaluate-resource-isolation.mjs',
      '--run',
      '--evidence-root',
      ordner,
      '--output-dir',
      ausgabe,
      '--series-file',
      definitionsdatei,
    ],
    { timeout: 30000 },
  );
  const ergebnis = JSON.parse(await readFile(join(ausgabe, 'auswertung.json'), 'utf8'));
  assert.equal(ergebnis.source.identity.baselineCommit, reihe.baselineCommit);
  assert.equal(ergebnis.source.identity.seriesDefinitionSha256, reihe.definitionSha256);
  await assert.rejects(
    () => leseVersuchsreihe(ordner, { ...reihe, baselineCommit: 'a'.repeat(40) }),
    /Baseline/,
  );
});

test('CLI validiert die neue Reihendefinition statt weiterhin die alte Baseline auszugeben', async () => {
  const { stdout } = await exec(process.execPath, [
    'scripts/load/evaluate-resource-isolation.mjs',
    '--validate',
    '--series-file',
    definitionsdatei,
  ]);
  const daten = JSON.parse(stdout);
  assert.equal(daten.baselineCommit, 'a19ca70ff37dcb5510a77ab2745c06b70ccc3565');
  assert.match(daten.seriesDefinitionSha256, /^[a-f0-9]{64}$/);
});

test('verweigert fehlende oder beschädigte Compose-Aufnahmen und abweichende Dienstlimits', async (t) => {
  const { ordner, reihe } = await neueTestreihe(t);
  const file = join(ordner, 'V1/block-01/lauf.json');
  const original = JSON.parse(await readFile(file, 'utf8'));
  const berichtdatei = join(ordner, 'V1/block-01/report.json');
  const originalbericht = JSON.parse(await readFile(berichtdatei, 'utf8'));
  const speichern = async (nachweis) => {
    await writeFile(file, JSON.stringify(nachweis));
    await writeFile(
      berichtdatei,
      JSON.stringify({
        ...originalbericht,
        metrics: { ...originalbericht.metrics, manifest: nachweis.manifest },
      }),
    );
  };
  const ohne = structuredClone(original);
  delete ohne.manifest.resolvedCompose;
  await speichern(ohne);
  await assert.rejects(() => leseVersuchsreihe(ordner, reihe), /Compose/);
  const kaputt = structuredClone(original);
  kaputt.manifest.resolvedCompose.sha256 = 'a'.repeat(64);
  await speichern(kaputt);
  await assert.rejects(() => leseVersuchsreihe(ordner, reihe), /Compose/);
  const composefile = join(ordner, 'V1/block-01/compose-messung.json');
  const compose = JSON.parse(await readFile(composefile, 'utf8'));
  compose.services['pdf-worker'].pids_limit = 128;
  const bytes = JSON.stringify(compose);
  await writeFile(composefile, bytes);
  const falsch = structuredClone(original);
  falsch.manifest.resolvedCompose.sha256 = hash(bytes);
  await speichern(falsch);
  await assert.rejects(() => leseVersuchsreihe(ordner, reihe), /pdf-worker/);
});

test('verweigert vermischte Reihendefinitionen und fehlende Aufwärmbelege', async (t) => {
  const { ordner, reihe } = await neueTestreihe(t);
  const file = join(ordner, 'V1/block-01/lauf.json');
  const original = JSON.parse(await readFile(file, 'utf8'));
  const gemischt = structuredClone(original);
  gemischt.warmup.manifest.seriesDefinitionSha256 = 'b'.repeat(64);
  await writeFile(file, JSON.stringify(gemischt));
  await assert.rejects(() => leseVersuchsreihe(ordner, reihe), /Reihendefinition/);
  await writeFile(file, JSON.stringify(original));
  await rm(join(ordner, 'V1/block-01/compose-aufwaermung.json'));
  await assert.rejects(() => leseVersuchsreihe(ordner, reihe), /ENOENT/);
});
