# Probeklausur – Angewandte Statistik

**Kürzel vorab:** **MZ7** bezeichnet das siebte Modulziel „Statistische Evidenz kommunizieren und begrenzen“, **W09** die neunte Kurswoche, **JASP** die verwendete Analysesoftware und **`source_ref`** die Quellenkennung eines Datensatzes. **A1–A6** und **V1** innerhalb dieser Quellenkennungen bezeichnen Klausuraufgabe 1–6 und Datensatzversion 1, nicht die Formelblöcke oder curriculare Vertiefungscodes.

- **Version:** 2.0.1 · **Stand:** 13.09.2026
- **Bearbeitungszeit:** 90 Minuten
- **Gesamtpunktzahl:** 60 Punkte
- **Hilfsmittel:** offizielle Formelsammlung und nicht programmierbarer
  Taschenrechner
- **Prüfungsform:** schriftliche Einzelarbeit

## Hinweise

1. Schreiben Sie Rechenweg, eingesetzte Formel, Nenner und Einheit auf.
2. Rechnen Sie mit ungerundeten Zwischenwerten. Runden Sie erst das
   Endergebnis nach den Regeln der Formelsammlung.
3. Dezimalkomma und Dezimalpunkt in bereitgestellten Ausgaben bedeuten
   dasselbe.
4. Alle Fallstudienauszüge sind als **LEHRDATEN** gekennzeichnet. Konstruierte
   Klausurwerte ohne Datenregister tragen im Aufgabenstamm eine stabile
   `source_ref`-Bezeichnung. Daraus dürfen keine stärkeren Aussagen abgeleitet
   werden, als die Datenherkunft erlaubt.
5. JASP ist die verbindliche Analysesoftware des Moduls. In dieser
   Papierklausur müssen Sie JASP nicht bedienen; alle benötigten
   JASP-Ausgaben sind abgedruckt.
6. Es werden keine Schaltflächen, Einstellungen oder sonstigen
   Produktdetails von ARSnova oder JASP abgefragt.
7. Ein ausdrücklich als **Wilson** bezeichnetes Intervall wird als
   Wilson-Intervall gelesen. Es wird nicht mit der Wald-Formel nachgerechnet.
8. Kritische \(z\)- und \(t\)-Werte stehen jeweils in der Aufgabe, sofern sie
   benötigt werden.
9. Eine inhaltlich und zeitlich gleichwertige barrierearme Fassung wird nach
   der [Material- und A11y-Matrix](./P0-03_Barrierefreiheit_Material_und_Probe.md)
   bereitgestellt. JASP-Tabellen müssen ohne Farbcodierung und ohne eine nur
   grafisch erkennbare Information lösbar sein.

## Verbindliche Punkte- und Minutenplanung

| Aufgabe | Pflichtkern                                  | Aufgabentyp                                      | Punkte |   Richtzeit |
| ------: | -------------------------------------------- | ------------------------------------------------ | -----: | ----------: |
|       1 | Daten, Häufigkeit, Lage und Streuung         | positive Anwendung und negative Fehlerdiagnose   |     12 |     18 Min. |
|       2 | Wahrscheinlichkeit, Bayes und Binomialmodell | positive Anwendung und negative Modellprüfung    |      9 |     14 Min. |
|       3 | Standardfehler und Konfidenzintervalle       | positive Anwendung und negative Interpretation   |      9 |     13 Min. |
|       4 | gepaarter \(t\)-Test                         | positive Auswertung und negative Kausalaussage   |      9 |     14 Min. |
|       5 | Korrelation, Regression und Residuum         | Anwendung, Fehlerdiagnose und Transfer           |      9 |     13 Min. |
|       6 | Train/Test und Klassifikationsmetriken       | Anwendung, Fehlerdiagnose und Managementtransfer |     12 |     18 Min. |
|         | **Gesamt**                                   |                                                  | **60** | **90 Min.** |

Die Richtzeiten umfassen das Lesen der jeweiligen Ausgabe.

## Verbindliches Curriculum-Mapping

Die 60 Punkte setzen die Richtwerte aus P0-01 exakt um. Punkte werden auch bei
querschnittlichen Kompetenzen nur einmal gezählt:

| Klausurbereich                                  | Zugeordnete Teilaufgaben          | Punkte |    Anteil |
| ----------------------------------------------- | --------------------------------- | -----: | --------: |
| Daten, Visualisierung und deskriptive Statistik | Aufgabe 1                         |     12 |      20 % |
| Wahrscheinlichkeit und Verteilungen             | Aufgabe 2                         |      9 |      15 % |
| Stichproben und Konfidenzintervalle             | Aufgabe 3                         |      9 |      15 % |
| Hypothesentests                                 | Aufgabe 4                         |      9 |      15 % |
| Korrelation und Regression                      | Aufgabe 5                         |      9 |      15 % |
| Train/Test und binäre ML-Evaluation             | 6a–6c sowie Diagnoseanteil von 6d |      9 |      15 % |
| integrierte Datenkritik und Kommunikation       | Grenzanteil von 6d sowie 6e       |      3 |       5 % |
| **Gesamt**                                      |                                   | **60** | **100 %** |

In 6d entfällt ein Punkt auf die fachliche Diagnose und ein Punkt auf deren
konkrete Aussagegrenze. Aufgabe 6e vergibt zwei weitere MZ7-Punkte. Diese
individuelle Klausurevidenz ist vom formativen Gruppen-Statistikbefund
getrennt.

---

## Aufgabe 1 – ARSnova-Daten beschreiben

**12 Punkte · 18 Minuten**

### ARSnova-Auszug A: Single-Choice-Frage (LEHRDATEN)

**source_ref:** `P0-03-PROBEKLAUSUR-A1-OPTIONEN-V1`

Für den konstruierten Aufgabenauszug gilt: Jede der 48 antwortenden Personen
konnte genau eine Option wählen.

| Option |   A |   B |   C |   D | Summe |
| ------ | --: | --: | --: | --: | ----: |
| Anzahl |  12 |  24 |   8 |   4 |    48 |

### ARSnova-Auszug B: numerische Schätzfrage (LEHRDATEN)

**source_ref:** `P0-03-PROBEKLAUSUR-A1-SCHAETZUNG-V1`

Die fünf Schätzwerte in Sekunden lauten:

$$
100,\ 110,\ 120,\ 130,\ 140
$$

Die ARSnova-Zusammenfassung zeigt:

| \(n\) | Mittelwert | deskriptive Standardabweichung, Division durch \(n\) |
| ----: | ---------: | ---------------------------------------------------: |
|     5 |   120,00 s |                                              14,14 s |

### Teilaufgaben

#### a) Positive Anwendung – 3 Punkte · 4 Minuten

Nennen Sie für Auszug A die Beobachtungseinheit, das Skalenniveau der
gewählten Option und die ausgewertete Stichprobengröße.

#### b) Positive Anwendung – 2 Punkte · 3 Minuten

Berechnen Sie die relative Häufigkeit von Option B als Anteil und als Prozent.

#### c) Negative Fehlerdiagnose – 2 Punkte · 3 Minuten

Wählen Sie für Auszug A zwischen Balkendiagramm und Histogramm. Begründen Sie
die Wahl. Erklären Sie zusätzlich, warum eine bei 20 Antworten beginnende
Häufigkeitsachse den Unterschied zwischen A und B irreführend darstellen
würde.

#### d) Positive Anwendung – 3 Punkte · 5 Minuten

Berechnen Sie aus den fünf Einzelwerten die Stichprobenvarianz \(s^2\) und die
Stichprobenstandardabweichung \(s\) mit Division durch \(n-1\). Zeigen Sie,
warum das Ergebnis von der ARSnova-Anzeige abweicht.

#### e) Interpretation – 2 Punkte · 3 Minuten

Interpretieren Sie \(s\) in einem vollständigen Satz mit Kontext und Einheit.
Formulieren Sie keine Aussage, die für jeden Einzelwert gelten müsste.

---

## Aufgabe 2 – MC-Test, bedingte Wahrscheinlichkeit und Binomialmodell

**9 Punkte · 14 Minuten**

### MC-Test-Diagnoseauszug (LEHRDATEN)

**source_ref:** `P0-03-PROBEKLAUSUR-A2-TAFEL-V1`

Für 100 anonymisierte Einzelantworten wurde festgehalten:

- \(W\): Die Antwort war fachlich falsch.
- \(F\): Das zugehörige Konzept wurde für eine Wiederholung markiert.

|                          | \(F\): markiert | \(\overline F\): nicht markiert |   Summe |
| ------------------------ | --------------: | ------------------------------: | ------: |
| \(W\): falsch            |              16 |                               4 |      20 |
| \(\overline W\): richtig |               8 |                              72 |      80 |
| **Summe**                |          **24** |                          **76** | **100** |

Ein gesondertes idealisiertes Übungsmodell nimmt für drei gleichartige
Abruffragen unabhängige Versuche mit konstanter
Erfolgswahrscheinlichkeit \(p=0{,}70\) an.

### Teilaufgaben

#### a) Positive Anwendung – 2 Punkte · 3 Minuten

Berechnen Sie \(P(W\cup F)\) mit der Additionsregel.

#### b) Bayes-Denken – 3 Punkte · 5 Minuten

Berechnen Sie \(P(W\mid F)\) und \(P(F\mid W)\). Erklären Sie in einem Satz,
warum die beiden Wahrscheinlichkeiten verschiedene Fragen beantworten.

#### c) Positive Anwendung – 2 Punkte · 3 Minuten

Für das idealisierte Übungsmodell gilt \(X\sim Bin(3;0{,}70)\). Berechnen Sie
die Wahrscheinlichkeit, genau zwei Fragen richtig zu beantworten.

#### d) Negative Modellprüfung – 2 Punkte · 3 Minuten

Im echten kumulativen MC-Test reichen die beobachteten Lösungsquoten
verschiedener Items von 0,42 bis 0,90; außerdem beantworten dieselben Personen
mehrere Items. Nennen Sie zwei Bedingungen des Binomialmodells, die deshalb
für die Gesamtzahl richtiger Antworten fraglich sind.

---

## Aufgabe 3 – Unsicherheit und zwei Konfidenzintervalle

**9 Punkte · 13 Minuten**

### Auszug A: ARSnova-Aggregat mit bereitgestelltem Intervall (LEHRDATEN)

**source_ref:** `P0-03-PROBEKLAUSUR-A3-WILSON-V1`

Für das konstruierte Aufgabenaggregat gilt: Bei einer Konzeptfrage antworteten
37 von 52 Personen korrekt. Für den zugrunde liegenden Anteil wurde aus diesen
Daten folgendes Leseintervall bereitgestellt:

> **95-%-Wilson-Konfidenzintervall:** \([0{,}577;\ 0{,}817]\)

### Auszug B: JASP Descriptives (LEHRDATEN)

**source_ref:** `P0-03-PROBEKLAUSUR-A3-MITTELWERT-V1`

Die Variable `service_time_s` enthält unabhängige Servicezeiten in Sekunden.

| Variable         | Valid \(n\) |    Mean | Std. Deviation \(s\) |
| ---------------- | ----------: | ------: | -------------------: |
| `service_time_s` |          12 | 120,000 |               15,000 |

Für das 95-%-\(t\)-Konfidenzintervall ist gegeben:

$$
t_{0{,}975;\,11}=2{,}201
$$

### Teilaufgaben

#### a) Positive Anwendung – 2 Punkte · 3 Minuten

Berechnen Sie für Auszug A den beobachteten Anteil \(\hat p\) und seinen
geschätzten Standardfehler \(SE(\hat p)\). Berechnen Sie kein zweites
Konfidenzintervall.

#### b) Positive Interpretation – 2 Punkte · 3 Minuten

Interpretieren Sie das ausdrücklich als Wilson bezeichnete Intervall im
Kontext.

#### c) Negative Interpretation – 2 Punkte · 3 Minuten

Widerlegen Sie mit zwei fachlichen Gründen die Aussage:

> „Das Intervall zeigt, dass 95 % aller BWL-Studierenden zwischen 57,7 % und
> 81,7 % der Fragen richtig beantworten.“

#### d) Positive Anwendung – 3 Punkte · 4 Minuten

Berechnen Sie aus Auszug B das 95-%-\(t\)-Konfidenzintervall für die mittlere
Servicezeit. Interpretieren Sie es in einem Satz.

---

## Aufgabe 4 – Gepaarter \(t\)-Test mit JASP

**9 Punkte · 14 Minuten**

Zehn Personen schätzten vor und nach einer Peer-Diskussion denselben
Referenzwert in Sekunden. Für jede Person wurde der absolute Schätzfehler in
Sekunden berechnet.

**source_ref:** `P0-03-PROBEKLAUSUR-A4-PAARE-V1`

Definiert ist

$$
d_i=\lvert Fehler_{i,R1}\rvert-\lvert Fehler_{i,R2}\rvert.
$$

Positive Differenzen bedeuten damit eine Verbesserung.

### JASP-Auszug: Paired Samples T-Test (LEHRDATEN)

| Paar                  | \(n\) | Mean difference | SD difference | SE difference | \(t\) | \(df\) | \(p\), zweiseitig | 95 % CI mean difference |
| --------------------- | ----: | --------------: | ------------: | ------------: | ----: | -----: | ----------------: | ----------------------: |
| Fehler R1 – Fehler R2 |    10 |           4,000 |         5,000 |         1,581 | 2,530 |      9 |             0,032 |          [0,423; 7,577] |

Es gelten \(\alpha=0{,}05\) und
\(t_{0{,}975;\,9}=2{,}262\).

### Teilaufgaben

#### a) Designverständnis – 2 Punkte · 3 Minuten

Erklären Sie, wodurch die Daten gepaart sind, und deuten Sie das Vorzeichen
einer positiven Differenz.

#### b) Hypothesen – 2 Punkte · 3 Minuten

Formulieren Sie die zweiseitige Null- und Alternativhypothese für den
Populationsmittelwert \(\mu_d\).

#### c) Positive Anwendung – 2 Punkte · 3 Minuten

Berechnen Sie \(SE(\bar d)\) und \(t\) aus \(n=10\), \(\bar d=4{,}000\) und
\(s_d=5{,}000\). Vergleichen Sie mit der JASP-Ausgabe.

#### d) Testentscheidung und Interpretation – 2 Punkte · 3 Minuten

Treffen Sie die Entscheidung bei \(\alpha=0{,}05\) anhand von \(p\) oder des
kritischen \(t\)-Werts. Interpretieren Sie Richtung und Größenordnung des
beobachteten Effekts, ohne den \(p\)-Wert als Wahrscheinlichkeit der
Nullhypothese zu deuten.

#### e) Negative Kausalaussage – 1 Punkt · 2 Minuten

Nennen Sie einen konkreten Grund, weshalb dieser gepaarte Vergleich allein
nicht beweist, dass die Peer-Diskussion die Verbesserung verursacht hat.

---

## Aufgabe 5 – Korrelation, Regression und Transfer

**9 Punkte · 13 Minuten**

Zwölf ausdrücklich synthetische Lastläufe bilden **LEHRDATEN**. \(x\) ist die
Zahl gleichzeitiger Nutzungen, \(y\) die Medianlatenz in Millisekunden. Der
beobachtete Bereich von \(x\) reicht von 100 bis 500.

**source_ref:** `P0-03-PROBEKLAUSUR-A5-REGRESSION-V1`

### JASP-Auszug

**Pearson's Correlations**

| Variablenpaar                          | \(n\) | Pearson's \(r\) |   \(p\) |
| -------------------------------------- | ----: | --------------: | ------: |
| gleichzeitige Nutzungen – Medianlatenz |    12 |           0,840 | < 0,001 |

**Linear Regression**

| Modellkennzahl |  Wert |
| -------------- | ----: |
| \(R^2\)        | 0,706 |

| Koeffizient                     | Estimate |
| ------------------------------- | -------: |
| Intercept \(b_0\)               |   40,000 |
| gleichzeitige Nutzungen \(b_1\) |    0,180 |

Für einen der zwölf Läufe gilt \(x=300\) und \(y=100\) ms.

### Teilaufgaben

#### a) Positive Interpretation – 2 Punkte · 3 Minuten

Interpretieren Sie Richtung und Stärke von \(r\). Grenzen Sie die Aussage von
einem Kausalnachweis ab.

#### b) Modellverständnis – 2 Punkte · 3 Minuten

Interpretieren Sie \(b_1\) mit Einheiten. Erklären Sie, warum \(b_0\) hier
nicht zwingend eine sinnvolle reale Betriebssituation beschreibt.

#### c) Positive Anwendung – 3 Punkte · 4 Minuten

Berechnen Sie für \(x=300\) die Vorhersage \(\hat y\) und das Residuum
\(e=y-\hat y\). Interpretieren Sie das Vorzeichen des Residuums.

#### d) Negative Transferdiagnose – 2 Punkte · 3 Minuten

Eine Führungskraft setzt \(x=900\) in die Gerade ein und behauptet, der so
berechnete Wert sei eine sichere Produktionsprognose. Nennen Sie zwei
fachliche Einwände.

---

## Aufgabe 6 – Klassifikationsmetriken und Managementbefund

**12 Punkte · 18 Minuten**

Ein binäres Modell ordnet synthetische neue Testfälle der Zielklasse
„Technik“ oder „Nicht-Technik“ zu. „Technik“ ist die positive Klasse.

### JASP-Auszug: Confusion Matrix, Testdaten (LEHRDATEN)

**source_ref:** `P0-03-PROBEKLAUSUR-A6-MATRIX-V1`

| tatsächliche Klasse | vorhergesagt: Technik | vorhergesagt: Nicht-Technik |   Summe |
| ------------------- | --------------------: | --------------------------: | ------: |
| Technik             |                    36 |                           4 |      40 |
| Nicht-Technik       |                     9 |                          51 |      60 |
| **Summe**           |                **45** |                      **55** | **100** |

### MC-Test-Transferauszug

**source_ref:** `P0-03-PROBEKLAUSUR-A6-TRAINTEST-V1`

| Auswertung     | Accuracy |
| -------------- | -------: |
| Trainingsdaten |     0,98 |
| neue Testdaten |     0,87 |

Der Train/Test-Auszug ist ein eigener konstruierter Lehrfall. Seine
Test-Accuracy darf nicht aus der darüberstehenden 100-Fälle-Matrix hergeleitet
oder mit dem W09-Beispiel 98 %/71 % gleichgesetzt werden.

### Teilaufgaben

#### a) Matrix lesen – 2 Punkte · 3 Minuten

Ordnen Sie die vier inneren Zellen \(TP\), \(TN\), \(FP\) und \(FN\) zu.

#### b) Positive Anwendung – 4 Punkte · 6 Minuten

Berechnen Sie Accuracy, Precision, Recall und F1 für die positive Klasse
„Technik“.

#### c) Managementtransfer – 2 Punkte · 3 Minuten

Nicht erkannte technische Fälle seien wesentlich teurer als eine unnötige
technische Prüfung. Wählen Sie zwischen Precision und Recall die vorrangige
Zielmetrik und begründen Sie die Wahl.

#### d) Negative Modellinterpretation – 2 Punkte · 3 Minuten

Beurteilen Sie den Unterschied zwischen Trainings- und Test-Accuracy.
Formulieren Sie eine plausible Diagnose und eine Grenze dieser Diagnose.

#### e) Statistikbefund – 2 Punkte · 3 Minuten

Formulieren Sie höchstens zwei Sätze für eine Management-Zielgruppe. Nennen
Sie mindestens eine Testmetrik, eine daraus ableitbare Handlung und eine
Grenze der Daten.
