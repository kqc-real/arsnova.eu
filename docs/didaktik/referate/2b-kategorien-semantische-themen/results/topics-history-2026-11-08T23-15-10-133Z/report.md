# Referat 2B – Themenmessung 1.14c (Encoder vs. lexikalisch)

Commit `74091b0a6468` (v1.3.0-364-g74091b0a-dirty), Referenzset 2.2.0 (SHA-256 `717bdb17dc2e94d5…`), 2026-11-08T23:15:10.133Z
Modell `intfloat/multilingual-e5-small` / `intfloat/multilingual-e5-small@sha256:f80102d3f2a1229f`, 384 Dimensionen · Container-Limits cpus=1000000000 mem=2147483648 · loopback HTTP http://127.0.0.1:8790/embed (Labor; Produktion: Unix-Socket, network_mode none)

Umfang: 36 von 723 Items, Domäne history, Sprachen de, en, fr, es (+ mixed). Italienisch ausgeschlossen, weil die Wortwolke es nicht unterstützt (WORD_CLOUD_LEMMA_LOCALES).

Goldstandard: Themenfamilien des Referenzsets; Near-Miss-, mehrdeutige und Rausch-Items sind Einzelthemen.

## 1. Hauptergebnis

| Teilmenge                                  |   n | System      |   ARI |   NMI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 (Gold) | Falsch-Merge-Paare | Paar-Recall einsprachig | Paar-Recall sprachübergreifend |
| ------------------------------------------ | --: | ----------- | ----: | ----: | -------: | -------: | --------: | ---------------- | -----------------: | ----------------------: | -----------------------------: |
| Gesamtset (de/en/fr/es), Session-Locale de |  36 | Encoder     | 0.332 | 0.761 |  100.0 % |   35.9 % |    52.8 % | 11 (6)           |                  0 |                  20.0 % |                         23.1 % |
| Gesamtset (de/en/fr/es), Session-Locale de |  36 | Lexikalisch | 0.336 | 0.739 |   96.3 % |   35.1 % |    51.4 % | 9 (6)            |                  2 |                  60.0 % |                         16.7 % |
| nur Deutsch                                |  15 | Encoder     | 0.639 | 0.890 |  100.0 % |   71.1 % |    83.1 % | 4 (6)            |                  0 |                  50.0 % |                              – |
| nur Deutsch                                |  15 | Lexikalisch | 0.639 | 0.890 |  100.0 % |   68.9 % |    81.6 % | 4 (6)            |                  0 |                  50.0 % |                              – |
| nur Englisch                               |   9 | Encoder     | 0.786 | 0.957 |  100.0 % |   88.9 % |    94.1 % | 2 (3)            |                  0 |                  66.7 % |                              – |
| nur Englisch                               |   9 | Lexikalisch | 0.842 | 0.954 |   88.9 % |  100.0 % |    94.1 % | 4 (3)            |                  1 |                 100.0 % |                              – |
| nur Französisch ⚠ †                        |   6 | Encoder     | 0.000 | 0.931 |   83.3 % |  100.0 % |    90.9 % | 1 (0)            |                  1 |                       – |                              – |
| nur Französisch †                          |   6 | Lexikalisch | 1.000 | 1.000 |  100.0 % |  100.0 % |   100.0 % | 0 (0)            |                  0 |                       – |                              – |
| nur Spanisch ⚠ †                           |   6 | Encoder     | 1.000 | 1.000 |  100.0 % |  100.0 % |   100.0 % | 0 (0)            |                  0 |                       – |                              – |
| nur Spanisch †                             |   6 | Lexikalisch | 0.000 | 0.931 |   83.3 % |  100.0 % |    90.9 % | 1 (0)            |                  1 |                       – |                              – |

† Nicht aussagekräftig: In dieser Teilmenge hat keine Familie zwei Mitglieder derselben Sprache. ARI ist dann 0, BCubed belohnt bloßes Nicht-Zusammenfassen. Nur Gesamtset und Deutsch tragen eine Aussage; für Einsprachigkeit in en/fr/es wären mehr Items je Sprache nötig.

⚠ Session-Locale nicht in `WORD_CLOUD_SEMANTIC_LOCALES` (de, en): Das Produkt ruft den Encoder dort **nicht** auf und zeigt den lexikalischen Fallback. Encoderwerte zeigen nur das ungenutzte Potenzial.

### Stabilität über die Batch-Zusammensetzung

Das Embedding einer Frage hängt von den anderen Texten derselben Anfrage ab (Vektor-Drift 1 − cos: Median 3.2e-3, max 6.5e-3). Vermutete Ursache: quantisiertes ONNX-Modell (nicht verifiziert). Tabelle 1 oben zeigt **eine** Gesamtanfrage; hier 10 Läufe mit zufälliger Reihenfolge und Anfragegrößen 5–40 (simuliert inkrementelles Einbetten). Werte: Median [min–max].

| Teilmenge                                  | Encoder ARI         | Encoder BCubed F1         | Falsch-Merge-Paare | Themen ≥2  | Lexikalisch ARI (deterministisch) |
| ------------------------------------------ | ------------------- | ------------------------- | ------------------ | ---------- | --------------------------------: |
| Gesamtset (de/en/fr/es), Session-Locale de | 0.346 [0.332–0.359] | 53.8 % [52.8 %–54.8 %]    | 0 [0–0]            | 11 [10–12] |                             0.336 |
| nur Deutsch                                | 0.639 [0.559–0.713] | 83.1 % [78.4 %–87.5 %]    | 0 [0–0]            | 4 [3–5]    |                             0.639 |
| nur Englisch                               | 0.786 [0.786–0.786] | 94.1 % [94.1 %–94.1 %]    | 0 [0–0]            | 2 [2–2]    |                             0.842 |
| nur Französisch †                          | 0.000 [0.000–0.000] | 90.9 % [90.9 %–90.9 %]    | 1 [1–1]            | 1 [1–1]    |                             1.000 |
| nur Spanisch †                             | 1.000 [1.000–1.000] | 100.0 % [100.0 %–100.0 %] | 0 [0–0]            | 0 [0–0]    |                             0.000 |

## 2. Produktansicht (Gate, Top-12, Status)

| Teilmenge                                  | Gate bestanden | Status            | angezeigte Themen | davon ≥2 Mitglieder | Anteil Fragen in angezeigten Mehrfach-Themen |
| ------------------------------------------ | :------------: | ----------------- | ----------------: | ------------------: | -------------------------------------------: |
| Gesamtset (de/en/fr/es), Session-Locale de |       ✓        | ready             |                12 |                  11 |                                       75.0 % |
| nur Deutsch                                |       ✓        | ready             |                10 |                   4 |                                       60.0 % |
| nur Englisch                               |       ✓        | ready             |                 7 |                   2 |                                       44.4 % |
| nur Französisch                            |       ✓        | fallback (Locale) |                 5 |                   1 |                                       33.3 % |
| nur Spanisch                               |       –        | fallback (Locale) |                 6 |                   0 |                                        0.0 % |

## 3. Ähnlichkeitsverteilung (Kosinus, Gesamtset)

| Paare                 |   n |   min |   p10 | Median |   p90 |   max |
| --------------------- | --: | ----: | ----: | -----: | ----: | ----: |
| gleiche Familie       |  93 | 0.737 | 0.778 |  0.848 | 0.908 | 0.922 |
| verschiedene Familien | 537 | 0.674 | 0.709 |  0.753 | 0.800 | 0.880 |

Paare verschiedener Familien ≥ 0.87: 1 · Paare gleicher Familie < 0.87: 65 von 93

## 4. Schwellen-Sweep (Encoder)

**Gesamtset (de/en/fr/es), Session-Locale de**

| Schwelle |   ARI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 | Falsch-Merge-Paare | Paar-Recall sprachübergr. |
| -------: | ----: | -------: | -------: | --------: | --------: | -----------------: | ------------------------: |
|     0.80 | 0.645 |  100.0 % |   61.1 % |    75.9 % |        10 |                  0 |                    52.6 % |
|     0.82 | 0.645 |  100.0 % |   61.1 % |    75.9 % |        10 |                  0 |                    52.6 % |
|     0.84 | 0.563 |  100.0 % |   54.1 % |    70.2 % |        11 |                  0 |                    42.3 % |
|     0.85 | 0.423 |  100.0 % |   42.7 % |    59.8 % |        12 |                  0 |                    30.8 % |
|     0.86 | 0.346 |  100.0 % |   37.0 % |    54.0 % |        12 |                  0 |                    23.1 % |
|   0.87 ◀ | 0.332 |  100.0 % |   35.9 % |    52.8 % |        11 |                  0 |                    23.1 % |
|     0.88 | 0.262 |  100.0 % |   31.3 % |    47.6 % |        10 |                  0 |                    16.7 % |
|     0.89 | 0.232 |  100.0 % |   29.7 % |    45.8 % |         8 |                  0 |                    15.4 % |
|     0.90 | 0.088 |  100.0 % |   21.3 % |    35.1 % |         5 |                  0 |                     6.4 % |
|     0.92 | 0.054 |  100.0 % |   19.7 % |    32.9 % |         3 |                  0 |                     3.8 % |

**nur Deutsch**

| Schwelle |   ARI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 | Falsch-Merge-Paare | Paar-Recall sprachübergr. |
| -------: | ----: | -------: | -------: | --------: | --------: | -----------------: | ------------------------: |
|     0.80 | 0.836 |   86.7 % |  100.0 % |    92.9 % |         5 |                  4 |                         – |
|     0.82 | 1.000 |  100.0 % |  100.0 % |   100.0 % |         6 |                  0 |                         – |
|     0.84 | 0.899 |  100.0 % |   91.1 % |    95.3 % |         6 |                  0 |                         – |
|     0.85 | 0.713 |  100.0 % |   77.8 % |    87.5 % |         5 |                  0 |                         – |
|     0.86 | 0.713 |  100.0 % |   77.8 % |    87.5 % |         5 |                  0 |                         – |
|   0.87 ◀ | 0.639 |  100.0 % |   71.1 % |    83.1 % |         4 |                  0 |                         – |
|     0.88 | 0.559 |  100.0 % |   64.4 % |    78.4 % |         3 |                  0 |                         – |
|     0.89 | 0.262 |  100.0 % |   51.1 % |    67.6 % |         2 |                  0 |                         – |
|     0.90 | 0.000 |  100.0 % |   40.0 % |    57.1 % |         0 |                  0 |                         – |
|     0.92 | 0.000 |  100.0 % |   40.0 % |    57.1 % |         0 |                  0 |                         – |

**Sweep über 10 inkrementelle Läufe** – BCubed F1 bzw. Falsch-Merge-Paare, Median [min–max]

| Schwelle | Gesamtset F1           | Gesamtset Falsch-Merges | Deutsch F1              | Deutsch Falsch-Merges |
| -------: | ---------------------- | ----------------------- | ----------------------- | --------------------- |
|     0.80 | 75.2 % [74.6 %–81.7 %] | 0 [0–0]                 | 92.9 % [92.9 %–92.9 %]  | 4 [4–4]               |
|     0.82 | 74.6 % [74.6 %–75.9 %] | 0 [0–0]                 | 95.3 % [95.3 %–100.0 %] | 0 [0–0]               |
|     0.84 | 70.2 % [62.1 %–72.9 %] | 0 [0–0]                 | 95.3 % [92.9 %–95.3 %]  | 0 [0–0]               |
|     0.85 | 59.8 % [57.5 %–60.6 %] | 0 [0–0]                 | 87.5 % [87.5 %–92.9 %]  | 0 [0–0]               |
|     0.86 | 54.0 % [54.0 %–54.8 %] | 0 [0–0]                 | 87.5 % [87.5 %–87.5 %]  | 0 [0–0]               |
|   0.87 ◀ | 53.8 % [52.8 %–54.8 %] | 0 [0–0]                 | 83.1 % [78.4 %–87.5 %]  | 0 [0–0]               |
|     0.88 | 47.6 % [45.8 %–50.2 %] | 0 [0–0]                 | 71.4 % [71.4 %–78.4 %]  | 0 [0–0]               |
|     0.89 | 45.1 % [43.5 %–45.8 %] | 0 [0–0]                 | 64.7 % [61.5 %–67.6 %]  | 0 [0–0]               |
|     0.90 | 38.2 % [36.6 %–40.1 %] | 0 [0–0]                 | 57.1 % [57.1 %–57.1 %]  | 0 [0–0]               |
|     0.92 | 31.3 % [30.2 %–32.9 %] | 0 [0–0]                 | 57.1 % [57.1 %–57.1 %]  | 0 [0–0]               |

## 5. Gefundene Themen im Gesamtset (eine Gesamtanfrage)

**Encoder** (nur Themen mit ≥ 2 Mitgliedern; ✗ = mischt Familien)

| Label                                                                       | Konfidenz | Mitglieder       | Familien |
| --------------------------------------------------------------------------- | --------: | ---------------- | -------- |
| Pourquoi la république de Weimar a-t-elle échoué ?                          |     0.906 | Q541, Q543, Q544 | H-WEIMAR |
| Qu'a changé concrètement la paix de Westphalie ?                            |      0.91 | Q558, Q555, Q557 | H-WESTF  |
| ¿Hay que inscribirse antes de la visita al archivo?                         |     0.907 | Q559, Q562, Q563 | H-ARCH   |
| Beim Öffnen der digitalen Zeitungsarchive kommt nur eine Fehlerseite.       |     0.892 | Q569, Q570       | H-DB     |
| Ist ein Schulbuch von 1935 eine Primär- oder eine Sekundärquelle?           |     0.891 | Q545, Q547       | H-SOURCE |
| How long should the term paper be, and when is it due?                      |      0.89 | Q566, Q567       | H-ESSAY  |
| Warum gilt der Westfälische Frieden als Beginn des modernen Staatensystems? |     0.888 | Q553, Q556       | H-WESTF  |
| Was hat der Westfälische Frieden von 1648 konkret verändert?                |     0.881 | Q552, Q554       | H-WESTF  |
| La base de données de presse ne s'ouvre pas.                                |     0.906 | Q573, Q571, Q572 | H-DB     |
| Was Article 48 the main reason Weimar collapsed?                            |     0.878 | Q540, Q542       | H-WEIMAR |
| What's the difference between a primary and a secondary source?             |     0.891 | Q551, Q548, Q550 | H-SOURCE |

**Lexikalisch** (nur Themen mit ≥ 2 Mitgliedern; ✗ = mischt Familien)

| Label                  | Konfidenz | Mitglieder                   | Familien       |
| ---------------------- | --------: | ---------------------------- | -------------- |
| Weimar                 |         – | Q544, Q539, Q543, Q542, Q541 | H-WEIMAR       |
| archive                |         – | Q562, Q561, Q571             | ✗ H-ARCH, H-DB |
| source                 |         – | Q549, Q550, Q548             | H-SOURCE       |
| Westfälische Frieden   |         – | Q553, Q552, Q554             | H-WESTF        |
| base                   |         – | Q573, Q572                   | H-DB           |
| Hausarbeit             |         – | Q565, Q564                   | H-ESSAY        |
| Primär- Sekundärquelle |         – | Q547, Q545                   | H-SOURCE       |
| Republik               |         – | Q538, Q540                   | H-WEIMAR       |
| Westphalia             |         – | Q555, Q556                   | H-WESTF        |

## 6. Falsch zusammengeführte Paare (Encoder, Gesamtset)

- keine

## 7. Laufzeit und Ressourcen

Kaltstart Container → /health: 1.7 s · erster Embed-Aufruf (36 Texte): 579 ms · Image 1497 MB · Container nach Last: 473.7MiB / 2GiB|8.66%

| Texte pro Anfrage |    p50 |    p95 |    max | ms/Text (p50) |
| ----------------: | -----: | -----: | -----: | ------------: |
|                16 | 302 ms | 391 ms | 391 ms |          18.9 |
|                56 | 687 ms | 699 ms | 699 ms |          12.3 |
|                36 | 684 ms | 701 ms | 701 ms |          19.0 |

Clustering in Node (naive Complete-Linkage, ein Thread):

| Texte |    Zeit |
| ----: | ------: |
|   100 |   50 ms |
|   250 |  362 ms |
|   500 | 2054 ms |

## Gültigkeitsgrenzen

- Synthetisches Referenzset; ein Annotator; Familien sind sprachunabhängig definiert.
- Laborbetrieb über loopback-HTTP statt Unix-Socket; Transport-Overhead daher nicht produktionsgleich.
- Embedding-Cache der App (Redis/In-Process) nicht genutzt: Latenzen sind Kaltpfad-Werte je Anfrage.
- Themenhäufigkeit ist kein Lernstandsmaß.
