# Referat 2B – Last wiederholt: Queue-Überlauf bei hoher Einreichungsrate

Commit `74091b0a6468`, 2026-11-08T23:26:27.135Z, Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz × 8, Node v24.22.2. Je Rate 20 Läufe à 500 Fragen (Release-Queue, Klassifikator 8.9b).

| Rate   | Läufe | mit Queue-Überlauf | Anteil [95-%-Wilson] | Statuszeile am Ende                                                                                                                 | abgewiesene Fragen je Lauf (min–max) | max. offen (min–max) | max. Event-Loop-Lücke ms (min–max) |
| ------ | ----: | -----------------: | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------- | ---------------------------------- |
| 200/s  |    20 |                  0 | 0 % [0 %; 16 %]      | Die Fragen sind nach Inhalt, Organisation und Technik geordnet. ×20                                                                 | 0–0                                  | 3–3                  | 20.5–24.3                          |
| 1000/s |    20 |                  3 | 15 % [5 %; 36 %]     | Die Fragen sind nach Inhalt, Organisation und Technik geordnet. ×17, Die Fragen können gerade nicht automatisch geordnet werden. ×3 | 0–86                                 | 17–106               | 19.3–33                            |

Gültigkeitsgrenze: ein Prozess auf dem Messrechner; die Überlaufgrenze hängt von der CPU-Zeit je Klassifikation ab.
