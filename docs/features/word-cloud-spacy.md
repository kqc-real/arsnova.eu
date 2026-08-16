<!-- markdownlint-disable MD013 -->

# Wortwolke: optionale Sprachformen-Glättung (Story 1.14b)

**Zielgruppe:** Product Owner, Entwickler, Betrieb, Lehre
**Stand:** 2026-08-16
**Status:** ✅ umgesetzt (Analyseversion `1.14b.8`)
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
| Sprache wählen  | **Wähle die Sprache der Antworten** (kein Lemma-Modell für die Host-UI)  |
| Fehler          | **Glättung fehlgeschlagen**                                              |

Nicht in der Host-UI: `spaCy`, `NLP`, `Lemma`, `Lemmatisierung`. Modell- und Versionsangaben dürfen in Diagnose, Telemetrie und Export erscheinen. Texte sind in `de`, `en`, `fr`, `es` und `it` gepflegt.

## Host-Verhalten

Nur der Host löst die Analyse aus. Es gibt keinen Participant-Toggle und keine automatische Runde bei jeder neuen Antwort, Frage oder Abstimmung.

| Kanal    | Vollansicht                                          | Ansichtsachsen                                            | Glättung                                       |
| -------- | ---------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| Freitext | dieselbe `app-word-cloud`-Instanz, In-Place-Maximize | `Einzelwörter` / `Wörter & Phrasen`                       | in beiden Ansichten; `maxNgramLength` 1 bzw. 3 |
| Q&A      | eigener `MatDialog`                                  | `Einzelwörter` (`LEXICAL`) / `Wörter & Phrasen` (`THEME`) | nur `LEXICAL`; Einschalten erzwingt `LEXICAL`  |

Presenter zeigt die Wolke ohne Glättungssteuerung und ohne Wolkensprache.

Die **Wolkensprache** steht klein neben **Sprachformen glätten** (Freitext und Q&A). Sie ist unabhängig von Quiz und Participant-Browser. Default ist die Host-UI-Sprache, sofern ein Lemma-Modell existiert (`de`/`en`/`fr`/`es`). Unter `/it/` bleibt die Glättung aus, bis der Host eine dieser Sprachen wählt. Ein Wechsel bei aktiver Glättung analysiert denselben Snapshot mit dem neuen Modell neu. Die Wahl gilt für die Session (Freitext und Q&A) und bleibt im `sessionStorage` des Tabs.

### Wann neu geglättet wird

- **Neue eingehende Daten:** Snapshot wird **veraltet** markiert; keine automatische Neuberechnung.
- **Freitext-Ansicht wechseln** bei aktiver Glättung: dieselbe Antwortmenge mit der anderen N-Gramm-Länge neu analysieren.
- **Wolkensprache wechseln** bei aktiver Glättung: dieselbe Datenmenge mit dem anderen Modell neu analysieren.
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

Locales: `de`/`en` (MIT), `fr` (LGPL-LR) und `es` (GPL-3.0) im Default-Sidecar. `it` fällt lexikalisch zurück (`it_core_news_sm` ist CC BY-NC-SA 3.0 und gehört nicht ins Default-Image). Das Image ist kein reines MIT-Artefakt. Hinweise: [NOTICE](../../NOTICE).

## Betrieb

spaCy läuft als **optionaler Sidecar** hinter dem Backend, nicht im Angular-Frontend und nicht im Node-App-Container.

| Größe               | Wert                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Kill-Switch         | `NLP_ENABLED` (nur exakt `true`; Default `false`)                                                                     |
| Socket              | `NLP_SOCKET_PATH` (Unix-Socket, kein TCP, `network_mode: none`)                                                       |
| Timeout / Cache-TTL | `NLP_TIMEOUT_MS`, `NLP_CACHE_TTL_SECONDS` (Default 1800 s)                                                            |
| Image               | `SPACY_IMAGE` (getrennt von `ARSNOVA_IMAGE`)                                                                          |
| Compose             | Profil `nlp`; `deploy.sh` startet den Sidecar nicht                                                                   |
| Lokal (Docker-App)  | `npm run docker:up:nlp` plus `NLP_ENABLED=true` im App-Container                                                      |
| Lokal (Host-npm)    | macOS: `npm run spacy:macos-dev` (Abschnitt unten). Docker-Volume `/run/spacy/nlp.sock` ist für Host-Node unsichtbar. |
| Limits              | 1 CPU / 1 GiB RAM / 64 PIDs, non-root, read-only                                                                      |

Cache: Text-Cache (`locale + hash + Analyseversion`) und Snapshot-Cache (`session + Kanal + Metrik + Normalisierung + maxNgramLength + snapshotHash`). Transiente Fehler (`TIMEOUT`, `SIDECAR_UNAVAILABLE`, `INVALID_RESPONSE`) und `NLP_DISABLED` werden nicht gecacht. Telemetrie loggt Dauer, Fallback und Cache-Hits ohne Rohtexte.

Env-Referenz: [ENVIRONMENT.md](../ENVIRONMENT.md). Härtung: [SECURITY-OVERVIEW.md](../SECURITY-OVERVIEW.md). Deployment: [deployment-debian-root-server.md](../deployment-debian-root-server.md).

### Lokale Prüfung auf macOS (Host-npm)

`ng serve` auf Port 4200 liefert **eine** Locale (ADR-0008). Für Glättung in **de/en/fr/es** und den bewussten Fallback in **it** braucht es den lokalisierten Produktions-Build.

```bash
npm run spacy:macos-dev
```

Für den Einstieg (Setup plus dieser Befehl): [onboarding.md](../onboarding.md#volle-lokale-session-mit-hoher-befüllung). Skript: [`scripts/macos-spacy-wordcloud-dev.sh`](../../scripts/macos-spacy-wordcloud-dev.sh). Es startet **keinen** Angular-Dev-Server. Port 4200 wird zuerst freigeräumt, danach bedient `serve:localize:api` den Dist.

| Schritt       | Wirkung                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Aufräumen     | `free-dev-ports` (3000/3001/3002/4200), `clean:generated`, spaCy-Container, lokale arsnova-/spaCy-Images. Postgres/Redis-Volumes bleiben. |
| Infrastruktur | `docker:up:dev` falls 5432/6379 fehlen; `prisma:push` (sonst fehlt `public.Quiz`); Host-Sidecar auf `/tmp/arsnova-nlp.sock`               |
| Env           | lokale `.env`: `NLP_ENABLED=true`, `NLP_SOCKET_PATH=/tmp/arsnova-nlp.sock`, `NLP_TIMEOUT_MS=15000`                                        |
| Build         | `npm run build:prod` (`de`/`en`/`fr`/`es`/`it`)                                                                                           |
| Prozesse      | `start:prod` auf **3000**; `serve:localize:api` auf **4200** (Dist plus Proxy `/trpc`, `/trpc-ws`, `/yjs-ws`)                             |
| Seeds         | nach Session-Code: `seed:session-votes` (Freitext) und `seed:qa-forum --replace`                                                          |

`NODE_ENV=production` setzt kein HTTP-CORS für `ng serve`. Die Locale-UI daher über **4200 (Proxy)** oder **3000 (same-origin)** öffnen, nicht über einen parallelen Dev-Server.

Die **Wolkensprache** am Glätten-Button folgt zuerst der Host-UI. Unter `/it/` zuerst DE/EN/FR/ES wählen; danach ist Glättung unabhängig von der UI-Locale.

| Locale | URL                       | Sprachformen glätten                                     |
| ------ | ------------------------- | -------------------------------------------------------- |
| de     | http://localhost:4200/de/ | an (Default DE)                                          |
| en     | http://localhost:4200/en/ | an (Default EN)                                          |
| fr     | http://localhost:4200/fr/ | an (Default FR)                                          |
| es     | http://localhost:4200/es/ | an (Default ES)                                          |
| it     | http://localhost:4200/it/ | nach Wahl von DE/EN/FR/ES; sonst **Wähle die Sprache …** |

Root http://localhost:4200/ leitet nach `/de/`. Derselbe Build liegt unter http://localhost:3000/de/ usw. Hart neu laden.

**Vor dem Seed:** Host-Session mit dem **Demo-Quiz** (Praxis-Showcase) anlegen und die Freitextfrage anzeigen (DE: „Was hilft dir beim Lernen?“). Ohne diese Frage kann `seed:session-votes` die Wolke nicht befüllen. Der Q&A-Kanal darf aus sein; das Seed schaltet ihn sonst ein.

Wiederholung ohne Clean/Build (Stack und Dist bleiben):

```bash
npm run spacy:macos-dev -- --yes --skip-clean --skip-build --code ABC123
```

| Flag             | Bedeutung                             |
| ---------------- | ------------------------------------- |
| `--code ABC123`  | 6-stelliger Session-Code              |
| `--yes`          | Hinweis ohne Enter                    |
| `--skip-clean`   | Dist, Caches und Images behalten      |
| `--skip-build`   | vorhandenen Locale-Dist nutzen        |
| `--keep-backend` | laufendes `start:prod` nicht ersetzen |
| `--append-qa`    | Q&A-Fragen anhängen statt ersetzen    |
| `--dry-run`      | Seeds nur prüfen                      |

Logs: Sidecar `/tmp/arsnova-nlp-sidecar.log`, Backend `/tmp/arsnova-backend-nlp.log`, Locale-Server `/tmp/arsnova-frontend-localize.log`.

Lokales `start:prod` verlangt ein HMAC-Secret ≥32 UTF-8-Bytes (`YJS_SHARE_TOKEN_SECRET` oder `JWT_SECRET`). Ist `JWT_SECRET` in `.env` kürzer, setzt der Helfer ein **prozesslokales** `YJS_SHARE_TOKEN_SECRET` und schreibt es nicht in `.env`.

`npm run docker:up:nlp` hilft Host-Node auf macOS nicht. Unter Linux im App-Container: `npm run docker:up:nlp`. Hilfe-/Syntax-Tests: `npm run spacy:macos-dev:test`. Locale-Proxy allgemein: [I18N-ANGULAR.md](../I18N-ANGULAR.md) („Lokalisierter Build lokal“).

## Verträge und Code

- Shared: `libs/shared-types/src/word-cloud-normalization.ts`, `wordCloud.analyze` in `libs/shared-types/src/schemas.ts`
- Backend: `wordCloud.ts`, `wordCloudAnalysis.ts`, `wordCloudNormalizer.ts`, `spacyClient.ts`, `wordCloudAnalysisCache.ts`, `wordCloudNlpTelemetry.ts`, `nlpSidecarConfig.ts`
- Sidecar: `docker/spacy/`
- Frontend: Host-Steuerung in `session-host.component.ts`; Wolkensprache `word-cloud-lemma-locale-select.component.ts`; Q&A-Dialog `qa-word-cloud-dialog.component.*`; Freitext-Maximize in-place auf `app-word-cloud`

## Tests

| Check                                      | Befehl / Ort                                                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vertrag und Resolver                       | `npm run test -w @arsnova/shared-types`                                                                                                                               |
| Analyse, Fallback, Cache, Fixtures         | `npm run test -w @arsnova/backend` (`wordCloud*.test.ts`)                                                                                                             |
| Host-Trigger, stale, Sort-/Moduswechsel    | `npm run test -w @arsnova/frontend` (`session-host.component.spec.ts`)                                                                                                |
| Sidecar ohne Modell-Download               | `npm run test:spacy-sidecar`                                                                                                                                          |
| Compose-Profil, kein TCP, getrenntes Image | `npm run test:spacy-compose`                                                                                                                                          |
| Lokale UI-Füllung Freitext / Q&A           | `npm run seed:session-votes -w @arsnova/backend` bzw. `npm run seed:qa-forum -w @arsnova/backend` (fragt den Session-Code, Default 500 lemma-/phrasenreiche Einträge) |
| macOS Host-npm (Sidecar + beide Seeds)     | `npm run spacy:macos-dev` — siehe [Lokale Prüfung auf macOS](#lokale-prüfung-auf-macos-host-npm); Syntax/Hilfe: `npm run spacy:macos-dev:test`                        |

Siehe [TESTING.md](../TESTING.md).

## Nicht-Ziele

Semantische Paraphrasencluster, Embeddings, generative Labels, Participant-Analyse, automatische Dauerneuberechnung bei neuem Input, neue Layout-Engine, externer SaaS-NLP, Relizenzierung von arsnova.eu, Mitlieferung von `it_core_news_sm` im Default-Image.

## Planungshistorie

Anforderungen und Phasen: [WORD-CLOUD-SPACY-GLAETTUNG-ZIELBILD.md](../implementation/WORD-CLOUD-SPACY-GLAETTUNG-ZIELBILD.md), [WORD-CLOUD-SPACY-GLAETTUNG-IMPLEMENTATION-PLAN.md](../implementation/WORD-CLOUD-SPACY-GLAETTUNG-IMPLEMENTATION-PLAN.md). Lexikalische 2.x-Baseline: [WORD-CLOUD-2.1-LEMMA-STRATEGY.md](../implementation/WORD-CLOUD-2.1-LEMMA-STRATEGY.md), [ADR-0012](../architecture/decisions/0012-use-d3-cloud-for-freetext-word-clouds.md).
