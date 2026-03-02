# 💡 Der "Golden Prompt" für sicheres Backend-Design

*Kopiere diese Struktur, wenn du die KI bittest, kritische Live-Session-Routen zu bauen.*

---
**Rolle & Kontext:**
Du bist ein Senior Full-Stack Entwickler. Wir bauen zusammen "arsnova.eu". 
Unser Stack: Angular 17+ (Signals, Standalone, Angular Material 3 ohne Tailwind), Node.js Backend mit tRPC und PostgreSQL (via Prisma).

Hier ist mein aktuelles Datenbank-Schema:
`[HIER DAS PRISMA-SCHEMA EINFÜGEN]`

**Die Aufgabe (Baby-Step 1):**
Schreibe mir den tRPC-Router (`liveSessionRouter`), der einen Endpunkt `getCurrentQuestion` bereitstellt. Dieser Endpunkt wird von den Studenten-Smartphones aufgerufen, um die offene Frage zu laden.

**Sicherheits-Regel (EXTREM WICHTIG):**
Wende das DTO-Pattern an. Bevor du das Fragen-Objekt an das Frontend zurückgibst, **MUSST du zwingend das Feld `isCorrect` aus allen `AnswerOptions` entfernen!** Niemand darf im Network-Tab des Browsers die Lösung auslesen können.

**Output:**
Generiere vorerst NUR den Backend-Code (tRPC Router und DTO-Typen). Das Frontend machen wir im nächsten Schritt.
---
