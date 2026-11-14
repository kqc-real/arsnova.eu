# E3b – Release-Pfad des extraktiven Q&A-Summary-Fallbacks (9f230abc)

Erzeugt: 2026-11-04T16:39:56.380Z · Rohdaten: `e3b-9f230abc.json`

## Umgebung

| Feld                     | Wert                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commit                   | `9f230abcd00319bad4e5f1d8bf14f62d720121a6`                                                                                                                 |
| `git status --porcelain` | leer (Repo unverändert)                                                                                                                                    |
| Node                     | v24.18.0                                                                                                                                                   |
| CPU                      | 11th Gen Intel(R) Core(TM) i7-11700F @ 2.50GHz (4 logische CPUs, WSL2 6.6.87.2-microsoft-standard-WSL2)                                                    |
| RAM                      | 7943 MB                                                                                                                                                    |
| Backend                  | node --import tsx apps/backend/src/index.ts (env -i, keine .env-Datei), Postgres 16 + Redis 7.4 via docker compose                                         |
| Netzwerk                 | WSL2 networkingMode=mirrored: TCP-SYN an geschlossene IPv4-Loopback-Ports wird nicht mit RST beantwortet (connect hängt); ::1 liefert sofort ECONNREFUSED. |

## Szenario

Pro Bedingung eine frische Session (Typ `Q_AND_A`, Vorab-Moderation an), N = 200 Teilnehmende, sechs Fragen (je ein anderer Autor), Abstimmung durch disjunkte Teilnehmende ohne Autor; Votes 282/282 akzeptiert (in allen Bedingungen: C1 282/282, C2 282/282, C3 282/282, C3b 282/282).

- Fragen kamen als `PENDING/PENDING/PENDING/PENDING/PENDING/PENDING` an; Vote auf PENDING-Frage A abgelehnt: `BAD_REQUEST` „Diese Frage kann aktuell nicht bewertet werden.“ (erwartet, DB-Trigger 1.3).
- Moderation: A APPROVE→ACTIVE, B APPROVE→ACTIVE, C APPROVE→ACTIVE, C PIN→PINNED, D APPROVE→ACTIVE, E APPROVE→ACTIVE, F APPROVE→ACTIVE.
- Setup-Zeiten C1: create 133 ms, 200 Joins 7808 ms, Submit 229 ms, 282 Votes 5361 ms.

### Score-Verifikation (Host-Liste `qa.list`, moderatorView, Session C1; C2/C3/C3b identisch)

| Frage | Status | +/−   | bestScore (Backend) | erwartet | controversyScore (Backend) | erwartet | isControversial | erwartet | OK  |
| ----- | ------ | ----- | ------------------- | -------- | -------------------------- | -------- | --------------- | -------- | --- |
| A     | ACTIVE | 80/30 | 0.6374              | 0.6374   | 0.4615                     | 0.4615   | false           | false    | ja  |
| B     | ACTIVE | 10/0  | 0.7225              | 0.7225   | 0.0000                     | 0.0000   | false           | false    | ja  |
| C     | PINNED | 30/0  | 0.8865              | 0.8865   | 0.0000                     | 0.0000   | false           | false    | ja  |
| D     | ACTIVE | 12/0  | 0.7575              | 0.7575   | 0.0000                     | 0.0000   | false           | false    | ja  |
| E     | ACTIVE | 40/40 | 0.3930              | 0.3930   | 0.8000                     | 0.8000   | true            | true     | ja  |
| F     | ACTIVE | 20/20 | 0.3520              | 0.3520   | 0.6667                     | 0.6667   | true            | true     | ja  |

Alle Bedingungen: Score-Match C1=true, C2=true, C3=true, C3b=true. Erwartung: Wilson-Untergrenze z = 1,96; Kontroversität 2·min(p,n)/(p+n+T), T = ceil(0,1·N) = 20; Label „umstritten“ bei Score > 0,5 und p+n ≥ T.

### Gepackter Kontext (`qa.summaryContextPreview`, de)

- Fragenkorpus: total 6, eligible 6, analyzed 6, deduplicated 4, represented 4; `selectionLimits.questions` = 4.
- Budget: packedInputTokens 6821/8192; Kürzungen: questions −2 (deduplication); compass −1 (token-budget).
- Quellen im Register (C1, Reihenfolge wie geliefert): compass-signal „Q&A controversy“ · qa-question »Soll die Anwesenheit verpflichtend sein?« · qa-question »Ist Kapitel 4 klausurrelevant?« · qa-question »Müssen wir den vierten Abschnitt für die Prüfung lernen?« · qa-question »Sollten wir eine Anwesenheitspflicht einführen?«.
- Kompass-Signale: high-controversy (Wert 0.8, Fragen: E+F).
- Vorschau-Modus/Fallback je Bedingung: C1: selectedMode=null, fallback=disabled; C2: selectedMode=full-context, fallback=null; C3: selectedMode=full-context, fallback=null; C3b: selectedMode=full-context, fallback=null.

## Bedingungen und exakte Env

### C1 – disabled

Open-Weight aus, keine Legacy-URL

```env
NODE_ENV=development
DATABASE_URL=postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_e3b_9f230abc?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=<redacted-local-lab-value>
CAPABILITY_ENVELOPE_KEY_BASE64=<redacted-local-lab-value>
ADMIN_SECRET=<redacted-local-lab-value>
ADMIN_DIAGNOSTIC_SECRET=<redacted-local-lab-value>
CSP_REPORT_HASH_SECRET=<redacted-local-lab-value>
PORT=3000
HOST=127.0.0.1
WS_PORT=3001
WS_HOST=127.0.0.1
YJS_WS_PORT=3002
MAX_SESSION_DURATION=P180D
NLP_ENABLED=false
QA_NLP_ENABLED=false
WORD_CLOUD_SEMANTIC_ENABLED=false
QA_SUMMARY_ENABLED=true
OPEN_WEIGHT_LLM_ENABLED=false
QA_SUMMARY_INFERENCE_URL=
```

### C2 – unavailable

Open-Weight an, URL http://[::1]:59999 (nichts lauscht, ECONNREFUSED)

```env
NODE_ENV=development
DATABASE_URL=postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_e3b_9f230abc?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=<redacted-local-lab-value>
CAPABILITY_ENVELOPE_KEY_BASE64=<redacted-local-lab-value>
ADMIN_SECRET=<redacted-local-lab-value>
ADMIN_DIAGNOSTIC_SECRET=<redacted-local-lab-value>
CSP_REPORT_HASH_SECRET=<redacted-local-lab-value>
PORT=3000
HOST=127.0.0.1
WS_PORT=3001
WS_HOST=127.0.0.1
YJS_WS_PORT=3002
MAX_SESSION_DURATION=P180D
NLP_ENABLED=false
QA_NLP_ENABLED=false
WORD_CLOUD_SEMANTIC_ENABLED=false
QA_SUMMARY_ENABLED=true
OPEN_WEIGHT_LLM_ENABLED=true
OPEN_WEIGHT_LLM_URL=http://[::1]:59999
OPEN_WEIGHT_LLM_TOKEN=<redacted-local-lab-value>
QA_SUMMARY_INFERENCE_URL=
```

### C3 – timeout

Open-Weight an, hängender Stub 127.0.0.1:59998, Queue-Timeout gewinnt (500/1000 ms → effektiv 1000 ms)

```env
NODE_ENV=development
DATABASE_URL=postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_e3b_9f230abc?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=<redacted-local-lab-value>
CAPABILITY_ENVELOPE_KEY_BASE64=<redacted-local-lab-value>
ADMIN_SECRET=<redacted-local-lab-value>
ADMIN_DIAGNOSTIC_SECRET=<redacted-local-lab-value>
CSP_REPORT_HASH_SECRET=<redacted-local-lab-value>
PORT=3000
HOST=127.0.0.1
WS_PORT=3001
WS_HOST=127.0.0.1
YJS_WS_PORT=3002
MAX_SESSION_DURATION=P180D
NLP_ENABLED=false
QA_NLP_ENABLED=false
WORD_CLOUD_SEMANTIC_ENABLED=false
QA_SUMMARY_ENABLED=true
OPEN_WEIGHT_LLM_ENABLED=true
OPEN_WEIGHT_LLM_URL=http://127.0.0.1:59998
OPEN_WEIGHT_LLM_TOKEN=<redacted-local-lab-value>
QA_SUMMARY_INFERENCE_URL=
QA_SUMMARY_TIMEOUT_MS=500
OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=1000
```

### C3b – timeout (Client-Timeout < Queue-Timeout)

wie C3, aber QA_SUMMARY_TIMEOUT_MS=3000 / OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=1000 → Client-Timeout gewinnt

```env
NODE_ENV=development
DATABASE_URL=postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_e3b_9f230abc?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=<redacted-local-lab-value>
CAPABILITY_ENVELOPE_KEY_BASE64=<redacted-local-lab-value>
ADMIN_SECRET=<redacted-local-lab-value>
ADMIN_DIAGNOSTIC_SECRET=<redacted-local-lab-value>
CSP_REPORT_HASH_SECRET=<redacted-local-lab-value>
PORT=3000
HOST=127.0.0.1
WS_PORT=3001
WS_HOST=127.0.0.1
YJS_WS_PORT=3002
MAX_SESSION_DURATION=P180D
NLP_ENABLED=false
QA_NLP_ENABLED=false
WORD_CLOUD_SEMANTIC_ENABLED=false
QA_SUMMARY_ENABLED=true
OPEN_WEIGHT_LLM_ENABLED=true
OPEN_WEIGHT_LLM_URL=http://127.0.0.1:59998
OPEN_WEIGHT_LLM_TOKEN=<redacted-local-lab-value>
QA_SUMMARY_INFERENCE_URL=
QA_SUMMARY_TIMEOUT_MS=3000
OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=1000
```

### C2a – Vorlauf „unavailable“ über IPv4-Loopback (abgebrochen; Lauf vom 21.10.2026 auf a657798e, nicht wiederholt)

Wie C2, aber `OPEN_WEIGHT_LLM_URL=http://127.0.0.1:59999`. Unter WSL2 (mirrored networking) hängt `connect()` zu einem geschlossenen IPv4-Loopback-Port, statt sofort abgelehnt zu werden. Ergebnis aus dem Backend-Log:

- 8 Jobs, alle `fallbackReason: timeout`, latencyMs 90073–90136 (Queue-Timeout = Default 90 000 ms). Kein `circuit_open` trotz 8 aufeinanderfolgender Fehlschläge.

## Ergebnisse je Bedingung

Latenz: `enqueue` = Rundlauf `qa.requestSummary`; `terminal` = Start bis erster nicht-`pending`-Runtime (Polling alle 25 ms); `server` = `latencyMs` aus der Logzeile `qa_summary:completed` (Queue-Job inkl. zweifachem Kontextaufbau).

| Bedingung | Läufe | effectiveMode | attemptedMode | fallback.reason (Anzahl) | retry          | status | enqueue Median/p95 ms | terminal Median/p95 ms | server Median/p95 ms | Polls Median |
| --------- | ----- | ------------- | ------------- | ------------------------ | -------------- | ------ | --------------------- | ---------------------- | -------------------- | ------------ |
| C1        | 5     | extractive    | null          | disabled (5)             | not-applicable | ready  | 71/104                | 308/327                | 143/154              | 4            |
| C2        | 10    | extractive    | full-context  | unavailable (10)         | manual         | ready  | 68/103                | 266/327                | 122/148              | 4            |
| C2        | 10    | extractive    | full-context  | circuit_open (10)        | manual         | ready  | 65/86                 | 277/318                | 117/189              | 4            |
| C3        | 10    | extractive    | full-context  | timeout (10)             | manual         | ready  | 72/141                | 1276/1419              | 1125/1178            | 32           |
| C3b       | 10    | extractive    | full-context  | timeout (10)             | manual         | ready  | 80/144                | 1307/1361              | 1146/1197            | 32           |
| C3b       | 11    | extractive    | full-context  | circuit_open (11)        | manual         | ready  | 69/84                 | 265/311                | 117/155              | 4            |

Reihenfolge der Gründe (Burst = direkt hintereinander, Spaced = nach 31 s Wartezeit bei `circuit_open`):

- C1: run-01=disabled, cooldown-probe-immediate=CACHE(disabled), run-02=CACHE(disabled), run-03=disabled, run-04=CACHE(disabled), run-05=disabled, run-06=CACHE(disabled), run-07=disabled, run-08=CACHE(disabled), run-09=disabled, run-10=CACHE(disabled)
- C2: burst-01=unavailable, burst-02=unavailable, burst-03=unavailable, burst-04=circuit_open, burst-05=circuit_open, burst-06=circuit_open, burst-07=circuit_open, burst-08=circuit_open, burst-09=circuit_open, burst-10=circuit_open, spaced-01=unavailable, spaced-02=unavailable, spaced-03=unavailable, spaced-04=circuit_open, spaced-05=unavailable, spaced-06=unavailable, spaced-07=unavailable, spaced-08=circuit_open, spaced-09=circuit_open, spaced-10=unavailable
- C3: burst-01=timeout, burst-02=timeout, burst-03=timeout, burst-04=timeout, burst-05=timeout, burst-06=timeout, burst-07=timeout, burst-08=timeout, burst-09=timeout, burst-10=timeout
- C3b: burst-01=timeout, burst-02=timeout, burst-03=timeout, burst-04=circuit_open, burst-05=circuit_open, burst-06=circuit_open, burst-07=circuit_open, burst-08=circuit_open, burst-09=circuit_open, burst-10=circuit_open, spaced-01=timeout, spaced-02=timeout, spaced-03=timeout, spaced-04=circuit_open, spaced-05=circuit_open, spaced-06=timeout, spaced-07=timeout, spaced-08=timeout, spaced-09=circuit_open, spaced-10=circuit_open, spaced-11=timeout

### Extraktive Aussagen (wörtlich) und Quellenzuordnung

Innerhalb jeder Bedingung waren alle Läufe inhaltsgleich (ein snapshotHash, eine Reihenfolge). `modelVersion` = `extractive-v2`, `limitations` = [„Extraktive Kurzfassung ohne generative Interpretation.“], `suggestedNextSteps` = [].

**C1** (Session RMW7W9; 1 snapshotHash, 1 Reihenfolge; status ready; modelVersion extractive-v2; Quellen 4)

| #   | Aussage                                                                           | sourceId                  | Frage | Thema                                        |
| --- | --------------------------------------------------------------------------------- | ------------------------- | ----- | -------------------------------------------- |
| 1   | Hervorgehobener Beleg: »Soll die Anwesenheit verpflichtend sein?«                 | `qa-question:594149e6-2…` | E     | Anwesenheitspflicht (umstritten)             |
| 2   | Hervorgehobener Beleg: »Ist Kapitel 4 klausurrelevant?«                           | `qa-question:7f0a6967-6…` | C     | Prüfungsorganisation (PINNED)                |
| 3   | Hervorgehobener Beleg: »Müssen wir den vierten Abschnitt für die Prüfung lernen?« | `qa-question:bdcb9e3e-f…` | D     | Prüfungsorganisation (Paraphrase)            |
| 4   | Hervorgehobener Beleg: »Sollten wir eine Anwesenheitspflicht einführen?«          | `qa-question:c5f98463-5…` | F     | Anwesenheitspflicht (umstritten, Paraphrase) |

**C2** (Session NATRC7; 1 snapshotHash, 1 Reihenfolge; status ready; modelVersion extractive-v2; Quellen 4)

| #   | Aussage                                                                           | sourceId                  | Frage | Thema                                        |
| --- | --------------------------------------------------------------------------------- | ------------------------- | ----- | -------------------------------------------- |
| 1   | Hervorgehobener Beleg: »Soll die Anwesenheit verpflichtend sein?«                 | `qa-question:8695a324-e…` | E     | Anwesenheitspflicht (umstritten)             |
| 2   | Hervorgehobener Beleg: »Ist Kapitel 4 klausurrelevant?«                           | `qa-question:95db49fa-a…` | C     | Prüfungsorganisation (PINNED)                |
| 3   | Hervorgehobener Beleg: »Müssen wir den vierten Abschnitt für die Prüfung lernen?« | `qa-question:b4cd1f3d-9…` | D     | Prüfungsorganisation (Paraphrase)            |
| 4   | Hervorgehobener Beleg: »Sollten wir eine Anwesenheitspflicht einführen?«          | `qa-question:becee93b-e…` | F     | Anwesenheitspflicht (umstritten, Paraphrase) |

**C3** (Session DHX6T3; 1 snapshotHash, 1 Reihenfolge; status ready; modelVersion extractive-v2; Quellen 4)

| #   | Aussage                                                                           | sourceId                  | Frage | Thema                                        |
| --- | --------------------------------------------------------------------------------- | ------------------------- | ----- | -------------------------------------------- |
| 1   | Hervorgehobener Beleg: »Ist Kapitel 4 klausurrelevant?«                           | `qa-question:2eccb50e-3…` | C     | Prüfungsorganisation (PINNED)                |
| 2   | Hervorgehobener Beleg: »Müssen wir den vierten Abschnitt für die Prüfung lernen?« | `qa-question:316dd69d-8…` | D     | Prüfungsorganisation (Paraphrase)            |
| 3   | Hervorgehobener Beleg: »Soll die Anwesenheit verpflichtend sein?«                 | `qa-question:7234a109-4…` | E     | Anwesenheitspflicht (umstritten)             |
| 4   | Hervorgehobener Beleg: »Sollten wir eine Anwesenheitspflicht einführen?«          | `qa-question:c0f1a850-6…` | F     | Anwesenheitspflicht (umstritten, Paraphrase) |

**C3b** (Session FSJCK7; 1 snapshotHash, 1 Reihenfolge; status ready; modelVersion extractive-v2; Quellen 4)

| #   | Aussage                                                                           | sourceId                  | Frage | Thema                                        |
| --- | --------------------------------------------------------------------------------- | ------------------------- | ----- | -------------------------------------------- |
| 1   | Hervorgehobener Beleg: »Soll die Anwesenheit verpflichtend sein?«                 | `qa-question:8eaef81b-f…` | E     | Anwesenheitspflicht (umstritten)             |
| 2   | Hervorgehobener Beleg: »Ist Kapitel 4 klausurrelevant?«                           | `qa-question:a9f1028f-9…` | C     | Prüfungsorganisation (PINNED)                |
| 3   | Hervorgehobener Beleg: »Müssen wir den vierten Abschnitt für die Prüfung lernen?« | `qa-question:b8a34868-7…` | D     | Prüfungsorganisation (Paraphrase)            |
| 4   | Hervorgehobener Beleg: »Sollten wir eine Anwesenheitspflicht einführen?«          | `qa-question:c72bd03f-3…` | F     | Anwesenheitspflicht (umstritten, Paraphrase) |

## CPU / RSS des Backendprozesses

Messung: `/proc/<pid>/stat` (utime+stime-Δ je 200-ms-Intervall, CLK_TCK = 100; 100 % = ein Kern) und `VmRSS`. Idle = 10 s nach 15 s Settle-Phase, ohne Anfragen. „Während Summary“ = Samples, deren 200-ms-Intervall ein Fenster [Request-Start, terminal] überlappt (inkl. Polling-Last des Treibers).

| Bedingung | Idle CPU % Median/Max | Summary CPU % Median/p95/Max (n) | Idle RSS MB Median/Max | Summary RSS MB Median/Max |
| --------- | --------------------- | -------------------------------- | ---------------------- | ------------------------- |
| C1        | 0.0/5.0               | 27.4/134.2/134.2 (18)            | 346.9/347.0            | 352.3/357.5               |
| C2        | 0.0/5.0               | 29.7/84.7/114.7 (44)             | 316.8/316.9            | 353.9/354.8               |
| C3        | 0.0/0.0               | 15.0/44.9/114.8 (73)             | 329.4/329.6            | 362.8/393.8               |
| C3b       | 0.0/5.0               | 14.9/69.9/125.4 (96)             | 337.4/337.4            | 365.5/370.6               |

## Backend-Logzeilen `qa_summary:completed`

<details><summary>C1 (5 Zeilen)</summary>

```text
run-01: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 143 }
run-03: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 154 }
run-05: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 143 }
run-07: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 122 }
run-09: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 124 }
```

</details>

<details><summary>C2 (20 Zeilen)</summary>

```text
burst-01: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 125 }
burst-02: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 140 }
burst-03: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 112 }
burst-04: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 136 }
burst-05: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 158 }
burst-06: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 107 }
burst-07: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 122 }
burst-08: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 114 }
burst-09: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 116 }
burst-10: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 112 }
spaced-01: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 122 }
spaced-02: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 121 }
spaced-03: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 117 }
spaced-04: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 115 }
spaced-05: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 132 }
spaced-06: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 122 }
spaced-07: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 108 }
spaced-08: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 189 }
spaced-09: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 118 }
spaced-10: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 148 }
```

</details>

<details><summary>C3 (10 Zeilen)</summary>

```text
burst-01: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: -923 }
burst-02: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1131 }
burst-03: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1178 }
burst-04: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1113 }
burst-05: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1114 }
burst-06: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1125 }
burst-07: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1123 }
burst-08: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1125 }
burst-09: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1142 }
burst-10: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1121 }
```

</details>

<details><summary>C3b (21 Zeilen)</summary>

```text
burst-01: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1139 }
burst-02: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1162 }
burst-03: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1131 }
burst-04: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 104 }
burst-05: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 133 }
burst-06: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 118 }
burst-07: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 118 }
burst-08: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 117 }
burst-09: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 106 }
burst-10: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 106 }
spaced-01: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1152 }
spaced-02: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1197 }
spaced-03: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1113 }
spaced-04: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 112 }
spaced-05: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 155 }
spaced-06: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1144 }
spaced-07: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1121 }
spaced-08: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1168 }
spaced-09: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 116 }
spaced-10: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 124 }
spaced-11: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1147 }
```

</details>

## Stub-Anfragen (C3/C3b)

`/v1/chat/completions` erreicht: 20× (Body 9639 Bytes), vom Client geschlossen nach 985–999 ms; `/slots?fail_on_no_slot=1` 20× mit Bearer-Token. In C3b werden Läufe mit `circuit_open` nicht an den Stub geschickt.

## Beobachtungen

1. **Release-Pfad trägt in allen Bedingungen.** Alle 62 Anfragen (C1 11, davon 6 Cache-Antworten; C2 20; C3 10; C3b 21) endeten mit `status: ready`, `effectiveMode: extractive`, `modelVersion: extractive-v2`. Es gab weder `failed` noch eine leere Karte. `fallback.reason` passt jeweils zur Bedingung (`disabled`, `unavailable`, `timeout`), dazu kommt `circuit_open`, sobald der Circuit-Breaker offen ist.
2. **Latenz.** Serverseitig braucht der extraktive Pfad etwa 150–190 ms (Median C1 143 ms, C2 122 ms). Diese Zeit geht fast vollständig in den doppelten Kontextaufbau (`prepare` vor und nach dem Lauf plus Hashvergleich); die eigentliche Extraktion ist nicht messbar. `qa.requestSummary` braucht selbst schon etwa 80–100 ms, weil es den Kontext synchron baut. Bis zum ersten nicht-`pending`-Zustand vergehen beim Client rund 270–310 ms (Polling alle 25 ms). In C3 kommen genau die 1000 ms Timeout hinzu (Server-Median 1125 ms).
3. **Auswahl: A und B fehlen immer.** Für Summary-V2 werden höchstens 4 Fragekandidaten gepackt (`QA_SUMMARY_MAX_QUESTION_CANDIDATES = 4`, `trimSummaryAnalysisQuestions`). Die Reihenfolge der Auswahl:
   - Zuerst die über das Kompass-Signal `high-controversy` geschützten Fragen E und F.
   - Dann im Lane-Round-Robin PINNED zuerst (C).
   - Dann ACTIVE nach `bestScore`: D 0,757 > B 0,722 > A 0,637.

   A hat die stärkste absolute Unterstützung (80 Ja-Stimmen, 110 Stimmen insgesamt). Sie fällt trotzdem heraus, weil die Wilson-Untergrenze kleine einstimmige Fragen (D 12/0, B 10/0) bevorzugt. Das Thema „lineare Regression“ ist damit im Fallback unsichtbar. Das Budget (6821/8192 Token) war nicht der Grund. Die Vorschau meldet die Kürzung als `questions −2 (deduplication)`, obwohl keine semantische Deduplikation stattfand (Themen sind deaktiviert); das Label ist irreführend.

4. **Reihenfolge = UUID-Reihenfolge.** `createExtractiveQaSummaryOutput` sortiert erst nach Quellart (`semantic-topic` < `qa-question` < `compass-signal` …) und dann per `localeCompare` nach `sourceId` (`qa-question:<UUIDv4>`). Die Reihenfolge der Aussagen ist damit pro Session zufällig: C1 E,C,D,F · C2 E,C,D,F · C3 C,D,E,F · C3b E,C,D,F. Sie folgt weder dem Score noch dem Pin; die gepinnte Frage C landete auf Position 2, 2, 1 und 2. Innerhalb einer Session ist sie deterministisch (ein snapshotHash, identische Ausgabe in allen Läufen).
5. **Kontroverse E/F nur indirekt sichtbar.** E und F erscheinen, aber nur als zwei getrennte Punkte „Hervorgehobener Beleg: »…«“, ohne Hinweis auf „umstritten“ oder das Stimmenverhältnis. Die Kompassquelle („Q&A controversy“, ein englisches Label im de-Kontext) liegt zwar im Quellregister, fällt aber durch `slice(0, 4)` heraus: Fragen haben Priorität 1, Kompass-Signale Priorität 2.
6. **Prüfungsorganisation C/D sichtbar, aber doppelt.** C (PINNED) und D erscheinen als zwei einzelne Belege. Weil semantische Themen fehlen, werden Paraphrasen nicht gebündelt. 4 Plätze gehen an 2 Themen (Prüfung, Anwesenheit), das dritte Thema (Regression) fällt weg.
7. **UI-Payload.** Das Runtime-DTO `qa.summaryRuntime` liefert dem Host-Client `execution.attemptedMode`, `effectiveMode` und `fallback.{mode, reason, retry}` vollständig aus. Laut statischer Durchsicht von `moderation-compass-dialog.component.{html,ts}` (nicht im Browser gerendert) zeigt die Summary-Karte aber nur Aussagen, Hinweise und einen Statustext für pending/failed/uncertain.
   - Der Grund des Fallbacks wird nicht angezeigt. Nur der Hinweis „Extraktive Kurzfassung ohne generative Interpretation.“ verrät den Modus; `disabled`, `unavailable`, `timeout` und `circuit_open` sind für den Host nicht unterscheidbar.
   - Die Diagnose zeigt als „Modus“ `preview.selectedMode`, also den Plan. In C2/C3 steht dort deshalb „Vollständiger Kontext“, obwohl jedes tatsächliche Ergebnis extraktiv war.
8. **Cooldown/Cache.** In C1 (`disabled`, `retry: not-applicable`) lieferte eine zweite Anfrage innerhalb von 30 s sofort das gecachte Ergebnis (kein Queue-Job, keine Logzeile). Der Treiber wartete jeweils 31 s (Monotonuhr); die Wanduhr der WSL2-VM lief in diesem Lauf aber rund 5 % langsamer (Start-zu-Start 29,3–29,6 s laut `startedAt`). Deshalb fiel jede zweite Anfrage noch in das 30-s-Fenster: 5 echte Jobs, 6 Cache-Antworten, alle mit identischem Inhalt und Grund `disabled`. Das ist ein Laborartefakt, kein Produktverhalten (Lauf auf a657798e: 10 Jobs, 1 Cache-Antwort). In C2/C3 (`retry: manual`) blockiert der Cooldown nicht: Jede Anfrage im Burst startete einen neuen Job, auch bei unverändertem snapshotHash.
9. **Circuit-Breaker.**
   - C2 (ECONNREFUSED): Nach 3 `unavailable` ist der Circuit 30 s offen (`OPEN_WEIGHT_LLM_CIRCUIT_FAILURE_THRESHOLD = 3`, `OPEN_MS = 30000`). In dieser Zeit liefert jede Anfrage ohne Runtime-Kontakt denselben extraktiven Text mit `circuit_open` (Burst 3× unavailable, dann 7× circuit_open; in der Spaced-Phase 3 weitere circuit_open).
   - C3: Hier öffnet der Circuit nie. Der effektive Queue-Timeout ist `max(QA_SUMMARY_TIMEOUT_MS, OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS)` und damit nie kleiner als der Client-Timeout. Bei Gleichstand (hier 1000/1000 ms, im Default 90 000/90 000 ms) feuert der früher gestartete Queue-Timer zuerst und bricht den Client ab. Der Client klassifiziert das als `aborted`, und `aborted` zählt nicht für den Circuit. Ergebnis: 10/10 Timeouts, kein `circuit_open`, jeder hielt die Runtime etwa 1 s (Stub-Log 985–999 ms).
   - C3b (Queue 3000 > Client 1000 ms): Der Client-Timeout gewinnt, zählt als `timeout`, und der Circuit öffnet nach 3 Fehlschlägen.
   - Folgerung: Mit Default-Timeouts wird eine hängende Runtime nie per Circuit-Breaker abgeschnitten, und jede Anfrage wartet 90 s (siehe C2a).
10. **C2a (WSL2-Artefakt, aber lehrreich).** Eine nicht antwortende IPv4-Adresse (SYN ohne RST) führt mit Default-Timeouts zu 90,1 s bis zum Fallback, 8 Mal hintereinander, ohne `circuit_open`. Der Host sieht in dieser Zeit `pending`.
11. **Ressourcen.** Leerlauf: CPU-Median 0 %, RSS etwa 315–350 MB. In Summary-Fenstern liegt die CPU im Median bei 15–30 % eines Kerns (Spitzen bis 135 % in C1; das schließt die Polling-Last des Treibers und zwei Kontextaufbauten pro Job ein). Der RSS steigt dabei um etwa 5–65 MB. Der extraktive Fallback kostet damit praktisch nichts, verglichen mit dem dokumentierten generativen Lauf (~56,9 s auf 8 vCPU).
12. **Scores und Abstimmung.** Alle Backend-Werte stimmen auf 4 Nachkommastellen mit Wilson und Kontroversitätsformel überein (N = 200, T = 20). B und D tragen `controversyInsufficientVotes: true`. Votes auf PENDING-Fragen lehnt der Server mit `BAD_REQUEST` ab, deshalb wurde vor dem Abstimmen freigegeben (APPROVE).
13. **Kein `source_changed`.** Der snapshotHash blieb über alle Läufe einer Session stabil; Polling auf `qa.summaryRuntime` erzeugte keine Neubindung.
