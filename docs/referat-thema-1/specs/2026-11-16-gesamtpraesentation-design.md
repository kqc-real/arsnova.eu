# Gesamtpräsentation Thema 1: Niklas' Teil auf Jonas-Niveau (Design, 2026-11-16)

## Anlass

Niklas' 1A-Folien und das 1A-Handout hat sein Codex ohne Auftrag erzeugt; Niklas hat sie nicht entworfen. Er ist einverstanden, Jonas' Entwurf zu übernehmen, wenn er ihm gefällt (Sprachnachricht an Jonas, 2026-11-16). Jonas' Teil wurde am 2026-11-16 auditiert und überarbeitet (Commits `dccbdfd1` bis heute).

## Vorgaben (Prüfungsdokument, Abschnitt 4.1.2 und 1)

- Präsentation mit **individuellem Handout**: jede Person ein eigenes Handout (höchstens 5 DIN-A4-Seiten, 350–1800 Wörter), ohne das andere lesbar, plus eindeutig zugeordnete Folien als PDF.
- 15 Minuten mündliche Prüfung je Person, Vortrag und Befragung zusammen; Kursvorschlag 9 + 6. Gemeinsame Einleitung oder Synthese nur im eigenen Zeitbudget.
- Name und Matrikelnummer aller Mitglieder auf jeder Einreichung, nie im Repo.
- 1A: eigene Leitfrage, Schritte 1–4, Ergebnis, Gültigkeitsgrenze, Diskussionskern laut Prüfungsdokument, Gruppenauftrag 1A.

## Entscheidungen (Jonas, 2026-11-16)

1. 1A jetzt vollständig; 1B Schritte 3–4 als Gerüst, das sich aus Niklas' Evidenz füllt, sobald sie gepusht ist.
2. Niklas' Handout neu in PaperLab im IU-Format, gleiche Prüfungen wie Jonas' Handout; Zahlen generiert aus seinen Messdaten.
3. Redezeit je Person etwa 10:30 wie bei Jonas.
4. Gemeinsames Designsystem: Niklas' Teil im Stil von Jonas' Deck; Jonas' Deck wird nur gezielt nachgezogen (Animationen, roter Faden, Übergänge, Sprechnotizen).
5. Sprechnotizen für beide in zwei Fassungen: Fließtext (die Vision) und Stichpunkte (zum freien Vortrag).
6. Animationen nur auf Tastendruck und nur, wo sie den Blick führen; reduzierte Bewegung und Druck ohne Übergang.

## Nicht-Ziele

- Keine neuen Laborläufe. Belege nur aus vorhandenen Daten.
- Kein Produktionscode. Keine Matrikelnummer im Repo.
- Kein Merge nach `main` (Jonas und Niklas machen ihn gemeinsam vor dem 22.11.).

## Offen für den Bauenden

Folienfolge, Grafiken und Animationen für 1A; Gliederung von Niklas' Handout innerhalb der IU-Vorgaben; Form der Sprechnotizen-Ausgabe.

## Umsetzung Niklas' Teil (_Ergänzt 2026-11-16_)

- Reihenfolge im Deck: G0 (Jonas eröffnet), J1–J15 (Übergabe auf J15: „Und was verträgt der App-Host selbst neben der Live-Last?“), N1–N10 (1A), M1–M4 (1B 3–4), G9 (gemeinsames Fazit, spricht Niklas), Anhang (J16, NL), Reserve (Jonas R1–R14, Niklas RN1–RN2).
- 1A: zehn Behauptungsfolien, 9:30 min, Heldenzahlenkette 40.000 → 80 → 11 → 4 → 3 in etwa 10 s → keine Freigabe; Stufen nur auf N6 (drei) und N7 (zwei, nachträglich ausgewertet und so markiert). Jede Zahl aus `abgabe/niklas/daten-1a.mjs`, Tests rechnen die Auswertung aus den Rohdaten nach.
- 1B 3–4: Gerüst M1–M4 (je 45 s), füllt sich aus Niklas' Ergebnis-JSONs; bis dahin Platzhalter, die `abgabe-lokal.mjs` meldet.
- Zeitkonflikt, offen für Niklas: 1A 9:30 + 1B 3–4 3:00 + G9 0:40 = 13:10 min gegen etwa 10:30. Die Kurzfassung (Marke in `sprechnotizen-niklas.md`: N1, N3, N5, N6, N8, N9, N10 und M1–M4) dauert 9:45, mit G9 10:25.
- Sprechnotizen beider Personen: Stichpunkte vor dem Fließtext, sobald eine Folie `stichpunkte` hat (`bau.mjs/baueSprechnotizen`).

## Reihenfolge nach Design 3, Rahmenfolien, Designregeln (_Ergänzt 2026-11-16_)

Anlass: Das Deck lief noch in der alten Folge (Jonas eröffnet); abgestimmt ist Design 2026-11-15, Abschnitt 3.
Dazu wünschte der Autor Titel-, Fahrplan- und Dankfolie und einen Designdurchgang über alle Folien.

- **Reihenfolge:** GT (Titel: beide Namen, Kurs DSCC0127, IU Internationale Hochschule, Prüfer, 24.11.2026,
  Platz für die Matrikelnummern), G0 (Leitfrage und Fahrplan), N1–N10 (1A), J1–J15, M1–M2 (1B 3–4), G9, GD
  (Dank, Fragen, Link und offline erzeugter QR-Code zum Belegrepository), Anhang J16 und NL, Reserve. Alle
  Rahmenfolien spricht Niklas. Übergänge: N10 „Was, wenn wir die schwere Arbeit auslagern?“ → J1 „Danke,
  Niklas. Die schwere Arbeit, die Inferenz, ist ausgelagert auf einen zweiten Host.“; J15 „Und wenn der
  zweite Host langsam ist oder ausfällt?“ → M1 „Danke, Jonas.“
- **Zeit:** Budget je Person höchstens etwa 10:30 min samt Rahmenanteil (Absprache 2026-11-16, ersetzt
  9:00 min). Jonas J1–J16 8:30 min, Niklas GT, G0, 1A, 1B 3–4, G9, GD 9:55 min. Sprungpläne zählen nur die
  eigene Redezeit.
- **Matrikelnummern:** Die Titelfolie steht in jedem Einzel-PDF; `abgabe-lokal.mjs` füllt den Platz nur in
  ignorierten Kopien (Deck und PDFs). Der frühere Eckstempel entfällt.
- **Designregeln:** Typografie (Text ≥ 28 px, Sekundärtext 24 px, Vermerke 20 px gedämpft in einer Zeile),
  vertikaler Rhythmus (Inhalt im optischen Zentrum, Beleg unten), Abstandsstufen, Farbbedeutung. Beschrieben
  im [README](../abgabe/bau/README.md#designregeln-stand-2026-11-16), geprüft vom Layoutwächter.

## Gemeinsames Deck aus einem Guss (_Ergänzt 2026-11-16_)

- Stichpunkte für alle Folien von Jonas (G0, J1–J15, R1–R14); erster Satz (G0) und letzter Satz (J15) wörtlich. Sprechkarten je Person als PDF (nur Stichpunkte, Startzeit, Kurzfassung-Marke).
- Roter Faden: Fahrplan der vier Teile auf G0 (1C und 1B 1–2 · 1A · 1B 3–4 · Fazit), dieselben Teile als Teilleiste oben rechts auf jeder Hauptfolie; G9 nimmt die Leitfrage von G0 wieder auf. G0 endet mit „Ich beginne mit einem einzigen Klick“, J15 übergibt an Niklas mit Etikett 1A.
- Aufbaustufen bei Jonas nur auf J9 (Vorhersage, dann Beleg: Schwellen → Netz, Transport, Adapter → Inferenz) und J15 (Entscheidungen → Diskussionsfrage → Übergabe).
- Farben: Etiketten 1C Petrol, 1B Bernstein, 1A Blau auch auf G0; auf N10 ist „Begründung“ neutral statt Petrol (Petrol steht für 1C).
- Zeit: Jonas 10:05 min mit G0 (G0 jetzt 35 s). Niklas 13:10 min Langfassung bleibt offen; seine Kurzfassung mit G9 dauert 10:25 min und gilt laut Sprechnotizen als Vortragsplan, bis er kürzt. Sprungplan beider Personen ab der ersten eigenen Folie.

## 15 Minuten Redezeit je Person, Kontextfolie, Visualisierungen (_Ergänzt 2026-11-16_)

_Hinweis 2026-11-17:_ Für 1B Schritte 3–4 abgelöst durch den Abschnitt [„1B Schritte 3–4 vollständig
einarbeiten“](#1b-schritte-34-vollständig-einarbeiten-ergänzt-2026-11-17): M1–M4, N6b und N8 wieder Reserve, Niklas
14:25 min.

Anlass: Die Autoren planen mit 15 Minuten **Redezeit** je Person; die Fragen kommen hinzu. Das ersetzt die
Grenze von etwa 10:30 min (Abschnitt oben). Mehr Tiefe statt Füllstoff: starke Reservefolien kommen dorthin
zurück, wo sie das Argument tragen.

- **Reihenfolge:** GT, G0, **GK** (neu, „Was ist arsnova?“, Systembild in drei Stufen, spricht Niklas), N1–N10
  mit **N3** (Varianten, bis dahin RN3), **N6b** (Regelempfindlichkeit, RN1) und **N8** (spaCy-Budget, RN4), J1–J15
  mit **J5b** (Autorisierung, R8), **J8b** (Kontrolle C0, R2), **J10a** (Kaltläufe, R4), **J10b** (Ausfall B0, R3),
  **J11** (Timeout und Speicher, R13) und **J13b** (Einordnung Cloud Computing, R14), M1–M2, G9, GD, Anhang,
  Reserve (Jonas R1, R5–R7, R9–R12, neu R15 und R16 mit Abb. 1 und 2 aus `1C/1C-diagrams.md`; Niklas RN2).
- **Zeit:** Jonas 14:35 min (J1–J16), Niklas 14:10 min (GT, G0, GK, 1A, 1B 3–4, G9, GD). Sprungplan, Budget und
  Sprechkarten zählen gegen 15:00 min (`bau.mjs`, `ABBRUCH_S`); Tests verlangen je Person 14:00–15:00 min.
- **Ortsmarke:** eine feste Miniatur des Systembilds von GK oben links auf jeder Folie von 1A und 1B 3–4 und auf
  J1 (gleiche Geometrie, gleiche Quelle); nur der Ort der Folie trägt die Farbe seines Teils, die Beschriftung
  nennt den Ort. Ein erster Entwurf mit wechselnden Formen (App-Host-Karte) war laut Autor verwirrend und ist
  ersetzt. Jonas' wandernder Punkt bleibt; beide Marken teilen Platz und Beschriftungsstil.
  _Ergänzt 2026-11-16:_ Die Miniatur war schwer lesbar und ist ersetzt durch Wegkarten in Jonas' Bildsprache
  (`abgabe/jonas/wegkarte.mjs`): 1B 3–4 zeigt Jonas' Auftragsweg mit der Strecke über den zweiten Host in Bernstein
  und einem Störungszeichen je Stufe, 1A einen eigenen Weg (Live-Pfad oben, Analysezweig mit Ersatz unten) mit der
  Station der Folie in Blau, J1 Jonas' ganzen Weg ohne Hervorhebung. GK bleibt unverändert.
- **Aufbaustufen neu:** GK (drei), J7 (Budget, dann echte Tokens), J12 (Zeitleiste: Stimme, dann Verwurf),
  J13 (Raster der 38 Antworten rot, dann Ablation; der Clip erst danach), M1 (je Störung eine Stufe). Analogien aus
  den Daten: M1 „Stopp 1 s → DROP rund 47 min“, Notizen N7 und N8. Urteile zu allen Ideen:
  Arbeitsnotiz `visualisierung.md` des Teams (nicht im Repo).
- **Nachweisumfang:** [`nachweisumfang.md`](../nachweisumfang.md), auf GD als ein ruhiger Satz.
- **Codeprüfung:** J13 korrigiert (`12f1d8e4` änderte Instruktion und Gate, `a998ada0` nur das Gate); 1A nennt
  `a19ca70f` „nach v1.4.0“ statt v1.4.0.

## 1B Schritte 3–4 vollständig einarbeiten (_Ergänzt 2026-11-17_)

Anlass: Niklas hat 1B Schritte 3–4 abgeschlossen und nach `main` gemergt (PR #26, `dfe035e1`). Neu gegenüber M1–M2
(nur Summary-Reihen): acht gewertete Label-Reihen, gerichtete Breaker-/Queue-Folgen, Transportauswertung, S1
(Same-Host) und die Entscheidung [ADR 1B-020](../adr/1B-020-zweite-rolle-betrieblich-begruenden.md). Ziel: dieselbe
Bildsprache, derselbe rote Faden, jede Zahl generiert aus den Ergebnis-JSONs.

### Entscheidungen (Jonas, 2026-11-17)

1. **Vier Folien M1–M4, zusammen 4:00 min** (bisher M1–M2, 2:15 min). N6b und N8 gehen zurück in die Reserve
   (als RN1 und RN4, wie vor dem 16.11.). Niklas danach etwa 14:25 min, unter 15:00.
2. **Handout:** Abschnitt 06 neu (Tabelle Summary und Label je Störung, Breaker/Queue, Live, S1, Entscheidung),
   dafür 1A-Grundlagen und -Methode um etwa 120–150 Wörter straffen; höchstens 5 Seiten ohne Literatur,
   höchstens 1800 Wörter, gleiche PaperLab-Prüfungen.
3. **Rohdaten:** alle `evidenz/1B/messung/*.json` über 1 MB byte-identisch als `.json.gz` (gzip -9 -n), wie 1C
   (`83d17248`); Leser lesen `.gz` transparent, Links in Protokollen und README zeigen auf `.json.gz`.
4. **Integration:** `origin/main` (mit PR #26) in `feature-praesentation-jonas` mergen; Konflikte in
   `README.md` und `evidenz/1B/treiber.mjs` so auflösen, dass J13-Recorder und Label-Pfad beide erhalten bleiben;
   gzip danach als eigener Commit im Zweig. Kein Alleingang auf `main`.
5. **Schwachstellen offen vorbereiten, Niklas' Protokolle nicht umschreiben:** Folien und Handout formulieren
   korrekt (Funktion `runWithQueueTimeout`, nicht `processWithTimeout`); Notizen und Fragenkatalog haben je eine ehrliche Antwort, auch zu den Plan-Nachträgen,
   die erst nach einigen Läufen committet wurden (`aa0e90c7`). Hinweisliste für Niklas.

### Folien (Reihenfolge … N10, J1–J15, M1–M4, G9, GD)

- **M1 Ersatz je Störung (75 s, drei Stufen):** eine Log-Achse (10 ms bis 1000 s), Zeilen je Störung, je Zeile
  Summary (Kreis, Job-Zeit) und Label (Raute, Client-Zeit; die API liefert keine Job-Zeit), zwei Fristlinien
  (Label 30 s, Summary 300 s). Zeilen: Normal; Stopp F1; Slot belegt (nur Summary); Netz +50/+500 ms (L1/L2, nur
  Label); DROP F2; zu spät L3. Stufen wie bisher: Stopp/Slot, dann DROP (und Netz langsam), dann zu spät.
  Kernsatz: Ein gestoppter Host kostet Millisekunden, ein stummer Minuten (Summary-Faktor DROP/Stopp ≈ 2800). DROP
  endet bei Summary vor der Frist (Verbindungsaufbau gibt nach etwa 2¼ min auf), bei Label an der 30-s-Frist;
  Notiz und Fragenkatalog erklären das.
- **M2 Breaker gegen Queue (50 s, zwei Stufen):** zwei Bahnen mit je vier Aufträgen auf linearer Zeitachse.
  Oben F1: drei RST-Fehler, der vierte endet nach 44 ms mit `circuit_open` ohne Netzversuch. Unten L3: vier
  Timeouts zu je 90 s, auch der vierte erreicht die Runtime. Codebeleg: `openWeightLlmClient.ts:188` (`aborted`
  vor `timeout`), `:476–478` (zählende Gründe), `qaSummaryQueue.ts` `runWithQueueTimeout`. Kernsatz: Der
  Breaker dämpft Ausfälle, nicht Hänger.
- **M3 Live-Rückwirkung (60 s, zwei Stufen):** Raster Reihe × Aktion (Beitritt, Quiz, Q&A, Tempo), Wert p95 gegen
  die eigene B0/F1-Referenz desselben Consumers, Bernstein über 110 %. Stufe 1 Summary (Slot belegt, DROP, zu
  spät), Stufe 2 Label (Normal, L1, L2, L3, DROP). Summary-Normal fehlt im Raster: Niklas' Protokoll rechnet nur
  F1 gegen Normal, und Folien zeigen keine eigenen Herleitungen (AGENTS.md des Ordners); die Nachrechnung steht
  als vorbereitete Antwort im Fragenkatalog. Zeile „Fehler 0 / N“ über alle Reihen. Eine Zeile
  Transport: Label 8,7 ms von 3,5 s (0,25 %, Schwelle 5 %), bestätigt J9/J10 für einen zweiten Auftragstyp.
  Kernsatz: fehlerfrei, aber nicht latenzneutral; Ursache auf einem Rechner nicht zuordenbar.
- **M4 Schritt 4: S1 und Entscheidung (55 s, zwei Stufen):** Stufe 1 S1 (App-Stack auf der LLM-VM) gegen
  Zwei-Host-Normal: p95 je Aktion für Label und Summary, Fehler 0; Label reißt Beitritt und Quiz, Summary hält
  alle. Stufe 2 Entscheidung nach ADR 1B-020 als Merksatz Gewinn/Kosten/Risiko: zweite Rolle betrieblich
  begründen (Trennung, Wartung, Zuständigkeit), kein Leistungsvorteil belegt, S1 keine Freigabe; Budgets je
  Host kalibrieren, Fallback-Gründe überwachen, nicht allein auf den Breaker verlassen. Kosten qualitativ.
- **Wegkarte:** M1 `1b-stoerung` (Stufen um Zeichen „Netz langsam“ für L1/L2 ergänzt), M2 neue Marke mit Stopp und
  zu spät, M3 `1b-alle`, M4 neue Marke „Ein Host (S1)“. Teilleiste, Etikett 1B Bernstein, Fuß mit Kurzbeleg wie
  bisher.
- **G9:** Niklas' 1B-Satz neu: Ersatz kommt immer, kein Live-Fehler, aber Latenz nicht neutral und Hänger nicht
  gedämpft; zweiter Host betrieblich begründet. „Betriebsaufwand nicht gemessen“ wird „qualitativ bewertet“.
- **Notizen, Sprechkarten, Fragenkatalog:** Stichpunkte und Fließtext für M1–M4; Übergang J15 → M1 („Danke,
  Jonas.“) bleibt. Fragenkatalog Niklas um 1B 3–4 erweitert (RST/DROP, Breaker, Label vs. Summary, S1, ADR
  1B-020, die Schwachstellen aus Entscheidung 5).

### Daten

`daten-1b34.mjs` liest zusätzlich Label-Teilreihen (`-01` … `-03` zusammengefasst), Breaker-Folgen, S1 und
`2026-11-16-transportauswertung.json`; Kennzahlen wie in Niklas' Protokollen (Gegenprobe: Tests prüfen die
p95-Werte der Protokolle). Quellen nennen Commit, n, Rechner und die Autorenprüfung vom 16.11.

### Ermessensentscheidungen des Bauenden

- Summary mit Job-Zeit (so sind die Kriterien formuliert), Label mit Client-Zeit; beides auf der Folie benannt.
- KI-Offenlegung im Handout: Modell aus Niklas' PR übernommen (GPT-6.1 Sol in Codex); die Marke für seine eigene
  Prüfung in eigenen Worten bleibt.
- Feinheiten der Grafiken, Animationen und Formulierungen innerhalb der Designregeln.
