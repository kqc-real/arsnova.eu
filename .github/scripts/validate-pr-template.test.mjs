import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXPECTED_SELF_REVIEW_ITEMS,
  validatePrTemplateBody,
} from './validate-pr-template.mjs';

function buildValidBody(options = {}) {
  const {
    checkedSelfReview = EXPECTED_SELF_REVIEW_ITEMS,
    risk = 'Mittel',
  } = options;

  const selfReviewLines = Array.from({ length: EXPECTED_SELF_REVIEW_ITEMS }, (_, index) =>
    index < checkedSelfReview
      ? `- [x] Selbstreview-Punkt ${index + 1}`
      : `- [ ] Selbstreview-Punkt ${index + 1}`,
  ).join('\n');

  const risks = ['Niedrig', 'Mittel', 'Hoch']
    .map((level) => `- [${level === risk ? 'x' : ' '}] ${level}`)
    .join('\n');

  return `## Zusammenfassung

- **Problem:** Gate prüft unvollständige Beschreibungen.
- **Lösung:** Validierungsskript und Workflow.
- **Bewusste Nicht-Ziele:** Keine App-Runtime-Änderung.

## Risiko und Verträge

${risks}

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
| node --test | bestanden |

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
- **Verbleibende Risiken:** Keine bekannt.

## Selbstreview

${selfReviewLines}
`;
}

test('akzeptiert einen vollständigen PR-Body mit genau 8 Selbstreview-Punkten', () => {
  const result = validatePrTemplateBody(buildValidBody());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('lehnt 7 von 8 bestätigten Selbstreview-Punkten ab', () => {
  const result = validatePrTemplateBody(
    buildValidBody({ checkedSelfReview: EXPECTED_SELF_REVIEW_ITEMS - 1 }),
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) =>
      error.includes(
        `Selbstreview unvollständig: ${EXPECTED_SELF_REVIEW_ITEMS - 1} von ${EXPECTED_SELF_REVIEW_ITEMS}`,
      ),
    ),
    `erwartete Unvollständigkeitsmeldung, erhalten: ${result.errors.join('; ')}`,
  );
  assert.ok(
    result.errors.some((error) => error.includes('(1 offen)')),
    `erwartete offene Punkte in der Meldung, erhalten: ${result.errors.join('; ')}`,
  );
});

test('lehnt abweichende Selbstreview-Anzahl ab', () => {
  const body = buildValidBody().replace(
    '## Selbstreview\n\n',
    '## Selbstreview\n\n- [x] Extra-Punkt\n',
  );
  const result = validatePrTemplateBody(body);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) =>
      error.includes(`erwartet genau ${EXPECTED_SELF_REVIEW_ITEMS} Punkte, gefunden 9`),
    ),
  );
});
