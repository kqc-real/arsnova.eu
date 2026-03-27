<!-- markdownlint-disable MD013 -->

# ADR-0018: Message of the Day (MOTD) — Plattform-Kommunikation, Speicherung und öffentliche API

**Status:** Accepted  
**Datum:** 2026-03-27  
**Entscheider:** Projektteam

## Kontext

Der Betreiber soll **zur Laufzeit** (ohne Redeploy) **alle Nutzer:innen** der App über die **Startseite** informieren können: Wartungsfenster, neue Features, Spendenaufrufe u. a. Zusätzlich sind **Archiv** (vergangene, vom Admin freigegebene Nachrichten), **Zeitsteuerung** (Start/Ende), **mehrsprachige Inhalte**, **minimalistisches Admin-CMS** (Vorlagen + Historie) und **Nutzerinteraktionen** (Schließen, Wischen, explizite Kenntnisnahme, optionales Feedback) gefordert.

Ohne klare Architekturentscheidung drohen: XSS durch Markdown, unklare Trennung öffentlich/admin, fehlende Abgrenzung zu Epic 9 (Session-Admin), und i18n-Widersprüche (UI vs. redaktioneller Inhalt).

## Entscheidung

### 1. Abgrenzung zu anderen Bereichen

- **Epic 9 (Admin):** Bleibt **Session-Recherche, Löschung, Behördenexport**. MOTD ist **kein** Teil der Session-Administration, nutzt aber **dieselbe Admin-Authentifizierung** (`adminProcedure`, bestehendes Admin-Token-Modell). MOTD-Verwaltung lebt unter **`/admin`** als eigener Bereich oder Unterroute (siehe Feature-Doku).
- **Quiz-Inhalte:** MOTD-Texte sind **Betreiber-Inhalte**, nicht Dozenten-Quiz — sie unterliegen der **eigenen** redaktionellen i18n-Strategie (siehe unten), nicht der Regel „Quiz nicht übersetzen“ ([ADR-0008](./0008-i18n-internationalization.md)).

### 2. Persistenz: Postgres (Prisma) als Quelle der Wahrheit

- **MOTDs**, **Vorlagen (Templates)** und Steuerungsfelder (Zeitraum, Status, Archiv-Sichtbarkeit, Priorität) werden **relational** in der **Hauptdatenbank** gespeichert.
- **Redis** darf optional für **Kurzzeit-Cache** des „aktuellen“ MOTD genutzt werden, ist aber **nicht** die alleinige Quelle der Wahrheit (Historie und CMS erfordern DB).

### 3. API: tRPC mit Zod in `@arsnova/shared-types`

- **Öffentliche Lesende Endpunkte** (ohne Login): z. B. Abruf der **aktuell gültigen** MOTD für die gewählte Locale, sowie **paginierte Archivliste** nur für Einträge, die der Admin als **im Archiv sichtbar** markiert hat.
- **Schreibende Admin-Endpunkte:** nur `adminProcedure` — CRUD für MOTDs und Templates, Setzen von Zeiträumen, Status (z. B. Entwurf / geplant / veröffentlicht), Archiv-Flag, Priorität.
- **Optionale öffentliche Mutation** für **aggregierte Interaktionen** (z. B. Daumen, Kenntnisnahme-Event): streng **rate-limited**, **keine** personenbezogenen Profile; höchstens anonyme, zusammengefasste Zählung. **„Gesehen“ / Dismiss** kann **primär clientseitig** über `localStorage` erfolgen (kein Muss für Server-Call).

Konkrete Prozedurnamen und DTOs: siehe [`docs/features/motd.md`](../../features/motd.md).

### 4. Konfliktregel bei mehreren gültigen MOTDs

- Pro Zeitpunkt gilt **höchstens eine sichtbare Overlay-MOTD** auf der Startseite: Auswahl nach **`priority` DESC**, dann **`startsAt` DESC** (oder feste Sekundärregel in der Feature-Doku). Überlappende Einträge sind im Admin zu vermeiden; die Regel garantiert deterministisches Verhalten.

### 5. Inhalt: Markdown mit Produkt-Sanitizing

- Admin pflegt MOTDs in **Markdown** (Editor im Admin-Bereich, siehe [ADR-0016](./0016-markdown-katex-editor-split-view-and-md3-toolbar.md) / [ADR-0017](./0017-markdown-editor-ui-scope-and-ki-import-paste-field.md) für UI-Kontext — MOTD ist **kein** Quiz-Editor, kann aber **dieselbe Rendering-/Sanitize-Pipeline** nutzen wie andere sichere Markdown-Ansichten).
- **Kein** unsanitiertes HTML aus Operator-Eingabe an Endnutzer; **Subset** und **URL-Richtlinien** analog zu bestehenden Markdown-Entscheidungen ([ADR-0015](./0015-markdown-images-url-only-and-lightbox.md) wo Bilder vorkommen).

### 6. Mehrsprachige MOTD-Inhalte (redaktionell)

- Pro MOTD werden **Felder pro Locale** geführt: **de, en, fr, es, it** — analog zu den App-Locales ([ADR-0008](./0008-i18n-internationalization.md)).
- **Fallback-Kette** bei fehlendem Feld: dokumentierte Reihenfolge (z. B. aktuelle UI-Locale → Deutsch → Englisch), damit nie ein leerer Overlay-Body bei teilweise gepflegten Übersetzungen entsteht, sofern mindestens eine Sprache befüllt ist.

### 7. Clientzustand: localStorage

- **„Overlay nicht erneut zeigen“** wird an **`motdId` + Inhaltsversion/`contentHash`** gebunden, nicht nur an „es gab ein Overlay“, damit inhaltliche Änderungen erneute Anzeige ermöglichen.
- **Schema-versioniertes** JSON unter stabilem Key-Präfix (z. B. `arsnova-motd-v1`), damit Migrationen möglich sind.

### 8. UX- und A11y-Pflichten (Kurz)

- Overlay: **Schließen-Button** (fokussierbar), optional **Wisch-Geste** zum Schließen nur **zusätzlich** (nicht exklusiv), Escape, sinnvolle **`aria-modal`** / Fokusführung; Animationen nur bei `prefers-reduced-motion: no-preference` (Projektregeln).
- **Alle UI-Strings** (Buttons, ARIA, Archiv-Leerzustände) nach **ADR-0008** in **allen fünf Sprachen** (XLF).

### 9. Betrieb, Schutz, Nachvollziehbarkeit

- Öffentliche MOTD-Endpunkte: **Rate-Limiting** (Missbrauch, Scraping).
- **Leichtes Audit** für Admin-Aktionen (z. B. veröffentlicht, Archiv-Flag geändert): Metadaten ohne Volltext-Pflicht im Log, konsistent mit Epic-9-Denken; Details in Feature-Doku.

## Konsequenzen

### Positiv

- Einheitliche Stack-Nutzung (tRPC, Zod, Prisma, bestehendes Admin-Auth).
- Klare Trennung Session-Admin vs. Plattform-Kommunikation.
- Sichere Markdown-Darstellung durch Wiederverwendung etablierter Regeln.

### Negativ / Risiken

- Mehrsprachige Pflege erhöht **Admin-Aufwand**; Fallbacks und Validierung sind Pflicht.
- Öffentliche Mutationen für Feedback erfordern **Abuse-Schutz** und klare **Datenschutz-Folgen** (nur Aggregation).

## Alternativen (geprüft)

| Alternative                     | Verwerfungsgrund                                                          |
| ------------------------------- | ------------------------------------------------------------------------- |
| MOTD nur per Umgebungsvariable  | Nicht zur Laufzeit änderbar, kein Archiv/CMS.                             |
| MOTD nur in Redis               | Keine bequeme Historie/CMS; Verlust bei Flush ohne DB-Backup der Inhalte. |
| MOTD nur für eingeloggte Nutzer | Widerspricht Anforderung „alle Nutzer“; App ist weitgehend accountfrei.   |
| Rohes HTML vom Admin            | XSS-Risiko; Markdown + Sanitize ist ausreichend flexibel.                 |

## Verweise

- Feature-Gesamtdoku: [`docs/features/motd.md`](../../features/motd.md)
- Backlog: **Epic 10** in [`Backlog.md`](../../../Backlog.md)
- Admin-Auth: [ADR-0006](./0006-roles-routes-authorization-host-admin.md)
- i18n: [ADR-0008](./0008-i18n-internationalization.md)
