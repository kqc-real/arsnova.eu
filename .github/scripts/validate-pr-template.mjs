/**
 * Validiert den PR-Body gegen `.github/pull_request_template.md`.
 * Genutzt vom Workflow `PR Template` und von Node-Tests.
 */

import { pathToFileURL } from 'node:url';

export const EXPECTED_SELF_REVIEW_ITEMS = 8;

const REQUIRED_HEADINGS = [
  'Zusammenfassung',
  'Risiko und Verträge',
  'Implementierung',
  'Verhaltens- und Abdeckungsprüfung',
  'Validierung',
  'Risikobezogene Prüfungen',
  'Betrieb und Rollback',
  'Nachweise',
  'Nicht zutreffend und verbleibende Risiken',
  'Selbstreview',
];

function section(body, title) {
  const marker = `## ${title}`;
  const start = body.indexOf(marker);
  if (start < 0) {
    return '';
  }
  const remainder = body.slice(start + marker.length);
  const nextHeading = remainder.search(/^##\s+/m);
  return nextHeading < 0 ? remainder : remainder.slice(0, nextHeading);
}

/**
 * @param {string} body
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validatePrTemplateBody(body) {
  const text = body ?? '';
  const errors = [];

  const normalizedLines = new Set(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );

  for (const heading of REQUIRED_HEADINGS) {
    if (!normalizedLines.has(`## ${heading}`)) {
      errors.push(`Pflichtabschnitt fehlt: "## ${heading}"`);
    }
  }

  for (const field of ['Problem', 'Lösung', 'Bewusste Nicht-Ziele']) {
    const pattern = new RegExp(`^- \\*\\*${field}:\\*\\*\\s+\\S`, 'm');
    if (!pattern.test(text)) {
      errors.push(`Zusammenfassungsfeld fehlt oder ist leer: "${field}"`);
    }
  }

  const riskLevels = ['Niedrig', 'Mittel', 'Hoch'];
  const selectedRisks = riskLevels.filter((risk) =>
    new RegExp(`^- \\[[xX]\\]\\s+${risk}\\b`, 'm').test(text),
  );
  if (selectedRisks.length !== 1) {
    errors.push(
      `Genau eine Risikostufe muss ausgewählt sein; gefunden: ${selectedRisks.length}`,
    );
  }

  const selfReview = section(text, 'Selbstreview');
  const checkedSelfReview = selfReview.match(/^- \[[xX]\]\s+/gm) ?? [];
  const uncheckedSelfReview = selfReview.match(/^- \[ \]\s+/gm) ?? [];
  const totalSelfReview = checkedSelfReview.length + uncheckedSelfReview.length;

  if (totalSelfReview !== EXPECTED_SELF_REVIEW_ITEMS) {
    errors.push(
      `Selbstreview: erwartet genau ${EXPECTED_SELF_REVIEW_ITEMS} Punkte, gefunden ${totalSelfReview}`,
    );
  }

  if (
    checkedSelfReview.length !== EXPECTED_SELF_REVIEW_ITEMS ||
    uncheckedSelfReview.length > 0
  ) {
    errors.push(
      `Selbstreview unvollständig: ${checkedSelfReview.length} von ${EXPECTED_SELF_REVIEW_ITEMS} Punkten bestätigt` +
        (uncheckedSelfReview.length > 0
          ? ` (${uncheckedSelfReview.length} offen)`
          : ''),
    );
  }

  const validation = section(text, 'Validierung');
  if (/^\|\s*\|\s*\|$/m.test(validation)) {
    errors.push('Die Tabelle „Ausgeführte Prüfungen und Ergebnisse“ ist noch leer');
  }

  if (!/^- \*\*Verbleibende Risiken:\*\*\s+\S/m.test(text)) {
    errors.push(
      'Das Feld „Verbleibende Risiken“ fehlt oder ist leer; gegebenenfalls „Keine bekannt“ eintragen',
    );
  }

  return { ok: errors.length === 0, errors };
}

function main() {
  const body = process.env.PR_BODY ?? '';
  const { ok, errors } = validatePrTemplateBody(body);
  if (!ok) {
    console.error('Die PR-Beschreibung entspricht nicht dem verbindlichen Template:\n');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    console.error('\nBitte .github/pull_request_template.md vollständig verwenden.');
    process.exit(1);
  }
  console.log('PR-Template vollständig ausgefüllt.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
