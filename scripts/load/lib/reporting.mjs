import { mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname, basename, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

export const LOAD_REPORT_SCHEMA_VERSION = 1;

function requirePlainObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} muss ein JSON-Objekt sein.`);
  }
  return value;
}

function requireJsonValue(value, name) {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new TypeError(`${name} muss als JSON serialisierbar sein.`);
    }
    return JSON.parse(serialized);
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith(`${name} muss`)) {
      throw error;
    }
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new TypeError(`${name} muss als JSON serialisierbar sein.${detail}`);
  }
}

function normalizeTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('timestamp muss ein gültiger Zeitpunkt sein.');
  }
  return date.toISOString();
}

function normalizeAssertions(assertions) {
  if (!Array.isArray(assertions)) {
    throw new TypeError('assertions muss ein Array sein.');
  }

  return assertions.map((assertion, index) => {
    requirePlainObject(assertion, `assertions[${index}]`);
    if (typeof assertion.name !== 'string' || assertion.name.trim() === '') {
      throw new TypeError(`assertions[${index}].name muss eine nichtleere Zeichenkette sein.`);
    }
    if (typeof assertion.passed !== 'boolean') {
      throw new TypeError(`assertions[${index}].passed muss ein Boolean sein.`);
    }
    return requireJsonValue(assertion, `assertions[${index}]`);
  });
}

function inferredGitCommit() {
  const value =
    process.env.GITHUB_SHA ?? process.env.CI_COMMIT_SHA ?? process.env.BUILD_SOURCEVERSION;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * Erstellt den standardisierten Envelope für einen Lasttest-Report.
 *
 * `environment` wird absichtlich nur aus explizit übergebenen Werten aufgebaut,
 * damit nicht versehentlich Secrets aus process.env im Report landen.
 */
export function createLoadReport({
  scenario,
  timestamp,
  gitCommit = inferredGitCommit(),
  environment = {},
  metrics = {},
  assertions = [],
} = {}) {
  if (typeof scenario !== 'string' || scenario.trim() === '') {
    throw new TypeError('scenario muss eine nichtleere Zeichenkette sein.');
  }
  requirePlainObject(environment, 'environment');
  requirePlainObject(metrics, 'metrics');

  const report = {
    schemaVersion: LOAD_REPORT_SCHEMA_VERSION,
    scenario: scenario.trim(),
    timestamp: normalizeTimestamp(timestamp),
  };

  if (gitCommit !== undefined && gitCommit !== null && gitCommit !== '') {
    if (typeof gitCommit !== 'string') {
      throw new TypeError('gitCommit muss eine Zeichenkette sein.');
    }
    report.gitCommit = gitCommit.trim();
  }

  report.environment = requireJsonValue(environment, 'environment');
  report.metrics = requireJsonValue(metrics, 'metrics');
  report.assertions = normalizeAssertions(assertions);
  return report;
}

/**
 * Schreibt JSON über eine temporäre Datei im Zielverzeichnis und benennt diese
 * anschließend atomar um. So wird nie ein teilweise geschriebener Report sichtbar.
 */
export async function writeJsonAtomic(filePath, value) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new TypeError('filePath muss eine nichtleere Zeichenkette sein.');
  }

  const targetPath = resolve(filePath);
  const targetDirectory = dirname(targetPath);
  const temporaryPath = resolve(
    targetDirectory,
    `.${basename(targetPath)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`,
  );
  const json = `${JSON.stringify(requireJsonValue(value, 'value'), null, 2)}\n`;
  let handle;

  await mkdir(targetDirectory, { recursive: true });
  try {
    handle = await open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(json, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, targetPath);
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
    }
    await rm(temporaryPath, { force: true }).catch(() => {});
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `JSON-Report konnte nicht atomar nach "${targetPath}" geschrieben werden: ${detail}`,
    );
  }

  return targetPath;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function assertionFailureMessage(assertion) {
  if (typeof assertion.message === 'string' && assertion.message !== '') {
    return assertion.message;
  }
  const details = [];
  if (Object.hasOwn(assertion, 'expected')) {
    details.push(`erwartet: ${JSON.stringify(assertion.expected)}`);
  }
  if (Object.hasOwn(assertion, 'actual')) {
    details.push(`tatsächlich: ${JSON.stringify(assertion.actual)}`);
  }
  return details.join(', ') || 'Assertion fehlgeschlagen';
}

export function createJUnitXml(report) {
  requirePlainObject(report, 'report');
  const assertions = normalizeAssertions(report.assertions ?? []);
  const failures = assertions.filter((assertion) => !assertion.passed).length;
  const scenario =
    typeof report.scenario === 'string' && report.scenario !== '' ? report.scenario : 'load-test';
  const testCases = assertions
    .map((assertion) => {
      const name = escapeXml(assertion.name);
      if (assertion.passed) {
        return `  <testcase classname="${escapeXml(scenario)}" name="${name}"/>`;
      }
      const message = assertionFailureMessage(assertion);
      return `  <testcase classname="${escapeXml(scenario)}" name="${name}">\n    <failure message="${escapeXml(message)}">${escapeXml(message)}</failure>\n  </testcase>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="${escapeXml(scenario)}" tests="${assertions.length}" failures="${failures}" errors="0" timestamp="${escapeXml(report.timestamp ?? '')}">`,
    testCases,
    '</testsuite>',
    '',
  ].join('\n');
}

export async function writeJUnitReport(filePath, report) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new TypeError('filePath muss eine nichtleere Zeichenkette sein.');
  }

  const targetPath = resolve(filePath);
  const targetDirectory = dirname(targetPath);
  const temporaryPath = resolve(
    targetDirectory,
    `.${basename(targetPath)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`,
  );
  let handle;

  await mkdir(targetDirectory, { recursive: true });
  try {
    handle = await open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(createJUnitXml(report), 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, targetPath);
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
    }
    await rm(temporaryPath, { force: true }).catch(() => {});
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `JUnit-Report konnte nicht atomar nach "${targetPath}" geschrieben werden: ${detail}`,
    );
  }

  return targetPath;
}

/**
 * Erstellt und schreibt einen JSON-Report; bei `junitPath` zusätzlich JUnit XML.
 */
export async function writeLoadReport(filePath, input, { junitPath } = {}) {
  const report = createLoadReport(input);
  await writeJsonAtomic(filePath, report);
  if (junitPath !== undefined && junitPath !== null && junitPath !== '') {
    await writeJUnitReport(junitPath, report);
  }
  return report;
}

export async function writeScenarioReport({
  filePath = process.env.REPORT_FILE,
  junitPath = process.env.JUNIT_FILE,
  scenario,
  environment = {},
  metrics = {},
  failures = [],
}) {
  if (!filePath) return null;
  if (!Array.isArray(failures)) {
    throw new TypeError('failures muss ein Array sein.');
  }
  const assertions =
    failures.length === 0
      ? [{ name: 'scenario', passed: true }]
      : failures.map((failure, index) => ({
          name: `failure-${index + 1}`,
          passed: false,
          message: failure instanceof Error ? failure.message : String(failure),
        }));
  return writeLoadReport(
    filePath,
    { scenario, environment, metrics, assertions },
    { junitPath: junitPath || undefined },
  );
}
