<!-- markdownlint-disable MD013 MD060 -->

# Dozenten-Quickstart: Cloud Computing

**Kurs:** IU Cloud Computing, gemischte Kohorte Informatik/Wirtschaftsinformatik · **Zeitbedarf:** 10 Minuten für Orientierung, etwa 30 Minuten für die Semesterentscheidung · **Stand:** 2026-07-29

## In 10 Minuten

1. Lies die [Kurslandkarte](./CLOUD-COMPUTING-KURSREADME.md), besonders die Evidenzmatrix.
2. Lies die [IU-Formalia](./CLOUD-COMPUTING-IU-FORMALIA.md): `DSCC0127`, 5 CP, 150 h, Deutsch und Prüfungsform.
3. Richte Agenten, Zielserver, Rechte, Budgets und Evidenz nach dem [Agentic-Lehrlabor](./CLOUD-COMPUTING-AGENTIC-LEHRLABOR.md) ein.
4. Übernimm Dauer, Bestandteile, Fristen und Bewertung aus der [Referatsumsetzung](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md).
5. Prüfe das [Lehrkonzept](./BACHELOR-VORLESUNG-CLOUD-COMPUTING-36-UE-PRAKTIKUM.md).
6. Nutze die [12 Terminpläne](./vorlesungen-cloud-computing-termine.md) einschließlich der Themen und Keywords für jeweils 30 MC-Test-Fragen.
7. Übertrage die Aktivitäten mit dem [Präsenz-/Zoom-Konzept](./CLOUD-COMPUTING-DURCHFUEHRUNG-PRAESENZ-ZOOM.md) auf den jeweiligen Kurslauf.
8. Bestätige vor Veröffentlichung der Prüfung in myCampus, ob Referat oder abweichend Workbook und welcher Agenteneinsatz zulässig ist.

## Zwölf Entscheidungen vor Semesterstart

| Frage             | Empfohlener Startpunkt                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| Zeitraster        | 12 Termine × 3 UE: sechs Präsenz/synchron, sechs Tutorium                                         |
| Kursmodus         | gleicher fachlicher Plan; Tisch-/Raumform in Präsenz, Breakout-/Dokumentform in Zoom              |
| Selbststudium     | 123 h für Lektüre, Agentic-Dossier, Plattform-/Wirtschaftsvergleich und Referatsvorbereitung      |
| Fallauftrag       | Formatives Agentic Cloud Engineering Dossier für `arsnova.eu`, keine zusätzliche Prüfungsleistung |
| Arbeitsmodell     | ausschließlich werkzeugnutzende KI-Agenten auf Lehrenden- und Studierendenseite                   |
| Agentenplattform  | institutionell freigegebenes Modell, Werkzeugprofil, Datenschutz, Version und Ersatzkonfiguration |
| Pflichtabdeckung  | Grundlagen, Technologie, Serverless, GCP/AWS/Azure und Datenwissenschaft/ML sichtbar zuordnen     |
| Leistungsnachweis | Referat, 15 Minuten je Prüfling; Einreichung 30 %, Vortrag 30 %, Diskussion 40 %                  |
| Referatsformat    | Einzel/Gruppe und Präsentation mit Handout/Poster aus Prüfungsauftrag oder myCampus übernehmen    |
| Labortiefe        | isolierte Zielserver agentisch installieren, härten, prüfen und zurückbauen; Produktion gesperrt  |
| Kohortenrollen    | Informatik/Wirtschaftsinformatik mischen; Technik, Privacy, Performance und FinOps koppeln        |
| Selbstüberprüfung | nach jedem Termin 30 agentisch erzeugte MC-Test-Fragen aus den festgelegten Themen und Keywords   |

## Formaler Kern auf einen Blick

- Modul `DSCC0127`, Kurs `DSCC012701`, integrierte Vorlesung im dualen Studium
- 5 CP und 150 Stunden: 123 h Selbststudium, 13,5 h Präsenz/synchron, 13,5 h Tutorium
- 2,16 SWS, Deutsch, keine Zugangsvoraussetzungen, kein Online-Test als Prüfungszulassung
- Referat: 15 Minuten mündliche Prüfung je Prüfling, auch bei Gruppenarbeit individuell bewertet
- drei Leistungsbeiträge: Einreichung 30 %, Vortrag 30 %, Befragung/Diskussion 40 %
- Mindestbearbeitungszeit vier Wochen; PDFs zum gemeinsamen Termin ausschließlich per E-Mail an die prüfende Person
- allgemeine Workbook-Leitfäden: nur relevant, wenn myCampus Workbook für diesen Kurslauf ausweist
- Präsenz und Zoom: gleiche Ziele, Zeiten, Materialien, Lernprodukte und Prüfungsinformation; unterschiedliche Methoden und Fallbacks
- virtuelle Prüfung: einmaliger Raumscan, Identifikation sowie durchgehende Bild- und Tonübertragung; keine Übertragung dieser Kamerapflicht auf den normalen Unterricht
- agent-first: Agenten führen Labor-, Analyse- und Bewertungsaufträge aus; Menschen setzen Grenzen, genehmigen Risiko/Kosten, verifizieren und verantworten
- Serverlabor: reproduzierbare Bereitstellung und Härtung, Security, Datenschutz, Performance, Recovery und Cleanup auf isolierten Zielservern
- Wirtschaftsinformatik: TCO, Unit Economics, Sensitivität, Build/Buy, Risiko und Exit aus derselben technischen Evidenz
- MC-Test: nach jedem Termin 30 agentisch erzeugte, lehrendengeprüfte Fragen zur freiwilligen Selbstüberprüfung; in Präsenz und Zoom identisch

## Was Lehrende fachlich nicht verkürzen dürfen

- Der heutige Produktionspfad ist ein **Single-Host-Compose-Deployment**, keine elastische Multi-Instanz-Plattform.
- Der Produktionslauf mit 500 Clients belegt **Joins**, nicht den vollständigen Live-Betrieb; `p95 = 3,57 s` lag über dem damaligen 3-Sekunden-Ziel.
- Umfangreichere 500er-Läufe sind **lokal** freigegeben. Die formale §6.5-Zielhost-Abnahme ist offen.
- `100 × 50` und `1 × 5.000` sind Fallstudienprofile, keine Produktzusage und keine Beschaffungsgrundlage.
- Mehr App-Server lösen die heutige Architektur nicht allein: prozesslokale Session-Signale sowie Yjs-/PDF-Grenzen müssen vor horizontaler Skalierung instanzübergreifend entworfen werden.

## Pflichtlektüre nach Kursphase

| Phase                  | Lektüre                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Einstieg               | [IU-Formalia](./CLOUD-COMPUTING-IU-FORMALIA.md), [Agentic-Lehrlabor](./CLOUD-COMPUTING-AGENTIC-LEHRLABOR.md), [Referatsprüfung](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md), [Root-README](../../README.md), [Architektur-Handbuch](../architecture/handbook.md), [Produktions-Compose](../../docker-compose.prod.yml) |
| Ist-Betrieb            | [Deployment](../deployment-debian-root-server.md), [Environment](../ENVIRONMENT.md), [Backup-/Restore-Runbook](../operations/BACKUP-RESTORE-RUNBOOK.md)                                                                                                                                                           |
| Evidenz                | [Produktions-Join 500](../implementation/LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md), [lokale Baseline](../implementation/LOCAL-BASELINE-FREIGABE-2026-07-12.md), [§6.5-Abnahme](../implementation/S6.5-SECURITY-LOAD-ACCEPTANCE.md)                                                                            |
| Betrieb und Sicherheit | [Monitoring-Runbook](../operations/MONITORING-RUNBOOK.md), [Security Overview](../SECURITY-OVERVIEW.md), [W3.7-Abnahme](../implementation/W3.7-MONITORING-ALARMS-ABNAHME.md)                                                                                                                                      |
| Transformation         | [betriebliche Einordnung](../implementation/CLOUD-COMPUTING-EINORDNUNG-BETRIEBLICH.md), [6R](../implementation/CLOUD-COMPUTING-6R-EINORDNUNG.md), [Provider-Vergleich](../implementation/CLOUD-PROVIDER-VERGLEICH-ARSNOVA-EU.md)                                                                                  |

Providerpreise, SKU-Stücklisten und OpenStack-/Kubernetes-Optionen sind Vertiefung, keine Pflichtlektüre für den Einstieg.

## Vor jedem Termin

- Repo-Anker auf Existenz und Aktualität prüfen.
- Eine Leitfrage, ein prüfbares Lernprodukt und die zugehörigen Lernergebnisse benennen.
- Lehrenden- und Studierendenagent mit identischem fachlichem Ausgangsstand, aber getrennten Rechten konfigurieren.
- Auftrag, erlaubte Werkzeuge, verbotene Bereiche, Budget, Freigabegates, Abbruch und Evidenz festlegen.
- Aussagen mit `Fakt`, `Evidenz`, `Annahme` oder `Entscheidung` markieren lassen.
- isolierten Zielserver, Snapshot/Neuaufbau, kurzlebige Credentials und automatischen Cleanup bereithalten.
- Für den Kursmodus Gruppenbildung, Ergebnissicherung und Technikfallback aus dem Präsenz-/Zoom-Konzept auswählen.
- Volatile Preise oder Providerfunktionen am Tag der Verwendung gegen Primärquellen prüfen.
- Aus den im Terminplan genannten Themen und Keywords 30 MC-Test-Fragen erzeugen und Lösungsschlüssel, Eindeutigkeit, Quellenbezug sowie Importformat prüfen.

## Semesterstart-Checkliste

- [ ] Prüfungsform in myCampus geprüft; Abweichung Referat/Workbook gegebenenfalls schriftlich geklärt
- [ ] Agenteneinsatz und Offenlegung in der formalen Prüfungsabgabe ausdrücklich geklärt
- [ ] Einzel-/Gruppenreferat und Präsentation mit Handout/Poster festgelegt
- [ ] Thema, mindestens vier Wochen Bearbeitungszeit, gemeinsamer PDF-E-Mail-Termin und Prüfungstermine veröffentlicht
- [ ] offizieller Bewertungsbogen mit 30/30/40-Gewichtung und Hilfsmittel übernommen
- [ ] 18 UE Präsenz/synchron und 18 UE Tutorium im Stundenplan ausgewiesen
- [ ] 123 Stunden Selbststudium ohne Doppelzählung geplant
- [ ] fünf offizielle Inhaltsblöcke und Qualifikationsziele vollständig zugeordnet
- [ ] Materialien, digitale Lernprodukte und Prüfungsinformationen in beiden Kursläufen identisch
- [ ] Agenten, Modelle, Werkzeugprofile, Zielserver, Rechte, Budgets und Abnahmetests in beiden Kursläufen identisch
- [ ] Agentenverträge, menschliche Freigabegates, Protokollierung und Cleanup getestet
- [ ] Präsenz: Raum, Projektion, Audio, Strom, Netz und Offline-Fallback geprüft
- [ ] Zoom: Host/Co-Host, Breakouts, Freigabe, schriftliche Aufträge und Verbindungsfallback geprüft
- [ ] Barrierefreiheits-, Kamera-, Aufzeichnungs- und Datenschutzpraxis für beide Modi geklärt
- [ ] virtuelle Referatsprüfung separat vorbereitet: Identifikation, Raumscan, durchgehendes Bild/Ton und Störungsverfahren
- [ ] Repository-Commit oder Stichtag für die Fallstudie festgelegt
- [ ] agentische Serverbereitstellung und Härtung auf rücksetzbarer Nichtproduktionsumgebung getestet
- [ ] Security-, Privacy-, Performance-, Recovery- und FinOps-Agentenaufträge getestet
- [ ] Generator und Freigabeprüfung für 30 MC-Test-Fragen je Termin getestet
- [ ] Modell-/Cloud-Konten, Quotas, Budgets, Datenschutz und Secret-Behandlung geklärt
- [ ] gemischte Informatik-/Wirtschaftsinformatikrollen festgelegt
- [ ] Produktionslasttests und Echtdaten ausdrücklich ausgeschlossen
- [ ] Kurslandkarte und Evidenzstatus aktualisiert

## Abgrenzung

Der FSE-/SQM-/Data-Analytics-Strang beginnt bei [dozenten-quickstart.md](./dozenten-quickstart.md). Die 10-Wochen-SE-Reihe beginnt bei [vorlesungsplan-10-wochen-arsnova-eu.md](./vorlesungsplan-10-wochen-arsnova-eu.md). Beide sind eigenständige Kurse und ersetzen diesen Cloud-Computing-Plan nicht.
