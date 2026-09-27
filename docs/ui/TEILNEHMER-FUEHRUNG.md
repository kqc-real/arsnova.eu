# Teilnehmerführung nach Aufgabe und Zustand

Verbindliche Produktquelle: [Issue #472](https://github.com/kqc-real/arsnova.eu/issues/472).
Die Host-Führung steht in [HOST-FUEHRUNG.md](HOST-FUEHRUNG.md).

## Einstieg und Identität

Die Teilnehmerkarte steht vor Fallwahl und Host-Karten, auch in DOM- und
Tastaturreihenfolge. Code, letzte Codes und QR-/Deep-Link verwenden die bestehenden
Join-Routen. Anonymer Beitritt ohne manuelle Teamwahl bleibt automatisch.
Namensliste, Reserve-Namen, Kollisionen, Rejoin und serverseitige Idempotenz behalten
ihre Regeln. Manuelle Teams sind direkt sichtbar und verpflichtend. Automatische
Teams werden beim Beitritt zugeteilt; ihre Übersicht liegt unter **Teams ansehen**.

## Wechselregel

Nur serverbestätigt aktivierte Formate sind wählbar. Geschlossen ist nicht dasselbe
wie deaktiviert. Bei einem Format entfällt die Tab-Leiste. Jeder Tab benennt neben
dem Format die aktuelle Aufgabe; derselbe Status steht auch im Hauptinhalt.

1. Beim Einstieg gilt ein einmaliger gültiger `?tab=`-Link, ansonsten der gültige
   serverseitige `preferredChannel`. Ein ungültiger Link wird verbraucht. Ohne
   Empfehlung dient die erste handlungsfähige Ansicht als Rückfall.
2. Die eigene Tabwahl ändert nur die Ansicht. Neue Quizfragen oder Blitzlichtrunden
   dürfen eine neue Aufgabe anzeigen, wenn die bisherige Aufgabe nicht begonnen ist.
3. Ein Q&A-Entwurf, eine ungesendete Quizantwort (auch unvollständige strukturierte
   Eingaben, bearbeitete Reihenfolge, Zahl oder Selbsteinschätzung) sowie laufende
   Abgaben verhindern automatische Wechsel. Hydrierte Standardreihenfolgen allein
   gelten nicht als Eingabe.
4. Eine neue Host-Empfehlung wartet bis zum erfolgreichen Abschluss oder Verwerfen
   der Aufgabe. Sie hat Vorrang vor einer wartenden Rundenumschaltung. Fehler lassen
   Entwurf und Ansicht bestehen. Eine weitere eigene Wahl ersetzt wartende Wechsel.
5. Ein serverseitig deaktiviertes Format wird verlassen. Beim automatischen
   Austausch fokussierter Inhalte erhält der sichtbare Aufgabenstatus den Fokus.
   Ein nur geschlossenes Format bleibt anwählbar. Fristablauf sendet keine Stimme.

Entwürfe bleiben während der Lebensdauer der Vote-Ansicht erhalten; es wird keine
zusätzliche Entwurfspersistenz für einen vollständigen Browser-Reload eingeführt.
Reload/Reconnect verwenden die bestehenden serverseitigen Teilnahme- und
Antwortdaten. Host-Fallpräferenzen gelangen nicht in Teilnehmer-Datenverträge.

## Zustandsmatrix

| Situation                         | Hauptinhalt und Aktion                         | Schutz und ergänzende Anzeige                                                |
| --------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| Startseite                        | Code und **Los geht’s**                        | Letzte Codes sind eine Rückkehrhilfe; Host-Einstieg folgt danach             |
| Anonym, ohne manuelles Team       | Automatischer Beitritt                         | Keine zusätzliche Pflichtfrage                                               |
| Name erforderlich                 | Vorgesehene Namenswahl, **Jetzt beitreten**    | Vergebene Namen gesperrt; Fehler und Retry im Formular                       |
| Manuelles Team                    | Offene Teamkarten                              | Auswahl erforderlich; Fehler bewahrt Name und Team                           |
| Automatische Teams                | Zuteilungshinweis                              | **Teams ansehen** zunächst eingeklappt                                       |
| Quiz `LOBBY` / `PAUSED`           | Warten / Quiz pausiert                         | Persönliche Zeit nach bestehenden Regeln erreichbar                          |
| Quiz `QUESTION_OPEN`              | Lesen und Bereitschaft                         | Keine Antwortoptionen oder Lösungen vor Freigabe                             |
| Quiz `ACTIVE`                     | Antwort offen, **Antwort senden**              | Alle Antworttypen und Selbsteinschätzung; kein automatischer Submit          |
| Antwort gesendet / Timeout        | Antwort gesendet / Frist abgelaufen            | Keine zweite reguläre Stimme; Freigabe des Ergebnisses bleibt serverseitig   |
| `DISCUSSION` / `RESULTS`          | Warten / Ergebnis                              | Zweite Runde behält die bestehende Wertung                                   |
| Q&A offen                         | Editor, **Frage senden**, Fragenliste          | Erlaubte Bewertungen unmittelbar an der Frage                                |
| Q&A leer / `PENDING`              | Leerhinweis / eigene Frage wartet auf Freigabe | Vorabmoderation bleibt sichtbar erklärt                                      |
| Q&A geschlossen / abgelaufen      | Grund und Status                               | Vorhandener Entwurf bleibt lesbar, nicht absendbar                           |
| Suche / andere Sortierung         | **Fragen finden & sortieren**                  | Kriterien und **Zurücksetzen** auch außerhalb des geschlossenen Bereichs     |
| Blitzlicht                        | Abstimmen / Pausiert / Schon abgestimmt        | Tempo bleibt änderbar und abwählbar; Vergleichsrunde erlaubt erneute Stimme  |
| Mehrere Formate                   | Aufgabenstatus in jedem Tab                    | Begonnene Aufgabe und Fokus werden nicht durch einen anderen Kanal verdrängt |
| Quiz `FINISHED`, Nebenkanal offen | Quizabschluss, erreichbare Nebenkanäle         | Kein vorzeitiges globales End-Gate                                           |
| Session endgültig beendet         | Bonuscode, **Zur Startseite**                  | Freiwillige Session- und Produktbewertung, keine neue Teilnahme              |

## Q&A-Werkzeuge und Fokus

**Fragen finden & sortieren** ist ein natives `details/summary` und zunächst
geschlossen. Suche, vier Sortierungen und ihre Erläuterung bleiben erhalten.
`TOP` bleibt Standard; Reihenfolgen und Pagination kommen unverändert vom Server.
Einklappen verwirft keine Kriterien. Reset setzt Suche, Sortierung und Autorenfilter
zurück und fokussiert vorher den weiterhin sichtbaren Werkzeugauslöser.

Bei Fristablauf oder Host-Schluss bleibt ein vorhandener Entwurf schreibgeschützt
mit zugeordnetem Frist-/Schlusshinweis. Während Submit ist der Editor ebenfalls
schreibgeschützt; Fehler erhalten den Text und denselben Idempotenzschlüssel für
Retry. Der Tempo-Shortcut öffnet ausschließlich ein offenes Q&A und fokussiert
den sichtbaren Editor. Die feste Sendeaktion nutzt den bestehenden unteren
Scrollabstand der Vote-Seite.

## Prüfpfade

Die Komponenten-Specs für Home, Join, Session-Vote und Feedback-Vote sichern die
lokalen Zustände ab. Die Browserflows `check-unified-session-flow.mjs`,
`check-epic-405-participant-qa-flow.mjs` und
`check-webkit-participant-vote-flow.mjs` prüfen zusätzlich echte Teilnahme,
Entwurfsschutz bei Host-Wechsel/neuer Frage und Q&A-Disclosure mit Reset-Fokus.
Die Kurztext- und Strukturantwort-Smokes (`check-short-text-flow.mjs` und
`check-structured-question-types-flow.mjs`) verwenden die neue Sendeaktion
**Antwort senden** und prüfen weiterhin die tatsächliche Abgabe/Auswertung.
Konkrete ausgeführte Prüfungen und visuelle Nachweise gehören in den Pull Request.

## Visuelle Abnahme zu #472

Die Bildnachweise verwenden ausschließlich lokale Testdaten. Mobile Aufnahmen:
320 × 800 CSS-Pixel; Desktop: 1280 × 900. Beide Presets wurden in Hell und Dunkel
geprüft, alle fünf Locales auf horizontalen Überlauf und abgeschnittene Tab-Status
bei 320 CSS-Pixel. Das ist das Reflow-Äquivalent von 1280 Pixel bei 400 % Zoom;
ein separater Browser-Zoom mit Sprachausgabe ist damit nicht nachgewiesen.

| Ansicht                             | Seriös mobil                                                                 | Seriös Desktop                                                                | Spielerisch mobil                                                                | Spielerisch Desktop                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Automatische Teams                  | [Bild](../screenshots/participant-472/de-serioes-light-join-mobile.png)      | [Bild](../screenshots/participant-472/de-serioes-light-join-desktop.png)      | [Bild](../screenshots/participant-472/de-spielerisch-light-join-mobile.png)      | [Bild](../screenshots/participant-472/de-spielerisch-light-join-desktop.png)      |
| Q&A ohne Suche, drei Tabs           | [Bild](../screenshots/participant-472/de-serioes-light-qa-mobile.png)        | [Bild](../screenshots/participant-472/de-serioes-light-qa-desktop.png)        | [Bild](../screenshots/participant-472/de-spielerisch-light-qa-mobile.png)        | [Bild](../screenshots/participant-472/de-spielerisch-light-qa-desktop.png)        |
| Q&A mit eingeklappter aktiver Suche | [Bild](../screenshots/participant-472/de-serioes-light-qa-search-mobile.png) | [Bild](../screenshots/participant-472/de-serioes-light-qa-search-desktop.png) | [Bild](../screenshots/participant-472/de-spielerisch-light-qa-search-mobile.png) | [Bild](../screenshots/participant-472/de-spielerisch-light-qa-search-desktop.png) |
| Laufende Quizfrage                  | [Bild](../screenshots/participant-472/de-serioes-light-quiz-mobile.png)      | [Bild](../screenshots/participant-472/de-serioes-light-quiz-desktop.png)      | [Bild](../screenshots/participant-472/de-spielerisch-light-quiz-mobile.png)      | [Bild](../screenshots/participant-472/de-spielerisch-light-quiz-desktop.png)      |
| Session-Blitzlicht                  | [Bild](../screenshots/participant-472/de-serioes-light-feedback-mobile.png)  | [Bild](../screenshots/participant-472/de-serioes-light-feedback-desktop.png)  | [Bild](../screenshots/participant-472/de-spielerisch-light-feedback-mobile.png)  | [Bild](../screenshots/participant-472/de-spielerisch-light-feedback-desktop.png)  |
| Abschluss                           | [Bild](../screenshots/participant-472/de-serioes-light-end-mobile.png)       | [Bild](../screenshots/participant-472/de-serioes-light-end-desktop.png)       | [Bild](../screenshots/participant-472/de-spielerisch-light-end-mobile.png)       | [Bild](../screenshots/participant-472/de-spielerisch-light-end-desktop.png)       |

Dunkle Ansichten der Fragenwand: [seriös mobil](../screenshots/participant-472/de-serioes-dark-qa-mobile.png),
[seriös Desktop](../screenshots/participant-472/de-serioes-dark-qa-desktop.png),
[spielerisch mobil](../screenshots/participant-472/de-spielerisch-dark-qa-mobile.png),
[spielerisch Desktop](../screenshots/participant-472/de-spielerisch-dark-qa-desktop.png).

Die ergänzten Browserflows prüfen Tastatur-Disclosure, Reset-Fokus,
Entwurfsschutz, spätere Übernahme einer Host-Empfehlung und den sichtbaren,
unverdeckten Statusfokus nach Submit. Die Komponenten-Tests prüfen außerdem
Ablehnung/Retry mit erhaltenem Idempotenzschlüssel, Fristablauf mit lesbarem
Entwurf, alle Quiz-Eingabeformen und das offene Blitzlicht nach Quizende.
Axe-Prüfungen sind automatisierte Teilnachweise; als unvollständig gemeldete
Kontrast-/ARIA-Regeln werden nicht als vollständiges Screenreader-Audit gewertet.
