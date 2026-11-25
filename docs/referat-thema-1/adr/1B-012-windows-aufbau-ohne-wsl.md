# 1B-012: Windows-Aufbau ohne WSL, nur mit Windows-Bordmitteln

- **Status:** methodisch (2026-11-13, festgehalten 2026-11-14 im Docs-Audit)
- **Kategorie:** Methodik

## Kontext

Der Windows-Aufbau nach [ADR 1B-010](1B-010-aufbau-automatisiert-mit-groessenempfehlung.md) brauchte bis Commit `673d7d57` eine WSL-Distribution: Sie baute die VM-Disk aus dem Ubuntu-Image, die Seed-ISO für cloud-init und ein `git bundle` des Repos. Dieser Teil war ungetestet, und ob WSL den internen Hyper-V-Switch erreicht, war offen. Im [Windows-Test, Versuch 3](../evidenz/1B/2026-11-13-windows-test.md#verlauf-versuch-3-volltest-mit-wsl-2026-11-13-vormittag) machte die Installation von WSL die Test-VM unerreichbar; die Ursache ist nicht belegt (Vermutung: dreifache Verschachtelung auf dem Messrechner). Niklas arbeitet mit Codex in WSL, braucht WSL also zum Steuern, nicht zum Bauen.

## Entscheidung

`labor.ps1` baut das Labor nur mit Windows-Bordmitteln und PowerShell, ohne WSL (Commit `effede2f`):

- **Disk:** Das Ubuntu-Image (qcow2) entpackt ein eigener Leser in `vm/windows-lib.ps1` zur Rohdisk; eine VHD-Fußzeile macht daraus eine VHD, `Test-VHD` und `Convert-VHD` erzeugen die VHDX.
- **Seed-ISO:** über die Windows-Schnittstelle IMAPI2 (Label `cidata`, ISO9660 und Joliet).
- **Repo-Stand:** `.git` per `tar.exe` packen, in jede VM kopieren und dort klonen.

Aus WSL steuern Agenten das Labor nur über `labor-wsl.sh`, das `labor.ps1` und `ssh.exe` unter Windows aufruft. Zwei WSL-Distributionen zählen weiterhin nicht als zwei Hosts ([ADR 1B-009](1B-009-portabilitaet-linux-windows.md)).

## Alternativen

- **WSL als Bauwerkzeug behalten:** verworfen; zusätzliche Abhängigkeit, ungetestet, und in Versuch 3 machte schon seine Installation die Test-VM unerreichbar, ohne dass die Ursache klar wurde.
- **Multipass:** zweite Wahl; feste IPs nur über ein manuelles Zusatznetz mit eigenem Netplan, unter Windows nicht dokumentiert (Recherche 2026-11-13).
- **VirtualBox:** läuft auch auf Windows Home; NAT-Netz, Seed-ISO und Pinning nicht geprüft.

## Belege

- Commit `effede2f` (Weg ohne WSL, mit Vorprüfung und Fortschritt).
- [Windows-Test](../evidenz/1B/2026-11-13-windows-test.md), Versuche 4 und 5: auf Windows 11 bis vor den Start der Labor-VMs geprüft.
- Pester-Tests des qcow2-Lesers gegen die Testdaten in `evidenz/1B/vm/testdaten/` (Sollwert `roh.sha256`). Am 2026-11-13 außerdem am vollen Ubuntu-Image: Die Rohdisk des eigenen Lesers ist bitgleich mit der von `qemu-img convert` (8 s); die VHD bootet in KVM mit erzwungenem Secure Boot (Microsoft-Schlüssel), cloud-init findet den Seed und setzt `eth0` über die MAC. Die Ausgaben dieser Prüfungen liegen nicht im Repo.

## Folgen

- Unter Windows sind nur Hyper-V, PowerShell, `ssh.exe`/`scp.exe` und `tar.exe` nötig; eine Anleitung steht in [`WINDOWS.md`](../evidenz/1B/vm/WINDOWS.md).
- Der Start der VMs unter Hyper-V und cloud-init darin sind weiterhin ungeprüft; Niklas' erster `up` ist der erste echte Test.
- Der eigene qcow2-Leser ist Code des Referats, kein Produktionscode; er unterstützt nur, was das Ubuntu-Image braucht (qcow2 v2/v3, zlib, ohne Basis-Image und ohne Verschlüsselung, `vm/windows-lib.ps1` Z. 341–426).
