# Design: eigene Tests für Auftrag 1C (Punkte 3 und 4)

- **Stand:** 2026-10-24
- **Autor:** Jonas Weirauch (Rolle Y)
- **Issue:** [#10](https://github.com/NiklasSkulll/arsnova.eu/issues/10)
- **Branch:** `feature-1C-context-path`
- **Codebasis:** `main` `248029dc`. Das ist `v1.3.0` plus 228 Commits; die Baseline-Frage ist offen, siehe [00-rahmen](../rahmen/00-rahmen-und-pruefung.md#offene-fragen-an-den-prüfer).
- **Grundlage:**
  - [`1C/1C-diagrams.md`](../1C/1C-diagrams.md), sobald PR #11 gemergt ist: Befunde 1–7, Fallback-Tabelle, Belege je Station.
  - [`1C/1C-kontext-und-adapterpfad.md`](../1C/1C-kontext-und-adapterpfad.md), Testlücken G1–G11.

## 1. Zweck und Begründung

Auftrag 1C verlangt in Punkt 3 und 4 (`CLOUD-COMPUTING-REFERAT-PRUEFUNG.md` 4.3), dass Fehler- und Konsistenzverhalten **geprüft** wird:

- inkompatible Schemaversion;
- fehlender Kontextbereich;
- langsamer Empfänger;
- kein stiller Feldverlust;
- Host wartet nicht;
- Stimmenänderung und Quellenlöschung zwischen Auftrag und Ergebnis.

Die Diagramme belegen diese Eigenschaften bisher nur statisch (Datei:Zeile). Die Pflicht-Nachweiskette (4.1.3) verlangt mindestens einen **eigenen ausführbaren Test** und eine Untersuchung mit Hypothese, Gegenalternative, Befund mit Gültigkeitsgrenze und Entscheidung.

Die Tests haben zwei Aufgaben:

1. **Nachweis im Referat:** Jede statische Aussage, die das Referat trägt, wird durch einen ausführbaren Test bestätigt oder widerlegt. Beides ist ein gültiges Ergebnis.
2. **Beitrag zur PR an kqc-real:** Die Tests schließen echte Lücken im Repo. Sie folgen deshalb den Repo-Konventionen (AGENTS.md), laufen in der CI grün und lassen sich ohne Referatsbezug lesen.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**

- Fünf Testgruppen (T1–T5, Abschnitt 4), die die Lücken G1, „fehlender Bereich“, die Vorrangregel, „Host wartet nicht“ und die echte DB-Kette Stimme/Frage/Beitritt/Löschung → Hash schließen.
- Je Testfall sind Hypothese, Gegenhypothese und Entscheidungskriterium **vor** der Ausführung festgelegt (Abschnitt 4).
- Jeder Test ist nachweislich in der Lage zu scheitern (Abschnitt 5.3, Mutationsprobe).
- Ein reproduzierbares Protokoll liegt unter `docs/referat-thema-1/evidenz/1C/` (Abschnitt 6).

**Nicht-Ziele**

- Keine Änderung am Produktivcode. Deckt ein Test einen Fehler auf, wird das als Befund festgehalten. Über eine Korrektur wird getrennt entschieden, und sie bekommt eine eigene PR.
- Kein realer LLM-Lauf und keine Laufzeitmessung. Beides gehört zu 1C Schritt 2 bzw. 1B Schritte 1–2 und braucht den zweiten Host.
- Keine Frontend-Tests. Ausnahme ist ein bereits vorhandener Test, falls nötig.
- Keine Behebung von [kqc-real#611](https://github.com/kqc-real/arsnova.eu/issues/611), den Typfehlern in den Frontend-Specs.

**Anti-Ziele** (bei diesen Fehlern wäre die Arbeit gescheitert, selbst wenn alle Tests grün sind)

- **Tautologische Tests:** Ein Test, der das zu prüfende Verhalten selbst nachbaut, z. B. einen gemockten Hash, der „zufällig“ wechselt. Dann prüft der Test nur seine eigene Annahme.
- **Mocks am Prüfgegenstand:** Gemockt wird nur an Systemgrenzen, also DB, Host-Auth, Netz und Zeit, nie die Funktion, um die es geht.
- **Grüne Tests ohne Fehlschlag-Nachweis:** Ein Test, der nie rot war, belegt nichts. Deshalb ist die Mutationsprobe Pflicht (5.3).
- **Fremde Arbeit vermischt:** Keine fachfremden Änderungen, kein Formatier-Rauschen, kein Fix für #611 in dieser PR.
- **Unbelegte Aussagen im Referat:** Aussagen, die kein Test oder Protokoll stützt.

## 3. Rahmenbedingungen

- **Konventionen:** Tests liegen direkt neben dem Code (`lib/x.test.ts`). Router- und Postgres-Tests liegen unter `src/__tests__/`. Die Sprache der Testtitel folgt der jeweiligen Datei.
  - Die Queue-, Kontext- und Client-Tests sind deutsch.
  - Die Shared-Types- und `moderationQaContext`-Tests sind englisch.
  - Postgres-Suiten haben ein englisches `describe` mit dem Zusatz `(PostgreSQL)` und deutsche `it`.
- **Lint:** `no-explicit-any` ist ein Fehler. Typumgehungen laufen über `as unknown as …` oder `as never`.
- **Router-Prozeduren** brauchen `trpcDodIt`-Evidenz (`npm run audit:trpc-dod`).
- **Postgres-Tests** sind opt-in über ein Env-Flag (`describe.skipIf(!RUN_PG)`). Die CI führt sie nur aus, wenn sie im Job `migration` (Migration Drift, `ci.yml` Z. 284–397) ausdrücklich eingetragen sind. In `docs/TESTING.md` steht je Suite eine Beschreibung.
- **Laufzeit:** Node 24.18.0 (`.nvmrc`). Lokale Postgres- und Redis-Instanzen kommen aus `docker-compose.yml`.
- **Determinismus:** feste Zeitstempel wie in den Fixtures (`2026-01-15T10:05:00.000Z`) und keine Abhängigkeit von Wanduhr oder Reihenfolge. Zeitbasierte Tests verwenden kleine `timeoutMs` wie der bestehende Timeout-Test (`qaSummaryQueue.test.ts` Z. 252–285).

## 4. Testgruppen

Jeder Fall nennt **Hypothese (H)**, **Gegenhypothese (G)** und **Kriterium (K)**. K ist binär und vorab festgelegt. Ein Fall gilt als bestanden, wenn K erfüllt ist, und als widerlegt, wenn G eintritt. Beides wird protokolliert.

### T1: inkompatible Schemaversion (Lücke G1, Punkt 3)

Ziel: Eine falsche oder veraltete Vertragsversion wird an jeder Grenze abgewiesen. Dabei geht nichts still verloren, und es entsteht kein Teilergebnis.

Einordnung: Die Versionsfelder der Anfrage sind fest einkompiliert (`moderationSummaryContext.ts` Z. 793–836). T1.1–T1.5 prüfen deshalb die **Defekt-Absicherung** an den Vertragsgrenzen. Sie greifen, wenn ein Codefehler eine falsche Version erzeugt. Echte Versionskonflikte **zwischen Prozessen** prüfen T1.6 (LLM-Antwort) und T2.3 (Redis-Snapshot).

| Nr.  | Ebene / Datei                                                                                                                                                  | Fall                                                                                                                                    | H                                                                 | G                                        | K                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| T1.1 | Schema · `libs/shared-types/src/qa-summary-v2.test.ts` (erweitert den vorhandenen Test Z. 88–100, der `instructionVersion` und `outputContract` schon abdeckt) | `QaSummaryInferenceRequestV2Schema` mit `schemaVersion: 3` bzw. `requestContract: 'qa-summary-context-v3'`                              | wird abgelehnt                                                    | wird akzeptiert oder still korrigiert    | `safeParse(...).success === false`, Fehlerpfad nennt das Feld             |
| T1.2 | Zusammenbau · `moderationSummaryContext.test.ts`                                                                                                               | `assemblePreparedModerationSummaryContext` mit `promptContext.contractVersion` bzw. `schemaVersion` falsch                              | wirft (strikter Parse)                                            | liefert ein Ergebnis                     | wirft `ZodError`, kein Rückgabewert                                       |
| T1.3 | Job · `qaSummaryQueue.test.ts`                                                                                                                                 | `prepare` (2) wirft den `ZodError` aus T1.2                                                                                             | Job endet regelbasiert mit `context_unavailable`, Status `failed` | Absturz, hängender Job oder Modellaufruf | Ergebnis wie H; `processor` nicht aufgerufen; Queue danach leer           |
| T1.4 | Anfrage · `__tests__/qa.summary.test.ts`                                                                                                                       | `prepare` (1) wirft den `ZodError` bei `qa.requestSummary`                                                                              | Host bekommt `INTERNAL_SERVER_ERROR`, kein Job                    | `pending`, Job entsteht                  | TRPCError-Code wie H; kein Queue-Eintrag; `trpcDodIt`-Fall `error`        |
| T1.5 | Client · `openWeightLlmClient.test.ts`                                                                                                                         | V2-Anfrage mit manipuliertem `requestContract` an `runOpenWeightLlmSummaryV2`                                                           | `invalid_response` vor jedem Netzaufruf                           | Anfrage geht raus                        | Status wie H; `config` und `request` (Hooks) nicht aufgerufen             |
| T1.6 | Client · `openWeightLlmClient.test.ts`                                                                                                                         | **Echter Prozesskonflikt:** Der Server antwortet auf eine V2-Anfrage mit einer Ausgabe einer anderen Version (z. B. `schemaVersion: 1`) | `invalid_response`, keine Teilübernahme                           | Ausgabe wird übernommen                  | Status wie H (`openWeightLlmClient.ts` Z. 643–658 bzw. `parseCompletion`) |

Kennzeichnung: Alle Manipulationen entstehen per `structuredClone` aus gültigen Fixtures und stehen als **Negativprobe** im Testtitel. Der Produktivcode bleibt unverändert.

### T2: fehlender Kontextbereich (Punkt 3, „kein stiller Feldverlust“)

Datei: `apps/backend/src/lib/moderationQaContext.test.ts` (englisch). Aufruf über `collectQaTopicContext` wie der bestehende N7-Block (Z. 296–530).

| Nr.  | Fall                                                                                                        | H                                                                                                                                   | G                                                                                             | K                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T2.1 | `semanticEnabled: false`                                                                                    | Abschnitt bleibt erhalten: `topics.state = 'disabled'` mit Grund, `revision.state = 'not-applicable'`, Limitation `module-disabled` | Abschnitt fehlt oder ist leer ohne Grund                                                      | alle drei Felder wie H; keine Mitglieder-Abfrage (`qaQuestion.findMany` nicht aufgerufen); Kandidaten-Quellen unverändert                                                                                                                                                                                                                                                                                |
| T2.2 | Snapshot mit mehr als 500 Mitgliedern (mindestens zwei Topics, gültig nach `QaSemanticTopicSnapshotSchema`) | `topics.state = 'failed'` mit Grund, Limitation `analysis-failed`, keine DB-Abfrage                                                 | stilles Abschneiden auf 500                                                                   | Felder wie H; `findMany` nicht aufgerufen                                                                                                                                                                                                                                                                                                                                                                |
| T2.3 | **Echter Prozesskonflikt:** In Redis liegt ein Themen-Snapshot mit veralteter bzw. ungültiger Version       | Der Kontext weist aus, dass ein Snapshot vorhanden, aber unbrauchbar war (unterscheidbarer Zustand oder Grund)                      | Der Fall ist nicht von „noch keine Daten“ zu unterscheiden, d. h. stiller Informationsverlust | Ergebnisfelder (`topics.state`, `reason`, Limitations) protokolliert. **Vorab notierte Erwartung laut Code:** G tritt ein, weil `getLatestQaSemanticTopicSnapshot` bei fehlgeschlagenem `safeParse` `null` liefert (`wordCloudAnalysisCache.ts` Z. 623–624) und der Kontext dann wie bei fehlenden Daten `unavailable`/`no-data` meldet. Bestätigt sich G, ist das ein Befund und kein Testfehler (5.5). |

Hinweis: T2.1 erweitert einen bestehenden Test (Z. 506–529), der nur `state` prüft. Er bekommt keinen Doppeltest daneben. T2.3 braucht zwei Ebenen: den Cache-Getter mit einem ungültigen Redis-Wert (Datei `wordCloudAnalysisCache.test.ts`) und die Projektion im Kontext. Ein Test, der nur den Cache prüft, würde die Auswirkung auf den Kontext nicht belegen.

### T3: Vorrangregel nach der Inferenz (Punkt 4)

Datei: `qaSummaryQueue.test.ts` (deutsch). Hooks: `prepare` als Folge `before, before, after` wie Z. 175–199.

| Nr.  | Fall                                                                             | H                                                                                                                   | G                                       | K                                                                                   |
| ---- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| T3.1 | Hash ändert sich **und** Queue-Timeout                                           | `source_changed` gewinnt                                                                                            | `timeout`                               | `fallback.reason === 'source_changed'`, gebunden an prepare (3)                     |
| T3.2 | Hash ändert sich **und** der Client meldet einen Fehler (`unavailable`)          | `source_changed` gewinnt                                                                                            | Client-Grund                            | wie T3.1                                                                            |
| T3.3 | **Kontrolle:** Hash gleich, Client-Fehler                                        | Client-Grund bleibt erhalten                                                                                        | `source_changed` (falsch positiv)       | `fallback.reason === 'unavailable'`                                                 |
| T3.4 | **Charakterisierung:** Der Prozessor wirft eine Ausnahme statt eines Ergebnisses | Job endet in `catch` regelbasiert mit `context_unavailable`, Status `failed`; prepare (3) wird **nicht** aufgerufen | `source_changed`-Prüfung läuft trotzdem | Ergebnis wie H; `prepare` genau zweimal aufgerufen (`qaSummaryQueue.ts` Z. 373–396) |

Einspeisung des Client-Fehlers in T3.2 und T3.3 (**meine Wahl**): Der Prozessor **löst auf**, und zwar mit einem extraktiven Lauf und dem Grund `unavailable`. So liefert ihn auch der echte Adapter (`runPreparedQaSummary`, `qaSummaryRuntimeAdapter.ts` Z. 79–95 und 129–142). Der echte Adapter wirft bei Client-Fehlern nicht. T3.4 hält getrennt fest, was bei einer unerwarteten Ausnahme passiert: Dann entfällt die Quellenprüfung. Das ist eine Gültigkeitsgrenze für Befund 4.

T3.3 verhindert, dass T3.1 und T3.2 trivial bestehen, etwa weil die Queue immer `source_changed` meldet.

### T4: Host wartet nicht (Punkt 3)

Datei: `qaSummaryQueue.test.ts`. Der `processor` meldet seinen Start über ein Signal und hängt dann an einem Latch, das der Test erst später löst. Ablauf im Code: `requestQaSummary` reiht den Job ein und kehrt zurück. Der Job startet über `hooks.schedule` (Standard `setImmediate`, `qaSummaryQueue.ts` Z. 88–95 und 404–412) und ruft den Prozessor erst nach prepare (2) auf (Z. 297–330). Bei der Rückkehr der Anfrage hat der Prozessor also noch nicht begonnen.

| Nr.  | Fall                                         | H                                                                                     | G                                    | K                                                                                                                                                                                                                                          |
| ---- | -------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T4.1 | `requestQaSummary` bei blockiertem Prozessor | Die Anfrage kehrt mit `pending` zurück, unabhängig von Start und Dauer des Prozessors | Die Anfrage wartet auf den Prozessor | (1) Das Promise ist aufgelöst und der Status `pending`, **bevor** der Prozessor gestartet ist. (2) Nach dem Startsignal ist der Status weiterhin `pending` (Modellauftrag läuft). (3) Nach dem Lösen des Latches ist das Ergebnis `ready`. |

Abgrenzung zum vorhandenen Test (Z. 152–173): Der unterdrückt das Scheduling ganz und belegt nur „kein erneuter Kontextaufbau beim Polling“. T4.1 belegt die Entkopplung bei **laufendem** Modellauftrag.

### T5: echte Datenbankänderungen ändern den Hash (Punkt 4, Postgres)

Neue Datei: `apps/backend/src/__tests__/qa.summary-hash.pg.test.ts`.

- **Flag:** `RUN_PG_QA_SUMMARY_HASH_TESTS`.
- **Muster:** `qa.scale.pg.test.ts`. Fragen und Stimmen entstehen über die echten DB-Funktionen `arsnova_create_qa_question` und `arsnova_change_qa_vote`. Teilnehmende entstehen über `prisma.participant.create`, gelöscht wird über `prisma.qaQuestion.delete`.
- **Prüfgegenstand:** `snapshotHash` aus `prepareFreshModerationSummaryContext` gegen die **echte** Datenbank.
- **Gemockt** wird nur die Host-Autorisierung (Token-Prüfung über Redis, `hostAuth`), und zwar mit dem vorhandenen `buildHostAuthTestMock`. Grund: Die Tokenprüfung ist nicht Gegenstand von 1C, und so braucht der Test keinen Token-Bestand in Redis.
- **Redis** für Themen-Snapshot und Blitzlicht wird nach dem CI-Muster bereitgestellt (`REDIS_URL`). Lässt sich der Kontext ohne Redis nicht deterministisch bauen, wird das im Plan geklärt und hier nachgetragen.

| Nr.   | Fall                                                                                                                                                 | H                                                                                                     | G                                      | K                                                                                                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T5.0  | **Kontrolle Determinismus:** zweimal `prepare` ohne Änderung, und zweimal direktes Packen derselben Analyse am Packing-Cache vorbei                  | gleicher Hash in beiden Fällen                                                                        | Hash schwankt, z. B. durch Zeitstempel | Hashes gleich. Der Cache-Pfad belegt nur die Stabilität des Analyse-Hashes, deshalb belegt der direkte Pfad den Determinismus des Packens (`moderationPromptContextPacking.ts` Z. 1158–1166) |
| T5.1  | eine Q&A-Stimme dazwischen                                                                                                                           | Hash ändert sich; `meta.revisions.questionVotes` enthält die neue `qaRankingRevision`                 | Hash gleich                            | beide wie H                                                                                                                                                                                  |
| T5.2  | eine neue Frage                                                                                                                                      | Hash ändert sich; Revision steigt (Trigger `QaQuestion_track_insert`); die Frage erscheint als Quelle | Hash gleich                            | alle wie H                                                                                                                                                                                   |
| T5.3  | ein Beitritt                                                                                                                                         | Hash ändert sich; `questionVotes` enthält die neue `participantRevision`/`participantCount`           | Hash gleich                            | beide wie H                                                                                                                                                                                  |
| T5.4a | **Host löscht** eine Frage über den echten Router-Pfad (`qa.moderate`, Aktion `DELETE`, inkl. Markierung der Lernziel-Quellen, `qa.ts` Z. 1761–1767) | Hash ändert sich, die Frage fehlt in den Quellen                                                      | Hash gleich oder Quelle bleibt         | beide wie H                                                                                                                                                                                  |
| T5.4b | **Teilnehmende löschen** die eigene Frage (weich, `status: 'DELETED'`, `qa.ts` Z. 2096–2104, anderer Trigger)                                        | wie T5.4a                                                                                             | wie T5.4a                              | wie T5.4a                                                                                                                                                                                    |
| T5.5  | **Gegenprobe:** Quizstimme auf eine noch laufende Frage (Q&A-Revision unverändert)                                                                   | Hash bleibt gleich                                                                                    | Hash ändert sich                       | Hashes gleich. Bei Widerlegung wird Befund 3 im Referat korrigiert                                                                                                                           |

T5.0 ist Voraussetzung für alle anderen Fälle. Ohne stabilen Hash wäre jede gemessene Änderung wertlos. T5.5 prüft die Grenze der Aussage „fast jede Sitzungsänderung ändert den Hash“ (Befund 3) und kann sie widerlegen.

Hinweis zur Host-Autorisierung im Test: Das vorhandene `buildHostAuthTestMock` liest den Token nur aus `req` bzw. `connectionParams`, nicht aus `ctx.hostToken` (`__tests__/lib/hostAuth-vitest-mock.ts` Z. 15–20). `prepareFreshModerationSummaryContext` übergibt aber `{ hostToken }`. Der Mock für `extractHostToken` muss deshalb auch ohne `req` einen Token liefern, wie in `session.finalization-race.pg.test.ts` Z. 85.

CI und Doku: Ein neuer Schritt im Job `migration` mit `RUN_PG_QA_SUMMARY_HASH_TESTS=1` und `REDIS_URL`, dazu ein Abschnitt in `docs/TESTING.md` mit dem lokalen Startbefehl.

## 5. Methodik

### 5.1 Reihenfolge

1. **T1–T4 (Unit)** bestätigen das Verhalten der Komponenten in Isolation.
2. **T5 (Postgres)** bestätigt die Kette DB-Trigger → Revision → Hash, die in T3 nur simuliert ist (`withHash`).
3. Erst T3 und T5 **zusammen** belegen Punkt 4 vollständig. Für sich genommen ist T3 nur bedingt aussagekräftig.

### 5.2 Testtyp und TDD

Die Tests beschreiben **bestehendes** Verhalten (Charakterisierungstests). Ein klassisches „erst rot“ entsteht hier nicht von selbst. Den Nachweis, dass ein Test scheitern kann, liefert deshalb die Mutationsprobe (5.3). Neue Hilfsfunktionen im Test, z. B. eine Factory für Fehlerläufe, entstehen testgetrieben.

### 5.3 Mutationsprobe (Pflicht)

Für jede Testgruppe wird der Produktivcode **lokal und vorübergehend** gezielt so verändert, dass die Hypothese falsch würde. Der Test muss dann rot werden. Danach wird die Änderung verworfen (`git checkout -- <datei>`); sie wird nie committet.

| Gruppe             | Mutation                                                                                                                                           | Erwartung                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| T1                 | `.parse` → Rückgabe ohne Prüfung, bzw. `safeParse`-Abfrage im Client entfernen                                                                     | T1.2–T1.5 rot                                                                                                             |
| T2                 | den `disabled`-Zweig ohne Limitation zurückgeben                                                                                                   | T2.1 rot                                                                                                                  |
| T1.6               | Versionsprüfung der Ausgabe in `runOpenWeightLlmSummaryV2` entfernen (Z. 651–656)                                                                  | T1.6 rot                                                                                                                  |
| T2.3               | Keine Mutation nötig, falls G wie vorab erwartet eintritt (Befund). Tritt H ein: `safeParse`-Fehlschlag im Cache-Getter wieder auf `null` abbilden | T2.3 rot                                                                                                                  |
| T3                 | `timeout` vor `sourceChanged` prüfen (`qaSummaryQueue.ts` Z. 341–353)                                                                              | T3.1 rot, T3.3 grün                                                                                                       |
| T4                 | Job in `requestQaSummary` synchron ausführen (`await processJob(job)` vor der Rückkehr statt `pump()`)                                             | T4.1 rot (Kriterium 1) oder Zeitüberschreitung                                                                            |
| T5 (Stimme)        | Stimmenzähler aus der Projektion entfernen **und** `qaRankingRevision` aus `revisions.questionVotes` entfernen                                     | T5.1 rot (der Revisionsstring fehlt). Eine Mutation allein genügt nicht, weil die Zähler zusätzlich in den Hash eingehen. |
| T5 (Beitritt)      | `participantRevision`/`participantCount` aus `revisions.questionVotes` entfernen                                                                   | T5.3 rot                                                                                                                  |
| T5 (Hash-Material) | `meta` aus dem Hash-Material entfernen (`hashModerationPromptContextMaterial`)                                                                     | T5.3 rot, T5.0 grün                                                                                                       |

Protokolliert werden je Mutation der Diff, der Testlauf (rot) und die Rückkehr zu grün.

### 5.4 Gültigkeitsgrenzen (gehören ins Referat)

- **Unit (T1–T4)** belegt das Verhalten der Queue-, Kontext- und Client-Logik bei kontrollierten Eingaben. Nicht belegt sind Zeitverhalten unter Last, ein reales Modell und Netzfehler.
- **Postgres (T5)** belegt die Trigger und den Kontextaufbau auf PostgreSQL 16 mit dem Migrationsstand von `248029dc`. Nicht belegt sind Häufigkeiten unter echter Last (z. B. der Anteil von `source_changed` bei N Stimmen pro Sekunde) und das Verhalten am Tag `v1.3.0`.
- **Für alle Gruppen** gilt: Die Aussagen gelten für `main` `248029dc`. Abweichungen zu `v1.3.0` stehen in [`1C/1C-diagrams.md`](../1C/1C-diagrams.md#differences-to-v130).

### 5.5 Entscheidungsregel fürs Referat

| Ergebnis                                                                  | Folge                                                                                                                                                     |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H bestätigt                                                               | Aussage im Referat mit Testverweis und Gültigkeitsgrenze                                                                                                  |
| G eingetreten                                                             | Befund „Abweichung zwischen Code-Erwartung und Verhalten“; Korrektur des Referats und, falls ein Fehler im Produkt vorliegt, eigenes Issue bzw. eigene PR |
| Test nicht sinnvoll umsetzbar (z. B. T5 ohne Redis nicht deterministisch) | dokumentierte Einschränkung mit Begründung; kein Weglassen ohne Vermerk                                                                                   |

## 6. Nachweis und Reproduzierbarkeit

Protokoll: `docs/referat-thema-1/evidenz/1C/2026-10-24-tests.md`. Es enthält:

- Commit, Node- und TypeScript-Version, PostgreSQL- und Redis-Version.
- Exakte Befehle, z. B. `npm run test -w @arsnova/backend -- --run <dateien>` und den Postgres-Befehl mit Flag.
- Je Fall: Ergebnis (bestanden / widerlegt) und Testname.
- Die Mutationsprobe je Gruppe: Diff, roter Lauf, Rückkehr zu grün.
- CI-Lauf der PR (Run-ID, Job `migration`).
- Ausdrückliche Gültigkeitsgrenzen (5.4).

Keine Secrets, keine echten Personendaten. Alle Daten sind synthetisch.

## 7. Abgabeform

- **Commits:** je Testgruppe ein Commit nach Conventional Commits, z. B. `test(qa-summary): reject incompatible request contract versions`.
- **PR:** in den Fork-`main` mit vollständigem Template und `Closes #10` erst dann, wenn auch Schritt 2 erledigt ist. Sonst `Refs #10`.
- **Reihenfolge der Tests:** Unit-Tests vor dem Postgres-Test, damit die CI früh grün ist.
- **Upstream-Tauglichkeit:** Für die spätere PR an kqc-real werden die Testcommits ohne Referatsdateien übernommen (Branch von `upstream/main`).

## 8. Entscheidungen nach dem Builder-Check

Ein unabhängiger Prüfer hat die erste Fassung gegengelesen. Daraus folgende Entscheidungen:

- **Vom Autor entschieden:**
  - Echte Versionskonflikte zwischen Prozessen werden aufgenommen (T1.6, T2.3).
  - Beide Löschpfade werden abgedeckt (T5.4a, T5.4b).
- **Meine Wahl, mit Begründung im jeweiligen Abschnitt:**
  - T1.1 erweitert den vorhandenen Test.
  - Einspeisung des Client-Fehlers als aufgelöster Lauf, dazu T3.4 als Charakterisierung.
  - T4.1-Kriterium an den tatsächlichen Ablauf angepasst (Prozessor startet erst nach prepare (2)).
  - Wirksame Mutationen für T4 und T5.
  - T5.0 zusätzlich am Packing-Cache vorbei.
  - Hinweis zum Host-Auth-Mock.

Alle Kriterien stehen damit vor der ersten Ausführung fest. Spätere Änderungen an H, G oder K werden im Protokoll mit Begründung vermerkt.

## 9. Offene Punkte für den Plan

- T5: ob sich der Kontext deterministisch mit Redis aus der CI aufbauen lässt, oder ob Themen-Snapshot und Blitzlicht im Test bewusst leer bleiben (dann mit Vermerk).
- T1.4: ob der vorhandene `trpcDodIt`-Katalog den neuen Fehlerfall braucht und welcher `case`- bzw. `contract`-Wert passt.
- T2.2: wie ein gültiger Snapshot mit mehr als 500 Mitgliedern minimal gebaut wird (mindestens zwei Topics, eindeutige IDs, `analyzedQuestionCount ≥ 501`).

## Nachtrag: KI-Nutzung (2026-10-24, nach der Ausführung)

Dieses Design wurde mit Claude Code (Anthropic, Modell Claude Opus 5.5) entworfen und vom Autor vor der Ausführung freigegeben. Der übrige Inhalt ist seit der Freigabe unverändert; dieser Abschnitt ist der einzige Nachtrag. Einzelheiten zur KI-Nutzung: [`1C/1C-diagrams.md`](../1C/1C-diagrams.md#method-verification-and-ai-use).
