# Gewertete F2-Label-Reihe, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat nach Freigabe drei Label-Aufträge unter Firewall-DROP mit
Live-Last ausgeführt. Vorab reduzierter Umfang gemäß
[Planung](../../1B-3u4-Planung.md).

- Ausführungs- und Auswertungscommit:
  `7c64dd6a0352df1e51981ab16300532eb849f712`, ohne `--arbeitsstand`.
- Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
  31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.
- Node: beide VM-Hosts v24.22.3, App-Container v24.19.0.
- Lauf-ID `20261116T185346-f2-label`, lokal etwa 19:53–20:13 Uhr MEZ.
- [Ergebnis-JSON](messung/2026-11-16-lauf-f2-label.json).
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T185346-f2-label\`:
  Treiber, App-Log, Transport-TSVs, Journal und Nachprüfungen.
  PCAPs mit Token bleiben lokal. Repo-JSON und lokales Ergebnis identisch.

Korpus `label-identical-pair-v1`, Encoder und Settings unverändert gegenüber
[eigener F1/B0-Label-Referenz](2026-11-16-lauf-f1-label.md).
Manifestvergleich `comparable=true`; `buildExperimentResult` reproduziert
das gespeicherte Experimentergebnis. Effektiver Label-Timeout 30 000 ms;
Labor-/Summaryparameter 300 000 ms ist nicht der Label-Timeout.

## Störung und Ergebnis

Alle Zahlen gelten für den genannten Rechner und Commit. Journal auf llm-host:
18:54:26 UTC Regel eingefügt und anschließend im Kernel bestätigt:

```bash
sudo ufw insert 1 deny in on eth0 proto tcp from 192.168.150.10 to 192.168.150.20 port 8080 comment arsnova-1b-experiment
```

Bestätigte Kernel-Regel:

```text
-A ufw-user-input -s 192.168.150.10/32 -d 192.168.150.20/32 -i eth0 -p tcp -m tcp --dport 8080 -j DROP
```

Alle drei Aufträge `ready`, `effectiveMode=SEMANTIC`,
`labelSettlement=transient`, `labelModelAccepted=false`. Je ein tatsächlicher
Verbindungsversuch, keine HTTP-Antwort, kein Completion-POST, kein TCP-RST.
Keine rein lokale Breaker-Antwort. Encoder bleibt verfügbar.

| Auftrag | Client-Wartezeit in ms |
| ------- | ---------------------: |
| 1       |                 30 040 |
| 2       |                 30 038 |
| 3       |                 30 043 |

Client-Median 30 040 ms, Spanne 30 038–30 043 ms. Gegenüber dem F1-Client-Median
37,5 ms entspricht das Faktor 801,07. Dies ist ein ausdrücklich als solcher
berichteter Client-Zeitvergleich, kein Nachweis des internen H-F1F2-Kriteriums:
interne Label-Job-Zeit und Fallback-Grund fehlen. `f2OverF1.passed=null` bleibt
nicht bewertbar; auch die interne Fallback-Frist wird nicht als PASS ausgegeben.

F1 liefert TCP-RST und einen schnellen Client-Rücklauf; F2 bleibt ohne
Netzantwort bis zum zum Label-Budget passenden Rücklauf. Die langen Abstände
der Aufträge erlauben keinen gerichteten Nachweis des Breaker-Verlaufs.

## Live-Last und Ressourcen

Alle drei Live-, Ressourcen- und Gesamtfenster vollständig, 498 gültige
RSS-Proben. Insgesamt 4 800 erfolgreiche Live-Aktionen ohne Fehler.
Profil: 500 Ankünfte, 90-s-Rampe, Freigabe bei 270 s, Dauer 330 s;
keine dauerhaft konstante Konkurrenz von 500 Personen.

Vergleich `compareExperiments(b0, f2)`, p95 aus zusammengeführten Einzelzeiten,
unverändert höchstens 110 % des B0-p95. B0 zehn Fenster, F2 drei Fenster.

| Aktion             | B0-Aktionen | F2-Aktionen | Fehler B0 / F2 | B0-p95 ms | F2-p95 ms |  Änderung | Schwelle      |
| ------------------ | ----------: | ----------: | -------------: | --------: | --------: | --------: | ------------- |
| Beitritt           |       5 000 |       1 500 |          0 / 0 |     32,90 |     54,06 |  +64,34 % | überschritten |
| Quizstimme         |       5 000 |       1 500 |          0 / 0 |     32,14 |     25,53 |  −20,57 % | eingehalten   |
| Q&A-Einreichung    |       1 000 |         300 |          0 / 0 |     15,71 |     16,60 |   +5,67 % | eingehalten   |
| Blitzlicht-Antwort |       5 000 |       1 500 |          0 / 0 |     16,96 |     38,67 | +127,95 % | überschritten |

H2-Fehler ohne zusätzliche Fehler beobachtet. H2-Latenz für diese Reihe nicht
erfüllt. Kleine Fallprüfung mit drei Inferenzaufträgen, keine belastbare
Aussage über seltene Fehler oder stabile Tail-Latenz. Keine alleinige
Kausalzuordnung zum DROP aus zeitlich aufeinanderfolgenden Reihen auf einem
gemeinsam genutzten Host ohne CPU-Pinning. Schwellen bleiben unverändert.

App-Prozess-RSS maximal 480 575 488 Bytes; gemeinsame Seiten können mehrfach
gezählt sein. Maximale App-CPU 40,89 % einer logischen CPU aus cgroup-Deltas.
Runtime-Speicher maximal 3 043 549 184 Bytes bei 73 Proben; kein Neustart/OOM
in der Aufzeichnung.

## Rücknahme und Abschluss

Regel um 19:12:36 UTC zurückgenommen:

```bash
sudo ufw --force delete deny in on eth0 proto tcp from 192.168.150.10 to 192.168.150.20 port 8080 comment arsnova-1b-experiment
```

Rücknahme `restored=true, variant=f2`, Wiederherstellung `checksPassed=true`;
beide VM-Prüfungen einschließlich Testinferenz nach frischem Runtime-Start
bestanden. F2/Label mit dem vorab reduzierten Umfang vollständig.

Das gekürzte Label-Programm ist abgeschlossen. Gerichteter Queue-/Breaker-
Nachweis, Transportauswertung und Schritt 4 sind weiterhin offen. Keine
zusätzlichen optionalen Label-Varianten geplant.
