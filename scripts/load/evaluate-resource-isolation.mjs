#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { erstelleVersuchsplan, istDirekterAufruf } from './lib/resource-isolation-experiment.mjs';
import {
  A1_GRENZEN,
  pruefeLiveAktion,
  vergleicheLiveAktionen,
  fasseAnalyseAufrufeZusammen,
  fasseRessourcenZusammen,
} from './lib/resource-isolation-evaluation.mjs';

import { ladeReihendefinition } from './lib/resource-isolation-series.mjs';
import { pruefeManifestAbgleich } from './lib/resource-isolation-compose.mjs';

const sha256 = (daten) => createHash('sha256').update(daten).digest('hex');
const root = fileURLToPath(new URL('../../', import.meta.url));
const vertragSha = 'f7d3eba4b82a3f3a47c914665ac8a7be4988b9061deff6b857a79d2fcf766ab7';
const standardDefinition = join(
  root,
  'docs/referat-thema-1/specs/2026-11-14-1a-messreihe-main-a19ca70f.json',
);

const aktionszahlen = { join: 500, vote: 500, qaSubmit: 100, blitzlicht: 500 };
const varianten = ['V0', 'V1', 'V2', 'V3', 'V4'];
const profil = {
  participants: 500,
  warmupMs: 60000,
  durationMs: 300000,
  rampMs: 90000,
  revealAtMs: 270000,
};
const warmprofil = { participants: 30, durationMs: 60000, rampMs: 5000, revealAtMs: 56000 };
const fordere = (bedingung, text) => {
  if (!bedingung) throw new Error(text);
};

/** Ausschließlich vollständige, unverändert identifizierte V2-Vertragsdaten lesen. */
export async function leseVersuchsreihe(ordner, reihe) {
  reihe ??= await ladeReihendefinition(standardDefinition);
  const files = [];
  const json = async (pfad) => {
    const daten = await readFile(join(ordner, pfad));
    files.push({ file: pfad, sha256: sha256(daten) });
    return JSON.parse(daten);
  };
  const identity = await json('abschluss.json');
  const fixture = JSON.parse(
    await readFile(join(root, 'scripts/load/fixtures/resource-isolation-v1.manifest.json'), 'utf8'),
  );
  fordere(
    identity.complete === true &&
      identity.baselineCommit === reihe.baselineCommit &&
      identity.contractSha256 === vertragSha &&
      identity.fixtureSha256 === fixture.sha256 &&
      identity.orderSeed === fixture.seed,
    'Vollständiger Abschluss der festgelegten Baseline erforderlich.',
  );
  fordere(
    sha256(await readFile(join(root, 'docs/referat-thema-1/1A-experiment-contract.md'))) ===
      vertragSha,
    'Der vorab festgelegte Vertrag wurde verändert.',
  );
  if (reihe.definitionSha256) {
    fordere(
      identity.seriesDefinitionSha256 === reihe.definitionSha256,
      'Abweichende Reihendefinition im Abschluss.',
    );
    await json('reihendefinition.json');
    fordere(
      files.at(-1).sha256 === reihe.definitionSha256,
      'Gespeicherte Reihendefinition verändert.',
    );
    const nachtrag = await readFile(join(ordner, 'vorabnachtrag.md'));
    fordere(sha256(nachtrag) === reihe.addendumSha256, 'Gespeicherter Vorabnachtrag verändert.');
    files.push({ file: 'vorabnachtrag.md', sha256: sha256(nachtrag) });
  }
  const plan = await json('plan.json');
  fordere(
    plan.kind === 'confirmatory' &&
      isDeepStrictEqual(plan.profile, profil) &&
      isDeepStrictEqual(plan.runs, erstelleVersuchsplan(identity.orderSeed)),
    'Plan oder Lastprofil weicht vom vollständigen Versuchsvertrag ab.',
  );
  const records = [];
  let hardware;
  const images = {};
  for (const lauf of plan.runs) {
    const pfad = `${lauf.variant}/${lauf.run}`;
    const nachweis = await json(`${pfad}/lauf.json`);
    const report = await json(`${pfad}/report.json`);
    fordere(
      nachweis.complete === true &&
        nachweis.rollback?.verified === true &&
        nachweis.rollback.liveJoinVerified === true &&
        report.metrics.complete === true &&
        isDeepStrictEqual(report.metrics.manifest, nachweis.manifest) &&
        isDeepStrictEqual(report.metrics.rollback, nachweis.rollback),
      'Lauf oder Rückwegprüfung unvollständig.',
    );
    const phasen = [];
    for (const [phase, name, anzahl, phaseProfil, kind] of [
      [nachweis, 'ressourcen.json.gz', 151, profil, 'measurement'],
      [nachweis.warmup, 'aufwaermung-ressourcen.json.gz', 31, warmprofil, 'warmup'],
    ]) {
      const m = phase?.manifest;
      fordere(
        phase?.complete === true &&
          m?.kind === kind &&
          m.contractVersion === 2 &&
          ['variant', 'run', 'block', 'position'].every((key) => m[key] === lauf[key]) &&
          ['baselineCommit', 'toolsSha256', 'contractSha256', 'fixtureSha256', 'orderSeed'].every(
            (key) => m[key] === identity[key],
          ) &&
          m.toolsSha256After === identity.toolsSha256 &&
          isDeepStrictEqual(m.profile, phaseProfil),
        'Abweichende Laufidentität, Fixture, Werkzeugrevision oder Reihenfolge.',
      );
      if (reihe.definitionSha256)
        fordere(
          m.seriesDefinitionSha256 === reihe.definitionSha256,
          'Abweichende Reihendefinition in einer Phase.',
        );
      if (reihe.requiresResolvedCompose) {
        const file = kind === 'warmup' ? 'compose-aufwaermung.json' : 'compose-messung.json';
        fordere(
          m.resolvedCompose?.file === file && m.resolvedCompose.mediaType === 'application/json',
          'Compose-Aufnahme fehlt oder ist falsch zugeordnet.',
        );
        const compose = await json(`${pfad}/${file}`);
        fordere(
          files.at(-1).sha256 === m.resolvedCompose.sha256,
          'Compose-Prüfsumme stimmt nicht.',
        );
        pruefeManifestAbgleich(compose, m);
      }
      hardware ??= m.hardware;
      fordere(
        isDeepStrictEqual(hardware, m.hardware) && m.generatorLocation === 'same-host',
        'Die Laborumgebung wurde innerhalb der Reihe verändert.',
      );
      const aliases = [
        'app',
        'postgres',
        'redis',
        'pdf-worker',
        ...(['V0', 'V1'].includes(lauf.variant) ? [] : ['spacy']),
      ];
      fordere(
        isDeepStrictEqual(Object.keys(m.services).sort(), [...aliases].sort()),
        'Abweichende Labordienste.',
      );
      for (const [alias, dienst] of Object.entries(m.services)) {
        images[alias] ??= dienst.imageId;
        fordere(images[alias] === dienst.imageId, 'Dienst-Image innerhalb der Reihe verändert.');
        if (['app', 'pdf-worker'].includes(alias))
          fordere(dienst.imageId === identity.applicationImage, 'Abweichendes Anwendungsimage.');
        if (['app', 'postgres', 'redis'].includes(alias))
          fordere(
            dienst.cpuLimit === null &&
              dienst.memoryLimitBytes === null &&
              dienst.pidsLimit === null,
            'Zusätzliche Limits auf Basisdiensten verändern den Vergleich.',
          );
        if (alias === 'pdf-worker')
          fordere(
            dienst.cpuLimit === 1 &&
              dienst.memoryLimitBytes === 1073741824 &&
              dienst.pidsLimit === reihe.pdfWorkerPidsLimit,
            'Abweichende PDF-Worker-Limits.',
          );
        if (alias === 'spacy')
          fordere(
            dienst.imageId === identity.spacyImage &&
              dienst.cpuLimit === (lauf.variant === 'V3' ? 0.25 : 1) &&
              dienst.memoryLimitBytes === 1073741824 &&
              dienst.pidsLimit === 64,
            'Abweichende spaCy-Limits.',
          );
        if (kind === 'warmup')
          fordere(
            dienst.containerPseudonym === nachweis.manifest.services[alias].containerPseudonym,
            'Container zwischen Aufwärmung und Messung gewechselt.',
          );
      }
      const flags = m.services.app.flags;
      fordere(
        flags.NLP_ENABLED === (['V0', 'V1'].includes(lauf.variant) ? 'false' : 'true') &&
          [
            'QA_NLP_ENABLED',
            'QA_SUMMARY_ENABLED',
            'WORD_CLOUD_SEMANTIC_ENABLED',
            'OPEN_WEIGHT_LLM_ENABLED',
          ].every((key) => flags[key] === 'false') &&
          flags.NLP_TIMEOUT_MS === '5000' &&
          flags.NLP_CACHE_TTL_SECONDS === '1800',
        'Abweichende Analyseschalter.',
      );
      fordere(phase.resources?.artifact?.file === name, 'Ungültiger Ressourcenverweis.');
      const komprimiert = await readFile(join(ordner, pfad, name));
      const hash = sha256(komprimiert);
      fordere(hash === phase.resources.artifact.sha256, 'Ressourcen-Prüfsumme stimmt nicht.');
      files.push({ file: `${pfad}/${name}`, sha256: hash });
      const daten = JSON.parse(gunzipSync(komprimiert));
      fordere(
        daten.snapshots?.length === anzahl &&
          daten.plannedSamples === anzahl &&
          phase.resources.sampleCount === anzahl &&
          daten.skippedSamples.length === 0 &&
          daten.interrupted === false &&
          daten.durationMs === phaseProfil.durationMs &&
          daten.intervalMs === 2000,
        'Ressourcenzeitreihe unvollständig.',
      );
      fordere(
        daten.snapshots.every(
          (s) =>
            isDeepStrictEqual(s.containers.map((c) => c.alias).sort(), [...aliases].sort()) &&
            ['memoryTotal', 'memoryAvailable', 'swapTotal', 'swapFree'].every(
              (key) => s.host[key]?.available === true,
            ),
        ),
        'Erforderliche Host- oder Containermessung fehlt.',
      );
      const resources = fasseRessourcenZusammen(daten);
      fordere(
        isDeepStrictEqual(
          Object.keys(phase.live.actions).sort(),
          Object.keys(aktionszahlen).sort(),
        ) &&
          phase.live.lifecycle.interrupted === false &&
          phase.live.lifecycle.reveal.succeeded === true,
        'Live-Messung oder Ergebnisfreigabe unvollständig.',
      );
      for (const [aktion, geplant] of Object.entries(aktionszahlen)) {
        fordere(
          phase.live.actions[aktion].planned ===
            (kind === 'measurement' ? geplant : (geplant * 30) / 500),
          'Geplante Live-Last verändert.',
        );
        pruefeLiveAktion(phase.live.actions[aktion]);
      }
      if (lauf.variant === 'V0')
        fordere(phase.analysis === null, 'V0 enthält unerwartete Analyse-Last.');
      else {
        const korpus = phase.analysis?.corpus;
        fordere(
          korpus?.verifiedBefore === true &&
            korpus.verifiedAfter === true &&
            korpus.unchanged === true &&
            phase.analysis.analysis.planned === phaseProfil.durationMs / 2000,
          'Analysekorpus oder Zeitplan verändert.',
        );
        fasseAnalyseAufrufeZusammen(phase.analysis.analysis);
      }
      if (!['V0', 'V1'].includes(lauf.variant))
        fordere(phase.sidecarCallsInWindow > 0, 'Sidecar-Aufrufnachweis fehlt.');
      phasen.push({
        resources,
        collectorHost: {
          scope: 'collector-host',
          minAvailableMemoryBytes: Math.min(
            ...daten.snapshots.map((s) => s.host.memoryAvailable.value),
          ),
          minSwapFreeBytes: Math.min(...daten.snapshots.map((s) => s.host.swapFree.value)),
        },
      });
    }
    records.push({
      manifest: nachweis.manifest,
      live: nachweis.live.actions,
      analysis: nachweis.analysis?.analysis ?? null,
      ...phasen[0],
      warmupResources: phasen[1].resources,
      sidecarCallsInWindow: nachweis.sidecarCallsInWindow,
      proxy: nachweis.proxy,
    });
  }
  return { identity, hardware, images, files, records };
}

export function werteVersuchsreiheAus(daten) {
  const runs = daten.records.map((lauf) => ({
    variant: lauf.manifest.variant,
    block: lauf.manifest.block,
    run: lauf.manifest.run,
    live: Object.fromEntries(
      Object.entries(lauf.live).map(([name, aktion]) => [name, pruefeLiveAktion(aktion)]),
    ),
    analysis: lauf.analysis ? fasseAnalyseAufrufeZusammen(lauf.analysis) : null,
    resources: lauf.resources,
    collectorHost: lauf.collectorHost,
    warmupResources: lauf.warmupResources,
    sidecarCallsInWindow: lauf.sidecarCallsInWindow,
    proxy: lauf.proxy,
  }));
  const comparisons = [];
  for (let block = 1; block <= 5; block++) {
    for (const variant of ['V1', 'V2', 'V3', 'V4']) {
      const baselineVariant = variant === 'V1' ? 'V0' : 'V1';
      const basis = daten.records.find(
        (r) => r.manifest.block === block && r.manifest.variant === baselineVariant,
      );
      const kandidat = daten.records.find(
        (r) => r.manifest.block === block && r.manifest.variant === variant,
      );
      for (const action of Object.keys(aktionszahlen))
        comparisons.push({
          block,
          baselineVariant,
          variant,
          action,
          ...vergleicheLiveAktionen(basis.live[action], kandidat.live[action]),
        });
    }
  }
  const hypothese = (auswahl) => {
    const relevant = comparisons.filter((x) => auswahl.includes(x.variant));
    return {
      passed: relevant.every((x) => x.passed),
      totalComparisons: relevant.length,
      failedComparisons: relevant.filter((x) => !x.passed).length,
      failedBlocks: [...new Set(relevant.filter((x) => !x.passed).map((x) => x.block))],
    };
  };
  const normal = runs.filter((r) => r.variant === 'V2');
  const hypotheses = { H1: hypothese(['V2']), H2: hypothese(['V3', 'V4']) };
  const normalOperation = {
    analysisAvailabilityPassed: normal.every((r) => r.analysis.availabilityPassed),
    throttlingPassed: normal.every(
      (r) => r.resources.find((c) => c.alias === 'spacy').throttlingPassed,
    ),
    memoryPassed: normal.every((r) => r.resources.find((c) => c.alias === 'spacy').memoryPassed),
    oomPassed: runs.every((r) => r.resources.every((c) => c.oomPassed)),
    voteTargetPassed: runs.every((r) => r.live.vote.voteTargetPassed),
  };
  return {
    schemaVersion: 1,
    source: {
      identity: daten.identity,
      hardware: daten.hardware,
      images: daten.images,
      files: daten.files,
    },
    thresholds: A1_GRENZEN,
    hypotheses,
    normalOperation,
    activationSupported:
      hypotheses.H1.passed && hypotheses.H2.passed && Object.values(normalOperation).every(Boolean),
    runs,
    comparisons,
  };
}

const format = (wert, stellen = 2) => (wert === null ? 'nicht verfügbar' : wert.toFixed(stellen));
const prozent = (wert) => (wert === null ? 'nicht verfügbar' : `${format(wert * 100)} %`);
const status = (bestanden) => (bestanden ? 'erfüllt' : 'nicht erfüllt');

export function erstelleAuswertungsMarkdown(auswertung) {
  const zeilen = [
    '# A1-Auswertung der vollständigen Versuchsreihe',
    '',
    `Baseline: \`${auswertung.source.identity.baselineCommit}\`; fünf gepaarte Blöcke, 25 Läufe.`,
    '',
    `**H1: ${auswertung.hypotheses.H1.passed ? 'bestätigt' : 'nicht bestätigt'}**; ${auswertung.hypotheses.H1.failedComparisons} von 20 Aktionsvergleichen verfehlen mindestens eine Regel.`,
    `**H2: ${auswertung.hypotheses.H2.passed ? 'bestätigt' : 'nicht bestätigt'}**; ${auswertung.hypotheses.H2.failedComparisons} von 40 Aktionsvergleichen verfehlen mindestens eine Regel.`,
    '',
    'Alle fünf Wiederholungen müssen die Regeln einhalten. Nicht bestandene Vergleiche werden weder entfernt noch gemittelt.',
    '',
    '## Live-Perzentile je Lauf',
    '',
    '| Variante | Block | Beitritt p95 ms | Quiz p95 ms | Q&A p95 ms | Tempo p95 ms | Fehler / geplante Aktionen |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const v of varianten)
    for (const r of auswertung.runs.filter((x) => x.variant === v)) {
      zeilen.push(
        `| ${v} | ${r.block} | ${Object.keys(aktionszahlen)
          .map((k) => format(r.live[k].p95Ms))
          .join(
            ' | ',
          )} | ${Object.values(r.live).reduce((s, a) => s + a.failed, 0)} / ${Object.values(r.live).reduce((s, a) => s + a.planned, 0)} |`,
      );
    }
  zeilen.push(
    '',
    '## Gepaarte Aktionsvergleiche',
    '',
    '| Block | Vergleich | Aktion | Basis p95 ms | Kandidat p95 ms | Änderung ms | Änderung relativ | ≤ 10 % | ≤ 50 ms | Gesamt |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const x of auswertung.comparisons)
    zeilen.push(
      `| ${x.block} | ${x.baselineVariant} → ${x.variant} | ${x.action} | ${format(x.baseline.p95Ms)} | ${format(x.candidate.p95Ms)} | ${format(x.absoluteChangeMs)} | ${prozent(x.relativeChange)} | ${status(x.relativePassed)} | ${status(x.absolutePassed)} | ${status(x.passed)} |`,
    );
  zeilen.push(
    '',
    '## Analyseverfügbarkeit',
    '',
    '| Variante | Block | Geplant | Erfolg | Fallback | Ohne Abschluss im Fenster | Unverfügbar | Erfolg p95 ms | Fallback p95 ms |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const v of varianten.filter((x) => x !== 'V0'))
    for (const r of auswertung.runs.filter((x) => x.variant === v)) {
      const a = r.analysis;
      zeilen.push(
        `| ${v} | ${r.block} | ${a.planned} | ${a.outcomes.SUCCESS ?? 0} | ${a.outcomes.FALLBACK ?? 0} | ${a.outcomes.IN_FLIGHT_AT_END ?? 0} | ${prozent(a.unavailableRate)} | ${format(a.successLatency.p95Ms)} | ${format(a.fallbackLatency.p95Ms)} |`,
      );
    }
  zeilen.push(
    '',
    '## spaCy-Ressourcen im Messfenster',
    '',
    '| Variante | Block | CPU % einer CPU | Gedrosselte Perioden | Anteil | Abgetastetes RAM-Maximum MiB | Lebenszeit-Peak MiB | OOM-Zuwachs |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const v of ['V2', 'V3', 'V4'])
    for (const r of auswertung.runs.filter((x) => x.variant === v)) {
      const c = r.resources.find((x) => x.alias === 'spacy');
      zeilen.push(
        `| ${v} | ${r.block} | ${format(c.cpuPercent)} | ${c.throttledDelta} / ${c.periodsDelta} | ${prozent(c.throttledPeriodRatio)} | ${format(c.sampledPeakMemoryBytes / 1048576)} | ${format(c.lifetimePeakMemoryBytes / 1048576)} | ${c.oomKillDelta} |`,
      );
    }
  zeilen.push(
    '',
    '## Regeln für den Normalbetrieb',
    '',
    ...Object.entries(auswertung.normalOperation).map(
      ([regel, bestanden]) => `- \`${regel}\`: ${status(bestanden)}.`,
    ),
    '',
    `**Aktivierung durch alle vorab festgelegten Regeln gedeckt: ${auswertung.activationSupported ? 'ja' : 'nein'}.**`,
    '',
    'Die inhaltliche Betriebsentscheidung und Grenzen stehen in der begleitenden Auswertungsdokumentation.',
    '',
    '## Berechnung und Grenzen',
    '',
    'Perzentile werden aus erfolgreichen Rohstichproben je Lauf neu berechnet (Nearest Rank). Relative und absolute Grenze gelten gleichzeitig und einschließlich Gleichheit; geprüft wird vor der Anzeige-Rundung. Die Abdeckung verwendet alle geplanten Aktionen.',
    '',
    'CPU- und Drosselungswerte sind Zählerdifferenzen derselben Generation im Messfenster. Der RAM-Lebenszeit-Peak umfasst auch die Aufwärmung; er wird nicht von einem früheren Peak subtrahiert. Sämtliche Containerressourcen stehen zusätzlich in auswertung.json.',
    '',
    'IN_FLIGHT_AT_END bleibt trotz späterem cleanup-Erfolg unverfügbar. V4-Proxyzähler umfassen die Proxy-Lebenszeit einschließlich Aufwärmung; Backend-Aufrufzähler sind kein Nachweis tatsächlich an spaCy weitergeleiteter Berechnungen.',
    '',
    'Lastgenerator und Dienste teilen denselben WSL2-Rechner mit 16 logischen CPUs. Die Beitrittswelle belegt keine dauerhafte Parallelität, keine Browser-Renderingzeit und keine Tragfähigkeit zusätzlicher LLM-Inferenz.',
    '',
  );
  return zeilen.join('\n');
}

async function main(args) {
  let reihe = await ladeReihendefinition(standardDefinition);
  const position = args.indexOf('--series-file');
  if (position !== -1) {
    fordere(
      position === args.length - 2,
      '--series-file verlangt genau einen abschließenden Dateipfad.',
    );
    reihe = await ladeReihendefinition(args[position + 1]);
    args = args.slice(0, position);
  }
  if (args.length === 1 && args[0] === '--validate') {
    process.stdout.write(
      `${JSON.stringify({ contractSha256: vertragSha, baselineCommit: reihe.baselineCommit, ...(reihe.definitionSha256 ? { seriesDefinitionSha256: reihe.definitionSha256 } : {}), thresholds: A1_GRENZEN }, null, 2)}\n`,
    );
    return;
  }
  fordere(
    args.length === 5 &&
      args[0] === '--run' &&
      args[1] === '--evidence-root' &&
      args[3] === '--output-dir',
    'Genau --validate oder --run --evidence-root … --output-dir … verwenden.',
  );
  const auswertung = werteVersuchsreiheAus(await leseVersuchsreihe(args[2], reihe));
  const { format: formatiere, resolveConfig } = await import('prettier');
  const formatierung = await resolveConfig(join(root, 'package.json'));
  auswertung.evaluationSha256 = sha256(
    Buffer.concat(
      await Promise.all([
        readFile(new URL(import.meta.url)),
        readFile(new URL('./lib/resource-isolation-evaluation.mjs', import.meta.url)),
      ]),
    ),
  );
  await mkdir(args[4]);
  await writeFile(
    join(args[4], 'auswertung.json'),
    await formatiere(JSON.stringify(auswertung), { ...formatierung, parser: 'json' }),
    {
      flag: 'wx',
    },
  );
  await writeFile(
    join(args[4], 'auswertung.md'),
    await formatiere(erstelleAuswertungsMarkdown(auswertung), {
      ...formatierung,
      parser: 'markdown',
    }),
    {
      flag: 'wx',
    },
  );
  const csv = [
    'Block;Basis;Variante;Aktion;Basis_p95_ms;Kandidat_p95_ms;Aenderung_ms;Aenderung_relativ;Relative_Grenze;Absolute_Grenze;Gesamt',
  ];
  for (const x of auswertung.comparisons)
    csv.push(
      [
        x.block,
        x.baselineVariant,
        x.variant,
        x.action,
        x.baseline.p95Ms,
        x.candidate.p95Ms,
        x.absoluteChangeMs,
        x.relativeChange ?? '',
        x.relativePassed,
        x.absolutePassed,
        x.passed,
      ].join(';'),
    );
  await writeFile(join(args[4], 'live-vergleiche.csv'), `${csv.join('\n')}\n`, { flag: 'wx' });
  process.stdout.write(
    '25 Läufe vollständig ausgewertet; Grenzverletzungen bleiben in JSON, CSV und Markdown erhalten.\n',
  );
}

if (await istDirekterAufruf(new URL(import.meta.url))) {
  try {
    await main(process.argv.slice(2));
  } catch {
    process.stderr.write(
      'A1-Auswertung fehlgeschlagen: vollständige unveränderte Nachweise und einen neuen Ausgabeordner prüfen.\n',
    );
    process.exitCode = 1;
  }
}
