<!-- markdownlint-disable MD013 -->

# Generative Moderationszusammenfassung (Story 8.9c)

**Zielgruppe:** Product Owner, Entwickler, Betrieb
**Stand:** 2026-08-20
**Status:** Slices 1–3 plus Loopback-Helfer und Snapshot-Ranking im Repo (Vertrag, Host-UI, privater HTTP-Adapter); Kill-Switch produktiv default aus; echtes LLM erst mit Story 1.14c
**Backlog:** Story 8.9c
**ADR:** [0032-optional-nlp-cascade-for-qa-moderation-signals.md](../architecture/decisions/0032-optional-nlp-cascade-for-qa-moderation-signals.md)

## Zweck

Optionale, **on-demand** Moderationszusammenfassung über dem deterministischen Kompass (Story 8.9a, [moderation-compass.md](moderation-compass.md)). Der Host erhält 2–4 quellengebundene Stichpunkte (Thema plus eine kurze Klausel), keine automatischen Aktionen und keine Bewertung einzelner Teilnehmender.

Sie ist **kein** spaCy-Pfad und **keine** Q&A-Klassifikation. `NLP_ENABLED` bleibt 1.14b, `QA_NLP_ENABLED` bleibt 8.9b. 8.9c nutzt `QA_SUMMARY_ENABLED`. Dieselbe private Inferenzserver-Rolle darf später Story 1.14c stellen; 8.9c besitzt nur den Zusammenfassungsvertrag.

## Betriebsgrenzen

| Env                          | Default   | Wirkung                                                                                                            |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| `QA_SUMMARY_ENABLED`         | `false`   | Nur exakt `true` zeigt den Host-Button und erlaubt `qa.requestSummary`                                             |
| `QA_SUMMARY_TIMEOUT_MS`      | `8000`    | Hartes Inferenz-Timeout (500–30.000). Danach `failed` (`stub:timeout`)                                             |
| `QA_SUMMARY_QUEUE_LIMIT`     | `8`       | Wartende plus laufende Jobs (1–32). Überlast: Skip, `failed` (`stub:queue-limit`)                                  |
| `QA_SUMMARY_CONCURRENCY`     | `1`       | Parallele Jobs im Backend-Prozess (1–2)                                                                            |
| `QA_SUMMARY_COOLDOWN_MS`     | `30000`   | Kein zweiter Job für denselben Snapshot-Hash innerhalb der Frist. `failed` (Timeout) darf sofort wiederholt werden |
| `QA_SUMMARY_TTL_MS`          | `1800000` | Ephemeres Ergebnis pro Session (60 s–8 h); keine Prisma-Spalte                                                     |
| `QA_SUMMARY_MAX_SOURCES`     | `20`      | Max. Q&A-Quellen im Snapshot (1–40)                                                                                |
| `QA_SUMMARY_INFERENCE_URL`   | leer      | Nur privater `http`/`https`-Endpunkt. Leer oder SaaS-Host → kein Cloud-Fallback, Status `failed`                   |
| `QA_SUMMARY_INFERENCE_TOKEN` | leer      | Optionaler Bearer-Token; nie in der URL                                                                            |

`qa.requestSummary` awaitet die Inferenz nicht. Das Ergebnis liegt in Memory bis TTL oder bis zur nächsten Anfrage.

## Vertrag

Status: `pending` | `ready` | `uncertain` | `disabled` | `failed`.

Aussagen sind `{ text, sourceIds }`. Quellen-IDs sind stabil (`qa-question:{uuid}`). Sätze ohne belegte Snapshot-Quelle werden verworfen; bleibt nichts übrig, wird der Status `uncertain`. Belegte Aussagen machen das Ergebnis `ready`, auch wenn das Modell selbst `uncertain` gemeldet hat. Adapterfehler (abgebrochener Body, ungültige Antwort) enden in `failed`, ohne die Queue zu werfen. Die Host-UI formatiert lange Protokollsätze zusätzlich als scanbare Stichpunkte (`Thema: Klausel`), ohne Klauseln an `und`/`von` abzuschneiden. Die Anzeigereihenfolge folgt der Snapshot-Rangfolge (angepinnt/ausstehend/Upvotes, dann mehr Quellen).

Host-only:

- `qa.summaryRuntime` — Kill-Switch, ob ein privater Endpoint konfiguriert ist, letztes Ergebnis
- `qa.requestSummary` — startet einen Job, kehrt sofort mit `pending` zurück

Teilnehmer-DTOs enthalten kein Summary-Feld. Der 8.9b-NLP-Snapshot bleibt ausschließlich `text`; der 8.9c-Snapshot enthält `locale` plus Quellen `{ id, kind, text }` ohne Nicknames, IPs, Tokens, Participant-IDs oder Session-IDs. Die Auswahl der bis zu `QA_SUMMARY_MAX_SOURCES` sichtbaren Fragen (`PENDING`/`ACTIVE`/`PINNED`) rangiert angepinnte und ausstehende vor reinem Upvote, fasst normalisierte Near-Duplicates auf eine kanonische Frage und darf 8.9b-`CLASSIFIED` nur als Tie-Break nutzen. `uncertain` bleibt im Pool. Status und NLP-Felder gehen nicht an das Modell.

## Host-UI

Im Moderationskompass erscheint der Button **Zusammenfassung** nur bei `QA_SUMMARY_ENABLED=true`. On demand, als zweite Ebene unter den Live-Signalkarten, mit dem Titel **Kurzfassung der offenen Fragen**. Der Button steht am Anfang dieses Blocks. Ein vorhandenes Ergebnis bleibt zugeklappt, bis der Host die Zusammenfassung anfordert; Aussagen erscheinen als scanbare Stichpunkte mit Themen-Lead. **Hinweise** stehen direkt unter den Punkten, Quellen hinter **Zugehörige Fragen (…)**. Identische Fehl- oder Unsicher-Meldungen erscheinen nur einmal, nicht zusätzlich unter Hinweise. KI-Vorschläge für nächste Schritte entfallen, wenn die Handlungszeile des Kompasses schon einen nächsten Schritt zeigt. Quellen-Klicks schließen den Dialog und springen zur Frage. Chrome ist XLF; bekannte Backend- und Helfer-Hinweise (leerer Snapshot, Timeout, unkonfiguriert, Gemini-Fehler, …) werden in der Host-UI über XLF umgeschrieben. Modelltext folgt `locale`. Kein Modellname in der Live-UI.

## Adapter ohne LLM-Lieferung

Ohne `QA_SUMMARY_INFERENCE_URL` bleibt der Kompass nutzbar; eine Anfrage endet in `failed` mit `stub:unconfigured`. Öffentliche SaaS-Hosts (`api.openai.com`, `api.anthropic.com`, …) werden abgelehnt. Lokal stellt `npm run qa-summary:dev` einen privaten Loopback-Endpunkt. Slice 4 (echtes Modell im Betrieb) folgt mit Story 1.14c auf demselben privaten Server, anderem Auftrag. Reihenfolge, Entkopplung der Verträge und Hardware-Isolation: [WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md](../implementation/WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md) §4.

## Lokal prüfen

Privater Loopback-Helfer (nicht Produktion, bindet nur `127.0.0.1`):

```bash
npm run qa-summary:dev
```

In `.env` (nicht `.env.production`):

```env
QA_SUMMARY_ENABLED=true
QA_SUMMARY_INFERENCE_URL=http://127.0.0.1:8787/summary
```

Backend nach Env-Änderung neu starten. Kompass-Button **Zusammenfassung** erscheint nur bei exakt `true`. Standardmodus ist lokal-extraktiv (kein Cloud). Optional `GEMINI_API_KEY` nur für den Helferprozess: arsnova spricht weiter `127.0.0.1`, der Helfer übersetzt nach Gemini (`GEMINI_MODEL`, Default `gemini-3.5-flash-lite`, Thinking `MINIMAL`). Dann verlassen Q&A-Texte den Rechner. Der Helfer bricht Gemini immer vor `QA_SUMMARY_TIMEOUT_MS` ab (5 s Vorsprung, bei kürzeren Timeouts mindestens 200 ms) und fällt auf die lokale Kurzfassung zurück, damit das Backend nicht mit `stub:timeout` endet. Ohne Env-Wert gilt der Backend-Default 8 s, der Helfer wartet dann 3 s. Lokal oft `QA_SUMMARY_TIMEOUT_MS=30000`. `QA_SUMMARY_DEV_MODE=extractive` erzwingt den lokalen Modus trotz Key.

App plus Helfer in einem Terminal: `npm run dev:qa-summary`. Hilfe: `npm run qa-summary:dev -- --help`. Tests: `npm run qa-summary:dev:test`.

```bash
npm test -w @arsnova/shared-types -- src/qa-summary.test.ts
npm test -w @arsnova/backend -- --run \
  src/lib/qaSummaryConfig.test.ts \
  src/lib/qaSummarySnapshot.test.ts \
  src/lib/qaSummaryValidate.test.ts \
  src/lib/qaSummaryAdapter.test.ts \
  src/lib/qaSummaryQueue.test.ts \
  src/__tests__/qa.summary.test.ts \
  src/__tests__/dto-security.test.ts
npm run test -w @arsnova/frontend -- \
  src/app/features/session/session-host/moderation-compass-dialog.component.spec.ts \
  src/app/features/session/session-host/session-host.component.spec.ts
```

Produktiv `QA_SUMMARY_ENABLED` nicht stillschweigend auf `true` setzen. Ohne privaten Inferenzserver gibt es keine Zusammenfassung.
