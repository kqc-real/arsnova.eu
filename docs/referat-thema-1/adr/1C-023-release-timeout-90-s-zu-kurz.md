# 1C-023: Release-Timeout von 90 s reicht für CPU-Inferenz auf beiden Laborrechnern nicht (A4)

- **Status:** empfohlen (2026-11-05), nicht umgesetzt; _aktualisiert 2026-11-09:_ Issue [#16](https://github.com/NiklasSkulll/arsnova.eu/issues/16) im Fork
- **Kategorie:** Betrieb

## Kontext

Für die Q&A-Zusammenfassung gilt ab Werk ein Timeout von 90 s:

- `QA_SUMMARY_TIMEOUT_DEFAULT_MS = 90_000` in [`qaSummaryConfig.ts`](../../../apps/backend/src/lib/qaSummaryConfig.ts) Z. 23, für die Queue;
- `OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_DEFAULT_MS = 90_000` in [`openWeightLlmConfig.ts`](../../../apps/backend/src/lib/openWeightLlmConfig.ts) Z. 5, für den Client.

Die Queue nutzt das Maximum beider Werte, begrenzt auf 300 000 ms ([`qaSummaryConfig.ts`](../../../apps/backend/src/lib/qaSummaryConfig.ts) Z. 179). [`.env.production.example`](../../../.env.production.example) setzt beide auf 90000 (Z. 242 und Z. 264). Ob dieser Wert auf CPU-Hardware für den Auftrag reicht, war die Frage A4 des Labors ([Labor-Design 11](../specs/2026-10-25-1c-labor-design.md#11-offene-fragen)).

## Entscheidung

**Befund:** Auf beiden Laborrechnern liegt die reine Inferenzzeit eines Auftrags über 90 s (_präzisiert 2026-11-10:_ im Median; Laptop 19 von 19 Läufen, PC 18 von 19; der kürzeste PC-Lauf lag bei 88,8 s). Mit dem Release-Timeout wäre der Modellpfad dort nicht nutzbar.

**Empfehlung, nicht umgesetzt** (eigene Ableitung nach dem Lauf, keine vorregistrierte Regel; [Design §11 A4](../specs/2026-10-25-1c-labor-design.md#11-offene-fragen) sieht nur einen Befund vor): Den Default im Code nicht blind anheben. Stattdessen soll der Betreiber den Timeout am tatsächlichen Inferenz-Host kalibrieren, nach dem Muster von [Labor-Design 14.3](../specs/2026-10-25-1c-labor-design.md#143-kalibrierung-und-wahl-des-timeouts): eine Anfrage mit einem realen Completion-Body, I = `prompt_ms + predicted_ms` messen. Liegt I nahe an oder über 90 s, setzt er `QA_SUMMARY_TIMEOUT_MS` und `OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS` gemeinsam auf I plus Reserve, höchstens 300 000 ms. In der Betreiberdoku ist festzuhalten, dass 90 s nur auf einem Host reicht, der den Auftrag sicher darunter rechnet.

## Alternativen

- **Default auf 300 s anheben.** Nicht empfohlen. Für den Produktionshost berichtet upstream 56,9 s Ende-zu-Ende für `qa_summary` V2 (Messung vom 17.10.2026, [Runtime-Doku](../../features/open-weight-llm-runtime.md#abschließender-cross-uid-lauf-auf-dem-finalen-image), in 1C nicht nachgeprüft). Gemessen wurde das mit v2; für v5 verlangt upstream eine neue Messung (`git show 96b2e46e:docs/features/open-weight-llm-runtime.md`, Z. 258, dort „historisch“). Für v2 hätten 90 s dort gereicht. Ein längerer Timeout hält bei einem Slot und einer globalen Queue außerdem Folgeaufträge länger auf. Die Queue lässt höchstens 8 Aufträge zu und arbeitet einen nach dem anderen ab ([Kernbefunde 7](../1C/1C-diagrams.md#kernbefunde)). _Korrigiert 2026-11-12:_ 8 ist der Standard, konfigurierbar ([Kernbefunde 7](../1C/1C-diagrams.md#kernbefunde)).
- **90 s beibehalten, ohne Hinweis.** Verworfen: Auf Hardware wie den beiden Laborrechnern endeten dann Aufträge mit `timeout` und Fallback, am Laptop nach der Kalibrierung jeder. Der Betreiber erkennt den Grund nicht aus der Konfiguration.
- **Kürzere Ausgabe statt längerem Timeout.** Nicht untersucht. Das ist eine Frage der Ausgabegrenzen ([Kernbefunde 6](../1C/1C-diagrams.md#kernbefunde)), nicht dieses Befunds.

## Belege

- **Laptop:** Inferenz-Median 163,4 s (Prefill 76,2 s, Ausgabe 86,6 s); Inferenz der Läufe 1–19 150,4–175,4 s (Ende-zu-Ende 153–178 s; _korrigiert 2026-11-10_) ([L3 Laptop](../evidenz/1C/2026-11-05-labor.md#l3-zeiten-laptop); [Befund zu A4](../evidenz/1C/2026-11-05-labor.md#entscheidungen-nach-design-abschnitt-6)).
- **PC mit Produktionslimits:** Inferenz-Median 98,8 s (Prefill 42,6 s, Ausgabe 55,4 s). Die kürzeste Inferenz lag bei 88,8 s, der Median rund 10 % über 90 s (98,8 / 90 = 1,098; Korrektur zum PC-Protokoll, Z. 81, das 9 % nennt) ([Kalibrierung PC](../evidenz/1C/2026-11-05-labor-pc.md#kalibrierung-und-wahl-des-timeouts-design-143), [L3 PC](../evidenz/1C/2026-11-05-labor-pc.md#l3-zeiten-pc)).
- **Rohdaten:** Die Auswertung mit [`auswertung.mjs`](../evidenz/1C/messung/auswertung.mjs) meldet `medianInferenceMs` 163 379,7 ([Laptop-JSON](../evidenz/1C/messung/2026-11-05-labor.json.gz)) und 98 802,3 ([PC-JSON](../evidenz/1C/messung/2026-11-05-labor-pc.json.gz)). Am 2026-11-05 neu gerechnet.

## Ursachenkette

1. **Beobachtung:** Schon die Schätzung vor dem Lauf ergab bei halbem Durchsatz der Referenzmessung 70–100 s allein für den Prefill ([Labor-Design 4](../specs/2026-10-25-1c-labor-design.md#4-ablauf)).
2. **Versuch 1, Kalibrierung Laptop:** 196 s Wandzeit, davon Prefill 95 s und Ausgabe 101 s ([Labor-Design 10.1](../specs/2026-10-25-1c-labor-design.md#101-kalibrierungsanfrage-2026-11-04-vor-der-freigabe)). Folge: 300 s statt 90 s (A4, ADR [1C-020](1C-020-timeout-300-s-und-kalibrierungsregel.md)).
3. **Hypothese für den Zusatzlauf:** Auf einem stärkeren Rechner mit Produktionslimits könnte 90 s reichen. Die Schätzung lag bei 80–95 s ([Labor-Design 14.3](../specs/2026-10-25-1c-labor-design.md#143-kalibrierung-und-wahl-des-timeouts)).
4. **Versuch 2, Kalibrierung PC:** I = 98,7 s > 90 s, also dritte Zeile der Regel ([PC-Protokoll](../evidenz/1C/2026-11-05-labor-pc.md#kalibrierung-und-wahl-des-timeouts-design-143)).
5. **Ergebnis:** Beide Läufe bestätigen die Kalibrierung, mit Inferenz-Medianen von 163,4 s auf dem Laptop und 98,8 s auf dem PC.
6. **Entscheidung:** Befund A4 auf beiden Rechnern, dazu die Empfehlung oben.

## Folgen

- **Kosten:** Für den Betreiber eine Kalibrierungsanfrage (98,8 s Wandzeit am PC am 2026-11-05, 196 s am Laptop am 2026-11-04) und zwei Umgebungsvariablen. Im Code ändert sich nichts.
- **Risiko eines längeren Timeouts:** Der eine Slot bleibt je Auftrag länger belegt, die Wartezeit in der Queue steigt. Bei Ausfällen kommt der Fallback später.
- **Gültigkeitsgrenzen:**
  - Ein Lauf mit 90 s wurde nicht ausgeführt. Der Befund folgt aus den gemessenen Inferenzzeiten, nicht aus beobachteten Timeouts. Wie viele PC-Läufe mit 90 s noch durchgekommen wären, ist nicht gemessen (kürzeste Inferenz 88,8 s).
  - Geprüft sind nur zwei Laborrechner mit CPU-Inferenz, Qwen3-4B Q4_K_M, einem Slot, der Referenzfixture (rund 2200 Prompt-Tokens) und je n = 19 Läufen mit Antwort.
  - Die Upstream-Zahl vom Produktionshost (56,9 s, v2, historisch) widerspricht dem Befund nicht. Sie zeigt aber, dass er an der Hardware hängt.
- **Stand `96b2e46e`:** Defaults unverändert, die gemessenen Inferenzzeiten nicht übertragbar. Instruktion v5, Grammatik mit 2–4 Aussagen und eine andere Auswahl beim Packen (`12f1d8e4`/`a998ada0`, gemergt mit `96b2e46e`, PR #643) ändern Prompt- und Ausgabetokens (ADR [1C-022](1C-022-codestand-eingefroren-9f230abc.md)).
- _Aktualisiert 2026-11-09:_ Auf `def56700` gilt der Befund fort ([Nachlauf, N3](../evidenz/1C/2026-11-09-labor-nachlauf.md#n3-zeiten)). Laptop, gleiche Limits: Inferenz-Median **223,7 s** (95 %-KI 209,6–248,3; Prefill 94,6 s, Ausgabe 129,1 s), kürzeste Inferenz 195,3 s, längste 255,0 s. Gegen den 2026-11-05 22 % mehr Ausgabetokens (Median 469 statt 383, v5 verlangt 2–4 Aussagen), aber auch 17–18 % weniger Durchsatz je Token bei Nebenlast; die Aufteilung ist eine Rechnung. Der Abstand zum Labor-Timeout von 300 s ist auf 45 s geschrumpft; ein Kalibrieren am Host nach der Empfehlung oben muss den neuen Stand messen, nicht v2.
