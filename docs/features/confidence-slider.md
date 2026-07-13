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

- **Matrix** Korrektheit × Sicherheit (niedrig / mitte / hoch) mit semantischer Heatmap
- Hervorhebung **selbstsicher falsch** (`incorrectHigh`)
- Bei Auswahlfragen: Aufschlüsselung falscher Optionen mit hoher Sicherheit

Nach dem Session-Ende (`FINISHED`) fasst die Abschlussauswertung alle ausreichend großen
Frage-Aggregate zusammen:

- **Gefestigtes Wissen:** richtig + hohe Sicherheit
- **Fehlkonzept-Risiko:** falsch + hohe Sicherheit
- **Fragiles Wissen:** richtig + niedrige Sicherheit
- Priorisierte Fragen für die Nachbesprechung, zuerst nach dem Anteil „falsch + hohe Sicherheit“
- Runde 2 ersetzt bei Peer Instruction Runde 1; sonst wird Runde 1 verwendet

Fragen mit weniger als fünf gültigen Confidence-Antworten werden in der Abschlussauswertung und
im Export nicht einzeln ausgewiesen. Die Quiz-Sammlung bietet auf der Quizkarte über
**„Letzte Auswertung“** den letzten beendeten Durchlauf an. Der bestehende Quiz-Historien-
Besitznachweis schützt diesen Zugriff; Session-ID und Session-Code werden dort nicht ausgeliefert.

## Export (Story 4.7)

Im Session-CSV-Export enthält die Spalte „Details“ bei aktiviertem Sicherheitsgrad weiterhin:

- Verteilung `1:… 2:… …`
- Kreuzwerte richtig/hoch und falsch/hoch
- Hinweis auf selbstsicher falsche Antworten
- Optional falsche Optionen mit Häufigkeit

Zusätzlich gibt es eigene Confidence-Spalten je Frage (`Konfidenz n`, `Gefestigt`,
`Fehlkonzept-Risiko`, `Fragil`, `Erkannte Wissenslücke`, `Unentschieden`,
`Stärkstes Signal`) sowie einen eigenen Summenblock **„Lernstand und Sicherheit“**.

## Import aus arsnova.click

`sessionConfig.confidenceSliderEnabled: true` wird beim Quiz-Import auf alle **bewertbaren** Fragen gemappt (`confidenceEnabled: true`). Optionale Session-Labels (`confidenceLabelLow` / `confidenceLabelHigh`) werden übernommen. Details und Grenzen: [`docs/examples/quiz-import/arsnova-click-compat.md`](../examples/quiz-import/arsnova-click-compat.md).

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
| Click-Import             | `apps/frontend/.../quiz-import-normalizer.ts`        |
