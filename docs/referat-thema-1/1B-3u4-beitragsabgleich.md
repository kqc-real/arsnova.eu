## Eigenanteil

### Aufgabe und Beitrag

- **Aufgabe:** Issue [#9](https://github.com/NiklasSkulll/arsnova.eu/issues/9),
  1B Schritte 3–4: Latenz-/Ausfallexperimente und Betriebsbewertung.
- **Änderungen und Zweck:** Deterministische Test-Runtime, Störungshelfer mit
  Rücknahme, Live-/CPU-/RSS-Messung, Label-/Summary-Treiber, strikter Vergleich,
  S1-Labor und Auswertung. Damit werden eigene Normalreferenzen mit Störungen
  verglichen und die zweite Serverrolle betrieblich bewertet.
- **Belege:** [Planung](1B-3u4-Planung.md),
  [Ergebnis und Abschlussstand](1B-ergebnis.md#abschlussstand-schritte-34-bestätigt-am-2026-11-16),
  [ADR 1B-020](adr/1B-020-zweite-rolle-betrieblich-begruenden.md),
  [Eigenanteil/KI](1B-eigenanteil.md#schritte-34-niklas).
- **Gemeinschaftliche oder unklare Anteile:** Niklas beauftragte und begleitete
  die Arbeit, führte Laborbefehle auf seinem PC aus, übergab Ergebnisse,
  commitete/pushte und bestätigte die fachliche Prüfung. Werkzeuge, Tests,
  Analysen und Dokumentationsentwürfe entstanden mit Codex. Commit-Autorschaft
  belegt keinen vollständig selbst geschriebenen Code. Jonas' Schritte 1–2,
  das gemeinsame Labor, die 1C-Referenzfixture und das vorhandene 1A-Live-Profil
  werden als Vorarbeit abgegrenzt; keine pauschale Zuschreibung an Niklas.

### Prüfgrundlage

- `feature-1B-private-inference-3-4@70f3978590c4b4abf0143a8bdea5ffbeff86e4a1`
  gegenüber `main@86f9fa906787fdc1830b694c06c6cb90f29b8cd2`.
- **Merge-Base:** `86f9fa906787fdc1830b694c06c6cb90f29b8cd2`;
  `origin/main` und über GitHub API gelesener Fork-`main` stimmen damit überein.
  Dies ist die Branch-Vergleichsbasis; Ausführungscommits der einzelnen
  Messungen bleiben die jeweiligen Protokollangaben.
- **Nicht committete Änderungen:** Zu Beginn eine leere, ungetrackte
  `1B-3u4-pr-beschreibung.md`. Dieser Beitragsabgleich und die ausgefüllte
  PR-Beschreibung sowie datierte Verweise in Ergebnis, Eigenanteil und README
  entstehen danach und sind nicht Bestandteil des geprüften HEAD.
- **Vorgaben und Aufgabendokumentation:**
  [Rahmen](00-rahmen-und-pruefung.md#pflicht-nachweiskette-je-person),
  [Aufteilung](01-aufteilung.md), Issue #9,
  [Dossier](1B-private-inferenz-zweiter-host.md),
  [Laborregeln](AGENTS.md#1b-labor-für-agenten-codex-claude),
  [Runbook](evidenz/1B/runbook.md) und
  [Abgleichvorlage](final-prompt-for-git-diff.md). Keine fehlende Pflichtquelle.
  Das dortige Nur-Lesen-Gebot betrifft den Auditablauf; die aktuelle ausdrückliche
  Beauftragung zum Speichern der Abschlussdokumente hat Vorrang.
- **Umfang:** `git diff main...HEAD` umfasst 93 Dateien: Laborwerkzeuge,
  Labortests, Dokumentation und Messdaten. Keine Änderungen in `apps/`, `libs/`,
  Produktions-Compose, Produktionsumgebungsvorlage, Deploy-Skript oder CI-Workflow.
  Große Ergebnis-JSONs wurden nicht manuell zeilenweise geprüft; S1-Kennzahlen
  wurden zusätzlich unabhängig aus den gespeicherten Daten reproduziert.
- **Commits:** `5e758d0a` Versuchswerkzeuge; `2b39b9df` Kernelprüfung DROP;
  `7c64dd6a` Label-Pfad und Manifeste; `aa0e90c7` Schritt-3-Auswertung;
  `4b135fe8` S1-Werkzeuge; `70f39785` fachlicher Abschluss und Laborabbau.
- **Datum:** Am 2026-11-16 abgeglichen. HEAD ist vom 2026-11-16;
  Laufprotokolle belegen Messungen am 15./16.11. und Autorenprüfung am 16.11.
  Kein Merge-/Abgabedatum daraus abgeleitet; Issue ist beim Abgleich offen.

### Anforderungsabgleich

- **Abgedeckt — Vorabplanung:** Hypothesen, Gegenalternative, Messgrößen,
  Budgets und Schwellen vor den gewerteten Reihen dokumentiert. Datierte
  Reduzierungen des Restumfangs bleiben sichtbar; keine nachträgliche Änderung
  ungünstiger Schwellen ([Planung](1B-3u4-Planung.md)).
- **Abgedeckt — eigener ausführbarer Test:**
  [Fake-Vertragstests](evidenz/1B/fake-runtime.test.mjs),
  [Störungs-Lebenszyklus](evidenz/1B/fault-vm.test.mjs),
  [Messfenster](evidenz/1B/messfenster.test.mjs) und
  [S1-Tests](evidenz/1B/s1.test.mjs). Agentengestützte Implementierung offengelegt.
- **Abgedeckt — reale eigene Referenzen und Varianten:** Summary-/Label-
  Normalreihen, eigene B0/F1-Referenzen, L1/L2, L3, F1/F2 und belegter Slot
  im vereinbarten Umfang; Fake nur für deterministische Störungen.
  Nicht jede Variante wurde für jeden Consumer wiederholt; maßgeblich ist
  der datiert gekürzte Plan, kein vollständiges kartesisches Testprogramm.
- **Abgedeckt — App-Rückwirkung und Nachweisablage:** Live-p95/Fehler sowie
  App-CPU/RSS, Manifeste und Rücknahmen in den
  [Protokollen und Ergebnisdateien](README.md). Das Profil misst eine Ankunftswelle,
  keine konstante Konkurrenz von 500 Personen. PCAPs bleiben wegen enthaltener
  Tokens lokal; eingecheckt sind abgeleitete, bereinigte Messdaten.
- **Abgedeckt — Transport, RST/DROP, Queue/Breaker:**
  [Transportauswertung](evidenz/1B/2026-11-16-transportauswertung.md),
  [F2/Summary](evidenz/1B/2026-11-16-lauf-f2-summary.md),
  [F1-Kontrolle](evidenz/1B/2026-11-16-lauf-breaker-f1-summary.md) und
  [gerichtete Queue-Folge](evidenz/1B/2026-11-16-lauf-breaker-l3-summary.md).
  Verhaltensnachweis mit Codebezug; kein direkt ausgelesener interner Breaker-Zähler.
- **Teilweise abgedeckt — interne Label-Fallback-Frist:** API legt interne
  Job-Zeit und Fallback-Grund nicht offen. Client-Wartezeit und transientes
  Ergebnis gemessen; das enge interne Kriterium wird ausdrücklich nicht als
  bestanden ausgegeben. Diese Messgrenze wird durch Wiederholung nicht behoben.
- **Abgedeckt — S1 und Betriebsentscheidung:**
  [Label](evidenz/1B/2026-11-16-lauf-s1-label.md),
  [Summary](evidenz/1B/2026-11-16-lauf-s1-summary.md) und ADR 1B-020.
  Deployment, Updates, Monitoring, Token-Rotation und TLS qualitativ bewertet;
  Kosten-/Risikogrenzen und konkrete Betriebsfolgen dokumentiert.
- **Nicht anwendbar — optionale Race-Messreihe und Produktionspatch:**
  bewusst ausgelassen bzw. nicht beauftragt. Race-Unterstützung des Fakes ist
  lokal getestet, aber kein gewerteter VM-Race-Nachweis.
- **Teilweise abgedeckt — formaler Abschluss:** Autorenprüfung und
  Beitragsabgrenzung liegen vor; dieser Bericht erledigt den Branch-/Beitragsabgleich.
  PR-Erstellung, erfolgreiche erforderliche Checks und Merge bleiben ausstehend.

### Tests

- **Tests:** Fake-HTTP/Bearer, Abbruch/Shutdown, Störungs-Lease und Rücknahme,
  ufw-Kernelprüfung, Label-/Summary-Aufruf, vollständige Messfenster,
  Manifestvergleiche, Korpus, S1, bestehende Auswertungs- und Lasthelfer.
- **Status:** Am 2026-11-16 erneut lokal auf HEAD `70f39785` ausgeführt;
  Node v24.18.0 unter WSL. Keine Labor-VM oder Störung gestartet.
- **Ergebnis:** Folgender Node-Befehl: **164 bestanden, 0 fehlgeschlagen**.

  ```bash
  node --test --test-isolation=none \
    docs/referat-thema-1/evidenz/1B/*.test.mjs \
    docs/referat-thema-1/evidenz/1B/messung/*.test.mjs \
    scripts/load/resource-isolation-live.test.mjs \
    scripts/load/lib/artillery-live-messungen.test.mjs \
    scripts/load/lib/container-metrics.test.mjs
  ```

- **PowerShell:** Windows PowerShell 5.1/Pester 5.7.1:
  `Invoke-Pester -Path docs/referat-thema-1/evidenz/1B -PassThru -Output Normal`
  mit importiertem Pester: **106/109 bestanden**. Drei Fälle in der unveränderten
  `vm/windows-lib.Tests.ps1:227` scheitern an nicht verfügbarem `Get-FileHash`.
  Das ist kein belegter Fehler der geänderten Laborskripte, aber auch kein grüner
  Gesamt-Pester-Lauf. Ein Wiederholungsversuch mit explizitem Utility-Import
  scheiterte bereits an WSL-Interop (`UtilAcceptVsock`); kein neues Testergebnis.
- **Geänderter PowerShell-Pfad separat:**
  `Invoke-Pester -Path docs/referat-thema-1/evidenz/1B/labor.Tests.ps1 -PassThru -Output Normal`:
  **18/18 bestanden**; VM-/Hyper-V-Aufrufe gemockt.
- **Weitere Prüfung:** Shell-/Node-Syntax der sieben im Branch geänderten Shell- und 20 MJS-Dateien und
  `git diff --check main...HEAD` ohne Ergebnis-JSONs erfolgreich geprüft.
  Markdown-/Template-Prüfung der neuen Abschlussdateien mit ihrer Fertigstellung
  bestanden; `validatePrTemplateBody` meldet `ok=true`, lokale Linkziele vorhanden.
- **Formatgrenze:** Breiter Prettier-Check einschließlich großer Mess-JSONs
  wegen `ENOMEM` abgebrochen; zwei einzeln geprüfte Ergebnisdateien bestanden.
  Eingefrorene Messdaten nicht umformatiert. Kein erfolgreicher Gesamtformatcheck.
- **Nicht neu ausgeführt:** `npm run typecheck`, `npm test`, `npm run lint`,
  `npm run build:prod`; keine Produktcodeänderung. Insbesondere bleibt die volle
  Test-Suite eine PR-/CI-Anforderung. Für HEAD lieferte GitHub beim Abgleich
  keine Check-Runs; daraus folgt kein grüner CI-Nachweis.
- **Unabhängiger Review:** Erneuter Review des Branchumfangs fand keine
  konkreten technischen/wissenschaftlichen Blocker; keine vollständige
  Rekonstruktion aller Rohmessungen. S1-Vergleiche reproduziert. Dieser
  Review ersetzt weder die fehlenden Gesamtprüfungen noch den GitHub-Review.

### Individuelle Beweiskette

- **Hypothese:** H2 und zusätzliche Latenzschwelle in der
  [Vorabplanung](1B-3u4-Planung.md#ziel-und-verbindliche-quellen).
- **Gegenhypothese:** Netzfehler, Wartebindung und geteilte physische Ressourcen
  können Live-Signale trotz zweiter VM beeinflussen; gleiche Planung.
- **Eigener ausführbarer Test:** Fake-/Störungs-/Mess- und S1-Vertragstests,
  agentengestützt entwickelt und separat von übernommener Infrastruktur ausgewiesen.
- **Eigener Baseline-Lauf:**
  [Summary normal](evidenz/1B/2026-11-15-lauf-normal-summary.md) und
  [Label normal](evidenz/1B/2026-11-16-lauf-normal-label-03.md), eigener PC,
  tatsächliche Inferenz; Summary mit offengelegtem Qualitätsfallback.
- **Fehler/Variante:** L1/L2, L3, F1, F2, belegter Slot, gerichteter Queue-/Breaker-
  Vergleich und S1; Quellen über [Ergebnisbericht](1B-ergebnis.md).
- **Ergebnis mit Gültigkeitsgrenze:** Fehlerfreiheit beobachtet, Latenzschwellen
  mehrfach überschritten. Gemeinsamer physischer Host, kleine Teilreihen,
  ungleiche S1-Ressourcen, fehlende interne Label-Zeiten. Kein allgemeiner
  Isolations-, Produktionskapazitäts- oder Qualitätsnachweis.
- **Entscheidung:** [ADR 1B-020](adr/1B-020-zweite-rolle-betrieblich-begruenden.md):
  zweite Rolle betrieblich begründen, Timeouts hostabhängig kalibrieren,
  Fallbacks überwachen, bei Queue-Timeouts nicht allein auf den Breaker vertrauen.

### Offen

- **Technisch:** Kein weiterer Laborlauf für den vereinbarten Umfang.
  Drei bestehende Pester-Hashfälle sind auf dieser Windows-Umgebung nicht grün;
  vollständiger Formatcheck und erforderliche CI-/Gesamttests vor Merge offen.
  VMs wurden [abgebaut](evidenz/1B/2026-11-16-laborabbau.md); Wiederholung braucht
  einen neuen Aufbau und gesonderte Freigabe, ist für diesen Abgleich nicht nötig.
- **Dokumentation und Prüfungsnachweise:** Beitragsabgleich erledigt,
  [PR-Beschreibung](1B-3u4-pr-beschreibung.md) lokal vorbereitet. Niklas muss
  beide neuen Dateien noch committen/pushen, die PR gegen Fork-`main` manuell
  öffnen und die Checks abwarten. Merge und formale Abgabe sind nicht erfolgt.
  Art und Umfang erlaubter KI-Nutzung für die Prüfung werden durch diesen
  technischen Nachweis nicht festgelegt.

### Leistungsnachweis

- Ich habe die 1B-Stör- und S1-Läufe auf meinem PC ausgeführt, Ergebnisse
  bereitgestellt und die Befunde sowie die Betriebsbewertung geprüft.
- Mit offengelegter KI-Unterstützung wurden reproduzierbare Testwerkzeuge und
  eine begrenzte, auch negative Befunde erhaltende Bewertung der zweiten
  Inferenzrolle erarbeitet; Jonas' Vorarbeit bleibt getrennt ausgewiesen.
