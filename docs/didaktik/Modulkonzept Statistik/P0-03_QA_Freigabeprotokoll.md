# P0-03 – QA- und Freigabeprotokoll

**Version:** 2.1.0 · **Stand:** 13.09.2026<br>
**Status:** statische Paketprüfung bestanden; operative Pilotfreigabe offen

**Bezugsdokumente:** [Materialpaket Pilotlauf](./P0-03_Materialpaket_Pilotlauf.md) · [Lehrenden-Runbook](./P0-03_Lehrenden_Runbook.md) · [Datenmanagement- und Exportplan](./P0-02_Datenmanagement_Exportplan.md)

## 1. Zweck und Aussagegrenze

Dieses Protokoll dokumentiert reproduzierbare technische und fachliche Vorprüfungen des versionierten P0-03-Pakets. Es ist keine Freigabe durch die im Materialindex benannten menschlichen Rollen und ersetzt weder Laufzeit-Importtests noch Datenschutz-, Betriebs- oder Modulfreigaben.

Der dokumentierte Stand enthält ausschließlich Markdown, JSON und synthetische CSV-Lehrdaten. Es wurden keine LIVE-Daten erzeugt oder geprüft. Die operative Nutzung beginnt erst, wenn alle offenen Gates in Abschnitt 4 geschlossen und von den zuständigen Rollen bestätigt wurden.

## 2. Bestand des geprüften Pakets

- 10 MC-Test-Dateien mit insgesamt 300 Fragen,
- 10 ARSnova-Livequiz-Dateien mit insgesamt 50 Fragen,
- 7 synthetische CSV-Dateien mit `source_kind=LEHRDATEN`,
- Kerncurriculum, Datenmanagementplan, Materialindex, Runbook, zwei Blueprints,
- direkt verteilbare Modulbeschreibung für Studierende,
- Datenwörterbuch, JASP-Leitfaden, Formelsammlung,
- Statistikbefund-Vorlage mit Rubrik sowie Probeklausur und Musterlösung,
- Mathematikdiagnostik mit sechs Brückenpfaden,
- sieben isomorphe BWL-/WI-Transferaufgabenpaare,
- Matrix gleichwertiger Materialalternativen mit zehnteiliger praktischer A11y-Probe.

Die Prüfsummen in Abschnitt 5 beziehen sich ausschließlich auf die 27 maschinenlesbaren JSON-/CSV-Artefakte dieses Stands.

## 3. Abgeschlossene statische Prüfungen

| Prüfung                                   | Ergebnis                                                                                                                                                                                                                                                       | Status    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Shared-Types-Build                        | `npm run build -w @arsnova/shared-types` endet mit Exit-Code 0.                                                                                                                                                                                                | bestanden |
| ARSnova-Vertrag                           | Alle 10 Dateien bestehen `QuizImportSchema`; insgesamt 50 Fragen und je Woche 4–6 Fragen.                                                                                                                                                                      | bestanden |
| Strenger MC-Paketvertrag                  | 10 Dateien, 300 paketweit eindeutige Fragen, exakte Feldmengen, identische Zielgruppenangabe, 30 Fragen je Woche, `8/16/6`-Gewichtsprofil, zulässige kognitive Stufen und 2–4 Glossareinträge.                                                                 | bestanden |
| Fixierter MC-Test-Validator               | Commit `b6b159555e8a228dad73dd75fd66c154a1088e28`: Exit-Code 0, keine Fehler, 10 thematische Warnungen; Bewertung siehe Abschnitt 3.1.                                                                                                                         | bestanden |
| Lehrdaten und Sollwerte                   | 7 CSV-Dateien: Provenienzfelder, Vollständigkeit, Ableitungen und dokumentierte Kontrollwerte einschließlich t-Wert, Wilson-Untergrenze, Regression und Metriken reproduziert.                                                                                 | bestanden |
| Lokale Dokumentverweise                   | Alle geprüften relativen Markdown-Ziele existieren.                                                                                                                                                                                                            | bestanden |
| Prettier und Whitespace                   | Markdown/JSON entsprechen Prettier; `git diff --check` meldet keine Whitespacefehler.                                                                                                                                                                          | bestanden |
| Personenbezug der versionierten Lehrdaten | Alle CSV-Zeilen sind als `LEHRDATEN` gekennzeichnet; die Dateien enthalten keine LIVE- oder Personendaten.                                                                                                                                                     | bestanden |
| Verfahrensscope                           | MZ4/LI16, Formelsammlung, Wochenplan, JASP-Pfad und Probeklausur begrenzen Hypothesentests im Pflichtkern auf den gepaarten \(t\)-Test; unabhängige Anteils-/Mittelwertfragen nutzen Intervalle.                                                               | bestanden |
| Prüfungsalignment                         | 60 Punkte sind exakt als `12/9/9/9/9/9/3` den sieben Klausurbereichen zugeordnet; MZ7 erhält ohne Doppelzählung 3 Punkte.                                                                                                                                      | bestanden |
| Lehrfall-Provenienz                       | Eigene `source_ref` trennen die Probeklausur-Lehrfälle von sieben CSVs sowie W09- und W10-Train/Test-Beispielen.                                                                                                                                               | bestanden |
| Mathematikzugang                          | 12 Diagnosepunkte decken sechs Voraussetzungen ab; jeder Block besitzt Worked Example, Übung, Wiederholungscheck und datensparsamen Förderweg. Bearbeitung erfolgt vor UE 1 im W01-Selbststudium.                                                              | bestanden |
| Fallstudien-Timing                        | Auswahlfähige Stränge S1/S5/S6, verbindliche Wahl W03, Analyseplan W06, vollständiger Entwurf W09 und minutenbudgetierte Revision W10 sind synchron dokumentiert.                                                                                              | bestanden |
| Isomorpher Transfer                       | Für MZ1–MZ7 liegen sieben Aufgabenpaare mit gleichen Zahlen, Handlungen, Schwierigkeit, Punktwerten und Erwartungshorizonten vor.                                                                                                                              | bestanden |
| A11y-Materialvertrag                      | Alle Materialklassen besitzen definierte gleichwertige Alternativen und zehn operative Prüfschritte; deren praktische Abnahme bleibt Abschnitt 4 vorbehalten.                                                                                                  | bestanden |
| Studierendeninformation                   | Umfang, Voraussetzungen, sieben Ziele, Lernrhythmus sowie Bedeutung und Tablet-/Laptop-Nutzung von ARSnova.eu, MC-Test, JASP und Repository stimmen einschließlich Freiwilligkeit, Datenverwendung, Prüfung und Zugangswegen mit den Bezugsdokumenten überein. | bestanden |

Die statistischen Kontrollwerte wurden unabhängig aus den CSV-Grundwerten nachgerechnet. Eine tatsächliche Reproduktion in JASP ist davon getrennt und bleibt gemäß Abschnitt 4 offen.

### 3.1 Bewertung der zehn MC-Test-Warnungen

Der fixierte Validator empfiehlt mindestens zwei Items je `topic`, behandelt Abweichungen aber ausdrücklich nur als Warnung.

| Datei | Warnungen | Entscheidung und Begründung                                                                                                                                                                                                                                  |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| W03   | 3         | Akzeptiert: Die drei einmaligen Topics kennzeichnen gezielt unterschiedliche kumulative Abrufe zu Datenstruktur, Häufigkeiten sowie Lage/Datenkritik. Die zugehörigen Pflichtinhalte sind zusätzlich in den Schwerpunkt-Topics und anderen Wochen abgedeckt. |
| W04   | 5         | Akzeptiert: Die einmaligen Topics bilden bewusst getrennte Retrieval-Verbindungen zu Datenstruktur, Skalenniveau, Häufigkeiten, Quartilen/Ausreißern und Transfer. Sie sind keine fehlenden Wochen-Schwerpunkte.                                             |
| W06   | 2         | Akzeptiert: `Konfidenzintervalle` wird durch die spezifischeren Topics zu Anteils- und Mittelwertintervallen ergänzt; `Kumulative Deskription` ist ein einzelner gezielter Abruf. Die fachliche Abdeckung wird dadurch nicht reduziert.                      |

Die Warnungen bezeichnen damit eine beabsichtigte Topic-Granularität, keinen Schema-, Lösungs- oder Inhaltsfehler. Bei einer späteren Umbenennung müssen Blueprint-Zählungen, JSON-Datei und dieses Protokoll gemeinsam aktualisiert werden.

## 4. Offene operative Freigabe-Gates

| Gate                                                        | Zuständige Rolle | Nachweis vor Pilotstart                                                                                                                                                                                   | Status |
| ----------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| MC-Test-Import und Laufzeitprofil                           | MP, IR           | Testimport aller zehn Dateien; 30/30 Items; `practice`; Sofortfeedback; kein Timer; `show_top5_public=false`.                                                                                             | offen  |
| ARSnova-Import und Nicht-Spiel-Baseline                     | LD, IR           | Testimport aller zehn Dateien; Reihenfolge, Antworttypen, Lösungen und Sessionparameter ohne Rangliste, Timer, Teamwertung oder Boni geprüft.                                                             | offen  |
| JASP 0.98.1                                                 | DJ               | Import aller sieben CSVs, Skalenniveaus, Menüpfade, Sollwerte, Exporte und echte `.jasp`-Arbeitsdateien geprüft.                                                                                          | offen  |
| Offline-Fallback                                            | LD               | Ein vollständiger Probelauf mit lokalen Quizdateien, Papierantworten und vorab erzeugtem JASP-Referenzoutput.                                                                                             | offen  |
| W10-Ablauf und Fallstudienübergabe                          | LD, MV, QE       | Probelauf des Vier-UE-Minutenplans; Strangwahl W03, Analyseplan W06, vollständiger Entwurf W09 und keine erstmalige Analyse W10 nachgewiesen.                                                             | offen  |
| Praktische A11y-Materialprobe                               | LD, QE, DJ, MV   | Alle zehn Prüfschritte der Material-/A11y-Matrix mit realem Setup, Paketversion, Datum und ohne offene Barriere bestanden.                                                                                | offen  |
| Datenweg, Schutzorte, Löschhandoff und Auftragsverarbeitung | DS, MP           | P0-02-Prüfung einschließlich MC-Test-Datenbank, Rollen, Fristen und dokumentiertem Löschvollzug.                                                                                                          | offen  |
| Curriculare, fachliche und prüfungsbezogene Schlussfreigabe | MV, QE           | Stichprobe aller Materialklassen einschließlich Diagnose, Transferpaaren, Verfahrensscope, Strang-Timeline, Vertiefungsgates und Klausurabgleich sowie Ausschluss individueller Bewertung aus LIVE-Daten. | offen  |

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
6626131f317aea1209b0a2e4266da97bedeaf92571910bee3b955afbc5da4c60  P0-03_ARSnova_Woche_01.json
4179200ba0904b41e187d7a8b85ded3d190ad476cc423fcbb777f2e1f92a1f72  P0-03_ARSnova_Woche_02.json
af8f563479dd2834f13b67b480efe77884f2355fde1c935be50f8c5a49a1ffb1  P0-03_ARSnova_Woche_03.json
f2f8f6d64b11f42c65713efeb01a2caf266662eb0a5dfa00e17e769a794de7b0  P0-03_ARSnova_Woche_04.json
460e60fbb823bf564fd8325640f668ccbe5c604e3d09ba662c9dbded918514c2  P0-03_ARSnova_Woche_05.json
30f8f6a1afb3987362abb995eccf0bcf06bd8d8d297f910e56cc5e1ea6b6af0d  P0-03_ARSnova_Woche_06.json
310ac83fa90ae527f093088395331a51c1cf92468d82ca26d087b869e59f337d  P0-03_ARSnova_Woche_07.json
925a9a255d603904095a822e9dc584157100ff804e10b583971bb32d7f8f6078  P0-03_ARSnova_Woche_08.json
ddb8ac6bafe3e6e05fbeebcbde106e186968b8d9fe3f6f8e42c75a399db2d658  P0-03_ARSnova_Woche_09.json
f17bad31dffc72a6dd1c1acc6e995a0196ab2bd38bbf738ec55748461ed24356  P0-03_ARSnova_Woche_10.json
3c2a7bcd0e457f96f569ed883ec89f8c5313720636b7e44dc0851dfbb7f5a9b5  P0-03_MC-Test_Woche_01.json
5801ce421114b00ee82edc58e2b11b35305b8d404d35e5a47b31017c4efeaaff  P0-03_MC-Test_Woche_02.json
55c50692efa321cbe9fcae7ab868930fe33c4f465af71eb3ce144550e6ef0017  P0-03_MC-Test_Woche_03.json
d2788b8149432d82d9af6af5cad429e9bf1e7d7e54ef60a31fca81b84c25d823  P0-03_MC-Test_Woche_04.json
2ef29c27b7dd4351670ad31f3a008caae65bc3a087904afe8bee19cfc5709ffa  P0-03_MC-Test_Woche_05.json
99c3970a49a5eb4e03705faf142e39381591517e8c2bdd6c6542965d34e4e10b  P0-03_MC-Test_Woche_06.json
d5ef4ef6327f2186d22efbf7711dd3fccd6208ec970ebf1a94e0c862ede09e37  P0-03_MC-Test_Woche_07.json
0aa5728c767e85b8fd4a2ef99f7b18553b4558ad0557df79b3685c784711805c  P0-03_MC-Test_Woche_08.json
6d9720b6e5ab6f75ced91e302b6307e1df3c02ae248d7c6a59982503dc3a740a  P0-03_MC-Test_Woche_09.json
f011b7d65f99c78a6198a7f196ab489e84d27058dd2e302732cf5701ef1ace6b  P0-03_MC-Test_Woche_10.json
```

Nach jeder inhaltlichen Änderung an JSON oder CSV sind die Prüfsummen neu zu erzeugen und die betroffenen statischen Prüfungen erneut auszuführen. Die endgültige Paketprovenienz wird zusätzlich durch den Git-Commit bestimmt.

## 6. Freigabevermerk

Die drei P0-Arbeitspakete sind dokumentarisch und statisch umgesetzt:

1. Kerncurriculum und prüfbare Lernzielmatrix,
2. Datenmanagement- und Exportplan,
3. vollständiges versioniertes Lehrmaterialpaket.

Der Stand darf als Review-Kandidat weitergegeben werden. Er ist noch nicht für einen realen Pilotlauf freigegeben, solange mindestens ein Gate aus Abschnitt 4 offen ist.
