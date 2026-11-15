# A1: Gezielte Analyse-Last

Schritt 4 des [Umsetzungsplans](1A-umsetzungsplan.md) ergänzt
[`host-analyze-loop.mjs`](../../scripts/load/host-analyze-loop.mjs). Der
Generator ruft die vorhandene tRPC-Mutation `wordCloud.analyzeQa` mit regulären
Host-Tokens auf. Er legt keine Sessions an und verändert keine Fragen oder
Stimmen. Das gemeinsame Anlegen der Laborressourcen, Aufwärmen und Starten
mit der Live-Last ist in der [Versuchsreihe aus Schritt 6](./1A-versuchsreihe.md)
beschrieben.

## Ohne Labor nachvollziehen

```bash
nvm use
npm run build -w @arsnova/shared-types
npm run load:resource-isolation:analysis -- --validate
npm run load:resource-isolation:analysis:test
```

`--validate` erzeugt ohne Netzwerkzugriff eine Übersicht mit Fixture-Identität
und dem vollständigen Standardzeitplan. Erwartet werden 150 geplante Aufrufe:
fünf Hosts mit je 30 Terminen über 300 Sekunden. Die Tests brauchen installierte
Projektabhängigkeiten, aber keine Datenbank, keine laufende Anwendung und keine
KI-Modelle. Sie prüfen den Zeitplan mit einer kontrollierbaren Uhr sowie echte
tRPC-Aufrufe gegen einen lokalen HTTP-Testserver. Das ist ein Werkzeugnachweis
und noch kein spaCy- oder Isolationsversuch.

## Vorbereitete Sessions zuordnen

Für einen Laborlauf fünf unterschiedliche Sessions mit unterschiedlichen
Host-Tokens und dem freigegebenen A1-Korpus vorbereiten. Die Live-Session muss
davon getrennt bleiben. Die Zuordnung liegt in einer privaten temporären
JSON-Datei außerhalb des Repositories, beispielsweise
`/tmp/arsnova-1a-analysesessions.json`. Nur für die Laborbedienung speichern,
Zugriffsrechte auf den aktuellen Benutzer begrenzen und anschließend löschen.
Die Datei enthält folgende Struktur; alle Session-Zuordnungen sind durch die
tatsächlichen Werte aus dem Labor zu ersetzen:

```json
{
  "trpcUrl": "http://127.0.0.1:3000/trpc",
  "fixtureSeed": 438314513,
  "fixtureSha256": "da24eeb3db1f7e08399583f527bf5f889ccb98cddd67fd0be84ec0e4dea17ded",
  "sessions": [
    {
      "sessionId": "00000000-0000-4000-8000-000000000001",
      "sessionCode": "LAB001",
      "hostToken": "<HOST_TOKEN_1>"
    },
    {
      "sessionId": "00000000-0000-4000-8000-000000000002",
      "sessionCode": "LAB002",
      "hostToken": "<HOST_TOKEN_2>"
    },
    {
      "sessionId": "00000000-0000-4000-8000-000000000003",
      "sessionCode": "LAB003",
      "hostToken": "<HOST_TOKEN_3>"
    },
    {
      "sessionId": "00000000-0000-4000-8000-000000000004",
      "sessionCode": "LAB004",
      "hostToken": "<HOST_TOKEN_4>"
    },
    {
      "sessionId": "00000000-0000-4000-8000-000000000005",
      "sessionCode": "LAB005",
      "hostToken": "<HOST_TOKEN_5>"
    }
  ]
}
```

Seed und Hash müssen zur [gemeinsamen Fixture](1A-fixture.md) passen. Jeder
Host-Token wird ausschließlich im vorhandenen Header `x-host-token` an den
tRPC-Client übergeben. Session-Code und Session-ID ersetzen keine
Autorisierung. Die Zuordnung muss Session-ID, Code und Token derselben Session
enthalten; die regulären Backendprüfungen gelten unverändert.

Ein Aufruf im vorbereiteten Labor sieht so aus:

```bash
chmod 600 /tmp/arsnova-1a-analysesessions.json
REPORT_FILE=/tmp/arsnova-1a-analyse.json \
JUNIT_FILE=/tmp/arsnova-1a-analyse.xml \
npm run load:resource-isolation:analysis -- \
  --run --sessions-file /tmp/arsnova-1a-analysesessions.json
```

Die CLI schreibt eine bereinigte Zusammenfassung auf die Konsole und bei
gesetztem `REPORT_FILE` den vorhandenen standardisierten JSON-Report;
`JUNIT_FILE` ergänzt JUnit. Die Messwerte liegen im JSON-Report unter `metrics`.
Host-Bezeichnungen wie `host-1` sind laufbezogene Aliase. URL, Session-IDs,
Session-Codes, Tokens, Fragetexte und rohe Fehlermeldungen werden nicht in
diese Ausgabe übernommen.

## Korpus und Analyseeingabe prüfen

Vor dem Start liest der Generator je Session `qa.list` mit Host-Token,
`moderatorView: true`, `statuses: ['ACTIVE', 'PINNED']`, `sort: 'TOP'` und
`pageSize: 500`. Er verlangt genau 500 unterschiedliche Texte ohne weitere
Seite. Texte, Status sowie positive, negative und saldierte Stimmenzahlen
müssen vollständig mit der erzeugten Fixture übereinstimmen. Die aktuelle
Host-Lese- und Analyseantwort wird jeweils gegen das vorhandene gemeinsame
Zod-Schema geprüft. Bei einer fehlgeschlagenen Vorprüfung startet keine Analyse;
alle geplanten Termine bleiben als `NOT_STARTED` sichtbar.

Nach dem Auslaufen wird derselbe Abgleich wiederholt. Zusätzlich müssen die
Korpusrevisionen unverändert bleiben. Jede Analyseantwort muss 500 zulässige
und 500 analysierte Fragen sowie die passende Revision ausweisen. Der
Snapshot-Hash muss innerhalb derselben Session stabil bleiben. Auch eine nur
zwischenzeitlich beobachtete Abweichung macht `corpus.unchanged` falsch.

Die Aufrufe verwenden konstant:

```text
mode: LEXICAL, locale: de, metric: TOP, filter: ALL_ELIGIBLE,
normalization: LEMMA, limit: 500, refresh: true
```

`refresh: true` umgeht im
[`wordCloud`-Router](../../apps/backend/src/routers/wordCloud.ts) den
Snapshot-Cache. Ein Normalisiereraufruf allein belegt noch keine neue
Sidecar-Arbeit: Dafür ist zusätzlich die tatsächlich verwendete
Cacheimplementierung maßgeblich. In der für Schritt 6 festgehaltenen
`main`-Baseline liefert `createRedisWordCloudAnalysisCache().getText()`
aus Datenschutzgründen immer `null`; `setText()` persistiert keine Tokens.
Die [Versuchsreihe](./1A-versuchsreihe.md) prüft trotzdem den tatsächlichen
Anstieg von `sidecarCalls` sowie Cachetreffer in der Backenddiagnostik.
Dieses Werkzeug ändert weder Produktivcode noch Cachevorgaben.

Der Generator prüft den zulässigen Analysekorpus, aber nicht den vollständigen
physischen Bestand einschließlich Ausschlusskontrollen oder die
Teilnehmerbezugsgröße. Diese zusätzlichen Fixture-Nachweise gehören zur
Laborvorbereitung in Schritt 6.

## Zeitplan und Ergebnisklassen

Standardmäßig beginnt alle zehn Sekunden ein neuer Termin pro Host, mit
Versätzen von 0, 2, 4, 6 und 8 Sekunden. Maßgeblich ist eine monotone Uhr. Die
Laufzeit beginnt nach der Korpusvorprüfung; die exportierte Funktion erlaubt
einen gemeinsamen monotonen Startzeitpunkt für die spätere Orchestrierung.
Ein solcher Startzeitpunkt muss aus derselben Uhr stammen. Frühzeitiges
Aufwachen eines Timers startet keinen Aufruf vor seinem Termin.

Pro Host läuft höchstens ein clientseitiger Analyseaufruf gleichzeitig. Ein
belegter Host überspringt den nächsten Termin. Gerät der Lastgenerator um
mindestens ein ganzes Aufrufintervall in Rückstand, wird ein veralteter Termin
ebenfalls übersprungen. Spätere Termine werden nicht verschoben und alte
Termine nicht als zusätzliche Welle nachgeholt. Nach dem Ende des Fensters
startet keine neue Arbeit.

Jeder geplante Termin erscheint genau einmal in `analysis.calls`, mit Host-Alias,
geplantem und tatsächlichem Start, Verzögerung des Zeitplans, Dauer,
angewandter Normalisierung, Fallbackgrund, Fehlercode und Ergebnisklasse:

| `outcome`          | Bedeutung                                                                         |
| ------------------ | --------------------------------------------------------------------------------- |
| `SUCCESS`          | Gültige Analyse ohne gemeldeten Fallback innerhalb des Fensters.                  |
| `FALLBACK`         | Gültige Analyse mit gemeldetem Fallback innerhalb des Fensters.                   |
| `REJECTED`         | Backendablehnung mit bekanntem tRPC-Fehlercode.                                   |
| `TIMEOUT`          | Clientfrist überschritten oder vom Backend gemeldeter Timeout.                    |
| `ERROR`            | Transportfehler oder sonstiger Fehler; nur klassifizierter Code wird gespeichert. |
| `INVALID_RESPONSE` | Antwort verletzt Schema oder erwartete Analyseparameter.                          |
| `CORPUS_MISMATCH`  | Korpusumfang, Revision oder Snapshot-Hash passen nicht.                           |
| `SKIPPED_BUSY`     | Vorheriger Aufruf derselben Session läuft noch.                                   |
| `SKIPPED_DELAYED`  | Termin ist um mindestens ein Aufrufintervall verspätet.                           |
| `NOT_STARTED`      | Nicht gestartet, etwa wegen Vorprüfung, Abbruch oder überschrittenem Fenster.     |
| `IN_FLIGHT_AT_END` | Zum Fensterschluss noch nicht abgeschlossen.                                      |
| `ABORTED`          | Vor dem Fensterschluss abgebrochen.                                               |

`analysis.planned`, `started` und `counts` trennen angebotene Last von tatsächlich
gestarteter Arbeit und Ergebnissen. `unavailableRate` zählt jeden geplanten
Termin ohne `SUCCESS` einmal, einschließlich Fallback und ausgelassener Arbeit.
`fallbackRateOfResponses` betrachtet nur gültige Analyseantworten innerhalb
des Fensters: `FALLBACK / (SUCCESS + FALLBACK)`, ohne solche Antworten `null`.
`latency` enthält die ungerundeten Laufzeitstichproben der gültigen Antworten
einschließlich Fallback; Einzelzeiten fehlgeschlagener Aufrufe bleiben in
`calls` erhalten. Leere Laufzeitmengen haben nicht verfügbare Perzentile.

Zum Fensterschluss offene Arbeit erhält bis zu 60 Sekunden zum Auslaufen.
`cleanupOutcome`, `cleanupErrorCode`, `cleanupDurationMs`,
`cleanupNormalizationApplied` und `cleanupNormalizationFallbackReason`
bewahren späte Ergebnisse getrennt auf. Sie verbessern weder die
Ergebnisklasse im Messfenster noch dessen Verfügbarkeitsquote. Nach der
Auslaufzeit werden die clientseitigen Requests abgebrochen. Ein Abbruchsignal
fordert das Beenden des Transports an; es belegt nicht, dass jede serverseitige
Berechnung bereits beendet ist.

Die Standardfrist je Clientanfrage beträgt 60 Sekunden. Für Werkzeugtests und
gekennzeichnete Vorläufe sind `durationMs`, `intervalMs`, `offsetsMs`,
`drainMs` und `requestTimeoutMs` in der Zuordnungsdatei konfigurierbar. Alle
Werte erscheinen im Report; die Auslaufzeit ist auf höchstens 60 Sekunden
begrenzt. Abweichende Werte erfüllen nicht automatisch den festgelegten
[Versuchsvertrag](1A-experiment-contract.md).

SIGINT und SIGTERM stoppen neue Arbeit und brechen offene Clientanfragen ab.
Die CLI speichert, soweit der Ausgabepfad beschreibbar ist, den unvollständigen
Lauf und endet mit Code 1. Nicht bestätigter oder geänderter Korpus führt
ebenfalls zu Code 1. Einzelne Analysefehler und Fallbacks werden als Messwerte
ausgewiesen und lösen für sich keinen CLI-Fehler aus: Die Bewertung der
Varianten folgt in Schritt 6/7. Code 0 bedeutet daher keine bestandene
A1-Verfügbarkeitsgrenze.

## Automatische Prüfung

Die Tests decken feste Termine, Parallelität zwischen Hosts, belegte Sessions,
Verzögerungen ohne Nachholwelle, Timeout, Auslaufen und Abbruch ab. Weitere
Tests prüfen reale tRPC-Header und Nutzlasten, Korpusabweichungen vor, während
und nach dem Lauf, ungültige Antworten, Fehlercodebereinigung, die CLI sowie
JSON-/JUnit-Artefakte. Der Testbefehl ist auch in `npm test` und
`npm run test:coverage` eingebunden.
