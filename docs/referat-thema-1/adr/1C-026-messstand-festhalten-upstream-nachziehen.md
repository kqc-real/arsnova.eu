# 1C-026: Gemessenen Stand festhalten, upstream vor der Präsentation nur nachziehen und prüfen

- **Status:** methodisch (2026-11-09)
- **Kategorie:** Methodik

## Kontext

Upstream `main` ändert sich bis zur Präsentation weiter; zwischen dem Trockenlauf (`44c0a796`, 2026-11-06) und dem Nachlauf kamen 35 Commits hinzu (`def56700`, 2026-11-09). Jeder neue Stand kann Tests und Messwerte ändern. Ein Modelllauf auf dem Laptop dauert rund zwei Stunden ([Nachlauf](../evidenz/1C/2026-11-09-labor-nachlauf.md)), ein PC-Lauf ist bis zur Präsentation nicht geplant. Der Autor will den Branch in den Fork-`main` übernehmen, damit die Ergebnisse dort auch für weitere Aufträge (etwa 1B) liegen, und den Branch behalten.

## Entscheidung

- **Gemessen ist `f746ffba`** (Branch nach dem Merge von upstream `def56700`). Alle Zahlen des Nachlaufs gelten für diesen Commit; er bleibt per Hash in Protokoll und Rohdaten nachvollziehbar.
- **Vor dem Merge des PR** wurde upstream bis `def56700` nachgezogen und vollständig validiert; der Merge in den Fork-`main` erfolgt als Merge-Commit (kein Squash), damit der Branch später erneut konfliktfrei gemergt werden kann.
- **Kurz vor der Präsentation** wird upstream noch einmal in Fork-`main` und Branch gemergt, die CI muss grün sein, und es wird geprüft, ob die neuen Commits den Pfad der Zusammenfassung berühren (Kontextaufbau, Packen, Hash, Instruktion, Grammatik, Gate, Client, Queue, Runtime-Image). Berühren sie ihn nicht, gelten die Zahlen mit dem Vermerk „bis Stand X keine Änderung am Pfad“. Berühren sie ihn, wird das als Gültigkeitsgrenze genannt; höchstens der modellfreie Trockenlauf (etwa 15 min) wird wiederholt, kein Modelllauf.

## Alternativen

- **Modelllauf kurz vor der Präsentation wiederholen.** Verworfen: rund zwei Stunden Rechnerzeit, und jeder Merge kann wie am 2026-11-06 neue Anpassungen der Tests verlangen, unter Zeitdruck.
- **Auf `44c0a796` stehen bleiben.** Verworfen: Der Autor will den Branch in den Fork-`main` übernehmen; ein veralteter Branch würde dort bei jedem Abgleich mit upstream Unterschiede erzeugen.
- **Squash-Merge in den Fork-`main`.** Verworfen: Ein späterer zweiter Merge desselben Branches würde dann Konflikte erzeugen.

## Belege

- **Prüfung vom 2026-11-09** gegen `def56700`: Die 35 Commits nach `44c0a796` ändern im Backend nur die Lernziel-Anweisung in `openWeightLlmClient.ts` (eigener Zweig; der Nachrichtenaufbau der Zusammenfassung V2 ist unverändert) und Leertexte in `qaSummaryExtractive.ts` für en, fr, es und it ([Nachlauf-Design, Nachtrag 7](../specs/2026-11-06-1c-nachlauf-design.md#7-nachtrag-2026-11-09-nach-der-freigabe-vor-dem-lauf)). _Korrigiert 2026-11-10:_ Vollständig nach `git diff --stat 44c0a796 def56700 -- apps/backend/src libs` ändern sie außerdem die Lernziel-Meldungen in `learningObjectiveDerivation.ts` (Texte für en, fr, es und it), dazu einen Test in `openWeightLlmClient.test.ts`, in `libs/session-export-report` die Version, Labels und deren Locale-Hilfe und in `libs/shared-types/package.json` Version und Testabhängigkeiten; nichts davon liegt auf dem Pfad der Zusammenfassung. Probe-Merge (`git merge-tree`) des Branches mit `def56700` ohne Konflikt.
- **Validierung auf dem Merge-Stand** `b13c9eae` (lokal, 2026-11-09): `npm ci`, Typecheck, Lint, `npm test` (Runtime-Skripte 12, shared-types 297, session-export-report 92, Backend 2060 bestanden mit 96 übersprungen und 1 todo, Frontend 2865), Hash-Suite 8/8, E2E 20/20, Harness-Trockenlauf 3/3, Linkprüfung ohne Fehler.
- Fork-`main` nach dem Abgleich `8f91e041`; er weicht von upstream nur in den sieben fork-eigenen Dateien unter `docs/referat-thema-1/` ab.
- _Ergänzt 2026-11-12:_ Stand 2026-11-10 war upstream `main` `d4cf97e4`; `git diff --name-only def56700 d4cf97e4` ändert nur Frontend, Doku, CI, Smoke-Skripte und das `pids_limit` des PDF-Workers in `docker-compose.prod.yml`, nichts unter `apps/backend`, `libs` oder `docker/`.

## Folgen

- Die Zahlen aller Läufe bleiben an ihre Commits gebunden: Teil 1–3 an `248029dc`, Laborläufe vom 2026-11-05 an `9f230abc`, Trockenlauf an `44c0a796` (lokaler Merge), Nachlauf an `f746ffba`.
- Die Prüfung vor der Präsentation braucht wenige Minuten und die CI; ihr Ergebnis wird im [Bericht](../1C/1C-ergebnis.md) vermerkt.
- **Offen:** Datum der Präsentation und damit der letzte Abgleich.
- _Ergänzt 2026-11-12:_ Die Baseline-Regel stammt aus [1C-001](1C-001-baseline-aktueller-main.md); die Codestände der früheren Läufe halten [1C-022](1C-022-codestand-eingefroren-9f230abc.md) (`9f230abc`) und [1C-025](1C-025-codestand-auf-upstream-aktualisiert.md) (Merge von upstream, Trockenlauf an `44c0a796`) fest.
