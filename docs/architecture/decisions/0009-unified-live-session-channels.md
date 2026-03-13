# ADR-0009: Einheitliche Live-Session mit Tabs für Quiz, Q&A und Blitz-Feedback

**Status:** Accepted  
**Datum:** 2026-03-13  
**Entscheider:** Projektteam  

## Kontext

arsnova.eu soll dem Produktversprechen "live in einer app" entsprechen. In einer realen Lehrveranstaltung wechseln Dozierende jedoch zwischen mehreren Live-Formaten:

- gesteuertes **Quiz** mit Fragen, Voting und Auswertung
- schriftlich eingereichten **Q&A-Fragen**, die der Dozent mündlich im Raum beantwortet
- kurzem **Blitz-Feedback** für spontane Stimmungs- oder Verständnisabfragen

Der aktuelle Stand der Architektur ist dafür zu fragmentiert:

- `Session.type` modelliert Live-Sessions exklusiv als `QUIZ` oder `Q_AND_A`
- `Q&A` ist als eigener Session-Typ gedacht und trennt damit Quiz und Fragerunde künstlich
- `QuickFeedback` läuft heute mit eigenem Code und separaten Routen (`/feedback/:code`, `/feedback/:code/vote`)
- Teilnehmende und Dozierende müssten für eine Lehrveranstaltung potenziell mehrere Codes, Einstiege oder UIs verstehen

Für den fachlichen Einsatz im Hörsaal oder Klassenzimmer ist das unpassend. Dort gibt es aus Sicht der Nutzer:innen typischerweise **eine laufende Veranstaltung**, in der mehrere Live-Werkzeuge parallel oder abwechselnd genutzt werden.

## Entscheidung

### 1. Eine Live-Session pro Veranstaltung

Es gibt pro Veranstaltung **genau eine Live-Session mit genau einem Session-Code**.

- Der Session-Code ist der gemeinsame Eintrittspunkt für Dozierende und Teilnehmende.
- Eine Session ist der fachliche Container für alle Live-Aktivitäten der Veranstaltung.
- Teilnehmende treten **einmal** bei und bleiben dieselbe Person für Quiz, Q&A und Blitz-Feedback.

### 2. Drei Live-Kanäle innerhalb derselben Session

Die Live-Session enthält drei fachliche Kanäle:

- **Quiz**
- **Q&A**
- **Blitz-Feedback**

Diese Kanäle werden **nicht** als getrennte Session-Typen modelliert, sondern als Features innerhalb derselben Session.

Konsequenz für das Datenmodell:

- Die exklusive Modellierung `Session.type = QUIZ | Q_AND_A` ist langfristig nicht ausreichend.
- Q&A und Blitz-Feedback werden als **optionale Session-Funktionen / Kanäle** modelliert.
- Falls `Session.type` aus Kompatibilitätsgründen vorübergehend bestehen bleibt, ist `Q_AND_A` als Übergangsmodell zu betrachten und perspektivisch zugunsten eines kanalbasierten Session-Modells zurückzubauen.

### 3. Gemeinsame Session-Shell im Frontend

Die Session-Routen bleiben der zentrale Einstieg:

- Dozent: `/session/:code/host`
- Teilnehmende: `/session/:code/vote`

Innerhalb dieser Session-Shell werden Tabs oder eine gleichwertige mobile Navigation angeboten.

Für Teilnehmende:

- `Quiz`
- `Fragen`
- `Blitz-Feedback`

Für Dozierende:

- `Quiz`
- `Fragen`
- `Blitz-Feedback`

Die Session bleibt damit **eine Oberfläche mit mehreren Werkzeugen**, nicht mehrere getrennte Apps.

### 4. Q&A ist schriftliche Einreichung, mündliche Antwort im Raum

Q&A bedeutet in arsnova.eu:

- Studierende reichen Fragen **schriftlich in der App** ein.
- Der Dozent sieht eingegangene Fragen im Q&A-Tab.
- Der Dozent wählt Fragen aus, pinnt oder archiviert sie.
- Die eigentliche Antwort erfolgt **mündlich in Präsenz** im Hörsaal oder Klassenzimmer.

Q&A ist damit **kein In-App-Chat** und **kein Thread-System für textliche Antworten**.

### 5. Sichtbarkeit und Hinweise für neue Eingänge

Damit die parallelen Kanäle im Live-Betrieb funktionieren, müssen neue Eingänge sichtbar sein:

- Im Dozenten-Tab `Fragen` wird angezeigt, ob neue Fragen eingetroffen sind.
- Im Dozenten-Tab `Blitz-Feedback` wird angezeigt, ob neue Rückmeldungen oder laufende Feedback-Runden vorliegen.
- Tabs dürfen Badges, Zähler oder vergleichbare Hinweise tragen.

Diese Hinweise müssen mobil gut erkennbar, aber visuell zurückhaltend sein.

### 6. Getrennte Fachlogik je Kanal

Die Kanäle teilen sich Session-Code, Teilnehmer und Shell, aber nicht dieselbe Fachlogik:

- **Quiz** bleibt statusgetrieben (`LOBBY`, `QUESTION_OPEN`, `ACTIVE`, `RESULTS`, `FINISHED` usw.)
- **Q&A** hat eigene Inhalte und eigene Moderationszustände
- **Blitz-Feedback** hat eigene kurze Lebenszyklen, Fragetypen und Ergebniszustände

Insbesondere gilt:

- Der Quiz-Status steuert **nicht automatisch** Q&A oder Blitz-Feedback.
- Q&A und Blitz-Feedback dürfen während einer laufenden Quiz-Session parallel verfügbar sein.
- Erst das fachliche Ende der Session schließt alle Live-Kanäle oder setzt sie in einen read-only Zustand.

### 7. Bestehendes Blitz-Feedback wird integriert, nicht parallel weiter isoliert

Das bestehende `quickFeedback`-Feature wird fachlich als **Blitz-Feedback-Kanal derselben Session** betrachtet.

Das bedeutet für die Zielarchitektur:

- kein separates mentales Modell "Feedback hat einen anderen Code"
- keine dauerhaft getrennte Hauptnavigation für Feedback neben Session/Quiz
- bestehende Redis-basierte Logik kann weiterverwendet werden, wird aber an das Session-Modell angebunden

### 8. DTO- und API-Konsequenz

Für Backend und Shared Types gilt:

- `SessionInfoDTO` beschreibt künftig nicht nur Quiz-Metadaten, sondern die verfügbaren Session-Kanäle und ihre Konfiguration
- Join- und Host-/Vote-Flows arbeiten mit **einem gemeinsamen Session-DTO**
- Kanal-spezifische Daten bleiben in eigenen DTOs (`QuestionStudentDTO`, `QaQuestionDTO`, Blitz-Feedback-DTOs), werden aber unter derselben Session referenziert

## Konsequenzen

### Positiv

- Die Produktidee wird klarer: **eine Veranstaltung, ein Code, eine App**
- Teilnehmende müssen nur einmal beitreten und können danach zwischen Live-Werkzeugen wechseln
- Dozierende behalten alle Live-Formate in einer Oberfläche im Blick
- Q&A entspricht dem realen Lehrszenario besser: schriftliche Sammlung, mündliche Beantwortung
- Blitz-Feedback wird vom Sonderfall zu einem integrierten Werkzeug der Session
- Das UI passt besser zum Slogan und zur Mobile-First-Nutzung

### Negativ / Risiken

- Die aktuelle Architektur mit exklusivem `Session.type` muss umgebaut oder schrittweise migriert werden
- Session-Shell, DTOs, Join-Flow und Host-/Vote-Views werden komplexer
- Tab-Navigation auf kleinen Screens muss sehr sorgfältig gestaltet werden, damit sie nicht überladen wirkt
- Neue Eingänge in Q&A und Blitz-Feedback brauchen robuste Badge-/Unread-Logik, sonst gehen Signale im Live-Betrieb unter
- Bestehende `quickFeedback`-Routen und der bisherige Q&A-Ansatz erzeugen Migrationsaufwand

## Alternativen (geprüft)

- **Getrennte Modi mit eigenem Code pro Feature:** Verworfen, weil das dem Ziel "live in einer app" widerspricht und im Unterricht unnötig kompliziert ist.
- **Nur Quiz + optional Q&A, aber kein Blitz-Feedback in derselben Session:** Verworfen, weil Blitz-Feedback fachlich ebenfalls ein Live-Kanal derselben Veranstaltung ist und sonst erneut als Sonderfall außerhalb der Session landet.
- **Drei unabhängige Apps / Routenfamilien (`quiz`, `q&a`, `feedback`) mit Wechsel über Links:** Verworfen, weil Join, Host und mentale Modelle fragmentiert würden.
- **Q&A als In-App-Chat mit textlichen Antworten:** Verworfen, weil der fachliche Einsatzfall die mündliche Beantwortung in Präsenz ist.
- **Quiz-Status steuert automatisch die Sichtbarkeit aller anderen Kanäle:** Verworfen, weil Q&A und Blitz-Feedback parallel zum Quiz nutzbar bleiben sollen und andere Lebenszyklen haben.

## Umsetzungsstand

Stand 2026-03-13:

- Die Session-Shell fuer Host, Teilnehmer und Presenter zeigt die Kanaele `Quiz`, `Fragen` und `Blitz-Feedback` unter einem gemeinsamen Session-Code.
- Der Startdialog auf `/quiz` startet Veranstaltungen kanalbasiert und ersetzt die fruehere getrennte Denkweise fuer Quiz/Q&A/Feedback.
- Q&A ist inklusive Einreichen, Upvoting, Moderation, Badge-/Highlight-Logik und Presenter-Warteschlange umgesetzt.
- Blitz-Feedback ist in dieselbe Session integriert und nutzt denselben Session-Code fuer Host- und Teilnehmerfluss.
- Der End-to-End-Smoke-Test `apps/frontend/scripts/check-unified-session-flow.mjs` verifiziert den Unified-Flow fuer Host, Teilnehmer und Presenter und faellt bei lokalem Session-Rate-Limit automatisch auf bestehende passende Sessions zurueck.
