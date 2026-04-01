# Message of the Day (MOTD) — Feature-Dokumentation

> **Zielgruppe:** Product Owner, Entwickler:innen, Betrieb  
> **Status:** In Produkt umgesetzt (Epic 10.1–10.8); diese Datei bleibt fachliche Referenz. Abgleich mit Code: `apps/backend/src/routers/motd.ts`, `apps/frontend` (Startseiten-Overlay, Archiv-Dialog, Toolbar).  
> **Architekturentscheid:** [ADR-0018: MOTD — Plattform-Kommunikation](../architecture/decisions/0018-message-of-the-day-platform-communication.md)

## 1. Ziel und Nutzen

Der Betreiber kann **kuratierte Hinweise** an **alle Nutzer:innen** ausspielen — unabhängig von Login oder Session-Rolle:

- Wartungsfenster, incidentartige Hinweise
- Neue Features oder geänderte Abläufe
- Spenden- oder Community-Aufrufe (inhaltlich verantwortlich durch den Betreiber)

**Nicht** Ziel dieser Funktion: Ersatz für Statuspage/Monitoring, E-Mail-Kampagnen oder personalisierte In-App-Onboarding-Flows.

## 2. Akteure und Sichtbarkeit

| Akteur                | Sicht                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Endnutzer:innen**   | Aktive MOTD auf der **Startseite** (Overlay), optional **Archiv** über Icon im **App-Header**                                              |
| **Admin** (Betreiber) | **CMS-light** unter **`/admin`** (nach bestehendem Admin-Login): Templates, MOTDs anlegen/bearbeiten, Zeiträume, Archiv-Freigabe, Vorschau |

## 3. Funktionale Anforderungen (Kanon)

### 3.1 Zeitsteuerung und Status

- Jedes MOTD hat **`startsAt`** und **`endsAt`** in **UTC**; die Admin-UI erklärt die Zeitzone (Betreiber-Hinweis).
- Status mindestens: **`draft`**, **`scheduled`**, **`published`** (und ggf. **`archived`** rein organisatorisch). Nur **veröffentlichte** Einträge innerhalb des Zeitfensters kommen für das **Overlay** infrage.
- **Konflikt mehrerer aktiver MOTDs:** Es wird **höchstens eine** Overlay-MOTD angezeigt. Die **Willkommens-MOTD** (feste ID, siehe Backend) gewinnt, solange die Nutzer:in die aktuelle **Inhaltsversion** noch nicht bestätigt/dismissed hat (lokal → `overlayDismissedUpTo`); danach Auswahl nach **`priority` DESC**, dann **`startsAt` DESC** (siehe ADR-0018).

### 3.2 Mehrsprachige Inhalte

- Pro MOTD: Markdown-Body **pro Locale** `de`, `en`, `fr`, `es`, `it`.
- **Fallback**, wenn ein Feld leer: festgelegte Kette (z. B. aktuelle UI-Locale → `de` → `en`), dokumentiert und testbar.
- **UI-Chrome** des Overlays, des Archivs und des Admin-Editors: **@angular/localize** / XLF in **allen fünf Sprachen** ([ADR-0008](../architecture/decisions/0008-i18n-internationalization.md)).

### 3.3 Templates (Vorlagen)

- Wiederverwendbare **Vorlagen** (z. B. „Wartung“, „Feature-Ankündigung“, „Spende“) mit optionalen **Platzhalter-Hinweisen** im Admin-Text — **kein** Muss für technische Template-Engine im MVP; Fokus: schnelles Anlegen neuer MOTDs aus Mustern.
- Templates sind **Admin-only**; keine öffentliche Liste.
- **Admin-UI:** Unter `/admin` → Meldungen: Bereich **Textvorlagen** (anlegen, bearbeiten, löschen) plus **Vorlage in Felder laden** bei der Meldung. **Beispielvorlagen:** `npm run seed:motd-templates` (Repo-Root) spielt drei idempotente Vorlagen mit Texten in **de/en/fr/es/it** ein (Wartung, neues Feature, Spendenhinweis); Details im README.

### 3.4 Archiv (vergangene MOTDs)

- Admin entscheidet pro MOTD (oder vergleichbares Flag), ob es in der **nutzerseitigen Archivliste** erscheint.
- Archiv zeigt nur **freigegebene** Einträge; **Paginierung** über `listArchive` mit `cursor`/`nextCursor`; im Dialog **„Weitere Meldungen laden“** unter der Liste; **lazy load** beim ersten Öffnen (Performance).

### 3.5 Startseiten-Overlay

- **Mobile-first**, ansprechendes Layout (Material 3, bestehende Tokens).
- **Schließen:** sichtbarer **Close-Button**; optional **Wischen** zur Seite zum Schließen **zusätzlich** (nicht als einzige Methode).
- Optional: Schließen per **Klick auf Backdrop** — explizit in der Story festlegen.
- **`prefers-reduced-motion`:** keine oder reduzierte Bewegung ([STYLEGUIDE](../ui/STYLEGUIDE.md)).
- **A11y:** Fokus, `aria-modal`, Escape, Beschriftungen in allen Sprachen.

### 3.6 Clientzustand (localStorage)

- Speicherung, dass die aktuelle MOTD-Version **bereits angezeigt** bzw. **weggeklickt** wurde: gebunden an **`id` + `contentHash`/`version`**.
- Separater Schlüssel oder Objektfelder für **„Zur Kenntnis genommen“** und **Feedback (Daumen)** falls rein lokal begrenzt.
- **Schema-Version** im Key-Namespace für spätere Migration (`arsnova-motd-v1` o. ä.).

### 3.7 Nutzerinteraktionen (getrennte Dimensionen)

| Dimension         | Bedeutung                                                        | Umsetzungshinweis                                                                                       |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Dismiss**       | Overlay geschlossen (X, Swipe, ggf. Backdrop)                    | Auswertbar als Event für Statistik **optional** serverseitig                                            |
| **Kenntnisnahme** | Expliziter Button (z. B. „Verstanden“ / „Zur Kenntnis genommen“) | Lokal + optional Mutation für Aggregation                                                               |
| **Feedback**      | Daumen hoch/runter                                               | Optional; **ein Vote pro MOTD-Version pro Browser** über localStorage erzwingbar; Server nur aggregiert |

**Semantik:** Dismiss ≠ Kenntnisnahme — beides getrennt auswertbar, falls Analytics gewünscht.

### 3.8 App-Header

- **Nachrichten-Icon** öffnet Archiv/Übersicht (Sheet, Dialog oder eigene kleine View — Mobile-first).
- Wenn **kein Archiv-Eintrag** freigegeben und **kein aktives MOTD**: Icon **ausblenden** oder **deaktivieren** mit erklärendem Tooltip (i18n).

## 4. Technische Leitplanken

- **API:** ausschließlich **tRPC**; Zod-Schemas in **`@arsnova/shared-types`** vor Implementierung in Apps.
- **Öffentliche Procedures:** striktes **DTO** (keine internen Admin-Felder); **Rate-Limiting**.
- **Admin Procedures:** `adminProcedure` wie Epic 9.
- **Sicherheit:** Markdown-Rendering nur mit **Sanitize** wie im restlichen Produkt; Bilder in MOTD unterliegen **ADR-0015** (nur HTTPS-URLs, kein Upload durch diese Funktion).

### 4.1 Vorgeschlagene Prozedur-Skizze (final bei Implementierung benennen)

- `motd.getCurrent` — Input: `locale`, optional `overlayDismissedUpTo` (vom Client gemerkte Dismiss-Versionen pro `motdId`, damit die nächstpriore MOTD gewählt wird); Output: aktive MOTD oder leer.
- `motd.listArchive` — Input: `locale`, Pagination; Output: nur freigegebene, vergangene/außerhalb Fenster.
- `motd.getHeaderState` — Input: `locale`, optional `archiveSeenUpToEndsAtIso`, optional `overlayDismissedUpTo`; Output: ob aktives Overlay bzw. Archiv-Einträge existieren (Toolbar-Icon).
- `motd.recordInteraction` — Input: `motdId`, `contentVersion`, `kind` (`ACK` | `THUMB_UP` | `THUMB_DOWN` | `DISMISS_CLOSE` | `DISMISS_SWIPE`); streng rate-limited; Zähler in DB.
- **Rendering:** Endnutzer- und Admin-Vorschau nutzen **`renderMarkdownWithoutKatex`** + **DomSanitizer** (`bypassSecurityTrustHtml` nur auf dieser Pipeline), analog zu anderen sicheren Markdown-Ansichten — kein rohes HTML aus dem MOTD-Text.
- `admin.motd.*` — CRUD MOTD, Templates, Publish/Schedule, Archiv-Flag, Priorität.

## 5. Datenmodell (konzeptionell)

Mindestens:

- **MotdTemplate:** `id`, `name`, `defaultMarkdownByLocale` (oder JSON), `createdAt`, …
- **Motd:** `id`, `status`, `priority`, `startsAt`, `endsAt`, `markdownByLocale` (oder eigene Zeilen pro Locale), `contentHash`/`version`, `visibleInArchive` (bool), `createdAt`, `updatedAt`, optional `templateId` (Referenz)

Exaktes Prisma-Schema entsteht in Story 10.1.

## 6. Routing (geplant)

- Keine öffentliche Deep-Route zwingend nötig; Archiv kann rein modal sein.
- Admin: Erweiterung **`/admin`** um MOTD-Bereich (Tabs oder Unterpfad ` /admin/motd` — bei Implementierung mit Route Guard konsistent zu Epic 9).

Aktualisierung von [`ROUTES_AND_STORIES.md`](../ROUTES_AND_STORIES.md) bei Umsetzung.

## 7. Tests und DoD (Ergänzung)

- Unit-Tests: Auswahl „aktuelle“ MOTD (Zeitfenster, Priorität, Locale-Fallback), DTO-Stripping, Admin-Auth.
- Frontend: Overlay- und Archiv-Komponenten mit Specs; Tastaturbedienung; reduced motion.
- Optional: E2E-Szenario „MOTD erscheint → dismiss → erscheint nicht erneut bei gleicher Version“.

## 8. Backlog-Referenz

Umsetzung in **Epic 10**, Stories **10.1–10.8**, Reihenfolge siehe [`Backlog.md`](../../Backlog.md).

## 8a. Didaktik: Referenz-Feature für FSE und SQM

Epic 10 unterstützt **Fallstudie Software Engineering** und **Software-Qualitätsmanagement** als **durchgängiges Vorlesungsbeispiel**:

- **Lehrperson:** Setzt **Epic 10 vollständig** (Stories **10.1–10.8**) mit **KI-Agenten** in den **Anfangsvorlesungen** um — **live am Beamer** — anhand dieser Spezifikation, ADR-0018 und Backlog.
- **Parallel:** **Mini-Vorlesungen** zu **Werkzeugen** (VS Code, Git, GitHub) und **Stack** des Projekts (TypeScript, PostgreSQL, Prisma, tRPC, Redis, Frontend/Monorepo — nach Terminplan).
- **Studierende:** **Kein** Pflicht-Implementierungsauftrag für Epic 10; sie beginnen **danach** mit **User Stories aus anderen Epics** (didaktische Reihenfolge: [`STUDENT-STORY-REIHENFOLGE.md`](../praktikum/STUDENT-STORY-REIHENFOLGE.md), Abschnitt 3). **SQM** arbeitet an **deren** PRs; das fertige MOTD dient als **Referenz** (Architektur, Tests, DoD-Vorbild).

Detaillierte Einordnung: [`docs/praktikum/STUDENT-STORY-REIHENFOLGE.md`](../praktikum/STUDENT-STORY-REIHENFOLGE.md) (Abschnitt 0); Synergie: [`docs/didaktik/zweiter-kurs-und-agentische-ki.md`](../didaktik/zweiter-kurs-und-agentische-ki.md).

## 9. Betrieb: zweite MOTD sichtbar, Migrationen

- **Reihenfolge im Overlay:** Es gilt nur **eine** aktive Karte. Eine zweite (z. B. „Making of“ mit niedrigerer Priorität) erscheint **erst**, nachdem die erste (z. B. Willkommen) mit **„Alles klar!“**, **Schließen** oder **Swipe** bestätigt wurde. Technisch: Client sendet `overlayDismissedUpTo` an `motd.getCurrent` / `getHeaderState`.
- **Datenbank:** Produktiv per **`prisma migrate deploy`**. Lokal: **`npm run dev`** wendet nach `ensure-schema` zusätzlich die SQL-Dateien der Making-of-Migration an (`prisma db execute`), damit die zweite Meldung auch ohne manuelles Migrate existiert. Manuell: **`npm run seed:motd-making-of`**.
- **Zeitfenster:** `startsAt` / `endsAt` sind **UTC**. Liegt `startsAt` in der Zukunft, liefert die API die MOTD nicht (Filter in `motd.ts`). Mehrere aktive MOTDs müssen sich zeitlich mit der Willkommens-MOTD **überlappen**, wenn sie nacheinander nach Dismiss kommen sollen (gleiches frühes `startsAt` wie die erste Meldung).

## 10. Changelog dieses Dokuments

| Datum      | Änderung                                                                             |
| ---------- | ------------------------------------------------------------------------------------ |
| 2026-03-27 | Erstfassung (Abstimmung mit ADR-0018 und Epic 10).                                   |
| 2026-03-27 | Abschnitt 8a: Studienvehikel FSE + SQM, Vorlesungsdemo, Studierendenphase.           |
| 2026-03-27 | Abschnitt 8a: Klarstellung — Epic 10 nur Lehrperson live; Studis andere Epics.       |
| 2026-03-31 | Abschnitt 9: Betrieb (Kette, Migrationen, Zeitfenster); Nummerierung Changelog → 10. |
