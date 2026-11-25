# 1B: Entwicklungslauf für den Prompt-Body, 2026-11-15

Arbeitsstand, noch nicht eingefroren. Prüfung durch den Autor: 2026-11-16 (Niklas).
**Entwicklungslauf, keine gewertete Messung und kein Hypothesennachweis.**

## Zweck und Ausführung

Prompt-Body für die folgende Kalibrierung erzeugen, wie in Runbook §3 beschrieben.
Niklas hat nach gesonderter Aufforderung im eigenen WSL-Terminal ausgeführt:

```bash
bash docs/referat-thema-1/evidenz/1B/labor-wsl.sh lauf -LabN 1 -LabTag dev-body -LabTimeoutMs 300000
```

Commit: `86f9fa906787fdc1830b694c06c6cb90f29b8cd2`, ohne `--arbeitsstand`.
Rechner: Intel Core i7-10700K, 8 Kerne / 16 Threads, 31 GiB RAM abgerundet;
Windows 11 Pro, Hyper-V, llm-host 8 vCPU / 10 GiB, app-host 2 vCPU / 4 GiB.
Aufbau und Plattenerweiterung: [Aufbauprotokoll](2026-11-15-aufbau-windows.md).
Das Ergebnis-JSON enthält `umgebung`.

Laufkennung: `20261115T184936-dev-body`. Lokale Rohdaten:
`%USERPROFILE%\labor-1b\20261115T184936-dev-body`, im App-Host unter
`/home/labor/labor-1b/20261115T184936-dev-body`. Ergebnis-JSON und Mitschnitte
dieses Entwicklungslaufs werden nicht nach `messung/` übernommen. PCAPs enthalten
den Runtime-Token und bleiben lokal.

## Prüfergebnis

Der Wrapper kehrte zum Prompt zurück; `ergebnis.json` meldet `auswertung: ok`,
ein Auftrag und keine unvollständige Zeitzerlegung. Der Prompt-Body ist sowohl
lokal als auch im App-Host vorhanden und als JSON mit nicht leerem
`messages`-Array lesbar. Beide Kopien haben SHA-256
`345f1fbf7bccb76cce6476a5e7cb4913bf7245f74a2db8c08ef0124da429b322`.
Der Body wurde bei der Nachprüfung nicht im Terminal ausgegeben.

Werte aus dem Ergebnis-JSON, ausschließlich zur Diagnose dieses Entwicklungslaufs:

| Beobachtung                                      | Wert               |
| ------------------------------------------------ | ------------------ |
| T_host                                           | 87 ms              |
| T_job                                            | 102 405 ms         |
| T_infer                                          | 102 294,385 ms     |
| Client-Wartezeit einschließlich Polling          | 102 811 ms         |
| Ergebnisstatus                                   | `ready`            |
| Versuchte Betriebsart                            | `full-context`     |
| Effektive Betriebsart                            | `extractive`       |
| Fallback-Grund                                   | `invalid_response` |
| Runtime-Neustartzähler / OOM laut Speicherproben | 0 / nein           |
| C0 Direktprompt: HTTP-Status                     | 200                |
| C0 Direktprompt: prompt_ms + predicted_ms        | 106 723,265 ms     |

Die Runtime hat eine Antwort geliefert, die App akzeptiert diese aber nicht als
gültiges Modellergebnis. `ready` bezeichnet hier das verfügbare extraktive
Ergebnis, nicht einen erfolgreichen generativen Summary-Pfad. Die genaue Ursache
von `invalid_response` wurde in dieser Nachprüfung nicht ermittelt.

Die Auswertung setzt intern `nGewertet: 1` und einzelne `hB`-Felder auf `true`.
Das sind Ausgaben des allgemeinen Analysators; der Tag `dev-body` und der Zweck
dieses Laufs bleiben maßgeblich. Daraus folgt kein gewerteter Befund zu den
Schritt-3-Hypothesen oder zur Antwortqualität.

Beim Übertragen erschienen viele tar-Warnungen zu `SCHILY.fflags` und beim ersten
Installieren npm-Abkündigungshinweise. Sie verhinderten diesen Lauf nicht:
Checkout, Treiber, Zeitzerlegung und Rückholung der Ergebnisdateien wurden
abgeschlossen. Eine Änderung der Archivierung oder der Abhängigkeiten erfolgte
nicht.

Das aufgezeichnete aktive Energieschema heißt `Ausbalanciert`. Laut WINDOWS.md
§4 zeigt dieser Wert den separat wählbaren Windows-Energiemodus nicht an; daraus
folgt keine Aussage darüber, ob dieser auf »Beste Leistung« stand. Für die
folgenden Läufe müssen die dokumentierten Energiebedingungen eingehalten werden.

## Nächster freizugebender Schritt

Kalibrierung mit dem vorhandenen Body über `labor-wsl.sh kalibrierung`.
Sie wurde noch nicht gestartet. Die Regel aus ADR 1B-005 bleibt unverändert:
I ≤ 75 s → 90 000 ms, 75 s < I ≤ 270 s → 300 000 ms, darüber Abbruch und
Rücksprache. Die Zeit des Entwicklungslaufs ersetzt die Kalibrierung nicht.

## Nachtrag: Kalibrierung abgeschlossen, 2026-11-15

Niklas hat anschließend nach gesonderter Aufforderung ausgeführt:

```bash
bash docs/referat-thema-1/evidenz/1B/labor-wsl.sh kalibrierung
```

Quelle: lokale Datei
`%USERPROFILE%\labor-1b\kalibrierung-20261115T190323.json`, auch im App-Host
unter `/home/labor/labor-1b/kalibrierung-20261115T190323.json` laut Ausgabe.
Commit, Rechner und VM-Topologie entsprechen dem oben dokumentierten
Entwicklungslauf; die lokal geprüfte Kalibrierungsdatei enthält `umgebung`.
Die Anfrage verwendet den vorhandenen Body an einer frisch gestarteten Runtime.

| Größe                       |          Wert |
| --------------------------- | ------------: |
| prompt_ms                   | 37 203,177 ms |
| predicted_ms                | 63 304,598 ms |
| I_ms, vom Skript abgerundet |    100 507 ms |
| HTTP-Status                 |           200 |
| Gewählter Timeout           |    300 000 ms |

Damit gilt der mittlere Zweig der bestehenden Kalibrierungsregel
(75 s < I ≤ 270 s), kein Abbruch. Das aktive Energieschema ist wie zuvor
`Ausbalanciert`; die oben beschriebene Grenze der Erfassung des Windows-Energiemodus
bleibt bestehen. Für spätere Läufe gelten weiterhin die Bedingungen aus Runbook
§3–4, insbesondere Kalibrierung vom selben Tag und gleiches erfasstes Schema.

Die technische Vorbereitung des eigenen Zwei-VM-Labors ist damit abgeschlossen.
Noch fehlende Fake-Einbindung, Live-Last, App-Ressourcenmessung und
Störungs-Auswertung sind Implementierungsarbeit aus Issue #9, keine weiteren
Aufbauschritte und keine Wiederholung der Schritte 1–2. Die noch ausstehende
Probe und die lokale Vergleichsreihe folgen mit den fertigen Messhelfern unter
der für die Störreihen festgelegten Live-Last. Vor jedem solchen Lauf erneut
fragen; es wurde hier kein weiterer Lauf gestartet.
