# Epic 5 – Implementierungsplan: Gamification & Audio-Effekte

**Ziel:** Sound-Effekte, Hintergrundmusik, Belohnungseffekte, Answer Streak, Persönliche Scorecard, Motivationsmeldungen und Emoji-Reaktionen umsetzen. Reihenfolge nach Abhängigkeiten und Priorität (5.6 Must zuerst).

---

## Ist-Stand (vor Epic-5-Umsetzung)

| Bereich                               | Status                                                                                                                                                                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prisma**                            | `Quiz`: `enableSoundEffects`, `enableRewardEffects`, `enableMotivationMessages`, `enableEmojiReactions`, `backgroundMusic`. `Vote`: `streakCount Int @default(0)`.                                                                                          |
| **shared-types**                      | Quiz-Settings-Schemas, `PersonalScorecardDTOSchema` (questionOrder, wasCorrect, questionScore, baseScore, streakCount, streakMultiplier, currentRank, previousRank, rankChange, totalScore, bonusToken), `SendEmojiReactionInputSchema`, `EMOJI_REACTIONS`. |
| **Backend session**                   | `getPersonalResult` (nur für FINISHED: rank, totalScore, bonusToken). **Fehlt:** Subscription `onPersonalResult` (pro Frage nach RESULTS), Streak-Berechnung in `vote.submit`, Mutation `session.react` (5.8).                                              |
| **Backend quizScoring**               | `calculateVoteScore` ohne Streak; **fehlt:** Streak-Multiplikator (2er=×1.1, 3er=×1.2, …).                                                                                                                                                                  |
| **Frontend preset-toast / quiz-edit** | Toggles u. a. `enableSoundEffects` (UI: **Action Sounds**), `enableRewardEffects`, `enableMotivationMessages`, `enableEmojiReactions`; Hintergrundmusik `backgroundMusic` im Quiz-Editor (nicht Preset-Toast).                                              |
| **Frontend session-vote**             | Platzhalter: `showRewardEffect`, `motivationMessage` (pickRandom aus MESSAGES\_\*). Keine echte Scorecard, kein Streak-UI, keine Sounds.                                                                                                                    |
| **Frontend session-host**             | Quiz-Settings (inkl. Audio/Effekte) werden an Client übergeben; keine Wiedergabe von Sounds/Musik.                                                                                                                                                          |
| **Assets**                            | `apps/frontend/src/assets/sound`: `lobby/`, `countdownEnd/`, `countdownRunning/`, `connecting/` (README.md vorhanden).                                                                                                                                      |

---

## Abhängigkeiten zwischen Stories

```
4.1 Leaderboard (✅) ──┬── 5.4 Belohnungseffekte
                       └── 5.6 Scorecard (Rang, Gesamtpunkte)

5.5 Answer Streak ──────── 5.6 Scorecard (Streak-Anzeige, Streak in DTO)
5.6 Scorecard ─────────── 5.7 Motivationsmeldungen (Datenquelle)

5.1 Sound / 5.3 Musik ──── unabhängig (nur Host/Beamer bzw. Lobby)
5.8 Emoji-Reaktionen ───── unabhängig (neue Mutation + Redis/In-Memory)
```

**Empfohlene Implementierungsreihenfolge:** 5.5 → 5.6 → 5.7 → 5.1 → 5.3 → 5.4 → 5.8 (5.6 zuerst als Must, 5.5 liefert Streak für 5.6).

---

## Phase 1: Answer Streak (Story 5.5)

Streak serverseitig berechnen und in `Vote.streakCount` speichern; Formel in Scoring einbauen.

| #   | Task                               | Beschreibung                                                                                                                                                                                                                       | Datei/ Ort                                                     |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1.1 | **Streak-Multiplikator**           | Konstante/Map: 0→1, 1→1, 2→1.1, 3→1.2, 4→1.3, 5+→1.5. Hilfsfunktion `getStreakMultiplier(streakCount: number): number`.                                                                                                            | `libs/shared-types` oder `apps/backend/src/lib/quizScoring.ts` |
| 1.2 | **Vorherigen Streak ermitteln**    | In `vote.submit`: Letzten Vote des Participants in dieser Session (gleiche Round) für die **letzte bewertbare Frage** laden; wenn korrekt → `previousStreakCount + 1`, sonst 0. FREETEXT/SURVEY überspringen (kein Streak-Update). | `apps/backend/src/routers/vote.ts` (oder session)              |
| 1.3 | **Neuen Streak in Vote speichern** | Beim Erzeugen des `Vote`-Records `streakCount` setzen (0 oder previousStreak+1 bei Korrekt).                                                                                                                                       | `apps/backend` (vote.submit)                                   |
| 1.4 | **Finalen Score mit Streak**       | `finalScore = round(baseScore * getStreakMultiplier(streakCount))`; `baseScore` aus `calculateVoteScore`, dann in DB als `score` speichern.                                                                                        | `apps/backend` (vote.submit + quizScoring)                     |
| 1.5 | **Leaderboard/Export**             | Sicherstellen, dass Leaderboard und Export den bereits gespeicherten `Vote.score` (bereits streakkorrekt) nutzen. Keine Änderung nötig, wenn nur `Vote.score` summiert wird.                                                       | Prüfung                                                        |
| 1.6 | **Unit-Tests**                     | Tests: Streak 0→1 nach erster richtiger Antwort; 2er/3er-Streak Multiplikator; falsche Antwort setzt Streak auf 0; FREETEXT überspringt Streak.                                                                                    | `apps/backend/src/__tests__/`                                  |

---

## Phase 2: Persönliche Scorecard (Story 5.6)

Subscription `onPersonalResult` + Frontend-Scorecard-UI (Overlay/Bottom-Sheet) nach jeder RESULTS-Phase.

| #   | Task                                     | Beschreibung                                                                                                                                                                                                                                                                          | Datei/ Ort                                                      |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 2.1 | **PersonalScorecardDTO befüllen**        | Nach RESULTS: Pro Participant aus letzten Votes (diese Frage + alle vorherigen) `questionScore`, `baseScore`, `streakCount`, `streakMultiplier`, `currentRank`, `previousRank`, `rankChange`, `totalScore` berechnen. Bei SURVEY/FREETEXT: `wasCorrect: null`, nur Rang/Gesamtpunkte. | `apps/backend/src/routers/session.ts`                           |
| 2.2 | **Subscription onPersonalResult**        | Neue Subscription: Nach `revealResults` (oder bei Status RESULTS) pro Teilnehmer einmalig `PersonalScorecardDTO` senden. Payload pro Participant individuell (kein Broadcast an alle). Redis/Channel pro Session oder in-memory mit Session-State.                                    | `apps/backend` (session router, ev. ws-context)                 |
| 2.3 | **Frontend: Subscribe onPersonalResult** | In `session-vote`: Bei RESULTS auf `onPersonalResult` subscriben; erhaltenes DTO in Signal `personalScorecard` setzen.                                                                                                                                                                | `apps/frontend/.../session-vote.component.ts`                   |
| 2.4 | **Scorecard-Komponente (UI)**            | Neue Komponente oder Block in session-vote: Overlay/Bottom-Sheet mit Richtig/Falsch, Punkten (Score + Streak aufgeschlüsselt), Streak-Zähler (🔥 bei ≥3), Rang + Rangveränderung, Gesamtpunkte. Bei SURVEY/FREETEXT nur „Antwort registriert“ + Rang.                                 | `apps/frontend/.../session-vote` (ev. `scorecard/` oder inline) |
| 2.5 | **Auto-Dismiss**                         | Scorecard ausblenden, wenn nächste Frage kommt (onQuestionRevealed / Status ACTIVE).                                                                                                                                                                                                  | session-vote                                                    |
| 2.6 | **correctAnswerIds**                     | Bei Falsch: Korrekte Antwort(en) aus Frage + AnswerOptions anzeigen (nur IDs reichen; Frontend holt Text aus currentQuestion).                                                                                                                                                        | Backend DTO, Frontend Anzeige                                   |
| 2.7 | **Unit-Tests**                           | Backend: onPersonalResult liefert für Participant A nur A-Daten; Werte (rankChange, streak) konsistent. Frontend: Scorecard erscheint bei RESULTS, verschwindet bei nächster Frage.                                                                                                   | Backend + Frontend Specs                                        |

---

## Phase 3: Motivationsmeldungen (Story 5.7)

Kontextlogik clientseitig aus Scorecard-Daten; Meldungen je nach Kontext auswählen.

| #   | Task                                 | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                               | Datei/ Ort                                      |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 3.1 | **Kontext-Mapping**                  | Funktion `getMotivationMessage(scorecard: PersonalScorecardDTO, settings): string`: Richtig+schnell (Top 25% Antwortzeit) → „Blitzschnell! ⚡“; Richtig+Streak≥3 → „On fire! 🔥 …“; Richtig+langsam → „Richtig! Knapp, aber korrekt 👍“; Falsch+vorher Streak → „Streak gerissen! …“; Falsch+Rang oberes Drittel → „Kopf hoch …“; Falsch+Rang unteres Drittel → „Weiter so …“; Rangaufstieg → „… Plätze aufgestiegen! 🚀“. | `apps/frontend` (session-vote oder shared util) |
| 3.2 | **Antwortzeit**                      | Wenn Backend in PersonalScorecardDTO `responseTimeMs` (optional) liefert: Top 25% schnell → Blitzschnell. Sonst heuristisch oder weglassen bis DTO erweitert.                                                                                                                                                                                                                                                              | Optional DTO-Erweiterung                        |
| 3.3 | **Respekt enableMotivationMessages** | Nur anzeigen, wenn Quiz-Settings `enableMotivationMessages === true`. Bereits in session-vote genutzt; Meldung aus Kontext statt pickRandom.                                                                                                                                                                                                                                                                               | session-vote                                    |
| 3.4 | **i18n**                             | Meldungen in Übersetzungsdateien (Story 6.2); bis dahin deutsche Texte fest.                                                                                                                                                                                                                                                                                                                                               | Optional vorbereiten                            |

---

## Phase 4: Sound-Effekte (Story 5.1)

Events: Session-Ende (Gong), neue Frage (Kurz-Sound), letzte 5 Sekunden Countdown (Tick). Nur Host/Beamer + ggf. Student (bei Belohnung 5.4).

| #   | Task                           | Beschreibung                                                                                                                                                                                                                                  | Datei/ Ort                                                  |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 4.1 | **Audio-Service**              | Service: Web Audio API, einmaliger User-Gesture (erster Klick) aktiviert Context. Methoden: `playSound(key: 'sessionEnd' \| 'questionStart' \| 'countdownTick')` → lädt aus `assets/sound/countdownEnd/`, `connecting/`, `countdownRunning/`. | `apps/frontend/src/app/core/` oder `shared/` (SoundService) |
| 4.2 | **Respekt enableSoundEffects** | Nur abspielen, wenn Quiz-Settings `enableSoundEffects === true`.                                                                                                                                                                              | Host + ggf. Vote                                            |
| 4.3 | **Session-Ende**               | Bei Status FINISHED (Host): `playSound('sessionEnd')`.                                                                                                                                                                                        | session-host                                                |
| 4.4 | **Neue Frage**                 | Bei Status ACTIVE / onQuestionRevealed (Host): `playSound('questionStart')`.                                                                                                                                                                  | session-host                                                |
| 4.5 | **Countdown-Tick**             | Letzte 5 Sekunden: pro Sekunde `playSound('countdownTick')`. Nur wenn Countdown aktiv; mit prefers-reduced-motion optional stumm.                                                                                                             | session-host (oder Countdown-Komponente)                    |
| 4.6 | **Unit-Tests**                 | Service: Mock AudioContext; bei playSound wird korrekter Pfad geladen. Optional: Integration „Sound an“ vs „Sound aus“.                                                                                                                       | SoundService.spec.ts                                        |

---

## Phase 5: Hintergrundmusik (Story 5.3)

Nur Dozenten-Ansicht (Lobby + Countdown); stoppt bei RESULTS.

| #   | Task                       | Beschreibung                                                                                                                                                    | Datei/ Ort                                           |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 5.1 | **Musik-Service**          | Service: Wiedergabe aus `assets/sound/lobby/` (Song0–3 oder Track-Namen). Lautstärke 0–100 %, Loop. Stop bei `stop()`.                                          | `apps/frontend` (ev. gleicher Audio-Service wie 4.1) |
| 5.2 | **Lobby/Countdown**        | In session-host: In LOBBY oder bei Countdown (vor RESULTS) starten, wenn `backgroundMusic` gesetzt. Track-Auswahl aus Quiz-Settings (z.B. "ENTSPANNT" → Song0). | session-host                                         |
| 5.3 | **Stopp bei RESULTS**      | Bei Wechsel zu RESULTS (oder nächste Frage ohne Countdown) Musik stoppen.                                                                                       | session-host                                         |
| 5.4 | **Lautstärkeregler**       | UI: Slider 0–100 % in Dozenten-Info oder Lobby-Bereich (nur sichtbar, wenn Musik aktiv).                                                                        | session-host (Details/ Lobby-Card)                   |
| 5.5 | **prefers-reduced-motion** | Optional: Bei `prefers-reduced-motion: reduce` Musik nicht automatisch starten oder stumm.                                                                      | Audio-Service / session-host                         |

---

## Phase 6: Belohnungseffekte (Story 5.4)

Platz 1–3: Konfetti (Platz 1), Medaillen-Icons, Sounds. Beamer + Smartphones der Top-3.

| #   | Task                   | Beschreibung                                                                                                                                                              | Datei/ Ort                                               |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 6.1 | **Konfetti (Platz 1)** | `canvas-confetti` oder reines Canvas/CSS: Bei FINISHED und Platz 1 Konfetti-Animation. Nur wenn `enableRewardEffects`. prefers-reduced-motion: keine Animation, nur Icon. | session-vote (Teilnehmer) + session-host (Beamer)        |
| 6.2 | **Icons Platz 1–3**    | Gold-Pokal, Silber-, Bronze-Medaillen (Material Icons oder SVG) auf Scorecard/Leaderboard.                                                                                | session-vote, session-host                               |
| 6.3 | **Sounds Platz 1–3**   | Fanfare (Platz 1), Jubel (2), Applaus (3). Assets in `assets/sound/rewards/` ergänzen; über SoundService abspielen.                                                       | SoundService, session-vote                               |
| 6.4 | **Beamer**             | Im Leaderboard (Host) bei Top 3 gleiche Icons/Effekte; Konfetti auf Beamer bei Platz 1.                                                                                   | session-host (Leaderboard-FINISHED + ggf. Zwischenstand) |
| 6.5 | **Unit-Tests**         | Bei Rang 1 und enableRewardEffects wird Konfetti/Sound getriggert; bei prefers-reduced-motion nicht.                                                                      | Optional                                                 |

---

## Phase 7: Emoji-Reaktionen (Story 5.8)

Mutation `session.react`; Reaktionen flüchtig (Redis/In-Memory); Beamer zeigt Blasen.

| #   | Task                              | Beschreibung                                                                                                                                                           | Datei/ Ort                            |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 7.1 | **Mutation session.react**        | Input: sessionId, questionId, emoji (enum). Max 1 Reaktion pro Participant pro Frage (idempotent überschreiben). In Redis/In-Memory speichern (TTL z.B. Session-Ende). | `apps/backend/src/routers/session.ts` |
| 7.2 | **Subscription onEmojiReactions** | Optional: Subscription für Host: Eingehende Reaktionen (emoji + ggf. count) streamen, damit Beamer Blasen anzeigen kann. Oder Polling für diese Frage.                 | Backend (session router)              |
| 7.3 | **Frontend Vote: Emoji-Leiste**   | In RESULTS: 5 Emojis (👏 🎉 😮 😂 😢). Ein Tap → `session.react`; Entprellung (max 1 pro Frage). Nur wenn `enableEmojiReactions`.                                      | session-vote                          |
| 7.4 | **Frontend Host: Blasen**         | Beamer: Reaktionen als aufsteigende Emoji-Blasen am rechten Rand (CSS-Animation oder einfache Liste). prefers-reduced-motion: statische Liste.                         | session-host (Presenter/Beamer-View)  |
| 7.5 | **Unit-Tests**                    | Backend: react speichert; zweiter Aufruf gleicher User/Frage überschreibt; ungültiges emoji → Fehler.                                                                  | session.react.spec oder session.test  |

---

## Übersicht: Neue/angepasste Dateien

| Aktion   | Datei / Bereich                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Neu      | `apps/frontend/src/app/core/sound.service.ts` (oder shared)                                           |
| Neu      | `apps/frontend/src/app/core/sound.service.spec.ts`                                                    |
| Neu      | Optional: `apps/frontend/.../scorecard/` (Komponente für 5.6)                                         |
| Ändern   | `apps/backend/src/lib/quizScoring.ts` (Streak-Multiplikator)                                          |
| Ändern   | `apps/backend/src/routers/vote.ts` (Streak in submit)                                                 |
| Ändern   | `apps/backend/src/routers/session.ts` (onPersonalResult, session.react, PersonalScorecard-Berechnung) |
| Ändern   | `apps/frontend/.../session-vote.component.ts` (Scorecard, Motivation, Sounds, Emoji)                  |
| Ändern   | `apps/frontend/.../session-host.component.ts` (Sounds, Musik, Konfetti/Blasen)                        |
| Ändern   | `libs/shared-types` (optional: responseTimeMs in PersonalScorecardDTO für 5.7)                        |
| Optional | `apps/frontend/src/assets/sound/rewards/` (Fanfare, Jubel, Applaus)                                   |

---

## DoD-Checkliste (pro Story)

- [ ] Code kompiliert (Backend, Frontend, shared-types).
- [ ] Alle tRPC-Ein-/Ausgaben über Zod (shared-types).
- [ ] Kein `any`; DTO-Pattern eingehalten.
- [ ] Unit-Tests: mind. Happy Path + 1 Fehlerfall pro neuer Procedure/Subscription.
- [ ] prefers-reduced-motion: Animationen/Sounds optional deaktiviert.
- [ ] Assets nur aus `apps/frontend/src/assets/sound`.

---

## Kurz: Reihenfolge

1. **5.5** Answer Streak (Backend: Streak + Multiplikator in vote.submit, quizScoring).
2. **5.6** Persönliche Scorecard (Backend: onPersonalResult + DTO; Frontend: Subscribe + Scorecard-UI).
3. **5.7** Motivationsmeldungen (Frontend: Kontextlogik aus Scorecard, enableMotivationMessages).
4. **5.1** Sound-Effekte (SoundService, assets/sound, Host + Countdown).
5. **5.3** Hintergrundmusik (Musik-Service, Lobby/Countdown, Lautstärke, Stopp bei RESULTS).
6. **5.4** Belohnungseffekte (Konfetti, Icons, Sounds, Beamer + Vote).
7. **5.8** Emoji-Reaktionen (session.react, Redis/In-Memory, Emoji-Leiste, Beamer-Blasen).
