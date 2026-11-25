# 1C-022: Codestand beider Laborläufe eingefroren auf `main@9f230abc`

- **Status:** methodisch (2026-11-05); _aktualisiert 2026-11-06:_ für spätere Läufe abgelöst durch [1C-025](1C-025-codestand-auf-upstream-aktualisiert.md), für die Läufe vom 2026-11-05 weiter gültig
- **Kategorie:** Methodik

## Kontext

Die Baseline ist der aktuelle `main` (ADR [1C-001](1C-001-baseline-aktueller-main.md)). Der Laptop-Lauf am Morgen des 2026-11-05 maß `main@9f230abc`, damals 0 Commits hinter upstream ([Laptop-Protokoll, Umgebung](../evidenz/1C/2026-11-05-labor.md#umgebung)). Vor dem Zusatzlauf am PC war `upstream/main` auf `96b2e46e` weitergegangen, 3 Commits voraus ([PC-Protokoll, Umgebung](../evidenz/1C/2026-11-05-labor-pc.md#umgebung)). Zu entscheiden war, ob der PC-Lauf den neuen Stand misst oder denselben wie der Laptop.

## Entscheidung

Beide Laborläufe messen den Codestand `main@9f230abc`, den letzten in den Branch eingemergten upstream-Stand. U1 misst Image und Bodies aus dem Laptop-Lauf, keinen App-Code. `96b2e46e` wird nicht eingemergt. Das Laufskript trägt als Baseline den Merge-Base von `HEAD` und `upstream/main` ein, nicht den aktuellen `upstream/main` ([`labor-lauf.sh`](../evidenz/1C/labor-lauf.sh) Z. 107 und Z. 225; [Runbook 9, Schritt 2](../evidenz/1C/labor-runbook.md#9-zusatzlauf-auf-einem-zweiten-rechner-mit-produktionslimits-design-14)). Eingeführt hat das Commit `36218689`.

## Alternativen

- **`96b2e46e` vor dem PC-Lauf einmergen.** Verworfen: Laptop und PC hätten dann verschiedenen Code gemessen. Ein Unterschied zwischen den Läufen wäre nicht mehr Hardware und Limits zuzuordnen gewesen ([PC-Protokoll, Umgebung](../evidenz/1C/2026-11-05-labor-pc.md#umgebung)).
- **Modellfreier Trockenlauf am neuen upstream-Stand**, wie am Merge `533b1100` und an `9f230abc` ([Labor-Design 3.4](../specs/2026-10-25-1c-labor-design.md#34-abweichungen-des-referenzstands-gegenüber-248029dc)): Harness mit Test-Runtime, Versionen und Budgets der Referenzfixture. Er zeigt ohne Modell, welche Zusagen sich verschieben. Nicht gemacht; Kandidat für einen Nachlauf. _Aktualisiert 2026-11-06:_ nachgeholt auf `44c0a796` ([Trockenlauf](../evidenz/1C/2026-11-06-trockenlauf-upstream.md)).
- **Beide Läufe auf `96b2e46e` wiederholen.** Nicht gewählt: Das kostet einen zweiten Laptop-Lauf (82 min) und braucht eine neue Vorabfestlegung. In den Quellen ist das nicht geplant.

## Belege

- **Gleicher Produktcode in beiden Läufen:** Laptop-Lauf an Commit `21136323`, PC-Lauf an `36218689`, beide sauber ([Laptop](../evidenz/1C/2026-11-05-labor.md#umgebung), [PC](../evidenz/1C/2026-11-05-labor-pc.md#umgebung)). `git diff --stat 21136323 36218689 -- apps libs docker 'docker-compose*.yml' scripts package.json` ist leer (geprüft am 2026-11-05).
- **Branch gegen Baseline:** `git diff --name-only 9f230abc 36218689 -- apps libs docker 'docker-compose*.yml'` nennt 14 Dateien, ausschließlich Tests und Testhilfen (`__tests__/…`, `*.test.ts`). Das passt zu ADR [1C-004](1C-004-empfehlung-statt-patch.md).
- **`96b2e46e` ändert den gemessenen Pfad inhaltlich.** Geprüft am 2026-11-05 mit `git diff 9f230abc 96b2e46e` (`96b2e46e` = `upstream/main` zu diesem Zeitpunkt; die Änderungen stammen aus `12f1d8e4` und `a998ada0`, gemergt mit `96b2e46e`, PR #643):
  - **Instruktion:** `QA_SUMMARY_TECHNICAL_INSTRUCTION_VERSION` `qa-summary-technical-handoff-v2` → `qa-summary-technical-handoff-v5` (`libs/shared-types/src/qa-summary-v2.ts` Z. 21), mit neuem Instruktionstext in `moderationSummaryContext.ts`.
  - **Grammatik:** `statements` in `wireOutputJsonSchemaFor` (`openWeightLlmClient.ts`) von `maxItems: 3` auf `minItems: 2`, `maxItems: 4`.
  - **Quality-Gate:** neue Datei `qaSummaryQuality.ts` (`hasAcceptableQaSummaryQuality`). Im Adapter endet eine vertragsgültige Antwort, die das Gate nicht besteht, jetzt extraktiv mit `invalid_response` (`qaSummaryRuntimeAdapter.ts`).
  - **Auswahl beim Packen:** Fragekandidaten bei kleinem Korpus (unter 100 Fragen) 4 → 3, ab 100 Fragen 16. Force-Fit-Stufen `[5, 3, 2, 1]` → `[16, 12, 8, 5, 3, 2, 1]`. Neu ist `candidatePriority: 'topics-first'` (`moderationSummaryContext.ts`, `moderationPromptContextPacking.ts`).
  - **Bindung:** In `qaSummaryValidateV2.ts` kommen die erlaubten Quell-IDs jetzt aus `presentationLabels`, und eine Modellantwort mit Status `uncertain` bleibt `uncertain`.
- **Was dort gleich bleibt:** `docker/`, die Compose-Dateien, `qaSummaryConfig.ts`, `openWeightLlmConfig.ts` und `qaSummaryQueue.ts` sind zwischen den beiden Ständen unverändert (`git diff --stat` leer).

## Folgen

- Alle Laborzahlen gelten für `main@9f230abc`.
- **Nicht übertragbar:** L3 und die gemessenen Inferenzzeiten, also die Grundlage von A4 und [1C-023](1C-023-release-timeout-90-s-zu-kurz.md), dazu das Wachstum je Auftrag in L6 und U1 ([1C-024](1C-024-prompt-cache-ram-begrenzen.md)). Alle drei hängen an der Zahl der Prompt- und Ausgabetokens, und die ändern Instruktion v5, Grammatik (bis zu 4 Aussagen) und Auswahl beim Packen. Upstream selbst nennt die Laufzeit von 56,9 s „historisch“ (v2) und verlangt für v5 eine neue Laufzeit- und Qualitätsmessung (`git show 96b2e46e:docs/features/open-weight-llm-runtime.md`, Z. 258).
- **Nicht geprüft:** ob L1, L2, L4 und L5 auf `96b2e46e` gleich ausfallen; L4 hat dort mit dem Quality-Gate einen neuen Fallback-Auslöser.
  - _Aktualisiert 2026-11-06:_ Modellfrei geprüft auf `44c0a796` (enthält `96b2e46e`) im [Trockenlauf](../evidenz/1C/2026-11-06-trockenlauf-upstream.md): L1 (Vorschau = Nutzlast) hält, L5 bestätigt T3.1, die Hash-Suite ist grün. Die Antwort der Test-Runtime fällt am Quality-Gate durch (`invalid_response`), deshalb sind 11 von 20 E2E-Tests rot; Ursache ist der neue Vertrag, nicht das Produkt. L2, L3, L4 mit echtem Modell, L6 und U1 bleiben ungeprüft.
- **Defaults unverändert, die gemessenen Inferenzzeiten nicht übertragbar:** `docker/`, die Compose-Dateien, die Timeout-Defaults und `qaSummaryQueue.ts` sind in `96b2e46e` gleich. Vor einem Upstream-Issue ist der Stand gegen den dann aktuellen `main` zu prüfen.
- **Spannung zur Prüferanweisung:** Der Prüfer schrieb „Aktualisieren Sie Ihren Fork und Clone vor Ihrer Auswertung / Untersuchung“ (ADR [1C-001](1C-001-baseline-aktueller-main.md)). Der PC-Lauf maß bewusst einen Stand, der 3 Commits hinter upstream lag, 3 Commits, die den gemessenen Pfad inhaltlich ändern (Instruktion v5, Grammatik, Quality-Gate). Begründet ist das mit der Vergleichbarkeit. Ob das der Anweisung genügt, entscheidet der Prüfer. Der Punkt gehört in die offenen Fragen. _Aktualisiert 2026-11-12:_ Entschärft durch [1C-025](1C-025-codestand-auf-upstream-aktualisiert.md): Der Autor hat am 2026-11-06 den Merge von upstream und einen Nachlauf auf dem aktuellen Stand beschlossen; die Läufe vom 2026-11-05 bleiben an `9f230abc` gebunden.
- _Ergänzt 2026-11-12:_ Wie der gemessene Stand bis zur Präsentation festgehalten und upstream nur nachgezogen wird, legt [1C-026](1C-026-messstand-festhalten-upstream-nachziehen.md) fest.
- Die Node-Version des Testprozesses gehört nicht zum Codestand. Ihre Abweichung am PC steht in ADR [1C-021](1C-021-zusatzlauf-produktionslimits-zweiter-rechner.md).
