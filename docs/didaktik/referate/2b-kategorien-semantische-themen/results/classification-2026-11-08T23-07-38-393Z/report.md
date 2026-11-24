# Referat 2B – Klassifikationsmessung 8.9b

Commit `74091b0a6468` (v1.3.0-364-g74091b0a-dirty), Referenzset 2.2.0 (SHA-256 `717bdb17dc2e94d5…`), 2026-11-08T23:07:38.393Z
Node v24.22.2, Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz × 8, 31.9 GB RAM, win32 10.0.19045 x64

Umfang: 500 von 723 Items, Domäne statistics, Sprachen de, en, fr, es (+ mixed); Italienisch ausgeschlossen (Untersuchungsumfang an Wortwolken-Locales angeglichen).

Gelabelt: 421 Items · erwartet unsicher (mehrdeutig/Rauschen): 79 · Betriebspunkt `QA_NLP_MIN_CONFIDENCE` = 0.55

## 1. Hauptergebnis (Originalschreibung, Betriebspunkt)

| System                                 | Best-Guess-Acc. | Macro-F1 | Abdeckung | Präzision akzeptiert | Nutzbar korrekt | Falsch akzeptiert | Enthaltung mehrdeutig/Rauschen |
| -------------------------------------- | --------------: | -------: | --------: | -------------------: | --------------: | ----------------: | -----------------------------: |
| Keyword-Baseline (regelbasiert)        |          53.9 % |    0.513 |    47.0 % |               74.7 % |          35.2 % |            11.9 % |                         94.9 % |
| Gatekeeper (Naive Bayes, nur Schwelle) |          66.0 % |    0.663 |    96.2 % |               66.7 % |          64.1 % |            32.1 % |                         21.5 % |
| Kaskade 1.3 (Gatekeeper + k-NN)        |          66.0 % |    0.664 |    91.7 % |               66.8 % |          61.3 % |            30.4 % |                         74.7 % |

_Nutzbar korrekt_ = akzeptiert und richtig, bezogen auf alle gelabelten Items. _Falsch akzeptiert_ = Lehrperson sieht eine sichere, aber falsche Kategorie.

### 95-%-Bootstrap-Intervalle

| System                                 | Nutzbar korrekt  | Präzision akzeptiert | Abdeckung        | Macro-F1       |
| -------------------------------------- | ---------------- | -------------------- | ---------------- | -------------- |
| Keyword-Baseline (regelbasiert)        | [30.6 %; 39.9 %] | [68.5 %; 80.9 %]     | [42.3 %; 51.8 %] | [0.461; 0.562] |
| Gatekeeper (Naive Bayes, nur Schwelle) | [59.4 %; 69.1 %] | [61.9 %; 71.4 %]     | [94.3 %; 97.9 %] | [0.616; 0.711] |
| Kaskade 1.3 (Gatekeeper + k-NN)        | [56.3 %; 66.3 %] | [62.0 %; 71.8 %]     | [89.1 %; 94.3 %] | [0.616; 0.712] |

### Paarvergleich (exakter McNemar-Test, gepaart über dieselben Items)

| Vergleich             | Merkmal            | nur A richtig | nur B richtig |      p |
| --------------------- | ------------------ | ------------: | ------------: | -----: |
| cascade vs keyword    | nutzbar korrekt    |           142 |            32 | 0.0000 |
| cascade vs keyword    | Best-Guess korrekt |            99 |            48 | 0.0000 |
| gatekeeper vs keyword | nutzbar korrekt    |           148 |            26 | 0.0000 |
| gatekeeper vs keyword | Best-Guess korrekt |           101 |            50 | 0.0000 |
| cascade vs gatekeeper | nutzbar korrekt    |             5 |            17 | 0.0169 |
| cascade vs gatekeeper | Best-Guess korrekt |             5 |             5 | 1.0000 |

Kaskadenpfade: early-exit 342, fallback 79

## 2. Schwellen-Sweep

Vorab festgelegte Kriterien (Releasekonstanten): Präzision akzeptiert ≥ 80.0 %, Unsicher-Rate ≤ 30.0 %.

**Keyword-Baseline (regelbasiert)**

| Schwelle | Abdeckung | Präzision akz. | Nutzbar korrekt | Falsch akz. | Enthaltung mehrd. | Kriterien |
| -------: | --------: | -------------: | --------------: | ----------: | ----------------: | :-------: |
|     0.35 |    52.7 % |         70.7 % |          37.3 % |      15.4 % |            93.7 % |     –     |
|     0.40 |    52.7 % |         70.7 % |          37.3 % |      15.4 % |            93.7 % |     –     |
|     0.45 |    52.7 % |         70.7 % |          37.3 % |      15.4 % |            93.7 % |     –     |
|     0.50 |    52.7 % |         70.7 % |          37.3 % |      15.4 % |            93.7 % |     –     |
|   0.55 ◀ |    47.0 % |         74.7 % |          35.2 % |      11.9 % |            94.9 % |     –     |
|     0.60 |    47.0 % |         74.7 % |          35.2 % |      11.9 % |            94.9 % |     –     |
|     0.65 |    47.0 % |         74.7 % |          35.2 % |      11.9 % |            94.9 % |     –     |
|     0.70 |    44.9 % |         73.5 % |          33.0 % |      11.9 % |            94.9 % |     –     |
|     0.80 |    44.4 % |         73.8 % |          32.8 % |      11.6 % |            94.9 % |     –     |
|     0.90 |    44.4 % |         73.8 % |          32.8 % |      11.6 % |            94.9 % |     –     |

**Gatekeeper (Naive Bayes, nur Schwelle)**

| Schwelle | Abdeckung | Präzision akz. | Nutzbar korrekt | Falsch akz. | Enthaltung mehrd. | Kriterien |
| -------: | --------: | -------------: | --------------: | ----------: | ----------------: | :-------: |
|     0.35 |   100.0 % |         66.0 % |          66.0 % |      34.0 % |             1.3 % |     –     |
|     0.40 |    99.5 % |         66.1 % |          65.8 % |      33.7 % |             3.8 % |     –     |
|     0.45 |    99.3 % |         66.3 % |          65.8 % |      33.5 % |            12.7 % |     –     |
|     0.50 |    98.1 % |         66.6 % |          65.3 % |      32.8 % |            19.0 % |     –     |
|   0.55 ◀ |    96.2 % |         66.7 % |          64.1 % |      32.1 % |            21.5 % |     –     |
|     0.60 |    93.8 % |         67.3 % |          63.2 % |      30.6 % |            32.9 % |     –     |
|     0.65 |    91.7 % |         68.4 % |          62.7 % |      29.0 % |            39.2 % |     –     |
|     0.70 |    89.5 % |         69.0 % |          61.8 % |      27.8 % |            46.8 % |     –     |
|     0.80 |    82.2 % |         70.2 % |          57.7 % |      24.5 % |            67.1 % |     –     |
|     0.90 |    70.5 % |         72.4 % |          51.1 % |      19.5 % |            74.7 % |     –     |

**Kaskade 1.3 (Gatekeeper + k-NN)**

| Schwelle | Abdeckung | Präzision akz. | Nutzbar korrekt | Falsch akz. | Enthaltung mehrd. | Kriterien |
| -------: | --------: | -------------: | --------------: | ----------: | ----------------: | :-------: |
|     0.35 |    89.8 % |         67.2 % |          60.3 % |      29.5 % |            74.7 % |     –     |
|     0.40 |    89.8 % |         67.2 % |          60.3 % |      29.5 % |            74.7 % |     –     |
|     0.45 |    90.0 % |         67.3 % |          60.6 % |      29.5 % |            74.7 % |     –     |
|     0.50 |    91.0 % |         67.1 % |          61.0 % |      29.9 % |            74.7 % |     –     |
|   0.55 ◀ |    91.7 % |         66.8 % |          61.3 % |      30.4 % |            74.7 % |     –     |
|     0.60 |    91.9 % |         66.9 % |          61.5 % |      30.4 % |            75.9 % |     –     |
|     0.65 |    90.7 % |         67.5 % |          61.3 % |      29.5 % |            75.9 % |     –     |
|     0.70 |    90.0 % |         67.5 % |          60.8 % |      29.2 % |            74.7 % |     –     |
|     0.80 |    87.2 % |         67.8 % |          59.1 % |      28.0 % |            74.7 % |     –     |
|     0.90 |    84.3 % |         66.5 % |          56.1 % |      28.3 % |            73.4 % |     –     |

## 3. Slices (Betriebspunkt)

**Sprache** – nutzbar korrekt / falsch akzeptiert (n)

| Sprache |   n | keyword         | gatekeeper      | cascade         |
| ------- | --: | --------------- | --------------- | --------------- |
| de      | 169 | 46.2 % / 8.9 %  | 74.0 % / 23.1 % | 69.2 % / 20.1 % |
| en      | 101 | 35.6 % / 15.8 % | 65.3 % / 29.7 % | 66.3 % / 29.7 % |
| fr      |  68 | 19.1 % / 13.2 % | 50.0 % / 45.6 % | 50.0 % / 42.6 % |
| es      |  67 | 19.4 % / 11.9 % | 47.8 % / 47.8 % | 44.8 % / 49.3 % |
| mixed   |  16 | 50.0 % / 12.5 % | 81.3 % / 18.8 % | 62.5 % / 12.5 % |

**Tag** – nutzbar korrekt / falsch akzeptiert (n)

| Tag         |   n | keyword         | gatekeeper      | cascade         |
| ----------- | --: | --------------- | --------------- | --------------- |
| canonical   | 118 | 34.7 % / 11.0 % | 61.0 % / 34.7 % | 61.0 % / 33.9 % |
| (none)      | 198 | 32.3 % / 10.6 % | 67.2 % / 28.3 % | 65.7 % / 27.3 % |
| short       |  37 | 51.4 % / 0.0 %  | 75.7 % / 21.6 % | 51.4 % / 13.5 % |
| frame       |   3 | 66.7 % / 0.0 %  | 100.0 % / 0.0 % | 100.0 % / 0.0 % |
| code-switch |  16 | 50.0 % / 12.5 % | 81.3 % / 18.8 % | 62.5 % / 12.5 % |
| typo        |   9 | 44.4 % / 0.0 %  | 77.8 % / 22.2 % | 55.6 % / 22.2 % |
| slang       |   7 | 71.4 % / 0.0 %  | 28.6 % / 57.1 % | 28.6 % / 42.9 % |
| near-miss   |  47 | 27.7 % / 31.9 % | 48.9 % / 51.1 % | 48.9 % / 51.1 % |

**Gold-Kategorie** – nutzbar korrekt / falsch akzeptiert (n)

| Gold-Kategorie |   n | keyword         | gatekeeper      | cascade         |
| -------------- | --: | --------------- | --------------- | --------------- |
| content        | 140 | 43.6 % / 2.9 %  | 66.4 % / 28.6 % | 66.4 % / 26.4 % |
| organization   | 155 | 24.5 % / 27.1 % | 62.6 % / 34.2 % | 56.8 % / 34.2 % |
| technical      | 126 | 38.9 % / 3.2 %  | 63.5 % / 33.3 % | 61.1 % / 30.2 % |

## 4. Kalibrierung der Konfidenz

**Gatekeeper (Naive Bayes, nur Schwelle)** – ECE 0.250

| Konfidenzbereich |   n | mittlere Konfidenz | tatsächliche Acc. |
| ---------------- | --: | -----------------: | ----------------: |
| [0.00, 0.40)     |   2 |              0.388 |            50.0 % |
| [0.40, 0.55)     |  14 |              0.505 |            50.0 % |
| [0.55, 0.70)     |  28 |              0.627 |            35.7 % |
| [0.70, 0.85)     |  51 |              0.783 |            62.7 % |
| [0.85, 1.00]     | 326 |              0.973 |            69.9 % |

**Kaskade 1.3 (Gatekeeper + k-NN)** – ECE 0.243

| Konfidenzbereich |   n | mittlere Konfidenz | tatsächliche Acc. |
| ---------------- | --: | -----------------: | ----------------: |
| [0.00, 0.40)     |   2 |              0.388 |            50.0 % |
| [0.40, 0.55)     |   3 |              0.517 |           100.0 % |
| [0.55, 0.70)     |  49 |              0.617 |            51.0 % |
| [0.70, 0.85)     |  68 |              0.788 |            64.7 % |
| [0.85, 1.00]     | 299 |              0.973 |            68.6 % |

## 5. Kontrollierte Variante: Transliteration

Seed und Keyword-Liste sind transliteriert. Gleiche Items, DE/mixed mit ä→ae usw.

| System                                 | Nutzbar korrekt (orig → translit) | Falsch akzeptiert (orig → translit) | Macro-F1 (orig → translit) |
| -------------------------------------- | --------------------------------- | ----------------------------------- | -------------------------- |
| Keyword-Baseline (regelbasiert)        | 35.2 % → 34.9 %                   | 11.9 % → 12.6 %                     | 0.513 → 0.507              |
| Gatekeeper (Naive Bayes, nur Schwelle) | 64.1 % → 64.1 %                   | 32.1 % → 31.4 %                     | 0.663 → 0.663              |
| Kaskade 1.3 (Gatekeeper + k-NN)        | 61.3 % → 61.8 %                   | 30.4 % → 30.2 %                     | 0.664 → 0.671              |

## 6. Laufzeit und Ressourcen

Kaltstart: Gatekeeper-Training 4.23 ms, k-NN-Prototypen 14.32 ms, Heap-Δ 18.7 MB, RSS-Δ 39.9 MB (inkl. Modulimport).

Warm, 20 Durchläufe × 500 Texte, ein Thread:

| System                                 |   p50 |    p95 |    p99 |     max | Durchsatz/s |
| -------------------------------------- | ----: | -----: | -----: | ------: | ----------: |
| Keyword-Baseline (regelbasiert)        |  7 µs |  11 µs |  17 µs | 1.96 ms |     131.856 |
| Gatekeeper (Naive Bayes, nur Schwelle) | 16 µs |  28 µs |  60 µs |  383 µs |      57.890 |
| Kaskade 1.3 (Gatekeeper + k-NN)        | 25 µs | 227 µs | 313 µs | 1.03 ms |      12.822 |

Produktions-Timeout je Job: 2000 ms (Queue/Worker-Overhead hier nicht gemessen).

## 7. Fehlerfälle (Betriebspunkt, Originalschreibung)

**Keyword-Baseline (regelbasiert)** – 54 sicher, aber falsch bzw. trotz Mehrdeutigkeit akzeptiert

| ID   | Text                                                             | Gold                  | Vorhersage   | Konfidenz |
| ---- | ---------------------------------------------------------------- | --------------------- | ------------ | --------: |
| Q103 | Wo findet die Nachklausur statt, wieder im Audimax?              | organization          | content      |     1.000 |
| Q104 | Where is the resit exam being held?                              | organization          | content      |     1.000 |
| Q108 | Schreiben wir die Nachklausur wieder im großen Hörsaal?          | organization          | content      |     1.000 |
| Q109 | Wo ist der Nachtermin für die Klausur?                           | organization          | content      |     1.000 |
| Q112 | Où se passe l'examen de rattrapage ?                             | organization          | content      |     1.000 |
| Q115 | Dürfen wir in der Klausur eine Formelsammlung benutzen?          | organization          | content      |     1.000 |
| Q117 | Can we bring a cheat sheet to the exam?                          | organization          | content      |     1.000 |
| Q118 | ¿Se puede usar calculadora en el examen?                         | organization          | content      |     1.000 |
| Q119 | Ist ein selbst geschriebener Spickzettel in der Klausur erlaubt? | organization          | content      |     1.000 |
| Q120 | Welche Hilfsmittel sind in der Klausur zugelassen?               | organization          | content      |     1.000 |
| Q122 | Which aids are allowed in the exam?                              | organization          | content      |     1.000 |
| Q123 | Is a graphing calculator allowed in the exam?                    | organization          | content      |     1.000 |
| Q124 | A-t-on droit à la calculatrice à l'examen ?                      | organization          | content      |     1.000 |
| Q125 | Quels documents sont autorisés à l'examen ?                      | organization          | content      |     1.000 |
| Q126 | ¿Se permite llevar un formulario al examen?                      | organization          | content      |     1.000 |
| Q140 | Wann kommt die Aufzeichnung von heute ins Moodle?                | organization          | technical    |     1.000 |
| Q144 | Wird die Aufnahme später im Moodle bereitgestellt?               | organization          | technical    |     1.000 |
| Q147 | Will today's recording be posted on Moodle?                      | organization          | technical    |     1.000 |
| Q150 | ¿Subirán la grabación a Moodle?                                  | organization          | technical    |     1.000 |
| Q159 | There's no Wi-Fi signal in this room.                            | technical             | organization |     1.000 |
| Q183 | Das Bild vom Projektor flackert die ganze Zeit.                  | technical             | organization |     1.000 |
| Q249 | How do I compute a z-score?                                      | content               | organization |     1.000 |
| Q251 | What does a z-score of 2 mean?                                   | content               | organization |     1.000 |
| Q252 | Comment calcule-t-on le score z ?                                | content               | organization |     1.000 |
| Q256 | Wie rechnet man den z-score aus?                                 | content               | organization |     1.000 |
| Q272 | Wie viel Prozent macht die Klausur an der Gesamtnote aus?        | organization          | content      |     1.000 |
| Q275 | Do the exercise sheets count towards the grade?                  | organization          | content      |     1.000 |
| Q288 | Where do I enrol for the exam?                                   | organization          | content      |     1.000 |
| Q289 | Is exam registration already open?                               | organization          | content      |     1.000 |
| Q290 | Jusqu'à quand peut-on s'inscrire à l'examen ?                    | organization          | content      |     1.000 |
| Q291 | Où s'inscrit-on pour l'examen ?                                  | organization          | content      |     1.000 |
| Q292 | ¿Hasta cuándo hay que inscribirse al examen?                     | organization          | content      |     1.000 |
| Q293 | ¿Dónde me inscribo para el examen?                               | organization          | content      |     1.000 |
| Q294 | Wo ist die registration für die Klausur?                         | organization          | content      |     1.000 |
| Q320 | Die Anmeldung über Shibboleth hängt in einer Schleife.           | technical             | organization |     1.000 |
| Q379 | Las luces del fondo del aula no funcionan.                       | technical             | organization |     1.000 |
| Q384 | Werden die Bonuspunkte auch für die Nachklausur angerechnet?     | organization          | content      |     1.000 |
| Q387 | Kann man die Sprechstunde auch für Fragen zu Bayes nutzen?       | organization          | content      |     1.000 |
| Q388 | Can we use the office hours to go over the p-value example?      | organization          | content      |     1.000 |
| Q389 | Peut-on venir en permanence pour parler de Bayes ?               | organization          | content      |     1.000 |
| Q390 | ¿Puedo ir a su horario de atención para preguntar sobre Bayes?   | organization          | content      |     1.000 |
| Q392 | Are the slides with the regression examples uploaded yet?        | organization          | content      |     0.750 |
| Q396 | Faut-il s'inscrire sur Moodle pour le TD ?                       | organization          | technical    |     1.000 |
| Q397 | ¿Hay que apuntarse en Moodle para el grupo de prácticas?         | organization          | technical    |     1.000 |
| Q401 | Ist das WLAN-Passwort für Gäste irgendwo hinterlegt?             | organization          | technical    |     1.000 |
| Q402 | Le mot de passe du wifi invité est affiché où ?                  | organization          | technical    |     1.000 |
| Q421 | Kann man im Stream auch Fragen stellen?                          | organization          | technical    |     1.000 |
| Q426 | Will the z-table be provided in the exam?                        | organization          | content      |     1.000 |
| Q430 | Is the sample size question from the exercise sheet graded?      | organization          | content      |     1.000 |
| Q431 | Where can I find the QR code if I arrive late?                   | organization          | technical    |     1.000 |
| Q414 | Danke, super erklärt!                                            | – (unsicher erwartet) | content      |     1.000 |
| Q472 | Super Vorlesung heute                                            | – (unsicher erwartet) | organization |     1.000 |
| Q478 | Sehr gut erklärt, danke                                          | – (unsicher erwartet) | content      |     1.000 |
| Q482 | Great lecture                                                    | – (unsicher erwartet) | organization |     1.000 |

**Gatekeeper (Naive Bayes, nur Schwelle)** – 197 sicher, aber falsch bzw. trotz Mehrdeutigkeit akzeptiert

| ID   | Text                                                                                   | Gold                             | Vorhersage   | Konfidenz |
| ---- | -------------------------------------------------------------------------------------- | -------------------------------- | ------------ | --------: |
| Q003 | Could you walk us through another linear regression example?                           | content                          | technical    |     0.655 |
| Q009 | Can we do one more regression example step by step?                                    | content                          | organization |     0.987 |
| Q011 | ¿Podemos resolver otro ejercicio de regresión lineal?                                  | content                          | organization |     0.899 |
| Q013 | Können wir noch ein regression example machen?                                         | content                          | organization |     0.867 |
| Q015 | Muss ich den t-Test für die Prüfung können?                                            | content                          | organization |     0.999 |
| Q016 | Will hypothesis testing be on the final exam?                                          | content                          | organization |     0.889 |
| Q017 | ¿Entran los contrastes de hipótesis en el examen?                                      | content                          | organization |     0.874 |
| Q020 | Wird Kapitel 5 mit den Tests abgefragt?                                                | content                          | organization |     0.998 |
| Q021 | Will we be tested on the t-test?                                                       | content                          | organization |     0.911 |
| Q022 | Is chapter 5 on hypothesis tests examinable?                                           | content                          | organization |     0.633 |
| Q024 | Faut-il réviser le chapitre 5 pour l'examen ?                                          | content                          | organization |     0.762 |
| Q025 | ¿Hay que estudiar el capítulo 5 para el examen?                                        | content                          | organization |     1.000 |
| Q028 | Checkt jemand den p-Wert? Ich raff das nicht.                                          | content                          | technical    |     0.882 |
| Q046 | Overfitting?? check ich nicht                                                          | content                          | technical    |     0.625 |
| Q049 | Comment savoir si un modèle fait du surapprentissage ?                                 | content                          | organization |     0.960 |
| Q050 | Quelle différence entre surapprentissage et sous-apprentissage ?                       | content                          | organization |     0.723 |
| Q051 | ¿Qué diferencia hay entre sobreajuste y subajuste?                                     | content                          | technical    |     0.927 |
| Q053 | Den Schritt von Zeile 2 auf Zeile 3 in der Herleitung auf Folie 17 verstehe ich nicht. | content                          | technical    |     0.773 |
| Q059 | folie 17 zeile 3 versteh ich nicht                                                     | content                          | technical    |     0.977 |
| Q063 | En la diapositiva 17, ¿de dónde sale el cuadrado?                                      | content                          | organization |     0.870 |
| Q079 | What's the due date for problem set two?                                               | organization                     | content      |     0.791 |
| Q080 | Quelle est la date de rendu de la deuxième feuille d'exercices ?                       | organization                     | content      |     0.999 |
| Q086 | On doit rendre la feuille 2 quand ?                                                    | organization                     | content      |     0.978 |
| Q088 | ¿La entrega de la segunda hoja es el viernes?                                          | organization                     | content      |     0.989 |
| Q099 | La présence en cours est-elle obligatoire ?                                            | organization                     | content      |     0.811 |
| Q112 | Où se passe l'examen de rattrapage ?                                                   | organization                     | content      |     0.996 |
| Q115 | Dürfen wir in der Klausur eine Formelsammlung benutzen?                                | organization                     | content      |     0.951 |
| Q116 | Ist ein Taschenrechner in der Prüfung erlaubt?                                         | organization                     | technical    |     0.727 |
| Q119 | Ist ein selbst geschriebener Spickzettel in der Klausur erlaubt?                       | organization                     | content      |     0.997 |
| Q120 | Welche Hilfsmittel sind in der Klausur zugelassen?                                     | organization                     | content      |     0.999 |
| Q124 | A-t-on droit à la calculatrice à l'examen ?                                            | organization                     | content      |     0.992 |
| Q130 | Le cours de jeudi prochain est maintenu ?                                              | organization                     | content      |     0.948 |
| Q131 | ¿Hay clase el próximo jueves?                                                          | organization                     | content      |     0.720 |
| Q137 | Il y a cours jeudi malgré le jour férié ?                                              | organization                     | technical    |     0.974 |
| Q138 | ¿Se cancela la clase del jueves por el festivo?                                        | organization                     | content      |     0.940 |
| Q141 | Will the recording be uploaded afterwards?                                             | organization                     | content      |     0.984 |
| Q142 | Est-ce que le cours est enregistré ?                                                   | organization                     | content      |     0.985 |
| Q149 | ¿Se graba la clase de hoy?                                                             | organization                     | content      |     0.997 |
| Q150 | ¿Subirán la grabación a Moodle?                                                        | organization                     | technical    |     1.000 |
| Q151 | Kommt das recording später online?                                                     | organization                     | content      |     0.914 |
| Q153 | eduroam ist schon wieder komplett down                                                 | technical                        | content      |     0.760 |
| Q154 | The eduroam connection keeps dropping in here.                                         | technical                        | content      |     0.998 |
| Q155 | El wifi del aula se cae todo el rato.                                                  | technical                        | content      |     0.590 |
| Q160 | eduroam won't connect at all here.                                                     | technical                        | content      |     0.875 |
| Q162 | Impossible de se connecter à eduroam ici.                                              | technical                        | content      |     0.977 |
| Q165 | Hinten versteht man Sie kaum, das Mikro ist zu leise.                                  | technical                        | content      |     0.879 |
| Q168 | On n'entend rien au fond, le micro est trop faible.                                    | technical                        | organization |     0.592 |
| Q169 | Ton weg                                                                                | technical                        | content      |     0.638 |
| Q171 | Hinten kommt kein Ton an.                                                              | technical                        | content      |     0.976 |
| Q173 | Could you turn the mic up a bit?                                                       | technical                        | content      |     0.828 |
| Q177 | Der Beamer schneidet die rechte Hälfte der Folie ab.                                   | technical                        | content      |     0.649 |
| Q178 | Die Projektion ist so blass, dass man die Formeln nicht lesen kann.                    | technical                        | content      |     0.995 |
| Q185 | The projector image keeps flickering.                                                  | technical                        | content      |     0.912 |
| Q186 | The projection is too faint to read.                                                   | technical                        | content      |     0.604 |
| Q188 | L'image du projecteur clignote.                                                        | technical                        | content      |     0.612 |
| Q189 | La imagen del proyector parpadea todo el rato.                                         | technical                        | content      |     0.968 |
| Q193 | Le vote ne s'affiche pas sur mon téléphone.                                            | technical                        | organization |     0.728 |
| Q200 | No puedo votar, el botón no responde.                                                  | technical                        | content      |     0.977 |
| Q201 | La encuesta no carga en mi móvil.                                                      | technical                        | content      |     0.927 |
| Q226 | how do i interpret a confidence interval                                               | content                          | organization |     0.745 |
| Q235 | Korrelation gleich Kausalität oder nicht?                                              | content                          | technical    |     0.872 |
| Q237 | Does correlation imply causation here?                                                 | content                          | technical    |     0.763 |
| Q244 | Wie berechne ich den z-Wert?                                                           | content                          | organization |     0.557 |
| Q246 | Was genau sagt ein z-Wert von 2 aus?                                                   | content                          | technical    |     0.728 |
| Q249 | How do I compute a z-score?                                                            | content                          | organization |     1.000 |
| Q252 | Comment calcule-t-on le score z ?                                                      | content                          | organization |     0.965 |
| Q256 | Wie rechnet man den z-score aus?                                                       | content                          | organization |     0.989 |
| Q257 | Wie groß muss meine Stichprobe mindestens sein?                                        | content                          | organization |     0.830 |
| Q258 | Woher weiß ich, wie viele Personen ich befragen muss?                                  | content                          | organization |     0.997 |
| Q260 | Gibt es eine Faustregel für die Stichprobengröße?                                      | content                          | organization |     1.000 |
| Q261 | Stichprobengröße berechnen – wie?                                                      | content                          | organization |     0.780 |
| Q262 | How large does my sample need to be?                                                   | content                          | technical    |     0.997 |
| Q263 | How do we calculate the required sample size?                                          | content                          | organization |     0.997 |
| Q264 | Is there a rule of thumb for sample size?                                              | content                          | organization |     0.909 |
| Q268 | ¿Cuántas personas hay que encuestar como mínimo?                                       | content                          | organization |     0.945 |
| Q269 | Zählen die Übungsblätter zur Endnote?                                                  | organization                     | content      |     0.675 |
| Q270 | Wie setzt sich die Note zusammen?                                                      | organization                     | content      |     0.858 |
| Q275 | Do the exercise sheets count towards the grade?                                        | organization                     | content      |     0.987 |
| Q278 | Les exercices comptent-ils dans la note ?                                              | organization                     | content      |     1.000 |
| Q279 | ¿Cómo se calcula la nota final?                                                        | organization                     | technical    |     0.847 |
| Q280 | ¿Cuentan las hojas de ejercicios para la nota?                                         | organization                     | content      |     0.893 |
| Q301 | Is it still possible to change my tutorial slot?                                       | organization                     | technical    |     0.594 |
| Q303 | Est-ce qu'on peut changer de groupe de TD ?                                            | organization                     | content      |     0.999 |
| Q304 | J'ai un conflit d'horaire, je peux changer de TD ?                                     | organization                     | content      |     1.000 |
| Q305 | ¿Puedo cambiarme a otro grupo de prácticas?                                            | organization                     | content      |     0.922 |
| Q306 | Tengo un solapamiento, ¿puedo cambiar de grupo de prácticas?                           | organization                     | content      |     1.000 |
| Q313 | Can I book a slot in your office hours?                                                | organization                     | technical    |     0.882 |
| Q315 | Quand sont vos heures de permanence ?                                                  | organization                     | content      |     0.954 |
| Q316 | Peut-on prendre rendez-vous pour une permanence ?                                      | organization                     | content      |     0.925 |
| Q317 | ¿Cuándo tiene horario de atención?                                                     | organization                     | content      |     0.882 |
| Q318 | ¿Puedo pedir cita para su horario de atención?                                         | organization                     | content      |     0.685 |
| Q322 | Seit heute Morgen kann ich mich nicht mehr einloggen.                                  | technical                        | organization |     1.000 |
| Q326 | My password isn't accepted on the learning platform.                                   | technical                        | organization |     0.999 |
| Q328 | La connexion unique tourne en boucle.                                                  | technical                        | content      |     0.888 |
| Q334 | Die Übertragung für die Leute zu Hause ist abgebrochen.                                | technical                        | organization |     0.997 |
| Q339 | The broadcast for people at home has dropped.                                          | technical                        | organization |     0.804 |
| Q342 | La transmisión en directo se congela.                                                  | technical                        | content      |     0.996 |
| Q343 | En el streaming solo se ve negro.                                                      | technical                        | content      |     0.599 |
| Q355 | Mi móvil no reconoce el código QR.                                                     | technical                        | content      |     0.741 |
| Q356 | El código QR es demasiado pequeño desde atrás.                                         | technical                        | content      |     0.962 |
| Q357 | Die Steckdosen in Reihe 12 haben keinen Strom.                                         | technical                        | organization |     0.639 |
| Q358 | Gibt es hier irgendwo funktionierende Steckdosen? Mein Akku ist leer.                  | technical                        | organization |     0.964 |
| Q359 | Die Steckdosenleiste unter den Tischen ist tot.                                        | technical                        | organization |     0.995 |
| Q363 | My laptop won't charge from the desk outlets.                                          | technical                        | content      |     0.997 |
| Q364 | None of the outlets under the desks have power.                                        | technical                        | content      |     0.948 |
| Q365 | Les prises de la rangée 12 ne marchent pas.                                            | technical                        | content      |     0.905 |
| Q367 | Los enchufes de la fila 12 no funcionan.                                               | technical                        | content      |     0.908 |
| Q369 | Das Licht im hinteren Teil des Hörsaals ist ausgefallen.                               | technical                        | content      |     0.900 |
| Q370 | Die Deckenbeleuchtung flackert ständig.                                                | technical                        | content      |     0.991 |
| Q377 | La lumière au fond de l'amphi ne marche plus.                                          | technical                        | content      |     0.726 |
| Q378 | Les néons clignotent sans arrêt.                                                       | technical                        | organization |     0.935 |
| Q379 | Las luces del fondo del aula no funcionan.                                             | technical                        | content      |     0.660 |
| Q380 | Las luces del techo parpadean todo el rato.                                            | technical                        | content      |     0.990 |
| Q382 | Le score z sera-t-il à l'examen ?                                                      | content                          | organization |     0.993 |
| Q383 | ¿Entra la puntuación z en el examen?                                                   | content                          | organization |     0.998 |
| Q385 | Les points bonus comptent-ils aussi pour le rattrapage ?                               | organization                     | technical    |     0.902 |
| Q388 | Can we use the office hours to go over the p-value example?                            | organization                     | content      |     1.000 |
| Q389 | Peut-on venir en permanence pour parler de Bayes ?                                     | organization                     | content      |     0.685 |
| Q390 | ¿Puedo ir a su horario de atención para preguntar sobre Bayes?                         | organization                     | content      |     0.966 |
| Q392 | Are the slides with the regression examples uploaded yet?                              | organization                     | technical    |     0.967 |
| Q393 | Les diapos de la régression sont-elles déjà en ligne ?                                 | organization                     | content      |     1.000 |
| Q396 | Faut-il s'inscrire sur Moodle pour le TD ?                                             | organization                     | technical    |     0.987 |
| Q397 | ¿Hay que apuntarse en Moodle para el grupo de prácticas?                               | organization                     | technical    |     0.941 |
| Q400 | ¿La correlación entra en el examen?                                                    | content                          | organization |     0.860 |
| Q401 | Ist das WLAN-Passwort für Gäste irgendwo hinterlegt?                                   | organization                     | technical    |     0.962 |
| Q402 | Le mot de passe du wifi invité est affiché où ?                                        | organization                     | content      |     0.878 |
| Q404 | Ist die Formelsammlung im Moodle die aktuelle Version?                                 | organization                     | technical    |     0.580 |
| Q406 | Die Aufzeichnung von letzter Woche bricht bei mir nach fünf Minuten ab.                | technical                        | organization |     0.993 |
| Q407 | Gibt es zu Kapitel 5 weiterführende Literatur?                                         | content                          | organization |     0.992 |
| Q418 | Gibt es zur Regression auch eine Aufzeichnung aus dem letzten Semester?                | organization                     | content      |     0.999 |
| Q421 | Kann man im Stream auch Fragen stellen?                                                | organization                     | technical    |     0.951 |
| Q422 | Kommt Overfitting nur in der Übung oder auch in der Vorlesung dran?                    | organization                     | content      |     0.999 |
| Q428 | Do bonus points expire after this semester?                                            | organization                     | content      |     0.998 |
| Q430 | Is the sample size question from the exercise sheet graded?                            | organization                     | content      |     0.973 |
| Q431 | Where can I find the QR code if I arrive late?                                         | organization                     | technical    |     0.968 |
| Q408 | Gibt es dafür einen anderen Weg?                                                       | content (unsicher erwartet)      | content      |     0.567 |
| Q409 | Kann man das nochmal hochladen?                                                        | organization (unsicher erwartet) | technical    |     0.688 |
| Q410 | Is this going to be on it?                                                             | content (unsicher erwartet)      | organization |     0.939 |
| Q411 | Klappt irgendwie nicht.                                                                | technical (unsicher erwartet)    | technical    |     0.918 |
| Q412 | On peut décaler ?                                                                      | organization (unsicher erwartet) | organization |     0.901 |
| Q413 | Folie 17?                                                                              | content (unsicher erwartet)      | content      |     0.759 |
| Q414 | Danke, super erklärt!                                                                  | – (unsicher erwartet)            | content      |     0.971 |
| Q415 | lol                                                                                    | – (unsicher erwartet)            | content      |     0.685 |
| Q417 | ¡Gracias!                                                                              | – (unsicher erwartet)            | organization |     0.570 |
| Q432 | Ist das wichtig?                                                                       | content (unsicher erwartet)      | technical    |     0.806 |
| Q433 | Und was heißt das jetzt?                                                               | content (unsicher erwartet)      | content      |     0.909 |
| Q434 | Kommt das noch?                                                                        | content (unsicher erwartet)      | content      |     0.927 |
| Q435 | Wo finde ich das?                                                                      | organization (unsicher erwartet) | organization |     0.717 |
| Q436 | Geht das schon?                                                                        | technical (unsicher erwartet)    | technical    |     0.996 |
| Q437 | Wann ist das fällig?                                                                   | organization (unsicher erwartet) | organization |     0.953 |
| Q439 | Kann man das ändern?                                                                   | organization (unsicher erwartet) | organization |     0.706 |
| Q441 | Das verstehe ich nicht ganz.                                                           | content (unsicher erwartet)      | technical    |     0.993 |
| Q442 | Ist das so richtig?                                                                    | content (unsicher erwartet)      | organization |     0.565 |
| Q443 | Noch einmal, bitte?                                                                    | content (unsicher erwartet)      | content      |     0.999 |
| Q444 | Wird das noch hochgeladen?                                                             | organization (unsicher erwartet) | technical    |     0.940 |
| Q445 | Brauchen wir das für später?                                                           | content (unsicher erwartet)      | organization |     0.999 |
| Q447 | Funktioniert das bei euch?                                                             | technical (unsicher erwartet)    | content      |     0.687 |
| Q448 | Does that matter?                                                                      | content (unsicher erwartet)      | content      |     0.956 |
| Q449 | Where can I find it?                                                                   | organization (unsicher erwartet) | technical    |     0.673 |
| Q450 | Does this apply to us too?                                                             | organization (unsicher erwartet) | content      |     0.921 |
| Q451 | Can you repeat that?                                                                   | content (unsicher erwartet)      | content      |     0.608 |
| Q452 | How come?                                                                              | content (unsicher erwartet)      | technical    |     0.704 |
| Q453 | Until when?                                                                            | organization (unsicher erwartet) | organization |     0.972 |
| Q454 | Will that be uploaded?                                                                 | organization (unsicher erwartet) | organization |     0.710 |
| Q455 | Is it working for anyone else?                                                         | technical (unsicher erwartet)    | content      |     0.573 |
| Q456 | Do we need to know this?                                                               | content (unsicher erwartet)      | content      |     0.998 |
| Q457 | C'est important ?                                                                      | content (unsicher erwartet)      | content      |     0.898 |
| Q458 | Ça marche chez vous ?                                                                  | technical (unsicher erwartet)    | content      |     0.969 |
| Q459 | Jusqu'à quand ?                                                                        | organization (unsicher erwartet) | content      |     0.576 |
| Q462 | On doit savoir ça ?                                                                    | content (unsicher erwartet)      | content      |     0.756 |
| Q463 | C'est où ?                                                                             | organization (unsicher erwartet) | content      |     0.888 |
| Q464 | ¿Es importante?                                                                        | content (unsicher erwartet)      | organization |     0.745 |
| Q465 | ¿Hasta cuándo?                                                                         | organization (unsicher erwartet) | content      |     0.704 |
| Q466 | ¿Puede repetir?                                                                        | content (unsicher erwartet)      | content      |     0.758 |
| Q468 | ¿Dónde lo encuentro?                                                                   | organization (unsicher erwartet) | content      |     0.724 |
| Q469 | ¿Eso entra?                                                                            | content (unsicher erwartet)      | organization |     0.727 |
| Q470 | ¿A alguien más le funciona?                                                            | technical (unsicher erwartet)    | organization |     0.628 |
| Q472 | Super Vorlesung heute                                                                  | – (unsicher erwartet)            | organization |     0.795 |
| Q473 | Guten Morgen                                                                           | – (unsicher erwartet)            | organization |     0.975 |
| Q474 | Hahaha                                                                                 | – (unsicher erwartet)            | organization |     0.882 |
| Q475 | Test                                                                                   | – (unsicher erwartet)            | content      |     0.602 |
| Q478 | Sehr gut erklärt, danke                                                                | – (unsicher erwartet)            | content      |     0.728 |
| Q479 | Wer ist noch wach?                                                                     | – (unsicher erwartet)            | content      |     0.929 |
| Q480 | Mahlzeit                                                                               | – (unsicher erwartet)            | organization |     0.643 |
| Q481 | Thanks!                                                                                | – (unsicher erwartet)            | organization |     0.616 |
| Q482 | Great lecture                                                                          | – (unsicher erwartet)            | organization |     0.804 |
| Q483 | Good morning everyone                                                                  | – (unsicher erwartet)            | content      |     0.941 |
| Q484 | lmao                                                                                   | – (unsicher erwartet)            | technical    |     0.655 |
| Q486 | Nice                                                                                   | – (unsicher erwartet)            | technical    |     0.754 |
| Q488 | Who else is here?                                                                      | – (unsicher erwartet)            | organization |     0.577 |
| Q489 | Merci !                                                                                | – (unsicher erwartet)            | content      |     0.695 |
| Q490 | Bonjour à tous                                                                         | – (unsicher erwartet)            | organization |     0.888 |
| Q491 | Super cours                                                                            | – (unsicher erwartet)            | technical    |     0.576 |
| Q495 | Buenos días                                                                            | – (unsicher erwartet)            | content      |     0.551 |
| Q496 | Muy buena clase                                                                        | – (unsicher erwartet)            | content      |     0.748 |
| Q497 | jajaja                                                                                 | – (unsicher erwartet)            | organization |     0.579 |
| Q498 | Hola a todos                                                                           | – (unsicher erwartet)            | organization |     0.780 |

**Kaskade 1.3 (Gatekeeper + k-NN)** – 148 sicher, aber falsch bzw. trotz Mehrdeutigkeit akzeptiert

| ID   | Text                                                                                   | Gold                             | Vorhersage   | Konfidenz |
| ---- | -------------------------------------------------------------------------------------- | -------------------------------- | ------------ | --------: |
| Q003 | Could you walk us through another linear regression example?                           | content                          | technical    |     0.655 |
| Q009 | Can we do one more regression example step by step?                                    | content                          | organization |     0.987 |
| Q011 | ¿Podemos resolver otro ejercicio de regresión lineal?                                  | content                          | organization |     0.899 |
| Q013 | Können wir noch ein regression example machen?                                         | content                          | organization |     0.867 |
| Q015 | Muss ich den t-Test für die Prüfung können?                                            | content                          | organization |     0.999 |
| Q016 | Will hypothesis testing be on the final exam?                                          | content                          | organization |     0.889 |
| Q017 | ¿Entran los contrastes de hipótesis en el examen?                                      | content                          | organization |     0.874 |
| Q020 | Wird Kapitel 5 mit den Tests abgefragt?                                                | content                          | organization |     0.998 |
| Q021 | Will we be tested on the t-test?                                                       | content                          | organization |     0.911 |
| Q022 | Is chapter 5 on hypothesis tests examinable?                                           | content                          | organization |     0.633 |
| Q024 | Faut-il réviser le chapitre 5 pour l'examen ?                                          | content                          | organization |     0.762 |
| Q025 | ¿Hay que estudiar el capítulo 5 para el examen?                                        | content                          | organization |     1.000 |
| Q028 | Checkt jemand den p-Wert? Ich raff das nicht.                                          | content                          | technical    |     0.882 |
| Q046 | Overfitting?? check ich nicht                                                          | content                          | technical    |     0.600 |
| Q049 | Comment savoir si un modèle fait du surapprentissage ?                                 | content                          | organization |     0.960 |
| Q050 | Quelle différence entre surapprentissage et sous-apprentissage ?                       | content                          | organization |     0.723 |
| Q051 | ¿Qué diferencia hay entre sobreajuste y subajuste?                                     | content                          | technical    |     0.927 |
| Q053 | Den Schritt von Zeile 2 auf Zeile 3 in der Herleitung auf Folie 17 verstehe ich nicht. | content                          | technical    |     0.773 |
| Q059 | folie 17 zeile 3 versteh ich nicht                                                     | content                          | technical    |     0.977 |
| Q063 | En la diapositiva 17, ¿de dónde sale el cuadrado?                                      | content                          | organization |     0.870 |
| Q079 | What's the due date for problem set two?                                               | organization                     | content      |     0.791 |
| Q080 | Quelle est la date de rendu de la deuxième feuille d'exercices ?                       | organization                     | content      |     0.999 |
| Q086 | On doit rendre la feuille 2 quand ?                                                    | organization                     | content      |     0.978 |
| Q088 | ¿La entrega de la segunda hoja es el viernes?                                          | organization                     | content      |     0.989 |
| Q099 | La présence en cours est-elle obligatoire ?                                            | organization                     | content      |     0.811 |
| Q101 | ¿Pasan lista en clase?                                                                 | organization                     | technical    |     0.600 |
| Q112 | Où se passe l'examen de rattrapage ?                                                   | organization                     | content      |     0.996 |
| Q115 | Dürfen wir in der Klausur eine Formelsammlung benutzen?                                | organization                     | content      |     0.951 |
| Q116 | Ist ein Taschenrechner in der Prüfung erlaubt?                                         | organization                     | technical    |     0.727 |
| Q117 | Can we bring a cheat sheet to the exam?                                                | organization                     | content      |     0.800 |
| Q119 | Ist ein selbst geschriebener Spickzettel in der Klausur erlaubt?                       | organization                     | content      |     0.997 |
| Q120 | Welche Hilfsmittel sind in der Klausur zugelassen?                                     | organization                     | content      |     0.999 |
| Q124 | A-t-on droit à la calculatrice à l'examen ?                                            | organization                     | content      |     0.992 |
| Q126 | ¿Se permite llevar un formulario al examen?                                            | organization                     | content      |     0.600 |
| Q130 | Le cours de jeudi prochain est maintenu ?                                              | organization                     | content      |     0.948 |
| Q137 | Il y a cours jeudi malgré le jour férié ?                                              | organization                     | technical    |     0.974 |
| Q138 | ¿Se cancela la clase del jueves por el festivo?                                        | organization                     | content      |     0.940 |
| Q141 | Will the recording be uploaded afterwards?                                             | organization                     | content      |     0.984 |
| Q142 | Est-ce que le cours est enregistré ?                                                   | organization                     | content      |     0.985 |
| Q149 | ¿Se graba la clase de hoy?                                                             | organization                     | content      |     0.997 |
| Q150 | ¿Subirán la grabación a Moodle?                                                        | organization                     | technical    |     0.600 |
| Q153 | eduroam ist schon wieder komplett down                                                 | technical                        | content      |     0.760 |
| Q154 | The eduroam connection keeps dropping in here.                                         | technical                        | content      |     0.998 |
| Q155 | El wifi del aula se cae todo el rato.                                                  | technical                        | content      |     0.590 |
| Q160 | eduroam won't connect at all here.                                                     | technical                        | content      |     0.875 |
| Q162 | Impossible de se connecter à eduroam ici.                                              | technical                        | content      |     0.977 |
| Q165 | Hinten versteht man Sie kaum, das Mikro ist zu leise.                                  | technical                        | content      |     0.879 |
| Q173 | Could you turn the mic up a bit?                                                       | technical                        | content      |     0.828 |
| Q177 | Der Beamer schneidet die rechte Hälfte der Folie ab.                                   | technical                        | content      |     0.649 |
| Q178 | Die Projektion ist so blass, dass man die Formeln nicht lesen kann.                    | technical                        | content      |     0.995 |
| Q185 | The projector image keeps flickering.                                                  | technical                        | content      |     0.600 |
| Q186 | The projection is too faint to read.                                                   | technical                        | content      |     0.604 |
| Q189 | La imagen del proyector parpadea todo el rato.                                         | technical                        | content      |     0.968 |
| Q193 | Le vote ne s'affiche pas sur mon téléphone.                                            | technical                        | organization |     0.728 |
| Q197 | I can't vote, the button doesn't respond.                                              | technical                        | content      |     0.600 |
| Q200 | No puedo votar, el botón no responde.                                                  | technical                        | content      |     0.977 |
| Q201 | La encuesta no carga en mi móvil.                                                      | technical                        | content      |     0.927 |
| Q226 | how do i interpret a confidence interval                                               | content                          | organization |     0.745 |
| Q235 | Korrelation gleich Kausalität oder nicht?                                              | content                          | technical    |     0.800 |
| Q246 | Was genau sagt ein z-Wert von 2 aus?                                                   | content                          | technical    |     0.728 |
| Q249 | How do I compute a z-score?                                                            | content                          | organization |     1.000 |
| Q252 | Comment calcule-t-on le score z ?                                                      | content                          | organization |     0.965 |
| Q256 | Wie rechnet man den z-score aus?                                                       | content                          | organization |     0.989 |
| Q257 | Wie groß muss meine Stichprobe mindestens sein?                                        | content                          | organization |     0.830 |
| Q258 | Woher weiß ich, wie viele Personen ich befragen muss?                                  | content                          | organization |     0.997 |
| Q260 | Gibt es eine Faustregel für die Stichprobengröße?                                      | content                          | organization |     1.000 |
| Q262 | How large does my sample need to be?                                                   | content                          | technical    |     0.997 |
| Q263 | How do we calculate the required sample size?                                          | content                          | organization |     0.997 |
| Q264 | Is there a rule of thumb for sample size?                                              | content                          | organization |     0.909 |
| Q268 | ¿Cuántas personas hay que encuestar como mínimo?                                       | content                          | organization |     0.945 |
| Q270 | Wie setzt sich die Note zusammen?                                                      | organization                     | content      |     0.858 |
| Q275 | Do the exercise sheets count towards the grade?                                        | organization                     | content      |     0.987 |
| Q278 | Les exercices comptent-ils dans la note ?                                              | organization                     | content      |     1.000 |
| Q279 | ¿Cómo se calcula la nota final?                                                        | organization                     | technical    |     0.847 |
| Q280 | ¿Cuentan las hojas de ejercicios para la nota?                                         | organization                     | content      |     0.893 |
| Q297 | Ich hab eine Überschneidung, darf ich die Übungsgruppe tauschen?                       | organization                     | content      |     0.600 |
| Q303 | Est-ce qu'on peut changer de groupe de TD ?                                            | organization                     | content      |     0.999 |
| Q304 | J'ai un conflit d'horaire, je peux changer de TD ?                                     | organization                     | content      |     1.000 |
| Q305 | ¿Puedo cambiarme a otro grupo de prácticas?                                            | organization                     | content      |     0.922 |
| Q306 | Tengo un solapamiento, ¿puedo cambiar de grupo de prácticas?                           | organization                     | content      |     1.000 |
| Q313 | Can I book a slot in your office hours?                                                | organization                     | technical    |     0.882 |
| Q315 | Quand sont vos heures de permanence ?                                                  | organization                     | content      |     0.954 |
| Q316 | Peut-on prendre rendez-vous pour une permanence ?                                      | organization                     | content      |     0.925 |
| Q317 | ¿Cuándo tiene horario de atención?                                                     | organization                     | content      |     0.800 |
| Q318 | ¿Puedo pedir cita para su horario de atención?                                         | organization                     | content      |     0.685 |
| Q322 | Seit heute Morgen kann ich mich nicht mehr einloggen.                                  | technical                        | organization |     1.000 |
| Q326 | My password isn't accepted on the learning platform.                                   | technical                        | organization |     0.999 |
| Q328 | La connexion unique tourne en boucle.                                                  | technical                        | content      |     0.888 |
| Q334 | Die Übertragung für die Leute zu Hause ist abgebrochen.                                | technical                        | organization |     0.997 |
| Q339 | The broadcast for people at home has dropped.                                          | technical                        | organization |     0.804 |
| Q340 | Le direct se fige tout le temps.                                                       | technical                        | organization |     0.600 |
| Q342 | La transmisión en directo se congela.                                                  | technical                        | content      |     0.996 |
| Q343 | En el streaming solo se ve negro.                                                      | technical                        | content      |     0.599 |
| Q355 | Mi móvil no reconoce el código QR.                                                     | technical                        | content      |     0.741 |
| Q356 | El código QR es demasiado pequeño desde atrás.                                         | technical                        | content      |     0.962 |
| Q357 | Die Steckdosen in Reihe 12 haben keinen Strom.                                         | technical                        | organization |     0.639 |
| Q358 | Gibt es hier irgendwo funktionierende Steckdosen? Mein Akku ist leer.                  | technical                        | organization |     0.964 |
| Q359 | Die Steckdosenleiste unter den Tischen ist tot.                                        | technical                        | organization |     0.995 |
| Q363 | My laptop won't charge from the desk outlets.                                          | technical                        | content      |     0.997 |
| Q364 | None of the outlets under the desks have power.                                        | technical                        | content      |     0.948 |
| Q365 | Les prises de la rangée 12 ne marchent pas.                                            | technical                        | content      |     0.905 |
| Q367 | Los enchufes de la fila 12 no funcionan.                                               | technical                        | content      |     0.908 |
| Q369 | Das Licht im hinteren Teil des Hörsaals ist ausgefallen.                               | technical                        | content      |     0.900 |
| Q377 | La lumière au fond de l'amphi ne marche plus.                                          | technical                        | content      |     0.726 |
| Q379 | Las luces del fondo del aula no funcionan.                                             | technical                        | content      |     0.660 |
| Q380 | Las luces del techo parpadean todo el rato.                                            | technical                        | content      |     0.990 |
| Q382 | Le score z sera-t-il à l'examen ?                                                      | content                          | organization |     0.993 |
| Q383 | ¿Entra la puntuación z en el examen?                                                   | content                          | organization |     0.998 |
| Q385 | Les points bonus comptent-ils aussi pour le rattrapage ?                               | organization                     | technical    |     0.902 |
| Q388 | Can we use the office hours to go over the p-value example?                            | organization                     | content      |     1.000 |
| Q389 | Peut-on venir en permanence pour parler de Bayes ?                                     | organization                     | content      |     0.685 |
| Q390 | ¿Puedo ir a su horario de atención para preguntar sobre Bayes?                         | organization                     | content      |     0.966 |
| Q392 | Are the slides with the regression examples uploaded yet?                              | organization                     | technical    |     0.967 |
| Q393 | Les diapos de la régression sont-elles déjà en ligne ?                                 | organization                     | content      |     1.000 |
| Q396 | Faut-il s'inscrire sur Moodle pour le TD ?                                             | organization                     | technical    |     0.987 |
| Q397 | ¿Hay que apuntarse en Moodle para el grupo de prácticas?                               | organization                     | technical    |     0.941 |
| Q400 | ¿La correlación entra en el examen?                                                    | content                          | organization |     0.860 |
| Q401 | Ist das WLAN-Passwort für Gäste irgendwo hinterlegt?                                   | organization                     | technical    |     0.962 |
| Q402 | Le mot de passe du wifi invité est affiché où ?                                        | organization                     | content      |     0.878 |
| Q404 | Ist die Formelsammlung im Moodle die aktuelle Version?                                 | organization                     | technical    |     0.800 |
| Q406 | Die Aufzeichnung von letzter Woche bricht bei mir nach fünf Minuten ab.                | technical                        | organization |     0.993 |
| Q407 | Gibt es zu Kapitel 5 weiterführende Literatur?                                         | content                          | organization |     0.992 |
| Q418 | Gibt es zur Regression auch eine Aufzeichnung aus dem letzten Semester?                | organization                     | content      |     0.999 |
| Q421 | Kann man im Stream auch Fragen stellen?                                                | organization                     | technical    |     0.951 |
| Q422 | Kommt Overfitting nur in der Übung oder auch in der Vorlesung dran?                    | organization                     | content      |     0.999 |
| Q428 | Do bonus points expire after this semester?                                            | organization                     | content      |     0.998 |
| Q430 | Is the sample size question from the exercise sheet graded?                            | organization                     | content      |     0.973 |
| Q431 | Where can I find the QR code if I arrive late?                                         | organization                     | technical    |     0.968 |
| Q408 | Gibt es dafür einen anderen Weg?                                                       | content (unsicher erwartet)      | content      |     0.600 |
| Q410 | Is this going to be on it?                                                             | content (unsicher erwartet)      | organization |     0.939 |
| Q411 | Klappt irgendwie nicht.                                                                | technical (unsicher erwartet)    | technical    |     0.800 |
| Q435 | Wo finde ich das?                                                                      | organization (unsicher erwartet) | organization |     0.600 |
| Q436 | Geht das schon?                                                                        | technical (unsicher erwartet)    | technical    |     0.600 |
| Q437 | Wann ist das fällig?                                                                   | organization (unsicher erwartet) | organization |     0.600 |
| Q439 | Kann man das ändern?                                                                   | organization (unsicher erwartet) | organization |     0.600 |
| Q441 | Das verstehe ich nicht ganz.                                                           | content (unsicher erwartet)      | technical    |     0.800 |
| Q442 | Ist das so richtig?                                                                    | content (unsicher erwartet)      | organization |     0.600 |
| Q445 | Brauchen wir das für später?                                                           | content (unsicher erwartet)      | organization |     0.600 |
| Q450 | Does this apply to us too?                                                             | organization (unsicher erwartet) | content      |     0.921 |
| Q455 | Is it working for anyone else?                                                         | technical (unsicher erwartet)    | content      |     0.573 |
| Q456 | Do we need to know this?                                                               | content (unsicher erwartet)      | content      |     0.998 |
| Q457 | C'est important ?                                                                      | content (unsicher erwartet)      | content      |     0.600 |
| Q463 | C'est où ?                                                                             | organization (unsicher erwartet) | content      |     0.600 |
| Q473 | Guten Morgen                                                                           | – (unsicher erwartet)            | organization |     0.800 |
| Q475 | Test                                                                                   | – (unsicher erwartet)            | content      |     0.600 |
| Q479 | Wer ist noch wach?                                                                     | – (unsicher erwartet)            | content      |     0.600 |
| Q485 | test 123                                                                               | – (unsicher erwartet)            | content      |     0.600 |
| Q486 | Nice                                                                                   | – (unsicher erwartet)            | technical    |     1.000 |

## Gültigkeitsgrenzen

- Synthetisches, kleines Referenzset (Bootstrap-Intervalle beachten); keine Aussage über reale Hörsaalverteilung.
- Konfidenz ist ohne Kalibrierung keine Erfolgswahrscheinlichkeit (siehe ECE).
- Gemessen ist die In-Process-Klassifikation, nicht Queue, Persistenz oder Worker-Latenz.
