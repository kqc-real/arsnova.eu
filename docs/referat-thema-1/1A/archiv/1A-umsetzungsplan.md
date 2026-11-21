# A1 – Umsetzungsplan und abgeschlossener technischer Umfang

Aktualisiert 15.11.2026. Auftrag: [Issue #6](https://github.com/NiklasSkulll/arsnova.eu/issues/6).
Die sieben Schritte sind technisch umgesetzt; die
[Gesamtübersicht](./1A-komplette-Aufgabe-fertig.md) nennt Dateien und Prüfungen.
Aktuelle Ergebnisse stehen ausschließlich in der [Auswertung](../1A-auswertung.md).

1. **Versuchsvertrag festhalten:** Hypothesen, Gegenalternative, Last, Varianten und
   Schwellen vorab festlegen. Für die aktuelle Baseline gilt zusätzlich der
   [Vorabnachtrag](../../specs/2026-11-14-1a-messreihe-main-a19ca70f.md).
2. **Gemeinsame Fixture bereitstellen:** Referenzfragen, Gegenfälle und deterministischen
   Füllkorpus mit Seed und Hash verwenden; A1-Projektion und gemeinsame Herkunft kennzeichnen.
3. **Live-Messung vervollständigen:** Rohzeiten, Fehler und geplante Arbeit für Beitritt,
   Quiz, Q&A und Tempo erfassen; Beitrittswelle nicht als dauerhafte Parallelität ausgeben.
4. **Analyse-Last ergänzen:** Reguläre Host-Autorisierung, getrennte Sessions, fester Korpus
   und konstanter Zeitplan; Fallbacks und am Fensterende offene Arbeit getrennt erfassen.
5. **Ressourcen und Störung ergänzen:** CPU, RAM, cgroup-Drosselung und OOM je Generation
   messen; V4-Verzögerungsproxy ausschließlich im Labor einsetzen.
6. **Reihe ausführen:** Passenden Vorlauf und fünf randomisierte Blöcke V0–V4 durchführen;
   Manifest, Rohdaten, tatsächliche Compose-Aufnahmen und geprüften Rückweg speichern.
7. **Auswerten und dokumentieren:** Alle 80 Vergleiche nach unveränderten Kriterien
   berechnen, Grenzen und Entscheidung begründen, Abgabeentwürfe und Eigenanteil offenlegen.

## Abschlussbereinigung vom 15.11.2026

- [x] Aktuelle Reihe unabhängig neu auswerten und Dateiintegrität prüfen.
- [x] Umformatierte Rohdateien anhand vorhandener Hashes exakt wiederherstellen.
- [x] Alte A1-Reihen und überholte Auswertungs-/Prüfordner entfernen.
- [x] Tests und Dokumentbau auf die aktuelle Reihe umstellen; Rekonstruktionswerkzeug entfernen.
- [x] Lebende A1-Dokumentation und Abgabeentwürfe anhand aktueller Ergebnisse aktualisieren.

Die konkret ausgeführten Abschlussprüfungen stehen im [Prüfstand](./1A-pruefstand.md).
Persönliche Gegenprüfung, Abstimmung, institutionelle Abgabe und GitHub-Merge werden
nicht automatisch als erledigt ausgewiesen; siehe [Übergabe](./1A-abschluss-und-uebergabe.md).
