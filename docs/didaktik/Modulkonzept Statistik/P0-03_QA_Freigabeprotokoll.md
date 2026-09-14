# P0-03 – QA- und Freigabeprotokoll

**Version:** 4.0.0 · **Stand:** 13.09.2026<br>
**Status:** statische Paketprüfung bestanden; operative Kursfreigabe offen

**Bezugsdokumente:** [Materialpaket Pilotlauf](./P0-03_Materialpaket_Pilotlauf.md) · [Lehrenden-Runbook](./P0-03_Lehrenden_Runbook.md) · [Datenmanagement- und Exportplan](./P0-02_Datenmanagement_Exportplan.md)

**Kürzel vorab:** **QA** bezeichnet Qualitätssicherung, **W01–W10** die Kurswochen, **LE** eine 90-minütige Vorlesungs- beziehungsweise Lerneinheit aus zwei **UE** à 45 Minuten, **MC** Multiple Choice, **A11y** Barrierefreiheit sowie **LIVE/REPO/LEHRDATEN** Kursdaten, versionierte Repository-Nachweise und synthetische Lehrdaten. **MP/IR/LD/DJ/MV/QE/DS** stehen für MC-Test-Plattformbetrieb, Item-Redaktion, Lehrdurchführung, Daten-/JASP-Kuratierung, Modulverantwortung, Qualitäts-/Evaluationsverantwortung und Datenschutz-/Informationssicherheitsrolle.

## 1. Zweck und Aussagegrenze

Dieses Protokoll dokumentiert reproduzierbare technische und fachliche Vorprüfungen des versionierten P0-03-Pakets. Es ist keine Freigabe durch die im Materialindex benannten menschlichen Rollen und ersetzt weder Laufzeit-Importtests noch Datenschutz-, Betriebs- oder Modulfreigaben.

Der dokumentierte Stand enthält ausschließlich Markdown, JSON und synthetische CSV-Lehrdaten. Es wurden keine LIVE-Daten erzeugt oder geprüft. Die operative Nutzung beginnt erst, wenn alle offenen Gates in Abschnitt 4 geschlossen und von den zuständigen Rollen bestätigt wurden.

## 2. Bestand des geprüften Pakets

- 10 MC-Test-Dateien mit insgesamt 300 Fragen,
- 10 ARSnova-Livequiz-Dateien mit insgesamt 100 Fragen,
- 7 synthetische CSV-Dateien mit `source_kind=LEHRDATEN`,
- eigenständiges Modulkonzept und direkt verteilbare Modulbeschreibung ohne sichtbare Review-/Versionsmetadaten,
- Kerncurriculum, Datenmanagementplan, Materialindex, Runbook, zwei Blueprints und technische Quellen Q1–Q20,
- Datenwörterbuch, JASP-Leitfaden, Formelsammlung,
- Statistikbefund-Vorlage mit Rubrik sowie Probeklausur und Musterlösung,
- Mathematikdiagnostik mit sechs Brückenpfaden,
- sieben isomorphe BWL-/WI-Transferaufgabenpaare,
- Matrix gleichwertiger Materialalternativen mit zehnteiliger praktischer A11y-Probe.

Die Prüfsummen in Abschnitt 5 beziehen sich ausschließlich auf die 27 maschinenlesbaren JSON-/CSV-Artefakte dieses Stands.

## 3. Abgeschlossene statische Prüfungen

| Prüfung                                   | Ergebnis                                                                                                                                                                                                                                                                                                                                                            | Status    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Shared-Types-Build                        | `npm run build -w @arsnova/shared-types` endet unter Node 24.18.0 mit Exit-Code 0.                                                                                                                                                                                                                                                                                  | bestanden |
| Shared-Types-Tests                        | `npm test -w @arsnova/shared-types` besteht unter Node 24.18.0 mit 12 Testdateien und 107 erfolgreichen Tests.                                                                                                                                                                                                                                                      | bestanden |
| ARSnova-Vertrag                           | Alle 10 Dateien bestehen `QuizImportSchema` und `QuizUploadInputSchema`; insgesamt 100 paketweit eindeutige Fragen, je Woche 10 Fragen und alle 10 Typen genau einmal. Das Paket enthält 33 mittlere und 67 schwere Fragen sowie durchgängig das festgelegte Pseudonym-, Gamification-, Team-, Zeit- und Lesephasenprofil.                                          | bestanden |
| ARSnova-Kurztextbewertung                 | Alle 10 Kurztextfragen verwenden `exact`/`none` ohne Teilpunkte. 65 explizite richtige Schreibvarianten erhalten volle Punkte; 13 fachlich falsche Gegenbeispiele zu Zahl, Einheit, Begriff oder Reihenfolge erhalten null Punkte.                                                                                                                                  | bestanden |
| Strenger MC-Paketvertrag                  | 10 Dateien, 300 paketweit eindeutige Fragen, exakte Feldmengen, identische Zielgruppe, 30 Fragen je Woche und je Datei `0/12/18`. Jede Lösungsposition kommt sieben- oder achtmal vor; Folgen sind nicht periodisch, Serien höchstens zwei lang, Erklärungen positionsunabhängig; kognitive Stufen und 2–4 Glossareinträge sind zulässig.                           | bestanden |
| Statische Fragenbank-Vorprüfung           | Alle 100 Livefragen und 300 MC-Items wurden auf Lösung, Rechnung, Eindeutigkeit, tatsächliche Schwierigkeit, plausible parallele Distraktoren, Quellenstatus und nahe Wiederholungen geprüft; erkannte Befunde wurden korrigiert und gezielt nachgeprüft. Dies ersetzt nicht die menschliche Schlussfreigabe aus Abschnitt 4.                                       | bestanden |
| Fixierter MC-Test-Validator               | Commit `b6b159555e8a228dad73dd75fd66c154a1088e28`: Exit-Code 0, keine Fehler, 10 thematische Warnungen; Bewertung siehe Abschnitt 3.1.                                                                                                                                                                                                                              | bestanden |
| Lehrdaten und Sollwerte                   | 7 CSV-Dateien: Provenienzfelder, Vollständigkeit, Ableitungen und dokumentierte Kontrollwerte einschließlich t-Wert, Wilson-Untergrenze, Regression und Metriken reproduziert.                                                                                                                                                                                      | bestanden |
| Lokale Dokumentverweise                   | Alle 400 geprüften relativen Markdown-Ziele existieren.                                                                                                                                                                                                                                                                                                             | bestanden |
| Prettier und Whitespace                   | Markdown/JSON entsprechen Prettier; `git diff --check` meldet keine Whitespacefehler.                                                                                                                                                                                                                                                                               | bestanden |
| Personenbezug der versionierten Lehrdaten | Alle CSV-Zeilen sind als `LEHRDATEN` gekennzeichnet; die Dateien enthalten keine LIVE- oder Personendaten.                                                                                                                                                                                                                                                          | bestanden |
| Verfahrensscope                           | MZ4/LI16, Formelsammlung, Wochenplan, JASP-Pfad und Probeklausur begrenzen Hypothesentests im Pflichtkern auf den gepaarten \(t\)-Test; unabhängige Anteils-/Mittelwertfragen nutzen Intervalle.                                                                                                                                                                    | bestanden |
| Prüfungsalignment                         | 60 Punkte sind exakt als `12/9/9/9/9/9/3` den sieben Klausurbereichen zugeordnet; MZ7 erhält ohne Doppelzählung 3 Punkte.                                                                                                                                                                                                                                           | bestanden |
| Lehrfall-Provenienz                       | Eigene `source_ref` trennen die Probeklausur-Lehrfälle von sieben CSVs sowie W09- und W10-Train/Test-Beispielen.                                                                                                                                                                                                                                                    | bestanden |
| Mathematikzugang                          | 12 Diagnosepunkte decken sechs Voraussetzungen ab; jeder Block besitzt Worked Example, Übung, Wiederholungscheck und datensparsamen Förderweg. Bearbeitung erfolgt vor UE 1 im W01-Selbststudium.                                                                                                                                                                   | bestanden |
| Fallstudien-Timing                        | Auswahlfähige Stränge S1/S5/S6, verbindliche Wahl W03, Analyseplan W06, vollständiger Entwurf W09 und minutenbudgetierte Revision W10 sind synchron dokumentiert.                                                                                                                                                                                                   | bestanden |
| LE-/UE-Zeitstruktur                       | 24 LE enthalten lückenlos 48 UE: W01/W02/W04/W06/W08/W10 je 2 LE, W03/W05/W07/W09 je 3 LE. Jede Woche weist den MC-Test in der letzten UE mit 32/10/3-Minuten-Budget aus.                                                                                                                                                                                           | bestanden |
| Isomorpher Transfer                       | Für MZ1–MZ7 liegen sieben Aufgabenpaare mit gleichen Zahlen, Handlungen, Schwierigkeit, Punktwerten und Erwartungshorizonten vor.                                                                                                                                                                                                                                   | bestanden |
| A11y-Materialvertrag                      | Alle Materialklassen besitzen definierte gleichwertige Alternativen; das ARSnova-Profil verbindet Lesephase, technische Zeitunterstützung und untimierten Alternativweg. Zehn operative Prüfschritte bleiben Abschnitt 4 vorbehalten.                                                                                                                               | bestanden |
| JASP-Zugangsmodell                        | Die Zugangsbeschreibungen stellen klar: keine institutionell bereitgestellte JASP-Umgebung; lokale Installation auf kompatiblen Geräten oder gleichwertige Partner-/Kleingruppenarbeit, Lehrdemonstration und vorbereitete Ausgaben.                                                                                                                                | bestanden |
| Studierendeninformation                   | Die eigenständige Beschreibung enthält keine sichtbare Versionierung oder P0-/Pilotmetadaten. Umfang, Ziele, Lernrhythmus sowie Tablet-/Laptop-Nutzung von ARSnova.eu, MC-Test, JASP und Repository stimmen einschließlich Gamification, Präsenz-MC, Spaced Repetition, Freiwilligkeit, Datenverwendung, Prüfung und Zugangswegen mit den Bezugsdokumenten überein. | bestanden |

Die statistischen Kontrollwerte wurden unabhängig aus den CSV-Grundwerten nachgerechnet. Eine tatsächliche Reproduktion in JASP ist davon getrennt und bleibt gemäß Abschnitt 4 offen.

### 3.1 Bewertung der zehn MC-Test-Warnungen

Der fixierte Validator empfiehlt mindestens zwei Items je `topic`, behandelt Abweichungen aber ausdrücklich nur als Warnung.

| Datei | Warnungen | Entscheidung und Begründung                                                                                                                                                                                                                                  |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| W03   | 3         | Akzeptiert: Die drei einmaligen Topics kennzeichnen gezielt unterschiedliche kumulative Abrufe zu Datenstruktur, Häufigkeiten sowie Lage/Datenkritik. Die zugehörigen Pflichtinhalte sind zusätzlich in den Schwerpunkt-Topics und anderen Wochen abgedeckt. |
| W04   | 5         | Akzeptiert: Die einmaligen Topics bilden bewusst getrennte Spaced-Repetition-Verbindungen zu Datenstruktur, Skalenniveau, Häufigkeiten, Quartilen/Ausreißern und Transfer. Sie sind keine fehlenden Wochen-Schwerpunkte.                                     |
| W06   | 2         | Akzeptiert: `Konfidenzintervalle` wird durch die spezifischeren Topics zu Anteils- und Mittelwertintervallen ergänzt; `Kumulative Deskription` ist ein einzelner gezielter Abruf. Die fachliche Abdeckung wird dadurch nicht reduziert.                      |

Die Warnungen bezeichnen damit eine beabsichtigte Topic-Granularität, keinen Schema-, Lösungs- oder Inhaltsfehler. Bei einer späteren Umbenennung müssen Blueprint-Zählungen, JSON-Datei und dieses Protokoll gemeinsam aktualisiert werden.

## 4. Offene operative Freigabe-Gates

| Gate                                                        | Zuständige Rolle | Nachweis vor Kurseinsatz                                                                                                                                                                                                                                        | Status |
| ----------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| MC-Test-Import, Präsenzabschluss und Spaced Repetition      | MP, IR, LD       | Testimport aller zehn Dateien; 30/30 Items; `practice`; Sofortfeedback; kein Timer; `show_top5_public=false`; 32/10/3-Minuten-Probelauf in der letzten UE; Wiederholungszugänge nach 2–3 Tagen und 2–4 Wochen geprüft.                                          | offen  |
| ARSnova-Import und formatives Gamification-Profil           | LD, IR           | Testimport aller zehn Dateien; 10/10 Fragen, alle zehn Typen, Reihenfolge, Lösungen, exakte Kurztext-Positiv-/Negativbeispiele, Pseudonyme, Rangliste, skalierten Timer, Zeitunterstützung, Teams, Boni, Effekte, Lesephase und untimierte Alternative geprüft. | offen  |
| Lokales JASP 0.98.1 und gleichwertiger Zugang               | DJ, LD           | Import aller sieben CSVs, Skalenniveaus, Menüpfade, Sollwerte, Exporte und echte `.jasp`-Arbeitsdateien auf dem Lehrgerät geprüft; Weg ohne kompatibles Studierendengerät anhand vorbereiteter Ausgaben erprobt.                                                | offen  |
| Offline-Fallback                                            | LD               | Ein vollständiger Probelauf mit lokalen Quizdateien, Papierantworten und vorab erzeugtem JASP-Referenzoutput.                                                                                                                                                   | offen  |
| W10-Ablauf und Fallstudienübergabe                          | LD, MV, QE       | Probelauf der zwei 90-minütigen LE aus UE 45–48; Strangwahl W03, Analyseplan W06, vollständiger Entwurf W09 und keine erstmalige Analyse W10 nachgewiesen.                                                                                                      | offen  |
| Praktische A11y-Materialprobe                               | LD, QE, DJ, MV   | Alle zehn Prüfschritte mit realem Setup bestanden; insbesondere Lesephase, Zeitunterstützung, untimierte Alternative und nicht ausschließlich sensorisch vermittelte Gamification.                                                                              | offen  |
| Datenweg, Schutzorte, Löschhandoff und Auftragsverarbeitung | DS, MP           | P0-02-Prüfung einschließlich MC-Test-Datenbank, Rollen, Fristen und dokumentiertem Löschvollzug.                                                                                                                                                                | offen  |
| Curriculare, fachliche und prüfungsbezogene Schlussfreigabe | MV, QE           | Stichprobe aller Materialklassen einschließlich Diagnose, Transferpaaren, Verfahrensscope, Strang-Timeline, Vertiefungsgates und Klausurabgleich sowie Ausschluss individueller Bewertung aus LIVE-Daten.                                                       | offen  |

JASP 0.98.1 war im statischen Prüfkontext nicht installiert; daher wird kein ausgeführter JASP-Test behauptet. Auch Laufzeit-/Importtests, Offline- und W10-Probelauf, praktische A11y-Materialprobe sowie menschliche Rollenfreigaben wurden nicht durch eine Dokumentprüfung ersetzt.

## 5. SHA-256-Prüfsummen der maschinenlesbaren Artefakte

```text
280274c0cc23971f9d2f0245caa9b4eae6069cd910fe1807c4366d25474599e0  P0-03_Lehrdaten_S1_Paare.csv
a3c9156c2ec4283913da43bf4257b04ce1443343c55fe7ca2a229fa318cc4048  P0-03_Lehrdaten_S1_Servicezeiten.csv
0d7fe9571f7f141ca59641d0214979efc6a8fc5245d586f9ac5e6725e70d4cde  P0-03_Lehrdaten_S2_Confidence.csv
1e41c80604a08c41b07f72ad68b75e9f67d2adb22ecbda05931d7768732d31a4  P0-03_Lehrdaten_S3_QA_Ranking.csv
3cbe01d63384d5a37f152c5d3a00cc33ee6cd96d04db5d5f9726ddd8f33309c0  P0-03_Lehrdaten_S5_Last_Latenz.csv
b3a6e8b838fac15b232ad9d20acdf838b9f0e78103495aba4ffc937d469d8627  P0-03_Lehrdaten_S6_Klassifikation.csv
a4d3733c7ba14591be239abe155c3982cfdca45b3e9d5816007560d62cf82349  P0-03_Lehrdaten_S6_Modelllaeufe.csv
e65c96709d1a78f40cae3d1d83f668d107903e10c6f02d5c7e062e82d11852b9  P0-03_ARSnova_Woche_01.json
adb0502c6849c573fd05b4990180d8c929b966cceafb282597849de34508b1aa  P0-03_ARSnova_Woche_02.json
b86ce89da5e62740a15e5214321cfddb0ce055a281ea3c8816467baf004e7b26  P0-03_ARSnova_Woche_03.json
66b804b6287555de518d7e2ae79c5a0972a2e4d57005a3227a50e9bf4cc53f6e  P0-03_ARSnova_Woche_04.json
d5f1f599375e2a4d0f7999b3724e38d86ef6ba784027d8b7f375a0fe71b57f84  P0-03_ARSnova_Woche_05.json
d34232f4979525cf4219f70700b81fee568a2f8c20387a24642d008fe23497a5  P0-03_ARSnova_Woche_06.json
20b2a1f4bd2b488c9493090a0be41e5727056ed8f896646055524909c70bdc5b  P0-03_ARSnova_Woche_07.json
358fcdd3d5f2a63dcfc1ba1205f537f9ebc84c928c5c1041930a760b60b0aee9  P0-03_ARSnova_Woche_08.json
aa2d155d8c41b068f37baa5f127af83e65216f5b44e5b85b36f512f24f06297d  P0-03_ARSnova_Woche_09.json
e012fb727f0a3003829085bc8699c96ec3cc14968fed4879c3e39422b761d586  P0-03_ARSnova_Woche_10.json
502bc6de05f678886229e1ebffbad98d417c385ea238473faa09f7cd231d8fcc  P0-03_MC-Test_Woche_01.json
760049f3d0c9075e272e4f0ffbd4933c024b93637c818818539cc4fa23147a13  P0-03_MC-Test_Woche_02.json
551e6b7e2d4c6b48a943ecefe8da59d2c753931683cd39b4e4469159dcc1e650  P0-03_MC-Test_Woche_03.json
3972bfb467248a31518698b061f91fee7d2ef006aa5571a7a1173abbbd5f3113  P0-03_MC-Test_Woche_04.json
49ad0e638836b51cdca4ecb22864bea6ce6e26f8b6e90b6ebb9c9eb16cb77f61  P0-03_MC-Test_Woche_05.json
38f36f3eb8522f9c6343f3ad907aa4a50f2f38bfe3024642ab888eef4b9f370c  P0-03_MC-Test_Woche_06.json
ea15964408d1323e222af3d675ec9431cd2919c86b4ce083abe0a8241ed4206e  P0-03_MC-Test_Woche_07.json
c8ff5bce3c6be4a6394d13b8a8d1b972ac239ebf81ebdc873841e0e32e16b987  P0-03_MC-Test_Woche_08.json
fe58a81d4d223b6ce9a4661b0c4ff5c4cf0970c717499390bb7beddab273a565  P0-03_MC-Test_Woche_09.json
512476c52704702a6c2302d4b6f9fb7d39d41a65dd89bbb2bf8643934ded776e  P0-03_MC-Test_Woche_10.json
```

Nach jeder inhaltlichen Änderung an JSON oder CSV sind die Prüfsummen neu zu erzeugen und die betroffenen statischen Prüfungen erneut auszuführen. Die endgültige Paketprovenienz wird zusätzlich durch den Git-Commit bestimmt.

## 6. Freigabevermerk

Die drei P0-Arbeitspakete sind dokumentarisch und statisch umgesetzt:

1. Kerncurriculum und prüfbare Lernzielmatrix,
2. Datenmanagement- und Exportplan,
3. vollständiges versioniertes Lehrmaterialpaket.

Der Stand darf als Review-Kandidat weitergegeben werden. Er ist noch nicht für einen realen Pilotlauf freigegeben, solange mindestens ein Gate aus Abschnitt 4 offen ist.
