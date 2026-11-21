// Laufzeit des Browser-Decks (wird von deck.mjs in deck-vorlage.html eingesetzt).
// Steuerung: → / Leertaste / Bild ab vor, ← / Bild auf zurück, Pos1 / Ende, f Vollbild,
// r Reserve-Übersicht, Esc zurück in den Vortrag, n Referentenansicht (zweites Fenster, folgt Folie und Stufe). Bewegung nur für die Wegkarte oben links (Punkt fährt
// 600 ms, Säume und Zeichen blenden 300 ms, Wechsel des Wegs blendet über) und den Zoom in J10; mit
// prefers-reduced-motion springt alles in den Endzustand.
/* global document, window, location, history, URLSearchParams, getComputedStyle, performance,
   requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout, KeyboardEvent */
(() => {
  'use strict';

  const konfig = JSON.parse(document.getElementById('deck-konfig').textContent);
  const wurzel = document.documentElement;
  const buehne = document.querySelector('.buehne');
  const alle = [...buehne.querySelectorAll(':scope > .folie')];
  const haupt = alle.filter((s) => s.dataset.teil !== 'reserve');
  const reserve = alle.filter((s) => s.dataset.teil === 'reserve');
  // Ein beständiger Marker je Weg (wegkarte.mjs wegLaeufer), je Folie ein Zustand (konfig.marken)
  const laeufer = Object.fromEntries(
    [...buehne.querySelectorAll(':scope > .weg-laeufer')].map((el) => [el.dataset.weg, el]),
  );
  const uebersicht = buehne.querySelector('.reserve-uebersicht');
  const knoepfe = [...uebersicht.querySelectorAll('button[data-ziel]')];
  const live = document.querySelector('.live');
  const ruhig = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let liste = haupt;
  let referent = null;
  let index = 0;
  let hauptIndex = 0;
  let aktuell = null;

  const druck = new URLSearchParams(location.search).get('druck');
  if (druck) wurzel.dataset.druck = druck;

  // ---------------------------------------------------------------- Bühne skalieren
  function passe() {
    const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    wurzel.style.setProperty('--massstab', String(s));
  }
  window.addEventListener('resize', passe);
  passe();

  // ---------------------------------------------------------------- Zoom J10
  // Gleiche Abbildung wie kameraViewBox() und zoomDeckkraft() in grafik.mjs (Vertrag aus Task 4,
  // Parameter als data-* am <svg class="kamera">); deck.test.mjs vergleicht beide.
  const r6 = (n) => Number(n.toFixed(6));
  function kameraViewBox(kamera, z) {
    const d = kamera.dataset;
    const [w0, w1] = [Number(d.w0), Number(d.w1)];
    const w = w0 * (w1 / w0) ** z;
    const h = (w * Number(kamera.getAttribute('height'))) / Number(kamera.getAttribute('width'));
    const sx = Number(d.sx0) + (Number(d.sx1) - Number(d.sx0)) * z;
    const sy = Number(d.sy0) + (Number(d.sy1) - Number(d.sy0)) * z;
    return { x: r6(-sx * w), y: r6(Number(d.ankerY) - sy * h), w: r6(w), h: r6(h) };
  }
  function zoomDeckkraft(zoom, von, bis) {
    if (zoom < von || zoom > bis) return 0;
    const ein = von <= 0 ? 1 : Math.min(1, (zoom - von) / 0.04);
    const aus = bis >= 1 ? 1 : Math.min(1, (bis - zoom) / 0.04);
    return Math.min(ein, aus);
  }
  function setzeZoom(folie, z) {
    const kamera = folie.querySelector('svg.kamera');
    const vb = kameraViewBox(kamera, z);
    kamera.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    // Feldbeschriftungen in der Kamera und die Kennzahlen unter dem Feld (data-spalte)
    for (const g of folie.querySelectorAll('[data-zoom-von]')) {
      const o = zoomDeckkraft(z, Number(g.dataset.zoomVon), Number(g.dataset.zoomBis));
      g.setAttribute('opacity', String(r6(o)));
    }
    // Übersichtskarte: Lupenrahmen wie lupeRahmen() in grafik.mjs (mindestens 4 % der Kartenbreite)
    const lupe = folie.querySelector('[data-lupe]');
    if (lupe) {
      const ganz = kameraViewBox(kamera, 0);
      const lw = Math.max(vb.w, ganz.w * 0.04);
      const lh = (lw * ganz.h) / ganz.w;
      lupe.setAttribute('x', String(r6(vb.x + vb.w / 2 - lw / 2)));
      lupe.setAttribute('y', String(r6(vb.y + vb.h / 2 - lh / 2)));
      lupe.setAttribute('width', String(r6(lw)));
      lupe.setAttribute('height', String(r6(lh)));
    }
    folie.dataset.zoomIst = String(z);
  }
  const stufenVon = (folie) => JSON.parse(folie.dataset.zoomStufen);

  let fahrt = 0;
  function stoppeZoom() {
    if (fahrt) cancelAnimationFrame(fahrt);
    fahrt = 0;
  }
  /** Setzt die Stufe sofort (ohne Fahrt). */
  function zoomStufe(folie, stufe) {
    stoppeZoom();
    setzeZoom(folie, stufenVon(folie)[stufe]);
    folie.dataset.zoomStufe = String(stufe);
    folie.dataset.zoomFertig = String(stufe);
    if (folie === aktuell) sendeReferent();
  }
  /** Kamerafahrt zur Stufe: z läuft mit ease-in-out; w(z) ist exponentiell, der Zoom wirkt gleichmäßig. */
  function zoomeZu(folie, stufe) {
    if (ruhig()) return zoomStufe(folie, stufe);
    stoppeZoom();
    const von = Number(folie.dataset.zoomIst);
    const nach = stufenVon(folie)[stufe];
    folie.dataset.zoomStufe = String(stufe);
    if (folie === aktuell) sendeReferent();
    delete folie.dataset.zoomFertig;
    const dauer = 1500;
    const start = performance.now();
    const schritt = (jetzt) => {
      const t = Math.min(1, (jetzt - start) / dauer);
      const e = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      setzeZoom(folie, von + (nach - von) * e);
      if (t < 1) {
        fahrt = requestAnimationFrame(schritt);
      } else {
        fahrt = 0;
        folie.dataset.zoomFertig = String(stufe);
      }
    };
    fahrt = requestAnimationFrame(schritt);
  }
  /** Ein Zoomschritt innerhalb der Folie; false, wenn die Folie keinen weiteren hat. */
  function zoomSchritt(richtung) {
    if (!aktuell || !aktuell.dataset.zoomStufen) return false;
    const ziel = Number(aktuell.dataset.zoomStufe) + richtung;
    if (ziel < 0 || ziel >= stufenVon(aktuell).length) return false;
    zoomeZu(aktuell, ziel);
    return true;
  }
  const endStufe = (folie) => zoomStufe(folie, stufenVon(folie).length - 1);

  // ---------------------------------------------------------------- Aufbau in Stufen
  // Folien mit data-aufbau="n" bauen sich auf Tastendruck in n Stufen auf. Ein Element mit
  // data-ab="k" (und optional data-bis="m") ist in den Stufen k bis m sichtbar; die Übergänge macht
  // CSS (stil.css), mit reduzierter Bewegung ohne Übergang. Nie zeitgesteuert.
  const aufbauMax = (folie) => Number(folie.dataset.aufbau);
  function aufbauStufe(folie, stufe) {
    folie.dataset.aufbauStufe = String(stufe);
    for (const el of folie.querySelectorAll('[data-ab]')) {
      const ab = Number(el.dataset.ab);
      const bis = el.dataset.bis === undefined ? Infinity : Number(el.dataset.bis);
      if (stufe >= ab && stufe <= bis) el.setAttribute('data-an', '');
      else el.removeAttribute('data-an');
    }
    // Zeichen der Wegkarte je Stufe (M1)
    if (folie === aktuell) {
      setzeMarker(folie);
      sendeReferent();
    }
  }
  /** Ein Aufbauschritt innerhalb der Folie; false, wenn die Folie keinen weiteren hat. */
  function aufbauSchritt(richtung) {
    if (!aktuell || !aktuell.dataset.aufbau) return false;
    const ziel = Number(aktuell.dataset.aufbauStufe) + richtung;
    if (ziel < 0 || ziel > aufbauMax(aktuell)) return false;
    aufbauStufe(aktuell, ziel);
    return true;
  }

  // ---------------------------------------------------------------- Wegkarte (Läufer)
  // Eine Maschine für beide Teile: Je Weg ein Element, das über alle Folien des Wegs bleibt. Innerhalb des
  // Wegs fährt der Punkt per offset-distance (CSS-Übergang) zur nächsten Station; Säume, Ausschlag und
  // Zeichen blenden ein und aus. Erscheint der Punkt neu, steht er ohne Fahrt an der Station. Beim Wechsel
  // des Wegs (N10 → J1) blendet die alte Karte aus und die neue, sofort im Zustand der Folie, ein.
  // Reduzierte Bewegung: kein Übergang (Vorlage). Druck: die feste Marke in jeder Folie.
  const ohneUebergang = (el, fn) => {
    el.classList.add('weg-sofort');
    fn();
    void el.offsetWidth;
    el.classList.remove('weg-sofort');
  };
  const schalte = (el, an) => (an ? el.setAttribute('data-an', '') : el.removeAttribute('data-an'));
  /** Zeichensatz der Marke in der aktuellen Aufbaustufe der Folie (M1 je Stufe, sonst einer). */
  function satzVon(zustand, folie) {
    const stufe = folie.dataset.aufbauStufe === undefined ? 0 : Number(folie.dataset.aufbauStufe);
    const st = zustand.stufen.find((x) => stufe >= x.ab && (x.bis === null || stufe <= x.bis));
    return st ? st.satz : '';
  }
  function wende(el, z, folie) {
    const punkt = el.querySelector('.weg-punkt');
    if (z.anteil === null) {
      schalte(punkt, false);
    } else if (punkt.hasAttribute('data-an')) {
      // fährt per CSS-Übergang (600 ms) entlang offset-path
      punkt.style.offsetDistance = `${z.anteil}%`;
    } else {
      // erscheint ohne Fahrt an der Station und blendet ein
      punkt.classList.add('weg-punkt-springt');
      punkt.style.offsetDistance = `${z.anteil}%`;
      void punkt.offsetWidth;
      punkt.classList.remove('weg-punkt-springt');
      schalte(punkt, true);
    }
    for (const g of el.querySelectorAll('.weg-saum')) schalte(g, z.saeume.includes(g.dataset.saum));
    for (const w of el.querySelectorAll('.weg-wirkung')) schalte(w, z.wirkung);
    const satz = satzVon(z, folie);
    for (const s of el.querySelectorAll('.weg-satz')) schalte(s, s.dataset.satz === satz);
    el.querySelector('.weg-name').textContent = z.text;
    const etiketten = el.querySelector('.weg-etiketten');
    etiketten.replaceChildren(
      ...z.teil.map((t) => {
        const span = document.createElement('span');
        span.className = `etikett etikett-${t.toLowerCase()}`;
        span.textContent = t;
        return span;
      }),
    );
    el.setAttribute('aria-label', z.label);
    el.dataset.marke = z.name;
    el.dataset.aktiv = z.station ?? '';
  }
  function setzeMarker(folie) {
    const z = konfig.marken[folie.dataset.id] ?? null;
    const ziel = z ? laeufer[z.weg] : null;
    for (const el of Object.values(laeufer)) if (el !== ziel) schalte(el, false);
    if (!ziel) return;
    if (ziel.hasAttribute('data-an')) {
      wende(ziel, z, folie);
    } else {
      // Weg erscheint (oder wechselt): Zustand ohne Übergang setzen, dann die ganze Karte einblenden
      ohneUebergang(ziel, () => wende(ziel, z, folie));
      schalte(ziel, true);
    }
  }

  // ---------------------------------------------------------------- Folienwechsel
  function zeige(folie, richtung) {
    if (folie === aktuell) return;
    const alt = aktuell;
    if (alt) {
      delete alt.dataset.aktuell;
      if (alt.dataset.zoomStufen) endStufe(alt);
      for (const v of alt.querySelectorAll('video')) v.pause();
    }
    aktuell = folie;
    folie.dataset.aktuell = '';
    if (folie.dataset.zoomStufen) {
      zoomStufe(folie, richtung < 0 ? stufenVon(folie).length - 1 : 0);
    }
    if (folie.dataset.aufbau) aufbauStufe(folie, richtung < 0 ? aufbauMax(folie) : 0);
    // Clips starten nie von selbst: der nächste Tastendruck (vor) spielt sie ab.
    for (const v of folie.querySelectorAll('video')) {
      v.pause();
      v.currentTime = 0;
      delete v.dataset.gestartet;
      if (ruhig()) v.controls = true;
    }
    setzeMarker(folie);
    live.textContent = folie.getAttribute('aria-label') || '';
    history.replaceState(null, '', `#${folie.dataset.id}`);
    sendeReferent();
  }

  // ---------------------------------------------------------------- Referentenansicht (Taste n)
  // Zweites Fenster (sprechheft.mjs baueReferentHtml), nur im privaten Vortragsdeck; folgt Folie und Stufe.
  const titelVon = (folie) =>
    (folie.querySelector('.folie-titel, h1, h2')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  function sendeReferent() {
    if (!referent || referent.closed || !aktuell || !referent.referentZeige) return;
    const naechste = liste[liste.indexOf(aktuell) + 1];
    referent.referentZeige({
      id: aktuell.dataset.id,
      stufe: Number(aktuell.dataset.aufbauStufe ?? aktuell.dataset.zoomStufe ?? 0),
      naechste: naechste ? `${naechste.dataset.id} ${titelVon(naechste)}` : '',
    });
  }
  function oeffneReferent() {
    if (!konfig.referent) return;
    if (referent && !referent.closed) {
      referent.focus();
      return;
    }
    referent = window.open('', 'referentenansicht', 'popup,width=1280,height=900');
    if (!referent) return;
    referent.document.open();
    referent.document.write(konfig.referent);
    referent.document.close();
    sendeReferent();
  }
  function gehe(i, richtung) {
    index = Math.max(0, Math.min(liste.length - 1, i));
    if (liste === haupt) hauptIndex = index;
    zeige(liste[index], richtung);
  }
  /**
   * Clip der aktuellen Folie in Schritten: erster Druck startet ihn, ein Druck während er läuft
   * springt ans letzte Bild (Ergebnis), erst danach geht es zur nächsten Folie. true = Schritt verbraucht.
   */
  function clipSchritt() {
    const v = aktuell && aktuell.querySelector('video');
    if (!v) return false;
    if (v.dataset.gestartet === undefined) {
      v.dataset.gestartet = '';
      v.play().catch(() => {});
      return true;
    }
    if (!v.paused && !v.ended) {
      v.pause();
      if (Number.isFinite(v.duration)) v.currentTime = v.duration;
      return true;
    }
    return false;
  }
  function vor() {
    // Aufbau vor Clip (J13: erst Raster und Ablation, dann die Lehrenden-Sicht)
    if (aufbauSchritt(+1) || clipSchritt() || zoomSchritt(+1)) return;
    if (index < liste.length - 1) gehe(index + 1, +1);
  }
  function zurueck() {
    if (!zoomSchritt(-1) && !aufbauSchritt(-1) && index > 0) gehe(index - 1, -1);
  }
  function zeigeReserve(i) {
    liste = reserve;
    gehe(i, +1);
  }
  function zurueckInDenVortrag() {
    liste = haupt;
    gehe(hauptIndex, +1);
  }

  // ---------------------------------------------------------------- Reserve-Übersicht
  function oeffneUebersicht() {
    uebersicht.hidden = false;
    const i = liste === reserve ? index : 0;
    knoepfe[i].focus();
  }
  function schliesseUebersicht() {
    uebersicht.hidden = true;
    buehne.focus({ preventScroll: true });
  }
  for (const [i, knopf] of knoepfe.entries()) {
    knopf.addEventListener('click', () => {
      schliesseUebersicht();
      zeigeReserve(i);
    });
  }
  function tasteInUebersicht(e) {
    const i = knoepfe.indexOf(document.activeElement);
    if (e.key === 'Escape' || e.key === 'r') {
      schliesseUebersicht();
    } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= knoepfe.length) {
      schliesseUebersicht();
      zeigeReserve(Number(e.key) - 1);
    } else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
      const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      knoepfe[(Math.max(i, 0) + d + knoepfe.length) % knoepfe.length].focus();
    } else if (e.key === 'Tab') {
      // Fokus bleibt im Dialog
      const d = e.shiftKey ? -1 : 1;
      knoepfe[(Math.max(i, 0) + d + knoepfe.length) % knoepfe.length].focus();
    } else {
      return;
    }
    e.preventDefault();
  }

  // ---------------------------------------------------------------- Tasten
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (!uebersicht.hidden) return tasteInUebersicht(e);
    switch (e.key) {
      case 'ArrowRight':
      case ' ':
      case 'PageDown':
        vor();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        zurueck();
        break;
      case 'Home':
        gehe(0, +1);
        break;
      case 'End':
        gehe(liste.length - 1, -1);
        break;
      case 'f':
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else wurzel.requestFullscreen().catch(() => {});
        break;
      case 'r':
        oeffneUebersicht();
        break;
      case 'n':
        oeffneReferent();
        break;
      case 'Escape':
        if (liste === reserve) zurueckInDenVortrag();
        else return;
        break;
      default:
        return;
    }
    e.preventDefault();
  });

  // Mauszeiger nach kurzer Ruhe ausblenden (Bildschirmfreigabe)
  let mausTimer = 0;
  document.addEventListener('mousemove', () => {
    document.body.classList.remove('maus-ruhig');
    clearTimeout(mausTimer);
    mausTimer = setTimeout(() => document.body.classList.add('maus-ruhig'), 2500);
  });

  // ---------------------------------------------------------------- Druck
  // Im Druck steht J10 im Endzustand (0,3 mm); danach geht es auf der gezeigten Stufe weiter.
  const zoomFolien = alle.filter((s) => s.dataset.zoomStufen);
  // Aufbaufolien stehen im Druck im Endbild; danach geht es auf der gezeigten Stufe weiter.
  const aufbauFolien = alle.filter((s) => s.dataset.aufbau);
  let vorDruck = null;
  let aufbauVorDruck = null;
  // Druckauszug einer Person (?druck=jonas|niklas): Seitenzahlen nur über die gedruckten Hauptfolien
  // (1 / n statt der Nummer im gemeinsamen Deck), Reserve behält „Reserve …“. Danach zurück.
  let nummernVorDruck = null;
  function nummerierePerson() {
    if (!druck) return;
    const gedruckt = alle.filter(
      (s) => getComputedStyle(s).display !== 'none' && s.dataset.teil !== 'reserve',
    );
    nummernVorDruck = [];
    gedruckt.forEach((s, i) => {
      const nr = s.querySelector('.fuss-nr');
      if (!nr) return;
      nummernVorDruck.push([nr, nr.textContent]);
      nr.textContent = `${i + 1} / ${gedruckt.length}`;
    });
  }
  function druckBeginn() {
    if (vorDruck) return;
    nummerierePerson();
    vorDruck = zoomFolien.map((s) => [s, s.dataset.zoomStufe]);
    aufbauVorDruck = aufbauFolien.map((s) => [s, s.dataset.aufbauStufe]);
    for (const s of aufbauFolien) aufbauStufe(s, aufbauMax(s));
    for (const s of zoomFolien) endStufe(s);
  }
  function druckEnde() {
    if (!vorDruck) return;
    for (const [nr, t] of nummernVorDruck ?? []) nr.textContent = t;
    nummernVorDruck = null;
    for (const [s, stufe] of vorDruck) if (stufe !== undefined) zoomStufe(s, Number(stufe));
    for (const [s, stufe] of aufbauVorDruck)
      aufbauStufe(s, stufe === undefined ? 0 : Number(stufe));
    vorDruck = null;
    aufbauVorDruck = null;
  }
  window.addEventListener('beforeprint', druckBeginn);
  window.addEventListener('afterprint', druckEnde);
  window
    .matchMedia('print')
    .addEventListener('change', (m) => (m.matches ? druckBeginn() : druckEnde()));

  // ---------------------------------------------------------------- Start
  // Alle Schnitte vorab laden, damit kein Folienwechsel auf eine Schrift wartet.
  for (const f of ['400 24px Inter', '600 24px Inter', '700 24px Inter', '800 24px Inter']) {
    document.fonts.load(f);
  }
  document.fonts.load('400 24px "IBM Plex Mono"');
  document.fonts.load('600 24px "IBM Plex Mono"');

  // Für Tests und Bau (Task 10)
  window.deck = {
    kameraViewBox,
    zoomDeckkraft,
    gehe: (id) => springeZu(id),
    // Steuerung aus der Referentenansicht: dieselben Tasten wie im Deck
    taste: (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })),
    referent: () => referent,
  };

  function springeZu(id) {
    const ziel = alle.find((s) => s.dataset.id === id);
    if (!ziel) return false;
    liste = ziel.dataset.teil === 'reserve' ? reserve : haupt;
    gehe(liste.indexOf(ziel), +1);
    return true;
  }
  if (!springeZu(decodeURIComponent(location.hash.slice(1)))) gehe(0, +1);
  buehne.focus({ preventScroll: true });
})();
