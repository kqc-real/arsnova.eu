# P0-03 – ARSnova-Livequiz-Blueprint für 10 Wochen

**Version:** 1.1.0 · **Stand:** 13.09.2026 · **Status:** normative Spezifikation für den synchronen Pilotbetrieb

**Kanonischer Index:** [P0-03_Materialpaket_Pilotlauf.md](./P0-03_Materialpaket_Pilotlauf.md)

## 1. Verbindlicher Einsatzrahmen

Der Pilot verwendet ARSnova.eu synchron zur anonymen Diagnose und zur lernorientierten Peer Instruction. Die zehn Wochen-Dateien enthalten zusammen 50 Livefragen:

|     Woche | Fragen | Datei                                                        |
| --------: | -----: | ------------------------------------------------------------ |
|       W01 |      5 | [P0-03_ARSnova_Woche_01.json](./P0-03_ARSnova_Woche_01.json) |
|       W02 |      5 | [P0-03_ARSnova_Woche_02.json](./P0-03_ARSnova_Woche_02.json) |
|       W03 |      5 | [P0-03_ARSnova_Woche_03.json](./P0-03_ARSnova_Woche_03.json) |
|       W04 |      4 | [P0-03_ARSnova_Woche_04.json](./P0-03_ARSnova_Woche_04.json) |
|       W05 |      5 | [P0-03_ARSnova_Woche_05.json](./P0-03_ARSnova_Woche_05.json) |
|       W06 |      5 | [P0-03_ARSnova_Woche_06.json](./P0-03_ARSnova_Woche_06.json) |
|       W07 |      5 | [P0-03_ARSnova_Woche_07.json](./P0-03_ARSnova_Woche_07.json) |
|       W08 |      5 | [P0-03_ARSnova_Woche_08.json](./P0-03_ARSnova_Woche_08.json) |
|       W09 |      5 | [P0-03_ARSnova_Woche_09.json](./P0-03_ARSnova_Woche_09.json) |
|       W10 |      6 | [P0-03_ARSnova_Woche_10.json](./P0-03_ARSnova_Woche_10.json) |
| **Summe** | **50** |                                                              |

Der Bestand umfasst 47 Pflichtkernfragen und drei optionale Vertiefungsfragen. Je nach Gate-Entscheidung werden 47–50 Fragen eingesetzt; auch beim Überspringen aller Vertiefungen verbleiben in jeder Woche 4–6 und damit mindestens 3 Livefragen. Wird ein Wochenblock auf mehrere Präsenztage verteilt, werden diese Fragen auf die Termine verteilt; die Zahl wird nicht pro Termin erneut angesetzt.

### 1.1 Nicht-Spiel-Konfiguration

Der in der Anforderung verkürzt als „anonymMode“ bezeichnete Import-Schalter heißt im aktuellen ARSnova-Exportvertrag technisch **`anonymousMode`**. Jede P0-Datei verwendet:

```json
{
  "showLeaderboard": false,
  "allowCustomNicknames": false,
  "defaultTimer": null,
  "timerScaleByDifficulty": false,
  "enableTimerAccommodation": true,
  "enableSoundEffects": false,
  "enableRewardEffects": false,
  "enableMotivationMessages": false,
  "enableEmojiReactions": false,
  "anonymousMode": true,
  "teamMode": false,
  "teamCount": null,
  "teamAssignment": "AUTO",
  "backgroundMusic": null,
  "nicknameTheme": "HIGH_SCHOOL",
  "bonusTokenCount": null,
  "readingPhaseEnabled": true
}
```

Zusätzlich gilt für jede Frage `timer=null`. Rangliste, Timer, Teamwertung, Belohnung und Bonus sind im gesamten P0-Pilot deaktiviert. Das Vertiefungsgate aus Abschnitt 3.5 ändert keine dieser Einstellungen. Ein späterer Spielmodus müsste als eigenständige, ausdrücklich mit `SPIEL` benannte Paketrevision konzipiert und separat abgenommen werden; er wird nicht durch Änderung einer dieser Diagnosedateien aktiviert.

### 1.2 Didaktische und datenschutzbezogene Grenzen

- Teilnahme ist freiwillig, anonym dargestellt und ohne Notennachteil.
- Ergebnisse steuern die Lehre; Quizpunkte, Rang und Antwortgeschwindigkeit sind keine Lernstandskennzahlen.
- SURVEY/Blitzlicht erhebt Selbstauskunft ohne richtige Lösung.
- Confidence ist ordinal, antwortbezogen und optional; bei aktivierter Abfrage gibt es eine gleichwertige Alternative ohne Confidence.
- LIVE-Daten werden bevorzugt aggregiert und immer mit Nenner berichtet.
- Die Fragewand Q&A darf während der Sitzung geöffnet bleiben, zählt aber nicht zu den 3–6 Livequizfragen. Freitext wird vor jeder Lehrnutzung geprüft und nicht ungefiltert exportiert.
- Die Nutzung dient ausschließlich der Lehre und der internen Modulverbesserung.

## 2. IDs, Reihenfolge und Revision

### 2.1 Redaktionelle IDs

Die ID hat die Form `P0-03-ARS-WNN-LNN`.

- `WNN`: Woche `W01` bis `W10`
- `LNN`: Livefrage `L01` bis maximal `L06`
- Beispiel: `P0-03-ARS-W06-L03`

Die ARSnova-Importdatei verwendet eine nullbasierte `order`: `L01` entspricht `order=0`, `L02` entspricht `order=1` usw. Die App erzeugt beim Import technische Frage-UUIDs. Diese UUIDs sind nicht die redaktionellen IDs und werden nach einem Neuimport nicht als stabil vorausgesetzt. Für Lehrsteuerung und Exportzuordnung sind Wochen-Datei, Paketversion und `order` maßgeblich.

Nicht unterstützte Zusatzfelder wie eine frei erfundene `id` werden dem Import-JSON nicht hinzugefügt. Die redaktionelle Zuordnung bleibt im Blueprint, im Fragen-Review und in der bereinigten Lehrauswertung dokumentiert.

### 2.2 Revisionsregel

- Sprachliche Korrektur ohne Bedeutungsänderung: Dokument-/Paketversion und registrierte JSON-Prüfsumme erhöhen; redaktionelle ID bleibt.
- Änderung von richtiger Lösung, Referenzwert, Toleranzband, Lernziel oder geprüftem Inhalt: neue redaktionelle ID mit Suffix `-R2` im Review- und Datenregister.
- Nach realem Einsatz wird die verwendete JSON-Fassung über ihre Prüfsumme nachweisbar gehalten; eine neue Fassung wird als neuer Lauf importiert.
- Exporte verschiedener Revisionen oder Läufe werden nie ohne sichtbare Revisions-/Laufvariable zusammengeführt. Dem Import-JSON werden dafür keine vom aktuellen Schema unbekannten Felder hinzugefügt.

## 3. Kodierung der Verteilungen

### 3.1 Modus und Fragetyp

| Code             | Bedeutung                                                                            |
| ---------------- | ------------------------------------------------------------------------------------ |
| D                | Diagnose: in der Regel eine Runde; Fehlvorstellung und n sichtbar machen             |
| L                | Lernen: erste Antwort, Begründung/Peer-Austausch, zweite Runde oder Transferfrage    |
| SURVEY           | unbewertete Selbstauskunft ohne richtige Lösung                                      |
| SINGLE_CHOICE    | genau eine fachlich richtige Option                                                  |
| MULTIPLE_CHOICE  | mehrere mögliche richtige Optionen; vollständige Auswahlregel erklären               |
| NUMERIC_ESTIMATE | Schätzung mit vorab festgelegter Referenz, Einheit, Plausibilitäts- und Toleranzband |

### 3.2 Lernziele, Bloom und Schwierigkeit

Die Lernzielcodes `LI01`–`LI24` entsprechen der vollständigen Lernzielmatrix in [P0-01](./P0-01_Kerncurriculum_Lernzielmatrix.md#6-vollständige-lernzielmatrix); der MC-Blueprint verwendet dieselben Codes.

- Bloom: `B1` Erinnern, `B2` Verstehen, `B3` Anwenden, `B4` Analysieren/Beurteilen.
- Schwierigkeit: `E` Basis, `M` Standard, `H` Transfer/Fehlerdiagnose.

### 3.3 Retrieval

Jede Frage hat genau eine primäre Retrieval-Rolle:

- `AKT`: aktueller Schwerpunkt,
- `RET`: frühere Woche,
- `MIS`: gezielte Fehlvorstellung,
- `TRF`: Transfer/klausurnahe Integration.

### 3.4 QA-Verteilung

`QA` bedeutet in diesem Abschnitt **Qualitätssicherung**, nicht die ARSnova-Fragewand Q&A. Jede Frage durchläuft die technische Basisprüfung: importierbares JSON, richtige Reihenfolge, lösbarer Schlüssel, keine Lösung im Teilnehmer-Fragenstamm, barrierearme Darstellung und Nicht-Spiel-Einstellungen. Zusätzlich erhält jede Frage genau eine höchste Risikoprüfung:

| Code | Zusätzliche Prüfung                                                             |
| ---- | ------------------------------------------------------------------------------- |
| QA-F | unabhängige Fach-/Didaktikprüfung von Aussage, Distraktoren und Fehlvorstellung |
| QA-R | unabhängige Rechen-, Quellen- oder JASP-Reproduktion                            |
| QA-P | Datenschutz-/Zweckbindungsprüfung für LIVE-, Confidence- oder SURVEY-Daten      |

Die QA-Verteilung jeder Woche summiert sich auf den vollständigen Fragenbestand ihrer JSON-Datei. Eine nach Abschnitt 3.5 nicht eingesetzte Vertiefungsfrage bleibt fachlich und technisch geprüft, zählt im konkreten Wochenlauf aber nicht zu den gestellten Livefragen.

### 3.5 Curricularer Status und Vertiefungsgate

Die Spalte **Status** in Abschnitt 4 trennt den summativ prüfbaren **Pflichtkern** von den optionalen Vertiefungen V1–V6 aus [P0-01](./P0-01_Kerncurriculum_Lernzielmatrix.md#22-vertiefung-und-arsnova-spezifischer-transfer). Eine Vertiefungsfrage begründet weder ein zusätzliches Lernziel noch eine Prüfungsanforderung. Sie darf keine Pflichtkernzeit ersetzen.

Das Gate ist eine Lehrregel für die anonyme Gruppe und kein App-Schalter:

1. Vor einer Vertiefungsfrage müssen alle in der folgenden Tabelle genannten Kernfragen beziehungsweise Kern-Kurzchecks abgeschlossen und mit mindestens einer gültigen Antwort ausgewertet sein.
2. Für jeden genannten Kernindikator wird aus der letzten abgeschlossenen Runde vor der Vertiefung berechnet:

   \[
   \text{Kernquote}=\frac{\text{Anzahl vollständig richtiger Kernantworten}}{\text{Anzahl gültiger Kernantworten}}.
   \]

   Für ARSnova-Fragen entsprechen diese Anzahlen `correct_count` und `n_responses`. Bei Multiple Choice zählt nur die vollständig richtige Auswahl; bei numerischen Schätzungen zählt ein Wert im vorab festgelegten Toleranzintervall als richtig.

3. Das Gate ist nur offen, wenn **jede** Kernquote mindestens 67 % beträgt und in keiner Kernfrage eine dominante Fehlvorstellung vorliegt. Dominant ist eine falsche Antwortoption, die mindestens 33 % der gültigen Antwortenden gewählt haben; bei Multiple Choice wird jede falsche Option einzeln geprüft. Eine numerische Schätzung ohne Antwortoptionen trägt nur zur Kernquote bei.
4. Fehlt ein Ergebnis oder ist eine der beiden Bedingungen nicht erfüllt, bleibt das Gate geschlossen. Die Vertiefungsfrage wird nicht geöffnet; stattdessen folgt die festgelegte Kernhandlung im selben Zeitfenster.

Die 67-%-Schwelle steuert ausschließlich die weitere Lehre. Sie ist keine Bestehensgrenze, keine individuelle Note und kein Kompetenzurteil. Auch bei offenem Gate bleiben Rangliste, Timer, Teamwertung, Belohnung und Bonus deaktiviert.

#### 3.5.1 Betroffene Fragen im vorhandenen JSON-Bestand

| Vertiefung | Vorhandene Livefrage                             | Einordnung                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1         | `P0-03-ARS-W06-L04`, `order=3`                   | Wilson-Untergrenze als Rankingsignal; optional und nicht summativ prüfbar.                                                                                                                                        |
| V2         | `P0-03-ARS-W03-L04`, `order=3`                   | nullbasierte ARSnova-Indexregel für Quartile; optional und nicht summativ prüfbar.                                                                                                                                |
| V3         | keine                                            | Macro-F1 kommt in keiner vorhandenen Livefrage vor und wird im P0-Livequiz nicht ergänzt.                                                                                                                         |
| V4         | `P0-03-ARS-W09-L05`, `order=4`                   | Coverage und Entscheidungsschwelle; optional und nicht summativ prüfbar.                                                                                                                                          |
| V5         | keine                                            | Modellkalibrierung kommt in keiner vorhandenen Livefrage vor. `P0-03-ARS-W10-L03`, `order=2`, prüft trotz der JSON-Überschrift ausschließlich die Pflichtkern-Interpretation eines Konfidenzintervalls nach LI14. |
| V6         | `P0-03-ARS-W09-L05`, `order=4`, gemeinsam mit V4 | vorbereiteter Q&A-Systemvergleich; optional und nicht summativ prüfbar.                                                                                                                                           |

Die Q&A-Kontexte in `P0-03-ARS-W04-L04`, `P0-03-ARS-W09-L03` und `P0-03-ARS-W09-L04` sind keine Vertiefung V6: Alle benötigten Zahlen stehen in der Aufgabe, und geprüft werden ausschließlich Pflichtkernhandlungen zu bedingten Anteilen, binärer Confusion Matrix und Fehlkosten. Ebenso ist die Erwähnung einer Entscheidungsschwelle als mögliches Risiko in `P0-03-ARS-W09-L02` keine Vertiefung V4; dort wird ausschließlich die Trennung von Training und Test beurteilt. `P0-03-ARS-W06-L05` bleibt ebenfalls Pflichtkern: Die Frage beurteilt die einfache Wald-Lehrregel und verwendet ein bereitgestelltes Wilson-Intervall nur als Alternative, nicht als Rankingsignal.

#### 3.5.2 Gate-Zuordnung und Ersatzhandlungen

| Betroffene Frage          | Zu sichernder Pflichtkern und Kernfragen                                                                                               | Handlung bei geschlossenem Gate                                                                                                                                                                                                                               | Erhalt von Fragenzahl und UE                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `P0-03-ARS-W03-L04` V2    | LI07 aus `KQ-W03`: \(Q_1=5\) und \(Q_3=15\) sind vorgegeben; richtig sind \(IQR=10\) und »die mittleren 50 % liegen zwischen 5 und 15« | L04 überspringen. Die Lehrperson löst den Kurzcheck schrittweise auf; anschließend deutet die Gruppe einen Boxplot mit den vorgegebenen Quartilen und rechnet ein zweites IQR-Beispiel, ohne eine app-spezifische Indexregel anzuwenden.                      | 4 Livefragen bleiben; W03 umfasst unverändert UE 10–14. |
| `P0-03-ARS-W06-L04` V1    | LI13 aus `W06-L01`; LI14 gemeinsam aus `W06-L02` und `W06-L03`                                                                         | L04 überspringen. Stattdessen vergleicht die Gruppe bei gleichem Anteil von 71,2 % die vorgegebenen Intervalle \([0{,}58;0{,}82]\) und \([0{,}67;0{,}75]\), begründet die unterschiedliche Präzision und trennt sie von Repräsentativität.                    | 4 Livefragen bleiben; W06 umfasst unverändert UE 25–29. |
| `P0-03-ARS-W09-L05` V4/V6 | LI20 gemeinsam aus `W09-L01` und `W09-L02`; LI21 gemeinsam aus `W09-L03` und `W09-L04`; LI22 aus `KQ-W09`                              | L05 überspringen. Die Lehrperson löst zuerst den LI22-Kurzcheck auf. Danach berechnet die Gruppe aus \(TP=42\), \(FN=8\), \(FP=18\) und \(TN=132\) den binären F1-Score von rund 76,4 % und begründet anhand der vorgegebenen Fehlkosten die Wahl von Recall. | 4 Livefragen bleiben; W09 umfasst unverändert UE 40–44. |

Der Kern-Kurzcheck `KQ-W03` wird unmittelbar vor L04 anonym mit Antwortkarten durchgeführt. Die Optionen lauten: A »\(IQR=10\); die mittleren 50 % liegen zwischen 5 und 15« (richtig), B »\(IQR=20\), weil \(Q_1+Q_3\) gerechnet wird«, C »\(IQR=15\), weil \(Q_3\) bereits die Breite angibt« und D »\(IQR=10\); die mittleren 50 % liegen außerhalb von 5 bis 15«. Die Lehrperson notiert richtige Antworten und Optionshäufigkeiten im Offline-Zählbogen. Der Kurzcheck ist kein JSON-Item und zählt nicht als zusätzliche Livefrage.

Der Kern-Kurzcheck `KQ-W09` wird unmittelbar vor L05 auf dieselbe Weise durchgeführt. Gegeben sind: »Das Modell gibt für Fall A den Wert 0,80 aus. Unter 100 vergleichbaren Fällen wurden 74 positive Ergebnisse beobachtet. Fall A wurde anschließend geprüft und ist negativ.« Die Optionen lauten: A »0,80 ist der Modellwert, 74/100 der beobachtete Gruppenanteil und negativ das beobachtete Einzelergebnis« (richtig), B »0,80 beweist ein positives Einzelergebnis«, C »74/100 ist der sichere Modellwert von Fall A« und D »Das negative Einzelergebnis beweist, dass jeder Modellwert unbrauchbar ist«. Auch dieser Kurzcheck ist kein JSON-Item und zählt nicht als zusätzliche Livefrage.

V3 und V5 sind im P0-Livequiz mangels vorhandener Livefrage nicht vorgesehen. Für sie entsteht weder eine Ersatzfrage noch zusätzliche Präsenzzeit. Insgesamt bleiben die in P0-01 festgelegten 48 UE unverändert.

## 4. Konkrete Fragenpläne und Wochenverteilungen

### W01 – Statistisches Denken, Daten und Messung

**Datei:** [P0-03_ARSnova_Woche_01.json](./P0-03_ARSnova_Woche_01.json)

| ID                | Modus/Typ         | Konkreter Gegenstand und Sollreaktion                                                                         | LI   | Bloom/Schwierigkeit | Retrieval | QA   | Status      |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------------- | ---- | ------------------- | --------- | ---- | ----------- |
| P0-03-ARS-W01-L01 | D/SINGLE_CHOICE   | Beobachtungseinheit einer Antworttabelle als eine abgegebene Antwort erkennen.                                | LI01 | B2/E                | AKT       | QA-F | Pflichtkern |
| P0-03-ARS-W01-L02 | L/MULTIPLE_CHOICE | Bei 42 von 60 Antwortenden nur Aussagen mit korrekter Bezugsgruppe und ohne Nonresponse-Unterstellung wählen. | LI04 | B4/M                | TRF       | QA-P | Pflichtkern |
| P0-03-ARS-W01-L03 | L/MULTIPLE_CHOICE | Antwortoption, Confidence, Bearbeitungsdauer und Session-Code den zulässigen Skalen zuordnen.                 | LI02 | B3/M                | AKT       | QA-F | Pflichtkern |
| P0-03-ARS-W01-L04 | L/MULTIPLE_CHOICE | Netzwerk, Gerät, Leseweg und Missingness als Einwände gegen „schneller = kompetenter“ erkennen.               | LI03 | B4/H                | MIS       | QA-R | Pflichtkern |
| P0-03-ARS-W01-L05 | D/SURVEY          | Schwerpunkt für das nächste Gegenbeispiel wählen; keine richtige Antwort und keine Lösungsquote.              | LI23 | B2/E                | AKT       | QA-P | Pflichtkern |

- **Themen:** Beobachtungseinheit=1, Stichprobe/Nonresponse=1, Skalen=1, Messproblem Antwortzeit=1, Steuerungs-SURVEY=1.
- **Lernziele:** LI01=1, LI02=1, LI03=1, LI04=1, LI23=1.
- **Schwierigkeit:** E=2, M=2, H=1. **Bloom:** B1=0, B2=2, B3=1, B4=2.
- **Retrieval:** AKT=3, RET=0, MIS=1, TRF=1. **QA:** QA-F=2, QA-R=1, QA-P=2.

### W02 – Häufigkeiten, Diagramme und Lage

**Datei:** [P0-03_ARSnova_Woche_02.json](./P0-03_ARSnova_Woche_02.json)

| ID                | Modus/Typ          | Konkreter Gegenstand und Sollreaktion                                                            | LI   | Bloom/Schwierigkeit | Retrieval | QA   | Status      |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------ | ---- | ------------------- | --------- | ---- | ----------- |
| P0-03-ARS-W02-L01 | D/SINGLE_CHOICE    | 24 von 36 abgegebenen Antworten als 66,7 % mit Antwortenden als Nenner berechnen.                | LI05 | B3/E                | AKT       | QA-R | Pflichtkern |
| P0-03-ARS-W02-L02 | L/MULTIPLE_CHOICE  | Mehrfachnennungen korrekt lesen und Summen über 100 % nicht als Fehler behandeln.                | LI05 | B4/M                | MIS       | QA-F | Pflichtkern |
| P0-03-ARS-W02-L03 | L/NUMERIC_ESTIMATE | Mittelwert der 20 S1-Servicezeiten schätzen; Referenz 120 s bleibt bis zur Auswertung verborgen. | LI07 | B3/M                | AKT       | QA-R | Pflichtkern |
| P0-03-ARS-W02-L04 | L/SINGLE_CHOICE    | Für 4, 5, 5, 6 und 40 s Median statt Mittelwert als robustere typische Lage wählen.              | LI08 | B4/M                | TRF       | QA-F | Pflichtkern |
| P0-03-ARS-W02-L05 | L/MULTIPLE_CHOICE  | Balkendiagramm für Kategorien und Histogramm für metrische Servicezeiten begründet zuordnen.     | LI06 | B4/H                | RET       | QA-F | Pflichtkern |

- **Themen:** Nenner=1, Mehrfachnennungen=1, Mittelwertschätzung=1, Robustheit=1, Diagrammwahl=1.
- **Lernziele:** LI05=2, LI06=1, LI07=1, LI08=1.
- **Schwierigkeit:** E=1, M=3, H=1. **Bloom:** B1=0, B2=0, B3=2, B4=3.
- **Retrieval:** AKT=2, RET=1, MIS=1, TRF=1. **QA:** QA-F=3, QA-R=2, QA-P=0.

Für L03 sind Einheit, Referenzwert, Plausibilitätsgrenzen und Toleranzband im JSON und Review festgelegt. Das Toleranzband bewertet die Schätzung und wird niemals als Konfidenzintervall bezeichnet.

### W03 – Streuung, Quantile und Ausreißer

**Datei:** [P0-03_ARSnova_Woche_03.json](./P0-03_ARSnova_Woche_03.json)

| ID                | Modus/Typ          | Konkreter Gegenstand und Sollreaktion                                                            | LI   | Bloom/Schwierigkeit | Retrieval | QA   | Status        |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------ | ---- | ------------------- | --------- | ---- | ------------- |
| P0-03-ARS-W03-L01 | L/NUMERIC_ESTIMATE | Dieselben 20 S1-Servicezeiten in anderer Reihenfolge erneut auf Mittelwert 120 s schätzen.       | LI07 | B3/M                | RET       | QA-R | Pflichtkern   |
| P0-03-ARS-W03-L02 | D/SINGLE_CHOICE    | Zwei Datensätze mit Mittelwert 120, aber deutlich unterschiedlicher Streuung vergleichen.        | LI07 | B2/E                | AKT       | QA-F | Pflichtkern   |
| P0-03-ARS-W03-L03 | L/MULTIPLE_CHOICE  | Bei Quadratsumme 1.000 für fünf Werte Division durch n und n−1 berechnen und korrekt benennen.   | LI07 | B4/H                | MIS       | QA-R | Pflichtkern   |
| P0-03-ARS-W03-L04 | L/SINGLE_CHOICE    | Q1 und Q3 nach der ausdrücklich angegebenen nullbasierten Indexregel bestimmen.                  | —    | B3/M                | AKT       | QA-R | Vertiefung V2 |
| P0-03-ARS-W03-L05 | L/MULTIPLE_CHOICE  | p95=121 ms, p99=1,22 s und max=6,6 s im dokumentierten lokalen Lastfall begrenzt interpretieren. | LI07 | B4/H                | TRF       | QA-R | Pflichtkern   |

- **Pflichtkern-Themen:** Schätzung=1, Streuungsvergleich=1, Varianzkonvention=1, Latenzquantile=1. **Vertiefung:** V2 app-spezifische Quartilregel=1.
- **Pflichtkern-Lernziele:** LI07=4. Die Vertiefung begründet kein zusätzliches Lernziel.
- **Schwierigkeit:** E=1, M=2, H=2. **Bloom:** B1=0, B2=1, B3=2, B4=2.
- **Retrieval:** AKT=2, RET=1, MIS=1, TRF=1. **QA:** QA-F=1, QA-R=4, QA-P=0.

L05 ist ein fixierter REPO-Fall; aus den drei Kennzahlen werden keine Rohrequests, Mittelwerte oder Boxplots rekonstruiert.

### W04 – Wahrscheinlichkeit und bedingte Wahrscheinlichkeit

**Datei:** [P0-03_ARSnova_Woche_04.json](./P0-03_ARSnova_Woche_04.json)

| ID                | Modus/Typ                        | Konkreter Gegenstand und Sollreaktion                                                              | LI   | Bloom/Schwierigkeit | Retrieval | QA   | Status      |
| ----------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- | ---- | ------------------- | --------- | ---- | ----------- |
| P0-03-ARS-W04-L01 | D/SINGLE_CHOICE                  | Wahrscheinlichkeit für genau einmal Kopf bei zwei fairen Würfen bestimmen.                         | LI09 | B3/E                | AKT       | QA-R | Pflichtkern |
| P0-03-ARS-W04-L02 | L/SINGLE_CHOICE                  | Für zwei idealisiert unabhängige Serviceschritte 0,9·0,9 berechnen und Annahme nennen.             | LI09 | B3/M                | RET       | QA-R | Pflichtkern |
| P0-03-ARS-W04-L03 | L/MULTIPLE_CHOICE mit Confidence | Aus der eingebetteten 2×3-Tafel Rand- und bedingte Anteile mit richtigem Nenner wählen.            | LI10 | B4/M                | MIS       | QA-P | Pflichtkern |
| P0-03-ARS-W04-L04 | L/MULTIPLE_CHOICE                | Bei 50 technischen unter 1.000 Fragen Treffer-, Markierungs- und Basisraten korrekt unterscheiden. | LI10 | B4/H                | TRF       | QA-F | Pflichtkern |

- **Themen:** Münzwurf=1, Multiplikation/Unabhängigkeit=1, Bedingung/Confidence=1, Basisrate=1.
- **Lernziele:** LI09=2, LI10=2.
- **Schwierigkeit:** E=1, M=2, H=1. **Bloom:** B1=0, B2=0, B3=2, B4=2.
- **Retrieval:** AKT=1, RET=1, MIS=1, TRF=1. **QA:** QA-F=1, QA-R=2, QA-P=1.

Die in L03 eingebettete Tabelle ist ein eigenständiger Lehrfall und nicht der S2-CSV-Export. Confidence 1–2/3/4–5 bleibt die verbindliche Gruppierung für die JASP-Übung; kleine LIVE-Zellen werden nach P0-02 geschützt.

### W05 – Zufallsvariablen, Verteilungen und Stichprobenvariabilität

**Datei:** [P0-03_ARSnova_Woche_05.json](./P0-03_ARSnova_Woche_05.json)

| ID                | Modus/Typ         | Konkreter Gegenstand und Sollreaktion                                                                          | LI   | Bloom/Schwierigkeit | Retrieval | QA   | Status      |
| ----------------- | ----------------- | -------------------------------------------------------------------------------------------------------------- | ---- | ------------------- | --------- | ---- | ----------- |
| P0-03-ARS-W05-L01 | D/SINGLE_CHOICE   | Anzahl korrekter Antworten als diskret und Antwortdauer als stetig einordnen.                                  | LI11 | B2/E                | AKT       | QA-F | Pflichtkern |
| P0-03-ARS-W05-L02 | L/MULTIPLE_CHOICE | Binomialbedingungen für zehn Concept Questions prüfen und unterschiedliche p als mögliche Verletzung erkennen. | LI11 | B4/M                | MIS       | QA-F | Pflichtkern |
| P0-03-ARS-W05-L03 | L/SINGLE_CHOICE   | Bei rechtsschiefen Servicezeiten eine Normalverteilung nicht automatisch voraussetzen.                         | LI11 | B4/M                | RET       | QA-F | Pflichtkern |
| P0-03-ARS-W05-L04 | L/SINGLE_CHOICE   | Standardfehler bei σ=20 für n=25 und n=100 vergleichen.                                                        | LI12 | B3/H                | AKT       | QA-R | Pflichtkern |
| P0-03-ARS-W05-L05 | L/MULTIPLE_CHOICE | Aus wiederholten Stichproben zulässige Aussagen zu Variabilität, n und Zielpopulation auswählen.               | LI12 | B4/H                | TRF       | QA-R | Pflichtkern |

- **Themen:** Variablentyp=1, Binomialmodell=1, Normalmodell=1, Standardfehler=1, Stichprobensimulation=1.
- **Lernziele:** LI11=3, LI12=2.
- **Schwierigkeit:** E=1, M=2, H=2. **Bloom:** B1=0, B2=1, B3=1, B4=3.
- **Retrieval:** AKT=2, RET=1, MIS=1, TRF=1. **QA:** QA-F=3, QA-R=2, QA-P=0.

Die Stichprobensimulation läuft außerhalb von ARSnova; ARSnova sammelt nur Entscheidungen. Für JASP dienen feste LEHRDATEN-Resamples, nicht nachträglich ausgewählte LIVE-Stichproben.

### W06 – Schätzen und Konfidenzintervalle

**Datei:** [P0-03_ARSnova_Woche_06.json](./P0-03_ARSnova_Woche_06.json)

| ID                | Modus/Typ         | Konkreter Gegenstand und Sollreaktion                                                              | LI   | Bloom/Schwierigkeit | Retrieval | QA   | Status        |
| ----------------- | ----------------- | -------------------------------------------------------------------------------------------------- | ---- | ------------------- | --------- | ---- | ------------- |
| P0-03-ARS-W06-L01 | D/MULTIPLE_CHOICE | Gleiche 71,2 % bei n=52 und n=520 nach Präzision vergleichen.                                      | LI13 | B3/E                | AKT       | QA-R | Pflichtkern   |
| P0-03-ARS-W06-L02 | L/SINGLE_CHOICE   | Das vorgegebene 95%-Intervall [0,58;0,82] ohne Parameter- oder Individualfehlinterpretation lesen. | LI14 | B4/M                | MIS       | QA-F | Pflichtkern   |
| P0-03-ARS-W06-L03 | L/MULTIPLE_CHOICE | Einfluss von n und Streuung auf Intervallbreite beurteilen.                                        | LI14 | B3/M                | AKT       | QA-R | Pflichtkern   |
| P0-03-ARS-W06-L04 | L/SINGLE_CHOICE   | 1/1 versus 100/102 mit dem Zweck einer Wilson-Untergrenze im Ranking vergleichen.                  | —    | B4/H                | TRF       | QA-R | Vertiefung V1 |
| P0-03-ARS-W06-L05 | L/SINGLE_CHOICE   | Bei 3 Erfolgen und 17 Misserfolgen die einfache Wald-Näherung nach Lehrregel zurückweisen.         | LI14 | B4/H                | RET       | QA-F | Pflichtkern   |

- **Pflichtkern-Themen:** Präzision=1, KI-Interpretation=1, Intervallbreite=1, Wald-Grenze=1. **Vertiefung:** V1 Wilson-Ranking=1.
- **Pflichtkern-Lernziele:** LI13=1, LI14=3. Die Vertiefung begründet kein zusätzliches Lernziel.
- **Schwierigkeit:** E=1, M=2, H=2. **Bloom:** B1=0, B2=0, B3=2, B4=3.
- **Retrieval:** AKT=2, RET=1, MIS=1, TRF=1. **QA:** QA-F=2, QA-R=3, QA-P=0.

### W07 – Hypothesentests und Vorher-Nachher-Vergleiche

**Datei:** [P0-03_ARSnova_Woche_07.json](./P0-03_ARSnova_Woche_07.json)

| ID                | Modus/Typ         | Konkreter Gegenstand und Sollreaktion                                                     | LI   | Bloom/Schwierigkeit | Retrieval | QA   | Status      |
| ----------------- | ----------------- | ----------------------------------------------------------------------------------------- | ---- | ------------------- | --------- | ---- | ----------- |
| P0-03-ARS-W07-L01 | D/SINGLE_CHOICE   | Für d=absoluter Fehler R1 minus R2 gerichtete Hypothesen zur Verbesserung zuordnen.       | LI15 | B3/E                | AKT       | QA-F | Pflichtkern |
| P0-03-ARS-W07-L02 | L/SINGLE_CHOICE   | p=0,03 unter H0 und Annahmen korrekt interpretieren.                                      | LI15 | B4/M                | MIS       | QA-F | Pflichtkern |
| P0-03-ARS-W07-L03 | L/MULTIPLE_CHOICE | statistische Signifikanz, Effekt und praktische Relevanz trennen.                         | LI15 | B4/M                | RET       | QA-F | Pflichtkern |
| P0-03-ARS-W07-L04 | L/SINGLE_CHOICE   | Bei denselben Personen den gepaarten Ansatz über Differenzen wählen.                      | LI16 | B3/H                | AKT       | QA-R | Pflichtkern |
| P0-03-ARS-W07-L05 | L/MULTIPLE_CHOICE | Fehlende Runde 2, n_round1/n_round2/n_pairs und unzulässige Auffüllung korrekt behandeln. | LI16 | B4/H                | TRF       | QA-P | Pflichtkern |

- **Themen:** Hypothesen=1, p-Wert=1, Signifikanz/Relevanz=1, Paarung=1, Ausfälle=1.
- **Lernziele:** LI15=3, LI16=2.
- **Schwierigkeit:** E=1, M=2, H=2. **Bloom:** B1=0, B2=0, B3=2, B4=3.
- **Retrieval:** AKT=2, RET=1, MIS=1, TRF=1. **QA:** QA-F=3, QA-R=1, QA-P=1.

Die Live-Runden ersetzen keine Paartabelle. Der gepaarte t-Test verwendet ausschließlich [S1-Paare](./P0-03_Lehrdaten_S1_Paare.csv), also vollständige synthetische LEHRDATEN.

### W08 – Korrelation und lineare Regression

**Datei:** [P0-03_ARSnova_Woche_08.json](./P0-03_ARSnova_Woche_08.json)

| ID                | Modus/Typ         | Konkreter Gegenstand und Sollreaktion                                                                 | LI   | Bloom/Schwierigkeit | Retrieval | QA   | Status      |
| ----------------- | ----------------- | ----------------------------------------------------------------------------------------------------- | ---- | ------------------- | --------- | ---- | ----------- |
| P0-03-ARS-W08-L01 | D/SINGLE_CHOICE   | Richtung, Muster und einen hohen Punkt im synthetischen Last-Latenz-Streudiagramm beschreiben.        | LI17 | B2/E                | AKT       | QA-F | Pflichtkern |
| P0-03-ARS-W08-L02 | L/MULTIPLE_CHOICE | r=0,82 nach Richtung/Stärke lesen und Kausalität zurückweisen.                                        | LI17 | B4/M                | MIS       | QA-R | Pflichtkern |
| P0-03-ARS-W08-L03 | L/SINGLE_CHOICE   | Steigung 0,42 ms je zusätzlichem Client im eingebetteten Lehrmodell interpretieren.                   | LI18 | B3/M                | AKT       | QA-R | Pflichtkern |
| P0-03-ARS-W08-L04 | L/SINGLE_CHOICE   | Für x=500 Vorhersage und Residuum bei beobachteten 330 ms bestimmen.                                  | LI19 | B3/H                | RET       | QA-R | Pflichtkern |
| P0-03-ARS-W08-L05 | L/SINGLE_CHOICE   | Produktionsversprechen für x=2.000 außerhalb des Lehrbereichs 100–600 als Extrapolation zurückweisen. | LI19 | B4/H                | TRF       | QA-F | Pflichtkern |

- **Themen:** Streudiagramm=1, Korrelation=1, Steigung=1, Vorhersage/Residuum=1, Extrapolation=1.
- **Lernziele:** LI17=2, LI18=1, LI19=2.
- **Schwierigkeit:** E=1, M=2, H=2. **Bloom:** B1=0, B2=1, B3=2, B4=2.
- **Retrieval:** AKT=2, RET=1, MIS=1, TRF=1. **QA:** QA-F=2, QA-R=3, QA-P=0.

L03/L04 sind ein eigenständiges, im JSON vollständig angegebenes LEHRDATEN-Modell `ŷ=85+0,42x`. Die JASP-Übung mit [S5](./P0-03_Lehrdaten_S5_Last_Latenz.csv) nutzt andere Koeffizienten und den Bereich 50–425 VU. Beide Fälle werden nicht vermischt.

### W09 – Train/Test, Overfitting und Klassifikationsmetriken

**Datei:** [P0-03_ARSnova_Woche_09.json](./P0-03_ARSnova_Woche_09.json)

| ID                | Modus/Typ         | Konkreter Gegenstand und Sollreaktion                                                                           | LI   | Bloom/Schwierigkeit | Retrieval | QA   | Status           |
| ----------------- | ----------------- | --------------------------------------------------------------------------------------------------------------- | ---- | ------------------- | --------- | ---- | ---------------- |
| P0-03-ARS-W09-L01 | D/SINGLE_CHOICE   | 98 % Training versus 71 % Test als Overfitting-Warnsignal mit Alternativerklärungen einordnen.                  | LI20 | B2/E                | AKT       | QA-F | Pflichtkern      |
| P0-03-ARS-W09-L02 | L/MULTIPLE_CHOICE | Leakage, nicht repräsentative Testdaten und wiederholte Testanpassung als Risiken für die Beurteilung erkennen. | LI20 | B4/M                | MIS       | QA-F | Pflichtkern      |
| P0-03-ARS-W09-L03 | L/MULTIPLE_CHOICE | Aus TP=42, FN=8, FP=18, TN=132 Metriken des eingebetteten Lehrfalls berechnen.                                  | LI21 | B3/M                | RET       | QA-R | Pflichtkern      |
| P0-03-ARS-W09-L04 | L/SINGLE_CHOICE   | Bei teuren False Negatives Recall für Technik priorisieren.                                                     | LI21 | B4/M                | TRF       | QA-F | Pflichtkern      |
| P0-03-ARS-W09-L05 | L/SINGLE_CHOICE   | 0,84/0,97 versus 0,87/0,85 nach Classified-Accuracy und Coverage ohne Gesamtsieger lesen.                       | —    | B4/H                | AKT       | QA-R | Vertiefung V4/V6 |

- **Pflichtkern-Themen:** Train/Test=1, Beurteilungsrisiken=1, Confusion Matrix=1, Fehlkosten=1. **Vertiefung:** V4/V6 Coverage und Q&A-Systemvergleich=1.
- **Pflichtkern-Lernziele:** LI20=2, LI21=2. Die Vertiefung begründet kein zusätzliches Lernziel.
- **Ergänzender Pflichtkern:** LI22 wird vor L05 mit dem Kern-Kurzcheck aus Abschnitt 3.5.2 gesichert; der Kurzcheck ist keine zusätzliche Livefrage.
- **Schwierigkeit:** E=1, M=3, H=1. **Bloom:** B1=0, B2=1, B3=1, B4=3.
- **Retrieval:** AKT=2, RET=1, MIS=1, TRF=1. **QA:** QA-F=3, QA-R=2, QA-P=0.

L03 ist ein eigenständiger Lehrfall und nicht identisch mit [S6-Klassifikation](./P0-03_Lehrdaten_S6_Klassifikation.csv). L05 nutzt vorbereitete Vergleichswerte; daraus wird keine Confusion Matrix und keine Produktivqualität abgeleitet.

### W10 – Integration, Kommunikation und Abschlussdiagnose

**Datei:** [P0-03_ARSnova_Woche_10.json](./P0-03_ARSnova_Woche_10.json)

| ID                | Modus/Typ                      | Konkreter Gegenstand und Sollreaktion                                                                        | LI   | Bloom/Schwierigkeit | Retrieval | QA   | Status      |
| ----------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---- | ------------------- | --------- | ---- | ----------- |
| P0-03-ARS-W10-L01 | D/SINGLE_CHOICE                | Für absolute Schätzfehler vollständige Paare, Differenzen und dokumentierte Ausfälle als Analyseplan wählen. | LI16 | B3/E                | RET       | QA-F | Pflichtkern |
| P0-03-ARS-W10-L02 | L/MULTIPLE_CHOICE              | Häufigkeit/Balken, metrischer Zusammenhang und gepaarter Vergleich passenden Fragen zuordnen.                | LI16 | B3/M                | AKT       | QA-F | Pflichtkern |
| P0-03-ARS-W10-L03 | L/SINGLE_CHOICE mit Confidence | 95%-Intervall [0,67;0,85] als mit Daten vereinbaren Wertebereich und Langfristverfahren lesen.               | LI14 | B4/M                | MIS       | QA-R | Pflichtkern |
| P0-03-ARS-W10-L04 | L/SINGLE_CHOICE                | p95=121 ms nur für den dokumentierten lokalen 500-VU-Lauf formulieren.                                       | LI24 | B4/H                | TRF       | QA-R | Pflichtkern |
| P0-03-ARS-W10-L05 | L/MULTIPLE_CHOICE              | Bei p=0,03 Effekt, n_pairs, Annahmen, Ausfälle und Kausalgrenze in den Befund aufnehmen.                     | LI24 | B4/H                | TRF       | QA-P | Pflichtkern |
| P0-03-ARS-W10-L06 | D/SURVEY                       | Schwerpunkt für das Klausurtraining wählen; keine richtige Antwort und kein individueller W01/W10-Vergleich. | LI23 | B2/E                | AKT       | QA-P | Pflichtkern |

- **Themen:** Analyseplan=1, Verfahrenswahl=1, Intervall-Anker=1, Quellenstatus=1, Befundgrenze=1, Abschluss-SURVEY=1.
- **Lernziele:** LI14=1, LI16=2, LI23=1, LI24=2.
- **Schwierigkeit:** E=2, M=2, H=2. **Bloom:** B1=0, B2=1, B3=2, B4=3.
- **Retrieval:** AKT=2, RET=1, MIS=1, TRF=2. **QA:** QA-F=2, QA-R=2, QA-P=2.

## 5. Runden-, Feedback- und Steuerungsregeln

### 5.1 Diagnosefragen

- Eine Runde ist der Regelfall.
- LD nennt n und den häufigsten fachlich relevanten Distraktor.
- Unter 67 % oder bei einer nach Abschnitt 3.5 dominanten Fehlvorstellung folgt eine kurze Erklärung; eine spontane zweite Runde wird als zusätzliche Runde derselben ID dokumentiert, nicht als neue Frage gezählt.
- SURVEY hat keine Lösungsquote und geht nicht in den 67-%-Indikator ein.

### 5.2 Lernfragen

1. Referenz/Ergebnis bleibt bis zum Schließen von Runde 1 verborgen.
2. 60–120 Sekunden Einzelbegründung bzw. Peer-Austausch.
3. Runde 2 mit derselben fachlichen Frage oder der im Plan genannten Transferfassung.
4. `n_round1` und `n_round2` getrennt berichten.
5. Runde-2-Antworten ersetzen fehlende Erst- oder Zweitantworten nicht.
6. Veränderung der Aggregate ist ein Lernsignal, kein Kausalnachweis.

### 5.3 Numerische Schätzung

Für W02-L03 und W03-L01 sind vor dem Import dokumentiert:

- Referenzwert 120 s,
- Einheit Sekunden,
- Plausibilitätsbereich 50–200 s,
- festes Toleranzintervall 108–132 s,
- ganzzahlige Eingabe,
- Verwendung des absoluten Fehlers zum Referenzwert.

W02-L03 verwendet `numericTwoRounds=true`; W03-L01 ist mit `numericTwoRounds=false` eine eigenständige spätere Retrievalfrage und keine dritte Messrunde. Das Toleranzband wird nicht als Konfidenzintervall bezeichnet. Eine personweise Paaranalyse wird aus dem Standardexport nicht vorausgesetzt.

## 6. Export- und Lehrsteuerungsregeln

Nach `FINISHED` folgt der Ablauf des [Lehrenden-Runbooks](./P0-03_Lehrenden_Runbook.md#5-export--und-datenübergabe).

Zulässige bereinigte Felder sind:

- Paketversion, Woche, redaktionelle ID und Lauf,
- Fragetyp und Modus,
- Runde/Aggregationsrunde,
- `n_responses`, `correct_count`, `correct_share`,
- Optionshäufigkeiten,
- gegebenenfalls Confidence-Gruppe nach Unterdrückungsregel,
- `source_kind` und `collection_mode`.

Nicht übernommen werden Name, Nickname, E-Mail-Adresse, Session-Code, Host-Token, Bonus, Rang, Score, individuelle Antwortzeit oder ungeprüfter Freitext. Bei Multiple Choice werden Optionsnennungen nicht als disjunkte Personengruppen behandelt.

## 7. Technische und fachliche Freigabe

Eine Wochen-Datei ist erst freigegeben, wenn:

1. der Fragenbestand der JSON-Datei der Wochensumme in Abschnitt 1 entspricht und zwischen 3 und 6 liegt;
2. `order` lückenlos bei 0 beginnt und exakt den redaktionellen IDs entspricht;
3. alle Nicht-Spiel-Einstellungen aus Abschnitt 1.1 im importierten Quiz geprüft sind;
4. jede Frage `timer=null` verwendet;
5. Themen-, Schwierigkeit-, Bloom-, Retrieval- und QA-Summen auf den JSON-Bestand aufgehen, während die Pflichtkern-LI-Summe auf die Zahl der Pflichtkernfragen aufgeht und Vertiefungsfragen in der LI-Spalte `—` tragen;
6. SINGLE_CHOICE genau eine richtige Option und MULTIPLE_CHOICE einen vollständigen Lösungsschlüssel hat;
7. NUMERIC_ESTIMATE Referenz, Einheit, Grenzen und Toleranzband enthält;
8. QA-R-Ergebnisse gegen Lehrdaten, Quelle und JASP reproduziert sind;
9. QA-P-Fragen Freiwilligkeit, Alternativteilnahme, kleine Zellen und Zweckbindung erfüllen;
10. Frage und Optionen vorgelesen werden können, Farbe nicht allein codiert und Formeln/Diagramme auf Mobilgerät sowie Projektion verständlich sind;
11. der Offline-Zählbogen für JSON-Fragen dieselben Optionen und dieselbe redaktionelle ID verwendet und die beiden nicht zum JSON-Bestand gehörenden Kern-Kurzchecks getrennt als `KQ-W03` und `KQ-W09` ausweist;
12. die Nutzung auf Lehrsteuerung und interne Modulverbesserung begrenzt ist und weder individuelle Bewertung noch Aussagen über Produktivqualität angelegt sind;
13. der Ablauf das Vertiefungsgate und bei geschlossenem Gate die Ersatzhandlung aus Abschnitt 3.5 verwendet.

Erst danach importiert LD die Datei für den realen Wochenlauf.
