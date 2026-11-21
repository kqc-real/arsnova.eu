# Design: 1C Teil 2 – Ende-zu-Ende-Nachweis, Kostenmessung und Gegenvariante

- **Stand:** 2026-10-24
- **Autor:** Jonas Weirauch (Rolle Y)
- **Issue:** [#10](https://github.com/NiklasSkulll/arsnova.eu/issues/10)
- **Branch:** `feature-1C-context-path`
- **Codebasis:** `main` `248029dc` (`v1.3.0` plus 228 Commits), wie in Teil 1.
- **Vorgänger:** [Teil 1](2026-10-24-1c-tests-design.md) (T1–T5, modellfreie Vertrags- und Konsistenztests).
- **KI-Nutzung:** Entwurf mit Claude Code; siehe [KI-Nutzung](#9-ki-nutzung).

## 1. Zweck

Teil 1 prüft Komponenten einzeln (T1–T4) und die Kette Datenbank → Hash (T5). Ein unabhängiger Review hat danach festgestellt, dass Auftrag 1C damit noch nicht vollständig abgedeckt ist. Es fehlen:

- **Punkt 2:** ein Auftrag, der durch die versionierten Verträge **bis zur Runtime-Schnittstelle** verfolgt wird, und der Vergleich von Host-Vorschau und tatsächlich gesendeter Nutzlast für denselben Revisionsstand.
- **Punkt 3 und 4 Ende zu Ende:** Stimmenänderung und Quellenlöschung **während** eines echten Auftrags. T3 simuliert den Hash, und T5 läuft ohne Queue-Job.
- **Ergebnis:** die Kosten von Validierung und Kontextbereitstellung.
- **Nachweisformat 4.1.3:** Baselinelauf → Gegenvariante → vergleichbare Messdaten → Befund → Entscheidung.
- **Fixture:** das Sechs-Fragen-Szenario aus #456 Abschnitt 12 als feste Fixture.

Teil 2 schließt diese Lücken **ohne private Inferenz**. Der reale Lauf gegen die ausgelieferte private Runtime bleibt offen, bis die Laborinstanz verfügbar ist (Frage an den Prüfer, [00-rahmen](../rahmen/00-rahmen-und-pruefung.md#offene-fragen-an-den-prüfer)).

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**

- **E-Tests:** Ende-zu-Ende-Tests vom tRPC-Router über Queue, echten Kontextaufbau, echten Client und echtes HTTP bis zu einer lokalen **Test-Runtime**. Gegen PostgreSQL und Redis, CI-fähig.
- **M-Messungen:** eine reproduzierbare lokale Messreihe für Rückkehrzeit, Gesamtdauer und Kosten der Kontextbereitstellung und Validierung.
- **Gegenvariante V1** („keine Nachprüfung nach der Inferenz“) mit vorab festgelegter Entscheidungsregel.

**Nicht-Ziele**

- **Keine Änderung am Produktivcode.** Die Gegenvariante entsteht nur im Test über die vorhandene Queue-Schnittstelle `resetQaSummaryQueueForTests(hooks)`.
- **Keine Aussage über Modellqualität, Tokenizer oder Inferenzzeit.** Die Test-Runtime ist kein Modell.
- **Keine Messung von Liveaktionen unter Last.** Das ist Thema von 1A und 1B.
- **Keine synchrone Gegenvariante.** Die ist Teil des Einzelreferats (6er-Kurs), nicht von 1C.

**Anti-Ziele**

- Die Test-Runtime als „reale private Inferenz“ ausgeben. Sie ist laut 4.1.3 nur für „gezielte Fault-Injection oder kontrollierte Gegenvarianten“ zulässig. Jede Aussage nennt diese Grenze.
- Zeitwerte als Produktionswerte darstellen. Es sind lokale Relativwerte mit Hardware-Angabe.
- Hypothesen, Kriterien oder Entscheidungsregel nach der Messung ändern, ohne das im Protokoll zu vermerken.

## 3. Aufbau

### 3.1 Test-Runtime

Ein HTTP-Server im Testprozess auf `127.0.0.1` mit freiem Port. Der Client akzeptiert Loopback (`openWeightLlmConfig.ts` Z. 87–98), deshalb ist kein Produktionseingriff nötig.

- **`GET /slots?fail_on_no_slot=1`:** liefert 200.
- **`POST /v1/chat/completions`:**
  - speichert Methode, Pfad, Header und den **rohen Body**;
  - wartet eine konfigurierbare Verzögerung oder auf einen Latch;
  - führt optional eine Aktion aus, etwa eine DB-Änderung;
  - antwortet dann mit einer gültigen `QaSummaryModelOutputV2`-Ausgabe. Diese zitiert die erste Quelle aus dem empfangenen Kontext.
- **Varianten:**
  - „unerreichbar“: Port geschlossen;
  - „Negativprobe Vertrag“: Antwort mit fremder `schemaVersion`;
  - „langsam“: Verzögerung über dem Client-Timeout.

Konfiguration nur per Env im Test:

- `OPEN_WEIGHT_LLM_ENABLED=true`
- `OPEN_WEIGHT_LLM_URL=http://127.0.0.1:<port>`
- `OPEN_WEIGHT_LLM_TOKEN` (32 Zeichen, synthetisch)
- `OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS`
- `QA_SUMMARY_ENABLED` (oder das Flag, das `isQaSummaryEnabled` liest)

### 3.2 Fixture

Das Sechs-Fragen-Szenario aus #456 Abschnitt 12 wird als echte Datenbank-Fixture angelegt (Helfer im Test):

- **Fragen:** Texte A–F aus `MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1`.
- **Status und Stimmen:** aus `MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1`, d. h. positive und negative Stimmen je Frage.
- **Raumbezugsgröße:** N = 200 Teilnehmende.

Stimmen entstehen über die echte DB-Funktion `arsnova_change_qa_vote`, wie in T5. Zieht der Aufbau mit 200 Teilnehmenden die CI-Laufzeit unvertretbar in die Länge, wird die Teilnehmendenzahl für die E-Tests verkleinert und im Protokoll begründet. Die M-Messung bleibt bei N = 200.

Raumbezugsgröße, Stimmenzahlen und Sprache werden im Protokoll dokumentiert. Die Fixture beweist keinen Encoder-Erfolg (4.1.3).

### 3.3 Router-Pfad

Alle E-Tests rufen die echten tRPC-Prozeduren über einen Caller auf:

- `qa.summaryContextPreview`
- `qa.requestSummary`
- `qa.summaryRuntime`
- `qa.moderate`

Gemockt wird wie in T5 nur die Host-Tokenprüfung (`buildHostAuthTestMock`). Begründung wie dort.

## 4. Ende-zu-Ende-Fälle (E)

Neue Datei `apps/backend/src/__tests__/qa.summary-e2e.pg.test.ts` mit Flag `RUN_PG_QA_SUMMARY_E2E_TESTS`, dazu ein eigener CI-Schritt im Job `migration`. Testtitel ohne Referats-IDs (Lehre aus Teil 1). Die Zuordnung E-Nr. → Testtitel steht im Protokoll.

| Nr. | Punkt | Fall                                                                                                                                           | H                                                                                                                       | G                                                         | K                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | 2     | **Vorschau = Nutzlast.** Vorschau abrufen, dann ohne Änderung `requestSummary`; die Runtime antwortet sofort.                                  | Die gesendete Nutzlast ist genau der fachliche Kontext der Vorschau.                                                    | Abweichung (Feld fehlt, zusätzliches Feld, anderer Wert). | (1) `snapshotHash` der Vorschau = `snapshotHash` des Ergebnisses. (2) Die User-Nachricht im rohen Body ist **bytegleich** `canonicalModerationPromptJson(preview.promptContext.context)`. (3) Die beiden System-Nachrichten sind die Instruktions- und Definitionstexte, deren Versionen die Vorschau nennt. (4) Endstatus `ready`, Modus `full-context`, Aussage an eine gepackte Quelle gebunden. |
| E2  | 2     | **Trennung der Schichten.** Wie E1, Analyse des rohen Bodys.                                                                                   | Autorisierter interner Zustand und Hüllenfelder verlassen den Server nicht; der fachliche Kontext behält seine Version. | Ein internes Feld steht im Body.                          | Der Body enthält **nicht**: Host-Token, Session-ID, Session-Code, Teilnehmenden-IDs, `snapshotHash`, `packedAt`, Budget-Objekt. Er **enthält** `moderation-domain-context-v1`. Oberste Schlüssel des Bodys = festgelegte Menge (im Plan aus `buildChatCompletionBody` übernommen).                                                                                                                  |
| E3  | 2     | **Vorschau ≠ Nutzlast nach Änderung.** Vorschau, dann eine Stimme, dann `requestSummary`.                                                      | Die Nutzlast entspricht dem neuen Stand, nicht der Vorschau; die Hashes unterscheiden sich.                             | Der Job sendet die alte Vorschau.                         | (1) Hash der Vorschau ≠ Hash des Ergebnisses. (2) User-Nachricht ≠ Kontext der Vorschau. (3) User-Nachricht = Kontext einer frischen Vorschau nach der Stimme.                                                                                                                                                                                                                                      |
| E4  | 2, 3  | **Gekennzeichnete Negativprobe Vertrag.** Die Runtime antwortet mit `schemaVersion` ≠ 2.                                                       | Ergebnis regelbasiert, Grund `invalid_response`, keine Modellaussage übernommen.                                        | Teilübernahme oder Absturz.                               | Status und Grund wie H; keine Aussage mit `origin` Modell im Ergebnis; Queue danach frei.                                                                                                                                                                                                                                                                                                           |
| E5  | 3     | **Host wartet nicht.** Die Runtime hält die Antwort an einem Latch.                                                                            | `requestSummary` kehrt mit `pending` zurück, bevor die Runtime antwortet.                                               | Der Aufruf blockiert bis zur Modellantwort.               | (1) Die Mutation ist aufgelöst und `pending`, während die Runtime den Request hält (Request empfangen, Latch offen). (2) `summaryRuntime` meldet weiter `pending`. (3) Nach dem Lösen wird `ready` erreicht.                                                                                                                                                                                        |
| E6a | 3     | **Empfänger nicht erreichbar** (Port geschlossen).                                                                                             | Host bekommt `pending`, dann ein regelbasiertes Ergebnis mit Grund `unavailable`.                                       | Fehler an den Host oder hängender Job.                    | Status und Grund wie H.                                                                                                                                                                                                                                                                                                                                                                             |
| E6b | 3     | **Langsamer Empfänger** über dem Client-Timeout (1 s, kleinster erlaubter Wert).                                                               | Regelbasiertes Ergebnis mit einem Zeitgrund (`timeout`).                                                                | Der Job wartet unbegrenzt oder wirft.                     | Grund ist der im Code vorgesehene Zeitgrund, der im Plan aus `classifyCaughtError` bestimmt wird; Gesamtdauer < Timeout + 2 s.                                                                                                                                                                                                                                                                      |
| E7  | 4     | **Stimmenänderung zwischen Auftrag und Ergebnis.** Die Runtime ändert eine Stimme (`arsnova_change_qa_vote`), bevor sie antwortet.             | `source_changed`; die Modellaussage wird verworfen; das Ergebnis ist an prepare (3) gebunden.                           | Ergebnis `ready` mit Modellaussage.                       | Grund `source_changed`; keine Modellaussage; `snapshotHash` des Ergebnisses = Hash einer frischen Vorschau danach.                                                                                                                                                                                                                                                                                  |
| E8  | 4     | **Quellenlöschung zwischen Auftrag und Ergebnis.** Die Runtime löscht über `qa.moderate` (`DELETE`) genau die Frage, die ihre Antwort zitiert. | `source_changed`; die gelöschte Frage fehlt in den Quellen des Ergebnisses.                                             | Die gelöschte Frage oder ihre Aussage erscheint.          | Grund `source_changed`; die gelöschte Quelle fehlt im Ergebnis und in jeder Aussage.                                                                                                                                                                                                                                                                                                                |
| E9  | 4     | **Kontrolle zu E7/E8:** Die Runtime ändert eine Quizstimme auf eine laufende Frage (Gegenprobe aus T5.5).                                      | `ready` mit Modellaussage.                                                                                              | `source_changed` (falsch positiv).                        | Status `ready`.                                                                                                                                                                                                                                                                                                                                                                                     |

E1 ist zugleich die Kontrolle für E7 und E8. Ohne E1 könnte `source_changed` immer eintreten.

### 4.1 Mutationsproben (Pflicht, je Fall)

Lokal, nicht committet, je Fall mit Diff, rotem und grünem Lauf im Protokoll:

| Fall  | Mutation                                                                                                                                  | Erwartung                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| E1/E2 | In `buildChatCompletionBody` ein Feld aus dem Kontext entfernen bzw. `snapshotHash` in die User-Nachricht aufnehmen                       | E1 (2) bzw. E2 rot             |
| E3    | Im Test-Hook nicht möglich, ohne den Prüfgegenstand zu ersetzen. Stattdessen: Queue sendet das Ergebnis von prepare (1) statt prepare (2) | E3 rot                         |
| E4    | Versionsprüfung der Ausgabe in beiden Schichten entfernen (wie T1.6)                                                                      | E4 rot                         |
| E5    | Job in `requestQaSummary` synchron ausführen (wie T4)                                                                                     | E5 rot oder Zeitüberschreitung |
| E6a/b | Fehlerklassifikation auf `completed` mit leerem Ergebnis umbiegen                                                                         | E6 rot                         |
| E7/E8 | Vergleich `sourceChanged` in `processJob` auf `false` setzen                                                                              | E7 und E8 rot, E9 grün         |

## 5. Messungen (M)

Eigene opt-in Datei mit Flag `RUN_QA_SUMMARY_MEASUREMENT`. Sie läuft **nicht** in der CI, weil Zeitwerte dort nicht vergleichbar sind. Sie schreibt eine JSON-Datei mit Rohwerten und Umgebung nach `docs/referat-thema-1/evidenz/1C/messung/`.

- **Aufbau:** Fixture 3.2 mit N = 200.
- **Wiederholungen:** n = 20 je Bedingung, nach 3 verworfenen Aufwärmläufen.
- **Kennzahlen:** Median, p95 und Maximum.
- **Festgehalten werden:** Hardware (CPU, RAM), Node, PostgreSQL, Redis und Commit.

| Nr. | Messgröße                                                                                                                                                                                        | Bedingungen                                                                                  | H                                                                                                                                                     | G                                                   | K                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| M1  | **Rückkehrzeit** von `qa.requestSummary` (Aufruf bis Antwort am Caller)                                                                                                                          | Runtime-Verzögerung D = 0 ms, D = 2000 ms, unerreichbar                                      | Die Rückkehrzeit hängt nicht von D ab.                                                                                                                | Sie wächst mit D.                                   | Median(D = 2000) − Median(D = 0) < 100 ms **und** p95 aller Bedingungen < 1000 ms.          |
| M2  | **Gesamtdauer** der Analyse (Aufruf bis Endstatus über `summaryRuntime`)                                                                                                                         | wie M1                                                                                       | Gesamtdauer ≈ D + Kontextkosten; bei „unerreichbar“ ein schneller Fallback                                                                            | Gesamtdauer unabhängig von D (dann misst M1 nichts) | Median(D = 2000) − Median(D = 0) zwischen 1900 und 2500 ms.                                 |
| M3  | **Kosten der Kontextbereitstellung:** Dauer eines `prepareFreshModerationSummaryContext`                                                                                                         | warm (Cache gefüllt) und kalt (Packing-Cache und Redis-Analyse-Cache vor jedem Lauf geleert) | Ein prepare kostet auf der Fixture lokal unter 250 ms (Median, kalt).                                                                                 | Es kostet mehr.                                     | Median wie H. Das Ergebnis ist ein Messwert, kein Bestehen oder Scheitern des Systems.      |
| M4  | **Kosten der Validierung:** strikte Zod-Prüfungen in `assemblePreparedModerationSummaryContext` (Anfrage und Vorschau), Client-Prüfung `OpenWeightLlmRequestSchema.safeParse` und Ausgabeprüfung | isoliert auf dem `promptContext` aus M3, n = 200                                             | Der Anteil der Validierung an einem prepare liegt unter 20 %.                                                                                         | Er liegt darüber.                                   | Anteil = Median(Validierung) / Median(prepare warm).                                        |
| M5  | **Anzahl der Kontextaufbauten** je Auftrag und **Nutzlastgröße**                                                                                                                                 | D = 0                                                                                        | Ein Auftrag mit einem anschließenden `summaryRuntime`-Abruf verursacht 4 prepares (Anfrage, (2), (3), Lesepfad), wie in Befund 2 statisch abgeleitet. | Eine andere Zahl.                                   | Gezählte Aufrufe über einen zählenden Wrapper um die echte Funktion; Bytes des rohen Bodys. |

Der zählende und messende Wrapper ruft die echte Funktion unverändert auf. Er ist Messinstrument, kein Eingriff in den Prüfgegenstand.

## 6. Gegenvariante V1 und Entscheidung

**Baseline B:** unveränderter Code. Nach der Inferenz läuft prepare (3), und bei Hash-Abweichung gewinnt `source_changed`.

**Gegenvariante V1 („keine Nachprüfung“):** Nur im Labor. Über `resetQaSummaryQueueForTests` liefert der `prepare`-Hook für den dritten Aufruf je Job das Ergebnis von prepare (2) zurück, statt neu aufzubauen. Das spart einen Kontextaufbau je Auftrag. Es ist die naheliegende Optimierung, wenn man nur auf Kosten schaut.

**Szenario:** Fixture 3.2, D = 2000 ms, wie E7 (eine Stimme während der Inferenz), n = 10 je Variante. Zusätzlich das ruhige Szenario ohne Änderung, n = 10 je Variante.

**Messdaten je Variante:**

- Gesamtdauer (Median, p95);
- Zahl der prepares je Auftrag;
- Anteil der Aufträge, die ein Ergebnis `ready` liefern, dessen `snapshotHash` **nicht** dem Datenstand bei Auslieferung entspricht (veraltet, Vergleich mit einer frischen Vorschau direkt danach).

**Vorab festgelegte Entscheidungsregel**

| Ergebnis                                                                                                                                            | Entscheidung                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1 liefert im Änderungsszenario mindestens ein veraltetes `ready`, **und** die Ersparnis von V1 ist < 5 % der Gesamtdauer von B im ruhigen Szenario | **Beibehaltung** der Nachprüfung (prepare (3)). Begründung: Konsistenz kostet weniger als 5 % Laufzeit.                                                                      |
| V1 liefert kein veraltetes Ergebnis                                                                                                                 | Befund „Nachprüfung im Szenario wirkungslos“. Prüfen, ob T5/E7 etwas übersehen; keine Empfehlung ohne Klärung.                                                               |
| Ersparnis ≥ 5 %                                                                                                                                     | **Verbesserungsempfehlung** prüfen: günstigere Nachprüfung, z. B. nur Revisionen statt vollem Kontextaufbau. Das wird nicht umgesetzt (Nicht-Ziel), nur begründet empfohlen. |

**Begründung der 5 %-Schwelle:** Die Summary ist ein Hintergrundauftrag. Unter 5 % ist die Ersparnis bei realer Inferenz im Sekundenbereich nicht wahrnehmbar. Die Schwelle ist bewusst konservativ gegen die Optimierung gesetzt, weil V1 eine Konsistenzzusage aufgibt.

**Folgen jeder Entscheidung** (Pflicht laut 4.1.3), jeweils für die betroffene 1.3-Funktion `processJob` (prepare (3)) und `hooks.prepare`:

- Kosten- und Betriebsfolge, z. B. DB-Last je Auftrag;
- Risiko;
- Rückweg zur Baseline.

## 7. Gültigkeitsgrenzen

- **Test-Runtime statt privater Inferenz:**
  - keine Modellzeit;
  - kein Tokenizer;
  - kein llama-server-Verhalten außer den nachgebildeten Statuscodes.
  - Der Baselinelauf gegen die echte Runtime bleibt offen.
- **Lokale Hardware:** Podman-PostgreSQL und -Redis auf einem Entwicklerrechner. Die Werte sind relativ zwischen den Bedingungen vergleichbar, nicht absolut auf die Produktion übertragbar.
- **Kein Referenzmanifest des Prüfers:** Abweichungen von `v1.3.0` stehen in [`1C/1C-diagrams.md`](../1C/1C-diagrams.md#differences-to-v130).
- **Eine Fixture:** Größere oder anders verteilte Q&A-Bestände können andere Kosten haben. M3 nennt die Fixturegröße.
- **n = 20 bzw. 10:** genügt für Median und grobe p95, nicht für seltene Ausreißer.

## 8. Nachträge zu Teil 1 (aus dem Review)

Diese Punkte korrigieren den Nachweis von Teil 1. Sie ändern keine Kriterien von Teil 1.

- **Fehlende rote Läufe:** Mutationsproben für T3.4, T5.0, T5.2, T5.4a und T5.4b nachholen.
- **Mutationen 1, 2, 2b und 3 zu T5:** auf der finalen Testdatei wiederholen und je Probe den Commit nennen.
- **T1.6:** Die „Korrektur“ im Protokoll ist falsch. Die damalige Mutation hat einen TypeError ausgelöst und keine Schichteigenschaft gezeigt. Neu prüfen und korrigieren.

## 9. KI-Nutzung

Design, Plan, Testcode und Protokoll wurden mit Claude Code (Anthropic, Modelle der Claude-Familie) erstellt. Der Autor hat Umfang, Entscheidungen und Freigaben bestimmt und die Ergebnisse geprüft. Reviews wurden von separaten KI-Agenten durchgeführt. Sie sind keine unabhängigen menschlichen Gutachten. Einzelheiten stehen im Protokoll im Abschnitt „KI-Nutzung“.

## 10. Präzisierung vor der Messung (2026-10-24, vor dem ersten M- und V1-Lauf)

Die E-Tests haben gezeigt, dass `source_changed` an **zwei** Stellen entsteht: nach der Inferenz (prepare (3), `processJob`) und beim Lesen eines fertigen Ergebnisses (`getQaSummaryRuntimeFresh`, prepare (4)). Erst wenn beide Stellen ausgeschaltet sind, werden E7 und E8 rot (Mutationsprobe im Protokoll Teil 2). Abschnitt 6 lässt offen, wo „veraltet“ gemessen wird. Festlegung, bevor Messdaten vorliegen:

- **Primär (für die Entscheidungsregel):** das Ergebnis, das der Host sieht, also der erste Abruf über `qa.summaryRuntime` nach Ende des Jobs. „Veraltet“ heißt: Status `ready` mit Modellaussage, obwohl sich der Datenstand während der Inferenz geändert hat.
- **Sekundär (nur berichtet):** der interne Queue-Zustand direkt nach dem Job (`getQaSummaryRuntime`, ohne erneuten Kontextaufbau), gleiche Definition.
- **Zusätzlich erhoben:** prepares je Auftrag **einschließlich** des ersten Lesepfad-Abrufs, für B und V1.
- **Ergänzung der Entscheidungsregel:** Liefert V1 primär kein veraltetes Ergebnis, sekundär aber schon, gilt Zeile 2 von Abschnitt 6 mit der Erklärung „die Nachprüfung beim Lesen fängt den Fall auf“. Die Empfehlung muss dann begründen, ob prepare (3) neben dem Lesepfad nötig bleibt. Entscheidend sind Kosten (ein prepare je Auftrag) gegen Risiko: Ein Zwischenzustand ist intern veraltet, bis der erste Abruf erfolgt; Abrufe ohne erneuten Kontextaufbau, z. B. andere Leser des Zustands, würden ihn sehen.

## 11. Nachtrag zur KI-Nutzung (2026-10-24, nach der Ausführung)

Abschnitt 9 wurde vor der Ausführung geschrieben; die Formulierung „die Ergebnisse geprüft“ beschreibt deshalb ein Vorhaben, keinen erledigten Schritt. Den Stand der Prüfung durch den Autor vermerken die Protokolle. Der Entwurf dieses Designs einschließlich der Schwellen (5 %, n, D) stammt von der KI; der Autor hat ihn vor der Ausführung freigegeben.
