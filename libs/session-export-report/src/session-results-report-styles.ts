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
  /* Oben: laufender Header + Fortsetzungsband + Luft zum ersten Inhaltsblock. */
  margin: 24mm 14mm 20mm;
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

.report-cover-page {
  display: flex;
  flex-direction: column;
}

.report-cover-continued {
  display: flex;
  flex-direction: column;
  break-before: page;
  page-break-before: always;
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

.report-cover-summary-sub {
  display: block;
  font-size: 8pt;
  font-weight: 500;
  color: var(--report-muted);
  margin-top: 0.2rem;
}

.report-cover-summary-item--risk strong {
  color: var(--report-danger);
}

.report-action-plan,
.report-hardest-questions,
.report-participation-overview {
  margin: 0.75rem 0 1rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid var(--report-line);
  border-radius: 0.65rem;
  background: #fff;
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-action-plan-start {
  margin: 0.55rem 0 0;
  font-weight: 600;
}

.report-action-plan h2,
.report-hardest-questions h2 {
  margin: 0 0 0.4rem;
  font-size: 12pt;
  color: var(--report-brand);
}

.report-action-plan ul,
.report-hardest-questions ol {
  margin: 0;
  padding-left: 1.1rem;
}

.report-action-plan li,
.report-hardest-questions li {
  margin-bottom: 0.35rem;
}

.report-participation-overview h3,
.report-distractor-analysis h4,
.report-pi-gain h4,
.report-response-time h4 {
  margin: 0 0 0.35rem;
  font-size: 10.5pt;
  color: var(--report-brand);
}

.report-distractor-analysis,
.report-pi-gain,
.report-response-time,
.report-followup {
  margin: 0.65rem 0;
  padding: 0.55rem 0.7rem;
  border-left: 4px solid var(--report-accent);
  background: var(--report-surface);
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-pi-gain {
  border-left-color: var(--report-success);
  background: var(--report-success-soft);
}

.report-numeric-plain {
  margin: 0.35rem 0 0.65rem;
  padding-left: 1.1rem;
}

.report-participation-note {
  font-size: 9.5pt;
  color: var(--report-muted);
  margin: 0 0 0.45rem;
}

.report-cover-actions {
  margin: 0 0 1rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid #8d1b3d;
  border-left-width: 5px;
  background: #fff7f9;
  break-inside: avoid;
}

.report-cover-actions h2 {
  margin: 0 0 0.35rem;
  color: #7a1634;
  font-size: 12pt;
}

.report-cover-actions ol {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 8.5pt;
}

.report-cover-actions li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
}

.report-cover-actions a {
  color: var(--report-ink);
  text-decoration: none;
}

.report-cover-actions li span {
  color: #7a1634;
  font-weight: 650;
  white-space: nowrap;
}

.report-cover-actions p {
  margin: 0.4rem 0 0;
  font-size: 9pt;
  font-weight: 700;
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
  border-radius: 0.25rem;
  background: #fff;
  color: var(--report-brand);
  font-size: 9pt;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.15rem;
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
  break-inside: avoid;
  page-break-inside: avoid;
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

.report-section.report-confidence {
  page-break-inside: auto;
  break-inside: auto;
}

.report-section--questions {
  page-break-inside: auto;
  break-inside: auto;
  margin: 0;
}

.report-session-summary {
  margin: 1rem 0;
  padding: 0.75rem 0.9rem;
  border-left: 5px solid var(--report-brand);
  background: var(--report-brand-soft);
  break-before: auto;
  page-break-before: auto;
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-session-summary h2 {
  margin: 0 0 0.35rem;
  color: var(--report-brand);
  font-size: 14pt;
}

.report-session-summary ul {
  margin: 0;
  padding-left: 1.1rem;
}

.report-section > h2 {
  font-size: 16pt;
  color: var(--report-brand);
  padding-bottom: 0.35rem;
  border-bottom: 2px solid var(--report-line);
  margin-bottom: 0.85rem;
  break-after: avoid-page;
  page-break-after: avoid;
}

.report-section--questions > h2 {
  break-after: avoid-page;
  page-break-after: avoid;
}

.report-questions > .report-question:first-of-type {
  break-before: avoid-page;
  page-break-before: avoid;
}

.report-lead {
  color: var(--report-muted);
  max-width: 42rem;
}

.report-confidence-reading-guide {
  background: var(--report-brand-soft);
  border: 1px solid var(--report-line);
  border-radius: 0.75rem;
  padding: 0.55rem 0.75rem;
  margin: 0.75rem 0 1rem;
  max-width: 42rem;
}

.report-confidence-reading-guide h3 {
  font-size: 10pt;
  font-weight: 600;
  margin: 0 0 0.4rem;
  color: var(--report-brand);
}

.report-confidence-reading-guide p {
  margin: 0;
  font-size: 9pt;
  color: var(--report-muted);
}

.report-confidence-symbol-guide {
  margin-top: 0.25rem !important;
  font-weight: 600;
  color: var(--report-ink) !important;
}

.report-reading-guide-list {
  margin: 0;
  padding-left: 1.15rem;
  font-size: 9.5pt;
  color: var(--report-muted);
}

.report-reading-guide-list li + li {
  margin-top: 0.2rem;
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
  margin: 0.35rem 0 1rem;
}

.report-metrics-basis {
  margin: 0.75rem 0 0.35rem;
  font-size: 9pt;
  font-weight: 600;
  color: var(--report-ink);
}

.report-metrics--five {
  grid-template-columns: repeat(5, 1fr);
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
.report-metric--fragile strong { color: #1565c0; }
.report-metric--gap strong { color: var(--report-warning); }
.report-metric--middle strong { color: var(--report-muted); }

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
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-priorities {
  break-before: page;
  page-break-before: always;
  break-inside: auto;
  page-break-inside: auto;
}

.report-priority-metrics {
  display: grid;
  gap: 0.15rem;
  font-size: 9pt;
  color: var(--report-muted);
  margin-top: 0.2rem;
}

.report-question {
  margin: 0 0 1.05rem;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}

.report-questions .report-question {
  page-break-before: auto;
  break-before: auto;
  page-break-inside: auto;
  break-inside: auto;
}

.report-questions .report-question:first-child {
  page-break-before: auto;
  break-before: auto;
}

.report-questions .report-question:last-child {
  page-break-before: auto;
  break-before: auto;
}

.report-questions .report-question--code {
  break-before: page;
  page-break-before: always;
}

.report-questions .report-question--priority {
  break-before: auto;
  page-break-before: auto;
}

.report-question-head {
  padding: 0 0 0.65rem;
  margin-bottom: 0.35rem;
  border-bottom: none;
  background: transparent;
  break-inside: avoid;
  page-break-inside: avoid;
  break-after: avoid;
  page-break-after: avoid;
}

.report-question-keep-start {
  break-inside: avoid;
  page-break-inside: avoid;
  break-after: avoid;
  page-break-after: avoid;
}

.report-question-text {
  padding: 0 0 0.85rem;
  font-size: 11pt;
  font-weight: 400;
  line-height: 1.45;
  min-width: 0;
  max-width: 100%;
  break-after: avoid;
  page-break-after: avoid;
}

.report-question-body {
  display: flow-root;
  padding: 0;
  page-break-inside: auto;
  break-inside: auto;
  break-before: avoid;
  page-break-before: avoid;
}

.report-question-body > :first-child {
  break-inside: avoid;
  page-break-inside: avoid;
  break-before: avoid;
  page-break-before: avoid;
}

.report-next-question {
  margin: 0 0 0.65rem;
  padding-top: 0.55rem;
  border-top: 2px solid var(--report-line);
  color: var(--report-muted);
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.report-top-signal {
  margin: 0.45rem 0 0;
  padding: 0.65rem 0.75rem;
  border: 1px solid #8d1b3d;
  border-left-width: 5px;
  background: #fff7f9;
  color: var(--report-ink);
  font-size: 9.5pt;
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-top-signal strong {
  display: block;
  margin-bottom: 0.15rem;
  color: #7a1634;
}

.report-top-signal > span {
  display: block;
}

.report-top-signal p {
  margin: 0.35rem 0 0;
  padding-top: 0.35rem;
  border-top: 1px solid #d9a5b3;
  font-weight: 600;
}

.report-confidence-continuation {
  break-inside: avoid;
  page-break-inside: avoid;
  break-before: avoid-page;
  page-break-before: avoid;
}

.report-question--priority .report-confidence-continuation {
  break-before: auto;
  page-break-before: auto;
}

.report-question-result-group {
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-chart-footnote {
  margin: 0.35rem 0 0.85rem;
  font-size: 9pt;
  color: var(--report-muted);
  max-width: 42rem;
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
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-question-text.markdown-body blockquote.report-blockquote--teaching,
.report-question-text.markdown-body blockquote.report-blockquote--hint {
  break-inside: avoid;
  page-break-inside: avoid;
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
  background: #f3f4f6;
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-question-text.markdown-body pre code.hljs {
  display: block;
  padding: 0.55rem 0.65rem;
  font-size: 8.5pt;
  line-height: 1.4;
  color: #111827;
  background: transparent;
}

@media print {
  .report-question-text.markdown-body pre code.hljs,
  .report-question-text.markdown-body pre code.hljs .hljs-keyword,
  .report-question-text.markdown-body pre code.hljs .hljs-built_in,
  .report-question-text.markdown-body pre code.hljs .hljs-title,
  .report-question-text.markdown-body pre code.hljs .hljs-number,
  .report-question-text.markdown-body pre code.hljs .hljs-string,
  .report-question-text.markdown-body pre code.hljs .hljs-literal {
    color: #1e3a8a !important;
  }

  .report-question-text.markdown-body pre code.hljs .hljs-comment,
  .report-question-text.markdown-body pre code.hljs .hljs-quote {
    color: #374151 !important;
  }
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

.report-bar-row--rating .report-bar-value {
  min-width: 4.5rem;
  font-weight: 700;
  color: var(--report-ink);
}

.report-bar-fill--correct { background: var(--report-success); }
.report-bar-fill--correct {
  background-color: #4a7871;
  background-image: repeating-linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.18) 0,
    rgba(255, 255, 255, 0.18) 1px,
    transparent 1px,
    transparent 11px
  );
}
.report-bar-fill--rating { background: #f9a825; }

.report-peer-change {
  margin-top: 0.75rem;
}

.report-peer-change-bar {
  display: flex;
  width: 100%;
  min-height: 1.35rem;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid var(--report-line);
  background: #eceff1;
}

.report-peer-change-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  color: #111827;
  font-size: 8pt;
  font-weight: 700;
}

.report-peer-change-seg--closer { background: #c8e6c9; }
.report-peer-change-seg--unchanged { background: #e0e0e0; }
.report-peer-change-seg--farther { background: #ffcdd2; }

.report-peer-change-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
  list-style: none;
  margin: 0.45rem 0 0;
  padding: 0;
  font-size: 8.5pt;
  color: var(--report-muted);
}

.report-peer-change-legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.report-peer-change-swatch {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 2px;
  display: inline-block;
}

.report-confidence-degenerate {
  margin: 0.5rem 0 0.75rem;
  padding: 0.55rem 0.7rem;
  border-left: 4px solid var(--report-danger);
  background: #fff5f5;
}

.report-confidence-degenerate p {
  margin: 0.15rem 0;
}

.report-feedback-highlight {
  margin: 0.35rem 0 0.75rem;
  font-size: 9.5pt;
}

.report-action-plan-criteria {
  margin-top: 0.55rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.65rem;
}

.report-action-plan-criteria-link {
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  font-size: 9pt;
  line-height: 1.2;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--report-accent, #1a5fb4);
  color: var(--report-accent, #1a5fb4);
  background: var(--report-accent-soft, #e8f0fe);
  text-decoration: none;
}

.report-cover-summary-note {
  margin: 0.45rem 0 0;
  font-size: 8.5pt;
  color: var(--report-muted);
  max-width: 42rem;
}

.report-back-to-overview {
  margin: 0.35rem 0 1rem;
  font-size: 9pt;
}

.report-back-to-overview a {
  color: var(--report-accent, #1a5fb4);
  text-decoration: none;
  font-weight: 600;
}

.report-low-success-hint {
  margin-top: 0.35rem;
}

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

.report-correct-marker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 0.3rem;
  width: 1rem;
  height: 1rem;
  border: 1px solid currentColor;
  border-radius: 50%;
  color: #00695c;
  font-size: 8pt;
  font-weight: 800;
}

.report-incorrect-marker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 0.3rem;
  width: 1rem;
  height: 1rem;
  color: #6b2737;
  font-size: 9pt;
  font-weight: 800;
}

.report-chart-intro {
  margin: 0 0 0.45rem;
  padding: 0.35rem 0.5rem;
  border-left: 3px solid var(--report-muted);
  background: var(--report-surface);
  font-size: 9pt;
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

.report-table caption {
  caption-side: top;
  text-align: left;
  color: var(--report-muted);
  font-size: 9pt;
  margin-bottom: 0.45rem;
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

.report-heat { font-weight: 700; font-variant-numeric: tabular-nums; background: #fff; color: var(--report-ink); }
.report-heat--empty { background: #fafafa; color: #aaa; }
.report-heat--plain { box-shadow: none; outline: none; background: #fff; }
.report-heatmap--simple td { vertical-align: middle; }

.report-heat-cell {
  display: inline-grid;
  grid-template-columns: auto auto;
  align-items: center;
  justify-content: center;
  gap: 0.15rem 0.35rem;
}

.report-heat-symbol {
  font-size: 11pt;
  line-height: 1;
  font-weight: 700;
}

.report-heat-count {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.report-confidence-category-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}

.report-confidence-category-list li {
  display: grid;
  grid-template-columns: 1.25rem 1fr auto;
  gap: 0.45rem;
  align-items: center;
  font-size: 9.5pt;
}

.report-confidence-category-list strong {
  font-variant-numeric: tabular-nums;
}

.report-heatmap-legend {
  margin-top: 0.55rem;
  font-size: 8pt;
  color: var(--report-muted);
  display: grid;
  gap: 0.45rem;
}

.report-heatmap-legend--compact {
  display: block;
  line-height: 1.4;
}

.report-heatmap-cell-note {
  margin: 0.35rem 0 0;
  font-size: 8.5pt;
  color: var(--report-muted);
}

.report-heatmap-legend-section {
  display: grid;
  gap: 0.2rem;
}

.report-heatmap-legend-heading {
  font-size: 8pt;
  color: var(--report-text);
}

.report-heatmap-legend-lead {
  margin: 0;
  font-size: 7.5pt;
}

.report-heatmap-legend-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.2rem;
}

.report-heatmap-legend-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.report-heat-symbol-chip {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  border: 1px solid var(--report-ink);
  background: #fff;
  font-weight: 800;
}

.report-heat-symbol-chip--risk { border-width: 2px; }
.report-heat-symbol-chip--fragile { border-style: dashed; }
.report-heat-symbol-chip--gap { border-style: dotted; }
.report-heat-symbol-chip--mid { background: #f1f3f5; }
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

.report-vbar-track--zero {
  height: 0.15rem;
  min-height: 0.15rem;
  border-bottom: 1px solid var(--report-muted);
  border-radius: 0;
  background: transparent;
}

.report-confidence-distribution-compact {
  align-self: center;
  margin: 0;
  padding: 0.75rem;
  border: 1px solid var(--report-line);
  border-radius: 0.5rem;
  background: var(--report-surface);
  font-size: 9.5pt;
  font-weight: 650;
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

.report-scale-endpoints {
  margin: 0.4rem 0 0;
  text-align: center;
  font-size: 8.5pt;
  color: var(--report-muted);
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
  background-color: rgba(255, 255, 255, 0.55);
  background-image: repeating-linear-gradient(
    135deg,
    rgba(33, 33, 33, 0.08) 0,
    rgba(33, 33, 33, 0.08) 1px,
    transparent 1px,
    transparent 12px
  );
  border-left: 1.5px solid #424242;
  border-right: 1.5px solid #424242;
  pointer-events: none;
  z-index: 2;
}

.report-hist-reference {
  position: absolute;
  top: 0;
  bottom: 2.1rem;
  width: 5px;
  transform: translateX(-2.5px);
  background: #fff;
  z-index: 4;
  pointer-events: none;
}

.report-hist-reference::after {
  content: "";
  position: absolute;
  inset: 0 1px;
  border-left: 2px dashed #111;
}

.report-hist-bar-wrap--zero {
  height: 0.15rem;
  min-height: 0.15rem;
  border-bottom: 1px solid var(--report-muted);
  border-radius: 0;
  background: transparent;
}

.report-numeric-band-caption {
  margin: 0 0 0.35rem;
  font-size: 9pt;
  color: var(--report-muted);
  break-before: avoid;
  page-break-before: avoid;
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-numeric-primary {
  margin: 0 0 0.65rem;
  padding: 0.55rem 0.7rem;
  border-left: 4px solid var(--report-brand);
  background: var(--report-brand-soft);
  font-size: 10.5pt;
  line-height: 1.4;
  color: var(--report-ink);
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-numeric-primary strong {
  font-weight: 700;
}

.report-chart-block--secondary > h5 {
  font-size: 9.5pt;
  font-weight: 600;
  color: var(--report-muted);
}

.report-histogram {
  position: relative;
  z-index: 1;
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
  font-size: 8pt;
  color: var(--report-muted);
  text-align: center;
  line-height: 1.1;
  word-break: break-word;
}

.report-chart-axis-label {
  margin: 0.3rem 0 0;
  text-align: center;
  font-size: 8.5pt;
  color: var(--report-muted);
}

.report-identical-distributions {
  padding: 0.4rem 0.55rem;
  border-left: 3px solid var(--report-ink);
  background: var(--report-surface);
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
  .report-section.report-confidence { page-break-after: auto; break-after: auto; }
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
