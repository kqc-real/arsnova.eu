export const SESSION_RESULTS_REPORT_STYLES = `
:root {
  --report-ink: #1b1f24;
  --report-muted: #5c6570;
  --report-line: #d8dee6;
  --report-surface: #f6f8fb;
  --report-brand: #0d47a1;
  --report-brand-soft: #e3f2fd;
  --report-success: #2e7d32;
  --report-success-soft: #e8f5e9;
  --report-warning: #ef6c00;
  --report-warning-soft: #fff3e0;
  --report-danger: #c62828;
  --report-danger-soft: #ffebee;
  --report-accent: #3949ab;
}

@page {
  size: 210mm 297mm;
  margin: 12mm 14mm 20mm;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  color: var(--report-ink);
  font: 10.5pt/1.5 "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

h1, h2, h3, h4, h5 {
  line-height: 1.25;
  margin: 0 0 0.55rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

p { margin: 0 0 0.65rem; }

.report-cover {
  display: flex;
  flex-direction: column;
  page-break-after: always;
  break-after: page;
}

.report-cover-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--report-line);
}

.report-cover-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.report-cover-logo-svg {
  display: block;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.35rem;
}

.report-cover-brand-text {
  font-size: 13pt;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--report-ink);
}

.report-cover-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.65rem;
  margin: 0 0 1.5rem;
}

.report-cover-summary-item {
  border: 1px solid var(--report-line);
  border-radius: 0.75rem;
  padding: 0.75rem 0.55rem;
  text-align: center;
  background: #fff;
}

.report-cover-summary-item strong {
  display: block;
  font-size: 18pt;
  line-height: 1.1;
  color: var(--report-brand);
}

.report-cover-summary-item span {
  display: block;
  font-size: 8.5pt;
  color: var(--report-muted);
  margin-top: 0.15rem;
}

.report-cover-summary-item--risk strong {
  color: var(--report-danger);
}

.report-privacy-detail {
  margin-top: 1rem;
  font-size: 9pt;
  color: var(--report-muted);
}

.report-privacy-detail p {
  margin-bottom: 0.35rem;
}

.report-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.report-cover-nav {
  margin: 0 0 1.25rem;
}

.report-cover-nav-label {
  margin: 0 0 0.45rem;
  font-size: 8pt;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--report-muted);
}

.report-cover-nav-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.report-cover-nav-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--report-line);
  border-radius: 999px;
  background: var(--report-surface);
  color: var(--report-brand);
  font-size: 9pt;
  font-weight: 600;
  text-decoration: none;
  line-height: 1.2;
}

.report-cover-nav-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.1rem;
  padding: 0.05rem 0.3rem;
  border-radius: 999px;
  background: var(--report-brand-soft);
  color: var(--report-brand);
  font-size: 8pt;
  font-variant-numeric: tabular-nums;
}

.report-priority-jump {
  margin-left: 0.35rem;
  font-size: 9pt;
  color: var(--report-brand);
  text-decoration: none;
  white-space: nowrap;
}

.report-cover h1 {
  font-size: 28pt;
  margin-bottom: 0.35rem;
  color: var(--report-brand);
}

.report-cover-subtitle {
  font-size: 12pt;
  color: var(--report-muted);
  margin-bottom: 2rem;
}

.report-cover-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem 1.25rem;
  margin: 0 0 1.25rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--report-line);
  border-radius: 0.75rem;
  background: var(--report-surface);
}

.report-cover-meta dt {
  font-size: 8.5pt;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--report-muted);
  margin: 0;
}

.report-cover-meta dd {
  margin: 0.1rem 0 0;
  font-size: 11.5pt;
  font-weight: 600;
}

.report-privacy {
  margin-top: 1.25rem;
  padding: 0.75rem 0.9rem;
  border-left: 4px solid var(--report-brand);
  background: var(--report-brand-soft);
  font-size: 9pt;
  color: var(--report-muted);
  page-break-inside: avoid;
  break-inside: avoid;
}

.report-privacy p {
  margin: 0 0 0.35rem;
}

.report-privacy p:last-child {
  margin-bottom: 0;
}

.report-section {
  margin: 0 0 1.5rem;
  page-break-inside: avoid;
}

.report-section--questions {
  page-break-inside: auto;
  break-inside: auto;
  margin: 0;
}

.report-section > h2 {
  font-size: 16pt;
  color: var(--report-brand);
  padding-bottom: 0.35rem;
  border-bottom: 2px solid var(--report-line);
  margin-bottom: 0.85rem;
}

.report-lead {
  color: var(--report-muted);
  max-width: 42rem;
}

.report-alert {
  display: inline-block;
  background: var(--report-warning-soft);
  color: #bf360c;
  border: 1px solid #ffcc80;
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  font-size: 9.5pt;
  font-weight: 600;
  margin-bottom: 0.85rem;
}

.report-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem;
  margin: 0.85rem 0 1rem;
}

.report-metric {
  border: 1px solid var(--report-line);
  border-radius: 0.75rem;
  padding: 0.75rem 0.65rem;
  text-align: center;
  background: #fff;
}

.report-metric strong {
  display: block;
  font-size: 18pt;
  line-height: 1.1;
  margin-bottom: 0.15rem;
}

.report-metric span {
  font-size: 9pt;
  color: var(--report-muted);
}

.report-metric--success strong { color: var(--report-success); }
.report-metric--risk strong { color: var(--report-danger); }
.report-metric--fragile strong { color: var(--report-warning); }

.report-coverage, .report-note, .report-chart-subtitle {
  font-size: 9.5pt;
  color: var(--report-muted);
}

.report-priority-list {
  margin: 0;
  padding-left: 1.1rem;
}

.report-priority-list li {
  margin-bottom: 0.65rem;
}

.report-priority-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  font-size: 9pt;
  color: var(--report-muted);
  margin-top: 0.2rem;
}

.report-question {
  margin: 0 0 1.5rem;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}

.report-questions .report-question {
  page-break-before: always;
  break-before: page;
  page-break-inside: auto;
  break-inside: auto;
}

.report-question-head {
  padding: 0 0 0.65rem;
  margin-bottom: 0.35rem;
  border-bottom: none;
  background: transparent;
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-question-text {
  padding: 0 0 0.85rem;
  font-size: 11pt;
  font-weight: 400;
  line-height: 1.45;
  min-width: 0;
  max-width: 100%;
}

.report-question-body {
  padding: 0;
  page-break-inside: auto;
  break-inside: auto;
}

.report-question-body h4 {
  break-after: avoid;
  page-break-after: avoid;
}

.report-chart-block,
.report-histogram-stage,
.report-bars,
.report-pi-comparison,
.report-confidence-cards {
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-chart-block h5 {
  break-after: avoid;
  page-break-after: avoid;
}

.report-heatmap-legend,
.report-vbars,
.report-vbar-row {
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-question-kicker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.55rem;
}

.report-question-index {
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--report-brand);
}

.report-badge {
  display: inline-block;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  font-size: 8.5pt;
  font-weight: 600;
  border: 1px solid var(--report-line);
  background: #fff;
  color: var(--report-muted);
}

.report-badge--round {
  background: var(--report-brand-soft);
  border-color: #90caf9;
  color: #0d47a1;
}

.report-question-text.markdown-body :where(h1, h2, h3, h4) {
  font-size: 13pt;
  font-weight: 650;
  line-height: 1.3;
  margin: 0 0 0.45rem;
}

.report-question-text.markdown-body :where(p, ul, ol) {
  margin: 0 0 0.55rem;
}

.report-question-text.markdown-body blockquote {
  margin: 0.55rem 0;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid var(--report-brand);
  background: var(--report-brand-soft);
  color: var(--report-muted);
  font-size: 9.5pt;
  font-style: normal;
}

.report-question-text.markdown-body blockquote :where(p:last-child) {
  margin-bottom: 0;
}

.report-question-text.markdown-body :where(p:last-child, ul:last-child, ol:last-child) {
  margin-bottom: 0;
}

.report-question-text.markdown-body img,
.report-question-text.markdown-body .report-inline-image {
  display: block;
  width: auto;
  max-width: min(100%, 460px);
  max-height: 280px;
  height: auto;
  object-fit: contain;
  margin: 0.45rem auto;
  border-radius: 0.35rem;
  page-break-inside: avoid;
  break-inside: avoid;
}

.report-question-text.markdown-body .report-inline-image--gif {
  max-width: min(100%, 360px);
  max-height: 210px;
}

.report-question-text.markdown-body .report-inline-image--svg {
  max-width: min(100%, 340px);
  max-height: 200px;
}

.report-question-text.markdown-body pre,
.report-question-text.markdown-body .report-code-block,
.report-question-text.markdown-body .markdown-code-block {
  overflow-x: auto;
  max-width: 100%;
  margin: 0.45rem 0;
  padding: 0;
  border-radius: 0.35rem;
  border: 1px solid var(--report-line);
  background: #f6f8fa;
}

.report-question-text.markdown-body pre code.hljs {
  display: block;
  padding: 0.55rem 0.65rem;
  font-size: 8.5pt;
  line-height: 1.35;
  background: transparent;
}

.report-question-text.markdown-body .katex-display {
  margin: 0.45rem 0;
  overflow-x: auto;
}

.report-question-text.markdown-body .markdown-katex-error {
  color: var(--report-danger);
  font-size: 9pt;
}

.report-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.75rem;
  font-size: 9pt;
  color: var(--report-muted);
}

.report-meta-item {
  display: inline-flex;
  gap: 0.25rem;
  align-items: baseline;
}

.report-meta-item strong {
  font-weight: 600;
  color: var(--report-ink);
}

.report-question-body h4 {
  font-size: 10.5pt;
  color: var(--report-brand);
  margin: 0.85rem 0 0.45rem;
  break-after: avoid;
  page-break-after: avoid;
}

.report-question-body h4:first-child {
  margin-top: 0;
}

.report-bars, .report-vbars, .report-histogram {
  list-style: none;
  margin: 0;
  padding: 0;
}

.report-bar-row {
  display: grid;
  grid-template-columns: minmax(8rem, 1.25fr) 1fr auto;
  gap: 0.55rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.report-bar-label {
  font-size: 9.5pt;
  line-height: 1.25;
  word-break: break-word;
  font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
  word-spacing: normal;
  letter-spacing: normal;
}

.report-bar-label:has(.report-bar-leading-emoji) {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 0.45rem;
  align-items: center;
}

.report-bar-leading-emoji {
  font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
  font-size: 15pt;
  line-height: 1;
}

.report-bar-label-text {
  min-width: 0;
  word-spacing: normal;
  letter-spacing: normal;
}

.report-bar-track {
  height: 0.75rem;
  background: #eceff1;
  border-radius: 999px;
  overflow: hidden;
}

.report-bar-fill {
  height: 100%;
  background: var(--report-accent);
  border-radius: 999px;
  min-width: 2px;
  position: relative;
}

.report-bar-pct {
  position: absolute;
  right: 0.25rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 7pt;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.35);
  white-space: nowrap;
}

.report-bar-fill--correct { background: var(--report-success); }
.report-bar-fill--rating { background: #f9a825; }

.report-bar-value {
  font-size: 9pt;
  white-space: nowrap;
  color: var(--report-muted);
  font-variant-numeric: tabular-nums;
}

.report-tag {
  display: inline-block;
  margin-left: 0.25rem;
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  background: var(--report-success-soft);
  color: var(--report-success);
  font-size: 8pt;
  font-weight: 700;
}

.report-list {
  margin: 0;
  padding-left: 1rem;
  font-size: 9.5pt;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9pt;
  margin-top: 0.35rem;
}

.report-table th, .report-table td {
  border: 1px solid var(--report-line);
  padding: 0.35rem 0.45rem;
  text-align: left;
  vertical-align: top;
}

.report-table th {
  background: var(--report-surface);
  font-weight: 600;
}

.report-confidence-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.45rem;
  margin: 0.65rem 0;
}

.report-confidence-card {
  border: 1px solid var(--report-line);
  border-radius: 0.55rem;
  padding: 0.45rem 0.55rem;
  background: var(--report-surface);
}

.report-confidence-card strong {
  display: block;
  font-size: 11pt;
}

.report-confidence-card span {
  font-size: 8.5pt;
  color: var(--report-muted);
}

.report-chart-grid {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 0.85rem;
  margin: 0.75rem 0;
  break-inside: auto;
  page-break-inside: auto;
}

.report-chart-block {
  border: 1px solid var(--report-line);
  border-radius: 0.65rem;
  padding: 0.55rem 0.65rem;
  background: #fff;
}

.report-chart-block h5 {
  font-size: 9.5pt;
  color: var(--report-muted);
  margin-bottom: 0.45rem;
  font-weight: 650;
}

.report-heatmap {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
}

.report-heatmap th, .report-heatmap td {
  border: 1px solid var(--report-line);
  padding: 0.45rem 0.35rem;
  text-align: center;
}

.report-heatmap th {
  background: var(--report-surface);
  font-weight: 650;
  font-size: 9pt;
}

.report-heatmap th[scope="row"] {
  text-align: left;
  padding-left: 0.55rem;
}

.report-heat { font-weight: 700; font-variant-numeric: tabular-nums; }
.report-heat--empty { background: #fafafa; color: #aaa; }
.report-heat--neutral-1 { background: #eceff1; }
.report-heat--neutral-2 { background: #cfd8dc; }
.report-heat--neutral-3 { background: #b0bec5; }
.report-heat--success-1 { background: #e8f5e9; color: #1b5e20; }
.report-heat--success-2 { background: #c8e6c9; color: #1b5e20; }
.report-heat--success-3 { background: #a5d6a7; color: #1b5e20; }
.report-heat--caution-1 { background: #fff8e1; color: #e65100; }
.report-heat--caution-2 { background: #ffecb3; color: #e65100; }
.report-heat--caution-3 { background: #ffe082; color: #e65100; }
.report-heat--risk-1 { background: #ffebee; color: #b71c1c; }
.report-heat--risk-2 { background: #ffcdd2; color: #b71c1c; }
.report-heat--risk-3 { background: #ef9a9a; color: #b71c1c; }

.report-heatmap-legend {
  margin-top: 0.45rem;
  font-size: 8pt;
  color: var(--report-muted);
  display: grid;
  gap: 0.15rem;
}

.report-heatmap-legend-scale {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.15rem;
}

.report-heatmap-legend-scale .report-heat {
  min-width: 1.4rem;
  padding: 0.1rem 0.25rem;
  border-radius: 0.2rem;
  text-align: center;
}

.report-heatmap-legend-hint {
  font-size: 7.5pt;
}

.report-blockquote-label {
  margin: 0 0 0.25rem;
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--report-brand);
}

.report-pi-comparison {
  margin-bottom: 0.75rem;
}

.report-pi-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.report-pi-row {
  margin-bottom: 0.65rem;
}

.report-pi-label {
  font-size: 9.5pt;
  font-weight: 600;
  margin-bottom: 0.25rem;
  word-spacing: normal;
  letter-spacing: normal;
}

.report-pi-label:has(.report-bar-leading-emoji) {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 0.45rem;
  align-items: center;
}

.report-pi-bars {
  display: grid;
  gap: 0.25rem;
}

.report-pi-bar-group {
  display: grid;
  grid-template-columns: 5.5rem 1fr;
  gap: 0.35rem;
  align-items: center;
}

.report-pi-round {
  font-size: 8pt;
  color: var(--report-muted);
}

.report-vbars {
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
  min-height: 5.5rem;
  padding-top: 0.15rem;
}

.report-vbar-row {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  min-width: 0;
}

.report-vbar-track {
  width: 100%;
  max-width: 1.75rem;
  height: 4.5rem;
  background: #eceff1;
  border-radius: 4px 4px 0 0;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.report-vbar-fill {
  width: 100%;
  background: var(--report-accent);
  border-radius: 4px 4px 0 0;
  min-height: 2px;
}

.report-vbar-label, .report-vbar-value {
  font-size: 8.5pt;
  font-variant-numeric: tabular-nums;
}

.report-histogram-stage {
  position: relative;
  margin-top: 0.35rem;
}

.report-hist-band {
  position: absolute;
  left: 0;
  top: 0;
  height: 4.25rem;
  background: rgba(46, 125, 50, 0.14);
  border-left: 2px solid var(--report-success);
  border-right: 2px solid var(--report-success);
  pointer-events: none;
  z-index: 1;
}

.report-hist-reference {
  position: absolute;
  top: 0;
  bottom: 1.15rem;
  width: 0;
  border-left: 2px dashed var(--report-brand);
  z-index: 2;
  pointer-events: none;
}

.report-hist-reference-label {
  position: absolute;
  top: -0.95rem;
  transform: translateX(-50%);
  font-size: 7pt;
  font-weight: 600;
  color: var(--report-brand);
  white-space: nowrap;
  z-index: 3;
  pointer-events: none;
}

.report-numeric-band-caption {
  margin: 0.35rem 0 0;
  font-size: 8.5pt;
  color: var(--report-muted);
  break-before: avoid;
  page-break-before: avoid;
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-histogram {
  position: relative;
  z-index: 0;
  display: flex;
  align-items: flex-end;
  gap: 0.2rem;
  min-height: 5.5rem;
  overflow-x: auto;
  padding-bottom: 0.15rem;
}

.report-hist-col {
  flex: 1;
  min-width: 1.65rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}

.report-hist-bar-wrap {
  width: 100%;
  height: 4.25rem;
  display: flex;
  align-items: flex-end;
  background: #eceff1;
  border-radius: 4px 4px 0 0;
}

.report-hist-bar {
  width: 100%;
  background: var(--report-accent);
  border-radius: 4px 4px 0 0;
  min-height: 2px;
}

.report-hist-col--in-band .report-hist-bar { background: var(--report-success); }

.report-hist-count {
  font-size: 8pt;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.report-hist-range {
  font-size: 7pt;
  color: var(--report-muted);
  text-align: center;
  line-height: 1.1;
  word-break: break-word;
}

.report-footer {
  margin-top: 1.5rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--report-line);
  font-size: 8.5pt;
  color: var(--report-muted);
  text-align: center;
  page-break-inside: avoid;
}

@media print {
  body { font-size: 10pt; }
  .report-question-head { break-inside: avoid-page; page-break-inside: avoid; }
  .report-section.report-confidence { page-break-after: always; break-after: page; }
  .report-chart-block,
  .report-histogram-stage,
  .report-bars,
  .report-pi-comparison,
  .report-heatmap-legend,
  .report-numeric-band-caption,
  .report-vbars {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}

@media screen and (max-width: 640px) {
  .report-metrics, .report-chart-grid, .report-confidence-cards, .report-cover-meta {
    grid-template-columns: 1fr;
  }
  .report-bar-row { grid-template-columns: 1fr; gap: 0.2rem; }
}
`;
