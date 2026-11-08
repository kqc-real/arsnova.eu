# Französische Texte: Prüfung vom 8. November 2026

Die Prüfung umfasst die Hauptseiten und die französischen Texte für Wortwolken,
Q&R, Blitzlicht, Moderations-Kompass, Lernziele, Demo-Quiz, Nachbereitung,
Hilfe, Rechtstexte und Landingpage.
Insgesamt wurden gegenüber dem Ausgangsstand 959 Zieltexte im XLF-Katalog
überarbeitet. IDs, Quelltexte, Platzhalter und Kontextangaben sind unverändert.
Es gibt keine Änderungen an API-Verträgen, Berechtigungen oder Auswertungslogik.

## Umfang

| Bereich                   | Geprüft und überarbeitet                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hauptseiten               | Navigation, Aktionen, Formulare, Hinweise, PWA-Schnellaktionen und zugängliche Namen                                                                                     |
| Wortwolken                | Wortgruppen und Themen, Gewichtung, Gruppierungssicherheit, Einstellungen, Lade- und Leerzustände, Export und Fehler                                                     |
| Q&R                       | Teilnahme und Moderation, Veröffentlichung, Sortierung und Hilfen, Schwärzen, Einstellungen und Fehlermeldungen                                                          |
| Blitzlicht                | Auswahl und Durchführung, Ergebnisse, Vergleichsrunde, Pause, Fortsetzung, Zurücksetzen und Fehler                                                                       |
| Moderations-Kompass       | Zusammenfassung, Analyse, Gewichtungen, Empfehlungen und nächste Schritte                                                                                                |
| Lernziele                 | Editor, Host- und Teilnehmertexte, Herkunft und Status, Erzeugung, Teilfortschritt, Abbruch, Wiederholung und Konflikte; einschließlich serverseitiger Standardmeldungen |
| Demo                      | Französischer Generator und erzeugte Quiz-Datei; Lösungen, IDs und numerische Spieleinstellungen unverändert                                                             |
| Nachbereitung             | Alle 317 effektiven französischen Berichtslabels mit dem App-Katalog abgeglichen; beide Demo-PDFs neu erzeugt                                                            |
| Hilfe und App-Rechtstexte | Rollenbasierte Hilfe, Anleitungen, Links, Teilnehmerrekord, Seitentitel, Metadaten, Lade- und Fehlertexte; Impressum, Datenschutz und Barrierefreiheit                   |
| Landingpage               | Alle Abschnitte einschließlich FAQ, Beispielansichten, Kompass, zugänglicher Namen und Metadaten geprüft; 141 Textfelder überarbeitet                                    |
| Landing-Rechtstexte       | Französische Fassungen der bestehenden deutschen Texte unter `/fr/impressum/` und `/fr/datenschutz/`, mit Footer-Links, eigenen Canonicals und Sitemap-Einträgen         |

Die Begriffe und die Ansprache sind in
[FRENCH-UI-COPY.md](../ui/FRENCH-UI-COPY.md) festgehalten. Die App spricht
Einzelpersonen mit `tu` an, während der Bericht seinem Glossar mit `vous` folgt.
Ein neuer Regressionstest gleicht die französischen Berichtslabels mit den
tatsächlichen Angular-Bindings ab. Zwei bewusst kurze Frageformat-Labels in der
Vorschau bleiben gegenüber den ausgeschriebenen PDF-Labels verschieden.

## Automatisierte Validierung

Alle folgenden Prüfungen wurden erfolgreich ausgeführt:

| Befehl                                                                                                                                                                                                                                                                                                   | Ergebnis                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run check:i18n -w @arsnova/frontend`                                                                                                                                                                                                                                                                | Alle vier Zielkataloge vollständig: jeweils 4235 Einträge                          |
| `npm run typecheck`                                                                                                                                                                                                                                                                                      | Gesamtes Monorepo bestanden                                                        |
| `npm run lint`                                                                                                                                                                                                                                                                                           | Bestanden                                                                          |
| `npm run test -w @arsnova/frontend`                                                                                                                                                                                                                                                                      | 157 Dateien, 2865 Tests bestanden                                                  |
| `npm run test -w @arsnova/frontend -- src/app/features/quiz/quiz-learning-objectives/quiz-learning-objectives.component.spec.ts src/app/features/session/session-host/qa-word-cloud-dialog.component.spec.ts src/app/features/session/session-host/session-learning-objectives-dialog.component.spec.ts` | Nach den abschließenden Text- und Layoutkorrekturen: 3 Dateien, 84 Tests bestanden |
| `npm run build -w @arsnova/session-export-report`                                                                                                                                                                                                                                                        | Bestanden                                                                          |
| `npm run test -w @arsnova/session-export-report`                                                                                                                                                                                                                                                         | 18 Dateien, 89 Tests bestanden                                                     |
| `npm run test -w @arsnova/backend -- src/lib/learningObjectiveDerivation.test.ts src/lib/qaSummaryAdapter.test.ts src/__tests__/qa.summary.test.ts`                                                                                                                                                      | 3 Dateien, 28 Tests bestanden                                                      |
| `npm run demo-quiz:locales -w @arsnova/frontend`                                                                                                                                                                                                                                                         | Französische Demo neu erzeugt; keine Änderungen an anderen Sprachdateien           |
| `NG_BUILD_CACHE_STORE=sqlite NG_BUILD_MAX_WORKERS=2 npm run build:localize -w @arsnova/frontend`                                                                                                                                                                                                         | Alle fünf Sprachen gebaut; 40 vorgerenderte Routen und Asset-Prüfung bestanden     |
| `npm run format:check:changed`                                                                                                                                                                                                                                                                           | Bestanden                                                                          |
| `git diff --check`                                                                                                                                                                                                                                                                                       | Bestanden                                                                          |

Der lokalisierte Build verwendet den SQLite-Cache als lokale Umgehung eines
nativen Cache-Absturzes. Die Repository-Konfiguration wurde dafür nicht geändert.
Zunächst wurden die vollständigen Frontend- und Berichts-Suites sowie die
betroffenen Backend-Tests ausgeführt. Vor dem Pull Request bestand zusätzlich
der vollständige Root-Lauf `npm test`: 12 Runtime-/Compose-, 296 Shared-Types-,
89 Report-, 2047 Backend- und 2865 Frontend-Tests, insgesamt 5309 bestandene Tests.
60 Backend-Tests wurden durch das bestehende Suite-Setup übersprungen.
Auch `npm run typecheck` und
`NG_BUILD_CACHE_STORE=sqlite NG_BUILD_MAX_WORKERS=2 npm run build:prod` wurden
abschließend erfolgreich ausgeführt.

## Browser und PDFs

Mit temporären Playwright-Prüfungen gegen den lokalisierten Build und lokale
Backend-Daten wurden folgende Ansichten geprüft:

- Q&R, Moderation, Schwärzen, Wortwolken, Kompass und Blitzlicht: vier
  Konfigurationen bei 320, 600, 840 und 1280 Pixeln, mit hellem und dunklem Theme;
  insgesamt 32 Layoutzustände. Die Prüfung wurde aus dem vorhandenen
  Host-Q&R-/Blitzlicht-Smoke abgeleitet und an die französischen Texte angepasst.
- Lernziel-Editor, Anlageformular, angelegtes Lernziel und geladener Host-Dialog:
  16 Zustände über dieselben vier Breiten, ohne horizontalen Überlauf.
- Die bei 320 Pixeln beobachtete Überdeckung des Wortwolken-Reiters durch den
  Schließen-Button wurde durch eine Mindesthöhe der vorhandenen Kopfzeile
  behoben. Die abschließende Geometrieprüfung bestand für alle fünf Sprachen.
- Acht axe-Prüfungen meldeten keine Verstöße. Für `aria-valid-attr-value` und
  `color-contrast` blieben unvollständige automatische Prüfungen bestehen. Das ist
  kein vollständiger manueller WCAG- oder Tastatur-Audit.

Die temporären Prüfskripte und Screenshots sind lokale Prüfartefakte und gehören
nicht zum Repository. Nicht jeder Fehlerzustand wurde im Browser ausgelöst;
deren französische Texte wurden im Katalog und anhand der Implementierung
geprüft.

Die französischen Demo-Berichte wurden mit
`DEMO_PDF_LOCALES=fr npm run generate:session-pdf-demo -w @arsnova/frontend`
gegen den lokalen Server erzeugt. Die lokale Umgebung stellte dabei
`NODE_OPTIONS`, `DOTENV_CONFIG_PATH`, `TRPC_URL` und
`SESSION_EXPORT_ASSET_BASE_URL` bereit.

- Standard-PDF: 22 Seiten, alle Seiten gerendert und visuell geprüft.
- PDF/UA: 26 Seiten, alle Seiten gerendert und visuell geprüft.
- `PDFUA_LOCALES=fr PDFUA_ARTIFACT_DIR=/tmp/arsnova-fr-pdf-qa/validation npm run validate:pdfua`:
  PDF/UA-1-Prüfung mit dem festgelegten veraPDF-Image bestanden.

Für diese Änderungen ist keine Migration erforderlich. Ein Rückbau besteht aus
dem Zurücksetzen der Text-, Dokumentations- und Asset-Änderungen sowie der
einzeiligen Layoutkorrektur und einem erneuten Build.

Für die französischen Landing-Rechtsseiten zusätzlich die neuen Dateien,
Footer-Verweise und Sitemap-Einträge gemeinsam zurücksetzen.

## Ergänzung: Hilfe, Rechtstexte und Landingpage

In diesem Durchgang wurden 38 französische XLF-Zieltexte geändert. Quelltexte,
IDs, Kontextangaben und sämtliche Inline-Platzhalter sind gegenüber dem Stand
vor diesem Durchgang und gegenüber HEAD unverändert. Die Landing-Dictionary
behält alle Schlüssel, IDs, Symbole, CSS-Klassen und numerischen Beispieldaten.
Alle Zahlenwerte und URLs der drei französischen App-Rechtstexte sind erhalten.
Die beiden neuen Landing-Rechtsseiten übersetzen die getrennten deutschen
Landing-Texte; das GitHub-Pages-Hosting wird nicht durch die Hetzner-Angaben der
App ersetzt. Die übrigen Landing-Sprachen verweisen wie bisher auf die deutschen
Rechtsseiten.

Für die französischen Rechts- und Accessibility-Begriffe wurden die
[französische RGPD-Fassung auf EUR-Lex](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679)
und die [französische WCAG-2.2-Übersetzung des W3C](https://www.w3.org/Translations/WCAG22-fr/)
herangezogen. Die Bearbeitung ist eine sprachliche Überarbeitung vorhandener
Aussagen, keine erneute rechtliche oder umfassende WCAG-Abnahme.

Zusätzlich zum ersten Prüfdurchgang wurden ausgeführt:

| Befehl                                                                                                                                                                                                                                                                                                                           | Ergebnis                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm run test -w @arsnova/frontend -- src/app/features/help/help.component.spec.ts src/app/features/legal/legal-page.component.spec.ts src/app/features/legal/legal-copy.spec.ts src/app/shared/info-landing-link/info-landing-link.component.spec.ts src/app/core/info-landing-url.spec.ts src/app/core/seo-route-meta.spec.ts` | 6 Dateien, 50 Tests bestanden                                                                                 |
| `npm run check:i18n -w @arsnova/frontend`                                                                                                                                                                                                                                                                                        | Vier vollständige Zielkataloge, jeweils 4235 Einträge                                                         |
| `NG_BUILD_CACHE_STORE=sqlite NG_BUILD_MAX_WORKERS=2 npm run build:localize -w @arsnova/frontend`                                                                                                                                                                                                                                 | Alle fünf Sprachen, Prerendering und Asset-Gate bestanden                                                     |
| `npm run build -w @arsnova/landing`                                                                                                                                                                                                                                                                                              | Bestanden, einschließlich beider neuer Rechtsseiten                                                           |
| `npm run test:i18n -w @arsnova/landing`                                                                                                                                                                                                                                                                                          | Bestanden; prüft auch französische Footer-Links, Canonicals, Sitemap und Vollständigkeit der Rechtsabschnitte |
| `npm run check -w @arsnova/landing`                                                                                                                                                                                                                                                                                              | Keine Fehler oder Warnungen; zwei bestehende Hinweise zu `MediaQueryList.addListener`                         |
| `npm run lint`                                                                                                                                                                                                                                                                                                                   | Bestanden                                                                                                     |
| `BASE_URL=http://127.0.0.1:4184 A11Y_ROUTES=/de/,/en/,/fr/,/it/,/es/,/impressum/,/datenschutz/,/fr/impressum/,/fr/datenschutz/ A11Y_ARTIFACT_DIR=/tmp/arsnova-fr-public-ui/landing-axe npm run test:a11y -w @arsnova/landing`                                                                                                    | Neun Zustände bestanden; automatische Kontrastprüfungen teilweise unvollständig                               |

Eine temporäre Playwright-Prüfung hat Hilfe, die drei App-Rechtsseiten, die
Landingpage und ihre beiden französischen Rechtsseiten bei 320, 600, 840 und
1280 Pixeln in heller und dunkler Darstellung geprüft: 56 Layoutzustände ohne
horizontalen Überlauf. In der App wurde dabei Seriös in Hell und Spielerisch in
Dunkel verwendet. Die Hilfe-Akkordeons wurden zur Längenprüfung geöffnet.
Zusätzlich wurden sieben axe-Prüfungen der französischen Seiten ausgeführt,
ohne gemeldete Verstöße; `aria-hidden-focus` beziehungsweise `color-contrast`
blieben teilweise automatisch unvollständig.

Ladezustand, fehlgeschlagener Abruf einschließlich Sprach-Fallback, erfolgreiches
Neuladen und französischer Footer-Navigationspfad wurden separat im Browser
geprüft. Die lokalen Vorschauen verwendeten statische Builds ohne Backend;
die sichtbare Offline-Meldung der App ist daher erwartbar. Die Änderungen sind
lokal geprüft und wurden nicht produktiv bereitgestellt.
