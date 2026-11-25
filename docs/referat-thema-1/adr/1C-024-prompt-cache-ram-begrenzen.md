# 1C-024: Prompt-Cache `--cache-ram` begrenzen oder abschalten (L6, U1)

- **Status:** empfohlen (2026-11-05), nicht umgesetzt; Issue-Entwurf nicht angelegt, _aktualisiert 2026-11-09:_ Issue [#14](https://github.com/NiklasSkulll/arsnova.eu/issues/14) im Fork
- **Kategorie:** Konfiguration

## Kontext

Beide Laborläufe verloren den Auftrag, der in Messlauf 20 lief, durch einen OOM-Kill der Runtime ([Laptop, Abweichung 1](../evidenz/1C/2026-11-05-labor.md#abweichungen-vom-ablauf), [PC, L6](../evidenz/1C/2026-11-05-labor-pc.md#l6-speicher-mit-produktionslimits-design-144)). Am Laptop blieb die Ursache offen ([Laptop, Beobachtung](../evidenz/1C/2026-11-05-labor.md#entscheidungen-nach-design-abschnitt-6)). Das Basis-Image `ghcr.io/ggml-org/llama.cpp:server-b10524` (lokal gebaut als `llama-b10524`) hält standardmäßig einen Prompt-Cache im Arbeitsspeicher, `--cache-ram` mit 8192 MiB laut `llama-server --help` im Image ([Labor-Design 15.1](../specs/2026-10-25-1c-labor-design.md#151-anlass-und-hypothese)). Der Entry-Point [`docker/open-weight-llm/entrypoint.sh`](../../../docker/open-weight-llm/entrypoint.sh) setzt den Wert nicht. Geprüft am 2026-11-05 mit Grep: Weder `cache-ram` noch `CACHE_RAM` kommt in `docker/` oder einer `docker-compose*.yml` vor; am 2026-11-10 auf upstream `main` `d4cf97e4` unverändert. Die ausgelieferten Limits stehen in [`docker-compose.llm.yml`](../../../docker-compose.llm.yml) Z. 21–23: `mem_limit: 8g`, `memswap_limit: 10g`, `cpus: '8.0'`.

## Entscheidung

**Befund:** Der Prompt-Cache im RAM wächst um etwa 0,38 GB je Auftrag. Zusammen mit der Grundlast passt er in keine der ausgelieferten Grenzen und führt beim 21. Auftrag zum OOM-Kill.

**Empfehlung, nicht umgesetzt:** `--cache-ram` im Entry-Point so begrenzen, dass Grundlast plus Cache unter `mem_limit` bleibt, oder auf 0 setzen. Die Optionen mit Kosten, Risiko und Rückweg stehen im [Issue-Entwurf](../evidenz/1C/issue-cache-ram-entwurf.md#vorschlag-zur-diskussion). Angelegt wird das Issue nur mit Freigabe des Autors ([PC-Protokoll, Entscheidungen](../evidenz/1C/2026-11-05-labor-pc.md#entscheidungen-nach-design-abschnitt-6-144-und-153)). _Aktualisiert 2026-11-09:_ angelegt als [#14](https://github.com/NiklasSkulll/arsnova.eu/issues/14).

## Alternativen

- **Nur das Limit des Laborpfads anheben.** Diese Verbesserung hätte die Regel vorgesehen, wäre K_L6 erfüllt gewesen ([Labor-Design 14.4](../specs/2026-10-25-1c-labor-design.md#144-fälle-und-regeln)). Verworfen: Auch mit 8 GiB plus 2 GiB Swap kam der Kill.
- **`mem_limit` oder Swap des Inferenz-Hosts erhöhen.** Verworfen: Grundlast (etwa 3,1 GB) plus bis zu 8 GiB Cache übersteigt sowohl 8 GiB als auch 10 GiB. Swap verschiebt den Kill nur ([U1](../evidenz/1C/2026-11-05-labor-pc.md#ursachenversuch-u1-design-15)). Das Zweit-Host-Runbook sieht Swap ausdrücklich nicht als Ersatzkapazität für Inferenz vor ([Runbook 2.1](../../operations/OPEN-WEIGHT-LLM-SECOND-HOST-RUNBOOK.md#21-hardware-und-netz)).
- **Nichts ändern, auf die Restart-Regel vertrauen.** Verworfen: Der laufende Auftrag und die Anfragen während des Neustarts enden mit Fallback (`unavailable`, vereinzelt `busy`: PC einmal, Nachlauf zweimal; _korrigiert 2026-11-10_) ([PC, L6](../evidenz/1C/2026-11-05-labor-pc.md#l6-speicher-mit-produktionslimits-design-144)).

## Belege

- **L6 am PC:** K_L6 verfehlt, `OOMKilled=true`, ein Neustart. Der Speicher stieg stufenweise um etwa 0,41–0,43 GB je Auftrag, von 3,064 GB beim Start auf maximal 8,590 GB. RAM (8 GiB) und Swap (2 GiB) waren beim Kill beide voll ([L6](../evidenz/1C/2026-11-05-labor-pc.md#l6-speicher-mit-produktionslimits-design-144); Rohdaten [`2026-11-05-speicher-pc.csv`](../evidenz/1C/messung/2026-11-05-speicher-pc.csv)).
- **U1, zwei Arme** nach [Labor-Design 15.2](../specs/2026-10-25-1c-labor-design.md#152-aufbau): je 10 direkte Anfragen mit frisch gestarteter Runtime und Produktionslimits. Rohdaten: [standard](../evidenz/1C/messung/2026-11-05-cacheversuch-standard-pc.csv), [aus](../evidenz/1C/messung/2026-11-05-cacheversuch-aus-pc.csv).
  - **standard:** Median Δ 0,381 GB, m₁₀ − m₁ = 3,438 GB.
  - **aus** (`LLAMA_ARG_CACHE_RAM=0`, im Container geprüft): Median Δ 0,000 GB, m₁₀ − m₁ = 0,011 GB.
  - In keinem Arm gab es einen Neustart. K_U1 ist erfüllt ([U1](../evidenz/1C/2026-11-05-labor-pc.md#ursachenversuch-u1-design-15), Kriterium [15.3](../specs/2026-10-25-1c-labor-design.md#153-kriterium-und-regeln)).
- **Gegencheck Laptop:**
  - Am Laptop galten 5 GiB RAM und, ohne `memswap_limit`, der Standard Swap = Limit, also weitere 5 GiB. Zusammen sind das 10 GiB wie am PC, und beide waren beim Kill voll.
  - Beide Rechner wurden beim 21. Auftrag beendet, den Aufwärmlauf mitgezählt.
  - Näherung mit der Rate aus U1 (0,38 GB je Auftrag): 3,1 GB + 20 × 0,38 GB ≈ 10,7 GB, und 10 GiB sind 10,74 GB ([Gegencheck im PC-Protokoll](../evidenz/1C/2026-11-05-labor-pc.md#l6-speicher-mit-produktionslimits-design-144)). Mit den in L6 gemessenen 0,41–0,43 GB ergäben sich etwa 11,3–11,7 GB; die Übereinstimmung ist also nur ungefähr.

## Ursachenkette

1. **Beobachtung (Laptop):** OOM-Kill beim 21. Auftrag am 5-GiB-Limit. Ob der Speicher wächst, zeigt der Lauf nicht.
2. **Versuch 1 (L6, PC):** Mit Produktionslimits wächst der Speicher um etwa 0,41–0,43 GB je Auftrag und wird nicht freigegeben, Kill wieder beim 21. Auftrag. Der Kill liegt also nicht am Laborlimit.
3. **Hypothese H_U1:** Der Prompt-Cache im RAM treibt das Wachstum. Grobe Rechnung: rund 144 KiB KV-Cache je Token, also gut 0,35 GB für einen Auftrag mit etwa 2600 Tokens ([15.1](../specs/2026-10-25-1c-labor-design.md#151-anlass-und-hypothese)).
4. **Versuch 2 (U1):** Arm standard mit 0,381 GB je Auftrag, Arm aus mit 0,000 GB. H_U1 ist gestützt.
5. **Gegencheck Laptop:** 5 + 5 GiB = 10 GiB wie am PC (8 + 2 GiB), Kill beim selben, dem 21. Auftrag. Das passt als Näherung zur U1-Rate von 0,38 GB je Auftrag. Der Zeitpunkt hängt an der Summe aus RAM und Swap und an der Zahl der Aufträge, nicht an der Hardware.
6. **Entscheidung:** `--cache-ram` begrenzen oder 0, empfohlen, nicht umgesetzt.

## Korrektur am Labor-Design 15.3

[Labor-Design 15.3](../specs/2026-10-25-1c-labor-design.md#153-kriterium-und-regeln) behauptet: „ohne Cache kann der gemeinsame Präfix nicht wiederverwendet werden“. **Gemessen ist das Gegenteil.** In beiden Armen ist `cache_n` ab Anfrage 2 gleich (135–137 Tokens System-Präfix), und die Prefill-Zeit ist gleich (Median 43 035 ms gegen 43 068 ms). Bei einem Slot hält dessen eigener KV-Zustand den Präfix. Fundstelle: „Beobachtung (keine Entscheidung)“ am Ende des [U1-Abschnitts im PC-Protokoll](../evidenz/1C/2026-11-05-labor-pc.md#ursachenversuch-u1-design-15). Das Design bleibt als vorregistriertes Dokument unverändert, die Korrektur steht nur hier und im Protokoll.

**Korrektur zum PC-Protokoll, Z. 206:** Dort steht, U1 zeige für `--cache-ram 0` keinen Nachteil bei der Laufzeit. Das decken die Rohdaten nicht. Prefill gleich; Ausgabe im Arm aus in 10/10 Paaren langsamer (+3 % im Median): `predicted_ms` 55 317 gegen 53 730 ms bei gleichem `predicted_n` je Paar ([standard](../evidenz/1C/messung/2026-11-05-cacheversuch-standard-pc.csv), [aus](../evidenz/1C/messung/2026-11-05-cacheversuch-aus-pc.csv), nachgerechnet am 2026-11-05). Wegen fester Reihenfolge (erst standard, dann aus) ist das nicht dem Cache zuzuordnen.

## Folgen

- **Kosten:** eine Zeile im Entry-Point plus Doku der Variable. **Risiko:** für Option 0 eine um 3 % langsamere Ausgabe im Arm aus, die wegen fester Reihenfolge nicht dem Cache zuzuordnen ist; andere Auftragstypen und mehrere Slots nicht gemessen. **Rückweg:** Revert ([Issue-Entwurf](../evidenz/1C/issue-cache-ram-entwurf.md#vorschlag-zur-diskussion)).
- **Betriebsfolge ohne Änderung:** Unter Dauerlast mit `qa_summary` ist alle rund 20 Aufträge ein Neustart mit Fallbacks zu erwarten. Das ist eine Hochrechnung aus zwei Läufen.
- **Gültigkeitsgrenzen:**
  - **Swap des Produktionshosts unbekannt.** `memswap_limit` wirkt nur, wenn der Host Swap hat. Ohne Swap gilt effektiv 8 GiB, und der Kill käme nach der Hochrechnung schon nach etwa 15 Aufträgen. Das ist nicht gemessen ([Vorbehalt im Issue-Entwurf](../evidenz/1C/issue-cache-ram-entwurf.md#vorbehalt-swap-auf-dem-produktionshost), [PC-Protokoll, Swap](../evidenz/1C/2026-11-05-labor-pc.md#gültigkeitsgrenzen)).
  - **Einzel-Slot:** Gemessen ist nur `--parallel 1` ([`entrypoint.sh`](../../../docker/open-weight-llm/entrypoint.sh) Z. 38). Mit mehreren Slots können sich Cache und Präfix anders verhalten.
  - **n = 10** je Arm, ein Durchgang je Arm, feste Reihenfolge, ein Rechner ([15.4](../specs/2026-10-25-1c-labor-design.md#154-gültigkeitsgrenzen)).
  - **CPU-Inferenz**, Image b10524, nur Auftragstyp `qa_summary` mit synthetischen Bodies.
  - **Modell Qwen3-4B Q4_K_M.** Die Größe je Token hängt am KV-Cache dieses Modells.
  - Am Laptop ist das Wachstum nicht gemessen, nur Grenzen und Kill-Zeitpunkt. Der Gegencheck ist ein Indiz, kein zweiter Versuch.
- _Ergänzt 2026-11-12:_ Den einen Ausfall durch den OOM-Kill im Endstatus der Läufe vom 2026-11-05 ordnet [1C-019](1C-019-endstatus-echter-pfad-beibehalten.md) ein.
- Ob der Produktions-OOM vom 12.10.2026 dieselbe Ursache hatte, ist eine ungeprüfte Vermutung im [Issue-Entwurf](../evidenz/1C/issue-cache-ram-entwurf.md#ungeprüfte-vermutung-zum-produktionsvorfall-vom-12102026).
- **Stand `96b2e46e`:** Entry-Point und Compose-Limits unverändert. Das gemessene Wachstum je Auftrag hängt an der Tokenzahl und ist auf Instruktion v5 und die neue Auswahl beim Packen (`12f1d8e4`/`a998ada0`, gemergt mit `96b2e46e`, PR #643) nicht übertragbar (ADR [1C-022](1C-022-codestand-eingefroren-9f230abc.md)).
- _Aktualisiert 2026-11-09:_ Auf `def56700` am Laptop **gemessen**, nicht nur Grenzen und Kill-Zeitpunkt ([Nachlauf, N6](../evidenz/1C/2026-11-09-labor-nachlauf.md#n6-speicher); Rohdaten [`2026-11-09-speicher-nachlauf.csv`](../evidenz/1C/messung/2026-11-09-speicher-nachlauf.csv)): Wachstum Median **0,419 GB je Auftrag** (0,410–0,535 GB in den ersten fünf), von 3,059 GB auf das 5-GiB-Limit nach fünf Aufträgen, danach am Limit (ob weiter in den Swap, zeigt das Protokoll nicht); **OOM-Kill im 19. Auftrag** (Kernel: `usage 5242880kB, limit 5242880kB`). Mehr Tokens je Auftrag als auf `9f230abc` (Prompt im Median 2353 statt 2196, Ausgabe 469 statt 383) und ein früherer Kill am selben Laptop (19. statt 21. Auftrag). Dass der Cache je Auftrag stärker wächst, ist nicht gemessen: Am Laptop fehlt der Wert für `9f230abc`, und am PC lag er dort mit 0,41–0,43 GB in derselben Größenordnung. _Korrigiert 2026-11-10._ Der Befund gilt fort; die Empfehlung ist unverändert.
