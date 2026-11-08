# Englische Texte: Prüfung vom 8. November 2026

Die Prüfung umfasst die englischen Hauptseiten, Wortwolken, Q&A, Blitzlicht,
Moderations-Kompass, Lernziele, Demo-Quiz, Nachbereitung, Hilfe, Rechtstexte und
Landingpage. Maßgeblich sind die deutschen Quelltexte und das implementierte
Verhalten. Der Sprachstandard ist US-Englisch.

Gegenüber dem Ausgangsstand wurden 686 XLF-Zieltexte überarbeitet. Alle 4235 IDs,
Quelltexte, Kontextangaben, Inline-XML-Platzhalter und nummerierten Berichtsplätze
sind erhalten. Die übrigen Sprachkataloge sind unverändert. API-Verträge,
Berechtigungen, Lösungsschlüssel und Auswertungslogik werden nicht geändert.

## Umfang und Entscheidungen

| Bereich              | Ergebnis                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hauptseiten          | Navigation, Buttons, Formulare, PWA-Schnellaktionen, ARIA-Namen, Metadaten und Statusmeldungen sprachlich vereinheitlicht                                   |
| Wortwolken           | Phrases, Topics und Grouping reliability; Einstellungen, Gewichtung, Ergebnisse, Leerzustände und Fehler geprüft                                            |
| Q&A                  | Publish, Awaiting review, Pin und Strong support; Moderation, Schwärzen, Sortierhilfe, Export und Fehlerabläufe präzisiert                                  |
| Blitzlicht           | Pulse Check als Funktionsname; Pace barometer, Ergebnisse, Vergleichsrunde, Formatbindung, Pause und Wiederaufnahme geprüft                                 |
| Moderations-Kompass  | Moderation compass und Next step; Analyse, Gruppierung, Quellen, Einschränkungen und Fehlermeldungen vereinheitlicht                                        |
| Lernziele            | Learning objective, Herkunft AI suggestion und getrennte Statuswerte; Editor, Host, Teilnehmer, Erzeugung, Teilfortschritt, Wiederholung und Fehler geprüft |
| Demo                 | Generator, JSON, Einführung, Fragen, Antworten und Bildtexte geprüft; 16 Textwerte im erzeugten JSON geändert                                               |
| Nachbereitung        | Alle 317 effektiven englischen Berichtslabels mit den tatsächlichen App-Bindings abgeglichen; Regressionstest für Englisch und Französisch                  |
| Hilfe und Recht      | Hilfe, drei App-Rechtstexte und ihre UI-Verweise überarbeitet; Zahlenangaben und URLs der Rechtstexte erhalten                                              |
| Landingpage          | 139 Textwerte geändert; alle 434 Blattwerte auf Struktur und technische Angaben geprüft; IDs, Klassen, Symbole, URLs und numerische Beispieldaten erhalten  |
| Landing-Rechtsseiten | Eigene englische Fassungen, englische Footer-Links, Canonicals und Sitemap ergänzt; deutscher und französischer Bestand bleiben erhalten                    |

Die [englischen Guidelines](../ui/ENGLISH-UI-COPY.md) dokumentieren die gefundenen
Do’s und Don’ts. Beispiele sind Left-hand statt Left-wing, One match found statt
Found a site und Checking statt Exam is ongoing. Answer confidence beschreibt
die Selbsteinschätzung zur Antwort; Grouping reliability beschreibt die
Gruppierung. Beliebtheit ist keine fachliche Richtigkeit. AI suggestion benennt
die Herkunft unabhängig von Draft oder Confirmed. Debriefing report bezeichnet
das Dokument, Debriefing plan einen Abschnitt darin.

Auch Texte mit fachlicher Wirkung wurden am Code geprüft: Ersatzstimme in der
zweiten Runde, ein gemeinsamer Bestätigungsbutton für Diskussion und Ergebnisse,
bereits erzeugte Lernzielentwürfe, fehlende Quellfragen, gleich lange
Kurzantworten mit kleinen Tippfehlern und die Grenzen pädagogischer Aussagen.

Die englischen Rechts- und Accessibility-Begriffe wurden mit der
[englischen DSGVO-Fassung auf EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)
und [WCAG 2.2 beim W3C](https://www.w3.org/TR/WCAG22/) abgeglichen. App und
Informationswebsite behalten ihre getrennten Hosting- und Datenschutzkontexte.
Die Arbeit ist eine sprachliche Prüfung vorhandener Aussagen, keine erneute
rechtliche oder vollständige WCAG-Abnahme.

## Automatisierte Validierung

| Befehl                                                                                                                                                                                                | Ergebnis                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                                                                                                                                   | Bestanden für Shared Types, Berichte, Backend und Frontend                                                                                                       |
| `npm test`                                                                                                                                                                                            | 5310 Tests bestanden, 60 bestehende Backend-Tests übersprungen: 12 Runtime-Vertragstests, 296 Shared-Types-, 90 Berichts-, 2047 Backend- und 2865 Frontend-Tests |
| `npm run lint`                                                                                                                                                                                        | Bestanden                                                                                                                                                        |
| `NG_BUILD_CACHE_STORE=sqlite NG_BUILD_MAX_WORKERS=2 npm run build:prod`                                                                                                                               | Alle fünf Frontend-Sprachen, Prerendering und Asset-Gate bestanden                                                                                               |
| `npm run check:i18n -w @arsnova/frontend`                                                                                                                                                             | Vier vollständige Zielkataloge mit jeweils 4235 Einträgen                                                                                                        |
| `npm run build -w @arsnova/landing`                                                                                                                                                                   | Bestanden, einschließlich beider neuer englischer Rechtsseiten                                                                                                   |
| `npm run test:i18n -w @arsnova/landing`                                                                                                                                                               | Bestanden für alle fünf Sprachen; prüft auch Footer, Rechtsabschnitte, Canonicals und Sitemap                                                                    |
| `npm run check -w @arsnova/landing`                                                                                                                                                                   | Keine Fehler oder Warnungen; zwei bestehende Hinweise zu MediaQueryList.addListener                                                                              |
| `node --test scripts/load/issue-456-demo-acceptance.test.mjs scripts/load/demo-duration-evaluation.test.mjs`                                                                                          | 23 Tests bestanden; Prozesszähler erfordern Ausführung außerhalb der Dateisystem-Sandbox                                                                         |
| `BASE_URL=http://127.0.0.1:4184 A11Y_ROUTES=/de/,/en/,/fr/,/it/,/es/,/impressum/,/datenschutz/,/fr/impressum/,/fr/datenschutz/,/en/impressum/,/en/datenschutz/ npm run test:a11y -w @arsnova/landing` | Elf Zustände bestanden, keine gemeldeten Verstöße; automatische Kontrastprüfung teilweise unvollständig                                                          |

Zusätzlich wurden nach der letzten Titelkorrektur die sechs betroffenen Hilfe-,
Legal-, Link- und SEO-Testdateien erneut ausgeführt (50 Tests bestanden).
Prettier für die geänderten unterstützten Textdateien und `git diff --check`
sind bestanden. Die XLF-Struktur wird durch den i18n-Check geprüft.

## Browser und PDF

Temporäre Playwright-Prüfungen verwendeten die lokalen Builds und einen lokalen
tRPC-/WebSocket-Dienst mit PostgreSQL und Redis. Die Breiten waren 320, 600, 840
und 1280 Pixel. Es gab keine Änderungen an CSS oder Komponentenstruktur.

- Wortwolken, Q&A und Blitzlicht: 32 Layoutzustände; Veröffentlichung,
  Schwärzen-Suchtexte, Einstellungen, Abstimmung, Pause, Wiederaufnahme,
  Ergebnisanzeige, Vergleichsrunde, Formatbindung, Zurücksetzen und Neuladen.
  Acht axe-Prüfungen ohne gemeldete Verstöße; aria-valid-attr-value und
  color-contrast teilweise unvollständig.
- Lernziele: 16 Layoutzustände im Editor und Host; Einführung, manuelle Anlage,
  Formular und bestätigtes Lernziel. Eine echte KI-Modellgenerierung wurde nicht
  ausgeführt; ihre Zustände wurden anhand von Code, Katalog und Tests geprüft.
- Hilfe, drei App-Rechtsseiten, Landingpage und zwei Landing-Rechtsseiten:
  56 Layoutzustände in heller und dunkler Darstellung ohne horizontalen
  Überlauf. Hilfe-Akkordeons wurden geöffnet. Sieben axe-Prüfungen ohne
  gemeldete Verstöße; aria-hidden-focus und color-contrast teilweise
  unvollständig.
- Legal: Ladezustand, fehlgeschlagener Abruf einschließlich Sprach-Fallback,
  erfolgreiches Neuladen und Navigation vom englischen Landing-Footer geprüft.

Die Browserprüfungen ersetzen keinen vollständigen manuellen Tastatur-,
Fokuswiederherstellungs- oder Screenreader-Audit. Nicht jede Fehlermeldung wurde
im Browser ausgelöst. Die temporären Skripte und Screenshots sind lokale
Prüfartefakte und werden nicht eingecheckt.

Beide englischen Demo-Berichte wurden gegen den lokalen Dienst neu erzeugt:
`DEMO_PDF_LOCALES=en npm run generate:session-pdf-demo -w @arsnova/frontend`.
Die lokale Umgebung stellte NODE_OPTIONS, DOTENV_CONFIG_PATH, TRPC_URL und
SESSION_EXPORT_ASSET_BASE_URL bereit.

- Standard-PDF: 22 Seiten; alle Seiten gerendert und visuell geprüft.
- PDF/UA: 24 Seiten; alle Seiten gerendert und visuell geprüft.
- `PDFUA_LOCALES=en PDFUA_ARTIFACT_DIR=/tmp/arsnova-en-pdf-qa/validation npm run validate:pdfua`:
  PDF/UA-1-Prüfung mit dem festgelegten veraPDF-Image bestanden.

Es ist keine Migration oder neue Konfiguration erforderlich. Der Rückbau umfasst
die Texte, Dokumentation und Demo-Assets sowie die neuen englischen
Landing-Rechtsseiten, ihre Footer-Verweise und Sitemap-Einträge gemeinsam;
anschließend neu bauen. Die Änderungen wurden nicht produktiv bereitgestellt.
