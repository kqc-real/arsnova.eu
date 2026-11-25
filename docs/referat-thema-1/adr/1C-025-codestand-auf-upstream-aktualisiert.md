# 1C-025: Codestand auf upstream `44c0a796` aktualisiert, Test-Runtime an das Quality-Gate angepasst

_Korrigiert 2026-11-12:_ Gemergt wurde upstream `5cff6791`, das `44c0a796` enthält (siehe Entscheidung); der Titel bleibt wegen Dateiname und Verweisen unverändert.

- **Status:** methodisch (2026-11-06)
- **Kategorie:** Methodik

## Kontext

[ADR 1C-022](1C-022-codestand-eingefroren-9f230abc.md) hielt den Codestand beider Laborläufe auf `main@9f230abc` fest, damit Laptop und PC denselben Code messen. Der Prüfer verlangte, Fork und Clone vor der Auswertung zu aktualisieren ([ADR 1C-001](1C-001-baseline-aktueller-main.md)). Der modellfreie [Trockenlauf](../evidenz/1C/2026-11-06-trockenlauf-upstream.md) am lokal zusammengeführten Stand `44c0a796` zeigte: Die Zusagen halten, aber 11 von 20 E2E-Tests werden rot, weil die Test-Runtime nur eine Aussage liefert und das neue Quality-Gate (`hasAcceptableQaSummaryQuality`, seit `96b2e46e`) das als `invalid_response` verwirft. Der Autor hat am 2026-11-06 einen Nachlauf beschlossen und festgelegt, upstream in den PR-Branch zu mergen.

## Entscheidung

- `kqc-real/main@44c0a796` wird über den Fork-`main` (`93bcf2e9`) in `feature-1C-context-path` gemergt (`51b39fdd`). Das Einfrieren aus 1C-022 endet hier; für die Läufe vom 2026-11-05 gilt es unverändert. _Korrigiert 2026-11-12:_ Über `93bcf2e9` kam kqc-real/main `5cff6791` (zweiter Elternteil), nicht `44c0a796`. `5cff6791` enthält `44c0a796` und 7 weitere Commits (5 Fixes, 2 Merges), die nur `apps/frontend` und `docs/` ändern (`git diff --name-only 44c0a796 5cff6791 -- apps/backend libs docker` ist leer). Der Trockenlauf bleibt am lokal zusammengeführten Stand `44c0a796`.
- Die Test-Runtime (`apps/backend/src/__tests__/lib/open-weight-test-runtime.ts`) liefert jetzt **zwei** Aussagen in der Form „Lead: Text“ mit verschiedenen Leads, beide an die erste gesendete Q&A-Quelle gebunden (V2 und Legacy). Die E2E-Erwartungen sind darauf umgestellt.
- Die Negativprobe zu T3.1 prüft jetzt, dass der Blitzlicht-Bereich der Referenzfixture aus Budgetgründen **nicht** gepackt ist und der Hash sich trotzdem bei jedem Aufbau ändert. Das ist der neue Befund aus dem Trockenlauf ([ADR 1C-016](1C-016-zeitabhaengiger-hash-blitzlicht.md)).
- _Aktualisiert 2026-11-09:_ Der Hash-Test „ändert den Hash nach einer neuen Frage und führt sie als Quelle“ prüft die neue Frage jetzt im ungepackten Analysekontext (`buildModerationPromptContext`), nicht im gepackten. Grund: Seit `12f1d8e4` (gemergt mit `96b2e46e`, PR #643) behält `trimSummaryAnalysisQuestions` bei kleinem Korpus nur drei Fragen (vorher vier), und `forceFitQuestionCandidates` entscheidet bei gleichem Score nach `sourceId` (zufällige UUID); mit vier Fragen ohne Stimmen fiel die neue Frage zufällig heraus. Gefunden in der CI auf `83f2d1a1` (Job Migration Drift), lokal reproduziert in 3 von 10 Läufen; nach der Änderung 15 von 15 grün, Mutationsprobe (falsche ID) rot.
- Produktivcode bleibt unverändert ([ADR 1C-004](1C-004-empfehlung-statt-patch.md)).

## Alternativen

- **Eigener Branch für den Nachlauf**, PR #12 bleibt auf `9f230abc`. Vom Autor nicht gewählt: Die Prüferanweisung verlangt den aktuellen Stand für die Auswertung.
- **Nur lokaler Worktree** wie im Trockenlauf. Verworfen: Der Codestand des Nachlaufs wäre für andere nicht nachvollziehbar.
- **Quality-Gate in den Tests umgehen** (etwa per Mock). Verworfen: Die E2E-Tests sollen den echten Adapterpfad prüfen; das Gate gehört dazu.

## Belege

- **Merge:** Fork-`main` `88653496` → `93bcf2e9` (`chore(sync)`, kqc-real/main `44c0a796`; _korrigiert 2026-11-12:_ Eltern `88653496` und `5cff6791`, also kqc-real/main `5cff6791`, siehe Entscheidung); gegenüber upstream weichen danach nur die sieben fork-eigenen Dateien in `docs/referat-thema-1/` ab. PR-Branch `51b39fdd`. `git diff --name-only main HEAD -- . ':!docs/referat-thema-1'` nennt weiterhin nur Testdateien, `ci.yml` und `docs/TESTING.md`.
- **Gate-Regeln** (`apps/backend/src/lib/qaSummaryQuality.ts` am neuen Stand): mindestens zwei Aussagen (Z. 65), jede mit Trenner nach höchstens 48 Zeichen, vollständigem Text ab 12 Zeichen mit Satzzeichen am Ende, verschiedene Leads, kein generischer Lead wie „Frage“ oder „Beispiel“.
- **E2E nach der Anpassung:** 20/20 auf `51b39fdd` mit Arbeitsbaum-Änderungen, lokal am 2026-11-06.
- **Mutationsproben** (lokal, nicht committet, per `git checkout` bzw. Kopie zurückgesetzt):
  - Fensterende der Blitzlicht-Quelle unabhängig vom Aufbauzeitpunkt (`quickFeedbackModerationSnapshot.ts` Z. 390, `input.observedAt.getTime()` → `0`): Die Negativprobe T3.1 wird rot (gleiche Hashes). Auch auf dem neuen Stand ist das Fensterende die einzige Ursache, obwohl der Bereich nicht gesendet wird.
  - Test-Runtime wieder mit nur einer Aussage: E1 wird rot (`invalid_response`).
- Vollständige Validierung und CI: siehe Commit und PR #12, Abschnitt „Ausgeführte Prüfungen“.

## Folgen

- Alle Befunde aus Teil 1–3 und den Laborläufen bleiben an ihren Commit gebunden (`248029dc`, `9f230abc`); die Protokolle werden nicht umgeschrieben.
- Die alten Erwartungen (eine Aussage, Blitzlicht-Quelle gepackt) stehen in der Git-Historie und in den Protokollen; die Mutationsproben aus Teil 2 und 3 galten für den alten Stand.
- Neue Laborzahlen kommen aus dem [Nachlauf](../specs/2026-11-06-1c-nachlauf-design.md); bis dahin gelten L2–L6 nur für `9f230abc`. _Aktualisiert 2026-11-09:_ Der Nachlauf lief auf `f746ffba` (mit upstream `def56700`, [1C-026](1C-026-messstand-festhalten-upstream-nachziehen.md)); Ergebnisse im [Protokoll](../evidenz/1C/2026-11-09-labor-nachlauf.md).
- Die Messdatei `qa.summary-measurement.pg.test.ts` (opt-in, nicht in der CI) ist nicht auf den neuen Stand geprüft; ihre Zahlen (M1–M7) gelten für `248029dc`.
- _Ergänzt 2026-11-12:_ Mit dem echten Modell verwirft dasselbe Gate auch die Antworten des ausgelieferten Modells; Befund und Empfehlung stehen in [1C-018](1C-018-quality-gate-verwirft-echte-antworten.md).
