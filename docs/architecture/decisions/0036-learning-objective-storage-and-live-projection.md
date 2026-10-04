<!-- markdownlint-disable MD013 -->

# ADR-0036: Lernziel-Datenhaltung und getrennte Live-Projektion

**Status:** Accepted
**Datum:** 2026-10-03
**Entscheider:** Projektteam (Issue #456, Slice 1)
**Letzter Repo-Abgleich:** 2026-10-04 (Issue #456, Slice-4-Implementierung)

## Kontext

Issue [#456](https://github.com/kqc-real/arsnova.eu/issues/456) ergänzt den Moderationskontext um Lernziele. Ein Ziel kann von einer Lehrperson manuell formuliert oder in einem eigenen Vorbereitungsauftrag aus Quizaufgaben, Antwortmöglichkeiten, Musterlösungen und später gegebenenfalls Erläuterungen abgeleitet werden. Der Live-Moderationsauftrag darf dagegen keine noch nicht freigegebenen Lösungen oder vollständigen Lösungsschlüssel erhalten.

Vor Slice 4 besaß der abgeglichene Repository-Stand noch keine Lernziel-Datenhaltung:

- Die dauerhafte Quiz-Sammlung ist nach [ADR-0004](0004-use-yjs-for-local-first-storage.md) local-first. `QuizDocument` liegt im Browser, wird über Yjs/IndexedDB und lokale Spiegel synchronisiert und beim Live-Start als zeitlich begrenzte Serverkopie hochgeladen.
- Der aktuelle Yjs-Root `quiz-library` hält die Quizliste als normalisierten JSON-String unter `quizzes`. Ältere Clients lesen, whitelisten und schreiben diesen Gesamtwert zurück. Neue Felder direkt im `QuizDocument` könnten deshalb im Mischbetrieb verloren gehen. Ein getrennter Root-Key wird bereits für `home-presets` verwendet und zeigt das kompatible Erweiterungsmuster.
- Das aktuelle Quiz-Exportformat hat `exportVersion: 1`, akzeptiert aber technisch jede ganzzahlige Version ab 1 und strippt unbekannte Felder. Export und Live-Upload übertragen Fragetexte und Lösungsdaten, aber keine stabilen lokalen Fragekennungen und keine Lernziele. Import, Duplizieren und Serverupload erzeugen neue Kennungen.
- Eine Live-Session besitzt einen eigenen, serverautoritativen Lebenszyklus. Sessioninhalte werden nach dem Nachbereitungsfenster zusammen mit der Session gelöscht; ein Legal Hold verzögert nur die technische Löschung.
- Reine Q&A-Sessions haben kein Quiz. Sie müssen dennoch manuelle Lernziele erlauben, ohne eine leere Quizkopie oder eine dauerhafte Serverbibliothek zu erfinden.
- Die Server-Quizkopie enthält aus funktionalen Gründen richtige Antwortmarkierungen. Dass diese Daten serverseitig vorhanden sind, erteilt dem Live-Kontext jedoch keine Freigabe, sie zu verwenden.

Ohne eine verbindliche Entscheidung drohen drei Fehlerklassen: Lernziele gehen bei Yjs-Sync oder Export/Import verloren, lokale und live verwendete Ziele überschreiben sich unkontrolliert, oder lösungshaltige Vorbereitungsdaten gelangen in den deutlich breiter verwendeten Live-Moderationskontext.

## Entscheidung

### 1. Zwei kanonische Speicherbereiche

Quizgebundene Lernziele gehören fachlich zur local-first Quiz-Sammlung. Solange ältere Clients denselben Sync-Raum verwenden können, werden sie jedoch **nicht** als neue Felder in den bestehenden serialisierten `quizzes`-Blob eingebettet. Ihre kanonische Bearbeitungsversion lebt in einem eigenen versionierten Lernziel-Sidecar, der lokale Quizkennungen zu Lernzielen und stabilen Aufgabenreferenzen abbildet.

Der Sidecar verwendet im selben Yjs-Dokument eine eigene Root-Map `quiz-learning-objectives-v1`, getrennt von `yDoc.getMap('quiz-library')`. Der Eintrag zur lokalen `quizId` enthält den Marker `oplog-v1`; die eigentlichen Änderungen liegen in der stabil benannten Yjs-Map `quiz-learning-objectives-v1-oplog:<quizId>`. Deren Schlüssel sind opake Operations-UUIDs, deren strikt validierte JSON-Werte je ein einzelnes Lernziel kausal ändern oder löschen. Erwartete und resultierende Zielrevision, Bundle-Revision und explizite Eltern-Operationen bilden daraus pro Lernziel einen gerichteten azyklischen Verlauf. Der raumbezogene lokale Spiegel `quiz-learning-objectives-v1:<roomId>` enthält weiterhin materialisierte `QuizLearningObjectiveBundleV1`-Werte mit `schemaVersion`, `quizId`, `revision` und begrenzten `objectives`; ein globaler Legacy-Mirror wird nicht eingeführt.

Unabhängige Änderungen an verschiedenen Lernzielen werden dadurch zusammengeführt, statt einen vollständigen Bundle-String nach Last-Writer-Wins zu überschreiben. Gleichzeitige, kausal nicht geordnete Änderungen desselben Lernziels bleiben als mehrere Köpfe sichtbar und verlangen eine ausdrückliche Hostentscheidung; Zeitstempel oder eine vorgestellte Zukunftsuhr verleihen keiner Fassung Autorität. Die Entscheidung schreibt eine neue Operation mit allen Konfliktköpfen als Eltern. Löschungen bleiben als Tombstones erhalten, damit ein verspäteter Offline-Client ein Ziel nicht wiederbelebt. Bereits eindeutig aufgelöste Verläufe werden begrenzt ausgedünnt; zusätzlich schützt eine harte Operationsgrenze den bestehenden Yjs-Rahmen.

Die bestehende Map `quiz-library` trägt zusätzlich den Initialisierungsmarker `quiz-learning-objectives-v1-initialized`. Er unterscheidet einen neuen Sync-Raum, der einmalig aus dem lokalen Spiegel befüllt werden darf, von einem autoritativ synchronisierten, bewusst leeren Sidecar. Ohne diese Unterscheidung könnte ein alter Offline-Spiegel entfernte Ziele nach einem Reconnect wieder einfügen. Fehlerhafte einzelne Map-Werte werden nicht als Löschung interpretiert; der letzte lokal validierte Wert bleibt erhalten, bis ein gültiger synchronisierter Wert oder eine ausdrückliche Entfernung vorliegt.

Ein Client, der diese Root-Map nicht versteht, darf sie nicht schreiben oder löschen. Damit können ältere Clients weiterhin den `quizzes`-Blob aktualisieren, ohne Lernziele durch ihre Whitelist-Normalisierung zu entfernen. Ein vor Einführung des Oplogs geschriebener vollständiger Bundle-Wert wird beim ersten Lesen transaktional in einzelne Operationen übersetzt. Auch ein verspäteter Bundle-Write eines noch verbundenen Legacy-Clients wird als kausale Änderung übernommen; er darf weder parallel neu angelegte Ziele still löschen noch konkurrierende Fassungen verbergen. Neue Clients aktualisieren zusammengehörige Quiz- und Zieländerungen in einer Yjs-Transaktion. Sie bereinigen Sidecar-Einträge erst, wenn die zugehörige Quizlöschung im zusammengeführten Yjs-Zustand feststeht; ein kurzzeitig unbekanntes Quiz bei Reconnect genügt nicht. Zielzahl, Textlänge, Referenzzahl und Operationshistorie bleiben begrenzt, damit der bestehende Yjs-Dokument- und Relay-Rahmen nicht umgangen wird.

Der Sidecar nimmt fachlich an Yjs-Sync, Duplizieren, Export und Import teil. Die getrennte physische Ablage ist eine Legacy-Schutzmaßnahme und keine zweite unabhängige Lernzielquelle. Es entsteht keine dauerhafte zentrale Quizbibliothek.

Beim Live-Start wird eine kontrollierte Kopie der für diese Session bestimmten Lernziele in einen **sessionautoritativen Lernzielbestand** übertragen. Dieser Bestand gehört zur Session, besitzt eigene Revisionen und wird nach dem Session-Lebenszyklus gelöscht. Änderungen an der lokalen Bibliothek verändern eine laufende Session nicht still; eine spätere Aktualisierungsfunktion muss einen ausdrücklichen, konfliktgeprüften Host-Vorgang verwenden.

Manuelle Ziele einer reinen Q&A-Session leben ausschließlich im sessionautoritativen Bestand. Sie werden nicht in eine künstliche lokale Quizdatei zurückgeschrieben.

Slice 4 setzt diese Besitzverhältnisse mit `QuizLearningObjectiveBundleV1` im Browser und den Prisma-Modellen `QuizLearningObjectiveBundle` beziehungsweise `SessionLearningObjective` um:

| Bereich                                   | Autoritative Quelle                                          | Lebensdauer                                                     |
| ----------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| Quizgebundenes Ziel in der Vorbereitung   | versionierter local-first Lernziel-Sidecar der Quiz-Sammlung | bis zum Löschen des Quiz beziehungsweise des lokalen Speichers  |
| Quizgebundenes Ziel in einer Live-Session | sessionautoritative Serverkopie                              | Session plus zulässiges Nachbereitungsfenster                   |
| Ziel einer reinen Q&A-Session             | sessionautoritativer Serverbestand                           | Session plus zulässiges Nachbereitungsfenster                   |
| Modellvorschlag vor Hostentscheidung      | jeweiliger Vorbereitungsbereich, ausdrücklich als Vorschlag  | bis Bestätigung, Verwerfen, Löschen oder geregelter Bereinigung |

### 2. Stabile fachliche Referenzen statt Datenbankkennungen

Die bereits vorhandene lokale `QuizQuestion.id` ist innerhalb der Quiz-Sammlung die stabile, opake Quellidentität. Der Sidecar referenziert sie direkt; ein zweites paralleles ID-Feld im In-Memory-Quizmodell wird nicht eingeführt. Export Version 2 und Live-Upload nennen denselben Wert an ihrer Vertrauensgrenze `sourceQuestionId`. Die Serverkopie darf weiterhin eine eigene Prisma-Primärkennung verwenden; sie hält die Zuordnung zur `sourceQuestionId` getrennt fest. `historyScopeId` wird dafür nicht wiederverwendet: Sie ist eine Quiz-Historien-/Zugriffscapability, keine Modellquelle und keine Identität einer einzelnen Frage.

Lernziele referenzieren `sourceQuestionId`-Werte, niemals zufällig beim Upload neu erzeugte Datenbank-IDs. Die Kennung allein trägt keine Lösung und ist keine globale Teilnehmerkennung. Import und bewusstes Duplizieren erzeugen wie heute eine neue lokale Quizkopie; dabei erzeugt der neue Client neue Quiz-, Frage-, Antwort- und Zielkennungen und remappt alle internen Lernzielreferenzen atomar. Das Exportpaket bewahrt die Herkunftskennungen, die importierte Kopie aber nicht deren globale Identität. Innerhalb eines Quiz dürfen Referenzen weder doppelt noch fremd oder verwaist sein.

Das Quiz-Exportformat wird für Lernziele und stabile Fragebezüge auf Version 2 erweitert. Der Parser wird zu einer exakten, strikt validierten Versionsunion mit `z.literal(1)` und `z.literal(2)`: Version 1 bleibt importierbar und bedeutet ausdrücklich »keine gespeicherten Lernziele«; Version 2 enthält Ziele, Herkunft und das Referenzmapping. Unbekannte neuere Versionen werden abgewiesen, statt durch den heutigen `min(1)`-/Strip-Vertrag scheinbar erfolgreich und mit Datenverlust importiert zu werden. Alte lokale Fragen besitzen bereits `QuizQuestion.id`; es werden weder Identitäten noch Ziele aus Fragetexten abgeleitet.

### 3. Herkunft, Prüfung und Konkurrenz sind getrennte Dimensionen

Ein Lernziel speichert mindestens:

- eine stabile Zielkennung und kompakten Zieltext;
- den Geltungsbereich »gesamtes Quiz« oder eine **explizite** Abschnittszuordnung;
- optionale, auflösbare `sourceQuestionId`-Referenzen;
- die Herkunft `manual` oder `model-derived` einschließlich Ableitungs-/Modellversion bei Modellvorschlägen;
- einen getrennten Prüfstatus `draft`, `confirmed` oder `needs-review` entsprechend dem Live-Vertrag;
- Zielrevision, Quellrevision beziehungsweise einen nur intern verwendeten Quelldigest und Zeitpunkte, die für Optimistic Concurrency und Veraltung nötig sind.

Herkunft und Bestätigung werden nicht in einem einzigen Label vermischt. Ein modellgestützter Vorschlag bleibt auch nach der Bestätigung in seiner Herkunft nachvollziehbar; die Bestätigung ist eine Entscheidung der Lehrperson. Ein manuell eingegebenes Ziel ist keine Modellableitung.

Modellabgeleitete Ziele entstehen ausschließlich aus Quizfragen des getrennten, lösungshaltigen Vorbereitungsauftrags. Ihre `derivedFromSourceIds` referenzieren daher nur `quiz-question`; verwendet ein solches Ziel den `tasks`-Scope, gilt dieselbe Einschränkung für `taskSourceIds`. Ein `session`-Scope ist ausgeschlossen. Alle Herleitungsfragen gehören demselben Quizscope an; bei `quiz` müssen sie dessen `quizScopeId`, bei `section` zusätzlich dessen `sectionScopeId` treffen, bei `tasks` innerhalb von `taskSourceIds` liegen. Manuelle Ziele dürfen im Live-Vertrag dagegen zulässige Q&A- oder Quizfragen referenzieren. Eine reine Q&A-Session erzeugt keine modellabgeleitete Herkunft und bleibt auf manuelle Ziele beschränkt.

Der lokale Persistenzvertrag unterstützt zunächst `quiz-wide` und `question-set` mit mindestens einer auflösbaren Aufgabenreferenz. Der Shared-/Live-Vertrag darf einen `section`-Scope nur verwenden, wenn eine ausdrücklich gespeicherte stabile Abschnittsidentität vorliegt, die zusammen mit dem `quizScopeId` als `sectionScopeId` projiziert werden kann. Der aktuelle Repo-Stand besitzt keine solche Abschnittsentität; aus Reihenfolge, `currentQuestion` oder aktiver Phase wird daher kein »aktueller Lernabschnitt« erfunden. Für Q&A-only ist der Scope `session` zulässig.

Hostbearbeitungen verwenden eine erwartete globale Lernkontextrevision und bei Änderungen oder Löschungen zusätzlich die erwartete Zielrevision. Lokale Bearbeitungen halten die beim Öffnen des Formulars geladene Zielrevision fest. Eine erneute Ableitung, ein Modellwechsel, ein zweiter Tab oder ein verspäteter Client darf dadurch eine neuere bestätigte Bearbeitung nicht überschreiben. Änderungen an referenzierten Aufgabentexten, Antwortmöglichkeiten, richtigen Lösungen oder Erläuterungen markieren betroffene modellgestützte Ziele als `needs-review`; sie löschen oder ersetzen bestätigte Texte nicht automatisch. Das Entfernen einer im Scope referenzierten Aufgabe markiert auch ein manuelles Ziel als prüfbedürftig. Ziele mit unaufgelösten Referenzen dürfen nicht erneut als bestätigt gespeichert werden.

Der interne Quelldigest umfasst die inhaltlich relevante Aufgabensemantik, darunter Fragetyp, Text, Antworten und Korrektheitsmarkierungen sowie typabhängige Musterlösungen, Toleranzen, Zuordnungen, Reihenfolgen oder Kategorien; spätere Erläuterungen werden einbezogen, sobald sie persistiert werden. Timer, Schwierigkeit und Reihenfolge gehören nur bei ausdrücklicher fachlicher Begründung hinein. Der Digest dient ausschließlich der Invalidierung. Er wird weder als Quellen-ID noch als Modellinhalt verwendet.

### 4. Upload, Serverprojektion und Revision

Der Upload transportiert `sourceQuestionId` über ein eigenes Quiz-Upload-Fragenschema. `AddQuestionInputSchema` wird nicht global mit einer optionalen Identität verwässert. Nur aktiv hochgeladene Fragen sind im Serverquiz vorhanden; Ziele mit deaktivierten oder ausgelassenen Referenzen werden vor dem Upload nachvollziehbar eingeschränkt oder ausgelassen. Fremde, doppelte und verwaiste Referenzen weist das Backend ab.

Die Prisma-Frage erhält für rollende Kompatibilität eine nullable `sourceQuestionId` mit Eindeutigkeit innerhalb des Serverquiz. Bestehende Quizkopien bleiben `NULL`; es findet kein Text-Backfill statt. Quizgebundene Ziele werden zusammen mit der temporären Server-Quizkopie strikt validiert gespeichert und beim Erzeugen beziehungsweise kontrollierten Anhängen einer Session in derselben Transaktion auf einen sessionautoritativen Lernzielbestand projiziert.

Ab dieser Projektion liest der Live-Kontext ausschließlich den Sessionbestand. Modellseitige Quellen verwenden sichere Serverreferenzen wie `quiz-question:${Question.id}` und `learning-objective:${SessionLearningObjective.id}`, niemals lokale IDs oder `historyScopeId`. Davon getrennte `quizScopeId`- und `sectionScopeId`-Werte sind opake, präfixvalidierte Bereichsschlüssel: Sie werden nicht im Quellenregister dereferenziert und nicht mit `historyScopeId` gleichgesetzt. Q&A-only-Ziele werden direkt als sessionmanuelle Ziele gespeichert; ein Fake-Quiz entsteht nicht.

Die Session erhält eine eigene monotone `learningContextRevision`; `learningContextConfigured` unterscheidet einen noch nie eingerichteten Bestand von einer ausdrücklich leeren Konfiguration. `sessionLifecycleRevision` behält seine bestehende Lifecycle-/Kanalbedeutung. Jede Änderung an Zieltext, Scope, Herkunfts-/Prüfstatus oder Quellenbezug sowie ein kontrolliertes Quiz-Anhängen beziehungsweise -Ersetzen erhöht die Lernkontextrevision transaktional und invalidiert davon abhängige Hashes und Caches.

Beim vorhandenen `attachQuizToSession` ersetzt ein autorisierter, zeilengesperrter Vorgang nur unveränderte quizprojizierte Ziele. Sessionmanuelle beziehungsweise Q&A-only-Ziele und in der Session bearbeitete `session-override`-Ziele bleiben erhalten. Aufgabenbezüge werden ausschließlich über die stabile Upload-Zuordnung auf die neue Serverkopie umgesetzt; fehlende Quellen bleiben als unaufgelöste Referenzen mit Prüfbedarf sichtbar. Erwartete Lernkontextrevision und `learningContextOperationId` bilden ein gemeinsames CAS-/Idempotenzpaar. Für rollende Kompatibilität darf ein alter Client beide Felder nur beim noch unkonfigurierten Revisionsstand 0 auslassen; die additive Antwort behält `quiz`, `qa` und `quickFeedback` auf der bisherigen obersten Ebene.

`getLearningObjectives` und `saveLearningObjectives` sind hostgeschützte tRPC-Verträge. Der lesbare Snapshot enthält nur Zieltext, Status, Provenienz, Scope, Revisionen und einen begrenzten Katalog zulässiger Server-Quizaufgaben `{ kind, questionId, text, order }`. Lokale IDs, Quelldigests, Antwortoptionen und Korrektheitsfelder sind darin strukturell ausgeschlossen. Aktive Sessions sind beschreibbar; nach dem fachlichen Sessionende bleibt der Bestand höchstens im bestehenden Host-Nachbereitungsfenster lesbar. Ein Legal Hold verlängert diese fachliche Zugriffsdauer nicht.

### 5. Lösungshaltiger Vorbereitungsauftrag und Live-Kontext sind verschiedene Verträge

Der Lernziel-Vorbereitungsauftrag ist ein eigener, bewusst vom autorisierten Host gestarteter Auftrag. Nur dieser Vertrag darf die dafür freigegebenen Quizaufgaben einschließlich Antwortmöglichkeiten, richtigen Lösungen, Musterlösungen und Erläuterungen an die private Runtime übermitteln. Der Auftrag ist asynchron, abbrechbar, budgetiert und verwendet keinen SaaS-Fallback. Rohauftrag, vollständiger Prompt und Lösungstexte werden nicht standardmäßig protokolliert oder dauerhaft als Teil des Lernziels gespeichert.

Der Live-Moderationskontext verwendet eine getrennte Projektion. Er darf enthalten:

- den kompakten Zieltext;
- Herkunft, Prüfstatus, Geltungsbereich und Veraltungsstatus;
- zulässige Ziel- und Aufgabenreferenzen;
- zulässige, bereits freigegebene Ergebnisaggregate.

Er darf **nicht** allein wegen eines Lernzielbezugs Antwortmöglichkeiten, `isCorrect`, Musterlösungen, Toleranzen, korrekte Zuordnungen, Reihenfolgen oder Kategorien, interne Quelldigests, Lösungsschlüssel, spätere Erläuterungen oder noch nicht freigegebene Ergebnisse übernehmen. Auch ein Hash über niedrig-entropische Lösungen ist kein sicherer Live-Inhalt und bringt dem Modell keinen fachlichen Nutzen. Das gilt ebenso, wenn dieselben Felder in der serverseitigen Quizkopie vorhanden sind. Zieltext und Modellvorschlag werden vor der Live-Nutzung als untrusted content behandelt; sie können die Instruktionen, Berechtigungen oder Quellenauswahl nicht verändern.

Beide Aufträge erhalten getrennte, strikt validierte Zod-Verträge, getrennte Projektionen und getrennte Berechtigungsprüfungen. Negativtests weisen jedes lösungshaltige oder interne Zusatzfeld im Live-DTO ab. Ein Modusfeld an einem gemeinsamen lösungshaltigen Payload genügt nicht. Die gemeinsame Runtime aus ADR-0035 darf dieselbe technische Inferenzkapazität bereitstellen, vereinigt aber nicht die fachlichen Datenverträge.

### 6. Lebenszyklus und Veraltung

Der folgende Lebenszyklus ist für die späteren Implementierungsslices verbindlich:

1. Ein manuelles Ziel oder ein Modellvorschlag entsteht im versionierten Lernziel-Sidecar der Quizvorbereitung; bei Q&A-only entsteht ein manuelles Ziel direkt in der Session.
2. Modellvorschläge sind zunächst unverbindlich. Die Lehrperson kann sie bearbeiten, bestätigen, verwerfen oder löschen.
3. Der Live-Start kopiert nur die vorgesehenen Ziele und auflösbaren Referenzen in den sessionautoritativen Bestand. Die Kopie erhält eine eigene Revision.
4. Relevante Quelländerungen setzen `needs-review`. Fehlende oder gelöschte Quellen bleiben als Einschränkung nachvollziehbar oder entfernen den unzulässigen Bezug; sie werden nicht durch eine andere Frage ersetzt.
5. Erneute Ableitung erzeugt neue Vorschläge beziehungsweise eine kontrollierte neue Vorschlagsrevision. Bestätigte Hosttexte bleiben bestehen.
6. Die Sessionkopie folgt dem bestehenden Session-, Nachbereitungs- und Purge-Vertrag. Nach dem regulären Ende ist sie im bestehenden 14-tägigen Nachbereitungsfenster nur im bereits erlaubten Hostumfang lesbar; neue Lernzielschreibvorgänge bleiben geschlossen. Ein Legal Hold verschiebt ausschließlich die technische Löschung, verlängert keine fachliche Nutzung und synchronisiert nichts in die lokale Bibliothek zurück.

Der lokale Sidecar wird mit der lokalen Quiz- beziehungsweise Raumlöschung bereinigt. Hochgeladene, noch nicht an eine Session gebundene Zielstagingdaten kaskadieren mit dem bestehenden Orphan-Quiz-Cleanup. Sessionprojektion und Q&A-only-Ziele kaskadieren mit der Session. Eine noch offene Q&A-Follow-up-Phase ändert diese Eigentümerschaft nicht; Schreibrechte richten sich weiterhin nach serverseitig geprüftem Session- und Hostzustand.

Ohne Lernziele, bei veralteten Zielen oder bei nicht verfügbarer Runtime bleiben Regelkompass und bestehende Summary-Fallbacks nutzbar. Eine normale Session verlangt keine Lernziel-Pflichteingabe.

### 7. Einführung und Legacy-Kompatibilität

Die Umsetzung erfolgt additiv und schema-first:

1. Slice 1 definiert Kontext-, Quellen- und Zustandsverträge sowie diese Entscheidung.
2. Slice 4 ergänzt den versionierten Yjs-/Local-Mirror-Sidecar samt Initialisierungsmarker, den strikt versionierten Export/Import, stabile Referenzen, Live-Upload, sessionautoritative Speicherung, Host-UX und Konfliktbehandlung. Datenbankänderungen sind additiv; `Question.sourceQuestionId` bleibt für Legacykopien nullable, die neue Lernkontextrevision startet bei 0. Alte `quizzes`-Snapshots, v1-Exporte und laufende Sessions ohne Lernziele bleiben gültig. Der administrative Session-Quizexport bleibt ausdrücklich V1, solange er keine vollständige V2-Provenienz liefern kann.
3. Erst Slice 5 darf nach technischer Abnahme der Runtime den lösungshaltigen Ableitungsauftrag verdrahten.
4. Der Live-Kontext übernimmt Ziele erst über den späteren autorisierten Builder. Ein alter Summary-Adapter erhält weiterhin ausschließlich seinen bisherigen Textauftrag; neue Felder werden ihm nicht still angehängt.

Migrationen erzeugen keine Lernziele aus vorhandenen Quiztexten. »Nicht vorhanden« ist ein eigener Zustand und wird weder als leere bestätigte Zielliste noch als fehlgeschlagene Ableitung umgedeutet.

Der bestehende Quiz-Historiennachweis wird nicht still verändert. `sourceQuestionId` und Lernziele gehen nur nach einer ausdrücklichen Versionierungsentscheidung in dessen kanonisches Hashmaterial ein; andernfalls würden alte Proofs und Historienabgleiche ihre Bedeutung ändern. Ebenso ist rückwirkend nicht zu verhindern, dass bereits ausgelieferte v1-Clients eine v2-Datei wegen des heutigen `min(1)`-/Strip-Verhaltens falsch akzeptieren. V2-Exporte müssen deshalb für alte Builds erkennbar gewarnt beziehungsweise von ihnen ferngehalten werden; neue Builds lehnen unbekannte Versionen strikt ab.

## Konsequenzen

### Positiv

- Lernziele folgen dem bestehenden Local-first- und Session-Lebenszyklus statt eine zweite Quizbibliothek zu eröffnen; der getrennte Sidecar schützt sie vor alten Blob-Whitelists.
- Reine Q&A-Sessions bleiben ohne Quiz funktionsfähig.
- Stabile fachliche Referenzen überleben Sync und Live-Upload; Export/Import und Duplizieren erhalten die Referenzstruktur durch ein geprüftes atomisches Remapping, ohne Prisma-IDs als externen Vertrag zu verwenden.
- Bestätigte Hostarbeit bleibt bei erneuter Ableitung, Modellwechsel und konkurrierenden Clients erhalten.
- Lösungshaltige Vorbereitungsdaten sind strukturell vom Live-Moderationsauftrag getrennt.
- Legacy-Bestände erhalten einen eindeutigen, nicht erfundenen Zustand.

### Negativ / Risiken

- Sidecar-Normalisierung, Yjs-Root und lokaler Spiegel, Export/Import, Upload, Prisma und Session-Purge müssen in Slice 4 gemeinsam erweitert werden.
- Alte Clients können Lernziele nicht anzeigen oder bearbeiten. Die Root-Key-Trennung verhindert Datenverlust, ersetzt aber keine Versions-/Capability-Anzeige im Mischbetrieb.
- Stabile Quellkennungen benötigen einen kontrollierten Transport- und Remappingvertrag für Export, Import, Duplizieren und Upload.
- Die Live-Kopie kann bewusst vom später geänderten lokalen Quiz abweichen; Aktualisierung braucht daher eine sichtbare Konfliktentscheidung.
- Ein kompakter Lernzieltext kann selbst unbeabsichtigt Lösungshinweise enthalten. Schema- und Feldtrennung ersetzt deshalb nicht die Hostprüfung und spätere Inhaltsevaluation.
- Die technische Runtime-Trennung verhindert keine semantisch schlechte Ableitung; Qualität und didaktische Wirksamkeit benötigen eigene Nachweise.

## Alternativen (geprüft)

- **Alle Lernziele ausschließlich in PostgreSQL speichern:** verworfen, weil dies für Quizvorbereitung und geräteübergreifenden Yjs-Sync eine dauerhafte zentrale Quizbibliothek schaffen würde.
- **Alle Lernziele ausschließlich im Browser halten:** verworfen, weil Q&A-only-Ziele und ein autoritativer, reloadfähiger Live-Kontext dann keinen konsistenten Sessionbestand hätten.
- **Lernziele direkt als neue `QuizDocument`-Felder im bestehenden `quizzes`-Blob speichern:** verworfen, solange Mischversions-Sync unterstützt wird; alte Clients würden unbekannte Felder bei ihrer Normalisierung entfernen und den Blob zurückschreiben.
- **Ziele an Prisma-`Question.id` binden:** verworfen, weil Export, Import und Live-Upload heute neue IDs erzeugen und lokale Quizdokumente keine Prisma-Identität besitzen.
- **Lösungsdaten zusammen mit Lernzielen im Live-Kontext halten:** verworfen, weil Speicherung und spätere Projektionen die Freigabegrenze leicht umgehen könnten.
- **Bei jeder Summary Lernziele neu ableiten:** verworfen, weil dies Live-Hotpaths, Kosten, Nachvollziehbarkeit und bestätigte Hostbearbeitungen gefährdet.
- **Modellvorschläge beim Modellwechsel ersetzen:** verworfen, weil eine technische Modellversion keine Autorität über bestätigte fachliche Änderungen besitzt.

## Implementierungsstand

Mit #456 Slice 4 sind der Yjs-/Local-Mirror-Sidecar, Datenbankmodelle und Migration, Export/Import V2, Live-Upload und Sessionprojektion, Q&A-only-Ziele sowie die lokale und live-sessiongebundene Host-UI umgesetzt. Quelländerungen und -löschungen, optimistische Konkurrenz, ausdrücklich leere Bestände, Quizersetzung, Reload und das Nachbereitungsfenster besitzen eigene Zustände und Tests.

Nicht umgesetzt bleiben der lösungshaltige Runtime-Ableitungsauftrag aus Slice 5, die Übernahme der Ziele in den vollständigen gepackten Moderationskontext aus Slice 6 sowie Adapter-/Vorschauintegration und Betriebsabnahme aus Slices 7 und 8. Die in Slice 4 gespeicherte modellabgeleitete Provenienz ist Lebenszyklusvorbereitung und kein Nachweis einer vorhandenen oder fachlich abgenommenen Modellableitung.

Die Integrationsgrenzen und der vollständige Slice-Status stehen in [moderation-prompt-context.md](../../features/moderation-prompt-context.md).
