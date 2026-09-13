# P0-03: JASP-Analyseleitfaden

## 1. Zweck und verbindlicher Status

Dieser Leitfaden beschreibt reproduzierbare Analysen für die sieben P0-03-CSV-Dateien. Sämtliche Zeilen sind **synthetische LEHRDATEN ohne Personenbezug**. Ergebnisse beschreiben nur die jeweilige konstruierte Tabelle. Herkunft, Spalten, Rundung und zulässige Aussagen stehen in `P0-03_Datenwoerterbuch_Provenienz.md`.

Das Materialpaket enthält bewusst **keine `.jasp`-Datei**. Eine gültige JASP-Analysedatei ist ein von JASP erzeugtes Binärformat und darf nicht durch Umbenennen oder als Textdatei vorgetäuscht werden. Bei der Durchführung wird sie in der tatsächlich eingesetzten JASP-Version aus den CSV-Dateien erzeugt.

## 2. Semester-Version vor dem ersten Termin fixieren

Für diese Fassung ist **JASP 0.98.1** als Semester-Version festgelegt. Die Version ist in den offiziellen [JASP Release Notes](https://jasp-stats.org/release-notes/) als stabile Veröffentlichung vom 07.07.2026 dokumentiert. Nightly Builds werden nicht verwendet.

Vor dem ersten Lehrtermin gelten folgende reproduzierbare Rahmenbedingungen:

1. Auf allen Lehrgeräten wird exakt JASP 0.98.1 eingesetzt.
2. Automatische Versionswechsel werden für die Lehrphase vermieden. Ein Versionswechsel während des Semesters erfordert einen erneuten Import- und Klickpfadtest sowie eine neue Materialversion.
3. Die optionale JASP-KI-Funktion bleibt für diese Analysen deaktiviert; sie ist weder für Berechnung noch Interpretation Bestandteil des Analyseplans.
4. Im Ergebnisprotokoll werden JASP-Version, Betriebssystem, CSV-Dateiname, `source_ref`, Analysepfad und Ausschlüsse festgehalten. Für die V1-Dateien lautet der Ausschluss: keine Zeile.
5. Die Zahl der Dezimalstellen in JASP wird für Tabellen auf drei gesetzt. Die CSV-Grundwerte und die auf sechs Stellen gespeicherten abgeleiteten Felder bleiben unverändert.

Die Menünamen dieses Leitfadens folgen der englischen Oberfläche von JASP 0.98.1. Bei einer lokalisierten Oberfläche ist der inhaltlich gleich benannte Menüpunkt zu verwenden; die Semester-Version bleibt trotzdem unverändert.

## 3. CSV importieren und Skalenniveaus prüfen

Für jede Analyse wird die betreffende CSV neu geöffnet:

1. `File > Open > Computer > Browse` wählen und die CSV im Ordner dieses Leitfadens öffnen.
2. Beim Import UTF-8, Komma als Trennzeichen und Punkt als Dezimalzeichen prüfen. JASP erkennt diese Einstellungen normalerweise automatisch.
3. In der Datenansicht die Zahl der Zeilen mit dem Datenwörterbuch abgleichen.
4. Das Skalenniveau über das Symbol im jeweiligen Spaltenkopf kontrollieren und bei Bedarf ändern:
   - IDs, Klassen, Runden, Szenarien und Provenienzfelder: `Nominal`;
   - `confidence`: `Ordinal`;
   - `confidence_gruppe`: `Ordinal`, Reihenfolge `niedrig`, `mittel`, `hoch`;
   - Messwerte, Zählungen, Anteile und Scores: `Scale`;
   - binäre 0/1-Felder wie `korrekt`: für Kontingenzanalysen `Nominal`.
5. Prüfen, dass JASP keine fehlenden Werte meldet. In V1 sind alle Zeilen vollständig.

Die kanonischen CSV-Dateien werden nicht in JASP überschrieben. Die echte Analysedatei wird über `File > Save As` separat gespeichert, beispielsweise als `P0-03_S1_Analyse_JASP-0.98.1.jasp`.

## 4. Deskription und Plots

### 4.1 S1-Servicezeiten

Datei: `P0-03_Lehrdaten_S1_Servicezeiten.csv`

1. `Descriptives > Descriptive Statistics` öffnen.
2. `servicezeit_s` nach `Variables` verschieben.
3. Unter `Statistics` mindestens `Valid`, `Missing`, `Mean`, `Median`, `Std. deviation`, `Variance`, `Minimum`, `Maximum` und `Quartiles` aktivieren.
4. Unter `Plots` `Distribution plots`, `Boxplots`, `Q-Q plots` und `Dot plots` aktivieren.
5. Achse und Befund mit der Einheit Sekunden beschriften.

Importkontrolle: \(n=20\), Mittelwert \(120{,}000\) s, Median \(120{,}000\) s, Stichprobenstandardabweichung \(31{,}486\) s, Minimum 60 s, Maximum 180 s.

Die JASP-Stichprobenstandardabweichung verwendet \(n-1\). Falls ein arsnova.eu-Aggregat mit Division durch \(n\) verglichen wird, muss die andere Konvention ausdrücklich benannt werden; für diese 20 Werte beträgt die deskriptive Standardabweichung mit Division durch \(n\) \(30{,}689\) s.

### 4.2 S6-Modellläufe nach Lehrmodell

Datei: `P0-03_Lehrdaten_S6_Modelllaeufe.csv`

1. `Descriptives > Descriptive Statistics` öffnen.
2. `accuracy` nach `Variables` verschieben.
3. `modell_id` nach `Split` verschieben.
4. `Mean`, `Std. deviation`, `Minimum`, `Maximum` und einen Boxplot oder Dotplot aktivieren.

Importkontrolle:

- `LEHRMODELL_A`: \(n=12\), Mittelwert \(0{,}794792\), Stichproben-SD \(0{,}024690\), Minimum \(0{,}762500\), Maximum \(0{,}837500\).
- `LEHRMODELL_B`: \(n=12\), Mittelwert \(0{,}839583\), Stichproben-SD \(0{,}023737\), Minimum \(0{,}800000\), Maximum \(0{,}875000\).

Diese Streuung betrifft nur die zwölf vorab festgelegten synthetischen Resamples. Sie ist ausdrücklich nicht die Streuung des festen Repository-Seed-Evals.

## 5. Kontingenztafeln

### 5.1 S2: Korrektheit × Confidence

Datei: `P0-03_Lehrdaten_S2_Confidence.csv`

#### 2 × 3-Tafel des Hauptkonzepts

1. `Frequencies > Contingency Tables` öffnen.
2. `korrekt` nach `Rows` und `confidence_gruppe` nach `Columns` verschieben.
3. Unter `Cells` beobachtete Häufigkeiten, erwartete Häufigkeiten und Spaltenprozente aktivieren.
4. Unter `Statistics` bei einer Testübung `χ²` aktivieren. Für die reine deskriptive Lehrfrage reichen Häufigkeiten und Spaltenprozente.
5. Vor der Interpretation prüfen, dass die Spalten in der Reihenfolge `niedrig`, `mittel`, `hoch` stehen.

Sollhäufigkeiten:

- niedrig: 6 richtig, 16 falsch, insgesamt 22; korrekt \(=27{,}273\,\%\);
- mittel: 7 richtig, 5 falsch, insgesamt 12; korrekt \(=58{,}333\,\%\);
- hoch: 21 richtig, 5 falsch, insgesamt 26; korrekt \(=80{,}769\,\%\).

Für eine 2 × 5-Tafel wird `confidence` statt `confidence_gruppe` in `Columns` gelegt. Confidence bleibt ordinal; ein Abstand von 1 zu 2 wird nicht als gleich großer psychologischer Abstand wie 4 zu 5 interpretiert.

Zulässiger Befund: In diesen Lehrdaten steigt der beobachtete Korrektheitsanteil über die vorab definierten Confidence-Gruppen. Unzulässig sind Aussagen über reale Personen, individuelle Kompetenz oder kausale Wirkung von Sicherheit.

### 5.2 S6: binäre Confusion Matrix

Datei: `P0-03_Lehrdaten_S6_Klassifikation.csv`

1. `Frequencies > Contingency Tables` öffnen.
2. `ist_klasse` nach `Rows` und `prognose_klasse` nach `Columns` verschieben.
3. Unter `Cells` beobachtete Häufigkeiten sowie Zeilenprozente aktivieren.
4. Die Zellbezeichnungen anhand der Zeilen- und Spaltenlabels zuordnen; die positive Klasse ist `TECHNIK`.

Sollmatrix:

- Ist `TECHNIK`, Prognose `TECHNIK`: \(TP=32\).
- Ist `TECHNIK`, Prognose `NICHT_TECHNIK`: \(FN=8\).
- Ist `NICHT_TECHNIK`, Prognose `TECHNIK`: \(FP=6\).
- Ist `NICHT_TECHNIK`, Prognose `NICHT_TECHNIK`: \(TN=34\).

Daraus folgen Accuracy \(0{,}825000\), Precision Technik \(0{,}842105\), Recall Technik \(0{,}800000\) und F1 Technik \(0{,}820513\). Die alphabetische Anzeige der Klassen kann die optische Position der vier Zellen verändern; maßgeblich sind die Labels, nicht eine angenommene Position oben links.

## 6. Gepaarter t-Test

Datei: `P0-03_Lehrdaten_S1_Paare.csv`

Die Tabelle liegt absichtlich im breiten Format vor: Eine Zeile enthält beide Runden desselben synthetischen Paares. Die vorab definierte Differenz ist

$$
d_i=abs\_fehler\_r1\_s-abs\_fehler\_r2\_s.
$$

Positive Werte bedeuten geringeren absoluten Fehler in Runde 2.

### 6.1 Voraussetzungen zuerst prüfen

1. `Descriptives > Descriptive Statistics` öffnen.
2. `differenz_fehler_r1_minus_r2_s` nach `Variables` verschieben.
3. Boxplot, Q-Q-Plot und die einzelnen Datenpunkte prüfen.
4. Festhalten: Der t-Test modelliert die Verteilung der **Differenzen**, nicht die beiden Randverteilungen getrennt.

### 6.2 Test ausführen

1. `T-Tests > Paired Samples T-Test` öffnen.
2. `abs_fehler_r1_s` als erste und `abs_fehler_r2_s` als zweite Variable zu einem Paar hinzufügen.
3. Den klassischen Student-t-Test und die zweiseitige Alternative aktivieren.
4. `Descriptives`, Mittelwertdifferenz, 95-%-Konfidenzintervall und Effektgröße aktivieren.
5. Unter `Assumption Checks` den Normalitätstest und Q-Q-Plot der Differenzen aktivieren, sofern diese Optionen angezeigt werden.
6. Im Output kontrollieren, dass die Differenz als R1 minus R2 berechnet wird. Bei umgekehrter Variablenreihenfolge ändern sich Vorzeichen von Mittelwertdifferenz und t-Wert.

Sollwerte bei R1 minus R2: \(n=30\), mittlerer Fehler R1 \(16{,}200\) s, mittlerer Fehler R2 \(8{,}667\) s, mittlere Differenz \(7{,}533\) s, Stichproben-SD der Differenzen \(6{,}410\) s und \(t(29)=6{,}437\), zweiseitig \(p<0{,}001\).

Der Befund darf nur als Unterschied in diesen konstruierten Paaren formuliert werden. Wiederholung, Übung, Ausfälle und Abhängigkeit durch eine gedachte Diskussion sind durch diese Tabelle nicht als Ursachen getrennt.

## 7. Korrelation und einfache lineare Regression

Datei: `P0-03_Lehrdaten_S5_Last_Latenz.csv`

Die beiden Latenzspalten sind alternative Fassungen derselben 16 Lehrläufe. Zuerst wird die Basis analysiert; danach wird die Analyse dupliziert oder neu angelegt und ausschließlich die abhängige Variable durch die Ausreißervariante ersetzt.

### 7.1 Pearson-Korrelation

1. `Regression > Correlation` öffnen.
2. `last_vu` und `median_latenz_basis_ms` in das Analysefeld verschieben.
3. `Pearson`, die Ausgabe des Signifikanzwerts und unter `Plots` den Scatterplot aktivieren.
4. Achsen mit VU und Millisekunden beschriften.
5. Eine zweite Korrelationsanalyse mit `last_vu` und `median_latenz_ausreisser_ms` anlegen; die Basisanalyse bleibt erhalten.

Sollwerte:

- Basis: \(r=0{,}995822\).
- Ausreißervariante: \(r=0{,}794976\).

### 7.2 Lineare Regression

1. `Regression > Linear Regression` öffnen.
2. `median_latenz_basis_ms` nach `Dependent Variable` verschieben.
3. `last_vu` nach `Covariates` verschieben.
4. Unter `Statistics` Modellanpassung, \(R^2\), Koeffizienten, Konfidenzintervalle und deskriptive Werte aktivieren.
5. Unter `Plots` Residuen gegen vorhergesagte Werte und den Q-Q-Plot der Residuen aktivieren.
6. Die Analyse ein zweites Mal mit `median_latenz_ausreisser_ms` als abhängiger Variable ausführen.

Sollmodelle:

$$
\widehat{Latenz}_{Basis}=80{,}135294+0{,}182588\cdot Last,\qquad R^2=0{,}991661
$$

$$
\widehat{Latenz}_{Ausreißer}=74{,}570588+0{,}229176\cdot Last,\qquad R^2=0{,}631987
$$

Die Steigung der Basis bedeutet innerhalb dieser Lehrtabelle eine geschätzte Zunahme von rund 0,183 ms Medianlatenz je zusätzlichem VU. Sie ist kein Produktivbenchmark und keine kausale Hardwarewirkung. Vorhersagen werden nur im konstruierten Bereich 50–425 VU betrachtet.

## 8. S3-Rankingfelder reproduzierbar prüfen

Datei: `P0-03_Lehrdaten_S3_QA_Ranking.csv`

1. `Descriptives > Descriptive Statistics` öffnen.
2. `netto`, `zustimmung`, `wilson_untergrenze` und `kontroversitaet` nach `Variables` verschieben.
3. `snapshot_phase` bei Bedarf nach `Split` verschieben.
4. Die Einzelzeilen in der Datenansicht anhand der Formeln im Datenwörterbuch prüfen; JASP soll die bereits berechneten Felder hier nicht stillschweigend durch andere Intervallkonventionen ersetzen.

Kontrollfall `S3-SNP-002`: \(N=100\), \(U=40\), \(D=40\), \(C=10\), Netto \(=0\), Zustimmung \(=0{,}500000\), Wilson-Untergrenze \(=0{,}392972\), Kontroversität \(=0{,}888889\).

Eine Rangfolge nach Zustimmung, Wilson-Untergrenze oder Kontroversität beantwortet jeweils eine andere Frage. Die Kontroversität nach arsnova.eu-Formel ist kein p-Wert und die Wilson-Untergrenze ist nicht das gesamte Konfidenzintervall.

## 9. Ergebnis sichern und exportieren

1. Im Ergebnisbereich über die Ergebnisoptionen aussagekräftige Titel und kurze Notizen zu Datei, `source_ref`, \(n\), Rundung und Analyseentscheidung ergänzen.
2. Die echte Analysedatei mit `File > Save As` im `.jasp`-Format speichern. Nur diese von JASP erzeugte Datei ist eine gültige JASP-Binärdatei.
3. Für ein lesbares Abgabeformat `File > Export Results` und anschließend HTML oder PDF wählen.
4. Einzelne Tabellen oder Grafiken können über die Ergebnisoptionen kopiert oder exportiert werden.
5. Exportierte Ergebnisse enthalten mindestens:
   - Datensatzname und `source_ref`;
   - JASP 0.98.1 und Betriebssystem;
   - Beobachtungszahl und fehlende Werte;
   - gewählte Variablen, Variablenreihenfolge und Skalenniveaus;
   - Kennwert oder Test mit Einheit und Rundung;
   - eine zulässige Interpretation und mindestens eine Grenze;
   - für jede verwendete Grafik eine textliche Kernaussage und für jede
     aufgabenrelevante Tabelle eine lineare, ohne Farbe verständliche
     Textfassung der benötigten Zellen.

Die Ergebnisdatei wird nicht als Beleg realer arsnova.eu-Nutzung, Produktionsleistung oder Modellqualität bezeichnet. Der sichtbare Hinweis **LEHRDATEN** bleibt in Titel oder Befund erhalten.

Vor dem Pilotstart wird mindestens ein Export je verpflichtender Analyseklasse
gegen die [Material- und A11y-Matrix](./P0-03_Barrierefreiheit_Material_und_Probe.md)
geprüft. Der JASP-Export allein gilt nicht als barrierefreie Alternative, wenn
Grafik, Sternsymbol, Farbe oder räumliche Tabellenlage für die Lösung
unverzichtbar bleibt.
