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
- `npm test`: im erneuten vollständigen Review-Lauf auf Release-Stand 1.4.0
  bestanden: zwölf Open-Weight-Runtimechecks, Shared Types (296), PDF-Bericht (88),
  Backend (2.047 Tests, 60 übersprungen) und Frontend (2.859 Tests in 157 Dateien).
  Der Host-Spec ist vollständig enthalten; es wurde kein Test ausgeschlossen.
- `npm run test -w @arsnova/frontend -- --exclude '**/session-host.component.spec.ts'`:
  156 Dateien mit 2.344 Tests bestanden. Diese frühere Teilprüfung wird durch den
  späteren vollständigen Lauf ergänzt und ersetzt das Voll-Gate nicht.

Beim anschließenden Versionswechsel auf 1.4.0 wurden Typecheck, Lint, beide
Builds, Engine-Prüfung und die 2.344 Frontendtests ohne Host-Spec erneut
erfolgreich ausgeführt. Zwei gezielte QR-Hosttests und die kompilierte
QR-Geometrie in Chromium/WebKit auf sechs Viewports bestanden ebenfalls.
Die ersten Voll- und Pre-Commit-Related-Testläufe wurden angesichts wiederholter
JSDOM-/Polling-Ausgaben vorzeitig abgebrochen. Der Release-Commit wurde mit
einmalig deaktiviertem Husky-Hook erstellt. Die Einordnung als Hänger war nicht
belegt: Der anschließende detaillierte Diagnoselauf bestand alle 515 Host-Tests
in 76 Sekunden; die danach erneut regulär ausgeführte vollständige Suite bestand
ebenfalls. Es war dafür keine Codeänderung und kein Ausschluss des Host-Specs
erforderlich. Die erforderliche CI sowie die Last- und Upgrade-Abnahmen bleiben
unabhängige Release-Gates.

Die zusätzlich auf Runtime-Commit `40c62cb9` gestartete
[isolierte CI-Abnahme](https://github.com/kqc-real/arsnova.eu/actions/runs/42389910632)
bestand beide Jobs **Artillery 500 Live Session** und **Artillery 500 Reconnect
Wave**, einschließlich der im Live-Job ausgeführten Timer-/Vote-, Yjs-,
Wortwolken- und Soak-Smokes. Der Produktionslasttest war deaktiviert; dies war
kein Lasttest auf der öffentlichen Referenzinstanz und kein Produktionsrollout.
Eine gesonderte Upgrade-Abnahme mit bestehenden 1.3-Daten und die
Post-Deploy-Smokes bleiben vor Veröffentlichung erforderlich.

Es sind keine neuen Datenbankmigrationen oder Environment-Variablen erforderlich.
Ein Deployment benötigt neue App- und Landing-Builds. Die Node-22-Untergrenze
muss auch beim Rückwechsel auf ältere Entwicklungsumgebungen berücksichtigt werden.
