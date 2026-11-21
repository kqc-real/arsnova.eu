// Layoutwächter für Decks aus baueDeck (genutzt von deck.test.mjs und abgabe/niklas/entwurf.test.mjs).
// Misst im Druckmodus je Folie: alles in der Bühne, Titel einzeilig, keine Überlappungen, Vermerke klein
// und einzeilig, kein überlaufender Text, kein oben klebender Inhalt mit leerer unterer Hälfte.
/* global document, getComputedStyle */
import { pathToFileURL } from 'node:url';

/**
 * Layoutbefunde je Folie, gemessen im Druckmodus (alle Folien stehen untereinander, J10 im Endbild).
 * Wächter für Fehler der Art „Code-Block läuft durch die Belegzeile“ (V1) und „zweizeiliger Titel
 * trifft die Frage“ (V2).
 * @param {import('playwright').Browser} browser
 * @param {string} pfad Deck-HTML
 * @returns {Promise<string[]>}
 */
export async function layoutBefunde(browser, pfad) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await page.goto(pathToFileURL(pfad).href);
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(300);
  const befunde = await page.evaluate(() => {
    const fehler = [];
    const r = (el, s) => {
      const b = el.getBoundingClientRect();
      return { l: b.left - s.left, t: b.top - s.top, r: b.right - s.left, b: b.bottom - s.top };
    };
    const schneiden = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
    const name = (el) =>
      `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}` +
      `„${(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)}“`;
    for (const folie of document.querySelectorAll('.folie:not(.folie-bild)')) {
      const id = folie.dataset.id;
      const s = folie.getBoundingClientRect();
      const titel = folie.querySelector('.folie-titel');
      const flaeche = folie.querySelector('.folie-flaeche');
      const fuss = folie.querySelector('.folie-fuss');
      const kopf = [
        ...folie.querySelectorAll('.weg-marke, .weg-marke .weg-beschriftung, .teilleiste'),
      ];
      // 1. alles innerhalb der Bühne 1600 × 900 (SVG-Inneres zählt über sein <svg>)
      for (const el of folie.querySelectorAll('*')) {
        if (el.parentElement?.closest('svg')) continue;
        const b = r(el, s);
        if (b.r - b.l === 0 && b.b - b.t === 0) continue;
        if (b.l < -1 || b.t < -1 || b.r > 1601 || b.b > 901)
          fehler.push(`${id}: ${name(el)} außerhalb der Bühne`);
      }
      // 2. Titel einzeilig; der große Titel der Titel- und Dankfolie (96 px) darf zwei Zeilen haben
      // (Durchsicht 2026-11-18, Entwurf A), mehr nicht.
      const lh = parseFloat(getComputedStyle(titel).lineHeight);
      const grosserTitel = folie.matches('[data-titelfolie], [data-id="GD"]');
      if (titel.getBoundingClientRect().height > lh * (grosserTitel ? 2.5 : 1.5))
        fehler.push(`${id}: Titel ${grosserTitel ? 'mehr als zweizeilig' : 'zweizeilig'}`);
      // 3. Kopf (Wegkarte, Teilleiste, Frage- und Autorzeile), Titel, Fläche, Fußzeile überlappen nicht
      const kopfZeilen = [
        ...folie.querySelectorAll(':scope > .folie-frage, :scope > .folie-autor'),
      ];
      const bloecke = [...kopf, titel, ...kopfZeilen, fuss];
      for (let i = 0; i < bloecke.length; i++) {
        for (let j = i + 1; j < bloecke.length; j++) {
          if (schneiden(r(bloecke[i], s), r(bloecke[j], s)))
            fehler.push(`${id}: ${name(bloecke[i])} trifft ${name(bloecke[j])}`);
        }
      }
      // 4. Jedes Element der Fläche bleibt in der Fläche und trifft weder Titel noch Fußzeile
      //    (außer absolut gesetzten Vermerken über dem Titel, etwa dem Entwurfsvermerk).
      const fl = r(flaeche, s);
      for (const el of flaeche.querySelectorAll('*')) {
        if (el.parentElement?.closest('svg')) continue;
        const b = r(el, s);
        if (b.r - b.l === 0 || b.b - b.t === 0) continue;
        const vermerk = getComputedStyle(el).position === 'absolute' && b.b <= r(titel, s).t;
        for (const k of [titel, fuss, ...kopf, ...kopfZeilen]) {
          if (schneiden(b, r(k, s))) fehler.push(`${id}: ${name(el)} trifft ${name(k)}`);
        }
        if (vermerk) continue;
        if (b.l < fl.l - 1 || b.r > fl.r + 1 || b.t < fl.t - 1 || b.b > fl.b + 1)
          fehler.push(`${id}: ${name(el)} ragt aus der Fläche`);
      }
      // 5. Geschwister im Fluss (Frage, Liste, Kasten, Code, Beleg) überlappen sich nicht
      const inhalt = flaeche.querySelector('.flaeche-inhalt') ?? flaeche;
      const kinder = [...inhalt.children].filter(
        (k) => getComputedStyle(k).position !== 'absolute',
      );
      for (let i = 0; i < kinder.length; i++) {
        for (let j = i + 1; j < kinder.length; j++) {
          if (schneiden(r(kinder[i], s), r(kinder[j], s)))
            fehler.push(`${id}: ${name(kinder[i])} trifft ${name(kinder[j])}`);
        }
      }
      // 6. Vermerke (Beleg, Bildunterschrift, Hinweis, Matrikel-Platz): kleiner als der Text der Folie,
      //    höchstens 22 px und genau eine Zeile (Designregel T). Text der Folie: 28 px.
      const text = parseFloat(getComputedStyle(folie).fontSize);
      if (text < 28) fehler.push(`${id}: Folientext ${text} px statt mindestens 28 px`);
      for (const el of folie.querySelectorAll(
        '.beleg, .vermerk, .matrikel, figcaption:not(:has(.vermerk))',
      )) {
        const cs = getComputedStyle(el);
        const px = parseFloat(cs.fontSize);
        if (px >= text || px > 22) fehler.push(`${id}: ${name(el)} Vermerk ${px} px, zu groß`);
        const zeilen = el.getClientRects();
        const hoehe =
          cs.display === 'inline'
            ? new Set([...zeilen].map((z) => Math.round(z.top))).size
            : (el.getBoundingClientRect().height -
                parseFloat(cs.paddingTop) -
                parseFloat(cs.paddingBottom)) /
              parseFloat(cs.lineHeight);
        if (hoehe > 1.5) fehler.push(`${id}: ${name(el)} Vermerk mehrzeilig`);
      }
      // 7. Kein Text läuft aus seinem Kasten (nowrap-Kennungen, zu lange Zeilen)
      for (const el of flaeche.querySelectorAll(
        'p, li, td, th, dd, dt, pre, blockquote, figcaption',
      )) {
        if (el.closest('svg') || el.clientWidth === 0) continue;
        if (el.scrollWidth > el.clientWidth + 2) fehler.push(`${id}: ${name(el)} Text läuft über`);
      }
      // 8. Vertikaler Rhythmus (Designregel V): Lässt der Inhaltsblock unten mehr als 35 % der Fläche frei,
      //    muss er zentriert stehen (Rest oben mindestens halb so groß wie unten). Unten gesetzte Belege
      //    zählen nicht zum Block; ausgeblendete Aufbaustufen schon (ihr Platz ist reserviert).
      const block = kinder.filter((k) => !k.classList.contains('beleg'));
      if (block.length) {
        const ir = r(inhalt, s);
        const beleg = kinder.find((k) => k.classList.contains('beleg'));
        const unten = beleg ? r(beleg, s).t : ir.b;
        const oben = Math.min(...block.map((k) => r(k, s).t));
        const ende = Math.max(...block.map((k) => r(k, s).b));
        const frei = unten - ende;
        if (frei / (ir.b - ir.t) > 0.35 && oben - ir.t < frei * 0.5) {
          fehler.push(`${id}: Inhalt klebt oben (${Math.round(frei)} px frei darunter)`);
        }
      }
    }
    return [...new Set(fehler)];
  });
  await context.close();
  return befunde;
}

/**
 * Kopfgrammatik (README „Designregeln“) je Hauptfolie (data-hauptfolie), gemessen im Druckmodus:
 * Zeile 1 Wegkarte mit Ort ohne „·“-Zusatz, Zeile 2 Titel, Zeile 3 Fragezeile direkt unter dem Titel mit
 * dem Etikett zuerst. Status („nachträglich ausgewertet“) nur am Ende einer Fragezeile, auf allen Folien.
 * Liefert den Abstand Titelunterkante → Fragezeile je Hauptfolie (px), die Folien mit Autorzeile und Befunde.
 * @param {import('playwright').Browser} browser
 * @param {string} pfad Deck-HTML
 * @returns {Promise<{ abstand: Record<string, number>, autor: string[], befunde: string[] }>}
 */
export async function kopfBefunde(browser, pfad) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await page.goto(pathToFileURL(pfad).href);
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(300);
  const ergebnis = await page.evaluate(() => {
    const befunde = [];
    const abstand = {};
    const autor = [];
    for (const folie of document.querySelectorAll('.folie')) {
      const id = folie.dataset.id;
      for (const st of folie.querySelectorAll('.status')) {
        const zeile = st.parentElement;
        if (!zeile?.matches('.folie > .folie-frage'))
          befunde.push(`${id}: Status außerhalb der Fragezeile`);
        else if (zeile.lastChild !== st) befunde.push(`${id}: Status nicht am Ende der Fragezeile`);
      }
      for (const a of folie.querySelectorAll('.folie-autor')) {
        if (a.parentElement !== folie || !a.previousElementSibling?.matches('.folie-frage'))
          befunde.push(`${id}: Autorzeile nicht unter der Fragezeile`);
        autor.push(id);
      }
      if (!('hauptfolie' in folie.dataset)) continue;
      const titel = folie.querySelector(':scope > .folie-titel');
      const frage = titel?.nextElementSibling;
      if (!frage?.matches('.folie-frage')) {
        befunde.push(`${id}: keine Fragezeile direkt unter dem Titel`);
        continue;
      }
      if (
        !frage.firstElementChild?.matches('.etikett') ||
        frage.firstChild !== frage.firstElementChild
      )
        befunde.push(`${id}: Fragezeile beginnt nicht mit dem Etikett`);
      abstand[id] = Math.round(
        frage.getBoundingClientRect().top - titel.getBoundingClientRect().bottom,
      );
      const marke = folie.querySelector(':scope > .weg-mini');
      const name = marke?.querySelector('.weg-beschriftung .weg-name');
      if (!marke || getComputedStyle(marke).display === 'none' || !name?.textContent.trim())
        befunde.push(`${id}: keine Wegkarte mit Ort in Kopfzeile 1`);
      else if (/·/.test(marke.querySelector('.weg-beschriftung').textContent))
        befunde.push(`${id}: Ort mit Zusatz „·“: ${name.textContent}`);
    }
    return { abstand, autor, befunde };
  });
  await context.close();
  return ergebnis;
}
