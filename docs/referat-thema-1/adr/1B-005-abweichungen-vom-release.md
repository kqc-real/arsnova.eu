# 1B-005: Abweichungen des Laboraufbaus vom Release

- **Status:** methodisch (2026-11-12)
- **Kategorie:** Methodik

## Kontext

Der Nachbau soll den Release-Pfad möglichst unverändert nutzen. Der Laptop hat aber nur 8 Threads, im Repo stehen keine Image-Digests, und der Summary-Pfad ist im Release standardmäßig aus.

## Entscheidung

Gewählt ist genau eine Abweichung: Der Summary-Timeout wird vorab kalibriert (Autor, 2026-11-12). Regel nach dem Muster von [ADR 1C-023](1C-023-release-timeout-90-s-zu-kurz.md) und [Labor-Design 1C, 14.3](../specs/2026-10-25-1c-labor-design.md#143-kalibrierung-und-wahl-des-timeouts): eine nicht gewertete Anfrage, I = `prompt_ms + predicted_ms`.

| Kalibrierung     | Timeout für `QA_SUMMARY_TIMEOUT_MS` und `OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS` |
| ---------------- | ---------------------------------------------------------------------------- |
| I ≤ 75 s         | 90 000 ms (Release)                                                          |
| 75 s < I ≤ 270 s | 300 000 ms (Code-Grenze)                                                     |
| I > 270 s        | kein gewerteter Lauf; der Autor entscheidet neu                              |

Alle weiteren Abweichungen sind erzwungen und stehen mit Grund in der Tabelle des [1B-Designs, Abschnitt 3.4](../specs/2026-11-12-1b-zwei-host-design.md#34-abweichungen-vom-release-vorab-festgelegt): Runtime mit 4 statt 8 CPUs und Threads per Override; Start per `docker compose` mit Override nach den Prüfungen von `prod-compose.mjs`; selbst gebaute Image-Digests; `QA_SUMMARY_ENABLED=true` und `OPEN_WEIGHT_LLM_ENABLED=true`. Neue Abweichungen kommen vor dem gewerteten Lauf als datierter Nachtrag ins Design.

## Alternativen

- **Release-Timeout 90 s:** verworfen; auf dem Laptop lag die Inferenz in 1C über 90 s, jeder Auftrag liefe in den Timeout, und es gäbe keine Inferenzzeit.
- **Kleinere Fixture oder kürzerer Prompt:** verworfen; ändert den Auftrag und bricht die Vergleichbarkeit mit 1C.

## Belege

- Inferenzzeiten auf dem Laptop: [1C-Nachlauf](../evidenz/1C/2026-11-09-labor-nachlauf.md).
- Grenzen im Code: `OPEN_WEIGHT_LLM_TIMEOUT_MAX_MS` (`apps/backend/src/lib/openWeightLlmConfig.ts`) und die Summary-Grenze in `apps/backend/src/lib/qaSummaryConfig.ts`, beide 300 000 ms.

## Folgen

- Die Aussagen gelten für den kalibrierten Timeout; der Release-Timeout ist nicht gemessen.
- Fehlende Image-Digests im Repo sind ein Befund für Kernaussage C ([ADR 1B-008](1B-008-kernaussagen-und-schwellen.md)).
