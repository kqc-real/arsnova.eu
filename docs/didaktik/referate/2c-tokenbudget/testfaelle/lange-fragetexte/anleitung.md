# Längere Texte im 100er-Datensatz

An jeden der 100 Texte wird fünfmal dieselbe Rückfrage angehängt. Die Anliegen und die Zahl der Kandidaten bleiben gleich. Der Test vergleicht mit dem normalen S100 bei 1.024 Token: Wie viele Texte wählt das Backend aus, welche kürzt es, und wie lange dauert die Kurzfassung?

Der [Test für die Kurzfassung](../../messreihe/qa-kurzfassung.test.ts) führt die Szenarien gemeinsam aus. Für diesen Test gibt es drei Messläufe in A und drei in B, jeweils mit 1.024 Ausgabetoken. Im Roharchiv ist dieser Test am Namen **long100** erkennbar.

Die Befehle laufen aus dem Studienverzeichnis nach der [gemeinsamen Einrichtung](../../README.md#messungen-wiederholen). Diese beiden Befehle erzeugen beide Erweiterungstests in **einer** Serie. Einmal ausführen genügt.

```bash
bash messreihe/versuch.sh pack erweitert
bash messreihe/versuch.sh measure erweitert
```

[Versuchsplan](../../messreihe/methodik.md) · [Referenz bei 1.024 Token](../ausgabelimit-1024/ergebnisse.md)

[Alle Ergebnisse dieses Testfalls](ergebnisse.md) · [Übersicht und Einrichtung](../../README.md)
