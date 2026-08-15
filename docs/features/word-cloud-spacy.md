<!-- markdownlint-disable MD013 -->

# Wortwolke: optionale Sprachformen-Glättung (Story 1.14b)

**Zielgruppe:** Product Owner, Entwickler, Betrieb, Lehre
**Stand:** 2026-08-15
**Status:** ✅ umgesetzt (Analyseversion `1.14b.7`)
**Backlog:** Story 1.14b (Word Cloud 2.6)
**Semantik bleibt getrennt:** Story 1.14c / [WORD-CLOUD-3.0-STORY-VORSCHLAG.md](../implementation/WORD-CLOUD-3.0-STORY-VORSCHLAG.md)

## Zweck

Die optionale Glättung führt in der **lexikalischen** Freitext- und Q&A-Wortwolke Flexionsformen zusammen (`Frage`/`Fragen`, `validieren`/`validiert`/`Validierung`). Sie erzeugt **keine** Synonym-, Intent- oder Themencluster.

Ohne Sidecar, ohne Host-Klick und bei jedem Fehler bleibt die bestehende Wortwolke 2.5 der Standard.

## UI-Begriffe

| Zustand         | Host-Text                                                                |
| --------------- | ------------------------------------------------------------------------ |
| Auslöser        | **Sprachformen glätten**                                                 |
| Läuft           | **Analyse läuft**                                                        |
| Aktiv           | **Glättung aktiv**                                                       |
| Neue Daten      | **Neue Antworten/Fragen seit letzter Glättung** plus **Neu analysieren** |
| Nicht verfügbar | **Glättung nicht verfügbar**                                             |
| Fehler          | **Glättung fehlgeschlagen**                                              |

Nicht in der Host-UI: `spaCy`, `NLP`, `Lemma`, `Lemmatisierung`. Modell- und Versionsangaben dürfen in Diagnose, Telemetrie und Export erscheinen. Texte sind in `de`, `en`, `fr`, `es` und `it` gepflegt.

## Host-Verhalten

Nur der Host löst die Analyse aus. Es gibt keinen Participant-Toggle und keine automatische Runde bei jeder neuen Antwort, Frage oder Abstimmung.

| Kanal    | Vollansicht                                          | Ansichtsachsen                                            | Glättung                                       |
| -------- | ---------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| Freitext | dieselbe `app-word-cloud`-Instanz, In-Place-Maximize | `Einzelwörter` / `Wörter & Phrasen`                       | in beiden Ansichten; `maxNgramLength` 1 bzw. 3 |
| Q&A      | eigener `MatDialog`                                  | `Einzelwörter` (`LEXICAL`) / `Wörter & Phrasen` (`THEME`) | nur `LEXICAL`; Einschalten erzwingt `LEXICAL`  |

Presenter zeigt die Wolke ohne Glättungssteuerung.

### Wann neu geglättet wird

- **Neue eingehende Daten:** Snapshot wird **veraltet** markiert; keine automatische Neuberechnung.
- **Freitext-Ansicht wechseln** bei aktiver Glättung: dieselbe Antwortmenge mit der anderen N-Gramm-Länge neu analysieren.
- **Q&A-Sortierung** `Meist unterstützt` / `Beste Fragen` / `Umstritten` bei aktiver `LEXICAL`-Glättung: dieselbe Fragenmenge mit der neuen Metrik neu glätten.
- **Q&A `Wörter & Phrasen`:** Sortwechsel startet die bestehende Themenanalyse mit `normalization: NONE`, nicht den Lemma-Pfad. `THEME + LEMMA` ist `MODE_UNSUPPORTED`.

Während der Analyse bleibt die lexikalische Wolke sichtbar und bedienbar. Sidecar-Ausfall, Timeout oder unsupported Locale fallen hart auf den 2.x-Pfad zurück.

## Pipeline

`Daten holen → bereinigen und Fachbegriffe schützen → optional spaCy (Token, Lemma, POS, optional Entity) → lexikalisch aggregieren → rendern / Tooltip / CSV / PNG`

Der Renderer analysiert keine Rohtexte. Gruppierungsschlüssel und Anzeigelabel bleiben getrennt; sichtbare Labels sind häufige Oberflächenformen, keine rohen Lemmaformen.

Erste Qualitätsstufe:

- Lemma intern für `NOUN`, `VERB`, `ADJ`/`ADV`
- sichtbare Unigramme nur `NOUN`, `PROPN`, `NUM` und technische `X`
- `PROPN` bleibt Oberflächenform
- Adjektive nur in Nominalphrasen, nicht als Einzelwort
- Verben, Auxiliare, Adverbien und Komparative als Unigramme unterdrückt
- substantivierte Infinitive (`Lernen`) bleiben sichtbar
- Stopwortfilter auf Lemma **und** gebeugte Oberfläche
- leere Unigramm-Liste fällt nicht auf die lokale ungeglättete Aggregation zurück

Locales: `de`/`en` im Default-Sidecar (MIT). `fr`/`es`/`it` fallen im verteilten Default lexikalisch zurück (`it_core_news_sm` ist CC BY-NC-SA 3.0 und gehört nicht ins MIT-Image). Hinweise: [NOTICE](../../NOTICE).

## Betrieb

spaCy läuft als **optionaler Sidecar** hinter dem Backend, nicht im Angular-Frontend und nicht im Node-App-Container.

| Größe               | Wert                                                            |
| ------------------- | --------------------------------------------------------------- |
| Kill-Switch         | `NLP_ENABLED` (nur exakt `true`; Default `false`)               |
| Socket              | `NLP_SOCKET_PATH` (Unix-Socket, kein TCP, `network_mode: none`) |
| Timeout / Cache-TTL | `NLP_TIMEOUT_MS`, `NLP_CACHE_TTL_SECONDS` (Default 1800 s)      |
| Image               | `SPACY_IMAGE` (getrennt von `ARSNOVA_IMAGE`)                    |
| Compose             | Profil `nlp`; `deploy.sh` startet den Sidecar nicht             |
| Lokal               | `npm run docker:up:nlp`                                         |
| Limits              | 1 CPU / 1 GiB RAM / 64 PIDs, non-root, read-only                |

Cache: Text-Cache (`locale + hash + Analyseversion`) und Snapshot-Cache (`session + Kanal + Metrik + Normalisierung + maxNgramLength + snapshotHash`). Transiente Fehler (`TIMEOUT`, `SIDECAR_UNAVAILABLE`, `INVALID_RESPONSE`) werden nicht gecacht. Telemetrie loggt Dauer, Fallback und Cache-Hits ohne Rohtexte.

Env-Referenz: [ENVIRONMENT.md](../ENVIRONMENT.md). Härtung: [SECURITY-OVERVIEW.md](../SECURITY-OVERVIEW.md). Deployment: [deployment-debian-root-server.md](../deployment-debian-root-server.md).

## Verträge und Code

- Shared: `libs/shared-types/src/word-cloud-normalization.ts`, `wordCloud.analyze` in `libs/shared-types/src/schemas.ts`
- Backend: `wordCloud.ts`, `wordCloudAnalysis.ts`, `wordCloudNormalizer.ts`, `spacyClient.ts`, `wordCloudAnalysisCache.ts`, `wordCloudNlpTelemetry.ts`, `nlpSidecarConfig.ts`
- Sidecar: `docker/spacy/`
- Frontend: Host-Steuerung in `session-host.component.ts`; Q&A-Dialog `qa-word-cloud-dialog.component.*`; Freitext-Maximize in-place auf `app-word-cloud`

## Tests

| Check                                      | Befehl / Ort                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Vertrag und Resolver                       | `npm run test -w @arsnova/shared-types`                                |
| Analyse, Fallback, Cache, Fixtures         | `npm run test -w @arsnova/backend` (`wordCloud*.test.ts`)              |
| Host-Trigger, stale, Sort-/Moduswechsel    | `npm run test -w @arsnova/frontend` (`session-host.component.spec.ts`) |
| Sidecar ohne Modell-Download               | `npm run test:spacy-sidecar`                                           |
| Compose-Profil, kein TCP, getrenntes Image | `npm run test:spacy-compose`                                           |

Siehe [TESTING.md](../TESTING.md).

## Nicht-Ziele

Semantische Paraphrasencluster, Embeddings, generative Labels, Participant-Analyse, automatische Dauerneuberechnung bei neuem Input, neue Layout-Engine, externer SaaS-NLP, Relizenzierung von arsnova.eu, Mitlieferung von `it_core_news_sm` im MIT-Default.

## Planungshistorie

Anforderungen und Phasen: [WORD-CLOUD-SPACY-GLAETTUNG-ZIELBILD.md](../implementation/WORD-CLOUD-SPACY-GLAETTUNG-ZIELBILD.md), [WORD-CLOUD-SPACY-GLAETTUNG-IMPLEMENTATION-PLAN.md](../implementation/WORD-CLOUD-SPACY-GLAETTUNG-IMPLEMENTATION-PLAN.md). Lexikalische 2.x-Baseline: [WORD-CLOUD-2.1-LEMMA-STRATEGY.md](../implementation/WORD-CLOUD-2.1-LEMMA-STRATEGY.md), [ADR-0012](../architecture/decisions/0012-use-d3-cloud-for-freetext-word-clouds.md).
