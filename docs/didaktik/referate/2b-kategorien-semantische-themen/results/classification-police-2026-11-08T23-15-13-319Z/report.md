# Referat 2B – Klassifikationsmessung 8.9b

Commit `74091b0a6468` (v1.3.0-364-g74091b0a-dirty), Referenzset 2.2.0 (SHA-256 `717bdb17dc2e94d5…`), 2026-11-08T23:15:13.319Z
Node v24.22.2, Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz × 8, 31.9 GB RAM, win32 10.0.19045 x64

Umfang: 150 von 723 Items, Domäne police, Sprachen de, en, fr, es (+ mixed); Italienisch ausgeschlossen (Untersuchungsumfang an Wortwolken-Locales angeglichen).

Gelabelt: 135 Items · erwartet unsicher (mehrdeutig/Rauschen): 15 · Betriebspunkt `QA_NLP_MIN_CONFIDENCE` = 0.55

## 1. Hauptergebnis (Originalschreibung, Betriebspunkt)

| System                                 | Best-Guess-Acc. | Macro-F1 | Abdeckung | Präzision akzeptiert | Nutzbar korrekt | Falsch akzeptiert | Enthaltung mehrdeutig/Rauschen |
| -------------------------------------- | --------------: | -------: | --------: | -------------------: | --------------: | ----------------: | -----------------------------: |
| Keyword-Baseline (regelbasiert)        |          50.4 % |    0.294 |    12.6 % |               47.1 % |           5.9 % |             6.7 % |                         93.3 % |
| Gatekeeper (Naive Bayes, nur Schwelle) |          50.4 % |    0.488 |    97.8 % |               51.5 % |          50.4 % |            47.4 % |                         20.0 % |
| Kaskade 1.3 (Gatekeeper + k-NN)        |          51.9 % |    0.506 |    96.3 % |               52.3 % |          50.4 % |            45.9 % |                         46.7 % |

_Nutzbar korrekt_ = akzeptiert und richtig, bezogen auf alle gelabelten Items. _Falsch akzeptiert_ = Lehrperson sieht eine sichere, aber falsche Kategorie.

### 95-%-Bootstrap-Intervalle

| System                                 | Nutzbar korrekt  | Präzision akzeptiert | Abdeckung         | Macro-F1       |
| -------------------------------------- | ---------------- | -------------------- | ----------------- | -------------- |
| Keyword-Baseline (regelbasiert)        | [2.2 %; 10.4 %]  | [23.1 %; 72.2 %]     | [7.4 %; 18.5 %]   | [0.221; 0.372] |
| Gatekeeper (Naive Bayes, nur Schwelle) | [42.2 %; 59.3 %] | [43.0 %; 60.8 %]     | [94.8 %; 100.0 %] | [0.392; 0.579] |
| Kaskade 1.3 (Gatekeeper + k-NN)        | [42.2 %; 59.3 %] | [43.8 %; 61.2 %]     | [93.3 %; 99.3 %]  | [0.412; 0.595] |

### Paarvergleich (exakter McNemar-Test, gepaart über dieselben Items)

| Vergleich             | Merkmal            | nur A richtig | nur B richtig |      p |
| --------------------- | ------------------ | ------------: | ------------: | -----: |
| cascade vs keyword    | nutzbar korrekt    |            62 |             2 | 0.0000 |
| cascade vs keyword    | Best-Guess korrekt |            34 |            32 | 0.9022 |
| gatekeeper vs keyword | nutzbar korrekt    |            62 |             2 | 0.0000 |
| gatekeeper vs keyword | Best-Guess korrekt |            33 |            33 | 1.0000 |
| cascade vs gatekeeper | nutzbar korrekt    |             1 |             1 | 1.0000 |
| cascade vs gatekeeper | Best-Guess korrekt |             2 |             0 | 0.5000 |

Kaskadenpfade: early-exit 127, fallback 8

## 2. Schwellen-Sweep

Vorab festgelegte Kriterien (Releasekonstanten): Präzision akzeptiert ≥ 80.0 %, Unsicher-Rate ≤ 30.0 %.

**Keyword-Baseline (regelbasiert)**

| Schwelle | Abdeckung | Präzision akz. | Nutzbar korrekt | Falsch akz. | Enthaltung mehrd. | Kriterien |
| -------: | --------: | -------------: | --------------: | ----------: | ----------------: | :-------: |
|     0.35 |    13.3 % |         44.4 % |           5.9 % |       7.4 % |            93.3 % |     –     |
|     0.40 |    13.3 % |         44.4 % |           5.9 % |       7.4 % |            93.3 % |     –     |
|     0.45 |    13.3 % |         44.4 % |           5.9 % |       7.4 % |            93.3 % |     –     |
|     0.50 |    13.3 % |         44.4 % |           5.9 % |       7.4 % |            93.3 % |     –     |
|   0.55 ◀ |    12.6 % |         47.1 % |           5.9 % |       6.7 % |            93.3 % |     –     |
|     0.60 |    12.6 % |         47.1 % |           5.9 % |       6.7 % |            93.3 % |     –     |
|     0.65 |    12.6 % |         47.1 % |           5.9 % |       6.7 % |            93.3 % |     –     |
|     0.70 |    12.6 % |         47.1 % |           5.9 % |       6.7 % |            93.3 % |     –     |
|     0.80 |    12.6 % |         47.1 % |           5.9 % |       6.7 % |            93.3 % |     –     |
|     0.90 |    12.6 % |         47.1 % |           5.9 % |       6.7 % |            93.3 % |     –     |

**Gatekeeper (Naive Bayes, nur Schwelle)**

| Schwelle | Abdeckung | Präzision akz. | Nutzbar korrekt | Falsch akz. | Enthaltung mehrd. | Kriterien |
| -------: | --------: | -------------: | --------------: | ----------: | ----------------: | :-------: |
|     0.35 |   100.0 % |         50.4 % |          50.4 % |      49.6 % |             0.0 % |     –     |
|     0.40 |   100.0 % |         50.4 % |          50.4 % |      49.6 % |             6.7 % |     –     |
|     0.45 |   100.0 % |         50.4 % |          50.4 % |      49.6 % |            13.3 % |     –     |
|     0.50 |    99.3 % |         50.7 % |          50.4 % |      48.9 % |            20.0 % |     –     |
|   0.55 ◀ |    97.8 % |         51.5 % |          50.4 % |      47.4 % |            20.0 % |     –     |
|     0.60 |    94.8 % |         52.3 % |          49.6 % |      45.2 % |            26.7 % |     –     |
|     0.65 |    91.9 % |         53.2 % |          48.9 % |      43.0 % |            40.0 % |     –     |
|     0.70 |    87.4 % |         54.2 % |          47.4 % |      40.0 % |            46.7 % |     –     |
|     0.80 |    80.7 % |         56.0 % |          45.2 % |      35.6 % |            46.7 % |     –     |
|     0.90 |    67.4 % |         56.0 % |          37.8 % |      29.6 % |            53.3 % |     –     |

**Kaskade 1.3 (Gatekeeper + k-NN)**

| Schwelle | Abdeckung | Präzision akz. | Nutzbar korrekt | Falsch akz. | Enthaltung mehrd. | Kriterien |
| -------: | --------: | -------------: | --------------: | ----------: | ----------------: | :-------: |
|     0.35 |    95.6 % |         51.9 % |          49.6 % |      45.9 % |            53.3 % |     –     |
|     0.40 |    95.6 % |         51.9 % |          49.6 % |      45.9 % |            53.3 % |     –     |
|     0.45 |    95.6 % |         51.9 % |          49.6 % |      45.9 % |            53.3 % |     –     |
|     0.50 |    96.3 % |         52.3 % |          50.4 % |      45.9 % |            46.7 % |     –     |
|   0.55 ◀ |    96.3 % |         52.3 % |          50.4 % |      45.9 % |            46.7 % |     –     |
|     0.60 |    97.0 % |         53.4 % |          51.9 % |      45.2 % |            46.7 % |     –     |
|     0.65 |    94.8 % |         53.9 % |          51.1 % |      43.7 % |            46.7 % |     –     |
|     0.70 |    92.6 % |         54.4 % |          50.4 % |      42.2 % |            46.7 % |     –     |
|     0.80 |    90.4 % |         54.9 % |          49.6 % |      40.7 % |            46.7 % |     –     |
|     0.90 |    83.0 % |         51.8 % |          43.0 % |      40.0 % |            46.7 % |     –     |

## 3. Slices (Betriebspunkt)

**Sprache** – nutzbar korrekt / falsch akzeptiert (n)

| Sprache |   n | keyword        | gatekeeper      | cascade         |
| ------- | --: | -------------- | --------------- | --------------- |
| de      |  79 | 5.1 % / 7.6 %  | 49.4 % / 48.1 % | 49.4 % / 46.8 % |
| en      |  20 | 15.0 % / 5.0 % | 55.0 % / 45.0 % | 55.0 % / 45.0 % |
| fr      |  18 | 5.6 % / 5.6 %  | 50.0 % / 44.4 % | 50.0 % / 44.4 % |
| es      |  18 | 0.0 % / 5.6 %  | 50.0 % / 50.0 % | 50.0 % / 44.4 % |

**Tag** – nutzbar korrekt / falsch akzeptiert (n)

| Tag           |   n | keyword         | gatekeeper      | cascade         |
| ------------- | --: | --------------- | --------------- | --------------- |
| canonical     |  72 | 5.6 % / 5.6 %   | 48.6 % / 47.2 % | 50.0 % / 45.8 % |
| out-of-domain | 135 | 5.9 % / 6.7 %   | 50.4 % / 47.4 % | 50.4 % / 45.9 % |
| typo          |   4 | 25.0 % / 0.0 %  | 75.0 % / 25.0 % | 50.0 % / 25.0 % |
| code-switch   |   2 | 0.0 % / 0.0 %   | 50.0 % / 50.0 % | 50.0 % / 50.0 % |
| slang         |   2 | 0.0 % / 50.0 %  | 50.0 % / 50.0 % | 50.0 % / 50.0 % |
| short         |   3 | 33.3 % / 0.0 %  | 66.7 % / 33.3 % | 33.3 % / 33.3 % |
| near-miss     |  16 | 18.8 % / 12.5 % | 56.3 % / 43.8 % | 56.3 % / 43.8 % |

**Gold-Kategorie** – nutzbar korrekt / falsch akzeptiert (n)

| Gold-Kategorie |   n | keyword        | gatekeeper      | cascade         |
| -------------- | --: | -------------- | --------------- | --------------- |
| content        |  65 | 6.2 % / 1.5 %  | 49.2 % / 50.8 % | 49.2 % / 49.2 % |
| organization   |  44 | 4.5 % / 15.9 % | 59.1 % / 36.4 % | 56.8 % / 36.4 % |
| technical      |  26 | 7.7 % / 3.8 %  | 38.5 % / 57.7 % | 42.3 % / 53.8 % |

## 4. Kalibrierung der Konfidenz

**Gatekeeper (Naive Bayes, nur Schwelle)** – ECE 0.403

| Konfidenzbereich |   n | mittlere Konfidenz | tatsächliche Acc. |
| ---------------- | --: | -----------------: | ----------------: |
| [0.00, 0.40)     |   0 |                  – |                 – |
| [0.40, 0.55)     |   3 |              0.523 |             0.0 % |
| [0.55, 0.70)     |  14 |              0.632 |            28.6 % |
| [0.70, 0.85)     |  15 |              0.787 |            46.7 % |
| [0.85, 1.00]     | 103 |              0.973 |            55.3 % |

**Kaskade 1.3 (Gatekeeper + k-NN)** – ECE 0.389

| Konfidenzbereich |   n | mittlere Konfidenz | tatsächliche Acc. |
| ---------------- | --: | -----------------: | ----------------: |
| [0.00, 0.40)     |   0 |                  – |                 – |
| [0.40, 0.55)     |   2 |              0.539 |             0.0 % |
| [0.55, 0.70)     |  14 |              0.637 |            35.7 % |
| [0.70, 0.85)     |  17 |              0.788 |            52.9 % |
| [0.85, 1.00]     | 102 |              0.972 |            54.9 % |

## 5. Kontrollierte Variante: Transliteration

Seed und Keyword-Liste sind transliteriert. Gleiche Items, DE/mixed mit ä→ae usw.

| System                                 | Nutzbar korrekt (orig → translit) | Falsch akzeptiert (orig → translit) | Macro-F1 (orig → translit) |
| -------------------------------------- | --------------------------------- | ----------------------------------- | -------------------------- |
| Keyword-Baseline (regelbasiert)        | 5.9 % → 6.7 %                     | 6.7 % → 6.7 %                       | 0.294 → 0.294              |
| Gatekeeper (Naive Bayes, nur Schwelle) | 50.4 % → 49.6 %                   | 47.4 % → 47.4 %                     | 0.488 → 0.477              |
| Kaskade 1.3 (Gatekeeper + k-NN)        | 50.4 % → 50.4 %                   | 45.9 % → 47.4 %                     | 0.506 → 0.503              |

## 6. Laufzeit und Ressourcen

Kaltstart: Gatekeeper-Training 4.32 ms, k-NN-Prototypen 7.42 ms, Heap-Δ 19.0 MB, RSS-Δ 38.9 MB (inkl. Modulimport).

Warm, 20 Durchläufe × 150 Texte, ein Thread:

| System                                 |   p50 |    p95 |    p99 |    max | Durchsatz/s |
| -------------------------------------- | ----: | -----: | -----: | -----: | ----------: |
| Keyword-Baseline (regelbasiert)        |  8 µs |  11 µs |  14 µs | 451 µs |     118.482 |
| Gatekeeper (Naive Bayes, nur Schwelle) | 20 µs |  37 µs |  69 µs | 439 µs |      44.574 |
| Kaskade 1.3 (Gatekeeper + k-NN)        | 27 µs | 183 µs | 223 µs | 757 µs |      19.824 |

Produktions-Timeout je Job: 2000 ms (Queue/Worker-Overhead hier nicht gemessen).

## 7. Fehlerfälle (Betriebspunkt, Originalschreibung)

**Keyword-Baseline (regelbasiert)** – 10 sicher, aber falsch bzw. trotz Mehrdeutigkeit akzeptiert

| ID   | Text                                                                               | Gold                  | Vorhersage   | Konfidenz |
| ---- | ---------------------------------------------------------------------------------- | --------------------- | ------------ | --------: |
| Q621 | Was macht man, wenn einer total austickt und gar nicht mehr zuhört?                | content               | technical    |     1.000 |
| Q659 | Welche Gesetzestexte dürfen wir in die Klausur mitnehmen?                          | organization          | content      |     1.000 |
| Q660 | Dürfen im Gesetzestext für die Klausur Markierungen und Klebezettel sein?          | organization          | content      |     1.000 |
| Q661 | Ist ein Kommentar zum Polizeigesetz in der Klausur erlaubt?                        | organization          | content      |     1.000 |
| Q662 | Which statute books are we allowed to bring into the exam?                         | organization          | content      |     1.000 |
| Q663 | Quels codes avons-nous le droit d'apporter à l'examen ?                            | organization          | content      |     1.000 |
| Q664 | ¿Qué textos legales podemos llevar al examen?                                      | organization          | content      |     1.000 |
| Q685 | Bei Gruppe 3 kommt im Funk nur Rauschen an.                                        | technical             | organization |     1.000 |
| Q708 | Kann man die Klausur im Eingriffsrecht nachschreiben, wenn man im Nachtdienst war? | organization          | content      |     1.000 |
| Q720 | Respekt an Gruppe 2, starke Übung                                                  | – (unsicher erwartet) | organization |     1.000 |

**Gatekeeper (Naive Bayes, nur Schwelle)** – 76 sicher, aber falsch bzw. trotz Mehrdeutigkeit akzeptiert

| ID   | Text                                                                                                     | Gold                             | Vorhersage   | Konfidenz |
| ---- | -------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------ | --------: |
| Q576 | Wann ist eine Notwehrhandlung nicht mehr geboten?                                                        | content                          | technical    |     0.877 |
| Q582 | Braucht die Polizei für § 127 Abs. 2 StPO immer Gefahr im Verzug?                                        | content                          | technical    |     0.765 |
| Q585 | Ist die vorläufige Festnahme basically dasselbe wie eine Ingewahrsamnahme?                               | content                          | organization |     0.654 |
| Q589 | Wie prüfe ich die Verhältnismäßigkeit einer Maßnahme Schritt für Schritt?                                | content                          | organization |     0.795 |
| Q591 | Ist eine Identitätsfeststellung schon unverhältnismäßig, wenn die Person kooperiert?                     | content                          | organization |     0.999 |
| Q592 | Muss ich immer das mildeste Mittel wählen, auch wenn es weniger sicher ist?                              | content                          | organization |     1.000 |
| Q593 | How do I check whether a police measure is proportionate?                                                | content                          | organization |     1.000 |
| Q597 | Wann genau muss ich jemanden als Beschuldigten belehren und nicht mehr als Zeugen?                       | content                          | organization |     0.875 |
| Q598 | Was passiert mit der Aussage, wenn die Belehrung vergessen wurde?                                        | content                          | organization |     0.577 |
| Q600 | belehrung zeuge vs beschuldigter wann wechselt das                                                       | content                          | organization |     0.988 |
| Q601 | When do I have to caution someone as a suspect instead of a witness?                                     | content                          | organization |     0.996 |
| Q602 | À quel moment faut-il informer une personne de ses droits en tant que suspect et non plus comme témoin ? | content                          | organization |     0.643 |
| Q604 | Welche Voraussetzungen müssen für den Schusswaffengebrauch gegen Personen vorliegen?                     | content                          | organization |     1.000 |
| Q605 | Muss der Schusswaffengebrauch immer vorher angedroht werden?                                             | content                          | organization |     1.000 |
| Q607 | Ist ein Warnschuss rechtlich ein eigener Schusswaffengebrauch?                                           | content                          | organization |     1.000 |
| Q608 | What conditions have to be met before an officer may use a firearm against a person?                     | content                          | organization |     0.742 |
| Q610 | ¿Qué requisitos deben cumplirse para usar el arma de fuego contra una persona?                           | content                          | organization |     0.563 |
| Q612 | In welcher Reihenfolge werden Spuren am Tatort gesichert?                                                | content                          | organization |     0.898 |
| Q613 | Warum dürfen DNA-Spuren nicht in Plastiktüten verpackt werden?                                           | content                          | organization |     0.908 |
| Q614 | Wer darf den Tatort betreten, bevor die Spurensicherung da ist?                                          | content                          | organization |     0.997 |
| Q615 | How do I secure evidence at a crime scene without contaminating it?                                      | content                          | organization |     0.647 |
| Q617 | ¿Cómo se aseguran las huellas en la escena del crimen sin contaminarlas?                                 | content                          | organization |     0.979 |
| Q618 | Wie spreche ich eine aufgebrachte Person an, damit die Lage nicht eskaliert?                             | content                          | organization |     0.844 |
| Q619 | Wann ist Duzen in einer Konfliktsituation sinnvoll und wann schadet es?                                  | content                          | organization |     0.998 |
| Q621 | Was macht man, wenn einer total austickt und gar nicht mehr zuhört?                                      | content                          | technical    |     1.000 |
| Q622 | How should I talk to an agitated person so the situation does not escalate?                              | content                          | technical    |     0.970 |
| Q625 | Wo genau liegt die Grenze zwischen Legalitätsprinzip und Opportunitätsprinzip?                           | content                          | technical    |     0.940 |
| Q626 | Muss ich jede Straftat anzeigen, die ich in der Freizeit mitbekomme?                                     | content                          | organization |     0.944 |
| Q631 | ¿Dónde está el límite entre la obligación de perseguir y la discrecionalidad policial?                   | content                          | organization |     0.620 |
| Q632 | Wann ist das nächste Schießtraining und auf welchem Schießstand?                                         | organization                     | content      |     0.790 |
| Q634 | Fällt das Schießtraining am Freitag wegen der Prüfungswoche aus?                                         | organization                     | technical    |     0.692 |
| Q638 | ¿Cuándo y dónde es el próximo entrenamiento de tiro?                                                     | organization                     | content      |     0.989 |
| Q641 | Zählt der Sporttest in die Abschlussnote oder ist er nur bestanden/nicht bestanden?                      | organization                     | technical    |     0.963 |
| Q651 | Quand saurons-nous dans quel commissariat nous ferons notre stage ?                                      | organization                     | technical    |     0.946 |
| Q652 | ¿Cuándo sabremos en qué comisaría haremos las prácticas?                                                 | organization                     | content      |     0.775 |
| Q654 | Wann ist die nächste Ausgabe der Ausrüstung in der Kleiderkammer?                                        | organization                     | content      |     0.999 |
| Q655 | Was mache ich, wenn meine Dienstjacke die falsche Größe hat?                                             | organization                     | technical    |     0.703 |
| Q657 | Faut-il porter l'uniforme pendant les cours théoriques ?                                                 | organization                     | content      |     0.859 |
| Q658 | ¿Tenemos que llevar uniforme en las clases teóricas?                                                     | organization                     | content      |     0.972 |
| Q661 | Ist ein Kommentar zum Polizeigesetz in der Klausur erlaubt?                                              | organization                     | content      |     0.819 |
| Q663 | Quels codes avons-nous le droit d'apporter à l'examen ?                                                  | organization                     | content      |     0.666 |
| Q665 | Wo treffen wir uns für das Einsatztraining in der Trainingshalle?                                        | organization                     | content      |     0.978 |
| Q668 | Where do we meet for the operational training in the training hall?                                      | organization                     | content      |     0.995 |
| Q669 | Où se retrouve-t-on pour l'entraînement opérationnel dans la salle ?                                     | organization                     | content      |     1.000 |
| Q673 | Der Simulator hängt mitten im Szenario fest.                                                             | technical                        | content      |     0.556 |
| Q676 | El simulador de intervención no arranca, la pantalla sigue en negro.                                     | technical                        | content      |     1.000 |
| Q678 | Die Übungsversion der Vorgangsbearbeitung meldet nur »Sitzung abgelaufen«.                               | technical                        | content      |     0.867 |
| Q681 | Je n'arrive pas à me connecter au logiciel de gestion des procédures en formation.                       | technical                        | content      |     0.938 |
| Q682 | No puedo entrar en el sistema de gestión de expedientes de formación, rechaza la contraseña.             | technical                        | content      |     1.000 |
| Q683 | Unsere Digitalfunk-Übungsgeräte bekommen keine Verbindung.                                               | technical                        | organization |     0.997 |
| Q685 | Bei Gruppe 3 kommt im Funk nur Rauschen an.                                                              | technical                        | organization |     0.981 |
| Q686 | Our training radios are not connecting to the network.                                                   | technical                        | content      |     0.929 |
| Q687 | Nos radios d'entraînement n'arrivent pas à se connecter.                                                 | technical                        | organization |     0.967 |
| Q689 | Die Bodycam-Aufnahme aus dem Rollenspiel lässt sich nicht abspielen.                                     | technical                        | content      |     0.985 |
| Q691 | The bodycam footage from the role play won't play.                                                       | technical                        | organization |     0.997 |
| Q692 | La vidéo de la caméra-piéton de l'exercice ne se lance pas.                                              | technical                        | content      |     1.000 |
| Q693 | El vídeo de la cámara corporal del ejercicio no se reproduce.                                            | technical                        | content      |     1.000 |
| Q695 | Ist die Bodycam rechtlich eine offene oder eine verdeckte Maßnahme?                                      | content                          | organization |     1.000 |
| Q696 | Wird das Einsatztraining auf Video aufgezeichnet?                                                        | organization                     | content      |     0.686 |
| Q698 | Welche Rufnamen-Systematik gilt im Funkverkehr bei größeren Einsatzlagen?                                | content                          | organization |     0.939 |
| Q699 | Ist der Übungsfall in der Vorgangsbearbeitung ein Hausfriedensbruch oder nicht?                          | content                          | technical    |     0.883 |
| Q703 | Die Folie mit dem Prüfschema zur Verhältnismäßigkeit ist auf dem Beamer abgeschnitten.                   | technical                        | organization |     0.999 |
| Q704 | Will the use-of-force rules be on the written exam?                                                      | content                          | organization |     0.903 |
| Q707 | Das Lernvideo zur Eigensicherung bleibt nach zwei Minuten hängen.                                        | technical                        | organization |     0.999 |
| Q709 | Gilt das auch im Streifendienst?                                                                         | content (unsicher erwartet)      | technical    |     0.573 |
| Q710 | Wo steht das?                                                                                            | content (unsicher erwartet)      | technical    |     0.681 |
| Q713 | Und im Praktikum?                                                                                        | organization (unsicher erwartet) | technical    |     0.952 |
| Q714 | Geht das auch auf dem Dienst-Tablet?                                                                     | technical (unsicher erwartet)    | technical    |     0.998 |
| Q715 | Zählt das?                                                                                               | organization (unsicher erwartet) | technical    |     0.622 |
| Q716 | What if they refuse?                                                                                     | content (unsicher erwartet)      | content      |     0.975 |
| Q717 | Et si la personne refuse ?                                                                               | content (unsicher erwartet)      | content      |     0.648 |
| Q718 | Danke für die Einheit, war richtig gut!                                                                  | – (unsicher erwartet)            | organization |     0.975 |
| Q719 | Moin zusammen                                                                                            | – (unsicher erwartet)            | organization |     0.920 |
| Q720 | Respekt an Gruppe 2, starke Übung                                                                        | – (unsicher erwartet)            | organization |     0.989 |
| Q721 | Bis morgen in der Halle!                                                                                 | – (unsicher erwartet)            | technical    |     0.922 |
| Q722 | Thanks, that was really helpful                                                                          | – (unsicher erwartet)            | content      |     0.857 |

**Kaskade 1.3 (Gatekeeper + k-NN)** – 70 sicher, aber falsch bzw. trotz Mehrdeutigkeit akzeptiert

| ID   | Text                                                                                                     | Gold                             | Vorhersage   | Konfidenz |
| ---- | -------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------ | --------: |
| Q576 | Wann ist eine Notwehrhandlung nicht mehr geboten?                                                        | content                          | technical    |     0.877 |
| Q582 | Braucht die Polizei für § 127 Abs. 2 StPO immer Gefahr im Verzug?                                        | content                          | technical    |     0.765 |
| Q585 | Ist die vorläufige Festnahme basically dasselbe wie eine Ingewahrsamnahme?                               | content                          | organization |     0.654 |
| Q589 | Wie prüfe ich die Verhältnismäßigkeit einer Maßnahme Schritt für Schritt?                                | content                          | organization |     0.795 |
| Q591 | Ist eine Identitätsfeststellung schon unverhältnismäßig, wenn die Person kooperiert?                     | content                          | organization |     0.999 |
| Q592 | Muss ich immer das mildeste Mittel wählen, auch wenn es weniger sicher ist?                              | content                          | organization |     1.000 |
| Q593 | How do I check whether a police measure is proportionate?                                                | content                          | organization |     1.000 |
| Q597 | Wann genau muss ich jemanden als Beschuldigten belehren und nicht mehr als Zeugen?                       | content                          | organization |     0.875 |
| Q598 | Was passiert mit der Aussage, wenn die Belehrung vergessen wurde?                                        | content                          | organization |     0.577 |
| Q600 | belehrung zeuge vs beschuldigter wann wechselt das                                                       | content                          | organization |     0.988 |
| Q601 | When do I have to caution someone as a suspect instead of a witness?                                     | content                          | organization |     0.996 |
| Q602 | À quel moment faut-il informer une personne de ses droits en tant que suspect et non plus comme témoin ? | content                          | organization |     0.643 |
| Q604 | Welche Voraussetzungen müssen für den Schusswaffengebrauch gegen Personen vorliegen?                     | content                          | organization |     1.000 |
| Q605 | Muss der Schusswaffengebrauch immer vorher angedroht werden?                                             | content                          | organization |     1.000 |
| Q607 | Ist ein Warnschuss rechtlich ein eigener Schusswaffengebrauch?                                           | content                          | organization |     1.000 |
| Q608 | What conditions have to be met before an officer may use a firearm against a person?                     | content                          | organization |     0.742 |
| Q612 | In welcher Reihenfolge werden Spuren am Tatort gesichert?                                                | content                          | organization |     0.898 |
| Q613 | Warum dürfen DNA-Spuren nicht in Plastiktüten verpackt werden?                                           | content                          | organization |     0.908 |
| Q614 | Wer darf den Tatort betreten, bevor die Spurensicherung da ist?                                          | content                          | organization |     0.997 |
| Q615 | How do I secure evidence at a crime scene without contaminating it?                                      | content                          | organization |     0.647 |
| Q617 | ¿Cómo se aseguran las huellas en la escena del crimen sin contaminarlas?                                 | content                          | organization |     0.979 |
| Q618 | Wie spreche ich eine aufgebrachte Person an, damit die Lage nicht eskaliert?                             | content                          | organization |     0.844 |
| Q619 | Wann ist Duzen in einer Konfliktsituation sinnvoll und wann schadet es?                                  | content                          | organization |     0.998 |
| Q621 | Was macht man, wenn einer total austickt und gar nicht mehr zuhört?                                      | content                          | technical    |     1.000 |
| Q622 | How should I talk to an agitated person so the situation does not escalate?                              | content                          | technical    |     0.970 |
| Q625 | Wo genau liegt die Grenze zwischen Legalitätsprinzip und Opportunitätsprinzip?                           | content                          | technical    |     0.940 |
| Q626 | Muss ich jede Straftat anzeigen, die ich in der Freizeit mitbekomme?                                     | content                          | organization |     0.944 |
| Q631 | ¿Dónde está el límite entre la obligación de perseguir y la discrecionalidad policial?                   | content                          | organization |     0.620 |
| Q632 | Wann ist das nächste Schießtraining und auf welchem Schießstand?                                         | organization                     | content      |     0.790 |
| Q634 | Fällt das Schießtraining am Freitag wegen der Prüfungswoche aus?                                         | organization                     | technical    |     0.692 |
| Q638 | ¿Cuándo y dónde es el próximo entrenamiento de tiro?                                                     | organization                     | content      |     0.989 |
| Q641 | Zählt der Sporttest in die Abschlussnote oder ist er nur bestanden/nicht bestanden?                      | organization                     | technical    |     0.963 |
| Q651 | Quand saurons-nous dans quel commissariat nous ferons notre stage ?                                      | organization                     | technical    |     0.946 |
| Q652 | ¿Cuándo sabremos en qué comisaría haremos las prácticas?                                                 | organization                     | content      |     0.775 |
| Q654 | Wann ist die nächste Ausgabe der Ausrüstung in der Kleiderkammer?                                        | organization                     | content      |     0.999 |
| Q655 | Was mache ich, wenn meine Dienstjacke die falsche Größe hat?                                             | organization                     | technical    |     0.703 |
| Q657 | Faut-il porter l'uniforme pendant les cours théoriques ?                                                 | organization                     | content      |     0.859 |
| Q658 | ¿Tenemos que llevar uniforme en las clases teóricas?                                                     | organization                     | content      |     0.972 |
| Q661 | Ist ein Kommentar zum Polizeigesetz in der Klausur erlaubt?                                              | organization                     | content      |     0.819 |
| Q663 | Quels codes avons-nous le droit d'apporter à l'examen ?                                                  | organization                     | content      |     0.666 |
| Q665 | Wo treffen wir uns für das Einsatztraining in der Trainingshalle?                                        | organization                     | content      |     0.978 |
| Q668 | Where do we meet for the operational training in the training hall?                                      | organization                     | content      |     0.995 |
| Q669 | Où se retrouve-t-on pour l'entraînement opérationnel dans la salle ?                                     | organization                     | content      |     1.000 |
| Q676 | El simulador de intervención no arranca, la pantalla sigue en negro.                                     | technical                        | content      |     1.000 |
| Q678 | Die Übungsversion der Vorgangsbearbeitung meldet nur »Sitzung abgelaufen«.                               | technical                        | content      |     0.867 |
| Q681 | Je n'arrive pas à me connecter au logiciel de gestion des procédures en formation.                       | technical                        | content      |     0.938 |
| Q682 | No puedo entrar en el sistema de gestión de expedientes de formación, rechaza la contraseña.             | technical                        | content      |     1.000 |
| Q683 | Unsere Digitalfunk-Übungsgeräte bekommen keine Verbindung.                                               | technical                        | organization |     0.997 |
| Q685 | Bei Gruppe 3 kommt im Funk nur Rauschen an.                                                              | technical                        | organization |     0.981 |
| Q686 | Our training radios are not connecting to the network.                                                   | technical                        | content      |     0.929 |
| Q687 | Nos radios d'entraînement n'arrivent pas à se connecter.                                                 | technical                        | organization |     0.967 |
| Q689 | Die Bodycam-Aufnahme aus dem Rollenspiel lässt sich nicht abspielen.                                     | technical                        | content      |     0.985 |
| Q691 | The bodycam footage from the role play won't play.                                                       | technical                        | organization |     0.997 |
| Q692 | La vidéo de la caméra-piéton de l'exercice ne se lance pas.                                              | technical                        | content      |     1.000 |
| Q693 | El vídeo de la cámara corporal del ejercicio no se reproduce.                                            | technical                        | content      |     1.000 |
| Q695 | Ist die Bodycam rechtlich eine offene oder eine verdeckte Maßnahme?                                      | content                          | organization |     1.000 |
| Q696 | Wird das Einsatztraining auf Video aufgezeichnet?                                                        | organization                     | content      |     0.686 |
| Q698 | Welche Rufnamen-Systematik gilt im Funkverkehr bei größeren Einsatzlagen?                                | content                          | organization |     0.939 |
| Q699 | Ist der Übungsfall in der Vorgangsbearbeitung ein Hausfriedensbruch oder nicht?                          | content                          | technical    |     0.883 |
| Q703 | Die Folie mit dem Prüfschema zur Verhältnismäßigkeit ist auf dem Beamer abgeschnitten.                   | technical                        | organization |     0.999 |
| Q704 | Will the use-of-force rules be on the written exam?                                                      | content                          | organization |     0.903 |
| Q707 | Das Lernvideo zur Eigensicherung bleibt nach zwei Minuten hängen.                                        | technical                        | organization |     0.999 |
| Q711 | Und wenn er sich wehrt?                                                                                  | content (unsicher erwartet)      | content      |     0.600 |
| Q712 | Ist das Pflicht?                                                                                         | organization (unsicher erwartet) | organization |     0.600 |
| Q714 | Geht das auch auf dem Dienst-Tablet?                                                                     | technical (unsicher erwartet)    | technical    |     0.998 |
| Q715 | Zählt das?                                                                                               | organization (unsicher erwartet) | technical    |     0.600 |
| Q716 | What if they refuse?                                                                                     | content (unsicher erwartet)      | content      |     0.600 |
| Q717 | Et si la personne refuse ?                                                                               | content (unsicher erwartet)      | content      |     0.800 |
| Q718 | Danke für die Einheit, war richtig gut!                                                                  | – (unsicher erwartet)            | organization |     0.975 |
| Q720 | Respekt an Gruppe 2, starke Übung                                                                        | – (unsicher erwartet)            | organization |     0.989 |

## Gültigkeitsgrenzen

- Synthetisches, kleines Referenzset (Bootstrap-Intervalle beachten); keine Aussage über reale Hörsaalverteilung.
- Konfidenz ist ohne Kalibrierung keine Erfolgswahrscheinlichkeit (siehe ECE).
- Gemessen ist die In-Process-Klassifikation, nicht Queue, Persistenz oder Worker-Latenz.
