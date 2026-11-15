#!/usr/bin/env node
import { execFile, fork, spawn } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { parse, stringify } from 'yaml';
import { createHttpTrpcSingle } from './lib/trpc-runtime.mjs';
import { createArtillery500Session } from './artillery/setup-session.mjs';
import {
  buildResourceIsolationFixture,
  hashResourceIsolationFixture,
} from './lib/resource-isolation-fixture.mjs';
import { fuehreHostAnalyseAus } from './host-analyze-loop.mjs';
import { erstelleContainerMetriken, sammleContainerMetriken } from './lib/container-metrics.mjs';
import { starteVerzoegerungsproxy } from './spacy-delay-proxy.mjs';
import {
  fasseLiveMessungenZusammen,
  fasseLaufzeitenZusammen,
} from './lib/artillery-live-messungen.mjs';
import { writeScenarioReport } from './lib/reporting.mjs';
import {
  erstelleVersuchsplan,
  erstelleLaborCompose,
  erstelleFixtureSql,
  fuehreVersuchsreiheAus,
  versuchsUhr,
  istDirekterAufruf,
} from './lib/resource-isolation-experiment.mjs';

import { ladeReihendefinition } from './lib/resource-isolation-series.mjs';
import { bereinigeCompose, pruefeManifestAbgleich } from './lib/resource-isolation-compose.mjs';

const exec = promisify(execFile);
const komprimieren = promisify(gzip);
const projekt = 'arsnova-1a';
const trpcUrl = 'http://127.0.0.1:15300/trpc';
const wsUrl = 'ws://127.0.0.1:15301';
const profil = {
  participants: 500,
  warmupMs: 60000,
  durationMs: 300000,
  rampMs: 90000,
  revealAtMs: 270000,
};
const vorlaufprofil = {
  participants: 30,
  warmupMs: 10000,
  durationMs: 30000,
  rampMs: 5000,
  revealAtMs: 25000,
};
const sha256 = (daten) => createHash('sha256').update(daten).digest('hex');
const root = fileURLToPath(new URL('../../', import.meta.url));

// Nur kontrollierte Hinweise aus diesem Werkzeug dürfen unverändert ins Terminal.
class Versuchsfehler extends Error {}

export function pruefeVorlaufNachweis(nachweis, identitaet) {
  if (
    !nachweis?.complete ||
    Object.keys(identitaet).some((key) => nachweis[key] !== identitaet[key])
  )
    throw new Error(
      'Ein vollständiger Vorlauf derselben Baseline, Werkzeuge und Bedingungen ist erforderlich.',
    );
}

export async function schreibeLaufNachweis(evidenceRoot, lauf, report) {
  if (!['V0', 'V1', 'V2', 'V3', 'V4'].includes(lauf.variant) || !/^block-\d{2}$/.test(lauf.run))
    throw new Error('Ungültige Nachweiszuordnung.');
  await mkdir(join(evidenceRoot, lauf.variant), { recursive: true });
  const ordner = join(evidenceRoot, lauf.variant, lauf.run);
  await mkdir(ordner);
  const ausgabe = structuredClone(report);
  for (const [phase, file] of [
    [ausgabe, 'compose-messung.json'],
    [ausgabe.warmup, 'compose-aufwaermung.json'],
  ]) {
    if (!phase?.resolvedCompose) continue;
    const daten = Buffer.from(`${JSON.stringify(phase.resolvedCompose, null, 2)}\n`);
    await writeFile(join(ordner, file), daten, { flag: 'wx' });
    phase.manifest.resolvedCompose = { file, sha256: sha256(daten), mediaType: 'application/json' };
    delete phase.resolvedCompose;
  }
  for (const [name, phase] of [
    ['ressourcen', ausgabe],
    ['aufwaermung-ressourcen', ausgabe.warmup],
  ]) {
    if (!phase?.resources) continue;
    const daten = await komprimieren(Buffer.from(JSON.stringify(phase.resources)));
    const file = `${name}.json.gz`;
    await writeFile(join(ordner, file), daten, { flag: 'wx' });
    const { snapshots, ...rest } = phase.resources;
    phase.resources = {
      ...rest,
      sampleCount: snapshots.length,
      artifact: { file, sha256: sha256(daten), encoding: 'gzip', mediaType: 'application/json' },
    };
  }
  await writeFile(join(ordner, 'lauf.json'), `${JSON.stringify(ausgabe, null, 2)}\n`, {
    flag: 'wx',
  });
  await writeScenarioReport({
    scenario: 'resource-isolation-experiment',
    metrics: {
      complete: ausgabe.complete,
      errorCode: ausgabe.errorCode ?? null,
      manifest: ausgabe.manifest,
      rollback: ausgabe.rollback,
    },
    failures: ausgabe.complete ? [] : ['Versuch unvollständig.'],
    filePath: join(ordner, 'report.json'),
    junitPath: join(ordner, 'report.xml'),
  });
}

async function werkzeugHash() {
  return sha256(
    Buffer.concat(
      await Promise.all(
        [
          'run-resource-isolation.mjs',
          'resource-isolation-live.mjs',
          'lib/resource-isolation-experiment.mjs',
          'lib/resource-isolation-series.mjs',
          'lib/resource-isolation-compose.mjs',
          'host-analyze-loop.mjs',
          'lib/host-analyze-loop.mjs',
          'lib/resource-isolation-fixture.mjs',
          'lib/container-metrics.mjs',
          'spacy-delay-proxy.mjs',
          'artillery/processor.mjs',
          'artillery/setup-session.mjs',
          'artillery/host-monitor.mjs',
          'lib/artillery-live-messungen.mjs',
        ].map((name) => readFile(new URL(name, import.meta.url))),
      ),
    ),
  );
}

export function pruefeVersuchsKonfiguration(config) {
  if (
    !config ||
    !/^[a-z][a-z0-9-]{0,39}$/.test(config.labAlias ?? '') ||
    !/^[a-f0-9]{40}$/.test(config.baselineCommit ?? '') ||
    !isAbsolute(config.baselineDirectory ?? '') ||
    ![config.applicationImage, config.spacyImage].every((image) =>
      /^sha256:[a-f0-9]{64}$/.test(image ?? ''),
    ) ||
    (config.seriesDefinitionFile !== undefined && !isAbsolute(config.seriesDefinitionFile)) ||
    config.generatorLocation !== 'same-host'
  )
    throw new Error(
      'Laboralias, Baseline-Verzeichnis/-Commit, Image-IDs und Lastgenerator-Zuordnung prüfen.',
    );
  erstelleVersuchsplan(config.orderSeed ?? 438314513);
  return { ...config, orderSeed: config.orderSeed ?? 438314513 };
}

export function waehleDiagnosefelder(security, stats) {
  const auswahl = (daten, namen) =>
    Object.fromEntries(
      namen
        .filter((name) => daten?.[name] !== undefined)
        .map((name) => {
          if (
            daten[name] !== null &&
            (typeof daten[name] !== 'number' || !Number.isFinite(daten[name]) || daten[name] < 0)
          )
            throw new Error('Ungültige numerische Diagnose.');
          return [name, daten[name]];
        }),
    );
  return {
    qaWordCloud: auswahl(security.qaWordCloud, [
      'snapshotHits',
      'snapshotMisses',
      'textHits',
      'textMisses',
      'sidecarCalls',
      'timeouts',
      'fallbacks',
      'inFlight',
      'lastLatencyMs',
    ]),
    qaNlp: auswahl(security.qaNlp, [
      'queueLength',
      'running',
      'completed',
      'failed',
      'fallback',
      'lastLatencyMs',
    ]),
    websocket: auswahl(security, [
      'trpcWebSocketConnectionsActive',
      'trpcWebSocketBoundConnectionsActive',
      'trpcWebSocketRejectedUpgradesLastMinute',
    ]),
    server: auswahl(stats, ['uptime', 'activeSessions', 'totalParticipants']),
  };
}

async function docker(args, { input, timeout = 240000 } = {}) {
  if (input === undefined)
    return (
      await exec('docker', ['--host', 'unix:///var/run/docker.sock', ...args], {
        timeout,
        maxBuffer: 8 * 1024 * 1024,
      })
    ).stdout.trim();
  return new Promise((fertig, reject) => {
    const child = spawn('docker', ['--host', 'unix:///var/run/docker.sock', ...args], {
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Docker-Frist überschritten.'));
    }, timeout);
    child.once('error', reject);
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) fertig('');
      else reject(new Error('Labordatenimport fehlgeschlagen.'));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

async function erstelleLabor(config, evidenceRoot, reihe) {
  const baselineCompose = await readFile(
    join(config.baselineDirectory, 'docker-compose.prod.yml'),
    'utf8',
  );
  const erwartet = (
    await exec('git', ['show', `${config.baselineCommit}:docker-compose.prod.yml`], { cwd: root })
  ).stdout;
  if (baselineCompose !== erwartet)
    throw new Versuchsfehler(
      'Baseline-Compose stimmt nicht mit dem festgehaltenen Commit überein.',
    );
  const prod = parse(baselineCompose);
  if (reihe && Number(prod.services['pdf-worker'].pids_limit) !== reihe.pdfWorkerPidsLimit)
    throw new Versuchsfehler(
      'PDF-Prozesslimit der Baseline stimmt nicht mit der Reihendefinition überein.',
    );
  const revision = (await exec('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  const toolsSha256 = await werkzeugHash();
  const contractSha256 = sha256(
    await readFile(join(root, 'docs/referat-thema-1/1A-experiment-contract.md')),
  );
  const daemon = JSON.parse(await docker(['info', '--format', '{{json .}}']));
  if (daemon.OSType !== 'linux' || daemon.CgroupVersion !== '2')
    throw new Versuchsfehler('Linux-Dockerhost mit cgroup v2 erforderlich.');
  if (await docker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${projekt}`]))
    throw new Versuchsfehler(
      'Es existieren bereits A1-Laborcontainer; vor einem neuen Versuch ihren Zustand prüfen.',
    );
  const images = { app: config.applicationImage, spacy: config.spacyImage };
  for (const [name, image] of Object.entries(images)) {
    const info = JSON.parse(await docker(['image', 'inspect', image]));
    if (info[0]?.Config?.Labels?.['org.opencontainers.image.revision'] !== config.baselineCommit)
      throw new Versuchsfehler(
        `Image-Provenienz für ${name} stimmt nicht mit der Baseline überein.`,
      );
  }
  for (const name of ['postgres', 'redis'])
    images[name] = await docker([
      'image',
      'inspect',
      prod.services[name].image,
      '--format',
      '{{.Id}}',
    ]);
  const privat = await mkdtemp(join(tmpdir(), 'arsnova-1a-'));
  const secretsFile = join(privat, 'labor.env');
  const composeFile = join(privat, 'compose.yml');
  const proxyDirectory = join(privat, 'proxy');
  const socketDirectory = join(privat, 'spacy');
  await mkdir(proxyDirectory, { mode: 0o700 });
  await mkdir(socketDirectory, { mode: 0o700 });
  const secret = () => randomBytes(32).toString('hex');
  const passwort = secret();
  const diagnosticSecret = secret();
  await writeFile(
    secretsFile,
    [
      'POSTGRES_USER=arsnova_user',
      'POSTGRES_DB=arsnova_v3',
      `POSTGRES_PASSWORD=${passwort}`,
      `DATABASE_URL=postgresql://arsnova_user:${passwort}@postgres:5432/arsnova_v3?schema=public`,
      'REDIS_URL=redis://redis:6379',
      `JWT_SECRET=${secret()}`,
      `ADMIN_SECRET=${secret()}`,
      `CAPABILITY_ENVELOPE_KEY_BASE64=${randomBytes(32).toString('base64')}`,
      `ADMIN_DIAGNOSTIC_SECRET=${diagnosticSecret}`,
      `CSP_REPORT_HASH_SECRET=${secret()}`,
      'PUBLIC_FRONTEND_URL=http://127.0.0.1:15300',
      'NODE_ENV=production',
      // Wie in .env.production.example; der Code-Fallback von 10 reicht nicht für getrennte Phasen.
      'RATE_LIMIT_SESSION_CREATE_PER_HOUR=480',
      'RATE_LIMIT_SESSION_CREATE_GLOBAL_PER_HOUR=2400',
    ].join('\n'),
    { mode: 0o600 },
  );
  const compose = (...args) =>
    docker(['compose', '--env-file', secretsFile, '-f', composeFile, '-p', projekt, ...args]);
  const schreiben = async (variant) => {
    const daten = erstelleLaborCompose(prod, {
      variant,
      images,
      secretsFile,
      proxyDirectory,
      socketDirectory,
    });
    for (const name of ['postgres', 'redis']) daten.services[name].image = images[name];
    await writeFile(composeFile, stringify(daten), { mode: 0o600 });
    return daten;
  };
  const cid = async (name) => {
    const id = await compose('ps', '-q', name);
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Laborcontainer nicht eindeutig gefunden.');
    return id;
  };
  let proxy;
  let angelegt = false;
  let aufbau;
  let stage = 'PREFLIGHT';
  const fixture = buildResourceIsolationFixture();
  const analyseConfig = async (signal) => {
    const sessions = [];
    const client = createHttpTrpcSingle(trpcUrl);
    for (let i = 0; i < 5; i++) {
      signal.throwIfAborted();
      const session = await client.session.create.mutate({
        type: 'Q_AND_A',
        title: '1A Laboranalyse',
        moderationMode: false,
      });
      await docker(
        [
          'exec',
          '-i',
          await cid('postgres'),
          'psql',
          '-v',
          'ON_ERROR_STOP=1',
          '-U',
          'arsnova_user',
          '-d',
          'arsnova_v3',
        ],
        { input: erstelleFixtureSql(session.sessionId, fixture) },
      );
      sessions.push({
        sessionId: session.sessionId,
        sessionCode: session.code,
        hostToken: session.hostToken,
      });
    }
    return {
      trpcUrl,
      fixtureSeed: fixture.seed,
      fixtureSha256: hashResourceIsolationFixture(fixture),
      sessions,
    };
  };
  const diagnose = async (phase, startAtMs) => {
    const client = createHttpTrpcSingle(trpcUrl, undefined, undefined, diagnosticSecret);
    const [security, stats] = await Promise.all([
      client.health.securityStats.query(undefined, { signal: AbortSignal.timeout(10000) }),
      client.health.stats.query(undefined, { signal: AbortSignal.timeout(10000) }),
    ]);
    return { phase, atMs: versuchsUhr.now() - startAtMs, ...waehleDiagnosefelder(security, stats) };
  };
  async function pruefeZustand(variant) {
    const dienste = [
      'app',
      'postgres',
      'redis',
      'pdf-worker',
      ...(['V0', 'V1'].includes(variant) ? [] : ['spacy']),
    ];
    const dienstmanifest = {};
    for (const name of dienste) {
      const info = JSON.parse(await docker(['inspect', await cid(name)]))[0];
      if (!info.State.Running || info.State.Health?.Status !== 'healthy' || info.RestartCount !== 0)
        throw new Error('Laborcontainer nicht gesund oder unerwartet neu gestartet.');
      if (info.Image !== images[name === 'pdf-worker' ? 'app' : name])
        throw new Error('Abweichendes Dienstimage.');
      if (
        name === 'spacy' &&
        (info.HostConfig.NanoCpus !== (variant === 'V3' ? 250000000 : 1000000000) ||
          info.HostConfig.Memory !== 1073741824 ||
          info.HostConfig.PidsLimit !== 64)
      )
        throw new Error('spaCy-Ressourcenlimits stimmen nicht.');
      const flags = Object.fromEntries(
        info.Config.Env.map((eintrag) => {
          const index = eintrag.indexOf('=');
          return [eintrag.slice(0, index), eintrag.slice(index + 1)];
        }),
      );
      const erwartet = aufbau.services[name].environment ?? {};
      const auswahl = [
        'NLP_ENABLED',
        'QA_NLP_ENABLED',
        'QA_SUMMARY_ENABLED',
        'WORD_CLOUD_SEMANTIC_ENABLED',
        'OPEN_WEIGHT_LLM_ENABLED',
        'NLP_TIMEOUT_MS',
        'NLP_CACHE_TTL_SECONDS',
        'RATE_LIMIT_SESSION_CREATE_PER_HOUR',
        'RATE_LIMIT_SESSION_CREATE_GLOBAL_PER_HOUR',
      ];
      if (
        name === 'app' &&
        auswahl.some((key) => Object.hasOwn(erwartet, key) && flags[key] !== erwartet[key])
      )
        throw new Error('Wirksame Analyseschalter weichen ab.');
      if (name === 'app' && flags.NLP_SOCKET_PATH !== erwartet.NLP_SOCKET_PATH)
        throw new Error('Wirksame Socket-Zuordnung weicht ab.');
      dienstmanifest[name] = {
        imageId: info.Image,
        containerPseudonym: sha256(info.Id).slice(0, 16),
        cpuLimit: info.HostConfig.NanoCpus / 1e9 || null,
        memoryLimitBytes: info.HostConfig.Memory || null,
        pidsLimit: info.HostConfig.PidsLimit || null,
        ...(name === 'app'
          ? { flags: Object.fromEntries(auswahl.map((key) => [key, flags[key]])) }
          : {}),
      };
    }
    return dienstmanifest;
  }
  return {
    async vorbereiten(lauf, signal) {
      stage = 'COMPOSE_SETUP';
      if (angelegt) await compose('--profile', 'nlp', 'down', '--volumes', '--remove-orphans');
      aufbau = await schreiben(lauf.variant);
      angelegt = true;
      const services = [
        'postgres',
        'redis',
        'pdf-worker',
        ...(['V0', 'V1'].includes(lauf.variant) ? [] : ['spacy']),
      ];
      await compose('--profile', 'nlp', 'up', '-d', '--wait', '--wait-timeout', '180', ...services);
      if (lauf.variant === 'V4')
        proxy = await starteVerzoegerungsproxy({
          listenSocket: join(proxyDirectory, 'nlp.sock'),
          upstreamSocket: join(socketDirectory, 'nlp.sock'),
        });
      await compose('up', '-d', '--wait', '--wait-timeout', '180', 'app');
      signal.throwIfAborted();
      await pruefeZustand(lauf.variant);
    },
    async messen(lauf, signal, phaseProfil) {
      const warm = {
        participants: 30,
        durationMs: phaseProfil.warmupMs,
        rampMs: Math.min(5000, phaseProfil.warmupMs / 4),
        revealAtMs: phaseProfil.warmupMs - 4000,
      };
      const warmup = await phase(lauf, signal, warm, 'warmup');
      if (!warmup.complete) return { ...warmup, errorCode: 'WARMUP_INCOMPLETE' };
      const measurement = await phase(lauf, signal, phaseProfil, 'measurement');
      return { ...measurement, warmup };
    },
    async wiederherstellen() {
      if (!angelegt) return { verified: true, state: 'unchanged' };
      await compose('stop', 'app');
      await proxy?.close();
      proxy = undefined;
      aufbau = await schreiben('V1');
      const spacyId = await compose('--profile', 'nlp', 'ps', '-aq', 'spacy');
      if (spacyId) await docker(['update', '--cpus', '1.0', spacyId]);
      await compose('--profile', 'nlp', 'stop', 'spacy');
      await compose(
        'up',
        '-d',
        '--no-deps',
        '--force-recreate',
        '--wait',
        '--wait-timeout',
        '180',
        'app',
      );
      await pruefeZustand('V1');
      if (spacyId) {
        const info = JSON.parse(await docker(['inspect', spacyId]))[0];
        if (info.State.Running || info.HostConfig.NanoCpus !== 1000000000)
          throw new Error('spaCy-Baseline nicht wiederhergestellt.');
      }
      const session = await createArtillery500Session(trpcUrl);
      const client = createHttpTrpcSingle(trpcUrl);
      const joined = await client.session.join.mutate({
        code: session.code,
        nickname: 'Rollback',
        anonymousClientId: randomUUID(),
        joinIdempotencyKey: randomUUID(),
      });
      const host = createHttpTrpcSingle(trpcUrl, session.hostToken);
      const antwort = await host.wordCloud.analyzeQa.mutate({
        sessionCode: session.code,
        mode: 'LEXICAL',
        locale: 'de',
        metric: 'TOP',
        normalization: 'LEMMA',
        limit: 500,
        filter: 'ALL_ELIGIBLE',
        refresh: true,
      });
      return {
        verified: Boolean(joined.rejoinToken) && antwort.normalizationApplied !== 'LEMMA',
        state: 'NLP_DISABLED',
        liveJoinVerified: Boolean(joined.rejoinToken),
      };
    },
    async speichern(lauf, report) {
      report.manifest ??= {
        ...lauf,
        labAlias: config.labAlias,
        baselineCommit: config.baselineCommit,
        toolsCommit: revision,
        toolsSha256,
        images,
        orderSeed: config.orderSeed,
        fixtureSha256: hashResourceIsolationFixture(fixture),
      };
      if (!report.complete) report.failedStage = stage;
      await schreibeLaufNachweis(evidenceRoot, lauf, report);
    },
    async close() {
      await proxy?.close();
      if (angelegt) await compose('--profile', 'nlp', 'down', '--volumes', '--remove-orphans');
      await rm(privat, { recursive: true, force: true });
    },
  };

  async function phase(lauf, signal, phaseProfil, kind) {
    process.stdout.write(
      `${lauf.variant}/${lauf.run}: ${kind === 'warmup' ? 'Aufwärmung' : 'Messfenster'} vorbereiten\n`,
    );
    const resolvedCompose = bereinigeCompose(
      JSON.parse(await compose('--profile', 'nlp', 'config', '--format', 'json')),
    );
    stage = `${kind.toUpperCase()}_SESSIONS`;
    const dir = await mkdtemp(join(privat, `${kind}-`));
    const session = await createArtillery500Session(trpcUrl);
    await writeFile(join(dir, 'session.json'), JSON.stringify({ ...session, trpcUrl, wsUrl }), {
      mode: 0o600,
    });
    const analyses = lauf.variant === 'V0' ? null : await analyseConfig(signal);
    const containers = await Promise.all(
      [
        'app',
        'postgres',
        'redis',
        'pdf-worker',
        ...(['V0', 'V1'].includes(lauf.variant) ? [] : ['spacy']),
      ].map(async (name) => ({ alias: name, container: await cid(name) })),
    );
    stage = `${kind.toUpperCase()}_CGROUP`;
    const testwert = await erstelleContainerMetriken({ containers, uhr: versuchsUhr }).sample(
      'BEFORE',
      signal,
    );
    if (
      !testwert.containers.every(
        (eintrag) =>
          eintrag.available &&
          eintrag.cgroup.available &&
          Object.values(eintrag.cgroup.metrics).every((metrik) => metrik.available),
      )
    )
      throw new Error(
        'Erforderliche Docker-/cgroup-Metriken sind auf dem Lastgenerator nicht zugänglich.',
      );
    const child = fork(
      fileURLToPath(new URL('./resource-isolation-live.mjs', import.meta.url)),
      [dir],
      { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] },
    );
    const beendet = new Promise((fertig) =>
      child.once('exit', (code, exitSignal) => fertig({ code, signal: exitSignal })),
    );
    let live;
    let windowRuntime;
    let windowClosedAtMs;
    child.on('message', (nachricht) => {
      if (nachricht.windowRuntime) {
        windowRuntime = nachricht.windowRuntime;
        windowClosedAtMs = nachricht.windowClosedAtMs;
      }
      if (nachricht.lifecycle || nachricht.errorCode) live = nachricht;
    });
    try {
      stage = `${kind.toUpperCase()}_READY`;
      await Promise.race([
        new Promise((fertig) => child.once('message', fertig)),
        beendet.then(() => {
          throw new Error('Lastprozess vorzeitig beendet.');
        }),
        versuchsUhr.waitUntil(versuchsUhr.now() + 15000, signal).then(() => {
          throw new Error('Lastprozess nicht bereit.');
        }),
      ]);
      const startAtMs = versuchsUhr.now() + 5000;
      const collector = erstelleContainerMetriken({ containers, uhr: versuchsUhr, startAtMs });
      const startAt = new Date(Date.now() + 5000).toISOString();
      const diagnostics = [await diagnose('BEFORE', startAtMs)];
      const dienstmanifest = await pruefeZustand(lauf.variant);
      pruefeManifestAbgleich(resolvedCompose, { services: dienstmanifest });
      child.send({ ...phaseProfil, startAtMs });
      process.stdout.write(
        `${lauf.variant}/${lauf.run}: ${kind === 'warmup' ? 'Aufwärmung' : 'Messfenster'} ${phaseProfil.durationMs / 1000} Sekunden\n`,
      );
      stage = `${kind.toUpperCase()}_WINDOW`;
      const ergebnisse = await Promise.allSettled([
        sammleContainerMetriken({
          collector,
          durationMs: phaseProfil.durationMs,
          startAtMs,
          signal,
          uhr: versuchsUhr,
        }),
        analyses
          ? fuehreHostAnalyseAus(
              { ...analyses, durationMs: phaseProfil.durationMs },
              { startAtMs, signal, uhr: versuchsUhr },
            )
          : Promise.resolve(null),
        (async () => {
          await versuchsUhr.waitUntil(startAtMs + phaseProfil.durationMs / 2, signal);
          diagnostics.push(await diagnose('DURING', startAtMs));
          await versuchsUhr.waitUntil(startAtMs + phaseProfil.durationMs, signal);
          diagnostics.push(await diagnose('AFTER', startAtMs));
        })(),
        Promise.race([
          beendet,
          versuchsUhr.waitUntil(startAtMs + phaseProfil.durationMs + 60000, signal).then(() => {
            throw new Error('Live-Auslaufzeit überschritten.');
          }),
        ]),
      ]);
      const resources =
        ergebnisse[0].status === 'fulfilled' ? ergebnisse[0].value : collector.summary();
      const analysis = ergebnisse[1].status === 'fulfilled' ? ergebnisse[1].value : null;
      let runtime = {};
      try {
        runtime = JSON.parse(await readFile(join(dir, 'runtime.json'), 'utf8'));
      } catch {
        /* Fehlende Stichproben bleiben unvollständig. */
      }
      const liveActions = fasseLiveMessungenZusammen(windowRuntime ?? runtime, {
        participants: phaseProfil.participants,
      });
      const nachher = await pruefeZustand(lauf.variant).catch(() => null);
      const toolsSha256After = await werkzeugHash().catch(() => null);
      const generationenStabil = Object.keys(dienstmanifest).every(
        (name) => dienstmanifest[name].containerPseudonym === nachher?.[name]?.containerPseudonym,
      );
      const normalisierung =
        diagnostics.at(-1).qaWordCloud.sidecarCalls - diagnostics[0].qaWordCloud.sidecarCalls;
      const complete =
        !signal.aborted &&
        toolsSha256After === toolsSha256 &&
        ergebnisse.every((ergebnis) => ergebnis.status === 'fulfilled') &&
        generationenStabil &&
        Boolean(windowRuntime) &&
        !live?.lifecycle?.interrupted &&
        live?.lifecycle?.reveal?.succeeded === true &&
        Object.values(liveActions).every((aktion) => aktion.accountingValid) &&
        resources.snapshots.length === resources.plannedSamples &&
        resources.skippedSamples.length === 0 &&
        resources.snapshots.every((snapshot) =>
          snapshot.containers.every(
            (eintrag) =>
              eintrag.available &&
              eintrag.cgroup.available &&
              Object.values(eintrag.cgroup.metrics).every((metrik) => metrik.available) &&
              ['memoryUsage', 'memoryWorkingSet', 'memoryLimit', 'pidsCurrent'].every(
                (name) => eintrag.docker[name]?.available,
              ),
          ),
        ) &&
        resources.snapshots.every((snapshot) =>
          ['memoryTotal', 'memoryAvailable', 'swapTotal', 'swapFree'].every(
            (name) => snapshot.host[name]?.available,
          ),
        ) &&
        (!analysis ||
          (analysis.corpus.verifiedBefore &&
            analysis.corpus.verifiedAfter &&
            analysis.corpus.unchanged)) &&
        (['V0', 'V1'].includes(lauf.variant) || normalisierung > 0);
      return {
        complete,
        resolvedCompose,
        manifest: {
          kind,
          ...(reihe ? { seriesDefinitionSha256: reihe.definitionSha256 } : {}),
          labAlias: config.labAlias,
          baselineCommit: config.baselineCommit,
          toolsCommit: revision,
          toolsSha256,
          toolsSha256After,
          contractVersion: 2,
          contractSha256,
          toolsDirty: Boolean((await exec('git', ['status', '--porcelain'], { cwd: root })).stdout),
          fixtureSha256: hashResourceIsolationFixture(fixture),
          fixtureImport: {
            sqlAssertionsVerified: true,
            analysisSessions: analyses ? 5 : 0,
            perSession: analyses
              ? {
                  participants: fixture.analysis.participantCount,
                  storedQuestions:
                    fixture.analysis.questions.length + fixture.analysis.exclusionControls.length,
                  eligibleQuestions: fixture.analysis.questions.length,
                  exclusionControls: fixture.analysis.exclusionControls.map(({ status }) => status),
                }
              : null,
          },
          orderSeed: config.orderSeed,
          ...lauf,
          profile: phaseProfil,
          startAt,
          generatorLocation: config.generatorLocation,
          hardware: {
            cpus: daemon.NCPU,
            memoryBytes: daemon.MemTotal,
            os: daemon.OperatingSystem,
            kernel: daemon.KernelVersion,
            cgroupVersion: daemon.CgroupVersion,
            dockerVersion: daemon.ServerVersion,
            generatorNodeVersion: process.version,
          },
          services: dienstmanifest,
          composeSha256: sha256(baselineCompose),
          socketMode: lauf.variant === 'V4' ? 'delay-proxy-6000ms' : 'direct',
          workload: 'join-wave-single-process-existing-artillery-functions',
          continuousConcurrencyVerified: false,
        },
        live: {
          ...live,
          windowClosedAtMs,
          actions: liveActions,
          websocket: {
            connections: windowRuntime?.wsConnections ?? 0,
            errors: windowRuntime?.wsErrors ?? 0,
            statusEvents: windowRuntime?.wsStatusEvents ?? 0,
            connectLatency: fasseLaufzeitenZusammen(windowRuntime?.wsConnectDurationMs),
            statusFanoutLatency: fasseLaufzeitenZusammen(windowRuntime?.statusFanoutDurationMs),
          },
          afterDrainActions: fasseLiveMessungenZusammen(runtime, {
            participants: phaseProfil.participants,
          }),
        },
        analysis,
        resources,
        diagnostics,
        sidecarCallsInWindow: normalisierung,
        proxy: proxy ? { scope: 'proxy-lifetime-including-warmup', ...proxy.snapshot() } : null,
      };
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
        await Promise.race([beendet, versuchsUhr.waitUntil(versuchsUhr.now() + 2000)]);
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
          await beendet;
        }
      }
    }
  }
}

async function main(args) {
  if (args.length === 1 && args[0] === '--validate') {
    process.stdout.write(
      `${JSON.stringify({ profile: profil, orderSeed: 438314513, runs: erstelleVersuchsplan(438314513), mode: 'network-free-validation' }, null, 2)}\n`,
    );
    return;
  }
  if (args.length !== 3 || !['--pilot', '--run'].includes(args[0]) || args[1] !== '--config-file')
    throw new Error('Genau --validate oder --pilot/--run mit --config-file verwenden.');
  const config = pruefeVersuchsKonfiguration(JSON.parse(await readFile(args[2], 'utf8')));
  const reihe = config.seriesDefinitionFile
    ? await ladeReihendefinition(config.seriesDefinitionFile)
    : null;
  if (
    reihe &&
    (config.baselineCommit !== reihe.baselineCommit ||
      config.orderSeed !== reihe.orderSeed ||
      !config.evidenceRoot)
  )
    throw new Error('Laborzuordnung und explizite Reihendefinition stimmen nicht überein.');
  const pilot = args[0] === '--pilot';
  const evidenceBase = resolve(
    config.evidenceRoot ?? join(root, 'docs/referat-thema-1/evidenz/1A'),
  );
  const evidenceRoot = pilot ? join(evidenceBase, 'vorlauf') : evidenceBase;
  const identitaet = {
    ...(reihe ? { seriesDefinitionSha256: reihe.definitionSha256 } : {}),
    baselineCommit: config.baselineCommit,
    applicationImage: config.applicationImage,
    spacyImage: config.spacyImage,
    toolsSha256: await werkzeugHash(),
    contractSha256: sha256(
      await readFile(join(root, 'docs/referat-thema-1/1A-experiment-contract.md')),
    ),
    fixtureSha256: hashResourceIsolationFixture(buildResourceIsolationFixture()),
    orderSeed: config.orderSeed,
  };
  if (!pilot) {
    const vorlauf = JSON.parse(
      await readFile(join(evidenceBase, 'vorlauf/abschluss.json'), 'utf8'),
    );
    pruefeVorlaufNachweis(vorlauf, identitaet);
  }
  await mkdir(evidenceRoot, { recursive: true });
  if (reihe) {
    const daten = await readFile(config.seriesDefinitionFile);
    const nachtrag = await readFile(join(root, reihe.addendumFile));
    if (sha256(daten) !== reihe.definitionSha256 || sha256(nachtrag) !== reihe.addendumSha256)
      throw new Error('Reihendefinition vor Beginn verändert.');
    await writeFile(join(evidenceRoot, 'reihendefinition.json'), daten, { flag: 'wx' });
    await writeFile(join(evidenceRoot, 'vorabnachtrag.md'), nachtrag, { flag: 'wx' });
  }
  await writeFile(
    join(evidenceRoot, 'plan.json'),
    `${JSON.stringify({ kind: pilot ? 'pilot' : 'confirmatory', profile: pilot ? vorlaufprofil : profil, runs: erstelleVersuchsplan(config.orderSeed) }, null, 2)}\n`,
    { flag: 'wx' },
  );
  const abbruch = new AbortController();
  const abbrechen = () => abbruch.abort();
  process.on('SIGINT', abbrechen);
  process.on('SIGTERM', abbrechen);
  let labor;
  try {
    labor = await erstelleLabor(config, evidenceRoot, reihe);
    await fuehreVersuchsreiheAus({
      plan: pilot
        ? erstelleVersuchsplan(config.orderSeed).filter((lauf) => lauf.block === 1)
        : erstelleVersuchsplan(config.orderSeed),
      signal: abbruch.signal,
      vorbereiten: (lauf, signal) => {
        process.stdout.write(`${pilot ? 'Vorlauf' : 'Messung'} ${lauf.variant}/${lauf.run}\n`);
        return labor.vorbereiten(lauf, signal);
      },
      messen: (lauf, signal) => labor.messen(lauf, signal, pilot ? vorlaufprofil : profil),
      wiederherstellen: () => labor.wiederherstellen(),
      speichern: (lauf, report) => labor.speichern(lauf, report),
    });
    if (
      reihe &&
      (await ladeReihendefinition(config.seriesDefinitionFile)).definitionSha256 !==
        reihe.definitionSha256
    )
      throw new Error('Reihendefinition während des Versuchs verändert.');
    await writeFile(
      join(evidenceRoot, 'abschluss.json'),
      `${JSON.stringify({ complete: true, ...identitaet }, null, 2)}\n`,
      { flag: 'wx' },
    );
  } finally {
    await labor?.close();
    process.removeListener('SIGINT', abbrechen);
    process.removeListener('SIGTERM', abbrechen);
  }
}

if (await istDirekterAufruf(new URL(import.meta.url))) {
  try {
    await main(process.argv.slice(2));
  } catch (fehler) {
    const dateicodes = ['ENOENT', 'EACCES', 'EPERM', 'EEXIST', 'ENOSPC'];
    const grund =
      fehler instanceof Versuchsfehler
        ? fehler.message
        : dateicodes.includes(fehler?.code)
          ? `Datei-/Zugriffsfehler (${fehler.code}); Laborpfade und Berechtigungen prüfen.`
          : 'Kein freigegebener Detailhinweis verfügbar; bereinigte Laufnachweise prüfen.';
    process.stderr.write(`A1-Versuch nicht vollständig. ${grund} Keine Messwerte ergänzen.\n`);
    process.exitCode = 1;
  }
}
