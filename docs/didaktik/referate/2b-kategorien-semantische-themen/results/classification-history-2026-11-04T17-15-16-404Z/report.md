# Referat 2B – Klassifikationsmessung 8.9b

Commit `84a5614ead76` (v1.3.0-326-g84a5614e-dirty), Referenzset 2.2.0 (SHA-256 `717bdb17dc2e94d5…`), 2026-11-04T17:15:16.404Z
Node v24.12.0, Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz × 8, 31.9 GB RAM, win32 10.0.19045 x64

Umfang: 36 von 723 Items, Domäne history, Sprachen de, en, fr, es (+ mixed); Italienisch ausgeschlossen (Untersuchungsumfang an Wortwolken-Locales angeglichen).

Gelabelt: 36 Items · erwartet unsicher (mehrdeutig/Rauschen): 0 · Betriebspunkt `QA_NLP_MIN_CONFIDENCE` = 0.55

## 1. Hauptergebnis (Originalschreibung, Betriebspunkt)

| System                                 | Best-Guess-Acc. | Macro-F1 | Abdeckung | Präzision akzeptiert | Nutzbar korrekt | Falsch akzeptiert | Enthaltung mehrdeutig/Rauschen |
| -------------------------------------- | --------------: | -------: | --------: | -------------------: | --------------: | ----------------: | -----------------------------: |
| Keyword-Baseline (regelbasiert)        |          66.7 % |    0.413 |     8.3 % |              100.0 % |           8.3 % |             0.0 % |                          0.0 % |
| Gatekeeper (Naive Bayes, nur Schwelle) |          61.1 % |    0.442 |    94.4 % |               64.7 % |          61.1 % |            33.3 % |                          0.0 % |
| Kaskade 1.3 (Gatekeeper + k-NN)        |          63.9 % |    0.456 |    97.2 % |               62.9 % |          61.1 % |            36.1 % |                          0.0 % |

_Nutzbar korrekt_ = akzeptiert und richtig, bezogen auf alle gelabelten Items. _Falsch akzeptiert_ = Lehrperson sieht eine sichere, aber falsche Kategorie.

### 95-%-Bootstrap-Intervalle

| System                                 | Nutzbar korrekt  | Präzision akzeptiert | Abdeckung         | Macro-F1       |
| -------------------------------------- | ---------------- | -------------------- | ----------------- | -------------- |
| Keyword-Baseline (regelbasiert)        | [0.0 %; 19.4 %]  | [0.0 %; 100.0 %]     | [0.0 %; 19.4 %]   | [0.260; 0.540] |
| Gatekeeper (Naive Bayes, nur Schwelle) | [44.4 %; 77.8 %] | [48.6 %; 80.0 %]     | [86.1 %; 100.0 %] | [0.333; 0.540] |
| Kaskade 1.3 (Gatekeeper + k-NN)        | [44.4 %; 75.0 %] | [47.1 %; 77.8 %]     | [91.7 %; 100.0 %] | [0.348; 0.549] |

### Paarvergleich (exakter McNemar-Test, gepaart über dieselben Items)

| Vergleich             | Merkmal            | nur A richtig | nur B richtig |      p |
| --------------------- | ------------------ | ------------: | ------------: | -----: |
| cascade vs keyword    | nutzbar korrekt    |            19 |             0 | 0.0000 |
| cascade vs keyword    | Best-Guess korrekt |             6 |             7 | 1.0000 |
| gatekeeper vs keyword | nutzbar korrekt    |            19 |             0 | 0.0000 |
| gatekeeper vs keyword | Best-Guess korrekt |             6 |             8 | 0.7905 |
| cascade vs gatekeeper | nutzbar korrekt    |             1 |             1 | 1.0000 |
| cascade vs gatekeeper | Best-Guess korrekt |             1 |             0 | 1.0000 |

Kaskadenpfade: early-exit 32, fallback 4

## 2. Schwellen-Sweep

Vorab festgelegte Kriterien (Releasekonstanten): Präzision akzeptiert ≥ 80.0 %, Unsicher-Rate ≤ 30.0 %.

**Keyword-Baseline (regelbasiert)**

| Schwelle | Abdeckung | Präzision akz. | Nutzbar korrekt | Falsch akz. | Enthaltung mehrd. | Kriterien |
| -------: | --------: | -------------: | --------------: | ----------: | ----------------: | :-------: |
|     0.35 |     8.3 % |        100.0 % |           8.3 % |       0.0 % |             0.0 % |     –     |
|     0.40 |     8.3 % |        100.0 % |           8.3 % |       0.0 % |             0.0 % |     –     |
|     0.45 |     8.3 % |        100.0 % |           8.3 % |       0.0 % |             0.0 % |     –     |
|     0.50 |     8.3 % |        100.0 % |           8.3 % |       0.0 % |             0.0 % |     –     |
|   0.55 ◀ |     8.3 % |        100.0 % |           8.3 % |       0.0 % |             0.0 % |     –     |
|     0.60 |     8.3 % |        100.0 % |           8.3 % |       0.0 % |             0.0 % |     –     |
|     0.65 |     8.3 % |        100.0 % |           8.3 % |       0.0 % |             0.0 % |     –     |
|     0.70 |     8.3 % |        100.0 % |           8.3 % |       0.0 % |             0.0 % |     –     |
|     0.80 |     8.3 % |        100.0 % |           8.3 % |       0.0 % |             0.0 % |     –     |
|     0.90 |     8.3 % |        100.0 % |           8.3 % |       0.0 % |             0.0 % |     –     |

**Gatekeeper (Naive Bayes, nur Schwelle)**

| Schwelle | Abdeckung | Präzision akz. | Nutzbar korrekt | Falsch akz. | Enthaltung mehrd. | Kriterien |
| -------: | --------: | -------------: | --------------: | ----------: | ----------------: | :-------: |
|     0.35 |   100.0 % |         61.1 % |          61.1 % |      38.9 % |             0.0 % |     –     |
|     0.40 |   100.0 % |         61.1 % |          61.1 % |      38.9 % |             0.0 % |     –     |
|     0.45 |   100.0 % |         61.1 % |          61.1 % |      38.9 % |             0.0 % |     –     |
|     0.50 |    97.2 % |         62.9 % |          61.1 % |      36.1 % |             0.0 % |     –     |
|   0.55 ◀ |    94.4 % |         64.7 % |          61.1 % |      33.3 % |             0.0 % |     –     |
|     0.60 |    91.7 % |         66.7 % |          61.1 % |      30.6 % |             0.0 % |     –     |
|     0.65 |    91.7 % |         66.7 % |          61.1 % |      30.6 % |             0.0 % |     –     |
|     0.70 |    80.6 % |         69.0 % |          55.6 % |      25.0 % |             0.0 % |     –     |
|     0.80 |    75.0 % |         70.4 % |          52.8 % |      22.2 % |             0.0 % |     –     |
|     0.90 |    58.3 % |         71.4 % |          41.7 % |      16.7 % |             0.0 % |     –     |

**Kaskade 1.3 (Gatekeeper + k-NN)**

| Schwelle | Abdeckung | Präzision akz. | Nutzbar korrekt | Falsch akz. | Enthaltung mehrd. | Kriterien |
| -------: | --------: | -------------: | --------------: | ----------: | ----------------: | :-------: |
|     0.35 |    91.7 % |         63.6 % |          58.3 % |      33.3 % |             0.0 % |     –     |
|     0.40 |    91.7 % |         63.6 % |          58.3 % |      33.3 % |             0.0 % |     –     |
|     0.45 |    91.7 % |         63.6 % |          58.3 % |      33.3 % |             0.0 % |     –     |
|     0.50 |    94.4 % |         61.8 % |          58.3 % |      36.1 % |             0.0 % |     –     |
|   0.55 ◀ |    97.2 % |         62.9 % |          61.1 % |      36.1 % |             0.0 % |     –     |
|     0.60 |    97.2 % |         62.9 % |          61.1 % |      36.1 % |             0.0 % |     –     |
|     0.65 |    97.2 % |         62.9 % |          61.1 % |      36.1 % |             0.0 % |     –     |
|     0.70 |    91.7 % |         66.7 % |          61.1 % |      30.6 % |             0.0 % |     –     |
|     0.80 |    91.7 % |         69.7 % |          63.9 % |      27.8 % |             0.0 % |     –     |
|     0.90 |    88.9 % |         71.9 % |          63.9 % |      25.0 % |             0.0 % |     –     |

## 3. Slices (Betriebspunkt)

**Sprache** – nutzbar korrekt / falsch akzeptiert (n)

| Sprache |   n | keyword        | gatekeeper      | cascade         |
| ------- | --: | -------------- | --------------- | --------------- |
| de      |  15 | 20.0 % / 0.0 % | 73.3 % / 26.7 % | 66.7 % / 26.7 % |
| en      |   9 | 0.0 % / 0.0 %  | 55.6 % / 22.2 % | 66.7 % / 33.3 % |
| fr      |   6 | 0.0 % / 0.0 %  | 66.7 % / 33.3 % | 66.7 % / 33.3 % |
| es      |   6 | 0.0 % / 0.0 %  | 33.3 % / 66.7 % | 33.3 % / 66.7 % |

**Tag** – nutzbar korrekt / falsch akzeptiert (n)

| Tag           |   n | keyword       | gatekeeper      | cascade         |
| ------------- | --: | ------------- | --------------- | --------------- |
| canonical     |  24 | 8.3 % / 0.0 % | 62.5 % / 33.3 % | 62.5 % / 37.5 % |
| out-of-domain |  36 | 8.3 % / 0.0 % | 61.1 % / 33.3 % | 61.1 % / 36.1 % |
| typo          |   1 | 0.0 % / 0.0 % | 100.0 % / 0.0 % | 0.0 % / 0.0 %   |
| short         |   1 | 0.0 % / 0.0 % | 100.0 % / 0.0 % | 0.0 % / 0.0 %   |

**Gold-Kategorie** – nutzbar korrekt / falsch akzeptiert (n)

| Gold-Kategorie |   n | keyword        | gatekeeper      | cascade         |
| -------------- | --: | -------------- | --------------- | --------------- |
| content        |  21 | 0.0 % / 0.0 %  | 61.9 % / 33.3 % | 61.9 % / 33.3 % |
| organization   |  10 | 30.0 % / 0.0 % | 90.0 % / 10.0 % | 90.0 % / 10.0 % |
| technical      |   5 | 0.0 % / 0.0 %  | 0.0 % / 80.0 %  | 0.0 % / 100.0 % |

## 4. Kalibrierung der Konfidenz

**Gatekeeper (Naive Bayes, nur Schwelle)** – ECE 0.268

| Konfidenzbereich |   n | mittlere Konfidenz | tatsächliche Acc. |
| ---------------- | --: | -----------------: | ----------------: |
| [0.00, 0.40)     |   0 |                  – |                 – |
| [0.40, 0.55)     |   2 |              0.499 |             0.0 % |
| [0.55, 0.70)     |   5 |              0.648 |            40.0 % |
| [0.70, 0.85)     |   4 |              0.795 |            25.0 % |
| [0.85, 1.00]     |  25 |              0.969 |            76.0 % |

**Kaskade 1.3 (Gatekeeper + k-NN)** – ECE 0.253

| Konfidenzbereich |   n | mittlere Konfidenz | tatsächliche Acc. |
| ---------------- | --: | -----------------: | ----------------: |
| [0.00, 0.40)     |   0 |                  – |                 – |
| [0.40, 0.55)     |   0 |                  – |                 – |
| [0.55, 0.70)     |   6 |              0.647 |            50.0 % |
| [0.70, 0.85)     |   5 |              0.796 |            20.0 % |
| [0.85, 1.00]     |  25 |              0.969 |            76.0 % |

## 5. Kontrollierte Variante: Transliteration

Seed und Keyword-Liste sind transliteriert. Gleiche Items, DE/mixed mit ä→ae usw.

| System                                 | Nutzbar korrekt (orig → translit) | Falsch akzeptiert (orig → translit) | Macro-F1 (orig → translit) |
| -------------------------------------- | --------------------------------- | ----------------------------------- | -------------------------- |
| Keyword-Baseline (regelbasiert)        | 8.3 % → 8.3 %                     | 0.0 % → 0.0 %                       | 0.413 → 0.413              |
| Gatekeeper (Naive Bayes, nur Schwelle) | 61.1 % → 63.9 %                   | 33.3 % → 30.6 %                     | 0.442 → 0.462              |
| Kaskade 1.3 (Gatekeeper + k-NN)        | 61.1 % → 66.7 %                   | 36.1 % → 33.3 %                     | 0.456 → 0.475              |

## 6. Laufzeit und Ressourcen

Kaltstart: Gatekeeper-Training 7.33 ms, k-NN-Prototypen 3.81 ms, Heap-Δ 20.4 MB, RSS-Δ 33.3 MB (inkl. Modulimport).

Warm, 20 Durchläufe × 36 Texte, ein Thread:

| System                                 |   p50 |    p95 |     p99 |     max | Durchsatz/s |
| -------------------------------------- | ----: | -----: | ------: | ------: | ----------: |
| Keyword-Baseline (regelbasiert)        |  8 µs |  10 µs |   10 µs |   31 µs |     123.391 |
| Gatekeeper (Naive Bayes, nur Schwelle) | 17 µs |  22 µs |   60 µs |   67 µs |      53.159 |
| Kaskade 1.3 (Gatekeeper + k-NN)        | 27 µs | 187 µs | 2.24 ms | 2.46 ms |      12.152 |

Produktions-Timeout je Job: 2000 ms (Queue/Worker-Overhead hier nicht gemessen).

## 7. Fehlerfälle (Betriebspunkt, Originalschreibung)

**Keyword-Baseline (regelbasiert)** – 0 sicher, aber falsch bzw. trotz Mehrdeutigkeit akzeptiert

**Gatekeeper (Naive Bayes, nur Schwelle)** – 12 sicher, aber falsch bzw. trotz Mehrdeutigkeit akzeptiert

| ID   | Text                                                                  | Gold         | Vorhersage   | Konfidenz |
| ---- | --------------------------------------------------------------------- | ------------ | ------------ | --------: |
| Q541 | Why did the Weimar Republic fail?                                     | content      | organization |     0.962 |
| Q543 | Pourquoi la république de Weimar a-t-elle échoué ?                    | content      | organization |     0.979 |
| Q544 | ¿Por qué fracasó la República de Weimar?                              | content      | organization |     0.685 |
| Q546 | Zählt ein Zeitzeugeninterview von 1990 als Primärquelle?              | content      | organization |     0.664 |
| Q547 | Ist ein Schulbuch von 1935 eine Primär- oder eine Sekundärquelle?     | content      | organization |     0.939 |
| Q549 | Is a memoir written decades later a primary source?                   | content      | organization |     0.750 |
| Q551 | ¿Qué diferencia hay entre una fuente primaria y una secundaria?       | content      | organization |     0.845 |
| Q563 | ¿Hay que inscribirse antes de la visita al archivo?                   | organization | content      |     0.555 |
| Q569 | Die Zeitungsdatenbank für die Übung lädt seit heute Morgen nicht.     | technical    | organization |     0.985 |
| Q570 | Beim Öffnen der digitalen Zeitungsarchive kommt nur eine Fehlerseite. | technical    | content      |     0.819 |
| Q572 | La base de données de presse ne s'ouvre pas.                          | technical    | content      |     0.991 |
| Q573 | La base de datos de periódicos no carga.                              | technical    | content      |     0.999 |

**Kaskade 1.3 (Gatekeeper + k-NN)** – 13 sicher, aber falsch bzw. trotz Mehrdeutigkeit akzeptiert

| ID   | Text                                                                  | Gold         | Vorhersage   | Konfidenz |
| ---- | --------------------------------------------------------------------- | ------------ | ------------ | --------: |
| Q541 | Why did the Weimar Republic fail?                                     | content      | organization |     0.962 |
| Q543 | Pourquoi la république de Weimar a-t-elle échoué ?                    | content      | organization |     0.979 |
| Q544 | ¿Por qué fracasó la República de Weimar?                              | content      | organization |     0.685 |
| Q546 | Zählt ein Zeitzeugeninterview von 1990 als Primärquelle?              | content      | organization |     0.664 |
| Q547 | Ist ein Schulbuch von 1935 eine Primär- oder eine Sekundärquelle?     | content      | organization |     0.939 |
| Q549 | Is a memoir written decades later a primary source?                   | content      | organization |     0.750 |
| Q551 | ¿Qué diferencia hay entre una fuente primaria y una secundaria?       | content      | organization |     0.845 |
| Q563 | ¿Hay que inscribirse antes de la visita al archivo?                   | organization | content      |     0.800 |
| Q569 | Die Zeitungsdatenbank für die Übung lädt seit heute Morgen nicht.     | technical    | organization |     0.985 |
| Q570 | Beim Öffnen der digitalen Zeitungsarchive kommt nur eine Fehlerseite. | technical    | content      |     0.819 |
| Q571 | The newspaper archive database won't load.                            | technical    | content      |     0.600 |
| Q572 | La base de données de presse ne s'ouvre pas.                          | technical    | content      |     0.991 |
| Q573 | La base de datos de periódicos no carga.                              | technical    | content      |     0.999 |

## Gültigkeitsgrenzen

- Synthetisches, kleines Referenzset (Bootstrap-Intervalle beachten); keine Aussage über reale Hörsaalverteilung.
- Konfidenz ist ohne Kalibrierung keine Erfolgswahrscheinlichkeit (siehe ECE).
- Gemessen ist die In-Process-Klassifikation, nicht Queue, Persistenz oder Worker-Latenz.
