<!-- markdownlint-disable MD013 MD060 -->

# Agentic Cloud Engineering Muster-Dossier: Fallstudie arsnova.eu

Dieses Dokument ist eine **Arbeitskopie für Informatik-Bachelorstudierende** im Modul Cloud Computing (`DSCC0127`). Es zeigt, wie du eine echte Anwendung beschreibst, ohne Code, Messung und Wunschbild zu vermischen. Es gehört **nicht** zum verbindlichen Materialindex.

**Was du hier findest:** eine Lesehilfe, vier Evidenzstufen, die zwölf Themenblöcke und eine Liste typischer KI-Fehler. **Was du hier nicht findest:** eine Prüfungsnote, eine Produktivfreigabe oder eine Anleitung zum Kopieren ungeprüfter KI-Texte.

**Geprüft am:** 2026-10-25 gegen Branch `main`, Commit `4d81982de255` (24.10.2026). Ein älterer NotebookLM-Text nannte Commit `beab199d62c0` (13.09.2026). Dieser Commit ist ein Vorfahre, aber nicht mehr der aktuelle Prüfstand.

## Lesehilfe

Lies diese Begriffe, bevor du die Tabellen nutzt. Im Text steht die Langform beim ersten Auftreten, danach die Kurzform.

| Begriff                                                           | Bedeutung in diesem Dossier                                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **arsnova.eu**                                                    | Die Fallstudie: ein Audience-Response-System (Live-Abstimmung im Hörsaal).                                        |
| **Repository / Repo**                                             | Das Git-Projekt mit Quellcode und Dokumentation.                                                                  |
| **Commit**                                                        | Ein fester Stand im Git-Verlauf, erkennbar an einem Hash wie `4d81982de255`.                                      |
| **Checkout / Prüfstand**                                          | Der Commit, gegen den Aussagen geprüft wurden.                                                                    |
| **Themenblock (TB01–TB12)**                                       | Die zwölf Inhaltsblöcke des Moduls.                                                                               |
| **Unterrichtseinheit (UE)**                                       | 45 Minuten Lehre. Das Modul hat 36 UE in acht Vorlesungswochen.                                                   |
| **Credit Point (CP)**                                             | Leistungspunkt. Das Modul hat 5 CP (150 Stunden, davon 123 Stunden Selbststudium).                                |
| **Infrastructure as a Service (IaaS)**                            | Du mietest eine virtuelle Maschine und betreibst Betriebssystem, Container und Anwendung selbst.                  |
| **Platform as a Service (PaaS)**                                  | Der Anbieter übernimmt Betriebssystem und oft die Laufzeit. Du lieferst die Anwendung.                            |
| **Software as a Service (SaaS)**                                  | Fertige Anwendung im Browser. Du betreibst keinen Server.                                                         |
| **Infrastructure as Code (IaC)**                                  | Infrastruktur steht in versionierten Textdateien statt nur in Klick-Dialogen.                                     |
| **Shared Responsibility**                                         | Die geteilte Verantwortung zwischen Cloud-Anbieter und Betreiber.                                                 |
| **Single-Host**                                                   | Alles läuft auf **einem** Server. Fällt er aus, fällt der Dienst aus.                                             |
| **vHost / virtuelle Maschine (VM)**                               | Ein gemieteter Rechner beim Anbieter. **vCPU** ist eine zugeteilte Prozessorkerneinheit.                          |
| **Host (Betrieb)**                                                | Der physische oder virtuelle Server, auf dem Container laufen.                                                    |
| **Host (arsnova)**                                                | Die Lehrperson, die eine Live-Session steuert.                                                                    |
| **Container / Docker**                                            | Isolierter Prozess mit eigenem Dateisystem. Leichter als eine volle VM.                                           |
| **Docker Compose**                                                | Datei, die mehrere Container und ihr Netz beschreibt. `docker-compose.prod.yml` ist die Produktionssolltopologie. |
| **Kubernetes (K8s)**                                              | Orchestrierung vieler Container über mehrere Rechner. Hier **nicht** implementiert.                               |
| **Sidecar**                                                       | Ein Extra-Container neben der Hauptanwendung, zum Beispiel für Sprachverarbeitung.                                |
| **Unix-Socket**                                                   | Datei im Dateisystem, über die zwei Prozesse auf **demselben** Rechner sprechen. Kein Netzwerkport nach außen.    |
| **Reverse Proxy**                                                 | Nimmt Anfragen von außen entgegen und reicht sie intern weiter. Hier: **Nginx** auf dem Host.                     |
| **TLS**                                                           | Transport Layer Security, die Verschlüsselung hinter `https://`.                                                  |
| **Loopback / `127.0.0.1`**                                        | Nur auf demselben Rechner erreichbar, nicht aus dem Internet.                                                     |
| **PostgreSQL**                                                    | Relationale Datenbank für dauerhafte Daten (Sessions, Stimmen, Fragen).                                           |
| **Redis**                                                         | Sehr schneller Speicher im Arbeitsspeicher, hier für Limits und kurzlebige Live-Daten.                            |
| **Prisma**                                                        | Object-Relational Mapping (ORM): TypeScript-Zugriff auf PostgreSQL. Lockstand `7.9.1`.                            |
| **Node.js**                                                       | JavaScript-Laufzeit auf dem Server. Vorgabe in `.nvmrc`: `24.18.0`.                                               |
| **Express**                                                       | HTTP-Serverbibliothek im Backend. Lockstand `5.3.0`.                                                              |
| **tRPC**                                                          | Typisierte Programmierschnittstelle (API) zwischen Frontend und Backend.                                          |
| **Angular**                                                       | Frontend-Framework. Lockstand `@angular/core` `22.2.3`.                                                           |
| **Zod**                                                           | Bibliothek für Laufzeit- und Typprüfung von Daten. Lockstand `4.6.6`.                                             |
| **Yjs**                                                           | Bibliothek für Local-First-Sync (Quizsammlung im Browser). Lockstand `13.6.31`.                                   |
| **IndexedDB**                                                     | Datenbank im Browser. Die Quizbibliothek lebt dort, nicht im Server-Backup.                                       |
| **WebSocket**                                                     | Offene Verbindung für Live-Updates statt vieler einzelner HTTP-Aufrufe.                                           |
| **ONNX**                                                          | Austauschformat für maschinelle Lernmodelle. Der Encoder nutzt ONNX Runtime auf der CPU.                          |
| **LLM**                                                           | Large Language Model, hier ein privates Sprachmodell über `llama.cpp`.                                            |
| **spaCy**                                                         | Lokales Sprachverarbeitungswerkzeug (Lemmatisierung für Wortwolken).                                              |
| **Kill-Switch / Feature-Flag**                                    | Umgebungsvariable, die eine Funktion an- oder ausschaltet. Defaults sind `false`.                                 |
| **Circuit Breaker**                                               | Schutzschalter: nach wiederholten Fehlern wird ein Dienst eine Zeit lang nicht mehr aufgerufen.                   |
| **Fallback**                                                      | Ersatzweg, wenn der teure oder unsichere Weg ausfällt.                                                            |
| **Restic**                                                        | Backup-Programm. Verschlüsselt Daten **vor** der Übertragung.                                                     |
| **SFTP**                                                          | Dateiübertragung über SSH. Hier der Weg zur Hetzner Storage Box.                                                  |
| **Recovery Point Objective (RPO)**                                | Wie viel Datenverlust (in Zeit) ist höchstens akzeptabel?                                                         |
| **Recovery Time Objective (RTO)**                                 | Wie schnell soll der Dienst nach einem Ausfall wieder laufen?                                                     |
| **Service Level Indicator (SLI)**                                 | Was du misst, zum Beispiel Fehlerquote oder Latenz.                                                               |
| **Service Level Objective (SLO)**                                 | Das Ziel zu diesem Messwert, zum Beispiel p95 unter 1.000 ms.                                                     |
| **Perzentil (p50, p95, p99)**                                     | p95 heißt: 95 Prozent der Messwerte liegen darunter oder genau darauf. Der Rest ist der langsame Schwanz.         |
| **Latenz**                                                        | Wartezeit bis zur Antwort.                                                                                        |
| **Rate-Limit**                                                    | Obergrenze, wie oft eine Aktion in einem Zeitfenster erlaubt ist.                                                 |
| **Shared NAT**                                                    | Viele Endgeräte teilen sich eine öffentliche IP, typisch im Campus-WLAN.                                          |
| **Identity and Access Management (IAM)**                          | Wer darf was? Tokens, Rollen, Prüfung auf dem Server.                                                             |
| **Site Reliability Engineering (SRE)**                            | Betrieb mit messbaren Zielen statt nur Bauchgefühl.                                                               |
| **Financial Operations (FinOps)**                                 | Technikentscheidungen zusammen mit Kosten.                                                                        |
| **Total Cost of Ownership (TCO)**                                 | Gesamtkosten, nicht nur die monatliche VM.                                                                        |
| **6R**                                                            | Migrationsoptionen: Rehost, Replatform, Repurchase, Refactor, Retire, Retain.                                     |
| **Architecture Decision Record (ADR)**                            | Kurze, nachvollziehbare Architekturentscheidung. ADR-0040 **existiert nicht**.                                    |
| **Google Cloud Platform (GCP), Amazon Web Services (AWS), Azure** | Die drei großen Hyperscaler. Sie sind hier ein Lehrvergleich, keine gewählte Plattform.                           |
| **Hetzner**                                                       | IaaS-Anbieter in den Betriebsdokumenten (Cloud- oder Root-Server).                                                |
| **CAX31 / CPX32**                                                 | Hetzner-Tarife mit 8 vCPU und 16 GB RAM. Nicht 32 GB.                                                             |
| **NotebookLM**                                                    | KI-Werkzeug, das aus Quellen einen Text erzeugt. Dieser Text war der Ausgangspunkt und enthielt Fehler.           |
| **Agent / agentisch**                                             | Ein KI-System, das Schritte plant. Es ersetzt keine Prüfung gegen das Repository.                                 |
| **Evidenz**                                                       | Beleg. Ohne Datei, Test oder Messung ist eine Aussage ein Zielbild.                                               |

## 1. Wozu dieses Dossier?

Du sollst arsnova.eu wie ein Cloud-Ingenieur beschreiben: **Was steht im Code? Was wurde wo gemessen? Was ist nur eine Idee?**

Drei Sätze, die du dir merken kannst:

1. **Code beweist Code**, nicht dass der Dienst gerade läuft.
2. **Ein lokaler Test beweist dein Notebook**, nicht das Hörsaal-Internet.
3. **Ein Zielbild ist kein Nachweis.** `100 × 50` Sessions oder `1 × 5.000` Teilnehmende sind ungetestet.

Das Modulkonzept steht in [Modulkonzept_Cloud_Computing.md](./Modulkonzept_Cloud_Computing.md). Die betriebliche Einordnung steht in [CLOUD-COMPUTING-EINORDNUNG-BETRIEBLICH.md](../../implementation/CLOUD-COMPUTING-EINORDNUNG-BETRIEBLICH.md).

| Feld                | Festlegung                                          |
| ------------------- | --------------------------------------------------- |
| Modul               | Cloud Computing, `DSCC0127` / Kurs `DSCC012701`     |
| Umfang              | 5 CP, 150 Stunden, 36 UE, 123 Stunden Selbststudium |
| Fallstudie          | arsnova.eu, Branch `main`, Prüfstand `4d81982de255` |
| Status dieser Datei | Arbeitskopie, nicht im Materialindex                |
| Zielgruppe          | nur Informatik-Bachelorstudierende                  |

**Datenschutz in deiner Ausarbeitung:** keine Klarnamen, keine echten Passwörter, keine API-Schlüssel, keine `.env`-Inhalte, keine Datenbank-Dumps, keine unmaskierten Logs. Tool-Nicknames darfst du nicht mit LMS-Listen oder Noten verbinden.

## 2. Vier Evidenzstufen

Bevor du eine Zahl oder eine Architekturbehauptung aufschreibst, ordne sie einer Stufe zu.

| Stufe                       | Frage                                         | Beispiel arsnova.eu                                                                                                                                                                                                                                        | Darf ich daraus schließen …                                                                                  |
| --------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **1. Implementiert**        | Steht es im Repo?                             | `docker-compose.prod.yml`: App, PostgreSQL 16, Redis 7.4, PDF-Worker. Nginx läuft **auf dem Host**, nicht als Compose-Dienst.                                                                                                                              | … dass der Quelltext existiert. Nicht: dass Produktion gerade fehlerfrei läuft.                              |
| **2. Lokal verifiziert**    | Gibt es einen datierten lokalen oder CI-Lauf? | [Baseline 12.07.2026](../../implementation/LOCAL-BASELINE-FREIGABE-2026-07-12.md), Commit `e3285372`: 500 von 500 Joins, Stimmen und WebSockets; 30 Yjs-Clients; 30 Minuten Soak. Backend über `npm run dev:backend`, Docker nur für PostgreSQL und Redis. | … dass dieser Lauf auf dieser Hardware geklappt hat. Nicht: ein Produktions-SLO.                             |
| **3. Produktiv beobachtet** | Gibt es eine Messung an der echten Instanz?   | [Join-Test 09.05.2026](../../implementation/LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md): 500 Joins, 0 HTTP-Fehler, Median 997,57 ms, p95 3,57 s, Maximum 6,7 s. Ziel war p95 unter 3 s.                                                                  | … etwas über **diese Join-Welle an diesem Tag**. Nicht: Abstimmungsspitzen oder Dauerbetrieb. Ein p99 fehlt. |
| **4. Zielbild**             | Ist es nur geplant?                           | `100 × 50` und `1 × 5.000` in der Einordnung.                                                                                                                                                                                                              | … dass das eine Untersuchungsfrage ist. Nicht: dass es gebaut oder getestet ist.                             |

## 3. Quellen am Prüfstand

Die konkreten Versionen stehen in `.nvmrc`, `package.json` und `package-lock.json`. Die Lockdatei gewinnt, wenn Prosa und Lock sich unterscheiden.

| Quelle                                                                                                                                     | Was sie belegt                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `.nvmrc`                                                                                                                                   | Node.js `24.18.0`                                                             |
| Root-`package.json`                                                                                                                        | Erlaubte Engine: `>=22.22.3 <23` oder `>=24.15.0 <25`                         |
| `package-lock.json`                                                                                                                        | Prisma `7.9.1`, Express `5.3.0`, Angular `22.2.3`, Zod `4.6.6`, Yjs `13.6.31` |
| [docker-compose.prod.yml](../../../docker-compose.prod.yml)                                                                                | Solltopologie der Container                                                   |
| [SECURITY-HARDENING-PLAN.md](../../SECURITY-HARDENING-PLAN.md) und [BACKUP-RESTORE-RUNBOOK.md](../../operations/BACKUP-RESTORE-RUNBOOK.md) | Härtung und Backup, Stand 26.07.2026                                          |
| [LOCAL-BASELINE-FREIGABE-2026-07-12.md](../../implementation/LOCAL-BASELINE-FREIGABE-2026-07-12.md)                                        | lokaler 500er-Nachweis                                                        |
| [LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md](../../implementation/LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md)                          | historischer Produktions-Join                                                 |

**Drei Agentenrollen** (Architect, Auditor, Labor) mit Token- und Eurobudgets sind **Regeln für diese Arbeitskopie**. Sie sind im Produkt nicht eingebaut. Wenn du sie nutzt, bleibt die Regel: kein Schreiben in Produktion, keine Secrets, Abbruch bei unmaskierten personenbezogenen Daten.

## 4. Die zwölf Themenblöcke

### TB01 – Cloud-Modelle und geteilte Verantwortung

**In einem Satz:** arsnova.eu läuft als **selbst betriebener Single-Host auf IaaS**, nicht als elastische Cloud mit vielen Instanzen.

Du mietest typischerweise eine VM (in den Docs: Hetzner Cloud oder Root-Server mit Debian). Darauf installierst du Docker, Nginx und die Anwendung. Der Anbieter liefert Strom, Rechenzentrum und die VM. **Patchen, Firewalls, Backups und Wiederherstellung bleiben bei dir.**

| Wer macht was?                               | IaaS, selbst betrieben (Ist) | PaaS (nicht gewählt)                                   |
| -------------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| Rechenzentrum und Hardware                   | Anbieter                     | Anbieter                                               |
| Betriebssystem, Firewall, Nginx, Zertifikate | Betreiber                    | oft der Anbieter                                       |
| Container-Runtime und Compose                | Betreiber                    | Runtime oft Anbieter, App-Definition bei dir           |
| Anwendungscode                               | Betreiber                    | Betreiber                                              |
| PostgreSQL, Redis, Restic, Daten             | Betreiber                    | nur dann Anbieter, wenn du einen Managed-Dienst buchst |

Traditional Hosting, IaaS, PaaS und SaaS sind **Lehrkategorien**. Eine Umschaltung auf PaaS oder SaaS ist im Repository **nicht beschlossen**.

**Für dich:** IaaS ist oft günstiger am Anfang und teurer an Arbeitszeit. Wenn du „wir sind in der Cloud“ schreibst, sag genau welches Dienstmodell.

### TB02 – Virtualisierung, Container, Netz

| Stufe          | Was das ist                                 | Stand bei arsnova.eu                                                                  |
| -------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| Bare-Metal     | echter Server ohne Hypervisor               | nur die unterste Ebene des Anbieters, kein eigener Nachweis                           |
| VM             | eigener Kernel in einer virtuellen Maschine | dokumentierter App-Host: **8 vCPU, 16 GB RAM** (Tarife CAX31 oder CPX32, nicht 32 GB) |
| Container      | Prozesse mit Namespaces und cgroups         | App, PostgreSQL, Redis, PDF-Worker; optional spaCy, Encoder, LLM                      |
| Compose        | mehrere Container in einer Datei            | implementiert                                                                         |
| Kubernetes     | Cluster über viele Rechner                  | **nicht** implementiert, kein Beschluss                                               |
| IaC für die VM | VM per Skript bestellen                     | **nicht** implementiert; es gibt Compose und eine manuelle Anleitung                  |

**Netz, einfach gezeichnet:**

```text
Internet
  └─► Nginx auf dem Host (Port 80 und 443, TLS)
        └─► nur Loopback 127.0.0.1
              ├─► 3000 HTTP
              ├─► 3001 tRPC-WebSocket
              └─► 3002 Yjs-WebSocket

PostgreSQL (5432) und Redis (6379) haben keine Host-Ports.
Sie sind nur im internen Compose-Netz „app“ erreichbar.
```

**Warum nicht einfach drei App-Server?** Live-Signale hängen heute an `EventEmitter` **in einem Prozess**. WebSockets brauchen eine feste Instanz (Affinität). Limits gelten pro Prozess. Ein gemeinsamer Nachrichtenbus fehlt. Das ist eine **offene Lücke**, kein vorhandener Dienst.

### TB03 – Deployment, Härtung, Zustand

**Ist-Bild:** ein Host, Nginx als TLS-Ende, Node.js mit Express und tRPC, PostgreSQL 16, Redis 7.4, ein eigener PDF-Worker.

**Härtung** heißt: der Container darf so wenig wie möglich. In der Produktions-Compose für App, PDF-Worker und optionale Sidecars:

- `read_only: true` – das Wurzeldateisystem ist schreibgeschützt.
- `cap_drop: - ALL` – Linux-Sonderrechte sind entzogen.
- `no-new-privileges:true` – Rechte dürfen nicht nachträglich steigen.

PostgreSQL und Redis haben diese drei Schalter **nicht**. PDF-Worker, spaCy und Encoder nutzen `network_mode: none`: **kein IP-Netz**, nur Unix-Sockets.

| Zustand                    | Wo                                                                               | Backup?                                                                       |
| -------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Persistent** (dauerhaft) | PostgreSQL, Docker-Volume                                                        | ja: täglicher Dump plus `.env.production`, mit Restic verschlüsselt über SFTP |
| **Flüchtig**               | Redis (AOF jede Sekunde, zusätzlich Snapshot alle 60 s bei einem Schreibvorgang) | **nein**, bewusst. Kurzlebige Rechte können neu erzeugt werden.               |
| **Local-First**            | Browser, IndexedDB und Yjs                                                       | **nein**. Der Server ist nur Relay, nicht das Backup der Quizbibliothek.      |

### TB04 – Serverless, ja oder nein?

**Serverless / Function as a Service (FaaS)** heißt: der Anbieter startet Code pro Anfrage und skaliert oft bis auf null. **Backend as a Service (BaaS)** liefert fertige Bausteine (Login, Datenbank).

Die nächste Tabelle ist eine **Eignungsübung**, nicht der Ist-Betrieb. Der PDF-Export ist heute ein **dauerhaft laufender** Container. WebSockets laufen **im App-Prozess**.

| Frage                   | PDF-Worker                                 | WebSocket und Yjs                     |
| ----------------------- | ------------------------------------------ | ------------------------------------- |
| Wie startet die Arbeit? | Aufruf über Unix-Socket                    | offene Verbindung über Minuten        |
| Stört ein Kaltstart?    | eher nein, Nutzer wartet auf die Datei     | ja, die Live-Session bricht           |
| Wie lange läuft es?     | Sekunden bis eine Minute (Timeout 60 s)    | die ganze Veranstaltung               |
| Passt FaaS?             | als Gedanke diskutierbar, **nicht gebaut** | passt nicht zum reinen Request-Modell |

**Für dich:** „PDF könnte FaaS sein“ ist erlaubt, wenn du sagst, dass es heute keiner ist. „WebSocket ist Serverless“ ist falsch.

### TB05 – GCP, AWS, Azure

Die drei Hyperscaler sind **nicht** die Produktionsplattform. Du vergleichst sie auf **derselben Systemgrenze**, sonst vergleichst du Äpfel mit Birnen.

| Aufgabe                  | GCP                  | AWS                             | Azure                         |
| ------------------------ | -------------------- | ------------------------------- | ----------------------------- |
| Container laufen lassen  | Cloud Run / GKE      | App Runner / ECS / EKS          | Container Apps / AKS          |
| PostgreSQL verwaltet     | Cloud SQL            | RDS                             | Azure Database for PostgreSQL |
| Redis verwaltet          | Memorystore          | ElastiCache                     | Azure Cache for Redis         |
| Eingang / Lastverteilung | Cloud Load Balancing | Application Load Balancer (ALB) | Azure Load Balancer           |
| Metriken und Logs        | Cloud Monitoring     | CloudWatch                      | Azure Monitor                 |

Rechenzentren in der EU (zum Beispiel Frankfurt) helfen bei der Datenschutz-Grundverordnung (DSGVO). Ein juristisches Restrisiko durch den US Cloud Act bleibt eine **Rechtsfrage**, kein Codebeleg.

Was den Wechsel zu einem anderen IaaS erleichtert: gewöhnliche Docker-Container, Standard-PostgreSQL, HTTP und WebSocket. Ein **durchgeführter** Umzug ist nicht belegt.

Öffentliche SaaS-Adressen für das Sprachmodell lehnt die Funktion `resolveOpenWeightLlmUrl` ab. Das ist eine **Anwendungssperre**, kein Nachweis, dass ihr den Cloud-Anbieter wechseln könnt.

### TB06 – Daten und maschinelles Lernen

Die Stufen sind **im Code vorhanden** und in den Repository-Defaults **aus**. In `.env.example`:

- `NLP_ENABLED=false` (spaCy)
- `WORD_CLOUD_SEMANTIC_ENABLED=false` (Themencluster)
- `QA_NLP_ENABLED=false` (Fragen-Kategorien)
- `QA_SUMMARY_ENABLED=false` (Kompass-Kurzfassung)
- `OPEN_WEIGHT_LLM_ENABLED=false` (privates Sprachmodell)

Eine allgemeine Produktivfreigabe dieser Schalter ist nicht belegt. Für das Sprachmodell gibt es einen einzelnen dokumentierten Messlauf; der Default bleibt `false`.

```text
Browser (Freitext)
  └─► Backend räumt personenbezogene Extrafelder weg
        ├─► 1. Wörter zählen (lexikalisch)
        ├─► 1b. spaCy-Sidecar: Wortformen zusammenziehen (Story 1.14b)
        ├─► 2. Naive Bayes + k-NN im selben Prozess: Fragekategorie (Story 8.9b)
        ├─► 3. ONNX-Encoder: ähnliche Sätze clustern (Stories 1.14c/1.14d)
        └─► 4. Privates LLM auf einem zweiten Rechner (ADR-0035)
```

**Sprache der Themenwolke:** Deutsch und Englisch gehen durch den Encoder. Französisch und Spanisch fallen auf das Zählen von Wörtern zurück. Italienisch ohne gewählte unterstützte Wolkensprache bleibt lokal und schickt keinen Analyseauftrag.

|                   | Wörter / spaCy        | Encoder                                               | Privates LLM                                                              |
| ----------------- | --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Wo läuft es?      | Sidecar, 1 CPU, 1 GiB | Sidecar, bis 4 CPU, 2 GiB, höchstens 4 Rechen-Threads | Modell `Qwen3-4B-Instruct-2507-Q4_K_M`, nur CPU, ein Auftrag gleichzeitig |
| Standard          | aus                   | aus                                                   | aus                                                                       |
| Öffentliches SaaS | nein                  | nur Loopback oder privates Netz                       | öffentliche Hosts verboten                                                |
| Wenn es ausfällt  | Originalwörter        | lexikalische Wolke                                    | Kurzfassung aus Quelltexten, Mitgliedstext oder manuelle Lernziele        |

Der Schutzschalter des Encoders sitzt in `wordCloudSemanticAnalyze.ts`: nach 3 Fehlern 30 Sekunden Pause. Ein ausgefallenes Sprachmodell ersetzt **nicht** still alle Funktionen durch dieselbe Wortwolke.

**Naive Bayes** ist ein einfacher Wahrscheinlichkeits-Klassifikator. **k-NN** (k nächste Nachbarn) ist der Fallback im **selben** Node-Prozess, kein Sidecar.

### TB07 – Speicher und Wiederherstellung

| Was             | Art                      | Kommt es ins Offsite-Backup?                                             |
| --------------- | ------------------------ | ------------------------------------------------------------------------ |
| PostgreSQL 16   | Tabellen über Prisma     | ja, Restic, clientseitig verschlüsselt, SFTP, eigener Storage-Box-Zugang |
| Redis 7.4       | Arbeitsspeicher plus AOF | nein                                                                     |
| IndexedDB / Yjs | Browser der Lehrperson   | nein                                                                     |

Ziele aus dem [Backup-Runbook](../../operations/BACKUP-RESTORE-RUNBOOK.md) (26.07.2026):

- **RPO:** höchstens 24 Stunden plus höchstens 15 Minuten zufällige Verzögerung.
- **RTO:** höchstens 4 Stunden, **sobald ein Ersatzrechner bereitsteht**.
- 14 tägliche Snapshots.

Es gibt **kein** belegtes Skript, das in diesen 4 Stunden selbst eine neue VM beim Anbieter bestellt.

Am 26.07.2026 klappte ein isolierter Restore mit **21 Tabellen**. Heute hat `schema.prisma` **40 Modelle**. 21 ist der historische Test, nicht die aktuelle Tabellenzahl. Mitgesichert wird `.env.production`. Zertifikate, Docker-Images und Nginx-Dateien kommen aus Git, Deployment und Certbot, nicht aus Restic.

### TB08 – Skalierung

Zwei **gemessene** Horizonte:

**Lokal, 12.07.2026, Commit `e3285372`**

- 500 von 500 Joins, Stimmen, WebSockets
- 500 von 500 Wiederverbindungen
- 30 Yjs-Clients: Verbinden p95 73 ms, Wiederverbinden p95 324 ms, Abgleich 6 ms
- 30 Minuten Dauerlauf: HTTP-p95 16,7 ms

Für die 500er-Artillery-Session selbst stehen im Freigabetext **keine** p50/p95/p99-Latenzen.

**Produktion, 09.05.2026**

- 500 Joins, keine HTTP-Fehler
- Mittel 1,25 s, Median 997,57 ms, p90 2,81 s, p95 3,57 s, Maximum 6,7 s
- kein p99 im Bericht

Zwei **ungemessene** Zielbilder:

| Profil                     | Was daran schwer ist                          | Messung? |
| -------------------------- | --------------------------------------------- | -------- |
| 100 Sessions × 50 Personen | viele Räume, viel Zustand                     | nein     |
| 1 Session × 5.000 Personen | ein Hotspot, viele gleichzeitige Verbindungen | nein     |

Ein Absturz von Node oder Redis bei 5.000 Clients steht **nicht** im Repository. Was belegt ist: Signale sind prozesslokal, WebSockets brauchen Affinität, Limits sind nicht instanzübergreifend.

### TB09 – Sicherheit, SRE, Resilienz

| Risiko                  | Was der Code tut                                                                                                                                                                                          | Was du nicht behaupten solltest                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Gestohlenes Host-Token  | `hostProcedure` in `trpc.ts` prüft das Token über `hostAuth.ts`. Falsch oder fehlend → tRPC-Fehler `UNAUTHORIZED`.                                                                                        | „Es kommt immer HTTP 403.“ Das ist hier nicht der Vertrag.                              |
| Session-Code raten      | Nach 5 Fehlversuchen je anonymem Client in 60 Sekunden: `TOO_MANY_REQUESTS`. Zusätzlich Soft-Caps (600 je Code, 5.000 global) mit 100–1.500 ms Pause. Gültige Joins laufen **nicht** durch dieses Skript. | „Jeder Fehlversuch ist sofort 429.“ Zuerst kommt oft nur eine Verzögerung.              |
| Hörsaal hinter einer IP | Stimmen zählen pro `participantId`, Standard **1 Anfrage pro Sekunde**. Nicht pro IP. Sonst würde das Campus-WLAN den ganzen Saal sperren.                                                                | „500 Anfragen derselben IP wurden alle akzeptiert.“ Dieser Lauf ist nicht dokumentiert. |

**ADR-0021** (Betriebsampel für ausgewählte Live-Aufrufe): `stable`, wenn die Fehlerquote höchstens 0,5 % ist, p95 höchstens 1.000 ms und p99 höchstens 2.000 ms. Das ist **nicht** dasselbe wie ein frei erfundenes Vote-SLO „99,5 % und p95 unter 2 s je Session“.

Eine formale 500er-Gesamtfreigabe unter Produktionsnähe ist in der Einordnung **offen**.

### TB10 – Kosten, Energie, 6R

Quelle: [Hetzner-Kostenrechenblatt](../../implementation/CLOUD-COMPUTING-HETZNER-KOSTENVORSCHLAG.md), Preise vom 28.07.2026. **Keine Bestellfreigabe.** Der App-Host hat 8 vCPU und 16 GB RAM.

| Rechenbeispiel                  | Inhalt                                                | netto / Monat | brutto / Monat |
| ------------------------------- | ----------------------------------------------------- | ------------- | -------------- |
| **S0** Ist-Nähe                 | 1× CAX31, IPv4, 40 GB Volume, Object Storage          | 28,25 €       | 33,62 €        |
| **S1a** getrennte Testtopologie | App-VM, DB-VM, Redis-VM, 100 GB, IPv4, Object Storage | 203,37 €      | 242,01 €       |

Die runden Zahlen **35 €** und **280 €** stehen so **nicht** im Blatt. 35,49 € netto ist der Einzelpreis eines CPX32, nicht die Ist-Summe. Verwaltete (managed) Datenbanken sind in S0/S1a nicht enthalten. S2 und S3 sind Empfindlichkeitsrechnungen ohne Messung. Ein CO₂-Vergleich ist **nicht** gemessen.

**6R, merksatzweise:**

| R          | Alltagsdeutsch          | Rolle hier                                |
| ---------- | ----------------------- | ----------------------------------------- |
| Retain     | behalten                | Ist-Pfad zuerst stabilisieren             |
| Rehost     | umziehen ohne Umbau     | VM und Compose bleiben ähnlich            |
| Replatform | Dienstgrenzen ändern    | zum Beispiel Datenbank getrennt betreiben |
| Refactor   | Code/Architektur ändern | nur nach Messung                          |
| Repurchase | fertigen Dienst kaufen  | zum Beispiel Managed-Datenbank            |
| Retire     | abschalten              | nur nachweislich Überholtes               |

[CLOUD-COMPUTING-6R-EINORDNUNG.md](../../implementation/CLOUD-COMPUTING-6R-EINORDNUNG.md) nennt Retain/Rehost, dann Replatform, dann gemessenes Refactor als **Hypothese**, nicht als Vorstandsbeschluss. Kubernetes wird dort weder gewählt noch förmlich verworfen.

**ADR-0035** entscheidet nur das Sprachmodell: privates `llama.cpp` auf einem **zweiten** CPU-Rechner. Auf dem 16-GB-Live-Host kein LLM neben spaCy und Encoder. Ein ADR-0040 gibt es nicht.

### TB11 – These für das Referat

Eine These, die das Repository trägt:

> arsnova.eu läuft auf einem Server: Nginx auf dem Host, ein App-Container, PDF-, spaCy- und Encoder-Arbeit über Unix-Sockets. Das Sprachmodell gehört auf einen zweiten privaten CPU-Rechner (ADR-0035). Viele parallele Sessions oder 5.000 Personen in einem Raum sowie verwaltetes Kubernetes sind ungetestete Zielbilder. Es gibt dazu keine ADR.

```text
IST, gebaut                          ZIELBILD, ungetestet
ein Host, Nginx + TLS                mehrere App-Instanzen
App nur auf 127.0.0.1:3000–3002      gemeinsame Events und Limits
PostgreSQL und Redis daneben         getrennte Datenbank und Cache
PDF, spaCy, Encoder per Socket       WebSocket-Failover
LLM auf zweitem Host                 LLM bleibt eigener Host
S0: 28,25 € netto / Monat            S1a: 203,37 € netto / Monat
```

Der Q&A-Klassifikator läuft **in** der App, nicht im Socket. Ein LLM auf demselben Host wie spaCy und Encoder ist nur Labor.

### TB12 – Probeverteidigung

Die Note im Referat verteilt sich laut [CLOUD-COMPUTING-REFERAT-PRUEFUNG.md](../../CLOUD-COMPUTING-REFERAT-PRUEFUNG.md) auf **30 % Schrift**, **30 % Vortrag**, **40 % Gespräch**. Das ist die Prüfungsordnung, kein eigenes Verteidigungsprotokoll dieses Textes.

**Frage:** Was passiert, wenn 5.000 Personen gleichzeitig abstimmen?

**Antwort, die das Repo trägt:** Das ist nicht gemessen. Jede Person darf standardmäßig **eine** Abstimmungsanfrage pro Sekunde. Zu viele Anfragen beantwortet die **App** mit `TOO_MANY_REQUESTS`, nicht Nginx am Eingang. Ob ein einzelner Host das trägt, weißt du nicht.

**Frage:** Die eine VM fällt aus. Ist das vertretbar?

**Antwort, die das Repo trägt:** Der Live-Dienst ist dann weg. Die Wiederherstellung von PostgreSQL und `.env.production` soll in höchstens 4 Stunden gelingen, **wenn** ein Ersatzrechner schon da ist. Quizdateien im Browser und Redis sind nicht im Restic-Backup. Ob das für die Hochschule reicht, ist eine Betriebsentscheidung, kein Code-Beschluss.

| Typischer Fehler                                        | Korrekte Formulierung                                                                                 |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| „Lokal 120 ms, Produktion p99 5,2 s, Zielbild 1.200 ms“ | Lokal: Zähler und einzelne andere p95. Produktion: Median, p90, p95, Maximum. Zielbilder: keine Zahl. |
| „Wir nehmen eine GPU-Cloud“                             | ADR-0035: nur CPU, `llama.cpp`.                                                                       |
| „Der Host kostet 35 €, die Cloud 280 €“                 | S0 28,25 € netto, S1a 203,37 € netto. Personal und Managed-Dienste fehlen. Preise können sich ändern. |

Alle Zahlen in diesem Dossier gelten für Commit `4d81982de255`, die zitierten Berichte und den Preisstand 28.07.2026.

## 5. Was die KI falsch gemacht hat

NotebookLM hat aus Quellen einen flüssigen Text gebaut. Gegen das Repository war unter anderem falsch:

1. **Versionen:** Angular 21, Prisma 7.9.0, Express 5.2.1, Zod 4.4.3, alter Node-Bereich. Richtig: Angular 22.2.3, Prisma 7.9.1, Express 5.3.0, Zod 4.6.6, Engine `>=22.22.3 <23 || >=24.15.0 <25`. Yjs 13.6.31 stimmte.
2. **Host:** 8 vCPU / 32 GB und 35 €. Richtig: 8 vCPU / 16 GB und S0 28,25 € netto.
3. **ADR-0040** existiert nicht. Es gibt ADR-0035 bis ADR-0037.
4. **Erfundene Latenzen** für 100×50 und 1×5.000 sowie ein behaupteter Absturz bei 5.000 Clients.
5. **2 Stimmen pro Sekunde** und **HTTP 403** für ein falsches Host-Token. Richtig: 1 Anfrage pro Sekunde, tRPC `UNAUTHORIZED`.
6. **Naive Bayes als Sidecar.** Richtig: im App-Prozess.
7. **Restic bestellt in 4 Stunden eine neue VM** und **21 Tabellen = heutiges Schema.** Richtig: 4 Stunden ab Ersatzhost; 21 war der Test 2026, heute 40 Modelle.

**Deine Eigenleistung** ist nicht der erste KI-Entwurf, sondern die Prüfung gegen Lockdatei, Compose, Tests und datierte Berichte. Zielbilder bleiben Zielbilder.

Wenn du unsicher bist, schreibe: „Das steht im Code.“ / „Das wurde am … lokal gemessen.“ / „Das wurde am … in Produktion gesehen.“ / „Das ist ein Zielbild.“ Diese vier Sätze reichen für eine belastbare Cloud-Aussage.
