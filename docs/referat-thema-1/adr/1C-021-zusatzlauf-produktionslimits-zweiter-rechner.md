# 1C-021: Zusatzlauf mit Produktionslimits auf einem zweiten Rechner

- **Status:** methodisch (2026-11-05)
- **Kategorie:** Methodik

## Kontext

Der Laptop-Lauf weicht an zwei Stellen von der ausgelieferten Konfiguration ab. Der Timeout war 300 s statt 90 s (ADR [1C-020](1C-020-timeout-300-s-und-kalibrierungsregel.md)). Die Runtime lief mit den Limits des Laborpfads (4 CPUs, 5 GiB, 4 Threads) statt mit denen des Inferenz-Hosts (8 CPUs, 8 GiB, 10 GiB mit Swap, 8 Threads). Außerdem beendete ein OOM-Kill die Runtime am 5-GiB-Limit ([Labor-Design 14.1](../specs/2026-10-25-1c-labor-design.md#141-zweck), [Laptop-Protokoll, Abweichung 1](../evidenz/1C/2026-11-05-labor.md#abweichungen-vom-ablauf)). Offen war, ob die Befunde mit den Produktionslimits halten und ob der OOM-Kill an das Laborlimit gebunden ist. Auf den Produktionshost hatte 1C keinen Zugriff ([PC-Protokoll, Gültigkeitsgrenzen](../evidenz/1C/2026-11-05-labor-pc.md#gültigkeitsgrenzen)).

## Entscheidung

Es gibt einen gekennzeichneten Zusatzlauf auf dem Desktop-PC des Autors. Er ersetzt den Laptop-Lauf nicht. Die Runtime läuft dort mit den Ressourcen von `docker-compose.llm.yml` über [`labor-produktionslimits.override.yml`](../evidenz/1C/labor-produktionslimits.override.yml): `mem_limit: 8g`, `memswap_limit: 10g`, `cpus: '8.0'`, 8 Threads. Fixture, Fälle L1–L5, n und Regeln bleiben gleich. Neu ist Fall L6 (kein Neustart, kein OOM-Kill), dazu ein Speicherprotokoll im 15-s-Takt. Festgelegt und freigegeben wurde das am 2026-11-05 nach dem Laptop-Lauf und vor jeder Messung am PC ([Labor-Design 14](../specs/2026-10-25-1c-labor-design.md#14-nachtrag-zusatzlauf-mit-produktionslimits-und-release-timeout-vor-dem-lauf-festgelegt)).

## Alternativen

- **Volle Kapazität des PCs** (ohne Limits). Verworfen: Gemessen werden sollte die ausgelieferte Ressourcenkonfiguration, nicht die Hardware ([Labor-Design 14.2](../specs/2026-10-25-1c-labor-design.md#142-aufbau)).
- **Messung auf dem Produktionshost.** Nicht möglich: Versuche laufen nur in der Laborinstanz, nie gegen Produktion ([Rahmendokument](../rahmen/00-rahmen-und-pruefung.md#pflicht-nachweiskette-je-person)). Auf den Host gab es keinen Zugriff.
- **Kein Zusatzlauf.** Verworfen: Ohne ihn wäre offen geblieben, ob der OOM-Kill nur am Laborlimit liegt. Genau diese Frage hat L6 beantwortet, siehe ADR [1C-024](1C-024-prompt-cache-ram-begrenzen.md).

## Belege

- **Limits im Container geprüft:** `NanoCpus` 8 000 000 000, `Memory` 8 589 934 592, `MemorySwap` 10 737 418 240, `OPEN_WEIGHT_LLM_THREADS=8`, 0 Neustarts vor dem Lauf ([PC-Protokoll, Umgebung](../evidenz/1C/2026-11-05-labor-pc.md#umgebung)). Werkzeug: [`labor-lauf.sh`](../evidenz/1C/labor-lauf.sh), [Runbook 9](../evidenz/1C/labor-runbook.md#9-zusatzlauf-auf-einem-zweiten-rechner-mit-produktionslimits-design-14).
- **Rechner:** Laptop mit Intel Core i7-6820HQ (4 Kerne). PC mit Intel Core i7-8700 (6 Kerne / 12 Threads, 31 GiB RAM, GPU ungenutzt) ([Hardwarevergleich](../evidenz/1C/2026-11-05-labor-pc.md#laufrechner-pc-gegen-laptop)).
- **Ergebnis, kurz:**
  - L1, L2, L3a und L5 sind am PC reproduziert, L4 wieder mit 19 von 20 `full-context` ([PC-Protokoll, Ergebnis](../evidenz/1C/2026-11-05-labor-pc.md#ergebnis-in-einem-satz)). Die Entscheidungen stehen in [1C-010](1C-010-nachpruefung-nach-inferenz-beibehalten.md), [1C-012](1C-012-entkopplung-host-aufruf-beibehalten.md), [1C-013](1C-013-vorschau-gleich-nutzlast-beibehalten.md), [1C-014](1C-014-byte-schaetzung-kontextbudget-pruefen.md), [1C-016](1C-016-zeitabhaengiger-hash-blitzlicht.md) und [1C-019](1C-019-endstatus-echter-pfad-beibehalten.md).
  - K_L6 ist verfehlt, siehe [1C-024](1C-024-prompt-cache-ram-begrenzen.md).
- **Zeiten je Rechner:** Inferenz-Median 163,4 s auf dem Laptop und 98,8 s auf dem PC, also 1,65-mal schneller. Die Rohdaten-Auswertung meldet `medianInferenceMs` 163 379,7 und 98 802,3. Der Unterschied liegt nicht an der Hardware allein, weil auch die Limits verschieden waren ([Kennzahlen](../evidenz/1C/2026-11-05-labor-pc.md#laufrechner-pc-gegen-laptop)).

## Abweichungen des Zusatzlaufs

Alle stehen im [PC-Protokoll, Abweichungen](../evidenz/1C/2026-11-05-labor-pc.md#abweichungen-vom-ablauf). Sie betreffen die Laufumgebung, nicht den gemessenen Codestand (dazu ADR [1C-022](1C-022-codestand-eingefroren-9f230abc.md)).

- **Node 26 statt 24 im Testprozess (Abweichung 2).** Das JSON meldet v26.12.0, der Laptop-Lauf v24.18.0. `npx` fand unter `mise exec` die System-Node. Vitest und der Backend-Code liefen am PC also unter Node 26. L1, L2, L4, L5 und L6 hängen davon nicht ab. Die Node-seitigen Zeiten in L3 (`requestMs`, prepare) unterscheiden sich zwischen den Rechnern deshalb nicht nur durch die Hardware. Ein Neulauf war nicht nötig, weil die entscheidenden Werte von der Runtime kommen. Seit `26982440` erzwingt das Skript v24.18.0.
- **Runbook-Lücken (Abweichung 1):** `git switch --track` und `podman.socket` wurden von Hand ergänzt, seit `36218689` übernimmt das Skript den Socket.
- **Image lokal neu gebaut:** Die Image-ID ist eine andere als am Laptop. Basisimage-Digest, `build_info` und GGUF-SHA sind gleich ([Umgebung](../evidenz/1C/2026-11-05-labor-pc.md#umgebung)).
- **Gegenprobe ohne Proxy ungültig:** Wie am Laptop fiel sie in den OOM-Neustart ([L6](../evidenz/1C/2026-11-05-labor-pc.md#l6-speicher-mit-produktionslimits-design-144)).

## Folgen

- Gültigkeitsgrenzen nach [Labor-Design 14.5](../specs/2026-10-25-1c-labor-design.md#145-gültigkeitsgrenzen):
  - Der PC ist ein dritter Rechner, weder der Laptop noch der Inferenz-Host.
  - Die 8 Runtime-Threads liegen auf 6 physischen Kernen, 2 davon über SMT.
  - Laufprozess und Runtime teilen sich weiterhin einen Rechner.
  - L6 belegt das Speicherverhalten dieses Images mit diesen Limits, nicht das des Produktionshosts.
- Weil die Kalibrierung über 90 s lag, lief auch der Zusatzlauf mit 300 s (ADR [1C-020](1C-020-timeout-300-s-und-kalibrierungsregel.md)). Ein Release-Lauf auf Produktionslimits fehlt deshalb weiterhin.
- _Ergänzt 2026-11-12:_ Die Teststrategie, in der L1 bis L5 auf beiden Rechnern und L6 nur am PC laufen, beschreibt [1C-003](1C-003-teststrategie-modellfrei.md).
- Kosten: 53 min Lauf, dazu die Kalibrierung (14:37–14:40) und U1 (17:11–17:46) ([PC-Protokoll, Kopf](../evidenz/1C/2026-11-05-labor-pc.md)).
