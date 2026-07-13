<!-- markdownlint-disable MD013 -->

# Sicherheitsgrad / Confidence Slider (Story 1.2i)

> **Zielgruppe:** Product Owner, Entwickler, Lehrpersonen  
> **Stand:** 2026-07-13

## Zweck

Der Sicherheitsgrad ist **kein eigener Fragentyp**, sondern eine optionale Zusatz-Einstellung für bewertbare Fragen (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `SHORT_TEXT`, `NUMERIC_ESTIMATE`). Teilnehmende geben nach ihrer Antwort an, wie sicher sie sind (Skala 1–5). Die Auswertung hilft Lehrpersonen, **selbstsicher falsche** Antworten und damit verbundene Fehlkonzepte zu erkennen.

Der Sicherheitsgrad beeinflusst **nicht** Punkte oder das Leaderboard.

## Konfiguration (Quiz-Editor)

- Toggle **„Sicherheitsgrad abfragen“** pro unterstützter Frage
- Feste **5-Stufen-Skala** (1 = niedrig, 5 = hoch)
- Optionale Labels für niedrige und hohe Sicherheit (max. 50 Zeichen)
- Live-Vorschau der Skala im Editor

## Teilnehmenden-Flow

1. Antwort wählen oder eingeben
2. Danach erscheint die Sicherheits-Skala (Progressive Disclosure)
3. Absenden erst möglich, wenn Antwort **und** Sicherheitsgrad gesetzt sind
4. `confidenceValue` wird mit dem Vote gespeichert (1–5)

Während `ACTIVE` erhalten Teilnehmende **keine** aggregierten Confidence-Daten anderer Personen.

## Host-Auswertung (nach Ergebnisfreigabe)

In der Host-Ansicht bei `RESULTS`:

- **Verteilung** der Stufen 1–5 (Balken, beamer-tauglich)
- **Kreuztabelle** Korrektheit × Sicherheit (niedrig / mittel / hoch)
- Hervorhebung **selbstsicher falsch** (`incorrectHigh`)
- Bei Auswahlfragen: Aufschlüsselung falscher Optionen mit hoher Sicherheit

## Export (Story 4.7)

Im Session-CSV-Export enthält die Spalte „Details“ bei aktiviertem Sicherheitsgrad:

- Verteilung `1:… 2:… …`
- Kreuzwerte richtig/hoch und falsch/hoch
- Hinweis auf selbstsicher falsche Antworten
- Optional falsche Optionen mit Häufigkeit

## Technische Verankerung

| Bereich                  | Ort                                                  |
| ------------------------ | ---------------------------------------------------- |
| Konstanten & Aggregation | `libs/shared-types/src/confidence.ts`                |
| Persistenz               | `Question.confidenceEnabled`, `Vote.confidenceValue` |
| Vote-Validierung         | `apps/backend/src/routers/vote.ts`                   |
| Host-DTO / Stripping     | `apps/backend/src/routers/session.ts`                |
| Editor                   | `apps/frontend/.../quiz-edit/`                       |
| Teilnehmende             | `apps/frontend/.../session-vote/`                    |
| Host                     | `apps/frontend/.../session-host/`                    |
