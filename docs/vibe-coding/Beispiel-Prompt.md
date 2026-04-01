# Beispiel-Prompt für sicheres Backend-Design

_Kopiere diese Struktur, wenn du die KI bittest, kritische Live-Session-Routen zu bauen._

---

**Rolle & Kontext:**
Du bist ein Senior-Full-Stack-Entwickler. Wir bauen zusammen `arsnova.eu`.
Unser Stack: Angular 21+ (Signals, Standalone, Angular Material 3 ohne Tailwind), Node.js-Backend mit tRPC und PostgreSQL (via Prisma).

Hier ist mein aktuelles Datenbank-Schema:
`[HIER DAS PRISMA-SCHEMA EINFÜGEN]`

**Die Aufgabe (Baby-Step 1):**
Schreibe mir den tRPC-Router (`liveSessionRouter`), der einen Endpunkt `getCurrentQuestion` bereitstellt. Dieser Endpunkt wird von den Smartphones der Teilnehmenden aufgerufen, um die offene Frage zu laden.

**Sicherheitsregel (wichtig):**
Wende das DTO-Pattern an. Bevor du das Fragen-Objekt an das Frontend zurückgibst, **musst du das Feld `isCorrect` aus allen `AnswerOptions` entfernen**. Niemand darf im Network-Tab des Browsers die Lösung auslesen können.

**Output:**
Generiere vorerst **nur den Backend-Code** (tRPC-Router und DTO-Typen). Das Frontend machen wir im nächsten Schritt.

---
