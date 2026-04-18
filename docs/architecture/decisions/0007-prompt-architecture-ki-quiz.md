<!-- markdownlint-disable MD013 MD025 -->

# ADR-0007: Promptarchitektur für KI-generierte Quizzes

**Status:** Accepted  
**Datum:** 2025-03-05  
**Entscheider:** Projektteam

## Kontext

Dozenten sollen Quizfragen mit Hilfe von KI (z. B. aus Präsentationen oder Skripten) erzeugen können, ohne Lehrmaterialien an arsnova.eu oder einen plattformeigenen KI-Dienst zu senden (Zero-Knowledge, DSGVO). Gleichzeitig muss die App vor fehlerhaften oder halluzinierten LLM-Ausgaben geschützt werden. Die Architektur muss festlegen: Woher kommt der System-Prompt? Welches Ausgabeformat gilt? Wie wird validiert?

## Entscheidung

Wir setzen eine **Promptarchitektur** um, die folgende Prinzipien erfüllt:

1. **Externes LLM, kein Upload zu arsnova.eu**  
   Die KI läuft ausschließlich in einem vom Dozenten gewählten Dienst (ChatGPT, Claude, lokales Modell o. ä.). Präsentationen, Skripte oder PDFs werden vom Dozenten per **Kontext-Upload (RAG)** direkt im Chatbot bereitgestellt. arsnova.eu empfängt **keine** Lehrmaterialien und betreibt **keine** eigene Quiz-KI.

2. **Kontextbasierter System-Prompt aus der App**  
   Der System-Prompt wird **zur Laufzeit** in der App gebaut (`buildKiQuizSystemPrompt` in `apps/frontend/src/app/shared/ki-quiz-prompt.ts`) und in der **Quiz-Sammlung** über „Mit unserem Prompt zum fertigen Quiz“ in die Zwischenablage kopiert. Der eingefügte Kontext stammt aus dem **aktuellen Startseiten-Preset** (`ThemePresetService`: spielerisch/seriös) und – sofern vorhanden – aus den **gespeicherten Preset-Optionen** im `localStorage` (gleiche Quelle wie der Preset-Toast auf der Startseite), nicht aus dem gerade geöffneten Quiz in der Liste. So sind u. a. Rangliste, Nicknames, Timer, Team-Modus, Bonus-Codes und Lesephase im Prompt reflektiert, ohne Lehrmaterial zu übertragen.

3. **Strikte Schema-Treue: QuizExportSchema**  
   Das von arsnova.eu erwartete Format ist **exakt** das in `libs/shared-types` definierte **QuizExportSchema** (Export/Import Story 1.8, 1.9; Import-Validierung Story 1.9a als `quizImportSchema`). Der System-Prompt beschreibt dieses Schema vollständig (Pflichtfelder, Enums: `QuestionType`, `Difficulty`, `NicknameTheme` etc.). Es gibt **kein** zweites, „KI-spezifisches“ Format; die LLM-Ausgabe wird mit dem gleichen Zod-Schema validiert wie der manuelle JSON-Import (`QuizExportSchema.safeParse()`). Optionale didaktische Zusatzfelder (z. B. Erklärungen, Glossar) können später ergänzt werden, sofern sie im Schema optional sind und beim Import in Yjs ignoriert oder gemappt werden.

4. **Prompt als versionierbares Artefakt**  
   **Kanonische Quelle** des vollständigen englischen System-Prompts ist **`apps/frontend/src/app/shared/ki-quiz-prompt.ts`** (Export `buildKiQuizSystemPrompt`). Änderungen am Prompt erfolgen dort; Tests in `ki-quiz-prompt.spec.ts`. Dieses ADR dokumentiert Architektur und Vertrag; es **dupliziert** den Prompt-Text nicht mehr wortgetreu, um Drift zwischen Doku und Code zu vermeiden.

5. **RAG-Anleitung im Prompt**  
   Der Prompt weist den Dozenten an, bei Bedarf Lehrmaterial (Präsentation, Skript, PDF) per Kontext-Upload im Chatbot bereitzustellen, und das LLM an, das Quiz **aus diesem Kontext** zu erzeugen. Damit ist das Szenario „Quiz passend zum Inhalt meiner Präsentation“ (analog zu Mentimeter) abgedeckt, ohne dass Daten an arsnova.eu fließen.

6. **Validierung und Fehlerbehandlung**  
   Das Frontend nimmt die vom Nutzer eingefügte LLM-Antwort **nicht** als `any` in den State. Die Eingabe wird wie beim Datei-Import verarbeitet: **ein** Markdown-Codeblock mit Sprachtag `json` (oder kompatibles Parsing), daraus **ein** JSON-Objekt, anschließend **`quizImportSchema.safeParse()`** (bzw. `QuizExportSchema`). Bei Fehlern wird der `ZodError` ausgewertet und eine verständliche Fehlermeldung angezeigt; die App stürzt nicht ab (Story 1.9a).

7. **Ausgabeformat der KI (Vertrag)**  
   Das Modell soll nach expliziter Bestätigung durch den Nutzer **ausschließlich** **einen** vollständigen Markdown-Codeblock mit Tag `json` ausgeben, ohne Text davor oder danach, ohne mehrere Blöcke – inhaltlich exakt **QuizExportSchema** (keine Felder `id` oder `preset`). Abweichungen von diesem Vertrag widersprechen dem System-Prompt; der Importpfad in der App ist darauf ausgelegt.

## Konsequenzen

### Positiv

- Zero-Knowledge: Keine Lehrmaterialien auf arsnova-Servern; KI-Ausführung wählbar (auch On-Prem/Lokal).
- Kein KI-Vendor-Lock-in und keine Premium-Stufe für „AI Feature“.
- Ein einziges, typsicheres Schema für Export, Import und KI-Import; weniger Duplikation, klare Kontraktgrenze.
- Feintuning des Prompts unabhängig von Import-Code; bessere Langzeit-Wartbarkeit.

### Negativ / Risiken

- Prompt-Engineering-Aufwand: Der Prompt muss laufend an Schema-Änderungen und LLM-Verhalten angepasst werden.
- Mehr Schritte für den Dozenten als bei integrierter Cloud-KI (Copy Prompt → Chatbot → Kontext hochladen → Copy JSON → Import); wird durch Datensouveränität und Transparenz abgefangen.

## Alternativen (geprüft)

- **Eigene KI in der Cloud (wie Mentimeter/Kahoot):** Widerspricht Zero-Knowledge und erhöht Betriebskosten; abgelehnt.
- **Eigenes „KI-JSON“-Schema mit Mapping:** Zusätzliche Komplexität und Abweichung vom einheitlichen Export-Format; abgelehnt zugunsten direkter Nutzung von QuizExportSchema.
- **Prompt ohne Kontext aus der UI:** Dozent müsste Preset/Zielgruppe manuell im Chat wiederholen; schlechtere UX und Fehleranfälligkeit; abgelehnt.

---

## Anhang: Implementierungsreferenz (ohne Prompt-Volltext)

Der **vollständige** System-Prompt liegt ausschließlich im Code. Dieser Anhang fasst Anbindung und Vertrag zusammen.

### Kanonische Quelle

| Artefakt                       | Pfad / Symbol                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Prompt-Builder                 | `apps/frontend/src/app/shared/ki-quiz-prompt.ts` → `buildKiQuizSystemPrompt`                                 |
| Typ des Kontexts               | `KiPromptContext` (gleiche Datei)                                                                            |
| Tests                          | `apps/frontend/src/app/shared/ki-quiz-prompt.spec.ts`                                                        |
| Kopieren in die Zwischenablage | `QuizListComponent.copyKiPrompt()` in `apps/frontend/src/app/features/quiz/quiz-list/quiz-list.component.ts` |

### Eingebetteter Kontext (`KiPromptContext`)

In den Prompt werden u. a. eingetragen (Auszug; vollständige Liste im TypeScript-Interface):

- Preset-Label (lokalisiert) und Preset-Enum (`PLAYFUL` / `SERIOUS`)
- `nicknameTheme`, `readingPhaseEnabled`, `defaultDifficulty`
- Optionen: Rangliste, Nicknames, `defaultTimer`, **Action Sounds** (`enableSoundEffects`) sowie Reward-/Motivations-/Emoji-Effekte, `anonymousMode`, Team-Modus (`teamCount`, `teamAssignment`, `teamNames`), `bonusTokenCount` — **kein** `backgroundMusic` im Prompt (Hintergrundmusik nur Quiz-Editor/Session).

### Inhaltliche Bausteine des Prompts (Kurz)

- **Sprache:** Nutzersprache für Namen, Beschreibung, Fragen und Antworten; **JSON-Keys und Enums** unverändert englisch wie Schema.
- **Compliance:** Import-Vertrag hat Vorrang vor widersprüchlichen Nutzerwünschen; vor der finalen Bestätigung **kein** (Teil-)JSON.
- **Formate (Fragen):** `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `FREETEXT`, `SURVEY`, `RATING` – inkl. Validierungsregeln und Schwierigkeit `EASY` | `MEDIUM` | `HARD`.
- **Ablauf:** Strikte Konfigurationssequenz (State Machine), Zusammenfassung, explizites Ja, dann **genau ein** ` ```json ` … ` ``` `-Block mit dem vollständigen Dokument.
- **RAG:** Nutzung von Chat-Anhängen bevorzugen; **keine** Datei-/Folienverweise im Quiztext.
- **Textformat:** Markdown und KaTeX in den im Schema erlaubten String-Feldern; korrektes JSON-Escaping (z. B. LaTeX-Backslashes).
- **Verboten im JSON:** u. a. Felder `id`, `preset` (Preset ist nur UI-Kontext).

### Schema-Referenz

Autoritativ: **`QuizExportSchema`** / **`quizImportSchema`** in `libs/shared-types` (Zod). Änderungen am Schema müssen **zuerst** dort und anschließend in `buildKiQuizSystemPrompt` nachgezogen werden.

### Korrektur früherer Fassung dieses ADR

- Die KI-Antwort ist **nicht** „rohes JSON ohne Codeblock“, sondern **ein eingezäunter Markdown-Block** `json`, wie im Code gefordert und für Copy-Paste robust.
