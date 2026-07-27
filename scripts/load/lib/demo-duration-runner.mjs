import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export function resolveReportPaths(reportFile, junitFile) {
  const jsonPath = String(reportFile ?? '').trim();
  const explicitJunitPath = String(junitFile ?? '').trim();
  const derivedJunitPath = /\.json$/i.test(jsonPath)
    ? jsonPath.replace(/\.json$/i, '.junit.xml')
    : `${jsonPath}.junit.xml`;
  const xmlPath = explicitJunitPath || derivedJunitPath;

  if (!jsonPath || !xmlPath) {
    throw new Error('REPORT_FILE und JUNIT_FILE dürfen nicht leer sein.');
  }
  if (resolve(jsonPath) === resolve(xmlPath)) {
    throw new Error('REPORT_FILE und JUNIT_FILE müssen unterschiedliche Zielpfade verwenden.');
  }

  return { reportFile: jsonPath, junitFile: xmlPath };
}

export function classroomRunOptions(config, runtimeMetrics) {
  return {
    trpcUrl: config.trpcUrl,
    participants: config.participants,
    voteP95LimitMs: config.httpP95LimitMs,
    runtimeMetrics,
    waitForBackend: false,
    writeReport: false,
    log: false,
  };
}

export async function waitForCooldown(cooldownMs, signal, sleepFn = sleep) {
  if (cooldownMs <= 0 || signal?.aborted) return;
  try {
    await sleepFn(cooldownMs, undefined, { signal });
  } catch (error) {
    if (signal?.aborted && error?.name === 'AbortError') return;
    throw error;
  }
}
