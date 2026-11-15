# 1B: Eigenanteil und KI-Offenlegung

- **Datum:** 2026-11-13 (Entwurf, _aktualisiert 2026-11-13 abends und 2026-11-14 nach dem Docs-Audit_)
- **Autor:** Jonas Weirauch (Rolle Y), Schritte 1–2
- **Zweck:** Wer hat in Auftrag 1B was getan, welche Rolle hatte die KI, und was hat der Autor entschieden oder geprüft? Zentrale Aufträge an die KI stehen sinngemäß, nicht als Chat-Auszug.

## Schritte 1–2: Jonas Weirauch (Rolle Y)

### Lesehilfe

- **KI** ist durchgängig Claude Code (Anthropic) mit Serena und codebase-memory-mcp, Modell Claude Opus 5.5; Teilaufgaben liefen in Subagenten (Opus, ein Entwurf mit Sonnet).
- **Reviews** waren KI-Sitzungen, keine unabhängigen menschlichen Gutachten.
- Ein Commit von Jonas Weirauch sagt nichts darüber, ob der Inhalt von der KI stammt; das steht in den Tabellen unten.

### Commits

Stand nach der Prüfung der Nachträge (2026-11-14, einschließlich des Commits, der diese Zahlen einträgt): 130 Commits auf `feature-1B-two-host` gegenüber `a19ca70f` (Fork-`main`, Baseline nach [ADR 1B-001](adr/1B-001-baseline-fork-main-a19ca70f.md)), alle von Jonas Weirauch, keine Merges; 38 vom 2026-11-12, 80 vom 2026-11-13, 12 vom 2026-11-14. Nach Typ: 60 `docs`, 37 `fix`, 19 `feat`, 14 `test`; der Typ sagt nichts über den Anteil der KI. Gezählt mit `git rev-list --count a19ca70f..HEAD` und `git log --format=%s a19ca70f..HEAD`. Außerhalb von `docs/referat-thema-1/` ändert der Branch nichts (`git diff --stat a19ca70f HEAD -- . ':!docs/referat-thema-1'` ist leer), also auch keinen Produktionscode.

### Gemeinsame Artefakte

Laborinstanz und Inferenz-Host liegen nach der [Aufteilung](01-aufteilung.md#gemeinsame-artefakte-gleichmäßig-verteilen-und-kennzeichnen) bei Jonas. Niklas nutzt für die Schritte 3–4 die Dateien (Skripte, Runbook), nicht die Geräte ([ADR 1B-009](adr/1B-009-portabilitaet-linux-windows.md)); die Zeitbegriffe gelten für beide ([ADR 1B-011](adr/1B-011-zeitbegriffe-und-leitfrage.md)). Aus 1C übernommen, nicht als neue Leistung gezählt: das Szenario der Referenzfixture (`apps/backend/src/__tests__/lib/qa-summary-pg-fixture.ts`), das der Treiber nachstellt ([`treiber.mjs`](evidenz/1B/treiber.mjs) Z. 7). Upstream-Code (kqc-real), Release 1.3 mit Runbook und ADR-0035 sind Untersuchungsgegenstand, nicht Eigenleistung.

### Was der Autor entschieden hat

| Entscheidung                                                                                                                                                                                                                                                                             | Beleg                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auftrag: Summary V2 mit der 1C-Referenzfixture, ausgelöst über die echte App per tRPC                                                                                                                                                                                                    | [Design Abschnitt 4](specs/2026-11-12-1b-zwei-host-design.md#4-der-auftrag-autor)                                                                 |
| Kernaussagen B und C, Gültigkeitsgrenze D; Timeout-Regel nach Kalibrierung                                                                                                                                                                                                               | [Design Abschnitte 6 und 7](specs/2026-11-12-1b-zwei-host-design.md#6-hypothesen-messgrößen-regeln-autor-aussagen-b-und-c-schwellen-ki-vorschlag) |
| Aufbau voll automatisiert, unter Linux und Windows gleich, mit Größenempfehlung aus Kernen und RAM                                                                                                                                                                                       | [Plan, Nachtrag Task 12](specs/2026-11-12-1b-zwei-host-plan.md), [ADR 1B-010](adr/1B-010-aufbau-automatisiert-mit-groessenempfehlung.md)          |
| Laptop im Energiesparprofil für Aufbau und Entwicklung, Performance nur für Kalibrierung und gewerteten Lauf                                                                                                                                                                             | [Runbook, Abschnitt 4](evidenz/1B/runbook.md#4-energieprofil)                                                                                     |
| Reihenfolge in der Nacht 2026-11-13: erst Linux-Labor und gewerteter Lauf, Windows-Volltest danach                                                                                                                                                                                       | Absprache mit der KI, [Windows-Test](evidenz/1B/2026-11-13-windows-test.md)                                                                       |
| Gewerteten Lauf wiederholen, nachdem Hintergrund-Updates Versuch 2 gestört hatten                                                                                                                                                                                                        | [Laufprotokoll, Ablauf](evidenz/1B/2026-11-13-lauf.md#ablauf-und-abweichungen)                                                                    |
| Lücken aus der Vollständigkeitsprüfung schließen: „Doku + neue Messungen“ (M1–M4), S1 begründet weglassen                                                                                                                                                                                | [Design, Nachtrag 2026-11-13](specs/2026-11-12-1b-zwei-host-design.md#nachtrag-2026-11-13-ergänzende-messungen-nach-der-vollständigkeitsprüfung)  |
| Hypothesen und Schwellen von M1–M4 vor den Läufen unverändert freigegeben (2026-11-13)                                                                                                                                                                                                   | ebenda                                                                                                                                            |
| Windows-Weg ohne WSL für Niklas, mit Vorprüfung, RAM-Schutz und Fortschritt; Niklas arbeitet mit Codex in WSL                                                                                                                                                                            | [ADR 1B-012](adr/1B-012-windows-aufbau-ohne-wsl.md), [WINDOWS.md](evidenz/1B/vm/WINDOWS.md)                                                       |
| Windows-Test-VM nach der letzten Regression löschen; Branch nur pushen, nicht mergen                                                                                                                                                                                                     | [Windows-Test, Versuch 5](evidenz/1B/2026-11-13-windows-test.md); „nur pushen“ mündlich an die KI                                                 |
| Prüfschleifen für die Diagramme: je ein neuer fachlicher, danach ein neuer visueller Prüfer, bis nur Banales bleibt                                                                                                                                                                      | [1B-Diagramme](1B-diagrams.md)                                                                                                                    |
| Docs-Audit 2026-11-14 (Scope 1B und diese Branch): Korrekturen im eingefrorenen Aufbauprotokoll als datierte Hinweise; Beleg des Qualitätstors mit Skript; Windows-Weg als ADR 1B-012; WINDOWS.md als Windows-Anleitung; Testfall 4/4/16; Korrektur von Issue #20; Gerüst bleibt Entwurf | Antworten des Autors im Audit, umgesetzt in den genannten Dateien                                                                                 |

Hypothesenschwellen, Messmethode per Mitschnitt und Zeitzerlegung sind KI-Vorschläge, die der Autor mit dem Design freigegeben hat (im Design als „KI-Vorschlag“ markiert).

### Was die KI gemacht hat

- Skripte für Aufbau, Prüfung und Lauf (`labor.sh`, `labor.ps1`, `vm/`, `llm-start.sh`, `app-start.sh`, `pruefen.sh`, `lauf.sh`, `treiber.mjs`), Auswertung mit Tests (`messung/`), Windows-Testaufbau (`vm/windows-test/`).
- Protokolle, Runbook, Diagramme und dieser Entwurf nach den Vorgaben des Autors.
- Lauf am 2026-11-13: Fehlersuche und Fixes nach den Versuchen 1 (Host-Token) und 2 (Hintergrund-Updates), Analyse der verworfenen Modellantworten aus dem Mitschnitt, Laufprotokoll.
- Nachtrag M1–M4 am Abend des 2026-11-13: Labor von null neu aufgebaut, Messkette, Auswertung und Nachtrag im Laufprotokoll.
- Issue-Entwürfe und die Issues #19–#22 im Fork (nach Freigabe des Autors), Präsentationsgerüst.
- Reviews: zwei Reviews der ganzen Branch (vier bzw. fünf behobene wichtige Punkte), fünf fachliche und sechs visuelle Prüfrunden der Diagramme; am 2026-11-14 ein Docs-Audit in sechs Bereichen mit Subagenten, dessen schwerste Befunde die KI selbst gegengeprüft hat.
- Entscheidungen, die die KI in der Nacht 2026-11-13 im Auftrag des Autors getroffen hat (Arbeitsprotokoll der KI, nicht im Repo), u. a.: Hypothesen gelten als „nicht bewertbar“, wenn einem Auftrag eine Komponente fehlt; Topologie hochkant. _Aktualisiert 2026-11-13:_ vom Autor bestätigt, ebenso der getrennte Bericht von Kalt- und Warmfall (Option a).

### Zentrale Aufträge an die KI (sinngemäß)

- **Aufbau:** das Zwei-Host-Deployment von Release 1.3 auf dem eigenen Rechner nachbauen, voll automatisiert, unter Linux und Windows gleich, mit Größenempfehlung, klarer Fortschrittsanzeige, Restzeit und verständlichen Fehlermeldungen; Rechner, Hypervisor und VMs in jedem Ergebnis festhalten.
- **Für Niklas:** so robust und einfach wie möglich, wenig Platz auf `C:`, RAM-Lage des Rechners berücksichtigen, Steuerung durch einen Agenten (Codex) aus WSL.
- **Messung:** einen echten Summary-Auftrag über die App laufen lassen, Netz, Adapter und Inferenz getrennt, ohne Produktionscode; Hypothesen und Schwellen vor jedem Lauf festlegen.
- **Prüfung:** die Arbeit gegen Issue #8 und das Dossier auf Vollständigkeit prüfen lassen und die Lücken schließen; Serena und codebase-memory aktiv nutzen.

### Prüfung durch den Autor

Am 2026-11-13 hat der Autor die Ergebnisse der Schritte 1–2 geprüft (Ergebnisbericht und Protokolle einschließlich des Nachtrags M1–M4); Einwände hatte er keine. Vermerkt ist das in der Kopfzeile jedes Protokolls. _Korrigiert 2026-11-14:_ Danach kamen in den Protokollen noch datierte Ergänzungen und Leerraum-Korrekturen in zwei Belegdateien hinzu (`e2e9c701`, Branch-Review) sowie die datierten Hinweise aus dem Docs-Audit vom 2026-11-14 (im Aufbauprotokoll nach dem Einfrieren, mit Zustimmung des Autors). Am 2026-11-14 hat der Autor diese Nachträge und das [Präsentationsgerüst](1B-praesentation-geruest.md) geprüft, ohne Einwände; vermerkt in den Kopfzeilen.

### Was dieses Dokument nicht aussagt

- Es misst keinen Anteil in Prozent; es zeigt, wer welche Rolle hatte.
- Es bewertet nicht, was als eigene Leistung zählt; das bleibt Autor und Prüfer.
- Die Modellangabe „Claude Opus 5.5“ ist nicht unabhängig geprüft.

## Schritte 3–4: Niklas

_Folgt von Niklas._
