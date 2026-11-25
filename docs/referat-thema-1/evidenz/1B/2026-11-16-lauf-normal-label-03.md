# Gewertete Label-Normalreihe, Teil 3 und Gesamtauswertung, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat nach Freigabe die dritte Teilreihe mit zehn Label-Normalaufträgen
und Live-Last ausgeführt, regulär ohne `--arbeitsstand`.

- Ausführungs- und Auswertungscommit aller drei Teile:
  `7c64dd6a0352df1e51981ab16300532eb849f712`.
- Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
  31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.
- Node: beide VM-Hosts v24.22.3, App-Container v24.19.0.
- Lauf-ID `20261116T131108-normal-label-03`, lokal etwa 14:11–15:13 Uhr MEZ.
- [Ergebnis-JSON Teil 3](messung/2026-11-16-lauf-normal-label-03.json.gz),
  [Teil 1](2026-11-16-lauf-normal-label-01.md),
  [Teil 2](2026-11-16-lauf-normal-label-02.md).
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T131108-normal-label-03\`:
  Treiber, App-Log, Transport-TSVs, Settings, Versionen und Nachprüfungen.
  PCAPs mit Token bleiben lokal; Repo-JSON und lokales Ergebnis sind identisch.

## Konfiguration und Reproduzierbarkeit

Korpus `label-identical-pair-v1`, neue Session je Auftrag. Identische Textpaarung
als Last-/Fehlerfixture; keine Aussage über semantische Modellqualität.
Encoder aktiviert, Image-ID
`sha256:95385bb591cbaefa544b199b16099aa3acc4433e448ead4a920b8cf9d43d969c`.

Settings aus `app-container-environment`: Encoder-Timeout 120 000 ms,
LLM-Label-Timeout 30 000 ms, SEMANTIC und LLM aktiviert, NLP/QA-NLP deaktiviert.
Summary-/Laborparameter 300 000 ms ist nicht der Label-Timeout.
Der Vergleicher bestätigt die Manifest-Kompatibilität mit beiden vorherigen
Teilreihen. `buildExperimentResult` reproduziert das gespeicherte
Experimentergebnis. Noch keine Label-B0/F1-Referenz vorhanden.

## Ergebnisse von Teil 3

Alle Zahlen gelten für den oben genannten Rechner und Commit.
Alle zehn Jobs: `status=ready`, `effectiveMode=SEMANTIC`,
`labelSettlement=complete`, `labelModelAccepted=true`.
Je Auftrag eine Verbindung, eine Slot-Abfrage und ein Completion-POST;
Slot und Completion jeweils HTTP 200, kein RST.

| Auftrag | Client-Wartezeit in ms |
| ------- | ---------------------: |
| 1       |                  5 909 |
| 2       |                  3 484 |
| 3       |                  3 532 |
| 4       |                  3 490 |
| 5       |                  3 518 |
| 6       |                  3 487 |
| 7       |                  3 472 |
| 8       |                  3 475 |
| 9       |                  3 514 |
| 10      |                  3 554 |

Median aller zehn Aufträge 3 502 ms. Erster Auftrag nach frischem LLM-Start
5 909 ms; Median der neun folgenden Aufträge 3 490 ms. Die bestehende
Encoder-Vorwärmung bleibt aktiv; keine vollständig kalte Encoder-Messung.

Alle zehn Live-, Ressourcen- und Gesamtfenster vollständig: 1 660 gültige
RSS-Proben, 16 000 erfolgreiche Aktionen ohne Fehler. Je Fenster 500 Ankünfte,
90-s-Rampe, Ergebnisfreigabe bei 270 s und Dauer 330 s; keine dauerhaft
konstante Konkurrenz von 500 Personen.

| Aktion             | Erfolge | Fehler | p95 in ms |
| ------------------ | ------: | -----: | --------: |
| Beitritt           |   5 000 |      0 |     37,00 |
| Quizstimme         |   5 000 |      0 |     31,36 |
| Q&A-Einreichung    |   1 000 |      0 |     15,69 |
| Blitzlicht-Antwort |   5 000 |      0 |     19,57 |

p95 aus zusammengeführten Einzelzeiten, Rang `ceil(0,95 × n)` der sortierten
Messwerte. App-Prozess-RSS maximal 479 825 920 Bytes; gemeinsame Seiten können
mehrfach gezählt sein. Maximale App-CPU 40,81 % einer logischen CPU aus
cgroup-Deltas. Runtime-Speicher maximal 3 197 362 176 Bytes bei 245 Proben;
kein Runtime-Neustart und kein OOM in der Aufzeichnung.

`wiederherstellung.json` meldet `restored=true, checksPassed=true`.
Beide VM-Prüfungen einschließlich Testinferenz bestanden nach frischem
Runtime-Start. Encoder und SEMANTIC bleiben aktiv.

## Gesamtauswertung der Label-Normalreihe

Auf identischem Rechner und Commit sind alle geplanten 30 Normalaufträge
vollständig erhoben. Alle Modellantworten wurden übernommen. Zusammen 4 980
RSS-Proben und 48 000 erfolgreiche Live-Aktionen ohne Fehler.

Median der 30 Client-Wartezeiten 3 512 ms. Die drei ersten Aufträge nach
jeweils frischem LLM-Start sind in den Teilprotokollen separat ausgewiesen;
ohne diese beträgt der Median der 27 folgenden Aufträge 3 499 ms.

| Aktion             | Erfolge | Fehler | gemeinsamer p95 in ms |
| ------------------ | ------: | -----: | --------------------: |
| Beitritt           |  15 000 |      0 |                 38,64 |
| Quizstimme         |  15 000 |      0 |                 32,22 |
| Q&A-Einreichung    |   3 000 |      0 |                 15,79 |
| Blitzlicht-Antwort |  15 000 |      0 |                 18,34 |

Auch diese p95-Werte sind aus allen einzelnen Aktionszeiten berechnet,
nicht aus gemittelten Teilreihen-p95. Globales App-RSS-Maximum 505 012 224 Bytes,
CPU-Maximum 54,82 % einer logischen CPU; gleiche Messgrenzen wie oben.

Die Normalreihe ist abgeschlossen, Schritt 3 insgesamt noch offen. H2-Latenz
ist erst gegen die eigene Label-B0/F1-Referenz bewertbar; die frühere
Summary-Referenz ersetzt sie nicht. Interne Label-Job-/Inferenzzeit und
Fallback-Grund liefert die API nicht. `fallbackWithinBudget=null` ist nicht
PASS, der Transportanteil unter 5 % ist aus Client-Zeiten allein nicht belegt.

Nächster vorgeschlagener Lauf ist die eigene F1/B0-Label-Reihe mit zehn
Aufträgen und Live-Last auf demselben Commit. Dafür Runtime nach frischem
Start stoppen, nachher wieder starten und beide VMs prüfen. Lauf und Störung
benötigen eine eigene Freigabe.
