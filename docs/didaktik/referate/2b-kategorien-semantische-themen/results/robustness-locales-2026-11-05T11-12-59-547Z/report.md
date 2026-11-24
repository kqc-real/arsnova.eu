# Referat 2B – Zusatz: Encoder-Themen für fr/es (hypothetisch, Release ruft ihn dort nicht auf)

**Hypothetisch:** Das Release zeigt in fr/es den lexikalischen Fallback (Status Statistik fr: fallback, Statistik es: fallback). S = dieselbe Analyse mit Sitzungs-Locale de, als stünden fr/es in `WORD_CLOUD_SEMANTIC_LOCALES`; Releasecode unverändert.

Commit `b2234149443e` (v1.3.0-327-gb2234149-dirty), Referenzset 2.2.0 (SHA-256 `717bdb17dc2e94d5…`), 2026-11-05T11:12:59.547Z
Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz × 8, Node v24.22.2. 100 Teilsitzungen je Sitzung, Seed 2026, Encoder-Schwelle 0.87, spaCy 3.8.15. Dauer 106 s.

**Lesart:** Median [2,5 %; 97,5 %-Perzentil] über die Teilsitzungen. _Schlüssig_ = sichtbare Kompass-Quelle mit ≥ 2 Fragen, davon ≥ 80 % ein Anliegen. _Paare_ = Anteil der Fragenpaare in einem der zwölf größten Wortwolken-Einträge, die zum selben Anliegen gehören. _ARI_ = Übereinstimmung der Partition mit den Anliegen (lexikalisch = »Wörter & Phrasen«-Fallback).

## 1. Verteilungen

| Sitzung (Teilsitzung/Pool) | Kennzahl                       | L0 »Wörter«                     | L1 »Wörter« + spaCy    | S »Thema« (Encoder)    |
| -------------------------- | ------------------------------ | ------------------------------- | ---------------------- | ---------------------- |
| Statistik fr (40/82)       | schlüssige Quellen (von 3)     | 0 [0; 0,52]                     | 0 [0; 1]               | 0 [0; 1]               |
| Statistik fr (40/82)       | Top-12-Paare gleiches Anliegen | 13,4 % [3,6 %; 28,1 %]          | 17,3 % [5,2 %; 37,0 %] | 12,0 % [3,1 %; 26,2 %] |
| Statistik fr (40/82)       | ARI (Partition)                | 0,23 [0,07; 0,43] (lexikalisch) | –                      | 0,18 [0,04; 0,33]      |
| Statistik es (40/81)       | schlüssige Quellen (von 3)     | 0 [0; 0]                        | 0 [0; 1]               | 0,50 [0; 2]            |
| Statistik es (40/81)       | Top-12-Paare gleiches Anliegen | 10,4 % [4,4 %; 19,3 %]          | 18,2 % [9,4 %; 32,1 %] | 25,0 % [7,5 %; 52,0 %] |
| Statistik es (40/81)       | ARI (Partition)                | 0,26 [0,08; 0,45] (lexikalisch) | –                      | 0,32 [0,10; 0,58]      |

Kontrolle ganze Sitzung (L0/L1 müssen `measure-spacy.mts` entsprechen; S hypothetisch): Statistik fr L0 0/3 · 9,8 %, L1 0/3 · 10,5 %, S 0/3 · 10,4 %; Statistik es L0 0/3 · 7,9 %, L1 0/3 · 14,4 %, S 0/3 · 25,8 %

## 2. Gepaarte Vergleiche (Anteil der Teilsitzungen)

| Sitzung      | S mehr schlüssige Quellen als L1 | S ≥ L1 | spaCy besser (L1 > L0) | spaCy schlechter (L1 < L0) | Paare: S > L1 | Paare: L1 > L0 | ARI: Encoder > lexikalisch | Encoder-Status |
| ------------ | -------------------------------: | -----: | ---------------------: | -------------------------: | ------------: | -------------: | -------------------------: | -------------- |
| Statistik fr |                            3,0 % | 88,0 % |                 11,0 % |                      1,0 % |        16,0 % |         77,0 % |                     24,0 % | ready 100      |
| Statistik es |                           48,0 % | 97,0 % |                  6,0 % |                      0,0 % |        66,0 % |         98,0 % |                     67,0 % | ready 100      |

## Gültigkeitsgrenzen

- Teilsitzungen sind Ziehungen aus demselben Referenzset, keine unabhängigen Lehrveranstaltungen; die Intervalle zeigen die Streuung über Sitzungszusammensetzungen, nicht über Fragenautoren.
- spaCy je Text einmal per `docker exec` lemmatisiert und je Teilsitzung zusammengesetzt (spaCy verarbeitet jeden Text unabhängig).
- Kompass ohne Kategorien und ohne Stimmen, Sortierung TOP, drei sichtbare Quellen wie im Release.
