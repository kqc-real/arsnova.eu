# Security- und Lastmonitoring

**Stand:** 2026-07-25
**Gültig für:** W0.4, W2.4a, W2.4b und W2.5; automatische Alarmierung folgt separat in W3.7.

## Primärer Blick

1. In arsnova.eu den Betriebsstatus im Footer öffnen. Der Detaildialog zeigt die
   allgemeine Live-Last.
2. Für Security-Signale das separate starke `ADMIN_DIAGNOSTIC_SECRET` über den
   ausschließlich für diese read-only Diagnose vorgesehenen Header
   `x-admin-diagnostic-secret` senden. Dieser Pfad prüft das Secret
   konstantzeitig und ohne Redis. `ADMIN_SECRET` funktioniert hier ausdrücklich
   nicht. Das Diagnose-Secret niemals als Befehlsargument in der Shell-Historie
   einsetzen:

   ```bash
   read -rsp 'ADMIN_DIAGNOSTIC_SECRET: ' ADMIN_DIAGNOSTIC_SECRET; echo
   export ADMIN_DIAGNOSTIC_SECRET
   curl -fsS \
     -H "x-admin-diagnostic-secret: ${ADMIN_DIAGNOSTIC_SECRET}" \
     'https://arsnova.eu/trpc/health.securityStats' \
     | jq '.result.data.json | {
     sessionCreatesLastMinute,
     adminLoginFailuresLastMinute,
     sessionCodeFailuresLastMinute,
     sessionCodeSoftCapDelaysLastMinute,
     sessionCodeGlobalSoftCapUtilizationPercent,
     rateLimit429LastMinute,
     rateLimit429ByCategoryLastMinute,
     cspReportsReceivedLastMinute,
     cspReportsDroppedLastMinute,
     cspReportsRateLimitedLastMinute,
     cspReportsEvalLastMinute,
     cspReportsScriptHttpsLastMinute,
     pdfActiveJobs,
     pdfMaxConcurrentJobs,
     pdfFailedLastMinute,
     pdfRejectedLastMinute,
     trpcWebSocketConnectionsActive,
     yjsWebSocketConnectionsActive,
     yjsWebSocketRoomsActive,
     yjsWebSocketRejectedUpgradesLastMinute,
     yjsWebSocketPayloadRejectedLastMinute,
     yjsWebSocketRateLimitedMessagesLastMinute
   }'
   unset ADMIN_DIAGNOSTIC_SECRET
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
10-Sekunden-Bucket zu früh warnen. Create-, Session-Code-, 429- und
PDF-Ergebnisereignisse
werden pro Backend-Prozess im Speicher aggregiert und alle fünf Sekunden mit
einer gebündelten `INCRBY`-/`EXPIRE`-Pipeline geschrieben. Je
Telemetriegruppe läuft höchstens ein Flush; bei langsamem Redis bleiben
höchstens sieben Zeit-Buckets je Zähler pending. Ein Redis-Ausfall verwirft den
betroffenen Batch kontrolliert, statt Request-Pfade zu blockieren oder
unbegrenzt Arbeit aufzustauen. Beim Shutdown erfolgt ein zeitlich begrenzter
Best-Effort-Flush.

Aktive PDF-Jobs und tRPC-WebSocket-Verbindungen werden bei jeder
diagnose-authentifizierten Antwort frisch aus dem Backend-Prozess gelesen. Die
Diagnose-Authentifizierung selbst benötigt kein Redis; deshalb bleibt der
Endpunkt während eines Redis-Incidents erreichbar.
Rollierende Werte können wegen des Flush-Intervalls bis zu fünf Sekunden
verzögert sein. Bei Redis-Ausfall degradieren sie auf null; deshalb immer
zugleich `health.check.redis` und die Container-Logs prüfen.

Nach einem W2.5-Deploy zusätzlich einmal mit fremdem `Origin` gegen
`/trpc/health.check` prüfen: Die normale Antwort darf eintreffen, aber
`Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials` und weitere
`Access-Control-Allow-*`-Header müssen fehlen. Nginx darf diese Header ebenfalls
nicht hinzufügen. CLI-/Healthcheck-Requests ohne `Origin` bleiben zulässig;
CORS ist keine Authentifizierungs- oder WebSocket-Zugriffskontrolle.

Fehlgeschlagene Diagnose-Authentifizierungen teilen pro Backend-Prozess ein
festes Budget von 30 Versuchen je Minute. Danach antworten weitere falsche
Credentials mit 429. Ein korrektes Diagnose-Secret wird vor diesem Gate geprüft
und bleibt dadurch auch bei ausgeschöpftem Fehlerbudget nutzbar. Der Pfad
erzeugt keine speziellen Auth-Fehlerlogs.

## Initiale Betriebsschwellen

Die Schwellen sind Beobachtungs- und Eskalationswerte, keine zusätzlichen
Rate-Limits. Insbesondere werden Teilnehmerpfade nicht anhand einer gemeinsam
genutzten Hörsaal-IP gedrosselt.

| Signal                             |           Warnung |          Kritisch |
| ---------------------------------- | ----------------: | ----------------: |
| Erfolgreiche Session-Erstellungen  |          ≥ 30/min |          ≥ 60/min |
| Alle 429-Ablehnungen               |          ≥ 50/min |         ≥ 200/min |
| Ungültige Session-Codes            |         ≥ 100/min |         ≥ 500/min |
| Session-Code-Soft-Cap-Delays       |          ≥ 10/min |         ≥ 100/min |
| Globale Code-Soft-Cap-Auslastung   |            ≥ 80 % |            ≥ 95 % |
| Client-Cap-429 (`sessionCode`)     |          ≥ 30/min |         ≥ 100/min |
| PDF-Ablehnungen                    |           ≥ 5/min |          ≥ 20/min |
| PDF-Fehler                         |           ≥ 1/min |           ≥ 3/min |
| CSP-Reports verworfen              |          ≥ 10/min |         ≥ 100/min |
| CSP-Report-429                     |          ≥ 50/min |         ≥ 500/min |
| CSP `eval`                         |           ≥ 1/min |          ≥ 10/min |
| CSP Script-HTTPS                   |          ≥ 10/min |         ≥ 100/min |
| Aktive tRPC-WebSockets             |             ≥ 600 |             ≥ 800 |
| Abgelehnte tRPC-Upgrades/min       |              ≥ 50 |             ≥ 200 |
| tRPC-Payload-Ablehnungen/min       |               ≥ 1 |              ≥ 10 |
| tRPC-Message-Rate-Schließungen/min |              ≥ 10 |              ≥ 50 |
| Aktive Yjs-WebSockets              |             ≥ 700 |             ≥ 900 |
| Abgelehnte Yjs-Upgrades/min        |              ≥ 50 |             ≥ 200 |
| Yjs-Payload-Ablehnungen/min        |               ≥ 1 |              ≥ 10 |
| Yjs-Message-Rate-Schließungen/min  |              ≥ 10 |              ≥ 50 |
| Yjs-Awareness-Ablehnungen/min      |               ≥ 1 |              ≥ 10 |
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
  Viele Erfolge mit anschließend steigenden `sessionCreate`-429 zeigen ein
  ausgeschöpftes globales oder Shared-NAT-IP-Budget. Das globale Budget ist ein
  Create-Notanker; laufende Sessions und Teilnehmerpfade bleiben unberührt.
- Bei `adminLogin`: 429 zeigen ein ausgeschöpftes globales Fehlbudget oder eine
  volle prozesslokale Delay-Kapazität.
  `adminLoginFailuresLastMinute` erfasst zusätzlich die langsameren
  `UNAUTHORIZED`-Fehlversuche unterhalb der 429-Schwelle. Keine IP-Sperre
  ergänzen. Das Pre-Auth-Budget kann legitime Logins bis zum Fensterende
  blockieren; bei anhaltenden Wellen `ADMIN_SECRET` kontrolliert rotieren und
  die gesampelten Logs `admin_login_failed` und `rate_limit_429` für
  `admin.login` korrelieren.
- Bei `vote`: zuerst eine reale Großveranstaltung ausschließen. Keine enge
  IP-Sperre aktivieren; Votes werden participant-bezogen begrenzt.
- Bei `sessionCode`: Client-Cap-429 zusammen mit
  `sessionCodeFailuresLastMinute`, `sessionCodeSoftCapDelaysLastMinute` und der
  globalen Auslastung prüfen. Keinen IP-Lock ergänzen. Ein hoher Delay-Wert bei
  weiterhin erfolgreichen gültigen Joins ist die erwartete Soft-Cap-Wirkung;
  die 500er-NAT-Abnahme aus W1.5 heranziehen.

### CSP-Report-Welle

- `cspReportsReceivedLastMinute` zeigt Requests, nicht einzelne Rohreports;
  ein Request kann höchstens zehn Reports enthalten.
- `cspReportsDroppedLastMinute` steigt bei malformed Payloads,
  Dimensionscap oder kontrolliertem Drop. Gleichzeitig
  `health.check.redis` prüfen: Bei Redis-Ausfall liefert der Ingest weiter 204
  und begrenzt sich prozesslokal, die Redis-Telemetrie kann dann null sein.
- `cspReportsRateLimitedLastMinute` bedeutet regulär ausgeschöpftes globales
  oder grobes trusted-IP-Budget (HTTP 429). Keine IP und keine Roh-URL stehen
  in Health, Redis-Dimensionen oder App-Logs.
- `eval` und Script-HTTPS sind Beobachtungssignale für W2.4b, keine
  Policy-Freigabe. Vor W2.4b Browser-/Deployment-Smoke und bekannte
  Drittquellen getrennt prüfen.
- Sofortmaßnahme bei Missbrauch: Werte nur nach unten anpassen oder auf den
  vorherigen App-Commit zurückrollen. Nicht spontan CSP aktivieren. Das
  Löschen von `csp:*` entfernt ausschließlich Aggregate; Standard-TTL ist
  sieben Tage.

### PDF-Sättigung

```bash
docker stats --no-stream
docker compose -f docker-compose.prod.yml logs --since 10m app | rg 'pdf:'
```

- `pdfActiveJobs == pdfMaxConcurrentJobs` ist während eines Exports normal.
- `rateLimit429ByCategoryLastMinute.pdf`, `pdfRejectedLastMinute` und
  PDF-Fehler gemeinsam bewerten. Ein separates Reject-Log pro Anfrage gibt es
  bewusst nicht.
- Den Cap nicht spontan erhöhen: Cap 2 verfehlte auf dem Zielhost die
  Live-Voting-SLOs. Erst Ursache und CPU-/Speicherdruck klären.

### WebSocket-Anstieg

`trpcWebSocketConnectionsActive` zählt Port 3001; das konfigurierte Hard-Cap
steht in `trpcWebSocketConnectionLimit`. Upgrade-, Payload- und
Nachrichtenraten-Ablehnungen stehen in den drei entsprechenden
`trpcWebSocket*LastMinute`-Feldern.
`trpcWebSocketBoundConnectionsActive` zählt nur Verbindungen mit gültigem
Session-Signal. Die Felder `trpcWebSocketSessionCapRejectedLastMinute` und
`trpcWebSocketParticipantCapRejectedLastMinute` zeigen Cap-Ablehnungen
aggregiert ohne Codes oder UUIDs; die zugehörigen Limits stehen ebenfalls im
DTO. Participant-UUID und Session-Code sind nur Throttle-Signale, keine
Authentifizierung.
`yjsWebSocketConnectionsActive` Port 3002 und
`yjsWebSocketRoomsActive` die momentan verbundenen Quiz-Sammlungen. Zur
Gegenprüfung auf dem Host:

```bash
ss -Htan state established '( sport = :3001 or sport = :3002 )' | wc -l
```

- Kurzzeitige Reconnect-Wellen nach einem Deployment sind erwartbar.
- Bei anhaltend hohen Verbindungen `serviceStatus`, CPU, Speicher und
  Reconnect-Lasttest zusammen bewerten.
- tRPC-Upgrade-Ablehnungen bedeuten ein ausgeschöpftes globales Minuten- oder
  Verbindungscap. Payload-Ablehnungen bestätigen das unveränderte feste
  2-MiB-Limit; Rate-Schließungen ein ausgeschöpftes Verbindungs- oder
  Globalbudget. Bei einer realen 500er-Veranstaltung zuerst Reconnect-Welle und
  Clientfehler korrelieren, nicht nach IP drosseln.
- Session-/Participant-Cap-Ablehnungen mit gebundenen Verbindungen und dem
  500er-Reconnect-Gate korrelieren. Bei legitimer Last zuerst Client-Doppel-
  verbindungen und Rollout-Overlap prüfen; keine IDs loggen und keinen
  IP-Bucket ergänzen.
- Yjs-Upgrade-Ablehnungen können ungültige Pfade, Upgrade-Raten oder
  Verbindungs-Caps bedeuten. Payload-Ablehnungen weisen auf Nachrichten über
  das konfigurierte Einzelpayload-Limit (Standard 16 MiB) hin;
  Message-Rate-Schließungen auf ein ausgeschöpftes Nachrichten- oder Bytebudget
  einer Verbindung, eines Raums oder des Backend-Prozesses. Protokollfehler
  weisen auf ungültige Yjs-/Awareness-Frames hin; deren Inhalt wird nicht
  geloggt. Dokumentablehnungen zeigen das 15-MiB-Raum- oder
  256-MiB-Globalcap an. Awareness-Ablehnungen zeigen mehrere neu eingeführte
  Client-IDs, zu viele Einträge oder einen JSON-State über 4 KiB an;
  Ausgangsablehnungen begrenzen tatsächlich versendete Sync-/Reconnect-Bytes.
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

CSP-Reports besitzen keinen eigenen Rohlog. Redis verwendet sieben feste
60-s-Telemetrie-Ringslots sowie genau ein Set und einen Hash für höchstens 256
HMAC-Digests über das gesamte Retentionsfenster. Die Generations-TTL wird nicht
durch Requests verlängert; nach standardmäßig sieben Tagen beginnt eine neue
leere Generation. Ein steigender `dropped`-Zähler bei 256 Dimensionen ist
deshalb erwarteter Overflow-Schutz, kein Anlass zur Lockerung.

## W2.4b Report-Only-Beobachtungsfenster

Nach dem Endpoint-Smoke `CSP_REPORT_ONLY_ENABLED=true` aktivieren und 24–72
Stunden beobachten. Vorher und nachher jeweils verifizieren:

- genau ein `Content-Security-Policy-Report-Only` auf lokalisierten
  HTML-Dokumenten;
- kein `Content-Security-Policy`-Enforcement;
- kein CSP-Header auf `/csp-report`, `/trpc`, Service-Worker-/JS-/CSS-/JSON-
  Assets oder 204-Antworten;
- tRPC-HTTP, `/trpc-ws`, `/yjs-ws`, Service-Worker-Update, Markdown-/KaTeX-
  Bilder und PDF-/Blob-Downloads funktional.
- bestehender PWA-Client kontrolliert die Seite mit dem aktualisierten Service
  Worker; Online-Navigation liefert wegen der konfigurierten Freshness-Strategie
  den aktuellen Runtime-Header statt eines alten App-Shell-Headers.

`unsafe-eval` ist für die beobachtete Zod-4-Validator-Kompilierung bereits in
der initialen Report-Only-Policy enthalten; ein späteres Entfernungsexperiment
würde über `cspReportsEvalLastMinute` sichtbar.
`cspReportsScriptHttpsLastMinute` zählt ausschließlich externe HTTPS-
Scriptquellen. Ein legitimes Signal wird zuerst mit Browser, Route und
aktuellem Build reproduziert; die Policy wird nicht ohne Evidenz erweitert. Bei Report-Sturm,
unerwarteten Kernflow-Problemen oder unklarer Header-Duplizierung:
`CSP_REPORT_ONLY_ENABLED=false`, App neu starten und den Header-Scope erneut
prüfen. Der Ingest bleibt dabei aktiv. Nginx ist nicht Eigentümer des CSP-
Headers; dort kein `add_header` oder `always` ergänzen.

`frame-ancestors` wird in Report-Only von Browsern ignoriert und ist in diesem
Beobachtungsfenster nicht validierbar. Bis zu einem getrennten Enforcement-
Slice bleibt Nginx `X-Frame-Options: SAMEORIGIN` die aktive Framing-Kontrolle.
