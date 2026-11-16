# Gewertete L3-Label-Reihe, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat nach Freigabe drei Label-Aufträge gegen den verzögerten Fake
mit Live-Last ausgeführt. Umfang vorab im gekürzten
[Restplan](../../1B-3u4-Planung.md) festgelegt.

- Ausführungs- und Auswertungscommit:
  `7c64dd6a0352df1e51981ab16300532eb849f712`, ohne `--arbeitsstand`.
- Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
  31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.
- Node: beide VM-Hosts v24.22.3, App-Container v24.19.0.
- Lauf-ID `20261116T183013-l3-label`, lokal etwa 19:30–19:49 Uhr MEZ.
- [Ergebnis-JSON](messung/2026-11-16-lauf-l3-label.json).
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T183013-l3-label\`:
  Treiber, App-Log, Transport-TSVs, Journal und Nachprüfungen.
  PCAPs mit Token bleiben lokal. Repo-JSON und lokales Ergebnis identisch.

Korpus `label-identical-pair-v1`, Encoder und Settings unverändert gegenüber
[eigener F1/B0-Label-Referenz](2026-11-16-lauf-f1-label.md).
Manifestvergleich `comparable=true`; `buildExperimentResult` reproduziert
das gespeicherte Experimentergebnis.

## Störung und Ergebnis

Alle Zahlen gelten für den genannten Rechner und Commit. Journal auf llm-host:
18:30:53 UTC `docker stop arsnova-open-weight-llm`, danach Fake-Modus `delay`
mit 310 000 ms Verzögerung um 18:30:54 UTC. Label-Timeout tatsächlich
30 000 ms; Labor-/Summaryparameter 300 000 ms ist nicht der Label-Timeout.
Fake-Verzögerung überschreitet beide Budgets. Keine tc-/ufw-Störung.

Alle drei Aufträge `status=ready`, `effectiveMode=SEMANTIC`,
`labelSettlement=transient`, `labelModelAccepted=false`. Je ein tatsächlicher
Verbindungsversuch, eine erfolgreiche Slot-Abfrage (HTTP 200) und ein
Completion-POST ohne HTTP-Antwort während des Auftrags, kein TCP-RST.
Damit ist der verzögerte Completion-Pfad erreicht; keine rein lokale
Breaker-Antwort. Der Encoder bleibt verfügbar, während LLM-Labels ausfallen.

| Auftrag | Client-Wartezeit in ms |
| ------- | ---------------------: |
| 1       |                 30 029 |
| 2       |                 30 045 |
| 3       |                 30 044 |

Client-Median 30 044 ms, Spanne 30 029–30 045 ms. Das passt zum effektiven
Label-Timeout. Interne Job-Zeit und interner Fallback-Grund fehlen im
API-Vertrag; H2-Fallback innerhalb des internen Budgets plus 1 s deshalb
nicht vollständig prüfbar. Client-Wartezeit nicht als interne Zeit umdeuten.
Kein Inferenzzeitwert für den Fake und kein semantischer Qualitätsnachweis.
Die langen Abstände prüfen nicht das kurze Breaker-Öffnungsfenster.

## Live-Last und Ressourcen

Alle drei Live-, Ressourcen- und Gesamtfenster vollständig, 498 gültige
RSS-Proben. Insgesamt 4 800 erfolgreiche Live-Aktionen ohne Fehler.
Profil unverändert: 500 Ankünfte, 90-s-Rampe, Ergebnisfreigabe bei 270 s,
Fenster 330 s; keine dauerhaft konstante Konkurrenz von 500 Personen.

Vergleich `compareExperiments(b0, l3)`, p95 aus zusammengeführten Einzelzeiten,
unverändert höchstens 110 % des B0-p95. B0 zehn Fenster, L3 drei Fenster.

| Aktion             | B0-Aktionen | L3-Aktionen | Fehler B0 / L3 | B0-p95 ms | L3-p95 ms | Änderung | Schwelle    |
| ------------------ | ----------: | ----------: | -------------: | --------: | --------: | -------: | ----------- |
| Beitritt           |       5 000 |       1 500 |          0 / 0 |     32,90 |     33,62 |  +2,22 % | eingehalten |
| Quizstimme         |       5 000 |       1 500 |          0 / 0 |     32,14 |     31,80 |  −1,04 % | eingehalten |
| Q&A-Einreichung    |       1 000 |         300 |          0 / 0 |     15,71 |     16,24 |  +3,34 % | eingehalten |
| Blitzlicht-Antwort |       5 000 |       1 500 |          0 / 0 |     16,96 |     14,35 | −15,41 % | eingehalten |

H2-Fehler und H2-Latenz in dieser Reihe erfüllt. Kleine Fallprüfung mit drei
Inferenzaufträgen, keine belastbare Aussage über seltene Fehler oder stabile
Tail-Latenz über viele Inferenzzyklen. Zeitlich aufeinanderfolgende Reihen
auf gemeinsam genutztem Host ohne CPU-Pinning; frühere Schwellenüberschreitungen
bleiben Teil des Gesamtbefunds.

App-Prozess-RSS maximal 481 112 064 Bytes; gemeinsame Seiten können mehrfach
gezählt sein. Maximale App-CPU 42,09 % einer logischen CPU aus cgroup-Deltas.
Runtime-Speicherlogger enthält nur eine Probe vor dem Stopp (3 043 229 696
Bytes). Kein Runtime-Speicherverlauf während der Störung und kein Nachweis
des Fake-Speichers oder seiner OOM-Freiheit aus dieser Probe.

## Rücknahme und Abschluss

Fake über bestehenden L3-Rücknahmeablauf beendet, Runtime um 18:48:58 UTC
mit `docker start arsnova-open-weight-llm` wieder gestartet, danach frischer
Runtime-Start und Prüfungen. Rücknahme `restored=true, variant=l3`,
Wiederherstellung `checksPassed=true`; beide VM-Prüfungen einschließlich
Testinferenz bestanden.

L3/Label mit vorab reduziertem Umfang vollständig. Im gekürzten Label-Programm
bleibt nur F2 mit drei Aufträgen. Gerichteter Queue-/Breaker-Nachweis,
Transportauswertung und Schritt 4 bleiben separat offen. Kein weiterer Lauf
oder neue Störung gestartet.
