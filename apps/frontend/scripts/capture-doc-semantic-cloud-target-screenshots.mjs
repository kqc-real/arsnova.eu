#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium, webkit } from 'playwright';

const VIEWPORT = { width: 1480, height: 1180 };
const QA_TARGET_SCREENSHOT =
  '/Users/kqc/arsnova.eu/docs/screenshots/QA-Semantische-Begriffwolke-Zielbild.png';
const QUIZ_TARGET_SCREENSHOT =
  '/Users/kqc/arsnova.eu/docs/screenshots/Quiz-Freitext-Semantische-Begriffwolke-Zielbild.png';

const QA_SCENE = {
  eyebrow: 'Zielbild Kurs 3',
  title: 'Semantische Begriffwolke für Q&A',
  subtitle:
    'Gleiche Inhalte wie zuvor, jetzt semantisch gebündelt: Fragewörter und Varianten treten zurück, Themenlabels werden sichtbar.',
  metrics: [
    { label: 'Grundlage', value: '6 Fragen' },
    { label: 'Lexikalisch', value: '42 Wörter' },
    { label: 'Semantik', value: '4 Themencluster' },
    { label: 'Beteiligung', value: '16 Upvotes' },
  ],
  footer:
    'Statt einzelner Tokens zeigt das Zielbild tragfähige Begriffe: semantisch nahe Formulierungen, Varianten und Paraphrasen werden zu Themeninseln zusammengefasst.',
  clusters: [
    {
      tone: 'rose',
      score: 'Thema 01',
      title: 'Deskriptive Statistik',
      summary: 'Lage, Streuung und Ausreißer werden als gemeinsamer Themenblock erkannt.',
      chips: ['Median', 'Mittelwert', 'Varianz', 'Standardabweichung', 'Ausreißer'],
      details: ['3 Fragen', '7 Nennungen', 'Label aus mehreren Varianten'],
    },
    {
      tone: 'violet',
      score: 'Thema 02',
      title: 'Zusammenhänge verstehen',
      summary: 'Korrelation, Trend und passende Visualisierung werden semantisch verknüpft.',
      chips: ['Korrelation', 'Trend', 'Visualisierung', 'Unsicherheit'],
      details: ['2 Fragen', '5 Nennungen', 'Visualisierung als Kontextbegriff'],
    },
    {
      tone: 'amber',
      score: 'Thema 03',
      title: 'Modellierung und Prognose',
      summary: 'Regression, p-Wert und Kreuzvalidierung erscheinen als konsistenter Analysepfad.',
      chips: ['Regression', 'p-Wert', 'Kreuzvalidierung', 'Prognosen'],
      details: ['3 Fragen', '6 Nennungen', 'Methoden statt Einzeltokens'],
    },
    {
      tone: 'mint',
      score: 'Thema 04',
      title: 'Praxisbezug und Einordnung',
      summary: 'Datensatz, Formel, Interpretation und Vorlesungsbezug werden gemeinsam kontextualisiert.',
      chips: ['Praxisprojekt', 'Datensatz', 'Formel', 'Interpretation', 'Vorlesung'],
      details: ['4 Fragen', '8 Nennungen', 'Kontextcluster statt Streubegriffe'],
    },
  ],
};

const QUIZ_SCENE = {
  eyebrow: 'Zielbild Kurs 3',
  title: 'Semantische Begriffwolke für Quiz-Freitext',
  subtitle:
    'Dieselben Rückmeldungen werden zu stabilen Bedeutungsräumen verdichtet: Verständnis, Modellgüte, Praxisbezug und Interpretation.',
  metrics: [
    { label: 'Grundlage', value: '10 Antworten' },
    { label: 'Lexikalisch', value: '45 Wörter' },
    { label: 'Semantik', value: '4 Themencluster' },
    { label: 'Signal', value: '0 dominante Stoppwörter' },
  ],
  footer:
    'Das Zielbild priorisiert Bedeutung vor Oberfläche: ähnliche Aussagen werden gebündelt, mit klaren Themenlabels versehen und für Lehrende schneller interpretierbar.',
  clusters: [
    {
      tone: 'rose',
      score: 'Thema 01',
      title: 'Daten verstehen',
      summary: 'Datensatz, Ausreißer und Lageparameter werden als gemeinsames Verständnisfeld gruppiert.',
      chips: ['Datensatz', 'Median', 'Ausreißer', 'Varianz', 'Standardabweichung'],
      details: ['5 Antworten', '8 Signale', 'Konzepte aus mehreren Formulierungen'],
    },
    {
      tone: 'violet',
      score: 'Thema 02',
      title: 'Ergebnisse erklären',
      summary: 'Interpretation, Visualisierung und Korrelation verschmelzen zu einem didaktischen Kernbegriff.',
      chips: ['Interpretation', 'Visualisierung', 'Korrelation', 'Trend'],
      details: ['6 Antworten', '9 Signale', 'Paraphrasen zusammengeführt'],
    },
    {
      tone: 'amber',
      score: 'Thema 03',
      title: 'Modelle validieren',
      summary: 'Regression, p-Wert, Prognose und Kreuzvalidierung bilden eine belastbare Methodeninsel.',
      chips: ['Regression', 'p-Wert', 'Prognose', 'Kreuzvalidierung', 'Validierung'],
      details: ['5 Antworten', '8 Signale', 'Methodenfamilie statt Wortliste'],
    },
    {
      tone: 'mint',
      score: 'Thema 04',
      title: 'Praxisbezug sichern',
      summary: 'Praxisprojekt, Verständnis und greifbare Anwendung werden als Lernwirkung gebündelt.',
      chips: ['Praxisprojekt', 'Praxisbezug', 'greifbar', 'verständlich', 'Modelle'],
      details: ['4 Antworten', '6 Signale', 'Lerntransfer sichtbar gemacht'],
    },
  ],
};

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderCluster(cluster) {
  const chips = cluster.chips
    .map((chip) => `<li class="chip chip--${cluster.tone}">${escapeHtml(chip)}</li>`)
    .join('');
  const details = cluster.details
    .map((detail) => `<li class="detail-pill detail-pill--${cluster.tone}">${escapeHtml(detail)}</li>`)
    .join('');

  return `
    <article class="cluster cluster--${cluster.tone}">
      <div class="cluster__halo"></div>
      <div class="cluster__head">
        <span class="cluster__score">${escapeHtml(cluster.score)}</span>
        <h2>${escapeHtml(cluster.title)}</h2>
      </div>
      <p class="cluster__summary">${escapeHtml(cluster.summary)}</p>
      <ul class="chip-list">${chips}</ul>
      <ul class="detail-list">${details}</ul>
    </article>
  `;
}

function renderScene(scene) {
  const metrics = scene.metrics
    .map(
      (metric) => `
        <div class="metric">
          <span class="metric__label">${escapeHtml(metric.label)}</span>
          <strong class="metric__value">${escapeHtml(metric.value)}</strong>
        </div>
      `,
    )
    .join('');
  const clusters = scene.clusters.map(renderCluster).join('');

  return `<!DOCTYPE html>
  <html lang="de">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(scene.title)}</title>
      <style>
        :root {
          --page-bg: #f6eef9;
          --card-bg: rgba(255, 247, 252, 0.86);
          --card-border: rgba(199, 116, 201, 0.32);
          --text-strong: #2d2032;
          --text-muted: #674f70;
          --rose-fill: rgba(253, 214, 235, 0.94);
          --rose-line: rgba(210, 86, 154, 0.36);
          --violet-fill: rgba(229, 217, 255, 0.94);
          --violet-line: rgba(126, 86, 206, 0.36);
          --amber-fill: rgba(255, 230, 191, 0.95);
          --amber-line: rgba(214, 152, 37, 0.34);
          --mint-fill: rgba(214, 246, 234, 0.94);
          --mint-line: rgba(53, 164, 131, 0.34);
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          min-height: 100vh;
          font-family: "Aptos", "Segoe UI", "Helvetica Neue", sans-serif;
          color: var(--text-strong);
          background:
            radial-gradient(circle at top left, rgba(255, 194, 224, 0.72), transparent 28%),
            radial-gradient(circle at 82% 18%, rgba(212, 184, 255, 0.62), transparent 24%),
            linear-gradient(180deg, #fbf4fd 0%, #f2e7f5 100%);
          display: grid;
          place-items: center;
          padding: 36px;
        }

        .board {
          width: 1320px;
          min-height: 980px;
          position: relative;
          overflow: hidden;
          border-radius: 40px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          box-shadow:
            0 34px 80px rgba(124, 84, 150, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.7);
          padding: 42px 42px 34px;
        }

        .board::before,
        .board::after {
          content: '';
          position: absolute;
          inset: auto;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          filter: blur(16px);
          opacity: 0.45;
          pointer-events: none;
        }

        .board::before {
          top: -84px;
          right: -38px;
          background: radial-gradient(circle, rgba(255, 193, 227, 0.95), transparent 68%);
        }

        .board::after {
          bottom: -120px;
          left: -60px;
          background: radial-gradient(circle, rgba(199, 224, 255, 0.85), transparent 66%);
        }

        .hero {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 24px;
          align-items: start;
          margin-bottom: 24px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #9e158a;
          background: rgba(255, 216, 240, 0.82);
          border: 1px solid rgba(201, 83, 153, 0.25);
        }

        h1 {
          margin: 18px 0 12px;
          font-size: 52px;
          line-height: 1.02;
          letter-spacing: -0.04em;
        }

        .subtitle {
          margin: 0;
          max-width: 760px;
          font-size: 22px;
          line-height: 1.38;
          color: var(--text-muted);
        }

        .metric-panel {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          padding: 16px;
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.58);
          border: 1px solid rgba(202, 184, 216, 0.52);
          backdrop-filter: blur(10px);
        }

        .metric {
          padding: 16px 18px;
          border-radius: 22px;
          background: rgba(255, 249, 253, 0.9);
          border: 1px solid rgba(208, 186, 218, 0.6);
          min-height: 96px;
        }

        .metric__label {
          display: block;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #7f6787;
          margin-bottom: 10px;
        }

        .metric__value {
          display: block;
          font-size: 28px;
          line-height: 1.15;
          letter-spacing: -0.03em;
        }

        .cluster-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          margin-bottom: 22px;
        }

        .cluster {
          position: relative;
          overflow: hidden;
          min-height: 290px;
          padding: 24px 24px 22px;
          border-radius: 32px;
          background: rgba(255, 255, 255, 0.76);
          border: 1px solid rgba(207, 186, 219, 0.58);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
        }

        .cluster__halo {
          position: absolute;
          inset: -50px auto auto -30px;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          filter: blur(8px);
          opacity: 0.9;
        }

        .cluster--rose .cluster__halo { background: radial-gradient(circle, var(--rose-fill), transparent 70%); }
        .cluster--violet .cluster__halo { background: radial-gradient(circle, var(--violet-fill), transparent 70%); }
        .cluster--amber .cluster__halo { background: radial-gradient(circle, var(--amber-fill), transparent 70%); }
        .cluster--mint .cluster__halo { background: radial-gradient(circle, var(--mint-fill), transparent 70%); }

        .cluster__head,
        .cluster__summary,
        .chip-list,
        .detail-list {
          position: relative;
          z-index: 1;
        }

        .cluster__head {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-bottom: 12px;
        }

        .cluster__score {
          align-self: flex-start;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(140, 112, 159, 0.18);
        }

        .cluster h2 {
          margin: 0;
          font-size: 30px;
          line-height: 1.08;
          letter-spacing: -0.04em;
        }

        .cluster__summary {
          margin: 0 0 18px;
          font-size: 17px;
          line-height: 1.42;
          color: var(--text-muted);
        }

        .chip-list,
        .detail-list {
          list-style: none;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          padding: 0;
          margin: 0;
        }

        .chip,
        .detail-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 10px 15px;
          border-radius: 999px;
          font-weight: 700;
          border: 1px solid transparent;
          box-shadow: 0 8px 22px rgba(132, 95, 151, 0.08);
        }

        .chip { font-size: 20px; }
        .detail-pill {
          min-height: 34px;
          padding: 8px 12px;
          font-size: 13px;
          color: #6f5d74;
          margin-top: 16px;
        }

        .chip--rose, .detail-pill--rose { background: var(--rose-fill); border-color: var(--rose-line); }
        .chip--violet, .detail-pill--violet { background: var(--violet-fill); border-color: var(--violet-line); }
        .chip--amber, .detail-pill--amber { background: var(--amber-fill); border-color: var(--amber-line); }
        .chip--mint, .detail-pill--mint { background: var(--mint-fill); border-color: var(--mint-line); }

        .footer-note {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 18px;
          align-items: stretch;
        }

        .footer-copy,
        .footer-tags {
          border-radius: 28px;
          padding: 20px 22px;
          background: rgba(255, 249, 252, 0.82);
          border: 1px solid rgba(202, 184, 216, 0.56);
        }

        .footer-copy p {
          margin: 0;
          font-size: 17px;
          line-height: 1.5;
          color: #5e4767;
        }

        .footer-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-content: start;
        }

        .footer-tag {
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(201, 181, 214, 0.58);
          font-size: 14px;
          font-weight: 700;
          color: #6a5674;
        }
      </style>
    </head>
    <body>
      <main class="board">
        <section class="hero">
          <div>
            <span class="eyebrow">${escapeHtml(scene.eyebrow)}</span>
            <h1>${escapeHtml(scene.title)}</h1>
            <p class="subtitle">${escapeHtml(scene.subtitle)}</p>
          </div>
          <aside class="metric-panel">${metrics}</aside>
        </section>

        <section class="cluster-grid">${clusters}</section>

        <section class="footer-note">
          <div class="footer-copy">
            <p>${escapeHtml(scene.footer)}</p>
          </div>
          <div class="footer-tags">
            <span class="footer-tag">Synonyme gebündelt</span>
            <span class="footer-tag">Paraphrasen erkannt</span>
            <span class="footer-tag">Themenlabels statt Stoppliste</span>
            <span class="footer-tag">Mehr Lehrwert fuer Hosts</span>
            <span class="footer-tag">Kurs 3: NLP + Evaluation</span>
          </div>
        </section>
      </main>
    </body>
  </html>`;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return await webkit.launch({ headless: true });
  }
}

async function ensureOutput(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function captureScene(browser, scene, targetPath) {
  await ensureOutput(targetPath);
  const page = await browser.newPage({ viewport: VIEWPORT });
  try {
    await page.setContent(renderScene(scene), { waitUntil: 'load' });
    const board = page.locator('.board');
    await board.waitFor({ state: 'visible', timeout: 30_000 });
    await board.screenshot({ path: targetPath });
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await launchBrowser();
  try {
    await captureScene(browser, QA_SCENE, QA_TARGET_SCREENSHOT);
    await captureScene(browser, QUIZ_SCENE, QUIZ_TARGET_SCREENSHOT);
  } finally {
    await browser.close();
  }

  console.log(
    JSON.stringify(
      {
        qaSemanticTarget: QA_TARGET_SCREENSHOT,
        quizSemanticTarget: QUIZ_TARGET_SCREENSHOT,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}