# AGENTS.md – docs/referat-thema-1

Referat Cloud Computing, Thema 1 (Aufträge 1A–1C) im Fork. Gilt für alle
Dateien in diesem Ordner, zusätzlich zur `AGENTS.md` im Wurzelverzeichnis.

## Karte

- Rahmen, Prüfung, Baseline: [`00-rahmen-und-pruefung.md`](00-rahmen-und-pruefung.md)
- Aufteilung und gemeinsame Artefakte: [`01-aufteilung.md`](01-aufteilung.md)
- Alle Dateien des Ordners: [`README.md`](README.md)
- Je Auftrag ein Hauptdokument mit Ergebnis, Befunden und offenen Punkten
  (1C: [`1C-ergebnis.md`](1C-ergebnis.md))
- Entscheidungen: [`adr/`](adr/README.md), ein Nummernkreis je Auftrag
- Protokolle und Rohdaten: `evidenz/<Auftrag>/` · Designs und Pläne: `specs/`
- Diagramme: `diagrams/`, Regeln in [`diagrams/README.md`](diagrams/README.md)

## Ein Fakt, ein Ort

Jeder Fakt steht an genau einer Stelle; andere Dokumente verlinken ihn statt
ihn zu wiederholen.

- Ergebnis, Aufgabenabdeckung und Befunde eines Auftrags: sein Hauptdokument
- Entscheidung mit Begründung, Alternativen und Belegen: ein ADR
- Messwerte und Ablauf eines Laufs: sein Protokoll unter `evidenz/`
- Code-Belege mit Zeilennummern: die Belegtabelle der Diagrammdoku des Auftrags
- Dateiübersicht: `README.md`
- Eigenanteil und KI-Nutzung: die Eigenanteil-Datei des Auftrags
- Folien und Handout: Gliederung; jede Kernzahl nur mit Quelle (ADR oder
  Protokoll), keine eigenen Herleitungen

## Regeln

- Doku auf Deutsch; Commit-Messages Englisch nach Conventional Commits, ohne
  KI-Attribution.
- Protokolle und Rohdaten nach dem Einfrieren nicht ändern (Korrekturen nur am
  Lauftag oder Folgetag, siehe Eigenanteil). Einzige spätere Ausnahme: das Datum
  in der Zeile „Prüfung durch den Autor“. Ein freigegebenes Design wird
  vor einem neuen Lauf nur durch einen neuen, datierten Nachtrag ergänzt.
- Spätere Erkenntnisse kommen als datierter Hinweis („_Aktualisiert_“,
  „_Ergänzt_“ oder „_Korrigiert JJJJ-MM-TT:_“) ins lebende Dokument oder ins
  ADR. Ein angenommenes ADR wird annotiert oder durch ein neues abgelöst; seinen
  Entscheidungstext ändert niemand.
- Jede Zahl mit Rechner und Commit. Kennzahlen eines 1C-Laufs neu berechnen:
  `node docs/referat-thema-1/evidenz/1C/messung/auswertung.mjs <datei.json.gz>`.
- Keine Matrikelnummern, personenbezogenen Daten, Tokens oder `.env`-Inhalte.
- `AGENTS.md` im Wurzelverzeichnis und `.serena/` gehören upstream; für das
  Referat nicht ändern. Produktionscode bleibt unverändert; Tests, Testhelfer, ihre
  CI-Schritte und ihre Doku in `docs/TESTING.md` sind erlaubt.
- Laborinstanzen nur auf `127.0.0.1` oder in einem privaten virtuellen Netz
  zwischen Labor-VMs auf demselben Rechner, das von außen nicht erreichbar ist
  (keine Portweiterleitung, kein Bridging); ausgehendes NAT für die Einrichtung
  ist erlaubt ([ADR 1B-003](adr/1B-003-laborregel-virtuelles-netz.md)).
- Markdown prüfen: `npx prettier --check <dateien>` und `git diff --check`.

## Wiederverwendbar aus 1C

- [`evidenz/1C/labor-runbook.md`](evidenz/1C/labor-runbook.md) mit
  `evidenz/1C/labor-lauf.sh`: unbeaufsichtigte Läufe mit Prüfung von Limits,
  Neustarts und OOM-Kill, Speicherverlauf als CSV
- `evidenz/1C/labor-produktionslimits.override.yml`: Produktionslimits im
  Labor nachstellen
- `apps/backend/src/__tests__/lib/open-weight-test-runtime.ts`: Latenz und
  Ausfall der Runtime in Vitest (im Testprozess, kein eigenständiger Server)
- `apps/backend/src/__tests__/lib/recording-proxy.ts`: aufzeichnender Proxy
  vor der echten Runtime

## 1B-Labor für Agenten (Codex, Claude)

Zwei VMs (app-host `192.168.150.10`, llm-host `192.168.150.20`) für 1B; Aufbau,
Messmodi und Regeln im [Runbook](evidenz/1B/runbook.md), Übergabe für die
Schritte 3–4 in dessen [Abschnitt 8](evidenz/1B/runbook.md#8-übergabe-an-niklas-schritte-34),
Windows-Anleitung und Parameter in [`vm/WINDOWS.md`](evidenz/1B/vm/WINDOWS.md).

- **Steuern:** unter Windows aus WSL nur über
  `docs/referat-thema-1/evidenz/1B/labor-wsl.sh` (ruft `labor.ps1` und
  `ssh.exe` unter Windows auf; ob WSL die VMs direkt erreicht, ist offen und
  wird nicht gebraucht). Nie `labor.sh` in WSL; das ist der Linux-Weg.
  - Hilfe: `labor-wsl.sh` ohne Argumente. Zustand: `labor-wsl.sh status`;
    VMs an/aus: `start`, `stop`.
  - Befehl in einer VM: `labor-wsl.sh vm llm 'docker ps'` bzw. `vm app '…'`.
  - Eigene Änderungen testen, ohne zu committen: `--arbeitsstand` anhängen
    (wirkt bei allen Modi, die den Repo-Stand in die VMs bringen), nie bei
    `kontrolle` und `belege`.
  - Messungen und ihre Reihenfolge: [Runbook, Abschnitt 3](evidenz/1B/runbook.md#3-lauf).
    Auf einem frischen Labor zuerst Schritt 1 dort (mit `-LabTimeoutMs 300000`).
  - `up`, `destroy` und `vorpruefung` brauchen Admin-Rechte; nur auf
    ausdrücklichen Wunsch des Menschen. Lange Läufe (ab `kalibrierung`) startet
    besser der Mensch in einem eigenen Terminal; danach Log und Ergebnis lesen.
- **Vor jedem Lauf** (auch zur Entwicklung) den Menschen fragen; Läufe belegen
  den Rechner für Minuten bis Stunden. Vor jedem gewerteten Lauf zusätzlich
  Hypothese, Messgröße und Schwelle aufschreiben (Design oder datierter
  Nachtrag) und auf einem committeten Stand ohne `--arbeitsstand` laufen lassen.
- **Entwicklungsläufe:** `-LabTag dev-…` (kommen nicht nach `messung/`);
  Läufe mit `--arbeitsstand` immer als Entwicklung, nie werten. `kontrolle`
  und `belege` schreiben immer nach `messung/`.
- **Störungen** (`tc netem`, ufw-`deny`, Runtime stoppen) nur in den Labor-VMs
  und nur nach Rückfrage; jeden Befehl samt Rücknahme protokollieren, nach dem
  Lauf zurücknehmen und mit `pruefen` bestätigen
  ([Runbook, Abschnitt 8](evidenz/1B/runbook.md#8-übergabe-an-niklas-schritte-34)).
- **Nie:** Tokens, `.env`-Inhalte oder Mitschnitte (`*.pcap`, enthalten den
  Token) ins Repo ([Datenregeln](evidenz/1B/runbook.md#7-datenregeln)); nichts
  an Produktionscode ändern; Labornetz nicht nach außen öffnen (ADR 1B-003).
- **Ergebnisse:** jedes Ergebnis-JSON enthält `umgebung` (Rechner,
  Hypervisor, VMs); Zahlen nur mit dieser Angabe und dem Commit zitieren.
- **Tests der Laborskripte:** [Runbook, Abschnitt 9](evidenz/1B/runbook.md#9-tests).
