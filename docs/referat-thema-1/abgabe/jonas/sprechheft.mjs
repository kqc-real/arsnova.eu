// Sprechheft und Referentenansicht (Design: specs/2026-11-17-sprechheft-design.md).
// Je Folie eine Seite: Vortrag (notiz, Stufen an [Weiter] getrennt), Stichpunkte, Verstehen, Begriffe,
// Fragen, Übergang. Vortrag, Stichpunkte und Kopf kommen aus den Foliendaten; die übrigen Teile aus
// abgabe/sprechheft/<Kennung>.md.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Ordner der Heftseiten, relativ zu docs/referat-thema-1; privat (eigenes Repo, von Git ignoriert) */
export const HEFT_ORDNER = 'privat/sprechheft';
export const ABSCHNITTE = ['Verstehen', 'Begriffe', 'Fragen', 'Übergang'];

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const ohneTags = (s) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** Inline-Markdown: **fett**, `code`, [Text](Ziel) → Text; alles andere als Text. */
export function mdInline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
}

/** Block-Markdown: Absätze, Listen (- …), Zwischenüberschriften (#### …). */
export function mdBlock(md) {
  const bloecke = String(md ?? '')
    .trim()
    .split(/\n\s*\n/);
  return bloecke
    .map((b) => {
      const zeilen = b.split('\n');
      if (zeilen.every((z) => /^\s*[-*] /.test(z) || /^\s{2,}\S/.test(z))) {
        const punkte = [];
        for (const z of zeilen) {
          if (/^\s*[-*] /.test(z)) punkte.push(z.replace(/^\s*[-*] /, ''));
          else punkte[punkte.length - 1] += ` ${z.trim()}`;
        }
        return `<ul>${punkte.map((p) => `<li>${mdInline(p)}</li>`).join('')}</ul>`;
      }
      if (/^#{3,4} /.test(zeilen[0])) {
        const [kopf, ...rest] = zeilen;
        return (
          `<h4>${mdInline(kopf.replace(/^#+ /, ''))}</h4>` +
          (rest.length ? `<p>${mdInline(rest.join(' '))}</p>` : '')
        );
      }
      return `<p>${mdInline(zeilen.join(' '))}</p>`;
    })
    .join('');
}

/** Eine Heftseite (Markdown) in ihre Abschnitte zerlegen; fehlende Abschnitte sind leer. */
export function zerlegeSeite(md) {
  const teile = {};
  const treffer = [...md.matchAll(/^## (.+)$/gm)];
  treffer.forEach((t, i) => {
    const ende = i + 1 < treffer.length ? treffer[i + 1].index : md.length;
    teile[t[1].trim()] = md.slice(t.index + t[0].length, ende).trim();
  });
  const begriffe = [];
  for (const z of (teile.Begriffe ?? '').split('\n')) {
    const m = z.match(/^\s*[-*] \*\*(.+?):?\*\*:?\s*(.*)$/);
    if (m) begriffe.push({ begriff: m[1].replace(/:$/, ''), text: m[2] });
    else if (z.trim() && begriffe.length) begriffe[begriffe.length - 1].text += ` ${z.trim()}`;
  }
  const fragen = [];
  const fq = teile.Fragen ?? '';
  const ft = [...fq.matchAll(/^### (.+)$/gm)];
  ft.forEach((t, i) => {
    const ende = i + 1 < ft.length ? ft[i + 1].index : fq.length;
    fragen.push({ frage: t[1].trim(), antwort: fq.slice(t.index + t[0].length, ende).trim() });
  });
  return {
    abschnitte: Object.keys(teile),
    verstehen: teile.Verstehen ?? '',
    begriffe,
    fragen,
    uebergang: teile['Übergang'] ?? '',
  };
}

/** Alle Heftseiten: Kennung → zerlegte Seite (samt Rohtext für Prüfungen). */
export function ladeHeft(root) {
  const ordner = join(root, HEFT_ORDNER);
  const heft = {};
  if (!existsSync(ordner)) return heft;
  for (const datei of readdirSync(ordner).filter((d) => d.endsWith('.md'))) {
    const roh = readFileSync(join(ordner, datei), 'utf8');
    heft[datei.replace(/\.md$/, '')] = { ...zerlegeSeite(roh), roh };
  }
  return heft;
}

/**
 * Einträge je Folie für Heft und Referentenansicht. `liste` in Vortragsreihenfolge (Hauptteil, dann
 * Anhang und Reserve); kumuliert zählt nur der Hauptteil dieser Person.
 */
export function heftEintraege(liste, heft) {
  let kumuliert = 0;
  return liste.map((f) => {
    const reserve = f.teil === 'reserve';
    if (!reserve) kumuliert += f.zeitS ?? 0;
    const s = heft[f.id];
    return {
      id: f.id,
      titel: ohneTags(f.titel),
      sprecher: f.sprecher ?? (f.teil === 'niklas' ? 'niklas' : f.teil === 'jonas' ? 'jonas' : ''),
      reserve,
      zeitS: reserve ? 0 : (f.zeitS ?? 0),
      kumuliertS: reserve ? null : kumuliert,
      aufbau: Number(f.aufbau ?? 0),
      vortrag: String(f.notiz ?? '')
        .split('[Weiter]')
        .map((t) => ohneTags(t))
        .filter(Boolean),
      stichpunkte: (f.stichpunkte ?? []).map((p) => ohneTags(p)),
      quelle: ohneTags(f.quelle ?? ''),
      verstehen: s ? mdBlock(s.verstehen) : '',
      begriffe: s ? s.begriffe.map((b) => ({ begriff: b.begriff, html: mdInline(b.text) })) : [],
      fragen: s ? s.fragen.map((q) => ({ frage: q.frage, html: mdBlock(q.antwort) })) : [],
      uebergang: s ? mdBlock(s.uebergang) : '',
      fehlt: !s,
    };
  });
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

const HEFT_STIL = `
:root{--tinte:#16202c;--text-2:#3d4757;--gedaempft:#566173;--linie:#c9d2de;--raster:#e8edf3;--blau:#0b5ea8;--bernstein:#b45309;--petrol:#0f766e;--grund:#fff;--flaeche:#f5f7fa}
*{box-sizing:border-box}
body{margin:0;background:var(--grund);color:var(--tinte);font:18px/1.55 Inter,'Helvetica Neue',Arial,system-ui,sans-serif}
code{font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;font-size:.9em;background:var(--flaeche);padding:0 .25em;border-radius:3px}
h1{font-size:30px;margin:0 0 6px}h2{font-size:24px;margin:0;color:var(--blau)}
h3{font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:var(--gedaempft);margin:22px 0 8px}
h4{font-size:17px;margin:14px 0 4px}
p{margin:0 0 10px}ul{margin:0 0 10px;padding-left:22px}li{margin:0 0 4px}
.kopf{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;border-bottom:2px solid var(--linie);padding-bottom:8px;margin-bottom:6px}
.kopf .meta{color:var(--gedaempft);font-size:15px}
.vortrag p{font-size:20px;line-height:1.6;margin:0 0 6px}
.weiter{display:inline-block;margin:4px 0 8px;font:600 12px/1 'IBM Plex Mono',monospace;color:var(--bernstein);border:1px solid var(--bernstein);border-radius:3px;padding:3px 6px}
.stich li{font-size:16px}
.begriffe dt{font-weight:700;margin-top:8px}.begriffe dd{margin:0 0 4px}
details.frage{border:1px solid var(--linie);border-radius:6px;margin:0 0 8px;padding:8px 12px;background:var(--grund)}
details.frage summary{font-weight:600;cursor:pointer}
details.frage[open]{background:var(--flaeche)}
.quelle{font-size:13px;color:var(--gedaempft)}
.fehlt{color:var(--bernstein);font-weight:600}
`;

function seiteHtml(e, { offen = false, zeitBezug = '' } = {}) {
  const stufen = e.vortrag
    .map((t, i) => `${i ? `<span class="weiter">[Weiter] Stufe ${i}</span>` : ''}<p>${esc(t)}</p>`)
    .join('');
  return (
    `<section class="seite" id="s-${esc(e.id)}">` +
    `<div class="kopf"><h2>${esc(e.id)} · ${esc(e.titel)}</h2>` +
    `<span class="meta">${e.reserve ? 'Reserve, nur auf Nachfrage (Taste r)' : `${e.zeitS} s · bis hier ${mmss(e.kumuliertS)} min${zeitBezug ? ` (${zeitBezug})` : ''}`}${e.aufbau ? ` · ${e.aufbau} Aufbaustufe${e.aufbau > 1 ? 'n' : ''}` : ''}${e.sprecher ? ` · spricht ${e.sprecher === 'niklas' ? 'Niklas' : 'Jonas'}` : ''}</span></div>` +
    (e.fehlt ? `<p class="fehlt">Heftseite fehlt (abgabe/sprechheft/${esc(e.id)}.md)</p>` : '') +
    `<h3>Vortrag</h3><div class="vortrag">${stufen}</div>` +
    (e.stichpunkte.length
      ? `<h3>Stichpunkte</h3><ul class="stich">${e.stichpunkte.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
      : '') +
    (e.verstehen ? `<h3>Verstehen</h3><div class="verstehen">${e.verstehen}</div>` : '') +
    (e.begriffe.length
      ? `<h3>Begriffe</h3><dl class="begriffe">${e.begriffe.map((b) => `<dt>${esc(b.begriff)}</dt><dd>${b.html}</dd>`).join('')}</dl>`
      : '') +
    (e.fragen.length
      ? `<h3>Fragen (${e.fragen.length})</h3>${e.fragen.map((q) => `<details class="frage"${offen ? ' open' : ''}><summary>${esc(q.frage)}</summary>${q.html}</details>`).join('')}`
      : '') +
    (e.uebergang ? `<h3>Übergang</h3><div class="uebergang">${e.uebergang}</div>` : '') +
    (e.quelle ? `<p class="quelle"><b>Quelle:</b> ${esc(e.quelle)}</p>` : '') +
    `</section>`
  );
}

/** Begriffe aller Seiten, alphabetisch, gleiche Begriffe einmal (erste Erklärung) mit Fundstellen. */
function glossar(eintraege) {
  const je = new Map();
  for (const e of eintraege) {
    for (const b of e.begriffe) {
      const k = b.begriff.toLowerCase();
      if (!je.has(k)) je.set(k, { ...b, folien: [] });
      je.get(k).folien.push(e.id);
    }
  }
  return [...je.values()].sort((a, b) => a.begriff.localeCompare(b.begriff, 'de'));
}

/** Sprechheft einer Person als eigenständige HTML-Datei (eine Druckseite je Folie). */
export function baueHeftHtml(eintraege, { person, stand, zeitBezug = '' }) {
  const g = glossar(eintraege);
  const haupt = eintraege.filter((e) => !e.reserve);
  const inhalt =
    `<nav class="inhalt"><h3>Folien</h3><ol>${eintraege.map((e) => `<li><a href="#s-${esc(e.id)}">${esc(e.id)} · ${esc(e.titel)}</a>${e.reserve ? ' <span class="quelle">Reserve</span>' : ''}</li>`).join('')}</ol>` +
    `<p><a href="#glossar">Glossar (${g.length} Begriffe)</a></p></nav>`;
  return (
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Sprechheft ${esc(person)}</title><style>${HEFT_STIL}
main{max-width:980px;margin:0 auto;padding:32px 24px 80px}
.seite{padding:28px 0;border-top:1px solid var(--linie)}
nav.inhalt ol{columns:2;column-gap:32px;font-size:15px}
nav.inhalt a,.glossar a{color:var(--blau);text-decoration:none}
@media print{body{font-size:12pt}.seite{break-before:page;border:0}details.frage>*{display:block}nav.inhalt{break-after:page}}
</style></head><body><main>` +
    `<h1>Sprechheft ${esc(person)}</h1>` +
    `<p class="quelle">Referat Thema 1 · ${haupt.length} Folien im Vortrag, ${eintraege.length - haupt.length} in der Reserve · Stand ${esc(stand)}. ` +
    `Erzeugt von abgabe/jonas/bau.mjs aus den Foliendaten und abgabe/sprechheft/*.md; nicht von Hand ändern. ` +
    `„Vortrag“ ist zum Ablesen und passt in die Redezeit; alles darunter dient dem Verstehen und den Fragen. ` +
    `Im Deck öffnet Taste n die Referentenansicht mit denselben Inhalten.</p>` +
    inhalt +
    eintraege.map((e) => seiteHtml(e, { offen: true, zeitBezug })).join('') +
    `<section class="seite glossar" id="glossar"><h2>Glossar</h2><dl class="begriffe">` +
    g
      .map(
        (b) =>
          `<dt>${esc(b.begriff)} <span class="quelle">${b.folien.map((id) => `<a href="#s-${esc(id)}">${esc(id)}</a>`).join(', ')}</span></dt><dd>${b.html}</dd>`,
      )
      .join('') +
    `</dl></section></main></body></html>`
  );
}

/**
 * Referentenansicht: eigenständige Seite, die das Deck (Taste n) in ein zweites Fenster schreibt. Das Deck
 * ruft window.referentZeige({ id, stufe, naechste }) bei jedem Folien- und Stufenwechsel auf; Pfeiltasten im
 * Referentenfenster steuern das Deck (opener.deck.taste).
 */
export function baueReferentHtml(eintraege) {
  const daten = Object.fromEntries(eintraege.map((e) => [e.id, e]));
  return (
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Referentenansicht</title><style>${HEFT_STIL}
body{font-size:var(--gr,18px)}
.leiste{position:sticky;top:0;z-index:2;display:flex;gap:18px;align-items:center;flex-wrap:wrap;background:var(--tinte);color:#fff;padding:10px 20px}
.leiste .id{font:700 22px Inter,system-ui,sans-serif}.leiste .zeit{font:600 22px 'IBM Plex Mono',monospace;margin-left:auto}
.leiste .soll{color:#c9d2de;font-size:15px}.leiste .naechste{color:#c9d2de;font-size:15px}
.leiste button{font:inherit;font-size:14px;background:#2b3646;color:#fff;border:0;border-radius:4px;padding:4px 10px;cursor:pointer}
.raster{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:28px;padding:18px 24px 60px}
.vortrag p{opacity:.45}.vortrag p.jetzt{opacity:1;border-left:4px solid var(--bernstein);padding-left:12px}
.vortrag p.vorbei{opacity:.6}
.links,.rechts{min-width:0}
@media (max-width:1000px){.raster{grid-template-columns:1fr}}
</style></head><body>` +
    `<div class="leiste"><span class="id" id="r-id">–</span><span id="r-stufe" class="soll"></span><span id="r-naechste" class="naechste"></span>` +
    `<span class="soll" id="r-soll"></span><span class="zeit" id="r-uhr">0:00</span>` +
    `<button id="r-start" type="button">Uhr neu</button><button id="r-klein" type="button">A−</button><button id="r-gross" type="button">A+</button></div>` +
    `<div class="raster"><div class="links" id="r-links"></div><div class="rechts" id="r-rechts"></div></div>` +
    // Ohne Protokoll vor Adressen: das Deck bleibt selbstständig (bau.test: kein http(s) im Deck)
    `<script type="application/json" id="r-daten">${JSON.stringify(daten)
      .replace(/https?:\/\//g, '')
      .replace(/</g, '\\u003c')}</script>` +
    `<script>${REFERENT_SKRIPT}</script></body></html>`
  );
}

const REFERENT_SKRIPT = `(() => {
  'use strict';
  const daten = JSON.parse(document.getElementById('r-daten').textContent);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  let start = null, gr = 18, letzte = null;
  function zeige(z) {
    const e = daten[z.id];
    if (!e) { $('r-id').textContent = z.id; $('r-links').innerHTML = '<p>Keine Notizen zu dieser Folie.</p>'; $('r-rechts').innerHTML = ''; return; }
    if (start === null && !e.reserve) start = Date.now();
    const stufe = Math.min(z.stufe || 0, Math.max(0, e.vortrag.length - 1));
    $('r-id').textContent = e.id + ' · ' + e.titel;
    $('r-stufe').textContent = e.aufbau ? 'Stufe ' + (z.stufe || 0) + ' von ' + e.aufbau : '';
    $('r-naechste').textContent = z.naechste ? 'Danach: ' + z.naechste : '';
    $('r-soll').textContent = e.reserve ? 'Reserve' : e.zeitS + ' s · Soll bis Ende ' + mmss(e.kumuliertS) + ' (gesamt)';
    const vortrag = e.vortrag.map((t, i) => '<p class="' + (i === stufe ? 'jetzt' : i < stufe ? 'vorbei' : '') + '">' + (i ? '<span class="weiter">[Weiter]</span> ' : '') + esc(t) + '</p>').join('');
    const neu = letzte !== e.id;
    letzte = e.id;
    $('r-links').innerHTML = '<h3>Vortrag</h3><div class="vortrag">' + vortrag + '</div>' +
      (e.stichpunkte.length ? '<h3>Stichpunkte</h3><ul class="stich">' + e.stichpunkte.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul>' : '') +
      (e.uebergang ? '<h3>Übergang</h3>' + e.uebergang : '') +
      (e.verstehen ? '<h3>Verstehen</h3>' + e.verstehen : '');
    if (neu) {
      $('r-rechts').innerHTML =
        (e.fragen.length ? '<h3>Fragen (' + e.fragen.length + ')</h3>' + e.fragen.map((q) => '<details class="frage"><summary>' + esc(q.frage) + '</summary>' + q.html + '</details>').join('') : '') +
        (e.begriffe.length ? '<h3>Begriffe</h3><dl class="begriffe">' + e.begriffe.map((b) => '<dt>' + esc(b.begriff) + '</dt><dd>' + b.html + '</dd>').join('') + '</dl>' : '') +
        (e.quelle ? '<p class="quelle"><b>Quelle:</b> ' + esc(e.quelle) + '</p>' : '');
      window.scrollTo(0, 0);
    }
    const jetzt = document.querySelector('.vortrag p.jetzt');
    if (jetzt && !neu) jetzt.scrollIntoView({ block: 'nearest' });
  }
  window.referentZeige = (z) => { zeige(z); takt(); };
  const takt = () => { $('r-uhr').textContent = start === null ? '0:00' : mmss((Date.now() - start) / 1000); };
  setInterval(takt, 500);
  $('r-start').onclick = () => { start = Date.now(); takt(); };
  const groesse = (d) => { gr = Math.max(14, Math.min(28, gr + d)); document.body.style.setProperty('--gr', gr + 'px'); };
  $('r-klein').onclick = () => groesse(-2);
  $('r-gross').onclick = () => groesse(2);
  document.addEventListener('keydown', (ev) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.key === '+') return groesse(2);
    if (ev.key === '-') return groesse(-2);
    if (['ArrowRight','ArrowLeft',' ','PageDown','PageUp','Home','End','r','Escape'].includes(ev.key) && window.opener && window.opener.deck) {
      ev.preventDefault();
      window.opener.deck.taste(ev.key);
    }
  });
})();`;
