<!-- markdownlint-disable MD013 -->

# Wortwolke: semantischer Themenmodus für Q&A und Freitext (Stories 1.14c/1.14d)

**Zielgruppe:** Product Owner, Entwickler, Betrieb, Lehre
**Stand:** 2026-10-04
**Status:** Q&A- und Freitext-Encoderpfad im Repo (Clustering, extraktive Labels); zusätzlich minimierter interner Latest-Q&A-Themenbeleg für #456 Slice 2; Kill-Switch produktiv default aus; kein LLM
**Backlog:** Story 1.14c (Q&A-Themen), Story 1.14d (Freitext-Themen, implementiert; keine Produktivfreigabe)
**Glättung bleibt getrennt:** Story 1.14b / [word-cloud-spacy.md](word-cloud-spacy.md)
**Zielbild:** [WORD-CLOUD-3.0-STORY-VORSCHLAG.md](../implementation/WORD-CLOUD-3.0-STORY-VORSCHLAG.md)
**Voranalyse:** [WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md](../implementation/WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md)
**ADR (Stufe-2-LLM-Runtime):** [0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md](../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md)

## Zweck

Der Host sieht in der Q&A- und Freitext-Wortwolke orthogonal zur Gewichtung (`Stimmen` / `Beste Fragen` / `Kontroverse` / `Häufigkeit`) den dritten Analysemodus **Themen**. Sinngleiche Fragen, Antworten und Paraphrasen werden ein erklärbares Thema mit Mitgliedsliste, Konfidenz und Modellversion.

Mitgliedschaft entsteht durch Embeddings plus deterministisches Clustering. Stufe 1 verbalisiert Cluster **ohne LLM** (zentraler Mitgliedstext). Eine Variante ohne Encoder bleibt Fallback und Ausfallbaseline: die lexikalische Wolke 2.x.

Kein Encoder-Code im Browser. Teilnehmer-DTOs enthalten keine Cluster-Felder. Live-Hotpaths (`qa.submit`, Join, Vote, WebSocket) warten nie auf Inferenz.

## UI-Begriffe

Das Host-Label ist **Themen**. Intern heißt die Variante `SEMANTIC`. Nicht in der Host-UI: `Semantische Themen`, `Encoder`, `e5`, `Embedding`, `Clustering`.

| Zustand         | Host-Text                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| Läuft           | **Themen werden vorbereitet.** plus unbestimmte Fortschrittsleiste; darunter **Es gelten Wörter und Phrasen.** |
| Veraltet        | **Neue Fragen seit der letzten Themenanalyse** plus **Themen aktualisieren**                                   |
| Unsicher        | **Einige Themen sind unsicher. Prüfe die Mitgliedsfragen.**                                                    |
| Fehlgeschlagen  | **Themenanalyse fehlgeschlagen. Es gelten Wörter und Phrasen.**                                                |
| Nicht belastbar | **Themen sind gerade nicht belastbar. Es gelten Wörter und Phrasen.**                                          |
| Nicht verfügbar | **Themen sind noch nicht verfügbar. Es gelten Wörter und Phrasen.**                                            |

`THEME` bleibt **Wörter & Phrasen** (lexikalisch 2.x) und wird nicht auf `SEMANTIC` umgebogen. Der Q&A-Presenter analysiert nicht selbst, sondern projiziert den aktuellen Host-Snapshot (`session.setQaWordCloudProjection` / `session.getQaWordCloudProjection`) und zeigt Variante, Metrik und Glättung als Pills. Story **1.14d** führt Host-Freitext bei `de`/`en` durch denselben Encoderpfad wie Q&A; `fr`/`es` antworten kontrolliert mit 2.x (`status: fallback`). Bei italienischer UI bleibt die bestehende lokale 2.x-Wolke aktiv, bis der Host eine unterstützte Analysesprache wählt; es wird kein Encoderauftrag gesendet. Presenter-Freitext bleibt außerhalb des Umfangs.

Texte sind in `de`, `en`, `fr`, `es` und `it` gepflegt.

## Host-Verhalten

Nur der Host löst `wordCloud.analyze` aus (`hostProcedure`). Es gibt keine automatische Runde bei jeder neuen Frage, Abstimmung oder Tastendruck.

| Kanal     | Encoder-Clustering                                                                                                    | Ohne Kill-Switch / tot / Timeout            |
| --------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Q&A       | `PINNED`/`ACTIVE`, Locale `de`/`en`, Kanal `QA`                                                                       | 2.x-Phrasen, keine leere Karte              |
| Freitext  | sichtbare Antworten der aktuellen Host-Frage, Locale `de`/`en`, Kanal `FREETEXT`; Mindestclustergröße 2               | 2.x wie Stufe 0                             |
| Presenter | keine eigene Analyse; Q&A übernimmt den Host-Snapshot, Presenter-Freitext bleibt ohne eigenen semantischen Analysejob | Host-Projektion oder lexikalischer Fallback |

- **Neue Fragen oder Antworten:** vorhandenes Ergebnis bleibt sichtbar, Status **veraltet**, Button **Neu analysieren**. Keine Dauerschleife. Schlägt die Neuanalyse fehl, bleiben veraltete Cluster und der Retry-Hinweis stehen. Nach einem `ready`-Lauf bleibt **Neu analysieren** bedienbar und umgeht den Snapshot-Cache (`refresh`), damit derselbe Locale-Snapshot ohne Sprachwechsel neu gerechnet wird.
- **Sort- oder Locale-Wechsel** im Themenmodus ist eine Host-Aktion und startet eine neue Analyse desselben Kanal-Snapshots. Locale steckt im Snapshot-Hash: `de` und `en` sind getrennte Caches. Deutsche Q&A bleibt auf **DE**; EN startet keine bessere Analyse, nur einen zweiten Lauf.
- **`SEMANTIC + LEMMA`** ist `MODE_UNSUPPORTED`. Der Glättungsknopf bleibt in **Themen** ausgeblendet und wechselt nicht still auf `LEXICAL` (wie Freitext). Solange Themen vorbereitet werden oder der 2.x-Phrasen-Fallback gilt, bleibt eine zuvor aktive Glättung auf der sichtbaren Wörter-&-Phrasen-Wolke wirksam.
- Während `pending` bleibt das vorherige Cluster-Ergebnis sichtbar, sofern vorhanden; sonst 2.x-Phrasen **mit derselben Glättung wie unter Wörter & Phrasen**, falls die Glättung an ist. Host und Q&A-Dialog zeigen denselben Fortschritt (Text plus unbestimmte Leiste, kein Prozentwert). Die Anzeige bleibt mindestens 1 s sichtbar, damit Cache- oder Fallback-Antworten nicht nur aufblitzen; das Cluster-Ergebnis wechselt erst danach. Läuft die Analyse nach 2 s noch, kommt ein grober Zeit-Hinweis: **Das kann einen Moment dauern.**, ab etwa 100 sichtbaren Fragen bzw. Antworten **Bei vielen Fragen/Antworten kann das eine Minute dauern.** Keine exakten Anzahlen oder Obergrenzen.
- Ohne Cluster mit mindestens zwei Mitgliedern (eine einzelne Frage oder Antwort, nur Singletons) ist der Status `fallback`, nicht `uncertain`. Der Encoder läuft erst ab zwei Quellen. `uncertain` gilt nur, wenn Themenblasen da sind, aber die Konfidenz unter der Host-Stufe **sicher** liegt.

Tooltip, Fokus-/Textalternative und CSV zeigen Label, Gewichtung, Metrik, Mitgliedsfragen beziehungsweise -antworten, Konfidenz und bei Encoder-Treffer die Modellversion.

## Pipeline

```text
Host-Snapshot (Q&A: PINNED/ACTIVE; Freitext: aktuelle sichtbare Antworten; Gewichtung, Locale, Kanal)
  → Hash (Analyseversion 1.14d.1 + Kanal)
  → Cache (nur ready/uncertain)
  → privater Encoder (e5-small, nur Embeddings)
  → agglomeratives Clustering im Backend (Complete-Linkage, Kosinus ≥ 0,87)
  → extraktives Label (Mitglied nächst am Zentroid, sonst kürzester Text)
  → Zod AnalyzeWordCloud*
```

Der Sidecar liefert ausschließlich Vektoren. Clustering und Labels laufen in TypeScript im App-Backend, nicht im Browser und nicht in spaCy. Der Encodertransport lässt global höchstens einen Sidecar-Call gleichzeitig zu (`MAX_IN_FLIGHT=1`). Die vorgeschaltete Orchestrierung hält **pro Session** höchstens einen aktiven Job und genau den neuesten abweichenden Folgesnapshot (`active + latest`). Gleiche Snapshot-Hashes teilen das Promise des aktiven beziehungsweise wartenden Jobs. Der neueste verschiedene Snapshot wartet auf den Abschluss des aktiven Jobs; er erhält nicht sofort eine künstliche `pending`-Antwort. Kommt vorher noch ein neuerer verschiedener Snapshot, wird nur der wartende Slot ersetzt: Die verdrängten Aufrufer erhalten sofort den lexikalischen, nicht cachebaren `fallback`, während der neue `latest`-Aufruf wartet. Nach Erfolg oder Fehler des aktiven Jobs startet der verbliebene Ersatzjob serialisiert. `pending` ist dabei der Frontend-Fortschrittszustand während des wartenden Requests, kein zweiter parallel laufender Encoderjob.

### Interner Latest-Q&A-Themenbeleg für #456 Slice 2

Ein frisch berechneter Q&A-Lauf aktualisiert neben dem normalen Anzeige-Cache genau dann einen getrennten internen Latest-Beleg, wenn Anfrage und Ergebnis `SEMANTIC`, `ALL_ELIGIBLE`, `ready` oder `uncertain`, kein Fallback und eine vollständig aufgeführte Mitgliedschaft ausweisen. `PINNED_ONLY`, lexikalische Ergebnisse, Fehler, Fallbacks und vom Presenter kompakt gekürzte Mitgliedslisten werden nicht als ungekürzter Themenbeleg gespeichert. Der bestehende Host-Response und seine Kompaktierung bleiben davon unverändert.

Der Wert ist über die unveränderliche, serverseitig ermittelte Session-ID gebunden und enthält keine Fragen- oder Labeltexte. Gespeichert werden Status, Metrik, Korpus- und Analyserevision, Analysezeit, Modellkennung/-version, Korpusgrößen sowie je Thema eine stabile Kennung, Konfidenz, Labelquellen-ID und die vollständige Menge `{ questionId, textDigest }`. Der Moderationskontext lädt aktuelle Texte später erneut aus PostgreSQL, prüft Sessionzugehörigkeit, sichtbaren Status und Digest und bildet das extraktive Label aus der aktuellen Labelquelle. Damit kann ein veralteter Cachewert weder alten Fragetext noch ein altes Label offenlegen.

Der Latest-Beleg verwendet denselben Redis-v2-Sessionnamespace, dieselbe Encoder-Cache-TTL, denselben begrenzten Index, dieselbe Purge-Fence und denselben atomaren indizierten Schreibpfad wie die anderen Analysesnapshots. Er wird daher durch Retention oder explizite Sessionlöschung gemeinsam entfernt und kann hinter einer gesetzten Fence nicht neu geschrieben werden. Lesen und Projizieren startet keinen Encoder-, NLP- oder LLM-Job. Bei deaktiviertem Semantikmodul, fehlendem Beleg, abweichender Revision oder nicht mehr vollständig validierbarer Mitgliedschaft degradiert der Moderationskontext ausdrücklich zu `disabled`, `no-data`, `stale` beziehungsweise einer Redaktionsbegrenzung. Der Wert ist kein neuer tRPC-Pfad und wird nicht an Presenter oder Teilnehmende ausgeliefert.

Ein Session-Purge erhöht die Queue-Epoche und invalidiert aktive wie wartende Arbeit. Der wartende Aufruf fällt sofort lexikalisch zurück; ein bereits laufender Sidecar-Call darf technisch auslaufen, sein Ergebnis wird nach der Rückkehr jedoch ebenfalls durch einen nicht cachebaren Fallback ersetzt. Ein danach angeforderter Ersatzsnapshot läuft erst serialisiert nach dem alten Call. Redis-Snapshots liegen im v2-Namespace unter der unveränderlichen, serverseitig aus PostgreSQL geladenen Session-ID. Ein begrenzter Session-Index (maximal 2.048 Einträge) und eine 24 Stunden gültige Purge-Fence teilen denselben Redis-Hash-Slot. Der Lua-Write prüft die Fence, indiziert zuerst und schreibt Mitgliedstexte zuletzt. Der Purge setzt die Fence, validiert den zuvor gelesenen Index gegen einen möglichen Write-Race und entfernt Index plus Snapshot-Schlüssel atomar; bei einer Indexänderung wiederholt er den nun durch die Fence stabilen Versuch einmal. In Produktion liest die Durability-Barriere vor diesem Write-Segment sowohl den Redis-Server-`run_id` aus `INFO server` als auch die verbindungsgebundene `CLIENT ID`, schreibt danach einen zufälligen, unsensiblen Fünf-Minuten-Marker, verlangt per `WAITAOF` mindestens einen lokalen AOF-Fsync und akzeptiert nur denselben Serverlauf und dieselbe Verbindung danach. Fehlender Fsync, Reconnect oder Redis-Neustart bricht den fachlichen Session-Delete für einen sichtbaren vollständigen Retry ab. Danach kann kein alter LEXICAL-, LEMMA- oder SEMANTIC-Aufruf mehr schreiben; deshalb bleibt der zweite Pass nach dem Datenbank-Delete idempotente Absicherung und braucht bei einem Fehler keinen dauerhaften Datenschutz-Retry. Ein wiederverwendeter sechsstelliger Code erhält eine neue Session-ID und damit einen unabhängigen Cache-Scope.

Vor v2 erzeugte, nicht indizierte `nlp:wc:snap:*`-Einträge werden nicht mehr gelesen. Vor dem ersten Purge teilt ein Prozess genau einen globalen Runtime-`SCAN`/`UNLINK`-Sweep, der ausschließlich diesen v1-Namespace erfasst. Davon getrennt betreibt der Produktionsvertrag genau einen fest benannten App-Container: Nach dessen Stop/Drain löscht das Deploy-Gate mit einem nachweislich kompatiblen Image bei jedem Rollout sowohl v1 als auch sämtliche `nlp:wc:snapshot:v2:*`-Werte, -Indizes, -Fences und alte Barrier-Schlüssel sowie den stillgelegten persistenten Textcache `nlp:wc:text:*`. Erst danach läuft Retention; anschließend wiederholt dasselbe Runner-Image den AOF-bestätigten Sweep, bevor ein Normal-Deploy seinen Ziel-Candidate unmittelbar vor App-Start persistiert. `scripts/docker-entrypoint.sh` wiederholt ihn ein drittes Mal vor `exec`. Der zweite Deploy-Pass schließt späte Writes des beim ersten Cutover noch pre-Gate laufenden Writers; neue Prozesse sperren Snapshot-Writes beim SIGTERM und drainen HTTP vor dem Redis-Shutdown.

Der bewusst kalte Analysecache gilt für Normaldeploy sowie für Rollback/Recover zwischen gate-kompatiblen Images. Pre-Gate-Ziele werden vor Git-Checkout, Writer-Stop und Retention absichtlich abgelehnt, damit kein alter v1-/Textcache-Writer neu startet. Scheitert das erste Cutover bei noch altem `current.state`, muss derselbe kompatible Candidate erneut normal ausgerollt oder durch ein kompatibles Forward-Fix-/Revert-Image ersetzt werden. Ein persistierter Candidate bleibt bis nach Drain, beiden Sweeps und Retention bindender Runner und wird erst direkt vor dem neuen App-Start ersetzt; nach erfolgreichem State-Commit wird er entfernt.

Die globalen Sweeps erfassen ihren Server-`run_id` und ihre `CLIENT ID` vor dem ersten `SCAN` und bestätigen alle `UNLINK`s mit einem zufälligen Marker unter `nlp:wc:purge-durability:v1:*`, `WAITAOF` sowie unverändertem Serverlauf und unveränderter Verbindung. Der Marker enthält keine Sessiondaten, verfällt nach fünf Minuten, liegt außerhalb beider Scan-Namespaces und überspringt nie einen Sweep. Ein Fehler verhindert Retention beziehungsweise App-Start; ein späterer Lauf scannt vollständig neu. Jeder Rollout-Sweep kostet `O(N + K)` für N besuchte Redis-Schlüssel und K entfernte Cache-Treffer; die konstanten Wiederholungen ändern die asymptotische Grenze nicht. Zusammen mit S indizierten Session-Purges bleibt sie `O(N + K + S)` statt früher `O(S×N)`. Bulk-Purges verarbeiten höchstens 25 Sessions parallel und verwenden pro Chunk eine gemeinsame Barriere; `Promise.allSettled` lässt den Chunk vor dem ersten gemeldeten Fehler vollständig auslaufen. Dieser globale Vertrag setzt den produktiven einzelnen Redis-7.4-Primary mit normalem ioredis-Client und ACL-Rechten für `CLIENT ID`, `INFO server`, `SET`, `WAITAOF`, `SCAN` und `UNLINK` voraus; Redis Cluster wird nicht unterstützt. Die sessiongebundenen Lua-Schlüssel teilen unabhängig davon `{sessionId}` als Hash-Slot.

Circuit Breaker: drei Encoder-Fehler öffnen 30 s; danach `failed` plus 2.x ohne neuen Call.

Snapshot an den Encoder: nur `{ id, text }` mit anonymen Quellschlüsseln. Q&A verwendet UUID-basierte Schlüssel; Freitext verwendet die stabilen `response-{index}`-Schlüssel des unveränderlichen Host-Snapshots. Der interne Encodertransport versieht beide mit demselben Prefix und bildet sie anschließend auf die ursprünglichen IDs zurück. Keine Tokens, IPs, Nicknames, Participant-IDs oder Session-Codes in den Item-Feldern. Extra-Felder lehnt der Sidecar ab.

## Betrieb

Der Encoder läuft als **optionaler Sidecar** hinter dem Backend, analog spaCy: Compose-Profil `encoder`, Unix-Socket, `network_mode: none`, kein öffentlicher Port. Alternativ internes HTTP analog 8.9c (`WORD_CLOUD_ENCODER_URL`), nur Loopback (`localhost`, `127.0.0.0/8`, `::1`) oder RFC1918/`fc00::/7`-Literale. Browser sprechen den Dienst nie an. Öffentliche DNS-Namen, öffentliche IPs und SaaS-Hosts sind blockiert. `deploy.sh` startet den Encoder nicht.

| Größe                 | Wert                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Kill-Switch           | `WORD_CLOUD_SEMANTIC_ENABLED` (nur exakt `true`; Default `false`)                                                    |
| Nicht wiederverwendet | `NLP_ENABLED`, `QA_NLP_ENABLED`, `QA_SUMMARY_ENABLED`, `QA_SUMMARY_INFERENCE_URL`                                    |
| Socket                | `WORD_CLOUD_ENCODER_SOCKET_PATH` (Default `/run/wordcloud-encoder/encoder.sock`)                                     |
| HTTP (optional)       | `WORD_CLOUD_ENCODER_URL` nur Loopback/RFC1918-Literale, Token `WORD_CLOUD_ENCODER_TOKEN` (nie in der URL)            |
| Timeout / Cache-TTL   | `WORD_CLOUD_ENCODER_TIMEOUT_MS` (Default 8000, Max 120000 für CPU-e5), `WORD_CLOUD_ENCODER_CACHE_TTL_SECONDS` (1800) |
| Image                 | `WORD_CLOUD_ENCODER_IMAGE` (getrennt von `ARSNOVA_IMAGE` und `SPACY_IMAGE`)                                          |
| Compose               | Profil `encoder`                                                                                                     |
| Limits                | 1 CPU / 2 GiB RAM / 64 PIDs, non-root, read-only, `network_mode: none`                                               |
| Modell                | `intfloat/multilingual-e5-small` (Apache-2.0), ONNX, Digest in `modelVersion`                                        |
| Analyseversion        | `1.14d.1`                                                                                                            |

Ohne Kill-Switch: `status: disabled`, `fallbackUsed: true`, 2.x-Phrasen; vorhandene SEMANTIC-Cache-Hits werden nicht ausgeliefert. Toter, überlasteter oder bis zum Timeout langsamer Encoder: `failed` plus 2.x. Während ein aktiver oder neuester wartender Request läuft, zeigt das Frontend `pending` über der weiterhin sichtbaren lexikalischen Wolke. Backend-Aufträge in `fr`/`es`: `fallback` plus lexikalische Wolke; unter italienischer UI bleibt die Analyse lokal, solange keine unterstützte Wolkensprache gewählt ist, und sendet keinen Backendauftrag.

Env-Referenz: [ENVIRONMENT.md](../ENVIRONMENT.md). Härtung: [SECURITY-OVERVIEW.md](../SECURITY-OVERVIEW.md). Deployment: [deployment-debian-root-server.md](../deployment-debian-root-server.md). Lizenzen: [NOTICE](../../NOTICE), [docker/wordcloud-encoder/NOTICE](../../docker/wordcloud-encoder/NOTICE).

### Lokal (Docker-App)

```bash
npm run docker:up:encoder
```

Im App-Container `WORD_CLOUD_SEMANTIC_ENABLED=true` und Socket `/run/wordcloud-encoder/encoder.sock`. Der Volume-Socket ist für Host-Node auf macOS unsichtbar.

### Lokal (Host-npm / macOS)

Compose-Profil `encoder` bleibt `network_mode: none` (Unix-Socket, für Host-Node unsichtbar). Lokal das gebaute Image per Loopback-HTTP:

```bash
docker build -t arsnova-wordcloud-encoder:e5-small docker/wordcloud-encoder
docker run --rm --name arsnova-wordcloud-encoder-local \
  -e WORD_CLOUD_ENCODER_HTTP_BIND=0.0.0.0:8790 \
  -e WORD_CLOUD_ENCODER_MODEL_DIR=/models/e5-small \
  -p 127.0.0.1:8790:8790 \
  arsnova-wordcloud-encoder:e5-small
```

```env
WORD_CLOUD_SEMANTIC_ENABLED=true
WORD_CLOUD_ENCODER_URL=http://127.0.0.1:8790/embed
WORD_CLOUD_ENCODER_TIMEOUT_MS=120000
```

Produktion setzt den HTTP-Bind nicht. `WORD_CLOUD_ENCODER_ALLOW_STUB=true` ist nur für Unittests ohne ONNX-Gewichte, nicht für die Themenprüfung.

Lokale Q&A-Paraphrasen (Klausur/Regression/Folien/Beamer plus längere Fragen für Stufe-2-Labels): `npm run seed:qa-forum -w @arsnova/backend -- --code ABC123 --corpus semantic`.

## Vertrag

Shared-Zod: `AnalyzeWordCloud*` in `libs/shared-types/src/schemas.ts`, Konstanten in `libs/shared-types/src/word-cloud-semantic.ts`. Cluster-Status liegen auf diesem Vertrag, nicht auf `QaSummaryStatusEnum` / 8.9c.

Status: `pending` | `ready` | `uncertain` | `stale` | `disabled` | `failed` | `fallback`.

`stale` setzt das Frontend, wenn sich der Host-Snapshot nach einem `ready`-Ergebnis ändert. Cache speichert SEMANTIC nur bei `ready`/`uncertain` und mit `WORD_CLOUD_ENCODER_CACHE_TTL_SECONDS`. Bei Kill-Switch aus werden Hits nicht ausgeliefert.

8.9c bleibt unabhängig: anderer Kill-Switch, anderer Snapshot (inkl. `PENDING`), anderer Auftrag. Cluster-Labels sind keine Summary-Bullets.

## Qualität

CI-Fixtures (geometrische Einheitsvektoren, kein Modell-Download): die drei Klausur-Paraphrasen zu Kapitel 4 fallen zusammen; Folien vs. Beamer-Hänger nicht. Dasselbe Seed auf Englisch (exam / slides / projector). Die Freitext-Fixtures prüfen je Sprache drei getrennte Familien — Stimmungssätze, Einwortsynonyme und lange TCP-Fachsätze — sowie fachfremde Gegenbeispiele. Echtes e5 läuft nur im gebauten Image.

e5-small liegt bei deutschsprachigen Vorlesungsfragen oft schon bei Kosinus ~0,80 zwischen verschiedenen Themen; identische Satzrahmen („Kurze Nachfrage“, „Kann das jemand einordnen“) ziehen fremde Familien auf ~0,84–0,89. Average-Linkage bei 0,80 verkettet daraus ein Mega-Thema. Complete-Linkage bei 0,87 hält Paraphrasen zusammen und die Familien getrennt. Die Host-Stufe **sicher** (≥ 0,85) bleibt davon unabhängig; engere Cluster liegen typisch darüber.

## Tests

| Check                                                       | Befehl / Ort                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vertrag                                                     | `npm run test -w @arsnova/shared-types -- src/word-cloud-semantic.test.ts`                                                                                                                                                                    |
| Clustering, Encoder-Client, `active + latest`, Purge, Cache | `npm run test -w @arsnova/backend -- --run src/lib/wordCloudSemantic*.test.ts src/lib/qaSemanticTopicSnapshot.test.ts src/lib/wordCloudEncoderClient.test.ts src/lib/wordCloudAnalysisCache.test.ts src/lib/sessionPurgeInvalidation.test.ts` |
| Atomare Fence + AOF-Durabilität mit echtem Redis 7          | `RUN_REDIS_WORD_CLOUD_CACHE_TESTS=1 WORD_CLOUD_PURGE_REQUIRE_DURABILITY=1 npm run test -w @arsnova/backend -- --run src/lib/wordCloudAnalysisCache.redis.test.ts`                                                                             |
| Hotpath-Isolation                                           | `npm run test -w @arsnova/backend -- --run src/__tests__/wordCloud.hotpath-isolation.test.ts`                                                                                                                                                 |
| Host-Toggle, stale, Neu analysieren, CSV                    | `npm run test -w @arsnova/frontend -- src/app/features/session/session-host/session-host.component.spec.ts src/app/features/session/session-present/word-cloud.component.spec.ts`                                                             |
| Sidecar ohne Modell-Download                                | `npm run test:wordcloud-encoder`                                                                                                                                                                                                              |
| Compose-Profil, kein TCP, cgroup                            | `npm run test:wordcloud-encoder-compose`                                                                                                                                                                                                      |

Siehe [TESTING.md](../TESTING.md).

## Story 1.14d (Host-Freitext-Themen)

Im Repo implementiert. Derselbe Encoder, dieselbe Complete-Linkage-Schwelle 0,87, dieselbe Mindestclustergröße 2 und derselbe Kill-Switch verarbeiten den getrennten Snapshot der sichtbaren Freitextantworten der aktuellen Frage. Die frühere Sperre für `channel: 'FREETEXT'` beziehungsweise `response-{index}` ist entfernt. `de`/`en` clustern bei aktivem Encoder; `fr`/`es`, einzelne Antworten, reine Singletons, Timeout und Fehler fallen im Backend lexikalisch zurück. Italienisch bleibt bereits vor dem Backendauftrag auf der lokalen 2.x-Wolke, solange keine unterstützte Analysesprache gewählt ist. Live-Submit, Vote, Join und WebSocket bleiben frei von Inferenz. Das Produktivflag bleibt bis zur gesonderten Betriebs- und Qualitätsfreigabe aus. Presenter-Freitext und LLM-Labels bleiben Nicht-Ziele. Zuschnitt: [Backlog.md](../../Backlog.md) Story 1.14d.

## Nicht-Ziele (bewusst außerhalb von Stufe 1)

LLM-Labels (Stufe 2), 8.9c Slice 4, 8.9b-Transformer, Presenter-Freitext-Themen, SaaS-Fallback, Angular-Initial-Bundle-`maximumError` anheben, Produktivaktivierung.

Stufe 2 bleibt offen hinter Story 8.9d / [ADR-0035](../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md): das LLM darf nur das Label ersetzen. Clustering bleibt Stufe 1; LLM-Ausfall fällt auf das extraktive Label, nicht auf lexikalisch 2.x. `OPEN_WEIGHT_LLM_ENABLED` aus lässt `WORD_CLOUD_SEMANTIC_ENABLED` unberührt.

## Verträge und Code

- Shared: `libs/shared-types/src/word-cloud-semantic.ts`, `AnalyzeWordCloud*` in `libs/shared-types/src/schemas.ts`
- Backend: `wordCloud.ts`, `wordCloudSemanticAnalyze.ts`, `wordCloudSemanticCluster.ts`, `wordCloudEncoderClient.ts`, `wordCloudSemanticConfig.ts`
- Sidecar: `docker/wordcloud-encoder/`
- Frontend: Host-Steuerung in `session-host.component.ts`; Q&A-Dialog `qa-word-cloud-dialog.component.*`; Renderer `word-cloud.component.ts`
