<!-- markdownlint-disable MD013 -->

# Glossar: arsnova.eu

**Zweck:** Einheitliche **produktnahe Begriffe** (Workflows, UI, Rollen) plus eine **kurze Brücke** zu Prisma-Modellnamen. Vollständiges Schema nur in `schema.prisma` / Handbuch — hier keine Spalten- oder Enum-Listen.

**Pflege:** Bei neuen nutzerrelevanten Begriffen oder Umbenennungen Eintrag ergänzen oder Link anpassen. Quellsprache der App-UI: Deutsch (siehe ADR-0008).

---

| Begriff                           | Bedeutung                                                                                                       | Wo vorkommt                     | Vertiefung                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| **Session** / **Live-Session**    | Laufende Veranstaltung unter einem **Session-Code**; kann Quiz, Q&A und Blitzlicht bündeln.                     | Host, Teilnehmer, Beamer, Join  | ADR-0009, `Session` (Prisma)                                             |
| **Session-Code**                  | Sechs Zeichen (ohne verwechselbare Zeichen), Zugang für Teilnehmende.                                           | Startseite, Join, QR            | Story 2.1a, ADR-0006                                                     |
| **Host**                          | Rolle/Ansicht: Dozent steuert Ablauf, Kanäle, Fragen.                                                           | Route `session/.../host`        | ADR-0006                                                                 |
| **Presenter** / **Beamer**        | Projektionsansicht für Hörsaal (ohne Steuerlogik wie der Host).                                                 | Route `session/.../present`     | Story 2.5                                                                |
| **Vote** / **Teilnehmer-Ansicht** | Rolle/Ansicht: Mitmachen, abstimmen, Q&A, Blitzlicht.                                                           | Route `session/.../vote`        | ADR-0006                                                                 |
| **Join**                          | Beitritt mit Code und Nickname (ggf. Teamwahl).                                                                 | Route `join/...`                | Story 3.1, Team-Doku                                                     |
| **Lobby**                         | Phase vor/neben Fragen: Teilnehmende sammeln, Zugang zeigen.                                                    | Host & Teilnehmer               | Story 2.2                                                                |
| **Kanal**                         | Tab innerhalb einer Session: **Quiz**, **Q&A**, **Blitzlicht** (optional aktivierbar).                          | Session-Shell                   | ADR-0009                                                                 |
| **Blitzlicht**                    | Kurze Live-Abfrage (Stimmung, Ja/Nein, …); Produktname in der UI.                                               | Startseite-Chips, Session-Kanal | ADR-0010, [BLITZLICHT-GUIDELINES](ui/BLITZLICHT-GUIDELINES.md)           |
| **Quick-Feedback**                | Technischer Name des tRPC-Routers **`quickFeedback`** und Redis-Keys `qf:*` — fachlich = Blitzlicht.            | Code, API                       | [blitzlicht-quickfeedback-api](features/blitzlicht-quickfeedback-api.md) |
| **Vergleichsrunde**               | Zweite Blitzlicht-Abstimmung nach eingefrorener erster Runde; **UI-Wort** (nicht „Diskussionsrunde“).           | Blitzlicht-Host                 | ADR-0010                                                                 |
| **Lesephase**                     | Frage sichtbar, Antwortoptionen noch nicht (Status `QUESTION_OPEN`).                                            | Quiz-Ablauf                     | Story 2.6, DTO „Preview“                                                 |
| **Antwortphase**                  | Antworten wählbar (Status `ACTIVE`); ohne `isCorrect` für Teilnehmende.                                         | Quiz                            | Data-Stripping                                                           |
| **Ergebnisphase**                 | Auflösung mit Lösungen und Punkten (`RESULTS`).                                                                 | Quiz, Beamer                    | Story 2.4                                                                |
| **Preset**                        | Voreinstellung **Seriös** oder **Spielerisch** (Gamification, Zeit, Lesephase, …).                              | Startseite, Header-Toggle       | [preset-modes](features/preset-modes.md)                                 |
| **Preset-Toast**                  | Overlay zum Feintuning der Preset-Optionen und Speichern in `localStorage`.                                     | Startseite                      | `PresetToastComponent`                                                   |
| **Bonus-Code**                    | Token `BNS-…` für Top-Plätze nach Session-Ende; freiwillige Einreichung bei Dozenten.                           | Ergebnis, Host                  | [bonus-codes](features/bonus-codes.md)                                   |
| **Team-Modus**                    | Teilnehmende in 2–8 Teams; Auto- oder Manual-Zuweisung beim Join.                                               | Quiz-Settings, Join, Ergebnis   | [team-mode](features/team-mode.md)                                       |
| **Q&A-Kanal**                     | Fragen einreichen, Upvotes, Moderation durch Host.                                                              | Session-Tab                     | Epic 8, ADR-0009                                                         |
| **Admin**                         | Gesonderte Rolle: Inspektion, Löschen, behördliche Auszüge — **nicht** Session-Host.                            | Route `/admin`                  | ADR-0006, Epic 9                                                         |
| **Local-First (Quiz)**            | Quiz-Sammlung (UI: „Deine Quiz-Sammlung“) primär im Browser (Yjs/IndexedDB); Server nur Kopie zur Live-Session. | Quiz-Editor                     | ADR-0004, Handbook §3.1                                                  |
| **Sync-Link** / **Sync-Code**     | Zugang zum gleichen Quiz-Dokument auf anderem Gerät des Dozenten.                                               | Quiz-Sync                       | Story 1.6a                                                               |
| **Scorecard**                     | Persönliche Auswertung (Punkte, Streak, Rang) für Teilnehmende.                                                 | Nach Fragen / Ende              | Story 5.6                                                                |
| **Peer Instruction**              | Zweite Abstimmungsrunde **im Quiz** (Vorher/Nachher), unabhängig von Blitzlicht-Vergleichsrunde.                | Session `currentRound`          | Story 2.7                                                                |
| **Server-Status**                 | Footer-Kennzahlen (aktive Sessions, Blitz-Runden, …) via `health.stats`.                                        | App-Footer                      | [server-status-widget](features/server-status-widget.md)                 |

---

## Domänenmodell (PostgreSQL / Prisma)

**Single Source of Truth:** [`prisma/schema.prisma`](../prisma/schema.prisma). Kurzreferenz: [cursor-context.md](cursor-context.md) § 7, [Handbuch § 5](architecture/handbook.md). Diagramm-Überblick: [diagrams.md](diagrams/diagrams.md) (erDiagram).

| Alltag / UI                                | Prisma-Modell     | Kurz                                                                                                                                    |
| ------------------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Live-Session (mit Code)                    | `Session`         | u. a. `status`, `code`, `type` (`QUIZ` / `Q_AND_A`), Kanal-Flags `qaEnabled`, `quickFeedbackEnabled`, `currentRound` (Peer Instruction) |
| Teilnehmende Person                        | `Participant`     | `nickname`, optional `teamId`                                                                                                           |
| Quiz-Kopie auf dem Server                  | `Quiz`            | Entsteht beim Live-Schalten; **nicht** die lokale Quiz-Sammlung (Yjs) im Browser                                                        |
| Frage im Quiz                              | `Question`        | zu einem `Quiz`; `type`, `order`, Timer, Rating-Grenzen, …                                                                              |
| Antwortoption                              | `AnswerOption`    | u. a. `isCorrect` — Data-Stripping bis `RESULTS`                                                                                        |
| Gespeicherte **Abstimmung** zu einer Frage | `Vote`            | pro Teilnehmer, Frage und **Runde** (`round`); Punkte, Freitext, Rating, …                                                              |
| MC: gewählte Option(en)                    | `VoteAnswer`      | n:m `Vote` ↔ `AnswerOption`                                                                                                             |
| Team in der Session                        | `Team`            | Namen/Farbe; Zuordnung über `Participant.teamId`                                                                                        |
| Bonus-Code-Datensatz                       | `BonusToken`      | u. a. Snapshot `nickname`, `quizName`, `rank`                                                                                           |
| Frage im Q&A-Kanal                         | `QaQuestion`      | Text, Status, Upvotes                                                                                                                   |
| Upvote auf Q&A-Frage                       | `QaUpvote`        |                                                                                                                                         |
| Bewertung der Session (4.8)                | `SessionFeedback` | Sterne / Rückmeldung Teilnehmende                                                                                                       |

**Blitzlicht** hat **kein** Prisma-Modell — Zustand in **Redis** (`qf:*`), API `quickFeedback.*`.

---

## Begriffe mit bewusst anderem Fokus

- **Dozent** / **Lehrende** / **Host:** In Texten oft synonym; **Host** bezeichnet die konkrete Client-Rolle/Ansicht.
- **Student** / **Teilnehmende:** Teilnehmende Person; technisch `Participant`.
- **„Vote“ (Route)** `session/.../vote` = **Teilnehmer-Ansicht** (UI). **`Vote`** in Prisma = **eine abgegebene Stimme** (Datensatz zu Frage + Runde) — nicht verwechseln.
- **Quiz** (lokal) vs. **Session-Quiz** (Serverkopie): Siehe Handbook Local-First.

---

## Verwandte Dokumente

- [Doku-Landkarte](README.md), [Umgebungsvariablen](ENVIRONMENT.md), [Sicherheitsüberblick](SECURITY-OVERVIEW.md), [Tests & CI](TESTING.md)
- [STYLEGUIDE – Wording](ui/STYLEGUIDE.md) (CTAs, Ton)
- [Handbuch](architecture/handbook.md), [Diagramme](diagrams/diagrams.md)
- [ROUTES_AND_STORIES](ROUTES_AND_STORIES.md)
- [Onboarding](onboarding.md) (§ 8 Pflichtlektüre, § 9 Begriffe)
