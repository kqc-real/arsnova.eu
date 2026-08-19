<!-- markdownlint-disable MD013 -->

# Q&A-NLP-Kaskade für Moderationssignale (Story 8.9b)

**Zielgruppe:** Product Owner, Entwickler, Betrieb
**Stand:** 2026-08-19
**Status:** 🟡 Gatekeeper (hashed n-Gramm-Naive-Bayes) auf kuratiertem Seed-Set; semantischer Fallback und Hörsaal-Lastmessung offen
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

Teilnehmer-DTOs enthalten kein `nlp`. Host/`moderatorView` sieht `nlp`, sobald `QA_NLP_ENABLED=true` oder ein nicht-`DISABLED`-Ergebnis vorliegt. `qa.nlpRuntime` liefert `{ enabled }` nur mit Host-Token.

## Gatekeeper

Der Worker nutzt ein gehashtes Zeichen-n-Gramm- plus Wort-Unigramm-Naive-Bayes (`modelVersion: gatekeeper-hash-nb-v1`) auf dem kuratierten Seed in `qaNlpSeed.ts`. Training erfolgt einmal im Prozess aus dem Train-Split. Softmax ist temperiert (`T=2`), damit Konfidenzen nicht bei 1.0 kleben.

Eine Keyword-Baseline dient nur dem Vergleich in der Evaluation, nicht dem Live-Pfad.

`npm run eval:qa-nlp -w @arsnova/backend` druckt Accuracy, Macro-F1, Confusion Matrix und Uncertain-Rate gegen den Eval-Split (ohne `ambiguous`). Das Seed-Set ist synthetisch-hörsaalnah und **keine** Freigabebasis für produktive Aktivierung.

Bestehende Fragen einer Session (Seeds, Altbestand) werden nicht automatisch nachklassifiziert. Lokal:

```bash
QA_NLP_ENABLED=true npm run start:prod
npm run apply:qa-nlp -w @arsnova/backend -- --code ABC123
```

`apply:qa-nlp` schreibt Gatekeeper-Ergebnisse direkt nach Prisma und umgeht `qa.submit`. Neue Einreichungen laufen über die Queue, sobald der Kill-Switch am Backend-Prozess `true` ist.

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

## Telemetrie

Strukturierte Logs `qa_nlp:completed`, `qa_nlp:failed`, `qa_nlp:skipped` mit Queue-Länge und Latenz. In-Process-Zähler: Queue-Länge, Enqueue, Skip, Completed, Failed, Unclassified.

## Nächster Slice

Semantischer Fallback (Level 2, ADR-0032), Kalibrierung gegen ein größeres gelabeltes Set, k6/Artillery-Lastmessung vor produktiver Aktivierung.
