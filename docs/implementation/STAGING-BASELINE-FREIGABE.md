# Staging-Baseline und Performance-Freigabe

**Stand:** 2026-07-11

Dieses Dokument beschreibt den verbleibenden betrieblichen Nachweis für Story **0.7**:
freigegebene Last-/Performance-Baselines aus einer stabilen Staging-Umgebung.

Die technischen Gates (Unit, Browser, Yjs, Vote-p95, Lighthouse, CI) sind im
[QA-Nachlauf vom 2026-07-11](LOCAL-QA-RECHECK-2026-07-11.md) lokal grün. Dieser
Schritt ersetzt keinen erneuten Code-Fix, sondern liefert den produktionsnahen
Langzeit- und Regressionsnachweis.

## Voraussetzungen in GitHub

### Repository-Variablen

| Variable                  | Zweck                                          | Beispiel                           |
| ------------------------- | ---------------------------------------------- | ---------------------------------- |
| `STAGING_BASE_URL`        | HTTPS-Frontend der Staging-Umgebung            | `https://staging.arsnova.eu`       |
| `STAGING_TRPC_URL`        | HTTPS-tRPC-Endpunkt                            | `https://staging.arsnova.eu/trpc`  |
| `STAGING_WS_URL`          | WSS-tRPC-WebSocket                             | `wss://staging.arsnova.eu/trpc-ws` |
| `ARTILLERY_PARTICIPANTS`  | Standard für Nacht-/Manuell-Läufe              | `500`                              |
| `ARTILLERY_RAMP_SECONDS`  | Ramp-up-Dauer                                  | `60`                               |
| `PRODUCTION_LOAD_ENABLED` | Nacht-k6 gegen Produktion (`true` nur bewusst) | `false`                            |
| `DEPLOY_ENABLED`          | Produktions-Deploy in CI                       | `true`                             |

Die Staging-URLs dürfen **nicht** auf `https://arsnova.eu` zeigen. Der Job
`staging-capacity` bricht in diesem Fall absichtlich ab.

### GitHub-Environments

| Environment           | Zweck                                       |
| --------------------- | ------------------------------------------- |
| `performance-staging` | Manueller Kapazitätslauf `staging-capacity` |
| `production`          | Deploy und Rollback                         |

Beide Umgebungen sollten ohne Admin-Bypass und mit Branch-Schutz konfiguriert
sein. Details zum aktuellen Enforcement stehen im
[QA-Nachlauf](LOCAL-QA-RECHECK-2026-07-11.md).

## Ablauf: Staging-Kapazitätslauf

1. Staging-Stack mit gleicher Migrationskette wie Produktion betreiben
   (`prisma migrate deploy`, kein `db push`).
2. Repository-Variablen setzen (siehe oben).
3. In GitHub Actions **CI → Run workflow** ausführen:
   - `run_staging_capacity`: `true`
   - `staging_participants`: `500` (oder Zielwert)
   - `artillery_ramp_seconds`: `60`
4. Artefakt `staging-capacity-reports` herunterladen und prüfen:
   - Artillery Live-Session: 500/500 Joins, Votes, WS
   - Artillery Reconnect: 500/500 Reconnects
   - Browser-Referenzflow `smoke:unified-session` parallel grün
5. Ergebnis im Messprotokoll festhalten
   ([VORLAGE-MESSPROTOKOLL-LAST.md](../praktikum/VORLAGE-MESSPROTOKOLL-LAST.md)).

## Ablauf: 30-/60-Minuten-Soak

Lokal oder in Staging gegen dieselbe Zielumgebung:

```bash
npm run dev:backend
SOAK_DURATION_MINUTES=30 \
SOAK_BACKEND_PID="$(pgrep -f 'apps/backend' | head -n1)" \
SOAK_REDIS_URL=redis://127.0.0.1:6379 \
SOAK_DATABASE_URL="$DATABASE_URL" \
npm run load:soak:live-session
```

Für 60 Minuten `SOAK_DURATION_MINUTES=60` setzen. Akzeptanz aus dem lokalen
5-Minuten-Nachweis als Orientierung:

- HTTP-Fehlerrate 0 %
- HTTP-p95 stabil unter 50 ms im Kurzlauf
- Backend-RSS-Wachstum ohne anhaltenden Leak
- Redis- und PostgreSQL-Probes ohne Ausreißer

## Baseline-Freigabe

1. JSON-Reports der freigegebenen Läufe versionieren oder als Artefakt archivieren
   (nicht unter `artifacts/` im Repo).
2. Referenzwerte in einer Budget-Datei festhalten, z. B. auf Basis von
   `scripts/load/load-regression-budgets.example.json`.
3. Regressionsvergleich:

```bash
npm run load:report:compare -- \
  --current <aktueller-report.json> \
  --baseline <freigegebener-report.json> \
  --config scripts/load/load-regression-budgets.example.json
```

4. Freigabe dokumentieren:
   - Datum und Commit-Stand
   - Zielumgebung (Staging/Produktion)
   - Teilnehmerzahl und Dauer
   - p95/p99, Fehlerrate, beobachtete Engpässe
   - Verantwortliche Freigabe

## Referenzwerte aus dem QA-Nachlauf 2026-07-11

Diese Werte dienen als **lokale Referenz**, nicht als freigegebene Produktionsbaseline:

| Szenario              | Kennzahl                  | Wert           |
| --------------------- | ------------------------- | -------------- |
| Yjs-Reconnect         | Konvergenz nach Reconnect | 6 ms           |
| Yjs-Reconnect         | Reconnect-p95             | 329 ms         |
| Vote-Timer 600 ACTIVE | Vote-p95                  | 766 ms         |
| Vote-Timer 600 Karenz | Vote-p95                  | 968 ms         |
| Lighthouse `/de/`     | Performance               | 0,79–0,80      |
| Lighthouse `/de/`     | LCP                       | 3.705–3.829 ms |
| Browser-Smokes        | bestanden                 | 6/6            |

## Abschlusskriterium Story 0.7

Story 0.7 gilt betrieblich abgeschlossen, wenn:

1. ein dokumentierter 30- oder 60-Minuten-Soak in Staging grün ist,
2. ein Staging-Kapazitätslauf mit 500 Teilnehmenden grün ist,
3. die Baseline-Reports fachlich freigegeben und für `load:report:compare`
   nutzbar sind.

Bis dahin bleibt die Story **🟡 in Arbeit**, obwohl PR-Gates und lokale
Nachweise grün sind.
