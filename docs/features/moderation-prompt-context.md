<!-- markdownlint-disable MD013 -->

# Versionierter Moderations-Prompt-Kontext (#456)

**Zielgruppe:** Product Owner, Entwicklerinnen und Entwickler von Shared Types, Backend, Frontend und Runtime
**Stand:** 2026-10-03
**Repo-Abgleich:** `64830fad` vom 2026-10-02
**Status:** Slice 1/8 definiert Vertrag, Zustände, Quellen, Bedeutungslexikon, Referenzdaten und Speicherentscheidung. Produktiver Kontextbuilder, Datenzugriff, Tokenpacker, Persistenz, Host-UI, Runtime und Adapterintegration bleiben geplant.
**Issue:** [#456 – Vollständiger LLM-Kontext für Moderationsprompt vorbereiten](https://github.com/kqc-real/arsnova.eu/issues/456)
**Roadmap:** [#463 – Release 1.3.0](https://github.com/kqc-real/arsnova.eu/issues/463)
**ADR:** [ADR-0036 – Lernziel-Datenhaltung und getrennte Live-Projektion](../architecture/decisions/0036-learning-objective-storage-and-live-projection.md)

## 1. Ergebnis und Grenze von Slice 1

Slice 1 schafft eine gemeinsame Sprache für den späteren Moderationskontext. Der Vertrag kann ausdrücken, **welche** zulässigen Informationen vorliegen, welchen Zustand sie haben, worauf sie sich beziehen und welche Quellen sie tragen. Das verbindliche Sechs-Fragen-Szenario liegt als deterministische Referenz vor. Die Daten werden in diesem Slice noch nicht aus einer Live-Session geladen und nicht an ein Modell gesendet.

Damit gelten insbesondere folgende Grenzen:

- Der bestehende 8.9c-Summary-Pfad und `QaSummaryInferenceRequestSchema` bleiben unverändert.
- Es gibt noch keinen serverseitigen Builder für den vollständigen Kontext.
- Es gibt noch keine Lernzielpersistenz, Migration, Yjs-Erweiterung oder Host-Oberfläche.
- Es gibt noch keine Tokenisierung, Budgetauswahl, Kontextvorschau oder Cacheverdrahtung.
- Die private Runtime aus Story 8.9d ist weiterhin nicht implementiert. Der Gemini-Entwicklungshelfer, der bestehende HTTP-Adapter und der Encoder sind kein Runtime-Nachweis.
- Ein Vertragstest oder eine Fixture belegt keine Promptqualität und keine didaktische Wirksamkeit.

Der neue Vertrag ist deshalb eine **vorbereitete, noch nicht produktiv verdrahtete Schnittstelle**. Feature-Flags bleiben unverändert; Slice 1 ändert weder Summary-Auswahl noch UI noch Live-Verhalten.

## 2. Repo-Abgleich und Integrationslandkarte

Ausgangspunkt ist der tatsächliche Bestand auf `64830fad`, nicht ein angenommenes Zielsystem:

| Bereich                              | Vor Slice 1 vorhanden                                                                                                                                                                             | Noch fehlende Integration                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Q&A-Kurzfassung                      | `QaSummaryInferenceRequestSchema` mit `locale`, `snapshotHash` und höchstens 40 Quellen `{ id, kind, text }`; produktiver Snapshot standardmäßig höchstens 20 Fragen mit je höchstens 500 Zeichen | vollständigen Kontext erst in Slice 7 über Adapterfähigkeit anbinden                 |
| Q&A-Bewertungen                      | `QaQuestion` speichert positive und negative Stimmen sowie `upvoteCount`; der Legacy-Name `upvoteCount` bezeichnet im aktuellen Pfad den Nettowert                                                | autorisierte Projektion und Revisionsbezug in Slice 2                                |
| Q&A-Klassifikation                   | Status, Kategorie `content`/`organization`/`technical`, Konfidenz, Modellversion und Analysezeit im Hostpfad                                                                                      | vorhandene Ergebnisse lesen, niemals beim Kontextaufbau neu starten                  |
| Semantische Themen                   | begrenzter Snapshot, Encoder, Clustering, optionale Labelherkunft und Analysezustände in 1.14c                                                                                                    | vorhandenen Analysestand mit Korpus- und Altersbezug in Slice 2 projizieren          |
| Regelkompass                         | deterministische Karten- und Priorisierungslogik im Session-Host                                                                                                                                  | benötigte Fachlogik in Slice 3 gemeinsam und serverseitig autoritativ nutzbar machen |
| Quizbibliothek                       | `QuizDocument` local-first in Signals, lokalen Spiegeln und Yjs/IndexedDB; Exportformat Version 1                                                                                                 | Lernziele, stabile Aufgabenreferenzen und Export-/Uploadpfade erst in Slice 4        |
| Live-Quiz                            | zeitlich begrenzte Prisma-Quizkopie mit Lösungen für den Quizbetrieb                                                                                                                              | sessionautoritative Lernzielkopie und strikte Live-Projektion erst in Slice 4        |
| Freigegebene Ergebnisse und Feedback | vorhandene Host-Aggregate und Freigabe-/Phasengrenzen                                                                                                                                             | autorisierte Kontextprojektion in Slice 3                                            |
| Runtime                              | ADR-0035 und bestehender privater Summary-HTTP-Vertrag; keine abgenommene `llama-server`-Runtime                                                                                                  | separater Runtime-PR R nach Slice 4, vor Slice 5                                     |

### 2.1 Maßgebliche bestehende Pfade

- Shared Summary-Vertrag: `libs/shared-types/src/schemas.ts`
- Summary-Snapshot und Hash: `apps/backend/src/lib/qaSummarySnapshot.ts`
- Queue und flüchtiger Ergebniszustand: `apps/backend/src/lib/qaSummaryQueue.ts`
- HTTP-Adapter: `apps/backend/src/lib/qaSummaryAdapter.ts`
- Q&A-Scoreberechnung und Themenzugriff: `apps/backend/src/routers/wordCloud.ts`
- Moderationskompass: `apps/frontend/src/app/features/session/session-host/moderation-compass.ts`
- Local-first Quizmodell, Import, Export und Upload: `apps/frontend/src/app/features/quiz/data/quiz-store.service.ts`
- Export- und Uploadschemas: `libs/shared-types/src/schemas.ts`
- Serverkopie und Sessionlebenszyklus: `prisma/schema.prisma` und [session-lifecycle.md](session-lifecycle.md)

Diese Pfade bleiben für ihre heutigen Aufgaben maßgeblich. Der neue Vertrag ersetzt keine bestehende Fachberechnung und eröffnet keine zweite NLP- oder Themenpipeline.

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

| Aggregat       | Erlaubter Scope                                                 | Strukturierte Regeln und Konsistenz                                                                                                                                                                                                                |
| -------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quizresultat   | `question` mit `quizScopeId` und genau einer `questionSourceId` | `answer-distribution` mit `optionSet: all-answer-options`, `responseCount`, `selectionCount`, `selectionCardinality` und vollständigen Buckets `{ optionId, label, count }` oder `correctness-summary` mit `correct`, `incorrect` und `unanswered` |
| Quizresultat   | `quiz` mit `quizScopeId`                                        | `score-summary` mit positivem `responseCount`, `minimum`, `maximum` und `mean` oder `completion-summary` mit `completed` und `incomplete`; die Regelwerte decken die eingeschlossene Population ab                                                 |
| Quick Feedback | Kanal `quickFeedback` und explizites Zeitfenster                | `tempo-distribution`, `rating-distribution` oder eine zum Feedbacktyp passende `flashlight-distribution`; eindeutige typisierte Buckets summieren sich zur eingeschlossenen Population                                                             |

Jedes Quizresultat deklariert verpflichtend `voteBasis: { kind: effective-vote, version: effective-vote-v1 }`. Diese Basis verweist auf die gemeinsame Regel aus ADR-0028: Existiert für eine Frage mindestens eine Runde-2-Stimme, ersetzt Runde 2 die erste Runde; andernfalls zählt Runde 1. Pro teilnehmender Person und Frage fließt höchstens eine effektive Stimme ein, und bei vorhandener Runde 2 bleibt eine Person ohne Runde-2-Abgabe für diese Frage ohne effektive Stimme. Ein Aggregat über gleichzeitig gespeicherte Runde-1- und Runde-2-Stimmen besitzt in V1 keine zulässige Vertragsvariante.

Quizpopulationen heißen `eligible-submissions`, Feedbackpopulationen `eligible-feedback-responses`; jeweils gilt `included ≤ eligible`. Bei Antwortverteilungen entspricht `responseCount` der eingeschlossenen effektiven Population. `selectionCount` ist die Bucket-Summe und muss zwischen `responseCount × minimumPerResponse` und `responseCount × maximumPerResponse` liegen; kein Bucket darf eine Option häufiger als einmal je Antwort zählen. Options-IDs und Labels sind eindeutig, und `maximumPerResponse` überschreitet nicht die vollständig aufgeführte Optionszahl. Feedbackverteilungen sind auf die vereinbarten Typen `TEMPO`, `STARS`, `MOOD`, `YESNO`, `YESNO_BINARY`, `TRUEFALSE_UNKNOWN` und `ABCD` begrenzt. `optionId` ist ein opaker Bucketschlüssel, keine Quellenreferenz und kein Lösungshinweis. Insbesondere ist `isCorrect` auch innerhalb einer freigegebenen Antwortverteilung unzulässig.

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

`meta.revisions` weist die Quellstände für Fragetext, Stimmen, Moderationsstatus, Bearbeitungsstand (`questionAnswerState`), Themen, Lernziele, freigegebene Ergebnisse und Feedback einzeln als `available`, `unavailable` oder `not-applicable` aus. Damit kann ein späterer Builder einen teilweise revisionslosen Bestand ausdrücklich begrenzen, statt eine globale Revision fälschlich auf alle Bereiche zu übertragen.

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
2. Die Promptprojektion weist darüber hinaus jede Quelle ab, die vom **ausgewählten** Fachgraphen nicht erreichbar ist. Jeder enthaltene Q&A-Text muss zugleich in `questions.items` dargestellt sein. Die eindeutige Menge dargestellter Themenmitgliedstexte muss `topics.corpus.representedQuestions` entsprechen. Q&A- und Quizfragentexte teilen sich die Grenze `selectionLimits.questions`; Bereichszahlen dürfen auch ihre übrigen Auswahlgrenzen nicht überschreiten.

Ein manuelles Lernziel mit `tasks`-Scope darf zulässige Q&A- oder Quizfragen referenzieren; mehrere Quizaufgaben müssen demselben `quizScopeId` angehören. Bei `origin.kind: model-derived` sind `session`-Scopes ausgeschlossen und sowohl `derivedFromSourceIds` als auch etwaige Aufgabenreferenzen ausschließlich `quiz-question`. Die eindeutigen Ableitungsquellen gehören demselben Quizscope an. Bei `quiz` stimmt ihre `quizScopeId` mit dem Ziel überein, bei `section` zusätzlich ihre `sectionScopeId`; bei `tasks` muss jede Ableitungsquelle in `taskSourceIds` liegen. Damit bleibt eine reine Q&A-Session bei manuellen Zielen; die modellgestützte Ableitung gehört zum getrennten Quiz-Vorbereitungsauftrag.

Referenzvalidierung ist eine strukturelle Prüfung. Ob eine Aussage durch die referenzierte Quelle inhaltlich wirklich getragen wird, bleibt eine eigene Qualitäts- und Evaluationsaufgabe.

Kompasssignale dürfen je nach Signaltyp Q&A-Fragen, Themen, Quizfragen, Lernziele, Ergebnisaggregate oder Feedbackaggregate als Evidenz referenzieren. `questionSourceIds` darf deshalb für reine Themen-, Lernlücken-, Ergebnis- oder Feedbacksignale leer sein; mindestens ein typisierter Evidenzbezug bleibt Pflicht. Jede Q&A-Evidenz erscheint zugleich in `questionSourceIds`, und jede dort genannte Frage erscheint zugleich als Q&A-Evidenz. Darüber hinaus bindet der Vertrag Signal, Messbasis und beobachtete Belege exakt:

| Signaltyp             | Verpflichtende `basis`       | Evidenz- und Wertinvariante                                                                                                                                        |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `high-best-score`     | `best-score`                 | mindestens eine Q&A-Frage; `value` entspricht einem verfügbaren Best-Score der genannten Fragen                                                                    |
| `high-controversy`    | `controversy-score`          | mindestens eine Q&A-Frage; `value` entspricht einer verfügbaren Kontroversität der genannten Fragen                                                                |
| `high-frequency`      | `question-frequency`         | mindestens eine Q&A-Frage; ganzzahliger `value` entspricht exakt der Zahl der genannten Fragen                                                                     |
| `unanswered`          | `unaddressed-question-count` | mindestens eine Q&A-Frage; ganzzahliger `value` entspricht exakt der Zahl der genannten und ausdrücklich `unaddressed` ausgewiesenen Fragen                        |
| `topic-concentration` | `topic-question-share`       | verfügbare Themenevidenz; `value` liegt im Intervall 0 bis 1                                                                                                       |
| `learning-gap`        | `learning-gap-rule-score`    | verfügbares Lernziel und freigegebenes Ergebnis mit `population.included > 0` im selben Quiz-, Abschnitts- oder Aufgaben-Scope; `value` liegt im Intervall 0 bis 1 |
| `result-pattern`      | `released-result-rule-score` | freigegebenes Ergebnis mit `population.included > 0`; `value` liegt im Intervall 0 bis 1                                                                           |
| `feedback-pattern`    | `feedback-rule-score`        | verfügbares Feedbackaggregat mit `population.included > 0`; `value` liegt im Intervall 0 bis 1                                                                     |

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
```

`moderation-prompt-context-v1` ist kein optionaler Zusatzblock in `QaSummaryInferenceRequestSchema`. Das bestehende nicht-strikte Zod-Objekt könnte unbekannte Felder beim Parsen still entfernen und dadurch eine scheinbar erfolgreiche, tatsächlich aber unvollständige Verarbeitung melden. Deshalb muss die spätere Adapterintegration die unterstützte Anfrage- und Ausgabeversion ausdrücklich aushandeln beziehungsweise konfigurieren.

Für Slice 1 gilt:

- `QaSummaryInferenceRequestSchema`, `QaSummaryModelOutputSchema`, Queue, Snapshot und UI bleiben unverändert.
- Das neue Quellenregister erweitert `QaSummarySourceKindEnum` nicht still.
- Ein Adapter ohne V1-Kontextfähigkeit erhält weiterhin nur den bestehenden Textauftrag oder einen ausdrücklich ausgewiesenen extraktiven/regelhaften Fallback.
- Eine unbekannte Kontextversion wird abgelehnt; sie fällt nicht durch Zod-Stripping auf eine scheinbar kompatible Teilmenge zurück.
- Erst Slice 7 erzeugt einen ausführbaren neuen Adapterauftrag. Erst Slice 8 kann die Gesamtintegration abnehmen.

Auch Quiz-Legacy bleibt kontrolliert: `exportVersion: 1` enthält keine Lernziele oder stabilen Quellenreferenzen. Nach ADR-0036 wird der spätere Import diesen Zustand als »nicht vorhanden« behandeln und bei Bedarf Kennungen kontrolliert ergänzen, nicht Ziele aus Texten erraten.

## 10. Berechtigungs- und Datengrenzen

Der Kontextaufbau wird später ausschließlich nach validierter Hostautorisierung ausgeführt. Sessioncode, Route, URL-Parameter und Browserzustand sind keine Berechtigungsquelle. Teilnehmer- und Presenter-DTOs erhalten keine internen Kontextfelder.

Unabhängig von der Autorisierung gelten Datenminimierung und Freigabe:

- keine Host-/Admin-/Teilnehmertokens, IP-Adressen, Nicknames oder Teilnehmer-IDs;
- keine personenbezogenen Antworten, Ranglisten oder Bonuscodes;
- keine nicht freigegebenen Ergebnisverteilungen oder Lösungen;
- keine automatische Behauptung, Freitext sei anonym — Teilnehmertexte können selbst Personenbezüge enthalten;
- keine Rohprompts oder vollständigen Texte in Standardlogs; Telemetrie bleibt auf Mengen, Versionen, Budget, Laufzeiten und Fehlerklassen begrenzt;
- Fragen, Quiztexte und Lernziele bleiben untrusted content und können weder Instruktionen noch Rechte ändern.

Löschung, Rechteentzug oder Revision während eines späteren Modelllaufs erfordern vor Anzeige eine erneute Quellenprüfung. Ein früher gültiger Hash ist keine dauerhafte Auslieferungsberechtigung.

## 11. Lernziel-Datenhaltung

[ADR-0036](../architecture/decisions/0036-learning-objective-storage-and-live-projection.md) legt für die späteren Slices fest:

- Quizziele gehören kanonisch zur local-first Quiz-Sammlung. Während Mischversions-Sync liegt ihr Zustand in der Yjs-Root-Map `quiz-learning-objectives-v1` mit dem lokalen Spiegel `quiz-learning-objectives-v1:<roomId>` statt im von alten Clients normalisierten `quizzes`-Blob.
- Live-Ziele werden kontrolliert in einen sessionautoritativen Bestand kopiert; Q&A-only-Ziele leben ausschließlich dort.
- Die vorhandene lokale `QuizQuestion.id` wird an Export-/Uploadgrenzen als `sourceQuestionId` transportiert. Sie überbrückt lokale Frage, Exportpaket und Serverkopie, ohne Prisma-IDs oder `historyScopeId` zum Quellenvertrag zu machen. Import und Duplizieren remappen alle internen Referenzen atomar auf die neue Quizkopie.
- Export Version 2 trägt Ziele und Referenzmapping; der spätere Parser akzeptiert die bekannten Versionen exakt und weist unbekannte Future-Versionen ab. Version 1 bedeutet ausdrücklich »keine gespeicherten Lernziele«.
- Herkunft, Hostbestätigung, Prüfbedarf und Revision bleiben getrennt.
- Eine dedizierte Session-Lernkontextrevision invalidiert Kontext und Cache; `sessionLifecycleRevision` wird dafür nicht zweckentfremdet. Ein Quizwechsel ersetzt nur quizprojizierte Ziele und bewahrt sessionmanuelle Q&A-only-Ziele.
- Ein lösungshaltiger Ableitungsauftrag ist ein eigener Host-gestarteter Runtimevertrag. Der Live-Kontext erhält nur kompakte Ziele, Provenienz, zulässige Referenzen und freigegebene Aggregate.
- Ein interner Quelldigest darf Veraltung erkennen, wird aber nicht an das Live-Modell gegeben; insbesondere sind Hashes niedrig-entropischer Lösungen kein Ersatz für Lösungstrennung.
- Änderungen an relevanten Quizquellen markieren Ableitungen als prüfbedürftig; sie überschreiben keine bestätigte Hostbearbeitung.

Diese Entscheidung ist in Slice 1 dokumentiert, aber noch nicht persistiert oder in der UI umgesetzt.

## 12. Umsetzungs- und Abnahmestatus

Die neuere Acht-Slice-Reihenfolge aus #456 ersetzt die ältere grobe Sechs-Slice-Skizze:

| Schritt      | Inhalt                                                                           | Status nach Slice 1                    |
| ------------ | -------------------------------------------------------------------------------- | -------------------------------------- |
| Slice 1      | Verträge, Lexikon, Quellenregister, Zustände, Referenzdaten, ADR                 | im Repo; keine Produktivverdrahtung    |
| Slice 2      | autorisierter Q&A-Kontext, Bewertungen, Klassifikation und vorhandene Themen     | geplant                                |
| Slice 3      | gemeinsame Kompasslogik, freigegebene Quizresultate und Feedback                 | geplant                                |
| Slice 4      | manuelle Lernziele, Persistenz, Yjs/Import/Export/Live-Kopie und Host-UX         | geplant                                |
| Runtime-PR R | gemeinsame private `llama-server`-Runtime für Label, Summary und Lernzielauftrag | geplant; Eingangskriterium für Slice 5 |
| Slice 5      | bewusste modellgestützte Lernzielableitung                                       | geplant; abhängig von abgenommenem R   |
| Slice 6      | vollständiger Builder, deterministische Auswahl, Tokenbudget, Hash und Cache     | geplant                                |
| Slice 7      | Summary-Anfragepfad, Adapterfähigkeit, Vorschau und erneute Quellenprüfung       | geplant                                |
| Slice 8      | Gesamtintegration, produktionsnahe Messungen und Abschlussabnahme                | geplant                                |

»Im Repo« bedeutet für Slice 1 ausschließlich, dass gemeinsame Begriffe und Datenverträge prüfbar sind. Es bedeutet nicht, dass ein Live-Aufruf bereits `ModerationPromptContextV1` erzeugt, verarbeitet oder anzeigt.

## 13. Weiterführende Dokumente

- [Moderationskompass](moderation-compass.md)
- [Q&A-NLP-Kaskade](qa-nlp-moderation.md)
- [Semantische Themen](word-cloud-semantic.md)
- [Generative Moderationszusammenfassung](qa-summary.md)
- [Technisches Onboarding 1.3](moderation-compass-onboarding-1.3.md)
- [ADR-0035: private LLM-Runtime](../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md)
- [ADR-0036: Lernziel-Datenhaltung und Live-Projektion](../architecture/decisions/0036-learning-objective-storage-and-live-projection.md)
- [Quiz-Sammlung und Yjs-Sync](../architecture/quiz-library-sync.md)
- [Absoluter Session-Lebenszyklus](session-lifecycle.md)
