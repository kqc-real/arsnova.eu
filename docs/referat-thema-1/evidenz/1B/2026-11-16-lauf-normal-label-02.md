# Gewertete Label-Normalreihe, Teil 2, 2026-11-16

Prüfung durch den Autor: offen.

## Umgebung und Quellen

Niklas hat nach Freigabe die zweite Teilreihe mit zehn Label-Normalaufträgen
und Live-Last ausgeführt, regulär ohne `--arbeitsstand`.

- Ausführungs- und Auswertungscommit:
  `7c64dd6a0352df1e51981ab16300532eb849f712`.
- Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
  31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.
- Node: beide VM-Hosts v24.22.3, App-Container v24.19.0.
- Lauf-ID `20261116T120236-normal-label-02`, lokal etwa 13:02–14:04 Uhr MEZ.
- [Ergebnis-JSON](messung/2026-11-16-lauf-normal-label-02.json).
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T120236-normal-label-02\`:
  Treiber, App-Log, Transport-TSVs, Settings, Versionen und Nachprüfungen.
  PCAPs mit Token bleiben lokal; Repo-JSON und lokales Ergebnis sind identisch.

## Konfiguration und Reproduzierbarkeit

Korpus `label-identical-pair-v1`, neue Session je Auftrag. Die identische
Textpaarung prüft den Label-Pfad, nicht semantische Modellqualität.
Encoder aktiviert, Image-ID
`sha256:95385bb591cbaefa544b199b16099aa3acc4433e448ead4a920b8cf9d43d969c`.

Settings aus `app-container-environment`: Encoder-Timeout 120 000 ms,
LLM-Label-Timeout 30 000 ms, SEMANTIC und LLM aktiviert, NLP/QA-NLP deaktiviert.
Summary-/Laborparameter 300 000 ms ist nicht der Label-Timeout.
Der Vergleicher bestätigt die Manifest-Kompatibilität mit
[Teil 1](2026-11-16-lauf-normal-label-01.md).
`buildExperimentResult` reproduziert das gespeicherte Experimentergebnis.
Dies ist noch kein Vergleich mit einer Label-B0/F1-Referenz.

## Label-Ergebnisse

Alle Zahlen gelten für den oben genannten Rechner und Commit.
Alle zehn Jobs: `status=ready`, `effectiveMode=SEMANTIC`,
`labelSettlement=complete`, `labelModelAccepted=true`.
Je Auftrag eine Verbindung, eine Slot-Abfrage und ein Completion-POST;
Slot und Completion jeweils HTTP 200, kein RST.

| Auftrag | Client-Wartezeit in ms |
| ------- | ---------------------: |
| 1       |                  5 845 |
| 2       |                  3 490 |
| 3       |                  3 526 |
| 4       |                  3 488 |
| 5       |                  3 518 |
| 6       |                  3 539 |
| 7       |                  3 465 |
| 8       |                  3 521 |
| 9       |                  3 476 |
| 10      |                  3 527 |

Median aller zehn Aufträge 3 519,5 ms. Erster Auftrag nach frischem LLM-Start
5 845 ms; Median der neun folgenden Aufträge 3 518 ms. Keine Aussage über
einen vollständig kalten Encoder; die bestehende Vorwärmung bleibt aktiv.
Interne Label-Job-/Inferenzzeit und Fallback-Grund sind nicht von der API
bereitgestellt. `fallbackWithinBudget=null` ist nicht PASS. Kein Nachweis
eines Transportanteils unter 5 % aus den Client-Zeiten allein.

## Live-Last und Ressourcen

Alle zehn Live-, Ressourcen- und Gesamtfenster vollständig: 1 660 gültige
RSS-Proben, 16 000 erfolgreiche Aktionen ohne Fehler. Je Fenster 500 Ankünfte,
90-s-Rampe, Ergebnisfreigabe bei 270 s und Dauer 330 s; keine dauerhaft
konstante Konkurrenz von 500 Personen. p95 aus zusammengeführten Einzelzeiten.

| Aktion             | Erfolge | Fehler | p95 in ms |
| ------------------ | ------: | -----: | --------: |
| Beitritt           |   5 000 |      0 |     40,39 |
| Quizstimme         |   5 000 |      0 |     32,23 |
| Q&A-Einreichung    |   1 000 |      0 |     15,76 |
| Blitzlicht-Antwort |   5 000 |      0 |     18,53 |

App-Prozess-RSS maximal 476 446 720 Bytes; gemeinsame Seiten können mehrfach
gezählt sein. Maximale App-CPU 42,01 % einer logischen CPU aus cgroup-Deltas.
Runtime-Speicher maximal 3 198 517 248 Bytes bei 245 Proben; kein Runtime-
Neustart und kein OOM in der Aufzeichnung.

Keine zusätzlichen Live-Fehler beobachtet. H2-Latenz bleibt offen, bis eine
passende Label-B0/F1-Referenz mit gleichem Encoder, Korpus, Commit,
Node-Versionen und Settings vorliegt. Die Summary-F1-Reihe ersetzt sie nicht.

## Abschluss und gemeinsame Einordnung

`wiederherstellung.json` meldet `restored=true, checksPassed=true`.
Beide VM-Prüfungen einschließlich Testinferenz bestanden nach frischem
Runtime-Start. Encoder und SEMANTIC bleiben aktiv.

Zusammen mit Teil 1 sind 20 der geplanten 30 Label-Normalaufträge ausgewertet,
alle mit übernommener Modellantwort. Teil 3 fehlt. Der gemeinsame Median der
20 Client-Wartezeiten beträgt 3 512,5 ms; ohne den ersten Auftrag jeder
Teilreihe beträgt der Median der 18 folgenden Aufträge 3 504,5 ms.
Diese gemeinsame Betrachtung ersetzt weder die noch offene dritte Teilreihe
noch den Vergleich gegen die eigene Label-B0/F1-Referenz.

Nächster vorgeschlagener Lauf: `normal-label-03`, zehn Aufträge auf demselben
Ausführungscommit und mit unveränderter Konfiguration. Eigene Freigabe vor
Start erforderlich. Schritt 3 insgesamt bleibt offen.
