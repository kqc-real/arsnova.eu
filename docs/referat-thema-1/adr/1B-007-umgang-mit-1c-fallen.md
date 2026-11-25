# 1B-007: Umgang mit den bekannten Fallen aus 1C

- **Status:** methodisch (2026-11-12)
- **Kategorie:** Methodik

## Kontext

1C fand drei Eigenschaften des Pfads, die jeden 1B-Lauf betreffen: Der Release-Timeout ist auf Laborhardware zu kurz ([ADR 1C-023](1C-023-release-timeout-90-s-zu-kurz.md)), der Prompt-Cache wächst bis zum OOM-Kill ([ADR 1C-024](1C-024-prompt-cache-ram-begrenzen.md)), und das Quality-Gate verwirft die echten Antworten ([ADR 1C-018](1C-018-quality-gate-verwirft-echte-antworten.md)).

## Entscheidung

- **Timeout:** vorab kalibriert ([ADR 1B-005](1B-005-abweichungen-vom-release.md)).
- **`--cache-ram`:** Der Release-Wert bleibt. Je Reihe höchstens 10 Aufträge nach frischem Start der Runtime (in 1C kam der Kill beim 21. Auftrag); Speicher des Runtime-Containers im 15-s-Takt. Ein OOM wäre ein Befund, kein Messfehler.
- **Quality-Gate:** Erwarteter Endstatus `ready` / `extractive` / `invalid_response`, vorab festgelegt. Die Zeiten gelten, weil die Runtime vollständig rechnet, bevor das Gate die Antwort verwirft.

## Alternativen

- **`--cache-ram 0` setzen:** verworfen; ändert den Release-Pfad ohne Not.
- **Gate im Labor umgehen:** verworfen; Produktionscode und nicht Gegenstand von 1B.

## Belege

- [1B-Design, Abschnitt 7](../specs/2026-11-12-1b-zwei-host-design.md#7-bekannte-fallen-aus-1c-autor-timeout-ki-vorschlag-rest).

## Folgen

- 1B macht keine Aussage über die Qualität der Modellantwort.
- Die Wärme des Prompt-Caches wird über `timings.cache_n` je Auftrag ausgewiesen.
