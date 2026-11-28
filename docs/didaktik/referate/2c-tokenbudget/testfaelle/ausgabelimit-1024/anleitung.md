# Folgeversuch · 1.024 statt 640 Ausgabetoken

Hat eine Antwort zu wenig Platz, kann das strukturierte JSON mitten im Text enden. Wir prüfen, ob ein höheres Limit die Ausgabe oder die Laufzeit verändert.

1. Dieselben zwei Datensätze und dieselben zwei Eingabevarianten wie im [640er-Test](../kontext-640/anleitung.md) vorbereiten. Die Quellenreserve bei der Auswahl bleibt gleich.
2. Ausschließlich das Ausgabelimit der Modellanfrage auf 1.024 erhöhen. Nach zwei Warm-ups folgen fünf Wiederholungen je Bedingung.
3. Nach Datensatz, Eingabe und Wiederholung paaren. Rohtext, Hostausgabe, verbrauchte Token und Zeit vom Packen bis zur geprüften Ausgabe vergleichen.

Nach der [Einrichtung](../../README.md#messungen-wiederholen) im Studienverzeichnis ausführen:

```bash
bash messreihe/versuch.sh measure 1024
```

[Testcode](../../messreihe/qa-kurzfassung.test.ts) · [Ergebnisse aller Läufe](ergebnisse.md)
