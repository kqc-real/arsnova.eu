<!-- markdownlint-disable MD013 -->

# ADR-0034: tRPC-DoD-Evidenz per Helper, Source-Fingerprint und Audit

**Status:** Proposed
**Datum:** 2026-08-05
**Entscheider:** Projektteam (Architektur-Checkpoint nach Slice 2B / Issue #222)
**Letzter Repo-Abgleich:** 2026-08-05

## Kontext

Die Backlog-DoD verlangt pro tRPC-Query/Mutation mindestens Happy Path und einen
fachlich relevanten Fehlerfall. Eine bloße Zählung von `caller.<procedure>()`-Aufrufen
überschätzt die Erfüllung: ein einzelner Aufruf, ein leeres `rejects` oder ein
indirekter Nebeneffekt beweist weder Happy Path noch Fehlervertrag.

Issue #222 fordert deshalb eine **formale, auditierbare Evidenzkonvention** und ein
späteres Non-Regression-Gate. Slice 2A validiert die Konvention an Fixtures. Slice 2B
wendet sie auf den vollständigen realen Routerbaum an, versioniert den Ausgangsstand
und veröffentlicht ihn als Bericht, ohne Evidenzschuld zu blockieren.

## Entscheidung

### 1. Formale Evidenz nur über den Vitest-Helper

Neue formale DoD-Evidenz wird ausschließlich über

`apps/backend/src/__tests__/test-utils/trpc-dod-evidence.ts`

registriert (`trpcDodIt`). Das Audit akzeptiert nur Call-Sites, deren lokaler
Bezeichner aus diesem Modul importiert ist (inkl. `import { trpcDodIt as alias }`).
Lokales Shadowing oder Imports aus anderen Modulen zählen nicht.

Pflichtfelder der Objektliteral-Metadaten:

| Feld        | Bedeutung                                                                        |
| ----------- | -------------------------------------------------------------------------------- |
| `procedure` | Stabile Router-/Prozedur-ID (`router.procedure`)                                 |
| `case`      | `happy` oder `error`                                                             |
| `mode`      | `direct` oder `indirect`                                                         |
| `contract`  | Bei `error` Pflicht: Eintrag aus `TRPC_DOD_KNOWN_CONTRACTS` oder `DOMAIN:<name>` |
| `rationale` | Bei `indirect` Pflicht; begründet, warum kein direkter Caller-Aufruf nötig ist   |
| `title`     | Anzeigetitel / Vitest-Titel                                                      |

`TRPC_DOD_KNOWN_CONTRACTS` ist die verbindliche Taxonomie: standardisierte tRPC-Codes
(`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `BAD_REQUEST`,
`TOO_MANY_REQUESTS`, `PRECONDITION_FAILED`, `TIMEOUT`, `PAYLOAD_TOO_LARGE`,
`INTERNAL_SERVER_ERROR`, `SERVICE_UNAVAILABLE`, …) plus semantisches `VALIDATION`
und `DOMAIN:<name>`. Der TypeScript-Typ lässt kein freies `| string` zu; Runtime-Audit
und Typdefinition lesen dieselbe Array-Quelle.

Beliebige `it(...)`-Tests mit Caller-Aufrufen zählen **nicht**. Evidenz in
`describe.skip` / `it.skip` / `skipIf` zählt nicht. Die fachliche Relevanz des
Testkörpers bleibt Review-Gegenstand; der Helper und das Audit prüfen
Metadatenkonvention, kanonische Import-Bindung und grobe Leerheitsregeln.

PoC-Direct-Evidenz muss die Fixture-Prozedur über `createCaller` tatsächlich
ausführen.

### 2. Inventur und Fingerprint per TypeScript-AST/Scanner

`scripts/audit-trpc-dod.mjs` inventarisiert Prozeduren strukturell (AST):

- Erkennung von `.query(`, `.mutation(`, `.subscription(` in `router({ ... })`-Objekten
- rekursive Auflösung der im `appRouter` gemounteten benannten Router-Imports,
  einschließlich verschachtelter Mounts wie `admin.motd`; nicht auflösbare Einträge
  sind Strukturfehler statt stiller Auslassungen
- stabile ID aus Router-Präfix + Property-Name
- Source-Fingerprint: SHA-256 über den mit dem TypeScript-Scanner
  (`skipTrivia: true`) normalisierten Tokenstrom — Kommentare/Whitespace entfallen,
  jedes Token wird eindeutig als `[SyntaxKind, Text]` serialisiert und Literal-Token
  (String, Template, Regex) bleiben unverändert

Rename = Löschung + neue ID. Geänderter Fingerprint = fachlich geänderte Prozedur
(Gate-Semantik ab Slice 2C).

### 3. Berichtsschema (Version 1)

Maschinenlesbarer Bericht ohne Wall-Clock-Zeitstempel oder umgebungsabhängige Felder
(deterministisch am gleichen Commit). Dateipfade und Berichtskollektionen werden
kanonisch sortiert.

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
Im Realmodus ergänzt der Bericht pro Prozedur den Baseline-Status
(`legacyDebt`, `missing`, `changed`) und auf Berichtsebene Baseline-Ursprung,
Strukturfehler sowie die Summen der Legacy-Schuld. Ein geänderter Fingerprint wird
in Slice 2B nur ausgewiesen; die Blockiersemantik folgt erst in Slice 2C.

### 4. Versionierte Baseline (Slice 2B)

Die Baseline liegt unter `.github/trpc-dod-baseline.json`. Schuld wird **pro
Dimension** (`happy` / `error`) versioniert — nicht als einzelner Boolean. Der
`originCommit` ist der letzte Router-Ursprung vor Slice 2B; `integrity` schützt die
kanonische Nutzlast vor unbemerkter oder nur teilweiser Manipulation:

```json
{
  "version": 1,
  "originCommit": "<git-sha>",
  "procedures": {
    "router.procedure": {
      "kind": "query",
      "fingerprint": "sha256:...",
      "missing": ["error"]
    }
  },
  "integrity": "sha256:<digest>"
}
```

Gate-Semantik (ab 2C): Eine Dimension, die in der Baseline abgedeckt war und später
fehlt, ist Verschlechterung (verboten). Das Schließen einer fehlenden Dimension
reduziert die Schuld. Ein Tausch Happy↔Error gilt als Verschlechterung auf der
verlorenen Dimension. `compareMissingDebt` im Audit-Skript prüft diese Übergänge.

Slice 2B aktiviert dieses Schuld-Gate ausdrücklich **noch nicht**. CI erzeugt nach
`npm ci` einen deterministischen JSON-/Markdown-Bericht, schreibt Markdown in die
Job Summary und lädt beide Dateien als `trpc-dod-report` hoch. Bestehende oder
veränderte Evidenzschuld bleibt Exit 0. Nur ungültige Inventur-/Baseline-Struktur,
Baseline-Integritätsfehler, unbekannte Procedure-IDs, verwaiste Einträge und
widersprüchliche doppelte Evidenz sind Fehler.

### 5. Initiale Klassifikation des realen Routerbaums

Stand `8efc52783a012309ffc9c89cd37f2790ae76bfb2`:

- 121 gemountete Prozeduren insgesamt
- 50 Queries und 63 Mutations (113 im DoD-Nenner)
- 8 Subscriptions (sichtbar, aber report-only)
- 113 Prozeduren mit Legacy-Schuld bzw. 226 fehlende Dimensionen

Außerhalb der Slice-2A-Fixtures existiert noch keine formale `trpcDodIt`-Evidenz.
Die früher ermittelten 28 direkten Caller-Lücken dienen nur als Plausibilitätsvergleich:
Sie beruhen auf einer anderen, schwächeren Heuristik und sind weder Nenner noch
Baseline für den neuen Audit.

### 6. PoC-Scope

Genau zwei Fixture-Queries/Mutations (`dodPoc.ping`, `dodPoc.echo`) plus eine
Subscription (`dodPoc.onTick`) unter
`apps/backend/src/__tests__/trpc-dod-poc/`. Echter tRPC-Router via
`publicProcedure`/`router`, nicht in `AppRouter` gemountet.

## Grenzen der statischen Semantikprüfung

Explizit **nicht** automatisch beweisbar:

- ob der Testkörper den genannten Fehlervertrag wirklich ausübt;
- ob ein `DOMAIN:*`-Vertrag fachlich der richtige ist;
- ob indirekte Evidenz die Produktionspfade hinreichend abdeckt;
- ob Mocks die Prozedur so weit stubben, dass der Test inhaltsleer wird;
- Laufzeit-`skip`/`todo` jenseits der statisch erkennbaren `describe.skip` /
  `it.skip` / `skipIf`-Kontexte.

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
  (nicht-literale Felder).
- False Positives möglich, wenn Metadaten und Caller korrekt sind, der Test aber
  fachlich schwach ist (bewusst Review, nicht Scanner).

## Alternativen (geprüft)

- **Regex über `caller.`-Aufrufe:** verworfen; belegt weder Happy noch Error-Vertrag.
- **Nur Coverage-Schwellen:** verworfen; Coverage ≠ vertragliche DoD.
- **Sofortiges 100-%-Gate auf dem Bestand:** verworfen; würde fachfremde PRs blockieren.

## Architektur-Checkpoint (Slice 2B)

Vor Slice 2C ausdrücklich im PR-Review bestätigen:

1. Vollständigkeit und IDs der rekursiven AppRouter-Inventur
2. Initiale Klassifikation 50 Queries / 63 Mutations / 8 Subscriptions
3. Versionierte Baseline mit 226 Legacy-Dimensionen und festem Ursprung
4. Fehlergrenzen zwischen struktureller Inkonsistenz und report-only Schuld
5. Determinismus und CI-Darstellung von JSON, Markdown, Job Summary und Artefakt
