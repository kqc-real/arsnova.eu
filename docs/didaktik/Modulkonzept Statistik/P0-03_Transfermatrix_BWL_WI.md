# P0-03 – Isomorphe Transfermatrix BWL/Management und WI/Informatik

**Kürzel vorab:** **BWL/WI** steht für Betriebswirtschaftslehre/Wirtschaftsinformatik, **MZ1–MZ7** für die Modulziele, **W01–W10** für die Kurswochen, **MC** für Multiple Choice, **LIVE/LEHRDATEN** für Kursdaten beziehungsweise synthetische Übungsdaten sowie **IR/QE** für Item-Redaktion und Qualitäts-/Evaluationsverantwortung.

**Version:** 1.0.1 · **Stand:** 13.09.2026<br>
**Status:** verbindliche Parallelaufgabenbank für den Pflichtkern

**Bezugsdokumente:** [Kerncurriculum](./P0-01_Kerncurriculum_Lernzielmatrix.md) · [Hauptkonzept](./Modulkonzept_48UE_BWL_Management_WI_Informatik.md) · [Formelsammlung](./P0-03_Formelsammlung_Statistik.md)

## 1. Zweck und Konstruktionsregel

Die sieben Aufgabenpaare sichern gleichwertigen Transfer für BWL/Management sowie Wirtschaftsinformatik/Informatik. Je Paar bleiben gleich:

- Zahlen und Datenstruktur,
- Beobachtungseinheit und Skalenniveau,
- statistische Kernhandlung,
- erforderlicher Rechenweg,
- Schwierigkeit und Punktzahl,
- zulässige Interpretation und Aussagegrenze.

Nur Gegenstand, Variablennamen und sachliche Einheit wechseln. Domänenwissen wird vollständig im Aufgabenstamm bereitgestellt und nicht bewertet.

Die Varianten erhalten stabile Kennungen `P0-03-TR-MZ1-BWL` bis `P0-03-TR-MZ7-WI`. Sie sind **LEHRDATEN-Aufgaben**, keine LIVE- oder Produktionsbefunde. Die Aufgabenbank erweitert weder die 300 MC-Test-Items noch die 100 ARSnova-Livefragen. Soll eine Variante eine kanonische JSON-Frage ersetzen, gelten weiterhin Anzahl, Schema, Blueprint, Typabdeckung und vollständige Neuvalidierung.

## 2. Einsatzmatrix

| Paar | Kernhandlung                                      | BWL-/Management-Kontext | WI-/Informatik-Kontext | Primärwoche | Zwei Evidenzkanäle                              |
| ---- | ------------------------------------------------- | ----------------------- | ---------------------- | ----------- | ----------------------------------------------- |
| MZ1  | Datenstruktur und Aussagegrenze bestimmen         | Servicebefragung        | App-Nutzungsbefragung  | W01         | Kurzblatt/Live-Diskussion und MC-W01            |
| MZ2  | Lage, Streuung und Diagramm begründen             | Bearbeitungszeiten      | Antwortlatenzen        | W02–W03     | Handrechnung und JASP-/Klausurtransfer          |
| MZ3  | Bedingungen und Bezugsgruppen berechnen           | Reklamationsprüfung     | Alarmprüfung           | W04–W05     | Kontingenztafel und MC-/Live-Transfer           |
| MZ4  | Intervall oder gepaarten Test auswählen           | Filialprozess           | Release-Test           | W06–W07     | Entscheidungsbaum und Probeklausur/JASP         |
| MZ5  | Regression, Residuum und Extrapolation beurteilen | Nachfrage/Prozessdauer  | Last/Latenz            | W08         | Handrechnung und JASP-/MC-Transfer              |
| MZ6  | Binäre Matrix und Zielmetrik auswerten            | Forderungsprüfung       | Q&A-Triage             | W09         | Rechenblatt und MC-/Klausurtransfer             |
| MZ7  | Befund mit Handlung und Grenze formulieren        | Managemententscheidung  | Betriebsentscheidung   | W10         | Peer Review und individuelle Klausurkurzantwort |

Für jeden Modulblock verwendet LD zunächst eine Variante als Worked Example und die andere als Transfercheck. Die Reihenfolge BWL/WI wechselt über die Wochen. Unterschiede zwischen den Lösungsquoten dürfen wegen wechselnder Kontexte, Gruppen und Bearbeitungsbedingungen nicht als Domäneneffekt interpretiert werden.

## 3. Aufgabenpaare mit Erwartungshorizont

### MZ1 / LI01–LI04 – Daten strukturieren und beurteilen

#### `P0-03-TR-MZ1-BWL`

Von 60 anwesenden Beschäftigten beantworten 42 freiwillig eine Frage zu einem neuen Serviceprozess; 30 der Antwortenden wählen »hilfreich«. Die gesamte Belegschaft umfasst 240 Personen.

1. Nennen Sie Beobachtungseinheit, ausgewertete Stichprobe und Zielpopulation.
2. Berechnen Sie Antwortquote unter den Anwesenden und Zustimmungsanteil unter den Antwortenden.
3. Nennen Sie zwei Gründe, warum 30 von 42 nicht auf die gesamte Belegschaft verallgemeinert werden dürfen.

#### `P0-03-TR-MZ1-WI`

Von 60 anwesenden App-Nutzenden beantworten 42 freiwillig eine Frage zu einer neuen Suchfunktion; 30 der Antwortenden wählen »hilfreich«. Die gesamte registrierte Nutzungsgruppe umfasst 240 Personen.

1. Nennen Sie Beobachtungseinheit, ausgewertete Stichprobe und Zielpopulation.
2. Berechnen Sie Antwortquote unter den Anwesenden und Zustimmungsanteil unter den Antwortenden.
3. Nennen Sie zwei Gründe, warum 30 von 42 nicht auf die gesamte registrierte Nutzungsgruppe verallgemeinert werden dürfen.

**Gemeinsamer Erwartungshorizont – 5 Punkte:** Beobachtungseinheit = eine gültige Antwort; Stichprobe \(n=42\); Zielpopulation \(N=240\); Antwortquote \(42/60=70\,\%\); Zustimmung \(30/42\approx71{,}4\,\%\); zwei Grenzen aus Freiwilligkeit/Selbstselektion, Nonresponse, Anwesenheitsauswahl oder unklarer Repräsentativität.

### MZ2 / LI05–LI08 – Daten beschreiben und visualisieren

#### `P0-03-TR-MZ2-BWL`

Fünf Bearbeitungszeiten eines Servicevorgangs lauten \(100,110,120,130,140\) Sekunden.

1. Berechnen Sie Mittelwert und Median.
2. Berechnen Sie die Stichprobenstandardabweichung mit Division durch \(n-1\).
3. Wählen Sie eine geeignete Darstellung für die fünf metrischen Werte und nennen Sie eine Grenze der kleinen Stichprobe.

#### `P0-03-TR-MZ2-WI`

Fünf Antwortlatenzen eines digitalen Dienstes lauten \(100,110,120,130,140\) Millisekunden.

1. Berechnen Sie Mittelwert und Median.
2. Berechnen Sie die Stichprobenstandardabweichung mit Division durch \(n-1\).
3. Wählen Sie eine geeignete Darstellung für die fünf metrischen Werte und nennen Sie eine Grenze der kleinen Stichprobe.

**Gemeinsamer Erwartungshorizont – 5 Punkte:** Mittelwert und Median \(=120\) in der jeweiligen Einheit; \(s=\sqrt{1000/4}\approx15{,}81\); Punktdiagramm oder Boxplot mit Begründung; keine Generalisierung oder Verteilungsbehauptung aus fünf konstruierten Werten.

### MZ3 / LI09–LI12 – Wahrscheinlichkeit und Stichprobenunsicherheit

#### `P0-03-TR-MZ3-BWL`

In 100 geprüften Reklamationen lag tatsächlich ein Qualitätsproblem vor oder nicht. Ein Prüfhinweis wurde ausgelöst oder nicht:

| tatsächlicher Zustand | Hinweis | kein Hinweis | Summe |
| --------------------- | ------: | -----------: | ----: |
| Qualitätsproblem      |      16 |            4 |    20 |
| kein Qualitätsproblem |       8 |           72 |    80 |

Berechnen und interpretieren Sie \(P(\text{Problem}\mid\text{Hinweis})\) sowie \(P(\text{Hinweis}\mid\text{Problem})\). Begründen Sie, warum beide Werte nicht vertauscht werden dürfen.

#### `P0-03-TR-MZ3-WI`

In 100 geprüften Systemereignissen lag tatsächlich ein technischer Fehler vor oder nicht. Ein Alarm wurde ausgelöst oder nicht:

| tatsächlicher Zustand   | Alarm | kein Alarm | Summe |
| ----------------------- | ----: | ---------: | ----: |
| technischer Fehler      |    16 |          4 |    20 |
| kein technischer Fehler |     8 |         72 |    80 |

Berechnen und interpretieren Sie \(P(\text{Fehler}\mid\text{Alarm})\) sowie \(P(\text{Alarm}\mid\text{Fehler})\). Begründen Sie, warum beide Werte nicht vertauscht werden dürfen.

**Gemeinsamer Erwartungshorizont – 4 Punkte:** \(16/24\approx0{,}667\) für den Anteil tatsächlicher positiver Fälle unter den markierten Fällen; \(16/20=0{,}800\) für den Anteil markierter Fälle unter den tatsächlich positiven Fällen; verschiedene Bedingungen und Nenner.

### MZ4 / LI13–LI16 – Schätzen und testen

#### `P0-03-TR-MZ4-BWL`

Fall A: In einer unabhängigen Stichprobe erfüllen 37 von 52 Servicefällen ein Qualitätskriterium. Gesucht ist ein Bereich plausibler Werte für den unbekannten Populationsanteil.  
Fall B: Dieselben zehn Filialen liefern vor und nach einer Prozessänderung je einen metrischen Zeitwert. Gesucht ist Evidenz für eine mittlere Veränderung.

Ordnen Sie jedem Fall das Pflichtkernverfahren zu und nennen Sie die zentrale Auswertungsgröße.

#### `P0-03-TR-MZ4-WI`

Fall A: In einer unabhängigen Stichprobe bestehen 37 von 52 Systemläufen ein Prüfkriterium. Gesucht ist ein Bereich plausibler Werte für den unbekannten Populationsanteil.  
Fall B: Dieselben zehn Testumgebungen liefern vor und nach einem Release je einen metrischen Latenzwert. Gesucht ist Evidenz für eine mittlere Veränderung.

Ordnen Sie jedem Fall das Pflichtkernverfahren zu und nennen Sie die zentrale Auswertungsgröße.

**Gemeinsamer Erwartungshorizont – 4 Punkte:** Fall A → Anteils-Konfidenzintervall mit \(\hat p=37/52\); im Pflichtkern kein Anteils-Hypothesentest. Fall B → gepaarter t-Test der vollständig zugeordneten Differenzen mit \(n_{\text{Paare}}=10\). Ein unabhängiger Mittelwertvergleich oder Ein-Stichproben-Test gehört nicht zum Pflichtkern.

### MZ5 / LI17–LI20 – Zusammenhang und Vorhersage

#### `P0-03-TR-MZ5-BWL`

Ein synthetisches Modell beschreibt im beobachteten Bereich von 100 bis 500 Aufträgen den Zusammenhang zwischen Auftragszahl \(x\) und mittlerer Prozessdauer \(y\) in Minuten:

\[
\hat y=40+0{,}18x.
\]

Bei \(x=300\) wurden \(y=100\) Minuten beobachtet. Interpretieren Sie die Steigung, berechnen Sie Vorhersage und Residuum und beurteilen Sie eine Vorhersage für \(x=900\).

#### `P0-03-TR-MZ5-WI`

Ein synthetisches Modell beschreibt im beobachteten Bereich von 100 bis 500 gleichzeitigen Nutzungen den Zusammenhang zwischen Last \(x\) und Medianlatenz \(y\) in Millisekunden:

\[
\hat y=40+0{,}18x.
\]

Bei \(x=300\) wurden \(y=100\) Millisekunden beobachtet. Interpretieren Sie die Steigung, berechnen Sie Vorhersage und Residuum und beurteilen Sie eine Vorhersage für \(x=900\).

**Gemeinsamer Erwartungshorizont – 5 Punkte:** Je zusätzliche x-Einheit steigt die modellierte Zielgröße um \(0{,}18\) y-Einheiten; \(\hat y=94\); \(e=y-\hat y=+6\); \(x=900\) ist Extrapolation und keine sichere Betriebs- oder Managementprognose.

**Quellenabgrenzung:** Dieses Paar verwendet den eigenständigen klausurnahen Lehrfall `P0-03-PROBEKLAUSUR-A5-REGRESSION-V1` mit zwölf konstruierten Läufen. Das verbindliche W08-JASP-Labor verwendet dagegen die 16 Zeilen aus `P0-03-S5-LAST-LATENZ-V1` mit eigenen Regressionswerten. Die Datensätze werden nicht zusammengeführt oder zahlenmäßig gleichgesetzt.

### MZ6 / LI21–LI22 – Binäre Klassifikation

#### `P0-03-TR-MZ6-BWL`

Ein synthetisches Modell markiert Forderungsfälle für eine manuelle Prüfung. »kritisch« ist positiv:

| tatsächliche Klasse | vorhergesagt kritisch | vorhergesagt nicht kritisch |
| ------------------- | --------------------: | --------------------------: |
| kritisch            |                    36 |                           4 |
| nicht kritisch      |                     9 |                          51 |

Ordnen Sie TP, FN, FP und TN zu; berechnen Sie Accuracy, Precision, Recall und F1. Tatsächlich kritische, aber nicht markierte Fälle seien besonders teuer. Wählen Sie die vorrangige Zielmetrik.

#### `P0-03-TR-MZ6-WI`

Ein synthetisches Modell markiert Q&A-Fälle für eine technische Prüfung. »Technik« ist positiv:

| tatsächliche Klasse | vorhergesagt Technik | vorhergesagt Nicht-Technik |
| ------------------- | -------------------: | -------------------------: |
| Technik             |                   36 |                          4 |
| Nicht-Technik       |                    9 |                         51 |

Ordnen Sie TP, FN, FP und TN zu; berechnen Sie Accuracy, Precision, Recall und F1. Tatsächlich technische, aber nicht markierte Fälle seien besonders teuer. Wählen Sie die vorrangige Zielmetrik.

**Gemeinsamer Erwartungshorizont – 7 Punkte:** \(TP=36,FN=4,FP=9,TN=51\); Accuracy \(=0{,}870\), Precision \(=0{,}800\), Recall \(=0{,}900\), F1 \(\approx0{,}847\); Recall ist wegen der hohen False-Negative-Kosten vorrangig, Precision bleibt als Aufwandsperspektive relevant.

**Quellenabgrenzung:** Das Aufgabenpaar ist der eigenständige 100-Fälle-Lehrfall `P0-03-PROBEKLAUSUR-A6-MATRIX-V1`. Das verbindliche W09-JASP-Labor verwendet die 80 Zeilen aus `P0-03-S6-KLASSIFIKATION-V1` mit \(TP=32,FN=8,FP=6,TN=34\). Beide Lehrfälle prüfen dieselbe Kernhandlung, besitzen aber unterschiedliche Zahlen und werden nicht vermischt.

### MZ7 / LI23–LI24 – Evidenz kommunizieren und begrenzen

#### `P0-03-TR-MZ7-BWL`

Aus dem MZ6-BWL-Lehrfall liegen 100 synthetische Testfälle, Accuracy \(0{,}870\) und Recall \(0{,}900\) vor. Formulieren Sie höchstens zwei Sätze für die Bereichsleitung: Ergebnis, bedingte Handlung und eine konkrete Grenze.

#### `P0-03-TR-MZ7-WI`

Aus dem MZ6-WI-Lehrfall liegen 100 synthetische Testfälle, Accuracy \(0{,}870\) und Recall \(0{,}900\) vor. Formulieren Sie höchstens zwei Sätze für den Plattformbetrieb: Ergebnis, bedingte Handlung und eine konkrete Grenze.

**Gemeinsamer Erwartungshorizont – 3 Punkte:** Datenbasis/Nenner und mindestens eine korrekte Metrik; bedingte, adressatengerechte Handlung; Hinweis auf synthetische kleine Testdaten und fehlenden Nachweis realer Produktionsqualität.

## 4. Abnahme- und Einsatzregeln

1. IR und QE prüfen je Paar, dass Zahlen, Rechenweg, Punktzahl und Aussagegrenze identisch bleiben.
2. LD dokumentiert im Wochenplan, welche Domänenvariante als Worked Example und welche als Transfercheck verwendet wurde.
3. Mindestens einmal bis W09 beginnt der Unterricht mit einer BWL-/Management-Variante und mindestens einmal mit einer WI-/Informatik-Variante.
4. Die Klausur enthält weiterhin mindestens eine Vignette aus beiden Domänenfamilien. Sie muss nicht beide Varianten desselben Paares enthalten.
5. Ein Unterschied zwischen Varianten wird nicht als Zielgruppen-, Lehr- oder Domäneneffekt interpretiert.
6. Änderungen an Zahlen oder Erwartungshorizont werden immer in beiden Varianten desselben Paares vorgenommen.
