# Gewertete L2-Label-Reihe, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat nach Freigabe drei Label-Aufträge mit +500 ms Antwortverzögerung
und Live-Last ausgeführt. Reduzierter Umfang vor dem Lauf auf seinen Wunsch
festgelegt, siehe [Planung](../../1B-3u4-Planung.md).

- Ausführungs- und Auswertungscommit:
  `7c64dd6a0352df1e51981ab16300532eb849f712`, ohne `--arbeitsstand`.
- Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
  31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.
- Node: beide VM-Hosts v24.22.3, App-Container v24.19.0.
- Lauf-ID `20261116T180652-l2-label`, lokal etwa 19:06–19:26 Uhr MEZ.
- [Ergebnis-JSON](messung/2026-11-16-lauf-l2-label.json).
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T180652-l2-label\`:
  Treiber, Transport-TSVs, App-Log, Störungsjournal und Nachprüfungen.
  PCAPs mit Token bleiben lokal. Repo-JSON und lokales Ergebnis identisch.

Korpus `label-identical-pair-v1`, Encoder und Settings unverändert gegenüber
[eigener F1/B0-Label-Referenz](2026-11-16-lauf-f1-label.md).
Manifestvergleich `comparable=true`, Neuberechnung mit `buildExperimentResult`
reproduziert das gespeicherte Experimentergebnis. Effektiver Label-Timeout
30 000 ms, Encoder-Timeout 120 000 ms; Laborparameter 300 000 ms ist nicht
der Label-Timeout.

## Störung und Label-Ergebnisse

Alle Zahlen gelten für den genannten Rechner und Commit. Journal auf llm-host:
18:07:33 UTC root-qdisc `1b00:` und netem-Kind `1b30:` mit `delay 500ms`
auf `eth0`. Filter nur für Ziel `192.168.150.10/32`, Quellport 8080;
SSH ausgenommen. Befehle aus `faultCommands('l2', 'eth0')` in `experiment.mjs`
im Journal. Rücknahme um 18:25:37 UTC:
`sudo tc qdisc del dev eth0 root handle 1b00:`.

Verbindungsaufbau im App-Mitschnitt: SYN–SYN/ACK-Abstände 500,772 ms,
500,787 ms und 500,433 ms. Runtime-Mitschnitt: 500,102 ms, 500,170 ms und
500,112 ms. Auswertung wie in der
[L1-Entwicklungsprobe](2026-11-16-lauf-dev-l1-label.md#störung-und-beobachtete-wirkung),
mit lokalen Zeitdifferenzen je Mitschnitt. Wirkung sichtbar; TCP-/Scheduler-
und Transportanteile enthalten, keine mikrosekundengenaue Aussage über alle
Antwortpakete aus dem SYN-Abstand allein.

Alle drei Aufträge `ready`, `effectiveMode=SEMANTIC`,
`labelSettlement=complete`, `labelModelAccepted=true`. Je eine Verbindung,
Slot-Abfrage und Completion-POST, beide HTTP 200, kein RST.

| Auftrag | Client-Wartezeit in ms |
| ------- | ---------------------: |
| 1       |                  7 417 |
| 2       |                  5 086 |
| 3       |                  5 061 |

Median aller drei 5 086 ms. Erster Auftrag nach frischem LLM-Start 7 417 ms;
Median der zwei folgenden 5 073,5 ms. Encoder-Vorwärmung bleibt aktiv.
Interne Job-/Inferenzzeit und Fallback-Grund von der Label-API nicht
bereitgestellt; fehlende Zeiten sind kein bestandener Fallback-Fristnachweis.
Identische Textpaarung ist eine Last-/Fehlerfixture, keine Qualitätsstudie.

## Live-Last gegenüber B0/F1

Alle drei Live-, Ressourcen- und Gesamtfenster vollständig, 498 gültige
RSS-Proben. Insgesamt 4 800 erfolgreiche Live-Aktionen ohne Fehler.
Profil unverändert: 500 Ankünfte, 90-s-Rampe, Freigabe bei 270 s,
Fenster 330 s; keine dauerhaft konstante Konkurrenz von 500 Personen.

Vergleich `compareExperiments(b0, l2)`, unveränderte Schwelle von höchstens
110 % des B0-p95. p95 aus zusammengeführten Einzelzeiten.

| Aktion             | B0-Aktionen | L2-Aktionen | Fehler B0 / L2 | B0-p95 ms | L2-p95 ms | Änderung | Schwelle    |
| ------------------ | ----------: | ----------: | -------------: | --------: | --------: | -------: | ----------- |
| Beitritt           |       5 000 |       1 500 |          0 / 0 |     32,90 |     34,14 |  +3,77 % | eingehalten |
| Quizstimme         |       5 000 |       1 500 |          0 / 0 |     32,14 |     31,12 |  −3,17 % | eingehalten |
| Q&A-Einreichung    |       1 000 |         300 |          0 / 0 |     15,71 |     14,72 |  −6,32 % | eingehalten |
| Blitzlicht-Antwort |       5 000 |       1 500 |          0 / 0 |     16,96 |     17,54 |  +3,37 % | eingehalten |

H2-Fehler und H2-Latenz in dieser Reihe erfüllt. Nur drei Inferenzaufträge,
kein belastbarer Nachweis seltener Fehler oder stabiler Tail-Latenz über viele
Inferenzzyklen. Zeitlich getrennte Reihen auf gemeinsam genutztem Host ohne
CPU-Pinning; kein Kausalnachweis, dass höhere Netzlatenz den App-Host entlastet.
Die abweichenden Befunde aus Normalbetrieb und L1 bleiben erhalten und werden
nicht durch dieses bestandene Teilergebnis ersetzt.

## Ressourcen und Abschluss

App-Prozess-RSS maximal 481 075 200 Bytes; gemeinsame Seiten können mehrfach
gezählt sein. Maximale App-CPU 42,31 % einer logischen CPU aus cgroup-Deltas.
Runtime-Speicher maximal 3 195 973 632 Bytes bei 73 Proben, kein Neustart/OOM
in der Aufzeichnung. Rücknahme `restored=true, variant=l2`, Wiederherstellung
`checksPassed=true`; beide VM-Prüfungen einschließlich Testinferenz bestanden.

L2 mit dem vorab gekürzten Umfang vollständig. Nächster Vorschlag: L3/Label,
drei Aufträge. Keine weitere L2-Teilreihe geplant; neuer Lauf und Störung
benötigen eigene Freigabe.
