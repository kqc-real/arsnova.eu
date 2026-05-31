# Einstieg: Werkzeuge und Technologien (für Studierende ohne Vorerfahrung)

**Stand:** 2026-05-31

**Zielgruppe:** Du kannst **grundlegend programmieren** (z. B. Variablen, Schleifen, Funktionen in einer Hochschulsprache), kennst aber **noch nicht** die **Entwicklungswerkzeuge** und **Projekttechnologien** von arsnova.eu.

**Zweck dieses Dokuments:** Eine **Landkarte** — was es gibt, **wofür** es im Projekt da ist, und **wo** du es dir aneignest. Es ersetzt **keine** ausführlichen Tutorials; die verlinkten Dokumente und die jeweilige Einführungsveranstaltung ergänzen es.

**Als Nächstes nach dem Lesen:** Praktisches Setup Schritt für Schritt: [`docs/onboarding.md`](../onboarding.md).

---

## 1. Was du am Anfang können solltest

Für den Einstieg reicht eine **solide Grundorientierung**. Du musst zu Beginn **nicht** den gesamten Stack beherrschen.

- **Git:** Repository klonen, Status prüfen, Änderungen committen.
- **VS Code oder vergleichbarer Editor:** Projektordner öffnen, Suche nutzen, Terminal starten.
- **npm:** Abhängigkeiten installieren und Skripte ausführen (`npm ci`, `npm run dev`).
- **TypeScript lesen:** Du musst am Anfang nicht alles schreiben können, aber Dateien und Typen grob einordnen können.

Welche **weiteren** Dokumente für deine Veranstaltung Pflicht sind, sagt dir die **Betreuung**. Dieses Dokument ist die gemeinsame Landkarte für den technischen Einstieg.

**Zum Veranstaltungsstart:** Die Lehrperson ergänzt den Einstieg durch eine **Greenfield-Demo** zu **Story 1.7a**. Das hilft beim Überblick über Repo, Werkzeuge und Arbeitsweise, ersetzt aber **nicht** das praktische Setup.

**Wenn du nur den ersten lauffähigen Stand brauchst:** `cp .env.example .env` → `npm ci` → `npm run setup:dev` → `npm run dev` → Browser auf **`http://localhost:4200`**. Das ist für Einsteiger der einfachste Start.

**Wenn du Windows nutzt:** Für dieses Repo bitte direkt **WSL2 mit Ubuntu** verwenden. Klone das Repo in WSL (z. B. `~/projects/arsnova.eu`) und führe die Befehle dort aus. **Nicht** PowerShell, **nicht** Git Bash und möglichst **nicht** unter `/mnt/c/...` arbeiten.

**Kurzfassung für Windows-Newcomer:** In **PowerShell** einmal `wsl --install -d Ubuntu`, danach in **Ubuntu/WSL**: `mkdir -p ~/projects && cd ~/projects && git clone https://github.com/kqc-real/arsnova.eu.git && cd arsnova.eu && cp .env.example .env && npm ci && npm run setup:dev && npm run dev`.

---

## 2. Entwicklungswerkzeuge (kurz erklärt)

### VS Code (oder vergleichbarer Editor)

- **Was:** Editor mit integriertem Terminal, Syntaxhervorhebung, Erweiterungen.
- **Im Projekt:** Dateien unter `apps/`, `libs/`, `prisma/` bearbeiten; Terminal im Projektroot für `npm run dev`.
- **Einstieg:** [Visual Studio Code — Dokumentation](https://code.visualstudio.com/docs) (offiziell, Englisch); für den Kurs reichen: Ordner öffnen, Dateisuche (`Ctrl/Cmd+P`), Terminal öffnen (`Ctrl/Cmd+ö` bzw. „Terminal → New Terminal“).

### Git

- **Was:** Versionierung — Änderungen nachvollziehen, Branches, Historie.
- **Befehle, die du zuerst brauchst:** `git clone`, `git status`, `git add`, `git commit`, `git pull`, `git push`, optional `git switch -c <branch>`.
- **Einstieg:** [Git Book — Kapitel 1–3](https://git-scm.com/book/de/v2) (Deutsch verfügbar) oder kurze Einführung deiner Hochschule.

### GitHub

- **Was:** Hosting für Git-Repos, **Pull Requests** (Code-Review, CI), Issues.
- **Im Projekt:** Fork oder Zugriff auf das Kurs-Repo; PRs gegen den festgelegten Branch; CI muss grün sein, bevor gemergt wird (Details bei Betreuung).
- **Einstieg:** [GitHub Docs — Pull Requests](https://docs.github.com/de/pull-requests) (Deutsch).

### Docker (nur Grundlagen)

- **Was:** Läuft **PostgreSQL** und **Redis** lokal in Containern, ohne sie „von Hand“ zu installieren.
- **Im Projekt:** `docker compose up -d postgres redis` (siehe `onboarding.md`).
- **Einstieg:** Du musst Docker nicht programmieren — nur installieren und den Befehl aus der Anleitung ausführen. [Docker — Get Started](https://docs.docker.com/get-started/) (Englisch).

### Windows + WSL2 (für dieses Repo der Standardweg)

- **Was:** WSL2 ist eine Linux-Umgebung auf deinem Windows-Rechner.
- **Warum hier wichtig:** Node, Docker, Prisma, Watcher und Build-Tools laufen für Einsteiger dort deutlich berechenbarer.
- **Im Projekt:** VS Code mit **Remote - WSL** öffnen, Repo in WSL klonen, dann dieselben Befehle wie unter macOS/Linux nutzen.
- **Merksatz:** Wenn du Windows hast, ist **WSL2 hier der normale Weg**, nicht der Sonderfall.

### Node.js und npm

- **Was:** Node.js führt JavaScript/TypeScript-Werkzeuge aus; npm installiert Abhängigkeiten und startet Skripte.
- **Im Projekt:** Für den Einstieg **Node 20.19.0** aus `.nvmrc` oder eine passende **Node 22 LTS** nutzen. Die CI baut mit Node 20 und 22; `package.json` beschreibt die vollständige Engine-Regel.
- **Merksatz:** Wenn `npm run dev` sofort scheitert, zuerst `node -v` prüfen.

---

## 3. Technologien im Projekt arsnova.eu (ein Satz + Tiefe später)

| Technologie                   | Rolle in arsnova.eu                                                                                                                 | Vertiefung                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript**                | Hauptsprache für Backend und Frontend; **Typen** helfen, Fehler früh zu finden.                                                     | [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) (Englisch), Kapitel „The Basics“.                                              |
| **Node.js / npm**             | Laufzeit und Werkzeugkette; **npm** installiert Bibliotheken und startet Scripts (`npm run dev`).                                   | Im Repo: `.nvmrc`, Root-`package.json`, [`docs/onboarding.md`](../onboarding.md) Abschnitt „Voraussetzungen“.                                                 |
| **npm Workspaces / Monorepo** | Mehrere Pakete (**backend**, **frontend**, **shared-types**) in **einem** Repo.                                                     | [`docs/onboarding.md`](../onboarding.md) Abschnitt „Projektstruktur“.                                                                                         |
| **Angular 21.2.x**            | **Frontend**-Framework: Standalone Components, Routing, Signals und UI mit **Angular Material 3**.                                  | [angular.dev — Tutorials](https://angular.dev/tutorials) (Englisch); im Kurs reicht zuerst: Dateien unter `apps/frontend/src/app/features/` finden und lesen. |
| **tRPC v11**                  | **API** zwischen Browser und Server: typisierte Prozeduren und WebSocket-Subscriptions statt klassischer REST-Endpunkte.            | [tRPC — Einführung](https://trpc.io/docs) (Englisch); im Repo: `apps/backend/src/routers/`, Client in `trpc.client.ts`.                                       |
| **Zod v4**                    | **Validierung** und Typen für API-Eingaben/-Ausgaben in `libs/shared-types`; Schemas werden an tRPC-Inputs/-Outputs gebunden.       | [Zod](https://zod.dev) (Englisch); Regel im Projekt: Schemas **zuerst** in shared-types.                                                                      |
| **Prisma 7.4.x**              | **Datenbankzugriff** und Schema in `prisma/schema.prisma` (Tabellen, Beziehungen).                                                  | [Prisma — Getting Started](https://www.prisma.io/docs/getting-started) (Englisch); lokal: `npm run prisma:push`, `npm run prisma:generate`.                   |
| **PostgreSQL**                | **Relationale Datenbank** für Serverdaten: Live-Sessions, Votes, Q&A, Admin-Audit, MOTD und Plattformstatistiken.                   | Du bedienst sie über Prisma; SQL-Grundlagen helfen langfristig (optional).                                                                                    |
| **Redis**                     | **Schneller flüchtiger Speicher** für Rate-Limits, Session-/Presence-Hilfsdaten und Blitzlicht-Zustand; keine dauerhafte Datenbank. | Im Kurs reicht zunächst: wissen, dass der Stack Redis **braucht** (Docker). Tiefer einsteigen kannst du später über das Architektur-Handbuch.                 |
| **Yjs / IndexedDB**           | Local-First-Speicher für die Quiz-Sammlung der Lehrperson; Sync zwischen Geräten läuft über ein Yjs-WebSocket-Relay.                | [`docs/architecture/quiz-library-sync.md`](../architecture/quiz-library-sync.md), später bei Aufgaben rund um Quiz-Sync.                                      |

---

## 4. Projektbegriffe, die du früh kennen solltest

Diese Begriffe musst du nicht sofort im Detail beherrschen. Du solltest sie aber wiedererkennen, wenn du Tickets, Reviews oder Code liest.

| Begriff                        | Kurz erklärt                                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session / Live-Session**     | Laufende Veranstaltung mit einem sechsstelligen Code. Eine Session kann Quiz, Q&A und Blitzlicht bündeln.                                                       |
| **Local-First**                | Die dauerhafte Quiz-Sammlung liegt im Browser der Lehrperson, nicht dauerhaft in einer zentralen Quiz-Cloud.                                                    |
| **DTO / Data-Stripping**       | Das Backend filtert Daten, bevor Teilnehmende sie sehen. Beispiel: `isCorrect` darf vor der Ergebnisphase nicht an die Teilnehmer-Ansicht gehen.                |
| **Kurzantwort / `SHORT_TEXT`** | Bewertbarer Fragetyp für kurze Text-, Zahlen- oder Einheitenantworten. Nicht mit offenem Freitext verwechseln.                                                  |
| **Effective Vote**             | Bewertungsregel: Bei Peer Instruction ersetzt Runde 2 die Runde 1; ohne Runde 2 zählt Runde 1. Wichtig für Leaderboards, Scorecards, Teams und Bonus-Codes.     |
| **Server-Status**              | Footer- und Hilfedialog-Anzeige für Betriebszustand, Systemlast und Plattformstatistiken. Technisch u. a. `health.footerBundle` und `health.stats`.             |
| **MOTD**                       | Message of the Day: Plattform-Kommunikation mit Startseiten-Overlay, Archiv, Admin-Pflege und aggregierten Interaktionszählern.                                 |
| **Moderator / Tempo**          | Aktuelle Zielbilder: Delegierte Q&A-Moderation hat noch keine eigene Moderator-Route/Token; Tempo ist als Blitzlicht-Template geplant, nicht als eigener Kanal. |

Mehr Begriffe und genaue Abgrenzungen stehen im [`docs/GLOSSAR.md`](../GLOSSAR.md).

---

## 5. Empfohlene Reihenfolge beim Selbstlernen

1. Dieses Dokument **einmal durchlesen** (Orientierung).
2. [`docs/onboarding.md`](../onboarding.md) — Umgebung **wirklich aufsetzen**, bis `npm run dev` läuft und **`http://localhost:4200`** die Startseite zeigt.
3. Die **kursinterne Einführungsveranstaltung** oder die dazugehörige Pflichtlektüre verfolgen.
4. Mit dem **ersten Arbeitspaket** deiner Veranstaltung starten; bei Produktbegriffen das [Projekt-Glossar](../GLOSSAR.md), bei Setup-Fragen das [Onboarding](../onboarding.md) öffnen.

---

## 6. Was bewusst _nicht_ in einem Dokument steht

- **Schritt-für-Schritt-Klickanleitungen** für jedes Tool — die veralten schnell; die **offiziellen Docs** (oben verlinkt) sind zuverlässiger.
- **Vollständige Angular- oder Prisma-Schulung** — das ist Semesterinhalt; das Projekt gibt dir **Zielgerichtetes Üben** am echten Code.

Bei **Lücken in der Veranstaltung:** Betreuung ansprechen — diese Datei soll **früh** im Semester ausgeteilt oder verlinkt werden.
