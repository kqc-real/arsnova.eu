<!-- markdownlint-disable MD013 -->

# Generative Moderationszusammenfassung (Story 8.9c)

**Zielgruppe:** Product Owner, Entwickler, Betrieb
**Stand:** 2026-10-17
**Status:** Versionierter Summary-V2-Pfad (`qa-summary-technical-handoff-v2`, `qa-summary-model-output-v3`), private Runtimeübergabe, Kontextvorschau und extraktiver Backend-Fallback implementiert und auf dem privaten 8-vCPU-Produktionshost real vermessen (~56,9 s / 374 Completion-Tokens); Kill-Switches im Repo standardmäßig `false`
**Backlog:** Story 8.9c
**ADR:** [0032-optional-nlp-cascade-for-qa-moderation-signals.md](../architecture/decisions/0032-optional-nlp-cascade-for-qa-moderation-signals.md) (Kaskade), [0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md](../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md) (Slice-4-Runtime)

## Zweck

Optionale, **on-demand** Moderationszusammenfassung über dem deterministischen Kompass (Story 8.9a, [moderation-compass.md](moderation-compass.md)). Der Host erhält 2–4 quellengebundene Stichpunkte (Thema plus eine kurze Klausel), keine automatischen Aktionen und keine Bewertung einzelner Teilnehmender.

Sie ist **kein** spaCy-Pfad, **keine** Q&A-Klassifikation und **kein** Wortwolken-Themenmodus. `NLP_ENABLED` bleibt 1.14b, `QA_NLP_ENABLED` bleibt 8.9b, `WORD_CLOUD_SEMANTIC_ENABLED` bleibt 1.14c. 8.9c nutzt `QA_SUMMARY_ENABLED`; der generative V2-Modus benötigt zusätzlich die bewusst konfigurierte private Runtime hinter `OPEN_WEIGHT_LLM_ENABLED`. Stufe-1-Encoder und Summary besitzen getrennte Verträge, Queues und Fallbacks.

## Betriebsgrenzen

| Env                          | Default   | Wirkung                                                                                                                                                                                                               |
| ---------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `QA_SUMMARY_ENABLED`         | `false`   | Nur exakt `true` erlaubt die Host-Karte und `qa.requestSummary`; V2 kann auch ohne Inferenzserver den quellengebundenen extraktiven Backend-Fallback liefern                                                          |
| `QA_SUMMARY_TIMEOUT_MS`      | `90000`   | Queue-Wall-Clock (500–300.000 ms); bei aktivem Open-Weight-Full-Context effektiv `max` mit `OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS`; Legacy/disabled behalten den Queue-Wert; Timeout degradiert auf extraktiven Fallback |
| `QA_SUMMARY_QUEUE_LIMIT`     | `8`       | Wartende plus laufende Jobs (1–32). Überlast startet keinen Modelljob und liefert einen explizit als `queue_full` markierten extraktiven Fallback                                                                     |
| `QA_SUMMARY_CONCURRENCY`     | `1`       | Parallele Summary-Jobs im Backend-Prozess (1–2); der gemeinsame llama.cpp-Slot ist zusätzlich global auf einen Auftrag begrenzt                                                                                       |
| `QA_SUMMARY_COOLDOWN_MS`     | `30000`   | Kein zweiter Job für denselben Snapshot-Hash innerhalb der Frist. Manuell wiederholbare Fallbacks blockieren keinen ausdrücklichen Retry                                                                              |
| `QA_SUMMARY_TTL_MS`          | `1800000` | Ephemeres Ergebnis pro Session (60 s–8 h); keine Prisma-Spalte                                                                                                                                                        |
| `QA_SUMMARY_MAX_SOURCES`     | `20`      | Legacy-Snapshotgrenze für Q&A-Texte (3–40); der V2-Packer besitzt eigene Bereichs-, Quellen- und Budgetgrenzen                                                                                                        |
| `QA_SUMMARY_INFERENCE_URL`   | leer      | Privater Legacy-Endpunkt für `legacy-text`; nie direkt llama.cpp. Leer oder SaaS-Host aktiviert keinen Cloudpfad, V2 fällt lokal extraktiv zurück                                                                     |
| `QA_SUMMARY_INFERENCE_TOKEN` | leer      | Optionaler Bearer-Token nur für den privaten Legacy-Endpunkt; nie in der URL                                                                                                                                          |
| `OPEN_WEIGHT_LLM_ENABLED`    | `false`   | Getrennter Kill-Switch der privaten llama.cpp-Runtime; zusammen mit genau einem privaten Transport und Token Voraussetzung für den generativen `full-context`-Modus                                                   |

`qa.requestSummary` awaitet die Inferenz nicht. Das Ergebnis liegt in Memory bis TTL oder bis zur nächsten Anfrage.

## Vertrag

Status: `pending` | `ready` | `uncertain` | `disabled` | `failed`.

Der Legacy-Vertrag bleibt `QaSummaryInferenceRequestSchema` plus `QaSummaryModelOutputSchema`. V2 verwendet strikt getrennte Verträge für Anfrage, Modelloutput, UI-Ergebnis, Adapterfähigkeiten, Fallback und Vorschau. `QaSummaryInferenceRequestV2` bindet technische Instruktionsversion, Bedeutungslexikon, `ModerationPromptContextV1` und Outputvertrag. Das Runtime-DTO versucht V2 vor V1, weil ein Legacy-Parser unbekannte Felder sonst entfernen könnte.

Aussagen sind weiterhin `{ text, sourceIds }`; V2 erlaubt dabei typisierte Quellen für Q&A, semantische Themen, Quizfragen, Lernziele, freigegebene Ergebnisaggregate, Feedback und Kompasssignale. Jede verwendete ID muss im gepackten Quellenregister liegen. Fremde Referenzen werden entfernt; bleibt keine belegte Aussage, wird das Ergebnis `uncertain`. Ein `failed`-Output zeigt keine alten Quellen. Die Host-UI formatiert lange Protokollsätze zusätzlich als scanbare Stichpunkte (`Thema: Klausel`).

Host-only:

- `qa.summaryRuntime` — Kill-Switch, Adapterfähigkeiten, Inferenzkonfiguration und letztes V1-/V2-Ergebnis; vor Auslieferung wird ein fertiges V2-Ergebnis gegen einen frisch autorisierten Hash geprüft
- `qa.requestSummary` — startet einen Job (auch während der 14-tägigen Host-Nachbereitungsfrist bei aktiviertem Q&A-Kanal via `assertQaHostContentReadAllowed`), kehrt sofort mit `pending` zurück
- `qa.summaryContextPreview` — hostgeschützte, ausdrücklich geladene Diagnose desselben gepackten V2-Kontexts

Teilnehmer-DTOs enthalten kein Summary- oder Kontextfeld. V2 entsteht ausschließlich aus dem hostautorisierten N10–N12-Pfad; Tokens, IPs, Nicknames und Participant-IDs sind nicht zulässig. Nicht freigegebene Quizresultate und Lösungen gelangen nicht in den Live-Kontext. Der Lernziel-Vorbereitungsauftrag ist davon getrennt und darf lösungshaltige Quizdaten nur nach der eigenen ausdrücklichen Hostaktion verwenden.

## Host-UI

Im Moderationskompass erscheint der Block **Kurzfassung der offenen Fragen**, wenn `QA_SUMMARY_ENABLED=true`, mindestens drei sichtbare Q&A-Beiträge (`PENDING`/`ACTIVE`/`PINNED`) vorliegen und entweder ein Adapter oder der lokale V2-Fallback verfügbar ist. Ein `pending`- oder `ready`-Ergebnis bleibt sichtbar, auch wenn die Zahl danach unter drei fällt; eine neue Anfrage startet in dem Fall nicht. Es gibt keinen Live-Ping und keinen automatischen Modellauftrag. Der Button **Zusammenfassung** steht am Anfang dieses Blocks. Ein vorhandenes Ergebnis bleibt zugeklappt, bis der Host es anfordert; Aussagen erscheinen als scanbare Stichpunkte mit Themen-Lead. **Hinweise** stehen direkt unter den Punkten. V2 nennt die aufgelösten Quellen **Belege**, der Legacy-Vertrag weiterhin **Zugehörige Fragen**. Nur Q&A-Fragen sind Sprungziele; Aggregate und andere V2-Belegarten bleiben semantisch beschrifteter statischer Nachweis.

Die native, standardmäßig geschlossene **Diagnose** lädt nicht beim Öffnen oder Aufklappen. Erst **Kontextvorschau laden** ruft `qa.summaryContextPreview` auf. Pending-, Fehler- und Retryzustand werden zugänglich angekündigt, ohne den Fokus zu stehlen. Die Vorschau zeigt Versionen, Modus/Fallback, Cache, Bereichszustände und -mengen, Quellarten, Budget sowie Kürzungs-/Grenzcodes. Sie zeigt weder die technischen Systemtexte noch vollständige Quellenlabels oder kanonisches Modell-JSON. Ein nach Dialogschluss, Sessionwechsel oder Rechteentzug eintreffendes Ergebnis wird verworfen.

## Adapter, Fallback und Lebenszyklus

Die Adapterwahl ist ausdrücklich und nachvollziehbar:

1. Private Runtime aktiviert, privater Transport und Token gültig: `full-context` mit V2-Anfrage und V2-Ausgabeschema.
2. Andernfalls private `QA_SUMMARY_INFERENCE_URL` gesetzt: `legacy-text`; der V2-Ergebnisvertrag weist den Kompatibilitätsfallback aus.
3. Kein kompatibler Adapter: lokaler, deterministischer `extractive`-Fallback aus dem gepackten V2-Quellenregister.

Öffentliche SaaS-Ziele werden abgelehnt. Die Legacy-URL wird nie auf llama.cpp `/v1/chat/completions` umgelegt; `openWeightLlmClient` übersetzt den V2-Vertrag. Der extraktive Fallback lebt in der Backend-Queue und ist in allen fünf Locales quellengebunden. Timeout, voller Queue, belegter Runtime-Slot, ungültige Antwort oder während des Auftrags veränderte Quellen führen nicht zu einer leeren Modellkarte, sondern zu einem typisierten Fallback. Rechteentzug liefert dagegen keine alten Quellen.

Vor dem Modelllauf baut die Queue den Kontext frisch auf; danach folgen derselbe erneute Kontextaufbau und ein Hashvergleich. Eine Quellenänderung verwirft die Modellantwort und bindet den Fallback an den neuen Stand. `summaryRuntime` prüft fertige Ergebnisse vor der nächsten Auslieferung erneut. Session-Purge löscht Ergebnis, Warteschlangeneintrag und flüchtiges Host-Credential und bricht einen laufenden Auftrag ab.

Das technische Profil verwendet 8.192 konservative Budgeteinheiten, 640 Antwortreserve und 128 Sicherheitsmarge (unter dem praxisnahen 8k-Arbeitsfenster von Qwen3-4B Q4; nie Modelldefault). Passen Basismetadaten trotzdem nicht, degradiert der Packer sichtbar auf eine Q&A-Textbaseline bzw. Force-Fit-Mindestbelege. Das ist ein sicherer Betriebszustand, aber **keine bestandene Full-context- oder CPU-Prefill-Abnahme**. Details und offene Nachweise stehen in [Issue #456 – Slice-8-Abnahme](../implementation/ISSUE-456-SLICE-8-ABNAHME.md).

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

Backend nach Env-Änderung neu starten. Dieser Helfer prüft bewusst den `legacy-text`-Pfad. Optional `GEMINI_API_KEY` nur für den Helferprozess: arsnova spricht weiter `127.0.0.1`, der Helfer übersetzt nach Gemini (`GEMINI_MODEL`, Default `gemini-3.5-flash-lite`, Thinking `MINIMAL`). Dann verlassen Q&A-Texte den Rechner; das ist kein Produktivpfad. `QA_SUMMARY_DEV_MODE=extractive` erzwingt den lokalen Helfermodus trotz Key.

Den neuen lokalen Backend-Fallback prüft man ohne Inferenz-URL:

```env
QA_SUMMARY_ENABLED=true
QA_SUMMARY_INFERENCE_URL=
OPEN_WEIGHT_LLM_ENABLED=false
```

App plus Helfer in einem Terminal: `npm run dev:qa-summary`. Hilfe: `npm run qa-summary:dev -- --help`. Tests: `npm run qa-summary:dev:test`.

```bash
npm test -w @arsnova/shared-types -- --run \
  src/qa-summary.test.ts \
  src/qa-summary-v2.test.ts \
  src/qa-summary-visibility.test.ts
npm test -w @arsnova/backend -- --run \
  src/lib/moderationSummaryContext.test.ts \
  src/lib/openWeightLlmClient.test.ts \
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

Produktiv weder `QA_SUMMARY_ENABLED` noch `OPEN_WEIGHT_LLM_ENABLED` stillschweigend auf `true` setzen. Der lokale extraktive Modus ist eine sichere Degradation, keine generative Freigabe. `OPEN_WEIGHT_LLM_ENABLED` schaltet den Themenmodus nicht ab; Runtime-Betrieb und Grenzen stehen in [open-weight-llm-runtime.md](open-weight-llm-runtime.md).

## Versionierter Moderationskontext aus Issue #456

[Issue #456](https://github.com/kqc-real/arsnova.eu/issues/456) liefert den versionierten Shared-Vertrag, hostautorisierten Gesamtbuilder, deterministischen Packer/Hash/Cache, die getrennte Lernzielvorbereitung sowie den V2-Adapter- und Vorschaupfad. Integrationsgrenzen und Zustände stehen in [moderation-prompt-context.md](moderation-prompt-context.md); die Datenhaltung regelt [ADR-0036](../architecture/decisions/0036-learning-objective-storage-and-live-projection.md).

Runtime R ist in die Summary-Queue verdrahtet, bleibt aber produktiv deaktiviert. Der reale Runtime-Nachweis umfasst bislang nur einen kurzen `topic_label`-Auftrag. Für `qa_summary` V2 und `learning_objectives` fehlen der reale Lauf auf der vorgesehenen Hardware sowie CPU-/Prefill-/RSS-Werte. Zudem bleibt die Prefill-/RSS-Abnahme des 8.192-Profils für den reichhaltigen Vollkontext offen. Diese Blocker sind in der [Slice-8-Abnahme](../implementation/ISSUE-456-SLICE-8-ABNAHME.md) ausdrücklich offen; kein Flag wird durch die Integration aktiviert.
