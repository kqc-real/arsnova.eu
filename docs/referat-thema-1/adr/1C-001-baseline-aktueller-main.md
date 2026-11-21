# 1C-001: Baseline ist der aktuelle `main`, nicht `v1.3.0`

- **Status:** methodisch (2026-11-05)
- **Kategorie:** Methodik

## Kontext

Die Prüfungsvorlage verlangt, dass die Lehrperson den produktiv eingesetzten Release-Tag und Commit fixiert ([Rahmendokument](../rahmen/00-rahmen-und-pruefung.md#baseline-tag-v130-oder-aktueller-main)). Im Repository gibt es den Tag `v1.3.0` (`87c39334`, 2026-10-08). Der Stand der ersten Dossiers (`27966e75`) liegt 131 Commits später und weicht in zentralen Werten ab, etwa bei `--ctx-size` (4096 gegen 8192) und beim Default von `QA_SUMMARY_TIMEOUT_MS` (8000 gegen 90000); die Tabelle steht im [Rahmendokument](../rahmen/00-rahmen-und-pruefung.md#baseline-tag-v130-oder-aktueller-main). Offen war, gegen welchen Stand gemessen wird (offene Frage 3 im [Rahmendokument](../rahmen/00-rahmen-und-pruefung.md#offene-fragen-an-den-prüfer)).

## Entscheidung

Gemessen wird der aktuelle `main`, nicht `v1.3.0`. Grundlage ist die E-Mail des Prüfers (notiert 2026-11-04): „Aktualisieren Sie Ihren Fork und Clone vor Ihrer Auswertung / Untersuchung.“ Die modellfreien Tests (Teil 1–3) bleiben an `248029dc` gebunden; beide Laborläufe (Laptop und PC) laufen auf dem Codestand `main@9f230abc`, dem Merge-Base mit `upstream/main`. Auf den späteren upstream-Stand `96b2e46e` wurde bewusst nicht nachgezogen. _Aktualisiert 2026-11-10:_ Für spätere Läufe abgelöst durch [ADR 1C-025](1C-025-codestand-auf-upstream-aktualisiert.md) und [ADR 1C-026](1C-026-messstand-festhalten-upstream-nachziehen.md): Der Nachlauf vom 2026-11-09 misst `f746ffba` (upstream `def56700`).

## Alternativen

- **`v1.3.0` als Baseline.** Verworfen: Die Antwort des Prüfers zielt auf den aktuellen Stand; außerdem fehlen im Tag spätere Fixes, und die zentralen Werte unterscheiden sich ([Rahmendokument](../rahmen/00-rahmen-und-pruefung.md#baseline-tag-v130-oder-aktueller-main)). Eine Rückportierung der Laborharness auf den Tag entfällt ([Labor-Design 3.3](../specs/2026-10-25-1c-labor-design.md#33-referenzstand-und-manifest)).
- **Nachziehen auf `96b2e46e` vor den Läufen.** Verworfen, weil beide Läufe denselben Code messen sollen; Begründung und Prüfung in [ADR 1C-022](1C-022-codestand-eingefroren-9f230abc.md).

## Belege

- Der Laptop-Lauf nennt Commit `2113632320851a647d6defab9aa5fa937a6f231a` (sauber) und den Referenzstand `main@9f230abc`, 0 Commits hinter upstream zum Laufzeitpunkt ([Laptop-Protokoll](../evidenz/1C/2026-11-05-labor.md#umgebung)).
- Das PC-Protokoll nennt Lauf-Commit `36218689e96f3840fefd37c5f7f0e6c52560570c`, Baseline `main@9f230abc`, und dass `upstream/main` bei `96b2e46e` stand, 3 Commits voraus, bewusst nicht eingemergt ([PC-Protokoll](../evidenz/1C/2026-11-05-labor-pc.md#umgebung); _Anker korrigiert 2026-11-10_).
- Die Abweichungen zwischen `248029dc` und dem Referenzstand sind im [Labor-Design 3.4](../specs/2026-10-25-1c-labor-design.md#34-abweichungen-des-referenzstands-gegenüber-248029dc) ausgewiesen. Der Trockenlauf am Merge ergab dieselben Budgets der Referenzfixture wie an `248029dc` (`dataTokens` 6338, 6608 und 6660); dort steht auch der Nachtrag zu `9f230abc`.
- Ablauf der Entscheidung: [Labor-Design 11, Frage P1](../specs/2026-10-25-1c-labor-design.md#11-offene-fragen).

## Folgen

- Alle Laborzahlen gelten nur für `main@9f230abc` und die im JSON genannten Artefakte, nicht für `v1.3.0` und nicht für `96b2e46e`. _Aktualisiert 2026-11-10:_ Das betrifft die Läufe vom 2026-11-05; die Zahlen des Nachlaufs gelten für `f746ffba` (upstream `def56700`, [ADR 1C-026](1C-026-messstand-festhalten-upstream-nachziehen.md)).
- Die Prüfungsvorlage nennt „Release 1.3“; die Aussagen übertragen sich auf den Tag nur, soweit die Abweichungstabelle sie nicht berührt. Das ist eine Gültigkeitsgrenze.
- Der Codestand der Läufe wird im Laborbereich nochmals als eigene Festlegung geführt ([ADR 1C-022](1C-022-codestand-eingefroren-9f230abc.md)).
