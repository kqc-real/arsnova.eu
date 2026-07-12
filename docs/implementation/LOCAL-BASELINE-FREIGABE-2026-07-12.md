# Lokale Baseline-Freigabe — Story 0.7

**Stand:** 2026-07-12  
**Commit:** `e3285372` (nach Merge #48, #52, #53, #54)  
**Zielumgebung:** Lokales Dev-Setup (PostgreSQL 16, Redis 7, `npm run dev:backend`)  
**Artefakte (nicht versioniert):** `artifacts/story-0.7-baseline-2026-07-12/`

## Ergebnis

Alle betrieblichen Nachweise für Story **0.7** sind lokal grün. Die Story gilt damit
als **abgeschlossen**.

| Nachweis                   | Status | Kennzahlen                                                               |
| -------------------------- | ------ | ------------------------------------------------------------------------ |
| Vote-Timer-Fairness 600    | ✅     | ACTIVE p95 788 ms, Karenz p95 992 ms, 600/600 akzeptiert bzw. abgewiesen |
| Host-Vote-Progress 200     | ✅     | Vote-p95 153 ms, 200/200 Votes, 0 Subscription-Fehler                    |
| Artillery Live-Session 500 | ✅     | 500/500 Joins, Votes, WS; Host-Status `RESULTS`                          |
| Artillery Reconnect 500    | ✅     | 500/500 Reconnects, 500/500 `RESULTS` nach Reconnect                     |
| Yjs-Sync 30 Clients        | ✅     | Connect-p95 73 ms, Reconnect-p95 324 ms, Konvergenz 6 ms                 |
| Soak Live-Session 30 min   | ✅     | 874 Zyklen, HTTP-p95 16,7 ms, RSS-Wachstum 26,4 MB, 0 Fehler             |

## Laufparameter

```bash
# Infrastruktur
docker compose up -d postgres redis
npm run dev:backend

# Kapazität & Hotpaths (Auszug)
export TRPC_URL=http://127.0.0.1:3000/trpc WS_URL=ws://127.0.0.1:3001
export VOTE_P95_LIMIT_MS=2000   # Baseline-Lauf; lokales 1.000-ms-Gate siehe QA-Nachlauf 2026-07-11
REPORT_DIR=artifacts/story-0.7-baseline-2026-07-12

PARTICIPANTS=600 npm run load:smoke:vote-timer-fairness
PARTICIPANTS=200 npm run load:smoke:host-vote-progress
PARTICIPANTS=500 ARTILLERY_RAMP_SECONDS=60 npm run load:artillery:500
PARTICIPANTS=500 ARTILLERY_RAMP_SECONDS=60 npm run load:artillery:reconnect:500
CLIENTS=30 npm run load:yjs:sync

SOAK_DURATION_MINUTES=30 \
SOAK_BACKEND_PID="$(lsof -t -i :3000)" \
SOAK_REDIS_URL=redis://127.0.0.1:6379 \
SOAK_DATABASE_URL="$DATABASE_URL" \
npm run load:soak:live-session
```

## Soak-Assertions (30 min)

| Assertion                   | Ist      | Limit    | Ergebnis |
| --------------------------- | -------- | -------- | -------- |
| Funktionale Fehler          | 0        | 0        | ✅       |
| HTTP-p95                    | 16,68 ms | 2.000 ms | ✅       |
| Event-Loop-p99 (Generator)  | 22,43 ms | 200 ms   | ✅       |
| Backend-RSS-Wachstum        | 26,41 MB | 256 MB   | ✅       |
| Redis-Probe-Fehlerrate      | 0 %      | —        | ✅       |
| PostgreSQL-Probe-Fehlerrate | 0 %      | —        | ✅       |

## Bezug zu früheren Nachweisen

- Technische Regressionen: [LOCAL-QA-RECHECK-2026-07-11.md](LOCAL-QA-RECHECK-2026-07-11.md)
- Gesamtlastmatrix: [LOCAL-TESTRUN-2026-07-10.md](LOCAL-TESTRUN-2026-07-10.md)
- Freigabeprozess: [PERFORMANCE-BASELINE-FREIGABE.md](PERFORMANCE-BASELINE-FREIGABE.md)

## Freigabe

**Story 0.7 — betrieblich freigegeben** am 2026-07-12 auf Basis der obigen Läufe.
Regressionsvergleiche künftiger Läufe gegen diese Baseline über
`scripts/load/baselines/story-0.7-2026-07-12.json` und `npm run load:report:compare`.
