// Diagramme für Jonas' Folien (Richtung M, Stilproben M2–M4): reine Funktionen, die SVG-Text liefern.
// Jede Zahl kommt aus dem Datenmodul (zahlen.mjs); fest stehen hier nur Achsenstriche, die vorab
// festgelegten Schwellen aus ADR 1B-008 und die Geometrie.
//
// Fläche: Jede Grafik hat viewBox "0 0 1380 560" (FLAECHE) und sitzt auf der 1600 × 900-Folie im
// Maßstab 1:1 zwischen Titel und Fußzeile (links 110, oben 190; .folie-flaeche in stil.css).
// Schriftgrößen sind damit echte Pixel auf 1600 px Breite (mindestens 22), Linien mindestens 2 px.
// Keine <pattern>/<clipPath>-IDs: Im Deck liegen viele Folien mit display:none, und Verweise auf
// IDs in versteckten Folien würden nicht gezeichnet.
import { fmt } from './zahlen.mjs';

export const FLAECHE = { x: 110, y: 190, breite: 1380, hoehe: 560 };

export const FARBEN = {
  blau: '#0b5ea8',
  // Netz im Fußballfeld: hell genug gegen Rasen (auch in Graustufen und nach Videokompression)
  blauHell: '#7cc0ff',
  petrol: '#0f766e',
  petrolHell: '#e3f1ee',
  bernstein: '#b45309',
  bernsteinText: '#9a4a0b',
  bernsteinMittel: '#e9b47a',
  bernsteinHell: '#fbefe0',
  rot: '#b42318',
  tinte: '#16202c',
  text2: '#3d4757',
  gedaempft: '#566173',
  linie: '#c9d2de',
  raster: '#e8edf3',
  weiss: '#ffffff',
  rasen: '#2f7a4f',
  rasenStreifen: '#2a7147',
  rasenRand: '#245f3d',
};

const TEXT = "Inter, 'Helvetica Neue', Arial, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";

/** Vorab festgelegte Schwellen (ADR 1B-008): H_B1 Netz, H_B2 Adapter, H_B3 Inferenzanteil. */
const SCHWELLE = { netzMs: 50, adapterMs: 2000, inferAnteil: 0.95 };

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const r2 = (n) => Math.round(n * 100) / 100;

/** <text> mit expliziten Attributen; inhalt ist bereits escaptes Markup (für <tspan>). */
function text(x, y, inhalt, o = {}) {
  const a = [
    `x="${r2(x)}"`,
    `y="${r2(y)}"`,
    `font-family="${o.mono ? MONO : TEXT}"`,
    `font-size="${o.groesse ?? 28}"`,
    `font-weight="${o.gewicht ?? 400}"`,
    `fill="${o.farbe ?? FARBEN.tinte}"`,
  ];
  if (o.anker) a.push(`text-anchor="${o.anker}"`);
  if (o.halo) {
    a.push(`stroke="${o.halo}" stroke-width="${o.haloBreite ?? 6}" stroke-linejoin="round"`);
    a.push('paint-order="stroke"');
  }
  if (o.extra) a.push(o.extra);
  return `<text ${a.join(' ')}>${inhalt}</text>`;
}

/**
 * t mit tiefgestellter Ziffer als <tspan> (die latin-Schriftschnitte haben keine ₀–₃). dy statt
 * baseline-shift: Chromium setzt baseline-shift in Plex Mono mit Lücke und zu tief. Folgt Text, setzt
 * hoch() die Grundlinie zurück.
 */
const TIEF = 6;
const tIndex = (i) => `t<tspan dx="-3" dy="${TIEF}" font-size="22">${i}</tspan>`;
const hoch = (s) => `<tspan dy="-${TIEF}">${s}</tspan>`;

/** Haken als Pfad (✓ fehlt ebenfalls in den latin-Schnitten). */
const haken = (x, y, farbe) =>
  `<path d="M${r2(x)},${r2(y - 7)} l6,7 l12,-14" fill="none" stroke="${farbe}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
const kreuz = (x, y, farbe) =>
  `<path d="M${r2(x)},${r2(y - 12)} l14,14 m0,-14 l-14,14" fill="none" stroke="${farbe}" stroke-width="3" stroke-linecap="round"/>`;

function svgHuelle(label, inhalt) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FLAECHE.breite} ${FLAECHE.hoehe}" ` +
    `role="img" aria-label="${esc(label)}">` +
    `<rect width="${FLAECHE.breite}" height="${FLAECHE.hoehe}" fill="${FARBEN.weiss}"/>${inhalt}</svg>`
  );
}

// ---------------------------------------------------------------------------------------------
// Log-Achse

/** Position von ms auf einer logarithmischen Achse zwischen minMs (x0) und maxMs (x1). */
export function logX(ms, { x0, x1, minMs, maxMs }) {
  const a = Math.log10(minMs);
  const anteil = (Math.log10(ms) - a) / (Math.log10(maxMs) - a);
  return x0 + anteil * (x1 - x0);
}

const ACHSE = { x0: 250, x1: 1330, minMs: 0.1, maxMs: 1_000_000 };
const STRICHE = [
  [0.1, '0,1 ms'],
  [1, '1 ms'],
  [10, '10 ms'],
  [100, '100 ms'],
  [1000, '1 s'],
  [10_000, '10 s'],
  [100_000, '100 s'],
  [1_000_000, '1000 s'],
];

/**
 * Zeitzerlegung eines Auftrags auf Log-Achse (J9) als Punktdiagramm: Auf einer Log-Achse täuschen
 * Balkenlängen über das Verhältnis (99,9 % Inferenz sähe aus wie „etwas länger als der Adapter“), deshalb
 * nur Punkte an ihrer Position, ohne Balken. Netz, Transport und Adapter sind Mediane über alle
 * Aufträge, Inferenz der Median warm (Auftrag 1 ist kalt, ADR 1B-011). Der kalte Auftrag (Median der
 * Läufe mit frischer Runtime) ist kein Teil der Zerlegung: Er steht als senkrechte Bezugsmarke.
 */
export function zeitzerlegungSvg(b1, { kalt = true, stufen = false } = {}) {
  // stufen (J9 im Deck): Aufbau auf Tastendruck, Vorhersage vor Beleg. Stufe 0 Achse, Zeilen und
  // Schwellen; 1 Netz, Transport, Adapter mit Haken; 2 Inferenz, Anteil und Kaltmarke. Ohne stufen
  // (Handout) unverändert.
  const stufe = (k, html) => {
    if (typeof html !== 'string') throw new Error('stufe: genau ein HTML-Text');
    return stufen ? `<g data-ab="${k}">${html}</g>` : html;
  };
  const alle = `Median, alle ${b1.anzahl}`;
  const nWarm = b1.anzahl - 1; // Auftrag 1 kalt, 2…n warm (ADR 1B-011)
  const zeilen = [
    { name: 'Netz', gruppe: alle, ms: b1.netzMs, wert: `${fmt(b1.netzMs, 2)} ms` },
    {
      name: 'Transport',
      gruppe: alle,
      ms: b1.transportMs,
      wert: `${fmt(b1.transportMs, 1)} ms`,
      zusatz: 'Netz + Server ohne Inferenz',
    },
    { name: 'Adapter', gruppe: alle, ms: b1.adapterMs, wert: `${fmt(b1.adapterMs, 0)} ms` },
    {
      name: 'Inferenz',
      gruppe: `warm, n = ${nWarm}`,
      ms: b1.inferWarmMs,
      wert: `${fmt(b1.inferWarmMs / 1000, 1)} s`,
      haupt: true,
    },
  ];

  const oben = 84;
  const unten = 450;
  // Mono-Text auf weißem Feld statt Halo (ein Halo erscheint im PDF-Text doppelt, Handout-Wortzahl).
  const MONO_BREITE = 0.6;
  const aufWeiss = (x, y, inhalt, o) => {
    const breite = r2(inhalt.length * MONO_BREITE * o.groesse + 12);
    const links = o.anker === 'end' ? x - breite + 6 : x - 6;
    return (
      `<rect x="${r2(links)}" y="${r2(y - o.groesse * 0.9)}" width="${breite}" height="${r2(o.groesse * 1.2)}" fill="${FARBEN.weiss}"/>` +
      text(x, y, esc(inhalt), { mono: true, ...o })
    );
  };
  const takt = (unten - oben) / zeilen.length;
  const teile = [];

  // Raster: nur Dekaden (je Strich ×10); Zwischenstriche machten die Fläche bei 960 px unruhig.
  for (const [ms, label] of STRICHE) {
    const x = r2(logX(ms, ACHSE));
    teile.push(
      `<line x1="${x}" y1="${oben - 24}" x2="${x}" y2="${unten}" stroke="${FARBEN.linie}" stroke-width="2"/>`,
      text(x, unten + 36, label, {
        mono: true,
        groesse: 24,
        farbe: FARBEN.gedaempft,
        anker: 'middle',
      }),
    );
  }

  // Bezugsmarke: kalter Auftrag (eigene Gruppe, Nachtrag M4), über alle Zeilen, beschriftet oben.
  if (kalt) {
    const xk = r2(logX(b1.kaltMedianS * 1000, ACHSE));
    teile.push(
      stufe(
        2,
        `<line data-bezug="kalt" x1="${xk}" y1="${oben - 24}" x2="${xk}" y2="${unten}" stroke="${FARBEN.bernstein}" stroke-width="3" stroke-dasharray="10 7"/>` +
          text(xk + 12, 26, esc(`T_job kalt ${fmt(b1.kaltMedianS, 1)} s`), {
            mono: true,
            groesse: 24,
            gewicht: 600,
            farbe: FARBEN.bernsteinText,
            anker: 'end',
          }) +
          text(xk + 12, 52, esc(`Median, n = ${b1.nKaltLaeufe}`), {
            mono: true,
            groesse: 22,
            farbe: FARBEN.gedaempft,
            anker: 'end',
          }),
      ),
    );
  }

  const schwelle = (x, cy, label, ok) => {
    const xs = r2(x);
    return (
      `<line x1="${xs}" y1="${r2(cy - 26)}" x2="${xs}" y2="${r2(cy + 26)}" stroke="${FARBEN.tinte}" stroke-width="3" stroke-dasharray="8 6"/>` +
      // Haken vor dem Text: sein Abstand hängt so nicht von der gemessenen Textbreite ab.
      stufe(1, (ok ? haken : kreuz)(x + 14, cy + 4, ok ? FARBEN.tinte : FARBEN.rot)) +
      text(x + 44, cy + 8, esc(label), { mono: true, groesse: 22, halo: FARBEN.weiss })
    );
  };

  zeilen.forEach((z, i) => {
    const cy = r2(oben + takt * (i + 0.5));
    const x = r2(logX(z.ms, ACHSE));
    teile.push(
      text(226, cy + 4, esc(z.name), { groesse: 30, gewicht: z.haupt ? 700 : 400, anker: 'end' }),
      text(226, cy + 34, esc(z.gruppe), {
        mono: true,
        groesse: z.name === 'Transport' ? 22 : 24,
        farbe: FARBEN.gedaempft,
        anker: 'end',
      }),
      // Zeilenlinie über die ganze Achse: führt das Auge, codiert aber keine Länge.
      `<line x1="${ACHSE.x0}" y1="${cy}" x2="${ACHSE.x1}" y2="${cy}" stroke="${FARBEN.raster}" stroke-width="2"/>`,
    );
    if (z.name === 'Netz') {
      teile.push(
        schwelle(logX(SCHWELLE.netzMs, ACHSE), cy, 'Schwelle 50 ms', b1.netzMs <= SCHWELLE.netzMs),
      );
    }
    if (z.name === 'Adapter') {
      teile.push(
        schwelle(
          logX(SCHWELLE.adapterMs, ACHSE),
          cy,
          'Schwelle 2 s',
          b1.adapterMs <= SCHWELLE.adapterMs,
        ),
      );
    }
    const punkt = [
      `<circle data-punkt="${esc(z.name)}" cx="${x}" cy="${cy}" r="${z.haupt ? 14 : 11}" fill="${z.haupt ? FARBEN.bernstein : FARBEN.bernsteinMittel}" stroke="${FARBEN.bernstein}" stroke-width="3"/>`,
    ];
    if (z.haupt) {
      // Wert links vom Punkt (rechts liegt die Kaltmarke), darüber der Anteil; H_B3 ist ein Anteil, keine Zeit.
      const ok = b1.inferAnteil >= SCHWELLE.inferAnteil;
      punkt.push(
        text(x - 28, cy + 9, esc(z.wert), {
          mono: true,
          groesse: 28,
          gewicht: 700,
          anker: 'end',
          halo: FARBEN.weiss,
        }),
        aufWeiss(
          x - 28,
          cy - 34,
          `Anteil ${fmt(b1.inferAnteil * 100, 2)} % (${alle}) · Schwelle ≥ 95 %`,
          {
            groesse: 22,
            farbe: FARBEN.text2,
            anker: 'end',
          },
        ),
        (ok ? haken : kreuz)(x - 4, cy - 38, ok ? FARBEN.tinte : FARBEN.rot),
      );
    } else {
      punkt.push(
        text(x + 22, cy - 14, esc(z.wert), {
          mono: true,
          groesse: 26,
          gewicht: 600,
          halo: FARBEN.weiss,
        }),
      );
      if (z.zusatz) {
        punkt.push(
          aufWeiss(x + 22, cy + 34, `(${z.zusatz})`, { groesse: 22, farbe: FARBEN.text2 }),
        );
      }
    }
    teile.push(stufe(z.haupt ? 2 : 1, punkt.join('')));
  });

  teile.push(
    `<line x1="${ACHSE.x0}" y1="${unten}" x2="${ACHSE.x1}" y2="${unten}" stroke="${FARBEN.gedaempft}" stroke-width="2"/>`,
    text(
      0,
      542,
      stufen
        ? 'Log-Achse, je Strich ×10 · Schwellen vorab (ADR 1B-008) · Anteil: langsame CPU, am PC ebenfalls über 99 %'
        : 'Log-Achse, je Strich ×10. Schwellen vorab (ADR 1B-008). Anteil für diese langsame CPU, am schnelleren PC ebenfalls über 99 %.',
      { groesse: 24, farbe: FARBEN.text2 },
    ),
  );

  const label =
    `Zeitzerlegung eines Summary-Auftrags als Punkte auf logarithmischer Achse: Netz ${fmt(b1.netzMs, 2)} ms, ` +
    `Transport (Netz plus Server ohne Inferenz) ${fmt(b1.transportMs, 1)} ms, Adapter ${fmt(b1.adapterMs, 0)} ms (Mediane über alle ${b1.anzahl} Aufträge), ` +
    `Inferenz ${fmt(b1.inferWarmMs / 1000, 1)} s (Median warm, n = ${nWarm})` +
    (kalt
      ? `; Bezugsmarke: Auftrag kalt ${fmt(b1.kaltMedianS, 1)} s (Median aus ${b1.nKaltLaeufe} Läufen mit frischer Runtime, Nachtrag)`
      : '') +
    `. Inferenzanteil ${fmt(b1.inferAnteil * 100, 2)} %. Alle drei Schwellen erfüllt.`;
  return svgHuelle(label, teile.join(''));
}

// ---------------------------------------------------------------------------------------------
// Weg des Auftrags über zwei Hosts

const APP_BOX = { y: 0, h: 270 };
const LLM_BOX = { y: 350, h: 200 };
const OBEN_Y = 140;
const UNTEN_Y = 460;
// Abstieg und Aufstieg als kubische Kurven (Kontrollpunkte waagerecht, wirkt wie ein Gleis).
const AB = [
  [450, OBEN_Y],
  [530, OBEN_Y],
  [530, UNTEN_Y],
  [610, UNTEN_Y],
];
const AUF = [
  [770, UNTEN_Y],
  [850, UNTEN_Y],
  [850, OBEN_Y],
  [930, OBEN_Y],
];

function bezier(p, t) {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [0, 1].map((d) => k.reduce((s, ki, i) => s + ki * p[i][d], 0));
}

/** Punkt auf einer der beiden Kurven bei gegebener Höhe y (Bisektion; y ist monoton in t). */
function aufKurve(p, y) {
  let lo = 0;
  let hi = 1;
  const steigt = p[3][1] > p[0][1];
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (bezier(p, m)[1] < y === steigt) lo = m;
    else hi = m;
  }
  return bezier(p, (lo + hi) / 2).map(r2);
}

const NETZ_Y = (APP_BOX.y + APP_BOX.h + LLM_BOX.y) / 2;

/**
 * Stationen mit Lage (Mitte), Ringradius und Auftrag. Das Deck (Task 7) bewegt den Marker
 * <g class="auftrag" transform="translate(x y)"> zwischen diesen Punkten.
 */
export const WEG_STATIONEN = Object.freeze({
  klick: { x: 120, y: OBEN_Y, r: 20, auftrag: '1C', name: 'Klick' },
  kontext: { x: 340, y: OBEN_Y, r: 20, auftrag: '1C', name: 'Kontext' },
  netz: { ...xy(aufKurve(AB, NETZ_Y)), r: 12, auftrag: '1B', name: 'Netz' },
  inferenz: { x: 690, y: UNTEN_Y, r: 50, auftrag: '1B', name: 'Inferenz' },
  nachpruefung: { x: 1020, y: OBEN_Y, r: 20, auftrag: '1C', name: 'Nachprüfung' },
  gate: { x: 1270, y: OBEN_Y, r: 20, auftrag: '1C', name: 'Gate' },
});
function xy([x, y]) {
  return { x, y };
}

function etikett(cx, y, auftrag) {
  const c = auftrag === '1C';
  return (
    `<g data-etikett="${auftrag}">` +
    `<rect x="${r2(cx - 30)}" y="${r2(y)}" width="60" height="32" rx="6" fill="${c ? FARBEN.petrolHell : FARBEN.bernsteinHell}"/>` +
    text(cx, y + 24, auftrag, {
      groesse: 22,
      gewicht: 700,
      farbe: c ? FARBEN.petrol : FARBEN.bernsteinText,
      anker: 'middle',
    }) +
    `</g>`
  );
}

function rasterBox(y, h, label, rechts, rechtsFarbe = FARBEN.gedaempft) {
  const t = [];
  for (let x = 32; x < FLAECHE.breite; x += 32) {
    t.push(`M${x},${y + 2}V${y + h - 2}`);
  }
  for (let yy = y + 32; yy < y + h; yy += 32) t.push(`M2,${yy}H${FLAECHE.breite - 2}`);
  return (
    `<path d="${t.join('')}" fill="none" stroke="${FARBEN.raster}" stroke-width="2"/>` +
    `<rect x="1" y="${y + 1}" width="${FLAECHE.breite - 2}" height="${h - 2}" rx="10" fill="none" stroke="${FARBEN.linie}" stroke-width="2"/>` +
    text(24, y + 38, label, {
      mono: true,
      groesse: 22,
      farbe: FARBEN.gedaempft,
      halo: FARBEN.weiss,
    }) +
    (rechts
      ? text(FLAECHE.breite - 24, y + 38, rechts, {
          mono: true,
          groesse: 22,
          farbe: rechtsFarbe,
          anker: 'end',
          halo: FARBEN.weiss,
        })
      : '')
  );
}

/**
 * Karte des Auftrags über app-host und llm-host (J3 und als Leitfaden auf den Stationsfolien).
 * aktiv: Station mit dem Marker des wandernden Auftrags (genau ein data-aktiv) oder null.
 * auftrag: der verfolgte Auftrag aus dem 1B-Lauf ({ nr, hostReturnMs, inferMs }); seine eigenen
 * Werte stehen an Klick und Inferenz. Die 1C-Werte an Kontext und Nachprüfung stammen aus anderen
 * Aufbauten (ein Rechner über Loopback) und tragen ihre Herkunft unter dem Wert.
 */
export function wegSvg({ aktiv = null, c1, auftrag }) {
  if (aktiv !== null && !WEG_STATIONEN[aktiv]) throw new Error(`Unbekannte Station: ${aktiv}`);
  if (!auftrag) throw new Error('wegSvg braucht den verfolgten Auftrag');
  const S = WEG_STATIONEN;
  const au = auftrag;
  const teile = [];

  teile.push(
    // 1C-Werte stehen an Kontext und Nachprüfung im app-host; ihr Hinweis gehört in dessen Kopf.
    rasterBox(
      APP_BOX.y,
      APP_BOX.h,
      'app-host · 192.168.150.10',
      '1C-Werte: ein Rechner, Loopback, kein llm-host',
      FARBEN.petrol,
    ),
    rasterBox(LLM_BOX.y, LLM_BOX.h, 'llm-host · 192.168.150.20'),
    text(
      24,
      LLM_BOX.y + LLM_BOX.h - 22,
      `Messpunkte ${tIndex(0)}${hoch('–t')}<tspan dx="-3" dy="${TIEF}" font-size="22">3</tspan>${hoch(': Mitschnitt auf beiden Hosts')}`,
      { mono: true, groesse: 22, farbe: FARBEN.gedaempft, halo: FARBEN.weiss },
    ),
  );

  const pfad =
    `M${S.klick.x},${OBEN_Y} L${AB[0].join(',')} C${AB[1].join(',')} ${AB[2].join(',')} ${AB[3].join(',')} ` +
    `L${AUF[0].join(',')} C${AUF[1].join(',')} ${AUF[2].join(',')} ${AUF[3].join(',')} L${S.gate.x},${OBEN_Y}`;
  teile.push(
    `<path class="weg-pfad" d="${pfad}" fill="none" stroke="${FARBEN.blau}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
  );

  // Messpunkte: t0 verlässt app-host, t1 erreicht llm-host, t2 verlässt llm-host, t3 erreicht app-host.
  const tObenY = APP_BOX.h - 34;
  const tUntenY = LLM_BOX.y + 34;
  const mp = [
    [AB, tObenY, 'start'], // t0, t3 innen: außen stehen die Stationstexte
    [AB, tUntenY, 'end'],
    [AUF, tUntenY, 'start'],
    [AUF, tObenY, 'end'],
  ];
  mp.forEach(([kurve, y, anker], i) => {
    const [x] = aufKurve(kurve, y);
    const dx = anker === 'end' ? -20 : 20;
    teile.push(
      `<g data-messpunkt="t${i}">` +
        `<circle cx="${x}" cy="${y}" r="9" fill="${FARBEN.bernstein}" stroke="${FARBEN.weiss}" stroke-width="3"/>` +
        text(x + dx, y + 8, tIndex(i), {
          mono: true,
          groesse: 26,
          gewicht: 600,
          farbe: FARBEN.bernsteinText,
          anker,
          halo: FARBEN.weiss,
        }) +
        `</g>`,
    );
  });

  const ring = (s, farbe) =>
    `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${FARBEN.weiss}" stroke="${farbe}" stroke-width="7"/>`;
  const obenStation = (id, sub, herkunft, farbe = FARBEN.tinte, ringFarbe = FARBEN.petrol) => {
    const s = S[id];
    return (
      `<g data-station="${id}">` +
      etikett(s.x, s.y - 78, s.auftrag) +
      ring(s, ringFarbe) +
      text(s.x, s.y + 66, esc(s.name), { groesse: 30, gewicht: 700, farbe, anker: 'middle' }) +
      text(s.x, s.y + 96, esc(sub), {
        mono: true,
        groesse: 22,
        gewicht: 600,
        farbe: farbe === FARBEN.tinte ? FARBEN.tinte : farbe,
        anker: 'middle',
      }) +
      text(s.x, s.y + 122, esc(herkunft), {
        mono: true,
        groesse: 22,
        farbe: FARBEN.gedaempft,
        anker: 'middle',
        extra: 'data-herkunft="1"',
      }) +
      `</g>`
    );
  };

  teile.push(
    obenStation('klick', `${fmt(au.hostReturnMs)} ms`, `Auftrag ${au.nr}`),
    obenStation(
      'kontext',
      `Validierung ${fmt(c1.validierungAnteilProzent.wert, 1)} %`,
      `1C-Test · ${c1.validierungAnteilProzent.commit}`,
    ),
    obenStation(
      'nachpruefung',
      `Anteil ${fmt(c1.nachpruefungAnteilProzent.wert, 2)} %`,
      `1C-Labor · ${c1.nachpruefungAnteilProzent.commit.slice(0, 8)}`,
    ),
    // Kurz „verwirft“: mit „Gate“ darüber eindeutig, und die Zeile läuft nicht in die der Nachprüfung.
    obenStation('gate', 'verwirft', '1B und 1C', FARBEN.rot, FARBEN.rot),
  );

  // Netz: kleiner Ring auf dem Abstieg, Beschriftung mittig zwischen den Hosts.
  const n = S.netz;
  // Netz unter der Messauflösung von etwa 1 ms (ADR 1B-011): keine Nachkommastellen auf der Karte.
  const netzText = 'Netz < 1 ms';
  const netzMitte = (n.x + aufKurve(AUF, NETZ_Y)[0]) / 2 + 6;
  const netzBreite = 60 + 14 + netzText.length * 14.4;
  const netzLinks = netzMitte - netzBreite / 2;
  teile.push(
    `<g data-station="netz">` +
      `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${FARBEN.weiss}" stroke="${FARBEN.bernstein}" stroke-width="6"/>` +
      etikett(netzLinks + 30, n.y - 16, '1B') +
      text(netzLinks + 74, n.y + 9, esc(netzText), { mono: true, groesse: 24, gewicht: 600 }) +
      `</g>`,
  );

  // Inferenz: großer Kreis, Beschriftung rechts im llm-host-Kasten.
  const inf = S.inferenz;
  const lx = 900;
  teile.push(
    `<g data-station="inferenz">` +
      `<circle cx="${inf.x}" cy="${inf.y}" r="${inf.r}" fill="${FARBEN.bernstein}"/>` +
      text(inf.x, inf.y + 10, `${fmt(au.inferMs / 1000, 0)} s`, {
        mono: true,
        groesse: 28,
        gewicht: 600,
        farbe: FARBEN.weiss,
        anker: 'middle',
      }) +
      etikett(lx + 30, inf.y - 42, '1B') +
      text(lx + 76, inf.y - 16, 'Inferenz', { groesse: 30, gewicht: 700 }) +
      text(lx, inf.y + 22, `Kreis: Auftrag ${au.nr} (warm), 1B`, {
        groesse: 22,
        farbe: FARBEN.text2,
      }) +
      // Anteil dieses Auftrags (inferMs / jobMs), nicht der Median aller Aufträge
      text(lx, inf.y + 54, `Anteil ${fmt((au.inferMs / au.jobMs) * 100, 2)} %, langsame CPU`, {
        groesse: 22,
        farbe: FARBEN.text2,
      }) +
      `</g>`,
  );

  // Marker des wandernden Auftrags: Halo um die aktive Station, bei kleinen Ringen mit Punkt.
  if (aktiv) {
    const s = S[aktiv];
    const punkt =
      s.r < 30 ? `<circle cx="0" cy="0" r="${Math.min(9, s.r - 4)}" fill="${FARBEN.blau}"/>` : '';
    teile.push(
      `<g class="auftrag" data-aktiv="${aktiv}" transform="translate(${s.x} ${s.y})">` +
        `<circle cx="0" cy="0" r="${s.r + 16}" fill="${FARBEN.blau}" fill-opacity="0.14" stroke="${FARBEN.blau}" stroke-width="4"/>` +
        punkt +
        `</g>`,
    );
  }

  const label =
    `Weg von Auftrag ${au.nr} über app-host 192.168.150.10 und llm-host 192.168.150.20: ` +
    `Klick ${fmt(au.hostReturnMs)} ms (Auftrag ${au.nr}), Kontext (Validierung aus dem 1C-Test), Netz unter 1 ms, ` +
    `Inferenz ${fmt(au.inferMs / 1000, 0)} s (Auftrag ${au.nr}), Nachprüfung (Anteil aus dem 1C-Labor, ein Rechner), ` +
    `Gate verwirft die Antwort. Messpunkte t0 bis t3 an den Host-Grenzen.` +
    (aktiv ? ` Aktuelle Station: ${S[aktiv].name}.` : '');
  return svgHuelle(label, teile.join(''));
}

// ---------------------------------------------------------------------------------------------
// Fußballfeld mit Kamerazoom

const FELD_MM = 105_000;
const FELD_HALB_H = 10_000; // stilisiert: nur die Länge ist maßstäblich
const REIHE_Y = 7_000; // Messreihe unterhalb der Mittelachse
const FENSTER = { x: 0, y: 44, w: FLAECHE.breite, h: 290 };

/**
 * Kamera des Fußballfelds. Weltkoordinaten in Millimetern, Ursprung auf der rechten Torlinie
 * (x = 0) und der Messreihe (y = REIHE_Y); das Feld reicht von x = −105 000 bis 0. Der Ursprung
 * liegt am Zielpunkt, damit die Gleitkomma-Auflösung beim Zoom auf 0,3 mm genügt.
 *
 * zoom z ∈ [0, 1] → viewBox des inneren <svg class="kamera">:
 *   Bildbreite  w(z) = W0 · (W1 / W0)^z      (exponentiell: gleichmäßig empfundene Zoomgeschwindigkeit)
 *   Bildhöhe    h(z) = w(z) · 290 / 1380     (Seitenverhältnis des Fensters)
 *   Zielpunkt (Torlinie, Messreihe) steht im Fenster bei (sx(z), sy(z)), linear zwischen
 *   SX0/SY0 (ganzes Feld) und SX1/SY1:  x = −sx·w,  y = REIHE_Y − sy·h.
 * Das Deck animiert nur dieses viewBox-Attribut; die Parameter stehen zusätzlich als data-*
 * am <svg class="kamera">. Beschriftungen im Feld sind für ihren Zoom bemessen (Gruppen mit
 * scale) und werden beim Hineinzoomen lesbar; Linien nutzen vector-effect="non-scaling-stroke".
 */
const W0 = 112_000; // ganzes Feld (105 m) plus Rand
const H0 = (W0 * FENSTER.h) / FENSTER.w;
export const KAMERA = Object.freeze({
  W0,
  W1: 1.5, // 1,5 mm Bildbreite: die 0,3-mm-Netzmarke füllt ein Fünftel des Fensters
  SX0: 108_500 / W0, // Torlinie 3,5 m vor dem rechten Fensterrand
  SY0: (REIHE_Y + H0 / 2) / H0, // Feldmitte (y = 0) in der Fenstermitte
  SX1: 0.6,
  SY1: 0.5,
});

const rund6 = (n) => Number(n.toFixed(6));

export function kameraViewBox(zoom) {
  if (!(zoom >= 0 && zoom <= 1)) throw new RangeError(`zoom muss in [0, 1] liegen: ${zoom}`);
  const w = KAMERA.W0 * (KAMERA.W1 / KAMERA.W0) ** zoom;
  const h = (w * FENSTER.h) / FENSTER.w;
  const sx = KAMERA.SX0 + (KAMERA.SX1 - KAMERA.SX0) * zoom;
  const sy = KAMERA.SY0 + (KAMERA.SY1 - KAMERA.SY0) * zoom;
  return { x: rund6(-sx * w), y: rund6(REIHE_Y - sy * h), w: rund6(w), h: rund6(h) };
}

/**
 * Deckkraft einer Feldbeschriftung mit Zoombereich [von, bis]: außerhalb 0, innen 1, an inneren
 * Rändern linear über 0,04 Zoom eingeblendet (Ränder bei 0 und 1 sind hart). Das Deck setzt
 * damit opacity der Elemente mit data-zoom-von/-bis je Bild.
 */
export function zoomDeckkraft(zoom, von, bis) {
  if (zoom < von || zoom > bis) return 0;
  const ein = von <= 0 ? 1 : Math.min(1, (zoom - von) / 0.04);
  const aus = bis >= 1 ? 1 : Math.min(1, (bis - zoom) / 0.04);
  return Math.min(ein, aus);
}

/**
 * Lupenrahmen der Übersichtskarte (J10): der Ausschnitt kameraViewBox(zoom) in Weltkoordinaten, aber nie
 * schmaler als 4 % des ganzen Fensters (sonst wäre er beim tiefen Zoom unsichtbar), zentriert auf den
 * Ausschnitt. deck.js rechnet dasselbe je Bild (deck.test.mjs vergleicht beide).
 */
export const LUPE_MIN = 0.04;
export function lupeRahmen(zoom) {
  const v = kameraViewBox(zoom);
  const ganz = kameraViewBox(0);
  const w = Math.max(v.w, ganz.w * LUPE_MIN);
  const h = (w * ganz.h) / ganz.w;
  return {
    x: rund6(v.x + v.w / 2 - w / 2),
    y: rund6(v.y + v.h / 2 - h / 2),
    w: rund6(w),
    h: rund6(h),
  };
}

/** Millimeter pro Bildschirmpixel bei gegebenem Zoom. */
const mmProPx = (zoom) => (KAMERA.W0 * (KAMERA.W1 / KAMERA.W0) ** zoom) / FENSTER.w;

/** Länge in Metern lesbar: m, cm oder mm mit einer Nachkommastelle. */
function laenge(m) {
  if (m >= 1) return `${fmt(m, 1)} m`;
  if (m >= 0.01) return `${fmt(m * 100, 1)} cm`;
  return `${fmt(m * 1000, 1)} mm`;
}

/** Maße des Fußballfelds aus den Daten (für den Titel von J10): Feldlänge in m, Netz und Transport in mm. */
export function fussballMasse(b1) {
  const mmJeMs = FELD_MM / b1.jobWarmMs;
  return {
    feldM: FELD_MM / 1000,
    netzMm: b1.netzMs * mmJeMs,
    transportMm: b1.transportMs * mmJeMs,
  };
}

/**
 * Fußballfeld (J10): 105 m ≙ T_job warm (Median, n = 9). Inferenz = Anteil am Auftrag,
 * Transport und Netz = Mediane über alle Aufträge, umgerechnet mit demselben Maßstab.
 */
export function fussballfeldSvg(b1, { zoom = 0 } = {}) {
  const vb = kameraViewBox(zoom);
  const nWarm = b1.anzahl - 1; // Auftrag 1 kalt, 2…n warm (ADR 1B-011)
  const mmJeMs = FELD_MM / b1.jobWarmMs;
  const infMm = FELD_MM * b1.inferAnteil;
  const transMm = b1.transportMs * mmJeMs;
  const netzMm = b1.netzMs * mmJeMs;
  const tInf = laenge(infMm / 1000);
  const tTrans = laenge(transMm / 1000);
  const tNetz = laenge(netzMm / 1000);
  const restMm = FELD_MM - infMm - transMm;
  const tRest = laenge(restMm / 1000);
  const ns = 'vector-effect="non-scaling-stroke"';

  // --- Welt (mm) ---
  const w = [];
  w.push(
    `<rect x="-120000" y="-30000" width="140000" height="60000" fill="${FARBEN.rasenRand}"/>`,
    `<rect x="${-FELD_MM}" y="${-FELD_HALB_H}" width="${FELD_MM}" height="${2 * FELD_HALB_H}" fill="${FARBEN.rasen}"/>`,
  );
  for (let i = 1; i < 20; i += 2) {
    w.push(
      `<rect x="${-FELD_MM + i * 5250}" y="${-FELD_HALB_H}" width="5250" height="${2 * FELD_HALB_H}" fill="${FARBEN.rasenStreifen}"/>`,
    );
  }
  const weiss = `fill="none" stroke="${FARBEN.weiss}" stroke-width="4" stroke-opacity="0.9" ${ns}`;
  w.push(
    `<rect x="${-FELD_MM}" y="${-FELD_HALB_H}" width="${FELD_MM}" height="${2 * FELD_HALB_H}" ${weiss}/>`,
    `<line x1="${-FELD_MM / 2}" y1="${-FELD_HALB_H}" x2="${-FELD_MM / 2}" y2="${FELD_HALB_H}" ${weiss}/>`,
    `<circle cx="${-FELD_MM / 2}" cy="0" r="4500" ${weiss}/>`,
    `<rect x="${-FELD_MM}" y="-5500" width="16500" height="11000" ${weiss}/>`,
    `<rect x="-16500" y="-5500" width="16500" height="11000" ${weiss}/>`,
    `<rect x="${-FELD_MM}" y="-2600" width="5500" height="5200" ${weiss}/>`,
    `<rect x="-5500" y="-2600" width="5500" height="5200" ${weiss}/>`,
  );

  // Messreihe: weiße Einfassung, darauf farbige Strecke; feste Strichstärke in Pixeln.
  const strecke = (x1, x2, farbe) =>
    `<line x1="${rund6(x1)}" y1="${REIHE_Y}" x2="${rund6(x2)}" y2="${REIHE_Y}" stroke="${FARBEN.weiss}" stroke-width="22" ${ns}/>` +
    `<line x1="${rund6(x1)}" y1="${REIHE_Y}" x2="${rund6(x2)}" y2="${REIHE_Y}" stroke="${farbe}" stroke-width="14" ${ns}/>`;
  w.push(
    strecke(-FELD_MM, -FELD_MM + infMm, FARBEN.bernstein),
    // Rest der Jobzeit zwischen Inferenzende und Transport (App, Adapter): schließt die Linie bis zur Torlinie.
    `<g data-strecke="rest">${strecke(-FELD_MM + infMm, -transMm, FARBEN.gedaempft)}</g>`,
    strecke(-transMm, 0, FARBEN.tinte),
    strecke(-netzMm, 0, FARBEN.blauHell),
  );

  // Beschriftung in Pixeln, für ihren Zoom skaliert (k = mm je px dort). Jede Gruppe ist nur in
  // ihrem Zoombereich sichtbar (data-zoom-von/-bis, Deckkraft per zoomDeckkraft), sonst ragte
  // sie beim Weiterzoomen riesig ins Bild oder bliebe als unlesbarer Fleck stehen.
  const imFeld = (x, y, k, [von, bis], inhalt) =>
    `<g transform="translate(${rund6(x)} ${rund6(y)}) scale(${rund6(k)})" ` +
    `data-zoom-von="${von}" data-zoom-bis="${bis}" opacity="${rund6(zoomDeckkraft(zoom, von, bis))}">` +
    `${inhalt}</g>`;
  const feldText = (x, y, s, o = {}) =>
    text(x, y, s, {
      mono: true,
      groesse: 26,
      gewicht: 600,
      farbe: FARBEN.weiss,
      halo: FARBEN.rasenRand,
      ...o,
    });
  const strich = (x) =>
    `<line x1="${x}" y1="-22" x2="${x}" y2="22" stroke="${FARBEN.weiss}" stroke-width="3"/>`;
  const kZ0 = mmProPx(0);
  const kTrans = mmProPx(0.67); // Bildbreite ≈ 4 cm: Transport gut sichtbar
  const kNetz = mmProPx(0.97); // bei Zoom 1 rund 1,4-fach groß
  const BEREICH = {
    inferenz: [0, 0.12],
    meter: [0.32, 0.52],
    transport: [0.58, 0.76],
    netz: [0.92, 1],
  };
  const kMeter = mmProPx(0.421); // Bildbreite 1 m (Stufe 1 in deck.mjs)
  w.push(
    imFeld(
      -FELD_MM + infMm,
      REIHE_Y,
      kMeter,
      BEREICH.meter,
      feldText(-14, -26, 'Inferenz endet hier', { anker: 'end' }) + strich(0),
    ),
    imFeld(
      -transMm,
      REIHE_Y,
      kMeter,
      BEREICH.meter,
      feldText(-8, 52, `übrige Jobzeit · ${esc(tRest)}`, { anker: 'end', groesse: 24 }),
    ),
    imFeld(
      -FELD_MM + 18_000,
      REIHE_Y,
      kZ0,
      BEREICH.inferenz,
      feldText(16, -24, `Inferenz · ${esc(tInf)}`),
    ),
    imFeld(
      -transMm,
      REIHE_Y,
      kTrans,
      BEREICH.transport,
      // links am Anfang der Strecke, damit rechts Abstand zur Torlinie bleibt (Audit: berührte sie)
      feldText(12, -26, `Transport ${esc(tTrans)}`, { groesse: 24 }),
    ),
    imFeld(-transMm, REIHE_Y, kTrans, BEREICH.transport, strich(0)),
    imFeld(-netzMm, REIHE_Y, kNetz, BEREICH.netz, strich(0)),
    imFeld(
      0,
      REIHE_Y,
      kNetz,
      BEREICH.netz,
      feldText(-26, -30, `davon Netz · ${esc(tNetz)}`, { anker: 'end', groesse: 28 }),
    ),
    // Letztes Bild (auch im PDF): jede Strecke an ihrem Ende beschriftet, der dunkle Rand erklärt.
    imFeld(
      -0.88,
      REIHE_Y,
      kNetz,
      BEREICH.netz,
      feldText(0, 52, `Transport · ${esc(tTrans)}, reicht links weiter`, {
        groesse: 22,
        gewicht: 400,
      }),
    ),
    imFeld(
      0,
      REIHE_Y,
      kNetz,
      BEREICH.netz,
      feldText(16, 52, 'Torlinie = Auftragsende', { groesse: 22, gewicht: 400 }),
    ),
  );

  const kamera =
    `<svg class="kamera" x="${FENSTER.x}" y="${FENSTER.y}" width="${FENSTER.w}" height="${FENSTER.h}" ` +
    `viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid meet" overflow="hidden" ` +
    `data-zoom="${zoom}" data-w0="${KAMERA.W0}" data-w1="${KAMERA.W1}" data-sx0="${rund6(KAMERA.SX0)}" ` +
    `data-sy0="${rund6(KAMERA.SY0)}" data-sx1="${KAMERA.SX1}" data-sy1="${KAMERA.SY1}" data-anker-y="${REIHE_Y}">` +
    w.join('') +
    `</svg>`;

  // --- Rahmen und Kennzahlen (fest, unabhängig vom Zoom) ---
  const t = [];
  // Kopfzeile je Zoom: erst der Maßstab des ganzen Felds, im Endbild (auch PDF) der Ausschnitt mit
  // Maßstabsbalken, damit das letzte Bild nicht als ganzes Feld gelesen wird.
  const imZoom = ([von, bis], inhalt) =>
    `<g data-zoom-von="${von}" data-zoom-bis="${bis}" opacity="${rund6(zoomDeckkraft(zoom, von, bis))}">${inhalt}</g>`;
  const massstab = `105 m = ${esc(fmt(b1.jobWarmMs / 1000, 1))} s`;
  const AUSSCHNITT = [0.96, 1];
  const balkenMm = 0.1;
  const balkenPx = r2((balkenMm * FENSTER.w) / KAMERA.W1);
  t.push(
    imZoom(
      [0, 0.9],
      text(FLAECHE.breite, 28, `Maßstab: ganzes Feld ${massstab}`, {
        groesse: 22,
        farbe: FARBEN.gedaempft,
        anker: 'end',
      }),
    ),
    imZoom(
      AUSSCHNITT,
      text(
        FLAECHE.breite,
        28,
        `Ausschnitt: ${esc(fmt(KAMERA.W1, 1))} mm an der Torlinie, die Inferenz liegt links außerhalb · ganzes Feld ${massstab}`,
        { groesse: 22, farbe: FARBEN.gedaempft, anker: 'end' },
      ),
    ),
    kamera,
    `<rect x="${FENSTER.x + 1}" y="${FENSTER.y + 1}" width="${FENSTER.w - 2}" height="${FENSTER.h - 2}" fill="none" stroke="${FARBEN.rasenRand}" stroke-width="2"/>`,
    // Übersichtskarte oben rechts: ganzes Feld klein, der Lupenrahmen zeigt den Ausschnitt. Erst ab der
    // ersten Zoomstufe sichtbar, damit beim Hineinzoomen der Bezug zum Feld bleibt.
    (() => {
      const g0 = kameraViewBox(0);
      const mw = 320;
      const mh = r2((mw * g0.h) / g0.w);
      const mx = FENSTER.x + FENSTER.w - mw - 18;
      const my = FENSTER.y + 50;
      const l = lupeRahmen(zoom);
      const lw = `fill="none" stroke="${FARBEN.weiss}" stroke-width="2" stroke-opacity="0.85" ${ns}`;
      return (
        `<g data-uebersicht data-zoom-von="0.05" data-zoom-bis="1" opacity="${rund6(zoomDeckkraft(zoom, 0.05, 1))}">` +
        `<rect x="${mx - 8}" y="${my - 38}" width="${mw + 16}" height="${r2(mh + 46)}" rx="6" fill="${FARBEN.tinte}" fill-opacity="0.72"/>` +
        text(mx, my - 10, 'Übersicht: ganzes Feld', {
          groesse: 22,
          gewicht: 600,
          farbe: FARBEN.weiss,
        }) +
        `<svg x="${mx}" y="${my}" width="${mw}" height="${mh}" viewBox="${g0.x} ${g0.y} ${g0.w} ${g0.h}">` +
        `<rect x="${-FELD_MM}" y="${-FELD_HALB_H}" width="${FELD_MM}" height="${2 * FELD_HALB_H}" fill="${FARBEN.rasen}"/>` +
        `<rect x="${-FELD_MM}" y="${-FELD_HALB_H}" width="${FELD_MM}" height="${2 * FELD_HALB_H}" ${lw}/>` +
        `<line x1="${-FELD_MM / 2}" y1="${-FELD_HALB_H}" x2="${-FELD_MM / 2}" y2="${FELD_HALB_H}" ${lw}/>` +
        `<line x1="${-FELD_MM}" y1="${REIHE_Y}" x2="${rund6(-FELD_MM + infMm)}" y2="${REIHE_Y}" stroke="${FARBEN.bernstein}" stroke-width="3" ${ns}/>` +
        `<rect data-lupe x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" fill="${FARBEN.weiss}" fill-opacity="0.18" stroke="${FARBEN.weiss}" stroke-width="2" ${ns}/>` +
        `</svg></g>`
      );
    })(),
    imZoom(
      AUSSCHNITT,
      `<path d="M24,${FENSTER.y + 30}v14M24,${FENSTER.y + 37}h${balkenPx}M${r2(24 + balkenPx)},${FENSTER.y + 30}v14" fill="none" stroke="${FARBEN.weiss}" stroke-width="3"/>` +
        text(r2(24 + balkenPx + 14), FENSTER.y + 45, `${esc(fmt(balkenMm, 1))} mm`, {
          groesse: 22,
          gewicht: 600,
          farbe: FARBEN.weiss,
        }),
    ),
  );
  // Kennzahlen unter dem Feld: jede erscheint, sobald der Zoom ihre Strecke lesbar zeigt, und bleibt
  // dann stehen (Bereich bis 1). Das Deck setzt opacity je Bild wie bei den Feldbeschriftungen;
  // bei zoom 1 (Folie, Druck) sind alle drei sichtbar.
  const spalten = [
    [
      'inferenz',
      null,
      0,
      tInf,
      FARBEN.bernstein,
      `Inferenz · Anteil ${fmt(b1.inferAnteil * 100, 2)} %`,
    ],
    [
      'transport',
      BEREICH.transport[0],
      590,
      tTrans,
      FARBEN.tinte,
      `Transport · ${fmt(b1.transportMs, 1)} ms`,
    ],
    ['netz', BEREICH.netz[0], 1030, tNetz, FARBEN.blau, `davon Netz · ${fmt(b1.netzMs, 2)} ms`],
  ];
  for (const [name, ab, x, wert, farbe, sub] of spalten) {
    const zoomAttr =
      ab === null
        ? ''
        : ` data-zoom-von="${ab}" data-zoom-bis="1" opacity="${rund6(zoomDeckkraft(zoom, ab, 1))}"`;
    // Farbmuster wie die Strecke im Feld (weiße Einfassung, farbiger Kern) als Legende zur Zahl.
    t.push(
      `<g data-spalte="${name}"${zoomAttr}>`,
      text(x - 2, 438, esc(wert), {
        groesse: 80,
        gewicht: 700,
        farbe,
        extra: 'style="font-variant-numeric:tabular-nums;letter-spacing:-1px"',
      }),
      // Netz: Muster in hellem Blau wie die Strecke im Feld, mit blauem Rand; die Zahl bleibt blau.
      name === 'netz'
        ? `<rect x="${x + 1}" y="464" width="38" height="12" rx="2" fill="${FARBEN.blauHell}" stroke="${FARBEN.blau}" stroke-width="2"/>`
        : `<rect x="${x}" y="463" width="40" height="14" rx="2" fill="${farbe}"/>`,
      text(x + 54, 480, esc(sub), { groesse: 28, farbe: FARBEN.text2 }),
      '</g>',
    );
  }
  t.push(
    text(
      0,
      544,
      `105 m = T_job, Median warm, n = ${nWarm} (Spanne ${fmt(b1.jobWarmSpanneS[0], 1)}–${fmt(b1.jobWarmSpanneS[1], 1)} s, ein Lauf) · sonst Median, alle ${b1.anzahl} · langsame CPU`,
      { groesse: 22, farbe: FARBEN.gedaempft },
    ),
  );

  const label =
    `Wäre der Auftrag ein Fußballfeld: 105 m entsprechen ${fmt(b1.jobWarmMs / 1000, 1)} s (T_job, Median warm, n = ${nWarm}). ` +
    `Die Inferenz belegt ${tInf}, der Transport ${tTrans}, davon das Netz ${tNetz} ` +
    `(Netz und Transport als Median über alle ${b1.anzahl} Aufträge).`;
  return svgHuelle(label, t.join(''));
}

// ---------------------------------------------------------------------------------------------
// Systembild arsnova.eu (GK)

/**
 * Geometrie des Systembilds in Weltkoordinaten (1380 × 470): Hörsaal, App-Host mit Live-App,
 * Kompass und den beiden optionalen Bausteinen, zweiter privater Host mit der Inferenz. Die Ortsmarken
 * oben links sind seit 2026-11-16 Wegkarten (wegkarte.mjs), keine Miniatur dieses Bilds.
 */
export const SYSTEM = Object.freeze({
  breite: 1380,
  hoehe: 470,
  // Hörsaal (mit Lehrperson) zeigt auf die Live-App, die Lehrperson allein auf den Kompass
  // (Durchsicht 2026-11-18): zwei Kästen, je auf Höhe ihres Ziels.
  hoersaal: { x: 0, y: 0, w: 240, h: 206 },
  lehrperson: { x: 0, y: 218, w: 240, h: 82 },
  app: { x: 300, y: 0, w: 690, h: 440 },
  live: { x: 330, y: 64, w: 630, h: 104 },
  kompass: { x: 330, y: 186, w: 630, h: 96 },
  spacy: { x: 330, y: 300, w: 300, h: 116 },
  kontext: { x: 660, y: 300, w: 300, h: 116 },
  llm: { x: 1080, y: 230, w: 300, h: 210 },
  inferenz: { x: 1104, y: 290, w: 252, h: 126 },
});

const kasten = (b, o = {}) =>
  `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${o.rx ?? 10}" fill="${o.fuellung ?? FARBEN.weiss}" stroke="${o.farbe ?? FARBEN.linie}" stroke-width="${o.breite ?? 2}"${o.extra ?? ''}/>`;

/** Etikett wie im Deck (1A Blau, 1C Petrol, 1B Bernstein) als SVG; rechts bündig an x. */
function svgEtikett(xRechts, y, wort) {
  const farbe = { '1A': [FARBEN.raster, FARBEN.blau], '1C': [FARBEN.petrolHell, FARBEN.petrol] }[
    wort.slice(0, 2)
  ] ?? [FARBEN.bernsteinHell, FARBEN.bernsteinText];
  const w = 18 + wort.length * 15;
  return (
    `<rect x="${xRechts - w}" y="${y}" width="${w}" height="32" rx="6" fill="${farbe[0]}"/>` +
    text(xRechts - w / 2, y + 24, esc(wort), {
      groesse: 22,
      gewicht: 700,
      farbe: farbe[1],
      anker: 'middle',
    })
  );
}

/**
 * Systembild für GK in drei Stufen (data-ab): 1 hebt 1A hervor (spaCy), 2 den Teil von Jonas (Kontextpfad,
 * Netz, Inferenz), 3 den gestörten zweiten Host (1B 3–4). Ohne Stufen (Druck) stehen alle drei.
 * clients: vorab festgelegte Auslegung (FESTWERTE.liveClients), keine Messung.
 */
export function systemSvg({ clients }) {
  const S = SYSTEM;
  const t = [];
  const h = S.hoersaal;
  t.push(
    `<g data-kasten="hoersaal">` +
      kasten(h, { fuellung: FARBEN.raster }) +
      text(h.x + 20, h.y + 40, 'Hörsaal', { gewicht: 700 }) +
      text(h.x + 20, h.y + 68, '(+Lehrperson)', {
        groesse: 22,
        gewicht: 600,
        farbe: FARBEN.text2,
      }) +
      text(h.x + 20, h.y + 112, `≥ ${fmt(clients)}`, { mono: true, groesse: 30, gewicht: 600 }) +
      text(h.x + 20, h.y + 140, 'Clients zugleich,', { groesse: 22, farbe: FARBEN.text2 }) +
      text(h.x + 20, h.y + 166, 'auch hinter einem', { groesse: 22, farbe: FARBEN.text2 }) +
      text(h.x + 20, h.y + 192, 'gemeinsamen NAT', { groesse: 22, farbe: FARBEN.text2 }) +
      `</g>`,
  );
  const lp = S.lehrperson;
  t.push(
    `<g data-kasten="lehrperson">` +
      kasten(lp, { fuellung: FARBEN.raster }) +
      text(lp.x + 20, lp.y + lp.h / 2 + 9, 'Lehrperson', { gewicht: 700 }) +
      `</g>`,
  );
  // Pfeile Hörsaal → Live-App und Lehrperson → Kompass, je auf der gemeinsamen Höhe beider Kästen
  const pfeil = (von, nach, y) =>
    `<g data-pfeil="${von}-${nach}" data-y="${y}">` +
    `<line x1="${S[von].x + S[von].w}" y1="${y}" x2="${S[nach].x - 12}" y2="${y}" stroke="${FARBEN.text2}" stroke-width="3"/>` +
    `<path d="M${S[nach].x},${y} l-14,-8 v16 z" fill="${FARBEN.text2}"/></g>`;
  const a = S.app;
  t.push(kasten(a, { rx: 14 }));
  t.push(pfeil('hoersaal', 'live', S.live.y + S.live.h / 2));
  t.push(pfeil('lehrperson', 'kompass', lp.y + lp.h / 2));
  t.push(text(a.x + 24, a.y + 42, 'App-Host', { gewicht: 700 }));
  t.push(
    text(a.x + a.w - 24, a.y + 42, 'Live-Pfad wartet nie auf Analyse', {
      groesse: 22,
      farbe: FARBEN.gedaempft,
      anker: 'end',
    }),
  );
  const block = (b, kopf, zeilen) => {
    t.push(kasten(b, { fuellung: FARBEN.weiss }));
    t.push(text(b.x + 20, b.y + 38, kopf, { groesse: 26, gewicht: 700 }));
    zeilen.forEach((z, i) =>
      t.push(text(b.x + 20, b.y + 70 + i * 28, z, { groesse: 22, farbe: FARBEN.text2 })),
    );
  };
  block(S.live, 'Live-App', ['Quiz, Q&amp;A, Blitzlicht · Backend, PostgreSQL, Redis']);
  block(S.kompass, 'Moderationskompass', ['Hinweiskarten für die Lehrperson, regelbasiert']);
  block(S.spacy, 'spaCy-Sidecar', ['glättet die Wortwolke', 'optional, mit Ersatz']);
  block(S.kontext, 'Kontextpfad', ['baut den Q&amp;A-Kontext', 'für die Zusammenfassung']);
  const l = S.llm;
  t.push(kasten(l, { rx: 14 }));
  t.push(text(l.x + 24, l.y + 42, 'Zweiter Host', { gewicht: 700 }));
  block(S.inferenz, 'Inferenz', ['llama-server, privat', 'Modell auf der CPU']);
  // Netz zwischen Kontextpfad und Inferenz
  const k = S.kontext;
  const yNetz = k.y + k.h / 2;
  const netz = (farbe, breite) =>
    `<line x1="${k.x + k.w}" y1="${yNetz}" x2="${S.inferenz.x}" y2="${yNetz}" stroke="${farbe}" stroke-width="${breite}"/>`;
  t.push(netz(FARBEN.gedaempft, 3));
  t.push(
    text(l.x - 80, l.y - 14, 'privates Netz, Token', { groesse: 22, farbe: FARBEN.gedaempft }),
  );

  // Stufen: Hervorhebung je Teil, in der Reihenfolge des Fahrplans
  const rahmen = (b, farbe) =>
    `<rect x="${b.x - 6}" y="${b.y - 6}" width="${b.w + 12}" height="${b.h + 12}" rx="14" fill="none" stroke="${farbe}" stroke-width="6"/>`;
  const s = S.spacy;
  t.push(
    `<g data-ab="1" data-teil-system="1a">${rahmen(s, FARBEN.blau)}${svgEtikett(s.x + s.w - 12, s.y + 12, '1A')}</g>`,
  );
  const inf = S.inferenz;
  t.push(
    `<g data-ab="2" data-teil-system="jonas">${rahmen(k, FARBEN.petrol)}${svgEtikett(k.x + k.w - 12, k.y + 12, '1C')}` +
      `${netz(FARBEN.bernstein, 6)}${rahmen(inf, FARBEN.bernstein)}${svgEtikett(inf.x + inf.w - 12, inf.y + 12, '1B 1–2')}</g>`,
  );
  t.push(
    `<g data-ab="3" data-teil-system="1b34"><rect x="${l.x + 3}" y="${l.y + 3}" width="${l.w - 6}" height="${l.h - 6}" rx="12" fill="none" stroke="${FARBEN.bernstein}" stroke-width="6" stroke-dasharray="14 10"/>` +
      `${svgEtikett(l.x + l.w - 16, l.y - 16, '1B 3–4')}` +
      text(l.x, l.y + l.h + 26, 'gestoppt, stumm, zu spät', {
        groesse: 22,
        gewicht: 600,
        farbe: FARBEN.bernsteinText,
      }) +
      `</g>`,
  );
  const label =
    `Systembild: Hörsaal mit Lehrperson und mindestens ${fmt(clients)} gleichzeitigen Clients zur Live-App, Lehrperson zum Moderationskompass, App-Host mit Live-App, Moderationskompass, ` +
    'spaCy-Sidecar (1A) und Kontextpfad (1C), über ein privates Netz der zweite Host mit der Inferenz (1B).';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S.breite} ${S.hoehe}" role="img" aria-label="${esc(label)}">` +
    `<rect width="${S.breite}" height="${S.hoehe}" fill="${FARBEN.weiss}"/>${t.join('')}</svg>`
  );
}

// ---------------------------------------------------------------------------------------------
// J12: Zeitleiste eines Auftrags mit einer Stimme während der Inferenz

/**
 * Zeitleiste in drei Stufen: 0 der Auftrag (Host frei, Inferenz, Nachprüfung) mit den Zeiten des verfolgten
 * Auftrags; 1 eine Stimme während der Inferenz (Zeitpunkt gedacht, nicht gemessen); 2 die Nachprüfung findet
 * einen anderen Hash und verwirft die Antwort (Verhalten belegt durch E7/E8).
 */
export function abstimmungSvg({ auftrag }) {
  const H = 250;
  const x0 = 180;
  const x1 = 1300;
  const maxS = 160;
  const sx = (s) => r2(x0 + (s / maxS) * (x1 - x0));
  const yApp = 84;
  const yLlm = 172;
  const inferS = auftrag.inferMs / 1000;
  const jobS = auftrag.jobMs / 1000;
  const t = [];
  t.push(text(0, yApp + 8, 'app-host', { mono: true, groesse: 22, farbe: FARBEN.gedaempft }));
  t.push(text(0, yLlm + 8, 'llm-host', { mono: true, groesse: 22, farbe: FARBEN.gedaempft }));
  t.push(
    `<line x1="${x0}" y1="${yApp}" x2="${x1}" y2="${yApp}" stroke="${FARBEN.linie}" stroke-width="3"/>`,
  );
  for (const s of [0, 30, 60, 90, 120, 150]) {
    t.push(
      `<line x1="${sx(s)}" y1="${yLlm + 34}" x2="${sx(s)}" y2="${yLlm + 44}" stroke="${FARBEN.gedaempft}" stroke-width="2"/>`,
    );
    t.push(
      text(sx(s), yLlm + 66, `${fmt(s)} s`, {
        mono: true,
        groesse: 22,
        farbe: FARBEN.gedaempft,
        anker: 'middle',
      }),
    );
  }
  // Klick: Kontext gebaut, Host nach wenigen ms frei
  t.push(`<circle cx="${sx(0)}" cy="${yApp}" r="10" fill="${FARBEN.petrol}"/>`);
  t.push(
    text(sx(0), yApp + 44, `Klick: Kontext, Host frei nach ${fmt(auftrag.hostReturnMs)} ms`, {
      groesse: 22,
      farbe: FARBEN.tinte,
    }),
  );
  // Inferenz
  t.push(
    `<rect x="${sx(0.4)}" y="${yLlm - 22}" width="${r2(sx(inferS) - sx(0.4))}" height="44" rx="6" fill="${FARBEN.bernstein}"/>`,
  );
  t.push(
    text(sx(inferS / 2), yLlm + 8, `Inferenz ${fmt(inferS, 1)} s`, {
      groesse: 24,
      gewicht: 700,
      farbe: FARBEN.weiss,
      anker: 'middle',
    }),
  );
  // Nachprüfung am Ende
  t.push(`<circle cx="${sx(jobS)}" cy="${yApp}" r="10" fill="${FARBEN.petrol}"/>`);
  t.push(
    text(sx(jobS), yApp - 26, 'Nachprüfung: Hash vergleichen', {
      groesse: 22,
      farbe: FARBEN.tinte,
      anker: 'end',
    }),
  );
  // Stufe 1: eine Stimme kommt während der Inferenz
  const sStimme = 30;
  t.push(
    `<g data-ab="1"><path d="M${sx(sStimme)},${yApp - 14} l12,14 l-12,14 l-12,-14 z" fill="${FARBEN.tinte}"/>` +
      text(sx(sStimme) + 20, yApp - 26, 'eine Stimme kommt an (Zeitpunkt gedacht)', {
        groesse: 22,
        gewicht: 600,
      }) +
      `</g>`,
  );
  // Stufe 2: Hash anders → Antwort verworfen
  t.push(
    `<g data-ab="2"><rect x="${sx(0.4)}" y="${yLlm - 22}" width="${r2(sx(inferS) - sx(0.4))}" height="44" rx="6" fill="${FARBEN.bernsteinHell}" stroke="${FARBEN.bernstein}" stroke-width="2"/>` +
      text(sx(inferS / 2), yLlm + 8, `Inferenz ${fmt(inferS, 1)} s, Antwort verworfen`, {
        groesse: 24,
        gewicht: 700,
        farbe: FARBEN.bernsteinText,
        anker: 'middle',
      }) +
      `<path d="M${sx(jobS) - 14},${yApp - 14} l28,28 M${sx(jobS) + 14},${yApp - 14} l-28,28" stroke="${FARBEN.rot}" stroke-width="5" stroke-linecap="round"/>` +
      text(sx(jobS), yApp + 44, 'Hash anders: source_changed, Antwort verworfen', {
        groesse: 22,
        gewicht: 700,
        farbe: FARBEN.rot,
        anker: 'end',
      }) +
      `</g>`,
  );
  const label =
    `Zeitleiste von Auftrag ${auftrag.nr}: Host frei nach ${fmt(auftrag.hostReturnMs)} ms, Inferenz ${fmt(inferS, 1)} s, danach Nachprüfung. ` +
    'Kommt während der Inferenz eine Stimme an (Zeitpunkt gedacht), ändert sich der Hash, und die Antwort wird verworfen.';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1380 ${H}" role="img" aria-label="${esc(label)}">` +
    `<rect width="1380" height="${H}" fill="${FARBEN.weiss}"/>${t.join('')}</svg>`
  );
}

// ---------------------------------------------------------------------------------------------
// J13: alle geprüften Antworten als Raster

/**
 * Ein Feld je geprüfter Modellantwort, eine Zeile je Auftrag (1B, 1C). Stufe 0 zeigt die Umrisse,
 * Stufe 1 füllt jedes Feld rot: keine Antwort besteht das Gate.
 */
export function gateRasterSvg({ n1B, n1C }) {
  const zelle = 20;
  const abstand = 5;
  const x0 = 70;
  const zeilen = [
    ['1B', n1B, 6],
    ['1C', n1C, 44],
  ];
  const breite = x0 + Math.max(n1B, n1C) * (zelle + abstand);
  const t = [];
  const voll = [];
  for (const [auftrag, n, y] of zeilen) {
    t.push(svgEtikett(56, y - 4, auftrag));
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (zelle + abstand);
      t.push(
        `<rect x="${x}" y="${y}" width="${zelle}" height="${zelle}" rx="3" fill="${FARBEN.weiss}" stroke="${auftrag === '1B' ? FARBEN.bernstein : FARBEN.petrol}" stroke-width="2"/>`,
      );
      voll.push(
        `<rect x="${x}" y="${y}" width="${zelle}" height="${zelle}" rx="3" fill="${FARBEN.rot}"/>`,
      );
    }
  }
  const label = `${n1B + n1C} geprüfte Modellantworten (1B ${n1B}, 1C ${n1C}), jede vom Gate verworfen.`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${breite} 72" width="${breite}" height="72" role="img" aria-label="${esc(label)}">` +
    `${t.join('')}<g data-ab="1" data-raster="verworfen">${voll.join('')}</g></svg>`
  );
}

// Für den Folienentwurf 1A (abgabe/niklas/grafik-1a.mjs): dieselben Bausteine, derselbe Stil.
export { text, svgHuelle, esc };
