# P0-03 – MC-Test-Blueprint für 10 Wochen

**Version:** 4.0.0 · **Stand:** 14.09.2026 · **Status:** normative Spezifikation für 300 anspruchsvolle Items im Präsenz- und Spaced-Repetition-Betrieb

**Kanonischer Index:** [P0-03_Materialpaket_Pilotlauf.md](./P0-03_Materialpaket_Pilotlauf.md)

**MC-Test-Referenz:** [fixierter Quellstand `b6b159555e8a228dad73dd75fd66c154a1088e28`](https://github.com/kqc-real/streamlit/tree/b6b159555e8a228dad73dd75fd66c154a1088e28) · [Live-Instanz](https://mc-test.streamlit.app)

**Kürzel vorab:** **BWL/WI** steht für Betriebswirtschaftslehre/Wirtschaftsinformatik, **W01–W10** bezeichnet die Kurswochen, **LE** eine 90-minütige Vorlesungs- beziehungsweise Lerneinheit aus zwei **UE**, **UE** eine 45-minütige Unterrichtseinheit, **MC** Multiple Choice, **LI01–LI24** die Leistungsindikatoren, **I01–I30** die Items einer Wochen-Datei sowie **IR**, **QE** und **DJ** Item-Redaktion, Qualitätsprüfung und Daten-/JASP-Prüfung.

## 1. Verbindlicher Auslieferungsvertrag

- Es gibt zehn Wochen-Dateien mit **genau 30 auszuliefernden Items je Woche** und damit **genau 300 Items**.
- Kein adaptiver Pfad und keine Zufallsstichprobe darf die Zahl 30 reduzieren. Eine Plattform darf nur die Antwortoptionen eines Items umordnen.
- Die Quelldatei darf nicht von dieser optionalen Umordnung abhängen: Je Wochen-Datei ist jede der vier Lösungspositionen sieben- oder achtmal richtig; erkennbare periodische Folgen und Serien von mehr als drei gleichen Positionen sind unzulässig.
- Der erste Durchlauf erfolgt in der letzten UE jeder Woche. Danach werden aggregierte Ergebnisse, Lösungen und häufige Distraktoren gemeinsam besprochen.
- Verbindlicher Laufzeitmodus ist `practice`: **kein Timer, Sofortfeedback** nach jeder Antwort.
- In der Deployment-Konfiguration gilt `show_top5_public=false`; eine öffentliche Top-5-Anzeige ist nicht zulässig.
- `meta.test_duration_minutes=32` ist der organisatorische Richtwert für den Präsenzdurchlauf, keine technische Zeitbegrenzung im Lernmodus.
- Jede Wochen-Datei enthält genau 12 mittlere und 18 schwere Items. Leichte Items sind nicht zulässig.
- Alle Distraktoren bilden fachlich plausible Fehlkonzepte oder realistische Rechen- und Interpretationsfehler ab. Die vier Optionen eines Items sind grammatisch parallel, von vergleichbarer Länge und in derselben Wortart beziehungsweise Satzform formuliert.
- Ein zweiter vollständiger Durchlauf folgt nach zwei bis drei Tagen. Mindestens ein Kernkonzept jeder behandelten Woche erscheint nach zwei bis vier Wochen erneut. MC-Test begrenzt die Zahl der Durchläufe technisch nicht.
- Nach jeder Antwort erscheinen eine fachliche Erklärung und zwei bis vier itemnahe Einträge aus `mini_glossary`.
- Lernanalytik wird nur aggregiert für Lehre und interne Modulevaluation genutzt. Antwortzeit ist kein Kompetenzmaß.
- Rechen- und Softwareergebnisse werden in JASP 0.98.1 nach dem [JASP-Analyseleitfaden](./P0-03_JASP_Analyseleitfaden.md) geprüft.
- Für jede Datei steht nach der [Material-/A11y-Matrix](./P0-03_Barrierefreiheit_Material_und_Probe.md) eine vollständige, untimierte Alternativfassung mit denselben 30 Fragen, Lösungen, Erklärungen und Glossaren bereit.
- Der Blueprint misst die 24 Lernziele des Hauptkonzepts. Er führt keine Forschungsvariablen, experimentellen Gruppen oder externen Vergleichskohorten ein.
- ARSnova-, MC-Test- und sonstige LIVE-Daten dürfen nicht zur individuellen Leistungsbewertung verwendet werden. Eine getrennte Klausur mit ausschließlich dafür freigegebenen LEHRDATEN bleibt zulässig.

## 2. Dateien, IDs und JSON-Regeln

### 2.1 Dateinamen und Item-IDs

| Woche | Datei                                                                | abgeleitete redaktionelle Kennungen       |
| ----: | -------------------------------------------------------------------- | ----------------------------------------- |
|   W01 | [P0-03_MC-Test_Woche_01.json](./MC-Test/P0-03_MC-Test_Woche_01.json) | `P0-03-MC-W01-I01` bis `P0-03-MC-W01-I30` |
|   W02 | [P0-03_MC-Test_Woche_02.json](./MC-Test/P0-03_MC-Test_Woche_02.json) | `P0-03-MC-W02-I01` bis `P0-03-MC-W02-I30` |
|   W03 | [P0-03_MC-Test_Woche_03.json](./MC-Test/P0-03_MC-Test_Woche_03.json) | `P0-03-MC-W03-I01` bis `P0-03-MC-W03-I30` |
|   W04 | [P0-03_MC-Test_Woche_04.json](./MC-Test/P0-03_MC-Test_Woche_04.json) | `P0-03-MC-W04-I01` bis `P0-03-MC-W04-I30` |
|   W05 | [P0-03_MC-Test_Woche_05.json](./MC-Test/P0-03_MC-Test_Woche_05.json) | `P0-03-MC-W05-I01` bis `P0-03-MC-W05-I30` |
|   W06 | [P0-03_MC-Test_Woche_06.json](./MC-Test/P0-03_MC-Test_Woche_06.json) | `P0-03-MC-W06-I01` bis `P0-03-MC-W06-I30` |
|   W07 | [P0-03_MC-Test_Woche_07.json](./MC-Test/P0-03_MC-Test_Woche_07.json) | `P0-03-MC-W07-I01` bis `P0-03-MC-W07-I30` |
|   W08 | [P0-03_MC-Test_Woche_08.json](./MC-Test/P0-03_MC-Test_Woche_08.json) | `P0-03-MC-W08-I01` bis `P0-03-MC-W08-I30` |
|   W09 | [P0-03_MC-Test_Woche_09.json](./MC-Test/P0-03_MC-Test_Woche_09.json) | `P0-03-MC-W09-I01` bis `P0-03-MC-W09-I30` |
|   W10 | [P0-03_MC-Test_Woche_10.json](./MC-Test/P0-03_MC-Test_Woche_10.json) | `P0-03-MC-W10-I01` bis `P0-03-MC-W10-I30` |

Die Kennung wird **nicht im JSON gespeichert**. Sie wird aus dem Dateinamen und der einsbasierten Arrayposition abgeleitet: `P0-03_MC-Test_Woche_NN.json` plus Position `p` ergibt `P0-03-MC-WNN-Ipp`. Nach einer Freigabe darf die Arrayreihenfolge deshalb nicht verändert werden. Änderungen werden über `meta.updated`, den Dateihash und das außerhalb des Fragen-JSON geführte Freigabeprotokoll nachvollzogen.

### 2.2 Exakter JSON-Vertrag

Das Wurzelobjekt enthält ausschließlich `meta` und `questions`. `questions` ist ein Array mit genau 30 Objekten.

`meta` enthält genau:

| Feld                        | Verbindliche Regel                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `title`                     | nicht leerer Titel der Wochen-Datei                                                                                           |
| `target_audience`           | exakt `Bachelorstudierende aus BWL, Management, Wirtschaftsinformatik und Informatik ohne vorausgesetzte Statistikkenntnisse` |
| `question_count`            | Ganzzahl `30`, identisch zur Arraylänge                                                                                       |
| `difficulty_profile`        | exakt `{"leicht": 0, "mittel": 12, "schwer": 18}`                                                                             |
| `time_per_weight_minutes`   | exakt `{"1": 0.5, "2": 0.75, "3": 1.0}`                                                                                       |
| `additional_buffer_minutes` | exakt `5`                                                                                                                     |
| `test_duration_minutes`     | exakt `32`; Planwert, im Lernmodus kein Timer                                                                                 |
| `language`                  | exakt `de`                                                                                                                    |
| `updated`                   | Datum der Form `JJJJ-MM-TT`                                                                                                   |

Jedes Fragenobjekt enthält genau:

| Feld              | Verbindliche Regel                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `question`        | eigenständig verständliche Frage                                                         |
| `options`         | genau vier eindeutige, plausible, grammatisch und formal parallele Antworttexte          |
| `answer`          | nullbasierter Ganzzahlindex `0` bis `3` der einen richtigen Option                       |
| `explanation`     | lernförderliche Begründung einschließlich zentraler Fehlerabgrenzung                     |
| `weight`          | Ganzzahl `2` oder `3`; Verteilung je Woche `12/18`                                       |
| `topic`           | redaktionell verständliche Themenbezeichnung                                             |
| `concept`         | zentrales Konzept oder typische Fehlvorstellung                                          |
| `cognitive_level` | nur `Verständnis`, `Anwendung` oder `Analyse`                                            |
| `mini_glossary`   | Objekt mit zwei bis vier Paaren aus nicht leerem Begriff und nicht leerer Kurzdefinition |

Weitere Schlüssel sind weder auf Wurzelebene noch in `meta` oder den Fragenobjekten Teil dieses Paketvertrags. Lernzielzuordnung, Spaced-Repetition-Planung, Quellenbelege, QA-Nachweise, Freigabeversion und redaktionelle Kennung werden außerhalb des kanonischen Fragen-JSON geführt.

### 2.3 Distraktorvertrag

IR und QE prüfen für jedes Item alle vier Optionen gemeinsam:

1. Alle Optionen vollenden den Fragenstamm grammatisch auf dieselbe Weise oder bilden vier eigenständige Sätze derselben Form.
2. Substantivgruppen, Verben, Zahlenwerte oder Aussagesätze werden nicht innerhalb eines Items willkürlich gemischt.
3. Die richtige Lösung ist weder durch auffällige Länge und Präzision noch durch eine abweichende Einschränkung erkennbar. Kürzungen dürfen die fachliche Aussage nicht entstellen.
4. Jeder Distraktor lässt sich einer konkreten Fehlvorstellung, einem realistischen Rechenfehler, einer Nennerverwechslung oder einer unzulässigen Interpretation zuordnen. Offensichtlicher Unsinn sowie Scherz- oder Fangoptionen sind unzulässig.
5. Numerische Optionen verwenden dieselbe Einheit, Rundung und Schreibweise. Verbale Optionen verwenden parallele Zeitform, Person, Numerus und vergleichbare Satzlänge.
6. Wörter wie »immer«, »nie«, »nur« oder »zwingend« sind nur zulässig, wenn die entsprechende Absolutheit selbst fachlicher Gegenstand aller konkurrierenden Aussagen ist.
7. Erklärungen benennen Fehlkonzept oder Rechenweg inhaltlich und verweisen nie auf eine »erste«, »zweite«, »dritte« oder »vierte« Option, weil die Plattform Antwortoptionen umordnen darf.

## 3. Taxonomien

### 3.1 Lernziele

| Code | Primäres beobachtbares Lernziel                                             |
| ---- | --------------------------------------------------------------------------- |
| LI01 | Grundgesamtheit, Stichprobe, Beobachtungseinheit und Merkmal zerlegen       |
| LI02 | Skalenniveau begründen und zulässige Auswertung ableiten                    |
| LI03 | Herkunft, Missingness, Ausreißer, Auswahl- und Messprobleme erkennen        |
| LI04 | explorative Beschreibung und bestätigende Schlussfolgerung unterscheiden    |
| LI05 | absolute/relative Häufigkeiten mit korrektem Nenner berechnen               |
| LI06 | Tabelle, Balken, Histogramm und Boxplot wählen/kritisieren                  |
| LI07 | Lage-, Quantil- und Streuungsmaße wählen, berechnen und interpretieren      |
| LI08 | robuste und ausreißerempfindliche Kennzahlen unterscheiden                  |
| LI09 | Wahrscheinlichkeit mit Tafel, Baum und Rechenregeln bestimmen               |
| LI10 | bedingte und inverse Wahrscheinlichkeit unterscheiden                       |
| LI11 | Binomial- und Normalverteilung erkennen und Ergebnisse lesen                |
| LI12 | Stichprobenvariabilität und Grenzen der Generalisierung erklären            |
| LI13 | Punkt- und Intervallschätzung unterscheiden                                 |
| LI14 | Konfidenzintervall berechnen/lesen und korrekt interpretieren               |
| LI15 | Hypothesen, Alpha, p-Wert und Fehlerarten erklären                          |
| LI16 | einfaches Verfahren wählen und Ergebnis ohne kausale Überdehnung beurteilen |
| LI17 | Streudiagramm und Korrelation einschließlich Grenzen interpretieren         |
| LI18 | einfache lineare Regression als statistisches/ML-Modell erklären            |
| LI19 | Vorhersage, Residuum, Anpassung und Generalisierung unterscheiden           |
| LI20 | Train/Test-Trennung und Overfitting erkennen                                |
| LI21 | Confusion Matrix sowie Accuracy, Precision, Recall und F1 nutzen            |
| LI22 | Modellwahrscheinlichkeit, Häufigkeit und sachliche Wahrheit unterscheiden   |
| LI23 | Ergebnisse adressatengerecht als Statistikbefund kommunizieren              |
| LI24 | Grenzen transparent benennen und Überinterpretation vermeiden               |

Die Lernzielzahlen in den Wochenplänen sind redaktionelle Sollwerte für die Fachprüfung. Sie sind keine Felder oder maschinellen Tags des Fragen-JSON; die Zuordnung wird im Freigabeprotokoll anhand der abgeleiteten Kennung dokumentiert.

### 3.2 Gewicht, Schwierigkeit und kognitive Stufe

| `weight` | Schwierigkeit | Anzahl je Woche | Kennzeichen                                                                       |
| -------: | ------------- | --------------: | --------------------------------------------------------------------------------- |
|        1 | leicht        |               0 | im Paket nicht zulässig                                                           |
|        2 | mittel        |              12 | mindestens zwei verknüpfte Schritte oder Interpretation konkurrierender Aussagen  |
|        3 | schwer        |              18 | Transfer, Datenkritik oder mehrstufige Begründung mit plausiblen Fehlalternativen |

Dieses `0/12/18`-Profil gilt für jede der zehn Dateien und muss mit `meta.difficulty_profile` übereinstimmen. `cognitive_level` beschreibt davon getrennt nur eine der drei Stufen `Verständnis`, `Anwendung` und `Analyse`; weitere Bezeichnungen sind nicht zulässig. Ein höheres Gewicht wird nicht allein durch Umdeklaration erzeugt: Stamm, benötigte Denkoperation, Distraktoren und Erklärung müssen die ausgewiesene Schwierigkeit tragen.

### 3.3 Redaktionelle Spaced-Repetition-Ziele

Die Wochenplanung unterscheidet außerhalb des JSON:

- Schwerpunkt der aktuellen Woche,
- in W01 eine unbenotete Eingangsdiagnose fachstatistischer Voraussetzungen,
- verteilte Wiederholung aus früheren Wochen,
- Diagnose einer dokumentierten Fehlvorstellung,
- Transfer oder klausurnahe integrierte Anwendung.

Diese Ziele steuern Themenwahl, `concept` und Erklärungen redaktionell. Der Blueprint behauptet dafür keine maschinellen Tags oder aus dem JSON berechenbaren Rollensummen. Brüche, Prozentrechnung, Potenzen/Wurzeln, Gleichungen und Taschenrechnerbedienung prüft getrennt die [Mathematikdiagnostik mit Brückenpfaden](./P0-03_Mathematikdiagnostik_Brueckenpfade.md); sie verdrängt kein W01-Statistikitem.

Die zeitliche Abfolge ist verbindlich: Präsenzdurchlauf am Ende der Themenwoche, korrigierender Durchlauf nach zwei bis drei Tagen und erneute Einbettung ausgewählter Kernkonzepte nach zwei bis vier Wochen. Damit bezeichnet Spaced Repetition nicht bloß eine gemischte Fragensammlung, sondern die geplanten Abstände zwischen den Abrufen.

### 3.4 Redaktionelle Fachprüfung

Alle Items erhalten eine redaktionelle Standardprüfung durch IR. Fehlvorstellungen und interpretationskritische Items werden zusätzlich durch QE fachlich-didaktisch gegengelesen; Rechen-, Daten- und JASP-Items werden durch DJ unabhängig einschließlich Einheit und Rundung reproduziert. Die [isomorphe Transfermatrix](./P0-03_Transfermatrix_BWL_WI.md) wird dabei je Modulziel auf gleiche Zahlen, Kernhandlung, Schwierigkeit und Erwartungshorizont geprüft. Diese Prüfnachweise stehen im Freigabeprotokoll, nicht im Fragen-JSON.

## 4. Verbindliche Wochenverteilungen

Die Häufigkeiten für `topic`, `cognitive_level` und `weight` sind direkt aus den zehn kanonischen JSON-Dateien gezählt. LI-Schwerpunkte sowie Schwerpunkt- und Spaced-Repetition-Beschreibungen sind redaktionelle curriculare Einordnungen ohne erfundene Itemzahlen; sie sind keine maschinellen Spaced-Repetition- oder QA-Tags.

### W01 – Statistisches Denken, Daten und Messung

**Datei:** [P0-03_MC-Test_Woche_01.json](./MC-Test/P0-03_MC-Test_Woche_01.json)

- **`topic`-Häufigkeiten (Σ=30):** `Statistikprozess`=5; `Grundgesamtheit und Stichprobe`=6; `Beobachtungseinheit und Merkmale`=5; `Skalenniveaus und Merkmalsarten`=7; `Datenqualität und Aussagegrenzen`=7.
- **`cognitive_level`-Häufigkeiten (Σ=30):** `Verständnis`=2; `Anwendung`=9; `Analyse`=19.
- **`weight`-Profil (Σ=30):** `1`/leicht=0; `2`/mittel=12; `3`/schwer=18.
- **LI-Schwerpunkte:** LI01, LI02, LI03 und LI04.
- **Curricularer Schwerpunkt und Spaced Repetition:** Der Einstieg verbindet Statistikprozess, Bezugsgruppen, Beobachtungseinheiten, Merkmalsarten und Datenqualität. Als Eingangsdiagnose werden begriffliche Abgrenzungen, korrekte Nenner sowie Grenzen deskriptiver und kausaler Aussagen abgerufen.
- **Abgrenzung:** W01 diagnostiziert fachstatistische Begriffe. Mathematische Arbeitsvoraussetzungen werden vor UE 1 mit dem eigenständigen Diagnosebogen geprüft.

### W02 – Häufigkeiten, Diagramme und Lage

**Datei:** [P0-03_MC-Test_Woche_02.json](./MC-Test/P0-03_MC-Test_Woche_02.json)

- **`topic`-Häufigkeiten (Σ=30):** `Häufigkeiten und Nenner`=6; `Diagramme und Manipulation`=5; `Lagewerte und Robustheit`=8; `Kumulative Wiederholung Woche 1`=11.
- **`cognitive_level`-Häufigkeiten (Σ=30):** `Verständnis`=1; `Anwendung`=9; `Analyse`=20.
- **`weight`-Profil (Σ=30):** `1`/leicht=0; `2`/mittel=12; `3`/schwer=18.
- **LI-Schwerpunkte:** LI05, LI06, LI07 und LI08; im kumulativen Abruf zusätzlich LI01, LI02 und LI03.
- **Curricularer Schwerpunkt und Spaced Repetition:** Häufigkeiten mit transparentem Nenner, sachgerechte Diagramme sowie Lage und Robustheit bilden den neuen Kern. Der umfangreiche Abruf aus W01 greift Grundgesamtheit, Stichprobe, Beobachtungseinheit, Skalenniveau, Missingness, Nonresponse und Selbstselektion wieder auf.

### W03 – Streuung, Quantile und Ausreißer

**Datei:** [P0-03_MC-Test_Woche_03.json](./MC-Test/P0-03_MC-Test_Woche_03.json)

- **`topic`-Häufigkeiten (Σ=30):** `Spannweite und Streuung`=5; `Varianz und Standardabweichung`=8; `Quartile und IQR`=5; `Boxplot und Ausreißer`=5; `Median, p95 und p99`=4; `Kumulative Wiederholung: Datenstruktur`=1; `Kumulative Wiederholung: Häufigkeiten`=1; `Kumulative Wiederholung: Lage und Datenkritik`=1.
- **`cognitive_level`-Häufigkeiten (Σ=30):** `Verständnis`=4; `Anwendung`=8; `Analyse`=18.
- **`weight`-Profil (Σ=30):** `1`/leicht=0; `2`/mittel=12; `3`/schwer=18.
- **LI-Schwerpunkte:** LI06, LI07 und LI08; ergänzend LI03 und LI24.
- **Curricularer Schwerpunkt und Spaced Repetition:** Der Schwerpunkt liegt auf Streuungsmaßen, Varianzkonventionen, Quartilen, Boxplots, Ausreißerbehandlung und hohen Quantilen. Der kumulative Abruf verknüpft dies mit Beobachtungseinheiten, relativen Häufigkeiten sowie Lage und Datenkritik.

### W04 – Wahrscheinlichkeit und bedingte Wahrscheinlichkeit

**Datei:** [P0-03_MC-Test_Woche_04.json](./MC-Test/P0-03_MC-Test_Woche_04.json)

- **`topic`-Häufigkeiten (Σ=30):** `Ereignisse und Gegenereignisse`=4; `Baumdiagramm und Multiplikation`=5; `Kontingenztafel und Bedingungen`=6; `Inverse Bedingungen und Bayes-Idee`=5; `Kumulative Wiederholung: Datenstruktur`=1; `Kumulative Wiederholung: Skalenniveau`=1; `Kumulative Wiederholung: Häufigkeiten`=1; `Kumulative Wiederholung: Lage`=2; `Kumulative Wiederholung: Streuung`=3; `Kumulative Wiederholung: Quartile und Ausreißer`=1; `Kumulative Wiederholung: Transfer und Datenkritik`=1.
- **`cognitive_level`-Häufigkeiten (Σ=30):** `Verständnis`=3; `Anwendung`=8; `Analyse`=19.
- **`weight`-Profil (Σ=30):** `1`/leicht=0; `2`/mittel=12; `3`/schwer=18.
- **LI-Schwerpunkte:** LI09 und LI10; im Abruf insbesondere LI01, LI02, LI05, LI07, LI08 und LI24.
- **Curricularer Schwerpunkt und Spaced Repetition:** Ereignisse, Baumdiagramme, Kontingenztafeln, inverse Bedingungen, Basisraten und Fehlkosten werden systematisch verbunden. Der kumulative Abruf aktiviert Datenstruktur, Skalenniveau, Häufigkeiten, Lage, Streuung, Quartile und kritische Transfergrenzen aus W01–W03.

### W05 – Zufallsvariablen, Verteilungen und Stichprobenvariabilität

**Datei:** [P0-03_MC-Test_Woche_05.json](./MC-Test/P0-03_MC-Test_Woche_05.json)

- **`topic`-Häufigkeiten (Σ=30):** `Zufallsvariablen und Verteilungen`=3; `Binomialverteilung`=5; `Normalverteilung und Standardisierung`=4; `Stichprobenvariabilität`=8; `Kumulative Datenkompetenz`=2; `Kumulative Deskription`=4; `Kumulative Wahrscheinlichkeit`=4.
- **`cognitive_level`-Häufigkeiten (Σ=30):** `Verständnis`=2; `Anwendung`=8; `Analyse`=20.
- **`weight`-Profil (Σ=30):** `1`/leicht=0; `2`/mittel=12; `3`/schwer=18.
- **LI-Schwerpunkte:** LI11 und LI12; im kumulativen Abruf LI03, LI05 bis LI10 und LI24.
- **Curricularer Schwerpunkt und Spaced Repetition:** Zufallsvariablen, Binomial- und Normalverteilung sowie Stichprobenvariabilität und Standardfehleridee bilden den Kern. Kumulativ werden Datenkompetenz, Deskription, bedingte Wahrscheinlichkeit, Gegenereignis und Basisrate erneut abgerufen.

### W06 – Schätzen und Konfidenzintervalle

**Datei:** [P0-03_MC-Test_Woche_06.json](./MC-Test/P0-03_MC-Test_Woche_06.json)

- **`topic`-Häufigkeiten (Σ=30):** `Punkt- und Intervallschätzung`=3; `Standardfehler`=7; `Konfidenzintervalle`=1; `Präzision und Generalisierung`=3; `Anteilsintervalle`=6; `Mittelwertintervalle`=2; `Kumulative Stichprobenvariabilität`=2; `Kumulative Verteilungen`=3; `Kumulative Wahrscheinlichkeit`=2; `Kumulative Deskription`=1.
- **`cognitive_level`-Häufigkeiten (Σ=30):** `Verständnis`=2; `Anwendung`=7; `Analyse`=21.
- **`weight`-Profil (Σ=30):** `1`/leicht=0; `2`/mittel=12; `3`/schwer=18.
- **LI-Schwerpunkte:** LI12, LI13, LI14 und LI24; im Abruf zusätzlich LI03 und LI07 bis LI11.
- **Curricularer Schwerpunkt und Spaced Repetition:** Punkt- und Intervallschätzung, Standardfehler, frequentistische Intervallinterpretation sowie Wald-, Wilson- und t-Intervalle werden mit Präzision und Generalisierbarkeit verknüpft. Der Abruf führt Stichprobenvariabilität, Verteilungen, Wahrscheinlichkeit und robuste Deskription fort.

### W07 – Hypothesentests und Vorher-Nachher-Vergleiche

**Datei:** [P0-03_MC-Test_Woche_07.json](./MC-Test/P0-03_MC-Test_Woche_07.json)

- **`topic`-Häufigkeiten (Σ=30):** `Testlogik`=5; `p-Wert und Signifikanz`=6; `Fehlerarten und Relevanz`=5; `Gepaarter t-Test`=7; `Datenqualität und Aussagegrenzen`=4; `Kumulative Wiederholung`=3.
- **`cognitive_level`-Häufigkeiten (Σ=30):** `Verständnis`=4; `Anwendung`=9; `Analyse`=17.
- **`weight`-Profil (Σ=30):** `1`/leicht=0; `2`/mittel=12; `3`/schwer=18.
- **LI-Schwerpunkte:** LI14, LI15 und LI16; ergänzend LI03, LI04 und LI24.
- **Curricularer Schwerpunkt und Spaced Repetition:** Testlogik, p-Wert, Signifikanz, Fehlerarten, praktische Relevanz und der gepaarte t-Test werden mit Datenqualität und Aussagegrenzen verbunden. Der kumulative Abruf kontrastiert Konfidenzintervall und Test, festigt bedingte Nenner und übt die Verfahrenswahl.

### W08 – Korrelation und lineare Regression

**Datei:** [P0-03_MC-Test_Woche_08.json](./MC-Test/P0-03_MC-Test_Woche_08.json)

- **`topic`-Häufigkeiten (Σ=30):** `Streudiagramm`=5; `Pearson-Korrelation`=5; `Grenzen und Einflussfaktoren`=4; `Lineare Regression`=7; `Residuen und Modellgüte`=5; `Kumulative Wiederholung`=4.
- **`cognitive_level`-Häufigkeiten (Σ=30):** `Verständnis`=4; `Anwendung`=9; `Analyse`=17.
- **`weight`-Profil (Σ=30):** `1`/leicht=0; `2`/mittel=12; `3`/schwer=18.
- **LI-Schwerpunkte:** LI17, LI18 und LI19; ergänzend LI16 und LI24.
- **Curricularer Schwerpunkt und Spaced Repetition:** Streudiagramm, Pearson-Korrelation, Einflussfaktoren, lineare Regression, Residuen und Modellgüte bilden eine zusammenhängende Modellierungssequenz. Der Abruf nimmt p-Wert, Standardfehler, die Abgrenzung zum gepaarten Vergleich und einen begrenzten Managementtransfer wieder auf.

### W09 – Train/Test, Overfitting und Klassifikationsmetriken

**Datei:** [P0-03_MC-Test_Woche_09.json](./MC-Test/P0-03_MC-Test_Woche_09.json)

- **`topic`-Häufigkeiten (Σ=30):** `Train/Test und Generalisierung`=5; `Overfitting und Domain Shift`=4; `Confusion Matrix`=7; `Klassifikationsmetriken`=6; `Fehlkosten und Klassenverteilung`=3; `F1 und Nullnenner`=3; `Kumulative Regression und Inferenz`=2.
- **`cognitive_level`-Häufigkeiten (Σ=30):** `Verständnis`=1; `Anwendung`=11; `Analyse`=18.
- **`weight`-Profil (Σ=30):** `1`/leicht=0; `2`/mittel=12; `3`/schwer=18.
- **LI-Schwerpunkte:** LI20, LI21 und LI22; ergänzend LI19 und LI24.
- **Curricularer Schwerpunkt und Spaced Repetition:** Train/Test-Trennung, Generalisierung, Overfitting, Domain Shift, Confusion Matrix, Kernmetriken, Fehlkosten, Klassenverteilung und Nullnenner stehen im Zentrum. Der kumulative Abruf verbindet Residuen und Testentscheidungen mit begrenzten Modellvergleichen.
- **Curricularer Status:** I05 prüft den quellenkritischen Transfer zwischen einem festen REPO-Evaluationsstand und synthetischen Resamples. I27 operationalisiert LI22 durch die Trennung von Modellausgabe, empirischer Gruppenhäufigkeit und beobachtetem Einzelfalllabel. Beide Items gehören zum ausgewiesenen Pflichtkern.

### W10 – Integration, Kommunikation und Klausurtraining

**Datei:** [P0-03_MC-Test_Woche_10.json](./MC-Test/P0-03_MC-Test_Woche_10.json)

- **`topic`-Häufigkeiten (Σ=30):** `Datenqualität und Deskription`=4; `Wahrscheinlichkeit und Sampling`=4; `Inferenz und Verfahrenswahl`=6; `Korrelation und Regression`=5; `Binäre Modellbewertung`=5; `Statistikprozess und Kommunikation`=6.
- **`cognitive_level`-Häufigkeiten (Σ=30):** `Verständnis`=2; `Anwendung`=9; `Analyse`=19.
- **`weight`-Profil (Σ=30):** `1`/leicht=0; `2`/mittel=12; `3`/schwer=18.
- **LI-Schwerpunkte:** LI23 und LI24; vernetzend insbesondere LI02, LI03, LI06, LI07, LI10, LI11, LI14, LI15, LI17, LI18, LI20 und LI21.
- **Curricularer Schwerpunkt und Spaced Repetition:** Die Abschlusswoche integriert Datenqualität und Deskription, Wahrscheinlichkeit und Sampling, Inferenz, Regression, binäre Modellbewertung sowie Statistikprozess und adressatengerechte Kommunikation. Der Abruf verbindet die zentralen Nenner-, Intervall-, p-Wert-, Kausalitäts-, Extrapolations- und Aussagegrenzen der Vorwochen.

## 5. Erklärungs- und Mini-Glossarvertrag

`explanation` ist ein zusammenhängender, lernfreundlicher Text und deckt in knapper Form ab:

1. **Lösung:** Warum ist die gewählte Option richtig?
2. **Fehlerdiagnose:** Warum ist der plausibelste Distraktor falsch?
3. **Werkzeugbezug:** Welche Formel, JASP-Ausgabe oder Datenregel ist einschlägig?
4. **Grenze/Transfer:** Welche stärkere Aussage wäre nicht erlaubt oder wie wird das Prinzip übertragen?

`mini_glossary` ist ein Objekt mit zwei bis vier Begriff-Definitions-Paaren. Eine Kurzdefinition umfasst höchstens drei Sätze, nutzt die Fachsprache des Hauptkonzepts und nennt bei verwechslungsanfälligen Begriffen eine Abgrenzung. Wiederkehrende Begriffe werden in gleicher fachlicher Bedeutung verwendet; kontextspezifische Zusätze sind zulässig, fachlich widersprüchliche Definitionen blockieren die Veröffentlichung.

## 6. Lernanalytikvertrag

### 6.1 Zulässige Aggregate

Pro abgeleiteter redaktioneller Kennung und vereinbartem Auswertungsfenster dürfen aggregiert erfasst werden:

- Zahl begonnener, abgeschlossener und beantworteter Lernsessions,
- Anzahl und Anteil richtiger Antworten,
- Options-/Distraktorhäufigkeiten,
- Auslassungen,
- `topic`, `concept`, `weight` und `cognitive_level` aus dem Fragen-JSON,
- redaktionelle Lernziel- und Spaced-Repetition-Zuordnungen aus dem getrennten Freigabeprotokoll.

Nicht in die Wochenvorlage übernommen werden Pseudonyme, Namen, E-Mail-Adressen, Freitexte, Gerätekennungen, Authentifizierungstokens, individuelle Verläufe oder Rangfolgen. Weder ARSnova- noch MC-Test- noch andere LIVE-Daten sind Grundlage individueller Leistungsbewertung. Davon unberührt bleibt eine separate Klausur, die ausschließlich freigegebene LEHRDATEN nutzt.

### 6.2 Lehrentscheidungen

- Unter etwa 67 % aggregierter korrekter Antworten im festgelegten Auswertungsfenster: Konzept mit neuem Beispiel erneut abrufen.
- Häufig gewählter gemeinsamer Distraktor: Fehlvorstellung explizit kontrastieren.
- Hohe Auslassung: Verständlichkeit, Barriere oder Arbeitslast prüfen, nicht automatisch mangelnde Kompetenz unterstellen.
- Schwierigkeit wird nach einem Lehrdurchlauf nur anhand von Itemfunktion, fachlicher Anforderung und Rückmeldung rekalibriert; sie ist kein Studierendenlabel.

## 7. Wöchentliche Freigabeprüfung

Eine Wochen-Datei wird nur freigegeben, wenn:

1. das Wurzelobjekt ausschließlich `meta` und `questions` enthält;
2. `meta` und jedes Fragenobjekt exakt die Feldmengen aus Abschnitt 2.2 enthalten;
3. `meta.question_count` und die Arraylänge jeweils 30 betragen;
4. `weight` je Datei exakt `0/12/18` verteilt ist und `meta.difficulty_profile` dasselbe Profil ausweist;
5. alle kognitiven Werte zur Dreier-Allowlist gehören;
6. jede Frage genau vier eindeutige, plausible und formal parallele Optionen, einen gültigen nullbasierten Lösungsindex, eine positionsunabhängige Erklärung und zwei bis vier Glossareinträge besitzt;
7. jede Lösungsposition je Wochen-Datei sieben- oder achtmal vorkommt, keine periodische Folge erkennbar ist und höchstens drei aufeinanderfolgende Items dieselbe Lösungsposition besitzen;
8. die aus Dateiname und Arrayposition abgeleiteten Kennungen I01 bis I30 lückenlos und paketweit eindeutig sind;
9. IR und QE die redaktionellen Themen-, Lernziel- und Spaced-Repetition-Ziele gegen Inhalt und Erklärung geprüft haben;
10. DJ alle betroffenen Rechen-, Daten- und JASP-Ergebnisse unabhängig reproduziert hat;
11. ein Testimport im Lernmodus `practice` Sofortfeedback ohne Timer zeigt und bei `show_top5_public=false` keine öffentliche Top-5 ausgibt;
12. die 32 Minuten ausschließlich als Planwert erscheinen und keine Versuchsbegrenzung behauptet oder technisch vorausgesetzt wird;
13. der Löschhandoff nach dem [Lehrenden-Runbook](./P0-03_Lehrenden_Runbook.md) terminiert und einer verantwortlichen Rolle zugewiesen ist;
14. `target_audience` in allen zehn Dateien exakt dem Vertrag entspricht;
15. die untimierte Alternativfassung stichprobenweise auf identische Frage, Optionen, Lösung, Erklärung und Glossar geprüft wurde.

Zuerst muss der [Validator des fixierten MC-Test-Commits](https://github.com/kqc-real/streamlit/blob/b6b159555e8a228dad73dd75fd66c154a1088e28/validate_sets.py) für jede Datei mit Exit-Code 0 enden; jede Warnung wird von IR geprüft und mit Entscheidung im externen Freigabeprotokoll festgehalten. Da dieser Validator die paketweit engere Allowlist nicht vollständig durchsetzt, ist zusätzlich vom Repository-Wurzelverzeichnis aus dieser reproduzierbare Gate-Check auszuführen:

```bash
python - <<'PY'
from collections import Counter
from datetime import date
from itertools import groupby
from pathlib import Path
import json
import re

root = Path("docs/didaktik/Modulkonzept Statistik")
files = sorted((root / "MC-Test").glob("P0-03_MC-Test_Woche_*.json"))
meta_keys = {
    "title", "target_audience", "question_count", "difficulty_profile",
    "time_per_weight_minutes", "additional_buffer_minutes",
    "test_duration_minutes", "language", "updated",
}
question_keys = {
    "question", "options", "answer", "explanation", "weight",
    "topic", "concept", "cognitive_level", "mini_glossary",
}
cognitive_values = {"Verständnis", "Anwendung", "Analyse"}
expected_profile = {"leicht": 0, "mittel": 12, "schwer": 18}
expected_times = {"1": 0.5, "2": 0.75, "3": 1.0}
expected_target_audience = (
    "Bachelorstudierende aus BWL, Management, Wirtschaftsinformatik "
    "und Informatik ohne vorausgesetzte Statistikkenntnisse"
)
positional_reference = re.compile(r"\b(?:erst|zweit|dritt|viert)\w*\s+Option\b", re.IGNORECASE)
seen_questions = set()

assert len(files) == 10
for path in files:
    data = json.loads(path.read_text(encoding="utf-8"))
    assert set(data) == {"meta", "questions"}, path
    meta, questions = data["meta"], data["questions"]
    assert set(meta) == meta_keys, path
    assert isinstance(meta["title"], str) and meta["title"].strip(), path
    assert meta["target_audience"] == expected_target_audience, path
    assert meta["question_count"] == len(questions) == 30, path
    assert meta["difficulty_profile"] == expected_profile, path
    assert meta["time_per_weight_minutes"] == expected_times, path
    assert meta["additional_buffer_minutes"] == 5, path
    assert meta["test_duration_minutes"] == 32, path
    assert meta["language"] == "de", path
    date.fromisoformat(meta["updated"])
    assert Counter(q["weight"] for q in questions) == {2: 12, 3: 18}, path
    answer_positions = Counter(q["answer"] for q in questions)
    assert sorted(answer_positions.values()) == [7, 7, 8, 8], (path, answer_positions)
    answer_sequence = [q["answer"] for q in questions]
    assert not any(
        all(answer_sequence[i] == answer_sequence[i % period] for i in range(len(answer_sequence)))
        for period in range(1, 7)
    ), path
    assert max(
        len(list(run))
        for _, run in groupby(answer_sequence)
    ) <= 3, path
    for position, item in enumerate(questions, start=1):
        assert set(item) == question_keys, (path, position)
        assert all(
            isinstance(item[key], str) and item[key].strip()
            for key in ("question", "explanation", "topic", "concept")
        ), (path, position)
        assert isinstance(item["options"], list) and len(item["options"]) == 4, (path, position)
        assert all(isinstance(option, str) and option.strip() for option in item["options"])
        assert len({option.strip() for option in item["options"]}) == 4
        assert type(item["answer"]) is int and 0 <= item["answer"] < 4
        assert type(item["weight"]) is int and item["weight"] in {2, 3}
        assert item["cognitive_level"] in cognitive_values, (path, position)
        assert item["question"].startswith(f"{position}. "), (path, position)
        normalized_question = item["question"].split(". ", 1)[1].strip()
        assert normalized_question not in seen_questions, (path, position)
        seen_questions.add(normalized_question)
        assert not positional_reference.search(item["explanation"]), (path, position)
        glossary = item["mini_glossary"]
        assert isinstance(glossary, dict) and 2 <= len(glossary) <= 4
        assert all(
            isinstance(term, str) and term.strip()
            and isinstance(definition, str) and definition.strip()
            for term, definition in glossary.items()
        )
assert len(seen_questions) == 300
print("OK: 10 Dateien, 300 eindeutige Fragen, exaktes Schema, 0/12/18-Profil und balancierte Lösungspositionen")
PY
```

Erst nach dieser Prüfung darf LD die Datei im [Lehrenden-Runbook](./P0-03_Lehrenden_Runbook.md) festgelegten Zeitfenster veröffentlichen.
