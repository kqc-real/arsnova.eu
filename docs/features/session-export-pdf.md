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
- **Unter „Mehr“:** **Rohdaten als CSV exportieren** — tabellarische Rohdaten (weniger Kontext als der PDF-Bericht)

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

Die Playwright-PDF-Erzeugung ist im einzelnen Backend-Prozess hart auf **einen aktiven
Job** begrenzt. Das gilt gemeinsam für Host- und Historienberichte. Ein weiterer Job wird
ohne Warteschlange mit tRPC
`TOO_MANY_REQUESTS` (HTTP 429) abgewiesen; der Ergebnisbericht kann dann den bestehenden
Browser-Print-Fallback nutzen. Dadurch belegen wartende PDF-Anfragen keine zusätzliche
Serverkapazität.

Die strukturierten Log-Ereignisse `pdf:job_started` und `pdf:job_finished`
enthalten Quelle, aktive Jobs, Cap sowie kumulative Zähler. Ablehnungen werden
nicht pro Request separat geloggt, sondern zentral gesampelt als
`rate_limit_429` (Kategorie `pdf`). Die diagnose-authentifizierte Query
`health.securityStats` exponiert die momentane Auslastung und bounded
aggregierte Completed-/Failed-/Rejected-Zähler der letzten Minute aus Redis.
Der Cap ist absichtlich nicht per Env abschaltbar. Die aktuelle Produktion
betreibt genau einen Backend-Prozess; vor einer horizontalen Skalierung muss der Limiter
durch einen verteilten, ausfallsicheren Semaphore ersetzt werden, damit der Cap
instanzübergreifend bleibt.

| Schicht                                            | Ort                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared Report-Builder (HTML, Charts, Print-CSS)    | `libs/session-export-report/`                                                                                                               |
| Berichtslabels DE + Locale-Resolver                | `libs/session-export-report/src/labels-de.ts`, `labels-locale.util.ts`, `labels-i18n.generated.ts`                                          |
| Fachglossar (Nachbesprechungsplan i18n)            | [`session-export-pdf-i18n-glossary.md`](session-export-pdf-i18n-glossary.md)                                                                |
| Frontend-Labels (Angular `$localize`)              | `apps/frontend/src/app/core/session-results-report-labels.ts`                                                                               |
| Frontend-Export-Service (Download, Print-Fallback) | `apps/frontend/src/app/core/session-results-export.service.ts`                                                                              |
| Server-PDF (Playwright-Wrapper)                    | `apps/backend/src/lib/session-results-report-pdf.ts`                                                                                        |
| tRPC                                               | `session.getSessionExportPdf`, `session.getExportData`, `session.getLastSessionExportPdfForQuiz`, `session.getLastSessionExportDataForQuiz` |

Vor Tests und Backend-Build muss `@arsnova/session-export-report` gebaut sein (`npm run build:libs`).

## Demo-PDF erzeugen

Backend und PostgreSQL müssen laufen. Fachbegriffe: [`session-export-pdf-i18n-glossary.md`](session-export-pdf-i18n-glossary.md).

```bash
# Alle Locales × Standard + PDF/UA → apps/frontend/src/assets/demo/
npm run generate:session-pdf-demo -w @arsnova/frontend
```

Dateinamen: `demo-session-results-30.{de|en|fr|es|it}.pdf` und `….${locale}-pdfua.pdf` (plus DE-Aliase ohne Locale-Suffix).

**Wichtig:** Nach Label- oder Showcase-Änderungen alle Locales neu erzeugen. Platzhalter-Kopien der DE-PDF sind nicht freigabefähig.

Optional:

```bash
# Nur eine Locale
DEMO_PDF_LOCALES=fr npm run generate:session-pdf-demo -w @arsnova/frontend

# Bestehende Session (nur sinnvoll mit genau einer Locale)
DEMO_PDF_LOCALES=de SESSION_CODE=ABC123 npm run generate:session-pdf-demo -w @arsnova/frontend
```

Für relative Demo-Bilder (`/assets/…`) werden Bilder beim PDF-Export als Data-URLs eingebettet (lokal aus `apps/frontend/src/assets` bzw. per HTTPS-Fetch).

## PDF/UA-1 validieren

```bash
npm run validate:pdfua
```

Der Befehl prüft die PDF/UA-Demos aller fünf Locales mit dem fest
versionierten Container `verapdf/cli:v1.30.2`. Der Bericht liegt anschließend
unter `tmp/pdfua-validation/verapdf-ua1.txt` und wird in CI als
`verapdf-ua1-report` gespeichert.

`Tagged: yes` aus `pdfinfo` genügt nicht als PDF/UA-Nachweis. veraPDF prüft
zusätzlich unter anderem eingebettete Fonts, Unicode-Abbildungen, Metadaten,
Strukturelemente und Annotationen.

Nachträgliche Fortsetzungsstempel werden nur im Standardprofil gezeichnet.
Die von `pdf-lib` verwendeten PDF-Standardfonts sind nicht eingebettet und
dürfen daher nicht in das PDF/UA-Profil gelangen. Der Stempel ist ein
visuelles Artifact und kein Bestandteil der semantischen Lesereihenfolge.

Das ausführliche Prüfprotokoll steht unter
[`../praktikum/ACCESSIBILITY-PDFUA-PRUEFPROTOKOLL.md`](../praktikum/ACCESSIBILITY-PDFUA-PRUEFPROTOKOLL.md).

Siehe Issue #76.
