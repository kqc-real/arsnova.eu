# Gewertete F1/B0-Reihe Label und Normalvergleich, 2026-11-16

Prüfung durch den Autor: offen.

## Umgebung und Quellen

Niklas hat nach Freigabe zehn Label-Aufträge mit Live-Last und gestoppter
Runtime ausgeführt. Diese F1-Reihe ist die eigene Label-B0-Referenz.

- Ausführungs- und Auswertungscommit einschließlich aller Normalteile:
  `7c64dd6a0352df1e51981ab16300532eb849f712`.
- Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
  31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.
- Node: beide VM-Hosts v24.22.3, App-Container v24.19.0.
- Lauf-ID `20261116T141936-f1-label`, lokal etwa 15:19–16:21 Uhr MEZ.
- [Ergebnis-JSON](messung/2026-11-16-lauf-f1-label.json),
  [Normalreihe mit Quellen der drei Teile](2026-11-16-lauf-normal-label-03.md).
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T141936-f1-label\`:
  Treiber, App-Log, Transport-TSVs, Journal und Wiederherstellung.
  PCAPs mit Token bleiben lokal; Repo-JSON und lokales Ergebnis sind identisch.

Korpus `label-identical-pair-v1`, neue Session je Auftrag, Encoder unverändert
aktiviert. Settings stammen aus `app-container-environment`; Encoder-Timeout
120 000 ms, LLM-Label-Timeout 30 000 ms. Summary-/Laborparameter 300 000 ms
ist nicht der Label-Timeout. Der Vergleicher bestätigt die Manifest-
Kompatibilität mit allen drei Normalteilen. `buildExperimentResult`
reproduziert das gespeicherte Experimentergebnis.

## Störung, Ergebnis und Rücknahme

Journal: `docker stop arsnova-open-weight-llm` auf llm-host um
14:20:16 UTC; Rücknahme `docker start arsnova-open-weight-llm` um
15:21:20 UTC. Kein tc oder ufw eingesetzt.

Alle Werte gelten für den genannten Rechner und Commit. Alle zehn Aufträge:
`status=ready`, `effectiveMode=SEMANTIC`, `labelSettlement=transient`,
`labelModelAccepted=false`. Der Encoder bleibt verfügbar; der Ausfall der
LLM-Labels erzwingt keinen Wechsel des gesamten Semantic-Modus.
Je Auftrag ein tatsächlicher Verbindungsversuch mit TCP-RST, ohne HTTP-Antwort
oder Completion-POST. Keine rein lokale Breaker-Antwort in diesen Aufträgen.
Die langen Abstände prüfen nicht das kurze Breaker-Öffnungsfenster.

| Auftrag | Client-Wartezeit in ms |
| ------- | ---------------------: |
| 1       |                     59 |
| 2       |                     50 |
| 3       |                     35 |
| 4       |                     33 |
| 5       |                     36 |
| 6       |                     42 |
| 7       |                     38 |
| 8       |                     36 |
| 9       |                     39 |
| 10      |                     37 |

Median 37,5 ms, Spanne 33–59 ms. Das beschreibt den beobachteten Client-Pfad.
Die Label-API liefert keine interne Job-/Inferenzzeit und keinen internen
Fallback-Grund. H-F1 (Job-Median höchstens 2 s und Grund `unavailable`) sowie
die interne Fallback-Frist bleiben daher nicht vollständig bewertbar.
`f1Fast=null` und `fallbackWithinBudget=null` sind kein PASS.

Rücknahme meldet `restored=true, variant=f1`; Wiederherstellung zusätzlich
`checksPassed=true`. Beide VM-Prüfungen einschließlich Testinferenz nach
frischem Runtime-Start bestanden. Encoder und SEMANTIC bleiben aktiv.

## Live-Last und Ressourcen

Alle zehn Live-, Ressourcen- und Gesamtfenster vollständig: 1 660 gültige
RSS-Proben, 16 000 erfolgreiche Live-Aktionen ohne Fehler. Je Fenster
500 Ankünfte, 90-s-Rampe, Ergebnisfreigabe bei 270 s, Dauer 330 s;
keine dauerhaft konstante Konkurrenz von 500 Personen.

App-Prozess-RSS maximal 478 834 688 Bytes; gemeinsame Seiten können mehrfach
gezählt sein. Maximale App-CPU 40,20 % einer logischen CPU aus cgroup-Deltas.
Runtime-Speicherlogger enthält nur eine Probe vor dem Stopp (3 043 241 984
Bytes). Das ist kein Runtime-Speicherverlauf und kein OOM-Nachweis während
der Störung; die Runtime war dort absichtlich gestoppt.

## Normalreihe gegenüber eigener B0/F1-Referenz

B0/F1 ist die Basis, echte Label-Inferenz der Kandidat. Normaldaten aus allen
drei kompatiblen Teilreihen zusammenführen: 30 Normalfenster gegenüber zehn
Referenzfenstern. Pro Aktion alle einzelnen Laufzeiten zusammenfassen,
keine Mittelung von p95-Werten. Unterschiedliche Stichprobenumfänge ausweisen.
Die vorab festgelegte Schwelle bleibt unverändert: p95 höchstens 110 % von B0,
keine zusätzlichen Fehler.

| Aktion             | B0-Aktionen | Normalaktionen | Fehler B0 / Normal | B0-p95 ms | Normal-p95 ms | Änderung | Latenzschwelle |
| ------------------ | ----------: | -------------: | -----------------: | --------: | ------------: | -------: | -------------- |
| Beitritt           |       5 000 |         15 000 |              0 / 0 |     32,90 |         38,64 | +17,45 % | nicht erfüllt  |
| Quizstimme         |       5 000 |         15 000 |              0 / 0 |     32,14 |         32,22 |  +0,26 % | erfüllt        |
| Q&A-Einreichung    |       1 000 |          3 000 |              0 / 0 |     15,71 |         15,79 |  +0,51 % | erfüllt        |
| Blitzlicht-Antwort |       5 000 |         15 000 |              0 / 0 |     16,96 |         18,34 |  +8,09 % | erfüllt        |

Auch einzeln überschreiten alle drei Normalteile die Beitritts-Schwelle:
+17,26 %, +22,77 % und +12,49 %. Teil 3 überschreitet zusätzlich beim
Blitzlicht die Schwelle (+15,36 %); der gemeinsame Blitzlicht-p95 bleibt
innerhalb der Schwelle. Gemeinsame Werte verdecken somit Teilreihenabweichungen.

H2-Fehler: keine zusätzlichen Fehler beobachtet. H2-Latenz: in diesem Vergleich
nicht erfüllt, daher insgesamt kein bestandener H2-Live-Vergleich. Das ist
ein Befund gegen die pauschale Annahme unveränderter Live-Latenz, kein
alleiniger Kausalnachweis für die Inferenz als Ursache. Zeitlich aufeinanderfolgende
Reihen auf einem gemeinsam genutzten Host ohne CPU-Pinning;
kein randomisierter oder wiederholter A/B-Wechsel. Schwellen und Baseline
werden nicht nachträglich angepasst, Reihen nicht wegen des Befunds verworfen.

### Reproduktion ohne Laborlauf

Einzelteile mit `vergleichen.mjs` prüfen, B0-Datei immer zuerst:

```bash
node docs/referat-thema-1/evidenz/1B/vergleichen.mjs \
  docs/referat-thema-1/evidenz/1B/messung/2026-11-16-lauf-f1-label.json \
  docs/referat-thema-1/evidenz/1B/messung/2026-11-16-lauf-normal-label-01.json
```

Für die weiteren Einzelteile das letzte Argument durch Teil 02 bzw. 03 ersetzen.
Für den gemeinsamen Vergleich die JSONs aller drei Normalteile lesen,
`structuredClone(teil1)` bilden und ausschließlich dessen
`experiment.live.windows` durch
`teile.flatMap(r => r.experiment.live.windows)` ersetzen. Anschließend
`compareExperiments(b0, zusammengefuehrt)` aus `vergleichen.mjs` aufrufen.
Original-JSONs bleiben unverändert. Alle drei Manifestvergleiche müssen zuvor
`comparable=true` liefern; der Sammelvergleich enthält 30 Kandidatenfenster.

## Offene Arbeit

Normal/Label und eigene F1/B0-Label-Referenz sind erhoben und ausgewertet.
Schritt 3 insgesamt bleibt offen: L1/L2, weitere Label-Störreihen und gerichtete
Queue-/Breaker-Folge. Nächster Vorschlag ist eine einzelne Entwicklungsprobe
L1/Label mit Live-Fenster. Wirkung der 50-ms-Verzögerung anhand des Mitschnitts
prüfen; Konfiguration und Journal allein reichen nicht. Noch kein neuer Lauf
oder weitere Störung freigegeben oder gestartet.
