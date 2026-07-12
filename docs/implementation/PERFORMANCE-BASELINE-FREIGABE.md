# Performance-Baseline und Freigabe

**Stand:** 2026-07-12

Dieses Dokument beschreibt den verbleibenden betrieblichen Nachweis für Story **0.7**:
freigegebene Last-/Performance-Baselines ohne separaten Staging-Server.

Die technischen Gates (Unit, Browser, Yjs, Vote-p95, Lighthouse, CI) sind im
[QA-Nachlauf vom 2026-07-11](LOCAL-QA-RECHECK-2026-07-11.md) lokal grün. Dieser
Schritt ersetzt keinen erneuten Code-Fix, sondern liefert den produktionsnahen
Langzeit- und Regressionsnachweis.

## Voraussetzungen in GitHub

### Repository-Variablen

| Variable                  | Zweck                                          | Beispiel |
| ------------------------- | ---------------------------------------------- | -------- |
| `ARTILLERY_PARTICIPANTS`  | Standard für Nacht-/Manuell-Läufe              | `500`    |
| `ARTILLERY_RAMP_SECONDS`  | Ramp-up-Dauer                                  | `60`     |
| `PRODUCTION_LOAD_ENABLED` | Nacht-k6 gegen Produktion (`true` nur bewusst) | `false`  |
| `DEPLOY_ENABLED`          | Produktions-Deploy in CI                       | `true`   |

Ein separater Staging-Server ist **nicht** vorgesehen. Der frühere CI-Job
`staging-capacity` wurde entfernt (2026-07-12).

### GitHub-Environments

| Environment  | Zweck               |
| ------------ | ------------------- |
| `production` | Deploy und Rollback |

## Ablauf: Kapazitätslauf (CI-Runner)

Kapazitätsnachweise gegen PostgreSQL/Redis im GitHub-Actions-Runner:

1. In GitHub Actions **CI → Run workflow** ausführen (oder den täglichen Schedule abwarten).
2. Optional anpassen:
   - `artillery_participants`: `500`
   - `artillery_ramp_seconds`: `60`
3. Artefakte prüfen:
   - `artillery-500-reports` — Live-Session, Vote-Smokes, Yjs, Freitext, 5-Min-Soak
   - `artillery-reconnect-500-reports` — Reconnect-Welle
4. Ergebnis im Messprotokoll festhalten
   ([VORLAGE-MESSPROTOKOLL-LAST.md](../praktikum/VORLAGE-MESSPROTOKOLL-LAST.md)).

Details zu den Jobs: [CI-WORKFLOW.md](../CI-WORKFLOW.md) (Abschnitte `artillery-500`,
`artillery-reconnect-500`).

## Ablauf: 30-/60-Minuten-Soak

Lokal gegen dasselbe Backend-Setup wie in CI:

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
   - Zielumgebung (CI-Runner / lokaler Soak / Produktion nach Deploy)
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

**Status: ✅ abgeschlossen (2026-07-12)**

Freigegeben durch den [lokalen Baseline-Lauf](LOCAL-BASELINE-FREIGABE-2026-07-12.md):

1. ✅ dokumentierter 30-Minuten-Soak lokal grün (874 Zyklen, HTTP-p95 16,7 ms)
2. ✅ Artillery Live- und Reconnect-Welle mit 500 Teilnehmenden lokal grün
3. ✅ Baseline-Reports und Regressionsbudgets unter
   `scripts/load/baselines/reports/story-0.7-2026-07-12/` und
   `scripts/load/baselines/budgets/story-0.7/`; Übersicht im Manifest
   `scripts/load/baselines/manifests/story-0.7-2026-07-12.json`
