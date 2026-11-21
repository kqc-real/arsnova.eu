import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  FLAECHE,
  SYSTEM,
  abstimmungSvg,
  fussballfeldSvg,
  gateRasterSvg,
  systemSvg,
  kameraViewBox,
  logX,
  wegSvg,
  WEG_STATIONEN,
  zeitzerlegungSvg,
  zoomDeckkraft,
} from './grafik.mjs';
import { ladeFolienDaten } from './folien.mjs';
import { fmt } from './zahlen.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HIER, '../..');
const { b1, c1, auftrag } = ladeFolienDaten(ROOT);
const ACHSE = { x0: 250, x1: 1330, minMs: 0.1, maxMs: 1_000_000 };

const anzahl = (text, muster) => (text.match(muster) || []).length;

/** Gemeinsame Regeln für jede Grafik: Barrierefreiheit, Größen, explizite Farben. */
function pruefeSvg(svg) {
  assert.match(svg, /^<svg [^>]*role="img"/);
  assert.match(svg, /aria-label="[^"]{20,}"/);
  assert.match(svg, new RegExp(`viewBox="0 0 ${FLAECHE.breite} ${FLAECHE.hoehe}"`));
  for (const [, px] of svg.matchAll(/font-size="([\d.]+)"/g)) {
    assert.ok(Number(px) >= 22, `Schrift ${px} px < 22 px`);
  }
  for (const [, px] of svg.matchAll(/stroke-width="([\d.]+)"/g)) {
    assert.ok(Number(px) >= 2, `Linie ${px} px < 2 px`);
  }
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
  assert.doesNotMatch(svg, /currentColor/);
}

test('logX: 0,1 ms links, 1000 s rechts, eine Dekade = ein Siebtel', () => {
  assert.equal(logX(0.1, ACHSE), ACHSE.x0);
  assert.equal(logX(1_000_000, ACHSE), ACHSE.x1);
  const dekade = (ACHSE.x1 - ACHSE.x0) / 7;
  assert.ok(Math.abs(logX(1, ACHSE) - (ACHSE.x0 + dekade)) < 1e-9);
  assert.ok(Math.abs(logX(1000, ACHSE) - (ACHSE.x0 + 4 * dekade)) < 1e-9);
});

test('zeitzerlegungSvg: Werte, Schwellen und Gruppen der Mediane', () => {
  const svg = zeitzerlegungSvg(b1);
  pruefeSvg(svg);
  for (const t of ['0,43 ms', '17,8 ms', '101 ms', '148,3 s', 'Schwelle 50 ms', 'Schwelle 2 s']) {
    assert.ok(svg.includes(t), `fehlt: ${t}`);
  }
  assert.ok(svg.includes('99,92 %'));
  // Review Focus 1: Gruppen getrennt benannt (alle 10 vs. warm n = 9 vs. Kaltläufe).
  assert.ok(svg.includes('alle 10'));
  assert.ok(svg.includes('warm, n = 9'));
  assert.ok(svg.includes('200,5 s'));
  // M3: der Kaltbalken ist ein Median aus den Nachtragsläufen
  assert.ok(svg.includes('T_job kalt') && svg.includes('Median, n = 5'));
  assert.ok(svg.includes('langsame CPU')); // ADR 1B-008: Anteil nur mit Hinweis
  assert.ok(!zeitzerlegungSvg(b1, { kalt: false }).includes('200,5 s'));
  // Audit 2026-11-16: Punkte statt Balken (Log-Achse), kalter Auftrag als Bezugsmarke, nicht als Teil
  // Rechtecke nur weiß: Hintergrund und Felder hinter Beschriftungen, keine Balken
  assert.equal(
    anzahl(svg.replace(/<rect [^>]*fill="#ffffff"[^>]*\/>/g, ''), /<rect /g),
    0,
    'keine Balken',
  );
  assert.equal(anzahl(svg, /data-punkt="/g), 4);
  assert.equal(anzahl(svg, /data-bezug="kalt"/g), 1);
  assert.ok(svg.includes('Netz + Server ohne Inferenz'));
});

test('wegSvg: genau ein aktiver Marker, Stationen, Etiketten, Hosts, Messpunkte', () => {
  const svg = wegSvg({ aktiv: 'inferenz', b1, c1, auftrag });
  pruefeSvg(svg);
  assert.equal(anzahl(svg, /data-aktiv="/g), 1);
  assert.equal(anzahl(svg, /data-aktiv="inferenz"/g), 1);
  for (const s of ['klick', 'kontext', 'netz', 'inferenz', 'nachpruefung', 'gate']) {
    assert.equal(anzahl(svg, new RegExp(`data-station="${s}"`, 'g')), 1, s);
    assert.ok(WEG_STATIONEN[s], s);
  }
  assert.ok(svg.includes('192.168.150.10') && svg.includes('192.168.150.20'));
  assert.equal(anzahl(svg, /data-etikett="1C"/g), 4);
  assert.equal(anzahl(svg, /data-etikett="1B"/g), 2);
  assert.equal(anzahl(svg, /data-messpunkt="t[0-3]"/g), 4);
  // Fachliche Prüfung 1, W3: Werte des verfolgten Auftrags, 1C-Werte mit Herkunft, Netz unter der Auflösung.
  assert.ok(svg.includes(`${auftrag.hostReturnMs} ms`));
  // Runde 3, I3: am Kreis von Auftrag 2 steht sein eigener Anteil, nicht der Median aller 10
  const eigen = `${fmt((auftrag.inferMs / auftrag.jobMs) * 100, 2)} %`;
  assert.ok(svg.includes(`Anteil ${eigen}`), eigen);
  assert.ok(!svg.includes(`Anteil ${fmt(b1.inferAnteil * 100, 2)} %`));
  assert.ok(svg.includes(`Auftrag ${auftrag.nr}`));
  assert.equal(anzahl(svg, /data-herkunft="1"/g), 4);
  assert.ok(svg.includes('Netz &lt; 1 ms'));
  assert.ok(svg.includes('ein Rechner, Loopback'));
  assert.ok(!svg.includes('29,4 ms'), '1C-Klickwert auf dem app-host');

  for (const s of Object.keys(WEG_STATIONEN)) {
    const andere = wegSvg({ aktiv: s, b1, c1, auftrag });
    assert.equal(anzahl(andere, /data-aktiv="/g), 1, s);
    assert.ok(andere.includes(`data-aktiv="${s}"`));
  }
  assert.equal(anzahl(wegSvg({ aktiv: null, b1, c1, auftrag }), /data-aktiv="/g), 0);
  assert.throws(() => wegSvg({ aktiv: 'unbekannt', b1, c1, auftrag }));
  assert.throws(() => wegSvg({ aktiv: null, b1, c1 }), /verfolgten Auftrag/);
});

test('fussballfeldSvg: Maßstab aus T_job warm, Gruppen in der Bildunterschrift', () => {
  const svg = fussballfeldSvg(b1, { zoom: 0 });
  pruefeSvg(svg);
  for (const t of [
    '0,3 mm',
    '1,3 cm',
    '104,9 m',
    '148,6 s',
    'alle 10',
    'davon Netz',
    'langsame CPU',
  ]) {
    assert.ok(svg.includes(t), `fehlt: ${t}`);
  }
  assert.ok(svg.includes('warm, n = 9'));
});

test('fussballfeldSvg: Zoom 0 zeigt das ganze Feld, Zoom 1 die 0,3-mm-Marke', () => {
  const ganz = kameraViewBox(0);
  assert.ok(ganz.x <= -105_000 && ganz.x + ganz.w >= 0, 'ganzes Feld sichtbar');
  const nah = kameraViewBox(1);
  const netzMm = (b1.netzMs / b1.jobWarmMs) * 105_000;
  assert.ok(nah.x < -netzMm && nah.x + nah.w > 0, 'Netzmarke vollständig sichtbar');
  assert.ok(netzMm / nah.w > 0.15, 'Netzmarke deutlich sichtbar (> 15 % der Bildbreite)');
  // Monoton: die Bildbreite schrumpft mit dem Zoom.
  let vorher = Infinity;
  for (let z = 0; z <= 1.0001; z += 0.1) {
    const v = kameraViewBox(z);
    assert.ok(v.w < vorher);
    vorher = v.w;
  }
  const s1 = fussballfeldSvg(b1, { zoom: 1 });
  const vb = kameraViewBox(1);
  assert.ok(s1.includes(`viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}"`));
  assert.throws(() => fussballfeldSvg(b1, { zoom: 1.5 }));
});

test('stil.css: Schriften laden wirklich (keine stille Ersatzschrift)', async () => {
  const css = readFileSync(join(HIER, 'stil.css'), 'utf8');
  const urls = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]);
  assert.equal(urls.length, 6);
  for (const u of urls) {
    assert.ok(!/^https?:/.test(u), `extern: ${u}`);
    assert.ok(existsSync(join(HIER, u)), `fehlt: ${u}`);
  }
  for (const t of ['#0b5ea8', '#0f766e', '#b45309', '#b42318']) assert.ok(css.includes(t), t);

  const require = createRequire(resolve(ROOT, '../../package.json'));
  const { chromium } = require('playwright');
  const tmp = mkdtempSync(join(tmpdir(), 'grafik-'));
  const browser = await chromium.launch();
  try {
    const seite = (kopf) =>
      `<!doctype html><html><head><meta charset="utf-8">${kopf}</head>` +
      `<body><p style="font:600 24px Inter">Aa</p><p style="font:400 24px 'IBM Plex Mono'">0,43</p></body></html>`;
    const pruefe = async (datei) => {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(datei).href);
      const r = await page.evaluate(async () => {
        await Promise.allSettled([
          document.fonts.load('600 24px Inter'),
          document.fonts.load('400 24px "IBM Plex Mono"'),
        ]);
        await document.fonts.ready;
        const geladen = [...document.fonts]
          .filter((f) => f.status === 'loaded')
          .map((f) => `${f.family.replace(/"/g, '')} ${f.weight}`);
        return {
          inter: document.fonts.check('600 24px Inter'),
          mono: document.fonts.check('400 24px "IBM Plex Mono"'),
          geladen,
        };
      });
      await page.close();
      return r;
    };

    const gut = join(tmp, 'gut.html');
    writeFileSync(
      gut,
      seite(`<link rel="stylesheet" href="${pathToFileURL(join(HIER, 'stil.css'))}">`),
    );
    const r = await pruefe(gut);
    assert.equal(r.inter, true);
    assert.equal(r.mono, true);
    // check() ist auch wahr, wenn keine Schrift passt; deshalb die geladenen Faces prüfen.
    assert.ok(r.geladen.includes('Inter 600'), r.geladen.join());
    assert.ok(r.geladen.includes('IBM Plex Mono 400'), r.geladen.join());

    // Gegenprobe: dieselbe CSS ohne erreichbare Dateien muss auffallen.
    const kaputt = join(tmp, 'kaputt.html');
    writeFileSync(kaputt, seite(`<style>${css}</style>`));
    const k = await pruefe(kaputt);
    assert.equal(k.inter, false);
    assert.ok(!k.geladen.includes('Inter 600'));
  } finally {
    await browser.close();
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('fussballfeldSvg: Feldbeschriftungen nur in ihrem Zoombereich sichtbar', () => {
  assert.equal(zoomDeckkraft(0, 0, 0.12), 1);
  assert.equal(zoomDeckkraft(0.5, 0, 0.12), 0);
  assert.equal(zoomDeckkraft(1, 0.92, 1), 1);
  assert.equal(zoomDeckkraft(0.85, 0.92, 1), 0);
  assert.ok(zoomDeckkraft(0.93, 0.92, 1) > 0 && zoomDeckkraft(0.93, 0.92, 1) < 1);
  const deckkraft = (svg, inhalt) => {
    const g = svg.split('<g ').find((t) => t.includes(inhalt) && t.includes('data-zoom-von'));
    return Number(g.match(/opacity="([\d.]+)"/)[1]);
  };
  const s085 = fussballfeldSvg(b1, { zoom: 0.85 });
  assert.equal(deckkraft(s085, 'Transport · 1,3 cm'), 0);
  assert.equal(deckkraft(s085, 'Netz · 0,3 mm'), 0);
  assert.equal(deckkraft(fussballfeldSvg(b1, { zoom: 1 }), 'Netz · 0,3 mm'), 1);
  assert.equal(deckkraft(fussballfeldSvg(b1, { zoom: 0 }), 'Inferenz · 104,9 m'), 1);
});

test('fussballfeldSvg: Kennzahlen unter dem Feld erscheinen mit ihrer Zoomstufe', () => {
  // Deckkraft der Spalte (Gruppe mit data-spalte); ohne Gruppe gilt sie als immer sichtbar.
  const spalte = (svg, name) => {
    const g = svg.match(new RegExp(`<g data-spalte="${name}"[^>]*>`));
    assert.ok(g, `Spalte ${name} fehlt`);
    const o = g[0].match(/opacity="([\d.]+)"/);
    return o ? Number(o[1]) : 1;
  };
  const bei = (zoom) => {
    const svg = fussballfeldSvg(b1, { zoom });
    return ['inferenz', 'transport', 'netz'].map((n) => spalte(svg, n));
  };
  assert.deepEqual(bei(0), [1, 0, 0], 'Feld: nur Inferenz');
  assert.deepEqual(bei(0.42), [1, 0, 0], '1 m: noch kein Transport');
  assert.deepEqual(bei(0.67), [1, 1, 0], 'Transport lesbar: Transport dazu');
  assert.deepEqual(bei(1), [1, 1, 1], '0,3 mm: alle (auch im Druck)');
  // Die Spalte bleibt sichtbar, wenn die Feldbeschriftung weiterzoomt (kein Ausblenden nach oben).
  assert.deepEqual(bei(0.85), [1, 1, 0]);
  const svg1 = fussballfeldSvg(b1, { zoom: 1 });
  assert.match(svg1, /<g data-spalte="transport" data-zoom-von="0\.58" data-zoom-bis="1"/);
  assert.match(svg1, /<g data-spalte="netz" data-zoom-von="0\.92" data-zoom-bis="1"/);
});

test('lupeRahmen: Übersichtskarte zeigt den Ausschnitt, nie kleiner als ein gut sichtbarer Rahmen', async () => {
  const { lupeRahmen, kameraViewBox: vb } = await import('./grafik.mjs');
  const ganz = vb(0);
  // Ganzes Feld: Rahmen = Fenster
  assert.deepEqual(lupeRahmen(0), ganz);
  // Tiefster Zoom: Mindestgröße 4 % der Kartenbreite, zentriert auf den Ausschnitt
  const r = lupeRahmen(1);
  const v = vb(1);
  assert.ok(Math.abs(r.w - ganz.w * 0.04) < 1e-6);
  assert.ok(Math.abs(r.x + r.w / 2 - (v.x + v.w / 2)) < 1e-6);
  assert.ok(Math.abs(r.y + r.h / 2 - (v.y + v.h / 2)) < 1e-6);
  assert.ok(Math.abs(r.h / r.w - ganz.h / ganz.w) < 1e-9);
});

test('fussballfeldSvg: Übersichtskarte mit Lupenrahmen, erst ab der ersten Zoomstufe sichtbar', async () => {
  const { fussballfeldSvg } = await import('./grafik.mjs');
  const daten = ladeFolienDaten(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  const svg = fussballfeldSvg(daten.b1, { zoom: 0 });
  assert.match(svg, /<g data-uebersicht data-zoom-von="0\.05" data-zoom-bis="1" opacity="0"/);
  assert.match(svg, /<rect data-lupe /);
  assert.match(
    fussballfeldSvg(daten.b1, { zoom: 1 }),
    /<g data-uebersicht data-zoom-von="0\.05" data-zoom-bis="1" opacity="1"/,
  );
});

test('fussballfeldSvg: Linie bis zur Torlinie geschlossen, Rest der Jobzeit beschriftet (Stufe 1)', async () => {
  const { fussballfeldSvg } = await import('./grafik.mjs');
  const svg = fussballfeldSvg(b1, { zoom: 0.421 });
  // Abschnitt zwischen Inferenzende und Transportbeginn (übrige Jobzeit, App und Adapter)
  assert.match(svg, /data-strecke="rest"/);
  const rest = 105 - 105 * b1.inferAnteil - (b1.transportMs * 105) / b1.jobWarmMs;
  assert.match(svg, new RegExp(`übrige Jobzeit · ${fmt(rest * 100, 1)} cm`));
  assert.match(svg, /Inferenz endet hier/);
});

// ---------------------------------------------------------------- Ergänzt 2026-11-16: GK, J12, J13

/** Regeln wie pruefeSvg, aber mit eigener viewBox. */
function pruefeFrei(svg) {
  assert.match(svg, /^<svg [^>]*role="img"/);
  assert.match(svg, /aria-label="[^"]{20,}"/);
  for (const [, px] of svg.matchAll(/font-size="([\d.]+)"/g))
    assert.ok(Number(px) >= 22, `Schrift ${px}`);
  for (const [, px] of svg.matchAll(/stroke-width="([\d.]+)"/g))
    assert.ok(Number(px) >= 2, `Linie ${px}`);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity|\sid="/);
}

test('GK systemSvg: drei Stufen in Fahrplanfolge, Auslegung aus FESTWERTE, Bausteine im Rahmen', () => {
  const svg = systemSvg({ clients: 500 });
  pruefeFrei(svg);
  assert.match(svg, new RegExp(`viewBox="0 0 ${SYSTEM.breite} ${SYSTEM.hoehe}"`));
  const stufen = [...svg.matchAll(/data-ab="(\d)" data-teil-system="([^"]+)"/g)].map((m) => [
    m[1],
    m[2],
  ]);
  assert.deepEqual(stufen, [
    ['1', '1a'],
    ['2', 'jonas'],
    ['3', '1b34'],
  ]);
  assert.match(svg, /≥ 500/);
  for (const w of [
    'Hörsaal',
    'App-Host',
    'Moderationskompass',
    'spaCy-Sidecar',
    'Kontextpfad',
    'Zweiter Host',
    'Inferenz',
  ])
    assert.ok(svg.includes(w), w);
  // Bausteine liegen im App-Host bzw. im zweiten Host
  const drin = (a, b) =>
    a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
  for (const k of ['live', 'kompass', 'spacy', 'kontext'])
    assert.ok(drin(SYSTEM[k], SYSTEM.app), k);
  assert.ok(drin(SYSTEM.inferenz, SYSTEM.llm));
});

test('GK systemSvg: Hörsaal (+Lehrperson) → Live-App, eigener Kasten Lehrperson → Kompass (Durchsicht 2026-11-18)', () => {
  const svg = systemSvg({ clients: 500 });
  const gruppe = (name) => {
    const m = svg.match(new RegExp(`<g data-kasten="${name}">([\\s\\S]*?)</g>`));
    assert.ok(m, `Kasten ${name}`);
    return m[1];
  };
  const textVon = (g) => [...g.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' ');
  const hoersaal = gruppe('hoersaal');
  const lehrperson = gruppe('lehrperson');
  assert.match(textVon(hoersaal), /^Hörsaal \(\+Lehrperson\) ≥ 500/);
  assert.equal(textVon(lehrperson), 'Lehrperson');
  assert.equal((hoersaal.match(/<rect/g) ?? []).length, 1);
  assert.equal((lehrperson.match(/<rect/g) ?? []).length, 1);
  // Kästen überlappen nicht, Lehrperson unter dem Hörsaal
  const H = SYSTEM.hoersaal;
  const L = SYSTEM.lehrperson;
  assert.ok(L.y >= H.y + H.h + 8, 'Lehrperson unter dem Hörsaal');
  // Pfeile: Hörsaal → Live-App, Lehrperson → Kompass, je auf Höhe beider Kästen
  const pfeile = [...svg.matchAll(/<g data-pfeil="(\w+)-(\w+)" data-y="([\d.]+)">/g)].map((m) => [
    m[1],
    m[2],
    Number(m[3]),
  ]);
  assert.deepEqual(
    pfeile.map(([a, b]) => `${a}-${b}`),
    ['hoersaal-live', 'lehrperson-kompass'],
  );
  for (const [von, nach, y] of pfeile) {
    for (const b of [SYSTEM[von], SYSTEM[nach]])
      assert.ok(
        y > b.y + 10 && y < b.y + b.h - 10,
        `${von}-${nach}: y=${y} trifft ${JSON.stringify(b)}`,
      );
  }
});

test('J12 abstimmungSvg: Zeiten des Auftrags, Stimme (Stufe 1) und Verwurf (Stufe 2)', () => {
  const svg = abstimmungSvg({ auftrag });
  pruefeFrei(svg);
  assert.ok(svg.includes(`Inferenz ${fmt(auftrag.inferMs / 1000, 1)} s`));
  assert.ok(svg.includes(`Host frei nach ${fmt(auftrag.hostReturnMs)} ms`));
  assert.match(
    svg,
    /<g data-ab="1">[^]*Zeitpunkt gedacht[^]*<\/g><g data-ab="2">[^]*source_changed/,
  );
});

test('J13 gateRasterSvg: ein Feld je geprüfter Antwort, rot erst in Stufe 1', () => {
  const svg = gateRasterSvg({ n1B: b1.verworfen, n1C: c1.gateAntwortenGesamt.wert });
  pruefeFrei(svg);
  const n = b1.verworfen + c1.gateAntwortenGesamt.wert;
  const [vorher, rot] = svg.split('<g data-ab="1"');
  assert.equal(anzahl(vorher, /<rect x="\d+" y="\d+" width="20"/g), n);
  assert.equal(anzahl(rot, /fill="#b42318"/g), n);
});
