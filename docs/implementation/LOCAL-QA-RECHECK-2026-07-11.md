# Lokaler QA-Nachlauf 2026-07-11

**Stand:** 2026-07-11  
**Bezug:** [Gesamtlauf vom 2026-07-10](LOCAL-TESTRUN-2026-07-10.md)

Dieser gezielte Nachlauf prüft die vier reproduzierbaren Fehlergruppen des
Gesamtlaufs erneut. Er ersetzt nicht dessen vollständige Lastmatrix, belegt aber
die Korrekturen gegen dieselbe lokale PostgreSQL-/Redis-/Backend-/WebSocket- und
Frontend-Laufzeit.

## Ergebnis

- **Unit-/Contract-Tests:** 1.319/1.319 bestanden; alle drei Coverage-Gates
  bestanden.
- **Yjs-Reconnect:** bestanden; 30 Clients, 6 Reconnects, Reconnect-p95 329 ms,
  erneute Konvergenz in 6 ms, 0 Fehler.
- **Vote-Timer-Fairness:** bestanden; 600/600 Votes vor Timerende mit p95 766 ms
  und 600/600 Votes innerhalb der Backend-Karenz mit p95 968 ms bei einem
  1.000-ms-Gate. Außerhalb der Karenz wurden 600/600 Votes fachlich korrekt
  abgewiesen.
- **Browser-Referenzflows:** 6/6 bestanden: Host-/Presenter-Authentisierung,
  Host-Musik, `SHORT_TEXT`, `NUMERIC_ESTIMATE`, Quiz-Sync und Unified Session.
- **Lighthouse:** 6/6 Läufe für `/de/` und `/en/` bestanden. Performance
  0,79–0,80, Accessibility 1,00, LCP 3.705–3.829 ms, CLS 0,004–0,007 und
  TBT 138–199 ms.
- **Prisma-Migrationen:** alle 37 Migrationen mit `prisma migrate deploy` gegen
  eine leere PostgreSQL-Datenbank erfolgreich angewendet; ein anschließendes
  `prisma migrate diff --exit-code` bestätigt null Schema-Drift.
- **Produktionsabhängigkeiten:** `npm audit --audit-level=high --omit=dev`
  meldet 0 Schwachstellen.
- **Container:** Produktionsimage erfolgreich gebaut; Trivy Filesystem und Image
  melden 0 High-/Critical-Befunde. Der Production-Entrypoint wendete alle 37
  Migrationen gegen eine leere Datenbank an.
- **GitHub-Enforcement:** Das aktive Ruleset verlangt 19 strikte Statuschecks,
  einschließlich Workflow-Lint, Format, Landing-Build und CodeQL. `production`
  erlaubt nur geschützte Branches; Admin-Bypass ist deaktiviert.

## Korrekturen

1. Der Yjs-Server ist auf die Yjs-13-kompatible Version
   `@y/websocket-server@0.1.1` festgesetzt; Snapshot- und State-Vector-Vergleiche
   sind kanonisch.
2. Der Vote-Hotpath dedupliziert gemeinsame Frage-/Quiz-Lesezugriffe während
   paralleler Vote-Wellen und behandelt Wiederholungen über den Unique Constraint
   idempotent.
3. Der lokale Frontend-Proxy puffert frühe tRPC- und Yjs-WebSocket-Nachrichten;
   der Revealed-Question-Vertrag transportiert die Zwei-Runden-Felder explizit.
4. Lighthouse läuft mit gzip- und Cache-Semantik wie Produktion. Angular
   hydriert i18n-Inhalte, der Above-the-fold-Text bleibt statisch und der
   selbstgehostete Material-Icons-Font wurde von 125 KB auf 29 KB reduziert.
5. Das Runtime-Image übernimmt keine Builder- oder globalen npm-Werkzeuge mehr,
   aktualisiert Alpine-Sicherheitspatches und ersetzt den fehlertoleranten
   `db push --accept-data-loss`-Startpfad durch hartes `prisma migrate deploy`.
6. Der CI-Nachlauf deckte zehn historische `Session`-Felder auf, die nur per
   `db push`, aber nie als Migration versioniert worden waren. Eine idempotente
   Reconciliation-Migration schließt diese Lücke; das neue Gate `Migration Drift`
   verhindert Wiederholungen.
7. Die Join-lastigen Browsersmokes warten auf langsamen CI-Runnern explizit auf
   Host-Oberfläche, Identitätsauswahl und aktivierten Join-Button, statt nach
   festen Pausen einen noch ladenden Zustand als Produktfehler zu werten.

## Verbleibender Betriebsnachweis

Offen bleibt kein reproduzierbarer lokaler Fehler aus dem Gesamtlauf. Vor einer
Produktionsbaseline sind weiterhin ein freigegebener 30-/60-Minuten-Langlauf (lokal
oder auf dem Zielserver) und die versionierte Baseline-/Regressionsfreigabe
erforderlich. Ein separater Staging-Server ist nicht vorgesehen; Kapazitätsnachweise
laufen über die CI-Artillery-Jobs und lokale Soak-Skripte
(siehe [PERFORMANCE-BASELINE-FREIGABE.md](PERFORMANCE-BASELINE-FREIGABE.md)).
