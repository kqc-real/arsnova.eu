import { fasseLaufzeitenZusammen } from './artillery-live-messungen.mjs';

// Versuchsvertrag Version 2: vor den bestätigenden Messungen festgelegt.
export const A1_GRENZEN = Object.freeze({
  relativeP95: 0.1,
  absoluteP95Ms: 50,
  errorRate: 0.005,
  scheduledFailureRate: 0.005,
  voteP95Ms: 1000,
  analysisUnavailableRate: 0.01,
  throttledPeriodRatio: 0.05,
  memoryRatio: 0.8,
});

function zahl(wert) {
  if (!Number.isFinite(wert) || wert < 0) throw new Error('Ungültiger Messwert.');
  return wert;
}

function zeiten(werte) {
  if (!Array.isArray(werte)) throw new Error('Fehlende Laufzeitstichproben.');
  werte.forEach(zahl);
  const ergebnis = fasseLaufzeitenZusammen(werte);
  delete ergebnis.durationSamplesMs;
  return ergebnis;
}

export function pruefeLiveAktion(aktion) {
  const felder = [
    'planned',
    'attempted',
    'succeeded',
    'failed',
    'pending',
    'skipped',
    'notAttempted',
  ];
  if (
    aktion?.accountingValid !== true ||
    felder.some((name) => !Number.isSafeInteger(aktion[name]) || aktion[name] < 0) ||
    aktion.planned < 1 ||
    aktion.attempted !== aktion.succeeded + aktion.failed + aktion.pending ||
    aktion.planned !== aktion.attempted + aktion.skipped + aktion.notAttempted ||
    aktion.latency?.durationSamplesMs?.length !== aktion.succeeded ||
    aktion.failureLatency?.durationSamplesMs?.length !== aktion.failed
  )
    throw new Error('Unvollständige oder widersprüchliche Live-Zählung.');
  const latency = zeiten(aktion.latency.durationSamplesMs);
  zeiten(aktion.failureLatency.durationSamplesMs);
  const errorRate = aktion.attempted ? aktion.failed / aktion.attempted : null;
  const scheduledFailureRate = (aktion.planned - aktion.succeeded) / aktion.planned;
  return {
    ...Object.fromEntries(felder.map((name) => [name, aktion[name]])),
    ...latency,
    errorRate,
    scheduledFailureRate,
    errorPassed: latency.available && errorRate !== null && errorRate <= A1_GRENZEN.errorRate,
    coveragePassed: latency.available && scheduledFailureRate <= A1_GRENZEN.scheduledFailureRate,
    voteTargetPassed: latency.available && latency.p95Ms <= A1_GRENZEN.voteP95Ms,
  };
}

export function vergleicheLiveAktionen(basis, kandidat) {
  const baseline = pruefeLiveAktion(basis);
  const candidate = pruefeLiveAktion(kandidat);
  const vorhanden = baseline.available && candidate.available;
  const absoluteChangeMs = vorhanden ? candidate.p95Ms - baseline.p95Ms : null;
  const relativeChange = vorhanden && baseline.p95Ms > 0 ? absoluteChangeMs / baseline.p95Ms : null;
  const relativePassed =
    vorhanden && candidate.p95Ms <= baseline.p95Ms * (1 + A1_GRENZEN.relativeP95);
  const absolutePassed = vorhanden && absoluteChangeMs <= A1_GRENZEN.absoluteP95Ms;
  return {
    baseline,
    candidate,
    absoluteChangeMs,
    relativeChange,
    relativePassed,
    absolutePassed,
    passed:
      relativePassed &&
      absolutePassed &&
      baseline.errorPassed &&
      candidate.errorPassed &&
      baseline.coveragePassed &&
      candidate.coveragePassed,
  };
}

export function fasseAnalyseAufrufeZusammen(analyse) {
  if (
    !Number.isSafeInteger(analyse?.planned) ||
    analyse.planned < 1 ||
    !Array.isArray(analyse.calls) ||
    analyse.calls.length !== analyse.planned
  )
    throw new Error('Unvollständiger Analysezeitplan.');
  const outcomes = {};
  const fallbackReasons = {};
  const erfolgreich = [];
  const ersatz = [];
  for (const aufruf of analyse.calls) {
    if (!/^[A-Z][A-Z_]{0,39}$/.test(aufruf.outcome ?? ''))
      throw new Error('Ungültige Analyse-Ergebnisklasse.');
    outcomes[aufruf.outcome] = (outcomes[aufruf.outcome] ?? 0) + 1;
    if (['SUCCESS', 'FALLBACK'].includes(aufruf.outcome)) {
      zahl(aufruf.durationMs);
      if (aufruf.outcome === 'SUCCESS') {
        if (aufruf.normalizationApplied !== 'LEMMA')
          throw new Error('Analyseerfolg ohne angewandte Lemmatisierung.');
        erfolgreich.push(aufruf.durationMs);
      } else {
        ersatz.push(aufruf.durationMs);
        const grund = aufruf.normalizationFallbackReason;
        if (!/^[A-Z][A-Z_]{0,39}$/.test(grund ?? ''))
          throw new Error('Fehlender oder ungültiger Fallbackgrund.');
        fallbackReasons[grund] = (fallbackReasons[grund] ?? 0) + 1;
      }
    }
  }
  const unavailableRate = (analyse.planned - erfolgreich.length) / analyse.planned;
  return {
    planned: analyse.planned,
    outcomes,
    fallbackReasons,
    unavailableRate,
    fallbackRateOfResponses:
      erfolgreich.length + ersatz.length
        ? ersatz.length / (erfolgreich.length + ersatz.length)
        : null,
    availabilityPassed: unavailableRate <= A1_GRENZEN.analysisUnavailableRate,
    successLatency: zeiten(erfolgreich),
    fallbackLatency: zeiten(ersatz),
  };
}

export function fasseRessourcenZusammen(ressourcen) {
  const snapshots = ressourcen?.snapshots;
  if (!Array.isArray(snapshots) || snapshots.length < 2)
    throw new Error('Fehlende Ressourcenzeitreihe.');
  const aliases = snapshots[0].containers.map((eintrag) => eintrag.alias);
  if (!aliases.length || new Set(aliases).size !== aliases.length)
    throw new Error('Ungültige Containerzuordnung.');
  for (const snapshot of snapshots) {
    if (
      snapshot.containers.length !== aliases.length ||
      new Set(snapshot.containers.map((eintrag) => eintrag.alias)).size !== aliases.length ||
      snapshot.containers.some((eintrag) => !aliases.includes(eintrag.alias))
    )
      throw new Error('Containerzuordnung innerhalb des Fensters verändert.');
  }
  return aliases.map((alias) => {
    const reihe = snapshots.map((snapshot) => snapshot.containers.find((c) => c.alias === alias));
    const generation = reihe[0].generation;
    if (!Number.isSafeInteger(generation) || generation < 1)
      throw new Error('Ungültige Containergeneration.');
    const wert = (eintrag, name) => {
      const metrik = eintrag.cgroup?.metrics?.[name];
      if (
        eintrag.available !== true ||
        eintrag.cgroup.available !== true ||
        eintrag.generation !== generation ||
        metrik?.available !== true
      )
        throw new Error('Metrik fehlt oder Containergeneration gewechselt.');
      return metrik.value;
    };
    const zahlen = reihe.map((eintrag) => {
      const cpu = wert(eintrag, 'cpuStat');
      const zeit = zahl(eintrag.cgroup.metrics.cpuStat.observedAtMs);
      const usage = zahl(cpu.usage_usec);
      const periods = zahl(cpu.nr_periods);
      const throttled = zahl(cpu.nr_throttled);
      const limit = wert(eintrag, 'memoryLimit');
      return {
        zeit,
        usage,
        periods,
        throttled,
        current: zahl(wert(eintrag, 'memoryCurrent')),
        peak: zahl(wert(eintrag, 'memoryPeak')),
        oom: zahl(wert(eintrag, 'oomKill')),
        limit: eintrag.cgroup.metrics.memoryLimit?.unlimited ? null : zahl(limit),
      };
    });
    for (let i = 1; i < zahlen.length; i++) {
      const vorher = zahlen[i - 1];
      const jetzt = zahlen[i];
      if (
        jetzt.zeit <= vorher.zeit ||
        ['usage', 'periods', 'throttled', 'oom', 'peak'].some(
          (name) => jetzt[name] < vorher[name],
        ) ||
        jetzt.limit !== vorher.limit
      )
        throw new Error('Zähler, Zeitfolge oder Limit innerhalb des Fensters ungültig.');
    }
    const anfang = zahlen[0];
    const ende = zahlen.at(-1);
    const periodsDelta = ende.periods - anfang.periods;
    const throttledDelta = ende.throttled - anfang.throttled;
    const throttledPeriodRatio = periodsDelta > 0 ? throttledDelta / periodsDelta : null;
    const lifetimePeakMemoryBytes = Math.max(...zahlen.map((x) => x.peak));
    const memoryRatio = ende.limit > 0 ? lifetimePeakMemoryBytes / ende.limit : null;
    const oomKillDelta = ende.oom - anfang.oom;
    return {
      alias,
      generation,
      cpuPercent: ((ende.usage - anfang.usage) / ((ende.zeit - anfang.zeit) * 1000)) * 100,
      periodsDelta,
      throttledDelta,
      throttledPeriodRatio,
      sampledPeakMemoryBytes: Math.max(...zahlen.map((x) => x.current)),
      lifetimePeakMemoryBytes,
      memoryLimitBytes: ende.limit,
      memoryRatio,
      oomKillDelta,
      throttlingPassed:
        throttledPeriodRatio !== null && throttledPeriodRatio <= A1_GRENZEN.throttledPeriodRatio,
      memoryPassed: memoryRatio !== null && memoryRatio <= A1_GRENZEN.memoryRatio,
      oomPassed: oomKillDelta === 0,
    };
  });
}
