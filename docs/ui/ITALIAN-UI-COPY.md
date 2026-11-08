# Italienische UI-Texte

Diese Regeln gelten für italienische Texte in App, Demo, Berichten, Hilfe,
Rechtstexten, Landingpage und PWA. Maßgeblich sind die deutschen Quelltexte und
das implementierte Verhalten. Ergänzend gelten [Styleguide](STYLEGUIDE.md),
[i18n-Workflow](../I18N-ANGULAR.md) und
[Berichtsglossar](../features/session-export-pdf-i18n-glossary.md).

## Sprachstandard und Ansprache

- Standarditalienisch mit dem bestehenden Metadatenbezug `it_IT`; keine
  regionalen Redewendungen oder unnötigen Anglizismen.
- In der App **tu** und direkte Verben: **Salva**, **Elimina**, **Modifica**,
  **Pubblica**, **Riprova**. Innerhalb eines Ablaufs nicht zwischen Imperativ,
  Infinitiv und **Si prega di…** wechseln.
- In automatisierten Berichten neutrale Infinitive: **Spiegare**, **Riprendere**,
  **Consolidare**. **Spiega** oder die formelle Anrede **Riveda** nicht in
  ansonsten unpersönliche Empfehlungen mischen.
- Satzgroßschreibung; Akzente erhalten: **è**, **perché**, **Sì**. Apostroph und
  Akzent nicht austauschen. Technische Syntax und akzeptierte Antworten bleiben
  unverändert.
- Kontrollnamen mit **«…»** ohne französische Zwischenräume zitieren und den
  sichtbaren Namen treffen: **«Avvia»**, **«Altro»**, **«Condividi la raccolta»**.
  Dynamische Namen brauchen eigenes i18n-Markup.
- Genus, Numerus und Bezüge prüfen: **risposta corretta/errata**, **sicurezza
  alta/bassa**, **conoscenze consolidate**. Kurze Labels bleiben grammatisch
  korrekt. Geräteunabhängig **Apri** statt ausschließlich **Clicca** verwenden.

## Verbindliche Produktbegriffe

| Bedeutung              | Italienisch                                                                                                            | Vermeiden                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Quiz / Sammlung        | **Quiz** / **Raccolta di quiz**                                                                                        | Wechselnde Sammlungstitel im selben Ablauf                                        |
| Host                   | **chi conduce la sessione**, **vista di conduzione**                                                                   | **ospite**: würde die Gastrolle suggerieren                                       |
| Q&A                    | **Q&A**, erklärend **domande e risposte**                                                                              | Zusätzliche Namen für denselben Kanal                                             |
| Freigeben              | **Pubblica**, **Pubblicata**, **In attesa di verifica**                                                                | Veröffentlichen als fachliche Prüfung darstellen                                  |
| Anheften               | **Metti in evidenza**, **Rimuovi dall’evidenza**, **In evidenza**                                                      | Mit dem temporären Fokus gleichsetzen                                             |
| Temporärer Fokus       | **In primo piano**, **Rimuovi il focus**                                                                               | Anheften und Fokus mit identischen Kontrollnamen bezeichnen                       |
| Stimmensaldo           | **Saldo dei voti**                                                                                                     | Mit Wilson-basierter Zustimmung verwechseln                                       |
| Klare Zustimmung       | **Consenso solido**                                                                                                    | **Consenso netto** neben Saldo dei voti; Domande migliori als Qualitätsurteil     |
| Wortwolke              | **Nuvola di parole**                                                                                                   | Wechsel zwischen nube und nuvola                                                  |
| Wortgruppen / Themen   | **Espressioni** / **Temi**                                                                                             | Ausschließlich vollständige frasi suggerieren                                     |
| Gruppierungssicherheit | **Affidabilità del raggruppamento**                                                                                    | Mit Antwortsicherheit oder Richtigkeit vermischen                                 |
| Blitzlicht             | **Sondaggio rapido**                                                                                                   | Blitzlicht, sondaggio lampo oder sondaggio flash als Alternativnamen              |
| Antwortsicherheit      | **Sicurezza nella risposta**                                                                                           | Unspezifische autovalutazione oder fiducia ohne Antwortbezug                      |
| Moderations-Kompass    | **Bussola di moderazione**, kurz **Bussola**                                                                           | Wörtliche Redewendungen wie dove è la sala                                        |
| Nächster Schritt       | **Prossimo passo**                                                                                                     | Wechselnde Produktlabels wie A seguire oder prossima mossa                        |
| Lernziel               | **Obiettivo di apprendimento**                                                                                         | **destinazione** oder wechselnde obiettivi didattici als Name desselben Objekts   |
| KI-Herkunft            | **Suggerimento dell’IA**                                                                                               | Ein bestätigtes KI-Ziel dauerhaft Bozza IA nennen                                 |
| Lernzielstatus         | **Bozza**, **Confermato**, **Da verificare**                                                                           | Herkunft und Status gleichsetzen                                                  |
| PDF-Dokument           | **Rapporto sui risultati**                                                                                             | piano di debriefing oder piano di revisione als wechselnde Exportnamen            |
| Planabschnitt im PDF   | **Piano per la discussione dei risultati**                                                                             | Mit dem gesamten Dokument gleichsetzen                                            |
| PDF/UA-Auswahl         | **Accessibile (PDF/UA-1)**                                                                                             | Neue oder umfassendere Accessibility-Zusagen                                      |
| Frageformate           | **Risposta singola**, **Risposta multipla**, **Abbinamento**, **Ordinamento**, **Classificazione**, **Stima numerica** | mappatura oder wechselnde Typnamen                                                |
| Lokaler Stil           | **Serio**, **Giocoso**                                                                                                 | Mit Session-Konfigurationsprofilen oder erzwungenen Teilnehmer-Themes verwechseln |
| Session-Code           | **Codice di 6 caratteri**                                                                                              | 6 cifre: Buchstaben sind zulässig                                                 |

## Do’s und Don’ts aus der Prüfung

| Kontext                | Richtig                                                                    | Falsch oder irreführend                                              |
| ---------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Lernzielreferenz       | **L’obiettivo resta visibile.**                                            | **La destinazione rimane visibile.**                                 |
| Rechte Zuordnungsseite | **I termini a destra devono essere univoci.**                              | termini dei diritti                                                  |
| Warten auf Antworten   | **In attesa che i partecipanti inviino gli abbinamenti…**                  | Behaupten, die Teilnehmenden selbst würden zugeordnet                |
| Textfundstelle         | **Una corrispondenza trovata.**                                            | **Trovato un sito.**                                                 |
| Fundstellenliste       | **Occorrenze**                                                             | eventi oder località                                                 |
| Dauerhaftes Schwärzen  | **Oscura passaggi**, **Salvataggio degli oscuramenti…**                    | **L’oscurità è salvata…** oder redazioni als Schwärzungen            |
| Dienstprüfung          | **Verifica in corso…**                                                     | **L’esame è in corso…**                                              |
| Einfache Schwierigkeit | **facile**                                                                 | leggero als Name des Schwierigkeitsgrads                             |
| Antwortwechsel         | **da una risposta corretta a una errata**                                  | Einen moralischen Wechsel der Person beschreiben                     |
| Wissenskategorie       | **0% di conoscenze consolidate non significa lo 0% di risposte corrette.** | 0% solido ohne klaren Bezug                                          |
| Gemeinsame Bestätigung | **Continua comunque** bei Diskussion und Ergebnissen                       | Mostra i risultati in einem Dialog, der auch Diskussion starten kann |

## Fachliche und technische Grenzen

Vor dem Formulieren die tatsächliche Folge prüfen: Auslöser → laufender Vorgang
→ Erfolg → Fehler/Timeout → Wiederholung oder Abbruch. **Salvataggio…** ist kein
abgeschlossener Erfolg. Bei Konflikten unterscheiden, ob die aktuelle Fassung
bereits geladen ist oder erst neu geladen werden muss. Bereits erzeugte
Lernzielentwürfe und abgeschlossene Fragengruppen verschwinden nicht pauschal bei
einem abgebrochenen Generierungslauf.

- Die zweite abgegebene Antwort ersetzt die erste. Nicht behaupten, die erste
  Stimme entfalle auch ohne Ersatzabgabe. Antwortsicherheit beeinflusst keine
  Punkte.
- Die Pause einer Wortwolke betrifft ihre Anzeige; neue Beiträge werden weiterhin
  gesammelt. Veröffentlichung, Hervorhebung, Archivierung, Löschung und
  dauerhafte Schwärzung sind getrennte Aktionen.
- Zustimmung beweist keine fachliche Richtigkeit. Eine falsche Antwort mit hoher
  Sicherheit ist ein Hinweis auf eine **possibile concezione errata**, keine
  gesicherte Diagnose oder ein Beweis für Lernerfolg.
- Herkunft **Suggerimento dell’IA** bleibt nach einer Bestätigung erhalten.
  Bestätigte Ziele können nach Änderungen verknüpfter Fragen **Da verificare**
  werden.
- Pseudonyme sind keine vollständige Anonymisierung. Identitätsbindung von
  Bonuscodes, Zugriff und Aufbewahrung getrennt erklären. Ein legal hold betrifft
  die Löschung und verlängert keine Zugriffsrechte.
- Rechtstexte nicht inhaltlich erweitern. **Titolare del trattamento** und
  **Informativa sulla privacy** verwenden; Fristen, Anbieter, URLs und
  Rechtsbezüge bewahren. Informationswebsite und Live-App behalten ihren
  getrennten Hostingkontext.

## Quellen und Prüfung

Alle Quellen berücksichtigen: `messages.it.xlf`, lokale TypeScript-Texte im
Frontend und Backend, Demo-Generator und erzeugtes JSON, Berichts-Overrides,
beide Demo-PDFs, App-Rechts-Markdown, Landing-Dictionary und Landing-Rechtsseiten,
PWA-Manifest-Patcher sowie zitierte Kontrollnamen in der Hilfe.

Italienische Berichtslabels stehen zusätzlich in `IT_LABEL_OVERRIDES` in
`libs/session-export-report/src/labels-i18n.generated.ts`. Der Regressionstest
vergleicht alle 317 effektiven Labels mit den tatsächlichen App-Bindings. Das
Sync-Skript bewahrt kuratierte Overrides; ein XLF-Edit ersetzt sie nicht
automatisch.

Nur Zieltexte ändern. Quelltexte, IDs, Kontext, Inline-XML, ICU-Struktur,
nummerierte Berichtsplätze und technische Enum-Werte erhalten. Keine
Nutzerinhalte übersetzen; das feste Demo ist eine bewusste Ausnahme. Lösungen,
IDs, Typen, Zahlen und akzeptierte Kurzantwortvarianten bewahren.

Katalogprüfung, relevante Tests und lokalisierten Build ausführen. Textlängen bei
320 px und in Hell/Dunkel prüfen; kurze sichtbare Buttons behalten vollständige
zugängliche Namen. Landing-Links, Metadaten, Canonicals und Sitemap mitprüfen.
Beide Demo-PDFs regenerieren, alle Seiten rendern und PDF/UA validieren.
Automatische Katalog- und axe-Prüfungen ersetzen weder eine Sprachprüfung noch
einen vollständigen WCAG-Audit.
