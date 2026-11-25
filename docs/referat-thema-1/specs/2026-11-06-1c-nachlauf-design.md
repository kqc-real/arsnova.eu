# 1C Nachlauf auf dem aktuellen upstream-Stand: Design

- **Datum:** 2026-11-06
- **Autor:** Jonas Weirauch (Rolle Y)
- **Status:** freigegeben (2026-11-09), vor dem Lauf festgelegt
- **Bezug:** [Labor-Design](2026-10-25-1c-labor-design.md) (Fälle L1–L5, Regeln Abschnitt 6, Nachtrag 14), [Laptop-Lauf vom 2026-11-05](../evidenz/1C/2026-11-05-labor.md), [Trockenlauf vom 2026-11-06](../evidenz/1C/2026-11-06-trockenlauf-upstream.md), [ADR 1C-025](../adr/1C-025-codestand-auf-upstream-aktualisiert.md)

## 1. Anlass und Frage

Der Prüfer verlangte, Fork und Clone vor der Auswertung zu aktualisieren ([ADR 1C-001](../adr/1C-001-baseline-aktueller-main.md)). Beide Laborläufe maßen `main@9f230abc`; upstream `96b2e46e` (PR #643) änderte danach Instruktion (v2 → v5), Ausgabegrammatik (2–4 Aussagen), Auswahl beim Packen und führte ein Quality-Gate ein ([ADR 1C-022](../adr/1C-022-codestand-eingefroren-9f230abc.md)). Der Trockenlauf zeigte modellfrei, dass L1 und die Hash-Grenze halten und T3.1 besteht. Offen sind die Fragen, die ein Modell brauchen:

**Leitfrage des Nachlaufs:** Gelten die Laborbefunde L1–L5 auf dem aktuellen upstream-Stand mit echtem Modell, und was ändern Instruktion v5 und Quality-Gate an Endstatus, Inferenzzeit und Speicherwachstum?

## 2. Festlegungen des Autors (2026-11-06)

| Punkt     | Festlegung                                                                                                                                                                             | Grund                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Rechner   | Laptop (ThinkPad P50), derselbe wie am 2026-11-05                                                                                                                                      | Unterschiede zum Laptop-Lauf lassen sich dem Code zuordnen, nicht der Hardware |
| Limits    | wie der Laptop-Lauf: Laborpfad ohne Override (4 CPUs, 5 GiB, 4 Threads; ohne `memswap_limit`, also Swap = Limit)                                                                       | gleiche Bedingungen wie am 2026-11-05                                          |
| Cache     | `--cache-ram` auf dem Standardwert (nicht gesetzt)                                                                                                                                     | ausgelieferte Einstellung; vergleichbar mit L4 und L6                          |
| Codestand | `feature-1C-context-path` nach dem Merge von upstream `44c0a796` mit an das Quality-Gate angepasster Test-Runtime ([ADR 1C-025](../adr/1C-025-codestand-auf-upstream-aktualisiert.md)) | Prüferanweisung; ein reproduzierbarer, gepushter Stand                         |

## 3. Aufbau (KI-Vorschlag, mit diesem Design freigegeben)

- **Ablauf:** [`labor-lauf.sh`](../evidenz/1C/labor-lauf.sh) im Modus `lauf` mit `LABOR_TAG=nachlauf`, `LABOR_OVERRIDE=` (leer, Laborpfad) und `LABOR_TIMEOUT_MS=300000`. Laufzahlen wie am 2026-11-05 (Standardwerte der Harness: ein Aufwärmlauf, 20 Messläufe über den Proxy, Kontrolle ohne Proxy, L5 mit 5 Aufträgen je Arm). Image `arsnova-open-weight-llm:llama-b10524` und GGUF unverändert (Prüfsummen werden vom Skript protokolliert).
- **Timeout 300 s ohne neue Kalibrierung.** Auf diesem Rechner ist der Release-Timeout von 90 s bereits widerlegt (Median der Inferenz 163,4 s, [ADR 1C-023](../adr/1C-023-release-timeout-90-s-zu-kurz.md)); die Kalibrierung des Skripts sendet zudem den v2-Body des Laptop-Laufs und würde den neuen Stand nicht messen. Gleicher Timeout wie am 2026-11-05 hält L4 vergleichbar.
- **Speicherprotokoll** des Runtime-Containers alle 15 s (Skript), wie im PC-Lauf.
- **Rechnerzustand:** Energieprofil `performance`, Ruhezustand gesperrt (Skript). Andere Last nur gering (keine lokalen Builds, Tests oder Container); Systemlast (`uptime`) vor und nach dem Lauf wird protokolliert. Liegt die Last der letzten Minute beim Start über 2,0, wird gewartet.
- **Rohdaten:** `evidenz/1C/messung/2026-11-06-labornachlauf.json` (gzip beim Einchecken), Speicher-CSV nach `messung/`, Auswertung mit `auswertung.mjs`.

## 4. Fälle

Fälle, Messgrößen und Kriterien sind die des Labor-Designs (Abschnitt 5); N1–N5 entsprechen L1–L5 auf dem neuen Stand. Neu sind die Vergleiche mit dem Laptop-Lauf vom 2026-11-05 (gleicher Rechner, gleiche Limits).

| Nr. | Frage                                                       | H                                                                                                                                                                   | G                                                                                        | K                                                                                                                                                      |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| N1  | Vorschau = Nutzlast auf dem neuen Stand mit echter Runtime  | gilt wie L1 (Trockenlauf)                                                                                                                                           | wie L1                                                                                   | K_L1 in jedem Messlauf                                                                                                                                 |
| N2  | Byte-Schätzung gegen echte Prompt-Tokens                    | konservativ, max q ≤ 1; erwartet (keine Schwelle) Median q wieder etwa 0,3                                                                                          | q > 1 in einem Lauf                                                                      | K_L2                                                                                                                                                   |
| N3  | (a) Host wartet nicht; (b) Inferenzzeit gegen 2026-11-05    | (a) wie L3a. (b) Erwartet (keine Schwelle): Die Inferenz dauert länger als am 2026-11-05, weil v5 bis zu vier Aussagen erlaubt und mindestens zwei verlangt         | (a) wie L3a                                                                              | K_L3a. Berichtet: Median und Bootstrap-Intervall von `prompt_ms`, `predicted_ms`, `prompt_n`, `predicted_n` und Inferenzzeit, je gegen den Laptop-Lauf |
| N4  | Endstatus ohne Datenänderung, jetzt mit Quality-Gate        | kein `source_changed`; Anteil `full-context` ≥ 80 %                                                                                                                 | `source_changed` ohne Datenänderung, oder das Gate verwirft echte Modellantworten häufig | k(`source_changed`) = 0; Anteil `full-context` als Punktschätzung mit Intervall; Verteilung der Gründe, darunter `invalid_response`                    |
| N5  | Befund T3.1 auf dem echten Pfad, neuer Stand                | YESNO: jeder Auftrag `source_changed`; TEMPO: keiner                                                                                                                | wie L5                                                                                   | k(YESNO) = 5 und k(TEMPO) = 0; berichtet, ob der Blitzlicht-Bereich gepackt oder aus Budgetgründen gekürzt ist                                         |
| N6  | Speicherwachstum je Auftrag mit Standard-Cache, neuer Stand | Erwartet (keine Schwelle): Wachstum je Auftrag in der Größenordnung von U1 (0,38 GB), weil es an der Tokenzahl hängt; ein OOM-Kill gegen Ende des Laufs ist möglich | —                                                                                        | Berichtet: Median Δ je Auftrag aus dem Speicherprotokoll, Höchstwert, `OOMKilled`, Neustarts, Nummer des Auftrags bei einem Kill                       |

Mutationsproben entfallen wie im Labor-Design: Die angepassten E2E-Tests haben ihre Proben ([ADR 1C-025](../adr/1C-025-codestand-auf-upstream-aktualisiert.md#belege)).

## 5. Entscheidungsregeln

Es gelten die Regeln aus Labor-Design Abschnitt 6 für N1–N5 (statt L1–L5), einschließlich der Neubewertung von Entscheidung 1 über den Anteil s. Zusätzlich:

| Ergebnis                                                                 | Entscheidung                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N4: Anteil `full-context` < 80 % und häufigster Grund `invalid_response` | Befund: Das Quality-Gate verwirft echte Antworten des ausgelieferten Modells häufig. Verbesserung prüfen, nicht umsetzen: Instruktion, Grammatik oder Gate abstimmen; die verworfenen Antworten (rohe Bodys) qualitativ einordnen. |
| N4: Anteil `full-context` ≥ 80 %                                         | **Beibehaltung** von Endstatus- und Fallbackpfad auch mit Quality-Gate ([ADR 1C-019](../adr/1C-019-endstatus-echter-pfad-beibehalten.md) gilt fort).                                                                               |
| N3b: Median-Inferenzzeit über 90 s                                       | [ADR 1C-023](../adr/1C-023-release-timeout-90-s-zu-kurz.md) gilt auf dem neuen Stand fort (Befund aktualisieren, Empfehlung unverändert).                                                                                          |
| N6: OOM-Kill oder Wachstum je Auftrag ≥ 0,2 GB                           | [ADR 1C-024](../adr/1C-024-prompt-cache-ram-begrenzen.md) gilt auf dem neuen Stand fort; Zahlen aktualisieren.                                                                                                                     |
| N6: kein Kill und Wachstum je Auftrag < 0,2 GB                           | Befund: Auf dem neuen Stand verhält sich der Cache anders; ADR 1C-024 als „auf `9f230abc` gemessen, auf upstream nicht bestätigt“ kennzeichnen, Ursache nicht raten.                                                               |

## 6. Gültigkeitsgrenzen

Wie Labor-Design Abschnitt 7 und Laptop-Lauf: ein Rechner, Laborlimits statt Produktionslimits, Timeout 300 s, lokal gebautes Image, synthetische Daten, n = 20 bzw. 5. Ein Vergleich mit dem PC-Lauf (Produktionslimits) ist nicht Ziel dieses Laufs. Zeiten gelten nur für diesen Rechner und bei geringer Nebenlast.

## 7. Nachtrag (2026-11-09, nach der Freigabe, vor dem Lauf)

- **Codestand:** Der Autor hat entschieden, vor dem Lauf upstream `def56700` (35 Commits nach `44c0a796`) über den Fork-`main` in den Branch zu mergen, damit der Branch danach in den Fork-`main` übernommen werden kann. Gemessen wird der gemergte Stand; der Commit steht im Protokoll.
- **Kein Einfluss auf die Fälle:** Die 35 Commits ändern im Backend nur die Lernziel-Anweisung in `openWeightLlmClient.ts` (eigener Zweig; der Nachrichtenaufbau der Zusammenfassung V2 in `buildChatCompletionBody` ist unverändert) und die Leertexte in `qaSummaryExtractive.ts` für en, fr, es und it (nur bei leerer Auswahl, der deutsche Text bleibt). Instruktion v5, Grammatik, Quality-Gate, Packen, Hash und Queue sind unverändert. Fälle, Regeln und Vergleich mit dem 2026-11-05 gelten deshalb wie festgelegt.
- **Dateiname der Rohdaten:** Das Skript schreibt `messung/<Datum des Laufs>-labor-nachlauf.json` (Bindestrich vor der Kennung), nicht wie in Abschnitt 3 angegeben.

## 8. KI-Nutzung

Claude Code (Opus 5.5) hat dieses Design entworfen, einschließlich Fällen, Schwellen (80 %, 0,2 GB, Lastgrenze 2,0) und Erwartungen. Vom Autor stammen die Festlegungen in Abschnitt 2 (Rechner, Limits, Cache, Codestand) und die Entscheidung für den Nachlauf.
