# Spanische UI-Texte

Diese Regeln gelten für spanische Texte in App, Demo, Berichten, Hilfe,
Rechtstexten, Landingpage und PWA. Maßgeblich sind die deutschen Quelltexte und
das implementierte Verhalten. Ergänzend gelten [Styleguide](STYLEGUIDE.md),
[i18n-Workflow](../I18N-ANGULAR.md) und
[Berichtsglossar](../features/session-export-pdf-i18n-glossary.md).

## Sprachstandard und Ansprache

- Standardspanisch mit dem bestehenden Spanien-Bezug der Landing-Metadaten
  (`es_ES`): **móvil**, **ordenador**, **ajustes**. Keine regionalen Redewendungen.
- In der App konsequent **tú**. Nicht innerhalb eines Ablaufs zwischen
  **selecciona**, **seleccione** und **seleccionar** wechseln. Für Buttons ist
  der Infinitiv üblich: **Guardar**, **Eliminar**, **Publicar**, **Reintentar**.
  In erklärenden Sätzen direkt ansprechen: **Selecciona**, **Comprueba**.
- Berichte verwenden neutrale Infinitive wie **Retomar los conceptos** und
  **Explicar por qué…**. Keine wechselnde informelle oder formelle Anrede in
  automatisierten Empfehlungen.
- Satzgroßschreibung; Akzente und umgekehrte Frage-/Ausrufezeichen erhalten.
  **Sí** bedeutet ja, **si** leitet eine Bedingung ein.
- Kontrollnamen mit **«…»** ohne französische Zwischenräume zitieren. Den
  tatsächlichen sichtbaren Namen verwenden, etwa **«Iniciar»**, **«Más»** und
  **«Compartir la biblioteca»**. Dynamische Namen brauchen eigenes i18n-Markup.
- Kurze Sätze mit konkreten Verben. Deutsche Nominalketten und englische
  Marketingwendungen nicht wörtlich übernehmen. Geräteunabhängig formulieren:
  **Abre la imagen** passt zu Touch, Tastatur und Maus.

## Verbindliche Produktbegriffe

| Bedeutung              | Spanisch                                                                                                                    | Vermeiden                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Quiz                   | **Cuestionario**                                                                                                            | **Prueba** als wechselnder Name desselben Objekts                                 |
| Quiz-Sammlung          | **Biblioteca de cuestionarios**, kurz **biblioteca**                                                                        | Wechsel zwischen colección und biblioteca im selben Ablauf                        |
| Host                   | **quien dirige la sesión**, kompakt **moderación**                                                                          | Auf Lehrpersonal beschränkte Rollen in allgemeinen Sessiontexten                  |
| Q&A                    | **Q&A**, erklärend **preguntas y respuestas**                                                                               | Zusätzliche Kanalnamen oder eine Übersetzung technischer Schlüssel                |
| Freigeben              | **Publicar**, **Publicada**, **Pendiente de revisión**                                                                      | Eine Veröffentlichung als fachliche Bewertung darstellen                          |
| Anheften               | **Fijar**, **Desfijar**, **Fijada**                                                                                         | **Destacar** gleichzeitig für Anheften und temporären Fokus verwenden             |
| Temporärer Fokus       | **En foco**, **Quitar foco**                                                                                                | Fokus und angeheftete Fragen gleichsetzen                                         |
| Stimmensaldo           | **Saldo de votos**                                                                                                          | Mit der Wilson-basierten Sortierung verwechseln                                   |
| Klare Zustimmung       | **Apoyo claro**                                                                                                             | **Mejores preguntas**, Qualität oder Richtigkeit behaupten                        |
| Wortwolke              | **Nube de palabras**                                                                                                        | Unnötige englische Alternativnamen                                                |
| Wortgruppen / Themen   | **Expresiones** / **Temas**                                                                                                 | Eine expresión zwingend als vollständigen Satz darstellen                         |
| Gruppierungssicherheit | **Fiabilidad de la agrupación**                                                                                             | Mit Antwortsicherheit oder Richtigkeit vermischen                                 |
| Blitzlicht             | **Sondeo rápido**                                                                                                           | Blitzlicht, sondeo flash oder wechselnde Funktionsnamen                           |
| Antwortsicherheit      | **Seguridad en la respuesta**                                                                                               | Unspezifisches autoevaluación; confianza gleichzeitig für alle Kennzahlen         |
| Moderations-Kompass    | **Brújula de moderación**, kurz **Brújula**                                                                                 | Unterschiedliche Namen in Hilfe, Host und Landing                                 |
| Nächster Schritt       | **Siguiente paso**                                                                                                          | Wechsel zwischen Lo siguiente und anderen Produktlabels                           |
| Lernziel               | **Objetivo de aprendizaje**                                                                                                 | meta und objetivo beliebig mischen                                                |
| KI-Herkunft            | **Sugerencia de IA**                                                                                                        | Ein bestätigtes KI-Ziel dauerhaft Borrador de IA nennen                           |
| Lernzielstatus         | **Borrador**, **Confirmado**, **Revisión necesaria**                                                                        | Herkunft und Status gleichsetzen                                                  |
| PDF-Dokument           | **Informe de resultados**                                                                                                   | plan de debriefing oder plan de recapitulación als wechselnde Exportnamen         |
| Planabschnitt im PDF   | **Plan para la puesta en común**                                                                                            | Mit dem gesamten Bericht gleichsetzen                                             |
| PDF/UA-Auswahl         | **Accesible (PDF/UA-1)**                                                                                                    | Neue oder umfassendere Accessibility-Zusagen                                      |
| Frageformate           | **Respuesta única**, **Respuesta múltiple**, **Emparejamiento**, **Ordenación**, **Clasificación**, **Estimación numérica** | mapeo, pedidos oder wechselnde Typnamen                                           |
| Lokaler Stil           | **Serio**, **Lúdico**                                                                                                       | Mit Session-Konfigurationsprofilen oder erzwungenen Teilnehmer-Themes verwechseln |
| Session-Code           | **Código de 6 caracteres**                                                                                                  | 6 dígitos: Buchstaben sind zulässig                                               |

## Do’s und Don’ts aus der Prüfung

| Kontext                | Richtig                                                                          | Falsch oder irreführend                                              |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Speichern              | **Guardar** / **Guardando…**                                                     | **Ahorrar**: bedeutet Geld oder Ressourcen sparen                    |
| Einfache Schwierigkeit | **fácil**                                                                        | **luz**: Übersetzung von Licht statt leicht                          |
| Rechte Zuordnungsseite | **Los términos de la derecha deben ser únicos.**                                 | términos de los derechos                                             |
| Warten auf Antworten   | **Esperando a que los participantes envíen sus pares…**                          | Behaupten, die Teilnehmenden selbst würden zugeordnet                |
| Textfundstelle         | **Se encontró una coincidencia.**                                                | **Encontré un sitio.**                                               |
| Dauerhaftes Schwärzen  | **Ocultar fragmentos**, **Aplicando ocultaciones…**                              | **La negrura se salva…** oder redacciones als Schwärzungen           |
| Dienstprüfung          | **Comprobando…**                                                                 | **El examen está en curso…**                                         |
| Antwortwechsel         | **de una respuesta correcta a una incorrecta**                                   | **del bien al mal**                                                  |
| Wissenskategorie       | **0 % de conocimiento consolidado no significa un 0 % de respuestas correctas.** | 0 % correctas no significa 0 % correctas                             |
| KI-Herkunft und Status | **Sugerencia de IA** neben **Confirmado**                                        | Borrador als unveränderliche Herkunft                                |
| Gemeinsame Bestätigung | **Continuar de todos modos** bei Diskussion und Ergebnissen                      | Mostrar resultados in einem Dialog, der auch Diskussion starten kann |

## Fachliche und technische Grenzen

Vor dem Formulieren die tatsächliche Folge prüfen: Auslöser → laufender Vorgang
→ Erfolg → Fehler/Timeout → Wiederholung oder Abbruch. **Guardando…** ist keine
Erfolgsmeldung. Bei Konflikten unterscheiden, ob die aktuelle Fassung bereits
geladen wurde oder ein Neuladen noch nötig ist. Behaltene Eingaben und bereits
erzeugte Lernzielentwürfe korrekt benennen.

- Die zweite abgegebene Antwort ersetzt die erste. Keine Formulierung, nach der
  die erste Stimme auch ohne Ersatzabgabe entfällt. Antwortsicherheit ändert
  keine Punkte.
- Die Pause einer Wortwolke betrifft die Anzeige; neue Beiträge werden weiterhin
  gesammelt. Veröffentlichen, Anheften, Archivieren, Löschen und Schwärzen sind
  getrennte Aktionen.
- Zustimmung ist keine fachliche Richtigkeit. Eine falsche Antwort mit hoher
  Sicherheit ist ein Hinweis auf eine **posible concepción errónea**, keine
  gesicherte Diagnose oder ein Beweis für Lernerfolg.
- Pseudonyme sind keine vollständige Anonymisierung. Optionale Identitätsbindung
  von Bonuscodes, Zugriff und Aufbewahrung auseinanderhalten.
- Rechtstexte sprachlich verbessern, ohne Fristen, Anbieter, URLs, Rechtsbezüge
  oder Zusagen zu verändern. Für Datenschutzbegriffe gilt **tratamiento**;
  Informationswebsite und Live-App beschreiben getrennte Hostingkontexte.

## Quellen und Prüfung

Alle Quellen berücksichtigen: `messages.es.xlf`, lokale TypeScript-Texte im
Frontend und Backend, Demo-Generator und erzeugtes JSON, Berichts-Overrides,
beide Demo-PDFs, App-Rechts-Markdown, Landing-Dictionary und Landing-Rechtsseiten,
PWA-Manifest-Patcher sowie zitierte Kontrollnamen in der Hilfe.

Spanische Berichtslabels stehen zusätzlich in `ES_LABEL_OVERRIDES` in
`libs/session-export-report/src/labels-i18n.generated.ts`. Der Regressionstest
vergleicht alle 317 effektiven Labels mit den tatsächlichen App-Bindings. Das
Sync-Skript bewahrt bestehende kuratierte Overrides; ein XLF-Edit überschreibt
sie deshalb nicht automatisch.

Nur Zieltexte ändern. Quelltexte, IDs, Kontext, Inline-XML, ICU-Struktur,
nummerierte Berichtsplätze und technische Enum-Werte erhalten. Keine
Nutzerinhalte übersetzen; das feste Demo ist eine bewusste Ausnahme. Im Demo
Lösungen, IDs, Typen, Zahlen und akzeptierte Kurzantwortvarianten bewahren.

Katalogprüfung, relevante Tests und lokalisierten Build ausführen. Auf 320 px,
in Hell/Dunkel und mit vollständigen zugänglichen Namen prüfen. Landing-Links,
Metadaten, Canonicals und Sitemap mitprüfen. Beide Demo-PDFs regenerieren, alle
Seiten rendern und PDF/UA validieren. Automatische Katalog- und axe-Prüfungen
beweisen weder idiomatische Sprache noch einen vollständigen WCAG-Audit.
