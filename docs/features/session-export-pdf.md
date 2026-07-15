# Session-Ergebnisbericht (PDF)

Phase-1- und Phase-2-Export für Lehrende nach Session-Ende (`FINISHED`).

## Datenquelle

Der PDF-Bericht nutzt **`SessionExportDTO`** via `getSessionExportData` — dieselbe Quelle wie der CSV-Export, kein CSV-Parsing.

Phase 2 ergänzt:

- `questionTextFull` — vollständiger Fragentext als Markdown (KaTeX, Bilder, Code, Lehrer-Tipps)
- `feedbackSummary` — aggregierte Session-Bewertung (Sterne)

## UI

In der Host-Abschlussansicht: **Ergebnis als PDF** neben **Ergebnis als CSV**.

1. **Primär:** Server-PDF via `getSessionExportPdf` (PDFKit) — direkter Download
2. **Fallback:** Druckoptimiertes HTML im Browser (Print-Dialog → „Als PDF speichern“)

## Struktur

1. Deckblatt (Quiz, Code, Datum, Teilnehmende, Datenschutzhinweis)
2. Feedback der Teilnehmenden (falls vorhanden)
3. Lernstand und Selbsteinschätzung inkl. Prioritätsfragen, Heatmap, Verteilungsbalken
4. Fragen im Detail — pro Frage eine Druckseite mit:
   - MC/SC-Balkendiagrammen (korrekte Option grün)
   - NUMERIC-Histogrammen inkl. R1/R2-Vergleich
   - Confidence-Heatmap und Selbsteinschätzungs-Balken
   - PI-Rundenkontext
5. Optional: Team-Wertung, Bonus-Codes

## Technik

| Schicht                                 | Datei                                                         |
| --------------------------------------- | ------------------------------------------------------------- |
| HTML-Builder                            | `apps/frontend/src/app/core/session-results-report.util.ts`   |
| Charts (Heatmap, Histogramm, Sterne)    | `session-results-report-charts.util.ts`                       |
| Print-CSS (A4, Seitenumbruch pro Frage) | `session-results-report-styles.ts`                            |
| Server-PDF (Playwright/HTML)            | `apps/backend/src/lib/session-results-report-pdf.ts`          |
| Shared Report-Builder                   | `libs/session-export-report/`                                 |
| tRPC                                    | `session.getSessionExportPdf`, `session.getSessionExportData` |
| i18n-Labels                             | `session-results-report-labels.ts`                            |

## Demo-PDF erzeugen

Backend und PostgreSQL müssen laufen:

```bash
npm run generate:session-pdf-demo -w @arsnova/frontend
```

Optional mit bestehender Session:

```bash
SESSION_CODE=ABC123 npm run generate:session-pdf-demo -w @arsnova/frontend
```

Für relative Demo-Bilder (`/assets/…`) werden Bilder beim PDF-Export als Data-URLs eingebettet
(lokal aus `apps/frontend/src/assets` bzw. per HTTPS-Fetch).

Siehe Issue #76.
