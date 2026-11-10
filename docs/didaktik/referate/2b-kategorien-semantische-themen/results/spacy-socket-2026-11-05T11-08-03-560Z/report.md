# Referat 2B – Lexikalische Baseline mit spaCy-Glättung im Kompass

Commit `b2234149443e` (v1.3.0-327-gb2234149-dirty), Referenzset 2.2.0 (SHA-256 `717bdb17dc2e94d5…`), 2026-11-05T11:08:03.560Z
Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz × 8, Node v24.22.2. spaCy 3.8.15, Modelle de_core_news_sm, en_core_web_sm, fr_core_news_sm, es_core_news_sm; Container `n/a`.

**Lesart:** _schlüssig_ = sichtbare Quelle mit ≥ 2 Fragen, davon ≥ 80 % ein Anliegen (Familie). _Erreichbar_ = Anteil aller Fragen hinter den drei sichtbaren Quellen. _Top-12_ = die zwölf größten Einträge der Wortwolke; _Paare gleiches Anliegen_ = Anteil der Fragenpaare, die sich einen Eintrag teilen und zum selben Anliegen gehören (in Klammern: Zahl der Paare).

## 1. Fächer, deutsche Sitzung

| Sitzung       | Variante                         | Themen-Quellen schlüssig | erreichbar (3 Quellen) | Top-12: Fragen abgedeckt | Top-12: Paare gleiches Anliegen |
| ------------- | -------------------------------- | ------------------------ | ---------------------: | -----------------------: | ------------------------------: |
| Statistik     | L0 »Wörter« ohne spaCy           | 0 / 3                    |                 16,9 % |                   35,3 % |                    23,9 % (272) |
| Statistik     | L1 »Wörter« mit spaCy            | 0 / 3                    |                 17,9 % |                   36,3 % |                    20,7 % (295) |
| Statistik     | T0 »Wörter & Phrasen« ohne spaCy | 0 / 3                    |                 16,9 % |                   38,3 % |                    25,5 % (267) |
| Statistik     | T1 »Wörter & Phrasen« mit spaCy  | 0 / 3                    |                 17,9 % |                   36,3 % |                    20,7 % (295) |
| Statistik     | S »Thema« (Encoder)              | 2 / 3                    |                  9,0 % |                   27,9 % |                    66,4 % (110) |
| Botanik       | L0 »Wörter« ohne spaCy           | 3 / 3                    |                 37,5 % |                   56,3 % |                      87,5 % (8) |
| Botanik       | L1 »Wörter« mit spaCy            | 3 / 3                    |                 37,5 % |                   50,0 % |                     100,0 % (7) |
| Botanik       | T0 »Wörter & Phrasen« ohne spaCy | 3 / 3                    |                 50,0 % |                   56,3 % |                     100,0 % (7) |
| Botanik       | T1 »Wörter & Phrasen« mit spaCy  | 3 / 3                    |                 37,5 % |                   50,0 % |                     100,0 % (7) |
| Botanik       | S »Thema« (Encoder)              | 3 / 3                    |                 43,8 % |                  100,0 % |                     100,0 % (7) |
| Geschichte    | L0 »Wörter« ohne spaCy           | 3 / 3                    |                 33,3 % |                   60,0 % |                     100,0 % (6) |
| Geschichte    | L1 »Wörter« mit spaCy            | 3 / 3                    |                 46,7 % |                   60,0 % |                     100,0 % (6) |
| Geschichte    | T0 »Wörter & Phrasen« ohne spaCy | 3 / 3                    |                 46,7 % |                   66,7 % |                     100,0 % (6) |
| Geschichte    | T1 »Wörter & Phrasen« mit spaCy  | 3 / 3                    |                 33,3 % |                   66,7 % |                     100,0 % (6) |
| Geschichte    | S »Thema« (Encoder)              | 3 / 3                    |                 46,7 % |                  100,0 % |                     100,0 % (6) |
| Polizeischule | L0 »Wörter« ohne spaCy           | 2 / 3                    |                 16,7 % |                   44,4 % |                     40,0 % (65) |
| Polizeischule | L1 »Wörter« mit spaCy            | 1 / 3                    |                 16,7 % |                   43,3 % |                     46,9 % (64) |
| Polizeischule | T0 »Wörter & Phrasen« ohne spaCy | 2 / 3                    |                 16,7 % |                   50,0 % |                     48,5 % (66) |
| Polizeischule | T1 »Wörter & Phrasen« mit spaCy  | 1 / 3                    |                 16,7 % |                   43,3 % |                     46,9 % (64) |
| Polizeischule | S »Thema« (Encoder)              | 2 / 3                    |                 11,1 % |                   36,7 % |                     71,0 % (31) |

## 2. Sprachen (Statistik)

| Sitzung | Variante                         | Themen-Quellen schlüssig | erreichbar (3 Quellen) | Top-12: Fragen abgedeckt | Top-12: Paare gleiches Anliegen |
| ------- | -------------------------------- | ------------------------ | ---------------------: | -----------------------: | ------------------------------: |
| de      | L0 »Wörter« ohne spaCy           | 0 / 3                    |                 16,9 % |                   35,3 % |                    23,9 % (272) |
| de      | L1 »Wörter« mit spaCy            | 0 / 3                    |                 17,9 % |                   36,3 % |                    20,7 % (295) |
| de      | T0 »Wörter & Phrasen« ohne spaCy | 0 / 3                    |                 16,9 % |                   38,3 % |                    25,5 % (267) |
| de      | T1 »Wörter & Phrasen« mit spaCy  | 0 / 3                    |                 17,9 % |                   36,3 % |                    20,7 % (295) |
| de      | S »Thema« (Encoder)              | 2 / 3                    |                  9,0 % |                   27,9 % |                    66,4 % (110) |
| en      | L0 »Wörter« ohne spaCy           | 0 / 3                    |                 19,2 % |                   46,7 % |                    13,4 % (194) |
| en      | L1 »Wörter« mit spaCy            | 0 / 3                    |                 22,5 % |                   45,0 % |                    14,9 % (202) |
| en      | T0 »Wörter & Phrasen« ohne spaCy | 0 / 3                    |                 19,2 % |                   46,7 % |                    18,8 % (138) |
| en      | T1 »Wörter & Phrasen« mit spaCy  | 0 / 3                    |                 22,5 % |                   45,0 % |                    14,9 % (202) |
| en      | S »Thema« (Encoder)              | 0 / 3                    |                 10,0 % |                   31,7 % |                     65,9 % (44) |
| fr      | L0 »Wörter« ohne spaCy           | 0 / 3                    |                 23,2 % |                   43,9 % |                      9,8 % (82) |
| fr      | L1 »Wörter« mit spaCy            | 0 / 3                    |                 23,2 % |                   47,6 % |                     10,5 % (86) |
| fr      | T0 »Wörter & Phrasen« ohne spaCy | 0 / 3                    |                 23,2 % |                   48,8 % |                     14,7 % (75) |
| fr      | T1 »Wörter & Phrasen« mit spaCy  | 0 / 3                    |                 23,2 % |                   47,6 % |                     10,5 % (86) |
| fr      | S »Thema« (Encoder)              | 0 / 3                    |                 23,2 % |                   48,8 % |                     14,7 % (75) |
| es      | L0 »Wörter« ohne spaCy           | 0 / 3                    |                 25,9 % |                   54,3 % |                     7,9 % (126) |
| es      | L1 »Wörter« mit spaCy            | 0 / 3                    |                 25,9 % |                   49,4 % |                     14,4 % (90) |
| es      | T0 »Wörter & Phrasen« ohne spaCy | 0 / 3                    |                 24,7 % |                   53,1 % |                     12,8 % (78) |
| es      | T1 »Wörter & Phrasen« mit spaCy  | 0 / 3                    |                 25,9 % |                   49,4 % |                     14,4 % (90) |
| es      | S »Thema« (Encoder)              | 0 / 3                    |                 24,7 % |                   53,1 % |                     12,8 % (78) |

spaCy angewandt: de LEMMA, Encoder ready · en LEMMA, Encoder ready · fr LEMMA, Encoder fallback · es LEMMA, Encoder fallback

## 3. Sechs-Fragen-Szenario aus #456 (Kontexttest)

| Sitzung  | Variante                         | Themen-Quellen schlüssig | erreichbar (3 Quellen) | Top-12: Fragen abgedeckt | Top-12: Paare gleiches Anliegen |
| -------- | -------------------------------- | ------------------------ | ---------------------: | -----------------------: | ------------------------------: |
| Szenario | L0 »Wörter« ohne spaCy           | 2 / 2                    |                 33,3 % |                  100,0 % |                     100,0 % (1) |
| Szenario | L1 »Wörter« mit spaCy            | 2 / 2                    |                 33,3 % |                  100,0 % |                     100,0 % (1) |
| Szenario | T0 »Wörter & Phrasen« ohne spaCy | 1 / 1                    |                 33,3 % |                   50,0 % |                     100,0 % (1) |
| Szenario | T1 »Wörter & Phrasen« mit spaCy  | 3 / 3                    |                 33,3 % |                  100,0 % |                     100,0 % (1) |
| Szenario | S »Thema« (Encoder)              | 2 / 2                    |                 66,7 % |                  100,0 % |                     100,0 % (2) |

- L0 »Wörter« ohne spaCy: lineare (2) · Regression (2)
- L1 »Wörter« mit spaCy: Beispiel (2) · Regression (2)
- T0 »Wörter & Phrasen« ohne spaCy: lineare Regression (2)
- T1 »Wörter & Phrasen« mit spaCy: Beispiel (2) · lineare Regression (2) · Regression (2)
- S »Thema« (Encoder): Können wir mehr Beispiele zur linearen Regression bearbeiten? (2) · Sollten wir eine Anwesenheitspflicht einführen? (2)

## 4. Was spaCy an den Begriffen ändert

- Statistik: neu in den Top-12 mit spaCy: Hörsaal, Kapitel, Konfidenzintervall, Nachklausur
- Botanik: neu in den Top-12 mit spaCy: –
- Geschichte: neu in den Top-12 mit spaCy: –
- Polizeischule: neu in den Top-12 mit spaCy: Person, Schusswaffengebrauch, Tatort
- en: neu in den Top-12 mit spaCy: slide, test, hour, office, regression
- fr: neu in den Top-12 mit spaCy: exercice, ligne, Moodle, permanence, rattrapage
- es: neu in den Top-12 mit spaCy: diapositiva, ejemplo, grupo, hoja, horario

## 5. Laufzeit und Ressourcen des Sidecars

Image n/a, Arbeitsspeicher nach der Messung n/a.

| Locale | Texte | Sidecar-Aufruf |
| ------ | ----: | -------------: |
| de     |   200 |       200.4 ms |
| de     |    16 |        15.2 ms |
| de     |    15 |        14.4 ms |
| de     |    90 |        68.8 ms |
| de     |   200 |       191.9 ms |
| en     |   120 |       106.1 ms |
| fr     |    82 |        64.5 ms |
| es     |    81 |        63.1 ms |
| de     |     6 |        12.3 ms |

## Gültigkeitsgrenzen

- Sidecar über den Release-Client und den Unix-Socket (Linux-Node-Container mit gemeinsamem Socket-Volume); die Zeitangabe misst den Release-Client-Aufruf.
- Kompass ohne Kategorien (8.9b aus), ohne Stimmen; Sortierung TOP; drei sichtbare Quellen wie im Release.
- Top-12-Paarmaß ist ein Hilfsmaß für überlappende Wortwolken-Einträge, keine Partition (daher kein ARI).
