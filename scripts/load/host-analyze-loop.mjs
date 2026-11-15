#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  AnalyzeQaWordCloudInputSchema,
  AnalyzeQaWordCloudOutputSchema,
  GetQaQuestionsInputSchema,
  QaQuestionsListDTOSchema,
} from '@arsnova/shared-types';
import { createHttpTrpcSingle } from './lib/trpc-runtime.mjs';
import {
  buildResourceIsolationFixture,
  hashResourceIsolationFixture,
} from './lib/resource-isolation-fixture.mjs';
import { writeScenarioReport } from './lib/reporting.mjs';
import { fasseLaufzeitenZusammen } from './lib/artillery-live-messungen.mjs';
import {
  ANALYSE_STANDARDWERTE,
  bestimmeAnalyseFehler,
  erstelleAnalyseZeitplan,
  fuehreAnalyseZeitplanAus,
  monotoneUhr,
} from './lib/host-analyze-loop.mjs';

function messfehler(code) {
  return Object.assign(new Error('Analyseantwort oder Korpus nicht verwendbar.'), {
    messCode: code,
  });
}

export function pruefeAnalyseZuordnung(eingabe) {
  if (!eingabe || typeof eingabe !== 'object')
    throw new Error('Eine Laborzuordnung ist erforderlich.');
  let url;
  try {
    url = new URL(eingabe.trpcUrl);
  } catch {
    throw new Error('Eine gültige tRPC-URL ist erforderlich.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.replace(/\/$/, '').endsWith('/trpc')
  ) {
    throw new Error(
      'Die tRPC-URL muss HTTP(S) ohne eingebettete Zugangsdaten, Query oder Fragment verwenden.',
    );
  }
  let fixture;
  try {
    if (!Number.isInteger(eingabe.fixtureSeed)) throw new Error();
    fixture = buildResourceIsolationFixture({ seed: eingabe.fixtureSeed });
  } catch {
    throw new Error('Die Laborzuordnung benötigt einen gültigen Fixture-Seed.');
  }
  if (eingabe.fixtureSha256 !== hashResourceIsolationFixture(fixture)) {
    throw new Error(
      'Der Fixture-Hash der Laborzuordnung stimmt nicht mit der erzeugten Fixture überein.',
    );
  }
  const optionen = Object.fromEntries(
    Object.entries(ANALYSE_STANDARDWERTE).map(([name, standard]) => [
      name,
      eingabe[name] ?? standard,
    ]),
  );
  if (!Array.isArray(optionen.offsetsMs) || optionen.offsetsMs.length !== 5) {
    throw new Error('Für den A1-Analyseplan sind fünf Host-Versätze erforderlich.');
  }
  erstelleAnalyseZeitplan(optionen);
  if (
    optionen.durationMs <= Math.max(...optionen.offsetsMs) ||
    !Number.isSafeInteger(optionen.drainMs) ||
    optionen.drainMs < 0 ||
    optionen.drainMs > 60000 ||
    !Number.isSafeInteger(optionen.requestTimeoutMs) ||
    optionen.requestTimeoutMs < 1 ||
    optionen.requestTimeoutMs > 2_147_483_647
  ) {
    throw new Error('Ungültige Messdauer, Auslaufzeit oder Anfragefrist.');
  }
  if (!Array.isArray(eingabe.sessions) || eingabe.sessions.length !== 5) {
    throw new Error('Fünf getrennte Analysesessions sind erforderlich.');
  }
  const sessions = eingabe.sessions.map((session) => {
    if (
      !session ||
      typeof session.hostToken !== 'string' ||
      !session.hostToken.trim() ||
      /[\r\n]/.test(session.hostToken) ||
      typeof session.sessionCode !== 'string'
    ) {
      throw new Error('Jede Analysesession benötigt einen gültigen Host-Token und Session-Code.');
    }
    const sessionCode = session.sessionCode.trim().toUpperCase();
    const sessionId =
      typeof session.sessionId === 'string' ? session.sessionId.toLowerCase() : session.sessionId;
    const analyse = AnalyzeQaWordCloudInputSchema.safeParse({
      sessionCode,
      mode: 'LEXICAL',
      locale: 'de',
      metric: 'TOP',
      normalization: 'LEMMA',
      limit: 500,
      filter: 'ALL_ELIGIBLE',
      refresh: true,
    });
    const liste = GetQaQuestionsInputSchema.safeParse({
      sessionId,
      moderatorView: true,
      sort: 'TOP',
      statuses: ['ACTIVE', 'PINNED'],
      pageSize: 500,
    });
    if (!analyse.success || !liste.success)
      throw new Error('Ungültige Session-Zuordnung für Analyse und Korpusprüfung.');
    return {
      sessionId,
      sessionCode,
      hostToken: session.hostToken,
      analyse: analyse.data,
      liste: liste.data,
    };
  });
  for (const feld of ['sessionId', 'sessionCode', 'hostToken'])
    if (new Set(sessions.map((session) => session[feld])).size !== 5) {
      throw new Error(
        'Analysesessions, Session-Codes und Host-Tokens müssen jeweils unterschiedlich sein.',
      );
    }
  return { trpcUrl: url.href, sessions, fixture, ...optionen };
}

function pruefeKorpus(antwort, fixture) {
  const schema = QaQuestionsListDTOSchema.safeParse(antwort);
  if (!schema.success) throw messfehler('INVALID_RESPONSE');
  const snapshot = schema.data;
  if (
    snapshot.questions.length !== 500 ||
    snapshot.totalCount !== 500 ||
    snapshot.nextCursor !== null ||
    !/^\d+:TOP:$/.test(snapshot.rankingRevision ?? '')
  )
    throw messfehler('CORPUS_MISMATCH');
  const erwartet = new Map(fixture.analysis.questions.map((frage) => [frage.text, frage]));
  const texte = new Set();
  for (const frage of snapshot.questions) {
    const soll = erwartet.get(frage.text);
    if (
      !soll ||
      texte.has(frage.text) ||
      ['status', 'upvoteCount', 'positiveVoteCount', 'negativeVoteCount'].some(
        (feld) => frage[feld] !== soll[feld],
      )
    )
      throw messfehler('CORPUS_MISMATCH');
    texte.add(frage.text);
  }
  return snapshot.rankingRevision;
}

export async function fuehreHostAnalyseAus(
  eingabe,
  { signal = new AbortController().signal, uhr = monotoneUhr, startAtMs } = {},
) {
  const config = pruefeAnalyseZuordnung(eingabe);
  const clients = config.sessions.map(({ hostToken }) =>
    createHttpTrpcSingle(config.trpcUrl, hostToken),
  );
  const corpus = { verifiedBefore: false, verifiedAfter: false, unchanged: false, checks: [] };
  async function korpusPruefen(phase) {
    return Promise.all(
      clients.map(async (client, hostIndex) => {
        const frist = AbortSignal.timeout(config.requestTimeoutMs);
        try {
          const antwort = await client.qa.list.query(config.sessions[hostIndex].liste, {
            signal: AbortSignal.any([signal, frist]),
          });
          const revision = pruefeKorpus(antwort, config.fixture);
          corpus.checks.push({
            host: `host-${hostIndex + 1}`,
            phase,
            valid: true,
            errorCode: null,
          });
          return revision;
        } catch (fehler) {
          corpus.checks.push({
            host: `host-${hostIndex + 1}`,
            phase,
            valid: false,
            errorCode: signal.aborted
              ? 'ABORTED'
              : frist.aborted
                ? 'TIMEOUT'
                : bestimmeAnalyseFehler(fehler).errorCode,
          });
          return null;
        }
      }),
    );
  }
  const vorher = await korpusPruefen('before');
  corpus.verifiedBefore = vorher.every((revision) => revision !== null);
  let analysis;
  if (corpus.verifiedBefore && !signal.aborted) {
    const hashes = new Map();
    analysis = await fuehreAnalyseZeitplanAus({
      ...config,
      signal,
      uhr,
      startAtMs,
      aufrufen: async ({ hostIndex, signal: aufrufsignal }) => {
        const antwort = await clients[hostIndex].wordCloud.analyzeQa.mutate(
          config.sessions[hostIndex].analyse,
          { signal: aufrufsignal },
        );
        const validiert = AnalyzeQaWordCloudOutputSchema.safeParse(antwort);
        if (!validiert.success) throw messfehler('INVALID_RESPONSE');
        const daten = validiert.data;
        if (
          daten.eligibleQuestionCount !== 500 ||
          daten.analyzedQuestionCount !== 500 ||
          daten.corpusRevision !== `${vorher[hostIndex].split(':')[0]}:` ||
          (hashes.has(hostIndex) && hashes.get(hostIndex) !== daten.snapshotHash)
        )
          throw messfehler('CORPUS_MISMATCH');
        if (
          daten.mode !== 'LEXICAL' ||
          (daten.effectiveMode !== undefined && daten.effectiveMode !== 'LEXICAL') ||
          daten.locale !== 'de' ||
          daten.metric !== 'TOP' ||
          daten.sortMode !== 'TOP' ||
          daten.filter !== 'ALL_ELIGIBLE' ||
          daten.normalization !== 'LEMMA' ||
          !['ready', 'fallback'].includes(daten.status) ||
          (daten.normalizationApplied === 'LEMMA' &&
            (daten.normalizationFallbackUsed || daten.normalizationFallbackReason !== null)) ||
          (daten.normalizationApplied === 'NONE' &&
            (!daten.normalizationFallbackUsed || daten.normalizationFallbackReason === null))
        ) {
          throw messfehler('INVALID_RESPONSE');
        }
        hashes.set(hostIndex, daten.snapshotHash);
        return {
          normalizationApplied: daten.normalizationApplied,
          normalizationFallbackReason: daten.normalizationFallbackReason,
          fallback:
            daten.normalizationFallbackUsed || daten.fallbackUsed || daten.status === 'fallback',
        };
      },
    });
    if (!signal.aborted) {
      const nachher = await korpusPruefen('after');
      corpus.verifiedAfter = nachher.every((revision) => revision !== null);
      corpus.unchanged =
        corpus.verifiedAfter &&
        !analysis.counts.CORPUS_MISMATCH &&
        !analysis.calls.some(({ cleanupErrorCode }) => cleanupErrorCode === 'CORPUS_MISMATCH') &&
        vorher.every((revision, index) => revision === nachher[index]);
    }
  } else {
    const calls = erstelleAnalyseZeitplan(config).map((eintrag) => ({
      ...eintrag,
      outcome: 'NOT_STARTED',
      startedAtMs: null,
      durationMs: null,
      scheduleDelayMs: null,
      errorCode: null,
      normalizationApplied: null,
      normalizationFallbackReason: null,
    }));
    analysis = {
      planned: calls.length,
      started: 0,
      counts: { NOT_STARTED: calls.length },
      interrupted: signal.aborted,
      unavailableRate: 1,
      fallbackRateOfResponses: null,
      latency: fasseLaufzeitenZusammen([]),
      calls,
    };
  }
  corpus.checks.sort(
    (links, rechts) =>
      links.phase.localeCompare(rechts.phase) || links.host.localeCompare(rechts.host),
  );
  return {
    fixture: {
      version: config.fixture.fixtureVersion,
      seed: config.fixture.seed,
      sha256: hashResourceIsolationFixture(config.fixture),
    },
    workload: {
      hosts: 5,
      durationMs: config.durationMs,
      intervalMs: config.intervalMs,
      offsetsMs: [...config.offsetsMs],
      drainMs: config.drainMs,
      requestTimeoutMs: config.requestTimeoutMs,
      input: {
        mode: 'LEXICAL',
        locale: 'de',
        metric: 'TOP',
        normalization: 'LEMMA',
        limit: 500,
        refresh: true,
      },
    },
    corpus,
    analysis,
  };
}

async function main(args) {
  let modus;
  let datei;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if ((argument === '--validate' || argument === '--run') && !modus) modus = argument;
    else if (
      argument === '--sessions-file' &&
      !datei &&
      args[index + 1] &&
      !args[index + 1].startsWith('--')
    )
      datei = args[++index];
    else
      throw new Error(
        'Ungültige oder doppelte Option. --validate oder --run mit --sessions-file verwenden.',
      );
  }
  if (modus === '--validate' && !datei) {
    const fixture = buildResourceIsolationFixture();
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'network-free-validation',
          ...ANALYSE_STANDARDWERTE,
          fixture: {
            version: fixture.fixtureVersion,
            seed: fixture.seed,
            sha256: hashResourceIsolationFixture(fixture),
          },
          planned: erstelleAnalyseZeitplan().length,
          calls: erstelleAnalyseZeitplan(),
        },
        null,
        2,
      )}\n`,
    );
    return;
  }
  if (modus !== '--run' || !datei)
    throw new Error('Genau --validate oder --run mit --sessions-file verwenden.');
  let zuordnung;
  try {
    zuordnung = JSON.parse(await readFile(datei, 'utf8'));
  } catch {
    throw new Error('Die Laborzuordnung konnte nicht als JSON gelesen werden.');
  }
  const abbruch = new AbortController();
  const abbrechen = () => abbruch.abort();
  process.once('SIGINT', abbrechen);
  process.once('SIGTERM', abbrechen);
  try {
    const bericht = await fuehreHostAnalyseAus(zuordnung, { signal: abbruch.signal });
    const failures = [];
    if (
      !bericht.corpus.verifiedBefore ||
      !bericht.corpus.verifiedAfter ||
      !bericht.corpus.unchanged
    )
      failures.push('Korpus vor und nach dem Lauf nicht unverändert nachgewiesen.');
    if (bericht.analysis.interrupted) failures.push('Messung durch Signal abgebrochen.');
    await writeScenarioReport({ scenario: 'host-analyze-loop', metrics: bericht, failures });
    process.stdout.write(`${JSON.stringify(bericht, null, 2)}\n`);
    if (failures.length) process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', abbrechen);
    process.removeListener('SIGTERM', abbrechen);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main(process.argv.slice(2));
  } catch {
    process.stderr.write(
      'Das Analysewerkzeug konnte den Aufruf nicht abschließen. Optionen, Laborzuordnung und Schreibrechte prüfen.\n',
    );
    process.exitCode = 1;
  }
}
