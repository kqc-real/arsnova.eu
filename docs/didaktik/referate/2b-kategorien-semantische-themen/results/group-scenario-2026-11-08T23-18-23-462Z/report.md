# Referat 2B – Kontexttest: Sechs-Fragen-Szenario (#456 §12) im Kompass

Commit `74091b0a6468` (v1.3.0-364-g74091b0a-dirty), 2026-11-08T23:18:23.462Z. Kein Gütenachweis (dafür dient das Referenzset); die Paare A/B, C/D, E/F dienen laut Kursrahmen nur als Kontexttest. Anliegen nach 2A: Ü Übungswunsch, P Prüfungsorganisation, K Kontroverse.

## 8.9b je Frage

| Frage | Anliegen | Status     | Kategorie    | Konfidenz | Text                                                          |
| ----- | -------- | ---------- | ------------ | --------: | ------------------------------------------------------------- |
| A     | Ü        | classified | content      |     1.000 | Können wir mehr Beispiele zur linearen Regression bearbeiten? |
| B     | Ü        | classified | content      |     0.692 | Gibt es ein weiteres Beispiel zur linearen Regression?        |
| C     | P        | uncertain  | content      |     1.000 | Ist Kapitel 4 klausurrelevant?                                |
| D     | P        | classified | organization |     0.752 | Müssen wir den vierten Abschnitt für die Prüfung lernen?      |
| E     | K        | classified | organization |     0.600 | Soll die Anwesenheit verpflichtend sein?                      |
| F     | K        | uncertain  | organization |     1.000 | Sollten wir eine Anwesenheitspflicht einführen?               |

## Wortwolke

- »Wortgruppen« (lexikalisch): lineare Regression (BA) · Kapitel 4 (C)
- »Themen« (Encoder, Status ready): AB · EF · C · D
- Kosinus (Schwelle 0.87): A–B 0.961 · C–D 0.864 · E–F 0.956 · A–C 0.765 · C–E 0.791

## Kompass, Karte »Häufige Themen« (sichtbar 3 Quellen)

| Variante                             | Statuszeile                                                     | sichtbare Quellen → Fragen                                                                                                            | nicht erreichbar | »Als Nächstes« |  D1 |  D2 |  D3 |  D4 |  D5 | Summe (max. 8) |
| ------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------- | --: | --: | --: | --: | --: | -------------: |
| V0 2B aus (Regelkern, »Wortgruppen«) | (Sortierung aus)                                                | lineare Regression → B, A                                                                                                             | C, D, E, F       | topics         |   2 |   – |   2 |   0 |   0 |              4 |
| V1 + Kategorien (8.9b)               | Die Fragen sind nach Inhalt, Organisation und Technik geordnet. | Inhaltliche Fragen · 2 → A, B<br>Fragen zum Ablauf · 2 → D, E<br>lineare Regression → B, A                                            | C, F             | topics         |   2 |   – |   1 |   0 |   2 |              5 |
| V2 + Encoder-Themen (1.14c)          | (Sortierung aus)                                                | Können wir mehr Beispiele zur linearen Regression bearbeiten? → A, B<br>Sollten wir eine Anwesenheitspflicht einführen? → E, F        | C, D             | topics         |   2 |   – |   2 |   0 |   1 |              5 |
| V3 + beides                          | Die Fragen sind nach Inhalt, Organisation und Technik geordnet. | Inhaltliche Fragen · 2 → A, B<br>Fragen zum Ablauf · 2 → D, E<br>Können wir mehr Beispiele zur linearen Regression bearbeiten? → A, B | C, F             | topics         |   2 |   – |   1 |   0 |   2 |              5 |

Rubrik nach 2A (D1 Quellenbindung, D2 Bedeutung der Bewertungen, D3 Trennung von Übungswunsch Ü, Prüfungsorganisation P und Kontroverse K, D4 Kennzeichnung von Lücken, D5 sichtbare Anliegen), je 0–2. D2 wird nicht bewertet: Kategorien und Themen ignorieren Stimmen, deren Deutung bleibt beim Regelkern (2A). Die Bewertungsregeln stehen mechanisch im Skript (`check-group-scenario.mts`). Bewertet wird nur die Karte »Häufige Themen«, die 2B speist; Stimmen sind nicht gesetzt.
