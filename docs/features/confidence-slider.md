<!-- markdownlint-disable MD013 -->

# Selbsteinschätzung (Story 1.2i)

> **Zielgruppe:** Product Owner, Entwickler, Lehrpersonen  
> **Stand:** 2026-07-15

## Zweck

Die **Selbsteinschätzung** ist **kein eigener Fragentyp**, sondern eine optionale Zusatz-Einstellung für bewertbare Fragen (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `SHORT_TEXT`, `NUMERIC_ESTIMATE`). Teilnehmende geben nach ihrer Antwort an, wie sicher sie bei dieser Antwort sind (Skala 1–5). Die Auswertung hilft Lehrpersonen, **selbstsicher falsche** Antworten und damit verbundene Fehlkonzepte zu erkennen.

Die Selbsteinschätzung beeinflusst **nicht** Punkte oder das Leaderboard.

## Terminologie in der UI

| Kontext                 | Begriff                             |
| ----------------------- | ----------------------------------- |
| Feature, Toggle, Export | **Selbsteinschätzung**              |
| Editor-Feldlabels       | **Niedrige/Hohe Antwortsicherheit** |
| Auswertungsmetrik       | **falsch + hohe Antwortsicherheit** |
| Fehlkonzept-Marker      | **selbstsicher falsch**             |

Technische Feldnamen im Code und in Exporten bleiben aus Kompatibilitätsgründen bei `confidence*` (z. B. `confidenceEnabled`, `confidenceValue`).

## Konfiguration (Quiz-Editor)

- Toggle **„Selbsteinschätzung“** pro unterstützter Frage (Standard für neue bewertbare Fragen: aktiv)
- Feste **5-Stufen-Skala** (1 = niedrig, 5 = hoch)
- Optionale Labels für **niedrige** und **hohe Antwortsicherheit** (max. 50 Zeichen)
- Live-Vorschau der Skala im Editor

## Teilnehmenden-Flow

1. Antwort wählen oder eingeben
2. Danach erscheint die Selbsteinschätzungs-Skala (Progressive Disclosure)
3. Absenden erst möglich, wenn Antwort **und** Selbsteinschätzung gesetzt sind
4. `confidenceValue` wird mit dem Vote gespeichert (1–5)

Während `ACTIVE` erhalten Teilnehmende **keine** aggregierten Selbsteinschätzungs-Daten anderer Personen.

## Host-Auswertung (nach Ergebnisfreigabe)

In der Host-Ansicht bei `RESULTS`:

- **Matrix** Korrektheit × Antwortsicherheit (niedrig / mitte / hoch) mit semantischer Heatmap
- Hervorhebung **selbstsicher falsch** (`incorrectHigh`)
- Bei Auswahlfragen: Aufschlüsselung falscher Optionen mit hoher Antwortsicherheit

Nach dem Session-Ende (`FINISHED`) fasst die Abschlussauswertung alle ausreichend großen
Frage-Aggregate zusammen:

- **Gefestigtes Wissen:** richtig + hohe Antwortsicherheit
- **Fehlkonzept-Risiko:** falsch + hohe Antwortsicherheit
- **Fragiles Wissen:** richtig + niedrige Antwortsicherheit
- Priorisierte Fragen für die Nachbesprechung, zuerst nach dem Anteil „falsch + hohe Antwortsicherheit“
- Runde 2 ersetzt bei Peer Instruction Runde 1; sonst wird Runde 1 verwendet

Fragen mit weniger als fünf gültigen Selbsteinschätzungs-Antworten werden in der Abschlussauswertung und
im Export nicht einzeln ausgewiesen. Die Quiz-Sammlung bietet auf der Quizkarte über
**„Letzte Auswertung“** den letzten beendeten Durchlauf an. Der bestehende Quiz-Historien-
Besitznachweis schützt diesen Zugriff; Session-ID und Session-Code werden dort nicht ausgeliefert.

## Export (Story 4.7)

Bei **Peer Instruction** und **Zwei-Runden-Schätzfragen** gilt die **Effective-Vote-Regel** (ADR-0028): Existieren Runde-2-Votes, fließen in Export und Abschlussauswertung nur diese ein; sonst Runde 1. Der Session-Export liefert pro Frage `aggregationRound` sowie optional `round1ParticipantCount` und `round2ParticipantCount`, wenn Runde 2 verwendet wird. Das CSV enthält die Spalte **Aggregationsrunde** und einen Kontext in **Details** (z. B. „Runde 1: 28 Stimmen · Aggregiert: Runde 2 mit 25 Stimmen“, wenn nicht alle erneut abstimmen).

Im Session-CSV-Export enthält die Spalte „Details“ bei aktivierter Selbsteinschätzung weiterhin:

- Verteilung `1:… 2:… …`
- Kreuzwerte richtig/hoch und falsch/hoch
- Hinweis auf selbstsicher falsche Antworten
- Optional falsche Optionen mit Häufigkeit

Zusätzlich gibt es eigene Spalten je Frage (`Selbsteinschätzung n`, `Gefestigt`,
`Fehlkonzept-Risiko`, `Fragil`, `Erkannte Wissenslücke`, `Unentschieden`,
`Stärkstes Signal`) sowie einen eigenen Summenblock **„Lernstand und Selbsteinschätzung“**.

## Import aus arsnova.click

`sessionConfig.confidenceSliderEnabled: true` wird beim Quiz-Import auf alle **bewertbaren** Fragen gemappt (`confidenceEnabled: true`). Optionale Session-Labels (`confidenceLabelLow` / `confidenceLabelHigh`) werden übernommen. Der Import meldet einen Hinweis: _Die Selbsteinschätzung wurde für bewertbare Fragen übernommen._ Details und Grenzen: [`docs/examples/quiz-import/arsnova-click-compat.md`](../examples/quiz-import/arsnova-click-compat.md).

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
