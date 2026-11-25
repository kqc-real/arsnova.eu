# Issue-Entwurf: Prompt-Cache der Open-Weight-Runtime übersteigt `mem_limit` und führt zum OOM-Kill

> **Status:** _Aktualisiert 2026-11-09:_ angelegt als [#14](https://github.com/NiklasSkulll/arsnova.eu/issues/14) im Fork (Unter-Issue von #10; ursprünglich englisch, seit 2026-11-10 deutsch und überarbeitet, maßgeblich ist das Issue). Ursprünglich: Entwurf, nicht angelegt. Angelegt wird erst nach Freigabe durch den Autor; Ort (kqc-real oder Fork) entscheidet er. Grundlage: [L6](2026-11-05-labor-pc.md#l6-speicher-mit-produktionslimits-design-144) und [Ursachenversuch U1](2026-11-05-labor-pc.md#ursachenversuch-u1-design-15) im PC-Protokoll. Entworfen mit Claude Code (Modell Claude Opus 5.5).

**Vorgeschlagener Titel:** `Open-Weight-Runtime: Prompt-Cache im RAM (--cache-ram, Standard 8192 MiB) wächst über die Aufträge und führt am mem_limit zum OOM-Kill`

---

## Beobachtung

Im Laborlauf (Referat 1C, Image `arsnova-open-weight-llm:llama-b10524`, Qwen3-4B Q4_K_M, Limits wie `docker-compose.llm.yml`: 8 CPUs, `mem_limit: 8g`, `memswap_limit: 10g`, 8 Threads) wuchs der Speicher der Runtime stufenweise um etwa 0,41–0,43 GB je Auftrag und wurde nicht freigegeben. Beim 21. Auftrag (Aufwärmlauf mitgezählt) beendete der Kernel `llama-server` über die Memory-Cgroup (RAM und Swap beide voll), Podman startete den Container per Restart-Regel neu ([L6](2026-11-05-labor-pc.md#l6-speicher-mit-produktionslimits-design-144)). Der betroffene Auftrag lieferte `ready/extractive/unavailable`; Anfragen während des Neustarts ebenfalls.

Der Laptop-Lauf zeigt dasselbe mit anderen Limits: 5 GiB RAM und (Standard Swap = Limit) 5 GiB Swap, zusammen ebenfalls etwa 10 GiB, Kill ebenfalls im Messlauf 20, also beim 21. Auftrag ([Laptop-Protokoll, Abweichung 1](2026-11-05-labor.md#abweichungen-vom-ablauf); [Gegencheck im PC-Protokoll](2026-11-05-labor-pc.md#l6-speicher-mit-produktionslimits-design-144)). Der Zeitpunkt des Kills hängt nach diesen beiden Läufen an der Summe aus RAM und Swap und an der Zahl der Aufträge, nicht an der Hardware.

## Ursache (im Versuch U1 gestützt)

- `llama-server` im Image b10524 hält einen Prompt-Cache im Arbeitsspeicher: `--cache-ram`, Standard 8192 MiB (laut `llama-server --help` im Image, festgehalten in [Design §15.1](../../specs/2026-10-25-1c-labor-design.md#151-anlass-und-hypothese); im Versuch ist der Standard-Arm der Lauf ohne gesetzte Variable, siehe [U1](2026-11-05-labor-pc.md#ursachenversuch-u1-design-15)).
- [`docker/open-weight-llm/entrypoint.sh`](../../../../docker/open-weight-llm/entrypoint.sh) setzt den Wert nicht. Geprüft mit Grep: weder `--cache-ram` noch `LLAMA_ARG_CACHE_RAM` kommt in `docker/` oder in einer `docker-compose*.yml` vor.
- U1 (je 10 direkte Anfragen, frisch gestartete Runtime, Produktionslimits, [Rohdaten standard](messung/2026-11-05-cacheversuch-standard-pc.csv) und [Rohdaten aus](messung/2026-11-05-cacheversuch-aus-pc.csv)):
  - Standard: Median Δ Speicher je Auftrag 0,381 GB (Anfrage 2 bis 10), m₁₀ − m₁ = 3,438 GB.
  - Mit `LLAMA_ARG_CACHE_RAM=0`: Median Δ 0,000 GB, m₁₀ − m₁ = 0,011 GB; im Container geprüft.
  - Kriterium K_U1 ([Design §15.3](../../specs/2026-10-25-1c-labor-design.md#153-kriterium-und-regeln)): standard ≥ 0,25 GB, aus ≤ 0,05 GB und m₁₀ − m₁ ≤ 0,3 GB. Erfüllt; kein Arm hatte Neustart oder OOM-Kill.
- Größenordnung: Grundlast etwa 3,1 GB ([Speicherprotokoll](messung/2026-11-05-speicher-pc.csv): 3,064 GB zu Beginn) plus etwa 0,38 GB je Auftrag. Bei 10 GiB (10,74 GB) ergibt das 3,1 + 20 × 0,38 ≈ 10,7 GB, also den Kill beim 21. Auftrag. _Aktualisiert 2026-11-05:_ Das ist eine Näherung mit der U1-Rate; mit den in L6 gemessenen 0,41–0,43 GB ergäben sich etwa 11,3–11,7 GB ([ADR 1C-024](../../adr/1C-024-prompt-cache-ram-begrenzen.md#belege)). Der Standard-Cache von bis zu 8 GiB passt zusammen mit der Grundlast in keine der beiden Grenzen; Swap verschiebt den Kill nur ([Rechnung im Protokoll](2026-11-05-labor-pc.md#entscheidungen-nach-design-abschnitt-6-144-und-153)).
- Nebenbefund aus U1: `cache_n` ist in beiden Armen gleich (135–137 Tokens Präfix ab Anfrage 2), die Prefill-Zeit ebenfalls (Median 43 035 ms gegen 43 068 ms). Für diese Folge gleichartiger Aufträge brachte der RAM-Cache bei einem Slot keinen messbaren Vorteil im Prefill. _Aktualisiert 2026-11-05:_ Ausgabe im Arm aus in 10/10 Paaren langsamer (+3 % im Median, `predicted_ms` 55 317 gegen 53 730 ms bei gleichem `predicted_n`); wegen fester Reihenfolge nicht dem Cache zuzuordnen ([ADR 1C-024, Korrektur](../../adr/1C-024-prompt-cache-ram-begrenzen.md#korrektur-am-labor-design-153)).

## Vorbehalt: Swap auf dem Produktionshost

`memswap_limit: 10g` wirkt nur, wenn der Host selbst Swap hat. Beide Laborrechner hatten zram. **Ob der Produktionshost Swap hat, ist nicht bekannt** und war in 1C nicht prüfbar. Ohne Swap gilt effektiv 8 GiB (8,59 GB); der Kill käme nach der Hochrechnung 3,1 GB + n × 0,38 GB nach etwa 15 Aufträgen. Das ist eine Hochrechnung, keine Messung; im Lauf lag der RAM-Teil nach rund 15 Aufträgen am Limit ([Gültigkeitsgrenzen, Abschnitt Swap](2026-11-05-labor-pc.md#gültigkeitsgrenzen)).

## Ungeprüfte Vermutung zum Produktionsvorfall vom 12.10.2026

Am 12.10.2026 scheiterte ein Lernziellauf bei Batch 3 an einem Docker-OOM-Ereignis am damaligen 5-GiB-Limit; danach wurde auf 8 GiB RAM und 10 GiB RAM plus Swap erhöht ([Lernzielableitung](../../../features/learning-objective-derivation.md), [Slice-8-Abnahme](../../../implementation/ISSUE-456-SLICE-8-ABNAHME.md)). **Vermutung, nicht geprüft:** Auch dort könnte der Prompt-Cache beteiligt gewesen sein. Dagegen oder ohne Aussage spricht: Es war ein anderer Auftragstyp (`learning_objectives`), und der Lauf nach der Erhöhung zeigte nur `memory.peak` von rund 3,56 GiB bei zehn Entwürfen. 1C hat diesen Vorfall nicht reproduziert und kein Cache-Verhalten für diesen Auftragstyp gemessen.

## Vorschlag (zur Diskussion)

Keine Entscheidung vorweggenommen. Optionen:

1. `--cache-ram 0` im Entry-Point (bzw. `LLAMA_ARG_CACHE_RAM=0`). ~~U1 zeigt dafür keinen Nachteil bei Laufzeit und Präfix-Treffern der Q&A-Zusammenfassung~~ _Aktualisiert 2026-11-05:_ U1 zeigt dafür gleiche Präfix-Treffer und einen gleichen Prefill; Ausgabe im Arm aus in 10/10 Paaren langsamer (+3 % im Median, `predicted_ms` 55 317 gegen 53 730 ms bei gleichem `predicted_n`); wegen fester Reihenfolge nicht dem Cache zuzuordnen. Belegt ist das nur für diese Folge (ein Slot, n = 10, ein Rechner).
2. Ein Wert unter dem Limit, bei dem Grundlast plus Cache sicher unter `mem_limit` bleibt (mit Reserve für Swap-lose Hosts). Der Wert wäre zu begründen und zu messen.
3. Optional ein Test oder Smoke-Check, der den wirksamen Wert im Container prüft.

**Kosten:** gering (eine Zeile im Entry-Point, Dokumentation der Variable). **Risiko:** gering bei Option 1; andere Auftragstypen oder mehrere Slots wurden nicht gemessen. **Rückweg:** Revert.

## Belege

- Protokoll PC: [`2026-11-05-labor-pc.md`](2026-11-05-labor-pc.md), Abschnitte L6 und U1; Speicherverlauf [`messung/2026-11-05-speicher-pc.csv`](messung/2026-11-05-speicher-pc.csv).
- Protokoll Laptop: [`2026-11-05-labor.md`](2026-11-05-labor.md).
- Override des Arms „aus“: [`labor-cache-aus.override.yml`](labor-cache-aus.override.yml); Produktionslimits: [`labor-produktionslimits.override.yml`](labor-produktionslimits.override.yml).

## Gültigkeitsgrenze

Ein Desktop-Rechner und ein Laptop, kein Produktionshost; U1 mit n = 10 je Arm, ein Durchgang je Arm, feste Reihenfolge; synthetische Daten. Belegt ist das Speicherverhalten dieses Images mit diesen Limits und diesen Bodies, nicht das des Produktionshosts unter echter Last ([Design §15.4](../../specs/2026-10-25-1c-labor-design.md#154-gültigkeitsgrenzen)).

_Aktualisiert 2026-11-05:_ Gemessen ist `main@9f230abc`. Der spätere upstream-Stand `96b2e46e` lässt Entry-Point und Compose-Limits unverändert, ändert aber Instruktion (v5), Ausgabegrammatik und Auswahl beim Packen; das Wachstum je Auftrag hängt an der Tokenzahl und ist dorthin nicht übertragbar. Vor dem Anlegen gegen den dann aktuellen `main` prüfen ([ADR 1C-022](../../adr/1C-022-codestand-eingefroren-9f230abc.md#folgen)).
