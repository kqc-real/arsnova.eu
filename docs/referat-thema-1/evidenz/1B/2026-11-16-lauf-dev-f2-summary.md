# Entwicklungslauf dev-f2-summary, 2026-11-16

Prüfung durch den Autor: offen.

## Umgebung und Quellen

Niklas hat einen Summary-Auftrag mit Live-Last und geplanter F2-Störung nach
Rückfrage selbst ausgeführt. **Die DROP-Störung war nicht wirksam.** Dieser
Entwicklungslauf wird nicht als F2-Nachweis gewertet.

- Ausführungscommit: `5e758d0a870bc38441b60c541a6ff6f3d0662ee2`.
- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
  Windows 11 Pro, Hyper-V ohne CPU-Pinning.
- app-host: 2 vCPU/4 GiB RAM; llm-host: 8 vCPU/10 GiB RAM.
- Lokales Datum 2026-11-16, VM-Zeit UTC noch 2026-11-15;
  Lauf-ID `20261115T230148-dev-f2-summary`.
- Lokale Quellen unter
  `%USERPROFILE%\labor-1b\20261115T230148-dev-f2-summary\`:
  `ergebnis.json`, `treiber.json`, `app.tsv`, `app.log`, Störungsjournal,
  Rücknahme- und Wiederherstellungsberichte. Keine PCAPs im Repo.
- Transportdaten lokal mit der dokumentierten `True`/`False`-Korrektur ausgewertet.

## Beobachtung

Alle Zahlen beziehen sich auf den genannten Rechner und Ausführungscommit.
Das Journal enthält den beabsichtigten ufw-DROP-Befehl um 00:02:26 Uhr MEZ und
seine Rücknahme um 00:08:12 Uhr MEZ. Trotzdem zeigt der Mitschnitt eine neue
TCP-Verbindung, eine Slot-Abfrage und einen Completion-POST mit jeweils HTTP 200,
kein RST. Die Runtime hat tatsächlich inferiert. Ein DROP-Verhältnis zu F1 ist
somit nicht beurteilbar; die lange Inferenzzeit darf nicht als DROP-Zeit gelten.

Summary-Endstatus `ready`, `extractive/invalid_response`, Job-Zeit 106 321 ms.
Das ist derselbe Qualitäts-Fallback wie im Normalbetrieb, kein Ausfallnachweis.
Live-, Ressourcen- und Gesamtfenster sind vollständig: 166 gültige RSS-Proben;
500 Beitritte, 500 Quizstimmen, 100 Q&A-Einreichungen, 500 Blitzlicht-Antworten,
alle erfolgreich. Der Entwicklungsstatus und die unwirksame Störung schließen
eine gewertete H2-Aussage aus. Rücknahme meldet `restored=true, variant=f2`,
Wiederherstellung zusätzlich `checksPassed=true`.

## Lesende Diagnose und Trockenläufe

Alle VM-Diagnosen liefen ausschließlich über `labor-wsl.sh vm llm`.
Keine zusätzliche Regel wurde gesetzt, keine neue Messreihe gestartet.

- Die Runtime nutzt laut Compose und `docker inspect` Host-Netzwerk.
- ufw ist aktiv; die bestehende Regel erlaubt app-host → llm-host:8080.
- Der unveränderte Befehl mit `ufw --dry-run insert 1 deny ...` meldet
  `Skipping inserting existing rule`. Der Helfer hatte Exitcode 0 als
  Aktivierungsnachweis behandelt, ohne die aktive DROP-Regel zu prüfen.
- Ein zweiter Trockenlauf mit zusätzlichem `in on eth0` erzeugt dagegen
  eine DROP-Regel an erster Position vor der vorhandenen ALLOW-Regel.
- `/usr/lib/python3/dist-packages/ufw/backend_iptables.py`, insbesondere der
  Zweig um `Skipping inserting existing rule`, erklärt die Duplikatbehandlung.
  Maßgeblich sind der beobachtete Trockenlauf und der tatsächliche Kernelpfad;
  aus einem erfolgreichen Prozess-Exit folgt keine erfolgreiche Störung.

## Korrektur vor einem neuen Versuch

Die F2-Regel bindet jetzt zusätzlich die ermittelte Eingangsschnittstelle.
Der Helfer protokolliert die ufw-Ausgabe und bestätigt vor dem Treiberstart
sowohl die eigene Regel im ufw-Status als auch die vorrangige, exakt passende
DROP-Regel in `ufw-user-input`. Fehlt der Nachweis, wird abgebrochen und
aufgeräumt. Nach Rücknahme wird die Abwesenheit der Regel zusätzlich im Kernel
geprüft. Bestehende fremde gleichartige Regeln werden nicht übernommen.
Alte Leases behalten die zur ursprünglichen Regel passende Rücknahme.

Regressionstests prüfen übersprungene Regeln trotz Exitcode 0, fehlende
Kernelwirkung, erfolgreiche Aktivierung/Rücknahme und alte Leases. Sie waren
vor der Korrektur rot. Die Wirkung auf der VM ist **noch nicht durch einen neuen
Störversuch bestätigt**; die Prüfung mit `in on eth0` war nur ein Trockenlauf.

Vor dem nächsten Versuch muss die Korrektur committet werden. Für F2 ist der
bisher festgehaltene Ausführungsstand `5e758d0a` nicht mehr verwendbar. Bisherige
Normal-/F1-Daten bleiben erhalten; der neue F2-Injektionsstand und die
Versionskompatibilität sind getrennt zu dokumentieren. Produktionscode, Treiber,
Live-/Ressourcensampler und Laufskript sind durch diese Korrektur unverändert.
