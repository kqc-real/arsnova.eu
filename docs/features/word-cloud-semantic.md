<!-- markdownlint-disable MD013 -->

# Wortwolke: semantischer Q&A-Themenmodus (Story 1.14c Stufe 1)

**Zielgruppe:** Product Owner, Entwickler, Betrieb, Lehre
**Stand:** 2026-08-22
**Status:** Stufe 1 im Repo (Encoder + Clustering, extraktive Labels); Kill-Switch produktiv default aus; kein LLM
**Backlog:** Story 1.14c (Q&A-Themen), Story 1.14d (Freitext-Themen, offen)
**Glättung bleibt getrennt:** Story 1.14b / [word-cloud-spacy.md](word-cloud-spacy.md)
**Zielbild:** [WORD-CLOUD-3.0-STORY-VORSCHLAG.md](../implementation/WORD-CLOUD-3.0-STORY-VORSCHLAG.md)
**Voranalyse:** [WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md](../implementation/WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md)
**ADR (Stufe-2-LLM-Runtime):** [0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md](../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md)

## Zweck

Der Host sieht in der Q&A-Wortwolke orthogonal zur Gewichtung (`Meist unterstützt` / `Beste Fragen` / `Umstritten`) den dritten Analysemodus **Themen**. Sinngleiche Fragen und Paraphrasen werden ein erklärbares Thema mit Mitgliedsliste, Konfidenz und Modellversion.

Mitgliedschaft entsteht durch Embeddings plus deterministisches Clustering. Stufe 1 verbalisiert Cluster **ohne LLM** (zentrale Mitgliedsfrage). Eine Variante ohne Encoder bleibt Fallback und Ausfallbaseline: die lexikalische Wolke 2.x.

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

`THEME` bleibt **Wörter & Phrasen** (lexikalisch 2.x) und wird nicht auf `SEMANTIC` umgebogen. Presenter hat keinen Themenmodus. Freitext hat denselben Stufe-0-Toggle; Encoder-Clustering gilt dort in 1.14c nicht (kontrollierter 2.x-Fallback, `status: fallback`). **Story 1.14d** hebt diesen Fallback für Host-Freitext auf, ohne neuen Sidecar oder Kill-Switch.

Texte sind in `de`, `en`, `fr`, `es` und `it` gepflegt.

## Host-Verhalten

Nur der Host löst `wordCloud.analyze` aus (`hostProcedure`). Es gibt keine automatische Runde bei jeder neuen Frage, Abstimmung oder Tastendruck.

| Kanal     | Encoder-Clustering                                                                                            | Ohne Kill-Switch / tot / Timeout |
| --------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Q&A       | `PINNED`/`ACTIVE`, Locale `de`/`en`, Kanal `QA`                                                               | 2.x-Phrasen, keine leere Karte   |
| Freitext  | nicht in 1.14c Stufe 1; Request mit `channel: 'FREETEXT'` → `status: fallback` (Story **1.14d** hebt das auf) | 2.x wie Stufe 0                  |
| Presenter | kein Themenmodus                                                                                              | lexikalisch 2.x                  |

- **Neue Fragen:** vorhandenes Ergebnis bleibt sichtbar, Status **veraltet**, Button **Neu analysieren**. Keine Dauerschleife. Schlägt die Neuanalyse fehl, bleiben veraltete Cluster und der Retry-Hinweis stehen. Nach einem `ready`-Lauf bleibt **Neu analysieren** bedienbar und umgeht den Snapshot-Cache (`refresh`), damit derselbe Locale-Snapshot ohne Sprachwechsel neu gerechnet wird.
- **Sort- oder Locale-Wechsel** im Themenmodus ist eine Host-Aktion und startet eine neue Analyse desselben Kanal-Snapshots. Locale steckt im Snapshot-Hash: `de` und `en` sind getrennte Caches. Deutsche Q&A bleibt auf **DE**; EN startet keine bessere Analyse, nur einen zweiten Lauf.
- **`SEMANTIC + LEMMA`** ist `MODE_UNSUPPORTED`. Der Glättungsknopf bleibt in **Themen** ausgeblendet und wechselt nicht still auf `LEXICAL` (wie Freitext). Solange Themen vorbereitet werden oder der 2.x-Phrasen-Fallback gilt, bleibt eine zuvor aktive Glättung auf der sichtbaren Wörter-&-Phrasen-Wolke wirksam.
- Während `pending` bleibt das vorherige Cluster-Ergebnis sichtbar, sofern vorhanden; sonst 2.x-Phrasen **mit derselben Glättung wie unter Wörter & Phrasen**, falls die Glättung an ist. Host und Q&A-Dialog zeigen denselben Fortschritt (Text plus unbestimmte Leiste, kein Prozentwert). Die Anzeige bleibt mindestens 1 s sichtbar, damit Cache- oder Fallback-Antworten nicht nur aufblitzen; das Cluster-Ergebnis wechselt erst danach. Läuft die Analyse nach 2 s noch, kommt ein grober Zeit-Hinweis: **Das kann einen Moment dauern.**, ab etwa 100 sichtbaren Fragen bzw. Antworten **Bei vielen Fragen/Antworten kann das eine Minute dauern.** Keine exakten Anzahlen oder Obergrenzen.
- Ohne Cluster mit mindestens zwei Mitgliedern (eine einzelne Frage, nur Singletons) ist der Status `fallback`, nicht `uncertain`. Der Encoder läuft erst ab zwei Fragen. `uncertain` gilt nur, wenn Themenblasen da sind, aber die Konfidenz unter der Host-Stufe **sicher** liegt.

Tooltip, Fokus-/Textalternative und CSV zeigen Label, Gewichtung, Metrik, Mitgliedsfragen, Konfidenz und bei Encoder-Treffer die Modellversion.

## Pipeline

```text
Host-Snapshot (PINNED/ACTIVE, Gewichtung, Locale)
  → Hash (Analyseversion 1.14c.2 + Kanal)
  → Cache (nur ready/uncertain)
  → privater Encoder (e5-small, nur Embeddings)
  → agglomeratives Clustering im Backend (Complete-Linkage, Kosinus ≥ 0,87)
  → extraktives Label (Mitglied nächst am Zentroid, sonst kürzester Text)
  → Zod AnalyzeWordCloud*
```

Der Sidecar liefert ausschließlich Vektoren. Clustering und Labels laufen in TypeScript im App-Backend, nicht im Browser und nicht in spaCy. Höchstens ein Encoder-Call global (`MAX_IN_FLIGHT=1`) und höchstens ein Inflight-Job pro Session. Ein zweiter Snapshot während Inflight antwortet sofort `pending` plus 2.x.

Circuit Breaker: drei Encoder-Fehler öffnen 30 s; danach `failed` plus 2.x ohne neuen Call.

Snapshot an den Encoder: nur `{ id, text }` mit anonymen Quellschlüsseln `qa-question:{uuid}`. Keine Tokens, IPs, Nicknames, Participant-IDs, Session-Codes in den Item-Feldern. Extra-Felder lehnt der Sidecar ab.

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
| Analyseversion        | `1.14c.2`                                                                                                            |

Ohne Kill-Switch: `status: disabled`, `fallbackUsed: true`, 2.x-Phrasen; vorhandene SEMANTIC-Cache-Hits werden nicht ausgeliefert. Toter, langsamer oder überlasteter Encoder: `failed` bzw. `pending`, ebenfalls 2.x. Locales außer `de`/`en`: `fallback` plus lexikalische Wolke.

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

CI-Fixtures (geometrische Einheitsvektoren, kein Modell-Download): die drei Klausur-Paraphrasen zu Kapitel 4 fallen zusammen; Folien vs. Beamer-Hänger nicht. Dasselbe Seed auf Englisch (exam / slides / projector). Echtes e5 nur im gebauten Image.

e5-small liegt bei deutschsprachigen Vorlesungsfragen oft schon bei Kosinus ~0,80 zwischen verschiedenen Themen; identische Satzrahmen („Kurze Nachfrage“, „Kann das jemand einordnen“) ziehen fremde Familien auf ~0,84–0,89. Average-Linkage bei 0,80 verkettet daraus ein Mega-Thema. Complete-Linkage bei 0,87 hält Paraphrasen zusammen und die Familien getrennt. Die Host-Stufe **sicher** (≥ 0,85) bleibt davon unabhängig; engere Cluster liegen typisch darüber.

## Tests

| Check                                      | Befehl / Ort                                                                                                                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vertrag                                    | `npm run test -w @arsnova/shared-types -- src/word-cloud-semantic.test.ts`                                                                                                        |
| Clustering, Encoder-Client, Analyze, Cache | `npm run test -w @arsnova/backend -- --run src/lib/wordCloudSemantic*.test.ts src/lib/wordCloudEncoderClient.test.ts`                                                             |
| Hotpath-Isolation                          | `npm run test -w @arsnova/backend -- --run src/__tests__/wordCloud.hotpath-isolation.test.ts`                                                                                     |
| Host-Toggle, stale, Neu analysieren, CSV   | `npm run test -w @arsnova/frontend -- src/app/features/session/session-host/session-host.component.spec.ts src/app/features/session/session-present/word-cloud.component.spec.ts` |
| Sidecar ohne Modell-Download               | `npm run test:wordcloud-encoder`                                                                                                                                                  |
| Compose-Profil, kein TCP, cgroup           | `npm run test:wordcloud-encoder-compose`                                                                                                                                          |

Siehe [TESTING.md](../TESTING.md).

## Folgestory 1.14d (Host-Freitext-Themen)

Offen. Derselbe Encoder und Kill-Switch, anderer Snapshot: sichtbare Freitextantworten der aktuellen Frage, oft ganze Sätze (Beispiel: „Schreibt, wie ihr euch gerade fühlt“). Die Stufe-0-UI bleibt; `channel: 'FREETEXT'` soll dann clustern statt hart auf `fallback` zu gehen. Presenter bleibt außen vor. Zuschnitt: [Backlog.md](../../Backlog.md) Story 1.14d.

## Nicht-Ziele (bewusst außerhalb von Stufe 1)

LLM-Labels (Stufe 2), 8.9c Slice 4, 8.9b-Transformer, Presenter-Themenmodus, Encoder-Clustering für Freitext (**Story 1.14d**), SaaS-Fallback, Angular-Initial-Bundle-`maximumError` anheben, Produktivaktivierung.

Stufe 2 bleibt offen hinter Story 8.9d / [ADR-0035](../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md): das LLM darf nur das Label ersetzen. Clustering bleibt Stufe 1; LLM-Ausfall fällt auf das extraktive Label, nicht auf lexikalisch 2.x. `OPEN_WEIGHT_LLM_ENABLED` aus lässt `WORD_CLOUD_SEMANTIC_ENABLED` unberührt.

## Verträge und Code

- Shared: `libs/shared-types/src/word-cloud-semantic.ts`, `AnalyzeWordCloud*` in `libs/shared-types/src/schemas.ts`
- Backend: `wordCloud.ts`, `wordCloudSemanticAnalyze.ts`, `wordCloudSemanticCluster.ts`, `wordCloudEncoderClient.ts`, `wordCloudSemanticConfig.ts`
- Sidecar: `docker/wordcloud-encoder/`
- Frontend: Host-Steuerung in `session-host.component.ts`; Q&A-Dialog `qa-word-cloud-dialog.component.*`; Renderer `word-cloud.component.ts`
