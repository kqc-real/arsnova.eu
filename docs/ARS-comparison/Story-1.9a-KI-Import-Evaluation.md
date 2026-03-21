# Evaluation: Story 1.9a & 1.9b – KI-gestützter Quiz-Import

> **Stand:** März 2025 · Vergleich mit Mentimeter, Kahoot, Slido  
> **Hinweis:** Der KI-Workflow ist in zwei Stories aufgeteilt: **1.9a** (Import-UI, Zod, Yjs) und **1.9b** (KI-Systemprompt, kontextbasiert, schema-getreu).

---

## 1. Kurzfassung

- **Story 1.9a** ergänzt den regulären Quiz-Import (1.9) um den **Import** von LLM-generierter JSON: Dialog „KI-JSON importieren“, **strikte Zod-Validierung**, Graceful Degradation, Yjs-Integration nur bei Erfolg.
- **Story 1.9b** liefert den **KI-Systemprompt**: Angebot **dort in der UI, wo der Dozent bereits Preset, Zielgruppe, Schwierigkeitsgrad etc. gewählt hat**; Prompt wird mit diesen Werten **kontextualisiert** und als wartbares Artefakt **feingetunt**, damit die LLM-Ausgabe schema-getreu bleibt. Inkl. RAG-Anleitung für Präsentation/Skript.

**Bewertung:** Beide Stories sind **technisch stimmig** und **wettbewerbsdifferenzierend**. Die Aufteilung trennt sauber: **1.9b** = viel Feintuning für Prompt/Schema-Treue + richtige Platzierung; **1.9a** = robuster Import unabhängig von der Prompt-Qualität.

---

## 2. Interne Story-Evaluation

### Stärken

| Aspekt                     | Bewertung                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Zero-Knowledge / DSGVO** | Vorlesungsskripte und Lehrmaterial werden **nicht** an arsnova.eu oder einen KI-Dienst der Plattform gesendet. Der Dozent nutzt ein externes LLM nach eigenem Gusto (ChatGPT, Claude, lokales Modell). |
| **Robustheit**             | Zod + `safeParse()` verhindert Abstürze und unsichere Typen; explizite Fehlerbehandlung mit lesbaren Meldungen (z. B. „Bei Frage 2 fehlt ‚isCorrect‘“) entspricht DoD und AGENT.md.                    |
| **Wiederverwendung**       | Nutzung des gleichen Import-Schemas wie Story 1.9 (`quizImportSchema` in `libs/shared-types`) reduziert Duplikation und hält Typen konsistent.                                                         |
| **Local-First**            | Nur bei erfolgreicher Validierung wird in Yjs/IndexedDB geschrieben – konsistent mit Story 1.5 und ohne Server-Roundtrip.                                                                              |
| **Kein Vendor Lock-in**    | Kein Abo für „KI-Feature“; Dozent kann jedes LLM (auch Open Source, On-Prem) nutzen.                                                                                                                   |

### Risiken & Abhängigkeiten

| Risiko                | Mitigation                                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prompt-Qualität**   | Der vordefinierte System-Prompt muss das exakte JSON-Schema (inkl. Enums, Pflichtfelder) dokumentieren und die Nutzung von Kontext-Upload (RAG) für Präsentation/Skript anleiten; einmalige Pflege in `shared-types` / Frontend. |
| **UX: mehr Schritte** | Copy Prompt → Chatbot öffnen → ggf. Kontext hochladen (RAG) → Copy JSON → Import. Vergleichbar zu „Datei bei Mentimeter/Kahoot hochladen“; Datensouveränität bleibt bei arsnova.eu (kein Upload zu uns).                         |
| **Halluzinationen**   | Zod fängt Formatfehler ab; inhaltliche Fehler (falsche Antworten) kann der Dozent in Preview (Story 1.13) prüfen.                                                                                                                |

### Technische Passung & Aufteilung 1.9a / 1.9b

- **1.9a:** Import-Dialog, Zod, Fehlerbehandlung, Yjs – rein clientseitig; Schema in `libs/shared-types`, Dialog in `apps/frontend`.
- **1.9b:** Prompt-Template (`ki-quiz-prompt.ts`), Kontext aus Startseiten-Preset + `localStorage` der Preset-Optionen; Zugang **„Mit unserem Prompt zum fertigen Quiz“** in der **Quiz-Sammlung** (`/quiz`). Kanonische Spezifikation: **ADR-0007**.
- **Angular:** Dialog (1.9a) und Prompt-Button/Angebot (1.9b) als Standalone Components mit Signals; Snackbar/Fehleranzeige statt Modal (STYLEGUIDE).

---

## 3. Wettbewerbsvergleich: KI-Quiz-Erstellung & Import

### Übersicht

| Kriterium               | **Mentimeter**                        | **Kahoot!**                       | **Slido**                             | **arsnova.eu (Story 1.9a)**                                                                                                                                          |
| ----------------------- | ------------------------------------- | --------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KI-Fragenerstellung** | ✅ Integriert (AI Quiz Generator)     | ✅ Integriert (PDF/URL/Thema)     | ✅ Integriert (AI Quiz, AI für Polls) | 🟡 **Externes LLM** + Import                                                                                                                                         |
| **Eingabe**             | Thema/Dokument in Mentimeter einfügen | PDF/URL/Thema in Kahoot hochgeben | Thema / Empfehlungen in Slido         | **Prompt aus Quiz-Sammlung kopieren** → Präsentation/Skript per **Kontext-Upload (RAG)** im Chatbot; Preset/Optionen stecken im Prompt (Startseite + `localStorage`) |
| **Wo läuft die KI?**    | Mentimeter-Cloud                      | Kahoot-Cloud                      | Slido-Cloud                           | **Beim Nutzer gewählt** (ChatGPT, Claude, lokal …)                                                                                                                   |
| **Datenfluss**          | Text/Dokument → Mentimeter-Server     | PDF/URL → Kahoot-Server           | Thema → Slido-Server                  | **Kein Upload** von Skripten zu arsnova.eu                                                                                                                           |
| **Import-Format**       | Direkt in Präsentation/Quiz           | Direkt in Kahoot                  | Direkt in Slido                       | **JSON** (Paste oder .json-Datei)                                                                                                                                    |
| **Validierung**         | Intern (Proprietär)                   | Intern (Proprietär)               | Intern (Proprietär)                   | **Zod** (offen, typsicher, fehlertolerant)                                                                                                                           |
| **Kosten**              | Free/Paid                             | Kahoot!+ Gold / EDU               | Alle Pläne (AI teilweise)             | **Kein Zusatzkosten** für KI-Feature                                                                                                                                 |
| **Fehlerbehandlung**    | Unklar (Blackbox)                     | Unklar (Blackbox)                 | Unklar (Blackbox)                     | **Explizit:** ZodError → lesbare Meldung, kein Crash                                                                                                                 |

### Differenzierung arsnova.eu

1. **Quiz aus Präsentation/Skript (wie Mentimeter):** Über Kontext-Upload (RAG) im Chatbot lädt der Dozent seine Präsentation/Skript hoch; der arsnova.eu-Prompt weist das LLM an, daraus ein passendes Quiz zu erzeugen. Kein Abstand zu Mentimeter hinsichtlich Use Case „Quiz zu meinem Inhalt“ – bei uns ohne Upload zu arsnova.eu.
2. **Datensouveränität:** Lehrmaterialien gehen nicht an arsnova-Server; KI läuft im vom Nutzer gewählten Dienst (ChatGPT, Claude, lokales LLM).
3. **Kein KI-Abo:** Keine Premium-Stufe für „AI Question Generator“; Nutzung beliebiger externer Dienste.
4. **Steuerung per Prompt:** Preset, Nickname-Theme, Schwierigkeit und Live-Optionen sind im System-Prompt eingebettet (Quelle: Startseiten-Preset + gespeicherte Optionen) – das generierte JSON ist damit passend konfiguriert (analog zu „Tuning“ in der Mitbewerber-App).
5. **Robustheit:** Zod + Graceful Degradation sind explizites Akzeptanzkriterium; bei Mitbewerbern typischerweise Blackbox.

### Abgleich mit Mentimeter: Quiz aus Präsentation/Skript

**Nachteil entschärft:** Moderne Chatbots (ChatGPT, Claude, etc.) bieten **Kontext-Upload (RAG)** – der Dozent lädt Präsentation, Skript oder PDF direkt im Chatbot hoch. Der arsnova.eu-Systemprompt weist das LLM an, das Quiz **aus dem hochgeladenen Kontext** zu generieren. Damit ist **dasselbe Szenario** wie bei Mentimeter („Quiz passend zum Inhalt meiner Präsentation“) abgedeckt, ohne dass Lehrmaterialien an arsnova.eu oder einen plattformeigenen KI-Dienst gehen.

**Zusätzliche Steuerung im Prompt:** Der gebaute Prompt enthält **Preset**, **Nickname-Theme**, **Schwierigkeit** und weitere Optionen aus der App-Konfiguration – analog zu „Tuning in der App“ bei Mitbewerbern, gebündelt im System-Prompt und im generierten JSON.

---

## 4. Einordnung in die Produktstrategie

- **Epic 1 (Quiz-Verwaltung):** Story 1.9a (Import + Zod) und 1.9b (Prompt) erweitern 1.9 um den KI-Workflow. **1.9b** bündelt das Feintuning des Prompts und den Zugang in der **Quiz-Sammlung**; Kontext kommt aus Startseiten-Preset und `localStorage`. **1.9a** bleibt auf Import und Validierung fokussiert.
- **Positionierung:** arsnova.eu bietet „KI-gestützten Quiz-Import“ mit **externem LLM**, **kontextbasiertem Prompt** (Preset + Optionen aus Startseite/`localStorage`) und **strikter Zod-Validierung** – mit Fokus auf Datensparsamkeit und Schema-Treue.

---

## 5. Empfehlung

- **Stories 1.9a und 1.9b** wie im Backlog beibehalten; Priorität 🟡 Should für beide. **1.9b** kann vor oder parallel zu 1.9a umgesetzt werden (Prompt-Template ist unabhängig vom Import-Dialog).
- **Implementierung:** Prompt (`ki-quiz-prompt.ts`), Platzierung in `/quiz`, Zod-Import – wie in ADR-0007 und Backlog beschrieben.

---

_Evaluation abgeschlossen._
