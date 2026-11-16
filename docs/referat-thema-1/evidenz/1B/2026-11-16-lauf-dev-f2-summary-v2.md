# Entwicklungslauf dev-f2-summary-v2, 2026-11-16

Prüfung durch den Autor: offen.

## Umgebung und Quellen

Niklas hat nach Freigabe einen Summary-Auftrag mit Live-Last und korrigierter
F2-Störung ausgeführt. Diese Entwicklungsprobe bestätigt die DROP-Wirkung und
die Rücknahme; sie ersetzt nicht die geplante gewertete Reihe mit fünf Aufträgen.

- Ausführungscommit: `2b39b9dfc13aefd763fa4e0d8440a0536fa847f7`.
- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
  Windows 11 Pro, Hyper-V ohne CPU-Pinning.
- app-host: 2 vCPU/4 GiB RAM; llm-host: 8 vCPU/10 GiB RAM.
- Lokales Datum 2026-11-16, VM-Zeit UTC noch 2026-11-15;
  Lauf-ID `20261115T233212-dev-f2-summary-v2`.
- Summary-Budget ausdrücklich auf 300 000 ms gesetzt, keine Tageskalibrierung
  durch diesen Entwicklungslauf ersetzt. Erfasster Energiesparplan: Ausbalanciert;
  daraus folgt keine Aussage zum Windows-Energiemodus.
- Lokale Quellen unter
  `%USERPROFILE%\labor-1b\20261115T233212-dev-f2-summary-v2\`:
  `ergebnis.json`, `experiment.json`, `treiber.json`, `app.tsv`, `srv.tsv`,
  `stoerung-journal.jsonl`, Rücknahme- und Wiederherstellungsberichte sowie
  `pruefen-app.txt` und `pruefen-llm.txt`. Rohdaten und PCAPs bleiben lokal.

## Aktivierung und beobachteter Fehlerpfad

Alle Zahlen beziehen sich auf den genannten Rechner und Ausführungscommit.
Das Journal enthält auch ältere Läufe; für diesen Versuch gilt ausschließlich
der Abschnitt ab 23:32:50 UTC (00:32:50 Uhr MEZ).

Aktivierung in der llm-host-VM:

```bash
sudo ufw insert 1 deny in on eth0 proto tcp from 192.168.150.10 to 192.168.150.20 port 8080 comment arsnova-1b-experiment
```

ufw meldet `Rule inserted`. Der Helfer bestätigt den eigenen ufw-Eintrag und
die vorrangige Kernelregel:

```text
-A ufw-user-input -s 192.168.150.10/32 -d 192.168.150.20/32 -i eth0 -p tcp -m tcp --dport 8080 -j DROP
```

Die Transportaufzeichnung zeigt elf SYN-Pakete derselben Verbindung vom
app-host, keine Antwort der Runtime, keinen RST und keinen HTTP-Verkehr.
Die Auswertung meldet einen Verbindungsversuch, null Slot-Abfragen, null
Completion-POSTs und `faultObserved=true`. Anders als in der
[ersten Probe](2026-11-16-lauf-dev-f2-summary.md) hat keine Inferenz stattgefunden.

Der Summary-Endstatus ist `ready`, `extractive/unavailable`. Die backendseitige
Job-Zeit beträgt 135 419 ms, die clientseitige Wartezeit 136 294 ms.
`fallbackWithinBudget=true`: Der Fallback liegt innerhalb des gesetzten Budgets.
Der Verbindungsaufbau scheitert hier vor Ablauf des Summary-Budgets; dies ist
kein Nachweis des Summary-Timeouts oder des internen Circuit-Breaker-Zustands.
Ein gewertetes F2/F1-Medianverhältnis wird aus dieser Einzelprobe und den
F1-Daten eines anderen Ausführungscommits nicht abgeleitet.

## Live-Last und Ressourcen

Ein vollständiges 330-s-Fenster mit 500 Ankünften, 90-s-Rampe und
Ergebnisfreigabe bei 270 s; keine dauerhaft konstante Konkurrenz von 500 Personen.
Live-, Ressourcen- und Gesamtmessung sind vollständig, 166 gültige RSS-Proben.

| Aktion             | Erfolgreich | Fehler | p95 in ms |
| ------------------ | ----------: | -----: | --------: |
| Beitritt           |         500 |      0 |     28,90 |
| Quizstimme         |         500 |      0 |     32,01 |
| Q&A-Einreichung    |         100 |      0 |     15,42 |
| Blitzlicht-Antwort |         500 |      0 |     13,62 |

App-Prozess-RSS maximal 472 104 960 Bytes; gemeinsame Seiten können mehrfach
gezählt sein. Maximale gemessene App-CPU 38,14 % einer logischen CPU, aus
cgroup-Deltas. Kein gewerteter H2-Vergleich aus diesem Entwicklungslauf.

## Rücknahme und Nachprüfung

Rücknahme um 23:38:36 UTC (00:38:36 Uhr MEZ):

```bash
sudo ufw --force delete deny in on eth0 proto tcp from 192.168.150.10 to 192.168.150.20 port 8080 comment arsnova-1b-experiment
```

Der Helfer bestätigt die Rücknahme mit `restored=true, variant=f2` einschließlich
Prüfung der Kernelregeln. Nach frischem Runtime-Start bestehen beide
VM-Prüfungen; `wiederherstellung.json` meldet `restored=true, checksPassed=true`.
Die Runtime ist gesund, die Testinferenz erfolgreich. Kein OOM und keine
Runtime-Neustarts innerhalb der erfassten Ressourcenproben.

## Konsequenz

Der korrigierte F2-Helfer ist erstmals durch einen wirksamen VM-Versuch bestätigt.
Vor der gewerteten Reihe: Tageskalibrierung gesondert freigeben und ausführen,
Vergleichbarkeit mit den bisherigen Normal-/F1-Daten prüfen und dokumentieren.
Jeder weitere Lauf und jede Störung benötigen erneut Niklas' Freigabe.
