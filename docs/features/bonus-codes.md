# Bonus-Codes (Story 4.6)

> **Zielgruppe:** Product Owner, Entwickler

## Konzept

Dozenten koennen fuer ein Quiz festlegen, dass die **besten Teilnehmenden automatisch
einen Bonus-Code** erhalten. Der Code wird nach Session-Ende generiert und ist ein
kryptografisch sicherer Token im Format `BNS-XXXX-XXXX`.

Studierende koennen den Code **freiwillig per E-Mail** beim Dozenten einreichen, um
Bonuspunkte zu erhalten. Solange sie das nicht tun, bleibt ihre Identitaet gewahrt
(**Zero-Knowledge-Prinzip**).

---

## Konfiguration

| Parameter          | Feld              | Wertebereich | Standard             |
| ------------------ | ----------------- | ------------ | -------------------- |
| Anzahl Bonus-Codes | `bonusTokenCount` | 1 – 50       | `null` (deaktiviert) |

Der Dozent legt im **Quiz-Editor** fest, wie viele Top-Plaetze einen Code erhalten.
Ohne Wert werden keine Codes vergeben.

---

## Ablauf (Sequenzdiagramm)

```mermaid
sequenceDiagram
  actor Dozent
  actor Teilnehmer
  participant Editor as :QuizEditor
  participant Session as :sessionRouter
  participant DB as :PostgreSQL

  Dozent ->> Editor: bonusTokenCount = 5
  Editor ->> DB: quiz.update(bonusTokenCount)

  Note over Session: Session laeuft...

  alt Letzte Frage beantwortet
    Session ->> Session: nextQuestion() erkennt Ende
  else Dozent beendet manuell
    Dozent ->> Session: session.end()
  end

  Session ->> Session: status = FINISHED
  Session ->> Session: generateBonusTokens()
  Session ->> DB: vote.findMany(sessionId, round 1)
  DB -->> Session: votes
  Session ->> Session: Ranking berechnen
  Session ->> DB: bonusToken.createMany(Top 5)

  Dozent ->> Session: session.getBonusTokens()
  Session -->> Dozent: BonusTokenListDTO

  Teilnehmer ->> Session: session.getPersonalResult()
  Session -->> Teilnehmer: bonusToken oder null
```

---

## Ranking-Algorithmus (Aktivitaetsdiagramm)

```mermaid
flowchart TD
  S(( )) --> CHECK{"bonusTokenCount konfiguriert?"}
  CHECK -- "[null oder 0]" --> STOP(( ))
  CHECK -- "[1..50]" --> DUP{"Tokens bereits vorhanden?"}
  DUP -- "[ja]" --> STOP
  DUP -- "[nein]" --> LOAD["Alle Votes der Session laden (Runde 1)"]
  LOAD --> AGG["Pro Teilnehmer summieren: totalScore, totalResponseTimeMs"]
  AGG --> SORT["Sortieren: Score absteigend, bei Gleichstand Antwortzeit aufsteigend"]
  SORT --> FILTER["Teilnehmer mit 0 Punkten ausschliessen"]
  FILTER --> SLICE["Top X Eintraege auswaehlen"]
  SLICE --> GEN["Pro Eintrag: BNS-Code generieren (randomBytes)"]
  GEN --> SAVE["bonusToken.createMany()"]
  SAVE --> E(( ))
```

| Schritt             | Detail                                                     |
| ------------------- | ---------------------------------------------------------- |
| Score-Summe         | Alle `vote.score`-Werte eines Teilnehmers werden addiert   |
| 0-Punkte-Ausschluss | Teilnehmer mit insgesamt 0 Punkten erhalten keinen Bonus   |
| Tiebreaker          | Bei gleichem Score gewinnt die kuerzere Gesamt-Antwortzeit |
| Idempotenz          | Bereits vorhandene Tokens verhindern doppelte Generierung  |

---

## Code-Format

```
BNS-A3F7-K2M9
```

| Eigenschaft | Wert                                                    |
| ----------- | ------------------------------------------------------- |
| Prefix      | `BNS-`                                                  |
| Zeichenraum | `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (ohne O, 0, I, 1, L) |
| Laenge      | 4 + 4 Zeichen (durch Bindestrich getrennt)              |
| Entropie    | 8 Bytes via `crypto.randomBytes()`                      |

---

## Datenmodell (Klassendiagramm)

```mermaid
classDiagram
  class Quiz {
    +String id
    +String name
    +Int bonusTokenCount
  }

  class Session {
    +String id
    +String code
    +SessionStatus status
    +DateTime endedAt
  }

  class Participant {
    +String id
    +String nickname
  }

  class BonusToken {
    +String id
    +String token
    +String nickname
    +String quizName
    +Int totalScore
    +Int rank
    +DateTime generatedAt
  }

  Quiz "1" --> "*" Session : sessions
  Session "1" --> "*" Participant : participants
  Session "1" --> "*" BonusToken : bonusTokens
  Participant "1" --> "*" BonusToken : bonusTokens
```

`nickname` und `quizName` im BonusToken sind **Snapshots** – sie werden zum
Generierungszeitpunkt eingefroren und bleiben auch nach Session-Loeschung erhalten.

---

## Sichtbarkeit nach Rolle

### Teilnehmer-Sicht

```mermaid
stateDiagram-v2
  direction LR

  [*] --> SessionLaeuft
  SessionLaeuft --> Ergebnis : status = FINISHED

  state Ergebnis {
    [*] --> Pruefen
    Pruefen --> CodeAnzeigen : Teilnehmer in Top X
    Pruefen --> KeinCode : Teilnehmer nicht in Top X
  }

  note right of CodeAnzeigen
    BNS-Code wird angezeigt
    Kopieren-Button verfuegbar
  end note
```

Teilnehmende sehen auf der Ergebnis-Seite:

- **Falls in Top X:** Ihren persoenlichen BNS-Code mit Kopieren-Button
- **Falls nicht in Top X:** Keinen Bonus-Bereich
- **Hinweistext:** "Sende diesen Code per E-Mail an deinen Dozenten, um Bonuspunkte
  zu erhalten. Deine Anonymitaet bleibt gewahrt, solange du den Code nicht einreichst."

### Dozenten-Sicht

Der Dozent sieht nach Session-Ende eine Tabelle aller Bonus-Codes:

| Spalte   | Inhalt                                  |
| -------- | --------------------------------------- |
| #        | Rang (1-basiert)                        |
| Nickname | Pseudonym zum Zeitpunkt der Generierung |
| Code     | `BNS-XXXX-XXXX` (Monospace)             |
| Punkte   | Gesamt-Score                            |

Dazu ein **CSV-Export-Button** (Dateiname: `bonus-codes-{SESSION-CODE}.csv`).

---

## Lebenszyklus (Zustandsdiagramm)

```mermaid
stateDiagram-v2
  direction TB

  [*] --> Konfiguriert : Quiz mit bonusTokenCount gespeichert

  state "Session aktiv" as active {
    [*] --> Laeuft
    Laeuft : Noch keine Tokens vorhanden
  }

  Konfiguriert --> active : session.create()
  active --> Generiert : status = FINISHED, generateBonusTokens()
  Generiert --> Abrufbar : getBonusTokens() / getPersonalResult()

  Abrufbar --> Geloescht : Session-Purge nach 24 h (CASCADE)
  Geloescht --> [*]

  note right of Generiert
    Tokens in DB persistiert
    Dozent und Teilnehmer koennen abrufen
  end note

  note right of Geloescht
    onDelete CASCADE
    Zusaetzlich: Token-Cleanup nach 90 Tagen
  end note
```

| Phase          | Zeitpunkt                | Tokens vorhanden?    |
| -------------- | ------------------------ | -------------------- |
| Quiz erstellt  | Konfiguration            | Nein                 |
| Session laeuft | LOBBY bis DISCUSSION     | Nein                 |
| Session endet  | FINISHED                 | Ja (generiert)       |
| Ergebnis-Phase | FINISHED, Abruf moeglich | Ja                   |
| Session-Purge  | 24 h nach Ende           | Geloescht (CASCADE)  |
| Token-Cleanup  | 90 Tage nach Generierung | Geloescht (Fallback) |

---

## Anonymitaets-Konzept (Zero Knowledge)

Die App speichert **keine realen Identitaeten**. Die Verknuepfung zwischen Pseudonym
und realer Person erfolgt ausschliesslich durch den Studierenden selbst.

### Phase 1 – Waehrend der Session

```mermaid
sequenceDiagram
  actor S as Studentin
  participant App as :arsnova.eu
  actor D as Dozent

  App ->> S: Pseudonym zuweisen
  S ->> App: Antworten abgeben
  App ->> D: Leaderboard anzeigen
```

> **Dozent kennt:** Pseudonyme + Scores.
> **Studentin kennt:** eigenen Score.
> **Niemand kennt:** reale Identitaet der Teilnehmenden.

### Phase 2 – Session beendet

```mermaid
sequenceDiagram
  actor S as Studentin
  participant App as :arsnova.eu
  actor D as Dozent

  App ->> App: generateBonusTokens()

  App ->> S: Dein Code: BNS-A3F7-K2M9

  App ->> D: Bonus-Tabelle mit allen Codes
```

> **Dozent kennt:** Pseudonym-Code-Zuordnung (z. B. "Marie Curie" = BNS-A3F7-K2M9).
> **Studentin kennt:** nur den eigenen Code.
> **Identitaet:** noch nicht verknuepft.

### Phase 3 – Freiwillige Einreichung (ausserhalb der App)

```mermaid
sequenceDiagram
  actor S as Studentin
  actor D as Dozent

  S -->> D: E-Mail mit BNS-Code

  D ->> D: Code in Tabelle verifizieren
```

> **Erst jetzt** kann der Dozent Code und reale Person verknuepfen.
> Die App ist an diesem Schritt **nicht beteiligt**.

### Wissensmatrix

|                             | App speichert | Dozent kennt          | Student kennt |
| --------------------------- | ------------- | --------------------- | ------------- |
| **Reale Identitaet**        | nie           | erst nach Einreichung | immer         |
| **Pseudonym**               | ja (Snapshot) | ja                    | ja            |
| **Score + Rang**            | ja            | ja                    | eigenen       |
| **BNS-Code**                | ja            | ja (alle Top X)       | nur eigenen   |
| **Zuordnung Code ↔ Person** | nie           | erst nach Einreichung | immer         |

### Sicherheitseigenschaften

```mermaid
flowchart TD
  A{"Wer kann Code\nund Identitaet\nverknuepfen?"}

  A --> S["Studierende"]
  A --> APP["App"]
  A --> DRITTE["Dritte"]

  S --> E1{"Einreichung\nerfolgt?"}
  E1 -- "[nein]" --> ANON["Anonym"]
  E1 -- "[ja]" --> KNOWN["Dozent kennt\nZuordnung"]

  APP --> NEIN["Nicht moeglich:\nkein Login,\nkein Tracking"]

  DRITTE --> NEIN2["Nicht moeglich:\nCode nicht\nerratbar"]
```

| Eigenschaft              | Garantie                                                                   |
| ------------------------ | -------------------------------------------------------------------------- |
| **Keine Login-Pflicht**  | Teilnahme ohne Account moeglich                                            |
| **Pseudonym statt Name** | App vergibt zufaellige Pseudonyme (z. B. Nobelpreistraeger)                |
| **Kein Tracking**        | Keine Session-uebergreifende Wiedererkennung                               |
| **Freiwilligkeit**       | Einreichung ist optional, Nicht-Einreichung hat keinen Nachteil in der App |
| **Code-Sicherheit**      | Kryptografisch sicher (8 Bytes Entropie), nicht erratbar                   |
| **Zeitlich begrenzt**    | Token werden nach 24 h (Session-Purge) bzw. 90 Tagen (Cleanup) geloescht   |

---

## tRPC-Endpunkte

| Endpunkt                    | Typ   | Zugriff    | Beschreibung                       |
| --------------------------- | ----- | ---------- | ---------------------------------- |
| `session.getBonusTokens`    | Query | Dozent     | Liste aller Tokens einer Session   |
| `session.getPersonalResult` | Query | Teilnehmer | Eigener Score, Rang und ggf. Token |
| `session.getExportData`     | Query | Dozent     | Session-Export inkl. Bonus-Tokens  |

---

## Relevante Dateien

| Bereich                | Datei                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| **Zod-Schemas**        | `libs/shared-types/src/schemas.ts` (`BonusTokenEntryDTOSchema`, `BonusTokenListDTOSchema`) |
| **Quiz-Konfiguration** | `libs/shared-types/src/schemas.ts` (`CreateQuizInputSchema.bonusTokenCount`)               |
| **Token-Generierung**  | `apps/backend/src/routers/session.ts` (`generateBonusTokens`, `generateBonusCode`)         |
| **Scoring**            | `apps/backend/src/lib/quizScoring.ts`                                                      |
| **Prisma-Modell**      | `prisma/schema.prisma` (`model BonusToken`)                                                |
| **Token-Cleanup**      | `apps/backend/src/lib/sessionCleanup.ts` (`cleanupExpiredBonusTokens`)                     |
| **Dozenten-Ansicht**   | `apps/frontend/src/app/features/session/session-host/`                                     |
| **Teilnehmer-Ansicht** | `apps/frontend/src/app/features/session/session-vote/`                                     |
| **Quiz-Editor**        | `apps/frontend/src/app/features/quiz/quiz-edit/`                                           |
