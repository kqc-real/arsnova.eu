# Produktionsbetrieb mit zwei oder drei Apps

`docker-compose.prod.yml` definiert App A als `app`, die optionalen Apps B
und C und den dedizierten Yjs-Relay. Das Overlay
`docker-compose.prod.replicas.yml` schaltet App A auf den Replikabetrieb um.
Alle Apps verwenden den bereitgestellten Digest, dasselbe PostgreSQL und
denselben Redis. Nginx bleibt auf dem Host und terminiert TLS. Die App-Ports
sind an Loopback gebunden.

| Modus     | HTTP / tRPC-WebSocket | Yjs                  | App-DB-Pools |
| --------- | --------------------- | -------------------- | ------------ |
| `single`  | A                     | Embedded-Relay auf A | Basiswert    |
| `primary` | A                     | Dedizierter Relay    | Übergang     |
| `dual`    | A, B                  | Dedizierter Relay    | 2 × 30       |
| `triple`  | A, B, C               | Dedizierter Relay    | 3 × 20       |

App A übernimmt weiterhin die geplante Session-Retention (fällt App A vorübergehend
aus, pausiert die automatische Bereinigung bis zur Rückkehr des Containers).
Redis Pub/Sub, die gemeinsamen tRPC-WebSocket- und Reconnect-Budgets,
das gemeinsame PDF-Limit und der geteilte LLM-Slot sind im Replikabetrieb
auf allen Apps aktiv; `UsageStatisticOutbox` verarbeitet Zeilen über
`FOR UPDATE SKIP LOCKED` ohne gegenseitiges Lock-Warten. Der dedizierte Relay
publiziert seine WebSocket-Telemetrie ebenfalls nach Redis (fehlt sein
Heartbeat bei `YJS_RELAY_MODE=external`, meldet `dependencies.live`
kontrolliert `degraded`) und bestätigt Token-Rotationen auch bei HTTP-Zugriffen
über B oder C. Auch die Kernaktions-Diagnose (`coreActionsQuality` / `qaApi`)
und der 5-Minuten-Cache der LLM-Laufzeitstichprobe (`openWeightLlmProbe`)
werden clusterweit über Redis zusammengeführt.

Die Apps lesen Presenter-Fläche, Seitenkontext, Wortwolken und Q&A-Filter
aus demselben Redis-Snapshot. Emoji-Reaktionen werden dort je Teilnehmer,
Frage und Runde atomar ersetzt. Die Session-Bereinigung löscht beide
Zustände. Bei einer Redis-Störung können die betroffenen Lese- und
Schreibvorgänge vorübergehend fehlschlagen. Bei Rückkehr in den
Ein-App-Modus wechselt die App für diese Zustände auf ihren lokalen Speicher.
Deshalb für einen Rollback zwischen laufenden Präsentationen das bereits
vorgesehene Wartungsfenster nutzen.

Für den regulären Produktivbetrieb `up` mit zwei Apps und 2 × 30
DB-Verbindungen verwenden. Mit `enable-third` bleibt die dritte App für
eine gesonderte Abnahme zuschaltbar. Der Operator stellt dann alle drei
Pools auf je 20 Verbindungen um. Die
[Zielhost-Messung vom 20. November](TARGET-HOST-LOAD-2026-11-20.md#zwei-oder-drei-apps-mit-dem-fix)
zeigt den Geschwindigkeitsgewinn der dritten App bei gleichzeitigen
30 × 30-Votes und die größere CPU-Reserve der zwei Apps.

Bei aktivierter Moderationszusammenfassung benötigen alle Apps dieselbe
`QA_SUMMARY_STATE_REDIS_URL` auf einer eigenen privaten Redis-Instanz ohne
AOF und RDB (getrennt von `REDIS_URL`). Fehlt diese URL oder zeigt sie auf
dieselbe Instanz wie `REDIS_URL`, bricht der App-Start im Replikabetrieb
fail-closed ab. Das Staging stellt diese Instanz bereit; solange sie in der
Produktion fehlt, `QA_SUMMARY_ENABLED=false` beibehalten.
Der Relay verwendet dieselben Yjs-Schlüssel und denselben Redis für
Share-Metadaten wie die Apps.

## Nginx einmalig vorbereiten

1. Den regulären Digest-Deploy auf App A mit
   [dem Produktionsablauf](../deployment-debian-root-server.md) erfolgreich
   abschließen. DB-Migration und Rollout-Purge laufen dort zentral. Dieser
   Deploy installiert auch die additive PostgreSQL-Funktion für gebündelte
   Joins mit freiem Nickname. Die Funktion kann beim Rückweg genutzt werden
   oder neben älteren Images mit Einzel-Join bestehen.
2. In der aktiven TLS-Site die drei bisherigen `upstream`-Blöcke für
   `app_http`, `app_ws_trpc` und `app_ws_yjs` durch die Pool-Datei in
   `/etc/nginx/conf.d/` ablösen. Die TLS-, Header-, Logging- und
   Timeout-Regeln aus der bestehenden Site übernehmen.
3. Die Yjs-Location aus dem Produktionsablauf verwenden. Sie matcht
   `/yjs-ws/` mit abschließendem Slash und leitet das darunterliegende
   Raumsegment an `http://app_ws_yjs/` weiter. Der Querystring mit
   Share-Token bleibt von der Protokollierung ausgenommen.

```bash
./scripts/prod-replicas.sh render single |
  sudo tee /etc/nginx/conf.d/arsnova-live-pools.conf >/dev/null
sudo nginx -t && sudo nginx -s reload
curl -fsS http://127.0.0.1:18081/mode
curl -fsS http://127.0.0.1:18081/ready
```

Die beiden Statuspfade lauschen ausschließlich auf Loopback. Vor und nach
der ersten Umschaltung die öffentliche Website, tRPC und die
WebSocket-Pfade über die Produktionsdomain prüfen.

## Automatische Releases aus GitHub Actions

Für den bereits eingerichteten Nginx die Freigabe einmalig als Administrator
installieren. Die beiden Dateien aus dem Release-Commit übernehmen.
GitHub Actions meldet sich weiterhin als `deploy` an. Der
root-eigene Helfer nimmt ausschließlich feste Pool-Modi an und prüft
seine Konfiguration vor jedem Reload. Docker, Git und die Deploy-State-Dateien
bleiben unter dem bestehenden Deploy-Account.

```bash
sudo install -o root -g root -m 0755 deploy/production/nginx-pools.sh /usr/local/sbin/arsnova-nginx-pools
sudo visudo -cf deploy/production/arsnova-nginx-pools.sudoers
sudo install -o root -g root -m 0440 deploy/production/arsnova-nginx-pools.sudoers /etc/sudoers.d/arsnova-nginx-pools
# Als deploy im neuen Release-Checkout prüfen. Führt keinen Reload durch.
./scripts/prod-replicas.sh check
```

Die GitHub-Umgebung `production` und `DEPLOY_ENABLED=true` bleiben
Voraussetzungen. Für einen eingerichteten Host mit verifiziertem
`current.state` führt der Release-Runner die gesamte Sequenz im selben
SSH-Job und unter derselben Produktionssperre aus:

1. Ziel-Checkout, freigegebenen Image-Digest, bisherigen Deploy-State und
   passwortlosen Zugriff auf den Nginx-Helfer prüfen.
2. Auf App A mit eingebettetem Yjs wechseln, weitere Writer und den alten
   Relay stoppen. Danach den bestehenden Digest-Deploy einschließlich
   Migrationen, Writer-Drain und Purge ausführen.
3. App A, App B und den Relay aus demselben Digest starten. Nginx erst nach
   erfolgreichem DB-, HTTP-, WebSocket-, Yjs- und Redis-Readiness-Check
   auf zwei Apps mit je 30 DB-Verbindungen schalten. Ein zuvor bewusst
   aktivierter `triple`-Modus wird mit 3 × 20 wieder aktiviert.
4. Die öffentliche HTTPS-Adresse über Nginx mit dem bestehenden
   Production-Serve-Smoke prüfen. Scheitert ein Schritt nach Wechselbeginn,
   den vorigen Digest und die vor dem Release aktive Topologie wiederherstellen.
   Der Job bleibt bei einem zurückgerollten Release rot. Ein unterbrochener
   Wechsel im Modus `primary` wird zum Standardmodus `dual` vervollständigt.

Den ersten Digest-Deploy einer frischen Installation weiterhin mit
`scripts/deploy.sh` durchführen. Automatische Releases planen, wenn
laufende Sessions kurz unterbrochen werden dürfen. Die Apps und der Relay
starten neu und WebSockets verbinden sich erneut. Ein Image-Rollback
setzt keine Datenbankmigrationen zurück.

### Staging-Nachweis

Der isolierte Release-Test am 20. November 2026 verwendete die beiden
Produktions-Compose-Dateien, eine lokale TLS-Test-Registry mit getrennten
Digests, PostgreSQL, Redis und Nginx. Der Runner lief als `deploy` mit der
begrenzten sudoers-Regel. Der erfolgreiche Release aktivierte zwei Apps mit
je 30 Verbindungen, den Relay aus demselben Digest und zwei Subscriber je
Redis-Kanal. Der fehlende Nginx-Zugriff brach vor dem Containerwechsel ab.
Ein eingebauter Fehler im HTTPS-Smoke löste den Image- und Topologie-Rollback
aus. Der Rückweg funktionierte auch auf den älteren Checkout ohne
Release-Runner. PostgreSQL und Redis behielten ihre Container und die
geprüften Testdaten.

`node --test scripts/ci/*.test.mjs scripts/deploy/*.test.mjs` prüft zusätzlich
die Rollout-Reihenfolge, konkurrierende Aufrufe und den Rückweg vor sowie
nach der Rotation des Deploy-States.

## Umschalten und zurückrollen

Die Befehle im Produktionscheckout ausführen. Der ausführende Operator
braucht Docker-Zugriff sowie Schreib- und Reload-Rechte für Host-Nginx.
Bei einem benannten Compose-Projekt dieselbe Projektkennung wie beim
Digest-Deploy verwenden.

```bash
sudo ./scripts/prod-replicas.sh up
./scripts/prod-replicas.sh status

# Erst für die spätere Abnahme der dritten App.
sudo ./scripts/prod-replicas.sh enable-third

# Von drei zurück auf zwei Apps.
sudo ./scripts/prod-replicas.sh up

# Zurück zum Basisbetrieb einschließlich Embedded-Yjs.
sudo ./scripts/prod-replicas.sh rollback
```

Der Operator prüft Digest und DB-Pool der Apps, PostgreSQL, den
tRPC-Healthcheck, einen echten tRPC-Heartbeat über den WebSocket sowie die
Subscriber-Zahl auf allen vier Redis-Kanälen. Nginx übernimmt neue
Upstreams erst danach. Die Umschaltung validiert die Kandidatendatei mit
`nginx -t` und prüft den neuen Modus nach dem Reload. Bei einem Fehler
stellt sie die vorherige Pool-Datei wieder her.

Den ersten Wechsel, die Pool-Umstellung von 30 auf 20 und den Rückweg im
Wartungsfenster durchführen. Der Operator entfernt B und C zuerst aus
beiden Nginx-Pools und stoppt sie anschließend. Bei der Änderung des
DB-Pools wird auch App A neu erstellt. Bestehende WebSockets müssen sich
erneut verbinden. Yjs wechselt beim ersten Start und beim Rückweg den
Relay-Prozess. PostgreSQL, Redis und ihre Volumes bleiben im selben Projekt.

Bei einem manuellen Aufruf von `scripts/deploy.sh`, `--rollback` oder
`--recover` zuerst mit `prod-replicas.sh rollback` in den Einzelbetrieb
wechseln. Der automatische Release-Runner führt die Topologieschritte selbst
aus. Aktivierung und spätere Container-Neustarts im Replikabetrieb verwenden
direkt den Backend-Prozess. Damit führt kein weiterer Writer parallel
Migrationen oder den Rollout-Purge aus.

### App-Umgebung ändern

Für eine Änderung an `.env.production` im Replikabetrieb ebenfalls
`rollback` im Wartungsfenster ausführen. Die Basis-App mit der neuen
Konfiguration prüfen und danach die gewünschte Topologie mit `up` oder
`enable-third` erneut aktivieren. `up` allein kann bei unveränderter
Topologie mit erfolgreicher Readiness zurückkehren.

## Störungen einordnen

- `single` meldet den Basisbetrieb. `primary` meldet App A mit dediziertem
  Relay und kann nach einem abgebrochenen Aufschalten weiter bedienen.
  Sobald App A bereit ist, führt `rollback` aus diesem Zwischenstand
  vollständig zum Basisbetrieb zurück.
- Stimmt der Nginx-Modus mit der laufenden Topologie überein, den
  öffentlichen HTTP- und WebSocket-Pfad zusätzlich prüfen. Der Loopback-
  Healthcheck prüft die Weiterleitung und die Redis-Erreichbarkeit.
- Liefert Nginx weiterhin Fehler, `nginx -t`, den aktiven Modus und die
  Logs aller beteiligten App- und Relay-Dienste prüfen. Bei einem fehlenden
  Redis-Subscriber kann der Host-Stand über den periodischen Lese-Fallback
  sichtbar werden. Der Fallback kann später aktualisieren als Pub/Sub.
  Solange
  eine Abschlussrangliste angezeigt wird, liest das Status-Abo im
  Replikabetrieb spätestens beim nächsten Zehn-Sekunden-Fallback aus Redis.
  So erreicht auch das Ausblenden die Presenter-Ansicht, wenn ein
  Statussignal verloren geht.

[Betriebsmetriken und WebSocket-Diagnose](MONITORING-RUNBOOK.md#websocket-anstieg).

## Abnahme

Der isolierte lokale Smoke mit dem Produktions-Image und Nginx 1.28
bestätigte `single → dual → triple → dual → single`. Nginx verteilte HTTP
und tRPC-WebSockets auf alle aktiven Apps. Ein Vote auf A war beim Host auf B
bzw. C sichtbar. Die Yjs-Rotation trennte den alten Socket und ließ den
neuen Token zu. Ein absichtlich ungültiger Nginx-Kandidat wurde durch die
vorherige Pool-Datei ersetzt. PostgreSQL und Redis behielten dieselben
Container und Volumes.

Die [kurzen Lastprofile auf dem Zielhost](TARGET-HOST-LOAD-2026-11-20.md)
wurden mit zwei und drei Apps gemessen. Die Ziele für 500 gleichzeitige
Joins und eine gemeinsame 900er-Vote-Welle bleiben offen. Dauerlast,
gleichzeitigen PDF-Export, Yjs-Rotation und Reconnect nach einem App-Ausfall
für die vollständige Abnahme prüfen. Die Zielhost-Messung nutzte
HTTP-Keepalive im isolierten Nginx. Der Produktionsoperator erzeugt
seine eigenen Upstream-Pools. [Abnahmekriterien](../implementation/S6.5-SECURITY-LOAD-ACCEPTANCE.md), [bisherige Lastprofile](MULTI-INSTANCE-PLAN.md).
