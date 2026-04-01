# Mitwirken an arsnova.eu

Dieses Projekt wird **KI-gestützt** weiterentwickelt: Ihr übernehmt Architektur- und Produktverantwortung, die KI (Cursor, Copilot, o. Ä.) unterstützt bei der Umsetzung. Damit die Zusammenarbeit reibungslos läuft, hier die wichtigsten Schritte.

---

## 1. Einmalig: Umgebung & Kontext

1. **Setup:** [docs/onboarding.md](docs/onboarding.md) – Quickstart (Clone/Fork, `.env`, Docker, `npm install`, Prisma, `npm run dev`).  
   **Wichtig nach Fork/Clone:** PostgreSQL und Redis müssen laufen und das Datenbankschema muss angewendet sein (`npm run docker:up:dev` bzw. `docker compose up -d postgres redis`, danach `npm run prisma:push` und `npm run prisma:generate`). So ist die DB auf dem aktuellen Stand (inkl. aller Tabellen). Alternativ einmalig: `npm run setup:dev`, dann `npm run dev`.  
   **Variablen:** [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) · **Doku-Überblick:** [docs/README.md](docs/README.md) · **Tests/CI:** [docs/TESTING.md](docs/TESTING.md) · **Sicherheit:** [docs/SECURITY-OVERVIEW.md](docs/SECURITY-OVERVIEW.md).
2. **Pflichtlektüre (vor der ersten Story):**
   - [AGENT.md](AGENT.md) – Regeln für die KI (Baby-Steps, Signals, DTO-Stripping, Styling). **Immer zuerst in den KI-Kontext laden.**
   - [Backlog.md](Backlog.md) – Stories, Prioritäten (🔴 Must, 🟡 Should, 🟢 Could), Definition of Done (DoD).
   - Optional für komplexere KI-Sessions: [docs/cursor-context.md](docs/cursor-context.md).
3. **Vibe-Coding-Beispiele:** [docs/vibe-coding/vibe-coding-szenario.md](docs/vibe-coding/vibe-coding-szenario.md), [docs/vibe-coding/Beispiel-Prompt.md](docs/vibe-coding/Beispiel-Prompt.md).

---

## 2. Story wählen & umsetzen

- **Empfehlung:** Mit einer **🔴 Must-Story** starten, die noch **⬜ Offen** ist.
- **Reihenfolge:** Backlog-Text inkl. Akzeptanzkriterien lesen → Schema/DoD prüfen → **Backend oder Frontend zuerst** mit der KI umsetzen (Baby-Steps), dann die andere Seite – so bleibt die tRPC-Typsicherheit erhalten.
- **Shared Types:** Neue/geänderte tRPC-Ein- und -Ausgaben zuerst in `libs/shared-types/src/schemas.ts` (Zod) anlegen, dann in Backend und Frontend nutzen.

---

## 3. Vor dem Pull Request (DoD)

- [ ] Code kompiliert fehlerfrei (`npm run build` bzw. `tsc` in Backend/Frontend).
- [ ] Kein `any`; alle tRPC-Endpunkte nutzen Zod-Schemas aus `@arsnova/shared-types`.
- [ ] DoD der Story erfüllt (Tests, Frontend-Regeln, Barrierefreiheit, Datenschutz – siehe [Backlog.md](Backlog.md) „Definition of Done“).
- [ ] Bei **UI-Änderungen:** [docs/ui/PR-CHECKLIST-UI.md](docs/ui/PR-CHECKLIST-UI.md) durchgehen (Material 3, keine Tailwind-Klassen, Tokens, A11y).

---

## 4. Branch & Pull Request

- **Branch:** z. B. `feature/1.1-quiz-erstellen` oder `feature/2.4-data-stripping` (Epic/Story + Kurzbeschreibung).
- **PR:** Beschreibung mit verknüpfter Story (z. B. „Closes Epic 1, Story 1.1“), kurze Zusammenfassung der Änderungen. CI (Build, Lint, Tests) muss grün sein.
- **Review:** Betreuung oder Team prüft gegen DoD und PR-Checkliste.

---

## 5. Bei Problemen

- **Technik/Architektur:** [docs/README.md](docs/README.md), [docs/architecture/handbook.md](docs/architecture/handbook.md), [docs/architecture/decisions/](docs/architecture/decisions/) (ADRs).
- **UI/Design:** [docs/ui/STYLEGUIDE.md](docs/ui/STYLEGUIDE.md), [docs/ui/TOKENS.md](docs/ui/TOKENS.md), ADR 0005 (Material 3 ohne Tailwind).
- **Zurücksetzen:** `git reset --hard v0-epic0` (Stand nach Epic 0), siehe [README.md](README.md#-zurücksetzen-auf-einen-bekannten-zustand).

---

Viel Erfolg beim Umsetzen der Backlog-Ziele.
