# Technische Quellen zu ARSnova.eu und den Kurswerkzeugen

Dieses Begleitdokument bündelt die technischen Quellen, auf die das Modulkonzept verweist. Die Quellennachweise begründen Definitionen, Datenverträge und Einsatzgrenzen, sind aber keine Versions- oder Audit-Metadaten der Modulbeschreibung.

**Kürzel vorab:** **Q1–Q20** bezeichnet die Quellen 1 bis 20, **UE** eine 45-minütige Unterrichtseinheit und **V1–V6** die optionalen, nicht summativ geprüften Vertiefungen des Moduls.

## Ausgewählte Repository-Vorlagen

| Vorlage                            | Konkreter Inhalt                                                      | Einbindung und Anpassung                                                         |
| ---------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Statistik kompakt – Konzepte (Q11) | Normalverteilung und Bayes; weitere Demo-Inhalte vor Übernahme prüfen | Wochen 4–5; in Alltagssprache einführen, Lösungen begründen lassen.              |
| Mixed-Demo (Q12)                   | Standardabweichung und eigenständiges Sicherheits-Rating              | Woche 3 und Feedback; Rating nicht mit antwortbezogener Confidence gleichsetzen. |
| Single-Choice-Demo (Q13)           | Wahrscheinlichkeit beim zweimaligen Münzwurf                          | Woche 4 als niedrigschwelliger Einstieg.                                         |

Diese Importdateien belegen Funktionen und mögliche Ausgangsinhalte, sind aber nicht der Fragenpool des Moduls. Die dedizierten Wochenquiz-Dateien verwenden stattdessen das formative Gamification-Profil des [ARSnova-Livequiz-Blueprints](./P0-03_ARSnova_Livequiz_Blueprint_10_Wochen.md). Für Rechenaufgaben eignet sich technisch auch eine numerisch bewertete Kurzantwort; offene Interpretationssätze werden durch die Lehrperson besprochen, nicht automatisch semantisch bewertet (Q15, Q17).

## Drei zusätzliche Aufgabenbausteine

**A – Ranking und Messgröße (UE 29, nur V1).** Bei 100 Teilnehmenden erhält Frage A eine positive und eine negative Stimme, Frage B 40 positive und 40 negative Stimmen. Beide haben 50 % Zustimmung und Netto-Score 0. Im implementierten Kontroversitätsmaß mit \(C=\max(1;0{,}1N)\) ergeben sich rund 0,167 und 0,889. Die Aufgabe darf nur nach offenem Gate als nicht summative Anschauung eingesetzt werden. Der Score ist eine gestaltete Priorisierungsmetrik, kein Signifikanztest (Q6, Q7).

**B – Einheiten und Streuung (UE 11).** Synthetische Schätzwerte in Sekunden: 100, 110, 120, 130, 140. Mittelwert 120; Quadratsumme der Abweichungen 1.000. ARSnova-deskriptiv: Varianz 200 s², Standardabweichung rund 14,14 s. Stichprobenschätzer: Varianz 250 s², Standardabweichung rund 15,81 s. Begründen Sie den Unterschied. Ein anderer Wert in der Formelsammlung ist hier kein Softwarefehler (Q3).

**C – Automatisierungsqualität und Aufwand (UE 44, nur V3/V4/V6).** Dokumentierte Classified-Accuracy/Coverage: Gatekeeper 0,84/0,97; Kaskade 0,87/0,85 bei derselben Schwelle 0,55. Die Aufgabe darf nur nach offenem Gate als nicht summative Anschauung eingesetzt werden. Für 100 gedachte Fälle entsprechen die gerundeten Raten etwa 3 beziehungsweise 15 Fällen für die manuelle Nachbearbeitung. Diese Hochrechnung ist ein Lehrbeispiel, keine rekonstruierte Confusion Matrix. Ohne Fehlerkosten und Prüfung nicht akzeptierter Fälle gibt es keine eindeutige Managementempfehlung. Macro-F1 des Gatekeepers bezieht sich auf Best-Guess-Klassen über alle gelabelten Eval-Fälle, nicht nur die akzeptierte Teilmenge (Q8, Q9).

## Quellen Q1–Q20

Q1–Q17 verweisen auf einen festen ARSnova.eu-Quellstand, damit Definitionen und Berechnungsregeln nachvollziehbar bleiben. Q18 verweist auf den für das Kursmaterial geprüften MC-Test-Stand. Q19 und Q20 sind offizielle JASP-Seiten.

- **Q1:** [Produkt und Architektur](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/README.md).
- **Q2:** [Schätzfrage und Rundenvergleich](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/features/numeric-estimate.md).
- **Q3:** [Statistikberechnung und Session-Export](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/apps/backend/src/routers/session.ts).
- **Q4:** [Selbsteinschätzung und Aggregationsrunde](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/libs/shared-types/src/confidence.ts).
- **Q5:** [Selbsteinschätzung im Lehrbetrieb](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/features/confidence-slider.md).
- **Q6:** [Wilson- und Kontroversitätsberechnung](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/apps/backend/src/routers/qa.ts).
- **Q7:** [Q&A-Ranking](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/features/controversy-score.md).
- **Q8:** [Optionale NLP-Kaskade und dokumentierte Evaluation](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/features/qa-nlp-moderation.md).
- **Q9:** [Nenner und Metriken der NLP-Evaluation](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/apps/backend/src/lib/qaNlpEvaluate.ts).
- **Q10:** [PDF-/CSV-Ergebnisbericht](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/features/session-export-pdf.md).
- **Q11:** [Statistik kompakt – Konzepte](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/examples/quiz-import/quiz-multiple-choice-realistisch.json).
- **Q12:** [Mixed-Demo mit Standardabweichung und Rating](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/examples/quiz-import/quiz-mixed-realistisch.json).
- **Q13:** [Single-Choice-Demo mit Münzwurf](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/examples/quiz-import/quiz-single-choice-realistisch.json).
- **Q14:** [Regelbasierter Moderationskompass](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/features/moderation-compass.md).
- **Q15:** [Funktionsübersicht und Fragetypen](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/APP-FUNKTIONSUEBERSICHT.md).
- **Q16:** [Statistik- und Managementtransfer](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/docs/didaktik/MODERATIONSKOMPASS-8.9A-D-MODULE-UND-PRAKTIKA.md).
- **Q17:** [Fragetypen und numerische Antwortbewertung](https://github.com/kqc-real/arsnova.eu/blob/d2eb75d134712b637410ac3ca6e9f059b9eac0f5/libs/shared-types/src/schemas.ts).
- **Q18:** [MC-Test – geprüfter Quellstand](https://github.com/kqc-real/streamlit/tree/b6b159555e8a228dad73dd75fd66c154a1088e28).
- **Q19:** [Offizieller JASP-Download – JASP 0.98.1](https://jasp-stats.org/download/).
- **Q20:** [Offizielle JASP Release Notes – 0.98.1, veröffentlicht am 07.07.2026](https://jasp-stats.org/release-notes/).
