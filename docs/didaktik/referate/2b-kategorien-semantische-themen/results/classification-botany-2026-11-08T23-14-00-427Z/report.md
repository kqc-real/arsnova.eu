# Referat 2B – Klassifikationsmessung 8.9b

Commit `74091b0a6468` (v1.3.0-364-g74091b0a-dirty), Referenzset 2.2.0 (SHA-256 `717bdb17dc2e94d5…`), 2026-11-08T23:14:00.427Z
Node v24.22.2, Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz × 8, 31.9 GB RAM, win32 10.0.19045 x64

Umfang: 37 von 723 Items, Domäne botany, Sprachen de, en, fr, es (+ mixed); Italienisch ausgeschlossen (Untersuchungsumfang an Wortwolken-Locales angeglichen).

Gelabelt: 37 Items · erwartet unsicher (mehrdeutig/Rauschen): 0 · Betriebspunkt `QA_NLP_MIN_CONFIDENCE` = 0.55

## 1. Hauptergebnis (Originalschreibung, Betriebspunkt)

| System                                 | Best-Guess-Acc. | Macro-F1 | Abdeckung | Präzision akzeptiert | Nutzbar korrekt | Falsch akzeptiert | Enthaltung mehrdeutig/Rauschen |
| -------------------------------------- | --------------: | -------: | --------: | -------------------: | --------------: | ----------------: | -----------------------------: |
| Keyword-Baseline (regelbasiert)        |          64.9 % |    0.501 |    13.5 % |              100.0 % |          13.5 % |             0.0 % |                          0.0 % |
| Gatekeeper (Naive Bayes, nur Schwelle) |          62.2 % |    0.592 |    89.2 % |               60.6 % |          54.1 % |            35.1 % |                          0.0 % |
| Kaskade 1.3 (Gatekeeper + k-NN)        |          64.9 % |    0.616 |    91.9 % |               64.7 % |          59.5 % |            32.4 % |                          0.0 % |

_Nutzbar korrekt_ = akzeptiert und richtig, bezogen auf alle gelabelten Items. _Falsch akzeptiert_ = Lehrperson sieht eine sichere, aber falsche Kategorie.

### 95-%-Bootstrap-Intervalle

| System                                 | Nutzbar korrekt  | Präzision akzeptiert | Abdeckung         | Macro-F1       |
| -------------------------------------- | ---------------- | -------------------- | ----------------- | -------------- |
| Keyword-Baseline (regelbasiert)        | [2.7 %; 24.3 %]  | [100.0 %; 100.0 %]   | [2.7 %; 24.3 %]   | [0.262; 0.689] |
| Gatekeeper (Naive Bayes, nur Schwelle) | [37.8 %; 70.3 %] | [43.8 %; 77.4 %]     | [78.4 %; 97.3 %]  | [0.414; 0.753] |
| Kaskade 1.3 (Gatekeeper + k-NN)        | [43.2 %; 75.7 %] | [47.2 %; 80.6 %]     | [81.1 %; 100.0 %] | [0.432; 0.777] |

### Paarvergleich (exakter McNemar-Test, gepaart über dieselben Items)

| Vergleich             | Merkmal            | nur A richtig | nur B richtig |      p |
| --------------------- | ------------------ | ------------: | ------------: | -----: |
| cascade vs keyword    | nutzbar korrekt    |            18 |             1 | 0.0001 |
| cascade vs keyword    | Best-Guess korrekt |            11 |            11 | 1.0000 |
| gatekeeper vs keyword | nutzbar korrekt    |            16 |             1 | 0.0003 |
| gatekeeper vs keyword | Best-Guess korrekt |            11 |            12 | 1.0000 |
| cascade vs gatekeeper | nutzbar korrekt    |             2 |             0 | 0.5000 |
| cascade vs gatekeeper | Best-Guess korrekt |             1 |             0 | 1.0000 |

Kaskadenpfade: early-exit 32, fallback 5

## 2. Schwellen-Sweep

Vorab festgelegte Kriterien (Releasekonstanten): Präzision akzeptiert ≥ 80.0 %, Unsicher-Rate ≤ 30.0 %.

**Keyword-Baseline (regelbasiert)**

| Schwelle | Abdeckung | Präzision akz. | Nutzbar korrekt | Falsch akz. | Enthaltung mehrd. | Kriterien |
| -------: | --------: | -------------: | --------------: | ----------: | ----------------: | :-------: |
|     0.35 |    13.5 % |        100.0 % |          13.5 % |       0.0 % |             0.0 % |     –     |
|     0.40 |    13.5 % |        100.0 % |          13.5 % |       0.0 % |             0.0 % |     –     |
|     0.45 |    13.5 % |        100.0 % |          13.5 % |       0.0 % |             0.0 % |     –     |
|     0.50 |    13.5 % |        100.0 % |          13.5 % |       0.0 % |             0.0 % |     –     |
|   0.55 ◀ |    13.5 % |        100.0 % |          13.5 % |       0.0 % |             0.0 % |     –     |
|     0.60 |    13.5 % |        100.0 % |          13.5 % |       0.0 % |             0.0 % |     –     |
|     0.65 |    13.5 % |        100.0 % |          13.5 % |       0.0 % |             0.0 % |     –     |
|     0.70 |    13.5 % |        100.0 % |          13.5 % |       0.0 % |             0.0 % |     –     |
|     0.80 |    13.5 % |        100.0 % |          13.5 % |       0.0 % |             0.0 % |     –     |
|     0.90 |    13.5 % |        100.0 % |          13.5 % |       0.0 % |             0.0 % |     –     |

**Gatekeeper (Naive Bayes, nur Schwelle)**

| Schwelle | Abdeckung | Präzision akz. | Nutzbar korrekt | Falsch akz. | Enthaltung mehrd. | Kriterien |
| -------: | --------: | -------------: | --------------: | ----------: | ----------------: | :-------: |
|     0.35 |   100.0 % |         62.2 % |          62.2 % |      37.8 % |             0.0 % |     –     |
|     0.40 |   100.0 % |         62.2 % |          62.2 % |      37.8 % |             0.0 % |     –     |
|     0.45 |   100.0 % |         62.2 % |          62.2 % |      37.8 % |             0.0 % |     –     |
|     0.50 |    97.3 % |         61.1 % |          59.5 % |      37.8 % |             0.0 % |     –     |
|   0.55 ◀ |    89.2 % |         60.6 % |          54.1 % |      35.1 % |             0.0 % |     –     |
|     0.60 |    89.2 % |         60.6 % |          54.1 % |      35.1 % |             0.0 % |     –     |
|     0.65 |    89.2 % |         60.6 % |          54.1 % |      35.1 % |             0.0 % |     –     |
|     0.70 |    83.8 % |         61.3 % |          51.4 % |      32.4 % |             0.0 % |     –     |
|     0.80 |    70.3 % |         65.4 % |          45.9 % |      24.3 % |             0.0 % |     –     |
|     0.90 |    62.2 % |         69.6 % |          43.2 % |      18.9 % |             0.0 % |     –     |

**Kaskade 1.3 (Gatekeeper + k-NN)**

| Schwelle | Abdeckung | Präzision akz. | Nutzbar korrekt | Falsch akz. | Enthaltung mehrd. | Kriterien |
| -------: | --------: | -------------: | --------------: | ----------: | ----------------: | :-------: |
|     0.35 |    89.2 % |         63.6 % |          56.8 % |      32.4 % |             0.0 % |     –     |
|     0.40 |    89.2 % |         63.6 % |          56.8 % |      32.4 % |             0.0 % |     –     |
|     0.45 |    89.2 % |         63.6 % |          56.8 % |      32.4 % |             0.0 % |     –     |
|     0.50 |    89.2 % |         63.6 % |          56.8 % |      32.4 % |             0.0 % |     –     |
|   0.55 ◀ |    91.9 % |         64.7 % |          59.5 % |      32.4 % |             0.0 % |     –     |
|     0.60 |    91.9 % |         64.7 % |          59.5 % |      32.4 % |             0.0 % |     –     |
|     0.65 |    91.9 % |         64.7 % |          59.5 % |      32.4 % |             0.0 % |     –     |
|     0.70 |    91.9 % |         67.6 % |          62.2 % |      29.7 % |             0.0 % |     –     |
|     0.80 |    89.2 % |         66.7 % |          59.5 % |      29.7 % |             0.0 % |     –     |
|     0.90 |    86.5 % |         68.8 % |          59.5 % |      27.0 % |             0.0 % |     –     |

## 3. Slices (Betriebspunkt)

**Sprache** – nutzbar korrekt / falsch akzeptiert (n)

| Sprache |   n | keyword        | gatekeeper      | cascade         |
| ------- | --: | -------------- | --------------- | --------------- |
| de      |  16 | 18.8 % / 0.0 % | 43.8 % / 43.8 % | 50.0 % / 37.5 % |
| en      |   9 | 22.2 % / 0.0 % | 55.6 % / 33.3 % | 55.6 % / 33.3 % |
| fr      |   6 | 0.0 % / 0.0 %  | 50.0 % / 50.0 % | 50.0 % / 50.0 % |
| es      |   6 | 0.0 % / 0.0 %  | 83.3 % / 0.0 %  | 100.0 % / 0.0 % |

**Tag** – nutzbar korrekt / falsch akzeptiert (n)

| Tag           |   n | keyword        | gatekeeper      | cascade         |
| ------------- | --: | -------------- | --------------- | --------------- |
| canonical     |  23 | 13.0 % / 0.0 % | 65.2 % / 26.1 % | 69.6 % / 26.1 % |
| out-of-domain |  37 | 13.5 % / 0.0 % | 54.1 % / 35.1 % | 59.5 % / 32.4 % |
| typo          |   1 | 0.0 % / 0.0 %  | 0.0 % / 100.0 % | 0.0 % / 100.0 % |
| short         |   1 | 0.0 % / 0.0 %  | 0.0 % / 100.0 % | 0.0 % / 0.0 %   |

**Gold-Kategorie** – nutzbar korrekt / falsch akzeptiert (n)

| Gold-Kategorie |   n | keyword        | gatekeeper      | cascade         |
| -------------- | --: | -------------- | --------------- | --------------- |
| content        |  21 | 9.5 % / 0.0 %  | 38.1 % / 47.6 % | 47.6 % / 42.9 % |
| organization   |  11 | 9.1 % / 0.0 %  | 81.8 % / 9.1 %  | 81.8 % / 9.1 %  |
| technical      |   5 | 40.0 % / 0.0 % | 60.0 % / 40.0 % | 60.0 % / 40.0 % |

## 4. Kalibrierung der Konfidenz

**Gatekeeper (Naive Bayes, nur Schwelle)** – ECE 0.306

| Konfidenzbereich |   n | mittlere Konfidenz | tatsächliche Acc. |
| ---------------- | --: | -----------------: | ----------------: |
| [0.00, 0.40)     |   0 |                  – |                 – |
| [0.40, 0.55)     |   4 |              0.520 |            75.0 % |
| [0.55, 0.70)     |   2 |              0.696 |            50.0 % |
| [0.70, 0.85)     |   6 |              0.777 |            50.0 % |
| [0.85, 1.00]     |  25 |              0.974 |            64.0 % |

**Kaskade 1.3 (Gatekeeper + k-NN)** – ECE 0.306

| Konfidenzbereich |   n | mittlere Konfidenz | tatsächliche Acc. |
| ---------------- | --: | -----------------: | ----------------: |
| [0.00, 0.40)     |   0 |                  – |                 – |
| [0.40, 0.55)     |   2 |              0.545 |           100.0 % |
| [0.55, 0.70)     |   4 |              0.648 |            75.0 % |
| [0.70, 0.85)     |   6 |              0.777 |            50.0 % |
| [0.85, 1.00]     |  25 |              0.974 |            64.0 % |

## 5. Kontrollierte Variante: Transliteration

Seed und Keyword-Liste sind transliteriert. Gleiche Items, DE/mixed mit ä→ae usw.

| System                                 | Nutzbar korrekt (orig → translit) | Falsch akzeptiert (orig → translit) | Macro-F1 (orig → translit) |
| -------------------------------------- | --------------------------------- | ----------------------------------- | -------------------------- |
| Keyword-Baseline (regelbasiert)        | 13.5 % → 13.5 %                   | 0.0 % → 0.0 %                       | 0.501 → 0.501              |
| Gatekeeper (Naive Bayes, nur Schwelle) | 54.1 % → 56.8 %                   | 35.1 % → 35.1 %                     | 0.592 → 0.616              |
| Kaskade 1.3 (Gatekeeper + k-NN)        | 59.5 % → 56.8 %                   | 32.4 % → 35.1 %                     | 0.616 → 0.616              |

## 6. Laufzeit und Ressourcen

Kaltstart: Gatekeeper-Training 5.00 ms, k-NN-Prototypen 6.17 ms, Heap-Δ 19.1 MB, RSS-Δ 38.0 MB (inkl. Modulimport).

Warm, 20 Durchläufe × 37 Texte, ein Thread:

| System                                 |   p50 |    p95 |    p99 |     max | Durchsatz/s |
| -------------------------------------- | ----: | -----: | -----: | ------: | ----------: |
| Keyword-Baseline (regelbasiert)        |  8 µs |  11 µs |  19 µs |   27 µs |     114.164 |
| Gatekeeper (Naive Bayes, nur Schwelle) | 18 µs |  29 µs |  66 µs |   76 µs |      47.948 |
| Kaskade 1.3 (Gatekeeper + k-NN)        | 28 µs | 209 µs | 436 µs | 2.30 ms |      14.077 |

Produktions-Timeout je Job: 2000 ms (Queue/Worker-Overhead hier nicht gemessen).

## 7. Fehlerfälle (Betriebspunkt, Originalschreibung)

**Keyword-Baseline (regelbasiert)** – 0 sicher, aber falsch bzw. trotz Mehrdeutigkeit akzeptiert

**Gatekeeper (Naive Bayes, nur Schwelle)** – 13 sicher, aber falsch bzw. trotz Mehrdeutigkeit akzeptiert

| ID   | Text                                                                                | Gold         | Vorhersage   | Konfidenz |
| ---- | ----------------------------------------------------------------------------------- | ------------ | ------------ | --------: |
| Q502 | Wozu braucht der Calvin-Zyklus eigentlich das ATP aus der Lichtreaktion?            | content      | technical    |     0.750 |
| Q503 | lichtreaktion vs calvin zyklus versteh ich nicht                                    | content      | technical    |     0.998 |
| Q506 | Pouvez-vous réexpliquer le lien entre la phase lumineuse et le cycle de Calvin ?    | content      | technical    |     0.886 |
| Q508 | Woran erkenne ich, ob eine Pflanze monokotyl oder dikotyl ist?                      | content      | organization |     0.993 |
| Q509 | Ist die parallele Blattaderung wirklich das sicherste Merkmal für Einkeimblättrige? | content      | organization |     0.992 |
| Q510 | Einkeimblättrig oder zweikeimblättrig – wie bestimmen?                              | content      | organization |     0.998 |
| Q511 | How do I tell monocots from dicots?                                                 | content      | organization |     0.754 |
| Q512 | Are parallel leaf veins always a sign of a monocot?                                 | content      | technical    |     0.698 |
| Q518 | How does water get from the roots up to the leaves?                                 | content      | organization |     0.952 |
| Q520 | Comment l'eau monte-t-elle des racines jusqu'aux feuilles ?                         | content      | technical    |     0.990 |
| Q523 | Ist die Exkursion zum Botanischen Garten verpflichtend?                             | organization | content      |     0.990 |
| Q534 | Die Übertragung vom Mikroskop ist nur noch schwarz.                                 | technical    | content      |     0.752 |
| Q536 | La caméra du microscope n'affiche rien sur l'écran.                                 | technical    | organization |     0.862 |

**Kaskade 1.3 (Gatekeeper + k-NN)** – 12 sicher, aber falsch bzw. trotz Mehrdeutigkeit akzeptiert

| ID   | Text                                                                                | Gold         | Vorhersage   | Konfidenz |
| ---- | ----------------------------------------------------------------------------------- | ------------ | ------------ | --------: |
| Q502 | Wozu braucht der Calvin-Zyklus eigentlich das ATP aus der Lichtreaktion?            | content      | technical    |     0.750 |
| Q503 | lichtreaktion vs calvin zyklus versteh ich nicht                                    | content      | technical    |     0.998 |
| Q506 | Pouvez-vous réexpliquer le lien entre la phase lumineuse et le cycle de Calvin ?    | content      | technical    |     0.886 |
| Q508 | Woran erkenne ich, ob eine Pflanze monokotyl oder dikotyl ist?                      | content      | organization |     0.993 |
| Q509 | Ist die parallele Blattaderung wirklich das sicherste Merkmal für Einkeimblättrige? | content      | organization |     0.992 |
| Q511 | How do I tell monocots from dicots?                                                 | content      | organization |     0.754 |
| Q512 | Are parallel leaf veins always a sign of a monocot?                                 | content      | technical    |     0.698 |
| Q518 | How does water get from the roots up to the leaves?                                 | content      | organization |     0.952 |
| Q520 | Comment l'eau monte-t-elle des racines jusqu'aux feuilles ?                         | content      | technical    |     0.990 |
| Q523 | Ist die Exkursion zum Botanischen Garten verpflichtend?                             | organization | content      |     0.990 |
| Q534 | Die Übertragung vom Mikroskop ist nur noch schwarz.                                 | technical    | content      |     0.752 |
| Q536 | La caméra du microscope n'affiche rien sur l'écran.                                 | technical    | organization |     0.862 |

## Gültigkeitsgrenzen

- Synthetisches, kleines Referenzset (Bootstrap-Intervalle beachten); keine Aussage über reale Hörsaalverteilung.
- Konfidenz ist ohne Kalibrierung keine Erfolgswahrscheinlichkeit (siehe ECE).
- Gemessen ist die In-Process-Klassifikation, nicht Queue, Persistenz oder Worker-Latenz.
