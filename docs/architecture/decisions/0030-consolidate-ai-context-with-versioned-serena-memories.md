<!-- markdownlint-disable MD013 -->

# ADR-0030: KI-Projektkontext mit versionierten Serena-Memories konsolidieren

**Status:** Accepted
**Datum:** 2026-06-02
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-06-02

## Kontext

arsnova.eu wurde bisher durch mehrere KI-Kontextdateien beschrieben:

- `.cursorrules`
- `.cursor/rules/core.mdc`
- `AGENTS.md`
- `docs/cursor-context.md`

Diese Dateien hatten sich funktional ueberlappt. Besonders `docs/cursor-context.md` enthielt einen
grossen, stabilen Kontextblock fuer Cursor-/Claude-Prompt-Caching. Gleichzeitig existiert jetzt eine
Serena-MCP-Integration mit versionierbaren Projekt-Memories und semantischer TypeScript-Navigation.

Die bisherige Struktur hatte mehrere Nachteile:

- zu viel Kontext wurde immer oder sehr frueh in Prompts geladen
- Sicherheits-, Stack-, Arbeits- und Detailwissen waren ueber mehrere Dateien dupliziert
- `docs/cursor-context.md` konnte schnell veralten, weil es viele Architekturdetails breit kopierte
- Serena-Memories waren lokal vorhanden, aber nicht versioniert
- neue Agent-Sessions hatten keinen klaren Einstiegspunkt fuer selektiven Kontext

Ziel der Konsolidierung ist:

- minimaler Always-on-Kontext
- kritische Regeln an einer sichtbaren Stelle
- detaillierter Projektkontext als selektiv ladbarer Memory-Graph
- versionierbare, reviewbare Agent-Memories
- keine parallele Grosskontextdatei neben Serena

## Entscheidung

### 1. `.cursorrules` enthaelt nur noch Kategorie-A-Kontext

`.cursorrules` wird auf dauerhaft stabile Pfad- und Stack-Fakten reduziert:

- Monorepo-Struktur
- zentrale App-/Lib-Pfade
- Laufzeit-/Stack-Fakten
- i18n-Locale-Set
- Hinweis: `Fuer Projektkontext: lies mem:core`

Regeln zu Sicherheit, Qualitaet, Workflow, Produktion und i18n-Details werden dort nicht mehr
dupliziert.

### 2. `AGENTS.md` enthaelt nur noch Kategorie-B-Regeln

`AGENTS.md` bleibt der tool-unabhaengige Agent-Vertrag fuer kritische Regeln:

- schema-first ueber `libs/shared-types`
- tRPC statt REST/DTO-Duplikaten
- serverseitige Auth statt Route-/Client-State-Vertrauen
- DTO-Stripping und kein `isCorrect` in aktiven Teilnehmer-Payloads
- Effective-Vote-Regel
- Angular Signals/Material/no Tailwind im Produktfrontend
- Locale-Sync fuer UI-Texte
- Tests, Docs-Sync, Secret-Schutz
- minimale Validierungsbaseline

Breite Navigationslisten, Cursor-spezifische Hinweise und detailreicher Projektkontext wandern aus
`AGENTS.md` heraus.

### 3. Serena-Memories werden versioniert und zum primaeren Langzeitkontext

Die Serena-Projektstruktur wird in `.serena/` versioniert:

- `.serena/project.yml`
- `.serena/.gitignore`
- `.serena/memories/**/*.md`

Nicht versioniert werden generierte oder lokale Artefakte:

- `.serena/cache/`
- `.serena/logs/`
- `.serena/project.local.yml`

`mem:core` ist der Einstiegspunkt. Von dort fuehrt der Memory-Graph zu fokussierten Memories, u. a.:

- `mem:modules/backend`
- `mem:modules/frontend`
- `mem:modules/shared-types`
- `mem:modules/data-runtime`
- `mem:security/auth`
- `mem:security/dto-stripping`
- `mem:session/lifecycle`
- `mem:backend/api-router`
- `mem:frontend/routing-components`
- `mem:frontend/i18n-ui`
- `mem:deployment/core`
- `mem:testing/core`
- `mem:conventions/naming`
- `mem:quality/dod`
- `mem:quality/workflow`

Jede neue Memory endet mit einem Abschnitt `Verwandte Memories:` und expliziten `mem:`-Verweisen.

### 4. `docs/cursor-context.md` wird entfernt

`docs/cursor-context.md` wird geloescht. Alle Referenzen darauf werden durch Verweise auf
`docs/serena.md`, `.serena/memories/core.md`, `mem:core` oder fokussierte Doku ersetzt.

Damit gibt es keine zweite grosse, potenziell driftende Kontextquelle neben dem Memory-Graphen.

### 5. `.cursor/rules/core.mdc` verweist auf `mem:core`

Die moderne Cursor-Regel bleibt als Always-Apply-Minimalhinweis bestehen. Sie verweist nicht mehr auf
`docs/cursor-context.md`, sondern auf Serena:

- `mem:core` fuer Projektkontext
- `AGENTS.md` fuer kritische Regeln
- `.cursorrules` fuer knappe Pfad- und Stack-Fakten
- fokussierte Docs und Code fuer sicherheits- oder produktionsrelevante Detailpruefung

### 6. Serena-Start und Initial-Prompts werden explizit dokumentiert

Serena wird fuer lokale Agent-Sessions aus dem Repo-Root gestartet:

```bash
serena start-mcp-server --project-from-cwd --open-web-dashboard true --context=codex
```

Das Web-Dashboard ist lokal erreichbar unter:

```text
http://127.0.0.1:24282/dashboard/index.html
```

Der erste Prompt in einem neuen Chat soll den Memory-Einstieg explizit setzen.

Fuer Cursor:

```text
Nutze Serena MCP für dieses Repo. Lies mem:core und die für diese Aufgabe relevanten Memories.
```

Fuer VS Code mit Codex:

```text
@workspace Lade den Projektkontext über das Serena MCP, beginnend mit mem:core. Bevor du Code generierst oder änderst, lies zwingend die AGENTS.md und halte dich bei der Umsetzung exakt an die dort definierten Architektur- und Validierungsregeln.
```

## Konsequenzen

### Positiv

- Der immer geladene Prompt-Kontext wird deutlich kleiner.
- Kritische Regeln bleiben in `AGENTS.md` sichtbar und tool-unabhaengig.
- Detaillierter Kontext wird selektiv nach Aufgabe geladen statt pauschal in jeden Prompt kopiert.
- Serena-Memories sind versionierbar, reviewbar und koennen in neuen Chats wiederverwendet werden.
- Die Projektstruktur fuer KI-Kontext wird klarer:
  - `.cursorrules`: Stack/Pfade
  - `AGENTS.md`: kritische Regeln
  - `.serena/memories`: detaillierter Kontext
  - `docs/serena.md`: menschliche Anleitung fuer Serena-Nutzung
- Der geloeschte Grosskontext reduziert Drift-Risiko.

### Negativ / Risiken

- Agents ohne Serena-MCP muessen mehr Kontext aus `AGENTS.md`, `.cursorrules` und fokussierten Docs
  selbst zusammensetzen.
- Die Memory-Qualitaet muss gepflegt werden; veraltete Memories koennen falsche Annahmen erzeugen.
- `.serena/` enthaelt auch generierbare technische Artefakte, deshalb muessen Cache, Logs und lokale
  Overrides konsequent ignoriert bleiben.
- Ein einzelner langer Kontextblock fuer Prompt-Caching steht nicht mehr zur Verfuegung.
- Neue Architekturdetails muessen bewusst an der richtigen Stelle landen, sonst entsteht erneut
  Duplikation.

## Alternativen (geprueft)

- **`docs/cursor-context.md` behalten und nur ergaenzen:** Verworfen, weil weiterhin ein grosser,
  driftanfaelliger Parallelkontext bestunde.
- **Alle Regeln in `.cursorrules` lassen:** Verworfen, weil Always-on-Kontext zu gross bleibt und
  Sicherheits-/Workflow-Regeln mit Stack-Fakten vermischt werden.
- **Alle Regeln in `AGENTS.md` konzentrieren:** Verworfen, weil `AGENTS.md` dann wieder zu einer
  grossen Kontextdatei wuerde und selektives Laden verhindert.
- **Serena-Memories lokal, aber unversioniert lassen:** Verworfen, weil neue Chats, andere
  Arbeitsumgebungen und Reviews den Memory-Graph nicht verlaesslich sehen koennen.
- **Nur Docs statt Memories pflegen:** Verworfen, weil Agents dann erneut grosse Dokumente lesen
  muessen und semantische Memory-Navigation ungenutzt bleibt.

## Implementierungsstand

Umgesetzt im Repo:

- `.cursorrules` auf minimale Stack-/Pfad-Fakten reduziert.
- `AGENTS.md` auf kritische Regeln und Validierungsbaseline reduziert.
- `.serena/` versionierbar gemacht; Cache, Logs und `project.local.yml` bleiben ignoriert.
- `mem:core` als Memory-Einstiegspunkt neu strukturiert.
- fokussierte Memories fuer Module, Security, Session-Lifecycle, API-Router, Frontend-Routing,
  i18n/UI, Deployment, Testing, Naming und Quality angelegt.
- `docs/cursor-context.md` geloescht.
- Referenzen auf `docs/cursor-context.md` entfernt oder auf Serena/`mem:core` umgestellt.
- `serena memories check` laeuft ohne referenzielle Integritaetsprobleme.
