# Referat 2B – Last wiederholt: Queue-Überlauf bei hoher Einreichungsrate

Commit `b2234149443e`, 2026-11-05T11:06:14.854Z, Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz × 8, Node v24.22.2. Je Rate 20 Läufe à 500 Fragen (Release-Queue, Klassifikator 8.9b).

| Rate   | Läufe | mit Queue-Überlauf | Anteil [95-%-Wilson] | Statuszeile am Ende                                                                                                            | abgewiesene Fragen je Lauf (min–max) | max. offen (min–max) | max. Event-Loop-Lücke ms (min–max) |
| ------ | ----: | -----------------: | -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | -------------------- | ---------------------------------- |
| 200/s  |    20 |                  0 | 0 % [0 %; 16 %]      | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. ×20                                                             | 0–0                                  | 3–3                  | 20.3–40.8                          |
| 1000/s |    20 |                  4 | 20 % [8 %; 42 %]     | Die Fragen sind grob nach Inhalt, Ablauf und Technik sortiert. ×16, Die automatische Sortierung ist gerade nicht verfügbar. ×4 | 0–88                                 | 18–112               | 19.4–35.4                          |

Gültigkeitsgrenze: ein Prozess auf dem Messrechner; die Überlaufgrenze hängt von der CPU-Zeit je Klassifikation ab.
