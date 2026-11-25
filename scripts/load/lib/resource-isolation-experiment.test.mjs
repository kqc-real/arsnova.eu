import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';
import {
  erstelleVersuchsplan,
  erstelleLaborCompose,
  erstelleFixtureSql,
  fuehreVersuchsreiheAus,
} from './resource-isolation-experiment.mjs';
import { buildResourceIsolationFixture } from './resource-isolation-fixture.mjs';

test('plant fünf vollständige randomisierte Blöcke reproduzierbar', () => {
  const plan = erstelleVersuchsplan(438314513);
  assert.equal(plan.length, 25);
  assert.deepEqual(plan, erstelleVersuchsplan(438314513));
  assert.notDeepEqual(plan, erstelleVersuchsplan(438314514));
  for (let block = 1; block <= 5; block++) {
    assert.deepEqual(
      plan
        .filter((lauf) => lauf.block === block)
        .map((lauf) => lauf.variant)
        .sort(),
      ['V0', 'V1', 'V2', 'V3', 'V4'],
    );
  }
  for (const seed of [-1, 1.5, 2 ** 32, '123']) assert.throws(() => erstelleVersuchsplan(seed));
});

test('isoliert alle Produktionsdienste und setzt ausschließlich die gewählte Laborvariante', async () => {
  const prod = parse(
    await readFile(new URL('../../../docker-compose.prod.yml', import.meta.url), 'utf8'),
  );
  const original = structuredClone(prod);
  const images = { app: `sha256:${'a'.repeat(64)}`, spacy: `sha256:${'b'.repeat(64)}` };
  for (const variant of ['V0', 'V1', 'V2', 'V3', 'V4']) {
    const compose = erstelleLaborCompose(prod, {
      variant,
      images,
      secretsFile: '/tmp/privat.env',
      proxyDirectory: '/tmp/proxy',
    });
    assert.deepEqual(Object.keys(compose.services).sort(), [
      'app',
      'pdf-worker',
      'postgres',
      'redis',
      'spacy',
    ]);
    for (const service of Object.values(compose.services)) {
      assert.equal(service.container_name, undefined);
      assert.equal(service.restart, 'no');
      assert.equal(service.build, undefined);
    }
    assert.equal(compose.services.app.image, images.app);
    assert.equal(compose.services['pdf-worker'].image, images.app);
    assert.equal(compose.services.spacy.cpus, variant === 'V3' ? '0.25' : '1.0');
    assert.equal(compose.services.spacy.mem_limit, '1g');
    assert.equal(compose.services.spacy.pids_limit, 64);
    assert.equal(compose.services.spacy.network_mode, 'none');
    assert.equal(compose.services.app.mem_limit, undefined);
    assert.equal(
      compose.services.app.environment.NLP_ENABLED,
      ['V0', 'V1'].includes(variant) ? 'false' : 'true',
    );
    assert.equal(compose.services.app.environment.QA_NLP_ENABLED, 'false');
    assert.equal(
      compose.services.app.environment.NLP_SOCKET_PATH,
      variant === 'V4' ? '/run/1a-proxy/nlp.sock' : '/run/spacy/nlp.sock',
    );
    assert.deepEqual(compose.services.app.ports, ['127.0.0.1:15300:3000', '127.0.0.1:15301:3001']);
    assert.deepEqual(compose.services.app.env_file, ['/tmp/privat.env']);
    assert.equal(compose.services.app.depends_on['open-weight-llm'], undefined);
    assert.deepEqual(compose.services.spacy.profiles, ['nlp']);
  }
  assert.deepEqual(prod, original);
});

test('erzeugt konsistente synthetische Fragen und Einzelbewertungen nur für neue Laborsessions', () => {
  const sql = erstelleFixtureSql(
    '00000000-0000-4000-8000-000000000001',
    buildResourceIsolationFixture(),
  );
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /ROLLBACK|RAISE EXCEPTION/);
  assert.match(sql, /"QaUpvote"/);
  assert.match(sql, /"qaRankingRevision"/);
  assert.match(sql, /"qaQuestionCount"/);
  assert.match(sql, /COMMIT;/);
  assert.throws(() => erstelleFixtureSql("'; DROP TABLE", buildResourceIsolationFixture()));
});

test('bewahrt verletzte Grenzwerte als Messergebnis und stellt nach jedem Lauf die Baseline wieder her', async () => {
  const vorgaenge = [];
  const reports = [];
  await fuehreVersuchsreiheAus({
    plan: [{ block: 1, variant: 'V3', run: 'block-01' }],
    vorbereiten: async () => vorgaenge.push('vorbereiten'),
    messen: async () => ({ complete: true, thresholdsPassed: false }),
    wiederherstellen: async () => {
      vorgaenge.push('rollback');
      return { verified: true };
    },
    speichern: async (lauf, report) => {
      reports.push({ lauf, report });
      vorgaenge.push('speichern');
    },
  });
  assert.deepEqual(vorgaenge, ['vorbereiten', 'rollback', 'speichern']);
  assert.equal(reports[0].report.complete, true);
  assert.equal(reports[0].report.thresholdsPassed, false);
  assert.equal(reports[0].report.rollback.verified, true);
});

test('speichert unvollständige Läufe ohne geheime Fehlermeldungen und beginnt keinen Folgelauf', async () => {
  let gestartet = 0;
  let wiederhergestellt = 0;
  const reports = [];
  await assert.rejects(
    () =>
      fuehreVersuchsreiheAus({
        plan: [{ variant: 'V2' }, { variant: 'V1' }],
        vorbereiten: async () => {
          gestartet++;
          throw new Error('token http://geheim');
        },
        messen: async () => assert.fail('Kein Messlauf nach fehlgeschlagener Vorbereitung.'),
        wiederherstellen: async () => {
          wiederhergestellt++;
          return { verified: true };
        },
        speichern: async (_, report) => reports.push(report),
      }),
    /unvollständig/,
  );
  assert.equal(gestartet, 1);
  assert.equal(wiederhergestellt, 1);
  assert.equal(reports[0].complete, false);
  assert.equal(reports[0].errorCode, 'RUN_FAILED');
  assert.doesNotMatch(JSON.stringify(reports), /geheim|token/);
});

test('bewahrt bei einem Abbruch die Teilergebnisse und meldet fehlgeschlagenen Rollback', async () => {
  const abbruch = new AbortController();
  let gespeichert;
  await assert.rejects(() =>
    fuehreVersuchsreiheAus({
      plan: [{ variant: 'V4' }],
      signal: abbruch.signal,
      vorbereiten: async () => {},
      messen: async () => {
        abbruch.abort();
        return { complete: false, samples: [17] };
      },
      wiederherstellen: async () => {
        throw new Error('geheimer Pfad');
      },
      speichern: async (_, report) => {
        gespeichert = report;
      },
    }),
  );
  assert.deepEqual(gespeichert.samples, [17]);
  assert.equal(gespeichert.errorCode, 'ABORTED');
  assert.deepEqual(gespeichert.rollback, { verified: false, errorCode: 'ROLLBACK_FAILED' });
});
