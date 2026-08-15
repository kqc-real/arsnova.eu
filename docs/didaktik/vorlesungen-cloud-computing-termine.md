<!-- markdownlint-disable MD013 MD024 MD060 -->

# Ablaufpläne: Cloud Computing (12 Termine × 3 UE)

**Modul:** `DSCC0127` / `DSCC012701` · **Lehrkonzept:** [36-UE-Konzept](./BACHELOR-VORLESUNG-CLOUD-COMPUTING-36-UE-PRAKTIKUM.md) · **Arbeitsmodell:** [Agentic-Lehrlabor](./CLOUD-COMPUTING-AGENTIC-LEHRLABOR.md) · **Formalia:** [IU-Formalia](./CLOUD-COMPUTING-IU-FORMALIA.md), [Referatsprüfung](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md) · **Modalitäten:** [Präsenz-/Zoom-Konzept](./CLOUD-COMPUTING-DURCHFUEHRUNG-PRAESENZ-ZOOM.md) · **Projektstatus:** [Kurslandkarte](./CLOUD-COMPUTING-KURSREADME.md) · **Stand:** 2026-08-13

Ein Termin umfasst 3 UE beziehungsweise 135 Netto-Minuten. Der Plan bildet die Workload-Vorgabe exakt ab:

| Typ                                      | Termine             |          Summe |
| ---------------------------------------- | ------------------- | -------------: |
| Präsenzstudium/synchrone virtuelle Lehre | 1, 2, 4, 5, 6, 9    | 18 UE = 13,5 h |
| Tutorium/tutorielle Betreuung            | 3, 7, 8, 10, 11, 12 | 18 UE = 13,5 h |

Pausen und institutionelle Zeitfenster sind vor Semesterstart einzurechnen. Die Typzuordnung darf nur geändert werden, wenn die Bilanz 18 UE zu 18 UE erhalten bleibt.

`Präsenz/synchron` bezeichnet die Workload-Kategorie, nicht ausschließlich einen physischen Raum. Dieser Termin findet im Präsenzlauf vor Ort und im Zoom-Lauf synchron online statt. Auch die Tutorien werden im jeweiligen Kursmodus angeboten. Fachlicher Minutenplan, Lernprodukt und Selbststudium bleiben gleich; Sozialform, Medium und Störungsfallback folgen dem [Präsenz-/Zoom-Konzept](./CLOUD-COMPUTING-DURCHFUEHRUNG-PRAESENZ-ZOOM.md).

Alle substanziellen Aktivitäten werden auf Lehrenden- und Studierendenseite mit KI-Agenten ausgeführt. Jeder Termin folgt `Auftrag → Plan → Freigabe → Ausführung → Verifikation → Evidenz → Entscheidung`; reine Chatantworten oder manuell nachgeklickte Cloud-Schritte erfüllen den Arbeitsauftrag nicht. Menschen setzen Grenzen, genehmigen Risiko/Kosten und verantworten das Ergebnis.

Nach **jedem** der zwölf Termine erstellt ein Lehrendenagent genau **30 MC-Test-Fragen** zur freiwilligen Selbstüberprüfung. Die ausgewiesenen Themen und Keywords steuern ausschließlich die inhaltliche Abdeckung; fachliche Wissensbasis sind die je Termin freigegebenen Materialien und Primärquellen. Präsenz- und Zoom-Lauf erhalten denselben freigegebenen Fragensatz. MC-Test ist formativ und weder Prüfungsleistung noch Prüfungszulassung.

## Verbindlicher MC-Test-Generatorvertrag

Für den Kurslauf ist [MC-Test](https://github.com/kqc-real/streamlit/tree/b6b159555e8a228dad73dd75fd66c154a1088e28) auf Commit `b6b159555e8a228dad73dd75fd66c154a1088e28` festgeschrieben. Maßgeblich sind genau diese Versionen von:

- [Stage 1: Fragensatz erzeugen](https://github.com/kqc-real/streamlit/blob/b6b159555e8a228dad73dd75fd66c154a1088e28/prompts/KI_PROMPT.md)
- [Stage 2: Micro Learning Objectives erzeugen](https://github.com/kqc-real/streamlit/blob/b6b159555e8a228dad73dd75fd66c154a1088e28/prompts/KI_PROMPT_MICRO_LEARNING_OBJECTIVES.md)
- [Stage 3: Fragensatz-Postproduktion](https://github.com/kqc-real/streamlit/blob/b6b159555e8a228dad73dd75fd66c154a1088e28/prompts/KI_PROMPT_POSTPRODUCTION_QA.md)
- [Stage 4: Lernziel-Postproduktion](https://github.com/kqc-real/streamlit/blob/b6b159555e8a228dad73dd75fd66c154a1088e28/prompts/KI_PROMPT_POSTPRODUCTION_QA_LEARNING_OBJECTIVES.md)
- [Validator `validate_sets.py`](https://github.com/kqc-real/streamlit/blob/b6b159555e8a228dad73dd75fd66c154a1088e28/validate_sets.py)

Der Lehrendenagent führt die vier Artefaktstufen in derselben Sitzung strikt nacheinander aus und speichert nach jeder Stufe genau ein prüfbares Artefakt:

1. Aus Konfiguration und freigegebener Materialbasis entsteht ein kanonisches Fragen-JSON.
2. Aus dem Stage-1-JSON entsteht ein separates Markdown-Dokument mit genau einem Micro Learning Objective je Frage. Lernziele sind **kein** Feld des Fragen-JSON.
3. Ausschließlich das Stage-1-JSON wird postproduziert; Ergebnis ist ein bereinigtes kanonisches Fragen-JSON.
4. Das Stage-2-Markdown wird gegen das bereinigte Stage-3-JSON neu ausgerichtet; Ergebnis ist das finale Lernziel-Markdown.

Das verbindliche Standardprofil je Termin umfasst 30 deutschsprachige Fragen mit genau vier Antwortoptionen: 10 Fragen mit `weight = 1` / `Reproduktion`, 12 mit `weight = 2` / `Anwendung` und 8 mit `weight = 3` / `Strukturelle Analyse`. Eine didaktisch begründete Abweichung wird vor der Generierung im Manifest festgehalten; sie darf nicht stillschweigend durch den Agenten entstehen.

Das kanonische JSON besteht ausschließlich aus `meta` und `questions`. `meta` enthält mindestens `title`, `created`, `language`, `target_audience`, `question_count`, `difficulty_profile`, `time_per_weight_minutes`, `additional_buffer_minutes` und `test_duration_minutes`. Jedes Element von `questions` enthält `question`, vier Einträge in `options`, den nullbasierten Lösungsindex `answer`, `explanation`, `weight`, `topic`, `concept`, `cognitive_level`, ein `mini_glossary` mit zwei bis sechs Begriffen sowie `extended_explanation`; bei Gewicht 1 ist `extended_explanation` `null`, bei Gewicht 2 oder 3 enthält es `title`, zwei bis sechs `steps` und `content`.

Zu jedem Fragensatz wird außerhalb des kanonischen JSON ein Generierungsmanifest geführt. Es nennt Termin, Sprache, `arsnova.eu`-Commit, MC-Test-Commit, freigegebene Folien-/Skriptversion, alle weiteren Quellen mit Version oder Abrufdatum, Profil und Optionszahl sowie die vier erzeugten Artefakte. Volatile Providerfunktionen, Preise, Security-, Datenschutz- und Prüfungsangaben werden am Generierungstag gegen datierte Primärquellen geprüft. Dateinamen oder Quellenmarker werden nicht in die Fragenfelder geschrieben.

Ein Satz wird erst veröffentlicht, wenn Stage 1 bis 4 vollständig vorliegen, das Stage-3-JSON mit dem festgeschriebenen `validate_sets.py` ohne Fehler validiert wurde und die Lehrperson alle Lösungsschlüssel, Eindeutigkeit, fachliche Deckung durch die Materialbasis, plausible Distraktoren und unbeabsichtigte Lösungshinweise geprüft hat. Erst danach erfolgt ein gegebenenfalls erforderlicher Importexport aus dem kanonischen JSON. Das Manifest und die freigegebenen Artefakte werden für Präsenz und Zoom identisch versioniert.

Das Agentic Cloud Engineering Dossier ist eine formative Arbeitsgrundlage für das 15-minütige Referat je Prüfling. Falls myCampus stattdessen Workbook vorgibt, werden ausschließlich die zentralen Workbookaufgaben und [Workbook-Regeln](./CLOUD-COMPUTING-IU-FORMALIA.md#7-alternativpfad-workbook-nur-nach-bestätigung) verwendet.

## Termin 1: Grundlagen und Agentenvertrag

**Typ:** Präsenz/synchron · **Modulhandbuch:** Inhaltsblock 1 · **Leitfrage:** Wann ist ein Dienst Cloud Computing und wie wird ein Agent dafür sicher beauftragt?

**MC-Test (30 Fragen):** Themen: Cloud-Merkmale, Service- und Deployment-Modelle, Shared Responsibility, sicherer Agentenauftrag · Keywords: On-demand Self-service, Broad Network Access, Resource Pooling, Rapid Elasticity, Measured Service, IaaS, PaaS, SaaS, Public Cloud, Private Cloud, Hybrid Cloud, Multi-Cloud, Hosting, Outsourcing, Virtualisierung, Shared Responsibility, Agentenvertrag, Least Privilege, Budget, Akzeptanzkriterium, Abbruchkriterium

**MC-Test-Materialbasis:** freigegebene Folien-/Skriptversion des Termins; NIST SP 800-145; [Kurslandkarte](./CLOUD-COMPUTING-KURSREADME.md) und [akademische Einordnung](../implementation/CLOUD-COMPUTING-EINORDNUNG-AKADEMISCH.md) am im Manifest genannten `arsnova.eu`-Commit

### UE 1 (0–45)

- 0–10: Dozentenagent macht Modulziele, Workload, Referat, Agent-first-Regel und Produktionssperre prüfbar sichtbar
- 10–30: Klassifikationsagent erschließt On-demand Self-service, Broad Network Access, Resource Pooling, Rapid Elasticity und Measured Service aus freigegebenen Quellen
- 30–45: Studierende verifizieren die Agentenabgrenzung zu Hosting, Outsourcing und Virtualisierung

### UE 2 (45–90)

- Agentenvertrag mit Ziel, Werkzeugen, verbotenen Bereichen, Rechten, Budget, Akzeptanz- und Abbruchkriterien erstellen
- IaaS, PaaS und SaaS sowie Public, Private, Hybrid und Multi-Cloud agentisch zuordnen
- Shared Responsibility, Nutzen und Risiken durch einen Review-Agenten gegenprüfen

### UE 3 (90–135)

- Klassifikationsagent ordnet `arsnova.eu` als Self-managed-IaaS-Fall ein; Studierende widerlegen oder bestätigen jede Aussage
- Lernprodukt: Cloud-Einordnung mit Agentenvertrag, drei belegten Fakten, drei offenen Annahmen und Kostenlimit
- Anker: [Kurslandkarte](./CLOUD-COMPUTING-KURSREADME.md), [akademische Einordnung](../implementation/CLOUD-COMPUTING-EINORDNUNG-AKADEMISCH.md)

**Selbststudium:** Agenten die NIST-Definition extrahieren lassen, Zitate am Original prüfen und die Einordnung samt Agentenkritik auf maximal einer Seite überarbeiten.

## Termin 2: Technologische Voraussetzungen und Zielserver als Code

**Typ:** Präsenz/synchron · **Modulhandbuch:** Inhaltsblock 2 · **Leitfrage:** Welche Abstraktionen und Agentengrenzen machen einen reproduzierbaren Cloud-Zielserver möglich?

**MC-Test (30 Fragen):** Themen: Virtualisierung, Containerisierung, Infrastructure as Code, Speicher, Netzwerk und API-Kommunikation · Keywords: Hypervisor, virtuelle Maschine, Image, Container, Isolation, Docker Compose, Orchestrierung, Infrastructure as Code, Compute, Block Storage, File Storage, Object Storage, DNS, TLS, Load Balancer, Firewall, HTTP, REST, WebSocket, Egress, Quota, Cleanup

**MC-Test-Materialbasis:** freigegebene Folien-/Skriptversion des Termins; [Dockerfile](../../Dockerfile), [Produktions-Compose](../../docker-compose.prod.yml) und [Deployment](../deployment-debian-root-server.md) am im Manifest genannten `arsnova.eu`-Commit; verwendete Docker-/Providerdokumentation mit Abrufdatum

### UE 1 (0–45)

- Architekturagent modelliert Virtualisierung, Hypervisor, VM, Container, Images, Isolation und Ressourcensteuerung
- Agent trennt Compose, Orchestrierung und Infrastructure as Code und kennzeichnet Verantwortungsgrenzen
- Studierende prüfen Modell, Quellen und unzulässige Vereinfachungen

### UE 2 (45–90)

- Provisioning-Agent entwirft den isolierten Zielserver mit Compute, Block-/Datei-/Object-Storage und Netzwerk
- DNS, TLS, Load Balancing, Firewall, HTTP/REST und WebSocket-Anforderungen als maschinenprüfbare Kriterien formulieren
- unprivilegierten Agentenzugang, kurzlebige Privilegien, Egress-Grenzen, Quotas und Cleanup planen

### UE 3 (90–135)

- Agent erzeugt IaC-/Configuration-as-Code-Entwurf und einen Dry-Run ohne Produktivzugriff
- Lernprodukt: Technologiematrix plus versionierter Provisioning-Plan mit Fähigkeit, Verantwortung, Risiko und Kostenbudget
- Anker: [Dockerfile](../../Dockerfile), [Produktions-Compose](../../docker-compose.prod.yml), [Deployment](../deployment-debian-root-server.md)

**Selbststudium:** Analyseagent zeichnet eine Anfrage vom Browser bis PostgreSQL/Redis nach; Studierende belegen jeden Übergang im Repo und ergänzen ihn im Provisioning-Plan.

## Termin 3: Agentische Serverinstallation, Härtung und Zustandsgrenzen

**Typ:** Tutorium · **Modulhandbuch:** Vertiefung Inhaltsblock 2 · **Leitfrage:** Kann der Agent einen isolierten Server reproduzierbar installieren und nachweisbar härten?

**MC-Test (30 Fragen):** Themen: agentische Serverbereitstellung, Installation, Härtung, Zustands- und Vertrauensgrenzen, Wiederherstellung · Keywords: Provisioning, Idempotenz, Patchmanagement, unprivilegiertes Dienstkonto, SSH-Schlüssel, Firewall, minimale Ports, Dateirechte, Secrets, Nginx, PostgreSQL, Redis, Yjs, WebSocket, PDF-Worker, Trust Boundary, State, Hardening-Scan, Rollback, Destroy, Rebuild

**MC-Test-Materialbasis:** freigegebene Folien-/Skriptversion des Termins; [Architektur-Handbuch](../architecture/handbook.md), [`session.ts`](../../apps/backend/src/routers/session.ts) und [`redis.ts`](../../apps/backend/src/redis.ts) am im Manifest genannten `arsnova.eu`-Commit; freigegebenes Zielserverinventar und Härtungs-/Restore-Nachweise des Kurslaufs

### UE 1 (0–45)

- Provisioning-Agent prüft Plan, Ziel, Rechte, Budget, Abbruch und Snapshot; Studierende erteilen das Ausführungsgate
- Agent stellt den isolierten Zielserver aus Code bereit, inventarisiert den Ausgangszustand und aktualisiert freigegebene Pakete
- Fakten, Evidenz, Annahmen, Entscheidungen und Agentenbeiträge getrennt markieren

### UE 2 (45–90)

- Operations-Agent installiert den festgelegten `arsnova.eu`-Slice mit unprivilegierten Konten und minimalen Diensten
- Hardening-Agent begrenzt SSH/Ports, Firewall, Dateirechte, Secrets, Container, Netzwerk/Egress und Protokollierung
- Architekturagent verortet Nginx, App, PostgreSQL, Redis, Yjs, WebSockets und PDF-Worker sowie Trust-, State- und Skalierungsgrenzen

### UE 3 (90–135)

- unabhängiger Review-Agent führt Funktions-, Konfigurations- und Härtungsprüfungen aus; Studierende prüfen False Positives und Restrisiko
- Rollback/Destroy beziehungsweise reproduzierbaren Neuaufbau durchführen
- Lernprodukt: IaC, Systeminventar, belegtes Ist-Diagramm, Härtungsbericht, Restabweichungen und Wiederherstellungsnachweis
- Anker: [Architektur-Handbuch](../architecture/handbook.md), [`session.ts`](../../apps/backend/src/routers/session.ts), [`redis.ts`](../../apps/backend/src/redis.ts)

**Selbststudium:** Einen zweiten Agenten den Aufbau adversarial prüfen lassen, Befunde verifizieren und jeden verbleibenden Fakt mit Repo-, System- oder Testevidenz versehen.

## Termin 4: Serverless Computing

**Typ:** Präsenz/synchron · **Modulhandbuch:** Inhaltsblock 3 · **Leitfrage:** Welche Aufgaben empfiehlt ein Agent für Serverless und hält die Empfehlung einem isolierten Gegenversuch stand?

**MC-Test (30 Fragen):** Themen: Serverless Computing, Funktions- und Dienstmodelle, Eignung, Grenzen und Kosten · Keywords: FaaS, BaaS, Trigger, Statelessness, Cold Start, Laufzeitgrenze, Autoscaling, Pay-per-use, Function, Container, Job, Queue, Worker, Managed Service, Observability, Datenlokalität, Vendor Lock-in, Break-even, PDF-Erzeugung, Webhook, Yjs

**MC-Test-Materialbasis:** freigegebene Folien-/Skriptversion des Termins; [`pdfWorkerTransport.ts`](../../apps/backend/src/lib/pdfWorkerTransport.ts) und [6R-Einordnung](../implementation/CLOUD-COMPUTING-6R-EINORDNUNG.md) am im Manifest genannten `arsnova.eu`-Commit; offizielle Funktions-, Limit- und Preisunterlagen von GCP, AWS und Azure mit Abrufdatum

### UE 1 (0–45)

- Serverless-Agent erschließt Function as a Service, Backend as a Service, Trigger, kurze Ausführung und zustandslose Instanz
- Agent grenzt Function, Container, Job, Queue-Worker und Managed Service anhand gleicher Kriterien ab
- Studierende prüfen Definitionen und Verantwortungsmodell gegen Primärquellen

### UE 2 (45–90)

- Agent bewertet Skalierung, Abrechnung und Infrastrukturpflege sowie Laufzeitgrenzen, Cold Starts, Observability und Datenlokalität
- Economics-Agent ergänzt Kostenkurve, Break-even und Lock-in
- Review-Agent verwendet langlebige Verbindungen und lokalen Zustand als Gegenbeispiele

### UE 3 (90–135)

- Agent vergleicht PDF-Erzeugung, Webhooks, periodische Pflegejobs, HTTP-API und Yjs
- einen geeigneten Kandidaten in einer isolierten, budgetierten Sandbox prototypisieren oder als reproduzierbaren Dry-Run ausführen
- Lernprodukt: Serverless-Eignungsmatrix mit Testevidenz, Kostenband, Entscheidung und Gegenargument
- Anker: [`pdfWorkerTransport.ts`](../../apps/backend/src/lib/pdfWorkerTransport.ts), [6R-Einordnung](../implementation/CLOUD-COMPUTING-6R-EINORDNUNG.md)

**Selbststudium:** Agenten eine geeignete und eine ungeeignete Funktion gegeneinander verteidigen lassen; Quellen, Architekturfolge und Kostenannahmen selbst verifizieren.

## Termin 5: Etablierte Cloud-Plattformen

**Typ:** Präsenz/synchron · **Modulhandbuch:** Inhaltsblock 4 · **Leitfrage:** Wie vergleicht ein Provider-Agent Google Cloud, AWS und Azure ohne Produktkatalog- oder Preisillusion?

**MC-Test (30 Fragen):** Themen: Google Cloud, AWS und Azure, Providerfähigkeiten, Verantwortungsgrenzen, Regionen und Kosten · Keywords: Projekt, Account, Subscription, Region, Availability Zone, IAM, VPC, VNet, Compute, Container Service, Functions, Object Storage, Managed Database, Monitoring, Shared Responsibility, Pricing, Egress, Data Residency, Lock-in, Exit, Primärquelle

**MC-Test-Materialbasis:** freigegebene Folien-/Skriptversion des Termins; [Provider-Vergleich](../implementation/CLOUD-PROVIDER-VERGLEICH-ARSNOVA-EU.md) am im Manifest genannten `arsnova.eu`-Commit; offizielle Service-, Regionen-, Shared-Responsibility- und Preisunterlagen von GCP, AWS und Azure mit Abrufdatum, Region, Währung und Steuerbasis

### UE 1 (0–45)

- Provider-Agent erhebt Konto-/Projektmodell, Regionen, Availability Zones, Identität, Netzwerk und Abrechnung
- Agent ordnet Service-Tiefe und Shared Responsibility nach einem identischen Raster
- Quellenagent liefert ausschließlich aktuelle Primärquellen mit Abrufdatum

### UE 2 (45–90)

- Agent bildet GCP, AWS und Azure nach Compute, Container, Functions, Storage, Netzwerk, Datenbank und Observability ab
- Review-Agent normalisiert Produktnamen auf Fähigkeiten und sucht asymmetrische Vergleiche
- Privacy-/FinOps-Agent prüft Region, Datenschutz, Kostenkontrolle, Lock-in und Exit als Ausschlusskriterien

### UE 3 (90–135)

- Agent skizziert dieselbe `arsnova.eu`-Fähigkeit auf allen drei Plattformen und macht Annahmen maschinenlesbar
- Lernprodukt: Capability-/Verantwortungs-/Kostenvergleich mit Primärquellen, Abrufdatum und menschlicher Gegenprüfung
- Anker: [Provider-Vergleich](../implementation/CLOUD-PROVIDER-VERGLEICH-ARSNOVA-EU.md)

**Selbststudium:** Quellenagent aktualisiert pro Plattform zwei volatile Angaben; Studierende prüfen Quelle, Region, Datum, Einheit und Vergleichbarkeit.

## Termin 6: Datenwissenschaft und maschinelles Lernen in der Cloud

**Typ:** Präsenz/synchron · **Modulhandbuch:** Inhaltsblock 5 · **Leitfrage:** Wie wird Word Cloud 3.0 als erklärbare, datensparsame und messbare Cloud-ML-Kaskade entworfen?

**MC-Test (30 Fragen):** Themen: Datenwissenschaft und maschinelles Lernen in der Cloud, Word Cloud 3.0, Datenpipeline, Managed ML, Datenschutz und Wirtschaftlichkeit · Keywords: Batch, Streaming, ETL, ELT, Notebook, Pipeline, Embedding, Clustering, Open-Weight-LLM, Inferenzserver, MLOps, Datenqualität, Reproduzierbarkeit, Datenminimierung, Zweckbindung, Datenresidenz, Aufbewahrung, Löschung, Modell-/Datenexport, synthetische Daten, Egress

**MC-Test-Materialbasis:** freigegebene Folien-/Skriptversion des Termins; [Story 1.14c](../../Backlog.md#epic-1-quiz-verwaltung-rolle-lehrperson--erstellerin), [Word-Cloud-3.0-Zielbild](../implementation/WORD-CLOUD-3.0-STORY-VORSCHLAG.md), freigegebener Datenfluss und Privacy-/FinOps-Artefakte des Kurslaufs; offizielle Produkt-, Datenverarbeitungs-, Regionen-, Export- und Preisunterlagen zu Vertex AI, Amazon SageMaker und Azure Machine Learning mit Abrufdatum

### UE 1 (0–45)

- Daten-/ML-Agent modelliert für Word Cloud 3.0 Aufnahme, Snapshot, Embedding, deterministisches Clustering, optionale quellengebundene LLM-Labelbildung, Fallback und Monitoring
- Agent vergleicht Batch/Streaming sowie Notebook, Warehouse, Pipeline und Managed ML
- Studierende prüfen Datenqualität, Reproduzierbarkeit, Kosten und Verantwortungsgrenze

### UE 2 (45–90)

- Agent entwirft den getrennten privaten Inferenzserver neben der bestehenden App-/PostgreSQL-/Redis-Single-Host-Baseline und vergleicht GCP-, AWS- und Azure-Angebote nach denselben Pipeline-Fähigkeiten
- Privacy-Agent erstellt Dateninventar, Zweck-/Rollenmatrix und Datenfluss und prüft Minimierung, Residenz, Löschung und Modell-/Datenexport
- Economics-Agent ergänzt Betrieb, Modellkosten, Egress und Lock-in

### UE 3 (90–135)

- Agent implementiert einen reproduzierbaren Offlinevergleich von lexikalischer, spaCy-, Encoder-/Clustering- und optionaler LLM-Variante ausschließlich mit synthetischen oder ausdrücklich freigegebenen Q&A-Daten
- Review-Agent verwirft personenbezogene, zweckfremde oder nicht freigegebene Datenpfade
- Lernprodukt: Word-Cloud-3.0-Datenfluss, Seed-Set, Modell-/Lizenzmanifest und DS-/ML-Service-Mapping mit Zweck, Region, Verantwortungsgrenze, Datenschutzrisiko und Kostenband

**Selbststudium:** Encoder-, Clustering- und optionale LLM-Varianten auf demselben Seed-Set vergleichen; Daten-, Privacy- und FinOps-Agenten dieselbe Plattformoption prüfen lassen und Widersprüche menschlich dokumentieren.

## Termin 7: Daten, Speicher, Backup und Recovery

**Typ:** Tutorium · **Modulhandbuch:** Vertiefung Inhaltsblock 2 · **Leitfrage:** Kann ein Recovery-Agent die geforderte Wiederherstellung tatsächlich und reproduzierbar ausführen?

**MC-Test (30 Fragen):** Themen: Persistenz, Speicherklassen, Backup, Restore und Disaster Recovery · Keywords: Persistenz, Cache, flüchtiger Zustand, PostgreSQL, Redis, Yjs, Object Storage, Backup, Snapshot, Offsite Backup, RPO, RTO, Konsistenz, Idempotenz, Restore, Integrität, Datenverlust, Recovery-Test, Disaster Recovery, Owner, Kosten

**MC-Test-Materialbasis:** freigegebene Folien-/Skriptversion des Termins; [Prisma-Schema](../../prisma/schema.prisma) und [Backup-/Restore-Runbook](../operations/BACKUP-RESTORE-RUNBOOK.md) am im Manifest genannten `arsnova.eu`-Commit; freigegebene Backup-, Fehlerfall- und Restore-Nachweise des Kurslaufs

### UE 1 (0–45)

- Recovery-Agent inventarisiert Persistenz, Cache, flüchtigen Zustand und Object Storage auf dem Zielserver
- Agent schlägt RPO, RTO, Konsistenz- und Idempotenzkriterien vor; Studierende prüfen Geschäfts- und Nutzerfolge
- Agentenplan, Datenzugriff, Snapshot und Abbruchweg vor Ausführung freigeben

### UE 2 (45–90)

- Agent ordnet PostgreSQL-, Redis-, Yjs- und Exportdaten ein und prüft Backup-/Offsite-Grenzen
- Recovery-Agent führt in der isolierten Umgebung ausgewählte DB-, Redis-, Host- oder Deployment-Fehlerfälle aus
- Restore in frische Zielumgebung durchführen und Zeit, Verlust, Integrität und Kosten messen

### UE 3 (90–135)

- unabhängiger Review-Agent verifiziert den Restore; Backupbehauptung nur mit ausgeführtem Restore-Nachweis akzeptieren
- Lernprodukt: Daten-/Recovery-Matrix mit Owner, RPO, RTO, Messwert, Kosten und Evidenz
- Anker: [Prisma-Schema](../../prisma/schema.prisma), [Backup-/Restore-Runbook](../operations/BACKUP-RESTORE-RUNBOOK.md)

**Selbststudium:** Recovery-Agent den Neuaufbau wiederholen lassen, Abweichungen erklären und Schrittfolge/Automation korrigieren.

## Termin 8: Skalierung und Performance Engineering

**Typ:** Tutorium · **Modulhandbuch:** Fallvertiefung zu Nutzen/Risiken und technischer Grundlage · **Leitfrage:** Welche Messung an Word Cloud 3.0 kann eine Qualitäts-, Skalierungs- oder Wirtschaftlichkeitsannahme widerlegen?

**MC-Test (30 Fragen):** Themen: Skalierung, Elastizität, Word-Cloud-Inferenz, Last- und Performance Engineering, Resilienz und Unit Costs · Keywords: vertikale Skalierung, horizontale Skalierung, Queueing, Backpressure, Early Exit, Cache, p50, p95, p99, Durchsatz, Fehlerrate, Fallback-Rate, CPU, RAM, GPU, VRAM, Energie, SLI, SLO, Lasttest, Baseline, WebSocket, Yjs, Inferenzserver, Abbruchkriterium, Unit Cost

**MC-Test-Materialbasis:** freigegebene Folien-/Skriptversion des Termins; [Story 1.14c](../../Backlog.md#epic-1-quiz-verwaltung-rolle-lehrperson--erstellerin), [Produktions-Join](../implementation/LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md), [lokale Baseline](../implementation/LOCAL-BASELINE-FREIGABE-2026-07-12.md) und [§6.5-Abnahme](../implementation/S6.5-SECURITY-LOAD-ACCEPTANCE.md) am im Manifest genannten `arsnova.eu`-Commit; freigegebene Qualitäts-, Ressourcen- und Lastreports des Kurslaufs mit Umgebung, Modellversion und Messdatum

### UE 1 (0–45)

- Performance-Agent formuliert Hypothesen zu vertikaler/horizontaler Skalierung, Elastizität, Queueing und Backpressure
- Agent definiert p50/p95/p99, Durchsatz, Fehlerrate und Sättigung als maschinenprüfbare Messgrößen
- Quality-Agent definiert Clustermetrik, Fallback-/Uncertain-Rate und eine menschliche Rubrik für Labeltreue, Lesbarkeit und Quellenbindung
- Workload-Agent trennt viele kleine Sessions von einem einzelnen Fan-out-Hotspot

### UE 2 (45–90)

- Agent vergleicht historische Produktions-Joins, lokale 500er-Baselines und offene §6.5-Abnahme ohne Evidenzstufen zu vermischen
- lexikalische, spaCy-, Encoder-/Clustering- und optionale LLM-Variante mit identischem Q&A-Seed-Set und identischer Messgrenze vergleichen
- `100 × 50` und `1 × 5.000` getrennt modellieren und nur auf der isolierten, budgetierten Zielumgebung skaliert ausführen
- prozesslokale Signale, WebSocket/Yjs-Routing und globale Limits als Scale-out-Hürden prüfen

### UE 3 (90–135)

- menschliches Last-, Kosten- und Sicherheitsgate; Agent führt Test aus, sammelt Report und wiederholt mindestens eine Messung
- Inferenzserver deaktivieren, verlangsamen, überlasten und ausfallen lassen; Q&A-Submit, Join, Vote, WebSocket/Reconnect und lexikalische Wortwolke dürfen nicht warten oder ausfallen
- Queue-/Ende-zu-Ende-Latenz, Cache, Early Exit, CPU, RAM, GPU/VRAM, Netzwerk und Energie soweit messbar erfassen
- Economics-Agent berechnet Kosten pro definierter Last-/SLO-Einheit
- Lernprodukt: reproduzierbarer Qualitäts-, Last-, Ressourcen- und Degradationsreport mit Workload, Umgebung, Modellversion, Gate, Abbruch, Rohdaten, Gültigkeitsgrenze und Unit Costs
- Anker: [Produktions-Join](../implementation/LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md), [lokale Baseline](../implementation/LOCAL-BASELINE-FREIGABE-2026-07-12.md), [§6.5-Abnahme](../implementation/S6.5-SECURITY-LOAD-ACCEPTANCE.md)

**Selbststudium:** Performance-Agent eine Gegenhypothese testen lassen; Qualitäts-/Latenz-/Kosten-Trade-off, Messrauschen und Gültigkeitsgrenze dokumentieren.

## Termin 9: Security, Observability und Resilienz

**Typ:** Präsenz/synchron · **Modulhandbuch:** Nutzen/Risiken und Plattformanalyse · **Leitfrage:** Können Security- und Privacy-Agenten Befunde sicher beheben und mit unabhängiger Evidenz schließen?

**MC-Test (30 Fragen):** Themen: Cloud-Sicherheit, Datenschutz, Observability und Resilienz · Keywords: IAM, Least Privilege, Secrets, Netzwerksegmentierung, Supply Chain, Tenant-Isolation, Session-Isolation, Verschlüsselung, Datenminimierung, Logs, Metriken, Traces, Alerting, Runbook, Redundanz, Graceful Degradation, Vulnerability Scan, Remediation, Negativtest, False Positive, Restrisiko

**MC-Test-Materialbasis:** freigegebene Folien-/Skriptversion des Termins; [Security Overview](../SECURITY-OVERVIEW.md), [Monitoring-Runbook](../operations/MONITORING-RUNBOOK.md) und [W3.7-Abnahme](../implementation/W3.7-MONITORING-ALARMS-ABNAHME.md) am im Manifest genannten `arsnova.eu`-Commit; freigegebene Scan-, Negativtest- und Datenschutzartefakte des Kurslaufs sowie datierte Primärquellen für volatile Sicherheitsvorgaben

### UE 1 (0–45)

- Security-Agent modelliert IAM, Least Privilege, Secrets, Netzwerkgrenzen, Supply Chain und Tenant-/Session-Isolation
- Privacy-Agent prüft Verschlüsselung, Datenminimierung, Speicherorte, Aufbewahrung, Löschung und Modell-/Tool-Datenabfluss
- für den Word-Cloud-Inferenzserver Service-Identität, privaten Modellport, Q&A-Snapshot, Prompt-/Model-Injection, Modelllizenz und Image-/Modell-Hash prüfen
- Studierende genehmigen Scan- und Änderungsumfang; fremde und produktive Systeme bleiben ausgeschlossen

### UE 2 (45–90)

- Blue-Agent scannt Konfiguration, Abhängigkeiten, Container/IaC und exponierte Dienste
- Remediation-Agent priorisiert und implementiert freigegebene Maßnahmen
- Inferenzserver, App-Host und optionale PostgreSQL-Drei-Server-Variante gegen unzulässige Netzpfade und Datenabfluss testen
- Observability-Agent prüft Logs, Metriken, Traces, SLI/SLO, Alarm, Runbook, Redundanz und Graceful Degradation

### UE 3 (90–135)

- unabhängiger Review-/Red-Agent führt Negativtests aus und prüft False Positives, Regressionen und Restrisiko
- Economics-Agent bewertet Kosten von Kontrolle, Managed Alternative und verbleibendem Risiko
- Lernprodukt: `Befund → Risiko → Maßnahme → Verifikation → Restrisiko` plus Owner und Kostenfolge
- Anker: [Security Overview](../SECURITY-OVERVIEW.md), [Monitoring-Runbook](../operations/MONITORING-RUNBOOK.md), [W3.7-Abnahme](../implementation/W3.7-MONITORING-ALARMS-ABNAHME.md)

**Selbststudium:** Security-, Privacy- und Economics-Agenten dasselbe Residualrisiko bewerten lassen; Konflikte aus Nutzer-, Betreiber- und Providersicht entscheiden.

## Termin 10: Providerentscheidung, FinOps und 6R

**Typ:** Tutorium · **Modulhandbuch:** Analyse etablierter Plattformen · **Leitfrage:** Welche technisch belegte Cloud-Option ist unter Kosten, Risiko und Exit wirtschaftlich vertretbar?

**MC-Test (30 Fragen):** Themen: Providerentscheidung, FinOps, TCO, Unit Economics und 6R-Migration · Keywords: Rehost, Replatform, Repurchase, Refactor, Retire, Retain, TCO, Unit Economics, CapEx, OpEx, Personalaufwand, Support, Observability-Kosten, Compliance-Kosten, Egress, Build-or-Buy, Best Case, Base Case, Worst Case, Sensitivitätsanalyse, Lock-in, Exit, ADR

**MC-Test-Materialbasis:** freigegebene Folien-/Skriptversion des Termins; [6R-Einordnung](../implementation/CLOUD-COMPUTING-6R-EINORDNUNG.md), [Provider-Vergleich](../implementation/CLOUD-PROVIDER-VERGLEICH-ARSNOVA-EU.md) und [Kostenrechenblatt](../implementation/CLOUD-COMPUTING-HETZNER-KOSTENVORSCHLAG.md) am im Manifest genannten `arsnova.eu`-Commit; offizielle Preisrechner/-listen mit Abrufdatum, Region, Währung und Steuerbasis

### UE 1 (0–45)

- Economics-/FinOps-Agent prüft den GCP-/AWS-/Azure-Vergleich aus Termin 5 auf gleiche Systemgrenze und Leistungsbasis
- Agent bewertet Rehost, Replatform, Repurchase, Refactor, Retire und Retain
- Infrastrukturpreis, Total Cost of Ownership, Unit Economics, Opportunitätskosten und Lock-in trennen

### UE 2 (45–90)

- Self-managed IaaS, IaaS mit Managed Data und Managed Application Platform mit denselben Performance-/Security-/Privacydaten vergleichen
- für Word Cloud 3.0 mindestens getrennten Self-hosted-Open-Weight-Inferenzserver, kleinere Encoder-/CPU-Lösung und geeignete Managed-/SaaS-Marktalternative auf derselben Systemgrenze vergleichen
- Agent modelliert Infrastruktur, Personal, Support, Observability, Backup, Security/Compliance, Egress, Migration und Exit
- Kosten pro Analyse, Session und 1.000 Fragen sowie Best-/Base-/Worst-Case und Sensitivitätsanalyse mit Auslastung/Leerlauf, Region, Währung, Steuerbasis, Abrufdatum und Primärquelle erzeugen

### UE 3 (90–135)

- gemischte Informatik-/Wirtschaftsinformatikrollen führen technischen und wirtschaftlichen Review-Agenten gegeneinander
- Lernprodukt: Word-Cloud-3.0-ADR mit Zwei-/Drei-Server-Betriebsmodell, stärkster verworfener Alternative, 6R-Zuordnung, TCO, Unit Economics, Sensitivität, Risiko, Build/Buy und Exit-Kriterium
- Anker: [6R-Einordnung](../implementation/CLOUD-COMPUTING-6R-EINORDNUNG.md), [Provider-Vergleich](../implementation/CLOUD-PROVIDER-VERGLEICH-ARSNOVA-EU.md), [Kostenrechenblatt](../implementation/CLOUD-COMPUTING-HETZNER-KOSTENVORSCHLAG.md)

**Selbststudium:** Decision-Agent die stärkste verworfene Alternative vertreten lassen; Annahmen, Sensitivität und menschliche Schlussentscheidung überarbeiten.

## Termin 11: Referatswerkstatt

**Typ:** Tutorium · **Prüfungsbezug:** Referat, 15 Minuten je Prüfling · **Leitfrage:** Wie bilden Einreichung, Vortrag und Diskussion gemeinsam eine akademisch belastbare Prüfungsleistung?

**MC-Test (30 Fragen):** Themen: wissenschaftliche Argumentation, Referatsstruktur, Evidenz, Quellen, Visualisierung und Agentenoffenlegung · Keywords: Forschungsfrage, These, Argumentationslinie, Primärquelle, Quellenkritik, Fakt, Evidenz, Annahme, Entscheidung, Zitation, Literaturverzeichnis, Handout, Poster, Abbildung, individuelle Kennzeichnung, Agentenbeitrag, akademische Integrität, Zeitbudget, Einreichung, Vortrag, Diskussion, 30/30/40-Gewichtung

**MC-Test-Materialbasis:** freigegebene Folien-/Skriptversion des Termins; [IU-Formalia](./CLOUD-COMPUTING-IU-FORMALIA.md), [Referatsumsetzung](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md) und [Agentic-Lehrlabor](./CLOUD-COMPUTING-AGENTIC-LEHRLABOR.md) am im Manifest genannten `arsnova.eu`-Commit; veröffentlichter Prüfungsauftrag, Hilfsmittelregel und Bewertungsbogen des Kurslaufs mit Gültigkeitsdatum

### UE 1 (0–45)

- Prüfungsauftrag, Einzel-/Gruppenformat, Handout-/Posterformat, Hilfsmittel und gemeinsame E-Mail-Frist klären
- zulässige Agentennutzung, Offenlegung und individuelle Verantwortlichkeit aus Prüfungsauftrag/myCampus klären
- mindestens vier Wochen zwischen Themenfeststellung und Abgabe prüfen
- Thema aus dem [kanonischen Katalog](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md#41-kanonischer-themenkatalog-für-die-fallstudie-arsnovaeu) mit verbindlicher Story-/Commitbasis, individueller These, Messauftrag, Gegenalternative und Entscheidungsfolge übernehmen
- Thema anhand der Katalogzuordnung auf das ausgewiesene offizielle Qualifikationsziel ausrichten
- bei mehrfach vergebenem Katalogthema unterschiedliche Fallvariante, These, Evidenz und individuellen Beitrag nachweisen
- bei Gruppenarbeit individuelle Beiträge in Einreichung und Vortrag eindeutig zuordnen

### UE 2 (45–90)

- Review-Agent prüft das Agentic Cloud Engineering Dossier auf Auftrag, Diffs, Tests, Scans, Messungen, Kosten, Cleanup und Restunsicherheit
- die themenspezifischen Qualitäts-, Last-, Ressourcen-, Resilienz-, Security-, Privacy- oder Kostenmessungen in eine fachlich prüfbare These überführen
- alle Literatur-, Preis-, Mess- und Systembehauptungen am Original beziehungsweise in der Zielumgebung verifizieren
- Agenten, Modelle, wesentliche Aufträge, übernommene Beiträge und individuelle Entscheidung transparent kennzeichnen
- Handout mit höchstens 5 DIN-A4-Seiten beziehungsweise einseitiges Poster ab DIN A3 planen
- Abbildungen nummerieren und Quellen zuordnen
- Folien-/Visualisierungsskizze und gemeinsames 15-Minuten-Budget für Vortrag und Diskussion erstellen
- Produktnamen nur mit erklärter Fähigkeit und Verantwortung verwenden

### UE 3 (90–135)

- Feedback-Agent erzeugt kritische Fach-, Security-, Privacy-, Performance- und Wirtschaftsfragen; Menschen prüfen und priorisieren sie
- mindestens eine Probeverteidigung stellt die technische Evidenz der wirtschaftlichen, betrieblichen oder verantwortungsbezogenen Entscheidung und der stärksten verworfenen Alternative gegenüber
- Kurz-Pitches und Peer-Feedback in gemischten Informatik-/Wirtschaftsinformatikrollen
- Feedback anhand der offiziellen Kriterien und der Gewichte 30 % Einreichung, 30 % Vortrag, 40 % Diskussion
- Lernprodukt: Einreichungs- und Vortragsskizze mit Quellen, Zeitplan und offener Unsicherheit

**Selbststudium:** Bei formaler Freigabe Agenten für Entwurf und Gegenprüfung der PDF-Einreichung nutzen, Beiträge offenlegen und Rückfragen zum gesamten Thema ohne Agentenstellvertretung beantworten können.

## Termin 12: Probeprüfung und Synthese

**Typ:** Tutorium · **Prüfungsbezug:** Referat, 15 Minuten je Prüfling · **Leitfrage:** Deckt die individuelle Leistung das Modulziel ab und hält sie einer dialogischen Befragung stand?

**MC-Test (30 Fragen):** Themen: kumulative Cloud-Computing-Synthese, Begriffswolke und Moderationskompass, Referatsverteidigung, Agentenkritik und Grenzen der Evidenz · Keywords: Cloud-Merkmale, Service-Modell, technologische Voraussetzung, Serverless, Google Cloud, AWS, Azure, Datenwissenschaft, maschinelles Lernen, Single-Host-Sidecar, Inferenzserver, Embedding, Clustering, Open-Weight-LLM, Moderationskompass, getrennte Inferenzverträge, Security, Datenschutz, Performance, Resilienz, FinOps, Evidenzstufe, Gültigkeitsgrenze, Restrisiko, Sensitivität, Agentenfehler, Quellenprüfung, Diskussion, akademische Integrität

**MC-Test-Materialbasis:** vollständige freigegebene Folien-/Skriptversion des Kurslaufs; die im Manifest festgeschriebenen Materialbasen der Termine 1 bis 10; [IU-Formalia](./CLOUD-COMPUTING-IU-FORMALIA.md), [Referatsumsetzung](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md) und [Agentic-Lehrlabor](./CLOUD-COMPUTING-AGENTIC-LEHRLABOR.md) am genannten `arsnova.eu`-Commit; gültiger Prüfungsauftrag und Bewertungsbogen

### UE 1 (0–45)

- Einreichung gegen Umfang, Namen/Matrikelnummern, Literatur, Abbildungen und individuelle Kennzeichnung prüfen
- fachliche Checkliste: Grundlagen, technologische Voraussetzung, Serverless, Plattform oder DS/ML
- Themenvertrag gegen Katalog prüfen: offizieller Qualifikationsbezug, Leitfrage, These, Story-/Commitbasis, Evidenz, Gegenalternative, Entscheidung und Gültigkeitsgrenze vollständig
- Agentenoffenlegung, Quellen, Abrufdaten, Fakten-/Annahmen-Trennung und Visualisierungen prüfen

### UE 2 (45–90)

- 15-minütige Probeprüfungen je Person mit Vortrag und anschließender Befragung/Diskussion
- individuelle Zeit und individuelle Beiträge auch bei Gruppenformat sichern
- Befragungsagent erzeugt Fragen zu Agentenfehlern, Rechten, Härtung, Datenschutz, Performance, TCO, Sensitivität und Restrisiko
- bei Themen aus 1.14a–1.14c und 8.9a–8.9c technische Messwerte, Fallback/Degradation, Vertrags- und Infrastrukturgrenzen, Modell-/Lizenzwahl sowie wirtschaftliche, betriebliche oder verantwortungsbezogene Schlussentscheidung gegeneinander prüfen
- Lehrperson verantwortet Auswahl, Durchführung und Peer-Feedback anhand des offiziellen Bewertungsbogens

### UE 3 (90–135)

- individuelle Revision mit Review-Agent, aber ohne autonome Notenentscheidung
- Synthese der fünf offiziellen Inhaltsblöcke
- bei virtueller Prüfung Identifikation, Raumscan, Bildschirmfreigabe sowie durchgehendes Bild und Ton technisch proben
- Lernprodukt: überarbeitete Einreichung, Vortrag und persönliche Restfragenliste

**Selbststudium:** finale Prüfungsvorbereitung und fristgerechte PDF-Zustellung per E-Mail entsprechend den veröffentlichten Vorgaben.

## Anpassungsregeln

- **18 × 2 UE:** Paarweise dieselbe Bilanz von 18 UE Präsenz/synchron und 18 UE Tutorium erhalten.
- **Agent-first:** Alle substanziellen Aufgaben laufen über die freigegebene Agentenschnittstelle; manueller Notfallzugriff wird begründet und protokolliert.
- **Zielserver fällt aus:** Auf eine identisch konfigurierte, isolierte Lehrenden-Sandbox wechseln; Installation, Härtung und Cleanup werden agentisch nachgeholt.
- **Cloud-Sandbox vorhanden:** Nur kurzlebige, budgetierte Agentenexperimente ohne Echtdaten; automatischen Stopp und Cleanup dokumentieren.
- **Präsenz und Zoom:** Keine fachlichen Parallelpläne pflegen; je Aktivität das Medien-Mapping und den Ausfallplan aus dem Durchführungskonzept verwenden.
- **Wirtschaftsinformatik:** TCO, Unit Economics, Sensitivität, Risiko, Build/Buy und Exit nie von technischer Mess- und Architekturevidenz trennen.
- **Prüfungsform Referat:** Die vollständigen Vorgaben der [Referatsumsetzung](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md) anwenden; keine zusätzliche Dossierbewertung einführen.
- **Prüfungsform Workbook bestätigt:** Termine 11 und 12 auf die zentralen fünf Aufgaben und Einzelarbeitsregeln ausrichten; keine selbst erfundene Gruppenabgabe.
- **Repo oder MC-Test ändert sich:** Kurslandkarte aktualisieren; pro Fragensatz `arsnova.eu`- und MC-Test-Commit im Generierungsmanifest dokumentieren. Ein Versionswechsel der Prompts oder des Validators erfordert einen erneuten Pipeline-Test und eine bewusste Kursfreigabe.
- **Zu wenig Zeit:** Fallvertiefungen kürzen, niemals die fünf offiziellen Inhaltsblöcke oder die Präsenz-/Tutoriumsbilanz streichen.
