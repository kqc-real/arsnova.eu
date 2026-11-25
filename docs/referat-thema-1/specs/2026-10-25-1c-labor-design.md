# Design: 1C Laborlauf – Kontextpfad bis zur ausgelieferten privaten Runtime

> **Freigegeben vom Autor am 2026-11-04** (Fragen A1–A4 wie in Abschnitt 11 entschieden). Ab
> hier gelten Hypothesen, Kriterien, Wiederholungen und Entscheidungsregeln als vorab festgelegt.
> Gemessen ist noch nichts; die Trockenläufe gegen die Test-Runtime (Abschnitt 10) prüfen nur das
> Messwerkzeug, die einzelne Kalibrierungsanfrage (Abschnitt 10.1) wird nicht ausgewertet. Ein
> Hinweis zur Vorabfestlegung steht in Abschnitt 10.1.
>
> **Überarbeitet 2026-11-04, noch vor der Freigabe:** Der Prüfer hat die Fragen P1–P3 per E-Mail
> beantwortet (Abschnitt 11). Laborinstanz ist der eigene Rechner, Referenzstand der aktuelle
> `main`. Was sich dadurch geändert hat, steht in Abschnitt 13.

- **Stand:** 2026-10-25, überarbeitet 2026-11-04
- **Autor:** Jonas Weirauch (Rolle Y)
- **Issue:** [#10](https://github.com/NiklasSkulll/arsnova.eu/issues/10), Schritt 2
- **Branch:** `feature-1C-context-path`
- **Codebasis:** aktueller `main` (Abschnitt 3.3). Werkzeug geschrieben auf `main` `248029dc` plus diesem Branch; seit 2026-11-04 läuft der Branch auf `kqc-real/main` `9f230abc` (Merge `70c74002`, davor `cf522c63` mit Merge `533b1100`). Abweichungen zu `248029dc`: Abschnitt 3.4.
- **Vorgänger:** [Teil 2](2026-10-24-1c-teil2-design.md) (E1–E9, M1–M5, V1), [Teil 3](2026-10-24-1c-teil3-design.md) (E10–E15, M6, M7). Fixture, Auswertung und Rollenlogik der Kontextaufbauten werden wiederverwendet.
- **KI-Nutzung:** Entwurf mit Claude Code (Abschnitt 12).

## 1. Zweck

Auftrag 1C, Punkt 2 (Prüfungsdokument 4.3) verlangt, einen realen Auftrag durch die versionierten Verträge **bis zur privaten Runtime** zu verfolgen und für denselben Revisionsstand Host-Vorschau und gepackte Nutzlast zu vergleichen. Issue #10, Schritt 2, ergänzt: Baseline nach Dossier §11.2, `messages[2]` gegen den kanonischen Kontext der Vorschau, `max_tokens`, und `usage.prompt_tokens` gegen `budget.packedInputTokens`.

Teil 2 und 3 haben das nur bis zu einer **Test-Runtime** auf 127.0.0.1 gezeigt (E1, E3, E15). Offen ist laut [`1C/1C-diagrams.md`](../1C/1C-diagrams.md#task-coverage-exam-document-43-1c) allein der Lauf gegen die ausgelieferte Runtime. Dieser Laborlauf ist die **unveränderte eigene Baseline** mit der ausgelieferten Runtime (gepinntes llama.cpp-Basisimage, gepinntes GGUF, Release-Einstellungen) auf dem lokalen Laborpfad des Repositorys (Abschnitt 3.1). Er liefert zugleich die reale Inferenzzeit, die Teil 2 nur durch D = 2000 ms ersetzt hat.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**

- L1–L4 (Abschnitt 5) auf der Laborinstanz (eigener Rechner) gegen die gepinnte Runtime, mit Rohdaten im Evidenzordner.
- Optional L5: Befund T3.1 (zeitabhängiger Hash bei live Blitzlicht-Runde) auf dem echten Pfad.
- Eine Einordnung der Entscheidungen aus Teil 2 und 3 mit realen Zeiten, nach vorab festgelegten Regeln.

**Nicht-Ziele**

- Keine Änderung am Produktivcode und keine Änderung am Vertrag; auch keine Negativprobe auf der echten Runtime (E4, E6, E10 bleiben bei der Test-Runtime).
- Keine Aussage über Prompt- oder Antwortqualität (Gültigkeitsgrenze 1C, Thema 2).
- Keine Last- oder Kapazitätsmessung (Thema 3) und keine Rückwirkung auf Liveaktionen (1A, 1B Schritte 3–4).
- Kein Modelllauf gegen Produktion oder den Produktions-Inferenzhost. Der Modelllauf findet auf dem eigenen Rechner statt; das ist laut Prüfer die Laborinstanz (Abschnitt 11). Bis 2026-11-04 stand hier „kein Modelllauf lokal“, weil eine bereitgestellte Laborinstanz erwartet wurde.

**Anti-Ziele**

- Den Trockenlauf gegen die Test-Runtime als Evidenz ausgeben.
- Ein Secret (Runtime-Token, `.env.llm`) in Rohdaten, Commits, Protokoll oder Prompts.
- Kriterien nach Sicht der Labordaten ändern, ohne das als nachträglich zu kennzeichnen.

## 3. Aufbau

### 3.1 Topologie

```text
Eigener Rechner (Laborinstanz laut Prüfer), alles an Loopback
┌──────────────────────────────────────────────────────────────────────────────┐
│ vitest: qa.summary-labor.pg.test.ts          open-weight-llm-http (Compose-  │
│  tRPC-Router → Queue → Kontextaufbau         Profil llm-http, Hostnetz)      │
│  → Open-Weight-Client                        llama-server b10524, --api-key, │
│  → http://127.0.0.1:<p>  Aufzeichnungs-Proxy ─ HTTP → 127.0.0.1:8080         │
│ Postgres + Redis nur für den Lauf            Qwen3-4B Q4_K_M (SHA geprüft)   │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Runtime:** der lokale Laborpfad des Repositorys, `npm run docker:up:llm:http` (Profil `llm-http` in `docker-compose.yml`, Anleitung in [`docs/onboarding.md`](../../onboarding.md#optional-lokale-text-ki-qwen3-4b), Vertrag in [`open-weight-llm-runtime.md`](../../features/open-weight-llm-runtime.md#same-host-labor)). Gleich wie beim ausgelieferten Inferenz-Host sind Image-Rezept und Entry-Point (`docker/open-weight-llm/`, Basisimage `llama.cpp:server-b10524` per Digest gepinnt), GGUF mit SHA-Prüfung im Entry-Point, `--parallel 1`, `--ctx-size 8192`, `--n-predict 768`, `--slots`, `--api-key`. Anders: das Image wird lokal gebaut (Tag `arsnova-open-weight-llm:llama-b10524`, keine Registry-Digest-Referenz), die Runtime bindet an `127.0.0.1` statt an eine private RFC1918-Adresse, und der Container ist auf 4 CPUs, 5 GiB und 4 Threads begrenzt statt auf 8 CPUs, 8 GiB und 8 Threads (`docker-compose.llm.yml`). Der Produktionswrapper `npm run llm:prod` lehnt Loopback ab und ist deshalb nicht der Laborpfad.
- **Laufprozess:** Vitest mit dem Backend-Code des Referenzstands, echter tRPC-Router über `createCaller`, echte Queue, echter Kontextaufbau, echter Client, echtes HTTP. Gemockt ist nur die Host-Tokenprüfung, wie in allen E-Tests. Eigene PostgreSQL- und Redis-Instanz nur für den Lauf.
- **Ein Rechner statt zwei Hosts:** Laufprozess und Runtime teilen sich CPU und Speicher. Der Laufprozess ist zwischen den Runtime-Aufrufen fast untätig, sein Kontextaufbau läuft aber vor und nach dem Aufruf mit, während die Runtime noch rechnen oder schon fertig sein kann. Das ist eine Gültigkeitsgrenze für die Zeiten (Abschnitt 7), keine für L1 und L2.
- **Beobachtung des rohen Bodys ohne Produktionseingriff:** Der Client wird per Env auf einen Proxy in `apps/backend/src/__tests__/lib/recording-proxy.ts` gerichtet. Loopback gilt im Client als privat (`isPrivateOpenWeightLlmAddress`). Der Proxy puffert Anfrage und Antwort, leitet **dieselben Bytes** weiter, setzt nur `host` auf die Runtime und entfernt hop-by-hop-Header. Er zeichnet beide Bodys, Zeitpunkte und SHA-256-Summen auf, vom `authorization`-Header nur „vorhanden“ und „entspricht dem erwarteten Token“. Weil der Client die Privatheitsprüfung jetzt gegen den Proxy macht, prüft die Harness die Runtime-URL selbst mit derselben Regel (nur private Adressen) und bricht sonst vor dem Lauf ab.
- **Gegenprobe ohne Proxy:** 5 Läufe direkt gegen die Runtime (nur Zeiten und Status), um den Zeitanteil des Proxys abzuschätzen.

**Alternative (nicht gewählt, Frage P3):** die App selbst per `OPEN_WEIGHT_LLM_URL` auf einen Proxy richten und über die UI auslösen. Das prüft zusätzlich HTTP-tRPC, braucht aber einen Host-Token und einen separaten Proxyprozess. Die Harness prüft denselben Code mit derselben Fixture wie Teil 2 und 3 und ist dadurch direkt vergleichbar.

### 3.2 Umgebungsvariablen

Nur Namen; Werte kommen aus der lokalen Laborumgebung. Das Token wird für den Lauf lokal erzeugt und steht nur in der Shell-Umgebung ([Runbook](../evidenz/1C/labor-runbook.md)).

| Variable                                                          | Pflicht            | Bedeutung                                                                                                              |
| ----------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `RUN_QA_SUMMARY_LABOR`                                            | ja (`1`)           | Opt-in; ohne Flag wird die Datei übersprungen                                                                          |
| `DATABASE_URL`, `REDIS_URL`                                       | ja                 | Lauf-eigene Datenbank (migriert auf den Referenzstand) und Redis                                                       |
| `QA_SUMMARY_LABOR_OUT`                                            | ja                 | Zielpfad der JSON-Datei                                                                                                |
| `QA_SUMMARY_LABOR_RUNTIME_URL`                                    | ja                 | Basis-URL der Runtime, lokal `http://127.0.0.1:8080`; muss privat auflösen (Loopback gilt)                             |
| `QA_SUMMARY_LABOR_RUNTIME_TOKEN`                                  | ja                 | Bearer-Token der Runtime (32–512 URL-sichere Zeichen); wird nicht aufgezeichnet                                        |
| `QA_SUMMARY_LABOR_BASELINE`                                       | empfohlen          | Bezeichnung des Referenzstands, `main@<sha>` des upstream-`main` im Branch                                             |
| `QA_SUMMARY_LABOR_GIT_SHA`, `…_GIT_DIRTY`                         | empfohlen          | Commit des Laufprozesses und ob der Checkout sauber war                                                                |
| `QA_SUMMARY_LABOR_RUNTIME_IMAGE`                                  | empfohlen          | Lokal gebautes Image als `<tag>@sha256:<Image-ID>` (keine Registry-Digest-Referenz, Runbook 2)                         |
| `QA_SUMMARY_LABOR_MODEL_SHA256`                                   | empfohlen          | `sha256sum` der lokalen GGUF-Datei; wird gegen `OPEN_WEIGHT_LLM_MODEL_ID` geprüft                                      |
| `QA_SUMMARY_LABOR_RUNS`, `…_WARMUP`, `…_DIRECT_RUNS`, `…_L5_RUNS` | nein               | Standard 20, 1, 5, 0; Abweichungen nur für Trockenläufe, im JSON vermerkt                                              |
| `QA_SUMMARY_LABOR_FAKE_RUNTIME`                                   | nur Trockenlauf    | `1` startet die In-Prozess-Test-Runtime statt der echten; JSON `dryRun: true`                                          |
| `QA_SUMMARY_LABOR_TIMEOUT_MS`                                     | ja für diesen Lauf | Queue- und Client-Timeout; Standard 90 000 (Release), Bereich 1 000–300 000 (Produktgrenzen); dieser Lauf 300 000 (A4) |

Die Harness setzt für den Prozess selbst: `OPEN_WEIGHT_LLM_ENABLED=true`, `OPEN_WEIGHT_LLM_URL` = Proxy, `OPEN_WEIGHT_LLM_TOKEN` = Runtime-Token, `QA_SUMMARY_ENABLED=true`, `WORD_CLOUD_SEMANTIC_ENABLED=false` (L5: `true`), `QA_SUMMARY_TIMEOUT_MS` und `OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS` = `QA_SUMMARY_LABOR_TIMEOUT_MS` (Standard 90 000 ms, der Release-Standard am Werkzeugstand; das JSON vermerkt `timeoutMs`, `releaseTimeoutMs` und `timeoutDeviatesFromRelease`). Fehlt eine Pflichtvariable, bricht der Lauf vor jedem Auftrag mit einer Liste ab.

### 3.3 Referenzstand und Manifest

Aufgezeichnet wird, was den Stand eindeutig macht:

| Was                                              | Quelle                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Commit und Bezeichnung des Laufprozesses         | `QA_SUMMARY_LABOR_GIT_SHA`, `…_BASELINE`, `…_GIT_DIRTY`                                                                   |
| Gepinnte Erwartung im Code                       | `OPEN_WEIGHT_LLM_MODEL_ID` (GGUF-SHA), `OPEN_WEIGHT_LLM_MODEL_VERSION` (`llama:server-b10524`)                            |
| Runtime-Image und GGUF-Prüfsumme                 | lokal abgelesen (`docker image inspect`, `sha256sum`) und per Env übergeben                                               |
| Build, Modellpfad, Kontextgröße, Slots, Template | `GET /props`: `build_info`, `model_path`, `default_generation_settings.n_ctx`, `total_slots`, SHA-256 von `chat_template` |
| Modellkennung                                    | `GET /v1/models`: `data[].id` (Alias) und `meta`; je Antwort `model` und `system_fingerprint`                             |
| Unverändertheit während des Laufs                | dieselben Abrufe vor und nach dem Lauf; die Auswertung vergleicht sie                                                     |

Geprüft: Feldnamen von `/props`, `/v1/models`, `usage` und `timings` laut llama.cpp-Server-README (Context7, Stand `master`). Für b10524 belegt die protokollierte Modellprüfung vom 2026-10-05 in [`open-weight-llm-runtime.md`](../../features/open-weight-llm-runtime.md#vollständig-protokollierte-lokale-modellprüfung-vom-2026-10-05) `usage`, `timings` und `system_fingerprint` (`b10524-9ee9fc04c`) und dass `usage.prompt_tokens` den Cache einschließt (143 = 142 aus dem Cache + 1). Die Felder von `/props` und `/v1/models` sind für b10524 **nicht** geprüft; fehlende Felder werden als `null` aufgezeichnet. Keine API liefert die GGUF-Prüfsumme; deshalb die eigene Ablesung plus die SHA-Prüfung des Entry-Points.

**Referenzstand `main`:** entschieden (Frage P1, Abschnitt 11). Gemessen wird der aktuelle upstream-`main`, den der Branch per Merge enthält, nicht `v1.3.0` (`87c39334`). Eine Rückportierung der Harness entfällt. Unmittelbar vor dem Lauf werden Fork und Clone erneut auf upstream gebracht (Runbook 3); der tatsächlich gemessene Commit steht im JSON. Das Ergebnis gilt nur für diesen Stand.

### 3.4 Abweichungen des Referenzstands gegenüber `248029dc`

Teil 1–3 sind an `248029dc` gebunden und bleiben dort gültig. Für den Laborlauf zählt der aktuelle Stand, geprüft am Merge `533b1100` (upstream `cf522c63`, 2026-11-04) mit `git diff 248029dc cf522c63`:

| Bereich                                                                  | Änderung                                                                                                                                                                                 | Wirkung auf den 1C-Pfad                                                                                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qaSummaryQueue.ts`                                                      | keine                                                                                                                                                                                    | keine                                                                                                                                             |
| `openWeightLlmClient.ts` (+53/−3)                                        | Lernziel-Systemprompt `v2` → `v4`; neue Funktion `inspectOpenWeightLlmAvailability` (Slot-Vorabprüfung über `/slots?fail_on_no_slot=1`)                                                  | Keine für `qa_summary`: Der Prompt gehört zum Auftrag `learning_objectives`; die Vorabprüfung rufen nur die Lernzielableitung und ihre Router auf |
| `routers/qa.ts` (+19/−7)                                                 | Präsentations-Sortierung: `sortModeSource`, `takeover`                                                                                                                                   | Keine: `summaryContextPreview`, `requestSummary`, `summaryRuntime` sind unverändert                                                               |
| `moderationTeachingSignals.ts`, `moderation-compass-rules.ts`            | Konfidenz-Aggregat in der Signal-SQL (`confidenceResponseCount`, `highConfidenceWrongCount`, falsche Optionen) und neuer Kompass-Fakt `confidence-misconception`; `evidenceRole` je Fakt | Kann den Kompassbereich des Kontexts ändern, aber nur bei Fragen mit Konfidenzabfrage. Die Referenzfixture hat keine Konfidenzstimmen             |
| `confidence.ts`, `sessionLearningObjectives.ts`                          | `questionId` in der Konfidenzzusammenfassung; Fragen-IDs werden aus modellabgeleiteten Lernzieltexten entfernt                                                                           | Nur für Sessions mit Konfidenz bzw. modellabgeleiteten Lernzielen; beides hat die Referenzfixture nicht                                           |
| Runtime (`docker/open-weight-llm/`, Compose, `scripts/open-weight-llm/`) | keine                                                                                                                                                                                    | keine                                                                                                                                             |

**Empirische Kontrolle (2026-11-04, Trockenlauf am Merge, Test-Runtime, kein Modell):** Instruktions- und Definitionsversion sind unverändert (`qa-summary-technical-handoff-v2`, `moderation-prompt-definitions-v1`), ebenso die Budgets der Referenzfixture: `dataTokens` 6338 (Referenzfixture, L1–L4), 6608 (L5 `YESNO`) und 6660 (L5 `TEMPO`). Das sind dieselben Werte wie an `248029dc` (Teil 2 M5; Teil 3, Tabelle zu E15: `reference/m3-env`, `full/YESNO`, `full/TEMPO`). Weil die Schätzung UTF-8-Bytes zählt, ist die Länge des kanonischen Kontexts gleich; ein Hashvergleich über die Stände ist nicht möglich, weil jede Fixture neue IDs erzeugt. Die Harness und die PostgreSQL-Suiten (e2e 20/20, hash 8/8) laufen auf dem neuen Stand grün.

**Nachtrag 2026-11-04, abends:** upstream ist auf `9f230abc` weitergegangen (Merge `70c74002`). Die drei neuen Commits ändern nur die Wortwolke (`wordCloud*`-Backend, Wortwolken-Komponenten im Frontend, deren Schemas in `libs/shared-types`, Übersetzungen, Doku); keine der Dateien aus der Tabelle oben ist betroffen. Wiederholt am Merge `70c74002` mit Test-Runtime: Harness 3/3 grün, `dataTokens` 6338/6608/6660, Versionen `qa-summary-technical-handoff-v2` und `moderation-prompt-definitions-v1` unverändert, PostgreSQL-Suiten 28/28 grün.

## 4. Ablauf

Je Lauf, nacheinander:

1. Neue Referenzfixture (#456 Abschnitt 12: sechs Fragen, N = 200, 282 Stimmen), wie in Teil 2. **Neu je Lauf**, weil llama-server den Prompt-Präfix cacht (Modellprüfung 2026-10-05: 142 von 143 Tokens aus dem Cache). Mit neuen Quellen-IDs ist nur der gemeinsame System-Präfix cachebar, wie im Betrieb.
2. Queue und Client zurücksetzen (Zähl- und Zeit-Wrapper um den echten Kontextaufbau; Circuit-Breaker je Lauf isoliert).
3. `qa.summaryContextPreview`, dann sofort `qa.requestSummary` (Zeit `requestMs`), Jobende ohne Kontextaufbau im 5-ms-Takt (`jobDoneMs`), dann genau ein `qa.summaryRuntime` (`totalMs`).
4. Proxy-Aufzeichnung des Laufs übernehmen.

**Wiederholungen:** 1 verworfener Aufwärmlauf, n = 20 Messläufe (L1–L4), danach 5 Läufe ohne Proxy, optional L5 mit 5 Läufen je Arm (abwechselnd, Reihenfolge je Iteration getauscht). Begründung n = 20: wie M1/M2; bei 0 von 20 Ereignissen reicht das Wilson-Intervall bis 16,1 %, das genügt für „kein systematisches Auftreten“, nicht für seltene Ereignisse.

**Ruhebedingung:** Während des Laufs nutzt niemand die Runtime (ein Slot; schon die Statusprobe der App belegt ihn bis zu 20 + 90 + 20 s, Dossier 1B). Auf dem eigenen Rechner heißt das: kein `npm run dev` oder App-Container mit `OPEN_WEIGHT_LLM_ENABLED=true`, keine andere rechenintensive Last, Netzteil angeschlossen, kein Energiesparprofil. Vor dem Start meldet `/slots` den Slot frei.

**Erwartete Dauer** (Schätzung, keine Hypothese): Die Modellprüfung vom 2026-10-05 lief auf einem Apple M2 Pro mit 4 Container-CPUs bei etwa 56 Prompt-Tokens/s und 28–31 Ausgabe-Tokens/s ([`open-weight-llm-runtime.md`](../../features/open-weight-llm-runtime.md#vollständig-protokollierte-lokale-modellprüfung-vom-2026-10-05)). Der eigene Rechner ist ein Notebook mit Intel Core i7-6820HQ (Skylake, 4 Kerne, 8 Threads, AVX2) und 31 GiB RAM, der Container hat 4 CPUs. Dort ist ein deutlich niedrigerer Durchsatz zu erwarten; eine belastbare Zahl gibt es vor dem Lauf nicht. Bei geschätzt 2000–2800 Prompt-Tokens (6855 Byte gepackt, 2,5–3,5 Byte je Token) und 100–250 Ausgabe-Tokens wären es mit den M2-Werten 40–60 s je Auftrag. Bei halbem Durchsatz läge schon der Prefill bei 70–100 s, also am oder über dem Release-Timeout von 90 s. Dann enden Läufe mit `timeout` (L4), und L2 bekommt keine `usage`-Werte. Wie damit umgegangen wird, legt Frage A4 vor dem Lauf fest.

## 5. Fälle

Alle Kriterien beziehen sich auf die Messläufe ohne Aufwärmlauf, ausgewertet mit [`messung/auswertung.mjs`](../evidenz/1C/messung/auswertung.mjs) (Schlüssel `labor`).

| Nr. | Frage                                                                                          | H                                                                                                                                                                                                                                                            | G                                                                                            | K                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L1  | Ist die Nutzlast, die die Runtime erhält, für denselben Revisionsstand die Vorschau? (G8)      | E1 gilt auch auf dem echten Pfad.                                                                                                                                                                                                                            | Ein Feld fehlt, ist zusätzlich oder anders; ein anderer Hash; der Proxy verändert Bytes.     | In **jedem** Lauf: (1) Hash Vorschau = Hash prepare (2) = Hash des gespeicherten Ergebnisses; (2) `messages[2]` bytegleich `canonicalModerationPromptJson(preview.promptContext.context)`; (3) Rollen `system, system, user` mit Instruktions- und Definitionstext; (4) `max_tokens` = `budget.reservedOutputTokens` (640); (5) die acht obersten Schlüssel wie E2; (6) weitergeleitete Bytes = empfangene, Token wie erwartet.                        |
| L2  | Wie stark überschätzt die Byte-Schätzung die echten Prompt-Tokens?                             | Die Schätzung ist konservativ: q = `usage.prompt_tokens` / `budget.packedInputTokens` ≤ 1 in jedem Lauf. Erwartet (keine Schwelle): Median q etwa 0,3–0,4.                                                                                                   | q > 1 in mindestens einem Lauf.                                                              | max q ≤ 1. Keine Toleranz: Die Schätzung zählt UTF-8-Bytes (`estimateModerationPromptUtf8Tokens`), und ein Byte-BPE-Token deckt mindestens ein Byte ab. Nicht mitgezählt sind die Template-Tokens der drei Nachrichten (Rollenmarker, Assistent-Präfix, Größenordnung 10–30), die gegen Tausende Bytes Spielraum vernachlässigbar sein sollten. Berichtet: Median q mit Bootstrap-Intervall, Bytes je Token, `prompt_tokens` = `prompt_n` + `cache_n`. |
| L3  | Wartet der Host auf dem echten Pfad nicht auf das Modell, und wie lang ist die reale Inferenz? | (a) Rückkehrzeit wie M1: Median und p95 von `requestMs` < 1000 ms, und die längste Rückkehr ist kürzer als der kürzeste Runtime-Austausch. (b) Erwartet (keine Schwelle): reale Inferenzzeit (`timings.prompt_ms + predicted_ms`) deutlich über D = 2000 ms. | `requestMs` wächst mit der Inferenz oder überschreitet 1000 ms.                              | K_L3a wie H (a). Berichtet: Median, p95, Bootstrap-Intervall für `requestMs`, `jobDoneMs`, `totalMs`, Proxy→Runtime-Zeit, Inferenzzeit, Netz- und Serveranteil (Proxy-Zeit − Inferenzzeit), Dauer jedes Kontextaufbaus nach Rolle, Fenster zwischen prepare (2) und (3).                                                                                                                                                                               |
| L4  | Welche Endstatus liefert der echte Pfad ohne Datenänderung?                                    | Kein `source_changed` ohne Datenänderung; der Anteil mit `full-context` ist hoch.                                                                                                                                                                            | `source_changed` ohne Datenänderung (wie T3.1), oder Modellantworten scheitern systematisch. | k(`source_changed`) = 0 von n. Berichtet: Verteilung gespeichert und Host-Sicht (`status/effectiveMode/fallbackReason`), Anteil `full-context` mit Wilson-Intervall, je Antwort die nachvollzogene Prüfstufe wie `parseCompletion` (`ok`, `invalid_model_json`, `output_schema`, `question_references`), `finish_reason`.                                                                                                                              |
| L5  | Optional: Tritt Befund T3.1 auf dem echten Pfad auf?                                           | Mit live `YESNO`-Runde endet jeder Auftrag `source_changed`, mit `TEMPO`-Runde keiner.                                                                                                                                                                       | Mit `YESNO` endet mindestens ein Auftrag ohne `source_changed`, oder `TEMPO` liefert eines.  | k(YESNO) = n und k(TEMPO) = 0 bei n = 5 je Arm. Berichtet zusätzlich L2 für den vollen Kontext und die Bereiche (`available` je Bereich, Kürzungen).                                                                                                                                                                                                                                                                                                   |

L1 ist die Kontrolle für L4: Ohne gleichen Hash in L1 wäre ein `ready` in L4 nicht an den Stand der Vorschau gebunden. Mutationsproben entfallen: Prüfgegenstand und Kriterien sind dieselben wie E1/E2 (Teil 2), deren Mutationsproben bestehen; neu ist nur die Runtime.

## 6. Entscheidungsregeln

| Ergebnis                                          | Entscheidung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K_L1 erfüllt                                      | **Beibehaltung** von Vorschau und Packing (`getQaSummaryContextPreview`, `buildChatCompletionBody`): Teil-2-Befund E1 gilt auf dem Releasepfad. Akzeptanzkriterium „Vorschau gegen gepackte Nutzlast für denselben Revisionsstand“ erfüllt.                                                                                                                                                                                                                                                                                                          |
| K_L1 verfehlt                                     | Befund mit erster Abweichung (Byte-Index, Prüfung). Keine Empfehlung, bevor die Ursache geklärt ist (Code, Proxy oder Runtime).                                                                                                                                                                                                                                                                                                                                                                                                                      |
| K_L2 erfüllt, Median q ≤ 0,5                      | Befund: Die Schätzung ist sicher, verschenkt aber mindestens die Hälfte des Fensters. Bezug E15: Dort fielen Blitzlicht, freigegebene Ergebnisse und Kompass beim Packen aus Budgetgründen heraus. **Verbesserung prüfen** (nicht umsetzen): exakte Tokenzählung über die Runtime oder kalibrierter Faktor mit Marge; Kosten und Risiko benennen. Ob die verworfenen Bereiche tatsächlich passen würden, zeigt dieser Lauf nicht.                                                                                                                    |
| K_L2 erfüllt, Median q > 0,5                      | **Beibehaltung** der Byte-Schätzung mit dokumentiertem Faktor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| K_L2 verfehlt                                     | Befund: Die Schätzung ist nicht konservativ. Empfehlung prüfen: größere Sicherheitsmarge oder exakte Zählung; Kopffreiheit `prompt_tokens + max_tokens` gegen `n_ctx` angeben.                                                                                                                                                                                                                                                                                                                                                                       |
| K_L3a erfüllt                                     | **Beibehaltung** der Entkopplung (Entscheidung 3, Teil 2) auf dem echten Pfad bestätigt; Grenze Befund 1 (Host wartet auf den Kontextaufbau) bleibt.                                                                                                                                                                                                                                                                                                                                                                                                 |
| K_L3a verfehlt                                    | Befund; Entscheidung 3 aus Teil 2 neu prüfen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Neubewertung Entscheidung 1 (Teil 2, prepare (3)) | Ersparnis von V1 auf der Laborhardware = Median der Dauer von prepare (3); Anteil s = Median(prepare (3)) / Median(`totalMs`) mit Bootstrap-Intervall. Obergrenze < 5 % → Entscheidung 1 auf der Kostenseite bestätigt. Punktschätzung ≥ 5 % → Entscheidung 1 nach Zeile 3 der Teil-2-Regel neu prüfen. Dazwischen: nicht trennbar; Entscheidung 1 bleibt, weil sie sich vor allem auf Risiken stützt. Die Schwelle 1,5–2,1 s aus Teil 2 wird nur berichtet; sie beruht auf lokalen Kontextkosten, maßgeblich ist die Messung auf der Laborhardware. |
| L4: k(`source_changed`) > 0                       | Befund „Hash ändert sich ohne Datenänderung“ wie T3.1; Prepare-Hashes je Lauf auswerten.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| L4: Anteil `full-context` < 80 % (Punktschätzung) | Den häufigsten Grund als Befund mit Verbesserungskandidat benennen: `invalid_response` mit Prüfstufe `output_schema` → Abgleich der vier Ausgabegrenzen (Befund 6); `timeout` → Timeout-Grenze; nichts umsetzen. Sonst **Beibehaltung**.                                                                                                                                                                                                                                                                                                             |
| L5 erfüllt                                        | Befund T3.1 auf dem echten Pfad bestätigt; Issue-Entwurf bleibt Kandidat, Anlegen nur mit Freigabe des Autors.                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**M7 (Teil 3) bleibt unverändert.** Die Auswertung berichtet die Vorhersage 1 − e^(−0,5·T) mit dem gemessenen Fenster T zwischen prepare (2) und (3) nur informativ. Das Urteil „Zeile 3, Empfehlung zurückgestellt“ bleibt; eine neue Empfehlung bräuchte eine eigene, vorab festgelegte Messung (z. B. M7 mit D = gemessene Inferenzzeit).

## 7. Gültigkeitsgrenzen

- **Ein Laufprozess, nicht der ausgelieferte App-Container:** gleicher Backend-Code, aber über `createCaller` ohne HTTP-tRPC und mit gemockter Host-Tokenprüfung; eigene PostgreSQL/Redis-Instanz.
- **Proxy auf dem Pfad:** ein zusätzlicher Loopback-Hop mit Pufferung; die Gegenprobe ohne Proxy schätzt seinen Anteil, die Reihenfolge (Proxy-Läufe zuerst) ist nicht randomisiert.
- **Eine Fixture, eine Sprache (`de`), ruhige Session:** keine Aussage zu Last, Voting oder anderen Kontextgrößen; L5 deckt den vollen #456-Kontext nur exemplarisch ab.
- **Eine Runtime-Instanz auf dem eigenen Rechner:** Notebook-Hardware (Abschnitt 4), Container mit 4 statt 8 CPUs, Laufprozess auf derselben Maschine, Runtime an Loopback statt im privaten Netz. Zeiten (L3, Neubewertung Entscheidung 1) gelten nur für diese Maschine und sind nicht auf den ausgelieferten Zwei-Host-Betrieb übertragbar; thermisches Drosseln des Notebooks ist möglich und wird über die Zeiten je Lauf sichtbar, aber nicht kontrolliert. L1, L2 und L4 hängen von Code, Modell und Runtime-Einstellungen ab, nicht von der Hardware, solange keine Timeouts auftreten. Prompt-Cache des System-Präfixes wirkt wie im Betrieb.
- **Timeout 300 s statt 90 s (A4):** Mit Release-Timeout wäre der Pfad auf dieser Hardware nicht nutzbar (Abschnitt 10.1). Der Lauf belegt deshalb nicht, dass die Release-Einstellungen insgesamt auf dem eigenen Rechner funktionieren, sondern den Kontextpfad mit dem ausgelieferten Code, Modell und den übrigen Runtime-Einstellungen. L4-Anteile gelten für 300 s.
- **Lokal gebautes Image:** dasselbe Rezept wie ausgeliefert, aber nicht dasselbe Registry-Artefakt; belegt sind Basisimage-Digest (Dockerfile), lokale Image-ID und `build_info` aus `/props`.
- **Kein Qualitätsurteil:** `ready` heißt vertrags- und quellengültig, nicht inhaltlich gut.
- **n = 20 bzw. 5:** Median und grobe Spannweiten; seltene Ausfälle bleiben unentdeckt.
- **Referenzstand:** gilt nur für den im JSON genannten Commit und die abgelesenen Artefakte.

## 8. Aufzeichnung

Eine JSON-Datei `evidenz/1C/messung/<datum>-labor.json` mit `completed`, `testsCompleted`, `environment` (Commit, Referenzstand, Hardware des Laufprozesses, Node, PostgreSQL, Redis, Runtime-Art, Schema und Port der Runtime-URL ohne Adresse, gemeldete Image- und Modellprüfsumme mit Abgleich, Client- und Packing-Profil, Einstellungen) und `labor` (`metadataBefore`/`metadataAfter`, `quiet`, `direct`, `l5`). Je Lauf: Zeiten, Vorschau-Hash und Budget, gesendeter Hash, Budget und Bereichszustände, Ergebnis gespeichert und Host-Sicht, alle Kontextaufbauten mit Rolle und Dauer, je Proxy-Austausch Zeiten, Größen, SHA-256, Draht-Prüfungen und **rohe Anfrage- und Antwort-Bodys** der Completion.

Nicht aufgezeichnet: Token-Wert, Runtime-Adresse, Hostname des Laufrechners, `chat_template` im Klartext (nur SHA-256).

## 9. Datenschutz

Nur synthetische Daten: die Referenzfixture aus #456 Abschnitt 12 und ihre Erweiterung für den vollen Kontext; Teilnehmende sind generierte Datensätze. Keine Produktionsdaten, kein Zugriff auf den Produktions-Inferenzhost `arsnova-privat`. Das Runtime-Token ist ein lokal erzeugter Wegwerfwert, steht nur in der Shell-Umgebung des Laufs und in keiner Datei. Prompts und Antworten bleiben auf dem eigenen Rechner; es gibt keinen Cloud-Anbieter auf dem Pfad.

## 10. Trockenlauf des Werkzeugs (2026-10-25)

Gegen die In-Prozess-Test-Runtime mit künstlichen `usage`/`timings` (`QA_SUMMARY_LABOR_FAKE_RUNTIME=1`, n = 3, 1 Aufwärmlauf, 2 direkte Läufe, L5 mit 2 je Arm), lokale Podman-Datenbank. Ergebnis: Harness, Proxy und Auswertung laufen durch, K_L1 erfüllt, der Proxy leitet bytegleich weiter, kein Token in der JSON-Datei, die Datenbank ist danach im Ausgangszustand; L5 reproduziert T3.1 auch mit dem Werkzeug (YESNO `source_changed`, TEMPO `full-context`, Themen `available`). **Alle Zahlen dieses Laufs sind künstlich und keine Evidenz;** die Datei ist nicht eingecheckt.

**Wiederholung am 2026-11-04** auf dem Merge `533b1100` (n = 3, 1 direkter Lauf, L5 mit 1 je Arm, lokale Podman-Datenbank): 3 von 3 Tests grün. Verwendet nur für die Budgetkontrolle in Abschnitt 3.4; ebenfalls keine Evidenz und nicht eingecheckt. Ein weiterer Trockenlauf mit `QA_SUMMARY_LABOR_TIMEOUT_MS=300000` zeigt im JSON `timeoutMs` 300 000, `timeoutDeviatesFromRelease: true` und `terminalWaitMs` 360 000; ein Wert von 400 000 bricht vor dem ersten Auftrag mit einer Meldung ab.

### 10.1 Kalibrierungsanfrage (2026-11-04, vor der Freigabe)

Nach Frage A4 (c) und mit Zustimmung des Autors: **eine** Anfrage an die lokale Runtime (Podman, Image `arsnova-open-weight-llm:llama-b10524`, Build `b10524-9ee9fc04c`, GGUF-SHA geprüft), ohne Harness und ohne Client-Timeout per `curl`, mit dem rohen Completion-Body des Trockenlaufs (9671 Byte, Referenzfixture, `max_tokens` 640). Ergebnis: HTTP 200, `finish_reason: stop`, 196 s Wandzeit; Prefill 2166 Tokens in 95 s (22,8 Tokens/s, kein Cache), Ausgabe 354 Tokens in 101 s (3,5 Tokens/s). Die Modellantwort wurde nicht gespeichert und nicht gelesen.

Folge: Mit dem Release-Timeout von 90 s würde jeder Lauf mit `timeout` enden, schon der Prefill liegt darüber. Daraus folgt die Entscheidung A4 (300 s). Im ungünstigsten Fall (640 Ausgabe-Tokens) wären es rund 95 + 183 = 280 s, also unter 300 s.

**Hinweis zur Vorabfestlegung:** Die Kalibrierung zeigt nebenbei ein q = 2166 / 6855 ≈ 0,32 für einen Lauf. Das liegt im schon vorher genannten Erwartungsbereich 0,3–0,4 (Abschnitt 5, L2) und unter der Schwelle 0,5. Schwellen und Regeln aus Abschnitt 5 und 6 wurden danach **nicht** geändert. Die Anfrage geht nicht in die Auswertung ein.

## 11. Offene Fragen

An den Prüfer (gestellt per E-Mail am 2026-10-26, beantwortet per E-Mail nach Rückfrage vom 2026-11-02, notiert 2026-11-04; siehe [00-rahmen](../rahmen/00-rahmen-und-pruefung.md#offene-fragen-an-den-prüfer), Fragen 3 und 4):

- ~~**P1 Referenzstand:** `v1.3.0` (`87c39334`) oder `main`?~~ **Beantwortet:** „Aktualisieren Sie Ihren Fork und Clone vor Ihrer Auswertung / Untersuchung.“ Daraus abgeleitet: aktueller `main`, keine Rückportierung (Abschnitt 3.3).
- ~~**P2 Laborinstanz:** Zugang, zwei VMs, Hardware, Image und GGUF?~~ **Beantwortet:** „Die Laborinstanz ist Ihr eigener Rechner.“ Daraus abgeleitet: keine bereitgestellten VMs, ein Rechner, Image und GGUF lädt der Autor selbst (Abschnitt 3.1).
- **P3 Releasepfad:** nicht ausdrücklich beantwortet. Weil es keine Labor-App gibt, bleibt die Harness mit dem Backend-Code des Referenzstands der gewählte Weg (Abschnitt 3.1).

An den Autor (entschieden am 2026-11-04):

- **A1** Freigabe dieses Entwurfs mit den Schwellen (q ≤ 1, Median q 0,5, 1000 ms, 80 %, 5 %) und n (20, 5, 5). **Entschieden: freigegeben.**
- **A2** L5 ausführen (verlängert den Lauf um etwa 10–15 min, auf dem eigenen Rechner eher mehr)? **Entschieden: ja**, `QA_SUMMARY_LABOR_L5_RUNS=5`.
- **A3** Rohe Anfrage- und Antwort-Bodys im eingecheckten JSON behalten (synthetisch, etwa 15 KB je Lauf) oder nur Prüfsummen? **Entschieden: rohe Bodys behalten**, damit L1 direkt nachprüfbar ist.
- **A4** Umgang mit dem Timeout auf langsamer Hardware (Abschnitt 4). **Entschieden nach der Kalibrierung (Abschnitt 10.1):** Der ganze Lauf (L1–L5, Aufwärmlauf, direkte Läufe) nutzt `QA_SUMMARY_LABOR_TIMEOUT_MS` = 300 000 ms, die Obergrenze, die das Produkt für Betreiber zulässt. Das ist eine **gekennzeichnete Abweichung** von der Release-Einstellung (90 s) und eine Gültigkeitsgrenze: Der Lauf zeigt den Kontextpfad mit dem ausgelieferten Code, Modell und Runtime-Einstellungen bis auf den Timeout. Ein Lauf mit 90 s entfällt, weil er nach der Kalibrierung nur Timeouts liefern würde; diese Aussage („mit Release-Timeout auf dieser Hardware nicht nutzbar“) wird als Befund berichtet. Erwartete Dauer etwa 2 h (36 Aufträge zu etwa 200 s). Ursprünglicher Vorschlag: (a) Release-Timeout 90 s bleibt für L1–L5 unverändert, weil der Lauf die unveränderte Baseline zeigen soll. Endet ein Lauf mit `timeout`, gilt er für L4 als Befund und fehlt in L2. (b) Liegt der Anteil `timeout` im Aufwärmlauf und den ersten 5 Messläufen über 50 %, wird abgebrochen und ein **gekennzeichneter Zusatzlauf** mit `QA_SUMMARY_LABOR_TIMEOUT_MS` = 300 000 ms geplant. Dafür bräuchte die Harness eine kleine Testcode-Änderung (heute fest 90 000 ms). Der Zusatzlauf liefert nur L1 und L2 und gilt nicht als Baseline. Alternativ (c): eine einzige, nicht gewertete Kalibrierungsanfrage vor der Freigabe, um den Durchsatz zu kennen. Das wäre selbst ein Modellaufruf und braucht deshalb ebenfalls die Freigabe.

## 12. KI-Nutzung

Entwurf, Harness, Proxy, Auswertung und Runbook hat Claude Code (Anthropic, Modell Claude Opus 5.5) erstellt, einschließlich aller Schwellen und Wiederholungszahlen. Gegen den Code geprüft mit codebase-memory und Serena, llama-server-Felder mit Context7 (README `master`) und dem b10524-Protokoll im Repository. Der Autor hat den Umfang vorgegeben (bis 2026-11-04: kein Modelllauf, nur Vorbereitung, keine Produktionsänderung) und den Entwurf am 2026-11-04 freigegeben; siehe Kopf.

Die Überarbeitung vom 2026-11-04 (Abschnitt 13) hat ebenfalls Claude Code erstellt, nach Vorgabe des Autors („auf eigenen Rechner und aktuellen `main` umstellen, Abweichungen zu `248029dc` ausweisen“). Der Abgleich in Abschnitt 3.4 beruht auf `git diff`, codebase-memory (Aufrufer von `inspectOpenWeightLlmAvailability`) und dem Trockenlauf aus Abschnitt 10; Frage A4 und ihre Vorschläge sind ein KI-Vorschlag. Die Kalibrierungsanfrage (Abschnitt 10.1) und die Timeout-Variable der Harness hat Claude Code nach Zustimmung des Autors ausgeführt bzw. eingebaut; die Entscheidungen A1–A4 hat der Autor nach dem Vorschlag von Claude Code getroffen („Passt so“).

## 13. Änderungen vom 2026-11-04 (vor der Freigabe)

| Abschnitt    | Vorher                                                         | Jetzt                                                                                                              |
| ------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Kopf, 3.3    | Codebasis offen (P1)                                           | aktueller `main`, Merge `533b1100` (upstream `cf522c63`)                                                           |
| 2            | Nicht-Ziel „kein Modelllauf lokal“                             | Modelllauf auf dem eigenen Rechner (= Laborinstanz), nicht gegen Produktion                                        |
| 3.1          | Zwei Hosts, Runtime über `npm run llm:prod`, Firewall-Freigabe | Ein Rechner, Runtime über `npm run docker:up:llm:http` an `127.0.0.1:8080`, Abweichungen zum Inferenz-Host benannt |
| 3.2          | Token aus dem Passwortmanager, Image-Digest vom Inferenz-Host  | lokal erzeugtes Token, lokale Image-ID                                                                             |
| 3.4          | –                                                              | neu: Abweichungen gegenüber `248029dc` mit empirischer Budgetkontrolle                                             |
| 4, 7         | Ruhebedingung für die Labor-App, Dauer mit M2-Werten           | Ruhebedingung für den eigenen Rechner, Hardware genannt, Timeout-Risiko, neue Gültigkeitsgrenzen                   |
| 11           | P1–P3 offen                                                    | P1, P2 beantwortet, P3 abgeleitet; neue Frage A4                                                                   |
| Kopf, 11     | nicht freigegeben, A1–A4 offen                                 | freigegeben 2026-11-04; A1 ja, A2 ja, A3 rohe Bodys, A4 300 s                                                      |
| 3.2, 7, 10.1 | fester Timeout 90 s                                            | `QA_SUMMARY_LABOR_TIMEOUT_MS`, Kalibrierung dokumentiert, Timeout als Gültigkeitsgrenze                            |
| Kopf, 3.4    | Merge `533b1100` (upstream `cf522c63`)                         | Merge `70c74002` (upstream `9f230abc`), nach der Freigabe; nur Wortwolke geändert, Kontrolle wiederholt            |

Unverändert: Fälle L1–L5, Hypothesen, Kriterien, Schwellen, Wiederholungszahlen und Entscheidungsregeln (Abschnitte 5 und 6).

## 14. Nachtrag: Zusatzlauf mit Produktionslimits und Release-Timeout (vor dem Lauf festgelegt)

> **Festgelegt am 2026-11-05, nach dem Laptop-Lauf und vor jeder Messung auf dem zweiten Rechner;
> freigegeben vom Autor am selben Tag.** Abschnitte 1–13 und das [Laptop-Protokoll](../evidenz/1C/2026-11-05-labor.md)
> bleiben unverändert. Dieser Lauf ersetzt den Laptop-Lauf nicht, er ist ein gekennzeichneter Zusatzlauf.

### 14.1 Zweck

Der Laptop-Lauf weicht an zwei Stellen von der ausgelieferten Konfiguration ab: Timeout 300 s statt 90 s (A4) und Runtime-Limits des Laborpfads (4 CPUs, 5 GiB, 4 Threads) statt des Inferenz-Hosts (8 CPUs, 8 GiB, 10 GiB mit Swap, 8 Threads). Außerdem wurde die Runtime dort am 5-GiB-Limit per OOM beendet. Der Zusatzlauf auf einem stärkeren Rechner beseitigt beide Abweichungen, soweit die Hardware das zulässt, und klärt, ob der OOM-Kill an das Laborlimit gebunden ist.

### 14.2 Aufbau

- **Rechner:** Desktop-PC des Autors, Intel Core i7-8700 (Coffee Lake, 6 Kerne / 12 Threads, 3,2 GHz Basis, 4,6 GHz max., L3 12 MiB, AVX2/FMA/F16C, kein AVX-512, kein AVX-VNNI), 31 GiB RAM, NVIDIA GTX 1060 6 GB (nicht genutzt, die Runtime ist CPU-only). Vollständige Angaben liest das Laufskript ab.
- **Runtime:** Laborpfad `llm-http` wie Abschnitt 3.1, aber mit [`labor-produktionslimits.override.yml`](../evidenz/1C/labor-produktionslimits.override.yml): 8 CPUs, 8 GiB, 10 GiB mit Swap, 8 Threads wie `docker-compose.llm.yml`. Image-Rezept, Entry-Point, Modell, Loopback und Healthcheck bleiben gleich. Nicht „volle Kapazität“ des PCs: Gemessen werden soll die ausgelieferte Ressourcenkonfiguration, nicht die Hardware.
- **Laufprozess, Fixture, Fälle, n:** unverändert (n = 20, 1 Aufwärmlauf, 5 direkt, L5 5 je Arm).
- **Werkzeug:** [`labor-lauf.sh`](../evidenz/1C/labor-lauf.sh) (Runbook 9), zusätzlich ein Speicherprotokoll der Runtime im 15-s-Takt.

### 14.3 Kalibrierung und Wahl des Timeouts

Vor dem Lauf genau **eine** nicht gewertete Anfrage wie Abschnitt 10.1, mit dem rohen Completion-Body des ersten Messlaufs aus dem Laptop-Lauf. Maßgeblich ist I = `prompt_ms + predicted_ms`; die Antwort wird nicht gespeichert.

| Kalibrierung  | Lauf                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| I ≤ 75 s      | Timeout 90 s (Release). Release-Baseline auf Produktionslimits.                                                                              |
| 75 < I ≤ 90 s | Timeout 90 s (Release). Timeouts sind zu erwarten und zählen als L4-Befund (Regel „L4: Anteil `full-context` < 80 %“, Grund `timeout`).      |
| I > 90 s      | Kein 90-s-Lauf (er lieferte nur Timeouts; Befund wie A4). Stattdessen Timeout 300 s auf Produktionslimits; L4-Anteile gelten dann für 300 s. |

Die Schätzung vor der Kalibrierung (Laptop-Werte hochgerechnet auf 6 Kerne und höheren Takt) lag bei 80–95 s, also im Grenzbereich; sie ist keine Hypothese.

### 14.4 Fälle und Regeln

L1–L5 mit denselben H, G, K und Regeln (Abschnitte 5 und 6). Neu:

| Nr. | Frage                                                                      | H                                               | G                                      | K                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L6  | Bleibt die Runtime mit Produktionslimits über alle Aufträge ohne OOM-Kill? | Kein Neustart, kein OOM-Kill während des Laufs. | Mindestens ein Neustart oder OOM-Kill. | `RestartCount` vor und nach dem Lauf 0 und `OOMKilled` false. Berichtet: Speicherverlauf im 15-s-Takt, Maximum, Wert nach dem Aufwärmlauf gegen Wert nach dem letzten Auftrag. |

| Ergebnis      | Entscheidung                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K_L6 erfüllt  | Befund: Der OOM-Kill des Laptop-Laufs ist an das 5-GiB-Limit des Laborpfads gebunden. **Verbesserung prüfen, nicht umsetzen:** Limit des Laborpfads in `docker-compose.yml`. Steigt der Speicher trotzdem über den Lauf, wird das zusätzlich berichtet. |
| K_L6 verfehlt | Befund: Auch mit Produktionslimits reicht der Speicher nicht. Der Verlauf zeigt, ob er über die Aufträge wächst. Issue-Kandidat, Anlegen nur mit Freigabe des Autors.                                                                                   |

Zeiten (L3) werden je Rechner berichtet und dem Laptop gegenübergestellt, ohne Schwelle.

### 14.5 Gültigkeitsgrenzen

Wie Abschnitt 7, außer Timeout und Limits, soweit 14.3 den Release-Timeout erlaubt. Zusätzlich: ein anderer Rechner als Laptop und Inferenz-Host; 8 Runtime-Threads auf 6 physischen Kernen (2 über SMT), anders als auf einem Host mit 8 Kernen; Desktop-Speicher (vermutlich DDR4) bestimmt die Ausgabegeschwindigkeit mit; weiterhin ein Rechner für Laufprozess und Runtime. L6 belegt das Speicherverhalten dieses Images mit diesen Limits, nicht das des Produktionshosts.

## 15. Nachtrag: Ursachenversuch U1 zum Speicherwachstum (vor dem Versuch festgelegt)

> **Bezeichnung:** am 2026-11-05 nach dem Versuch von „V1“ in „U1“ umbenannt, weil V1 in 1C schon die Gegenvariante aus Teil 2 bezeichnet; Inhalt, Kriterien und Regeln unverändert.
>
> **Festgelegt am 2026-11-05, nach dem PC-Lauf (Abschnitt 14, K_L6 verfehlt) und vor dem Versuch;
> freigegeben vom Autor am selben Tag.** Abschnitte 1–14 bleiben unverändert. U1 ist kein Fall des Laufs,
> sondern ein gekennzeichneter Folgeversuch zu einem Befund.

### 15.1 Anlass und Hypothese

Im PC-Lauf wuchs der Speicher der Runtime um etwa 0,41–0,43 GB pro Auftrag, ohne Freigabe, bis zum OOM-Kill am 8-GiB-Limit. Das Image `llama-b10524` hält standardmäßig einen Prompt-Cache im Arbeitsspeicher (`--cache-ram`, Standard 8192 MiB, laut `llama-server --help` im Image); `docker/open-weight-llm/entrypoint.sh` setzt den Wert nicht. Grobe Rechnung: Der KV-Cache von Qwen3-4B (36 Schichten, 8 KV-Köpfe, Kopfdimension 128, f16) braucht etwa 144 KiB pro Token, ein Auftrag mit rund 2600 Tokens also gut 0,35 GB. Grundlast (etwa 3,1 GB) plus bis zu 8 GiB Cache überschreitet jedes Limit von 8 GiB.

**Hypothese H_U1:** Das Wachstum kommt vom Prompt-Cache. Mit `--cache-ram 0` bleibt der Speicher über die Aufträge flach.

### 15.2 Aufbau

- Rechner, Image, Modell und Limits wie Abschnitt 14.2 (Override `labor-produktionslimits.override.yml`).
- Zwei Arme nacheinander, je mit frisch gestarteter Runtime: **standard** (keine Änderung) und **aus** (zusätzlich [`labor-cache-aus.override.yml`](../evidenz/1C/labor-cache-aus.override.yml), setzt `LLAMA_ARG_CACHE_RAM=0`). Reihenfolge: standard, dann aus.
- Je Arm 10 direkte Anfragen an `/v1/chat/completions`, ohne Proxy und ohne Harness: die rohen Completion-Bodies der ersten 10 Messläufe (ohne Aufwärmlauf) aus dem Laptop-Lauf, alle verschieden. Antworttexte werden verworfen.
- Gemessen: Speicher der Runtime (`stats`, MemUsage) vor der ersten Anfrage (m₀) und 3 s nach jeder Anfrage (m₁ … m₁₀), dazu `prompt_n`, `cache_n`, `predicted_n`, `prompt_ms`, `predicted_ms`, `RestartCount` und `OOMKilled`.
- Werkzeug: `labor-lauf.sh cacheversuch` mit `LABOR_CACHE_ARM=standard|aus` (Runbook 9).

### 15.3 Kriterium und Regeln

Δᵢ = mᵢ − mᵢ₋₁ für i = 2 … 10 (die erste Anfrage enthält das Aufwärmen und zählt nicht).

| Ergebnis                                                                                       | Befund und Entscheidung                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| standard: Median Δ ≥ 0,25 GB; aus: Median Δ ≤ 0,05 GB und m₁₀ − m₁ ≤ 0,3 GB (**K_U1 erfüllt**) | H_U1 gestützt: Der Prompt-Cache treibt das Wachstum und den OOM-Kill. **Verbesserung prüfen, nicht umsetzen:** `--cache-ram` im Entry-Point so begrenzen, dass Grundlast plus Cache unter `mem_limit` bleibt (oder 0). Issue-Kandidat, Anlegen nur mit Freigabe des Autors. |
| standard wächst, aus wächst ebenfalls (Median Δ > 0,05 GB)                                     | H_U1 nicht gestützt, der Cache ist nicht (allein) die Ursache. Befund „Speicherwachstum ungeklärt“, Issue-Kandidat mit Verlauf beider Arme.                                                                                                                                 |
| standard: Median Δ < 0,25 GB                                                                   | Wachstum mit direkten Anfragen nicht reproduziert. Kein Schluss auf die Ursache; berichtet wird der Unterschied zum Lauf (Proxy, Harness, andere Bodies).                                                                                                                   |

Zeiten (`prompt_ms`, `predicted_ms`) und `cache_n` werden je Arm berichtet, ohne Schwelle; ohne Cache kann der gemeinsame Präfix nicht wiederverwendet werden.

### 15.4 Gültigkeitsgrenzen

Ein Rechner, n = 10 je Arm, ein Durchgang je Arm, feste Reihenfolge. Belegt wird das Speicherverhalten dieses Images mit diesen Limits und diesen Bodies, nicht das des Produktionshosts unter echter Last. MemUsage aus `stats` enthält auch den Seitencache des Containers (Modelldatei per mmap); dieser Anteil ist nach dem Laden konstant und fällt in Δ heraus.
