<!-- markdownlint-disable MD013 MD024 MD060 -->

# Wochenlehrplan Cloud Computing am Fallbeispiel arsnova.eu

## 1. Zweck und Stellung im Modulpaket

Dieser Lehrplan konkretisiert die zwölf Kurswochen des [Modulkonzepts](./Modulkonzept_Cloud_Computing.md). Er verbindet für jede Woche:

- die fachlichen Inhalte und die leitende Problemfrage;
- die zugeordneten Qualifikationsziele (QZ), Modulziele (MZ) und Learning Indicators (LI);
- die beiden Unterrichtseinheiten (UE) der 90-minütigen Lerneinheit (LE);
- die dritte UE mit dem formativen Multiple-Choice-Test (MC-Test);
- einen verbindlichen Fachwortschatz mit Arbeitsdefinitionen;
- Repository- und Quellenanker für das Fallbeispiel arsnova.eu;
- den Dossierertrag und den anschließenden Selbststudiumsauftrag.

Für Ziele und Alignment ist die [Lernziel- und Alignment-Matrix](./Lernziel_Alignment_Matrix.md) maßgeblich. Die [ARSnova-Wochen-Dateien im Format JavaScript Object Notation (JSON)](./ARSnova_Blueprint_12_Wochen.md) enthalten den autoritativen Wortlaut der Livefragen; die [MC-Test-Wochen-JSONs](./MC-Test_Blueprint_12_Wochen.md) enthalten den autoritativen Wortlaut, die Lösungen und Erklärungen der MC-Items. Das [Lehrenden-Runbook](./Lehrenden_Runbook.md) regelt Preflight, Betrieb, Datenschutz, Störungen und Nachbereitung. Dieser Lehrplan ersetzt den überholten UE-3-Ablauf des früheren Terminplans.

## 2. Begriffe, Zeitmodell und Kursstartbasis

- **Unterrichtseinheit (UE):** 45 Minuten.
- **Lerneinheit (LE):** UE 1 und UE 2 als zusammenhängender 90-Minuten-Block.
- **W01–W12:** die zwölf Kurswochen.
- **L01–L10:** die zehn ARSnova-Livefragen einer Woche in der Reihenfolge der jeweiligen Importdatei.
- **Multiple Choice (MC):** Aufgabenformat mit vorgegebenen Antwortoptionen; **MC-Test** bezeichnet die formative Lernanwendung.
- **Qualifikationsziel (QZ):** eines der fünf offiziellen Qualifikationsziele aus dem Modulhandbuch.
- **Modulziel (MZ):** eines der neun operationalisierten Ziele dieses Lehrkonzepts.
- **Learning Indicator (LI):** beobachtbarer Lernindikator aus der Alignment-Matrix.
- **Agentic Cloud Engineering Dossier (Dossier):** formative Sammlung eigener Aufträge, Quellen, Entwürfe, Tests, Messungen, Entscheidungen und Agentenkritik.
- **REPO:** versionierte Repository-Nachweise.
- **LEHRDATEN:** synthetische oder ausdrücklich für die Lehre freigegebene Daten.
- **LIVE:** im konkreten Kursbetrieb entstehende Interaktionsdaten.
- **JavaScript Object Notation (JSON):** textbasiertes Format für strukturierte Daten.
- **Application Programming Interface (API):** programmierbare Schnittstelle zwischen Softwarekomponenten.
- **Künstliche Intelligenz (Artificial Intelligence, AI), maschinelles Lernen (Machine Learning, ML) und Large Language Model (LLM):** Oberbegriff, datenbasierte Modellklasse und großes Sprachmodell.
- **Infrastructure as a Service (IaaS), Platform as a Service (PaaS) und Software as a Service (SaaS):** Cloud-Dienstmodelle mit unterschiedlichen Verantwortungsgrenzen.
- **Function as a Service (FaaS) und Backend as a Service (BaaS):** serverlose Funktionsausführung und verwaltete Backend-Fähigkeiten.
- **Infrastructure as Code (IaC):** versionierte, automatisierbare Infrastrukturdefinition.
- **Identity and Access Management (IAM):** Identitäts- und Berechtigungsverwaltung.
- **Recovery Point Objective (RPO) und Recovery Time Objective (RTO):** Ziele für tolerierten Datenverlustzeitraum und Wiederherstellungszeit.
- **Service Level Indicator (SLI), Service Level Objective (SLO) und Site Reliability Engineering (SRE):** Messgröße, Zielwert und ingenieurmäßiger Zuverlässigkeitsansatz.
- **Financial Operations (FinOps) und Total Cost of Ownership (TCO):** Kostensteuerungsprozess und Gesamtkostenmodell.
- **Architecture Decision Record (ADR):** nachvollziehbare Dokumentation einer Architekturentscheidung.
- **Google Cloud Platform (GCP), Amazon Web Services (AWS) und Microsoft Azure:** die im Modul verglichenen Cloud-Plattformen.
- **Central Processing Unit (CPU) und Graphics Processing Unit (GPU):** Haupt- und Grafikprozessor als mögliche Inferenzressourcen.
- **Domain Name System (DNS) und Transport Layer Security (TLS):** Namensauflösung und geschützter Transport.
- **Virtual Private Cloud (VPC) und Virtual Network (VNet):** logisch isolierte Provider-Netzbereiche.
- **Capital Expenditure (CapEx) und Operational Expenditure (OpEx):** investive und laufende Ausgaben.
- **Portable Document Format (PDF):** Dokumentformat des isolierten Export-Workers.
- **Continuous Integration (CI):** automatisierte Prüfung integrierter Änderungen.
- **National Institute of Standards and Technology (NIST):** Herausgeber der im Modul verwendeten Cloud-Definition.
- **Extract, Transform, Load (ETL) und Extract, Load, Transform (ELT):** zwei Reihenfolgen für Extraktion, Umformung und Laden von Daten.
- **Machine Learning Operations (MLOps):** Praktiken für Versionierung, Auslieferung, Monitoring und Änderung von ML-Systemen.
- **Fragen und Antworten (Q&A):** der moderierte Fragenkanal von arsnova.eu.
- **p50, p95 und p99:** das 50., 95. und 99. Perzentil einer Messwertverteilung.
- **6R:** Rehost, Replatform, Repurchase, Refactor, Retire und Retain als Migrationstaxonomie.

Für W03, W06, W08–W10 und die Referatsvorbereitung gilt die Kursstartannahme aus dem [Referatsthemenkatalog](./Referatsthemen_Cloud_Computing_ARSnova.md#3-verbindliche-kursstartannahme-für-die-lokale-llm-runtime): Story 8.9d ist entsprechend [ADR-0035](../../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md) implementiert. Vor W01 werden Kurs-Commit, Modellartefakt, privater Inferenzhost, gemeinsamer Slot, Kill-Switch, Fallbacks und Tests praktisch bestätigt. Die Runtime allein belegt weder fertige Consumer-Funktionen noch Produktivfreigabe, Skalierbarkeit oder Modellqualität.

Vor der Kursfreigabe erhält [Technische_Quellen_ARSnova.md](./Technische_Quellen_ARSnova.md) dafür einen aktuellen Quellenblock mit Code-, Compose-, Konfigurations-, Test- und Messankern des Kurs-Commits. Solange dort nur `SRC-LLM-LLAMA-ZIELBILD` steht, belegt die Quellenkennung ausschließlich die Architekturentscheidung und keine Implementierung.

Die Fachbegriffe jeder Woche sind aktiver Mindestwortschatz. Studierende sollen sie nicht nur wiedergeben, sondern am Fall klassifizieren, anwenden, messen oder zur Begründung einer Entscheidung verwenden. Die Mini-Glossare der MC-Items dürfen weitere Begriffe ergänzen, ändern aber diesen Mindestwortschatz nicht.

## 3. Verbindlicher Ablauf jeder Woche

### 3.1 UE 1 und UE 2: 90-minütige LE

| Zeit  | Funktion                                                                  | Verbindliche ARSnova-Einbindung           |
| ----- | ------------------------------------------------------------------------- | ----------------------------------------- |
| 0–4   | Wochenfrage, Ziele, Datenhinweis und Zugang klären                        | noch keine Datenerhebung                  |
| 4–12  | Vorwissen und früheren Kernbegriff abrufen                                | L01 und L02                               |
| 12–22 | Begriffsmodell mit Primär- oder Repositoryquelle                          | keine neue Livefrage                      |
| 22–34 | Grenzfall, Peer-Erklärung und Fehlvorstellung                             | L03 und L04                               |
| 34–45 | ersten Repository-, Konfigurations- oder Quellenanker prüfen              | Quelle, Commit und offene Annahme sichern |
| 45–48 | Rollen, Agentenvertrag, Laborziel, Budget und Abbruchkriterium bestätigen | keine risikoreiche Ausführung ohne Gate   |
| 48–52 | Hypothese vor der Anwendung explizit machen                               | L05 als Vorhersage                        |
| 52–64 | Fallanalyse, Entwurf, Messung oder isolierte Laborarbeit                  | keine zusätzliche Livefrage               |
| 64–79 | Evidenz auswerten, Modell korrigieren und entscheiden                     | L06, L07 und L08                          |
| 79–88 | Methodenrückmeldung und nächste Lernhandlung                              | L09 und L10; keine Noteninterpretation    |
| 88–90 | Dossierertrag, offene Annahme und Selbststudium sichern                   | keine zusätzliche Livefrage               |

Der konkrete Inhalt dieser Zeitfenster steht in den Wochenabschnitten. Jede Woche verwendet jeden der zehn unterstützten Fragetypen genau einmal und ausschließlich `MEDIUM` oder `HARD`. Lesephase, persönlicher Zeitzuschlag und eine gleichwertige untimierte Alternative sind getrennte Schutzmechanismen. Der 60-Sekunden-Standardtimer wird nach Schwierigkeit skaliert. Lösungen bewertbarer Livefragen bleiben bis zum Schließen verborgen. Bei einer zweiten Peer-Instruction-Runde gilt die Effective-Vote-Regel aus dem [ARSnova-Blueprint](./ARSnova_Blueprint_12_Wochen.md#6-lösungsschutz-peer-instruction-und-effective-vote): Runde 2 ersetzt für die ganze Frage Runde 1; beide Runden werden nie addiert. Punkte, Rang, Geschwindigkeit, Teamstand, Boni und Reaktionen sind ausschließlich Spielsignale.

### 3.2 UE 3: 45-minütiger formativer MC-Test

| Zeit    | Handlung                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------- |
| 90–93   | Wechsel, Link und gleichwertige untimierte Fassung öffnen; Freiwilligkeit und `practice` nennen |
| 93–125  | genau 30 Wochen-Items bearbeiten; Sofortfeedback, Erklärungen und Mini-Glossare nutzen          |
| 125–135 | aggregierte Ergebnisse und Lösungen besprechen; mindestens zwei ergiebige Items erklären        |

Die 32 Minuten sind ein organisatorischer Planwert, kein technischer Countdown. `show_top5_public=false`; MC-Ergebnisse sind weder Prüfungsleistung noch Zulassungsvoraussetzung. Derselbe vollständige Satz wird nach zwei bis drei Tagen erneut bereitgestellt. Kernkonzepte werden nach zwei bis vier Wochen in neuem Kontext wieder aufgenommen.

Jede Wochen-Datei enthält genau zwölf mittlere Items mit `weight=2` und 18 schwere Items mit `weight=3`; leichte Items mit `weight=1` sind ausgeschlossen.

### 3.3 Gleichwertiger Zugang

Die Teilnahme an ARSnova und MC-Test ist freiwillig und ohne Notennachteil. Tablets und Laptops genügen für beide Werkzeuge. Repository-, Konfigurations-, Log- und Quellenanalysen erfolgen am Laptop oder mit einem gleichwertigen vorbereiteten Auszug. Jede zeitgebundene Aktivität besitzt einen fachlich gleichwertigen untimierten Weg. Tastaturbedienung, sichtbarer Fokus, Zoom und Reflow, Kontrast, Alternativtexte, Untertitelweg und reduzierte Bewegung werden nach Runbook und QA-Protokoll geprüft. Fachinformation wird nie ausschließlich über Farbe, Ton, Animation oder räumliche Anordnung vermittelt.

Automatische Pseudonyme sind keine Zusage vollständiger technischer Anonymität. Klarnamen, Secrets, Tokens, Produktionszugänge und nicht freigegebene personenbezogene Daten gehören nicht in Livefragen, MC-Test, Dossier, Agentenaufträge oder Laborartefakte. Daten und Kennungen der Werkzeuge werden nicht zu werkzeugübergreifenden Personen- oder Leistungsprofilen verbunden. LIVE-Daten dienen ausschließlich der Lehre und internen Qualitätssicherung, nicht individueller Bewertung, Forschung oder Publikation.

## 4. Übersicht der zwölf Wochen

| Woche | Typ              | 90-minütige LE                                             | Zielbezug                         | Dossierertrag                                                       |
| ----: | ---------------- | ---------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------- |
|   W01 | Präsenz/synchron | Cloud-Grundlagen, Modelle und Shared Responsibility        | QZ1, MZ1, LI01–LI03               | belegte Cloud-Klassifikation und Verantwortungsmatrix               |
|   W02 | Präsenz/synchron | Virtualisierung, Container, IaC und Netzwerk               | QZ2, MZ2, LI04–LI06               | Technologiematrix und Provisioning-Entwurf                          |
|   W03 | Tutorium         | arsnova.eu-Deployment, Härtung und Zustandsgrenzen         | QZ2, MZ2/MZ6, LI04–LI06, LI15     | Ist-Diagramm, Härtungs- und Zustandsnachweis                        |
|   W04 | Präsenz/synchron | Serverless Computing                                       | QZ3, MZ3, LI07–LI08               | Eignungsmatrix mit Kandidat, Gegenbeispiel und Gegenprobe           |
|   W05 | Präsenz/synchron | GCP, AWS und Microsoft Azure                               | QZ4, MZ4, LI09–LI11               | normalisierter Plattform- und Verantwortungsvergleich               |
|   W06 | Präsenz/synchron | Daten und maschinelles Lernen in der Cloud                 | QZ5, MZ5, LI12–LI14               | Datenfluss und vergleichbarer ML-Betriebsoptionen                   |
|   W07 | Tutorium         | Storage, Datenbanken, Backup und Recovery                  | QZ2, MZ6, LI15–LI16               | Zustands- und Recovery-Matrix mit Restore-Evidenz                   |
|   W08 | Tutorium         | Elastizität, Skalierung, Performance und verteilte Systeme | QZ2, MZ7, LI17–LI18               | Scale-out-Hürdenkarte und reproduzierbarer Messplan                 |
|   W09 | Präsenz/synchron | IAM, Security, Observability, SRE und Resilienz            | QZ2, MZ8, LI19–LI21               | Befund, Risiko, Maßnahme, Verifikation, Degradation und Restrisiko  |
|   W10 | Tutorium         | FinOps, Nachhaltigkeit und 6R                              | QZ1/QZ4/QZ5, MZ9, LI11, LI22–LI23 | TCO-Modell und ADR mit Alternative, Sensitivität und Exit           |
|   W11 | Tutorium         | Evidenzbasierte Architekturentscheidung und Referatsarbeit | QZ1–QZ5, MZ9, LI23–LI24           | Referatsthese, Quellenregister, Visualisierung und Gegenalternative |
|   W12 | Tutorium         | Synthese und Probeverteidigung                             | QZ1–QZ5, MZ9, LI24                | Probe, persönliche Korrekturliste und begrenzte Schlussaussage      |

Die Typzuordnung ergibt genau 18 UE Präsenz beziehungsweise synchron und 18 UE Tutorium.

## 5. W01 – Cloud-Grundlagen, Modelle und Shared Responsibility

**Wochenfrage:** Wann ist ein Dienst Cloud Computing, und welche Verantwortung verbleibt bei Betreiber, Anbieter und nutzender Organisation?

**Ziele:** QZ1 · MZ1 · LI01–LI03

**Fragensätze:** [ARSnova W01](./ARSnova_Woche_01.json) · [MC-Test W01](./MC-Test_Woche_01.json)

**Quellenanker:** [Technische Quellen](./Technische_Quellen_ARSnova.md) mit `SRC-CLOUD-IST` und `SRC-COMPOSE-PRODUKTION`; `SRC-LLM-LLAMA-ZIELBILD` und ADR-0035 dienen nur als Entscheidungskontext. Für den gelehrten 8.9d-Stand gilt ausschließlich das vor W01 geprüfte Implementierungs- und Testpaket des festgelegten Kurs-Commits. Externe Definitionsquelle: NIST-Publikation 800-145.

### Inhalte und erwartete Ergebnisse

- fünf beobachtbare Cloud-Merkmale von Hosting, Outsourcing und bloßer Virtualisierung abgrenzen;
- Dienstmodelle und Bereitstellungsmodelle getrennt klassifizieren;
- den belegten Single-Host-App-Pfad plus getrennten privaten 8.9d-Inferenzhost ohne Cloud-Marketingüberhöhung einordnen;
- Verantwortung, Nutzen, Risiko und offene Annahme in einer Matrix festhalten.

### Verbindlicher Fachwortschatz

| Begriff                                     | Arbeitsdefinition                                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloud Computing                             | bedarfsgerechter Netzzugriff auf einen gemeinsam nutzbaren Pool konfigurierbarer Ressourcen mit schneller Bereitstellung und messbarer Nutzung |
| On-demand Self-service                      | Nutzende können vereinbarte Ressourcen ohne einzelne manuelle Anbieterfreigabe anfordern                                                       |
| Broad Network Access                        | Fähigkeiten sind standardisiert über Netze und unterschiedliche Clientklassen erreichbar                                                       |
| Resource Pooling                            | Anbieterressourcen bedienen mehrere Bedarfe dynamisch, ohne feste exklusive Zuordnung jeder Ressource                                          |
| Rapid Elasticity                            | Kapazität kann dem Bedarf zeitnah folgen; ein großer Server allein ist noch nicht elastisch                                                    |
| Measured Service                            | Nutzung wird durch geeignete Messgrößen transparent erfasst und steuerbar gemacht                                                              |
| IaaS, PaaS, SaaS                            | Infrastructure, Platform und Software as a Service mit jeweils anderer Verantwortungsgrenze                                                    |
| Public, Private, Community und Hybrid Cloud | die vier NIST-Bereitstellungsmodelle nach Nutzungsgruppe und Kopplung eigenständiger Cloud-Infrastrukturen                                     |
| Multi-Cloud                                 | anbieterübergreifende Strategie mit Diensten mehrerer Cloud-Anbieter; kein fünftes NIST-Bereitstellungsmodell                                  |
| Hosting                                     | Betrieb einer Anwendung auf fremder oder eigener Infrastruktur, ohne dadurch automatisch alle Cloud-Merkmale zu erfüllen                       |
| Shared Responsibility                       | Aufteilung von Schutz-, Betriebs- und Compliance-Aufgaben zwischen Anbieter und Kunde                                                          |

### UE 1 und UE 2

| Zeit  | Inhalt und Lernhandlung                                                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–12  | Kursrahmen und Wochenfrage klären; L01/L02 zu Cloudmerkmalen und Hosting bearbeiten                                                            |
| 12–22 | NIST-Merkmale und die zwei unabhängigen Modellachsen Dienstmodell/Bereitstellungsmodell aufbauen                                               |
| 22–34 | L03/L04: Grenzfälle klassifizieren und stärkste Fehlannahme in Peer-Erklärung korrigieren                                                      |
| 34–45 | `SRC-CLOUD-IST` und Produktions-Compose prüfen; implementierten Single-Host-App-Stack von Zielbildern und getrenntem 8.9d-Inferenzhost trennen |
| 45–48 | Rollen, Agentenvertrag, Laborziel, Budget und Abbruchkriterium für den Wochenfall bestätigen                                                   |
| 48–52 | L05 als Vorhersage zur Cloud- und Verantwortungszuordnung beantworten                                                                          |
| 52–64 | für App- und Inferenz-Tier eine Cloud- und Verantwortungsmatrix erstellen                                                                      |
| 64–79 | L06–L08 auswerten; Klassifikation mit Gegenfall, Nutzen, Risiko und offener Annahme verteidigen                                                |
| 79–90 | L09/L10 sowie Dossierertrag sichern; keine Rang- oder Antwortzeit als Kompetenz interpretieren                                                 |

### UE 3, Lernprodukt und Selbststudium

UE 3 verwendet den MC-Test W01. In der Lösungsbesprechung werden mindestens ein Hosting-Cloud-Grenzfall und ein Shared-Responsibility-Fehler vollständig erklärt.

**Lernprodukt:** eine Seite mit belegter Cloud-Klassifikation von arsnova.eu, Verantwortungsmatrix, Gegenfall und Aussagegrenze.

**Selbststudium:** Originaldefinition prüfen, Zitate und Repositorybelege verifizieren, Einordnung überarbeiten; vollständiger Wiederabruf nach zwei bis drei Tagen und neuer Modellfall nach zwei bis vier Wochen.

## 6. W02 – Virtualisierung, Container, IaC und Netzwerk

**Wochenfrage:** Welche Abstraktionen und Netzgrenzen machen eine Cloud-Bereitstellung reproduzierbar und überprüfbar?

**Ziele:** QZ2 · MZ2 · LI04–LI06

**Fragensätze:** [ARSnova W02](./ARSnova_Woche_02.json) · [MC-Test W02](./MC-Test_Woche_02.json)

**Quellenanker:** [Technische Quellen](./Technische_Quellen_ARSnova.md) mit `SRC-CONTAINER-IMAGE`, `SRC-COMPOSE-PRODUKTION`, `SRC-EDGE-NGINX-TLS`, `SRC-BACKEND-EINSTIEG`, `SRC-WEBSOCKET-TRPC` und `SRC-WEBSOCKET-YJS`.

### Inhalte und erwartete Ergebnisse

- virtuelle Maschine, Image, Container, Compose, Orchestrierung und IaC unterscheiden;
- Browser-, Edge-, App-, Daten- und Realtime-Pfade nachvollziehen;
- Netzwerk-, Vertrauens-, Schnittstellen- und Zustandsgrenzen markieren;
- einen reproduzierbaren, begrenzten Provisioning-Entwurf formulieren.

### Verbindlicher Fachwortschatz

| Begriff                        | Arbeitsdefinition                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Hypervisor                     | Schicht, die virtuelle Maschinen auf physischer Hardware ausführt und voneinander isoliert         |
| virtuelle Maschine (VM)        | virtualisierte Recheneinheit mit eigenem Gastbetriebssystem und zugewiesenen Ressourcen            |
| Image                          | unveränderliche Vorlage für VM oder Container; Laufzeitzustand gehört nicht automatisch zum Image  |
| Container                      | isolierter Prozessraum, der den Kernel des Hosts mit anderen Containern teilt                      |
| Isolation                      | technische Begrenzung von Ressourcen, Rechten, Prozessen oder Netzwerkzugriffen zwischen Einheiten |
| Docker Compose                 | deklarative Beschreibung mehrerer Container und ihrer lokalen Laufzeitbeziehungen                  |
| Orchestrierung                 | automatisierte Platzierung, Skalierung, Aktualisierung und Wiederherstellung verteilter Workloads  |
| Infrastructure as Code (IaC)   | versionierte, automatisierbare Beschreibung von Infrastruktur und Konfiguration                    |
| Domain Name System (DNS)       | Namensauflösung von Diensten auf erreichbare Netzadressen                                          |
| Transport Layer Security (TLS) | Schutz von Transportverbindungen durch Authentisierung und Verschlüsselung                         |
| Load Balancer                  | verteilt Anfragen nach einer definierten Strategie auf mehrere geeignete Ziele                     |
| WebSocket                      | langlebige bidirektionale Verbindung zwischen Client und Server                                    |

### UE 1 und UE 2

| Zeit  | Inhalt und Lernhandlung                                                                             |
| ----- | --------------------------------------------------------------------------------------------------- |
| 0–12  | L01/L02: Abstraktionsebenen und Cloudmerkmale aus W01 abrufen                                       |
| 12–22 | VM, Container, Image, Compose, Orchestrierung und IaC in einem Schichtenmodell ordnen               |
| 22–34 | L03/L04 zu Isolation, Storage- und Netzwerkentscheidungen mit Peer-Begründung bearbeiten            |
| 34–45 | Dockerfile, Produktions-Compose und Nginx-/WebSocket-Pfade an Quellenankern nachvollziehen          |
| 45–48 | Rollen, Agentenvertrag, Laborziel, Budget und Abbruchkriterium für den Provisioning-Fall bestätigen |
| 48–52 | L05 als Vorhersage zum Provisioning-Entwurf beantworten                                             |
| 52–64 | Provisioning-Entwurf mit Compute, Storage, DNS, TLS, Firewall und privaten Diensten erstellen       |
| 64–79 | L06–L08: Reihenfolge, Netzwerkgrenze und Scale-out-Hürde anhand des Entwurfs korrigieren            |
| 79–90 | L09/L10 und offene Annahmen sichern; Rechte-, Budget-, Abbruch- und Cleanup-Grenze festhalten       |

### UE 3, Lernprodukt und Selbststudium

UE 3 verwendet den MC-Test W02. Besprochen werden mindestens ein Container-VM-Irrtum und ein Netzwerk- oder Vertrauensgrenzenfall.

**Lernprodukt:** Technologiematrix plus versionierter Provisioning-Entwurf mit Fähigkeit, Verantwortung, Risiko und Gegenalternative.

**Selbststudium:** einen Browser-zu-App-zu-Daten-Pfad anhand der Repositoryquellen zeichnen, jeden Übergang belegen und den Entwurf adversarial gegenprüfen.

## 7. W03 – arsnova.eu-Deployment, Härtung und Zustandsgrenzen

**Wochenfrage:** Welche Aussagen über Deployment, Härtung und Zustand sind im Kurs-Commit tatsächlich implementiert oder überprüft?

**Ziele:** QZ2 · MZ2/MZ6 · LI04–LI06 und LI15

**Fragensätze:** [ARSnova W03](./ARSnova_Woche_03.json) · [MC-Test W03](./MC-Test_Woche_03.json)

**Quellenanker:** [Technische Quellen](./Technische_Quellen_ARSnova.md) mit `SRC-COMPOSE-PRODUKTION`, `SRC-SECURITY-UEBERBLICK`, `SRC-SECURITY-AUTORISIERUNG`, `SRC-DATENMODELL-PRISMA`, `SRC-REDIS-CLIENT`, `SRC-LOCALFIRST-ARCHITEKTUR`, `SRC-PDF-WORKER-COMPOSE` und der am Kursstart ergänzten 8.9d-Implementierungsevidenz.

### Inhalte und erwartete Ergebnisse

- Zwei-Tier-Topologie mit App-Host für Reverse Proxy, App, PostgreSQL, Redis und PDF-Worker sowie getrenntem privatem 8.9d-Inferenzhost ohne öffentlichen Modellport belegen;
- persistente, flüchtige und lokale Zustände unterscheiden;
- Härtungsmaßnahmen nicht mit ihrer erfolgreichen Verifikation verwechseln;
- Rollback, Neuaufbau und offene Scale-out-Hürden kennzeichnen.

### Verbindlicher Fachwortschatz

| Begriff                | Arbeitsdefinition                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Reverse Proxy          | vorgeschalteter Dienst, der externe Anfragen an interne Zielprozesse weiterleitet                    |
| Single-Host-Deployment | mehrere Laufzeitkomponenten teilen einen physischen oder virtuellen Host und damit eine Fehlerdomäne |
| Trust Boundary         | Grenze, an der sich Vertrauensniveau, Identität oder Kontrollverantwortung ändert                    |
| persistent             | Zustand übersteht den Neustart des verarbeitenden Prozesses in einem vorgesehenen Speicher           |
| flüchtig               | Zustand darf oder kann bei Neustart beziehungsweise Ablauf verloren gehen                            |
| lokal                  | Zustand liegt ausschließlich auf einem bestimmten Client oder Gerät                                  |
| Hardening              | Verringerung der Angriffsfläche durch minimale Rechte, Dienste, Ports und sichere Konfiguration      |
| Least Privilege        | jede Identität erhält nur die für Aufgabe und Zeitraum notwendigen Rechte                            |
| Secret                 | schützenswerter Authentisierungswert, der weder Quellcode noch URL oder Log offen erscheinen darf    |
| Idempotenz             | wiederholte Ausführung erzeugt nach dem ersten Erfolg keinen unerwünschten zusätzlichen Effekt       |
| Rollback               | kontrollierte Rückkehr zu einem zuvor funktionsfähigen Stand                                         |
| Healthcheck            | begrenzte technische Prüfung, ob ein Dienst für seinen vorgesehenen Zweck erreichbar oder bereit ist |

### UE 1 und UE 2

| Zeit  | Inhalt und Lernhandlung                                                                            |
| ----- | -------------------------------------------------------------------------------------------------- |
| 0–12  | L01/L02: Containergrenze, Hostkernel und Zustandsklassen aus W02 abrufen                           |
| 12–22 | Anfrage-, Zustands- und Vertrauenspfad der belegten und der 8.9d-erweiterten Topologie modellieren |
| 22–34 | L03/L04: Härtungs- und Zustandsgrenzen an konkreten Fehlerfällen diskutieren                       |
| 34–45 | Compose-, Security-, Prisma-, Redis- und PDF-Worker-Quellen mit Evidenzstufe prüfen                |
| 45–48 | Rollen, Agentenvertrag, Laborziel, Budget und Abbruchkriterium für den Härtungsfall bestätigen     |
| 48–52 | L05 als Vorhersage zum Härtungs- oder Rebuild-Ergebnis beantworten                                 |
| 52–64 | isolierten Härtungs- oder Rebuild-Schritt planen beziehungsweise kontrolliert ausführen            |
| 64–79 | L06–L08: Ergebnis, False Positive, Rollback und verbleibende Scale-out-Hürde beurteilen            |
| 79–90 | L09/L10 sowie Ist-Diagramm, Zustandslegende und offene Annahme im Dossier sichern                  |

### UE 3, Lernprodukt und Selbststudium

UE 3 verwendet den MC-Test W03. Besprochen werden mindestens ein falscher Sicherheitsnachweis und eine Verwechslung von persistentem, flüchtigem und lokalem Zustand.

**Lernprodukt:** belegtes Ist-/Kursstart-Diagramm, Härtungsnachweis und Zustandsmatrix mit Evidenz- und Gültigkeitsgrenzen.

**Selbststudium:** einen zweiten Prüfpfad auf Konfiguration und Zustandsorte anwenden, widersprüchliche Befunde klären und Neuaufbau oder Rollback nachvollziehbar dokumentieren.

## 8. W04 – Serverless Computing

**Wochenfrage:** Welche ARSnova-Arbeitslast eignet sich für Serverless, und welcher Gegenfall widerlegt eine zu breite Empfehlung?

**Ziele:** QZ3 · MZ3 · LI07–LI08

**Fragensätze:** [ARSnova W04](./ARSnova_Woche_04.json) · [MC-Test W04](./MC-Test_Woche_04.json)

**Quellenanker:** [Technische Quellen](./Technische_Quellen_ARSnova.md) mit `SRC-PDF-WORKER-CODE`, `SRC-PDF-WORKER-COMPOSE`, `SRC-WEBSOCKET-TRPC`, `SRC-WEBSOCKET-YJS` und `SRC-CLOUD-6R`; zusätzlich aktuelle Funktions-, Limit- und Preisquellen des betrachteten Providers.

### Inhalte und erwartete Ergebnisse

- FaaS, BaaS, Container-Job, Queue-Worker und dauerhaften Dienst symmetrisch vergleichen;
- Kandidaten nach Trigger, Zustand, Dauer, Parallelität, Cold Start, Beobachtbarkeit und Kosten prüfen;
- mindestens einen geeigneten und einen ungeeigneten ARSnova-Fall kontrastieren;
- eine Serverless-Entscheidung durch Gegenprobe und Exit-Betrachtung begrenzen.

### Verbindlicher Fachwortschatz

| Begriff                      | Arbeitsdefinition                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Serverless Computing         | Betriebsmodell, bei dem der Anbieter wesentliche Serverbereitstellung und Skalierung abstrahiert; Anwendungen bleiben dennoch verantwortlich |
| Function as a Service (FaaS) | ereignisgesteuerte Ausführung kurzlebiger Funktionen mit providerverwalteter Laufzeit                                                        |
| Backend as a Service (BaaS)  | verwaltete Backend-Fähigkeit wie Datenhaltung, Identität oder Messaging                                                                      |
| Trigger                      | Ereignis oder Zeitplan, der eine Ausführung startet                                                                                          |
| Statelessness                | eine Ausführungsinstanz setzt keinen dauerhaft lokalen Zustand zwischen Aufrufen voraus                                                      |
| Cold Start                   | zusätzliche Startlatenz, wenn zunächst eine neue Laufzeitinstanz bereitgestellt werden muss                                                  |
| Laufzeitgrenze               | maximale oder praktisch sinnvolle Dauer einer einzelnen Ausführung                                                                           |
| Autoscaling                  | automatische Anpassung der Zahl oder Größe von Ausführungsressourcen an Messsignale                                                          |
| Pay-per-use                  | Abrechnung nach definierter Nutzungseinheit statt ausschließlich nach dauerhaft reservierter Kapazität                                       |
| Retry                        | erneute Ausführung nach einem Fehler; ohne Idempotenz kann sie Doppelwirkungen erzeugen                                                      |
| Vendor Lock-in               | Wechselkosten oder technische Bindung an anbieterspezifische Schnittstellen und Betriebsmodelle                                              |
| Break-even                   | Nutzungspunkt, an dem zwei Kostenoptionen den gleichen modellierten Gesamtwert erreichen                                                     |

### UE 1 und UE 2

| Zeit  | Inhalt und Lernhandlung                                                                         |
| ----- | ----------------------------------------------------------------------------------------------- |
| 0–12  | L01/L02: Zustand, Worker und Cloud-Verantwortung aus W02/W03 abrufen                            |
| 12–22 | Serverless, FaaS/BaaS sowie Function, Container, Job und Dienst begrifflich abgrenzen           |
| 22–34 | L03/L04: Kandidat und Gegenbeispiel nach Laufzeit, Zustand und Cold Start bewerten              |
| 34–45 | PDF-Worker- und Realtime-Quellen prüfen; Providerlimit nur mit datierter Primärquelle verwenden |
| 45–48 | Rollen, Agentenvertrag, Laborziel, Budget und Abbruchkriterium für die Gegenprobe bestätigen    |
| 48–52 | L05 als Vorhersage zur Serverless-Eignung beantworten                                           |
| 52–64 | einen Kandidaten als Emulatorlauf, Dry-Run oder budgetierte Sandbox-Gegenprobe untersuchen      |
| 64–79 | L06–L08: Trigger, Retry, Observability, Kosten und Lock-in zur Entscheidung verbinden           |
| 79–90 | L09/L10, Eignungsmatrix, stärkstes Gegenargument und offene Preisannahme sichern                |

### UE 3, Lernprodukt und Selbststudium

UE 3 verwendet den MC-Test W04. Besprochen werden mindestens ein Cold-Start-/Zustandsfall und ein Kosten- oder Lock-in-Fall.

**Lernprodukt:** Serverless-Eignungsmatrix für einen geeigneten und einen ungeeigneten Kandidaten mit Testevidenz, Gegenargument und Exit.

**Selbststudium:** zwei Kandidaten gegeneinander verteidigen lassen, Primärquellen und Kostenannahmen prüfen und die eigene Entscheidung auf eine klar benannte Systemgrenze begrenzen.

## 9. W05 – GCP, AWS und Microsoft Azure

**Wochenfrage:** Wie lassen sich drei Cloud-Plattformen vergleichen, ohne Produktnamen, Regionen, Verantwortungen und Preise asymmetrisch zu behandeln?

**Ziele:** QZ4 · MZ4 · LI09–LI11

**Fragensätze:** [ARSnova W05](./ARSnova_Woche_05.json) · [MC-Test W05](./MC-Test_Woche_05.json)

**Quellenanker:** [Technische Quellen](./Technische_Quellen_ARSnova.md) mit `SRC-CLOUD-PROVIDER`, `SRC-CLOUD-IST`, `SRC-CLOUD-KOSTEN` und `SRC-CLOUD-OPENSTACK`; dazu datierte offizielle Service-, Regionen-, Verantwortungs- und Preisquellen von GCP, AWS und Azure.

### Inhalte und erwartete Ergebnisse

- Produktnamen zunächst auf neutrale Fähigkeiten abbilden;
- Konto-, Identitäts-, Regions-, Netzwerk-, Compute-, Storage-, Datenbank- und Observability-Modelle vergleichen;
- Datenresidenz, Egress, Kostenbasis, Lock-in und Exit auf derselben Systemgrenze prüfen;
- eine Plattformoption mit Primärquellen und stärkster Gegenalternative vertreten.

### Verbindlicher Fachwortschatz

| Begriff                                              | Arbeitsdefinition                                                                                                       |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Capability Mapping                                   | Normalisierung unterschiedlicher Produktnamen auf dieselbe benötigte Fähigkeit                                          |
| Account, Project und Subscription                    | oberste Verwaltungs- und Abrechnungscontainer von AWS, GCP beziehungsweise Azure                                        |
| Region                                               | geographisch definierter Bereitstellungsraum eines Cloud-Anbieters                                                      |
| Availability Zone                                    | getrennte Infrastrukturzone innerhalb einer Region; genaue Eigenschaften sind providerabhängig                          |
| Virtual Private Cloud (VPC) / Virtual Network (VNet) | logisch isolierter Netzwerkbereich bei GCP/AWS beziehungsweise Azure                                                    |
| Managed Service                                      | Dienst, bei dem der Anbieter festgelegte Betriebsaufgaben übernimmt und andere beim Kunden verbleiben                   |
| Managed Database                                     | verwalteter Datenbankdienst mit definierter Verantwortung für Betrieb, Updates, Backup oder Verfügbarkeit               |
| Identity and Access Management (IAM)                 | Verwaltung von Identitäten, Rollen, Richtlinien und Zugriffsentscheidungen                                              |
| Data Residency                                       | Anforderung oder Eigenschaft, in welcher Region beziehungsweise Rechtsordnung Daten gespeichert oder verarbeitet werden |
| Egress                                               | aus einer Provider- oder Regionsgrenze ausgehender Datenverkehr, der technische und finanzielle Folgen haben kann       |
| Preiseinheit                                         | konkrete Abrechnungsbasis wie Sekunde, Anfrage, Gigabyte-Monat oder ausgehendes Gigabyte                                |
| Exit                                                 | geplanter Weg, Daten, Konfiguration und Betrieb aus einem Dienst oder Provider herauszulösen                            |

### UE 1 und UE 2

| Zeit  | Inhalt und Lernhandlung                                                                      |
| ----- | -------------------------------------------------------------------------------------------- |
| 0–12  | L01/L02: Dienstmodell, Region und Shared Responsibility aus W01/W04 abrufen                  |
| 12–22 | neutrales Capability-Raster vor der Nennung konkreter Providerprodukte erstellen             |
| 22–34 | L03/L04: asymmetrische Vergleiche und fehlende Preis-/Regionsangaben diagnostizieren         |
| 34–45 | je Plattform eine volatile Aussage an offizieller Primärquelle mit Datum und Region prüfen   |
| 45–48 | Rollen, Agentenvertrag, Recherchegrenze, Kostenlimit und Abbruchkriterium bestätigen         |
| 48–52 | L05 als Vorhersage zur Provideroption beantworten                                            |
| 52–64 | dieselbe ARSnova-Fähigkeit auf GCP, AWS und Azure abbilden                                   |
| 64–79 | L06–L08: Verantwortung, Residenz, Egress, Lock-in und Exit zur Auswahlentscheidung verbinden |
| 79–90 | L09/L10 sowie Quellenblatt und stärkste Gegenalternative im Dossier sichern                  |

### UE 3, Lernprodukt und Selbststudium

UE 3 verwendet den MC-Test W05. Besprochen werden mindestens ein Capability-Mapping-Fehler und ein Fall mit fehlender Region, Preiseinheit oder Verantwortungsangabe.

**Lernprodukt:** normalisierter Dreiplattformvergleich mit Primärquelle, Abrufdatum, Region, Verantwortungsgrenze, Kostenannahme und Exit.

**Selbststudium:** pro Plattform mindestens zwei volatile Angaben erneut prüfen und dokumentieren, warum Produktähnlichkeit noch keine funktionale oder wirtschaftliche Gleichwertigkeit beweist.

## 10. W06 – Daten und maschinelles Lernen in der Cloud

**Wochenfrage:** Welche Daten- und ML-Pipeline liefert für arsnova.eu einen reproduzierbaren Nutzen, ohne Datenschutz-, Betriebs- und Kostenfolgen auszublenden?

**Ziele:** QZ5 · MZ5 · LI12–LI14

**Fragensätze:** [ARSnova W06](./ARSnova_Woche_06.json) · [MC-Test W06](./MC-Test_Woche_06.json)

**Quellenanker:** [Technische Quellen](./Technische_Quellen_ARSnova.md) mit `SRC-ML-LEXIKALISCHE-WORTWOLKE`, `SRC-ML-SPACY`, `SRC-ML-SEMANTISCHE-THEMEN`, `SRC-ML-QA-KASKADE`, `SRC-ML-QA-SUMMARY`, `SRC-ML-FEATURE-FLAGS` und der am Kursstart nachzuweisenden 8.9d-Implementierung.

### Inhalte und erwartete Ergebnisse

- Aufnahme, Speicherung, Batch-/Stream-Verarbeitung, Modellschritt, Bereitstellung, Monitoring und Fallback modellieren;
- lexikalische, spaCy-, Encoder-/Clustering-, lokale LLM- und Managed-ML-Optionen auf derselben Datenbasis vergleichen;
- Dateninventar, Zweck, Zugriff, Region, Aufbewahrung, Löschung und Export prüfen;
- implementierten Pfad, deaktivierte Option, Laborbefund und Zielbild korrekt kennzeichnen.

### Verbindlicher Fachwortschatz

| Begriff                                                         | Arbeitsdefinition                                                                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Batch-Verarbeitung                                              | Verarbeitung einer abgegrenzten Datenmenge zu festgelegten Zeitpunkten                                                     |
| Stream-Verarbeitung                                             | fortlaufende Verarbeitung eintreffender Ereignisse mit begrenzter Verzögerung                                              |
| Extract, Transform, Load (ETL) / Extract, Load, Transform (ELT) | Reihenfolgen für Extraktion, Umformung und Laden von Daten                                                                 |
| Datenpipeline                                                   | nachvollziehbare Kette von Aufnahme, Prüfung, Verarbeitung, Speicherung und Bereitstellung                                 |
| Embedding                                                       | numerische Vektordarstellung eines Objekts, in der ausgewählte Ähnlichkeiten abgebildet werden                             |
| Clustering                                                      | Gruppierung von Datenpunkten nach einem festgelegten Ähnlichkeits- oder Distanzverfahren                                   |
| Inferenz                                                        | Anwendung eines trainierten Modells auf neue Eingaben                                                                      |
| Open-Weight-Modell                                              | Modell mit zugänglichen Gewichtsdateien; Lizenz, Trainingsdaten und vollständige Offenheit folgen daraus nicht automatisch |
| Large Language Model (LLM)                                      | großes Sprachmodell zur Verarbeitung oder Erzeugung sprachlicher Ausgaben                                                  |
| Model Serving                                                   | kontrollierte Bereitstellung eines Modells über eine Laufzeitschnittstelle                                                 |
| Machine Learning Operations (MLOps)                             | Praktiken für Versionierung, Auslieferung, Monitoring und kontrollierte Änderung von ML-Systemen                           |
| Fallback                                                        | fachlich definierter Ersatzpfad, wenn ein optionaler Modell- oder Inferenzschritt ausfällt                                 |

### UE 1 und UE 2

| Zeit  | Inhalt und Lernhandlung                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–12  | L01/L02: Provider-, Daten- und Verantwortungsgrenzen aus W05 abrufen                                                                                                            |
| 12–22 | Batch/Stream, ETL/ELT, Embedding, Clustering, Inferenz und Fallback in einer Pipeline ordnen                                                                                    |
| 22–34 | L03/L04: Datenschutz-, Qualitäts- und Betriebsgrenzen konkurrierender ML-Optionen diskutieren                                                                                   |
| 34–45 | lexikalischen, spaCy-, Encoder-, 8.9b- und Summary-Slices-1–3-Stand sowie separat die 8.9d-Runtime an Code, Flags und Tests prüfen; generative Consumer nur mit eigener Evidenz |
| 45–48 | Rollen, Agentenvertrag, Datenfreigabe, Laborziel, Budget und Abbruchkriterium bestätigen                                                                                        |
| 48–52 | L05 als Vorhersage zur Daten- oder ML-Option beantworten                                                                                                                        |
| 52–64 | minimierten Datenfluss und zwei vergleichbare Betriebsoptionen entwerfen                                                                                                        |
| 64–79 | L06–L08: Qualität, Reproduzierbarkeit, Latenz, Ressourcen, Privacy und Kosten abwägen                                                                                           |
| 79–90 | L09/L10, Dateninventar, Modell-/Runtimeversion, Fallback und Aussagegrenze sichern                                                                                              |

### UE 3, Lernprodukt und Selbststudium

UE 3 verwendet den MC-Test W06. Besprochen werden mindestens ein Pipeline-/Datenflussfehler und ein unzulässiger Schluss von lokaler Modellverfügbarkeit auf Datenschutz oder Qualität.

**Lernprodukt:** versionierter Daten- und Dienstfluss mit Dateninventar sowie Vergleich mindestens zweier ML-Betriebsoptionen auf gleicher Messbasis.

**Selbststudium:** Varianten mit demselben synthetischen Seed-Set vergleichen, Modell-, Daten- und Laufzeitversionen festhalten und widersprüchliche Qualitäts-, Privacy- und FinOps-Bewertungen begründet auflösen.

## 11. W07 – Storage, Datenbanken, Backup und Recovery

**Wochenfrage:** Welche Zustände müssen gesichert werden, und welche Recovery-Aussage trägt ein tatsächlich ausgeführter Restore?

**Ziele:** QZ2 · MZ6 · LI15–LI16

**Fragensätze:** [ARSnova W07](./ARSnova_Woche_07.json) · [MC-Test W07](./MC-Test_Woche_07.json)

**Quellenanker:** [Technische Quellen](./Technische_Quellen_ARSnova.md) mit `SRC-DATENMODELL-PRISMA`, `SRC-REDIS-PERSISTENZ`, `SRC-REDIS-YJS-CAPABILITIES`, `SRC-LOCALFIRST-STORE`, `SRC-BACKUP-RUNBOOK`, `SRC-BACKUP-CODE` und `SRC-BACKUP-ABNAHME`.

### Inhalte und erwartete Ergebnisse

- PostgreSQL, Redis, Yjs/IndexedDB, Exporte, Konfiguration und Modellartefakte nach Zustandsklasse und Owner ordnen; Modellartefakte liegen außerhalb des belegten Restic-Offsite-Umfangs und benötigen einen eigenen Versionierungs- und Wiederbeschaffungsweg;
- Backup, Snapshot, Replikation und Restore unterscheiden;
- RPO, RTO, Integrität und Idempotenz als prüfbare Kriterien formulieren;
- datierte historische Abnahme von aktueller Wiederherstellbarkeit trennen.

### Verbindlicher Fachwortschatz

| Begriff                        | Arbeitsdefinition                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Block Storage                  | Speicher, der rohe Blöcke für Dateisysteme oder Datenbanken bereitstellt                                                    |
| File Storage                   | hierarchischer, dateibasierter Speicher, der über ein Dateisystemprotokoll zugänglich ist                                   |
| Object Storage                 | objektbasierter Speicher mit Schlüssel, Metadaten und eigener Zugriffsschnittstelle                                         |
| Transaktion                    | logisch zusammengehörige Datenbankoperationen mit definierten Konsistenzeigenschaften                                       |
| Cache                          | beschleunigende Kopie oder Hilfsstruktur, deren Verlust je nach Vertrag tolerierbar sein kann                               |
| Snapshot                       | punktbezogene Abbildung eines Zustands; sie ist erst mit Aufbewahrung und Restoreprüfung ein belastbarer Sicherungsbaustein |
| Backup                         | getrennt aufbewahrte Sicherung, aus der definierte Daten wiederhergestellt werden sollen                                    |
| Offsite Backup                 | Sicherung außerhalb derselben maßgeblichen Fehlerdomäne wie das Primärsystem                                                |
| Restore                        | technische Rücküberführung gesicherter Daten in eine nutzbare Zielumgebung                                                  |
| Recovery Point Objective (RPO) | maximal tolerierter Zeitraum verlorener Änderungen                                                                          |
| Recovery Time Objective (RTO)  | angestrebte Zeit bis zur Wiederherstellung der vereinbarten Funktion                                                        |
| Integrität                     | Nachweis, dass wiederhergestellte Daten und Beziehungen vollständig und unverfälscht sind                                   |

### UE 1 und UE 2

| Zeit  | Inhalt und Lernhandlung                                                                           |
| ----- | ------------------------------------------------------------------------------------------------- |
| 0–12  | L01/L02: persistenten, flüchtigen und lokalen Zustand aus W03 abrufen                             |
| 12–22 | Storagearten, Datenbankzustand, Cache, Snapshot, Backup und Restore abgrenzen                     |
| 22–34 | L03/L04: RPO/RTO- und Integritätsfehler an realistischen Ausfällen analysieren                    |
| 34–45 | Prisma-, Redis-, Local-First- und Backupquellen auf Sicherungsumfang und Aussagegrenze prüfen     |
| 45–48 | Rollen, Agentenvertrag, Restore-Ziel, Datenfreigabe und Abbruchkriterium bestätigen               |
| 48–52 | L05 als Vorhersage zu Datenverlust, Dauer oder Integrität beantworten                             |
| 52–64 | vorbereiteten Restore in isolierter Zielumgebung ausführen oder dessen Rohprotokoll reproduzieren |
| 64–79 | L06–L08: Zeit, Verlust, Integrität, Idempotenz und Kosten gegen Zielwerte prüfen                  |
| 79–90 | L09/L10 sowie Zustands-/Owner-Matrix und nicht gesicherte Bereiche festhalten                     |

### UE 3, Lernprodukt und Selbststudium

UE 3 verwendet den MC-Test W07. Besprochen werden mindestens ein RPO/RTO-Irrtum und ein Fall, in dem ein vorhandenes Backup keinen erfolgreichen Restore belegt.

**Lernprodukt:** Zustands- und Recovery-Matrix mit Owner, RPO, RTO, Restore-Messwert, Integritätsprüfung, Kosten und Gültigkeitsgrenze.

**Selbststudium:** Recoveryablauf wiederholen oder anhand freigegebener Artefakte unabhängig prüfen, Abweichungen erklären und den automatisierten Neuaufbau korrigieren.

## 12. W08 – Elastizität, Skalierung, Performance und verteilte Systeme

**Wochenfrage:** Welche Architektur- und Messfolgen unterscheiden viele kleine Sessions von einem einzelnen großen Fan-out-Hotspot?

**Ziele:** QZ2 · MZ7 · LI17–LI18

**Fragensätze:** [ARSnova W08](./ARSnova_Woche_08.json) · [MC-Test W08](./MC-Test_Woche_08.json)

**Quellenanker:** [Technische Quellen](./Technische_Quellen_ARSnova.md) mit `SRC-LAST-HARNESS`, `SRC-LAST-LOKAL-2026-07-12`, `SRC-LAST-PRODUKTION-2026-05-09`, `SRC-LAST-FORMALER-ZIELHOST`, `SRC-WEBSOCKET-TRPC`, `SRC-WEBSOCKET-YJS` und `SRC-RATELIMIT-WEBSOCKET`.

### Inhalte und erwartete Ergebnisse

- Elastizität, Scale-up, Scale-out, Queueing, Backpressure, Affinität und verteilten Zustand unterscheiden;
- Workloads `100 × 50` und `1 × 5.000` getrennt modellieren;
- p50/p95/p99, Durchsatz, Fehlerrate und Sättigung korrekt interpretieren;
- historische Produktion, lokale Verifikation und nicht getestetes Zielbild sauber trennen.

### Verbindlicher Fachwortschatz

| Begriff            | Arbeitsdefinition                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| Elastizität        | Fähigkeit, bereitgestellte Kapazität dem Bedarf zeitnah nach oben und unten anzupassen                  |
| Scale-up           | Erhöhung der Ressourcen einer bestehenden Instanz                                                       |
| Scale-out          | Verteilung einer Last auf zusätzliche Instanzen                                                         |
| Queueing           | kontrolliertes Puffern von Aufträgen, wenn Ankunft und Verarbeitung zeitlich auseinanderliegen          |
| Backpressure       | Rückmeldung oder Begrenzung, wenn nachgelagerte Verarbeitung keine weitere Last sicher aufnehmen kann   |
| Affinität          | Bindung von Anfragen oder Verbindungen an eine bestimmte Instanz                                        |
| verteilter Zustand | Zustand, dessen Konsistenz und Zuständigkeit über mehrere Prozesse oder Hosts koordiniert werden muss   |
| Durchsatz          | Anzahl erfolgreich verarbeiteter Einheiten pro Zeit                                                     |
| Latenz             | Zeit vom definierten Start- bis zum Endereignis einer Operation                                         |
| p50, p95 und p99   | Perzentile, unter denen 50, 95 beziehungsweise 99 Prozent der Messwerte liegen                          |
| Sättigung          | Ausmaß, in dem eine begrenzende Ressource ausgelastet oder eine Queue gefüllt ist                       |
| Workloadmodell     | präzise Beschreibung von Akteuren, Aktionen, Raten, Datenmengen, Dauer und Parallelität eines Lastfalls |

### UE 1 und UE 2

| Zeit  | Inhalt und Lernhandlung                                                                |
| ----- | -------------------------------------------------------------------------------------- |
| 0–12  | L01/L02: Elastizität und Zustandsgrenzen aus W01/W07 abrufen                           |
| 12–22 | Scale-up/out, Queueing, Backpressure, Affinität und Messperzentile modellieren         |
| 22–34 | L03/L04: zwei Lastprofile und plausible, aber falsche Kapazitätsschlüsse kontrastieren |
| 34–45 | lokale Baseline, historischen Produktions-Join und offene Zielhostabnahme vergleichen  |
| 45–48 | Rollen, Agentenvertrag, Workload, Budget und sicheres Abbruchkriterium bestätigen      |
| 48–52 | L05 als Vorhersage zum Mess- oder Fehlerergebnis beantworten                           |
| 52–64 | begrenzten Mess- oder Fehlerplan erstellen beziehungsweise ausführen                   |
| 64–79 | L06–L08: Rohdaten, Wiederholung, Sättigung und Scale-out-Hürden auswerten              |
| 79–90 | L09/L10 sowie Hürdenkarte, Gegenhypothese und Gültigkeitsgrenze sichern                |

### UE 3, Lernprodukt und Selbststudium

UE 3 verwendet den MC-Test W08. Besprochen werden mindestens eine Perzentil-Fehlinterpretation und ein unzulässiger Schluss von 500 Joins auf vollständigen 5.000er-Livebetrieb.

**Lernprodukt:** Scale-out-Hürdenkarte und reproduzierbarer Messplan mit Hypothese, Workload, Umgebung, Kennzahlen, Abbruch, Rohdatenbezug und Aussagegrenze.

**Selbststudium:** eine Gegenhypothese mit demselben Messvertrag prüfen, Messrauschen und Wiederholbarkeit dokumentieren und keine Produktionskapazität aus Laborwerten ableiten.

## 13. W09 – IAM, Security, Observability, SRE und Resilienz

**Wochenfrage:** Wie wird aus einem Sicherheits- oder Betriebsbefund eine verifizierte Maßnahme mit messbarem Restrisiko?

**Ziele:** QZ2 · MZ8 · LI19–LI21

**Fragensätze:** [ARSnova W09](./ARSnova_Woche_09.json) · [MC-Test W09](./MC-Test_Woche_09.json)

**Quellenanker:** [Technische Quellen](./Technische_Quellen_ARSnova.md) mit `SRC-SECURITY-UEBERBLICK`, `SRC-SECURITY-AUTORISIERUNG`, `SRC-SECURITY-CI`, `SRC-MONITORING-API`, `SRC-MONITORING-OPERATIV`, `SRC-MONITORING-POLLER`, `SRC-MONITORING-ABNAHME` sowie der 8.9d-Netz-, Credential- und Slot-Evidenz des Kurs-Commits.

### Inhalte und erwartete Ergebnisse

- Identitäten, Rechte, Secrets, Netzwerk- und Supply-Chain-Kontrollen entwerfen;
- mindestens eine Kontrolle mit einem Negativtest statt nur durch Konfigurationslesen verifizieren;
- implementierte Logs und Metriken zu SLI, SLO, Alarm und Runbook verbinden; verteilte Traces nur als allgemeines SRE-Konzept oder ausdrücklich gekennzeichnetes Zielbild behandeln;
- Ausfall oder Fehlkonfiguration injizieren und Graceful Degradation, Recovery und Restrisiko beurteilen.

### Verbindlicher Fachwortschatz

| Begriff                              | Arbeitsdefinition                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Identity and Access Management (IAM) | Verwaltung und Prüfung von Identitäten, Rollen, Richtlinien und Zugriffen                                                         |
| Service Identity                     | technische Identität eines Dienstes für authentisierte Kommunikation mit minimalen Rechten                                        |
| Least Privilege                      | Begrenzung jeder Identität auf notwendige Rechte, Ressourcen und Dauer                                                            |
| Netzwerksegmentierung                | Trennung von Netzbereichen und erlaubten Kommunikationspfaden                                                                     |
| Supply Chain                         | Herkunfts- und Abhängigkeitskette von Quellcode, Paketen, Images und Modellartefakten                                             |
| Observability                        | Fähigkeit, internen Systemzustand aus geeigneten externen Signalen zu erschließen                                                 |
| Logs, Metriken und Traces            | Ereignisprotokolle, numerische Zeitreihen und korrelierte Anfragepfade; Traces sind für arsnova.eu nicht als implementiert belegt |
| Service Level Indicator (SLI)        | gemessene Größe für eine relevante Diensteigenschaft                                                                              |
| Service Level Objective (SLO)        | Zielbereich eines SLI über ein definiertes Messfenster                                                                            |
| Site Reliability Engineering (SRE)   | ingenieurmäßige Verbindung von Zuverlässigkeitszielen, Messung, Automatisierung und Reaktion                                      |
| Graceful Degradation                 | geplanter eingeschränkter Betrieb, bei dem Kernfunktionen trotz Ausfall optionaler Teile erhalten bleiben                         |
| Restrisiko                           | nach umgesetzten und geprüften Kontrollen verbleibendes Risiko                                                                    |

### UE 1 und UE 2

| Zeit  | Inhalt und Lernhandlung                                                                                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–12  | L01/L02: Trust Boundary, Backpressure und Recovery aus W03/W08 abrufen                                                                                                                                      |
| 12–22 | IAM-, Netzwerk-, Supply-Chain- und Observability-Modell für App und Inferenz aufbauen                                                                                                                       |
| 22–34 | L03/L04: Befund, Maßnahme, bloße Behauptung und belastbare Verifikation unterscheiden                                                                                                                       |
| 34–45 | Security- und 8.9d-Quellen auf implementierten und getesteten Stand prüfen; Monitoring als implementiert/lokal verifiziert einordnen und produktive Alarmkette nur mit datiertem Betriebsnachweis behaupten |
| 45–48 | Rollen, Agentenvertrag, Testziel, Rechte und Abbruchkriterium bestätigen                                                                                                                                    |
| 48–52 | L05 als Vorhersage zum Negativ- oder Ausfalltest beantworten                                                                                                                                                |
| 52–64 | freigegebenen Negativ- oder Ausfalltest in isolierter Umgebung ausführen                                                                                                                                    |
| 64–79 | L06–L08: SLI/SLO, Alarm, Runbook, Degradation, Recovery und Restrisiko ableiten                                                                                                                             |
| 79–90 | L09/L10 sowie Befund-Maßnahme-Verifikationskette und Owner sichern                                                                                                                                          |

### UE 3, Lernprodukt und Selbststudium

UE 3 verwendet den MC-Test W09. Besprochen werden mindestens eine Verwechslung von Log und SLO sowie ein Fall, in dem eine Maßnahme ohne Negativtest fälschlich als wirksam gilt.

**Lernprodukt:** Kette `Befund → Risiko → Maßnahme → Verifikation → Graceful Degradation/Recovery → Restrisiko` samt SLI/SLO, Alarm, Runbook und Owner.

**Selbststudium:** Security-, Betriebs- und Wirtschaftsperspektive auf dasselbe Restrisiko anwenden, Konflikte entscheiden und mindestens eine Kontrolle unabhängig gegenprüfen.

## 14. W10 – FinOps, Nachhaltigkeit und 6R

**Wochenfrage:** Welche technisch belegte Cloud-Option ist unter Kosten, Ressourcenwirkung, Risiko und Exit vertretbar?

**Ziele:** QZ1/QZ4/QZ5 · MZ9 · LI11 und LI22–LI23

**Fragensätze:** [ARSnova W10](./ARSnova_Woche_10.json) · [MC-Test W10](./MC-Test_Woche_10.json)

**Quellenanker:** [Technische Quellen](./Technische_Quellen_ARSnova.md) mit `SRC-CLOUD-PROVIDER`, `SRC-CLOUD-6R`, `SRC-CLOUD-KOSTEN`, `SRC-LAST-LOKAL-2026-07-12` und der am Kursstart gemessenen 8.9d-Ressourcen- und Latenzevidenz; volatile Preise sowie Energie- und Emissionsfaktoren nur aus datierten Primär- oder offiziellen Statistikquellen mit benannter Region und Messgrenze.

### Inhalte und erwartete Ergebnisse

- Infrastrukturpreis, TCO, Unit Costs und Opportunitätskosten unterscheiden;
- CPU-, GPU-, Managed-AI- und nicht generative Option auf gleicher Leistung vergleichen;
- Best-, Base- und Worst-Case sowie Sensitivität und Nachhaltigkeitsgrenzen modellieren;
- 6R-Optionen in eine ADR mit stärkster verworfener Alternative und Exit überführen.

### Verbindlicher Fachwortschatz

| Begriff                            | Arbeitsdefinition                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Financial Operations (FinOps)      | gemeinsamer Steuerungsprozess, der technische Nutzung, Kosten und Verantwortlichkeit verbindet                  |
| Total Cost of Ownership (TCO)      | Gesamtkosten aus Infrastruktur, Personal, Betrieb, Sicherheit, Backup, Migration und Exit                       |
| Capital Expenditure (CapEx)        | investive Ausgabe für länger genutzte Vermögenswerte                                                            |
| Operational Expenditure (OpEx)     | laufende betriebliche Ausgabe für Nutzung und Betrieb                                                           |
| Unit Cost                          | Kosten pro eindeutig definierter Leistungseinheit, etwa erfolgreichem Job oder Session                          |
| Auslastung                         | Anteil verfügbarer Kapazität, der im Messfenster produktiv genutzt wird                                         |
| Energiebedarf                      | gemessene oder transparent geschätzte Kilowattstunden (kWh) für eine definierte Systemgrenze und Leistung       |
| Kohlenstoffintensität              | Emissionsfaktor in Gramm Kohlenstoffdioxid-Äquivalenten pro Kilowattstunde (g CO₂e/kWh) für Region und Zeitraum |
| Sensitivitätsanalyse               | Prüfung, wie stark das Ergebnis auf Änderungen einzelner Annahmen reagiert                                      |
| Best, Base und Worst Case          | günstige, erwartete und ungünstige konsistente Annahmensätze                                                    |
| 6R                                 | Rehost, Replatform, Repurchase, Refactor, Retire und Retain als Migrationsoptionen                              |
| Build or Buy                       | Entscheidung zwischen eigener Erstellung beziehungsweise Betrieb und Bezug eines Dienstes                       |
| Architecture Decision Record (ADR) | dokumentierte Entscheidung mit Kontext, Optionen, Evidenz, Folgen und Neubewertungsauslöser                     |
| Exit-Kriterium                     | vorab definierter Auslöser und Weg für Wechsel, Rückbau oder Ablösung einer Option                              |

### UE 1 und UE 2

| Zeit  | Inhalt und Lernhandlung                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------- |
| 0–12  | L01/L02: Preiseinheit, Egress und Messgrenze aus W05/W08 abrufen                                               |
| 12–22 | TCO, Unit Cost, CapEx/OpEx, Auslastung, Energiebedarf, Kohlenstoffintensität, Sensitivität und 6R ordnen       |
| 22–34 | L03/L04: unvollständige Kosten- und Nachhaltigkeitsmodelle diagnostizieren                                     |
| 34–45 | Kostenblatt, Providerquellen und 8.9d-Messwerte auf identische Systemgrenze prüfen                             |
| 45–48 | Rollen, Agentenvertrag, Systemgrenze, Kostenlimit und Abbruchkriterium bestätigen                              |
| 48–52 | L05 als Vorhersage zur wirtschaftlich tragfähigen Option beantworten                                           |
| 52–64 | Best-/Base-/Worst-Modell für Kosten und Ressourcenwirkung der privaten CPU-, GPU- und Managed-Option erstellen |
| 64–79 | L06–L08: 6R, stärkste Gegenalternative, Risiko, Nachhaltigkeitsfolge und Exit entscheiden                      |
| 79–90 | L09/L10 sowie TCO-Modell, Sensitivität und ADR-Kern im Dossier sichern                                         |

### UE 3, Lernprodukt und Selbststudium

UE 3 verwendet den MC-Test W10. Besprochen werden mindestens eine falsche Unit-Cost-Rechnung und ein Fall, in dem die gewählte 6R-Kategorie nicht zur technischen Veränderung passt.

**Lernprodukt:** TCO-/FinOps-/Nachhaltigkeitsmodell und ADR mit 6R-Zuordnung, Sensitivität, stärkster verworfener Alternative, Risiko und Exit.

**Selbststudium:** die stärkste Gegenalternative mit aktualisierten Preisen und einer veränderten Auslastungsannahme neu rechnen und dokumentieren, wann die ursprüngliche Entscheidung kippt.

## 15. W11 – Evidenzbasierte Architekturentscheidung und Referatsarbeit

**Wochenfrage:** Wie wird aus Quellen, Messungen und offenen Annahmen eine in 15 Minuten verteidigbare Cloud-These?

**Ziele:** QZ1–QZ5 · MZ9 · LI23–LI24

**Fragensätze:** [ARSnova W11](./ARSnova_Woche_11.json) · [MC-Test W11](./MC-Test_Woche_11.json)

**Quellenanker:** [Referatsthemenkatalog](./Referatsthemen_Cloud_Computing_ARSnova.md), [Lernziel- und Alignment-Matrix](./Lernziel_Alignment_Matrix.md), [Technische Quellen](./Technische_Quellen_ARSnova.md) und der veröffentlichte Prüfungsauftrag.

### Inhalte und erwartete Ergebnisse

- Thema, Systemgrenze, These und fachliche Entscheidung präzisieren;
- Fakt, Evidenz, Annahme und Zielbild sichtbar trennen;
- Primärquellen, Repositorybelege und eigene Messung in einem Quellenregister verbinden;
- stärkste Gegenalternative, Visualisierung, Gültigkeitsgrenze und individuelle Argumentationslinie vorbereiten.

### Verbindlicher Fachwortschatz

| Begriff                         | Arbeitsdefinition                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Leitfrage                       | abgegrenzte Frage, auf die das Referat eine begründete Antwort entwickelt                              |
| These                           | klar prüfbare und verteidigbare Kernaussage                                                            |
| Fakt                            | Aussage, die innerhalb der benannten Quelle oder Beobachtung nachprüfbar belegt ist                    |
| Evidenz                         | nachvollziehbarer Nachweis, der eine Aussage stützt oder widerlegt                                     |
| Annahme                         | noch nicht belegte Voraussetzung, deren Einfluss offengelegt werden muss                               |
| Primärquelle                    | ursprüngliche Spezifikation, Messung, Konfiguration oder Herstellerquelle statt bloßer Zusammenfassung |
| Quellenkritik                   | Prüfung von Herkunft, Aktualität, Geltungsbereich, Interesse und Aussagekraft einer Quelle             |
| Reproduzierbarkeit              | Möglichkeit, Vorgehen und Ergebnis unter dokumentierten Bedingungen unabhängig nachzuvollziehen        |
| Systemgrenze                    | ausdrücklich einbezogene Komponenten, Nutzerhandlungen, Umgebung und ausgeschlossene Teile             |
| Gültigkeitsgrenze               | Grenze, außerhalb derer die Evidenz die Schlussaussage nicht trägt                                     |
| stärkste verworfene Alternative | fachlich tragfähigste nicht gewählte Option, nicht bloß ein schwacher Strohmann                        |
| akademische Integrität          | ehrlicher, nachvollziehbarer Umgang mit Quellen, Hilfsmitteln, Beiträgen und Unsicherheit              |

### UE 1 und UE 2

| Zeit  | Inhalt und Lernhandlung                                                                  |
| ----- | ---------------------------------------------------------------------------------------- |
| 0–12  | L01/L02: Evidenzstufen, ADR und stärkste Gegenalternative aus früheren Wochen abrufen    |
| 12–22 | Leitfrage, These, Fakt, Evidenz, Annahme, Entscheidung und Grenze modellieren            |
| 22–34 | L03/L04: überzogene Schlussfolgerung und schwache Quelle in Peer-Arbeit korrigieren      |
| 34–45 | Themenkatalog und ausgewählte Repository-/Primärquellen gegen den Kurs-Commit prüfen     |
| 45–48 | individuelle Rolle, zulässige Hilfsmittel, Thema, Zeit- und Prüfungsgrenze bestätigen    |
| 48–52 | L05 als Vorhersage zur Tragfähigkeit der Referatsthese beantworten                       |
| 52–64 | individuelle These, Systemgrenze, Quellenregister und Visualisierung entwerfen           |
| 64–79 | L06–L08: Gegenalternative, technische Evidenz, KI-Beitrag und mögliche Rückfragen prüfen |
| 79–90 | L09/L10 sowie Vortragsskizze, Zeitbudget und offene Unsicherheit sichern                 |

### UE 3, Lernprodukt und Selbststudium

UE 3 verwendet den MC-Test W11. Besprochen werden mindestens ein Quellen-/Evidenzfehler und ein Fall, in dem eine attraktive Visualisierung eine fehlende Begründung verdeckt.

**Lernprodukt:** referatsfähige These mit Systemgrenze, Quellen- und Evidenzregister, Visualisierungsskizze, stärkster Gegenalternative und individueller Argumentationslinie.

**Selbststudium:** Einreichung und Vortrag entsprechend der gültigen Hilfsmittelregel ausarbeiten, Agentenbeiträge offenlegen und kritische Rückfragen ohne Agentenstellvertretung beantworten üben.

## 16. W12 – Synthese und Probeverteidigung

**Wochenfrage:** Hält die eigene Cloud-Entscheidung einer fachlichen Befragung über Architektur, Verantwortung, Betrieb, Kosten und Grenzen stand?

**Ziele:** QZ1–QZ5 · MZ9 · LI24

**Fragensätze:** [ARSnova W12](./ARSnova_Woche_12.json) · [MC-Test W12](./MC-Test_Woche_12.json)

**Quellenanker:** vollständiges persönliches Quellenregister, [Referatsthemenkatalog](./Referatsthemen_Cloud_Computing_ARSnova.md), [Lernziel- und Alignment-Matrix](./Lernziel_Alignment_Matrix.md), [Technische Quellen](./Technische_Quellen_ARSnova.md) und der gültige Prüfungsauftrag.

### Inhalte und erwartete Ergebnisse

- fünf offizielle Inhaltsblöcke und querschnittliche Betriebsfolgen am eigenen Thema verbinden;
- These, Evidenz, Alternative, Entscheidung und Gültigkeitsgrenze dialogisch verteidigen;
- technische und wirtschaftliche Trade-offs statt Produktlisten erklären;
- eigene Restunsicherheit, Korrekturbedarf und zulässigen KI-Beitrag benennen.

### Verbindlicher Fachwortschatz

| Begriff               | Arbeitsdefinition                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Synthese              | Verbindung mehrerer fachlicher Perspektiven zu einer konsistenten, begrenzten Schlussaussage   |
| Transfer              | Anwendung eines Konzepts auf einen neuen, nicht wortgleich geübten Fall                        |
| Trade-off             | Zielkonflikt, bei dem eine Verbesserung eine andere relevante Eigenschaft beeinträchtigen kann |
| Gegenbeispiel         | Fall, der eine zu allgemeine Behauptung widerlegt oder begrenzt                                |
| Falsifizierbarkeit    | Möglichkeit, eine Behauptung durch festgelegte Beobachtung oder Messung zu widerlegen          |
| Robustheit            | Beständigkeit einer Entscheidung gegenüber plausiblen Änderungen von Annahmen oder Störungen   |
| Unsicherheit          | benannter Bereich fehlenden Wissens oder schwankender Messung                                  |
| Restrisiko            | nach Maßnahmen verbleibendes Risiko mit Owner und weiterer Behandlungsentscheidung             |
| Verteidigung          | begründete Reaktion auf fachliche Rückfragen, Alternativen und Gegenargumente                  |
| Evidenzstufe          | Kennzeichnung als implementiert, lokal verifiziert, produktiv beobachtet oder Zielbild         |
| individuelle Leistung | persönlich zurechenbarer Beitrag zu Einreichung, Vortrag und Diskussion                        |
| Korrekturliste        | priorisierte Liste fachlicher Lücken mit konkreter nächster Verbesserung                       |

### UE 1 und UE 2

| Zeit  | Inhalt und Lernhandlung                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------- |
| 0–12  | L01/L02: zentrale Begriffe der fünf QZ in neuen Fällen abrufen                                            |
| 12–22 | Synthesemodell aus These, Evidenz, Trade-off, Alternative, Entscheidung und Grenze aufbauen               |
| 22–34 | L03/L04: überzogene Schlussaussagen und unbelegte Transfers gemeinsam korrigieren                         |
| 34–45 | persönliche Quellen, Visualisierung und Prüfungsauftrag auf Vollständigkeit und Zugänglichkeit prüfen     |
| 45–48 | individuelle Rolle, Hilfsmittel-, Zeit- und Feedbackgrenze der Probe bestätigen                           |
| 48–52 | L05 als Vorhersage zur stärksten offenen Schwachstelle beantworten                                        |
| 52–64 | parallele Kurzverteidigungen oder einen exemplarischen vollständigen 15-Minuten-Lauf durchführen          |
| 64–79 | L06–L08: Rückfragen zu Architektur, Security, Recovery, Skalierung, Kosten und KI-Beitrag beantworten     |
| 79–90 | L09/L10 sowie individuelle Korrekturliste und Termin für den vollständigen persönlichen Probelauf sichern |

### UE 3, Lernprodukt und Selbststudium

UE 3 verwendet den MC-Test W12. Die Lösungsbesprechung verbindet mindestens zwei Items aus unterschiedlichen QZ und macht die Grenze einer kumulativen Schlussfolgerung sichtbar.

**Lernprodukt:** dokumentierte Probeverteidigung, persönliche Korrekturliste und begrenzte Schlussaussage. Falls nicht jede Person innerhalb der LE einen vollständigen 15-Minuten-Lauf erhält, wird dieser im vorgesehenen Selbststudium mit strukturiertem Peer-Protokoll abgeschlossen.

**Selbststudium:** vollständigen individuellen 15-Minuten-Lauf durchführen, Einreichung und Visualisierung final prüfen sowie verbleibende Fachfragen gezielt nacharbeiten.

## 17. Semesterweite Wiederaufnahme des Fachwortschatzes

| Wiederaufnahme    | Kernverbindung                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| W01 → W03/W05/W10 | Cloudmodell und Shared Responsibility werden an Deployment, Provider und Migration erneut geprüft       |
| W02 → W03/W08/W09 | Container-, Netzwerk- und Trust-Boundary-Begriffe werden in Betrieb, Skalierung und Security angewendet |
| W03 → W07/W09     | Zustands- und Härtungsbegriffe werden in Recovery und Resilienz erneut benötigt                         |
| W04 → W08/W10     | Serverless-Grenzen werden mit Skalierung, Kosten und Exit verbunden                                     |
| W05 → W06/W10     | Provider-, Regionen- und Egressbegriffe tragen den ML- und FinOps-Vergleich                             |
| W06 → W08–W10     | Daten-/ML-Pipeline, Inferenz und Fallback werden unter Last, Ausfall und Kosten geprüft                 |
| W07 → W09/W10     | Recoveryziele werden mit SLO, Risiko und TCO verbunden                                                  |
| W08 → W09/W10     | Messvertrag und Sättigung werden für SRE und Unit Costs wiederverwendet                                 |
| W09 → W10–W12     | Restrisiko, SLO und Degradation fließen in ADR und Verteidigung ein                                     |
| W10 → W11–W12     | ADR, 6R, Sensitivität und Exit strukturieren Referat und Synthese                                       |

Die Wiederaufnahme erfolgt in neuem Kontext. Wörtlich identische Aufgaben oder gegenseitige Lösungshinweise zwischen ARSnova und MC-Test sind ausgeschlossen.

## 18. Abnahme des Lehrplans

Der Lehrplan ist fachlich erst freigegeben, wenn:

1. alle zwölf Wochen mit den zugehörigen QZ, MZ und LI übereinstimmen;
2. jede Woche genau eine 90-minütige LE und eine 45-minütige MC-Test-UE ausweist;
3. die Bilanz von 18 UE Präsenz/synchron und 18 UE Tutorium erhalten bleibt;
4. jeder Wochenabschnitt Inhalte, Fachwortschatz, Quellenanker, Lernprodukt und Selbststudium enthält;
5. die verlinkten ARSnova- und MC-Dateien dem letzten geprüften Paketstand entsprechen;
6. die 8.9d-Kursstartannahme durch aktualisierte Code-, Compose-, Konfigurations-, Test- und Messanker in den technischen Quellen bestätigt wurde;
7. operative Import-, Geräte-, Offline- und Barrierefreiheitsgates aus dem [QA-Freigabeprotokoll](./QA_Freigabeprotokoll.md) geschlossen sind.
