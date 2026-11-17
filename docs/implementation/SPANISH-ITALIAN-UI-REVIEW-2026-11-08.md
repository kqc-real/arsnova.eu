# Spanische und italienische Texte: Prüfung vom 8. November 2026

Die Prüfung umfasst Hauptseiten, Wortwolken, Q&A, Blitzlicht,
Moderations-Kompass, Lernziele, Demo-Quiz, Nachbereitung, Hilfe, Rechtstexte,
Landingpage und PWA. Maßgeblich sind deutsche Quelltexte und implementiertes
Verhalten. Sprachstandard sind Standardspanisch mit dem bestehenden Bezug
`es_ES` und Standarditalienisch mit `it_IT`.

Gegenüber dem Ausgangsstand wurden 770 spanische und 750 italienische
XLF-Zieltexte überarbeitet. Alle 4235 IDs, Quelltexte, Kontextangaben,
Inline-XML-Platzhalter, ICU-Strukturen und nummerierten Berichtsplätze je
Katalog sind erhalten. Deutsch, Englisch und Französisch bleiben unverändert.
API-Verträge, Berechtigungen, Lösungsschlüssel und Auswertungslogik ändern sich
nicht.

## Umfang und Entscheidungen

| Bereich              | Ergebnis                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hauptseiten          | Navigation, Buttons, Formulare, ARIA-Namen, Metadaten, Statusmeldungen und PWA-Schnellaktionen vereinheitlicht                                                                                   |
| Wortwolken           | Expresiones / Espressioni und Temas / Temi; Einstellungen, Gewichtung, Ergebnisse, Leerzustände und Fehler geprüft                                                                               |
| Q&A                  | Publicar / Pubblica, Freigabestatus, Anheften, temporärer Fokus, Schwärzen, Sortierhilfe und Export getrennt benannt                                                                             |
| Blitzlicht           | Sondeo rápido / Sondaggio rapido; Pause, Wiederaufnahme, Ergebnisse, Vergleichsrunde und Formatbindung geprüft                                                                                   |
| Moderations-Kompass  | Brújula de moderación / Bussola di moderazione; nächster Schritt, Quellen, Gruppierung, Einschränkungen und Fehler                                                                               |
| Lernziele            | Objetivo de aprendizaje / Obiettivo di apprendimento; KI-Herkunft unabhängig von Entwurfs- und Bestätigungsstatus; Editor, Host, Generierung, Teilfortschritt und Fehler                         |
| Demo                 | Generator und erzeugtes JSON geprüft; je acht Textwerte geändert; Struktur, IDs, Typen, Zahlen, Lösungen und akzeptierte Kurzantwortvarianten erhalten                                           |
| Nachbereitung        | Alle 317 effektiven Berichtslabels je Sprache mit den tatsächlichen App-Bindings abgeglichen; Regressionstest erweitert                                                                          |
| Hilfe und Recht      | Hilfe, sechs App-Rechtstexte und UI-Verweise geprüft; Zahlenangaben und URLs in allen sechs Rechtstexten erhalten                                                                                |
| Landingpage          | 161 spanische und 152 italienische Textwerte geändert; alle 434 Blattwerte je Sprache auf Struktur und technische Angaben geprüft; IDs, Klassen, Symbole, URLs und numerische Beispiele erhalten |
| Landing-Rechtsseiten | Vier eigene Rechtsseiten mit passenden Footer-Links, Canonicals und Sitemap ergänzt; bestehende Sprachfassungen bleiben erhalten                                                                 |

Die [spanischen](../ui/SPANISH-UI-COPY.md) und
[italienischen Guidelines](../ui/ITALIAN-UI-COPY.md) dokumentieren konkrete
Do’s und Don’ts: Guardando statt Ahorrar, rechte Zuordnungsseite statt Rechte,
Textfundstelle statt gefundener Ort, obiettivo statt destinazione und tatsächliche
Teilnehmerzahlen statt se unió por completo oder uniti del tutto.

Antwortsicherheit bezeichnet die Selbsteinschätzung zur Antwort,
Gruppierungssicherheit die Zuverlässigkeit einer Gruppierung. Apoyo claro und
Consenso solido bewerten Zustimmung, keine fachliche Richtigkeit. Hohe Sicherheit
bei einer falschen Antwort ist ein möglicher Hinweis, keine gesicherte Diagnose.
Informe de resultados und Rapporto sui risultati bezeichnen das Dokument; der
Plan für die Nachbesprechung bleibt ein eigener Abschnitt darin.

Fachlich relevante Texte wurden am Code geprüft: Ersatzstimme in Runde zwei,
gemeinsame Bestätigung für Diskussion und Ergebnisanzeige, bereits erzeugte
Lernzielentwürfe, fehlende Quellfragen, Antwortsicherheit ohne Punkteeffekt,
Pseudonyme und optionale Identitätsbindung sowie Zugriff gegenüber Aufbewahrung.
Die berichtigte Erklärung zu 0 % gefestigtem Wissen und der Wechsel von richtigen
zu falschen Antworten sind zusätzlich durch Berichtsassertionen abgesichert.

Rechtsbegriffe wurden mit den DSGVO-Fassungen auf EUR-Lex für
[Spanisch](https://eur-lex.europa.eu/eli/reg/2016/679/oj/spa) und
[Italienisch](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita) abgeglichen.
Für Accessibility-Begriffe wurden die
[spanische WAI-Übersicht](https://www.w3.org/WAI/standards-guidelines/wcag/es),
[WCAG 2.2](https://www.w3.org/TR/WCAG22/) und die
[autorisierte italienische Übersetzung](https://www.w3.org/Translations/WCAG22-it/)
herangezogen. Informationswebsite und Live-App behalten ihre getrennten
Hostingkontexte. Dies ist eine sprachliche Prüfung vorhandener Aussagen, keine
erneute rechtliche oder vollständige WCAG-Abnahme.

## Automatisierte Validierung

| Befehl                                                                                                                                                                                                                                                                                                                           | Ergebnis                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                                                                                                                                                                                                                                                              | Bestanden                                                                                                                                                        |
| `npm test`                                                                                                                                                                                                                                                                                                                       | 5312 Tests bestanden, 60 bestehende Backend-Tests übersprungen: 12 Runtime-Vertragstests, 296 Shared-Types-, 92 Berichts-, 2047 Backend- und 2865 Frontend-Tests |
| `npm run lint`                                                                                                                                                                                                                                                                                                                   | Bestanden                                                                                                                                                        |
| `NG_BUILD_CACHE_STORE=sqlite NG_BUILD_MAX_WORKERS=2 npm run build:prod`                                                                                                                                                                                                                                                          | Alle fünf Frontend-Sprachen, Prerendering und Asset-Gate bestanden                                                                                               |
| `npm run check:i18n -w @arsnova/frontend`                                                                                                                                                                                                                                                                                        | Vier vollständige Zielkataloge mit jeweils 4235 Einträgen                                                                                                        |
| `npm run check -w @arsnova/landing`                                                                                                                                                                                                                                                                                              | Keine Fehler oder Warnungen; zwei bestehende Hinweise zu MediaQueryList.addListener                                                                              |
| `npm run build -w @arsnova/landing`                                                                                                                                                                                                                                                                                              | Bestanden, 16 Seiten einschließlich der vier neuen Rechtsseiten                                                                                                  |
| `npm run test:i18n -w @arsnova/landing`                                                                                                                                                                                                                                                                                          | Alle fünf Sprachen, Footer, Rechtsabschnitte, Canonicals und Sitemap bestanden                                                                                   |
| `npm run test -w @arsnova/session-export-report`                                                                                                                                                                                                                                                                                 | Nach den letzten zusätzlichen Regressionassertionen erneut 92 Tests bestanden                                                                                    |
| `npm run test -w @arsnova/frontend -- src/app/features/help/help.component.spec.ts src/app/features/legal/legal-page.component.spec.ts src/app/features/legal/legal-copy.spec.ts src/app/shared/info-landing-link/info-landing-link.component.spec.ts src/app/core/info-landing-url.spec.ts src/app/core/seo-route-meta.spec.ts` | 50 Tests bestanden                                                                                                                                               |

Prettier für geänderte unterstützte Textdateien und `git diff --check` sind
bestanden. Die XLF-Struktur wird zusätzlich durch den i18n-Check geprüft.
Strukturvergleiche sichern IDs, Quellen, Platzhalter, ICU, Demo-Lösungen,
Legal-Zahlen und -URLs sowie unveränderte CSV-Spaltenzahlen ab.

## Browser und PDF

Temporäre Playwright-Prüfungen verwendeten die lokalen Builds und einen lokalen
tRPC-/WebSocket-Dienst mit PostgreSQL und Redis. Geprüfte Breiten waren 320, 600,
840 und 1280 Pixel. Es gab keine Änderungen an CSS oder Komponentenstruktur.

- Wortwolken, Q&A, Kompass und Blitzlicht: 64 Layoutzustände in beiden Sprachen;
  Veröffentlichung, Suchtexte zum Schwärzen, Einstellungen, Abstimmung, Pause,
  Wiederaufnahme, Ergebnisanzeige, Vergleichsrunde, Formatbindung, Zurücksetzen
  und Neuladen. 16 axe-Prüfungen ohne gemeldete Verstöße;
  aria-valid-attr-value und color-contrast teilweise unvollständig.
- Lernziele: 32 Layoutzustände im Editor und Host; Einführung, manuelle Anlage,
  Formular und bestätigtes Ziel. Keine echte KI-Modellgenerierung; deren
  Zustände wurden anhand von Code, Katalog und Tests geprüft.
- Hilfe, je drei App-Rechtsseiten, Landingpage und je zwei Landing-Rechtsseiten:
  112 Layoutzustände in Hell/Dunkel ohne horizontalen Überlauf; geöffnete
  Hilfe-Akkordeons. 14 axe-Prüfungen ohne gemeldete Verstöße;
  aria-hidden-focus und color-contrast teilweise unvollständig.
- Legal: lokalisierter Ladezustand, fehlgeschlagener Abruf einschließlich
  Sprach-Fallback, erfolgreiches Neuladen und Navigation vom jeweiligen
  Landing-Footer geprüft.
- Landing-axe-Gate: alle 15 Home- und Rechtsrouten bestanden, keine gemeldeten
  Verstöße; automatische Kontrastprüfung teilweise unvollständig.

Repräsentative mobile Screenshots wurden zusätzlich visuell geprüft, darunter
Kompass, Lernziele, Wortwolken, Schwärzen und Landingpage in beiden Sprachen.
Die Browserprüfungen ersetzen keinen vollständigen manuellen Tastatur-,
Fokuswiederherstellungs- oder Screenreader-Audit. Nicht jede Fehlermeldung wurde
im Browser ausgelöst; ein vollständiger CSV-Download wurde dort nicht geprüft.
Temporäre Skripte und Screenshots bleiben lokale Prüfartefakte.

Die vier Demo-Berichte wurden mit
`DEMO_PDF_LOCALES=es,it npm run generate:session-pdf-demo -w @arsnova/frontend`
gegen den lokalen Dienst erzeugt. Die lokale Umgebung stellte NODE_OPTIONS,
DOTENV_CONFIG_PATH, TRPC_URL und SESSION_EXPORT_ASSET_BASE_URL bereit.

| Sprache     | Standard-PDF | PDF/UA    |
| ----------- | ------------ | --------- |
| Spanisch    | 22 Seiten    | 25 Seiten |
| Italienisch | 22 Seiten    | 24 Seiten |

Alle 93 Seiten wurden gerendert und visuell geprüft. Beide PDF/UA-Versionen
bestanden `PDFUA_LOCALES=es,it PDFUA_ARTIFACT_DIR=/tmp/arsnova-es-it/pdf/validation npm run validate:pdfua`
mit dem festgelegten veraPDF-Image 1.30.2.

Es ist keine Migration oder neue Konfiguration erforderlich. Ein Rückbau umfasst
Texte, Dokumentation und Demo-Assets sowie die vier neuen Landing-Rechtsseiten,
ihre Footer-Verweise und Sitemap-Einträge gemeinsam; anschließend neu bauen.
Die Änderungen wurden nicht produktiv bereitgestellt.
