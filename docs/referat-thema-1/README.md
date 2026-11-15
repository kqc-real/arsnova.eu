# Referat Cloud Computing – Thema 1 (Arbeitsordner)

Arbeitsordner von Jonas und Niklas für **Thema 1: KI-Inferenz für den
Moderationskompass – Systemgrenzen und entkoppelte Architektur**. Wir
bearbeiten alle drei Aufträge 1A, 1B und 1C.

Der Ordner liegt im Fork-`main` und ist Arbeits- und Evidenzmaterial. Er
gehört **nicht** in die PR an kqc-real.

## Inhalt

| Datei                                                                                            | Inhalt                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [00-rahmen-und-pruefung.md](./00-rahmen-und-pruefung.md)                                         | Generalthema, Bewertung, Nachweiskette, KI-Regeln, Widersprüche, offene Fragen                                                                                                                                                        |
| [01-aufteilung.md](./01-aufteilung.md)                                                           | Aufteilung: Niklas = X (1A, 1B 3–4), Jonas = Y (1C, 1B 1–2); Optionen, Aufwand                                                                                                                                                        |
| [1C-ergebnis.md](./1C-ergebnis.md)                                                               | **Einstieg 1C:** Ergebnisbericht mit Kurzantwort, Nachweiskette, Befunden, Ursachenketten, Kosten, offenen Punkten                                                                                                                    |
| [adr/](./adr/)                                                                                   | Entscheidungsprotokolle (ADRs) 1C-001 bis 1C-026 (22 ADRs) und 1B-001 bis 1B-012 mit Index                                                                                                                                            |
| [1C-eigenanteil.md](./1C-eigenanteil.md)                                                         | Eigenanteil und KI-Offenlegung zu 1C                                                                                                                                                                                                  |
| [1C-praesentation-geruest.md](./1C-praesentation-geruest.md)                                     | Gerüst für Folien und Handout zu 1C                                                                                                                                                                                                   |
| [1C-diagrams.md](./1C-diagrams.md)                                                               | Diagramme zu 1C (Handout, Arbeitskarte und Vertragsschichten) mit Belegtabelle                                                                                                                                                        |
| [diagrams/](./diagrams/)                                                                         | Mermaid-Quellen (`.mmd`) mit gerenderten SVGs (hell und dunkel), `render.sh` und Regeln in [diagrams/README.md](./diagrams/README.md)                                                                                                 |
| [specs/](./specs/)                                                                               | Vorab festgelegte Designs und Pläne der 1C- und 1B-Tests und -Messungen (1C: Teil 1 bis 3, Labor-Design, Design und Plan der Abschlussdokumentation, Nachlauf-Design vom 2026-11-06; 1B: Zeile unten)                                 |
| [evidenz/1C/](./evidenz/1C/)                                                                     | Testprotokolle, Mutationsproben, Messrohdaten und Auswertung zu 1C                                                                                                                                                                    |
| [1A-ressourcenisolation-app-host.md](./1A-ressourcenisolation-app-host.md)                       | Aktueller A1-Auftrag, bearbeiteter Umfang und Verweise auf Ergebnisse und Nachweise                                                                                                                                                   |
| [1B-private-inferenz-zweiter-host.md](./1B-private-inferenz-zweiter-host.md)                     | Zwei-Host-Deployment, LLM-Client, Messbarkeit, Lücken für 1B                                                                                                                                                                          |
| [specs/2026-11-12-1b-zwei-host-design.md](./specs/2026-11-12-1b-zwei-host-design.md)             | Design 1B Schritte 1–2 (zwei VMs, Summary-Auftrag, Zeitzerlegung), mit [Plan](./specs/2026-11-12-1b-zwei-host-plan.md)                                                                                                                |
| [evidenz/1B/](./evidenz/1B/)                                                                     | Skripte, Messauswertung und Protokolle zu 1B                                                                                                                                                                                          |
| [1B-ergebnis.md](./1B-ergebnis.md)                                                               | Ergebnis 1B: Schritte 1–2 (Jonas), Gliederung für 3–4 (Niklas), gemeinsames Kurzfazit                                                                                                                                                 |
| [1B-diagrams.md](./1B-diagrams.md)                                                               | Topologie des Labors, Ablauf eines Summary-Auftrags mit Messschnitten, Belegtabelle am Stand `a19ca70f` (Laborskripte `8e9d1317`)                                                                                                     |
| [evidenz/1B/runbook.md](./evidenz/1B/runbook.md)                                                 | Nachbau des Labors mit einem Befehl, Lauf und Messmodi, Datenregeln, Übergabe an Niklas, Tests der Laborskripte                                                                                                                       |
| [evidenz/1B/2026-11-13-lauf.md](./evidenz/1B/2026-11-13-lauf.md)                                 | Gewerteter Lauf 1B (n = 10): Zeitzerlegung je Auftrag, H_B1–H_B3, Befunde, zwei offengelegte Abweichungen; Nachtrag M1–M4 (Belege, C0 nach M2, B0, kalt n = 5)                                                                        |
| [1B-eigenanteil.md](./1B-eigenanteil.md)                                                         | Eigenanteil und KI-Offenlegung 1B (Schritte 1–2 Jonas, 3–4 Niklas)                                                                                                                                                                    |
| [1B-praesentation-geruest.md](./1B-praesentation-geruest.md)                                     | Gerüst für Folien, Handout und Diskussion zu 1B Schritte 1–2                                                                                                                                                                          |
| [evidenz/1B/2026-11-12-aufbau.md](./evidenz/1B/2026-11-12-aufbau.md)                             | Aufbauprotokoll 1B: Zwei-Host-Labor, Abgleich mit ADR-0035 und Runbook, Befunde für C                                                                                                                                                 |
| [evidenz/1B/2026-11-13-windows-test.md](./evidenz/1B/2026-11-13-windows-test.md)                 | Windows-Test von `labor.ps1` in einer KVM-VM (Versuche 1–5)                                                                                                                                                                           |
| [evidenz/1B/issue-zeiten-im-log-entwurf.md](./evidenz/1B/issue-zeiten-im-log-entwurf.md)         | Issue-Entwurf, angelegt als #19: Laufzeit und Runtime-`timings` im Summary-Log (Befund C)                                                                                                                                             |
| [evidenz/1B/issue-qualitaetstor-log-entwurf.md](./evidenz/1B/issue-qualitaetstor-log-entwurf.md) | Issue-Entwurf, angelegt als #20: Grund eines Fallbacks mit `invalid_response` protokollieren                                                                                                                                          |
| [evidenz/1B/issue-runbook-omit-dev-entwurf.md](./evidenz/1B/issue-runbook-omit-dev-entwurf.md)   | Issue-Entwurf, angelegt als #21: Runbook §6 `npm ci --omit=dev` bricht den Compose-Wrapper                                                                                                                                            |
| [evidenz/1B/issue-dritthost-test-entwurf.md](./evidenz/1B/issue-dritthost-test-entwurf.md)       | Issue-Entwurf, angelegt als #22: Befehl für den Dritthost-Negativtest in Runbook §11                                                                                                                                                  |
| [evidenz/1B/vm/WINDOWS.md](./evidenz/1B/vm/WINDOWS.md)                                           | Anleitung unter Windows ohne WSL (auch mit Codex in WSL): Vorbereitung, Aufbau, Parameter, Grenzen                                                                                                                                    |
| [evidenz/1B/messung/qualitaetstor.mjs](./evidenz/1B/messung/qualitaetstor.mjs)                   | Prüft die Modellantworten eines Laufs mit dem Qualitätstor der App (Beleg im Laufprotokoll, Ergänzung 2026-11-14)                                                                                                                     |
| [adr/1B-012-windows-aufbau-ohne-wsl.md](./adr/1B-012-windows-aufbau-ohne-wsl.md)                 | Entscheidung: Windows-Aufbau ohne WSL, nur mit Windows-Bordmitteln                                                                                                                                                                    |
| [AGENTS.md](./AGENTS.md), [CLAUDE.md](./CLAUDE.md)                                               | Anweisungen für KI-Agenten in diesem Ordner (Karte, „Ein Fakt, ein Ort“, Regeln); `CLAUDE.md` bindet nur `AGENTS.md` ein                                                                                                              |
| [final-prompt-for-git-diff.md](./final-prompt-for-git-diff.md)                                   | von Niklas: Prompt, mit dem nach dem Merge der eigene Beitrag dokumentiert wird                                                                                                                                                       |
| [1C-kontext-und-adapterpfad.md](./1C-kontext-und-adapterpfad.md)                                 | Überholter Recherche-Stand (`27966e75`): #456-Kontext, Verträge, Snapshot/Hash, Async-Pfad, Testlücken für 1C; maßgeblich sind [1C-ergebnis.md](./1C-ergebnis.md), die [ADRs](./adr/README.md) und [1C-diagrams.md](./1C-diagrams.md) |
| [1A-experiment-contract.md](./1A-experiment-contract.md)                                         | Vorab festgelegte A1-Hypothesen, Lastprofil, Varianten, Grenzwerte und Nachweisanforderungen                                                                                                                                          |
| [1A-fixture.md](./1A-fixture.md)                                                                 | Gemeinsame deterministische Fixture mit Referenz- und Gegenfällen, A1-Projektion und Hashprüfung                                                                                                                                      |
| [1A-live-messungen.md](./1A-live-messungen.md)                                                   | Artillery-Messfelder, Fehlerzählung, Gates, Lastprofil und lokale Prüfung für Schritt 3                                                                                                                                               |
| [1A-analyse-last.md](./1A-analyse-last.md)                                                       | Hostautorisierte Analyse-Last mit festem Korpus, Zeitplan, Ergebniszählung und lokaler Prüfung                                                                                                                                        |
| [1A-container-metriken-und-proxy.md](./1A-container-metriken-und-proxy.md)                       | Lesende Container-Erfassung, cgroup-Auswertung und kontrollierter Unix-Socket-Verzögerungsproxy                                                                                                                                       |
| [1A-versuchsreihe.md](./1A-versuchsreihe.md)                                                     | Isolierter Laboraufbau, randomisierte V0–V4-Blöcke, Vorlauf, Messung und geprüfter Rollback                                                                                                                                           |
| [1A-auswertung.md](./1A-auswertung.md)                                                           | Gepaarte Auswertung, nicht bestätigte Hypothesen, Ressourcenbudget und Betriebsentscheidung                                                                                                                                           |
| [1A-komplette-Aufgabe-fertig.md](./1A-komplette-Aufgabe-fertig.md)                               | Übersicht aller sieben Schritte mit Dateien, Befehlen und aktuellem Abschlussstand                                                                                                                                                    |
| [1A-eigenanteil.md](./1A-eigenanteil.md)                                                         | Anforderungsabgleich, Git-Prüfgrundlage und transparente Abgrenzung agentengestützter Beiträge                                                                                                                                        |
| [1A-abschluss-und-uebergabe.md](./1A-abschluss-und-uebergabe.md)                                 | Persönliche Prüfaufgaben, gemeinsame Artefakte, KI-Aufträge und tatsächlicher Übergabestand                                                                                                                                           |
| [abgabe/README.md](./abgabe/README.md)                                                           | Vierseitiger Handoutentwurf, neun PDF-Folien, Diagramme und reproduzierbarer Dokumentbau                                                                                                                                              |

[A1-Umsetzungsplan](./1A-umsetzungsplan.md), [Ausführungsanleitung](./1A-neue-messreihe.md)
und [aktueller Prüfstand](./1A-pruefstand.md) ergänzen die Dateiübersicht.

**A1, aktueller Stand 15.11.2026:** Die vollständige Messreihe liegt ausschließlich unter
[`evidenz/1A/reihe-main-a19ca70f-20261115-122547/`](./evidenz/1A/reihe-main-a19ca70f-20261115-122547/).
[Evidenzindex](./evidenz/1A/README.md), [Auswertung](./1A-auswertung.md),
[Ausführungsanleitung](./1A-neue-messreihe.md) und [Prüfstand](./1A-pruefstand.md)
sind die aktuellen Einstiegspunkte. Alte A1-Reihen und abgebrochene Anläufe wurden entfernt;
Vertrag und Vorabnachtrag bleiben als hashgebundene Quellen erhalten.
[Abgabeentwürfe](./abgabe/README.md) verwenden die aktuelle Auswertung.
Persönliche Freigabe, gemeinsame Abstimmung und tatsächlicher Merge stehen getrennt in
[Abschluss und Übergabe](./1A-abschluss-und-uebergabe.md).

### Landkarte der 1C-Dateien

Diese Landkarte ist die vollständige Dateiliste zu
1C; andere Dokumente verlinken hierher. `evidenz/` enthält Rohdaten und
Protokolle je Auftrag (ohne Secrets, nur synthetische Daten).

**Hauptdokumente:** [1C-ergebnis.md](./1C-ergebnis.md) (Einstieg),
[1C-eigenanteil.md](./1C-eigenanteil.md),
[adr/README.md](./adr/README.md) (Index, Statuswerte, Vorlage und Nummernplan
der ADRs), [1C-diagrams.md](./1C-diagrams.md),
[1C-praesentation-geruest.md](./1C-praesentation-geruest.md),
[00-rahmen-und-pruefung.md](./00-rahmen-und-pruefung.md),
[01-aufteilung.md](./01-aufteilung.md) und, als überholter Recherche-Stand mit
dem wörtlichen Auftragstext,
[1C-kontext-und-adapterpfad.md](./1C-kontext-und-adapterpfad.md); Zweck je
Datei in der Tabelle oben.

**Designs und Pläne** (`specs/`):

| Datei                                                                        | Inhalt                                                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [2026-10-24-1c-tests-design.md](./specs/2026-10-24-1c-tests-design.md)       | vorab festgelegtes Design Teil 1: Tests T1–T5                                               |
| [2026-10-24-1c-tests-plan.md](./specs/2026-10-24-1c-tests-plan.md)           | Umsetzungsplan Teil 1                                                                       |
| [2026-10-24-1c-teil2-design.md](./specs/2026-10-24-1c-teil2-design.md)       | Design Teil 2: E1–E9, M1–M5, Gegenvariante V1 und Entscheidungsregel                        |
| [2026-10-24-1c-teil2-plan.md](./specs/2026-10-24-1c-teil2-plan.md)           | Umsetzungsplan Teil 2                                                                       |
| [2026-10-24-1c-teil3-design.md](./specs/2026-10-24-1c-teil3-design.md)       | Design Teil 3: E10–E15, M6, M7                                                              |
| [2026-10-24-1c-teil3-plan.md](./specs/2026-10-24-1c-teil3-plan.md)           | Umsetzungsplan Teil 3                                                                       |
| [2026-10-25-1c-labor-design.md](./specs/2026-10-25-1c-labor-design.md)       | Labordesign L1–L5, Nachträge 14 (Zusatzlauf, L6) und 15 (U1)                                |
| [2026-11-05-1c-doku-design.md](./specs/2026-11-05-1c-doku-design.md)         | Design der Abschlussdokumentation                                                           |
| [2026-11-05-1c-doku-plan.md](./specs/2026-11-05-1c-doku-plan.md)             | Plan der Abschlussdokumentation                                                             |
| [2026-11-06-1c-nachlauf-design.md](./specs/2026-11-06-1c-nachlauf-design.md) | Design des Nachlaufs auf upstream `44c0a796`; Nachtrag 7 (2026-11-09): Codestand `def56700` |

**Evidenz** (`evidenz/1C/`):

| Datei                                                                                                                                                                                                                  | Inhalt                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [2026-10-24-tests.md](./evidenz/1C/2026-10-24-tests.md)                                                                                                                                                                | Protokoll Teil 1: Tests T1–T5                                                                                                                           |
| [2026-10-24-teil2.md](./evidenz/1C/2026-10-24-teil2.md)                                                                                                                                                                | Protokoll Teil 2: E1–E9, Messungen M1–M5 und V1, Entscheidungen 1–4                                                                                     |
| [2026-10-24-teil3.md](./evidenz/1C/2026-10-24-teil3.md)                                                                                                                                                                | Protokoll Teil 3: E10–E15, Befund T3.1, Messungen M6, M7, M7b, M7c                                                                                      |
| [e15-widerlegt.patch](./evidenz/1C/e15-widerlegt.patch)                                                                                                                                                                | nicht eingecheckter Test zum widerlegten Fall E15                                                                                                       |
| [issue-t2-3-entwurf.md](./evidenz/1C/issue-t2-3-entwurf.md)                                                                                                                                                            | Issue-Entwurf zu Befund T2.3 (angelegt als [#15](https://github.com/NiklasSkulll/arsnova.eu/issues/15))                                                 |
| [issue-t3-1-entwurf.md](./evidenz/1C/issue-t3-1-entwurf.md)                                                                                                                                                            | Issue-Entwurf zu Befund T3.1 (angelegt als [#18](https://github.com/NiklasSkulll/arsnova.eu/issues/18))                                                 |
| [issue-cache-ram-entwurf.md](./evidenz/1C/issue-cache-ram-entwurf.md)                                                                                                                                                  | Issue-Entwurf zum Prompt-Cache `--cache-ram` (angelegt als [#14](https://github.com/NiklasSkulll/arsnova.eu/issues/14))                                 |
| [2026-11-05-labor.md](./evidenz/1C/2026-11-05-labor.md)                                                                                                                                                                | Protokoll Laborlauf Laptop (L1–L5)                                                                                                                      |
| [2026-11-06-trockenlauf-upstream.md](./evidenz/1C/2026-11-06-trockenlauf-upstream.md)                                                                                                                                  | modellfreier Trockenlauf auf upstream `44c0a796` mit Rohdaten                                                                                           |
| [2026-11-09-labor-nachlauf.md](./evidenz/1C/2026-11-09-labor-nachlauf.md)                                                                                                                                              | Protokoll des 1C-Nachlaufs mit echter Runtime auf upstream `def56700` (N1–N6): Quality-Gate verwirft alle Modellantworten, OOM-Kill im 19. Auftrag      |
| [2026-11-05-labor-pc.md](./evidenz/1C/2026-11-05-labor-pc.md)                                                                                                                                                          | Protokoll Zusatzlauf PC mit Produktionslimits (L1–L6) und Ursachenversuch U1                                                                            |
| [labor-lauf.sh](./evidenz/1C/labor-lauf.sh)                                                                                                                                                                            | Laborskript (Kalibrierung, Lauf, U1)                                                                                                                    |
| [labor-produktionslimits.override.yml](./evidenz/1C/labor-produktionslimits.override.yml)                                                                                                                              | Compose-Überschreibung: Produktionslimits aus `docker-compose.llm.yml` (8 CPUs, 8 GiB, 10 GiB mit Swap, 8 Threads) auf der Laborruntime                 |
| [labor-cache-aus.override.yml](./evidenz/1C/labor-cache-aus.override.yml)                                                                                                                                              | Compose-Überschreibung für U1, Arm „aus“: `LLAMA_ARG_CACHE_RAM=0`                                                                                       |
| [messung/2026-11-05-labor.json.gz](./evidenz/1C/messung/2026-11-05-labor.json.gz)                                                                                                                                      | Rohdaten Laborlauf Laptop                                                                                                                               |
| [messung/2026-11-05-labor-pc.json.gz](./evidenz/1C/messung/2026-11-05-labor-pc.json.gz)                                                                                                                                | Rohdaten Zusatzlauf PC                                                                                                                                  |
| [messung/2026-11-05-speicher-pc.csv](./evidenz/1C/messung/2026-11-05-speicher-pc.csv)                                                                                                                                  | Speicherverlauf der Runtime im PC-Lauf (L6), 15-s-Takt                                                                                                  |
| [messung/2026-11-05-cacheversuch-standard-pc.csv](./evidenz/1C/messung/2026-11-05-cacheversuch-standard-pc.csv), [messung/2026-11-05-cacheversuch-aus-pc.csv](./evidenz/1C/messung/2026-11-05-cacheversuch-aus-pc.csv) | U1, Arme „standard“ und „aus“                                                                                                                           |
| [labor-runbook.md](./evidenz/1C/labor-runbook.md)                                                                                                                                                                      | Runbook der Laborläufe gegen die private Runtime nach [specs/2026-10-25-1c-labor-design.md](./specs/2026-10-25-1c-labor-design.md) (Läufe durchgeführt) |
| [messung/auswertung.mjs](./evidenz/1C/messung/auswertung.mjs)                                                                                                                                                          | Auswertungsskript aller Messdateien                                                                                                                     |
| [messung/2026-10-24-messung.json.gz](./evidenz/1C/messung/2026-10-24-messung.json.gz)                                                                                                                                  | Rohdaten Teil 2, Primärlauf                                                                                                                             |
| [messung/2026-10-24-messung-robustheit.json.gz](./evidenz/1C/messung/2026-10-24-messung-robustheit.json.gz)                                                                                                            | Rohdaten Teil 2, Robustheitslauf                                                                                                                        |
| [messung/2026-10-24-messung-teil3.json.gz](./evidenz/1C/messung/2026-10-24-messung-teil3.json.gz)                                                                                                                      | Rohdaten Teil 3, M6 und M7                                                                                                                              |
| [messung/2026-10-24-messung-teil3-m7b.json.gz](./evidenz/1C/messung/2026-10-24-messung-teil3-m7b.json.gz)                                                                                                              | Rohdaten Teil 3, M7b (nicht unabhängig von M7, siehe Protokoll)                                                                                         |
| [messung/2026-10-24-messung-teil3-m7c.json.gz](./evidenz/1C/messung/2026-10-24-messung-teil3-m7c.json.gz)                                                                                                              | Rohdaten Teil 3, M7c (unabhängige Seeds)                                                                                                                |
| [messung/2026-10-25-probelauf-1.json.gz](./evidenz/1C/messung/2026-10-25-probelauf-1.json.gz) und [-2](./evidenz/1C/messung/2026-10-25-probelauf-2.json.gz)                                                            | Probeläufe vor M6/M7, nur zur Prüfung des Messcodes, nicht ausgewertet                                                                                  |
| [messung/2026-11-06-trockenlauf-upstream.json.gz](./evidenz/1C/messung/2026-11-06-trockenlauf-upstream.json.gz)                                                                                                        | Rohdaten des Trockenlaufs auf upstream `44c0a796` (Test-Runtime)                                                                                        |
| [messung/2026-11-09-labor-nachlauf.json.gz](./evidenz/1C/messung/2026-11-09-labor-nachlauf.json.gz), [messung/2026-11-09-speicher-nachlauf.csv](./evidenz/1C/messung/2026-11-09-speicher-nachlauf.csv)                 | Rohdaten des Nachlaufs auf upstream `def56700` (JSON) und Speicherprotokoll der Runtime (CSV)                                                           |

**Diagramme** (`diagrams/`; je Quelle `.mmd` mit gerenderter `.light.svg` und `.dark.svg`):

| Datei                                                                                              | Inhalt                                          |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [1c-context-path-overview.mmd](./diagrams/1c-context-path-overview.mmd)                            | Abb. 1, Struktur vereinfacht (Handout, Folie)   |
| [1c-context-path-overview-sequence.mmd](./diagrams/1c-context-path-overview-sequence.mmd)          | Abb. 2, Zeitablauf vereinfacht (Handout, Folie) |
| [1c-legende.mmd](./diagrams/1c-legende.mmd)                                                        | Legende zu Abb. 1 (Handout)                     |
| [1c-context-path-map.mmd](./diagrams/1c-context-path-map.mmd)                                      | A1, Arbeitskarte Struktur (Anhang)              |
| [1c-context-path-sequence.mmd](./diagrams/1c-context-path-sequence.mmd)                            | A2, Arbeitskarte Zeitablauf (Anhang)            |
| [1c-contract-layers.mmd](./diagrams/1c-contract-layers.mmd)                                        | A3, Vertragsschichten (Anhang)                  |
| [1c-legende-anhang.mmd](./diagrams/1c-legende-anhang.mmd)                                          | Legende zu A1 und A3 (Anhang)                   |
| [palette.light.mmd](./diagrams/palette.light.mmd), [palette.dark.mmd](./diagrams/palette.dark.mmd) | Farbklassen der Flussdiagramme                  |
| [theme.light.json](./diagrams/theme.light.json), [theme.dark.json](./diagrams/theme.dark.json)     | Schriften und Grundfarben für mermaid-cli       |
| [render.sh](./diagrams/render.sh)                                                                  | rendert die SVGs                                |
| [diagrams/README.md](./diagrams/README.md)                                                         | Regeln für Quellen, Klassen und Rendering       |

**Außerhalb des Ordners:** Testcode und Testhelfer unter `apps/backend/src`
und `libs/shared-types/src` (darunter die Test-Runtime
[`open-weight-test-runtime.ts`](../../apps/backend/src/__tests__/lib/open-weight-test-runtime.ts),
die Fixture
[`qa-summary-pg-fixture.ts`](../../apps/backend/src/__tests__/lib/qa-summary-pg-fixture.ts),
der Proxy [`recording-proxy.ts`](../../apps/backend/src/__tests__/lib/recording-proxy.ts)
und die Labor-Harness
[`qa.summary-labor.pg.test.ts`](../../apps/backend/src/__tests__/qa.summary-labor.pg.test.ts)),
die Aufnahme der Suiten in `.github/workflows/ci.yml` und
[`docs/TESTING.md`](../TESTING.md); vollständige Liste mit
`git diff --name-only main..HEAD`
([ADR 1C-004](./adr/1C-004-empfehlung-statt-patch.md#belege),
[ADR 1C-003](./adr/1C-003-teststrategie-modellfrei.md)).

## Arbeitsweise im Fork

Wegen des knappen Zeitrahmens gilt:

- **Kein `dev`-Branch:** Entwickelt wird in `feature-<featurename>`-Branches,
  die direkt in `main` gemergt werden.
- **Kein Branch-Schutz auf `main`:** So lässt sich auch vor Abschluss aller
  Checks schnell mergen. Die CI läuft trotzdem auf jeder PR. Vor der PR an
  kqc-real muss sie vollständig grün sein.
- **PR an kqc-real:** Dafür einen Branch von `upstream/main` abzweigen, nicht
  vom Fork-`main`. Sonst landet dieser Ordner mit in der PR.

## Was recherchiert wurde

Stand der Recherche: 2026-10-16. Spätere Ergebnisse stehen in `evidenz/`.

- **Rahmen:**
  - Bewertung: 30 % Handout, 30 % Vortrag, 40 % Diskussion. Jede Person wird
    einzeln bewertet.
  - Pflicht-Nachweiskette: Commit/Manifest → Baseline → Störung → Messung →
    Befund mit Gültigkeitsgrenze → Entscheidung.
  - KI-Regeln.
  - Widersprüche zwischen den Kursfolien und der Repo-Fassung.
- **1A, Ressourcen auf dem App-Host:**
  - Nur die Sidecars haben Limits. App, Postgres und Redis haben keine.
  - spaCy bearbeitet immer nur eine Anfrage gleichzeitig.
  - Die ursprünglichen Lastskripte belasteten spaCy nicht. Die A1-Werkzeuge
    ergänzen dafür hostautorisierte Analyseanfragen und Ressourcenmessungen.
- **1B, zweiter Host für die private Inferenz:**
  - Wie das Zwei-Host-Deployment und der LLM-Client aufgebaut sind.
  - Gemessen wird bisher nur die Gesamtzeit. Die Detailzeiten von llama.cpp
    werden zwar ausgelesen, aber nicht verwendet.
  - Es gab keinen Fake-Server für Tests. _Aktualisiert 2026-11-12:_ Inzwischen
    gibt es für 1C die Test-Runtime
    [`open-weight-test-runtime.ts`](../../apps/backend/src/__tests__/lib/open-weight-test-runtime.ts):
    ein In-Prozess-Helfer für Vitest auf `127.0.0.1`, kein eigenständiger
    Fake-Server für einen zweiten Host
    ([Aufteilung](./01-aufteilung.md#gemeinsame-artefakte-gleichmäßig-verteilen-und-kennzeichnen)).
- **1C, Kontextpfad bis zur Inferenz:**
  - Snapshot und Hash. Vermutung damals: Jede Stimme ändert den Hash; inzwischen
    durch Tests belegt und eingegrenzt ([evidenz/1C](./evidenz/1C/)).
  - Der Async-Pfad.
  - Testlücken: Quelle mitten im Job gelöscht, langsamer Empfänger, volle
    Queue. _Korrigiert 2026-11-12:_ Inzwischen abgedeckt durch E8
    (Quellenlöschung) und E6b (langsamer Empfänger) in Teil 2 sowie E11
    (volle Queue) in Teil 3.

Die historischen Dossiers zu 1B/1C enthalten Code-Stellen, Versuchsideen und Lücken.
Das A1-Dokument verweist auf die aktuelle vollständige Ausarbeitung.

## Qualitätsanspruch an PRs

- Die CI von kqc-real läuft auch in Niklas' Fork. Am 2026-10-16 wurde sie dort
  vollständig grün geprüft. Jede PR muss dort grün durchlaufen, bevor sie an
  kqc-real geht.
- Codex-Reviews sollen ebenfalls clean sein. **Noch offen:** Die Einrichtung
  muss Niklas als Repo-Owner machen (ChatGPT Codex Connector, dann
  `chatgpt.com/settings/code-review`).

## Offene Punkte

> **Aktualisiert 2026-11-05:** Die Baseline-Frage und die Laborinstanz sind
> geklärt ([Rahmendokument](./00-rahmen-und-pruefung.md#offene-fragen-an-den-prüfer)),
> die Laborläufe sind durchgeführt. Der aktuelle Stand der offenen Punkte zu 1C
> steht im [Ergebnisbericht, Abschnitt 9](./1C-ergebnis.md#9-offene-punkte-und-fragen-an-den-prüfer). Die beiden Fragen
> unten bleiben als ursprünglicher Stand stehen.

- Fragen an den Prüfer klären (siehe
  [00-rahmen-und-pruefung.md](./00-rahmen-und-pruefung.md#klärungsstand-der-fragen-an-den-prüfer)),
  vor allem diese:
  - Für 1A geklärt: aktueller `main` als Baseline und eigener Rechner als Labor
    gemäß [Issue #6, Stand 2026-11-10](https://github.com/NiklasSkulll/arsnova.eu/issues/6).
  - Für 1B offen: Wie wird der zweite Host auf eigener Hardware reproduziert
    (siehe [Issue #8](https://github.com/NiklasSkulll/arsnova.eu/issues/8))?
- **Aufteilung 1A/1B/1C:** Am 2026-10-23 festgelegt (Option 1). Niklas ist X
  (1A und 1B Schritte 3–4), Jonas ist Y (1C und 1B Schritte 1–2). Eine
  Abstimmung mit dem Prüfer ist nicht nötig (mündliche Ansage in der
  Vorlesung, notiert 2026-10-24). Details in
  [01-aufteilung.md](./01-aufteilung.md#entscheidung-2026-10-23).

## Hinweis zur Entstehung

Die Dossiers 1A–1C wurden am 2026-10-16 agentengestützt erstellt (Claude Code,
Modell Claude Opus 5.5, mit Serena und codebase-memory-mcp auf Commit
`27966e75`). Zeilenangaben beziehen sich auf diesen Stand und müssen vor der
Übernahme ins Handout gegen die festgelegte Baseline geprüft werden.
