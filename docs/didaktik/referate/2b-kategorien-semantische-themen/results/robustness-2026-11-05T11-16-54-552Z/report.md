# Referat 2B – Robustheit über zufällige Teilsitzungen

Commit `b2234149443e` (v1.3.0-327-gb2234149-dirty), Referenzset 2.2.0 (SHA-256 `717bdb17dc2e94d5…`), 2026-11-05T11:16:54.552Z
Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz × 8, Node v24.22.2. 100 Teilsitzungen je Sitzung, Seed 2026, Encoder-Schwelle 0.87, spaCy 3.8.15. Dauer 225 s.

**Lesart:** Median [2,5 %; 97,5 %-Perzentil] über die Teilsitzungen. _Schlüssig_ = sichtbare Kompass-Quelle mit ≥ 2 Fragen, davon ≥ 80 % ein Anliegen. _Paare_ = Anteil der Fragenpaare in einem der zwölf größten Wortwolken-Einträge, die zum selben Anliegen gehören. _ARI_ = Übereinstimmung der Partition mit den Anliegen (lexikalisch = »Wörter & Phrasen«-Fallback).

## 1. Verteilungen

| Sitzung (Teilsitzung/Pool) | Kennzahl                       | L0 »Wörter«                     | L1 »Wörter« + spaCy     | S »Thema« (Encoder)     |
| -------------------------- | ------------------------------ | ------------------------------- | ----------------------- | ----------------------- |
| Statistik de (60/201)      | schlüssige Quellen (von 3)     | 0 [0; 1,52]                     | 0 [0; 1]                | 1 [0; 3]                |
| Statistik de (60/201)      | Top-12-Paare gleiches Anliegen | 24,1 % [5,2 %; 50,2 %]          | 21,1 % [2,3 %; 46,3 %]  | 50,0 % [25,1 %; 75,5 %] |
| Statistik de (60/201)      | ARI (Partition)                | 0,32 [0,18; 0,50] (lexikalisch) | –                       | 0,47 [0,26; 0,68]       |
| Polizeischule de (45/90)   | schlüssige Quellen (von 3)     | 0 [0; 2]                        | 1 [0; 2,52]             | 2 [0; 3]                |
| Polizeischule de (45/90)   | Top-12-Paare gleiches Anliegen | 36,6 % [19,0 %; 56,9 %]         | 42,9 % [21,5 %; 66,7 %] | 60,0 % [30,8 %; 83,5 %] |
| Polizeischule de (45/90)   | ARI (Partition)                | 0,38 [0,20; 0,59] (lexikalisch) | –                       | 0,43 [0,24; 0,63]       |
| Statistik en (60/120)      | schlüssige Quellen (von 3)     | 0 [0; 0]                        | 0 [0; 0]                | 1 [0; 3]                |
| Statistik en (60/120)      | Top-12-Paare gleiches Anliegen | 17,4 % [6,9 %; 31,3 %]          | 17,3 % [6,8 %; 25,9 %]  | 55,0 % [30,1 %; 83,3 %] |
| Statistik en (60/120)      | ARI (Partition)                | 0,33 [0,14; 0,49] (lexikalisch) | –                       | 0,52 [0,30; 0,70]       |

Kontrolle ganze Sitzung (muss `measure-spacy.mts` entsprechen): Statistik de L0 0/3 · 23,9 %, L1 0/3 · 20,7 %, S 2/3 · 66,4 %; Polizeischule de L0 2/3 · 40,0 %, L1 1/3 · 46,9 %, S 2/3 · 71,0 %; Statistik en L0 0/3 · 13,4 %, L1 0/3 · 14,9 %, S 0/3 · 65,9 %

## 2. Gepaarte Vergleiche (Anteil der Teilsitzungen)

| Sitzung          | S mehr schlüssige Quellen als L1 |  S ≥ L1 | spaCy besser (L1 > L0) | spaCy schlechter (L1 < L0) | Paare: S > L1 | Paare: L1 > L0 | ARI: Encoder > lexikalisch | Encoder-Status |
| ---------------- | -------------------------------: | ------: | ---------------------: | -------------------------: | ------------: | -------------: | -------------------------: | -------------- |
| Statistik de     |                           79,0 % | 100,0 % |                  2,0 % |                     15,0 % |        99,0 % |         16,0 % |                     93,0 % | ready 100      |
| Polizeischule de |                           66,0 % |  94,0 % |                 21,0 % |                      3,0 % |        84,0 % |         78,0 % |                     66,0 % | ready 100      |
| Statistik en     |                           88,0 % | 100,0 % |                  0,0 % |                      0,0 % |       100,0 % |         43,0 % |                     95,0 % | ready 100      |

## Gültigkeitsgrenzen

- Teilsitzungen sind Ziehungen aus demselben Referenzset, keine unabhängigen Lehrveranstaltungen; die Intervalle zeigen die Streuung über Sitzungszusammensetzungen, nicht über Fragenautoren.
- spaCy je Text einmal per `docker exec` lemmatisiert und je Teilsitzung zusammengesetzt (spaCy verarbeitet jeden Text unabhängig).
- Kompass ohne Kategorien und ohne Stimmen, Sortierung TOP, drei sichtbare Quellen wie im Release.
