# Design: Abschlussdokumentation 1C (Ergebnisbericht, ADRs, Begleitdokumente)

- **Datum:** 2026-11-05
- **Autor:** Jonas Weirauch (Rolle Y); Entwurf mit Claude Code
- **Status:** freigegeben vom Autor am 2026-11-05; Builder-Check durchgeführt, Antworten eingearbeitet
- **Branch:** `feature-1C-context-path` (Draft-PR NiklasSkulll/arsnova.eu#12)

## 1. Zweck und Warum

1C ist inhaltlich abgeschlossen: Rekonstruktion (Dossier), modellfreie Tests (Teil 1–3), Messungen M1–M7 und Gegenvariante V1, Laborlauf am Laptop, Zusatzlauf am PC mit Produktionslimits, Ursachenversuch U1. Die Ergebnisse liegen aber über rund 20 Dateien verteilt (Dossier, Designs, Pläne, Protokolle, Messdaten, Diagramme).

Ziel: Aus den Docs allein sollen danach **ohne Rückgriff auf Chats oder Erinnerung** die PR-Beschreibung (Vorlage `.github/pull_request_template.md`), das Handout (max. 5 Seiten, 350–1.800 Wörter, PDF) und die Folien für 15 Minuten Vortrag und Diskussion entstehen können. Jede Aussage soll bis zu Datei, Zeile, Commit oder Rohdatum zurückverfolgbar sein. Die Prüfung bewertet einzeln; die Doku muss deshalb den Eigenanteil sauber ausweisen.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**

1. Ein **Ergebnisbericht 1C** als Einstieg: Leitfrage → Auftragsschritte 1–4 → Pflicht-Nachweiskette → Befunde mit Gültigkeitsgrenze → Empfehlungen mit Kosten-, Risiko- und Betriebsfolge → Verweise.
2. **ADRs** für alle 1C-Entscheidungen, fachlich und methodisch, je mit Kontext, Entscheidung, verworfenen Alternativen, Folgen und Belegen.
3. **Ursachenketten** für die Befunde, die eine Ursache haben (vor allem OOM → Prompt-Cache; A4 Timeout; T3.1 Hash): Beobachtung → Hypothese → Versuch → Ergebnis → Entscheidung, jeweils verlinkt.
4. Aufräumen veralteter Stellen in den 1C-Dossiers, als gekennzeichnete Aktualisierung.
5. Begleitdokumente: gebündelte Issue-Entwürfe, Eigenanteil-Übersicht, Gerüst für Folien und Handout.

**Nicht-Ziele**

- Kein Produktivcode, keine Änderung an Verträgen, Tests oder Messskripten; kein Fix des `--cache-ram`-Befunds. Begründung: `docs/didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md` Z. 145 („Ein vollständiger Produktivpatch … wird nicht verlangt … Beibehaltungs-, Konfigurations-, Betriebs- oder Verbesserungsempfehlung“).
- Keine fertigen Folien und kein fertiges Handout (nur Gerüst).
- Keine Doku zu 1A und 1B Schritte 3–4 (Niklas); 1B Schritte 1–2 nur, soweit 1C sie berührt (Runtime-Limits, Swap).
- Keine neuen Messungen.
- Keine Issues anlegen (nur Entwürfe; Anlegen nur mit Freigabe des Autors).

**Anti-Ziele** (Misserfolg, auch wenn alles „da“ ist)

- Eine Aussage im Bericht oder in einem ADR, die nicht durch eine verlinkte Quelle gedeckt ist, oder Zahlen, die von Protokoll oder Rohdaten abweichen.
- Inhalt doppelt pflegen: Der Bericht und die ADRs fassen zusammen und verlinken, sie kopieren keine Tabellen aus den Protokollen (docs-policy: jede Tatsache hat genau ein Zuhause).
- Vorregistrierte Designs, Protokolle oder Messdaten inhaltlich verändern.
- Persönliche Daten (Matrikelnummer, E-Mail) im öffentlichen Fork; Inhalte aus privaten Notizen (`arsnova-notes`, `1C-pruefungsfrage-vorbereitung.md`).
- Leistung von Niklas, KI-Sitzungen oder upstream als eigene ausweisen.

## 3. Festlegungen des Autors (2026-11-05)

| Frage         | Entscheidung                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zweck         | PR/Prüfer und Präsentation gleichrangig                                                                                                            |
| ADR-Ort       | eigener Ordner `docs/referat-thema-1/adr/`, deutsch, nummeriert `1C-NNN`; nicht im Produkt-`docs/` von upstream                                    |
| ADR-Umfang    | alle 1C-Entscheidungen: fachliche Ergebnisse **und** Methodikentscheidungen                                                                        |
| Einstieg      | neuer Ergebnisbericht; bestehende Dossiers bleiben und werden verlinkt                                                                             |
| Sprache       | Deutsch (Fachbegriffe, Code, Bezeichner englisch)                                                                                                  |
| Bestand       | auch aufräumen: veraltete Stellen in Dossiers als gekennzeichnete Aktualisierung; vorregistrierte Designs, Protokolle, Messdaten bleiben unberührt |
| Extras        | Issue-Entwürfe bündeln, Eigenanteil-Übersicht, Folien-/Handout-Gerüst                                                                              |
| Fix im Scope? | nein (siehe Nicht-Ziele)                                                                                                                           |

## 4. Zielstruktur (Vorschlag; Dateinamen dürfen vom Builder angepasst werden)

```text
docs/referat-thema-1/
  1C/1C-ergebnis.md                  NEU  Ergebnisbericht, Einstieg für Prüfer, PR, Handout
  1C/1C-eigenanteil.md               NEU  wer hat was gemacht, mit Commits
  1C-praesentation-geruest.md     NEU  Gliederung Folien + Handout mit Kernzahlen und Diagrammverweisen
  adr/
    README.md                     NEU  Index, Vorlage, Statuswerte
    1C-001-….md …                 NEU  je Entscheidung eine Datei
  evidenz/1C/
    issue-cache-ram-entwurf.md    NEU  aus dem Scratchpad-Entwurf, mit U1-Zahlen
    issue-t2-3-entwurf.md, issue-t3-1-entwurf.md   bestehen, nur verlinken/ggf. aktualisieren
  README.md                       AKTUALISIEREN  Inhalt, Offene Punkte (veraltet)
  1C/1C-kontext-und-adapterpfad.md   AKTUALISIEREN  Abschnitte 11, 13, 14 (überholt durch Labor)
  1C/1C-diagrams.md                  ggf. Verweise auf Ergebnisbericht/ADRs
```

## 5. ADR-Format

Kurz (eine Bildschirmseite als Richtwert), Abschnitte:

- **Status:** `angenommen` (Beibehaltung bestätigt), `empfohlen` (Verbesserung/Konfiguration vorgeschlagen, nicht umgesetzt), `zurückgehalten` (Empfehlung bewusst nicht gegeben), `methodisch` (Vorgehen, kein Produktergebnis); dazu Datum.
- **Kontext:** Frage, Auftragsschritt, relevante Invariante.
- **Entscheidung:** ein bis drei Sätze, mit Kategorie aus der Nachweiskette (Beibehaltung, Konfiguration, Betrieb, Verbesserung).
- **Alternativen:** ernsthafte Gegenalternative(n) und warum verworfen.
- **Belege:** Hypothese/Kriterium aus dem Design, Messwert mit Quelle (Protokoll-Anker, Rohdatei, Commit).
- **Folgen:** Kosten, Risiko, Betriebsfolge; Gültigkeitsgrenze.
- **Ursachenkette** (nur wo zutreffend): Beobachtung → Hypothese → Versuch → Ergebnis.

## 6. Kandidatenliste der ADRs (Startpunkt, vom Builder gegen die Docs zu prüfen und zu ergänzen)

Methodik:

- Baseline aktueller `main` statt `v1.3.0` (Prüfer-Mail 2026-11-04; Abweichungen zu `248029dc`).
- Laborinstanz = eigener Rechner, lokaler Pfad `llm-http` (Prüfer-Mail).
- Teststrategie: modellfreie Tests gegen Test-Runtime, gekennzeichnete Negativproben, Echtpfad nur im Labor.
- Timeout 300 s im Laptop-Lauf (A4) und Kalibrierungsregel für den PC (Design 14.3).
- Zusatzlauf mit Produktionslimits auf zweitem Rechner (Design 14).
- Codestand für beide Läufe eingefroren auf `main@9f230abc`, nicht auf `96b2e46e` nachgezogen (Vergleichbarkeit).
- Ergebnisform: Empfehlung statt Produktivpatch.

Fachlich:

- Entscheidung 1: erneute Quellenprüfung (Nachprüfung) beibehalten, Gegenvariante V1 verworfen; im Labor bestätigt (s = 0,03 % / 0,04 %).
- M7: Vorhersagemodell verfehlt, Empfehlung zurückgehalten.
- Vorschau = Draht und Packing beibehalten (L1).
- Byte-Schätzung des Kontextbudgets: sicher, verschenkt ~⅔ des Fensters → Verbesserung prüfen (L2).
- Entkopplung Host-Aufruf/Modellantwort beibehalten (L3a).
- Release-Timeout 90 s zu kurz für CPU-Inferenz auf beiden Rechnern (A4-Befund, Konfiguration/Betrieb).
- Hashgrenze: zeitabhängiger Hash bei live Blitzlicht-Runde (T3.1, L5) → Issue-Kandidat.
- T2.3 (Inhalt aus `issue-t2-3-entwurf.md`).
- Prompt-Cache im RAM (`--cache-ram` 8192 MiB) übersteigt `mem_limit` → Konfigurationsempfehlung (L6, U1; Gegencheck Laptop 5+5 GiB).
- Weitere Entscheidungen aus Dossier, Teil 2 und Teil 3, soweit dort als „Entscheidung“ oder „Empfehlung“ geführt.

## 7. Ergebnisbericht: Inhalt (Gliederung)

1. Auftrag und Leitfrage (wörtlich verlinkt, nicht kopiert), Gültigkeitsgrenze.
2. Kurzantwort auf die Leitfrage (3–5 Sätze).
3. Auftragsschritte 1–4: je Schritt was gezeigt wurde, mit Belegverweisen.
4. Pflicht-Nachweiskette (`rahmen/00-rahmen-und-pruefung.md`): je Element Beleg: Release-/Commit-Bezug und Manifest, Baselinelauf, Störung/Variante, vergleichbare Messdaten, Befund mit Gültigkeitsgrenze, Entscheidung; dazu die „vor Beginn festzuhaltenden“ Punkte (Hypothese, Gegenalternative, Test, Messgrößen, Wiederholungen, Schwellen).
5. Befunde und Empfehlungen als Tabelle mit ADR-Verweis.
6. Ursachenketten (Kurzform, Details im ADR).
7. Kosten der Validierung und Kontextbereitstellung (Auftrag verlangt sie ausdrücklich).
8. Gültigkeitsgrenzen gesamt.
9. Offene Punkte und Fragen an den Prüfer (aktuell).
10. Landkarte aller 1C-Dateien.

## 8. Arbeitsteilung, Ziel-PR, Termin

**Termin:** Prüfung voraussichtlich um den 2026-11-24 (± 3 Tage, Angabe des Autors); Handout und Folien 48 h vorher. Umfang deshalb vollständig, aber in der Reihenfolge Ergebnisbericht → fachliche ADRs → Eigenanteil → Methodik-ADRs → Aufräumen → Extras, damit nach jedem Commit ein brauchbarer Stand existiert.

**Zwei Sitzungen** (Wunsch des Autors), Dateien disjunkt _(Zuteilung: Entscheidung der Laptop-Sitzung)_:

| Sitzung | Dateien                                                                                                                                                                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Laptop  | `1C/1C-ergebnis.md`, `adr/README.md`, alle ADRs außer den Labor-ADRs, `1C/1C-eigenanteil.md`, `evidenz/1C/issue-cache-ram-entwurf.md` (Entwurf liegt nur auf dem Laptop), alle gemeinsamen Bestandsdateien (`README.md`, `1C/1C-kontext-und-adapterpfad.md`, `1C/1C-diagrams.md`) |
| PC      | Labor-ADRs (Timeout 300 s und Kalibrierungsregel, Zusatzlauf mit Produktionslimits, eingefrorener Codestand, A4-Befund Release-Timeout, Prompt-Cache/L6/U1), `1C-praesentation-geruest.md`                                                                                        |

Die Laptop-Sitzung legt zuerst `adr/README.md` mit Vorlage und Nummernbereich an (Labor-ADRs bekommen einen festen Block), dann arbeiten beide parallel. Jede Sitzung prüft die Dateien der anderen gegen die Quellen und meldet Korrekturen per Nachricht; Push nach dieser Prüfung, vorher `git pull --ff-only`.

**Ziel-PR** _(Entscheidung der Laptop-Sitzung)_: Der Bericht dient der Beschreibung von Draft-PR #12 im Fork (Vorlage `.github/pull_request_template.md`, nicht zutreffende Abschnitte begründet als „entfällt“). Was in eine PR an kqc-real gehört, bleibt Prüferfrage 2 (`rahmen/00-rahmen-und-pruefung.md`); der Bericht nennt das als offenen Punkt und die Empfehlungen als Upstream-Kandidaten.

**Issue-Entwürfe** _(Entscheidung der Laptop-Sitzung)_: Entwürfe sind keine Protokolle; sie dürfen mit sichtbarer Kennzeichnung („Aktualisiert 2026-11-05: …“) um Laborbelege ergänzt werden. Die Laborwerte selbst haben ihr Zuhause in den Protokollen, die Entwürfe verlinken dorthin.

**KI-Offenlegung** (Festlegung des Autors): zusammengefasst je Artefakt: Sitzung und Modell, Beitrag der KI, Entscheidung und Prüfung durch den Autor, zentrale Aufträge des Autors sinngemäß in ein bis zwei Sätzen; keine wörtlichen Chat-Auszüge. Grundlage sind die vorhandenen Abschnitte „KI-Nutzung“ und die Commit-Historie.

**Eigenanteil:** Alle 102 Commits des Branches gegenüber `main` stammen von Jonas Weirauch; Niklas hat im Ordner nur `rahmen/final-prompt-for-git-diff.md` beigetragen (`4844d7a0`, `248029dc`, Merge `dacdff61` auf `main`), an den 1C-Inhalten keinen Commit. Gemeinsame Infrastruktur (Fork, CI, Aufteilung) wird als gemeinsam benannt.

## 9. Constraints

- Harte Regeln aus dem Projekt: Conventional Commits ohne KI-Attribution, kein `--no-verify`, PR #12 bleibt Draft, keine Secrets/persönlichen Daten, `rahmen/final-prompt-for-git-diff.md` unverändert.
- Docs-policy (loadout): eine Tatsache, ein Zuhause; Bericht und ADRs verlinken statt kopieren; Zahlen nur mit Quelle.
- Validierung je Commit: `npx prettier --check` und `git diff --check` auf geänderte Docs; alle relativen Links und Anker müssen auflösen (Prüfung per Skript).
- Aufräumen in Dossiers nur mit sichtbarer Kennzeichnung („Aktualisiert 2026-11-05: …“), alter Text bleibt nachvollziehbar (gestrichen oder verlinkt).

## 10. Dem Builder überlassen

Genaue Dateinamen und ADR-Nummerierung, Reihenfolge der ADRs, ob Ursachenketten im ADR oder als eigener Abschnitt im Bericht stehen, Tabellenlayout, Linkprüf-Skript (darf in den Scratchpad, nicht ins Repo).
