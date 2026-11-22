# Folien und Handout Jonas (1C und 1B 1–2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Browser-Deck (gemeinsam mit Niklas' Teilen) und daraus erzeugte PDFs (Folien Jonas, Handout Jonas, gemeinsames Vortragsdeck) für 1C und 1B Schritte 1–2, mit belegten Zahlen, echten Artefakten und zwei Review-Schleifen bis zur Abnahme.

**Architecture:** Alle Zahlen kommen aus einem Datenmodul (`zahlen.mjs`), das 1B-Werte aus den committeten Ergebnis-JSONs rechnet und 1C-Werte als Konstanten mit Belegstelle führt; ein Test prüft beides gegen die Quellen. Folien sind Objekte mit SVG/HTML-Inhalt, Sprechnotiz, Zeit und Quelle (`folien.mjs`); Diagramme erzeugen reine Funktionen (`grafik.mjs`). Ein Bauskript (`bau.mjs`) setzt Deck, Handout und PDFs zusammen (Playwright wie bei Niklas) und schreibt ein Manifest mit Prüfsummen.

**Tech Stack:** Node 24.18.0, ES-Module, `node:test`; Playwright (Chromium) und `pdf-parse` aus den vorhandenen Projektabhängigkeiten; handgeschriebenes SVG/CSS/JS; `pdftoppm` (poppler) nur für Niklas' PDF-Seiten.

**Spec:** [2026-11-15-praesentation-jonas-design.md](2026-11-15-praesentation-jonas-design.md)

## Global Constraints

- Kein Produktionscode, keine neuen npm-Abhängigkeiten; Tests, Testhelfer und Skripte sind erlaubt.
- Node 24.18.0: `export PATH=$HOME/.local/share/mise/installs/node/24.18.0/bin:$PATH`.
- Commits Englisch nach Conventional Commits, nie KI-Attribution, nie `--no-verify`.
- Doku Deutsch, klar und kurz; Markdown mit `npx prettier --check` und `git diff --check`.
- Keine Matrikelnummer, keine personenbezogenen Daten außer den Vornamen und dem Autorennamen, keine Tokens, `.env`-Inhalte oder Mitschnitte im Repo.
- Eingefrorene Protokolle (`evidenz/1B/2026-11-1*.md`, `evidenz/1C/*`) und eingefrorene 1C-Dateien nicht ändern; neue Belege als neue, datierte Dateien.
- Laborläufe (auch für den Clip) nur nach ausdrücklicher Freigabe des Autors.
- Jede Zahl mit Rechner und Commit; Zahlen nur aus Datenmodul, nie abgetippt in Vorlagen.
- Gestaltung Richtung M: weiß, Blau `#0b5ea8` (Niklas' Titelblau ist `#005a9c`; im Zweifel seins), 1C Petrol `#0f766e`, 1B Bernstein `#b45309`, Ablehnung Rot `#b42318`; Inter für Text, IBM Plex Mono für Messwerte; Folie 1600 × 900, Schrift ≥ 22 px, Linien ≥ 2 px.
- Dateien unter `docs/referat-thema-1/abgabe/jonas/`; Änderungen an Niklas' `abgabe/README.md` erst nach seinem Merge.

## Review Focus

1. **Gemischte Gruppen bei Medianen:** Warm-Mediane (n = 9) und Mediane über alle 10 Aufträge dürfen nicht vermischt werden (ADR 1B-011, Korrektur 2026-11-13). Das Fußballfeld nutzt T_job warm (148 585 ms) als 105 m; Netz (0,43 ms) und Transport (17,8 ms) sind Mediane über alle 10. Die Fußzeile der Folie nennt das. Test in Task 1.
2. **Token oder Header im Antwort-Ausschnitt:** Der neue Beleg aus dem Mitschnitt darf nur Modellausgabe und Torergebnis enthalten. Test in Task 2.
3. **Stille Schrift-Ersetzung:** Fehlt eine woff2-Datei, rendert Chromium eine Ersatzschrift ohne Fehler. Test in Task 4 (`document.fonts.check`).
4. **Deck braucht Internet:** Jede `http(s)://`-Referenz außer Links im Quellenverzeichnis bricht die Offline-Vorführung. Test in Task 7.
5. **Seiten- und Wortgrenzen:** Handout > 5 Seiten oder außerhalb 350–1.800 Wörter, Folien-Überlauf. Test in Task 9.

---

### Task 1: Datenmodul mit belegten Zahlen

**Files:**

- Create: `docs/referat-thema-1/abgabe/jonas/zahlen.mjs`
- Test: `docs/referat-thema-1/abgabe/jonas/zahlen.test.mjs`

**Interfaces:**

- Produces: `zahlen1B(lauf, kaltLaeufe, c0, b0) -> { netzMs, netzMaxMs, transportMs, adapterMs, inferAnteil, jobWarmMs, inferWarmMs, jobKaltMs, kaltMedianS, kaltSpanneS, c0DiffMs, b0JobMs, anzahl, commit, rechner }` (Zahlen ungerundet); `ZAHLEN_1C: Record<string, { wert: number|string, text: string, quelle: string, beleg: string, rechner: string, commit: string }>`; `fmt(wert, stellen) -> string` (de-DE, Komma); `ladeZahlen(root) -> { b1: …, c1: ZAHLEN_1C, quellen: { lauf: sha256, … } }`.

- [ ] **Step 1: Write the failing test** — `zahlen1B` aus `evidenz/1B/messung/2026-11-13-lauf.json` (plus `-kalt*.json`, `kontrolle-c0.json`, `lauf-b0.json`) ergibt gerundet: `fmt(netzMs,2) === '0,43'`, `fmt(transportMs,1) === '17,8'` (Median je Auftrag von `netzMs + serverOhneInferenzMs`), `Math.round(adapterMs) === 101`, `fmt(inferAnteil*100,2) === '99,92'`, `fmt(jobWarmMs/1000,1) === '148,6'`, `fmt(kaltMedianS,1) === '200,5'`, `fmt(c0DiffMs,1) === '−2,0'` (Minuszeichen U+2212), `fmt(b0JobMs,1) === '88,5'`, `commit.startsWith('8e9d1317')`. Für jeden Eintrag in `ZAHLEN_1C`: Die Datei `quelle` existiert und enthält den String `beleg` wörtlich.
- [ ] **Step 2: Run test, verify FAIL** — `node --test docs/referat-thema-1/abgabe/jonas/zahlen.test.mjs` → FAIL (Modul fehlt).
- [ ] **Step 3: Implement** — 1B aus den JSON-Feldern (`zerlegung.auftraege[]`, `zerlegung.kennzahlen.warm|kalt|netz|adapter`); Kaltwerte aus den fünf Dateien des Nachtrags M4 (Feldnamen dort nachlesen). `ZAHLEN_1C` mit den Kernzahlen der Folien J5–J7, J11, J12 aus den ADRs 1C-010 bis 1C-024 und dem Nachlauf (`requestMs` 29,4 ms, Validierung 1,2 ms = 1,6 %, q = 0,318, Inferenz 223,7 s, I = 98,7 s, Δ 0,419 GB je Auftrag, OOM ab Auftrag 19, s = 0,03 %, YESNO 5 von 5, N4 0 von 20 / 0 von 28); `beleg` ist jeweils ein wörtlicher Ausschnitt aus der Quelle.
- [ ] **Step 4: Run test, verify PASS.**
- [ ] **Step 5: Commit** — `git commit -m "test(referat): add the evidence-backed number module for Jonas' slides"`

### Task 2: Ausschnitt der abgelehnten Modellantwort

**Files:**

- Create: `docs/referat-thema-1/evidenz/1B/messung/antwort-ausschnitt.mjs`, `…/antwort-ausschnitt.test.mjs`
- Create (Ergebnis): `docs/referat-thema-1/evidenz/1B/messung/2026-11-15-abgelehnte-antwort.json`

**Interfaces:**

- Consumes: `modellAntworten(tsv)` aus `qualitaetstor.mjs`, `hasAcceptableQaSummaryQuality` wie dort eingebunden.
- Produces: `ausschnitt(tsv, { auftrag, maxZeichen }) -> { quelleSha256, auftrag, ausgabe, aussagen, torAkzeptiert: false, grund }`; JSON-Datei mit diesem Objekt.

- [ ] **Step 1: Write the failing test** — Mit einer synthetischen TSV (eine Antwort mit `Authorization: Bearer abc` in einer Kopfspalte) liefert `ausschnitt` nur Ausgabe und Torergebnis; `JSON.stringify(ergebnis)` enthält weder `Bearer` noch `abc` noch `Authorization`; `ausgabe.length <= maxZeichen`; `torAkzeptiert === false`.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement**; CLI: `node antwort-ausschnitt.mjs <http.tsv> <auftrag> > 2026-11-15-abgelehnte-antwort.json`.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Erzeugen** — `node … ~/labor-1b/20261113T081452/http.tsv 2` (kein Laborlauf, nur Datei lesen). Expected: JSON ohne Token (`grep -c -i bearer` → 0); vom Autor gegengelesen, bevor es committet wird.
- [ ] **Step 6: Commit** — `test(referat): extract a token-free rejected model answer as slide evidence`

### Task 3: Schriften

**Files:**

- Create: `docs/referat-thema-1/abgabe/jonas/schriften/` (Inter 400/600/700/800, IBM Plex Mono 400/600, je latin woff2; `OFL-Inter.txt`, `OFL-IBMPlexMono.txt`)

- [ ] **Step 1:** `npm pack @fontsource/inter@5.2.5 @fontsource/ibm-plex-mono@5.2.5` im Scratchpad (keine Abhängigkeit im Projekt), latin-woff2 und LICENSE kopieren. Expected: 6 woff2, 2 Lizenzdateien, zusammen < 500 KB.
- [ ] **Step 2: Commit** — `chore(referat): vendor OFL fonts for the offline slide deck`

### Task 4: Grafik-Funktionen

**Files:**

- Create: `docs/referat-thema-1/abgabe/jonas/grafik.mjs`, `grafik.test.mjs`, `stil.css`

**Interfaces:**

- Consumes: `zahlen1B`, `fmt` (Task 1).
- Produces: `logX(ms, { x0, x1, minMs, maxMs }) -> number`; `zeitzerlegungSvg(b1) -> string`; `wegSvg({ aktiv: 'klick'|'kontext'|'netz'|'inferenz'|'nachpruefung'|'gate'|null, b1, c1 }) -> string`; `fussballfeldSvg(b1, { zoom: 0..1 }) -> string`; `stil.css` mit den Tokens aus den Global Constraints und `@font-face` auf `schriften/`.

- [ ] **Step 1: Write the failing tests** — `logX(0.1,…) === x0`, `logX(1000000,…) === x1`, `logX(1,…)` liegt genau eine Dekade rechts; `zeitzerlegungSvg` enthält die Texte `0,43 ms`, `17,8 ms`, `101 ms`, `Schwelle 50 ms`, `Schwelle 2 s`; `fussballfeldSvg` enthält `0,3 mm`, `1,3 cm`, `104,9 m`; `wegSvg({aktiv:'inferenz'})` enthält genau einen Marker mit `data-aktiv="inferenz"`. Playwright-Test: eine Seite mit `stil.css` meldet `document.fonts.check('600 24px Inter')` und `document.fonts.check('400 24px "IBM Plex Mono"')` als `true` nach `document.fonts.ready`.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement** nach den Stilproben M2–M4 (Artefakt „Folien-Mischung 1C/1B“; Quelle im Scratchpad ist kein Repo-Bestandteil, Formen hier neu und sauber umsetzen).
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `test(referat): add SVG chart builders for the time breakdown and request path`

### Task 5: Folieninhalte J1–J15, Reserve und Rahmen

**Files:**

- Create: `docs/referat-thema-1/abgabe/jonas/folien.mjs`, `folien.test.mjs`

**Interfaces:**

- Consumes: Task 1, Task 2 (JSON), Task 4.
- Produces: `folien(daten) -> Array<{ id: 'J1'…'J15'|'R1'…|'G0'|'G9', teil: 'rahmen'|'jonas'|'reserve', auftrag: '1C'|'1B'|'beide'|null, titel, inhalt (HTML/SVG), notiz, zeitS, kurzfassung: boolean, quelle, station }>`.

- [ ] **Step 1: Write the failing test** — Summe `zeitS` der `teil==='jonas'`-Folien zwischen 700 und 760; Summe der `kurzfassung`-Folien zwischen 420 und 470; jede Jonas- und Reservefolie hat nicht leere `quelle` und `notiz`; jede Jonas-Folie hat `auftrag`; J13 enthält die Ausgabe aus `2026-11-15-abgelehnte-antwort.json` (gekürzt) und den Grund; keine Folie enthält eine Zahl, die nicht aus `daten` stammt (Test: alle Ziffernfolgen im Inhalt kommen in einer Whitelist aus formatierten Datenwerten, Foliennummern und Jahreszahlen vor).
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement** nach Design Abschnitte 4, 5, 7, 10 (Folienplan, Fragen auf J15, Übergänge); Rahmenfolien G0 (Einstieg, Systembild, wer macht was) und G9 (Kurzfazit) als Entwurf für Niklas. Der Nutzlast-Ausschnitt für J6 stammt aus einem committeten 1C-Beleg mit synthetischer Fixture (Fundstelle in `quelle`); ist keiner geeignet, wird er wie in Task 2 als neuer datierter Ausschnitt erzeugt.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `docs(referat): draft Jonas' slide content with sources and speaker notes`

### Task 6: Niklas' Abschnitte einbetten

**Files:**

- Create: `docs/referat-thema-1/abgabe/jonas/niklas-seiten.mjs`, `niklas-seiten.test.mjs`

**Interfaces:**

- Produces: `niklasSeiten(pdfPfad, ausgabeOrdner) -> Promise<string[]>` (PNG-Pfade, 1600 px breit via `pdftoppm -png -scale-to-x 1600 -scale-to-y -1`); fehlt `pdftoppm` oder das PDF, liefert sie `[]` und das Deck zeigt eine Platzhalterfolie „Teil Niklas“.

- [ ] **Step 1: Write the failing test** — mit einem einseitigen Test-PDF (per Playwright erzeugt) entsteht eine PNG mit Breite 1600; mit fehlendem PDF `[]`.
- [ ] **Step 2–4:** FAIL, implementieren, PASS.
- [ ] **Step 5: Commit** — `test(referat): embed Niklas' slide pages into the shared deck`

Hinweis: Niklas' PDFs (`abgabe/1A-folien.pdf`, später 1B 3–4) liegen erst nach seinem Merge auf `main`; bis dahin Platzhalter.

### Task 7: Deck (Browser) mit wanderndem Auftrag und Zoom

**Files:**

- Create: `docs/referat-thema-1/abgabe/jonas/deck-vorlage.html`, `deck.js`, `deck.test.mjs`

**Interfaces:**

- Consumes: `folien()`, `niklasSeiten()`, `stil.css`.
- Produces: `baueDeck(folien, { niklas: { teil1: string[], teil2: string[] }, clip?: string, eingebettet: true }) -> string` (eine selbstständige HTML-Datei: Schriften, Bilder und Clip als data-URI). Steuerung: →/Leertaste/Bild-ab vor, ←/Bild-auf zurück, `f` Vollbild, `r` Reserve-Übersicht. Sprechnotizen erscheinen nicht im Deck, sondern in `sprechnotizen.md` (Task 11).

- [ ] **Step 1: Write the failing tests** (Playwright, `file://`): Deck lädt ohne Konsolenfehler; Anzahl Folien = Rahmen + Niklas + Jonas; nach Pfeil rechts bis J5 hat der Marker `data-aktiv="kontext"`; mit `prefers-reduced-motion: reduce` gibt es keine laufenden Animationen (`document.getAnimations().length === 0` nach Folienwechsel); die HTML-Datei enthält keine `http://` oder `https://` außer in der Quellenfolie.
- [ ] **Step 2–4:** FAIL, implementieren (Marker-Übergang 600 ms ease, Zoom J10 als Kamerafahrt über `viewBox`-Animation in drei Stufen: Feld → 1 m → 1 cm → 0,3 mm), PASS.
- [ ] **Step 5: Commit** — `feat(referat): build the offline browser deck with the travelling request marker`

### Task 8: Clip (nur mit Freigabe) oder Nachbau

**Files:**

- Create: `docs/referat-thema-1/abgabe/jonas/clip-aufnahme.mjs` (Playwright-Videoaufnahme der Lehrenden-Ansicht im Labor), `abgabe/jonas/medien/clip.webm`, `medien/clip-standbild.png`
- Alternative ohne Freigabe: `lehrenden-nachbau.svg` aus `folien.mjs` (Ersatzzusammenfassung aus `2026-11-13-lauf.json`)

- [ ] **Step 1: Autor fragen**, ob ein Entwicklungslauf (`-LabTag dev-clip`, Labor starten, ein Auftrag) erlaubt ist; Hypothese entfällt, kein gewerteter Lauf.
- [ ] **Step 2 (mit Freigabe):** Aufnahme 1600 × 900, ≤ 12 s Schnitt (Klick, Ladeanzeige im Zeitraffer gekennzeichnet, Ersatzzusammenfassung), WebM ≤ 3 MB, Standbild aus der letzten Sekunde. Im Clip nichts außer synthetischen Fixture-Daten; Token, URLs mit Session-Code oder Hostnamen außerhalb des Labors nicht im Bild.
- [ ] **Step 2 (ohne Freigabe):** Nachbau als SVG, klar als „Nachbau“ beschriftet.
- [ ] **Step 3: Commit** — `docs(referat): add the lecturer-view clip for the gate slide` bzw. `… redrawn lecturer view …`

### Task 9: Handout

**Files:**

- Create: `docs/referat-thema-1/abgabe/jonas/handout-vorlage.html`, `handout.test.mjs`

**Interfaces:**

- Consumes: Task 1, 4, 5.
- Produces: `baueHandout(daten, personen) -> string` (A4, `@page { size: A4; margin: 16mm }`).

- [ ] **Step 1: Write the failing test** — PDF via Playwright, gelesen mit `pdf-parse`: Seiten ≤ 5; Wörter 350–1.800; enthält „Jonas“ in jeder Abschnittsüberschrift der Abschnitte 1C und 1B (ad personam); Abbildungen nummeriert („Abb. 1“ …) mit Quelle; Literaturliste vorhanden; ohne `personen` steht „Matrikelnummer: [lokal eintragen]“.
- [ ] **Step 2–4:** FAIL, implementieren nach Design Abschnitt 9, PASS.
- [ ] **Step 5: Commit** — `docs(referat): draft Jonas' handout with page and word checks`

### Task 10: Bauskript, Manifest, Matrikel

**Files:**

- Create: `docs/referat-thema-1/abgabe/jonas/bau.mjs`, `bau.test.mjs`, `abgabe/jonas/README.md`
- Output (committet, ohne Matrikel): `abgabe/jonas/jonas-deck.html`, `jonas-folien.pdf`, `jonas-handout.pdf`, `gemeinsames-deck.pdf`, `manifest.json`

**Interfaces:**

- Consumes: alle vorigen Tasks.
- Produces: CLI `node bau.mjs [--abgabe]`; ohne `--abgabe` Platzhalter, mit `--abgabe` liest es `~/.config/referat-thema-1/personen.json` (`[{ name, matrikel }]`) und schreibt nach `~/referat-abgabe/` (nie ins Repo).

- [ ] **Step 1: Write the failing test** — Bau in ein Temp-Verzeichnis: alle Ausgaben existieren; Manifest enthält SHA-256 aller Eingaben (Ergebnis-JSONs, Antwort-Ausschnitt, Vorlagen, Schriften) und Ausgaben; mit `--abgabe` und einer Test-`personen.json` landet keine Datei mit der Test-Matrikel im Repo-Ordner; Folien-PDF hat genau so viele Seiten wie Jonas-Folien plus Reserve.
- [ ] **Step 2–4:** FAIL, implementieren, PASS.
- [ ] **Step 5:** `node bau.mjs` ausführen, Ausgaben committen. README: Bau, Voraussetzungen (Node 24, Playwright-Chromium, `pdftoppm` optional), Datenherkunft, Matrikel-Regel.
- [ ] **Step 6: Commit** — `docs(referat): build Jonas' deck, slides and handout reproducibly`

### Task 11: Diskussionsmaterial und Doku

**Files:**

- Create: `docs/referat-thema-1/abgabe/jonas/fragenkatalog.md`, `sprechnotizen.md` (aus `folien.mjs` erzeugt, mit Sekunden und Kürzungsmarke)
- Modify: `docs/referat-thema-1/README.md` (Zeilen für Design, Plan, `abgabe/jonas/`), `rahmen/01-aufteilung.md` (datierter Hinweis: Reihenfolge-Vorschlag Niklas–Jonas–Niklas, gemeinsames Deck, noch abzustimmen)

- [ ] **Step 1:** Fragenkatalog: Fragen aus beiden Gerüsten plus mindestens 10 neue (Grenzen der Zeitzerlegung auf einer CPU, warum Mitschnitt statt Instrumentierung, Gate-Kriterien, KI-Anteil, Abweichungen von Release 1.3, Matrikel-/Datenregeln, Wiederholbarkeit); je Antwort ≤ 3 Sätze und Beleglink.
- [ ] **Step 2:** prettier, `git diff --check`.
- [ ] **Step 3: Commit** — `docs(referat): add discussion prep and map the presentation files`

### Task 12: Fachliche Review-Schleife

- [ ] **Step 1:** Frischer Reviewer (Subagent, stärkstes Modell), Auftrag: skeptischer Prüfer. Prüft jede Zahl in Deck und Handout gegen Datenmodul und Quelle (Rechner, Commit, Gruppe warm/alle), jede Aussage gegen ADR/Protokoll, Ad-personam-Kennzeichnung, Wortgrenzen, Prüfungsvorgaben (4.1.3, Handout-Formalia), KI-Offenlegung, Daten- und Matrikelregeln. Liefert Befunde mit Fundstelle.
- [ ] **Step 2:** Befunde beheben (je Befund: Test oder Quelle zeigen, dann Fix), Bau neu, Commit `fix(referat): …`.
- [ ] **Step 3:** Neuer Reviewer, gleiche Anweisung. Wiederholen, bis nur noch Banales gemeldet wird. Jede Runde mit Ergebnis im Ledger.

### Task 13: Visuelle Review-Schleife

- [ ] **Step 1:** Alle Folien und Handout-Seiten als PNG rendern (1600 × 900 und verkleinert auf 960 × 540; Graustufen-Variante), Reviewer mit `impeccable`-Audit-Kriterien: Lesbarkeit bei Bildschirmfreigabe, Hierarchie, Abstände, Kollisionen, Konsistenz mit Niklas' Teil.
- [ ] **Step 2:** Befunde beheben, neu bauen, Commit `style(referat): …`.
- [ ] **Step 3:** Neuer Reviewer; wiederholen bis nur noch Banales. Danach `impeccable` polish, letzter Bau, Bilder an den Autor schicken.
