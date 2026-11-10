# Referat 2B – Themenmessung 1.14c (Encoder vs. lexikalisch)

Commit `84a5614ead76` (v1.3.0-326-g84a5614e-dirty), Referenzset 2.2.0 (SHA-256 `717bdb17dc2e94d5…`), 2026-11-04T17:01:29.208Z
Modell `intfloat/multilingual-e5-small` / `intfloat/multilingual-e5-small@sha256:f80102d3f2a1229f`, 384 Dimensionen · Container-Limits cpus=1000000000 mem=2147483648 · loopback HTTP http://127.0.0.1:8790/embed (Labor; Produktion: Unix-Socket, network_mode none)

Umfang: 37 von 723 Items, Domäne botany, Sprachen de, en, fr, es (+ mixed). Italienisch ausgeschlossen, weil die Wortwolke es nicht unterstützt (WORD_CLOUD_LEMMA_LOCALES).

Goldstandard: Themenfamilien des Referenzsets; Near-Miss-, mehrdeutige und Rausch-Items sind Einzelthemen.

## 1. Hauptergebnis

| Teilmenge                                  |   n | System      |   ARI |   NMI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 (Gold) | Falsch-Merge-Paare | Paar-Recall einsprachig | Paar-Recall sprachübergreifend |
| ------------------------------------------ | --: | ----------- | ----: | ----: | -------: | -------: | --------: | ---------------- | -----------------: | ----------------------: | -----------------------------: |
| Gesamtset (de/en/fr/es), Session-Locale de |  37 | Encoder     | 0.317 | 0.758 |  100.0 % |   34.8 % |    51.6 % | 13 (6)           |                  0 |                  52.9 % |                         14.8 % |
| Gesamtset (de/en/fr/es), Session-Locale de |  37 | Lexikalisch | 0.278 | 0.699 |   91.9 % |   32.5 % |    48.0 % | 9 (6)            |                  3 |                  41.2 % |                         14.8 % |
| nur Deutsch                                |  16 | Encoder     | 0.639 | 0.889 |  100.0 % |   70.8 % |    82.9 % | 5 (6)            |                  0 |                  50.0 % |                              – |
| nur Deutsch                                |  16 | Lexikalisch | 0.639 | 0.877 |  100.0 % |   68.8 % |    81.5 % | 3 (6)            |                  0 |                  50.0 % |                              – |
| nur Englisch                               |   9 | Encoder     | 0.786 | 0.957 |  100.0 % |   88.9 % |    94.1 % | 2 (3)            |                  0 |                  66.7 % |                              – |
| nur Englisch                               |   9 | Lexikalisch | 0.478 | 0.918 |  100.0 % |   77.8 % |    87.5 % | 1 (3)            |                  0 |                  33.3 % |                              – |
| nur Französisch ⚠ †                        |   6 | Encoder     | 1.000 | 1.000 |  100.0 % |  100.0 % |   100.0 % | 0 (0)            |                  0 |                       – |                              – |
| nur Französisch †                          |   6 | Lexikalisch | 1.000 | 1.000 |  100.0 % |  100.0 % |   100.0 % | 0 (0)            |                  0 |                       – |                              – |
| nur Spanisch ⚠ †                           |   6 | Encoder     | 1.000 | 1.000 |  100.0 % |  100.0 % |   100.0 % | 0 (0)            |                  0 |                       – |                              – |
| nur Spanisch †                             |   6 | Lexikalisch | 1.000 | 1.000 |  100.0 % |  100.0 % |   100.0 % | 0 (0)            |                  0 |                       – |                              – |

† Nicht aussagekräftig: In dieser Teilmenge hat keine Familie zwei Mitglieder derselben Sprache. ARI ist dann 0, BCubed belohnt bloßes Nicht-Zusammenfassen. Nur Gesamtset und Deutsch tragen eine Aussage; für Einsprachigkeit in en/fr/es wären mehr Items je Sprache nötig.

⚠ Session-Locale nicht in `WORD_CLOUD_SEMANTIC_LOCALES` (de, en): Das Produkt ruft den Encoder dort **nicht** auf und zeigt den lexikalischen Fallback. Encoderwerte zeigen nur das ungenutzte Potenzial.

### Stabilität über die Batch-Zusammensetzung

Das Embedding einer Frage hängt von den anderen Texten derselben Anfrage ab (Vektor-Drift 1 − cos: Median 2.7e-3, max 5.7e-3). Vermutete Ursache: quantisiertes ONNX-Modell (nicht verifiziert). Tabelle 1 oben zeigt **eine** Gesamtanfrage; hier 10 Läufe mit zufälliger Reihenfolge und Anfragegrößen 5–40 (simuliert inkrementelles Einbetten). Werte: Median [min–max].

| Teilmenge                                  | Encoder ARI         | Encoder BCubed F1         | Falsch-Merge-Paare | Themen ≥2  | Lexikalisch ARI (deterministisch) |
| ------------------------------------------ | ------------------- | ------------------------- | ------------------ | ---------- | --------------------------------: |
| Gesamtset (de/en/fr/es), Session-Locale de | 0.317 [0.317–0.317] | 51.6 % [51.6 %–51.6 %]    | 0 [0–0]            | 13 [13–13] |                             0.278 |
| nur Deutsch                                | 0.639 [0.639–0.639] | 82.9 % [82.9 %–82.9 %]    | 0 [0–0]            | 5 [5–5]    |                             0.639 |
| nur Englisch                               | 0.786 [0.786–0.786] | 94.1 % [94.1 %–94.1 %]    | 0 [0–0]            | 2 [2–2]    |                             0.478 |
| nur Französisch †                          | 1.000 [1.000–1.000] | 100.0 % [100.0 %–100.0 %] | 0 [0–0]            | 0 [0–0]    |                             1.000 |
| nur Spanisch †                             | 1.000 [1.000–1.000] | 100.0 % [100.0 %–100.0 %] | 0 [0–0]            | 0 [0–0]    |                             1.000 |

## 2. Produktansicht (Gate, Top-12, Status)

| Teilmenge                                  | Gate bestanden | Status            | angezeigte Themen | davon ≥2 Mitglieder | Anteil Fragen in angezeigten Mehrfach-Themen |
| ------------------------------------------ | :------------: | ----------------- | ----------------: | ------------------: | -------------------------------------------: |
| Gesamtset (de/en/fr/es), Session-Locale de |       ✓        | ready             |                12 |                  12 |                                       75.7 % |
| nur Deutsch                                |       ✓        | ready             |                10 |                   5 |                                       68.8 % |
| nur Englisch                               |       ✓        | ready             |                 7 |                   2 |                                       44.4 % |
| nur Französisch                            |       –        | fallback (Locale) |                 6 |                   0 |                                        0.0 % |
| nur Spanisch                               |       –        | fallback (Locale) |                 6 |                   0 |                                        0.0 % |

## 3. Ähnlichkeitsverteilung (Kosinus, Gesamtset)

| Paare                 |   n |   min |   p10 | Median |   p90 |   max |
| --------------------- | --: | ----: | ----: | -----: | ----: | ----: |
| gleiche Familie       |  98 | 0.731 | 0.774 |  0.851 | 0.902 | 0.954 |
| verschiedene Familien | 568 | 0.680 | 0.729 |  0.765 | 0.805 | 0.869 |

Paare verschiedener Familien ≥ 0.87: 0 · Paare gleicher Familie < 0.87: 62 von 98

## 4. Schwellen-Sweep (Encoder)

**Gesamtset (de/en/fr/es), Session-Locale de**

| Schwelle |   ARI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 | Falsch-Merge-Paare | Paar-Recall sprachübergr. |
| -------: | ----: | -------: | -------: | --------: | --------: | -----------------: | ------------------------: |
|     0.80 | 0.771 |  100.0 % |   73.4 % |    84.6 % |         9 |                  0 |                    66.7 % |
|     0.82 | 0.571 |  100.0 % |   54.5 % |    70.6 % |        12 |                  0 |                    39.5 % |
|     0.84 | 0.551 |  100.0 % |   52.7 % |    69.0 % |        12 |                  0 |                    39.5 % |
|     0.85 | 0.418 |  100.0 % |   42.8 % |    60.0 % |        12 |                  0 |                    24.7 % |
|     0.86 | 0.317 |  100.0 % |   34.8 % |    51.6 % |        13 |                  0 |                    14.8 % |
|   0.87 ◀ | 0.317 |  100.0 % |   34.8 % |    51.6 % |        13 |                  0 |                    14.8 % |
|     0.88 | 0.304 |  100.0 % |   34.0 % |    50.8 % |        12 |                  0 |                    14.8 % |
|     0.89 | 0.236 |  100.0 % |   29.9 % |    46.0 % |         9 |                  0 |                     9.9 % |
|     0.90 | 0.162 |  100.0 % |   25.4 % |    40.5 % |         6 |                  0 |                     6.2 % |
|     0.92 | 0.116 |  100.0 % |   22.7 % |    37.0 % |         3 |                  0 |                     3.7 % |

**nur Deutsch**

| Schwelle |   ARI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 | Falsch-Merge-Paare | Paar-Recall sprachübergr. |
| -------: | ----: | -------: | -------: | --------: | --------: | -----------------: | ------------------------: |
|     0.80 | 0.804 |   90.6 % |   91.7 % |    91.1 % |         6 |                  3 |                         – |
|     0.82 | 0.688 |   91.7 % |   79.2 % |    85.0 % |         5 |                  2 |                         – |
|     0.84 | 0.639 |  100.0 % |   70.8 % |    82.9 % |         5 |                  0 |                         – |
|     0.85 | 0.639 |  100.0 % |   70.8 % |    82.9 % |         5 |                  0 |                         – |
|     0.86 | 0.639 |  100.0 % |   70.8 % |    82.9 % |         5 |                  0 |                         – |
|   0.87 ◀ | 0.639 |  100.0 % |   70.8 % |    82.9 % |         5 |                  0 |                         – |
|     0.88 | 0.639 |  100.0 % |   70.8 % |    82.9 % |         5 |                  0 |                         – |
|     0.89 | 0.639 |  100.0 % |   70.8 % |    82.9 % |         5 |                  0 |                         – |
|     0.90 | 0.495 |  100.0 % |   60.4 % |    75.3 % |         3 |                  0 |                         – |
|     0.92 | 0.414 |  100.0 % |   54.2 % |    70.3 % |         2 |                  0 |                         – |

**Sweep über 10 inkrementelle Läufe** – BCubed F1 bzw. Falsch-Merge-Paare, Median [min–max]

| Schwelle | Gesamtset F1           | Gesamtset Falsch-Merges | Deutsch F1             | Deutsch Falsch-Merges |
| -------: | ---------------------- | ----------------------- | ---------------------- | --------------------- |
|     0.80 | 84.6 % [84.6 %–84.6 %] | 0 [0–0]                 | 91.1 % [89.0 %–91.1 %] | 3 [3–3]               |
|     0.82 | 74.4 % [70.6 %–80.2 %] | 0 [0–0]                 | 84.7 % [79.9 %–89.0 %] | 2 [2–3]               |
|     0.84 | 69.0 % [68.4 %–69.7 %] | 0 [0–0]                 | 82.9 % [82.9 %–82.9 %] | 0 [0–0]               |
|     0.85 | 58.4 % [56.6 %–66.3 %] | 0 [0–0]                 | 82.9 % [82.9 %–82.9 %] | 0 [0–0]               |
|     0.86 | 51.6 % [51.6 %–51.6 %] | 0 [0–0]                 | 82.9 % [82.9 %–82.9 %] | 0 [0–0]               |
|   0.87 ◀ | 51.6 % [51.6 %–51.6 %] | 0 [0–0]                 | 82.9 % [82.9 %–82.9 %] | 0 [0–0]               |
|     0.88 | 49.9 % [49.0 %–50.8 %] | 0 [0–0]                 | 82.9 % [82.9 %–82.9 %] | 0 [0–0]               |
|     0.89 | 45.1 % [43.4 %–48.2 %] | 0 [0–0]                 | 81.5 % [78.5 %–82.9 %] | 0 [0–0]               |
|     0.90 | 40.0 % [39.4 %–40.5 %] | 0 [0–0]                 | 75.3 % [75.3 %–75.3 %] | 0 [0–0]               |
|     0.92 | 37.0 % [37.0 %–38.0 %] | 0 [0–0]                 | 70.3 % [70.3 %–70.3 %] | 0 [0–0]               |

## 5. Gefundene Themen im Gesamtset (eine Gesamtanfrage)

**Encoder** (nur Themen mit ≥ 2 Mitgliedern; ✗ = mischt Familien)

| Label                                                                                 | Konfidenz | Mitglieder       | Familien |
| ------------------------------------------------------------------------------------- | --------: | ---------------- | -------- |
| La caméra du microscope n'affiche rien sur l'écran.                                   |     0.942 | Q537, Q535, Q536 | B-MICRO  |
| Wann ist die Exkursion in den Botanischen Garten und wo treffen wir uns?              |     0.932 | Q522, Q523       | B-TRIP   |
| Können Sie den Unterschied zwischen Lichtreaktion und Calvin-Zyklus nochmal erklären? |     0.937 | Q502, Q501, Q503 | B-PHOTO  |
| Pouvez-vous réexpliquer le lien entre la phase lumineuse et le cycle de Calvin ?      |     0.914 | Q506, Q507       | B-PHOTO  |
| Das Bild der Mikroskopkamera kommt auf der Leinwand nicht an.                         |     0.906 | Q533, Q534       | B-MICRO  |
| À quelle heure est le rendez-vous pour la sortie au jardin botanique ?                |     0.896 | Q525, Q526, Q527 | B-TRIP   |
| Ist die parallele Blattaderung wirklich das sicherste Merkmal für Einkeimblättrige?   |     0.891 | Q509, Q510       | B-MONO   |
| Bis wann müssen wir unser Herbarium abgeben?                                          |     0.891 | Q528, Q529       | B-HERB   |
| ¿Cuándo hay que entregar el herbario?                                                 |     0.888 | Q530, Q532       | B-HERB   |
| ¿Cómo se distingue una monocotiledónea de una dicotiledónea?                          |     0.886 | Q513, Q514       | B-MONO   |
| Why does the Calvin cycle need ATP and NADPH?                                         |     0.885 | Q504, Q505       | B-PHOTO  |
| How does water get from the roots up to the leaves?                                   |     0.886 | Q521, Q518, Q520 | B-WATER  |
| Are parallel leaf veins always a sign of a monocot?                                   |     0.875 | Q511, Q512       | B-MONO   |

**Lexikalisch** (nur Themen mit ≥ 2 Mitgliedern; ✗ = mischt Familien)

| Label         | Konfidenz | Mitglieder                   | Familien          |
| ------------- | --------: | ---------------------------- | ----------------- |
| Calvin        |         – | Q507, Q504, Q503, Q506, Q505 | B-PHOTO           |
| Exkursion     |         – | Q524, Q523, Q522             | B-TRIP            |
| Herbarium     |         – | Q528, Q530, Q529             | B-HERB            |
| Comment       |         – | Q513, Q520                   | ✗ B-MONO, B-WATER |
| Cómo          |         – | Q514, Q521                   | ✗ B-MONO, B-WATER |
| Cuándo        |         – | Q527, Q532                   | ✗ B-TRIP, B-HERB  |
| does          |         – | Q518, Q519                   | B-WATER           |
| Lichtreaktion |         – | Q501, Q502                   | B-PHOTO           |
| microscope    |         – | Q536, Q535                   | B-MICRO           |

## 6. Falsch zusammengeführte Paare (Encoder, Gesamtset)

- keine

## 7. Laufzeit und Ressourcen

Kaltstart Container → /health: 1.6 s · erster Embed-Aufruf (37 Texte): 516 ms · Image 1497 MB · Container nach Last: 472.5MiB / 2GiB|8.94%

| Texte pro Anfrage |    p50 |    p95 |    max | ms/Text (p50) |
| ----------------: | -----: | -----: | -----: | ------------: |
|                16 | 297 ms | 492 ms | 492 ms |          18.6 |
|                56 | 618 ms | 711 ms | 711 ms |          11.0 |
|                37 | 683 ms | 702 ms | 702 ms |          18.5 |

Clustering in Node (naive Complete-Linkage, ein Thread):

| Texte |    Zeit |
| ----: | ------: |
|   100 |   51 ms |
|   250 |  363 ms |
|   500 | 2050 ms |

## Gültigkeitsgrenzen

- Synthetisches Referenzset; ein Annotator; Familien sind sprachunabhängig definiert.
- Laborbetrieb über loopback-HTTP statt Unix-Socket; Transport-Overhead daher nicht produktionsgleich.
- Embedding-Cache der App (Redis/In-Process) nicht genutzt: Latenzen sind Kaltpfad-Werte je Anfrage.
- Themenhäufigkeit ist kein Lernstandsmaß.
