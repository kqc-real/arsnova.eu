<!-- markdownlint-disable MD013 -->

# Q&A-NLP-Kaskade für Moderationssignale (Story 8.9b)

**Zielgruppe:** Product Owner, Entwickler, Betrieb
**Stand:** 2026-08-19
**Status:** 🟡 Vertrag, Queue und Stub umgesetzt; Klassifikator-Training offen
**Backlog:** Story 8.9b
**ADR:** [0032-optional-nlp-cascade-for-qa-moderation-signals.md](../architecture/decisions/0032-optional-nlp-cascade-for-qa-moderation-signals.md)

## Zweck

Die optionale Kaskade ergänzt den deterministischen Moderationskompass (Story 8.9a) um **Host-only Hilfssignale**: Kategorie (`content` / `organization` / `technical`), Unsicherheit und ruhige Zustände `pending` | `classified` | `uncertain` | `disabled` | `failed`.

Sie ist **kein** spaCy-Pfad. `NLP_ENABLED` bleibt Story 1.14b (Wortwolken-Lemmatisierung). 8.9b nutzt `QA_NLP_ENABLED`. Es gibt keine Vorarbeit für Story 1.14c: eigene Verträge, Queue und Modelllebenszyklus.

## Betriebsgrenzen

| Env                  | Default | Wirkung                                                                                             |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `QA_NLP_ENABLED`     | `false` | Nur exakt `true` aktiviert Enqueue nach `qa.submit`                                                 |
| `QA_NLP_TIMEOUT_MS`  | `2000`  | Hartes Inferenz-Timeout (200–15.000). Danach Persistenz `failed` (`stub:timeout`)                   |
| `QA_NLP_QUEUE_LIMIT` | `100`   | Wartende plus laufende Jobs (1–1.000). Überlast: Skip des neuen Jobs, Persistenz `stub:queue-limit` |
| `QA_NLP_CONCURRENCY` | `1`     | Parallele Jobs im Backend-Prozess (1–4)                                                             |

Drop-/Skip-Strategie: ein neuer Job über dem Limit wird **nicht** in die Queue gelegt. Die Frage bleibt nutzbar; der Host sieht `failed`. Es gibt kein Sampling anderer Jobs.

`qa.submit`, `qa.list` und `qa.onQuestionsUpdated` awaiten die Inferenz nicht. Nach erfolgreicher Persistenz wird nur `enqueueQaNlpJob` geplant.

## Snapshot und Persistenz

Der Analyse-Input enthält ausschließlich `text` (max. 500 Zeichen). Keine Tokens, IPs, Participant-IDs, Nicknames oder Session-IDs.

Persistiert werden nur Ergebnisfelder an `QaQuestion`: Status, optionale Kategorie, Konfidenz, Modellversion, Analysezeitpunkt. Roh-Snapshots werden nicht gespeichert.

Teilnehmer-DTOs enthalten kein `nlp`. Host/`moderatorView` sieht `nlp`, sobald `QA_NLP_ENABLED=true` oder ein nicht-`DISABLED`-Ergebnis vorliegt. `qa.nlpRuntime` liefert `{ enabled }` nur mit Host-Token.

## Stub-Worker

Ohne trainiertes Modell schreibt der Worker `status: disabled`, `modelVersion: stub`. Die Kompass-Statuszeile bleibt dann bei aktivem Flag auf der regelbasierten Basis (`rule-based`), nicht auf „KI-Analyse ist aus“.

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

Klassifizierte Fragen können als Themenquellen in der Karte **Themen** erscheinen. 8.9a-Karten bleiben der Fallback. Keine automatischen Pin-/Archiv-/Phasenaktionen.

## Telemetrie

Strukturierte Logs `qa_nlp:completed`, `qa_nlp:failed`, `qa_nlp:skipped` mit Queue-Länge und Latenz. In-Process-Zähler: Queue-Länge, Enqueue, Skip, Completed, Failed, Unclassified.

## Nächster Slice (nicht dieser)

Gatekeeper- und Fallback-Klassifikator, kuratiertes Seed-Set, Qualitäts-/Lastmessung vor produktiver Aktivierung. Training ist bewusst getrennt.
