# Gewertete Label-Normalreihe, Teil 1, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat nach Freigabe zehn der geplanten 30 Label-Normalaufträge mit
Live-Last ausgeführt, auf regulärem Commit ohne `--arbeitsstand`.

- Ausführungs- und Auswertungscommit:
  `7c64dd6a0352df1e51981ab16300532eb849f712`.
- Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
  31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.
- Node: beide VM-Hosts v24.22.3, App-Container v24.19.0.
- Lauf-ID `20261116T104243-normal-label-01`, lokal etwa 11:42–12:44 Uhr MEZ.
- [Ergebnis-JSON](messung/2026-11-16-lauf-normal-label-01.json).
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T104243-normal-label-01\`:
  Treiber, App-Log, Transport-TSVs, Settings, Versionen und Nachprüfungen.
  PCAPs mit Token bleiben lokal; Repo-JSON und lokales Ergebnis sind identisch.

## Konfiguration und Manifest

Korpus `label-identical-pair-v1`, pro Auftrag eine neue Session gegen den
sessionspezifischen Label-Cache. Keine Bewertung semantischer Modellqualität
aus der gezielt identischen Textpaarung. Encoder bleibt aktiviert, Image-ID
`sha256:95385bb591cbaefa544b199b16099aa3acc4433e448ead4a920b8cf9d43d969c`.

Die erstmals im VM-Lauf geprüfte Manifest-Erfassung funktioniert:
`settingsSource=app-container-environment`, Encoder-Timeout 120 000 ms,
LLM-Label-Timeout 30 000 ms, SEMANTIC und LLM aktiviert, NLP/QA-NLP deaktiviert.
Summary-/Laborparameter 300 000 ms ist nicht der Label-Timeout.
Node-Versionen und Korpuskennung sind vorhanden. Die Vollständigkeitsprüfung
des Vergleichers akzeptiert dieses Manifest; daraus wird kein hypothetischer
Vergleich mit einer noch nicht vorhandenen Label-B0-Referenz abgeleitet.

## Label-Ergebnisse

Alle Zahlen gelten für den oben genannten Rechner und Commit.
Alle zehn Jobs: `status=ready`, `effectiveMode=SEMANTIC`,
`labelSettlement=complete`, `labelModelAccepted=true`.
Je Auftrag eine Verbindung, eine Slot-Abfrage und ein Completion-POST;
Slot und Completion jeweils HTTP 200, kein RST. App-Telemetrie bestätigt
`labelModelCalled=true`, null Label-Cache-Hits und zwei Label-Cache-Misses
je Auftrag. Alle zehn Modellantworten wurden übernommen.

| Auftrag | Client-Wartezeit in ms |
| ------- | ---------------------: |
| 1       |                  5 931 |
| 2       |                  3 526 |
| 3       |                  3 515 |
| 4       |                  3 487 |
| 5       |                  3 499 |
| 6       |                  3 469 |
| 7       |                  3 510 |
| 8       |                  3 483 |
| 9       |                  3 489 |
| 10      |                  3 533 |

Median aller zehn Aufträge 3 504,5 ms. Erster Label-Auftrag nach frischem
LLM-Start 5 931 ms; Median der neun folgenden Aufträge 3 499 ms.
Das ist keine Aussage über einen vollständig kalten Encoder: Die bestehende
Vorwärmung bleibt aktiv, App-Telemetrie meldet `encoderCalled=false` beim
Analyseaufruf. Jeder Auftrag spricht dennoch die LLM-Runtime tatsächlich an.

Neuberechnung mit `buildExperimentResult` reproduziert das gespeicherte
Experimentergebnis. Interne Label-Job-/Inferenzzeit und Fallback-Grund bleiben
nicht von der API bereitgestellt. `fallbackWithinBudget=null` ist nicht PASS.
Kein Nachweis eines Transportanteils unter 5 % aus den Client-Zeiten allein.

## Live-Last und Ressourcen

Alle zehn Live-, Ressourcen- und Gesamtfenster vollständig: 1 660 gültige
RSS-Proben, 16 000 erfolgreiche Aktionen ohne Fehler. Je Fenster 500 Ankünfte,
90-s-Rampe, Ergebnisfreigabe bei 270 s und Dauer 330 s; keine dauerhaft
konstante Konkurrenz von 500 Personen. p95 aus zusammengeführten Einzelzeiten.

| Aktion             | Erfolge | Fehler | p95 in ms |
| ------------------ | ------: | -----: | --------: |
| Beitritt           |   5 000 |      0 |     38,57 |
| Quizstimme         |   5 000 |      0 |     32,74 |
| Q&A-Einreichung    |   1 000 |      0 |     15,91 |
| Blitzlicht-Antwort |   5 000 |      0 |     16,74 |

App-Prozess-RSS maximal 505 012 224 Bytes; gemeinsame Seiten können mehrfach
gezählt sein. Maximale App-CPU 54,82 % einer logischen CPU aus cgroup-Deltas.
Runtime-Speicher maximal 3 197 698 048 Bytes bei 244 Proben; kein Runtime-
Neustart und kein OOM in der Aufzeichnung.

Keine zusätzlichen Live-Fehler beobachtet. H2-Latenz noch nicht bewertbar:
die passende Label-B0/F1-Referenz mit gleichem Encoder, Korpus, Commit,
Node-Versionen und Settings fehlt. Die frühere Summary-F1-Reihe ist kein
Ersatz, weil Verbraucher und Umgebung abweichen.

## Abschluss und offene Arbeit

`wiederherstellung.json` meldet `restored=true, checksPassed=true`.
Beide VM-Prüfungen einschließlich Testinferenz bestanden nach frischem
Runtime-Start. Encoder und SEMANTIC bleiben aktiv.

Teil 1 ist vollständig erhoben und ausgewertet; 20 der geplanten 30
Label-Normalaufträge fehlen. Die Entwicklungsproben zählen nicht mit.
Teil 2 und Teil 3 auf demselben Ausführungscommit und unveränderter
Konfiguration, jeweils erst nach eigener Freigabe. Danach eigene Label-B0/F1-
Referenz und übrige Störvarianten; kein vorgezogener Isolationsnachweis.
