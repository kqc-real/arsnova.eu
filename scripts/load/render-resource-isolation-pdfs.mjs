#!/usr/bin/env node
/* global document */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { istDirekterAufruf } from './lib/resource-isolation-experiment.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sha256 = (daten) => createHash('sha256').update(daten).digest('hex');
const format = (wert) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    wert,
  );
const spanne = (werte) => `${format(Math.min(...werte))}–${format(Math.max(...werte))}`;

export function fuelleAbgabeVorlage(vorlage, werte) {
  const ersetzen = (wert) =>
    String(wert).replace(
      /[&<>"']/g,
      (zeichen) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[zeichen],
    );
  const ergebnis = vorlage.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_, name) => {
    const wert = werte[name];
    if (typeof wert !== 'string' && !(typeof wert === 'number' && Number.isFinite(wert)))
      throw new Error('Fehlender oder ungültiger Beleg für die Abgabevorlage.');
    return ersetzen(wert);
  });
  if (ergebnis.includes('{{')) throw new Error('Ungültiger Platzhalter in der Abgabevorlage.');
  return ergebnis;
}

async function main(args) {
  if (args.length !== 0)
    throw new Error(
      'Der Dokumentbau verwendet die versionierten A1-Quellen ohne zusätzliche Argumente.',
    );
  const ordner = join(root, 'docs/referat-thema-1/abgabe');
  const daten = await readFile(
    join(
      root,
      'docs/referat-thema-1/evidenz/1A/reihe-main-a19ca70f-20261115-122547/auswertung/auswertung.json',
    ),
  );
  const auswertung = JSON.parse(daten);
  if (
    auswertung.schemaVersion !== 1 ||
    auswertung.runs.length !== 25 ||
    auswertung.comparisons.length !== 80
  )
    throw new Error('Vollständige A1-Auswertung erforderlich.');
  const { chromium } = await import('playwright');
  const { PDFParse } = await import('pdf-parse');
  const { format: formatiere, resolveConfig } = await import('prettier');
  const formatierung = await resolveConfig(join(root, 'package.json'));
  const browser = await chromium.launch({ headless: true });
  await mkdir(join(ordner, 'grafiken'), { recursive: true });
  const manifest = {
    schemaVersion: 1,
    evaluationSha256: sha256(daten),
    rendererSha256: sha256(await readFile(new URL(import.meta.url))),
    artifacts: [],
  };
  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
    await page.route('**/*', (route) => route.abort());
    const nachVariante = (variant) =>
      auswertung.runs.filter((r) => r.variant === variant).sort((a, b) => a.block - b.block);
    const spacy = (variant) =>
      nachVariante(variant).map((r) => r.resources.find((c) => c.alias === 'spacy'));
    const farben = ['#555555', '#005a9c', '#237a3b', '#a65300', '#7b3294'];
    const zeichne = async (name, titel, einheit, datasets, maximum) => {
      await page.setContent(
        '<html lang="de"><body style="margin:0;background:white"><canvas id="grafik" width="1300" height="480"></canvas></body></html>',
      );
      await page.addScriptTag({
        content: await readFile(join(root, 'node_modules/chart.js/dist/chart.umd.js'), 'utf8'),
      });
      await page.evaluate(
        ({ titel, einheit, datasets, maximum }) => {
          // Chart.js zeichnet direkt aus den Zahlen der maschinenlesbaren Auswertung.
          new globalThis.Chart(document.querySelector('#grafik'), {
            type: 'line',
            data: { labels: ['Block 1', 'Block 2', 'Block 3', 'Block 4', 'Block 5'], datasets },
            options: {
              responsive: false,
              animation: false,
              devicePixelRatio: 1,
              elements: { point: { radius: 6 }, line: { borderWidth: 3 } },
              plugins: {
                title: { display: true, text: titel, font: { size: 25 } },
                legend: { labels: { font: { size: 20 }, usePointStyle: true } },
              },
              scales: {
                x: { ticks: { font: { size: 19 } } },
                y: {
                  beginAtZero: true,
                  max: maximum,
                  title: { display: true, text: einheit, font: { size: 20 } },
                  ticks: { font: { size: 18 } },
                },
              },
            },
          });
        },
        { titel, einheit, datasets, maximum },
      );
      const bild = await page.locator('#grafik').screenshot();
      await writeFile(join(ordner, 'grafiken', name), bild);
      manifest.artifacts.push({ file: `grafiken/${name}`, sha256: sha256(bild) });
      return `data:image/png;base64,${bild.toString('base64')}`;
    };
    const werte = {
      H1_FEHLER: auswertung.hypotheses.H1.failedComparisons,
      H2_FEHLER: auswertung.hypotheses.H2.failedComparisons,
      H1_STATUS: auswertung.hypotheses.H1.passed ? 'bestätigt' : 'nicht bestätigt',
      H2_STATUS: auswertung.hypotheses.H2.passed ? 'bestätigt' : 'nicht bestätigt',
      LIVE_GEPLANT: auswertung.runs.reduce(
        (s, r) => s + Object.values(r.live).reduce((a, b) => a + b.planned, 0),
        0,
      ),
      LIVE_ERFOLG: auswertung.runs.reduce(
        (s, r) => s + Object.values(r.live).reduce((a, b) => a + b.succeeded, 0),
        0,
      ),
      VOTE_MAX: format(Math.max(...auswertung.runs.map((r) => r.live.vote.p95Ms))),
      V2_CPU: spanne(spacy('V2').map((r) => r.cpuPercent)),
      V2_RAM: spanne(spacy('V2').map((r) => r.lifetimePeakMemoryBytes / 1048576)),
      V2_THROTTLE: spanne(spacy('V2').map((r) => r.throttledPeriodRatio * 100)),
      V3_THROTTLE: spanne(spacy('V3').map((r) => r.throttledPeriodRatio * 100)),
      V2_ANALYSE: spanne(nachVariante('V2').map((r) => r.analysis.successLatency.p95Ms)),
      V3_ANALYSE: spanne(nachVariante('V3').map((r) => r.analysis.successLatency.p95Ms)),
      V4_FALLBACK: spanne(nachVariante('V4').map((r) => r.analysis.fallbackLatency.p95Ms)),
      V2_ERFOLG: nachVariante('V2').reduce((s, r) => s + (r.analysis.outcomes.SUCCESS ?? 0), 0),
      V3_ERFOLG: nachVariante('V3').reduce((s, r) => s + (r.analysis.outcomes.SUCCESS ?? 0), 0),
      V3_ERSATZ: nachVariante('V3').reduce((s, r) => s + (r.analysis.outcomes.FALLBACK ?? 0), 0),
      V4_ERSATZ: nachVariante('V4').reduce((s, r) => s + (r.analysis.outcomes.FALLBACK ?? 0), 0),
      V4_WEITERGELEITET: nachVariante('V4').reduce((s, r) => s + r.proxy.forwarded, 0),
      V3_OFFEN: nachVariante('V3').reduce(
        (s, r) => s + (r.analysis.outcomes.IN_FLIGHT_AT_END ?? 0),
        0,
      ),
      V4_OFFEN: nachVariante('V4').reduce(
        (s, r) => s + (r.analysis.outcomes.IN_FLIGHT_AT_END ?? 0),
        0,
      ),
      QUELLE_SHA: sha256(daten).slice(0, 16),
    };
    const beispiel = auswertung.comparisons.find(
      (x) => x.block === 4 && x.variant === 'V2' && x.action === 'qaSubmit',
    );
    Object.assign(werte, {
      BEISPIEL_BASIS: format(beispiel.baseline.p95Ms),
      BEISPIEL_KANDIDAT: format(beispiel.candidate.p95Ms),
      BEISPIEL_MS: format(beispiel.absoluteChangeMs),
      BEISPIEL_PROZENT: format(beispiel.relativeChange * 100),
    });
    if (
      auswertung.source.identity.baselineCommit !== 'a19ca70ff37dcb5510a77ab2745c06b70ccc3565' ||
      auswertung.hypotheses.H1.failedComparisons !== 1 ||
      auswertung.hypotheses.H2.failedComparisons !== 6 ||
      auswertung.comparisons.filter((x) => !x.absolutePassed).length !== 3 ||
      werte.V3_ERFOLG !== 741 ||
      werte.V3_ERSATZ !== 6 ||
      werte.V3_OFFEN !== 3 ||
      auswertung.activationSupported ||
      auswertung.hypotheses.H1.passed ||
      auswertung.hypotheses.H2.passed ||
      !Object.values(auswertung.normalOperation).every(Boolean) ||
      werte.V4_WEITERGELEITET !== 0 ||
      werte.LIVE_ERFOLG !== werte.LIVE_GEPLANT
    )
      throw new Error(
        'Die Auswertung passt nicht zu den ausdrücklich auf diesen Befund begrenzten Abgabevorlagen.',
      );
    werte.LIVE_GRAFIK = await zeichne(
      'live-p95.png',
      'Quizstimme: p95 je Lauf',
      'Millisekunden',
      ['V0', 'V1', 'V2', 'V3', 'V4'].map((v, i) => ({
        label: v,
        data: nachVariante(v).map((r) => r.live.vote.p95Ms),
        borderColor: farben[i],
        pointStyle: ['circle', 'rect', 'triangle', 'rectRot', 'crossRot'][i],
      })),
      Math.ceil(Math.max(...auswertung.runs.map((r) => r.live.vote.p95Ms)) / 50) * 50,
    );
    werte.RAM_GRAFIK = await zeichne(
      'spacy-speicher.png',
      'spaCy: Lebenszeit-Speicherpeak einschließlich Aufwärmung',
      'MiB',
      [
        ...['V2', 'V3', 'V4'].map((v, i) => ({
          label: v,
          data: spacy(v).map((r) => r.lifetimePeakMemoryBytes / 1048576),
          borderColor: farben[i + 2],
        })),
        {
          label: 'V2-Budget: 80 % von 1 GiB',
          data: Array(5).fill(819.2),
          borderColor: '#333333',
          borderDash: [8, 6],
          pointRadius: 0,
        },
      ],
      1024,
    );
    werte.THROTTLE_GRAFIK = await zeichne(
      'spacy-drosselung.png',
      'spaCy: gedrosselte CPU-Perioden im Messfenster',
      'Prozent der Perioden',
      ['V2', 'V3', 'V4'].map((v, i) => ({
        label: v,
        data: spacy(v).map((r) => r.throttledPeriodRatio * 100),
        borderColor: farben[i + 2],
      })),
      100,
    );
    await page.emulateMedia({ media: 'print' });
    for (const [name, seiten] of [
      ['handout', 4],
      ['folien', 9],
    ]) {
      const vorlage = await readFile(join(ordner, 'vorlagen', `${name}.html`), 'utf8');
      const html = await formatiere(fuelleAbgabeVorlage(vorlage, werte), {
        ...formatierung,
        parser: 'html',
      });
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const ueberlauf = await page
        .locator('[data-page]')
        .evaluateAll((seiten) =>
          seiten.some(
            (seite) =>
              seite.scrollHeight > seite.clientHeight + 2 ||
              seite.scrollWidth > seite.clientWidth + 2,
          ),
        );
      if (ueberlauf) throw new Error('Abgabeinhalt überschreitet den vorgesehenen Seitenbereich.');
      await writeFile(join(ordner, `1A-${name}.html`), html);
      manifest.artifacts.push({ file: `1A-${name}.html`, sha256: sha256(html) });
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true });
      const parser = new PDFParse({ data: new Uint8Array(pdf) });
      let info;
      let text;
      try {
        info = await parser.getInfo();
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
      const woerter = text.trim().split(/\s+/).length;
      if (info.total !== seiten || (name === 'handout' && (woerter < 350 || woerter > 1800)))
        throw new Error(
          'PDF-Seitenzahl oder Handout-Wortumfang entspricht nicht dem vorgesehenen Format.',
        );
      await writeFile(join(ordner, `1A-${name}.pdf`), pdf);
      manifest.artifacts.push({
        file: `1A-${name}.pdf`,
        sha256: sha256(pdf),
        pages: info.total,
        words: woerter,
        templateSha256: sha256(vorlage),
      });
    }
    await writeFile(
      join(ordner, 'manifest.json'),
      await formatiere(JSON.stringify(manifest), { ...formatierung, parser: 'json' }),
    );
    process.stdout.write(
      'A1-Handout (4 Seiten), Folien (9 Seiten) und drei Grafiken erzeugt und geprüft.\n',
    );
  } finally {
    await browser.close();
  }
}

if (await istDirekterAufruf(new URL(import.meta.url))) {
  try {
    await main(process.argv.slice(2));
  } catch (fehler) {
    process.stderr.write(
      `A1-Dokumentbau fehlgeschlagen: ${fehler instanceof Error ? fehler.message : 'unbekannter Fehler'}\n`,
    );
    process.exitCode = 1;
  }
}
