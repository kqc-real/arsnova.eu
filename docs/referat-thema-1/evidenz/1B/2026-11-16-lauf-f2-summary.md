# Gewertete F2-Summary-Reihe, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat die freigegebene Reihe mit fünf Summary-Aufträgen und Live-Last
über `labor-wsl.sh` selbst ausgeführt, ohne `--arbeitsstand`.

- Ausführungscommit: `2b39b9dfc13aefd763fa4e0d8440a0536fa847f7`.
- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
  Windows 11 Pro, Hyper-V ohne CPU-Pinning.
- app-host: 2 vCPU/4 GiB RAM; llm-host: 8 vCPU/10 GiB RAM.
- Lauf-ID `20261115T235806-f2-summary`; lokal 2026-11-16 von etwa
  00:58 bis 01:29 Uhr MEZ. Der Laufname verwendet UTC.
- [Ergebnis-JSON](messung/2026-11-16-lauf-f2-summary.json.gz),
  [Tageskalibrierung](2026-11-16-kalibrierung.md), Timeout explizit 300 000 ms.
  Erfasster Energiesparplan unverändert Ausbalanciert; Windows-Energiemodus
  nicht aus diesem Schema ableitbar.
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261115T235806-f2-summary\`:
  Treiber, App-Log, Transport-TSVs, Störungsjournal und Nachprüfungen.
  Mitschnitte mit Token bleiben lokal. Das Ergebnis-JSON wurde nicht verändert.

## Störung und Rücknahme

Das laufübergreifende Journal ist auf den Abschnitt ab 23:58:45 UTC zu begrenzen.
Die Regel wurde um 23:58:45 UTC gesetzt; ufw meldet `Rule inserted`, der Helfer
bestätigt den eigenen Eintrag und den vorrangigen DROP im Kernel.

```bash
sudo ufw insert 1 deny in on eth0 proto tcp from 192.168.150.10 to 192.168.150.20 port 8080 comment arsnova-1b-experiment
```

Jeder der fünf Aufträge zeigt einen eigenen TCP-Verbindungsversuch, keinen RST,
keinen HTTP-Status, keine Slot-Abfrage und keinen Completion-POST.
`faultObserved=true` bei allen fünf Aufträgen; keine reine Breaker-Antwort ohne
Netzversuch. Das bestätigt DROP, keine erfolgreiche Inferenz und keinen
Containerstopp als Ursache.

Rücknahme um 00:28:42 UTC, bestätigt um 00:28:43 UTC:

```bash
sudo ufw --force delete deny in on eth0 proto tcp from 192.168.150.10 to 192.168.150.20 port 8080 comment arsnova-1b-experiment
```

Rücknahme einschließlich Kernelprüfung erfolgreich; `restored=true` und
`checksPassed=true`. Beide VM-Prüfungen bestehen nach frischem Runtime-Start,
einschließlich Testinferenz. Während der Messung kein Runtime-Neustart und
kein OOM.

## Fallback und Vergleich mit F1

Alle folgenden F2-Zahlen gelten für den oben genannten Rechner und Commit.
Alle fünf Summary-Jobs erreichen `ready`, `extractive/unavailable`.

| Auftrag | Job-Zeit in ms | Client-Wartezeit in ms |
| ------- | -------------: | ---------------------: |
| 1       |        133 043 |                133 190 |
| 2       |        134 732 |                135 163 |
| 3       |        136 304 |                137 183 |
| 4       |        133 855 |                134 320 |
| 5       |        135 504 |                136 298 |

Median 134 732 ms, Maximum 136 304 ms: H2-Fallback erfüllt, alle Job-Zeiten
innerhalb Timeout + 1 s. Der Verbindungsaufbau scheitert vor dem Summary-Budget;
dies ist kein Nachweis eines Summary-Timeouts oder des internen Breaker-Zustands.

Die [F1-Referenz](2026-11-15-lauf-f1-summary.md) auf demselben Rechner wurde
mit Ausführungscommit `5e758d0a870bc38441b60c541a6ff6f3d0662ee2` gemessen.
Ihre zehn tatsächlichen Netzversuche ergeben Job-Zeiten
`57, 128, 48, 43, 117, 47, 47, 46, 48, 212` ms, Median 48 ms.
Das Verhältnis ist `134732 / 48 = 2806,9167`, also größer als 10:
H-F1F2 ist unter dem nachfolgend offengelegten Versionsvergleich erfüllt.

## Vergleichbarkeit und Auswertungsstand

Auswertungsstand ist `2b39b9df`. Die F1-Transportdaten wurden lokal mit
`buildExperimentResult` aus `experiment-config.json`, `treiber.json`, `app.log`
und `app.tsv` erneut berechnet. Der aktuelle Parser erkennt die dortigen
`True`/`False`-Flags; bei allen zehn F1-Jobs sind SYN und RST nachgewiesen.
Job-Zeiten und Live-Daten bleiben identisch. Die ursprünglichen Ergebnisdateien
bleiben erhalten, auch ihre damals unzutreffenden Transportfelder.

Die Manifestprojektion aus `vergleichen.mjs` unterscheidet sich zwischen F1
und F2 ausschließlich im Ausführungscommit. Insbesondere sind Images,
Modellhash, Settings, Energieprofil, VM-Größen und Live-Profile gleich.
Der [datierte Versionsnachtrag](../../1B/archiv/1B-3u4-Planung.md#nachtrag-2026-11-16-tageskalibrierung-und-vorbereitung-der-f2-reihe)
belegt unveränderten Produktionscode, Treiber und Messablauf; Änderungen
betreffen F2-Aktivierung/-Prüfung und TCP-Flag-Auswertung.

Der strikte automatische Vergleich meldet dennoch korrekt
`MANIFEST_MISSING_OR_DIFFERENT`, Kennzahlenstatus `null`.
Die hier berichtete Bewertung ist ein ausdrücklich dokumentierter
versionsübergreifender Vergleich nach dieser Prüfung, kein automatischer PASS.
Kein Manifest wurde angepasst. Für die Live-Kennzahlen wurde
`evaluateLiveComparison(F1.experiment.live, F2.experiment.live)` verwendet;
das Verhältnis verwendet nur Jobs mit nachgewiesenem Netzversuch.

## Live-Last und App-Ressourcen

Alle fünf Live-, Ressourcen- und Gesamtfenster vollständig; insgesamt
830 gültige RSS-Proben und 8 000 erfolgreiche Aktionen, keine Fehler.
Je Fenster 500 Ankünfte, 90-s-Rampe, Ergebnisfreigabe bei 270 s und 330 s
Messdauer; keine dauerhaft konstante Konkurrenz von 500 Personen.
Die p95-Werte sind aus den zusammengeführten Einzelzeiten je Aktion berechnet,
kein Mittelwert einzelner p95-Werte. Referenz ist B0/F1, Richtung F2 / F1.

| Aktion             | Erfolge F2 | Fehler F2 | p95 F1 in ms | p95 F2 in ms | Änderung | ≤ 110 % |
| ------------------ | ---------: | --------: | -----------: | -----------: | -------: | ------- |
| Beitritt           |      2 500 |         0 |        30,66 |        36,38 | +18,67 % | Nein    |
| Quizstimme         |      2 500 |         0 |        31,08 |        32,07 |  +3,17 % | Ja      |
| Q&A-Einreichung    |        500 |         0 |        14,67 |        15,22 |  +3,77 % | Ja      |
| Blitzlicht-Antwort |      2 500 |         0 |        11,25 |        11,25 |  −0,05 % | Ja      |

H2-Fehler erfüllt. H2-Latenz insgesamt nicht erfüllt: Beitritte überschreiten
die 10-%-Schwelle. Absolute Mehrzeit dort rund 5,72 ms. Unterschiedliche
Reihenlängen (F1 zehn, F2 fünf), zeitlich getrennte Messung und fehlendes
CPU-Pinning begrenzen die Interpretation. Kein kausaler Nachweis, dass DROP
die Abweichung verursacht; keine allgemeine Behauptung erfolgreicher Isolation.

Maximaler App-Prozess-RSS 472 752 128 Bytes; gemeinsame Seiten können mehrfach
gezählt sein. Maximale App-CPU 41,51 % einer logischen CPU aus cgroup-Deltas.
Runtime-Speicher maximal 3 043 569 664 Bytes bei 120 Proben; kein RSS-Ersatz.

## Ergebnis und offene Arbeit

Die geplante F2-Summary-Reihe ist erhoben und ausgewertet. DROP unterscheidet
sich deutlich vom schnellen RST-Fehler bei Containerstopp. Fallback und
Live-Fehlerkriterium bestehen, das Live-Latenzkriterium besteht nicht vollständig.
Label-F2, weitere Störvarianten, gerichteter Queue-/Breaker-Nachweis und
Schritt 4 bleiben offen.
