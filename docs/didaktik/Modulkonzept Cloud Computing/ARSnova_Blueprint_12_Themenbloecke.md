<!-- markdownlint-disable MD013 MD060 -->

# ARSnova-Blueprint für 12 Themenblöcke

**Kürzel und Fachkürzungen vorab:** **A11y** bezeichnet Barrierefreiheit (Accessibility), **ADR** einen Architecture Decision Record, **API** eine Programmierschnittstelle, **AWS** Amazon Web Services, **FinOps** Financial Operations, **GCP** Google Cloud Platform, **IAM** Identity and Access Management, **IaC** Infrastructure as Code, **IaaS/PaaS/SaaS** Infrastructure/Platform/Software as a Service, **ID** eine eindeutige Kennung, **JSON** JavaScript Object Notation, **LE** eine 90-minütige Lerneinheit aus zwei **UE**, **MC** Multiple Choice, **ML** maschinelles Lernen, **QA** Qualitätssicherung, **SRE** Site Reliability Engineering, **TB01–TB12** die zwölf stabilen Themenblöcke, **UE** eine 45-minütige Unterrichtseinheit, **UUID** einen technisch erzeugten Universally Unique Identifier und **L01–L10** die zehn Livefragen eines Themenblocks. **6R** bezeichnet Rehost, Replatform, Repurchase, Refactor, Retire und Retain. `AUTO` ist der Enum-Wert für automatische Teamzuweisung.

**Version:** 1.0.0 · **Stand:** 14.09.2026 · **Status:** normative Spezifikation für 120 anspruchsvolle Livefragen

**Kanonischer Paketindex:** [Materialindex](./Materialindex.md) · **Lernzielbezug:** [Lernziel-Alignment-Matrix](./Lernziel_Alignment_Matrix.md) · **Betrieb:** [Lehrenden-Runbook](./Lehrenden_Runbook.md)

## 1. Zweck, Umfang und Einsatz

Die Zielgruppe dieses Moduls besteht ausschließlich aus Bachelorstudierenden der Informatik. ARSnova.eu dient gleichzeitig als Lernwerkzeug und als authentisches Studienobjekt. Die Livefragen aktivieren Vorwissen, machen plausible Fehlvorstellungen in Aggregaten sichtbar, eröffnen Peer-Instruction- und Architekturgespräche und geben unmittelbares formatives Feedback. Sie liefern keine individuelle Leistungsbewertung, keine Prüfungszulassung und keine Grundlage für Forschung oder Publikation.

Das Paket umfasst genau zwölf Importdateien mit je zehn Fragen, zusammen also 120 Fragen. Jede Datei enthält jeden der zehn unterstützten Fragetypen genau einmal. Die JSON-Dateien sind die autoritative Quelle für Wortlaut, Reihenfolge, Lösung und typbezogene Struktur; dieser Blueprint ist die normative Quelle für Umfang, Qualitätsregeln und Einsatz.

| Themenblock | Datei                                                                | Verbindlicher fachlicher Schwerpunkt                                     |
| ----------: | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
|        TB01 | [ARSnova_Themenblock_01.json](./ARSnova/ARSnova_Themenblock_01.json) | Grundlagen, Cloud- und Servicemodelle, Shared Responsibility             |
|        TB02 | [ARSnova_Themenblock_02.json](./ARSnova/ARSnova_Themenblock_02.json) | Virtualisierung, Container, IaC und Netzwerk                             |
|        TB03 | [ARSnova_Themenblock_03.json](./ARSnova/ARSnova_Themenblock_03.json) | arsnova.eu-Deployment, Härtung sowie Zustands- und Vertrauensgrenzen     |
|        TB04 | [ARSnova_Themenblock_04.json](./ARSnova/ARSnova_Themenblock_04.json) | Serverless Computing, Eignung, Grenzen und Betriebsfolgen                |
|        TB05 | [ARSnova_Themenblock_05.json](./ARSnova/ARSnova_Themenblock_05.json) | GCP, AWS und Azure im Capability-, Verantwortungs- und Risikovergleich   |
|        TB06 | [ARSnova_Themenblock_06.json](./ARSnova/ARSnova_Themenblock_06.json) | Daten, ML, Datenfluss, private Inferenz und Managed-Angebote             |
|        TB07 | [ARSnova_Themenblock_07.json](./ARSnova/ARSnova_Themenblock_07.json) | Storage, Datenbanken, Backup, Restore und Recovery                       |
|        TB08 | [ARSnova_Themenblock_08.json](./ARSnova/ARSnova_Themenblock_08.json) | Elastizität, Skalierung, Performance und verteilte Systeme               |
|        TB09 | [ARSnova_Themenblock_09.json](./ARSnova/ARSnova_Themenblock_09.json) | IAM, Security, Observability, SRE und Resilienz                          |
|        TB10 | [ARSnova_Themenblock_10.json](./ARSnova/ARSnova_Themenblock_10.json) | FinOps, Nachhaltigkeit und 6R                                            |
|        TB11 | [ARSnova_Themenblock_11.json](./ARSnova/ARSnova_Themenblock_11.json) | Evidenz, ADR, Quellenkritik und Referatsargumentation                    |
|        TB12 | [ARSnova_Themenblock_12.json](./ARSnova/ARSnova_Themenblock_12.json) | Kumulative Synthese und Verteidigung einer begrenzten Cloud-Entscheidung |
|             | **12 Dateien mit 120 Fragen**                                        | **12 Themenblöcke mit insgesamt 36 UE**                                  |

In jedem Themenblock bilden UE 1 und UE 2 die LE. ARSnova-Fragen werden darin gezielt als Einstieg, Diagnose, Entscheidungsimpuls, Peer-Instruction-Frage oder Abschlusscheck eingesetzt. UE 3 bleibt vollständig dem separaten MC-Test vorbehalten: drei Minuten Übergang, 32 Minuten Bearbeitung und zehn Minuten aggregierte Ergebnis- und Lösungsbesprechung. Ein Livequiz erweitert dieses Zeitbudget nicht. Das Blueprint legt keine kalendarische oder modale Zuordnung der Themenblöcke fest.

## 2. Importformat und redaktionelle Zuordnung

### 2.1 Verbindliche Hülle

Jede Themenblockdatei ist ein nativer ARSnova.eu-Export mit:

- `exportVersion=1`,
- einem nicht leeren `exportedAt`-Zeitstempel,
- genau einem `quiz`-Objekt mit Konfiguration und `questions`,
- genau zehn aktiven Fragen mit lückenloser nullbasierter Reihenfolge `order=0` bis `order=9`.

Die redaktionelle Kennung wird nicht als zusätzliches JSON-Feld gespeichert. Sie wird aus Dateiname und Arrayposition abgeleitet: `ARSnova_Themenblock_03.json`, Position 4 beziehungsweise `order=3`, ergibt `ARS-TB03-L04`. Technische UUIDs werden beim Import und beim späteren Live-Upload neu erzeugt und sind keine stabilen fachlichen Kennungen.

Nicht unterstützte Metadaten, Lösungskommentare, Lernzielcodes oder redaktionelle IDs werden nicht in Fragen- oder Antwortobjekte eingefügt. Lernzielzuordnung, Review und Freigabe stehen in der [Lernziel-Alignment-Matrix](./Lernziel_Alignment_Matrix.md) und im [QA-Freigabeprotokoll](./QA_Freigabeprotokoll.md).

### 2.2 Exakte Typabdeckung

Jede Themenblockdatei enthält diese Typen jeweils genau einmal:

`MULTIPLE_CHOICE`, `SINGLE_CHOICE`, `FREETEXT`, `SHORT_TEXT`, `SURVEY`, `RATING`, `NUMERIC_ESTIMATE`, `MATCHING`, `ORDERING`, `CATEGORIZATION`.

| Fragetyp           | Verbindliche Ausprägung                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `SINGLE_CHOICE`    | Genau vier eindeutige, formal parallele Optionen; genau eine Option ist richtig.                                                      |
| `MULTIPLE_CHOICE`  | Genau vier eindeutige, formal parallele Optionen; mindestens zwei sind richtig und mindestens eine ist falsch.                        |
| `FREETEXT`         | Präziser Transfer- oder Begründungsimpuls; `answers=[]`; keine automatische Richtigkeitsquote.                                        |
| `SHORT_TEXT`       | Kurzer Fachbegriff oder eine eng begrenzte Antwort; alle expliziten gültigen Varianten stehen als richtige Antworten im JSON.         |
| `SURVEY`           | Genau vier wertneutrale, überschneidungsarme Optionen; alle tragen `isCorrect=false`; keine Musterlösung.                             |
| `RATING`           | Skala mit eindeutigen gegensätzlichen Endlabels, in diesem Paket von 1 bis 5; `answers=[]`; keine richtige Skalenstufe.               |
| `NUMERIC_ESTIMATE` | `answers=[]`; Referenzwert, Eingabeart, Bereich und relatives Toleranzband oder absolutes Intervall sind vollständig angegeben.       |
| `MATCHING`         | `answers=[]`; zwei bis sechs schemafähige, in diesem Paket vier bis sechs eindeutige Paare; die rechte Seite wird gemischt.           |
| `ORDERING`         | `answers=[]`; drei bis acht eindeutige Schritte in fachlich richtiger Arrayreihenfolge; keine zwei Schritte teilen dieselbe Position. |
| `CATEGORIZATION`   | `answers=[]`; zwei bis vier eindeutige Kategorien und vier bis zwölf eindeutig zuordenbare Elemente; Ziel-IDs müssen existieren.      |

Struktur-IDs innerhalb von Matching, Ordering und Categorization sind je Frage eindeutig und dienen nur der technischen Zuordnung. Gewöhnliche Antwortoptionen werden ausschließlich bei Single Choice, Multiple Choice, Survey und Short Text verwendet.

## 3. Anspruchs- und Inhaltsvertrag

### 3.1 Schwierigkeit

- Jede Frage verwendet ausschließlich `difficulty=MEDIUM` oder `difficulty=HARD`; `EASY` ist ausgeschlossen.
- Eine mittlere Frage verlangt mindestens zwei verknüpfte Überlegungen, die Anwendung einer Regel auf einen konkreten Fall oder die Abgrenzung konkurrierender Aussagen.
- Eine schwere Frage verlangt einen mehrstufigen Architekturentscheid, die Analyse widersprüchlicher Evidenz, eine Rechnung mit Betriebsfolge oder die Auswahl unter mehreren zugleich plausiblen Alternativen.
- Das Schwierigkeitslabel allein genügt nicht. Stamm, Daten, notwendige Denkoperation, Alternativen und Auflösung müssen den ausgewiesenen Anspruch tragen.
- Unbewertete Survey-, Rating- und Freitextfragen bleiben fachlich anspruchsvolle Diagnose- oder Reflexionsimpulse; das Schwierigkeitsfeld macht sie nicht zu benoteten Aufgaben.

### 3.2 Fall- und Evidenzorientierung

Die Fragen prüfen Cloud Computing nicht als Produktkatalog. Sie verwenden konkrete Szenarien zu Architekturentscheidungen und Trade-offs, Fehlkonfigurationen und Fehlerbildern, Log- und Metrikinterpretation, Kapazitäts- und Kostenannahmen, Latenz und Backpressure, Security und Datenschutz sowie technischen und wirtschaftlichen Betriebsfolgen. Aussagen zum Studienobjekt arsnova.eu unterscheiden ausdrücklich:

1. implementierten Ist-Zustand,
2. lokal verifizierte Evidenz,
3. produktiv beobachtete Evidenz,
4. noch ungetestetes Zielbild.

Ein lokaler Test wird nicht als Produktionsfreigabe ausgegeben. Die Lehrprofile `100 × 50` und `1 × 5.000` sind Entwurfs- und Testszenarien, keine zugesagte Kapazität.

### 3.3 Distraktoren und Lösungshinweise

Für Auswahlfragen und sinngemäß für konkurrierende strukturierte Elemente gilt:

1. Alle Optionen vervollständigen den Stamm grammatisch auf dieselbe Weise oder sind eigenständige Aussagen derselben Form.
2. Wortart, Zeitform, Person, Numerus, Einheit, Rundung, Präzision und fachliche Detailtiefe sind parallel.
3. Jeder Distraktor bildet ein realistisches Fehlkonzept, einen plausiblen Architekturfehler, eine falsche Verantwortungsgrenze oder eine nachvollziehbare Kosten-, Sicherheits- oder Betriebsfehlannahme ab.
4. Die richtige Lösung ist weder durch Länge, Einschränkungswörter, ungewöhnliche Präzision noch durch ein anderes Format erkennbar.
5. Scherzantworten, offenkundiger Unsinn, doppelte Optionen und Fangfragen sind unzulässig.
6. Kein Fragenstamm, keine Option und kein strukturiertes Element verrät die Lösung einer anderen Frage desselben oder eines späteren Themenblocks.
7. Normalisierte Fragenstämme sind paketweit eindeutig; bloße Umformulierungen desselben Falls gelten als Dublette.
8. Erklärungen und Musterlösungen werden nicht in den Teilnehmer-Fragenstamm geschrieben.

## 4. Kurztextvertrag und Testfälle

Jede `SHORT_TEXT`-Frage verwendet verbindlich:

```json
{
  "shortTextCaseSensitive": false,
  "shortTextEvaluationMode": "exact",
  "shortTextToleranceLevel": "none",
  "shortTextAllowPartialCredit": false,
  "shortTextTrimWhitespace": true,
  "shortTextNormalizeWhitespace": true
}
```

Alle fachlich zulässigen Schreibvarianten werden explizit als `answers` gepflegt und mit `isCorrect=true` markiert. Groß-/Kleinschreibung sowie führende, nachgestellte und wiederholte Leerzeichen werden wie konfiguriert normalisiert; Tippfehler, Teilstrings, falsche Zahlen, falsche Einheiten, Negationen und fachliche Gegenbegriffe werden nicht angenähert akzeptiert. Ein Treffer erhält die volle Basispunktzahl, jeder Nichttreffer null Punkte.

Die separate Datei [ARSnova_Kurztext_Testfaelle.json](./ARSnova/ARSnova_Kurztext_Testfaelle.json) enthält `schemaVersion=1` und genau einen Eintrag je Themenblockdatei. Jeder Eintrag besitzt ausschließlich:

- `file`: den exakten Themenblockdateinamen,
- `positives`: alle und nur die normalisierten expliziten Musterlösungsvarianten,
- `negatives`: mindestens zwei fachlich falsche Gegenbeispiele, die kritische Zahl-, Einheiten-, Richtungs- oder Begriffsverwechslungen abdecken.

Der strenge Validator führt alle Positivfälle mit 100 von 100 Punkten und alle Negativfälle mit 0 von 100 Punkten durch. Eine Änderung an einer Short-Text-Lösung erfordert gleichzeitig die Aktualisierung der zugehörigen Testfälle.

## 5. Verbindliches Gamification- und Zeitprofil

Jede Themenblockdatei verwendet exakt dieses Profil:

```json
{
  "showLeaderboard": true,
  "allowCustomNicknames": false,
  "defaultTimer": 60,
  "timerScaleByDifficulty": true,
  "enableTimerAccommodation": true,
  "enableSoundEffects": true,
  "enableRewardEffects": true,
  "enableMotivationMessages": true,
  "enableEmojiReactions": true,
  "anonymousMode": false,
  "teamMode": true,
  "teamCount": 4,
  "teamAssignment": "AUTO",
  "teamNames": ["Apfel :apple:", "Birne :pear:", "Banane :banana:", "Apfelsine :orange:"],
  "backgroundMusic": null,
  "nicknameTheme": "KINDERGARTEN",
  "bonusTokenCount": 3,
  "readingPhaseEnabled": true
}
```

`allowCustomNicknames=false` und `nicknameTheme=KINDERGARTEN` erzwingen automatisch vergebene Pseudonyme statt frei eingegebener Klar- oder Nicknamen. Rangliste, vier automatisch gebildete Obstteams, drei Bonus-Token sowie Sound-, Belohnungs-, Motivations- und Emoji-Effekte sind formative Spielsignale. Sie werden nicht als Lernstandskennzahl oder personenbezogenes Leistungsprofil interpretiert.

Jede einzelne Frage verwendet `timer=null`. Dadurch greift der Standardtimer von 60 Sekunden mit Schwierigkeitsskalierung: vor einer gegebenenfalls persönlich freigegebenen Zeitunterstützung ergeben sich 90 Sekunden für `MEDIUM` und 120 Sekunden für `HARD`. Der Countdown beginnt erst nach der aktivierten Lesephase. `enableTimerAccommodation=true` hält die produktseitige persönliche Zeitunterstützung offen; die konkrete Freigabe folgt dem institutionellen Nachteilsausgleich.

### 5.1 Gleichwertiger Zugang

- Fachinformation wird nie ausschließlich durch Farbe, Position, Animation, Sound, Musik, Emoji oder Belohnung vermittelt.
- Fragenstamm, Optionen, Einheiten und strukturierte Elemente sind vollständig lesbar und vorlesbar.
- Für jede Frage existiert ein in Inhalt, Elementen, Lösung, Lernziel und Feedback identischer Weg ohne Countdown. Er darf digital oder auf Papier durchgeführt werden und erzeugt keinen Lern- oder Teilnahmenachteil.
- Sound, Reward, Motivation und Emoji können individuell ausbleiben; die fachliche Aufgabe bleibt vollständig.
- Die Lesephase, die technische Zeitunterstützung und die untimierte Alternative sind drei getrennte Schutzmechanismen und ersetzen einander nicht.

## 6. Lösungsschutz, Peer Instruction und Effective Vote

Während der Lese- und Antwortphase werden keine `isCorrect`-Werte, Referenzwerte oder strukturierten Soll-Lösungen an Teilnehmende ausgeliefert. Die Auflösung erfolgt erst, nachdem der Host die Abstimmung geschlossen und die Ergebnisphase geöffnet hat. Bei Peer Instruction bleibt die Lösung auch während der Diskussion verborgen.

Für Scoring, Einzel- und Teamranglisten, Bonus-Token, Scorecards, Analysen und Exporte gilt dieselbe Effective-Vote-Regel:

1. Gibt es für eine Frage mindestens einen Vote in Runde 2, ersetzt Runde 2 die Runde 1 für diese ganze Frage.
2. Gibt es für die Frage keinen Vote in Runde 2, zählt Runde 1.
3. Pro Person und Frage gibt es höchstens einen wirksamen Vote.
4. Wer nur in Runde 1 abgestimmt hat, aber an der für die Frage eröffneten Runde 2 nicht teilnimmt, hat für diese Frage keinen wirksamen Vote.
5. Runde 1 und Runde 2 werden niemals addiert. Runde-2-Antwortzeit beeinflusst keinen Tiebreaker.

Die Regel gilt für die wettbewerblich bewertbaren Typen Single Choice, Multiple Choice, Short Text und Numeric Estimate. Freitext, Survey und Rating erzeugen keine fachlichen Wettbewerbspunkte. Aggregierte Lehrsignale dürfen die Effective-Vote-Regel nicht durch eine alternative Rundenzählung umgehen.

## 7. Import- und Upload-Transformation

Import und Live-Upload sind zwei getrennte, beide zu prüfende Verträge:

1. **Dateiimport:** Die vollständige Datei `{exportVersion, exportedAt, quiz}` wird gegen `QuizImportSchema` geprüft. Dieses Schema ist im Shared-Types-Paket ein Alias von `QuizExportSchema`.
2. **Lokale Bibliothek:** Der Importer übernimmt `parsed.data.quiz`, sortiert die Fragen nach `order`, nummeriert sie lokal lückenlos und erzeugt neue lokale UUIDs für Quiz, Fragen und gewöhnliche Antworten. Vorhandene technische Struktur-IDs werden geprüft; fehlende Legacy-IDs können vom nativen Importnormalisierer opak ergänzt werden.
3. **Live-Payload:** Beim Live-Schalten wird nicht die Exporthülle gesendet. Die Anwendung bildet aus dem lokalen Quiz ein Objekt für `QuizUploadInputSchema`, filtert deaktivierte Fragen, nummeriert aktive Fragen erneut ab null, übernimmt nur typgerechte Felder und validiert das Ergebnis vor dem API-Aufruf.
4. **Backend-Upload:** `quiz.upload` speichert eine serverseitige Kopie und erzeugt eigene technische IDs. `exportedAt`, redaktionelle Kennungen und lokale Frage-UUIDs sind kein Bestandteil dieses Uploads.
5. **Paketprüfung:** [validate_module.mjs](./validate_module.mjs) prüft deshalb jede vollständige Datei gegen `QuizImportSchema` und zusätzlich ihr inneres `quiz`-Objekt gegen `QuizUploadInputSchema`.

Eine erfolgreiche JSON-Syntaxprüfung allein genügt nicht. Erst beide Shared-Types-Prüfungen, die Paketregeln dieses Blueprints und ein realer Testimport belegen die technische Verwendbarkeit.

## 8. Redaktionelle und technische Freigabe

Eine Themenblockdatei ist erst freigabefähig, wenn:

1. Datei, Exporthülle und inneres Quiz beide schemafähig sind;
2. genau zehn Fragen mit `order=0` bis `order=9` vorliegen;
3. jeder der zehn Typen genau einmal vorkommt;
4. jede Frage `MEDIUM` oder `HARD` und `timer=null` verwendet;
5. das vollständige Konfigurationsprofil aus Abschnitt 5 unverändert vorliegt;
6. Auswahloptionen eindeutig, plausibel, parallel und frei von formalen Lösungshinweisen sind;
7. Short Text alle expliziten Varianten sowie bestandene positive und negative Testfälle besitzt;
8. Referenzwerte, Toleranzen, Einheiten und strukturierte Lösungen unabhängig reproduziert wurden;
9. paketweit weder Dubletten noch gegenseitige Lösungshinweise bestehen;
10. Implementierung, Evidenz und Zielbild bei Aussagen zu arsnova.eu getrennt sind;
11. Lesephase, Zeitunterstützung und inhaltlich identische untimierte Alternative praktisch geprüft wurden;
12. Lösungsschutz bis zur geschlossenen Frage und die Effective-Vote-Regel im Probelauf bestätigt wurden;
13. Tablet- und Laptopdarstellung, Tastaturbedienung, Vorlesbarkeit und nicht sensorisch exklusive Vermittlung praktisch geprüft wurden;
14. die Lehrnutzung freiwillig-formativ bleibt und individuelle Bewertung, Forschung und Publikation ausgeschlossen sind;
15. Item-Redaktion und Qualitätsverantwortung die fachliche Schlussprüfung dokumentiert haben.

Ausgeführte Prüfungen, konkrete Resultate und offene operative Gates werden ausschließlich im [QA-Freigabeprotokoll](./QA_Freigabeprotokoll.md) festgehalten.
