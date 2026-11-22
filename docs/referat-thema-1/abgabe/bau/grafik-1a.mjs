// Diagramme für Niklas' Folien 1A im Stil von Jonas' Deck (grafik.mjs: Breite 1380, Schrift mindestens
// 22 px, Linien mindestens 2 px, keine IDs). Jede Zahl kommt aus daten-1a.mjs. Punkte statt Balken,
// direkte Beschriftung statt Legende, eine Akzentfarbe je Aussage (Leitfaden C11–C16).

import { FARBEN, esc, text } from './grafik.mjs';
import { fmt } from './zahlen.mjs';
import { AKTIONEN } from './daten-1a.mjs';

const BREITE = 1380;
const r2 = (n) => Math.round(n * 100) / 100;

/** SVG-Hülle wie svgHuelle in grafik.mjs, aber mit eigener Höhe (Breite bleibt 1380). */
export function huelle(label, inhalt, hoehe = 560) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BREITE} ${hoehe}" ` +
    `role="img" aria-label="${esc(label)}">` +
    `<rect width="${BREITE}" height="${hoehe}" fill="${FARBEN.weiss}"/>${inhalt}</svg>`
  );
}

const linie = (x1, y1, x2, y2, farbe, breite = 2, extra = '') =>
  `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${farbe}" stroke-width="${breite}"${extra}/>`;
const punkt = (x, y, r, farbe, deckkraft = 1) =>
  `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r}" fill="${farbe}"${deckkraft < 1 ? ` fill-opacity="${deckkraft}"` : ''}/>`;
const gruppe = (ab, inhalt, { bis, klasse = 'aufbau-text' } = {}) =>
  `<g data-ab="${ab}"${bis === undefined ? '' : ` data-bis="${bis}"`} class="${klasse}">${inhalt}</g>`;

// ------------------------------------------------------------------ N3 Lastprofil

/** Zeitachse des Lastprofils: Aufwärmen, Beitrittswelle, Analyseabrufe, Ergebnisfreigabe. */
export function profilSvg(d) {
  const p = d.konfig.profil;
  const H = 250;
  const x0 = 250;
  const x1 = 1330;
  const fenster = p.durationMs / 1000;
  const vor = p.warmupMs / 1000;
  const sx = (s) => x0 + ((s + vor) / (fenster + vor)) * (x1 - x0);
  const t = [];
  const y = 100;
  // Aufwärmen
  t.push(
    `<rect x="${sx(-vor)}" y="${y - 34}" width="${r2(sx(0) - sx(-vor))}" height="68" rx="6" fill="${FARBEN.raster}"/>`,
  );
  t.push(
    text((sx(-vor) + sx(0)) / 2, y + 8, `${fmt(vor)} s warm`, {
      groesse: 22,
      anker: 'middle',
      farbe: FARBEN.text2,
    }),
  );
  // Messfenster
  t.push(
    `<rect x="${sx(0)}" y="${y - 34}" width="${r2(sx(fenster) - sx(0))}" height="68" rx="6" fill="none" stroke="${FARBEN.linie}" stroke-width="2"/>`,
  );
  // Beitrittswelle
  t.push(
    `<rect x="${sx(0)}" y="${y - 34}" width="${r2(sx(p.rampMs / 1000) - sx(0))}" height="68" rx="6" fill="#e6f0fa"/>`,
  );
  t.push(
    text(sx(0) + 14, y + 8, `${fmt(p.participants)} Beitritte in ${fmt(p.rampMs / 1000)} s`, {
      groesse: 24,
      gewicht: 700,
      farbe: FARBEN.blau,
    }),
  );
  t.push(
    text(sx(p.rampMs / 1000) + 16, y + 8, 'dann Quiz, Tempo und Q&amp;A je Person', {
      groesse: 22,
      farbe: FARBEN.text2,
    }),
  );
  // Analyseabrufe: alle 2 s ein Strich (5 Lehrende, je alle 10 s)
  const takt = fenster / (d.analyseGeplantJeVariante / 5);
  for (let s = 0; s < fenster; s += takt)
    t.push(linie(sx(s), y + 46, sx(s), y + 62, FARBEN.gedaempft, 2));
  t.push(
    text(
      sx(0),
      y + 94,
      `Analyseabruf alle ${fmt(takt)} s (${d.konfig.hosts} Lehrende, je alle ${fmt(takt * d.konfig.hosts)} s)`,
      {
        groesse: 22,
        farbe: FARBEN.text2,
      },
    ),
  );
  // Freigabe
  const rv = p.revealAtMs / 1000;
  t.push(linie(sx(rv), y - 50, sx(rv), y + 34, FARBEN.tinte, 3));
  t.push(text(sx(rv), y - 58, 'Freigabe', { groesse: 22, gewicht: 600, anker: 'middle' }));
  // Achse
  for (const s of [0, p.rampMs / 1000, rv, fenster]) {
    t.push(
      text(sx(s), y + 136, `${fmt(s)} s`, {
        groesse: 22,
        anker: 'middle',
        farbe: FARBEN.gedaempft,
        mono: true,
      }),
    );
  }
  t.push(text(0, y + 8, 'Ein Lauf', { groesse: 26, gewicht: 700 }));
  t.push(text(0, y + 40, `${fmt(fenster)} s Fenster`, { groesse: 22, farbe: FARBEN.gedaempft }));
  return huelle(
    `Lastprofil je Lauf: ${vor} s Aufwärmen, ${fenster} s Messfenster, ${p.participants} Beitritte in ${p.rampMs / 1000} s, Analyse alle ${takt} s, Freigabe bei ${rv} s.`,
    t.join(''),
    H,
  );
}

// ------------------------------------------------------------------ N5 Live-p95 je Lauf

/**
 * p95 je Lauf und Aktion als Punkte auf linearer Achse 0 bis 1000 ms (ehrliche Achse: das Quiz-Ziel
 * steht als Linie am rechten Rand). Ein Punkt je Lauf; der höchste Quiz-Lauf ist beschriftet.
 */
export function liveSvg(d) {
  const H = 500;
  const x0 = 330;
  const x1 = 1300;
  const max = d.schwellen.quizZielMs;
  const sx = (ms) => x0 + (ms / max) * (x1 - x0);
  const y0 = 70;
  const zeileH = 92;
  const t = [];
  const yAchse = y0 + AKTIONEN.length * zeileH - 20;
  for (const s of [0, 250, 500, 750, 1000]) {
    t.push(linie(sx(s), y0 - 30, sx(s), yAchse, FARBEN.raster, 2));
    t.push(
      text(sx(s), yAchse + 34, `${fmt(s)} ms`, {
        groesse: 22,
        anker: 'middle',
        farbe: FARBEN.gedaempft,
        mono: true,
      }),
    );
  }
  t.push(linie(x0, yAchse, x1, yAchse, FARBEN.linie, 2));
  const quizMax = d.laufP95.reduce((m, l) => (l.p95.vote > m.p95.vote ? l : m));
  AKTIONEN.forEach(([k, name], zi) => {
    const y = y0 + zi * zeileH + 20;
    const z = d.live.jeAktion[k];
    t.push(text(0, y + 2, esc(name), { groesse: 28, gewicht: 700 }));
    t.push(
      text(0, y + 32, `${fmt(z.erfolgreich)} / ${fmt(z.geplant)} erfolgreich`, {
        groesse: 22,
        farbe: FARBEN.gedaempft,
      }),
    );
    for (const l of d.laufP95) {
      const hervor = k === 'vote' && l === quizMax;
      t.push(
        punkt(
          sx(l.p95[k]),
          y + (l.block - 3) * 5,
          hervor ? 11 : 9,
          hervor ? FARBEN.blau : FARBEN.gedaempft,
          hervor ? 1 : 0.45,
        ),
      );
    }
    if (k === 'vote') {
      t.push(
        text(sx(quizMax.p95.vote) + 22, y + 9, `höchster Lauf ${fmt(quizMax.p95.vote)} ms`, {
          groesse: 24,
          gewicht: 700,
          farbe: FARBEN.blau,
        }),
      );
      // Ziel nur für das Quiz vorab festgelegt
      t.push(linie(sx(max), y - 34, sx(max), y + 34, FARBEN.rot, 3, ' stroke-dasharray="8 6"'));
      t.push(
        text(sx(max) - 12, y - 40, `Ziel Quiz ≤ ${fmt(max)} ms, vorab`, {
          groesse: 22,
          gewicht: 600,
          anker: 'end',
          farbe: FARBEN.rot,
        }),
      );
    }
  });
  t.push(
    text(
      x0,
      H - 6,
      `p95 je Lauf, linear · ein Punkt je Lauf (${fmt(d.live.laeufe)} Läufe, alle Varianten)`,
      {
        groesse: 22,
        farbe: FARBEN.gedaempft,
      },
    ),
  );
  return huelle(
    `p95 der vier Live-Aktionen je Lauf: alle weit unter ${max} ms, höchster Quiz-Lauf ${fmt(quizMax.p95.vote)} ms; alle ${fmt(d.live.erfolgreich)} Aktionen erfolgreich.`,
    t.join(''),
    H,
  );
}

// ------------------------------------------------------------------ N6 Vergleichsmatrix

/** Aufbaustufe je Zeile (N6 baut auf Tastendruck auf): Kontrolle, dann kleine Treffer, dann V3. */
export const AUFBAU_STUFE = { V1: 1, V2: 2, V4: 2, V3: 3 };

const ZEILEN = [
  ['V1', 'gg. V0', 'Kontrolle, ohne spaCy'],
  ['V2', 'gg. V1', 'H1, spaCy normal'],
  ['V3', 'gg. V1', 'H2, gedrosselt'],
  ['V4', 'gg. V1', 'H2, hinter Timeout'],
];

/**
 * Alle 80 gepaarten Vergleiche als Raster: Zeile = Variante gegen ihre Basis, Spalten = Block 1–5 mit
 * je vier Aktionen. Grau hält; Bernstein verfehlt nur die relative Regel (+10 %); Rot auch die
 * absolute (+50 ms). In verfehlten Zellen steht der p95-Anstieg in ms.
 */
export function vergleichsMatrixSvg(daten) {
  const zelle = { b: 50, h: 60, luecke: 4, block: 14 };
  const x0 = 262;
  const y0 = 60;
  const zeileH = 76;
  const blockB = 4 * zelle.b + 3 * zelle.luecke;
  const teile = [];
  const proStufe = {}; // Staffelung: Zellen einer Stufe erscheinen kurz nacheinander
  const haltende = []; // graue Füllung der haltenden Zellen, erscheint mit Stufe 1

  for (let b = 1; b <= 5; b++) {
    const bx = x0 + (b - 1) * (blockB + zelle.block);
    teile.push(
      text(bx + blockB / 2, y0 - 20, `Block ${b}`, {
        groesse: 24,
        gewicht: 600,
        anker: 'middle',
        farbe: FARBEN.text2,
      }),
    );
  }
  ZEILEN.forEach(([v, gegen, rolle], zi) => {
    const y = y0 + zi * zeileH;
    teile.push(text(0, y + 28, `${v} ${gegen}`, { groesse: 24, gewicht: 700 }));
    teile.push(text(0, y + 54, rolle, { groesse: 22, farbe: FARBEN.gedaempft }));
    for (let b = 1; b <= 5; b++) {
      const bx = x0 + (b - 1) * (blockB + zelle.block);
      AKTIONEN.forEach(([aktion], ai) => {
        const c = daten.vergleiche.find(
          (x) => x.variante === v && x.block === b && x.aktion === aktion,
        );
        if (!c) throw new Error(`grafik-1a: Vergleich ${v}/${b}/${aktion} fehlt`);
        const x = bx + ai * (zelle.b + zelle.luecke);
        // Grundzelle als neutraler Umriss: Stufe 0 behauptet noch kein Ergebnis. Ab Stufe 1 füllen sich
        // die haltenden Zellen grau (eine Gruppe, s. u.), verfehlte färben sich auf ihrer Aufbaustufe.
        teile.push(
          `<rect x="${x}" y="${y}" width="${zelle.b}" height="${zelle.h}" rx="5" fill="none" stroke="${FARBEN.linie}" stroke-width="2"/>`,
        );
        if (c.bestanden) {
          haltende.push(
            `<rect x="${x}" y="${y}" width="${zelle.b}" height="${zelle.h}" rx="5" fill="${FARBEN.raster}"/>`,
          );
        }
        if (!c.bestanden) {
          const absolut = !c.absolutBestanden;
          const nr = (proStufe[AUFBAU_STUFE[v]] = (proStufe[AUFBAU_STUFE[v]] ?? -1) + 1);
          teile.push(
            `<g data-ab="${AUFBAU_STUFE[v]}" class="aufbau-zelle" style="transition-delay:${nr * 60}ms">` +
              `<rect x="${x}" y="${y}" width="${zelle.b}" height="${zelle.h}" rx="5" ` +
              `fill="${absolut ? FARBEN.rot : FARBEN.bernsteinHell}" stroke="${absolut ? FARBEN.rot : FARBEN.bernstein}" stroke-width="2"/>` +
              text(x + zelle.b / 2, y + zelle.h / 2 + 8, `${Math.round(c.deltaMs)}`, {
                groesse: 22,
                gewicht: 600,
                mono: true,
                anker: 'middle',
                farbe: absolut ? FARBEN.weiss : FARBEN.bernsteinText,
              }) +
              '</g>',
          );
        }
      });
    }
  });

  // Erklärung der Spalten und Legende
  const ly = y0 + 4 * zeileH + 26;
  teile.push(
    text(
      x0,
      ly,
      `Spalten je Block: ${AKTIONEN.map(([, n]) => esc(n)).join(' · ')} · Zahl = Anstieg des p95 in ms`,
      { groesse: 22, farbe: FARBEN.gedaempft },
    ),
  );
  const leg = [
    [FARBEN.raster, 'none', 'hält die Regel'],
    [
      FARBEN.bernsteinHell,
      FARBEN.bernstein,
      `verfehlt nur +${fmt(daten.schwellen.relativ * 100)} %`,
    ],
    [FARBEN.rot, FARBEN.rot, `verfehlt auch +${fmt(daten.schwellen.absolutMs)} ms`],
  ];
  let lx = x0;
  const legY = ly + 22;
  leg.forEach(([f, r, t], i) => {
    const eintrag =
      `<rect x="${lx}" y="${legY}" width="30" height="30" rx="4" fill="${f}"` +
      (r === 'none' ? '' : ` stroke="${r}" stroke-width="2"`) +
      '/>' +
      text(lx + 42, legY + 24, esc(t), { groesse: 22, farbe: FARBEN.text2 });
    // „hält die Regel“ erscheint erst mit den grauen Zellen (Stufe 1), sonst behauptete Stufe 0 80 × „hält“.
    if (i === 0) haltende.push(eintrag);
    else teile.push(eintrag);
    lx += 42 + t.length * 12 + 56;
  });
  teile.push(`<g data-ab="1" class="aufbau-zelle">${haltende.join('')}</g>`);

  // Eine Zeile Erklärung je Aufbaustufe, an derselben Stelle (die vorige blendet aus).
  const fehlVon = (vs) =>
    daten.vergleiche.filter(
      (x) => vs.includes(x.variante) && !x.bestanden && !(x.variante === 'V3' && x.block === 5),
    );
  const spanne = (l) =>
    `+${fmt(Math.min(...l.map((x) => x.deltaMs)), 1)} bis +${fmt(Math.max(...l.map((x) => x.deltaMs)), 1)} ms`;
  const kontrolle = fehlVon(['V1']);
  const kleine = fehlVon(['V2', 'V3', 'V4']);
  const v3b5 = daten.vergleiche.filter((x) => x.variante === 'V3' && x.block === 5);
  const stufenText = [
    `${daten.vergleiche.length} gepaarte Vergleiche: jede Aktion, jeder Block, gegen die eigene Basis`,
    `Schon ohne spaCy verfehlt die Kontrolle die Regel ${kontrolle.length}-mal: ${spanne(kontrolle)}`,
    `Mit spaCy kommen ${kleine.length} ebenso kleine Treffer dazu: ${spanne(kleine)}`,
    `Gedrosselt (V3), letzter Lauf: ${v3b5.filter((x) => !x.bestanden).length} Treffer, ${v3b5.filter((x) => !x.absolutBestanden).length} davon über +${fmt(daten.schwellen.absolutMs)} ms (bis +${fmt(daten.v3Block5MaxDeltaMs)} ms)`,
  ];
  stufenText.forEach((t, k) => {
    teile.push(
      gruppe(
        k,
        text(0, legY + 92, esc(t), {
          groesse: 28,
          gewicht: 700,
          farbe: k === 3 ? FARBEN.rot : FARBEN.tinte,
        }),
        { bis: k < stufenText.length - 1 ? k : undefined },
      ),
    );
  });

  const fehl = daten.vergleiche.filter((x) => !x.bestanden).length;
  return huelle(
    `Raster der ${daten.vergleiche.length} gepaarten Vergleiche: ${fehl} verfehlen die Regel, deutlich nur V3 in Block 5.`,
    teile.join(''),
    legY + 110,
  );
}

// ------------------------------------------------------------------ N7 Ausreißer V3/Block 5

/**
 * Zeitverlauf des letzten Laufs (V3, Block 5), 0–120 s des Messfensters, drei Spuren übereinander:
 * Beitrittslatenz je Beitritt (Zeit ≈ Ankunft, Näherung), Analyseaufrufe der fünf Lehrenden
 * (Timeout rot, Gegendruck Bernstein), CPU von App und PostgreSQL. Stufen: 0 Latenz, 1 Analyse,
 * 2 CPU. Explorativ, nachträglich ausgewertet.
 */
export function ausreisserSvg(d) {
  const e = d.explorativ;
  const H = 620;
  const x0 = 300;
  const x1 = 880;
  const bisS = 120;
  const xr = x1 + 34; // Beschriftungen rechts neben den Spuren
  const sx = (s) => x0 + (s / bisS) * (x1 - x0);
  const t = [];
  const [f0, f1] = e.fenster;
  // Spur A: Beitritte
  const aOben = 20;
  const aUnten = 230;
  const aMax = 1200;
  const sy = (ms) => aUnten - (Math.min(ms, aMax) / aMax) * (aUnten - aOben);
  // Spur B: Analyse
  const bOben = 290;
  const bahn = 22;
  // Spur C: CPU
  const cOben = 430;
  const cUnten = 540;
  const cy = (p) => cUnten - (p / 100) * (cUnten - cOben);

  // Ereignisfenster (ab Stufe 1)
  t.push(
    gruppe(
      1,
      `<rect x="${r2(sx(f0) - 6)}" y="${aOben - 10}" width="${r2(sx(f1) - sx(f0) + 12)}" height="${cUnten - aOben + 20}" rx="6" fill="#fdecea"/>` +
        text((sx(f0) + sx(f1)) / 2, aOben + 14, `≈ ${fmt(Math.round(f1 - f0))} s`, {
          groesse: 24,
          gewicht: 700,
          anker: 'middle',
          farbe: FARBEN.rot,
        }),
      { klasse: 'aufbau-band' },
    ),
  );

  // Achse unten
  for (let s = 0; s <= bisS; s += 20) {
    t.push(linie(sx(s), aOben, sx(s), cUnten, FARBEN.raster, 2));
    t.push(
      text(sx(s), cUnten + 34, `${fmt(s)} s`, {
        groesse: 22,
        anker: 'middle',
        farbe: FARBEN.gedaempft,
        mono: true,
      }),
    );
  }

  // Spur A
  t.push(text(0, aOben + 110, 'Beitritte', { groesse: 26, gewicht: 700 }));
  t.push(text(0, aOben + 140, 'Latenz je Beitritt', { groesse: 22, farbe: FARBEN.gedaempft }));
  for (const ms of [0, 500, 1000]) {
    t.push(linie(x0, sy(ms), x1, sy(ms), FARBEN.raster, 2));
    if (ms !== 500) {
      t.push(
        text(x0 - 12, sy(ms) + 8, `${fmt(ms)} ms`, {
          groesse: 22,
          anker: 'end',
          farbe: FARBEN.gedaempft,
          mono: true,
        }),
      );
    }
  }
  for (const b of e.beitritte) {
    const langsam = b.ms > e.grenzeMs;
    t.push(
      punkt(
        sx(b.tS),
        sy(b.ms),
        langsam ? 6 : 4,
        langsam ? FARBEN.rot : FARBEN.gedaempft,
        langsam ? 0.9 : 0.4,
      ),
    );
  }
  t.push(
    text(sx(d.konfig.profil.rampMs / 1000) + 10, aUnten - 14, 'Welle endet', {
      groesse: 22,
      farbe: FARBEN.gedaempft,
    }),
  );
  t.push(
    text(xr, aOben + 40, `${e.langsam.join} Beitritte über ${fmt(e.grenzeMs)} ms`, {
      groesse: 24,
      gewicht: 700,
      farbe: FARBEN.rot,
    }),
  );
  t.push(
    text(
      xr,
      aOben + 72,
      `übrige ${fmt(d.live.laeufe - 1)} Läufe: je Aktion höchstens ${e.langsamAndereMax}`,
      {
        groesse: 22,
        farbe: FARBEN.text2,
      },
    ),
  );

  // Spur B (Stufe 1)
  const hosts = Math.max(1, d.konfig.hosts);
  const b = [];
  b.push(text(0, bOben + 30, 'Analyse', { groesse: 26, gewicht: 700 }));
  b.push(text(0, bOben + 60, `${hosts} Lehrende`, { groesse: 22, farbe: FARBEN.gedaempft }));
  e.analyse
    .filter((c) => c.startS < bisS)
    .forEach((c, i) => {
      const y = bOben + (i % hosts) * bahn;
      const farbe =
        c.grund === 'TIMEOUT'
          ? FARBEN.rot
          : c.grund === 'SIDECAR_UNAVAILABLE'
            ? FARBEN.bernstein
            : FARBEN.linie;
      const breite = Math.max(8, sx(c.startS + c.dauerS) - sx(c.startS));
      b.push(
        `<rect x="${r2(sx(c.startS))}" y="${y}" width="${r2(breite)}" height="${bahn - 6}" rx="3" fill="${farbe}"/>`,
      );
    });
  b.push(
    text(xr, bOben + 24, `die einzigen ${e.timeouts} Timeouts von V3`, {
      groesse: 24,
      gewicht: 700,
      farbe: FARBEN.rot,
    }),
  );
  b.push(
    text(xr, bOben + 56, `danach sofort Ersatz: ${d.konfig.maxInFlight} Anfragen offen`, {
      groesse: 22,
      farbe: FARBEN.bernsteinText,
    }),
  );
  t.push(gruppe(1, b.join('')));

  // Spur C (Stufe 2)
  const c = [];
  c.push(text(0, cOben + 30, 'CPU', { groesse: 26, gewicht: 700 }));
  c.push(text(0, cOben + 60, '% einer CPU', { groesse: 22, farbe: FARBEN.gedaempft }));
  const pfad = (feld) =>
    e.cpu
      .filter((p) => p.tS <= bisS && p[feld] !== null)
      .map((p, i) => `${i ? 'L' : 'M'}${r2(sx(p.tS))} ${r2(cy(p[feld]))}`)
      .join('');
  c.push(linie(x0, cy(50), x1, cy(50), FARBEN.raster, 2));
  c.push(
    text(x0 - 12, cy(50) + 8, '50 %', {
      groesse: 22,
      anker: 'end',
      farbe: FARBEN.gedaempft,
      mono: true,
    }),
  );
  c.push(
    `<path d="${pfad('postgres')}" fill="none" stroke="${FARBEN.gedaempft}" stroke-width="3"/>`,
  );
  c.push(`<path d="${pfad('app')}" fill="none" stroke="${FARBEN.tinte}" stroke-width="3"/>`);
  // Direkte Beschriftung an den Spitzen
  const appSpitze = e.cpu.find((p) => p.app === e.appCpuMax);
  c.push(text(sx(appSpitze.tS) + 10, cy(e.appCpuMax) + 4, 'App', { groesse: 22, gewicht: 700 }));
  c.push(
    text(sx(e.pgMax.tS) - 10, cy(e.pgMax.max) - 4, 'DB', {
      groesse: 22,
      gewicht: 700,
      anker: 'end',
      farbe: FARBEN.gedaempft,
    }),
  );
  c.push(
    text(xr, cOben + 24, `App bis ${fmt(e.appCpuMax)} %, DB bis ${fmt(e.pgMax.max)} %`, {
      groesse: 24,
      gewicht: 700,
    }),
  );
  c.push(
    text(xr, cOben + 56, `DB in allen übrigen Läufen ≤ ${fmt(e.pgAndere[1])} %`, {
      groesse: 22,
      farbe: FARBEN.text2,
    }),
  );
  t.push(gruppe(2, c.join('')));

  t.push(
    text(x0, H - 4, 'Sekunden im Messfenster · Zeit je Beitritt ≈ Ankunft (Näherung)', {
      groesse: 22,
      farbe: FARBEN.gedaempft,
    }),
  );
  return huelle(
    `Letzter Lauf V3, Block 5: ${e.langsam.join} langsame Beitritte in etwa ${Math.round(f1 - f0)} Sekunden, zeitgleich die ${e.timeouts} Timeouts der Analyse und CPU-Spitzen von App und PostgreSQL.`,
    t.join(''),
    H,
  );
}

// ------------------------------------------------------------------ N8 Ressourcen

/**
 * Zwei Punktdiagramme je Block: links Anteil gedrosselter CPU-Perioden von spaCy (Schwelle 5 %),
 * rechts Speicherspitze von spaCy (80 % von 1 GiB als Schwelle, 1 GiB als Limit).
 */
export function ressourcenSvg(daten) {
  const teile = [];
  const zeilen = [
    ['V2', '1 CPU'],
    ['V3', '0,25 CPU'],
    ['V4', 'Proxy'],
  ];
  const panel = (
    x0,
    breite,
    titel,
    max,
    werte,
    schwelle,
    schwelleText,
    limit,
    einheit,
    striche,
  ) => {
    const y0 = 120;
    const zeileH = 100;
    const sx = (w) => x0 + 150 + ((breite - 170) * w) / max;
    teile.push(text(x0, 36, esc(titel), { groesse: 26, gewicht: 700 }));
    const yAchse = y0 + zeilen.length * zeileH - 30;
    teile.push(linie(sx(0), yAchse, sx(max), yAchse, FARBEN.linie, 2));
    for (const s of striche) {
      teile.push(linie(sx(s), y0 - 40, sx(s), yAchse, FARBEN.raster, 2));
      teile.push(
        text(sx(s), yAchse + 32, `${fmt(s)}${einheit}`, {
          groesse: 22,
          anker: 'middle',
          farbe: FARBEN.gedaempft,
          mono: true,
        }),
      );
    }
    // Die Schwelle gilt laut Vertrag nur im Normalbetrieb (V2): Linie nur über der V2-Zeile.
    teile.push(
      linie(sx(schwelle), y0 - 50, sx(schwelle), y0 + 50, FARBEN.rot, 3, ' stroke-dasharray="8 6"'),
    );
    teile.push(
      text(sx(schwelle) + (limit ? -8 : 8), y0 - 56, esc(`${schwelleText} (nur V2)`), {
        groesse: 22,
        gewicht: 600,
        farbe: FARBEN.rot,
        ...(limit ? { anker: 'end' } : {}),
      }),
    );
    if (limit) {
      teile.push(linie(sx(limit), y0 - 50, sx(limit), yAchse, FARBEN.tinte, 3));
      teile.push(
        text(sx(limit), yAchse + 32, 'Limit 1 GiB', {
          groesse: 22,
          gewicht: 600,
          anker: 'end',
          farbe: FARBEN.tinte,
        }),
      );
    }
    zeilen.forEach(([v, was], zi) => {
      const y = y0 + zi * zeileH + 10;
      teile.push(text(x0, y + 2, v, { groesse: 26, gewicht: 700 }));
      teile.push(text(x0, y + 30, was, { groesse: 22, farbe: FARBEN.gedaempft }));
      for (const w of werte[v]) {
        // Rot nur für eine Vertragsverletzung (V2 über der Schwelle); V3 über 5 % ist gewollt (Drosselung).
        const ueber = w > schwelle;
        const farbe = ueber ? (v === 'V2' ? FARBEN.rot : FARBEN.bernstein) : FARBEN.blau;
        teile.push(
          `<circle cx="${r2(sx(w))}" cy="${y}" r="11" fill="${farbe}" fill-opacity="0.75" stroke="${FARBEN.weiss}" stroke-width="2"/>`,
        );
      }
    });
  };
  panel(
    0,
    660,
    'Gedrosselte CPU-Perioden je Block',
    100,
    daten.drosselung,
    daten.schwellen.drosselung * 100,
    `Schwelle ${fmt(daten.schwellen.drosselung * 100)} %`,
    null,
    ' %',
    [0, 25, 50, 75, 100],
  );
  panel(
    720,
    660,
    'Speicherspitze je Block',
    daten.v2.limitMiB,
    daten.speicher,
    daten.v2.limitMiB * daten.schwellen.speicher,
    `Schwelle ${fmt(daten.schwellen.speicher * 100)} %`,
    daten.v2.limitMiB,
    '',
    [0, 256, 512],
  );
  teile.push(
    text(870, 470, 'MiB, Spitze inklusive Aufwärmen', { groesse: 22, farbe: FARBEN.gedaempft }),
  );
  teile.push(
    text(150, 470, 'ein Punkt je Block (5 je Variante)', { groesse: 22, farbe: FARBEN.gedaempft }),
  );
  const [v3min, v3max] = daten.v3.drosselProzent.map((p) => fmt(p));
  return huelle(
    `Drosselung und Speicher von spaCy je Block: V2 und V4 kaum gedrosselt, V3 zu ${v3min} bis ${v3max} Prozent; Speicher überall unter der Schwelle.`,
    teile.join(''),
    485,
  );
}

// ------------------------------------------------------------------ N9 Analysezeit

/**
 * Analyse-p95 je Block auf Log-Achse (Werte streuen über drei Zehnerpotenzen): V1 lexikalisch, V2 und V3
 * spaCy, V4 Ersatz nach dem Timeout. Timeout und Proxyverzögerung als Linien.
 */
export function analyseSvg(d) {
  const H = 470;
  const x0 = 430;
  const x1 = 1330;
  const min = 0.01;
  const max = 10;
  const sx = (s) =>
    x0 + ((Math.log10(s) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * (x1 - x0);
  const y0 = 90;
  const zeileH = 84;
  const t = [];
  const yAchse = y0 + 4 * zeileH - 20;
  for (const [s, l] of [
    [0.01, '0,01 s'],
    [0.1, '0,1 s'],
    [1, '1 s'],
    [10, '10 s'],
  ]) {
    t.push(linie(sx(s), y0 - 40, sx(s), yAchse, FARBEN.raster, 2));
    t.push(
      text(sx(s), yAchse + 34, l, {
        groesse: 22,
        anker: 'middle',
        farbe: FARBEN.gedaempft,
        mono: true,
      }),
    );
  }
  t.push(linie(x0, yAchse, x1, yAchse, FARBEN.linie, 2));
  const timeoutS = d.konfig.timeoutMs / 1000;
  const proxyS = d.v4.verzoegerungMs / 1000;
  // Aufbau wie M1: Stufe 0 Referenz V1, Stufe 1 spaCy (V2, V3), Stufe 2 V4 mit Timeout und Proxy
  const STUFE = { V1: 0, V2: 1, V3: 1, V4: 2 };
  const frist = [];
  frist.push(
    linie(sx(timeoutS), y0 - 50, sx(timeoutS), yAchse, FARBEN.rot, 3, ' stroke-dasharray="8 6"'),
  );
  frist.push(
    text(sx(timeoutS) - 10, y0 - 56, `Timeout ${fmt(timeoutS)} s`, {
      groesse: 22,
      gewicht: 600,
      anker: 'end',
      farbe: FARBEN.rot,
    }),
  );
  frist.push(
    linie(sx(proxyS), y0 - 20, sx(proxyS), yAchse, FARBEN.tinte, 2, ' stroke-dasharray="3 5"'),
  );
  frist.push(
    text(sx(proxyS) + 8, y0 - 26, `Proxy ${fmt(proxyS)} s`, { groesse: 22, farbe: FARBEN.tinte }),
  );
  t.push(gruppe(STUFE.V4, frist.join('')));
  const zeilen = [
    ['V1', 'spaCy aus', 'lexikalisch', FARBEN.gedaempft],
    ['V2', 'spaCy 1 CPU', 'spaCy', FARBEN.blau],
    ['V3', 'spaCy 0,25 CPU', 'spaCy', FARBEN.blau],
    ['V4', 'Proxy vor spaCy', 'Ersatz', FARBEN.bernstein],
  ];
  zeilen.forEach(([v, was, ergebnis, farbe], zi) => {
    const y = y0 + zi * zeileH;
    const werte = d.analyseJeBlockS[v];
    const zeile = [];
    zeile.push(text(0, y + 2, `${v} · ${esc(was)}`, { groesse: 26, gewicht: 700 }));
    zeile.push(text(0, y + 30, `Ergebnis: ${ergebnis}`, { groesse: 22, farbe: FARBEN.gedaempft }));
    for (const w of werte) zeile.push(punkt(sx(w), y - 6, 11, farbe, 0.75));
    const [a, b] = [Math.min(...werte), Math.max(...werte)];
    const lbl = b < 1 ? `${fmt(a * 1000)}–${fmt(b * 1000)} ms` : `${fmt(a, 1)}–${fmt(b, 1)} s`;
    const rechts = sx(b) + 20 + lbl.length * 13 < sx(timeoutS) - 10 || v === 'V4';
    zeile.push(
      text(rechts && v !== 'V4' ? sx(b) + 20 : sx(a) - 20, y + 2, lbl, {
        groesse: 24,
        gewicht: 600,
        mono: true,
        farbe: v === 'V4' ? FARBEN.bernsteinText : FARBEN.tinte,
        ...(rechts && v !== 'V4' ? {} : { anker: 'end' }),
      }),
    );
    t.push(STUFE[v] ? gruppe(STUFE[v], zeile.join('')) : zeile.join(''));
  });
  t.push(
    text(x0, H - 4, 'Analysedauer, p95 je Block · Log-Achse, je Strich × 10', {
      groesse: 22,
      farbe: FARBEN.gedaempft,
    }),
  );
  return huelle(
    `Analysedauer je Block: lexikalisch unter 0,1 s, spaCy normal etwa 0,5 s, gedrosselt 2 bis 3 s, hinter dem Proxy Ersatz nach etwa ${fmt(timeoutS)} s.`,
    t.join(''),
    H,
  );
}
