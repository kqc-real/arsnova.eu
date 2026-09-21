# P0-02: Datenmanagement- und Exportplan für das Statistikmodul

- **Status:** verbindlicher Kursstandard
- **Geltungsbereich:** Lehre und interne Evaluation des Statistikmoduls
- **Bezugsdokument:** [Modulkonzept „Angewandte Statistik“](./Modulkonzept_48UE_BWL_Management_WI_Informatik.md)
- **Stand:** 13.09.2026

**Kürzel vorab:** **LIVE** bezeichnet Daten aus dem laufenden Kurs, **REPO** versionierte Repository-Nachweise und **LEHRDATEN** synthetische Übungsdaten. **RAW-/WORK-RESTRICTED**, **ANON-/SYNTHETIC-APPROVED** und **PUBLIC-REPO** sind die in Abschnitt 3 erläuterten Schutzstatus; **Q&A** bedeutet Fragen und Antworten, **MC** Multiple Choice.

## 1. Zweck und Grenzen

Dieser Plan setzt den P0-Datenlebenszyklus für alle im Modul verwendeten Daten operativ um. Er regelt Erhebung, Export, Prüfung, lokale Analyse mit JASP, Freigabe, Aufbewahrung und Löschung.

Zulässige Zwecke sind ausschließlich:

1. formative Steuerung der laufenden Lehre;
2. Übungen und Statistikbefunde im Modul;
3. interne Evaluation und Verbesserung des Moduls anhand vorab festgelegter, aggregierter Kennzahlen;
4. technische Fehlerklärung, soweit dafür minimale Betriebsdaten erforderlich sind.

Nicht zulässig sind:

- Benotung, Anwesenheitskontrolle oder Sanktionierung anhand von Live- oder MC-Test-Daten;
- dauerhafte individuelle Leistungsprofile, eine Verknüpfung der nur sitzungsintern sichtbaren Pseudonym-Rangliste mit Personen sowie jeder Abgleich von Spielwerten mit Kurs-, Prüfungs- oder LMS-Listen;
- Rekonstruktion von Personen-Rohwerten oder Vorher-Nachher-Paaren aus Session-IDs, Pseudonymen, Zeitstempeln oder anderen Hilfsmerkmalen;
- Werbung, allgemeine Produktanalyse oder Training externer KI-Systeme;
- Upload von LIVE-Daten in Cloud-Tabellen, Web-Analysewerkzeuge, Chatbots oder externe LLM-Dienste;
- Forschung, Publikation oder öffentliche Evaluation. Ändert sich der Zweck in diese Richtung, endet die Nutzung nach diesem Plan vor der weiteren Erhebung; dafür ist ein eigenständiger institutioneller Prüf- und Freigabeprozess erforderlich.

Der Plan ist eine umsetzbare Kursregel, keine Rechtsberatung. Strengere institutionelle Vorgaben zu Datenschutz, Informationssicherheit, Aufbewahrung oder Löschung haben Vorrang. Bei mehreren anwendbaren Fristen gilt für Kurskopien die kürzere Frist, sofern keine dokumentierte institutionelle Anordnung entgegensteht.

## 2. Verbindliche Grundsätze

1. **Datenminimierung:** Erhoben und exportiert werden nur Variablen, die einer zulässigen Lehr- oder Evaluationsfrage zugeordnet sind.
2. **Aggregation vor Verteilung:** Studierende erhalten grundsätzlich LEHRDATEN, REPO-Daten oder freigegebene anonyme LIVE-Aggregate, niemals pseudonyme Einzelantworten.
3. **Keine erfundenen Rohdaten:** Der arsnova.eu-Standardexport enthält überwiegend fragebezogene Aggregate. Er wird nicht als Personen-Rohwerttabelle interpretiert. Fehlende Einzelwerte und Paare werden nicht rekonstruiert.
4. **Getrennte Herkunft:** LIVE, REPO und LEHRDATEN bleiben in Dateiname, Datenregister und Ergebnisbericht unterscheidbar.
5. **Lokale Analyse:** JASP ist die verbindliche Analysesoftware. LIVE-Daten werden ausschließlich in der lokal installierten JASP-Anwendung verarbeitet.
6. **Kurze Rohdatenphase:** Pseudonyme Roh- und Betriebsdaten werden innerhalb von 48 Stunden verarbeitet und spätestens sieben Kalendertage nach Erhebungsende gelöscht. Für Q&A- und sonstigen Freitext gilt die kürzere Frist von 72 Stunden.
7. **Reproduzierbarkeit ohne Personenbezug:** Herkunft, Variablendefinitionen, Ausschlüsse, JASP-Version, Importparameter und Auswertungsschritte werden dokumentiert; Identifikatoren werden nicht mitarchiviert.

## 3. Datenklassen und Schutzstatus

### 3.1 Herkunftsklassen

| Klasse        | Bedeutung                                                              | Beispiele                                                                                     | Verbindliche Grenze                                                                                          |
| ------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **LIVE**      | Im konkreten Moduldurchlauf entstandene Daten                          | arsnova.eu-Antwortaggregate, Q&A-Fragen und Stimmen, Blitzlicht-Verteilung, MC-Test-Antworten | Kann trotz Pseudonym oder Aggregation personenbeziehbar sein; nur für die festgelegten Kurszwecke verwenden. |
| **REPO**      | Versionierte, dokumentierte Daten oder Kennzahlen aus einem Repository | Lasttestberichte, festgeschriebene Codekonventionen, dokumentierte Modell-Evaluation          | Commit und Datei angeben; synthetische Repositorydaten nicht als Feldmessung ausgeben.                       |
| **LEHRDATEN** | Eigens konstruierte synthetische Übungsdaten                           | vollständige Paarwerte für gepaarte Tests, Regressionsdaten, kleine Beispieldatensätze        | Nie als beobachtete LIVE-Daten bezeichnen; Konstruktion und Lernzweck dokumentieren.                         |

Die Herkunftsklasse ändert sich nicht durch Bearbeitung. Ein anonymisiertes Aggregat aus einer Session bleibt daher **LIVE-ANON**, nicht LEHRDATEN. Ein REPO-Datensatz bleibt REPO, auch wenn er synthetisch erzeugt wurde.

### 3.2 Schutzstatus

Jede Datei erhält zusätzlich genau einen Schutzstatus:

| Status                 | Inhalt                                                                                                   | Zulässiger Ort und Zugriff                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **RAW-RESTRICTED**     | unveränderter Export, Pseudonyme, Codes, Freitext oder vollständige Betriebsdaten                        | verschlüsselter Eingangs- oder Quarantäneordner; nur Session-Host, Datenkuratierung und Modulverantwortung |
| **WORK-RESTRICTED**    | bereinigte, aber noch pseudonyme oder kleinzellige Arbeitsdatei; JASP-Datei mit eingebetteten LIVE-Daten | geschützter Arbeitsordner; nur Datenkuratierung und Modulverantwortung                                     |
| **ANON-APPROVED**      | geprüfte anonyme LIVE-Aggregate ohne Freitext, Identifikatoren oder rückrechenbare Kleinzellen           | Lehrdatenordner; Freigabe an den Kurs zulässig                                                             |
| **SYNTHETIC-APPROVED** | geprüfte LEHRDATEN ohne Bezug zu realen Einzelpersonen                                                   | Lehrdatenordner oder Repository; Freigabe an den Kurs zulässig                                             |
| **PUBLIC-REPO**        | bereits öffentlich versionierte REPO-Quelle oder daraus unverändert zitierte Kennzahl                    | Repository oder Lehrdatenordner                                                                            |

Pseudonymisierung ist keine Anonymisierung. Hashes, automatisch erzeugte Teilnehmer-IDs, Session-IDs, Session-Codes und wechselnde Nicknames bleiben Identifikatoren. Dateiformate senken den Schutzstatus nicht: Insbesondere kann eine `.jasp`-Datei die importierten Daten vollständig enthalten.

## 4. Rollen- und Verantwortungsmodell

Personennamen werden weder in diesem Plan noch in Dateinamen oder Freigabeartefakten geführt. Zuständigkeiten werden über Rollen dokumentiert.

| Rolle                                                          | Aufgaben                                                                                                                         | Maximaler Zugriff                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Modulverantwortung**                                         | legt Zwecke, Kennzahlen und Fristen fest; genehmigt Freigaben; kontrolliert Löschprotokoll und Incidents                         | alle Kursordner, jedoch kein routinemäßiger Zugriff auf Plattform-Administrationsdaten |
| **Session-Host**                                               | konfiguriert datensparsame Sessions; moderiert Q&A; führt die unmittelbaren Exporte und die Erstprüfung aus                      | arsnova.eu-Hostansicht und RAW-Eingang der eigenen Session                             |
| **Datenkuratierung**                                           | registriert, bereinigt, aggregiert und analysiert Daten in JASP; wendet Kleinzellenregel an; löscht Arbeitskopien                | RAW-, WORK-, JASP- und Freigabeordner                                                  |
| **Lehrassistenz**                                              | arbeitet ausschließlich mit freigegebenen ANON-APPROVED-, SYNTHETIC-APPROVED- oder PUBLIC-REPO-Dateien                           | Lehrdaten- und Berichtsordner                                                          |
| **Plattformbetrieb**                                           | betreibt arsnova.eu beziehungsweise MC-Test, setzt serverseitige Zugriffe und Löschung um, unterstützt bei technischen Incidents | jeweilige Plattformdaten nach institutionellem Betriebsmodell                          |
| **Institutionelle Datenschutz-/Informationssicherheitsstelle** | übernimmt Bewertung und Steuerung meldepflichtiger oder unklarer Vorfälle                                                        | nur die für den konkreten Vorgang erforderlichen Informationen                         |
| **Teilnehmende**                                               | geben freiwillig Antworten und beachten den Hinweis, keine Personendaten in Freitext einzugeben                                  | eigene App-Ansicht und freigegebene Lehrmaterialien                                    |

Freigabe und Löschkontrolle werden von zwei Rollen getragen: Die Datenkuratierung führt aus; die Modulverantwortung prüft das Protokoll. Bei kleinen Teams kann dieselbe technische Bedienung erfolgen, die zweite Prüfung bleibt dennoch dokumentiert.

## 5. Systemweise Datenflussmatrix

| System oder Ort                   | Verarbeitete Daten                                                                                                                                | Regulärer Export oder Übergang                                                                | Klasse/Status beim Übergang                                                 | Kursregel                                                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **arsnova.eu-Hostbrowser**        | lokale Quizsammlung in IndexedDB/Yjs, Host-Token in kurzlebigem Browserspeicher, zuletzt verwendete Codes                                         | Quizdefinition als JSON; Sessionexporte als Download                                          | REPO oder LEHRDATEN für Quizinhalt; LIVE/RAW-RESTRICTED für Ergebnisdateien | Host-Token, Access-Proof und Session-Code nie in Lehrmaterialien, Screenshots oder Dateiregister für Studierende übernehmen.                                                                                                                                               |
| **arsnova.eu/PostgreSQL**         | Session, temporäre Quizkopie, Teilnehmende, Votes, Q&A und optionale Bewertungen/Bonuscodes                                                       | Host-PDF und Session-CSV nach `FINISHED`; Q&A nur teilweise im allgemeinen Export             | LIVE/RAW-RESTRICTED                                                         | Regulär startet nach `endedAt` die 14-tägige Host-Nachbereitung; der technische Purge folgt danach, sofern kein Legal Hold greift. Bonus- oder Sessionfeedbackdaten können den Purge zusätzlich verzögern. Der Kurs verlässt sich nie auf nachträgliche Verfügbarkeit.     |
| **arsnova.eu/Redis – Blitzlicht** | Verteilung, Voter- und Auswahlzustände, Tempo-Buckets und Besitznachweis                                                                          | kein regulärer dauerhafter Kurs-Rohdatenexport; Aggregat wird während der Runde dokumentiert  | LIVE/ANON-APPROVED erst nach Kleinzellenprüfung                             | Zustand läuft nach ungefähr 30 Minuten ohne erneute Aktivität ab; Aktivität erneuert die TTL. Standalone-Blitzlicht wird nach der Erfassung ausdrücklich beendet und dadurch unmittelbar gelöscht.                                                                         |
| **arsnova.eu/Q&A-Hostansicht**    | geladene Fragetexte, Status, positive/negative Stimmen, Gesamtstimmen, Wilson- und Kontroversitätswerte                                           | eigener Host-Export `arsnova-qa-questions-SESSION.csv`                                        | LIVE/RAW-RESTRICTED                                                         | Für Q&A-Vollmetriken immer den separaten Q&A-CSV exportieren. Der allgemeine Sessionexport enthält nicht alle Metriken und ist kein Ersatz.                                                                                                                                |
| **arsnova.eu-Sessionexport**      | Frageaggregate, Aggregationsrunde, Häufigkeiten, Schätzstatistik, Confidence, einfache Q&A-Daten; optional Pseudonyme, Teamwertung und Bonuscodes | `arsnova-results-TITEL-SESSION.csv` und `.pdf`                                                | zunächst LIVE/RAW-RESTRICTED                                                | Fragewerte sind aggregiert und enthalten keine Personen-Rohwert- oder Paartabelle. Enthaltene Pseudonyme, Ränge, Teamnamen, Antwortzeiten oder Bonuscodes machen die Datei pseudonym; diese Felder werden vor jeder fachlichen Analyse entfernt und fristgerecht gelöscht. |
| **MC-Test/Streamlit und SQLite**  | Pseudonym, technische Nutzerkennung, Testsitzung, Einzelantwort, Richtigkeit, Punkte, Confidence, Bookmark, Feedback und Session-Summary          | Antwort-Log `mc_test_answers.csv`, PDF-Berichte und vollständiger SQL-Dump `mc_test_dump.sql` | LIVE/RAW-RESTRICTED                                                         | Das Antwort-CSV ist eine pseudonyme Einzelantworttabelle; der SQL-Dump enthält die gesamte Datenbank und ist kein Routineexport. Nur ein kursisolierter Datenbestand und ein eindeutig versioniertes Statistik-Fragenset werden verwendet.                                 |
| **Geschützter Kursspeicher**      | Eingangsdateien, Arbeitskopien, Datenregister, Löschprotokoll                                                                                     | bereinigte CSVs an JASP; freigegebene Aggregate an Lehrmaterialien                            | gemäß Schutzstatus                                                          | Institutionell verwalteter, verschlüsselter Speicher; keine private Cloud-Synchronisierung und kein Repository für RAW/WORK.                                                                                                                                               |
| **Lokales JASP**                  | importierte CSV, Transformationen, Filter, Analysen, Abbildungen                                                                                  | `.jasp`, freigegebene `.csv`, `.pdf` oder `.png`                                              | mindestens so hoch wie die sensibelste Eingabedatei                         | JASP lokal ausführen. `.jasp` mit eingebetteten LIVE-Daten bleibt WORK-RESTRICTED und unterliegt der Rohdatenfrist.                                                                                                                                                        |
| **Repository und Kursausgabe**    | versionierte REPO-Quellen, synthetische LEHRDATEN, freigegebene anonyme Aggregate                                                                 | Markdown, CSV, PDF, PNG                                                                       | PUBLIC-REPO, SYNTHETIC-APPROVED oder ANON-APPROVED                          | Keine RAW-, WORK-, Sessioncode-, Pseudonym-, Q&A-Rohtext- oder nicht geprüfte JASP-Datei einchecken oder verteilen.                                                                                                                                                        |

## 6. Ablage- und Dateinamenschema

### 6.1 Verzeichnisstruktur

Der institutionell geschützte Kursroot heißt nach dem Schema `STAT_JJJJ_TERM`, beispielsweise `STAT_2026_H2`.

```text
STAT_JJJJ_TERM/
├── 00_register/
│   ├── datenregister.csv
│   ├── freigaben.csv
│   └── loeschprotokoll.csv
├── 10_live_eingang_restricted/
│   └── W01/ ... W10/
├── 20_work_restricted/
│   └── W01/ ... W10/
├── 30_jasp_restricted/
│   └── W01/ ... W10/
├── 40_lehrdaten_approved/
│   ├── live_anon/
│   ├── repo/
│   └── synthetisch/
├── 50_berichte_approved/
└── 90_quarantaene_restricted/
```

`10_live_eingang_restricted` ist kein Archiv. Dateien verlassen diesen Ordner innerhalb von 48 Stunden durch kontrollierte Verarbeitung oder Löschung. Quarantäne ist ausschließlich für ungeprüften Freitext, Fehlversand und Incidents bestimmt.

### 6.2 Dateinamen

Das verbindliche Schema lautet:

`JJJJMMTT_WNN_SYSTEM_HERKUNFT_EREIGNIS_INHALT_STATUS_VNN.EXT`

Zulässige Beispiele:

- `20260913_W01_ARSNOVA_LIVE_E01_RESULTS_RAW-RESTRICTED_V01.csv`
- `20260913_W01_ARSNOVA_LIVE_E01_QA_RAW-RESTRICTED_V01.csv`
- `20260914_W01_JASP_LIVE_E01_ITEM-AGG_WORK-RESTRICTED_V01.jasp`
- `20260915_W01_JASP_LIVE_E01_ITEM-AGG_ANON-APPROVED_V01.csv`
- `20261020_W06_JASP_LEHRDATEN_E02_PAIRED-TEST_SYNTHETIC-APPROVED_V02.jasp`
- `20261130_W10_JASP_LIVE_MODUL_EVAL_ANON-APPROVED_V01.pdf`

Verboten in Dateinamen sind Personennamen, Pseudonyme, Sessioncodes, Session- oder Teilnehmer-IDs, vollständige Fragentexte und frei eingegebene Kursbezeichnungen. Browser-Downloads mit Sessioncode werden unmittelbar nach Registrierung in das neutrale Ereignisschema umbenannt. Der Sessioncode steht höchstens bis zur abgeschlossenen Exportprüfung im zugriffsbeschränkten Datenregister und wird danach entfernt.

### 6.3 Datenregister

Für jedes Artefakt werden mindestens folgende Felder geführt:

- `artifact_id`;
- `course_id`, `week`, `event_id`;
- `system`, `source_class`, `protection_status`;
- `purpose_code` mit `LEHRE`, `MODUL-EVAL` oder `INCIDENT`;
- logischer Dateiname und Speicherbereich, nicht der private Gerätepfad;
- Erhebungsende in UTC und lokale Zeitzone;
- Exportzeit, Dateigröße und SHA-256-Prüfsumme;
- Variablenumfang und Beobachtungseinheit;
- Freitext enthalten: ja/nein;
- frühestes Löschdatum und verbindliches Löschdatum;
- verantwortliche Rollen;
- Freigabe- oder Löschstatus.

## 7. Konkreter Exportablauf

### 7.1 Vor der Session

Die folgenden Punkte sind vor jeder Erhebung abgeschlossen:

1. Im Datenregister sind Lehrfrage, Evaluationsfrage, benötigte Variablen, Herkunftsklasse, Beobachtungseinheit und Löschdatum eingetragen.
2. Für arsnova.eu sind automatisch erzeugte Themenpseudonyme und systemerzeugte Kennungen gewählt; eigene Nicknames und Klarnamen sind deaktiviert. Rangliste, automatisch gebildete Teams, Zeitphasen, Bonuspunkte sowie Sound-, Belohnungs-, Motivations- und Emoji-Effekte werden nur zur Lern- und Aufmerksamkeitsmotivation eingesetzt. Pseudonym, Rang, Team, Antwortzeit, Score, Bonus und gegebenenfalls technisch anfallende Reaktionsereignisse werden nicht in die fachliche Lernanalytik oder individuelle Profile übernommen und nach dem vorgesehenen Rohdatenfenster gelöscht. Teamnamen enthalten keine Personen- oder Firmennamen.
3. Q&A läuft mit Vorabmoderation. Der sichtbare Hinweis lautet sinngemäß: keine Namen, Kontaktdaten, Gesundheitsangaben, Prüfungsfälle oder andere vertrauliche Inhalte eingeben.
4. Freitextfragen werden nur eingesetzt, wenn eine geschlossene Frage den Lehrzweck nicht erfüllt. Für numerische Paar- und Regressionsübungen liegen stattdessen synthetische LEHRDATEN bereit.
5. Der MC-Test verwendet ein eigenes, versioniertes Statistik-Fragenset und einen kursisolierten SQLite-Datenbestand. Es werden unreservierte, zufällige Pseudonyme ohne Zuordnungsliste und ohne Recovery-Geheimwort verwendet. Dasselbe Pseudonym wird nicht zur Verknüpfung über Wochen verlangt.
6. Die Zugriffsgruppen auf RAW, WORK und Freigabeordner sind geprüft. Lokale Downloads landen auf einem verschlüsselten, verwalteten Gerät.
7. Eine Probesession hat alle drei erforderlichen arsnova.eu-Wege bestätigt: Q&A-CSV während der Hostansicht, Session-CSV nach `FINISHED` und Ergebnis-PDF nach `FINISHED`.
8. Die JASP-Importvorlage ist mit Testdaten geprüft; Zeichencodierung, Feldtrenner, Dezimaltrennzeichen, Variablentypen und fehlende Werte sind dokumentiert.

### 7.2 Während der Session

1. Der Session-Host wiederholt kurz Freiwilligkeit, fehlende Notenwirkung und das Freitextverbot für Personendaten.
2. Für jede Auswertung werden Zeitpunkt, Item-ID, Runde und zutreffender Nenner erfasst. Eingeschriebene Personen, Anwesende, verbundene Geräte, Antworten und vollständige Paare werden nicht gleichgesetzt.
3. Blitzlichtwerte werden als Verteilung mit Gesamtzahl und Zeitpunkt dokumentiert, solange die Runde sichtbar ist. Voter-IDs oder individuelle Wechsel werden nicht exportiert.
4. Q&A wird laufend moderiert. Offenkundig personenbezogene, sensible oder sachfremde Beiträge werden nicht in Lehrmaterialien übernommen. Die Moderation selbst ersetzt nicht die Nachprüfung des Exports.
5. Vor `FINISHED` wird Q&A geschlossen, die Fragenliste aktualisiert und der separate Q&A-CSV exportiert. Geprüft werden mindestens Dateigröße, Kopfzeile, Zahl der Fragen sowie die Spalten für positive Stimmen, negative Stimmen, Gesamtstimmen, Wilson-Score und Kontroversitäts-Score. Die Plattform kann Q&A nach Quiz-`FINISHED` offen lassen; für den Kurs bleibt der explizite Schluss plus Export vor dem Sessionende verbindlich.
6. Erst nach erfolgreicher Q&A-Sicherung wird die Session beendet. Der Zeitpunkt von `FINISHED` ist `T0` und wird im Register erfasst.
7. Direkt nach `T0` werden der Ergebnisbericht als PDF und der allgemeine Session-CSV exportiert. Beide Dateien werden geöffnet beziehungsweise eingelesen und auf Vollständigkeit geprüft.
8. Im MC-Test wird das Antwort-Log nur durch die zuständige Rolle und nur für das eindeutig ausgewählte Statistik-Fragenset exportiert. Lernenden-PDFs verbleiben bei den Lernenden; sie werden nicht zentral eingesammelt. Der vollständige SQL-Dump wird im Regelbetrieb nicht erzeugt.

### 7.3 Nach der Session

| Frist ab Erhebungsende                    | Verbindliche Aktion                                                                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **sofort, Zielwert höchstens 30 Minuten** | Blitzlichtaggregat sichern und Blitzlicht ausdrücklich beenden; Q&A-, Session-CSV und PDF auf Lesbarkeit prüfen.                                                       |
| **höchstens 2 Stunden**                   | Downloads in `10_live_eingang_restricted` verschieben, neutral umbenennen, registrieren und Prüfsumme bilden; Kopien aus Downloads und temporären Freigaben entfernen. |
| **höchstens 24 Stunden**                  | Q&A- und Freitextprüfung abschließen; notwendige Inhalte paraphrasieren oder kategorisieren; unzulässige Inhalte in Quarantäne behandeln.                              |
| **höchstens 48 Stunden**                  | Unveränderte Quelle in JASP importieren, minimale Arbeitsdatei erzeugen, Aggregate bilden und Identifikatoren aus der Analysefassung entfernen.                        |
| **höchstens 72 Stunden**                  | Q&A-/Freitext-Rohdateien und freitextführende JASP-Arbeitsstände löschen; freigabefähige Aggregate der Kleinzellen- und Rückrechenprüfung unterziehen.                 |
| **höchstens 7 Kalendertage**              | alle übrigen pseudonymen RAW-/WORK-Kopien einschließlich MC-Test-Einzelantworten und eingebetteter JASP-Daten löschen; Löschprotokoll vervollständigen.                |
| **12 Monate nach offiziellem Kursende**   | LIVE-ANON-Aggregate und internen Modulevaluationsbericht aus dem aktiven Kursspeicher löschen.                                                                         |

Der Kurs setzt für arsnova.eu ein internes Exportziel von zwei Stunden. Die technische 24-Stunden-Aufbewahrung nach `FINISHED` ist eine Obergrenze für den regulären Plattform-Nachlauf, keine Exportzusage. Ist der Export bis zum Plattform-Purge nicht gelungen, wird die Datenlücke dokumentiert und mit REPO- oder LEHRDATEN weitergearbeitet. Ein Admin-Auszug oder Legal Hold wird nicht eingesetzt, um eine versäumte reguläre Lehrauswertung nachzuholen.

## 8. Besondere Regeln nach Datenquelle

### 8.1 arsnova.eu-Sessionexport

- Der allgemeine CSV/PDF-Export liefert je Frage Aggregate, Nenner und gegebenenfalls Aggregationsrunden.
- Bei Peer Instruction und Zwei-Runden-Schätzfragen wird die ausgewiesene effektive Runde verwendet. Runde-1-Werte werden nicht als Ersatz für fehlende Runde-2-Werte aufgefüllt.
- Histogramm und Rundenvergleich einer Schätzfrage sind keine personweise Rohwert- oder Paartabelle.
- Personenbezogene Bonuscodeblöcke, Nicknames und nicht erforderliche Teamdaten werden nicht in die Arbeitsdatei übernommen. Enthält der Export solche Blöcke dennoch, bleibt die Datei bis zur Löschung RAW-RESTRICTED.
- Aggregierte Freitextwerte können seltene Originalformulierungen enthalten und werden deshalb wie Freitext behandelt.

### 8.2 Q&A und Freitext

- Der separate Host-Q&A-CSV ist für Vollmetriken verbindlich. Er enthält alle Fragen unabhängig vom aktuellen Listenfilter sowie die in der Host-UI sichtbaren Attribute (Statusbezeichnung, Autor, Score, Stimmen, Wilson, Kontroverse, Umstritten, Hervorgehoben). Der allgemeine Sessionexport enthält nur einen reduzierten Q&A-Ausschnitt und lässt insbesondere die vollständige Metrikdarstellung des Host-CSV vermissen.
- Q&A-Rohtext wird nie unverändert an Studierende verteilt und nie in das Repository übernommen.
- Innerhalb von 24 Stunden ersetzt die Datenkuratierung zulässige Fragen durch Kategorien oder neutrale Paraphrasen. Namen, Kontaktdaten, Organisationseinheiten, konkrete persönliche Situationen, Links mit Kennungen und seltene Kombinationen werden entfernt.
- Für Lehranalysen werden nur Kategorien mit Zählwerten und dokumentiertem Nenner verwendet. Einzelne wörtliche Zitate sind ausgeschlossen.
- Inhaltlich notwendiger, aber sensibler Freitext wird nicht paraphrasiert, sondern gelöscht und gegebenenfalls als Incident behandelt.
- Die Q&A-Rohdatei, Zwischenablagekopien, Textnotizen und freitextführende JASP-Dateien werden spätestens 72 Stunden nach Erhebungsende gelöscht.

### 8.3 MC-Test

Referenz für den eingesetzten Stand ist das externe Repository `kqc-real/streamlit`, Commit `b6b159555e8a228dad73dd75fd66c154a1088e28`.

- Das System verwendet pseudonymen Zugang, SQLite und Exportwege für CSV, PDF und einen vollständigen SQL-Datenbankdump.
- Das Antwort-Log enthält Einzelantworten sowie technische Nutzerkennung beziehungsweise Pseudonym und ist daher LIVE/RAW-RESTRICTED.
- Reguläre Freigabe unreservierter Pseudonyme nach ungefähr 24 Stunden löscht Sitzungen und Antworten, kann aber pseudonyme Session-Summaries für Historie oder Bestenliste erhalten. Sie genügt deshalb nicht als Nachweis der Kurslöschung.
- Für das Modul wird ein kursisolierter Datenbestand verwendet. Nach der Aggregation werden Kurszeilen aus Nutzern, Testsitzungen, Antworten, Bookmarks, Feedback, Session-Summaries, Präferenzen und Heartbeats entfernt und auf Abwesenheit geprüft.
- Bei einer ausschließlich für diesen Kurs bestimmten SQLite-Datenbank wird sie nach Abschluss der Löschung zusammen mit den Dateien `mc_test_data.db-wal` und `mc_test_data.db-shm` im kontrollierten Betriebsfenster verworfen. Bei einer geteilten Instanz führt der Plattformbetrieb eine kursgefilterte Löschung mit derselben Tabellenprüfung aus.
- Ein SQL-Dump ist weder Analyseformat noch Backup des Statistikmoduls. Ist er aus einem Incident heraus institutionell angeordnet, wird er verschlüsselt in Quarantäne geführt und nach der Incidentfrist gelöscht.
- Der MC-Test-Pseudonymwert wird nicht mit arsnova.eu-Kennungen, LMS-Konten oder Wochenlisten verbunden.

## 9. JASP- und CSV-Artefakte

### 9.1 Import und Verarbeitung

1. Der unveränderte Quell-CSV erhält eine Prüfsumme und wird nie überschrieben.
2. Beim JASP-Import werden UTF-8, tatsächlicher Feldtrenner, Dezimaltrennzeichen, Kopfzeile und Datentypen kontrolliert. arsnova.eu-Exporte verwenden regelmäßig Semikolon; MC-Test-Exporte sind vor dem Import anhand der Kopfzeile zu prüfen.
3. Die JASP-Version, Importparameter und alle Typkorrekturen stehen im Datenregister.
4. Variablen werden nach nominal, ordinal und metrisch typisiert. Fehlende oder systemseitig unterdrückte Zellen bleiben fehlend und werden nicht als Null codiert.
5. Ausschlüsse, Filter und Umkodierungen werden in der JASP-Datei und in einem kurzen Methodenblatt dokumentiert.
6. Statistische Bearbeitung erfolgt in JASP. Tabellenprogramme werden nicht als parallele Schattenanalyse verwendet.

### 9.2 Minimale Analysefelder

Für eine freigegebene LIVE-Aggregattabelle sind höchstens erforderlich:

- `week`, `event_id`, `item_id`, `topic`;
- `source_kind` mit `LIVE`;
- `unit`, `aggregation_round`;
- `n_responses`, `n_round1`, `n_round2` oder `n_pairs`, soweit tatsächlich verfügbar;
- aggregierte Zähler, Anteile, Lage- oder Streuungsmaße;
- vorher festgelegter Referenzwert und Toleranzband bei Schätzaufgaben;
- dokumentierte Ausschluss- und Missing-Kategorie.

Vor Freigabe entfernt werden insbesondere:

- Pseudonyme, Hashes, Nicknames und Nutzerkennungen;
- Session-, Teilnehmer-, Antwort- und Q&A-IDs sowie Sessioncodes;
- exakte personenbezogene Zeitstempel und individuelle Antwortzeiten;
- Bonuscodes, Recovery-Daten und technische Tokens;
- Rohantworten, Q&A-Text, Feedbacktext und seltene Originalformulierungen;
- lokale Dateipfade, Gerätenamen und versteckte Hilfsspalten.

### 9.3 Artefaktregeln

- `.jasp` übernimmt immer den höchsten Schutzstatus seiner eingebetteten Daten.
- LIVE/WORK-RESTRICTED-`.jasp` wird nicht verteilt und spätestens mit der siebentägigen Rohdatenfrist gelöscht; bei Freitext gilt 72 Stunden.
- Eine freigabefähige JASP-Datei wird aus einer neu erzeugten ANON-APPROVED-CSV aufgebaut, nicht durch bloßes Ausblenden von Spalten in der RAW-Datei.
- PDF- und PNG-Ausgaben werden auf Titel, Achsen, Legenden, Fußnoten, Dokumenteigenschaften, kleine Zellen und seltene Kategorien geprüft.
- Für Personen-Rohwerte, vollständige Paare, Regression und kleine Demonstrationen werden SYNTHETIC-APPROVED-LEHRDATEN verwendet.
- Jede freigegebene Tabelle enthält Datenklasse, Beobachtungseinheit, Nenner, Zeitraum auf Wochenebene, JASP-Version und einen Hinweis auf synthetische beziehungsweise LIVE-Herkunft.

## 10. Zugriff und Schutz

1. RAW, WORK, JASP und Quarantäne liegen nur auf institutionell verwaltetem, verschlüsseltem Speicher.
2. Zugriff wird rollenbasiert und nach dem Need-to-know-Prinzip vergeben. Freigabelinks sind befristet; offene Links sind unzulässig.
3. Gerätezugang ist durch Bildschirmsperre und Mehrfaktor-Authentifizierung geschützt, soweit institutionell verfügbar.
4. Dateien werden nicht per privater E-Mail, Messenger, USB-Datenträger oder Verbraucher-Cloud übertragen.
5. Sitzungs- und Host-Tokens, Access-Proofs, Recovery-Geheimnisse und Admin-Schlüssel werden nie in Datenordnern oder Löschprotokollen gespeichert.
6. RAW-Daten werden nicht projiziert. Bildschirmfotos und Screenshots mit Codes, Pseudonymen oder Freitext sind untersagt.
7. Es werden keine eigenen RAW-Backups angelegt. Institutionelle Backups folgen deren verbindlichem Löschzyklus; eine lokale Löschung wird im Protokoll mit dem Hinweis auf den Backupzyklus erfasst.
8. Git und dessen Historie sind kein Speicherort für LIVE/RAW, LIVE/WORK oder Incidentdaten.

## 11. Kleinzellen- und Anonymitätsregel

Für alle kursintern verteilten oder präsentierten LIVE-Auswertungen gilt:

1. Exakte Zellenwerte von **1 bis 4** werden nicht ausgegeben. Sie werden mit fachlich passenden Kategorien zusammengefasst oder die gesamte Darstellung entfällt.
2. `0` darf nur gezeigt werden, wenn es ein echter beobachteter Nullwert ist und nicht aus einer systemseitigen Unterdrückung stammt.
3. Kann eine unterdrückte Zelle aus Gesamtwerten, Randhäufigkeiten, Prozenten oder einer Vergleichstabelle zurückgerechnet werden, wird mindestens eine weitere Zelle oder der betreffende Randwert unterdrückt.
4. Untergruppen werden nur berichtet, wenn jede sichtbare Zelle mindestens 5 Beobachtungen enthält und keine seltene Merkmalskombination eine Person erkennbar macht.
5. Bei weniger als 5 Antworten für die gesamte betrachtete Gruppe wird keine LIVE-Untergruppenauswertung erstellt; stattdessen werden LEHRDATEN eingesetzt.
6. Systemseitige Confidence-Unterdrückung bei weniger als 5 Antworten wird übernommen und nicht umgangen.
7. Mehrere Wochen, Items oder Exporte werden nicht so kombiniert, dass Differenzbildung kleine Zellen offenlegt.
8. Freitext gilt unabhängig von der Häufigkeit nicht allein durch Zählung als anonym. Originaltext wird nicht freigegeben.

Die Schwelle 5 ist eine Mindestregel. Bei kleinen, bekannten Lerngruppen oder auffälligen Kategorien kann auch eine größere Zelle erkennbar sein; dann wird weiter aggregiert oder nicht berichtet.

## 12. Aufbewahrungs- und Löschfristen

| Artefakt                                                             | Kursstandardfrist                                                                                        | Fristbeginn                                | Löschaktion                                                                                                                          |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| arsnova.eu-Sessiondaten auf der Plattform                            | regulär 24 Stunden bis zur Purge-Fälligkeit, technisch mit stündlichem Cleanup; mögliche Systemausnahmen | `FINISHED`/`endedAt`                       | Plattform-Cleanup; der Kurs dokumentiert nur die erwartete Systemfrist und behauptet keine Einzelverifikation ohne Betriebsnachweis. |
| Blitzlicht in Redis                                                  | ungefähr 30 Minuten ohne erneute Aktivität; bei ausdrücklichem Ende sofortige Löschung                   | letzte Aktivität beziehungsweise Endaktion | Aggregat sichern, Runde beenden, keine Rohkopie anlegen.                                                                             |
| RAW-Eingangsdownload ohne Freitext                                   | höchstens 48 Stunden im Eingang, insgesamt höchstens 7 Kalendertage                                      | Erhebungsende                              | nach Verarbeitung aus Eingang, Downloads, temporären Ordnern und Papierkorb löschen.                                                 |
| Q&A-CSV, Quizfreitext und freitextführende JASP-Datei                | höchstens 72 Stunden                                                                                     | Erhebungsende                              | nach Kategorisierung vollständig löschen.                                                                                            |
| Sonstige pseudonyme LIVE-Roh- und Betriebsdaten                      | höchstens 7 Kalendertage                                                                                 | Erhebungsende                              | alle CSV-, PDF-, Datenbank-, Export-, Arbeits- und JASP-Kopien löschen.                                                              |
| MC-Test-SQL-Dump oder kursisolierte SQLite-Kopie                     | im Regelbetrieb nicht erzeugen; falls vorhanden höchstens 7 Kalendertage, Incidentregel ausgenommen      | Export beziehungsweise Erhebungsende       | Dump löschen; bei Kursdatenbank DB, WAL und SHM kontrolliert entfernen oder Kurszeilen tabellenübergreifend purgen.                  |
| LIVE-ANON-Aggregate und interner Modulevaluationsbericht             | 12 Monate                                                                                                | offizielles Kursende                       | aus aktivem Speicher und Freigabebereich löschen.                                                                                    |
| REPO-Arbeitskopien                                                   | bis 12 Monate nach Kursende                                                                              | offizielles Kursende                       | lokale Kopie löschen; dauerhafte Quelle bleibt der versionierte Repositoryverweis.                                                   |
| Synthetische LEHRDATEN                                               | solange im aktiven Modul eingesetzt; jährliche Inhaltsprüfung                                            | letzter dokumentierter Einsatz             | weiterführen, wenn für den nächsten Moduldurchlauf freigegeben; andernfalls aus aktivem Kursmaterial entfernen.                      |
| Daten- und Löschprotokoll ohne Personen-, Session- oder Inhaltsdaten | 24 Monate                                                                                                | offizielles Kursende                       | nach Ablauf löschen.                                                                                                                 |
| Incident-Quarantäne                                                  | höchstens 72 Stunden ohne institutionelle Incident-Anordnung                                             | Erkennung                                  | löschen oder in den institutionell angeordneten Incidentprozess mit eigener Frist überführen.                                        |

## 13. Löschprotokoll

### 13.1 Ablauf

1. Das Datenregister erzeugt bei Aufnahme eines Artefakts sofort das verbindliche Löschdatum.
2. Die Datenkuratierung prüft am Löschtermin alle Speicherorte: Eingang, Arbeitsordner, JASP, Quarantäne, Downloads, temporäre Ordner, Papierkorb, Freigabelinks und lokale Synchronisationsreste.
3. JASP und betroffene Datenbankprozesse werden geschlossen, bevor eingebettete Daten oder SQLite-Dateien gelöscht werden.
4. Beim MC-Test wird nicht nur die Freigabe des Pseudonyms geprüft. Session-Summaries und alle kursbezogenen Tabellen müssen ebenfalls keine Kursdaten mehr enthalten.
5. Löschung auf verwaltetem Speicher erfolgt mit der vorgesehenen Löschfunktion. Eine physische Überschreibung von SSD-Speicher wird nicht behauptet; Schutz beruht zusätzlich auf Geräte- und Speicherverschlüsselung.
6. Institutionelle Backups werden nicht eigenmächtig verändert. Das Protokoll nennt den einschlägigen Backup-Löschzyklus.
7. Die Modulverantwortung prüft das Löschprotokoll innerhalb von zwei Arbeitstagen. Fehlgeschlagene oder unvollständige Löschungen werden als Incident behandelt.

### 13.2 Protokollfelder

Das Löschprotokoll enthält ausschließlich:

- `deletion_id`, `course_id`, `artifact_id`, `event_id`;
- Datenklasse und Artefaktgruppe;
- Frist, Ausführungszeit und Zeitzone;
- gelöschte Speicherbereiche als Kategorien;
- Methode `LOCAL_DELETE`, `MANAGED_STORAGE_DELETE`, `MC_COURSE_PURGE`, `DB_DISCARD` oder `PLATFORM_EXPECTED`;
- Ergebnis `SUCCESS`, `PARTIAL`, `FAILED` oder `NOT_VERIFIABLE`;
- ausführende und prüfende Rolle;
- Anzahl gelöschter Dateien oder Datensätze, soweit ohne Personenbezug bestimmbar;
- Backupzyklus-Vermerk;
- Incident-ID bei Abweichungen.

Nicht protokolliert werden Dateiinhalte, Pseudonyme, Sessioncodes, Fragentexte, lokale Benutzerpfade oder geheime Schlüssel.

## 14. Fehler- und Incident-Ablauf

### 14.1 Auslöser

Als Incident gelten insbesondere:

- Q&A- oder Freitext mit personenbezogenen, sensiblen oder vertraulichen Angaben;
- Versand oder Freigabe einer RAW-/WORK-Datei an unberechtigte Personen;
- Ablage in privater Cloud, Git, E-Mail, Messenger, externem LLM oder Web-Analysetool;
- Verlust eines Geräts oder Datenträgers mit Kursdaten;
- Veröffentlichung einer Kleinzelle oder rückrechenbaren Tabelle;
- fehlgeschlagene Löschung oder unerwartet fortbestehende MC-Test-Summaries;
- vollständiger Datenbankdump als unbeabsichtigter Ersatz für einen fehlgeschlagenen CSV-Export.

### 14.2 Verbindliche Reaktion

1. **Stoppen:** Export, Freigabe, Analyse und Synchronisierung sofort anhalten.
2. **Eindämmen:** Freigabelink sperren, Empfängerkreis feststellen, lokale Anwendung schließen und betroffene Datei in `90_quarantaene_restricted` verschieben. Keine zusätzlichen Inhaltskopien zur Beweissicherung erzeugen.
3. **Informieren:** Modulverantwortung und institutionelle Informationssicherheits-/Datenschutzstelle unverzüglich über den vorgesehenen Meldeweg informieren. Die institutionelle Stelle entscheidet über weitere rechtliche oder externe Meldungen.
4. **Minimal dokumentieren:** Incident-ID, Zeitpunkt, Datenklasse, betroffene Systeme, ungefährer Umfang, Empfängerkreis und Eindämmungsaktion erfassen; keine Freitextinhalte in das Incidentprotokoll kopieren.
5. **Bewerten und beheben:** Zugriff entziehen, korrigierte ANON-APPROVED-Fassung erzeugen oder Daten löschen. Empfänger einer Fehlfreigabe werden über den institutionellen Kanal zur Löschung aufgefordert.
6. **Fristen steuern:** Ohne institutionelle Aufbewahrungsanordnung wird Quarantäne spätestens nach 72 Stunden gelöscht. Eine angeordnete Incidentaufbewahrung erhält einen eigenen Zweck, Zugriff und Löschtermin.
7. **Abschließen:** Löschung oder kontrollierte Übergabe wird durch die zweite Rolle geprüft; Ursache und präventive Kursmaßnahme werden ohne Personenbezug dokumentiert.

### 14.3 Technische Fehler ohne Datenabfluss

- **arsnova.eu-Export fehlt:** Innerhalb des Nachlaufs einmal mit gültigem Hostzugriff wiederholen. Nach Purge keine Personen-Rohdaten rekonstruieren und keinen Admin-/Legal-Hold-Prozess für Lehrzwecke auslösen; Datenlücke dokumentieren.
- **PDF-Erzeugung scheitert:** Session-CSV sichern und den vorgesehenen Browser-Druckfallback verwenden. Keine Bildschirmserie mit Hostdaten anlegen.
- **Q&A-CSV fehlt:** Nur solange die vollständige Hostliste noch autorisiert verfügbar ist erneut exportieren. Der reduzierte Q&A-Block im Sessionexport wird als unvollständig gekennzeichnet, nicht als Vollmetrik ausgegeben.
- **CSV ist beschädigt:** Prüfsumme und unveränderte Quelle bewahren, solange die jeweilige Rohdatenfrist läuft; neuen Export als neue Version registrieren. Keine stillen Zellkorrekturen.
- **JASP-Import ist falsch typisiert:** Importparameter korrigieren und neue Version erzeugen; Quelle unverändert lassen und die fehlerhafte Arbeitsdatei löschen.
- **MC-Test ist gesperrt oder Export schlägt fehl:** Fehlerzeit und Fragenset dokumentieren, Plattformbetrieb informieren und keinen vollständigen SQL-Dump als Workaround herunterladen.

## 15. Freigabecheckliste

Eine Datei oder Abbildung erhält nur dann `ANON-APPROVED`, `SYNTHETIC-APPROVED` oder `PUBLIC-REPO`, wenn jede folgende Aussage nachweislich zutrifft:

### Zweck und Herkunft

- Der konkrete Lehr- oder interne Evaluationszweck ist im Datenregister eingetragen.
- LIVE, REPO oder LEHRDATEN ist korrekt angegeben; synthetische Daten werden sichtbar so bezeichnet.
- Beobachtungseinheit, Zeitraum, Item, Aggregationsrunde und Nenner sind eindeutig.
- Die Aussage bleibt innerhalb von Lehre und interner Modulevaluation.

### Inhalt

- Es sind keine Namen, Pseudonyme, Hashes, IDs, Sessioncodes, Bonuscodes, Tokens, exakten personenbezogenen Zeitstempel oder privaten Dateipfade enthalten.
- Es sind keine Q&A-, Feedback- oder sonstigen Originalfreitexte enthalten.
- Personen-Rohwerte und vollständige Paartabellen stammen nicht aus einem arsnova.eu-Standardexport.
- Für Analysen mit Einzelwerten oder Paaren werden freigegebene LEHRDATEN verwendet.
- Alle sichtbaren Zellen erfüllen die Mindestgröße 5; komplementäre und differenzielle Rückrechnung ist ausgeschlossen.
- Fehlende und systemseitig unterdrückte Werte sind nicht als Nullwerte dargestellt.

### Analyse und Darstellung

- Die JASP-Version, Importparameter, Filter, Ausschlüsse und Umkodierungen sind dokumentiert.
- Effektive Runde, MC-Mehrfachnennungen und unterschiedliche Nenner sind fachlich korrekt behandelt.
- Titel, Achsen, Einheiten, Legenden und Herkunftshinweis sind vollständig.
- PDF-, PNG- und Dokumenteigenschaften enthalten keine Personen- oder Geräteangaben.
- Die Freigabedatei wurde aus einer minimalen ANON-APPROVED- oder SYNTHETIC-APPROVED-Quelle neu erzeugt.

### Zugriff, Frist und Prüfung

- Zielgruppe und Freigabeordner sind korrekt; RAW- und WORK-Dateien bleiben ausgeschlossen.
- Das Löschdatum ist gesetzt und mit dem Datenregister konsistent.
- Die Datenkuratierung hat die Prüfung ausgeführt.
- Die Modulverantwortung hat die Freigabe bestätigt.

Fehlt eine Bestätigung, wird nicht freigegeben. Es gibt keine Freigabe „unter Vorbehalt“.

## 16. Technische Belegstellen

Die operativen Regeln wurden gegen folgende aktuelle Repositoryquellen geprüft:

- [Dokumentationslandkarte](../../README.md)
- [Funktionsübersicht: Datenhaltung und Lebenszyklus](../../APP-FUNKTIONSUEBERSICHT.md)
- [Deutsche Datenschutzhinweise der Anwendung](../../../apps/frontend/src/assets/legal/privacy.de.md)
- [Session-Ergebnisbericht und Exportwege](../../features/session-export-pdf.md)
- [Confidence-Aggregation und Unterdrückung kleiner Fallzahlen](../../features/confidence-slider.md)
- [Host-Härtung und besitzgebundene Zugriffe](../../architecture/decisions/0019-host-hardening-and-owner-bound-session-access.md)
- [Session-Cleanup im Backend](../../../apps/backend/src/lib/sessionCleanup.ts)
- [Blitzlicht-TTL und Löschung](../../../apps/backend/src/routers/quickFeedback.ts)
- [Aggregierter Session-Export im Backend](../../../apps/backend/src/routers/session.ts)
- [Shared Exportvertrag](../../../libs/shared-types/src/schemas.ts)
- [Q&A-CSV in der Hostansicht](../../../apps/frontend/src/app/features/session/session-host/session-host.component.ts)
- [Exportdateinamen](../../../apps/frontend/src/app/core/export-filename.util.ts)
- [Datenmodell und Kaskaden](../../../prisma/schema.prisma)

Die technische Plattforminstanz ist vor jedem Moduldurchlauf erneut auf Exportwege und Fristen zu prüfen. Maßgeblich für die Kursarbeit bleibt: Exporte sofort sichern, Vollmetriken für Q&A separat exportieren, keine Personen-Rohwerte oder Paare aus Aggregaten ableiten und pseudonyme Arbeitsdaten spätestens nach sieben Tagen löschen.
