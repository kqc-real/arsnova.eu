<!-- markdownlint-disable MD013 -->

# Glossar: arsnova.eu

**Zweck:** Einheitliche **produktnahe Begriffe** (Workflows, UI, Rollen) plus eine **kurze Brücke** zu Prisma-Modellnamen. Vollständiges Schema nur in `schema.prisma` / Handbuch — hier keine Spalten- oder Enum-Listen.

**Pflege:** Bei neuen nutzerrelevanten Begriffen oder Umbenennungen Eintrag ergänzen oder Link anpassen. Quellsprache der App-UI: Deutsch (siehe ADR-0008).

---

- **Session / Live-Session:** Laufende Veranstaltung unter einem **Session-Code**; kann Quiz, Q&A und Blitzlicht bündeln. Vorkommen: Host, Teilnehmer, Beamer, Join. Vertiefung: ADR-0009, `Session` (Prisma).
- **Session-Code:** Sechs Zeichen (ohne verwechselbare Zeichen), Zugang für Teilnehmende. Vorkommen: Startseite, Join, QR. Vertiefung: Story 2.1a, ADR-0006.
- **Host-Token:** Besitznachweis für Host-/Present-Zugriffe und host-only Session-Aktionen; pro Session-Code in `sessionStorage`. Vorkommen: Session-Host, Present. Vertiefung: ADR-0019.
- **Feedback-Host-Token:** Separater Besitznachweis für Standalone-Blitzlicht (`/feedback/:code`). Vorkommen: Blitzlicht-Host. Vertiefung: ADR-0019.
- **Host:** Rolle/Ansicht: Dozent steuert Ablauf, Kanäle, Fragen. Vorkommen: Route `session/.../host`. Vertiefung: ADR-0006.
- **Presenter / Beamer:** Projektionsansicht für Hörsaal (ohne Steuerlogik wie der Host). Vorkommen: Route `session/.../present`. Vertiefung: Story 2.5.
- **Vote / Teilnehmer-Ansicht:** Rolle/Ansicht: Mitmachen, abstimmen, Q&A, Blitzlicht. Vorkommen: Route `session/.../vote`. Vertiefung: ADR-0006.
- **Join:** Beitritt mit Code und Nickname (ggf. Teamwahl). Vorkommen: Route `join/...`. Vertiefung: Story 3.1, Team-Doku.
- **Lobby:** Phase vor/neben Fragen: Teilnehmende sammeln, Zugang zeigen. Vorkommen: Host & Teilnehmer. Vertiefung: Story 2.2.
- **Kanal:** Tab innerhalb einer Session: **Quiz**, **Q&A**, **Blitzlicht** (optional aktivierbar). Vorkommen: Session-Shell. Vertiefung: ADR-0009.
- **Blitzlicht:** Kurze Live-Abfrage (Stimmung, Ja/Nein, …); Produktname in der UI. Vorkommen: Startseite-Chips, Session-Kanal. Vertiefung: ADR-0010, [BLITZLICHT-GUIDELINES](ui/BLITZLICHT-GUIDELINES.md).
- **Quick-Feedback:** Technischer Name des tRPC-Routers **`quickFeedback`** und Redis-Keys `qf:*` — fachlich = Blitzlicht. Vorkommen: Code, API. Vertiefung: [blitzlicht-quickfeedback-api](features/blitzlicht-quickfeedback-api.md).
- **Access-Proof:** SHA-256-Nachweis über den kanonischen Upload-Snapshot einer Server-Quizkopie; schützt Sammlungs-Historie. Vorkommen: Quiz-Liste, Bonus-Historie. Vertiefung: ADR-0019.
- **Vergleichsrunde:** Zweite Blitzlicht-Abstimmung nach eingefrorener erster Runde; **UI-Wort** (nicht „Diskussionsrunde“). Vorkommen: Blitzlicht-Host. Vertiefung: ADR-0010.
- **Lesephase:** Frage sichtbar, Antwortoptionen noch nicht (Status `QUESTION_OPEN`). Vorkommen: Quiz-Ablauf. Vertiefung: Story 2.6, DTO „Preview“.
- **Antwortphase:** Antworten wählbar (Status `ACTIVE`); ohne `isCorrect` für Teilnehmende. Vorkommen: Quiz. Vertiefung: Data-Stripping.
- **Ergebnisphase:** Auflösung mit Lösungen und Punkten (`RESULTS`). Vorkommen: Quiz, Beamer. Vertiefung: Story 2.4.
- **Preset:** Voreinstellung **Seriös** oder **Spielerisch** (Gamification, Zeit, Lesephase, **Action Sounds**, …). Vorkommen: Quiz neu/bearbeiten, Startseite, Header-Toggle. Kanonische Quiz-Defaults: `QUIZ_PRESETS` in shared-types. Vertiefung: [preset-modes](features/preset-modes.md).
- **Preset-Toast:** Overlay zum Feintuning der Preset-Optionen und Speichern in `localStorage`. Vorkommen: Startseite. Vertiefung: `PresetToastComponent`.
- **Bonus-Code:** Token `BNS-…` für Top-Plätze nach Session-Ende; freiwillige Einreichung bei Dozenten. Vorkommen: Ergebnis, Host. Vertiefung: [bonus-codes](features/bonus-codes.md).
- **Team-Modus:** Teilnehmende in 2–8 Teams; Auto- oder Manual-Zuweisung beim Join. Vorkommen: Quiz-Settings, Join, Ergebnis. Vertiefung: [team-mode](features/team-mode.md).
- **Q&A-Kanal:** Fragen einreichen, Upvotes, Moderation durch Host. Vorkommen: Session-Tab. Vertiefung: Epic 8, ADR-0009.
- **Admin:** Gesonderte Rolle: Inspektion, Löschen, behördliche Auszüge — **nicht** Session-Host. Vorkommen: Route `/admin`. Vertiefung: ADR-0006, Epic 9.
- **Local-First (Quiz):** Quiz-Sammlung (UI: „Deine Quiz-Sammlung“) primär im Browser (Yjs/IndexedDB); Server nur Kopie zur Live-Session. Vorkommen: Quiz-Editor. Vertiefung: ADR-0004, Handbook §3.1.
- **Sync-Link / Sync-Code:** Zugang zum gleichen Quiz-Dokument auf anderem Gerät des Dozenten. Vorkommen: Quiz-Sync. Vertiefung: Story 1.6a.
- **Scorecard:** Persönliche Auswertung (Punkte, Streak, Rang) für Teilnehmende. Vorkommen: Nach Fragen / Ende. Vertiefung: Story 5.6.
- **Peer Instruction:** Zweite Abstimmungsrunde **im Quiz** (Vorher/Nachher), unabhängig von Blitzlicht-Vergleichsrunde. Vorkommen: Session `currentRound`. Vertiefung: Story 2.7.
- **Server-Status:** Footer-Kennzahlen (aktive Sessions, Blitz-Runden, …) via `health.stats`. Vorkommen: App-Footer. Vertiefung: [server-status-widget](features/server-status-widget.md).

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
