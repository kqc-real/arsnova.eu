// Auswertung der 1C-Messreihen (Design Teil 2, Abschnitte 5, 6 und 10).
//
// Aufruf aus dem Repository-Wurzelverzeichnis:
//   node docs/referat-thema-1/evidenz/1C/messung/auswertung.mjs <messung.json.gz> [...]
//
// Kennzahlen ohne Aufwärmläufe. Median: bei geradem n Mittel der beiden
// mittleren Werte. p95: Nearest-Rank, b[ceil(0,95 · n) − 1] (bei n = 10 also
// das Maximum). Bootstrap: Perzentil-Intervall 95 % für Median(B) − Median(V1),
// beide Gruppen unabhängig mit Zurücklegen gezogen, 10 000 Wiederholungen,
// fester Seed 20261024 (mulberry32), damit das Ergebnis reproduzierbar ist.
//
// Teil 3 (Design Teil 3, Abschnitt 5): M6 mit denselben Kennzahlen, dazu
// Bootstrap-Perzentil-Intervalle (95 %, 10 000 Wiederholungen, Seed 20261024,
// je Größe ein eigener Generator) für Mediane und Verhältnisse von Medianen.
// Werden Dateien aus Teil 2 mit übergeben, folgt der Faktor gegen deren M3/M4.
// M7: Anteil `source_changed` (gespeicherter Endstatus des Jobs) je Rate mit
// 95-%-Wilson-Intervall (z = 1,959964) und mittlerer Vorhersage 1 − e^(−r·T),
// T = Ende prepare (2) bis Beginn prepare (3) (primär) bzw. Beginn (2) bis Ende (3).
// M7b (Nachtrag im Protokoll Teil 3): zusätzlich Klasse (b) = source_changed oder
// failed/context_unavailable nach CONFLICT in prepare (2)/(3), mit Kriterium K_b.
// M7c: Diagnose `scheduleDiagnostic` (Zeitpläne mit Ankunft im Fenster), kein Kriterium.
// Teil 3, Task 5 (nachträglich, kein Kriterium): exakte Poisson-Binomial-Randwahrscheinlichkeiten
// P(X ≥ k) und P(X ≤ k) für die Zahl der Zeitpläne mit Ankunft im Fenster und für die Zahl der
// Läufe mit geändertem Hash, X = Summe unabhängiger Bernoulli(1 − e^(−r·T_i)) über die Läufe mit T.
// Laborlauf (Entwurf docs/referat-thema-1/specs/2026-10-25-1c-labor-design.md, Schlüssel `labor`):
// L1 Vorschau = Draht je Lauf, L2 q = usage.prompt_tokens / budget.packedInputTokens,
// L3 Zeiten (Median, p95 Nearest-Rank, Bootstrap-Perzentil-Intervall 95 % für Mediane, 10 000
// Wiederholungen, Seed 20261024 wie oben; Verhältnisse von Medianen mit 4 Nachkommastellen),
// L4 Statusverteilung mit Wilson-Intervall, L5 Befund T3.1 je Arm. Trockenläufe gegen die
// Test-Runtime (`labor.dryRun`) werden als solche markiert und sind keine Evidenz.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const SEED = 20261024;
const RESAMPLES = 10_000;

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sorted = (values) => [...values].sort((a, b) => a - b);
function median(values) {
  const b = sorted(values);
  const mid = b.length / 2;
  return b.length % 2 ? b[(b.length - 1) / 2] : (b[mid - 1] + b[mid]) / 2;
}
function stats(values) {
  const b = sorted(values);
  return {
    n: b.length,
    median: +median(b).toFixed(1),
    p95: b[Math.ceil(0.95 * b.length) - 1],
    max: b[b.length - 1],
  };
}
function bootstrapMedianDiff(a, b, random) {
  const draw = (values) => values.map(() => values[Math.floor(random() * values.length)]);
  const diffs = [];
  for (let i = 0; i < RESAMPLES; i += 1) diffs.push(median(draw(a)) - median(draw(b)));
  const s = sorted(diffs);
  return {
    pointEstimate: +(median(a) - median(b)).toFixed(1),
    ci95: [
      +s[Math.floor(0.025 * RESAMPLES)].toFixed(1),
      +s[Math.ceil(0.975 * RESAMPLES) - 1].toFixed(1),
    ],
    resamples: RESAMPLES,
    seed: SEED,
  };
}
function bootstrapMedianCi(values) {
  const random = mulberry32(SEED);
  const draws = [];
  for (let i = 0; i < RESAMPLES; i += 1) {
    draws.push(median(values.map(() => values[Math.floor(random() * values.length)])));
  }
  const s = sorted(draws);
  return [
    +s[Math.floor(0.025 * RESAMPLES)].toFixed(1),
    +s[Math.ceil(0.975 * RESAMPLES) - 1].toFixed(1),
  ];
}
function bootstrapMedianRatio(a, b) {
  const random = mulberry32(SEED);
  const draw = (values) => values.map(() => values[Math.floor(random() * values.length)]);
  const ratios = [];
  for (let i = 0; i < RESAMPLES; i += 1) ratios.push(median(draw(a)) / median(draw(b)));
  const s = sorted(ratios);
  return {
    factor: +(median(a) / median(b)).toFixed(2),
    ci95: [
      +s[Math.floor(0.025 * RESAMPLES)].toFixed(2),
      +s[Math.ceil(0.975 * RESAMPLES) - 1].toFixed(2),
    ],
    resamples: RESAMPLES,
    seed: SEED,
  };
}
function wilson(k, n, z = 1.959963984540054) {
  if (n === 0) return null;
  const p = k / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const half = (z / denominator) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [+(centre - half).toFixed(3), +(centre + half).toFixed(3)];
}
function binomialCdf(k, n, p) {
  let total = 0;
  let coefficient = 1;
  for (let i = 0; i <= Math.min(k, n); i += 1) {
    if (i > 0) coefficient = (coefficient * (n - i + 1)) / i;
    total += coefficient * p ** i * (1 - p) ** (n - i);
  }
  return k < 0 ? 0 : total;
}
/** Verteilung der Summe unabhängiger Bernoulli(p_i) (Poisson-Binomial), exakt per Faltung. */
function poissonBinomialTails(probabilities, k) {
  let distribution = [1];
  for (const p of probabilities) {
    const next = new Array(distribution.length + 1).fill(0);
    distribution.forEach((value, i) => {
      next[i] += value * (1 - p);
      next[i + 1] += value * p;
    });
    distribution = next;
  }
  const sum = (values) => values.reduce((total, value) => total + value, 0);
  return {
    pAtLeast: +sum(distribution.slice(k)).toFixed(4),
    pAtMost: +sum(distribution.slice(0, k + 1)).toFixed(4),
  };
}
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const measured = (runs) => runs.filter((run) => run.warmup === false);
const distinct = (values) => [...new Set(values)];
const outcome = (summary) => `${summary.status}/${summary.effectiveMode}/${summary.fallbackReason}`;

function evaluate(data) {
  const out = { completed: data.completed ?? null, mode: data.v1?.mode ?? 'sequential' };
  if (data.m1m2m5) {
    for (const [condition, runs] of Object.entries(data.m1m2m5.conditions)) {
      const r = measured(runs);
      out[`M1 requestMs ${condition}`] = stats(r.map((x) => x.requestMs));
      out[`M2 totalMs ${condition}`] = stats(r.map((x) => x.totalMs));
      out[`M5 prepares ${condition}`] = distinct(r.map((x) => x.prepareHookCalls));
      out[`M5 bodyBytes ${condition}`] = distinct(r.map((x) => x.requestBodyBytes));
      out[`status ${condition}`] = distinct(r.map((x) => outcome(x.primary)));
    }
  }
  if (data.m3) {
    out['M3 warm'] = stats(measured(data.m3.warm).map((x) => x.ms));
    out['M3 cold'] = stats(measured(data.m3.cold).map((x) => x.ms));
    out['M3 cache'] = {
      warm: distinct(measured(data.m3.warm).map((x) => x.cache)),
      cold: distinct(measured(data.m3.cold).map((x) => x.cache)),
      coldDeletedRedisKeys: distinct(data.m3.cold.map((x) => x.deletedRedisKeys)),
    };
  }
  if (data.m4) {
    for (const field of [
      'assembleMs',
      'requestParseMs',
      'clientOutputParseMs',
      'modelOutputParseMs',
      'totalMs',
    ]) {
      out[`M4 ${field}`] = stats(measured(data.m4.runs).map((x) => x[field]));
    }
    if (out['M3 warm']) {
      out['M4 share'] = +(out['M4 totalMs'].median / out['M3 warm'].median).toFixed(3);
    }
  }
  if (data.v1) {
    for (const [cell, runs] of Object.entries(data.v1.runs)) {
      const r = measured(runs);
      out[`V1 ${cell}`] = {
        totalMs: stats(r.map((x) => x.totalMs)),
        jobDoneMs: stats(r.map((x) => x.jobDoneMs)),
        hookCalls: distinct(r.map((x) => x.prepareHookCalls)),
        realPrepares: distinct(r.map((x) => x.realPrepares)),
        primary: distinct(r.map((x) => outcome(x.primary))),
        secondary: distinct(r.map((x) => outcome(x.internal))),
        stalePrimary6: r.filter((x) => x.stalePrimary.section6).length,
        stalePrimary10: r.filter((x) => x.stalePrimary.section10).length,
        staleSecondary6: r.filter((x) => x.staleSecondary.section6).length,
        staleSecondary10: r.filter((x) => x.staleSecondary.section10).length,
      };
    }
    const random = mulberry32(SEED);
    for (const kind of ['quiet', 'change']) {
      const b = measured(data.v1.runs[`B/${kind}`]);
      const v = measured(data.v1.runs[`V1/${kind}`]);
      for (const field of ['totalMs', 'jobDoneMs']) {
        out[`Bootstrap B−V1 ${kind} ${field}`] = bootstrapMedianDiff(
          b.map((x) => x[field]),
          v.map((x) => x[field]),
          random,
        );
      }
    }
    const quietB = out['V1 B/quiet'].totalMs.median;
    out['V1 saving quiet totalMs (share of B)'] = +(
      (quietB - out['V1 V1/quiet'].totalMs.median) /
      quietB
    ).toFixed(4);
  }
  if (data.m6) evaluateM6(data.m6, out);
  if (data.m7calibration) out['M7 Kalibrierung'] = data.m7calibration.steps;
  if (data.m7) evaluateM7(data.m7, out);
  if (data.labor) evaluateLabor(data.labor, out);
  return out;
}

const ms = (runs) => measured(runs).map((x) => x.ms);

function evaluateM6(m6, out) {
  for (const [name, c] of Object.entries(m6.conditions)) {
    const warm = measured(c.warm);
    const cold = measured(c.cold);
    const validation = measured(c.validation.runs);
    const row = {
      role: c.role,
      env: c.env,
      warm: { ...stats(ms(c.warm)), medianCi95: bootstrapMedianCi(ms(c.warm)) },
      cold: { ...stats(ms(c.cold)), medianCi95: bootstrapMedianCi(ms(c.cold)) },
      cache: { warm: distinct(warm.map((x) => x.cache)), cold: distinct(cold.map((x) => x.cache)) },
      coldDeletedRedisKeys: distinct(c.cold.map((x) => x.deletedRedisKeys)),
      distinctSnapshotHashes: {
        warm: distinct(warm.map((x) => x.snapshotHash)).length,
        cold: distinct(cold.map((x) => x.snapshotHash)).length,
      },
      promptContextBytes: distinct([...warm, ...cold].map((x) => x.promptContextBytes)),
      dataTokens: distinct([...warm, ...cold].map((x) => x.dataTokens)),
      truncations: distinct([...warm, ...cold].map((x) => JSON.stringify(x.truncations))),
      areas: distinct([...warm, ...cold].map((x) => JSON.stringify(x.areas))),
      validationPromptContextBytes: c.validation.promptContextBytes,
      jobs: c.jobs.map((job) => ({
        completionRequests: job.completionRequests,
        requestBodyBytes: job.requestBodyBytes,
        userMessageBytes: job.userMessageBytes,
        stored: outcome(job.stored),
      })),
    };
    for (const field of [
      'assembleMs',
      'requestParseMs',
      'clientOutputParseMs',
      'modelOutputParseMs',
      'totalMs',
    ]) {
      row[`validation ${field}`] = stats(validation.map((x) => x[field]));
    }
    row['validation share (median total / median warm)'] = +(
      row['validation totalMs'].median / row.warm.median
    ).toFixed(4);
    row['validation share (median total / median cold)'] = +(
      row['validation totalMs'].median / row.cold.median
    ).toFixed(4);
    out[`M6 ${name}`] = row;
  }
  const primary = m6.conditions['full/YESNO'];
  if (primary) {
    const h = out['M6 full/YESNO'];
    out['M6 H (median cold < 500 ms, share < 20 %)'] = {
      coldMedian: h.cold.median,
      coldBelow500: h.cold.median < 500,
      share: h['validation share (median total / median warm)'],
      shareBelow20: h['validation share (median total / median warm)'] < 0.2,
    };
    for (const baseline of ['reference/m3-env', 'reference/m6-env']) {
      const b = m6.conditions[baseline];
      if (!b) continue;
      out[`M6 Faktor full/YESNO ÷ ${baseline} (gleicher Lauf)`] = {
        warm: bootstrapMedianRatio(ms(primary.warm), ms(b.warm)),
        cold: bootstrapMedianRatio(ms(primary.cold), ms(b.cold)),
        validationTotal: bootstrapMedianRatio(
          measured(primary.validation.runs).map((x) => x.totalMs),
          measured(b.validation.runs).map((x) => x.totalMs),
        ),
      };
    }
  }
}

/** Lage einer Stimme (Commit zwischen issuedAt und resolvedAt) zu prepare (2) und (3). */
function classifyVote(vote, second, third) {
  const overlaps = (p) =>
    p && vote.issuedAt < (p.endedAt ?? Infinity) && vote.resolvedAt > p.startedAt;
  if (second && vote.resolvedAt <= second.startedAt) return 'vor (2)';
  if (overlaps(second)) return 'während (2)';
  if (!third) return 'nach Abbruch';
  if (vote.issuedAt >= second.endedAt && vote.resolvedAt <= third.startedAt) return 'Fenster';
  if (overlaps(third)) return 'während (3)';
  if (vote.issuedAt >= third.endedAt) return 'nach (3)';
  return 'unklar';
}

/** Ziehungsfolge wie im Messcode: je Stimme Zwischenankunftszeit, dann Fragenwahl. */
function scheduleHitsWindow(run, rate) {
  const second = run.prepares.find((p) => p.role === 'before');
  const third = run.prepares.find((p) => p.role === 'after');
  if (!second || !third) return false;
  const from = second.endedAt - run.processStartedAt;
  const to = third.startedAt - run.processStartedAt;
  const random = mulberry32(run.seed);
  let offset = 0;
  for (;;) {
    offset += (-Math.log(1 - random()) / rate) * 1000;
    random();
    if (offset > to) return false;
    if (offset >= from) return true;
  }
}

function evaluateM7(m7, out) {
  for (const [key, rate] of Object.entries(m7.rates)) {
    const r = rate.ratePerSecond;
    const runs = measured(rate.runs);
    const n = runs.length;
    const k = runs.filter((x) => x.stored.fallbackReason === 'source_changed').length;
    const withT = runs.filter((x) => x.windowInnerMs !== null);
    const predict = (t) => 1 - Math.exp((-r * t) / 1000);
    const meanInner = withT.length ? mean(withT.map((x) => predict(x.windowInnerMs))) : null;
    const meanOuter = withT.length ? mean(withT.map((x) => predict(x.windowOuterMs))) : null;
    const ci = wilson(k, n);
    const voteClasses = {};
    let runsWithVoteInWindow = 0;
    let consistent = 0;
    for (const run of runs) {
      const second = run.prepares.find((p) => p.role === 'before');
      const third = run.prepares.find((p) => p.role === 'after');
      const classes = run.votes.map((vote) => classifyVote(vote, second, third));
      for (const c of classes) voteClasses[c] = (voteClasses[c] ?? 0) + 1;
      const inWindow = classes.includes('Fenster');
      if (inWindow) runsWithVoteInWindow += 1;
      if (run.hashChanged !== null && run.hashChanged === inWindow) consistent += 1;
    }
    const discarded = runs.filter((x) => x.stored.fallbackReason !== null).length;
    // Klasse (b) laut Nachtrag M7b: source_changed oder failed/context_unavailable nach CONFLICT
    // in einem der beiden Job-Aufbauten (prepare (2) oder (3)).
    const conflictInJob = (x) =>
      x.prepares.some(
        (p) => (p.role === 'before' || p.role === 'after') && (p.error ?? '').includes('CONFLICT'),
      );
    const classB = runs.filter(
      (x) =>
        x.stored.fallbackReason === 'source_changed' ||
        (x.stored.status === 'failed' &&
          x.stored.fallbackReason === 'context_unavailable' &&
          conflictInJob(x)),
    ).length;
    const ciB = wilson(classB, n);
    const failedWithoutConflict = runs.filter(
      (x) => x.stored.status === 'failed' && !conflictInJob(x),
    ).length;
    out[`M7 ${key}`] = {
      n,
      storedOutcomes: Object.fromEntries(
        distinct(runs.map((x) => outcome(x.stored))).map((o) => [
          o,
          runs.filter((x) => outcome(x.stored) === o).length,
        ]),
      ),
      sourceChanged: k,
      share: +(k / n).toFixed(3),
      wilson95: ci,
      runsWithT: withT.length,
      meanPredictionInner: meanInner === null ? null : +meanInner.toFixed(3),
      meanPredictionOuter: meanOuter === null ? null : +meanOuter.toFixed(3),
      K:
        r === 0
          ? k === 0
          : meanInner !== null && ci !== null && meanInner >= ci[0] && meanInner <= ci[1],
      K_outer_sensitivity:
        r === 0
          ? k === 0
          : meanOuter !== null && ci !== null && meanOuter >= ci[0] && meanOuter <= ci[1],
      windowInnerMs: withT.length ? stats(withT.map((x) => x.windowInnerMs)) : null,
      windowOuterMs: withT.length ? stats(withT.map((x) => x.windowOuterMs)) : null,
      votesPerRun: {
        mean: +mean(runs.map((x) => x.votes.length)).toFixed(2),
        total: runs.reduce((s, x) => s + x.votes.length, 0),
      },
      voteErrors: runs.reduce((s, x) => s + x.votes.filter((v) => v.error).length, 0),
      voteLagMs: (() => {
        const lags = runs.flatMap((x) => x.votes.map((v) => v.issuedAt - v.scheduledAt));
        return lags.length
          ? { median: +median(lags).toFixed(2), max: +Math.max(...lags).toFixed(2) }
          : null;
      })(),
      voteDurationMs: (() => {
        const d = runs.flatMap((x) => x.votes.map((v) => v.resolvedAt - v.issuedAt));
        return d.length ? { median: +median(d).toFixed(2), max: +Math.max(...d).toFixed(2) } : null;
      })(),
      voteClasses,
      runsWithVoteInWindow,
      hashChangedEqualsVoteInWindow: `${consistent}/${runs.filter((x) => x.hashChanged !== null).length}`,
      prepareErrors: runs.flatMap((x) =>
        x.prepares.filter((p) => p.error).map((p) => `${p.role}: ${p.error.split(':')[0]}`),
      ),
      prepareRoles: distinct(runs.map((x) => x.prepares.map((p) => p.role).join(','))),
      // Ergänzend (nicht Teil von K): Binomialwahrscheinlichkeit, unter der mittleren Vorhersage
      // höchstens bzw. mindestens k von n Läufen mit source_changed zu sehen.
      binomialUnderPrediction:
        meanInner === null
          ? null
          : {
              pAtMostK: +binomialCdf(k, n, meanInner).toFixed(4),
              pAtLeastK: +(1 - binomialCdf(k - 1, n, meanInner)).toFixed(4),
            },
      classB: {
        k: classB,
        share: +(classB / n).toFixed(3),
        wilson95: ciB,
        K_b:
          r === 0
            ? classB === 0
            : meanInner !== null && ciB !== null && meanInner >= ciB[0] && meanInner <= ciB[1],
        K_b_outer_sensitivity:
          r === 0
            ? classB === 0
            : meanOuter !== null && ciB !== null && meanOuter >= ciB[0] && meanOuter <= ciB[1],
        failedWithoutConflict,
      },
      runsWithoutT: n - withT.length,
      // Diagnose (M7c-Nachtrag, kein Kriterium): Läufe, deren Zeitplan laut Seed mindestens eine
      // Ankunft in das gemessene Fenster [Ende (2); Beginn (3)] legt, neben der Vorhersage.
      scheduleDiagnostic:
        r === 0
          ? null
          : {
              schedulesWithArrivalInWindow: withT.filter((x) => scheduleHitsWindow(x, r)).length,
              runsWithT: withT.length,
              expected: +withT.reduce((sum, x) => sum + predict(x.windowInnerMs), 0).toFixed(1),
              // Nachtrag Task 5: exakte Randwahrscheinlichkeiten unter der Vorhersage.
              schedulesTails: poissonBinomialTails(
                withT.map((x) => predict(x.windowInnerMs)),
                withT.filter((x) => scheduleHitsWindow(x, r)).length,
              ),
              hashChangedRunsWithT: withT.filter((x) => x.hashChanged === true).length,
              hashChangedTails: poissonBinomialTails(
                withT.map((x) => predict(x.windowInnerMs)),
                withT.filter((x) => x.hashChanged === true).length,
              ),
            },
      modelOutputDiscarded: {
        k: discarded,
        share: +(discarded / n).toFixed(3),
        wilson95: wilson(discarded, n),
      },
      hostOutcomes: Object.fromEntries(
        distinct(runs.map((x) => outcome(x.host))).map((o) => [
          o,
          runs.filter((x) => outcome(x.host) === o).length,
        ]),
      ),
      completionRequests: distinct(runs.map((x) => x.completionRequests)),
      votersRemaining: rate.remainingVotersByKey,
    };
  }
}

/** Bootstrap-Perzentil-Intervall 95 % für Median(a) / Median(b), 4 Nachkommastellen. */
function bootstrapMedianRatio4(a, b) {
  const random = mulberry32(SEED);
  const draw = (values) => values.map(() => values[Math.floor(random() * values.length)]);
  const ratios = [];
  for (let i = 0; i < RESAMPLES; i += 1) ratios.push(median(draw(a)) / median(draw(b)));
  const s = sorted(ratios);
  return {
    point: +(median(a) / median(b)).toFixed(4),
    ci95: [
      +s[Math.floor(0.025 * RESAMPLES)].toFixed(4),
      +s[Math.ceil(0.975 * RESAMPLES) - 1].toFixed(4),
    ],
    resamples: RESAMPLES,
    seed: SEED,
  };
}
/** Median mit Bootstrap-Intervall für dimensionslose Werte (4 Nachkommastellen). */
function ratioStats(values) {
  const random = mulberry32(SEED);
  const draws = [];
  for (let i = 0; i < RESAMPLES; i += 1) {
    draws.push(median(values.map(() => values[Math.floor(random() * values.length)])));
  }
  const s = sorted(draws);
  const b = sorted(values);
  return {
    n: b.length,
    min: +b[0].toFixed(4),
    median: +median(b).toFixed(4),
    max: +b[b.length - 1].toFixed(4),
    medianCi95: [
      +s[Math.floor(0.025 * RESAMPLES)].toFixed(4),
      +s[Math.ceil(0.975 * RESAMPLES) - 1].toFixed(4),
    ],
  };
}
const timeStats = (values) =>
  values.length ? { ...stats(values), medianCi95: bootstrapMedianCi(values) } : null;
const countBy = (values) =>
  Object.fromEntries(distinct(values).map((v) => [v, values.filter((x) => x === v).length]));
const completionOf = (run) =>
  (run.exchanges ?? []).find((x) => x.method === 'POST' && x.path === '/v1/chat/completions') ??
  null;
const laborOutcome = (o) => `${o.status}/${o.effectiveMode}/${o.fallbackReason}`;
const prepareMs = (run, role) => run.prepares.find((p) => p.role === role)?.ms ?? null;
const numbers = (values) => values.filter((v) => typeof v === 'number');

/** L1 je Lauf: Hash, Draht und Unveränderlichkeit des Proxys. */
function laborL1(run) {
  const c = completionOf(run);
  const w = c?.wire;
  const checks = {
    oneCompletion: run.completionRequests === 1,
    hashPreviewEqualsSent: run.sent?.snapshotHash === run.preview.snapshotHash,
    hashSentEqualsStored: run.stored.snapshotHash === run.sent?.snapshotHash,
    userEqualsPreview: w?.userEqualsPreview === true,
    rolesSystemSystemUser: JSON.stringify(w?.roles) === '["system","system","user"]',
    systemInstructionMatches: w?.systemInstructionMatches === true,
    systemDefinitionMatches: w?.systemDefinitionMatches === true,
    maxTokensEqualsReserved:
      typeof w?.maxTokens === 'number' && w.maxTokens === run.sent?.budget?.reservedOutputTokens,
    topLevelKeysAsExpected: w?.topLevelKeysAsExpected === true,
    forwardedBodyIdentical: (run.exchanges ?? []).every((x) => x.forwardedBodyIdentical),
    authorizationMatchesExpected: (run.exchanges ?? []).every(
      (x) => x.authorizationMatchesExpected !== false,
    ),
  };
  return { checks, firstDifference: w?.userFirstDifferenceToPreview ?? null };
}

/** L2 je Lauf: q = usage.prompt_tokens / packedInputTokens des gesendeten Aufbaus. */
function laborL2(run) {
  const response = completionOf(run)?.wire?.response;
  const promptTokens = response?.usage?.prompt_tokens;
  const packed = run.sent?.budget?.packedInputTokens;
  if (typeof promptTokens !== 'number' || typeof packed !== 'number' || packed === 0) return null;
  const t = response.timings ?? {};
  const promptN = typeof t.prompt_n === 'number' ? t.prompt_n : null;
  const cacheN = typeof t.cache_n === 'number' ? t.cache_n : null;
  return {
    promptTokens,
    packedInputTokens: packed,
    q: promptTokens / packed,
    bytesPerToken: (completionOf(run).wire.messageContentBytes ?? packed) / promptTokens,
    promptTokensEqualsPromptNPlusCacheN:
      promptN === null || cacheN === null ? null : promptTokens === promptN + cacheN,
    cacheN,
    completionTokens: response.usage.completion_tokens ?? null,
    finishReason: response.finishReason ?? null,
  };
}

function laborL2Summary(runs) {
  const rows = runs.map(laborL2).filter(Boolean);
  if (!rows.length) return { n: 0, note: 'keine usage-Werte (kein Proxy oder keine Antwort)' };
  const qs = rows.map((r) => r.q);
  return {
    n: rows.length,
    q: ratioStats(qs),
    bytesPerToken: ratioStats(rows.map((r) => r.bytesPerToken)),
    promptTokens: stats(rows.map((r) => r.promptTokens)),
    packedInputTokens: stats(rows.map((r) => r.packedInputTokens)),
    completionTokens: stats(numbers(rows.map((r) => r.completionTokens))),
    promptTokensEqualsPromptNPlusCacheN: countBy(
      rows.map((r) => String(r.promptTokensEqualsPromptNPlusCacheN)),
    ),
    cacheN: stats(numbers(rows.map((r) => r.cacheN))),
    finishReasons: countBy(rows.map((r) => String(r.finishReason))),
    K_L2_allQAtMost1: Math.max(...qs) <= 1,
    // Kopffreiheit im Kontextfenster der Runtime mit der Antwortreserve (max_tokens).
    maxPromptPlusReserved: Math.max(
      ...runs
        .filter((r) => laborL2(r))
        .map((r) => laborL2(r).promptTokens + (r.sent?.budget?.reservedOutputTokens ?? 0)),
    ),
  };
}

function laborTimes(runs) {
  const inference = [];
  const transport = [];
  for (const run of runs) {
    const c = completionOf(run);
    const t = c?.wire?.response?.timings;
    if (t && typeof t.prompt_ms === 'number' && typeof t.predicted_ms === 'number') {
      inference.push(t.prompt_ms + t.predicted_ms);
      if (typeof c.upstreamMs === 'number')
        transport.push(c.upstreamMs - (t.prompt_ms + t.predicted_ms));
    }
  }
  const timingsOf = (field) =>
    numbers(runs.map((r) => completionOf(r)?.wire?.response?.timings?.[field]));
  return {
    requestMs: timeStats(runs.map((r) => r.requestMs)),
    jobDoneMs: timeStats(runs.map((r) => r.jobDoneMs)),
    totalMs: timeStats(runs.map((r) => r.totalMs)),
    upstreamCompletionMs: timeStats(numbers(runs.map((r) => completionOf(r)?.upstreamMs))),
    runtimeInferenceMs: timeStats(inference),
    runtimePromptMs: timeStats(timingsOf('prompt_ms')),
    runtimePredictedMs: timeStats(timingsOf('predicted_ms')),
    transportAndServerOverheadMs: timeStats(transport),
    prepareMs: Object.fromEntries(
      ['preview', 'request', 'before', 'after', 'read'].map((role) => [
        role,
        timeStats(numbers(runs.map((r) => prepareMs(r, role)))),
      ]),
    ),
    windowInnerMs: timeStats(numbers(runs.map((r) => r.windowInnerMs))),
  };
}

function laborOutcomes(runs) {
  const n = runs.length;
  const sourceChanged = runs.filter((r) => r.stored.fallbackReason === 'source_changed').length;
  const fullContext = runs.filter((r) => r.stored.effectiveMode === 'full-context').length;
  return {
    n,
    stored: countBy(runs.map((r) => laborOutcome(r.stored))),
    host: countBy(runs.map((r) => laborOutcome(r.host))),
    responseStage: countBy(runs.map((r) => completionOf(r)?.wire?.response?.stage ?? 'kein Proxy')),
    statements: countBy(runs.map((r) => String(r.stored.statements))),
    sourceChanged: { k: sourceChanged, wilson95: wilson(sourceChanged, n) },
    fullContext: {
      k: fullContext,
      share: +(fullContext / n).toFixed(3),
      wilson95: wilson(fullContext, n),
    },
    prepareErrors: runs.flatMap((r) =>
      r.prepares.filter((p) => p.error).map((p) => `${p.role}: ${p.error}`),
    ),
  };
}

function evaluateLabor(labor, out) {
  if (labor.dryRun) {
    out['L WARNUNG'] =
      'Trockenlauf gegen die In-Prozess-Test-Runtime: Zahlen künstlich, keine Evidenz.';
  }
  const before = labor.metadataBefore;
  const after = labor.metadataAfter;
  const ident = (m) =>
    m &&
    JSON.stringify([
      m.props.buildInfo,
      m.props.modelPath,
      m.props.nCtx,
      m.props.totalSlots,
      m.models.ids,
      m.props.chatTemplateSha256,
    ]);
  out['L Runtime'] = {
    kind: labor.runtimeKind,
    before: before
      ? {
          props: before.props,
          models: before.models.ids,
          health: before.health.status,
          slots: before.slots,
        }
      : null,
    unchangedAfterRun: after ? ident(before) === ident(after) : null,
  };
  const quiet = labor.quiet ? measured(labor.quiet.runs) : [];
  if (quiet.length) {
    const l1 = quiet.map(laborL1);
    const names = Object.keys(l1[0].checks);
    out['L1 Vorschau = Draht'] = {
      n: quiet.length,
      failuresPerCheck: Object.fromEntries(
        names.map((name) => [name, l1.filter((x) => !x.checks[name]).length]),
      ),
      firstDifferences: distinct(l1.map((x) => x.firstDifference)),
      K_L1: l1.every((x) => names.every((name) => x.checks[name])),
    };
    out['L2 Tokens'] = laborL2Summary(quiet);
    const times = laborTimes(quiet);
    out['L3 Zeiten quiet'] = times;
    const request = quiet.map((r) => r.requestMs);
    const upstream = numbers(quiet.map((r) => completionOf(r)?.upstreamMs));
    out['L3 K (Rückkehr unabhängig vom Modell)'] = {
      medianRequestMs: times.requestMs.median,
      p95RequestMs: times.requestMs.p95,
      maxRequestMs: Math.max(...request),
      minUpstreamCompletionMs: upstream.length ? Math.min(...upstream) : null,
      K_L3a:
        times.requestMs.median < 1000 &&
        times.requestMs.p95 < 1000 &&
        (upstream.length ? Math.max(...request) < Math.min(...upstream) : false),
    };
    const afterMs = numbers(quiet.map((r) => prepareMs(r, 'after')));
    if (afterMs.length === quiet.length) {
      const share = bootstrapMedianRatio4(
        afterMs,
        quiet.map((r) => r.totalMs),
      );
      const inf = times.runtimeInferenceMs;
      out['L3 Neubewertung Entscheidung 1 (Teil 2)'] = {
        savingShare: share,
        upperBelow5Percent: share.ci95[1] < 0.05,
        pointAtLeast5Percent: share.point >= 0.05,
        medianInferenceMs: inf ? inf.median : null,
        inferenceVersusD2000: inf ? +(inf.median / 2000).toFixed(2) : null,
        inferenceBelowThreshold: inf
          ? { below1500: inf.median < 1500, below2100: inf.median < 2100 }
          : null,
      };
    }
    const windows = numbers(quiet.map((r) => r.windowInnerMs));
    if (windows.length) {
      out['L3 Vorhersage M7 bei 0,5/s (nur berichtet)'] = {
        n: windows.length,
        meanPrediction: +mean(windows.map((t) => 1 - Math.exp((-0.5 * t) / 1000))).toFixed(3),
      };
    }
    out['L4 Status quiet'] = laborOutcomes(quiet);
    if (labor.direct?.runs?.length) {
      const direct = measured(labor.direct.runs);
      out['L3 Kontrolle direkt (ohne Proxy)'] = {
        totalMs: timeStats(direct.map((r) => r.totalMs)),
        requestMs: timeStats(direct.map((r) => r.requestMs)),
        outcomes: countBy(direct.map((r) => laborOutcome(r.stored))),
        totalMsQuietMinusDirect: bootstrapMedianDiff(
          quiet.map((r) => r.totalMs),
          direct.map((r) => r.totalMs),
          mulberry32(SEED),
        ),
      };
    }
  }
  if (labor.l5?.arms) {
    for (const [type, runs] of Object.entries(labor.l5.arms)) {
      const r = measured(runs);
      if (!r.length) continue;
      const outcomes = laborOutcomes(r);
      out[`L5 ${type}`] = {
        ...outcomes,
        K_L5:
          type === 'YESNO'
            ? outcomes.sourceChanged.k === outcomes.n
            : outcomes.sourceChanged.k === 0,
        tokens: laborL2Summary(r),
        areas: distinct(r.map((x) => JSON.stringify(x.sent?.areas ?? null))),
        truncations: distinct(r.map((x) => JSON.stringify(x.sent?.budget?.truncations ?? null))),
      };
    }
  }
}

const files = process.argv.slice(2).map((path) => {
  // Rohdaten liegen gzip-komprimiert im Repository (`*.json.gz`); unkomprimierte Dateien gehen weiter.
  const raw = readFileSync(path);
  const text = (path.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8');
  return { path, data: JSON.parse(text) };
});
for (const { path, data } of files) {
  console.log(`# ${path}`);
  console.log(JSON.stringify(evaluate(data), null, 1));
}
// Faktor M6 (voller Kontext) gegen M3/M4 aus Teil 2, je übergebener Datei aus Teil 2.
for (const { path, data } of files.filter((file) => file.data.m6?.conditions['full/YESNO'])) {
  const full = data.m6.conditions['full/YESNO'];
  for (const base of files.filter((file) => file.data.m3 && file.data.m4)) {
    console.log(`# Faktor ${path} M6 full/YESNO ÷ ${base.path} M3/M4`);
    console.log(
      JSON.stringify(
        {
          warm: bootstrapMedianRatio(ms(full.warm), ms(base.data.m3.warm)),
          cold: bootstrapMedianRatio(ms(full.cold), ms(base.data.m3.cold)),
          validationTotal: bootstrapMedianRatio(
            measured(full.validation.runs).map((x) => x.totalMs),
            measured(base.data.m4.runs).map((x) => x.totalMs),
          ),
          promptContextBytes: {
            m6: full.validation.promptContextBytes,
            m4: base.data.m4.promptContextBytes,
            factor: +(full.validation.promptContextBytes / base.data.m4.promptContextBytes).toFixed(
              2,
            ),
          },
        },
        null,
        1,
      ),
    );
  }
}
