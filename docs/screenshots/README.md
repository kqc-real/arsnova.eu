# Screenshot-Übersicht

Dieser Ordner enthält kuratierte Screenshots zu Wortwolken, Stopwörtern und zum Zielbild der semantischen Begriffwolke für Kurs 3. Die Sammlung soll nicht nur den aktuellen Stand dokumentieren, sondern auch die Leselogik hinter den Bildern erklären.

## Ziel und Leselogik

- Die Dateien mit Stopwörtern zeigen den aktuellen lexikalischen Stand. Sie eignen sich als Ausgangspunkt für die Frage: Welche fachlich relevanten Begriffe bleiben sichtbar, wenn häufige Füll- und Funktionswörter ausgeblendet werden?
- Die Dateien mit Eingeblendet zeigen denselben Inhalt ohne diese Reduktion. Sie helfen dabei zu verstehen, warum ein Stopwort-Filter die Lesbarkeit verbessert.
- Die Dateien mit Zielbild zeigen den konzeptionellen Soll-Zustand für Kurs 3: semantische Cluster statt einzelner Tokens. Sie beantworten die weiterführende Frage, wie aus einzelnen Wörtern didaktisch brauchbare Themenräume werden können.

## Didaktische Lesereihenfolge

- Schritt 1: Zuerst die lexikalische Wortwolke ohne Stopwörter betrachten. So wird sichtbar, welche Begriffe das Material im Kern prägen.
- Schritt 2: Danach die Variante mit eingeblendeten Stopwörtern ansehen. Der Kontrast macht deutlich, wie stark sprachliches Rauschen die Lesbarkeit beeinflusst.
- Schritt 3: Anschließend das semantische Zielbild heranziehen. Erst an dieser Stelle wird die Diskussion von einzelnen Begriffen auf Themen, Bedeutungen und Zusammenhänge erweitert.

## Screenshots im Überblick

| Datei                                                                                                            | Typ             | Inhalt                                                 | Aussage                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [QA-Word-Cloud-Stopwoerter.png](./QA-Word-Cloud-Stopwoerter.png)                                                 | Ist-Zustand     | Q&A-Wortwolke mit ausgeblendeten Stopwörtern           | Eignet sich als Einstiegsbild, um zu zeigen, welche fachlich relevanten Begriffe bei denselben Statistikfragen übrig bleiben.                            |
| [QA-Word-Cloud-Stopwoerter-Eingeblendet.png](./QA-Word-Cloud-Stopwoerter-Eingeblendet.png)                       | Vergleich       | Q&A-Wortwolke mit eingeblendeten Stopwörtern           | Eignet sich als Kontrastbild, um zu zeigen, welche Fragewörter und Funktionswörter ohne Filter wieder Dominanz gewinnen.                                 |
| [QA-Word-Cloud-Presenter-Kontext.png](./QA-Word-Cloud-Presenter-Kontext.png)                                     | Kontextansicht  | Q&A-Wortwolke in der Presenter-Ansicht                 | Zeigt, wie die verdichtete Darstellung mit Orientierungstext, Gewichtungshinweis und Präsentationsrahmen in einer Lehrsituation lesbar wird.             |
| [QA-Word-Cloud-Host-Kontext.png](./QA-Word-Cloud-Host-Kontext.png)                                               | Kontextansicht  | Q&A-Wortwolke in der Host-Ansicht                      | Zeigt, wie Hosts die gewichtete Wortwolke im laufenden Moderationskontext aufrufen, einordnen und für die weitere Steuerung nutzen können.               |
| [Quiz-Freitext-Word-Cloud-Stopwoerter.png](./Quiz-Freitext-Word-Cloud-Stopwoerter.png)                           | Ist-Zustand     | Quiz-Freitext-Wortwolke mit ausgeblendeten Stopwörtern | Eignet sich als Einstiegsbild, um die lexikalische Verdichtung freier Rückmeldungen auf zentrale Fachbegriffe zu erklären.                               |
| [Quiz-Freitext-Word-Cloud-Stopwoerter-Eingeblendet.png](./Quiz-Freitext-Word-Cloud-Stopwoerter-Eingeblendet.png) | Vergleich       | Quiz-Freitext-Wortwolke mit eingeblendeten Stopwörtern | Eignet sich als Kontrastbild, um den Unterschied zwischen verdichteter Sicht und sprachlichem Rauschen nachvollziehbar zu machen.                        |
| [Quiz-Freitext-Word-Cloud-Presenter-Kontext.png](./Quiz-Freitext-Word-Cloud-Presenter-Kontext.png)               | Kontextansicht  | Freitext-Wortwolke in der Presenter-Ansicht            | Zeigt, wie die live verdichtete Freitext-Wortwolke im laufenden Unterrichtskontext genutzt werden kann und nicht nur als isolierte Karte funktioniert.   |
| [Quiz-Freitext-Word-Cloud-Host-Kontext.png](./Quiz-Freitext-Word-Cloud-Host-Kontext.png)                         | Kontextansicht  | Freitext-Wortwolke in der Host-Ansicht                 | Zeigt die Wortwolke im Steuerkontext der laufenden Freitextfrage inklusive Zusammenfassung und Öffner für die Moderation.                                |
| [QA-Semantische-Begriffwolke-Zielbild.png](./QA-Semantische-Begriffwolke-Zielbild.png)                           | Zielbild Kurs 3 | Semantische Begriffwolke für Q&A                       | Eignet sich als Zielbild, um den Übergang von einzelnen Wörtern zu Themenclustern wie Deskriptive Statistik, Zusammenhänge und Modellierung zu erklären. |
| [Quiz-Freitext-Semantische-Begriffwolke-Zielbild.png](./Quiz-Freitext-Semantische-Begriffwolke-Zielbild.png)     | Zielbild Kurs 3 | Semantische Begriffwolke für Quiz-Freitext             | Eignet sich als Zielbild, um freie Rückmeldungen in didaktisch lesbare Bedeutungsräume mit Themenlabels und Clusterkarten zu überführen.                 |

## Empfohlene Verwendung

- Für Produktdiskussionen: zuerst den Ist-Zustand ohne Stopwörter zeigen, dann den Vergleich mit eingeblendeten Stopwörtern und anschließend das semantische Zielbild.
- Für Lehrveranstaltungen oder Kurs 3: die Bilder nacheinander als kleine Lernstrecke einsetzen, vom sichtbaren Begriff über den Filtereffekt bis hin zur semantischen Bündelung.
- Für Architektur- oder NLP-Gespräche: die Zielbilder immer als Konzeptbilder kennzeichnen, nicht als bereits implementierte Produktoberflächen.

## Herkunft der Dateien

- Die lexikalischen Wortwolken und die neuen Host-/Presenter-Kontextbilder werden über [../../apps/frontend/scripts/capture-doc-word-cloud-screenshots.mjs](../../apps/frontend/scripts/capture-doc-word-cloud-screenshots.mjs) erzeugt.
- Die beiden semantischen Zielbilder werden über [../../apps/frontend/scripts/capture-doc-semantic-cloud-target-screenshots.mjs](../../apps/frontend/scripts/capture-doc-semantic-cloud-target-screenshots.mjs) gerendert.

## Begriffsabgrenzung

- Lexikalische Wortwolke: gleiche oder ähnliche Tokens werden gezählt und gewichtet. Sie zeigt also vor allem Wörter, nicht automatisch Bedeutungen.
- Stopwort-Filter: häufige, wenig aussagekräftige Wörter werden optional ausgeblendet. Dadurch wird die Wolke meist ruhiger und fachlich lesbarer.
- Semantische Begriffwolke: ähnliche Aussagen, Varianten und Paraphrasen werden zu Themenclustern zusammengeführt und mit sprechenden Labels versehen. Sie ist deshalb näher an einer inhaltlichen Interpretation als an einer reinen Worthäufigkeit.
