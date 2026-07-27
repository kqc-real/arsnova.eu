# Security- und Lastmonitoring

**Stand:** 2026-07-26
**Gültig für:** W0.4, W2.4a, W2.4b, W2.5 und W3.7

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
     sessionCodeFailuresBySourceLastMinute,
     sessionCodeEntryFailuresLastMinute,
     sessionCodeSoftCapDelaysLastMinute,
     sessionCodeSoftCapDelaysBySourceLastMinute,
     sessionCodeEntrySoftCapDelaysLastMinute,
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
     yjsWebSocketRejectedUpgradesByReasonLastMinute,
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
zugleich `health.check.redis`, `health.securityStats.databaseStatus` und die
Container-Logs prüfen.

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
| Join- und Codeprüfungsfehler       |         ≥ 100/min |         ≥ 500/min |
| Soft-Cap-Delays für Join/Code      |          ≥ 10/min |         ≥ 100/min |
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
- Bei `sessionCode`: Client-Cap-429 zusammen mit den nach Quelle aufgeteilten
  `sessionCodeFailuresBySourceLastMinute`,
  `sessionCodeSoftCapDelaysBySourceLastMinute` und der globalen Auslastung
  prüfen. Automatische Poll-/Reconnect- und sonstige Folgezugriffe bleiben zur
  Diagnose sichtbar, lösen aber keinen Join-Alarm aus. Alarmiert werden nur die
  Summen `sessionCodeEntryFailuresLastMinute` und
  `sessionCodeEntrySoftCapDelaysLastMinute` aus expliziten Join- und
  Codeprüfungen. Die Quelle ist serverseitig an getrennte tRPC-Prozeduren
  gebunden und kein vom Client wählbarer Parameter. Keinen IP-Lock ergänzen. Ein
  hoher Delay-Wert bei weiterhin
  erfolgreichen gültigen Joins ist die erwartete Soft-Cap-Wirkung; die
  500er-NAT-Abnahme aus W1.5 heranziehen.

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
docker compose -f docker-compose.prod.yml ps app pdf-worker
docker compose -f docker-compose.prod.yml logs --since 10m app pdf-worker \
  | rg 'pdf:|pdf-worker:'
```

- `pdfActiveJobs == pdfMaxConcurrentJobs` ist während eines Exports normal.
- `rateLimit429ByCategoryLastMinute.pdf`, `pdfRejectedLastMinute` und
  PDF-Fehler gemeinsam bewerten. Ein separates Reject-Log pro Anfrage gibt es
  bewusst nicht.
- Ein ungesunder Worker oder `pdf-worker:render_failed` ist kein Anlass für
  einen In-Process-Fallback. Worker neu starten und Socket-Volume,
  PID-/RAM-/CPU-Limit sowie `/tmp` prüfen; App-Secrets oder Netzwerk nicht
  hinzufügen.
- `pdf-worker:render_timeout` beendet den Worker absichtlich non-zero. Prüfen,
  dass `RestartCount` steigt und der Worker wieder healthy wird. Wiederholte
  Timeouts deuten auf CPU-/RAM-Druck oder problematischen Reportinhalt; die
  Deadline nicht über 70 Sekunden und den App-Timeout nicht darunter setzen.
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
- Yjs-Upgrade-Ablehnungen werden in
  `yjsWebSocketRejectedUpgradesByReasonLastMinute` ohne Raum-ID, Token oder IP
  aufgeschlüsselt. `invalidToken` und `staleGeneration` weisen auf ungültige
  bzw. rotierte Links hin; `tokenRequired`/`legacyCutoff` auf UUID-only-Links;
  `globalRate`/`roomRate` und die beiden `*ConnectionCap`-Felder auf
  Schutzgrenzen; `authorizationUnavailable` auf Redis-/Backend-Probleme. Ein
  dauerhaft nahezu konstanter Wert nur bei `invalidToken` oder
  `staleGeneration` ist typischerweise ein alter offener Browser-Tab. Aktuelle
  Clients prüfen den Token zusätzlich über `quizSync.validateShare` und
  zerstören den Yjs-Provider bei einer endgültigen Ablehnung, sodass daraus
  keine permanente Reconnect-Schleife mehr entsteht. Transiente Prüf- oder
  Netzwerkausfälle stoppen den Reconnect ausdrücklich nicht.
- Payload-Ablehnungen weisen auf Nachrichten über
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

W0.4 stellt die manuellen Beobachtungsschwellen und Diagnosewege bereit. W3.7
wertet dieselben Signale zusätzlich jede Minute automatisiert aus. Dieses
Runbook bleibt die verbindliche On-Call-Referenz; die Alarmierung verändert
keine Rate-Limits und sperrt keine Nutzer.

Angemeldete Admins können den aktuellen aggregierten Snapshot außerdem im
dritten Tab **Monitoring** unter `/admin` einsehen. Die Ansicht aktualisiert sich
alle 60 Sekunden und bietet die vollständige Antwort zusätzlich als
aufklappbares JSON an. Dafür wird ausschließlich die bestehende Admin-Session
verwendet; `ADMIN_DIAGNOSTIC_SECRET` wird weder an den Browser übertragen noch
im Frontend gespeichert. Der Tab zeigt Live-Werte, ersetzt aber weder
Webhook-Alarme noch den externen Heartbeat und speichert keine Zeitreihe.

## Automatische Alarmierung (W3.7)

`arsnova-monitor.timer` startet einmal pro Minute einen vom App-Container
unabhängigen Host-Poller. Er liest ausschließlich aggregierte Daten:

- `health.securityStats` über das getrennte `ADMIN_DIAGNOSTIC_SECRET`, inklusive
  eines echten PostgreSQL-Readiness-Checks;
- `health.check`, damit ein Redis-Ausfall explizit erkannt wird;
- `health.stats` für `serviceStatus`.

Die Regeln entsprechen der Tabelle „Initiale Betriebsschwellen“. Eine Ausnahme
ist Container-CPU: Sie bleibt beim externen Infrastrukturmonitoring, weil der
App-Endpunkt keine Hostwerte exponiert. Eine PDF-Warteschlange existiert bewusst
nicht; `pdfActiveJobs == pdfMaxConcurrentJobs` ist allein normal. Alarmiert
werden PDF-Ablehnungen und -Fehler.

Warnungen müssen in zwei aufeinanderfolgenden Läufen auftreten. Kritische Werte
alarmieren sofort. Eine Recovery benötigt ebenfalls zwei gesunde Läufe.
Liegen zwischen zwei Proben mehr als 150 Sekunden, verfallen noch unbestätigte
Warnungs- und Recovery-Zähler; weit auseinanderliegende Stichproben gelten
nicht als aufeinanderfolgend.
Unveränderte Warnungen werden standardmäßig nach sechs Stunden, kritische
Alarme nach einer Stunde wiederholt. Die Zustandsdatei liegt unter
`/var/lib/arsnova-monitoring/state.json`; sie enthält Alert-IDs, Labels,
aggregierte Messwerte, Schwellen, Schweregrade, Signaturen,
Beobachtungszähler und Zeitstempel. Sie enthält keine IPs, Session-Codes,
Raum-IDs, Rohreports oder Secrets.

### Installation

```bash
cd /home/deploy/arsnova.eu
sudo apt update
sudo apt install -y python3
sudo install -o root -g root -m 0700 -d /etc/arsnova-monitoring
if ! sudo test -e /etc/arsnova-monitoring/monitor.env; then
  sudo install -o root -g root -m 0600 \
    deploy/monitoring/monitor.env.example \
    /etc/arsnova-monitoring/monitor.env
fi
sudo install -o root -g root -m 0755 \
  scripts/monitoring/arsnova_monitor.py \
  /usr/local/sbin/arsnova-monitor
sudo install -o root -g root -m 0644 \
  deploy/systemd/arsnova-monitor.service \
  deploy/systemd/arsnova-monitor.timer \
  /etc/systemd/system/
sudoedit /etc/arsnova-monitoring/monitor.env
sudo systemctl daemon-reload
```

`ADMIN_DIAGNOSTIC_SECRET` muss exakt dem getrennten Diagnose-Secret aus
`.env.production` entsprechen. `MONITORING_WEBHOOK_URL` muss ein HTTPS-Endpunkt
sein, der JSON nach Schema `arsnova-monitoring-alert/v1` akzeptiert. Ein
optionaler Token wird ausschließlich als `Authorization: Bearer …` gesendet.
Webhook- und Heartbeat-URLs dürfen keine eingebetteten Zugangsdaten enthalten.

Die Unit läuft als `DynamicUser`, erhält ein eigenes `StateDirectory`, ein
read-only Dateisystem und keine Linux-Capabilities. systemd liest die root-only
Umgebungsdatei, bevor der kurzlebige Prozess gestartet wird. Eine nicht root
gehörende Datei oder Gruppen-/Fremdrechte lassen den Start bereits in
`ExecStartPre` hart fehlschlagen.

### Alarmweg abnehmen

Zuerst einen synthetischen Alarm senden. Er liest keine Live-Metriken und
verändert den Deduplizierungszustand nicht:

```bash
sudo systemctl stop arsnova-monitor.timer
sudo bash -eu <<'EOF'
dropin_dir=/run/systemd/system/arsnova-monitor.service.d
dropin="$dropin_dir/test-alert.conf"
cleanup() {
  rm -f "$dropin"
  systemctl daemon-reload
}
trap cleanup EXIT
install -d -m 0700 "$dropin_dir"
printf '%s\n' \
  '[Service]' \
  'ExecStart=' \
  'ExecStart=/usr/local/sbin/arsnova-monitor --test-alert' \
  >"$dropin"
systemctl daemon-reload
systemctl start arsnova-monitor.service
EOF
```

Dieser Lauf verwendet dieselbe `DynamicUser`-/Sandbox-/`EnvironmentFile`-
Konfiguration wie der produktive Timer und räumt den flüchtigen Drop-in auch
bei einem Fehler auf. Nach bestätigtem Eingang den echten Poller einmal starten
und den Timer aktivieren:

```bash
sudo systemctl start arsnova-monitor.service
sudo systemctl enable --now arsnova-monitor.timer
sudo systemctl status arsnova-monitor.service arsnova-monitor.timer --no-pager
systemctl list-timers arsnova-monitor.timer
sudo journalctl -u arsnova-monitor.service -n 50 --no-pager
```

Der erste gesunde Lauf sendet keine Nachricht. `MONITORING_HEARTBEAT_URL` ist
optional und wird nach jedem erfolgreich abgeschlossenen Lauf mit einem leeren
HTTPS-POST aufgerufen. Damit kann ein externer Dead-Man's-Switch einen
ausgefallenen Timer oder Host erkennen. Wenn ein Heartbeat konfiguriert ist,
bei der Abnahme mindestens drei reguläre Minutenläufe und anschließend den
extern sichtbaren „healthy“-Zustand bestätigen. Danach den Dead-Man's-Switch
tatsächlich prüfen:

```bash
sudo systemctl stop arsnova-monitor.timer
# Das konfigurierte externe Ausfallfenster abwarten und Alarmempfang bestätigen.
sudo systemctl start arsnova-monitor.timer
sudo systemctl start arsnova-monitor.service
# Recovery des externen Heartbeat-Alarms bestätigen.
```

Der Timer muss nach dem Drill wieder `active (waiting)` sein. Ohne bestätigten
Ausfallalarm und Recovery ist ein konfigurierter Heartbeat nicht abgenommen.

### Payload und Datenschutz

Alarm-Payloads enthalten Instanzbezeichner, Zeitpunkt, Ereignistyp, Schweregrad
sowie Regel-ID, Bezeichnung, beobachteten Aggregatwert und Schwelle. Nicht
enthalten sind Diagnose-Secret, Webhook-Token, IP-Adressen, Session-Codes,
Raum-IDs oder Rohreports. Redirects werden weder bei Diagnose- noch bei
Webhook-Anfragen verfolgt. Recovery- und Update-Payloads führen aufgelöste
Regel-IDs mit ihrem vorherigen Schweregrad unter `resolvedAlerts`.

Bei `monitor_probe_failed` zuerst App, lokalen Port 3000, Diagnose-Secret und
`health.check` kontrollieren. Solange die Telemetrie unbekannt ist, bleiben
bereits aktive Metrikalarme und deren Recovery-Zähler eingefroren; ein
Probe-Ausfall darf sie nicht als behoben melden. Ein fehlgeschlagener
Webhook-Lauf schreibt den neuen Alarmzustand nicht fest und versucht die
Zustellung beim nächsten Minutenlauf erneut.

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
