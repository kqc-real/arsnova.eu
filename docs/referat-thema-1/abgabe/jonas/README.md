# Jonas: Deck und Folien bauen, Zahlen fürs Handout erzeugen

Dieser Ordner erzeugt reproduzierbar, was Jonas für Thema 1 vorträgt: das gemeinsame Browser-Deck, die
PDF-Fassungen, die Sprechnotizen und ein Manifest mit Prüfsummen. Das Handout entsteht seit 2026-11-15 in
PaperLab (privates Repo, Typ `referat`, IU-Format nach Gestaltungs- und Zitierleitfaden); dieser Ordner
liefert ihm Zahlen und Abbildungen.

## Bauen

```sh
node docs/referat-thema-1/abgabe/jonas/bau.mjs [--niklas1 <pdf>] [--niklas2 <pdf>] \
  [--niklas1-stand <text>] [--niklas2-stand <text>] [--ausgabe <ordner>]
```

Ohne Argumente landen die Ausgaben in `ausgabe/` neben dieser Datei. Niklas' Teile (1A, 1B 3–4) kommen
standardmäßig nativ aus [`../niklas/`](../niklas/README.md); dazu entsteht `niklas-folien.pdf`. Reihenfolge im Deck (Design 2026-11-15, Abschnitt 3; ergänzt 2026-11-16): GT (Titel),
G0 (Fahrplan), GK (Systembild „arsnova.eu im Überblick“), Niklas 1A (N1–N10 ohne N8; _aktualisiert 2026-11-17_), Jonas J1–J15 (mit J5b, J8b, J10a,
J10b, J11, J13b), Niklas 1B 3–4 (M1–M4), G9 (gemeinsames Fazit), GN (Nachweisumfang, spricht Jonas; _ergänzt 2026-11-18_, ersetzt R17) und GD (Dank, Fragen), ein gemeinsames Literaturverzeichnis
(J16, J16b), Reserve (R1, R5–R7, R9–R12, R15–R16 mit Abb. 1 und 2 aus `1C/1C-diagrams.md`; RN1, RN2, RN4). Die Rahmenfolien außer GN spricht Niklas. `--niklas1`/`--niklas2` ersetzen einen
Teil durch die Seiten eines PDFs (Rückfallweg); die `--niklasN-stand`-Texte landen dann im Manifest.

Tests: `node --test docs/referat-thema-1/abgabe/jonas/*.test.mjs`.

## Handout (PaperLab)

```sh
node docs/referat-thema-1/abgabe/jonas/handout-latex.mjs <PaperLab-Arbeitsordner>/generated
```

schreibt `zahlen.tex` (ein `\newcommand` je Wert) und die Abbildungen `abb-weg.pdf`, `abb-zeit.pdf` (Arial,
TrueType über `rsvg-convert`). Bauen, prüfen und die Abgabefassung mit Name und Matrikelnummer erzeugen
PaperLab (`./paperlab check|final`); Name und Matrikelnummer stehen nur dort, nie in diesem Repo.

## Belege und Literatur

Jede Folie trägt in der Fußzeile eine Quellenzeile mit Kurzbelegen nach dem IU-Zitierleitfaden, in einer
Zeile; Rechner und Commit stehen in `quelle` (Sprechnotizen) und im Manifest. J16 und J16b zeigen das
gemeinsame Literaturverzeichnis des ganzen Decks als Anhang nach GD, in beiden Einzel-PDFs. Die Einträge stehen in
`literatur.mjs`; sie gleichen denen in den Handouts (`literatur.test.mjs` prüft das gegen beide `main.bib`).
Mehrere Kurzbelege einer Fußzeile sortiert `quellenzeile()` alphabetisch (ZL S. 14); Stellen heißen „Kap.“ oder
„Abschnitt Titel“.

## Clip für J13 (`medien/`)

`medien/clip.webm` ist die Laboraufnahme aus [`evidenz/1B/2026-11-15-clip.md`](../../evidenz/1B/2026-11-15-clip.md)
(Lauf 4, auf den Dialog zugeschnitten, 848 × 800). Die letzte knappe Sekunde der Aufnahme (ab Bild 448) zeigte das
Schließen des Browserfensters: Der Dialog schrumpfte in einen grauen Rand, und das Endbild, auf das der Vortragende
per Taste springt, war abgeschnitten. Neu geschnitten am 2026-11-16 aus der bisherigen Datei, nur am Ende gekürzt
(erste 448 Bilder bei 25 fps, 17,92 s), sonst unverändert:

```sh
ffmpeg -i clip-vorher.webm -frames:v 448 -an -c:v libvpx-vp9 -b:v 0 -crf 30 -row-mt 1 \
  -deadline good -cpu-used 2 clip.webm
```

Das letzte Bild entspricht `clip-standbild.png` (Druckfassung). Der Clip startet nur auf Tastendruck; ein Druck während
er läuft springt auf das letzte Bild (`deck.js`, `clipSchritt`).

## Voraussetzungen

- Node 24 und die Abhängigkeiten des Repos (Playwright mit Chromium, `pdf-parse`, `prettier`).
- `pdftoppm` (Poppler) rastert Niklas' PDF-Seiten für das Deck. Fehlt es, erscheint dort ein Platzhalter.
- Für das Handout: `rsvg-convert` und `pdffonts`.

## Sprechnotizen, Sprungplan, roter Faden

- Jede Folie hat zwei Fassungen: `stichpunkte` (3–6, zum freien Vortrag, Zahlen mit Einheit) und `notiz`
  (Fließtext zum Üben). Beide stehen nicht im Repo, sondern in `privat/notizen.mjs` (eigenes Repo); die
  Folienmodule rufen sie über `privat('ID.feld', { werte })` aus `notizen.mjs` ab. Ohne diese Datei baut
  `bau.mjs` nur die öffentlichen Ausgaben, und die Tests zu Notizen werden übersprungen. `[Weiter]` markiert jeden Tastendruck einer Aufbaustufe (GK, J7, J9, J12, J13, J15, G9; bei Niklas N6, N7, N9, N10, M1–M4). Auf J13 kommen erst die Stufen, dann der Clip.
- Der Sprungplan steht oben in den Sprechnotizen jeder Person, gezählt nur über die eigene Redezeit ab der
  ersten eigenen Folie: Jonas muss J13 und J15 bis 15:00 min erreichen, Niklas N10, 1B 3–4, G9 und GD (seine
  Uhr steht, während Jonas spricht; Notizen und Sprechkarten markieren die Übergabe nach N10). Überschreitet
  die Langfassung 15:00 min, steht dort ein Budgethinweis (Entscheidung der Autoren 2026-11-16: 15 min Redezeit
  je Person, Fragen kommen hinzu; vorher 10:30 min).
- Wegkarte oben links (_Ergänzt 2026-11-16: eine Markermaschine für beide Teile_): Jede Hauptfolie trägt eine
  Marke (Folienfeld `marke`, Jonas' Stationsfolien sonst ihre `station`; Liste mit Begründung in `MARKEN`,
  `wegkarte.mjs`). Zwei Wege in derselben Bildsprache (gleiche Maße, blaue Linie, Stationen in der Farbe ihres
  Auftrags): Jonas' Auftragsweg (Klick → Kontext → Netz → Inferenz → Nachprüfung → Gate; auch für 1B 3–4) und
  der Weg 1A (App-Host → Live-Pfad → spaCy → Ersatz → Wortwolke). Je Weg ein beständiger Läufer auf der Bühne
  (`deck.js`, `setzeMarker`): Der Punkt fährt per `offset-path` zur nächsten Station, Säume (hervorgehobene
  Strecken) und Zeichen (Ausschlag auf dem Live-Pfad, Störungszeichen) blenden ein; beim Wechsel des Wegs
  (N10 → J1) blendet die Karte über. Reduzierte Bewegung: alles sofort. Im Druck steht in jeder Folie die feste
  Marke im Endbild. Jede Station wird je Teil der Reihe nach besucht (Test in `../niklas/folien-niklas.test.mjs`).
  Säume: N3 Analyse, N4/N6/N6b Live-Pfad und Analyse gestrichelt, N5 Live-Pfad, J8/J8b Netz, J9 ganzer Auftrag,
  M1/M2 zweiter Host; Zeichen: N7 Ausschlag, J10b Stopp, J11 zu spät, M1 je Stufe, M2 alle vier.
- G0 zeigt Leitfrage und Fahrplan der vier Teile in Vortragsreihenfolge (`TEILE` in `folien.mjs`: Niklas 1A,
  Jonas 1C und 1B 1–2, Niklas 1B 3–4, Fazit); dieselben Teile stehen klein oben rechts auf jeder Hauptfolie
  (Teilleiste, `deck.mjs`), der aktuelle Teil unterstrichen. G9 nimmt die Leitfrage von G0 wörtlich wieder
  auf. Übergänge: N10 „Was, wenn wir die schwere Arbeit auslagern?“, J15 „Und wenn der zweite Host langsam
  ist oder ausfällt?“.

## Designregeln (Stand 2026-11-16)

Prüfbar in `layout-pruefung.mjs` (Druckmodus, alle Folien im Endbild) und `deck.test.mjs`:

- **Typografie (T):** Folientext mindestens 28 px (`--s-text`), Sekundärtext 24 px (`--s-sek`, Klasse
  `sekundaer`), Etiketten und Achsen 22 px (`--s-min`), Vermerke 20 px gedämpft (`--s-notiz`: `beleg`,
  `vermerk`, Bildunterschrift, Fußzeile) in genau einer Zeile. Was nicht in eine Zeile passt, gehört in die
  Sprechnotiz (`quelle`) oder in die Reserve.
- **Vertikaler Rhythmus (V):** Der Inhaltsblock steht im optischen Zentrum der Fläche (freier Rest oben 2 :
  unten 3, `.flaeche-inhalt::before/::after`), ein `beleg` sitzt unten an der Fußzeile. Füllt eine Grafik die
  Fläche (`grafik-box`), nimmt sie den Platz. Der Wächter meldet Inhalt, der oben klebt und unten mehr als
  35 % frei lässt.
- **Raster und Abstände:** Ränder 90 px, Titel einzeilig, Abstände eng in der Gruppe (`--abstand-eng`, 12 px)
  und weit zwischen Gruppen (`--abstand-gruppe`, 36 px); Merksätze (`merksatz`) und Übergaben (`uebergabe`)
  als eigene Bausteine, kein `margin:auto` im Fluss.
- **Kopfgrammatik (K, _Ergänzt 2026-11-16_):** Jede Hauptfolie beider Teile (1A, 1C und 1B 1–2, 1B 3–4) hat
  denselben Kopf. Zeile 1: Wegkarte oben links mit dem Ort als Beschriftung (nur der Name, etwa „spaCy“,
  „App-Host“, „Live-Pfad“, „Zweiter Host“, „Nachprüfung“) und dem Etikett; Wirkung und Störung zeigt nur ein
  Zeichen auf der Karte (Ausschlag, Störungszeichen über der Senke), nie ein Zusatz mit „·“. Zeile 2: Titel.
  Zeile 3: Fragezeile (`frage()` in `folien.mjs`), zuerst das Etikett des Auftrags (bei beiden Aufträgen 1C
  und 1B), dann die Frage, danach höchstens ein gedämpfter Status (`frage(…, { status })`, etwa
  „nachträglich ausgewertet“). `deck.mjs` setzt die Fragezeile in den Kopf, 18 px unter den Titel; zentriert
  wird nur der Inhalt darunter. Die Autorzeile (`autorZeile()`) steht nur auf N1 und J1, direkt unter der
  Fragezeile. Rahmenfolien (GT, G0, GK, G9, GN, GD), Anhang (J16, J16b) und Reserve haben keine Wegkarte und keine
  Pflicht zur Fragezeile; hat eine Reservefolie eine, steht sie ebenso im Kopf. Prüfung: `kopfBefunde` in
  `layout-pruefung.mjs` (Abstand Titel → Fragezeile auf allen Hauptfolien ±2 px, Etikett zuerst, Status nur
  am Ende der Fragezeile, Ort ohne Zusatz), Tests in `deck.test.mjs` und `../niklas/folien-niklas.test.mjs`.
- **Farbe:** Blau = Titel und 1A, Petrol = 1C, Bernstein = 1B, Rot nur für Ablehnung; Farbe nie allein (immer
  mit Etikett). Kein Text läuft aus seinem Kasten.

## Datenherkunft

Jede Zahl stammt aus den eingecheckten Ergebnisdateien in `evidenz/1B/messung/` und
`evidenz/1C/messung/` oder aus den dokumentierten Festwerten in `folien.mjs` (mit Beleg). Die genauen
Eingaben mit SHA-256 stehen in `ausgabe/manifest.json`; dort stehen auch die Ausgaben, die Seitenzahlen und
die Herkunft von Niklas' Teilen.

## Ausgaben (`ausgabe/`)

| Datei                   | Inhalt                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `jonas-deck.html`       | Gemeinsames Deck zum Vortragen, selbstständig (Schriften, Bilder, Clip)                                         |
| `gemeinsames-deck.pdf`  | Druck des gemeinsamen Decks, eine Seite je Folie                                                                |
| `jonas-folien.pdf`      | Titel GT, Jonas' Folien (J1–J15), GN, Literatur J16, J16b und Reserve                                           |
| `../../privat/ausgabe/` | Nicht im Repo (von Git ignoriert): Vortragsdeck mit Referentenansicht, Sprechnotizen, Sprechkarten, Sprechhefte |
| `manifest.json`         | SHA-256 aller Ein- und Ausgaben, Seitenzahlen                                                                   |

**Vortrag:** Reserve im Deck mit Taste `r`, Ziffer 1–9 oder Pfeile und Enter, `Esc` zurück. Persönliche
Vortragsunterlagen entstehen beim Bau im von Git ignorierten Ordner `privat/ausgabe/`.

## Abgabe mit Matrikelnummern (nur lokal)

Die Prüfung verlangt Name und Matrikelnummer aller Gruppenmitglieder auf jeder Einreichung, das Repo darf keine Matrikelnummer enthalten. Die Titelfolie GT steht deshalb in jedem PDF und trägt unter jedem Namen einen Platz (`data-matrikel="<Name>"`), der im Repo nur „Matrikelnummer in der Abgabefassung“ zeigt. Ein eigener Schritt füllt ihn erst nach dem Bauen:

1. `abgabe-lokal.beispiel.json` nach `abgabe-lokal.json` kopieren und ausfüllen (von Git ignoriert, siehe `.gitignore` hier); die Namen müssen denen auf der Titelfolie gleichen.
2. `node docs/referat-thema-1/abgabe/jonas/bau.mjs` wie oben.
3. `node docs/referat-thema-1/abgabe/jonas/abgabe-lokal.mjs` schreibt nach `abgabe-lokal/` (ebenfalls ignoriert): `jonas-deck.html` mit den Nummern (dieses Deck im Vortrag teilen) und daraus gedruckt `gemeinsames-deck.pdf`, `jonas-folien.pdf`, `niklas-folien.pdf`.

Das Skript bricht ab, wenn Eingabe oder Ausgabe nicht ignoriert sind, ein Name keinen Platz hat oder ein Platz leer bliebe, eine PDF noch Entwurfsmarker oder Platzhalter („Entwurf“, „[Niklas]“, „[Satz …]“, „[Titel]“) trägt oder auf Seite 1 eine Nummer fehlt.
