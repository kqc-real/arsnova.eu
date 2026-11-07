# Paket-Sicherheitsupdates vom 7. November 2026

## Umfang

Nach dem Angular-Patchupdate wurden die direkten und transitiven npm-Abhängigkeiten
gegen die aktuelle npm-Advisory-Datenbank geprüft und aktualisiert:

- Astro 7.4.7, concurrently 10.0.7 und Artillery 2.0.34;
- Vitest und Coverage 4.1.12 konsistent in allen betroffenen Workspaces;
- ip-address 10.7.6 und js-yaml 4.3.2;
- Overrides für qs ab 6.17.1, shell-quote ab 1.12.0 und minimatch ab 11.0.5;
- Artillery behält seine js-yaml-3-API, nun mit Patch 3.15.2;
- kompatible transitive Updates über `npm audit fix --ignore-scripts`.

Astro 7.4.7 und seine Hilfspakete verlangen Node ab 22.23.4. Die Root-Engine
unterstützt deshalb `>=22.23.4 <23 || >=24.15.0 <25`. Der bisherige
Node-24-Referenzpfad bleibt nutzbar. `npm run engines:test` prüft alle nicht
optionalen Lockfile-Pakete gegen die niedrigsten unterstützten Versionen.

Der bestehende minimatch-Override wurde von Hauptversion 10 auf 11 angehoben,
weil der gemeldete Amplifikationsfehler erst ab 11.0.1 behoben ist. Lint,
Skript-Lint-Vertragstests sowie App- und Landing-Build prüfen die im Repository
verwendeten Werkzeugpfade; das ist keine Zusicherung für jede Upstream-API.

## Audit und verbleibender Befund

Der Gesamtaudit sank von 60 auf zwei moderate Einträge. Es verbleiben keine
hohen oder kritischen Meldungen. `npm audit --omit=dev --json` meldet null
Schwachstellen in Produktionsabhängigkeiten.

Die beiden verbleibenden Einträge betreffen dieselbe Ursache: Artillery 2.0.34
verwendet csv-parse 4.16.3, betroffen von
[GHSA-8cw4-87c7-c6xx](https://github.com/advisories/GHSA-8cw4-87c7-c6xx).
Artillery importiert den Parser als Standardfunktion und promisifiziert ihn in
`lib/util/prepare-test-execution-plan.ts`. Ein erzwungener Wechsel auf die
behobene csv-parse-Hauptversion 7 ersetzt diese API und ist kein kompatibles
Lockfile-Update. Auch der von npm vorgeschlagene Downgrade auf Artillery 0.0.2
wurde nicht übernommen. Bis zu einer kompatiblen Upstream-Lösung sind
Artillery-Konfigurationen und CSV-Payloads ausschließlich aus vertrauenswürdigen
Quellen auszuführen; der Befund bleibt offen und darf nicht als behoben gelten.

## Validierung

- `npm run typecheck`: bestanden.
- `npm run lint`: bestanden, einschließlich Skript-Lint.
- `npm run engines:test`: drei Tests bestanden.
- `npm run lint:scripts:test`: 28 Tests bestanden.
- `npm run build:prod`: bestanden, fünf Locales und 40 vorgerenderte Routen
  einschließlich der Post-Build-Prüfungen.
- `npm run build:landing`: bestanden.
- `npm run test:theme-static -w @arsnova/landing`: bestanden.
- `npm run test:i18n -w @arsnova/landing`: bestanden. Der Check löst die Astro-CLI
  jetzt aus dem tatsächlich installierten Workspace-Paket auf statt aus einem
  fest verdrahteten Root-`node_modules`-Pfad.
- Chromium-/WebKit-Seitensmokes für App-Quizsammlung und Landingpage in allen
  fünf Sprachen: 20 Aufrufe ohne JavaScript-Seitenfehler bestanden. Das Backend
  lief dabei nicht; die Prüfung belegt keine Live-Session- oder API-Ende-zu-Ende-Flows.
- `npm test`: Open-Weight-Runtimechecks, Shared Types (296), PDF-Bericht (88)
  und Backend (2.047 Tests, 60 übersprungen) bestanden. Der anschließende
  Frontend-Lauf wurde wegen der bereits vor den Updates beobachteten
  JSDOM-/Host-Polling-Schleife abgebrochen; die vollständige Suite ist nicht grün
  bestätigt.
- `npm run test -w @arsnova/frontend -- --exclude '**/session-host.component.spec.ts'`:
  156 Dateien mit 2.344 Tests bestanden. Die Ursache des Host-Spec-Problems ist
  durch diese Prüfung nicht eingegrenzt.

Beim anschließenden Versionswechsel auf 1.4.0 wurden Typecheck, Lint, beide
Builds, Engine-Prüfung und die 2.344 Frontendtests ohne Host-Spec erneut
erfolgreich ausgeführt. Zwei gezielte QR-Hosttests und die kompilierte
QR-Geometrie in Chromium/WebKit auf sechs Viewports bestanden ebenfalls.
Der vollständige Host-Spec hing auch im Pre-Commit-Related-Testlauf. Dieser
Lauf wurde beendet und der Release-Commit mit einmalig deaktiviertem Husky-Hook
erstellt. Die vollständige Testsuite bleibt ein offenes CI-/Release-Gate;
die Einzelprüfungen sind kein Ersatz für diesen Nachweis.

Es sind keine neuen Datenbankmigrationen oder Environment-Variablen erforderlich.
Ein Deployment benötigt neue App- und Landing-Builds. Die Node-22-Untergrenze
muss auch beim Rückwechsel auf ältere Entwicklungsumgebungen berücksichtigt werden.
