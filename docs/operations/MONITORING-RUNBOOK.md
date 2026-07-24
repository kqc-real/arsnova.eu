# Security- und Lastmonitoring

**Stand:** 2026-07-24  
**Gültig für:** W0.4; automatische Alarmierung folgt separat in W3.7.

## Primärer Blick

1. In arsnova.eu den Betriebsstatus im Footer öffnen. Der Detaildialog zeigt die
   allgemeine Live-Last.
2. Für Security-Signale ein gültiges Admin-Session-Token aus dem Login unter
   `/admin` verwenden und `health.securityStats` abfragen. Das `ADMIN_SECRET`
   niemals direkt als Bearer-Token oder in Shell-Historien einsetzen:

   ```bash
   read -rs ADMIN_TOKEN
   export ADMIN_TOKEN
   curl -fsS \
     -H "Authorization: Bearer ${ADMIN_TOKEN}" \
     'https://arsnova.eu/trpc/health.securityStats' \
     | jq '.result.data.json | {
     sessionCreatesLastMinute,
     rateLimit429LastMinute,
     rateLimit429ByCategoryLastMinute,
     pdfActiveJobs,
     pdfMaxConcurrentJobs,
     pdfFailedLastMinute,
     pdfRejectedLastMinute,
     trpcWebSocketConnectionsActive
   }'
   unset ADMIN_TOKEN
   ```

3. `serviceStatus`, `loadStatus` und bisherige Produktstatistiken bleiben
   öffentlich über `health.stats` abrufbar. Bei einer Auffälligkeit die letzten
   strukturierten Ereignisse prüfen:

   ```bash
   docker compose -f docker-compose.prod.yml logs --since 10m app \
     | rg 'rate_limit_429|pdf:'
   ```

`health.securityStats` enthält rollierende 60-Sekunden-Zähler in Redis. Der
vollständige Rand-Bucket wird konservativ mitgezählt, damit kein weniger als
60 Sekunden altes Ereignis fehlt; dadurch kann die Anzeige höchstens einen
10-Sekunden-Bucket zu früh warnen. Create-/429-Ereignisse werden pro
Backend-Prozess im Speicher aggregiert und alle fünf Sekunden mit einer
gebündelten `INCRBY`-/`EXPIRE`-Pipeline geschrieben. Es läuft höchstens ein
Flush; bei langsamem Redis bleiben höchstens sieben Zeit-Buckets je Zähler
pending. Ein Redis-Ausfall verwirft den betroffenen Batch kontrolliert, statt
Request-Pfade zu blockieren oder unbegrenzt Arbeit aufzustauen. Beim Shutdown
erfolgt ein zeitlich begrenzter Best-Effort-Flush.

Aktive PDF-Jobs und tRPC-WebSocket-Verbindungen werden bei jeder
admin-authentifizierten Antwort frisch aus dem Backend-Prozess gelesen.
Rollierende Werte können wegen des Flush-Intervalls bis zu fünf Sekunden
verzögert sein. Bei Redis-Ausfall degradieren sie auf null; deshalb immer
zugleich `health.check.redis` und die Container-Logs prüfen.

## Initiale Betriebsschwellen

Die Schwellen sind Beobachtungs- und Eskalationswerte, keine zusätzlichen
Rate-Limits. Insbesondere werden Teilnehmerpfade nicht anhand einer gemeinsam
genutzten Hörsaal-IP gedrosselt.

| Signal                             |           Warnung |          Kritisch |
| ---------------------------------- | ----------------: | ----------------: |
| Erfolgreiche Session-Erstellungen  |          ≥ 30/min |          ≥ 60/min |
| Alle 429-Ablehnungen               |          ≥ 50/min |         ≥ 200/min |
| Code-Lockout-429 (`sessionCode`)   |          ≥ 30/min |         ≥ 100/min |
| PDF-Ablehnungen                    |           ≥ 5/min |          ≥ 20/min |
| PDF-Fehler                         |           ≥ 1/min |           ≥ 3/min |
| Aktive tRPC-WebSockets             |             ≥ 600 |             ≥ 800 |
| Container-CPU, 5 Minuten anhaltend | ≥ 80 % des Limits | ≥ 95 % des Limits |
| `serviceStatus`                    |         `limited` |        `critical` |

Ein einzelner aktiver PDF-Job entspricht dem Produktionscap und ist allein
noch kein Alarm. Relevant sind anhaltende CPU-Sättigung, Ablehnungen oder
Fehler. Die Schwellen werden nach vier Wochen Produktionsdaten überprüft.

## Diagnose und Maßnahmen

### Create- oder 429-Welle

- `rateLimit429ByCategoryLastMinute` bestimmt den betroffenen Pfadtyp.
- `rate_limit_429` in den App-Logs enthält Procedure, Kategorie und nur die vom
  Backend ermittelte IP-Quelle (`ipSource`), keine vollständige IP-Adresse.
  Das Ereignis wird pro Kategorie höchstens
  einmal in zehn Sekunden ausgegeben; `suppressedSinceLastLog` nennt die seit
  der vorherigen Ausgabe zusammengefassten Ablehnungen. Die Redis-Zähler
  erfassen weiterhin jede Ablehnung.
- Bei `sessionCreate`: erfolgreiche Create-Rate und 429 gemeinsam bewerten.
  Hohe Create-Rate ohne 429 kann verteilten Missbrauch anzeigen.
- Bei `vote`: zuerst eine reale Großveranstaltung ausschließen. Keine enge
  IP-Sperre aktivieren; Votes werden participant-bezogen begrenzt.
- Bei `sessionCode`: Lockout-Muster prüfen. Änderungen am NAT-kompatiblen
  Code-Lockout gehören in W1.5 und benötigen einen Lasttest.

### PDF-Sättigung

```bash
docker stats --no-stream
docker compose -f docker-compose.prod.yml logs --since 10m app | rg 'pdf:'
```

- `pdfActiveJobs == pdfMaxConcurrentJobs` ist während eines Exports normal.
- Wiederholte `pdf:concurrency_rejected`-Ereignisse oder Fehler eskalieren.
- Den Cap nicht spontan erhöhen: Cap 2 verfehlte auf dem Zielhost die
  Live-Voting-SLOs. Erst Ursache und CPU-/Speicherdruck klären.

### WebSocket-Anstieg

`trpcWebSocketConnectionsActive` zählt Port 3001. Für die Gesamtzahl inklusive
Yjs-Port 3002 auf dem Host zusätzlich prüfen:

```bash
ss -Htan state established '( sport = :3001 or sport = :3002 )' | wc -l
```

- Kurzzeitige Reconnect-Wellen nach einem Deployment sind erwartbar.
- Bei anhaltend ≥ 800 Verbindungen `serviceStatus`, CPU, Speicher und
  Reconnect-Logs zusammen bewerten.
- Keine IP-basierte WS-Sperre als Sofortmaßnahme setzen; viele legitime Clients
  können dieselbe NAT-IP teilen.

## Eskalation

Bei einem kritischen Wert:

1. Zeitpunkt, admin-authentifizierten `health.securityStats`-Snapshot und
   relevante Logs sichern.
2. Laufende Veranstaltung und Deployment-Zeitpunkt prüfen.
3. Bei Servicebeeinträchtigung den bestehenden Rollback-/Incident-Prozess aus
   der Deployment-Dokumentation verwenden.
4. Keine Schwelle oder Schutzgrenze ohne Issue, Review und reproduzierbaren
   Lasttest ändern.

W0.4 stellt ausschließlich diese manuellen Beobachtungsschwellen und
Diagnosewege bereit; es versendet keine Alarme. W3.7 automatisiert später die
Signalauswertung, Benachrichtigung und Prüfung des Alarmwegs. Bis dahin ist
dieses Runbook die verbindliche manuelle On-Call-Referenz.

## Log-Minimierung und Aufbewahrung

`rate_limit_429` protokolliert bewusst keine Client-IP und keine Redis-Keys,
sondern nur Pfad, Kategorie, `ipSource` und aggregierte Unterdrückungszahl.
App-Logs dürfen nur für Betrieb und Incident-Diagnose zugänglich sein. Der
aktuelle Compose-Stack erzwingt noch keine anwendungsseitige Retention;
Betreiber müssen deshalb im Docker-Logging-Treiber eine Rotation konfigurieren
und die kürzeste tragfähige Frist festlegen (Richtwert höchstens 14 Tage im
Normalbetrieb). Längere Sicherung ist nur incidentbezogen, zugriffsbeschränkt
und dokumentiert zulässig.
