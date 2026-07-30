# Serena für Coding-Agents

**Stand:** 2026-05-31

Serena ist für dieses Repository onboarded. Coding-Agents können damit Projekt-Memories
lesen, TypeScript-Symbole semantisch finden und Referenzen gezielter verfolgen, ohne bei jeder
Aufgabe die gesamte Struktur neu zu rekonstruieren.

## Start in einem neuen Chat

Wenn Serena in der Umgebung verfügbar ist:

```text
check serena
use serena for this repo
```

Der Agent soll dann prüfen:

- aktives Projekt: `arsnova.eu`
- Projektpfad: `/Users/kqc/arsnova.eu`
- aktive Tools: `find_symbol`, `find_referencing_symbols`, `get_symbols_overview`,
  `search_for_pattern`, `read_memory`
- vorhandene Memories: mindestens `core`, `tech_stack`, `suggested_commands`, `conventions`,
  `task_completion`

Optionaler Konsistenzcheck aus dem Repo-Root:

```bash
serena memories check
```

## Memory-Einstieg

`mem:core` ist der Einstiegspunkt. Von dort verzweigen die fokussierten Memories:

| Memory                   | Inhalt                                                      |
| ------------------------ | ----------------------------------------------------------- |
| `mem:frontend/core`      | Angular-App, Routing, i18n, Proxy, UI- und Testkonventionen |
| `mem:backend/core`       | tRPC-Router, Auth-Grenzen, Prisma/Redis, Backend-Tests      |
| `mem:shared-types/core`  | gemeinsame Zod-Schemas und API-Verträge                     |
| `mem:landing/core`       | Astro-Landing-App                                           |
| `mem:tech_stack`         | Runtime, Frameworks, Versionen, Workspaces                  |
| `mem:suggested_commands` | lokale Dev-, Build-, Test- und Smoke-Befehle                |
| `mem:conventions`        | projektweite Coding- und Review-Regeln                      |
| `mem:task_completion`    | Abschlusschecks nach Änderungstyp                           |

## Wann Serena nutzen

- Symbolüberblick für große TypeScript-Dateien statt komplette Dateien zu lesen.
- Referenzen finden, bevor ein gemeinsam genutztes Symbol umbenannt oder verändert wird.
- tRPC-, Shared-Type-, Backend- und Frontend-Auswirkungen über Modulgrenzen verfolgen.
- Ganze Funktionen, Klassen oder andere Symbole gezielt lesen oder ersetzen.
- Projektkontext über Memories laden, bevor breit in README, AGENTS.md und Doku gesucht wird.

## Grenzen

- Serena ersetzt keine Tests, keinen Typecheck und keine Review des Diffs.
- Für einfache Textsuche bleibt `rg` oft schneller.
- Für kleine punktuelle Zeilenänderungen sind normale Patches meist klarer als Symbol-Edits.
- Shell-Kommandos, Build-Ausgaben und Browser-Smokes laufen weiterhin über die normalen Tools.

## Pflege

- Memories nur mit stabilen, nicht offensichtlichen Projektregeln aktualisieren.
- Keine task-lokalen Notizen, Secrets oder volatile Line-Details in Memories schreiben.
- Nach größeren Memory-Änderungen `serena memories check` ausführen.
