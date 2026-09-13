# P0-03 – Lehrenden-Runbook

**Version:** 2.0.0 · **Stand:** 13.09.2026 · **Status:** verbindlicher Betriebsablauf für den Pilot

**Kanonischer Index:** [P0-03_Materialpaket_Pilotlauf.md](./P0-03_Materialpaket_Pilotlauf.md)

**MC-Test-Referenz:** [fixierter Quellstand `b6b159555e8a228dad73dd75fd66c154a1088e28`](https://github.com/kqc-real/streamlit/tree/b6b159555e8a228dad73dd75fd66c154a1088e28) · [Live-Instanz](https://mc-test.streamlit.app)

## 1. Betriebsauftrag

Dieses Runbook macht den zehnwöchigen Pilot des Moduls „Angewandte Statistik“ ohne zusätzliche Ablaufentscheidung durchführbar. Es regelt Vorbereitung, Präsenzbetrieb, JASP-Analyse, Exporte, asynchronen MC-Test, Nachsteuerung und Offline-Fallback.

### 1.1 Harte Leitplanken

1. **Präsenzumfang:** W01 und W10 je 4 UE; W02–W09 je 5 UE; Summe 48 UE à 45 Minuten.
2. **Livefragen:** Pro Wochenblock genau die 3–6 im [ARSnova-Blueprint](./P0-03_ARSnova_Livequiz_Blueprint_10_Wochen.md) und in der jeweiligen `P0-03_ARSnova_Woche_NN.json` genannten Fragen; der freigegebene Zehn-Wochen-Plan verwendet 4–6. Wird eine Woche auf mehrere Termine verteilt, wird derselbe Wochenpool verteilt und nicht pro Termin vervielfacht.
3. **Nicht-Spiel-Baseline:** `anonymousMode=true`, `showLeaderboard=false`, `defaultTimer=null`, `teamMode=false`, `bonusTokenCount=null`, jede Frage `timer=null`. Es werden keine Quizpunkte, Ränge oder Geschwindigkeiten besprochen.
4. **MC-Test:** Nach jedem Wochenblock wird genau eine Datei mit exakt 30 Fragen asynchron bereitgestellt. Verbindlich sind der [MC-Blueprint](./P0-03_MC-Test_Blueprint_10_Wochen.md), der Laufzeitmodus `practice` ohne Timer mit Sofortfeedback und die Deployment-Konfiguration `show_top5_public=false`.
5. **Analyseumgebung:** Jede softwaregestützte Analyse und jede Zahl in einer Musterlösung wird in JASP reproduziert. Eine Tabellenkalkulation dient höchstens der Sichtprüfung oder datenschutzkonformen Bereinigung.
6. **Zweck:** ARSnova-, MC-Test- und sonstige LIVE-Daten dienen Lehre und interner Modulevaluation. Sie dürfen nicht für individuelle Leistungsbewertung, Forschung, Publikation oder nachträgliche Umwidmung verwendet werden. Eine separate Klausur mit ausschließlich freigegebenen LEHRDATEN bleibt zulässig.
7. **Freiwilligkeit:** Live-Abstimmung, Confidence und Feedback sind freiwillig und ohne Notennachteil. Eine gleichwertige Teilnahme ohne persönliches Gerät ist möglich.
8. **MC-Arbeitsumfang:** `meta.test_duration_minutes=27` ist nur ein Planwert. Zwei vollständige Lerndurchläufe werden empfohlen; die App erzwingt weder eine Versuchsanzahl noch im Lernmodus eine Bearbeitungszeit.

### 1.2 Rollenkürzel

| Kürzel | Rolle                                     | Verantwortung im Runbook                                            |
| ------ | ----------------------------------------- | ------------------------------------------------------------------- |
| MV     | Modulverantwortung                        | curriculare Freigabe, Prüfung und Abweichungsentscheidung           |
| LD     | Lehrdurchführung/Session-Host             | Preflight, Durchführung, Export und Wochenprotokoll                 |
| IR     | Item-Redaktion                            | Fragen, Lösungen, Erklärungen und redaktionelle Zuordnungen         |
| DJ     | Datenkuratierung und JASP                 | Lehrdaten, Provenienz, JASP-Pfade und Prüfrechnungen                |
| QE     | Qualitäts- und Evaluationsverantwortung   | Vier-Augen-Prüfung, Aggregate und interne Modulevaluation           |
| DS     | Datenschutz-/Informationssicherheitsrolle | Zweckbindung, Zugriff, Fristen und dokumentierte Abwesenheit        |
| MP     | MC-Test-Plattformbetrieb                  | Deployment-Konfiguration, SQLite-Daten und technischer Löschvollzug |

### 1.3 Verantwortungsübergaben

| Zeitpunkt                                                  | Liefert | Übernimmt | Übergabekriterium                                                             |
| ---------------------------------------------------------- | ------- | --------- | ----------------------------------------------------------------------------- |
| sieben Tage vor W01                                        | MV      | LD        | freigegebene Paketversion und Datenplan                                       |
| sieben Tage vor jeder Woche                                | IR      | LD        | abgenommenes Live-JSON und MC-JSON                                            |
| drei Tage vor jeder Woche                                  | DJ      | LD        | geprüfte CSV, JASP-Klickpfad, Sollwerte und lokal erzeugter Referenzoutput    |
| ein Tag vor jeder Woche                                    | LD      | QE        | dokumentierter Preflight ohne offene Abweichung                               |
| ein Werktag nach der Sitzung                               | LD      | DJ        | bereinigte Exporte und Wochenprotokoll                                        |
| vor Beginn der Folgewoche                                  | QE      | MV        | aggregierte Lernsignale und konkrete Nachsteuerung                            |
| spätestens sieben Kalendertage nach Ende jedes MC-Fensters | LD      | DS und MP | Löschauftrag, technischer Vollzug und Abwesenheitsnachweis nach Abschnitt 5.5 |
| nach W10 und letztem Löschvollzug                          | DS      | MV        | vollständige Löschbestätigung und interner Abschlussbefund                    |

## 2. Zehn-Wochen-Betriebsplan

Die Standardtaktung ist:

- **4-UE-Woche:** zwei Blöcke à 2 UE.
- **5-UE-Woche:** zwei Blöcke à 2 UE plus 1 UE Statistiklabor, Transferwerkstatt oder Klausurtraining.
- Pausen sind keine UE. Bei mehreren Präsenztagen bleibt die Reihenfolge der UE und Live-IDs erhalten.

| Woche |  UE | Präsenzauftrag                                                                 | Livefragen                               | Verbindliche JASP-/Datengrundlage                                                                                                         | Wochenabschluss                                                              | Asynchron                                              |
| ----: | --: | ------------------------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
|   W01 |   4 | statistischer Prozess; Beobachtungseinheit; Stichprobe; Skalen; Datenqualität  | [L01–L05](./P0-03_ARSnova_Woche_01.json) | [S1-Servicezeiten](./P0-03_Lehrdaten_S1_Servicezeiten.csv): Import, Zeile/Variable und Messniveau                                         | Variablenkatalog; erlaubte und unzulässige Aussagen protokollieren           | [MC-Test W01](./P0-03_MC-Test_Woche_01.json), 30 Items |
|   W02 |   5 | Häufigkeiten; Nenner; Diagramme; Mittelwert/Median; Robustheit                 | [L01–L05](./P0-03_ARSnova_Woche_02.json) | [S1-Servicezeiten](./P0-03_Lehrdaten_S1_Servicezeiten.csv): Deskriptivübersicht und Histogramm                                            | Kurzbericht mit n, Einheit und Quellenstatus                                 | [MC-Test W02](./P0-03_MC-Test_Woche_02.json), 30 Items |
|   W03 |   5 | Streuung; `n`/`n−1`; Quartile; Boxplot; Latenzquantile                         | [L01–L05](./P0-03_ARSnova_Woche_03.json) | [S1-Servicezeiten](./P0-03_Lehrdaten_S1_Servicezeiten.csv): Streuung/Boxplot; REPO-Latenzwerte nur aus dem Livequiz lesen                 | Dashboard mit Lage, Streuung, Quantilen und zwei Grenzen                     | [MC-Test W03](./P0-03_MC-Test_Woche_03.json), 30 Items |
|   W04 |   5 | Münzwurf; Multiplikation; bedingte Wahrscheinlichkeit; Confidence; Basisrate   | [L01–L04](./P0-03_ARSnova_Woche_04.json) | [S2-Confidence](./P0-03_Lehrdaten_S2_Confidence.csv): 2×3-/2×5-Kontingenztafel                                                            | Kalibrierungsdiagnose und inverse Bedingungen mit sichtbaren Nennern         | [MC-Test W04](./P0-03_MC-Test_Woche_04.json), 30 Items |
|   W05 |   5 | Zufallsvariablen; Binomial-/Normalmodell; Stichprobenvariabilität              | [L01–L05](./P0-03_ARSnova_Woche_05.json) | [S6-Modellläufe](./P0-03_Lehrdaten_S6_Modelllaeufe.csv): Verteilungen der zwölf festen Lehrresamples getrennt nach Lehrmodell             | Sampling-Grafik mit Einfluss von n und klarer Lehrdatenbegrenzung            | [MC-Test W05](./P0-03_MC-Test_Woche_05.json), 30 Items |
|   W06 |   5 | Punkt-/Intervallschätzung; Intervallbreite; Wilson; Wald                       | [L01–L05](./P0-03_ARSnova_Woche_06.json) | [S3-Q&A-Ranking](./P0-03_Lehrdaten_S3_QA_Ranking.csv) und [S1-Servicezeiten](./P0-03_Lehrdaten_S1_Servicezeiten.csv): Intervalle/Rangmaße | Punktschätzer plus Intervall; Präzision und Übertragbarkeit trennen          | [MC-Test W06](./P0-03_MC-Test_Woche_06.json), 30 Items |
|   W07 |   5 | Hypothesen; p-Wert; Fehlerarten; Relevanz; gepaarter Vergleich                 | [L01–L05](./P0-03_ARSnova_Woche_07.json) | [S1-Paare](./P0-03_Lehrdaten_S1_Paare.csv): gepaarter t-Test und Differenzdiagnostik                                                      | Mini-Bericht ohne Kausalbehauptung; n=30 vollständige Lehrpaare              | [MC-Test W07](./P0-03_MC-Test_Woche_07.json), 30 Items |
|   W08 |   5 | Streudiagramm; Pearson-r; Regression; Residuum; Extrapolation                  | [L01–L05](./P0-03_ARSnova_Woche_08.json) | [S5-Last/Latenz](./P0-03_Lehrdaten_S5_Last_Latenz.csv): Basis- und Ausreißermodell                                                        | Modellbefund mit Sensitivitäts- und Extrapolationsgrenze                     | [MC-Test W08](./P0-03_MC-Test_Woche_08.json), 30 Items |
|   W09 |   5 | Train/Test; Overfitting; Matrix; Accuracy/Precision/Recall/F1; Coverage        | [L01–L05](./P0-03_ARSnova_Woche_09.json) | [S6-Klassifikation](./P0-03_Lehrdaten_S6_Klassifikation.csv) und [S6-Modellläufe](./P0-03_Lehrdaten_S6_Modelllaeufe.csv): Matrix/Metriken | Modellkarte mit Zielmetrik, Fehlkosten, Nenner und Grenze                    | [MC-Test W09](./P0-03_MC-Test_Woche_09.json), 30 Items |
|   W10 |   4 | Analyseplan; Verfahrenswahl; Interpretation; Quellenstatus; Befund; Evaluation | [L01–L06](./P0-03_ARSnova_Woche_10.json) | alle sieben freigegebenen Lehrdaten; ausgewählter JASP-Kernauszug                                                                         | finaler Befund, Management Summary, Lernplan und internes Abschlussprotokoll | [MC-Test W10](./P0-03_MC-Test_Woche_10.json), 30 Items |

## 3. Wiederkehrender Wochenablauf

### 3.1 Sieben bis drei Tage vor dem ersten Präsenztermin

LD führt für die betreffende Woche die folgenden Schritte in dieser Reihenfolge aus:

1. Paketversion im [Materialindex](./P0-03_Materialpaket_Pilotlauf.md) mit `freigaben.csv` des [P0-02-Datenplans](./P0-02_Datenmanagement_Exportplan.md) abgleichen.
2. Live-JSON in einer nicht produktiven Probesession importieren.
3. Anzahl, Reihenfolge und Fragetypen gegen den ARSnova-Blueprint prüfen.
4. MC-JSON mit dem fixierten Validator und dem strengeren Schema-/Profilcheck aus Abschnitt 7 des [MC-Blueprints](./P0-03_MC-Test_Blueprint_10_Wochen.md) prüfen. Nur exakt 30 von 30 Fragen mit dem Profil `8 leicht/16 mittel/6 schwer`, vier zulässigen kognitiven Werten und zwei bis vier Glossareinträgen dürfen ausgeliefert werden.
5. MC-JSON durch den vorgesehenen Importer einlesen. Randomisierung darf nur Optionen umordnen, keine Fragen entfernen; Erklärungen und `mini_glossary` aller 30 Fragen müssen angezeigt werden.
6. In einer frischen Probesession ausdrücklich `practice` wählen und prüfen: Hinweis „Lernmodus“, kein Timer, Sofortfeedback nach einer Antwort.
7. In der wirksamen Deployment-Konfiguration `show_top5_public=false` prüfen, App neu starten und in einem nicht administrativen Browserprofil bestätigen, dass keine öffentliche Top-5 erscheint.
8. Prüfen, dass die angezeigten 27 Minuten nur als Plan-/Orientierungswert behandelt werden und weder Countdown noch Sitzungsabbruch auslösen.
9. Zeilenzahl, `source_ref` und Sollwerte der benötigten CSV gegen das [Datenwörterbuch](./P0-03_Datenwoerterbuch_Provenienz.md) prüfen.
10. Die Wochen-CSV in JASP 0.98.1 öffnen und den vorgesehenen Pfad aus dem [JASP-Analyseleitfaden](./P0-03_JASP_Analyseleitfaden.md) vollständig ausführen. Warnungen, falsche Skalenniveaus oder abweichende Sollwerte verhindern den Einsatz. Die echte `.jasp`-Datei wird im geschützten Kursbereich erzeugt, nicht im Repository.
11. Die betreffende `P0-03_ARSnova_Woche_NN.json`, eine lesbare Fragenansicht, Papier-Antwortkarten und einen Zählbogen lokal netzunabhängig bereithalten.
12. Prüfen, dass die eingesetzte [Formelsammlung](./P0-03_Formelsammlung_Statistik.md) dieselben Konventionen wie Probeklausur, Lehrdaten und JASP-Leitfaden verwendet.
13. Im Wochenprotokoll nur Paketversion und geplante Datenquellen vortragen; Beobachtungen werden erst nach der Sitzung eingetragen.

### 3.2 Ein Tag vor dem Präsenztermin: Freigabe-Preflight

Der Preflight ist bestanden, wenn jede Zeile mit „ja“ beantwortet ist:

| Bereich               | Prüffrage                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Umfang                | Stimmen UE-Zahl, Livefragenzahl und MC-Zahl mit dem Wochenplan überein?                                                      |
| ARSnova-Zugang        | Öffnen Hostansicht, Teilnehmeransicht, QR-Code und URL in zwei getrennten Browserprofilen?                                   |
| Anonymität            | Ist `anonymousMode=true` und sind eigene Nicknames deaktiviert?                                                              |
| Nicht-Spiel           | Sind Rangliste, Standardtimer, Fragentimer, Teammodus, Musik, Belohnungseffekte und Bonus deaktiviert?                       |
| Fragen                | Sind Reihenfolge, Markdown, Formeln, Bilder, Alternativtexte, Lösungen und Schwierigkeitsangaben korrekt?                    |
| Peer Instruction      | Ist bei den vorgesehenen Lernfragen die zweite Runde vorbereitet und bleibt die erste Verteilung dokumentiert?               |
| MC-Lernmodus          | Ist `practice` gewählt, bestätigt die Oberfläche „kein Timer, Sofortfeedback“, und fehlt jeder Countdown?                    |
| MC-Öffentlichkeit     | Ist in der wirksamen Deployment-Konfiguration `show_top5_public=false`, und fehlt die öffentliche Top-5 im Teilnehmerprofil? |
| MC-Planwert           | Steht `meta.test_duration_minutes=27` nur für den geplanten Arbeitsumfang und löst im Lernmodus keine Begrenzung aus?        |
| MC-Durchläufe         | Werden zwei vollständige Lerndurchläufe nur empfohlen, ohne eine technische Begrenzung zu behaupten?                         |
| Datenschutz           | Sind nur freigegebene LIVE-Aggregate, REPO-Daten oder LEHRDATEN vorgesehen?                                                  |
| JASP                  | Öffnet die Wochen-CSV in JASP 0.98.1 lokal; stimmen Skalenniveaus und Kontrollwerte mit Leitfaden/Datenwörterbuch überein?   |
| Projektion            | Sind Schrift, Kontrast, Diagramme und Formeln aus dem hinteren Raum lesbar?                                                  |
| Alternative Teilnahme | Liegen Antwortkarten und eine mündliche bzw. papierbasierte Alternative bereit?                                              |
| Exportweg             | Ist ausreichend lokaler Speicher vorhanden und ist der Zielordner zugriffsbeschränkt?                                        |
| Offline               | Sind Wochen-JSON, gedruckte Fragenansicht, Zählbogen, Lehrdaten und vorab erzeugter JASP-Referenzoutput lokal verfügbar?     |

Bei einem „nein“ wird die betroffene Funktion nicht improvisiert. LD wechselt für diesen Teil auf den in Abschnitt 7 definierten Fallback.

### 3.3 30 Minuten vor Beginn: technischer Kurzcheck

1. Projektor und Lehrgerät verbinden; keine Session-Codes oder Host-Tokens in Aufzeichnungen einblenden.
2. ARSnova-Probesession mit einer nicht curricularen Testfrage öffnen und wieder schließen.
3. Die freigegebene Wochen-Quizdefinition neu öffnen; keine spontane Bearbeitung am Original.
4. ARSnova-Einstellungen ein letztes Mal gegen die Nicht-Spiel-Baseline prüfen.
5. MC-Test in einem frischen Teilnehmerprofil öffnen und `practice`, fehlenden Timer sowie fehlende öffentliche Top-5 erneut bestätigen.
6. JASP 0.98.1 starten, Wochen-CSV öffnen und `source_ref`, Zeilenzahl, Beobachtungseinheit sowie Kontrollwerte laut Datenwörterbuch prüfen.
7. Wochen-JSON beziehungsweise gedruckte Fragenansicht öffnen und Papier-Zählbogen bereitlegen.
8. Auf der Startfolie Freiwilligkeit, keine Notenwirkung, anonyme Darstellung und alternative Teilnahme sichtbar nennen.

## 4. Sitzungsablauf

### 4.1 Eröffnung des Wochenblocks

LD beginnt jede Woche mit demselben 8-Minuten-Rahmen:

1. Lernziele und erwartetes Lernprodukt nennen.
2. Eine konkrete Nachsteuerung aus der Vorwoche nennen, ohne Personen oder Gruppen zu bewerten.
3. Datenquelle der Woche als LIVE, REPO oder LEHRDATEN kennzeichnen.
4. Bei LIVE-Aktivität erklären: Teilnahme freiwillig, kein Rang, kein Timer, keine Note.
5. Formelsammlung und JASP-Datei öffnen; verwendete Konventionen nennen.

### 4.2 Ablauf jeder Livefrage

Für jede ID des Wochenpools gilt:

1. **Rahmen setzen, 30–60 Sekunden:** Modus als „Diagnose“ oder „Lernen“ nennen; bei SURVEY ausdrücklich „keine richtige Antwort“ sagen.
2. **Lesen, 45–90 Sekunden:** Frage projizieren und vorlesen. LD wartet ohne technischen Timer, bis auch alternative Antworten abgegeben werden konnten.
3. **Abgeben:** Antworten öffnen; Zahl anwesender Personen, verbundener Geräte und abgegebener Antworten nicht gleichsetzen.
4. **Schließen:** Erst schließen, wenn keine erkennbare Barriere fortbesteht. `n_responses` notieren.
5. **Auswerten:** Nur fachliche Verteilung, Nenner und relevante Distraktoren besprechen. Quizpunkte, Antwortzeit und Rang bleiben unbeachtet.
6. **Nachsteuern:** Bei Lernfragen kurze Einzelbegründung, Partneraustausch und zweite Abstimmung einsetzen. Runde 1 und Runde 2 getrennt halten.
7. **Entscheiden:** Unter etwa 67 % korrekten Antworten oder bei vielen sicheren Falschantworten wird das Konzept im Wochenprotokoll markiert. Der Wert ist eine Lehrregel, kein App-Schwellenwert und keine Bestehensgrenze.
8. **Begrenzen:** Zulässige Aussage und eine Überinterpretation nennen.

Bei Multiple Choice darf die Summe der Optionsnennungen über 100 % liegen. Für den Anteil korrekter Antworten werden fachlich korrekte bzw. inkorrekte Abgaben verwendet, nicht die Summe korrekter Optionsklicks.

### 4.3 45-Minuten-Mikromuster

| Phase             | Richtzeit | Handlung                                                                   |
| ----------------- | --------: | -------------------------------------------------------------------------- |
| Retrieval         |    5 Min. | eine für diese UE geplante Livefrage oder ein MC-Befund aus der Vorwoche   |
| Problem/Intuition |    8 Min. | Fall S1–S6 oder betrieblicher Transfer                                     |
| Erklärung/Formel  |   10 Min. | Alltagssprache, Formelsammlung, gemeinsames Beispiel                       |
| Anwendung         |   12 Min. | Einzel-/Partneraufgabe oder JASP-Arbeit                                    |
| Auswertung        |    7 Min. | Fehlerkontrast, JASP-Plausibilität und Grenzen                             |
| Exit              |    3 Min. | mündliches oder anonymes Blitzlicht; kein zusätzliches bewertetes Quizitem |

Die Richtzeiten dürfen fachlich angepasst werden; UE-Zahl, Wochenziele und Livefragenpool bleiben unverändert.

### 4.4 Verbindlicher JASP-Ablauf

Jede Labor- oder Analysephase folgt diesem Pfad:

1. Freigegebene CSV unverändert öffnen und Dateiname sowie `source_ref` anzeigen.
2. Beobachtungseinheit, Zeilenzahl, Skala, fehlende Werte und Kontrollwerte anhand des [Datenwörterbuchs](./P0-03_Datenwoerterbuch_Provenienz.md) kontrollieren.
3. Nur die im Wochenplan vorgesehene Analyse aktivieren.
4. Vor dem Ablesen n, ausgeschlossene Fälle, Einheit und Rundung prüfen.
5. Ergebnis zunächst in Alltagssprache, dann mit Fachbegriff formulieren.
6. Eine Plausibilitätsprüfung durchführen: Größenordnung, Wertebereich, Einheit und gegebenenfalls Handrechnung.
7. JASP-Ausgabe mit Titel, Datenquelle, Version und Kernaussage exportieren.
8. Keine LIVE- und LEHRDATEN in derselben Analyse zusammenführen, sofern sie nicht als getrennte Gruppen sichtbar bleiben.

Besondere Kontrollen:

- W03: JASP-Stichprobenstandardabweichung und ARSnova-deskriptive Standardabweichung nicht verwechseln.
- W04: Confidence ist ordinal; die Stufen 1–2, 3 und 4–5 bilden die vereinbarte Gruppierung.
- W06: Intervallpräzision begründet keine Repräsentativität.
- W07: Nur vollständige Paare; fehlende Runde 2 wird nie mit Runde 1 aufgefüllt.
- W08: S5 ist LEHRDATEN; Regression begründet keine Produktions-SLO und keine Kausalität.
- W09: Classified-Accuracy und Coverage haben unterschiedliche Nenner; dokumentierte Raten werden nicht in erfundene Einzelbeobachtungen umgerechnet.

### 4.5 Sitzungsabschluss

In den letzten 10 Minuten des Wochenblocks:

1. Zwei sichere Konzepte und höchstens zwei offene Fehlvorstellungen zusammenfassen.
2. Lernprodukt speichern bzw. einsammeln, ohne individuelle Note.
3. MC-Test der Woche ankündigen: genau 30 Fragen im Lernmodus ohne Timer mit Sofortfeedback; zwei vollständige Lerndurchläufe werden empfohlen, weitere werden technisch nicht gesperrt.
4. Offene Q&A-Beiträge vor `FINISHED` beantworten oder datenschutzkonform sichern; Freitext wird nicht ungeprüft in Lehrdaten übernommen.
5. Session beenden und unmittelbar den Exportablauf aus Abschnitt 5 durchführen.

## 5. Export- und Datenübergabe

### 5.1 Vor `FINISHED`

1. Prüfen, welche Fragen tatsächlich geöffnet, abgeschlossen oder ausgelassen wurden.
2. Ausgelassene Fragen und ihren Grund im Wochenprotokoll festhalten; sie werden nicht als „falsch“ oder „fehlend“ gewertet.
3. Offene Q&A-Beiträge bearbeiten. Der Sessionabschluss darf nicht als unbeabsichtigtes Löschen offener Lehrfragen dienen.
4. Anzahl der Runden pro Peer-Instruction-Frage notieren.
5. Quizdefinition und Paketversion sichern. Die kanonische Importdatei bleibt unverändert.

### 5.2 Nach `FINISHED`

1. **Ergebnisbericht (PDF)** herunterladen.
2. Unter **Mehr** den **CSV-Export** herunterladen, wenn die Wochenanalyse ihn benötigt.
3. Scheitert der Server-PDF-Export oder wird er wegen paralleler Erzeugung abgewiesen, den Browser-Druckfallback für denselben Bericht verwenden; keine wiederholten parallelen PDF-Jobs starten.
4. Prüfen:
   - nie geöffnete Fragen fehlen fachlich im Bericht;
   - geöffnete Fragen ohne Antwort erscheinen als „Keine Antworten“;
   - ausgelassene Fragen sind aus fachlichen Auswertungen entfernt;
   - sichtbare Fragennummern entsprechen dem Quiz;
   - Aggregationsrunde und Antwortzahlen stimmen mit dem Sitzungsprotokoll.
5. ARSnova-Export nicht als garantierte Liste individueller Rohwerte interpretieren. Numerische Einzelwerte, vollständige Paare oder Regressionsdaten werden nur aus den separat freigegebenen Lehrtabellen verwendet.

### 5.3 Dateinamen

Für Laufzeitartefakte gilt ausschließlich das P0-02-Schema:

`JJJJMMTT_WNN_SYSTEM_HERKUNFT_EREIGNIS_INHALT_STATUS_VNN.EXT`

Zulässige Beispiele sind:

- `20260913_W01_ARSNOVA_LIVE_E01_RESULTS_RAW-RESTRICTED_V01.csv`
- `20260914_W01_JASP_LIVE_E01_ITEM-AGG_WORK-RESTRICTED_V01.jasp`
- `20260915_W01_JASP_LIVE_E01_ITEM-AGG_ANON-APPROVED_V01.csv`

`WNN` ist `W01` bis `W10`; `EREIGNIS` trennt mehrere Läufe. Personennamen, Pseudonyme, Session-Codes, Tokens, IDs und vollständige Fragentexte kommen nie in einen Dateinamen. Browser-Downloads werden unmittelbar nach Registrierung neutral umbenannt.

### 5.4 Bereinigung und Übergabe

1. Originalexport im zugriffsbeschränkten Arbeitsbereich ablegen.
2. Für die Lehre nur benötigte Aggregate übernehmen: redaktionelle Item-ID, Woche, Runde, `n_responses`, `correct_count`, `correct_share`, gegebenenfalls Confidence-Gruppe.
3. Freitexte, technische Tokens, Session-Codes und nicht benötigte Zeitstempel nicht in die Lernanalytik übernehmen.
4. Die redaktionelle MC-Kennung ausschließlich aus dem Dateinamen `P0-03_MC-Test_Woche_NN.json` und der einsbasierten Arrayposition ableiten: Position `p` ergibt `P0-03-MC-WNN-Ipp`. Sie ist kein JSON-Feld; eine appinterne UUID ist keine redaktionelle Kennung.
5. Herkunft `LIVE` und `collection_mode=ONLINE` setzen.
6. Bereinigtes Aggregat gegen Datenregister, Schutzstatus und Feldregeln des [P0-02-Datenplans](./P0-02_Datenmanagement_Exportplan.md) prüfen.
7. DJ übernimmt nur die erforderliche bereinigte Datei in lokales JASP. Original und `.jasp`-Arbeitskopie erhalten den Schutzstatus der sensibelsten Eingabe und werden nach P0-02 fristgerecht gelöscht.

### 5.5 Zwingender MC-Plattform-Löschhandoff

Der Löschvollzug ist für jedes Wochenfenster spätestens **sieben Kalendertage nach dessen Ende** abzuschließen. Ein bloßes Löschen sichtbarer Sessions oder Pseudonyme genügt nicht, weil der fixierte MC-Test-Stand persistente Sitzungssummaries getrennt vorhält.

1. LD übergibt DS und MP unmittelbar nach der Aggregatfreigabe: Wochen-Dateiname, Öffnungs-/Schließzeit des Fensters, betroffene Deployment-Instanz, freigegebene Aggregatdatei und Löschfrist.
2. DS bestätigt, dass ausschließlich das freigegebene, personenfreie Wochenaggregat weiter benötigt wird. Individuelle Antworten, Pseudonyme, Sessionverläufe, Antwortzeiten und Rangdaten werden nicht übernommen.
3. MP wählt genau einen Löschweg:
   - **Geteilte SQLite-Datenbank:** Vor der Löschung die betroffenen Sitzungskennungen anhand des Wochen-Dateinamens sowohl aus aktiven Sessions als auch aus `test_session_summaries` bestimmen. Alle zu diesen Kennungen gehörenden Antworten, Feedback- und Lesezeicheneinträge sowie die aktiven Sessions und ausdrücklich auch `test_session_summaries` löschen. Zugehörige Heartbeats, Präferenzen und Nutzerzeilen ebenfalls löschen, sofern sie keinem zulässigen anderen Zweck dienen. Transaktion, abhängige Tabellen und mögliche Sicherungen/Snapshots sind einzubeziehen.
   - **Isolierte Pilotdatenbank:** App und alle Writer stoppen und `db/mc_test_data.db`, `db/mc_test_data.db-wal` sowie `db/mc_test_data.db-shm` gemeinsam verwerfen. Sicherungen, Snapshots, Volumes und temporäre Kopien derselben isolierten Datenbank werden ebenfalls verworfen.
4. MP startet die bereinigte Instanz neu. DS prüft anschließend die Abwesenheit:
   - Für jede der zehn Wochen-Dateien und jede zuvor ermittelte Sitzungskennung liefern aktive Sessions, Antworten, Feedback, Lesezeichen und `test_session_summaries` jeweils null Treffer.
   - Teilnehmer- und Administrationsansicht zeigen weder Pilot-Historie noch öffentliche Top-5.
   - Beim isolierten Löschweg sind die alte SQLite-Dateifamilie, Sicherungen, Snapshots, Volumes und Exporte mit Pilot-Rohdaten abwesend. Falls der Neustart eine neue leere Hauptdatei oder neue WAL/SHM-Dateien erzeugt, enthalten auch diese für alle Wochen-Dateien null Treffer.
5. MP protokolliert Zeitpunkt, Deployment, Löschweg und technische Prüfergebnisse; DS zeichnet Frist und Abwesenheitsprüfung ab. Das Protokoll enthält keine Pilot-Rohdaten und wird nach P0-02 geschützt aufbewahrt.
6. Schlägt eine Abwesenheitsprüfung fehl, sperrt MP die Instanz für den Pilotbetrieb, wiederholt den Löschvollzug und eskaliert an DS und MV. Eine Woche gilt bis zum bestandenen Nachweis nicht als abgeschlossen.

## 6. Asynchroner MC-Test und Nachsteuerung

### 6.1 Auslieferung

- Veröffentlichung unmittelbar nach dem letzten Präsenzblock der Woche.
- Bearbeitungsfenster bis 18:00 Uhr am Kalendertag vor dem nächsten Wochenblock.
- Genau 30 Fragen; kein adaptives Ausblenden und keine Zufallsstichprobe aus einem größeren Pool.
- Verbindlich `practice`: kein Timer, Sofortfeedback mit `explanation` und `mini_glossary` nach jeder Antwort.
- `meta.test_duration_minutes=27` wird ausschließlich als geplanter Arbeitsumfang kommuniziert und aktiviert im Lernmodus keinen Countdown.
- Zwei vollständige Lerndurchläufe werden empfohlen: Diagnose und korrigierender Abruf. Die App begrenzt die Zahl der Sessions nicht; weitere Durchläufe bleiben möglich.
- Deployment verbindlich mit `show_top5_public=false`; keine öffentliche Top-5, Rangliste oder Notenwirkung.
- Optionen dürfen randomisiert werden, sofern Bezeichnungen wie „alle oben genannten“ nicht verwendet werden und die Lösung semantisch stabil bleibt.

### 6.2 Lernanalytik

Ausgewertet werden ausschließlich aggregiert:

- Zahl begonnener und abgeschlossener Lernsessions im festgelegten Wochenfenster,
- Lösungsquote pro abgeleiteter redaktioneller Kennung,
- Auswahlquote jedes Distraktors,
- Auslassungsquote,
- `topic`, `concept`, `weight` und `cognitive_level` aus dem Fragen-JSON,
- redaktionelle Lernziel- und Retrieval-Zuordnungen aus dem getrennten Freigabeprotokoll.

Antwortzeit ist höchstens ein technisches Nutzungssignal und kein Kompetenzmaß. Pseudonyme und individuelle Verläufe werden nicht in die Lehrauswertung übernommen. Einzelne Studierende werden nicht gerankt, kontaktiert, sanktioniert oder anhand von ARSnova-, MC-Test- oder sonstigen LIVE-Daten leistungsbewertet.

### 6.3 Entscheidung vor der Folgewoche

QE und LD wählen anhand des freigegebenen Wochenaggregats:

1. höchstens zwei Konzepte unter etwa 67 % aggregierten korrekten Antworten,
2. höchstens eine häufige sichere Fehlvorstellung aus der Live-Sitzung,
3. ein länger zurückliegendes Konzept für verteilte Wiederholung.

Für jedes gewählte Konzept wird eine konkrete Maßnahme protokolliert: neues Beispiel, Worked Example, Peer Instruction oder Formelsammlungsroutine. Es werden keine zusätzlichen MC-Items in den abgeschlossenen 30er-Satz eingefügt; die Wiederholung erfolgt in der Blueprint-Verteilung der Folgewoche.

## 7. Offline- und Störungsfallback

### 7.1 Umschaltkriterien

LD wechselt ohne weitere Fehlersuche auf Fallback, wenn mindestens eines gilt:

- ARSnova ist zum geplanten Fragezeitpunkt nicht erreichbar;
- Hostzugang, Session oder Teilnehmerbeitritt funktioniert nach einem kontrollierten Neuversuch nicht;
- `anonymousMode` lässt sich nicht sicher bestätigen;
- Projektion oder Netz verhindert gleichwertige Teilnahme;
- JASP oder die Wochen-CSV lässt sich lokal nicht öffnen;
- der Export ist nach Sitzungsende nicht verfügbar.

### 7.2 ARSnova-Ausfall

1. Frage aus dem lokal gespeicherten Wochen-JSON beziehungsweise der vorab gedruckten Fragenansicht projizieren, vorlesen oder austeilen.
2. Antworten mit A–D-/Mehrfachwahlkarten oder anonymen Papierzetteln erfassen. Niemand muss sich öffentlich per Handzeichen positionieren.
3. Nur aggregierte Optionszahlen auf dem Zählbogen festhalten.
4. Bei Lernfragen dieselbe Begründungs- und Zweitrundenlogik durchführen; R1 und R2 getrennt zählen.
5. Als `source_kind=LIVE` und `collection_mode=OFFLINE` erfassen. Online- und Offline-Läufe nicht ohne Kennzeichnung zusammenrechnen.
6. Antworten später nicht stellvertretend in ARSnova eingeben. Ein Offline-Aggregat wird nie als ARSnova-Export bezeichnet.

Für eine anonyme numerische Schätzung werden unbeschriftete Zettel verwendet. Benötigt die Lehre Einzelwerte, werden diese freiwillig in eine temporäre lokale Tabelle übertragen, sofort in JASP aggregiert und nach dem Datenplan gelöscht. Ist dieser sichere Ablauf nicht möglich, wird die vorbereitete S1-Lehrtabelle verwendet und als `LEHRDATEN` bezeichnet.

### 7.3 Geräte- oder Projektionsausfall

- Teilnehmende arbeiten in freiwilligen Zweiergruppen oder mit Papier.
- Frage, Optionen, Formel und Diagramm werden vorgelesen; Farbe ist nie alleiniger Informationsträger.
- Ergebnisse werden nicht einzelnen Personen zugeordnet.
- Die Zahl der Personen, Gruppen und Antworten wird getrennt notiert.

### 7.4 JASP-Ausfall

1. Analyse nicht spontan in einer anderen Software als verbindliches Ergebnis neu erzeugen.
2. Den im Preflight mit JASP 0.98.1 erzeugten, gegen die Sollwerte geprüften und lokal gespeicherten Wochen-Referenzoutput für Interpretation und Plausibilitätsarbeit verwenden.
3. Handrechnung nur dort durchführen, wo Formelsammlung und Wochenziel sie vorsehen.
4. Nach der Sitzung die Analyse in JASP reproduzieren und erst dann eine Zahl in Lehrendenprotokoll oder Musterlösung übernehmen.
5. Bleibt JASP bis zur Folgewoche nicht funktionsfähig, eskaliert LD an MV; der betroffene Analyseblock wird mit LEHRDATEN und Referenzoutput wiederholt, nicht durch eine andere Analyseumgebung ersetzt.

### 7.5 Exportausfall

- Sitzungsprotokoll, sichtbare Aggregate und Bildschirm-/Druckbericht sichern, sofern datenschutzkonform.
- Keine fehlenden Einzelwerte, Paare oder Runden rekonstruieren.
- Im Wochenprotokoll „Export nicht verfügbar“ und die tatsächlich vorhandene Evidenz nennen.
- Für die Lehraufgabe auf die freigegebenen LEHRDATEN wechseln.
- Fehlende LIVE-Daten werden nicht durch erfundene Werte ergänzt und nicht als Null kodiert.

## 8. Abweichungs- und Stop-Regeln

| Beobachtung                                       | Sofortmaßnahme                                                               | Datennutzung                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `anonymousMode=false` vor Start                   | Session nicht öffnen; korrekte Datei neu importieren oder Offline-Fallback   | keine Daten                                                                                 |
| `anonymousMode=false` erst nach Antworten erkannt | Session stoppen; keine Namen projizieren; neue anonyme Session oder Fallback | betroffenen Lauf löschen, nicht analysieren                                                 |
| Rangliste/Timer/Bonus versehentlich aktiv         | Funktion stoppen/deaktivieren; Abweichung protokollieren                     | Fachantworten nur nutzen, wenn Freiwilligkeit/Anonymität intakt; Score/Zeit/Bonus verwerfen |
| MC-Test nicht im Modus `practice`                 | Session nicht freigeben; Lernmodus wählen und mit frischem Profil neu prüfen | keine Daten aus dem Fehlmodus in Lehrauswertung übernehmen                                  |
| Öffentliche MC-Top-5 sichtbar                     | Instanz sperren; `show_top5_public=false`; Neustart und Gegenprüfung         | Rangdaten verwerfen; Löschumfang in den Handoff aufnehmen                                   |
| falsche Lösung hinterlegt                         | Frage schließen, Fehler erklären, Item als ungültig markieren                | nicht in Lösungsquote oder Evaluation                                                       |
| Frage ausgelassen                                 | Grund protokollieren                                                         | nicht als falsch oder fehlend zählen                                                        |
| zwei Sessions derselben Woche                     | `run-01`/`run-02` getrennt halten                                            | nur mit sichtbarer Laufvariable vergleichen/aggregieren                                     |
| kleine Confidence-Zelle unter fünf                | keine Detailzahl nennen                                                      | zusammenfassen oder unterdrücken, nie als Null deuten                                       |
| Runde 2 mit Ausfällen                             | R2 nur aus tatsächlichen R2-Antworten                                        | keine Auffüllung aus R1                                                                     |
| unvollständige Paare                              | Fall aus gepaarter Lehrrechnung ausschließen                                 | `n_round1`, `n_round2`, `n_pairs` getrennt berichten                                        |
| MC-Datei verletzt Schema, `8/16/6` oder 30 Fragen | Veröffentlichung stoppen beziehungsweise Fenster nach Korrektur neu starten  | Woche erst nach bestandenem vollständigem Release-Gate auswerten                            |
| MC-Löschfrist oder Abwesenheitsprüfung verfehlt   | Instanz sperren und an DS sowie MV eskalieren                                | keine weitere Pilotwoche auf der betroffenen Instanz                                        |

## 9. Wochenabschluss und Pilotabschluss

### 9.1 Bis zum nächsten Werktag

LD bestätigt:

- Livefragenzahl und durchgeführte IDs,
- Online-/Offline-Modus und Läufe,
- Exportstatus,
- zwei sichere Konzepte,
- zwei Fehlvorstellungen,
- konkrete Maßnahme für die Folgewoche,
- freigegebene Datenquellen,
- JASP-Dateiversion,
- Frist, Umfang und Verantwortliche des MC-Löschhandoffs,
- notwendige weitere Löschung oder Sperrung.

### 9.2 Nach Woche 10

1. W10-MC-Test regulär mit 30 Fragen abschließen.
2. Finalen Statistikbefund anhand der [Vorlage und Rubrik](./P0-03_Statistikbefund_Vorlage_Rubrik.md) ausschließlich formativ rückmelden; die Untersuchungsfrage bleibt auf die statistische Lehranalyse begrenzt. Eine davon getrennte Klausur darf ausschließlich freigegebene LEHRDATEN verwenden.
3. W10-SURVEY und die vorab festgelegten Modulindikatoren aus [P0-01](./P0-01_Kerncurriculum_Lernzielmatrix.md) nach den Aggregations- und Schutzregeln von [P0-02](./P0-02_Datenmanagement_Exportplan.md) intern auswerten.
4. Keine individuellen Vorher-Nachher-Verläufe konstruieren; W01/W10-Blitzlichter nur deskriptiv auf Modulebene vergleichen.
5. Den W10-Löschhandoff binnen sieben Kalendertagen nach Ende des Bearbeitungsfensters abschließen; `test_session_summaries` beziehungsweise die isolierte Datenbank samt WAL/SHM und die Abwesenheitsprüfung sind zwingend.
6. Arbeitskopien, Session-Exporte und temporäre Schätzwerte gemäß Datenplan löschen; Löschung protokollieren.
7. Interne Abschlussnotiz auf Durchführung, curriculare Passung, sichtbare Lernhürden, Materialfehler und Änderungen für den nächsten Lehrdurchlauf beschränken.
8. Aus ARSnova-, MC-Test- oder sonstigen LIVE-Daten keine individuelle Leistungsbewertung, forschungsbezogene Fragestellung, Effektivitätsbehauptung, Publikation, externe Datenweitergabe oder Nachnutzung außerhalb von Lehre und interner Modulevaluation ableiten.
