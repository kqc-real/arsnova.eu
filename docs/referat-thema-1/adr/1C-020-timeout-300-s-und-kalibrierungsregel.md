# 1C-020: Timeout 300 s im Laptop-Lauf, Kalibrierungsregel für den Zusatzlauf

- **Status:** methodisch (2026-11-05)
- **Kategorie:** Methodik

## Kontext

Der Laborlauf soll den Kontextpfad mit dem ausgelieferten Code, Modell und Runtime-Einstellungen zeigen ([Labor-Design 3.1](../specs/2026-10-25-1c-labor-design.md#31-topologie)). Der Release-Timeout für die Q&A-Zusammenfassung ist 90 s (`QA_SUMMARY_TIMEOUT_DEFAULT_MS` und `OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_DEFAULT_MS`, siehe ADR [1C-023](1C-023-release-timeout-90-s-zu-kurz.md)). Schon vor dem Lauf zeigte die Schätzung, dass bei halbem Durchsatz der Referenzmessung allein der Prefill 70–100 s dauern würde, also am oder über 90 s ([Labor-Design 4](../specs/2026-10-25-1c-labor-design.md#4-ablauf)). Dann enden Läufe mit `timeout`, und L2 bekommt keine `usage`-Werte. Frage A4 sollte das vor dem Lauf regeln ([Labor-Design 11](../specs/2026-10-25-1c-labor-design.md#11-offene-fragen)).

## Entscheidung

- **Laptop-Lauf:** Der ganze Lauf (L1–L5, Aufwärmlauf, direkte Läufe) nutzt `QA_SUMMARY_LABOR_TIMEOUT_MS` = 300 000 ms, die Obergrenze, die das Produkt Betreibern erlaubt. Das ist eine gekennzeichnete Abweichung von der Release-Einstellung. Grundlage ist eine einzelne, nicht gewertete Kalibrierungsanfrage (A4, Variante c).
- **Zusatzlauf am PC:** Der Timeout wird nicht festgelegt, sondern vor dem Lauf nach einer Regel gewählt ([Labor-Design 14.3](../specs/2026-10-25-1c-labor-design.md#143-kalibrierung-und-wahl-des-timeouts)): Bei I ≤ 90 s läuft der Release-Timeout von 90 s, bei I > 90 s wieder 300 s. I ist die Inferenzzeit `prompt_ms + predicted_ms` einer Kalibrierungsanfrage.

Die Optionen zu A4 hat Claude Code vorgeschlagen, entschieden hat der Autor ([Labor-Design 12](../specs/2026-10-25-1c-labor-design.md#12-ki-nutzung)).

## Alternativen

- **(a) Release-Timeout 90 s für L1–L5, Timeouts als L4-Befund.** Verworfen: Nach der Kalibrierung hätte jeder Lauf mit `timeout` geendet, L1–L3 wären am echten Pfad nicht auswertbar gewesen ([Labor-Design 10.1](../specs/2026-10-25-1c-labor-design.md#101-kalibrierungsanfrage-2026-11-04-vor-der-freigabe)).
- **(b) Mit 90 s beginnen, bei mehr als 50 % `timeout` abbrechen, dann ein Zusatzlauf mit 300 s.** Verworfen nach der Kalibrierung: Der 90-s-Teil hätte nur Timeouts geliefert, und der Zusatzlauf hätte nach dem Vorschlag nur L1 und L2 geliefert und nicht als Baseline gegolten ([Labor-Design 11, A4](../specs/2026-10-25-1c-labor-design.md#11-offene-fragen)).
- **Am PC fest 300 s ohne Kalibrierung.** Verworfen: Ein Release-Lauf auf Produktionslimits war ein Ziel des Zusatzlaufs. Die Schätzung von 80–95 s lag im Grenzbereich, deshalb sollte eine Messung entscheiden ([Labor-Design 14.1](../specs/2026-10-25-1c-labor-design.md#141-zweck), [14.3](../specs/2026-10-25-1c-labor-design.md#143-kalibrierung-und-wahl-des-timeouts)).

## Belege

- **Produktgrenze 300 000 ms:** `QA_SUMMARY_TIMEOUT_MAX_MS` in [`qaSummaryConfig.ts`](../../../apps/backend/src/lib/qaSummaryConfig.ts) Z. 25 und `OPEN_WEIGHT_LLM_TIMEOUT_MAX_MS` in [`openWeightLlmConfig.ts`](../../../apps/backend/src/lib/openWeightLlmConfig.ts) Z. 8. Die Harness setzt beide Timeouts auf denselben Wert und vermerkt `timeoutDeviatesFromRelease` im JSON ([Labor-Design 3.2](../specs/2026-10-25-1c-labor-design.md#32-umgebungsvariablen)).
- **Kalibrierung Laptop (2026-11-04):** HTTP 200 in 196 s Wandzeit. Prefill: 2166 Tokens in 95 s (22,8 Tokens/s). Ausgabe: 354 Tokens in 101 s (3,5 Tokens/s). Im ungünstigsten Fall mit 640 Ausgabe-Tokens wären es rund 280 s, also unter 300 s ([Labor-Design 10.1](../specs/2026-10-25-1c-labor-design.md#101-kalibrierungsanfrage-2026-11-04-vor-der-freigabe)).
- **Kalibrierung PC (2026-11-05):** I = 98,7 s (Prefill 43 701,9 ms, Ausgabe 55 040,9 ms), im ungünstigsten Fall 134 s. Also dritte Zeile der Regel: kein 90-s-Lauf, 300 s auf Produktionslimits ([PC-Protokoll, Kalibrierung](../evidenz/1C/2026-11-05-labor-pc.md#kalibrierung-und-wahl-des-timeouts-design-143)).
- **Der Timeout hat gereicht.** Auf keinem Rechner endete ein Lauf mit `timeout`. Die längste Inferenz dauerte 175,4 s auf dem Laptop und 107,4 s auf dem PC ([L3](../evidenz/1C/2026-11-05-labor.md#l3-zeiten-laptop) und [L4 Laptop](../evidenz/1C/2026-11-05-labor.md#l4-endstatus); [L3](../evidenz/1C/2026-11-05-labor-pc.md#l3-zeiten-pc) und [L4 PC](../evidenz/1C/2026-11-05-labor-pc.md#l4-endstatus)).
- **Vorabfestlegung gewahrt:** Die Laptop-Kalibrierung ergab nebenbei q ≈ 0,32. Schwellen und Regeln wurden danach nicht geändert, die Anfrage geht nicht in die Auswertung ein ([Labor-Design 10.1](../specs/2026-10-25-1c-labor-design.md#101-kalibrierungsanfrage-2026-11-04-vor-der-freigabe)).

## Folgen

- **Gültigkeitsgrenze beider Läufe:** Die L4-Anteile (95 % `full-context`) gelten für 300 s, nicht für 90 s. Belegt ist der Kontextpfad mit dem ausgelieferten Code, Modell und den übrigen Runtime-Einstellungen, nicht die Release-Konfiguration insgesamt ([Labor-Design 7](../specs/2026-10-25-1c-labor-design.md#7-gültigkeitsgrenzen)). Daraus folgt ADR [1C-019](1C-019-endstatus-echter-pfad-beibehalten.md).
- Ein Lauf mit 90 s wurde auf keinem Rechner ausgeführt. Der Befund „90 s reichen nicht“ stützt sich auf die gemessenen Inferenzzeiten, nicht auf beobachtete Timeouts. Er steht in ADR [1C-023](1C-023-release-timeout-90-s-zu-kurz.md).
- Kosten: Ein Auftrag dauerte rund 166 s (Laptop, Median `totalMs` 165,7 s) bzw. 99 s (PC, 99,2 s), die Läufe 82 bzw. 53 min ([Laptop](../evidenz/1C/2026-11-05-labor.md#laufrechner-laptop), [PC](../evidenz/1C/2026-11-05-labor-pc.md#laufrechner-pc-gegen-laptop)).
- Die Kalibrierungsregel aus 14.3 kann ein Betreiber am eigenen Host übernehmen. Das empfiehlt ADR [1C-023](1C-023-release-timeout-90-s-zu-kurz.md).
- _Aktualisiert 2026-11-12:_ Auch der Nachlauf vom 2026-11-09 lief mit 300 s (Rohdaten: `timeoutMs` 300 000, `timeoutDeviatesFromRelease`), ohne `timeout`; die längste Inferenz der Messläufe dauerte 255,0 s (`runtimeInferenceMs.max` 254 998 ms laut `auswertung.mjs`), 45 s unter dem Timeout ([Nachlauf, N3](../evidenz/1C/2026-11-09-labor-nachlauf.md#n3-zeiten)). Den Zusatzlauf am PC beschreibt [1C-021](1C-021-zusatzlauf-produktionslimits-zweiter-rechner.md), den Codestand des Nachlaufs [1C-026](1C-026-messstand-festhalten-upstream-nachziehen.md).
- _Ergänzt 2026-11-12:_ Laborinstanz und Pfad `llm-http` legt [1C-002](1C-002-laborinstanz-eigener-rechner.md) fest.
