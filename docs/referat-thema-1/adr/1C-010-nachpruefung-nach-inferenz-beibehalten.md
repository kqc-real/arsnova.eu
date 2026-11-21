# 1C-010: Nachprüfung nach der Inferenz (prepare (3)) beibehalten

- **Status:** angenommen (2026-11-05)
- **Kategorie:** Beibehaltung

## Kontext

Auftragsschritt 4 fragt nach der Snapshot- und Hashgrenze. `processJob` baut nach der Inferenz den Kontext ein drittes Mal auf (prepare (3)) und verwirft die Modellantwort als `source_changed`, wenn sich der `snapshotHash` gegenüber prepare (2) geändert hat ([Dossier 6.3](../1C/1C-kontext-und-adapterpfad.md#63-processjob-z-292402)). Zusätzlich prüft der Lesepfad `getQaSummaryRuntimeFresh` beim Abruf ([Dossier 6.5](../1C/1C-kontext-und-adapterpfad.md#65-re-validierung-vor-auslieferung-getqasummaryruntimefresh-z-418440)). Invariante: Ein ausgeliefertes `ready` entspricht dem Datenstand. Offen war, ob prepare (3) neben dem Lesepfad seine Kosten wert ist. Der Autor hat am 2026-10-24 nach der vorab festgelegten Regel entschieden ([Teil 2, Entscheidung 1](../evidenz/1C/2026-10-24-teil2.md#entscheidung-und-empfehlung-1c)).

## Entscheidung

prepare (3) bleibt (Funktion `processJob`). Die Entscheidung stützt sich vor allem auf das Risiko der Gegenvariante, die Kostenseite ist nachrangig; beide Laborläufe bestätigen sie auf der Kostenseite.

## Alternativen

- **Gegenvariante V1 „keine Nachprüfung“** ([Design Teil 2, Abschnitt 6](../specs/2026-10-24-1c-teil2-design.md#6-gegenvariante-v1-und-entscheidung)): prepare (3) liefert das Ergebnis von prepare (2) zurück und spart einen Kontextaufbau. Verworfen, weil dann eine von zwei unabhängig wirksamen Konsistenzprüfungen entfällt (E8, [Probe auf Job-Ebene](../evidenz/1C/2026-10-24-teil2.md#e8--quellenlöschung-zwischen-auftrag-und-ergebnis)), die Logzeile `qa_summary:completed` verworfene Ergebnisse als `ready`/`full-context` ausweisen würde und künftige Leser des Queue-Zustands ohne Neuaufbau den veralteten Stand sähen ([V1, Risiko (a)–(c)](../evidenz/1C/2026-10-24-teil2.md#v1--gegenvariante-ohne-nachprüfung-d--2000-ms-n--10-je-variante-und-szenario)).
- **Günstigere Nachprüfung** (nur Revisionen vergleichen statt vollem Aufbau): als Option für den Fall genannt, dass die Datenbank zum Engpass wird; nicht gemessen, nicht umgesetzt ([Teil 2, Entscheidung 1](../evidenz/1C/2026-10-24-teil2.md#entscheidung-und-empfehlung-1c)).

## Belege

- **Regel:** [Design Teil 2, Abschnitt 6](../specs/2026-10-24-1c-teil2-design.md#6-gegenvariante-v1-und-entscheidung) mit der Ergänzung aus [Abschnitt 10](../specs/2026-10-24-1c-teil2-design.md#10-präzisierung-vor-der-messung-2026-10-24-vor-dem-ersten-m--und-v1-lauf); es greift Zeile 2 mit Ergänzung, weil V1 am Host kein veraltetes Ergebnis liefert, sekundär (Queue-Zustand) aber in 10 von 10 Änderungsläufen ([V1](../evidenz/1C/2026-10-24-teil2.md#v1--gegenvariante-ohne-nachprüfung-d--2000-ms-n--10-je-variante-und-szenario)).
- **Ersparnis von V1 mit Test-Runtime (D = 2000 ms):** 58,9 ms = 2,5 % (Primärlauf) bzw. 93,7 ms = 4,0 % (Robustheitslauf), Intervall-Obergrenze 5,1 %; 3 statt 4 Kontextaufbauten je Auftrag (−25 %) ([V1](../evidenz/1C/2026-10-24-teil2.md#v1--gegenvariante-ohne-nachprüfung-d--2000-ms-n--10-je-variante-und-szenario)). Rohdaten: [`2026-10-24-messung.json.gz`](../evidenz/1C/messung/2026-10-24-messung.json.gz) (Commit `2bb18411`), [`2026-10-24-messung-robustheit.json.gz`](../evidenz/1C/messung/2026-10-24-messung-robustheit.json.gz) (Commit `57a36b3d`).
- **Neubewertung im Labor** (Anteil s = Median prepare (3) / Median `totalMs`, Regel [Labor-Design 6](../specs/2026-10-25-1c-labor-design.md#6-entscheidungsregeln)):
  - Laptop: s = 0,03 % (95 %-KI 0,03–0,04 %) ([L3 Laptop](../evidenz/1C/2026-11-05-labor.md#l3-zeiten-laptop)).
  - PC: s = 0,04 % (95 %-KI 0,04–0,04 %) ([L3 PC](../evidenz/1C/2026-11-05-labor-pc.md#l3-zeiten-pc)).
  - Beide Obergrenzen < 5 % → Entscheidung 1 auf der Kostenseite bestätigt.
  - _Aktualisiert 2026-11-10:_ Nachlauf auf `def56700` (Laptop): s = 0,03 % (95 %-KI 0,03–0,03 %, `auswertung.mjs`) ([Nachlauf, N3](../evidenz/1C/2026-11-09-labor-nachlauf.md#n3-zeiten)). Die Regel gilt dort weiter ([Nachlauf-Design 5](../specs/2026-11-06-1c-nachlauf-design.md#5-entscheidungsregeln)); die Entscheidungstabelle des Nachlaufs führt 1C-010 aber nicht eigens auf.

## Ursachenkette

Beobachtung: Ein vierter Kontextaufbau je Auftrag kostet lokal einen warmen prepare (68–76 ms, [M3](../evidenz/1C/2026-10-24-teil2.md#m3--dauer-eines-preparefreshmoderationsummarycontext-n--20)) → Hypothese: Bei realer Inferenz ist die Ersparnis unwesentlich → Versuch: V1 mit D = 2000 ms, danach Neubewertung mit echter Inferenz auf zwei Rechnern → Ergebnis: Obergrenze von s 0,04 % < 5 % auf beiden Rechnern (Regel [Labor-Design 6](../specs/2026-10-25-1c-labor-design.md#6-entscheidungsregeln); [L3 Laptop](../evidenz/1C/2026-11-05-labor.md#l3-zeiten-laptop), [L3 PC](../evidenz/1C/2026-11-05-labor-pc.md#l3-zeiten-pc)) → Beibehaltung. Zusatz, nach Design 6 nur berichtet: Die in Teil 2 hergeleitete Schwelle von etwa 1,5–2,1 s Inferenz ([Gültigkeit der Entscheidung](../evidenz/1C/2026-10-24-teil2.md#entscheidung-und-empfehlung-1c)) liegt weit unter den gemessenen Medianen von 163,4 s (Laptop) und 98,8 s (PC) ([Kennzahlen](../evidenz/1C/2026-11-05-labor-pc.md#laufrechner-pc-gegen-laptop)).

## Folgen

- **Kosten:** unverändert; vier Kontextaufbauten je Auftrag mit erstem Abruf, je mehrere PostgreSQL-Lesezugriffe ([V1, Folgen](../evidenz/1C/2026-10-24-teil2.md#v1--gegenvariante-ohne-nachprüfung-d--2000-ms-n--10-je-variante-und-szenario)).
- **Risiko:** keines neu. **Rückweg:** entfällt, die Gegenvariante existiert nur im Test-Hook.
- **Gültigkeitsgrenze:** Kosten lokal mit Test-Runtime und einer Fixture ohne vollen #456-Kontext ([Gültigkeitsgrenzen der Messung](../evidenz/1C/2026-10-24-teil2.md#gültigkeitsgrenzen-der-messung)); Laborzeiten gelten nur für den jeweiligen Rechner, mit Timeout 300 s statt 90 s ([Laptop](../evidenz/1C/2026-11-05-labor.md#gültigkeitsgrenzen), [PC](../evidenz/1C/2026-11-05-labor-pc.md#gültigkeitsgrenzen)). Die DB-Last unter realer Hörsaallast ist nicht gemessen.
