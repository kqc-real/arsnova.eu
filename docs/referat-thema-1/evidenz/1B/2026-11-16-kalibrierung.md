# Tageskalibrierung, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

Niklas hat die freigegebene Kalibrierung über `labor-wsl.sh kalibrierung`
auf Ausführungscommit `2b39b9dfc13aefd763fa4e0d8440a0536fa847f7` ausgeführt.
Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
Windows 11 Pro mit Hyper-V ohne CPU-Pinning; app-host 2 vCPU/4 GiB,
llm-host 8 vCPU/10 GiB. Energiesparplan: Ausbalanciert; der Windows-Energiemodus
ist dadurch nicht belegt.

Quelle: lokale Datei
`%USERPROFILE%\labor-1b\kalibrierung-20261115T234528.json`,
mit Umgebungserfassung am 2026-11-16 um 00:45:36 Uhr MEZ.
Der Dateiname verwendet UTC, daher das Datum 20261115.
Prompt-Body aus `20261115T202740-normal-summary/body.json`; frische Runtime,
Modellhash vor dem Start geprüft, HTTP 200.

| Messgröße                 | Wert          |
| ------------------------- | ------------- |
| Prompt-Verarbeitung       | 37 396,707 ms |
| Generierung               | 63 689,780 ms |
| I, abgerundet             | 101 086 ms    |
| HTTP-Gesamtzeit           | 101,099129 s  |
| Prompt-/generierte Tokens | 2 339 / 463   |
| Cache-Tokens              | 0             |
| Abgeleiteter Timeout      | 300 000 ms    |

Die Regel aus ADR 1B-005 ergibt für 75 s < I ≤ 270 s den Timeout 300 000 ms.
Kein Abbruch; diese Kalibrierung liefert keine Aussage zur Summary-Qualität
oder zur Rückwirkung unter Live-Last.

## Datumsgrenze beim nächsten Lauf

`labor.ps1` sucht ohne expliziten Timeout nach Dateinamen mit dem lokalen
Windows-Datum. Die Kalibrierung kurz nach Mitternacht trägt aber das UTC-Datum
des Vortags. Deshalb den gerade kalibrierten Wert beim unmittelbar folgenden
Lauf ausdrücklich mit `-LabTimeoutMs 300000` angeben. Rechner, VM-Größen und
Energieeinstellungen müssen gleich bleiben. Die explizite Angabe überspringt
den automatischen Energieprofilabgleich; unveränderte Einstellungen sind vor
dem Lauf sicherzustellen. An einem späteren Messtag erneut kalibrieren.
