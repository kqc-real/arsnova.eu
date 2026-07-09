<!-- markdownlint-disable MD013 -->

# ADR-0013: k6 und Artillery als Standard-Stack fuer Last- und Performance-Tests

**Status:** Accepted  
**Datum:** 2026-03-17  
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-07-09

## Kontext

arsnova.eu hat eine technische Architektur, die nicht nur aus klassischen HTTP-Requests besteht.

Das System kombiniert:

- Angular-Frontend mit interaktiven Live-Views
- Node.js-Backend mit tRPC
- WebSocket-Subscriptions fuer Echtzeit-Updates
- Redis fuer Live-Zustand und Rate-Limiting
- Yjs fuer Multi-Device-Sync
- Playwright fuer browsernahe E2E-Pruefungen

Fuer diese Architektur reicht ein einzelnes Lasttest-Tool nicht optimal aus.

Die Anforderungen sind fachlich und technisch gemischt:

1. **Protokollnahe Lasttests** fuer API-Endpunkte, Session-Start, Join, Vote und messbare Schwellwerte.
2. **Realtime- und WebSocket-Szenarien** fuer Lobby, Live-Updates, Q&A und Freitext.
3. **Browsernahe End-to-End-Szenarien** fuer echte Nutzerfluesse unter Last.
4. **Schnelle lokale Hotspot-Checks** fuer einzelne Backend-Endpunkte.
5. **Regressionsvergleich** zwischen Builds und Releases.

Wir brauchen daher eine belastbare technische Entscheidung, welche Open-Source-Tools fuer welche Testklasse verbindlich eingesetzt werden.

## Entscheidung

### 1. `k6` ist das Standardwerkzeug fuer protokollnahe Lasttests

`k6` wird als primaeres Tool fuer reproduzierbare Last- und Schwellenwerttests auf Protokollebene verwendet.

Einsatzschwerpunkte:

- HTTP-/tRPC-Requests
- Session-Start
- Join-Flow auf API-Ebene
- Vote-Submit unter Last
- Benchmark-Thresholds in CI
- Regressionserkennung ueber wiederholbare Lastprofile

Begruendung:

- moderner Open-Source-Standard fuer "load testing as code"
- gut geeignet fuer CI/CD und maschinenlesbare Thresholds
- ressourceneffizient
- aktueller WebSocket-Support fuer zusaetzliche protokollnahe Realtime-Pruefungen

### 2. `Artillery` ist das Standardwerkzeug fuer Realtime- und E2E-nahe Lastszenarien

`Artillery` wird fuer Lasttests eingesetzt, die ueber reine API-Requests hinausgehen und reale Mehrnutzer-Szenarien besser abbilden muessen.

Einsatzschwerpunkte:

- WebSocket-/Subscription-Szenarien
- viele parallele Joins in eine Lobby
- Q&A-Live-Flows
- Freitext mit Live-Auswertung
- Reconnect-Szenarien
- browsernahe Lasttests in Kombination mit Playwright

Begruendung:

- sehr guter Fit fuer Node.js- und Realtime-Architekturen
- native Unterstuetzung fuer WebSocket-Szenarien
- aktiv gepflegt
- besonders stark fuer realitaetsnahe Lasttests mit komplexeren User-Flows

### 3. `Playwright` bleibt die Referenz fuer funktionale Browser-Flows

`Playwright` bleibt das Standardtool fuer funktionale E2E-Szenarien.

Es wird nicht als alleiniges Lasttest-Tool verstanden, sondern als:

- Referenz fuer echte Nutzerpfade
- Grundlage fuer browsernahe Lastszenarien
- Werkzeug fuer reproduzierbare UI-Flows, die bei Bedarf mit Artillery kombiniert werden

### 4. Node-Skripte fuer schnelle lokale Hotspot-Checks

Fuer sehr schnelle Vorher/Nachher-Vergleiche einzelner Backend-Endpunkte ohne vollstaendiges k6-Setup nutzt das Repo **eigene Node-Skripte** unter `scripts/load/`, z. B. `concurrent-50-http.mjs` (`npm run load:simulate:50`).

Einsatzschwerpunkte:

- lokale Checks einzelner tRPC-/HTTP-Hotpaths
- schnelle Grobpruefung waehrend der Entwicklung
- Ergaenzung zu k6, kein Ersatz fuer Schwellenwert-Lasttests

Externe Mikrobenchmark-CLIs sind **nicht** vorgesehen; die Rolle ist durch die eingecheckten Node-Smokes abgedeckt.

### 5. Kein monolithisches Ein-Tool-Modell

arsnova.eu verwendet bewusst **nicht** nur ein einziges Lasttest-Werkzeug fuer alle Faelle.

Stattdessen gilt:

- `k6` fuer reproduzierbare, threshold-basierte Lasttests
- `Artillery` fuer Realtime- und E2E-nahe Lastszenarien
- `Playwright` fuer funktionale Browser-Referenzszenarien
- Node-Skripte unter `scripts/load/` fuer schnelle lokale Hotspot-Checks

Diese Aufteilung ist Teil der Architekturentscheidung.

## Konsequenzen

### Positiv

- Gute Abdeckung der realen Systemarchitektur statt eines zu engen HTTP-Fokus.
- Klare Rollentrennung zwischen Benchmarking, Realtime-Last und Browser-E2E.
- Offene, gut bekannte Open-Source-Werkzeuge ohne proprietaere Grundabhaengigkeit.
- Gute CI-Eignung durch `k6` und gute Realtime-/Browser-Eignung durch `Artillery`.
- Entwickler:innen koennen schnelle lokale Performance-Checks durchfuehren, ohne immer einen kompletten Lasttest starten zu muessen.

### Negativ / Risiken

- Mehr als ein Tool bedeutet mehr Setup-, Dokumentations- und Pflegeaufwand.
- Testdaten, Metriken und Reports muessen zwischen den Tools sinnvoll vereinheitlicht werden.
- Browsernahe Lasttests sind schwerer und teurer als reine Protokolltests.
- Ohne klare Szenario-Abgrenzung besteht die Gefahr, dass Tests doppelt oder inkonsistent gepflegt werden.

## Alternativen (geprueft)

- **Nur `k6`:** verworfen, weil reine Protokolltests die Realtime- und browsernahen Mehrnutzer-Szenarien von arsnova.eu nicht ausreichend abbilden.
- **Nur `Artillery`:** verworfen, weil `k6` fuer threshold-basierte, CI-freundliche Protokoll- und Benchmark-Tests der klarere Standard ist.
- **`Gatling`:** verworfen, weil es fuer einen TypeScript-/Node-/Playwright-Stack weniger natuerlich integrierbar ist.
- **`Locust`:** verworfen, weil es staerker Python-zentriert ist und schlechter zum bestehenden JavaScript-/TypeScript-Stack passt.
- **Nur Playwright mit Eigenbau-Lastlogik:** verworfen, weil funktionale Browser-E2E allein kein sauberes, skalierbares Lasttest-Konzept ersetzt.

## Umsetzungsleitplanken

- `k6`-Skripte definieren die verbindlichen Lastprofile und Thresholds fuer CI-nahe Pruefungen.
- `Artillery`-Skripte modellieren die kritischen Realtime- und Mehrnutzer-Szenarien.
- Playwright-Flows werden so geschrieben, dass sie als funktionale Referenz fuer Lastszenarien wiederverwendbar bleiben.
- Schwere Lasttests werden von normalen PR-Checks getrennt, z. B. als Nightly-, manuelle oder dedizierte Pipeline.
- Ergebnisse muessen zwischen Laeufen vergleichbar und fuer Entwickler:innen lesbar sein.
- Neue kritische Live-Flows erhalten frueh eine Entscheidung, ob sie primaer in `k6`, `Artillery` oder beiden Werkzeugen getestet werden.

## Umsetzungsstand (2026-07-09)

Im Repo existieren konkrete `k6`-Skripte unter `scripts/load/`, darunter `k6-trpc-health-50vu.js`, `k6-trpc-session-50vu.js` und `k6-session-hotpaths-500vu.js`. Dazu kommen Node-basierte Schnellchecks wie `concurrent-50-http.mjs`, `session-participants-50.mjs`, `ws-status-subscribers.mjs` und vier Classroom-30er-Smokes (CI-Job `classroom-smokes` auf PR/Push). **Artillery:** `npm run load:artillery:500` modelliert die Unified-Live-Session mit bis zu 500 Teilnehmenden (HTTP + WebSocket + Host-Monitor); CI-Job `artillery-500` bei Schedule/Manuell. Schwere Last bleibt von PR-Checks getrennt; offen bleiben Reconnect-, Freitext-/Word-Cloud- und Sync-Last sowie Laufvergleich.

---

**Referenzen:** `Backlog.md` Story `0.7`, `apps/frontend/package.json`, `apps/backend/package.json`, [ADR-0003: tRPC fuer API](./0003-use-trpc-for-api.md), [ADR-0004: Yjs fuer Local-First-Speicherung](./0004-use-yjs-for-local-first-storage.md), [ADR-0009: Einheitliche Live-Session mit Tabs fuer Quiz, Q&A und Blitzlicht](./0009-unified-live-session-channels.md).
