# Session-Ergebnisbericht (PDF)

Phase-1- und Phase-2-Export für Lehrende nach Session-Ende (`FINISHED`).

> **Siehe auch:** [Selbsteinschätzung](confidence-slider.md) (Lernstand, Heatmap, Prioritäten im Bericht)

## Datenquelle

Der PDF-Bericht nutzt **`SessionExportDTO`** — dieselbe aggregierte Quelle wie der CSV-Export, kein CSV-Parsing.

| Kontext                           | tRPC                                                                | Berechtigung                 |
| --------------------------------- | ------------------------------------------------------------------- | ---------------------------- |
| Host direkt nach Session-Ende     | `getExportData`, `getSessionExportPdf`                              | Host-Token (`x-host-token`)  |
| Quiz-Sammlung (letzter Durchlauf) | `getLastSessionExportDataForQuiz`, `getLastSessionExportPdfForQuiz` | Quiz-Historien-`accessProof` |

Phase 2 ergänzt:

- `questionTextFull` — vollständiger Fragentext als Markdown (KaTeX, Bilder, Code, Lehrer-Tipps)
- `feedbackSummary` — aggregierte Session-Bewertung (Sterne)

## UI

### Host-Abschlussansicht (`FINISHED`)

- **Primär:** **Ergebnisbericht (PDF)** — Server-PDF via `getSessionExportPdf` (Playwright)
- **Unter „Mehr“:** **Für Excel exportieren** — CSV mit tabellarischen Rohdaten (weniger Kontext als der PDF-Bericht)

Fallback, falls das Server-PDF scheitert: Browser-Druckdialog über dasselbe HTML (`printSessionResultsReport`) — ohne eigene Vorschau-UI.

### Quiz-Sammlung (Quizkarte)

Nach mindestens einem beendeten Live-Durchlauf:

- **Nachbesprechung** — kompakter Dialog mit Lernstand, Prioritäten und Teilnehmer-Feedback
- **Ergebnisbericht (PDF)** — derselbe Bericht wie in der Host-Ansicht, aus der Session-Historie

Beide Aktionen nutzen dasselbe Berechtigungsmodell wie Bonus-Codes (Besitznachweis über `accessProof`); Session-ID und Session-Code werden in der Sammlung nicht angezeigt.

## Berichtsstruktur

1. Deckblatt (Quiz, Code, Datum, Teilnehmende, Datenschutzhinweis)
2. Feedback der Teilnehmenden (falls vorhanden)
3. Lernstand und Selbsteinschätzung inkl. Prioritätsfragen, Heatmap, Verteilungsbalken
4. Fragen im Detail — pro Frage eine Druckseite mit:
   - MC/SC-Balkendiagrammen (korrekte Option grün)
   - NUMERIC-Histogrammen inkl. R1/R2-Vergleich
   - Confidence-Heatmap und Selbsteinschätzungs-Balken
   - PI-Rundenkontext (`aggregationRound`, Stimmenzahlen)
5. Optional: Team-Wertung, Bonus-Codes

## Technik

Pipeline: `SessionExportDTO` → `buildSessionResultsReportHtml()` → Playwright `page.pdf()`. Backend-PDF und Browser-Print-Fallback teilen sich die Lib `@arsnova/session-export-report`.

| Schicht                                            | Ort                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared Report-Builder (HTML, Charts, Print-CSS)    | `libs/session-export-report/`                                                                                                               |
| Frontend-Labels (Angular `$localize`)              | `apps/frontend/src/app/core/session-results-report-labels.ts`                                                                               |
| Frontend-Export-Service (Download, Print-Fallback) | `apps/frontend/src/app/core/session-results-export.service.ts`                                                                              |
| Server-PDF (Playwright-Wrapper)                    | `apps/backend/src/lib/session-results-report-pdf.ts`                                                                                        |
| tRPC                                               | `session.getSessionExportPdf`, `session.getExportData`, `session.getLastSessionExportPdfForQuiz`, `session.getLastSessionExportDataForQuiz` |

Vor Tests und Backend-Build muss `@arsnova/session-export-report` gebaut sein (`npm run build:libs`).

## Demo-PDF erzeugen

Backend und PostgreSQL müssen laufen:

```bash
npm run generate:session-pdf-demo -w @arsnova/frontend
```

Optional mit bestehender Session:

```bash
SESSION_CODE=ABC123 npm run generate:session-pdf-demo -w @arsnova/frontend
```

Für relative Demo-Bilder (`/assets/…`) werden Bilder beim PDF-Export als Data-URLs eingebettet (lokal aus `apps/frontend/src/assets` bzw. per HTTPS-Fetch).

Siehe Issue #76.
