# Host-Aufgabenwahl — #470, Slice 1

Quelle und Umfang: [Issue #470](https://github.com/kqc-real/arsnova.eu/issues/470), ausschließlich **Slice 1 — reines UI-Zustandsmodell und Startseite**. Die Live-Navigation und die Reduktion der Host-Arbeitsflächen aus Slice 2–4 sind nicht Bestandteil dieses Slices. Übersetzungen, nahe Regressionstests und Dokumentation begleiten bereits die hier geänderte Oberfläche; dies bedeutet keine Abnahme von Slice 5 oder des gesamten Issues.

## Sichtbares Verhalten

| Einstieg                | Verhalten in Slice 1                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ohne Aufgabenwahl       | Teilnahme und alle drei Host-Karten bleiben sofort bedienbar. Ein direkter Kartenstart verwendet für diese Aktion `QUICK`, ohne daraus eine explizite letzte Präferenz zu machen. |
| `CLASSROOM`             | Die Startseite priorisiert das eigene letzte Quiz, die Quiz-Auswahl, ein neues Quiz und Fragen aus dem Kurs.                                                                      |
| `EVENT`                 | Die Startseite bietet Fragen sammeln, den normalen Tempo-Chip und Beides; Quiz-Sammlung und vorhandene Q&A-Zugänge bleiben erreichbar.                                            |
| `QUICK`                 | Die vorhandenen direkten Formatstarts bleiben erreichbar; ein Blitzlicht-Chip startet ohne zusätzliche Abfrage eine sessiongebundene Runde.                                       |
| Quiz-Sammlung           | Kurs- und Direktstarts priorisieren Starten neben Bearbeiten. Die vorhandene Live-Startlogik und weiteren Kartenaktionen bleiben erhalten.                                        |
| Bestehender Host-Zugang | Öffnet die bestehende Session ohne erneutes Aufgaben-Onboarding. Eine globale letzte Präferenz allein weist dieser Session keine Aufgabe zu.                                      |

Die kompakte Aufgabenwahl steht unmittelbar vor `.home-host-stack`. Die Karten `home-card--create`, `home-card--live` und `home-card--feedback` bleiben im DOM und in der Tastaturfolge. Die Wahl startet selbst weder eine Session noch einen Dialog. Teilnahme und Code-Eingabe behalten ihre Priorität; die Aufgabenwahl ist unabhängig von Seriös/Spielerisch.

Der **Tempo**-Chip startet das sessiongebundene Tempo-Blitzlicht. Eine vorherige Q&A-Session ohne Blitzlicht-Kanal wird dabei nicht irrtümlich als Ziel des Tempo-Starts geöffnet. Das Fortsetzen einer vorhandenen Session erhält nur eine bereits vorhandene pro-Code-Zuordnung; ein fehlender Eintrag bleibt auch bei gespeicherter globaler Präferenz neutral.

## Lokaler Zustand und Grenzen

- `HostScenario` hat genau die Werte `CLASSROOM`, `EVENT` und `QUICK`. Ein kleiner Core-Service mit Angular Signals verwaltet diese reine UI-Präferenz.
- Nur eine ausdrückliche Auswahl wird versioniert in `localStorage` gespeichert. Ungültiger Inhalt, eine unbekannte Version und verweigerter Storage fallen sicher auf keine gespeicherte Auswahl zurück.
- Die Zuordnung zu einem gestarteten Sessioncode liegt separat in `sessionStorage`. Ein Reload im selben Tab kann sie wiederverwenden. Ohne Code-Eintrag gibt es keine Ableitung aus der globalen Präferenz.
- Die einmalige Anschlussaktion für EVENT-Beides gehört zum jeweiligen Sessioncode. Sie verleiht keine Hostberechtigung und ist kein Nachweis für einen aktivierten Kanal.
- Autoritativ für Rechte, aktive Kanäle, Q&A-Einrichtung, Fristen und `preferredChannel` bleiben die bestehenden Backend-Verfahren und bestätigten Sessiondaten. Teilnehmer und Present erhalten keine Aufgabenpräferenz.
- Keine neuen Prisma-Felder, Shared-Zod-Schemas, tRPC-Prozeduren, Rollen, Presets oder Quizregeln. Bestehende Sessions, Capabilities und Quiz-Sammlungen werden nicht migriert.

`apps/frontend/src/app/core/host-scenario.service.ts` stellt folgende Integrationspunkte bereit:

| API                                                                                                       | Zweck                                                                                            |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `preference()` / `selectScenario(...)`                                                                    | Letzte ausdrücklich gewählte Aufgabe lesen beziehungsweise ändern.                               |
| `scenarioForAction()`                                                                                     | Aufgabe eines bewussten Kartenstarts bestimmen; ohne Auswahl `QUICK`.                            |
| `assignToSession(code, scenario)`                                                                         | Aufgabe lokal dem neu gestarteten Code zuordnen.                                                 |
| `getForSession(code)`                                                                                     | Nur die Zuordnung dieses Codes lesen; `null` bleibt ein neutraler Einstieg.                      |
| `requestQuickFeedbackAfterQa(code)` / `hasQuickFeedbackAfterQa(code)` / `clearQuickFeedbackAfterQa(code)` | Einmalige Beides-Anschlussaktion vormerken, prüfen und nach Erfolg oder Setup-Abbruch entfernen. |

Diese API wird nicht in Backend-Eingaben oder Teilnehmer-/Present-DTOs übernommen. Bei verweigertem Storage bleibt die aktuelle Auswahl im laufenden Service nutzbar; ihre Wiederherstellung nach einem Reload ist dann nicht garantiert.

## EVENT-Beides: Übergang und Fehlerfall

1. Die Startseite verwendet `startHeroHostSession('qa')` und merkt die Anschlussaktion für genau den zurückgegebenen Sessioncode.
2. Die vorhandene Q&A-Ersteinrichtung bleibt vorgeschaltet. Deren `abortUnconfiguredSessionOnCancel`-Semantik gilt unverändert bei Abbruch.
3. Erst nach erfolgreicher Einrichtung, bestätigter Host-Zugangskarte und `startQaAfterCreateSetup()` wird der bestehende Pfad `enableChannel('quickFeedback')` verwendet.
4. Danach priorisiert `selectChannel('qa')` die Fragenwand für Host und Teilnehmendeneinstieg. Der Anschlussmarker wird nach Erfolg entfernt.
5. Scheitert das Hinzufügen von Blitzlicht, wird das bereits offene Q&A als Teil-Erfolg benannt. **Blitzlicht hinzufügen** wiederholt die Aktivierung unter demselben Code; es wird keine zweite Session angelegt.

Eine lokale Aufgabenpräferenz öffnet oder schließt selbst keinen Kanal, beendet kein Quiz und ersetzt keinen Host-Token. Der gültige Q&A-Teil-Erfolg bleibt bei einem späteren Blitzlicht-Fehler erhalten.

## Übergabe an Slice 2

Slice 2 baut auf der lokalen Aufgabenzuordnung auf, leitet die Navigation aber aus dem tatsächlichen, serverbestätigten Kanalzustand ab:

- `availableChannels()` in aktivierte Tabs und hinzufügbare Formate aufteilen. Bei einem aktivierten Kanal keine Tab-Leiste; inaktive Formate nur unter **Format hinzufügen**.
- Aktivierung über die bestehenden Pfade `activateQuizChannel` beziehungsweise `enableChannel` inklusive Q&A-Ersteinrichtung führen. Nach Erfolg wechseln; nach Abbruch oder Fehler weder einen falschen Tab noch einen falschen `activeChannel` übernehmen.
- `selectChannel`, `onChannelToggleChange`, `ensureActiveChannel`, `showChannelTabs`, `channelTabMetaLabel` und `reconcilePresentedChannel` gemeinsam prüfen. Der Beides-Anschluss verwendet bereits `enableChannel` und `selectChannel` und muss dabei erhalten bleiben.
- Reload und Reconnect aus bestätigtem Sessionzustand rekonstruieren. Ein geschlossenes, aktiviertes Format bleibt von einem noch nicht aktivierten Format unterscheidbar. `preferredChannel` bleibt serverautoritativ.
- Ohne pro-Code-Aufgabe eine neutrale, geordnete Ansicht aus dem aktiven Format wählen. Niemals anhand der letzten globalen Aufgabe eine bestehende Session als `CLASSROOM` oder `EVENT` einstufen.
- Nach Quiz-`FINISHED` offene Q&A- und Blitzlicht-Kanäle sowie die Multi-Quiz-/Kohortenpfade aus #410/#411/#438 erhalten. Session-Ende und Quizabschluss getrennt halten.
- Fokus nach Aktivierungsdialog, Abbruch, Fehler und Tabwechsel prüfen. Den Beides-Teil-Erfolg und dessen Retry auf derselben Session als Regressionstest weiterführen.

Die spätere Phasenführung, Werkzeuge-Akkordeons, Präsentations-/Ton-Gruppierung und vollständige Szenariomatrix bleiben Slice 3–5 vorbehalten.

## Validierung

| Kommando                                                                                                                                                                                                                    | Ergebnis                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm exec -w @arsnova/frontend -- ng extract-i18n --output-path /private/tmp/arsnova-470-i18n`                                                                                                                              | Erfolgreich; bestehende Warnungen zu mehrfach verwendeten IDs. Die neuen Einheiten wurden in alle fünf Kataloge übernommen, bestehende Übersetzungen und reine Fundstellen-Metadaten nicht neu geschrieben. |
| `npm run check:i18n -w @arsnova/frontend`                                                                                                                                                                                   | Mit Node 24 erfolgreich: 3550/3550 Einheiten je Zielsprache, einschließlich aller 15 neuen IDs.                                                                                                             |
| `xmllint --noout apps/frontend/src/locale/messages.xlf apps/frontend/src/locale/messages.en.xlf apps/frontend/src/locale/messages.fr.xlf apps/frontend/src/locale/messages.es.xlf apps/frontend/src/locale/messages.it.xlf` | Erfolgreich.                                                                                                                                                                                                |
| `npx prettier --check docs/ui/STYLEGUIDE.md docs/APP-FUNKTIONSUEBERSICHT.md docs/implementation/HOST-SCENARIO-470-SLICE-1.md`                                                                                               | Erfolgreich.                                                                                                                                                                                                |
| `git diff --check -- docs/ui/STYLEGUIDE.md docs/APP-FUNKTIONSUEBERSICHT.md docs/implementation/HOST-SCENARIO-470-SLICE-1.md apps/frontend/src/locale`                                                                       | Erfolgreich.                                                                                                                                                                                                |

Die abschließenden Prüfungen verwenden Node **24.18.0**. Frontend-Tests laufen seriell zu den Browser-Smokes, ohne parallele Vitest-Prozesse.

| Kommando                                                                                                                              | Ergebnis                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test -w @arsnova/frontend`                                                                                                   | Erfolgreich: 139 Dateien, **2285 Tests**, einschließlich Storage-/SSR-Fallbacks, neutraler Wiederaufnahme, Szenariozuordnung, Quiz-CTAs und Beides-Erfolg/Abbruch/Retry/Reload.   |
| `npm run typecheck`                                                                                                                   | Erfolgreich für Shared Types, Backend und Frontend.                                                                                                                               |
| `npm run lint`                                                                                                                        | Erfolgreich einschließlich Skript-Lint.                                                                                                                                           |
| `npm run build:localize -w @arsnova/frontend`                                                                                         | Erfolgreich für alle fünf Sprachen einschließlich Server-Build, Prerendering, PWA und MOTD-Assets. Budgetwarnung: initiales Bundle 1,95 MB bei 1,70 MB Warnschwelle (+251,79 kB). |
| `BASE_URL=http://localhost:4175/de TRPC_URL=http://localhost:3000/trpc npm run smoke:unified-session -w @arsnova/frontend`            | Erfolgreich einschließlich der integrierten axe-Prüfungen.                                                                                                                        |
| `BASE_URL=http://localhost:4175/de TRPC_URL=http://localhost:3000/trpc npm run smoke:epic-405-host-qa-lifecycle -w @arsnova/frontend` | Erfolgreich: Zugangskarte, Q&A-Einstellungen und Wiederherstellung.                                                                                                               |
| `BASE_URL=http://localhost:4175 npm run a11y:layout -w @arsnova/frontend`                                                             | Erfolgreich: 49 Zustände plus Desktop-Join und Footer-Breakpoints; 320px-Reflow, sichtbarer Fokus und 24px-Zielgrößen.                                                            |
| `BASE_URL=http://localhost:4175 npm run a11y:axe:static -w @arsnova/frontend`                                                         | Erfolgreich: 13 Zustände, keine erkannten WCAG-Verstöße. Automatisch unvollständig prüfbare Regeln bleiben manuell zu bewerten.                                                   |

Im In-App-Browser wurden zusätzlich die Aufgabenwahl per Tastatur, Persistenz nach Reload, Unabhängigkeit vom Theme-Preset, die französische Startseite bei 1440px und 320px sowie der vollständige Beides-Start geprüft: Q&A-Einrichtung → Bestätigung der Zugangskarte → offene Fragenwand mit hinzugefügtem Blitzlicht und Fokus auf der Q&A-Überschrift → Reload. Dabei wurden keine Browser-Konsolenfehler beobachtet. Die Browser-Smokes liefen vor den letzten Home-Korrekturen für neutrale Wiederaufnahme und den direkten EVENT-Tempo-Start; deren Regressionstests sind im abschließenden vollständigen Testlauf enthalten. Nach dem abschließenden Build wurde der EVENT-Tempo-Start zusätzlich im Browser bestätigt: neuer Sessioncode trotz vorhandener Q&A-Session, Blitzlicht ausgewählt und Tempo-Feedback aktiv.

Zusätzlicher Commit-Gate: `.husky/pre-commit` führt `lint-staged`, `npm run typecheck` und **`npm test`** für Shared Types, Session-Export, Backend und Frontend aus und blockiert den Commit bei einem Fehler. Der erste Commit-Versuch unter der standardmäßigen Node-20-Umgebung scheiterte an zwei PDF-Tests (`Promise.withResolvers` fehlt); der Commit wird deshalb ausdrücklich mit der unterstützten Node-Version 24 erstellt.

Nicht ausgeführt: Lasttests, da weder Backend, Verträge, Persistenz noch Rate-Limits geändert wurden; Lighthouse und eine vollständige Screenreader-/Browser-/Reduced-Motion-Matrix. Die automatisierten und gezielten visuellen Prüfungen belegen daher keine vollständige WCAG-Abnahme. Insbesondere ersetzen sie keine Abnahme der Kanalnavigation aus Slice 2.

Deployment und Rücknahme benötigen ausschließlich den normalen Frontend-Build beziehungsweise dessen vorherige Version; es gibt keine Datenmigration. Die neuen versionierten Browser-Schlüssel werden von der vorherigen Version nicht ausgewertet.
