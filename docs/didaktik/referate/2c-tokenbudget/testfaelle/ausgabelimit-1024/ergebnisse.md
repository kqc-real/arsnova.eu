# Ergebnisse · Ausgabelimit von 1.024 Token

Es gab zwei Warm-ups (P0) und 20 gewertete Läufe (R1–R5). A umfasst die ausgewählten Registerdaten, B nur die ausgewählten Fragen und ihre IDs. Die Zeit reicht vom Packen der Eingabe bis zur geprüften Backend-Ausgabe. [Anleitung](anleitung.md)

## Messung vom 8. November 2026

Alle 20 Modellantworten hatten vollständiges JSON und zulässige Quellen-IDs. Der Formfilter lehnte alle 20 ab. In S6-B fehlte etwa eine Themenüberschrift. Für die Inhaltsbewertung ist Qwens generierter Wortlaut maßgeblich.

| Datensatz | Eingabe | Eingabetoken | Ausgabetoken | Dauer (Median) |
| --------- | ------- | ------------ | ------------ | -------------- |
| S6        | A       | 2158         | 372          | 5,160 s        |
| S6        | B       | 296          | 289          | 3,430 s        |
| S100      | A       | 2211         | 564          | 7,284 s        |
| S100      | B       | 748          | 586          | 6,707 s        |

### Alle Läufe einschließlich Warm-ups

[Rohantworten, Requests und technische Ausgabe je Lauf](../../messreihe/rohdaten-1024.jsonl)

| Lauf-ID        | Eingabetoken | Ausgabetoken | Erstes Textfragment (ms) | Komponentenzeit (s) | Vollständiges JSON | Hostausgabe |
| -------------- | ------------ | ------------ | ------------------------ | ------------------- | ------------------ | ----------- |
| 1024-P0-S100-A | 2211         | 564          | 660,4                    | 7,381               | ja                 | Ersatz      |
| 1024-P0-S100-B | 748          | 586          | 210,0                    | 6,723               | ja                 | Ersatz      |
| 1024-R1-S100-A | 2211         | 564          | 635,5                    | 7,276               | ja                 | Ersatz      |
| 1024-R1-S100-B | 748          | 586          | 208,7                    | 6,801               | ja                 | Ersatz      |
| 1024-R1-S6-A   | 2158         | 372          | 612,1                    | 5,173               | ja                 | Ersatz      |
| 1024-R1-S6-B   | 296          | 289          | 93,2                     | 3,420               | ja                 | Ersatz      |
| 1024-R2-S100-A | 2211         | 564          | 632,7                    | 7,282               | ja                 | Ersatz      |
| 1024-R2-S100-B | 748          | 586          | 212,7                    | 6,703               | ja                 | Ersatz      |
| 1024-R2-S6-A   | 2158         | 372          | 638,6                    | 5,100               | ja                 | Ersatz      |
| 1024-R2-S6-B   | 296          | 289          | 94,8                     | 3,430               | ja                 | Ersatz      |
| 1024-R3-S100-A | 2211         | 564          | 645,7                    | 7,284               | ja                 | Ersatz      |
| 1024-R3-S100-B | 748          | 586          | 206,9                    | 6,707               | ja                 | Ersatz      |
| 1024-R3-S6-A   | 2158         | 372          | 627,1                    | 5,160               | ja                 | Ersatz      |
| 1024-R3-S6-B   | 296          | 289          | 90,6                     | 3,350               | ja                 | Ersatz      |
| 1024-R4-S100-A | 2211         | 564          | 636,7                    | 7,316               | ja                 | Ersatz      |
| 1024-R4-S100-B | 748          | 586          | 211,0                    | 6,858               | ja                 | Ersatz      |
| 1024-R4-S6-A   | 2158         | 372          | 618,6                    | 5,178               | ja                 | Ersatz      |
| 1024-R4-S6-B   | 296          | 289          | 98,7                     | 3,437               | ja                 | Ersatz      |
| 1024-R5-S100-A | 2211         | 564          | 640,3                    | 7,355               | ja                 | Ersatz      |
| 1024-R5-S100-B | 748          | 586          | 217,6                    | 6,703               | ja                 | Ersatz      |
| 1024-R5-S6-A   | 2158         | 372          | 628,1                    | 5,135               | ja                 | Ersatz      |
| 1024-R5-S6-B   | 296          | 289          | 104,0                    | 3,455               | ja                 | Ersatz      |

### Vergleich der beiden Ausgabelimits

In allen 20 Paaren war der Rohtext bytegleich. Die vier Eingaben benötigten je 289 bis 586 Ausgabetoken und lagen bereits unter 640. Die Komponentenzeit änderte sich im Median der Paardifferenzen um −0,006 s (1.024 minus 640). Die zusätzliche Reserve behob in diesen Fällen keinen Formfehler. [Alle 20 Paare](../../messreihe/tabellen/budgetpaare.csv)

Auch die inhaltlichen Befunde blieben gleich. Bei S6-A fehlte weiterhin die übermittelte Prüfungsfrage. S6-B gab beide Fragen als offen wieder. Bei S100-A blieb der Prüfungsumfang offen, während S100-B die Fragen zu Kapitel 4 fälschlich als Bestätigung der Klausurrelevanz deutete. [Inhaltsbewertung der vier wortgleichen Kurzfassungen](../kontext-640/ergebnisse.md#inhalt-von-qwens-kurzfassungen) · [Rohantworten bei 1.024 Token](../../messreihe/rohdaten-1024.jsonl#L3-L6) · [Zugehörige Anfragen](../../messreihe/rohdaten-1024.jsonl#L30-L33)
