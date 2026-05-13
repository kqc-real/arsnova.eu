# Screenshot-Übersicht

Dieser Ordner enthält kuratierte Screenshots zu Wortwolken, Stopwörtern und zum Zielbild der semantischen Begriffwolke für Kurs 3. Die Sammlung soll nicht nur den aktuellen Stand dokumentieren, sondern auch die Leselogik hinter den Bildern erklären.

## Produktstand (Mai 2026)

- Die aktuelle Freitext-Wortwolke nutzt in Host und Presenter ein echtes `d3-cloud`-Layout mit gruppierten Wortfamilien (`Word Cloud 2.1/2.2`).
- Die Q&A-Wortwolke nutzt dieselbe Basis, aber mit eigenem Q&A-Profil: abgeflachte Upvote-Gewichtung, zusaetzliche Frage-Fuelltokens und leichte Themenphrasen wie `kapitel 4` oder `lineare regression`.
- Die Presenter-Ansichten fuer Freitext und Q&A zeigen die Wortwolke oeffentlich als reine Buehnenansicht ohne Export-, Antwort- oder Maximieren-UI.
- Stopwörter werden im Produkt standardmäßig ausgeblendet. Die Dateien mit `Eingeblendet` sind deshalb Vergleichs- und Erklärbilder, kein aktueller Laufzeit-Umschalter in der UI.
- Der PNG-Export der Wortwolke ist bewusst ein geordneter Zeilenexport nach Wortgröße; die Live-Ansicht bleibt die freie Bühnenwolke.

## Ziel und Leselogik

- Die Dateien mit Stopwörtern zeigen den aktuellen Produktstand der lexikalisch verdichteten Wortwolke. Sie eignen sich als Ausgangspunkt für die Frage: Welche fachlich relevanten Begriffe bleiben sichtbar, wenn häufige Füll- und Funktionswörter ausgeblendet werden?
- Die Dateien mit Eingeblendet zeigen denselben Inhalt als bewussten Vergleich ohne diese Reduktion. Sie helfen dabei zu verstehen, warum der frühere Stopwort-Umschalter aus der Produkt-UI entfernt wurde.
- Die Dateien mit Zielbild zeigen den konzeptionellen Soll-Zustand für Kurs 3: semantische Cluster statt einzelner Tokens. Sie beantworten die weiterführende Frage, wie aus einzelnen Wörtern didaktisch brauchbare Themenräume werden können.

## Didaktische Lesereihenfolge

- Schritt 1: Zuerst die lexikalische Wortwolke ohne Stopwörter betrachten. So wird sichtbar, welche Begriffe das Material im Kern prägen.
- Schritt 2: Danach die Vergleichsvariante mit eingeblendeten Stopwörtern ansehen. Der Kontrast macht deutlich, wie stark sprachliches Rauschen die Lesbarkeit beeinflusst.
- Schritt 3: Anschließend das semantische Zielbild heranziehen. Erst an dieser Stelle wird die Diskussion von einzelnen Begriffen auf Themen, Bedeutungen und Zusammenhänge erweitert.

## Screenshots im Überblick

| Datei                                                                                                            | Typ             | Inhalt                                                              | Aussage                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [QA-Word-Cloud-Stopwoerter.png](./QA-Word-Cloud-Stopwoerter.png)                                                 | Ist-Zustand     | Q&A-Wortwolke mit ausgeblendeten Stopwörtern                        | Eignet sich als Einstiegsbild, um zu zeigen, welche fachlich relevanten Begriffe bei denselben Statistikfragen übrig bleiben.                            |
| [QA-Word-Cloud-Stopwoerter-Eingeblendet.png](./QA-Word-Cloud-Stopwoerter-Eingeblendet.png)                       | Vergleich       | Historisches Q&A-Vergleichsbild mit eingeblendeten Stopwörtern      | Dient nur noch als Referenzbild aus der Evaluationsphase; kein aktueller UI-Toggle und nicht mehr Teil des Screenshot-Scripts.                           |
| [QA-Word-Cloud-Presenter-Kontext.png](./QA-Word-Cloud-Presenter-Kontext.png)                                     | Kontextansicht  | Q&A-Wortwolke in der Presenter-Ansicht                              | Zeigt die oeffentliche Buehnenansicht ohne Bedien-UI, mit abgeflachter Upvote-Wirkung und leichter Phrasenverdichtung fuer Publikumsfragen.              |
| [QA-Word-Cloud-Host-Kontext.png](./QA-Word-Cloud-Host-Kontext.png)                                               | Kontextansicht  | Q&A-Wortwolke in der Host-Ansicht                                   | Zeigt, wie Hosts die gewichtete Q&A-Wortwolke mit Antwortliste, Exporten und Moderationskontext als Analysewerkzeug nutzen koennen.                      |
| [Quiz-Freitext-Word-Cloud-Stopwoerter.png](./Quiz-Freitext-Word-Cloud-Stopwoerter.png)                           | Ist-Zustand     | Quiz-Freitext-Wortwolke mit ausgeblendeten Stopwörtern              | Eignet sich als Einstiegsbild, um die lexikalische Verdichtung freier Rückmeldungen auf zentrale Fachbegriffe zu erklären.                               |
| [Quiz-Freitext-Word-Cloud-Stopwoerter-Eingeblendet.png](./Quiz-Freitext-Word-Cloud-Stopwoerter-Eingeblendet.png) | Vergleich       | Historisches Freitext-Vergleichsbild mit eingeblendeten Stopwörtern | Dient nur noch als Referenzbild aus der Evaluationsphase; kein aktueller UI-Toggle und nicht mehr Teil des Screenshot-Scripts.                           |
| [Quiz-Freitext-Word-Cloud-Presenter-Kontext.png](./Quiz-Freitext-Word-Cloud-Presenter-Kontext.png)               | Kontextansicht  | Freitext-Wortwolke in der Presenter-Ansicht                         | Zeigt, wie die live verdichtete Freitext-Wortwolke im laufenden Unterrichtskontext genutzt werden kann und nicht nur als isolierte Karte funktioniert.   |
| [Quiz-Freitext-Word-Cloud-Host-Kontext.png](./Quiz-Freitext-Word-Cloud-Host-Kontext.png)                         | Kontextansicht  | Freitext-Wortwolke in der Host-Ansicht                              | Zeigt die Wortwolke im Steuerkontext der laufenden Freitextfrage inklusive Zusammenfassung und Öffner für die Moderation.                                |
| [QA-Semantische-Begriffwolke-Zielbild.png](./QA-Semantische-Begriffwolke-Zielbild.png)                           | Zielbild Kurs 3 | Semantische Begriffwolke für Q&A                                    | Eignet sich als Zielbild, um den Übergang von einzelnen Wörtern zu Themenclustern wie Deskriptive Statistik, Zusammenhänge und Modellierung zu erklären. |
| [Quiz-Freitext-Semantische-Begriffwolke-Zielbild.png](./Quiz-Freitext-Semantische-Begriffwolke-Zielbild.png)     | Zielbild Kurs 3 | Semantische Begriffwolke für Quiz-Freitext                          | Eignet sich als Zielbild, um freie Rückmeldungen in didaktisch lesbare Bedeutungsräume mit Themenlabels und Clusterkarten zu überführen.                 |

## Empfohlene Verwendung

- Für Produktdiskussionen: zuerst den Ist-Zustand ohne Stopwörter zeigen, dann den Vergleich mit eingeblendeten Stopwörtern als Referenzbild und anschließend das semantische Zielbild.
- Für Lehrveranstaltungen oder Kurs 3: die Bilder nacheinander als kleine Lernstrecke einsetzen, vom sichtbaren Begriff über den Filtereffekt bis hin zur semantischen Bündelung.
- Für Architektur- oder NLP-Gespräche: die Zielbilder immer als Konzeptbilder kennzeichnen, nicht als bereits implementierte Produktoberflächen.

## Herkunft der Dateien

- Die aktuellen lexikalischen Wortwolken und die Host-/Presenter-Kontextbilder werden über [../../apps/frontend/scripts/capture-doc-word-cloud-screenshots.mjs](../../apps/frontend/scripts/capture-doc-word-cloud-screenshots.mjs) erzeugt.
- Die historischen Vergleichsbilder mit `Eingeblendet` bleiben als Referenz im Ordner, werden aber nicht mehr automatisch neu erzeugt.
- Die beiden semantischen Zielbilder werden über [../../apps/frontend/scripts/capture-doc-semantic-cloud-target-screenshots.mjs](../../apps/frontend/scripts/capture-doc-semantic-cloud-target-screenshots.mjs) gerendert.

## Begriffsabgrenzung

- Lexikalische Wortwolke: gleiche oder ähnliche Tokens werden gezählt und gewichtet. Sie zeigt also vor allem Wörter, nicht automatisch Bedeutungen.
- Stopwort-Filter: häufige, wenig aussagekräftige Wörter werden im Produkt standardmäßig ausgeblendet. Die Vergleichsbilder mit eingeblendeten Stopwörtern dienen nur noch der Erklärung und Bewertung.
- Semantische Begriffwolke: ähnliche Aussagen, Varianten und Paraphrasen werden zu Themenclustern zusammengeführt und mit sprechenden Labels versehen. Sie ist deshalb näher an einer inhaltlichen Interpretation als an einer reinen Worthäufigkeit.
