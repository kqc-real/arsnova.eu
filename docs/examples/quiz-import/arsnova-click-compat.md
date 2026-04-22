# arsnova.click Import-Kompatibilitaet

Dieses Dokument haelt das aktuell ermittelte `arsnova.click`-Exportformat fest und beschreibt,
wie `arsnova.eu` es derzeit importiert.

## Referenzen

- Formales Snapshot-Schema: `docs/examples/quiz-import/arsnova-click-export.schema.json`
- Vollstaendiges Beispiel: `docs/examples/quiz-import/arsnova-click-maximal-export.json`
- Aktueller Normalizer: `apps/frontend/src/app/features/quiz/data/quiz-import-normalizer.ts`

## Wichtiger Kontext

- Das `arsnova.click`-Export-JSON ist als Archiv-/Import-Snapshot dokumentiert, nicht als minimales DTO.
- `TYPE` ist das massgebliche Feld fuer Fragetypen.
- Mehrere Felder im Snapshot sind fuer `arsnova.eu` derzeit ohne Laufzeitwirkung und werden nur dokumentiert.

## Aktuelles Mapping nach arsnova.eu

| arsnova.click                   | arsnova.eu        | Status     | Bemerkung                                                            |
| ------------------------------- | ----------------- | ---------- | -------------------------------------------------------------------- |
| `SingleChoiceQuestion`          | `SINGLE_CHOICE`   | importiert | direktes Mapping                                                     |
| `YesNoSingleChoiceQuestion`     | `SINGLE_CHOICE`   | importiert | Spezialisierung geht verloren                                        |
| `TrueFalseSingleChoiceQuestion` | `SINGLE_CHOICE`   | importiert | Spezialisierung geht verloren                                        |
| `MultipleChoiceQuestion`        | `MULTIPLE_CHOICE` | importiert | direktes Mapping                                                     |
| `SurveyQuestion`                | `SURVEY`          | importiert | alle Antworten werden als nicht-korrekt normalisiert                 |
| `ABCDSurveyQuestion`            | `SURVEY`          | importiert | Spezialtyp geht verloren                                             |
| `FreeTextQuestion`              | `FREETEXT`        | importiert | Antwortschluessel aus click werden nicht in `arsnova.eu` uebernommen |
| `RangedQuestion`                | kein Pendant      | abgelehnt  | aktuelle Fehlermeldung statt stiller Degradation                     |

## Aktuell uebernommene Session-Felder

| Feld im click-Snapshot                     | Ziel in arsnova.eu     | Bemerkung                      |
| ------------------------------------------ | ---------------------- | ------------------------------ |
| `name`                                     | `quiz.name`            | direkt                         |
| `description`                              | `quiz.description`     | direkt                         |
| `sessionConfig.readingConfirmationEnabled` | `readingPhaseEnabled`  | direkt                         |
| `sessionConfig.nicks.blockIllegalNicks`    | `allowCustomNicknames` | invertiert                     |
| `sessionConfig.nicks.memberGroups`         | `teamNames`            | bis max. 8 Teams               |
| `sessionConfig.nicks.autoJoinToGroup`      | `teamAssignment`       | `true -> AUTO`, sonst `MANUAL` |

## Dokumentierte, aber aktuell nicht uebernommene Snapshot-Felder

- `origin`
- `state`
- `currentQuestionIndex`
- `currentStartTimestamp`
- `sentQuestionIndex`
- `readingConfirmationRequested`
- `questionCount`
- `sessionConfig.confidenceSliderEnabled`
- `sessionConfig.showResponseProgress`
- `sessionConfig.theme`
- `sessionConfig.leaderboardAlgorithm`
- `sessionConfig.music.*`
- `sessionConfig.nicks.maxMembersPerGroup`
- `sessionConfig.nicks.selectedNicks`
- `questionList[].displayAnswerText`
- `questionList[].showOneAnswerPerRow`
- `questionList[].multipleSelectionEnabled`
- `questionList[].tags`
- `questionList[].requiredForToken`
- `FreeTextAnswerOption.configCaseSensitive`
- `FreeTextAnswerOption.configTrimWhitespaces`
- `FreeTextAnswerOption.configUseKeywords`
- `FreeTextAnswerOption.configUsePunctuation`
- `RangedQuestion.rangeMin`
- `RangedQuestion.rangeMax`
- `RangedQuestion.correctValue`

## Offene Folgearbeiten fuer spaetere Angleichung

1. Pruefen, ob `RangedQuestion` in `arsnova.eu` einen neuen Fragetyp braucht oder als `RATING`/`FREETEXT` bewusst umgedeutet werden soll.
2. Entscheiden, ob `FreeTextQuestion`-Antwortoptionen als Auswertungshilfe, Tags oder neue Bewertungslogik erhalten bleiben muessen.
3. Klaeren, ob `ABCDSurveyQuestion`, `YesNoSingleChoiceQuestion` und `TrueFalseSingleChoiceQuestion` als eigene UI-Varianten sichtbar bleiben sollen.
4. Festlegen, ob Musik-, Theme- und Nickname-Presets in `arsnova.eu` ueberhaupt eine fachliche Entsprechung bekommen sollen.
