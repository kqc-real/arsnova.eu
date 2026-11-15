#!/usr/bin/env node
// 1B-Treiber (ADR 1B-004): legt über die echte tRPC-API eine Q&A-Session mit dem
// Referenzszenario aus 1C an und löst danach n Summary-Aufträge nacheinander aus.
//
//   node treiber.mjs --trpc http://127.0.0.1:3000/trpc --auftraege 10 --out lauf.json
//
// Szenario wie createReferenceScenario (apps/backend/src/__tests__/lib/qa-summary-pg-fixture.ts):
// Frage X von Teilnehmer X, Stimmen ohne die eigene Frage, danach der Referenzstatus.
// Session, Beitritte, Fragen, Stimmen und PIN laufen über die API. Für PENDING gibt es keine
// Host-Aktion; der Treiber setzt es wie die Fixture direkt in der DB (docker exec psql).
// Zwischen zwei Aufträgen wartet er den Cooldown ab, sonst käme das Ergebnis aus dem Cache
// (requestQaSummary in apps/backend/src/lib/qaSummaryQueue.ts). Keine Tokens in der Ausgabe.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import {
  MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1 as RANKING,
  MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1 as TEXTE,
} from '@arsnova/shared-types';
import { createHttpTrpcSingle } from '../../../../scripts/load/lib/trpc-runtime.mjs';
import { configureQaSessionIfNeeded } from '../../../../scripts/load/lib/configure-qa-if-needed.mjs';
import { hostZugang } from './hostzugang.mjs';

const { values: arg } = parseArgs({
  options: {
    trpc: { type: 'string', default: 'http://127.0.0.1:3000/trpc' },
    auftraege: { type: 'string', default: '1' },
    out: { type: 'string' },
    teilnehmer: { type: 'string', default: '200' },
    'pause-ms': { type: 'string', default: '31000' },
    'warte-max-ms': { type: 'string', default: '900000' },
    locale: { type: 'string', default: 'de' },
    'pg-container': { type: 'string', default: 'arsnova-v3-postgres' },
    'pg-user': { type: 'string', default: 'arsnova_user' },
    'pg-db': { type: 'string', default: 'arsnova_v3' },
  },
});
if (!arg.out) throw new Error('--out fehlt');
const auftraege = Number(arg.auftraege);
const teilnehmer = Number(arg.teilnehmer);
const pauseMs = Number(arg['pause-ms']);
const warteMaxMs = Number(arg['warte-max-ms']);
const maxStimmen = Math.max(...RANKING.map((r) => r.positive + r.negative));
if (teilnehmer < maxStimmen + 1) throw new Error(`mindestens ${maxStimmen + 1} Teilnehmende`);

const jetzt = () => new Date().toISOString();
const schlafe = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (text) => process.stderr.write(`${jetzt()} ${text}\n`);

async function szenarioAnlegen() {
  const oeffentlich = createHttpTrpcSingle(arg.trpc);
  const { code, hostToken, hostBrowserCapability, sessionId } =
    await oeffentlich.session.create.mutate({
      type: 'Q_AND_A',
      title: `1B Referenzszenario ${Date.now()}`,
      moderationMode: false,
      qaModerationMode: false,
      quickFeedbackEnabled: false,
      allowCustomNicknames: true,
      nicknameTheme: 'HIGH_SCHOOL',
      anonymousMode: false,
      teamMode: false,
    });
  const host = createHttpTrpcSingle(arg.trpc, hostToken);
  await configureQaSessionIfNeeded(host, code, { qaTitle: '1B Referenzszenario' });

  log(`Session angelegt, ${teilnehmer} Beitritte`);
  const tn = [];
  for (let i = 0; i < teilnehmer; i += 1) {
    const j = await oeffentlich.session.join.mutate({
      code,
      nickname: `Teilnehmer ${String(i + 1).padStart(3, '0')}`,
      anonymousClientId: randomUUID(),
      joinIdempotencyKey: randomUUID(),
    });
    if (!j.rejoinToken) throw new Error(`Beitritt ${i + 1} ohne participant capability`);
    tn.push({
      id: j.participantId,
      trpc: createHttpTrpcSingle(arg.trpc, undefined, undefined, undefined, j.rejoinToken),
    });
  }
  await host.session.startQa.mutate({ code });

  const frageId = {};
  const autor = {};
  for (const [i, t] of TEXTE.entries()) {
    const r = await tn[i].trpc.qa.submit.mutate({
      sessionId,
      participantId: tn[i].id,
      text: t.text,
      idempotencyKey: randomUUID(),
    });
    frageId[t.key] = r.question.id;
    autor[t.key] = i;
  }

  log('Stimmen');
  let stimmen = 0;
  for (const r of RANKING) {
    const waehler = tn.filter((_, i) => i !== autor[r.key]);
    for (let v = 0; v < r.positive + r.negative; v += 1) {
      await waehler[v].trpc.qa.vote.mutate({
        questionId: frageId[r.key],
        participantId: waehler[v].id,
        direction: v < r.positive ? 'UP' : 'DOWN',
      });
      stimmen += 1;
    }
  }

  const pending = [];
  for (const r of RANKING) {
    if (r.status === 'PINNED') {
      await host.qa.moderate.mutate({
        sessionCode: code,
        questionId: frageId[r.key],
        action: 'PIN',
      });
    } else if (r.status === 'PENDING') {
      pending.push(frageId[r.key]);
    } else if (r.status !== 'ACTIVE') {
      throw new Error(`Status ${r.status} nicht vorgesehen`);
    }
  }
  if (pending.length) {
    // Wie createReferenceScenario (prisma.qaQuestion.update); UUIDs aus der API, kein Nutzertext.
    const ids = pending.map((id) => `'${id.replace(/[^0-9a-f-]/g, '')}'`).join(',');
    const out = execFileSync(
      'docker',
      [
        'exec',
        arg['pg-container'],
        'psql',
        '-U',
        arg['pg-user'],
        '-d',
        arg['pg-db'],
        '-tAc',
        `UPDATE "QaQuestion" SET status = 'PENDING' WHERE id IN (${ids}) AND "sessionId" = '${sessionId.replace(/[^0-9a-f-]/g, '')}'`,
      ],
      { encoding: 'utf8' },
    );
    if (out.trim() !== `UPDATE ${pending.length}`) throw new Error(`PENDING-Update: ${out.trim()}`);
  }

  // Kontrolle gegen die Fixture: Status und Stimmen je Frage, wie der Host sie sieht.
  const { questions: liste } = await host.qa.list.query({
    sessionId,
    moderatorView: true,
    sort: 'TOP',
    pageSize: 100,
  });
  for (const r of RANKING) {
    const q = liste.find((x) => x.id === frageId[r.key]);
    if (!q) throw new Error(`Frage ${r.key} fehlt in qa.list`);
    if (q.status !== r.status)
      throw new Error(`Frage ${r.key}: Status ${q.status}, erwartet ${r.status}`);
    // upvoteCount ist der Nettowert (positiv minus negativ), wie net in der Fixture.
    if (q.upvoteCount !== r.net) {
      throw new Error(`Frage ${r.key}: netto ${q.upvoteCount}, Fixture ${r.net}`);
    }
  }
  // Host-Tokens laufen nach 15 min ab; nach 10 min ein neues wie das Frontend (hostzugang.mjs).
  const zugang = hostZugang({
    start: hostToken,
    erneuern: async () => {
      const r = await oeffentlich.session.issueHostAccessToken.mutate({
        code,
        browserCapability: hostBrowserCapability,
      });
      log('Host-Token erneuert');
      return r.hostToken;
    },
    jetztMs: () => performance.now(),
    maxAlterMs: 10 * 60_000,
  });
  let aktuell = { token: hostToken, client: host };
  const hostClient = async () => {
    const token = await zugang();
    if (token !== aktuell.token) aktuell = { token, client: createHttpTrpcSingle(arg.trpc, token) };
    return aktuell.client;
  };
  return { hostClient, sessionId, stimmen };
}

async function auftrag(hostClient, sessionId, index) {
  const requestedAt = jetzt();
  const t0 = performance.now();
  const r0 = await (await hostClient()).qa.requestSummary.mutate({ sessionId, locale: arg.locale });
  const hostReturnMs = Math.round(performance.now() - t0);
  let rt = r0;
  while (rt.result?.status === 'pending' || rt.result === null) {
    if (performance.now() - t0 > warteMaxMs)
      throw new Error(`Auftrag ${index}: kein Endstatus nach ${warteMaxMs} ms`);
    await schlafe(1000);
    rt = await (await hostClient()).qa.summaryRuntime.query({ sessionId });
  }
  const e = rt.result.execution;
  return {
    index,
    requestedAt,
    finishedAt: jetzt(),
    hostReturnMs,
    clientWaitMs: Math.round(performance.now() - t0),
    status: rt.result.status,
    attemptedMode: e.attemptedMode,
    effectiveMode: e.effectiveMode,
    fallbackReason: e.fallback?.reason ?? null,
    fallbackRetry: e.fallback?.retry ?? null,
    snapshotHash: rt.result.snapshotHash,
    modelVersion: rt.result.modelVersion ?? null,
    statements: rt.result.statements.length,
  };
}

const startedAt = jetzt();
const { hostClient, sessionId, stimmen } = await szenarioAnlegen();
log(`Szenario fertig: ${TEXTE.length} Fragen, ${stimmen} Stimmen`);
const ergebnisse = [];
for (let i = 1; i <= auftraege; i += 1) {
  if (i > 1) await schlafe(pauseMs);
  log(`Auftrag ${i}/${auftraege}`);
  const r = await auftrag(hostClient, sessionId, i);
  log(`  ${r.status} ${r.effectiveMode} ${r.fallbackReason ?? ''} ${r.clientWaitMs} ms`);
  ergebnisse.push(r);
  writeFileSync(
    arg.out,
    `${JSON.stringify({ startedAt, teilnehmer, fragen: TEXTE.length, stimmen, pauseMs, locale: arg.locale, auftraege: ergebnisse }, null, 2)}\n`,
  );
}
