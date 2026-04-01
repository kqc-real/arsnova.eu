# Einstieg: Werkzeuge und Technologien (für Studierende ohne Vorerfahrung)

**Zielgruppe:** Du kannst **grundlegend programmieren** (z. B. Variablen, Schleifen, Funktionen in einer Hochschulsprache), kennst aber **noch nicht** die **Entwicklungswerkzeuge** und **Projekttechnologien** von arsnova.eu.

**Zweck dieses Dokuments:** Eine **Landkarte** — was es gibt, **wofür** es im Projekt da ist, und **wo** du es dir aneignest. Es ersetzt **keine** ausführlichen Tutorials; die verlinkten Dokumente und die jeweilige Einführungsveranstaltung ergänzen es.

**Als Nächstes nach dem Lesen:** Praktisches Setup Schritt für Schritt: [`docs/onboarding.md`](../onboarding.md).

---

## 1. Was du am Anfang können solltest

Für den Einstieg reicht eine **solide Grundorientierung**. Du musst zu Beginn **nicht** den gesamten Stack beherrschen.

- **Git:** Repository klonen, Status prüfen, Änderungen committen.
- **VS Code oder vergleichbarer Editor:** Projektordner öffnen, Suche nutzen, Terminal starten.
- **npm:** Abhängigkeiten installieren und Skripte ausführen (`npm install`, `npm run dev`).
- **TypeScript lesen:** Du musst am Anfang nicht alles schreiben können, aber Dateien und Typen grob einordnen können.

Welche **weiteren** Dokumente für deine Veranstaltung Pflicht sind, sagt dir die **Betreuung**. Dieses Dokument ist die gemeinsame Landkarte für den technischen Einstieg.

**Je nach Veranstaltung:** Die Lehrperson kann den Einstieg über eine **Greenfield-Demo** zu **Story 1.7a** ergänzen. Das hilft beim Überblick über Repo, Werkzeuge und Arbeitsweise, ersetzt aber **nicht** das praktische Setup.

---

## 2. Entwicklungswerkzeuge (kurz erklärt)

### VS Code (oder vergleichbarer Editor)

- **Was:** Editor mit integriertem Terminal, Syntaxhervorhebung, Erweiterungen.
- **Im Projekt:** Dateien unter `apps/`, `libs/`, `prisma/` bearbeiten; Terminal im Projektroot für `npm run dev`.
- **Einstieg:** [Visual Studio Code — Dokumentation](https://code.visualstudio.com/docs) (offiziell, Englisch); für den Kurs reichen: Ordner öffnen, Dateisuche (`Ctrl/Cmd+P`), Terminal öffnen (`Ctrl/Cmd+ö` bzw. „Terminal → New Terminal“).

### Git

- **Was:** Versionierung — Änderungen nachvollziehen, Branches, Historie.
- **Befehle, die du zuerst brauchst:** `git clone`, `git status`, `git add`, `git commit`, `git pull`, `git push`, optional `git checkout -b <branch>`.
- **Einstieg:** [Git Book — Kapitel 1–3](https://git-scm.com/book/de/v2) (Deutsch verfügbar) oder kurze Einführung deiner Hochschule.

### GitHub

- **Was:** Hosting für Git-Repos, **Pull Requests** (Code-Review, CI), Issues.
- **Im Projekt:** Fork oder Zugriff auf das Kurs-Repo; PRs gegen den festgelegten Branch; CI muss grün sein, bevor gemergt wird (Details bei Betreuung).
- **Einstieg:** [GitHub Docs — Pull Requests](https://docs.github.com/de/pull-requests) (Deutsch).

### Docker (nur Grundlagen)

- **Was:** Läuft **PostgreSQL** und **Redis** lokal in Containern, ohne sie „von Hand“ zu installieren.
- **Im Projekt:** `docker compose up -d postgres redis` (siehe `onboarding.md`).
- **Einstieg:** Du musst Docker nicht programmieren — nur installieren und den Befehl aus der Anleitung ausführen. [Docker — Get Started](https://docs.docker.com/get-started/) (Englisch).

---

## 3. Technologien im Projekt arsnova.eu (ein Satz + Tiefe später)

| Technologie                   | Rolle in arsnova.eu                                                                                                         | Vertiefung                                                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript**                | Hauptsprache für Backend und Frontend; **Typen** helfen, Fehler früh zu finden.                                             | [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) (Englisch), Kapitel „The Basics“.                                              |
| **Node.js / npm**             | Laufzeit für das Backend; **npm** installiert Bibliotheken und startet Scripts (`npm run dev`).                             | Offizielle Node.js-Einführung; im Repo: `package.json` im Root.                                                                                               |
| **npm Workspaces / Monorepo** | Mehrere Pakete (**backend**, **frontend**, **shared-types**) in **einem** Repo.                                             | [`docs/onboarding.md`](../onboarding.md) Abschnitt „Projektstruktur“.                                                                                         |
| **Angular**                   | **Frontend**-Framework: Komponenten, Routing, UI (hier mit **Material 3**).                                                 | [angular.dev — Tutorials](https://angular.dev/tutorials) (Englisch); im Kurs reicht zuerst: Dateien unter `apps/frontend/src/app/features/` finden und lesen. |
| **tRPC**                      | **API** zwischen Browser und Server: **typisierte** Prozeduren statt klassischer REST-Listen.                               | [tRPC — Einführung](https://trpc.io/docs) (Englisch); im Repo: `apps/backend/src/routers/`, Client in `trpc.client.ts`.                                       |
| **Zod**                       | **Validierung** und Typen für API-Eingaben/-Ausgaben in `libs/shared-types`.                                                | [Zod](https://zod.dev) (Englisch); Regel im Projekt: Schemas **zuerst** in shared-types.                                                                      |
| **Prisma**                    | **Datenbankzugriff** und Schema in `prisma/schema.prisma` (Tabellen, Beziehungen).                                          | [Prisma — Getting Started](https://www.prisma.io/docs/getting-started) (Englisch); lokal: `npx prisma db push`, `npx prisma studio`.                          |
| **PostgreSQL**                | **Relationale Datenbank** für persistente Serverdaten.                                                                      | Du bedienst sie über Prisma; SQL-Grundlagen helfen langfristig (optional).                                                                                    |
| **Redis**                     | **Schneller Speicher** für Sessions, Rate-Limits, Echtzeit-Hilfsdaten — nicht der Ort für MOTD-Dauerdaten (siehe ADR-0018). | Im Kurs reicht zunächst: wissen, dass der Stack Redis **braucht** (Docker). Tiefer einsteigen kannst du später über das Architektur-Handbuch.                 |

---

## 4. Empfohlene Reihenfolge beim Selbstlernen

1. Dieses Dokument **einmal durchlesen** (Orientierung).
2. [`docs/onboarding.md`](../onboarding.md) — Umgebung **wirklich aufsetzen**, bis `npm run dev` läuft.
3. Die **kursinterne Einführungsveranstaltung** oder die dazugehörige Pflichtlektüre verfolgen.
4. Mit dem **ersten Arbeitspaket** deiner Veranstaltung starten; bei Begriffen **hierher zurück** oder offizielle Docs öffnen.

---

## 5. Was bewusst _nicht_ in einem Dokument steht

- **Schritt-für-Schritt-Klickanleitungen** für jedes Tool — die veralten schnell; die **offiziellen Docs** (oben verlinkt) sind zuverlässiger.
- **Vollständige Angular- oder Prisma-Schulung** — das ist Semesterinhalt; das Projekt gibt dir **Zielgerichtetes Üben** am echten Code.

Bei **Lücken in der Veranstaltung:** Betreuung ansprechen — diese Datei soll **früh** im Semester ausgeteilt oder verlinkt werden.

---

**Stand:** 2026-04-01
