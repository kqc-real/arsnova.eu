# Wie viele Fragen erreichen Qwen?

Das Ausgangsmaterial kann mehr Fragen enthalten, als arsnova für die Kurzfassung auswählt. Diese Auswertung verwendet die bereits gespeicherten Eingaben der beiden Hauptversuche.

1. Die Fragen im Ausgangsdatensatz zählen.
2. Die übergebenen Quellen-IDs im gepackten Kontext und in der Textvariante abgleichen.
3. Ausgewählte, ausgelassene und gekürzte Quellen je Datensatz zählen. Die beiden Ausgabelimits nutzen dieselbe Quellenauswahl.

Der Packschritt lässt sich nach der [Einrichtung](../../README.md#messungen-wiederholen) ohne Modellaufruf wiederholen:

```bash
bash messreihe/versuch.sh pack 640
```

[Testcode](../../messreihe/qa-kurzfassung.test.ts) · [Auswertung](../../messreihe/auswerten.py) · [Ergebnisse](ergebnisse.md)
