# Security- und Lastmonitoring

**Stand:** 2026-07-24  
**Gültig für:** W0.4; automatische Alarmierung folgt separat in W3.7.

## Primärer Blick

1. In arsnova.eu den Betriebsstatus im Footer öffnen. Der Detaildialog zeigt die
   allgemeine Live-Last.
2. Für Security-Signale `health.stats` direkt abfragen:

   ```bash
   curl -fsS 'https://arsnova.eu/trpc/health.stats' | jq '.result.data.json | {
     serviceStatus,
     loadStatus,
     sessionCreatesLastMinute,
     rateLimit429LastMinute,
     rateLimit429ByCategoryLastMinute,
     pdfActiveJobs,
     pdfMaxConcurrentJobs,
     pdfFailedLastMinute,
     pdfRejectedLastMinute,
     trpcWebSocketConnectionsActive
   }'
   ```

3. Bei einer Auffälligkeit die letzten strukturierten Ereignisse prüfen:

   ```bash
   docker compose -f docker-compose.prod.yml logs --since 10m app \
     | rg 'rate_limit_429|pdf:'
   ```

`health.stats` enthält rollierende 60-Sekunden-Zähler in Redis. Aktive PDF-Jobs
und tRPC-WebSocket-Verbindungen werden bei jeder Antwort frisch aus dem
Backend-Prozess gelesen. Ein Redis-Ausfall lässt die rollierenden Werte
kontrolliert auf null degradieren; deshalb immer zugleich `health.check.redis`
und die Container-Logs prüfen.

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
- `rate_limit_429` in den App-Logs enthält Procedure, Kategorie und die vom
  Backend ermittelte IP-Quelle.
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

1. Zeitpunkt, `health.stats`-Snapshot und relevante Logs sichern.
2. Laufende Veranstaltung und Deployment-Zeitpunkt prüfen.
3. Bei Servicebeeinträchtigung den bestehenden Rollback-/Incident-Prozess aus
   der Deployment-Dokumentation verwenden.
4. Keine Schwelle oder Schutzgrenze ohne Issue, Review und reproduzierbaren
   Lasttest ändern.

W3.7 automatisiert die hier definierten Signale und prüft den Alarmweg. Bis
dahin ist dieses Runbook die verbindliche manuelle On-Call-Referenz.
