# 1B-009: Portabler Aufbau, unter Linux getestet, unter Windows dokumentiert

- **Status:** methodisch (2026-11-12)
- **Kategorie:** Methodik

## Kontext

Niklas baut die Schritte 3–4 auf dem Aufbau der Schritte 1–2 auf, aber auf eigener Hardware: Windows mit WSL. Jede Person braucht einen eigenen Baselinelauf ([Rahmendokument](../00-rahmen-und-pruefung.md#pflicht-nachweiskette-je-person)), und 1B Schritt 3 verlangt, die Wiederholbarkeit zu dokumentieren.

## Entscheidung

Der Kern ist plattformneutral: Ubuntu-LTS-Cloud-Image plus je eine cloud-init-Datei für App-Host und Inferenz-Host. Darüber liegt eine dünne Startschicht je Plattform. Die Linux-Schicht (libvirt/QEMU) wird gebaut und getestet. Die Windows-Schicht wird gegen die Herstellerdoku geprüft und als „ungetestet, Niklas prüft“ dokumentiert (`evidenz/1B/vm/WINDOWS.md`). Zwei WSL-Distributionen zählen nicht als zwei Hosts, weil sie sich eine Hilfs-VM und ein Netz teilen.

_Aktualisiert 2026-11-14 (Docs-Audit):_ Die Windows-Schicht ist inzwischen gebaut: Hyper-V über `labor.ps1`, ohne WSL ([ADR 1B-012](1B-012-windows-aufbau-ohne-wsl.md)). Sie ist auf Windows 11 bis vor den Start der Labor-VMs getestet ([Windows-Test](../evidenz/1B/2026-11-13-windows-test.md), Versuche 4–5); der Start selbst ist ungeprüft. Niklas steuert aus WSL, gebaut wird ohne WSL. Multipass ist zweite Wahl (ADR 1B-012).

## Alternativen

- **Nur Linux, Niklas passt selbst an:** verworfen; doppelte Arbeit und kein gemeinsamer Kern.
- **Ein Werkzeug für beide Plattformen (etwa Multipass):** offen; wird bei der Windows-Schicht gegen die Doku geprüft, auch darauf, ob es CPU-Pinning kann.

## Belege

- [1B-Design, Abschnitt 3.2](../specs/2026-11-12-1b-zwei-host-design.md#32-portabilität-autor).

## Folgen

- Niklas nutzt die Dateien, nicht die Geräte des Autors.
- Ein Nachbau auf anderer Hardware ist zugleich der Wiederholbarkeitsnachweis für Schritt 3; absolute Inferenzzeiten sind zwischen den Rechnern nicht vergleichbar.
