# Quiz-Host nach Phasen — #470, Slice 3

Quelle: [Issue #470](https://github.com/kqc-real/arsnova.eu/issues/470). Basis: abgeschlossener Slice 2, Commit `36c1ceed055f58567ef854a71ee773e8fc2795ae`, einschließlich Slice 1 (`5ee75720`). Branch: `codex/470-slice-3`. Der übergebene Arbeitsbaum war sauber.

## Umfang und Phasenvertrag

Ausschließlich Quiz-Host-Gruppierung, zugehörige Übersetzungen, Tests und Dokumentation. Keine Änderung an Backend, API, Shared-Zod, Teilnehmer-/Present-Verträgen, Auth, Session-Lifecycle, Q&A-Fristen oder Teilnahmeprofilen. Lokale Aufgabenpräferenzen verleihen weiterhin keine Rechte; neutrale Sessions erhalten dieselbe zustandsabhängige Ordnung.

| Zustand                       | Dominante Quizaktion                                            | Erhaltene Alternativen und Zusatzaktionen                                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LOBBY`                       | Erste Frage starten                                             | Titel, Code/QR und Teilnehmendenzahl; Anzeige, Ton, Moderation; Quizwechsel und Ende im Menü                                                                                      |
| `isQuizAwaitingFirstQuestion` | Erste Frage starten im bestehenden Lobby-Hero                   | Kein Ergebnis-CTA ohne aktuelle Frage; kein automatischer Start                                                                                                                   |
| `QUESTION_OPEN`               | Antwortphase starten                                            | Lesestatus; Auslassen und Ende unter Weitere Aktionen                                                                                                                             |
| `ACTIVE`                      | Ergebnis zeigen; bei bestehender PI-Empfehlung Diskussionsphase | Ergebnis als sichtbare Alternative; persönliche Timer und Nachteilsausgleich mit Sperren, Warnung und Bestätigung                                                                 |
| `DISCUSSION`                  | Zweite Abstimmung                                               | Sichtbar beschriftete Alternative zur nächsten Frage/Gesamtauswertung ohne zweite Abstimmung; Rückblick im Menü, soweit zulässig                                                  |
| `RESULTS`                     | Nächste Frage oder Zur Gesamtauswertung                         | Voriges Ergebnis im Menü, soweit vorhanden und tatsächlich durchgeführt; vorhandene Auswertungen bleiben erhalten                                                                 |
| `FINISHED`                    | Nachbesprechungsplan ansehen                                    | Abschlusskarte vor Detailauswertungen, Zur Startseite und Exportieren; offene Nebenkanäle sowie Nächstes Quiz in diesem Raum bleiben nach bestehenden Kanalbedingungen erreichbar |

`nextQuestion`, `revealAnswers`, `revealResults`, `startDiscussion`, `startSecondRound` und `skipQuestion` behalten ihre Fachlogik. Die bisher unerreichbare zweite Prestart-Steuerung unter der laufenden Frage entfällt; `showLobbyStage()` enthält diesen Zustand bereits. Keine automatische Freigabe, keine übersprungene Lesephase, kein automatisches Session-Ende und kein zusätzlicher Pairing-Pflichtschritt.

## Platzierung und Fokus

- Der Quiz-Lobby-Start ist gefüllt; Presenter konkurriert nicht mehr als zweite Hauptaktion. Die vorhandene Q&A-Lobby behält ihre eigene Darstellung.
- **Auf Bildschirm zeigen** enthält den bisherigen Presenter-/Pairing-Flow und darunter **Vollbild** und **App-Rahmen**. **Ton** öffnet das bestehende Musikmenü. Diese Bereiche folgen nach dem Quizinhalt auf derselben Shell-Achse. Die bestehende Presenter-Geräteverfügbarkeit bleibt erhalten.
- **Moderation** benennt den Kompass an seinem stabilen Platz rechts in der Live-Zeile. Seine vorhandene Signalhervorhebung bleibt wahrnehmbar; Signaländerungen ersetzen keinen fokussierten Trigger.
- **Weitere Aktionen** bündelt Auslassen, voriges Ergebnis, Quizwechsel vor dem Start und Session-Ende unter deren bestehenden Bedingungen. Material gibt den Fokus vor `menuClosed` an den dauerhaften Trigger zurück; erst danach ruft `runHostMoreAction()` die vorhandene Methode auf. Keine zusätzliche zeitversetzte Menü-Fokusaktion. Während laufender Aktionen bleibt der Trigger fokussierbar, öffnet aber kein weiteres Menü.
- `onSessionEndAnchorClick` erhält nur einen Fokus-Fallback auf das aktive Element bei Aufruf ohne DOM-Event. Bestätigung, Abschlussansicht, Fehler und Retry bleiben unverändert. Bei offenem Q&A heißt die bestehende Verlassen-Aktion auch im Menü **Zur Startseite** und hält die Fragenwand offen; sie wird nicht irreführend als Session-Ende beschriftet. Nach Quizabschluss delegiert das Menü wie die Abschlusskarte an `navigateHomeFromFinishedSession`.
- Beim Wegfall des Presenter-Buttons sucht der Fokus zuerst verfügbare Anzeigeoptionen, dann sichtbare Kanalnavigation und anschließend weitere sichtbare Host-Controls.
- Weil die Abschlusskarte vor den Details steht, entfällt die zusätzliche Fokussierung nach der asynchronen Confidence-Nachladung. Der initiale Abschlussfokus bleibt bestehen; spätere Antworten stehlen keinen bereits gesetzten Nutzerfokus.
- Die Hauptaktion der Abschlusskarte verwendet den bestehenden Standard-PDF-Export direkt. Sie bleibt bei Pending fokussiert, kündigt den Export an und blockiert Mehrfachaufrufe. **Exportieren** bietet beide PDF-Varianten und die bisherigen CSV-Exporte. Exportformat und Exportberechtigungen sind unverändert.
- `showChannelNavigation()` bleibt gemeinsame Shell auch ohne Tabs; `#host-live-content`, Frage-, Lobby- und Abschlussanker bleiben erhalten. Aktivierung, `preferredChannel`, Beides-Teil-Erfolg/Retry sowie Multi-Quiz und Kohorten verwenden weiterhin die vorhandenen Pfade.

## Validierung

Alle ressourcenintensiven Läufe erfolgen nacheinander mit:

```bash
export PATH=/Users/kqc/.nvm/versions/node/v24.18.0/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=4096
export VITEST_MAX_WORKERS=1
export NG_BUILD_MAX_WORKERS=2
```

Node **24.18.0**; der isolierte Frontend-Vitest-Pool `forks` bleibt unverändert. Der reguläre Commit führt `lint-staged`, `npm run typecheck` und `npm test` erneut aus; die Hooks werden nicht umgangen.

| Kommando                                                                                                    | Ergebnis                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test -w @arsnova/frontend -- src/app/features/session/session-host/session-host.component.spec.ts` | Erfolgreich: 401 Tests. Alle sechs Phasen, Prestart, offene Nebenkanäle/Multi-Quiz, PI/zweite Runde/Alternative, persönliche Timer, Menü-Guards, Dialogabbruch und verspätete Abschlussdaten.                                           |
| `npm test`                                                                                                  | Erfolgreich: **3973 bestanden**, **37 übersprungene Backend-Integrationstests**. Shared-Types 123, Exportbibliothek 82, Backend 1468, Frontend 2300.                                                                                    |
| `npm run typecheck`                                                                                         | Erfolgreich einschließlich beider Bibliotheken, Backend und Frontend.                                                                                                                                                                   |
| `npm run lint`                                                                                              | Erfolgreich einschließlich Template-A11y und Skript-Lint.                                                                                                                                                                               |
| `npm run build:prod` und abschließend `npm run build:localize -w @arsnova/frontend`                         | Erfolgreich: de/en/fr/es/it einschließlich Server, Prerendering, PWA und MOTD-Assets. Bestehende Bundlewarnung: 1,95 MB bei 1,70 MB Warnschwelle (+251,79 kB). Der letzte lokalisierte Lauf enthält die mobile Moderationsbeschriftung. |
| `npm run extract-i18n -w @arsnova/frontend -- --output-path /private/tmp/arsnova-470-slice3-i18n`           | Erfolgreich mit bestehenden Warnungen über mehrfach verwendete IDs. 3552 eindeutige IDs und normalisierte Quelltexte stimmen mit dem Quellkatalog überein.                                                                              |
| `npm run check:i18n -w @arsnova/frontend`                                                                   | Erfolgreich: 3552/3552 Einheiten je Zielsprache.                                                                                                                                                                                        |
| `xmllint --noout apps/frontend/src/locale/messages*.xlf`                                                    | Erfolgreich.                                                                                                                                                                                                                            |

Abschließende Format- und Diffprüfung:

```bash
npx prettier --check docs/APP-FUNKTIONSUEBERSICHT.md docs/TESTING.md docs/ui/STYLEGUIDE.md docs/implementation/HOST-SCENARIO-470-SLICE-3.md
npx prettier --check apps/frontend/package.json apps/frontend/scripts/check-{host-phase-controls,product-feedback,session-question-progress,structured-question-types,unified-session}-flow.mjs apps/frontend/src/app/features/session/session-host/session-host.component.{ts,html,scss,spec.ts}
git diff --check
```

Alle drei Prüfungen erfolgreich. Die XLF-Dateien werden mit `xmllint` und den i18n-Prüfungen validiert; Prettier hat für XLF keinen konfigurierten Parser. Der vollständige Diff wurde zusätzlich unabhängig geprüft, ohne verbleibende konkrete Befunde.

Der Frontend-Testlauf enthält jsdom-Meldungen zu nicht implementiertem Scrollen und Navigation, jedoch keine fehlgeschlagenen Tests. Browser- und Fokusprüfungen sind deshalb gesondert unten ausgewiesen.

Die Browserprüfungen nutzen den lokalisierten Build über `PORT=4173 node apps/frontend/scripts/serve-localized-with-api.mjs` und das bereits laufende lokale Backend auf Port 3000. Es wurde kein zweiter Backend- oder Entwicklungsserver gestartet. Screenshots und Logs liegen außerhalb des Repositorys unter `/private/tmp/arsnova-slice3-*`.

Der neue Lauf `BASE_URL=http://localhost:4173/de TRPC_URL=http://localhost:3000/trpc SMOKE_ARTIFACT_DIR=/private/tmp/arsnova-slice3-browser/phase npm run smoke:host-phase-controls -w @arsnova/frontend` ist erfolgreich. Sechs sequenzielle Chromium-Kontexte prüfen:

| Locale | Preset      | Breite | Theme | Phasen                                                                    |
| ------ | ----------- | ------ | ----- | ------------------------------------------------------------------------- |
| de     | Spielerisch | 320px  | Light | LOBBY, QUESTION_OPEN, ACTIVE, DISCUSSION, zweite Runde, RESULTS, FINISHED |
| de     | Seriös      | 1440px | Dark  | dieselben Phasen einschließlich PI                                        |
| en     | Seriös      | 600px  | Light | LOBBY bis FINISHED                                                        |
| fr     | Spielerisch | 840px  | Dark  | LOBBY bis FINISHED                                                        |
| es     | Seriös      | 320px  | Dark  | LOBBY bis FINISHED                                                        |
| it     | Spielerisch | 1440px | Light | LOBBY bis FINISHED                                                        |

Alle Kontexte verwenden `reducedMotion: 'reduce'`. Geprüft sind vollständige lokale Labels, Reflow, Zielgrößen, sich nicht überlappende Footer-Controls, DOM-Reihenfolge und Menü-/Dialog-Tastaturfokus, Escape-Rückgabe, Enddialog-Abbruch in den deutschen Fällen und die Export-Einstiegspunkte. Die erzeugten Lobby-, Diskussions- und Abschlussbilder wurden zusätzlich visuell geprüft. Das Skript wartet vor Escape auf den abgeschlossenen Fokusübergang ins Material-Menü; bloße Sichtbarkeit geht dessen asynchronem Erstfokus voraus.

Zusätzlich erfolgreich ausgeführte Browserregressionen (jeweils mit `BASE_URL=http://localhost:4173/de`, `TRPC_URL=http://localhost:3000/trpc` und `SMOKE_ARTIFACT_DIR` unter `/private/tmp/arsnova-slice3-browser/`):

| Kommando                                                        | Ergebnis                                                                                                                                                              |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run smoke:session-question-progress -w @arsnova/frontend`  | Erfolgreich: späterer Start, Stimmen, Auslassen über das Menü, Nachbesprechung.                                                                                       |
| `npm run smoke:host-music -w @arsnova/frontend`                 | Erfolgreich: bestehende Musiksteuerung über den versetzten Trigger.                                                                                                   |
| `npm run smoke:unified-session -w @arsnova/frontend`            | Erfolgreich: Slice-2-Navigation, Aktivierung/Fehler/Retry/Fokus, offene Q&A nach Verlassen; axe ohne gemeldete Verstöße.                                              |
| `npm run smoke:epic-405-host-qa-lifecycle -w @arsnova/frontend` | Erfolgreich: bestehender Q&A-Lifecycle.                                                                                                                               |
| `npm run smoke:host-present-auth -w @arsnova/frontend`          | Erfolgreich: bestehende Host-/Presenter-Authentifizierung.                                                                                                            |
| `npm run smoke:structured-question-types -w @arsnova/frontend`  | Erfolgreich: drei strukturierte Fragetypen, PI, Abschlusskarte vor Confidence-Details, drei Nachbesprechungsprioritäten und Exportdaten; axe ohne gemeldete Verstöße. |
| `npm run smoke:product-feedback -w @arsnova/frontend`           | Erfolgreich: drei getrennte Teilnehmerkontexte, Session-Ende über das Menü, Host-/Teilnehmer-Feedback und Export-Abgrenzung.                                          |

Die allgemeinen Browser-Gates wurden danach sequenziell ausgeführt:

| Kommando                                                                                                                                       | Ergebnis                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `BASE_URL=http://localhost:4173 A11Y_ARTIFACT_DIR=/private/tmp/arsnova-slice3-browser/layout npm run a11y:layout -w @arsnova/frontend`         | Erfolgreich: 49 Zustände sowie Desktop-Join und Footer-Breakpoints; Reflow, mindestens 24px-Ziele und sichtbarer Tastaturfokus. |
| `BASE_URL=http://localhost:4173 A11Y_ARTIFACT_DIR=/private/tmp/arsnova-slice3-browser/axe-static npm run a11y:axe:static -w @arsnova/frontend` | Erfolgreich: 13 Zustände, keine gemeldeten Verstöße und keine Allowlist-Ausnahmen.                                              |

Der eigens gestartete Vorschau-Server wurde anschließend beendet; die zuvor laufenden Entwicklungsserver bleiben unberührt.

Die axe-Läufe melden weiterhin manuell zu prüfende `incomplete`-Ergebnisse, unter anderem für Kontrast und ARIA-Attribute. Ein erfolgreicher Lauf bedeutet hier keine automatisch festgestellten Verstöße, keine vollständige A11y-Abnahme.

Die UI verwendet Material-Buttons/-Menüs, Signals und bestehende System-Tokens. Keine neuen globalen Tokens, Farbhardcodierungen oder Piercing-Selektoren. Die Moderationsbeschriftung nutzt die kleinere Label-Typografie, damit sie auch neben der Join-Kapsel bei 320px lesbar bleibt.

Eine vollständige Screenreader-Abnahme und eine exhaustive Kombination aller Szenarien, Sprachen, Themes und Bewegungspräferenzen bleiben ausstehend. Lighthouse wurde nicht ausgeführt: Die unveränderten statischen Seiten werden durch die vorhandenen axe-/Layout-Gates abgedeckt; der geänderte Host wird direkt geprüft. Ein Lighthouse-Score oder vollständige WCAG-Konformität wird nicht behauptet.

## Integrationspunkte für Slice 4

- Q&A- und Blitzlicht-Werkzeuge wurden nicht in neue Akkordeons verlegt. Deren bestehende Anzeige-/Ton-Controls bleiben im bisherigen Chrome; Slice 4 kann die benannten Quiz-Bereiche als Referenz nutzen, ohne doppelte Presenter- oder Musiktrigger einzuführen.
- `showChannelNavigation` und `showChannelTabs` getrennt halten. Die Menü-/Fokuspfade von `addChannel`, die Sperre `channelNavigationBusy` und das Entfernen des letzten Hinzufügen-Eintrags nicht durch konkurrierende Fokusaktionen ergänzen.
- `pendingHostMoreAction`/`runHostMoreAction` koordinieren ausschließlich das Quiz-Zusatzmenü. Sie ändern keinen Kanalzustand. Für Q&A-Disclosure bei Filteränderungen den eigenen Fokuslebenszyklus prüfen.
- Kompass-Trigger und Rückkehrhinweis behalten einen stabilen DOM-Ort. Eine Verlegung in den Q&A-Werkzeugbereich muss relevante Befunde außerhalb eines geschlossenen Bereichs wahrnehmbar halten.
- Offene Q&A-/Blitzlicht-Kanäle nach Quizabschluss, `canStartAnotherQuiz`, dynamisches Verlassen bei offenem Q&A und neutrale Sessions bleiben Regressionen. Die Session-Ende-Smokes verwenden im Quiz jetzt den Menüweg, in anderen Kanälen weiterhin den dort bestehenden Weg.
- Die vollständige szenarioübergreifende Abnahme einschließlich der Q&A-/Blitzlicht-Werkzeuge gehört weiterhin zu den späteren Slices.

## Betrieb und Rücknahme

Normaler Frontend-Deploymentpfad; keine Migration und keine neue Konfiguration. Rücknahme durch den vorherigen Frontend-Build. Backend-Lastpfade, Shared-NAT-Ratenlimits und PDF-Erzeugung sind unverändert; Lasttests und eine erneute PDF/UA-Formatvalidierung sind für diese Platzierungsänderung nicht erforderlich. Eine vollständige Screenreader-Abnahme wird durch DOM-/axe-Tests und gezielte Sichtprüfungen nicht ersetzt.
