# Referatsthemen Cloud Computing am Fallbeispiel arsnova.eu

**Stand:** 14.09.2026

## 1. Zweck und Geltung

Dieser Katalog enthält zehn abgegrenzte Referatsthemen für das ausschließlich an Bachelorstudierende der Informatik gerichtete Modul Cloud Computing. arsnova.eu dient dabei als durchgängiges Fallbeispiel: Die Studierenden untersuchen eine reale, versionierte Softwarearchitektur und verbinden Repository-Nachweise mit Cloud-Modellen, Schnittstellen, Datenflüssen, Zustandsgrenzen, Security, Performance, Zuverlässigkeit und einer eigenen technischen Entscheidung.

Der Katalog konkretisiert die [Lernziel- und Alignment-Matrix](./Lernziel_Alignment_Matrix.md). Form, Termin, Einzel- oder Gruppenprüfung, Hilfsmittel und verbindliche Themenzuordnung bestimmt ausschließlich die veröffentlichte Prüfungsaufgabe beziehungsweise myCampus. Die zehn Themen ersetzen keine institutionellen Prüfungsregeln.

## 2. Begriffe und Kürzel

- **IU Internationale Hochschule (IU):** die Hochschule.
- **Qualifikationsziel (QZ):** eines der fünf offiziellen Ziele des Moduls.
- **Modulziel (MZ):** eines der neun operationalisierten Ziele.
- **Learning Indicator (LI):** ein beobachtbarer Lernindikator.
- **Infrastructure as a Service (IaaS):** Bereitstellung von Rechen-, Netz- und Speicherressourcen.
- **Platform as a Service (PaaS):** verwaltete Plattform für Entwicklung und Betrieb von Anwendungen.
- **Software as a Service (SaaS):** als vollständiger Dienst bereitgestellte Anwendung.
- **Function as a Service (FaaS):** ereignisgesteuerte Ausführung einzelner Funktionen.
- **Backend as a Service (BaaS):** verwaltete Backend-Fähigkeiten wie Datenhaltung oder Identitätsdienste.
- **Infrastructure as Code (IaC):** versioniert und reproduzierbar beschriebene Infrastruktur.
- **Identity and Access Management (IAM):** Identitäts- und Berechtigungsverwaltung.
- **Site Reliability Engineering (SRE):** mess- und automatisierungsorientierter Ansatz für zuverlässigen Betrieb.
- **Service Level Indicator (SLI):** Messgröße für eine relevante Diensteigenschaft.
- **Service Level Objective (SLO):** Zielwert eines SLI über ein festgelegtes Messfenster.
- **Recovery Point Objective (RPO):** tolerierter Datenverlustzeitraum.
- **Recovery Time Objective (RTO):** angestrebte Wiederherstellungszeit.
- **Financial Operations (FinOps):** messbasierte Steuerung technischer Cloud-Ressourcen und der daraus entstehenden Betriebskosten.
- **Total Cost of Ownership (TCO):** aus einer einheitlichen technischen Systemgrenze abgeleitete Gesamtkosten von Bereitstellung, Betrieb, Änderung und Exit.
- **Architecture Decision Record (ADR):** nachvollziehbare Dokumentation einer Architekturentscheidung.
- **Künstliche Intelligenz (Artificial Intelligence, AI):** Oberbegriff für Verfahren, die Aufgaben mit lernenden oder wissensbasierten Methoden bearbeiten.
- **maschinelles Lernen (Machine Learning, ML):** Teilgebiet der AI, in dem Modelle aus Daten Strukturen oder Entscheidungsregeln ableiten.
- **Large Language Model (LLM):** großes Sprachmodell.
- **Central Processing Unit (CPU):** Hauptprozessor eines Rechners.
- **Graphics Processing Unit (GPU):** Grafikprozessor, der Modellinferenz beschleunigen kann.
- **GGUF:** Dateiformat für quantisierte Modelle im `llama.cpp`-Umfeld.
- **Software Bill of Materials (SBOM):** maschinenlesbare Stückliste eines Softwareartefakts.
- **Application Programming Interface (API):** programmierbare Schnittstelle zwischen Softwarekomponenten.
- **Hypertext Transfer Protocol (HTTP):** Anwendungsprotokoll für die Kommunikation zwischen Webdiensten.
- **JavaScript Object Notation (JSON):** textbasiertes Format für strukturierte Daten.
- **TypeScript Remote Procedure Call (tRPC):** im Projekt verwendete typisierte API-Technik.
- **Multiple Choice (MC):** Auswahlformat mit vorgegebenen Antwortoptionen.
- **Google Cloud Platform (GCP), Amazon Web Services (AWS) und Microsoft Azure:** die im Modul verbindlich verglichenen Cloud-Plattformen.
- **Fragen und Antworten (Q&A):** der moderierte Fragenkanal von arsnova.eu.
- **p50, p95 und p99:** das 50., 95. und 99. Perzentil einer Messwertverteilung.
- **6R:** Rehost, Replatform, Repurchase, Refactor, Retire und Retain als Migrationstaxonomie.

## 3. Verbindliche Kursstartannahme für die lokale LLM-Runtime

Für diesen Themenkatalog wird vorausgesetzt, dass Story 8.9d zum Kursstart entsprechend [ADR-0035](../../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md) implementiert ist. Der festgelegte Kurs-Commit muss diese Annahme durch Code, Konfiguration und Tests belegen. Dazu gehören mindestens:

- `llama.cpp` mit `llama-server` als Runtime und kein zusätzlicher Ollama-Layer;
- eine vom Live-App-Host getrennte private Inferenzrolle ohne öffentlichen Modellport;
- ein eigenes Image, ein eigenes Compose-Profil `llm` und ein gepinntes GGUF-Modellartefakt;
- der unabhängige Kill-Switch `OPEN_WEIGHT_LLM_ENABLED`;
- ein schmaler Node.js-Client, der die getrennten Anwendungsverträge auf Chat-Completions und ein JSON-Schema pro Request abbildet;
- genau ein gemeinsamer Inferenz-Slot mit gemeinsamem Inflight-Limit, `--parallel 1`, Slot-Prüfung, Backpressure und kontrolliertem Abbruch;
- feste Kontext- und Ausgabelimits, Healthcheck, Ressourcenlimits, Authentisierung, private Zielprüfung, Timeout und technische Regressionstests;
- ein nachweisbarer Fallback, bei dem Join, Vote, Q&A und WebSocket-Nutzung nicht auf Inferenz warten.

Diese Runtime-Annahme bedeutet ausdrücklich nicht automatisch:

- dass generative Clusterlabels aus Story 1.14c Stufe 2 fertig oder aktiviert sind;
- dass die generative Moderationszusammenfassung aus Story 8.9c Slice 4 fertig oder aktiviert ist;
- dass der Freitext-Themenmodus aus Story 1.14d umgesetzt ist;
- dass ein GPU-Pfad, horizontale Skalierung, Autoscaling oder ein Managed-Cloud-Dienst produktiv eingesetzt wird;
- dass Last-, Security-, Privacy-, Kosten- oder Produktionsfreigaben bestanden sind.

Der konkrete Prüfungsauftrag nennt deshalb den Kurs-Commit, das verwendete Modellartefakt, die aktivierten Consumer-Pfade und deren Evidenzstufe. Fehlt eine Consumer-Stufe, darf sie nur als Zielbild oder mit einem ausdrücklich synthetischen Testharness untersucht werden.

## 4. Gemeinsamer Referatsvertrag

Jedes Thema wird auf eine überprüfbare These zugespitzt. Eine reine Beschreibung von Produkten, Storys oder Quellcode genügt nicht. Die Prüfungsleistung muss mindestens enthalten:

1. **Systemgrenze:** betrachtete Nutzerhandlung, Komponenten, Umgebung und ausgeschlossene Teile;
2. **Cloud-Kern:** die unmittelbar geprüften Cloud-Konzepte und ihr Bezug zum offiziellen QZ;
3. **technische Evidenz:** mindestens ein eigener reproduzierbarer Test, Messlauf, Restore, Negativtest oder IaC-Nachweis;
4. **Evidenzstufe:** klare Trennung von implementiert, lokal verifiziert, produktiv beobachtet und Zielbild;
5. **Gegenalternative:** eine ernsthaft untersuchte Alternative auf derselben Systemgrenze;
6. **Entscheidung:** begründete technische Auswahl mit Funktions-, Security-, Performance-, Zuverlässigkeits-, Ressourcen- und Betriebsfolgen sowie Restrisiko;
7. **Gültigkeitsgrenze:** Aussage dazu, welche Schlussfolgerung die Evidenz nicht trägt;
8. **Quellen:** Repository-Commit sowie datierte Primärquellen für volatile API-, Regions-, Limit-, Ressourcen- und Abrechnungseinheiten.

Repository- und Laborarbeit verwendet ausschließlich freigegebene Repository-Nachweise und synthetische Lehrdaten in isolierten Nichtproduktionsumgebungen. Produktionszugänge, Echtdaten, Secrets und nicht genehmigte Lasttests sind ausgeschlossen. Ergebnisse von ARSnova-Livefragen und MC-Tests werden nicht als individuelle Prüfungsdaten verwendet.

Alle zehn Themen sind ausdrücklich als Informatikthemen zu bearbeiten. Im Mittelpunkt stehen Software- und Cloud-Architektur, Schnittstellen, Daten- und Zustandsmodelle, Deployment, Security, Performance, Zuverlässigkeit und reproduzierbare Experimente. Kosten und Energie dürfen nur als aus technischen Messwerten abgeleitete nichtfunktionale Randbedingungen eingehen. Beschaffung, Finanzierung, Marktanalyse und organisatorische Business Cases sind nicht Gegenstand der Referate.

## 5. Abdeckung der zehn Themen

| Nr. | Referatsthema                                                   | Primäre Qualifikationsziele | Modulziele         | Lernindikatoren                |
| --: | --------------------------------------------------------------- | --------------------------- | ------------------ | ------------------------------ |
|   1 | Technische Cloud-Einordnung und Verantwortungsgrenzen           | QZ1                         | MZ1                | LI01–LI03                      |
|   2 | Reproduzierbare Multi-Tier-Bereitstellung                       | QZ1, QZ2                    | MZ1, MZ2           | LI02, LI04–LI06                |
|   3 | Serverless-Architektur für ARSnova-Arbeitslasten                | QZ3                         | MZ3                | LI07–LI08                      |
|   4 | Private LLM-Inferenzarchitektur außerhalb des Live-Hotpaths     | QZ2, QZ5                    | MZ2, MZ5, MZ7      | LI06, LI12, LI14, LI17–18      |
|   5 | Technischer Plattformarchitekturvergleich für Daten und ML      | QZ4, QZ5                    | MZ4, MZ5, MZ9      | LI09–LI14, LI23                |
|   6 | Security-, Privacy- und Verantwortungsarchitektur               | QZ1, QZ2, QZ5               | MZ1, MZ5, MZ8      | LI03, LI13, LI19               |
|   7 | Zustandsmodelle, Storage, Backup und Recovery                   | QZ2                         | MZ6                | LI15–LI16                      |
|   8 | Verteilte Skalierung, Observability und Degradation             | QZ2                         | MZ7, MZ8           | LI17–LI21                      |
|   9 | Performance-, Energie- und Ressourceneffizienz der LLM-Inferenz | QZ2, QZ5                    | MZ5, MZ7, MZ9      | LI14, LI17, LI22               |
|  10 | Technische 6R-Migration, Portabilität und Rollback              | QZ1, QZ2, QZ4               | MZ1, MZ2, MZ4, MZ9 | LI01–LI02, LI06, LI11, LI23–24 |

Gemeinsam decken die Themen alle fünf offiziellen QZ, alle neun MZ und die 24 LI ab. Ein einzelnes Referat prüft nur die beim Thema ausgewiesenen Schwerpunkte.

## 6. Die zehn Referatsthemen

### Thema 1 – Technische Cloud-Einordnung und Verantwortungsgrenzen

**Leitfrage:** Welche nachweisbaren Architektur-, Bereitstellungs-, Skalierungs- und Verantwortungsmerkmale erlauben eine technische Cloud-Einordnung des aktuellen und des um Story 8.9d erweiterten Betriebs?

**Cloud-Kern:** Systemgrenzen, Laufzeittopologie, Cloud-Merkmale, IaaS, PaaS und SaaS, Public, Private, Community und Hybrid Cloud sowie Shared Responsibility.

**Fallbezug:** Der dokumentierte App-Pfad nutzt Container, PostgreSQL, Redis und einen isolierten PDF-Worker auf einem Single Host. Die Kursstartannahme ergänzt einen zweiten privaten Inferenzhost. Weder Container noch ein zweiter Server belegen allein Elastizität oder ein Cloud-Dienstmodell.

**Verpflichtende Evidenz:**

- belegtes Ist- und Kursstart-Diagramm mit Repository-Quellen;
- Matrix der beobachtbaren Cloud-Merkmale je Systemteil;
- Zuordnung von Dienst- und Bereitstellungsmodell je Tier;
- Shared-Responsibility-Matrix für mindestens den App- und Inferenz-Tier;
- Gegenfall, der Cloud-Marketing von nachgewiesenen Fähigkeiten trennt.

**Entscheidung:** Technisch begründete Klassifikation jedes Tiers einschließlich fehlender Cloud-Fähigkeiten und der Architekturänderungen, die für eine weitergehende Einordnung erforderlich wären.

**Gegenalternative:** klassisches Self-managed Hosting ohne Cloud-Fähigkeiten oder ein vollständig verwaltetes SaaS-Modell.

**Alignment:** QZ1; MZ1; LI01–LI03; Themenblöcke TB01 und TB11–TB12.

### Thema 2 – Reproduzierbare Multi-Tier-Bereitstellung mit Containern und IaC

**Leitfrage:** Wie müssen Live-App, Datenhaltung und privater LLM-Inferenz-Tier reproduzierbar bereitgestellt werden, damit Netz-, Vertrauens- und Zustandsgrenzen auch nach einem Neuaufbau erhalten bleiben?

**Cloud-Kern:** Virtualisierung, Container, Images, IaC, private Netze, Servicegrenzen, Idempotenz und Drift.

**Fallbezug:** Der belegte Produktionspfad verwendet Docker Compose auf einem Host; 8.9d verlangt eine getrennte Inferenzrolle. Die Aufgabe untersucht den Übergang von einer lokalen Compose-Definition zu einer reproduzierbaren Zwei-Tier-Bereitstellung.

**Verpflichtende Evidenz:**

- versionierter Provisioning-Entwurf oder IaC für beide Tiers in einer Sandbox;
- gepinnte Images sowie Modellhash, Modelllizenz und SBOM-Grenze;
- zweiter Lauf oder Driftprüfung als Idempotenznachweis;
- private Netzregel, durch die Browser und öffentliche Clients den Modellport nicht erreichen;
- dokumentierter Credential-, Rollback- und Cleanup-Weg.

**Entscheidung:** Technische Zielarchitektur zwischen Self-managed IaaS, verwalteter Containerplattform und PaaS anhand von Reproduzierbarkeit, Isolation, Zustandsführung, Fehlerverhalten und Rollback.

**Gegenalternative:** dieselben Komponenten auf einem größeren Single Host oder eine stärker verwaltete Plattformvariante.

**Alignment:** QZ1 und QZ2; MZ1 und MZ2; LI02 und LI04–LI06; Themenblöcke TB02–TB03.

### Thema 3 – Serverless-Architektur für ARSnova-Arbeitslasten

**Leitfrage:** Welche abgegrenzte ARSnova-Arbeitslast lässt sich aufgrund ihres Trigger-, Zustands-, Laufzeit- und Parallelitätsmodells korrekt als FaaS oder BaaS entwerfen, und welche Live-Arbeitslast benötigt einen dauerhaften Dienst?

**Cloud-Kern:** FaaS, BaaS, Ereignissteuerung, Laufzeitgrenzen, Cold Start, Zustand, Parallelität, Idempotenz, Observability, Ressourcenverbrauch und technische Portabilität.

**Fallbezug:** Als Kandidaten kommen beispielsweise PDF-Erzeugung, Cleanup, ein begrenzter Analysejob oder eine Moderationszusammenfassung infrage. WebSocket-, Yjs- oder synchroner Vote-Betrieb bilden plausible Gegenbeispiele.

**Verpflichtende Evidenz:**

- Kriterienraster für einen geeigneten und einen ungeeigneten Kandidaten;
- reproduzierbarer Funktions- oder Emulationslauf mit Cold-Start- und Laufzeitmessung;
- Modell für Trigger, Retry, Idempotenz, Parallelität und Fehlerbehandlung;
- Latenz-, Durchsatz-, Parallelitäts- und Ressourcenvergleich bei niedriger, mittlerer und spitzenhafter Nutzung;
- Nachweis, dass kein dauerhaft benötigter Zustand unkontrolliert verloren geht.

**Entscheidung:** Technische Wahl zwischen Function, Container-Job, Queue-Worker und dauerhaftem Dienst mit belegten Betriebs- und Fehlergrenzen.

**Gegenalternative:** derselbe Auftrag als bestehender Containerdienst oder verwalteter Job.

**Alignment:** QZ3; MZ3; LI07–LI08; Themenblock TB04.

### Thema 4 – Private LLM-Inferenzarchitektur außerhalb des Live-Hotpaths

**Leitfrage:** Wie muss die 8.9d-Architektur aufgebaut und begrenzt sein, damit Join, Vote, Q&A und WebSocket-Nutzung nie auf LLM-Inferenz warten?

**Cloud-Kern:** asynchrone Verarbeitung, Queueing, Backpressure, private Servicekommunikation, Kapazitätsplanung und Graceful Degradation.

**Fallbezug:** Themenlabel und Moderationszusammenfassung dürfen einen gemeinsamen `llama-server`-Slot nutzen, behalten jedoch getrennte Schemas, Prompts, Queues, Timeouts und Freigaben. Die Hash-, n-Gramm-, Naive-Bayes- und k-Nächste-Nachbarn-Kaskade aus Story 8.9b nutzt diesen Slot nicht.

**Verpflichtende Evidenz:**

- Daten-, Kontroll- und Netzwerkfluss zwischen Live-App und Inferenzhost;
- Konkurrenzlast für Label- und Summary-Testjobs bei genau einem Slot;
- Messung von Queue-Wartezeit, Time to First Token, Tokens pro Sekunde, Gesamtlatenz und Fallback-Rate;
- Test für Slot-Belegung, HTTP 503, Timeout und Client-Abbruch;
- Nachweis, dass der Live-Pfad während der Fehlerfälle innerhalb seiner festgelegten Grenze weiterläuft.

**Entscheidung:** Technischer Scheduling-, Prioritäts-, Timeout-, Abbruch- und Fallbackvertrag für beide optionalen Inferenzaufträge.

**Gegenalternative:** getrennte Modellserver, Managed AI oder dauerhaft rein extraktive Ausgaben.

**Alignment:** QZ2 und QZ5; MZ2, MZ5 und MZ7; LI06, LI12, LI14 sowie LI17–LI18; Themenblöcke TB06 und TB08.

### Thema 5 – Technischer Plattformarchitekturvergleich für Daten und ML

**Leitfrage:** Welche Plattformarchitektur aus Self-managed IaaS, Managed Data und Managed AI erfüllt die technischen Verträge von arsnova.eu für Schnittstellen, Zustand, Isolation, Beobachtbarkeit, Fehlerverhalten und Portabilität?

**Cloud-Kern:** Capability Mapping, API- und Protokollverträge, Regionen, Datenresidenz, IAM, Shared Responsibility, SLO, Ressourcenlimits, Fehlerisolation, Egress-Datenpfade und Portabilität.

**Fallbezug:** Verglichen werden der private 8.9d-Inferenzhost und eine funktional vergleichbare Plattformvariante mit App-, Datenbank-, Netzwerk-, Observability- und Inferenzfähigkeiten.

**Verpflichtende Evidenz:**

- ein anbieterneutrales Fähigkeitsraster vor Auswahl konkreter Produktnamen;
- symmetrischer Vergleich von GCP, AWS und Azure auf identischer Systemgrenze;
- datierte Primärquellen zu API-Verträgen, Region, Servicegrenze, SLO beziehungsweise SLA und relevanten Ressourcenlimits;
- Verantwortungs- und Datenresidenzmatrix;
- IaC- oder Konfigurationsprototyp sowie mindestens ein Fehler-, Austauschbarkeits- oder Portabilitätstest für zwei tragfähige Zuschnitte.

**Entscheidung:** Technische ADR für eine Plattformarchitektur mit Schnittstellen-, Zustands-, Security-, Observability- und Exit-Vertrag sowie stärkster verworfener Alternative.

**Gegenalternative:** der private Zwei-Host-Pfad oder eine andere der drei Plattformvarianten.

**Alignment:** QZ4 und QZ5; MZ4, MZ5 und MZ9; LI09–LI14 sowie LI23; Themenblöcke TB05–TB06 und TB10–TB11.

### Thema 6 – Security-, Privacy- und Verantwortungsarchitektur für Q&A-Inferenz

**Leitfrage:** Wie werden Q&A-Daten und der private Inferenz-Tier so geschützt, dass Datenabfluss, Prompt- oder Model-Injection, Ressourcenerschöpfung und Supply-Chain-Risiken messbar begrenzt bleiben?

**Cloud-Kern:** IAM, Least Privilege, private Endpunkte, Secret-Verwaltung, Datenminimierung, Netzsegmentierung, Supply Chain und Shared Responsibility.

**Fallbezug:** Der Inferenzsnapshot darf nur erforderliche Texte und anonyme Quellschlüssel enthalten. Browser und Teilnehmende sprechen den Modellserver nicht direkt an; Modell- und Imageartefakte benötigen nachvollziehbare Herkunft.

**Verpflichtende Evidenz:**

- minimiertes Dateninventar und Ende-zu-Ende-Datenfluss;
- Bedrohungsmodell mit Vertrauensgrenzen und Verantwortlichkeiten;
- mindestens ein ausgeführter IAM- oder Netz-Negativtest;
- Test einer manipulierten, überlangen oder schemawidrigen Modellantwort;
- Nachweis von Image-Digest, GGUF-Prüfsumme, Modelllizenz und SBOM-Grenze;
- Aufbewahrungs-, Logging- und Löschentscheidung ohne personenbezogene Lehrdaten.

**Entscheidung:** Technische Security-Architektur für einen Self-hosted- oder Managed-AI-Pfad mit priorisierten Kontrollen, Negativtests und explizitem Restrisiko.

**Gegenalternative:** nicht generative, lokal begrenzte Analyse oder stärker verwalteter Dienst mit anderer Verantwortungsgrenze.

**Alignment:** QZ1, QZ2 und QZ5; MZ1, MZ5 und MZ8; LI03, LI13 und LI19; Themenblöcke TB01, TB06 und TB09.

### Thema 7 – Zustandsmodelle, Storage, Backup und Recovery

**Leitfrage:** Welche Zustände von arsnova.eu müssen wo gesichert werden, und welche Wiederherstellungsbehauptung lässt sich durch einen ausgeführten Restore tatsächlich belegen?

**Cloud-Kern:** persistenter, flüchtiger und lokaler Zustand, Datenbank- und Speicheroptionen, Backup, RPO, RTO, Integrität und Idempotenz.

**Fallbezug:** Zu unterscheiden sind PostgreSQL, Redis, Yjs und IndexedDB im Browser, Konfiguration, Exporte, GGUF-Modellartefakte sowie ephemere Analyse- und Queuezustände. Eine serverseitige Sicherung ersetzt keine lokale Browserkopie.

**Verpflichtende Evidenz:**

- Zustands-, Eigentums- und Sicherungsmatrix;
- begründete RPO und RTO je relevanter Zustandsklasse;
- ausgeführter Restore in eine isolierte Zielumgebung;
- Integritäts- und Vollständigkeitsprüfung sowie gemessene Wiederherstellungszeit;
- dokumentierter Umgang mit Redis-Verlust, Browserdaten und Modellartefakten.

**Entscheidung:** Technische Sicherungs- und Recovery-Architektur je Zustandsklasse mit begründetem Speicherort, Konsistenzmodell, RPO, RTO und Integritätsprüfung.

**Gegenalternative:** ein Managed-PostgreSQL- und Objektspeicherpfad oder vollständiger Neuaufbau aus Repository und gepinnten Artefakten.

**Alignment:** QZ2; MZ6; LI15–LI16; Themenblöcke TB03 und TB07.

### Thema 8 – Verteilte Skalierung, Observability und kontrollierte Degradation

**Leitfrage:** Benötigen 100 parallele Lehrveranstaltungen mit je 50 Teilnehmenden und eine Veranstaltung mit 5.000 Teilnehmenden unterschiedliche Cloud-, Realtime- und Inferenzstrategien?

**Cloud-Kern:** Elastizität, Scale-up, Scale-out, Affinität, verteilter Zustand, Queueing, Backpressure, Observability, SRE und Resilienz.

**Fallbezug:** Der aktuelle Single-Host-Pfad, PostgreSQL, Redis, tRPC-WebSockets, Yjs-Räume und der einzelne 8.9d-Inferenz-Slot besitzen unterschiedliche Skalierungs- und Fehlergrenzen. Historische oder lokale 500er-Nachweise sind keine 5.000er-Kapazitätszusage.

**Verpflichtende Evidenz:**

- getrennte Workloadmodelle für beide Profile;
- Scale-out-Hürdenkarte für App, Daten, Realtime, Yjs und Inferenz;
- Messplan oder isolierter Lastlauf mit p50, p95, p99, Durchsatz, Fehlerrate und Sättigung;
- SLI/SLO, Alarm und Runbook für mindestens einen kritischen Pfad;
- Fault-Injection mit Degradation, Recovery und Abbruchkriterium.

**Entscheidung:** Begründete Scale-up- oder Scale-out-Architektur je Lastprofil mit Routing-, Affinitäts-, Zustands-, Telemetrie- und Degradationsvertrag.

**Gegenalternative:** getrennte Architekturvarianten für viele kleine Sessions und eine große Session oder bewusste Kapazitätsbegrenzung.

**Alignment:** QZ2; MZ7 und MZ8; LI17–LI21; Themenblöcke TB08–TB09.

### Thema 9 – Performance-, Energie- und Ressourceneffizienz der privaten LLM-Inferenz

**Leitfrage:** Welche CPU-, GPU- oder Managed-AI-Ausführungsarchitektur erfüllt vorgegebene Latenz-, Durchsatz-, Qualitäts-, Energie- und Ressourcenbudgets für die private LLM-Inferenz?

**Cloud-Kern:** Modellquantisierung, Speicherbedarf, Parallelität, Batching, Auslastung, Sättigung, Latenz, Durchsatz, Energiebedarf, Performance pro Watt, Ressourceneffizienz und technisch induzierte Betriebskosten.

**Fallbezug:** ADR-0035 setzt zunächst eine CPU-basierte private Inferenzrolle mit einem Slot voraus. Eine GPU oder Managed AI sind Gegenalternativen, keine bereits beschlossenen Produktpfade.

**Verpflichtende Evidenz:**

- gemessene Zeit bis zum ersten Token, Tokens pro Sekunde, Erfolgs- und Fallback-Rate;
- CPU-, RAM- und gegebenenfalls GPU-Auslastung, Speicherbedarf, Sättigung und Energie je erfolgreichem Job;
- Qualitäts- und Ressourcenvergleich mindestens zweier Quantisierungs- oder Ausführungsvarianten auf identischer Eingabe;
- aus Messwerten abgeleitete Infrastruktur-, Energie- und Egresskosten je erfolgreichem Job als technische Betriebsgrenze;
- Laststufen- und Sensitivitätsanalyse mit klar getrennten Mess-, Hochrechnungs- und Schätzwerten.

**Entscheidung:** Technische Ausführungs- und Kapazitätsarchitektur für CPU, GPU oder Managed AI einschließlich Umschaltgrenzen für Latenz, Fehlerrate, Energie und Ressourcensättigung.

**Gegenalternative:** Encoder plus extraktive Ausgabe ohne LLM oder bedarfsgesteuerter verwalteter Inferenzdienst.

**Alignment:** QZ2 und QZ5; MZ5, MZ7 und MZ9; LI14, LI17 und LI22; Themenblöcke TB06, TB08 und TB10.

### Thema 10 – Technische 6R-Migration, Portabilität und Rollback

**Leitfrage:** Welche komponentenweise 6R-Strategie überführt den Single-Host-Pfad mit privater Inferenzrolle in eine portable Cloud-Zielarchitektur, deren Schnittstellen, Zustände, Fehlergrenzen und Rückweg technisch verifiziert sind?

**Cloud-Kern:** Rehost, Replatform, Repurchase, Refactor, Retire, Retain, Abhängigkeitsanalyse, Datenmigration, Schnittstellenkompatibilität, Lock-in, Rollback, Reversibilität und technischer Exit.

**Fallbezug:** Die Ausgangslage umfasst den belegten Single-Host-Stack und die zum Kursstart vorausgesetzte private 8.9d-Runtime. App, Datenbank, Redis, Realtime, Yjs, PDF und Inferenz können unterschiedliche 6R-Entscheidungen benötigen.

**Verpflichtende Evidenz:**

- komponentenweise 6R-Matrix mit Abhängigkeiten und Reihenfolge;
- Zielarchitektur mit Daten-, Netz-, Verantwortungs- und Betriebsgrenzen;
- technische Evidenz aus mindestens einem Migrations- oder Rückrollschritt in der Sandbox;
- Kompatibilitäts-, Konsistenz-, Performance-, Security- und Fehlertest vor und nach dem Migrationsschritt;
- Exit-Plan für Daten, Modelle, Konfiguration, Identitäten und Providerartefakte.

**Entscheidung:** Technische ADR für eine schrittweise Migration mit Abhängigkeitsreihenfolge, Akzeptanztests, stärkster verworfener Alternative, Abbruchkriterium und ausführbarem Rückweg.

**Gegenalternative:** langfristiges Retain des heutigen Betriebs, reines Rehosting oder Ersatz durch einen SaaS-Dienst.

**Alignment:** QZ1, QZ2 und QZ4; MZ1, MZ2, MZ4 und MZ9; LI01–LI02, LI06, LI11 sowie LI23–LI24; Themenblöcke TB01–TB03, TB05 und TB10–TB12.

## 7. Themenvergabe und Varianten

- Ein Thema darf nur mehrfach vergeben werden, wenn Systemgrenze, Hypothese, Testauftrag, Gegenalternative und individuelle Entscheidung eindeutig verschieden sind.
- Produkt- oder Providername allein bildet keine Themenvariante.
- Bei Gruppenreferaten müssen individuelle Beiträge in Einreichung, Vortrag und Befragung klar kenntlich sein.
- Die prüfende Person stellt für jedes Thema den verbindlichen Kurs-Commit, zulässige Zielumgebung, Datenbasis, Kostenlimit und Sicherheitsrahmen bereit.
- Providerangaben zu APIs, Limits, Regionen und technisch verursachten Abrechnungseinheiten werden bei Themenvergabe erneut geprüft; veraltete Lehrwerte sind keine Prüfungsquelle.
- Die Themen 4, 6 und 9 setzen einen tatsächlich nachgewiesenen 8.9d-Kursstand voraus. Ist das Gate nicht erfüllt, muss die Aufgabe den LLM-Pfad ausdrücklich als Zielbild oder isoliertes Testharness bezeichnen.

## 8. Verbindliche Grundlagen

- [Modulkonzept Cloud Computing](./Modulkonzept_Cloud_Computing.md)
- [Lernziel- und Alignment-Matrix](./Lernziel_Alignment_Matrix.md)
- [Technische Quellen zu arsnova.eu](./Technische_Quellen_ARSnova.md)
- [Datenmanagement und Datenschutz](./Datenmanagement_Datenschutz.md)
- [Lehrenden-Runbook](./Lehrenden_Runbook.md)
- [Formale Referatsumsetzung im Altmaterial](../CLOUD-COMPUTING-REFERAT-PRUEFUNG.md)
- [ADR-0035 zur privaten LLM-Runtime](../../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md)
