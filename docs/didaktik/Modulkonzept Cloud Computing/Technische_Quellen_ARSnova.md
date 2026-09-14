# Technische Quellen zu ARSnova.eu

**Stand der Sichtung:** 14.09.2026

**Versionierungsbasis:** Branch `main`, Checkout `beab199d62c0`

**Zweck:** kuratierte Repositorynachweise für Lehre, Dossier und technische Einordnung

## 1. Begriffe und Kürzel

- **Anwendungsprogrammierschnittstelle (API):** maschinenlesbare Schnittstelle zwischen Softwareteilen.
- **Architecture Decision Record (ADR):** versionierte Architekturentscheidung mit Kontext und Folgen.
- **Append Only File (AOF):** Redis-Persistenzprotokoll für Schreiboperationen.
- **ARM64:** 64-Bit-Prozessorarchitektur der ARM-Familie.
- **Amazon Web Services (AWS):** Public-Cloud-Anbieter.
- **Central Processing Unit (CPU):** Prozessor beziehungsweise zugeteilte Rechenkapazität.
- **Content Security Policy (CSP):** Browser-Sicherheitsrichtlinie für zulässige Inhaltsquellen.
- **Command Line Interface (CLI):** textbasierte Programmbedienung über Befehle.
- **Continuous Integration und Continuous Delivery (CI/CD):** automatisierte Prüfung und Auslieferung von Änderungen.
- **Conflict-free Replicated Data Type (CRDT):** zusammenführbarer verteilter Datentyp; hier durch Yjs.
- **Cross-Origin Resource Sharing (CORS):** Browsermechanismus für Ursprungsgrenzen bei Netzwerkanfragen.
- **Data Transfer Object (DTO):** ausdrücklich begrenztes Übertragungsobjekt.
- **Domain Name System (DNS):** Namensauflösung für Netzwerkziele.
- **End-to-End (E2E):** Prüfung eines vollständigen technischen Ablaufs.
- **Financial Operations (FinOps):** gemeinsame Steuerung von Cloudnutzen und -kosten.
- **GitHub Container Registry (GHCR):** Container-Registry von GitHub.
- **Google Cloud Platform (GCP):** Public-Cloud-Anbieter.
- **Graphics Processing Unit (GPU):** Grafikprozessor, der auch Modellinferenz beschleunigen kann.
- **High Availability (HA):** Auslegung für erhöhte Verfügbarkeit trotz Komponentenausfall.
- **Hypertext Transfer Protocol (HTTP) und Hypertext Transfer Protocol Secure (HTTPS):** Webtransport ohne beziehungsweise mit Transportverschlüsselung.
- **Identity and Access Management (IAM):** Verwaltung von Identitäten, Rollen und Zugriffsrechten.
- **Infrastructure as a Service (IaaS):** Cloudmodell für Compute-, Netz- und Speicherressourcen.
- **Infrastructure as Code (IaC):** versioniert und automatisierbar beschriebene Infrastruktur.
- **Indexed Database API (IndexedDB):** strukturierter Browserspeicher.
- **Internet Protocol (IP):** Adressierungs- und Vermittlungsprotokoll für Netze.
- **Internationalisierung (i18n):** technische Pflege mehrerer Sprachfassungen.
- **JavaScript Object Notation (JSON):** textuelles Datenformat.
- **JSON Web Token (JWT):** kompaktes signiertes Tokenformat.
- **Künstliche Intelligenz (KI):** Oberbegriff für modellbasierte Funktionen.
- **k-nearest Neighbors (k-NN):** Klassifikation anhand der nächsten Nachbarn.
- **Large Language Model (LLM):** großes Sprachmodell.
- **Machine Learning (ML):** daten- oder modellbasierte maschinelle Musterverarbeitung.
- **Mebibyte (MiB) und Gibibyte (GiB):** binäre Größenangaben von \(2^{20}\) beziehungsweise \(2^{30}\) Byte.
- **Natural Language Processing (NLP):** maschinelle Verarbeitung natürlicher Sprache.
- **Network Address Translation (NAT):** Übersetzung privater Adressen hinter einer gemeinsamen öffentlichen Adresse.
- **npm:** Eigenname des im Repository verwendeten JavaScript-Paketmanagers.
- **Object-Relational Mapper (ORM):** Abbildung zwischen relationaler Datenbank und Programmobjekten.
- **Open Container Initiative (OCI):** Standards für Containerformate und -images.
- **Open Neural Network Exchange (ONNX):** Austauschformat und Laufzeitumfeld für ML-Modelle.
- **p95 und p99:** 95. beziehungsweise 99. Perzentil einer Messwertverteilung.
- **Portable Document Format (PDF):** Dokumentformat; **PDF/Universal Accessibility (PDF/UA):** Standardprofil für zugängliche PDF-Dokumente.
- **Platform as a Service (PaaS):** Cloudmodell mit verwalteter Anwendungsplattform.
- **Progressive Web App (PWA):** installierbare Webanwendung mit Browser- und Service-Worker-Funktionen.
- **Fragen und Antworten (Q&A):** moderierter Fragenkanal in ARSnova.
- **Recovery Point Objective (RPO):** maximal angestrebter Datenverlustzeitraum.
- **Recovery Time Objective (RTO):** maximal angestrebte Wiederherstellungsdauer.
- **Representational State Transfer (REST):** verbreiteter Architekturstil für Webschnittstellen.
- **Static Analysis Results Interchange Format (SARIF):** Austauschformat für statische Analyseergebnisse.
- **Secure Shell (SSH):** verschlüsselter administrativer Fernzugriff.
- **SSH File Transfer Protocol (SFTP):** Dateiübertragung über SSH.
- **Service Level Indicator (SLI):** gemessene Diensteigenschaft.
- **Service Level Objective (SLO):** Zielwert für einen Serviceindikator.
- **Site Reliability Engineering (SRE):** Betriebspraxis für messbare Zuverlässigkeit.
- **Software as a Service (SaaS):** als Dienst bereitgestellte Anwendung.
- **Software Bill of Materials (SBOM):** maschinenlesbare Komponentenliste eines Softwareartefakts.
- **Structured Query Language (SQL):** Sprache für relationale Datenbanken.
- **Total Cost of Ownership (TCO):** Gesamtkosten einschließlich Betrieb, Personal, Migration und Exit.
- **Time to live (TTL):** technische Ablaufzeit.
- **Transport Layer Security (TLS):** Transportverschlüsselung und Serverauthentisierung.
- **tRPC:** Projektname des verwendeten typisierten Remote-Procedure-Call-Stacks über HTTP und WebSocket.
- **Uncomplicated Firewall (UFW):** Firewall-Werkzeug unter Linux.
- **Uniform Resource Locator (URL):** adressierender Netzwerkverweis.
- **User Interface (UI):** Benutzeroberfläche.
- **Virtual Machine (VM):** virtualisierte Maschine; **virtuelle CPU (vCPU):** ihr zugeteilter Prozessoranteil.
- **Web Application Firewall (WAF):** anwendungsbezogene Filterung am Netzrand.
- **Web Content Accessibility Guidelines (WCAG):** Richtlinien für barrierefreie Webinhalte.
- **WebSocket (WS):** persistente bidirektionale Webverbindung.
- **Write Ahead Log (WAL):** vorangestelltes Änderungsprotokoll einer Datenbank.
- **Sechs R (6R):** Rehost, Replatform, Repurchase, Refactor, Retire und Retain als Migrationstaxonomie.

Produkt- und Bibliotheksnamen wie Angular, Express, Prisma, PostgreSQL, Redis, Yjs, Nginx, Docker, Kubernetes, spaCy und Zod sind keine Kürzel.

## 2. Evidenzstufen und Leseregel

- **Implementiert:** Der aktuelle Checkout enthält ausführbaren Code, Verträge, Tests oder eine konkrete Konfiguration. Das beweist weder Deployment noch erfolgreichen Betrieb.
- **Lokal verifiziert:** Ein datierter Repositorynachweis dokumentiert einen ausgeführten lokalen oder CI-nahen Test samt Umgebung. Die Aussage gilt nur für diesen Quellstand und diese Umgebung.
- **Produktiv beobachtet:** Ein datierter Repositorynachweis dokumentiert eine Beobachtung an der Produktionsinstanz. Das ist kein allgemeiner Kapazitäts- oder Gegenwartsnachweis.
- **Zielbild:** Architektur, SLO, Betriebsverfahren oder Migration sind spezifiziert, aber nicht vollständig umgesetzt oder in der bezeichneten Zielumgebung abgenommen.

Bei Konflikten gilt für Versionen diese Reihenfolge:

1. `package-lock.json` für die aufgelöste npm-Abhängigkeitsversion;
2. Workspace-`package.json` für den zulässigen Versionsbereich;
3. Dockerfile-Digest oder Compose-Image-Referenz für das gebaute beziehungsweise konfigurierte Containerartefakt;
4. Quellcode und Tests für das tatsächlich implementierte Verhalten;
5. datierte Betriebs- und Abnahmedokumente für die jeweilige Umgebung;
6. allgemeine README- oder Handbuchprosa nur als Orientierung.

Ein grüner Test belegt das geprüfte Szenario, nicht Fehlerfreiheit. Ein vorhandenes Runbook belegt einen vorgesehenen Ablauf, nicht dessen Ausführung. Eine Compose-Datei belegt die versionierte Solltopologie, nicht den Zustand eines laufenden Hosts.

## 3. Versions- und Laufzeitbasis

### `SRC-RUNTIME-NODE` – Node-Laufzeitvorgaben

**Quelle:** [`.nvmrc`](../../../.nvmrc) und [Root-Paketmanifest](../../../package.json)

**Status:** implementiert

**Belegt:** `.nvmrc` nennt Node.js `24.18.0`. Das Rootmanifest erlaubt `>=22.13.0 <23` oder `>=24.0.0 <25`. Die [CI-Konfiguration](../../../.github/workflows/ci.yml) prüft die Hauptversionen 22 und 24; produktionsnahe Einzeljobs verwenden 24.

**Belegt nicht:** die tatsächlich laufende Node-Patchversion auf der Referenzinstanz. Das Produktionsimage verwendet einen gepinnten OCI-Index zu `node:24-alpine`; `.nvmrc` bindet dieses Image nicht auf `24.18.0`.

### `SRC-VERSION-MANIFESTE` – deklarierte npm-Abhängigkeiten

**Quelle:** [Rootmanifest](../../../package.json), [Frontendmanifest](../../../apps/frontend/package.json), [Backendmanifest](../../../apps/backend/package.json) und [Shared-Types-Manifest](../../../libs/shared-types/package.json)

**Status:** implementiert

**Belegt:** deklarierte Versionsbereiche und Workspacebeziehungen, darunter Angular `^21.2.19`, Express `^5.2.1`, tRPC `^11`, Prisma `^7`, Zod `^4`, Yjs `13.6.31` beziehungsweise kompatible Bereiche sowie die gemeinsamen Pakete `@arsnova/shared-types` und `@arsnova/session-export-report`.

**Belegt nicht:** welche konkrete Version `npm ci` installiert. Caret- und Tildebereiche sind keine exakten Laufzeitversionen.

### `SRC-VERSION-LOCK` – aufgelöster npm-Graph

**Quelle:** [`package-lock.json`](../../../package-lock.json)

**Status:** implementiert

**Belegt:** der eingecheckte Lockstand löst unter anderem Angular Core `21.2.23`, tRPC Server `11.18.0`, Prisma Client und CLI `7.9.0`, Zod `4.4.3`, Yjs `13.6.31`, `y-indexeddb` `9.0.12`, `y-websocket` `3.0.0`, `ioredis` `5.11.1`, `pg` `8.22.0` und `ws` `8.21.1` auf. Die Backend- und Frontend-Workspaces besitzen jeweils eine verschachtelte Express-Auflösung `5.2.1`; zusätzlich existiert ein anderer, transitiver Rootknoten Express `4.22.2`.

**Belegt nicht:** dass ein vorhandener `node_modules`-Ordner, ein Container oder die Produktionsinstanz genau diesem Lockstand entspricht. Dafür sind `npm ci`, Image-Digest und Deploymentnachweis zusätzlich nötig.

### `SRC-VERSION-KONFLIKT-PRISMA` – transparente Prosaabweichung

**Quelle:** [Architektur-Handbuch](../../architecture/handbook.md), [Projekt-README](../../../README.md) und [`package-lock.json`](../../../package-lock.json)

**Status:** implementierter Lockstand; Prosa teilweise veraltet

**Belegt:** README und Handbuch nennen an einzelnen Stellen Prisma `7.4.x`; Manifest und Lockstand liegen inzwischen bei Prisma `7.9.0`. Für aktuelle Versionsangaben gilt daher `7.9.0`.

**Belegt nicht:** eine fachliche Inkompatibilität. Die Abweichung zeigt lediglich, dass allgemeine Prosa nicht als alleinige Versionsquelle dienen darf.

### `SRC-VERSION-CONTAINER-DATENDIENSTE` – Container-Tags

**Quelle:** [`docker-compose.prod.yml`](../../../docker-compose.prod.yml)

**Status:** implementiert

**Belegt:** die Produktionskonfiguration referenziert `postgres:16-alpine` und `redis:7.4-alpine`.

**Belegt nicht:** exakte PostgreSQL- oder Redis-Patchversionen, Image-Digests oder den aktuell gezogenen Produktionsstand. Die Tags sind in Compose nicht digestgepinnt.

## 4. Angular und Frontend

### `SRC-FRONTEND-BOOTSTRAP` – Standalone-Start und Signals-nahe Konfiguration

**Quelle:** [`apps/frontend/src/main.ts`](../../../apps/frontend/src/main.ts) und [`app.config.ts`](../../../apps/frontend/src/app/app.config.ts)

**Status:** implementiert

**Belegt:** Start über `bootstrapApplication`, zentrale `ApplicationConfig`, zonenlose Änderungserkennung, Router, Fetch-basierter HTTP-Client, asynchrone Animationen, Angular-Material-Vorgaben, Service Worker und Hydration mit Ereigniswiedergabe.

**Belegt nicht:** dass jede einzelne Komponente ausschließlich Signals verwendet, dass jede Route serverseitig vorgerendert wird oder dass die UI in einem konkreten Browser fehlerfrei läuft.

### `SRC-FRONTEND-BUILD` – Build, Sprachen und PWA

**Quelle:** [`apps/frontend/angular.json`](../../../apps/frontend/angular.json) und [Frontendmanifest](../../../apps/frontend/package.json)

**Status:** implementiert

**Belegt:** deutsche Quellsprache, gepflegte Übersetzungsdateien für Englisch, Französisch, Italienisch und Spanisch, Produktionslokalisierung, Service Worker, Browser- und Serverbuild, Buildbudgets sowie Angular Material.

**Belegt nicht:** einen erfolgreichen Build des aktuellen Arbeitsbaums, Übersetzungsqualität, WCAG-Konformität oder erfolgreiche PWA-Installation auf jedem Gerät.

### `SRC-FRONTEND-ROUTEN` – Anwendungsschnitt

**Quelle:** [`apps/frontend/src/app/app.routes.ts`](../../../apps/frontend/src/app/app.routes.ts)

**Status:** implementiert

**Belegt:** die im Frontend versionierte Routenstruktur und Lazy-Loading-Grenzen.

**Belegt nicht:** Backendautorisierung. Eine Route oder ein URL-Parameter ist keine Berechtigungsquelle.

## 5. Node.js, Express und tRPC

### `SRC-BACKEND-EINSTIEG` – Prozess- und Transportaufbau

**Quelle:** [`apps/backend/src/index.ts`](../../../apps/backend/src/index.ts)

**Status:** implementiert

**Belegt:** eine Express-Anwendung für HTTP/tRPC und statische Frontenddateien, einen separaten tRPC-WebSocket-Server sowie einen separaten Yjs-Relayserver im selben Node-Prozess. Die Standardports sind 3000, 3001 und 3002. Der Einstieg initialisiert Redis, Health, Cleanup und geordnetes Herunterfahren.

**Belegt nicht:** dass Nginx, TLS, PostgreSQL, Redis oder alle drei Ports auf einem Zielhost erreichbar sind. Der Quellcode ist kein Deploymenttest.

### `SRC-API-ROUTER` – zentraler tRPC-Router

**Quelle:** [`apps/backend/src/routers/index.ts`](../../../apps/backend/src/routers/index.ts)

**Status:** implementiert

**Belegt:** Zusammenführung der Router für Health, Quiz, Quiz-Sync, Session, Vote, Q&A, Quick Feedback, Wortwolke, Administration, Plattformmeldungen und Produktfeedback sowie Export des TypeScript-Typs `AppRouter`.

**Belegt nicht:** dass jede Prozedur korrekt autorisiert, vollständig getestet oder für externe REST-Nutzung geeignet ist.

### `SRC-API-PROZEDUREN` – öffentliche, Host-, Admin- und Diagnosegrenzen

**Quelle:** [`apps/backend/src/trpc.ts`](../../../apps/backend/src/trpc.ts)

**Status:** implementiert

**Belegt:** getrennte öffentliche, Host-, Original-Host-, Admin- und Diagnoseprozeduren; Tokenprüfung; Rate-Limit-Telemetrie; Payloadfehler; vertrauenswürdig aufgelöste Clientadresse. Hostrechte werden aus validiertem Token und Sessioncode gemeinsam abgeleitet.

**Belegt nicht:** die Stärke produktiver Secrets, korrekte Reverse-Proxy-Hopzahl oder die fachlich richtige Prozedurwahl in jedem Router. Dafür sind Aufrufstellen und Tests mitzulesen.

### `SRC-API-TRANSPORTTEST` – tRPC-Vertragsaudit

**Quelle:** [CI-Workflow](../../../.github/workflows/ci.yml) und [`scripts/audit-trpc-dod.mjs`](../../../scripts/audit-trpc-dod.mjs)

**Status:** implementiert

**Belegt:** die CI enthält Unit-Tests und einen Real-Router-Audit mit Fehler bei unvollständiger Definition-of-Done-Abdeckung.

**Belegt nicht:** dass der Check für diesen uncommitteten Dokumentationsstand ausgeführt wurde oder dass ein Vertrag semantisch fachlich korrekt ist.

## 6. Geteilte Zod-Verträge und Data-Stripping

### `SRC-CONTRACT-SHARED-ZOD` – gemeinsame Verträge

**Quelle:** [`libs/shared-types/src/schemas.ts`](../../../libs/shared-types/src/schemas.ts) und [Shared-Types-Manifest](../../../libs/shared-types/package.json)

**Status:** implementiert

**Belegt:** Zod-v4-Schemas und abgeleitete TypeScript-Typen für Fragetypen, Sessionphasen, Quizimport und -export, Host-, Teilnehmer-, Ergebnis-, Health-, Q&A-, Monitoring- und weitere DTOs.

**Belegt nicht:** dass jede Laufzeitanfrage tatsächlich über das richtige Schema läuft. Dafür müssen die `.input()`- und `.output()`-Bindungen der Router geprüft werden.

### `SRC-CONTRACT-LOESUNGSSCHUTZ` – phasenabhängige Lösungsdaten

**Quelle:** [`libs/shared-types/src/schemas.ts`](../../../libs/shared-types/src/schemas.ts), [`apps/backend/src/routers/session.ts`](../../../apps/backend/src/routers/session.ts) und [`dto-security.test.ts`](../../../apps/backend/src/__tests__/dto-security.test.ts)

**Status:** implementiert und automatisiert geprüft

**Belegt:** `AnswerOptionStudentDTOSchema` ist strikt und enthält kein `isCorrect`; `QuestionStudentDTOSchema` nutzt dieses Schema. Aufgelöste Antworten mit `isCorrect` besitzen ein getrenntes Ergebnis-DTO. Der Sessionrouter liefert während `ACTIVE` nur begrenzten Fortschritt und erst in `RESULTS` aufgelöste Informationen.

**Belegt nicht:** Schutz vor Screenshots, Hostfehlbedienung, bereits bekannten Lösungen oder Fehlern außerhalb der geprüften DTO-Pfade.

## 7. Prisma und PostgreSQL

### `SRC-DATENMODELL-PRISMA` – relationales Schema

**Quelle:** [`prisma/schema.prisma`](../../../prisma/schema.prisma)

**Status:** implementiert

**Belegt:** PostgreSQL als Provider und Modelle unter anderem für serverseitige Quizkopien, Fragen, Sessions, Teilnehmende, Votes, Q&A, Feedback, Bonus-, Audit- und Plattformstatistikdaten. Es gibt kein allgemeines Nutzerkonto- oder Creator-Modell für die Quizbibliothek.

**Belegt nicht:** eine leere Datenbank, tatsächliche Aufbewahrungsdauer, Anonymität einzelner Datensätze oder Übereinstimmung einer laufenden Datenbank mit allen Migrationen.

### `SRC-DATENBANK-CLIENT` – Prisma-7-Adapter und Pool

**Quelle:** [`apps/backend/src/db.ts`](../../../apps/backend/src/db.ts) und [`prisma.config.ts`](../../../prisma.config.ts)

**Status:** implementiert

**Belegt:** Prisma Client mit PostgreSQL-Adapter, explizitem `pg`-Pool, konfigurierbarer Poolgröße und versioniertem Migrationspfad. Query-Logging ist in Produktion nicht standardmäßig aktiv.

**Belegt nicht:** produktive Poolwerte, aktuelle Datenbankauslastung, Replikation, Failover oder Managed-PostgreSQL.

### `SRC-DATENBANK-MIGRATION` – Migrationsprüfung

**Quelle:** [CI-Workflow](../../../.github/workflows/ci.yml) und [`prisma/migrations/`](../../../prisma/migrations/)

**Status:** implementiert

**Belegt:** versionierte Migrationen, `prisma migrate deploy`, Driftprüfung und PostgreSQL-Regressionsfälle in CI.

**Belegt nicht:** dass die Produktionsdatenbank den jüngsten Commit bereits migriert hat. Das erfordert den Deployment- und Datenbanknachweis des konkreten Hosts.

## 8. Redis

### `SRC-REDIS-CLIENT` – Redis-Anbindung

**Quelle:** [`apps/backend/src/redis.ts`](../../../apps/backend/src/redis.ts)

**Status:** implementiert

**Belegt:** eine lazy initialisierte ioredis-Verbindung, begrenzte Wiederholungsversuche, Health-Ping und geordnetes Schließen.

**Belegt nicht:** Hochverfügbarkeit, Clusterbetrieb, Datenhaltbarkeit oder Erreichbarkeit einer konkreten Redis-Instanz.

### `SRC-REDIS-PERSISTENZ` – konfigurierte AOF-Haltung

**Quelle:** [`docker-compose.prod.yml`](../../../docker-compose.prod.yml)

**Status:** implementiert

**Belegt:** Redis `7.4-alpine`, eigenes Volume, AOF mit `appendfsync everysec`, Snapshotoption und Healthcheck. Yjs-Create-/Rotate-Pfade sind laut Konfigurationskommentar zusätzlich auf gezielte AOF-Bestätigung ausgelegt.

**Belegt nicht:** verlustfreie Persistenz, Replikation, Offsite-Backup oder den tatsächlich laufenden Redis-Befehl eines Produktionscontainers.

### `SRC-REDIS-YJS-CAPABILITIES` – persistente Share-Metadaten

**Quelle:** [`apps/backend/src/lib/yjsShareToken.ts`](../../../apps/backend/src/lib/yjsShareToken.ts) und [Redis-Durability-Test](../../../apps/backend/src/lib/yjsShareToken.durability.redis.test.ts)

**Status:** implementiert und in CI als Redis-Crashregression vorgesehen

**Belegt:** serverseitige Registrierung, Prüfung und Rotation von Yjs-Share-Capabilities in Redis sowie einen zweiphasigen Durability-Test.

**Belegt nicht:** Sicherung der eigentlichen Quizbibliothek. Deren dauerhafte Hauptkopie liegt im Browser.

## 9. WebSockets

### `SRC-WEBSOCKET-TRPC` – Live-Subscriptions und Schutzgrenzen

**Quelle:** [`apps/backend/src/lib/trpcWebSocketServer.ts`](../../../apps/backend/src/lib/trpcWebSocketServer.ts)

**Status:** implementiert

**Belegt:** eigener WebSocket-Server mit Standardport 3001, Payloadgrenze, globalem Verbindungslimit 1.200, Sessionlimit 1.100, Teilnehmerlimit 2 sowie globalem Upgrade- und Nachrichtenbudget. Es gibt bewusst keinen IP-Bucket für Reconnect-Wellen.

**Belegt nicht:** 1.200 dauerhaft tragfähige produktive Verbindungen, Multi-Instanz-Fan-out, Sticky Sessions oder erfolgreiche Reconnects in jeder Netzumgebung. Grenzwerte sind Schutzkonfiguration, keine Kapazitätsmessung.

### `SRC-WEBSOCKET-YJS` – Relay und Ressourcenlimits

**Quelle:** [`apps/backend/src/lib/yjsRelay.ts`](../../../apps/backend/src/lib/yjsRelay.ts)

**Status:** implementiert

**Belegt:** separater WebSocket-Relay auf Standardport 3002, Share-Prüfung, Rotationswiderruf, Verbindungs-, Raum-, Upgrade-, Payload-, Nachrichten-, Byte-, Dokument-, Awareness- und Ausgangsbudgets. Standard sind 1.000 Verbindungen insgesamt und 200 je Raum.

**Belegt nicht:** eine Serverdatenbank für Quizdokumente, unbegrenzte Offlinekonvergenz, 1.000 produktiv abgenommene Relayverbindungen oder instanzübergreifende Raumnutzung.

### `SRC-WEBSOCKET-EDGE` – Reverse-Proxy-Pfade

**Quelle:** [Deployment-Anleitung](../../deployment-debian-root-server.md)

**Status:** Zielbild beziehungsweise Betreiberanleitung

**Belegt:** dokumentierte Nginx-Upstreams für HTTP auf 3000, `/trpc-ws` auf 3001 und `/yjs-ws` auf 3002 sowie erforderliche Upgradeheader. Der Yjs-Abschnitt berücksichtigt, dass der Share-Token im Handshake transportiert wird.

**Belegt nicht:** dass die aktive Nginx-Konfiguration einer konkreten Instanz dieser Anleitung entspricht oder WebSocket-Upgrades von außen funktionieren.

## 10. Yjs, Local-First und IndexedDB

### `SRC-LOCALFIRST-STORE` – browserseitige Quizbibliothek

**Quelle:** [`apps/frontend/src/app/features/quiz/data/quiz-store.service.ts`](../../../apps/frontend/src/app/features/quiz/data/quiz-store.service.ts)

**Status:** implementiert

**Belegt:** ein Yjs-Dokument für die Quizbibliothek, `IndexeddbPersistence` für lokalen Browserspeicher und einen optionalen `WebsocketProvider` zur Gerätesynchronisierung. Share-Token-Validierung und Provider-Lebenszyklus sind Teil des Dienstes.

**Belegt nicht:** browserübergreifende Dauerhaftigkeit, Backup, Synchronisierung ohne gültige Capability oder Erhalt nach Löschen der Browserdaten.

### `SRC-LOCALFIRST-ARCHITEKTUR` – Zuständigkeitsgrenzen

**Quelle:** [Synchronisierung der Quizbibliothek](../../architecture/quiz-library-sync.md) und [Architektur-Handbuch](../../architecture/handbook.md)

**Status:** implementierte Architektur mit dokumentierten Grenzen

**Belegt:** die lokale Quizbibliothek ist die dauerhafte Hauptquelle; das Backend dient als Relay, während beim Live-Start eine Sessionkopie nach PostgreSQL gelangt. Der Beitrittscode ist kein Quiz-Bearbeitungsschlüssel.

**Belegt nicht:** dass Live-Sessions, Votes und Q&A local-first sind. Diese liegen serverseitig. „Local-first“ darf nicht auf das gesamte Produkt verallgemeinert werden.

### `SRC-LOCALFIRST-SMOKE` – Container-Syncprüfung

**Quelle:** [CI-Workflow](../../../.github/workflows/ci.yml)

**Status:** lokal beziehungsweise CI-nah verifiziert, sofern der zugehörige Lauf grün ist

**Belegt:** der Dockerjob enthält einen Yjs-Protokoll-, Offline-Update- und Reconnect-Smoke mit 30 Clients gegen das gehärtete Produktions-Compose.

**Belegt nicht:** das Ergebnis eines konkreten CI-Laufs, Internet-Offlinenutzung ohne vorher geladenes Frontend oder Wiederherstellung nach Browserdatenverlust.

## 11. Docker, Compose, Nginx und TLS

### `SRC-CONTAINER-IMAGE` – Produktionsimage

**Quelle:** [`Dockerfile`](../../../Dockerfile)

**Status:** implementiert

**Belegt:** zweistufiges Image auf `node:24-alpine` mit gepinntem OCI-Index-Digest; `npm ci`; Prisma-Generierung; Backend- und lokalisierter Frontendbuild; Chromium für PDF; Anwendung als Nutzer `node`; Migration vor Start; Healthcheck.

**Belegt nicht:** Reproduzierbarkeit über unveränderliche Alpine-Paketquellen, die konkrete Node-Patchversion im Image, einen erfolgreichen aktuellen Build oder ein gescanntes Deployment.

### `SRC-COMPOSE-PRODUKTION` – Single-Host-Solltopologie

**Quelle:** [`docker-compose.prod.yml`](../../../docker-compose.prod.yml)

**Status:** implementiert

**Belegt:** genau je ein PostgreSQL-, Redis-, PDF-Worker- und App-Service; read-only App-/Worker-Dateisysteme; entfernte Linux-Capabilities; `no-new-privileges`; lokale Portbindungen; Healthabhängigkeiten und eine zwingend zu setzende `ARSNOVA_IMAGE`-Referenz. Der CI-/Deploymentpfad liefert diese Referenz als Digest. spaCy und semantischer Encoder sind optionale Profile und werden nicht als Standardabhängigkeit der App gestartet.

**Belegt nicht:** horizontale Skalierung, HA, Multi-Host-Orchestrierung, aktive optionale Profile oder den Laufzustand der Referenzinstanz.

### `SRC-EDGE-NGINX-TLS` – dokumentierter Netzrand

**Quelle:** [Deployment auf Debian Root-Server](../../deployment-debian-root-server.md)

**Status:** Zielbild beziehungsweise Betreiberanleitung

**Belegt:** ein dokumentierter Ein-Host-Betriebsweg mit Nginx, HTTP-zu-HTTPS-Weiterleitung, Let's Encrypt, Certbot-Timer, UFW, Fail2ban und lokal gebundenen Appports.

**Belegt nicht:** Zertifikatsgültigkeit, aktuelle Nginx-Version, tatsächlich aktive Firewallregeln, SSH-Härtung oder TLS-Konfiguration eines Zielhosts. Die Nginx-Konfiguration liegt als Anleitung, nicht als ausgerollte Hostdatei im Repository.

## 12. CI/CD

### `SRC-CICD-WORKFLOW` – Prüf- und Auslieferungskette

**Quelle:** [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)

**Status:** implementiert

**Belegt:** Build und Typecheck auf Node 22/24, Prisma-Driftprüfung, Lint, Tests mit Coveragegate, Browser-Smokes, PDF/UA-Validierung, Lighthouse, Dependency Review, npm-Audit, SBOM, Trivy-Dateisystem- und Imageprüfung, ARM64-Dockerbuild, GHCR-Publish, Deployment-Freshness, optionalen Deploymentjob, Post-Deploy-Smoke und Rollbackpfad. Geplante/manuelle Lastjobs sind separat konfiguriert.

**Belegt nicht:** dass alle Checks des aktuellen Commits grün sind, dass branch protection sie erzwingt, dass `DEPLOY_ENABLED` gesetzt ist oder welcher Commit aktuell produktiv läuft.

### `SRC-CICD-DEPLOY` – serverseitiger Rollout

**Quelle:** [`scripts/deploy.sh`](../../../scripts/deploy.sh)

**Status:** implementiert

**Belegt:** versionierte Rollout-, Health-, Zustands- und Rollbacklogik für den vorgesehenen Serverpfad.

**Belegt nicht:** erfolgreiche Ausführung auf der Referenzinstanz, korrekte Secrets, erreichbares Registryartefakt oder unterbrechungsfreie Verfügbarkeit.

### `SRC-CICD-DOCS-FASTPASS` – Grenze von Dokumentationsänderungen

**Quelle:** [CI-Workflow](../../../.github/workflows/ci.yml)

**Status:** implementiert

**Belegt:** reine Dokumentations-Pull-Requests überspringen mehrere schwere Anwendungsschritte; Format- und Required-Check-Prüfungen bleiben. Ein Push auf `main` wird nicht als Docs-only behandelt.

**Belegt nicht:** technische Validierung von Anwendungsaussagen in Markdown. Deshalb müssen diese Aussagen manuell gegen Code, Konfiguration und datierte Nachweise geprüft werden.

## 13. Security

### `SRC-SECURITY-UEBERBLICK` – Sicherheitsgrenzen

**Quelle:** [`docs/SECURITY-OVERVIEW.md`](../../SECURITY-OVERVIEW.md)

**Status:** dokumentiert; durch Einzelquellen zu verifizieren

**Belegt:** kuratierte Projektannahmen zu Accountfreiheit, Data-Stripping, Host-/Adminrollen, Sessiondaten, Rate-Limits, Yjs-Capabilities, PDF-Isolation und Betrieb.

**Belegt nicht:** eine externe Sicherheitszertifizierung, vollständige Bedrohungsabdeckung, Datenschutzkonformität einer Institution oder fehlerfreie Konfiguration. Die jeweils genannten Code- und Testquellen sind maßgeblich.

### `SRC-SECURITY-AUTORISIERUNG` – Tokenbasierte Rollenprüfung

**Quelle:** [`apps/backend/src/trpc.ts`](../../../apps/backend/src/trpc.ts), [`hostAuth.ts`](../../../apps/backend/src/lib/hostAuth.ts) und [`adminAuth.ts`](../../../apps/backend/src/lib/adminAuth.ts)

**Status:** implementiert

**Belegt:** serverseitige Host- und Admin-Tokenprüfung, Trennung des ursprünglichen Hosts und Diagnosepfads sowie ablaufende beziehungsweise widerrufbare Zustände.

**Belegt nicht:** Geheimnisstärke, sichere Ausgabe an Browser, Schutz kompromittierter Endgeräte oder korrekte Autorisierung von Code, der diese Prozeduren nicht nutzt.

### `SRC-SECURITY-PROXY` – vertrauenswürdige Clientadresse

**Quelle:** [`apps/backend/src/lib/trustedProxy.ts`](../../../apps/backend/src/lib/trustedProxy.ts) und [Produktionsumgebungsbeispiel](../../../.env.production.example)

**Status:** implementiert

**Belegt:** explizit begrenzte Proxy-Hops und sichere Rückkehr zur direkten Socketadresse bei ungültiger Konfiguration. WebSocket-Upgrades nutzen dieselbe Auflösung.

**Belegt nicht:** den produktiven Wert von `TRUST_PROXY_HOPS`, eine eindeutige IP je Teilnehmer oder Identität. Viele legitime Clients können dieselbe NAT-Adresse teilen.

### `SRC-SECURITY-CI` – automatisierte Sicherheitsprüfungen

**Quelle:** [CI-Workflow](../../../.github/workflows/ci.yml)

**Status:** implementiert

**Belegt:** Dependency Review, High-Severity-npm-Audit, SBOM, Trivy-Scans, gehärteter Compose-Runtime-Smoke, Secretdateirechte und mehrere Sicherheitsregressionen.

**Belegt nicht:** Penetrationstest, Zero-Day-Freiheit, sichere Produktionsinfrastruktur oder einen erfolgreichen Lauf für noch nicht eingecheckte Änderungen.

## 14. Rate Limits und Shared-NAT-Verträglichkeit

### `SRC-RATELIMIT-KERN` – Redis-Budgets

**Quelle:** [`apps/backend/src/lib/rateLimit.ts`](../../../apps/backend/src/lib/rateLimit.ts)

**Status:** implementiert

**Belegt:** Redis-basierte Sliding- und Fixed-Window-Budgets für Vote, Sessionerstellung, Quizupload, Quick Feedback, Plattformmeldungen, Produktfeedback, Yjs-Share und Host-Pairing; mehrere Pfade kombinieren globale und IP-bezogene Budgets.

**Belegt nicht:** die produktiv gesetzten Werte, fairnessgerechte Wirkung unter jeder Last oder Schutz bei dauerhaftem Redis-Ausfall.

### `SRC-RATELIMIT-PRODUKTIONSVORLAGE` – konfigurierbare Betriebswerte

**Quelle:** [`.env.production.example`](../../../.env.production.example)

**Status:** implementierte Vorlage

**Belegt:** vorgeschlagene Produktionswerte, beispielsweise zwei Votes je Sekunde und Teilnehmer, Session-Code-Soft-Caps, globale Reservebudgets sowie WebSocket- und Yjs-Grenzen.

**Belegt nicht:** produktive Werte. Ohne Umgebungsvariable kann der Codefallback abweichen; beim Vote sind es im Code beispielsweise ein Request je Sekunde, während die Vorlage zwei setzt.

### `SRC-RATELIMIT-VOTE` – teilnehmerbezogene Abstimmung

**Quelle:** [`apps/backend/src/routers/vote.ts`](../../../apps/backend/src/routers/vote.ts)

**Status:** implementiert

**Belegt:** das Vote-Budget wird mit `participantId` geprüft und der Teilnehmer anschließend gegen `sessionId` validiert. Legitime Hörsaalvotes werden nicht allein nach gemeinsamer öffentlicher IP begrenzt.

**Belegt nicht:** dass `participantId` eine Authentifizierung oder reale Person bezeichnet. Sie ist ein technischer Sitzungsschlüssel.

### `SRC-RATELIMIT-SESSIONCODE` – Enumeration und Soft-Caps

**Quelle:** [`apps/backend/src/lib/sessionCodeProtection.ts`](../../../apps/backend/src/lib/sessionCodeProtection.ts) und [`apps/backend/src/trpc.ts`](../../../apps/backend/src/trpc.ts)

**Status:** implementiert

**Belegt:** getrennte Quellklassen für expliziten Join, Codeprüfung und Reconnect; Clientfehlbudget, codebezogene und globale Soft-Caps sowie begrenzte Verzögerungen. Reconnect-429 werden für Alarme getrennt behandelt.

**Belegt nicht:** absolute Verhinderung von Enumeration oder störungsfreien Join bei jeder Angriffs- und Hörsaallast.

### `SRC-RATELIMIT-WEBSOCKET` – keine enge IP-Sperre

**Quelle:** [`trpcWebSocketServer.ts`](../../../apps/backend/src/lib/trpcWebSocketServer.ts), [`yjsRelay.ts`](../../../apps/backend/src/lib/yjsRelay.ts) und [Monitoring-Runbook](../../operations/MONITORING-RUNBOOK.md)

**Status:** implementiert

**Belegt:** globale, sitzungs-, raum-, teilnehmer- und verbindungsbezogene Grenzen statt einer engen öffentlichen-IP-Sperre. Das Runbook verbietet eine spontane IP-Sperre als Incidentreaktion bei legitimer Großlast.

**Belegt nicht:** Missbrauchsfreiheit oder Kapazität. Schutzlimits und Alarmwerte sind keine Lastfreigabe.

## 15. Evidenzgrenzen bei 500 Clients

### `SRC-LAST-HARNESS` – ausführbare Laststrecken

**Quelle:** [Root-Paketmanifest](../../../package.json), [`scripts/load/`](../../../scripts/load/) und [CI-Workflow](../../../.github/workflows/ci.yml)

**Status:** implementiert

**Belegt:** Skripte für Join, Vote, tRPC-WebSocket, Reconnect, Yjs, Soak, PDF-vs.-Vote und Artillery-500 sowie geplante/manuelle CI-Jobs.

**Belegt nicht:** dass ein Skript zuletzt erfolgreich lief, dass die Last realistisch verteilt war oder dass die Produktionsinstanz belastet werden darf.

### `SRC-LAST-LOKAL-2026-07-12` – lokale Gesamtbaseline

**Quelle:** [Lokale Baseline-Freigabe](../../implementation/LOCAL-BASELINE-FREIGABE-2026-07-12.md) und [versioniertes Baseline-Manifest](../../../scripts/load/baselines/manifests/story-0.7-2026-07-12.json)

**Status:** lokal verifiziert

**Belegt:** auf Commit `e3285372` im lokalen Dev-Setup mit PostgreSQL 16 und Redis 7 dokumentierte Ergebnisse: 500/500 Join, Vote und WebSocket, 500/500 Reconnects, 600er Vote-Timer-Fairness, 30 Yjs-Clients und 30 Minuten Soak.

**Belegt nicht:** aktuelle Produktionsleistung, Node-24-Zielhostleistung, identische Hardware, Netzrand, Teamdarstellung oder den heutigen Checkout `af819bcb6494`.

### `SRC-LAST-PRODUKTION-2026-05-09` – historischer Produktions-Join

**Quelle:** [Produktionslasttest vom 09.05.2026](../../implementation/LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md)

**Status:** produktiv beobachtet, historisch

**Belegt:** 500 gleichzeitige Produktions-Joins ohne HTTP-Fehler und anschließend 500 Teilnehmende in der Session; gemessenes p95 `3,57 s`, oberhalb des damaligen Drei-Sekunden-Ziels.

**Belegt nicht:** Vote-Burst, aktive Frage, 500 dauerhaft verbundene WebSockets, stabile Teammoderation, aktuelles Produktverhalten oder heutige Produktionskonfiguration. Spätere Fixes sind nur lokal nachgetestet.

### `SRC-LAST-FORMALER-ZIELHOST` – noch offene Abnahme

**Quelle:** [Formale Sicherheits- und Lasttest-Abnahme](../../implementation/S6.5-SECURITY-LOAD-ACCEPTANCE.md)

**Status:** Zielbild; Zielhostlauf nicht ausgeführt

**Belegt:** definierte Szenarien und SLOs für 500 Clients hinter derselben NAT-Adresse, Join, Vote, WebSocket, Reconnect und PDF-vs.-Vote sowie einen autorisierungspflichtigen Ablauf.

**Belegt nicht:** das Bestehen dieser SLOs. Das Dokument erklärt ausdrücklich, dass Konfigurations- und Orchestratorchecks keine 500er- oder Netzwerkabnahme sind.

### Verbindliche Kurzform

Zulässig ist: **500 Produktions-Joins wurden historisch funktional beobachtet; umfassendere 500er-Pfade sind auf einem älteren Commit lokal verifiziert; die formale produktionsnahe Zielhostabnahme ist offen.**

Nicht zulässig ist: **ARSnova ist für 500 Teilnehmende vollständig produktiv abgenommen.**

## 16. Monitoring und Observability

### `SRC-MONITORING-API` – Health- und Securitysignale

**Quelle:** [`apps/backend/src/routers/health.ts`](../../../apps/backend/src/routers/health.ts)

**Status:** implementiert

**Belegt:** öffentliche Health-/Statusdaten und diagnosegeschützte aggregierte Security- und Kapazitätssignale für PostgreSQL, Redis, SLO, Rate Limits, PDF, tRPC-WebSocket, Yjs-WebSocket und CSP.

**Belegt nicht:** Host-CPU, Langzeitmetriken, externe Alarmzustellung oder vollständige Betriebsobservability. Einige Rollzähler können bei Redis-Ausfall auf null degradieren.

### `SRC-MONITORING-OPERATIV` – Diagnose- und Alarmverfahren

**Quelle:** [Monitoring-Runbook](../../operations/MONITORING-RUNBOOK.md)

**Status:** implementierter Diagnoseweg; produktive Konfiguration instanzabhängig

**Belegt:** Abfragewege, Schwellen, Korrelation, Eskalation, Datenschutzgrenzen und Verhalten bei Redis-, PDF-, WebSocket- und CSP-Ereignissen. Es dokumentiert außerdem, dass die aktuelle Compose-Datei keine Anwendungslogretention erzwingt.

**Belegt nicht:** dass Alarmwebhook, Heartbeat, Logrotation und On-Call-Verantwortung produktiv eingerichtet oder abgenommen sind.

### `SRC-MONITORING-POLLER` – automatischer Host-Poller

**Quelle:** [`scripts/monitoring/arsnova_monitor.py`](../../../scripts/monitoring/arsnova_monitor.py), [`arsnova-monitor.service`](../../../deploy/systemd/arsnova-monitor.service) und [`arsnova-monitor.timer`](../../../deploy/systemd/arsnova-monitor.timer)

**Status:** implementiert

**Belegt:** einen minütlichen, gehärteten systemd-Poller mit Zustandsautomat, minimiertem Webhook und optionalem Heartbeat.

**Belegt nicht:** Installation, Aktivierung oder Erreichbarkeit eines externen Kanals auf der Referenzinstanz.

### `SRC-MONITORING-ABNAHME` – Statusgrenze

**Quelle:** [W3.7-Abnahmedokument](../../implementation/W3.7-MONITORING-ALARMS-ABNAHME.md)

**Status:** implementiert und lokal verifiziert; operative Produktivabnahme offen

**Belegt:** technische Tests und einen lokal dokumentierten zehnminütigen Dauerlast-Slice mit 21/21 Gates.

**Belegt nicht:** den produktiven Webhook-, Timer-, Heartbeat-Ausfall- und Recovery-Drill. Das Dokument nennt diese Schritte ausdrücklich als ausstehend.

## 17. Backup und Restore

### `SRC-BACKUP-RUNBOOK` – Sicherungsziel

**Quelle:** [Backup-/Restore-Runbook](../../operations/BACKUP-RESTORE-RUNBOOK.md)

**Status:** Zielbild und Betreiberverfahren

**Belegt:** vorgesehenes clientseitig verschlüsseltes Restic-Backup über SFTP, PostgreSQL-Custom-Dump, Produktionskonfiguration, Aufbewahrung von 14 täglichen Snapshots, tägliches Fenster, monatlichen isolierten Restore und vierteljährlichen Frischhost-Restore. RPO `≤ 24 h + 15 min` und RTO `≤ 4 h ab Ersatzhost` sind Betriebsziele.

**Belegt nicht:** für sich allein erreichte RPO/RTO, aktuell vorhandene Offsite-Snapshots, verfügbare Schlüssel oder einen erfolgreichen aktuellen Produktionsrestore. Der datierte historische Betriebsnachweis folgt separat.

### `SRC-BACKUP-CODE` – ausführbare Sicherungsstrecke

**Quelle:** [`arsnova-backup.sh`](../../../scripts/backup/arsnova-backup.sh), [`arsnova-restic.sh`](../../../scripts/backup/arsnova-restic.sh), [`arsnova-restore-check.sh`](../../../scripts/backup/arsnova-restore-check.sh) und [`deploy/systemd/`](../../../deploy/systemd/)

**Status:** implementiert

**Belegt:** Skripte und systemd-Units für Dump, Restic, Retention, Locking und Restoreprüfung.

**Belegt nicht:** für sich allein installierte root-eigene Kopien, Storage-Box-Konfiguration oder einen erfolgreichen Lauf auf einem Produktivhost. Der separate historische Betriebsnachweis steht im folgenden Eintrag.

### `SRC-BACKUP-ABNAHME` – datierte historische Betriebsabnahme

**Quelle:** [Security-Härtungsplan](../../SECURITY-HARDENING-PLAN.md), [Security-Hardening-Handoff](../../SECURITY-HARDENING-HANDOFF.md) und das ältere [W3.6-Abnahmedokument](../../implementation/W3.6-EXTERNAL-BACKUPS-ABNAHME.md)

**Status:** implementiert, gemergt und am 26.07.2026 historisch operativ abgenommen

**Belegt:** Der kanonische Härtungsplan dokumentiert einen ersten erfolgreichen Offsite-Snapshot sowie einen erfolgreichen isolierten Restore mit 21 Tabellen am 26.07.2026; das Handoff bestätigt W3.6 als gemergten Backup- und Restore-Nachweis. Das ältere W3.6-Abnahmedokument beschreibt Implementierung und lokale Vorabvalidierung, nennt in seinem Abschnitt „Ausstehende Betriebsabnahme“ aber noch den davor offenen Stand. Dieser Status ist durch Härtungsplan und Handoff zeitlich überholt.

**Belegt nicht:** dass heute ein aktueller Snapshot vorhanden oder lesbar ist, Schlüssel verfügbar sind, monatliche oder vierteljährliche Wiederholungen erfolgreich stattfanden, RPO/RTO aktuell eingehalten werden oder die im Kurs eingesetzte Instanz denselben Backupzustand besitzt. Browserseitige Quizbibliotheken und Redis gehören ausdrücklich nicht zum Sicherungsumfang.

## 18. Isolierter PDF-Worker

### `SRC-PDF-WORKER-CODE` – Workertransport

**Quelle:** [`apps/backend/src/pdf-worker.ts`](../../../apps/backend/src/pdf-worker.ts) und [`pdfWorkerTransport.ts`](../../../apps/backend/src/lib/pdfWorkerTransport.ts)

**Status:** implementiert

**Belegt:** Unix-Socket-Transport, strikte JSON-Schemas, Größen- und Zeitgrenzen, Produktions-Fail-Closed auf Workermodus sowie Prozessende bei fatalem Rendertimeout.

**Belegt nicht:** Containerisolation; diese entsteht erst durch Compose. Der Code allein verhindert keinen fehlkonfigurierten Netzwerk- oder Secretzugriff.

### `SRC-PDF-WORKER-COMPOSE` – Ressourcen- und Netzisolation

**Quelle:** [`docker-compose.prod.yml`](../../../docker-compose.prod.yml)

**Status:** implementiert

**Belegt:** `network_mode: none`, kein `env_file`, read-only Rootdateisystem, entfernte Capabilities, `no-new-privileges`, ein Prozess-/Thread-Limit von 128, 1 GiB Speicher, eine CPU, begrenztes temporäres Dateisystem und eigenes Socketvolume. Die App hängt vom gesunden Worker ab.

**Belegt nicht:** Laufzustand, tatsächliche cgroup-Wirkung auf einem konkreten Dockerhost oder Durchsatz bei mehreren gleichzeitigen Exporten.

### `SRC-PDF-WORKER-ABNAHME` – automatisierte Isolation

**Quelle:** [W2.1b-Entscheidung und Abnahme](../../implementation/W2.1B-PDF-WORKER-ISOLATION-ABNAHME.md) und [CI-Workflow](../../../.github/workflows/ci.yml)

**Status:** implementiert und automatisiert geprüft

**Belegt:** Runtime-Smokes für Isolation, Limits, Workerrestart, Socket-Cleanup und einen großen Ergebnisreport; PDF/UA wird für fünf Sprachen validiert.

**Belegt nicht:** dauerhafte Produktionsverfügbarkeit, unbegrenzten PDF-Durchsatz oder Barrierefreiheit jedes beliebigen exportierten Inhalts.

## 19. Provider, 6R und Kosten

### `SRC-CLOUD-IST` – heutige Betriebsgrenze

**Quelle:** [Betriebliche Cloud-Einordnung](../../implementation/CLOUD-COMPUTING-EINORDNUNG-BETRIEBLICH.md) und [`docker-compose.prod.yml`](../../../docker-compose.prod.yml)

**Status:** implementierter Single-Host-Pfad; Scale-out ist Zielbild

**Belegt:** vorgesehener self-managed Single-Host-Stack und bekannte Multi-Instanz-Lücken bei prozesslokalen Signalen, WebSocket-/Yjs-Zuordnung sowie globalen Schutzlimits.

**Belegt nicht:** elastische Cloudarchitektur, automatische Skalierung, Multi-Zone-Betrieb oder 5.000-Client-Fähigkeit.

### `SRC-CLOUD-PROVIDER` – Betriebsmodell- und Providervergleich

**Quelle:** [Cloud-Betriebsmodelle und Providervergleich](../../implementation/CLOUD-PROVIDER-VERGLEICH-ARSNOVA-EU.md)

**Status:** Zielbild und Entscheidungsrahmen

**Belegt:** versionierte Kriterien für Single Host, getrennte IaaS-Dienste, IaaS plus Managed Data und Managed Application Platform sowie Anforderungen an Daten, Netz, IAM, Observability, Exit und TCO.

**Belegt nicht:** Providerwahl, Beschaffungsfreigabe, aktuelle Produktportfolios, Vertragslage, Region, Preise oder gemessene Eignung eines Anbieters. Volatile Anbieterfakten sind vor jeder Verwendung an Primärquellen neu zu prüfen.

### `SRC-CLOUD-6R` – Migrationstaxonomie

**Quelle:** [6R-Einordnung](../../implementation/CLOUD-COMPUTING-6R-EINORDNUNG.md)

**Status:** Zielbild

**Belegt:** auf ARSnova bezogene Hypothesen, Grenzen und Gates für Rehost, Replatform, Repurchase, Refactor, Retire und Retain.

**Belegt nicht:** beschlossene Roadmap, erfolgte Migration oder Kapazität der Zielbilder `100 × 50` und `1 × 5.000`.

### `SRC-CLOUD-KOSTEN` – datiertes Rechenblatt

**Quelle:** [Hetzner-Kostenrechenblatt](../../implementation/CLOUD-COMPUTING-HETZNER-KOSTENVORSCHLAG.md)

**Status:** Zielbild und Lehrrechnung

**Belegt:** nachvollziehbare Preisannahmen vom 28.07.2026, Rechenwege, nicht enthaltene Kosten, Sensitivitäten und bewusst hypothetische Topologien.

**Belegt nicht:** Angebot, Beschaffungsfreigabe, heutige Preise, TCO oder Kapazitätsnachweis. Das Dokument fordert eine erneute Preisprüfung vor Verwendung und spätestens bei den dort genannten Ablaufereignissen.

### `SRC-CLOUD-OPENSTACK` – alternative Plattformen

**Quelle:** [OpenStack, Kubernetes und Alternativen](../../implementation/CLOUD-COMPUTING-OPENSTACK-UND-ALTERNATIVEN.md)

**Status:** Zielbild und Lehreinordnung

**Belegt:** begriffliche Trennung von OpenStack als IaaS-Plattform, Kubernetes als Containerorchestrierung und Hetzner Cloud als eigenes IaaS-Angebot.

**Belegt nicht:** ein vorhandenes OpenStack- oder Kubernetes-Deployment im Repository, Managed-Service-Verfügbarkeit zum heutigen Datum oder eine empfohlene Produktionsmigration.

## 20. Implementierte und geplante ML-/LLM-Funktionen

### `SRC-ML-LEXIKALISCHE-WORTWOLKE` – deterministische Basis

**Quelle:** [`apps/backend/src/routers/wordCloud.ts`](../../../apps/backend/src/routers/wordCloud.ts), [`wordCloudAnalysis.ts`](../../../apps/backend/src/lib/wordCloudAnalysis.ts) und [`word-cloud.component.ts`](../../../apps/frontend/src/app/features/session/session-present/word-cloud.component.ts)

**Status:** implementiert

**Belegt:** lexikalische Wortwolkenanalyse, Backendrouter und Frontenddarstellung ohne LLM-Abhängigkeit.

**Belegt nicht:** semantisches Verständnis, inhaltliche Richtigkeit, Produktivaktivierung optionaler NLP-Pfade oder Eignung zur Personenbewertung.

### `SRC-ML-SPACY` – optionale Lemmatisierung

**Quelle:** [`docker/spacy/requirements.txt`](../../../docker/spacy/requirements.txt), [`docker/spacy/server.py`](../../../docker/spacy/server.py), [`nlpSidecarConfig.ts`](../../../apps/backend/src/lib/nlpSidecarConfig.ts) und [`docker-compose.prod.yml`](../../../docker-compose.prod.yml)

**Status:** implementiert; standardmäßig deaktiviert

**Belegt:** spaCy `3.8.15`, gepinnte Sprachmodelle für Deutsch, Englisch, Französisch und Spanisch, einen netzlosen Sidecar im Compose-Profil `nlp`, Unix-Socket und separaten Kill-Switch `NLP_ENABLED`.

**Belegt nicht:** produktiv gestartetes Profil, italienisches spaCy-Modell, semantische Klassifikation oder bessere Ergebnisse für alle Texte.

### `SRC-ML-SEMANTISCHE-THEMEN` – Encoder plus Clustering

**Quelle:** [Semantischer Q&A-Themenmodus](../../features/word-cloud-semantic.md), [`wordCloudSemanticAnalyze.ts`](../../../apps/backend/src/lib/wordCloudSemanticAnalyze.ts), [`wordCloudSemanticCluster.ts`](../../../apps/backend/src/lib/wordCloudSemanticCluster.ts), [`wordCloudSemanticConfig.ts`](../../../apps/backend/src/lib/wordCloudSemanticConfig.ts) und [`docker/wordcloud-encoder/`](../../../docker/wordcloud-encoder/)

**Status:** implementiert; standardmäßig deaktiviert

**Belegt:** Stufe 1 mit privatem multilingualem E5-Encoder, ONNX-Runtime, deterministischem Clustering im Backend, extraktiven Labels, Cache, Timeout, Circuit Breaker und lexikalischem Fallback. Öffentliche SaaS-Endpunkte sind im Konfigurationspfad gesperrt.

**Belegt nicht:** LLM-Labels, allgemeines Sprachverständnis, produktive Aktivierung, Produktivqualität oder semantische Themen für Host-Freitext. Story 1.14d und Stufe 2 bleiben Zielbild.

### `SRC-ML-QA-KASKADE` – Host-only Moderationssignale

**Quelle:** [Q&A-NLP-Kaskade](../../features/qa-nlp-moderation.md), [`qaNlpConfig.ts`](../../../apps/backend/src/lib/qaNlpConfig.ts), [`qaNlpGatekeeper.ts`](../../../apps/backend/src/lib/qaNlpGatekeeper.ts) und [`qaNlpFallback.ts`](../../../apps/backend/src/lib/qaNlpFallback.ts)

**Status:** implementiert und lokal verifiziert; standardmäßig deaktiviert

**Belegt:** gehashten Naive-Bayes-Gatekeeper, k-NN-Fallback, Queue, Timeout, Host-only-Ergebnisse und `QA_NLP_ENABLED=false` als Produktionsvorlage. Das Featuredokument protokolliert eine lokale 500er-Hörsaallast vom 19.08.2026.

**Belegt nicht:** produktive Aktivierung, Moderationsentscheidung, robuste Qualität für Slang, Mehrdeutigkeit oder alle Sprachen. Das synthetische Seed-Set ist ausdrücklich keine alleinige Produktivfreigabe.

### `SRC-ML-QA-SUMMARY` – Vertrag und Inferenzadapter ohne echtes LLM

**Quelle:** [Moderationszusammenfassung](../../features/qa-summary.md), [`qaSummaryConfig.ts`](../../../apps/backend/src/lib/qaSummaryConfig.ts), [`qaSummaryAdapter.ts`](../../../apps/backend/src/lib/qaSummaryAdapter.ts) und [`qaSummaryQueue.ts`](../../../apps/backend/src/lib/qaSummaryQueue.ts)

**Status:** Slices 1–3 implementiert; standardmäßig deaktiviert; echtes LLM ist Zielbild

**Belegt:** Host-UI-Vertrag, Quellenbindung, ephemeren In-Memory-Zustand, Queue, Cooldown, Timeout und einen für private Inferenz vorgesehenen HTTP-Adapter. Bekannte öffentliche SaaS-LLM-Endpunkte werden abgelehnt. Ohne konfigurierte Inferenz-URL gibt es keine Zusammenfassung.

**Belegt nicht:** ein technisch garantiert privates Netzwerkziel, einen ausgelieferten generativen Modellserver, `llama-server`-Kompatibilität, produktive Aktivierung oder inhaltlich korrekte Zusammenfassungen. Der lokale Dev-Helfer ist kein Produktionspfad und kann bei optionaler Gemini-Konfiguration Daten extern übertragen.

### `SRC-LLM-LLAMA-ZIELBILD` – angenommene Runtimeentscheidung

**Quelle:** [ADR-0035 zu `llama.cpp`](../../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md)

**Status:** akzeptierte Architekturentscheidung, aber nicht implementiertes Zielbild

**Belegt:** die Entscheidung, für künftige LLM-Labels und Summary-Slice 4 `llama.cpp`/`llama-server` direkt statt Ollama zu verwenden; privater zweiter Host als kanonische Produktionsannahme; ein gemeinsamer Slot; eigene Verträge, Queues, Timeouts, Fallbacks und Kill-Switch.

**Belegt nicht:** vorhandenes LLM-Image, Modellartefakt, Compose-Profil, Backendclient, Produktivhost, GPU, Kosten- oder Qualitätsabnahme. Die ADR autorisiert die Implementierung nicht selbst.

### `SRC-ML-FEATURE-FLAGS` – aktueller Defaultzustand

**Quelle:** [`.env.production.example`](../../../.env.production.example) und [`docker-compose.prod.yml`](../../../docker-compose.prod.yml)

**Status:** implementierte Vorlage

**Belegt:** `NLP_ENABLED=false`, `WORD_CLOUD_SEMANTIC_ENABLED=false`, `QA_NLP_ENABLED=false` und `QA_SUMMARY_ENABLED=false`. `OPEN_WEIGHT_LLM_ENABLED` ist nur auskommentiert als noch nicht implementiertes Zielbild; ein `llm`-Compose-Profil fehlt.

**Belegt nicht:** den Wert produktiver Umgebungsvariablen. Eine Vorlage ist keine Laufzeitabfrage.

## 21. Aussagegrenzen für Lehre und Dossier

1. Eine Codequelle darf als **implementiert**, nicht automatisch als **produktiv aktiv** bezeichnet werden.
2. Ein lokaler Report bleibt an Commit, Hardware, Datenbank, Redis, Netz und Lastgenerator gebunden.
3. Der historische 500er-Produktionsreport belegt nur den Joinpfad des Datums 09.05.2026.
4. SLOs sind Ziele, keine gemessene Kapazität.
5. Compose- und Umgebungsbeispiele sind Sollkonfigurationen; Image-Tags ohne Digest liefern keine exakte Patchversion.
6. README und Handbuch können hinter Manifest, Lockfile oder Code zurückliegen. Der Prisma-7.4/7.9-Konflikt ist ein konkretes Beispiel.
7. Monitoring-, Backup-, Nginx- und TLS-Runbooks beweisen für sich allein keinen operativ abgenommenen Host. Für W3.6 existiert zusätzlich die datierte historische Betriebsabnahme vom 26.07.2026; sie ist keine Garantie für den heutigen oder einen kursbezogenen Backupzustand.
8. `100 × 50` und `1 × 5.000` bleiben ungetestete Lehr- und Architekturprofile.
9. Anbieterportfolios, Regionen und Preise sind volatil und vor Verwendung an Primärquellen zu prüfen.
10. Kein ML- oder LLM-Ergebnis darf als Wahrheit, Personenbewertung oder autonome Moderationsentscheidung behandelt werden.
11. Für ARSnova-Tooldaten gelten zusätzlich [Datenmanagement und Datenschutz](./Datenmanagement_Datenschutz.md) sowie [Lehrenden-Runbook](./Lehrenden_Runbook.md).
