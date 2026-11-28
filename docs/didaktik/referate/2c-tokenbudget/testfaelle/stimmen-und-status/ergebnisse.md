# Ergebnisse · Stimmen und Status als zusätzliche Eingabe

## Messung vom 8. November 2026

Mit Stimmen und Status stieg die Eingabe B von 296 auf 440 Token. Die Antwort schrumpfte von 289 auf 245 Token, die mediane Komponentenzeit sank von 3,430 auf 2,990 s. Stimmen und Status wurden gemeinsam ergänzt.

Alle 6 gewerteten Antworten waren vollständiges JSON mit erlaubten IDs. Der Formfilter lehnte alle ab. A enthält die Registerdaten. B enthält die Fragetexte und IDs sowie Status und Stimmen. Die Zeit reicht vom Packen bis zur geprüften Ausgabe.

| Lauf-ID              | Eingabetoken | Ausgabetoken | Erstes Textfragment (ms) | Komponentenzeit (s) | Vollständiges JSON | Hostausgabe |
| -------------------- | ------------ | ------------ | ------------------------ | ------------------- | ------------------ | ----------- |
| erweitert-R1-meta6-A | 2158         | 372          | 617,3                    | 5,182               | ja                 | Ersatz      |
| erweitert-R1-meta6-B | 440          | 245          | 126,1                    | 2,990               | ja                 | Ersatz      |
| erweitert-R2-meta6-A | 2158         | 372          | 800,6                    | 5,951               | ja                 | Ersatz      |
| erweitert-R2-meta6-B | 440          | 245          | 128,0                    | 3,021               | ja                 | Ersatz      |
| erweitert-R3-meta6-A | 2158         | 372          | 616,3                    | 5,069               | ja                 | Ersatz      |
| erweitert-R3-meta6-B | 440          | 245          | 129,0                    | 2,964               | ja                 | Ersatz      |

[Anleitung](anleitung.md) · [Originaleingaben, Modelltexte und Hostausgaben](../../extended_experiments/rohdaten-erweitert.jsonl) · [Vergleichsläufe bei 1.024 Token](../ausgabelimit-1024/ergebnisse.md) · [Prüfung pro Ausgabe](../../extended_experiments/pruefstufen.json)

### Inhalt von Qwens Kurzfassungen

In B erwähnt Qwen mit und ohne Zusatzfelder beide übermittelten Anliegen. Ohne Zusatzfelder schreibt es »Verpflichtende Anwesenheit ist nicht spezifiziert.« Mit den zusätzlichen Angaben schreibt es »Verpflichtende Anwesenheit ist umstritten.« Die 40 positiven und 40 negativen Stimmen stützen die Deutung, dass die Frage die Gruppe teilt. Ob tatsächlich Anwesenheitspflicht gilt, bleibt offen. Welche der beiden Ergänzungen den Wortlaut verändert hat, lässt sich aus diesem Vergleich allein nicht bestimmen. In A ist die Rohantwort identisch mit S6-A im Budgetversuch. Qwen bleibt in seinen vier Aussagen bei der Anwesenheit und lässt die Prüfungsfrage aus. [Eingaben mit Zusatzfeldern](../../extended_experiments/rohdaten-erweitert.jsonl#L22-L23) · [Modellantworten mit Zusatzfeldern](../../extended_experiments/rohdaten-erweitert.jsonl#L8-L9) · [Modellantworten des Budgetversuchs](../../messreihe/rohdaten-1024.jsonl#L5-L6)
