# A1 – Vorabnachtrag für die Messreihe auf main a19ca70f

Festgehalten am 14.11.2026 vor dem neuen Vorlauf und den bestätigenden Läufen.
Auftrag: [Issue #6](https://github.com/NiklasSkulll/arsnova.eu/issues/6).
Dieser Nachtrag enthält keine neuen Messwerte und keine Betriebsfreigabe.

## Ziel und Entscheidung

Die A1-Ergebnisse sollen den nach dem Merge übernommenen Anwendungsstand
untersuchen. Anwendungsbaseline ist der unveränderte Fork-main-Commit
`a19ca70ff37dcb5510a77ab2745c06b70ccc3565`. Messwerkzeuge und ihr Commit
werden davon getrennt identifiziert. Produktionscode und der bekannte
sachfremde Frontend-Wording-Test bleiben unverändert.

Gewählt ist eine ausdrücklich auswählbare Reihendefinition statt des Ersetzens
der historischen Baseline-Konstanten. Die vorhandene Auswertung behält ihren
bisherigen Aufruf; neue Reihen verlangen ihre geprüfte Definition. Eine bloße
Neuberechnung alter Daten untersucht den neuen Anwendungsstand nicht.

## Unveränderte Methodik und neue Sollkonfiguration

Es gelten Hypothesen, Gegenalternative, Fixture, Lastprofil, Auswertung,
Grenzwerte und fünf randomisierte Blöcke V0–V4 aus dem eingefrorenen
[Versuchsvertrag Version 2](../1A-experiment-contract.md), SHA-256
`f7d3eba4b82a3f3a47c914665ac8a7be4988b9061deff6b857a79d2fcf766ab7`.
Seed: `438314513`. Die neue Reihe erhält einen eigenen Evidenzordner und
mischt keine Läufe oder Vorläufe der ursprünglichen Baseline hinein.

Der PDF-Worker verwendet gemäß der neuen Baseline `pids_limit: 256` statt
128; CPU bleibt 1 und RAM 1 GiB. Die übrigen im Auswerter geprüften
Dienstlimits bleiben gleich. Das ist eine übernommene Baseline-Einstellung,
keine Optimierung durch A1. Anwendung und spaCy werden aus einem sauberen
Export dieser Revision gebaut und über unveränderliche Image-IDs verwendet.

Die Laborbedingungen bleiben eigener WSL2-Rechner, Lastgenerator auf demselben
Host und cgroup v2. Die tatsächliche Hardware steht in jedem Laufmanifest;
eine Produktionskapazitätsfreigabe wird nicht behauptet. Während der Messung
finden keine Builds oder weiteren Lastversuche statt.

## Nachweiskette

Vor dem Beginn jeder Phase wird die tatsächlich aufgelöste Compose-Konfiguration
per Positivliste bereinigt. Je Lauf werden getrennte Konfigurationen für
Aufwärmung und Messung mit Dateiname und SHA-256 im jeweiligen Manifest
referenziert. Die Auswertung prüft ihre Integrität sowie Images, Limits und
freigegebene Flags gegen die aufgezeichneten Dienste. Secrets und private
Hostpfade werden nicht übernommen. Eine Rekonstruktion der alten Reihe
ersetzt diese neuen zeitgenössischen Aufnahmen nicht.

Die Reihendefinition bindet Baseline, diesen Nachtrag, den alten Vertrag,
Seed und PDF-Worker-Limit. Ihr Hash muss über Vorlauf, Abschluss und sämtliche
Phasen gleich bleiben. Änderungen an Definition, Nachtrag oder Werkzeugen
zwischen Vorlauf und Hauptreihe erfordern einen neuen Vorlauf in einem neuen
Evidenzordner. Fehlende Daten führen zum Abbruch; Grenzverletzungen bleiben
Ergebnisse und werden nicht nachträglich passend gemacht.

## Umsetzung und Prüfung

- [ ] Definition und ihre Quellenhashes prüfen; abweichende Baseline ablehnen.
- [ ] Compose-Aufnahmen speichern; beschädigte oder widersprüchliche Belege ablehnen.
- [ ] Historische Auswertung weiter prüfen und neue Auswahl über die CLI testen.
- [ ] Neue Images und lokale Laborzuordnung vorbereiten, Vorlauf durchführen.
- [ ] Alle 25 Läufe abschließen und gegen dieselbe Reihendefinition auswerten.
- [ ] Neue Befunde fachlich bewerten; erst danach Ergebnisdokumentation und PDFs aktualisieren.

Die vorhandenen PDF-Vorlagen sind auf die alten Befunde begrenzt und werden
nicht automatisch für die neue Reihe freigegeben. Persönliche Gegenprüfung,
KI-Kennzeichnung, Abstimmung und GitHub-Abschluss bleiben eigenständige Schritte.
