# Referat 2B – Themenmessung 1.14c (Encoder vs. lexikalisch)

Commit `84a5614ead76` (v1.3.0-326-g84a5614e-dirty), Referenzset 2.2.0 (SHA-256 `717bdb17dc2e94d5…`), 2026-11-04T17:11:33.747Z
Modell `intfloat/multilingual-e5-small` / `intfloat/multilingual-e5-small@sha256:f80102d3f2a1229f`, 384 Dimensionen · Container-Limits cpus=1000000000 mem=2147483648 · loopback HTTP http://127.0.0.1:8790/embed (Labor; Produktion: Unix-Socket, network_mode none)

Umfang: 500 von 723 Items, Domäne statistics, Sprachen de, en, fr, es (+ mixed). Italienisch ausgeschlossen, weil die Wortwolke es nicht unterstützt (WORD_CLOUD_LEMMA_LOCALES).

Goldstandard: Themenfamilien des Referenzsets; Near-Miss-, mehrdeutige und Rausch-Items sind Einzelthemen.

## 1. Hauptergebnis

| Teilmenge                                  |   n | System      |   ARI |   NMI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 (Gold) | Falsch-Merge-Paare | Paar-Recall einsprachig | Paar-Recall sprachübergreifend |
| ------------------------------------------ | --: | ----------- | ----: | ----: | -------: | -------: | --------: | ---------------- | -----------------: | ----------------------: | -----------------------------: |
| Gesamtset (de/en/fr/es), Session-Locale de | 500 | Encoder     | 0.201 | 0.815 |   76.2 % |   36.5 % |    49.4 % | 156 (38)         |                197 |                  35.1 % |                          6.7 % |
| Gesamtset (de/en/fr/es), Session-Locale de | 500 | Lexikalisch | 0.183 | 0.773 |   65.1 % |   38.1 % |    48.1 % | 88 (38)          |                758 |                  32.2 % |                          9.8 % |
| nur Deutsch                                | 201 | Encoder     | 0.411 | 0.876 |   75.4 % |   60.6 % |    67.2 % | 56 (30)          |                 86 |                  34.0 % |                              – |
| nur Deutsch                                | 201 | Lexikalisch | 0.295 | 0.853 |   73.1 % |   58.6 % |    65.0 % | 38 (30)          |                211 |                  30.7 % |                              – |
| nur Englisch                               | 120 | Encoder     | 0.526 | 0.919 |   83.1 % |   73.9 % |    78.2 % | 37 (30)          |                 29 |                  47.8 % |                              – |
| nur Englisch                               | 120 | Lexikalisch | 0.289 | 0.866 |   67.3 % |   70.6 % |    68.9 % | 22 (30)          |                119 |                  41.1 % |                              – |
| nur Französisch ⚠                          |  82 | Encoder     | 0.266 | 0.866 |   55.9 % |   84.1 % |    67.2 % | 23 (30)          |                 76 |                  56.7 % |                              – |
| nur Französisch                            |  82 | Lexikalisch | 0.212 | 0.892 |   71.0 % |   78.0 % |    74.4 % | 15 (30)          |                 66 |                  40.0 % |                              – |
| nur Spanisch ⚠                             |  81 | Encoder     | 0.392 | 0.912 |   71.5 % |   85.2 % |    77.7 % | 26 (30)          |                 42 |                  60.0 % |                              – |
| nur Spanisch                               |  81 | Lexikalisch | 0.235 | 0.881 |   66.4 % |   80.2 % |    72.7 % | 18 (30)          |                 70 |                  46.7 % |                              – |

† Nicht aussagekräftig: In dieser Teilmenge hat keine Familie zwei Mitglieder derselben Sprache. ARI ist dann 0, BCubed belohnt bloßes Nicht-Zusammenfassen. Nur Gesamtset und Deutsch tragen eine Aussage; für Einsprachigkeit in en/fr/es wären mehr Items je Sprache nötig.

⚠ Session-Locale nicht in `WORD_CLOUD_SEMANTIC_LOCALES` (de, en): Das Produkt ruft den Encoder dort **nicht** auf und zeigt den lexikalischen Fallback. Encoderwerte zeigen nur das ungenutzte Potenzial.

### Stabilität über die Batch-Zusammensetzung

Das Embedding einer Frage hängt von den anderen Texten derselben Anfrage ab (Vektor-Drift 1 − cos: Median 3.1e-3, max 1.3e-2). Vermutete Ursache: quantisiertes ONNX-Modell (nicht verifiziert). Tabelle 1 oben zeigt **eine** Gesamtanfrage; hier 10 Läufe mit zufälliger Reihenfolge und Anfragegrößen 5–40 (simuliert inkrementelles Einbetten). Werte: Median [min–max].

| Teilmenge                                  | Encoder ARI         | Encoder BCubed F1      | Falsch-Merge-Paare | Themen ≥2     | Lexikalisch ARI (deterministisch) |
| ------------------------------------------ | ------------------- | ---------------------- | ------------------ | ------------- | --------------------------------: |
| Gesamtset (de/en/fr/es), Session-Locale de | 0.206 [0.186–0.225] | 49.7 % [48.6 %–50.9 %] | 201 [186–232]      | 155 [149–158] |                             0.183 |
| nur Deutsch                                | 0.438 [0.404–0.485] | 68.6 % [67.0 %–70.7 %] | 81 [66–90]         | 57 [54–58]    |                             0.295 |
| nur Englisch                               | 0.532 [0.517–0.568] | 78.4 % [77.6 %–79.9 %] | 27 [21–27]         | 39 [36–40]    |                             0.289 |
| nur Französisch                            | 0.222 [0.179–0.260] | 67.1 % [64.4 %–68.3 %] | 92 [76–103]        | 23 [21–24]    |                             0.212 |
| nur Spanisch                               | 0.381 [0.321–0.438] | 76.4 % [74.3 %–78.5 %] | 33 [27–44]         | 25 [24–27]    |                             0.235 |

## 2. Produktansicht (Gate, Top-12, Status)

| Teilmenge                                  | Gate bestanden | Status            | angezeigte Themen | davon ≥2 Mitglieder | Anteil Fragen in angezeigten Mehrfach-Themen |
| ------------------------------------------ | :------------: | ----------------- | ----------------: | ------------------: | -------------------------------------------: |
| Gesamtset (de/en/fr/es), Session-Locale de |       ✓        | ready             |                12 |                  12 |                                       13.2 % |
| nur Deutsch                                |       ✓        | ready             |                12 |                  12 |                                       26.9 % |
| nur Englisch                               |       ✓        | ready             |                12 |                  12 |                                       31.7 % |
| nur Französisch                            |       ✓        | fallback (Locale) |                12 |                  12 |                                       56.1 % |
| nur Spanisch                               |       ✓        | fallback (Locale) |                12 |                  12 |                                       44.4 % |

## 3. Ähnlichkeitsverteilung (Kosinus, Gesamtset)

| Paare                                      |      n |   min |   p10 | Median |   p90 |   max |
| ------------------------------------------ | -----: | ----: | ----: | -----: | ----: | ----: |
| gleiche Familie                            |   2203 | 0.732 | 0.791 |  0.848 | 0.907 | 0.968 |
| verschiedene Familien                      | 122547 | 0.638 | 0.741 |  0.781 | 0.825 | 0.966 |
| verschiedene Familien, gleicher Satzrahmen |      3 | 0.856 | 0.856 |  0.857 | 0.861 | 0.861 |

Paare verschiedener Familien ≥ 0.87: 1267 · Paare gleicher Familie < 0.87: 1488 von 2203

## 4. Schwellen-Sweep (Encoder)

**Gesamtset (de/en/fr/es), Session-Locale de**

| Schwelle |   ARI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 | Falsch-Merge-Paare | Paar-Recall sprachübergr. |
| -------: | ----: | -------: | -------: | --------: | --------: | -----------------: | ------------------------: |
|     0.80 | 0.280 |   48.6 % |   49.0 % |    48.8 % |        75 |               1576 |                    24.3 % |
|     0.82 | 0.285 |   58.6 % |   44.6 % |    50.7 % |       105 |                804 |                    17.2 % |
|     0.84 | 0.243 |   64.6 % |   40.5 % |    49.8 % |       122 |                521 |                    10.8 % |
|     0.85 | 0.241 |   68.3 % |   39.7 % |    50.2 % |       133 |                391 |                     9.9 % |
|     0.86 | 0.227 |   71.4 % |   38.4 % |    50.0 % |       146 |                273 |                     8.5 % |
|   0.87 ◀ | 0.201 |   76.2 % |   36.5 % |    49.4 % |       156 |                197 |                     6.7 % |
|     0.88 | 0.167 |   78.7 % |   34.7 % |    48.2 % |       159 |                159 |                     5.0 % |
|     0.89 | 0.140 |   83.5 % |   33.3 % |    47.6 % |       154 |                111 |                     3.8 % |
|     0.90 | 0.119 |   89.6 % |   32.0 % |    47.2 % |       127 |                 69 |                     2.7 % |
|     0.92 | 0.065 |   94.6 % |   29.7 % |    45.2 % |        81 |                 30 |                     1.8 % |

**nur Deutsch**

| Schwelle |   ARI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 | Falsch-Merge-Paare | Paar-Recall sprachübergr. |
| -------: | ----: | -------: | -------: | --------: | --------: | -----------------: | ------------------------: |
|     0.80 | 0.279 |   40.3 % |   76.3 % |    52.7 % |        29 |                747 |                         – |
|     0.82 | 0.386 |   52.7 % |   73.1 % |    61.3 % |        42 |                364 |                         – |
|     0.84 | 0.394 |   60.5 % |   70.7 % |    65.2 % |        44 |                303 |                         – |
|     0.85 | 0.424 |   67.6 % |   65.6 % |    66.6 % |        53 |                161 |                         – |
|     0.86 | 0.439 |   71.6 % |   64.0 % |    67.6 % |        57 |                114 |                         – |
|   0.87 ◀ | 0.411 |   75.4 % |   60.6 % |    67.2 % |        56 |                 86 |                         – |
|     0.88 | 0.389 |   80.5 % |   58.0 % |    67.4 % |        57 |                 61 |                         – |
|     0.89 | 0.343 |   85.8 % |   54.4 % |    66.6 % |        53 |                 37 |                         – |
|     0.90 | 0.313 |   90.4 % |   52.4 % |    66.4 % |        47 |                 23 |                         – |
|     0.92 | 0.139 |   98.0 % |   44.9 % |    61.6 % |        23 |                  4 |                         – |

**Sweep über 10 inkrementelle Läufe** – BCubed F1 bzw. Falsch-Merge-Paare, Median [min–max]

| Schwelle | Gesamtset F1           | Gesamtset Falsch-Merges | Deutsch F1             | Deutsch Falsch-Merges |
| -------: | ---------------------- | ----------------------- | ---------------------- | --------------------- |
|     0.80 | 48.9 % [47.1 %–51.8 %] | 1550 [1157–1658]        | 50.8 % [47.1 %–54.6 %] | 729 [656–856]         |
|     0.82 | 50.5 % [49.1 %–52.3 %] | 808 [727–929]           | 59.6 % [57.5 %–62.2 %] | 442 [364–489]         |
|     0.84 | 50.6 % [49.6 %–51.9 %] | 484 [465–552]           | 64.7 % [63.0 %–67.1 %] | 255 [235–286]         |
|     0.85 | 50.5 % [49.9 %–51.7 %] | 373 [345–421]           | 66.5 % [64.2 %–69.5 %] | 180 [134–201]         |
|     0.86 | 50.5 % [49.8 %–51.6 %] | 261 [243–320]           | 69.0 % [66.0 %–70.5 %] | 113 [95–128]          |
|   0.87 ◀ | 49.7 % [48.6 %–50.9 %] | 201 [186–232]           | 68.6 % [67.0 %–70.7 %] | 81 [66–90]            |
|     0.88 | 48.8 % [48.0 %–49.3 %] | 154 [128–159]           | 68.2 % [67.0 %–69.1 %] | 49 [41–58]            |
|     0.89 | 48.0 % [47.4 %–48.4 %] | 102 [88–110]            | 67.2 % [66.7 %–68.7 %] | 33 [30–37]            |
|     0.90 | 47.4 % [47.0 %–47.9 %] | 63 [52–73]              | 67.3 % [66.2 %–68.1 %] | 18 [14–21]            |
|     0.92 | 45.5 % [45.3 %–45.7 %] | 28 [22–33]              | 61.9 % [61.6 %–62.5 %] | 5 [4–7]               |

## 5. Gefundene Themen im Gesamtset (eine Gesamtanfrage)

**Encoder** (nur Themen mit ≥ 2 Mitgliedern; ✗ = mischt Familien)

| Label                                                                   | Konfidenz | Mitglieder                         | Familien                                           |
| ----------------------------------------------------------------------- | --------: | ---------------------------------- | -------------------------------------------------- |
| Do we need to know this?                                                |     0.958 | Q456, Q462                         | ✗ S-AMB2-25, S-AMB2-31                             |
| Danke, super erklärt!                                                   |     0.947 | Q414, Q478                         | ✗ S-NOISE-1, S-NOISE2-08                           |
| folie 17 zeile 3 versteh ich nicht                                      |     0.943 | Q053, Q059                         | C-DERIV                                            |
| Quelle est la date de rendu de la deuxième feuille d'exercices ?        |     0.941 | Q080, Q086                         | O-DEAD                                             |
| Il y a cours jeudi malgré le jour férié ?                               |     0.941 | Q130, Q137                         | O-CANC                                             |
| Wird das noch hochgeladen?                                              |      0.94 | Q409, Q444                         | ✗ S-AMB-2, S-AMB2-13                               |
| La lumière au fond de l'amphi ne marche plus.                           |      0.94 | Q161, Q377                         | ✗ T-WIFI, T-LIGHT                                  |
| ¿La entrega de la segunda hoja es el viernes?                           |     0.938 | Q087, Q088                         | O-DEAD                                             |
| No entiendo cómo interpretar el valor p.                                |     0.942 | Q034, Q030, Q039                   | C-PVAL                                             |
| Wird in der Vorlesung die Anwesenheit kontrolliert?                     |     0.936 | Q090, Q095                         | O-ATT                                              |
| Mon ordinateur ne charge pas sur les prises des tables.                 |     0.935 | Q363, Q366                         | T-POWER                                            |
| The lecture slides file on Moodle seems corrupted.                      |     0.935 | Q205, Q211                         | T-PDF                                              |
| We can't hear you at the back, the mic seems off.                       |     0.931 | Q167, Q172                         | T-AUDIO                                            |
| The livestream keeps freezing.                                          |     0.931 | Q337, Q344                         | T-STREAM                                           |
| Was bedeutet ein 95-%-Konfidenzintervall eigentlich genau?              |      0.93 | Q219, Q220                         | C-CI                                               |
| z-Transformation nochmal erklären?                                      |     0.928 | Q248, Q381                         | ✗ C-NORM, N-ZEXAM                                  |
| eduroam won't connect at all here.                                      |     0.946 | Q154, Q160, Q162                   | T-WIFI                                             |
| ¿Dónde se hará la recuperación?                                         |     0.928 | Q113, Q114                         | O-ROOM                                             |
| Where can I find it?                                                    |     0.928 | Q435, Q449                         | ✗ S-AMB2-04, S-AMB2-18                             |
| ¿Se cancela la clase del jueves por el festivo?                         |     0.927 | Q131, Q138                         | O-CANC                                             |
| Scanning the code does nothing.                                         |     0.925 | Q348, Q352                         | T-QR                                               |
| Les prises de la rangée 12 ne marchent pas.                             |     0.924 | Q362, Q365                         | T-POWER                                            |
| Will correlation vs causation be part of the exam?                      |     0.929 | Q238, Q237, Q398                   | ✗ C-CORR, N-CORREXAM                               |
| Super cours                                                             |     0.921 | Q472, Q491                         | ✗ S-NOISE2-02, S-NOISE2-21                         |
| Das Bild vom Projektor flackert die ganze Zeit.                         |     0.919 | Q183, Q370                         | ✗ T-BEAM, T-LIGHT                                  |
| Kann ich in eine andere Tutoriumsgruppe wechseln?                       |     0.924 | Q299, Q295, Q296                   | O-TUT                                              |
| ¿Es importante?                                                         |     0.934 | Q432, Q457, Q464                   | ✗ S-AMB2-01, S-AMB2-26, S-AMB2-33                  |
| Stichprobengröße berechnen – wie?                                       |     0.936 | Q259, Q261, Q257, Q260             | C-SAMPLE                                           |
| ¿Puede repetir?                                                         |     0.925 | Q460, Q451, Q466                   | ✗ S-AMB2-29, S-AMB2-20, S-AMB2-35                  |
| Wie lese ich die Tabelle der Standardnormalverteilung ab?               |     0.917 | Q245, Q247                         | C-NORM                                             |
| Der Stream hängt zwei Minuten hinterher.                                |     0.917 | Q332, Q335                         | T-STREAM                                           |
| Le vidéoprojecteur coupe le bas des diapos.                             |     0.916 | Q187, Q188                         | T-BEAM                                             |
| What does a z-score of 2 mean?                                          |     0.915 | Q249, Q251                         | C-NORM                                             |
| Will the recording be uploaded afterwards?                              |     0.915 | Q141, Q147                         | O-REC                                              |
| Wann kommt die Aufzeichnung von heute ins Moodle?                       |     0.914 | Q140, Q144                         | O-REC                                              |
| Ich komme mit dem Sitzungscode nicht in die Umfrage rein.               |     0.914 | Q191, Q319                         | ✗ T-VOTE, T-LOGIN                                  |
| Combien de personnes faut-il interroger au minimum ?                    |     0.914 | Q266, Q268                         | C-SAMPLE                                           |
| Wird Kapitel 5 mit den Tests abgefragt?                                 |     0.914 | Q020, Q407                         | ✗ C-HYP, S-CH5-READING                             |
| Bei uns in Reihe 15 ist das Licht aus und lässt sich nicht einschalten. |     0.912 | Q357, Q372                         | ✗ T-POWER, T-LIGHT                                 |
| Merci !                                                                 |     0.921 | Q417, Q481, Q471, Q489             | ✗ S-NOISE-4, S-NOISE2-11, S-NOISE2-01, S-NOISE2-19 |
| Die Übertragung für die Leute zu Hause ist abgebrochen.                 |     0.911 | Q334, Q339                         | T-STREAM                                           |
| Pouvez-vous donner un exemple concret du théorème de Bayes ?            |     0.916 | Q389, Q074, Q075                   | ✗ N-OFFICECONTENT, C-BAYES                         |
| Est-ce qu'on peut changer de groupe de TD ?                             |     0.927 | Q396, Q303, Q304                   | ✗ N-TUTMOODLE, O-TUT                               |
| Wie interpretiere ich das Konfidenzintervall aus der Übung?             |     0.924 | Q221, Q424, Q222, Q223             | ✗ C-CI, S-NM-07                                    |
| Une forte corrélation implique-t-elle une causalité ?                   |     0.926 | Q241, Q240, Q399                   | ✗ C-CORR, N-CORREXAM                               |
| Do the exercise sheets count towards the grade?                         |     0.907 | Q275, Q430                         | ✗ O-GRADE, S-NM-13                                 |
| What's the due date for problem set two?                                |     0.906 | Q079, Q084                         | O-DEAD                                             |
| Kann man die Sprechstunde auch für Fragen zu Bayes nutzen?              |     0.905 | Q070, Q387                         | ✗ C-BAYES, N-OFFICECONTENT                         |
| My password isn't accepted on the learning platform.                    |     0.905 | Q321, Q326                         | T-LOGIN                                            |
| The projector image keeps flickering.                                   |     0.904 | Q185, Q375                         | ✗ T-BEAM, T-LIGHT                                  |
| Quelle différence entre surapprentissage et sous-apprentissage ?        |     0.904 | Q049, Q050                         | C-OVF                                              |
| Wann ist das fällig?                                                    |     0.903 | Q082, Q437                         | ✗ O-DEAD, S-AMB2-06                                |
| Les points bonus comptent-ils aussi pour le rattrapage ?                |     0.903 | Q112, Q385                         | ✗ O-ROOM, N-BONUSRETAKE                            |
| On ne voit qu'un écran noir sur le stream.                              |     0.915 | Q343, Q333, Q338, Q341             | T-STREAM                                           |
| How do we calculate the required sample size?                           |     0.911 | Q264, Q262, Q263                   | C-SAMPLE                                           |
| Zählen die Übungsblätter zur Endnote?                                   |     0.902 | Q269, Q281                         | O-GRADE                                            |
| Where is the resit exam being held?                                     |     0.901 | Q104, Q111                         | O-ROOM                                             |
| Ist die Prüfungsanmeldung schon offen?                                  |       0.9 | Q283, Q284                         | O-REG                                              |
| Can I switch to a different tutorial group?                             |     0.919 | Q301, Q300, Q302                   | O-TUT                                              |
| Ist attendance hier Pflicht?                                            |       0.9 | Q094, Q102                         | O-ATT                                              |
| Can we bring a cheat sheet to the exam?                                 |       0.9 | Q098, Q117                         | ✗ O-ATT, O-AIDS                                    |
| Will we be tested on the t-test?                                        |     0.899 | Q021, Q426                         | ✗ C-HYP, S-NM-09                                   |
| Sind die Hypothesentests aus Kapitel 5 klausurrelevant?                 |      0.91 | Q026, Q014, Q019                   | C-HYP                                              |
| Ist die Formelsammlung im Moodle die aktuelle Version?                  |     0.899 | Q115, Q404                         | ✗ O-AIDS, S-FORMULA-VERSION                        |
| Why do we standardize the normal distribution?                          |     0.899 | Q250, Q255                         | C-NORM                                             |
| Das voting lädt nicht                                                   |     0.899 | Q202, Q361                         | ✗ T-VOTE, T-POWER                                  |
| Test                                                                    |     0.898 | Q475, Q485                         | ✗ S-NOISE2-05, S-NOISE2-15                         |
| Die Projektion ist so blass, dass man die Formeln nicht lesen kann.     |     0.901 | Q371, Q178, Q184                   | ✗ T-LIGHT, T-BEAM                                  |
| einloggen klappt nicht, fehlermeldung                                   |     0.898 | Q323, Q331                         | T-LOGIN                                            |
| Gilt das auch für uns?                                                  |     0.898 | Q438, Q447                         | ✗ S-AMB2-07, S-AMB2-16                             |
| El inicio de sesión se queda en bucle.                                  |     0.897 | Q330, Q342                         | ✗ T-LOGIN, T-STREAM                                |
| Are the lectures being recorded?                                        |     0.897 | Q097, Q146                         | ✗ O-ATT, O-REC                                     |
| Jusqu'à quand ?                                                         |     0.912 | Q465, Q453, Q459                   | ✗ S-AMB2-34, S-AMB2-22, S-AMB2-28                  |
| On slide 17, how do you get from the second line to the third?          |     0.897 | Q055, Q062                         | C-DERIV                                            |
| Gibt es zur Regression auch eine Aufzeichnung aus dem letzten Semester? |     0.896 | Q403, Q418                         | ✗ S-REG-EXAM, S-NM-01                              |
| Hahaha                                                                  |     0.896 | Q474, Q484                         | ✗ S-NOISE2-04, S-NOISE2-14                         |
| Pourquoi ?                                                              |      0.92 | Q452, Q446, Q461, Q467             | ✗ S-AMB2-21, S-AMB2-15, S-AMB2-30, S-AMB2-36       |
| Bonuspunkte – wie viele maximal?                                        |     0.904 | Q384, Q271, Q273                   | ✗ N-BONUSRETAKE, O-GRADE                           |
| Das PDF mit den Folien ist kaputt.                                      |     0.918 | Q209, Q203, Q208                   | T-PDF                                              |
| Hola a todos                                                            |     0.921 | Q416, Q490, Q498                   | ✗ S-NOISE-3, S-NOISE2-20, S-NOISE2-28              |
| ¿Eso entra?                                                             |     0.895 | Q468, Q469                         | ✗ S-AMB2-37, S-AMB2-38                             |
| My university account won't let me log into Moodle.                     |     0.924 | Q214, Q329, Q213, Q324, Q327       | ✗ T-PDF, T-LOGIN                                   |
| 👍                                                                      |     0.894 | Q476, Q497                         | ✗ S-NOISE2-06, S-NOISE2-27                         |
| There's no Wi-Fi signal in this room.                                   |     0.894 | Q159, Q364                         | ✗ T-WIFI, T-POWER                                  |
| Darf man den Taschenrechner mit Grafikfunktion mitnehmen?               |     0.893 | Q116, Q121                         | O-AIDS                                             |
| Guten Morgen                                                            |     0.893 | Q473, Q483                         | ✗ S-NOISE2-03, S-NOISE2-13                         |
| Does that matter?                                                       |     0.893 | Q448, Q450                         | ✗ S-AMB2-17, S-AMB2-19                             |
| Muy buena clase                                                         |     0.893 | Q496, Q500                         | ✗ S-NOISE2-26, S-NOISE2-30                         |
| ¿Es obligatorio venir a todas las clases?                               |     0.892 | Q093, Q101                         | O-ATT                                              |
| The slides PDF won't open, it says the file is damaged.                 |     0.892 | Q210, Q212                         | T-PDF                                              |
| ¿Puede repetir la derivación de la diapositiva 17?                      |     0.891 | Q063, Q064                         | C-DERIV                                            |
| Wie berechne ich den z-Wert?                                            |     0.917 | Q246, Q244, Q256                   | C-NORM                                             |
| ¿Puedo pedir cita para su horario de atención?                          |     0.908 | Q390, Q317, Q318                   | ✗ N-OFFICECONTENT, O-OFFICE                        |
| The formula on slide 12 has a mistake, right?                           |     0.911 | Q216, Q217, Q215, Q218             | S-SLIDE-TYPO                                       |
| how do i interpret a confidence interval                                |     0.901 | Q231, Q226, Q230                   | C-CI                                               |
| Are there bonus points for homework?                                    |      0.89 | Q276, Q428                         | ✗ O-GRADE, S-NM-11                                 |
| Die Aufzeichnung von letzter Woche bricht bei mir nach fünf Minuten ab. |      0.89 | Q002, Q406                         | ✗ C-REG, S-REC-PLAYBACK                            |
| p-Wert noch einmal erklären?                                            |     0.928 | Q028, Q032, Q027, Q035             | C-PVAL                                             |
| Is it working for anyone else?                                          |     0.888 | Q455, Q488                         | ✗ S-AMB2-24, S-NOISE2-18                           |
| On pourrait refaire un exercice de régression ensemble ?                |     0.901 | Q393, Q004, Q010                   | ✗ N-SLIDESUP, C-REG                                |
| Klappt irgendwie nicht.                                                 |     0.897 | Q441, Q171, Q411                   | ✗ S-AMB2-10, T-AUDIO, S-AMB-4                      |
| Hi                                                                      |     0.887 | Q440, Q487                         | ✗ S-AMB2-09, S-NOISE2-17                           |
| can u explain p values again                                            |     0.898 | Q388, Q029, Q037                   | ✗ N-OFFICECONTENT, C-PVAL                          |
| I can't vote, the button doesn't respond.                               |     0.917 | Q200, Q197, Q199, Q198, Q192, Q193 | T-VOTE                                             |
| Wann ist Ihre Sprechstunde?                                             |     0.915 | Q309, Q310, Q308, Q307, Q311       | O-OFFICE                                           |
| ¿Dónde me inscribo para el examen?                                      |     0.902 | Q126, Q292, Q293                   | ✗ O-AIDS, O-REG                                    |
| Could you turn the mic up a bit?                                        |     0.886 | Q173, Q174                         | T-AUDIO                                            |
| Mein Laptop lädt an den Tischsteckdosen nicht.                          |     0.886 | Q358, Q360                         | T-POWER                                            |
| Can we do one more regression example step by step?                     |     0.908 | Q392, Q003, Q009                   | ✗ N-SLIDESUP, C-REG                                |
| ¿Puedo cambiarme a otro grupo de prácticas?                             |     0.909 | Q397, Q305, Q306                   | ✗ N-TUTMOODLE, O-TUT                               |
| Noch ein Regressionsbeispiel?                                           |     0.915 | Q006, Q005, Q013, Q001, Q007       | C-REG                                              |
| La valeur p, c'est la probabilité que H0 soit vraie ?                   |     0.885 | Q038, Q265                         | ✗ C-PVAL, C-SAMPLE                                 |
| ¿Cómo se calcula la nota final?                                         |     0.903 | Q274, Q277, Q279                   | O-GRADE                                            |
| Où s'inscrit-on pour l'examen ?                                         |     0.911 | Q278, Q125, Q023, Q124, Q290, Q291 | ✗ O-GRADE, O-AIDS, C-HYP, O-REG                    |
| Can you give an intuitive example of Bayes' theorem?                    |       0.9 | Q072, Q067, Q073                   | C-BAYES                                            |
| Ist das so richtig?                                                     |     0.884 | Q439, Q442                         | ✗ S-AMB2-08, S-AMB2-11                             |
| Korrelation gleich Kausalität oder nicht?                               |     0.913 | Q233, Q235, Q242, Q243             | C-CORR                                             |
| Wie erkenne ich overfitting bei meinem model?                           |     0.908 | Q422, Q045, Q040, Q052             | ✗ S-NM-05, C-OVF                                   |
| It's too dark at the back to take notes, the lights are off.            |     0.884 | Q374, Q376                         | T-LIGHT                                            |
| Bis wann muss man sich zur Klausur anmelden?                            |     0.911 | Q109, Q294, Q423, Q286, Q282, Q285 | ✗ O-ROOM, O-REG, S-NM-06                           |
| When are your office hours?                                             |     0.906 | Q313, Q312, Q314                   | O-OFFICE                                           |
| Haben wir nächsten Donnerstag frei?                                     |     0.882 | Q132, Q445                         | ✗ O-CANC, S-AMB2-14                                |
| ¿Hay que estudiar el capítulo 5 para el examen?                         |     0.894 | Q018, Q024, Q025                   | C-HYP                                              |
| Las luces del techo parpadean todo el rato.                             |     0.907 | Q155, Q189, Q380                   | ✗ T-WIFI, T-BEAM, T-LIGHT                          |
| Schreiben wir die Nachklausur wieder im großen Hörsaal?                 |     0.894 | Q425, Q103, Q108                   | ✗ S-NM-08, O-ROOM                                  |
| Wird geprüft, ob wir in der Vorlesung sind?                             |     0.898 | Q139, Q145, Q091, Q096, Q134       | ✗ O-REC, O-ATT, O-CANC                             |
| Kommt das noch?                                                         |     0.892 | Q433, Q443, Q434, Q436             | ✗ S-AMB2-02, S-AMB2-12, S-AMB2-03, S-AMB2-05       |
| Licht hinten kaputt                                                     |      0.88 | Q369, Q373                         | T-LIGHT                                            |
| What's the deadline to sign up for the exam?                            |     0.896 | Q289, Q287, Q288                   | O-REG                                              |
| How do we detect overfitting in practice?                               |     0.899 | Q046, Q047, Q042, Q048             | C-OVF                                              |
| ¿Entra la puntuación z en el examen?                                    |     0.917 | Q252, Q382, Q254, Q383             | ✗ C-NORM, N-ZEXAM                                  |
| Das WLAN verbindet sich hier gar nicht.                                 |     0.901 | Q152, Q158, Q156, Q157             | T-WIFI                                             |
| Der Beamer schneidet die rechte Hälfte der Folie ab.                    |     0.889 | Q181, Q177, Q182                   | T-BEAM                                             |
| La connexion unique tourne en boucle.                                   |      0.89 | Q340, Q328, Q378                   | ✗ T-STREAM, T-LOGIN, T-LIGHT                       |
| Peut-on prendre rendez-vous pour une permanence ?                       |     0.896 | Q099, Q315, Q316                   | ✗ O-ATT, O-OFFICE                                  |
| Fällt die Vorlesung am Donnerstag wegen des Feiertags aus?              |     0.905 | Q128, Q127, Q133, Q204, Q391       | ✗ O-CANC, T-PDF, N-SLIDESUP                        |
| Woher kommt auf Folie 17 plötzlich das Quadrat?                         |     0.894 | Q057, Q413, Q054, Q058             | ✗ C-DERIV, S-AMB-6                                 |
| L'enregistrement sera-t-il mis en ligne ?                               |     0.901 | Q410, Q454, Q100, Q142, Q148       | ✗ S-AMB-3, S-AMB2-23, O-ATT, O-REC                 |
| Ich kann nicht abstimmen, der Button reagiert nicht.                    |     0.891 | Q322, Q195, Q190, Q196             | ✗ T-LOGIN, T-VOTE                                  |
| ¿Se puede usar calculadora en el examen?                                |     0.876 | Q118, Q123                         | O-AIDS                                             |
| Ist die Frist für Übungsblatt 2 diesen Freitag?                         |     0.906 | Q077, Q083, Q089, Q078, Q081       | O-DEAD                                             |
| ¿Qué diferencia hay entre sobreajuste y subajuste?                      |     0.875 | Q043, Q051                         | C-OVF                                              |
| Mon téléphone ne lit pas le QR code.                                    |     0.917 | Q355, Q350, Q353, Q356, Q351, Q354 | T-QR                                               |
| Bayes nochmal an einem Beispiel?                                        |     0.903 | Q065, Q069, Q066, Q071, Q068, Q076 | C-BAYES                                            |
| Las luces del fondo del aula no funcionan.                              |     0.894 | Q367, Q201, Q368, Q180, Q163, Q379 | ✗ T-POWER, T-VOTE, T-BEAM, T-WIFI, T-LIGHT         |
| Wie tausche ich meinen Tutoriumstermin?                                 |     0.879 | Q420, Q298, Q395                   | ✗ S-NM-03, O-TUT, N-TUTMOODLE                      |
| Der QR-Code ist von hinten zu klein zum Scannen.                        |     0.895 | Q347, Q345, Q346, Q349             | T-QR                                               |
| Is the p-value the probability that the null hypothesis is true?        |     0.873 | Q036, Q225                         | ✗ C-PVAL, C-CI                                     |
| Ça marche chez vous ?                                                   |     0.882 | Q412, Q458, Q463                   | ✗ S-AMB-5, S-AMB2-27, S-AMB2-32                    |
| Kann man aus r = 0,9 auf Ursache und Wirkung schließen?                 |     0.872 | Q234, Q239                         | C-CORR                                             |
| Is there a lecture next Thursday or is it cancelled?                    |     0.903 | Q135, Q129, Q136                   | O-CANC                                             |
| ¿Se graba la clase de hoy?                                              |     0.871 | Q149, Q150                         | O-REC                                              |
| Más ejemplos de regresión, por favor, no me quedó claro.                |     0.871 | Q011, Q012                         | C-REG                                              |
| Comment interpréter un intervalle de confiance à 95 % ?                 |     0.905 | Q227, Q228, Q224, Q229             | C-CI                                               |
| Will hypothesis testing be on the final exam?                           |      0.89 | Q429, Q016, Q022                   | ✗ S-NM-12, C-HYP                                   |
| Hinten versteht man Sie kaum, das Mikro ist zu leise.                   |     0.893 | Q170, Q176, Q165, Q168             | T-AUDIO                                            |

**Lexikalisch** (nur Themen mit ≥ 2 Mitgliedern; ✗ = mischt Familien)

| Label              | Konfidenz | Mitglieder                                                                                                 | Familien                                                                               |
| ------------------ | --------: | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Moodle             |         – | Q397, Q150, Q203, Q207, Q396, Q319, Q213, Q404, Q327, Q331, Q395, Q324, Q214, Q329, Q205, Q140, Q147, Q144 | ✗ N-TUTMOODLE, O-REC, T-PDF, T-LOGIN, S-FORMULA-VERSION                                |
| examen             |         – | Q293, Q383, Q017, Q292, Q025, Q400, Q126, Q118, Q124, Q399, Q024, Q290, Q382, Q023, Q291, Q112, Q125       | ✗ O-REG, N-ZEXAM, C-HYP, N-CORREXAM, O-AIDS, O-ROOM                                    |
| Bayes              |         – | Q076, Q390, Q071, Q067, Q072, Q065, Q073, Q069, Q387, Q070, Q389, Q074, Q068, Q075, Q066                   | ✗ C-BAYES, N-OFFICECONTENT                                                             |
| Klausur            |         – | Q286, Q282, Q115, Q423, Q119, Q285, Q018, Q019, Q403, Q381, Q120, Q272, Q109, Q294                         | ✗ O-REG, O-AIDS, S-NM-06, C-HYP, S-REG-EXAM, N-ZEXAM, O-GRADE, O-ROOM                  |
| exam               |         – | Q117, Q123, Q289, Q111, Q287, Q288, Q104, Q122, Q398, Q016, Q405, Q426                                     | ✗ O-AIDS, O-REG, O-ROOM, N-CORREXAM, C-HYP, S-EXAM-WIFI, S-NM-09                       |
| regression         |         – | Q392, Q002, Q009, Q003, Q418, Q013, Q001, Q006, Q393, Q008, Q010, Q004                                     | ✗ N-SLIDESUP, C-REG, S-NM-01                                                           |
| Vorlesung          |         – | Q134, Q133, Q127, Q128, Q095, Q422, Q091, Q472, Q391, Q139, Q096, Q090                                     | ✗ O-CANC, O-ATT, S-NM-05, S-NOISE2-02, N-SLIDESUP, O-REC                               |
| does               |         – | Q237, Q448, Q427, Q225, Q450, Q262, Q352, Q224, Q029, Q251, Q060                                           | ✗ C-CORR, S-AMB2-17, S-NM-10, C-CI, S-AMB2-19, C-SAMPLE, T-QR, C-PVAL, C-NORM, C-DERIV |
| Folie              |         – | Q215, Q053, Q177, Q419, Q059, Q413, Q057, Q058, Q054                                                       | ✗ S-SLIDE-TYPO, C-DERIV, T-BEAM, S-NM-02, S-AMB-6                                      |
| Cómo               |         – | Q267, Q279, Q254, Q043, Q230, Q268, Q039                                                                   | ✗ C-SAMPLE, O-GRADE, C-NORM, C-OVF, C-CI, C-PVAL                                       |
| cours              |         – | Q100, Q142, Q137, Q099, Q130, Q212, Q491                                                                   | ✗ O-ATT, O-REC, O-CANC, T-PDF, S-NOISE2-21                                             |
| overfitting        |         – | Q045, Q042, Q048, Q046, Q047, Q052, Q040                                                                   | C-OVF                                                                                  |
| stream             |         – | Q335, Q333, Q421, Q341, Q336, Q338                                                                         | ✗ T-STREAM, S-NM-04                                                                    |
| clase              |         – | Q131, Q101, Q138, Q149, Q496                                                                               | ✗ O-CANC, O-ATT, O-REC, S-NOISE2-26                                                    |
| Comment            |         – | Q252, Q265, Q277, Q227, Q049                                                                               | ✗ C-NORM, C-SAMPLE, O-GRADE, C-CI, C-OVF                                               |
| dans               |         – | Q105, Q228, Q278, Q161, Q056                                                                               | ✗ O-ROOM, C-CI, O-GRADE, T-WIFI, C-DERIV                                               |
| Hinten             |         – | Q346, Q371, Q171, Q165, Q373                                                                               | ✗ T-QR, T-LIGHT, T-AUDIO                                                               |
| p-Wert             |         – | Q028, Q033, Q034, Q027, Q035                                                                               | C-PVAL                                                                                 |
| Sprechstunde       |         – | Q309, Q308, Q311, Q307, Q310                                                                               | O-OFFICE                                                                               |
| this               |         – | Q428, Q456, Q429, Q410, Q159                                                                               | ✗ S-NM-11, S-AMB2-25, S-NM-12, S-AMB-3, T-WIFI                                         |
| back               |         – | Q376, Q374, Q325, Q167                                                                                     | ✗ T-LIGHT, T-LOGIN, T-AUDIO                                                            |
| eduroam            |         – | Q153, Q160, Q162, Q154                                                                                     | T-WIFI                                                                                 |
| Freitag            |         – | Q081, Q089, Q078, Q083                                                                                     | O-DEAD                                                                                 |
| Konfidenzintervall |         – | Q424, Q222, Q223, Q221                                                                                     | ✗ S-NM-07, C-CI                                                                        |
| lecture            |         – | Q211, Q482, Q129, Q136                                                                                     | ✗ T-PDF, S-NOISE2-12, O-CANC                                                           |
| Nachklausur        |         – | Q425, Q108, Q384, Q103                                                                                     | ✗ S-NM-08, O-ROOM, N-BONUSRETAKE                                                       |
| Puede              |         – | Q031, Q064, Q466, Q175                                                                                     | ✗ C-PVAL, C-DERIV, S-AMB2-35, T-AUDIO                                                  |
| puedo              |         – | Q305, Q318, Q200, Q306                                                                                     | ✗ O-TUT, O-OFFICE, T-VOTE                                                              |
| sheet              |         – | Q098, Q085, Q430, Q084                                                                                     | ✗ O-ATT, O-DEAD, S-NM-13                                                               |
| WLAN               |         – | Q152, Q158, Q156, Q164                                                                                     | T-WIFI                                                                                 |
| code               |         – | Q351, Q353, Q350                                                                                           | T-QR                                                                                   |
| Cuándo             |         – | Q087, Q317, Q465                                                                                           | ✗ O-DEAD, O-OFFICE, S-AMB2-34                                                          |
| Danke              |         – | Q414, Q471, Q478                                                                                           | ✗ S-NOISE-1, S-NOISE2-01, S-NOISE2-08                                                  |
| diapositivas       |         – | Q394, Q206, Q180                                                                                           | ✗ N-SLIDESUP, T-PDF, T-BEAM                                                            |
| Dónde              |         – | Q468, Q113, Q063                                                                                           | ✗ S-AMB2-37, O-ROOM, C-DERIV                                                           |
| haengen            |         – | Q194, Q332, Q320                                                                                           | ✗ T-VOTE, T-STREAM, T-LOGIN                                                            |
| hypothesis         |         – | Q022, Q036, Q026                                                                                           | ✗ C-HYP, C-PVAL                                                                        |
| Kapitel 5          |         – | Q407, Q014, Q020                                                                                           | ✗ S-CH5-READING, C-HYP                                                                 |
| Korrelation        |         – | Q232, Q235, Q233                                                                                           | C-CORR                                                                                 |
| office hours       |         – | Q314, Q313, Q312                                                                                           | O-OFFICE                                                                               |
| points             |         – | Q276, Q092, Q281                                                                                           | ✗ O-GRADE, O-ATT                                                                       |
| pour               |         – | Q354, Q385, Q316                                                                                           | ✗ T-QR, N-BONUSRETAKE, O-OFFICE                                                        |
| quand              |         – | Q459, Q086, Q315                                                                                           | ✗ S-AMB2-28, O-DEAD, O-OFFICE                                                          |
| slides             |         – | Q181, Q179, Q210                                                                                           | ✗ T-BEAM, T-PDF                                                                        |
| tutorial           |         – | Q300, Q302, Q301                                                                                           | O-TUT                                                                                  |
| Where              |         – | Q449, Q431, Q110                                                                                           | ✗ S-AMB2-18, S-NM-14, O-ROOM                                                           |
| wifi               |         – | Q155, Q402, Q163                                                                                           | ✗ T-WIFI, N-WIFIPASS                                                                   |
| attendance         |         – | Q097, Q102                                                                                                 | O-ATT                                                                                  |
| Aufzeichnung       |         – | Q406, Q143                                                                                                 | ✗ S-REC-PLAYBACK, O-REC                                                                |
| Beamer             |         – | Q182, Q184                                                                                                 | T-BEAM                                                                                 |
| Bonuspunkte        |         – | Q273, Q271                                                                                                 | O-GRADE                                                                                |
| button             |         – | Q197, Q196                                                                                                 | T-VOTE                                                                                 |
| código             |         – | Q356, Q355                                                                                                 | T-QR                                                                                   |
| correlación        |         – | Q242, Q243                                                                                                 | C-CORR                                                                                 |
| corrélation        |         – | Q241, Q240                                                                                                 | C-CORR                                                                                 |
| Could              |         – | Q061, Q173                                                                                                 | ✗ C-DERIV, T-AUDIO                                                                     |
| diapo              |         – | Q062, Q217                                                                                                 | ✗ C-DERIV, S-SLIDE-TYPO                                                                |
| fehlermeldung      |         – | Q204, Q323                                                                                                 | ✗ T-PDF, T-LOGIN                                                                       |
| flackert           |         – | Q183, Q370                                                                                                 | ✗ T-BEAM, T-LIGHT                                                                      |
| Folien             |         – | Q209, Q208                                                                                                 | T-PDF                                                                                  |
| from               |         – | Q363, Q055                                                                                                 | ✗ T-POWER, C-DERIV                                                                     |
| funktionieren      |         – | Q447, Q358                                                                                                 | ✗ S-AMB2-16, T-POWER                                                                   |
| genau              |         – | Q219, Q246                                                                                                 | ✗ C-CI, C-NORM                                                                         |
| Gracias            |         – | Q417, Q500                                                                                                 | ✗ S-NOISE-4, S-NOISE2-30                                                               |
| interval           |         – | Q226, Q231                                                                                                 | C-CI                                                                                   |
| keeps              |         – | Q337, Q185                                                                                                 | ✗ T-STREAM, T-BEAM                                                                     |
| lädt               |         – | Q202, Q360                                                                                                 | ✗ T-VOTE, T-POWER                                                                      |
| Licht              |         – | Q372, Q369                                                                                                 | T-LIGHT                                                                                |
| micro              |         – | Q168, Q174                                                                                                 | T-AUDIO                                                                                |
| Mikrofon           |         – | Q170, Q166                                                                                                 | T-AUDIO                                                                                |
| Note               |         – | Q270, Q420                                                                                                 | ✗ O-GRADE, S-NM-03                                                                     |
| para               |         – | Q280, Q255                                                                                                 | ✗ O-GRADE, C-NORM                                                                      |
| Pourquoi           |         – | Q461, Q253                                                                                                 | ✗ S-AMB2-30, C-NORM                                                                    |
| Prüfungsanmeldung  |         – | Q284, Q283                                                                                                 | O-REG                                                                                  |
| QR-Code            |         – | Q347, Q345                                                                                                 | T-QR                                                                                   |
| rato               |         – | Q189, Q380                                                                                                 | ✗ T-BEAM, T-LIGHT                                                                      |
| recording          |         – | Q151, Q141                                                                                                 | O-REC                                                                                  |
| recuperación       |         – | Q114, Q386                                                                                                 | ✗ O-ROOM, N-BONUSRETAKE                                                                |
| regresión          |         – | Q011, Q012                                                                                                 | C-REG                                                                                  |
| schließen          |         – | Q234, Q236                                                                                                 | C-CORR                                                                                 |
| Stichprobengröße   |         – | Q260, Q261                                                                                                 | C-SAMPLE                                                                               |
| Taschenrechner     |         – | Q121, Q116                                                                                                 | O-AIDS                                                                                 |
| test               |         – | Q475, Q485                                                                                                 | ✗ S-NOISE2-05, S-NOISE2-15                                                             |
| that               |         – | Q451, Q454                                                                                                 | ✗ S-AMB2-20, S-AMB2-23                                                                 |
| Umfrage            |         – | Q195, Q191                                                                                                 | T-VOTE                                                                                 |
| What               |         – | Q238, Q079                                                                                                 | ✗ C-CORR, O-DEAD                                                                       |
| working            |         – | Q455, Q362                                                                                                 | ✗ S-AMB2-24, T-POWER                                                                   |
| z-score            |         – | Q249, Q256                                                                                                 | C-NORM                                                                                 |

## 6. Falsch zusammengeführte Paare (Encoder, Gesamtset)

- Q002 »Bitte mehr Aufgaben zur Regression, das ging mir zu schnell.« ↔ Q406 »Die Aufzeichnung von letzter Woche bricht bei mir nach fünf Minuten ab.«
- Q003 »Could you walk us through another linear regression example?« ↔ Q392 »Are the slides with the regression examples uploaded yet?«
- Q004 »Pourriez-vous faire un autre exemple de régression linéaire ?« ↔ Q393 »Les diapos de la régression sont-elles déjà en ligne ?«
- Q009 »Can we do one more regression example step by step?« ↔ Q392 »Are the slides with the regression examples uploaded yet?«
- Q010 »On pourrait refaire un exercice de régression ensemble ?« ↔ Q393 »Les diapos de la régression sont-elles déjà en ligne ?«
- Q016 »Will hypothesis testing be on the final exam?« ↔ Q429 »Is there a tutorial session on hypothesis tests this week?«
- Q020 »Wird Kapitel 5 mit den Tests abgefragt?« ↔ Q407 »Gibt es zu Kapitel 5 weiterführende Literatur?«
- Q021 »Will we be tested on the t-test?« ↔ Q426 »Will the z-table be provided in the exam?«
- Q022 »Is chapter 5 on hypothesis tests examinable?« ↔ Q429 »Is there a tutorial session on hypothesis tests this week?«
- Q023 »Les tests d'hypothèses tombent-ils à l'examen ?« ↔ Q124 »A-t-on droit à la calculatrice à l'examen ?«
- Q023 »Les tests d'hypothèses tombent-ils à l'examen ?« ↔ Q125 »Quels documents sont autorisés à l'examen ?«
- Q023 »Les tests d'hypothèses tombent-ils à l'examen ?« ↔ Q278 »Les exercices comptent-ils dans la note ?«
- Q023 »Les tests d'hypothèses tombent-ils à l'examen ?« ↔ Q290 »Jusqu'à quand peut-on s'inscrire à l'examen ?«
- Q023 »Les tests d'hypothèses tombent-ils à l'examen ?« ↔ Q291 »Où s'inscrit-on pour l'examen ?«
- Q029 »What does a p-value actually tell us?« ↔ Q388 »Can we use the office hours to go over the p-value example?«
- Q036 »Is the p-value the probability that the null hypothesis is true?« ↔ Q225 »Does the true mean lie in the interval with 95% probability?«
- Q037 »can u explain p values again« ↔ Q388 »Can we use the office hours to go over the p-value example?«
- Q038 »La valeur p, c'est la probabilité que H0 soit vraie ?« ↔ Q265 »Comment déterminer la taille de l'échantillon ?«
- Q040 »Wie erkenne ich Overfitting in der Praxis?« ↔ Q422 »Kommt Overfitting nur in der Übung oder auch in der Vorlesung dran?«
- Q045 »Entsteht Overfitting, wenn das Modell zu viele Parameter hat?« ↔ Q422 »Kommt Overfitting nur in der Übung oder auch in der Vorlesung dran?«
- Q052 »Wie erkenne ich overfitting bei meinem model?« ↔ Q422 »Kommt Overfitting nur in der Übung oder auch in der Vorlesung dran?«
- Q054 »Woher kommt auf Folie 17 plötzlich das Quadrat?« ↔ Q413 »Folie 17?«
- Q057 »Könnten Sie die Umformung auf Folie 17 langsamer zeigen?« ↔ Q413 »Folie 17?«
- Q058 »Wie kommt man auf Folie 17 von der zweiten zur dritten Zeile?« ↔ Q413 »Folie 17?«
- Q070 »Können Sie Bayes mal mit einem medizinischen Test erklären?« ↔ Q387 »Kann man die Sprechstunde auch für Fragen zu Bayes nutzen?«
- Q074 »Pouvez-vous donner un exemple concret du théorème de Bayes ?« ↔ Q389 »Peut-on venir en permanence pour parler de Bayes ?«
- Q075 »Un exemple de Bayes avec un test médical ?« ↔ Q389 »Peut-on venir en permanence pour parler de Bayes ?«
- Q082 »Kurze Nachfrage: bis wann ist Blatt 2 fällig?« ↔ Q437 »Wann ist das fällig?«
- Q091 »Müssen wir zu jeder Vorlesung kommen, oder ist das freiwillig?« ↔ Q134 »Do. Vorlesung oder nicht?«
- Q091 »Müssen wir zu jeder Vorlesung kommen, oder ist das freiwillig?« ↔ Q139 »Wird die heutige Vorlesung aufgezeichnet?«
- Q091 »Müssen wir zu jeder Vorlesung kommen, oder ist das freiwillig?« ↔ Q145 »Werden die Vorlesungen eigentlich mitgeschnitten?«
- Q096 »Wird geprüft, ob wir in der Vorlesung sind?« ↔ Q134 »Do. Vorlesung oder nicht?«
- Q096 »Wird geprüft, ob wir in der Vorlesung sind?« ↔ Q139 »Wird die heutige Vorlesung aufgezeichnet?«
- Q096 »Wird geprüft, ob wir in der Vorlesung sind?« ↔ Q145 »Werden die Vorlesungen eigentlich mitgeschnitten?«
- Q097 »Is attendance taken in the lectures?« ↔ Q146 »Are the lectures being recorded?«
- Q098 »Do we have to sign an attendance sheet?« ↔ Q117 »Can we bring a cheat sheet to the exam?«
- Q099 »La présence en cours est-elle obligatoire ?« ↔ Q315 »Quand sont vos heures de permanence ?«
- Q099 »La présence en cours est-elle obligatoire ?« ↔ Q316 »Peut-on prendre rendez-vous pour une permanence ?«
- Q100 »Est-ce qu'on fait l'appel en cours ?« ↔ Q142 »Est-ce que le cours est enregistré ?«
- Q100 »Est-ce qu'on fait l'appel en cours ?« ↔ Q148 »L'enregistrement sera-t-il mis en ligne ?«
- Q100 »Est-ce qu'on fait l'appel en cours ?« ↔ Q410 »Is this going to be on it?«
- Q100 »Est-ce qu'on fait l'appel en cours ?« ↔ Q454 »Will that be uploaded?«
- Q103 »Wo findet die Nachklausur statt, wieder im Audimax?« ↔ Q425 »Ist der Raum für die Nachklausur barrierefrei?«
- Q108 »Schreiben wir die Nachklausur wieder im großen Hörsaal?« ↔ Q425 »Ist der Raum für die Nachklausur barrierefrei?«
- Q109 »Wo ist der Nachtermin für die Klausur?« ↔ Q282 »Bis wann muss man sich zur Klausur anmelden?«
- Q109 »Wo ist der Nachtermin für die Klausur?« ↔ Q285 »Kann ich mich nach Fristende noch zur Klausur anmelden?«
- Q109 »Wo ist der Nachtermin für die Klausur?« ↔ Q286 »Anmeldefrist Klausur?«
- Q109 »Wo ist der Nachtermin für die Klausur?« ↔ Q294 »Wo ist die registration für die Klausur?«
- Q109 »Wo ist der Nachtermin für die Klausur?« ↔ Q423 »Gibt es einen QR-Code für die Anmeldung zur Klausur?«
- Q112 »Où se passe l'examen de rattrapage ?« ↔ Q385 »Les points bonus comptent-ils aussi pour le rattrapage ?«
- Q115 »Dürfen wir in der Klausur eine Formelsammlung benutzen?« ↔ Q404 »Ist die Formelsammlung im Moodle die aktuelle Version?«
- Q124 »A-t-on droit à la calculatrice à l'examen ?« ↔ Q278 »Les exercices comptent-ils dans la note ?«
- Q124 »A-t-on droit à la calculatrice à l'examen ?« ↔ Q290 »Jusqu'à quand peut-on s'inscrire à l'examen ?«
- Q124 »A-t-on droit à la calculatrice à l'examen ?« ↔ Q291 »Où s'inscrit-on pour l'examen ?«
- Q125 »Quels documents sont autorisés à l'examen ?« ↔ Q278 »Les exercices comptent-ils dans la note ?«
- Q125 »Quels documents sont autorisés à l'examen ?« ↔ Q290 »Jusqu'à quand peut-on s'inscrire à l'examen ?«
- Q125 »Quels documents sont autorisés à l'examen ?« ↔ Q291 »Où s'inscrit-on pour l'examen ?«
- Q126 »¿Se permite llevar un formulario al examen?« ↔ Q292 »¿Hasta cuándo hay que inscribirse al examen?«
- Q126 »¿Se permite llevar un formulario al examen?« ↔ Q293 »¿Dónde me inscribo para el examen?«
- Q127 »Fällt die Vorlesung am Donnerstag wegen des Feiertags aus?« ↔ Q204 »Beim Download der Vorlesungsfolien kommt nur eine Fehlermeldung.«
- Q127 »Fällt die Vorlesung am Donnerstag wegen des Feiertags aus?« ↔ Q391 »Werden die Folien vor der Vorlesung oder erst danach hochgeladen?«
- Q128 »Findet nächsten Donnerstag überhaupt Vorlesung statt?« ↔ Q204 »Beim Download der Vorlesungsfolien kommt nur eine Fehlermeldung.«
- Q128 »Findet nächsten Donnerstag überhaupt Vorlesung statt?« ↔ Q391 »Werden die Folien vor der Vorlesung oder erst danach hochgeladen?«
- Q132 »Haben wir nächsten Donnerstag frei?« ↔ Q445 »Brauchen wir das für später?«
- Q133 »Entfällt die Vorlesung am Feiertag?« ↔ Q204 »Beim Download der Vorlesungsfolien kommt nur eine Fehlermeldung.«
- Q133 »Entfällt die Vorlesung am Feiertag?« ↔ Q391 »Werden die Folien vor der Vorlesung oder erst danach hochgeladen?«
- Q134 »Do. Vorlesung oder nicht?« ↔ Q139 »Wird die heutige Vorlesung aufgezeichnet?«
- Q134 »Do. Vorlesung oder nicht?« ↔ Q145 »Werden die Vorlesungen eigentlich mitgeschnitten?«
- Q142 »Est-ce que le cours est enregistré ?« ↔ Q410 »Is this going to be on it?«
- Q142 »Est-ce que le cours est enregistré ?« ↔ Q454 »Will that be uploaded?«
- Q148 »L'enregistrement sera-t-il mis en ligne ?« ↔ Q410 »Is this going to be on it?«
- Q148 »L'enregistrement sera-t-il mis en ligne ?« ↔ Q454 »Will that be uploaded?«
- Q155 »El wifi del aula se cae todo el rato.« ↔ Q189 »La imagen del proyector parpadea todo el rato.«
- Q155 »El wifi del aula se cae todo el rato.« ↔ Q380 »Las luces del techo parpadean todo el rato.«
- Q159 »There's no Wi-Fi signal in this room.« ↔ Q364 »None of the outlets under the desks have power.«
- Q161 »Pas de réseau wifi dans l'amphi.« ↔ Q377 »La lumière au fond de l'amphi ne marche plus.«
- Q163 »No hay conexión wifi en el aula.« ↔ Q180 »El proyector no muestra bien las diapositivas.«
- Q163 »No hay conexión wifi en el aula.« ↔ Q201 »La encuesta no carga en mi móvil.«
- Q163 »No hay conexión wifi en el aula.« ↔ Q367 »Los enchufes de la fila 12 no funcionan.«
- Q163 »No hay conexión wifi en el aula.« ↔ Q368 »Mi portátil no carga en los enchufes de las mesas.«
- Q163 »No hay conexión wifi en el aula.« ↔ Q379 »Las luces del fondo del aula no funcionan.«
- Q171 »Hinten kommt kein Ton an.« ↔ Q411 »Klappt irgendwie nicht.«
- Q171 »Hinten kommt kein Ton an.« ↔ Q441 »Das verstehe ich nicht ganz.«
- Q178 »Die Projektion ist so blass, dass man die Formeln nicht lesen kann.« ↔ Q371 »Hinten ist es so dunkel, dass man nicht mitschreiben kann.«
- Q180 »El proyector no muestra bien las diapositivas.« ↔ Q201 »La encuesta no carga en mi móvil.«
- Q180 »El proyector no muestra bien las diapositivas.« ↔ Q367 »Los enchufes de la fila 12 no funcionan.«
- Q180 »El proyector no muestra bien las diapositivas.« ↔ Q368 »Mi portátil no carga en los enchufes de las mesas.«
- Q180 »El proyector no muestra bien las diapositivas.« ↔ Q379 »Las luces del fondo del aula no funcionan.«
- Q183 »Das Bild vom Projektor flackert die ganze Zeit.« ↔ Q370 »Die Deckenbeleuchtung flackert ständig.«
- Q184 »Die Farben am Beamer sind so blass, man erkennt nichts.« ↔ Q371 »Hinten ist es so dunkel, dass man nicht mitschreiben kann.«
- Q185 »The projector image keeps flickering.« ↔ Q375 »The ceiling lights keep flickering.«
- Q189 »La imagen del proyector parpadea todo el rato.« ↔ Q380 »Las luces del techo parpadean todo el rato.«
- Q190 »Die Abstimmung lädt bei mir seit zwei Minuten nicht.« ↔ Q322 »Seit heute Morgen kann ich mich nicht mehr einloggen.«
- Q191 »Ich komme mit dem Sitzungscode nicht in die Umfrage rein.« ↔ Q319 »Ich komme mit meiner Uni-Kennung nicht ins Moodle.«
- Q195 »Bei mir erscheint die Umfrage nicht, nur ein leerer Bildschirm.« ↔ Q322 »Seit heute Morgen kann ich mich nicht mehr einloggen.«
- Q196 »Ich kann nicht abstimmen, der Button reagiert nicht.« ↔ Q322 »Seit heute Morgen kann ich mich nicht mehr einloggen.«
- Q201 »La encuesta no carga en mi móvil.« ↔ Q367 »Los enchufes de la fila 12 no funcionan.«
- Q201 »La encuesta no carga en mi móvil.« ↔ Q368 »Mi portátil no carga en los enchufes de las mesas.«
- Q201 »La encuesta no carga en mi móvil.« ↔ Q379 »Las luces del fondo del aula no funcionan.«
- Q202 »Das voting lädt nicht« ↔ Q361 »Strom an den Plätzen geht nicht«
- Q204 »Beim Download der Vorlesungsfolien kommt nur eine Fehlermeldung.« ↔ Q391 »Werden die Folien vor der Vorlesung oder erst danach hochgeladen?«
- Q213 »Impossible de télécharger les diapos sur Moodle.« ↔ Q324 »My university account won't let me log into Moodle.«
- Q213 »Impossible de télécharger les diapos sur Moodle.« ↔ Q327 »Je n'arrive pas à me connecter à Moodle avec mon compte.«
- Q213 »Impossible de télécharger les diapos sur Moodle.« ↔ Q329 »No puedo entrar en Moodle con mi usuario.«
- Q214 »No puedo descargar las diapositivas de Moodle.« ↔ Q324 »My university account won't let me log into Moodle.«
- Q214 »No puedo descargar las diapositivas de Moodle.« ↔ Q327 »Je n'arrive pas à me connecter à Moodle avec mon compte.«
- Q214 »No puedo descargar las diapositivas de Moodle.« ↔ Q329 »No puedo entrar en Moodle con mi usuario.«
- Q221 »Wie interpretiere ich das Konfidenzintervall aus der Übung?« ↔ Q424 »Ist das Konfidenzintervall auf dem Übungsblatt mit 95 oder 99 % gemeint?«
- Q222 »Kann man sagen, der Mittelwert liegt sicher im Konfidenzintervall?« ↔ Q424 »Ist das Konfidenzintervall auf dem Übungsblatt mit 95 oder 99 % gemeint?«
- Q223 »Konfidenzintervall – wie deuten?« ↔ Q424 »Ist das Konfidenzintervall auf dem Übungsblatt mit 95 oder 99 % gemeint?«
- Q237 »Does correlation imply causation here?« ↔ Q398 »Will correlation vs causation be part of the exam?«
- Q238 »What's the difference between correlation and causation?« ↔ Q398 »Will correlation vs causation be part of the exam?«
- Q240 »Une forte corrélation implique-t-elle une causalité ?« ↔ Q399 »Corrélation et causalité, ça tombe à l'examen ?«
- Q241 »En quoi corrélation et causalité sont-elles différentes ?« ↔ Q399 »Corrélation et causalité, ça tombe à l'examen ?«
- Q248 »z-Transformation nochmal erklären?« ↔ Q381 »Kommt die z-Transformation auch in der Klausur dran?«
- Q252 »Comment calcule-t-on le score z ?« ↔ Q382 »Le score z sera-t-il à l'examen ?«
- Q252 »Comment calcule-t-on le score z ?« ↔ Q383 »¿Entra la puntuación z en el examen?«
- Q254 »¿Cómo se calcula la puntuación z?« ↔ Q382 »Le score z sera-t-il à l'examen ?«
- Q254 »¿Cómo se calcula la puntuación z?« ↔ Q383 »¿Entra la puntuación z en el examen?«
- Q271 »Gibt es Bonuspunkte für die Übungen?« ↔ Q384 »Werden die Bonuspunkte auch für die Nachklausur angerechnet?«
- Q273 »Bonuspunkte – wie viele maximal?« ↔ Q384 »Werden die Bonuspunkte auch für die Nachklausur angerechnet?«
- Q275 »Do the exercise sheets count towards the grade?« ↔ Q430 »Is the sample size question from the exercise sheet graded?«
- Q276 »Are there bonus points for homework?« ↔ Q428 »Do bonus points expire after this semester?«
- Q278 »Les exercices comptent-ils dans la note ?« ↔ Q290 »Jusqu'à quand peut-on s'inscrire à l'examen ?«
- Q278 »Les exercices comptent-ils dans la note ?« ↔ Q291 »Où s'inscrit-on pour l'examen ?«
- Q282 »Bis wann muss man sich zur Klausur anmelden?« ↔ Q423 »Gibt es einen QR-Code für die Anmeldung zur Klausur?«
- Q285 »Kann ich mich nach Fristende noch zur Klausur anmelden?« ↔ Q423 »Gibt es einen QR-Code für die Anmeldung zur Klausur?«
- Q286 »Anmeldefrist Klausur?« ↔ Q423 »Gibt es einen QR-Code für die Anmeldung zur Klausur?«
- Q294 »Wo ist die registration für die Klausur?« ↔ Q423 »Gibt es einen QR-Code für die Anmeldung zur Klausur?«
- Q298 »Wie tausche ich meinen Tutoriumstermin?« ↔ Q395 »Muss ich mich für das Tutorium auch extra im Moodle anmelden?«
- Q298 »Wie tausche ich meinen Tutoriumstermin?« ↔ Q420 »Zählt die Anwesenheit im Tutorium für die Note?«
- Q303 »Est-ce qu'on peut changer de groupe de TD ?« ↔ Q396 »Faut-il s'inscrire sur Moodle pour le TD ?«
- Q304 »J'ai un conflit d'horaire, je peux changer de TD ?« ↔ Q396 »Faut-il s'inscrire sur Moodle pour le TD ?«
- Q305 »¿Puedo cambiarme a otro grupo de prácticas?« ↔ Q397 »¿Hay que apuntarse en Moodle para el grupo de prácticas?«
- Q306 »Tengo un solapamiento, ¿puedo cambiar de grupo de prácticas?« ↔ Q397 »¿Hay que apuntarse en Moodle para el grupo de prácticas?«
- Q317 »¿Cuándo tiene horario de atención?« ↔ Q390 »¿Puedo ir a su horario de atención para preguntar sobre Bayes?«
- Q318 »¿Puedo pedir cita para su horario de atención?« ↔ Q390 »¿Puedo ir a su horario de atención para preguntar sobre Bayes?«
- Q328 »La connexion unique tourne en boucle.« ↔ Q340 »Le direct se fige tout le temps.«
- Q328 »La connexion unique tourne en boucle.« ↔ Q378 »Les néons clignotent sans arrêt.«
- Q330 »El inicio de sesión se queda en bucle.« ↔ Q342 »La transmisión en directo se congela.«
- Q340 »Le direct se fige tout le temps.« ↔ Q378 »Les néons clignotent sans arrêt.«
- Q357 »Die Steckdosen in Reihe 12 haben keinen Strom.« ↔ Q372 »Bei uns in Reihe 15 ist das Licht aus und lässt sich nicht einschalten.«
- Q367 »Los enchufes de la fila 12 no funcionan.« ↔ Q379 »Las luces del fondo del aula no funcionan.«
- Q368 »Mi portátil no carga en los enchufes de las mesas.« ↔ Q379 »Las luces del fondo del aula no funcionan.«
- Q395 »Muss ich mich für das Tutorium auch extra im Moodle anmelden?« ↔ Q420 »Zählt die Anwesenheit im Tutorium für die Note?«
- Q403 »Kommen Regressionsaufgaben auch in der Klausur dran?« ↔ Q418 »Gibt es zur Regression auch eine Aufzeichnung aus dem letzten Semester?«
- Q409 »Kann man das nochmal hochladen?« ↔ Q444 »Wird das noch hochgeladen?«
- Q410 »Is this going to be on it?« ↔ Q454 »Will that be uploaded?«
- Q411 »Klappt irgendwie nicht.« ↔ Q441 »Das verstehe ich nicht ganz.«
- Q412 »On peut décaler ?« ↔ Q458 »Ça marche chez vous ?«
- Q412 »On peut décaler ?« ↔ Q463 »C'est où ?«
- Q414 »Danke, super erklärt!« ↔ Q478 »Sehr gut erklärt, danke«
- Q416 »Hallo zusammen« ↔ Q490 »Bonjour à tous«
- Q416 »Hallo zusammen« ↔ Q498 »Hola a todos«
- Q417 »¡Gracias!« ↔ Q471 »Danke!«
- Q417 »¡Gracias!« ↔ Q481 »Thanks!«
- Q417 »¡Gracias!« ↔ Q489 »Merci !«
- Q432 »Ist das wichtig?« ↔ Q457 »C'est important ?«
- Q432 »Ist das wichtig?« ↔ Q464 »¿Es importante?«
- Q433 »Und was heißt das jetzt?« ↔ Q434 »Kommt das noch?«
- Q433 »Und was heißt das jetzt?« ↔ Q436 »Geht das schon?«
- Q433 »Und was heißt das jetzt?« ↔ Q443 »Noch einmal, bitte?«
- Q434 »Kommt das noch?« ↔ Q436 »Geht das schon?«
- Q434 »Kommt das noch?« ↔ Q443 »Noch einmal, bitte?«
- Q435 »Wo finde ich das?« ↔ Q449 »Where can I find it?«
- Q436 »Geht das schon?« ↔ Q443 »Noch einmal, bitte?«
- Q438 »Gilt das auch für uns?« ↔ Q447 »Funktioniert das bei euch?«
- Q439 »Kann man das ändern?« ↔ Q442 »Ist das so richtig?«
- Q440 »Hä?« ↔ Q487 »Hi«
- Q446 »Warum?« ↔ Q452 »How come?«
- Q446 »Warum?« ↔ Q461 »Pourquoi ?«
- Q446 »Warum?« ↔ Q467 »¿Por qué?«
- Q448 »Does that matter?« ↔ Q450 »Does this apply to us too?«
- Q451 »Can you repeat that?« ↔ Q460 »Vous pouvez répéter ?«
- Q451 »Can you repeat that?« ↔ Q466 »¿Puede repetir?«
- Q452 »How come?« ↔ Q461 »Pourquoi ?«
- Q452 »How come?« ↔ Q467 »¿Por qué?«
- Q453 »Until when?« ↔ Q459 »Jusqu'à quand ?«
- Q453 »Until when?« ↔ Q465 »¿Hasta cuándo?«
- Q455 »Is it working for anyone else?« ↔ Q488 »Who else is here?«
- Q456 »Do we need to know this?« ↔ Q462 »On doit savoir ça ?«
- Q457 »C'est important ?« ↔ Q464 »¿Es importante?«
- Q458 »Ça marche chez vous ?« ↔ Q463 »C'est où ?«
- Q459 »Jusqu'à quand ?« ↔ Q465 »¿Hasta cuándo?«
- Q460 »Vous pouvez répéter ?« ↔ Q466 »¿Puede repetir?«
- Q461 »Pourquoi ?« ↔ Q467 »¿Por qué?«
- Q468 »¿Dónde lo encuentro?« ↔ Q469 »¿Eso entra?«
- Q471 »Danke!« ↔ Q481 »Thanks!«
- Q471 »Danke!« ↔ Q489 »Merci !«
- Q472 »Super Vorlesung heute« ↔ Q491 »Super cours«
- Q473 »Guten Morgen« ↔ Q483 »Good morning everyone«
- Q474 »Hahaha« ↔ Q484 »lmao«
- Q475 »Test« ↔ Q485 »test 123«
- Q476 »👍« ↔ Q497 »jajaja«
- Q481 »Thanks!« ↔ Q489 »Merci !«
- Q490 »Bonjour à tous« ↔ Q498 »Hola a todos«
- Q496 »Muy buena clase« ↔ Q500 »Gracias, profe«

## 7. Laufzeit und Ressourcen

Kaltstart Container → /health: 1.6 s · erster Embed-Aufruf (500 Texte): 5671 ms · Image 1497 MB · Container nach Last: 491.2MiB / 2GiB|0.01%

| Texte pro Anfrage |     p50 |     p95 |     max | ms/Text (p50) |
| ----------------: | ------: | ------: | ------: | ------------: |
|                16 |  210 ms |  296 ms |  296 ms |          13.1 |
|                56 |  813 ms |  992 ms |  992 ms |          14.5 |
|               500 | 5808 ms | 6008 ms | 6008 ms |          11.6 |

Clustering in Node (naive Complete-Linkage, ein Thread):

| Texte |    Zeit |
| ----: | ------: |
|   100 |   48 ms |
|   250 |  290 ms |
|   500 | 1429 ms |

## Gültigkeitsgrenzen

- Synthetisches Referenzset; ein Annotator; Familien sind sprachunabhängig definiert.
- Laborbetrieb über loopback-HTTP statt Unix-Socket; Transport-Overhead daher nicht produktionsgleich.
- Embedding-Cache der App (Redis/In-Process) nicht genutzt: Latenzen sind Kaltpfad-Werte je Anfrage.
- Themenhäufigkeit ist kein Lernstandsmaß.
