# L1-Entwicklungsprobe Label, 2026-11-16

Prüfung durch den Autor: offen.

## Umgebung und Quellen

Niklas hat nach Freigabe einen Label-Auftrag mit Live-Last und der
L1-Störung (+50 ms auf Runtime-Antworten) ausgeführt. Wegen Entwicklungszweck
und `dev-`-Tag nicht als gewerteten L1-Auftrag zählen.

- Ausführungs- und Auswertungscommit:
  `7c64dd6a0352df1e51981ab16300532eb849f712`, ohne `--arbeitsstand`.
- Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
  31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.
- Node: beide VM-Hosts v24.22.3, App-Container v24.19.0.
- Lauf-ID `20261116T153231-dev-l1-label`, lokal etwa 16:32–16:39 Uhr MEZ.
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T153231-dev-l1-label\`:
  `ergebnis.json`, `treiber.json`, `app.tsv`, `srv.tsv`, Journal und Nachprüfungen.
  Entwicklungs-JSON und PCAPs bleiben lokal; Mitschnitte enthalten den Token.

Korpus `label-identical-pair-v1`, Encoder und Settings unverändert gegenüber
[Normalreihe](2026-11-16-lauf-normal-label-03.md) und
[F1/B0-Referenz](2026-11-16-lauf-f1-label.md). Container-Settings und Node-Versionen
erfasst; `compareExperiments` bestätigt Manifest-Kompatibilität mit F1/B0.
`buildExperimentResult` reproduziert das gespeicherte Experimentergebnis.

## Störung und beobachtete Wirkung

Alle Zahlen gelten für den genannten Rechner und Commit. Journal auf llm-host:

- 15:33:12 UTC: root-qdisc `1b00:` mit prio und ausschließlich Band 1 als
  Standardzuordnung; Kind-qdisc `1b30:` mit `netem delay 50ms` an Band 3.
- Filter: Ziel `192.168.150.10/32`, Quellport 8080, Weiterleitung an `1b00:3`.
  SSH wird durch diesen Filter nicht erfasst.
- 15:38:58 UTC: Rücknahme mit
  `sudo tc qdisc del dev eth0 root handle 1b00:`.

Der Lauf zeigt nicht nur eine gesetzte Regel, sondern deren Wirkung im
Transportmitschnitt. In `app.tsv` desselben TCP-Streams beträgt der Abstand
zwischen App-SYN und Runtime-SYN/ACK **50,868 ms**. In `srv.tsv`, jeweils anhand
der dortigen lokalen Zeitstempel gerechnet, beträgt er **50,076 ms**.
Keine Differenzbildung zwischen Uhren verschiedener VMs.

Zum Vergleich ergeben die App-Mitschnitte der drei Normalteile zusammen
30 Verbindungsaufbauten mit Median **0,527 ms**, Spanne **0,265–1,098 ms**.
Die genaue Regelkonfiguration und diese Beobachtungen stützen die Wirkung der
L1-Störung. Der SYN-Abstand enthält zusätzlich TCP-/Scheduler-/Transportzeit;
kein isolierter Nachweis einer auf Mikrosekunden exakten Verzögerung aller
Antwortpakete. Auch die HTTP-Slot-Antwort ist im App-Mitschnitt nach der
Anfrage um etwa 50 ms verzögert. Aus der gesamten Client-Wartezeit allein
wird keine 50-ms-Wirkung abgeleitet.

Reproduzierbar ohne neuen Laborlauf: In beiden TSVs des Entwicklungsordners
je Stream das erste SYN von `192.168.150.10` (Feld 8 `True` oder `1`) und das
folgende SYN von `192.168.150.20` auswählen; Differenz von Feld 1 mal 1 000.
Normalvergleich analog auf den `app.tsv`-Dateien der drei in der Normalauswertung
verlinkten Lauf-IDs. Die Zeitstempel als Dezimalzahlen verarbeiten.

## Label, Live-Last und Ressourcen

Der Auftrag erreicht `ready`, `effectiveMode=SEMANTIC`,
`labelSettlement=complete`, `labelModelAccepted=true`; Client-Wartezeit
6 082 ms nach frischem LLM-Start. Tatsächliche Slot-Abfrage und Completion-POST,
beide HTTP 200, eine Verbindung und kein RST.

Live-, Ressourcen- und Gesamtfenster vollständig: 166 gültige RSS-Proben,
1 600 erfolgreiche Aktionen ohne Fehler. Profil: 500 Ankünfte, 90-s-Rampe,
Ergebnisfreigabe bei 270 s, Dauer 330 s; keine dauerhaft konstante Konkurrenz.

| Aktion             | Erfolge | Fehler | p95 in ms |
| ------------------ | ------: | -----: | --------: |
| Beitritt           |     500 |      0 |     33,80 |
| Quizstimme         |     500 |      0 |     32,41 |
| Q&A-Einreichung    |     100 |      0 |     15,85 |
| Blitzlicht-Antwort |     500 |      0 |     12,19 |

App-Prozess-RSS maximal 475 533 312 Bytes, gemeinsame Seiten können mehrfach
gezählt sein. Maximale App-CPU 39,96 % einer logischen CPU aus cgroup-Deltas.
Runtime-Speicher maximal 3 163 987 968 Bytes bei 24 Proben, kein Neustart oder
OOM in der Aufzeichnung. Keine interne Label-Job-/Inferenzzeit von der API;
fehlende Felder nicht als bestandenen Fallback-Zeitnachweis behandeln.

## Abschluss

Rücknahme meldet `restored=true, variant=l1`; Wiederherstellung zusätzlich
`checksPassed=true`. Beide VM-Prüfungen einschließlich Testinferenz nach
frischem Runtime-Start bestanden.

Entwicklungsziel erreicht: L1-Wirkung im Mitschnitt sichtbar, Label-Pfad
vollständig, Messfenster vollständig und Störung zurückgenommen. Kein
gewerteter L1-Auftrag und kein abschließendes H2-Urteil aus dieser Einzelprobe.

Nächster Vorschlag: erste zehn der geplanten 20 L1-Label-Aufträge unter
identischer Konfiguration und gleichem Commit. Lauf und tc-Störung brauchen
eine eigene Freigabe; noch nicht ausgeführt.
