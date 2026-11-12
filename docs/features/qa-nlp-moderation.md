<!-- markdownlint-disable MD013 -->

# Q&A-NLP-Kaskade für Moderationssignale (Story 8.9b)

**Zielgruppe:** Product Owner, Entwickler, Betrieb
**Stand:** 2026-08-19
**Status:** ✅ Level-1-Gatekeeper, Level-2-k-NN-Fallback und lokaler k6/Artillery-Hörsaallast im Repo; Kill-Switch produktiv default aus
**Backlog:** Story 8.9b
**ADR:** [0032-optional-nlp-cascade-for-qa-moderation-signals.md](../architecture/decisions/0032-optional-nlp-cascade-for-qa-moderation-signals.md)

## Zweck

Die optionale Kaskade ergänzt den deterministischen Moderationskompass (Story 8.9a, [moderation-compass.md](moderation-compass.md)) um **Host-only Hilfssignale**: Kategorie (`content` / `organization` / `technical`), Unsicherheit und ruhige Zustände `pending` | `classified` | `uncertain` | `disabled` | `failed`.

Sie ist **kein** spaCy-Pfad. `NLP_ENABLED` bleibt Story 1.14b (Wortwolken-Lemmatisierung). 8.9b nutzt `QA_NLP_ENABLED`. Es gibt keine Vorarbeit für Story 1.14c: eigene Verträge, Queue und Modelllebenszyklus.

## Betriebsgrenzen

| Env                     | Default | Wirkung                                                                                             |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `QA_NLP_ENABLED`        | `false` | Nur exakt `true` aktiviert Enqueue nach `qa.submit`                                                 |
| `QA_NLP_TIMEOUT_MS`     | `2000`  | Hartes Inferenz-Timeout (200–15.000). Danach Persistenz `failed` (`stub:timeout`)                   |
| `QA_NLP_QUEUE_LIMIT`    | `100`   | Wartende plus laufende Jobs (1–1.000). Überlast: Skip des neuen Jobs, Persistenz `stub:queue-limit` |
| `QA_NLP_CONCURRENCY`    | `1`     | Parallele Jobs im Backend-Prozess (1–4)                                                             |
| `QA_NLP_MIN_CONFIDENCE` | `0.55`  | Unter dieser Softmax-Konfidenz (0.2–0.95) bleibt der Status `uncertain` (Best-Guess-Kategorie)      |

Drop-/Skip-Strategie: ein neuer Job über dem Limit wird **nicht** in die Queue gelegt. Die Frage bleibt nutzbar; der Host sieht `failed`. Es gibt kein Sampling anderer Jobs.

`qa.submit`, `qa.list` und `qa.onQuestionsUpdated` awaiten die Inferenz nicht. Nach erfolgreicher Persistenz wird nur `enqueueQaNlpJob` geplant.

## Snapshot und Persistenz

Der Analyse-Input enthält ausschließlich `text` (max. 500 Zeichen). Keine Tokens, IPs, Participant-IDs, Nicknames oder Session-IDs.

Persistiert werden nur Ergebnisfelder an `QaQuestion`: Status, optionale Kategorie, Konfidenz, Modellversion, Analysezeitpunkt. Roh-Snapshots werden nicht gespeichert.

Teilnehmer-DTOs enthalten kein `nlp`. Host/`moderatorView` sieht `nlp`, sobald `QA_NLP_ENABLED=true` oder ein nicht-`DISABLED`-Ergebnis vorliegt. `qa.nlpRuntime` liefert `{ enabled, metrics }` nur mit Host-Token.

## Gatekeeper

Der Worker nutzt zuerst ein gehashtes Zeichen-n-Gramm- plus Wort-Unigramm-Naive-Bayes (`modelVersion: gatekeeper-hash-nb-v3`). Training erfolgt einmal im Prozess aus dem Train-Split in `qaNlpSeed.ts`. Die Trainingsbasis umfasst `de`, `en`, `fr`, `es`, `it` und Sprachmischung. V3 verwendet 8.192 Hash-Buckets und Softmax mit `T=4`. Unsichere oder kurze Texte gehen in den Level-2-k-NN. Gespeicherte Ergebnisse behalten ihre Modellversion, bis sie ausdrücklich neu klassifiziert werden.

Eine Keyword-Baseline dient nur dem Vergleich in der Evaluation, nicht dem Live-Pfad.

`npm run eval:qa-nlp -w @arsnova/backend` druckt Accuracy, Macro-F1, Confusion Matrix, Slice-Metriken nach Tag/Locale und die Kalibrierkurve. Das Seed-Set ist synthetisch-hörsaalnah und **keine** Freigabebasis für produktive Aktivierung.

Bestehende Fragen einer Session (Seeds, Altbestand) werden nicht automatisch nachklassifiziert. Lokal:

```bash
QA_NLP_ENABLED=true npm run start:prod
npm run apply:qa-nlp -w @arsnova/backend -- --code ABC123
```

`apply:qa-nlp` schreibt Kaskaden-Ergebnisse (Gatekeeper plus Fallback) direkt nach Prisma und umgeht `qa.submit`. Neue Einreichungen laufen über die Queue, sobald der Kill-Switch am Backend-Prozess `true` ist.

Der Stub (`modelVersion: stub`) bleibt für Tests und Queue-Fehlerpräfixe (`stub:timeout`, `stub:queue-limit`).

## Host-UI

Dieselbe Kompass-UI, kein neuer Bildschirm. Statuszeile:

| Modus        | Bedeutung                                     |
| ------------ | --------------------------------------------- |
| `disabled`   | Kill-Switch aus                               |
| `pending`    | mindestens eine Frage in der Queue            |
| `failed`     | Timeout, Überlast oder Worker-Fehler          |
| `uncertain`  | Klassifikation unsicher                       |
| `classified` | mindestens eine Kategorie liegt vor           |
| `rule-based` | Flag an, aber noch keine belastbare Kategorie |

Klassifizierte Fragen erscheinen in der Karte **Häufige Themen** als Inhalt, Ablauf und Technik (mit Anzahl). Ein Tipp darauf hebt die passenden Q&A-Fragen mit Badge **Aus dem Kompass · Inhaltliche Fragen** (bzw. Ablauf/Technik) hervor. Andere Kompass-Sprünge nutzen dieselbe Badge-Form mit Karten- oder Begriffshinweis. 8.9a-Karten bleiben der Fallback. Keine automatischen Pin-/Archiv-/Phasenaktionen.

## Level 2 (k-NN-Fallback)

Wenn der Gatekeeper **nicht** early-exitet (Konfidenz ≥ `QA_NLP_MIN_CONFIDENCE`, Abstand der beiden Top-Klassen ≥ 0.22 **und** mindestens 6 Tokens), läuft ein In-Process-k-NN (`modelVersion: fallback-knn-v3`, k=5, Cosinus) im **selben gehashten n-Gramm-Raum**. Prototypen kommen aus Train-Split und `prototype`-Beispielen. Der Cosinus summiert nur über die belegten Merkmale der Anfrage. Eine Klassifikation braucht mindestens 0,60 Nachbarübereinstimmung und im Mittel mindestens 0,14 Ähnlichkeit für die gewählte Klasse.

Das ist die evaluierte Embedding-plus-Klassifikationslogik für ADR-0032 Level 2: dichte Nachbarn im Hash-Raum, ohne Transformer-Download. `multilingual-e5-*` bleibt Qualitätskandidat für Slang und Mehrdeutigkeit, kein Hotpath-Zwang nach dem Hörsaallasttest. Uneinigkeit zwischen akzeptiertem k-NN und Gatekeeper wird `uncertain`, außer der Gatekeeper liegt unter der Konfidenzschwelle.

Early-Exit, Timeout und Queue-Limit sind lokale Smokes (u. a. 200 Kaskaden-Snapshots unter 500 ms in Unit-Tests). Der Hörsaallasttest steht unten.

## Telemetrie

Strukturierte Logs `qa_nlp:completed`, `qa_nlp:failed`, `qa_nlp:skipped` mit Queue-Länge, Latenz und Modellversion. In-Process-Zähler und Raten in `qa.nlpRuntime.metrics` (Host-only): Queue-Länge, letzte Latenz, Completed, Failed, Skipped, Early-Exit, Fallback, Unclassified sowie `earlyExitRate`, `fallbackRate`, `unclassifiedRate`. Unclassified zählt `uncertain`, `failed`, `disabled` und Ergebnisse ohne Kategorie.

## Kalibrierung und Seed-Qualität

Die Evaluation meldet unter `localeHoldout` separat 15 synthetische Fälle pro App-Locale (fünf je Kategorie) und neun gemischtsprachige Fälle. Diese Texte fließen weder in Training noch in die Kalibrierkurve ein. Macro-F1 wertet unterlassene Klassifikationen als fehlende Treffer.

| Locale  | Korrekt / klassifiziert / Beispiele (V3) | Korrekt bezogen auf alle Beispiele |
| ------- | ---------------------------------------- | ---------------------------------- |
| `de`    | 13 / 15 / 15                             | 86,7 %                             |
| `en`    | 12 / 14 / 15                             | 80,0 %                             |
| `fr`    | 13 / 14 / 15                             | 86,7 %                             |
| `es`    | 13 / 14 / 15                             | 86,7 %                             |
| `it`    | 12 / 13 / 15                             | 80,0 %                             |
| `mixed` | 7 / 9 / 9                                | 77,8 %                             |

Die automatisierte Mindestquote von 80 Prozent zählt alle Prüffragen je App-Locale, einschließlich Enthaltungen. Der wiederverwendete Korpus ist ein synthetischer Regressionstest mit kleinen Stichproben. Für Aussagen über den Hörsaalbetrieb ist eine größere, unabhängig annotierte Stichprobe nötig.

Im lokalen Artillery-Lauf mit V3 schlossen bei 500 Joins, 500 Stimmen und 500 WebSocket-Verbindungen alle 100 Q&A-Klassifikationsaufträge ab. Ab 400 Joins liefen parallel Host-Analysen für die Wortwolke.

Historische V1-Messung mit `npm run eval:qa-nlp -w @arsnova/backend` (2026-08-19, ursprünglicher Seed):

| Kenngröße an `QA_NLP_MIN_CONFIDENCE=0.55` | Gatekeeper           | Kaskade                        |
| ----------------------------------------- | -------------------- | ------------------------------ |
| Gelabeltes Eval / Ambiguous               | 100 / 15             | 100 / 15                       |
| Classified-Accuracy                       | 0.84                 | 0.87                           |
| Classified-Coverage                       | 0.97                 | 0.85                           |
| Macro-F1 (Best-Guess, Gatekeeper)         | 0.82                 | —                              |
| Uncertain-Rate / Fallback-Rate            | 0.03                 | Fallback 0.51, Early-Exit 0.49 |
| Slang Classified-Accuracy                 | 0.67                 | 0.69                           |
| Tippfehler Classified-Accuracy            | —                    | 0.94                           |
| FR / ES (n=15 / 15) Classified-Accuracy   | —                    | 0.71 / 0.83                    |
| Ambiguous als `classified`                | 0.87 (Accuracy 0.38) | —                              |

Betriebspunkt: Default **0.55 bleibt**. Die niedrigste formale Schwelle mit Classified-Accuracy ≥ 0.80 wäre 0.20, filtert aber nichts (überconfidentes Softmax). Fallback-Budget für Level 2: Uncertain-Rate **0.30** auf dem Gatekeeper; das Budget ist auf diesem Seed **nicht** überschritten.

Das Seed bleibt **keine** alleinige Freigabebasis für `QA_NLP_ENABLED=true`. Slang und Mehrdeutigkeit bleiben schwach; IT ist zu klein. Der Kill-Switch bleibt in `.env.production.example` `false`; Aktivierung ist eine bewusste lokale oder betreiberseitige Entscheidung.

## Hörsaallast (lokal, 2026-08-19)

Gemessen gegen eine bereits gefüllte Live-Session im Status `RESULTS` (Q&A offen, Moderation an). `QA_NLP_ENABLED=true` nur im lokalen Backend-Prozess, nicht in der Produktionsvorlage. Artillery mit `SESSION_CODE` an die bestehende Session; Votes übersprungen, weil keine Vote-Frage aktiv war.

| Lauf                                                         | Ergebnis                                                                                                                                                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run load:k6:health`                                     | p95 3,8 ms, 0 % HTTP-Fehler                                                                                                                                                                               |
| `SESSION_CODE=… npm run load:k6:session` (50 VU)             | Join+Poll p95 4,8 ms                                                                                                                                                                                      |
| `MODE=join-wave VUS=500 npm run load:k6:hotpaths`            | Checks vollständig, 0 % HTTP-Fehler; p95 121 ms, p99 1,22 s, max 6,6 s. Teurer Hotpath: Nickname-Listen bei bereits mehreren tausend Teilnehmenden, nicht die NLP-Queue                                   |
| `SESSION_CODE=… PARTICIPANTS=500 npm run load:artillery:500` | 500/500 Joins, 500/500 WS, 100/100 `qa.submit`, 500 Blitzlicht; Join p95 19 ms, p99 35 ms; 0 VU-Fehler                                                                                                    |
| `qa.nlpRuntime` nach dem Artillery-Lauf                      | `completed` 100, `failed` 0, `skipped` 0, `earlyExitRate` 0,87, `fallbackRate` 0,13, `unclassifiedRate` 0,13, `queueLength` 0, `lastLatencyMs` 2. Logs: Inferenz typisch 1–3 ms, max 19 ms, Queue nie > 0 |
| Backend-RSS nach dem Lauf                                    | ca. 228 MiB für den Node-Child (`apps/backend/dist/index.js`)                                                                                                                                             |

`qa.submit` blieb nicht-blockierend: die 100 Einreichungen liefen mit, während der Worker die Jobs nacheinander (Concurrency 1) in wenigen Millisekunden abarbeitete. Kein `qa_nlp:skipped` / `qa_nlp:failed`.

Wiederholung an einer bestehenden Session:

```bash
SESSION_CODE=AB12CD PARTICIPANTS=500 npm run load:artillery:500
# vorhandenes Host-Token behalten:
HOST_TOKEN=… SESSION_CODE=AB12CD PARTICIPANTS=500 npm run load:artillery:500
```

Ohne `HOST_TOKEN` stellt der Runner ein neues Host-Token aus und ersetzt das bisherige in Redis.

## Nächster Slice

Story 8.9c (generative Moderationszusammenfassung) hat Vertrag, Host-UI und privaten Adapter ohne LLM; Kill-Switch default aus. Produktiv `QA_NLP_ENABLED` nicht stillschweigend auf `true` setzen; Slang-Qualität und ein Sentence-Transformer (`multilingual-e5-*`) bleiben optionale Folgearbeit, kein Hotpath-Zwang nach diesem Lasttest.
