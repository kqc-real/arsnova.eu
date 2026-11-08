# Ergebnisse · Längere Texte im 100er-Datensatz

## Messung vom 8. November 2026

Der erste Packversuch mit acht Textzusätzen überschritt die Grenze von 500 Zeichen bereits vor der Inferenz. Mit fünf Zusätzen lief der Test vollständig. Gegenüber S100 übergab der Packer acht gekürzte statt zehn kurzer Texte. In A stieg die mediane Dauer von 7,284 auf 7,621 s, in B sank sie von 6,707 auf 6,445 s. Zahl der Texte und Länge der Antwort änderten sich mit. [Protokoll beider Packversuche](../../messreihe/pruefprotokoll.txt)

Alle 6 gewerteten Antworten waren vollständiges JSON mit erlaubten IDs. Der Formfilter lehnte alle ab. A enthält die ausgewählten Registerdaten. B enthält die Fragetexte und IDs. Die Zeit reicht vom Packen bis zur geprüften Ausgabe.

| Lauf-ID                | Eingabetoken | Ausgabetoken | Erstes Textfragment (ms) | Komponentenzeit (s) | Vollständiges JSON | Hostausgabe |
| ---------------------- | ------------ | ------------ | ------------------------ | ------------------- | ------------------ | ----------- |
| erweitert-R1-long100-A | 2046         | 604          | 574,5                    | 7,994               | ja                 | Ersatz      |
| erweitert-R1-long100-B | 767          | 560          | 208,6                    | 6,460               | ja                 | Ersatz      |
| erweitert-R2-long100-A | 2046         | 604          | 580,1                    | 7,621               | ja                 | Ersatz      |
| erweitert-R2-long100-B | 767          | 560          | 209,3                    | 6,445               | ja                 | Ersatz      |
| erweitert-R3-long100-A | 2046         | 604          | 581,0                    | 7,553               | ja                 | Ersatz      |
| erweitert-R3-long100-B | 767          | 560          | 211,6                    | 6,325               | ja                 | Ersatz      |

[Anleitung](anleitung.md) · [Originaleingaben, Modelltexte und Hostausgaben](../../extended_experiments/rohdaten-erweitert.jsonl) · [Vergleichsläufe bei 1.024 Token](../ausgabelimit-1024/ergebnisse.md) · [Prüfung pro Ausgabe](../../extended_experiments/pruefstufen.json)

### Inhalt von Qwens Kurzfassungen

Beide Varianten greifen alle drei übermittelten Themen auf. In A bleibt offen, ob Kapitel 4 geprüft wird. Qwen verbindet allerdings die Bitte um Regressionsbeispiele mit einer angeblichen Frage nach deren Prüfungsrelevanz. Die beiden dafür zitierten Texte bitten um Beispiele und Erläuterungen. In B schreibt Qwen: »Kapitel 4 und spezifische Aufgaben sind klausurrelevant und benötigen ausführliche Erklärungen.« Die zitierten Studierendenfragen enthalten keine solche Auskunft. Schon im gekürzten Wortlaut ist der Unterschied zwischen einer Frage und einer Bestätigung erkennbar. Auch bei den kurzen Fragen hatte B die Prüfungsrelevanz als bestätigt bezeichnet. [Anfragen mit gekürzten Quellen](../../extended_experiments/rohdaten-erweitert.jsonl#L20-L21) · [Qwens Antworten A und B](../../extended_experiments/rohdaten-erweitert.jsonl#L6-L7) · [Vergleich mit kurzen Fragen](../../messreihe/rohdaten-1024.jsonl#L3-L4)
