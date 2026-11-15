# A1: Container-Metriken und kontrollierte Verzögerung

Schritt 5 des [Umsetzungsplans](1A-umsetzungsplan.md) ergänzt eine lesende
Ressourcenerfassung und einen Unix-Socket-Proxy für die Laborvariante V4.
Produktions-Compose, Anwendung und Sidecar bleiben unverändert. Die gemeinsame
Orchestrierung ist in der [Versuchsreihe](./1A-versuchsreihe.md) dokumentiert.
Die aktuellen realen Ergebnisse stehen in der [Auswertung](./1A-auswertung.md);
diese Unterlage beschreibt die Messwerkzeuge und ihre Grenzen.

## Ohne Labor nachvollziehen

```bash
nvm use
npm run load:resource-isolation:metrics -- --validate
npm run load:resource-isolation:delay-proxy -- --validate
npm run load:resource-isolation:infrastructure:test
```

Die beiden Validierungen arbeiten ohne Dockerzugriff oder Socket-Listener. Die
Tests verwenden synthetische Docker-API-Antworten, temporäre cgroup-Dateien und
lokale Unix-Sockets. Datenbank, KI-Modelle und laufende Container werden nicht
benötigt. Der V4-Vertragstest wartet tatsächlich auf das Client-Timeout von
5000 ms bei einer Proxyverzögerung von 6000 ms; der Testbefehl dauert deshalb
mindestens etwa fünf Sekunden. Der Befehl gehört zu `npm test` und
`npm run test:coverage`.

## Container-Metriken im Labor erfassen

[`lib/container-metrics.mjs`](../../scripts/load/lib/container-metrics.mjs)
liest ausschließlich über lokale Zugriffe:

- Docker Engine API: `GET /containers/<name>/json` zur Identitätsprüfung und
  `GET /containers/<id>/stats?stream=false&one-shot=true` für einzelne Messungen.
- cgroup v2: `cpu.stat`, `cpu.max`, `memory.current`, `memory.peak`,
  `memory.max`, `memory.events`, `pids.current` und `pids.max`.
- `/proc/meminfo` und `os.loadavg()` für Speicher, Swap und Last des
  Collector-Hosts. `dockerHostMatchVerified: false` kennzeichnet, dass diese
  Hostwerte allein noch keine belegte Zuordnung zum Anwendungshost liefern.

Die offizielle [Docker-API-Referenz](https://docs.docker.com/reference/api/engine/version/v1.51/)
beschreibt die Statistikfelder und Einzelabfrage. Bei `one-shot=true` kann die
vorherige CPU-Stichprobe fehlen. Dann bleibt der erste Docker-CPU-Prozentwert
nicht verfügbar; spätere Werte nutzen die eigene vorherige Statistik derselben
Container-Generation. 100 % entsprechen einer ausgelasteten CPU; Mehrkernlast
kann darüber liegen.

Der Collector muss für cgroup-Werte auf dem Linux-Dockerhost laufen und dessen
`/proc` und cgroup-v2-Dateisystem lesen können. Die PID aus der Containerabfrage
wird nur verwendet, wenn ihr einheitlicher cgroup-Pfad die vollständige
Container-ID enthält. Zusätzlich wird die Verzeichnisidentität geprüft.
Ein Docker-Socket allein reicht bei einer entfernten Engine oder Docker Desktop
nicht aus. Ist die Zuordnung nicht möglich, bleiben Docker-Werte nutzbar,
während cgroup-Werte ausdrücklich als nicht verfügbar erscheinen. cgroup v1
wird nicht als v2 interpretiert.

Eine private Laborzuordnung, beispielsweise `/tmp/arsnova-1a-metriken.json`,
enthält die tatsächlichen Namen der eigens vorbereiteten Laborcontainer:

```json
{
  "dockerSocketPath": "/var/run/docker.sock",
  "containers": [
    { "alias": "app", "container": "a1-labor-app" },
    { "alias": "postgres", "container": "a1-labor-postgres" },
    { "alias": "redis", "container": "a1-labor-redis" },
    { "alias": "pdf-worker", "container": "a1-labor-pdf-worker" },
    { "alias": "spacy", "container": "a1-labor-spacy" }
  ],
  "durationMs": 300000,
  "intervalMs": 2000,
  "requestTimeoutMs": 1500
}
```

Die Namen sind Beispiele und werden nicht automatisch aufgelöst oder angelegt.
Für Varianten mit absichtlich gestopptem spaCy dessen Messpflicht in der
späteren Orchestrierung ausdrücklich behandeln; ein gestoppter Container wird
hier als nicht verfügbar erfasst. Lokale Sonderpfade lassen sich über
`cgroupRoot` und `procRoot` konfigurieren, ohne sie in den Report zu übernehmen.

```bash
REPORT_FILE=/tmp/arsnova-1a-metriken-report.json \
JUNIT_FILE=/tmp/arsnova-1a-metriken-report.xml \
npm run load:resource-isolation:metrics -- \
  --run --config-file /tmp/arsnova-1a-metriken.json
```

Standardmäßig wird am Anfang, alle zwei Sekunden und am Ende der 300 Sekunden
gemessen: 151 geplante Abtastpunkte. Erfassungen überlappen nicht. Verspätet ein
Aufruf einen späteren Abtastpunkt um ein ganzes Intervall, wird dieser Punkt
als ausgelassen dokumentiert. Zeitstempel, tatsächliche Erfassungsdauer,
Zeitpunkte der einzelnen cgroup-Lesungen (`observedAtMs`),
Intervall und beobachtete Gesamtdauer bleiben erhalten. Die Endmessung wird
auch nach einer Verzögerung ausgeführt und entsprechend zeitlich ausgewiesen.

SIGINT und SIGTERM stoppen die Zeitreihe und laufende Dockeranfragen. Der
bisherige Verlauf wird als unvollständig gespeichert. Ein unvollständiger,
abgebrochener oder nicht verfügbarer Verlauf endet mit Code 1. Code 0 bestätigt
die hier geprüfte Erfassungsvollständigkeit, aber keine A1-Leistungsgrenze und
keine Zuordnung des Collector-Hosts zum Anwendungshost.

## Messwerte und Grenzen

Die CLI gibt eine JSON-Zusammenfassung aus. Bei gesetztem `REPORT_FILE` liegen
die Daten zusätzlich unter `metrics` im standardisierten Lastreport:

| Feld                                        | Bedeutung                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `snapshots`                                 | Zeitreihe mit Phase `BEFORE`, `DURING` oder `AFTER`, Zeitstempeln und Erfassungsdauer. |
| `snapshots[].containers[]`                  | Messungen pro Alias, Verfügbarkeitsstatus und lokale Generationsnummer.                |
| `docker.memoryUsage`                        | Speicherwert der Docker API ohne Cacheabzug.                                           |
| `docker.memoryWorkingSet`                   | Separater Wert mit Cacheabzug entsprechend der Linux-Docker-CLI.                       |
| `cgroup.metrics`                            | Ausgewählte cgroup-Rohwerte mit Quellen, Einheiten und Verfügbarkeit.                  |
| `delta.cpuPercent`                          | Zuwachs von `usage_usec` über die tatsächliche Zeitdifferenz.                          |
| `delta.throttledPeriodRatio`                | `delta(nr_throttled) / delta(nr_periods)` bei positivem Nenner.                        |
| `delta.oomKill`                             | Zuwachs des Zählers `oom_kill`.                                                        |
| `containers[].generations[]`                | Nach Generation getrennte Zusammenfassungen der Speicherwerte.                         |
| `sampledPeakMemoryBytes`                    | Höchster tatsächlich abgetasteter `memory.current`-Wert.                               |
| `lifetimePeakMemoryBytes`                   | Höchster gelesener `memory.peak`-Wert einschließlich früherer Phasen.                  |
| `skippedSamples`, `interrupted`, `complete` | Ausgelassene Termine, Signalabbruch und Vollständigkeit der CLI-Erfassung.             |

Die [Docker-Dokumentation](https://docs.docker.com/reference/cli/docker/container/stats/)
unterscheidet API-Speicher und cachebereinigte CLI-Anzeige. Der berechnete
Working-Set-Wert bleibt daher vom unveränderten Docker-Wert und von
`memory.current` getrennt. Er ist keine Messung des gesamten cgroup-Speichers.

Nach der [cgroup-v2-Spezifikation](https://docs.kernel.org/admin-guide/cgroup-v2.html)
enthält `cpu.stat` CPU-Zeiten in Mikrosekunden. `memory.peak` umfasst bei diesen
rein lesenden Zugriffen die Lebenszeit der cgroup, damit auch die Aufwärmphase;
es wird nicht zurückgesetzt. Die gespeicherten Limits beziehen sich auf die
lokale cgroup. Strengere Vorgaben übergeordneter Gruppen sind damit nicht
ausgeschlossen. `memory.events` wird hier hierarchisch gelesen.

Fehlende, ungültige oder nicht sicher als JavaScript-Ganzzahl darstellbare
Werte erhalten `available: false` und `value: null`. Ein unbegrenztes Limit
wird dagegen als verfügbar mit `unlimited: true` und `value: null` ausgewiesen.
Ein Zählerstand von null bleibt ein vorhandener Messwert. Nicht vergleichbare
Zähler, Rückgänge oder ein Nenner von null liefern keine erfundene Differenz.

Container-ID, Startzeit, Neustartzähler, PID und cgroup-Verzeichnisidentität
werden intern berücksichtigt. Nach einem Wechsel beginnt eine neue Generation;
deren erste Messung hat keine Differenz zur vorherigen Generation. Ein Wechsel
während der Erfassung macht die betroffene Stichprobe unbrauchbar. Die
Generationsnummern gelten nur innerhalb dieser Collector-Instanz. Eine
Zusammenfassung verbindet Speicherwerte nicht über Generationen hinweg.

Der Report enthält Aliase und numerische Messfelder, aber keine vollständigen
Dockerantworten, Umgebungsvariablen, tatsächlichen Container-IDs oder lokalen
Socketpfade. Rohstichproben bleiben im jeweiligen Lauf erhalten. Docker- und
Dateizugriffe verursachen selbst Last; die Erfassungsdauer hilft, diesen Aufwand
im Vorlauf zu beurteilen. Alle Varianten müssen dieselbe Erfassung verwenden.

## Verzögerungsproxy für V4

[`spacy-delay-proxy.mjs`](../../scripts/load/spacy-delay-proxy.mjs) stellt nur
einen Unix-Socket bereit. `--run --lab` ist ausdrücklich erforderlich. Der
Listenpfad muss frei sein; weder Dateien noch vorhandene Sockets werden beim
Start entfernt oder überschrieben. Der neue Socket erhält Modus `0600`.

Beispiel für den bewusst vorbereiteten Host-Laboraufbau:

```bash
REPORT_FILE=/tmp/arsnova-1a-proxy-report.json \
npm run load:resource-isolation:delay-proxy -- \
  --run --lab \
  --listen-socket /tmp/arsnova-1a-delay.sock \
  --upstream-socket /tmp/arsnova-1a-spacy.sock
```

Beide Pfade sind durch die tatsächliche Laborzuordnung zu ersetzen. Für einen
Containeraufbau müssen Anwendung, Proxy und Sidecar ihre jeweiligen Sockets
über passende Laborvolumes erreichen können; UID und Zugriffsrechte müssen
zusammenpassen. Eine Hostdatei unter `/tmp` ist nicht automatisch im Container
sichtbar. Erst das spätere Laborlayout legt diese Zuordnung verbindlich fest.

Der Proxy wartet vor der Weiterleitung von `POST /normalize` standardmäßig
6000 ms. `GET /health` wird sofort weitergeleitet, auch während andere Requests
warten. Anfrage- und Antwortkörper, Statuscodes und endpunktbezogene Header
werden weitergereicht; verbindungsbezogene HTTP-Header werden entfernt. Die
maximale Anfragengröße bleibt wie beim vorhandenen Sidecar 1 MiB. Der Proxy
verändert keine Normalisierungsdaten und benötigt kein Modell.

Für V4 wird ausschließlich die Laboranwendung auf den Proxy-Socket umgestellt;
`NLP_TIMEOUT_MS=5000` bleibt unverändert. `--delay-ms` erlaubt abweichende Werte
für gekennzeichnete Werkzeugtests und Vorläufe, die im Proxyreport erscheinen.
Sie erfüllen nicht automatisch den [Versuchsvertrag](1A-experiment-contract.md).
Die Frist nach Weiterleitung zum Sidecar beträgt standardmäßig 15000 ms.

Bricht der Client während der Wartezeit ab, wird der Timer beendet und die
Anfrage nicht mehr an den Sidecar geschickt. Nach bereits erfolgter
Weiterleitung wird der Transport abgebrochen; daraus folgt keine Garantie,
dass eine serverseitige Berechnung beendet wurde. Unerreichbare Upstreams
liefern 502 ohne Socketpfad in der Antwort. Die Diagnosezähler enthalten keine
Nutzlasten oder Laufzeitidentitäten.

SIGINT und SIGTERM schließen den Proxy, beenden seine offenen Verbindungen und
schreiben bei gesetztem `REPORT_FILE` den bereinigten Abschlussreport. Die CLI
meldet ihre Betriebsbereitschaft erst nach Registrierung der Signalbehandlung.
Anschließend den ursprünglichen Socketpfad der Laboranwendung wiederherstellen;
das vollständige Zurücksetzen der Variante gehört zum Versuchsskript in
Schritt 6. Produktions-Defaults werden durch dieses Werkzeug nicht verändert.
