// E5: Compute/memory cost of the rule core (no model involved).
// Measures (a) rules only: buildModerationCompassCards on a prepared snapshot,
// (b) full recompute: signals + word extraction + cards, for n questions.
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { buildModerationCompassCards } from '../../../../../apps/frontend/src/app/features/session/session-host/moderation-compass.ts';
import {
  EVIDENCE,
  environment,
  qaTermsFor,
  runCompass,
  toCompassQuestion,
  type ScenarioQuestion,
} from './lib.ts';

const env = environment();
const SIZES = [6, 50, 100, 500]; // 500 = documented upper bound of one Q&A list page (schemas.ts)
const VOCAB = (
  'Regression Beispiel Klausur Prüfung Kapitel Abschnitt Anwesenheit Pflicht Folien Übung Aufgabe Lösung ' +
  'Hausaufgabe Termin Raum Skript Formel Varianz Mittelwert Hypothese Test Signifikanz Daten Modell Wiederholung'
).split(' ');

// Deterministic PRNG (mulberry32) so every run uses identical synthetic data.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function synthetic(n: number): ScenarioQuestion[] {
  const r = rng(42 + n);
  const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'PINNED', 'PENDING'] as const;
  return Array.from({ length: n }, (_, i) => {
    const words = Array.from(
      { length: 5 + Math.floor(r() * 8) },
      () => VOCAB[Math.floor(r() * VOCAB.length)],
    );
    const status = statuses[Math.floor(r() * statuses.length)]!;
    return {
      key: `Q${i}`,
      id: `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`,
      text: `Frage ${i}: ${words.join(' ')}?`,
      status,
      positive: Math.floor(r() * 60),
      negative: Math.floor(r() * 40),
    };
  });
}

function stats(samples: number[]) {
  const s = [...samples].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  return {
    runs: s.length,
    medianMs: +q(0.5).toFixed(4),
    p95Ms: +q(0.95).toFixed(4),
    maxMs: +s[s.length - 1]!.toFixed(4),
  };
}

const results: Array<Record<string, unknown>> = [];
for (const n of SIZES) {
  const questions = synthetic(n);
  const compassQuestions = questions.map((q) => toCompassQuestion(q, 200));
  const qaTerms = qaTermsFor(compassQuestions, 'BEST', 'LEXICAL');
  const snapshot = {
    qaQuestions: compassQuestions,
    qaSortMode: 'BEST' as const,
    qaTerms,
    freetextTerms: [],
    extraTopicSources: [],
    topicWeightLabel: null,
    tempo: null,
    quizSources: [],
    quizInsightKind: null,
  };
  const runs = n >= 500 ? 300 : 1000;
  for (let i = 0; i < 50; i++) {
    buildModerationCompassCards(snapshot);
    runCompass({ questions, participantBasis: 200, sortMode: 'BEST' });
  }
  global.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const rules: number[] = [];
  const full: number[] = [];
  for (let i = 0; i < runs; i++) {
    let t = performance.now();
    buildModerationCompassCards(snapshot);
    rules.push(performance.now() - t);
    t = performance.now();
    runCompass({ questions, participantBasis: 200, sortMode: 'BEST' });
    full.push(performance.now() - t);
  }
  const heapAfter = process.memoryUsage().heapUsed;
  results.push({
    n,
    rulesOnly: stats(rules),
    fullRecompute: stats(full),
    heapDeltaMbAfterRuns: +((heapAfter - heapBefore) / 1024 ** 2).toFixed(2),
  });
}
const rss = +(process.memoryUsage().rss / 1024 ** 2).toFixed(1);

mkdirSync(`${EVIDENCE}/E5`, { recursive: true });
writeFileSync(
  `${EVIDENCE}/E5/e5-${env.commitShort}.json`,
  JSON.stringify({ env, processRssMb: rss, results }, null, 2),
);
const md = [
  '# E5 – Rechen- und Speicheraufwand des Regelkerns',
  '',
  `Commit \`${env.commit}\`, ${env.node}, ${env.cpu} (${env.cpuCount} Kerne), ${env.memoryGb} GB RAM, ${env.platform}, ${env.timestamp}`,
  '',
  'Synthetische Fragen (fester Seed), N=200, BEST. „Nur Regeln“ = buildModerationCompassCards auf fertigem Snapshot; „Voll“ = Signale + Wortextraktion + Karten.',
  '',
  '| Fragen n | Nur Regeln Median ms | p95 ms | Voll Median ms | p95 ms | max ms | Läufe |',
  '|---|---|---|---|---|---|---|',
  ...results.map((r) => {
    const a = r.rulesOnly as ReturnType<typeof stats>;
    const b = r.fullRecompute as ReturnType<typeof stats>;
    return `| ${r.n} | ${a.medianMs} | ${a.p95Ms} | ${b.medianMs} | ${b.p95Ms} | ${b.maxMs} | ${a.runs} |`;
  }),
  '',
  `Prozess-RSS nach allen Läufen (Node + geladene Module): ${rss} MB.`,
];
writeFileSync(`${EVIDENCE}/E5/e5-${env.commitShort}.md`, md.join('\n') + '\n');
process.stdout.write(`${md.join('\n')}\n`);
