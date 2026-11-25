# Laborabbau nach Schritten 3–4, 2026-11-16

Prüfung durch den Autor: offen.

## Auftrag und Umgebung

Niklas bestätigt die fachliche Prüfung und beauftragt ausdrücklich den Abbau.
Rechner: Windows 11 Pro, Intel Core i7-10700K, 31,9 GiB RAM, Hyper-V.
Skriptstand `4b135fe8468e07cff06be986f28d4d75dedf236b`.
Kein weiterer Messlauf und keine Produktionsänderung.

## Ablauf und Nachweis

VM-Steuerung ausschließlich über den WSL-Wrapper:

```bash
bash docs/referat-thema-1/evidenz/1B/labor-wsl.sh destroy
bash docs/referat-thema-1/evidenz/1B/labor-wsl.sh status
```

`destroy` öffnete das Admin-Fenster mit UAC und Löschbestätigung und endete
mit Exitcode 0. Lokales Protokoll:
`%USERPROFILE%\labor-1b\log-destroy-20261116T223250.txt`,
22:32:50–22:33:03 MEZ. Es meldet erfolgreiche Entfernung.
Die anschließende Statusabfrage endete ebenfalls mit Exitcode 0:

```text
Switch: fehlt; NAT: fehlt
== arsnova-1b-app (192.168.150.10): fehlt
== arsnova-1b-llm (192.168.150.20): fehlt
```

Damit Labor-VMs einschließlich Disks, privatem Switch und NAT entfernt.
Der verbleibende VM-Ordner `D:\arsnova-1b` enthielt ausschließlich
`SHA256SUMS`, `ubuntu-24.04-base.vhdx` und
`ubuntu-24.04-server-cloudimg-amd64.img`.
Nach Prüfung der exakten Dateimenge und Dateitypen wurden diese Host-Cache-
Dateien und der leere Ordner entfernt, insgesamt 2 907 187 875 Bytes.
Abschließend existiert der VM-Ordner nicht mehr.

## Bewusst erhalten

Lokale Messbelege und Betriebslogs unter `%USERPROFILE%\labor-1b`,
Repo-Dateien und Git-Historie bleiben erhalten. Mitschnitte können Tokens
enthalten und bleiben außerhalb des Repos. Die allgemeine Windows-/WSL-
Konfiguration, Hyper-V-Funktion und Benutzerrechte wurden nicht zurückgesetzt.
Dies ist kein Nachweis einer vollständigen Deinstallation aller Laborwerkzeuge.
