# 1B-004: Echter Auftrag ist Summary V2 mit der 1C-Referenzfixture

- **Status:** methodisch (2026-11-12)
- **Kategorie:** Methodik

## Kontext

1B Schritt 2 lässt einen Label- oder einen Summary-Auftrag zu ([Auftrag 1B](../../didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md#gruppenauftrag-1b-private-inferenz-als-getrennte-serverrolle)). Für Summary V2 gibt es aus 1C eine Datenbank-Fixture, einen gemessenen Kontextpfad und Laborzahlen auf dem Laptop.

## Entscheidung

Gemessen wird ein Summary-V2-Auftrag (Autor, 2026-11-12). Daten: das Sechs-Fragen-Szenario aus #456 §12 wie `createReferenceScenario` in `apps/backend/src/__tests__/lib/qa-summary-pg-fixture.ts` (Texte und Stimmen aus den Referenzfixtures, 200 Teilnehmende). Ausgelöst wird über die echte App per tRPC (`qa.requestSummary`) mit echter Host-Authentisierung, ohne Mock der Tokenprüfung.

## Alternativen

- **Label-Auftrag:** verworfen; er braucht den Encoder und eine Wortwolke, und der Anschluss an die 1C-Befunde ginge verloren.
- **`createFullContextScenario`:** verworfen; es enthält einen Encoder-Themensnapshot, der Encoder ist im Aufbau aus.

## Belege

- [1B-Design, Abschnitt 4](../specs/2026-11-12-1b-zwei-host-design.md#4-der-auftrag-autor).
- 1C-Laborläufe mit derselben Fixture: [1C-Ergebnis](../1C-ergebnis.md).

## Folgen

- Kontextgröße und Budgets sind mit 1C vergleichbar; Abweichungen durch den neueren Codestand weist das Laufprotokoll aus.
- Erwarteter Endstatus ist `ready` / `extractive` / `invalid_response` ([ADR 1B-007](1B-007-umgang-mit-1c-fallen.md)).
