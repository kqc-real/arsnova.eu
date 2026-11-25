# A1-Messnachweise

Stand: 15.11.2026. Ausschließlich die aktuelle vollständige Reihe
[reihe-main-a19ca70f-20261115-122547](./reihe-main-a19ca70f-20261115-122547/) bleibt im Arbeitsbaum.
Alte Reihen, abgebrochene Anläufe, Rekonstruktionen und alte Prüf-/Auswertungsordner
wurden auf Wunsch des Bearbeiters entfernt. Frühere Fassungen sind über Git erreichbar.
Andere Aufträge 1B/1C sind davon nicht betroffen.

## Aktuelle Belege

| Datei innerhalb der Reihe                                            | Inhalt                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `abschluss.json`, `plan.json`                                        | Vollständige 25 Läufe und vorgegebene Blockreihenfolge              |
| `reihendefinition.json`, `vorabnachtrag.md`                          | Unveränderte Vorabfestlegung der aktuellen Baseline                 |
| `V*/block-*/lauf.json`                                               | Manifest, Roh-Laufzeiten, Analysen, Diagnosen und geprüfter Rückweg |
| `V*/block-*/compose-aufwaermung.json`, `compose-messung.json`        | 50 zeitgenössische bereinigte Compose-Aufnahmen                     |
| `V*/block-*/aufwaermung-ressourcen.json.gz`, `ressourcen.json.gz`    | 50 Ressourcenartefakte; 31 beziehungsweise 151 Stichproben          |
| `V*/block-*/report.json`, `report.xml`                               | Erfassungsstatus je Lauf                                            |
| `vorlauf/`                                                           | Erfolgreicher passender Vorlauf mit fünf verkürzten Varianten       |
| `auswertung/auswertung.json`, `auswertung.md`, `live-vergleiche.csv` | Reproduzierbare Rechnung mit 80 Vergleichen                         |

Anwendungsbaseline: `a19ca70ff37dcb5510a77ab2745c06b70ccc3565`.
Rechner und Image-/Werkzeugidentitäten sind im JSON und den Laufmanifesten belegt.
[Auswertung und Entscheidung](../../1A/1A-auswertung.md) enthalten die fachliche Interpretation.
[Durchführung](../../1A/archiv/1A-neue-messreihe.md) beschreibt neue Messungen;
[Prüfstand](../../1A/archiv/1A-pruefstand.md) dokumentiert die aktuelle Bereinigung.

## Dateiintegrität

Die Roh-JSON-Dateien sind von Prettier ausgenommen. Bei der Bereinigung wurden
105 umformatierte Dateien ausschließlich dann in die ursprüngliche JSON-Schreibweise
zurückgesetzt, wenn deren SHA-256 exakt dem bereits vorliegenden Nachweis entsprach.
95 Dateien gehören zur Hauptreihe, zehn Compose-Aufnahmen zum Vorlauf.
Es wurden keine Messwerte oder Manifestprüfsummen geändert.
Die unabhängige Neuauswertung vor weiteren Werkzeuganpassungen ergab wieder
byteidentisch die gespeicherte `auswertung.json`.
Der Vorabvertrag und Nachtrag bleiben trotz älterem Erstellungsdatum unverändert:
Sie sind hashgebundene Eingaben der aktuellen Messung, keine alten Ergebnisberichte.

```bash
npm run load:resource-isolation:evaluate -- \
  --run \
  --evidence-root docs/referat-thema-1/evidenz/1A/reihe-main-a19ca70f-20261115-122547 \
  --output-dir /tmp/arsnova-1a-integritaetspruefung
```

Der Ausgabeordner muss neu sein. `complete` bestätigt Erfassung und Rückweg,
keine bestandenen Leistungsgrenzen. Aufwärmung und Vorlauf sind keine zusätzlichen
bestätigenden Wiederholungen und werden nicht in die 25 Messfenster eingemischt.
