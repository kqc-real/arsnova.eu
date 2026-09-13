# Modulkonzept: Angewandte Statistik für Wirtschaft, Management und Informatik (48 UE)

## ARSnova.eu als durchgängige empirische Fallstudie

**Umfang:** 10 Wochen mit 24 Vorlesungs- beziehungsweise Lerneinheiten (LE) à 90 Minuten. Eine LE umfasst zwei Unterrichtseinheiten (UE) à 45 Minuten; insgesamt sind das 48 UE beziehungsweise 36 Präsenzstunden.<br>
**Zielgruppe:** vor allem Bachelorstudierende der Betriebswirtschaftslehre, managementorientierter Studiengänge, der Wirtschaftsinformatik und der Informatik ohne vorausgesetzte Statistikkenntnisse; heterogene und teilweise schwache mathematische Grundlagen<br>
**Lehrformat:** interaktive Präsenzlehre mit synchronen browserbasierten Übungen, lokal installiertem JASP 0.98.1, begleitetem Selbststudium und formativer Lernstandsdiagnostik<br>
**Prüfungsformat (Vorschlag):** 90-minütige Klausur mit offizieller Formelsammlung, nicht programmierbarem Taschenrechner und vorbereiteten JASP-Auszügen; die Softwarebedienung wird nicht geprüft<br>

**Leitidee:** Statistik wird nicht zuerst als Formelsystem, sondern als Werkzeug zum Beschreiben, Beurteilen und Entscheiden anhand realer Management- und Digitalisierungsdaten gelernt.

## Lesehilfe zu Kürzeln und Codes

- **BWL/WI**: Betriebswirtschaftslehre beziehungsweise Wirtschaftsinformatik.
- **W01–W10**: Kurswoche 1 bis 10; **LE**: 90-minütige Vorlesungs- beziehungsweise Lerneinheit aus zwei **UE**; **UE**: 45-minütige Unterrichtseinheit.
- **MZ1–MZ7**: übergeordnete Modulziele; **LI01–LI24**: beobachtbare Leistungsindikatoren.
- **S1–S6**: Fallstudienstränge; **V1–V6**: optionale, nicht summativ geprüfte Vertiefungen.
- **A1–A6**, **B1–B6**, **C1–C4**, **D1–D7**: Formeln aus den Inhaltsblöcken A bis D; **Cx** bezeichnet entsprechend eine Formel aus Block C „Aus Stichproben schließen“.
- **Q1–Q20**: technische Quellen in [Technische Quellen zu ARSnova.eu und den Kurswerkzeugen](./Technische_Quellen_ARSnova.md).
- **L01–L10**: Livefrage 1 bis 10 einer Woche; **MC**: Multiple Choice; **Q&A**: Fragen und Antworten.
- **LIVE**, **REPO**, **LEHRDATEN**: Daten aus dem aktuellen Kurs, dokumentierte Repository-Nachweise beziehungsweise eigens konstruierte Übungsdaten.
- In einer **`source_ref`**-Quellenkennung bezeichnen `A1`–`A6` dagegen die Klausuraufgabe und ein abschließendes `V1` die Datensatzversion; diese Bestandteile sind keine Formel- oder Vertiefungscodes.

## Begleitmaterialien

Das Modulkonzept wird durch eigenständig nutzbare Lehr- und Lernmaterialien konkretisiert:

- [Modulbeschreibung für Studierende](./Modulbeschreibung_Studierende.md) – motivierender Einstieg, Lernrhythmus und Werkzeugrollen;
- [Kerncurriculum und Lernzielmatrix](./P0-01_Kerncurriculum_Lernzielmatrix.md) – Pflichtkern, MZ1–MZ7, LI01–LI24 und Vertiefungsgates;
- [Datenmanagement- und Exportplan](./P0-02_Datenmanagement_Exportplan.md) – Datenwege, Schutzstatus und Löschfristen;
- [Formelsammlung Statistik](./P0-03_Formelsammlung_Statistik.md) und [JASP-Analyseleitfaden](./P0-03_JASP_Analyseleitfaden.md) – prüfungsidentische Konventionen und reproduzierbare Analysen in JASP 0.98.1;
- [Mathematikdiagnostik mit Brückenpfaden](./P0-03_Mathematikdiagnostik_Brueckenpfade.md), [isomorphe BWL-/WI-Transfermatrix](./P0-03_Transfermatrix_BWL_WI.md) und [Material-/A11y-Probe](./P0-03_Barrierefreiheit_Material_und_Probe.md) – mathematischer Zugang, gleichwertiger Domänentransfer und barrierearme Alternativen;
- [Probeklausur](./P0-03_Probeklausur_90_Minuten.md), [Musterlösung](./P0-03_Probeklausur_Musterloesung.md) und [Statistikbefund-Vorlage mit Rubrik](./P0-03_Statistikbefund_Vorlage_Rubrik.md) – Prüfungssimulation und formative Qualitätskriterien.

---

## 1. Modulbeschreibung

Das Modul führt anwendungsorientiert in die Grundlagen der deskriptiven und schließenden Statistik ein. Die Studierenden lernen, Daten hinsichtlich ihrer Herkunft, Qualität und Skalierung zu beurteilen, Verteilungen mit geeigneten Kennzahlen und Grafiken zu beschreiben, Zufall und Stichprobenunsicherheit zu verstehen, Konfidenzintervalle und ausgewählte Hypothesentests korrekt zu lesen und anzuwenden sowie Zusammenhänge und einfache Vorhersagemodelle zu untersuchen. Abschließend werden statistische Grundideen auf die Evaluation von Machine-Learning-Systemen übertragen.

Die Webanwendung [ARSnova.eu](https://arsnova.eu) übernimmt dabei eine Doppelrolle:

1. **Lehr-Lern-Werkzeug:** Live-Quiz, numerische Schätzfragen, Q&A und Blitzlicht-Feedback aktivieren die Studierenden synchron und machen Fehlvorstellungen unmittelbar sichtbar. Rangliste, Teams, Bonuspunkte, kurze Zeitphasen, motivierende Rückmeldungen und Reaktionen werden als formative Gamification eingesetzt, um Aufmerksamkeit und Lernbeteiligung zu stärken.
2. **Empirische Statistik-Fallstudie:** Die in den Sitzungen entstehenden Antwortverteilungen, Schätzwerte, Sicherheitsurteile, Abstimmungen und aggregierten Rundenvergleiche werden selbst zum Gegenstand statistischer Untersuchungen. Ergänzend werden dokumentierte System- und Modelldaten aus dem [ARSnova.eu-Repository](https://github.com/kqc-real/arsnova.eu) verwendet, etwa dokumentierte Latenzquantile und die Evaluation der optionalen Q&A-Klassifikation. Dabei werden Live-Kursdaten, synthetische Seed-Evaluation und eigens konstruierte Lehrdaten ausdrücklich unterschieden (Q1, Q8–Q10).

Die externe MC-Test-App verbindet den gemeinsamen Wochenabschluss mit **Spaced Repetition**: Der erste 30-Fragen-Durchlauf findet in der letzten UE jeder Woche statt und wird unmittelbar ausgewertet; weitere Wiederholungen folgen mit zeitlichem Abstand. JASP 0.98.1 ist die verbindliche, frei verfügbare Analysesoftware für alle rechnergestützten Kernanalysen; Programmierung ist weder Voraussetzung noch Lernziel.

Dadurch erleben die Studierenden den vollständigen statistischen Arbeitszyklus:

> Untersuchungsfrage → Datenerhebung → Datenprüfung → Beschreibung → Unsicherheit → Schlussfolgerung → Kommunikation

Das Modul folgt bei jedem neuen Verfahren demselben didaktischen Übersetzungsmuster:

> Situation → Alltagssprache → grafische Darstellung → Formel → Rechnung → Interpretation → typische Fehlinterpretation → klausurnahe Anwendung

Die mathematische Formalisierung wird schrittweise aufgebaut. Formeln werden nicht auswendig gelernt, sondern ausgewählt, mit passenden Größen befüllt und inhaltlich interpretiert. Das Summenzeichen wird beispielsweise ausdrücklich als Handlungsanweisung eingeführt: „Führe die Rechnung für jede Beobachtung aus und addiere die Ergebnisse.“

---

## 2. Einordnung, Voraussetzungen und Arbeitsaufwand

### 2.1 Voraussetzungen

Erwartet werden lediglich:

- sicheres Rechnen mit Grundrechenarten, Brüchen und Prozenten,
- elementarer Umgang mit Potenzen, Quadratwurzeln und Klammern,
- elementares Umformen einfacher Gleichungen,
- Lesen einfacher Tabellen und Diagramme,
- grundlegende digitale Arbeitsfähigkeit im Browser und Bedienung eines nicht programmierbaren Taschenrechners.

Diese Arbeitsvoraussetzungen sind keine Zugangshürde: Die unbenotete [Mathematikdiagnostik](./P0-03_Mathematikdiagnostik_Brueckenpfade.md) wird in den sieben Tagen vor der ersten Präsenz-UE innerhalb des W01-Selbststudiums bearbeitet und weist passende Brückenpfade zu. Nicht vorausgesetzt werden Statistik, Analysis, lineare Algebra, Python, R oder Programmierung. JASP 0.98.1 wird von den Studierenden kostenlos auf einem kompatiblen Laptop oder Desktop-Rechner installiert und schrittweise mit vorbereiteten Dateien und Klickpfaden eingeführt. Es gibt keine institutionell bereitgestellte JASP-Analyseumgebung. Wer kein kompatibles Gerät nutzen kann, arbeitet gleichwertig in Partner- oder Kleingruppen, anhand der Lehrdemonstration und mit vorbereiteten Ausgaben.

### 2.2 Empfohlener Arbeitsaufwand

Sofern das Modul mit **3 ECTS** ausgewiesen werden soll, bietet sich folgende Verteilung von insgesamt etwa 90 Stunden an:

| Bereich                                                     | Stunden |
| ----------------------------------------------------------- | ------: |
| Präsenz: 24 LE × 90 Minuten einschließlich MC-Erstdurchlauf |      36 |
| Spaced-Repetition-Nachläufe und Wochenvorbereitung          |      24 |
| JASP-Übungen und Arbeit an der Fallstudie                   |      15 |
| Klausurvorbereitung und Prüfung                             |      15 |
| **Gesamt**                                                  |  **90** |

Die ECTS-Zuordnung ist an die jeweilige Prüfungsordnung anzupassen.

---

## 3. Qualifikationsziele und Lernergebnisse

Die sieben gleichrangigen, übergeordneten Modulziele bilden den summativ prüfbaren Rahmen. Die 24 Detailziele sind als beobachtbare **LI01–LI24** in der [Lernzielmatrix](./P0-01_Kerncurriculum_Lernzielmatrix.md#6-vollständige-lernzielmatrix) operationalisiert.

### 3.1 Übergeordnete Modulziele MZ1–MZ7

Nach erfolgreichem Abschluss können die Studierenden:

| Ziel                                                      | Übergeordnetes, prüfbares Modulziel                                                                                                                                                                                                                                            | Leistungsindikatoren |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| **MZ1: Daten strukturieren und beurteilen**               | eine betriebliche oder digitale Untersuchungsfrage in Grundgesamtheit, Stichprobe, Beobachtungseinheit und Merkmale zerlegen, Skalenniveaus begründen, Datenqualitätsprobleme erkennen und zulässige Aussagen vom Untersuchungsdesign abgrenzen                                | LI01–LI04            |
| **MZ2: Daten beschreiben und visualisieren**              | für einen überschaubaren Datensatz geeignete Häufigkeiten, Grafiken sowie Lage- und Streuungsmaße auswählen, mit Formelsammlung oder JASP bestimmen und im Kontext einschließlich Robustheit interpretieren                                                                    | LI05–LI08            |
| **MZ3: Zufall und Stichprobenunsicherheit modellieren**   | einfache Wahrscheinlichkeiten und Bedingungen bestimmen, Binomial- und Normalmodelle situationsgerecht erkennen sowie Stichprobenvariabilität und Grenzen der Generalisierung erklären                                                                                         | LI09–LI12            |
| **MZ4: Schätzen und testen**                              | für einfache Mittelwert- und Anteilsfragen eine Punkt- und Intervallschätzung sowie für gepaarte metrische Vorher-Nachher-Fragen den gepaarten t-Test auswählen, Ergebnisse berechnen oder aus JASP lesen und ohne kausale oder probabilistische Fehlinterpretation beurteilen | LI13–LI16            |
| **MZ5: Zusammenhänge und Vorhersagen beurteilen**         | bivariate metrische Zusammenhänge mit Streudiagramm, Korrelation und einfacher linearer Regression untersuchen, Vorhersagen und Residuen interpretieren sowie Generalisierung und Overfitting anhand von Train/Test-Ergebnissen beurteilen                                     | LI17–LI20            |
| **MZ6: Binäre Klassifikation evaluieren**                 | eine binäre Confusion Matrix auswerten, Accuracy, Precision, Recall und binären F1-Score passend zu Fehlkosten auswählen und Modellwahrscheinlichkeit, beobachtete Häufigkeit und sachliche Wahrheit unterscheiden                                                             | LI21–LI22            |
| **MZ7: Statistische Evidenz kommunizieren und begrenzen** | einen reproduzierbaren Kurzbefund mit Untersuchungsfrage, Datenquelle, passender Darstellung, Ergebnis und Grenze in höchstens fünf Sätzen adressatengerecht formulieren und Überinterpretationen zurückweisen                                                                 | LI23–LI24            |

### 3.2 Verbindlicher Pflichtkern

Alle MZ1–MZ7 und LI01–LI24 gehören zum Pflichtkern. Dieser umfasst Datenstruktur und -qualität, deskriptive Statistik, elementare Wahrscheinlichkeit und Verteilungen, Stichprobenunsicherheit, einfache Intervalle und Tests, Korrelation und einfache lineare Regression, Train/Test sowie binäre Confusion Matrix und binäre Klassifikationsmetriken. Die verbindliche inhaltliche Abgrenzung, Wochenzuordnung und summative Evidenz stehen im [Kerncurriculum](./P0-01_Kerncurriculum_Lernzielmatrix.md).

### 3.3 Gegatete Vertiefungen V1–V6

Vertiefungen dürfen erst nach gesichertem zugehörigem Pflichtkern eingesetzt werden, ersetzen keine Kernübungszeit und begründen weder zusätzliche Modulziele noch Prüfungsanforderungen:

| Kennung | Vertiefung                                 | Grenze im Modul                                                                                                                       |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **V1**  | Wilson-Ranking im Q&A                      | bereitgestellte Untergrenze nur als Rankingsignal lesen; keine Herleitung, Berechnung oder Klausuraufgabe                             |
| **V2**  | ARSnova-spezifische Quartilimplementierung | Konventionen optional vergleichen; Indexregel weder Pflichtrechenverfahren noch Klausurstoff                                          |
| **V3**  | Macro-F1                                   | bereitgestellten Wert allenfalls lesen; keine Mehrklassenberechnung                                                                   |
| **V4**  | Coverage und Entscheidungsschwelle         | Zielkonflikt nur qualitativ; keine Optimierung oder Rekonstruktion fehlender Zellen                                                   |
| **V5**  | Kalibrierung                               | vorbereitete Wahrscheinlichkeitsgruppen nur qualitativ vergleichen; keine Kalibrierungsmetrik                                         |
| **V6**  | Q&A-NLP von ARSnova.eu                     | dokumentierte synthetische Seed-Evaluation nur begrenzt lesen; keine Architektur, kein Training, keine Aussage über Produktivqualität |

**V1–V6 sind aus der summativen Prüfung vollständig ausgeschlossen.** Das verbindliche Gate und die Ersatzhandlungen bei nicht gesichertem Kern regelt die [Lernzielmatrix](./P0-01_Kerncurriculum_Lernzielmatrix.md#22-vertiefung-und-arsnova-spezifischer-transfer). Der [ARSnova-Livequiz-Blueprint](./P0-03_ARSnova_Livequiz_Blueprint_10_Wochen.md#34-curricularer-status) stellt zusätzlich sicher, dass die vollständige Zehn-Typen-Abdeckung nicht von einer Vertiefung abhängt.

---

## 4. Didaktisches Gesamtdesign

### 4.1 Leitprinzipien

Das Modul beruht auf sechs Prinzipien:

1. **Statistik lesen vor Statistik rechnen:** Fertige Werte wie $r=0{,}72$, $p=0{,}03$ oder ein Intervall $[0{,}71;0{,}79]$ werden zunächst sprachlich entschlüsselt.
2. **Konzept vor Formalismus:** Ein Problem und eine anschauliche Simulation stehen vor Definition und Formel.
3. **Eine wiederkehrende, quellenkritische Fallstudie:** ARSnova-Daten schaffen Zusammenhang zwischen den Themen und reduzieren fachfremde Kontextwechsel.
4. **Aktives Abrufen und verteilte Wiederholung:** Frühere Inhalte kehren in jeder Woche zurück.
5. **Fehler als Diagnose:** Falsche Antworten werden als Hinweise auf Denkmodelle genutzt, nicht als öffentliches Defizit einzelner Personen.
6. **Konstruktive Abstimmung:** Lernziele, Lernaktivitäten und Klausuraufgaben verwenden dieselben Handlungen: auswählen, berechnen, visualisieren, interpretieren und begründen.

### 4.2 Wiederkehrendes Mikromuster einer Lerneinheit

Eine typische LE umfasst zwei zusammengehörige UE und damit 90 Minuten:

| Phase                            |  Richtwert | Funktion                                                          |
| -------------------------------- | ---------: | ----------------------------------------------------------------- |
| Aktivierung und Rückblick        |     8 Min. | alte und neue ARSnova-Concept-Question, Anschluss an die Vorwoche |
| Problem und Intuition            |    10 Min. | authentische Fragestellung aus der Fallstudie                     |
| Erklärung und Formel             |    17 Min. | sprachliche Herleitung, Formelsammlung, gemeinsames Beispiel      |
| Anwendung                        |    20 Min. | Einzel-, Partner-, Tablet- oder JASP-Aufgabe                      |
| Auswertung und Fehlvorstellungen |    12 Min. | Antwortverteilung diskutieren, Begründungen vergleichen           |
| Transfer oder JASP-Sicherung     |    15 Min. | neues Anwendungsfeld, Analyseausgabe oder klausurnahe Kurzaufgabe |
| Exit Ticket/Blitzlicht           |     4 Min. | Verstehen, Tempo oder offene Frage erfassen                       |
| **Flexpuffer**                   | **4 Min.** | Technik, Nachfragen, gleichwertige Teilnahme oder Übergang        |

Die Phasen summieren sich auf 90 Minuten. Wird der Flexpuffer überschritten, entfällt zuerst ein optionales zweites Beispiel oder eine Vertiefung. Kernanwendung, Exit-Evidenz und notwendige Zeit für gleichwertige Teilnahme werden nicht ersatzlos gestrichen.

Die jeweils letzte LE einer Woche besitzt ein abweichendes Schlussmuster: Die erste UE schließt den Fachschwerpunkt und die JASP-/Transferarbeit ab. Die zweite und damit letzte UE der Woche umfasst 32 Minuten für den MC-Test, 10 Minuten gemeinsame Ergebnis- und Lösungsbesprechung sowie 3 Minuten für Sicherung und Spaced-Repetition-Auftrag.

Interne Quizpunkte sind keine Lernstandskennzahl: Zeit, Schwierigkeit, Bonus und Streak können den Score beeinflussen. Für fachliche Analysen werden Korrektheit, Antwortzahl und bei Schätzungen der Fehler zum Referenzwert verwendet. Für unbewertete Meinungsfragen dienen SURVEY oder Blitzlicht (Q2, Q15).

ARSnova.eu verbindet drei formative Modi:

| Modus      | Gestaltung                                                                               | Zweck                                           |
| ---------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Diagnose   | freiwillige Antwort, sichtbarer Nenner, fachliche Verteilung ohne Notenwirkung           | Vorwissen und Fehlvorstellungen sichtbar machen |
| Lernen     | Antwort, Erklärung, Peer-Austausch und erneute Abstimmung                                | Konzeptwechsel und Peer Instruction             |
| Spiel/Team | Pseudonyme, Rangliste, vier automatisch gebildete Teams, drei Bonuspunkte und Zeitphasen | Aufmerksamkeit, Aktivierung und Lernmotivation  |

Die Wochenquiz-Dateien nutzen ein einheitliches Gamification-Profil: `anonymousMode=false` mit automatisch vergebenen Pseudonymen, `allowCustomNicknames=false` und `nicknameTheme=KINDERGARTEN`, `showLeaderboard=true`, `defaultTimer=60`, `timerScaleByDifficulty=true`, `enableTimerAccommodation=true`, aktivierte Sound-, Belohnungs-, Motivations- und Emoji-Effekte, `teamMode=true`, `teamCount=4`, die vier automatisch gebildeten Teams `Apfel :apple:`, `Birne :pear:`, `Banane :banana:` und `Apfelsine :orange:` sowie `bonusTokenCount=3`. Eine vorgeschaltete Lesephase bleibt aktiv. Persönlich freigegebene Zeitverlängerungen und eine gleichwertige untimierte Alternative haben Vorrang. Rang, Teamstand, Geschwindigkeit und Bonus bleiben spielerische Rückmeldung ohne Notenwirkung oder individuelle Kompetenzdiagnose.

Jede Wochen-Datei enthält genau zehn Livefragen und setzt jeden der zehn unterstützten Typen einmal ein: Single Choice, Multiple Choice, Freitext, bewertete Kurzantwort, Umfrage, Rating, numerische Schätzung, Zuordnung, Reihenfolge und Kategorisierung. Alle Fragen sind mindestens mittel, überwiegend schwer. Auswahloptionen und Distraktoren sind in Grammatik, Satzform, Wortart und Länge parallel gestaltet; falsche Optionen bilden plausible Fehlkonzepte oder Rechen- und Interpretationsfehler ab.

### 4.3 Formative Lernschleifen

**Innerhalb der Sitzung – ARSnova.eu:**

> Frage → Antwortverteilung → Begründung → Nachsteuerung → zweite Antwort oder Transferaufgabe

**Am Ende der Woche und mit zeitlichem Abstand – MC-Test:**

Der [MC-Test](https://mc-test.streamlit.app) ist eine externe Streamlit-App. Jede der zehn Wochen-Dateien enthält genau 30 Fragen. Ihr Wurzelobjekt besteht ausschließlich aus `meta` und `questions`. `meta` enthält genau `title`, `target_audience`, `question_count`, `difficulty_profile`, `time_per_weight_minutes`, `additional_buffer_minutes`, `test_duration_minutes`, `language` und `updated`; jedes Fragenobjekt enthält genau `question`, `options`, `answer`, `explanation`, `weight`, `topic`, `concept`, `cognitive_level` und `mini_glossary`. Das Schwierigkeitsprofil ist je Woche exakt `0 leicht/12 mittel/18 schwer`. Alle vier Optionen sind plausibel, grammatisch parallel und ähnlich lang; die drei Distraktoren bilden typische Fehlkonzepte oder realistische Rechen- und Interpretationsfehler ab. Das exakte Feldschema und den redaktionellen Einsatzvertrag beschreibt der [MC-Test-Blueprint](./P0-03_MC-Test_Blueprint_10_Wochen.md).

Verbindlicher Laufzeitmodus ist `practice` ohne technischen Timer und mit Sofortfeedback. `show_top5_public=false` verhindert die öffentliche Top-5. `meta.test_duration_minutes=32` ist der Planwert für den ersten Durchlauf in der letzten UE jeder Woche. Anschließend werden aggregierte Ergebnisse, Lösungen und besonders häufig gewählte Distraktoren gemeinsam besprochen. Ein zweiter vollständiger Durchlauf folgt idealerweise nach zwei bis drei Tagen; zentrale Konzepte kehren nach zwei bis vier Wochen in neuen Fragensätzen wieder. Die App erzwingt weder Versuchszahl noch Bearbeitungszeit. Die Nutzung ist ausschließlich formativ: Nur vereinbarte Aggregate steuern die Lehre und interne Modulevaluation; Einzelverläufe haben keine Notenwirkung.

Ab Woche 2 umfasst die redaktionelle Verteilung als Richtwert:

| Anzahl | Herkunft der Fragen                                                     |
| -----: | ----------------------------------------------------------------------- |
|     12 | Inhalte der aktuellen beziehungsweise unmittelbar vorangegangenen Woche |
|     10 | ältere Inhalte zur verteilten Wiederholung                              |
|      5 | häufig falsch beantwortete Konzepte                                     |
|      3 | Transfer- und klausurnahe Aufgaben                                      |

In Woche 1 werden die für ältere Inhalte vorgesehenen Plätze als unbenotete fachstatistische Eingangsdiagnose genutzt. Die davon getrennte [Mathematikdiagnostik mit Brückenpfaden](./P0-03_Mathematikdiagnostik_Brueckenpfade.md) wird vor der ersten Präsenz-UE selbstständig bearbeitet und prüft Brüche, Prozentrechnung, Potenzen/Wurzeln, einfache Gleichungen, Taschenrechner- sowie Tabellen-/Diagrammroutine.

Zu Beginn der Folgewoche werden nur wenige diagnostisch ergiebige Fragen live aufgegriffen. Inhalte mit einer Lösungsquote unter ungefähr zwei Dritteln werden erneut erklärt oder mit einem neuen Beispiel bearbeitet. Der Schwellenwert dient der Lehrentscheidung, nicht der Bewertung von Studierenden.

**Begleitend – JASP 0.98.1:** Von Woche 1 bis 10 entsteht mindestens ein gespeichertes JASP-Projekt oder ein exportierter JASP-Auszug mit Datenquelle, Beobachtungseinheit, Variablen, Analyse, Interpretation und Grenze. Die Nachweise sind formativ.

**Prüfungsroutine:** In jeder Woche wird mindestens eine kurze Aufgabe mit derselben [Formelsammlung](./P0-03_Formelsammlung_Statistik.md), demselben Taschenrechner-Workflow und gegebenenfalls einem vorbereiteten JASP-Auszug wie in der Klausur gelöst. Die Bedienung von JASP wird in der Klausur nicht geprüft.

---

## 5. Die empirische Fallstudie „ARSnova-Statistiklabor“

### 5.1 Leitfragen der Fallstudie

Über das Semester untersuchen die Studierenden schrittweise unter anderem:

- Wie verteilen sich Antworten und numerische Schätzungen in unserer Lerngruppe?
- Welche Kennzahlen beschreiben diese Verteilungen angemessen?
- Wie hängen subjektive Antwortsicherheit und tatsächliche Korrektheit zusammen?
- Wie unterscheiden sich die aggregierte Schätzgenauigkeit in Runde 1 und Runde 2, ohne daraus eine kausale Wirkung abzuleiten?
- Wie unsicher ist der beobachtete Anteil korrekter Antworten?
- Welche Aussage lässt sich von einer Lehrveranstaltungsstichprobe auf eine größere Population übertragen – und welche nicht?
- Wie unterscheiden sich Trainings- und Testleistung eines Klassifikationssystems?
- Wann sind Accuracy, Precision, Recall oder binärer F1-Score die angemessene Bewertungsgröße?
- Warum sind bei Systemlatenzen Median, p95 und p99 oft informativer als nur ein Mittelwert?

### 5.2 Datenquellen und tatsächlich verfügbare Auswertungen

| Datenbaustein                   | Herkunft und Zugriff                                                                                                 | Statistische Verwendung und Grenze                                                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quizantworten                   | Host-Ergebnisse und aggregierter PDF-/CSV-Bericht (Q3, Q10)                                                          | Häufigkeiten und korrekte Antworten; bei MC sind Optionsnennungen keine disjunkten Personengruppen.                                                                               |
| Numerische Schätzungen          | NUMERIC_ESTIMATE: Histogramm, Kennzahlen, Rundenvergleich nach Ergebnisfreigabe (Q2, Q3)                             | Verteilungen, Schätzfehler, deskriptiver Rundenvergleich; keine automatische Rohwertliste aller Personen im Standardexport voraussetzen.                                          |
| Antwortsicherheit × Korrektheit | Confidence-Zusatz zu bewertbaren Fragen; 1–2 niedrig, 3 mittel, 4–5 hoch (Q4, Q5)                                    | Kontingenztafel und bedingte Häufigkeiten; ordinale Selbstauskunft, keine gemessene Erfolgswahrscheinlichkeit.                                                                    |
| Q&A-Voting                      | Host-Sortierungen „Meist unterstützt“, „Beste Fragen“, „Umstritten“; separate positive und negative Stimmen (Q6, Q7) | Netto-Score und Zustimmung als Messgrößen unterscheiden; Wilson-Ranking und Kontroversität nur als gegatete Vertiefung V1 lesen. Das Legacy-Feld upvoteCount ist ein Netto-Score. |
| Systemlatenzen                  | Dokumentierte lokale Lastmessungen und Testberichte (Q8)                                                             | Quantile lesen; aus p95/p99 allein lassen sich weder Rohdaten noch Mittelwert, Boxplot oder Regression rekonstruieren.                                                            |
| Q&A-Klassifikation              | Optionaler Naive-Bayes-/k-NN-Pfad, synthetisch-hörsaalnahes Seed-Eval (Q8, Q9)                                       | Nur V4/V6: Coverage und dokumentierte Systemevaluation lesen; kein Nachweis produktiver Qualität auf echten Kursfragen und kein summativer Stoff.                                 |
| Regression und gepaarter Test   | Verlinkte, ausdrücklich synthetische LEHRDATEN                                                                       | Rechenbare Einzelwerte bzw. vollständige Paare für JASP; didaktische Ergänzung, keine behauptete native ARSnova-Analyse.                                                          |

Jeder Datenbaustein trägt eine Herkunftskennzeichnung: **LIVE** (eigene Erhebung), **REPO** (dokumentierter Messlauf; dessen Daten können synthetisch sein) oder **LEHRDATEN** (neu konstruierte Übung). Ein Quellenlink macht synthetische Daten nicht zu einer Feldstudie. Die Begleitmaterialien enthalten sieben synthetische Lehrdaten-CSV samt [Datenwörterbuch und Provenienz](./P0-03_Datenwoerterbuch_Provenienz.md); die vollständige verlinkte Materialliste steht in Kapitel 11.

### 5.3 Minimaler Datenkatalog

Für die Lehrmaterialien wird ein schlanker, dokumentierter Datensatz geführt. Der folgende Katalog beschreibt eine didaktische Zieltabelle, nicht ein vorhandenes ARSnova-CSV-Schema. Verbindlich sind das [Datenwörterbuch](./P0-03_Datenwoerterbuch_Provenienz.md) und der [Datenmanagement- und Exportplan](./P0-02_Datenmanagement_Exportplan.md): LIVE-Frageaggregate bleiben von Einzelwert- und Paartabellen getrennt; Einzelantworten, vollständige Paare und Systemrequests werden für Lernaufgaben ausschließlich als freigegebene LEHRDATEN verwendet. Eine Zeile hat jeweils genau eine Beobachtungseinheit.

| Variable                            | Typ/Skala        | Beispiel           | Hinweis                                                                                                         |
| ----------------------------------- | ---------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `week`                              | ordinal          | 4                  | Erhebungswoche                                                                                                  |
| `item_id`                           | nominal          | W04_Q3             | keine Klarnamen                                                                                                 |
| `topic`                             | nominal          | Bayes              | Inhaltsbereich                                                                                                  |
| `n_responses`                       | metrisch-diskret | 48                 | Bezugsgröße jedes Anteils                                                                                       |
| `correct_count`                     | metrisch-diskret | 31                 | aggregiert                                                                                                      |
| `correct_share`                     | metrisch-stetig  | 0,646              | aus Zähler und Nenner                                                                                           |
| `estimate_round`                    | nominal          | R1/R2              | Vorher-Nachher-Vergleich                                                                                        |
| `estimate_value`                    | metrisch         | 72,0               | nur in freigegebenen LEHRDATEN; nicht aus LIVE-Aggregaten rekonstruieren                                        |
| `confidence`                        | ordinal          | 4                  | Bei aktivierter Zusatzfunktion für die Abgabe erforderlich; alternative Teilnahme ohne diese Erhebung anbieten. |
| `actual_class`                      | nominal          | Technik            | kuratierte Klassifikationsdaten                                                                                 |
| `predicted_class`                   | nominal          | Organisation       | kuratierte Klassifikationsdaten                                                                                 |
| `latency_ms`                        | metrisch         | 121                | Einzelrequest nur bei vorliegenden Rohmessungen; p95 = 121 ms ist kein Einzelrequest.                           |
| `source_kind`, `source_ref`         | nominal          | REPO, Commit/Datei | LIVE/REPO/LEHRDATEN und Herkunft                                                                                |
| `unit`, `aggregation_round`         | nominal          | Frage, 2           | Beobachtungseinheit und ausgewertete Runde                                                                      |
| `n_round1`, `n_round2`, `n_pairs`   | metrisch-diskret | 30, 26, 25         | Rundenumfänge getrennt; `n_pairs` nur bei tatsächlich vorliegenden LEHRDATEN-Paaren                             |
| `reference_value`, `tolerance_band` | metrisch         | 120, [108;132]     | Referenz und Bewertung vor Erhebung festlegen                                                                   |

### 5.4 Datenschutz und Zweckbindung

Das Modul ist ausschließlich Lehre und interne Modulevaluation. Es ist kein Forschungsprojekt und erzeugt weder eine Publikationsgrundlage noch Daten für Sekundärnutzung, externe Evaluation, individuelle Leistungsprofile oder spätere Zweckänderungen. Verbindliche Quelle für Erhebung, Schutzstatus, Zugriff, Freigabe, Aufbewahrung, Löschung und Incidents ist der [Datenmanagement- und Exportplan](./P0-02_Datenmanagement_Exportplan.md).

- Die Teilnahme an Live-Abstimmungen, Confidence und Feedback ist freiwillig und ohne Notennachteil. ARSnova verwendet automatisch vergebene Pseudonyme sowie formative Ranglisten-, Team-, Zeit- und Bonuselemente. Diese spielerischen Signale werden nicht als Kompetenzmaß, Benotungsgrundlage oder individuelles Leistungsprofil verwendet.
- ARSnova-Exporte werden sofort gesichert: Der separate Q&A-CSV wird vor `FINISHED` aus der Hostansicht exportiert; Session-CSV und Ergebnis-PDF folgen unmittelbar nach `FINISHED`. Der allgemeine Sessionexport ersetzt die Q&A-Vollmetriken nicht.
- Blitzlicht ist temporär. Nur das benötigte Aggregat wird solange die Runde sichtbar ist mit Zeitpunkt und Nenner dokumentiert; anschließend wird das Blitzlicht ausdrücklich beendet. Voter-Zustände werden nicht exportiert.
- Aggregierte Sessiondaten werden nie zu Personen-Rohdaten oder Vorher-Nachher-Paaren zurückgerechnet. Für Einzelwerte, vollständige Paare, Regression und kleine Demonstrationen werden freigegebene synthetische LEHRDATEN verwendet.
- MC-Test-Antwortlogs und der kursisolierte SQLite-Bestand sind pseudonyme LIVE-Daten. Nach Aggregation umfasst das Löschhandoff auch Sitzungszusammenfassungen beziehungsweise bei isoliertem Betrieb die vollständige SQLite-Dateifamilie; ein SQL-Dump ist kein Routine-Analyseformat.
- `.jasp`-Dateien können Eingabedaten einbetten und übernehmen deshalb deren höchsten Schutzstatus. LIVE-Daten werden nur lokal im geschützten Arbeitsbereich der Lehrdurchführung verarbeitet; Studierende arbeiten in JASP ausschließlich mit freigegebenen anonymen Aggregaten oder synthetischen LEHRDATEN.
- Q&A- und sonstiger Freitext wird separat geprüft, nicht wörtlich verteilt und nicht als NLP-Datensatz genutzt. Kleine oder rückrechenbare Zellen werden unterdrückt oder zusammengefasst.

Die konkreten Verarbeitungs- und Löschfristen stehen ausschließlich im [Datenmanagement- und Exportplan, Abschnitt 7](./P0-02_Datenmanagement_Exportplan.md#7-konkreter-exportablauf) und in [Abschnitt 12](./P0-02_Datenmanagement_Exportplan.md#12-aufbewahrungs--und-löschfristen). Dieses Hauptkonzept verkürzt, verlängert oder dupliziert diese Fristen nicht.

### 5.5 Fachliche Regeln des Statistiklabors

**Schätzen ist nicht Selbstauskunft.** Eine Frage nach dem eigenen Arbeitsweg hat keine gemeinsame richtige Referenz. Für NUMERIC_ESTIMATE verwenden wir beispielsweise eine vorgängig vorbereitete, zunächst verdeckte Tabelle mit 20 Servicezeiten und bekanntem Mittelwert von 120 Sekunden. Die Gruppe schätzt diesen Mittelwert anhand einer Grafik. Referenz, Einheit, Plausibilitätsgrenzen und Toleranzband werden dokumentiert. Das Toleranzband bewertet Antworten; es ist **kein Konfidenzintervall**. Ein enges Plausibilitätsband schneidet mögliche Antworten ab und verändert die beobachtete Verteilung (Q2).

**Angezeigte Statistik und Formelsammlung abgleichen.** Die Funktion buildNumericStats dividiert die Quadratsumme durch n. A5/A6 verwenden dagegen n−1 für den Stichprobenschätzer. Bei n > 1 gilt für ungerundete Werte:

$$
s=s_{\mathrm{deskriptiv}}\sqrt{\frac{n}{n-1}}
$$

ARSnova verwendet für Quartile die sortierten Werte an den nullbasierten Indizes floor(n/4) und min(floor(3n/4), n−1). Tabellenprogramme und JASP können andere Konventionen verwenden. Diese app-spezifische Implementierung ist Vertiefung V2 und nur nach gesichertem Kern zu vergleichen; sie ist weder summativ prüfbar noch ein Pflichtrechenverfahren. Für Handrechnungen wird die verwendete Konvention in der Aufgabe genannt; die Softwareanzeige ist keine universelle Quartilsdefinition (Q3).

**Zwei Runden und Paarung unterscheiden.** Hauptergebnis und Confidence-Auswertung verwenden Runde 2, sobald Runde-2-Antworten vorliegen; fehlende Zweitantworten werden dort nicht mit Erstantworten aufgefüllt. Zusätzlich enthält die numerische Auswertung aggregierte Rundenvergleiche. Deren Vorhandensein bedeutet nicht, dass eine personweise Paartabelle exportiert wird. Für den gepaarten t-Test sind vollständige Paare separat erforderlich. Aus n, Mittelwert und Standardabweichung beider Runden allein lässt sich die Streuung der individuellen Differenzen nicht bestimmen (Q3–Q5, Q10).

**Nenner sichtbar halten.** Zahl der eingeschriebenen Studierenden, anwesenden Personen, verbundenen Geräte, Antworten und vollständigen Paare sind verschieden. MC-Optionshäufigkeiten können sich auf mehr als 100 % summieren. Für den Anteil fachlich korrekter Antworten verwenden wir correctCount und incorrectCount, nicht Quizpunkte oder die Summe korrekter Optionsnennungen (Q3).

**Selbsteinschätzung ist ordinal.** Die Confidence-Matrix verwendet 1–2 / 3 / 4–5. Ein eigenständiges RATING zur allgemeinen Sicherheit ist keine automatisch mit einer konkreten Antwort verknüpfte Confidence-Messung. Bei aktivierter Confidence ist deren Angabe Bestandteil der Abgabe; die Lehrperson kann sie deaktivieren. Abschlussaggregate und Export unterdrücken Confidence-Fragen mit weniger als fünf entsprechenden Antworten. Kleine bzw. unterdrückte Zellen werden nicht als Nullwerte interpretiert (Q4, Q5, Q12).

**Gepaarte Verbesserung ist kein Kausalnachweis.** Für Schätzungen wird pro vollständigem Paar die Abnahme des absoluten Fehlers zur vorher festgelegten Referenz untersucht. Referenz und Ergebnisverteilung bleiben bis nach Runde 2 verborgen. Übung, Wiederholung, Ausfälle und Abhängigkeit durch Peer-Diskussion begrenzen die Interpretation; ein einfacher t-Test liefert hier eine modellbasierte Lehrrechnung, keinen isolierten Wirksamkeitsnachweis.

### 5.6 Konkrete Fallstudienstränge und Transfer

| Strang                                | Lernaufgabe                                                                                | Verwendung    | Transfer für BWL/Management; WI/Informatik                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------- |
| S1: Servicezeit schätzen              | Verdeckten Mittelwert schätzen; Verteilung und Fehler auswerten                            | Wochen 2–3, 7 | Serviceplanung und Prognosefehler; Messsysteme und Datenqualität                          |
| S2: Sicher und richtig?               | Antwortbezogene 2×3-Tafel lesen und bedingen                                               | Wochen 4, 10  | Schulungsdiagnostik und Befragungen; Übereinstimmung von Sicherheit und Korrektheit       |
| S3: Welche Frage zuerst?              | Netto-Score und Zustimmung vergleichen; Wilson/Kontroversität nur als V1                   | Woche 6       | Bewertungsportale und Priorisierung; Rankinglogik als optionale Vertiefung                |
| S4: Wie gut ist der digitale Service? | p95/p99 mit Messdesign und Einheit lesen                                                   | Woche 3       | Service-Level und Kundenerfahrung; Last- und Performancemessung                           |
| S5: Last und Latenz                   | Synthetische Tabelle unabhängiger Lastläufe: gleiches System, Lastniveau und Medianlatenz  | Woche 8       | Kapazitätsplanung; einfache Regression und Extrapolation                                  |
| S6: Automatisch zuordnen oder prüfen? | binäre LEHRDATEN-Matrix und Fehlkosten im Kern; Q&A-Seed-Evaluation/Coverage nur als V4/V6 | Wochen 4, 9   | Serviceanfragen und manuelle Nachbearbeitung; Q&A-Systempfad nur als optionale Vertiefung |

Der Strang S5 ist eine neue didaktische Ergänzung. Für genau 16 synthetische Läufe werden Lastniveau, Medianlatenz, Szenario und Quellenstatus dokumentiert; Hardware und Requestmix bleiben im Lehrmodell konstant. Die Streuung zwischen Läufen wird nicht aus veröffentlichten p95/p99-Werten erfunden. Der betriebliche Parallelkontext steht als zahlen- und handlungsgleiche Aufgabe in der [Transfermatrix](./P0-03_Transfermatrix_BWL_WI.md); er wird nicht als zusätzlicher Produktionsdatensatz ausgegeben.

### 5.7 Semesterprodukt der Fallstudie

Am Ende liegt ein kompakter, reproduzierbarer Statistikbefund vor:

1. Untersuchungsfrage,
2. Beschreibung der Daten und Stichprobe,
3. passende Grafik und Kennzahlen,
4. eine begründete inferenzstatistische oder modellbezogene Auswertung,
5. Interpretation in Alltagssprache,
6. mindestens eine Einschränkung,
7. höchstens fünf Sätze Management Summary.

Das Produkt wird als unbenotete Gruppenarbeit mit formativer Rückmeldung eingesetzt.

Für das Semesterprodukt sind S1, S5 und S6 die drei analysefähigen Wahlpfade. S2–S4 bleiben verbindliche gemeinsame Lehr- und Transferfälle, bilden wegen ihrer begrenzten Datenbasis oder optionalen Vertiefungslogik aber keinen eigenständigen Abschlussbefund. Dadurch wird keine Auswertung aus unzureichenden Aggregaten konstruiert.

| Zeitpunkt | Verbindlicher Meilenstein des Semesterprodukts                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| W01       | S1, S5 und S6 kennenlernen; Datenquelle, Beobachtungseinheit und zulässige Aussage je Pfad notieren                             |
| W02       | unverbindliche Pfadpräferenz und erste Untersuchungsfrage formulieren                                                           |
| W03       | Pfad verbindlich wählen; Gruppenkennung, Rollen, `source_ref` und Datenprotokoll festhalten                                     |
| W04–W05   | deskriptive Basis und Datenqualitäts-/Generalisierungsgrenze ergänzen                                                           |
| W06       | Analyseplan Version 1 mit begründeter Verfahrenswahl erstellen; noch nicht behandelte Methode als Platzhalter markieren         |
| W07       | S1-Kernanalyse abschließen; S5/S6 aktualisieren ihren Plan anhand des Verfahrensschemas                                         |
| W08       | S5-Kernanalyse abschließen; S1/S6 erstellen den ersten vollständigen Befundentwurf                                              |
| W09       | alle Pfade schließen JASP-Kernanalyse und Befundentwurf ab                                                                      |
| W10       | ausschließlich Plausibilitätscheck, Peer Review, Überarbeitung und Management Summary; keine erstmalige Pfad- oder Methodenwahl |

Die [Statistikbefund-Vorlage](./P0-03_Statistikbefund_Vorlage_Rubrik.md) wird ab W03 fortgeschrieben. Ein Gruppenwechsel nach W03 wird nur aus organisatorischem Grund dokumentiert; er erzeugt keine personenbezogene Verlaufsanalyse.

---

## 6. Inhalts- und Lerneinheitenstruktur

| Block                            | Wochen | Inhaltlicher Schwerpunkt                                                                  | Fachbegriffe                                                                                                                                                                                                                                 | Methoden & Techniken                                                                                                                                                                                                    | Kompakter Formelbezug                                                | Beitrag der ARSnova-Fallstudie                                                                                               |
| -------------------------------- | -----: | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A: Daten verstehen               |    1–3 | Daten, Häufigkeiten, Visualisierung, Lage und Streuung                                    | Grundgesamtheit; Stichprobe; Beobachtungseinheit; Merkmal; Skalenniveau; absolute und relative Häufigkeit; Mittelwert; Median; Modus; Quantil; Varianz; Standardabweichung; IQR; Ausreißer                                                   | Datenprüfung; Häufigkeitstabelle; Balkendiagramm; Histogramm; Boxplot; Lage- und Streuungsmaße mit Formelsammlung und JASP; Plausibilitätsprüfung                                                                       | **A1–A6** im Formelschlüssel                                         | S1/S4: Schätzverteilungen und Servicezeiten; n versus n−1 prüfen; app-spezifische Quartile nur als V2 (Q2, Q3, Q8)           |
| B: Unsicherheit verstehen        |    4–5 | Wahrscheinlichkeit, bedingte Wahrscheinlichkeit, Verteilungen und Stichprobenvariabilität | Zufallsexperiment; Ergebnis; Ereignis; Gegenereignis; Unabhängigkeit; bedingte Wahrscheinlichkeit; Zufallsvariable; Erwartungswert; Binomialverteilung; Normalverteilung; Stichprobenverteilung; Standardfehler                              | Baumdiagramm; Kontingenz- und Vierfeldertafel; Rechnen mit absoluten Häufigkeiten; Bayes-Denken; Binomialmodell prüfen; Verteilungen lesen; vorbereitete Stichproben in JASP vergleichen                                | **B1–B6** im Formelschlüssel                                         | S2 und LEHRDATEN: Confidence-Kreuztabelle, Nenner und Bewertungsanteile; feste Simulationsdaten (Q4, Q5)                     |
| C: Aus Stichproben schließen     |    6–7 | Punktschätzung, Konfidenzintervalle und Hypothesentests                                   | Schätzer; Punktschätzung; Intervallschätzung; Konfidenzniveau; Standardfehler; Nullhypothese; Alternativhypothese; Signifikanzniveau; p-Wert; Fehler 1. und 2. Art; Effekt; gepaarte Daten                                                   | Konfidenzintervalle für unabhängige Anteils-/Mittelwertfragen berechnen und in JASP lesen; ausschließlich für vollständige metrische Paare den gepaarten t-Test ausführen; statistische und praktische Relevanz trennen | **C1–C4** im Formelschlüssel                                         | S1: Kursanteile und Mittelwerte schätzen; vollständige LEHRDATEN-Paare testen; Wilson-Ranking nur als V1 (Q3, Q6, Q7)        |
| D: Zusammenhänge und Modelle     |    8–9 | Korrelation, Regression, Train/Test, Overfitting und binäre ML-Evaluation                 | Streudiagramm; Korrelation; Kausalität; Regressionsgerade; Steigung; Achsenabschnitt; Vorhersage; Residuum; Bestimmtheitsmaß; Training; Test; Generalisierung; Overfitting; binäre Confusion Matrix; Accuracy; Precision; Recall; binärer F1 | Streudiagramm, Korrelation und Regression in JASP; Residuen und Extrapolation prüfen; Train/Test vergleichen; binäre Matrix auswerten; Metrik nach Fehlkosten auswählen                                                 | **D1–D7** im Formelschlüssel                                         | S5/S6: synthetische Last-Latenz-Regression und binäre LEHRDATEN-Klassifikation; V3–V6 nur gegatet (Q8, Q9)                   |
| E: Integrieren und kommunizieren |     10 | vollständiger Analysezyklus, Ergebniskommunikation und Klausurtraining                    | Untersuchungsfrage; Operationalisierung; Analyseplan; statistischer Befund; Limitation; Übertragbarkeit; Management Summary                                                                                                                  | Verfahren anhand von Frage und Skalenniveau auswählen; JASP-Ausgaben auf Plausibilität prüfen; Grafiken und Kennzahlen zusammenführen; Grenzen formulieren; Peer Review; Probeklausur                                   | **A1–D7 kumulativ**; die Formelauswahl ist Teil der Prüfungsleistung | S1–S6: Herkunft, Aggregationsrunde, Nenner und JASP-Version offenlegen; keine Kausal- oder Produktionsversprechen (Q10, Q16) |

Die Tabelle beschreibt den Pflichtkern. Wilson-Ranking, ARSnova-spezifische Quartilimplementierung, Macro-F1, Coverage/Schwellenwahl, Kalibrierung und Q&A-NLP bleiben ausschließlich die in Abschnitt 3.3 definierten Vertiefungen V1–V6 und sind nicht summativ prüfbar.

### 6.1 Formelschlüssel

Die folgenden Kürzel bilden den konzeptionellen Kern kompakt ab und stehen außerhalb der Tabelle, weil LaTeX-Ausdrücke in Markdown-Tabellen je nach Viewer nicht zuverlässig gerendert werden. Für Lehre und Klausur ist die ausführliche [Formelsammlung](./P0-03_Formelsammlung_Statistik.md) mit Auswahlregeln, Voraussetzungen, Einheiten, Konventionen und Warnungen maßgeblich.

#### Block A – Daten verstehen

**A1 – Relative Häufigkeit**

$$
h_i=\frac{n_i}{n}
$$

**A2 – Arithmetisches Mittel**

$$
\bar{x}=\frac{1}{n}\sum_{i=1}^{n}x_i
$$

**A3 – Spannweite**

$$
R=x_{\max}-x_{\min}
$$

**A4 – Interquartilsabstand**

$$
IQR=Q_3-Q_1
$$

**A5 – Stichprobenvarianz**

$$
s^2=\frac{1}{n-1}\sum_{i=1}^{n}(x_i-\bar{x})^2
$$

**A6 – Stichprobenstandardabweichung**

$$
s=\sqrt{s^2}
$$

#### Block B – Unsicherheit verstehen

**B1 – Gegenereignis**

$$
P(\bar A)=1-P(A)
$$

**B2 – Bedingte Wahrscheinlichkeit**

$$
P(A\mid B)=\frac{P(A\cap B)}{P(B)}
$$

**B3 – Multiplikationsregel**

$$
P(A\cap B)=P(A\mid B)\cdot P(B)
$$

**B4 – Binomialwahrscheinlichkeit**

$$
P(X=k)=\binom{n}{k}p^k(1-p)^{n-k}
$$

**B5 – Standardisierung**

$$
z=\frac{x-\mu}{\sigma}
$$

**B6 – Geschätzter Standardfehler des Mittelwerts**

$$
SE(\bar{x})=\frac{s}{\sqrt{n}}
$$

#### Block C – Aus Stichproben schließen

**C1 – Geschätzter Standardfehler eines Anteils**

$$
SE(\hat p)=\sqrt{\frac{\hat p(1-\hat p)}{n}}
$$

**C2 – Approximatives Konfidenzintervall für einen Anteil**

$$
KI_p=\hat p\pm z_{1-\alpha/2}\cdot SE(\hat p)
$$

C1/C2 sind die einfache Wald-Näherung: nur bei ausreichend großen erwarteten Erfolgs- und Misserfolgszahlen im gewählten Modell einsetzen (Lehrregel: beide mindestens 10). Bei kleinen n oder Anteilen nahe 0/1 wird ein bereitgestelltes geeignetes Intervall gelesen. Die Wilson-Untergrenze im Q&A-Ranking ist weder der beobachtete Anteil noch das gesamte Intervall; dieser Vergleich gehört ausschließlich zu V1 und wird nicht summativ geprüft. Ein Intervall beseitigt keine Selbstselektionsverzerrung.

**C3 – Konfidenzintervall für einen Mittelwert**

$$
KI_\mu=\bar{x}\pm t_{1-\alpha/2;\,n-1}\frac{s}{\sqrt{n}}
$$

**C4 – Teststatistik des gepaarten t-Tests**

$$
t=\frac{\bar d}{s_d/\sqrt{n}}
$$

Für C4 gilt hier: dᵢ = absoluter Fehler in Runde 1 minus absoluter Fehler in Runde 2; positive Werte bedeuten Verbesserung. n zählt vollständige Paare, H₀: μ_d = 0. Voraussetzung der Lehrrechnung sind unabhängige Paare und hinreichend verträgliche Differenzen (bei kleinem n näherungsweise normal, keine dominierenden Ausreißer). Abhängigkeiten durch Diskussionsgruppen werden als Grenze ausgewiesen.

#### Block D – Zusammenhänge und Modelle

**D1 – Pearson-Korrelation**

$$
r=\frac{\sum_{i=1}^{n}(x_i-\bar{x})(y_i-\bar{y})}
{\sqrt{\sum_{i=1}^{n}(x_i-\bar{x})^2\sum_{i=1}^{n}(y_i-\bar{y})^2}}
$$

**D2 – Einfache lineare Regression**

$$
\hat y=b_0+b_1x
$$

**D3 – Residuum**

$$
e_i=y_i-\hat y_i
$$

**D4 – Accuracy**

$$
Accuracy=\frac{TP+TN}{TP+TN+FP+FN}
$$

**D5 – Precision**

$$
Precision=\frac{TP}{TP+FP}
$$

**D6 – Recall**

$$
Recall=\frac{TP}{TP+FN}
$$

**D7 – Binärer F1-Score**

$$
F1=2\cdot\frac{Precision\cdot Recall}{Precision+Recall}
$$

---

## 7. Detaillierter Wochenplan: 10 Wochen mit 24 LE und 48 UE

Die Präsenzlehre besteht aus **24 Vorlesungs- beziehungsweise Lerneinheiten à 90 Minuten**. Jede LE umfasst genau zwei aufeinanderfolgende UE. W01, W02, W04, W06, W08 und W10 enthalten je zwei LE beziehungsweise vier UE; W03, W05, W07 und W09 je drei LE beziehungsweise sechs UE. Damit gilt:

\[
6\cdot 2\,\text{LE}+4\cdot 3\,\text{LE}=24\,\text{LE}=48\,\text{UE}=36\,\text{Stunden Präsenz}.
\]

Die jeweils letzte UE einer Woche ist verbindlich der gemeinsame MC-Test-Abschluss: 32 Minuten erster Durchlauf im Modus `practice`, 10 Minuten Besprechung aggregierter Ergebnisse, Lösungen und Distraktoren sowie 3 Minuten Sicherung des Spaced-Repetition-Auftrags. Der Test ist technisch untimiert; die 32 Minuten sind ein organisatorischer Richtwert. Die fachliche Erarbeitung und der JASP-Wochenertrag werden in der ersten UE dieser letzten LE abgeschlossen.

JASP 0.98.1 ist in jeder Woche verbindlich. Studierende installieren die frei verfügbare Software auf einem kompatiblen Laptop oder Desktop-Rechner. Wo das nicht möglich ist, sichern Partner-/Kleingruppenarbeit, Lehrdemonstration und vorbereitete gleichwertige Ausgaben den Zugang. Der jeweilige Wochenertrag lautet:

| Woche | Verbindlicher JASP-Wochenertrag                                                     |
| ----: | ----------------------------------------------------------------------------------- |
|     1 | Datei öffnen; Zeilen, Variablen, Beobachtungseinheit und Messniveaus identifizieren |
|     2 | Häufigkeitstabelle, Balkendiagramm/Histogramm und Deskriptivübersicht               |
|     3 | Lage- und Streuungsmaße sowie Boxplot mit und ohne markierten Ausreißer             |
|     4 | Kontingenztafel mit Rand-, Zeilen- und Spaltenanteilen                              |
|     5 | Verteilungsvergleich vorbereiteter Stichproben beziehungsweise Resamples            |
|     6 | Konfidenzintervalle für Anteil und Mittelwert lesen und dokumentieren               |
|     7 | gepaarter t-Test mit Voraussetzungen, Intervall und Ergebnisinterpretation          |
|     8 | Korrelations- und Regressionsausgabe mit Residualdiagnostik                         |
|     9 | Train/Test-Vergleich und dokumentierte Auswertung einer binären Matrix              |
|    10 | finaler JASP-Kernauszug mit höchstens fünf Sätzen Befund und Grenze                 |

## Woche 1 – Statistisches Denken, Daten und Messung

**Wochenziele:** Die Studierenden unterscheiden Grundgesamtheit und Stichprobe, identifizieren Beobachtungseinheiten und Merkmale, ordnen Skalenniveaus zu und erkennen erste Verzerrungsquellen.

| LE (UE)       | Inhalt und Ablauf                                                                                                                                                                                                         | ARSnova-/JASP-Bezug                                                                                                      | Lernprodukt/Evidenz                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| LE 1 (UE 1–2) | Höchstens fünfminütiges Debrief der vorab ausgewerteten Mathematikdiagnostik; Modul, Prüfung und Fehlerkultur. Untersuchungsfrage, Grundgesamtheit, Stichprobe, Beobachtungseinheit und Merkmal; S1-Datei in JASP öffnen. | Keine Diagnoseantwort wird in ARSnova erfasst. LIVE-Einstieg als SURVEY/Blitzlicht; S1 verwendet synthetische LEHRDATEN. | Individueller Brückenpfad; überprüfbare Frage; Importprotokoll mit Zeile, Variable, Einheit und Population. |
| LE 2 (UE 3–4) | Skalenniveaus, zulässige Operationen, Datenqualität, Selbstselektion, Nonresponse und Aussagegrenzen. In UE 4: MC-Test W01 und gemeinsame Lösungsbesprechung.                                                             | ARSnova-Fragetypen und Confidence einordnen; Antwortzeit nicht als Kompetenzmaß behandeln.                               | Zuordnungstabelle; Kurzbefund mit zwei zulässigen und zwei unzulässigen Aussagen; MC-Fehlernotiz.           |

**Spaced-Repetition-Nachlauf:** Vor UE 1 Mathematikdiagnostik; MC W01 nach zwei bis drei Tagen erneut bearbeiten und erforderlichen Brückenpfad vertiefen.<br>
**Fallstudien-Meilenstein:** S1, S5 und S6 vergleichen; Datenprotokoll und Variablenkatalog anlegen.

## Woche 2 – Häufigkeiten, Diagramme und Lage

**Wochenziele:** Die Studierenden berechnen absolute und relative Häufigkeiten, wählen geeignete Diagramme und interpretieren Mittelwert, Median und Modus.

| LE (UE)       | Inhalt und Ablauf                                                                                                                                                                                      | ARSnova-/JASP-Bezug                                                                                                                | Lernprodukt/Evidenz                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| LE 3 (UE 5–6) | Absolute und relative Häufigkeit, Anteil, Prozent und Nenner; Balken-, Kreis- und Histogrammeinsatz, Achsen, Klassenbildung und Manipulationen.                                                        | Single Choice versus Multiple Choice; Live-Antwortbalken und Schätzhistogramm kritisch lesen.                                      | Häufigkeitstabelle mit Bezugsgröße; begründete Diagrammwahl und erkannter Achsenfehler.            |
| LE 4 (UE 7–8) | Mittelwert, Median, Modus, Schiefe und Robustheit; S1-Servicezeiten in JASP beschreiben und zwei Kennwerte per Formelsammlung prüfen. In UE 8: MC-Test W02, Ergebnisdiskussion und Lösungserläuterung. | Verdeckten Mittelwert 120 s schätzen; Extremwert nur in einer Lehrdatenkopie ergänzen; Aggregate nicht zu Rohwerten zurückrechnen. | Vollständige Interpretation eines Lagewerts; JASP-Auszug; Entscheidung für ein geeignetes Lagemaß. |

**Spaced-Repetition-Nachlauf:** MC W02 nach zwei bis drei Tagen erneut bearbeiten; Diagrammfehler und Nennerfragen aus W01/W02 gezielt wiederholen.<br>
**Fallstudien-Meilenstein:** Deskriptiver Kurzbericht; unverbindliche Präferenz für S1, S5 oder S6 mit erster Untersuchungsfrage.

## Woche 3 – Streuung, Quantile und Ausreißer

**Wochenziele:** Die Studierenden erklären, warum Lage allein nicht genügt, und berechnen beziehungsweise interpretieren Spannweite, Quartile, IQR, Varianz und Standardabweichung.

| LE (UE)         | Inhalt und Ablauf                                                                                                                                                                                                | ARSnova-/JASP-Bezug                                                                                            | Lernprodukt/Evidenz                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| LE 5 (UE 9–10)  | Gleiche Lage bei unterschiedlicher Streuung; Spannweite, Abweichung vom Mittelwert, Varianz und Standardabweichung. Deskriptive Division durch \(n\) und Stichprobenschätzer mit \(n-1\) fachlich unterscheiden. | S1-Schätzwerte mit beiden Konventionen auswerten; ARSnova-Anzeige und Formelsammlung korrekt benennen.         | Rechenweg mit Einheit, Benennung der Konvention und Plausibilitätskontrolle. |
| LE 6 (UE 11–12) | Median, Quartile, IQR, Boxplot und Ausreißerregel; JASP-Ausgabe und vorgegebene Handkonvention vergleichen.                                                                                                      | S1-LEHRDATEN; ARSnova-Indexregel nur bei offenem V2-Gate und nicht als Pflichtverfahren.                       | Boxplot lesen, schiefe Verteilung beschreiben und Quartilkonvention nennen.  |
| LE 7 (UE 13–14) | Median, p95 und p99 für Antwort- und Systemlatenzen; S1 mit und ohne Extremwert in JASP vergleichen. In UE 14: MC-Test W03, Ergebnisdiskussion und Lösungserläuterung.                                           | S1-LEHRDATEN und dokumentierte REPO-Latenzquantile getrennt halten; keine Rohwerte aus p95/p99 rekonstruieren. | JASP-Kennzahlenübersicht und Kurzbefund mit Einschränkung; MC-Fehlernotiz.   |

**Spaced-Repetition-Nachlauf:** MC W03 nach zwei bis drei Tagen wiederholen; Lage-, Häufigkeits- und Datenqualitätsfragen erscheinen erneut mit zeitlichem Abstand.<br>
**Fallstudien-Meilenstein:** Verbindliche Wahl von S1, S5 oder S6; Gruppe, Rollen, `source_ref`, Datenprotokoll und JASP-Auszug festhalten.

## Woche 4 – Wahrscheinlichkeit und bedingte Wahrscheinlichkeit

**Wochenziele:** Die Studierenden bestimmen einfache Wahrscheinlichkeiten, nutzen Kontingenztafeln und interpretieren bedingte Wahrscheinlichkeiten korrekt.

| LE (UE)         | Inhalt und Ablauf                                                                                                                                                                                    | ARSnova-/JASP-Bezug                                                                               | Lernprodukt/Evidenz                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| LE 8 (UE 15–16) | Zufallsexperiment, Ergebnis, Ereignis, Gegenereignis; empirische und theoretische Wahrscheinlichkeit; zweistufige Experimente, Baumdiagramm und Multiplikationsregel.                                | Live-Zufallsfrage und Münzwurf-Demo; Transfer auf idealisiert unabhängige Serviceereignisse.      | Ereignisse in Mengen- und Alltagssprache; vollständiges Baumdiagramm mit Annahmen.            |
| LE 9 (UE 17–18) | Kontingenztafel aus Korrektheit × Confidence; Rand- und bedingte Häufigkeiten, inverse Bedingungen und Basisratenidee; JASP-Tafel erzeugen. In UE 18: MC-Test W04 und gemeinsame Lösungsbesprechung. | S2 verwendet LEHRDATEN; Confidence bleibt ordinal und freiwillig; alternative Teilnahme anbieten. | Dokumentierte 2×3-Tafel; korrekte Interpretation zweier inverser Bedingungen; MC-Fehlernotiz. |

**Spaced-Repetition-Nachlauf:** MC W04 nach zwei bis drei Tagen wiederholen; ältere Lage-, Streuungs- und Nennerkonzepte bleiben im kumulativen Mix.<br>
**Fallstudien-Meilenstein:** Sicherheits-Korrektheits-Matrix und eine Datenqualitätsgrenze des gewählten Abschlussstrangs ergänzen.

## Woche 5 – Zufallsvariablen, Verteilungen und Stichprobenvariabilität

**Wochenziele:** Die Studierenden erkennen ausgewählte Verteilungen, unterscheiden Parameter und Statistik und erklären, warum Stichprobenergebnisse schwanken.

| LE (UE)          | Inhalt und Ablauf                                                                                                                                                                       | ARSnova-/JASP-Bezug                                                                                                                                         | Lernprodukt/Evidenz                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| LE 10 (UE 19–20) | Zufallsvariable, Wahrscheinlichkeitsverteilung und Erwartungswert; diskrete und stetige Variablen.                                                                                      | Anzahl korrekter Antworten versus technische Antwortzeit; langfristigen Mittelwert nicht mit Einzelergebnis verwechseln.                                    | Variablen korrekt klassifizieren und Verteilung sprachlich beschreiben.                    |
| LE 11 (UE 21–22) | Binomialmodell mit seinen Bedingungen; Normalverteilung, Symmetrie, Lage, Streuung und Standardisierung auf Interpretationsebene.                                                       | Unterschiedliche Itemschwierigkeiten als Grenze eines Binomialmodells; S1-Histogramm nicht automatisch als normal behandeln.                                | Modellprüfliste und begründete Auswahl beziehungsweise Ablehnung eines Modells.            |
| LE 12 (UE 23–24) | Stichprobenvariabilität mit vorbereiteten Resamples; JASP-Vergleich nach Stichprobengröße beziehungsweise Lehrmodell. In UE 24: MC-Test W05, Ergebnisdiskussion und Lösungserläuterung. | Population der Simulation von realer Studierendenpopulation unterscheiden; ARSnova sammelt Interpretationen, erzeugt aber keine native Sampling-Simulation. | Annotierte JASP-Grafik mit Aussage zu Streuung und Generalisierungsgrenze; MC-Fehlernotiz. |

**Spaced-Repetition-Nachlauf:** MC W05 nach zwei bis drei Tagen wiederholen; Verteilungsbedingungen und ältere Datenkritik in späteren Fragensätzen erneut prüfen.<br>
**Fallstudien-Meilenstein:** Visualisierung der Stichprobenvariabilität und konkrete Generalisierungsgrenze des gewählten Strangs.

## Woche 6 – Schätzen und Konfidenzintervalle

**Wochenziele:** Die Studierenden unterscheiden Punkt- und Intervallschätzung, berechnen einfache Intervalle mit Formelsammlung und vermeiden Fehlinterpretationen eines 95-%-Konfidenzintervalls.

| LE (UE)          | Inhalt und Ablauf                                                                                                                                                                                      | ARSnova-/JASP-Bezug                                                                                                                               | Lernprodukt/Evidenz                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| LE 13 (UE 25–26) | Punktschätzung, Standardfehler und Einfluss von \(n\); Konfidenzintervall für einen Anteil mit bereitgestellter Formel und JASP-Ausgabe, einschließlich Einsatzgrenzen der Wald-Näherung.              | Kursanteil mit Zähler und Nenner; Wilson-Untergrenze nur als V1-Rankingsignal und nicht summativ.                                                 | Zwei gleich hohe Anteile hinsichtlich Präzision vergleichen; Intervall berechnen oder lesen.     |
| LE 14 (UE 27–28) | Mittelwertintervall, Rolle von Streuung und Stichprobengröße, korrekte Interpretation; JASP-Vergleich von Anteils- und Mittelwertintervallen. In UE 28: MC-Test W06 und gemeinsame Lösungsbesprechung. | S1 verwendet den Stichprobenschätzer mit \(n-1\); Peer Instruction zu konkurrierenden Intervallaussagen; Präzision und Repräsentativität trennen. | Musterformulierung mit Population, Parameter und Grenze; JASP-Vergleichstabelle; MC-Fehlernotiz. |

**Spaced-Repetition-Nachlauf:** MC W06 nach zwei bis drei Tagen wiederholen; Intervallinterpretationen und ältere Deskription nach zwei bis vier Wochen erneut abrufen.<br>
**Fallstudien-Meilenstein:** Analyseplan für den gewählten Strang; Punktschätzer und Intervall dokumentieren, spätere Methode als Platzhalter markieren.

## Woche 7 – Hypothesentests und Vorher-Nachher-Vergleiche

**Wochenziele:** Die Studierenden erklären die Logik eines Hypothesentests, interpretieren p-Werte und beurteilen einen einfachen Vorher-Nachher-Vergleich inhaltlich.

| LE (UE)          | Inhalt und Ablauf                                                                                                                                                                                                               | ARSnova-/JASP-Bezug                                                                                                            | Lernprodukt/Evidenz                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| LE 15 (UE 29–30) | Ausgangsfrage, Null- und Alternativhypothese; Teststatistik als Maß der Unvereinbarkeit mit \(H_0\).                                                                                                                            | S1 verwendet vorab definierte Referenz und absolute Fehler je Runde; beobachtete Veränderung ist keine vorausgesetzte Wirkung. | \(H_0\) und \(H_1\) in Worten und Symbolen formulieren.                                              |
| LE 16 (UE 31–32) | p-Wert, Signifikanzniveau, statistische Entscheidung, Fehler 1. und 2. Art sowie statistische versus praktische Relevanz.                                                                                                       | ARSnova-Peer-Instruction zu p-Wert-Fehlinterpretationen; Fehlerkosten und MAE getrennt beurteilen.                             | p-Wert korrekt interpretieren; Entscheidungsmatrix zu Fehlerarten.                                   |
| LE 17 (UE 33–34) | Gepaarter t-Test in JASP: Differenzen, Voraussetzungen, Intervall und Ergebnis; Verfahrensmatrix für Anteil, unabhängigen Mittelwert und vollständige metrische Paare. In UE 34: MC-Test W07 und gemeinsame Lösungsbesprechung. | S1 nutzt gesonderte vollständige LEHRDATEN-Paare; Standardexport ersetzt keine Paartabelle; `n_pairs` sichtbar machen.         | JASP-Auszug und Entscheidungsbaum; Verfahren, Effekt, Bedeutung und Grenze benennen; MC-Fehlernotiz. |

**Spaced-Repetition-Nachlauf:** MC W07 nach zwei bis drei Tagen wiederholen; Testlogik und ältere Verteilungsfragen kehren nach zwei bis vier Wochen wieder.<br>
**Fallstudien-Meilenstein:** S1 schließt die Kernanalyse ab; S5/S6 aktualisieren Analyseplan und Verfahrensbegründung.

## Woche 8 – Korrelation und lineare Regression

**Wochenziele:** Die Studierenden lesen Streudiagramme, interpretieren Korrelationen, erkennen deren Grenzen und verwenden eine Regressionsgerade für einfache Vorhersagen.

| LE (UE)          | Inhalt und Ablauf                                                                                                                                                                                | ARSnova-/JASP-Bezug                                                                                                                     | Lernprodukt/Evidenz                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| LE 18 (UE 35–36) | Zwei metrische Variablen und Streudiagramm; Richtung, Form, Stärke, Cluster und Ausreißer; Pearson-Korrelation, Vorzeichen, Stärke und Kausalitätsgrenze.                                        | S5 nutzt synthetische Lastläufe mit gleicher Hardware und gleichem Requestmix; Confidence-Stufen bleiben ordinal.                       | Systematische Grafikbeschreibung; drei zulässige und unzulässige Schlussfolgerungen. |
| LE 19 (UE 37–38) | Einfache lineare Regression, Steigung, Achsenabschnitt, Vorhersage, Residuum, Güte, Extrapolation und JASP-Residualdiagnostik. In UE 38: MC-Test W08, Ergebnisdiskussion und Lösungserläuterung. | S5 in JASP mit LEHRDATEN; ARSnova erfasst Vorhersagen und Begründungen, schätzt aber keine Regression; keine Produktions-SLO behaupten. | Modellsteckbrief, Vorhersage, Residuum und Sensitivitätsvergleich; MC-Fehlernotiz.   |

**Spaced-Repetition-Nachlauf:** MC W08 nach zwei bis drei Tagen wiederholen; Korrelation, Regression und ältere Intervallkonzepte werden zeitlich verteilt erneut geprüft.<br>
**Fallstudien-Meilenstein:** S5 schließt die Kernanalyse ab; S1/S6 erstellen einen vollständigen Befundentwurf.

## Woche 9 – Train/Test, Overfitting und binäre Klassifikationsmetriken

**Wochenziele:** Die Studierenden erklären Generalisierung, erkennen Overfitting, lesen eine binäre Confusion Matrix und wählen Accuracy, Precision, Recall oder binären F1 anhand der Fehlkosten.

| LE (UE)          | Inhalt und Ablauf                                                                                                                                                                        | ARSnova-/JASP-Bezug                                                                                                                              | Lernprodukt/Evidenz                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| LE 20 (UE 39–40) | Grundgesamtheit zukünftiger Fälle, Stichprobe, Trainings- und Testdaten; Overfitting, Generalisierung und einfache Validierungslogik.                                                    | Vorbereiteter Train/Test-Lehrfall; optionaler Q&A-NLP-Pfad für den Pflichtkern nicht erforderlich; Leistungsabstand ist kein eindeutiger Beweis. | Zuordnung klassischer Statistik- zu ML-Begriffen; Diagnose plus plausible Alternativerklärung. |
| LE 21 (UE 41–42) | Binäre Confusion Matrix; True/False Positive/Negative; Accuracy, Precision und Recall; Metrikwahl nach Fehlerkosten.                                                                     | S6 mit 80 synthetischen Fällen; Zeilen sind tatsächliche Klassen; JASP-Kontingenztafel mit sichtbaren Nennern.                                   | Matrix und Kennzahlen prüfen; Zielmetrik begründet auswählen.                                  |
| LE 22 (UE 43–44) | Binären F1 berechnen; Modellwert, Gruppenhäufigkeit und Einzelergebnis unterscheiden; JASP-Modellauszug dokumentieren. In UE 44: MC-Test W09, Ergebnisdiskussion und Lösungserläuterung. | V3–V6 nur bei gesichertem Kern; keine Einzelbeobachtungen aus REPO-Werten rekonstruieren und keine Produktivqualität behaupten.                  | Einseitige Modellkarte mit Metrik, Fehlkosten, Nenner und Grenze; MC-Fehlernotiz.              |

**Spaced-Repetition-Nachlauf:** MC W09 nach zwei bis drei Tagen wiederholen; Inferenz, Regression und Datenkritik bleiben Bestandteil des kumulativen Plans.<br>
**Fallstudien-Meilenstein:** S1, S5 und S6 schließen JASP-Kernanalyse und vollständigen Befundentwurf ab; S6 ergänzt Zielmetrik, Fehlkosten und Grenze.

## Woche 10 – Integration, Kommunikation und Klausurtraining

**Wochenziele:** Die Studierenden führen die Schritte einer statistischen Untersuchung zusammen, wählen Verfahren begründet aus, kommunizieren Ergebnisse und bereiten sich transparent auf die Klausur vor.

| LE (UE)          | Inhalt und Ablauf                                                                                                                                                                                                           | ARSnova-/JASP-Bezug                                                                                                                   | Lernprodukt/Evidenz                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| LE 23 (UE 45–46) | Qualitätswerkstatt für den bis W09 vorliegenden Entwurf; Quelle, Beobachtungseinheit, Verfahren, JASP-Werte und Aussagegrenze prüfen. Befundredaktion, Peer Review, Grafik-/Tabellenbeschriftung und Management Summary.    | S1/S5/S6 verwenden nur ausreichende LEHRDATEN und freigegebene getrennte Aggregate; RATING/SURVEY nur als freiwilliges Peer-Feedback. | Geprüfter JASP-Kernauszug, priorisierte Korrekturliste und finaler Statistikbefund.               |
| LE 24 (UE 47–48) | Probeklausur-Miniatur, isomorpher Transfervergleich, Prüfungsstrategie und interne Modulevaluation. In UE 48: kumulativer MC-Test W10, Ergebnisdiskussion, Lösungserläuterung und individueller Spaced-Repetition-Lernplan. | Kumulatives ARSnova-Lernquiz mit Gamification ohne Notenwirkung; BWL-/WI-Parallelaufgabe; Abschluss-SURVEY ohne Personenverknüpfung.  | Individuelle Fehlerliste, Prüfungsstrategie, fünf Sätze Management Summary und internes Feedback. |

**Spaced-Repetition-Nachlauf:** MC W10 gezielt anhand der Fehlerliste wiederholen; die vollständige Probeklausur unter 90-Minuten-Bedingung bearbeiten.<br>
**Fallstudien-Meilenstein:** final überarbeiteter JASP-gestützter Statistikbefund zum seit W03 gewählten LEHRDATEN-Strang; kein neuer Analysebeginn in W10.

---

## 8. Constructive Alignment

| Modulziel                                             | Typische Lernaktivität                            | Formative Evidenz aus ARSnova, MC-Test und JASP                            | Summative Evidenz                                                       |
| ----------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| MZ1: Daten strukturieren und beurteilen               | Fallvignette, Datenprüfung, Skalenzuordnung       | pseudonyme Concept Question, MC-Fehlerdiagnose, dokumentierter JASP-Import | Datenstruktur und Aussagegrenze begründen                               |
| MZ2: Daten beschreiben und visualisieren              | Handrechnung und JASP-Deskription                 | Schätzverteilung, MC-Spaced-Repetition, beschriftete JASP-Tabelle/Grafik   | Kennzahl oder Darstellung auswählen, berechnen/lesen und interpretieren |
| MZ3: Zufall und Stichprobenunsicherheit modellieren   | Baum-/Kontingenztafel und Stichprobenvergleich    | Live-Entscheidung, zeitlich verteilter MC-Abruf, JASP-Verteilungsvergleich | Wahrscheinlichkeit oder Modell wählen und Unsicherheit erklären         |
| MZ4: Schätzen und testen                              | Intervallvergleich, Testlogik, gepaarte LEHRDATEN | Peer Instruction, MC-Fehlerkontrast, JASP-Intervall/Testausgabe            | rechnen oder Ausgabe lesen, interpretieren und begrenzen                |
| MZ5: Zusammenhänge und Vorhersagen beurteilen         | Streudiagramm, Regression und Train/Test-Fall     | Live-Befund, MC-Transfer, JASP-Korrelation/Regression                      | Vorhersage, Residuum, Generalisierung und Grenze beurteilen             |
| MZ6: Binäre Klassifikation evaluieren                 | binäre Confusion Matrix und Fehlkostenfall        | ARSnova-Entscheidung, MC-Rechnung, JASP-Kreuztabelle                       | binäre Metrik berechnen/auswählen und Modellwert abgrenzen              |
| MZ7: Statistische Evidenz kommunizieren und begrenzen | einseitiger Statistikbefund und Peer Review       | JASP-Kernauszug, Rubrikfeedback, Management Summary                        | integrierter Kurzbefund mit Datenkritik                                 |

V1–V6 erscheinen in dieser Alignment-Tabelle nicht, weil sie weder Modulziele noch summative Evidenz begründen.

---

## 9. Prüfungs- und Bewertungskonzept

### 9.1 Formative, nicht benotete Elemente

- freiwillige ARSnova-Diagnose- und Lernfragen mit pseudonymer Gamification ohne Notenwirkung sowie unbewertete Blitzlichter,
- gezielte Peer-Instruction mit erneuter Abstimmung,
- wöchentlicher MC-Test mit 30 Fragen in der letzten Präsenz-UE, gemeinsamer Lösungsbesprechung und Spaced-Repetition-Nachläufen,
- wöchentlicher JASP-Nachweis mit Quelle, Analyse, Interpretation und Grenze,
- eine klausurnahe Kurzaufgabe pro Woche,
- Fallstudien-Meilensteine mit knapper Rückmeldung.

ARSnova-Rangliste, Zeitphasen, Teamwertung, Boni und Effekte dienen ausschließlich der Lern- und Aufmerksamkeitsmotivation. Sie werden weder als Kompetenzmaß noch für Noten verwendet. Auch MC-Test- und JASP-Lernartefakte haben keine Notenwirkung.

### 9.2 Summative Klausur (Vorschlag)

| Bereich                                         | Richtwert |
| ----------------------------------------------- | --------: |
| Daten, Visualisierung und deskriptive Statistik |      20 % |
| Wahrscheinlichkeit und Verteilungen             |      15 % |
| Stichproben und Konfidenzintervalle             |      15 % |
| Hypothesentests                                 |      15 % |
| Korrelation und Regression                      |      15 % |
| Train/Test und binäre ML-Evaluation             |      15 % |
| integrierte Datenkritik/Kommunikation           |       5 % |

Angestrebt wird ungefähr **40 % Rechnen** und **60 % Auswählen, Anwenden, Interpretieren und Begründen**. Die [verbindliche Formelsammlung](./P0-03_Formelsammlung_Statistik.md) ist ab Woche 1 fester Bestandteil der Lehre. Sie enthält zu jeder Formel:

- Bedeutung der Größen,
- Voraussetzungen und Skalenniveau,
- typische Einsatzsituation,
- Einheit des Ergebnisses,
- zentrale Interpretations- oder Fehlerwarnung.

Die Klausur prüft ausschließlich MZ1–MZ7 beziehungsweise LI01–LI24. V1–V6 – Wilson-Ranking, app-spezifische Quartilimplementierung, Macro-F1, Coverage/Schwellenwahl, Kalibrierung und Q&A-NLP – sind ausgeschlossen.

Die Klausur prüft nicht das Auswendiglernen von Formeln, sondern deren angemessene Auswahl und Verwendung. Vorbereitete, vollständig beschriftete Ausschnitte aus JASP 0.98.1 dürfen als Material gelesen und interpretiert werden; weder Installation noch Menüpfad oder Softwarebedienung werden unter Prüfungszeit verlangt. Die [Probeklausur](./P0-03_Probeklausur_90_Minuten.md) und ihre [Musterlösung](./P0-03_Probeklausur_Musterloesung.md) setzen diesen Rahmen mit ausschließlich freigegebenen LEHRDATEN um. Ihr verbindliches 60-Punkte-Mapping bildet die sieben Bereiche mit `12/9/9/9/9/9/3` Punkten ab; der formative Gruppenbefund bleibt von den drei individuellen MZ7-Klausurpunkten getrennt.

### 9.3 Beispiel für eine integrierte Klausuraufgabe

> In einem konstruierten LEHRDATEN-Auszug (`source_ref=P0-03-PROBEKLAUSUR-A3-WILSON-V1`) beantworten 37 von 52 Studierenden eine Frage korrekt. Ein 95-%-Wilson-Konfidenzintervall für den zugrunde liegenden Anteil wird gerundet mit $[0{,}58;0{,}82]$ angegeben.
>
> 1. Berechnen Sie den beobachteten Anteil korrekter Antworten.
> 2. Interpretieren Sie das Intervall im Kontext.
> 3. Erklären Sie, warum daraus nicht ohne Weiteres auf alle Studierenden betriebswirtschaftlicher und managementorientierter Studiengänge geschlossen werden darf.
> 4. Nennen Sie eine Änderung der Datenerhebung, die die Übertragbarkeit verbessern könnte.

Die Aufgabe verbindet Rechnen, Interpretation, Stichprobenkritik und Untersuchungsdesign.

---

## 10. Feedback- und Steuerungskonzept

Lehrentscheidungen werden sichtbar an formative Evidenz gekoppelt. Der implementierte regelbasierte Moderationskompass kann Quellen und Vorschläge bündeln; er entscheidet nicht automatisch über Wiederholung oder zweite Runde. Die hier genannte 67-%-Regel ist eine didaktische Setzung, keine Behauptung über einen eingebauten App-Schwellenwert (Q14):

| Signal                                              | Reaktion in der Lehre                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| weniger als ca. 67 % korrekte Antworten             | Konzept in der Folgewoche mit neuem Beispiel erneut aufgreifen                 |
| viele sichere, aber falsche Antworten               | Fehlvorstellung explizit kontrastieren; Peer-Instruction einsetzen             |
| viele unsichere, aber richtige Antworten            | Begründung und Transfer stärken, nicht nur Lösung wiederholen                  |
| Blitzlicht zeigt Überforderung                      | Tempo reduzieren, Zwischenschritt oder Worked Example ergänzen                 |
| große Streuung der Leistung                         | gestufte Basis- und Zusatzaufgaben zum selben Pflichtkern anbieten             |
| wiederholte Fehler bei Rechenweg                    | Formelsammlungsroutine und Einheitenprüfung trainieren                         |
| Kernquote unter 67 % oder dominante Fehlvorstellung | zugehöriges V1–V6-Gate schließen und vorgesehene Kern-Ersatzhandlung einsetzen |

Ein kurzes Lehrendenprotokoll hält wöchentlich fest:

1. Welche zwei Konzepte waren sicher?
2. Welche zwei Fehlvorstellungen waren sichtbar?
3. Was wird in der nächsten Woche erneut aufgegriffen?
4. Welche freigegebenen Aggregate dürfen nach dem Datenmanagement- und Exportplan für Lehre oder interne Modulevaluation übernommen werden?

---

## 11. Medien, Materialien und technische Organisation

### 11.1 Erforderliche Materialien

Zum vollständigen Materialbestand gehören:

- die [Formelsammlung](./P0-03_Formelsammlung_Statistik.md), der [JASP-Analyseleitfaden](./P0-03_JASP_Analyseleitfaden.md), das [Lehrenden-Runbook](./P0-03_Lehrenden_Runbook.md), das [Datenwörterbuch mit Provenienz](./P0-03_Datenwoerterbuch_Provenienz.md), die [Mathematikdiagnostik mit Brückenpfaden](./P0-03_Mathematikdiagnostik_Brueckenpfade.md), die [Transfermatrix](./P0-03_Transfermatrix_BWL_WI.md) und die [Material-/A11y-Probe](./P0-03_Barrierefreiheit_Material_und_Probe.md);
- sieben synthetische Lehrdaten-CSV: [S1 Servicezeiten](./P0-03_Lehrdaten_S1_Servicezeiten.csv), [S1 Paare](./P0-03_Lehrdaten_S1_Paare.csv), [S2 Confidence](./P0-03_Lehrdaten_S2_Confidence.csv), [S3 Q&A-Ranking](./P0-03_Lehrdaten_S3_QA_Ranking.csv), [S5 Last/Latenz](./P0-03_Lehrdaten_S5_Last_Latenz.csv), [S6 Klassifikation](./P0-03_Lehrdaten_S6_Klassifikation.csv) und [S6 Modellläufe](./P0-03_Lehrdaten_S6_Modelllaeufe.csv);
- die [Statistikbefund-Vorlage mit Rubrik](./P0-03_Statistikbefund_Vorlage_Rubrik.md), die [Probeklausur](./P0-03_Probeklausur_90_Minuten.md) und die [Musterlösung](./P0-03_Probeklausur_Musterloesung.md);
- die frei verfügbare JASP-Version 0.98.1 zur lokalen Installation auf einem kompatiblen Laptop oder Desktop-Rechner, einen nicht programmierbaren Taschenrechner sowie ein browserfähiges Gerät oder eine gleichwertige papierbasierte Alternative.

**Externer MC-Test:** Maßgeblich sind der [MC-Test-Blueprint](./P0-03_MC-Test_Blueprint_10_Wochen.md), die [Live-Instanz](https://mc-test.streamlit.app) und die zehn `meta`-/`questions`-Dateien:

- [W01](./P0-03_MC-Test_Woche_01.json), [W02](./P0-03_MC-Test_Woche_02.json), [W03](./P0-03_MC-Test_Woche_03.json), [W04](./P0-03_MC-Test_Woche_04.json), [W05](./P0-03_MC-Test_Woche_05.json), [W06](./P0-03_MC-Test_Woche_06.json), [W07](./P0-03_MC-Test_Woche_07.json), [W08](./P0-03_MC-Test_Woche_08.json), [W09](./P0-03_MC-Test_Woche_09.json) und [W10](./P0-03_MC-Test_Woche_10.json).

**ARSnova.eu-Livequiz:** Maßgeblich sind der [Livequiz-Blueprint](./P0-03_ARSnova_Livequiz_Blueprint_10_Wochen.md) und die zehn Gamification-Dateien mit insgesamt 100 Livefragen. Jede Wochen-Datei enthält genau zehn Fragen und deckt alle zehn unterstützten Fragetypen ab:

- [W01](./P0-03_ARSnova_Woche_01.json), [W02](./P0-03_ARSnova_Woche_02.json), [W03](./P0-03_ARSnova_Woche_03.json), [W04](./P0-03_ARSnova_Woche_04.json), [W05](./P0-03_ARSnova_Woche_05.json), [W06](./P0-03_ARSnova_Woche_06.json), [W07](./P0-03_ARSnova_Woche_07.json), [W08](./P0-03_ARSnova_Woche_08.json), [W09](./P0-03_ARSnova_Woche_09.json) und [W10](./P0-03_ARSnova_Woche_10.json).

Gültige `.jasp`-Dateien und Laufzeitexporte entstehen erst im geschützten Lehrbetrieb. Sie werden nicht als Repository-Textartefakte vorgetäuscht und folgen vollständig dem Datenmanagement- und Exportplan.

### 11.2 Technischer Ablauf vor jeder Sitzung

- Wochen-JSON, Session und QR-Code/URL nach dem Runbook vorab testen,
- den freigegebenen Pool von zehn Livefragen pro Wochenblock vorbereiten und Diagnose-, Lern- oder Spiel-/Teamphase kennzeichnen,
- das Gamification-Profil mit automatisch vergebenen Pseudonymen, Rangliste, 60-Sekunden-Standardtimer mit Schwierigkeitsskalierung und Zeitunterstützung, vier Teams, drei Bonuspunkten sowie aktivierten Sound-, Belohnungs-, Motivations- und Emoji-Effekten im Import prüfen,
- die benötigte Lehrdaten-CSV in JASP 0.98.1 importieren; Zeilenzahl, Skalenniveaus und Kontrollwerte mit Datenwörterbuch und Leitfaden abgleichen,
- MC-Test im Modus `practice` ohne technischen Timer und mit Sofortfeedback testen; `show_top5_public=false`, genau 30 Fragen, Präsenzdurchlauf in der letzten UE, Ergebnisbesprechung und Spaced-Repetition-Nachlauf prüfen,
- vor `FINISHED` Q&A aktualisieren und den separaten Q&A-CSV sichern; unmittelbar nach `FINISHED` Ergebnisbericht und allgemeinen Session-CSV exportieren (Q6, Q10, Q15),
- Aggregationsrunde und ausgelassene Fragen prüfen: nie geöffnete/ausgelassene Fragen fehlen fachlich im Bericht, geöffnete ohne Antworten erscheinen als „Keine Antworten“ (Q10),
- Einzelwert-, Paar- und Regressionstabellen ausschließlich als freigegebene LEHRDATEN vorbereiten; keine Rohwerte oder Paare aus Aggregaten ableiten,
- Offline-Fallback mit lokalem Fragenbestand, Antwortkarten/Zählbogen und vorab erzeugtem JASP-Referenzoutput bereithalten,
- bei LIVE-Daten stets $n$, fehlende Antworten, Runde und Freigabestatus sichtbar machen und den Löschhandoff nach Datenmanagementplan auslösen.

### 11.3 Barrierearmut

Die verbindliche [Matrix gleichwertiger Alternativen und praktische A11y-Materialprobe](./P0-03_Barrierefreiheit_Material_und_Probe.md) operationalisiert die folgenden Mindestregeln:

- Fragen werden zusätzlich vorgelesen und stehen in gut lesbarer digitaler sowie papierbasierter Form zur Verfügung.
- Farben sind nie alleinige Bedeutungsträger; Tabellen, Formeln und Grafiken bleiben bei Vergrößerung und in Graustufen verständlich.
- ARSnova-Zeitphasen beginnen erst nach einer gemeinsamen Lesephase, unterstützen freigegebene individuelle Zeitverlängerungen und besitzen eine gleichwertige untimierte Alternative. Der MC-Lernmodus verwendet keinen technischen Countdown.
- Für ARSnova, MC-Test, JASP-Ausgaben, Lehrdatentabellen, Formelsammlung und Probeklausur besteht je eine gleichwertige Alternative ohne persönliches Gerät.
- Diagramme erhalten Titel, Achsenbeschriftungen, Einheiten und eine textliche Kernaussage.
- Der dokumentierte praktische A11y-Probelauf ist vor dem Lehrbetrieb erforderlich; eine Produktzertifizierung wird daraus nicht abgeleitet.

---

## 12. Qualitätssicherung und Evaluation des Moduls

Die Durchführung, curriculare Passung und notwendige Nachsteuerung werden intern mit wenigen, vorab festgelegten, aggregierten Indikatoren beurteilt:

| Dimension                  | Indikator                                                                     | Zeitpunkt                  |
| -------------------------- | ----------------------------------------------------------------------------- | -------------------------- |
| Beteiligung                | Anteil abgegebener Antworten, ohne individuelle Sanktion                      | wöchentlich                |
| Konzeptabruf               | deskriptive Veränderung ausgewählter Ankerfragen von Erst- zu Zweitabstimmung | in der Sitzung             |
| Behalten                   | aggregierte Lösungsquote derselben Konzepte nach 2–4 Wochen                   | MC-Test                    |
| Rechensicherheit           | aggregierte Lösungsquote wöchentlicher Klausuraufgaben                        | wöchentlich                |
| Sicherheit und Korrektheit | deskriptiver Zusammenhang beider Merkmale                                     | Wochen 4 und 10            |
| Transfer                   | Qualität des finalen Statistikbefunds                                         | Woche 10                   |
| Belastung/Tempo            | Blitzlicht und kurze Freitextfrage                                            | Mitte und Ende jeder Woche |

Die Kennzahlen werden nicht isoliert optimiert. Eine hohe Beteiligung ist beispielsweise nur dann positiv, wenn sie mit freiwilliger, angstfreier Teilnahme und sinnvoller Rückmeldung verbunden bleibt. Die Auswertung dient ausschließlich der konkreten Lehre und internen Modulverbesserung; sie ist kein Kausalnachweis, keine Sekundärnutzung und keine Publikationsgrundlage.

---

## 13. Abgrenzung des Moduls

Bewusst **nicht** vertieft werden:

- mathematische Beweise statistischer Sätze,
- vollständige Herleitung der t-Verteilung,
- multiple oder logistische Regression in voller mathematischer Form,
- Softmax, Cross-Entropy und Perplexity als Rechenstoff,
- Brier Score, Expected Calibration Error, Cohen-$\kappa$, Krippendorff-$\alpha$ und komplexe Effektgrößen,
- Programmierung und komplexe Paketinstallation als Zugangshürde; die einmalige JASP-Installation wird mit einer Kurzanleitung unterstützt.

Zusätzlich sind V1 Wilson-Ranking, V2 app-spezifische Quartilimplementierung, V3 Macro-F1, V4 Coverage/Schwellenwahl, V5 Kalibrierung und V6 Q&A-NLP nur gegatete Anschauungsvertiefungen. Sie werden nicht summativ geprüft. JASP-Ausgaben des Pflichtkerns werden gelesen und interpretiert; Softwarebedienung und Programmierung sind kein Klausurgegenstand.

Diese Themen können in Folgemodulen behandelt werden. Im vorliegenden Modul haben tragfähige Grundvorstellungen, korrekte Interpretation und sichere Anwendung Vorrang vor Stofffülle.

---

## 14. Kompakte Semesterübersicht

| Woche | Kernfrage                                           | Pflichtkern                                    | ARSnova-Fall und JASP-Ertrag                               |
| ----: | --------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
|     1 | Was sind unsere Daten – und wen repräsentieren sie? | Merkmale, Skalen, Stichprobe                   | LIVE-Diagnose; S1-Import und Messniveaus in JASP           |
|     2 | Wie beschreiben wir typische Antworten?             | Häufigkeit, Grafik, Mittelwert, Median         | Quiz-/Schätzverteilungen; S1-Deskription in JASP           |
|     3 | Wie stark unterscheiden sich Beobachtungen?         | Streuung, Quantile, Ausreißer                  | REPO-Latenzen getrennt; S1-Boxplot in JASP; V2 nur gegatet |
|     4 | Was bedeutet „gegeben, dass …“?                     | Wahrscheinlichkeit, Bedingung, Kontingenztafel | Sicherheit × Korrektheit; S2-Tafel in JASP                 |
|     5 | Warum schwanken Stichprobenergebnisse?              | Verteilungen und Stichprobenvariabilität       | Live-Entscheidungen; feste LEHRDATEN-Resamples in JASP     |
|     6 | Wie präzise ist unser beobachteter Wert?            | Schätzen und Konfidenzintervalle               | Kursanteil; Intervalle in JASP; V1 nur gegatet             |
|     7 | Ist eine beobachtete Veränderung mehr als Zufall?   | Tests, p-Wert, gepaarter Vergleich             | aggregierte Runden getrennt; S1-Paare in JASP              |
|     8 | Welche Größen hängen zusammen?                      | Korrelation und Regression                     | synthetische S5-Last/Latenz-Läufe in JASP                  |
|     9 | Funktioniert ein Modell auf neuen Daten?            | Train/Test und binäre Metriken                 | S6-LEHRDATEN in JASP; V3–V6 nur gegatet                    |
|    10 | Welche Schlussfolgerung tragen die Daten?           | Integration und Kommunikation                  | finaler Statistikbefund mit JASP-Kernauszug                |

---

## 15. Erfolgskriterium des Modulkonzepts

Das Modul ist erfolgreich, wenn Studierende am Ende nicht nur eine Standardabweichung, ein Konfidenzintervall oder eine Accuracy berechnen, sondern jeweils beantworten können:

1. **Welche Frage wird untersucht?**
2. **Welche Daten liegen tatsächlich vor?**
3. **Warum ist dieses Verfahren angemessen?**
4. **Was bedeutet das Ergebnis im Kontext?**
5. **Welche Aussage wäre eine Überinterpretation?**

ARSnova.eu verbindet diese fünf Fragen über alle zehn Wochen hinweg. Die Studierenden beantworten dort nicht lediglich Statistikfragen – ihre Interaktionen erzeugen anschauliche Daten, an denen statistisches Denken unmittelbar erfahren, eingeübt und kritisch begrenzt wird.
