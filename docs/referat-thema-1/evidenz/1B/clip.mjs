// Lehrenden-Clip für Folie J13 (Illustration, kein Nachweis; Design 2026-11-15, Wow-Element 4).
//
// Nimmt die echte Lehrenden-Ansicht im Browser auf: Moderationskompass öffnen, „Fragen
// zusammenfassen“ klicken, warten, Ergebnis zeigen. Die Wartezeit wird im Schnitt gerafft,
// Klick und Ergebnis bleiben in Echtzeit; nichts wird weggeschnitten.
//
// Ablauf (Protokoll: 2026-11-15-clip.md):
//   1. im app-host: node treiber.mjs --auftraege 0 --out /dev/null --zugang-datei ~/labor-1b/clip/zugang.json
//   2. Zugangsdatei auf den Rechner holen, SSH-Tunnel 3000-3002 auf 127.0.0.1 (ADR 1B-003)
//   3. node clip.mjs --zugang <datei> --out ~/labor-1b/clip
// Ausgabe nur im Laborordner: roh.webm, clip.webm, standbild.png, zeiten.json (ohne Token).
/* global console, localStorage, process, sessionStorage -- Node-Skript, addInitScript läuft im Browser */
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

// Segmente des Schnitts in Sekunden: bis 2 s nach dem Klick und ab 1 s vor dem Ergebnis in
// Echtzeit, dazwischen auf raffungS gerafft. Kurze Wartezeiten bleiben ungeschnitten.
export function schnittplan({ startMs = 0, klickMs, ergebnisMs, gesamtMs, raffungS }) {
  if (!(startMs <= klickMs && klickMs < ergebnisMs && ergebnisMs <= gesamtMs)) {
    throw new Error('Zeiten in falscher Reihenfolge (Klick < Ergebnis <= Ende)');
  }
  const s = (ms) => Math.round(ms / 100) / 10;
  const a = s(klickMs) + 2;
  const b = s(ergebnisMs) - 1;
  const ende = s(gesamtMs);
  if (b - a < raffungS * 1.5) {
    const vonS = s(startMs);
    return { segmente: [{ vonS, bisS: ende, faktor: 1 }], dauerS: ende - vonS, gerafftS: 0 };
  }
  const start = s(startMs);
  const segmente = [
    { vonS: start, bisS: a, faktor: 1 },
    { vonS: a, bisS: b, faktor: (b - a) / raffungS },
    { vonS: b, bisS: ende, faktor: 1 },
  ];
  return { segmente, dauerS: a - start + raffungS + (ende - b), gerafftS: b - a };
}

export function ffmpegFilter({ segmente }) {
  const teile = segmente.map(
    (g, i) =>
      `[0:v]trim=start=${g.vonS}:end=${g.bisS},setpts=(PTS-STARTPTS)/${Math.round(g.faktor * 1000) / 1000}[s${i}]`,
  );
  const namen = segmente.map((_, i) => `[s${i}]`).join('');
  return `${teile.join(';')};${namen}concat=n=${segmente.length}:v=1:a=0[v]`;
}

// Scrollt im Dialog zu den Hinweisen (dort steht der allgemeine Hinweis der Ersatzzusammenfassung)
// und hält das Bild als Standbild fest.
async function zeigeHinweise(page, out) {
  const hinweise = page.locator('.moderation-compass-dialog__summary-limitations');
  if (await hinweise.count()) {
    await hinweise.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }
  await page.waitForTimeout(4_000);
  await page.screenshot({
    path: join(out, 'standbild.png'),
    clip: { x: 216, y: 0, width: 848, height: 800 },
  });
}

async function oeffneHost({ zugang, url, out }) {
  const { chromium } = await import('playwright');
  const { code, hostToken, hostBrowserCapability } = zugang;
  const browser = await chromium.launch();
  const groesse = { width: 1280, height: 800 };
  const context = await browser.newContext({
    viewport: groesse,
    locale: 'de-DE',
    recordVideo: { dir: out, size: groesse },
  });
  await context.addInitScript(
    ([c, t, cap]) => {
      sessionStorage.setItem(`arsnova-host-token:${c}`, t);
      localStorage.setItem(`arsnova-host-browser-capability-${c}`, cap);
    },
    [code.toUpperCase(), hostToken, hostBrowserCapability],
  );
  const page = await context.newPage();
  await page.goto(`${url}/de/session/${code}/host?tab=qa`);
  return { page, context, browser };
}

async function aufnehmen({ zugang, url, out, warteMaxS }) {
  const t0 = Date.now();
  const { page, context, browser } = await oeffneHost({ zugang, url, out });
  const kompass = page.getByTestId('host-moderation-compass');
  await kompass.waitFor({ timeout: 60_000 });
  // Schnittbeginn: Lehrenden-Ansicht sichtbar (davor lädt die App die Startseite).
  const startMs = Math.max(0, Date.now() - t0 - 500);
  await page.waitForTimeout(2_000);
  await kompass.click();
  const knopf = page.locator('.moderation-compass-dialog__summary-button');
  await knopf.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  const klickMs = Date.now() - t0;
  await knopf.click();
  const fortschritt = page.locator('.moderation-compass-dialog__summary-progress');
  await fortschritt.waitFor({ timeout: 10_000 });
  await fortschritt.waitFor({ state: 'detached', timeout: warteMaxS * 1000 });
  const ergebnisMs = Date.now() - t0;
  await page.waitForTimeout(3_000);
  await zeigeHinweise(page, out);
  const aussagen = await page
    .locator('.moderation-compass-dialog__summary-statements li')
    .allInnerTexts();
  const hinweise = await page
    .locator('.moderation-compass-dialog__summary-limitations li')
    .allInnerTexts();
  const status = await page.locator('.moderation-compass-dialog__summary-status').allInnerTexts();
  const gesamtMs = Date.now() - t0;
  await context.close();
  await browser.close();
  const video = readdirSync(out).find(
    (f) => f.endsWith('.webm') && f !== 'clip.webm' && f !== 'roh.webm',
  );
  renameSync(join(out, video), join(out, 'roh.webm'));
  return {
    startMs,
    klickMs,
    ergebnisMs,
    gesamtMs,
    wartezeitS: (ergebnisMs - klickMs) / 1000,
    status,
    aussagen,
    hinweise,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values: arg } = parseArgs({
    options: {
      zugang: { type: 'string' },
      url: { type: 'string', default: 'http://127.0.0.1:3000' },
      out: { type: 'string' },
      'warte-max-s': { type: 'string', default: '900' },
      'raffung-s': { type: 'string', default: '4' },
    },
  });
  if (!arg.zugang || !arg.out) throw new Error('--zugang und --out nötig');
  mkdirSync(arg.out, { recursive: true });
  const zeiten = await aufnehmen({
    zugang: JSON.parse(readFileSync(arg.zugang, 'utf8')),
    url: arg.url,
    out: arg.out,
    warteMaxS: Number(arg['warte-max-s']),
  });
  const plan = schnittplan({ ...zeiten, raffungS: Number(arg['raffung-s']) });
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    join(arg.out, 'roh.webm'),
    '-filter_complex',
    // Auf den Dialog zuschneiden (848 × 800 ab x = 216), damit er auf der Folie lesbar bleibt.
    `${ffmpegFilter(plan)};[v]crop=848:800:216:0[c]`,
    '-map',
    '[c]',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '500k',
    '-deadline',
    'good',
    '-cpu-used',
    '4',
    '-row-mt',
    '1',
    '-an',
    join(arg.out, 'clip.webm'),
  ]);
  writeFileSync(join(arg.out, 'zeiten.json'), `${JSON.stringify({ ...zeiten, plan }, null, 2)}\n`);
  console.log(
    JSON.stringify({ wartezeitS: zeiten.wartezeitS, dauerS: plan.dauerS, gerafftS: plan.gerafftS }),
  );
}
