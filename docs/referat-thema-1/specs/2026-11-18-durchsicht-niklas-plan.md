# Änderungen nach der Durchsicht: Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die elf Änderungen aus der gemeinsamen Durchsicht umsetzen: Titel,
1B-Chip, G0, GK, J2/J4, N4, M1, die neue Folie „Nachweisumfang“, Endfolie und
ein gemeinsames Literaturverzeichnis. Notizen, Hefte und Ausgaben werden
nachgezogen.

**Architecture:** Alle Folien sind Objekte aus `folien()` (Jonas, Rahmen) und
aus `abgabe/niklas/folien-*.mjs` (Niklas). `deck.mjs` setzt sie zum Deck
zusammen, `bau.mjs` baut daraus Deck, PDFs und die privaten Ausgaben.
Sprechnotizen kommen über `privat('ID.feld', werte)` aus `privat/notizen.mjs`,
Heftseiten aus `privat/sprechheft/<ID>.md`.

**Tech Stack:** Node 24 ESM, `node:test`, Playwright (Layout und PDF),
statisches HTML und SVG.

**Spec:** `docs/referat-thema-1/specs/2026-11-18-durchsicht-niklas-design.md`

## Global Constraints

- Stage 1920 × 1080, intern 1600 × 900. Schriften Inter und IBM Plex Mono
  offline.
- Jede Folie hat eine Quellenfußzeile.
- Layouttests in `deck.test.mjs` bleiben grün. Weicht eine Designregel bewusst
  ab (96-px-Titel), wird die Ausnahme dort mit Begründung eingetragen, nicht
  der Test abgeschaltet.
- Jede Zahl auf Folien kommt aus `FESTWERTE`, `nachweisumfang.mjs` oder den
  Daten-Modulen, mit Quelle. Keine Herleitungen auf der Folie.
- Sprechnotizen, Stichpunkte und Heftseiten nur in `privat/`, nie im
  öffentlichen Code.
- Kein Produktionscode, keine eingefrorenen Protokolle (`evidenz/**`) ändern.
- Commits Englisch nach Conventional Commits, ohne KI-Attribution und ohne
  `--no-verify`.
- Tests laufen in einer systemd-User-Unit (`systemd-run --user --wait --pipe`).
- Laptop bleibt im Profil power-saver.
- Literatur nach IU-Leitfaden
  (`~/Documents/Code/PaperLab/docs/guidelines/IU_Source_of_Truth.md`). Wo APA 7
  abweicht, gilt der IU-Leitfaden.

## Review Focus

1. **Druckauszüge:** Beide Literaturfolien erscheinen in `jonas-folien.pdf`
   **und** `niklas-folien.pdf`, und die Seitenzählung „i / n“ stimmt.
2. **Zeitplan:** GN (Jonas, 20 s) verschiebt die „bis hier“-Zeiten.
   - Der Hauptteil endet bei etwa 29:20 und nie über 30:00.
   - Jonas' Redezeit-Test spiegelt die 20 s, statt still zu brechen.
3. **Verwaiste oder fehlende Heftseiten:**
   - R17 und NL entfallen, GN, LV1 und LV2 kommen dazu.
   - Ohne `privat/` laufen alle öffentlichen Tests weiterhin grün.
4. **Überlauf:** Der 96-px-Titel auf GT und GD, die Vier-Spalten-Tabelle auf
   J2 und die Literaturfolien bei 20 px laufen nicht über (Layouttest plus
   Blick auf das Bild).
5. **Kurzbelege:** Jeder Kurzbeleg in einer Fußzeile, auch bei Niklas, hat
   genau einen Eintrag in der gemeinsamen Liste, und jeder Eintrag wird
   zitiert.

---

### Task 1: Ein 1B-Chip und Titelfolie A

**Files:**

- Modify: `abgabe/jonas/folien.mjs`:
  - `etikett`;
  - `TEILE` (Z. 34–67);
  - GT (Z. ~922–960);
  - J1 (Z. ~1031);
  - G9 `person(...)` (Z. ~1579–1583).
- Modify: `abgabe/jonas/deck.mjs`: Oberzeile vor dem H1, wenn `f.oberzeile`
  gesetzt ist.
- Modify: `abgabe/jonas/stil.css`:
  - `.etikett-schritte`;
  - `.folie[data-titelfolie] .folie-titel`;
  - `.titel-oberzeile`;
  - `.titel-meta` in einer Zeile.
- Test: `abgabe/jonas/folien.test.mjs`, `abgabe/jonas/deck.test.mjs`

**Interfaces:**

- Produces: `etikett(auftrag: string, schritte?: string): string`.
  - Mit Schritten wird daraus
    `<span class="etikett etikett-1b">1B <span class="etikett-schritte">Schritte 1–2</span></span>`.
  - Ohne Schritte bleibt die Ausgabe wie bisher.
- Produces: Folienfeld `oberzeile?: string`. `deck.mjs` setzt es als
  `<p class="titel-oberzeile">` vor das `<h1>`.
- Produces: `TEILE[i].etiketten` als `[auftrag, schritte?]`, wobei `schritte`
  nur die Ziffern sind (`'1–2'`).

- [ ] **Step 1: Failing tests**
  - `folien.test.mjs`, Test „1B mit Schritten ist ein Chip“:
    - `etikett('1B', '1–2')` enthält `etikett-schritte` und „Schritte 1–2“
      innerhalb desselben äußeren `span`.
    - Kein Folieninhalt enthält mehr `<span class="zusatz">Schritte`.
    - Kein Folieninhalt enthält „Schritte 1–2“ außerhalb von
      `etikett-schritte`, außer in Fließtext von Reserve und Notiz.
  - Test „GT“:
    - Titel ist `KI-Inferenz im Moderationskompass`.
    - `oberzeile` ist `Thema 1 · Cloud Computing`.
- [ ] **Step 2: Run, expect FAIL**
  ```
  systemd-run --user --wait --pipe -p WorkingDirectory=$PWD node --test docs/referat-thema-1/abgabe/jonas/folien.test.mjs
  ```
- [ ] **Step 3: Implement**
  - GT nach Spec 1. CSS-Werte:
    - Titel 96 px, Gewicht 800, Zeilenhöhe 1.02;
    - Oberzeile 28 px, 600, Großbuchstaben, gedämpft;
    - `.titel-meta` als eine Zeile mit vier Gruppen.
  - Den Zeilenumbruch im Titel setzt `<br>` nur im HTML; `f.titel` bleibt
    ohne Umbruch, weil es auch für aria-label und Übersicht dient.
  - G9:
    - Köpfe „Jonas“ und „Niklas“ jeweils mit den Chips:
      `etikett('1C') etikett('1B','1–2')` bzw.
      `etikett('1A') etikett('1B','3–4')`.
    - Den Begleittext „1C und 1B, Schritte 1–2“ dafür entfernen.
  - Die Teilleiste oben rechts (`TEILE[].kurz`) bleibt Text.
- [ ] **Step 4: Run folien und deck tests, expect PASS**
  - Wenn ein Größentest an 96 px scheitert, die Ausnahme für
    `[data-titelfolie]` und GD mit Begründung in `deck.test.mjs` eintragen.
- [ ] **Step 5: Rendern und ansehen:** GT, G0, J1 und G9 (Skript
      `shot.cjs`-Muster: Playwright, `#ID`, Endstufe).
- [ ] **Step 6: Commit**
      `feat(referat): make 1B with steps one chip and enlarge the title slide`

### Task 2: G0 „Gemeinsam“ und GK „arsnova.eu im Überblick“

**Files:**

- Modify: `abgabe/jonas/folien.mjs`:
  - `TEILE[3]`;
  - G0-Renderer;
  - GK.
- Modify: `abgabe/jonas/grafik.mjs`: `SYSTEM` (Z. ~955) und `systemSvg`
  (Z. 997 ff.).
- Test: `folien.test.mjs`, `grafik.test.mjs`

**Interfaces:**

- Consumes: `etikett(a, schritte)` aus Task 1.

- [ ] **Step 1: Failing tests**
  - G0, Spalte 4:
    - enthält Chips 1A, 1B und 1C ohne `etikett-schritte`;
    - Text „Fazit: Antwort auf die Leitfrage“;
    - kein „alle Aufträge“.
  - GK:
    - Titel `arsnova.eu im Überblick`;
    - Untertitel wörtlich aus Spec 4.
  - `systemSvg`:
    - Texte „Hörsaal (+Lehrperson)“ und „Lehrperson“ in zwei getrennten
      `rect`;
    - ein Pfeil endet an `S.live`, einer an `S.kompass`;
    - kein Text „Lehrperson“ mehr im Hörsaal-Kasten.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**
  - `TEILE[3].etiketten = [['1A'], ['1B'], ['1C']]`,
    `was = 'Fazit: Antwort auf die Leitfrage'`.
  - `SYSTEM`:
    - `hoersaal` endet über der Kompass-Höhe;
    - neuer Kasten `lehrperson` auf Höhe von `S.kompass`;
    - Pfeil `hoersaal → live`, Pfeil `lehrperson → kompass`.
  - Die drei Aufbaustufen von GK bleiben.
  - Den aria-Text am Ende von `systemSvg` anpassen.
- [ ] **Step 4: Run, expect PASS; GK in allen drei Aufbaustufen rendern und
      ansehen**
- [ ] **Step 5: Commit**
      `feat(referat): rename the arsnova overview and split lecture hall and lecturer`

### Task 3: J2 Konfigurationstabelle, J4 ohne Abweichungskasten

**Files:**

- Modify: `abgabe/jonas/folien.mjs`: `FESTWERTE` (nur falls ein Wert fehlt),
  J2, J4.
- Test: `folien.test.mjs`

**Interfaces:**

- Consumes:
  - `fw.v13Cpus`, `fw.v13SpeicherGiB`, `fw.v13TimeoutS`;
  - `fw.releaseCpus`, `fw.prodSpeicherGiB`, `fw.releaseTimeoutS`;
  - `fw.laborCpus`, `fw.laborTimeout1BS`, `fw.kalibrierung1BS`;
  - `fw.laborCpus1C`, `fw.laborSpeicher1CGiB`.
  - 1B-Laborspeicher = `prodSpeicherGiB`. Quelle: 1B-Design 3.4,
    „`mem_limit 8g` … bleiben“; ein eigener `FESTWERTE`-Eintrag
    `laborSpeicher1BGiB` mit dieser Quelle.
  - 1C-Timeout = 300 s; bestehender Wert prüfen, sonst Eintrag mit Quelle
    ADR 1C-020.

- [ ] **Step 1: Failing test „J2: Konfiguration in vier Spalten“**
  - Spaltenköpfe:
    - „Release 1.3 (Tag)“;
    - „v1.4.0 ab Werk (gemessener Code)“;
    - „Labor 1B (zwei VMs)“;
    - „Labor 1C (ein Rechner)“.
  - Zeilenwerte genau `4 | 8 | 4 | 4`, `5 GiB | 8 GiB | 8 GiB | 5 GiB`,
    `8 s | 90 s | 300 s | 300 s`.
  - Fett genau die Abweichungen vom gemessenen Code: Labor-CPUs,
    1C-Speicher, beide Labor-Timeouts.
  - J4 enthält keinen Text „Abweichungen und Grenzen“.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**
  - J2: Den Kasten ersetzt eine `<table>` im Stil der Hypothesen-Tabelle von
    J4.
  - Darunter eine Vermerkzeile: „Images selbst gebaut · Summary-Schalter an ·
    1C über Loopback mit Messproxy · Kalibrierung 1B: I = 202 s“, Werte aus
    `fw`.
  - Das Grid darf von `820px 1fr` abweichen, damit die Tabelle bei ≥ 22 px
    passt.
  - J4: Den Kasten entfernen und die Hypothesen-Tabelle über die volle Breite
    oder zentriert setzen.
- [ ] **Step 4: Run folien und deck tests, expect PASS; J2 und J4 rendern und
      ansehen**
- [ ] **Step 5: Commit**
      `feat(referat): show release, factory and lab configuration side by side on J2`

### Task 4: N4 schreibt H1 und H2 aus, M1 zeigt n

**Files:**

- Modify: `abgabe/niklas/folien-1a.mjs` (N4, Z. ~233–280).
- Modify: `abgabe/niklas/folien-1b34.mjs` (`ersatzSvg`, Z. ~80–190).
- Test: `abgabe/niklas/folien-niklas.test.mjs`

- [ ] **Step 1: Failing tests**
  - N4 enthält zwei Zeilen:
    - „H1:“ mit „V2“ und „V1“;
    - „H2:“ mit „V3“ und „V4“.
  - Die Quelle von N4 nennt `1A/1A-experiment-contract.md`.
  - `ersatzSvg(d)`:
    - Für jede Zeile steht ein Text `n = <Anzahl>` je vorhandenem Consumer,
      und die Anzahl ist `zeitenMs.length` aus `d.finde`.
    - Bei den echten Daten heißt das zum Beispiel für Normal „Summary n = 10 ·
      Label n = 30“, für Netz +500 ms „Label n = 3“.
    - Die Lesehilfe „Jeder Punkt ein Auftrag; gleiche Zeiten liegen
      übereinander“ steht unter der Achse.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**
  - N4: Die Zeilen sitzen im Regelkasten unter der Regel, 24 px.
  - M1: n in der zweiten Textzeile unter dem Zeilennamen, gedämpft, 20 px.
    Die Lesehilfe kommt in die Achsenbeschriftung oder als eigene Zeile.
  - Die Höhe `H` wächst bei Bedarf.
- [ ] **Step 4: Run, expect PASS; N4 und M1 rendern und ansehen**
- [ ] **Step 5: Commit**
      `feat(referat): spell out 1A hypotheses and show job counts on the fallback chart`

### Task 5: Folie GN „Nachweisumfang“, schlanke Endfolie GD

**Files:**

- Modify: `abgabe/jonas/folien.mjs`:
  - neue Rahmenfolie GN nach G9;
  - GD;
  - R17 entfernen;
  - `ZITATE` für GN, R17 löschen.
- Modify: `abgabe/jonas/deck.mjs`: Rahmenliste
  `['GT','G0','GK','G9','GN','GD']`; GN steht zwischen `g9` und `gd`.
- Modify: `abgabe/jonas/stil.css`: GD-Titel wie der Titel von GT; Layout von
  GN.
- Test: `folien.test.mjs` (Test „R17: …“ wird „GN: …“), `deck.test.mjs`,
  `bau.test.mjs`

**Interfaces:**

- Consumes: `nachweisLeiste(daten.nachweis)` (Kennzahlen und Balken, bisher
  auf GD), `nw.zeilen`, `nw.je`.
- Produces: Folie `{ id: 'GN', teil: 'rahmen', sprecher: 'jonas', zeitS: 20,
kurzfassung: true, titel: 'Nachweisumfang: Rechnerzeit, Tests, Hypothesen' }`.

- [ ] **Step 1: Failing tests**
  - Die Reihenfolge im Deck endet mit `…, 'G9', 'GN', 'GD'`, danach Anhang.
  - GN:
    - enthält `data-nachweis` und `data-nachweis-je`;
    - jede Kennzahl aus `kopfzahlen()`;
    - aus R17 die Test-Aufschlüsselung und die Hypothesen je Auftrag, jede
      Zahl gleich `tabellenwerte()`.
  - Die Wertungsliste von R17 (`/umfangreich|beeindruck|…/`) gilt jetzt für
    GN.
  - GD:
    - kein `data-nachweis`;
    - enthält den Satz aus Spec 10 wörtlich vor dem Link.
  - Keine Folie R17 mehr; die Reserveliste im Test ohne R17.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**
  - GN:
    - oben `nachweisLeiste`;
    - darunter zwei kompakte Spalten aus R17: Tests je Werkzeug, Hypothesen
      je Auftrag;
    - die Rechnerzeit-Spalte entfällt, weil der Balken sie zeigt;
    - der Vermerk „Rechnerzeit, keine Arbeitszeit“ bleibt.
  - GD:
    - nur Dank-Titel, „Alle Belege zum Nachprüfen“, der Satz zu den Belegen,
      der Fork-Satz, Link, Namen und QR;
    - CSS so, dass Titel und QR vertikal ausgewogen sind.
  - Die Quelle von GN ist die bisherige Quelle von R17.
- [ ] **Step 4: Run, expect PASS; GN und GD rendern und ansehen**
- [ ] **Step 5: Commit**
      `feat(referat): add the evidence scope slide before the closing slide`

### Task 6: Ein gemeinsames Literaturverzeichnis

**Files:**

- Modify: `abgabe/jonas/literatur.mjs`:
  - `LITERATUR` enthält alle Einträge, also auch heo2024, nosek2018 und
    schneider2026 aus `literatur-1a.mjs`;
  - Korrekturen nach IU-Prüfung.
- Modify: `abgabe/niklas/literatur-1a.mjs`:
  - nur noch eine dünne Schicht: `kurzbeleg1A = kurzbeleg`;
  - `LITERATUR_1A` = Einträge, deren Schlüssel Niklas zitiert (für das
    Handout).
- Modify: `abgabe/jonas/folien.mjs`: J16 wird zu LV1 und LV2.
- Modify: `abgabe/niklas/folien-1a.mjs`: NL entfernen.
- Modify: `abgabe/jonas/deck.mjs` und `deck-vorlage.html`:
  - Feld `gemeinsam: true` → Attribut `data-gemeinsam`;
  - die Druck-CSS blendet `[data-gemeinsam]` in keinem Auszug aus.
- Modify: `abgabe/jonas/literatur.test.mjs`:
  - der Abgleich gilt für beide `.bib`;
  - jeder Eintrag steht mit gleichem Schlüssel und gleicher URL in mindestens
    einer.
- Modify (PaperLab):
  - `…/presentation-semester-7-cloud-computing-1b-1c_jonas/main.bib`;
  - `…/presentation-semester-7-cloud-computing-1a-1b_niklas/main.bib`;
  - nur, wo die IU-Prüfung einen Eintrag korrigiert.
- Test: `literatur.test.mjs`, `folien.test.mjs` (J16-Bezüge → LV1/LV2),
  `deck.test.mjs` (Z. 530), `bau.test.mjs`

**Interfaces:**

- Produces: `LITERATUR` (alle Einträge, alphabetisch nach ZL) und
  `kurzbeleg(schluessel, stelle?)`.
- Produces: Folien `LV1`, `LV2` mit `teil: 'jonas', anhang: true,
gemeinsam: true`. Die Aufteilung ist alphabetisch fortlaufend, etwa die
  Hälfte der Einträge je Folie. Schrift 20 px. Titel „Literaturverzeichnis
  (1/2)“ und „(2/2)“.

- [ ] **Step 1: IU-Prüfung**
  - Jeden Eintrag gegen `IU_Source_of_Truth.md` prüfen:
    - Literaturverzeichnis-Abschnitte;
    - Reihenfolge, „&“ ohne Komma, „Hrsg.“, deutsches Datum;
    - DOI als https-URL, kursive Teile, Software und Preprints.
  - Jede Korrektur als Zeile in die Kommentarliste oben in `literatur.mjs`
    („Geprüft 2026-11-18: …“).
- [ ] **Step 2: Failing tests**
  - Jeder Kurzbeleg in einer Fußzeile oder `ZITATE` des ganzen Decks (Jonas
    und Niklas) hat einen Eintrag.
  - Jeder Eintrag wird mindestens einmal zitiert.
  - Sortiert nach `localeCompare(…, 'de')`.
  - LV1 und LV2 zusammen = `LITERATUR`.
  - Im gebauten Deck tragen LV1 und LV2 `data-gemeinsam`.
  - Ein Playwright-Test druckt `?druck=jonas` und `?druck=niklas` und prüft:
    beide sichtbar, NL existiert nicht.
- [ ] **Step 3: Run, expect FAIL**
- [ ] **Step 4: Implement** wie oben. `kurzbeleg1A` bleibt als Name erhalten,
      damit Niklas' Folien unverändert importieren.
- [ ] **Step 5: Run, expect PASS; LV1, LV2 rendern und ansehen; den
      Abgleichtest gegen beide `.bib` laufen lassen**
- [ ] **Step 6: Commit**
  - Fork:
    `feat(referat): merge both reference lists into one shared list on two slides`
  - PaperLab: `fix(references): align entries with the IU citation guide`,
    nur wenn geändert.

### Task 7: Notizen, Hefte, Zeiten, Neubau

**Files:**

- Modify (privat):
  - `privat/notizen.mjs`:
    - Einträge für GT, G0, GK, J2, J4, N4, M1, G9, GD;
    - neue Einträge GN, LV1, LV2;
    - Einträge R17, NL, J16 entfernen;
    - Übergang G9 → GN → GD neu.
  - `privat/sprechheft/<ID>.md`: Seiten GN, LV1, LV2 neu; R17, NL, J16
    entfernen; geänderte Folien anpassen. Die Abschnittsregeln von
    `sprechheft.test.mjs` gelten.
- Modify: Zeit-Erwartungen in Tests, falls sie das Ende 29:00 oder Jonas'
  Summe fest prüfen.

- [ ] **Step 1: Notizen und Heftseiten schreiben**
  - J2 und M1 erklären die Tabelle bzw. die Zählung, insgesamt 114 Aufträge.
  - GN in 20 s gesprochen.
  - Jede Zahl im Heft hat eine Fundstelle.
- [ ] **Step 2: Bauen**
      `node docs/referat-thema-1/abgabe/jonas/bau.mjs`
- [ ] **Step 3: Alle Tests mit `privat/`**
  - Befehl:
    ```
    systemd-run --user --wait --pipe -p WorkingDirectory=$PWD node --test docs/referat-thema-1/abgabe/**/*.test.mjs
    ```
  - Erwartung: 0 fail.
- [ ] **Step 4: Alle Tests ohne `privat/`**
  - `privat/` vorübergehend umbenennen und den Befehl aus Step 3 erneut
    ausführen. Erwartung: 0 fail, nur Überspringen.
  - Danach `privat/` zurückbenennen.
- [ ] **Step 5: Ansehen**
  - Bilder:
    - jede geänderte Folie in Endstufe und Zwischenstufen;
    - die Referentenansicht auf GN (Taste n);
    - Seiten der beiden Einzel-PDFs mit Literatur.
- [ ] **Step 6: Commit**
  - Fork:
    `build(referat): rebuild deck and PDFs after the joint review`
  - privat: `feat: update notes and booklet for the joint review changes`

### Abschluss

- Eine Durchsicht des ganzen Zweigs durch einen frischen Reviewer.
- Danach `loadout:docs-sync` für die README-Dateien:
  - `abgabe/jonas/README.md` (Folienliste, Literatur);
  - `privat/README.md`.
- Push erst nach Rückfrage.
