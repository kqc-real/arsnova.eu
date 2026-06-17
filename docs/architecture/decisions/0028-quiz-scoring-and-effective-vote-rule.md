<!-- markdownlint-disable MD013 -->

# ADR-0028: Quiz-Bewertung und Effective-Vote-Regel vereinheitlichen

**Status:** Accepted
**Datum:** 2026-05-24
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-05-31

## Kontext

arsnova.eu zeigt Quiz-Punkte an mehreren Stellen an:

- persoenliches Scoreboard nach einer Frage
- Einzel-Leaderboard auf Client und Host
- Team-Leaderboard auf Client und Host
- Zwischenleaderboards waehrend des Quiz
- Bonus-Code-Vergabe nach Sessionende
- persoenliches Endergebnis
- Session-Export

Diese Ansichten duerfen dieselbe abgegebene Antwort nicht unterschiedlich bewerten. Besonders kritisch sind:

- Antwortzeiten als Punktefaktor und Tiebreaker
- Streak-Multiplikatoren
- Peer-Instruction-Runde 2
- Teamwertung mit normalisierten Team-Punkten
- kuenftige bewertbare Fragetypen wie `estimated_answer`

Ohne eine gemeinsame Regel entstehen schwer erkennbare Inkonsistenzen: Ein Client kann richtig punkten, waehrend Leaderboard, Teamwertung oder Bonuscodes noch alte Rundendaten oder andere Antwortzeitregeln verwenden.

## Entscheidung

### 1. Bewertbare Fragetypen

Aktuell zaehlen nur diese Fragetypen in die Wettbewerbswertung:

- `SINGLE_CHOICE`
- `MULTIPLE_CHOICE`
- `SHORT_TEXT`

Diese Fragetypen:

- koennen Punkte groesser 0 erzeugen
- zaehlen in `totalQuestions`
- beeinflussen den Streak
- werden in Leaderboards, Scorecards, Bonuscodes und Endergebnissen beruecksichtigt

Aktuell nicht bewertbare Fragetypen:

- `FREETEXT`
- `SURVEY`
- `RATING`

Diese Fragetypen:

- geben immer 0 Punkte
- zaehlen nicht in `totalQuestions`
- unterbrechen den Streak nicht
- koennen angezeigt und exportiert werden, sind aber keine Wettbewerbsbeitraege

Wenn ein neuer bewertbarer Fragetyp wie `estimated_answer` eingefuehrt wird, muss er explizit in die gemeinsamen Scoring-Helfer aufgenommen werden. Er darf nicht nur in einer einzelnen UI-Ansicht mitgezaehlt werden.

### 2. Grundpunkte und Schwierigkeitsgrad

Die maximale Basispunktzahl pro Frage betraegt `1000`.

Schwierigkeitsgrade multiplizieren diese Basispunkte:

- `EASY`: Faktor `1`
- `MEDIUM`: Faktor `2`
- `HARD`: Faktor `3`

Damit ergeben sich ohne Timer und ohne Streak maximal:

- `EASY`: 1000 Punkte
- `MEDIUM`: 2000 Punkte
- `HARD`: 3000 Punkte

Bei `SINGLE_CHOICE` und `MULTIPLE_CHOICE` gilt eine Alles-oder-nichts-Regel:

- Die gewaehlte Antwortmenge muss exakt der korrekten Antwortmenge entsprechen.
- Bei fehlenden, zusaetzlichen oder falschen Optionen gibt es 0 Punkte.
- Die Reihenfolge der gewaehlten Antworten ist fachlich nicht relevant.

Bei `SHORT_TEXT` wird die Basispunktzahl nicht pauschal auf `1000` festgelegt, sondern aus der Kurzantwort-Bewertung abgeleitet. `1000` ist nur der Maximalrahmen (`MAX_BASE_POINTS`) fuer die Bewertung vor Difficulty, Timer und Streak.

Die tatsaechliche `SHORT_TEXT`-Basispunktzahl ist:

- `1000` bei exaktem Treffer oder voll akzeptierter numerischer Antwort
- kleiner als `1000` bei akzeptierter Texttoleranz mit Teilpunkten
- kleiner als `1000` bei korrektem Zahlenwert mit falscher oder fehlender Pflicht-Einheit
- `0`, wenn keine fachliche Uebereinstimmung vorliegt

Textuelle Kurzantworten nutzen die konfigurierte Normalisierung, Bewertungsmethode und Toleranz. Numerische Kurzantworten werden ueber geparste Zahlen bewertet; numerische Kurzantworten mit Einheiten koennen aequivalente Einheiten akzeptieren.

Erst nach dieser fachlichen Kurzantwort-Bewertung werden Difficulty, Timer und Streak angewendet. Beispiel ohne Timer:

```text
SHORT_TEXT exact, MEDIUM:
  1000 basePoints * 2 = 2000

SHORT_TEXT partial, MEDIUM:
  800 basePoints * 2 = 1600
```

### 3. Antwortzeit und Timer

Die Antwortzeit wird serverseitig aus `Date.now() - session.statusChangedAt` berechnet, wenn `statusChangedAt` vorhanden ist. Sie wird auch dann gespeichert, wenn fuer die Frage kein Countdown aktiv ist. Nur wenn keine Server-Startzeit verfuegbar ist, darf ein uebergebener Client-Wert als Fallback verwendet werden.

Der effektive Timer einer Frage wird so bestimmt:

1. Ein expliziter Frage-Timer groesser 0 gewinnt und wird nicht mehr skaliert.
2. Sonst gilt der Quiz-Default-Timer, falls vorhanden.
3. Der Default-Timer wird bei aktivierter Schwierigkeitsskalierung mit diesen Faktoren skaliert:
   - `EASY`: `1`
   - `MEDIUM`: `1.5`
   - `HARD`: `2`
4. Ohne Frage-Timer und ohne Default-Timer gibt es keinen Countdown.

Fuer Peer-Instruction-Runde 2 gilt absichtlich:

- kein effektiver Timer
- keine Deadline-Pruefung gegen den Timer
- keine Antwortzeitwirkung auf Punkte
- keine Antwortzeitwirkung auf Tiebreaker

Wenn ein Timer aktiv ist, werden zu spaete Votes nach Ablauf plus 2 Sekunden Toleranz abgelehnt. Wenn kein Timer aktiv ist, wird keine Timeout-Grenze angewendet.

Punkteformel mit aktivem Timer:

```text
scoreBeforeStreak =
  round(difficultyMultiplier * basePoints * max(0, 1 - responseTimeMs / timerDurationMs))
```

Punkteformel ohne aktiven Timer:

```text
scoreBeforeStreak =
  round(difficultyMultiplier * basePoints)
```

Die Antwortzeit ist damit kein zusaetzlicher Bonus. Bei aktivem Timer reduziert spaeteres Antworten die Punkte. Ohne aktiven Timer gibt es keine zeitabhaengige Punktreduktion.

### 4. Streaks

Streaks gelten nur fuer bewertbare Fragetypen:

- `SINGLE_CHOICE`
- `MULTIPLE_CHOICE`
- `SHORT_TEXT`

Nicht bewertbare Fragetypen unterbrechen den Streak nicht.

Ein Streak ist pro Session, Teilnehmer:in und Runde getrennt. Runde 1 und Runde 2 teilen also keinen gemeinsamen Streak-Zaehler.

Die Streak-Regel:

- Falsche oder nicht positiv bewertete Antwort: `streakCount = 0`
- Erste richtige Antwort nach keiner oder falscher bewertbarer Antwort: `streakCount = 1`
- Weitere richtige bewertbare Antwort derselben Runde: vorheriger `streakCount + 1`

Der Streak-Multiplikator:

- `0`: `x1.0`
- `1`: `x1.0`
- `2`: `x1.1`
- `3`: `x1.2`
- `4`: `x1.3`
- `5+`: `x1.5`

Der finale Vote-Score ist:

```text
score = round(scoreBeforeStreak * streakMultiplier)
```

### 5. Effective-Vote-Regel

Alle Wettbewerbsaggregationen verwenden dieselbe Effective-Vote-Regel.

Eingabe sind alle gespeicherten Votes der Runden 1 und 2 fuer die relevante Session oder den relevanten Fragebereich.

Fuer jede Frage gilt:

1. Wenn es fuer diese Frage mindestens einen Vote in Runde 2 gibt, ersetzt Runde 2 die Runde 1 fuer diese Frage.
2. Wenn es fuer diese Frage keinen Vote in Runde 2 gibt, zaehlt Runde 1.
3. Pro Teilnehmer:in und Frage gibt es maximal einen Effective Vote.
4. Hat eine Person nur in Runde 1 abgestimmt, aber fuer die Frage existiert Runde 2, hat diese Person fuer diese Frage keinen Effective Vote.

Diese Regel ist fachlich bewusst: Runde 2 ist bei Peer Instruction die erneute, nach Diskussion abgegebene Antwort. Sie ist nicht ein Zusatz zur ersten Runde, sondern ersetzt die erste Runde in der Wettbewerbswertung.

Konsequenz:

- Eine schnelle falsche Antwort in Runde 1 hilft nicht, wenn Runde 2 gespielt wurde.
- Eine schnelle richtige Antwort in Runde 1 wird nicht mehr gezaehlt, wenn Runde 2 fuer diese Frage existiert.
- Die Runde-2-Antwort entscheidet die Punkte fuer diese Frage.
- Die gespeicherte Antwortzeit aus Runde 2 bleibt auditierbar, ist aber kein Tiebreaker.

### 6. Tiebreaker

Rankings sortieren zuerst nach Gesamtpunkten absteigend.

Bei Punktgleichheit entscheidet die Summe der gewerteten Antwortzeiten aufsteigend:

- Nur positive Effective Votes koennen Antwortzeit beitragen.
- Runde-1-Effective-Votes tragen ihre gespeicherte Antwortzeit bei.
- Runde-2-Effective-Votes tragen immer `0` Antwortzeit bei.
- Votes mit `score <= 0` tragen keine Antwortzeit bei.

Bei exakt gleicher Punktzahl und exakt gleicher gewerteter Antwortzeit bleibt ein echter Gleichstand fachlich bestehen. Die UI darf Eintraege trotzdem in einer stabilen technischen Reihenfolge anzeigen, darf daraus aber keine zusaetzliche fachliche Ueberlegenheit ableiten.

### 7. Teamwertung

Die Teamwertung nutzt dieselben Effective Votes wie die Einzelwertung.

Berechnung:

1. Effective Votes werden ueber Teilnehmer:innen ihrem Team zugeordnet.
2. Pro Team wird die Rohpunktsumme aller Teammitglieder gebildet.
3. Die sichtbare Team-Punktzahl ist der Durchschnitt pro Teammitglied:

```text
teamScore = roundToOneDecimal(rawTeamScore / memberCount)
```

Der Team-Tiebreaker nutzt ebenfalls nur die gewerteten Antwortzeiten positiver Effective Votes. Runde-2-Antwortzeiten werden nicht beruecksichtigt.

Damit kann ein Teammitglied nur mit der Antwortzeit beitragen, die auch fachlich zur aktuellen Wettbewerbswertung gehoert.

### 8. Gemeinsame Anwendungsstellen

Die Effective-Vote-Regel ist verbindlich fuer:

- Einzel-Leaderboard (`getLeaderboard`)
- Team-Leaderboard (`buildSessionTeamLeaderboard`)
- Bonus-Code-Vergabe (`generateBonusTokens`)
- persoenliche Scorecard (`getPersonalScorecard`)
- persoenliches Endergebnis (`getPersonalResult`)
- Host-Zwischenleaderboards, soweit sie diese Endpunkte verwenden
- Client-Leaderboards, soweit sie diese Endpunkte verwenden
- Teamwertung im Session-Export, soweit sie `buildSessionTeamLeaderboard` verwendet

Neue Scoring- oder Ergebnisansichten duerfen nicht eigenstaendig nur `round: 1` oder nur die aktuelle Runde aggregieren. Sie muessen entweder die gemeinsame Effective-Vote-Regel wiederverwenden oder diese ADR explizit abloesen.

### 9. Performance-Leitplanken

Die Effective-Vote-Regel ist bewusst als lineare In-Memory-Aggregation ueber bereits geladene Votes modelliert.

Leitplanken:

- keine zusaetzlichen Datenbankabfragen pro Teilnehmer:in
- keine zusaetzlichen Datenbankabfragen pro Team
- keine zusaetzlichen Writes fuer abgeleitete Scores
- Aggregation ueber `round in [1, 2]` und anschliessende lineare Auswahl
- neue Fragetypen duerfen keine N+1-Logik in Leaderboards einfuehren

Fuer Veranstaltungen mit 250+ Teilnehmenden ist diese Regel unkritisch, solange neue Auswertungen die gleiche lineare Struktur beibehalten.

## Konsequenzen

### Positiv

- Alle sichtbaren Wettbewerbsflaechen folgen derselben fachlichen Wertung.
- Peer Instruction hat eine klare Regel: Runde 2 ersetzt Runde 1.
- Runde-2-Zeiten koennen gespeichert werden, ohne spaeter Rankings zu verfaelschen.
- Teamwertung, Bonuscodes und persoenliche Scorecards koennen nicht mehr versehentlich andere Rundenregeln verwenden.
- Kuenftige bewertbare Fragetypen haben eine klare Integrationspflicht.

### Negativ / Risiken

- Echte Gleichstaende bleiben moeglich, besonders bei Fragen ohne Timer oder bei Runde 2.
- Runde-2-Teilnahme ist fachlich entscheidend; wer Runde 2 verpasst, behaelt fuer diese Frage keine Runde-1-Punkte.
- Die Regel muss in Tests konsequent abgedeckt werden, weil kleine Filter wie `round: 1` alte Fehler wieder einfuehren koennen.
- Neue Fragetypen muessen Scoring, Streak, `totalQuestions`, Leaderboards und Exporte gemeinsam erweitern.

## Alternativen (geprueft)

- **Runde 1 und Runde 2 addieren:** verworfen, weil Peer Instruction dadurch doppelt zaehlen wuerde und erste schnelle Fehlantworten weiter Gewicht haetten.
- **Runde 2 nur fuer Punkte, Runde 1 fuer Zeit-Tiebreaker behalten:** verworfen, weil dann eine fachlich ersetzte Antwort weiterhin Rankings beeinflusst.
- **Runde-2-Antwortzeit als Tiebreaker nutzen:** verworfen, weil Runde 2 bewusst ohne Countdown und Zeitdruck gespielt wird.
- **Nur die aktuell angefragte Runde aggregieren:** verworfen, weil Scorecards, Leaderboards und Endergebnisse dann je nach Ansicht auseinanderlaufen.
- **Abgeleitete Gesamtpunktstaende persistieren:** aktuell verworfen, weil die lineare Aggregation einfach, nachvollziehbar und fuer die erwartete Groesse ausreichend ist.

## Umsetzungsleitplanken

- `calculateVoteScore` bleibt die Quelle fuer den Score eines einzelnen Votes vor Streak.
- `getStreakMultiplier` und `questionAffectsStreak` bleiben die Quelle fuer Streak-Regeln.
- Wettbewerbsaggregation verwendet `selectEffectiveCompetitionVotes`.
- Antwortzeit fuer Rankings wird ueber die gemeinsame Wettbewerbsregel bestimmt; Runde 2 liefert dafuer immer `0`.
- Tests muessen mindestens abdecken:
  - richtige/falsche SC- und MC-Auswahl
  - Kurzantwort mit Teilpunkten
  - Timer mit Antwortzeitfaktor
  - Frage ohne Countdown
  - Peer-Instruction-Runde 2 ohne Timerwirkung
  - Streak-Aufbau und Streak-Reset
  - Einzel-Leaderboard mit Runde 2 als Ersatz
  - Team-Leaderboard mit Runde 2 als Ersatz
  - persoenliche Scorecard mit Runde 2 als Ersatz
  - Bonuscodes mit Effective Votes

## Implementierungsstand (Projekt arsnova.eu)

Stand 2026-05-24:

- Vote-Scoring ist in `apps/backend/src/lib/quizScoring.ts` implementiert.
- Vote-Annahme, Timerpruefung, Antwortzeitmessung und Streak-Persistenz sind in `apps/backend/src/routers/vote.ts` implementiert.
- Die Effective-Vote-Regel ist in `apps/backend/src/routers/session.ts` implementiert.
- Einzel-Leaderboard, Team-Leaderboard, Bonuscodes, persoenliche Scorecard und persoenliches Endergebnis nutzen die gemeinsame Regel.
- Regressionstests sichern Runde-2-Ersatz und ignorierte Runde-2-Antwortzeiten fuer Einzelwertung, Teamwertung und persoenliche Scorecard ab.

Stand 2026-05-31:

- `SHORT_TEXT` bleibt der dritte bewertbare Fragetyp; ein eigener numerischer Schaetzfrage-Typ ist noch nicht Teil von `QuestionTypeEnum`.
- Neue bewertbare Fragetypen muessen weiterhin `quizScoring.ts`, Effective-Vote-Auswahl, Leaderboards, Scorecards, Bonuscodes und Exporte gemeinsam erweitern.

Stand 2026-06-17:

- `SHORT_TEXT` und `NUMERIC_ESTIMATE` sind zusätzlich zu `SINGLE_CHOICE` und `MULTIPLE_CHOICE` bewertbare Fragetypen.
- Der eigene numerische Schaetzfrage-Typ ist als `NUMERIC_ESTIMATE` Teil von `QuestionTypeEnum`, Prisma, Shared Types, Vote-API, Session-Aggregation, Leaderboards, Scorecards, Bonuscodes und Exporten.
- `NUMERIC_ESTIMATE` nutzt das Toleranzband für die Korrektheitsentscheidung und differenziert Punkte innerhalb des Bands nach Nähe zum Referenzwert: exakter Treffer erhält volle Basispunkte, nicht-exakte Treffer werden über `1 - normalisierteDistanz²` gewichtet, am Bandrand bleibt ein Mindestanteil von 10 %, außerhalb des Bands gibt es 0 Punkte.
- Runde 2 ersetzt Runde 1 auch für `NUMERIC_ESTIMATE`; Runde-2-Antwortzeiten bleiben für Tiebreaker ohne Wirkung.
- Die fachliche Detaildoku steht in [numeric-estimate.md](../../features/numeric-estimate.md).
- Neue bewertbare Fragetypen muessen weiterhin `quizScoring.ts`, Effective-Vote-Auswahl, Leaderboards, Scorecards, Bonuscodes und Exporte gemeinsam erweitern.

---

**Referenzen:** [quizScoring.ts](../../../apps/backend/src/lib/quizScoring.ts), [vote.ts](../../../apps/backend/src/routers/vote.ts), [session.ts](../../../apps/backend/src/routers/session.ts), [schemas.ts](../../../libs/shared-types/src/schemas.ts), [session.leaderboard.test.ts](../../../apps/backend/src/__tests__/session.leaderboard.test.ts), [session.teams.test.ts](../../../apps/backend/src/__tests__/session.teams.test.ts), [session.scorecard.test.ts](../../../apps/backend/src/__tests__/session.scorecard.test.ts), [vote.test.ts](../../../apps/backend/src/__tests__/vote.test.ts), [quizScoring.test.ts](../../../apps/backend/src/__tests__/quizScoring.test.ts).
