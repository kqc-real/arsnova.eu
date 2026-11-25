# Issue-Entwurf: Summary-Log zeigt nicht, wohin die Zeit eines Auftrags geht

> **Status:** _Aktualisiert 2026-11-13:_ angelegt als [#19](https://github.com/NiklasSkulll/arsnova.eu/issues/19) im Fork (Unter-Issue von #8); maßgeblich ist das Issue. Ursprünglich: Entwurf, nicht angelegt. Angelegt wird erst nach Freigabe durch den Autor; Ort (kqc-real oder Fork) entscheidet er. Grundlage: [Aufbauprotokoll, Befund 6](2026-11-12-aufbau.md#befunde-für-kernaussage-c), [Laufprotokoll, Befund C](2026-11-13-lauf.md#befund-c-was-der-betrieb-sieht). Entworfen mit Claude Code (Modell Claude Opus 5.5). _Korrigiert 2026-11-13:_ Vorschlag 2 verlangte, `elapsedMs` neu zu messen; der Client misst es schon (Branch-Review).

**Vorgeschlagener Titel:** `Q&A-Zusammenfassung: vorhandene Laufzeit und Runtime-timings im Log ausweisen`

---

## Beobachtung

Mit der Runtime auf einem zweiten Host (Release 1.3) ist im Betrieb nicht erkennbar, ob ein langsamer Summary-Auftrag an Netz, Adapter oder Inferenz liegt. Die Daten dafür sind im Prozess vorhanden, werden aber nicht geloggt (Stand `a19ca70f`, Zeilen in `apps/backend/src/lib/`):

- **Laufzeit des Runtime-Aufrufs:** Der Client misst sie und gibt sie als `telemetry.elapsedMs` zurück (`openWeightLlmClient.ts` Z. 466–472, Typ `OpenWeightLlmTelemetry` Z. 74–80). `runOpenWeightLlmSummaryV2` (Z. 698–718) reicht `telemetry` weiter. Der Summary-Adapter wertet nach dem Aufruf (`qaSummaryRuntimeAdapter.ts` Z. 129) nur `status` und `output` aus; `telemetry` geht verloren.
- **Inferenzzeit der Runtime:** Das Antwortschema lässt `timings` zu (`openWeightLlmClient.ts` Z. 70), aber keine Stelle im Backend liest es aus.
- **Log:** `qa_summary:completed` enthält nur `status`, `effectiveMode`, `fallbackReason` und `latencyMs` (`qaSummaryQueue.ts` Z. 364–369).

Zum Vergleich: Die Lernziele loggen die vorhandene Telemetrie bereits (`learning_objectives:batch_completed` mit `elapsedMs`, `promptTokens`, `completionTokens`, `learningObjectiveDerivation.ts` Z. 678–684).

Im Labor ließen sich die Anteile nur mit Mitschnitten auf beiden Hosts trennen ([ADR 1B-006](../../adr/1B-006-zeitmessung-per-mitschnitt.md)). Ergebnis dort: Inferenz 99,9 % der Auftragszeit, Netz 0,43 ms im Median ([Laufprotokoll](2026-11-13-lauf.md)). Ohne diese Angaben im Log kann der Betrieb ein Netzproblem nicht von einer langsamen CPU auf dem Inferenz-Host unterscheiden.

## Vorschlag

1. Im Summary-Adapter `telemetry` aus dem Ergebnis von `runOpenWeightLlmSummaryV2` an die Queue weitergeben und in `qa_summary:completed` `elapsedMs`, `promptTokens` und `completionTokens` ergänzen, wie bei den Lernzielen.
2. Aus der Runtime-Antwort `timings.prompt_ms`, `timings.predicted_ms` und `timings.cache_n` als Zahlen übernehmen (fehlen sie, `null`) und mitloggen. `latencyMs − elapsedMs` zeigt dann die Zeit in Queue und Adapter, `elapsedMs − (prompt_ms + predicted_ms)` die Zeit für Netz und HTTP-Server.
3. Kein Prompt- oder Antworttext im Log, nur Zahlen.

**Kosten:** gering (vorhandene Werte durchreichen, ein Schema-Feld lesen). **Risiko:** gering. **Rückweg:** Revert.

## Gültigkeitsgrenze

Produktionscode `a19ca70f`; die Zeilen sind am Branch-Stand `e2e9c701` geprüft (Produktionscode dort unverändert). Gemessen auf einem Laptop mit zwei VMs (ThinkPad P50), nicht auf Produktionshardware. Der Label-Pfad ist nicht untersucht.
