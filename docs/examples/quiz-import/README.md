# Beispiel-Quizzes (Import-JSON)

Diese Dateien sind für den Import über **Quiz importieren** / **KI-JSON importieren** gedacht.
Sie entsprechen dem `QuizImportSchema` aus `@arsnova/shared-types`.

## Enthaltene Beispiele

- `quiz-single-choice-realistisch.json` – nur `SINGLE_CHOICE`
- `quiz-multiple-choice-realistisch.json` – nur `MULTIPLE_CHOICE`
- `quiz-survey-realistisch.json` – nur `SURVEY`
- `quiz-freetext-realistisch.json` – nur `FREETEXT`
- `quiz-rating-realistisch.json` – nur `RATING`
- `quiz-word-cloud-komplett.json` – vollständiges `FREETEXT`-Szenario für Word-Cloud-Bewertung
- `quiz-mixed-realistisch.json` – gemischtes Quiz mit allen Formaten
- `quiz-unterrichtsfeedback-kompakt.json` – kurzes Praxis-Feedback-Quiz
- `word-cloud-responses-komplex.txt` – großer synthetischer Antwortsatz (2.800 Antworten)
- `word-cloud-komplex.svg` – bereits gerenderte, sehr komplexe Word-Cloud aus dem Datensatz
- `word-cloud-komplex-top20.csv` – Top-20 Woerter mit Haeufigkeiten

Alle Quizzes enthalten realistische Fragestämme mit **Markdown** und **KaTeX** (`$...$`, `$$...$$`).

## Word-Cloud Komplettbeispiel bewerten

1. `quiz-word-cloud-komplett.json` importieren.
2. Live-Session starten und die erste oder zweite Freitextfrage öffnen.
3. Antworten aus `word-cloud-responses-digitalisierung.txt` als Testdaten einspeisen.
4. In der Word-Cloud prüfen:
   - sinnvolle Gewichtung haeufiger Begriffe,
   - Filterung von Stopwoertern,
   - Reaktion auf Umlaute und Bindestrich-Begriffe,
   - CSV/PNG-Export.
