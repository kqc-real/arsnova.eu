/**
 * Validiert den PR-Body gegen `.github/pull_request_template.md`.
 * Genutzt vom Workflow `PR Template` und von Node-Tests.
 */

import { pathToFileURL } from 'node:url';

export const EXPECTED_SELF_REVIEW_ITEMS = 8;

/** Normalisierte Pflichttexte der Selbstreview-Checkboxen (Reihenfolge wie im Template). */
export const EXPECTED_SELF_REVIEW_TEXTS = [
  'Der vollständige Diff wurde unabhängig noch einmal geprüft',
  'Aufgabenstellung und Akzeptanzkriterien wurden erneut mit dem Ergebnis verglichen',
  'Code, Tests, Schemas, Dokumentation, Konfiguration, Übersetzungen und PR-Beschreibung widersprechen sich nicht',
  'Vergleichbare Pfade enthalten den behobenen Fehler nicht weiterhin',
  'Temporärer Code, Debug-Ausgaben und überholte Kommentare wurden entfernt',
  'Sicherheits-, Barrierefreiheits-, Kompatibilitäts- und Performanceaussagen sind durch Nachweise gedeckt',
  'Der PR ist vollständig und bereit für ein Review',
  'Keine asynchrone UI-Änderung oder Erfolg, Pending, Fehler und Fokus wurden anhand des tatsächlichen DOM-Ablaufs geprüft',
];

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

const RISK_LEVELS = ['Niedrig', 'Mittel', 'Hoch'];

export function section(body, title) {
  const marker = `## ${title}`;
  const start = body.indexOf(marker);
  if (start < 0) {
    return '';
  }
  const remainder = body.slice(start + marker.length);
  const nextHeading = remainder.search(/^##\s+/m);
  return nextHeading < 0 ? remainder : remainder.slice(0, nextHeading);
}

export function normalizeCheckboxText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Liest Checkbox-Einträge inkl. fortgesetzter Einrückungszeilen.
 * @returns {{ checked: boolean, text: string }[]}
 */
export function parseCheckboxItems(sectionText) {
  const items = [];
  let current = null;

  for (const line of sectionText.split(/\r?\n/)) {
    const match = /^- \[([ xX])\]\s+(.*)$/.exec(line);
    if (match) {
      if (current) {
        items.push(current);
      }
      current = {
        checked: match[1].toLowerCase() === 'x',
        text: match[2].trim(),
      };
      continue;
    }
    if (current && /^\s+\S/.test(line)) {
      current.text = `${current.text} ${line.trim()}`;
    }
  }

  if (current) {
    items.push(current);
  }
  return items;
}

export function hasValidationDataRow(validationSection) {
  for (const rawLine of validationSection.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('|') || !line.endsWith('|')) {
      continue;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2) {
      continue;
    }
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
      continue;
    }
    if (/Prüfung\/Befehl/i.test(cells[0])) {
      continue;
    }
    if (cells[0].length > 0 && cells[1].length > 0) {
      return true;
    }
  }
  return false;
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
    // Wert muss in derselben Zeile stehen; \\s würde Newlines schlucken.
    const pattern = new RegExp(`^- \\*\\*${field}:\\*\\*[ \\t]+\\S`, 'm');
    if (!pattern.test(text)) {
      errors.push(`Zusammenfassungsfeld fehlt oder ist leer: "${field}"`);
    }
  }

  const riskSection = section(text, 'Risiko und Verträge');
  const selectedRiskRows = [
    ...riskSection.matchAll(/^- \[([xX])\][ \t]+(Niedrig|Mittel|Hoch)\b/gm),
  ];
  if (selectedRiskRows.length !== 1) {
    errors.push(
      `Genau eine Risikostufe muss ausgewählt sein; gefunden: ${selectedRiskRows.length}`,
    );
  }
  const unknownSelectedRisks = [...riskSection.matchAll(/^- \[([xX])\][ \t]+(\S[^\n]*)$/gm)].filter(
    (match) => !RISK_LEVELS.some((level) => match[2].startsWith(level)),
  );
  if (unknownSelectedRisks.length > 0) {
    errors.push(
      `Unbekannte markierte Risikostufe: ${unknownSelectedRisks
        .map((match) => match[2].trim())
        .join(', ')}`,
    );
  }

  const selfReviewItems = parseCheckboxItems(section(text, 'Selbstreview')).map((item) => ({
    checked: item.checked,
    text: normalizeCheckboxText(item.text),
  }));

  if (selfReviewItems.length !== EXPECTED_SELF_REVIEW_ITEMS) {
    errors.push(
      `Selbstreview: erwartet genau ${EXPECTED_SELF_REVIEW_ITEMS} Punkte, gefunden ${selfReviewItems.length}`,
    );
  }

  const expectedNormalized = EXPECTED_SELF_REVIEW_TEXTS.map(normalizeCheckboxText);
  for (const expected of expectedNormalized) {
    const match = selfReviewItems.find((item) => item.text === expected);
    if (!match) {
      errors.push(`Selbstreview-Pflichtpunkt fehlt oder weicht ab: "${expected}"`);
      continue;
    }
    if (!match.checked) {
      errors.push(`Selbstreview-Punkt ist nicht bestätigt: "${expected}"`);
    }
  }

  const unexpected = selfReviewItems.filter((item) => !expectedNormalized.includes(item.text));
  if (unexpected.length > 0) {
    errors.push(
      `Unerwartete Selbstreview-Punkte: ${unexpected.map((item) => `"${item.text}"`).join(', ')}`,
    );
  }

  const validation = section(text, 'Validierung');
  if (!hasValidationDataRow(validation)) {
    errors.push(
      'Die Tabelle „Ausgeführte Prüfungen und Ergebnisse“ braucht mindestens eine Datenzeile mit Befehl und Ergebnis',
    );
  }

  if (!/^- \*\*Verbleibende Risiken:\*\*[ \t]+\S/m.test(text)) {
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
