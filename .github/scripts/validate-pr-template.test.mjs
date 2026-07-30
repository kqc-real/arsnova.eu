import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXPECTED_SELF_REVIEW_ITEMS,
  EXPECTED_SELF_REVIEW_TEXTS,
  validatePrTemplateBody,
} from './validate-pr-template.mjs';

function selfReviewBlock(options = {}) {
  const {
    checked = Object.fromEntries(EXPECTED_SELF_REVIEW_TEXTS.map((text) => [text, true])),
    texts = EXPECTED_SELF_REVIEW_TEXTS,
  } = options;

  return texts
    .map((text) => {
      const mark = checked[text] === false ? ' ' : 'x';
      // Mehrzeilige Template-Punkte wie im Original andeuten
      if (text.includes('PR-Beschreibung widersprechen')) {
        return `- [${mark}] Code, Tests, Schemas, Dokumentation, Konfiguration, Übersetzungen und\n      PR-Beschreibung widersprechen sich nicht`;
      }
      if (text.includes('Performanceaussagen sind durch Nachweise')) {
        return `- [${mark}] Sicherheits-, Barrierefreiheits-, Kompatibilitäts- und\n      Performanceaussagen sind durch Nachweise gedeckt`;
      }
      if (text.includes('Keine asynchrone UI-Änderung')) {
        return `- [${mark}] Keine asynchrone UI-Änderung oder Erfolg, Pending, Fehler und Fokus wurden\n      anhand des tatsächlichen DOM-Ablaufs geprüft`;
      }
      return `- [${mark}] ${text}`;
    })
    .join('\n');
}

function buildValidBody(options = {}) {
  const {
    problem = 'Gate prüft unvollständige Beschreibungen.',
    residualRisks = 'Keine bekannt.',
    riskLines = ['- [ ] Niedrig', '- [x] Mittel', '- [ ] Hoch'],
    validationRows = ['| node --test | bestanden |'],
    selfReview = selfReviewBlock(),
  } = options;

  return `## Zusammenfassung

- **Problem:** ${problem}
- **Lösung:** Validierungsskript und Workflow.
- **Bewusste Nicht-Ziele:** Keine App-Runtime-Änderung.

## Risiko und Verträge

${riskLines.join('\n')}

**Maßgebliche Quelle und relevante Invarianten:**

PR-Template.

**Betroffene externe Verträge:**

Keine.

## Implementierung

- Validierung extrahiert.

## Verhaltens- und Abdeckungsprüfung

- [x] Gewünschtes Verhalten und maßgebliche Quelle wurden vor der Implementierung geklärt

### Relevante Zustandsübergänge

- [x] Nicht zustandsbehaftete Änderung

## Validierung

### Ausgeführte Prüfungen und Ergebnisse

| Prüfung/Befehl | Ergebnis |
| -------------- | -------- |
${validationRows.join('\n')}

## Risikobezogene Prüfungen

- [x] Keine Benutzeroberflächenänderung oder mobile Darstellung geprüft

## Betrieb und Rollback

- **Auswirkung auf Produktion:** Keine.
- **Erforderliche Konfigurations- oder Deployment-Schritte:** Keine.
- **Beobachtbarkeit beziehungsweise relevante Logs/Metriken:** Actions-Logs.
- **Rollback:** Workflow entfernen.

## Nachweise

- Unit-Tests

## Nicht zutreffend und verbleibende Risiken

- **Nicht zutreffende Prüfungen:** App-Runtime.
- **Verbleibende Risiken:** ${residualRisks}

## Selbstreview

${selfReview}
`;
}

test('akzeptiert einen vollständigen PR-Body mit den acht Template-Selbstreview-Punkten', () => {
  const result = validatePrTemplateBody(buildValidBody());
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.deepEqual(result.errors, []);
});

test('lehnt leere Zusammenfassungsfelder ab, auch wenn die nächste Zeile Text hat', () => {
  const body = buildValidBody({ problem: '' }).replace('- **Problem:** ', '- **Problem:**\n');
  const result = validatePrTemplateBody(body);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (error) => error.includes('Zusammenfassungsfeld') && error.includes('Problem'),
    ),
  );
});

test('lehnt leere verbleibende Risiken ab, auch wenn die nächste Überschrift folgt', () => {
  const body = buildValidBody({ residualRisks: '' }).replace(
    '- **Verbleibende Risiken:** ',
    '- **Verbleibende Risiken:**\n',
  );
  const result = validatePrTemplateBody(body);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('Verbleibende Risiken')));
});

test('lehnt Validierungstabelle nur mit Kopf und Trenner ab', () => {
  const result = validatePrTemplateBody(buildValidBody({ validationRows: [] }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('Datenzeile')));
});

test('lehnt Validierungstabelle mit leerer Datenzeile ab', () => {
  const result = validatePrTemplateBody(buildValidBody({ validationRows: ['|  |  |'] }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('Datenzeile')));
});

test('lehnt doppelte markierte Risikostufen ab', () => {
  const result = validatePrTemplateBody(
    buildValidBody({
      riskLines: ['- [x] Niedrig', '- [x] Niedrig', '- [ ] Mittel', '- [ ] Hoch'],
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('gefunden: 2')));
});

test('lehnt 7 von 8 bestätigten Selbstreview-Punkten ab', () => {
  const unchecked = EXPECTED_SELF_REVIEW_TEXTS[EXPECTED_SELF_REVIEW_ITEMS - 1];
  const result = validatePrTemplateBody(
    buildValidBody({
      selfReview: selfReviewBlock({
        checked: Object.fromEntries(
          EXPECTED_SELF_REVIEW_TEXTS.map((text) => [text, text !== unchecked]),
        ),
      }),
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes('nicht bestätigt') && error.includes(unchecked)),
  );
});

test('lehnt ersetzte Selbstreview-Texte ab', () => {
  const texts = [...EXPECTED_SELF_REVIEW_TEXTS];
  texts[0] = 'Beliebiger anderer Punkt';
  const result = validatePrTemplateBody(
    buildValidBody({
      selfReview: selfReviewBlock({ texts }),
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('fehlt oder weicht ab')));
  assert.ok(result.errors.some((error) => error.includes('Unerwartete Selbstreview-Punkte')));
});
