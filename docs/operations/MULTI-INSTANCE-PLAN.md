# Mehrinstanzbetrieb: aktueller Stand und Umsetzungsplan

> Stand: 2026-09-18 · Issue #428 AP7 · kein Implementierungsauftrag für den
> Mehrinstanzumbau selbst.

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

## Geplanter Redis-Zustand

1. Jedes heute prozesslokale Live-Signal erhält einen Redis-Kanal mit
   Session- bzw. Code-Schlüssel und kurzer TTL auf der Versionszahl.
2. Publisher schreiben zuerst die persistente Revision, danach das Signal.
   Subscriber wenden nur neuere Versionen an.
3. Nach Pub/Sub-Unterbrechung ist ein vollständiger Revisionsresync Pflicht;
   das letzte Signal darf nicht als Quelle der Wahrheit gelten.
4. Presenterfläche und Wortwolkenprojektion werden entweder in Redis mit TTL
   gespiegelt oder bewusst hostseitig nach jedem Instanzwechsel neu gesetzt.
5. Yjs bleibt raumgebunden: Sticky Sessions oder ein gemeinsamer
   y-websocket-Dienst; ein zweiter Backendprozess darf keinen eigenen
   unverbundenen Provider öffnen.

## Geplantes Zweinstanz-Gate

Vor einer Freigabe müssen in einer isolierten Referenzumgebung bestehen:

- Host auf Instanz A, Teilnehmende und Presenter auf Instanz B;
- verteilter HTTP- und WebSocket-Verkehr ohne Session-Affinität als negativer
  Nachweis, danach mit nachweisbarer Affinität oder gemeinsamem Signalbus;
- Vote, Kanalwechsel, Wortwolke, Scorecard/Leaderboard und Q&A-Frist;
- Reconnect aller 500 Clients und Ausfall einer Instanz während aktiver Runde;
- unveränderte Auth-, Capability-, Cache- und Effective-Vote-Invarianten.

## Betriebsgrenze

`docker-compose.prod.yml` sieht weiterhin **ein** Backend vor. Lasttests mit
`QA_SCALE_DIAGNOSTIC_TRPC_URLS` dürfen mehrere Diagnoseziele nennen, das ist
kein Produktions-Mehrinstanzbetrieb. Ein tatsächlicher Umbau braucht eine
eigene Freigabe und darf AP1–AP6 nicht blockieren.
