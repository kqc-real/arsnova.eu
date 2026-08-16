<!-- markdownlint-disable MD013 -->

# Word Cloud - Implementierungsplan fuer spaCy als optionale Glaettung

**Status:** Story 1.14b abgeschlossen (Phasen 1–7 plus Host-UX-Nachschärfung)
**Stand:** August 2026
**Kanonische Produktdoku:** `docs/features/word-cloud-spacy.md`
**Zielbild:** `docs/implementation/WORD-CLOUD-SPACY-GLAETTUNG-ZIELBILD.md`
**Architekturbezug:** `docs/implementation/WORD-CLOUD-2.1-LEMMA-STRATEGY.md`, `docs/implementation/WORD-CLOUD-3.0-STORY-VORSCHLAG.md`, `docs/architecture/decisions/0012-use-d3-cloud-for-freetext-word-clouds.md`

---

## Ziel

`arsnova.eu` bietet fuer Wortwolken eine **optionale sprachliche Glaettung**, ohne die `Word Cloud 2.5`-Linie zu destabilisieren.

Der erste belastbare Umsetzungszuschnitt ist:

- **nur host-ausgeloest**
- **nur auf Snapshot-Basis**
- **nur als Vorverarbeitung innerhalb der bestehenden lexikalischen Pipeline**
- **mit hartem Fallback auf die heutige Wortwolke**
- **fuer Q&A und Freitext**
- **ohne spaCy im Participant-Livepfad**

---

## Produktzuschnitt

### Was die Story leistet

- Host kann in der Q&A-Wortwolke `Sprachformen glaetten` ausloesen
- Host kann in der Freitext-Wortwolke `Sprachformen glaetten` ausloesen
- ein analysierter Snapshot bleibt stehen, bis der Host neu anfordert
- neue Fragen/Antworten markieren den geglaetteten Stand als veraltet
- die heutige lexikalische Wortwolke bleibt jederzeit der sichere Standard

### Was die Story bewusst nicht leistet

- kein semantischer Themenmodus
- kein Participant-Toggle
- keine automatische Dauer-Neuberechnung
- keine neue Layout-Engine
- kein WYSIWYG-PNG-Snapshot
- keine generative Labelbildung

---

## Harte Leitplanken

1. **spaCy ist nur Glaettung, nicht Semantik.**
2. **Die Render-Komponente analysiert keine Rohtexte.**
3. **Die heutige Wortwolke bleibt bei jedem Fehler benutzbar.**
4. **Geschuetzte Fachbegriffe bleiben unberuehrt.**
5. **Namen werden nicht blind lemmatisiert.**
6. **Komposita werden in der ersten Stufe nicht aggressiv zerlegt.**

---

## Scope-Entscheidung fuer die erste Umsetzung

### Sprache

Die erste technische Qualitaetsstufe bleibt bewusst auf `de` und `en` begrenzt.

Begruendung:

- dafuer ist der bisherige Backend-Analysepfad ohnehin schon ausgelegt
- Fixtures und linguistische Qualitaet sind zuerst fuer `de/en` zu belegen
- `fr` und `es` fallen bis zu eigenen Fixtures lexikalisch zurueck
- `it` faellt im verteilten MIT-Default lexikalisch zurueck, solange nur `it_core_news_sm` (CC BY-NC-SA 3.0) verfuegbar ist

### Modelllizenzen und Auslieferung

arsnova.eu bleibt MIT. Die spaCy-Modelle sind Drittwerk; es gibt keine App-Lizenz, die alle fuenf offiziellen Kernmodelle zu einem Open-Source-Paket vereinigt. Hinweise gehoeren in `NOTICE` beziehungsweise eine Drittlizenzseite, nicht ins Impressum oder in die Datenschutzerklaerung.

| Locale | Offizielles Modell | Lizenz          | MIT-Default (Compose/Standard-Image)                                                     |
| ------ | ------------------ | --------------- | ---------------------------------------------------------------------------------------- |
| `de`   | `de_core_news_sm`  | MIT             | ja                                                                                       |
| `en`   | `en_core_web_sm`   | MIT             | ja                                                                                       |
| `fr`   | `fr_core_news_sm`  | LGPL-LR         | ja, mit Namensnennung, Lizenztext und Ersetzbarkeit                                      |
| `es`   | `es_core_news_sm`  | GPL-3.0         | ja, als GPL-Drittteil gekennzeichnet; Image nicht als reines MIT ausweisen               |
| `it`   | `it_core_news_sm`  | CC BY-NC-SA 3.0 | **nein**; optional nur als klar getrenntes Extra fuer den eigenen altruistischen Betrieb |

### Betriebsmodell

spaCy kommt, wenn ueberhaupt, als **separater Sidecar-Service**:

- nicht im Angular-Frontend
- nicht als Python-Mix im Node-App-Container
- optional in `docker-compose`
- ansprechbar nur ueber das Backend

### Datenfluss

`Host-Daten holen -> Backend optional glaetten -> bestehende lexikalische Aggregation -> Renderer`

---

## Ist-Stand

| Bereich            | Status                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Freitext-Wolke** | laeuft fachlich lokal ueber `word-cloud-term.service.ts` und `word-cloud.util.ts` mit `de/en/fr/it/es`-Stopwortlogik                                                                             |
| **Q&A-Wolke**      | hat bereits einen hostseitigen Analysevertrag ueber `wordCloud.analyze` und erklaerbare Ergebnis-DTOs                                                                                            |
| **Shared Types**   | `normalization` `NONE`/`LEMMA`, `maxNgramLength` 1–3, angewandter Modus, Fallbackgrund, Analyseversion, `snapshotHash`; Lemma-Resolver für `de`/`en`; Text-/Item-Budgets                         |
| **Backend**        | Kill-Switch, Unix-Socket-Client, Identity-/Lemma-Normalizer; Lemma bei `LEXICAL` fuer `NOUN`/`VERB`/`ADJ`/`ADV`, Namen als Oberflaeche; harter Identity-Fallback; Redis-Text- und Snapshot-Cache |
| **Compose**        | Sidecar als Compose-Profil `nlp` (kein TCP, Limits, MIT `de`/`en`); `deploy.sh` startet ihn nicht; `NLP_ENABLED` Default `false`                                                                 |
| **UI**             | Q&A-Dialog und Freitext (kompakt plus In-Place-Maximize) mit Sekundaeraktion `Sprachformen glaetten`; neue Daten stale; Ansichts-/Sortwechsel bei aktiver Glaettung analysiert neu               |

---

## Architekturentscheidungen fuer die Umsetzung

### 1. Normalisierung ist eine zweite Achse neben dem Analysemodus

Die heutige Achse:

- `LEXICAL`
- `THEME`

wird ergaenzt um:

- `NONE`
- `LEMMA`

Wichtig:

- `LEXICAL + NONE` = heutiger Standard
- `LEXICAL + LEMMA` = spaCy-Glaettung; Freitext sendet `maxNgramLength` passend zur Ansicht (`1` Einzelwoerter, `3` Woerter & Phrasen)
- `THEME + NONE` = bestehender Themenpfad
- `THEME + LEMMA` = nicht Teil der ersten Story (`MODE_UNSUPPORTED`)

### 2. spaCy sitzt vor der Aggregation, nicht im Renderer

Die Glaettung liefert normalisierte Einheiten oder Tokens an die bestehende Aggregationslogik. Die Layout- und Dialog-Komponenten bleiben unveraendert Owner fuer:

- Darstellung
- Auswahl
- Tooltip
- CSV
- PNG

### 3. Snapshot statt Livepfad

Neue Daten starten keine automatische spaCy-Runde. Stattdessen:

- aktueller Snapshot analysieren
- Ergebnis cachen
- bei neuen Daten nur "veraltet" markieren

### 4. Feature Flag und harter Fallback

Die Einfuehrung braucht einen harten Betriebs-Schutz:

- `NLP_ENABLED` (nur `true` schaltet den Sidecar-Pfad ein; Default aus)
- `NLP_SOCKET_PATH` (interner Unix-Socket, analog PDF-Worker; kein oeffentlicher Port)
- `NLP_TIMEOUT_MS`
- `NLP_CACHE_TTL_SECONDS` (Redis-TTL fuer Text- und Snapshot-Cache; Default 1800 s)
- sauberer Fallback auf die heutige Wortwolke

---

## Betroffene Dateien

### Shared Types

- `libs/shared-types/src/schemas.ts`
- **neu:** `libs/shared-types/src/word-cloud-normalization.ts`

### Backend

- `apps/backend/src/routers/wordCloud.ts`
- `apps/backend/src/lib/wordCloudAnalysis.ts`
- **neu:** `apps/backend/src/lib/nlpSidecarConfig.ts`
- **neu:** `apps/backend/src/lib/wordCloudNormalization.ts`
- **neu (Phase 2):** `apps/backend/src/lib/wordCloudNormalizer.ts`
- **neu:** `apps/backend/src/lib/spacyClient.ts`
- **neu:** `apps/backend/src/lib/wordCloudAnalysisCache.ts`
- **neu:** `apps/backend/src/lib/wordCloudNlpTelemetry.ts`

### Frontend

- `apps/frontend/src/app/features/session/session-host/session-host.component.ts`
- `apps/frontend/src/app/features/session/session-host/qa-word-cloud-dialog.component.ts`
- `apps/frontend/src/app/features/session/session-host/qa-word-cloud-dialog.component.html`
- `apps/frontend/src/app/features/session/session-present/word-cloud.component.ts` (Freitext-Maximize in-place)
- `apps/frontend/src/app/features/session/session-present/word-cloud-term.service.ts`
- `apps/frontend/src/app/features/session/session-present/word-cloud.util.ts`

### Ops

- `docker-compose.yml`
- `docker-compose.prod.yml`
- `docker/spacy/` (Dockerfile, Server, MIT-NOTICE, Unittests)
- `NOTICE` (Drittmodelle `de`/`en`; `fr`/`es`/`it` nicht im Default)

### Tests

- `apps/backend/src/__tests__/wordCloud.analyze.test.ts`
- `apps/frontend/src/app/features/session/session-host/*.spec.ts`
- ggf. neue Backend-Tests fuer Cache/Fallback/Normalizer

---

## API-Zielbild

### Shared contract

Der Analysevertrag sollte um eine Normalisierungsachse erweitert werden:

```ts
normalization: 'NONE' | 'LEMMA';
normalizationApplied: 'NONE' | 'LEMMA';
fallbackUsed: boolean;
```

Empfohlen zusaetzlich:

```ts
fallbackLocale: 'de' | 'en' | 'fr' | 'it' | 'es';
stale: boolean;
```

### Wichtige Folgeentscheidung

Die heutige `WordCloudAnalysisLocaleEnum` ist backendseitig auf `de/en` begrenzt. Fuer diese Story sind zwei Stufen sinnvoll:

1. **MVP:** `de/en` fuer spaCy-Glaettung; `fr`/`es`/`it` bleiben lokal bzw. fallen auf `NONE` zurueck
2. **spaeter:** Vertrag fuer `fr`/`es` erweitern, sobald Fixtures und NOTICE-/GPL-Artefakte vorliegen; `it` nur mit lizenzkompatiblem Alternativmodell, nicht mit `it_core_news_sm` im MIT-Default

---

## Implementierungsstrategie

Die Umsetzung erfolgt in **7 Phasen**. Jede Phase soll:

- kompilierbar bleiben
- rueckbaubar bleiben
- den bisherigen Produktpfad nicht verschlechtern

---

## Phase 1: Vertrag, Scope und Feature Flag

Ziel: Shared contract und Betriebsgrenzen sauber festziehen.

### Aufgaben

| #   | Task                                      | Beschreibung                                                                                                       | Datei                              |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| 1.1 | **Normalisierungs-Enum einfuehren**       | `NONE` / `LEMMA` in `shared-types` definieren.                                                                     | `libs/shared-types/src/schemas.ts` |
| 1.2 | **Analyse-DTO erweitern**                 | `normalization`, `normalizationApplied`, ggf. `stale` und `fallbackLocale` aufnehmen.                              | `libs/shared-types/src/schemas.ts` |
| 1.3 | **MVP-Sprach- und Lizenzgrenze fixieren** | `de/en` als erste spaCy-Sprachen; `fr`/`es` lexikalischer Fallback bis Fixtures/NOTICE; `it` nicht im MIT-Default. | Doku + Runtime-Guard               |
| 1.4 | **Feature Flag einfuehren**               | `NLP_ENABLED`, `NLP_SOCKET_PATH`, `NLP_TIMEOUT_MS` definieren.                                                     | Backend Config                     |

### Ergebnis

- klarer Vertrag (`NONE`/`LEMMA`, angewandter Modus, Fallbackgrund, Analyseversion, Snapshot-Hash)
- klarer Betriebs-Schutz (`NLP_ENABLED`, Unix-Socket, Timeout)
- keine implizite spaCy-Abhaengigkeit; Lemma wird in Phase 1 nie angewandt

---

## Phase 2: Backend-Normalisierungsabstraktion

Ziel: spaCy sauber von der bisherigen Aggregation trennen.

### Aufgaben

| #   | Task                                | Beschreibung                                                                                                 | Datei                                         |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| 2.1 | **Normalizer-Interface einfuehren** | `IdentityNormalizer` und `LemmaNormalizer` mit einheitlichem Output.                                         | `apps/backend/src/lib/wordCloudNormalizer.ts` |
| 2.2 | **spaCy-Client kapseln**            | HTTP-Adapter fuer Sidecar mit Timeout, Fehlerbehandlung und Gesundheitspruefung.                             | `apps/backend/src/lib/spacyClient.ts`         |
| 2.3 | **Analysepfad vorbereiten**         | `wordCloudAnalysis.ts` so umbauen, dass Normalisierung vor der bisherigen Kandidatenbildung einhaengbar ist. | `apps/backend/src/lib/wordCloudAnalysis.ts`   |
| 2.4 | **Fallback sicherstellen**          | Bei Fehler, Timeout oder unsupported locale wird `IdentityNormalizer` verwendet.                             | `apps/backend/src/lib/wordCloudNormalizer.ts` |

### Ergebnis

- spaCy ist austauschbar
- der bestehende Pfad bleibt der technische Fallback

**Stand August 2026:** Phase 2 ist umgesetzt. Der Sidecar-Client spricht ausschließlich über `NLP_SOCKET_PATH`:

- `GET /health` → `200` oder `204`
- `POST /normalize` mit `{ locale, texts: [{ id, text }] }` → `{ locale, modelId, items: [{ id, tokens: [{ text, lemma, pos, entType? }] }] }`

Ohne lauschenden Sidecar bleibt `normalizationApplied` `NONE` (`SIDECAR_UNAVAILABLE`, `TIMEOUT` oder `INVALID_RESPONSE`). Das Sidecar-Image folgt in Phase 3.

---

## Phase 3: spaCy-Sidecar und Compose-Integration

Ziel: optionalen NLP-Service betriebsfaehig machen, ohne den App-Container aufzublaehen.

### Aufgaben

| #   | Task                           | Beschreibung                                                                                                    | Datei                     |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 3.1 | **Sidecar minimal definieren** | Service mit kleinem HTTP-API fuer Lemma/POS-Ausgabe aufsetzen.                                                  | neuer Service-Ordner      |
| 3.2 | **Nur noetige Daten ausgeben** | Token, Lemma, POS, optional Entity-Typ; keine semantischen Labels.                                              | Sidecar                   |
| 3.3 | **Compose optional erweitern** | `spacy`-Service in Dev und Prod nur als optionaler Zusatz.                                                      | `docker-compose*.yml`     |
| 3.4 | **Modelle bewusst begrenzen**  | Standard-Image `de/en`; `fr`/`es` nur mit NOTICE/GPL-Kennzeichnung; `it_core_news_sm` nicht im Default-Compose. | Sidecar + Doku + `NOTICE` |

### Ergebnis

- separater NLP-Dienst
- keine Vermischung mit dem Node-App-Image

**Stand August 2026:** Phase 3 ist umgesetzt. Image und API liegen unter `docker/spacy/`. Das Default-Image enthält `de_core_news_sm`/`en_core_web_sm` (MIT), `fr_core_news_sm` (LGPL-LR) und `es_core_news_sm` (GPL-3.0). `it_core_news_sm` ist nicht enthalten. Lizenztexte liegen unter `docker/spacy/licenses/`; das Image ist kein reines MIT. Start lokal mit `npm run docker:up:nlp`. Produktion bleibt aus, bis Compose-Profil `nlp` und `NLP_ENABLED=true` bewusst gesetzt werden.

---

## Phase 4: Q&A-Host-Integration

Ziel: Glaettung zuerst dort anbieten, wo der bestehende Host-Analysepfad schon existiert.

### Aufgaben

| #   | Task                           | Beschreibung                                                                                                  | Datei                              |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 4.1 | **Host-UI-Aktion einfuehren**  | Sekundaeraktion `Sprachformen glaetten` im Q&A-Wortwolken-Dialog.                                             | `qa-word-cloud-dialog.component.*` |
| 4.2 | **Snapshot-Anfrage erweitern** | Q&A-Analyseanforderung um `normalization` erweitern.                                                          | `session-host.component.ts`        |
| 4.3 | **Statuslogik einbauen**       | `Analyse laeuft`, `Glaettung aktiv`, `Neu analysieren`.                                                       | `session-host.component.ts` + HTML |
| 4.4 | **Stale state markieren**      | Bei neuen sichtbaren Fragen geglaetteten Snapshot als veraltet markieren, aber nicht automatisch neu rechnen. | `session-host.component.ts`        |

### Ergebnis

- erster produktiver Host-Pfad
- sauberer Nachweis, dass Glaettung ohne Live-Regressions laeuft

**Stand August 2026:** Phase 4 ist umgesetzt. Im Q&A-Wortwolken-Dialog gibt es die Sekundaeraktion `Sprachformen glaetten`. Ein Klick sendet `LEXICAL` + `LEMMA` an `wordCloud.analyze`; Dialog-Open und Theme-Refresh bleiben bei `NONE`. Neue sichtbare Fragen markieren den Snapshot als veraltet (`Neu analysieren`), rechnen aber nicht automatisch neu. `fr`/`es`/`it` zeigen `Glaettung nicht verfuegbar`. Freitext folgt in Phase 5.

---

## Phase 5: Freitext-Host-Integration

Ziel: denselben Glaettungsmechanismus fuer Freitext nutzbar machen.

### Aufgaben

| #   | Task                                     | Beschreibung                                                                                    | Datei                                                |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 5.1 | **Freitext-Host erweitern**              | dieselbe Sekundaeraktion in der kompakten Host-Ansicht und im In-Place-Maximize anbieten.       | `session-host.component.*`, `word-cloud.component.*` |
| 5.2 | **Backend-Analyse fuer Freitext nutzen** | bei `normalization = LEMMA` denselben Backend-Pfad statt der rein lokalen Extraktion verwenden. | `session-host.component.ts`                          |
| 5.3 | **Heutigen lokalen Standard behalten**   | ohne Glaettung bleibt Freitext lokal und schnell wie heute.                                     | `session-host.component.ts`                          |
| 5.4 | **Erklaerbarkeit sichern**               | Tooltip, CSV und Filter weiter mit lesbaren Labels und `members` betreiben.                     | bestehende Renderer                                  |

### Ergebnis

- beide Wortwolken profitieren
- lokaler `2.x`-Pfad bleibt unangetastet der Standard

**Stand August 2026:** Phase 5 ist umgesetzt. Die Freitext-Wortwolke bietet dieselbe Sekundaeraktion `Sprachformen glaetten` in der kompakten Host-Ansicht und im In-Place-Maximize derselben `app-word-cloud`-Instanz. Ohne Klick bleibt die lokale Extraktion unveraendert. Ein Klick sendet `LEXICAL` + `LEMMA` + `maxNgramLength` passend zur Ansicht (`1` fuer `Einzelwoerter`, `3` fuer `Woerter & Phrasen`) an `wordCloud.analyze`. Umschalten der Ansicht bei aktiver Glättung startet eine neue Analyse desselben Snapshots mit der anderen N-Gramm-Länge (Backend-Cache bleibt wirksam). Dieselbe adaptive `minDf` wie im lokalen `2.x`-Pfad (1 unter 15 Antworten, 2 unter 50, sonst 3) gilt fuer Unigramme und Phrasen, damit Einmal-Woerter die geglaettete Wolke nicht fuellen. Funktionswoerter (`nicht`, `sonst`, `dann`, …) kommen aus derselben `stopword`-Liste wie die lokale Wolke; Inhaltswoerter wie `Beispiel` bleiben ueber die Allowlist sichtbar. Lemma gilt fuer Nomen, Verben und Adjektive (`macht` → `machen`, `kurze` → `kurz`); sichtbar sind nach der Glättung aber nur nominale Unigramme (`NOUN`/`PROPN`/`NUM`/`X`) plus Nominalphrasen mit optionalem Adjektiv (`lineare Regression`). Verben, Adjektive und Komparative erscheinen nicht als Einzelwoerter. Substantivierte Infinitive wie `Lernen` bleiben sichtbar, auch wenn spaCy sie als `VERB` taggt. Eigennamen bleiben die Oberflaechenform. Der Stopwortfilter gilt fuer Lemma **und** gebeugte Oberflaeche. Eine leere Unigramm-Liste faellt nicht auf die lokale ungeglaettete Aggregation zurueck. Neue Antworten markieren den Snapshot als veraltet (`Neue Antworten seit letzter Glaettung`), rechnen aber nicht automatisch neu. Cache und Telemetrie folgen in Phase 6.

---

## Phase 6: Cache, Telemetrie und Betriebsgrenzen

Ziel: wiederholte Host-Analysen billig und beobachtbar machen.

### Aufgaben

| #   | Task                         | Beschreibung                                                                                                        | Datei             |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 6.1 | **Text-Cache einziehen**     | normalisierte Einzelttexte nach `locale + hash + version` puffern.                                                  | neuer Cache-Layer |
| 6.2 | **Snapshot-Cache einziehen** | komplette Analyseergebnisse nach `session + mode + metric + normalization + maxNgramLength + snapshotHash` puffern. | neuer Cache-Layer |
| 6.3 | **Timing messen**            | Dauer, Timeout, Fallback und Cache-Hit-Rate loggen.                                                                 | Backend           |
| 6.4 | **Betriebsbudget festlegen** | z. B. harte Timeouts und Request-Groessen begrenzen.                                                                | Backend Config    |

### Ergebnis

- wiederholte Host-Klicks bleiben billig
- der Sidecar wird nicht zum stillen Performance-Risiko

**Stand August 2026:** Phase 6 ist umgesetzt. Wiederholte `wordCloud.analyze`-Aufrufe mit identischem Host-Snapshot kommen aus dem Redis-Cache (`nlp:wc:snap:…`, plus Text-Cache `nlp:wc:text:{locale}:{version}:{sha256}`). Transiente Sidecar-Fehler (`TIMEOUT`, `SIDECAR_UNAVAILABLE`, `INVALID_RESPONSE`) werden nicht persistiert. `NLP_CACHE_TTL_SECONDS` default 1800 (60–28800). Telemetrie loggt Dauer, Fallback, Sidecar-Nutzung und Cache-Hits ohne Rohtexte und ohne Socketpfad. Tests nutzen einen Noop-Cache; Produktionspfad ist fail-open gegen Redis.

---

## Phase 7: Tests, Rollout und Härtung

Ziel: die Funktion ohne Regression freigeben.

### Technische Checks

| #   | Task                            | Beschreibung                                                               |
| --- | ------------------------------- | -------------------------------------------------------------------------- |
| 7.1 | **Shared-types und Typechecks** | alle Vertragsaenderungen kompilieren sauber                                |
| 7.2 | **Backend-Tests**               | Fallback, unsupported locale, Timeout, Cache und Label/Key-Trennung testen |
| 7.3 | **Frontend-Tests**              | Host-Trigger, stale marker, kein Auto-Recompute, Dialogzustand             |
| 7.4 | **Builds**                      | `build:localize`, relevante Tests, ggf. Compose-Smoke                      |

### Manuelle Abnahme

1. Q&A-Wortwolke ohne Glaettung bleibt identisch zum heutigen Stand
2. Q&A-Wortwolke mit Glaettung fuehrt sichtbare Flexionsformen zusammen
3. Freitext-Wortwolke ohne Glaettung bleibt identisch zum heutigen Stand
4. Freitext-Wortwolke mit Glaettung bleibt lesbar und erklaerbar
5. Neue Daten markieren den Stand als veraltet, aber rechnen nicht automatisch neu
6. Ausfall des Sidecars fuehrt nicht zu leerer oder kaputter Wortwolke

**Stand August 2026:** Phase 7 haertet den Slice. Kuratierte `de`/`en`/`fr`/`es`-Fixtures belegen Flexion, Eigennamen, Verb-/Nominalfamilie, Komposita/Tippfehler, technische Begriffe, Sprachmischung und bewusste Nicht-Zusammenfuehrung. Frontend-Tests decken Ausloesen, Pending (lexikalische Wolke bleibt), stale/`Neu analysieren`, explizite Wolkensprache (Host-UI-Default, Override, `it` bis zur Wahl) und Fehlerhinweis in Q&A und Freitext. Compose-Smoke (`npm run test:spacy-compose`) prueft Profil `nlp`, `network_mode: none` und getrennte `SPACY_IMAGE`. Sidecar-Unittests laufen ohne Modell-Download. Produktiv bleibt der Sidecar aus, bis Betreiber Image, Profil und `NLP_ENABLED=true` bewusst setzen; `deploy.sh` startet ihn nicht.

---

## Akzeptanzkriterien

1. Host kann in Q&A- und Freitext-Wortwolken `Sprachformen glaetten` explizit ausloesen.
2. Die heutige Wortwolke bleibt der Standard und der sichere Fallback.
3. Die Glaettung laeuft nur auf dem aktuellen Snapshot.
4. Neue Daten fuehren nur zu einem stale marker, nicht zu automatischer Neuanalyse. Host-Wechsel der Freitext-Ansicht oder der Q&A-Sortierung bei aktiver Glaettung analysieren denselben Stand neu.
5. Sichtbare Labels bleiben lesbar und muessen nicht die rohe Lemmaform zeigen.
6. Geschuetzte technische Begriffe bleiben unveraendert erhalten.
7. `de/en` funktionieren im MVP; `fr`/`es` fallen bis zur Freigabe auf `NONE` zurueck; `it` faellt im verteilten Default auf `NONE` zurueck.
8. Die Visualisierung bekommt weiterhin gewichtete Terme und analysiert keine Rohtexte selbst.

---

## Risiken

### 1. Modell-/Lizenzscope wird zu gross gezogen

Gegenmassnahme:

- MVP bewusst auf `de/en`
- `fr`/`es` nur mit NOTICE-/GPL-Artefakten und Fixtures
- `it_core_news_sm` nicht im MIT-Default; kein Relizenzieren von arsnova.eu, um NC/GPL zu „schlucken“

### 2. Host-UI wird technisch statt produktnah

Gegenmassnahme:

- Wording `Sprachformen glaetten`
- kein sichtbares `spaCy`-/`NLP`-Wording in der Hauptflaeche

### 3. spaCy verformt sichtbare Labels unnatuerlich

Gegenmassnahme:

- strikte Trennung von `key` und `label`
- haeufige Oberflaechenform bleibt Anzeigeform

### 4. Sidecar-Ausfall blockiert die Wortwolke

Gegenmassnahme:

- Timeout
- Feature Flag
- harter Fallback auf den bestehenden Pfad

---

## Empfohlene Lieferreihenfolge

1. **Q&A-MVP fuer `de/en`**
2. **Freitext-MVP fuer `de/en`**
3. **Cache und Telemetrie haerten**
4. **erst danach** pruefen, ob `fr`/`es` mit Fixtures und NOTICE-/GPL-Artefakten folgen; `it` nur mit lizenzkompatiblem Alternativmodell

---

## Entscheidungssatz

Die spaCy-Einfuehrung fuer `arsnova.eu` wird nur dann umgesetzt, wenn sie als **kleiner, host-ausgeloester, fallback-faehiger Qualitaetslayer** auf die bestehende Wortwolke aufgesetzt werden kann.

Sobald spaCy semantische Erwartungen, Live-Latenz oder einen breiten Modell-/Lizenzscope in den Produktkern hineinzieht, verlaesst die Umsetzung bewusst diesen Plan.

---

## Abschluss (August 2026)

Story 1.14b ist abgeschlossen. Phasen 1–7 sind im Repo, inklusive Host-UX-Nachschaerfung:

- Freitext-Maximize in-place (kein zweiter Dialog)
- Freitext-Ansichtswechsel bei aktiver Glaettung analysiert denselben Snapshot mit passender `maxNgramLength` neu
- Q&A-Sortwechsel bei `LEXICAL` + aktiver Glaettung analysiert mit der neuen Metrik neu
- `THEME + LEMMA` bleibt ununterstuetzt

Kanonische Produktdoku: `docs/features/word-cloud-spacy.md`. Semantische Themen bleiben Story 1.14c.
