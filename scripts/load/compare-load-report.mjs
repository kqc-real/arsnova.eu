#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HELP = `Vergleicht einen aktuellen Lasttest-Report mit einer Baseline.

Verwendung:
  node scripts/load/compare-load-report.mjs --current <report.json> --baseline <report.json> --config <budgets.json>
  node scripts/load/compare-load-report.mjs <current.json> <baseline.json> <budgets.json>

Umgebungsvariablen (CLI-Argumente haben Vorrang):
  CURRENT_REPORT       Pfad zum aktuellen Report
  BASELINE_REPORT      Pfad zum Baseline-Report
  LOAD_BUDGET_CONFIG   Pfad zur Budget-Konfiguration

Optionen:
  --current <pfad>     Aktueller JSON-Report
  --baseline <pfad>    Baseline-JSON-Report
  --config <pfad>      JSON-Datei mit Regressionsbudgets
  -h, --help           Diese Hilfe anzeigen

Budget-Regel:
  {
    "path": "http.requestDuration.p95Ms",
    "direction": "lower",
    "maxRelativeRegression": 0.1,
    "maxAbsoluteRegression": 5
  }

Pfade sind relativ zum metrics-Objekt (ein vorangestelltes "metrics." ist erlaubt).
"lower" bedeutet: kleinere Werte sind besser; "higher": größere Werte sind besser.
Wenn beide Budgets gesetzt sind, gilt die größere Toleranz.
`;

function parseArguments(argv) {
  const options = {};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--current' || argument === '--baseline' || argument === '--config') {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`Für ${argument} fehlt ein Pfad.`);
      }
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    if (argument.startsWith('-')) {
      throw new Error(`Unbekannte Option: ${argument}`);
    }
    positional.push(argument);
  }

  if (positional.length > 3) {
    throw new Error('Zu viele Positionsargumente. Erwartet: current, baseline, config.');
  }

  return {
    help: options.help === true,
    current: options.current ?? positional[0] ?? process.env.CURRENT_REPORT,
    baseline: options.baseline ?? positional[1] ?? process.env.BASELINE_REPORT,
    config: options.config ?? positional[2] ?? process.env.LOAD_BUDGET_CONFIG,
  };
}

async function readJson(filePath, label) {
  const absolutePath = resolve(filePath);
  let source;
  try {
    source = await readFile(absolutePath, 'utf8');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} konnte nicht gelesen werden ("${absolutePath}"): ${detail}`);
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} enthält kein valides JSON ("${absolutePath}"): ${detail}`);
  }
}

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} muss ein JSON-Objekt sein.`);
  }
}

function validateReport(report, label) {
  requireObject(report, label);
  requireObject(report.metrics, `${label}.metrics`);
}

function validateBudgetConfig(config) {
  requireObject(config, 'Budget-Konfiguration');
  if (config.schemaVersion !== 1) {
    throw new Error('Budget-Konfiguration.schemaVersion muss 1 sein.');
  }
  if (!Array.isArray(config.rules) || config.rules.length === 0) {
    throw new Error('Budget-Konfiguration.rules muss ein nichtleeres Array sein.');
  }

  return config.rules.map((rule, index) => {
    const label = `Budget-Konfiguration.rules[${index}]`;
    requireObject(rule, label);
    if (typeof rule.path !== 'string' || rule.path.trim() === '') {
      throw new Error(`${label}.path muss eine nichtleere Zeichenkette sein.`);
    }
    if (rule.direction !== 'lower' && rule.direction !== 'higher') {
      throw new Error(`${label}.direction muss "lower" oder "higher" sein.`);
    }

    const relative = rule.maxRelativeRegression;
    const absolute = rule.maxAbsoluteRegression;
    if (relative === undefined && absolute === undefined) {
      throw new Error(`${label} benötigt maxRelativeRegression oder maxAbsoluteRegression.`);
    }
    if (
      relative !== undefined &&
      (typeof relative !== 'number' || !Number.isFinite(relative) || relative < 0)
    ) {
      throw new Error(`${label}.maxRelativeRegression muss eine endliche Zahl >= 0 sein.`);
    }
    if (
      absolute !== undefined &&
      (typeof absolute !== 'number' || !Number.isFinite(absolute) || absolute < 0)
    ) {
      throw new Error(`${label}.maxAbsoluteRegression muss eine endliche Zahl >= 0 sein.`);
    }

    return {
      path: rule.path.trim(),
      direction: rule.direction,
      maxRelativeRegression: relative,
      maxAbsoluteRegression: absolute,
    };
  });
}

function readMetric(report, configuredPath, reportLabel) {
  const path = configuredPath.startsWith('metrics.')
    ? configuredPath.slice('metrics.'.length)
    : configuredPath;
  const segments = path.split('.');
  if (
    segments.some(
      (segment) =>
        segment === '' ||
        segment === '__proto__' ||
        segment === 'prototype' ||
        segment === 'constructor',
    )
  ) {
    throw new Error(`Ungültiger Metrikpfad: "${configuredPath}".`);
  }

  let value = report.metrics;
  for (const segment of segments) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, segment)) {
      throw new Error(`${reportLabel}: Metrik "${configuredPath}" fehlt.`);
    }
    value = value[segment];
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${reportLabel}: Metrik "${configuredPath}" muss eine endliche Zahl sein.`);
  }
  return value;
}

export function compareLoadReports(current, baseline, config) {
  validateReport(current, 'Aktueller Report');
  validateReport(baseline, 'Baseline-Report');
  const rules = validateBudgetConfig(config);

  return rules.map((rule) => {
    const currentValue = readMetric(current, rule.path, 'Aktueller Report');
    const baselineValue = readMetric(baseline, rule.path, 'Baseline-Report');
    const regression =
      rule.direction === 'lower'
        ? Math.max(0, currentValue - baselineValue)
        : Math.max(0, baselineValue - currentValue);
    const relativeTolerance =
      rule.maxRelativeRegression === undefined
        ? 0
        : Math.abs(baselineValue) * rule.maxRelativeRegression;
    const absoluteTolerance = rule.maxAbsoluteRegression ?? 0;
    const allowedRegression = Math.max(relativeTolerance, absoluteTolerance);
    const roundingTolerance =
      Number.EPSILON *
      Math.max(1, Math.abs(currentValue), Math.abs(baselineValue), allowedRegression) *
      8;

    return {
      path: rule.path,
      direction: rule.direction,
      current: currentValue,
      baseline: baselineValue,
      regression,
      allowedRegression,
      relativeRegression: baselineValue === 0 ? null : regression / Math.abs(baselineValue),
      passed: regression <= allowedRegression + roundingTolerance,
    };
  });
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : Number(value.toPrecision(8)).toString();
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  if (arguments_.help) {
    process.stdout.write(HELP);
    return;
  }

  const missing = [
    ['current', arguments_.current],
    ['baseline', arguments_.baseline],
    ['config', arguments_.config],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Fehlende Eingabe(n): ${missing.join(', ')}. Details mit --help.`);
  }

  const [current, baseline, config] = await Promise.all([
    readJson(arguments_.current, 'Aktueller Report'),
    readJson(arguments_.baseline, 'Baseline-Report'),
    readJson(arguments_.config, 'Budget-Konfiguration'),
  ]);
  const results = compareLoadReports(current, baseline, config);

  for (const result of results) {
    const status = result.passed ? 'OK' : 'REGRESSION';
    console.log(
      `${status} ${result.path}: aktuell=${formatNumber(result.current)}, ` +
        `baseline=${formatNumber(result.baseline)}, ` +
        `Regression=${formatNumber(result.regression)}, ` +
        `Budget=${formatNumber(result.allowedRegression)}`,
    );
  }

  const regressions = results.filter((result) => !result.passed);
  if (regressions.length > 0) {
    console.error(
      `${regressions.length} von ${results.length} Metrik(en) überschreiten das Regressionsbudget.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Alle ${results.length} Metrik(en) liegen innerhalb des Regressionsbudgets.`);
}

const isDirectInvocation =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  main().catch((error) => {
    console.error(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  });
}
