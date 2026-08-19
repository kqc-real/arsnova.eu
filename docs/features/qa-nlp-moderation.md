<!-- markdownlint-disable MD013 -->

# Q&A-NLP-Kaskade für Moderationssignale (Story 8.9b)

**Zielgruppe:** Product Owner, Entwickler, Betrieb
**Stand:** 2026-08-19
**Status:** 🟡 Level-1-Gatekeeper und Level-2-k-NN-Fallback im Repo; Kill-Switch default aus; Hörsaal-Lastmessung vor produktiver Aktivierung offen
**Backlog:** Story 8.9b
**ADR:** [0032-optional-nlp-cascade-for-qa-moderation-signals.md](../architecture/decisions/0032-optional-nlp-cascade-for-qa-moderation-signals.md)

## Zweck

Die optionale Kaskade ergänzt den deterministischen Moderationskompass (Story 8.9a) um **Host-only Hilfssignale**: Kategorie (`content` / `organization` / `technical`), Unsicherheit und ruhige Zustände `pending` | `classified` | `uncertain` | `disabled` | `failed`.

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

Der Worker nutzt zuerst ein gehashtes Zeichen-n-Gramm- plus Wort-Unigramm-Naive-Bayes (`modelVersion: gatekeeper-hash-nb-v1`) auf dem kuratierten Seed in `qaNlpSeed.ts`. Training erfolgt einmal im Prozess aus dem Train-Split. Softmax ist temperiert (`T=2`), damit Konfidenzen nicht bei 1.0 kleben. Unsichere oder kurze Texte gehen in den Level-2-k-NN (siehe unten).

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

Wenn der Gatekeeper **nicht** early-exitet (Konfidenz ≥ `QA_NLP_MIN_CONFIDENCE`, Abstand der beiden Top-Klassen ≥ 0.22 **und** mindestens 6 Tokens), läuft ein In-Process-k-NN (`modelVersion: fallback-knn-v1`, k=5, Cosinus) im **selben gehashten n-Gramm-Raum**. Prototypen kommen aus Train-Split plus `prototype`-Beispielen (Slang, FR/ES/IT); das Gatekeeper-Train bleibt eingefroren.

Das ist die evaluierte Embedding-plus-Klassifikationslogik für ADR-0032 Level 2: dichte Nachbarn im Hash-Raum, ohne Transformer-Download. `multilingual-e5-*` bleibt Kandidat, falls ein späterer Hörsaal-Lasttest Qualität oder Latenz nicht trägt. Uneinigkeit zwischen akzeptiertem k-NN und Gatekeeper wird `uncertain`, außer der Gatekeeper liegt unter der Konfidenzschwelle.

Early-Exit, Timeout und Queue-Limit sind lokale Smokes (u. a. 200 Kaskaden-Snapshots unter 500 ms in Unit-Tests). Sie ersetzen **keinen** k6/Artillery-Hörsaallasttest.

## Telemetrie

Strukturierte Logs `qa_nlp:completed`, `qa_nlp:failed`, `qa_nlp:skipped` mit Queue-Länge, Latenz und Modellversion. In-Process-Zähler und Raten in `qa.nlpRuntime.metrics` (Host-only): Queue-Länge, letzte Latenz, Completed, Failed, Skipped, Early-Exit, Fallback, Unclassified sowie `earlyExitRate`, `fallbackRate`, `unclassifiedRate`. Unclassified zählt `uncertain`, `failed`, `disabled` und Ergebnisse ohne Kategorie.

## Kalibrierung und Seed-Qualität

Train-Split bleibt eingefroren (`gatekeeper-hash-nb-v1`). Das gelabelte Eval (ohne `ambiguous`) umfasst Tippfehler, Kurzfragen, Slang, Code-Switching, DE/EN und erweiterte FR/ES-Stichproben plus kleine IT-Stichprobe. Gold-Labels bei `ambiguous` sind Best-Effort und zählen nicht in F1.

Gemessen mit `npm run eval:qa-nlp -w @arsnova/backend` (2026-08-19, Seed im Repo):

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

Das Seed bleibt **keine** Freigabebasis für `QA_NLP_ENABLED=true`. Slang und Mehrdeutigkeit bleiben schwach; IT ist zu klein. Produktive Aktivierung braucht den Hörsaal-Lasttest.

## Nächster Slice

k6/Artillery-Q&A-Lastmessung gemäß ADR-0013/0025/0026/0032 vor produktiver Aktivierung. Story 8.9b bleibt offen, bis dieser Lasttest vorliegt.
