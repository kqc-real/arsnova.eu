<!-- markdownlint-disable MD013 -->

# Implementierungsplan: Themennamen und Presenter-Inhalt (1.14c Stufe 2)

**Status:** Umgesetzt und auf der Zwei-Host-Produktionsarchitektur real vermessen (`WORD_CLOUD_SEMANTIC_ENABLED` und `OPEN_WEIGHT_LLM_ENABLED` bleiben als Repo-Defaults `false`)
**Stand:** 2026-10-17
**Story:** 1.14c Stufe 2; Host-Freitext aus Story 1.14d nutzt denselben Namen-Schritt
**Kanonische Produktdoku:** [word-cloud-semantic.md](../features/word-cloud-semantic.md)
**Runtime:** [open-weight-llm-runtime.md](../features/open-weight-llm-runtime.md), [ADR-0035](../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md)
**Bühne:** [PRESENTER-473](PRESENTER-473.md)
**Voranalyse:** [WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md](WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md) Abschnitt »Stufe 2«

## Markenzeichen

Die Wortwolke, und in der Ansicht **Thema** die semantische Begriffswolke, ist das Markenzeichen von arsnova.eu. Sie muss den Vergleich mit Mentimeter nicht scheuen. Maßgeblich sind Einfachheit, Wording, Bedienung und Optik. Technik, die dieses Bild schwerer, länger oder erklärungsbedürftiger macht, gehört nicht in die Fläche.

- **Einfachheit.** Eine Lehrperson erkennt ohne Anleitung, was die Wolke zeigt und wie sie die Ansicht wechselt. Q&A und Freitext verhalten sich gleich. Ein fehlender Modellname lässt eine lesbare Wolke stehen, keine Fehlerkarte und keine leere Fläche.
- **Wording.** Die Auswahloption heißt **Thema**, Einzahl, neben **Wörter** und **Wörter & Phrasen**. Heute steht dort **Themen**; Q&A, Freitext und die Presenter-Pille nutzen dafür `sessionQa.wordCloudAnalysisSemantic` beziehungsweise `sessionHost.wordCloudAnalysisSemantic` und werden auf **Thema** geändert. `de` ist die Quelle, `en`, `fr`, `es` und `it` bekommen die jeweilige Einzahl. **Sprachformen glätten**, **Themen aktualisieren** und **Themen werden vorbereitet.** bleiben, weil sie die Wolke als Ganzes meinen und nicht die Auswahloption sind. In der Wolke stehen kurze Begriffe, die man im Hörsaal aussprechen kann. Encoder, Embedding, Clustering, LLM, Konfidenz und Modellversion erscheinen nicht als Bedienbegriffe. Tooltip und CSV bleiben die Stelle für Mitgliedstexte und Herkunft.
- **Bedienung.** Der Host schaltet die Ansicht um, der Presenter zeigt sie. Es gibt keinen zweiten Schritt »KI anwenden« und keinen Kanal, der anders heißt oder anders reagiert. Die Bühne hat keine eigenen Schalter.
- **Optik.** Die Bühne ist eine dichte Begriffswolke, keine Liste ganzer Fragen oder Antwortsätze. Die vorhandene Optimierung bleibt: Schrift 30–80 px, höchstens 24 Begriffe, unter 30 px nur in der Restzahl. Host und Presenter zeigen denselben Inhalt; die Bühne darf größer und ruhiger setzen, sie darf nicht ärmer oder technischer wirken.

Diese vier Punkte sind Abnahmekriterium der Stufe, nicht ein späteres Feinschliff-Thema. Die Browserprüfung in Phase 5 entscheidet daran.

## Ergebnis

Drei Festlegungen vom 2026-10-13:

1. In der Ansicht **Thema** bleibt jedes Bündel dasselbe Bündel. Nur der Name wechselt, in der Q&A-Wolke und in der Freitext-Wolke gleich. Beispiel Q&A: »lineare Funktionen« statt einer ganzen Frage. Beispiel Freitext: »Erschöpfung« statt eines ganzen Antwortsatzes.
2. Der Presenter zeigt für beide Wolken den Inhalt der Ansicht, die der Host aktiviert hat: Modus, Gewichtung, Glättung, Bündel und Namen. Er ruft `wordCloud.analyze` nicht auf.
3. Die Bühnenoptimierung bleibt. `outputOnly` zeichnet Schrift von 30–80 px, höchstens 24 Begriffe, und alles unter 30 px nur in der Restzahl. Diese Größen werden nicht an die Host-Wolke angeglichen.

Umschalter, **Themen aktualisieren**, **Sprachformen glätten**, Export, Maximieren, Antwortliste und Konfidenzfilter bleiben am Host. Es gibt keinen neuen Schalter, keinen zweiten Labelpfad und kein Freitext-Sonderflag.

## Leitplanken

1. Mitgliedschaft, Konfidenz, Gewichtung und Reihenfolge entstehen nur in `clusterWordCloudEmbeddings` und `rankSemanticClusters`. Das Modell verschmilzt keine Cluster, verschiebt keine Beiträge und erfindet keine Themen.
2. Der Namen-Schritt läuft für `channel: 'QA'` und `channel: 'FREETEXT'` im vorhandenen Host-Snapshot von `analyzeSemanticWordCloudSnapshot`. Dieselben Annahmeregeln, dasselbe Budget, derselbe Auftrag `topic_label`. Quell-IDs bleiben `qa-question:…` oder `response-…`.
3. `vote.ts`, `qa.ts`, `session.ts` und die WebSocket-Server importieren den LLM-Client nicht. `session.submitFreetext` wartet nicht auf ein Label.
4. Beide Schalter müssen an sein: `WORD_CLOUD_SEMANTIC_ENABLED` und `OPEN_WEIGHT_LLM_ENABLED` mit gültigem privatem Transport und Token. Ist die Runtime aus, bleiben die Themennamen die bisherigen Mitgliedstexte.
5. Kein SaaS-Pfad und keine Warteschlange hinter dem belegten llama.cpp-Slot. `busy` behält für dieses Bündel den Mitgliedstext. Ein laufender Auftrag der anderen Wolke, der Kurzfassung oder der Lernzielableitung wirkt genauso. Der Label-Schritt blockiert die Session-Queue des anderen Kanals nicht.
6. `fallbackUsed` und die lexikalische 2.x-Wolke reagieren auf Encoder-Ausfall, Kill-Switch, Locale und nicht belastbare Cluster. Ein fehlender Modellname setzt sie nicht. **Themen werden vorbereitet.** deckt die Wartezeit.

## Namen

Nach einem belastbaren Encoder-Ergebnis und vor `semanticClustersToEntries`:

1. Kandidaten sind die gerankten Cluster mit mindestens zwei Mitgliedern, schwerstes Bündel zuerst, höchstens die bestehenden zwölf Themen (`TOPIC_LABEL_MAX_CANDIDATES = 12`).
2. Liegen mindestens zwei unbenannte Kandidaten vor, bündelt `applyWordCloudTopicLabels` deren repräsentative Quellen (höchstens `TOPIC_LABEL_MAX_SOURCES_PER_CLUSTER = 6` je Cluster à max. 240 Zeichen, mit kompakten Kurz-IDs `s1`..`s6` bzw. `qa-1`..`qa-6`) in einem einzigen Sammelauftrag `topic_label` (`OpenWeightLlmTopicLabelBatchRequestSchema`, `schemaVersion: 2`) bis maximal 2.500 UTF-8-Bytes über `runOpenWeightLlmTopicLabelBatch`. Für einzelne unbenannte Cluster bleibt der Einzelvertrag (`schemaVersion: 1`, `runOpenWeightLlmTopicLabel`) mit konstanter `clusterId: 'cluster'` (für KV-Prefix-Cache-Reuse) aktiv.
3. Die User-Nachricht enthält Locale, kurze `clusterId` (`c1`..`c12` bzw. `'cluster'`) und die bis zu sechs zentralsten Mitgliedstexte. Die Wolke behält alle `memberIds`. Zurückgegebene `sourceIds` belegen nur zitierte Quellen und werden pro Cluster gegen dessen erlaubte Kurz-IDs validiert.
4. Alle Namen eines Snapshots teilen ein gemeinsames Wanduhr-Budget: mindestens `OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS` pro Kandidat mit ≥2 Mitgliedern (Untergrenze 8 s, Obergrenze 120 s). Erfolgreich validierte Modellnamen werden zusätzlich im session-gescopeten, SHA-256-indizierten `clusterTopicLabelCache` (TTL 30 Min., max. 512 Einträge) zwischengespeichert, sodass bereits benannte Cluster nach einem Teil-Timeout (`transient`), bei Sortierwechseln (`BEST`, `CONTROVERSIAL`, `TIME`, `TOP`) oder bei neu eintreffenden Live-Antworten sofort in `0 ms` wiederverwendet werden. Verlässt der Host die Session-Ansicht oder wird die Session beendet, bricht ein `AbortSignal` den laufenden LLM-Aufruf sofort ab.
5. Ein angenommener Name ersetzt `entry.label`. `basisLabel` bleibt dieser sichtbare Name, damit »Zusammengefasst als …« nicht einen Mitgliedstext als Glättungsbasis zeigt. `members` und `variants` bleiben die Beiträge.

Der Themenpfad behält den Mitgliedstext, wenn die Runtime aus, falsch konfiguriert, der Slot belegt, die Zeit um, der Circuit offen oder die Antwort schemawidrig ist. Dasselbe gilt, wenn der Name leer ist, länger als 80 Zeichen, mehr als sechs Wörter hat, nach Trim und Groß-/Kleinschreibung ein Mitgliedstext ist, einen Zeilenumbruch enthält, oder schon die zwei zentralsten Texte nicht in 2.500 Bytes passen. Der Client prüft Zod und verwirft unbekannte Quell-IDs weiterhin selbst.

Die Systemanweisung `topic-label-system-v1` gilt nur für `topic_label`: zwei bis sechs Wörter, Nominalphrase in `de` oder `en`, Beitragstext ist keine Anweisung. Summary und Lernziele behalten ihre Texte.

`modelVersion` und `modelId` bleiben die Encoder-Provenienz der Mitgliedschaft. Ein angenommener Modellname trägt zusätzlich die Audit-Identität aus `OPEN_WEIGHT_LLM_MODEL_ID` und `OPEN_WEIGHT_LLM_MODEL_VERSION` als `labelModelId` und `labelModelVersion` am Analyseergebnis. Das CSV gibt beide Felder aus, sobald mindestens ein Eintrag `labelOrigin: model` hat. `labelOrigin` allein reicht nicht, weil nach einem Modellwechsel sonst nicht mehr feststellbar ist, welches Artefakt den Namen erzeugt hat. Die Wolke zeigt diese Herkunft nicht als Bedienbegriff.

Die Q&A-Kompaktierung (`truncateQaExplanation`, 128 Zeichen, ein Erklärungsmitglied) darf den kurzen Namen nicht durch die Frage ersetzen. Freitext behält die volle Mitgliedsliste. Screenreader lesen den neuen Namen als Wort der Wolke. Neu ist nur die Auswahloption **Thema** in allen fünf Locales. Statussätze bleiben.

## Cache

`buildWordCloudSnapshotCacheKey` unterscheidet `topic-label:off` und `topic-label:<Modellalias>`. Dieselbe Beitragsmenge darf nach dem Einschalten nicht weiter unter dem alten Mitgliedstext aus dem Cache kommen und nach dem Ausschalten nicht unter einem Modellnamen. `WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION` wird angehoben. Session-Purge löscht beide Varianten über das sessiongebundene Prefix. Q&A und Freitext bleiben getrennte Snapshots. Einträge ohne `labelOrigin` gelten als `extractive`.

Ein vorübergehend fehlender Modellname wird nicht als fertiges Ergebnis gecacht. `shouldCacheWordCloudSnapshot` speichert semantische Ergebnisse mit `ready` oder `uncertain` heute für die Encoder-TTL. Ein erster Lauf bei belegtem Slot, Timeout, Abbruch, offenem Circuit oder nicht erreichbarer Runtime würde sonst Mitgliedstexte unter dem Modell-Schlüssel ablegen. **Themen aktualisieren** setzt im Freitext heute kein `refresh`. Der Host käme bis zum TTL oder bis zu einer Korpusänderung nicht an die Modellnamen.

Das Analyseergebnis trägt deshalb `labelSettlement`: `complete`, `transient` oder `disabled`. `complete` bedeutet, jeder Kandidat hat einen angenommenen Namen oder eine endgültige Ablehnung wie Echo, Schema oder Länge. `transient` bedeutet, mindestens ein Kandidat fiel wegen Slot, Zeit, Abbruch, Circuit oder Erreichbarkeit auf den Mitgliedstext zurück. `disabled` bedeutet, die Runtime war aus. Nur `complete` und `disabled` dürfen unter dem jeweiligen Schlüssel gespeichert werden. `transient` wird nicht gespeichert. **Themen aktualisieren** sendet in Q&A und Freitext `refresh: true`.

## Presenter

Q&A überträgt Modus, Metrik, Glättung, Locale und `analysisEntries` schon über `session.setQaWordCloudProjection`. Stufe 2 lässt `label` und `labelOrigin` dort unverändert. Ein kurzer Name darf auf der Bühne nicht wieder zur Mitgliedsfrage werden.

Freitext überträgt den Inhalt noch nicht. `freetextWordCloudTerms` baut lokal eine Phrasenwolke mit `maxNgramLength: 3` und der Beschreibung »Häufige Wörter aus den Antworten.« Die Umsetzung projiziert das Ergebnis, das der Host gerade zeigt, für **Wörter**, **Wörter & Phrasen** und **Thema**.

Diese Projektion kopiert nicht die Leserechte von `session.getQaWordCloudProjection`. Das ist eine `publicProcedure` und kommt mit dem Session-Code aus. `session.getLiveFreetext` ist dagegen `hostProcedure`, weil die Rohantworten nicht öffentlich sind. Die Freitext-Mitgliedsliste bleibt im Host-Ergebnis vollständig. Der Presenter liest öffentlich nur ein gekürztes Bühnen-DTO: Modus, Glättung, Locale, sichtbare Labels, Gewichte und die Restzahl. Vollständige Antworttexte und `members` stehen dort nicht. Ein Session-Code allein darf sie nicht lesen.

Beide Presenter-Flächen zeichnen den sichtbaren Inhalt mit dem vorhandenen `outputOnly`: Schrift 30–80 px, höchstens 24 Begriffe, unter 30 px nur in der Restzahl, Wörter ohne Schalter. Der Konfidenzfilter bleibt am Host. Ein zweiter Encoder- oder Modellaufruf entsteht nicht.

## Phasen

### 1. Auftrag und Annahme

In `openWeightLlmClient` die Prompt-Version nur für `topic_label` setzen. Länge, Echo und Byte-Budget liegen in einem Helfer neben dem Themenpfad.

Tests: die Prompt-Version erscheint nur bei `topic_label`. Echo, Überlänge, fremde ID und `busy` liefern den Mitgliedstext. Fixtures enthalten eine Frage und eine Freitextantwort.

### 2. Anschluss im Snapshot

Der Encoder-Lauf bleibt in der bestehenden Session-Queue mit einem aktiven und einem neuesten wartenden Snapshot. Der Label-Schritt hängt nicht in diesem Job. Er startet erst, nachdem der Encoder-Job das Session-Slot freigegeben hat, und ist je Kanal getrennt. Ist der globale LLM-Slot belegt, entsteht sofort `labelOrigin: extractive` und `labelSettlement: transient`. Der andere Kanal wartet nicht auf das 8-Sekunden-Budget und wird nicht durch einen neueren Snapshot verdrängt, nur weil der erste Kanal Namen holt.

`wordCloudSemanticAnalyze` liefert das Encoder-Ergebnis für `QA` und `FREETEXT`. Ein Kanal ohne den anderen ist kein Zwischenstand. Der anschließende Namen-Schritt gilt für beide.

Tests je Kanal: schwerstes Bündel zuerst; das zweite behält den Mitgliedstext, wenn das Budget danach leer ist; Encoder-Fehler bleibt lexikalischer Fallback; LLM-Fehler lässt `status` auf `ready` oder `uncertain` und `fallbackUsed: false`; `memberIds` unverändert; Runtime aus erzeugt keinen Client-Aufruf. Stimmungssätze, Einwortsynonyme und lange Fachsätze behalten ihre Mitgliedschaft. Ein belegter Slot während eines Q&A-Namens lässt den Freitext-Lauf in derselben Session sofort mit Mitgliedstexten zurückkehren, ohne hinter dem Q&A-Budget zu warten und ohne den Q&A-Lauf zu verdrängen.

### 3. Cache und Vertrag

`labelOrigin`, `labelModelId`, `labelModelVersion` und `labelSettlement` schema-first. `labelOrigin` geht in die Q&A-Kompaktierung, die Q&A-Projektion und das Host-Freitext-Ergebnis. Die öffentliche Freitext-Bühne erhält die Namensfelder ohne `members`. Cache-Schlüssel, Settlement und Analyseversion wie oben. Ein Test zeigt, dass `transient` nicht gecacht wird und `refresh: true` einen vorhandenen Eintrag umgeht.

### 4. Presenter-Inhalt

Freitext erhält die gekürzte öffentliche Bühnenprojektion. Q&A gibt die neuen Namensfelder mit. Beide Flächen behalten `outputOnly`.

Tests: bei aktivierter Host-Ansicht baut der Presenter die Freitext-Wolke nicht mehr aus den Rohantworten. Schrift 30–80 px, Obergrenze 24 und Schwelle 30 px bleiben. Der kurze Name übersteht die Q&A-Kompaktierung und die Projektion. Ein Aufruf nur mit Session-Code liefert keine vollständigen Freitextantworten.

### 5. Ansicht prüfen

Frontend-Test: kürzeres `label` als der Mitgliedstext, Mitgliedstext bleibt im Eintrag, »Zusammengefasst als« erscheint nicht.

Danach im Browser Host und Presenter für beide Wolken: Wörter, Phrasen und Thema, mit und ohne Modellname, Tooltip, veralteter Stand nach einer neuen Frage oder Antwort. Die Auswahloption lautet **Thema**, nicht **Themen**. Auf der Bühne stehen die Host-Namen in der Bühnengröße, ohne die Host-Schalter.

Dieselbe Prüfung misst am Markenzeichen: eine Person, die Mentimeter kennt, versteht die Wolke auf einen Blick. Die vier Ansichten Q&A und Freitext, jeweils Host und Presenter, heißen gleich, schalten gleich und zeigen Begriffe statt ganzer Sätze. Ein ausgefallener Modellname lässt die Wolke stehen. Kein Bedienbegriff nennt Encoder, Embedding, Clustering oder LLM.

### 6. Doku nach der Umsetzung

[word-cloud-semantic.md](../features/word-cloud-semantic.md) beschreibt den gemeinsamen Namen und die Presenter-Projektion bei bleibender Bühnenoptimierung. [open-weight-llm-runtime.md](../features/open-weight-llm-runtime.md) führt beide Host-Kanäle als einen Consumer. Der Backlog nennt Stufe 2 als angeschlossen und produktiv weiter aus. Kein Produktivflag wird angeschaltet.

## Später

Qualitätsrubrik auf dem DE/EN-Seed, einschließlich der Freitext-Familien, und die Messung auf der 8-vCPU-Box bleiben die Freigabestufe der Voranalyse. Dieser Plan macht die Namen austauschbar und den Presenter-Inhalt deckungsgleich. Er belegt nicht, dass die Themenzeilen für den Produktivdefault gut genug sind.

Ein vom Presenter gestarteter Analysejob bleibt außerhalb.
