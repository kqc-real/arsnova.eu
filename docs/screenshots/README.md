# Screenshot-Uebersicht

Dieser Ordner sammelt die kuratierten Screenshots rund um Wortwolken, Stopwoerter und das Zielbild der semantischen Begriffwolke fuer Kurs 3.

## Ziel und Leselogik

- Die Dateien mit Stopwoertern zeigen den heutigen, lexikalischen Stand auf Basis echter oder skriptgesteuert erzeugter Inhalte.
- Die Dateien mit Eingeblendet zeigen denselben Inhalt, aber mit sichtbaren Stopwoertern zur Gegenueberstellung.
- Die Dateien mit Zielbild zeigen den konzeptionellen Soll-Zustand fuer Kurs 3: semantische Cluster statt einzelner Tokens.

## Screenshots im Ueberblick

| Datei                                                                                                            | Typ             | Inhalt                                                  | Aussage                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [QA-Word-Cloud-Stopwoerter.png](./QA-Word-Cloud-Stopwoerter.png)                                                 | Ist-Zustand     | Q&A-Wortwolke mit ausgeblendeten Stopwoertern           | Zeigt, wie die aktuelle Wortwolke bei denselben Statistik-Fragen die fachlich relevanten Begriffe hervorhebt.                                    |
| [QA-Word-Cloud-Stopwoerter-Eingeblendet.png](./QA-Word-Cloud-Stopwoerter-Eingeblendet.png)                       | Vergleich       | Q&A-Wortwolke mit eingeblendeten Stopwoertern           | Macht sichtbar, welche Fragewoerter und Funktionswoerter ohne Filter wieder in die Wolke zurueckkehren.                                          |
| [Quiz-Freitext-Word-Cloud-Stopwoerter.png](./Quiz-Freitext-Word-Cloud-Stopwoerter.png)                           | Ist-Zustand     | Quiz-Freitext-Wortwolke mit ausgeblendeten Stopwoertern | Zeigt die aktuelle lexikalische Verdichtung freier Rueckmeldungen auf wichtige Fachbegriffe.                                                     |
| [Quiz-Freitext-Word-Cloud-Stopwoerter-Eingeblendet.png](./Quiz-Freitext-Word-Cloud-Stopwoerter-Eingeblendet.png) | Vergleich       | Quiz-Freitext-Wortwolke mit eingeblendeten Stopwoertern | Zeigt denselben Datensatz mit sichtbarem sprachlichem Rauschen als Kontrastbild.                                                                 |
| [QA-Semantische-Begriffwolke-Zielbild.png](./QA-Semantische-Begriffwolke-Zielbild.png)                           | Zielbild Kurs 3 | Semantische Begriffwolke fuer Q&A                       | Gruppiert dieselben Fragen nicht mehr nur nach Woertern, sondern nach Themenclustern wie Deskriptive Statistik, Zusammenhaenge und Modellierung. |
| [Quiz-Freitext-Semantische-Begriffwolke-Zielbild.png](./Quiz-Freitext-Semantische-Begriffwolke-Zielbild.png)     | Zielbild Kurs 3 | Semantische Begriffwolke fuer Quiz-Freitext             | Verdichtet dieselben Rueckmeldungen zu didaktisch lesbaren Bedeutungsraeumen mit Themenlabels und Clusterkarten.                                 |

## Empfohlene Verwendung

- Fuer Produktdiskussionen: erst Ist-Zustand ohne Stopwoerter, dann Vergleich mit eingeblendeten Stopwoertern, danach das semantische Zielbild.
- Fuer Kurs 3: die beiden Zielbilder als visuelle Leitplanke fuer semantisches Buendeln, Labeling und Evaluationskriterien verwenden.
- Fuer Architektur- oder NLP-Gespraeche: die Zielbilder immer als Konzeptbild kennzeichnen, nicht als bereits implementierte Produktoberflaeche.

## Herkunft der Dateien

- Die vier lexikalischen Wortwolken werden ueber [../../apps/frontend/scripts/capture-doc-word-cloud-screenshots.mjs](../../apps/frontend/scripts/capture-doc-word-cloud-screenshots.mjs) erzeugt.
- Die beiden semantischen Zielbilder werden ueber [../../apps/frontend/scripts/capture-doc-semantic-cloud-target-screenshots.mjs](../../apps/frontend/scripts/capture-doc-semantic-cloud-target-screenshots.mjs) gerendert.

## Begriffsabgrenzung

- Lexikalische Wortwolke: gleiche oder aehnliche Tokens werden gezaehlt und gewichtet.
- Stopwort-Filter: haeufige, wenig aussagekraeftige Woerter werden optional ausgeblendet.
- Semantische Begriffwolke: aehnliche Aussagen, Varianten und Paraphrasen werden zu Themenclustern zusammengefuehrt und mit sprechenden Labels versehen.
