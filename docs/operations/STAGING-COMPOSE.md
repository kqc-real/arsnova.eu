# Staging mit Nginx und zwei Apps

[`docker-compose.staging.yml`](../../docker-compose.staging.yml) startet ein
isoliertes Staging-Projekt für HTTP, tRPC-WebSockets und Yjs. Der dedizierte
Yjs-Relay nutzt dieselbe Redis-Instanz wie beide Apps. Beide Apps teilen
einen PDF-Worker und einen spaCy-Sidecar.
Nginx terminiert TLS. Nur sein HTTPS-Port wird veröffentlicht, standardmäßig
auf `127.0.0.1:8443`. Beide Apps verwenden dasselbe Image, PostgreSQL und einen
eigenen Staging-Redis mit AOF. Pro App sind bis zu 30 Datenbankverbindungen
konfiguriert. PostgreSQL und Redis haben projektspezifische Volumes.
Das Produktions-Deploy-Skript verwaltet weiterhin das Produktionsprojekt.

Im Replikabetrieb bündelt jede App Teilnahme-Lesezugriffe und
Choice-Schreibvorgänge für die Abstimmung. Das Sammelfenster startet bei
fünf Millisekunden. Je Gruppe verarbeitet die App höchstens 128 Aufträge.
Die DB prüft aktive Frage und Runde unter dem Session-Lock. Stimme,
Antwortoptionen und Statistik-Outbox werden in derselben Transaktion
geschrieben. Eine durch einen Hostwechsel gesperrte Session geht in den
Einzelpfad. Andere Räume im Batch können ihre Stimmen speichern.

Nginx hält bis zu 256 inaktive HTTP-Upstream-Verbindungen pro Worker für
20 Sekunden. Der Idle-Timeout in Node beträgt im Replikabetrieb 25 Sekunden.
Dadurch kann Nginx seine Verbindungen vor Node aus dem Pool entfernen.
Die tRPC- und Yjs-WebSocket-Pfade behalten ihre eigenen Upstreams.

## Einrichtung

Docker Compose mit `up --wait` und Zugriff auf das App-Image voraussetzen.
Für einen Staging-Host `STAGING_IMAGE` auf einen Registry-Digest setzen.
Für einen lokalen Build aus einem sauberen Checkout das App-Image und den
Sidecar bauen.

```bash
docker build -t arsnova-staging:local .
docker build -t arsnova-spacy:3.8.15 docker/spacy
```

`STAGING_SPACY_IMAGE` kann auf eine versionierte Registry-Referenz zeigen.

`.env.staging.example` nach `.env.staging` kopieren und mit eigenen Werten füllen.
Das Datenbankpasswort als Hex-String erzeugen, damit es unverändert in die
Verbindungs-URL passt. JWT- und Envelope-Schlüssel separat erzeugen und bei
einer Wiederaufnahme desselben Stagings beibehalten. `STAGING_TLS_DIR` zeigt
auf ein Verzeichnis mit `fullchain.pem` und `privkey.pem`.
`STAGING_PUBLIC_URL` muss dem für die Clients erreichbaren HTTPS-Origin
entsprechen, einschließlich eines abweichenden Ports.

Für einen lokalen Test lässt sich ein kurzlebiges Zertifikat in einem
temporären Verzeichnis erzeugen:

```bash
umask 077
tls_dir=$(mktemp -d)
openssl req -x509 -newkey rsa:2048 -nodes -days 3 -subj /CN=localhost \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' \
  -keyout "$tls_dir/privkey.pem" -out "$tls_dir/fullchain.pem"
```

Den Pfad aus `$tls_dir` als `STAGING_TLS_DIR` eintragen. Für parallele
Testumgebungen `STAGING_PROJECT_NAME=arsnova-staging-<suffix>`,
`STAGING_ENV_FILE`, HTTPS-Port und Origin passend setzen. Die Compose-Datei
und die Betriebsbefehle bleiben dieselben.

### Optionaler Aufbau für die Textanalyse

Für das [45-Minuten-Mischprofil](../TESTING.md#gemischtes-lastprofil-mit-dem-demo-quiz-in-fünf-sprachen)
beide Sidecar-Images aus demselben Quellstand wie die Apps bauen oder die
entsprechenden Registry-Referenzen verwenden.

```bash
staging_tag=$(git rev-parse --short=12 HEAD)
docker build -t "arsnova-staging-spacy:$staging_tag" docker/spacy
docker build -t "arsnova-staging-encoder:$staging_tag" docker/wordcloud-encoder
```

Die entstandenen Image-Referenzen in der Staging-Umgebungsdatei unter
`STAGING_SPACY_IMAGE` und `STAGING_ENCODER_IMAGE` eintragen. Für die
generativen Pfade zusätzlich den [privaten LLM-Dienst und Q&A-Summary](#gemeinsamer-spacy-sidecar-und-llm-slot)
konfigurieren. Das Opt-in beim Aufruf des Wrappers setzen und für `status`,
`rollback` und `down` desselben Projekts beibehalten.

```bash
STAGING_TEXT_ANALYSIS=true ./scripts/staging-compose.sh config
STAGING_TEXT_ANALYSIS=true ./scripts/staging-compose.sh up
```

Der Encoder hat keinen Netzwerkzugang. Beide Apps lesen seinen Unix-Socket
über ein eigenes Compose-Volume. Der Wrapper prüft aus jeder App für
`de`, `en`, `fr`, `es` und `it` eine Lemmatisierung und einen Encoder-Vektor.
Für Italienisch muss spaCy `andavano` auf `andare` zurückführen. Ein Fehler
bricht den Kaltstart vor der Nginx-Aktivierung ab. Bei einem Wechsel des
Staging-Profils oder der Images zuerst `down` mit der bisherigen
Konfiguration ausführen. Die projektbezogenen Datenvolumes bleiben dabei
erhalten.

## Start und Readiness

```bash
./scripts/staging-compose.sh config
./scripts/staging-compose.sh up
./scripts/staging-compose.sh status
curl --fail --cacert "$tls_dir/fullchain.pem" \
  https://127.0.0.1:8443/trpc/health.check
```

Beim Kaltstart lässt der gemeinsame Init-Dienst `migrate` Prisma die
versionierten Migrationen anwenden. Beide Apps hängen dabei von dessen
erfolgreichem Abschluss ab. Der Scheduler für Session-Cleanup läuft auf A.
Ein App-Neustart startet weder
Migrationen noch Rollout-Sweeps. Die Testdaten gehören ausschließlich in
dieses Staging. [Compose-Startreihenfolge](https://docs.docker.com/compose/how-tos/startup-order/)

Die App-Readiness prüft eine SQL-Abfrage, Redis über den öffentlichen
tRPC-Healthcheck, einen echten tRPC-Heartbeat über den WebSocket sowie die
Unix-Sockets von PDF-Worker und spaCy.
Der Betriebsbefehl prüft HTTP und WebSocket zusätzlich aus dem jeweils
anderen App-Container und zählt je zwei Redis-Abonnenten auf allen vier
Session-Kanälen. Bei einem Redis-Neustart verbinden sich auch die regulären
Redis-Clients der Apps wieder. `up` prüft ihren Zustand direkt. Nginx
startet beim ersten Hochfahren mit A. Nach den
Prüfungen aktiviert `up` beide Pools und lädt die geprüfte Konfiguration
neu. Der aktive Routingmodus wird über einen internen Nginx-Endpunkt
bestätigt und bleibt bei einem Nginx-Neustart erhalten. [Nginx Reload](https://nginx.org/en/docs/switches.html)

## Live-Signale über Redis

`SESSION_STATUS_PUBSUB_ENABLED=true` aktiviert vier Redis-Kanäle für
Sessionstatus, Vote-Fortschritt, Joins und neue Q&A-Fragen. Join- und
Fragesignale werden pro App und Session in 50- beziehungsweise
150-ms-Fenstern gebündelt. Vote-Fortschritt hat ein gemeinsames Fenster
von rund 150 ms je Session. Jede App sammelt Commits 75 ms lang, bevor sie
versucht, das Fenster zu reservieren. Die App mit der Reservierung
veröffentlicht beim Freigeben ein Signal für alle Apps. Die Reservierung
läuft nach einer Sekunde ab. Die Signale enthalten die Kennung der
sendenden App und den Sessioncode oder die Session-ID. Das Vote-Rate-Limit
prüft und bucht das Ein-Sekunden-Budget je Teilnahme-ID mit einem atomaren
Aufruf anhand der Redis-Serverzeit.

Die empfangende App weckt ihre lokalen WebSocket-Abos. Beim Join verwirft
sie die betroffenen Caches und sendet die aktualisierte
Teilnahmezusammenfassung. Bei Q&A lädt sie die neue Ranking-Revision
und sendet eine Invalidierung. Der Host liest den Frageninhalt über
`qa.list` und die bestehende Berechtigungsprüfung. Bei Signalverlust
bleibt die periodische Abfrage aktiv.

### Lokaler Test von A nach B

Am 19. November 2026 gingen die Join- und Q&A-Anfragen in drei separaten
Sessions direkt an App A. Beide Host-WebSocket-Abos waren auf App B
geöffnet. Gemessen wurde ab Versand der Anfrage bis zum WebSocket-Update.

| Änderung auf A | WebSocket-Update auf B                                                                                  | Periodische Abfrage |
| -------------- | ------------------------------------------------------------------------------------------------------- | ------------------- |
| Join           | 68–92 ms. Die Teilnehmerzahl stieg von 0 auf 1 und der Neuzugang erschien in der Liste.                 | 1 s                 |
| Neue Q&A-Frage | 162–176 ms. Die Ranking-Revision stieg von 0 auf 1. Die Frage war danach über `qa.list` auf B abrufbar. | 2 s für Hosts       |

Der Test beobachtete die beiden Redis-Signale und bestätigte die
Zustellung vor der jeweils nächsten periodischen Abfrage.

### Subscriber-Ausfall und Reconnect auf B

In zwei lokalen Durchläufen trennte ein Testproxy ausschließlich den
Live-Pub/Sub-Subscriber von B und blockierte dessen Wiederanmeldung.
Die reguläre Redis-Verbindung und beide Host-WebSockets auf B blieben
offen. App A nahm in jeder Phase einen neuen Join und eine neue
Q&A-Frage an. Gemessen wurde ab Versand der Anfrage bis zum Update auf B.

| Änderung auf A | Polling während der Unterbrechung | Direkte Zustellung nach dem Reconnect |
| -------------- | --------------------------------- | ------------------------------------- |
| Join           | 998–1.003 ms                      | 76–79 ms                              |
| Neue Q&A-Frage | 1.985–1.990 ms                    | 170–171 ms                            |

Während der Unterbrechung veröffentlichte A beide Signale. Der Testproxy
lieferte sie an keinen Subscriber auf B aus. Nach Freigabe meldete B
alle vier Kanäle innerhalb von rund einer Sekunde automatisch wieder
an. Beide nächsten Signale gingen an B und aktualisierten dieselben
WebSockets. Die jeweils neue Frage war über `qa.list` auf B abrufbar.

## Yjs-Relay und Token-Rotation

Nginx leitet `/yjs-ws/<Raum>` fest an `yjs-relay:3002` weiter. Der
Relay-Port und seine Readiness bleiben im Compose-Netz. Nginx übernimmt
die WebSocket-Upgrade-Header. Access- und Fehlerlogs sind für diesen
Pfad abgeschaltet, weil der Upgrade-Querystring einen Share-Token
enthält. [Nginx WebSocket Proxying](https://nginx.org/en/docs/http/websocket.html)

Die Apps erstellen und rotieren Links über tRPC. Alle drei Prozesse
verwenden denselben Yjs-HMAC-Schlüssel. `STAGING_YJS_SHARE_TOKEN_SECRET`
kann den separaten Schlüssel setzen. Ohne ihn gilt die bisherige Ableitung
aus `STAGING_JWT_SECRET`. Den verwendeten Schlüssel bei einem
Staging-Restart beibehalten.

Die App wartet nach der dauerhaften Speicherung der neuen Generation auf
die Bestätigung des Relays. Dieser beendet zuerst offene Sockets der alten
Generation. Bei fehlender Bestätigung antwortet die App mit 503. Der
nächste Rotationsversuch kann die ausstehende Generation bestätigen.
Bei Verlust des Redis-Abos schließt der Relay bestehende Verbindungen und
akzeptiert neue Upgrades nach erneuter Anmeldung und Tokenprüfung.
[Redis Pub/Sub](https://redis.io/docs/latest/manual/pubsub/) ·
[Redis WAITAOF](https://redis.io/docs/latest/commands/waitaof/)

Für den lokalen Test zwei Clients mit demselben Share öffnen, eine Änderung
in beide Richtungen prüfen und über die zweite App rotieren. Alte Sockets
müssen schließen und alte Tokens beim Upgrade abgewiesen werden. Mit dem
neuen Token erneut verbinden. Dann den Relay separat stoppen, in beiden
Clients offline ändern und den Relay wieder starten:

```bash
docker compose -p arsnova-staging --env-file .env.staging \
  -f docker-compose.staging.yml stop yjs-relay
# Offline-Änderungen durchführen
docker compose -p arsnova-staging --env-file .env.staging \
  -f docker-compose.staging.yml start yjs-relay
```

Die Clients bauen den Raum aus ihren lokalen Yjs-Dokumenten wieder auf.
Der Relay hält die Quiz-Inhalte im Arbeitsspeicher. Redis speichert
Share-Metadaten und Generationen. Nach dem Reconnect müssen die
Offline-Änderungen bei beiden Clients erscheinen. Die Zielhost-Abnahme steht im
[Mehrinstanz-Plan](MULTI-INSTANCE-PLAN.md).

## Gemeinsamer PDF-Export-Slot

Beide Apps verwenden `PDF_SHARED_LIMIT_ENABLED=true` und denselben isolierten
`pdf-worker`. Der Worker hat keinen Netzwerkzugang. Beide Apps erreichen
ihn über ein gemeinsam eingebundenes Unix-Socket-Volume. Nginx lässt bis zu
150 Sekunden pro Leseintervall für HTTP-Antworten zu.

Ein Export aus der Host-Ansicht oder dem Quiz-Verlauf belegt den einzigen
Redis-Slot. Eine zweite Anfrage erhält HTTP 429
(`TOO_MANY_REQUESTS`). Der Worker erlaubt zugleich nur einen Renderjob.
Bei Redis-Ausfall während der Zulassungsprüfung erhält der Export HTTP 503.
Nach einem bestätigten Ende steht der Slot wieder zur Verfügung. Nach einem
App-Abbruch oder einem Abbruch am Worker-Socket kann die Reservierung noch
bis zu 90 Sekunden anstehen. Der Rollback auf App A verwendet weiterhin
denselben Worker und Redis-Slot. [PDF-Konfiguration](../ENVIRONMENT.md#pdf-parallelitätslimit)

### Lokaler Lasttest mit 500 Stimmen

Am 19. November 2026 lief in Docker Desktop (12 CPUs, 7,65 GiB VM-RAM) ein Export einer beendeten
Quiz-Session mit 72 Fragen. Parallel gingen 500 Stimmen einer separaten
Live-Session über Nginx ein. Die Last wurde innerhalb von 11 ms ausgelöst.
Die Exportanfragen wurden zum eindeutigen Nachweis direkt an die jeweilige
App im Compose-Netz adressiert. Nginx verteilte die 500 Stimmen mit 251 und
249 Anfragen auf die Apps. Je ein Host-WebSocket war mit A und B verbunden.

| Messpunkt                              | Ergebnis                                                   |
| -------------------------------------- | ---------------------------------------------------------- |
| Export auf A                           | HTTP 200 in 4,52 s, PDF mit 122 Seiten                     |
| Export auf B während des Renderings    | HTTP 429 (`TOO_MANY_REQUESTS`) in 57 ms, Redis-Slot belegt |
| Stimmen während des Renderings         | 500 von 500 bestätigt, p95 1.237 ms, p99 1.244 ms          |
| 500 Stimmen bei beiden Host-WebSockets | 10 ms beziehungsweise 72 ms nach der letzten Vote-Antwort  |
| Erneuter Export auf B nach Abschluss   | HTTP 200, 122 Seiten, Redis-Slot anschließend frei         |

Ein Wiederholungslauf bei gleichzeitig laufenden lokalen Repo-Tests und
Lint-Checks bestätigte 500 von 500 Stimmen, HTTP 429 auf B während des
Renderings und einen erfolgreichen PDF-Download über Nginx. In diesem Lauf
lag der Vote-p95 bei 5,28 s. Die Abnahme auf dem Zielhost erfolgt separat.

## Gemeinsamer spaCy-Sidecar und LLM-Slot

App A und B verbinden sich mit `/run/spacy/nlp.sock` über dasselbe
schreibgeschützt eingebundene Volume. Der Sidecar läuft ohne Netzwerk und
hat ein Budget von einer CPU und 1 GiB RAM. Für beide Apps zusammen nimmt
er höchstens zwei laufende Normalisierungsanfragen an. Der Rollback auf A
verwendet denselben Sidecar weiter. [spaCy-Betrieb](../features/word-cloud-spacy.md#betrieb)

Für LLM-Tests `STAGING_LLM_ENABLED=true` setzen und in `STAGING_LLM_URL`
denselben privaten Inferenzendpunkt für beide Apps angeben.
`STAGING_LLM_TOKEN` muss dem separaten Runtime-Credential entsprechen.
Für den Summary-Test zusätzlich `STAGING_QA_SUMMARY_ENABLED=true` setzen.
Der Inferenzdienst läuft separat und ist optional für den Start der Apps.
Bei einem Konfigurationswechsel wie unten beschrieben erst `down`, dann
`up` ausführen. [LLM-Topologie](../features/open-weight-llm-runtime.md#topologien)

Beide Apps verwenden für alle Auftragsarten einen gemeinsamen Redis-Slot
(`llm:inference:lease:v1`). Nach der Adressauflösung reserviert die App
ihn mit kurzer TTL für die Anfrage an `/slots`. Das Zeitbudget für
Adressauflösung, Reservierung und Sonde beträgt 2,5 Sekunden. Erst vor
dem POST verlängert die App die Reservierung und prüft dabei den Besitzer. Ist der Slot belegt, nutzen
Themenlabel und Zusammenfassung ihren fachlichen Fallback. Die
Lernzielableitung meldet `busy` und erlaubt einen manuellen
Wiederholungsversuch. Bei einem Redis-Fehler bleibt die Inferenzanfrage aus.
Nach einer vollständigen Antwort gibt die App die Reservierung frei.
Nach einem unterbrochenen POST sendet sie ein Abbruchsignal mit dessen
Auftrags-ID. Bei Bestätigung gibt sie die Reservierung frei. Ältere Images
und unbestätigte Signale verwenden die bisherige Slot-Prüfung. Zeigt der Slot
eine neuere Aufgaben-ID, bestätigt er damit die Übernahme des früheren POST.
Bei unklarem Ausgang gilt eine Frist von 1,5 Sekunden ab der Unterbrechung.
Der nächste Auftrag prüft, ob der Modellslot frei ist. Bei einem Prozessausfall
oder fehlgeschlagener Freigabe läuft die Reservierung spätestens 315 Sekunden
nach der letzten erfolgreichen Reservierung oder Besitzerprüfung ab.
[LLM-Laufzeitvertrag](../features/open-weight-llm-runtime.md#laufzeitvertrag)

### Lokaler Test mit zwei konkurrierenden Aufträgen

Am 19. November 2026 haben beide Apps über denselben Socket-Inode
`LEMMA` mit `de_core_news_sm@3.8.0` angewandt. Der LLM-Test verwendete das
geprüfte Qwen3-4B-Modell und llama.cpp b10524. Zwei Q&A-Aufträge wurden per
tRPC gezielt an A und B adressiert. Für die Ergebnisabfrage blieb jede
Session auf der App, die ihren Auftrag gestartet hatte. Der Summary-Status
lag zu diesem Zeitpunkt im App-Prozess.

- A hielt den Redis-Slot. Ein Messproxy verzögerte die bereits erfolgreiche
  Slot-Sonde zwischen der Runtime und A. Die Modell-Runtime war noch frei.
- B lieferte nach 225 ms einen extraktiven Fallback mit Ursache `busy`.
  Der Proxy sah von B weder eine Slot-Sonde noch einen Inferenz-POST.
- Nach Freigabe am Proxy erreichte genau ein POST von A die Runtime. A
  lieferte eine Full-Context-Zusammenfassung und gab den Redis-Slot frei.
  Anschließend war der Wiederholungsversuch auf B ebenfalls erfolgreich.

### Lokaler Test mit Lernzielen und Themenlabels

Am 19. November 2026 lief `quiz.deriveLearningObjectives` über App A und
`wordCloud.analyzeQa` über App B. Der lokale Encoder auf B bildete mit
multilingual E5 Small zwei semantische Cluster. Ein Messproxy hielt
den ersten autorisierten POST vor der Weiterleitung an llama.cpp b10524
mit Qwen3-4B. So war der Redis-Slot belegt und der Modellserver noch frei,
als die zweite Anfrage startete.

| Reihenfolge                      | Ergebnis des ersten Auftrags | Ergebnis des zweiten Auftrags         | Inferenz-POSTs |
| -------------------------------- | ---------------------------- | ------------------------------------- | -------------- |
| A Lernziele, dann B Themenlabels | Zwei Lernzielentwürfe        | Zwei extraktive Themenlabels in 70 ms | 1              |
| B Themenlabels, dann A Lernziele | Zwei generative Themenlabels | `busy` mit `retry: manual` in 12 ms   | 1              |

Redis gab den Slot nach beiden Antworten wieder frei. Der vorangehende
Versuch über `session.deriveLearningObjectives` erreichte die Inferenz
und endete beim anschließenden Speichern mit HTTP 500. Prisma wies
`objectiveRowId` im verschachtelten `references.create` zurück.

#### Wiederholung mit korrigierter Session-Route

Nach der Prisma-Korrektur lief `session.deriveLearningObjectives` auf
App A gegen `wordCloud.analyzeQa` auf App B mit demselben lokalen Qwen3-4B
und E5-Encoder. Pro Konkurrenzlauf erreichte genau ein POST die Inferenz.

| Reihenfolge                      | Ergebnis                                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Lernziele, dann B Themenlabels | A speicherte zwei Entwürfe. B lieferte zwei extraktive Themenlabels in 135 ms.                                                                       |
| B Themenlabels, dann A Lernziele | B lieferte zwei generative Themenlabels. A meldete nach 15 ms `busy` mit `retry: manual`. In PostgreSQL lagen für diese Session noch keine Entwürfe. |

Der anschließende manuelle Wiederholungsversuch auf A speicherte ebenfalls
zwei Entwürfe. In beiden Sessions bestätigte PostgreSQL je zwei
`MODEL_DERIVED`-Zeilen im Status `DRAFT` und je vier Aufgaben- und
Herleitungsreferenzen. Die Lernzielrevision stieg jeweils von 0 auf 1.
Frische tRPC-Abrufe auf A und B lieferten denselben gespeicherten Stand.
Das manuelle Anlegen und Aktualisieren einer Aufgabenreferenz wurde
ebenfalls über die Session-API geprüft.

## Gemeinsamer Q&A-Ergebnisstatus

Beide Apps lesen und schreiben den Summary-Status in `qa-summary-redis`.
Dieser Redis bleibt im Compose-Netz, nutzt ein tmpfs und hat weder AOF
noch RDB aktiviert. Das 64-MiB-Datenbudget und TTLs begrenzen seinen
Speicherverbrauch. Der Redis für Sessiondaten und den LLM-Slot läuft
separat. [Redis-Persistenz](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)

Der annehmende App-Prozess führt den Auftrag aus. Weitere Anfragen
derselben Session sehen den laufenden Status, solange die Reservierung
gilt. Wartende Aufträge erhalten eine TTL entsprechend der Queue-Tiefe.
Beim Start wird sie auf das Auftrags-Timeout plus 30 Sekunden gesetzt.
Nach Abschluss gilt `QA_SUMMARY_TTL_MS` mit standardmäßig 30 Minuten.
Bei einem App-Abbruch bleibt `pending` bis zum Ablauf sichtbar. Ein
Neustart des dedizierten Redis leert den Status.

`qa.summaryRuntime` bleibt hostgeschützt. Fertige Ergebnisse werden vor
der Auslieferung mit den aktuellen Quellen abgeglichen. Bei Ausfall des
Summary-Redis meldet der Abruf vorübergehend `SERVICE_UNAVAILABLE`.

### Lokaler Abruf von A über B

Am 19. November 2026 wurde der tRPC-Auftrag auf App A gestartet und die
Inferenz erst nach dem ersten Abruf auf B freigegeben. App B lieferte
`pending` in 10 ms. Ein zweiter Startversuch auf B lieferte denselben
Status. Danach lief genau eine Qwen3-4B-Inferenz. Beide Apps lieferten
dasselbe `ready`-Ergebnis mit zwei Aussagen und zwei Quellen. Das fertige
Ergebnis hatte eine TTL von 30 Minuten.

Ein Abruf auf B ohne Host-Token wurde abgewiesen. Nach Entfernen einer
Frage lasen beide Apps den aktualisierten Fallback `source_changed`.
Eine anschließende Schwärzung über B entfernte das Ergebnis auf beiden
Apps. Im Test waren AOF und RDB für den Summary-Redis deaktiviert.

## Rückkehr auf App A

```bash
./scripts/staging-compose.sh rollback
./scripts/staging-compose.sh status
```

`rollback` prüft A, schaltet die HTTP- und WebSocket-Pools auf A, bestätigt
den Nginx-Reload und wartet die Drain-Frist der alten Worker ab. Bestehende
Verbindungen können dabei einen WebSocket-Reconnect benötigen. Erst danach
stoppt der Befehl B. Bei fehlender Readiness von A bleibt das aktive
Routing unverändert. Die Volumes bleiben bestehen. `up` startet B beim
Wiedereinstieg und nimmt es nach den Readiness-Checks erneut in beide Pools
auf. Die Rückkehr von B verwendet die auf der laufenden Umgebung
bereits angewendeten Migrationen.

`down` beendet das Projekt und erhält die Daten-Volumes. Für Änderungen am
Image oder an der Staging-Umgebung zuerst `down` und danach `up` mit der
gewünschten Konfiguration ausführen. Ein Wechsel auf ein älteres App-Image
setzt kompatible, bereits angewendete Datenbankmigrationen voraus.
