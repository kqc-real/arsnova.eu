# Stimmen und Status als zusätzliche Eingabe

Der Test verwendet S6. In A erhält Qwen die gewöhnlichen Registerdaten. In B erhält es dieselben Texte und IDs sowie den Status und die Stimmen je Frage. Die Referenz ist das gewöhnliche S6-B ohne diese beiden Zusatzfelder. Geprüft wird unter anderem, ob Qwen die geteilten Stimmen zur Anwesenheit zutreffend wiedergibt.

Der [Test für die Kurzfassung](../../messreihe/qa-kurzfassung.test.ts) führt die Szenarien gemeinsam aus. Für diesen Test gibt es drei Messläufe in A und drei in B, jeweils mit 1.024 Ausgabetoken. Im Roharchiv ist dieser Test am Namen **meta6** erkennbar.

Die Befehle laufen aus dem Studienverzeichnis nach der [gemeinsamen Einrichtung](../../README.md#messungen-wiederholen). Diese beiden Befehle erzeugen beide Erweiterungstests in **einer** Serie. Einmal ausführen genügt.

```bash
bash messreihe/versuch.sh pack erweitert
bash messreihe/versuch.sh measure erweitert
```

[Versuchsplan](../../messreihe/methodik.md) · [Referenz bei 1.024 Token](../ausgabelimit-1024/ergebnisse.md)

[Alle Ergebnisse dieses Testfalls](ergebnisse.md) · [Übersicht und Einrichtung](../../README.md)
