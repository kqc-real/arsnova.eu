# Startseite – Backlog-Funktionalitäts-Check

**Datum:** 2026-03-20  
**Basis:** Backlog.md – alle Optionen, die von der Startseite erreichbar oder sichtbar sein müssen

---

## Übersicht: Backlog vs. Startseite

| Backlog-Anforderung                  | Story        | Sichtbar/Erreichbar | Ziel                           | Status                                                            |
| ------------------------------------ | ------------ | ------------------- | ------------------------------ | ----------------------------------------------------------------- |
| Theme-Umschalter (Light/Dark/System) | 6.1          | Header              | –                              | ✅ (Default: Dark)                                                |
| Sprachwähler                         | 6.2          | Header              | –                              | ✅ 5 Sprachen (de, en, fr, it, es); i18n-Übersetzungen noch offen |
| Quiz-Presets (Seriös/Spielerisch)    | 1.11         | Header              | –                              | ✅                                                                |
| Session erstellen                    | 2.1a, Epic 1 | Erstellen-Karte     | /quiz                          | ⚠️ Platzhalter (Story 1.1 offen)                                  |
| Quiz wählen                          | Epic 1       | Erstellen-Karte     | /quiz                          | ⚠️ Platzhalter                                                    |
| Q&amp;A                              | 8.1          | Erstellen-Karte     | /quiz                          | ⚠️ Platzhalter (Story 8.1 offen)                                  |
| Session-Code-Eingabe (Beitreten)     | 3.1          | Beitreten-Karte     | /session/:code                 | ✅ (Session-Info; Lobby Story 2.2 offen)                          |
| Zuletzt beigetretene Sessions        | –            | Beitreten-Karte     | /session/:code                 | ✅ Zusatzfeature                                                  |
| Zur Quiz-Sammlung                    | Epic 1       | Sammlungs-Karte     | /quiz                          | ✅                                                                |
| Quiz aus Vorlage erstellen           | Epic 1       | Sammlungs-Karte     | /quiz                          | ⚠️ Platzhalter                                                    |
| Demo starten                         | –            | Sammlungs-Karte     | /quiz                          | ✅                                                                |
| Demo beitreten                       | –            | Sammlungs-Karte     | /session/DEMO01                | ⚠️ Platzhalter (Demo-Session im Backend optional)                 |
| Server-Status-Widget                 | 0.4          | Status-Karte        | –                              | ✅                                                                |
| Backend-Status / Retry               | –            | Status-Karte        | –                              | ✅ Zusatzfeature                                                  |
| Impressum / Datenschutz              | 6.3          | Footer              | /legal/imprint, /legal/privacy | ✅                                                                |
| Trust-Badges (DSGVO · Open Source)   | –            | Footer + Hero       | –                              | ✅ Zusatzfeature                                                  |
| Offline-Indikator                    | –            | App-weit            | –                              | ✅ Zusatzfeature                                                  |
| Hilfe (Onboarding)                   | –            | Erstellen-Karte     | GitHub/docs                    | ✅                                                                |

---

## Vollständigkeit: Von der Startseite erreichbare Funktionen

### ✅ Vollständig erreichbar

- **Beitreten:** Code-Eingabe → /session/:code (zeigt Session-Info oder Fehlermeldung)
- **Impressum / Datenschutz:** Footer-Links → /legal/:slug
- **Theme, Presets, Sprache:** Header-Controls (persistiert in localStorage)
- **Server-Status:** Live-Daten + Retry bei Verbindungsfehler

### ⚠️ Teilweise / Backlog offen

- **Session erstellen, Quiz wählen, Q&amp;A** → /quiz (Quiz-Sammlung, Demo, Live-Start vorhanden; Rest siehe Backlog Epic 1 / 8)
- **Quiz aus Vorlage** → /quiz (noch Platzhalter); **Zur Quiz-Sammlung / Demo starten** → /quiz ✅
- **Demo beitreten** → /session/DEMO01 (funktioniert, wenn Demo-Session im Backend existiert)

### Offene Backlog-Lücken (nicht von Startseite lösbar)

- **Story 6.2:** Sprachauswahl ist vollständig (5 Sprachen); i18n-Übersetzungsdateien noch offen
- **Story 6.1:** Theme-Default ist „Dark“, Backlog nennt „System“ als Default
- **Story 2.2 (Lobby):** Beitreten führt zur Session-Info, nicht zur Lobby-Ansicht
- **Story 1.1 (Quiz erstellen):** laut Backlog noch 🔴; `/quiz` ist dennoch funktional (Sammlung, Editor-Einstieg)

---

## Zusammenfassung

- **Alle Startseiten-Links führen zu gültigen Zielen.** Keine toten Links.
- **Platzhalter sind konsistent:** Quiz-Funktionen → /quiz; Beitreten → /session/:code.
- **Zusatzfeatures:** Zuletzt beigetreten, Retry, Trust-Badges, Offline-Indikator, Demo-Buttons.
- **Backlog-Stories:** Epic 1 (Quiz), Epic 2 (Lobby), Epic 8 (Q&amp;A) noch offen – Startseite ist vorbereitet.
