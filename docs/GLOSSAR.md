<!-- markdownlint-disable MD013 -->

# Glossar: arsnova.eu

**Stand:** 2026-05-31

**Zweck:** Einheitliche **produktnahe Begriffe** (Workflows, UI, Rollen) plus eine **kurze Brücke** zu Prisma-Modellnamen. Vollständiges Schema nur in `schema.prisma` / Handbuch — hier keine Spalten- oder Enum-Listen.

**Pflege:** Bei neuen nutzerrelevanten Begriffen oder Umbenennungen Eintrag ergänzen oder Link anpassen. Quellsprache der App-UI: Deutsch (siehe ADR-0008).

---

- **Session / Live-Session:** Laufende Veranstaltung unter einem **Session-Code**; bündelt die Live-Kanäle Quiz, Q&A und Blitzlicht. Vorkommen: Host, Teilnehmer, Beamer, Join. Vertiefung: ADR-0009, `Session` (Prisma).
- **Session-Code:** Sechs Zeichen (ohne verwechselbare Zeichen), Zugang für Teilnehmende. Vorkommen: Startseite, Join, QR. Vertiefung: Story 2.1a, ADR-0006.
- **Host-Token:** Besitznachweis für Host-/Present-Zugriffe und host-only Session-Aktionen; pro Session-Code in `sessionStorage`. Vorkommen: Session-Host, Present. Vertiefung: ADR-0019.
- **Feedback-Host-Token:** Separater Besitznachweis für Standalone-Blitzlicht (`/feedback/:code`). Vorkommen: Blitzlicht-Host. Vertiefung: ADR-0019.
- **Host:** Rolle/Ansicht: Dozent steuert Ablauf, Kanäle, Fragen. Vorkommen: Route `session/.../host`. Vertiefung: ADR-0006.
- **Moderator / delegierte Q&A-Moderation:** Zielrolle für ausgelagerte, kanalgebundene Q&A-Moderation. Stand 2026-05-31: noch keine eigene Route, kein Moderator-Token und keine dedizierte Moderator-UI; produktive Q&A-Moderation läuft hostgebunden über `hostProcedure` und `moderatorView: true`. Vertiefung: ADR-0011, Story 8.5.
- **Presenter / Beamer:** Projektionsansicht für Hörsaal (ohne Steuerlogik wie der Host). Vorkommen: Route `session/.../present`. Vertiefung: Story 2.5.
- **Vote / Teilnehmer-Ansicht:** Rolle/Ansicht: Mitmachen, abstimmen, Q&A, Blitzlicht. Vorkommen: Route `session/.../vote`. Vertiefung: ADR-0006.
- **Join:** Beitritt mit Code und Nickname (ggf. Teamwahl). Vorkommen: Route `join/...`. Vertiefung: Story 3.1, Team-Doku.
- **Lobby:** Phase vor/neben Fragen: Teilnehmende sammeln, Zugang zeigen. Vorkommen: Host & Teilnehmer. Vertiefung: Story 2.2.
- **Kanal:** Tab innerhalb einer Session: **Quiz**, **Q&A**, **Blitzlicht** (optional aktivierbar). Technisch `SessionLiveChannelSchema = quiz | qa | quickFeedback`; **Tempo** ist kein vierter Kanal. Vorkommen: Session-Shell. Vertiefung: ADR-0009, ADR-0029.
- **Blitzlicht:** Kurze Live-Abfrage (Stimmung, Ja/Nein, Sterne, ABCD, …); Produktname in der UI. Vorkommen: Startseite-Chips, Session-Kanal, Standalone-Blitzlicht. Vertiefung: ADR-0010, [BLITZLICHT-GUIDELINES](ui/BLITZLICHT-GUIDELINES.md).
- **Quick-Feedback:** Technischer Name des tRPC-Routers **`quickFeedback`**, der Redis-Keys `qf:*` und des Live-Kanals `quickFeedback` — fachlich = Blitzlicht. Aktuelle Typen: `MOOD`, `YESNO`, `YESNO_BINARY`, `TRUEFALSE_UNKNOWN`, `STARS`, `ABCD`. Vertiefung: [blitzlicht-quickfeedback-api](features/blitzlicht-quickfeedback-api.md).
- **Tempo-Blitzlicht / Tempo:** Beschlossenes Zielbild für ein vordefiniertes Blitzlicht-Template, nicht für einen eigenen Session-Kanal. Stand 2026-05-31: im Code noch kein `TEMPO`-Typ und keine mutable Tempo-Semantik. Vertiefung: ADR-0029, Story 8.8.
- **Access-Proof:** SHA-256-Nachweis über den kanonischen Upload-Snapshot einer Server-Quizkopie; schützt Sammlungs-Historie. Vorkommen: Quiz-Liste, Bonus-Historie. Vertiefung: ADR-0019.
- **Vergleichsrunde:** Zweite Blitzlicht-Abstimmung nach eingefrorener erster Runde; **UI-Wort** (nicht „Diskussionsrunde“). Vorkommen: Blitzlicht-Host. Vertiefung: ADR-0010.
- **Lesephase:** Frage sichtbar, Antwortoptionen noch nicht (Status `QUESTION_OPEN`). Vorkommen: Quiz-Ablauf. Vertiefung: Story 2.6, DTO „Preview“.
- **Antwortphase:** Antworten wählbar (Status `ACTIVE`); ohne `isCorrect` für Teilnehmende. Vorkommen: Quiz. Vertiefung: Data-Stripping.
- **Ergebnisphase:** Auflösung mit Lösungen und Punkten (`RESULTS`). Vorkommen: Quiz, Beamer. Vertiefung: Story 2.4.
- **Freitext / `FREETEXT`:** Offene, unbewertete Textfrage; sammelt freie Antworten und speist die Wortwolke. Zählt nicht für Streak, Scorecard, Leaderboards oder Bonus-Codes. Vertiefung: ADR-0012, Story 1.14.
- **Kurzantwort / `SHORT_TEXT`:** Bewertbarer Fragetyp für kurze Text-, Zahlen- oder Einheitenantworten. Nutzt Musterlösungen, Normalisierung, Toleranzen und Teilpunkte; zählt für Streak, Scorecard, Leaderboards, Teamwertung und Bonus-Codes. Vertiefung: Story 1.2e–1.2eb, ADR-0028.
- **Preset:** Voreinstellung **Seriös** oder **Spielerisch** (Gamification, Zeit, Lesephase, **Action Sounds**, …). Vorkommen: Quiz neu/bearbeiten, Startseite, Header-Toggle. Kanonische Quiz-Defaults: `QUIZ_PRESETS` in shared-types. Vertiefung: [preset-modes](features/preset-modes.md).
- **Preset-Toast:** Overlay zum Feintuning der Preset-Optionen und Speichern in `localStorage`. Vorkommen: Startseite. Vertiefung: `PresetToastComponent`.
- **Bonus-Code:** Token `BNS-…` für Top-Plätze nach Session-Ende; freiwillige Einreichung bei Dozenten. Die Rangberechnung folgt der Effective-Vote-Regel. Vorkommen: Ergebnis, Host. Vertiefung: [bonus-codes](features/bonus-codes.md), ADR-0028.
- **Team-Modus:** Teilnehmende in 2–8 Teams; Auto- oder Manual-Zuweisung beim Join. Teamwertung und Team-Leaderboard folgen derselben Scoring- und Effective-Vote-Regel wie die Einzelwertung. Vorkommen: Quiz-Settings, Join, Ergebnis. Vertiefung: [team-mode](features/team-mode.md), ADR-0028.
- **Q&A-Kanal:** Fragen einreichen, Up-/Downvotes, Moderation durch Host und Sortierung nach `Top`, `Beste Fragen` oder `Umstritten`. Vorkommen: Session-Tab. Vertiefung: Epic 8, ADR-0009, [controversy-score](features/controversy-score.md).
- **Admin:** Gesonderte Rolle: Inspektion, Löschen, behördliche Auszüge — **nicht** Session-Host. Vorkommen: Route `/admin`. Vertiefung: ADR-0006, Epic 9.
- **MOTD / Message of the Day:** Plattform-Kommunikation für aktuelle Hinweise, Archiv und Interaktionsmetriken. Vorkommen: App-Overlay, Admin-Pflege. Vertiefung: ADR-0018, [motd](features/motd.md).
- **Local-First (Quiz):** Quiz-Sammlung (UI: „Deine Quiz-Sammlung“) primär im Browser (Yjs/IndexedDB); Server nur Kopie zur Live-Session. Vorkommen: Quiz-Editor. Vertiefung: ADR-0004, Handbook §3.1.
- **Sync-Link / Sync-Code:** Zugang zum gleichen Quiz-Dokument auf anderem Gerät des Dozenten. Vorkommen: Quiz-Sync. Vertiefung: Story 1.6a.
- **Scorecard:** Persönliche Auswertung (Punkte, Streak, Rang) für Teilnehmende; nutzt nur bewertbare Fragen und die Effective-Vote-Regel. Vorkommen: Nach Fragen / Ende. Vertiefung: Story 5.6, ADR-0028.
- **Leaderboard / Team-Leaderboard:** Ranglisten aus bewertbaren Votes; Einzel- und Teamwertungen aggregieren `SINGLE_CHOICE`, `MULTIPLE_CHOICE` und `SHORT_TEXT` nach Effective Vote. Vorkommen: Host, Teilnehmende, Ergebnis. Vertiefung: ADR-0028.
- **Peer Instruction:** Zweite Abstimmungsrunde **im Quiz** (Vorher/Nachher), unabhängig von Blitzlicht-Vergleichsrunde. Vorkommen: Session `currentRound`. Vertiefung: Story 2.7.
- **Effective Vote / Effective-Vote-Regel:** Kanonische Aggregationsregel für kompetitive Auswertungen: Bei Peer Instruction ersetzt Runde 2 die Runde 1; ohne Runde 2 zählt Runde 1. Verwendet in Leaderboards, Teamwertung, Scorecard und Bonus-Codes. Vertiefung: ADR-0028.
- **Server-Status:** Footer- und Hilfe-Status für Plattformzustand, Last und Kennzahlen. Der Footer lädt gebündelt über `health.footerBundle`; Detailwerte und Verlauf kommen aus `health.stats`. Vorkommen: App-Footer, Hilfe-Dialog. Vertiefung: ADR-0021, ADR-0024, [server-status-widget](features/server-status-widget.md).
- **Service-Status:** SLO-naher Betriebsstatus im Footer: `stable`, `limited`, `critical`. Wird aus Last und Live-Telemetrie abgeleitet. Vertiefung: ADR-0021.
- **Load-Status:** Diagnosewert zur aktuellen Systemlast: `healthy`, `busy`, `overloaded`. Erklärt den Service-Status, ist aber nicht mit ihm identisch. Vertiefung: ADR-0021.
- **Session-Tagesrekord / Daily Highscore:** Größte einzelne Session pro UTC-Tag, als 30-Tage-Verlauf im Server-Status-Hilfedialog. Prisma-Modell: `DailyStatistic`. Vertiefung: ADR-0024.

---

## Abkürzungsverzeichnis (projektbezogen)

Diese Kürzel tauchen in Doku, Tickets, Reviews, Commits und im technischen Gespräch rund um arsnova.eu regelmäßig auf.

| Kürzel     | Bedeutung                                | Kontext in arsnova.eu                                                                             |
| ---------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **ADR**    | Architecture Decision Record             | Architekturentscheidungen unter [`docs/architecture/decisions/`](architecture/decisions/)         |
| **A11y**   | Accessibility / Barrierefreiheit         | Story 6.5, UI-Review, Tastatur, Screenreader, Kontraste                                           |
| **CSR**    | Client-Side Rendering                    | Normales Angular-Routing und UI-Rendering im Browser                                              |
| **DTO**    | Data Transfer Object                     | Geteilte API-Form zwischen Backend und Frontend; siehe `libs/shared-types`                        |
| **DoD**    | Definition of Done                       | Verbindliche Abnahmekriterien pro Story im [`Backlog.md`](../Backlog.md)                          |
| **IAB**    | In-App Browser                           | Eingebetteter Browser z. B. aus QR-Scanner, Mail- oder Messenger-App; relevant für Join-/QR-Flows |
| **i18n**   | Internationalization                     | Mehrsprachigkeit der App-Struktur, Message-IDs, Locale-Routing                                    |
| **l10n**   | Localization                             | Konkrete Übersetzung und Lokalisierung pro Sprache (`de`, `en`, `fr`, `it`, `es`)                 |
| **MOTD**   | Message of the Day                       | Plattform-/News-Overlay und Archiv; siehe [features/motd.md](features/motd.md)                    |
| **NLP**    | Natural Language Processing              | Freitext-Auswertung, Wortwolke, semantische Bündelung                                             |
| **PWA**    | Progressive Web App                      | Installierbare Web-App mit Service Worker und Offline-/Update-Mechanik                            |
| **Prisma** | Prisma ORM / Schema-Tooling              | Datenmodell und Datenbankzugriff; Quelle: [`prisma/schema.prisma`](../prisma/schema.prisma)       |
| **QR**     | Quick Response Code                      | Session-Beitritt, Join-Link, Einstieg per Kamera-Scan                                             |
| **Redis**  | In-Memory-Datenspeicher / Pub-Sub-Broker | Echtzeit, Blitzlicht-Zustand (`qf:*`), Live-Signale                                               |
| **SLO**    | Service Level Objective                  | Zielwerte für Betriebszustand, Latenz und Fehlerrate; Eingang in `serviceStatus`                  |
| **SPA**    | Single-Page Application                  | Grundform des Frontends: eine Angular-App statt klassischer Mehrseiten-App                        |
| **SSR**    | Server-Side Rendering                    | Angular-Server-/Prerender-Pfad für SEO, Social Previews und lokalisierte Builds                   |
| **tRPC**   | Typed Remote Procedure Call              | End-to-End typisierte API zwischen Frontend und Backend; Router, Procedures, Subscriptions        |
| **UI**     | User Interface                           | Oberfläche, Komponenten, Layout, Beschriftung                                                     |
| **UX**     | User Experience                          | Bedienerlebnis, Verständlichkeit, Fluss, Feedback                                                 |
| **Yjs**    | CRDT-Bibliothek für kollaborative Daten  | Local-First Quiz-Sammlung, Sync zwischen Geräten                                                  |
| **Zod**    | TypeScript Schema Validation             | Gemeinsame Runtime-Validierung für DTOs, API-Inputs/-Outputs und Exportformate                    |

---

## Domänenmodell (PostgreSQL / Prisma)

**Single Source of Truth:** [`prisma/schema.prisma`](../prisma/schema.prisma). Kurzreferenz: [Handbuch § 5](architecture/handbook.md). Diagramm-Überblick: [diagrams.md](diagrams/diagrams.md) (erDiagram).

| Alltag / UI                                | Prisma-Modell            | Kurz                                                                                                                                    |
| ------------------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Live-Session (mit Code)                    | `Session`                | u. a. `status`, `code`, `type` (`QUIZ` / `Q_AND_A`), Kanal-Flags `qaEnabled`, `quickFeedbackEnabled`, `currentRound` (Peer Instruction) |
| Teilnehmende Person                        | `Participant`            | `nickname`, optional `teamId`                                                                                                           |
| Quiz-Kopie auf dem Server                  | `Quiz`                   | Entsteht beim Live-Schalten; **nicht** die lokale Quiz-Sammlung (Yjs) im Browser                                                        |
| Frage im Quiz                              | `Question`               | zu einem `Quiz`; `type`, `order`, Timer, Rating-Grenzen, Kurzantwort-Konfiguration, …                                                   |
| Antwortoption                              | `AnswerOption`           | u. a. `isCorrect` — Data-Stripping bis `RESULTS`                                                                                        |
| Gespeicherte **Abstimmung** zu einer Frage | `Vote`                   | pro Teilnehmer, Frage und **Runde** (`round`); Punkte, Freitext/Kurzantwort, Rating, Effective-Vote-Auswertung                          |
| MC: gewählte Option(en)                    | `VoteAnswer`             | n:m `Vote` ↔ `AnswerOption`                                                                                                             |
| Team in der Session                        | `Team`                   | Namen/Farbe; Zuordnung über `Participant.teamId`                                                                                        |
| Bonus-Code-Datensatz                       | `BonusToken`             | u. a. Snapshot `nickname`, `quizName`, `rank`                                                                                           |
| Frage im Q&A-Kanal                         | `QaQuestion`             | Text, Status, Upvotes                                                                                                                   |
| Up-/Downvote auf Q&A-Frage                 | `QaUpvote`               | Richtung `UP` oder `DOWN`; Grundlage für Top-, Wilson- und Kontroversitäts-Sortierung                                                   |
| Bewertung der Session (4.8)                | `SessionFeedback`        | Sterne / Rückmeldung Teilnehmende                                                                                                       |
| Plattformweite Rekorde und Summen          | `PlatformStatistic`      | Singleton für Allzeit-Rekord max. Teilnehmende pro Session und kumulative abgeschlossene Sessions                                       |
| Session-Tagesrekord                        | `DailyStatistic`         | ein UTC-Tageswert für die größte einzelne Session; Quelle für `dailyHighscores`                                                         |
| Admin-Audit                                | `AdminAuditLog`          | Lösch- und Behördenexport-Protokoll mit Session-Snapshot                                                                                |
| MOTD-Vorlage                               | `MotdTemplate`           | Wiederverwendbare Markdown-Vorlagen je Locale                                                                                           |
| MOTD-Nachricht                             | `Motd`                   | Status, Zeitraum, Priorität, Archivsichtbarkeit und Content-Version                                                                     |
| MOTD-Locale                                | `MotdLocale`             | Lokalisierter Markdown-Inhalt pro MOTD                                                                                                  |
| MOTD-Interaktionen                         | `MotdInteractionCounter` | Zähler für Bestätigungen, Daumen hoch/runter und Dismiss-Aktionen pro Content-Version                                                   |
| MOTD-Audit                                 | `MotdAuditLog`           | Protokoll der Admin-Aktionen an MOTDs und Vorlagen                                                                                      |

**Blitzlicht** hat **kein** Prisma-Modell — Live-Zustand in **Redis** (`qf:*`), API `quickFeedback.*`. Das geplante **Tempo-Blitzlicht** bleibt nach ADR-0029 in diesem Pfad und wird nicht als eigener Session-Kanal modelliert.

---

## Begriffe mit bewusst anderem Fokus

- **Dozent** / **Lehrende** / **Host:** In Texten oft synonym; **Host** bezeichnet die konkrete Client-Rolle/Ansicht.
- **Student** / **Teilnehmende:** Teilnehmende Person; technisch `Participant`.
- **„Vote“ (Route)** `session/.../vote` = **Teilnehmer-Ansicht** (UI). **`Vote`** in Prisma = **eine abgegebene Stimme** (Datensatz zu Frage + Runde) — nicht verwechseln.
- **Effective Vote** ist keine zusätzliche `Vote`-Zeile, sondern die Auswertungsregel, welche vorhandene Votes pro Frage/Teilnehmer auswählt.
- **Freitext** (`FREETEXT`) vs. **Kurzantwort** (`SHORT_TEXT`): Beide speichern Text in `Vote.freeText`; nur `SHORT_TEXT` ist bewertbar und scoreboard-relevant.
- **Quiz** (lokal) vs. **Session-Quiz** (Serverkopie): Siehe Handbook Local-First.
- **Tempo** vs. **Blitzlicht-Kanal:** Tempo ist Zielbild für ein Blitzlicht-Template; `SessionLiveChannelSchema` erhält dadurch keinen vierten Kanal.
- **Session-Tagesrekord** vs. **Gesamtteilnahmen:** Der Tagesrekord ist die größte einzelne Session eines UTC-Tags, nicht die Summe aller Teilnahmen dieses Tages.

---

## Verwandte Dokumente

- [Doku-Landkarte](README.md), [Umgebungsvariablen](ENVIRONMENT.md), [Sicherheitsüberblick](SECURITY-OVERVIEW.md), [Tests & CI](TESTING.md)
- [STYLEGUIDE – Wording](ui/STYLEGUIDE.md) (CTAs, Ton)
- [Handbuch](architecture/handbook.md), [Diagramme](diagrams/diagrams.md)
- [ROUTES_AND_STORIES](ROUTES_AND_STORIES.md)
- [Onboarding](onboarding.md) (§ 8 Pflichtlektüre, § 9 Begriffe)
