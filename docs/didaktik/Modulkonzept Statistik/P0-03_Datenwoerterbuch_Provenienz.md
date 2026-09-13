# P0-03: Datenwörterbuch und Provenienz

**Kürzel vorab:** **CSV** bezeichnet das Tabellenformat, **LIVE** Daten aus dem laufenden Kurs, **REPO** versionierte Repository-Nachweise und **LEHRDATEN** synthetische Übungsdaten. **S1–S6** sind die Fallstudienstränge, **W01–W10** die Kurswochen, **ID** eine technische Kennung, **`source_ref`** die Quellenkennung und ein Suffix wie **V1** die Version eines Datensatzes, nicht die curriculare Vertiefung V1.

- **Stand:** 13.09.2026
- **Geltungsbereich:** die sieben CSV-Dateien dieses P0-03-Lehrdatenpakets
- **Fachliche Grundlage:** [Modulkonzept „Angewandte Statistik“](./Modulkonzept_48UE_BWL_Management_WI_Informatik.md)

## 1. Verbindlicher Datenstatus

Alle sieben Tabellen sind **synthetische LEHRDATEN**. Sie wurden deterministisch für die im Statistik-Hauptkonzept beschriebenen Übungen konstruiert. Sie enthalten weder Live-Daten noch Produktionsmessungen, Repository-Messartefakte, Freitexte, Nutzerkonten oder andere personenbezogene Angaben.

Die IDs sind feste technische Zeilen- oder Fallbezeichner. Sie identifizieren keine Menschen und dürfen nicht dateiübergreifend als Personenkennung interpretiert werden. `source_kind` hat deshalb in jeder Zeile den Wert `LEHRDATEN`; `source_ref` bezeichnet die stabile Konstruktionsversion der jeweiligen Tabelle.

### 1.1 Abgrenzung der Probeklausur-Lehrfälle

Die folgenden konstruierten `source_ref` stehen ausschließlich im Aufgabenstamm der Probeklausur und sind **keine** Zeilen oder Ableitungen der sieben CSV-Dateien:

| `source_ref`                          | Gegenstand                                     |
| ------------------------------------- | ---------------------------------------------- |
| `P0-03-PROBEKLAUSUR-A1-OPTIONEN-V1`   | nominale 48-Antworten-Tabelle                  |
| `P0-03-PROBEKLAUSUR-A1-SCHAETZUNG-V1` | fünf numerische Schätzwerte                    |
| `P0-03-PROBEKLAUSUR-A2-TAFEL-V1`      | 100-Fälle-Kontingenztafel                      |
| `P0-03-PROBEKLAUSUR-A3-WILSON-V1`     | 37/52-Anteilsfall mit Wilson-Leseintervall     |
| `P0-03-PROBEKLAUSUR-A3-MITTELWERT-V1` | unabhängiger Mittelwert-Lehrfall               |
| `P0-03-PROBEKLAUSUR-A4-PAARE-V1`      | zehn gepaarte Fehlerwerte als JASP-Auszug      |
| `P0-03-PROBEKLAUSUR-A5-REGRESSION-V1` | zwölf synthetische Regressionsläufe            |
| `P0-03-PROBEKLAUSUR-A6-MATRIX-V1`     | binäre 100-Fälle-Testmatrix                    |
| `P0-03-PROBEKLAUSUR-A6-TRAINTEST-V1`  | eigenständiger 98-%-/87-%-Train/Test-Vergleich |

Insbesondere sind A5 nicht die 16 Zeilen aus `P0-03-S5-LAST-LATENZ-V1`, A6-Matrix nicht die 80 Zeilen aus `P0-03-S6-KLASSIFIKATION-V1` und A6-Train/Test nicht das W09-Zahlenbeispiel 98 %/71 %. Gleiche oder ähnliche Kennwerte begründen keine gemeinsame Datenquelle.

## 2. Gemeinsame CSV- und Rundungskonventionen

- Zeichencodierung: UTF-8.
- Trennzeichen: Komma.
- Dezimalzeichen: Punkt, damit der Import in JASP unabhängig von der Betriebssystem-Locale eindeutig bleibt.
- Erste Zeile: Spaltennamen; jede weitere Zeile ist genau eine Beobachtungseinheit der jeweiligen Tabelle.
- Alle Dateien der Version V1 sind vollständig. Es gibt keine fehlenden Werte.
- Für spätere Versionen bedeutet ausschließlich ein leeres Feld »fehlend«. Zeichenketten wie `0`, `NA`, `keine` oder `NICHT_TECHNIK` dürfen nicht als fehlend umcodiert werden.
- Ganzzahlige Zählungen, Sekundenwerte, Millisekundenwerte sowie absolute Fehler und Fehlerdifferenzen sind exakt gespeichert.
- In S3 und S6-Modellläufen werden abgeleitete Anteile erst nach vollständiger Berechnung auf sechs Nachkommastellen gerundet. Die ganzzahligen Grundfelder bleiben die maßgebliche Quelle für Neuberechnungen.
- Erwartete JASP-Ausgaben dürfen für die Darstellung auf drei Dezimalstellen gerundet werden. Diese Anzeigepräzision ändert die CSV-Werte nicht.

### 2.1 Formeln für S3

Mit \(V=U+D\), \(\hat p=U/V\) und \(z=1{,}96\):

$$
\text{Netto}=U-D,\qquad \text{Zustimmung}=\frac{U}{V}
$$

$$
\text{Wilson-Untergrenze}=
\frac{\hat p+\frac{z^2}{2V}-z\sqrt{\frac{\hat p(1-\hat p)}{V}+\frac{z^2}{4V^2}}}
{1+\frac{z^2}{V}}
$$

$$
C=\max(1,0{,}1N),\qquad
\text{Kontroversität}=\frac{2\min(U,D)}{U+D+C}
$$

Für \(V=0\) setzt dieses Lehrdatenpaket die Zustimmung auf 0; die aktuelle arsnova.eu-Q&A-Logik setzt Wilson-Untergrenze und Kontroversität auf 0. Die vorliegende S3-Tabelle enthält keinen solchen Fall. Die gespeicherten Ergebnisfelder sind auf sechs Nachkommastellen gerundet.

### 2.2 Formeln für S6

Die positive Klasse ist `TECHNIK`:

$$
\text{Accuracy}=\frac{TP+TN}{TP+TN+FP+FN}
$$

$$
\text{Precision}_{Technik}=\frac{TP}{TP+FP},\qquad
\text{Recall}_{Technik}=\frac{TP}{TP+FN}
$$

$$
F1_{Technik}=\frac{2\cdot Precision\cdot Recall}{Precision+Recall}
=\frac{2TP}{2TP+FP+FN}
$$

## 3. `P0-03_Lehrdaten_S1_Servicezeiten.csv`

- **Beobachtungseinheit:** ein konstruierter Servicefall.
- **Umfang und fehlende Werte:** 20 vollständige Zeilen, keine fehlenden Werte.
- **Provenienz:** Die Werte wurden für P0-03 konstruiert und stimmen mit der Servicezeit-Aufgabe in `P0-03_ARSnova_Woche_02.json` überein. Es handelt sich nicht um gemessene arsnova.eu-Latenzen oder betriebliche Servicezeiten.

| Spalte           | Typ und Skala      | Einheit  | Definition                                                           |
| ---------------- | ------------------ | -------- | -------------------------------------------------------------------- |
| `servicefall_id` | Text, nominal      | keine    | Stabile, nicht personenbeziehbare ID des konstruierten Servicefalls. |
| `servicezeit_s`  | Ganzzahl, metrisch | Sekunden | Konstruierte Dauer des Servicefalls.                                 |
| `source_kind`    | Text, nominal      | keine    | Datenstatus; immer `LEHRDATEN`.                                      |
| `source_ref`     | Text, nominal      | keine    | Konstruktionsversion; immer `P0-03-S1-SERVICE-V1`.                   |

**Zulässige Aussage:** Für genau diese 20 Lehrwerte dürfen Verteilung, Lage und Streuung beschrieben werden; der Mittelwert beträgt exakt 120 Sekunden. Nicht zulässig sind Aussagen über reale Serviceprozesse, die Produktivleistung von arsnova.eu oder eine Population außerhalb dieser konstruierten Tabelle.

## 4. `P0-03_Lehrdaten_S1_Paare.csv`

- **Beobachtungseinheit:** ein konstruiertes vollständiges Schätzpaar in breitem Datenformat.
- **Umfang und fehlende Werte:** 30 vollständige Paare, keine fehlenden Werte.
- **Provenienz:** Die Werte wurden als Lehrbeispiel für zwei Schätzrunden zur vorab festgelegten Referenz 120 Sekunden konstruiert. `paar_id` ist kein Teilnehmercode und hat keine Beziehung zu `servicefall_id`.

| Spalte                           | Typ und Skala      | Einheit  | Definition                                                                                                       |
| -------------------------------- | ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `paar_id`                        | Text, nominal      | keine    | Stabile ID eines synthetischen Schätzpaares; kein Personenbezug.                                                 |
| `referenz_s`                     | Ganzzahl, metrisch | Sekunden | Vor beiden Runden festgelegter Referenzwert; immer 120.                                                          |
| `runde_1`                        | Text, nominal      | keine    | Kennzeichnung der ersten Messbedingung; immer `R1`.                                                              |
| `schaetzung_r1_s`                | Ganzzahl, metrisch | Sekunden | Konstruierte Schätzung in Runde 1.                                                                               |
| `abs_fehler_r1_s`                | Ganzzahl, metrisch | Sekunden | Exakt berechnet als \(\lvert schaetzung\_r1\_s-referenz\_s\rvert\).                                              |
| `runde_2`                        | Text, nominal      | keine    | Kennzeichnung der zweiten Messbedingung; immer `R2`.                                                             |
| `schaetzung_r2_s`                | Ganzzahl, metrisch | Sekunden | Konstruierte Schätzung in Runde 2.                                                                               |
| `abs_fehler_r2_s`                | Ganzzahl, metrisch | Sekunden | Exakt berechnet als \(\lvert schaetzung\_r2\_s-referenz\_s\rvert\).                                              |
| `differenz_fehler_r1_minus_r2_s` | Ganzzahl, metrisch | Sekunden | Vorab definierte Differenz `abs_fehler_r1_s - abs_fehler_r2_s`; positive Werte bedeuten geringeren Fehler in R2. |
| `source_kind`                    | Text, nominal      | keine    | Datenstatus; immer `LEHRDATEN`.                                                                                  |
| `source_ref`                     | Text, nominal      | keine    | Konstruktionsversion; immer `P0-03-S1-PAARE-V1`.                                                                 |

**Zulässige Aussage:** Die mittlere Fehlerdifferenz und ein gepaarter t-Test dürfen für diese 30 konstruierten Paare berechnet werden. Das Ergebnis ist eine modellbasierte Lehrrechnung und weder ein Kausalnachweis für Peer-Diskussion noch eine Schätzung eines Effekts bei realen Studierenden.

## 5. `P0-03_Lehrdaten_S2_Confidence.csv`

- **Beobachtungseinheit:** eine konstruierte Antwort auf ein synthetisches Item; Zeilen sind nicht zu Personen verkettet.
- **Umfang und fehlende Werte:** 60 vollständige Antworten, keine fehlenden Werte.
- **Provenienz:** Die Verteilung wurde für die Lehranalyse von Korrektheit und ordinaler Antwortsicherheit konstruiert. Sie ist kein Export einer Session.

| Spalte              | Typ und Skala           | Einheit   | Definition                                                                                                                              |
| ------------------- | ----------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `antwort_id`        | Text, nominal           | keine     | Stabile ID der synthetischen Antwort; kein Personenbezug.                                                                               |
| `item_id`           | Text, nominal           | keine     | Stabile Kennung des Lehritems; hier immer `S2-Q01`.                                                                                     |
| `korrekt`           | Ganzzahl, nominal-binär | keine     | Fachliche Korrektheit: `1` = richtig, `0` = falsch. Nicht als metrische Leistung interpretieren.                                        |
| `confidence`        | Ganzzahl, ordinal       | Stufe 1–5 | Antwortbezogene Selbsteinschätzung; 1 = sehr niedrig, 5 = sehr hoch. Abstände zwischen Stufen sind nicht als gleich groß vorausgesetzt. |
| `confidence_gruppe` | Text, ordinal           | keine     | Vorab definierte Gruppierung: 1–2 = `niedrig`, 3 = `mittel`, 4–5 = `hoch`.                                                              |
| `source_kind`       | Text, nominal           | keine     | Datenstatus; immer `LEHRDATEN`.                                                                                                         |
| `source_ref`        | Text, nominal           | keine     | Konstruktionsversion; immer `P0-03-S2-CONFIDENCE-V1`.                                                                                   |

**Zulässige Aussage:** Kontingenztafeln, Randanteile und bedingte Anteile dürfen den Zusammenhang in diesen synthetischen Antworten beschreiben. Nicht zulässig sind Aussagen über individuelle Kompetenz, psychometrische Kalibrierung realer Personen oder eine Studierendenpopulation.

## 6. `P0-03_Lehrdaten_S3_QA_Ranking.csv`

- **Beobachtungseinheit:** ein konstruierter Q&A-Abstimmungssnapshot einer Frage zu einer Phase.
- **Umfang und fehlende Werte:** 12 vollständige Snapshots zu sechs synthetischen Fragen, keine fehlenden Werte.
- **Provenienz:** Die ganzzahligen Ausgangswerte wurden für den Vergleich der in arsnova.eu verwendeten Rankinggrößen konstruiert. Die Formeln entsprechen dem Statistik-Hauptkonzept und der aktuellen Q&A-Logik; die Zeilen sind keine gespeicherten Produktiv-Snapshots.

| Spalte               | Typ und Skala              | Einheit               | Definition                                                                              |
| -------------------- | -------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `snapshot_id`        | Text, nominal              | keine                 | Stabile ID des synthetischen Snapshots.                                                 |
| `frage_id`           | Text, nominal              | keine                 | Stabile ID einer synthetischen Frage ohne Fragetext.                                    |
| `snapshot_phase`     | Text, ordinal              | Phase                 | `T1` oder `T2`; didaktische Reihenfolge, kein echter Zeitstempel.                       |
| `teilnehmende_n`     | Ganzzahl, metrisch-diskret | gedachte Teilnehmende | Bezugsgröße \(N\) für die Glättung der Kontroversität.                                  |
| `upvotes_u`          | Ganzzahl, metrisch-diskret | Stimmen               | Zahl positiver Stimmen \(U\).                                                           |
| `downvotes_d`        | Ganzzahl, metrisch-diskret | Stimmen               | Zahl negativer Stimmen \(D\).                                                           |
| `stimmen_gesamt`     | Ganzzahl, metrisch-diskret | Stimmen               | Exakt \(U+D\).                                                                          |
| `netto`              | Ganzzahl, metrisch-diskret | Stimmen               | Exakt \(U-D\); kann negativ, null oder positiv sein.                                    |
| `zustimmung`         | Dezimalzahl, metrisch      | Anteil 0–1            | \(U/(U+D)\), auf sechs Nachkommastellen gerundet.                                       |
| `wilson_z`           | Dezimalzahl, metrisch      | keine                 | Verwendeter z-Wert; immer 1.96.                                                         |
| `wilson_untergrenze` | Dezimalzahl, metrisch      | Anteil 0–1            | Untere Wilson-Grenze des positiven Stimmenanteils, auf sechs Nachkommastellen gerundet. |
| `glaettung_c`        | Dezimalzahl, metrisch      | Stimmenäquivalent     | \(C=\max(1,0{,}1N)\), auf sechs Nachkommastellen gespeichert.                           |
| `kontroversitaet`    | Dezimalzahl, metrisch      | Score 0–1             | \(2\min(U,D)/(U+D+C)\), auf sechs Nachkommastellen gerundet.                            |
| `source_kind`        | Text, nominal              | keine                 | Datenstatus; immer `LEHRDATEN`.                                                         |
| `source_ref`         | Text, nominal              | keine                 | Konstruktionsversion; immer `P0-03-S3-QA-V1`.                                           |

**Zulässige Aussage:** Netto, beobachtete Zustimmung, Wilson-Untergrenze und Kontroversität dürfen als unterschiedliche Sortiergrößen verglichen werden. Die Wilson-Untergrenze ist nicht der beobachtete Anteil und nicht das vollständige Intervall; Kontroversität ist eine gestaltete Priorisierungsmetrik und kein Signifikanztest. Die Tabelle erlaubt keine Aussage über die Qualität realer Fragen oder reale Kursmeinungen.

## 7. `P0-03_Lehrdaten_S5_Last_Latenz.csv`

- **Beobachtungseinheit:** ein konstruierter, kontrollierter Lastlauf.
- **Umfang und fehlende Werte:** 16 vollständige Läufe, keine fehlenden Werte.
- **Provenienz:** Last und Medianlatenz wurden für eine einfache lineare Lehrregression konstruiert. Sie wurden weder aus veröffentlichten p95-/p99-Werten rekonstruiert noch an einem realen System gemessen. Die Ausreißervariante ist eine didaktische Kopie der Basisreihe, in der genau ein Ergebnis verändert ist.

| Spalte                        | Typ und Skala           | Einheit                             | Definition                                                                              |
| ----------------------------- | ----------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| `lauf_id`                     | Text, nominal           | keine                               | Stabile ID des synthetischen Lastlaufs.                                                 |
| `last_vu`                     | Ganzzahl, metrisch      | gleichzeitige virtuelle Nutzer (VU) | Kontrolliert gesetztes Lastniveau des Lehrmodells.                                      |
| `median_latenz_basis_ms`      | Ganzzahl, metrisch      | Millisekunden                       | Konstruierte Medianlatenz der Basisvariante.                                            |
| `median_latenz_ausreisser_ms` | Ganzzahl, metrisch      | Millisekunden                       | Alternative Lehrreihe; entspricht der Basis bis auf `S5-LAUF-013` mit 230 statt 142 ms. |
| `ausreisser_geaendert`        | Ganzzahl, nominal-binär | keine                               | `1` kennzeichnet die eine didaktisch geänderte Zelle der Ausreißervariante, sonst `0`.  |
| `szenario_id`                 | Text, nominal           | keine                               | Kontrolliertes Lehrszenario; immer `S5-KONTROLLIERT`.                                   |
| `hardwareprofil`              | Text, nominal           | keine                               | Konstant gehaltenes fiktives Hardwareprofil; immer `H1`.                                |
| `requestmix`                  | Text, nominal           | keine                               | Konstant gehaltener fiktiver Requestmix; immer `RM1`.                                   |
| `source_kind`                 | Text, nominal           | keine                               | Datenstatus; immer `LEHRDATEN`.                                                         |
| `source_ref`                  | Text, nominal           | keine                               | Konstruktionsversion; immer `P0-03-S5-LAST-LATENZ-V1`.                                  |

**Zulässige Aussage:** Für den konstruierten Bereich 50–425 VU dürfen Korrelation, Regressionsgerade, Residuen und Ausreißerempfindlichkeit verglichen werden. Die beiden Latenzspalten sind alternative Ergebnisvarianten und dürfen nicht gemeinsam als zwei unabhängige Messungen gezählt werden. Nicht zulässig sind Produktions-SLOs, reale Kapazitätsprognosen, Kausalaussagen oder Extrapolationen außerhalb des Lehrbereichs.

## 8. `P0-03_Lehrdaten_S6_Klassifikation.csv`

- **Beobachtungseinheit:** ein konstruierter, inhaltlich nicht ausgeformulierter Q&A-Klassifikationsfall.
- **Umfang und fehlende Werte:** 80 vollständige Fälle, keine fehlenden Werte.
- **Provenienz:** Goldklasse und Prognose wurden für eine binäre Confusion Matrix konstruiert. Es wurden keine Q&A-Texte, Produktivvorhersagen oder Repository-Seed-Fälle übernommen.

| Spalte             | Typ und Skala           | Einheit | Definition                                                                                        |
| ------------------ | ----------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `fall_id`          | Text, nominal           | keine   | Stabile ID des synthetischen Falls; kein Personenbezug.                                           |
| `ist_klasse`       | Text, nominal-binär     | keine   | Konstruierte Goldklasse: `TECHNIK` oder `NICHT_TECHNIK`.                                          |
| `prognose_klasse`  | Text, nominal-binär     | keine   | Konstruierte Modellprognose mit denselben zwei Klassen.                                           |
| `ist_technik`      | Ganzzahl, nominal-binär | keine   | Numerische Codierung von `ist_klasse`: `1` = `TECHNIK`, `0` = `NICHT_TECHNIK`.                    |
| `prognose_technik` | Ganzzahl, nominal-binär | keine   | Numerische Codierung von `prognose_klasse`: `1` = `TECHNIK`, `0` = `NICHT_TECHNIK`.               |
| `confusion_zelle`  | Text, nominal           | keine   | Exakt aus Ist und Prognose abgeleitet: `TP`, `FN`, `FP` oder `TN`; positive Klasse ist `TECHNIK`. |
| `source_kind`      | Text, nominal           | keine   | Datenstatus; immer `LEHRDATEN`.                                                                   |
| `source_ref`       | Text, nominal           | keine   | Konstruktionsversion; immer `P0-03-S6-KLASSIFIKATION-V1`.                                         |

**Zulässige Aussage:** Aus diesen 80 Fällen dürfen eine binäre Confusion Matrix sowie Accuracy, Precision, Recall und F1 für die positive Klasse `TECHNIK` berechnet und im Hinblick auf synthetische Fehlkosten diskutiert werden. Die Werte belegen keine Qualität eines implementierten oder produktiven Klassifikators.

## 9. `P0-03_Lehrdaten_S6_Modelllaeufe.csv`

- **Beobachtungseinheit:** die Auswertung eines Lehrmodells auf einem vorab festgelegten synthetischen Resample.
- **Umfang und fehlende Werte:** 24 vollständige Modellläufe; zwölf Resamples je Lehrmodell; keine fehlenden Werte.
- **Provenienz:** Der Plan `P0-03-RS-V1`, alle zwölf Resamples und beide Ergebnisreihen wurden vorab als deterministische Lehrdaten festgelegt. Sie stammen ausdrücklich **nicht** aus `qaNlpSeed.ts`, nicht aus `npm run eval:qa-nlp -w @arsnova/backend` und nicht aus dem festen Seed-Eval des Repositorys. `LEHRMODELL_A` und `LEHRMODELL_B` sind keine Aliasnamen für Gatekeeper oder Kaskade.

| Spalte              | Typ und Skala              | Einheit    | Definition                                                                                             |
| ------------------- | -------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| `lauf_id`           | Text, nominal              | keine      | Stabile ID der Kombination aus Lehrmodell und Resample.                                                |
| `resample_plan_id`  | Text, nominal              | keine      | Version des vorab festgelegten Lehrplans; immer `P0-03-RS-V1`.                                         |
| `resample_id`       | Text, nominal              | keine      | Stabile ID eines synthetischen Resamples; dieselbe ID bei A und B kennzeichnet dieselbe Lehrbedingung. |
| `modell_id`         | Text, nominal              | keine      | `LEHRMODELL_A` oder `LEHRMODELL_B`; keine Repository-Modellbezeichnung.                                |
| `n_eval`            | Ganzzahl, metrisch-diskret | Fälle      | Auswertungsumfang; exakt \(TP+FN+FP+TN\), hier immer 80.                                               |
| `tp`                | Ganzzahl, metrisch-diskret | Fälle      | Technik korrekt als Technik prognostiziert.                                                            |
| `fn`                | Ganzzahl, metrisch-diskret | Fälle      | Technik fälschlich als Nicht-Technik prognostiziert.                                                   |
| `fp`                | Ganzzahl, metrisch-diskret | Fälle      | Nicht-Technik fälschlich als Technik prognostiziert.                                                   |
| `tn`                | Ganzzahl, metrisch-diskret | Fälle      | Nicht-Technik korrekt als Nicht-Technik prognostiziert.                                                |
| `accuracy`          | Dezimalzahl, metrisch      | Anteil 0–1 | \((TP+TN)/n\), auf sechs Nachkommastellen gerundet.                                                    |
| `precision_technik` | Dezimalzahl, metrisch      | Anteil 0–1 | \(TP/(TP+FP)\), auf sechs Nachkommastellen gerundet.                                                   |
| `recall_technik`    | Dezimalzahl, metrisch      | Anteil 0–1 | \(TP/(TP+FN)\), auf sechs Nachkommastellen gerundet.                                                   |
| `f1_technik`        | Dezimalzahl, metrisch      | Anteil 0–1 | \(2TP/(2TP+FP+FN)\), auf sechs Nachkommastellen gerundet.                                              |
| `source_kind`       | Text, nominal              | keine      | Datenstatus; immer `LEHRDATEN`.                                                                        |
| `source_ref`        | Text, nominal              | keine      | Konstruktionsversion; immer `P0-03-S6-RESAMPLES-V1`.                                                   |

**Zulässige Aussage:** Mittelwert, Stichprobenstandardabweichung, Spannweite und der gepaarte Unterschied der beiden Ergebnisreihen dürfen ausschließlich für diese zwölf vorab definierten Lehrresamples beschrieben werden. Nicht zulässig sind Aussagen zur Seed-Evaluation des Repositorys, zu produktiver Modellqualität, zu zufälliger Wiederholbarkeit oder zur Generalisierung auf echte Q&A-Fragen.

## 10. Prüfsummen auf Inhaltsebene

Diese Sollwerte dienen der Import- und Rechenkontrolle:

- S1 Servicezeiten: \(n=20\), Summe \(=2400\) s, Mittelwert \(=120{,}000\) s, Median \(=120{,}000\) s, Stichproben-SD \(=31{,}486\) s.
- S1 Paare: \(n=30\), mittlerer absoluter Fehler R1 \(=16{,}200\) s, R2 \(=8{,}667\) s; mittlere Differenz R1 minus R2 \(=7{,}533\) s, Stichproben-SD der Differenzen \(=6{,}410\) s; gepaarter t-Wert \(t(29)=6{,}437\).
- S2: 34 von 60 Antworten sind korrekt. Niedrig: 6/22, mittel: 7/12, hoch: 21/26.
- S3: `S3-SNP-002` hat bei \(N=100\), \(U=D=40\) den Netto-Score 0, Zustimmung 0,500000, Wilson-Untergrenze 0,392972 und Kontroversität 0,888889.
- S5 Basis: \(r=0{,}995822\), \(R^2=0{,}991661\), \(\hat y=80{,}135294+0{,}182588x\). Ausreißervariante: \(r=0{,}794976\), \(R^2=0{,}631987\), \(\hat y=74{,}570588+0{,}229176x\).
- S6 Klassifikation: \(TP=32\), \(FN=8\), \(FP=6\), \(TN=34\); Accuracy \(=0{,}825000\), Precision Technik \(=0{,}842105\), Recall Technik \(=0{,}800000\), F1 Technik \(=0{,}820513\).
- S6 Modellläufe, jeweils zwölf Werte: Lehrmodell A hat mittlere Accuracy \(0{,}794792\) und Stichproben-SD \(0{,}024690\); Lehrmodell B hat mittlere Accuracy \(0{,}839583\) und Stichproben-SD \(0{,}023737\).
