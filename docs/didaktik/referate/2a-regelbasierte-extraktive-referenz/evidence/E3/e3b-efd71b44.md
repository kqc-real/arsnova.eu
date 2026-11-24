# E3b – Release-Pfad des extraktiven Q&A-Summary-Fallbacks (efd71b44)

Erzeugt: 2026-11-08T14:43:01.368Z · Rohdaten: `e3b-efd71b44.json`

## Umgebung

| Feld                     | Wert                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commit                   | `efd71b44d4fd32d711cd483606ce5eefd1e9af5b`                                                                                                                 |
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
- Setup-Zeiten C1: create 115 ms, 200 Joins 4386 ms, Submit 116 ms, 282 Votes 1663 ms.

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

- Fragenkorpus: total 6, eligible 6, analyzed 6, deduplicated 3, represented 3; `selectionLimits.questions` = 3.
- Budget: packedInputTokens 7122/8192; Kürzungen: questions −3 (deduplication).
- Quellen im Register (C1, Reihenfolge wie geliefert): compass-signal „Q&A controversy“ · compass-signal „Pinned Q&A questions“ · qa-question »Ist Kapitel 4 klausurrelevant?« · qa-question »Soll die Anwesenheit verpflichtend sein?« · qa-question »Sollten wir eine Anwesenheitspflicht einführen?«.
- Kompass-Signale: high-controversy (Wert 0.8, Fragen: E+F); pinned-question (Wert 1, Fragen: C).
- Vorschau-Modus/Fallback je Bedingung: C1: selectedMode=null, fallback=disabled; C2: selectedMode=full-context, fallback=null; C3: selectedMode=full-context, fallback=null; C3b: selectedMode=full-context, fallback=null.

## Bedingungen und exakte Env

### C1 – disabled

Open-Weight aus, keine Legacy-URL

```env
NODE_ENV=development
DATABASE_URL=postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_e3b_efd71b44?schema=public
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
DATABASE_URL=postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_e3b_efd71b44?schema=public
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
DATABASE_URL=postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_e3b_efd71b44?schema=public
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
DATABASE_URL=postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_e3b_efd71b44?schema=public
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
| C1        | 10    | extractive    | null          | disabled (10)            | not-applicable | ready  | 98/121                | 272/314                | 108/127              | 4            |
| C2        | 10    | extractive    | full-context  | unavailable (10)         | manual         | ready  | 78/117                | 251/315                | 104/140              | 3            |
| C2        | 9     | extractive    | full-context  | circuit_open (9)         | manual         | ready  | 66/77                 | 216/258                | 88/129               | 3            |
| C3        | 10    | extractive    | full-context  | timeout (10)             | manual         | ready  | 78/97                 | 1281/1330              | 1137/1150            | 31           |
| C3b       | 10    | extractive    | full-context  | timeout (10)             | manual         | ready  | 77/121                | 1263/1313              | 1113/1127            | 29           |
| C3b       | 9     | extractive    | full-context  | circuit_open (9)         | manual         | ready  | 73/98                 | 215/283                | 95/111               | 3            |

Reihenfolge der Gründe (Burst = direkt hintereinander, Spaced = nach 31 s Wartezeit bei `circuit_open`):

- C1: run-01=disabled, cooldown-probe-immediate=CACHE(disabled), run-02=disabled, run-03=disabled, run-04=disabled, run-05=disabled, run-06=disabled, run-07=disabled, run-08=disabled, run-09=disabled, run-10=disabled
- C2: burst-01=unavailable, burst-02=unavailable, burst-03=unavailable, burst-04=circuit_open, burst-05=circuit_open, burst-06=circuit_open, burst-07=circuit_open, burst-08=circuit_open, burst-09=circuit_open, burst-10=circuit_open, spaced-01=unavailable, spaced-02=unavailable, spaced-03=unavailable, spaced-04=circuit_open, spaced-05=unavailable, spaced-06=unavailable, spaced-07=unavailable, spaced-08=circuit_open, spaced-09=unavailable
- C3: burst-01=timeout, burst-02=timeout, burst-03=timeout, burst-04=timeout, burst-05=timeout, burst-06=timeout, burst-07=timeout, burst-08=timeout, burst-09=timeout, burst-10=timeout
- C3b: burst-01=timeout, burst-02=timeout, burst-03=timeout, burst-04=circuit_open, burst-05=circuit_open, burst-06=circuit_open, burst-07=circuit_open, burst-08=circuit_open, burst-09=circuit_open, burst-10=circuit_open, spaced-01=timeout, spaced-02=timeout, spaced-03=timeout, spaced-04=circuit_open, spaced-05=timeout, spaced-06=timeout, spaced-07=timeout, spaced-08=circuit_open, spaced-09=timeout

### Extraktive Aussagen (wörtlich) und Quellenzuordnung

Innerhalb jeder Bedingung waren alle Läufe inhaltsgleich (ein snapshotHash, eine Reihenfolge). `modelVersion` = `extractive-v2`, `limitations` = [„Eine ausführliche Zusammenfassung war diesmal nicht möglich. Deshalb werden die wichtigsten Fragen im Wortlaut angezeigt.“], `suggestedNextSteps` = [].

**C1** (Session VZ23SS; 1 snapshotHash, 1 Reihenfolge; status ready; modelVersion extractive-v2; Quellen 3)

| #   | Aussage                                         | sourceId                  | Frage | Thema                                        |
| --- | ----------------------------------------------- | ------------------------- | ----- | -------------------------------------------- |
| 1   | Ist Kapitel 4 klausurrelevant?                  | `qa-question:1782135e-a…` | C     | Prüfungsorganisation (PINNED)                |
| 2   | Soll die Anwesenheit verpflichtend sein?        | `qa-question:61277325-c…` | E     | Anwesenheitspflicht (umstritten)             |
| 3   | Sollten wir eine Anwesenheitspflicht einführen? | `qa-question:da25d5ac-2…` | F     | Anwesenheitspflicht (umstritten, Paraphrase) |

**C2** (Session 2X8QXS; 1 snapshotHash, 1 Reihenfolge; status ready; modelVersion extractive-v2; Quellen 3)

| #   | Aussage                                         | sourceId                  | Frage | Thema                                        |
| --- | ----------------------------------------------- | ------------------------- | ----- | -------------------------------------------- |
| 1   | Ist Kapitel 4 klausurrelevant?                  | `qa-question:3b2dd59f-b…` | C     | Prüfungsorganisation (PINNED)                |
| 2   | Sollten wir eine Anwesenheitspflicht einführen? | `qa-question:b9966353-f…` | F     | Anwesenheitspflicht (umstritten, Paraphrase) |
| 3   | Soll die Anwesenheit verpflichtend sein?        | `qa-question:dd987d09-b…` | E     | Anwesenheitspflicht (umstritten)             |

**C3** (Session QZ2SBE; 1 snapshotHash, 1 Reihenfolge; status ready; modelVersion extractive-v2; Quellen 3)

| #   | Aussage                                         | sourceId                  | Frage | Thema                                        |
| --- | ----------------------------------------------- | ------------------------- | ----- | -------------------------------------------- |
| 1   | Sollten wir eine Anwesenheitspflicht einführen? | `qa-question:40ed7b02-b…` | F     | Anwesenheitspflicht (umstritten, Paraphrase) |
| 2   | Soll die Anwesenheit verpflichtend sein?        | `qa-question:6dbfd839-b…` | E     | Anwesenheitspflicht (umstritten)             |
| 3   | Ist Kapitel 4 klausurrelevant?                  | `qa-question:e0261bb1-6…` | C     | Prüfungsorganisation (PINNED)                |

**C3b** (Session 6K6VFB; 1 snapshotHash, 1 Reihenfolge; status ready; modelVersion extractive-v2; Quellen 3)

| #   | Aussage                                         | sourceId                  | Frage | Thema                                        |
| --- | ----------------------------------------------- | ------------------------- | ----- | -------------------------------------------- |
| 1   | Sollten wir eine Anwesenheitspflicht einführen? | `qa-question:25d4eec5-1…` | F     | Anwesenheitspflicht (umstritten, Paraphrase) |
| 2   | Soll die Anwesenheit verpflichtend sein?        | `qa-question:a42fdf0e-5…` | E     | Anwesenheitspflicht (umstritten)             |
| 3   | Ist Kapitel 4 klausurrelevant?                  | `qa-question:a4b0a4d2-0…` | C     | Prüfungsorganisation (PINNED)                |

## CPU / RSS des Backendprozesses

Messung: `/proc/<pid>/stat` (utime+stime-Δ je 200-ms-Intervall, CLK_TCK = 100; 100 % = ein Kern) und `VmRSS`. Idle = 10 s nach 15 s Settle-Phase, ohne Anfragen. „Während Summary“ = Samples, deren 200-ms-Intervall ein Fenster [Request-Start, terminal] überlappt (inkl. Polling-Last des Treibers).

| Bedingung | Idle CPU % Median/Max | Summary CPU % Median/p95/Max (n) | Idle RSS MB Median/Max | Summary RSS MB Median/Max |
| --------- | --------------------- | -------------------------------- | ---------------------- | ------------------------- |
| C1        | 0.0/30.1              | 22.5/94.4/99.8 (24)              | 359.8/359.8            | 362.5/366.8               |
| C2        | 0.0/20.0              | 29.8/94.5/94.7 (37)              | 349.8/349.8            | 376.7/380.9               |
| C3        | 0.0/5.0               | 15.0/49.9/90.1 (72)              | 337.3/337.4            | 372.4/389.0               |
| C3b       | 0.0/19.9              | 15.0/40.0/105.3 (87)             | 334.5/334.7            | 359.9/362.4               |

## Backend-Logzeilen `qa_summary:completed`

<details><summary>C1 (10 Zeilen)</summary>

```text
run-01: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 120 }
run-02: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 127 }
run-03: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 118 }
run-04: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 101 }
run-05: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 99 }
run-06: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 97 }
run-07: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 103 }
run-08: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 119 }
run-09: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 109 }
run-10: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'disabled', latencyMs: 107 }
```

</details>

<details><summary>C2 (19 Zeilen)</summary>

```text
burst-01: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 125 }
burst-02: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 102 }
burst-03: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 140 }
burst-04: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 92 }
burst-05: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 83 }
burst-06: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 89 }
burst-07: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 84 }
burst-08: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 87 }
burst-09: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 87 }
burst-10: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 88 }
spaced-01: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 134 }
spaced-02: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 93 }
spaced-03: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 96 }
spaced-04: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 98 }
spaced-05: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 101 }
spaced-06: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 110 }
spaced-07: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 97 }
spaced-08: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 129 }
spaced-09: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 105 }
```

</details>

<details><summary>C3 (10 Zeilen)</summary>

```text
burst-01: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1149 }
burst-02: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1141 }
burst-03: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1150 }
burst-04: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: -98 }
burst-05: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1127 }
burst-06: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1104 }
burst-07: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1104 }
burst-08: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1137 }
burst-09: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1114 }
burst-10: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1138 }
```

</details>

<details><summary>C3b (19 Zeilen)</summary>

```text
burst-01: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1122 }
burst-02: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1114 }
burst-03: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1099 }
burst-04: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 96 }
burst-05: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 111 }
burst-06: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 95 }
burst-07: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 92 }
burst-08: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 88 }
burst-09: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 97 }
burst-10: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 93 }
spaced-01: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1112 }
spaced-02: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1119 }
spaced-03: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1106 }
spaced-04: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 101 }
spaced-05: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1103 }
spaced-06: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1127 }
spaced-07: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1102 }
spaced-08: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'circuit_open', latencyMs: 86 }
spaced-09: qa_summary:completed { status: 'ready', effectiveMode: 'extractive', fallbackReason: 'timeout', latencyMs: 1118 }
```

</details>

## Stub-Anfragen (C3/C3b)

`/v1/chat/completions` erreicht: 20× (Body 9997 Bytes), vom Client geschlossen nach -221–1000 ms; `/slots?fail_on_no_slot=1` 20× mit Bearer-Token. In C3b werden Läufe mit `circuit_open` nicht an den Stub geschickt.

## Beobachtungen

1. **Release-Pfad trägt in allen Bedingungen.** Alle 59 Anfragen (C1 11, davon 1 Cache-Antwort; C2 19; C3 10; C3b 19) endeten mit `status: ready`, `effectiveMode: extractive`, `modelVersion: extractive-v2`. Es gab weder `failed` noch eine leere Karte. `fallback.reason` passt jeweils zur Bedingung (`disabled` 11, `unavailable` 10, `timeout` 20), dazu kommt `circuit_open` (18), sobald der Circuit-Breaker nach drei Fehlschlägen offen ist.
2. **Latenz.** Serverseitig braucht der extraktive Pfad im Median 108 ms (C1), 104 ms (C2 `unavailable`) und 88 ms (C2 `circuit_open`). Unter C3/C3b bestimmt das Timeout von 1 s die Dauer (Median 1113–1137 ms). Die Zeit geht fast vollständig in den Kontextaufbau; die eigentliche Extraktion ist nicht messbar.
3. **Auswahl: nur drei Plätze, alle durch Signale belegt.** Seit dem 05.11.2026 behält `trimSummaryAnalysisQuestions` bei weniger als 100 Fragen höchstens 3 Fragekandidaten (`moderationSummaryContext.ts`, Z. 192–197; bei großen Sitzungen bis zu 16). Zuerst werden die durch Kompass-Signale geschützten Fragen aufgenommen: `high-controversy` schützt E und F, `pinned-question` schützt C. Damit sind alle drei Plätze vergeben, bevor die Rangfolge nach Best-Score greift. A, B und D erscheinen in keinem der 59 Läufe. Der Übungswunsch (A 80:30, die meiste Zustimmung; B) ist im Fallback vollständig unsichtbar, die Prüfungsorganisation nur über C vertreten. Gegenüber `9f230abc` (4 Plätze: E, F, C, D) ist damit zusätzlich D weggefallen.
4. **Ausgabe im Wortlaut.** `createExtractiveQaSummaryOutput` gibt Fragen jetzt ohne Präfix im Originalwortlaut aus und bevorzugt Fragen gegenüber Themen und Signalen, sobald mindestens zwei Fragen vorliegen (`qaSummaryExtractive.ts`, Z. 136–141). Die Reihenfolge folgt weiter der `sourceId` (UUID) und ist damit je Sitzung zufällig: C1 C, E, F · C2 C, F, E · C3 F, E, C · C3b F, E, C.
5. **Rückfall angekündigt, Grund und Grenze nicht.** Jede Ausgabe trägt den Hinweis „Eine ausführliche Zusammenfassung war diesmal nicht möglich. Deshalb werden die wichtigsten Fragen im Wortlaut angezeigt.“ Der konkrete Grund (`fallback.reason`) und die Auswahlgrenze (3 von 6 Fragen) erscheinen nicht ohne weiteren Klick; sie stehen nur in der eingeklappten Diagnose, die erst auf Anforderung lädt. E und F erscheinen weiterhin ohne Hinweis auf die geteilte Bewertung.
6. **Kontextvorschau.** Die Vorschau meldet die Kürzung von 6 auf 3 Fragen mit dem Grund `deduplication`, obwohl die Grenze von 3 Kandidaten greift; Paraphrasen werden ohne semantische Themen nicht gebündelt.
7. **Schutzschalter und hängende Laufzeit.** Nach drei Fehlschlägen öffnet der Schutzschalter für 30 s (C2, C3b). Eine hängende Laufzeitumgebung ohne Client-Timeout ließ im Vorlauf C2a jede Anfrage rund 90 s warten, ohne dass der Schutzschalter öffnete (Lauf vom 21.10.2026 auf `a657798e`, nicht wiederholt).
8. **Cache.** In C1 war nur die sofortige Wiederholung nach dem ersten Lauf eine Cache-Antwort (Abklingzeit 30 s); alle weiteren Läufe nach 31 s Wartezeit waren neue Aufträge.
