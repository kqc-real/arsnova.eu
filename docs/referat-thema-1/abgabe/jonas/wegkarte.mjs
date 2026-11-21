// Wegkarten oben links: eine Markermaschine für alle Hauptfolien beider Teile (Ergänzt 2026-11-16).
// Eine dünne blaue Linie mit runden Stationen (Farbe nach Auftrag), oben der App-Host, unten der zweite Host
// bzw. der spaCy-Sidecar. Beide Wege (Jonas' Auftrag, Niklas' 1A) entstehen aus denselben Maßen (KARTE) und
// derselben Zeichenfunktion. Je Folie beschreibt eine Marke (MARKEN) den Zustand: Station des Punkts,
// hervorgehobene Strecken (Saum), Zeichen auf der Karte (Ausschlag, Störungszeichen), Ort und Etikett.
// - wegMarke(name): feste Karte in der Folie, nur für den Druck (Endbild der Folie).
// - wegLaeufer(weg, namen): ein beständiger Marker je Weg auf der Bühne; deck.js setzt ihn je Folie aus
//   laeuferZustand(name): der Punkt fährt zwischen Stationen, Säume und Zeichen blenden ein und aus.
import { WEG_STATIONEN } from './grafik.mjs';

const r2 = (n) => Math.round(n * 100) / 100;
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Maße jeder Wegkarte in px (deck-vorlage.html .weg-mini): oben und unten die beiden Ebenen, Linie 3 px in
 * Blau, Stationsring r 6,5 mit 3 px Rand, Hauptstation gefüllt r 9, Hervorhebung einer Strecke als Saum
 * (14 px, 16 % Deckkraft) wie der Ring des Markers (.weg-punkt). x aus WEG_STATIONEN mit Faktor 0,36.
 */
export const KARTE = Object.freeze({
  breite: 450,
  hoehe: 52,
  oben: 15,
  unten: 40,
  x0: 20,
  faktor: 0.36,
  linie: 3,
  linienfarbe: 'var(--blau)',
  ring: 6.5,
  ringRand: 3,
  kern: 9,
  saum: 14,
  saumDeckkraft: 0.16,
});

/** Farbe der Stationen je Auftrag (README „Farbe“: Blau = 1A, Petrol = 1C, Bernstein = 1B). */
const AUFTRAG_FARBE = { '1A': 'var(--blau)', '1B': 'var(--bernstein)', '1C': 'var(--petrol)' };

// ------------------------------------------------------------------ gemeinsame Geometrie

const k = (a, b) => (b - a) * 0.5; // Steuerpunkte wie eine weiche S-Kurve
/** S-Kurve von (xa, ya) nach (xb, yb), waagerecht ein- und auslaufend. */
const kurve = ([xa, ya], [xb, yb]) => [
  'C',
  [xa, ya],
  [xa + k(xa, xb), ya],
  [xb - k(xa, xb), yb],
  [xb, yb],
];
const gerade = (a, b) => ['L', a, b];

/** SVG-Pfad aus zusammenhängenden Segmenten (['L', a, b] oder ['C', p0, p1, p2, p3]). */
function pfadD(segmente) {
  return (
    `M${r2(segmente[0][1][0])} ${r2(segmente[0][1][1])}` +
    segmente
      .map(([typ, , ...p]) =>
        typ === 'L'
          ? `L${r2(p[0][0])} ${r2(p[0][1])}`
          : `C${p.map((q) => q.map(r2).join(' ')).join(' ')}`,
      )
      .join('')
  );
}

/** Punkte entlang der Segmente mit Bogenlänge (für Stationen auf der Linie und offset-path-Anteile). */
function abtasten(segmente) {
  const punkte = [];
  for (const [typ, ...p] of segmente) {
    for (let i = 0; i <= 400; i++) {
      const t = i / 400;
      if (typ === 'L') {
        punkte.push([p[0][0] + (p[1][0] - p[0][0]) * t, p[0][1] + (p[1][1] - p[0][1]) * t]);
      } else {
        const m = 1 - t;
        const f = [m ** 3, 3 * m * m * t, 3 * m * t * t, t ** 3];
        punkte.push([0, 1].map((a) => f.reduce((s, w, j) => s + w * p[j][a], 0)));
      }
    }
  }
  const laenge = [0];
  for (let i = 1; i < punkte.length; i++) {
    laenge.push(
      laenge[i - 1] + Math.hypot(punkte[i][0] - punkte[i - 1][0], punkte[i][1] - punkte[i - 1][1]),
    );
  }
  /** Nächster Punkt auf der Linie zu (x, y) samt Anteil der Bogenlänge in %. */
  return ([x, y]) => {
    let best = 0;
    for (let i = 1; i < punkte.length; i++) {
      if (
        Math.hypot(punkte[i][0] - x, punkte[i][1] - y) <
        Math.hypot(punkte[best][0] - x, punkte[best][1] - y)
      )
        best = i;
    }
    return {
      x: r2(punkte[best][0]),
      y: r2(punkte[best][1]),
      anteil: r2((laenge[best] / laenge.at(-1)) * 100),
    };
  };
}

/**
 * Baut einen Weg aus einer zusammenhängenden Linie (der Punkt fährt per offset-path darauf), den Stationen
 * in Wegreihenfolge und benannten Strecken (Saum). `ganz` ist immer der ganze Weg.
 */
function baueWeg({ id, segmente, ziele, info, strecken, wirkung = null, zeichenOrt = null }) {
  const naechster = abtasten(segmente);
  const stationen = {};
  for (const [name, p] of Object.entries(ziele)) {
    const i = info(name);
    stationen[name] = {
      ...naechster(p),
      auftrag: i.auftrag,
      name: i.name,
      farbe: i.farbe ?? AUFTRAG_FARBE[i.auftrag],
      kern: Boolean(i.kern),
    };
  }
  const d = pfadD(segmente);
  const abschnitte = { ganz: d };
  for (const [name, teile] of Object.entries(strecken))
    abschnitte[name] = teile.map(pfadD).join('');
  return Object.freeze({ id, d, abschnitte, stationen, wirkung, zeichenOrt });
}

// ------------------------------------------------------------------ Weg 1: Jonas' Auftrag (J3 verkleinert)

const mx = (x) => Math.round((KARTE.x0 + (x - WEG_STATIONEN.klick.x) * KARTE.faktor) * 10) / 10;

/**
 * Weg des Auftrags aus J3: oben app-host (Klick, Kontext, Nachprüfung, Gate), Senke zum llm-host (Netz,
 * Inferenz). Kurven wie in J3 (Abstieg ab Kontext + 110, Boden bei Inferenz − 80 usw.).
 * Strecken: `zweiterHost` (Abstieg, Boden, Aufstieg; die Strecke, die 1B 3–4 stört) und `netz` (die
 * beiden Übergänge zwischen den Hosts, hin und zurück; J8 misst den Draht auf beiden Hosts).
 */
function wegAuftrag() {
  const S = WEG_STATIONEN;
  const { oben: o, unten: u } = KARTE;
  const ab = [mx(S.kontext.x + 110), mx(S.inferenz.x - 80)];
  const auf = [mx(S.inferenz.x + 80), mx(S.nachpruefung.x - 90)];
  const hin = kurve([ab[0], o], [ab[1], u]);
  const boden = gerade([ab[1], u], [auf[0], u]);
  const zurueck = kurve([auf[0], u], [auf[1], o]);
  return baueWeg({
    id: 'auftrag',
    segmente: [
      gerade([mx(S.klick.x), o], [ab[0], o]),
      hin,
      boden,
      zurueck,
      gerade([auf[1], o], [mx(S.gate.x), o]),
    ],
    ziele: {
      klick: [mx(S.klick.x), o],
      kontext: [mx(S.kontext.x), o],
      netz: [(ab[0] + ab[1]) / 2, (o + u) / 2],
      inferenz: [mx(S.inferenz.x), u],
      nachpruefung: [mx(S.nachpruefung.x), o],
      gate: [mx(S.gate.x), o],
    },
    info: (name) => ({
      ...S[name],
      farbe: name === 'gate' ? 'var(--rot)' : undefined,
      kern: name === 'inferenz',
    }),
    strecken: { zweiterHost: [[hin, boden, zurueck]], netz: [[hin], [zurueck]] },
    // Störungszeichen stehen auf der Karte über der Senke zum zweiten Host, nicht in der Beschriftung
    zeichenOrt: { x: r2((ab[0] + auf[1]) / 2), y: 2 },
  });
}

// ------------------------------------------------------------------ Weg 2: Niklas' 1A

/**
 * Weg 1A (Neuentwurf 2026-11-16) in derselben Bildsprache und Form wie der Auftragsweg: eine Linie, die der
 * Vortrag ohne Sprung und ohne Rücksprung abfährt. Oben der App-Host: App (N2, N3), dann der Live-Pfad
 * (N4–N7: die Regel und alle Messungen betreffen die Latenz der Live-Aktionen), Senke zum spaCy-Sidecar
 * (N8: CPU und Speicher des Containers), Aufstieg zum Ersatz (N9: die App liefert nach 5 s die
 * lexikalische Wortwolke) und zur Wortwolke (N10: Entscheidung über das Ergebnis, das Lehrende sehen).
 * Teilnehmende, Datenbank, Antwort und Analyse des früheren Entwurfs sind entfallen: Keine Folie handelte
 * von ihnen. Strecken: `live` (App bis zum Abstieg, die Hauptlinie der Live-Aktionen) und `analyse`
 * (Abstieg, spaCy, Aufstieg; der Teil, den die fünf Varianten umschalten).
 */
function weg1A() {
  const { oben: o, unten: u, faktor } = KARTE;
  // Abstieg und Aufstieg so breit wie die Senke im Auftragsweg (160 · 0,36)
  const ab = [170, 170 + 160 * faktor];
  const auf = [ab[1] + 56.8, ab[1] + 56.8 + 160 * faktor];
  const live = gerade([20, o], [ab[0], o]);
  const analyse = [
    kurve([ab[0], o], [ab[1], u]),
    gerade([ab[1], u], [auf[0], u]),
    kurve([auf[0], u], [auf[1], o]),
  ];
  const namen = {
    app: 'App-Host',
    live: 'Live-Pfad',
    spacy: 'spaCy',
    ersatz: 'Ersatz',
    wortwolke: 'Wortwolke',
  };
  return baueWeg({
    id: '1a',
    segmente: [live, ...analyse, gerade([auf[1], o], [434, o])],
    ziele: {
      app: [20, o],
      live: [95, o],
      spacy: [(ab[1] + auf[0]) / 2, u],
      ersatz: [372, o],
      wortwolke: [434, o],
    },
    info: (name) => ({ auftrag: '1A', name: namen[name], kern: name === 'spacy' }),
    strecken: { live: [[live]], analyse: [analyse] },
    // Wirkungszeichen (N7) auf dem Live-Pfad zwischen der Station und dem Abstieg
    wirkung: { x: r2((95 + ab[0]) / 2), y: o },
  });
}

export const WEG_AUFTRAG = wegAuftrag();
export const WEG_1A = weg1A();
export const WEGE = Object.freeze({ auftrag: WEG_AUFTRAG, '1a': WEG_1A });

// ------------------------------------------------------------------ Zeichen

/** Störungszeichen, 22 px wie die Etiketten, in Bernstein; Reihenfolge wie STOERUNGEN auf M1. */
export const STOERUNG_ZEICHEN = Object.freeze({
  stopp: {
    text: 'Stopp',
    svg: '<rect x="5" y="5" width="12" height="12" rx="2" fill="currentColor"/>',
  },
  belegt: {
    text: 'Slot belegt',
    svg: '<circle cx="11" cy="11" r="7.5" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M6.5 11h9" stroke="currentColor" stroke-width="3"/>',
  },
  drop: {
    text: 'DROP',
    svg: '<path d="M2.5 11h11M9.5 6.5l4.5 4.5-4.5 4.5M18.5 4v14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  // L1/L2: Netzverzögerung +50/+500 ms: gestrichelter Pfeil
  langsam: {
    text: 'Netz langsam',
    svg: '<path d="M2.5 11h2.5M8 11h2.5M13.5 11h1.5M12.5 6.5l4.5 4.5-4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  spaet: {
    text: 'zu spät',
    svg: '<circle cx="11" cy="11" r="7.5" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M11 6.5V11l3.2 2.2" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  },
});
const zeichen = (name) =>
  `<svg class="weg-zeichen" data-zeichen="${name}" viewBox="0 0 22 22" width="22" height="22" aria-hidden="true" focusable="false">${STOERUNG_ZEICHEN[name].svg}</svg>`;
const reihe = (z, attr = '') =>
  `<span class="weg-zeichen-reihe"${attr}>${z.map(zeichen).join('')}</span>`;

// ------------------------------------------------------------------ Wegmarken (Zustand je Folie)

/**
 * Marke je Folie (Folienfeld `marke`; Jonas' Stationsfolien ohne `marke` bekommen `station:<name>`):
 * - weg: 'auftrag' oder '1a'; teil: Etiketten der Beschriftung; text: nur der Ort (Kopfgrammatik)
 * - station: Punkt an dieser Station (fehlt: kein Punkt, etwa auf Übersichtsfolien)
 * - abschnitte: hervorgehobene Strecken als Saum in `farbe` (gestrichelt: der verglichene Teil)
 * - wirkung: Ausschlag auf dem Live-Pfad (N7)
 * - stufen: Störungszeichen je Aufbaustufe (M1; wie STUFE_1B34 in folien-1b34.mjs); zeichen: ohne Stufen
 * Jede Hervorhebung und jedes Zeichen steht nur, wo es die Aussage der Folie zeigt (Begründung je Eintrag).
 */
export const MARKEN = Object.freeze({
  // J1, J2, J3 (eigener großer Weg), J4, J13b, J15: der ganze Weg ohne Punkt und ohne Hervorhebung
  auftrag: { weg: 'auftrag', teil: ['1C', '1B'], text: 'Weg eines Auftrags' },
  // J8, J8b: Netz gemessen am Draht auf beiden Hosts bzw. Strecke gegen lokal: beide Übergänge im Saum
  'auftrag-netz': {
    weg: 'auftrag',
    teil: ['1B'],
    station: 'netz',
    abschnitte: [{ name: 'netz' }],
    farbe: 'var(--bernstein)',
    text: 'Netz',
  },
  // J9: Zeitzerlegung des ganzen Auftrags, die Inferenz trägt sie: Saum über den ganzen Weg, Punkt dort
  'auftrag-zeit': {
    weg: 'auftrag',
    teil: ['1B'],
    station: 'inferenz',
    abschnitte: [{ name: 'ganz' }],
    text: 'Inferenz',
  },
  // J10b: Runtime-Container gestoppt: dasselbe Stoppzeichen wie Störung F1 auf M1
  'auftrag-stopp': {
    weg: 'auftrag',
    teil: ['1B'],
    station: 'inferenz',
    zeichen: ['stopp'],
    text: 'Inferenz',
  },
  // J11: Timeout ab Werk (90 s) endet vor der Inferenz: Zeichen „zu spät“ wie Störung L3 auf M1
  'auftrag-timeout': {
    weg: 'auftrag',
    teil: ['1B'],
    station: 'inferenz',
    zeichen: ['spaet'],
    text: 'Inferenz',
  },
  // N1: Einstieg mit der Antwort, der ganze Weg ohne Punkt
  '1a-weg': { weg: '1a', teil: ['1A'], text: 'Weg der Analyse' },
  // N2: fünf Dienste teilen sich den App-Host
  '1a-app': { weg: '1a', teil: ['1A'], station: 'app', text: 'App-Host' },
  // N3: Last und Daten auf dem App-Host gleich, die fünf Varianten schalten nur die Analyse um (aus,
  // lexikalisch, spaCy normal, gedrosselt, hinter Proxy): Punkt bleibt an der App, Saum auf der Analyse
  '1a-varianten': {
    weg: '1a',
    teil: ['1A'],
    station: 'app',
    abschnitte: [{ name: 'analyse' }],
    text: 'App-Host',
  },
  // N4, N6, N6b: die Regel vergleicht die Live-Latenz mit und ohne Analyse: Live-Pfad im Saum, die
  // umgeschaltete Analyse gestrichelt
  '1a-regel': {
    weg: '1a',
    teil: ['1A'],
    station: 'live',
    abschnitte: [{ name: 'live' }, { name: 'analyse', gestrichelt: true }],
    text: 'Live-Pfad',
  },
  // N5: alle Live-Aktionen kamen an: nur der Live-Pfad im Saum
  '1a-live': {
    weg: '1a',
    teil: ['1A'],
    station: 'live',
    abschnitte: [{ name: 'live' }],
    text: 'Live-Pfad',
  },
  // N7: Ausreißer der Beitritte im Lauf V3/Block 5: Ausschlag auf dem Live-Pfad
  '1a-wirkung': { weg: '1a', teil: ['1A'], station: 'live', wirkung: true, text: 'Live-Pfad' },
  // N8: CPU und Speicher des spaCy-Containers
  '1a-spacy': { weg: '1a', teil: ['1A'], station: 'spacy', text: 'spaCy' },
  // N9: nach 5 s liefert die App den lexikalischen Ersatz
  '1a-ersatz': { weg: '1a', teil: ['1A'], station: 'ersatz', text: 'Ersatz' },
  // N10: Entscheidung über das Ergebnis, das Lehrende sehen (lexikalische Wortwolke bleibt)
  '1a-wortwolke': { weg: '1a', teil: ['1A'], station: 'wortwolke', text: 'Wortwolke' },
  // M1: die Strecke über den zweiten Host in Bernstein, je Stufe die Störungen der Folie
  '1b-stoerung': {
    weg: 'auftrag',
    teil: ['1B'],
    abschnitte: [{ name: 'zweiterHost' }],
    farbe: 'var(--bernstein)',
    text: 'Zweiter Host',
    stufen: [
      { ab: 0, bis: 0, zeichen: [] },
      { ab: 1, bis: 1, zeichen: ['stopp', 'belegt'] },
      { ab: 2, bis: 2, zeichen: ['drop', 'langsam'] },
      { ab: 3, zeichen: ['spaet'] },
    ],
  },
  // M2: Breaker gegen Queue: erst die Folge mit gestoppter Runtime, dann die Folge mit Antworten nach der Frist
  '1b-breaker': {
    weg: 'auftrag',
    teil: ['1B'],
    abschnitte: [{ name: 'zweiterHost' }],
    farbe: 'var(--bernstein)',
    text: 'Zweiter Host',
    stufen: [
      { ab: 0, bis: 0, zeichen: ['stopp'] },
      { ab: 1, zeichen: ['spaet'] },
    ],
  },
  // M3: Rückwirkung aller Störungen auf die Live-Aktionen
  '1b-alle': {
    weg: 'auftrag',
    teil: ['1B'],
    abschnitte: [{ name: 'zweiterHost' }],
    farbe: 'var(--bernstein)',
    zeichen: ['stopp', 'belegt', 'drop', 'langsam', 'spaet'],
    text: 'Zweiter Host',
  },
  // M4: S1, App-Stack und Runtime auf einem Host: die Strecke über den zweiten Host entfällt (gestrichelt)
  '1b-s1': {
    weg: 'auftrag',
    teil: ['1B'],
    abschnitte: [{ name: 'zweiterHost', gestrichelt: true }],
    farbe: 'var(--bernstein)',
    text: 'Ein Host (S1)',
  },
});

/** Marke zu einem Namen; `station:<name>` ist Jonas' Station ohne Zusatz (Ort und Etikett der Station). */
export function marke(name) {
  const st = /^station:(.+)$/.exec(name)?.[1];
  if (st) {
    const s = WEG_AUFTRAG.stationen[st];
    if (!s) throw new Error(`Unbekannte Station ${st}`);
    return { weg: 'auftrag', teil: [s.auftrag], station: st, text: s.name };
  }
  const m = MARKEN[name];
  if (!m) throw new Error(`Unbekannte Wegmarke: ${name}`);
  const s = m.station ? WEGE[m.weg].stationen[m.station] : null;
  if (m.station && !s) throw new Error(`Unbekannte Station ${m.station} auf Weg ${m.weg}`);
  for (const a of m.abschnitte ?? [])
    if (!WEGE[m.weg].abschnitte[a.name])
      throw new Error(`Unbekannter Abschnitt ${a.name} auf Weg ${m.weg}`);
  return m;
}

/**
 * Name der Marke einer Folie: Stationsfolien (Jonas) zeigen ihre Station, mit `marke` samt Zusatz an derselben
 * Station; eine Folie, die den Weg selbst groß zeigt (J3), und Folien ohne Station tragen ihre `marke`.
 * @returns {string|null}
 */
export function markeVon(f, { eigenerWeg = false } = {}) {
  if (f.station && !eigenerWeg) {
    if (!f.marke) return `station:${f.station}`;
    if (marke(f.marke).station !== f.station)
      throw new Error(`${f.id}: Marke ${f.marke} steht nicht an Station ${f.station}`);
    return f.marke;
  }
  return f.marke ?? null;
}

/**
 * Sichtbarer Text einer Wegmarke: nur der Ort (Kopfgrammatik, README „Designregeln“). Wirkung und Störungen
 * zeigt die Karte als Zeichen, nie als Zusatz in der Beschriftung.
 */
export function markeText(name) {
  return marke(name).text;
}

/** Stufen der Zeichen: M1 je Aufbaustufe, sonst eine Stufe ab 0. */
const stufenVon = (m) => m.stufen ?? (m.zeichen?.length ? [{ ab: 0, zeichen: m.zeichen }] : []);

/** Schlüssel eines Saums (Strecke, Farbe, gestrichelt), gleich in Druckkarte und Läufer. */
const saumSchluessel = (m, a) =>
  `${a.name}|${m.farbe ?? KARTE.linienfarbe}${a.gestrichelt ? '|gestrichelt' : ''}`;

/** aria-label einer Marke: Ort, Teile, Zeichen (Störungen in Stufenreihenfolge), Wirkung. */
function markeLabel(name) {
  const m = marke(name);
  const z = stufenVon(m).flatMap((st) => st.zeichen);
  return (
    `Ort auf dem Weg: ${m.text} (${m.teil.join(', ')})` +
    (z.length ? `; Störungen: ${z.map((n) => STOERUNG_ZEICHEN[n].text).join(', ')}` : '') +
    (m.wirkung ? '; Ausschlag: Wirkung auf den Live-Pfad' : '')
  );
}

// ------------------------------------------------------------------ Zeichnen

/** Saum einer Strecke: breiter, blasser Strich in der Farbe der Marke (gestrichelt: der verglichene Teil). */
function saumSvg(weg, schluessel, attr) {
  const [name, farbe, gestrichelt] = schluessel.split('|');
  // gestrichelt mit stumpfen Enden, sonst schließen die runden Kappen des breiten Saums die Lücken
  const strich = gestrichelt ? ' stroke-dasharray="9 7"' : '';
  const kappe = gestrichelt ? 'butt' : 'round';
  // Eine andere Farbe als die Linie färbt auch die Linie (1B 3–4: Strecke über den zweiten Host in Bernstein)
  const linie =
    farbe === KARTE.linienfarbe
      ? ''
      : `<path d="${weg.abschnitte[name]}" fill="none" stroke="${farbe}" stroke-width="${KARTE.linie}" stroke-linecap="round"/>`;
  return (
    `<g data-abschnitt="${name}"${attr}><path d="${weg.abschnitte[name]}" fill="none" stroke="${farbe}" stroke-opacity="${KARTE.saumDeckkraft}" stroke-width="${KARTE.saum}" stroke-linecap="${kappe}"${strich}/>` +
    `${linie}</g>`
  );
}

/** Ausschlag auf der Linie (Latenzspitze), in Blau wie die Linie. */
const ausschlagSvg = (w, attr = '') =>
  `<path data-wirkung${attr} d="M${w.x - 14} ${w.y}h5l4 -11 5 22 4 -11h5" fill="none" stroke="${KARTE.linienfarbe}" stroke-width="${KARTE.linie}" stroke-linecap="round" stroke-linejoin="round"/>`;

/**
 * Zeichnet eine Wegkarte: Linie, Säume, Ausschlag, Stationen (Ring, Hauptstation gefüllt). Keine Beschriftung,
 * kein Punkt. Die Linie ist auf beiden Wegen blau, die Stationen tragen die Farbe ihres Auftrags.
 * @param {typeof WEG_AUFTRAG} weg
 * @param {{ saeume?: string[], wirkung?: boolean, laeufer?: boolean }} o Läufer: alle Säume und der
 *   Ausschlag stehen bereit (ausgeblendet), deck.js schaltet sie je Folie ein
 */
export function karteSvg(weg, { saeume = [], wirkung = false, laeufer = false } = {}) {
  const K = KARTE;
  const linie = `<path d="${weg.d}" fill="none" stroke="${K.linienfarbe}" stroke-width="${K.linie}" stroke-linecap="round"/>`;
  const attr = (s) => (laeufer ? ` class="weg-saum" data-saum="${esc(s)}"` : '');
  const hervor = saeume.map((s) => saumSvg(weg, s, attr(s))).join('');
  const kreise = Object.entries(weg.stationen)
    .map(([name, s]) =>
      s.kern
        ? `<circle data-station="${name}" cx="${s.x}" cy="${s.y}" r="${K.kern}" fill="${s.farbe}"/>`
        : `<circle data-station="${name}" cx="${s.x}" cy="${s.y}" r="${K.ring}" fill="#fff" stroke="${s.farbe}" stroke-width="${K.ringRand}"/>`,
    )
    .join('');
  const ausschlag =
    wirkung && weg.wirkung ? ausschlagSvg(weg.wirkung, laeufer ? ' class="weg-wirkung"' : '') : '';
  return (
    `<svg class="weg-mini-karte" data-weg="${weg.id}" viewBox="0 0 ${K.breite} ${K.hoehe}" width="${K.breite}" height="${K.hoehe}" aria-hidden="true" focusable="false">` +
    `${linie}${hervor}${ausschlag}${kreise}</svg>`
  );
}

const etikett = (auftrag) =>
  `<span class="etikett etikett-${auftrag.toLowerCase()}">${auftrag}</span>`;

/**
 * Feste Wegmarke oben links in der Folie (Druck/PDF: Endbild der Folie; auf dem Bildschirm zeigt der
 * Läufer denselben Zustand mit Bewegung).
 */
export function wegMarke(name) {
  const m = marke(name);
  const weg = WEGE[m.weg];
  const karte = karteSvg(weg, {
    saeume: (m.abschnitte ?? []).map((a) => saumSchluessel(m, a)),
    wirkung: m.wirkung,
  });
  const s = m.station ? weg.stationen[m.station] : null;
  const punkt = s ? `<div class="weg-punkt" style="left:${s.x}px;top:${s.y}px"></div>` : '';
  const stufen = stufenVon(m);
  if (stufen.length && !weg.zeichenOrt) throw new Error(`Weg ${m.weg} hat keinen Ort für Zeichen`);
  const zeichenSpalte = m.stufen
    ? stufen
        .map(
          (st) =>
            `<span class="weg-stufe" data-ab="${st.ab}"${st.bis === undefined ? '' : ` data-bis="${st.bis}"`}>${reihe(st.zeichen)}</span>`,
        )
        .join('')
    : stufen.length
      ? reihe(stufen[0].zeichen)
      : '';
  const zeichenOrt = zeichenSpalte
    ? `<span class="weg-zeichen-ort" style="left:${weg.zeichenOrt.x}px;top:${weg.zeichenOrt.y}px">${zeichenSpalte}</span>`
    : '';
  return (
    `<div class="weg-mini weg-marke" data-marke="${esc(name)}"${m.station ? ` data-aktiv="${m.station}"` : ''} role="img" aria-label="${esc(markeLabel(name))}">` +
    karte +
    zeichenOrt +
    punkt +
    `<p class="weg-beschriftung" aria-hidden="true"><span class="weg-name">${esc(m.text)}</span>${m.teil.map(etikett).join('')}</p></div>`
  );
}

// ------------------------------------------------------------------ Läufer (beständiger Marker je Weg)

/** Schlüssel eines Zeichensatzes (Reihe auf der Karte); leer = keine Zeichen. */
const satz = (z) => z.join(',');

/**
 * Zustand einer Marke für deck.js (setzeMarker): Weg, Anteil der Station auf der Linie (offset-distance),
 * Ort, Etiketten, Säume, Ausschlag, Zeichensätze je Aufbaustufe und aria-label.
 */
export function laeuferZustand(name) {
  const m = marke(name);
  const weg = WEGE[m.weg];
  return {
    name,
    weg: m.weg,
    station: m.station ?? null,
    anteil: m.station ? weg.stationen[m.station].anteil : null,
    text: m.text,
    teil: m.teil,
    saeume: (m.abschnitte ?? []).map((a) => saumSchluessel(m, a)),
    wirkung: Boolean(m.wirkung),
    stufen: stufenVon(m).map((st) => ({ ab: st.ab, bis: st.bis ?? null, satz: satz(st.zeichen) })),
    label: markeLabel(name),
  };
}

/**
 * Beständiger Marker eines Wegs auf der Bühne (ein Element für alle Folien des Wegs): Karte mit allen Säumen
 * und Zeichen, die eine der Marken braucht (ausgeblendet), ein Punkt auf offset-path, Beschriftung.
 * @param {'auftrag'|'1a'} wegId
 * @param {string[]} namen Marken der Folien dieses Wegs
 */
export function wegLaeufer(wegId, namen) {
  const weg = WEGE[wegId];
  const zustaende = namen.map(laeuferZustand);
  if (zustaende.some((z) => z.weg !== wegId)) throw new Error(`Marke auf fremdem Weg in ${wegId}`);
  const saeume = [...new Set(zustaende.flatMap((z) => z.saeume))];
  const wirkung = zustaende.some((z) => z.wirkung);
  const saetze = [
    ...new Set(zustaende.flatMap((z) => z.stufen.map((st) => st.satz)).filter(Boolean)),
  ];
  if (saetze.length && !weg.zeichenOrt) throw new Error(`Weg ${wegId} hat keinen Ort für Zeichen`);
  const zeichenOrt = saetze.length
    ? `<span class="weg-zeichen-ort" style="left:${weg.zeichenOrt.x}px;top:${weg.zeichenOrt.y}px">` +
      saetze
        .map(
          (s) => `<span class="weg-stufe weg-satz" data-satz="${s}">${reihe(s.split(','))}</span>`,
        )
        .join('') +
      `</span>`
    : '';
  return (
    `<div class="weg-mini weg-laeufer" data-weg="${wegId}" role="img" aria-label="">` +
    karteSvg(weg, { saeume, wirkung, laeufer: true }) +
    zeichenOrt +
    `<div class="weg-punkt" style="offset-path:path('${weg.d}')"></div>` +
    `<p class="weg-beschriftung" aria-hidden="true"><span class="weg-name"></span><span class="weg-etiketten"></span></p></div>`
  );
}
