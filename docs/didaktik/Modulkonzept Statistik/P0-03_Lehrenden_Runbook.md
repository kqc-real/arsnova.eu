# P0-03 – Lehrenden-Runbook

**Version:** 5.0.0 · **Stand:** 14.09.2026 · **Status:** verbindlicher Betriebsablauf für den Pilot

**Kanonischer Index:** [P0-03_Materialpaket_Pilotlauf.md](./P0-03_Materialpaket_Pilotlauf.md)

**MC-Test-Referenz:** [fixierter Quellstand `b6b159555e8a228dad73dd75fd66c154a1088e28`](https://github.com/kqc-real/streamlit/tree/b6b159555e8a228dad73dd75fd66c154a1088e28) · [Live-Instanz](https://mc-test.streamlit.app)

**Kürzel vorab:** **BWL/WI** steht für Betriebswirtschaftslehre/Wirtschaftsinformatik, **W01–W10** bezeichnet die Kurswochen, **LE** eine 90-minütige Vorlesungs- beziehungsweise Lerneinheit aus zwei **UE** à 45 Minuten, **L01–L10** die Livefragen einer Woche, **S1–S6** die Fallstudienstränge, **MZ** die Modulziele, **LI** die Leistungsindikatoren, **MC** Multiple Choice und **LIVE/REPO/LEHRDATEN** die drei Datenherkünfte. Die Rollenkürzel stehen vor ihrer operativen Verwendung in Abschnitt 1.2.

## 1. Betriebsauftrag

Dieses Runbook macht den zehnwöchigen Pilot des Moduls „Angewandte Statistik“ ohne zusätzliche Ablaufentscheidung durchführbar. Es regelt Vorbereitung, Präsenzbetrieb, JASP-Analyse, Exporte, den wöchentlichen MC-Test in Präsenz, Spaced-Repetition-Nachläufe, Nachsteuerung und Offline-Fallback.

### 1.1 Harte Leitplanken

1. **Präsenzumfang:** 24 LE zu je 2 UE; W01, W02, W04, W06, W08 und W10 je 2 LE/4 UE, W03, W05, W07 und W09 je 3 LE/6 UE; Summe 48 UE à 45 Minuten.
2. **Livefragen:** Pro Wochenblock genau die zehn im [ARSnova-Blueprint](./P0-03_ARSnova_Livequiz_Blueprint_10_Wochen.md) und in der jeweiligen `P0-03_ARSnova_Woche_NN.json` genannten Fragen. Jede Datei verwendet alle zehn unterstützten Fragetypen genau einmal und ausschließlich die Schwierigkeitsstufen `MEDIUM` und `HARD`. Wird eine Woche auf mehrere Termine verteilt, wird derselbe Wochenpool verteilt und nicht pro Termin vervielfacht.
3. **Formatives Gamification-Profil:** `anonymousMode=false` mit automatisch vergebenen Pseudonymen, `allowCustomNicknames=false`, `nicknameTheme=KINDERGARTEN`, `showLeaderboard=true`, `defaultTimer=60`, `timerScaleByDifficulty=true`, `enableTimerAccommodation=true`, Sound-/Belohnungs-/Motivations-/Emoji-Effekte aktiv, `teamMode=true`, `teamCount=4`, die Teambezeichnungen `Apfel :apple:`, `Birne :pear:`, `Banane :banana:` und `Apfelsine :orange:`, `bonusTokenCount=3`, Lesephase aktiv. Rang, Zeit, Teamstand und Bonus haben keine Noten- oder Kompetenzfunktion.
4. **MC-Test:** In der letzten UE jeder Woche wird genau eine Datei mit exakt 30 Fragen im Modus `practice` ohne technischen Timer und mit Sofortfeedback bearbeitet. Danach werden Ergebnisse, Lösungen und häufige Distraktoren besprochen. `show_top5_public=false` bleibt verbindlich. Ein zweiter Durchlauf folgt als Spaced Repetition nach zwei bis drei Tagen.
5. **Analysesoftware:** Jede softwaregestützte Analyse und jede Zahl in einer Musterlösung wird in JASP 0.98.1 reproduziert. Es gibt keine institutionell bereitgestellte JASP-Umgebung. Studierende installieren JASP auf kompatiblen Geräten; ohne kompatibles Gerät arbeiten sie gleichwertig in Partner-/Kleingruppen, anhand der Lehrdemonstration und mit vorbereiteten Ausgaben. Eine Tabellenkalkulation dient höchstens der Sichtprüfung oder datenschutzkonformen Bereinigung.
6. **Zweck:** ARSnova-, MC-Test- und sonstige LIVE-Daten dienen Lehre und interner Modulevaluation. Sie dürfen nicht für individuelle Leistungsbewertung, Forschung, Publikation oder nachträgliche Umwidmung verwendet werden. Eine separate Klausur mit ausschließlich freigegebenen LEHRDATEN bleibt zulässig.
7. **Freiwilligkeit:** Live-Abstimmung, Confidence und Feedback sind freiwillig und ohne Notennachteil. Eine gleichwertige Teilnahme ohne persönliches Gerät ist möglich.
8. **MC-Arbeitsumfang:** `meta.test_duration_minutes=32` ist der Richtwert für den Präsenzdurchlauf, kein technischer Countdown. Jede Datei enthält 12 mittlere und 18 schwere Items, aber keine leichten Items. Der zweite vollständige Durchlauf erfolgt nach zwei bis drei Tagen; Kernkonzepte werden nach zwei bis vier Wochen erneut eingeplant. Die App erzwingt weder Versuchsanzahl noch Bearbeitungszeit.
9. **Mathematischer Zugang:** Die [W01-Mathematikdiagnostik](./P0-03_Mathematikdiagnostik_Brueckenpfade.md) wird in den sieben Tagen vor der ersten Präsenz-UE asynchron bearbeitet, ist unbenotet und führt ausschließlich zu Brückenpfaden innerhalb des bestehenden Workloads.
10. **Gleichwertiger Transfer und Zugang:** Die [BWL-/WI-Transfermatrix](./P0-03_Transfermatrix_BWL_WI.md) und die [Material-/A11y-Matrix](./P0-03_Barrierefreiheit_Material_und_Probe.md) sind verbindliche Bestandteile der Vorbereitung.

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

- **2-LE-Woche:** zwei Termine oder Blöcke à 90 Minuten = 4 UE.
- **3-LE-Woche:** drei Termine oder Blöcke à 90 Minuten = 6 UE.
- W01, W02, W04, W06, W08 und W10 haben je 2 LE; W03, W05, W07 und W09 je 3 LE.
- Pausen sind keine UE. Bei mehreren Präsenztagen bleiben Reihenfolge, UE-Nummern und Live-IDs erhalten.
- Die letzte UE jeder Woche ist der gemeinsame MC-Test-Abschluss; die erste UE derselben LE schließt Fachinhalt und JASP-/Transferertrag ab.

| Woche | LE / UE      | Präsenzauftrag                                                                                  | Livefragen                                       | Verbindliche JASP-/Datengrundlage                                                                                                         | Letzte UE und Spaced-Repetition-Nachlauf                                                                                                     |
| ----: | ------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
|   W01 | 2 / UE 1–4   | Diagnose-Debrief; statistischer Prozess; Beobachtungseinheit; Stichprobe; Skalen; Datenqualität | [L01–L10](./ARSnova/P0-03_ARSnova_Woche_01.json) | [S1-Servicezeiten](./P0-03_Lehrdaten_S1_Servicezeiten.csv): Import, Zeile/Variable und Messniveau                                         | UE 4: [MC W01](./MC-Test/P0-03_MC-Test_Woche_01.json) + Lösungsklärung; vor UE 1 Mathematikdiagnostik, Wiederholung nach 2–3 Tagen           |
|   W02 | 2 / UE 5–8   | Häufigkeiten; Nenner; Diagramme; Mittelwert/Median; Robustheit                                  | [L01–L10](./ARSnova/P0-03_ARSnova_Woche_02.json) | [S1-Servicezeiten](./P0-03_Lehrdaten_S1_Servicezeiten.csv): Deskriptivübersicht und Histogramm                                            | UE 8: [MC W02](./MC-Test/P0-03_MC-Test_Woche_02.json) + Ergebnis-/Lösungsbesprechung; Wiederholung nach 2–3 Tagen                            |
|   W03 | 3 / UE 9–14  | Streuung; `n`/`n−1`; Quartile; Boxplot; Ausreißer; Latenzquantile                               | [L01–L10](./ARSnova/P0-03_ARSnova_Woche_03.json) | [S1-Servicezeiten](./P0-03_Lehrdaten_S1_Servicezeiten.csv): Streuung/Boxplot; REPO-Latenzwerte nur aus dem Livequiz lesen                 | UE 14: [MC W03](./MC-Test/P0-03_MC-Test_Woche_03.json) + Ergebnis-/Lösungsbesprechung; Wiederholung nach 2–3 Tagen                           |
|   W04 | 2 / UE 15–18 | Münzwurf; Multiplikation; bedingte Wahrscheinlichkeit; Confidence; Basisrate                    | [L01–L10](./ARSnova/P0-03_ARSnova_Woche_04.json) | [S2-Confidence](./P0-03_Lehrdaten_S2_Confidence.csv): 2×3-/2×5-Kontingenztafel                                                            | UE 18: [MC W04](./MC-Test/P0-03_MC-Test_Woche_04.json) + Ergebnis-/Lösungsbesprechung; Wiederholung nach 2–3 Tagen                           |
|   W05 | 3 / UE 19–24 | Zufallsvariablen; Binomial-/Normalmodell; Stichprobenvariabilität                               | [L01–L10](./ARSnova/P0-03_ARSnova_Woche_05.json) | [S6-Modellläufe](./P0-03_Lehrdaten_S6_Modelllaeufe.csv): Verteilungen der zwölf festen Lehrresamples getrennt nach Lehrmodell             | UE 24: [MC W05](./MC-Test/P0-03_MC-Test_Woche_05.json) + Ergebnis-/Lösungsbesprechung; Wiederholung nach 2–3 Tagen                           |
|   W06 | 2 / UE 25–28 | Punkt-/Intervallschätzung; Intervallbreite; Wilson; Wald                                        | [L01–L10](./ARSnova/P0-03_ARSnova_Woche_06.json) | [S3-Q&A-Ranking](./P0-03_Lehrdaten_S3_QA_Ranking.csv) und [S1-Servicezeiten](./P0-03_Lehrdaten_S1_Servicezeiten.csv): Intervalle/Rangmaße | UE 28: [MC W06](./MC-Test/P0-03_MC-Test_Woche_06.json) + Ergebnis-/Lösungsbesprechung; Wiederholung nach 2–3 Tagen                           |
|   W07 | 3 / UE 29–34 | Hypothesen; p-Wert; Fehlerarten; Relevanz; gepaarter Vergleich                                  | [L01–L10](./ARSnova/P0-03_ARSnova_Woche_07.json) | [S1-Paare](./P0-03_Lehrdaten_S1_Paare.csv): gepaarter t-Test und Differenzdiagnostik                                                      | UE 34: [MC W07](./MC-Test/P0-03_MC-Test_Woche_07.json) + Ergebnis-/Lösungsbesprechung; Wiederholung nach 2–3 Tagen                           |
|   W08 | 2 / UE 35–38 | Streudiagramm; Pearson-r; Regression; Residuum; Extrapolation                                   | [L01–L10](./ARSnova/P0-03_ARSnova_Woche_08.json) | [S5-Last/Latenz](./P0-03_Lehrdaten_S5_Last_Latenz.csv): Basis- und Ausreißermodell                                                        | UE 38: [MC W08](./MC-Test/P0-03_MC-Test_Woche_08.json) + Ergebnis-/Lösungsbesprechung; Wiederholung nach 2–3 Tagen                           |
|   W09 | 3 / UE 39–44 | Train/Test; Overfitting; Matrix; Accuracy/Precision/Recall/F1; Coverage                         | [L01–L10](./ARSnova/P0-03_ARSnova_Woche_09.json) | [S6-Klassifikation](./P0-03_Lehrdaten_S6_Klassifikation.csv) und [S6-Modellläufe](./P0-03_Lehrdaten_S6_Modelllaeufe.csv): Matrix/Metriken | UE 44: [MC W09](./MC-Test/P0-03_MC-Test_Woche_09.json) + Ergebnis-/Lösungsbesprechung; Wiederholung nach 2–3 Tagen                           |
|   W10 | 2 / UE 45–48 | Qualitätscheck; Peer Review; Klausurtraining; Transfer; Evaluation                              | [L01–L10](./ARSnova/P0-03_ARSnova_Woche_10.json) | JASP-Kernauszug des seit W03 gewählten S1-/S5-/S6-Strangs                                                                                 | UE 48: [MC W10](./MC-Test/P0-03_MC-Test_Woche_10.json) + Ergebnis-/Lösungsbesprechung; gezielte Wiederholung anhand persönlicher Fehlerliste |

Ab W02 enthält jeder neue MC-Satz zusätzlich ältere Inhalte nach dem Spaced-Repetition-Plan. Der zweite Durchlauf derselben Datei und die spätere Wiederaufnahme in neuen Wochen-Dateien sind getrennte Wiederholungsstufen.

### 2.1 Verbindliche Fallstudien-Timeline

S1, S5 und S6 sind die analysefähigen Abschlussstränge. S2–S4 bleiben gemeinsame Lehr- und Transferfälle. Eine Gruppe lernt in W01 alle drei Abschlussstränge kennen, meldet in W02 nur eine unverbindliche Präferenz und hält ihre verbindliche Wahl in W03 in der [Befundvorlage](./P0-03_Statistikbefund_Vorlage_Rubrik.md) fest. Der Analyseplan liegt in W06 als erste Arbeitsversion vor; die JASP-Kernanalyse und der vollständige Befundentwurf sind bis Ende W09 abgeschlossen. W10 beginnt keine neue Analyse.

### 2.2 Minutenplan für Woche 10

|  UE | Auftrag                            | Verbindliche Minutenverteilung                                                                    |
| --: | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
|  45 | Qualitätscheck                     | 5 Einstieg, 25 Quellen-/Verfahrens-/JASP-Prüfung, 10 priorisierte Korrektur, 2 Sicherung, 3 Flex  |
|  46 | Befund und Peer Review             | 5 Kriterien, 10 Peer-Lesen, 20 Überarbeitung, 7 Management Summary, 3 Flex                        |
|  47 | Probeklausur, Transfer, Evaluation | 5 Rahmen, 22 individuelle Bearbeitung, 8 Lösungsvergleich, 7 Transfer/Modulevaluation, 3 Flex     |
|  48 | MC-Test und Wochenabschluss        | 32 MC W10 im Modus `practice`, 10 Ergebnis-/Lösungsbesprechung, 3 individueller Wiederholungsplan |

Die vollständige 90-Minuten-Probeklausur bleibt Selbststudium beziehungsweise ein separater Klausurtrainingstermin innerhalb der ausgewiesenen 15 Stunden Klausurvorbereitung. Sie wird nicht zusätzlich in UE 47 hineingedrängt.

## 3. Wiederkehrender Wochenablauf

### 3.1 Sieben bis drei Tage vor dem ersten Präsenztermin

LD führt für die betreffende Woche die folgenden Schritte in dieser Reihenfolge aus:

1. Paketversion im [Materialindex](./P0-03_Materialpaket_Pilotlauf.md) mit `freigaben.csv` des [P0-02-Datenplans](./P0-02_Datenmanagement_Exportplan.md) abgleichen.
2. Live-JSON in einer nicht produktiven Probesession importieren.
3. Anzahl, Reihenfolge, Fragetypen und das formative Gamification-Profil gegen den ARSnova-Blueprint prüfen.
4. MC-JSON mit dem fixierten Validator und dem strengeren Schema-/Profilcheck aus Abschnitt 7 des [MC-Blueprints](./P0-03_MC-Test_Blueprint_10_Wochen.md) prüfen. Nur exakt 30 von 30 Fragen mit dem Profil `0 leicht/12 mittel/18 schwer`, den drei zulässigen kognitiven Werten `Verständnis`, `Anwendung` und `Analyse` sowie zwei bis vier Glossareinträgen dürfen ausgeliefert werden.
5. MC-JSON durch den vorgesehenen Importer einlesen. Randomisierung darf nur Optionen umordnen, keine Fragen entfernen; Erklärungen und `mini_glossary` aller 30 Fragen müssen angezeigt werden.
6. In einer frischen Probesession ausdrücklich `practice` wählen und prüfen: Hinweis „Lernmodus“, kein Timer, Sofortfeedback nach einer Antwort.
7. In der wirksamen Deployment-Konfiguration `show_top5_public=false` prüfen, App neu starten und in einem nicht administrativen Browserprofil bestätigen, dass keine öffentliche Top-5 erscheint.
8. Prüfen, dass die angezeigten 32 Minuten als organisatorischer Richtwert für den Präsenzdurchlauf behandelt werden und weder Countdown noch Sitzungsabbruch auslösen; die anschließenden 10 Minuten Lösungsbesprechung vorbereiten.
9. Zeilenzahl, `source_ref` und Sollwerte der benötigten CSV gegen das [Datenwörterbuch](./P0-03_Datenwoerterbuch_Provenienz.md) prüfen.
10. Die Wochen-CSV in JASP 0.98.1 öffnen und den vorgesehenen Pfad aus dem [JASP-Analyseleitfaden](./P0-03_JASP_Analyseleitfaden.md) vollständig ausführen. Warnungen, falsche Skalenniveaus oder abweichende Sollwerte verhindern den Einsatz. Die echte `.jasp`-Datei wird im geschützten Kursbereich erzeugt, nicht im Repository.
11. Die betreffende `P0-03_ARSnova_Woche_NN.json`, eine lesbare Fragenansicht, Papier-Antwortkarten und einen Zählbogen lokal netzunabhängig bereithalten.
12. Prüfen, dass die eingesetzte [Formelsammlung](./P0-03_Formelsammlung_Statistik.md) dieselben Konventionen wie Probeklausur, Lehrdaten und JASP-Leitfaden verwendet.
13. Für W01 Diagnosebogen, Lösungen und sechs Brückenpfade sieben Tage vor der ersten Präsenz-UE bereitstellen; Abschluss bis zum Vortag kommunizieren. Es werden keine individuellen Diagnoseergebnisse erfasst.
14. Die wochenrelevante BWL-/Management- und WI-/Informatik-Variante der [Transfermatrix](./P0-03_Transfermatrix_BWL_WI.md) auf gleiche Zahlen und Kernhandlung prüfen.
15. Die einschlägigen Punkte der [Material-/A11y-Probe](./P0-03_Barrierefreiheit_Material_und_Probe.md) durchführen und Abweichungen vor Freigabe schließen.
16. Im Wochenprotokoll nur Paketversion und geplante Datenquellen vortragen; Beobachtungen werden erst nach der Sitzung eingetragen.

### 3.2 Ein Tag vor dem Präsenztermin: Freigabe-Preflight

Der Preflight ist bestanden, wenn jede Zeile mit „ja“ beantwortet ist:

| Bereich               | Prüffrage                                                                                                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Umfang                | Stimmen UE-Zahl, Livefragenzahl und MC-Zahl mit dem Wochenplan überein?                                                                                                                                                                               |
| ARSnova-Zugang        | Öffnen Hostansicht, Teilnehmeransicht, QR-Code und URL in zwei getrennten Browserprofilen?                                                                                                                                                            |
| Pseudonyme            | Ist `anonymousMode=false`, sind eigene Nicknames deaktiviert und werden mit `nicknameTheme=KINDERGARTEN` automatisch Themenpseudonyme statt Klarnamen vergeben?                                                                                       |
| Gamification          | Sind Rangliste, 60-Sekunden-Standardtimer mit Schwierigkeitsskalierung und Zeitunterstützung, vier Teams mit den vereinbarten Shortcut-Icons, drei Boni sowie Sound-, Belohnungs-, Motivations- und Emoji-Effekte aktiv; bleibt die Lesephase aktiv?  |
| Fragen                | Enthält die Datei zehn Fragen und jeden unterstützten Fragetyp genau einmal; sind Reihenfolge, Markdown, Formeln, Alternativtexte, Lösungen, mindestens mittlere Schwierigkeit, Distraktorparallelität und variierte statische Lösungsmuster korrekt? |
| Kurztextbewertung     | Akzeptieren die gepflegten Positivbeispiele alle vorgesehenen Schreibformen und erhalten fachlich falsche Zahlen, Einheiten oder Gegenbegriffe in dokumentierten Negativbeispielen sicher null Punkte?                                                |
| Mathematikdiagnostik  | Sind in W01 identische Papier-/Digitalfassungen, Selbstkontrolle und Brückenpfade ohne individuelle Ergebnisspeicherung vorbereitet?                                                                                                                  |
| Transferpaar          | Bleiben beim eingesetzten BWL-/WI-Paar Zahlen, Kernhandlung, Schwierigkeit und Erwartungshorizont isomorph?                                                                                                                                           |
| Peer Instruction      | Ist bei den vorgesehenen Lernfragen die zweite Runde vorbereitet und bleibt die erste Verteilung dokumentiert?                                                                                                                                        |
| MC-Lernmodus          | Ist `practice` gewählt, bestätigt die Oberfläche „kein Timer, Sofortfeedback“, und fehlt jeder Countdown?                                                                                                                                             |
| MC-Öffentlichkeit     | Ist in der wirksamen Deployment-Konfiguration `show_top5_public=false`, und fehlt die öffentliche Top-5 im Teilnehmerprofil?                                                                                                                          |
| MC-Itemqualität       | Sind alle vier Lösungspositionen sieben- oder achtmal vertreten, bleiben Serien kurz und Folgen nicht periodisch, und sind Erklärungen auch nach einer Optionsumordnung ohne Positionsverweis verständlich?                                           |
| MC-Präsenzabschluss   | Sind in der letzten UE 32 Minuten für 30 Fragen, 10 Minuten für Ergebnis-/Lösungsbesprechung und 3 Minuten für den Wiederholungsauftrag reserviert?                                                                                                   |
| MC-Planwert           | Steht `meta.test_duration_minutes=32` für den organisatorischen Präsenzrichtwert und löst im Lernmodus keine technische Begrenzung aus?                                                                                                               |
| MC-Spaced-Repetition  | Ist der zweite vollständige Durchlauf nach zwei bis drei Tagen kommuniziert und die spätere Wiederaufnahme nach zwei bis vier Wochen geplant?                                                                                                         |
| Datenschutz           | Sind nur freigegebene LIVE-Aggregate, REPO-Daten oder LEHRDATEN vorgesehen?                                                                                                                                                                           |
| JASP                  | Öffnet die Wochen-CSV in JASP 0.98.1 lokal; stimmen Skalenniveaus und Kontrollwerte mit Leitfaden/Datenwörterbuch überein?                                                                                                                            |
| Projektion            | Sind Schrift, Kontrast, Diagramme und Formeln aus dem hinteren Raum lesbar?                                                                                                                                                                           |
| Alternative Teilnahme | Ist für jede verwendete Materialklasse die gleichwertige Alternative aus der A11y-Matrix vollständig nutzbar?                                                                                                                                         |
| A11y-Materialprobe    | Sind die für die Sitzung einschlägigen Prüfpunkte mit Datum, Version und Ergebnis im A11y-Protokoll dokumentiert?                                                                                                                                     |
| Exportweg             | Ist ausreichend lokaler Speicher vorhanden und ist der Zielordner zugriffsbeschränkt?                                                                                                                                                                 |
| Offline               | Sind Wochen-JSON, gedruckte Fragenansicht, Zählbogen, Lehrdaten und vorab erzeugter JASP-Referenzoutput lokal verfügbar?                                                                                                                              |

Bei einem „nein“ wird die betroffene Funktion nicht improvisiert. LD wechselt für diesen Teil auf den in Abschnitt 7 definierten Fallback.

### 3.3 30 Minuten vor Beginn: technischer Kurzcheck

1. Projektor und Lehrgerät verbinden; keine Session-Codes oder Host-Tokens in Aufzeichnungen einblenden.
2. ARSnova-Probesession mit einer nicht curricularen Testfrage öffnen und wieder schließen.
3. Die freigegebene Wochen-Quizdefinition neu öffnen; keine spontane Bearbeitung am Original.
4. ARSnova-Einstellungen ein letztes Mal gegen das formative Gamification-Profil prüfen; Pseudonyme, Rangliste, Timer, Zeitunterstützung, Teams, Boni, Effekte und Lesephase in einer Testfrage verifizieren.
5. MC-Test in einem frischen Teilnehmerprofil öffnen und `practice`, fehlenden Timer sowie fehlende öffentliche Top-5 erneut bestätigen.
6. JASP 0.98.1 starten, Wochen-CSV öffnen und `source_ref`, Zeilenzahl, Beobachtungseinheit sowie Kontrollwerte laut Datenwörterbuch prüfen.
7. Wochen-JSON beziehungsweise gedruckte Fragenansicht öffnen und Papier-Zählbogen bereitlegen.
8. Auf der Startfolie Freiwilligkeit, keine Notenwirkung, pseudonyme Darstellung, rein motivierende Funktion der Spielwerte sowie untimierte alternative Teilnahme sichtbar nennen.

## 4. Sitzungsablauf

### 4.1 Eröffnung des Wochenblocks

LD beginnt jede Woche mit demselben 8-Minuten-Rahmen. Er bildet die Aktivierungsphase der ersten 90-Minuten-LE und ist keine zusätzliche Zeit:

1. Lernziele und erwartetes Lernprodukt nennen.
2. Eine konkrete Nachsteuerung aus der Vorwoche nennen, ohne Personen oder Gruppen zu bewerten.
3. Datenquelle der Woche als LIVE, REPO oder LEHRDATEN kennzeichnen.
4. Bei LIVE-Aktivität erklären: Teilnahme freiwillig; Pseudonym, Rang, Zeit, Teamstand und Bonus dienen nur der Motivation und haben keine Notenwirkung; eine untimierte Alternative ist verfügbar.
5. Formelsammlung und JASP-Datei öffnen; verwendete Konventionen nennen.

Die Punkte 1–5 und eine kurze inhaltliche Rückblicksfrage teilen sich diesen 8-Minuten-Rahmen. Für W01 ersetzt das höchstens fünfminütige Diagnose-Debrief die Rückblicksfrage. Die übrigen Phasen werden innerhalb derselben 90-Minuten-LE entsprechend gekürzt; der LE-Umfang bleibt unverändert.

### 4.2 Ablauf jeder Livefrage

Für jede ID des Wochenpools gilt:

1. **Rahmen setzen, 30–60 Sekunden:** Modus als „Diagnose“, „Lernen“ oder „Spiel/Team“ nennen; bei SURVEY ausdrücklich „keine richtige Antwort“ sagen.
2. **Lesen, 45–90 Sekunden:** Frage projizieren und vorlesen. Die Lesephase endet erst, wenn Frage und Antwortwege einschließlich der untimierten Alternative zugänglich sind.
3. **Abgeben:** Antworten öffnen. Der Standardtimer startet erst jetzt, wird nach Schwierigkeit skaliert und berücksichtigt die freigegebene persönliche Zeitunterstützung. Zahl anwesender Personen, verbundener Geräte und abgegebener Antworten nicht gleichsetzen.
4. **Schließen:** Regulär nach Ablauf der effektiven Zeit oder wenn alle Antwortwege abgeschlossen sind; bei fortbestehender Barriere nicht schließen. `n_responses` notieren.
5. **Auswerten:** Fachliche Verteilung, Nenner und relevante Distraktoren besprechen. Rangliste, Teamstand und Bonus dürfen als motivierender Spielabschluss sichtbar sein, werden aber nicht als Lernstandskennzahl interpretiert; individuelle Antwortzeit bleibt unbeachtet.
6. **Nachsteuern:** Bei Lernfragen kurze Einzelbegründung, Partneraustausch und zweite Abstimmung einsetzen. Runde 1 und Runde 2 getrennt halten.
7. **Entscheiden:** Unter etwa 67 % korrekten Antworten oder bei vielen sicheren Falschantworten wird das Konzept im Wochenprotokoll markiert. Der Wert ist eine Lehrregel, kein App-Schwellenwert und keine Bestehensgrenze.
8. **Begrenzen:** Zulässige Aussage und eine Überinterpretation nennen.

Bei Multiple Choice darf die Summe der Optionsnennungen über 100 % liegen. Für den Anteil korrekter Antworten werden fachlich korrekte bzw. inkorrekte Abgaben verwendet, nicht die Summe korrekter Optionsklicks.

### 4.3 90-Minuten-Mikromuster einer Lerneinheit

| Phase                     |  Richtzeit | Handlung                                                                      |
| ------------------------- | ---------: | ----------------------------------------------------------------------------- |
| Aktivierung und Rückblick |     8 Min. | alte und neue ARSnova-Frage; Anschluss an den MC-Befund der Vorwoche          |
| Problem/Intuition         |    10 Min. | Fall S1–S6 oder betrieblicher Transfer                                        |
| Erklärung/Formel          |    17 Min. | Alltagssprache, Formelsammlung, gemeinsames Beispiel                          |
| Anwendung                 |    20 Min. | Einzel-/Partneraufgabe oder JASP-Arbeit                                       |
| Auswertung                |    12 Min. | Fehlerkontrast, JASP-Plausibilität und Grenzen                                |
| Transfer/JASP-Sicherung   |    15 Min. | isomorphe Aufgabe, Analyseausgabe oder klausurnahe Anwendung                  |
| Exit                      |     4 Min. | mündliches oder pseudonymes Blitzlicht; kein zusätzliches bewertetes Quizitem |
| **Flexpuffer**            | **4 Min.** | Technik, Nachfragen, alternative Teilnahme oder Übergang                      |

Die Phasen summieren sich auf 90 Minuten. Der Puffer wird zuerst für Technik, Rückfragen und gleichwertige Teilnahme verwendet. Reichen vier Minuten nicht, entfällt zuerst ein optionales zweites Beispiel oder eine Vertiefung. Kernanwendung, notwendige Barrierekompensation und Exit-Evidenz werden nicht ersatzlos gestrichen.

Für die letzte LE jeder Woche gilt ein Sondermuster: Die erste UE schließt den Fachinhalt und den JASP-/Transferertrag ab. Die zweite UE besteht aus 32 Minuten MC-Test, 10 Minuten Ergebnis-/Lösungsbesprechung und 3 Minuten Sicherung des Spaced-Repetition-Auftrags.

### 4.4 Verbindlicher JASP-Ablauf

Jede Labor- oder Analysephase folgt diesem Pfad:

1. Freigegebene CSV unverändert öffnen und Dateiname sowie `source_ref` anzeigen.
2. Beobachtungseinheit, Zeilenzahl, Skala, fehlende Werte und Kontrollwerte anhand des [Datenwörterbuchs](./P0-03_Datenwoerterbuch_Provenienz.md) kontrollieren.
3. Nur die im Wochenplan vorgesehene Analyse aktivieren.
4. Vor dem Ablesen n, ausgeschlossene Fälle, Einheit und Rundung prüfen.
5. Ergebnis zunächst in Alltagssprache, dann mit Fachbegriff formulieren.
6. Eine Plausibilitätsprüfung durchführen: Größenordnung, Wertebereich, Einheit und gegebenenfalls Handrechnung.
7. JASP-Ausgabe mit Titel, Datenquelle, Version und Kernaussage exportieren; jede für den Befund verwendete Grafik erhält zusätzlich eine textliche Kernaussage, die ohne Farbe oder Bild verständlich ist.
8. Keine LIVE- und LEHRDATEN in derselben Analyse zusammenführen, sofern sie nicht als getrennte Gruppen sichtbar bleiben.

Besondere Kontrollen:

- W03: JASP-Stichprobenstandardabweichung und ARSnova-deskriptive Standardabweichung nicht verwechseln.
- W04: Confidence ist ordinal; die Stufen 1–2, 3 und 4–5 bilden die vereinbarte Gruppierung.
- W06: Intervallpräzision begründet keine Repräsentativität.
- W07: Nur vollständige Paare; fehlende Runde 2 wird nie mit Runde 1 aufgefüllt.
- W08: S5 ist LEHRDATEN; Regression begründet keine Produktions-SLO und keine Kausalität.
- W09: Classified-Accuracy und Coverage haben unterschiedliche Nenner; dokumentierte Raten werden nicht in erfundene Einzelbeobachtungen umgerechnet.

### 4.5 Wochenabschluss in der letzten UE

Am Ende der ersten UE der letzten LE:

1. Fachschwerpunkt und JASP-/Transferertrag sichern, ohne individuelle Note.
2. Offene Q&A-Beiträge beantworten oder datenschutzkonform sichern; Freitext wird nicht ungeprüft in Lehrdaten übernommen.
3. ARSnova-Session nach dem Ablauf aus Abschnitt 5 beenden. Rang-, Team-, Bonus- und Zeitwerte werden nicht in die fachliche Lernanalytik übernommen.

Die zweite und letzte UE der Woche umfasst exakt:

1. **32 Minuten MC-Test:** alle 30 Fragen im Modus `practice`, kein technischer Countdown, Sofortfeedback und `mini_glossary`.
2. **10 Minuten Ergebnis- und Lösungsbesprechung:** aggregierte Lösungsquoten und häufige Distraktoren zeigen; mindestens zwei fachlich ergiebige Aufgaben vollständig erklären. Keine Person oder Gruppe öffentlich bewerten.
3. **3 Minuten Spaced-Repetition-Auftrag:** zweiten vollständigen Durchlauf für zwei bis drei Tage später terminieren und das nach zwei bis vier Wochen wiederkehrende Kernkonzept nennen.

Unmittelbar nach der Lehrveranstaltung folgt der Export- und Datenübergabeablauf. Falls die MC-Plattform in der letzten UE ausfällt, wird die vollständige 30-Fragen-Alternativfassung mit getrenntem Lösungs-/Erklärungsblatt eingesetzt; der gemeinsame Besprechungsanteil bleibt erhalten.

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

## 6. Präsenz-MC-Test, Spaced Repetition und Nachsteuerung

### 6.1 Erster Durchlauf in der letzten UE

- Genau 30 Fragen; kein adaptives Ausblenden und keine Zufallsstichprobe aus einem größeren Pool.
- Verbindlich `practice`: kein technischer Timer, Sofortfeedback mit `explanation` und `mini_glossary` nach jeder Antwort.
- `meta.test_duration_minutes=32` wird als organisatorischer Richtwert für den Präsenzdurchlauf kommuniziert und aktiviert keinen Countdown.
- Nach 32 Minuten folgen 10 Minuten gemeinsame Besprechung aggregierter Ergebnisse, Lösungen und besonders häufig gewählter Distraktoren.
- Deployment verbindlich mit `show_top5_public=false`; keine öffentliche MC-Top-5, Rangliste oder Notenwirkung.
- Optionen dürfen randomisiert werden, sofern Bezeichnungen wie „alle oben genannten“ nicht verwendet werden und die Lösung semantisch stabil bleibt.
- Fehlendes Gerät oder zusätzlicher Zeitbedarf führt zur vollständigen untimierten Alternativfassung, nicht zum Ausschluss vom Wochenabschluss.

### 6.2 Spaced-Repetition-Nachlauf

- Derselbe vollständige 30er-Satz bleibt nach dem Präsenztermin für einen zweiten Durchlauf verfügbar.
- Der zweite Durchlauf wird für zwei bis drei Tage nach dem Präsenztermin empfohlen und dient der korrigierenden Wiederholung.
- Mindestens ein Kernkonzept jeder behandelten Woche erscheint nach zwei bis vier Wochen in einer späteren Wochen-Datei erneut.
- Weitere Durchläufe bleiben möglich; die App begrenzt weder Sessionzahl noch Bearbeitungszeit.
- Der Folgeauftrag nennt höchstens zwei Konzepte und verweist auf Erklärung, Mini-Glossar, Formelsammlung oder Brückenpfad. Er erzeugt keine individuelle Sanktion.

### 6.3 Lernanalytik

Ausgewertet werden ausschließlich aggregiert:

- Zahl begonnener und abgeschlossener Lernsessions im festgelegten Wochenfenster,
- Lösungsquote pro abgeleiteter redaktioneller Kennung,
- Auswahlquote jedes Distraktors,
- Auslassungsquote,
- `topic`, `concept`, `weight` und `cognitive_level` aus dem Fragen-JSON,
- redaktionelle Lernziel- und Spaced-Repetition-Zuordnungen aus dem getrennten Freigabeprotokoll.

Antwortzeit ist höchstens ein technisches Nutzungssignal und kein Kompetenzmaß. Pseudonyme und individuelle Verläufe werden nicht in die Lehrauswertung übernommen. Einzelne Studierende werden nicht gerankt, kontaktiert, sanktioniert oder anhand von ARSnova-, MC-Test- oder sonstigen LIVE-Daten leistungsbewertet.

### 6.4 Entscheidung vor der Folgewoche

QE und LD wählen anhand des freigegebenen Wochenaggregats:

1. höchstens zwei Konzepte unter etwa 67 % aggregierten korrekten Antworten,
2. höchstens eine häufige sichere Fehlvorstellung aus der Live-Sitzung,
3. ein länger zurückliegendes Konzept für die nächste Spaced-Repetition-Stufe.

Für jedes gewählte Konzept wird eine konkrete Maßnahme protokolliert: neues Beispiel, Worked Example, Peer Instruction oder Formelsammlungsroutine. Es werden keine zusätzlichen MC-Items in den abgeschlossenen 30er-Satz eingefügt; die spätere Wiederholung erfolgt in der Blueprint-Verteilung einer Folgewochen-Datei.

## 7. Offline- und Störungsfallback

### 7.1 Umschaltkriterien

LD wechselt ohne weitere Fehlersuche auf Fallback, wenn mindestens eines gilt:

- ARSnova ist zum geplanten Fragezeitpunkt nicht erreichbar;
- Hostzugang, Session oder Teilnehmerbeitritt funktioniert nach einem kontrollierten Neuversuch nicht;
- automatisch vergebene Pseudonyme, deaktivierte eigene Nicknames oder Zeitunterstützung lassen sich nicht sicher bestätigen;
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
- Für Formelsammlung, JASP-Auszug, Tabelle, MC-Test und Probeklausur gilt die jeweilige gleichwertige Alternative der [Material-/A11y-Matrix](./P0-03_Barrierefreiheit_Material_und_Probe.md); ein bloßes Vorlesen komplexer Tabellen ersetzt die strukturierte Textfassung nicht.

### 7.4 JASP-Ausfall

1. Analyse nicht spontan in einer anderen Software als verbindliches Ergebnis neu erzeugen.
2. Den im Preflight mit JASP 0.98.1 erzeugten, gegen die Sollwerte geprüften und lokal gespeicherten Wochen-Referenzoutput für Interpretation und Plausibilitätsarbeit verwenden.
3. Handrechnung nur dort durchführen, wo Formelsammlung und Wochenziel sie vorsehen.
4. Nach der Sitzung die Analyse in JASP reproduzieren und erst dann eine Zahl in Lehrendenprotokoll oder Musterlösung übernehmen.
5. Bleibt JASP bis zur Folgewoche nicht funktionsfähig, eskaliert LD an MV; der betroffene Analyseblock wird mit LEHRDATEN und Referenzoutput wiederholt, nicht durch eine andere Analysesoftware ersetzt.

### 7.5 Exportausfall

- Sitzungsprotokoll, sichtbare Aggregate und Bildschirm-/Druckbericht sichern, sofern datenschutzkonform.
- Keine fehlenden Einzelwerte, Paare oder Runden rekonstruieren.
- Im Wochenprotokoll „Export nicht verfügbar“ und die tatsächlich vorhandene Evidenz nennen.
- Für die Lehraufgabe auf die freigegebenen LEHRDATEN wechseln.
- Fehlende LIVE-Daten werden nicht durch erfundene Werte ergänzt und nicht als Null kodiert.

## 8. Abweichungs- und Stop-Regeln

| Beobachtung                                              | Sofortmaßnahme                                                                                          | Datennutzung                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Eigene Nicknames aktiv oder Klarnameneingabe vor Start   | Session nicht öffnen; korrektes Pseudonymprofil neu importieren oder Offline-Fallback                   | keine Daten                                                                                                |
| Personenname nach Antworten sichtbar                     | Projektion und Session stoppen; Namen nicht weiter anzeigen; neue pseudonyme Session oder Fallback      | personenbezogenen Lauf löschen; nicht analysieren                                                          |
| Rangliste, Teams, Bonus oder Effekte entgegen Profil aus | Wenn vor Start: Profil korrigieren; im Lauf: fachlich fortsetzen, Abweichung protokollieren             | Fachantworten nutzbar; fehlende Gamification nicht als Lernstands- oder Wirkungsunterschied interpretieren |
| Lesephase oder Zeitunterstützung fehlt                   | Technischen Timer deaktivieren und für alle untimiert beziehungsweise über Alternativweg weiterarbeiten | Antwortzeit und Geschwindigkeit verwerfen; fachliche Aggregate nur bei gleichwertigem Zugang nutzen        |
| MC-Test nicht im Modus `practice`                        | Session nicht freigeben; Lernmodus wählen und mit frischem Profil neu prüfen                            | keine Daten aus dem Fehlmodus in Lehrauswertung übernehmen                                                 |
| Öffentliche MC-Top-5 sichtbar                            | Instanz sperren; `show_top5_public=false`; Neustart und Gegenprüfung                                    | Rangdaten verwerfen; Löschumfang in den Handoff aufnehmen                                                  |
| falsche Lösung hinterlegt                                | Frage schließen, Fehler erklären, Item als ungültig markieren                                           | nicht in Lösungsquote oder Evaluation                                                                      |
| Frage ausgelassen                                        | Grund protokollieren                                                                                    | nicht als falsch oder fehlend zählen                                                                       |
| zwei Sessions derselben Woche                            | `run-01`/`run-02` getrennt halten                                                                       | nur mit sichtbarer Laufvariable vergleichen/aggregieren                                                    |
| kleine Confidence-Zelle unter fünf                       | keine Detailzahl nennen                                                                                 | zusammenfassen oder unterdrücken, nie als Null deuten                                                      |
| Runde 2 mit Ausfällen                                    | R2 nur aus tatsächlichen R2-Antworten                                                                   | keine Auffüllung aus R1                                                                                    |
| unvollständige Paare                                     | Fall aus gepaarter Lehrrechnung ausschließen                                                            | `n_round1`, `n_round2`, `n_pairs` getrennt berichten                                                       |
| MC-Datei verletzt Schema, `0/12/18` oder 30 Fragen       | Veröffentlichung stoppen beziehungsweise Fenster nach Korrektur neu starten                             | Woche erst nach bestandenem vollständigem Release-Gate auswerten                                           |
| MC-Löschfrist oder Abwesenheitsprüfung verfehlt          | Instanz sperren und an DS sowie MV eskalieren                                                           | keine weitere Pilotwoche auf der betroffenen Instanz                                                       |

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
2. Den seit W03 geführten und bis Ende W09 analysierten Statistikbefund anhand der [Vorlage und Rubrik](./P0-03_Statistikbefund_Vorlage_Rubrik.md) ausschließlich formativ rückmelden; die Untersuchungsfrage bleibt auf die statistische Lehranalyse begrenzt. Eine davon getrennte Klausur darf ausschließlich freigegebene LEHRDATEN verwenden.
3. W10-SURVEY und die vorab festgelegten Modulindikatoren aus [P0-01](./P0-01_Kerncurriculum_Lernzielmatrix.md) nach den Aggregations- und Schutzregeln von [P0-02](./P0-02_Datenmanagement_Exportplan.md) intern auswerten.
4. Keine individuellen Vorher-Nachher-Verläufe konstruieren; W01/W10-Blitzlichter nur deskriptiv auf Modulebene vergleichen.
5. Den W10-Löschhandoff binnen sieben Kalendertagen nach Ende des Bearbeitungsfensters abschließen; `test_session_summaries` beziehungsweise die isolierte Datenbank samt WAL/SHM und die Abwesenheitsprüfung sind zwingend.
6. Arbeitskopien, Session-Exporte und temporäre Schätzwerte gemäß Datenplan löschen; Löschung protokollieren.
7. Interne Abschlussnotiz auf Durchführung, curriculare Passung, sichtbare Lernhürden, Materialfehler und Änderungen für den nächsten Lehrdurchlauf beschränken.
8. Aus ARSnova-, MC-Test- oder sonstigen LIVE-Daten keine individuelle Leistungsbewertung, forschungsbezogene Fragestellung, Effektivitätsbehauptung, Publikation, externe Datenweitergabe oder Nachnutzung außerhalb von Lehre und interner Modulevaluation ableiten.
