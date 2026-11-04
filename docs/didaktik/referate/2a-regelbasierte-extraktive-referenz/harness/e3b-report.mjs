#!/usr/bin/env node
/* global URL, console, process */
/**
 * E3b: führt die Rohdaten der Bedingungen zusammen und schreibt
 * evidence/E3/e3b-<shortcommit>.json und .md.
 * Usage: node e3b-report.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../../..');
const E = path.resolve(HERE, '../evidence/E3');
const commit = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const short = commit.slice(0, 8);
const gitStatus = execFileSync('git', ['-C', REPO, 'status', '--porcelain'], { encoding: 'utf8' });
const cpuModel = os.cpus()[0]?.model ?? 'unknown';

const CONDS = [
  { id: 'C1', name: 'disabled', desc: 'Open-Weight aus, keine Legacy-URL' },
  {
    id: 'C2',
    name: 'unavailable',
    desc: 'Open-Weight an, URL http://[::1]:59999 (nichts lauscht, ECONNREFUSED)',
  },
  {
    id: 'C3',
    name: 'timeout',
    desc: 'Open-Weight an, hängender Stub 127.0.0.1:59998, Queue-Timeout gewinnt (500/1000 ms → effektiv 1000 ms)',
  },
  {
    id: 'C3b',
    name: 'timeout (Client-Timeout < Queue-Timeout)',
    desc: 'wie C3, aber QA_SUMMARY_TIMEOUT_MS=3000 / OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=1000 → Client-Timeout gewinnt',
  },
];

const readEnv = (id) => fs.readFileSync(`${E}/e3b-env-${id}.txt`, 'utf8').trim().split('\n');
const raw = Object.fromEntries(
  CONDS.map((c) => [c.id, JSON.parse(fs.readFileSync(`${E}/e3b-raw-${c.id}.json`, 'utf8'))]),
);

// C2a: abgebrochener Vorlauf (IPv4-Loopback-Blackhole unter WSL2 mirrored networking)
const c2aLog = fs.readFileSync(`${E}/e3b-backend-C2a-ipv4-blackhole.log`, 'utf8');
const c2aRuns = [...c2aLog.matchAll(/qa_summary:(completed)\s*(\{[\s\S]*?\})/g)].map((m) => ({
  fallbackReason: m[2].match(/fallbackReason:\s*'([\w-]+)'/)?.[1] ?? null,
  latencyMs: Number(m[2].match(/latencyMs:\s*(\d+)/)?.[1]),
}));

const stubLog = fs
  .readFileSync(`${E}/e3b-stub-requests.jsonl`, 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l));

const fmt = (x, d = 0) =>
  x === null || x === undefined || Number.isNaN(x) ? '–' : Number(x).toFixed(d);

const combined = {
  experiment: 'E3b – Release-Pfad extraktiver Q&A-Summary-Fallback (In-Process-App-Queue)',
  generatedAt: new Date().toISOString(),
  environment: {
    repo: REPO,
    commit,
    gitStatusPorcelainAtReport: gitStatus,
    node: process.version,
    cpu: `${cpuModel} (${os.cpus().length} logische CPUs, WSL2 ${os.release()})`,
    ramTotalMb: Math.round(os.totalmem() / 1024 / 1024),
    backendStart:
      'node --import tsx apps/backend/src/index.ts (env -i, keine .env-Datei), Postgres 16 + Redis 7.4 via docker compose',
    networkingNote:
      'WSL2 networkingMode=mirrored: TCP-SYN an geschlossene IPv4-Loopback-Ports wird nicht mit RST beantwortet (connect hängt); ::1 liefert sofort ECONNREFUSED.',
  },
  conditions: CONDS.map((c) => ({ ...c, env: readEnv(c.id) })),
  c2aIpv4Blackhole: {
    env: readEnv('C2a-ipv4-blackhole'),
    note: 'Vorlauf vom 21.10.2026 auf a657798e (abgebrochen, 8 Jobs à ~90 s), nicht wiederholt; Werte aus Backend-Log.',
    runs: c2aRuns,
  },
  stubRequests: stubLog,
  raw,
};
fs.writeFileSync(`${E}/e3b-${short}.json`, JSON.stringify(combined, null, 2));

// ---------- Markdown ----------
const L = [];
const p = (s = '') => L.push(s);
p(`# E3b – Release-Pfad des extraktiven Q&A-Summary-Fallbacks (${short})`);
p();
p(`Erzeugt: ${combined.generatedAt} · Rohdaten: \`e3b-${short}.json\``);
p();
p('## Umgebung');
p();
p(`| Feld | Wert |`);
p(`| --- | --- |`);
p(`| Commit | \`${commit}\` |`);
p(
  `| \`git status --porcelain\` | ${gitStatus.trim() === '' ? 'leer (Repo unverändert)' : '`' + gitStatus.trim() + '`'} |`,
);
p(`| Node | ${process.version} |`);
p(`| CPU | ${combined.environment.cpu} |`);
p(`| RAM | ${combined.environment.ramTotalMb} MB |`);
p(`| Backend | ${combined.environment.backendStart} |`);
p(`| Netzwerk | ${combined.environment.networkingNote} |`);
p();
p('## Szenario');
p();
const s1 = raw.C1.scenario;
p(
  `Pro Bedingung eine frische Session (Typ \`Q_AND_A\`, Vorab-Moderation an), N = ${s1.participantsJoined} Teilnehmende, sechs Fragen (je ein anderer Autor), Abstimmung durch disjunkte Teilnehmende ohne Autor; Votes ${s1.votes.accepted}/${s1.votes.attempted} akzeptiert (in allen Bedingungen: ${CONDS.map((c) => `${c.id} ${raw[c.id].scenario.votes.accepted}/${raw[c.id].scenario.votes.attempted}`).join(', ')}).`,
);
p();
p(
  `- Fragen kamen als \`${s1.submitted.map((x) => x.statusAfterSubmit).join('/')}\` an; Vote auf PENDING-Frage A abgelehnt: \`${s1.pendingVoteProbe.code}\` „${s1.pendingVoteProbe.message}“ (erwartet, DB-Trigger 1.3).`,
);
p(`- Moderation: ${s1.moderation.map((m) => `${m.key} ${m.action}→${m.status}`).join(', ')}.`);
p(
  `- Setup-Zeiten C1: create ${s1.timings.createMs} ms, 200 Joins ${s1.timings.joinMs} ms, Submit ${s1.timings.submitMs} ms, 282 Votes ${s1.timings.voteMs} ms.`,
);
p();
p('### Score-Verifikation (Host-Liste `qa.list`, moderatorView, Session C1; C2/C3/C3b identisch)');
p();
p(
  '| Frage | Status | +/− | bestScore (Backend) | erwartet | controversyScore (Backend) | erwartet | isControversial | erwartet | OK |',
);
p('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of s1.scoreTable) {
  p(
    `| ${r.key} | ${r.status} | ${r.up}/${r.down} | ${fmt(r.reported.bestScore, 4)} | ${fmt(r.expected.bestScore, 4)} | ${fmt(r.reported.controversyScore, 4)} | ${fmt(r.expected.controversyScore, 4)} | ${r.reported.isControversial} | ${r.expected.isControversial} | ${r.match ? 'ja' : 'NEIN'} |`,
  );
}
p();
p(
  `Alle Bedingungen: Score-Match ${CONDS.map((c) => `${c.id}=${raw[c.id].scenario.scoreTable.every((r) => r.match)}`).join(', ')}. Erwartung: Wilson-Untergrenze z = 1,96; Kontroversität 2·min(p,n)/(p+n+T), T = ceil(0,1·N) = 20; Label „umstritten“ bei Score > 0,5 und p+n ≥ T.`,
);
p();
p('### Gepackter Kontext (`qa.summaryContextPreview`, de)');
p();
const pv = raw.C1.contextPreview;
const ctx = pv.promptContext.context;
p(
  `- Fragenkorpus: total ${ctx.questions.corpus.total}, eligible ${ctx.questions.corpus.eligible}, analyzed ${ctx.questions.corpus.analyzed}, deduplicated ${ctx.questions.corpus.deduplicated}, represented ${ctx.questions.corpus.represented}; \`selectionLimits.questions\` = ${ctx.scope.selectionLimits.questions}.`,
);
p(
  `- Budget: packedInputTokens ${pv.promptContext.budget.packedInputTokens}/${pv.promptContext.budget.contextWindowTokens}; Kürzungen: ${pv.promptContext.budget.truncations.map((t) => `${t.section} −${t.omittedItems} (${t.reason})`).join('; ')}.`,
);
p(
  `- Quellen im Register (C1, Reihenfolge wie geliefert): ${ctx.sources.map((s) => (s.kind === 'qa-question' ? `${s.kind} »${s.content.text}«` : `${s.kind} „${s.label}“`)).join(' · ')}.`,
);
p(
  `- Kompass-Signale: ${ctx.compass.state === 'available' ? ctx.compass.signals.map((sg) => `${sg.signal} (Wert ${sg.value}, Fragen: ${sg.questionSourceIds.map((id) => s1.submitted.find((q) => id.includes(q.id))?.key).join('+')})`).join('; ') : ctx.compass.state}.`,
);
p(
  `- Vorschau-Modus/Fallback je Bedingung: ${CONDS.map((c) => `${c.id}: selectedMode=${raw[c.id].contextPreview.selectedMode ?? 'null'}, fallback=${raw[c.id].contextPreview.fallback?.reason ?? 'null'}`).join('; ')}.`,
);
p();
p('## Bedingungen und exakte Env');
p();
for (const c of CONDS) {
  p(`### ${c.id} – ${c.name}`);
  p();
  p(c.desc);
  p();
  p('```env');
  for (const line of readEnv(c.id)) p(line);
  p('```');
  p();
}
p(
  '### C2a – Vorlauf „unavailable“ über IPv4-Loopback (abgebrochen; Lauf vom 21.10.2026 auf a657798e, nicht wiederholt)',
);
p();
p(
  'Wie C2, aber `OPEN_WEIGHT_LLM_URL=http://127.0.0.1:59999`. Unter WSL2 (mirrored networking) hängt `connect()` zu einem geschlossenen IPv4-Loopback-Port, statt sofort abgelehnt zu werden. Ergebnis aus dem Backend-Log:',
);
p();
p(
  `- ${c2aRuns.length} Jobs, alle \`fallbackReason: ${[...new Set(c2aRuns.map((r) => r.fallbackReason))].join('/')}\`, latencyMs ${Math.min(...c2aRuns.map((r) => r.latencyMs))}–${Math.max(...c2aRuns.map((r) => r.latencyMs))} (Queue-Timeout = Default 90 000 ms). Kein \`circuit_open\` trotz 8 aufeinanderfolgender Fehlschläge.`,
);
p();
p('## Ergebnisse je Bedingung');
p();
p(
  'Latenz: `enqueue` = Rundlauf `qa.requestSummary`; `terminal` = Start bis erster nicht-`pending`-Runtime (Polling alle 25 ms); `server` = `latencyMs` aus der Logzeile `qa_summary:completed` (Queue-Job inkl. zweifachem Kontextaufbau).',
);
p();
p(
  '| Bedingung | Läufe | effectiveMode | attemptedMode | fallback.reason (Anzahl) | retry | status | enqueue Median/p95 ms | terminal Median/p95 ms | server Median/p95 ms | Polls Median |',
);
p('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const c of CONDS) {
  const o = raw[c.id];
  const real = o.runs.filter((r) => !r.immediateNonPending);
  for (const reason of Object.keys(o.aggregate.byReason)) {
    const rs = real.filter((r) => r.fallbackReason === reason);
    const l = o.aggregate.latencyByReason[reason];
    if (rs.length === 0) continue;
    p(
      `| ${c.id} | ${rs.length} | ${[...new Set(rs.map((r) => r.effectiveMode))].join('/')} | ${[...new Set(rs.map((r) => r.attemptedMode ?? 'null'))].join('/')} | ${reason} (${rs.length}) | ${[...new Set(rs.map((r) => r.fallbackRetry))].join('/')} | ${[...new Set(rs.map((r) => r.summary.status))].join('/')} | ${fmt(l.enqueueMs.median)}/${fmt(l.enqueueMs.p95)} | ${fmt(l.terminalMs.median)}/${fmt(l.terminalMs.p95)} | ${fmt(l.serverLatencyMs.median)}/${fmt(l.serverLatencyMs.p95)} | ${fmt(l.polls.median)} |`,
    );
  }
}
p();
p(
  'Reihenfolge der Gründe (Burst = direkt hintereinander, Spaced = nach 31 s Wartezeit bei `circuit_open`):',
);
p();
for (const c of CONDS) {
  const o = raw[c.id];
  p(
    `- ${c.id}: ${o.runs.map((r) => `${r.label}=${r.immediateNonPending ? 'CACHE(' + r.fallbackReason + ')' : r.fallbackReason}`).join(', ')}`,
  );
}
p();
p('### Extraktive Aussagen (wörtlich) und Quellenzuordnung');
p();
p(
  'Innerhalb jeder Bedingung waren alle Läufe inhaltsgleich (ein snapshotHash, eine Reihenfolge). `modelVersion` = `extractive-v2`, `limitations` = [„Extraktive Kurzfassung ohne generative Interpretation.“], `suggestedNextSteps` = [].',
);
p();
for (const c of CONDS) {
  const o = raw[c.id];
  const r0 = o.runs[0];
  const hashes = new Set(o.runs.map((r) => r.summary.snapshotHash));
  const orders = new Set(
    o.runs.map((r) => r.summary.statements.map((s) => s.questionKeys.join('+')).join(',')),
  );
  p(
    `**${c.id}** (Session ${o.scenario.code}; ${hashes.size} snapshotHash, ${orders.size} Reihenfolge; status ${r0.summary.status}; modelVersion ${r0.summary.modelVersion}; Quellen ${r0.summary.sourcesCount})`,
  );
  p();
  p('| # | Aussage | sourceId | Frage | Thema |');
  p('| --- | --- | --- | --- | --- |');
  r0.summary.statements.forEach((s, i) => {
    const key = s.questionKeys[0];
    const topic =
      {
        A: 'Lineare Regression',
        B: 'Lineare Regression (Paraphrase)',
        C: 'Prüfungsorganisation (PINNED)',
        D: 'Prüfungsorganisation (Paraphrase)',
        E: 'Anwesenheitspflicht (umstritten)',
        F: 'Anwesenheitspflicht (umstritten, Paraphrase)',
      }[key] ?? '?';
    p(`| ${i + 1} | ${s.text} | \`${s.sourceIds[0].slice(0, 22)}…\` | ${key} | ${topic} |`);
  });
  p();
}
p('## CPU / RSS des Backendprozesses');
p();
p(
  'Messung: `/proc/<pid>/stat` (utime+stime-Δ je 200-ms-Intervall, CLK_TCK = 100; 100 % = ein Kern) und `VmRSS`. Idle = 10 s nach 15 s Settle-Phase, ohne Anfragen. „Während Summary“ = Samples, deren 200-ms-Intervall ein Fenster [Request-Start, terminal] überlappt (inkl. Polling-Last des Treibers).',
);
p();
p(
  '| Bedingung | Idle CPU % Median/Max | Summary CPU % Median/p95/Max (n) | Idle RSS MB Median/Max | Summary RSS MB Median/Max |',
);
p('| --- | --- | --- | --- | --- |');
for (const c of CONDS) {
  const r = raw[c.id].resource;
  p(
    `| ${c.id} | ${fmt(r.idle.cpuPct.median, 1)}/${fmt(r.idle.cpuPct.max, 1)} | ${fmt(r.duringSummaryWindows.cpuPct.median, 1)}/${fmt(r.duringSummaryWindows.cpuPct.p95, 1)}/${fmt(r.duringSummaryWindows.cpuPct.max, 1)} (${r.duringSummaryWindows.cpuPct.n}) | ${fmt(r.idle.rssMb.median, 1)}/${fmt(r.idle.rssMb.max, 1)} | ${fmt(r.duringSummaryWindows.rssMb.median, 1)}/${fmt(r.duringSummaryWindows.rssMb.max, 1)} |`,
  );
}
p();
p('## Backend-Logzeilen `qa_summary:completed`');
p();
for (const c of CONDS) {
  const lines = raw[c.id].runs.flatMap((r) => r.serverLog.map((l) => `${r.label}: ${l.line}`));
  p(`<details><summary>${c.id} (${lines.length} Zeilen)</summary>`);
  p();
  p('```text');
  lines.forEach((l) => p(l));
  p('```');
  p();
  p('</details>');
  p();
}
p('## Stub-Anfragen (C3/C3b)');
p();
const hang = stubLog.filter((e) => e.action === 'hang').length;
const closed = stubLog.filter((e) => e.action === 'client-closed');
p(
  `\`/v1/chat/completions\` erreicht: ${hang}× (Body ${[...new Set(closed.map((e) => e.bodyBytes))].join('/')} Bytes), vom Client geschlossen nach ${Math.min(...closed.map((e) => e.heldMs))}–${Math.max(...closed.map((e) => e.heldMs))} ms; \`/slots?fail_on_no_slot=1\` ${stubLog.filter((e) => e.url?.startsWith('/slots') && e.auth === 'bearer-present').length}× mit Bearer-Token. In C3b werden Läufe mit \`circuit_open\` nicht an den Stub geschickt.`,
);
p();
p('## Beobachtungen');
p();
for (const line of fs
  .readFileSync(new URL('./e3b-observations.md', import.meta.url), 'utf8')
  .trimEnd()
  .split('\n'))
  p(line);
p();
fs.writeFileSync(`${E}/e3b-${short}.md`, L.join('\n'));
console.log(`wrote ${E}/e3b-${short}.json and .md`);
