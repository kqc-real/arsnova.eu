# arsnova.eu

> Open-source Audience-Response-System für Institutionen, die Quiz, Q&A und Live-Feedback datensparsam selbst betreiben möchten.

[![CI](https://github.com/kqc-real/arsnova.eu/actions/workflows/ci.yml/badge.svg)](https://github.com/kqc-real/arsnova.eu/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-0f766e.svg?style=flat-square)](./LICENSE)
[![Tech Stack: Angular](https://img.shields.io/badge/Frontend-Angular%2022.2-DD0031.svg?style=flat-square&logo=angular)](https://angular.dev/)
[![Tech Stack: tRPC](https://img.shields.io/badge/API-tRPC%20v11-2596be.svg?style=flat-square&logo=trpc)](https://trpc.io/)
[![Tech Stack: Prisma](https://img.shields.io/badge/ORM-Prisma%207.9-2D3748.svg?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Docs: Architecture](https://img.shields.io/badge/Docs-Architecture%20%26%20ADRs-007A8A.svg?style=flat-square)](./docs/architecture/)
[![Status](https://img.shields.io/badge/status-Better%20Stack-2ea44f.svg?style=flat-square)](https://arsnova.betteruptime.com/)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/kqc-real/arsnova.eu)

**arsnova.eu** ist eine moderne Web-App für Live-Interaktion in Lehre, Weiterbildung, Workshops und Veranstaltungen. Lehrende erstellen Quiz-Inhalte lokal im Browser, starten Sessions per Code oder QR-Link und kombinieren dabei Quiz, Q&A und Blitzlicht-Feedback in einer einheitlichen Live-Session. Die Anwendung ist accountarm, mehrsprachig, PWA-fähig und auf einen DSGVO-orientierten Eigenbetrieb ausgelegt.

Die öffentliche Referenzinstanz läuft unter **https://arsnova.eu**; die getrennte Marketing- und Informationsseite unter **https://info.arsnova.eu/**. Der externe Betriebsstatus ist unter **https://arsnova.betteruptime.com/** einsehbar. Dieses Repository richtet sich an Organisationen, die arsnova.eu evaluieren, forken, anpassen oder auf eigener Infrastruktur produktiv betreiben möchten.

**Aktueller Versionsstand: 1.4.0.** Neuerungen sowie Upgrade-, Betriebs- und
Rollbackhinweise stehen in den [Release Notes 1.4.0](./docs/releases/1.4.0.md).
Der letzte bestätigte Produktionsrelease ist
[v1.3.0](https://github.com/kqc-real/arsnova.eu/releases/tag/v1.3.0).
Der Produktionsnachweis für 1.4.0 wird nach erfolgreichem Rollout ergänzt.

## Für wen ist dieses Repository relevant?

- **Hochschulen, Schulen, Bildungsträger und Unternehmen**, die ein selbst gehostetes Audience-Response-System einsetzen möchten.
- **E-Learning- und IT-Teams**, die Datenschutz, Betrieb, Backups, Domain, TLS und Monitoring selbst kontrollieren wollen.
- **Forker und Produktteams**, die arsnova.eu an institutionelle Workflows, Designvorgaben oder didaktische Szenarien anpassen möchten.
- **Entwickler:innen**, die an einem TypeScript-Monorepo mit Angular, tRPC, Prisma, PostgreSQL, Redis und Yjs mitarbeiten.

## Produktumfang

arsnova.eu bündelt mehrere Live-Formate in einer App:

| Bereich                         | Zweck                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Quiz**                        | Single Choice, Multiple Choice, Freitext, Kurzantwort, Umfrage und Bewertungsskala                       |
| **Q&A**                         | Fragen sammeln, sortieren, moderieren und in Sessions sichtbar machen                                    |
| **Blitzlicht / Quick Feedback** | Schnelle Stimmungs-, Ja/Nein-, Sterne-, ABCD- und Tempo-Feedback-Runden, standalone oder sessiongebunden |
| **Team- und Bonusmodus**        | Teamzuordnung, Leaderboards, Scorecards, Bonuscodes und Ergebnisexporte                                  |
| **Present-Ansicht**             | Beamer- bzw. Raumansicht für öffentliche Session-Darstellung                                             |
| **Admin-Bereich**               | Betreiberzugriff für Session-Inspektion, Legal Hold, Löschung, Export und MOTD                           |
| **MOTD / News**                 | Plattformweite Mitteilungen, Archiv, Interaktionen und Admin-Vorlagen                                    |
| **PWA und i18n**                | Installierbare Web-App mit lokalisierten Builds für `de`, `en`, `fr`, `es`, `it`                         |

Die ausführliche, codebasierte Funktionsübersicht steht in [docs/APP-FUNKTIONSUEBERSICHT.md](./docs/APP-FUNKTIONSUEBERSICHT.md).

## Betriebs- und Datenschutzmodell

arsnova.eu ist auf institutionellen Eigenbetrieb ausgelegt:

- **Keine Pflichtkonten für Lehrende oder Teilnehmende.** Sessions laufen über Codes, QR-Links und kurzlebige Rollen-Tokens.
- **Local-first Quiz-Erstellung.** Die Quiz-Sammlung liegt primär im Browser der Lehrperson; beim Live-Start wird eine serverseitige Session-Kopie erzeugt.
- **Serverseitiges Data-Stripping.** Lösungsrelevante Felder werden erst in der Ergebnisphase ausgeliefert.
- **Rollen- und Token-Schutz.** Host-, Present-, Feedback-Host- und Admin-Pfade sind getrennt abgesichert.
- **Kurzlebige Live-Daten.** Redis wird für Rate-Limits, Token-TTLs und Live-Hilfsdaten genutzt; persistente Session-, Audit-, Statistik- und MOTD-Daten liegen in PostgreSQL.
- **Betreiberkontrolle.** Admin-Pfade unterstützen Inspektion, Löschung, Legal Hold, Behördenexport und Audit-Logging.

Wichtig: arsnova.eu ersetzt keine organisationsweite IAM-, LMS-, Prüfungs- oder Archivlösung. Vor produktivem Einsatz sollten Datenschutz, Löschfristen, Backups, Impressum/Datenschutztexte, Domain, TLS, Monitoring und Verantwortlichkeiten institutionell freigegeben werden. Technische Details stehen in [docs/SECURITY-OVERVIEW.md](./docs/SECURITY-OVERVIEW.md) und [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md).

## Technischer Überblick

| Schicht            | Technologie                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| Frontend           | Angular 22.2.x, Standalone Components, Signals, Angular Material 3          |
| API                | Node.js, Express, tRPC v11, HTTP und WebSocket-Subscriptions                |
| Schemas / DTOs     | Zod v4 in `@arsnova/shared-types`, gemeinsam genutzt von Backend/Frontend   |
| Persistenz         | PostgreSQL 16 via Prisma ORM 7.9.1                                          |
| Kurzzeitdaten      | Redis 7 für Rate-Limits, Token-TTLs, Presence-/Live-Hilfsdaten, Blitzlicht  |
| Local-first Sync   | Yjs / y-websocket für Quiz-Sammlungen                                       |
| Deployment         | Docker Compose, Nginx Reverse Proxy, Let's Encrypt, GitHub Actions optional |
| Qualitätssicherung | TypeScript, ESLint, Prettier, Vitest, CI-Matrix für Node 22 und 24          |

Die Architektur ist als Living Documentation gepflegt:

- [Architektur-Handbuch](./docs/architecture/handbook.md)
- [Architecture Decision Records](./docs/architecture/decisions/)
- [Diagramme](./docs/diagrams/diagrams.md)
- [Doku-Landkarte](./docs/README.md)

## Produktivbetrieb: empfohlener Weg

Für eine institutionelle Installation ist der vorgesehene Produktionspfad:

1. **Fork erstellen** und Verantwortlichkeiten für Betrieb, Datenschutz und Security klären.
2. **Server bereitstellen**, z. B. Debian 12/13 mit Docker Compose, Nginx, TLS, Firewall und Backups.
3. **Produktions-Env konfigurieren** auf Basis von [`.env.production.example`](./.env.production.example).
4. **Deployment mit Docker Compose** über [docker-compose.prod.yml](./docker-compose.prod.yml) und optional GitHub Actions.
5. **Domain, TLS und Reverse Proxy** nach [docs/deployment-debian-root-server.md](./docs/deployment-debian-root-server.md) einrichten.
6. **Go/No-Go prüfen**, inklusive Healthcheck, Admin-Login, Session-Start, WebSockets, Yjs-Sync, Backup und Restore.

Minimaler Server-Stack:

```text
Internet
  -> Nginx / TLS / WebSocket Proxy
  -> arsnova.eu App Container (Port 3000, 3001, 3002 nur lokal)
  -> PostgreSQL
  -> Redis
```

Produktionsrelevante Dokumente:

- [Deployment auf Debian Root-Server](./docs/deployment-debian-root-server.md)
- [Umgebungsvariablen](./docs/ENVIRONMENT.md)
- [Sicherheit & Datenschutz](./docs/SECURITY-OVERVIEW.md)
- [Tests & CI](./docs/TESTING.md)
- [Admin-Flow](./docs/implementation/ADMIN-FLOW.md)

### Go-Live-Checkliste für Institutionen

Vor öffentlichem Betrieb sollten mindestens diese Punkte geklärt und getestet sein:

- Eigene Domain, TLS-Zertifikate, HTTPS-Weiterleitung und WebSocket-Proxy sind eingerichtet.
- `.env.production` enthält starke Secrets, korrekte Datenbank-/Redis-URLs und passende Rate-Limits.
- `TRUST_PROXY_HOPS` ist für den Reverse-Proxy korrekt gesetzt, damit Rate-Limits echte Client-IPs sehen.
- PostgreSQL und Produktionskonfiguration werden gemäß
  [Backup-/Restore-Runbook](./docs/operations/BACKUP-RESTORE-RUNBOOK.md)
  verschlüsselt offsite gesichert; ein Restore auf isoliertem Ziel wurde
  praktisch getestet.
- Admin-Zugang, Legal-Hold, Löschpfad, Exportpfad und Audit-Log wurden mit Rollenverantwortlichen geprüft.
- Impressum, Datenschutz, Kontaktwege und institutionelle Nutzungshinweise sind angepasst.
- Eine Test-Session mit Host-, Present- und Teilnehmergerät wurde inklusive WebSockets, Yjs-Sync und Mobile-Ansicht durchgeführt.
- Automatische Security-/Lastalarme, externer Heartbeat, Logzugriff,
  Update-Prozess und Incident-Verantwortlichkeiten sind gemäß
  [Monitoring-Runbook](./docs/operations/MONITORING-RUNBOOK.md) eingerichtet;
  der Alarmweg wurde synthetisch getestet.

## Lokale Evaluation

Für eine technische Evaluation reicht ein lokaler Lauf mit PostgreSQL und Redis in Docker.

### Voraussetzungen

- Node.js gemäß [`.nvmrc`](./.nvmrc): Node 24 LTS ist der Referenz- und Produktionspfad; Node 22 wird in CI als Kompatibilitätspfad geprüft.
- npm mit dem mitgelieferten Lockfile.
- Docker / Docker Compose für PostgreSQL und Redis.

### Schnellstart

```bash
git clone https://github.com/kqc-real/arsnova.eu.git
cd arsnova.eu
cp .env.example .env
npm ci
npm run setup:dev
npm run dev
```

Danach ist die App lokal unter **http://localhost:4200** erreichbar. Backend, tRPC-WebSocket und Yjs-Relay laufen standardmäßig auf den Ports `3000`, `3001` und `3002`.

Für den Admin-Bereich (`/admin`) muss in `.env` ein starkes `ADMIN_SECRET` gesetzt sein.

### Optional: lokale Text-KI (Qwen3-4B)

Die Text-KI ist **kein** Pflichtbestandteil des Schnellstarts. Quiz, Q&A und Blitzlicht laufen ohne Modell, ohne Hugging-Face-Download und ohne SSH-Zugang zu einem Inferenzserver. Forks und Clones ohne Schlüssel werden dadurch nicht blockiert.

Sind ein privater Qwen-Dienst und die Zugangswerte in `.env` bereits vorhanden,
startet der hervorgehobene Gesamtbefehl alle KI-Pfade der Entwicklungsumgebung:

```bash
npm run dev:ai
```

Er umfasst Q&A-Kategorisierung, spaCy-Lemmatisierung, E5-Themenbildung, den
lokalen Ersatz für Zusammenfassungen sowie die über Qwen laufenden
Themenbeschriftungen, Moderationszusammenfassungen und Lernzielvorschläge. Qwen
selbst wird dabei nicht gestartet; der Befehl verwendet die konfigurierte URL
oder den Maintainer-SSH-Tunnel.

Für den Entwicklungsrechner sind mit entferntem Qwen konservativ 4 Kerne,
12 GiB RAM und 10 GiB freier Speicher einzuplanen; empfohlen sind 8 Kerne,
16 GiB RAM und 20 GiB frei. Läuft Qwen zusätzlich lokal, gelten 8 Kerne,
16 GiB RAM und 20 GiB frei als Planungswert. Der E5-Container ist auf 1 CPU und
2 GiB RAM begrenzt; der lokale Qwen-Laborcontainer auf 4 CPUs und 5 GiB RAM.
Die GGUF-Datei belegt exakt 2.497.281.120 Byte, zusätzlich fallen Docker-Image
und Build-Cache an. Die vollständige Aufschlüsselung, Grenzen und Locales stehen
im [`dev:ai`-Onboarding](./docs/onboarding.md#alle-ki-komponenten-starten-npm-run-devai).

Wer lokal mit Lernzielvorschlägen, Themenlabels oder der Moderationskurzfassung experimentieren möchte, startet **Qwen3-4B-Instruct** in Docker. Das Modell wird einmalig heruntergeladen (rund 2,5 GB) und nicht ins Git übernommen.

Die Qwen-Runtime zuerst in einem eigenen Terminal vorbereiten:

```bash
mkdir -p models/open-weight-llm
curl --fail --location \
  --output models/open-weight-llm/Qwen3-4B-Instruct-2507-Q4_K_M.gguf \
  https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/a06e946bb6b655725eafa393f4a9745d460374c9/Qwen3-4B-Instruct-2507-Q4_K_M.gguf
node scripts/open-weight-llm/verify-model.mjs
npm run docker:up:llm:http
```

Anschließend in `.env` `OPEN_WEIGHT_LLM_ENABLED=true`, `OPEN_WEIGHT_LLM_URL=http://127.0.0.1:8080` und dasselbe Runtime-Token wie im Container setzen, danach `npm run dev:ai` starten. Den vollständigen Docker-Laborpfad (`npm run docker:up:llm`) nicht parallel zu `npm run dev` oder `npm run dev:ai` verwenden: Er startet zusätzlich den App-Container auf denselben Ports.

Schritt-für-Schritt, Hardware, `.env` und typische Fehler stehen in [docs/onboarding.md](./docs/onboarding.md#optional-lokale-text-ki-qwen3-4b). Der technische Runtime-Vertrag bleibt [docs/features/open-weight-llm-runtime.md](./docs/features/open-weight-llm-runtime.md).

### Lokale Checks

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Weitere Hinweise zu Dev-Servern, lokalisierten Builds, Smoke-Tests und CI stehen in [docs/TESTING.md](./docs/TESTING.md) und [docs/I18N-ANGULAR.md](./docs/I18N-ANGULAR.md).

## Forking und Anpassung

Ein institutioneller Fork sollte möglichst wenig Kernlogik ändern und Anpassungen bewusst kapseln:

- **Branding und Texte:** Angular-i18n, Legal-Markdown und MOTD-Vorlagen.
- **Betrieb:** `.env.production`, Nginx, Docker Compose, Backups, Domain und TLS.
- **Didaktik:** Quiz-Vorlagen, Demo-Inhalte, Hilfe-Texte und institutionelle Leitfäden.
- **Design:** Angular Material 3 Tokens, Styleguide und UI-Komponenten.
- **Features:** Neue Rollen, Importformate oder Auswertungen nur mit ADR, Tests und Datenschutzprüfung.

Vor größeren Änderungen sollten diese Dokumente gelesen werden:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [Backlog.md](./Backlog.md)
- [Architektur-Handbuch](./docs/architecture/handbook.md)
- [Projektglossar](./docs/GLOSSAR.md)
- [AGENTS.md](./AGENTS.md), falls KI-gestützt entwickelt wird

## Qualität und Status

Der aktuelle Codebestand ist auf produktionsnahen Betrieb ausgerichtet und wird über CI geprüft. Die öffentliche Referenzinstanz wird extern über Better Stack überwacht; die Status Page steht unter **https://arsnova.betteruptime.com/**. Implementiert sind insbesondere die Kern-Epics für Live-Session, Quiz, Q&A, Blitzlicht, Team-Modus, Admin, MOTD, i18n und Server-Status. Offen bleiben laut Backlog unter anderem die abschließende Barrierefreiheitsprüfung, UX-Testreihen, vollständige Last-/Performance-Strecken und weitere fachliche Ausbaustufen.

Der konkrete Produkt- und Story-Stand wird nicht in dieser README fortgeschrieben, sondern in:

- [Backlog.md](./Backlog.md)
- [docs/APP-FUNKTIONSUEBERSICHT.md](./docs/APP-FUNKTIONSUEBERSICHT.md)
- [docs/architecture/handbook.md](./docs/architecture/handbook.md)

## Lizenz

arsnova.eu steht unter der [MIT License](./LICENSE). Institutionelle Forks und eigene Installationen sind ausdrücklich möglich. Bitte prüfen Sie vor öffentlichem Betrieb, welche rechtlichen, datenschutzbezogenen und betrieblichen Pflichten für Ihre Organisation gelten.
