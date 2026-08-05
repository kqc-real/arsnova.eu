<!-- markdownlint-disable MD013 -->

# ADR-0034: tRPC-DoD-Evidenz per Helper, Source-Fingerprint und Audit

**Status:** Proposed
**Datum:** 2026-08-05
**Entscheider:** Projektteam (Architektur-Checkpoint nach Slice 2A / Issue #222)
**Letzter Repo-Abgleich:** 2026-08-05

## Kontext

Die Backlog-DoD verlangt pro tRPC-Query/Mutation mindestens Happy Path und einen
fachlich relevanten Fehlerfall. Eine bloße Zählung von `caller.<procedure>()`-Aufrufen
überschätzt die Erfüllung: ein einzelner Aufruf, ein leeres `rejects` oder ein
indirekter Nebeneffekt beweist weder Happy Path noch Fehlervertrag.

Issue #222 fordert deshalb eine **formale, auditierbare Evidenzkonvention** und ein
späteres Non-Regression-Gate. Slice 2A validiert die Konvention an Fixtures, ohne den
realen Routerbaum zu blockieren.

## Entscheidung

### 1. Formale Evidenz nur über den Vitest-Helper

Neue formale DoD-Evidenz wird ausschließlich über

`apps/backend/src/__tests__/test-utils/trpc-dod-evidence.ts`

registriert (`trpcDodIt`). Pflichtfelder der Objektliteral-Metadaten:

| Feld        | Bedeutung                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| `procedure` | Stabile Router-/Prozedur-ID (`router.procedure`)                                                             |
| `case`      | `happy` oder `error`                                                                                         |
| `mode`      | `direct` oder `indirect`                                                                                     |
| `contract`  | Bei `error` Pflicht: `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `CONFLICT` oder `DOMAIN:<name>` |
| `rationale` | Bei `indirect` Pflicht; begründet, warum kein direkter Caller-Aufruf nötig ist                               |
| `title`     | Anzeigetitel / Vitest-Titel                                                                                  |

Beliebige `it(...)`-Tests mit Caller-Aufrufen zählen **nicht**. Übersprungene Tests
zählen nicht. Die fachliche Relevanz des Testkörpers bleibt Review-Gegenstand; der
Helper und das Audit prüfen die Metadatenkonvention und grobe Leerheitsregeln, nicht
die didaktische Qualität der Assertion.

### 2. Inventur und Fingerprint per TypeScript-AST

`scripts/audit-trpc-dod.mjs` inventarisiert Prozeduren strukturell (AST):

- Erkennung von `.query(`, `.mutation(`, `.subscription(` in `router({ ... })`-Objekten
- stabile ID aus Router-Präfix + Property-Name
- Source-Fingerprint: SHA-256 über normalisierten Prozedur-Quelltext
  (Blockkommentare und Zeilenkommentare entfernt, Whitespace kollabiert)

Rename = Löschung + neue ID. Geänderter Fingerprint = fachlich geänderte Prozedur
(Gate-Semantik ab Slice 2C).

### 3. Berichtsschema (Version 1)

Maschinenlesbarer Bericht (Auszug):

```json
{
  "version": 1,
  "mode": "poc",
  "procedures": [
    {
      "id": "dodPoc.ping",
      "kind": "query",
      "sourceFile": "...",
      "fingerprint": "sha256:...",
      "status": "complete",
      "missing": [],
      "evidence": { "happy": [], "error": [] }
    }
  ],
  "summary": {
    "queriesMutations": 2,
    "subscriptions": 1,
    "complete": 1,
    "incomplete": 1,
    "untested": 0
  }
}
```

Statuswerte für Queries/Mutations: `complete` | `incomplete` | `untested`.
Subscriptions: `subscription_report_only` (nicht im Query-/Mutation-Nenner).

### 4. Baseline-Format (vorbereitet, noch nicht produktiv)

Ab Slice 2B versioniert unter `.github/trpc-dod-baseline.json`:

```json
{
  "version": 1,
  "originCommit": "<git-sha>",
  "procedures": {
    "router.procedure": {
      "kind": "query",
      "fingerprint": "sha256:...",
      "legacyIncomplete": true
    }
  }
}
```

Slice 2A erzeugt **keine** produktive Baseline und aktiviert **kein** blockierendes
CI-Gate.

### 5. PoC-Scope

Genau zwei Fixture-Queries/Mutations (`dodPoc.ping`, `dodPoc.echo`) plus eine
Subscription (`dodPoc.onTick`) unter
`apps/backend/src/__tests__/trpc-dod-poc/`. Nicht in `AppRouter` gemountet.

## Grenzen der statischen Semantikprüfung

Explizit **nicht** automatisch beweisbar:

- ob der Testkörper den genannten Fehlervertrag wirklich ausübt;
- ob ein `DOMAIN:*`-Vertrag fachlich der richtige ist;
- ob indirekte Evidenz die Produktionspfade hinreichend abdeckt;
- ob Mocks die Prozedur so weit stubben, dass der Test inhaltsleer wird;
- Laufzeit-`skip`/`todo` jenseits der statisch erkennbaren `it.skip`-Formen am Helper.

Das Gate (ab 2C) verhindert neue **formale** Schuld und Baseline-Aufweichen; es
ersetzt kein Review.

## Konsequenzen

### Positiv

- DoD-Erfüllung ist maschinenlesbar und deterministisch am gleichen Commit.
- Caller-Heuristiken können die Erfüllung nicht mehr stillschweigend behaupten.
- Subscriptions bleiben sichtbar, ohne den Query-/Mutation-Nenner zu verzerren.

### Negativ / Risiken

- Bestands-Tests müssen später schrittweise migriert werden (Slice 2D).
- False Negatives möglich, wenn Evidenz-Metadaten syntaktisch abweichen
  (nicht-literale Felder, umbenannter Helper-Import).
- False Positives möglich, wenn Metadaten korrekt sind, der Test aber schwach ist
  (bewusst Review, nicht Scanner).

## Alternativen (geprüft)

- **Regex über `caller.`-Aufrufe:** verworfen; belegt weder Happy noch Error-Vertrag.
- **Nur Coverage-Schwellen:** verworfen; Coverage ≠ vertragliche DoD.
- **Sofortiges 100-%-Gate auf dem Bestand:** verworfen; würde fachfremde PRs blockieren.

## Architektur-Checkpoint (Slice 2A)

Vor Slice 2B ausdrücklich im PR-Review bestätigen:

1. Helper-API und Pflichtfelder
2. Fingerprint-Normalisierung
3. Berichtsschema Version 1
4. Baseline-Format (Vorbereitung)
