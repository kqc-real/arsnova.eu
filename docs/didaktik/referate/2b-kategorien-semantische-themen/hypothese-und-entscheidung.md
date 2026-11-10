# Referat 2B – Hypothese, Gegenalternative und Entscheidung

**Auftrag 2B:** Nichtgenerative Kategorien und semantische Themen
**Leitfrage:** Welchen nachweisbaren Qualitätsgewinn liefern Klassifikation und
Encoder-Themen in Release 1.3 gegenüber dessen lexikalischer beziehungsweise
regelbasierter Baseline?

**Baseline:** unveränderter Releasecode von 1.3. Erste Messungen am
21./23.10.2026 auf `a657798e` (Referenzset v2 und v2.1), am 04.11.2026 auf
`84a5614e`. Maßgebliche Läufe vom 08.11.2026 auf dem letzten 1.3-Stand vor Release
1.4, Upstream `efd71b44` (Version 1.3.0; Fork-Merge `74091b0a` ergänzt nur
`referat-2b/`), mit dem eingefrorenen Referenzset **v2.2**: 723 Fragen aus
Statistik (500), Botanik (37), Geschichte (36) und Polizeischule (150); de, en,
fr, es, gemischt; SHA-256 `717bdb17…` (vollständig in jedem Messbericht). Alle
Vorhersagen der Klassifikation je Frage sind zwischen allen Ständen identisch.

**Blickrichtung:** Alles wird vom Moderationskompass her gelesen – was sieht die
Lehrperson dort zusätzlich, wenn 8.9b und 1.14c an sind, und wie verlässlich ist
es? Die isolierten Messungen (Abschnitt 4) erklären, warum der Kompass so
aussieht.

---

## Frage und Antwort (TL;DR)

**Leitfrage 2B** (`docs/didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md`, §4.4):
»Welchen nachweisbaren Qualitätsgewinn liefern Klassifikation und
Encoder-Themen in Release 1.3 gegenüber dessen lexikalischer beziehungsweise
regelbasierter Baseline?«

**Schwerpunkt:** Clustering – Encoder-Themen (1.14c) gegen die lexikalische
Baseline ohne und mit spaCy-Glättung (1.14b). Klassifikation (8.9b) als
Schnittstelle, mit derselben Messkette erfasst.

**Antwort in vier Sätzen:**

1. **Encoder-Themen (1.14c)** gruppieren in Deutsch und Englisch stabil besser
   (ARI 0,29 → 0,44 bzw. 0,53) und liefern schlüssigere Themen-Quellen im Kompass;
   bei Ausfall oder Last greift der lexikalische Fallback – deshalb für de/en
   aktivierbar (E2).
2. **spaCy (1.14b)** glättet Wortformen, bündelt aber keine Anliegen; im Kompass
   bringt es gegenüber der ungeglätteten Baseline keinen Gewinn (E4).
3. **Kategorien (8.9b)** sind messbar besser als Keyword-Regeln (61,3 % statt
   35,2 % nutzbar korrekt), aber im Kompass ist jede vierte bis jede zweite Frage
   hinter einer Kategorie-Quelle falsch eingeordnet, die Statuszeile meldet
   trotzdem »geordnet«, und die Kategorien verdrängen die Themen – deshalb
   bleiben sie aus (E1).
4. Die **Entscheidungstiefe** steigt nicht: »Als Nächstes« bleibt gleich; unter
   Last zeigt der Kompass »nicht automatisch geordnet« statt falscher Sicherheit, und das
   Label nach `qa.submit` ist kein LLM-Auftrag (ADR-0035).

## 0. Kernbefund: was im Moderationskompass ankommt

Kategorien erscheinen im Kompass als Quellen der Karte »Häufige Themen«
(»Inhaltliche Fragen · n«, »Fragen zum Ablauf · n«, »Technische Fragen · n«)
und als Statuszeile; Encoder-Themen als Themen-Quellen derselben Karte. Gemessen
mit den Release-Funktionen des Kompasses (`measure-compass.mts`, Bericht
`results/compass-2026-11-08T23-18-20-657Z/`; fünf Wiederholungen `results/compass-2026-11-04T17-*`), je Fach eine
deutsche Sitzung. Teil 1 und 2 sind in allen Wiederholungen identisch.

| Fach (de)     | Statuszeile mit 8.9b | Kategorie-Quellen korrekt | Themen-Quellen schlüssig: lexikalisch → Encoder | über 3 Quellen erreichbar: 2B aus → mit Kategorien |
| ------------- | -------------------- | ------------------------: | ----------------------------------------------: | -------------------------------------------------: |
| Statistik     | »… geordnet.«        |        75,5 % (40 falsch) |                                       0/3 → 2/3 |                                    16,9 % → 81,1 % |
| Botanik       | »… geordnet.«        |         57,1 % (6 falsch) |                                       3/3 → 3/3 |                                    50,0 % → 87,5 % |
| Geschichte    | »… geordnet.«        |         71,4 % (4 falsch) |                                       3/3 → 3/3 |                                   46,7 % → 100,0 % |
| Polizeischule | »… geordnet.«        |        51,2 % (40 falsch) |                                       2/3 → 2/3 |                                    16,7 % → 91,1 % |

_Schlüssig_ = Quelle mit ≥ 2 Fragen, davon ≥ 80 % ein Anliegen (Familie).
_Erreichbar_ = Anteil aller Fragen hinter den drei sichtbaren Quellen.

1. **Kategorien vergrößern die Reichweite, aber jede vierte bis jede zweite
   Frage dahinter ist falsch einsortiert.** Die Statuszeile lautet trotzdem
   »Die Fragen sind nach Inhalt, Organisation und Technik geordnet.« Beispiel
   Polizeischule, »Fragen zum Ablauf · 41«: nur 41,5 % sind Ablauffragen, darunter
   »Ist die vorläufige Festnahme basically dasselbe wie eine Ingewahrsamnahme?«.
2. **Kategorien verdrängen die Themen.** Sind beide an, belegen die drei
   Kategorie-Quellen alle sichtbaren Plätze (`selectModerationCompassTopicSourceIds`
   nimmt klassifizierte Quellen zuerst); Encoder-Themen stehen nur noch hinter
   »Weitere Wortwolken-Themen«.
3. **Encoder-Themen machen die Themen-Quellen schlüssiger, nicht breiter.** In
   der Statistik werden aus 0 von 3 schlüssigen Quellen 2 von 3; erreichbar sind
   aber nur 9,0 % statt 16,9 % der Fragen, weil Encoder-Themen enger sind.
4. **Sprachen (Statistik):** Kategorie-Quellen korrekt de 75,5 %, en 66,0 %,
   fr 53,8 %, es 47,6 % – bei gleicher Statuszeile. Encoder-Themen gibt es nur
   in de/en; fr/es-Sitzungen zeigen lexikalische Terme (Polizeischule: de 51,2 %,
   en 57,1 %, fr 55,6 %, es 52,9 %, kleine Stichproben).
5. **Last:** Bei 50 und 200 Fragen/s hält die Queue mit (höchstens 3 wartend);
   »Die Fragen werden gerade geordnet.« steht über den ganzen Lauf zusammen rund
   1–2 s. Bei 1000 Fragen/s liegt die Grenze: In 3 von 20 wiederholten Läufen
   (15 %, 95-%-Wilson-Intervall 5–36 %; bei 200/s 0 von 20, Bericht
   `results/load-2026-11-08T23-26-27-135Z/`) lief die Queue über (abgewiesen je Lauf 0–86 Fragen, höchstens 17–106
   gleichzeitig offen); in jedem Überlauf-Lauf meldete die Statuszeile am Ende
   »nicht automatisch geordnet«, sonst »geordnet«. Kommen 500 Fragen im selben Moment,
   scheitern 400 (`failed:queue-limit`) und die Statuszeile wechselt zu »Die Fragen können gerade nicht automatisch geordnet werden.« – **auch in einer
   Nachbarsitzung**, weil es eine Queue je Backend-Prozess gibt. Fordern mehrere
   Sitzungen gleichzeitig Themen an, bekommt nur die erste Encoder-Themen, die
   anderen sofort den lexikalischen Fallback (»Themen konnten gerade nicht aktualisiert werden. Nutze die bisherige Ansicht oder versuche es erneut.«); die nächste Anfrage danach klappt wieder.

6. **Entscheidungstiefe:** Der vorgeschlagene nächste Schritt (»Als Nächstes«)
   ist in allen Fächern und Varianten derselbe. 2B ändert den Inhalt der Karte
   »Häufige Themen«, nicht die Empfehlung des Kompasses.
7. **Gemeinsames Szenario (#456 §12, nur Kontexttest):** Mit der 2A-Rubrik
   erreicht der Kompass ohne 2B 4 von 8 Punkten, mit Kategorien, mit
   Encoder-Themen oder mit beidem jeweils 5 (D2 nicht bewertet, weil 2B keine
   Stimmen deutet). Kategorien machen Übungswunsch und Prüfung/Kontroverse
   sichtbar, mischen aber D (Prüfung) und E (Anwesenheit) in »Fragen zum
   Ablauf · 2«; C und F bleiben `uncertain` und fehlen, die Statuszeile meldet
   trotzdem »geordnet«. Encoder-Themen trennen sauber (A+B, E+F), C und D
   bleiben Einzelfragen (Kosinus 0,864 < 0,87) und damit unsichtbar. **Die
   Prüfungsorganisation wird in keiner Variante als eigenes Anliegen
   sichtbar**, und keine Variante kennzeichnet die Lücke (D4 = 0). Bericht
   `results/group-scenario-2026-11-08T23-18-23-462Z/`.

**Folge für die Entscheidungen:** E1 wird gestützt (falsche Quellen ohne
Warnung, Statuszeile maskiert). E2 gilt nur, solange E1 gilt: Mit Kategorien
wären die Encoder-Themen im Kompass nicht sichtbar.

---

8. **spaCy-Glättung (1.14b):** Mit dem Release-Sidecar lemmatisiert, bleibt die
   Statistik im Kompass bei 0 von 3 schlüssigen Themen-Quellen, die
   Polizeischule fällt von 2 auf 1; Encoder-Themen erreichen 2 von 3. Ist der
   Sidecar an, verdrängen die Lemma-Terme sogar die Encoder-Themen, außer im
   Modus »Themen« (`moderationCompassQaTerms`). Bericht `results/spacy-2026-11-08T23-18-38-589Z/`;
   über den Release-Client und den Unix-Socket identisch (`results/spacy-socket-2026-11-08T23-27-07-239Z/`).
9. **Robustheit:** Über je 100 zufällige Teilsitzungen hat der Encoder in
   94–100 % mindestens so viele schlüssige Kompass-Quellen wie »Wörter« mit
   spaCy und in 84–100 % den höheren Anteil gleicher Anliegen; der Befund hängt
   nicht an einer Sitzung (`results/robustness-2026-11-08T23-31-51-740Z/`).
10. **Zusatz fr/es (hypothetisch):** Mit geöffnetem Locale-Gate wäre der Encoder
    in Französisch schlechter als der lexikalische Modus (ARI 0,18 statt 0,23),
    in Spanisch nur teilweise besser (0,32 statt 0,26; in 67 % der
    Teilsitzungen). Die Release-Beschränkung auf de/en ist gedeckt (`results/robustness-locales-2026-11-08T23-24-19-543Z/`).

## 1. Transparenz zur Reihenfolge

| Bestandteil                                                                | Wann festgelegt                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Grundhypothese (Abschnitt 2)                                               | vor der ersten Messung                                                    |
| Akzeptanzkriterien Klassifikation (Präzision ≥ 80 %, Unsicher-Rate ≤ 30 %) | vorab, als Releasekonstanten in `apps/backend/src/lib/qaNlpCalibrate.ts`  |
| Operationalisierung H1a, H2a, H2b                                          | **nach** den Messungen                                                    |
| Prüfung auf fachfremde Fragen (Abschnitt 4, Übertragbarkeit)               | **nach** den Messungen, als Zusatzprüfung                                 |
| Laufzeitpfade und Fallback (Abschnitt 4, Laufzeitpfade)                    | **nach** den Messungen, als Fehlerinjektion an Queue, Timeout und Encoder |
| Polizeischule als viertes Fach (Abschnitt 4, Übertragbarkeit)              | **nach** den Messungen, als Zusatzprüfung; Set danach eingefroren         |
| Kompass-Messung, Sprachvergleich und Last (Abschnitt 0)                    | **nach** dem Einfrieren, auf dem unveränderten Set v2.2                   |

Konsequenz: Änderungsempfehlungen stützen sich nur auf vorab festgelegte
Kriterien. Die nachträglich operationalisierten Teilhypothesen werden als
»mit den Daten vereinbar« berichtet, nicht als bestätigt im strengen Sinn.

## 2. Hypothese und Gegenalternative

**Grundhypothese:** Beide nichtgenerativen Pfade liefern gegenüber der Baseline
nachweisbar mehr korrekt zugeordnete Moderationsinformation, vor allem bei
Paraphrasen und mehrsprachigen Fragen. Unterhalb ihrer Akzeptanzschwellen
erzeugen sie jedoch mehr Fehlzuordnungen als nutzbare Information und müssen
dann auf »unsicher« beziehungsweise die Baseline zurückfallen.

|                      | Klassifikation (8.9b)                                                                                               | Themen (1.14c)                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Teilhypothese a      | H1a: Die Kaskade liefert mehr akzeptierte **und** richtige Kategorien als die Keyword-Baseline (McNemar, p < 0,05). | H2a: Der Encoder stimmt in de und en besser mit der Referenz überein als der lexikalische Themenmodus (ARI in allen 10 Läufen höher). |
| Teilhypothese b      | H1b: Am Betriebspunkt 0,55 erfüllt die Kaskade die Releasekriterien (Präzision ≥ 80 %, Unsicher-Rate ≤ 30 %).       | H2b: Am Betriebspunkt 0,87 führt der Encoder weniger fremde Fragen zusammen als die Baseline.                                         |
| **Gegenalternative** | Nur Keyword-Baseline; `QA_NLP_ENABLED=false`                                                                        | Nur lexikalischer Themenmodus; `WORD_CLOUD_SEMANTIC_ENABLED=false`                                                                    |

## 3. Versuchsaufbau (Kurzform)

Unveränderter Baselinelauf aller Systeme am Releasecode → kontrollierte
Varianten: Schwellen-Sweep (0,35–0,90 bzw. 0,80–0,92), Transliteration
(ä → ae), zehn Läufe mit zufälliger Batch-Zusammensetzung → Vergleich mit
95-%-Bootstrap-Intervallen bzw. Median [min–max] → Befund mit
Gültigkeitsgrenze → Entscheidung. Zusatz: dieselben Messungen je Fachdomäne
(`--domain statistics|botany|history|police`) sowie Fehlerinjektion an Queue,
Timeout und Encoder. Skripte und Rohdaten: `docs/didaktik/referate/2b-kategorien-semantische-themen/`.

### Baseline, Versuchsvariante und Ergebnis getrennt

| Untersuchung     | Unveränderte 1.3-Baseline                   | Kontrollierte Versuchsvariante                                                                            | Gemessenes Ergebnis                |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Klassifikation   | Kaskade am Betriebspunkt 0,55, Release-Seed | Keyword-Baseline; Schwellen 0,35–0,90; Transliteration; fachfremde Fragen                                 | §4 Klassifikation, Übertragbarkeit |
| Themen           | Encoder bei 0,87, 12 Themen                 | lexikalischer Modus `THEME`; Schwellen 0,80–0,92; 10 Batch-Zusammensetzungen; fachfremde Fragen           | §4 Themen, Übertragbarkeit         |
| Submit-Pfad 8.9b | Release-Queue mit Default-Konfiguration     | Kill-Switch aus; 150 Einreichungen im selben Tick; verzögerter bzw. blockierender Processor (Testadapter) | §4 Laufzeitpfade                   |
| Encoder-Pfad     | Encoder läuft                               | Encoder gestoppt; Encoder antwortet nicht; Circuit-Breaker                                                | §4 Laufzeitpfade                   |
| #456-Kontext     | Codepfad am Release                         | – (Codeanalyse, keine Variante)                                                                           | `kontextpfad-456.md`               |

Rückweg: Alle Varianten laufen außerhalb des Produktcodes (Messskripte,
Umgebungsvariablen, Testadapter). Der Releasecode wurde nicht verändert; die
Manifeste prüfen das (`sourcesDirty: false`).

### Baseline-Abgleich: `a657798e` gegenüber Tag `v1.3.0`

Gemessen wurde `a657798e` (neuester `main`, 181 Commits nach dem Tag
`v1.3.0` = `87c39334`, 08.10.2026). Laut Kursdokument (§3) fixiert die
Lehrperson den produktiv eingesetzten 1.3-Commit; dieser Commit ist mit ihr
abzustimmen.

| Bereich                                                                     | `v1.3.0` gegenüber `a657798e`                                              |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Klassifikator, Seed, Queue, Konfiguration (`qaNlp*`)                        | identisch                                                                  |
| Clustering, Encoder-Client, Encoder-Konfiguration, Schwelle 0,87, 12 Themen | identisch                                                                  |
| `resolveModerationCompassAnalysisMode`, `collectQaNlpCategorySources`       | identisch                                                                  |
| Timeout 8 s, Circuit-Breaker 3 Fehler / 30 s                                | identisch                                                                  |
| Orchestrierung der Themenanalyse (Cluster-Cache über Sortierungen, #578)    | geändert; Fallback-Pfad in beiden vorhanden                                |
| Generativer Themenname (`topic_label`, `wordCloudTopicLabels.ts`)           | erst nach `v1.3.0` (`f7b2b958`); vom Kursdokument zur 1.3-Baseline gezählt |
| Kontext-Packing, Kompass-Karten, `qa.ts`                                    | geändert; Zeilennummern weichen ab                                         |

**Folge:** Die Qualitätsbefunde zu Kategorien und Themen gelten für beide
Stände. Wiederholt am 04.11.2026 auf `a5dc74fc` (Upstream bis `cf522c63`)
und erneut auf `84a5614e` (Upstream bis `9f230abc`, #642: stabile
Themen-Schlüssel und Anzeige-Schemas der Wortwolke, Schwelle und Clustering
unverändert): Klassifikation, Seed, Queue, Encoder, Clustering und die beiden
Kompass-Funktionen sind dort unverändert; neu sind u. a. ein Kompass-Signal aus
Quiz-Ergebnissen (2A) und UI-Korrekturen der Wortwolke. Am 08.11.2026 auf
`efd71b44` vollständig wiederholt: alle Güte- und Kompasswerte identisch; geändert
sind nur UI-Texte (Statuszeile »… geordnet.«, »Wortgruppen«, »Themen«) und die Wahl
des Themen-Modus durch den Kompass in de/en (`e6270901`). Die Zeilenverweise und die Aussage »drei Slot-Aufträge inklusive
Themenname« gelten für `a657798e`.

## 4. Befunde

### Klassifikation (421 gelabelte Fragen, 79 mehrdeutig/Rauschen)

|                                           |    Keyword-Baseline |             Kaskade 1.3 |
| ----------------------------------------- | ------------------: | ----------------------: |
| Nutzbar korrekt (akzeptiert und richtig)  | 35,2 % [30,6; 39,9] | **61,3 %** [56,3; 66,3] |
| Präzision der akzeptierten Kategorien     | 74,7 % [68,5; 80,9] |     66,8 % [62,0; 71,8] |
| Sicher angezeigt, aber falsch             |          **11,9 %** |                  30,4 % |
| Enthaltung bei mehrdeutigen/Rausch-Fragen |              94,9 % |                  74,7 % |

- **H1a mit den Daten vereinbar:** 142 Fragen nur von der Kaskade richtig,
  32 nur von der Baseline (McNemar p < 0,0001).
- **H1b widerlegt:** Präzision 66,8 % liegt deutlich unter 80 %. Kein
  Schwellenwert zwischen 0,35 und 0,90 erfüllt beide Releasekriterien.
- **Kalibrierung fehlt:** Bei angezeigter Konfidenz ≥ 0,85 sind nur 68,6 %
  richtig (ECE 0,24).
- **Generalisierungslücke:** Auf dem eigenen Seed-Evaluationssplit des Releases
  erreicht die Kaskade 87,1 % Präzision, auf dem unabhängigen Referenzset 66,8 %.
- **Sprachen:** Anteil sicher-falscher Kategorien de 20 %, en 30 %, fr 43 %, es 49 %.
- Laufzeit vernachlässigbar (p99 0,37 ms; Training < 4 ms); Transliteration
  ändert die Ergebnisse um ≈ 1 Prozentpunkt.

### Themen (10 Läufe, Median [min–max])

| Fragen              | Lexikalisch ARI |          Encoder ARI | Falsch zusammengeführte Paare (lex. → Encoder) |
| ------------------- | --------------: | -------------------: | ---------------------------------------------- |
| Deutsch (201)       |            0,29 | **0,44** [0,40–0,48] | 211 → 81 [66–90]                               |
| Englisch (120)      |            0,29 | **0,53** [0,52–0,57] | 119 → 27 [21–27]                               |
| Spanisch (81)*      |            0,24 |     0,38 [0,32–0,44] | 70 → 33 [27–44]                                |
| Französisch (82)*   |            0,21 |     0,22 [0,18–0,26] | 66 → 92 [76–103]                               |
| Alle gemischt (500) |            0,18 |     0,21 [0,19–0,23] | 758 → 201 [186–232]                            |

\* Das Produkt ruft den Encoder für fr/es-Sitzungen nicht auf (`WORD_CLOUD_SEMANTIC_LOCALES = de, en`).

- **H2a mit den Daten vereinbar** für de und en, auch im schlechtesten Lauf.
  Für fr kein Gewinn.
- **H2b mit den Daten vereinbar:** deutlich weniger Fehlzusammenführungen.
- **Sprachübergreifend schwach:** nur 6,7 % gleicher Anliegen in
  verschiedenen Sprachen landen im selben Thema.
- **Schwelle:** Für Deutsch liegt die BCubed-F1 zwischen 0,86 und 0,88 auf
  einem Plateau (69,0 / 68,6 / 68,2 %); 0,87 liegt darin.
- **Batch-Abhängigkeit:** Dieselbe Frage erhält je nach mitgesendeten Fragen
  leicht andere Vektoren; Themen können von der Eingangsreihenfolge abhängen.
- **Anzeige:** Nur 12 Themen werden gezeigt; bei 500 Fragen decken sie 13–32 %
  der Fragen ab.
- **Ressourcen:** 500 Fragen in 6,6–7,2 s auf 1 CPU (zwei Läufe), ≈ 600 MB RAM, Image 1,5 GB;
  Clustering in Node 1,5–2,0 s für 500 Fragen auf einem Thread.

### Lexikalische Baseline mit spaCy-Glättung (Release-Sidecar)

Gegenprobe zur Frage, ob die lexikalische Baseline nur deshalb schwach ist,
weil sie ungeglättet gemessen wurde. spaCy 3.8.15 (Release-Image
`docker/spacy`, Modelle `*_core_*_sm` 3.8.0) über den Host-Pfad
`analyzeWordCloudSnapshot` mit `LEXICAL` + `LEMMA`; »Wortgruppen« mit spaCy
wie im Host gemischt (`mergeThemePhrasesWithLemmaUnigrams`). Bericht `results/spacy-2026-11-08T23-18-38-589Z/`.

| Sitzung (Kompass ohne Kategorien) | schlüssige Quellen: ohne spaCy → mit spaCy → Encoder | Top-12-Paare gleiches Anliegen: ohne → mit spaCy → Encoder |
| --------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| Statistik de (201)                | 0/3 → 0/3 → 2/3                                      | 23,9 % → 20,7 % → 66,4 %                                   |
| Polizeischule de (90)             | 2/3 → 1/3 → 2/3                                      | 40,0 % → 46,9 % → 71,0 %                                   |
| Statistik en (120)                | 0/3 → 0/3 → 0/3                                      | 13,4 % → 14,9 % → 65,9 %                                   |
| Statistik es (81)                 | 0/3 → 0/3 → (Fallback)                               | 7,9 % → 14,4 % → (Fallback)                                |

- spaCy fasst Wortformen zusammen (»Beispiele« → »Beispiel«, en »slides« →
  »slide«), bündelt aber keine Anliegen; der Abstand zum Encoder bleibt groß.
- In fr/es ist spaCy die einzige Glättung, weil der Encoder dort nicht
  aufgerufen wird; nur in es steigt der Anteil gleicher Anliegen spürbar.
- Laufzeit 0,7–1,6 ms je Frage (200 Fragen 141–314 ms; der höhere Wert ist der erste Aufruf), Image 751 MB, rund
  460 MiB Arbeitsspeicher.

- Gegenprobe über den Produktionspfad: Release-Client `normalizeWithSpacySidecar`
  über den Unix-Socket in einem Linux-Node-Container (gemeinsames Socket-Volume)
  liefert identische Werte; 0,7–1,0 ms je Frage (`results/spacy-socket-2026-11-08T23-27-07-239Z/`).

### Robustheit über Teilsitzungen

`measure-robustness.mts`: je Sitzung 100 zufällige Teilsitzungen (Seed 2026), dieselben
Release-Funktionen; Kontrolllauf über die ganze Sitzung reproduziert die Tabelle oben.
Median [95-%-Perzentil] und gepaarte Anteile (`results/robustness-2026-11-08T23-31-51-740Z/`):

| Sitzung (Teil/Pool)      | schlüssige Quellen Wörter → + spaCy → Encoder | Encoder ≥ + spaCy | Paare Encoder > + spaCy | ARI lex. → Encoder (Encoder besser) |
| ------------------------ | --------------------------------------------- | ----------------: | ----------------------: | ----------------------------------- |
| Statistik de (60/201)    | 0 [0; 1,5] → 0 [0; 1] → 1 [0; 3]              |             100 % |                    99 % | 0,32 → 0,47 (93 %)                  |
| Polizeischule de (45/90) | 0 [0; 2] → 1 [0; 2,5] → 2 [0; 3]              |              94 % |                    84 % | 0,38 → 0,43 (66 %)                  |
| Statistik en (60/120)    | 0 [0; 0] → 0 [0; 0] → 1 [0; 3]                |             100 % |                   100 % | 0,33 → 0,52 (95 %)                  |

- spaCy ändert die Zahl schlüssiger Quellen meist nicht; Statistik de in 15 %
  der Teilsitzungen schlechter, Polizeischule in 21 % besser.
- Einzelne Teilsitzungen zeigen auch mit Encoder 0 schlüssige Quellen; die
  Aussage gilt für die Verteilung, nicht für jede Vorlesung.

### Zusatz: Encoder für fr/es (hypothetisch, Gate geöffnet)

Release: fr/es → Status `fallback`. Gemessen mit Sitzungs-Locale de (einzige
Stelle, an der die Analyse die Sitzungssprache auswertet), 100 Teilsitzungen à 40
(`results/robustness-locales-2026-11-08T23-24-19-543Z/`):

| Sitzung      | ARI lex. → Encoder (Encoder besser) | Top-12-Paare + spaCy → Encoder (Encoder besser) |
| ------------ | ----------------------------------- | ----------------------------------------------- |
| Statistik fr | 0,23 → 0,18 (24 %)                  | 17,3 % → 12,0 % (16 %)                          |
| Statistik es | 0,26 → 0,32 (67 %)                  | 18,2 % → 25,0 % (66 %)                          |

### Übertragbarkeit auf andere Fächer (Zusatzprüfung, v2.2)

Der 8.9b-Seed (`qaNlpSeed.ts`) enthält nur Statistik- und ML-Inhalte; das
Referenzset v2 ebenfalls. Deshalb je 6 Familien aus Botanik (37 Fragen) und
Geschichte (36 Fragen) sowie 150 Fragen aus dem Unterricht einer Polizeischule
(18 Familien, dazu Near-Miss-, mehrdeutige und Rausch-Fragen; Eingriffs- und
Strafrecht, Schießtraining, Praktikum, Simulator, Digitalfunk). Jede Domäne
getrennt gemessen.

| Anteil nutzbar korrekt (Kaskade) |      Statistik |           Botanik |      Geschichte |   Polizeischule |
| -------------------------------- | -------------: | ----------------: | --------------: | --------------: |
| content                          | 66 % (n = 140) | **48 %** (n = 21) |   62 % (n = 21) |   49 % (n = 65) |
| organization                     | 57 % (n = 155) |     82 % (n = 11) |   90 % (n = 10) |   57 % (n = 44) |
| technical                        | 61 % (n = 126) |      60 % (n = 5) | **0 %** (n = 5) |   42 % (n = 26) |
| Kaskade gesamt / sicher falsch   |    61 % / 30 % |       60 % / 32 % |     61 % / 36 % | 50 % / **46 %** |
| Keyword-Baseline, gesamt         |           35 % |          **14 %** |         **8 %** |         **6 %** |

- Fehler fachfremder Inhaltsfragen kommen **sicher**: »lichtreaktion vs calvin
  zyklus versteh ich nicht« → `technical` (0,998), »Woran erkenne ich, ob eine
  Pflanze monokotyl …« → `organization` (0,993), »La base de datos de
  periódicos no carga« → `content` (0,999). Keine höhere Schwelle fängt das ab.
- Organisatorisches überträgt sich, weil Fristen und Anmeldung fachunabhängig
  formuliert sind – weniger, wenn die Organisation fachspezifisch klingt
  (Schießstand, Dienststelle, Kleiderkammer: 57 %).
- **Polizeischule:** Die Kaskade akzeptiert 96 % der Fragen, aber fast jedes
  zweite akzeptierte Label ist falsch (45,9 %). Technikfragen zu Simulator,
  Digitalfunk und Vorgangsbearbeitung sind zu 54 % sicher falsch, weil dieses
  Vokabular im Seed fehlt. Der Gewinn gegenüber den Keyword-Regeln bleibt
  signifikant (62 zu 2 Fragen, McNemar p < 0,001).
- Die Keyword-Baseline bricht außerhalb der Statistik ein. Der relative Vorsprung
  der Kaskade wächst, ihre absolute Qualität nicht.
- **Encoder-Themen bleiben stabil:** Median-Kosinus gleicher Familie 0,848 /
  0,851 / 0,848 / 0,834 (Statistik / Botanik / Geschichte / Polizeischule).
  Ein großer Teil der zusammengehörigen Paare liegt in allen Fächern unter 0,87.
- **Polizeischule de – Grenze von E2:** Der Encoder erreicht in keinem der 10
  Läufe den ARI des lexikalischen Modus (0,36 [0,35–0,39] gegenüber 0,41), führt
  aber deutlich weniger fremde Fragen zusammen (37 → 13 Paare; BCubed-F1 72,6 →
  73,0 %). Er trennt also vorsichtiger. In en ist er klar besser (ARI −0,01 →
  0,33; Fehlzusammenführungen 12 → 4).
- **Grenze:** kleine Stichproben in Botanik und Geschichte (≈ 20 Inhalts-, 5
  Technikfragen je Fach, keine Near-Miss-Fragen); Polizeischule größer (135
  gelabelte Fragen inkl. 15 Near-Miss). Richtungsbefund. ARI/BCubed sind wegen anderer Setgröße und -struktur
  nicht mit Statistik vergleichbar.

### Laufzeitpfade und Fallback (Fehlerinjektion)

Bericht: `results/paths-2026-11-08T23-17-38-869Z/`. Releaseanker: Submit plant
nur (`routers/qa.ts:1905`, `qaNlpQueue.ts:271`); Timeout `qaNlpQueue.ts:179`;
Encoder-Timeout und Circuit-Breaker `wordCloudSemanticConfig.ts:12`, `:19–20`;
Kompass `moderation-compass.ts:702–712`, `moderation-compass-rules.ts:1010–1033`;
kein Slot für 8.9b laut ADR-0035 (`:143`). Zeilen für 1.3 (`a657798e`); die Zeilen auf `main` stehen im README.

- **8.9b hält den Submit nicht auf:** enqueue p50 0,80 ms; 0 Netzaufrufe bei
  201 Klassifikationen; Ergebnis p50 1,4 ms später.
- **Timeout 2 s** greift bei asynchron hängenden Jobs (`failed:timeout`). Bei
  CPU-blockierender Arbeit greift er nicht (2,5 s Blockade → trotzdem
  `classified`).
- **Queue-Limit 100:** 150 Einreichungen im selben Tick → 50 `failed:queue-limit`.
- **Encoder-Ausfall:** gestoppt → 9 ms bis zum lexikalischen Fallback; hängend →
  8 s (Timeout); nach 3 Fehlern öffnet der Circuit-Breaker → ab der 4. Analyse
  3 ms.
- **Kompass:** Nur `classified`-Fragen gehen in die Kategorie-Quellen ein. Die
  Statuszeile »unsicher« erscheint nur, wenn keine Frage `classified` ist. In
  einer Sitzung mit 201 Fragen zeigte der Kompass »classified«, obwohl 34 Labels
  falsch und 12 auf mehrdeutigen oder Rausch-Fragen gesetzt waren.
- **Kategorie und Thema sind unabhängig:** 6 von 12 Encoder-Themen enthalten
  Fragen mit unterschiedlicher 8.9b-Kategorie.

## 5. Entscheidungen

### E1 – Klassifikation: `QA_NLP_ENABLED=false` beibehalten

- **Betroffen:** Story 8.9b, `QA_NLP_ENABLED` (Release-Default `false`),
  `QA_NLP_MIN_CONFIDENCE` (0,55).
- **Entscheidung:** Funktion **deaktiviert lassen**; Schwelle **nicht ändern**.
- **Begründung:** Vorab festgelegtes Kriterium H1b verfehlt; der Schwellenwert
  ist nicht der Hebel (Sweep). Im #456-Kontext würden falsch akzeptierte
  Kategorien die Auswahl der Fragen für die Kurzfassung verschieben, weil
  `organization` und `technical` eigene bevorzugte Listen erhalten
  (`moderationPromptContextPacking.ts:458–463`). Verstärkt durch die
  Zusatzprüfungen: Außerhalb der Statistik kommen falsche Labels mit Konfidenz
  bis 0,999, und der Kompass zeigt in gemischten Sitzungen »classified« ohne
  Hinweis auf diese Fehler. In der Polizeischule sind 45,9 % der angezeigten
  Labels falsch.
- **Folge:** Keine Queue-Last. Die Listen für organisatorische und technische
  Fragen bleiben im Packing leer; diese Fragen konkurrieren in den allgemeinen
  Listen (kontrovers, gut bewertet, unbewertet). Ob der Regelkern organisatorische
  Anliegen dann ausreichend sichtbar macht, ist Schnittstelle zu 2A.
- **Bedingung für eine spätere Aktivierung:** auf einem unabhängigen
  Referenzset inkl. fr/es Präzision ≥ 80 % bei Unsicher-Rate ≤ 30 % und eine
  kalibrierte Konfidenz, geprüft auch auf fachfremden Fragen. Hebel dafür sind
  mehr Trainingsdaten (das Seed hat 186 Beispiele, nur Statistik/ML, wenige in
  fr/es) und Kalibrierung – nicht die Schwelle. Das Modell lernt im Betrieb
  nicht dazu (Training einmal beim Start, `qaNlpGatekeeper.ts:9–16`).
- **Rückweg:** Umgebungsvariable; keine Datenmigration.

### E2 – Themen: Encoder für de/en-Sitzungen aktivierbar, Schwelle 0,87 beibehalten

- **Betroffen:** Story 1.14c, `WORD_CLOUD_SEMANTIC_ENABLED` (Release-Default
  `false`), `WORD_CLOUD_SEMANTIC_COSINE_THRESHOLD` (0,87).
- **Entscheidung:** Aktivierung für de/en-Sitzungen ist durch die Messung
  gedeckt; Schwelle **unverändert**. Der lexikalische Themenmodus bleibt
  automatischer Fallback (Encoder-Ausfall, fr/es-Sitzung, zu wenige Fragen).
  Im Kompass sind die Encoder-Themen nur sichtbar, solange E1 gilt; mit
  Kategorien belegen deren Quellen alle drei sichtbaren Plätze (Abschnitt 0).
- **Begründung:** Deutlicher, über alle Läufe stabiler Qualitätsgewinn in de
  und en bei moderaten Ressourcen. Eine andere Schwelle ist nicht begründbar:
  0,87 liegt im Plateau, und die Themen-Kriterien wurden nachträglich gebildet.
  Die Zusatzprüfungen stützen das: gleiche Ähnlichkeitsstruktur in Botanik und
  Geschichte; der Fallback greift bei gestopptem (10 ms) und hängendem (8 s)
  Encoder, danach schützt der Circuit-Breaker. Über 100 Teilsitzungen je Sitzung
  bleibt der Vorsprung bestehen (93–95 % der Teilsitzungen mit höherem ARI in
  Statistik de/en). Die Beschränkung auf de/en ist gedeckt: Mit geöffnetem Gate
  wäre der Encoder in fr schlechter (ARI 0,18 statt 0,23), in es nur teilweise
  besser.
- **Folge und Risiken, die der Lehrperson bekannt sein sollten:**
  gemischtsprachige Fragen bilden getrennte Themen; nur 12 Themen sichtbar;
  Themen können je nach Eingangsreihenfolge leicht variieren. Bei fachfremdem
  deutschem Vokabular (Polizeischule) ist der Gewinn kleiner: weniger
  Fehlzusammenführungen, aber kein höherer ARI.
- **Betrieb:** eigener Container, 1 CPU / 2 GB, ohne Netz. Offener Prüfpunkt an
  Thema 1: Das Clustering dauert bei 500 Fragen 1,5–2 s in Node; ob das den
  Live-Betrieb verzögert, wurde hier nicht gemessen.
- **Rückweg:** `WORD_CLOUD_SEMANTIC_ENABLED=false` → lexikalischer Modus.

### E3 – #456-Kontext: Übernahme nur gespeicherter Ergebnisse beibehalten

- Im Code bestätigt: Der Kontextabruf ruft weder Klassifikation noch Encoder auf
  (`moderationQaContext.ts:621–625`, `:1027`). Gelöschte oder geänderte Fragen
  verwerfen das betroffene Thema (Hash-Prüfung).
- **Folge:** Themen stehen nur zur Verfügung, wenn der Host den Themenmodus
  vorher geöffnet hat. Das ist der Preis dafür, dass der Kontextabruf schnell
  und begrenzt bleibt; beibehalten.

### E4 – spaCy-Glättung: optional lassen, nicht als Ersatz für den Encoder

- Gemessen: kein Gewinn an schlüssigen Kompass-Quellen gegenüber der
  ungeglätteten Baseline; Encoder-Themen bleiben deutlich besser.
- Ist der Sidecar an, nimmt der Kompass Lemma-Terme vor Encoder-Themen, außer im
  Modus »Themen«. Auf dem letzten 1.3-Stand (`efd71b44`, Commit `e6270901`) wählt
  der Kompass in de/en selbst den Themen-Modus und stellt die Wortwolke beim Sprung
  darauf um; Encoder-Themen entstehen weiterhin erst durch eine Host-Analyse. spaCy
  ist keine Voraussetzung für E2.
- `NLP_ENABLED` bleibt eine Lesbarkeitsentscheidung (Wortformen), keine
  Qualitätsentscheidung für Anliegen.

## 6. Cloud-Bezug (QZ 5)

Die Klassifikation kostet praktisch keine Rechenzeit; die Entscheidung gegen sie
ist eine Qualitätsentscheidung, keine Ressourcenentscheidung. Der Encoder ist
ein isolierter Sidecar mit festen Grenzen und ohne externen Dienst; für die
gemessene Last ist weder GPU noch ein Managed-Dienst nötig. Der spaCy-Sidecar
wäre ein dritter privater Dienst (Image 751 MB, rund 460 MiB) ohne messbaren
Gewinn für den Kompass. Kosten in Euro
wurden nicht erhoben.

## 7. Gültigkeitsgrenzen

- Referenzfragen synthetisch, von einem KI-Assistenten entworfen; Kategorien
  KI-gestützt zugeordnet und von mir übernommen. Set am 04.11.2026 eingefroren (SHA-256 im Bericht).
- Bewusst schwierige Mischung (Near-Miss, Mehrdeutigkeit, Rauschen): Werte
  beschreiben Verhalten in schwierigen Fällen, nicht eine typische Vorlesung.
- Modellkonfidenz ist ohne Kalibrierung keine Erfolgswahrscheinlichkeit;
  Themenhäufigkeit ist kein Lernstandsmaß.
- Laborbetrieb (Encoder über loopback-HTTP statt Unix-Socket). Queue und
  Timeout in-process mit Testadaptern gemessen, ohne HTTP, Datenbank und echte
  Parallelnutzer; Cache-Latenzen nicht gemessen.
- spaCy-Sidecar unter Windows per `docker exec` aufgerufen; ein Kontrolllauf über
  den Release-Client und den Unix-Socket (Linux-Container) liefert identische Werte.
- Teilsitzungen stammen aus demselben Referenzset: Die Intervalle zeigen Streuung
  über Sitzungszusammensetzungen, nicht über unabhängige Lehrveranstaltungen.
- Fachfremde Prüfung: Botanik und Geschichte klein und ohne Near-Miss-Fragen,
  Polizeischule größer; Richtungsbefund für die Übertragbarkeit.

## 8. Beitrag zur Gruppensynthese

Für die Stufenempfehlung der Gruppe liefert 2B:
**Regelkern (2A) immer · Encoder-Themen zusätzlich in de/en-Sitzungen ·
spaCy optional · Klassifikation vorerst aus.** Schnittstelle zu 2C: Die Kurzfassung erhält
Themen nur aus dem gespeicherten Snapshot und ohne Kategorien-Listen, solange
E1 gilt.

### Wann 2B einen zusätzlichen Beitrag leistet

| Funktion       | Zusätzlicher Beitrag, wenn …                                                      | Kein Beitrag bzw. Schaden, wenn …                                                                                                         |
| -------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Encoder-Themen | de/en-Sitzung, Host öffnet den Themenmodus, viele Paraphrasen desselben Anliegens | fr/es (Produkt nutzt den Encoder nicht), gemischtsprachige Sitzung, wenige Fragen, Encoder nicht erreichbar (dann lexikalischer Fallback) |
| Kategorien     | erst nach Erfüllung der Aktivierungsbedingung aus E1                              | heute: zu viele sicher-falsche Labels, besonders bei Klausurrelevanz und fachfremden Inhalten                                             |

Fehler- und Betriebskosten: Kategorien kosten fast keine Rechenzeit; ihr Preis
sind Fehlzuordnungen. Encoder-Themen kosten einen Container (1 CPU, 2 GB) und
eine Host-Aktion; ihr Preis sind die nur 12 sichtbaren Themen und die Schwelle,
die zwei Drittel zusammengehöriger Paare trennt.

### Gemeinsame Nutzungsfrage

»Kann die Lehrperson Übungswünsche, Prüfungsorganisation und geteilte
Bewertungen unterscheiden und die Belege prüfen?« Antwort aus 2B-Sicht
(Referenzset v2, Statistik):

| Anliegen                                                    |   n | Kaskade: nutzbar korrekt | sicher falsch (wohin)               | Keyword-Baseline: nutzbar korrekt |
| ----------------------------------------------------------- | --: | -----------------------: | ----------------------------------- | --------------------------------: |
| Übungswunsch (C-REG)                                        |  13 |                     69 % | 4 (3 × organization, 1 × technical) |                              62 % |
| Klausurrelevanz (C-HYP, N-ZEXAM, N-CORREXAM, S-REG-EXAM)    |  20 |                 **35 %** | **11 × organization**               |                          **80 %** |
| Prüfungsorganisation (O-REG, O-AIDS, O-ROOM, N-BONUSRETAKE) |  40 |                     68 % | 9 (7 × content, 2 × technical)      |                              13 % |
| Anwesenheit (O-ATT)                                         |  13 |                     77 % | 2                                   |                              69 % |

- **Kategorien trennen ausgerechnet Klausurrelevanz und Prüfungsorganisation
  schlecht:** Das Wort »Klausur« zieht inhaltliche Fragen zu `organization`.
  Die Labelregel (»Kommt X dran?« → content, »Welcher Raum?« → organization)
  entspricht dem Release-Seed (`qaNlpSeed.ts:60` content, `:167` organization).
  Für die Gruppenrubrik ist abzustimmen, ob »Prüfungsorganisation« die
  Klausurrelevanz einschließt.
- **Themen trennen besser:** Der lexikalische Modus fasst in de fast alle
  Klausurfragen zu einem Thema zusammen (O-REG, O-AIDS, O-ROOM, C-HYP,
  S-REG-EXAM, N-ZEXAM, O-GRADE). Der Encoder bildet in de nur ein gemischtes
  Thema innerhalb der Organisation (O-ROOM + O-REG). In en verbindet er
  Anwesenheit und Hilfsmittel.
- **Geteilte Bewertungen** sind keine 2B-Funktion: Kategorien ignorieren Stimmen;
  Themen hängen nur von den Texten ab, die Gewichtung ordnet sie lediglich um
  (`word-cloud-semantic.md:51`). Im #456-Kontext erhält jedes Thema
  Stimmen-Aggregate (`moderationQaContext.ts:787–788`); deren Deutung gehört zu
  2A/2C.

### Einordnung in die gemeinsame Informationsrubrik

Die Rubrik operationalisiert 2A (Quellennachvollziehbarkeit, korrekte Bedeutung
von Bewertungen, Trennung organisatorischer/fachlicher Anliegen, Darstellung
von Unsicherheit, Informationsumfang). Beitrag von 2B je Kriterium:

| Rubrikkriterium                    | Kategorien 8.9b                                                                                                                    | Encoder-Themen 1.14c                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Quellennachvollziehbarkeit         | je Frage-ID; Kompass verlinkt die Fragen (`moderation-compass.ts:702–728`)                                                         | Mitglieds-IDs mit Text-Hash, Label = Text einer Mitgliedsfrage (`qaSemanticTopicSnapshot.ts:150`) |
| Korrekte Bedeutung von Bewertungen | nicht anwendbar                                                                                                                    | nicht Teil der Gruppierung; Aggregate im Kontext                                                  |
| Trennung organisatorisch/fachlich  | gemessen, siehe Nutzungsfrage: schwach bei Klausurrelevanz                                                                         | gemessen: besser als lexikalisch, Restfehler innerhalb der Organisation                           |
| Darstellung von Unsicherheit       | Status `uncertain`, Konfidenz als `uncalibrated-model-score`; aber sicher-falsche Labels und Kompass-Maskierung (§4 Laufzeitpfade) | Status `uncertain` je Analyse, Konfidenz je Thema; Fallback mit Status `failed`                   |
| Informationsumfang                 | 92 % der Fragen erhalten eine Kategorie                                                                                            | 12 Themen decken 13–32 % der Fragen ab                                                            |

Kategorien, Themen und Kurzfassung bleiben dabei getrennte Teilfunktionen und
werden nicht als austauschbare Klassifikatoren verglichen. Ihr gemeinsamer
Maßstab ist die Rubrik.

Angewandt auf das gemeinsame Sechs-Fragen-Szenario im Kompass (§0, Befund 7;
`check-group-scenario.mts`): ohne 2B 4 von 8 Punkten, mit Kategorien,
Encoder-Themen oder beidem jeweils 5. Der Gewinn liegt im Umfang (D5), der
Verlust bei Kategorien in der Trennung (D3); die Kennzeichnung von Lücken (D4)
leistet keine Variante.
