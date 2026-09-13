# Modulkonzept: Angewandte Statistik für Wirtschaft, Management und Informatik (48 UE)

## ARSnova.eu als durchgängige empirische Fallstudie

**Umfang:** 10 Wochen: 8 Wochen × 5 UE plus 2 Wochen × 4 UE = 48 Unterrichtseinheiten (UE) à 45 Minuten bzw. 36 Präsenzstunden<br>
**Zielgruppe:** vor allem Bachelorstudierende der Betriebswirtschaftslehre, managementorientierter Studiengänge, der Wirtschaftsinformatik und der Informatik ohne vorausgesetzte Statistikkenntnisse; heterogene und teilweise schwache mathematische Grundlagen<br>
**Lehrformat:** interaktive Präsenzlehre mit synchronen browserbasierten Übungen, institutionell bereitgestelltem JASP 0.98.1, begleitetem Selbststudium und formativer Lernstandsdiagnostik<br>
**Prüfungsformat (Vorschlag):** 90-minütige Klausur mit offizieller Formelsammlung, nicht programmierbarem Taschenrechner und vorbereiteten JASP-Auszügen; die Softwarebedienung wird nicht geprüft<br>
**Überarbeitung:** Repository-Abgleich vom 13.09.2026; Referenzcommit `d2eb75d134712b637410ac3ca6e9f059b9eac0f5`. Quellen Q1–Q20 sind in Kapitel 16 dauerhaft verlinkt.

**Leitidee:** Statistik wird nicht zuerst als Formelsystem, sondern als Werkzeug zum Beschreiben, Beurteilen und Entscheiden anhand realer Management- und Digitalisierungsdaten gelernt.

## Verbindliche P0-Umsetzung

Für Freigabe, Durchführung, Datenverarbeitung und Prüfung des P0-Piloten sind die folgenden Detaildokumente autoritativ. Dieses Hauptkonzept beschreibt den didaktischen Zusammenhang und bewahrt die belegten Repository-Fakten; bei operativen Pilotfragen gilt die jeweils speziellere P0-Regel:

- [P0-01: Kerncurriculum und Lernzielmatrix](./P0-01_Kerncurriculum_Lernzielmatrix.md) – Pflichtkern, MZ1–MZ7, LI01–LI24 und Vertiefungsgates;
- [P0-02: Datenmanagement- und Exportplan](./P0-02_Datenmanagement_Exportplan.md) – Datenwege, Schutzstatus, Freigaben und verbindliche Fristen;
- [P0-03: Materialpaket Pilotlauf](./P0-03_Materialpaket_Pilotlauf.md) – kanonischer Index und Release-Gates;
- [Formelsammlung Statistik](./P0-03_Formelsammlung_Statistik.md) und [JASP-Analyseleitfaden](./P0-03_JASP_Analyseleitfaden.md) – prüfungsidentische Konventionen und reproduzierbare Analysen in JASP 0.98.1;
- [Lehrenden-Runbook](./P0-03_Lehrenden_Runbook.md) – Wochenbetrieb, Exporte, Löschhandoff und Offline-Fallback;
- [QA- und Freigabeprotokoll](./P0-03_QA_Freigabeprotokoll.md) – bestandene statische Prüfungen und vor dem Pilot noch offene Import-, Betriebs- und Rollenfreigaben;
- [Probeklausur](./P0-03_Probeklausur_90_Minuten.md), [Musterlösung](./P0-03_Probeklausur_Musterloesung.md) und [Statistikbefund-Vorlage mit Rubrik](./P0-03_Statistikbefund_Vorlage_Rubrik.md) – verbindliche Prüfungssimulation und formative Qualitätskriterien.

---

## 1. Modulbeschreibung

Das Modul führt anwendungsorientiert in die Grundlagen der deskriptiven und schließenden Statistik ein. Die Studierenden lernen, Daten hinsichtlich ihrer Herkunft, Qualität und Skalierung zu beurteilen, Verteilungen mit geeigneten Kennzahlen und Grafiken zu beschreiben, Zufall und Stichprobenunsicherheit zu verstehen, Konfidenzintervalle und ausgewählte Hypothesentests korrekt zu lesen und anzuwenden sowie Zusammenhänge und einfache Vorhersagemodelle zu untersuchen. Abschließend werden statistische Grundideen auf die Evaluation von Machine-Learning-Systemen übertragen.

Die Webanwendung [ARSnova.eu](https://arsnova.eu) übernimmt dabei eine Doppelrolle:

1. **Lehr-Lern-Werkzeug:** Live-Quiz, numerische Schätzfragen, Q&A und Blitzlicht-Feedback aktivieren die Studierenden synchron und machen Fehlvorstellungen unmittelbar sichtbar. Im P0-Piloten bleiben Rangliste, Timer, technische Teamwertung und Boni deaktiviert.
2. **Empirische Statistik-Fallstudie:** Die in den Sitzungen entstehenden Antwortverteilungen, Schätzwerte, Sicherheitsurteile, Abstimmungen und aggregierten Rundenvergleiche werden selbst zum Gegenstand statistischer Untersuchungen. Ergänzend werden dokumentierte System- und Modelldaten aus dem [ARSnova.eu-Repository](https://github.com/kqc-real/arsnova.eu) verwendet, etwa dokumentierte Latenzquantile und die Evaluation der optionalen Q&A-Klassifikation. Dabei werden Live-Kursdaten, synthetische Seed-Evaluation und eigens konstruierte Lehrdaten ausdrücklich unterschieden (Q1, Q8–Q10).

Die externe MC-Test-App ergänzt ARSnova.eu durch asynchrone Retrieval-Praxis. JASP 0.98.1 ist die verbindliche, institutionell bereitgestellte Analyseumgebung für alle rechnergestützten Kernanalysen; Programmierung ist weder Voraussetzung noch Lernziel.

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
- elementares Umformen einfacher Gleichungen,
- Lesen einfacher Tabellen und Diagramme,
- grundlegende digitale Arbeitsfähigkeit im Browser.

Nicht vorausgesetzt werden Statistik, Analysis, lineare Algebra, Python, R, Programmierung oder eine eigene Softwareinstallation. JASP 0.98.1 wird institutionell in einer vorbereiteten Arbeitsumgebung bereitgestellt und schrittweise mit vorbereiteten Dateien und Klickpfaden eingeführt.

### 2.2 Empfohlener Arbeitsaufwand

Sofern das Modul mit **3 ECTS** ausgewiesen werden soll, bietet sich folgende Verteilung von insgesamt etwa 90 Stunden an:

| Bereich                                         | Stunden |
| ----------------------------------------------- | ------: |
| Präsenz: 48 UE × 45 Minuten                     |      36 |
| Wöchentliche Retrieval-Praxis und Nachbereitung |      24 |
| JASP-Übungen und Arbeit an der Fallstudie       |      15 |
| Klausurvorbereitung und Prüfung                 |      15 |
| **Gesamt**                                      |  **90** |

Die ECTS-Zuordnung ist an die jeweilige Prüfungsordnung anzupassen.

---

## 3. Qualifikationsziele und Lernergebnisse

Die sieben gleichrangigen, übergeordneten Modulziele bilden den summativ prüfbaren Rahmen. Die früheren 24 Detailziele bleiben vollständig als beobachtbare **LI01–LI24** in der [P0-01-Lernzielmatrix](./P0-01_Kerncurriculum_Lernzielmatrix.md#6-vollständige-lernzielmatrix) operationalisiert.

### 3.1 Übergeordnete Modulziele MZ1–MZ7

Nach erfolgreichem Abschluss können die Studierenden:

| Ziel                                                      | Übergeordnetes, prüfbares Modulziel                                                                                                                                                                                                                     | Leistungsindikatoren |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **MZ1: Daten strukturieren und beurteilen**               | eine betriebliche oder digitale Untersuchungsfrage in Grundgesamtheit, Stichprobe, Beobachtungseinheit und Merkmale zerlegen, Skalenniveaus begründen, Datenqualitätsprobleme erkennen und zulässige Aussagen vom Untersuchungsdesign abgrenzen         | LI01–LI04            |
| **MZ2: Daten beschreiben und visualisieren**              | für einen überschaubaren Datensatz geeignete Häufigkeiten, Grafiken sowie Lage- und Streuungsmaße auswählen, mit Formelsammlung oder JASP bestimmen und im Kontext einschließlich Robustheit interpretieren                                             | LI05–LI08            |
| **MZ3: Zufall und Stichprobenunsicherheit modellieren**   | einfache Wahrscheinlichkeiten und Bedingungen bestimmen, Binomial- und Normalmodelle situationsgerecht erkennen sowie Stichprobenvariabilität und Grenzen der Generalisierung erklären                                                                  | LI09–LI12            |
| **MZ4: Schätzen und testen**                              | für einfache Mittelwert-, Anteils- und gepaarte Vorher-Nachher-Fragen Punkt- und Intervallschätzung beziehungsweise einen Test auswählen, Ergebnisse berechnen oder aus JASP lesen und ohne kausale oder probabilistische Fehlinterpretation beurteilen | LI13–LI16            |
| **MZ5: Zusammenhänge und Vorhersagen beurteilen**         | bivariate metrische Zusammenhänge mit Streudiagramm, Korrelation und einfacher linearer Regression untersuchen, Vorhersagen und Residuen interpretieren sowie Generalisierung und Overfitting anhand von Train/Test-Ergebnissen beurteilen              | LI17–LI20            |
| **MZ6: Binäre Klassifikation evaluieren**                 | eine binäre Confusion Matrix auswerten, Accuracy, Precision, Recall und binären F1-Score passend zu Fehlkosten auswählen und Modellwahrscheinlichkeit, beobachtete Häufigkeit und sachliche Wahrheit unterscheiden                                      | LI21–LI22            |
| **MZ7: Statistische Evidenz kommunizieren und begrenzen** | einen reproduzierbaren Kurzbefund mit Untersuchungsfrage, Datenquelle, passender Darstellung, Ergebnis und Grenze in höchstens fünf Sätzen adressatengerecht formulieren und Überinterpretationen zurückweisen                                          | LI23–LI24            |

### 3.2 Verbindlicher Pflichtkern

Alle MZ1–MZ7 und LI01–LI24 gehören zum Pflichtkern. Dieser umfasst Datenstruktur und -qualität, deskriptive Statistik, elementare Wahrscheinlichkeit und Verteilungen, Stichprobenunsicherheit, einfache Intervalle und Tests, Korrelation und einfache lineare Regression, Train/Test sowie binäre Confusion Matrix und binäre Klassifikationsmetriken. Die verbindliche inhaltliche Abgrenzung, Wochenzuordnung und summative Evidenz stehen in [P0-01](./P0-01_Kerncurriculum_Lernzielmatrix.md).

### 3.3 Gegatete Vertiefungen V1–V6

Vertiefungen dürfen erst nach gesichertem zugehörigem Pflichtkern eingesetzt werden, ersetzen keine Kernübungszeit und begründen weder zusätzliche Modulziele noch Prüfungsanforderungen:

| Kennung | Vertiefung                                 | Grenze im P0-Piloten                                                                                                                  |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **V1**  | Wilson-Ranking im Q&A                      | bereitgestellte Untergrenze nur als Rankingsignal lesen; keine Herleitung, Berechnung oder Klausuraufgabe                             |
| **V2**  | ARSnova-spezifische Quartilimplementierung | Konventionen optional vergleichen; Indexregel weder Pflichtrechenverfahren noch Klausurstoff                                          |
| **V3**  | Macro-F1                                   | bereitgestellten Wert allenfalls lesen; keine Mehrklassenberechnung                                                                   |
| **V4**  | Coverage und Entscheidungsschwelle         | Zielkonflikt nur qualitativ; keine Optimierung oder Rekonstruktion fehlender Zellen                                                   |
| **V5**  | Kalibrierung                               | vorbereitete Wahrscheinlichkeitsgruppen nur qualitativ vergleichen; keine Kalibrierungsmetrik                                         |
| **V6**  | Q&A-NLP von ARSnova.eu                     | dokumentierte synthetische Seed-Evaluation nur begrenzt lesen; keine Architektur, kein Training, keine Aussage über Produktivqualität |

**V1–V6 sind aus der summativen Prüfung vollständig ausgeschlossen.** Das verbindliche Gate und die Ersatzhandlungen bei nicht gesichertem Kern regeln [P0-01](./P0-01_Kerncurriculum_Lernzielmatrix.md#22-vertiefung-und-arsnova-spezifischer-transfer) und der [ARSnova-Livequiz-Blueprint](./P0-03_ARSnova_Livequiz_Blueprint_10_Wochen.md#35-curricularer-status-und-vertiefungsgate).

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

### 4.2 Wiederkehrendes Mikromuster einer Unterrichtseinheit

Eine typische UE von 45 Minuten folgt – je nach Gegenstand leicht variiert – diesem Rhythmus:

| Phase                            | Richtwert | Funktion                                                     |
| -------------------------------- | --------: | ------------------------------------------------------------ |
| Aktivierung/Retrieval            |    5 Min. | eine alte und eine neue ARSnova-Concept-Question             |
| Problem und Intuition            |    8 Min. | authentische Fragestellung aus der Fallstudie                |
| Erklärung und Formel             |   10 Min. | sprachliche Herleitung, Formelsammlung, gemeinsames Beispiel |
| Anwendung                        |   12 Min. | Einzel-, Partner-, Tablet- oder vorbereitete JASP-Aufgabe    |
| Auswertung und Fehlvorstellungen |    7 Min. | Antwortverteilung diskutieren, Begründungen vergleichen      |
| Exit Ticket/Blitzlicht           |    3 Min. | Verstehen, Tempo oder offene Frage erfassen                  |

Interne Quizpunkte sind keine Lernstandskennzahl: Zeit, Schwierigkeit und Streak können den Score beeinflussen. Für Analysen werden fachliche Korrektheit, Antwortzahl und bei Schätzungen Fehler zum Referenzwert verwendet. Für unbewertete Meinungsfragen dienen SURVEY oder Blitzlicht; ein ausgeblendetes Leaderboard allein schaltet interne Bewertung nicht ab (Q2, Q15).

Der P0-Pilot nutzt ausschließlich Diagnose- und Lernmodus. Eine frühere Spiel-/Team-Empfehlung gehört nicht zum Pilotumfang:

| Modus                                   | Gestaltung                                                             | Zweck                                           |
| --------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| Diagnose                                | freiwillig, anonymisiert dargestellt, ohne Rangliste oder Notenwirkung | Vorwissen und Fehlvorstellungen sichtbar machen |
| Lernen                                  | Antwort, Erklärung, erneute Abstimmung                                 | Konzeptwechsel und Peer Instruction             |
| Spiel/Team **außerhalb des P0-Piloten** | nur als eigenständige, später freizugebende Paketrevision              | keine operative Empfehlung dieses Konzepts      |

Für sämtliche P0-Livequiz-Dateien gelten `anonymousMode=true`, `showLeaderboard=false`, `defaultTimer=null`, `teamMode=false`, `bonusTokenCount=null` und je Frage `timer=null`. ARSnova.eu bleibt damit synchrones Livewerkzeug und transparent begrenztes Studienobjekt, nicht asynchrone Lern- oder Prüfungsplattform.

### 4.3 Formative Lernschleifen

**Innerhalb der Sitzung – ARSnova.eu:**

> Frage → Antwortverteilung → Begründung → Nachsteuerung → zweite Antwort oder Transferaufgabe

**Zwischen den Sitzungen – MC-Test:**

Der MC-Test ist die externe Streamlit-App auf dem [fixierten Quellstand `b6b159555e8a228dad73dd75fd66c154a1088e28`](https://github.com/kqc-real/streamlit/tree/b6b159555e8a228dad73dd75fd66c154a1088e28) ([Live-Instanz](https://mc-test.streamlit.app)). Jede der zehn Wochen-Dateien enthält genau 30 Fragen. Ihr Wurzelobjekt besteht ausschließlich aus `meta` und `questions`. `meta` enthält genau `title`, `target_audience`, `question_count`, `difficulty_profile`, `time_per_weight_minutes`, `additional_buffer_minutes`, `test_duration_minutes`, `language` und `updated`; jedes Fragenobjekt enthält genau `question`, `options`, `answer`, `explanation`, `weight`, `topic`, `concept`, `cognitive_level` und `mini_glossary`. Das Schwierigkeitsprofil ist je Woche exakt `8 leicht/16 mittel/6 schwer`. Das exakte Feldschema und die Freigabeprüfungen definiert der [MC-Test-Blueprint](./P0-03_MC-Test_Blueprint_10_Wochen.md).

Verbindlicher Laufzeitmodus ist `practice` ohne Timer und mit Sofortfeedback. `show_top5_public=false` verhindert die öffentliche Top-5. `meta.test_duration_minutes=27` ist nur ein Planwert. Zwei vollständige Lerndurchläufe werden empfohlen, aber weder die Zahl der Versuche noch die Bearbeitungszeit werden technisch erzwungen. Die Nutzung ist ausschließlich formativ: Nur vereinbarte Aggregate steuern die Lehre und interne Modulevaluation; Einzelverläufe haben keine Notenwirkung.

Ab Woche 2 umfasst die redaktionelle Verteilung als Richtwert:

| Anzahl | Herkunft der Fragen                                                     |
| -----: | ----------------------------------------------------------------------- |
|     12 | Inhalte der aktuellen beziehungsweise unmittelbar vorangegangenen Woche |
|     10 | ältere Inhalte zur verteilten Wiederholung                              |
|      5 | häufig falsch beantwortete Konzepte                                     |
|      3 | Transfer- und klausurnahe Aufgaben                                      |

In Woche 1 werden die für ältere Inhalte vorgesehenen Plätze als unbenotete Eingangsdiagnose genutzt.

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

Jeder Datenbaustein trägt eine Herkunftskennzeichnung: **LIVE** (eigene Erhebung), **REPO** (dokumentierter Messlauf; dessen Daten können synthetisch sein) oder **LEHRDATEN** (neu konstruierte Übung). Ein Quellenlink macht synthetische Daten nicht zu einer Feldstudie. Das P0-Materialpaket enthält nun sieben versionierte synthetische Lehrdaten-CSV samt [Datenwörterbuch und Provenienz](./P0-03_Datenwoerterbuch_Provenienz.md); die vollständige verlinkte Materialliste steht in Kapitel 11.

### 5.3 Minimaler Datenkatalog

Für die Lehrmaterialien wird ein schlanker, dokumentierter Datensatz geführt. Der folgende Katalog beschreibt eine didaktische Zieltabelle, nicht ein vorhandenes ARSnova-CSV-Schema. Verbindlich sind das [P0-03-Datenwörterbuch](./P0-03_Datenwoerterbuch_Provenienz.md) und der [P0-02-Datenplan](./P0-02_Datenmanagement_Exportplan.md): LIVE-Frageaggregate bleiben von Einzelwert- und Paartabellen getrennt; Einzelantworten, vollständige Paare und Systemrequests werden für Lernaufgaben ausschließlich als freigegebene LEHRDATEN verwendet. Eine Zeile hat jeweils genau eine Beobachtungseinheit.

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

Das Modul ist ausschließlich Lehre und interne Modulevaluation. Es ist kein Forschungsprojekt und erzeugt weder eine Publikationsgrundlage noch Daten für Sekundärnutzung, externe Evaluation, individuelle Leistungsprofile oder spätere Zweckänderungen. Verbindliche Quelle für Erhebung, Schutzstatus, Zugriff, Freigabe, Aufbewahrung, Löschung und Incidents ist [P0-02](./P0-02_Datenmanagement_Exportplan.md).

- Die Teilnahme an Live-Abstimmungen, Confidence und Feedback ist freiwillig und ohne Notennachteil. Der P0-Pilot verwendet keine Rangliste, technische Teamwertung oder Boni.
- ARSnova-Exporte werden sofort gesichert: Der separate Q&A-CSV wird vor `FINISHED` aus der Hostansicht exportiert; Session-CSV und Ergebnis-PDF folgen unmittelbar nach `FINISHED`. Der allgemeine Sessionexport ersetzt die Q&A-Vollmetriken nicht.
- Blitzlicht ist temporär. Nur das benötigte Aggregat wird solange die Runde sichtbar ist mit Zeitpunkt und Nenner dokumentiert; anschließend wird das Blitzlicht ausdrücklich beendet. Voter-Zustände werden nicht exportiert.
- Aggregierte Sessiondaten werden nie zu Personen-Rohdaten oder Vorher-Nachher-Paaren zurückgerechnet. Für Einzelwerte, vollständige Paare, Regression und kleine Demonstrationen werden freigegebene synthetische LEHRDATEN verwendet.
- MC-Test-Antwortlogs und der kursisolierte SQLite-Bestand sind pseudonyme LIVE-Daten. Nach Aggregation umfasst das Löschhandoff auch Sitzungszusammenfassungen beziehungsweise bei isoliertem Betrieb die vollständige SQLite-Dateifamilie; ein SQL-Dump ist kein Routine-Analyseformat.
- `.jasp`-Dateien können Eingabedaten einbetten und übernehmen deshalb deren höchsten Schutzstatus. LIVE-Daten werden nur lokal im geschützten institutionellen Bereich verarbeitet; verteilt werden ausschließlich geprüfte anonyme Aggregate oder synthetische LEHRDATEN.
- Q&A- und sonstiger Freitext wird separat geprüft, nicht wörtlich verteilt und nicht als NLP-Datensatz genutzt. Kleine oder rückrechenbare Zellen werden unterdrückt oder zusammengefasst.

Die konkreten Verarbeitungs- und Löschfristen stehen ausschließlich und autoritativ in [P0-02, Abschnitt 7](./P0-02_Datenmanagement_Exportplan.md#7-konkreter-exportablauf) und [Abschnitt 12](./P0-02_Datenmanagement_Exportplan.md#12-aufbewahrungs--und-löschfristen). Dieses Hauptkonzept verkürzt, verlängert oder dupliziert diese Fristen nicht.

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
| S3: Welche Frage zuerst?              | Netto-Score und Zustimmung vergleichen; Wilson/Kontroversität nur als V1                   | Wochen 1, 5–6 | Bewertungsportale und Priorisierung; Rankinglogik als optionale Vertiefung                |
| S4: Wie gut ist der digitale Service? | p95/p99 mit Messdesign und Einheit lesen                                                   | Woche 3       | Service-Level und Kundenerfahrung; Last- und Performancemessung                           |
| S5: Last und Latenz                   | Synthetische Tabelle unabhängiger Lastläufe: gleiches System, Lastniveau und Medianlatenz  | Woche 8       | Kapazitätsplanung; einfache Regression und Extrapolation                                  |
| S6: Automatisch zuordnen oder prüfen? | binäre LEHRDATEN-Matrix und Fehlkosten im Kern; Q&A-Seed-Evaluation/Coverage nur als V4/V6 | Wochen 4, 9   | Serviceanfragen und manuelle Nachbearbeitung; Q&A-Systempfad nur als optionale Vertiefung |

Der Strang S5 ist eine neue didaktische Ergänzung. Für 12–20 synthetische Läufe werden Lastniveau, Medianlatenz, Szenario und Quellenstatus dokumentiert; Hardware und Requestmix bleiben im Lehrmodell konstant. Die Streuung zwischen Läufen wird nicht aus veröffentlichten p95/p99-Werten erfunden. Ein zweiter betrieblicher Kontext (Nachfrage und Personalbedarf) prüft, ob Studierende das statistische Prinzip übertragen können.

### 5.7 Semesterprodukt der Fallstudie

Am Ende liegt ein kompakter, reproduzierbarer Statistikbefund vor:

1. Untersuchungsfrage,
2. Beschreibung der Daten und Stichprobe,
3. passende Grafik und Kennzahlen,
4. eine begründete inferenzstatistische oder modellbezogene Auswertung,
5. Interpretation in Alltagssprache,
6. mindestens eine Einschränkung,
7. höchstens fünf Sätze Management Summary.

Das Produkt wird im P0-Piloten als unbenotete Gruppenarbeit mit formativer Rückmeldung eingesetzt.

---

## 6. Inhalts- und Lerneinheitenstruktur

| Block                            | Wochen | Inhaltlicher Schwerpunkt                                                                  | Fachbegriffe                                                                                                                                                                                                                                 | Methoden & Techniken                                                                                                                                                                     | Kompakter Formelbezug                                                | Beitrag der ARSnova-Fallstudie                                                                                               |
| -------------------------------- | -----: | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A: Daten verstehen               |    1–3 | Daten, Häufigkeiten, Visualisierung, Lage und Streuung                                    | Grundgesamtheit; Stichprobe; Beobachtungseinheit; Merkmal; Skalenniveau; absolute und relative Häufigkeit; Mittelwert; Median; Modus; Quantil; Varianz; Standardabweichung; IQR; Ausreißer                                                   | Datenprüfung; Häufigkeitstabelle; Balkendiagramm; Histogramm; Boxplot; Lage- und Streuungsmaße mit Formelsammlung und JASP; Plausibilitätsprüfung                                        | **A1–A6** im Formelschlüssel                                         | S1/S4: Schätzverteilungen und Servicezeiten; n versus n−1 prüfen; app-spezifische Quartile nur als V2 (Q2, Q3, Q8)           |
| B: Unsicherheit verstehen        |    4–5 | Wahrscheinlichkeit, bedingte Wahrscheinlichkeit, Verteilungen und Stichprobenvariabilität | Zufallsexperiment; Ergebnis; Ereignis; Gegenereignis; Unabhängigkeit; bedingte Wahrscheinlichkeit; Zufallsvariable; Erwartungswert; Binomialverteilung; Normalverteilung; Stichprobenverteilung; Standardfehler                              | Baumdiagramm; Kontingenz- und Vierfeldertafel; Rechnen mit absoluten Häufigkeiten; Bayes-Denken; Binomialmodell prüfen; Verteilungen lesen; vorbereitete Stichproben in JASP vergleichen | **B1–B6** im Formelschlüssel                                         | S2 und LEHRDATEN: Confidence-Kreuztabelle, Nenner und Bewertungsanteile; feste Simulationsdaten (Q4, Q5)                     |
| C: Aus Stichproben schließen     |    6–7 | Punktschätzung, Konfidenzintervalle und Hypothesentests                                   | Schätzer; Punktschätzung; Intervallschätzung; Konfidenzniveau; Standardfehler; Nullhypothese; Alternativhypothese; Signifikanzniveau; p-Wert; Fehler 1. und 2. Art; Effekt; gepaarte Daten                                                   | Konfidenzintervalle berechnen und in JASP lesen; Hypothesen formulieren; p-Werte lesen; gepaarten t-Test in JASP ausführen; statistische und praktische Relevanz trennen                 | **C1–C4** im Formelschlüssel                                         | S1: Kursanteile und Mittelwerte schätzen; vollständige LEHRDATEN-Paare testen; Wilson-Ranking nur als V1 (Q3, Q6, Q7)        |
| D: Zusammenhänge und Modelle     |    8–9 | Korrelation, Regression, Train/Test, Overfitting und binäre ML-Evaluation                 | Streudiagramm; Korrelation; Kausalität; Regressionsgerade; Steigung; Achsenabschnitt; Vorhersage; Residuum; Bestimmtheitsmaß; Training; Test; Generalisierung; Overfitting; binäre Confusion Matrix; Accuracy; Precision; Recall; binärer F1 | Streudiagramm, Korrelation und Regression in JASP; Residuen und Extrapolation prüfen; Train/Test vergleichen; binäre Matrix auswerten; Metrik nach Fehlkosten auswählen                  | **D1–D7** im Formelschlüssel                                         | S5/S6: synthetische Last-Latenz-Regression und binäre LEHRDATEN-Klassifikation; V3–V6 nur gegatet (Q8, Q9)                   |
| E: Integrieren und kommunizieren |     10 | vollständiger Analysezyklus, Ergebniskommunikation und Klausurtraining                    | Untersuchungsfrage; Operationalisierung; Analyseplan; statistischer Befund; Limitation; Übertragbarkeit; Management Summary                                                                                                                  | Verfahren anhand von Frage und Skalenniveau auswählen; JASP-Ausgaben auf Plausibilität prüfen; Grafiken und Kennzahlen zusammenführen; Grenzen formulieren; Peer Review; Probeklausur    | **A1–D7 kumulativ**; die Formelauswahl ist Teil der Prüfungsleistung | S1–S6: Herkunft, Aggregationsrunde, Nenner und JASP-Version offenlegen; keine Kausal- oder Produktionsversprechen (Q10, Q16) |

Die Tabelle beschreibt den Pflichtkern. Wilson-Ranking, ARSnova-spezifische Quartilimplementierung, Macro-F1, Coverage/Schwellenwahl, Kalibrierung und Q&A-NLP bleiben ausschließlich die in Abschnitt 3.3 definierten Vertiefungen V1–V6 und sind nicht summativ prüfbar.

### 6.1 Formelschlüssel

Die folgenden Kürzel bilden den konzeptionellen Kern kompakt ab und stehen außerhalb der Tabelle, weil LaTeX-Ausdrücke in Markdown-Tabellen je nach Viewer nicht zuverlässig gerendert werden. Für Lehre und Klausur ist ausschließlich die ausführliche [P0-03-Formelsammlung](./P0-03_Formelsammlung_Statistik.md) mit Auswahlregeln, Voraussetzungen, Einheiten, Konventionen und Warnungen autoritativ.

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

## 7. Detaillierter Wochenplan: 10 Wochen mit 48 UE

Die 48 Präsenz-UE werden auf zwei Rahmenwochen mit je 4 UE (Woche 1 und Woche 10) sowie acht Wochen mit je 5 UE (Woche 2 bis Woche 9) verteilt. Die jeweils fünfte UE ist als Statistiklabor, Transferwerkstatt oder Klausurtraining angelegt. Falls organisatorisch nur Doppelblöcke möglich sind, können jeweils zwei Labor-UE gebündelt an vier zusätzlichen Praxisterminen stattfinden. „Vertiefung“ bezeichnet in diesem Dokument ausschließlich die gegateten Inhalte V1–V6, nicht eine Woche mit fünf UE.

JASP 0.98.1 ist in jeder Woche verbindlich. Die folgende Ausgabe wird institutionell vorbereitet beziehungsweise von den Studierenden mit angeleitetem Klickpfad erzeugt:

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

|  UE | Inhalt und Ablauf                                                                                                                                                                                                         | ARSnova-Bezug                                                                                                                                  | Lernprodukt/Evidenz                                                                                |
| --: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
|   1 | Einstieg mit einer strittigen Aussage wie „Unsere Gruppe versteht Statistik bereits gut“. Von der Behauptung zur messbaren Frage; Statistik als Prozess. Vorstellung von Modul, Formelsammlung, Prüfung und Fehlerkultur. | LIVE: anonyme Einstiegsabstimmung; n und Zeitpunkt protokollieren. SURVEY/Blitzlicht für Selbstauskunft, kein richtig/falsch (Q15).            | Studierende formulieren aus einer Behauptung eine Variable und eine überprüfbare Frage.            |
|   2 | Beobachtungseinheit, Merkmal, Merkmalsausprägung; Grundgesamtheit, Vollerhebung, Stichprobe. Die S1-Servicezeiten werden in JASP 0.98.1 geöffnet; Zeile, Variable und Messniveau werden identifiziert.                    | Wer hat geantwortet, wer nicht? Die Live-Session wird als Gelegenheitsstichprobe analysiert; die JASP-Datei verwendet synthetische LEHRDATEN.  | Datenstruktur mit Zeile, Spalte, Einheit und Population korrekt beschriften; JASP-Importprotokoll. |
|   3 | Skalenniveaus: nominal, ordinal, metrisch; diskret/stetig. Welche Operationen und Diagramme sind jeweils sinnvoll?                                                                                                        | SURVEY nominal, Confidence ordinal, Schätzung metrisch; Antwortzeit ist ein technischer Messwert und kein unmittelbares Kompetenzmaß (Q2, Q4). | Zuordnungstabelle „Variable – Skala – zulässige Auswertung“.                                       |
|   4 | Datenqualität und Verzerrung: Selbstselektion, Nonresponse, unklare Fragen, Messfehler. Erste klausurnahe Aufgabe und Exit Ticket.                                                                                        | Vergleich „aktive ARSnova-Teilnehmende“ versus „gesamte Kohorte“; Grenzen der Generalisierung.                                                 | Kurzbefund: zwei Aussagen, die die Daten erlauben, und zwei, die sie nicht erlauben.               |

**Selbststudium:** 30 kumulative MC-Fragen im Modus `practice` ohne Timer und mit Sofortfeedback, davon Schwerpunkt Datenbegriffe und Skalenniveaus; eine fehlerhafte Datentabelle bereinigen.<br>
**Fallstudien-Meilenstein:** Datenprotokoll und Variablenkatalog Version 1.

## Woche 2 – Häufigkeiten, Diagramme und Lage

**Wochenziele:** Die Studierenden berechnen absolute und relative Häufigkeiten, wählen geeignete Diagramme und interpretieren Mittelwert, Median und Modus.

|  UE | Inhalt und Ablauf                                                                                                                                                                            | ARSnova-Bezug                                                                                                                                               | Lernprodukt/Evidenz                                                                       |
| --: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
|   5 | Rückblick mit Concept Questions. Absolute und relative Häufigkeit, Anteil und Prozent; Bedeutung des Nenners.                                                                                | Single Choice als Einstieg; anschließend MC als Gegenbeispiel: mehrere Optionsnennungen je Person. Nenner explizit wählen (Q3).                             | Häufigkeitstabelle einschließlich Summe und Bezugsgröße.                                  |
|   6 | Balkendiagramm, Kreisdiagramm und Histogramm: Einsatz, Achsen, Klassenbildung und typische Manipulationen.                                                                                   | Live-Antwortbalken werden kritisch gelesen; numerische Schätzwerte erzeugen ein Histogramm.                                                                 | Begründete Auswahl eines Diagrammtyps; Erkennen einer abgeschnittenen Achse.              |
|   7 | Mittelwert, Median und Modus zunächst sprachlich, dann rechnerisch. Das Summenzeichen als wiederholte Addition.                                                                              | S1: Mittelwert einer verdeckten Servicezeit-Tabelle schätzen; bekannte Referenz 120 s. Live-Kennzahlen der Schätzungen lesen (Q2).                          | Rechnung mit Formelsammlung sowie Interpretation in einem vollständigen Satz.             |
|   8 | Robustheit und Schiefe: Ausreißer verändern Mittelwert und Median unterschiedlich. Klausuraufgabe mit fünf Werten.                                                                           | S1: Extremwert nur in einer Kopie der Lehrtabelle ergänzen; Originalmessung unverändert lassen. Plausibilitätsgrenze als mögliche Abschneidung diskutieren. | Entscheidung, welches Lagemaß eine konkrete Verteilung besser beschreibt.                 |
|   9 | **JASP-Statistiklabor:** S1-Servicezeiten importieren, Skalenniveaus prüfen sowie Häufigkeiten, Histogramm, Mittelwert und Median erzeugen; zwei Werte mit der Formelsammlung kontrollieren. | ARSnova-Aggregate werden der synthetischen Einzelwert-Lehrtabelle gegenübergestellt. Aus dem Standardexport werden keine Rohwerte abgeleitet (Q3, Q10).     | Gespeicherter JASP-Auszug, nachvollziehbare Handkontrolle und kurzer Plausibilitätscheck. |

**Selbststudium:** MC-Test mit Wiederholung von Woche 1; Diagrammfehler erklären; Mittelwert und Median mit Taschenrechner prüfen.<br>
**Fallstudien-Meilenstein:** Deskriptiver Kurzbericht zu einer Live-Schätzverteilung.

## Woche 3 – Streuung, Quantile und Ausreißer

**Wochenziele:** Die Studierenden erklären, warum Lage allein nicht genügt, und berechnen bzw. interpretieren Spannweite, Quartile, IQR, Varianz und Standardabweichung.

|  UE | Inhalt und Ablauf                                                                                                                                                                                                                | ARSnova-Bezug                                                                                                                           | Lernprodukt/Evidenz                                                                               |
| --: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
|  10 | Zwei Datensätze mit gleichem Mittelwert, aber unterschiedlicher Streuung. Spannweite und Abweichung vom Mittelwert.                                                                                                              | Zwei Schätzfragen oder zwei Gruppen mit ähnlichem Mittelwert werden gegenübergestellt.                                                  | Verbale Beschreibung der Streuung ohne Formel.                                                    |
|  11 | Varianz und Standardabweichung aus der Idee „Abstände, Quadrieren, Mitteln, Wurzelziehen“. Unterschied deskriptive Division durch $n$ und Stichprobenschätzer mit $n-1$ auf Anwendungsebene.                                     | S1: buildNumericStats verwendet n; A5 verwendet n−1. Beide Ergebnisse an denselben fünf Lehrwerten berechnen und richtig benennen (Q3). | Rechenweg mit Einheiten und Plausibilitätskontrolle.                                              |
|  12 | Median, Quartile, IQR und Boxplot im Pflichtkern; Ausreißerregel als exploratives Signal, nicht als automatische Löschregel. JASP-Ausgabe und vorgegebene Handkonvention werden verglichen.                                      | S1: Boxplot aus LEHRDATEN. Die ARSnova-Indexregel wird nur bei offenem Vertiefungsgate als V2 betrachtet und nicht geprüft (Q3).        | Boxplot lesen, eine schiefe Verteilung beschreiben und die verwendete Quartilkonvention nennen.   |
|  13 | Quantile in digitalen Anwendungen: Median, p95, p99 bei Antwort- und Systemlatenzen. Klausurnahe Integrationsaufgabe.                                                                                                            | S4: dokumentierter lokaler 500-VU-Join-Wave-Lauf: p95 121 ms, p99 1,22 s, max 6,6 s. Kein NLP-Inferenzbenchmark (Q8).                   | Entscheidung: Welche Kennzahl ist für typische Nutzung, Servicequalität und Extremfälle geeignet? |
|  14 | **JASP-Statistiklabor:** S1-Servicezeiten mit und ohne markierten Extremwert des vorbereiteten Lehrfalls vergleichen; Lage, Streuung und Boxplot gemeinsam beurteilen. Dokumentierte REPO-Latenzquantile werden separat gelesen. | S1/S4: LEHRDATEN und REPO bleiben getrennt. Aus p95/p99 werden keine Rohwerte oder Boxplots rekonstruiert (Q8).                         | JASP-Kennzahlenübersicht und begründeter Kurzbefund mit mindestens einer Einschränkung.           |

**Selbststudium:** gemischter MC-Satz; Berechnung von Mittelwert und Standardabweichung für zwei Modelle; Interpretation des Stabilitätsunterschieds.<br>
**Fallstudien-Meilenstein:** Einseitiger JASP-Auszug mit Histogramm/Boxplot, Lage, Streuung und zwei Interpretationssätzen.

## Woche 4 – Wahrscheinlichkeit und bedingte Wahrscheinlichkeit

**Wochenziele:** Die Studierenden bestimmen einfache Wahrscheinlichkeiten, nutzen Kontingenztafeln und interpretieren bedingte Wahrscheinlichkeiten korrekt.

|  UE | Inhalt und Ablauf                                                                                                                                                                                                  | ARSnova-Bezug                                                                                                                                                                        | Lernprodukt/Evidenz                                                                                                                 |
| --: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
|  15 | Zufallsexperiment, Ergebnis, Ereignis; empirische relative Häufigkeit versus theoretische Wahrscheinlichkeit. Addition und Gegenereignis.                                                                          | Wiederholte Live-Zufallsfrage/Simulation und stabilisierender Gesamtanteil.                                                                                                          | Ereignisse in Mengen- und Alltagssprache formulieren.                                                                               |
|  16 | Zweistufige Experimente und Baumdiagramm; Multiplikationsregel an einfachen Beispielen.                                                                                                                            | Münzwurf aus der Single-Choice-Demo (Q13); Transfer auf zwei idealisiert unabhängige Serviceereignisse und Diskussion der Unabhängigkeitsannahme.                                    | Vollständiges Baumdiagramm und Pfadwahrscheinlichkeit.                                                                              |
|  17 | Kontingenztafel aus Korrektheit × Antwortsicherheit. Rand- und bedingte Häufigkeiten.                                                                                                                              | S2: eine bewertbare Konzeptfrage mit aktivierter Confidence; 1–2 niedrig, 3 mittel, 4–5 hoch. Bei Aktivierung ist Angabe für die Abgabe erforderlich; Alternative anbieten (Q4, Q5). | Berechnung von $P(\text{richtig})$ und $P(\text{richtig}\mid\text{hohe Sicherheit})$.                                               |
|  18 | Verwechslung inverser Bedingungen und intuitive Bayes-Idee. Keine umfangreiche algebraische Herleitung; Fokus auf Bezugsgruppen.                                                                                   | S2: inverse Bedingungen an derselben Matrix; S6 motiviert Bayes durch den optionalen Naive-Bayes-Pfad, ohne dessen Aktivierung vorauszusetzen (Q8).                                  | Klausurfrage zur Interpretation zweier bedingter Wahrscheinlichkeiten.                                                              |
|  19 | **JASP-Transferwerkstatt:** S2-Confidence als 2×3-Kontingenztafel mit Rand-, Zeilen- und Spaltenanteilen auswerten; anschließend den Basisratenfehler an einer vollständig vorgegebenen Q&A-Filter-Tafel erklären. | S2/S6: ausschließlich LEHRDATEN und bereitgestellte Zahlen; kein Q&A-NLP-Modell und keine produktive Trefferquote erforderlich.                                                      | Dokumentierte JASP-Tafel und Erklärung, warum eine hohe Trefferquote nicht automatisch eine hohe positive Vorhersagekraft bedeutet. |

**Selbststudium:** 30 Fragen mit Interleaving aus Lage, Streuung und Wahrscheinlichkeit; Kontingenztafel vervollständigen.<br>
**Fallstudien-Meilenstein:** Sicherheits-Korrektheits-Matrix mit korrekt benannten bedingten Anteilen.

## Woche 5 – Zufallsvariablen, Verteilungen und Stichprobenvariabilität

**Wochenziele:** Die Studierenden erkennen ausgewählte Verteilungen, unterscheiden Parameter und Statistik und erklären, warum Stichprobenergebnisse schwanken.

|  UE | Inhalt und Ablauf                                                                                                                                                 | ARSnova-Bezug                                                                                                                                             | Lernprodukt/Evidenz                                                                                                          |
| --: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
|  20 | Zufallsvariable und Wahrscheinlichkeitsverteilung. Erwartungswert als langfristiger Mittelwert. Diskret versus stetig.                                            | Anzahl korrekter Antworten in mehreren Fragen als diskrete Variable; Antwortzeit als stetige Variable.                                                    | Variablen korrekt klassifizieren und Verteilung sprachlich beschreiben.                                                      |
|  21 | Binomialmodell: feste Zahl von Versuchen, zwei Ausgänge, konstantes $p$, Unabhängigkeit. Bedingungen wichtiger als mechanisches Einsetzen.                        | „Wie viele von 10 Concept Questions werden korrekt beantwortet?“; Grenzen wegen unterschiedlicher Itemschwierigkeit diskutieren.                          | Prüfliste, ob ein Binomialmodell angemessen ist.                                                                             |
|  22 | Normalverteilung, Symmetrie, Lage/Streuung, Standardisierung auf Interpretationsebene. Normalität nicht automatisch voraussetzen.                                 | S1: beobachtetes Histogramm kritisch vergleichen; vorhandene Normalverteilungsfrage aus Statistik kompakt adaptieren (Q11).                               | Aussagen über Bereiche um den Mittelwert interpretieren.                                                                     |
|  23 | Stichprobenverteilung experimentell: Viele Kleingruppen ziehen Stichproben bzw. erhalten simulierte Session-Samples und berechnen Mittelwerte/Anteile.            | LEHRDATEN: wiederholte Ziehungen aus einem festgelegten endlichen Antwortpool. Population der Simulation von realer Studierendenpopulation unterscheiden. | Verteilung der Stichprobenkennwerte; Erklärung, warum größere Stichproben stabiler sind.                                     |
|  24 | **JASP-Simulationslabor:** Vorbereitete Wiederholungsstichproben beziehungsweise die festen S6-Resamples werden nach Stichprobengröße oder Lehrmodell verglichen. | JASP erzeugt den Verteilungsvergleich; ARSnova sammelt nur Interpretationen. Die Simulation wird nicht als native ARSnova-Funktion dargestellt.           | Exportierte, annotierte JASP-Grafik mit einer korrekten Aussage zur Streuung der Schätzer und zur begrenzten Lehrpopulation. |

**Selbststudium:** Simulationsergebnisse lesen; Bedingungen von Binomial- und Normalmodell unterscheiden; kumulativer MC-Test.<br>
**Fallstudien-Meilenstein:** Visualisierung der Stichprobenvariabilität mit einer Aussage zur Generalisierung.

## Woche 6 – Schätzen und Konfidenzintervalle

**Wochenziele:** Die Studierenden unterscheiden Punkt- und Intervallschätzung, berechnen einfache Intervalle mit Formelsammlung und vermeiden die häufigste Fehlinterpretation eines 95%-Konfidenzintervalls.

|  UE | Inhalt und Ablauf                                                                                                                                                                                                              | ARSnova-Bezug                                                                                                                                                        | Lernprodukt/Evidenz                                                                            |
| --: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
|  25 | Von „71,2 % richtig“ zur Unsicherheit: Punktschätzung, Standardfehler und Einfluss von $n$.                                                                                                                                    | Ein realer/kuratierter Anteil korrekter Antworten mit Zähler und Nenner wird erneut aufgegriffen.                                                                    | Zwei gleich hohe Anteile bei unterschiedlichem $n$ hinsichtlich Präzision vergleichen.         |
|  26 | Konfidenzintervall für einen Anteil mit bereitgestellter Formel und JASP-Ausgabe; Einsatzgrenzen der einfachen Wald-Näherung prüfen.                                                                                           | Ein Kursanteil mit Zähler und Nenner wird verwendet. Eine Wilson-Untergrenze als Rankingsignal gehört ausschließlich zu V1 und wird nicht summativ geprüft (Q6, Q7). | Intervall berechnen oder aus JASP ablesen und Grenzen prüfen.                                  |
|  27 | Konfidenzintervall für einen Mittelwert auf elementarem Niveau; Rolle von Streuung und Stichprobengröße.                                                                                                                       | S1: s mit n−1 für die Lehrrechnung verwenden, nicht ungeprüft die ARSnova-Standardabweichung. Schiefe Latenzen als Gegenbeispiel bei kleinem n (Q3).                 | Einfluss von $s$ und $n$ auf die Intervallbreite erklären.                                     |
|  28 | Korrekte Interpretation und Fehlformulierungen. Klausurwerkstatt: Resultat lesen, nicht Formel reproduzieren.                                                                                                                  | ARSnova-Peer-Instruction zu vier konkurrierenden Intervallaussagen mit zweiter Abstimmung.                                                                           | Präzise Musterformulierung mit Population, Parameter und Unsicherheit.                         |
|  29 | **JASP-Konfidenzintervall-Labor:** Gleich hohe Erfolgsanteile aus unterschiedlich großen Stichproben und ein Mittelwertintervall werden erzeugt, visualisiert und verglichen. Präzision und Repräsentativität werden getrennt. | Pflichtkern: Punkt- und Intervallschätzung. Nur bei offenem Gate folgt optional V1 mit bereitgestellten S3-Rankingfeldern; keine Klausurrelevanz (Q6, Q7).           | JASP-Vergleichstabelle mit Intervallen sowie je eine Aussage zu Präzision und Übertragbarkeit. |

**Selbststudium:** Intervallaufgaben mit Taschenrechner; fehlerhafte Interpretationen korrigieren; ältere Inhalte im MC-Test.<br>
**Fallstudien-Meilenstein:** JASP-Punktschätzer plus Konfidenzintervall für einen Kursanteil, einschließlich Limitation der Gelegenheitsstichprobe.

## Woche 7 – Hypothesentests und Vorher-Nachher-Vergleiche

**Wochenziele:** Die Studierenden erklären die Logik eines Hypothesentests, interpretieren p-Werte und beurteilen einen einfachen Vorher-Nachher-Vergleich inhaltlich.

|  UE | Inhalt und Ablauf                                                                                                                                                                              | ARSnova-Bezug                                                                                                                                                                           | Lernprodukt/Evidenz                                                                                              |
| --: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
|  30 | Ausgangsfrage, Null- und Alternativhypothese; Teststatistik als Maß der Unvereinbarkeit mit $H_0$.                                                                                             | S1: vorab definierte Referenz und absolute Fehler je Runde; Untersuchung einer beobachteten Verbesserung, keine vorausgesetzte Wirkung.                                                 | Formulierung von $H_0$ und $H_1$ in Worten und Symbolen.                                                         |
|  31 | p-Wert, Signifikanzniveau, statistische Entscheidung. Abgrenzung von „Wahrscheinlichkeit, dass $H_0$ wahr ist“.                                                                                | ARSnova-Abstimmung zu typischen p-Wert-Fehlinterpretationen; Peer-Erklärung und erneute Abstimmung.                                                                                     | Ein Ergebnis mit $p=0{,}03$ korrekt in einem Satz interpretieren.                                                |
|  32 | Fehler 1. und 2. Art, Power-Idee, statistische versus praktische Relevanz. Effektgröße auf anschaulicher Ebene.                                                                                | S1: weniger Streuung bedeutet nicht automatisch weniger Fehler. MAE zum bekannten Referenzwert und praktisch relevante Verbesserung getrennt beurteilen (Q2, Q3).                       | Entscheidungsmatrix zu zwei Fehlerarten und Konsequenzen.                                                        |
|  33 | Gepaarter t-Test als ausgewähltes Verfahren in JASP 0.98.1: Differenzen bilden, Voraussetzungen prüfen, Intervall und Testausgabe lesen. Keine vollständige Herleitung.                        | S1: native aggregierte Rundenansicht plus gesonderte vollständige LEHRDATEN-Paare. Differenz absoluter Fehler; `n_pairs` ausweisen. Standardexport ersetzt keine Paartabelle (Q3, Q10). | Gespeicherter JASP-Auszug und klausurnahe Aufgabe: Verfahren wählen, Ergebnis lesen, Effekt und Grenze benennen. |
|  34 | **Testwerkstatt:** Mehrere kurze ARSnova-Fälle werden einem Untersuchungsdesign und einer angemessenen Auswertung zugeordnet. Signifikanz, Effekt und Datenqualität werden getrennt beurteilt. | Fälle zu einem Anteil, zwei unabhängigen Gruppen und gepaarten Schätzrunden; Rechnungen nur für den curricular ausgewählten gepaarten Test.                                             | Entscheidungsbaum „Fragestellung – Datentyp – Design – Verfahren – Interpretation“.                              |

**Selbststudium:** 30-Fragen-Retrieval-Satz; Testentscheidungen und p-Wert-Aussagen klassifizieren; kurze Vorher-Nachher-Auswertung.<br>
**Fallstudien-Meilenstein:** LEHRDATEN-Kurzbefund „Schätzfehler in Runde 1 und Runde 2“ ohne Kausalbehauptung.

## Woche 8 – Korrelation und lineare Regression

**Wochenziele:** Die Studierenden lesen Streudiagramme, interpretieren Korrelationen, erkennen deren Grenzen und verwenden eine Regressionsgerade für einfache Vorhersagen.

|  UE | Inhalt und Ablauf                                                                                                                                                                                                                | ARSnova-Bezug                                                                                                                                                      | Lernprodukt/Evidenz                                                           |
| --: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
|  35 | Zwei metrische Variablen und Streudiagramm; Richtung, Form, Stärke, Cluster und Ausreißer.                                                                                                                                       | S5: ausdrücklich synthetische Lastläufe mit Lastniveau und Medianlatenz; identische Hardware und Requestmix im Lehrmodell. Keine Individualprofile.                | Systematische Beschreibung eines Streudiagramms.                              |
|  36 | Pearson-Korrelation $r$: Wertebereich, Vorzeichen, Stärke, Ausreißerempfindlichkeit. „Korrelation ist nicht Kausalität.“                                                                                                         | S5: Korrelation von Lastniveau und Medianlatenz; Störfaktoren und Szenarien diskutieren. Kein metrisches Skalenniveau für einzelne Confidence-Stufen unterstellen. | Drei zulässige und unzulässige Schlussfolgerungen unterscheiden.              |
|  37 | Lineare Regression $\hat y=b_0+b_1x$ als erstes ML-Modell: Eingabe, Parameter, Vorhersage, Residuum; JASP-Ausgabe systematisch lesen.                                                                                            | S5: Regression wird in JASP mit LEHRDATEN geschätzt; ARSnova erfasst Vorhersagen und Begründungen, schätzt selbst keine Regressionsgerade.                         | Steigung und Achsenabschnitt im Kontext interpretieren; Vorhersage berechnen. |
|  38 | Güte und Grenzen: Residuen, Extrapolation, $R^2$ auf Interpretationsebene. Klausuraufgabe von Grafik zu Modell und Befund.                                                                                                       | S5: Residuen und Extrapolation bei hoher Last; Geschäftstransfer auf Kapazitätsplanung. Synthetische Daten liefern keine Produktions-SLO.                          | Modellsteckbrief mit Nutzen, Annahme und Grenze.                              |
|  39 | **JASP-Regressionslabor:** Basis- und Ausreißervariante werden getrennt analysiert; Wirkung auf $r$, Regressionsgerade, Residuen und Vorhersage wird untersucht. Anschließend wird eine unzulässige Extrapolation identifiziert. | S5: beide Varianten derselben synthetischen Lehrtabelle; ARSnova-Abstimmung über die belastbarste Interpretation.                                                  | JASP-Vorher-Nachher-Vergleich und kurze Sensitivitätsanalyse.                 |

**Selbststudium:** gemischte Aufgaben zu Streudiagramm, $r$, Regressionsgleichung und Kausalitätsfehlern.<br>
**Fallstudien-Meilenstein:** Synthetischer Last-Latenz-Lehrdatensatz mit Modellbefund; ausdrücklich keine Messung des Produktivsystems.

## Woche 9 – Train/Test, Overfitting und binäre Klassifikationsmetriken

**Wochenziele:** Die Studierenden erklären Generalisierung, erkennen Overfitting, lesen eine binäre Confusion Matrix und wählen Accuracy, Precision, Recall oder binären F1 anhand der Fehlkosten.

|  UE | Inhalt und Ablauf                                                                                                                                                                      | ARSnova-Bezug                                                                                                                                                                               | Lernprodukt/Evidenz                                                                                             |
| --: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
|  40 | Grundgesamtheit zukünftiger Fälle, vorhandene Stichprobe, Trainings- und Testdaten. Warum Evaluation auf Trainingsdaten irreführt.                                                     | Vorbereiteter Train/Test-Lehrfall; der optionale ARSnova-Q&A-NLP-Pfad wird für den Pflichtkern nicht benötigt (Q8).                                                                         | Zuordnung klassischer Statistikbegriffe zu ML-Begriffen.                                                        |
|  41 | Overfitting, Generalisierung und einfache Validierungslogik. Modellkomplexität ohne technische Herleitung.                                                                             | S6: Training 98 % / Test 71 % ausdrücklich als didaktisches Zahlenbeispiel. Abstand kann auch durch Stichprobenschwankung oder Domain Shift entstehen.                                      | Ein-Satz-Diagnose plus geeignete Gegenmaßnahme.                                                                 |
|  42 | Binäre Confusion Matrix; True/False Positive/Negative; Accuracy, Precision und Recall. Kosten von Fehlern bestimmen die Metrik.                                                        | S6: 80 synthetische Fälle „Technik erkannt?“ mit Zeilen = tatsächliche Klasse werden in JASP als Kontingenztafel ausgewertet.                                                               | Matrix und Kennzahlen aus JASP prüfen und passend zur Zielsetzung auswählen.                                    |
|  43 | Binären F1 aus Precision und Recall berechnen; Modellwert, beobachtete Gruppenhäufigkeit und sachliches Einzelergebnis unterscheiden.                                                  | S6: ausschließlich binäre LEHRDATEN und vollständig bereitgestellte Zahlen; keine Kalibrierungsmetrik.                                                                                      | Pflichtkern-Kurzbefund mit Metrik, Nenner, Fehlkosten und Aussagegrenze.                                        |
|  44 | **JASP-Modellaudit:** Train/Test-Tabelle, binäre Matrix und die vier Kernmetriken dokumentieren. Nur bei gesichertem Kern dürfen V3–V6 anhand vorbereiteter Auszüge qualitativ folgen. | V3 Macro-F1, V4 Coverage/Schwelle, V5 Kalibrierung und V6 Q&A-NLP bleiben optionale, nicht summative Vertiefungen; aus REPO-Werten werden keine Einzelbeobachtungen rekonstruiert (Q8, Q9). | Einseitige Modellkarte zum Pflichtkern; optionale Vertiefungsnotiz klar getrennt und ohne Produktivversprechen. |

**Selbststudium:** Aufgaben zur binären Confusion Matrix und zu den vier Kernmetriken; ältere Inferenzthemen im MC-Test; JASP-Ausgabe zu festen LEHRDATEN-Modelläufen lesen.<br>
**Fallstudien-Meilenstein:** Modellkarte zur binären LEHRDATEN-Klassifikation mit Zielmetrik, Fehlkosten und Grenze.

## Woche 10 – Integration, Kommunikation und Klausurtraining

**Wochenziele:** Die Studierenden führen die Schritte einer statistischen Untersuchung zusammen, wählen Verfahren begründet aus, kommunizieren Ergebnisse und bereiten sich transparent auf die Klausur vor.

|  UE | Inhalt und Ablauf                                                                                                                                      | ARSnova-Bezug                                                                                                                                              | Lernprodukt/Evidenz                                                                    |
| --: | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
|  45 | Analysewerkstatt: Von der Untersuchungsfrage zur Methode. Gruppen wählen einen Fallstudienstrang und erstellen einen Analyseplan.                      | S1–S6: Datentyp und Herkunft zuerst wählen; Analyse nur mit dafür tatsächlich ausreichenden Daten planen.                                                  | Analyseplan mit Variable, Skala, Grafik, Kennzahl/Verfahren und Grenze.                |
|  46 | Durchführung in JASP und Befund: Ergebnisse auf Plausibilität prüfen, Grafik beschriften, Unsicherheit und Limitation formulieren.                     | Freigegebene LIVE-/REPO-/LEHRDATEN bleiben getrennt; Quellenstatus, Beobachtungseinheit, Nenner, Aggregationsrunde und JASP-Version gehören in den Befund. | Einseitiger Statistikbefund nach verlinkter Vorlage und gespeicherter JASP-Kernauszug. |
|  47 | Kurzpräsentationen und Peer Review. Fokus: Was zeigen die Daten wirklich? Wo wird überinterpretiert?                                                   | RATING oder SURVEY als Peer-Feedback nach einer extern bereitgestellten Rubrik; keine eigenständige ARSnova-Rubrikfunktion voraussetzen.                   | Überarbeiteter Befund und fünf Sätze Management Summary.                               |
|  48 | Probeklausur in Miniatur mit vorbereiteten JASP-Auszügen, gemeinsame Lösungsstrategie und Abschluss-Blitzlicht. Die JASP-Bedienung wird nicht geprüft. | Kumulatives Lernquiz ohne Rangliste, Timer, Teamwertung oder Boni plus anonyme Fragewand; Abschluss-Blitzlicht nur als aktuelles Aggregat.                 | Individueller Lernplan für die Prüfung; internes Modulfeedback.                        |

**Selbststudium:** vollständiger kumulativer MC-Test im untimierten Modus `practice`, Probeklausur unter der vorgesehenen 90-Minuten-Bedingung und gezielte Wiederholung anhand der Konzeptdiagnostik.<br>
**Fallstudien-Meilenstein:** finaler JASP-gestützter ARSnova-Statistikbericht.

---

## 8. Constructive Alignment

| Modulziel                                             | Typische Lernaktivität                            | Formative Evidenz aus ARSnova, MC-Test und JASP                         | Summative Evidenz                                                       |
| ----------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| MZ1: Daten strukturieren und beurteilen               | Fallvignette, Datenprüfung, Skalenzuordnung       | anonyme Concept Question, MC-Fehlerdiagnose, dokumentierter JASP-Import | Datenstruktur und Aussagegrenze begründen                               |
| MZ2: Daten beschreiben und visualisieren              | Handrechnung und JASP-Deskription                 | Schätzverteilung, MC-Retrieval, beschriftete JASP-Tabelle/Grafik        | Kennzahl oder Darstellung auswählen, berechnen/lesen und interpretieren |
| MZ3: Zufall und Stichprobenunsicherheit modellieren   | Baum-/Kontingenztafel und Stichprobenvergleich    | Live-Entscheidung, verzögerter MC-Abruf, JASP-Verteilungsvergleich      | Wahrscheinlichkeit oder Modell wählen und Unsicherheit erklären         |
| MZ4: Schätzen und testen                              | Intervallvergleich, Testlogik, gepaarte LEHRDATEN | Peer Instruction, MC-Fehlerkontrast, JASP-Intervall/Testausgabe         | rechnen oder Ausgabe lesen, interpretieren und begrenzen                |
| MZ5: Zusammenhänge und Vorhersagen beurteilen         | Streudiagramm, Regression und Train/Test-Fall     | Live-Befund, MC-Transfer, JASP-Korrelation/Regression                   | Vorhersage, Residuum, Generalisierung und Grenze beurteilen             |
| MZ6: Binäre Klassifikation evaluieren                 | binäre Confusion Matrix und Fehlkostenfall        | ARSnova-Entscheidung, MC-Rechnung, JASP-Kreuztabelle                    | binäre Metrik berechnen/auswählen und Modellwert abgrenzen              |
| MZ7: Statistische Evidenz kommunizieren und begrenzen | einseitiger Statistikbefund und Peer Review       | JASP-Kernauszug, Rubrikfeedback, Management Summary                     | integrierter Kurzbefund mit Datenkritik                                 |

V1–V6 erscheinen in dieser Alignment-Tabelle nicht, weil sie weder Modulziele noch summative Evidenz begründen.

---

## 9. Prüfungs- und Bewertungskonzept

### 9.1 Formative, nicht benotete Elemente

- freiwillige ARSnova-Diagnosefragen ohne Rangliste und unbewertete Blitzlichter,
- gezielte Peer-Instruction mit erneuter Abstimmung,
- wöchentlicher externer MC-Test mit 30 Fragen im Modus `practice`, Sofortfeedback und kumulativer Wiederholung,
- wöchentlicher JASP-Nachweis mit Quelle, Analyse, Interpretation und Grenze,
- eine klausurnahe Kurzaufgabe pro Woche,
- Fallstudien-Meilensteine mit knapper Rückmeldung.

Rangliste, Timer, technische Teamwertung, Boni und Spielmodus sind keine Elemente des P0-Piloten. Auch ARSnova-, MC-Test- und JASP-Lernartefakte haben keine Notenwirkung.

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

Die Klausur prüft nicht das Auswendiglernen von Formeln, sondern deren angemessene Auswahl und Verwendung. Vorbereitete, vollständig beschriftete Ausschnitte aus JASP 0.98.1 dürfen als Material gelesen und interpretiert werden; weder Installation noch Menüpfad oder Softwarebedienung werden unter Prüfungszeit verlangt. Die [Probeklausur](./P0-03_Probeklausur_90_Minuten.md) und ihre [Musterlösung](./P0-03_Probeklausur_Musterloesung.md) setzen diesen Rahmen mit ausschließlich freigegebenen LEHRDATEN um.

### 9.3 Beispiel für eine integrierte Klausuraufgabe

> In einem konstruierten LEHRDATEN-Auszug (`source_ref=P0-03-EXAM-WILSON-V1`) beantworten 37 von 52 Studierenden eine Frage korrekt. Ein 95-%-Wilson-Konfidenzintervall für den zugrunde liegenden Anteil wird mit $[0{,}58;0{,}82]$ angegeben.
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
4. Welche freigegebenen Aggregate dürfen nach P0-02 für Lehre oder interne Modulevaluation übernommen werden?

---

## 11. Medien, Materialien und technische Organisation

### 11.1 Erforderliche Materialien

Der kanonische Gesamtindex ist das [P0-03-Materialpaket](./P0-03_Materialpaket_Pilotlauf.md). Zum vollständigen Pilotbestand gehören:

- die [Formelsammlung](./P0-03_Formelsammlung_Statistik.md), der [JASP-Analyseleitfaden](./P0-03_JASP_Analyseleitfaden.md), das [Lehrenden-Runbook](./P0-03_Lehrenden_Runbook.md) und das [Datenwörterbuch mit Provenienz](./P0-03_Datenwoerterbuch_Provenienz.md);
- sieben synthetische Lehrdaten-CSV: [S1 Servicezeiten](./P0-03_Lehrdaten_S1_Servicezeiten.csv), [S1 Paare](./P0-03_Lehrdaten_S1_Paare.csv), [S2 Confidence](./P0-03_Lehrdaten_S2_Confidence.csv), [S3 Q&A-Ranking](./P0-03_Lehrdaten_S3_QA_Ranking.csv), [S5 Last/Latenz](./P0-03_Lehrdaten_S5_Last_Latenz.csv), [S6 Klassifikation](./P0-03_Lehrdaten_S6_Klassifikation.csv) und [S6 Modellläufe](./P0-03_Lehrdaten_S6_Modelllaeufe.csv);
- die [Statistikbefund-Vorlage mit Rubrik](./P0-03_Statistikbefund_Vorlage_Rubrik.md), die [Probeklausur](./P0-03_Probeklausur_90_Minuten.md) und die [Musterlösung](./P0-03_Probeklausur_Musterloesung.md);
- institutionell bereitgestelltes JASP 0.98.1, einen nicht programmierbaren Taschenrechner sowie ein browserfähiges Gerät oder eine gleichwertige papierbasierte Alternative.

**Externer MC-Test:** Maßgeblich sind der [MC-Test-Blueprint](./P0-03_MC-Test_Blueprint_10_Wochen.md), der [fixierte Quellstand](https://github.com/kqc-real/streamlit/tree/b6b159555e8a228dad73dd75fd66c154a1088e28), die [Live-Instanz](https://mc-test.streamlit.app) und die zehn echten `meta`-/`questions`-Dateien:

- [W01](./P0-03_MC-Test_Woche_01.json), [W02](./P0-03_MC-Test_Woche_02.json), [W03](./P0-03_MC-Test_Woche_03.json), [W04](./P0-03_MC-Test_Woche_04.json), [W05](./P0-03_MC-Test_Woche_05.json), [W06](./P0-03_MC-Test_Woche_06.json), [W07](./P0-03_MC-Test_Woche_07.json), [W08](./P0-03_MC-Test_Woche_08.json), [W09](./P0-03_MC-Test_Woche_09.json) und [W10](./P0-03_MC-Test_Woche_10.json).

**ARSnova.eu-Livequiz:** Maßgeblich sind der [Livequiz-Blueprint](./P0-03_ARSnova_Livequiz_Blueprint_10_Wochen.md) und die zehn Nicht-Spiel-Dateien mit insgesamt 50 Livefragen, davon 47 Pflichtkernfragen und drei gegatete Vertiefungsfragen:

- [W01](./P0-03_ARSnova_Woche_01.json), [W02](./P0-03_ARSnova_Woche_02.json), [W03](./P0-03_ARSnova_Woche_03.json), [W04](./P0-03_ARSnova_Woche_04.json), [W05](./P0-03_ARSnova_Woche_05.json), [W06](./P0-03_ARSnova_Woche_06.json), [W07](./P0-03_ARSnova_Woche_07.json), [W08](./P0-03_ARSnova_Woche_08.json), [W09](./P0-03_ARSnova_Woche_09.json) und [W10](./P0-03_ARSnova_Woche_10.json).

Gültige `.jasp`-Dateien und Laufzeitexporte entstehen erst im geschützten Lehrbetrieb. Sie werden nicht als Repository-Textartefakte vorgetäuscht und folgen vollständig dem P0-02-Datenplan.

### 11.2 Technischer Ablauf vor jeder Sitzung

- Paketversion, Wochen-JSON, Session und QR-Code/URL nach dem Runbook vorab testen,
- den freigegebenen Pool von 3–6 Livefragen pro Wochenblock vorbereiten und ausschließlich Diagnose- oder Lernmodus kennzeichnen,
- Nicht-Spiel-Baseline mit deaktivierter Rangliste, deaktiviertem Timer, deaktivierter Teamwertung und deaktivierten Boni im Import prüfen,
- die benötigte Lehrdaten-CSV in JASP 0.98.1 importieren; Zeilenzahl, Skalenniveaus und Kontrollwerte mit Datenwörterbuch und Leitfaden abgleichen,
- MC-Test im Modus `practice` ohne Timer und mit Sofortfeedback testen; `show_top5_public=false`, genau 30 Fragen und nur empfohlene Lerndurchläufe prüfen,
- vor `FINISHED` Q&A aktualisieren und den separaten Q&A-CSV sichern; unmittelbar nach `FINISHED` Ergebnisbericht und allgemeinen Session-CSV exportieren (Q6, Q10, Q15),
- Aggregationsrunde und ausgelassene Fragen prüfen: nie geöffnete/ausgelassene Fragen fehlen fachlich im Bericht, geöffnete ohne Antworten erscheinen als „Keine Antworten“ (Q10),
- Einzelwert-, Paar- und Regressionstabellen ausschließlich als freigegebene LEHRDATEN vorbereiten; keine Rohwerte oder Paare aus Aggregaten ableiten,
- Offline-Fallback mit lokalem Fragenbestand, Antwortkarten/Zählbogen und vorab erzeugtem JASP-Referenzoutput bereithalten,
- bei LIVE-Daten stets $n$, fehlende Antworten, Runde und Freigabestatus sichtbar machen und den P0-02-Löschhandoff auslösen.

### 11.3 Barrierearmut

- Fragen werden zusätzlich vorgelesen bzw. sind in gut lesbarer Form verfügbar.
- Farben sind nie alleinige Bedeutungsträger.
- Im P0-Piloten werden weder in ARSnova.eu noch im MC-Lernmodus technische Zeitlimits verwendet.
- Alternativen zur individuellen Tablet-Eingabe sind möglich.
- Diagramme erhalten Titel, Achsenbeschriftungen, Einheiten und eine textliche Kernaussage.

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
- Programmier- und Paketinstallation als Zugangshürde.

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

---

## 16. Repository-Abgleich, belastbare Einsatzgrenzen und Quellen

### 16.1 Umfang der Untersuchung

Referenz ist der oben genannte Commit des Default-Branches main. Der vollständige rekursive Dateibaum mit **1.812 Einträgen** wurde erfasst (nicht abgeschnitten). Die Untersuchung berücksichtigt die Gesamtstruktur aus Frontend, Backend, Shared Types, Datenmodell, Reporting, Dokumentation, Beispielen und Test-/Lastskripten. Die für dieses Modul maßgeblichen Funktionsbeschreibungen wurden gegen Implementierung, Schemas und ausgewählte Tests geprüft. Das ist ein repositoryweiter didaktisch-technischer Abgleich, kein zeilenweises Audit aller Dateien. Die Anwendung wurde dabei nicht ausgeführt; Produktionskonfiguration, aktuelle Erreichbarkeit und Messergebnisse wurden nicht neu getestet.

| Repositorybereich              | Befund für das Modul                                                                 | Konsequenz                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Quiz, Host, Q&A und Blitzlicht | Mehrere getrennte Interaktions- und Bewertungsformen                                 | Selbstauskunft, bewertete Aufgabe und Live-Feedback passend einsetzen.                                                 |
| Backend und Shared Types       | Berechnungskonventionen, Aggregationsrunde und Nenner beeinflussen Statistik         | Lehrdatenkatalog und Aufgaben benennen diese Entscheidungen ausdrücklich.                                              |
| Ergebnisberichte               | PDF und CSV beruhen auf aggregiertem Exportvertrag                                   | Visualisierung und aggregierte Rundenvergleiche nutzen; Einzelwertanalysen separat vorbereiten.                        |
| Quiz-Importbeispiele           | Statistikfragen vorhanden, aber gemischte MINT-Demos und technische Voreinstellungen | Nur als Repository-Beleg verwenden; der P0-Pilot nutzt die 20 dedizierten, geprüften Dateien mit Nicht-Spiel-Baseline. |
| Q&A-Ranking                    | Wilson und Kontroversität sind im Code implementiert                                 | Als authentischen Managementtransfer ausschließlich in V1 und ohne summative Prüfung verwenden.                        |
| NLP und Evaluation             | Optionaler Seed-basierter Klassifikator und ausgewiesene Auswertungsnenner           | Nur als V4/V6; Classified-Accuracy und Coverage nicht mit Pflichtkern oder Produktivqualität verwechseln.              |
| Infrastruktur und Lasttests    | Dokumentierte Szenarien und Messartefakte                                            | Servicekennzahlen lesen; Lastszenarien und Inferenzzeiten nicht vermischen.                                            |
| Didaktikdokumentation          | Statistik- und weitere Vertiefungsideen vorhanden                                    | Für 48 UE selektieren; komplexe NLP-/Cloud-Theorie bleibt Vertiefung.                                                  |

### 16.2 Repositoryvorlagen und P0-Abgrenzung

| Vorlage                            | Konkreter Inhalt                                                      | Einbindung und Anpassung                                                         |
| ---------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Statistik kompakt – Konzepte (Q11) | Normalverteilung und Bayes; weitere Demo-Inhalte vor Übernahme prüfen | Wochen 4–5; in Alltagssprache einführen, Lösungen begründen lassen.              |
| Mixed-Demo (Q12)                   | Standardabweichung und eigenständiges Sicherheits-Rating              | Woche 3 und Feedback; Rating nicht mit antwortbezogener Confidence gleichsetzen. |
| Single-Choice-Demo (Q13)           | Wahrscheinlichkeit beim zweimaligen Münzwurf                          | Woche 4 als niedrigschwelliger Einstieg.                                         |

Diese drei Repository-Importdateien belegen Funktionen und mögliche Ausgangsinhalte, sind aber nicht der Pilotfragenpool. Für P0 liegen die in Kapitel 11 verlinkten zehn ARSnova-Livequiz- und zehn MC-Test-Dateien vollständig vor. Deren Nicht-Spiel- beziehungsweise `practice`-Konfiguration ist verbindlich; Demo-Timer oder Leaderboard werden nicht übernommen. Für Rechenaufgaben eignet sich technisch auch numerisch bewertete SHORT_TEXT-Kurzantwort; offene Interpretationssätze werden durch die Lehrperson besprochen, nicht als automatisch semantisch bewertete Antworten ausgegeben (Q15, Q17).

### 16.3 Drei zusätzliche Aufgabenbausteine

**A – Ranking und Messgröße (UE 29, nur V1).** Bei 100 Teilnehmenden erhält Frage A eine positive und eine negative Stimme, Frage B 40 positive und 40 negative Stimmen. Beide haben 50 % Zustimmung und Netto-Score 0. Im implementierten Kontroversitätsmaß mit C = max(1; 0,1N) ergeben sich rund 0,167 und 0,889. Die Aufgabe darf nur nach offenem Gate als nicht summative Anschauung eingesetzt werden. Der Score ist eine gestaltete Priorisierungsmetrik, kein Signifikanztest (Q6, Q7).

**B – Einheiten und Streuung (UE 11).** Synthetische Schätzwerte in Sekunden: 100, 110, 120, 130, 140. Mittelwert 120; Quadratsumme der Abweichungen 1.000. ARSnova-deskriptiv: Varianz 200 s², Standardabweichung rund 14,14 s. Stichprobenschätzer: Varianz 250 s², Standardabweichung rund 15,81 s. Begründen Sie den Unterschied. Ein anderer Wert in der Formelsammlung ist hier kein Softwarefehler (Q3).

**C – Automatisierungsqualität und Aufwand (UE 44, nur V3/V4/V6).** Dokumentierte Classified-Accuracy/Coverage: Gatekeeper 0,84/0,97; Kaskade 0,87/0,85 bei derselben Schwelle 0,55. Die Aufgabe darf nur nach offenem Gate als nicht summative Anschauung eingesetzt werden. Für 100 gedachte Fälle entsprechen die gerundeten Raten etwa 3 bzw. 15 Fällen für die manuelle Nachbearbeitung. Diese Hochrechnung ist ein Lehrbeispiel, keine rekonstruierte Confusion Matrix. Ohne Fehlerkosten und Prüfung nicht akzeptierter Fälle gibt es keine eindeutige Managementempfehlung. Macro-F1 des Gatekeepers bezieht sich auf Best-Guess-Klassen über alle gelabelten Eval-Fälle, nicht nur die akzeptierte Teilmenge (Q8, Q9).

### 16.4 Quellenverzeichnis

Q1–Q17 sind auf den ARSnova.eu-Referenzcommit fixiert. Q18 verweist auf den eigenständigen, fixierten MC-Test-Commit. Q19 und Q20 sind offizielle JASP-Seiten; sie belegen Download sowie Version und Veröffentlichungsdatum. Bei Widersprüchen zwischen älterer Funktionsdokumentation und aktuellem Code ist der geprüfte Code maßgeblich; der Funktionsnachweis im Repository ersetzt keine Prüfung der eingesetzten Instanz.

- **Q1:** [Produkt und Architektur](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/README.md).
- **Q2:** [Schätzfrage und Rundenvergleich](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/features/numeric-estimate.md).
- **Q3:** [Statistikberechnung und Session-Export](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/apps/backend/src/routers/session.ts).
- **Q4:** [Selbsteinschätzung und Aggregationsrunde](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/libs/shared-types/src/confidence.ts).
- **Q5:** [Selbsteinschätzung im Lehrbetrieb](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/features/confidence-slider.md).
- **Q6:** [Wilson- und Kontroversitätsberechnung](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/apps/backend/src/routers/qa.ts).
- **Q7:** [Q&A-Ranking](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/features/controversy-score.md).
- **Q8:** [Optionale NLP-Kaskade und dokumentierte Evaluation](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/features/qa-nlp-moderation.md).
- **Q9:** [Nenner und Metriken der NLP-Evaluation](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/apps/backend/src/lib/qaNlpEvaluate.ts).
- **Q10:** [PDF-/CSV-Ergebnisbericht](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/features/session-export-pdf.md).
- **Q11:** [Statistik kompakt – Konzepte](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/examples/quiz-import/quiz-multiple-choice-realistisch.json).
- **Q12:** [Mixed-Demo mit Standardabweichung und Rating](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/examples/quiz-import/quiz-mixed-realistisch.json).
- **Q13:** [Single-Choice-Demo mit Münzwurf](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/examples/quiz-import/quiz-single-choice-realistisch.json).
- **Q14:** [Regelbasierter Moderationskompass](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/features/moderation-compass.md).
- **Q15:** [Funktionsübersicht und Fragetypen](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/APP-FUNKTIONSUEBERSICHT.md).
- **Q16:** [Statistik- und Managementtransfer](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/didaktik/MODERATIONSKOMPASS-8.9A-D-MODULE-UND-PRAKTIKA.md).
- **Q17:** [Fragetypen und numerische Antwortbewertung](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/libs/shared-types/src/schemas.ts).
- **Q18:** [MC-Test – fixierter Commit `b6b159555e8a228dad73dd75fd66c154a1088e28`](https://github.com/kqc-real/streamlit/tree/b6b159555e8a228dad73dd75fd66c154a1088e28).
- **Q19:** [Offizieller JASP-Download – JASP 0.98.1](https://jasp-stats.org/download/).
- **Q20:** [Offizielle JASP Release Notes – 0.98.1, veröffentlicht am 07.07.2026](https://jasp-stats.org/release-notes/).
