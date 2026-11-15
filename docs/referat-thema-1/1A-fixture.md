# Gemeinsame Fixture für die Ressourcenisolation auf dem Anwendungshost

Dieses Dokument beschreibt Schritt 2 des [A1-Versuchsvertrags](./1A-experiment-contract.md).
Niklas verantwortet die Fixture-Werkzeuge, die auch für die Aufträge 1B und 1C
verwendet werden ([Issues #9](https://github.com/NiklasSkulll/arsnova.eu/issues/9)
und [#10](https://github.com/NiklasSkulll/arsnova.eu/issues/10)). Die vorhandenen
[Referenzfixtures aus Issue #456](../../libs/shared-types/src/moderation-prompt-context-fixtures.ts)
bleiben die maßgebliche Quelle für die sechs Fragen und ihre Metadaten.

## Offline erzeugen und prüfen

Die Node-Version aus `.nvmrc` verwenden, beispielsweise mit `nvm use`, und vor
dem CLI-Aufruf die gemeinsame Bibliothek bauen:

```bash
npm run build -w @arsnova/shared-types
npm run load:resource-isolation:fixture -- --validate
npm run load:resource-isolation:fixture:test
```

Die Validierungsübersicht enthält Version, Seed, SHA-256-Hash, Datensatzgrößen
und die Zuständigkeit für das gemeinsame Artefakt. Die vollständige JSON-Ausgabe
lässt sich ohne die zusätzliche npm-Befehlsausgabe so prüfen:

```bash
node scripts/load/resource-isolation-fixture.mjs --print > /tmp/arsnova-1a-fixture.json
```

Beide Betriebsarten arbeiten ohne Netzwerk, Datenbank, Modelldownloads oder
Zugangsdaten aus der Umgebung. Sie legen keine Sessions an, befüllen keine
Datenbank und führen keinen Lasttest aus. Das
[Versuchsskript aus Schritt 6](./1A-versuchsreihe.md) importiert dieselbe Fixture
in fünf getrennte Analysesessions und hält die Live-Session davon getrennt.

## Inhalt und Projektionen

| Abschnitt                    | Bedeutung                                                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reference`                  | Sechs Originaltexte und vollständige Fragenmetadaten einschließlich `PENDING`-Status, Stimmenzahlen, Scores, Unsicherheit und einer Teilnehmerbezugsgröße von 200                   |
| `counterCases`               | Vorhandene Nullwerte bei Stimmen (`unrated`), nicht verfügbare Bewertungen (`missing-votes`), unsichere NLP-Klassifikation (`uncertain-nlp`) und ausstehende Moderation (`pending`) |
| `analysis.questions`         | Genau 500 zulässige, unterschiedliche Rohtexte: sechs projizierte Referenzfragen, zwei Gegenfälle und 492 Füllfragen                                                                |
| `analysis.exclusionControls` | Drei zusätzliche Fragen mit den Status `PENDING`, `ARCHIVED` und `DELETED`; sie gehören nicht in die eigentliche Analyseeingabe                                                     |

Jeder Aufruf liefert unabhängige Daten. Eine Änderung an der A1-Projektion kann
weder die gemeinsame Referenzfixture noch eine andere erzeugte Kopie verändern.
Die ursprünglichen Paare A/B, C/D und E/F bleiben Annahmen für Kontexttests und
sind keine Erwartung an einen realen Encoder.

In der A1-Analyseprojektion bleibt `PINNED` angeheftet; andere Status der
Referenzfragen werden zu `ACTIVE`. Positive und negative Stimmenzahlen bleiben
erhalten; `upvoteCount` enthält den vorzeichenbehafteten Stimmensaldo. Die
Teilnehmerbezugsgröße bleibt 200 und ist unabhängig vom Live-Lastprofil mit
500 Beitritten. Das Versuchsskript aus Schritt 6 speichert die
Ausschlusskontrollen mit ihrem angegebenen Status.
Damit enthält der gespeicherte A1-Datensatz 503 Fragen; für die Analyse zulässig
bleiben 500.

Nicht verfügbare Bewertungen bleiben im Kontextgegenfall ausdrücklich nicht
verfügbar und werden nicht als Analysefragen mit Nullwerten ausgegeben. Der
Nullwertfall enthält ausdrücklich verfügbare Stimmenzahlen und Scores mit dem
Wert null. Der Unsicherheitsfall übernimmt die vorhandenen unsicheren
NLP-Metadaten. Diese Metadatenfälle aktivieren den abgeschalteten
Q&A-Klassifikator nicht.

Die Füllfragen verwenden die vorhandenen deutschen Referenzsätze, weil das
Versuchsprotokoll die Sprache `de` festlegt. Die über den Seed gesteuerte
Satzauswahl und numerische Zusätze sorgen dafür, dass sich alle 500 Analysetexte
vor der Normalisierung unterscheiden. Die beiden ausgewählten Gegenfälle der
Analyse erhalten den Zusatz `(0)`; ihre Kontextfassungen behalten den
Originaltext. Die Zusätze der Füllfragen reichen von `(1)` bis `(492)`.

Dieser kontrollierte Korpus wiederholt bewusst einen kleinen Wortschatz. Er
belastet den Pfad für 500 Einträge, ohne dass die Deduplizierung der Rohtexte den
Umfang reduziert. Er bildet jedoch keine breite sprachliche Vielfalt ab und
belegt keine Modellqualität. Tatsächliche Nutzlastgrößen, Sidecar-Aufrufe und
erfolgreiche Normalisierung müssen weiterhin in einem Laborvorlauf geprüft werden.

## Identität und Reproduzierbarkeit

Die Standardversion lautet `resource-isolation-fixture-v1`; ihr Seed ist dezimal
`438314513` (`0x1a202611`). Andere vorzeichenlose 32-Bit-Seeds in Dezimalschreibweise
werden ebenfalls akzeptiert:

```bash
node scripts/load/resource-isolation-fixture.mjs --validate --seed 0
node scripts/load/resource-isolation-fixture.mjs --print --seed 0
```

Für die Auswahl der Füllfragen wird die vorzeichenlose Rekurrenz
`state = (1664525 * state + 1013904223) modulo 2^32` verwendet. Anschließend wählt
`state modulo 6` einen Referenzsatz aus. Dieses Verfahren dient der
Reproduzierbarkeit; es ist weder ein kryptografischer Zufallsgenerator noch ein
Modell für eine repräsentative Stichprobe.

Das Hashmaterial umfasst die gesamte Fixture: kompaktes UTF-8-JSON mit rekursiv
sortierten Objektschlüsseln und unveränderter Arrayreihenfolge, ohne abschließenden
Zeilenumbruch. Über diese Bytes wird SHA-256 berechnet. Die CLI ergänzt für die
Terminalausgabe einen Zeilenumbruch. Bei einer unabhängigen Hashprüfung der
ausgegebenen Datei muss dieser Zeilenumbruch ausgeschlossen werden. Dieser lokale
Serialisierungsvertrag beansprucht keine Konformität mit einem gesonderten
Standard zur JSON-Kanonisierung.

Für die Standardfixture aus Schritt 2 lautet der Hash:

```text
da24eeb3db1f7e08399583f527bf5f889ccb98cddd67fd0be84ec0e4dea17ded
```

Das versionierte
[Fixture-Manifest](../../scripts/load/fixtures/resource-isolation-v1.manifest.json)
hält diese Standardidentität fest. Ein Regressionstest gleicht sie mit den
erzeugten Inhalten ab. Das Manifest identifiziert die Testeingaben; es ist kein
Laufmanifest und enthält keine Aussage über freigegebene Hardware, eine
Release-Baseline oder Messergebnisse.

Erzeugte Version, Seed und Hash in jedem Laufmanifest festhalten. Änderungen an
Texten, Metadaten, Projektion, Seed oder Quellfixture verändern den Hash. Vor dem
Vergleich von Messungen zunächst die Hashes vergleichen und jede bewusste
Fixture-Änderung dokumentieren. Zur Laufzeit erzeugte Session- und Fragen-IDs
sowie Zugangsdaten gehören in eine getrennte, kurzlebige Laborzuordnung und
werden nicht zur kanonischen Fixture hinzugefügt. Beim Prüfen geladener Daten
diese vor dem Inhaltsvergleich wieder auf die Fixture-Schlüssel abbilden. Die
Laufzeitzuordnung und das gehashte Artefakt bleiben getrennt.

## Validierung

Die Fixture-Tests prüfen den Erhalt der Referenzdaten, fehlende gegenüber
nullwertigen Bewertungen, Analysezulässigkeit, eindeutige Texte, Kompatibilität
mit den tatsächlichen gemeinsamen Schemas, Seed-Grenzen, unabhängige Kopien,
kanonische Serialisierung und die Auswirkung von Inhaltsänderungen auf den Hash.
Die CLI-Tests starten den tatsächlichen Prozess, vergleichen Übersichten mit der
vollständigen Ausgabe und weisen ungültige Betriebsarten und Seeds zurück.
Zusätzlich übergeben sie unbrauchbare Verbindungseinstellungen, um zu prüfen,
dass die Fixture-Erzeugung keine konfigurierten Dienste benötigt.

`npm test` und `npm run test:coverage` führen den Fixture-Testbefehl aus. Damit
enthält auch der bestehende CI-Coverage-Job diese Prüfungen. Vor diesen Node-Tests
wird Shared-Types gebaut, damit sie die aktuellen öffentlichen Paketexporte verwenden.
