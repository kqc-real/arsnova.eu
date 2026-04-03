# 🚀 arsnova.eu (Vibe Coding Edition)

> **Produktion:** Die Anwendung läuft unter **https://arsnova.eu**. Beispiele
> in der Dokumentation beziehen sich auf diese Domain, sofern nicht anders
> angegeben.

[![CI](https://github.com/kqc-real/arsnova.eu/actions/workflows/ci.yml/badge.svg)](https://github.com/kqc-real/arsnova.eu/actions/workflows/ci.yml)
[![Tech Stack: Angular](https://img.shields.io/badge/Frontend-Angular%2021-DD0031.svg?style=flat-square&logo=angular)](https://angular.dev/)
[![Tech Stack: tRPC](https://img.shields.io/badge/API-tRPC-2596be.svg?style=flat-square&logo=trpc)](https://trpc.io/)
[![Tech Stack: Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748.svg?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Documentation: ADRs](<https://img.shields.io/badge/Docs-ADRs%20(DaC)-007A8A.svg?style=flat-square>)](./docs/architecture/)

> **Quizzen, abstimmen – gemeinsam und live.**  
> Ein modernes, kostenloses Audience-Response-System für datensparsame, DSGVO-orientierte Lehre – ohne Anmeldung, Open Source. Entwickelt im Rahmen des Hochschul-Moduls „Software Engineering & Vibe Coding“.

## ✅ Aktueller Entwicklungsstand (April 2026)

- **Produktionsreif umgesetzt:** Epics **0–5**, **7.1 (Team-Modus)**, **8**, **9 (Admin)** und **10 (MOTD / Plattform-Kommunikation, ADR-0018)** — siehe [`Backlog.md`](./Backlog.md).
- **Plattform-Qualität:** Epic **6** ist im Kern umgesetzt (Theme, i18n, Legal, Responsive); **6.5 Barrierefreiheit (Abschlussprüfung)** und **6.6 Thinking Aloud** sind noch offen.
- **Offene Stories (Auswahl):** u. a. **2.1c** (Host-/Presenter-Token), **0.7** (Lasttests), **1.7a/1.7b** (Markdown-Erweiterungen), **8.5–8.7** (Q&A) — vollständige Liste im Backlog.
- **Plattform-Statistik:** Rekord **max. Teilnehmer je Session** wird serverseitig gepflegt und in `health.stats` sowie auf der Hilfe-Seite genutzt (`PlatformStatistic`, siehe Backlog „Repo-Abgleich“).
- **Lehre:** Greenfield-Demo **Story 1.7a** in **3×45 Min.** — Leitfaden [`docs/didaktik/greenfield-demo-1-7a-vorlesung.md`](docs/didaktik/greenfield-demo-1-7a-vorlesung.md); Epic 10 bleibt optionales **Referenzbeispiel**, kein Ersatz für 1.7a.

## 📖 Über das Projekt

**arsnova.eu** ist die architektonische Neuerfindung einer etablierten Hörsaal-Quiz-App (Live-Quiz, Q&amp;A, Abstimmungen). Sie richtet sich an Lehrpersonen und Teilnehmende von der Kita bis zur Hochschule.

### Alleinstellungsmerkmale

- **Stil-Auswahl:** Die Lehrperson wählt beim Start der Session den Stil (**Seriös** oder **Spielerisch**) und kann Optionen anpassen (Rangliste, Sound, Lesephase, Team-Modus, Nicknames, Timer). So passt sich die Session an – Kita bis Uni. Teilnehmende können den Stil nicht ändern. Im Preset **Spielerisch** pulsieren auf der Startseite das Logo (nur bei normaler Bewegungspräferenz); im Team-Modus kommen zusätzlich farbige Teamkarten, motivierende Effekte im Join-/Lobby-Flow, ein teamzentrierter Lobby-Moment auf dem Beamer sowie ein klar fokussiertes Team-Finale auf Teilnehmergerät und Beamer dazu.
- **Bonus-Option für die Besten:** Top-Platzierte erhalten einen **einlösbaren Code**, den sie bei der Quizleitung einlösen können (z. B. für Bonuspunkte oder Anerkennung). Die App dient nicht als autorisiertes Prüfungsinstrument; die Einlösung liegt bei der Lehrperson.
- **Zero-Knowledge / Local-First:** Keine Accounts nötig. Quiz-Inhalte werden lokal im Browser des Erstellers gespeichert; beim Start einer Live-Session wird nur temporär eine Kopie an den Server übertragen. Nach Ende der Session werden die Daten bereinigt. Der Server ist reiner Relay für Echtzeit-Abstimmungen.
- **Admin-Kontrollpfad für Recht & Betrieb (Epic 9):** Betreiber können Sessions über `/admin` inspizieren, rechtlich begründet löschen und Behördenauszüge erzeugen (PDF/JSON, mit Audit-Log und ohne unnötige PII).

Weitere Details zu Ablauf, Presets und Datenschutz stehen in der **Hilfe-Seite** der App (`/help`) sowie im [Backlog](./Backlog.md).

## 🏗️ Der Technologie-Stack

Wir setzen auf einen stark typisierten, hochmodernen Full-Stack:

- **Frontend:** Angular 21 (Standalone Components, Signals, Angular Material 3; Style Guide: separate .html/.scss per component, `inject()` for DI, Vitest for unit tests)
- **Backend:** Node.js API mit tRPC (End-to-End Typsicherheit & WebSockets)
- **Datenbank:** PostgreSQL via Prisma ORM
- **Echtzeit-Broker:** Redis (Pub/Sub)
- **Offline-Sync:** Yjs (CRDTs)

## 📂 Projektstruktur (Monorepo)

Dieses Projekt ist als Monorepo (npm Workspaces) strukturiert, damit Frontend und Backend sich nahtlos Typen und DTOs teilen können:

```text
arsnova.eu/
├── AGENT.md                 # 🤖 Leitplanken für euren KI-Assistenten
├── docs/
│   ├── README.md            # 📑 Doku-Landkarte (nach Rolle & Thema)
│   ├── ENVIRONMENT.md       # 🔧 Umgebungsvariablen-Referenz
│   ├── SECURITY-OVERVIEW.md # 🔒 Sicherheit & DSGVO (Kurz)
│   ├── TESTING.md           # 🧪 Tests & CI-Matrix
│   ├── GLOSSAR.md           # 📖 App-Begriffe & Prisma-Brücke
│   ├── architecture/        # 🏛️ Architecture Decision Records (ADRs) & Handbuch
│   ├── implementation/      # 🛠️ Umsetzungs-/Betriebsdokus (z. B. Admin-Flow)
│   └── ui/                  # 🎨 UI/UX-Guides und Audits
├── prisma/
│   └── schema.prisma        # 🗄️ Die Single Source of Truth (Datenbank)
├── apps/
│   ├── frontend/            # Angular 21 (core/, shared/, features/; .html/.scss/.spec.ts je Komponente)
│   └── backend/             # Das Node.js-Projekt (Express, tRPC)
└── libs/
    └── shared-types/        # Geteilte Typen (tRPC Router, DTOs)
```

## 🚀 Getting Started (Für Entwickler)

Folge diesen Schritten, um das Projekt lokal auf deiner Maschine zum Laufen zu bringen.

### 1. Voraussetzungen

- **Node.js:** aktuelle **LTS**-Versionen **20.x** oder **22.x** (empfohlen). Die Datei **`.nvmrc`** pinnt **20** — mit [nvm](https://github.com/nvm-sh/nvm), [fnm](https://github.com/Schniz/fnm) oder [asdf](https://asdf-vm.com/) einfach `nvm use` / `fnm use` im Repo-Root ausführen. **Keine „Current“- oder Odd-Majors** (z. B. **21**, **23**) für Build und Entwicklung verwenden; Angular-CLI, esbuild und native Abhängigkeiten sind darauf nicht abgesichert (typische Abstürze im Production-Build). Optional spätere **LTS** (z. B. 24.x): siehe `engines` in der Root-`package.json`.
- **npm:** mit dem gelieferten **Lockfile** arbeiten — **`npm ci`** nach Clone (empfohlen) bzw. die in der Lockfile dokumentierte npm-Version; kein blindes Upgrade der npm-Hauptversion nötig.
- Docker Desktop (für die lokale Datenbank)

**Windows:** Wenn native Tooling (esbuild, Prisma) zickt, **WSL2** mit Ubuntu und dieselben Node-LTS-Schritte wie oben nutzen — reduziert Abweichungen zum Team und zur CI.

### 2. Infrastruktur & Installation

Klone dieses Repository (oder deinen Fork) und wechsle in den Ordner:

```bash
git clone https://github.com/kqc-real/arsnova.eu.git
cd arsnova.eu
npm ci          # empfohlen: wie CI / Lockfile 1:1 — alternativ: npm install
```

**PostgreSQL und Redis auf aktuellen Stand bringen** (wichtig z. B. nach Fork/Clone): Kopiere die Environment-Datei und starte **PostgreSQL und Redis** (für Lokalentwicklung reichen die beiden Dienste; der App-Container bleibt aus, damit `npm run dev` Port 3000 nutzen kann). Anschließend Schema anwenden und Prisma-Client erzeugen – so ist die Datenbank auf dem Stand des aktuellen `schema.prisma` (inkl. aller Tabellen, z. B. AdminAuditLog):

```bash
cp .env.example .env
npm run docker:up:dev
# → Startet nur PostgreSQL (5432) und Redis (6379). Volles Stack inkl. App-Container: npm run docker:up
```

Für den Admin-Bereich (`/admin`) muss lokal zusätzlich ein Admin-Schlüssel gesetzt sein:

```dotenv
ADMIN_SECRET="set-a-strong-admin-secret"
```

Pushe das Datenbankschema und generiere den Prisma-Client:

```bash
npm run prisma:push
npm run prisma:generate
```

War die Installation nur mit **`npm ci`** (ohne vorheriges `npm run setup:dev`), kann der Prisma-Client unter `node_modules` noch fehlen — dann einmal **`npm run prisma:generate`** ausführen, bevor du **`npm run typecheck`** oder Husky/Pre-Commit laufen lässt.

Baue einmalig die geteilten Typen (wird von Backend und Frontend benötigt):

```bash
npm run build -w @arsnova/shared-types
```

Ohne diesen Schritt startet das Backend beim ersten `npm run dev` ggf. nicht (fehlendes `dist/` in `libs/shared-types`). Nach Änderungen in `libs/shared-types` diesen Befehl erneut ausführen. Die Root-Skripte `npm run build` und `npm run build:prod` bauen die Bibliothek automatisch zuerst.

**Alles in einem Durchgang (z. B. nach Fork):** `npm run setup:dev` startet Postgres + Redis (`docker:up:dev`), wendet das Schema an (`prisma:push`), generiert den Prisma-Client und baut die shared-types. Danach nur noch `npm run dev`.

**Kurzfassung vor dem ersten Start:** `npm ci` (oder `install`) → `.env` + `docker:up:dev` → `prisma:push` → `prisma:generate` → `build -w @arsnova/shared-types` → `npm run dev`

### 3. Server starten

Starte Frontend und Backend parallel (oder einzeln: `npm run dev:backend` / `npm run dev:frontend`):

```bash
npm run dev
```

Die App ist unter **`http://localhost:4200/en/`** (Frontend, **englische** UI via Angular-`localize`) erreichbar; auf der Startseite erscheint das **Server-Status-Widget** (Epic 0.4: aktive Sessions, Teilnehmer, completed Sessions, Status-Indikator). Die tRPC-API läuft auf `http://localhost:3000`; WebSocket-Subscriptions auf Port 3001, Yjs-Sync auf Port 3002.

**Deutsche UI (Quellsprache, ohne XLF-Merge):** **`npm run dev:de`** und **`http://localhost:4200`** (Root-URL). Nur Frontend: **`npm run dev:frontend:de`**. Details: [docs/I18N-ANGULAR.md](docs/I18N-ANGULAR.md) (Abschnitt Dev-Server).

**Ports belegt?** Wenn `npm run dev` mit `EADDRINUSE` (Port 3000) oder „Port 4200 is already in use“ abbricht, sind die Dev-Ports noch von einem früheren Lauf belegt. Ports freigeben und erneut starten:

```bash
npm run free-dev-ports
npm run dev
```

**Hinweis NG0751:** Beim Dev-Start kann die Meldung erscheinen, dass `@defer`-Blöcke mit HMR eager geladen werden. Das ist erwartbar; im Production-Build wird das Server-Status-Widget weiterhin lazy geladen. Zum Testen ohne diese Meldung: Englisch (Standard-Dev): `npm run dev:frontend -- --configuration=no-hmr-en`; Deutsch (`dev:de`): `npm run dev:frontend:de -- --configuration=no-hmr`.

**Reload / Deployment:** Damit Reload auf Unterseiten (z. B. `/legal/imprint`) nicht zu einer leeren Seite führt, muss der Server bei allen Client-Routen `index.html` ausliefern (SPA-Fallback). Beim lokalen `ng serve` ist das Standard. Für Production: Bei Vercel wird `apps/frontend/vercel.json` genutzt; bei Nginx/Apache/anderen Hosts eine Rewrite-Regel auf `index.html` setzen.

**MOTD (Message of the Day, Epic 10) lokal testen:** Nach `npm run prisma:push` optional **`npm run seed:dev-motd`** ausführen — legt eine **veröffentlichte** Test-Meldung in Postgres an (Overlay auf der Startseite, Archiv-Icon in der Toolbar). Wird das Overlay nicht mehr angezeigt, **`localStorage`-Eintrag `arsnova-motd-v1`** im Browser löschen oder das Seed-Skript erneut ausführen (gleiche MOTD-ID wird ersetzt). **Textvorlagen für den Admin-Bereich:** **`npm run seed:motd-templates`** legt drei Standardvorlagen (Wartung, Feature, Spende) mit professionellem Wording in allen fünf Sprachen an (Upsert per fester ID). Details: [docs/features/motd.md](docs/features/motd.md).

### 4. Lokalisierter Build (i18n) lokal testen (optional)

Die App unterstützt **fünf Sprachen** (`de`, `en`, `fr`, `es`, `it`) über Angular i18n; jede Locale hat einen eigenen Build (z. B. `dist/browser/de`, `dist/browser/en`, ...). Deutsch ist Referenzsprache; UI-Texte werden in allen Zielsprachen synchron gepflegt. Damit du die lokalisierten Varianten **mit funktionierender API und WebSockets** testen kannst, ist ein **eigener Proxy-Server** nötig (nicht nur `npx serve`):

1. **Backend laufen lassen** (HTTP auf 3000, tRPC-WebSocket auf 3001, Yjs auf 3002):

   ```bash
   npm run dev -w @arsnova/backend
   ```

   Oder mit Frontend im anderen Terminal: `npm run dev` (dann Backend + Frontend-Dev-Server).

2. **Lokalisierten Build erzeugen** (aus Repo-Root oder `apps/frontend`):

   ```bash
   npm run build:localize -w @arsnova/frontend
   ```

   Das baut alle in `angular.json` konfigurierten Locales und legt die Locale-Ordner in `dist/browser/` sowie eine Root-`index.html` (Redirect nach `/de/`) an.

3. **Proxy starten** (serviert den Build auf Port 4200 und leitet API/WebSockets ans Backend weiter):

   ```bash
   npm run serve:localize:api -w @arsnova/frontend
   ```

4. Im Browser: **http://localhost:4200** (→ Redirect auf `/de/`), z. B. **http://localhost:4200/de/**, **/en/**, **/fr/**, **/es/** oder **/it/**.

**Wichtig:** Nur **`serve:localize:api`** liefert tRPC (HTTP + WebSocket) und Yjs-WebSocket mit aus. Ein reines `npm run serve:localize` (statischer Serve ohne Proxy) liefert keine API – Health-Check, Subscriptions und Blitz-Feedback würden fehlschlagen. Details (Proxy-Skript, Ports, Fallstricke) siehe [docs/I18N-ANGULAR.md](./docs/I18N-ANGULAR.md) Abschnitt „Lokalisierter Build lokal“.

**Dev-Server (`ng serve`):** Standard-**`npm run dev`** baut **Englisch** (`development-en`); **`npm run dev:de`** baut **ohne** `localize` (deutsche Quellstrings). Andere Locales (**fr**/**it**/**es**) und Produktionsnähe: lokalisierten Build + `serve:localize:api` wie oben.

### 5. Production-ähnlich lokal (optional)

Für einen **lokal production-ähnlichen** Lauf (optimierter Build, ein Prozess liefert alles aus, Gzip, Pre-Render) sollten Postgres und Redis laufen (wie in Schritt 2, z. B. `docker compose up -d redis postgres`).

`npm run build:prod` erzeugt dabei den **lokalisierten Frontend-Build** (`de`/`en`/`fr`/`es`/`it`) und kopiert die Root-`index.html` für den Redirect auf `/de/`.

```bash
npm run build:prod    # shared-types + Backend + Frontend (Production) bauen
npm run start:prod    # Backend starten (gibt Port 3000 ggf. automatisch frei)
```

Die App ist dann unter **http://localhost:3000** erreichbar (Backend liefert das gebaute Frontend aus). Bei hartnäckig belegtem Port vorher: `npm run free-port-3000`. Anderen Port nutzen: `PORT=3010 npm run start:prod` → dann **http://localhost:3010**.

### 6. Screenshots für die PWA-Manifest (optional)

Die PWA-Manifest-Datei referenziert zwei Screenshots (Desktop 1280×720, Mobile 390×844). Um sie neu zu erzeugen, muss die App unter einer URL laufen; das Skript wartet auf die gerenderte Startseite (nicht auf eine Verzeichnisliste).

**Option A – mit Backend (empfohlen):** Nach Production-Build das Backend starten und das Skript gegen Port 3000 laufen lassen:

```bash
npm run build:prod -w @arsnova/frontend
npm run start:prod
# In anderem Terminal, aus Repo-Root:
cd apps/frontend && SCREENSHOT_URL=http://localhost:3000 npm run screenshots
```

**Option B – mit Dev-Server:** Frontend mit `npm run dev:frontend` starten, dann (in anderem Terminal) aus `apps/frontend`: `npm run screenshots`. Default-URL ist dann `http://localhost:4200/en/` (Standard-Dev = englische Locale).

**Option C – nur Static-Serve:** Nach `npm run build:prod -w @arsnova/frontend` erzeugt das Skript beim ersten Aufruf automatisch `dist/browser/index.html` aus `index.csr.html`, damit `npx serve dist/browser -p 4210 -s` die App ausliefert (ohne diese Datei würde `/` eine Verzeichnisliste zeigen). Danach Serve starten und Screenshots mit `SCREENSHOT_URL=http://localhost:4210 npm run screenshots` erzeugen.

Die PNGs landen in `apps/frontend/src/assets/icons/` (`screenshot-wide.png`, `screenshot-narrow.png`).

### 7. Qualitätssicherung (Tests, Lint, Typen)

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

Zusätzlich empfohlen vor Push/PR:

```bash
npm run lint
npm run build
```

### 8. Änderungen in Produktion bringen (GitHub-Flow)

Der produktive Rollout läuft über **GitHub Actions** (`.github/workflows/ci.yml`):

1. Änderungen auf Branch umsetzen, lokal prüfen (mind. `npm test`, bei i18n zusätzlich `npm run build:localize -w @arsnova/frontend`).
2. PR nach `main` erstellen und mergen.
3. Push auf `main` startet automatisch die CI (Build/Lint/Test/Docker).
4. Wenn Repository-Variable `DEPLOY_ENABLED=true` gesetzt ist, läuft danach automatisch **Deploy to Server** via SSH (mit GitHub-Environment `production` als Freigabe-Gate).

**Erstmalige Server-/Repo-Konfiguration (einmalig):**

- Repository Variables:
  - `DEPLOY_ENABLED` = `true`
  - optional: `DEPLOY_BRANCH` (Default `main`)
  - optional: `DEPLOY_DIR` (Default `/home/deploy/arsnova.eu`)
- Repository Secrets:
  - `DEPLOY_HOST`
  - `DEPLOY_USER`
  - `DEPLOY_SSH_KEY`
  - optional: `DEPLOY_SSH_PORT`
- Auf dem Server:
  - Repo liegt unter `DEPLOY_DIR`
  - `.env.production` ist vorhanden
  - Docker/Compose ist installiert

**Was im Deploy passiert:**

- Git sync auf Ziel-Branch
- Docker-Build der App (`docker compose ... build --pull app`)
- Start von PostgreSQL + Redis
- `npx prisma migrate deploy` im App-Container
- Start/Update der App (`docker compose ... up -d app`)
- Healthcheck-Loop auf Container-Health + HTTP-Checks (`/trpc/health.check` und Frontend-Shell auf `/`)

**Manueller Fallback auf dem Server (wenn CI-Deploy deaktiviert):**

```bash
cd /home/deploy/arsnova.eu
DEPLOY_BRANCH=main ./scripts/deploy.sh
```

## 🤖 Vibe Coding & KI-Assistenz

Dieses Projekt wird im "Vibe Coding"-Modus entwickelt. Du agierst als Architekt, die KI (z.B. GitHub Copilot, Cursor, Gemini) übernimmt die Code-Generierung.

**Wenn du mit KI arbeitest:** Lade zu Beginn einer Coding-Session `AGENT.md` in den Kontext deiner KI, damit Architektur- und Sicherheitsregeln eingehalten werden (z. B. DTO-/Data-Stripping). Für **komplexere** Aufgaben mit viel Projektkontext kannst du zusätzlich `docs/cursor-context.md` einbinden. Die Cursor-Regel unter `.cursor/rules/core.mdc` verweist darauf automatisch.

**Übergabe an Studis:** Siehe [CONTRIBUTING.md](./CONTRIBUTING.md) – Onboarding, Story-Wahl, DoD-Check vor PR, Branch/PR-Konventionen.

## 📚 Dokumentation

Wir leben **"Documentation as Code"**. Bevor du große Features implementierst, lies das [Architektur-Handbuch](./docs/architecture/handbook.md). Jede architektonische Entscheidung muss als ADR im Ordner `docs/architecture/decisions/` dokumentiert werden.

Wichtige Einstiege:

- [Backlog](./Backlog.md) (Story-Status, Prioritäten, DoD)
- [Admin-Flow](./docs/implementation/ADMIN-FLOW.md) (Login/Token/Delete/Export/Troubleshooting)
- [Routes & Stories](./docs/ROUTES_AND_STORIES.md) (Routenmodell inkl. Admin-Absicherung)
- [i18n-Leitfaden](./docs/I18N-ANGULAR.md) (Locale-Flow, lokale Builds, Fallstricke)
- [Architektur-Handbuch](./docs/architecture/handbook.md)
- [ADRs](./docs/architecture/decisions/)

## 🗺️ Nächste Schritte (Onboarding)

Nachdem die App lokal läuft, empfiehlt sich diese Lesereihenfolge:

1. **[CONTRIBUTING.md](./CONTRIBUTING.md)** – Mitwirken, Story-Wahl, DoD vor PR
2. **[Backlog.md](./Backlog.md)** – Stories mit Prioritäten und Definition of Done
3. **[Architektur-Handbuch](./docs/architecture/handbook.md)** – Konzepte, Stack und Regeln
4. **[Diagramme](./docs/diagrams/diagrams.md)** – Mermaid-Diagramme (Komponenten, Sequenz, ER, …)
5. **[ADRs](./docs/architecture/decisions/)** – bisherige Architekturentscheidungen (Signals, tRPC, Yjs)
6. **[AGENT.md](./AGENT.md)** – KI-Leitplanken für KI-gestützte Arbeit
7. **[docs/cursor-context.md](./docs/cursor-context.md)** – verdichtete Projektreferenz für komplexere KI-Sessions
8. **[Vibe-Coding-Szenario](./docs/vibe-coding/vibe-coding-szenario.md)** – Zusammenarbeit mit der KI

> **Tipp (aktueller Fokus):** Epics **0–5**, **7.1**, **8**, **9** und **10** sind umgesetzt. Nächste Prioritäten siehe [Backlog](./Backlog.md) (u. a. **6.5**/**6.6**, **2.1c**, **0.7**, **1.7a**/**1.7b**). Vor der Umsetzung zuerst Story und DoD lesen; bei KI-gestützter Arbeit anschließend mit `AGENT.md` arbeiten.

## 🔄 Zurücksetzen auf einen bekannten Zustand

**Nur Port-Konflikte (EADDRINUSE / „Port already in use“):** Vor erneutem `npm run dev` die Dev-Ports freigeben: `npm run free-dev-ports`, danach `npm run dev`.

Falls etwas schiefgeht oder du komplett neu anfangen moechtest, setze dein lokales Repo auf den aktuellen
Remote-Stand zurueck:

```bash
git fetch origin --prune
git switch main
git reset --hard origin/main
npm run clean:generated
npm ci
```

> **Achtung:** `git reset --hard` löscht alle nicht-committeten Änderungen unwiderruflich. Committe oder stashe deine Arbeit vorher, falls du sie behalten willst.
> Wenn du gezielt einen historischen Stand brauchst, prufe vorher die vorhandenen Tags mit `git tag --list` statt von festen Tag-Namen auszugehen.

---

_Viel Erfolg beim Bauen der Zukunft des digitalen Lernens!_ 🚀
