<!-- markdownlint-disable MD013 -->

# ADR-0034: tRPC-DoD-Evidenz per Helper, Source-Fingerprint und Audit

**Status:** Accepted
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
wendet sie auf den vollständigen realen Routerbaum an und versioniert den
Ausgangsstand. Slice 2C aktiviert das Non-Regression-Gate, ohne unveränderte
Legacy-Schuld zu blockieren.

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

Der Realmodus deckt exakt den in `apps/backend/vitest.config.ts` festgelegten
Backend-Testscope `src/**/*.test.ts` ab, also auch Tests neben Implementierungen
unter `src/lib` oder `src/routers`. Ändert sich dieses Include, bricht der Audit
strukturell ab, bis der Matcher bewusst nachgezogen wird. Nur die separat in
Slice 2A ausgewerteten, nicht im `AppRouter` gemounteten PoC-Fixtures sind vom
Realmodus ausgeschlossen.

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
(`legacyDebt`, `missing`, `changed`, `new`) und auf Berichtsebene Baseline-Ursprung,
Strukturfehler, Gate-Verstöße, erforderliche Baseline-Änderungen sowie die Summen
der Legacy-Schuld. Jeder Gate-Verstoß nennt Prozedur-ID, Änderung (`new`, `changed`
oder `evidence_regression`) und die konkret fehlenden Evidenzdimensionen.

### 4. Versionierte Baseline und Non-Regression-Gate (Slices 2B/2C)

Die Baseline liegt unter `.github/trpc-dod-baseline.json`. Schuld wird **pro
Dimension** (`happy` / `error`) versioniert — nicht als einzelner Boolean. Der
`originCommit` ist der letzte Router- und Test-Ursprung vor Slice 2B:

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
  }
}
```

Ein in derselben Datei gespeicherter Hash wäre nur eine Konsistenzsumme und könnte
zusammen mit einer aufgeweichten Baseline neu berechnet werden. Stattdessen wird
der `originCommit` aus dem Inhalt des ersten Git-Commits gelockt, der die Baseline
enthält. Dieser Commit bleibt sowohl bei Merge-Commits als auch nach Squash- oder
Rebase-Merges der maßgebliche Einführungs-Snapshot; seine Eltern-Topologie ist
unerheblich. Das Audit exportiert Router, Vitest-Konfiguration und Testdateien sowohl
aus dem gelockten Ursprung als auch aus dem Einführungs-Snapshot, klassifiziert beide
mit der aktuellen Audit-Implementierung und verlangt identische Baseline-Einträge.
Der Ursprung muss außerdem ein Vorfahr des Einführungs-Commits sein. Spätere
gemeinsame Änderungen von Baseline und `originCommit` können diesen historischen
Anker nicht verschieben. CI checkt dafür die vollständige Historie aus.

Das Slice-2C-Gate verwendet folgende Regeln:

- eine neue Query/Mutation benötigt Happy- und Error-Evidenz;
- eine Query/Mutation mit geändertem Typ oder Source-Fingerprint benötigt ebenfalls
  beide Dimensionen, unabhängig von ihrer bisherigen Legacy-Schuld;
- unveränderte Legacy-Schuld bleibt zulässig;
- der Verlust einer bereits abgedeckten Dimension ist verboten; ein Tausch
  Happy↔Error verliert ebenfalls eine Dimension und ist daher eine Regression;
- eine geschlossene Legacy-Lücke muss in der Baseline festgeschrieben werden;
- Rename ist Löschung plus neue ID, gelöschte IDs müssen entfernt werden;
- Subscriptions werden inventarisiert und fortgeschrieben, ihre Evidenz blockiert
  das Query-/Mutation-Gate jedoch nicht.

Code und Baseline können das Gate nicht gemeinsam umgehen. Die initiale Baseline
wird weiterhin aus `originCommit` und dem Einführungs-Commit rekonstruiert. Zusätzlich
vergleicht das Audit die aktuelle Baseline mit allen erreichbaren, früher
committeten Baseline-Versionen: neue oder fingerprint-geänderte Queries/Mutations
dürfen nur mit leerer `missing`-Liste aufgenommen werden, und eine irgendwann
abgedeckte Dimension darf nie erneut als fehlend erscheinen. Damit bleibt eine
Verbesserung auch nach späteren Baseline-Updates geschützt; die Prüfung hängt nicht
vom Merge-, Squash- oder Rebase-Verfahren ab.

Die Anwesenheit einer Prozedur wird zusätzlich über jede aufeinanderfolgende
Baseline-Version geprüft. Fehlt eine ID in der unmittelbar vorherigen Version, ist
ein späteres Wiederauftauchen eine neue Prozedur — auch wenn ID, Typ und Fingerprint
mit einem älteren Legacy-Eintrag identisch sind. Sie darf daher nur vollständig,
also mit leerer `missing`-Liste, wieder aufgenommen werden. Alle bereits committeten
Versionsübergänge werden bei jedem Audit erneut geprüft, damit ein einmal
committierter Anwesenheits-Bypass nicht durch einen späteren Baseline-Commit
unsichtbar werden kann.

`npm run audit:trpc-dod -- --update-baseline` übernimmt ausschließlich einen
strukturell gültigen Zustand ohne Gate-Verstöße. Das Schreiben verwendet eine
exklusiv erzeugte Lockdatei, eine exklusiv erzeugte temporäre Datei und einen
atomaren Rename. Bei Konkurrenz oder Regression bleibt die bestehende Baseline
unverändert. Nach erfolgreicher Aktualisierung müssen Baseline und aktuelle
Inventur exakt übereinstimmen.

CI erzeugt nach `npm ci` weiterhin einen deterministischen JSON-/Markdown-Bericht,
schreibt Markdown in die Job Summary und lädt beide Dateien als
`trpc-dod-report` hoch. Exit 1 bezeichnet Gate-Verstöße oder noch nicht übernommene
Baseline-Änderungen, Exit 2 strukturelle Inventur-, Evidenz-, Historien- oder
Baseline-Fehler. Die initiale Baseline-Erzeugung nutzt weiterhin einen exklusiven
Create und überschreibt nie eine vorhandene Datei.

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

Das Gate verhindert neue **formale** Schuld und Baseline-Aufweichen; es
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

## Architektur-Checkpoint (Slice 2C)

Vor Slice 2D ausdrücklich im PR-Review bestätigen:

1. Neue und fingerprint-geänderte Queries/Mutations blockieren ohne vollständige
   Happy-/Error-Evidenz.
2. Unveränderte 226 Legacy-Dimensionen bleiben nicht blockierend.
3. Verbesserungen werden monoton übernommen; gemeinsame Code-/Baseline-Aufweichung
   und konkurrierende Updates werden abgewiesen.
4. Rename, Löschung und Subscriptions folgen den dokumentierten Regeln.
5. CI nennt Prozedur, Änderung und fehlende Evidenz und veröffentlicht weiterhin
   JSON, Markdown, Job Summary und Artefakt.
