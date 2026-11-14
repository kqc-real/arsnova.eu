# Referat 2B – Themenmessung 1.14c (Encoder vs. lexikalisch)

Commit `84a5614ead76` (v1.3.0-326-g84a5614e-dirty), Referenzset 2.2.0 (SHA-256 `717bdb17dc2e94d5…`), 2026-11-04T17:03:40.422Z
Modell `intfloat/multilingual-e5-small` / `intfloat/multilingual-e5-small@sha256:f80102d3f2a1229f`, 384 Dimensionen · Container-Limits cpus=1000000000 mem=2147483648 · loopback HTTP http://127.0.0.1:8790/embed (Labor; Produktion: Unix-Socket, network_mode none)

Umfang: 150 von 723 Items, Domäne police, Sprachen de, en, fr, es (+ mixed). Italienisch ausgeschlossen, weil die Wortwolke es nicht unterstützt (WORD_CLOUD_LEMMA_LOCALES).

Goldstandard: Themenfamilien des Referenzsets; Near-Miss-, mehrdeutige und Rausch-Items sind Einzelthemen.

## 1. Hauptergebnis

| Teilmenge                                  |   n | System      |    ARI |   NMI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 (Gold) | Falsch-Merge-Paare | Paar-Recall einsprachig | Paar-Recall sprachübergreifend |
| ------------------------------------------ | --: | ----------- | -----: | ----: | -------: | -------: | --------: | ---------------- | -----------------: | ----------------------: | -----------------------------: |
| Gesamtset (de/en/fr/es), Session-Locale de | 150 | Encoder     |  0.283 | 0.853 |   92.8 % |   44.5 % |    60.2 % | 35 (18)          |                 13 |                  24.4 % |                         15.3 % |
| Gesamtset (de/en/fr/es), Session-Locale de | 150 | Lexikalisch |  0.171 | 0.781 |   69.9 % |   40.9 % |    51.6 % | 31 (18)          |                 86 |                  37.8 % |                          3.9 % |
| nur Deutsch                                |  90 | Encoder     |  0.363 | 0.895 |   89.1 % |   62.2 % |    73.3 % | 18 (18)          |                 12 |                  25.8 % |                              – |
| nur Deutsch                                |  90 | Lexikalisch |  0.413 | 0.879 |   77.6 % |   68.2 % |    72.6 % | 17 (18)          |                 37 |                  38.2 % |                              – |
| nur Englisch                               |  22 | Encoder     |  0.280 | 0.952 |   81.8 % |  100.0 % |    90.0 % | 4 (1)            |                  5 |                 100.0 % |                              – |
| nur Englisch                               |  22 | Lexikalisch | -0.008 | 0.882 |   63.6 % |   95.5 % |    76.4 % | 5 (1)            |                 12 |                   0.0 % |                              – |
| nur Französisch ⚠ †                        |  19 | Encoder     |  0.000 | 0.852 |   52.6 % |  100.0 % |    69.0 % | 6 (0)            |                 13 |                       – |                              – |
| nur Französisch †                          |  19 | Lexikalisch |  0.000 | 0.878 |   63.2 % |  100.0 % |    77.4 % | 3 (0)            |                 12 |                       – |                              – |
| nur Spanisch ⚠ †                           |  19 | Encoder     |  0.000 | 0.987 |   94.7 % |  100.0 % |    97.3 % | 1 (0)            |                  1 |                       – |                              – |
| nur Spanisch †                             |  19 | Lexikalisch |  0.000 | 0.914 |   68.4 % |  100.0 % |    81.3 % | 5 (0)            |                  7 |                       – |                              – |

† Nicht aussagekräftig: In dieser Teilmenge hat keine Familie zwei Mitglieder derselben Sprache. ARI ist dann 0, BCubed belohnt bloßes Nicht-Zusammenfassen. Nur Gesamtset und Deutsch tragen eine Aussage; für Einsprachigkeit in en/fr/es wären mehr Items je Sprache nötig.

⚠ Session-Locale nicht in `WORD_CLOUD_SEMANTIC_LOCALES` (de, en): Das Produkt ruft den Encoder dort **nicht** auf und zeigt den lexikalischen Fallback. Encoderwerte zeigen nur das ungenutzte Potenzial.

### Stabilität über die Batch-Zusammensetzung

Das Embedding einer Frage hängt von den anderen Texten derselben Anfrage ab (Vektor-Drift 1 − cos: Median 3.3e-3, max 9.5e-3). Vermutete Ursache: quantisiertes ONNX-Modell (nicht verifiziert). Tabelle 1 oben zeigt **eine** Gesamtanfrage; hier 10 Läufe mit zufälliger Reihenfolge und Anfragegrößen 5–40 (simuliert inkrementelles Einbetten). Werte: Median [min–max].

| Teilmenge                                  | Encoder ARI         | Encoder BCubed F1      | Falsch-Merge-Paare | Themen ≥2  | Lexikalisch ARI (deterministisch) |
| ------------------------------------------ | ------------------- | ---------------------- | ------------------ | ---------- | --------------------------------: |
| Gesamtset (de/en/fr/es), Session-Locale de | 0.269 [0.261–0.291] | 59.1 % [58.8 %–60.3 %] | 16 [14–26]         | 38 [36–39] |                             0.171 |
| nur Deutsch                                | 0.363 [0.347–0.391] | 73.0 % [72.6 %–73.8 %] | 13 [12–19]         | 20 [18–20] |                             0.413 |
| nur Englisch                               | 0.328 [0.244–0.396] | 90.0 % [87.2 %–92.7 %] | 4 [3–6]            | 5 [4–5]    |                            -0.008 |
| nur Französisch †                          | 0.000 [0.000–0.000] | 73.3 % [69.0 %–73.3 %] | 12 [12–14]         | 5 [5–6]    |                             0.000 |
| nur Spanisch †                             | 0.000 [0.000–0.000] | 97.3 % [94.4 %–97.3 %] | 1 [1–2]            | 1 [1–2]    |                             0.000 |

## 2. Produktansicht (Gate, Top-12, Status)

| Teilmenge                                  | Gate bestanden | Status            | angezeigte Themen | davon ≥2 Mitglieder | Anteil Fragen in angezeigten Mehrfach-Themen |
| ------------------------------------------ | :------------: | ----------------- | ----------------: | ------------------: | -------------------------------------------: |
| Gesamtset (de/en/fr/es), Session-Locale de |       ✓        | ready             |                12 |                  12 |                                       26.0 % |
| nur Deutsch                                |       ✓        | ready             |                12 |                  12 |                                       35.6 % |
| nur Englisch                               |       ✓        | ready             |                12 |                   4 |                                       40.9 % |
| nur Französisch                            |       ✓        | fallback (Locale) |                10 |                   6 |                                       78.9 % |
| nur Spanisch                               |       ✓        | fallback (Locale) |                12 |                   1 |                                       10.5 % |

## 3. Ähnlichkeitsverteilung (Kosinus, Gesamtset)

| Paare                 |     n |   min |   p10 | Median |   p90 |   max |
| --------------------- | ----: | ----: | ----: | -----: | ----: | ----: |
| gleiche Familie       |   345 | 0.740 | 0.775 |  0.834 | 0.900 | 0.958 |
| verschiedene Familien | 10830 | 0.671 | 0.737 |  0.779 | 0.820 | 0.937 |

Paare verschiedener Familien ≥ 0.87: 82 · Paare gleicher Familie < 0.87: 249 von 345

## 4. Schwellen-Sweep (Encoder)

**Gesamtset (de/en/fr/es), Session-Locale de**

| Schwelle |   ARI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 | Falsch-Merge-Paare | Paar-Recall sprachübergr. |
| -------: | ----: | -------: | -------: | --------: | --------: | -----------------: | ------------------------: |
|     0.80 | 0.305 |   59.7 % |   53.3 % |    56.3 % |        36 |                201 |                    23.9 % |
|     0.82 | 0.336 |   68.4 % |   51.5 % |    58.8 % |        40 |                110 |                    21.6 % |
|     0.84 | 0.365 |   79.2 % |   50.9 % |    62.0 % |        43 |                 59 |                    20.8 % |
|     0.85 | 0.347 |   81.0 % |   49.4 % |    61.3 % |        45 |                 49 |                    19.2 % |
|     0.86 | 0.303 |   85.7 % |   46.4 % |    60.2 % |        40 |                 33 |                    16.1 % |
|   0.87 ◀ | 0.283 |   92.8 % |   44.5 % |    60.2 % |        35 |                 13 |                    15.3 % |
|     0.88 | 0.234 |   92.8 % |   42.3 % |    58.1 % |        34 |                 13 |                    11.4 % |
|     0.89 | 0.189 |   95.3 % |   39.9 % |    56.3 % |        33 |                  7 |                     9.0 % |
|     0.90 | 0.139 |   96.7 % |   37.7 % |    54.2 % |        26 |                  5 |                     8.2 % |
|     0.92 | 0.054 |   99.3 % |   34.1 % |    50.8 % |         9 |                  1 |                     3.5 % |

**nur Deutsch**

| Schwelle |   ARI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 | Falsch-Merge-Paare | Paar-Recall sprachübergr. |
| -------: | ----: | -------: | -------: | --------: | --------: | -----------------: | ------------------------: |
|     0.80 | 0.295 |   44.4 % |   78.0 % |    56.6 % |        18 |                171 |                         – |
|     0.82 | 0.397 |   57.9 % |   75.3 % |    65.4 % |        23 |                 84 |                         – |
|     0.84 | 0.458 |   70.9 % |   73.8 % |    72.3 % |        25 |                 51 |                         – |
|     0.85 | 0.450 |   74.0 % |   71.6 % |    72.7 % |        26 |                 41 |                         – |
|     0.86 | 0.424 |   82.1 % |   67.2 % |    73.9 % |        22 |                 23 |                         – |
|   0.87 ◀ | 0.363 |   89.1 % |   62.2 % |    73.3 % |        18 |                 12 |                         – |
|     0.88 | 0.339 |   90.2 % |   61.1 % |    72.9 % |        17 |                 11 |                         – |
|     0.89 | 0.269 |   94.4 % |   57.2 % |    71.3 % |        14 |                  5 |                         – |
|     0.90 | 0.117 |   95.6 % |   51.5 % |    66.9 % |        10 |                  4 |                         – |
|     0.92 | 0.022 |  100.0 % |   48.3 % |    65.2 % |         1 |                  0 |                         – |

**Sweep über 10 inkrementelle Läufe** – BCubed F1 bzw. Falsch-Merge-Paare, Median [min–max]

| Schwelle | Gesamtset F1           | Gesamtset Falsch-Merges | Deutsch F1             | Deutsch Falsch-Merges |
| -------: | ---------------------- | ----------------------- | ---------------------- | --------------------- |
|     0.80 | 57.4 % [54.6 %–60.9 %] | 187 [140–226]           | 58.6 % [56.0 %–59.9 %] | 158 [146–168]         |
|     0.82 | 59.0 % [57.9 %–62.0 %] | 109 [95–121]            | 66.1 % [64.3 %–69.7 %] | 82 [70–91]            |
|     0.84 | 61.6 % [60.9 %–64.4 %] | 60 [46–70]              | 73.4 % [71.2 %–74.9 %] | 48 [43–54]            |
|     0.85 | 61.4 % [60.4 %–63.5 %] | 43 [34–52]              | 74.7 % [72.2 %–77.3 %] | 33 [24–43]            |
|     0.86 | 60.3 % [59.9 %–61.7 %] | 30 [23–33]              | 75.0 % [73.7 %–77.0 %] | 21 [20–23]            |
|   0.87 ◀ | 59.1 % [58.8 %–60.3 %] | 16 [14–26]              | 73.0 % [72.6 %–73.8 %] | 13 [12–19]            |
|     0.88 | 57.7 % [57.3 %–58.5 %] | 12 [10–13]              | 72.9 % [71.7 %–73.6 %] | 10 [8–11]             |
|     0.89 | 56.2 % [55.9 %–56.9 %] | 7 [6–9]                 | 71.0 % [70.0 %–71.4 %] | 6 [4–6]               |
|     0.90 | 53.9 % [53.6 %–54.8 %] | 5 [4–6]                 | 67.7 % [67.0 %–69.2 %] | 3 [2–4]               |
|     0.92 | 51.1 % [50.8 %–51.2 %] | 1 [1–1]                 | 65.7 % [65.2 %–66.2 %] | 0 [0–0]               |

## 5. Gefundene Themen im Gesamtset (eine Gesamtanfrage)

**Encoder** (nur Themen mit ≥ 2 Mitgliedern; ✗ = mischt Familien)

| Label                                                                                                    | Konfidenz | Mitglieder             | Familien                     |
| -------------------------------------------------------------------------------------------------------- | --------: | ---------------------- | ---------------------------- |
| Le simulateur d'intervention ne démarre pas, l'écran reste noir.                                         |     0.949 | Q674, Q675, Q676       | P-SIM                        |
| What if they refuse?                                                                                     |     0.937 | Q716, Q717             | ✗ S-P-AMB-08, S-P-AMB-09     |
| El vídeo de la cámara corporal del ejercicio no se reproduce.                                            |     0.927 | Q692, Q693             | P-BODYCAM                    |
| À quel moment faut-il informer une personne de ses droits en tant que suspect et non plus comme témoin ? |     0.914 | Q602, Q603             | P-BELEHRUNG                  |
| Comment s'adresser à une personne agitée pour éviter que la situation dégénère ?                         |     0.914 | Q622, Q623             | P-DEESK                      |
| Is there a make-up date for the fitness test if I was ill?                                               |     0.911 | Q643, Q644             | P-SPORT                      |
| No puedo entrar en el sistema de gestión de expedientes de formación, rechaza la contraseña.             |     0.918 | Q681, Q680, Q682       | P-VBS                        |
| Wo steht das?                                                                                            |      0.91 | Q710, Q715             | ✗ S-P-AMB-02, S-P-AMB-07     |
| ¿Qué requisitos deben cumplirse para usar el arma de fuego contra una persona?                           |     0.907 | Q609, Q610             | P-UZWANG                     |
| Welche Gesetzestexte dürfen wir in die Klausur mitnehmen?                                                |     0.907 | Q659, Q660             | P-GESETZ                     |
| Pouvez-vous réexpliquer la différence entre légitime défense et état de nécessité ?                      |     0.905 | Q579, Q580             | P-NOTWEHR                    |
| Faut-il porter l'uniforme pendant les cours théoriques ?                                                 |      0.91 | Q658, Q656, Q657       | P-UNIFORM                    |
| Wie fit muss man für den Sporttest wirklich sein?                                                        |     0.903 | Q642, Q705             | ✗ P-SPORT, S-P-NM-12         |
| The bodycam footage from the role play won't play.                                                       |     0.902 | Q689, Q691             | P-BODYCAM                    |
| Das Video von der Bodycam bricht nach ein paar Sekunden ab.                                              |     0.901 | Q690, Q707             | ✗ P-BODYCAM, S-P-NM-14       |
| In welcher Reihenfolge werden Spuren am Tatort gesichert?                                                |     0.907 | Q611, Q612, Q614       | P-SPUREN                     |
| Das Funkgerät zeigt nur »kein Netz« an, obwohl wir im Übungsgelände sind.                                |       0.9 | Q684, Q685             | P-FUNK                       |
| Und im Praktikum?                                                                                        |     0.898 | Q649, Q713             | ✗ P-PRAKT, S-P-AMB-05        |
| ¡Gracias, muy claro!                                                                                     |     0.895 | Q718, Q723             | ✗ S-P-NOISE-01, S-P-NOISE-06 |
| Welche Voraussetzungen müssen für den Schusswaffengebrauch gegen Personen vorliegen?                     |     0.901 | Q607, Q604, Q605       | P-UZWANG                     |
| Comment préserver les traces sur une scène de crime sans les contaminer ?                                |     0.893 | Q615, Q616             | P-SPUREN                     |
| vorgangsbearbeitung schulung login geht nicht                                                            |     0.899 | Q678, Q677, Q679       | P-VBS                        |
| Kann man sich die Dienststelle für das Praktikum wünschen?                                               |       0.9 | Q648, Q646, Q647       | P-PRAKT                      |
| Beim Schießsimulator werden die Treffer gerade nicht mehr erkannt.                                       |     0.896 | Q672, Q697, Q671, Q673 | ✗ P-SIM, S-P-NM-04           |
| Kommt die Prüfung der Notwehr in der Klausur dran?                                                       |     0.885 | Q694, Q708             | ✗ S-P-NM-01, S-P-NM-15       |
| Where do we meet for the operational training in the training hall?                                      |     0.894 | Q665, Q668, Q669, Q670 | P-HALLE                      |
| Fällt das Schießtraining am Freitag wegen der Prüfungswoche aus?                                         |      0.89 | Q667, Q632, Q634       | ✗ P-HALLE, P-SCHIESS         |
| schiesstraining morgen wo treffpunkt                                                                     |      0.88 | Q635, Q721             | ✗ P-SCHIESS, S-P-NOISE-04    |
| Welche Zeiten muss man beim Sporttest für die Laufstrecke schaffen?                                      |      0.88 | Q639, Q640             | P-SPORT                      |
| Où se situe la limite entre l'obligation de poursuivre et le pouvoir d'appréciation de la police ?       |     0.879 | Q630, Q631             | P-LEGAL                      |
| How do I check whether a police measure is proportionate?                                                |     0.898 | Q596, Q593, Q595       | P-VERHAELT                   |
| Quelle est la différence entre l'arrestation par un citoyen et celle par la police ?                     |     0.896 | Q588, Q586, Q587       | P-FESTNAHME                  |
| Quand et où a lieu le prochain entraînement au tir ?                                                     |     0.897 | Q636, Q637, Q638       | P-SCHIESS                    |
| notwehr oder notstand was is der unterschied                                                             |     0.891 | Q575, Q574, Q577       | P-NOTWEHR                    |
| Nos radios d'entraînement n'arrivent pas à se connecter.                                                 |     0.899 | Q683, Q688, Q686, Q687 | P-FUNK                       |

**Lexikalisch** (nur Themen mit ≥ 2 Mitgliedern; ✗ = mischt Familien)

| Label                | Konfidenz | Mitglieder                         | Familien                                     |
| -------------------- | --------: | ---------------------------------- | -------------------------------------------- |
| police               |         – | Q595, Q593, Q630, Q587, Q586, Q629 | ✗ P-VERHAELT, P-LEGAL, P-FESTNAHME           |
| Klausur              |         – | Q660, Q661, Q708, Q694, Q659       | ✗ P-GESETZ, S-P-NM-15, S-P-NM-01             |
| Person               |         – | Q622, Q591, Q608, Q618, Q620       | ✗ P-DEESK, P-VERHAELT, P-UZWANG              |
| Praktikum            |         – | Q647, Q648, Q713, Q646, Q649       | ✗ P-PRAKT, S-P-AMB-05                        |
| Sporttest            |         – | Q640, Q705, Q639, Q642, Q641       | ✗ P-SPORT, S-P-NM-12                         |
| Cómo                 |         – | Q596, Q624, Q617, Q603             | ✗ P-VERHAELT, P-DEESK, P-SPUREN, P-BELEHRUNG |
| Einsatztraining      |         – | Q667, Q666, Q696, Q665             | ✗ P-HALLE, S-P-NM-03                         |
| entre                |         – | Q631, Q580, Q588, Q579             | ✗ P-LEGAL, P-NOTWEHR, P-FESTNAHME            |
| personne             |         – | Q602, Q623, Q717, Q609             | ✗ P-BELEHRUNG, P-DEESK, S-P-AMB-09, P-UZWANG |
| Schießtraining       |         – | Q634, Q702, Q635, Q632             | ✗ P-SCHIESS, S-P-NM-09                       |
| training             |         – | Q680, Q686, Q674, Q668             | ✗ P-VBS, P-FUNK, P-SIM, P-HALLE              |
| Vorgangsbearbeitung  |         – | Q678, Q677, Q699, Q679             | ✗ P-VBS, S-P-NM-06                           |
| Festnahme            |         – | Q585, Q701, Q581                   | ✗ P-FESTNAHME, S-P-NM-08                     |
| genau                |         – | Q597, Q584, Q625                   | ✗ P-BELEHRUNG, P-FESTNAHME, P-LEGAL          |
| Gilt                 |         – | Q709, Q599, Q698                   | ✗ S-P-AMB-01, P-BELEHRUNG, S-P-NM-05         |
| para                 |         – | Q670, Q645, Q610                   | ✗ P-HALLE, P-SPORT, P-UZWANG                 |
| Schusswaffengebrauch |         – | Q607, Q605, Q604                   | P-UZWANG                                     |
| Tatort               |         – | Q612, Q614, Q611                   | P-SPUREN                                     |
| vidéo                |         – | Q690, Q693, Q692                   | P-BODYCAM                                    |
| belehrung            |         – | Q600, Q598                         | P-BELEHRUNG                                  |
| bodycam              |         – | Q695, Q691                         | ✗ S-P-NM-02, P-BODYCAM                       |
| Cuándo               |         – | Q652, Q638                         | ✗ P-PRAKT, P-SCHIESS                         |
| difference           |         – | Q578, Q594                         | ✗ P-NOTWEHR, P-VERHAELT                      |
| entraînement         |         – | Q687, Q637                         | ✗ P-FUNK, P-SCHIESS                          |
| examen               |         – | Q664, Q663                         | P-GESETZ                                     |
| Gruppe               |         – | Q685, Q720                         | ✗ P-FUNK, S-P-NOISE-03                       |
| have                 |         – | Q656, Q601                         | ✗ P-UNIFORM, P-BELEHRUNG                     |
| notwehr              |         – | Q574, Q577                         | P-NOTWEHR                                    |
| pour                 |         – | Q669, Q644                         | ✗ P-HALLE, P-SPORT                           |
| Simulator            |         – | Q673, Q697                         | ✗ P-SIM, S-P-NM-04                           |
| Verhältnismäßigkeit  |         – | Q703, Q589                         | ✗ S-P-NM-10, P-VERHAELT                      |

## 6. Falsch zusammengeführte Paare (Encoder, Gesamtset)

- Q632 »Wann ist das nächste Schießtraining und auf welchem Schießstand?« ↔ Q667 »Fängt das Einsatztraining morgen wirklich schon um sieben an?«
- Q634 »Fällt das Schießtraining am Freitag wegen der Prüfungswoche aus?« ↔ Q667 »Fängt das Einsatztraining morgen wirklich schon um sieben an?«
- Q635 »schiesstraining morgen wo treffpunkt« ↔ Q721 »Bis morgen in der Halle!«
- Q642 »Wie fit muss man für den Sporttest wirklich sein?« ↔ Q705 »Ist der Sporttest eigentlich ein must für die Übernahme in den Dienst?«
- Q649 »Wer ist im Praktikum unser Ansprechpartner auf der Wache?« ↔ Q713 »Und im Praktikum?«
- Q671 »Der Einsatzsimulator startet nicht, die Leinwand bleibt schwarz.« ↔ Q697 »Im Simulator ist das Bild so verzerrt, dass man die Waffe des Gegenübers nicht erkennt.«
- Q672 »Beim Schießsimulator werden die Treffer gerade nicht mehr erkannt.« ↔ Q697 »Im Simulator ist das Bild so verzerrt, dass man die Waffe des Gegenübers nicht erkennt.«
- Q673 »Der Simulator hängt mitten im Szenario fest.« ↔ Q697 »Im Simulator ist das Bild so verzerrt, dass man die Waffe des Gegenübers nicht erkennt.«
- Q690 »Das Video von der Bodycam bricht nach ein paar Sekunden ab.« ↔ Q707 »Das Lernvideo zur Eigensicherung bleibt nach zwei Minuten hängen.«
- Q694 »Kommt die Prüfung der Notwehr in der Klausur dran?« ↔ Q708 »Kann man die Klausur im Eingriffsrecht nachschreiben, wenn man im Nachtdienst war?«
- Q710 »Wo steht das?« ↔ Q715 »Zählt das?«
- Q716 »What if they refuse?« ↔ Q717 »Et si la personne refuse ?«
- Q718 »Danke für die Einheit, war richtig gut!« ↔ Q723 »¡Gracias, muy claro!«

## 7. Laufzeit und Ressourcen

Kaltstart Container → /health: 1.7 s · erster Embed-Aufruf (150 Texte): 2739 ms · Image 1497 MB · Container nach Last: 478.7MiB / 2GiB|11.26%

| Texte pro Anfrage |     p50 |     p95 |     max | ms/Text (p50) |
| ----------------: | ------: | ------: | ------: | ------------: |
|                16 |  293 ms |  388 ms |  388 ms |          18.3 |
|                56 | 1078 ms | 1377 ms | 1377 ms |          19.2 |
|               150 | 2464 ms | 2539 ms | 2539 ms |          16.4 |

Clustering in Node (naive Complete-Linkage, ein Thread):

| Texte |    Zeit |
| ----: | ------: |
|   100 |   48 ms |
|   250 |  368 ms |
|   500 | 1921 ms |

## Gültigkeitsgrenzen

- Synthetisches Referenzset; ein Annotator; Familien sind sprachunabhängig definiert.
- Laborbetrieb über loopback-HTTP statt Unix-Socket; Transport-Overhead daher nicht produktionsgleich.
- Embedding-Cache der App (Redis/In-Process) nicht genutzt: Latenzen sind Kaltpfad-Werte je Anfrage.
- Themenhäufigkeit ist kein Lernstandsmaß.
