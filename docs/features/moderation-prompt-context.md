<!-- markdownlint-disable MD013 -->

# Versionierter Moderations-Prompt-Kontext (#456)

**Zielgruppe:** Product Owner, Entwicklerinnen und Entwickler von Shared Types, Backend, Frontend und Runtime
**Stand:** 2026-10-13
**Repo-Abgleich:** integrierter Arbeitsstand der Slices 5–8 auf Runtime-R-Basis `a8915068`
**Status:** Slices 1–7 sind im Repo vom versionierten Fachvertrag bis zum hostgeschützten Summary-V2-Anfrage-, Vorschau- und Fallbackpfad implementiert. Slice 8 liefert den reproduzierbaren Demo-Quiz-Abnahmerunner und die Zuordnung der Gesamtanforderungen. Ein separater Realmodell-Lernziellauf erzeugte auf dem privaten Produktionshost zehn Entwürfe; Summary-V2-Realmodelllauf, vollständige Lernziel-Mess-/Qualitätsdaten und die Prefill-Abnahme des 8.192-Vollkontextprofils bleiben offen. Beide Flags sind im Repository standardmäßig aus; die Betreiberaktivierung des LLM für den Test ist keine allgemeine Freigabe.
**Issue:** [#456 – Vollständiger LLM-Kontext für Moderationsprompt vorbereiten](https://github.com/kqc-real/arsnova.eu/issues/456)
**Roadmap:** [#463 – Release 1.3.0](https://github.com/kqc-real/arsnova.eu/issues/463)
**ADR:** [ADR-0036 – Lernziel-Datenhaltung und getrennte Live-Projektion](../architecture/decisions/0036-learning-objective-storage-and-live-projection.md)

## 1. Ergebnis und Grenze der Slices 1 bis 8

Slice 1 schafft eine gemeinsame Sprache für den späteren Moderationskontext. Der Vertrag kann ausdrücken, **welche** zulässigen Informationen vorliegen, welchen Zustand sie haben, worauf sie sich beziehen und welche Quellen sie tragen. Das verbindliche Sechs-Fragen-Szenario liegt als deterministische Referenz vor. Die Daten werden in diesem Slice noch nicht aus einer Live-Session geladen und nicht an ein Modell gesendet.

Slice 2 ergänzt den ersten autorisierten Live-Datenzugriff: N5 löst die Session über ihre unveränderliche ID auf und prüft die tatsächliche Hostberechtigung, N6 bildet einen begrenzten Q&A-Kandidatenbestand aus persistierten Zählern und vorhandenen NLP-Ergebnissen, und N7 projiziert einen bereits vorhandenen semantischen Q&A-Analysestand mit vollständigen Cluster-Mitgliedschaften. Diese Funktionen bleiben backend-intern. Sie sind weder ein neuer tRPC-Pfad noch eine Browser- oder Teilnehmendenschnittstelle und starten beim Kontextaufbau keine NLP-, Encoder- oder Modelljobs.

Slice 3 führt die seiteneffektfreien Kompassregeln in `libs/shared-types` zusammen. Frontend und Backend verwenden damit dieselben Schwellen, Fakten und Prioritäten; Darstellung, Navigation und Beschriftung bleiben im Browseradapter. N8 liest ausschließlich Fragen mit autoritativem `COMPLETED`-Fortschritt und projiziert begrenzte, identitätsfreie Aggregate nach der bestehenden `effective-vote-v1`-Regel. N9 bildet daraus, aus vorhandenen Q&A-/Themenfragmenten und aus Quick Feedback typisierte Kompasssignale. Der interne Orchestrator prüft Hostrecht und Retention erneut, liest Quiz- und Feedbackevidenz ein zweites Mal und verwirft einen während des Aufbaus veränderten Stand. Er ist noch kein Router oder vollständiger N10-Kontextbuilder.

Slice 4 setzt N2–N4 für manuelle Lernziele um. Quizziele werden in einem strikt validierten Sidecar derselben Yjs-Sammlung synchronisiert, als Export V2 gesichert und beim Live-Upload atomar in die temporäre Serverkopie übernommen. Beim Erzeugen oder kontrollierten Ersetzen eines Sessionquiz entsteht daraus ein sessionautoritärer, lösungsfreier Zielbestand. Reine Q&A-Sessions können darin manuelle Session- oder Q&A-bezogene Ziele führen. Hostschreibvorgänge verwenden globale und zielbezogene Revisionen; Reload, konkurrierende Tabs, Quizersetzung und entfernte Quellen werden nicht als stiller Last-write-wins-Fall behandelt.

Slice 5 implementiert N1 als eigenen Vorbereitungsablauf. Eine ausdrückliche Aktion übermittelt ausschließlich aktive, lösungshaltige Quizaufgaben an die private Open-Weight-Runtime. Einmal-Capability, gemeinsames 2.500-UTF-8-Byte-Limit, deterministische sequenzielle Batches, ein Gesamttimeout und ein striktes Draft-Resultat begrenzen den Auftrag. Modellvorschläge überschreiben weder manuelle noch bestätigte Ziele. Der vollständige Vertrag und Fehlerlebenszyklus stehen in [Modellgestützte Lernzielableitung](learning-objective-derivation.md).

Slice 6 implementiert N10 als backend-internen, hostautorisierten Gesamtbuilder. Er verbindet N5–N9 mit dem sessionautoritativen, lösungsfreien Lernzielbestand, prüft Hostrecht, Retention und relevante Revisionen vor und nach den Reads und gibt ausschließlich ein validiertes `ModerationAnalysisContextV1` zurück. N11 wählt daraus dependency-geschlossen und deterministisch einen `ModerationPromptContextV1`; N12 bildet den semantischen Hash und einen kurzlebigen, begrenzten Cache, der nur nach einem vollständig neu autorisierten N10-Lauf erreichbar ist.

Slice 7 implementiert N13–N15 im vorhandenen Summary-Lebenszyklus. `QaSummaryInferenceRequestV2` bindet den gepackten Kontext an ausdrückliche Anfrage-, Ausgabe-, Instruktions- und Definitionsversionen. Der Adapter handelt `full-context` und `legacy-text` aus und degradiert ohne kompatiblen oder verfügbaren Modellpfad auf einen quellengebundenen extraktiven Backend-Fallback. Der Summary-Packer erzwingt eine Mindest-Q&A-Coverage (Baseline- und Textkürzungs-Retry), wenn analysierte Fragen sonst ohne `included`-Quellen bleiben würden; schlägt das fehl, wird Full-context nicht als Laufmodus geführt und der Runtime-Pfad fällt mit `no_packed_sources` auf Extraktiv zurück, ohne das Modell aufzurufen. `qa.summaryContextPreview` verwendet denselben frisch autorisierten Packer. Die Queue baut vor und nach Inferenz erneut auf, vergleicht den semantischen Hash und liefert bei Quellenänderung nicht die alte Modellantwort aus. Rechteentzug und Purge verhindern eine spätere quellenhaltige Anzeige.

Slice 8 stellt einen lokalen, gegen Produktionsziele gesperrten Demo-Quiz-Runner bereit. Die netzwerkfreie Validierung erzwingt mindestens 250 Teilnahmen mit jeweils mindestens zehn sinnvollen Fragen zum kanonischen Demo-Quiz beziehungsweise zu arsnova.eu. Die eigentliche Betriebsabnahme bleibt dort offen, wo keine reale Zielruntime zur Verfügung stand oder Prefill-/RSS des 8.192-Profils noch nicht gemessen sind.

Damit gelten insbesondere folgende Grenzen:

- Der bestehende `QaSummaryInferenceRequestSchema`-Textauftrag bleibt als ausdrücklicher Legacy-Modus erhalten; V2 wird nicht als unbekanntes Zusatzfeld hineingemischt.
- N10–N12 bleiben intern. Der neue Hostpfad liefert nur die gepackte Vorschau beziehungsweise das gebundene Ergebnis, nicht den ungefilterten Analysekandidatengraphen.
- Lernziele werden lösungsfrei in den Gesamtgraphen übernommen. Eine Q&A-Zielreferenz außerhalb der gerankten 200 Kandidaten wird nur nach einer aktuellen Statusprüfung als `reference-only` aufgelöst; archivierte, gelöschte oder nicht mehr zulässige Referenzen werden samt Ziel ausgelassen und als Grenze ausgewiesen.
- Vorschau, Inferenz-Lebenszyklus und erneute Quellen-/Rechteprüfung sind umgesetzt. Die Vorschau zeigt Diagnosemetadaten und den gepackten Vertrag, aber keine technischen Systemtexte und keinen ungepackten Vollbestand.
- Die private Runtime aus Story 8.9d ist technisch implementiert und an die Lernzielvorbereitung verdrahtet, bleibt aber produktiv standardmäßig deaktiviert. Der Gemini-Entwicklungshelfer, der bestehende Summary-HTTP-Adapter und der Encoder bleiben getrennte Pfade.
- Ein Vertragstest, eine Fixture oder der extraktive Fallback belegt keine Promptqualität und keine didaktische Wirksamkeit.
- Der Begriff Adaptermodus `full-context` bezeichnet die V2-Vertragsfähigkeit. Im aktuellen 8.192-Profil passen Referenzbelege; bei zu großen Basismetadaten weist der Packer kontrolliert Q&A-Baseline bzw. Force-Fit und Kürzungen aus. Das ist keine bestandene Vollkontext-Betriebsabnahme.

Der Kontextvertrag, Gesamtbuilder und Packer sind nun technisch mit Summary V2 und der ausdrücklichen Hostvorschau verdrahtet. Produktiv bleiben sie wegen der deaktivierten Flags und der offenen Betriebsnachweise aus. Teilnehmer- und Presenter-DTOs erhalten weiterhin keine internen Kontextfelder. Nur ein ohnehin hostgestarteter erfolgreicher semantischer Q&A-Lauf aktualisiert zusätzlich den minimierten internen Themenbeleg; Kontextaufbau startet weder Klassifikation noch Clustering oder Lernzielableitung.

## 2. Repo-Abgleich und Integrationslandkarte

Die historische Slice-1-Landkarte begann auf `64830fad`. Die rechte Spalte beschreibt den integrierten Stand statt eines angenommenen Zielsystems:

| Bereich                              | Vor Slice 1 vorhanden                                                                                                                                                                             | Integrierter Stand / offene Grenze                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q&A-Kurzfassung                      | `QaSummaryInferenceRequestSchema` mit `locale`, `snapshotHash` und höchstens 40 Quellen `{ id, kind, text }`; produktiver Snapshot standardmäßig höchstens 20 Fragen mit je höchstens 500 Zeichen | V1 bleibt Legacy; V2 bindet den gepackten Kontext, typisierte Belege, Adapterfähigkeit und Fallback. Laufzeitprofil 8.192; Prefill-Abnahme bleibt offen                       |
| Q&A-Bewertungen                      | `QaQuestion` speichert positive und negative Stimmen sowie `upvoteCount`; der Legacy-Name `upvoteCount` bezeichnet im aktuellen Pfad den Nettowert                                                | N6 projiziert Richtungszähler und Revisionen; gemeinsame SQL-Berechnung liegt in `qaRankingSql.ts`                                                                            |
| Q&A-Klassifikation                   | Status, Kategorie `content`/`organization`/`technical`, Konfidenz, Modellversion und Analysezeit im Hostpfad                                                                                      | N6 liest nur vorhandene persistierte Ergebnisse; Kontextaufbau startet keine Klassifikation                                                                                   |
| Semantische Themen                   | begrenzter Snapshot, Encoder, Clustering, optionale Labelherkunft und Analysezustände in 1.14c                                                                                                    | N7 projiziert den letzten geeigneten `ALL_ELIGIBLE`-Analysestand mit vollständigen Cluster-Mitgliedschaften; Neuberechnung und LLM-Label bleiben außerhalb des Kontextaufbaus |
| Regelkompass                         | deterministische Karten- und Priorisierungslogik im Session-Host                                                                                                                                  | Schwellen, Faktenermittlung und Priorisierung liegen gemeinsam in `moderation-compass-rules.ts`; Frontend und N9 verwenden dieses Modul                                       |
| Quizbibliothek                       | `QuizDocument` local-first in Signals, lokalen Spiegeln und Yjs/IndexedDB; Exportformat Version 1                                                                                                 | eigener Yjs-/Local-Mirror-Sidecar, stabile Aufgabenreferenzen, exakte Exportunion V1/V2, kontrollierter Upload und explizite Modellableitung                                  |
| Live-Quiz                            | zeitlich begrenzte Prisma-Quizkopie mit Lösungen für den Quizbetrieb                                                                                                                              | sessionautoritative, lösungsfreie Lernzielkopie mit Host-CAS, Q&A-only-Zielen und kontrollierter Quizersetzung; N10 übernimmt nur aktuell auflösbare Zielreferenzen           |
| Freigegebene Ergebnisse und Feedback | vorhandene Host-Aggregate und Freigabe-/Phasengrenzen                                                                                                                                             | N8 projiziert explizit abgeschlossene Quizfragen; sessiongebundenes Quick Feedback wird purge-gefenced und begrenzt gelesen; N9 erzeugt typisierte Signale                    |
| Runtime                              | ADR-0035 und bestehender privater Summary-HTTP-Vertrag; keine abgenommene `llama-server`-Runtime                                                                                                  | Runtime R trägt Lernziel- und Summary-V2-Consumer; vollständiger Demo-Quiz-Lernziellauf erfolgreich, Summary-V2-Lauf und formale CPU-/Prefill-/RSS-Abnahme offen              |

### 2.1 Maßgebliche bestehende Pfade

- Shared Summary-Vertrag: `libs/shared-types/src/schemas.ts`
- Summary-V2-, Fähigkeits-, Fallback- und Vorschauverträge: `libs/shared-types/src/qa-summary-v2.ts`
- Summary-Snapshot und Hash: `apps/backend/src/lib/qaSummarySnapshot.ts`
- Queue und flüchtiger Ergebniszustand: `apps/backend/src/lib/qaSummaryQueue.ts`
- Legacy-HTTP-Adapter: `apps/backend/src/lib/qaSummaryAdapter.ts`
- V2-Vorbereitung, Adapterwahl und technisches Budgetprofil: `apps/backend/src/lib/moderationSummaryContext.ts`
- V2-Runtime-/Fallbackadapter und Quellenbindung: `apps/backend/src/lib/qaSummaryRuntimeAdapter.ts`, `qaSummaryExtractive.ts` und `qaSummaryValidateV2.ts`
- Private llama.cpp-Übersetzung: `apps/backend/src/lib/openWeightLlmClient.ts`
- Gemeinsame Q&A-Ranking-SQL-Projektion: `apps/backend/src/lib/qaRankingSql.ts`
- Interner Q&A-/Themenkontext N5–N7: `apps/backend/src/lib/moderationQaContext.ts`
- Minimierter semantischer Themenbeleg: `apps/backend/src/lib/qaSemanticTopicSnapshot.ts`
- Themenanalyse und Aktualisierung des Belegs: `apps/backend/src/routers/wordCloud.ts`
- Moderationskompass: `apps/frontend/src/app/features/session/session-host/moderation-compass.ts`
- Gemeinsame Kompassregeln: `libs/shared-types/src/moderation-compass-rules.ts`
- Interne Quiz-/Kompassprojektion N8/N9: `apps/backend/src/lib/moderationTeachingSignals.ts`
- Hostautorisierter Gesamtbuilder N10: `apps/backend/src/lib/moderationPromptContext.ts`
- Deterministisches Packing, Hash und Cache N11/N12: `apps/backend/src/lib/moderationPromptContextPacking.ts`
- Interner Quick-Feedback-Snapshot: `apps/backend/src/lib/quickFeedbackModerationSnapshot.ts`
- Local-first Quizmodell, Import, Export und Upload: `apps/frontend/src/app/features/quiz/data/quiz-store.service.ts`
- Quiz-Lernzieloberfläche: `apps/frontend/src/app/features/quiz/quiz-learning-objectives/`
- Live-Session-Lernzieloberfläche: `apps/frontend/src/app/features/session/session-host/session-learning-objectives-dialog.component.*`
- Export- und Uploadschemas: `libs/shared-types/src/schemas.ts`
- Lernzielverträge: `libs/shared-types/src/learning-objectives.ts`
- Ableitungsverträge und -service: `libs/shared-types/src/learning-objective-derivation*.ts` und `apps/backend/src/lib/learningObjectiveDerivation*.ts`
- Session-Lernzielprojektion und CAS: `apps/backend/src/lib/sessionLearningObjectives.ts`
- Serverkopie und Sessionlebenszyklus: `prisma/schema.prisma` und [session-lifecycle.md](session-lifecycle.md)
- Hostgeschützte Summary-Routen: `apps/backend/src/routers/qa.ts`
- Vorschau- und V2-Ergebnisoberfläche: `apps/frontend/src/app/features/session/session-host/moderation-compass-dialog.component.*`

Diese Pfade bleiben für ihre heutigen Aufgaben maßgeblich. Der neue Vertrag ersetzt keine bestehende Fachberechnung und eröffnet keine zweite NLP- oder Themenpipeline.

### 2.2 Interner Datenfluss in Slice 2

| Stufe  | Autoritative Eingabe                                                                                        | Ergebnis und feste Grenze                                                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N5     | unveränderliche Session-ID, serverseitig validierter Hostkontext und Retentionzeitpunkt                     | Sessionzustand, aktive Sortierung und Revisionen; Sessioncode, Route oder Browserzustand reichen nicht als Berechtigung                                                                                                                  |
| N6     | N5-Zustand, persistierte Teilnehmerzahl und Q&A-Bestand                                                     | höchstens 200 Kandidaten aus einer set-basierten Abfrage für `PENDING`, `ACTIVE` und `PINNED`; keine Teilnehmer-, Token-, Nickname- oder Vote-Identitäten                                                                                |
| N7     | letzter geeigneter semantischer `ALL_ELIGIBLE`-Beleg und aktueller Q&A-Bestand                              | Themenfragment mit vollständig geprüfter Mitgliedschaft, aktueller extraktiver Labelquelle, Korpusgrößen, Analyseversion und expliziter Aktualität; kein neuer Analysejob                                                                |
| Ablauf | feste Zahl set-basierter Leseoperationen innerhalb einer `RepeatableRead`-Transaktion plus Abschlussprüfung | keine N+1-Abfragen; nach der Transaktion werden Hostrecht, Nachbereitungs-Retention und relevante Session-, Ranking- und Teilnehmerrevisionen erneut geprüft; ein inzwischen unzulässiger oder gemischter Stand wird nicht zurückgegeben |

N6 verwendet die Richtungszähler `positiveVoteCount` und `negativeVoteCount` als Quelle. Netto, Wilson-Untergrenze und Kontroversität werden daraus nach `qa-ranking-v1` gebildet; `upvoteCount` bleibt ein Legacy-Nettowert und ist keine positive Stimmenzahl. Derselbe SQL-Helfer liefert die Score- und Sortierprojektion für die bestehenden Q&A- und Wortwolkenpfade sowie N6. Die Extraktion ändert deren Rankingverhalten nicht. NLP wird ausschließlich aus dem persistierten Status projiziert; sowohl `classified` als auch `uncertain` benötigen dabei den gespeicherten Analysezeitpunkt. Unvollständige gespeicherte Resultate degradieren kontrolliert zu `failed`, fehlende beziehungsweise deaktivierte Ergebnisse zu ihrem ausdrücklichen Zustand.

Der Themenbeleg wird nur aus einem erfolgreichen, nicht als Fallback markierten Q&A-Lauf mit `SEMANTIC`, `ALL_ELIGIBLE` und Status `ready` oder `uncertain` aktualisiert. Er liegt unter der unveränderlichen Session-ID im bestehenden Redis-v2-Sessionnamespace. Gespeichert werden Analyse- und Modellversion, Metrik, Korpusrevision und -größen, stabile Themenkennung, Konfidenz, Labelquellen-ID sowie für jedes vollständig aufgeführte Mitglied Fragen-ID und Textdigest. Rohtexte und das extraktive Label werden dort nicht dupliziert. Ein gekürztes oder inkonsistentes Analyseergebnis wird nicht als Latest-Beleg gespeichert.

Beim Lesen lädt N7 die betroffenen Fragen erneut aus der autoritativen Session, prüft Sichtbarkeitsstatus und Textdigest und rekonstruiert ein extraktives Label nur aus dem aktuellen Text der ausgewiesenen Mitgliedsfrage. Eine ungültige Mitgliedschaft lässt das betroffene Thema entfallen, statt einen alten Text oder ein altes Label offenzulegen. Der Kill-Switch ergibt `disabled`, ein fehlender Beleg `unavailable`/`no-data`; abweichende Korpus-, Ranking- oder Teilnehmerrevisionen werden als `stale` ausgewiesen. Der Beleg verwendet dieselbe TTL, denselben begrenzten Sessionindex und dieselbe Purge-Fence wie die übrigen Wortwolken-Snapshots, sodass eine Sessionlöschung auch diesen internen Wert erfasst.

### 2.3 Interner Datenfluss in Slice 3

| Stufe  | Autoritative Eingabe                                                                                                                            | Ergebnis und feste Grenze                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N8     | N5-Zustand, Quizkopie, `questionProgress` und persistierte Stimmen                                                                              | höchstens 50 auflösbare Fragen mit Zustand `COMPLETED`; eine set-basierte SQL-Projektion ohne Teilnehmerkennungen; Antwort-, Richtigkeits-, Rating-, numerische und getrennte Rundenaggregate nach `effective-vote-v1`; Rohdetails für Freitext-, numerische und strukturierte Zuordnungs-/Reihenfolge-/Kategorisierungsregeln sind je Frage beziehungsweise Runde auf 500 Antworten begrenzt |
| QF     | sessiongebundener Redis-Wert, Session-ID, Purge-Fence und autorisierte Teilnehmerbasis                                                          | jede sessiongebundene Stimme benötigt die Teilnehmer-Capability; ein atomarer, begrenzter Snapshot akzeptiert nur entsprechend markierte Runden; Legacy-, Fremd-, fehlerhafte oder überzählige Populationen degradieren ohne Quelle; `TEMPO` bleibt ohne die unbegrenzte Live-Choice-Menge ausdrücklich `not-supported` statt eine scheinbar exakte Tendenz zu erfinden                       |
| N9     | N8/QF sowie optional die separat autorisierten N6/N7-Fragmente                                                                                  | typisierte Kompasssignale mit `moderation-compass-rules-v1`, Regelbegründung, Evidenz und gemeinsam priorisiertem Primärsignal; `PENDING` erzeugt ausschließlich einen Moderationshinweis, keine Lernbedarfsdiagnose                                                                                                                                                                          |
| Ablauf | initiale Hostautorisierung und Evidenzlese, Host-/Zustandsprüfung vor dem Abschluss, abschließende Evidenzlese und letzte Host-/Zustandsprüfung | Quiz- und Feedbackfingerprints müssen bei beiden Evidenzlesungen identisch sein; außerdem muss der autorisierte Zustand sowohl davor als auch danach dem Ausgangszustand entsprechen. Änderungen führen zu `CONFLICT`; die Fragmente werden weder öffentlich geroutet noch automatisch bei Vote, Join oder WebSocket-Ereignissen aufgebaut                                                    |

Ergebnisquellen enthalten keine Personenkennungen, Ranglisten, Bonuscodes oder `isCorrect`-Optionsmarkierungen. Vollständige Options-Buckets enthalten auch Null-Buckets; Ratingwerte werden bereits in der SQL-Projektion auf eine feste Skala aggregiert. Runden werden getrennt dargestellt und nie addiert. Eine numerische Rundenprojektion entspricht bei vorhandenem Vergleich der effektiven zweiten Runde. Überschreitet die vollständige Freitext-, numerische oder strukturierte Antwortpopulation die Grenze von 500 Rohwerten, werden ausschließlich davon abhängige Detailbelege oder Vergleichskennzahlen ausgelassen und als `budget-truncated` begrenzt ausgewiesen; eine begrenzte Teilmenge wird nie als vollständige Population ausgegeben. Weiterhin exakt berechenbare, mengenbasierte Aggregate bleiben davon getrennt verfügbar. Quick-Feedback-Werte tragen intern einen Rundenbeginn und den Nachweis der Teilnehmer-Capability-Prüfung; beide internen Felder werden vom öffentlichen Ergebnis-Schema weiterhin entfernt. Ein fehlendes oder nicht unterstütztes Modul bleibt von einer gemessenen Nullpopulation unterscheidbar.

### 2.4 Interner Datenfluss in Slice 6

| Stufe | Autoritative Eingabe                                                                       | Ergebnis und feste Grenze                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| N10   | frisch hostautorisierter N5-Zustand, N6/N7, N8/N9 und sessionautoritativer Lernzielbestand | validiertes `ModerationAnalysisContextV1`; explizite Locale; lösungsfrei; höchstens 1.500 interne Analysequellen            |
| N11   | vollständiger Analysekandidatengraph und festes Modellprofil                               | dependency-geschlossener, deterministisch priorisierter `ModerationPromptContextV1`; höchstens 500 Quellen im Modellauftrag |
| N12   | gepackter Kontext, Instruktion, Definitionen und semantische Revisionen                    | SHA-256-Snapshot-Hash sowie 30 Sekunden gültiger LRU-Cache mit höchstens 64 Einträgen und Session-Purge-Fence               |

N10 führt die Fachfragmente innerhalb eines `RepeatableRead`-Laufs zusammen und prüft Hostrecht, Retention, Sessionzustand und relevante Revisionen anschließend erneut. Eine Locale wird nicht aus Browser- oder Routenzustand erraten. Lernzielreferenzen auf Q&A-Fragen außerhalb der 200 gerankten N6-Kandidaten werden set-basiert gegen den aktuellen zulässigen Status geprüft und ausschließlich als `reference-only` aufgenommen. Damit der Analysevertrag auch bei maximal breiten Lernzielen geschlossen bleibt, werden höchstens 200 eindeutige Q&A-Referenzen in vollständigen Zielbündeln übernommen; bestätigt geht vor prüfbedürftig, prüfbedürftig vor Entwurf, danach entscheidet die stabile Ziel-ID. Ein Bündel wird nie halb gekürzt. Eine Kapazitätsauslassung wird als `budget-truncated`, eine nicht mehr auflösbare Quelle getrennt als `source-redacted` ausgewiesen.

N11 wählt in fester Code-Unit-Reihenfolge und in getrennten Lanes unter anderem organisatorische und technische Fragen, Themen, angeheftete, ausstehende, kontroverse, stark unterstützte und unbeantwortete Fragen, Lernziele, Kompasssignale, freigegebene Ergebnisse und Feedback. Jede Auswahl nimmt ihre transitiven Quellen mit; ein verwaister Bezug macht den Kandidaten ungültig. Eine autorisierte Themenrepräsentanz außerhalb der 200 gerankten Fragen darf als themengebundener Volltext mitgeführt werden, ohne eine erfundene Fragenmetrik zu erhalten; sie zählt wie jeder andere Q&A- oder Quizfragentext gegen dieselbe 200er-Grenze. Normalisierte Textduplikate werden nur zusammengeführt, wenn zugleich sämtliche fachlichen Fragenmetadaten identisch sind. Die Normalisierung ist bewusst konservativ: kanonisch äquivalentes Unicode, Leerraum, echte äußere Anführungszeichen sowie einleitende oder abschließende Fragezeichen werden vereinheitlicht; Groß-/Kleinschreibung, Unicode-Kompatibilitätszeichen, interne Apostrophe und mathematische oder sonstige bedeutungstragende Operatoren bleiben erhalten. Die Repräsentantin trägt dann eine explizite Gruppengröße. Gleicher Text mit abweichendem Status, Stimmenstand, NLP-Zustand oder Themenbezug bleibt getrennt. Direkte Kompass- und Lernzielreferenzen bleiben ebenfalls getrennt; Themenrepräsentanz und extraktive Labelquelle werden bei einem echten Duplikat auf die kanonische enthaltene Quelle umgebogen, während die vollständige Mitgliedsliste und damit die Themenhäufigkeit unverändert bleiben.

Das Budget zählt konservativ jedes UTF-8-Byte als höchstens ein Modelltoken. Verbindliches tatsächliches Modellmaterial ist in Slice 7 exakt `instructionText` plus `definitionText` plus kanonisch serialisierter `context`; `packedAt`, Hash und Budgetbericht sind ausschließlich Transport- und Diagnosefelder und dürfen nicht zusätzlich in den Modellprompt geraten. Antwortreserve und Sicherheitsmarge bleiben gesondert. Der Hash bindet die tatsächlichen Instruktions- und Definitionstexte, alle semantischen Kontextwerte und die Auswahlversion ein, lässt aber reine Transportzeitstempel aus. Textgleiche, metadatenergänzte und vollständige Referenzfixtures erlauben einen deterministischen Ablationsvergleich.

Der Cache besitzt bewusst keinen Abruf nur per Session-ID: Vor jedem Treffer muss N10 den vollständigen, frisch autorisierten Analysekontext erneut liefern. Revision, Modellprofil, Instruktion, Definitionen oder semantischer Inhalt ändern den Schlüssel. Sessionlöschung beziehungsweise Purge invalidiert vorhandene Einträge und setzt eine kurzlebige, global konservative O(1)-Sperre gegen Wiederbefüllen. Reiner Purge-Verkehr kann dadurch keinen unbegrenzten Sitzungsindex im Cache aufbauen.

### 2.5 Anfrage, Vorschau und Auslieferung in Slice 7

| Stufe | Autoritative Eingabe                                                           | Ergebnis und feste Grenze                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N13   | gepackter N11/N12-Kontext und ausdrückliche Adapterfähigkeiten                 | strikt versionierter `qa-summary-context-v2`-Auftrag oder ausdrücklicher `legacy-text`-/`extractive`-Fallback; keine still ignorierten Zusatzfelder                              |
| N14   | derselbe frisch autorisierte Packer wie N13                                    | hostgeschützte `qa-summary-context-preview-v1`-Diagnose mit Bereichszuständen, Mengen, Quellenarten, Budget, Cache und Kürzungscodes; kein automatischer Abruf beim Dialogöffnen |
| N15   | erneuter N10–N12-Aufbau nach Verarbeitung und vor späterer Runtimeauslieferung | alter Modelloutput nur bei weiterhin gleichem Hash und gültigem Hostrecht; sonst neuer, quellengebundener Fallback beziehungsweise quellenfreier Rechtefehler                    |

Der V2-Runtimepfad sendet genau drei Chatnachrichten: technische Instruktion als Systemnachricht, versionierte Bedeutungsdefinition als zweite Systemnachricht und ausschließlich das kanonische JSON von `promptContext.context` als Usernachricht. Der Transporthash, `packedAt` und der Budgetbericht werden nicht als zweiter Datenblock an das Modell geschickt. Die statische Antwortschemaerzwingung wird nach dem Lauf durch dynamischen Quellenabschluss ergänzt.

Timeout und Queueüberlast liefern den extraktiven Backend-Fallback. Ändert sich eine zulässige Quelle während des Auftrags, wird die Antwort nicht gegen den alten Stand angezeigt; stattdessen entsteht ein neuer extraktiver Stand mit `source_changed`. Rechteentzug oder abgelaufene Nachbereitungsberechtigung führen zu einem quellenfreien Fehler. Session-Purge entfernt Ergebnis, Warteschlangenzugang und Cache und bricht den aktiven Auftrag ab.

## 3. Drei strikt getrennte Ebenen

Der Integrationsweg verwendet drei verschiedene Ebenen. Ihre Trennung verhindert, dass eine erfolgreiche Hostautorisierung mit einer Freigabe sämtlicher Serverdaten für das Modell verwechselt wird.

| Ebene                          | Inhalt                                                                                                           | Darf enthalten                                                                          | Darf nicht als Modellnutzlast gelten                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Autorisierter interner Zustand | serverseitig geladener Bestand nach validierter Hostprüfung                                                      | interne Zuordnungen und Daten, die für Prüfung und Projektion nötig sind                | alles, was nicht ausdrücklich fachlich projiziert wurde                                         |
| Fachlicher Analysekontext      | versionierte, bereinigte und semantisch erklärte Projektion aller zulässigen Informationsarten vor Budgetauswahl | Fragen, vorhandene Analysen, Ziele, freigegebene Aggregate, Quellen und Einschränkungen | interne Tokens, IPs, Nicknames, Teilnehmer-IDs und nicht freigegebene Lösungen                  |
| Gepackter Modellauftrag        | deterministisch ausgewählte Teilmenge einschließlich abgeschlossenem Quellenregister und Budgetbericht           | nur Daten, die in das konkrete Modellprofil passen und für diesen Auftrag zulässig sind | ausgelassene Volltexte, bloß intern auflösbare Referenzen und lösungshaltige Vorbereitungsdaten |

Der autorisierte Rohzustand bleibt ein späterer backend-interner Typ und wird nicht zu einem allgemein importierbaren Modellvertrag. Die Shared-Schicht exportiert stattdessen:

| Öffentlicher Name                                                                 | Rolle                                                                                                                 |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ModerationAnalysisDomainContextV1Schema`                                         | fachliche Kandidatenprojektion mit gemeinsamen Werte-, Referenz-, Bereichs-, Kanal- und Revisionsinvarianten          |
| `ModerationDomainContextV1Schema`                                                 | rückwärtskompatibler öffentlicher Alias auf `ModerationAnalysisDomainContextV1Schema`, kein Packbarkeitsnachweis      |
| `ModerationPromptDomainContextV1Schema`                                           | gepackte Domainprojektion mit zusätzlichen Auswahlgrenzen und Erreichbarkeitsregeln für den tatsächlichen Modellinput |
| `ModerationAnalysisContextV1Schema`                                               | Analyse-Envelope mit Schema-/Vertragsversion, `assembledAt` und Kandidatenprojektion vor Budgetpacking                |
| `ModerationPromptContextV1Schema`                                                 | Prompt-Envelope mit Inhalts-Hash, Hashmaterialversion, gepackter Domainprojektion und Budgetbericht                   |
| `ModerationPromptDefinitionSetV1Schema` und `MODERATION_PROMPT_DEFINITION_SET_V1` | strikt validiertes maschinenlesbares Bedeutungslexikon                                                                |

Die Typen und Referenzdaten liegen in `libs/shared-types/src/moderation-prompt-context.ts` und `moderation-prompt-context-fixtures.ts`; beide öffentlichen Barrels exportieren sie. Builder und Packer folgen erst in den Slices 2–6.

Analyse- und Promptvertrag verwenden absichtlich dieselbe fachliche Feldstruktur, aber nicht dieselben Refinements. Der Diskriminator `representation` lautet im Analyse-Envelope `analysis-candidates` und im gepackten Prompt `prompt-selection`. Neutrale Zählfelder heißen deshalb `represented`, `representedQuestions` und `representedQuestionSourceIds`: Erst `representation` legt fest, ob sie Kandidaten oder die Promptauswahl darstellen. Im Analyse-Envelope bezeichnet `scope.selectionLimits` das Packziel; ein Kandidatenbestand darf diese Grenzen noch überschreiten. Erst `ModerationPromptDomainContextV1Schema` erzwingt, dass die dargestellten Bereichsgrößen, alle mitgelieferten Fragetexte und der abgeschlossene Prompt-Referenzgraph in diese Grenzen passen. Eine erfolgreiche Prüfung mit `ModerationDomainContextV1Schema` darf daher nicht als Beleg verwendet werden, dass der Kontext bereits an das Modell gesendet werden kann.

### 3.1 Versionen

| Vertrag                 | V1-Wert                              |
| ----------------------- | ------------------------------------ |
| Schema                  | `1`                                  |
| Domainkontext           | `moderation-domain-context-v1`       |
| Analyse-Envelope        | `moderation-analysis-context-v1`     |
| gepackter Modellkontext | `moderation-prompt-context-v1`       |
| Bedeutungslexikon       | `moderation-prompt-definitions-v1`   |
| Hashmaterial            | `moderation-prompt-hash-material-v1` |
| Budget                  | `moderation-prompt-budget-v1`        |
| Quizstimmenbasis        | `effective-vote-v1`                  |
| Quizrundenvergleich     | `round-comparison-v1`                |
| Kompassregeln           | `moderation-compass-rules-v1`        |

Neue Versionen werden nicht durch optionale Felder in V1 simuliert. Eine Semantikänderung benötigt eine neue explizite Vertrags- beziehungsweise Definitionsversion.

## 4. Vertragsbereiche

Der V1-Vertrag bildet die Informationsarten getrennt ab:

| Bereich             | Bedeutung                                                                                                                                                                         | Wichtige Invariante                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Envelope und `meta` | Schema-, Vertrags-, Definitions-, Analyse- und Auswahlversion, `representation`, Locale, globale Quellrevision, typisierte Bereichsrevisionen, Erstell-/Packzeit und Inhalts-Hash | Erstell- oder Packzeit gehört nicht allein zum fachlichen Hashmaterial                                                                  |
| `scope`             | Kanäle, Sessionphase, Status-/Zeitfilter, aktive Gewichtung und Auswahlgrenzen                                                                                                    | gepackte Bereiche dürfen ihre ausgewiesenen Grenzen nicht überschreiten                                                                 |
| `questions`         | bereinigte Q&A-Texte, Moderationsstatus, eigener Bearbeitungsstand, Stimmen, Scores, Klassifikationszustand und Themenreferenzen                                                  | `PENDING` und `unaddressed` bleiben getrennt; Kontroversität benötigt ihre Teilnehmerbasis; Legacy-Netto ist keine positive Stimmenzahl |
| `topics`            | vorhandene Themen, Analysemodell/-zeit, Mitglieder, repräsentative Quellen, Labelherkunft, getrennte Labelqualität und Clusterkonfidenz, Aggregate, Korpusumfang und Alter        | ein Thema ist keine NLP-Kategorie und sein Gewicht kein didaktischer Wichtigkeitswert                                                   |
| `compass`           | regelbasierte Q&A-, Themen-, Lernlücken-, Ergebnis- und Feedbacksignale, Stärke, typisierte Belege und nächster Schritt mit Regelversion                                          | Browserwerte sind nicht ungeprüft autoritativ; ein Signal ohne direkte Q&A-Frage darf keine Frage erfinden                              |
| `learningContext`   | kompakte Ziele, Herkunft, Prüfstatus, expliziter Geltungsbereich, Quellen und Veraltung                                                                                           | bestätigtes Ziel und Modellvorschlag bleiben unterscheidbar                                                                             |
| `releasedResults`   | Referenzen auf strukturierte, zum Zeitpunkt zulässige Quiz-Ergebnisaggregate mit Scope, Population, Regel und typisierten Messwerten                                              | `not-released` trägt keine versteckten Werte oder Lösungen                                                                              |
| `feedback`          | Referenzen auf strukturierte Tempo-/Blitzlichtaggregate mit Quick-Feedback-Scope, Population, Zeitbezug und typisierter Verteilung                                                | fehlende Rückmeldung ist kein negatives Signal                                                                                          |
| `sources`           | typisiertes, eindeutiges Quellenregister                                                                                                                                          | jede gepackte Referenz ist auflösbar; Auflösbarkeit beweist noch keine inhaltliche Treue                                                |
| `limitations`       | fehlende, deaktivierte, ausstehende, fehlgeschlagene, veraltete, gesperrte oder budgetbedingt ausgelassene Daten                                                                  | fehlend wird weder zu `0` noch zu einer sicheren negativen Aussage                                                                      |
| `budget`            | Zählverfahren, Modellprofil, Instruktions-, Daten-, Antwort- und Sicherheitsanteil, gepackter Umfang und Kürzungen                                                                | Zeichenanzahl allein ist kein Tokennachweis                                                                                             |

Die V1-Schemas sind strikt: unbekannte Felder werden nicht still entfernt. Das schützt insbesondere davor, dass `participantId`, Tokens, Nicknames, IP-Adressen, Lösungsschlüssel oder noch nicht vereinbarte Felder unbemerkt in einen Modellauftrag gelangen.

### 4.1 Strukturierte Ergebnis- und Feedbackaggregate

Die Bereichsobjekte enthalten nur `sourceId`-Referenzen; die eigentlichen Aggregate stehen als typisierte Quellen im Register. Freitextzusammenfassungen sind dort kein Ersatz für Messwerte:

| Aggregat       | Erlaubter Scope                                                 | Strukturierte Regeln und Konsistenz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Quizresultat   | `question` mit `quizScopeId` und genau einer `questionSourceId` | `answer-distribution` mit `optionSet: all-answer-options`, `responseCount`, `selectionCount`, `selectionCardinality` und vollständigen Buckets `{ optionId, label, count }`; `freetext-pattern-summary` mit Antwortzahl und höchstens 20 absteigend sortierten, disjunkten Wiederholungszahlen ohne Rohtext; `correctness-summary` mit `correct`, `incorrect` und `unanswered`; `rating-summary` mit vollständigen Skalen-Buckets und daraus exakt berechnetem Mittelwert; oder `numeric-summary` mit Population, Median, Streuung, optionalem Toleranzband und optionalem Histogramm, das bei Vorhandensein die Population vollständig abdeckt; bei einem exakten Nullbreitenband wird es ausgelassen |
| Quizresultat   | `quiz` mit `quizScopeId`                                        | `score-summary` mit positivem `responseCount`, `minimum`, `maximum` und `mean` oder `completion-summary` mit `completed` und `incomplete`; die Regelwerte decken die eingeschlossene Population ab                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Quick Feedback | Kanal `quickFeedback` und explizites Zeitfenster                | `tempo-distribution`, `rating-distribution` oder eine zum Feedbacktyp passende `flashlight-distribution`; eindeutige typisierte Buckets summieren sich zur eingeschlossenen Population                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Jedes Quizresultat deklariert verpflichtend `voteBasis: { kind: effective-vote, version: effective-vote-v1 }`. Diese Basis verweist auf die gemeinsame Regel aus ADR-0028: Existiert für eine Frage mindestens eine Runde-2-Stimme, ersetzt Runde 2 die erste Runde; andernfalls zählt Runde 1. Pro teilnehmender Person und Frage fließt höchstens eine effektive Stimme ein, und bei vorhandener Runde 2 bleibt eine Person ohne Runde-2-Abgabe für diese Frage ohne effektive Stimme.

Ein optionaler `roundComparison` ist davon getrennt und trägt `basis: { kind: round-comparison, version: round-comparison-v1 }`. Er beschreibt Runde 1 und Runde 2 als getrennte Populationen, addiert sie nicht und ist kein Beleg für einen kausalen Lerneffekt. Jede Rundenpopulation darf die berechtigte Population nicht überschreiten. Die effektive Richtigkeitsübersicht entspricht bei vorhandenen Runde-2-Antworten exakt Runde 2, andernfalls Runde 1; eine numerische Übersicht mit Vergleich entspricht exakt der Runde-2-Population und ihrer In-Band-Zahl. Der gepackte Rundenvergleich enthält keine Teilnehmerkennungen oder personenbezogenen Paare.

Quizpopulationen heißen `eligible-submissions`, Feedbackpopulationen `eligible-feedback-responses`; jeweils gilt `included ≤ eligible`. Bei Antwortverteilungen entspricht `responseCount` der eingeschlossenen effektiven Population. `selectionCount` ist die Bucket-Summe und muss zwischen `responseCount × minimumPerResponse` und `responseCount × maximumPerResponse` liegen; kein Bucket darf eine Option häufiger als einmal je Antwort zählen. Options-IDs und Labels sind eindeutig, und `maximumPerResponse` überschreitet nicht die vollständig aufgeführte Optionszahl. Eine Freitextmuster-Zusammenfassung veröffentlicht ausschließlich Häufigkeiten disjunkter normalisierter Wiederholungsgruppen; ihre Summe überschreitet die Antwortzahl nicht, und weder Rohtext noch Normalform, Lösung oder Teilnehmerbezug verlassen den internen Auswertungsschritt. Feedbackverteilungen sind auf die vereinbarten Typen `TEMPO`, `STARS`, `MOOD`, `YESNO`, `YESNO_BINARY`, `TRUEFALSE_UNKNOWN` und `ABCD` begrenzt. `optionId` ist ein opaker Bucketschlüssel, keine Quellenreferenz und kein Lösungshinweis. Insbesondere ist `isCorrect` auch innerhalb einer freigegebenen Antwortverteilung unzulässig.

## 5. Zustandsmodell

### 5.1 Abwesenheit, `null` und `0`

Diese drei Fälle sind fachlich verschieden:

| Darstellung    | Bedeutung                                                                              |
| -------------- | -------------------------------------------------------------------------------------- |
| fehlendes Feld | im gewählten Variantenschema nicht vorgesehen; bei einem Pflichtwert ungültig          |
| `null`         | Wert ist im ausdrücklich dokumentierten Zustand nicht berechenbar oder nicht anwendbar |
| `0`            | gemessener, vorhandener Wert null, etwa Nettoscore 0 oder keine Stimmen                |

Ein Builder darf fehlende Daten nicht durch numerische Defaults tarnen. Umgekehrt darf ein echter Score 0 nicht als »unbekannt« verschwinden.

### 5.2 Verfügbarkeit und Aktualität

Informationsbereiche verwenden diskriminierte Zustände statt frei interpretierbarer Kombinationen:

| Zustand          | Bedeutung                                                                            | Zulässige Folgerung                                                          |
| ---------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `available`      | fachliche Daten liegen vor                                                           | Werte dürfen innerhalb ihres ausgewiesenen Geltungsbereichs verwendet werden |
| `unavailable`    | Datenquelle oder notwendiger Bestand ist nicht verfügbar                             | keine Aussage über den fachlichen Inhalt                                     |
| `disabled`       | Modul ist bewusst deaktiviert                                                        | keine fehlgeschlagene Analyse behaupten                                      |
| `pending`        | Verarbeitung wurde begonnen, aber nicht abgeschlossen                                | altes Ergebnis nur getrennt und als veraltet ausweisen                       |
| `failed`         | Verarbeitung ist fehlgeschlagen                                                      | Regelpfad und andere Bereiche bleiben nutzbar                                |
| `not-released`   | Daten existieren möglicherweise, sind für diesen Kontext aber noch nicht freigegeben | keine Werte, Lösungen oder ableitbaren Ersatzfelder ausgeben                 |
| `not-applicable` | Bereich ist für den Scope fachlich nicht anwendbar                                   | nicht als Fehler oder Nullmessung behandeln                                  |

Verfügbare Analysebereiche kennzeichnen zusätzlich `current` oder `stale`. `stale` benötigt einen nachvollziehbaren Altersgrund beziehungsweise getrennte Analyse- und aktuelle Revisionen. Ein Zeitstempel allein beweist weder Aktualität noch Veraltung.

`not-released` ist ausschließlich ein Ergebniszustand und enthält keine Aggregate. Messwerte verwenden nur `available` oder `unavailable`; bei `unavailable` ist `value` verpflichtend `null`, während ein berechneter Wert 0 `available` bleibt. Verfügbare Q&A-Messwerte werden nicht als freie Herstellerwerte akzeptiert: `bestScore` muss der Wilson-Untergrenze mit `z = 1,96` aus positiven und negativen Stimmen entsprechen; `controversyScore` muss mit `2 × min(positiv, negativ) / (gesamt + max(1, ceil(0,1 × Teilnehmerbasis)))` berechnet sein. Zulässig ist nur eine Binary64-Rundungsabweichung von höchstens `1e-12`. Kontroversität hängt zusätzlich von der ausdrücklich ausgewiesenen Teilnehmerbasis ab: Ist `questions.participantBasis` unavailable, muss jeder `controversyScore` ebenfalls unavailable sein; ein numerischer Wert 0 darf ohne Basis nicht als berechnetes Ergebnis erscheinen. Bei verfügbarer Basis darf die Gesamtstimmenzahl keiner Frage diese Basis überschreiten. Der Q&A-Bearbeitungsstand ist separat `addressed`, `unaddressed` oder `unavailable`; er ist weder aus `PENDING`/`ACTIVE`/`PINNED` noch aus NLP-Zustand oder Quizantworten abzuleiten. Lernziele trennen die Herkunft von der Bestätigung mit `draft`, `confirmed` und `needs-review`. Diese speziellen Zustände ersetzen die allgemeinen Abschnittszustände nicht.

`meta.revisions` weist die Quellstände für Fragetext, Stimmen, Moderationsstatus, Bearbeitungsstand (`questionAnswerState`), persistierte Q&A-Klassifikation (`questionNlp`), Themen, Lernziele, freigegebene Ergebnisse und Feedback einzeln als `available`, `unavailable` oder `not-applicable` aus. Damit kann ein späterer Builder einen teilweise revisionslosen Bestand ausdrücklich begrenzen, statt eine globale Revision fälschlich auf alle Bereiche zu übertragen. Ein verfügbarer Fragenbereich benötigt auch bei leerem gemessenem Korpus eine verfügbare `questionNlp`-Revision; ein unsicherer NLP-Zustand trägt wie ein klassifizierter Zustand seinen persistierten Analysezeitpunkt.

Die schema-first Korrektur aus Slice 2 bindet die Pflicht zur Bearbeitungsstandsrevision an tatsächlich erhobene Daten: Sobald mindestens eine verfügbare Frage `addressed` oder `unaddressed` trägt, muss `questionAnswerState` eine verfügbare Revision ausweisen. Sind dagegen alle Bearbeitungsstände ausdrücklich `unavailable`, darf auch die Revision `unavailable`/`not-collected` bleiben. N6 erfindet deshalb weder einen Bearbeitungsstand noch eine Revision aus Moderationsstatus oder NLP.

### 5.3 Statusbegriffe nicht vermischen

- Q&A-Status `PENDING`/`ACTIVE`/`PINNED` beschreibt Moderation und Sichtbarkeit.
- Q&A-Bearbeitungsstand `addressed`/`unaddressed` beschreibt eine ausdrücklich erhobene Bearbeitung und beweist allein weder Klärungs- noch Lernbedarf.
- NLP-Status beschreibt eine grobe Klassifikation.
- Themenstatus beschreibt eine separate semantische Analyse.
- Lernziel-Prüfstatus beschreibt die Entscheidung der Lehrperson beziehungsweise späteren Prüfbedarf.
- Summary-Status beschreibt den Lebenszyklus eines konkreten Kurzfassungsauftrags.

Keiner dieser Zustände darf aus einem gleich klingenden anderen Zustand abgeleitet werden.

## 6. Quellenregister und Referenzabschluss

Slice 1 reserviert getrennte Quellenarten für:

| Quellenart              | Kennungspräfix           | Belegt                                                                                                                         | Typische Herkunftskette                    |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| `qa-question`           | `qa-question:`           | eine zulässige, bereinigte Q&A-Frage                                                                                           | Aussage → Frage                            |
| `semantic-topic`        | `semantic-topic:`        | ein Thema innerhalb einer ausgewiesenen Analyse- und Modellversion                                                             | Aussage → Thema → Mitgliedsfragen          |
| `quiz-question`         | `quiz-question:`         | eine zulässige Quizaufgabenreferenz, nicht deren Lösung                                                                        | Lernziel → Quizfrage                       |
| `learning-objective`    | `learning-objective:`    | ein Ziel mit Herkunft und Prüfstatus                                                                                           | Kompassbezug → Ziel → optionale Quizfragen |
| `quiz-result-aggregate` | `quiz-result-aggregate:` | ein freigegebenes Ergebnisaggregat mit Quiz-/Fragenscope, `aggregation.rule` und berechtigter/eingeschlossener Population      | Signal → Aggregat → Quizfrage              |
| `feedback-aggregate`    | `feedback-aggregate:`    | ein zulässiges Quick-Feedback-Aggregat mit Zeitfenster, typisierter `aggregation` und berechtigter/eingeschlossener Population | Signal → Aggregat                          |
| `compass-signal`        | `compass-signal:`        | ein deterministisch berechnetes Signal samt Regelversion                                                                       | Vorschlag → Signal → fachliche Belege      |

Kennungen verwenden einen zur Quellenart passenden Präfix und sind innerhalb eines Auftrags eindeutig. `kind` und Präfix müssen übereinstimmen. Modellgenerierte Themenlabels und Lernzielherkunft dürfen über `derivedFromSourceIds` ihre Herkunft ausdrücken; diese Referenzen müssen ebenfalls im Register auflösbar sein.

Der gepackte Modellauftrag besitzt **Source-ID-Referenzabschluss**: Jede `sourceId`-/`SourceIds`-Kante aus Fragen, Themen, Kompasssignalen, Lernzielen und Aggregaten zeigt auf eine tatsächlich mitgelieferte Registerquelle der erlaubten Art. Q&A-Quellen unterscheiden `content.state: included` mit begrenztem Text von `reference-only` mit einem typisierten Grund. So kann ein Themenaggregat einen größeren analysierten Korpus referenzieren, obwohl nur dargestellte Mitgliedstexte gepackt sind. `representedQuestionSourceIds` müssen auf enthaltene Texte zeigen; übrige Mitglieder bleiben ohne vorgetäuschten Volltext als `reference-only` auflösbar. Korpusumfang, dargestellte Menge und Auslassung bleiben sichtbar.

`quizScopeId`, `sectionScopeId` und `optionId` sind dagegen präfixvalidierte **opake Fachschlüssel**, keine Source-IDs. Sie werden nicht im Quellenregister dereferenziert und enthalten keinen Modelltext. Die fachliche Bedeutung einer Antwortoption steht ausschließlich in ihrem separaten `label`. Scope-IDs werden durch Gleichheits- und Zugehörigkeitsregeln geschlossen; sie dürfen insbesondere weder mit `historyScopeId` noch mit einer Quellen-ID verwechselt werden.

Der genaue Graphvertrag besteht aus zwei Stufen:

1. Analyse- und Promptprojektion prüfen gemeinsam eindeutige Kennungen, passende Quellenarten und verfügbare Fachbereiche. Dargestellte Fragen benötigen enthaltenen Q&A-Text. Soweit ein Themenmitglied zugleich als dargestellte Frage vorliegt, sind Frage- und Themenreferenz bidirektional konsistent; Themenrepräsentanz, extraktive Labelquelle und alle `representedQuestionSourceIds` müssen enthaltene Mitgliedstexte sein. Der singuläre `question`-Scope eines Ergebnisaggregats referenziert genau eine `quiz-question`, deren `quizScopeId` mit dem Aggregat übereinstimmt.
2. Die Promptprojektion weist darüber hinaus jede Quelle ab, die vom **ausgewählten** Fachgraphen nicht erreichbar ist. Ein enthaltener Q&A-Text muss entweder in `questions.items` dargestellt oder als repräsentative beziehungsweise labeltragende Quelle eines ausgewählten Themas erreichbar sein; dieser Themenpfad darf keine Fragenmetrik erfinden. Die eindeutige Menge dargestellter Themenmitgliedstexte muss `topics.corpus.representedQuestions` entsprechen. Sämtliche enthaltenen Q&A- und Quizfragentexte – auch reine Themenrepräsentanzen – teilen sich die Grenze `selectionLimits.questions`; Bereichszahlen dürfen auch ihre übrigen Auswahlgrenzen nicht überschreiten.

Ein manuelles Lernziel mit `tasks`-Scope darf zulässige Q&A- oder Quizfragen referenzieren; mehrere Quizaufgaben müssen demselben `quizScopeId` angehören. Bei `origin.kind: model-derived` sind `session`-Scopes ausgeschlossen und sowohl `derivedFromSourceIds` als auch etwaige Aufgabenreferenzen ausschließlich `quiz-question`. Die eindeutigen Ableitungsquellen gehören demselben Quizscope an. Bei `quiz` stimmt ihre `quizScopeId` mit dem Ziel überein, bei `section` zusätzlich ihre `sectionScopeId`; bei `tasks` muss jede Ableitungsquelle in `taskSourceIds` liegen. Damit bleibt eine reine Q&A-Session bei manuellen Zielen; die modellgestützte Ableitung gehört zum getrennten Quiz-Vorbereitungsauftrag.

Referenzvalidierung ist eine strukturelle Prüfung. Ob eine Aussage durch die referenzierte Quelle inhaltlich wirklich getragen wird, bleibt eine eigene Qualitäts- und Evaluationsaufgabe.

Kompasssignale dürfen je nach Signaltyp Q&A-Fragen, Themen, Quizfragen, Lernziele, Ergebnisaggregate oder Feedbackaggregate als Evidenz referenzieren. `questionSourceIds` darf deshalb für reine Themen-, Lernlücken-, Ergebnis- oder Feedbacksignale leer sein; mindestens ein typisierter Evidenzbezug bleibt Pflicht. Jede Q&A-Evidenz erscheint zugleich in `questionSourceIds`, und jede dort genannte Frage erscheint zugleich als Q&A-Evidenz. Darüber hinaus bindet der Vertrag Signal, Messbasis und beobachtete Belege exakt:

| Signaltyp             | Verpflichtende `basis`       | Evidenz- und Wertinvariante                                                                                                                                                                                              |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `high-best-score`     | `best-score`                 | mindestens eine Q&A-Frage; `value` entspricht einem verfügbaren Best-Score der genannten Fragen                                                                                                                          |
| `high-controversy`    | `controversy-score`          | mindestens eine Q&A-Frage; `value` entspricht einer verfügbaren Kontroversität der genannten Fragen                                                                                                                      |
| `high-frequency`      | `question-frequency`         | mindestens eine Q&A-Frage; ganzzahliger `value` entspricht exakt der Zahl der genannten Fragen                                                                                                                           |
| `pinned-question`     | `pinned-question-count`      | mindestens eine ausdrücklich `PINNED` ausgewiesene Q&A-Frage; zählt die bewusste Hervorhebung durch den Host und behauptet weder ein Thema noch fachliche Wichtigkeit                                                    |
| `pending-moderation`  | `pending-question-count`     | mindestens eine ausdrücklich `PENDING` ausgewiesene Q&A-Frage; zählt Freigabestatus und verwendet als nächsten Schritt ausschließlich `review-moderation`, nicht eine Lernbedarfsdiagnose                                |
| `unanswered`          | `unaddressed-question-count` | mindestens eine Q&A-Frage; ganzzahliger `value` entspricht exakt der Zahl der genannten und ausdrücklich `unaddressed` ausgewiesenen Fragen                                                                              |
| `topic-concentration` | `topic-question-share`       | verfügbare Themenevidenz; `value` liegt im Intervall 0 bis 1                                                                                                                                                             |
| `learning-gap`        | `learning-gap-rule-score`    | verfügbares Lernziel und freigegebenes Ergebnis mit mindestens einer nach seiner Aggregationsregel tatsächlich beobachteten Antwort im selben Quiz-, Abschnitts- oder Aufgaben-Scope; `value` liegt im Intervall 0 bis 1 |
| `result-pattern`      | `released-result-rule-score` | freigegebenes Ergebnis mit mindestens einer nach seiner Aggregationsregel tatsächlich beobachteten Antwort; `value` liegt im Intervall 0 bis 1                                                                           |
| `feedback-pattern`    | `feedback-rule-score`        | verfügbares Feedbackaggregat mit `population.included > 0`; `value` liegt im Intervall 0 bis 1                                                                                                                           |

Evidenz aus einem Thema, Lernziel, Ergebnis- oder Feedbackaggregat ist nur zulässig, wenn der jeweilige Bereich `available` ist und genau diese Quelle referenziert. Ein Lernlückensignal benötigt damit nicht nur ein formuliertes Ziel, sondern ein tatsächlich beobachtetes Ergebnis im passenden Scope. Bei `releasedResults.state: not-released` existieren weder Aggregatreferenzen noch Ergebnisquellen oder darauf zeigende Kompassevidenz.

Die Kanalliste ist ebenfalls ein Gate: verfügbare Fragen, Themen oder Q&A-Referenzen benötigen `qa`; verfügbare Ergebnisse, irgendeine Quizfragenreferenz, ein Lernziel mit `quiz`-/`section`-Scope, ein `tasks`-Scope mit Quizfrage oder jede modellabgeleitete Lernzielherkunft benötigen `quiz`; verfügbares Feedback benötigt `quickFeedback`. `learning-gap` und `result-pattern` benötigen dadurch den Quizkanal, `feedback-pattern` den Quick-Feedback-Kanal. Verfügbare Fragen erfordern zusätzlich einen expliziten Status-/Zeitfilter und `qa-ranking`. Fragen, Themen, Lernziele, Ergebnisse und Feedback benötigen bei Verfügbarkeit die jeweils einschlägigen Einträge aus `meta.revisions`; der Kompass weist stattdessen seine `rulesVersion` aus. Themen führen Analysemodell und `analyzedAt` auf Abschnittsebene. `labelQuality` bewertet das Label, `clusterConfidence` den unkalibrierten modellspezifischen Clusterwert; ein Feld darf nicht als Ersatz für das andere verwendet werden.

## 7. Versioniertes Bedeutungslexikon

Der Kontext referenziert eine feste Definitionsversion. Das Lexikon verhindert, dass ein späterer Prompt Kennzahlen anhand ihrer Feldnamen frei deutet.

| Begriff                                          | Verbindliche Bedeutung                                                                                                | Nicht zulässige Verkürzung                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Best-Score                                       | abgesicherte positive Bewertung nach der bestehenden Wilson-Untergrenze                                               | fachliche Qualität oder Lernstand                                                      |
| Kontroversität                                   | Stärke geteilter positiver und negativer Bewertungen unter ausgewiesener Bezugsgröße und Berechnungsversion           | nachgewiesene Lagerbildung oder bloß viele Downvotes                                   |
| positive/negative Stimmen                        | abgegebene Richtungsbewertungen für eine Frage                                                                        | unterschiedliche Personen über mehrere Fragen hinweg                                   |
| Nettoscore                                       | positive minus negative Stimmen; aktuelles Legacy-Feld `upvoteCount`                                                  | Anzahl positiver Stimmen                                                               |
| effektive Quizstimme (`effective-vote`)          | pro Person und Frage höchstens eine Stimme; bei vorhandener Runde 2 ersetzt sie Runde 1                               | Runde 1 und Runde 2 addieren oder innerhalb einer Frage mischen                        |
| Rundenvergleich (`round-comparison`)             | getrennte Populationen von Runde 1 und Runde 2 derselben Quizfrage; die effektive Übersicht bleibt separat            | effektive Abstimmung, Addition beider Runden oder kausaler Lerneffekt                  |
| Häufigkeit                                       | Zahl der Beiträge, Mitglieder oder Bewertungen im jeweils genannten Scope                                             | Zahl verschiedener Lernender ohne entsprechenden Nachweis                              |
| Kategorie                                        | grobe 8.9b-Klassifikation `content`, `organization` oder `technical`                                                  | semantisches Thema oder bestätigte Absicht                                             |
| Thema                                            | Gruppe semantisch ähnlicher Beiträge innerhalb einer Analyseversion                                                   | dauerhaft stabile Taxonomie oder NLP-Kategorie                                         |
| `PENDING`                                        | Frage wartet in einem moderierten Kanal auf Freigabe                                                                  | bewiesener Klärungsbedarf                                                              |
| Bearbeitungsstand (`question-answer-state`)      | ausdrücklich erhobenes `addressed`, `unaddressed` oder `unavailable` unabhängig von Moderation, NLP und Quizantworten | Beleg für Klärungs- oder Lernbedarf                                                    |
| Modellkonfidenz                                  | verfahrensspezifischer Score mit Modell-/Analyseversion                                                               | kalibrierte Wahrscheinlichkeit ohne Kalibrierungsnachweis                              |
| Kompass-Regelscore (`compass-rule-score`)        | regelspezifischer normierter Auslösewert von 0 bis 1, dessen Bedeutung `basis` und `rulesVersion` festlegen           | Wahrscheinlichkeit, Qualität, Lernstand oder versionsübergreifend vergleichbarer Score |
| Modellabgeleitetes Lernziel                      | unbestätigter oder später bestätigter Vorschlag mit Herkunft                                                          | verbindliche didaktische Vorgabe                                                       |
| Bestätigtes Lernziel                             | von der Lehrperson bestätigter Text und Geltungsbereich                                                               | automatisch optimales Unterrichtsziel                                                  |
| Gesamtforum                                      | alle Fragen im ausgewiesenen fachlichen Scope                                                                         | analysierter oder gepackter Ausschnitt                                                 |
| analysierter Korpus                              | Bestand, den ein konkretes Analyseverfahren tatsächlich verarbeitet hat                                               | Gesamtforum oder Modellinput                                                           |
| Kandidatenkorpus (`candidate-corpus`)            | autorisierte fachliche Kandidaten vor Tokenbudget und Auswahl; darf spätere Grenzen überschreiten                     | bereits ausgewählter oder gepackter Modellinput                                        |
| Auswahlkorpus (`selected-corpus`)                | nach Filterung, Deduplizierung und Budgetauswahl tatsächlich gepackte Teilmenge                                       | vollständiger analysierter Korpus oder nicht vorhandene ausgelassene Elemente          |
| Quiz-Scope-ID (`quiz-scope-id`)                  | opaker, lokal stabiler Schlüssel für den fachlichen Umfang eines Quiz                                                 | Quellen-ID, Modelltext oder dereferenzierbare Aussage                                  |
| Quizabschnitt-Scope-ID (`quiz-section-scope-id`) | opaker Schlüssel für einen Abschnitt, nur zusammen mit der zugehörigen Quiz-Scope-ID eindeutig                        | Quellen-ID oder allein global eindeutiger Abschnitt                                    |
| Antwortoptions-ID (`answer-option-id`)           | innerhalb einer Antwortverteilung eindeutiger opaker Optionsschlüssel; die Bedeutung steht nur im separaten Label     | Quellenreferenz oder Lösungshinweis                                                    |

Das exportierte V1-Lexikon `MODERATION_PROMPT_DEFINITION_SET_V1` ist deutsch (`locale: de`). Die Locale des Domainkontexts bleibt davon getrennt und kann weiterhin `de`, `en`, `fr`, `es` oder `it` sein. Das Lexikon ist Vertragsbestandteil, aber nicht bei jeder Quelle zu duplizieren. Ein Wechsel seiner Semantik oder eine weitere Lexikon-Locale erfordert eine neue ausdrückliche Vertragsentscheidung; sie wird nicht durch freie Übersetzung im Adapter simuliert.

## 8. Deterministische Referenzdaten

Die Slice-1-Fixture verwendet eine Raumbezugsgröße von 200. Für die bestehende Kontroversitätsberechnung ergibt sich damit der Dämpfungswert 20. Die Werte sind feste Vertragsdaten, keine Ausgabe eines Embedding- oder Sprachmodells.

| ID  | Frage                                                         | Positiv | Negativ | Netto | Best-Score | Kontroversität |
| --- | ------------------------------------------------------------- | ------: | ------: | ----: | ---------: | -------------: |
| A   | Können wir mehr Beispiele zur linearen Regression bearbeiten? |      80 |      30 |    50 |   0,637432 |       0,461538 |
| B   | Gibt es ein weiteres Beispiel zur linearen Regression?        |      10 |       0 |    10 |   0,722460 |              0 |
| C   | Ist Kapitel 4 klausurrelevant?                                |      30 |       0 |    30 |   0,886483 |              0 |
| D   | Müssen wir den vierten Abschnitt für die Prüfung lernen?      |      12 |       0 |    12 |   0,757499 |              0 |
| E   | Soll die Anwesenheit verpflichtend sein?                      |      40 |      40 |     0 |   0,392972 |            0,8 |
| F   | Sollten wir eine Anwesenheitspflicht einführen?               |      20 |      20 |     0 |   0,351993 |       0,666667 |

Die Themen A/B, C/D und E/F sind in der Fixture ausdrücklich vorgegeben. Tests belegen damit Vertrags- und Aggregationsverhalten; sie behaupten nicht, ein reales Embedding-Modell müsse diese Gruppierung immer erzeugen. Das optionale bestätigte Lernziel lautet: »Die Studierenden können lineare Regressionsmodelle anwenden.«

Die öffentlichen Referenzdaten heißen:

- `MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1` für die reine Textbaseline;
- `MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1` für Status- und Bewertungsmetadaten;
- `MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1` für den vollständigen zulässigen Kontext;
- `MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1` für ausdrücklich nicht verfügbare beziehungsweise nicht anwendbare Bereiche.

Die zugehörigen Vertragstests decken außerdem unsichere Klassifikation, veraltete Themen, nicht freigegebene Ergebnisse, echten Score 0, ungültige Fremdreferenzen und manipulativen Fragetext als untrusted data ab.

## 9. Legacy- und Adapterkompatibilität

Der heutige Textauftrag bleibt eine eigenständige Wire-Form. Er besitzt im aktuellen Vertrag keinen erfundenen Versionswert:

```text
QaSummaryInferenceRequestSchema (bestehender Summary-Auftrag)
  locale + snapshotHash + qa-question sources { id, kind, text }

MODERATION_PROMPT_CONTEXT_CONTRACT_VERSION = moderation-prompt-context-v1
  versionierter, gepackter Kontext mit typisierten Quellen und Budgetbericht

QaSummaryInferenceRequestV2Schema
  schemaVersion 2 + qa-summary-context-v2 + qa-summary-model-output-v3
  + technische Instruktion + Definition + ModerationPromptContextV1
```

`moderation-prompt-context-v1` ist kein optionaler Zusatzblock in `QaSummaryInferenceRequestSchema`. Ein Legacy-Parser könnte unbekannte Felder entfernen und dadurch eine scheinbar erfolgreiche, tatsächlich aber unvollständige Verarbeitung melden. `QaSummaryAdapterCapabilitiesSchema` handelt deshalb `full-context` und `legacy-text` ausdrücklich aus und bindet im V2-Modus Anfrage-, Ausgabe-, Promptkontext- und Definitionsversion.

Für die kontrollierte Kompatibilität gilt:

- `QaSummaryInferenceRequestSchema` und `QaSummaryModelOutputSchema` bleiben als Legacy-Wire-Vertrag erhalten; V2 erweitert sie nicht still.
- Das V2-Quellenregister besitzt einen eigenen, typisierten Präsentationsvertrag und erweitert `QaSummarySourceKindEnum` nicht rückwirkend.
- Ein Adapter ohne V2-Kontextfähigkeit erhält nur den bestehenden Textauftrag; das V2-Ergebnis weist `adapter_incompatible` und den effektiven `legacy-text`-Modus aus.
- Fehlt auch der Legacy-Adapter oder scheitert der Lauf, erzeugt die Backend-Queue einen ausdrücklich markierten, quellengebundenen `extractive`-Fallback.
- Eine unbekannte Kontextversion wird abgelehnt; sie fällt nicht durch Zod-Stripping auf eine scheinbar kompatible Teilmenge zurück.
- `QaSummaryRuntimeCompatibleDTOSchema` versucht V2 zuerst; andernfalls würde das absichtlich schmale Legacy-Schema neue Felder entfernen.

Auch Quiz-Legacy bleibt kontrolliert: `exportVersion: 1` enthält keine Lernziele oder stabilen Quellenreferenzen. Der Slice-4-Import behandelt diesen Zustand als »nicht vorhanden« und erzeugt für die neue lokale Kopie kontrollierte Kennungen, aber keine Ziele aus Fragetexten. Native Exporte verwenden V2; der Host erhält wegen nicht verlustfrei kompatibler älterer Builds einen ausdrücklichen Hinweis.

## 10. Berechtigungs- und Datengrenzen

N5–N15 werden ausschließlich nach validierter Hostautorisierung ausgeführt. Sessioncode, Route, URL-Parameter und Browserzustand sind keine Berechtigungsquelle. `qa.summaryRuntime`, `qa.requestSummary` und `qa.summaryContextPreview` validieren den tatsächlichen Hosttoken und die Host-Nachbereitungsfrist. Teilnehmer- und Presenter-DTOs erhalten keine internen Kontextfelder.

Unabhängig von der Autorisierung gelten Datenminimierung und Freigabe:

- keine Host-/Admin-/Teilnehmertokens, IP-Adressen, Nicknames oder Teilnehmer-IDs;
- keine personenbezogenen Antworten, Ranglisten oder Bonuscodes;
- keine nicht freigegebenen Ergebnisverteilungen oder Lösungen;
- keine automatische Behauptung, Freitext sei anonym — Teilnehmertexte können selbst Personenbezüge enthalten;
- keine Rohprompts oder vollständigen Texte in Standardlogs; Telemetrie bleibt auf Mengen, Versionen, Budget, Laufzeiten und Fehlerklassen begrenzt;
- Fragen, Quiztexte und Lernziele bleiben untrusted content und können weder Instruktionen noch Rechte ändern.

Löschung, Rechteentzug oder Revision während eines Modelllaufs werden nicht durch einen früher gültigen Hash überschrieben. N15 baut vor und nach dem Lauf mit dem flüchtig im Queuejob gehaltenen Hosttoken neu auf. Nach Abschluss prüft `summaryRuntime` einen nicht mehr pendingen Stand erneut. Quellenänderung liefert einen an den neuen Stand gebundenen extraktiven Fallback; Rechteverlust liefert keine alten Quellen. Das Queue-Credential wird nach jedem Ausgang gelöscht und bei Session-Purge sofort entfernt.

## 11. Lernziel-Datenhaltung und Hostablauf

[ADR-0036](../architecture/decisions/0036-learning-objective-storage-and-live-projection.md) ist in Slice 4 für manuelle Ziele umgesetzt:

- Quizziele gehören kanonisch zur local-first Quiz-Sammlung. Die Yjs-Root-Map `quiz-learning-objectives-v1` verweist je Quiz mit `oplog-v1` auf die stabil benannte Operations-Map `quiz-learning-objectives-v1-oplog:<quizId>`; der lokale Spiegel `quiz-learning-objectives-v1:<roomId>` hält materialisierte Bundles statt Daten im von alten Clients normalisierten `quizzes`-Blob. Kausal unabhängige Ziele werden zusammengeführt, konkurrierende Fassungen desselben Ziels bleiben bis zur Hostentscheidung sichtbar, und Lösch-Tombstones verhindern Wiederbelebung durch Offline-Clients. Vollständige Legacy-Bundle-Writes werden auch bei verspätetem Mischbetrieb transaktional in Operationen übersetzt, ohne parallel neue Ziele implizit zu löschen. Der Marker `quiz-learning-objectives-v1-initialized` unterscheidet einen frischen Raum von einem autoritativ leeren Sidecar, damit ein Offline-Spiegel entfernte Ziele nicht wiederbelebt.
- `QuizLearningObjectiveBundleV1` begrenzt Zielzahl, Text, Referenzen und Revisionen. Ziele trennen `manual`/`model-derived`, `draft`/`confirmed`/`needs-review` und `quiz-wide`/explizites `question-set`. Aus Reihenfolge oder aktiver Frage entsteht kein erfundener Abschnitt.
- Die lokale `QuizQuestion.id` wird an Export-/Uploadgrenzen als `sourceQuestionId` transportiert. Import und Duplizieren erzeugen neue Quiz-, Fragen-, Antwort- und Ziel-IDs und remappen jede Scope- und Herkunftsreferenz. Der native Export ist V2; V1 bleibt exakt importierbar und bedeutet »kein Sidecar«. Unbekannte Versionen werden abgelehnt. Die Oberfläche warnt, dass ältere Builds V2 nicht verlustfrei verarbeiten.
- Live-Uploads senden für alle Aufgaben stabile IDs. Existiert ein Sidecar, bleibt auch ein bewusst leeres Bundle vom Zustand »nicht vorhanden« unterscheidbar. Ein Ziel, dessen erforderliche Aufgabe deaktiviert oder nicht enthalten ist, wird vollständig ausgelassen und als Hostwarnung ausgewiesen; Referenzen werden nicht auf ähnlich klingende Fragen umgebogen.
- Quizbundle und Ziele werden in derselben Uploadtransaktion gespeichert. `session.create` projiziert sie zusammen mit der Session; ein kontrolliertes `attachQuizToSession` ersetzt nur unveränderte `quiz-projected`-Ziele. `session-manual` und in der Session bearbeitete `session-override`-Ziele bleiben erhalten. Fehlende Quellen werden mit ihrer früheren Serverreferenz und einem typisierten Grund als unaufgelöst bewahrt.
- Die hostgeschützten tRPC-Pfade `session.getLearningObjectives` und `session.saveLearningObjectives` verwenden `learningContextRevision` als globale CAS-Grenze und Zielrevisionen für einzelne Änderungen oder Löschungen. `learningContextConfigured` unterscheidet einen nie eingerichteten Bestand von einem absichtlich leeren. Ein Attach besitzt zusätzlich eine Idempotenz-ID für verlorene Antworten.
- Ein Snapshot liefert nur kompakte Ziel- und Statusdaten sowie begrenzte, lösungsfreie Aufgabenkataloge. Der Quizkatalog enthält Server-IDs, Text und Reihenfolge. Der Q&A-Katalog wird hostautorisiert direkt aus der Session geladen, ist unabhängig von Forumsseite, Suche und Statusfiltern auf die 500 neuesten nicht gelöschten Fragen begrenzt und weist eine Kürzung ausdrücklich aus. Antwortoptionen, `isCorrect`, Musterlösungen, interne Quelldigests, Teilnehmerdaten und lokale Quellen-IDs sind im Live-DTO nicht zulässig.
- Die Lehrperson kann im Quizeditor und im Livedialog Ziele anlegen, bearbeiten, bestätigen, auf Entwurf setzen und löschen. Reine Q&A-Sessions verwenden den Session-Scope oder ausdrücklich gewählte Q&A-Fragen. Fehler, Konflikt-Reload, Löschbestätigung, Pending-Sperre, Fokuswiederherstellung, schmale Ansichten und fünf Locales sind Teil des UI-Vertrags.
- Semantisch relevante Änderungen an einer Herleitungsfrage markieren modellabgeleitete Ziele als `needs-review`; gelöschte Scope- oder Herleitungsquellen markieren jedes betroffene Ziel entsprechend. Der Text bleibt erhalten. Ein unaufgelöster Bezug kann nicht als bestätigt gespeichert werden und wird nicht durch eine andere Quelle ersetzt.
- Aktive Sessions sind beschreibbar. Nach dem fachlichen Ende bleibt der Zielbestand im bestehenden Host-Nachbereitungsfenster nur lesbar; danach wird er nicht mehr fachlich ausgeliefert. Session- und Orphan-Quiz-Cascades bereinigen die Serverkopien. Ein Legal Hold verlängert nur technische Aufbewahrung, nicht die Hostzugriffsfrist.

Der separate lösungshaltige Ableitungsauftrag ist in Slice 5 als ausdrückliche Hostaktion umgesetzt. Er ergänzt ausschließlich prüfbare Entwürfe und lässt manuelle, bearbeitete oder bestätigte Ziele unverändert. Der vollständige N10-Builder aus Slice 6 liest den sessionautoritativen Bestand nun lösungsfrei und nur mit aktuell auflösbaren Referenzen in den Moderationskontext ein. Ohne Ziele bleiben Live-Session, Regelkompass und Summary-Fallback vollständig nutzbar.

## 12. Umsetzungs- und Abnahmestatus

Die neuere Acht-Slice-Reihenfolge aus #456 ersetzt die ältere grobe Sechs-Slice-Skizze:

| Schritt      | Inhalt                                                                           | Integrierter Stand / offene Grenze                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slice 1      | Verträge, Lexikon, Quellenregister, Zustände, Referenzdaten, ADR                 | im Repo; Grundlage für N5–N15                                                                                                                                              |
| Slice 2      | autorisierter Q&A-Kontext, Bewertungen, Klassifikation und vorhandene Themen     | im Repo als backend-interne N5–N7-Fragmente                                                                                                                                |
| Slice 3      | gemeinsame Kompasslogik, freigegebene Quizresultate und Feedback                 | im Repo als backend-interne N8/N9-Fragmente und gemeinsames Regelmodul                                                                                                     |
| Slice 4      | manuelle Lernziele, Persistenz, Yjs/Import/Export/Live-Kopie und Host-UX         | implementiert; N10 übernimmt den sessionautoritativen, lösungsfreien Bestand                                                                                               |
| Runtime-PR R | gemeinsame private `llama-server`-Runtime für Label, Summary und Lernzielauftrag | implementiert und mit Merge-Commit `a8915068d1c53e6af463c2507c802a008632dd74` übernommen; Repository-Default aus; Betreiber-Testbetrieb für Lernziele                      |
| Slice 5      | bewusste modellgestützte Lernzielableitung                                       | implementiert; vollständiger Demo-Quiz-Lauf erzeugte zehn Entwürfe, fachliche Qualitätsabnahme offen                                                                       |
| Slice 6      | vollständiger Builder, deterministische Auswahl, Tokenbudget, Hash und Cache     | implementiert als backend-interne N10–N12-Stufen                                                                                                                           |
| Slice 7      | Summary-Anfragepfad, Adapterfähigkeit, Vorschau und erneute Quellenprüfung       | N13–N15, V2-Vertrag, Hostvorschau und Backend-Fallback implementiert                                                                                                       |
| Slice 8      | Gesamtintegration, produktionsnahe Messungen und Abschlussabnahme                | Demo-Quiz-Harness und Anforderungszuordnung vorhanden; Lernziel-Speicherwert gemeldet, vollständige Messungen, Summary-V2-Lauf und Prefill-Abnahme des 8.192-Profils offen |

»Im Repo« bedeutet, dass der Pfad vom autorisierten Fachbestand bis zu Vorschau, Adapterübergabe, Ergebnisbindung und Fallback ausführbar und fokussiert testbar ist. Es bedeutet nicht, dass der reichhaltige Kontext auf der vorgesehenen CPU-Box vermessen oder die optionale LLM-Schicht allgemein freigegeben wurde. Fokussierte Tests decken zusätzlich zur Q&A-/Themenprojektion die Freigabegrenze, effektive Stimmen, Null-Buckets, numerische und Rundenaggregate, Redis-Purge-Fence, fehlende Feedbackdaten, den DTO-Ausschluss interner Felder, Lernziel-Schema-, Import-/Export-, Sync-, Upload-, CAS-, Attach-, Lösch-, Retention-, Ableitungs- und UI-Zustände sowie Quellenabschluss, Priorisierung, Budget, Hash, Cache, Purge, Adapterkompatibilität, Rechte-/Quellenwechsel, Fallback und die drei Ablationsfixtures ab.

## 13. Offene Slice-8-Betriebsnachweise

Das feste Summaryprofil reserviert von 8.192 konservativen Budgeteinheiten 314 für die technische Instruktion, 203 für die Definition, 640 für die Antwort und 128 als Sicherheitsmarge. Damit bleiben höchstens 6.907 für das kanonische Kontext-JSON. Überschreiten Basismetadaten trotzdem das Budget, packt die Implementierung kontrolliert die ausgewiesene Q&A-Textbaseline bzw. Force-Fit-Mindestbelege neu.

Für diesen ursprünglichen Integrationsstand stand keine reale Zielruntime für `qa_summary` V2 oder `learning_objectives` zur Verfügung. Nachträglich meldete der Betreiber am 12.10.2026 einen vollständigen Demo-Quiz-Lernziellauf mit zehn Entwürfen auf dem privaten Produktionshost. Für diesen Lauf sind ein cgroup-Speicherhöchststand von rund 3,56 GiB und keine neuen OOM-Ereignisse belegt; die vollständige CPU-/Prefill-/Laufzeitmessung und fachliche Qualitätsprüfung fehlen. Ein echter `qa_summary`-V2-Lauf samt Prefill-/RSS-Nachweis sowie ein nutzbares reichhaltiges Kontextprofil bleiben in der [Slice-8-Abnahme](../implementation/ISSUE-456-SLICE-8-ABNAHME.md) offen. Issue #456 und die optionale LLM-Schicht sind damit nicht allgemein freigegeben.

## 14. Weiterführende Dokumente

- [Moderationskompass](moderation-compass.md)
- [Q&A-NLP-Kaskade](qa-nlp-moderation.md)
- [Semantische Themen](word-cloud-semantic.md)
- [Generative Moderationszusammenfassung](qa-summary.md)
- [Modellgestützte Lernzielableitung](learning-objective-derivation.md)
- [Issue #456 – Slice-8-Abnahme](../implementation/ISSUE-456-SLICE-8-ABNAHME.md)
- [Technisches Onboarding 1.3](moderation-compass-onboarding-1.3.md)
- [ADR-0035: private LLM-Runtime](../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md)
- [ADR-0036: Lernziel-Datenhaltung und Live-Projektion](../architecture/decisions/0036-learning-objective-storage-and-live-projection.md)
- [Quiz-Sammlung und Yjs-Sync](../architecture/quiz-library-sync.md)
- [Absoluter Session-Lebenszyklus](session-lifecycle.md)
