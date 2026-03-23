# Dokumentation: arsnova.eu

Zentrale **Landkarte** für alles unter `docs/`. Für Setup und erste Schritte zusätzlich [README.md](../README.md) und [onboarding.md](onboarding.md).

---

## Nach Rolle

| Ich bin …                                  | Start hier                                                                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Neue:r Entwickler:in**                   | [onboarding.md](onboarding.md) → [AGENT.md](../AGENT.md) → [Backlog.md](../Backlog.md)                                                                               |
| **Praktikum / Studienauftrag**             | [praktikum/PRAKTIKUM.md](praktikum/PRAKTIKUM.md) · [praktikum/BEGRIFFE-FREITEXT-UND-SEMANTIK.md](praktikum/BEGRIFFE-FREITEXT-UND-SEMANTIK.md) (Begriffe ausführlich) |
| **KI / Cursor-Kontext**                    | [cursor-context.md](cursor-context.md) (kanonische Architektur-Kurzreferenz)                                                                                         |
| **Architektur / Entscheidungen**           | [architecture/handbook.md](architecture/handbook.md), [architecture/decisions/](architecture/decisions/) (ADRs)                                                      |
| **Begriffe (UI, Workflow, Prisma-Brücke)** | [GLOSSAR.md](GLOSSAR.md)                                                                                                                                             |
| **Umgebung & Variablen**                   | [ENVIRONMENT.md](ENVIRONMENT.md), Root [`.env.example`](../.env.example)                                                                                             |
| **Sicherheit / DSGVO-Überblick**           | [SECURITY-OVERVIEW.md](SECURITY-OVERVIEW.md)                                                                                                                         |
| **Tests & CI**                             | [TESTING.md](TESTING.md), [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)                                                                                  |
| **UI / UX / A11y**                         | [ui/STYLEGUIDE.md](ui/STYLEGUIDE.md), [ui/TOKENS.md](ui/TOKENS.md), [ui/PR-CHECKLIST-UI.md](ui/PR-CHECKLIST-UI.md)                                                   |
| **Übersetzung (i18n)**                     | [architecture/decisions/0008-i18n-internationalization.md](architecture/decisions/0008-i18n-internationalization.md), [I18N-ANGULAR.md](I18N-ANGULAR.md)             |
| **Produkt / Stories**                      | [Backlog.md](../Backlog.md), [ROUTES_AND_STORIES.md](ROUTES_AND_STORIES.md)                                                                                          |
| **Mitwirkende**                            | [CONTRIBUTING.md](../CONTRIBUTING.md)                                                                                                                                |
| **Deployment / Server**                    | [deployment-debian-root-server.md](deployment-debian-root-server.md) (falls vorhanden), Docker-Compose im Repo-Root                                                  |

---

## Ordnerüberblick

| Pfad                               | Inhalt                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| [architecture/](architecture/)     | Handbuch, ADRs, Quiz-Sync-Architektur                                         |
| [diagrams/](diagrams/)             | Mermaid-Architekturdiagramme, Konsistenzcheck                                 |
| [features/](features/)             | Tiefere Feature-Doks (Team, Bonus, Preset, Blitzlicht-API, Server-Status, …)  |
| [implementation/](implementation/) | Umsetzungspläne, Story-Notizen                                                |
| [ui/](ui/)                         | Styleguide, Tokens, Guidelines (z. B. Blitzlicht)                             |
| [vibe-coding/](vibe-coding/)       | Szenarien und Prompt-Beispiele                                                |
| [examples/](examples/)             | z. B. Quiz-Import-Beispiele                                                   |
| [didaktik/](didaktik/)             | Lehr-/Folienskizzen (didaktischer Kontext)                                    |
| [praktikum/](praktikum/)           | Praktikumsauftrag, Bewertung; Langtext zu Begriffen (Freitext, Semantik, NLP) |

---

## Häufige Verweise

- **Datenmodell:** [`prisma/schema.prisma`](../prisma/schema.prisma)
- **Geteilte API-Typen:** [`libs/shared-types`](../libs/shared-types/)
- **Diagramm-Index:** [diagrams/diagrams.md](diagrams/diagrams.md), [diagrams/architecture-overview.md](diagrams/architecture-overview.md)

**Stand dieser Landkarte:** 2026-03-23 — bei neuen Top-Level-Docs hier einen Eintrag ergänzen.
