# 1C-012: Entkopplung von Host-Aufruf und Modellantwort beibehalten

- **Status:** angenommen (2026-11-05)
- **Kategorie:** Beibehaltung

## Kontext

Auftragsschritt 3 fragt, ob der Host auf das Modell wartet. `requestQaSummary` baut den Kontext auf (prepare (1)), legt einen Job an und kehrt mit `pending` zurück; die Inferenz läuft danach in `processJob` ([Dossier 6.2](../1C/1C-kontext-und-adapterpfad.md#62-requestqasummary-qasummaryqueuets-z-454540)). Der Autor hat die Beibehaltung am 2026-10-24 mit Test-Runtime entschieden ([Teil 2, Entscheidung 3](../evidenz/1C/2026-10-24-teil2.md#entscheidung-und-empfehlung-1c)); die Laborläufe prüfen sie auf dem echten Pfad (Fall L3a, [Labor-Design 5](../specs/2026-10-25-1c-labor-design.md#5-fälle)).

## Entscheidung

Die Entkopplung bleibt (`requestQaSummary`). Die Grenze aus Befund B1 bleibt bestehen: Der Host wartet auf einen vollständigen Kontextaufbau, nicht auf das Modell.

## Alternativen

- **Synchroner Aufruf** (Host wartet auf die Modellantwort): verworfen. Als Mutation „Job synchron statt `pump()`“ macht er T4.1 und E5 rot ([T4.1](../evidenz/1C/2026-10-24-tests.md#t41--host-wartet-nicht-auf-den-modellauftrag), [E5](../evidenz/1C/2026-10-24-teil2.md#e5--host-wartet-nicht)). Bei einer Inferenz von 98,8 s (PC) bis 163,4 s (Laptop) ([Kennzahlen](../evidenz/1C/2026-11-05-labor-pc.md#laufrechner-pc-gegen-laptop)) wäre der Host-Aufruf so lang blockiert.
- **Auch den Kontextaufbau aus dem Host-Aufruf lösen:** nicht untersucht. Heute bestimmt prepare (1) die Rückkehrzeit (lokal ≈ 70–90 ms, [Teil 2, Entscheidung 3](../evidenz/1C/2026-10-24-teil2.md#entscheidung-und-empfehlung-1c)), und ein `CONFLICT` beim Aufbau erreicht den Host direkt als Fehler der Mutation ([Dossier 8.2](../1C/1C-kontext-und-adapterpfad.md#82-was-eine-stimmenänderung-bewirkt)).

## Belege

- **Teil 2, M1 (Test-Runtime):** Median-Differenz der Rückkehrzeit zwischen D = 2000 ms und D = 0 = 0,0 ms (Primärlauf) bzw. −5,5 ms (Robustheitslauf), p95 aller Bedingungen unter 110 ms ([M1](../evidenz/1C/2026-10-24-teil2.md#m1--rückkehrzeit-von-qarequestsummary-n--20-je-bedingung)).
- **Labor, K_L3a** (Median und p95 von `requestMs` < 1000 ms, und die längste Rückkehr ist kürzer als der kürzeste Runtime-Austausch; [Labor-Design 5](../specs/2026-10-25-1c-labor-design.md#5-fälle)):
  - Laptop: `requestMs` Median 27,6 ms, p95 32,6 ms, max. 38,6 ms; kürzester Austausch 153,1 s ([L3 Laptop](../evidenz/1C/2026-11-05-labor.md#l3-zeiten-laptop)).
  - PC: `requestMs` Median 17,9 ms, p95 19,7 ms, max. 20,2 ms; kürzester Austausch 90,6 s ([L3 PC](../evidenz/1C/2026-11-05-labor-pc.md#l3-zeiten-pc)).
  - Auf beiden Rechnern erfüllt ([Entscheidungen Laptop](../evidenz/1C/2026-11-05-labor.md#entscheidungen-nach-design-abschnitt-6), [Entscheidungen PC](../evidenz/1C/2026-11-05-labor-pc.md#entscheidungen-nach-design-abschnitt-6-144-und-153)).
- _Aktualisiert 2026-11-10:_ Im Nachlauf auf `def56700` bestätigt (Laptop, gleiche Limits): `requestMs` Median 29,4 ms, p95 34,2 ms, max. 50,7 ms; kürzester Austausch 195,6 s; K_L3a erfüllt, Entscheidung „Beibehaltung der Entkopplung“ ([Nachlauf, N3](../evidenz/1C/2026-11-09-labor-nachlauf.md#n3-zeiten), [Entscheidungen](../evidenz/1C/2026-11-09-labor-nachlauf.md#entscheidungen-nach-design-abschnitt-5)).

## Folgen

- **Kosten:** unverändert; der Host trägt einen Kontextaufbau im Aufruf (Befund B1, [Dossier 14](../1C/1C-kontext-und-adapterpfad.md#14-befundliste-kurzfassung-für-handout)).
- **Risiko:** keines neu. **Rückweg:** entfällt.
- **Gültigkeitsgrenze:** M1 und die Laborläufe rufen über `createCaller` auf, ohne HTTP-Transport und tRPC-Serialisierung ([Labor-Design 7](../specs/2026-10-25-1c-labor-design.md#7-gültigkeitsgrenzen)). Nicht gemessen unter realer Last. Die Rückkehrzeiten von Laptop und PC sind nicht nur durch die Hardware verschieden: Der Testprozess lief am PC unter Node 26 statt 24 ([PC, Abweichung 2](../evidenz/1C/2026-11-05-labor-pc.md#abweichungen-vom-ablauf)).
