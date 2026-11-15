# 1B-001: Baseline ist Fork-`main` `a19ca70f`

- **Status:** methodisch (2026-11-12)
- **Kategorie:** Methodik

## Kontext

1B verlangt das Zwei-Host-Deployment „von Release 1.3“ ([Auftrag 1B](../../didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md#gruppenauftrag-1b-private-inferenz-als-getrennte-serverrolle)). Das [Dossier 1B](../1B-private-inferenz-zweiter-host.md) beschreibt den Stand `27966e75` und markiert die Abweichungen zum Tag `v1.3.0`. Für 1C ist der aktuelle `main` als Baseline begründet ([ADR 1C-001](1C-001-baseline-aktueller-main.md)); offen war, welcher Stand für 1B gilt.

## Entscheidung

Gemessen wird Fork-`main` `a19ca70f` (upstream am 2026-11-12 nachgezogen, Sync-Commit `a19ca70f`). Commits des Branches `feature-1B-two-host` ändern nur Doku, Skripte und Testhelfer unter `docs/referat-thema-1/`. Grundlage ist dieselbe E-Mail des Prüfers wie in 1C-001: „Aktualisieren Sie Ihren Fork und Clone vor Ihrer Auswertung / Untersuchung.“

## Alternativen

- **`v1.3.0`:** verworfen aus den Gründen in 1C-001; zusätzlich fehlt dort der Label-Consumer, und die Limits der Runtime weichen ab ([Rahmendokument, Baseline](../00-rahmen-und-pruefung.md#baseline-tag-v130-oder-aktueller-main)).
- **Stand der 1C-Läufe (`def56700`):** verworfen; 1B misst einen neuen Aufbau, und der Prüfer verlangt den aktuellen Stand. Die Vergleichbarkeit mit 1C hängt an Fixture, Modell und Limits, nicht am Commit; Unterschiede im Pfad werden im Laufprotokoll ausgewiesen.

## Belege

- `git log --oneline -1 main` am 2026-11-12: `a19ca70f chore(sync): merge kqc-real/main into fork main`.
- Design: [1B-Design, Abschnitt 3.5](../specs/2026-11-12-1b-zwei-host-design.md#35-referenzstand-und-manifest).

## Folgen

- Alle 1B-Zahlen gelten für `a19ca70f` und die im Protokoll genannten Artefakte. _Ergänzt 2026-11-13:_ Gemessen wurde am Branch-Commit `8e9d1317`; `git diff --stat a19ca70f 8e9d1317 -- apps libs docker docker-compose*.yml package.json package-lock.json scripts` ist leer, der Produktionscode ist also der von `a19ca70f`.
- Die Zeilenangaben des Dossiers (Stand `27966e75`) werden am Laufstand nachgeprüft, bevor sie zitiert werden.
