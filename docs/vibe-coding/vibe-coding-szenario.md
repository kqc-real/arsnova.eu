# Live-Szenario: Eine KI-gestützte Session

### Turn 1: Setup und Backend (tRPC)

**Studierende Person (Prompt):**

> "Lies bitte `AGENT.md` und `schema.prisma`. Wir arbeiten an Epic 1. Baue den tRPC-Endpunkt `getQuizById`. Er soll das Quiz aus PostgreSQL laden. Schreibe **nur den Backend-Code**."

**KI (Antwort):**

> _Generiert fehlerfreien tRPC-Router-Code mit Zod-Validierung und Prisma-Query._

### Turn 2: Frontend-Entwurf und Fehler

**Studierende Person (Prompt):**

> "Jetzt das Angular-Frontend. Erstelle die `QuizViewComponent`. Lade die Daten via tRPC und zeige sie in einer Angular-Material-Card mit tokenbasiertem Styling."

**KI (Antwort):**

> _Generiert die Komponente, macht aber einen Fehler:_
> `quiz$ = new BehaviorSubject<any>(null);` (nutzt ein veraltetes RxJS-Muster)

### Turn 3: Korrektur und Code Review

**Studierende Person (Prompt):**

> "Prüfe bitte noch einmal `AGENT.md`. Du hast `BehaviorSubject` für den UI-Zustand verwendet. In diesem Projekt nutzen wir dafür ausschließlich **Angular Signals**. Korrigiere den Entwurf entsprechend."

**KI (Antwort):**

> _Korrigiert den Entwurf und liefert modernen Code:_
> `quiz = signal<Quiz | null>(null);`
