# 1B Schritte 1–2: VM-Laufzeiten aus dem Systemjournal

- **Datum:** 2026-11-17, nachträgliche Auswertung; kein Messlauf, keine Hypothese
- **Autor:** Jonas Weirauch
- **Rechner:** Laptop (ThinkPad P50, i7-6820HQ), derselbe wie im [Aufbau](2026-11-12-aufbau.md) und im
  [Windows-Test](2026-11-13-windows-test.md)
- **Rohdaten:** [`messung/2026-11-17-vm-laufzeiten.csv`](messung/2026-11-17-vm-laufzeiten.csv), 58 Zeilen
- **Auswertung:** `vorarbeit()` in [`abgabe/jonas/nachweisumfang.mjs`](../../abgabe/jonas/nachweisumfang.mjs),
  Test in `nachweisumfang.test.mjs`

## Frage

Wie lange liefen die VMs für Auftrag 1B Schritte 1–2 insgesamt, also Aufbau, Neuaufbau zum Test der
Automatik, Windows-/Hyper-V-Versuche und Läufe, die nicht gewertet sind? Die gewertete Laborzeit (55 min)
zeigt nur die Messläufe.

## Quelle

`systemd-machined` schreibt jeden Start und jedes Ende einer libvirt-VM ins Systemjournal. Ausgelesen am
17.11.2026:

```sh
journalctl --since 2026-11-10 --until 2026-11-17 -o short-iso \
  | grep -E 'systemd-machined.*(New machine|terminated)'
```

Die CSV enthält davon nur Zeitpunkt (UTC), Ereignis, VM-Name und libvirt-Instanznummer, keinen Rechnernamen.
Im Zeitraum liefen nur die drei VMs dieses Auftrags: `arsnova-1b-app`, `arsnova-1b-llm` (Labor) und
`arsnova-1b-win` (Windows-Test).

## Auswertung

Je Instanz Start bis Ende. Überlappende Zeiten (app-host und llm-host laufen gleichzeitig) zählen einmal.
Davon abgezogen sind die gewerteten Läufe 1B Schritte 1–2 (Treiberstart bis letzter Auftrag), die vollständig
in VM-Laufzeit liegen.

| Kennzahl                                   | Wert                         |
| ------------------------------------------ | ---------------------------- |
| VM-Starts                                  | 29 (Labor 18, Windows 11)    |
| Labor-VMs liefen                           | 14 h 40 min                  |
| Windows-VM lief                            | 9 h 34 min                   |
| Irgendeine VM lief                         | 24 h 14 min (12.–15.11.2026) |
| davon gewertete Läufe                      | 55 min                       |
| **Aufbau, Tests und weitere Läufe 1B 1–2** | **23 h 19 min**              |

Je Tag (Berliner Zeit, irgendeine VM): 12.11. 7 h 58 min, 13.11. 14 h 57 min, 15.11. 1 h 18 min (Clip für J13).

## Abgleich mit den Protokollen

Die Starts der Windows-VM decken sich mit dem [Windows-Test](2026-11-13-windows-test.md): Versuch 1 „22:29 VM
angelegt“ ↔ Start 22:29:20, Versuch 2 „04:42“ ↔ 04:42:53, Versuch 3 „10:25“ ↔ 10:25:45 (MEZ). Die Labor-VMs
starten am 12.11. um 17:20, zehn Minuten vor dem protokollierten Aufbaufenster 17:30–22:24 (Installation von
libvirt 17:10 laut Journal). Die Protokolle nennen nicht für alle Versuche Uhrzeiten (Versuche 4 und 5); das Journal
schließt diese Lücke.

## Grenzen

- Rechnerzeit mit laufender VM, keine Arbeitszeit. Teile liefen unbeaufsichtigt, etwa nachts.
- Nicht enthalten: Arbeit ohne laufende VM (Planung, Skripte, Pester- und Node-Tests, Dokumentation) und die
  Zeit vor dem ersten VM-Start.
- Das Journal liegt nur auf dem Laptop; die CSV ist der committete Auszug. Wer nachprüfen will, braucht den
  Befehl oben auf demselben Rechner.
