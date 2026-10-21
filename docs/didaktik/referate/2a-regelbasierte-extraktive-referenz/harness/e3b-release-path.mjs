#!/usr/bin/env node
/* global Buffer, clearInterval, console, performance, process, setInterval, setTimeout */
/**
 * E3b – Release-Pfad des extraktiven Q&A-Summary-Fallbacks (In-Process-App-Queue).
 *
 * Treibt ein laufendes, lokal gestartetes arsnova-Backend (127.0.0.1) über die echte
 * tRPC-API: Session (Q&A, Vorab-Moderation an) → 200 Joins → sechs Referenzfragen
 * (Issue #456 §12) → APPROVE/PIN → exakte Stimmverteilung → Score-Verifikation →
 * qa.summaryContextPreview → wiederholte qa.requestSummary/qa.summaryRuntime-Läufe.
 * Nebenläufig: CPU%/RSS des Backendprozesses aus /proc (200 ms).
 *
 * Usage:
 *   node e3b-release-path.mjs --condition C1 --pid <backendPid> --log <backendLog> --out <json>
 *
 * Läuft ausschließlich gegen 127.0.0.1; ändert keine Repo-Dateien.
 */
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createHttpTrpcSingle } from '../../../../../scripts/load/lib/trpc-runtime.mjs';
import { configureQaSessionIfNeeded } from '../../../../../scripts/load/lib/configure-qa-if-needed.mjs';
import { waitForBackend } from '../../../../../scripts/load/lib/wait-for-backend.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (acc, cur, i, arr) => (cur.startsWith('--') ? [...acc, [cur.slice(2), arr[i + 1]]] : acc),
      [],
    ),
);
const CONDITION = args.condition ?? 'C1';
const BACKEND_PID = Number(args.pid);
const BACKEND_LOG = args.log;
const OUT = args.out;
const TRPC_URL = 'http://127.0.0.1:3000/trpc';
const N = 200;
const RUNS = Number(args.runs ?? 10);
const POLL_MS = 25;
const COOLDOWN_WAIT_MS = 31_000; // QA_SUMMARY_COOLDOWN_MS default 30 s + Puffer
const CIRCUIT_WAIT_MS = 31_000; // OPEN_WEIGHT_LLM_CIRCUIT_OPEN_MS 30 s + Puffer
const IDLE_BASELINE_MS = 10_000;
const SETTLE_MS = 15_000;
const SAMPLE_MS = 200;
const CLK_TCK = 100;

if (!BACKEND_PID || !BACKEND_LOG || !OUT) {
  console.error('missing --pid/--log/--out');
  process.exit(2);
}

const QUESTIONS = [
  {
    key: 'A',
    text: 'Können wir mehr Beispiele zur linearen Regression bearbeiten?',
    up: 80,
    down: 30,
    topic: 'Lineare Regression – mehr Beispiele',
  },
  {
    key: 'B',
    text: 'Gibt es ein weiteres Beispiel zur linearen Regression?',
    up: 10,
    down: 0,
    topic: 'Lineare Regression – Beispiel (Paraphrase zu A)',
  },
  {
    key: 'C',
    text: 'Ist Kapitel 4 klausurrelevant?',
    up: 30,
    down: 0,
    pin: true,
    topic: 'Prüfungsorganisation – Kapitel 4',
  },
  {
    key: 'D',
    text: 'Müssen wir den vierten Abschnitt für die Prüfung lernen?',
    up: 12,
    down: 0,
    topic: 'Prüfungsorganisation – Abschnitt 4 (Paraphrase zu C)',
  },
  {
    key: 'E',
    text: 'Soll die Anwesenheit verpflichtend sein?',
    up: 40,
    down: 40,
    topic: 'Anwesenheitspflicht (kontrovers)',
  },
  {
    key: 'F',
    text: 'Sollten wir eine Anwesenheitspflicht einführen?',
    up: 20,
    down: 20,
    topic: 'Anwesenheitspflicht (kontrovers, Paraphrase zu E)',
  },
];

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowMs = () => performance.now();
function percentile(values, p) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}
function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function stats(values) {
  return {
    n: values.length,
    min: values.length ? Math.min(...values) : null,
    median: median(values),
    p95: percentile(values, 95),
    max: values.length ? Math.max(...values) : null,
  };
}
async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await mapper(items[i], i);
      }
    }),
  );
  return results;
}
// Erwartungswerte (Wilson-Untergrenze z=1.96; Kontroversität 2·min/(p+n+T), T=ceil(0.1·N))
function wilsonLower(p, n, z = 1.96) {
  const total = p + n;
  if (total === 0) return 0;
  const phat = p / total;
  const z2 = z * z;
  return (
    (phat + z2 / (2 * total) - z * Math.sqrt((phat * (1 - phat) + z2 / (4 * total)) / total)) /
    (1 + z2 / total)
  );
}
function controversy(p, n, participants) {
  const T = Math.max(1, Math.ceil(participants * 0.1));
  return { score: (2 * Math.min(p, n)) / (p + n + T), T };
}

// ---------- CPU/RSS sampler via /proc ----------
const samples = [];
let currentPhase = 'setup';
let lastTicks = null;
let lastAt = null;
function readProc() {
  const stat = fs.readFileSync(`/proc/${BACKEND_PID}/stat`, 'utf8');
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
  const ticks = Number(fields[11]) + Number(fields[12]); // utime + stime
  const status = fs.readFileSync(`/proc/${BACKEND_PID}/status`, 'utf8');
  const rssKb = Number(status.match(/VmRSS:\s+(\d+)/)?.[1] ?? NaN);
  return { ticks, rssKb };
}
const samplerTimer = setInterval(() => {
  try {
    const at = nowMs();
    const { ticks, rssKb } = readProc();
    if (lastTicks !== null) {
      const cpuPct = ((ticks - lastTicks) / CLK_TCK / ((at - lastAt) / 1000)) * 100;
      samples.push({
        t: Math.round(at),
        from: Math.round(lastAt),
        phase: currentPhase,
        cpuPct: Math.round(cpuPct * 10) / 10,
        rssKb,
      });
    }
    lastTicks = ticks;
    lastAt = at;
  } catch (error) {
    samples.push({ t: Math.round(nowMs()), phase: currentPhase, error: String(error) });
  }
}, SAMPLE_MS);

// ---------- backend log tail ----------
let logOffset = fs.existsSync(BACKEND_LOG) ? fs.statSync(BACKEND_LOG).size : 0;
function readNewLogText() {
  const size = fs.statSync(BACKEND_LOG).size;
  if (size <= logOffset) return '';
  const fd = fs.openSync(BACKEND_LOG, 'r');
  const buf = Buffer.alloc(size - logOffset);
  fs.readSync(fd, buf, 0, buf.length, logOffset);
  fs.closeSync(fd);
  logOffset = size;
  return buf.toString('utf8');
}
// console.info('qa_summary:completed', {...}) wird von util.inspect mehrzeilig ausgegeben.
function parseSummaryLog(text) {
  return [...text.matchAll(/qa_summary:(completed|failed|skipped)\s*(\{[\s\S]*?\})/g)].map((m) => ({
    line: `qa_summary:${m[1]} ${m[2].replace(/\s+/g, ' ')}`,
    event: m[1],
    latencyMs: Number(m[2].match(/latencyMs:\s*(\d+)/)?.[1] ?? NaN),
    fallbackReason: m[2].match(/(?:fallbackReason|reason):\s*'?([\w-]+)'?/)?.[1] ?? null,
  }));
}

// ---------- scenario ----------
const client = (hostToken, cap) =>
  createHttpTrpcSingle(TRPC_URL, hostToken, undefined, undefined, cap);

async function setupScenario() {
  const t = {};
  const publicTrpc = client();
  let t0 = nowMs();
  const created = await publicTrpc.session.create.mutate({
    type: 'Q_AND_A',
    title: `E3b ${CONDITION} ${new Date().toISOString()}`,
    moderationMode: true,
    qaModerationMode: true,
    quickFeedbackEnabled: false,
    allowCustomNicknames: true,
    nicknameTheme: 'HIGH_SCHOOL',
    anonymousMode: false,
    teamMode: false,
  });
  const { code, hostToken, sessionId } = created;
  const host = client(hostToken);
  const qaConfiguration = await configureQaSessionIfNeeded(host, code, {
    qaTitle: 'E3b Referenzszenario',
    moderationMode: true,
  });
  t.createMs = Math.round(nowMs() - t0);

  t0 = nowMs();
  const participants = await mapLimit(
    Array.from({ length: N }, (_, i) => i),
    25,
    async (i) => {
      const joined = await publicTrpc.session.join.mutate({
        code,
        nickname: `TN ${String(i + 1).padStart(3, '0')}`,
        anonymousClientId: randomUUID(),
        joinIdempotencyKey: randomUUID(),
      });
      if (!joined.rejoinToken) throw new Error(`join ${i} ohne rejoinToken`);
      return {
        index: i,
        participantId: joined.participantId,
        trpc: client(undefined, joined.rejoinToken),
      };
    },
  );
  t.joinMs = Math.round(nowMs() - t0);
  const qaStart = await host.session.startQa.mutate({ code });

  // Submit: Frage k durch Teilnehmer k (0..5)
  t0 = nowMs();
  const submitted = [];
  for (let k = 0; k < QUESTIONS.length; k += 1) {
    const q = QUESTIONS[k];
    const author = participants[k];
    const res = await author.trpc.qa.submit.mutate({
      sessionId,
      participantId: author.participantId,
      text: q.text,
      idempotencyKey: randomUUID(),
    });
    submitted.push({
      key: q.key,
      id: res.question.id,
      statusAfterSubmit: res.question.status,
      authorIndex: k,
    });
  }
  t.submitMs = Math.round(nowMs() - t0);

  // Dokumentation: Vote auf PENDING-Frage (erwartet: abgelehnt)
  let pendingVoteProbe;
  try {
    const voter = participants[N - 1];
    const r = await voter.trpc.qa.vote.mutate({
      questionId: submitted[0].id,
      participantId: voter.participantId,
      direction: 'UP',
    });
    pendingVoteProbe = { accepted: true, response: r };
  } catch (error) {
    pendingVoteProbe = {
      accepted: false,
      code: error?.data?.code ?? null,
      message: String(error?.message ?? error).slice(0, 300),
    };
  }

  // Moderation: APPROVE alle, PIN für C
  const moderation = [];
  for (const s of submitted) {
    const q = QUESTIONS.find((x) => x.key === s.key);
    if (s.statusAfterSubmit === 'PENDING') {
      const r = await host.qa.moderate.mutate({
        sessionCode: code,
        questionId: s.id,
        action: 'APPROVE',
      });
      moderation.push({ key: s.key, action: 'APPROVE', status: r.status });
    }
    if (q.pin) {
      const r = await host.qa.moderate.mutate({
        sessionCode: code,
        questionId: s.id,
        action: 'PIN',
      });
      moderation.push({ key: s.key, action: 'PIN', status: r.status });
    }
  }

  // Votes: verschiedene Teilnehmende je Frage, nie der Autor; Pool = Teilnehmer 6..199
  t0 = nowMs();
  const pool = participants.slice(QUESTIONS.length);
  const voteTasks = [];
  QUESTIONS.forEach((q, qi) => {
    const s = submitted[qi];
    const offset = (qi * 37) % pool.length; // Rotation, damit nicht immer dieselben TN
    const voters = Array.from(
      { length: q.up + q.down },
      (_, j) => pool[(offset + j) % pool.length],
    );
    if (new Set(voters.map((v) => v.participantId)).size !== voters.length)
      throw new Error('voter not distinct');
    voters.forEach((v, j) =>
      voteTasks.push({
        key: q.key,
        questionId: s.id,
        voter: v,
        direction: j < q.up ? 'UP' : 'DOWN',
      }),
    );
  });
  const voteResults = await mapLimit(voteTasks, 20, async (task) => {
    try {
      await task.voter.trpc.qa.vote.mutate({
        questionId: task.questionId,
        participantId: task.voter.participantId,
        direction: task.direction,
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, key: task.key, message: String(error?.message ?? error).slice(0, 200) };
    }
  });
  t.voteMs = Math.round(nowMs() - t0);
  const voteFailures = voteResults.filter((r) => !r.ok);

  // Score-Verifikation über Host-Liste
  const list = await host.qa.list.query({
    sessionId,
    moderatorView: true,
    sort: 'TOP',
    pageSize: 100,
  });
  const scoreTable = QUESTIONS.map((q, qi) => {
    const dto = list.questions.find((x) => x.id === submitted[qi].id);
    const expBest = wilsonLower(q.up, q.down);
    const expCon = controversy(q.up, q.down, N);
    const expIsCon = expCon.score > 0.5 && q.up + q.down >= expCon.T;
    return {
      key: q.key,
      text: q.text,
      status: dto?.status ?? null,
      up: q.up,
      down: q.down,
      reported: {
        upvoteCount: dto?.upvoteCount ?? null,
        downvoteCount: dto?.downvoteCount ?? null,
        voteCount: dto?.voteCount ?? null,
        bestScore: dto?.bestScore ?? null,
        controversyScore: dto?.controversyScore ?? null,
        isControversial: dto?.isControversial ?? null,
        controversyInsufficientVotes: dto?.controversyInsufficientVotes ?? null,
      },
      expected: {
        bestScore: Number(expBest.toFixed(4)),
        controversyScore: Number(expCon.score.toFixed(4)),
        isControversial: expIsCon,
        T: expCon.T,
      },
      match:
        dto != null &&
        Math.abs((dto.bestScore ?? -9) - expBest) < 5e-4 &&
        Math.abs((dto.controversyScore ?? -9) - expCon.score) < 5e-4 &&
        dto.isControversial === expIsCon,
    };
  });

  return {
    code,
    sessionId,
    host,
    submitted,
    meta: {
      code,
      sessionId,
      participantsJoined: participants.length,
      qaConfiguredClosesAt: qaConfiguration?.qaClosesAt ?? null,
      qaStartStatus: qaStart?.status ?? null,
      submitted: submitted.map(({ key, id, statusAfterSubmit, authorIndex }) => ({
        key,
        id,
        statusAfterSubmit,
        authorIndex,
      })),
      pendingVoteProbe,
      moderation,
      votes: {
        attempted: voteTasks.length,
        accepted: voteTasks.length - voteFailures.length,
        failures: voteFailures.slice(0, 10),
      },
      hostListTotalCount: list.totalCount ?? null,
      hostListRaw: list.questions,
      scoreTable,
      timings: t,
    },
  };
}

function keyForSourceId(sourceId, submitted) {
  const hit = submitted.find((s) => sourceId.includes(s.id));
  return hit ? hit.key : null;
}

function describeResult(result, submitted) {
  if (!result) return null;
  return {
    status: result.status,
    modelVersion: result.modelVersion ?? null,
    snapshotHash: result.snapshotHash,
    analyzedAt: result.analyzedAt,
    execution: result.execution,
    statements: (result.statements ?? []).map((s) => ({
      text: s.text,
      sourceIds: s.sourceIds,
      questionKeys: s.sourceIds.map((id) => keyForSourceId(id, submitted)),
    })),
    limitations: result.limitations,
    sourcesCount: (result.sources ?? []).length,
  };
}

async function oneRun(ctx, label) {
  const runStartWall = Date.now();
  const tStart = nowMs();
  const pending = await ctx.host.qa.requestSummary.mutate({
    sessionId: ctx.sessionId,
    locale: 'de',
  });
  const tEnq = nowMs();
  let runtime = pending;
  let polls = 0;
  const immediate = runtime.result?.status !== 'pending';
  while (runtime.result?.status === 'pending') {
    if (nowMs() - tStart > 120_000) throw new Error('summary timeout 120 s');
    await sleep(POLL_MS);
    runtime = await ctx.host.qa.summaryRuntime.query({ sessionId: ctx.sessionId });
    polls += 1;
  }
  const tTerm = nowMs();
  await sleep(150); // Log-Flush
  const logs = parseSummaryLog(readNewLogText());
  return {
    label,
    startedAt: new Date(runStartWall).toISOString(),
    windowPerf: [Math.round(tStart), Math.round(tTerm)],
    enqueueMs: Math.round((tEnq - tStart) * 10) / 10,
    terminalMs: Math.round((tTerm - tStart) * 10) / 10,
    polls,
    requestReturnedStatus: pending.result?.status ?? null,
    immediateNonPending: immediate,
    runtimeEnvelope: {
      schemaVersion: runtime.schemaVersion,
      enabled: runtime.enabled,
      inferenceConfigured: runtime.inferenceConfigured,
      capabilitiesModes: runtime.capabilities?.modes?.map((m) => m.kind) ?? null,
    },
    effectiveMode: runtime.result?.execution?.effectiveMode ?? null,
    attemptedMode: runtime.result?.execution?.attemptedMode ?? null,
    fallbackMode: runtime.result?.execution?.fallback?.mode ?? null,
    fallbackReason: runtime.result?.execution?.fallback?.reason ?? null,
    fallbackRetry: runtime.result?.execution?.fallback?.retry ?? null,
    serverLog: logs,
    serverLatencyMs: logs.find((l) => l.event === 'completed')?.latencyMs ?? null,
    summary: describeResult(runtime.result, ctx.submitted),
    rawResult: runtime.result,
  };
}

async function main() {
  await waitForBackend(TRPC_URL);
  readNewLogText(); // Offset auf aktuelles Logende
  const startedAt = new Date().toISOString();
  currentPhase = 'setup';
  const ctx = await setupScenario();
  console.error(`[${CONDITION}] setup ok session=${ctx.code}`, JSON.stringify(ctx.meta.timings));

  // Runtime vor der ersten Anfrage + Kontextvorschau
  const runtimeBefore = await ctx.host.qa.summaryRuntime.query({ sessionId: ctx.sessionId });
  let preview;
  try {
    preview = await ctx.host.qa.summaryContextPreview.query({
      sessionId: ctx.sessionId,
      locale: 'de',
    });
  } catch (error) {
    preview = { error: String(error?.message ?? error) };
  }

  // Settle (Hintergrundarbeit nach Setup, z. B. Usage-Events) und Idle-Baseline
  currentPhase = 'settle';
  await sleep(SETTLE_MS);
  readNewLogText();
  currentPhase = 'idle';
  await sleep(IDLE_BASELINE_MS);

  const runs = [];
  const waits = [];
  const doRun = async (label) => {
    currentPhase = 'summary';
    const r = await oneRun(ctx, label);
    currentPhase = 'between';
    runs.push(r);
    console.error(
      `[${CONDITION}] ${label}: ${r.effectiveMode}/${r.fallbackReason} enq=${r.enqueueMs}ms term=${r.terminalMs}ms polls=${r.polls} server=${r.serverLatencyMs} immediate=${r.immediateNonPending}`,
    );
    return r;
  };
  const wait = async (ms, why) => {
    currentPhase = 'wait';
    waits.push({ ms, why, at: new Date().toISOString() });
    await sleep(ms);
    currentPhase = 'between';
  };

  if (CONDITION === 'C1') {
    // Cooldown-Probe: zweite Anfrage unmittelbar nach der ersten
    await doRun('run-01');
    await doRun('cooldown-probe-immediate');
    for (let i = 2; i <= RUNS; i += 1) {
      await wait(COOLDOWN_WAIT_MS, 'QA_SUMMARY_COOLDOWN_MS (30 s) abwarten');
      await doRun(`run-${String(i).padStart(2, '0')}`);
    }
  } else {
    // Burst: 10 Anfragen direkt hintereinander (zeigt Circuit-Breaker)
    for (let i = 1; i <= RUNS; i += 1) await doRun(`burst-${String(i).padStart(2, '0')}`);
    // Spaced: Circuit schließen lassen, dann Läufe sammeln, bis RUNS mit Grundgrund vorliegen
    const primary = CONDITION === 'C2' ? 'unavailable' : 'timeout';
    let collected = runs.filter((r) => r.fallbackReason === primary).length;
    let guard = 0;
    while (collected < RUNS && guard < 40) {
      guard += 1;
      const last = runs[runs.length - 1];
      if (last.fallbackReason === 'circuit_open')
        await wait(CIRCUIT_WAIT_MS, 'OPEN_WEIGHT_LLM_CIRCUIT_OPEN_MS (30 s) abwarten');
      const r = await doRun(`spaced-${String(guard).padStart(2, '0')}`);
      if (r.fallbackReason === primary) collected += 1;
    }
  }

  // Nachlauf-Idle
  currentPhase = 'idle-after';
  await sleep(3000);
  clearInterval(samplerTimer);

  // CPU/RSS-Auswertung
  const okSamples = samples.filter((s) => s.cpuPct !== undefined);
  const overlaps = (s, r) => s.from <= r.windowPerf[1] && s.t >= r.windowPerf[0];
  const summarySamples = okSamples.filter((s) => runs.some((r) => overlaps(s, r)));
  const idleSamples = okSamples.filter((s) => s.phase === 'idle');
  const resource = {
    method:
      '/proc/<pid>/stat utime+stime Δ je 200-ms-Intervall (CLK_TCK=100) und /proc/<pid>/status VmRSS',
    idle: {
      cpuPct: stats(idleSamples.map((s) => s.cpuPct)),
      rssMb: stats(idleSamples.map((s) => s.rssKb / 1024)),
    },
    duringSummaryWindows: {
      note: 'Samples, deren 200-ms-Intervall ein [request-start, terminal]-Fenster überlappt',
      cpuPct: stats(summarySamples.map((s) => s.cpuPct)),
      rssMb: stats(summarySamples.map((s) => s.rssKb / 1024)),
    },
    setup: {
      cpuPct: stats(okSamples.filter((s) => s.phase === 'setup').map((s) => s.cpuPct)),
      rssMb: stats(okSamples.filter((s) => s.phase === 'setup').map((s) => s.rssKb / 1024)),
    },
  };

  const realRuns = runs.filter((r) => !r.immediateNonPending);
  const byReason = {};
  for (const r of runs)
    byReason[r.fallbackReason ?? 'null'] = (byReason[r.fallbackReason ?? 'null'] ?? 0) + 1;
  const latencyByReason = {};
  for (const reason of Object.keys(byReason)) {
    const rs = realRuns.filter((r) => (r.fallbackReason ?? 'null') === reason);
    latencyByReason[reason] = {
      terminalMs: stats(rs.map((r) => r.terminalMs)),
      enqueueMs: stats(rs.map((r) => r.enqueueMs)),
      serverLatencyMs: stats(rs.map((r) => r.serverLatencyMs).filter((x) => Number.isFinite(x))),
      polls: stats(rs.map((r) => r.polls)),
    };
  }

  const output = {
    experiment: 'E3b',
    condition: CONDITION,
    startedAt,
    finishedAt: new Date().toISOString(),
    backendPid: BACKEND_PID,
    pollIntervalMs: POLL_MS,
    scenario: { ...ctx.meta },
    runtimeBefore,
    contextPreview: preview,
    runs,
    waits,
    aggregate: { runs: runs.length, realJobs: realRuns.length, byReason, latencyByReason },
    resource,
    samples,
  };
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.error(`[${CONDITION}] wrote ${OUT}`);
}

main().catch((error) => {
  clearInterval(samplerTimer);
  console.error(error);
  process.exit(1);
});
