# E5 – Vergleich a657798e ↔ 9f230abc und Ursache des Mehraufwands

Lauf am 04.11.2026, gleicher Laborrechner (i7-11700F, 4 logische CPUs, WSL2), Node v24.18.0, beide Stände direkt nacheinander, je zwei Durchgänge (`e5-bench.ts`, unverändert).

| Fragen n | Stand    | Nur Regeln Median ms | Voll p95 ms (Durchgang 1 / 2) |
| -------- | -------- | -------------------- | ----------------------------- |
| 6        | a657798e | 0,067 / 0,068        | 0,67 / 0,71                   |
| 6        | 9f230abc | 0,43 / 0,46          | 1,40 / 1,47                   |
| 500      | a657798e | 1,73 / 1,59          | 10,57 / 9,08                  |
| 500      | 9f230abc | 6,96 / 7,16          | 15,88 / 16,21                 |

Der offizielle Lauf `e5-9f230abc.md` liegt im selben Bereich (500 Fragen: Voll p95 14,75 ms).

**Ursache.** Die Q&A-Regeln in `moderation-compass-rules.ts` sind für dieses Szenario unverändert: Die neuen Zeilen betreffen nur Quizfakten. Geändert hat sich der Präsentationsadapter `apps/frontend/src/app/features/session/session-host/moderation-compass.ts`. Er bereitet jede Quelle jetzt in Überschrift, Beleg und Kontext auf und prüft dabei Überschneidungen per Tokenvergleich. Ein CPU-Profil des E5-Laufs (`node --cpu-prof`) zeigt die Anteile an der gesamten Laufzeit:

| Anteil | Funktion                                                                              | Datei                                                        |
| ------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 12,8 % | `stripMarkdownToPlainText` (über `compassQuestionStem` → `extractExportQuestionText`) | `libs/session-export-report/src/markdown-plain-text.util.ts` |
| 8,8 %  | `normalizeCompassCompareText`                                                         | `moderation-compass.ts`                                      |
| 5,4 %  | `truncateCompassLabelAtWord`                                                          | `moderation-compass.ts`                                      |
| 4,2 %  | `extractExportQuestionText`                                                           | `markdown-plain-text.util.ts`                                |
| 4,1 %  | `compassContentTokens`                                                                | `moderation-compass.ts`                                      |

Je Datei entfallen 29,4 % auf `moderation-compass.ts`, 19,4 % auf `markdown-plain-text.util.ts` und 19,1 % auf die Wortextraktion (`word-cloud-term.service.ts`).

**Einordnung.** Der Mehraufwand ist real, aber für die Entscheidung unerheblich. 500 Fragen liegen bei p95 unter 20 ms, der extraktive Fallback braucht rund 0,1–0,15 s Serverzeit und die generative Kurzfassung rund 57 s.
