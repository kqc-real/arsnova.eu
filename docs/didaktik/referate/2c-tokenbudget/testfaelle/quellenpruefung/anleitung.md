# Quellenbelege mit bekannten Fehlern prüfen

Zehn vorbereitete Antworten durchlaufen den Backend-Adapter, die Formatprüfung und die abschließende Quellenbindung. Die Antworten stehen vorab fest. Qwen wird dafür nicht aufgerufen.

Der Test prüft auch die Validierungsstufen der gespeicherten Modellantworten. Die Abgabe umfasst 56 solcher Aufrufe einschließlich vier Warm-ups. Dazu braucht er die drei Messserien im selben Arbeitsverzeichnis.

Die Befehle laufen aus dem Studienverzeichnis nach der [gemeinsamen Einrichtung](../../README.md#messungen-wiederholen). Nach den drei Messserien (`640`, `1024`, `erweitert`) ausführen:

```bash
bash messreihe/versuch.sh kontrollen
```

[Testcode](../../extended_experiments/quellenpruefung.test.ts)

[Alle Ergebnisse dieses Testfalls](ergebnisse.md) · [Übersicht und Einrichtung](../../README.md)
