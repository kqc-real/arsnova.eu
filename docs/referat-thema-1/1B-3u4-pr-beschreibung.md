**Titel:** Feature/Aufgabe 1B Schritte 3–4 - Latenz- und Ausfallexperimente sowie Bewertung der zweiten privaten Inferenzrolle

## Zusammenfassung

- **Problem:** Für 1B Schritte 3–4 fehlten eigene Belege zur Rückwirkung langsamer oder ausgefallener privater Inferenz auf Live-Aktionen sowie eine begründete Abwägung des zweiten Hosts.
- **Lösung:** Reproduzierbare Laborwerkzeuge und eigene Normal-/Störreihen für Summary und Label, gerichteter Queue-/Breaker-Vergleich, Transportauswertung und S1-Vergleich. Betriebsaufwand und Empfehlung sind in ADR 1B-020 dokumentiert. Live-Fehler wurden nicht beobachtet, Latenzschwellen aber mehrfach überschritten; ein allgemeiner Isolationsgewinn wird nicht behauptet.
- **Bewusste Nicht-Ziele:** Kein Produktionspatch, keine produktive Same-Host-Freigabe, kein Kapazitäts-/Sicherheitsnachweis und keine zusätzliche optionale Race-Messreihe. Jonas' Schritte 1–2 bleiben getrennte Vorarbeit.

Closes #9

Ziel: `NiklasSkulll/arsnova.eu:main`. Geprüfter Branchstand:
`70f3978590c4b4abf0143a8bdea5ffbeff86e4a1`, Vergleichsbasis/Merge-Base
`86f9fa906787fdc1830b694c06c6cb90f29b8cd2`. Die beiden Abschlussdateien
Beitragsabgleich/PR-Beschreibung kommen mit dem nachfolgenden Dokumentationscommit hinzu.

---

## Risiko und Verträge

- [ ] Niedrig – Dokumentation, Texte oder isolierte Änderung ohne geändertes Verhalten
- [ ] Mittel – Benutzeroberfläche, Anwendungslogik, Schema, Persistenz oder Konfiguration
- [x] Hoch – Authentifizierung, Autorisierung, Tokens, WebSockets, Yjs, Redis,
      Datenbankmigrationen, Datenschutz, Deployment oder Sicherheitskonfiguration

**Maßgebliche Quelle und relevante Invarianten:**

Issue #9, `docs/referat-thema-1/AGENTS.md`, datierte Planung und vorhandene
Release-Verträge. Erhöhtes Risiko betrifft ausschließlich privilegierte
Laboroperationen: Störungen nur in den privaten Labor-VMs, eigene Leases und
Rücknahmen, bei fehlgeschlagener Wiederherstellung kein weiterer Lauf.
Gewertete Reihen auf committetem Stand; Entwicklungsstände getrennt.
Fake nur für Störungen, echte Runtime als Normalreferenz. Produktionscode,
Shared Types und Produktionskonfiguration bleiben unverändert.

**Betroffene externe Verträge:**

Labor-Fake für `/slots` und `/v1/chat/completions` mit Bearer-Prüfung;
vorhandene tRPC-/Zod-Verträge der Summary-/Label-Consumer; Docker-/cgroup-
Messwerte und tc/ufw-Ausgaben. Lokale Contract-/Regressionsprüfungen vorhanden.
Keine neue öffentliche API.

---

## Implementierung

- Deterministischer Fake mit Verzögerung, Status/Body, Slotbelegung und
  optionalem Race-Modus; Fehlkonfiguration, fehlender/falscher Bearer und
  Abbruch/Shutdown lokal getestet.
- Störungshelfer für L1/L2, L3, F1, F2 und belegten Slot. Begrenzte Netzregeln,
  Kernelprüfung des DROP, Journal, Lease und automatische Rücknahme mit
  Nachprüfungen. WSL-Steuerung über `labor-wsl.sh`.
- Eigene Live-Fenster mit wiederverwendeten 1A-Lasthelfern, App-CPU/RSS,
  vollständiger Aktionsbilanz und Manifestvergleich. Label-Korpus und eigener
  Aufrufpfad, gerichtete Summary-Folge ohne Breaker-Cooldown.
- Messprotokolle und bereinigte Ergebnis-JSONs für reale Normalreferenzen und
  Störungen, F1/RST–F2/DROP-Erklärung sowie Offline-Transportauswertung.
- S1: temporärer App-Stack auf llm-host, verifizierte Image-Identität,
  begrenzte Bridge-Freigabe und Rücknahme; je drei gewertete Label-/Summary-
  Aufträge. Ungleiche Ressourcen und Treiberplatzierung ausdrücklich ausgewiesen.
- ADR 1B-020 mit Deployment, Updates, Monitoring, Token-Rotation, TLS und
  Betriebsfolgen. Autorenprüfung, Eigenanteil/KI und Beitragsabgleich dokumentiert.
  Labor-VMs, Disks, Labornetz und Image-Cache nach Abschluss entfernt.

---

## Verhaltens- und Abdeckungsprüfung

- [x] Gewünschtes Verhalten und maßgebliche Quelle wurden vor der Implementierung geklärt
- [x] Vergleichbare Implementierungen und betroffene Aufrufpfade wurden geprüft
- [x] Erfolgsfall wurde getestet
- [x] Ablehnungs-, Fehler- oder ungültiger Eingabepfad wurde getestet oder unter
      „Nicht zutreffend“ begründet
- [x] Ein Regressionstest bildet bei einer Fehlerbehebung den ursprünglichen
      Fehler ab
- [x] Relevante Zustandsübergänge wurden geprüft

### Relevante Zustandsübergänge

- [ ] Nicht zustandsbehaftete Änderung
- [x] Wiederholung oder doppelte Anfrage
- [x] Neuladen und Wiederherstellung
- [ ] Reconnect oder Verbindungsersetzung
- [ ] Token- oder Capability-Rotation
- [x] Ablauf und Bereinigung
- [ ] Migration oder Legacy-Daten
- [x] Parallelität oder Race Conditions
- [x] Abhängigkeit vorübergehend nicht verfügbar
- [x] Asynchroner Ablauf: Pending → Erfolg → Ablehnung/Timeout → Retry oder Abbruch
- [ ] DOM-Ersetzung: nach Erfolg und Fehler existiert ein sichtbares,
      nicht verdecktes und fachlich sinnvolles Fokusziel

Wiederherstellung meint Laborzustand und Runtime-Neustart, keine neue
Browser-Reload-Funktion. Parallelität betrifft Leases, Abbruch und den lokal
getesteten Fake-Race; keine gewertete Race-Reihe. Offene Punkte sind unten begründet.

---

## Validierung

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build:prod` bei Frontend-, i18n-, Build- oder Produktionsänderungen
- [x] Betroffene Unit-, Integrations- oder Contract-Tests ergänzt beziehungsweise aktualisiert

### Ausgeführte Prüfungen und Ergebnisse

| Prüfung/Befehl                                                                                                                                                                                                                                                                 | Ergebnis                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --test --test-isolation=none docs/referat-thema-1/evidenz/1B/*.test.mjs docs/referat-thema-1/evidenz/1B/messung/*.test.mjs scripts/load/resource-isolation-live.test.mjs scripts/load/lib/artillery-live-messungen.test.mjs scripts/load/lib/container-metrics.test.mjs` | Auf `70f39785` erneut ausgeführt: 164/164 bestanden, Node v24.18.0/WSL, keine VM-Aufrufe (ca. 8 Sekunden).                                                                    |
| Pester 5.7.1: `Invoke-Pester -Path docs/referat-thema-1/evidenz/1B/labor.Tests.ps1 -PassThru -Output Normal`                                                                                                                                                                   | 18/18 bestanden, Windows PowerShell 5.1; Hyper-V-/VM-Aufrufe gemockt (ca. 11 Sekunden).                                                                                       |
| Pester: `Invoke-Pester -Path docs/referat-thema-1/evidenz/1B -PassThru -Output Normal`                                                                                                                                                                                         | 106/109 bestanden. Drei unveränderte QCOW2-Tests scheitern an nicht verfügbarem `Get-FileHash` in `vm/windows-lib.Tests.ps1:227`. Gesamt-Pester nicht grün (ca. 20 Sekunden). |
| `bash -n` / `node --check` auf den geänderten Shell-/MJS-Dateien                                                                                                                                                                                                               | Syntaxprüfung bestanden; genaue Prüfgrundlage im Beitragsabgleich.                                                                                                            |
| Breiter `npx prettier --check` über die geänderten Dokumente/Skripte und Mess-JSONs                                                                                                                                                                                            | Wegen `ENOMEM` abgebrochen; kein erfolgreicher Gesamtformatcheck. Eingefrorene Messdaten unverändert.                                                                         |
| `npx prettier --check docs/referat-thema-1/1B-3u4-beitragsabgleich.md docs/referat-thema-1/1B-3u4-pr-beschreibung.md`                                                                                                                                                          | Neue Abschlussdokumente formatiert und geprüft.                                                                                                                               |
| `git diff --check main...HEAD -- docs/referat-thema-1 ':!docs/referat-thema-1/evidenz/1B/messung/*.json'` sowie Prüfung der Abschlussdateien                                                                                                                                   | Keine Leerraumfehler im geprüften Umfang.                                                                                                                                     |
| `validatePrTemplateBody` aus `.github/scripts/validate-pr-template.mjs` auf dieser Datei                                                                                                                                                                                       | Lokal gegen den vollständigen Template-Validator geprüft.                                                                                                                     |
| Dokumentierte VM-Reihen und unabhängige S1-Neuberechnung                                                                                                                                                                                                                       | Fachliche Nachweise in den verlinkten Protokollen; beim Abschluss keine VM-Reihe wiederholt.                                                                                  |

Vollständige Befehle, Fehlversuche und Grenzen im
[Beitragsabgleich](https://github.com/NiklasSkulll/arsnova.eu/blob/feature-1B-private-inference-3-4/docs/referat-thema-1/1B-3u4-beitragsabgleich.md).
Am 2026-11-16 waren für `70f39785` keine GitHub-Check-Runs abrufbar.
Die Tabelle ist kein Nachweis erfolgreicher vollständiger CI.

### Zeitaufwand der durchgeführten Laborläufe

Gerundete Rechnerlaufzeiten am 15./16.11.2026, keine gemessene aktive
Arbeitszeit. Grundlage: Laufbeginn aus der UTC-Lauf-ID bis zur Ergebnis-
Erfassung (`umgebung.erfasstAm`), bei abgebrochenen Proben die protokollierten
Zeitfenster. Vorbereitungssynchronisierung vor der Lauf-ID ist nicht enthalten.
Rechner und Ausführungscommit stehen in den jeweiligen
[Protokollen und Messdateien](https://github.com/NiklasSkulll/arsnova.eu/tree/70f3978590c4b4abf0143a8bdea5ffbeff86e4a1/docs/referat-thema-1/evidenz/1B).

**Gewertete Reihen — zusammen ca. 12 Stunden 40 Minuten:**

- Summary-Normalreferenz, 10 Aufträge (ca. 62 Minuten).
- Summary F1/RST, 10 Aufträge (ca. 62 Minuten).
- Summary F2/Firewall-DROP, 5 Aufträge (ca. 31 Minuten).
- Summary L3/Serververzögerung, 10 Aufträge (ca. 62 Minuten).
- Summary Slot belegt, 10 Aufträge (ca. 62 Minuten).
- Label-Normalreferenz, 30 Aufträge in drei Teilläufen (ca. 187 Minuten insgesamt).
- Label F1/RST, 10 Aufträge (ca. 62 Minuten).
- Label L1/+50 ms, 20 Aufträge in zwei Teilläufen (ca. 125 Minuten insgesamt).
- Label L2/+500 ms, 3 Aufträge (ca. 19 Minuten).
- Label L3/Serververzögerung, 3 Aufträge (ca. 19 Minuten).
- Label F2/Firewall-DROP, 3 Aufträge (ca. 20 Minuten).
- Gerichtete F1-Breaker-Kontrolle, 4 Aufträge (ca. 2 Minuten).
- Gerichtete L3-Queue-/Breaker-Folge, 4 Aufträge (ca. 8 Minuten).
- S1/Same-Host Label, 3 Aufträge (ca. 20 Minuten).
- S1/Same-Host Summary, 3 Aufträge (ca. 19 Minuten).

**Entwicklungs- und Diagnoseproben — zusätzlich zusammen ca. 1 Stunde 20 Minuten:**

- Prompt-/Body-Probe (ca. 6 Minuten).
- Live- und RSS-Proben, zwei Läufe (je ca. 7 Minuten).
- F1/RST-Probe (ca. 7 Minuten).
- F2/DROP-Proben einschließlich Korrekturkontrolle, zwei Läufe (je ca. 7 Minuten).
- L3-Verzögerungsprobe (ca. 7 Minuten).
- Probe mit belegtem Slot (ca. 7 Minuten).
- Label-Pfad: zwei abgebrochene Diagnoseproben und korrigierte Probe (ca. 3, 1 und 7 Minuten).
- L1/+50-ms-Probe (ca. 7 Minuten).
- S1-Label-Probe (ca. 7 Minuten).

**Insgesamt ca. 14 Stunden dokumentierte Laborlaufzeit**, zusätzlich zum
Aufwand für Planung, Windows-/Hyper-V-Einrichtung, RAM-/Node-Fehlersuche,
Codekorrekturen, weitere lokale Testläufe, Kalibrierung, Auswertung und
Dokumentation. Diese zusätzlichen Tätigkeiten sind nicht vollständig zeitlich
erfasst und werden nicht mit einer erfundenen Stundenzahl angesetzt.
Die kurzen automatisierten Node-/Pester-Prüfungen stehen separat in der
Validierungstabelle; die Entwicklungsproben zählen nicht als gewertete Reihen.

---

## Risikobezogene Prüfungen

- [x] Keine Benutzeroberflächenänderung oder mobile Darstellung geprüft
- [x] Keine relevante Änderung oder Tastatursteuerung und Fokusverhalten geprüft
- [x] Keine relevante Änderung oder Screenreader-Semantik geprüft
- [x] Keine relevante Änderung oder Reflow, Zoom und Kontrast geprüft
- [x] Keine Realtime-Änderung oder WebSocket-/Yjs-Szenarien geprüft
- [x] Keine Migrationsänderung oder Prisma-Migrationskette auf einer frischen
      Datenbank geprüft
- [x] Keine lastrelevante Änderung oder Last-/Performance-Budget geprüft
- [x] Keine Textänderung oder alle Locales (`de`, `en`, `fr`, `es`, `it`)
      synchronisiert
- [x] Keine Änderung externer Verträge oder Vertrag anhand einer maßgeblichen
      Spezifikation beziehungsweise eines Contract-Tests geprüft
- [x] Keine sicherheitsrelevante Änderung oder erlaubte und abgelehnte
      Sicherheitsgrenze getestet

UI-/Locale-/Realtime-/Migrationspunkte gelten wegen unveränderter Anwendung.
Für die Laborwerkzeuge sind Bearer-Prüfung, Bind-Grenze, Störungs-/S1-Leases,
Fremdzustände und Rücknahme geprüft. Lastschwellen wurden ausgewertet; das
Kreuz behauptet nicht, dass jede Performance-Schwelle eingehalten wurde.

---

## Betrieb und Rollback

- **Auswirkung auf Produktion:** Keine; Laborwerkzeuge, Messdaten und Dokumentation. Keine Produktivtopologie oder Timeout-Vorgabe geändert.
- **Erforderliche Konfigurations- oder Deployment-Schritte:** Zum Review keine. Für eine Wiederholung Labor neu aufbauen und Läufe/Störungen einzeln freigeben. Empfehlungen in ADR 1B-020 sind nicht produktiv umgesetzt.
- **Beobachtbarkeit beziehungsweise relevante Logs/Metriken:** Störungsjournal, Manifest, Job-/Fallback-Ergebnis, Live-p95 und Fehler sowie App-CPU/RSS. Private Mitschnitte und Tokens bleiben lokal; keine Behauptung vorhandener Produktions-Telemetrie.
- **Rollback:** Laborhelfer nehmen eigene Störungen und den S1-Stack zurück und prüfen beide Rollen. Fehlgeschlagene Rücknahme blockiert weitere Läufe. Nach dem bereits erfolgten `destroy` sind keine aktiven Laboränderungen zurückzurollen; normale Git-Rücknahme des PR ändert keine Produktionskonfiguration.

- [x] Keine neuen Secrets, Zugangsdaten, `.env`-Inhalte, Dumps oder lokalen
      Artefakte eingecheckt
- [x] `.env.production.example`, Deployment-Dateien und Betriebsdokumentation
      sind aktuell oder nicht betroffen
- [x] Shared-NAT-Betrieb und mindestens 500 gleichzeitige Hörsaal-Clients sind
      nicht betroffen oder wurden berücksichtigt

Eingecheckte synthetische Ergebnisdateien sind beabsichtigte Evidenz; keine
privaten Betriebsmitschnitte. Shared-NAT-/Produktionslastverhalten unverändert.
Das Laborprofil belegt 500 Ankünfte pro Fenster, keine dauerhaft gleichzeitig
aktiven 500 Personen und keine Kapazitätsfreigabe.

---

## Nachweise

- [Ergebnis und Abschlussstand](https://github.com/NiklasSkulll/arsnova.eu/blob/70f3978590c4b4abf0143a8bdea5ffbeff86e4a1/docs/referat-thema-1/1B-ergebnis.md)
  und [Vorabplanung mit datierten Nachträgen](https://github.com/NiklasSkulll/arsnova.eu/blob/70f3978590c4b4abf0143a8bdea5ffbeff86e4a1/docs/referat-thema-1/1B-3u4-Planung.md).
- [ADR 1B-020](https://github.com/NiklasSkulll/arsnova.eu/blob/70f3978590c4b4abf0143a8bdea5ffbeff86e4a1/docs/referat-thema-1/adr/1B-020-zweite-rolle-betrieblich-begruenden.md),
  [Protokoll-/Dateiindex](https://github.com/NiklasSkulll/arsnova.eu/blob/70f3978590c4b4abf0143a8bdea5ffbeff86e4a1/docs/referat-thema-1/README.md)
  und [Eigenanteil/KI](https://github.com/NiklasSkulll/arsnova.eu/blob/70f3978590c4b4abf0143a8bdea5ffbeff86e4a1/docs/referat-thema-1/1B-eigenanteil.md).
- [S1-Label](https://github.com/NiklasSkulll/arsnova.eu/blob/70f3978590c4b4abf0143a8bdea5ffbeff86e4a1/docs/referat-thema-1/evidenz/1B/2026-11-16-lauf-s1-label.md),
  [S1-Summary](https://github.com/NiklasSkulll/arsnova.eu/blob/70f3978590c4b4abf0143a8bdea5ffbeff86e4a1/docs/referat-thema-1/evidenz/1B/2026-11-16-lauf-s1-summary.md),
  [Transportauswertung](https://github.com/NiklasSkulll/arsnova.eu/blob/70f3978590c4b4abf0143a8bdea5ffbeff86e4a1/docs/referat-thema-1/evidenz/1B/2026-11-16-transportauswertung.md)
  und [Laborabbau](https://github.com/NiklasSkulll/arsnova.eu/blob/70f3978590c4b4abf0143a8bdea5ffbeff86e4a1/docs/referat-thema-1/evidenz/1B/2026-11-16-laborabbau.md).

---

## Nicht zutreffend und verbleibende Risiken

- **Nicht zutreffende Prüfungen:** Kein Frontend-/i18n-/DOM-, Reconnect-, Produktivmigrations- oder Rotationspatch. Token-Rotation und TLS werden betrieblich bewertet, nicht implementiert. Kein Produktivbuild erforderlich. Typecheck, vollständige `npm test`-Suite und Lint wurden in diesem Abschluss nicht erneut ausgeführt; unveränderter Produktcode ersetzt die erforderlichen PR-/CI-Gates nicht. Zustandslosigkeit trifft auf die Laborhelfer nicht zu.
- **Verbleibende Risiken:** Gesamt-Pester hat drei Fehler im unveränderten Windows-Modul; Gesamtformatprüfung wegen Speichermangels offen. Vor Merge müssen erforderliche Checks erfolgreich laufen. Kleine Teilreihen, gemeinsamer physischer Host, sequenzielle Erhebung und abweichende S1-Kapazität begrenzen die Kausalität. Interne Label-Fallback-Frist nicht direkt prüfbar; Queue-Erklärung indirekt mit Codebezug. Summary-Antworten fallen im realen Pfad auf `invalid_response` zurück. Keine Produktions-, Qualitäts-, Sicherheits- oder pauschale Isolationsfreigabe. Issue-Abschluss erst mit tatsächlichem Merge.

---

## Selbstreview

- [x] Der vollständige Diff wurde unabhängig noch einmal geprüft
- [x] Aufgabenstellung und Akzeptanzkriterien wurden erneut mit dem Ergebnis verglichen
- [x] Code, Tests, Schemas, Dokumentation, Konfiguration, Übersetzungen und
      PR-Beschreibung widersprechen sich nicht
- [x] Vergleichbare Pfade enthalten den behobenen Fehler nicht weiterhin
- [x] Temporärer Code, Debug-Ausgaben und überholte Kommentare wurden entfernt
- [x] Sicherheits-, Barrierefreiheits-, Kompatibilitäts- und
      Performanceaussagen sind durch Nachweise gedeckt
- [x] Der PR ist vollständig und bereit für ein Review
- [x] Keine asynchrone UI-Änderung oder Erfolg, Pending, Fehler und Fokus wurden
      anhand des tatsächlichen DOM-Ablaufs geprüft

Bereit für Review mit offengelegten Prüflücken; noch keine Merge-Freigabe.
Der unabhängige Review prüfte Code-/Dokumentationspfade und S1-Zahlen, nicht
jede Rohdatenzeile. Historische Zwischenstände bleiben datiert erhalten.

---

## Eigenanteil

### Aufgabe und Beitrag

Umsetzung der Aufgabe 1B (Schritte 3–4) erfolgte agentengestützt durch Vibe-Coding mit **GPT-6.1 Sol (OpenAI, 2026b)** in **Codex (OpenAI, 2026a)**.

> - OpenAI. (2026a). Codex [KI-gestützter Programmierassistent]. https://chatgpt.com/codex
> - OpenAI. (2026b). GPT-6.1 Sol [Large language model]. https://developers.openai.com/api/docs/models/gpt-6.1-sol

- **Aufgabe:** 1B Schritte 3–4 – Latenz- und Ausfallexperimente sowie Bewertung des Betriebsaufwands der zweiten privaten Inferenzrolle, zugeordnet zu **[Niklas Schneider](https://github.com/NiklasSkulll)** gemäß `docs/referat-thema-1/01-aufteilung.md`, Issue #9.
- **Änderungen und Zweck:**
  - **Versuchsplanung:** Hypothesen, Gegenalternative, Messgrößen, Wiederholungen und Entscheidungsschwellen vor den gewerteten Reihen dokumentiert. Spätere Umfangsreduzierungen wurden als datierte Nachträge festgehalten. Beleg: `docs/referat-thema-1/1B-3u4-Planung.md`; Commits `5e758d0a`, `aa0e90c7`.
  - **Deterministische Störungen:** Fake-Runtime mit Bearer-Prüfung, Slot-Sonde, Completion-Pfad, Verzögerung und konfigurierbaren Antworten ergänzt. Störungshelfer für Netzlatenz, Runtime-Ausfall, Firewall-DROP und belegten Slot mit Lease, Journal und Rücknahme implementiert. Belege: `fake-runtime.mjs`, `fault-vm.mjs` und zugehörige Tests unter `evidenz/1B/`; Commits `5e758d0a`, `2b39b9df`.
  - **Live- und Ressourcenmessung:** Vorhandene 1A-Lasthelfer für eigene Messfenster wiederverwendet und App-CPU, Prozess-RSS, Live-p95, Fehler sowie vollständige Aktionsbilanzen erfasst. Belege: `messfenster.mjs`, `experiment-result.mjs`, `vergleichen.mjs`; Commit `5e758d0a`.
  - **Label- und Summary-Untersuchung:** Eigene Normalreferenzen, getrennte Consumer-Auswertung, Label-Korpus und Laufzeitmanifeste ergänzt. Der Label-Pfad prüft ausdrücklich, ob die Modellphase erreicht und eine Modellantwort übernommen wurde. Belege: `auftraege.mjs`, `korpus.mjs`, `treiber.mjs`; Commit `7c64dd6a`.
  - **Schritt-3-Auswertung:** Störreihen, Unterschied zwischen RST und DROP, gerichteten Queue-/Breaker-Vergleich und Transportanteil ausgewertet. Negative Ergebnisse und nicht beobachtbare interne Zustände bleiben erhalten. Belege: Laufprotokolle und `2026-11-16-transportauswertung.md`; Commit `aa0e90c7`.
  - **Same-Host-Vergleich:** Temporären S1-App-Stack auf der Inferenz-VM mit überprüfter Image-Identität, begrenzter Firewallfreigabe und Wiederherstellung umgesetzt. Je drei gewertete Label- und Summary-Aufträge ausgeführt und verglichen. Belege: `s1.sh`, `s1-host.sh`, `s1.mjs`, S1-Protokolle; Commits `4b135fe8`, `70f39785`.
  - **Betriebsentscheidung und Abschluss:** Deployment, Updates, Monitoring, Token-Rotation und TLS gegen die beobachteten Grenzen abgewogen. Autorenprüfung und Beitragsabgrenzung dokumentiert sowie Labor-VMs, Disks, Labornetz und Image-Cache entfernt. Belege: `adr/1B-020-zweite-rolle-betrieblich-begruenden.md`, `2026-11-16-laborabbau.md`; Commit `70f39785`.
- **Belege:** Einstieg über `docs/referat-thema-1/1B-ergebnis.md`; detaillierte Zuordnung im derzeit noch nicht committeten `1B-3u4-beitragsabgleich.md`. Die genannten Labor-Dateien und Protokolle liegen unter `docs/referat-thema-1/evidenz/1B/`.
- **Gemeinschaftliche oder unklare Anteile:** **[Jonas](https://github.com/jonasyr)** verantwortet 1B Schritte 1–2. **[Niklas Schneider](https://github.com/NiklasSkulll)** beauftragte und begleitete Schritte 3–4, führte die Laborbefehle auf seinem PC aus, übergab Ergebnisse und bestätigte deren fachliche Prüfung. Git-Autorschaft wird nicht mit ausschließlich manuell geschriebenem Code gleichgesetzt.

### Prüfgrundlage

- `feature-1B-private-inference-3-4@70f3978590c4b4abf0143a8bdea5ffbeff86e4a1` gegenüber `origin/main@86f9fa906787fdc1830b694c06c6cb90f29b8cd2`.
- **Merge-Base:** `86f9fa906787fdc1830b694c06c6cb90f29b8cd2`.
- **Vergleichswahl:** `git diff origin/main...HEAD`. Die GitHub-CLI bestätigte denselben aktuellen Fork-main-Commit. Der committete Diff umfasst 93 Dateien mit Laborwerkzeugen, Tests, Dokumentation und Messdaten. Anwendungscode, Shared Types, Produktions-Compose, Produktionsumgebungsvorlage, Deploy-Skript und CI-Workflow sind unverändert.
- **Nicht committete Änderungen:** Änderungen an `1B-eigenanteil.md`, `1B-ergebnis.md` und `README.md`; neu sind `1B-3u4-beitragsabgleich.md` und `1B-3u4-pr-beschreibung.md`. Diese Abschlussdokumentation gehört noch nicht zum geprüften HEAD.
- **Vorgaben und Aufgabendokumentation:** `00-rahmen-und-pruefung.md`, `01-aufteilung.md`, `1B-private-inferenz-zweiter-host.md`, die Laborregeln, die datierte Planung und das über GitHub-CLI geprüfte Issue #9. Die individuelle Nachweiskette entspricht diesen Vorgaben; ausdrücklich ausgewiesene Messgrenzen bleiben bestehen.
- **Datumsprüfung:** Die eigenen Laufprotokolle belegen Messungen am **15./16.11.2026**, Autorenprüfung und Laborabbau am **16.11.2026**. HEAD stammt ebenfalls vom 16.11.2026. Das belegt den fachlichen Arbeitsstand, keinen Merge oder eine persönliche Prüfungsabgabe.

### Anforderungsabgleich

- **Abgedeckt – Vorabplanung:** Hypothesen, Gegenalternative, Budgets und Schwellen sind vor den gewerteten Reihen dokumentiert. Der gekürzte Restumfang ist durch datierte Nachträge nachvollziehbar.
- **Abgedeckt – eigener ausführbarer Test:** Fake-, Störungs-, Messfenster-, Vergleichs- und S1-Tests liegen vor. Die agentengestützte Entwicklung ist offengelegt.
- **Abgedeckt – eigene Referenzen und Störungen:** Reale Summary-/Label-Normalreihen, eigene B0/F1-Referenzen, L1/L2, L3, F1/F2 und belegter Slot wurden im vereinbarten Umfang untersucht. Der Fake ersetzt keine Normalbaseline. Nicht jede Variante wurde für jeden Consumer wiederholt.
- **Abgedeckt – App-Rückwirkung:** Live-p95, Fehler und App-CPU/RSS wurden mit vollständigen Messfenstern erfasst. Das Profil beschreibt eine Ankunftswelle, keine dauerhaft konstante Konkurrenz von 500 Personen.
- **Abgedeckt – Fehlerverhalten und Transport:** RST/DROP-Unterschied, gerichteter Queue-/Breaker-Vergleich und Transportauswertung sind dokumentiert. Störungsbefehle, Rücknahmen und Nachprüfungen sind nachvollziehbar.
- **Teilweise abgedeckt – interne Label-Fallback-Frist:** Interne Job-Zeit und Fallback-Grund werden von der Label-API nicht offengelegt. Client-Wartezeit und Ergebniszustand wurden gemessen; das enge interne Zeitkriterium wird nicht als bestanden ausgegeben.
- **Abgedeckt – S1 und Betriebsbewertung:** Same-Host-Reihen sowie Deployment, Updates, Monitoring, Token-Rotation und TLS sind bewertet. ADR 1B-020 enthält Alternativen und konkrete Betriebsfolgen.
- **Nicht anwendbar – optionale Zusatzversuche:** Die optionale Race-Messreihe wurde ausgelassen. Der Fake-Race ist lokal getestet; ein gewerteter VM-Race-Nachweis wird nicht behauptet.
- **Teilweise abgedeckt – formaler Abschluss:** Autorenprüfung und Beitragsabgleich liegen vor. Abschlussdateien sind noch nicht committet; erfolgreiche erforderliche PR-Checks und Merge fehlen.
- **Nicht anwendbar – weitergehende Freigaben:** Produktionspatch, produktive Konsolidierung, Kapazitätsfreigabe, vollständiger Sicherheitsnachweis oder erfolgreiche Modellqualität gehören nicht zum belegten Ergebnis.

### Tests

- **Tests:** Unter anderem `fake-runtime.test.mjs`, `fault-vm.test.mjs`, `experiment-lauf.test.mjs`, `auftraege.test.mjs`, `messfenster.test.mjs`, `vergleichen.test.mjs`, `s1.test.mjs` und `labor.Tests.ps1`. Geprüft werden erfolgreiche und abgelehnte Aufrufe, ungültige Konfiguration, Abbruch, unvollständige Messungen, fremde Zustände, Kernel-DROP und Wiederherstellung.
- **Status:** Im vorherigen Abschlussabgleich auf `70f39785` erneut ausgeführt und im Beitragsabgleich dokumentiert. Für diese Eigenanteil-Section wurden keine Tests oder Laborläufe erneut gestartet; Git-Stand, Quellen und GitHub-Status wurden erneut gelesen.
- **Ergebnis:** **164/164 lokale Node-Tests bestanden**, ebenso **18/18 Tests** des direkt geänderten PowerShell-Pfads. Der gesamte Pester-Lauf bestand **106/109 Tests**; drei Fälle im unveränderten `vm/windows-lib.Tests.ps1:227` scheiterten an nicht verfügbarem `Get-FileHash`.
- **Weitere Prüfungen:** Syntaxprüfung der sieben geänderten Shell- und 20 MJS-Dateien bestanden. Neue Abschlussdokumente bestehen Markdown-, Linkziel- und Diff-Prüfung; der lokale PR-Template-Validator meldete `ok=true`. Der unabhängige Branch-Review fand keine konkreten technischen oder wissenschaftlichen Blocker; S1-Vergleiche wurden zusätzlich aus den gespeicherten Daten reproduziert.
- **Grenzen des Prüfstands:** Der Gesamtformatcheck einschließlich großer Mess-JSONs wurde wegen `ENOMEM` abgebrochen. Vollständige Typecheck-, Test-, Lint- und Produktionsbuild-Läufe wurden im Abschluss nicht erneut ausgeführt. GitHub meldet aktuell keine Check-Runs für HEAD; eine vollständig grüne CI wird nicht behauptet.

### Individuelle Beweiskette

- **Hypothese:** H2 prüft, ob langsame oder ausgefallene Inferenz ohne zusätzliche Live-Fehler und mit begrenzter Fallback-Zeit behandelt wird. Ergänzend gilt eine vorab festgelegte Live-p95-Schwelle von höchstens 110 % der Referenz. Beleg: `1B-3u4-Planung.md`.
- **Gegenhypothese:** Netzfehler, lange Wartebindung und gemeinsam genutzte physische Ressourcen können Live-Aktionen trotz zweiter Serverrolle beeinträchtigen; deren Mehrbetrieb könnte ohne ausreichenden Isolationsgewinn bleiben.
- **Eigener ausführbarer Test:** Die für Schritte 3–4 ergänzten Fake-, Störungs-, Mess- und S1-Vertragstests, transparent agentengestützt entwickelt und von übernommener Infrastruktur abgegrenzt.
- **Eigener Baseline-Lauf:** Reale Summary-Normalreihe und 30 Label-Normalaufträge auf dem eigenen PC. Summary-Qualitätsfallbacks sind offengelegt; eigene B0/F1-Reihen bilden zusätzliche Referenzen.
- **Fehler/Variante:** Netzverzögerung um 50/500 ms, Serververzögerung über dem Budget, gestoppte Runtime, Firewall-DROP und belegter Slot; zusätzlich gerichtete Queue-/Breaker-Folgen und S1.
- **Ergebnis mit Gültigkeitsgrenze:** In den ausgewerteten Reihen wurden keine zusätzlichen Live-Fehler beobachtet, mehrere Latenzschwellen wurden jedoch überschritten. S1-Label überschreitet die Schwelle bei Beitritt und Quizstimme; S1-Summary hält alle vier Live-Latenzschwellen ein. Summary liefert wie die Zwei-Host-Normalreferenz extraktiven Fallback wegen `invalid_response`. Gemeinsamer physischer Host, kleine Teilreihen, ungleiche S1-Kapazität und fehlende interne Label-Zeiten begrenzen die Aussage.
- **Entscheidung:** Gemäß ADR 1B-020 ist die zweite Rolle durch betriebliche Trennung zu begründen. Ein allgemeiner Leistungs- oder Wirtschaftlichkeitsvorteil ist nicht belegt. Timeouts hostabhängig kalibrieren, Fallbacks überwachen und bei Queue-Timeouts nicht allein auf den Breaker vertrauen. Die Produktionsleitplanke bleibt bestehen.

### Offen

- **Technisch:** Drei Pester-Fehler im unveränderten Windows-Testmodul, vollständiger Formatcheck und erforderliche PR-/CI-Gesamtprüfungen bleiben offen. Kein weiterer Laborlauf für den vereinbarten Umfang erforderlich; die VMs sind bereits abgebaut.
- **Dokumentation und Prüfungsnachweise:** Abschlussdateien noch committen und pushen. Die GitHub-CLI fand aktuell keine PR für diesen Branch; Issue #9 ist offen, ein Merge nicht belegt. Autorenprüfung der fachlichen Ausarbeitung wurde bestätigt. Institutionelle KI-Vorgaben, persönliche fachliche Vertretung und tatsächliche Abgabe werden dadurch nicht vorweggenommen.

### Leistungsnachweis

- Ich habe die 1B-Stör- und S1-Läufe auf meinem PC ausgeführt, Ergebnisse bereitgestellt und die Befunde sowie die Betriebsbewertung geprüft.
- Im Niklas zugeordneten Branch entstand mit offengelegter KI-Unterstützung eine reproduzierbare Untersuchung der privaten Inferenzrolle, einschließlich negativer Ergebnisse, klarer Messgrenzen und begründeter Betriebsentscheidung. Jonas’ Vorarbeit bleibt getrennt ausgewiesen.
