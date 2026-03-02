# 🚀 arsnova.eu (Vibe Coding Edition)

[![CI](https://github.com/kqc-real/arsnova-click-v3/actions/workflows/ci.yml/badge.svg)](https://github.com/kqc-real/arsnova-click-v3/actions/workflows/ci.yml)
[![Tech Stack: Angular](https://img.shields.io/badge/Frontend-Angular%2017%2B-DD0031.svg?style=flat-square&logo=angular)](https://angular.dev/)
[![Tech Stack: tRPC](https://img.shields.io/badge/API-tRPC-2596be.svg?style=flat-square&logo=trpc)](https://trpc.io/)
[![Tech Stack: Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748.svg?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Documentation: ADRs](https://img.shields.io/badge/Docs-ADRs%20(DaC)-007A8A.svg?style=flat-square)](./docs/architecture/)

> **Quizzen, abstimmen – gemeinsam und live.**  
> Ein modernes, kostenloses und 100 % DSGVO-konformes Audience-Response-System – ohne Anmeldung, Open Source. Entwickelt im Rahmen des Hochschul-Moduls „Software Engineering & Vibe Coding“.

## 📖 Über das Projekt

**arsnova.eu** ist die architektonische Neuerfindung einer etablierten Hörsaal-Quiz-App (Live-Quiz, Q&amp;A, Abstimmungen). Sie richtet sich an Lehrpersonen und Teilnehmende von der Kita bis zur Hochschule.

### Alleinstellungsmerkmale

* **Stil-Auswahl:** Die Lehrperson wählt beim Start der Session den Stil (**Seriös** oder **Spielerisch**) und kann Optionen anpassen (Rangliste, Sound, Lesephase, Team-Modus, Nicknames, Timer). So passt sich die Session an – von Kita bis Uni. Teilnehmende können den Stil nicht ändern. Im Preset **Spielerisch** pulsieren auf der Startseite Logo und Hero-Icons (nur bei normaler Bewegungspräferenz).
* **Bonus-Option für die Besten:** Top-Platzierte erhalten einen **einlösbaren Code**, den sie bei der Quizleitung einlösen können (z. B. für Bonuspunkte oder Anerkennung). Die App dient nicht als autorisiertes Prüfungsinstrument; die Einlösung liegt bei der Lehrperson.
* **Zero-Knowledge / Local-First:** Keine Accounts nötig. Quiz-Inhalte werden lokal im Browser des Erstellers gespeichert; beim Start einer Live-Session wird nur temporär eine Kopie an den Server übertragen. Nach Ende der Session werden die Daten bereinigt. Der Server ist reiner Relay für Echtzeit-Abstimmungen.

Weitere Details zu Ablauf, Presets und Datenschutz stehen in der **Hilfe-Seite** der App (`/help`) sowie im [Backlog](./Backlog.md).

## 🏗️ Der Technologie-Stack

Wir setzen auf einen stark typisierten, hochmodernen Full-Stack:

* **Frontend:** Angular (Standalone Components, Signals, Angular Material 3)
* **Backend:** Node.js API mit tRPC (End-to-End Typsicherheit & WebSockets)
* **Datenbank:** PostgreSQL via Prisma ORM
* **Echtzeit-Broker:** Redis (Pub/Sub)
* **Offline-Sync:** Yjs (CRDTs)

## 📂 Projektstruktur (Monorepo)

Dieses Projekt ist als Monorepo (npm Workspaces) strukturiert, damit Frontend und Backend sich nahtlos Typen und DTOs teilen können:

```text
arsnova-click-v3/
├── AGENT.md                 # 🤖 Leitplanken für euren KI-Assistenten
├── docs/
│   └── architecture/        # 🏛️ Architecture Decision Records (ADRs) & Handbuch
├── prisma/
│   └── schema.prisma        # 🗄️ Die Single Source of Truth (Datenbank)
├── apps/
│   ├── frontend/            # Angular (core/, shared/, features/ – Angular-Style-Struktur)
│   └── backend/             # Das Node.js-Projekt (Express, tRPC)
└── libs/
    └── shared-types/        # Geteilte Typen (tRPC Router, DTOs)
```

## 🚀 Getting Started (Für Entwickler)

Folge diesen Schritten, um das Projekt lokal auf deiner Maschine zum Laufen zu bringen.

### 1. Voraussetzungen

* Node.js (v20 oder neuer)
* Docker Desktop (für die lokale Datenbank)

### 2. Infrastruktur & Installation

Klone dieses Repository und wechsle in den Ordner:

```bash
git clone https://github.com/kqc-real/arsnova-click-v3.git
cd arsnova-click-v3
npm install
```

Kopiere die Environment-Datei und starte die Docker-Container (Postgres & Redis, **Epic 0**):

```bash
cp .env.example .env
docker compose up -d
# → Startet PostgreSQL (5432) und Redis (6379); optional: App-Container (3000, 3001, 3002)
# Für reine Lokalentwicklung (npm run dev) ohne Port-Konflikt: nur redis + postgres starten:
#   docker compose up -d redis postgres
```

Pushe das Datenbankschema und generiere den Prisma-Client:

```bash
npx prisma db push
npx prisma generate
```

### 3. Server starten

Starte Frontend und Backend parallel (oder einzeln: `npm run dev:backend` / `npm run dev:frontend`):

```bash
npm run dev
```

Die App ist nun unter `http://localhost:4200` (Frontend) erreichbar; auf der Startseite erscheint das **Server-Status-Widget** (Epic 0.4: aktive Sessions, Teilnehmer, completed Sessions, Status-Indikator). Die tRPC-API läuft auf `http://localhost:3000`; WebSocket-Subscriptions auf Port 3001, Yjs-Sync auf Port 3002.

**Hinweis NG0751:** Beim Dev-Start kann die Meldung erscheinen, dass `@defer`-Blöcke mit HMR eager geladen werden. Das ist erwartbar; im Production-Build wird das Server-Status-Widget weiterhin lazy geladen. Zum Testen ohne diese Meldung: `npm run dev:frontend -- --configuration=no-hmr` (dann ohne Hot-Reload).

**Reload / Deployment:** Damit Reload auf Unterseiten (z. B. `/legal/imprint`) nicht zu einer leeren Seite führt, muss der Server bei allen Client-Routen `index.html` ausliefern (SPA-Fallback). Beim lokalen `ng serve` ist das Standard. Für Production: Bei Vercel wird `apps/frontend/vercel.json` genutzt; bei Nginx/Apache/anderen Hosts eine Rewrite-Regel auf `index.html` setzen.

### 4. Production-ähnlich lokal (optional)

Für einen **lokal production-ähnlichen** Lauf (optimierter Build, ein Prozess liefert alles aus, Gzip, Pre-Render):

```bash
npm run build:prod    # Backend + Frontend für Production bauen
npm run start:prod    # Port 3000 freigeben (falls nötig), Backend starten
```

Die App ist dann unter **http://localhost:3000** erreichbar (Backend liefert das gebaute Frontend aus). Bei belegtem Port zuerst `npm run free-port-3000`, danach `npm run start:prod`; oder mit anderem Port: `PORT=3010 npm run start:prod` → dann **http://localhost:3010**. Details (Gzip, Pre-Render, Fallbacks) siehe [docs/cursor-context.md](./docs/cursor-context.md) Abschnitt 18.1.

### 5. Screenshots für die PWA-Manifest (optional)

Die PWA-Manifest-Datei referenziert zwei Screenshots (Desktop 1280×720, Mobile 390×844). Um sie neu zu erzeugen, muss die App unter einer URL laufen; das Skript wartet auf die gerenderte Startseite (nicht auf eine Verzeichnisliste).

**Option A – mit Backend (empfohlen):** Nach Production-Build das Backend starten und das Skript gegen Port 3000 laufen lassen:

```bash
npm run build:prod -w @arsnova/frontend
npm run start:prod
# In anderem Terminal, aus Repo-Root:
cd apps/frontend && SCREENSHOT_URL=http://localhost:3000 npm run screenshots
```

**Option B – mit Dev-Server:** Frontend mit `npm run dev:frontend` starten, dann (in anderem Terminal) aus `apps/frontend`: `npm run screenshots`. Default-URL ist dann `http://localhost:4200`.

**Option C – nur Static-Serve:** Nach `npm run build:prod -w @arsnova/frontend` erzeugt das Skript beim ersten Aufruf automatisch `dist/browser/index.html` aus `index.csr.html`, damit `npx serve dist/browser -p 4210 -s` die App ausliefert (ohne diese Datei würde `/` eine Verzeichnisliste zeigen). Danach Serve starten und Screenshots mit `SCREENSHOT_URL=http://localhost:4210 npm run screenshots` erzeugen.

Die PNGs landen in `apps/frontend/src/assets/icons/` (`screenshot-wide.png`, `screenshot-narrow.png`).

### 6. Tests ausführen

Alle Tests (Backend + Frontend) auf einen Schlag:

```bash
npm test
```

Oder einzeln pro Workspace:

```bash
# Backend-Tests (Vitest)
npm test -w @arsnova/backend

# Frontend-Tests (Vitest + @analogjs/vitest-angular)
npm test -w @arsnova/frontend
```

Für den Watch-Modus während der Entwicklung:

```bash
npm run test:watch -w @arsnova/frontend
```

> **Hinweis:** Die Frontend-Tests laufen in einer jsdom-Umgebung. Angular-Material-Stylesheets können dort nicht vollständig geparst werden – die resultierende Warnung wird im Test-Setup automatisch unterdrückt.

## 🤖 Vibe Coding & KI-Assistenz

Dieses Projekt wird im "Vibe Coding"-Modus entwickelt. Du agierst als Architekt, die KI (z.B. GitHub Copilot, Cursor, Gemini) übernimmt die Code-Generierung.

**WICHTIG:** Lade zu Beginn deiner Programmier-Session immer die Datei `AGENT.md` in den Kontext deiner KI, damit diese sich an die strengen Architektur- und Sicherheitsregeln (z.B. das Data-Stripping von Lösungen) hält. Für **umfassenden Projekt-Kontext** (Struktur, Stack, Backlog, DoD, ~4k Tokens) und optional **Context Caching** (Claude Opus 4.6): `@docs/cursor-context.md` in die erste Nachricht einbinden. Die Cursor-Regel unter `.cursor/rules/core.mdc` verweist darauf automatisch.

**Übergabe an Studis:** Siehe [CONTRIBUTING.md](./CONTRIBUTING.md) – Onboarding, Story-Wahl, DoD-Check vor PR, Branch/PR-Konventionen.

## 📚 Dokumentation

Wir leben **"Documentation as Code"**. Bevor du große Features implementierst, lies das [Architektur-Handbuch](./docs/architecture/handbook.md). Jede architektonische Entscheidung muss als ADR im Ordner `docs/architecture/decisions/` dokumentiert werden.

## 🗺️ Nächste Schritte (Onboarding)

Nachdem die App lokal läuft, empfiehlt sich diese Lesereihenfolge:

1. **[CONTRIBUTING.md](./CONTRIBUTING.md)** – Mitwirken, Story-Wahl, DoD vor PR (Einstieg für Studis)
2. **[AGENT.md](./AGENT.md)** – die KI-Leitplanken (immer zuerst in den Kontext laden!)
3. **[docs/cursor-context.md](./docs/cursor-context.md)** – stabile Projektreferenz für KI (~4k Tokens; für Context Caching: `@docs/cursor-context.md` laden)
4. **[Backlog.md](./Backlog.md)** – alle Storys mit Prioritäten und Definition of Done
5. **[Architektur-Handbuch](./docs/architecture/handbook.md)** – Konzepte, Stack und Regeln
6. **[Diagramme](./docs/diagrams/diagrams.md)** – Mermaid-Diagramme (Komponenten, Sequenz, ER, …)
7. **[ADRs](./docs/architecture/decisions/)** – bisherige Architekturentscheidungen (Signals, tRPC, Yjs)
8. **[Vibe-Coding-Szenario](./docs/vibe-coding/vibe-coding-szenario.md)** – so funktioniert die Zusammenarbeit mit der KI

> **Tipp:** **Epic 0 (Infrastruktur) ist abgeschlossen** (Redis, tRPC WebSocket, Yjs, Server-Status, Rate-Limiting, CI/CD). Starte mit einer 🔴 Must-Story aus Epic 1 oder 2, die noch ⬜ Offen ist (z.B. Story 1.1 Quiz erstellen). Lies erst den Story-Text im Backlog, dann prompte deine KI mit dem Kontext aus `AGENT.md`.

## 🔄 Zurücksetzen auf einen bekannten Zustand

Falls etwas schiefgeht oder du komplett neu anfangen möchtest, kannst du auf einen der folgenden Git-Tags zurücksetzen:

| Tag | Beschreibung |
|-----|--------------|
| **`v0-baseline`** | Sauberer Startzustand (Projekt-Skeleton: Health-Check, CI/CD, Prisma-Schema, Zod-Schemas, Dokumentation) |
| **`v0-epic0`** | Epic 0 abgeschlossen (Redis, tRPC WebSocket, Yjs, Server-Status, Rate-Limiting, CI/CD, alle 0.1–0.6 umgesetzt) |

```bash
# Alle lokalen Änderungen verwerfen und auf gewünschten Stand setzen
git reset --hard v0-epic0   # Stand nach Epic 0 (empfohlen)
# oder
git reset --hard v0-baseline   # Nur Skeleton (vor Epic 0)
npm install
```

> **Achtung:** `git reset --hard` löscht alle nicht-committeten Änderungen unwiderruflich. Committe oder stashe deine Arbeit vorher, falls du sie behalten willst.

---
*Viel Erfolg beim Bauen der Zukunft des digitalen Lernens!* 🚀
