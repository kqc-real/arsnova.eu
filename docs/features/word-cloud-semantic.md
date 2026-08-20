<!-- markdownlint-disable MD013 -->

# Wortwolke: semantischer Q&A-Themenmodus (Story 1.14c Stufe 1)

**Zielgruppe:** Product Owner, Entwickler, Betrieb, Lehre
**Stand:** 2026-08-20
**Status:** Stufe 1 im Repo (Encoder + Clustering, extraktive Labels); Kill-Switch produktiv default aus; kein LLM
**Backlog:** Story 1.14c (Word Cloud 3.0)
**Glättung bleibt getrennt:** Story 1.14b / [word-cloud-spacy.md](word-cloud-spacy.md)
**Zielbild:** [WORD-CLOUD-3.0-STORY-VORSCHLAG.md](../implementation/WORD-CLOUD-3.0-STORY-VORSCHLAG.md)
**Voranalyse:** [WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md](../implementation/WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md)

## Zweck

Der Host sieht in der Q&A-Wortwolke orthogonal zur Gewichtung (`Meist unterstützt` / `Beste Fragen` / `Umstritten`) den dritten Analysemodus **Themen**. Sinngleiche Fragen und Paraphrasen werden ein erklärbares Thema mit Mitgliedsliste, Konfidenz und Modellversion.

Mitgliedschaft entsteht durch Embeddings plus deterministisches Clustering. Stufe 1 verbalisiert Cluster **ohne LLM** (zentrale Mitgliedsfrage). Eine Variante ohne Encoder bleibt Fallback und Ausfallbaseline: die lexikalische Wolke 2.x.

Kein Encoder-Code im Browser. Teilnehmer-DTOs enthalten keine Cluster-Felder. Live-Hotpaths (`qa.submit`, Join, Vote, WebSocket) warten nie auf Inferenz.

## UI-Begriffe

Das Host-Label ist **Themen**. Intern heißt die Variante `SEMANTIC`. Nicht in der Host-UI: `Semantische Themen`, `Encoder`, `e5`, `Embedding`, `Clustering`.

| Zustand         | Host-Text                                                               |
| --------------- | ----------------------------------------------------------------------- |
| Läuft           | **Themen werden vorbereitet. Es gelten Wörter und Phrasen.**            |
| Veraltet        | **Neue Fragen seit der letzten Themenanalyse** plus **Neu analysieren** |
| Unsicher        | **Einige Themen sind unsicher. Prüfe die Mitgliedsfragen.**             |
| Fehlgeschlagen  | **Themenanalyse fehlgeschlagen. Es gelten Wörter und Phrasen.**         |
| Nicht belastbar | **Themen sind gerade nicht belastbar. Es gelten Wörter und Phrasen.**   |
| Nicht verfügbar | **Themen sind noch nicht verfügbar. Es gelten Wörter und Phrasen.**     |

`THEME` bleibt **Wörter & Phrasen** (lexikalisch 2.x) und wird nicht auf `SEMANTIC` umgebogen. Presenter hat keinen Themenmodus. Freitext hat denselben Stufe-0-Toggle; Encoder-Clustering gilt dort nicht (kontrollierter 2.x-Fallback, `status: fallback`).

Texte sind in `de`, `en`, `fr`, `es` und `it` gepflegt.

## Host-Verhalten

Nur der Host löst `wordCloud.analyze` aus (`hostProcedure`). Es gibt keine automatische Runde bei jeder neuen Frage, Abstimmung oder Tastendruck.

| Kanal     | Encoder-Clustering                                                       | Ohne Kill-Switch / tot / Timeout |
| --------- | ------------------------------------------------------------------------ | -------------------------------- |
| Q&A       | `PINNED`/`ACTIVE`, Locale `de`/`en`, Kanal `QA`                          | 2.x-Phrasen, keine leere Karte   |
| Freitext  | nicht in Stufe 1; Request mit `channel: 'FREETEXT'` → `status: fallback` | 2.x wie Stufe 0                  |
| Presenter | kein Themenmodus                                                         | lexikalisch 2.x                  |

- **Neue Fragen:** vorhandenes Ergebnis bleibt sichtbar, Status **veraltet**, Button **Neu analysieren**. Keine Dauerschleife.
- **Sort- oder Locale-Wechsel** im Themenmodus ist eine Host-Aktion und startet eine neue Analyse desselben Kanal-Snapshots.
- **`SEMANTIC + LEMMA`** ist `MODE_UNSUPPORTED`. Die Glättung bleibt ausgeblendet und wechselt nicht still auf `LEXICAL` (wie Freitext).
- Während `pending` bleibt das vorherige Cluster-Ergebnis sichtbar, sofern vorhanden; sonst 2.x-Phrasen.

Tooltip, Fokus-/Textalternative und CSV zeigen Label, Gewichtung, Metrik, Mitgliedsfragen, Konfidenz und bei Encoder-Treffer die Modellversion.

## Pipeline

```text
Host-Snapshot (PINNED/ACTIVE, Gewichtung, Locale)
  → Hash (Analyseversion 1.14c.1 + Kanal)
  → Cache (nur ready/uncertain)
  → privater Encoder (e5-small, nur Embeddings)
  → agglomeratives Clustering im Backend (Average-Linkage, Kosinus ≥ 0,8)
  → extraktives Label (Mitglied nächst am Zentroid, sonst kürzester Text)
  → Zod AnalyzeWordCloud*
```

Der Sidecar liefert ausschließlich Vektoren. Clustering und Labels laufen in TypeScript im App-Backend, nicht im Browser und nicht in spaCy. Höchstens ein Encoder-Call global (`MAX_IN_FLIGHT=1`) und höchstens ein Inflight-Job pro Session. Ein zweiter Snapshot während Inflight antwortet sofort `pending` plus 2.x.

Circuit Breaker: drei Encoder-Fehler öffnen 30 s; danach `failed` plus 2.x ohne neuen Call.

Snapshot an den Encoder: nur `{ id, text }` mit anonymen Quellschlüsseln `qa-question:{uuid}`. Keine Tokens, IPs, Nicknames, Participant-IDs, Session-Codes in den Item-Feldern. Extra-Felder lehnt der Sidecar ab.

## Betrieb

Der Encoder läuft als **optionaler Sidecar** hinter dem Backend, analog spaCy: Compose-Profil `encoder`, Unix-Socket, `network_mode: none`, kein öffentlicher Port. Alternativ internes HTTP analog 8.9c (`WORD_CLOUD_ENCODER_URL`), nur Loopback/privates Netz. Browser sprechen den Dienst nie an. Öffentliche SaaS-Hosts sind blockiert. `deploy.sh` startet den Encoder nicht.

| Größe                 | Wert                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Kill-Switch           | `WORD_CLOUD_SEMANTIC_ENABLED` (nur exakt `true`; Default `false`)                             |
| Nicht wiederverwendet | `NLP_ENABLED`, `QA_NLP_ENABLED`, `QA_SUMMARY_ENABLED`, `QA_SUMMARY_INFERENCE_URL`             |
| Socket                | `WORD_CLOUD_ENCODER_SOCKET_PATH` (Default `/run/wordcloud-encoder/encoder.sock`)              |
| HTTP (optional)       | `WORD_CLOUD_ENCODER_URL`, Token `WORD_CLOUD_ENCODER_TOKEN` (nie in der URL)                   |
| Timeout / Cache-TTL   | `WORD_CLOUD_ENCODER_TIMEOUT_MS` (Default 8000), `WORD_CLOUD_ENCODER_CACHE_TTL_SECONDS` (1800) |
| Image                 | `WORD_CLOUD_ENCODER_IMAGE` (getrennt von `ARSNOVA_IMAGE` und `SPACY_IMAGE`)                   |
| Compose               | Profil `encoder`                                                                              |
| Limits                | 1 CPU / 2 GiB RAM / 64 PIDs, non-root, read-only, `network_mode: none`                        |
| Modell                | `intfloat/multilingual-e5-small` (Apache-2.0), ONNX, Digest in `modelVersion`                 |
| Analyseversion        | `1.14c.1`                                                                                     |

Ohne Kill-Switch: `status: disabled`, `fallbackUsed: true`, 2.x-Phrasen. Toter, langsamer oder überlasteter Encoder: `failed` bzw. `pending`, ebenfalls 2.x. Locales außer `de`/`en`: `fallback` plus lexikalische Wolke.

Env-Referenz: [ENVIRONMENT.md](../ENVIRONMENT.md). Härtung: [SECURITY-OVERVIEW.md](../SECURITY-OVERVIEW.md). Deployment: [deployment-debian-root-server.md](../deployment-debian-root-server.md). Lizenzen: [NOTICE](../../NOTICE), [docker/wordcloud-encoder/NOTICE](../../docker/wordcloud-encoder/NOTICE).

### Lokal (Docker-App)

```bash
npm run docker:up:encoder
```

Im App-Container `WORD_CLOUD_SEMANTIC_ENABLED=true` und Socket `/run/wordcloud-encoder/encoder.sock`. Der Volume-Socket ist für Host-Node auf macOS unsichtbar.

### Lokal (Host-npm / macOS)

Sidecar mit Loopback, kein Docker-Port:

```env
WORD_CLOUD_SEMANTIC_ENABLED=true
WORD_CLOUD_ENCODER_URL=http://127.0.0.1:8790/embed
```

Der Python-Dienst akzeptiert `WORD_CLOUD_ENCODER_HTTP_BIND=127.0.0.1:8790`. Produktion setzt diesen Bind nicht. `WORD_CLOUD_ENCODER_ALLOW_STUB=true` ist nur für Unittests ohne ONNX-Gewichte.

## Vertrag

Shared-Zod: `AnalyzeWordCloud*` in `libs/shared-types/src/schemas.ts`, Konstanten in `libs/shared-types/src/word-cloud-semantic.ts`. Cluster-Status liegen auf diesem Vertrag, nicht auf `QaSummaryStatusEnum` / 8.9c.

Status: `pending` | `ready` | `uncertain` | `stale` | `disabled` | `failed` | `fallback`.

`stale` setzt das Frontend, wenn sich der Host-Snapshot nach einem `ready`-Ergebnis ändert. Cache speichert SEMANTIC nur bei `ready`/`uncertain`.

8.9c bleibt unabhängig: anderer Kill-Switch, anderer Snapshot (inkl. `PENDING`), anderer Auftrag. Cluster-Labels sind keine Summary-Bullets.

## Qualität

CI-Fixtures (geometrische Einheitsvektoren, kein Modell-Download): die drei Klausur-Paraphrasen zu Kapitel 4 fallen zusammen; Folien vs. Beamer-Hänger nicht. Dasselbe Seed auf Englisch (exam / slides / projector). Echtes e5 nur im gebauten Image.

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

## Nicht-Ziele (bewusst außerhalb von Stufe 1)

LLM-Labels (Stufe 2), 8.9c Slice 4, 8.9b-Transformer, Presenter-Themenmodus, Encoder-Clustering für Freitext, SaaS-Fallback, Angular-Initial-Bundle-`maximumError` anheben, Produktivaktivierung.

## Verträge und Code

- Shared: `libs/shared-types/src/word-cloud-semantic.ts`, `AnalyzeWordCloud*` in `libs/shared-types/src/schemas.ts`
- Backend: `wordCloud.ts`, `wordCloudSemanticAnalyze.ts`, `wordCloudSemanticCluster.ts`, `wordCloudEncoderClient.ts`, `wordCloudSemanticConfig.ts`
- Sidecar: `docker/wordcloud-encoder/`
- Frontend: Host-Steuerung in `session-host.component.ts`; Q&A-Dialog `qa-word-cloud-dialog.component.*`; Renderer `word-cloud.component.ts`
