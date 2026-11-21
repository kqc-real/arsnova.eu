# 1B Schritte 3–4 einarbeiten: Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Niklas' abgeschlossene Ergebnisse zu 1B Schritte 3–4 (PR #26) vollständig, einheitlich und generiert in
Deck (M1–M4, G9), Sprechnotizen, Sprechkarten, Fragenkatalog und Niklas' Handout einarbeiten; Rohdaten gzippen.

**Architecture:** `origin/main` in `feature-praesentation-jonas` mergen. `daten-1b34.mjs` liest alle gewerteten
1B-Ergebnisse (auch `.json.gz`), `folien-1b34.mjs` erzeugt M1–M4 im Designsystem von `jonas/` (grafik, wegkarte,
folien), `handout-latex-1a.mjs` erzeugt die Makros für Abschnitt 06 in PaperLab.

**Tech Stack:** Node 24 (`node --test`), SVG/HTML-Deck, LuaLaTeX über PaperLab (`./paperlab check|final`).

**Spec:** [Design, Abschnitt „1B Schritte 3–4 vollständig einarbeiten“](2026-11-16-gesamtpraesentation-design.md#1b-schritte-34-vollständig-einarbeiten-ergänzt-2026-11-17)

## Global Constraints

- Kein Produktionscode; Tests, Testhelfer und Skripte erlaubt. Eingefrorene 1C-Dateien nicht anfassen.
- Protokolle und Rohdaten inhaltlich nicht ändern; gzip byte-identisch (`gzip -9 -n`), Linkanpassung wie `83d17248`.
- Folien und Handout: jede Kernzahl aus Protokoll oder ADR, keine eigenen Herleitungen (Ordner-AGENTS.md).
- Jede Zahl mit Rechner und Commit in `quelle`; Autorenprüfung Niklas 2026-11-16.
- Niklas' Redezeit 14:00–15:00 min (Tests), Jonas' unverändert 14:35.
- Handout: ≤ 5 Seiten ohne Literatur, 350–1800 Wörter, `./paperlab check` 0 Fehler.
- Commits Englisch, Conventional Commits, keine KI-Attribution, nie `--no-verify`; nichts nach `main`.
- Tests in systemd-User-Units (`systemd-run --user --wait --collect …`), Laptop bleibt power-saver.
- Keine Matrikelnummern, Tokens, `.env`-Inhalte.

## Review Focus

1. Label-Teilreihen (`-01`…`-03`) gepoolt statt einzeln: Gesamt-p95 muss den Protokollwerten entsprechen
   (Normal 38,64/32,22/15,79/18,34; L1 40,62/31,64/16,83/22,07) – Test in Task 3.
2. `.json.gz` und `.json` nebeneinander oder nur eines vorhanden: keine Doppelzählung – Test in Task 2.
3. Breaker-/S1-/Transport-Dateien dürfen nicht als Störreihe in M1/M3 auftauchen – Test in Task 3.
4. Aufbaustufen: Stufenzahl der Folie = höchste `data-ab`; Wegkarten-Stufen = Störungsstufen – Test in Task 4/5.
5. Layoutwächter (Text ≥ 20 px, nichts außerhalb der Bühne, kein Überlauf) für M1–M4 – `deck.test.mjs`.

---

### Task 1: main mergen

**Files:** Merge-Konflikte `docs/referat-thema-1/README.md`, `docs/referat-thema-1/evidenz/1B/treiber.mjs`.

- [ ] `git merge origin/main`; README: beide Indexeinträge behalten. `treiber.mjs`: Niklas' Label-Pfad (`7c64dd6a`)
      plus Jonas' J13-Recorder (`59a7a8fd`) zusammenführen.
- [ ] Tests: `evidenz/1B/*.test.mjs`, `evidenz/1B/messung/*.test.mjs`, `abgabe/jonas/*.test.mjs`,
      `abgabe/niklas/*.test.mjs` grün (vorher und nachher Anzahl notieren).
- [ ] Merge-Commit (Standardnachricht `Merge remote-tracking branch 'origin/main' into feature-praesentation-jonas`).

### Task 2: Rohdaten gzippen

**Files:** `evidenz/1B/messung/*.json` > 1 MB → `.json.gz`; Leser `abgabe/niklas/daten-1b34.mjs`,
`evidenz/1B/vergleichen.mjs`, `evidenz/1B/s1.mjs`, `evidenz/1B/experiment-result.mjs` (nur falls sie
Ergebnisdateien lesen); Links in `evidenz/1B/*.md`, `1B-ergebnis.md`, `README.md`, ADR 1B-020.

- [ ] Test zuerst: `liesJson(pfad)` (neu, `evidenz/1B/json-lesen.mjs`) liest `.json` und `.json.gz` gleich;
      `eingaben1B34` liefert je Lauf genau einen Pfad.
- [ ] gzip; `sha256` des entpackten Inhalts = Original (im Commit-Text nennen).
- [ ] Leser umstellen, Links umbiegen, `rg '\.json\)' evidenz/1B` ohne Treffer auf gzippte Dateien.
- [ ] Commit `docs(referat): store 1B step 3-4 raw data gzip-compressed and byte-identical`.

### Task 3: Daten für M1–M4 und Handout

**Files:** `abgabe/niklas/daten-1b34.mjs`, `daten-1b34.test.mjs` (neu oder in `folien-niklas.test.mjs`).

**Interfaces – Produces:** `ladeDaten1B34(root)` → `{ vorhanden, laeufe, finde(v, a), schwellen, breaker: {f1, l3},
s1: {label, summary}, transport: {label: {transportMedianMs, anteilMedianProzent, anteilMaxProzent, n},
summary: {…}} }`. Label-Teilreihen: ein Eintrag je Variante (Dateien mit `-NN` gepoolt, `n` summiert,
`clientMs`-Liste); Label nutzt Client-Zeit (`zeitArt: 'client'`), Summary Job-Zeit (`zeitArt: 'job'`).

- [ ] Tests mit Protokollwerten: Label-Normal p95 (38,64/32,22/15,79/18,34), L1 gesamt, F2-Label Client-Median
      30 040 ms, Breaker F1 viermal Job ≤ 53 ms mit `circuit_open` am vierten, Breaker L3 vier Timeouts ≈ 90 s,
      S1-Label p95 Beitritt 47,60, Transport Label 8,714 ms / 0,247 %.
- [ ] Implementieren, grün, Commit `feat(referat): load all graded 1B step 3-4 results for slides and handout`.

### Task 4: Wegkarte

**Files:** `abgabe/jonas/wegkarte.mjs`, `wegkarte.test.mjs`.

- [ ] Zeichen `langsam` (Netz +50/+500 ms) in `STOERUNG_ZEICHEN`; `1b-stoerung` Stufe 2 = `drop` + `langsam`;
      Marken `1b-breaker` (stopp, spaet) und `1b-s1` (Text „Ein Host (S1)“). Tests zuerst, Commit.

### Task 5: Folien M1–M4, Reserve, Zeiten

**Files:** `abgabe/niklas/folien-1b34.mjs`, `folien-1a.mjs` (N6b → RN1, N8 → RN4 Reserve), `folien-niklas.test.mjs`.

- [ ] Tests zuerst: Ids `M1–M4`, `zeitS` 75/50/60/55, `aufbau` 3/2/2/2, Niklas gesamt 14:00–15:00, keine Zahl
      ohne Datenquelle, Titel aus Daten, keine Aussage „kein Vergleich mit einem LLM“, ADR 1B-020 im Fuß.
- [ ] M1 Ersatzzeit (Summary Kreis/Job, Label Raute/Client, Fristen 30 s und 300 s), M2 Breaker/Queue-Bahnen
      mit Codebeleg, M3 Raster (Summary ohne Normal, Label mit Normal) plus Fehler- und Transportzeile, M4 S1 und
      Entscheidung ADR 1B-020. Notizen, Stichpunkte, `quelle` je Folie.
- [ ] `impeccable`-Prüfung am gerenderten Deck (1920×1080), Layoutwächter grün; Commit.

### Task 6: G9, Fragenkatalog, Hinweisliste

**Files:** `abgabe/jonas/folien.mjs` (G9), `abgabe/niklas/fragenkatalog-1a.md`, `abgabe/jonas/fragenkatalog.md`
(nur Verweise), `abgabe/niklas/HINWEISE-1B34.md` (neu, Hinweisliste für Niklas).

- [ ] G9-Satz und Quelle neu; Fragen zu RST/DROP (Verbindungsaufbau gibt nach ≈ 2¼ min auf), Breaker/Queue,
      Label vs. Summary, S1, ADR 1B-020, Plan-Nachträge (`aa0e90c7`), Summary-Normal gegen B0 (eigene
      Nachrechnung, als solche markiert), `processWithTimeout` → `runWithQueueTimeout`. Commit.

### Task 7: Handout Niklas

**Files:** `abgabe/niklas/handout-latex-1a.mjs`, Test; PaperLab `…1a-1b_niklas/sections/06_auftrag1b.tex`,
`02_grundlagen.tex`, `03_methode.tex`, `generated/zahlen.tex`.

- [ ] `makros1B34` um Label, Breaker, S1, Transport erweitern (Tests zuerst).
- [ ] 06 neu (Tabelle Summary/Label je Störung, Breaker, Live, S1, Entscheidung mit ADR 1B-020), KI-Modell
      GPT-6.1 Sol in Codex, Marke für Niklas' eigene Prüfung bleibt; 1A straffen.
- [ ] `./paperlab check` 0 Fehler, 5 Seiten ohne Literatur, Wörter ≤ 1800; Seiten ansehen. Commits in beiden Repos.

### Task 8: Bauen, Ansehen, Abschluss

- [ ] `node docs/referat-thema-1/abgabe/jonas/bau.mjs`; alle Tests grün; Deck im Browser (playwright-cli) jede
      neue Folie in jeder Stufe ansehen; PDFs, Sprechkarten prüfen.
- [ ] Ganz-Zweig-Review (ein Reviewer), Funde beheben; `loadout:docs-sync`; Commit `build(referat): …`, push.
