// Niklas' Teil 1B, Schritte 3–4 (Störung und Betriebsaufwand), im Stil des gemeinsamen Decks: vier Folien.
// M1 Ersatzzeit je Störung (Summary und Label), M2 Breaker gegen Queue, M3 Rückwirkung auf die Live-Aktionen,
// M4 Same-Host (S1) und Entscheidung nach ADR 1B-020. Jede Zahl kommt aus daten-1b34.mjs, also aus Niklas'
// gewerteten Ergebnis-JSONs (evidenz/1B/messung/, Reihen vom 15. und 16.11.2026); Gegenprobe gegen die
// Protokolle in daten-1b34.test.mjs. Fehlen sie, steht eine Platzhalterfolie mit [Niklas]; die meldet
// abgabe-lokal.mjs vor der Abgabe.
//
// Grenzen, die Folien und Notizen nennen: ein Rechner (i7-10700K, Hyper-V ohne CPU-Pinning) für beide VMs,
// serielle Reihen ohne Randomisierung, kleine Teilreihen (n = 3 bei L2, L3/Label, F2/Label, S1), Vergleiche
// über Commits mit unverändertem Produktionscode, S1 mit anderer Kapazität (8 vCPU statt 2 + 8), Kosten nur
// qualitativ (ADR 1B-020). Folien zeigen nur Zahlen aus Protokollen und Rohdaten, keine eigenen Herleitungen
// (AGENTS.md des Referat-Ordners): Summary-Normal fehlt deshalb im Raster auf M3.

import { FARBEN, esc, text } from '../jonas/grafik.mjs';
import { flaeche, frage, grafikBox, mono } from '../jonas/folien.mjs';
import { fmt } from '../jonas/zahlen.mjs';
import { huelle } from './grafik-1a.mjs';
import { kurzbeleg1A, quellenzeile } from './literatur-1a.mjs';
import { VERZOEGERUNG_1B34_MS } from './daten-1b34.mjs';
import { privat } from '../jonas/notizen.mjs';

const N = '[Niklas]';
const offen = (t) =>
  `<span style="color:var(--gedaempft);border-bottom:2px dashed var(--linie)">${t}</span>`;
const r2 = (n) => Math.round(n * 100) / 100;
const linie = (x1, y1, x2, y2, farbe, breite = 2, extra = '') =>
  `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${farbe}" stroke-width="${breite}"${extra}/>`;

/** Zeilen von M1 in Vortragsreihenfolge: [Variante, Name, was passiert, nur Consumer]. */
const ZEILEN_M1 = [
  ['normal', 'Normal', 'Inferenz läuft', null],
  ['f1', 'Stopp', 'Container gestoppt, sofort abgewiesen', null],
  ['busy', 'Slot belegt', 'Runtime antwortet 503', 'summary'],
  ['l1', `Netz +${VERZOEGERUNG_1B34_MS.l1} ms`, 'verzögert, Antwort kommt', 'label'],
  ['l2', `Netz +${VERZOEGERUNG_1B34_MS.l2} ms`, 'verzögert, Antwort kommt', 'label'],
  ['f2', 'DROP', 'Firewall verwirft, keine Antwort', null],
  ['l3', 'Zu spät', 'Antwort erst nach der Frist', null],
];
/** Störungen der Live-Tabelle (M3) je Consumer, Referenz ist jeweils der Stopp (B0/F1) desselben Consumers. */
const ZEILEN_M3 = {
  summary: [
    ['busy', 'Slot belegt'],
    ['f2', 'DROP'],
    ['l3', 'Zu spät'],
  ],
  label: [
    ['normal', 'Normal'],
    ['l1', `Netz +${VERZOEGERUNG_1B34_MS.l1} ms`],
    ['l2', `Netz +${VERZOEGERUNG_1B34_MS.l2} ms`],
    ['l3', 'Zu spät'],
    ['f2', 'DROP'],
  ],
};
const AKTIONEN = [
  ['join', 'Beitritt'],
  ['vote', 'Quiz'],
  ['qaSubmit', 'Q&amp;A'],
  ['blitzlicht', 'Tempo'],
];

/** Aufbaustufe je Störung auf M1 (0 = von Anfang an sichtbar); dieselben Stufen trägt die Wegmarke. */
export const STUFE_1B34 = { normal: 0, f1: 1, busy: 1, l1: 2, l2: 2, f2: 2, l3: 3 };

const dauer = (ms) =>
  ms < 1000
    ? `${fmt(ms, ms < 100 && ms % 1 ? 1 : 0)} ms`
    : `${fmt(ms / 1000, ms < 10000 ? 1 : 0)} s`;
/** Dauer für den Fließtext der Notizen: Einheiten ausgeschrieben. */
const gesprochen = (ms) => dauer(ms).replace(/ ms$/, ' Millisekunden').replace(/ s$/, ' Sekunden');
const prozent = (r) =>
  `${Math.abs(r - 1) < 0.005 ? '±' : r > 1 ? '+' : '−'}${fmt(Math.abs(r - 1) * 100)}&nbsp;%`;

/** Raute für Label-Aufträge (Kreis = Summary). */
const raute = (x, y, r, farbe) =>
  `<path d="M${r2(x)} ${r2(y - r)}L${r2(x + r)} ${r2(y)}L${r2(x)} ${r2(y + r)}L${r2(x - r)} ${r2(y)}Z" fill="${farbe}" fill-opacity="0.75"/>`;
const kreis = (x, y, r, farbe) =>
  `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r}" fill="${farbe}" fill-opacity="0.7"/>`;

/**
 * M1: Zeit bis zum Ersatz bzw. zur Antwort je Auftrag auf einer Log-Achse (10 ms bis 1000 s), Summary als Kreis
 * (Job-Zeit), Label als Raute (Client-Zeit), Fristen beider Consumer als Linien; rechts die Mediane.
 */
export function ersatzSvg(d) {
  const zeilen = ZEILEN_M1.filter(
    ([v, , , nur]) => (nur !== 'label' && d.finde(v)) || (nur !== 'summary' && d.finde(v, 'label')),
  );
  const zeileH = 64;
  const y0 = 108;
  const H = y0 + zeilen.length * zeileH + 90;
  const x0 = 360;
  const x1 = 900;
  // Rechts je Consumer Median und n (Zahl der Aufträge), Durchsicht 2026-11-18
  const spalteS = 1040;
  const spalteSn = 1110;
  const spalteLn = 1350;
  const spalteL = 1270;
  const min = 0.01;
  const max = 1000;
  const sx = (s) =>
    x0 + ((Math.log10(s) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * (x1 - x0);
  const yAchse = y0 + zeilen.length * zeileH - 26;
  const t = [];
  // Legende und Spaltenköpfe
  t.push(kreis(x0 + 10, 26, 10, FARBEN.gedaempft));
  t.push(text(x0 + 30, 34, 'Summary, Job-Zeit', { groesse: 22, farbe: FARBEN.text2 }));
  t.push(raute(x0 + 270, 26, 12, FARBEN.gedaempft));
  t.push(text(x0 + 292, 34, 'Label, Zeit beim Client', { groesse: 22, farbe: FARBEN.text2 }));
  t.push(text(spalteSn, 30, 'Summary', { groesse: 22, gewicht: 700, anker: 'end' }));
  t.push(text(spalteLn, 30, 'Label', { groesse: 22, gewicht: 700, anker: 'end' }));
  for (const [x, w] of [
    [spalteS, 'Median'],
    [spalteSn, 'n'],
    [spalteL, 'Median'],
    [spalteLn, 'n'],
  ])
    t.push(text(x, 54, w, { groesse: 20, anker: 'end', farbe: FARBEN.gedaempft }));
  for (const [s, l] of [
    [0.01, '10 ms'],
    [0.1, '0,1 s'],
    [1, '1 s'],
    [10, '10 s'],
    [100, '100 s'],
    [1000, '1000 s'],
  ]) {
    t.push(linie(sx(s), y0 - 30, sx(s), yAchse, FARBEN.raster, 2));
    t.push(
      text(sx(s), yAchse + 32, l, {
        groesse: 22,
        anker: 'middle',
        farbe: FARBEN.gedaempft,
        mono: true,
      }),
    );
  }
  t.push(linie(x0, yAchse, x1, yAchse, FARBEN.linie, 2));
  // Fristen: Label 30 s, Summary 300 s
  const fristL = (d.finde('f1', 'label')?.timeoutMs ?? 30000) / 1000;
  const fristS = (d.finde('f1')?.timeoutMs ?? 300000) / 1000;
  // Beschriftung nach außen: Label-Frist links der Linie, Summary-Frist rechts davon
  for (const [f, name, anker, dx] of [
    [fristL, `Frist Label ${fmt(fristL)} s`, 'end', -8],
    [fristS, `Frist Summary ${fmt(fristS)} s`, 'start', 8],
  ]) {
    t.push(linie(sx(f), y0 - 36, sx(f), yAchse, FARBEN.rot, 3, ' stroke-dasharray="8 6"'));
    t.push(
      text(sx(f) + dx, y0 - 30, name, { groesse: 20, gewicht: 600, anker, farbe: FARBEN.rot }),
    );
  }
  zeilen.forEach(([v, name, was, nur], zi) => {
    const y = y0 + zi * zeileH;
    const stufe = STUFE_1B34[v] ?? 0;
    const farbe =
      v === 'normal'
        ? FARBEN.gedaempft
        : v === 'f1' || v === 'busy'
          ? FARBEN.blau
          : FARBEN.bernstein;
    const textFarbe = farbe === FARBEN.bernstein ? FARBEN.bernsteinText : FARBEN.tinte;
    if (stufe) t.push(`<g data-ab="${stufe}" data-stoerung="${v}">`);
    t.push(text(0, y + 2, esc(name), { groesse: 26, gewicht: 700 }));
    t.push(text(0, y + 28, esc(was), { groesse: 20, farbe: FARBEN.gedaempft }));
    const s = nur === 'label' ? null : d.finde(v);
    const l = nur === 'summary' ? null : d.finde(v, 'label');
    // Zahl der Aufträge je Consumer (jeder Punkt ein Auftrag) neben dem Median
    for (const [x, r, c] of [
      [spalteSn, s, 'summary'],
      [spalteLn, l, 'label'],
    ])
      t.push(
        text(x, y + 2, r ? String(r.zeitenMs.length) : '–', {
          groesse: 24,
          mono: true,
          anker: 'end',
          farbe: FARBEN.gedaempft,
        }).replace('<text ', `<text data-n="${v}-${c}" `),
      );
    for (const ms of s?.zeitenMs ?? []) t.push(kreis(sx(ms / 1000), y - 6, 10, farbe));
    for (const ms of l?.zeitenMs ?? []) t.push(raute(sx(ms / 1000), y - 6, 12, farbe));
    t.push(
      text(spalteS, y + 2, s ? dauer(s.zeitMedianMs) : '–', {
        groesse: 24,
        gewicht: 600,
        mono: true,
        anker: 'end',
        farbe: s ? textFarbe : FARBEN.gedaempft,
      }),
    );
    t.push(
      text(spalteL, y + 2, l ? dauer(l.zeitMedianMs) : '–', {
        groesse: 24,
        gewicht: 600,
        mono: true,
        anker: 'end',
        farbe: l ? textFarbe : FARBEN.gedaempft,
      }),
    );
    if (stufe) t.push('</g>');
  });
  t.push(
    text(x0, H - 36, 'Zeit bis Ersatz oder Antwort je Auftrag · Log-Achse, je Strich × 10', {
      groesse: 22,
      farbe: FARBEN.gedaempft,
    }),
  );
  t.push(
    text(x0, H - 6, 'Jeder Punkt ein Auftrag; gleiche Zeiten liegen übereinander', {
      groesse: 22,
      farbe: FARBEN.gedaempft,
    }),
  );
  const f1 = d.finde('f1');
  const f2 = d.finde('f2');
  return huelle(
    `Zeit bis Ersatz oder Antwort je Auftrag: gestoppte Runtime Summary ${dauer(f1.zeitMedianMs)}, DROP Summary ${dauer(f2?.zeitMedianMs ?? 0)}, Label durch die Frist von ${fmt(fristL)} s begrenzt, Antwort nach der Frist ${fmt(fristS)} s. Jeder Punkt ist ein Auftrag, die Zahl der Aufträge (n) steht je Consumer neben dem Median.`,
    t.join(''),
    H,
  );
}

/**
 * M2: zwei Folgen zu je vier Aufträgen ohne Pause. Oben gestoppte Runtime: drei Ablehnungen, dann öffnet der
 * Breaker (circuit_open, kein Netzversuch). Unten Antworten nach der Frist: jeder Auftrag wartet erneut.
 * Balken je Auftrag linear (0 bis Frist), die schnellen Fehler sind nur Striche.
 */
export function breakerSvg(b) {
  const H = 420;
  const x0 = 300;
  const zelleB = 250;
  const balkenB = 220;
  const voll = b.l3.timeoutMs;
  const t = [];
  for (let i = 0; i < 4; i++)
    t.push(
      text(x0 + i * zelleB + balkenB / 2, 26, `Auftrag ${i + 1}`, {
        groesse: 22,
        anker: 'middle',
        farbe: FARBEN.gedaempft,
      }),
    );
  const bahn = (folge, y, name, was, stufe, farbe) => {
    t.push(stufe ? `<g data-ab="${stufe}" data-bahn="${name}">` : `<g data-bahn="${name}">`);
    t.push(text(0, y + 6, esc(name), { groesse: 26, gewicht: 700 }));
    t.push(text(0, y + 34, esc(was), { groesse: 20, farbe: FARBEN.gedaempft }));
    folge.jobs.forEach((j, i) => {
      const x = x0 + i * zelleB;
      const w = Math.max(3, (j.jobMs / voll) * balkenB);
      const offen = j.grund === 'circuit_open';
      t.push(
        `<rect x="${x}" y="${y - 22}" width="${balkenB}" height="36" rx="6" fill="${FARBEN.raster}"/>`,
      );
      if (!offen)
        t.push(
          `<rect x="${x}" y="${y - 22}" width="${r2(w)}" height="36" rx="${w > 8 ? 6 : 1}" fill="${farbe}"/>`,
        );
      t.push(
        text(x, y + 46, dauer(j.jobMs), {
          groesse: 22,
          gewicht: 600,
          mono: true,
          farbe: offen ? FARBEN.blau : FARBEN.tinte,
        }),
      );
      const grund = offen
        ? 'Breaker offen'
        : j.grund === 'unavailable'
          ? 'abgewiesen (RST)'
          : j.verbindungen
            ? 'Frist, Runtime erreicht'
            : 'Frist';
      t.push(
        text(x, y + 72, grund, {
          groesse: 20,
          gewicht: offen || (i === 3 && j.verbindungen) ? 700 : 400,
          farbe: offen
            ? FARBEN.blau
            : i === 3 && j.verbindungen
              ? FARBEN.bernsteinText
              : FARBEN.gedaempft,
        }),
      );
      if (offen)
        t.push(
          `<rect x="${x - 6}" y="${y - 30}" width="${balkenB + 12}" height="112" rx="10" fill="none" stroke="${FARBEN.blau}" stroke-width="3"/>`,
        );
      if (i === 3 && !offen)
        t.push(
          `<rect x="${x - 6}" y="${y - 30}" width="${balkenB + 12}" height="112" rx="10" fill="none" stroke="${FARBEN.bernstein}" stroke-width="3"/>`,
        );
    });
    t.push('</g>');
  };
  bahn(b.f1, 92, 'Stopp', 'Runtime gestoppt', 0, FARBEN.blau);
  bahn(b.l3, 262, 'Zu spät', `Antwort nach ${fmt(b.l3.fakeDelayMs / 1000)} s`, 1, FARBEN.bernstein);
  t.push(
    text(x0, H - 6, `Balken: Job-Zeit von 0 bis zur Frist ${fmt(voll / 1000)} s, je Auftrag`, {
      groesse: 22,
      farbe: FARBEN.gedaempft,
    }),
  );
  return huelle(
    `Zwei Folgen zu je vier Aufträgen: Nach drei abgewiesenen Verbindungen öffnet der Breaker, Auftrag 4 endet nach ${dauer(b.f1.jobs[3].jobMs)} ohne Netzversuch. Nach drei Fristabläufen erreicht Auftrag 4 die Runtime erneut und wartet wieder ${dauer(b.l3.jobs[3].jobMs)}.`,
    t.join(''),
    H,
  );
}

/**
 * Codezeilen, die M2 zitiert (Datei relativ zum Repo, Zeile, erwarteter Inhalt); folien-niklas.test.mjs prüft sie
 * am Checkout, teile.mjs nimmt die Dateien ins Bau-Manifest.
 */
export const CODE_BELEGE_1B34 = [
  [
    'apps/backend/src/lib/openWeightLlmClient.ts',
    188,
    "if (callerSignal?.aborted) return 'aborted';",
  ],
  ['apps/backend/src/lib/openWeightLlmClient.ts', 476, 'function failureCountsForCircuit('],
  [
    'apps/backend/src/lib/openWeightLlmClient.ts',
    477,
    "return status === 'timeout' || status === 'unavailable' || status === 'invalid_response';",
  ],
  [
    'apps/backend/src/lib/openWeightLlmConfig.ts',
    9,
    'OPEN_WEIGHT_LLM_CIRCUIT_FAILURE_THRESHOLD = 3',
  ],
  ['apps/backend/src/lib/openWeightLlmConfig.ts', 10, 'OPEN_WEIGHT_LLM_CIRCUIT_OPEN_MS = 30_000'],
  ['apps/backend/src/lib/qaSummaryQueue.ts', 259, 'async function runWithQueueTimeout('],
  [
    'apps/backend/src/lib/qaSummaryQueue.ts',
    269,
    "controller.abort(new Error('QA_SUMMARY_TIMEOUT'));",
  ],
];

/** Folien M1–M4 (mit Daten) bzw. eine Platzhalterfolie M1 (ohne Daten); teil 'niklas', direkt nach Jonas. */
export function folien1B34(
  d = { vorhanden: false, laeufe: [], finde: () => undefined, schwellen: null },
) {
  const kb = (sl, st) => kurzbeleg1A(sl, st).slice(1, -1);
  const basis = { teil: 'niklas', auftrag: '1B', kurzfassung: true, station: null };
  const f1 = d.finde('f1');
  const f1l = d.finde('f1', 'label');
  if (!d.vorhanden || !f1 || !f1l || !d.breaker || !d.s1 || !d.transport?.label) {
    return [
      {
        ...basis,
        id: 'M1',
        titel: `Störung am zweiten Host ${offen('[Titel]')}`,
        inhalt: flaeche(
          frage(
            'Was spüren die Live-Aktionen, wenn der llm-host langsam ist oder ausfällt?',
            '1B',
          ) +
            `<p style="font-size:28px">${offen(`${N}: Ergebnis-JSONs evidenz/1B/messung/&lt;Datum&gt;-lauf-&lt;variante&gt;-&lt;consumer&gt;.json.gz fehlen`)}</p>`,
        ),
        notiz: privat('M1.notiz', { N }),
        stichpunkte: privat('M1.stichpunkte', { N }),
        zeitS: 90,
        quelle: `${N}: Ergebnis-JSONs mit Rechner und Commit`,
        fuss: `Quelle: ${kb('schneider2026', 'Ordner evidenz/1B')} ${N}`,
      },
    ];
  }
  const sw = d.schwellen;
  const swDatum = sw?.datum ? `${sw.datum.slice(8, 10)}.${sw.datum.slice(5, 7)}.` : '';
  const umgebung = `${f1.rechner}, ohne CPU-Pinning; ${f1.vms.join(', ')}`;
  const pruefung = 'Prüfung durch den Autor: 2026-11-16';
  const zeile = (l) => `${l.dateien.join(' + ')} (Commit ${l.commits.join('/')}, n = ${l.n})`;
  const f2 = d.finde('f2');
  const l3 = d.finde('l3');
  const busy = d.finde('busy');
  const f2l = d.finde('f2', 'label');
  const l3l = d.finde('l3', 'label');
  const nl = d.finde('normal', 'label');
  const ns = d.finde('normal');
  const fristS = f1.timeoutMs / 1000;
  const fristL = f1l.timeoutMs / 1000;
  // Faktor DROP/Stopp (Summary), wie im F2-Protokoll; gerundet auf Hunderter
  const faktor = f2 ? Math.round(f2.zeitMedianMs / f1.zeitMedianMs / 100) * 100 : null;
  const reihenM1 = ZEILEN_M1.flatMap(([v]) => [d.finde(v), d.finde(v, 'label')]).filter(Boolean);
  const alleErsatzImBudget = reihenM1
    .filter((l) => l.variante !== 'normal' && l.auftrag === 'summary')
    .every((l) => l.zeitSpanneMs[1] <= l.timeoutMs + sw.fallbackPufferMs);

  // ------------------------------------------------------------ M1 Ersatz je Störung
  const M1 = {
    ...basis,
    id: 'M1',
    titel: 'Ersatz in jeder Reihe, Stille kostet Zeit',
    inhalt: flaeche(
      frage('Wie schnell kommt der Ersatz, wenn die Inferenz gestört ist?', '1B') +
        grafikBox(ersatzSvg(d)) +
        `<p data-ab="2" class="sekundaer" style="margin:6px 0 0">DROP gegen Stopp bei Summary: rund ${fmt(faktor)}-mal so lang. Der Verbindungsaufbau gibt nach etwa ${fmt(
          Math.round((f2.zeitMedianMs / 60000) * 4) / 4,
          2,
        )
          .replace(',00', '')
          .replace(',25', '¼')
          .replace(',5', '½')
          .replace(
            ',75',
            '¾',
          )} min auf, bei Label endet die Frist von ${fmt(fristL)} s früher.</p>` +
        `<p class="beleg">Vorab (${mono(sw.commit)}${swDatum ? `, ${swDatum}` : ''}): Ersatz ≤ Frist + ${fmt(sw.fallbackPufferMs / 1000)} s, Stopp im Median ≤ ${fmt(sw.f1MedianMaxMs / 1000)} s, DROP > ${fmt(sw.f2ZuF1Min)} × Stopp; Summary erfüllt, DROP über zwei Commits</p>`,
    ),
    notiz: privat('M1.notiz~2', { fmt, fristL, fristS, nl, gesprochen, f1, busy, f2, faktor }),
    stichpunkte: privat('M1.stichpunkte~2', {
      fmt,
      fristL,
      fristS,
      dauer,
      f1,
      busy,
      f2,
      faktor,
      f2l,
      l3,
      l3l,
      sw,
      alleErsatzImBudget,
    }),
    zeitS: 75,
    aufbau: 3,
    // Wegmarke (jonas/wegkarte.mjs): Strecke über den zweiten Host in Bernstein; Zeichen folgen STUFE_1B34.
    marke: '1b-stoerung',
    quelle: `${reihenM1.map(zeile).join('; ')} · ${umgebung} · Summary Job-Zeit (experiment.jobs[].jobMs), Label Client-Zeit (clientWaitMs, die Label-API legt keine Job-Zeit offen); Summary-Normal: Median aller 10 Aufträge 67.572 ms (Protokoll: warm 67.532 ms, kalt 106.013 ms); L1: Median der 20 Aufträge beider Teile 3.672 ms (Protokolle: 3.703 bzw. 3.668,5 ms); Label-Frist OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS = ${fmt(f1l.timeoutMs)} ms laut settings · Faktor DROP/Stopp wie f2-summary.md (134.732 / 48) · Schwellen ${sw.datei}, Commit ${sw.commit} (${sw.datum ?? 'Datum aus Git'}); Label-Fristkriterium laut Planung nicht bewertbar · ${pruefung}`,
    fuss: quellenzeile([
      ['schneider2026', 'Ordner evidenz/1B'],
      ['ulrich2016', 'Abschnitt Load Shedding and Graceful Degradation'],
    ]),
  };

  // ------------------------------------------------------------ M2 Breaker gegen Queue
  const b = d.breaker;
  const M2 = {
    ...basis,
    id: 'M2',
    titel: 'Der Breaker dämpft Ausfälle, keine Hänger',
    inhalt: flaeche(
      frage('Schützt der Circuit Breaker vor einem hängenden Host?', '1B') +
        grafikBox(breakerSvg(b)) +
        `<p class="beleg">Code: Queue-Abbruch gilt als ${mono('aborted')} (${mono('openWeightLlmClient.ts:188')}) und zählt nicht für den Breaker (${mono(':476–478')})</p>`,
    ),
    notiz: privat('M2.notiz', { gesprochen, b, fmt }),
    stichpunkte: privat('M2.stichpunkte', { dauer, b, fmt }),
    zeitS: 50,
    aufbau: 1,
    marke: '1b-breaker',
    quelle: `${b.f1.datei}, ${b.l3.datei} (Commit ${b.f1.commit}, je 4 Aufträge ohne Pause und ohne Live-Last, Budget ${fmt(b.l3.timeoutMs)} ms, Fake-Verzögerung ${fmt(b.l3.fakeDelayMs)} ms) · ${umgebung} · Code am HEAD: apps/backend/src/lib/openWeightLlmClient.ts:183–190 (classifyCaughtError, Z. 188 aborted vor timeout), :476–478 (failureCountsForCircuit), openWeightLlmConfig.ts:9–10 (3 Fehler, 30.000 ms), qaSummaryQueue.ts:259–269 (runWithQueueTimeout, abort QA_SUMMARY_TIMEOUT); interner Status nicht ausgelesen (breaker-l3-summary.md), das Protokoll nennt die Funktion processWithTimeout, gemeint ist runWithQueueTimeout · ${pruefung}`,
    fuss: `Quelle: ${kb('schneider2026', 'Ordner evidenz/1B, Breaker-Folgen')}`,
  };

  // ------------------------------------------------------------ M3 Live-Aktionen
  const zelle = (l, ref, a) => {
    const r = l.live[a].p95Ms / ref.live[a].p95Ms;
    const ueber = r > sw.p95Faktor;
    return `<td class="mono" style="padding:2px 12px;text-align:right${ueber ? ';color:var(--bernstein-text);font-weight:700' : ';color:var(--gedaempft)'}">${prozent(r)}</td>`;
  };
  const gruppe = (consumer, titel, stufe) => {
    const ref = d.finde('f1', consumer);
    const zeilen = ZEILEN_M3[consumer]
      .map(([v, n]) => [d.finde(v, consumer), n])
      .filter(([l]) => l);
    return (
      `<tbody${stufe ? ` data-ab="${stufe}"` : ''}><tr style="border-top:var(--linie-min) solid var(--linie)"><td style="padding:6px 12px 2px 0;font-weight:700">${titel}</td><td style="padding:6px 12px 2px;text-align:right;color:var(--gedaempft);font-size:var(--s-min)">Stopp</td>` +
      AKTIONEN.map(
        ([a]) =>
          `<td class="mono" style="padding:6px 12px 2px;text-align:right;color:var(--gedaempft);font-size:var(--s-min)">${fmt(ref.live[a].p95Ms, 1)} ms</td>`,
      ).join('') +
      `</tr>` +
      zeilen
        .map(
          ([l, n]) =>
            `<tr><td style="padding:2px 12px 2px 18px">${n}</td><td class="mono" style="padding:2px 12px;text-align:right;color:var(--gedaempft)">${fmt(l.n)}</td>${AKTIONEN.map(([a]) => zelle(l, ref, a)).join('')}</tr>`,
        )
        .join('') +
      `</tbody>`
    );
  };
  const reihenM3 = ['summary', 'label']
    .flatMap((c) => [d.finde('f1', c), ...ZEILEN_M3[c].map(([v]) => d.finde(v, c))])
    .filter(Boolean);
  const fehler = reihenM3.reduce((s, l) => s + l.liveFehler, 0);
  const geplant = reihenM3.reduce((s, l) => s + l.liveGeplant, 0);
  const verfehlt = ['summary', 'label'].flatMap((c) =>
    ZEILEN_M3[c]
      .map(([v, n]) => [d.finde(v, c), n, c])
      .filter(
        ([l]) =>
          l &&
          AKTIONEN.some(([a]) => l.live[a].p95Ms / d.finde('f1', c).live[a].p95Ms > sw.p95Faktor),
      ),
  );
  const gehalten = ['summary', 'label'].flatMap((c) =>
    ZEILEN_M3[c]
      .map(([v, n]) => [d.finde(v, c), n, c])
      .filter(
        ([l]) =>
          l &&
          AKTIONEN.every(([a]) => l.live[a].p95Ms / d.finde('f1', c).live[a].p95Ms <= sw.p95Faktor),
      ),
  );
  const maxR = Math.max(
    ...['summary', 'label'].flatMap((c) =>
      ZEILEN_M3[c].flatMap(([v]) => {
        const l = d.finde(v, c);
        return l ? AKTIONEN.map(([a]) => l.live[a].p95Ms / d.finde('f1', c).live[a].p95Ms) : [];
      }),
    ),
  );
  const t = d.transport.label;
  const M3 = {
    ...basis,
    id: 'M3',
    titel: 'Kein Live-Fehler, aber nicht latenzneutral',
    inhalt: flaeche(
      frage('Leiden die Live-Aktionen, wenn die Inferenz gestört ist?', '1B') +
        `<table style="border-collapse:collapse;font-size:24px;width:100%">` +
        `<thead><tr style="color:var(--gedaempft);font-size:var(--s-min)"><td>p95 gegen Stopp desselben Auftrags</td><td style="text-align:right;padding:0 12px">n</td>${AKTIONEN.map(([, n]) => `<td style="text-align:right;padding:0 12px"><b style="color:var(--tinte)">${n}</b></td>`).join('')}</tr></thead>` +
        gruppe('summary', 'Summary', 0) +
        gruppe('label', 'Label', 1) +
        `</table>` +
        `<p class="vermerk">Bernstein: über ${fmt(sw.p95Faktor * 100)} % der Referenz (vorab festgelegt); serielle Reihen auf einem Rechner, Ursache nicht belegt</p>` +
        `<p class="merksatz"><b>${fmt(fehler)} Fehler</b> bei ${fmt(geplant)} Live-Aktionen. Netz bei Labels: ${fmt(t.transportMedianMs, 1)} ms, im Median ${fmt(t.anteilMedianProzent, 2)}&nbsp;% der Zeit beim Client</p>`,
    ),
    notiz: privat('M3.notiz', { prozent, nl, f1l, maxR, gehalten, fmt, fehler, geplant, t }),
    stichpunkte: privat('M3.stichpunkte', { prozent, maxR, gehalten, fmt, fehler, geplant, t }),
    zeitS: 60,
    aufbau: 1,
    marke: '1b-alle',
    quelle: `${reihenM3.map(zeile).join('; ')} · ${umgebung} · p95 gepoolt über alle Fenster und Teilreihen (fasseLaufzeitenZusammen), Referenz je Consumer der eigene Stopp (B0/F1); Summary-Störreihen auf 2b39b9df gegen F1 auf 5e758d0a (versionsübergreifend, Produktionscode unverändert, automatischer Vergleich meldet MANIFEST_MISSING_OR_DIFFERENT); Label auf 7c64dd6a; Fehlerzahl und Live-Aktionen: Summe der Einzelbilanzen der Protokolle; Summary-Normal nicht im Raster (Protokoll rechnet nur F1 gegen Normal) · Transport: ${d.transport.datei} (Analyse-Commit ${d.transport.commit}, ${fmt(t.n)} Label-Normalaufträge) · über der Regel: ${verfehlt.map(([, n, c]) => `${n}/${c}`).join(', ')} · ${pruefung}`,
    fuss: `Quelle: ${kb('schneider2026', 'Ordner evidenz/1B, Transportauswertung')}`,
  };

  // ------------------------------------------------------------ M4 S1 und Entscheidung
  const s1z = (l, ref, a) => {
    const r = l.live[a].p95Ms / ref.live[a].p95Ms;
    const ueber = r > sw.p95Faktor;
    return `<td class="mono" style="padding:6px 12px;text-align:right${ueber ? ';color:var(--bernstein-text);font-weight:700' : ';color:var(--gedaempft)'}">${prozent(r)}</td>`;
  };
  const { label: s1l, summary: s1s } = d.s1;
  const s1Fehler = s1l.liveFehler + s1s.liveFehler;
  const s1Geplant = s1l.liveGeplant + s1s.liveGeplant;
  const s1lUeber = AKTIONEN.filter(
    ([a]) => s1l.live[a].p95Ms / nl.live[a].p95Ms > sw.p95Faktor,
  ).map(([, n]) => n);
  const p = s1l.placement ?? {};
  const M4 = {
    ...basis,
    id: 'M4',
    titel: 'Zweiter Host: Betriebsfrage, nicht Tempo',
    inhalt: flaeche(
      frage('Lohnt die zweite Serverrolle gegenüber einem Host?', '1B') +
        `<table style="border-collapse:collapse;font-size:24px;width:100%">` +
        `<tr style="color:var(--gedaempft);font-size:var(--s-min)"><td>S1: App-Stack auf der LLM-VM, p95 gegen zwei Hosts</td><td style="text-align:right;padding:0 12px">n</td>${AKTIONEN.map(([, n]) => `<td style="text-align:right;padding:0 12px"><b style="color:var(--tinte)">${n}</b></td>`).join('')}<td style="text-align:right;padding:0 0 0 12px">Fehler</td></tr>` +
        [
          [s1l, nl, 'Label'],
          [s1s, ns, 'Summary'],
        ]
          .map(
            ([l, ref, n]) =>
              `<tr style="border-top:var(--linie-min) solid var(--linie)"><td style="padding:6px 12px 6px 0;font-weight:700">${n}</td><td class="mono" style="padding:6px 12px;text-align:right;color:var(--gedaempft)">${fmt(l.n)}</td>${AKTIONEN.map(([a]) => s1z(l, ref, a)).join('')}<td class="mono" style="padding:6px 0 6px 12px;text-align:right">${fmt(l.liveFehler)}</td></tr>`,
          )
          .join('') +
        `</table>` +
        `<p class="vermerk">S1 mit ${fmt(p.vmVcpu ?? 8)} vCPU statt 2 + 8, HTTP auf derselben VM; ungleiche Kapazität, keine Freigabe</p>` +
        `<p data-ab="1" class="merksatz"><b>Schritt 4, Empfehlung (ADR 1B-020):</b> Die Leitplanke bleibt, S1 ist keine Freigabe. Die zweite Rolle ist nur betrieblich zu begründen (getrennte Ressourcen, Wartung, Zuständigkeit), nicht mit Tempo. Kosten: zweites System, Deployment mit Digest und Modellhash, Token-Rotation, Überwachung beider Rollen, bei Schutzbedarf TLS. Folge: Fristen je Host kalibrieren, Ersatzgründe überwachen, Hänger nicht dem Breaker überlassen.</p>` +
        `<p class="beleg">Grenze: Kosten qualitativ, nicht in Stunden; beide VMs auf einem Rechner, also kein unabhängiger Ausfallbereich</p>`,
    ),
    notiz: privat('M4.notiz', { s1lUeber }),
    stichpunkte: privat('M4.stichpunkte', { s1lUeber, fmt, s1Fehler }),
    zeitS: 55,
    aufbau: 1,
    marke: '1b-s1',
    quelle: `${zeile(s1l)}; ${zeile(s1s)} · ${s1l.rechner}, ohne CPU-Pinning · S1 auf llm-host (${fmt(p.vmVcpu ?? 8)} vCPU, App-CPUs ${p.appCpuSet ?? '0,1'}, Encoder ${p.encoderCpus ?? 2} CPUs, ${p.protocol ?? 'http'}, Treiber auf llm-host) gegen Zwei-Host-Normal (Label ${zeile(nl)}; Summary ${zeile(ns)}), Kriterium nur beschreibend (1B-3u4-Planung.md, Nachtrag S1, Commit 4b135fe8); ${fmt(s1Fehler)} Fehler bei ${fmt(s1Geplant)} Aktionen · Entscheidung und Aufwand: adr/1B-020-zweite-rolle-betrieblich-begruenden.md (qualitativ, keine Stunden, Preise oder Energie) · ${pruefung}`,
    fuss: quellenzeile([
      ['schneider2026', 'ADR 1B-020, S1-Protokolle'],
      ['arsnova2026adr0035', 'Kap. 2.1'],
    ]),
  };
  return [M1, M2, M3, M4];
}
