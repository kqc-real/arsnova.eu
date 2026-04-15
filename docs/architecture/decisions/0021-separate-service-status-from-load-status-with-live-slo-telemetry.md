<!-- markdownlint-disable MD013 -->

# ADR-0021: Trennung von Betriebsstatus (SLO) und Systemlast mit Live-Telemetrie

**Status:** Accepted  
**Datum:** 2026-04-15  
**Entscheider:** Projektteam

## Kontext

Die bisherige Footer-Ampel wurde als ein einziger Status (`serverStatus`) aus Lastindikatoren berechnet. In der Produktnutzung fuehrte das zu zwei Problemen:

1. **Semantische Vermischung:** Die Anzeige im Footer wurde als "Betriebsstatus" gelesen, technisch war sie aber nur ein Lastproxy.
2. **Unklare Erwartung bei Lehrenden:** Lehrende benoetigen primaer eine Aussage zur erwartbaren Qualitaet (Antwortzeit, Stabilitaet), nicht nur zur absoluten Last.
3. **Diagnosebedarf:** Fuer Betrieb und Analyse bleiben Lasttreiber weiterhin wichtig, sollen aber getrennt dargestellt werden.

Parallel wurde bereits ein Lastmodell mit dynamischen Signalen aufgebaut (aktive Teilnehmende, Votes/min, Transitions/min, Countdown-Aktivitaet). Es fehlte jedoch die direkte Rueckkopplung zu SLO-Kriterien.

## Entscheidung

### 1. API trennt Betriebsstatus und Laststatus

`health.stats` liefert kuenftig zwei getrennte Statusfelder:

- `serviceStatus`: `stable | limited | critical` (SLO-nahe Betriebsampel)
- `loadStatus`: `healthy | busy | overloaded` (Lastindikator fuer Diagnose)

`serverStatus` wird ersetzt.

### 2. Laststatus bleibt indikatorgetrieben

`loadStatus` wird weiterhin aus Lastsignalen abgeleitet:

- aktive Sessions
- aktive Teilnehmende (Redis Presence)
- aktive Blitz-Runden
- Votes/Minute
- Session-Transitions/Minute
- aktive Countdown-Sessions

Damit bleibt `loadStatus` als Fruehindikator erhalten.

### 3. Betriebsstatus basiert auf echter SLO-Telemetrie

`serviceStatus` wird aus Live-Telemetrie im Rolling Window (60s) berechnet:

- `p95` und `p99` Latenz
- Fehlerquote (`TOO_MANY_REQUESTS`, `INTERNAL_SERVER_ERROR`)
- Request-Anzahl als Sample-Guard

SLO-Schwellen:

- **stable:** Fehler <= 0.5 %, p95 <= 1000 ms, p99 <= 2000 ms
- **limited:** Fehler <= 1.0 %, p95 <= 1500 ms, p99 <= 3000 ms
- **critical:** sonst

Bei sehr kleiner Stichprobe (`< 20` Requests/Minute) nutzt `serviceStatus` ein dokumentiertes Fallback aus `loadStatus`, um Flattern durch Ausreisser zu vermeiden.

### 4. Telemetrie wird automatisch im Betrieb erfasst

In `trpc.ts` wird eine globale Procedure-Middleware eingefuehrt, die fuer relevante Live-Prozeduren automatisch misst:

- Start-/Endzeit je Request
- Fehlercode bei Exception
- Bucketisierung in Redis (10s-Buckets, 60s Window)

Damit ist kein manuelles Instrumentieren je Endpunkt notwendig.

### 5. UI-Zuordnung wird verbindlich

- **Footer-Ampel:** nutzt `serviceStatus` (Betriebsstatus)
- **Detaildialog:** zeigt Lastmetriken und `loadStatus` (Systemlast)

Damit ist die kommunikative Trennung auch technisch konsistent.

## Konsequenzen

### Positiv

- Lehrende erhalten eine Ampel, die naeher an der erlebten Qualitaet liegt.
- Betrieb und Analyse behalten weiterhin Lastdiagnose ohne Bedeutungsverlust.
- API, UI und Dokumentation nutzen klare, getrennte Begriffe.
- Die SLO-Telemetrie wird automatisch und kontinuierlich erhoben.

### Negativ / Risiken

- Mehr Redis-Keys und zusaetzliche Write-Last durch Telemetrie-Buckets.
- SLO-Qualitaet haengt von korrekter Auswahl der getrackten Live-Prozeduren ab.
- Schwellenwerte koennen in fruehen Phasen nachkalibriert werden muessen.
- Bei sehr niedriger Last ist `serviceStatus` voruebergehend nur fallback-basiert.

## Alternativen (geprueft)

- **Nur Lastindikator beibehalten:** verworfen, da Lehrenden-Information und Betriebsaussage vermischt bleiben.
- **Nur SLO-Ampel ohne Lastindikator:** verworfen, da Diagnose und Ursachenanalyse erschwert werden.
- **SLO nur offline aus Logs berechnen:** verworfen, da keine zeitnahe Rueckmeldung im Produkt moeglich ist.
- **Direkte p95/p99 aus DB statt Redis-Buckets:** verworfen, da hoehere Laufzeitkosten und schlechtere Echtzeit-Eignung.

## Umsetzungsleitplanken

- Neue Live-Prozeduren muessen in `isTrackedLiveProcedure()` bewertet werden (SLO-Relevanz).
- `serviceStatus` darf nicht mehr aus reiner Lastheuristik berechnet werden.
- Footer bleibt SLO-orientiert, Detaildialog bleibt Last-orientiert.
- Schwellenwerte sind produktseitig dokumentiert und bei Bedarf explizit via ADR anpassbar.

## Implementierungsstand (Projekt arsnova.eu)

Stand 2026-04-15:

- `ServerStatsDTOSchema` erweitert: `serviceStatus`, `loadStatus` (anstelle `serverStatus`).
- `health.ts` berechnet:
  - `loadStatus` aus Lastsignalen
  - `serviceStatus` aus `readSloSignals()` (inkl. Sample-Guard)
- `sloTelemetry.ts` eingefuehrt (Redis Rolling Window fuer p95/p99/Fehlerquote).
- tRPC-Middleware in `trpc.ts` misst automatisch relevante Live-Prozeduren.
- Frontend verwendet:
  - `serviceStatus` fuer Footer-Ampel
  - `loadStatus` und Lastmetriken im Statusdialog
- Tests in Backend/Frontend auf neues Modell angepasst.

---

**Referenzen:** [ADR-0013: K6/Artillery fuer Lasttests](./0013-use-k6-and-artillery-for-load-and-performance-testing.md), [health.ts](../../../apps/backend/src/routers/health.ts), [sloTelemetry.ts](../../../apps/backend/src/lib/sloTelemetry.ts), [loadSignal.ts](../../../apps/backend/src/lib/loadSignal.ts), [trpc.ts](../../../apps/backend/src/trpc.ts), [schemas.ts](../../../libs/shared-types/src/schemas.ts), [server-status-widget.component.ts](../../../apps/frontend/src/app/shared/server-status-widget/server-status-widget.component.ts), [server-status-help-dialog.component.ts](../../../apps/frontend/src/app/shared/server-status-help-dialog/server-status-help-dialog.component.ts).
