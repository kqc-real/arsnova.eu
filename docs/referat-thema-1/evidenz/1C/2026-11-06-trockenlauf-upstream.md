# Protokoll: 1C modellfreier Trockenlauf auf dem aktuellen upstream-Stand

- **Datum:** 2026-11-06, Läufe ab 10:31 (MEZ)
- **Autor:** Jonas Weirauch (Rolle Y)
- **Anlass:** [ADR 1C-022](../../adr/1C-022-codestand-eingefroren-9f230abc.md) nennt den modellfreien Trockenlauf am neuen upstream-Stand als ersten Schritt eines Nachlaufs; der Autor hat ihn am 2026-11-06 freigegeben. Vorbild ist die empirische Kontrolle in [Labor-Design 3.4](../../specs/2026-10-25-1c-labor-design.md#34-abweichungen-des-referenzstands-gegenüber-248029dc).
- **Rohdaten:** [`messung/2026-11-06-trockenlauf-upstream.json.gz`](messung/2026-11-06-trockenlauf-upstream.json.gz), unkomprimiert 126 017 Byte, SHA-256 `bb105b2b7a90f53dbac73b55988ef197f0b667f011e90d705ed2d088f0589372`
- **Keine Evidenz über das Modell:** Test-Runtime statt Runtime, keine Inferenz, keine Zeiten. Der Lauf zeigt nur, welche modellfreien Zusagen auf dem neuen Stand halten.

Alle Daten sind synthetisch (Referenzfixture und volle #456-Fixture). Die Rohdaten enthalten keine Token, nur die Namen der Request-Header.

## Ergebnis in einem Satz

Vorschau = Nutzlast (L1) und die Hash-Grenze halten auch auf upstream `44c0a796`, Befund T3.1 besteht weiter und trifft dort sogar einen Blitzlicht-Bereich, der aus Budgetgründen gar nicht gesendet wird; jede Antwort der Test-Runtime endet am neuen Quality-Gate mit `invalid_response`, deshalb sind 11 der 20 E2E-Tests rot, ohne dass das Produkt fehlerhaft wäre.

## Aufbau

- **Codestand:** Git-Worktree aus `feature-1C-context-path@b3ee2475`, lokal zusammengeführt mit `upstream/main@44c0a796` (Merge-Commit `00e41e00`, nicht gepusht, ohne Konflikte). Gegenüber dem gemessenen `9f230abc` enthält das `96b2e46e` (PR #643) und 18 weitere Commits ([ADR 1C-022, Belege](../../adr/1C-022-codestand-eingefroren-9f230abc.md#belege)).
- **Umgebung:** Laptop (ThinkPad P50), PostgreSQL 16.15 und Redis 7.4.11 unter Podman auf 127.0.0.1, eigene Datenbank `arsnova_1c_upstream` mit `prisma migrate deploy` am neuen Stand; Testprozess laut Rohdaten unter Node v24.14.1 (gestartet über `mise exec node@24.18.0`; die Abweichung ist nicht geklärt und für einen modellfreien Lauf ohne Zeitmessung ohne Bedeutung).
- **Befehle** (in `apps/backend` des Worktrees):
  - Harness: `RUN_QA_SUMMARY_LABOR=1 QA_SUMMARY_LABOR_FAKE_RUNTIME=1 QA_SUMMARY_LABOR_RUNS=2 QA_SUMMARY_LABOR_DIRECT_RUNS=1 QA_SUMMARY_LABOR_L5_RUNS=1 npx vitest run src/__tests__/qa.summary-labor.pg.test.ts` (Runbook, Trockenlauf, plus ein L5-Paar)
  - PostgreSQL-Suiten: `RUN_PG_QA_SUMMARY_HASH_TESTS=1 npx vitest run src/__tests__/qa.summary-hash.pg.test.ts` und `RUN_PG_QA_SUMMARY_E2E_TESTS=1 npx vitest run src/__tests__/qa.summary-e2e.pg.test.ts --reporter=verbose`
  - Unit-Tests der 1C-Dateien: `moderationSummaryContext`, `qaSummaryQueue`, `qa.summary`, `openWeightLlmClient`, `moderationQaContext`, `wordCloudAnalysisCache`; in `libs/shared-types` `qa-summary-v2.test.ts`

## Ergebnisse

| Prüfung                                            | `9f230abc` (Labor-Design 3.4, Nachtrag)                | `44c0a796` (dieser Lauf)                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Instruktion / Definition                           | `qa-summary-technical-handoff-v2` / `…-definitions-v1` | `qa-summary-technical-handoff-v5` / `moderation-prompt-definitions-v1`                                             |
| `dataTokens` Referenzfixture / L5 YESNO / L5 TEMPO | 6338 / 6608 / 6660                                     | 6553 / 6459 / 6511                                                                                                 |
| L1 Vorschau = gesendeter User-Content              | ja                                                     | ja: `userEqualsPreview` und `userEqualsSentPrepare` in allen Aufträgen `true`                                      |
| L5 YESNO (Negativprobe T3.1)                       | `source_changed`                                       | `source_changed`; Hash an allen fünf Prüfpunkten verschieden (Vorschau, Auftrag, vor und nach der Inferenz, Abruf) |
| L5 TEMPO (Kontrolle)                               | kein `source_changed`                                  | kein `source_changed`; Hash an allen fünf Prüfpunkten gleich                                                       |
| Endstatus ruhiger Auftrag mit Test-Runtime         | `ready/full-context`                                   | `ready/extractive`, Grund `invalid_response`                                                                       |
| Harness                                            | 3/3                                                    | 3/3                                                                                                                |
| Hash-Suite                                         | 8/8                                                    | 8/8                                                                                                                |
| E2E-Suite                                          | 20/20                                                  | 9/20                                                                                                               |
| Unit-Tests der 1C-Dateien / shared-types           | grün                                                   | 160 passed, 1 todo (T2.3) / 11 passed                                                                              |

**E2E im Einzelnen.** Grün: E4 (fremde Ausgabe-Version → `invalid_response`), E6a (`unavailable`), E6b (`timeout`), E7 (Stimme während der Inferenz → `source_changed`), E8 (Löschung → `source_changed`), E10 (`busy`), E12 und ihre Kontrolle (`CONFLICT`), E14b (Legacy, nur unbekannte Quellen → `uncertain`). Rot: E1 und E1b (Vorschau = Nutzlast, mit und ohne Packing-Cache), E2, E3, E5, E9, E11, E13, E14 sowie Negativprobe und Kontrolle zu T3.1.

## Ursachen der roten Tests

1. **Quality-Gate.** Die Test-Runtime antwortet mit **einer** Aussage ohne „Lead: Text“-Form ([`open-weight-test-runtime.ts`](../../../../apps/backend/src/__tests__/lib/open-weight-test-runtime.ts) Z. 106). Upstream verwirft das: `hasAcceptableQaSummaryQuality` verlangt mindestens zwei Aussagen (`qaSummaryQuality.ts` Z. 65 am Stand `44c0a796`) mit vollständiger „Lead: Text“-Form und verschiedenen Leads; der Adapter fällt dann extraktiv mit `invalid_response` zurück. Alle Tests, die `ready/full-context` oder den Text der Test-Runtime erwarten, werden dadurch rot, auch wenn die geprüfte Zusage (etwa Vorschau = Nutzlast) hält. Die Harness bestätigt L1 unabhängig davon auf dem Draht.
2. **Packen.** Die E2E-Negativprobe zu T3.1 erwartet die Blitzlicht-Quelle im gepackten Kontext (`qa.summary-e2e.pg.test.ts` Z. 1091). Upstream packt mit der neuen Auswahl (`topics-first`, Force-Fit-Stufen) so, dass der Blitzlicht-Bereich aus Budgetgründen entfällt; die L5-Rohdaten nennen dafür `feedback: 1 omitted, token-budget` im YESNO-Arm.

Beides ist eine Folge des neuen Vertrags und der neuen Auswahl beim Packen, kein Fehler im Produkt. Für einen Nachlauf mit Test-Runtime ist die Test-Runtime an den Vertrag anzupassen (Testcode, kein Produktivcode).

## Befund: T3.1 auch für einen nicht gesendeten Bereich

Im YESNO-Arm steht der Blitzlicht-Bereich nach dem Packen **nicht** im Modellkontext (Kürzung `feedback`, `token-budget`). Trotzdem ändert sich der `snapshotHash` bei jedem Kontextaufbau, und der Auftrag endet `source_changed`. Im TEMPO-Arm bleibt der Hash gleich. Damit verwirft die Hash-Grenze auf upstream jede Modellantwort bei live Blitzlicht-Runde außer `TEMPO` auch dann, wenn das Modell die zeitabhängige Quelle gar nicht gesehen hat. Die Empfehlung aus [ADR 1C-016](../../adr/1C-016-zeitabhaengiger-hash-blitzlicht.md) gilt damit auch für upstream: Den Bereich nur aus der Nutzlast zu nehmen, behebt den Befund nicht, weil der Hash den ungepackten Stand abdeckt. Gültigkeitsgrenze: ein Paar (n = 1), Test-Runtime.

## Nebenbefund: zweiter Themen-Snapshot-Cache (`f3388160`)

Upstream `f3388160` ergänzt einen nach Analyse-Eingabe geschlüsselten Themen-Snapshot-Cache, dessen Lesepfad bei Schemafehlern wie bei T2.3 still `null` liefert. Der Kontextaufbau der Zusammenfassung liest ihn nicht: Er nutzt weiterhin nur `getLatestQaSemanticTopicSnapshot` (`moderationQaContext.ts` Z. 1036 am Stand `44c0a796`), den neuen Cache liest nur der Wortwolken-Router (`wordCloud.ts` Z. 562). Für 1C ändert sich damit nichts; T2.3 gilt unverändert ([ADR 1C-015](../../adr/1C-015-themen-snapshot-unterscheidbarer-zustand.md)).

## Gültigkeitsgrenzen

- Test-Runtime statt Modell; keine Zeiten, kein Speicher, keine Aussage zu L2 (Prompt-Tokens), L3, L4 mit echtem Modell, L6 oder U1.
- Lokaler Merge, nicht der Branch; der Branch bleibt auf `9f230abc` eingefroren ([ADR 1C-022](../../adr/1C-022-codestand-eingefroren-9f230abc.md)).
- L5 mit n = 1 Paar, ruhige Aufträge n = 3 plus 1 direkt.

## KI-Nutzung

Claude Code (Opus 5.5) am Laptop hat Worktree und Datenbank angelegt, die Läufe ausgeführt, die Rohdaten ausgewertet, die Ursachen im Code nachgesehen und dieses Protokoll geschrieben. Der Autor hat den Trockenlauf freigegeben; eine Prüfung der Ergebnisse durch den Autor steht aus.
