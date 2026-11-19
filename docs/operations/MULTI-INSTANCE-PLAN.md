# Mehrinstanzbetrieb: aktueller Stand und Umsetzungsplan

> Stand: 2026-11-19 · Issue #428 AP7 · Umsetzungsvorschlag für einen
> Staging-Host mit 12 vCPU und 32 GB RAM.

Die Produktionsgrenze bleibt **eine Backendinstanz** für HTTP, tRPC-WebSockets
und Yjs. AP1–AP6 dürfen diese Grenze nicht voraussetzen. Mehrere App-Prozesse
würden die unten genannten Live-Zustände nicht automatisch teilen.

## Prozesslokale Live-Zustände

| Zustand                                                                    | Maßgebliche Quelle                                                  | Recovery heute                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Session-Status-, Teilnehmer-, Frage- und Vote-Progress-Signale             | PostgreSQL-Revisionen; Fan-out über prozesslokale `EventEmitter`    | Kurzer DB-Revisionsfallback in den Subscriptions; kein instanzübergreifendes Pub/Sub |
| Q&A-Invalidierung (`qaQuestionsSignal`)                                    | `qaRankingRevision` / Lifecycle in PostgreSQL; Signal im Prozess    | Fallback 15 s (Teilnahme) bzw. 2 s (Host); Fristwecker unabhängig vom Signal         |
| Blitzlicht-Ergebniscache                                                   | Redis-Hashes der Runde; 250-ms-Prozesscache nur als Bündelung       | Nächster Poll liest Redis neu; Cache verfällt oder wird bei Fehler verworfen         |
| Quiz-Ranglisten- und Q&A-Seitencache                                       | PostgreSQL-Stimmen/Zähler; Prozesscache nach Revision/Grenze        | TTL 2 s plus Invalidation bei Vote/Purge; bei Instanzwechsel voller Reload           |
| Vote-Zähler- und Session-Info-Caches                                       | PostgreSQL; Prozesscache                                            | `clearSessionReadCaches` / Purge; sonst TTL                                          |
| `presenterSurfaceByCode`, `qaWordCloudProjectionByCode`, Finish-Projektion | Hostaktion im Prozess; DB-Resync stellt diese Maps nicht wieder her | Nach Reconnect oder anderer Instanz Fallback auf Default bzw. erneute Hostaktion     |
| Yjs-Raumbindung und Share-Provider                                         | Raum-ID plus Share-Token; Provider hängt am lokalen Prozess         | Anderer Prozess kennt den Raum nicht; Clients müssen denselben Origin treffen        |
| Presence (Tempo/Q&A-Online)                                                | Redis Sorted Sets                                                   | Instanzunabhängig, sofern beide Prozesse dasselbe Redis nutzen                       |
| Host-Pairing- und Session-Purge-Invalidierung                              | Redis Pub/Sub plus lokale Maps                                      | Vorbild für Signale; Pub/Sub allein ist kein persistenter Zustand                    |

## 1. Zielaufbau auf einem Host

| Pfad am Host-Nginx | Upstream auf dem Host                    | Aufgabe                         |
| ------------------ | ---------------------------------------- | ------------------------------- |
| `/`, `/trpc`       | A `127.0.0.1:13000`, B `127.0.0.1:13100` | Angular und tRPC-HTTP           |
| `/trpc-ws`         | A `127.0.0.1:13001`, B `127.0.0.1:13101` | Live-Subscriptions              |
| `/yjs-ws`          | Relay `127.0.0.1:13202`                  | Quiz-Sammlungen synchronisieren |

- Neue Staging-Compose-Variante mit `app-a` und `app-b` aus einer gemeinsamen
  Dienstvorlage. Beide starten denselben gepinnten Image-Digest mit eindeutiger
  Instanz-ID und den internen Ports 3000 und 3001. Zwei explizite Dienste
  erlauben Einzelstarts und feste Loopback-Ports. Das bestehende
  `container_name` und die festen Host-Ports verhindern direktes `--scale`.
- Beide Apps nutzen dasselbe PostgreSQL, Redis 7.4 und denselben PDF-Worker.
  Der Yjs-Relay läuft als eigener Dienst. PostgreSQL und Redis bleiben im
  internen Compose-Netz. Staging bekommt eigene Volumes, Domain und Secrets.
  Innerhalb der Umgebung teilen beide Apps die Schlüssel und die öffentliche
  Origin. Falls Inferenz zum Zielprofil gehört, läuft sie für alle
  Vergleichsläufe separat und mit identischer Konfiguration.
- Migrationen und Deploy-Sweeps einmal pro Release ausführen. Den heute bei
  jedem App-Start gestarteten Session-Cleanup auf einen dedizierten Scheduler
  oder einen DB-koordinierten Lauf umstellen. Den Wechsel zur Mehrinstanz
  im Deploy-Skript und in den Smoke-Checks explizit abbilden.

### Nginx-Upstreams

Diese Blöcke ersetzen die Upstreams aus der
[Deployment-Anleitung](../deployment-debian-root-server.md). Die vorhandenen
`location`-Blöcke behalten TLS, vertrauenswürdige Forwarded-Header, WebSocket-
Upgrade und Yjs-Log-Redaktion. Vor dem Reload auf dem Zielhost `nginx -t` und
Readiness für HTTP, tRPC-WS und Yjs prüfen.

```nginx
upstream app_http {
    zone arsnova_http 64k;
    least_conn;
    server 127.0.0.1:13000 max_fails=1 fail_timeout=10s;
    server 127.0.0.1:13100 max_fails=1 fail_timeout=10s;
}

upstream app_ws_trpc {
    zone arsnova_trpc_ws 64k;
    least_conn;
    server 127.0.0.1:13001 max_fails=1 fail_timeout=10s;
    server 127.0.0.1:13101 max_fails=1 fail_timeout=10s;
}

upstream app_ws_yjs {
    server 127.0.0.1:13202;
}
```

`least_conn` verteilt neue Verbindungen. Die Zone teilt den Upstream-Zustand
zwischen Nginx-Workern. Bestehende WebSockets bleiben am gewählten Container,
bis sie sich neu verbinden. IP-Affinität würde Clients hinter Schul-NAT
zusammen auf demselben Container bündeln. Die Wiederholung bereits gesendeter
HTTP-Mutationen durch Nginx bleibt deaktiviert. Worker-Verbindungen und
Dateideskriptoren für Client- und Upstream-Sockets einschließlich
Reconnect-Überlappung dimensionieren. Upstream-Metriken aggregiert erfassen,
ohne Querystrings oder Share-Tokens zu protokollieren.
[Nginx-Upstreams](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) ·
[WebSocket-Proxying](https://nginx.org/en/docs/http/websocket.html) ·
[Compose-Dienste](https://docs.docker.com/reference/compose-file/services/#container_name)

## 2. Redis, Live-Zustand und gemeinsame Budgets

1. Einen typisierten, versionierten Redis-Signalbus mit eigener
   Subscriber-Verbindung je App aufbauen. An die bestehenden Signalpfade für
   Host-Pairing und Session-Purge anknüpfen. Sessionstatus, Frage,
   Teilnehmendenwechsel, Vote-Fortschritt und Q&A anbinden. Nach erfolgreichem
   Commit Session-ID, Signalart und fachliche Revision publizieren. Lokale
   Waiter wecken und die betroffenen Caches invalidieren. Vote-Fortschritt
   darf Wellen bündeln. Nutzdaten bleiben in den bestehenden tRPC-DTOs mit
   den jeweiligen Berechtigungen. Vertragsänderungen beginnen in Shared
   Types/Zod und gehen danach in Backend und Frontend.
2. Pro Zustand die autoritative Quelle und deren Revision festlegen. Doppelte
   und verspätete Ereignisse anhand der fachlichen Revision behandeln.
   Für Beamerfläche, Wortwolke und Abschlussprojektion einen über beide Apps
   lesbaren Snapshot bereitstellen. Aus PostgreSQL ableitbaren Zustand dort
   belassen. Rein prozesslokale Projektionen als versionierte Redis-Snapshots
   mit Session-TTL speichern und erst danach signalisieren. Konkurrierende
   Updates atomar entscheiden. Purge und Ablauf müssen auch verspätete
   Updates abweisen.
3. Bei Einstieg auf B und nach Subscriber-Reconnect den neuesten Snapshot
   laden. Pub/Sub-Signale sind flüchtig. Den vorhandenen Revisionsfallback
   auch für einen erfolgreichen Commit mit fehlgeschlagenem Publish testen.
   AOF und bestehende `WAITAOF`-Pflichten gemäß Produktions-Compose
   beibehalten. Bei Redis-Ausfall gelten die vorhandenen Regeln für
   Berechtigungen, Widerrufe und Persistenz.
   [Redis-Zustellsemantik](https://redis.io/docs/latest/develop/pubsub/#delivery-semantics)
4. Mit `DATABASE_POOL_MAX=30` je App beginnen. 60 mögliche Verbindungen
   lassen Reserve für Betrieb und Migrationen gegenüber dem üblichen
   PostgreSQL-Limit von 100. Poolwartezeiten messen. Für einen kontrollierten
   Ein-App-Vergleich denselben Gesamtpool von 60 verwenden und die Abweichung
   vom aktuellen Default 40 im Bericht angeben.
5. **Einen gleichzeitig aktiven PDF-Auftrag** über beide Apps koordinieren.
   Abschluss, Timeout und Absturz von App oder Worker müssen das Budget
   wieder freigeben, sobald der Auftrag tatsächlich beendet ist.
   Gemeinsame WebSocket- und Reconnect-Budgets über Redis koordinieren,
   einschließlich Limits je Session und Teilnehmer. Atomare Reservierungen,
   Freigabe bei Close und Ablauf bei Prozessverlust vorsehen. Lokale Caps
   bleiben als zweite Schranke je Prozess. Für Staging zunächst 1.200 Sockets
   je App, 2.100 global, 1.100 je Session und zwei je Teilnehmer-Tupel
   ansetzen. Die 2.100 berücksichtigen zwei Kohorten mit je 900 Teilnehmenden
   und 60 Steuer-Sockets während eines Reconnects. Eine verbleibende App
   muss 960 reguläre Verbindungen aufnehmen können. Ablehnungen und
   Reconnect-Schieflast messen, bevor Limits für Produktion freigegeben werden.

## 3. Yjs als eigener Dienst

- Den vorhandenen `YjsRelayServer` im selben Image mit eigenem Einstiegspunkt,
  Readiness und geordnetem Shutdown starten. Beide App-Prozesse starten HTTP
  und tRPC-WebSockets. Der Relay bindet intern Port 3002 und ist über den
  bisherigen Browser-Pfad `/yjs-ws` erreichbar.
- Erstellen und Rotieren von Share-Links verbleiben in den tRPC-Routern beider
  Apps. Der Relay verwendet dieselben Redis-Metadaten und Schlüssel. Bestehende
  Regeln für Tokenprüfung, Widerruf, Raum- und Bytebudgets erhalten.
  Die heute lokale Benachrichtigung `onYjsShareRotated` durch einen
  Redis-Signalpfad mit Bestätigung des Relays ersetzen. Der Relay aktualisiert
  die Generation und beendet ältere, bereits offene Sockets. Die Rotation
  erhält erst nach dauerhaft gespeicherter Generation und Relay-Bestätigung
  eine Erfolgsantwort. Für Timeout oder verlorene Bestätigung denselben
  Rotationsvorgang idempotent fortsetzen. Beim Wiederanbinden prüft der Relay
  die aktuelle Generation aller offenen Räume aus Redis.
- Abnahme mit zwei Browsern in derselben Sammlung. Link über A erstellen,
  über B rotieren und alten sowie neuen Token am Relay prüfen. Bestehende
  Sockets der alten Generation müssen vor der Erfolgsantwort geschlossen
  sein. Rotation bei unterbrochenem Signalpfad und anschließendem Retry
  ebenfalls prüfen. App A stoppen
  und den laufenden Sync beobachten. Danach den Relay separat neu starten und
  Konvergenz einschließlich Offline-Änderungen anhand der Yjs-State-Vectoren
  prüfen. `load:yjs:sync` und `load:yjs:token-reconnect` mit
  `YJS_WS_URL=wss://staging.example.invalid/yjs-ws` ergänzen die Abnahme.
  Beim Token-Smoke die Clientzahl an das konfigurierte Raumlimit anpassen.

## 4. Lasttest auf dem Zielhost

Zuerst **eine App**, anschließend **zwei Apps** hinter Nginx vergleichen. Pro
Profil und Topologie einen Warmlauf und drei gewertete Läufe mit frischen
Sessions fahren. Image, Host, Gesamtpool, Datenprofil und Feature-Flags
vergleichbar halten. TLS-Verkehr geht über Nginx, der Lastgenerator läuft
außerhalb des Zielhosts. Isolierte Diagnoseziele für A und B dienen dem
gezielten Routing im Integrationstest und der Messung pro Replikat. Für
`30 × 30` den Klassenstart sowohl aus einer gemeinsamen Quell-IP als auch
mit auf mehrere Schulnetze verteilter Last abbilden. Für den formalen
§6.5-Lauf die Prozess- und Abhängigkeitsproben des Orchestrators um beide
App-Replikate erweitern. Eine gesunde App allein reicht als Laufnachweis für
den Zweireplikatbetrieb nicht aus.

| Profil      | Verkehr                                                                                                                                                                                                                                                                                                                                     | Ausführung                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 × 500** | 500 Teilnehmende von derselben Quell-IP, Host und Presenter separat. Join-Welle, 500 aktive WS-Clients, Fragewechsel, Vote-Burst, Ergebnis und koordinierter Reconnect. Ein separater Durchgang überlagert den Burst mit einem PDF-Export.                                                                                                  | Vorhandene Runner nach [§6.5](../implementation/S6.5-SECURITY-LOAD-ACCEPTANCE.md) verwenden. `load:artillery:500`, `load:artillery:reconnect:500`, `load:k6:hotpaths` für den Burst und `load:pdf-vs-voting:500`. Report gegen die §6.5-Grenzen auswerten.                                                                                                                                                                                |
| **30 × 30** | 30 Sessions mit je 30 Teilnehmern, Host und Presenter. In 90 s aufbauen und 30 min halten. Sechs versetzte und vier koordinierte Fragerunden, darunter 900 Votes binnen 2 s. Je fünf Klassen wechseln zwischendurch zu Q&A und Blitzlicht. Einen Burst mit aktivem PDF-Export wiederholen, danach koordinierter Reconnect aus zehn Klassen. | Neuen Runner `scripts/load/multi-classroom-30x30.mjs` mit der bestehenden [tRPC-Testbibliothek](../../scripts/load/lib/trpc-runtime.mjs) und dem [Kanal-Fan-out-Smoke](../../scripts/load/channel-ws-fanout-classroom-30.mjs) als Vorlage implementieren. Eine Barriere bestätigt 900 Teilnehmer- und 60 Steuer-Sockets vor den gemeinsamen Wellen. Der Runner prüft Ergebnisse je Session und räumt seine Sessions auch bei Abbruch auf. |

Vorgeschlagene Staging-Grenzen für **30 × 30**. Die Grenzwerte für **1 × 500**
stehen in §6.5. Alle gewerteten Zweireplikatläufe müssen beide App-Container
als aktive Upstreams nachweisen.

| Messung                           | Grenzwert                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Join und Vote ohne PDF-Last       | Je Pfad p95 < 1 s, p99 < 2 s, Fehlerquote < 0,5 %                                                                                                                               |
| Vote mit einem aktiven PDF-Export | p95 < 1,5 s, p99 < 3 s, Fehlerquote < 1 %                                                                                                                                       |
| WS und Host-Status                | Mindestens 99 % verbunden in stabilen Phasen. Host-Status p95 ≤ 1,5 s, p99 ≤ 3 s                                                                                                |
| Reconnect                         | Mindestens 95 % der betroffenen Clients innerhalb von 30 s mit korrekter Revision wieder nutzbar                                                                                |
| Fachliche Korrektheit             | Bestätigte Stimmen genau einmal in der richtigen Session. Keine vorzeitigen Lösungen oder fremden Session-Ereignisse. Konsistente Ergebnisse, Q&A- und Blitzlicht-Projektionen. |

**Ausfalltests in separaten Durchgängen.** Host auf A und Teilnehmende sowie
Presenter auf B platzieren. Fragewechsel prüfen, dann A mitten in einer Runde
stoppen. Verlorene Verbindungen müssen auf B wieder den richtigen Stand
erreichen. Bestätigte Votes abgleichen und eine unterbrochene Aktion über
ihren regulären Idempotenzpfad erneut senden. Beide Lastprofile mit App-Ausfall
prüfen, anschließend A wieder zuschalten. Separat den Redis-Subscriber
unterbrechen und den Revisionsabgleich testen. Die Integrationstests decken
außerdem Token-Widerruf zwischen A und B, Q&A-Frist, Scorecard/Leaderboard und
die Effective-Vote-Regel ab.

**Report je Phase und Klasse.** Join-, Vote-, Status- und Reconnect-Latenzen,
Fehler einschließlich unerwarteter 429, Upstream-Verteilung, aktive Sockets,
Reconnect-Überlappung und verspätete Revisionen erfassen. CPU, RSS und
Event-Loop-Lag je App sowie Host-CPU, Netzwerk, Datenträger, DB-Poolwartezeit
und Redis-Latenz messen. Digest und bereinigte Testkonfiguration dokumentieren.
Bei fehlender Kohorte, SLO-Verletzung, Datenintegritätsfehler oder drohender
Sättigung den Lauf abbrechen und den Grund festhalten.

## 5. Reihenfolge und Rückkehr

| Schritt                  | Ergebnis für den nächsten Schritt                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Staging               | Loopback-Portplan, isolierte Daten, Readiness für A/B und Relay. Ein-App-Baseline auf der Zielhardware.                                                                  |
| 2. Live-Zustand          | Redis-Signale, Revisionsabgleich und geteilte Projektionen. A/B-Integrationstests mit verlorenen, doppelten und verspäteten Signalen bestanden.                          |
| 3. Betrieb der Replikate | Eigener Relay, koordinierte Limits und Hintergrundläufe. Nginx nimmt B nach Readiness in HTTP- und WS-Pool auf.                                                          |
| 4. Abnahme               | Beide Lastprofile und Ausfalltests bestanden. Vergleichsberichte zeigen den Gewinn und verbleibende Engpässe.                                                            |
| 5. Verlagsbetrieb        | Betriebsfreigabe nach Durchsicht der Reports und geprobtem [Restore](BACKUP-RESTORE-RUNBOOK.md). Host, Nginx, PostgreSQL, Redis und Relay sind gemeinsame Ausfallpunkte. |

Für gestaffelte Updates die Kompatibilität von Migrationen, Live-Event-Versionen
und Frontend-Assets im Mischbetrieb belegen. Bis dahin Versionswechsel in einem
Wartungsfenster planen. Bei einem Routing- oder Kapazitätsproblem B aus beiden
Nginx-Upstreams nehmen, `nginx -t` und Reload ausführen, Verbindungen auslaufen
lassen oder kontrolliert zum Reconnect bringen und B stoppen. A und der
dedizierte Relay bedienen dann höchstens die in der Baseline abgenommene Last.
Ein Versionsrollback setzt kompatible Migrationen und Zustandsformate voraus.

Der aktuelle [Produktions-Compose](../../docker-compose.prod.yml) beschreibt
eine App. Dieses Dokument plant den Umbau. Zielhostläufe auf isoliertem Staging
und ein späterer Produktionswechsel folgen
[den bestehenden Betriebsfreigaben](../implementation/S6.5-SECURITY-LOAD-ACCEPTANCE.md).
