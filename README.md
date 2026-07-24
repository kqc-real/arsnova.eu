# arsnova.eu

> Open-source Audience-Response-System für Institutionen, die Quiz, Q&A und Live-Feedback datensparsam selbst betreiben möchten.

[![CI](https://github.com/kqc-real/arsnova.eu/actions/workflows/ci.yml/badge.svg)](https://github.com/kqc-real/arsnova.eu/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-0f766e.svg?style=flat-square)](./LICENSE)
[![Tech Stack: Angular](https://img.shields.io/badge/Frontend-Angular%2021.2-DD0031.svg?style=flat-square&logo=angular)](https://angular.dev/)
[![Tech Stack: tRPC](https://img.shields.io/badge/API-tRPC%20v11-2596be.svg?style=flat-square&logo=trpc)](https://trpc.io/)
[![Tech Stack: Prisma](https://img.shields.io/badge/ORM-Prisma%207.4-2D3748.svg?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Docs: Architecture](https://img.shields.io/badge/Docs-Architecture%20%26%20ADRs-007A8A.svg?style=flat-square)](./docs/architecture/)
[![Status](https://img.shields.io/badge/status-Better%20Stack-2ea44f.svg?style=flat-square)](https://arsnova.betteruptime.com/)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/kqc-real/arsnova.eu)

**arsnova.eu** ist eine moderne Web-App für Live-Interaktion in Lehre, Weiterbildung, Workshops und Veranstaltungen. Lehrende erstellen Quiz-Inhalte lokal im Browser, starten Sessions per Code oder QR-Link und kombinieren dabei Quiz, Q&A und Blitzlicht-Feedback in einer einheitlichen Live-Session. Die Anwendung ist accountarm, mehrsprachig, PWA-fähig und auf einen DSGVO-orientierten Eigenbetrieb ausgelegt.

Die öffentliche Referenzinstanz läuft unter **https://arsnova.eu**; der externe Betriebsstatus ist unter **https://arsnova.betteruptime.com/** einsehbar. Dieses Repository richtet sich an Organisationen, die arsnova.eu evaluieren, forken, anpassen oder auf eigener Infrastruktur produktiv betreiben möchten.

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
| Frontend           | Angular 21.2.x, Standalone Components, Signals, Angular Material 3          |
| API                | Node.js, Express, tRPC v11, HTTP und WebSocket-Subscriptions                |
| Schemas / DTOs     | Zod v4 in `@arsnova/shared-types`, gemeinsam genutzt von Backend/Frontend   |
| Persistenz         | PostgreSQL 16 via Prisma ORM 7.4.x                                          |
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
- PostgreSQL-Backups sind automatisiert und ein Restore wurde praktisch getestet.
- Admin-Zugang, Legal-Hold, Löschpfad, Exportpfad und Audit-Log wurden mit Rollenverantwortlichen geprüft.
- Impressum, Datenschutz, Kontaktwege und institutionelle Nutzungshinweise sind angepasst.
- Eine Test-Session mit Host-, Present- und Teilnehmergerät wurde inklusive WebSockets, Yjs-Sync und Mobile-Ansicht durchgeführt.
- Monitoring, Logzugriff, Update-Prozess und Incident-Verantwortlichkeiten sind dokumentiert.

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
- [AGENT.md](./AGENT.md), falls KI-gestützt entwickelt wird

## Qualität und Status

Der aktuelle Codebestand ist auf produktionsnahen Betrieb ausgerichtet und wird über CI geprüft. Die öffentliche Referenzinstanz wird extern über Better Stack überwacht; die Status Page steht unter **https://arsnova.betteruptime.com/**. Implementiert sind insbesondere die Kern-Epics für Live-Session, Quiz, Q&A, Blitzlicht, Team-Modus, Admin, MOTD, i18n und Server-Status. Offen bleiben laut Backlog unter anderem die abschließende Barrierefreiheitsprüfung, UX-Testreihen, vollständige Last-/Performance-Strecken und weitere fachliche Ausbaustufen.

Der konkrete Produkt- und Story-Stand wird nicht in dieser README fortgeschrieben, sondern in:

- [Backlog.md](./Backlog.md)
- [docs/APP-FUNKTIONSUEBERSICHT.md](./docs/APP-FUNKTIONSUEBERSICHT.md)
- [docs/architecture/handbook.md](./docs/architecture/handbook.md)

## Lizenz

arsnova.eu steht unter der [MIT License](./LICENSE). Institutionelle Forks und eigene Installationen sind ausdrücklich möglich. Bitte prüfen Sie vor öffentlichem Betrieb, welche rechtlichen, datenschutzbezogenen und betrieblichen Pflichten für Ihre Organisation gelten.
