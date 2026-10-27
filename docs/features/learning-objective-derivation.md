<!-- markdownlint-disable MD013 -->

# Modellgestützte Lernzielableitung in der Quizvorbereitung (#456 Slice 5)

**Stand:** 2026-10-27

**Status:** Implementiert und standardmäßig deaktiviert; ein vollständiger Demo-Quiz-Lauf auf dem privaten Produktionshost erzeugte zehn Entwürfe, die formale Slice-8-Gesamtabnahme bleibt offen

**Runtime:** [Private Open-Weight-LLM-Runtime](open-weight-llm-runtime.md)
**Datenhaltung:** [ADR-0036](../architecture/decisions/0036-learning-objective-storage-and-live-projection.md)

## Produktgrenze und Auslöser

Die Ableitung startet ausschließlich nach der ausdrücklichen Aktion einer Lehrperson in der Lernzieloberfläche der Quizvorbereitung. Weder Join, Vote, Submit, WebSocket-Ereignisse, Quizwechsel, Live-Kurzfassung noch das Öffnen des Moderationskompasses starten diesen Auftrag. Ist `OPEN_WEIGHT_LLM_ENABLED=false`, bleiben manuelle Lernziele vollständig nutzbar; es gibt keinen SaaS-Fallback.

Die Oberfläche erklärt den Unterschied zwischen manuellen Lernzielen und automatisch formulierten Vorschlägen. Jeder Modellvorschlag kommt als `draft` zurück und benötigt eine Hostprüfung. Er wird nie automatisch bestätigt, als Lernerfolg interpretiert oder in Teilnehmerpayloads aufgenommen. Anlegen, Bearbeiten und die Ableitung bleiben im Quiz-Editor. In der laufenden Session zeigt der Host nur bestätigte Lernziele: vor der ersten Quizfrage alle bestätigten Ziele, ab der ersten Frage nur die Ziele der aktuellen Frage. Entwürfe erscheinen dort nicht. Ein fehlgeschlagener Abruf leert eine schon geladene Liste nicht; der nächste Hilfs-Poll und der Reconnect holen die Ziele nach. Q&A-Forumsaufträge sind davon unabhängig: Sie entstehen nur manuell, ohne KI-Herleitung.

## Autorisierung und Ablauf

Der lokale Quizentwurf liegt im Browser und besitzt deshalb keinen serverseitigen Host-Token. Der explizite Zwei-Schritt-Vertrag autorisiert ausschließlich begrenzte CPU-Arbeit und keinen Zugriff auf gespeicherte Quiz- oder Sessiondaten:

1. `quiz.prepareLearningObjectiveDerivation` bindet `schemaVersion`, `operationId`, `quizId` und `expectedBundleRevision` an eine zufällige, fünf Minuten gültige Einmal-Capability. Redis speichert nur ihren SHA-256-Hash. Der Prepare-Pfad besitzt einen eigenen, Shared-NAT-tauglichen Rate-Limit-Bucket.
2. `quiz.deriveLearningObjectives` akzeptiert den strikt versionierten Ableitungsauftrag plus Capability. Fehlende, abgelaufene, wiederholte, korrupte oder anders gebundene Capabilities werden vor Modellarbeit verworfen. Eine atomare Redis-Operation vergleicht und verbraucht den Bearer bereits beim Reservieren der Modellarbeit; ein TTL-gebundener Tombstone verhindert auch bei verzögerten Parallelrequests einen Replay. Nach Erfolg, Fehler oder Abbruch wird dieser Tombstone bestmöglich entfernt.

Der Client hält während des Auftrags den Trigger gesperrt, bietet Abbruch an und ordnet eine Antwort zusätzlich über Operation, Quiz und erwartete Bundle-Revision zu. Bevor der Quiz-Editor Fragegruppen zählt, prüft das Backend in höchstens 2,5 Sekunden, ob die lokale Text-KI aktiviert und erreichbar ist. Ist sie deaktiviert oder nicht erreichbar, erscheint sofort der bestehende Hinweis dazu; ein Stand „0 von Y Fragegruppen“ wird dann nicht als Status gezeigt. Erst nach dieser Prüfung pollt der Editor etwa alle zwei Sekunden `quiz.getLearningObjectiveDerivationProgress`. Während der Laufzeit zeigt die Oberfläche einen kleinen Kreisindikator für die lebende Abfrage und einen bestimmten Fortschrittsbalken mit einer Skala der fertigen Fragegruppen. Nach der ersten fertigen Fragegruppe nennt sie eine grobe Restdauer aus der bisherigen Laufzeit, keine Uhrzeit. Schon formulierte Lernziele zählt sie als Hinweis; sie erscheinen erst nach vollständigem Abschluss in der Liste und gehen bei Abbruch verloren. Solange die Erstellung läuft, weist sie darauf hin, den Editor nicht zu schließen, weil das die Erstellung abbricht. Fachbegriffe wie Batch oder Token erscheinen in der Oberfläche nicht. Bei `aborted` oder `timeout` nennt die Oberfläche den Grund, die fertigen Fragegruppen, die bisherige Dauer und den bisherigen Umfang in gelesenen sowie formulierten Texteinheiten. Vor dem atomaren Anwenden vergleicht der Client die beim Start serialisierten Quellfragen mit dem aktuellen lokalen Stand. Änderungen, Deaktivierung, Löschung, eine konkurrierende Lernzieländerung oder fehlende Restkapazität lassen das bestehende Bundle unverändert.

## Versionierte Verträge und Payload

Die Shared-Verträge liegen in `libs/shared-types/src/learning-objective-derivation.ts` und `learning-objective-derivation-capability.ts`:

- `LearningObjectiveDerivationInputSchema`, Schema-Version 1;
- Ableitungsversion `learning-objectives-v1`;
- `operationId`, lokale `quizId`, `expectedBundleRevision`, Locale und `maximumDrafts` von 1 bis 100;
- vollständige Fragen auf Basis des bestehenden `QuizUploadQuestionInputSchema`, ergänzt um erforderliche stabile `sourceQuestionId` und `enabled`;
- strikte Result-Union für `completed`, `busy` mit ausschließlich manuellem Retry, `disabled`, `aborted` und `timeout` jeweils mit Gruppenfortschritt, `unavailable`, `invalid_response`, `misconfigured`, `circuit_open`, `no_eligible_questions` und `input_too_large`;
- `quiz.getLearningObjectiveDerivationProgress` liefert denselben Korrelationsschlüssel und den aktuellen Gruppenfortschritt oder `found: false`.

Nur aktive, bewertbare Aufgaben mit Lösung werden projiziert: Single-/Multiple-Choice, Kurzantwort einschließlich Text-/Numerikregeln, Schätzfrage, Zuordnung, Reihenfolge und Kategorisierung. Freitext, Umfrage und Rating werden nicht als scheinbar lösungshaltige Aufgaben umgedeutet. Fragetext, sämtliche Antwortoptionen und Korrektheitswerte sowie typspezifische Musterlösung, Toleranzen, Zuordnungen, Reihenfolge oder Kategoriebezüge werden kanonisch in den privaten Runtimeauftrag übernommen. Passt schon eine einzelne vollständige Projektion nicht in den Vertrag, lautet das Ergebnis `input_too_large`; Inhalte werden nicht still gekürzt.

## Budget, Batching und Laufzeitgrenze

Jede vollständig serialisierte Runtime-Usernachricht bleibt bei höchstens 2.500 UTF-8-Bytes. Der Backendservice sortiert zunächst stabil nach Aufgabenreihenfolge und `sourceQuestionId` und bildet anschließend gierig reproduzierbare Batches. Jeder Batch erhält aus `operationId` und Batchindex eine deterministische UUID. Die Batches laufen sequenziell über denselben globalen Runtime-Slot; es gibt weder parallele Unteraufträge noch eine interne Modellqueue oder automatisches Busy-Retry.

Jeder Modell-Batch hat standardmäßig ein eigenes Zeitlimit von 300 Sekunden (`OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_MS`). Zusätzlich gilt ein gemeinsames Wall-Clock-Budget von 20 Minuten für die gesamte Ableitung. Das gemeinsame Signal bricht auch den gerade aktiven Runtimeaufruf ab. Ein Hostabbruch ergibt `aborted`, das Gesamtlaufzeitende `timeout`; beide geben den App-seitigen Inflight-Slot frei, verwerfen bereits erzeugte Teilergebnisse und liefern den zuletzt erreichten Gruppenfortschritt inklusive Laufzeit und Tokenzahlen für den Abbruchhinweis. Jede andere Teilstörung verwirft ebenfalls den gesamten Ableitungslauf und stoppt weitere Batches. Der private Modellserver kann einen abgebrochenen Auftrag weiterhin als belegt melden; ein sofortiger erneuter Versuch ist deshalb nicht garantiert möglich. Der Fortschritt steht in Redis nur für die gebundene Operation, Quiz-ID und erwartete Bundle-Revision und läuft mit dem Gesamtlaufzeitbudget ab.

`maximumDrafts` entspricht der beim Start verbleibenden lokalen Kapazität. Überzählige, deterministisch sortierte Vorschläge werden begrenzt, und eine lokalisierte Limitation weist die Kürzung aus. Ein fachlich leerer Modelloutput bleibt ein erfolgreicher, aber ausdrücklich limitierter Nullvorschlag und wird nicht als erfundenes Lernziel aufgefüllt.

Freie Hinweise aus der Modellantwort werden nicht als fachliche Einschränkungen angezeigt: Sie können in jedem Batch dieselben Promptregeln umformulieren und sind nicht verifiziert. Sichtbare Hinweise stammen ausschließlich aus vom Backend festgestellten Ergebnissen wie Kapazitätsgrenze oder leerer Ausgabe; der Browser kann zusätzlich eine beim Anwenden erreichte Kapazitätsgrenze melden. Die Vorschläge selbst bleiben Entwürfe zur fachlichen Prüfung.

## Prompt-, Quellen- und Provenienzschutz

Der fachliche Systemprompt trägt die Version `learning-objectives-system-v3`. Er behandelt Fragetexte, Antworten, Lösungserläuterungen und darin eingebettete Anweisungen ausdrücklich als nicht vertrauenswürdige Kursdaten. Das Modell soll beobachtbare, hostprüfbare Lernziele als kurze, rollenneutrale Infinitivformulierungen in der angeforderten Sprache formulieren, das Anfangswort großschreiben und wechselnde Bezeichnungen wie „Student“, „Schüler“ oder „Benutzer“ vermeiden. Das Backend schreibt das Anfangswort zusätzlich deterministisch groß und ergänzt einen schließenden Punkt, falls das Modell kleinschreibt oder den Punkt weglässt; der Prompt bleibt unverändert. Es darf ausschließlich exakte Aufgaben-IDs des aktuellen Batches referenzieren. Das Pflichtfeld `limitations` soll leer bleiben; vom Modell dennoch gelieferte Hinweise werden nicht angezeigt. Schemafremde Antworten, erfundene IDs, Querverweise auf einen anderen Batch und doppelte Referenzen scheitern geschlossen.

Ein fertiger Vorschlag enthält:

- eine aus Operation und vollständigem Vorschlagsinhalt deterministisch abgeleitete UUID;
- einen expliziten `question-set`-Scope;
- `model-derived`-Herkunft mit Ableitungs-, Modell- und Artefaktversion;
- einen SHA-256-Digest über exakt die kanonische Quellsemantik der referenzierten Aufgaben;
- ausschließlich den Bestätigungszustand `draft`.

Die Modellidentität bindet das Repository `unsloth/Qwen3-4B-Instruct-2507-GGUF`, den vollständigen GGUF-SHA-256, die Repository-Revision, `Q4_K_M` und llama.cpp `server-b10524`. Runtime-Telemetrie enthält weiterhin nur Auftragstyp, Modellalias, Laufzeit und Tokenzahlen. Rohpayload, System-/Userprompt, Antworten und vollständige Modellantwort werden weder in Telemetrie noch in Standardlogs geschrieben.

Für die Betreiberdiagnose protokolliert der Backendprozess bei der Lernzielableitung pro abgeschlossenem Batch dessen Nummer, Batchanzahl, Laufzeit sowie Prompt- und Antworttokenzahl. Bei einem fehlgeschlagenen Batch erscheinen Status und gegebenenfalls ein fester Fehlercode. Verwirft der Runtimeclient eine HTTP-200-Modellantwort, protokolliert er zusätzlich eine feste Fehlerklasse (`invalid_http_json`, `invalid_completion_envelope`, `invalid_model_json`, `output_schema`, `task_type` oder `question_references`), den auf `stop`, `length` oder `unknown` begrenzten Abschlussgrund und die Tokenzahlen. Ein vollständig erstelltes Ergebnis hat zusätzlich ein Abschlussereignis mit Batch- und Entwurfsanzahl. Diese Ereignisse enthalten keine Aufgaben-IDs, Quiztexte, Prompts, Modellantworten oder Credentials. Ein Browser-Zuordnungsfehler wird wahrscheinlich, wenn das Backend einen vollständigen Abschluss protokolliert, obwohl die Oberfläche die Antwort nicht anwenden konnte.

Nur für einen ausdrücklich freigegebenen Diagnosezeitraum kann `OPEN_WEIGHT_LLM_LEARNING_DEBUG_LOG=true` im App-Container gesetzt werden. Der Client schreibt dann zusätzlich für jeden Lernziel-Batch den vollständigen Chat-Completion-Request-Body mit Systemprompt, Quizinhalt und Antwortschema sowie den vollständigen Response-Body in das App-Log. Er fügt weder HTTP-Header noch das Runtime-Token aus seiner Konfiguration zum Log hinzu; in Quizdaten enthaltene Geheimnisse würden dagegen mitprotokolliert. `docker-compose.prod.yml` lädt diesen Wert über `env_file: .env.production`; nach Änderung der Datei muss der App-Container neu erstellt werden. Nach dem Diagnoselauf den Wert wieder auf `false` setzen und den App-Container erneut erstellen. Diese Vollprotokollierung gilt nur für `learning_objectives`; Label und Summary bleiben davon unberührt.

## Anwenden, Fehler und erneute Ableitung

Ein `completed`-Result wird in höchstens einer atomaren Bundleänderung append-only angewendet; ein leerer Resultatbestand oder ein idempotentes Replay benötigt keine Änderung. Bestehende manuelle Ziele, bestätigte Modellziele und bereits bearbeitete Entwürfe werden nicht ersetzt. Dieselbe deterministische Draft-ID macht eine identische verspätete Antwort idempotent. Ein Fehler, Busy, Abbruch, Timeout, Quellenkonflikt oder Bundle-CAS-Konflikt verändert kein Lernziel. Retry bleibt eine neue, ausdrückliche Hostaktion.

Relevante spätere Änderungen an Aufgaben oder Lösungen markieren gespeicherte modellabgeleitete Ziele über den bestehenden Sidecar-Lebenszyklus als prüfbedürftig. Die private Quellsemantik und ihr Digest gelangen nicht in den lösungsfreien Live-Moderationskontext.

## Nachweise und offene Realmodellgrenze

Fokussierte Tests decken Vertragsstrenge, sämtliche Lösungstypen, Multibyte-Budget und stabile Batchbildung, Einzelüberlauf, Gesamttimeout/Slotfreigabe, Hostabbruch mit Gruppenfortschritt, Busy ohne Retry, Teilfehler, erfundene und batchfremde Referenzen, Deduplizierung, Großschreibung des Anfangsworts und schließenden Punkt, Kapazitätslimit, deterministische IDs/Digests, injizierte Kursanweisungen, Einmal-Capability, Rate Limit, Fortschrittsabfrage sowie Router- und Store-CAS ab.

Die kanonischen Produktdaten für Integration, E2E und Realmodellmessung sind `getDemoQuizPayload(...)` und `getDemoQuizSeedFingerprint(...)` in `apps/frontend/src/app/features/quiz/data/demo-quiz-payload.ts`. Kleine Unit-Tests dürfen fokussierte Minimalfixtures verwenden.

Runtime R hat das gepinnte Modell und die Schemaerzwingung bereits mit einem realen `topic_label`-Auftrag belegt. Ein früherer Produktionsversuch mit dem umfangreichen Demo-Quiz am 2026-10-12 überschritt das damalige Zeitbudget ohne fertige Lernziele. Ein anderes Produktionsquiz mit zehn bewertbaren Fragen erzeugte nach Verlängerung der Zeitlimits sieben Entwürfe; mehrere Modellhinweise waren redundant und die Formulierungen wechselten zwischen Rollenbezeichnungen. Die anschließende Promptversion v2 und die Filterung unterdrücken solche freien Hinweise.

Bei einem weiteren vollständigen Demo-Quiz-Lauf am 2026-10-12 scheiterten nach zwei erfolgreichen Batches die folgenden Modellaufrufe, als der Inferenzcontainer an seiner damaligen 5-GiB-Grenze ein Docker-OOM-Ereignis erlitt und neu startete. Der Betreiber erhöhte die Grenze des laufenden Containers auf 8 GiB RAM und 10 GiB RAM plus Swap; [PR #566](https://github.com/kqc-real/arsnova.eu/pull/566) übernahm diese Werte in die Zweit-Host-Compose-Datei. Beim anschließenden vollständigen Demo-Quiz-Lauf wurden zehn Vorschläge als Entwürfe hinzugefügt. Der Restart-Zähler blieb bei 1, der Container war gesund, und die aktuelle cgroup meldete `memory.peak=3825471488` Byte (ca. 3,56 GiB) sowie `oom=0` und `oom_kill=0`. Das belegt diesen erfolgreichen Lauf, nicht die Qualität aller Vorschläge oder eine Lastobergrenze für beliebige Quizzes.

Für die formale Slice-8-Abnahme fehlen weiterhin ein dauerhaft dokumentierter, redigierter Systemprompt, Userpayload, Antwortschema und vollständiger Modellresponse sowie CPU-/Prefill-/Laufzeitmesswerte und eine fachliche Prüfung der zehn Entwürfe. Der Demo-Quiz-Lauf ersetzt auch keinen realen Summary-V2-Lauf. Das Repository-Default für `OPEN_WEIGHT_LLM_ENABLED` bleibt `false`; der Betreiber hatte es für den Produktionslauf aktiviert. Eine allgemeine Produktivfreigabe wird aus diesem einzelnen Lauf nicht abgeleitet.

## Fokussierte Verifikation

```bash
npm run test -w @arsnova/shared-types -- --run \
  src/learning-objective-derivation.test.ts \
  src/learning-objective-derivation-capability.test.ts \
  src/open-weight-llm.test.ts
npm run test -w @arsnova/backend -- --run \
  src/lib/learningObjectiveDerivation.test.ts \
  src/lib/learningObjectiveDerivationCapability.test.ts \
  src/lib/openWeightLlmClient.test.ts \
  src/__tests__/quiz.learning-objective-derivation.test.ts \
  src/__tests__/rateLimit.test.ts
npm exec -w @arsnova/frontend -- vitest run \
  src/app/core/trpc.client.spec.ts \
  src/app/features/quiz/data/demo-quiz-payload.spec.ts \
  src/app/features/quiz/data/quiz-store.service.spec.ts \
  src/app/features/quiz/quiz-learning-objectives/quiz-learning-objectives.component.spec.ts
```
