# Referat 2B – Was der Moderationskompass aus Kategorien und Themen macht

Commit `84a5614ead76` (v1.3.0-326-g84a5614e-dirty), Referenzset 2.2.0 (SHA-256 `717bdb17dc2e94d5…`), 2026-11-04T17:14:44.975Z
Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz × 8, Node v24.12.0. Kompass-Funktionen aus dem Release; sichtbar sind 3 Quellen je Karte, gespeichert bis 8.

**Lesart:** _Statuszeile_ = was oben im Kompass-Dialog steht. _Kategorie-Quellen korrekt_ = Anteil der Fragen hinter den sichtbaren Kategorie-Quellen, deren Referenzkategorie stimmt. _Themen schlüssig_ = sichtbare Themen/Terme mit ≥ 2 Fragen, von denen ≥ 80 % zu einem Anliegen (Familie) gehören. _Erreichbar_ = Anteil aller Fragen, die über die drei sichtbaren Quellen erreichbar sind.

## 1. Fächer: Karte »Häufige Themen« in einer deutschen Sitzung

### Statistik (201 Fragen; 8.9b: 163 classified, 38 uncertain; Encoder: ready)

| Variante                                            | Statuszeile                                                    | Kategorie-Quellen korrekt | Themen schlüssig | Erreichbar |
| --------------------------------------------------- | -------------------------------------------------------------- | ------------------------- | ---------------- | ---------- |
| V0 2B aus (Regelkern, Wortwolke »Wörter & Phrasen«) | Die automatische Sortierung der Fragen ist aus.                | –                         | 0 / 3            | 16,9 %     |
| V1 + Kategorien (8.9b)                              | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 75,5 % (40 falsch)        | –                | 81,1 %     |
| V2 + Encoder-Themen (1.14c, »Thema«)                | Die automatische Sortierung der Fragen ist aus.                | –                         | 2 / 3            | 9,0 %      |
| V3 + beides                                         | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 75,5 % (40 falsch)        | –                | 81,1 %     |

Sichtbare Quellen (V3):

- 1. **Fragen zum Ablauf · 61** – Kategorie, 61 Fragen, korrekt 75,4 %; z. B. falsch: »Muss ich den t-Test für die Prüfung können?«
- 2. **Inhaltliche Fragen · 54** – Kategorie, 54 Fragen, korrekt 74,1 %; z. B. falsch: »Dürfen wir in der Klausur eine Formelsammlung benutzen?«
- 3. **Technische Fragen · 48** – Kategorie, 48 Fragen, korrekt 77,1 %; z. B. falsch: »Checkt jemand den p-Wert? Ich raff das nicht.«

### Botanik (16 Fragen; 8.9b: 14 classified, 2 uncertain; Encoder: ready)

| Variante                                            | Statuszeile                                                    | Kategorie-Quellen korrekt | Themen schlüssig | Erreichbar |
| --------------------------------------------------- | -------------------------------------------------------------- | ------------------------- | ---------------- | ---------- |
| V0 2B aus (Regelkern, Wortwolke »Wörter & Phrasen«) | Die automatische Sortierung der Fragen ist aus.                | –                         | 3 / 3            | 50,0 %     |
| V1 + Kategorien (8.9b)                              | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 57,1 % (6 falsch)         | –                | 87,5 %     |
| V2 + Encoder-Themen (1.14c, »Thema«)                | Die automatische Sortierung der Fragen ist aus.                | –                         | 3 / 3            | 43,8 %     |
| V3 + beides                                         | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 57,1 % (6 falsch)         | –                | 87,5 %     |

Sichtbare Quellen (V3):

- 1. **Inhaltliche Fragen · 6** – Kategorie, 6 Fragen, korrekt 66,7 %; z. B. falsch: »Ist die Exkursion zum Botanischen Garten verpflichtend?«
- 2. **Fragen zum Ablauf · 5** – Kategorie, 5 Fragen, korrekt 60,0 %; z. B. falsch: »Woran erkenne ich, ob eine Pflanze monokotyl oder dikotyl ist?«
- 3. **Technische Fragen · 3** – Kategorie, 3 Fragen, korrekt 33,3 %; z. B. falsch: »Wozu braucht der Calvin-Zyklus eigentlich das ATP aus der Lichtreaktion?«

### Geschichte (15 Fragen; 8.9b: 14 classified, 1 uncertain; Encoder: ready)

| Variante                                            | Statuszeile                                                    | Kategorie-Quellen korrekt | Themen schlüssig | Erreichbar |
| --------------------------------------------------- | -------------------------------------------------------------- | ------------------------- | ---------------- | ---------- |
| V0 2B aus (Regelkern, Wortwolke »Wörter & Phrasen«) | Die automatische Sortierung der Fragen ist aus.                | –                         | 3 / 3            | 46,7 %     |
| V1 + Kategorien (8.9b)                              | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 71,4 % (4 falsch)         | 1 / 1            | 100,0 %    |
| V2 + Encoder-Themen (1.14c, »Thema«)                | Die automatische Sortierung der Fragen ist aus.                | –                         | 3 / 3            | 46,7 %     |
| V3 + beides                                         | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 71,4 % (4 falsch)         | 1 / 1            | 100,0 %    |

Sichtbare Quellen (V3):

- 1. **Inhaltliche Fragen · 7** – Kategorie, 7 Fragen, korrekt 85,7 %; z. B. falsch: »Beim Öffnen der digitalen Zeitungsarchive kommt nur eine Fehlerseite.«
- 2. **Fragen zum Ablauf · 7** – Kategorie, 7 Fragen, korrekt 57,1 %; z. B. falsch: »Zählt ein Zeitzeugeninterview von 1990 als Primärquelle?«
- 3. **Warum gilt der Westfälische Frieden als Beginn des modernen Staatensystems?** – Thema/Term, 3 Fragen, Reinheit 100,0 % (1 Anliegen)

### Polizeischule (90 Fragen; 8.9b: 82 classified, 8 uncertain; Encoder: ready)

| Variante                                            | Statuszeile                                                    | Kategorie-Quellen korrekt | Themen schlüssig | Erreichbar |
| --------------------------------------------------- | -------------------------------------------------------------- | ------------------------- | ---------------- | ---------- |
| V0 2B aus (Regelkern, Wortwolke »Wörter & Phrasen«) | Die automatische Sortierung der Fragen ist aus.                | –                         | 2 / 3            | 16,7 %     |
| V1 + Kategorien (8.9b)                              | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 51,2 % (40 falsch)        | –                | 91,1 %     |
| V2 + Encoder-Themen (1.14c, »Thema«)                | Die automatische Sortierung der Fragen ist aus.                | –                         | 2 / 3            | 11,1 %     |
| V3 + beides                                         | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 51,2 % (40 falsch)        | –                | 91,1 %     |

Sichtbare Quellen (V3):

- 1. **Fragen zum Ablauf · 41** – Kategorie, 41 Fragen, korrekt 41,5 %; z. B. falsch: »Ist die vorläufige Festnahme basically dasselbe wie eine Ingewahrsamnahme?«
- 2. **Inhaltliche Fragen · 24** – Kategorie, 24 Fragen, korrekt 70,8 %; z. B. falsch: »Wann ist das nächste Schießtraining und auf welchem Schießstand?«
- 3. **Technische Fragen · 17** – Kategorie, 17 Fragen, korrekt 47,1 %; z. B. falsch: »Wann ist eine Notwehrhandlung nicht mehr geboten?«

## 2. Sprachen: dieselbe Fragensammlung je Sprache

### Statistik

| Sprache |   n | 8.9b classified / uncertain | Statuszeile mit 8.9b                                           | Kategorie-Quellen korrekt (V1) | Encoder im Produkt        | Themen schlüssig: lexikalisch (V0) → Encoder (V2) | Erreichbar V0 → V2 |
| ------- | --: | --------------------------- | -------------------------------------------------------------- | ------------------------------ | ------------------------- | ------------------------------------------------- | ------------------ |
| de      | 201 | 163 / 38                    | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 75,5 % (40 falsch)             | ja (ready)                | 0/3 → 2/3                                         | 16,9 % → 9,0 %     |
| en      | 120 | 103 / 17                    | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 66,0 % (35 falsch)             | ja (ready)                | 0/3 → 0/3                                         | 19,2 % → 10,0 %    |
| fr      |  82 | 65 / 17                     | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 53,8 % (30 falsch)             | nein (fallback, Fallback) | 0/3 → 0/3                                         | 23,2 % → 23,2 %    |
| es      |  81 | 63 / 18                     | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 47,6 % (33 falsch)             | nein (fallback, Fallback) | 0/3 → 0/3                                         | 24,7 % → 24,7 %    |
| mixed   |  16 | 12 / 4                      | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 83,3 % (2 falsch)              | ja (fallback, Fallback)   | 0/1 → 0/1                                         | 12,5 % → 12,5 %    |

### Polizeischule

| Sprache |   n | 8.9b classified / uncertain | Statuszeile mit 8.9b                                           | Kategorie-Quellen korrekt (V1) | Encoder im Produkt        | Themen schlüssig: lexikalisch (V0) → Encoder (V2) | Erreichbar V0 → V2 |
| ------- | --: | --------------------------- | -------------------------------------------------------------- | ------------------------------ | ------------------------- | ------------------------------------------------- | ------------------ |
| de      |  90 | 82 / 8                      | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 51,2 % (40 falsch)             | ja (ready)                | 2/3 → 2/3                                         | 16,7 % → 11,1 %    |
| en      |  22 | 21 / 1                      | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 57,1 % (9 falsch)              | ja (ready)                | 0/3 → 0/3                                         | 40,9 % → 31,8 %    |
| fr      |  19 | 18 / 1                      | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 55,6 % (8 falsch)              | nein (fallback, Fallback) | 0/3 → 0/3                                         | 52,6 % → 52,6 %    |
| es      |  19 | 17 / 2                      | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. | 52,9 % (8 falsch)              | nein (fallback, Fallback) | 0/3 → 0/3                                         | 36,8 % → 36,8 %    |

## 3. Last: was die Lehrperson im Kompass sieht

Release-Queue für 8.9b: Limit 100, Parallelität 1, **eine Queue je Backend-Prozess für alle Sitzungen**. Encoder: höchstens 1 Anfrage gleichzeitig je Prozess.

| Szenario                                                       |     Dauer | 8.9b-Status am Ende                     | Statuszeile am Ende                                            | Zeit mit »werden noch sortiert« | max. wartend | größte Event-Loop-Lücke |
| -------------------------------------------------------------- | --------: | --------------------------------------- | -------------------------------------------------------------- | ------------------------------: | -----------: | ----------------------: |
| 500 Fragen, 50/s                                               |  14801 ms | 426 classified, 74 uncertain            | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. |                         2215 ms |            1 |                 19.9 ms |
| 500 Fragen, 200/s                                              | 5253.6 ms | 426 classified, 74 uncertain            | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. |                          960 ms |            3 |                 20.5 ms |
| 500 Fragen, 1000/s                                             |  997.7 ms | 426 classified, 74 uncertain            | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. |                          540 ms |           27 |                 29.9 ms |
| 500 Fragen, gleichzeitig                                       |  374.4 ms | 87 classified, 13 uncertain, 400 failed | Die automatische Sortierung ist gerade nicht verfügbar.        |                           95 ms |           99 |                242.8 ms |
| 150 Fragen gleichzeitig in Sitzung A, Sitzung B fragt nebenher |  279.1 ms | 87 classified, 13 uncertain, 50 failed  | Die automatische Sortierung ist gerade nicht verfügbar.        |                          105 ms |           99 |                117.4 ms |

**Nachbarsitzung B** (10 Fragen, während A 150 gleichzeitig einreicht): 1 failed, 9 classified → Statuszeile am Ende: »Die automatische Sortierung ist gerade nicht verfügbar.«.

| Gleichzeitige Themenanalysen | mit Encoder-Themen | lexikalischer Fallback | Dauer je Sitzung                                                   | nächste Sitzung direkt danach |
| ---------------------------: | -----------------: | ---------------------: | ------------------------------------------------------------------ | ----------------------------- |
|                            1 |                  1 |                      0 | 772.1 ms                                                           | Themen (781.5 ms)             |
|                            2 |                  1 |                      1 | 918.6 ms, 3.7 ms                                                   | Themen (698 ms)               |
|                            4 |                  1 |                      3 | 988.9 ms, 8.5 ms, 6.2 ms, 3.2 ms                                   | Themen (805.8 ms)             |
|                            8 |                  1 |                      7 | 910.8 ms, 20 ms, 17.4 ms, 15.1 ms, 12.8 ms, 9.7 ms, 6.8 ms, 3.5 ms | Themen (693.2 ms)             |

## Gültigkeitsgrenzen

- Kompass ohne Stimmen, Quiz und Blitzlicht: nur die Karte »Häufige Themen« und die Statuszeile werden bewertet; Sortierung TOP.
- Themen-Quellen werden über ihre vollständige Mitgliedschaft bewertet (das sieht die Lehrperson nach dem Sprung in die Wortwolke); im Dialog selbst trägt eine Quelle nur eine Beispielfrage.
- Last in-process mit Release-Queue und In-Memory-Writer, ohne HTTP und Datenbank; Ankunft in 16-ms-Takten. Gleichzeitige Themenanalysen mit leicht veränderten Texten, damit kein Cache greift.
- Lexikalische Baseline ohne spaCy-Glättung (`normalization: NONE`).
