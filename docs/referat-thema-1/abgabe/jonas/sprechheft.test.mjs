/* global location */
// Sprechheft (specs/2026-11-17-sprechheft-design.md): jede Folie hat ihre Seite, keine Zahl ohne Fundstelle,
// Markdown wird sicher umgesetzt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ABSCHNITTE,
  HEFT_ORDNER,
  ladeHeft,
  mdBlock,
  mdInline,
  zerlegeSeite,
} from './sprechheft.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HIER, '..', '..');
const REPO = join(ROOT, '..', '..');
const heft = ladeHeft(ROOT);
// Heftseiten und Vortragsdeck liegen privat (privat/, eigenes Repo); ohne sie entfallen diese Prüfungen
const PRIVAT = join(ROOT, 'privat');
const ohnePrivat = existsSync(join(ROOT, HEFT_ORDNER)) ? false : 'privat/ fehlt (eigenes Repo)';
const VORTRAG = join(PRIVAT, 'ausgabe', 'vortrag-deck.html');
const deck = readFileSync(join(HIER, 'ausgabe', 'jonas-deck.html'), 'utf8');
const folienIds = [
  ...new Set(
    [...deck.matchAll(/<section[^>]*class="folie[^"]*"[^>]*data-id="([^"]+)"/g)].map((m) => m[1]),
  ),
];

test('Markdown: Text wird escaped, nur fett, code und Listen werden zu HTML', () => {
  assert.equal(mdInline('a <b> & **c** `d`'), 'a &lt;b&gt; &amp; <b>c</b> <code>d</code>');
  assert.equal(mdBlock('- eins\n- zwei'), '<ul><li>eins</li><li>zwei</li></ul>');
  assert.equal(mdBlock('Satz.\n\nZweiter.'), '<p>Satz.</p><p>Zweiter.</p>');
  const s = zerlegeSeite(
    '## Verstehen\nx\n## Begriffe\n- **p95:** Wert\n## Fragen\n### Warum?\nWeil.\n## Übergang\nWeiter.',
  );
  assert.deepEqual(s.begriffe, [{ begriff: 'p95', text: 'Wert' }]);
  assert.deepEqual(s.fragen, [{ frage: 'Warum?', antwort: 'Weil.' }]);
});

test('Jede Folie des Decks hat eine Heftseite mit allen Abschnitten', { skip: ohnePrivat }, () => {
  assert.ok(folienIds.length > 40, `Folien im Deck: ${folienIds.length}`);
  const fehlt = folienIds.filter((id) => !heft[id]);
  assert.deepEqual(fehlt, [], `Heftseiten fehlen in ${HEFT_ORDNER}`);
  for (const id of folienIds) {
    const s = heft[id];
    assert.deepEqual(
      ABSCHNITTE.filter((a) => !s.abschnitte.includes(a)),
      [],
      `${id}: Abschnitte fehlen`,
    );
    assert.ok(s.verstehen.split(/\s+/).length >= 80, `${id}: Verstehen zu kurz`);
    assert.ok(s.fragen.length >= (/^J16b?$/.test(id) ? 2 : 3), `${id}: zu wenige Fragen`);
    for (const q of s.fragen)
      assert.ok(q.antwort.length > 40, `${id}: Antwort zu „${q.frage}“ fehlt`);
  }
  // keine verwaisten Seiten
  assert.deepEqual(
    Object.keys(heft).filter((id) => !folienIds.includes(id)),
    [],
  );
});

// Fundstellen: alle Texte des Referats und der Code, auf den sich Folien und Protokolle beziehen
function texte(ordner, endungen, ausser = () => false) {
  const t = [];
  for (const name of readdirSync(ordner)) {
    const p = join(ordner, name);
    if (ausser(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) t.push(...texte(p, endungen, ausser));
    else if (endungen.test(name) && st.size < 3e6) t.push(readFileSync(p, 'utf8'));
  }
  return t;
}
const korpus = [
  ...texte(ROOT, /\.(md|mjs|csv|txt|json|yml|sh|ps1)$/, (p) =>
    /node_modules|\/\.git(\/|$)|privat\/sprechheft|privat\/ausgabe\/(?!sprechnotizen)|abgabe\/jonas\/ausgabe\//.test(
      relative(REPO, p),
    ),
  ),
  ...texte(join(REPO, 'apps', 'backend', 'src'), /\.ts$/),
  ...texte(join(REPO, 'scripts', 'load'), /\.(mjs|js|json)$/),
  readFileSync(join(REPO, '.env.production.example'), 'utf8'),
  deck.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' '),
]
  .join('\n')
  .replace(/ | /g, ' ');

test(
  'Jede Zahl im Heft hat eine Fundstelle im Referat, im Code oder auf den Folien',
  { skip: ohnePrivat },
  () => {
    const ohne = [];
    for (const [id, s] of Object.entries(heft)) {
      const text = s.roh.replace(/`[^`]*`/g, ' ').replace(/ | /g, ' ');
      for (const m of text.matchAll(/(?<![\w.,-])\d+(?:[.,]\d+)*(?![\w])/g)) {
        const z = m[0];
        // einstellige ganze Zahlen (Zählwörter, Stufen) sind keine Messwerte
        if (/^\d$/.test(z)) continue;
        if (!korpus.includes(z)) ohne.push(`${id}: ${z}`);
      }
    }
    assert.deepEqual(ohne, [], 'Zahlen ohne Fundstelle');
  },
);

test(
  'Referentenansicht (Taste n) folgt Folie und Stufe und steuert das Deck',
  { skip: existsSync(VORTRAG) ? false : 'privat/ausgabe/vortrag-deck.html fehlt' },
  async () => {
    const { createRequire } = await import('node:module');
    const { pathToFileURL } = await import('node:url');
    const { chromium } = createRequire(join(REPO, 'package.json'))('playwright');
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
      const deckSeite = await ctx.newPage();
      const fehler = [];
      deckSeite.on('pageerror', (e) => fehler.push(String(e)));
      await deckSeite.goto(`${pathToFileURL(VORTRAG).href}#N9`);
      await deckSeite.waitForTimeout(400);
      const [ref] = await Promise.all([ctx.waitForEvent('page'), deckSeite.keyboard.press('n')]);
      ref.on('pageerror', (e) => fehler.push(String(e)));
      await ref.waitForTimeout(300);
      /* global document */
      const lies = () =>
        ref.evaluate(() => ({
          id: document.getElementById('r-id').textContent.split(' ')[0],
          stufe: document.getElementById('r-stufe').textContent,
          jetzt: [...document.querySelectorAll('.vortrag p')].findIndex((p) =>
            p.classList.contains('jetzt'),
          ),
        }));
      assert.deepEqual(await lies(), { id: 'N9', stufe: 'Stufe 0 von 2', jetzt: 0 });
      await deckSeite.keyboard.press('ArrowRight');
      await ref.waitForTimeout(150);
      assert.deepEqual(await lies(), { id: 'N9', stufe: 'Stufe 1 von 2', jetzt: 1 });
      // Pfeiltaste im Referentenfenster steuert das Deck
      await ref.keyboard.press('ArrowRight');
      await ref.keyboard.press('ArrowRight');
      await ref.waitForTimeout(200);
      assert.equal((await lies()).id, 'N10');
      assert.equal(await deckSeite.evaluate(() => location.hash), '#N10');
      assert.deepEqual(fehler, []);
    } finally {
      await browser.close();
    }
  },
);
