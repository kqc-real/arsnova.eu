# 1B: Aufbau unter Windows, 2026-11-15

Arbeitsstand, noch nicht eingefroren. Prüfung durch den Autor: 2026-11-16 (Niklas).
Auftrag: Issue #9, Vorbereitung für Schritte 3–4. Kein gewerteter Messlauf.

## Umgebung und Aufbau

Rechner: Intel Core i7-10700K, 8 Kerne / 16 Threads, 31 GiB RAM abgerundet;
Windows 11 Pro mit Hyper-V nach Upgrade von Home. Repo-Stand beider VMs:
`86f9fa906787fdc1830b694c06c6cb90f29b8cd2`. Aufbau durch Niklas aus WSL:

```bash
bash docs/referat-thema-1/evidenz/1B/labor-wsl.sh up -LlmRamGB 10 -AppRamGB 4
```

VM-Dateien liegen unter `D:\arsnova-1b`. WSL wurde zuvor durch Niklas auf
4 GB begrenzt und neu gestartet. Das ist eine Abweichung von der in WINDOWS.md
genannten Begrenzung auf 6 GB.

| VM       | Adresse        | vCPU |    RAM | Virtuelle Platte nach Korrektur |
| -------- | -------------- | ---: | -----: | ------------------------------: |
| app-host | 192.168.150.10 |    2 |  4 GiB |                          25 GiB |
| llm-host | 192.168.150.20 |    8 | 10 GiB |                          30 GiB |

Kein CPU-Pinning unter Hyper-V. Laut Aufbaubericht: llm-host CPU-Reserve 100 %,
Gewicht 200; app-host Reserve 0 %, Gewicht 100. Der Bericht bestätigt den internen
Switch, NAT ohne Portweiterleitung und die Sperre von Rechner zu Runtime-Port.
Diese Prüfungen wurden nach der Plattenerweiterung noch nicht vollständig
wiederholt.

## Fehler der ersten Abschlussprüfung

Quelle: lokaler Bericht `%USERPROFILE%\labor-1b\aufbau-20261115T192944.txt`,
Aufbaulog `log-up-20261115T190943.txt` im selben lokalen Ordner. Keine vollständige
Kopie des Transkripts im Repo, da dessen Kopf lokale Benutzerinformationen enthält.

Beide VMs liefen; App und Runtime waren healthy. Genau eine Prüfzeile meldete
`FEHLER`: Die LLM-VM unterschritt die geforderten 10 GiB freien Plattenplatz.
Die voreingestellte virtuelle Platte mit 20 GiB war für den installierten Stand
einschließlich dieser Reserve zu knapp. Die lesende Nachprüfung ergab auf `/`
9 641 172 992 verfügbare Bytes (rund 8,98 GiB).

Die Runtime-Authentisierung, Flags, Modellprüfung, Testinferenz, App-Verbindung
und die Netz-Negativtests bestanden laut ursprünglichem Bericht. Der Aufbau
gilt trotzdem noch nicht als vollständig geprüft.

## Korrektur ohne Neuaufbau

Niklas erweiterte die vorhandene LLM-VHDX im Hyper-V-Manager auf 30 GiB.
Danach erkannte Linux `/dev/sda` mit 32 212 254 720 Bytes. Vor der Änderung im
Gast wurden Partitionslayout und Erweiterungsplan lesend geprüft:

```bash
bash docs/referat-thema-1/evidenz/1B/labor-wsl.sh vm llm 'lsblk -b -o NAME,START,SIZE,FSTYPE,MOUNTPOINTS; df -B1 --output=source,size,used,avail /; sudo growpart -N /dev/sda 1'
```

Die Root-Partition liegt hinter den Boot-Partitionen. Der Trockenlauf änderte
keinen Partitionsanfang und plante ausschließlich eine Erweiterung ihres Endes.
Anschließend ausgeführt:

```bash
bash docs/referat-thema-1/evidenz/1B/labor-wsl.sh vm llm 'sudo growpart /dev/sda 1 && sudo resize2fs /dev/sda1 && lsblk -b -o NAME,SIZE,FSTYPE,MOUNTPOINTS && df -h / && df -B1 --output=avail /'
```

Ergebnis: Exit 0; `/dev/sda1` auf 31 137 447 424 Bytes erweitert, ext4 online
vergrößert. Anschließend verfügbar: **20 042 358 784 Bytes**, rund **18,67 GiB**.
Damit ist die Plattenplatzschwelle erfüllt. Keine VM wurde dafür gestoppt oder
neu erstellt; keine Netzstörung oder Messung wurde gestartet.

## Noch ausstehend

`labor-wsl.sh status` scheitert in der aktuellen Sitzung weiter an fehlenden
aktiven Hyper-V-Rechten. Die lesende Gruppenprüfung bestätigt:

- Mitgliedschaft in Hyper-V-Administratoren gespeichert: ja.
- Mitgliedschaft im aktuellen Windows-Token aktiv: nein.

Das Aufbaulog bestätigt die Gruppenaufnahme und verweist auf eine erneute
Windows-Anmeldung. Niklas muss sich daher von Windows abmelden und wieder
anmelden; ein bloßer Neustart von WSL hatte vor der Gruppenaufnahme stattgefunden.
Danach VM-Status und Abschlussprüfung über `labor-wsl.sh` wiederholen. Vor
Prompt-Body, Kalibrierung und jedem weiteren Lauf erneut fragen.

Die ursprünglichen Plattenstandards der Skripte sind noch unverändert. Eine
dauerhafte Korrektur für neue Aufbauten mit zu knapper LLM-Platte bleibt offen.

## Nachtrag: Wiederanlauf nach Windows-Neustart, 2026-11-15

Niklas hat Windows neu gestartet. `labor-wsl.sh status` läuft jetzt ohne
Rechtefehler und meldete zunächst beide VMs als `Off`. Die RAM-Vorschau mit
`groessen -Ja -LlmRamGB 10 -AppRamGB 4 -LlmDiskGB 30` ergab 20 GB verfügbar,
14 GB für die VMs und rechnerisch 6 GB Rest bei geforderter Reserve von 4 GB.
Rechner und VM-Commit entsprechen dem oben dokumentierten Aufbau.

Anschließend ausgeführt:

```bash
bash docs/referat-thema-1/evidenz/1B/labor-wsl.sh start
```

Ergebnis: **Exit 0**, vorhandene VMs gestartet, Abschlussprüfung meldet
`alle Pruefungen OK`. Lokale Belege unter `%USERPROFILE%\labor-1b`:

- `log-start-20261115T194443.txt`
- `aufbau-20261115T194622.txt`

App, PostgreSQL, Redis, PDF-Worker und Runtime sind healthy. Der LLM-Host
besteht die Platzprüfung mit angezeigten 19 GiB frei. Modell, Limits, Flags,
Authentisierung, kurze Testinferenz und Verbindung aus dem App-Container
bestehen. Interner Switch und Sperre von Rechner zu Runtime-Port sind erneut
bestätigt.

**Prüfgrenze:** Der Bericht enthält `HINWEIS NAT-Portweiterleitung nicht geprueft
(nur als Administrator abfragbar)`. Die Gruppenrechte erlauben die VM-Verwaltung,
geben aber keinen erhöhten Windows-Token. Die NAT-Portweiterleitungsprüfung
bestand beim ursprünglichen administrativen Aufbau; sie wurde beim Wiederanlauf
nicht erneut ausgeführt. Es wird deshalb keine vollständige erneute
Admin-Netzprüfung behauptet.

Der zuvor dokumentierte Rechteblocker ist für die alltägliche VM-Steuerung
behoben. Kein gewerteter Lauf, keine Kalibrierung und keine Störung gestartet.
Der nächste Schritt ist ein einzeln freizugebender Entwicklungslauf zum Erzeugen
des Prompt-Bodys gemäß Runbook §3, danach die Kalibrierung.
