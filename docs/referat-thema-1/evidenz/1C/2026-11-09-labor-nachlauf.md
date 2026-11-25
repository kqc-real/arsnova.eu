# Protokoll: 1C Nachlauf auf dem aktuellen upstream-Stand (N1–N6)

- **Datum:** 2026-11-09, Lauf 14:41–16:42 (MEZ)
- **Autor:** Jonas Weirauch (Rolle Y)
- **Design:** [`2026-11-06-1c-nachlauf-design.md`](../../specs/2026-11-06-1c-nachlauf-design.md), freigegeben am 2026-11-09, mit Nachtrag 7 (Codestand `def56700`) vor dem Lauf; Fälle, Kriterien und Regeln vorab festgelegt
- **Rohdaten:** [`messung/2026-11-09-labor-nachlauf.json.gz`](messung/2026-11-09-labor-nachlauf.json.gz), unkomprimiert 760 482 Byte, SHA-256 `01a8f917c7114aad9cec467e371105575cb67e0b1e1dc64d8a4070914610b13c`; Speicherprotokoll [`messung/2026-11-09-speicher-nachlauf.csv`](messung/2026-11-09-speicher-nachlauf.csv) (alle 15 s, `podman stats`)
- **Auswertung:** `node docs/referat-thema-1/evidenz/1C/messung/auswertung.mjs docs/referat-thema-1/evidenz/1C/messung/2026-11-09-labor-nachlauf.json.gz`
- **Vergleich:** [Laptop-Lauf vom 2026-11-05](2026-11-05-labor.md), gleicher Rechner, gleiche Limits, Codestand `9f230abc`

Alle Daten sind synthetisch (Referenzfixture aus #456 Abschnitt 12). Das Runtime-Token war ein Wegwerfwert, nur im Speicher des Laufprozesses; laut Skript steht es in JSON und Log 0-mal, `Bearer` 0-mal im JSON.

## Ergebnis in einem Satz

Vorschau = Nutzlast, Token-Schätzung, Entkopplung und Befund T3.1 gelten auch auf upstream `def56700`; aber **keine einzige echte Modellantwort besteht das neue Quality-Gate** (0 von 20 `full-context`, alle 28 aufgezeichneten Antworten verworfen), die Inferenz dauert im Median 224 s statt 163 s, und die Runtime wird wieder am Speicherlimit per OOM beendet, diesmal schon im 19. Auftrag.

## Umgebung

| Angabe           | Wert                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rechner          | Laptop, ThinkPad P50 (Hardware wie im [Laptop-Protokoll](2026-11-05-labor.md#laufrechner-laptop)), am Netzteil (vom Skript geprüft)                                                                                  |
| Energieprofil    | `performance`, `intel_pstate` mit Governor `powersave` und EPP `performance`; Ruhezustand per `systemd-inhibit` gesperrt                                                                                             |
| Commit           | `f746ffba17bb1097b76e6639ec16acdbfccbd678`, sauber; Referenzstand `main@def56700` (0 Commits hinter upstream)                                                                                                        |
| Code der Messung | Instruktion `qa-summary-technical-handoff-v5`, Definitionen `moderation-prompt-definitions-v1`, Quality-Gate `hasAcceptableQaSummaryQuality` ([ADR 1C-025](../../adr/1C-025-codestand-auf-upstream-aktualisiert.md)) |
| Node             | v24.18.0                                                                                                                                                                                                             |
| PostgreSQL       | 16.15 (Wegwerf-Container `labor-1c-pg`)                                                                                                                                                                              |
| Redis            | 7.4.11 (Wegwerf-Container `labor-1c-redis`)                                                                                                                                                                          |
| Runtime          | Compose-Profil `llm-http`, rootless Podman, `127.0.0.1:8080`, 4 CPUs, 5 GiB, 4 Threads, ohne `memswap_limit` (Swap = Limit)                                                                                          |
| Image            | lokal gebaut, Image-ID `sha256:b05815545d2b8f38de537fdee32dd4279fd0817ebbb1c0215b5336ad3b5f0905`, dieselbe wie am 2026-11-05                                                                                         |
| Build, Modell    | `build_info` `b10524-9ee9fc04c`, `n_ctx` 8192, 1 Slot, Template-SHA `c979e0e7…798e18`; GGUF-SHA `3605803b…c67e597` stimmt mit dem Pin überein; `/props` vor und nach dem Lauf gleich                                 |
| Einstellungen    | n = 20, 1 Aufwärmlauf, 5 direkte Läufe, L5 5 je Arm; Timeout 300 000 ms (wie am 2026-11-05, keine neue Kalibrierung, Design 3)                                                                                       |
| Start            | von Hand nach Freigabe, wartend bis Last < 2,0: Start 14:41:25 bei Last `1.78 3.29 4.11`; Ende 16:42:33 bei Last `6.32 7.50 7.65`                                                                                    |
| Nebenlast        | Siehe Abschnitt „Abweichungen“, Punkt 2: andere Claude-Code-Sitzung bis etwa 15:44 aktiv, Zoom-Web-App ab 15:00; untätig mitlaufend `arsnova-1c-pg`, `arsnova-1c-redis` und drei Container eines anderen Projekts    |

## Ergebnisse je Fall

Werte aus `auswertung.mjs`; Messläufe ohne Aufwärmlauf. Zur Zählung: Messlauf 18 brach durch den OOM-Kill ab, Messläufe 19 und 20 fanden die Runtime nicht erreichbar (Abschnitt „Abweichungen“, Punkt 1).

### N1 Vorschau = Nutzlast

In allen **18** Messläufen mit Completion-Aufruf 0 Abweichungen in allen elf Prüfungen (Hash Vorschau = gesendet = gespeichert, `messages[2]` = Vorschau, Rollen, Instruktion v5 und Definitionen, `max_tokens` = 640, oberste Schlüssel, weitergeleitete Bytes, Token). Die Messläufe 19 und 20 hatten keinen Completion-Aufruf (`ECONNREFUSED` beim Slot-Test, Runtime im Neustart); dort schlagen die sieben Prüfungen fehl, die einen Completion-Body brauchen; die vier übrigen (zwei Hash-Gleichheiten, weitergeleitete Bytes, Token) nicht. **K_L1 formal nicht erfüllt** („in jedem Messlauf“), Ursache ist der OOM-Kill, nicht der Kontextpfad. Wo ein Body gesendet wurde, war er gleich der Vorschau.

### N2 Tokens

n = 17 (Läufe mit `usage`). q = `prompt_tokens` / `packedInputTokens`: Median **0,318** (95 %-KI 0,316–0,318), Spanne 0,312–0,319; 3,15 Byte je Token. `prompt_tokens` Median 2353 (max. 2361) bei 7406 geschätzten Tokens; Ausgabe Median 469, max. 570 von 640; Kopffreiheit max. 3001 von 8192. `prompt_tokens = prompt_n + cache_n` in 17 von 17, `cache_n` Median 188. `finish_reason` 17-mal `stop`. **K_L2 erfüllt.** L5: q Median 0,3363 (YESNO) und 0,3345 (TEMPO), ebenfalls ≤ 1. Gegen den 2026-11-05 (q 0,320) unverändert: Die Schätzung verschenkt weiter rund zwei Drittel des Fensters ([ADR 1C-014](../../adr/1C-014-byte-schaetzung-kontextbudget-pruefen.md)).

### N3 Zeiten

**(a) Host wartet nicht.** `requestMs` Median 29,4 ms, max. 50,7 ms; kürzester Runtime-Austausch 195,6 s. **K_L3a erfüllt.** Anteil s = prepare (3) / `totalMs` = 0,03 % (< 5 %).

**(b) Inferenzzeit gegen den 2026-11-05** (gleicher Rechner, gleiche Limits; Median, am 2026-11-09 mit 95 %-Bootstrap-Intervall; n = 19 bzw. 17 Läufe mit Antwort):

| Größe                                 | 2026-11-05 (`9f230abc`)   | 2026-11-09 (`def56700`)                  |
| ------------------------------------- | ------------------------- | ---------------------------------------- |
| Inferenz (`prompt_ms + predicted_ms`) | 163,4 s                   | **223,7 s** (209,6–248,3)                |
| davon Prefill / Ausgabe               | 76,2 / 86,6 s             | 94,6 (87,2–98,0) / 129,1 (121,5–143,9) s |
| `totalMs`                             | 165,7 s, p95 177,1 s      | 221,6 s, p95 252,9 s                     |
| `prompt_n` / `predicted_n`            | 2060 / 383                | 2165 / 469                               |
| Prefill-Durchsatz (je Lauf)           | 27,3 Tokens/s (24,8–28,3) | 22,8 Tokens/s (18,8–26,5)                |
| Ausgabe-Durchsatz (je Lauf)           | 4,45 Tokens/s (4,32–4,57) | 3,63 Tokens/s (3,18–4,12)                |

Die Inferenz dauert im Median 37 % länger. **Zwei Ursachen, nicht sauber trennbar:**

1. **Mehr Tokens (Code):** 22 % mehr Ausgabe (469 statt 383), passend zur Erwartung im Design (v5 verlangt 2–4 Aussagen), und 5 % mehr Prompt. Rechnung, keine Messung: mit dem Durchsatz vom 2026-11-05 ergäben diese Tokenzahlen 2165 / 27,3 + 469 / 4,45 ≈ 185 s.
2. **Geringerer Durchsatz je Token (Rechnerzustand):** −17 % Prefill, −18 % Ausgabe. Das hängt nicht am Code. Kandidaten sind die Nebenlast und der Speicherdruck am Limit ab etwa 15:00 (N6); geprüft ist keiner davon.

Nach Phasen (Startzeit je Messlauf aus den Laufzeiten aufsummiert, auf etwa eine Minute genau):

| Phase                                                     | Messläufe | Inferenz (Median) | Ausgabe-Durchsatz      |
| --------------------------------------------------------- | --------- | ----------------- | ---------------------- |
| 14:46–15:00, zweite Claude-Sitzung aktiv, Speicher wächst | 1–4       | 204 s             | 3,74–4,12 Tokens/s     |
| 15:00–15:44, dazu Zoom, Speicher am Limit                 | 5–15      | 247 s             | 3,18–3,85 Tokens/s     |
| 15:44–15:51, nur Zoom, Speicher am Limit                  | 16–17     | 196 und 210 s     | 3,74 und 3,77 Tokens/s |

Auch in der ruhigsten Phase liegt die Inferenz über dem 2026-11-05 und der Durchsatz darunter. **Für die Entscheidung N3b reicht das:** Jede einzelne Inferenz lag über 195 s, also weit über 90 s.

### N4 Endstatus

| Endstatus (gespeichert = Host-Sicht) | Anzahl | Prüfstufe der Antwort          |
| ------------------------------------ | ------ | ------------------------------ |
| `ready/extractive/invalid_response`  | 17     | `ok` (Antwort angekommen)      |
| `ready/extractive/unavailable`       | 3      | `no_response` 1, ohne Aufruf 2 |

k(`source_changed`) = 0 von 20 (Wilson 0–16,1 %). **Anteil `full-context` 0 von 20 (Wilson 0–16,1 %).** Kein `timeout`. Häufigster Grund: `invalid_response`. Die `unavailable` sind die drei OOM-Läufe.

**Qualitative Einordnung der verworfenen Antworten** (Design 5, Regel N4): Alle 28 aufgezeichneten Modellantworten (Aufwärmlauf, 17 Messläufe, 10 L5-Läufe; die direkten Läufe laufen ohne Proxy und sind nicht aufgezeichnet) wurden nachträglich mit der echten Funktion `hasAcceptableQaSummaryQuality` (Locale `de`, Stand `def56700`) geprüft: **0 von 28 bestehen.** Jede Antwort ist gültiges JSON mit `finish_reason` `stop`. Auch die Prüfungen des Clients davor (`parseCompletion` in `openWeightLlmClient.ts`: Ausgabeschema `OpenWeightLlmOutputSchema`, Task-Typ, erlaubte Quellen-IDs per `hasOnlyAllowedQaSummaryV2References`) bestehen alle 28, nachgerechnet mit denselben Funktionen gegen die gesendeten Quellen; im Lauf-Log steht kein `qa_summary:invalid_model_response`. `invalid_response` kommt also in jedem Fall vom Gate im Adapter (`qaSummaryRuntimeAdapter.ts` Z. 133, Grund `invalid_response` bei `completed`). Zwei Muster:

- **Ruhige Läufe (18 von 18):** Status der Modellausgabe `uncertain`, je 4 Aussagen, **keine einzige der 72 Aussagen hat einen Doppelpunkt**, also keine Form „Lead: Text“. Alle auf Englisch, obwohl `context.locale` `de` ist. In jeder Antwort sprechen 2–4 Aussagen (Sprache und Themen per Stichwortsuche bestimmt, Stichproben gelesen) über das, was v5 ausdrücklich verbietet: Moderationsstatus, angeheftete Fragen, ausgelassene Fragen, Packing, die abgeschaltete Themenklassifikation. Beispiel (Messlauf 1): „Pending moderation state detected for multiple Q&A questions requiring host review.“
- **L5 (10 von 10):** Status der Modellausgabe `ready`. In 5 Antworten beginnen **alle vier Aussagen mit dem wörtlichen Platzhalter aus der Instruktion**, „Specific topic: …“ (v5: „Write 2 to 4 concise statements exactly as "Specific topic: Complete sentence."“); vier gleiche Leads verletzen die Regel „verschiedene Leads“. Die anderen 5 Antworten haben gar keinen Lead. Sprache gemischt, teils Deutsch, teils Englisch, teils beides.

Das ausgelieferte Modell (Qwen3-4B-Instruct-2507, Q4_K_M) folgt der Formatvorgabe von v5 in dieser Fixture also nicht; das Gate verwirft dann zu Recht nach seinen Regeln. Upstream nimmt die Prompt-Qualität ausdrücklich aus („Prompt quality and didactic efficacy are deliberately not claimed by issue #456“, Kommentar über `QA_SUMMARY_TECHNICAL_INSTRUCTION_TEXT` in `moderationSummaryContext.ts`).

### N5 T3.1 auf dem echten Pfad

| Arm   | Endstatus                           | Anzahl  |
| ----- | ----------------------------------- | ------- |
| YESNO | `ready/extractive/source_changed`   | 5 von 5 |
| TEMPO | `ready/extractive/invalid_response` | 5 von 5 |

**K_L5 erfüllt** (k(YESNO) = 5 = n, k(TEMPO) = 0). Alle 10 Läufe hatten eine Modellantwort. Im YESNO-Arm ist der Blitzlicht-Bereich **aus Budgetgründen gekürzt** (`feedback`, 1 Eintrag, `token-budget`) und trotzdem endet jeder Auftrag `source_changed`. Der Befund aus dem [Trockenlauf](2026-11-06-trockenlauf-upstream.md#befund-t31-auch-für-einen-nicht-gesendeten-bereich) gilt damit auf dem echten Pfad: Der Hash verwirft eine Antwort wegen einer Quelle, die das Modell nie gesehen hat. Der TEMPO-Arm endet ohne `source_changed`, aber am Gate (N4).

### N6 Speicher

| Zeitpunkt (Beginn des Auftrags) | Speicher der Runtime   | Δ zum vorigen |
| ------------------------------- | ---------------------- | ------------- |
| 14:42 Aufwärmlauf               | 3,059 GB               | –             |
| 14:46 Messlauf 1                | 3,594 GB               | 0,535 GB      |
| 14:50 Messlauf 2                | 4,017 GB               | 0,423 GB      |
| 14:53 Messlauf 3                | 4,436 GB               | 0,419 GB      |
| 14:57 Messlauf 4                | 4,846 GB               | 0,410 GB      |
| 15:00 Messlauf 5                | 5,262 GB               | 0,416 GB      |
| 15:04 bis 15:51                 | 5,27–5,37 GB, am Limit | –             |

Median Δ je Auftrag **0,419 GB** (Aufwärmlauf bis Messlauf 5), gegen 0,381 GB in U1 ([PC-Protokoll](2026-11-05-labor-pc.md#ursachenversuch-u1-design-15)). Ab 15:00 bleibt der angezeigte Wert am 5-GiB-Limit. Weiteres Wachstum, etwa in den Swap des Containers (ohne `memswap_limit` gleich dem Limit), zeigt das Protokoll nicht; dass der Kill erst 50 Minuten später kam, passt dazu, ist aber nicht gemessen. **OOM-Kill um 15:51:45** (Kernel: `memory: usage 5242880kB, limit 5242880kB, failcnt 18090`, `anon-rss` 5,18 GB), während Messlauf 18, also im **19. Auftrag** mit Aufwärmlauf. Ein Neustart, `OOMKilled=true`. Am 2026-11-05 kam der Kill im 21. Auftrag; Näherung: 3,06 GB + 18 × 0,42 GB ≈ 10,6 GB, und 5 + 5 GiB sind 10,74 GB.

## Abweichungen vom Ablauf

**1. OOM-Kill der Runtime** (N6). Folgen, alle vom Produkt korrekt mit Fallback beantwortet:

- **Messlauf 18:** Completion weitergeleitet, Abbruch `socket hang up` → `ready/extractive/unavailable` (`no_response`). Zählt in N1 und N4, fehlt in N2 und N3b.
- **Messläufe 19 und 20:** Slot-Test `ECONNREFUSED`, kein Completion-Aufruf → `unavailable`.
- **Kontrolle ohne Proxy (5 Läufe):** Lauf 1 `unavailable`, Läufe 2 und 3 `busy` (vermutlich Runtime kurz nach dem Neustart noch nicht bereit), Läufe 4 und 5 mit Antwort nach 238 und 220 s, beide `invalid_response`. **Diese Kontrolle ist wie am 2026-11-05 nicht auswertbar** (n = 2 mit Antwort); der Unterschied quiet − direkt hat keine Aussage.
- L5 lief danach vollständig mit 10 Modellantworten.

**2. Nebenlast.** Der Lauf startete nach der Lastregel (< 2,0). Laut Autor lief eine andere Claude-Code-Sitzung (Recherche im Hintergrund) bis etwa 15:44 aktiv und danach untätig; ab 15:00 lief die Zoom-Web-App (Chromium, bei zwei Stichproben gegen 15:32 und 15:40 zusammen etwa 0,4–0,5 Kerne, `llama-server` 3,8–3,9 Kerne). Die Lastregel aus Design 3 („andere Last nur gering“) war damit nur teilweise eingehalten. Betroffen sind nur Zeiten (N3b); Inhalt der Antworten, Speicher des Containers und Hashes hängen nicht an der Nebenlast. Die Zeiten sind deshalb nach Phasen berichtet (N3).

**3. Dateiname der Rohdaten** wie im Design-Nachtrag 7 angekündigt (`2026-11-09-labor-nachlauf.json`).

## Entscheidungen nach Design Abschnitt 5

| Ergebnis                                                                  | Entscheidung                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1: in allen 18 Läufen mit Aufruf erfüllt, 2 Läufe ohne Aufruf (OOM)      | **Beibehaltung** von Vorschau und Packing auch auf `def56700` ([ADR 1C-013](../../adr/1C-013-vorschau-gleich-nutzlast-beibehalten.md)); die Lücke ist dem OOM zuzuordnen, nicht dem Kontextpfad.                                                                                                                                               |
| N2 erfüllt, Median q 0,318                                                | Befund aus [ADR 1C-014](../../adr/1C-014-byte-schaetzung-kontextbudget-pruefen.md) gilt fort.                                                                                                                                                                                                                                                  |
| N3a erfüllt                                                               | **Beibehaltung** der Entkopplung ([ADR 1C-012](../../adr/1C-012-entkopplung-host-aufruf-beibehalten.md)).                                                                                                                                                                                                                                      |
| N3b: Median-Inferenz 223,7 s > 90 s                                       | [ADR 1C-023](../../adr/1C-023-release-timeout-90-s-zu-kurz.md) gilt auf dem neuen Stand fort. Zusätzlich: Der Abstand zum Timeout von 300 s ist kleiner geworden (längste Inferenz 255 s).                                                                                                                                                     |
| N4: k(`source_changed`) = 0                                               | kein Befund „Hash ändert sich ohne Datenänderung“.                                                                                                                                                                                                                                                                                             |
| N4: Anteil `full-context` 0 % < 80 %, häufigster Grund `invalid_response` | **Befund: Das Quality-Gate verwirft die echten Antworten des ausgelieferten Modells.** Verbesserung prüfen, nicht umsetzen: Instruktion, Grammatik oder Gate abstimmen ([ADR 1C-018](../../adr/1C-018-quality-gate-verwirft-echte-antworten.md)). [ADR 1C-019](../../adr/1C-019-endstatus-echter-pfad-beibehalten.md) gilt nur für `9f230abc`. |
| N5 erfüllt                                                                | **Befund T3.1 auf dem echten Pfad auf upstream bestätigt**, auch für einen gekürzten Blitzlicht-Bereich ([ADR 1C-016](../../adr/1C-016-zeitabhaengiger-hash-blitzlicht.md)).                                                                                                                                                                   |
| N6: OOM-Kill, Δ 0,419 GB ≥ 0,2 GB                                         | [ADR 1C-024](../../adr/1C-024-prompt-cache-ram-begrenzen.md) gilt auf dem neuen Stand fort; Zahlen ergänzt.                                                                                                                                                                                                                                    |

## Gültigkeitsgrenzen

Wie [Design 6](../../specs/2026-11-06-1c-nachlauf-design.md#6-gültigkeitsgrenzen): ein Rechner, Laborlimits, Timeout 300 s, lokal gebautes Image, synthetische Daten, n = 20 bzw. 5. Zusätzlich aus diesem Lauf:

- **Nebenlast** (Abweichung 2); der Zeitvergleich mit dem 2026-11-05 ist deshalb nur grob, die Aufteilung in Tokenzahl und Durchsatz eine Rechnung.
- **N4 gilt für eine Fixture** (Referenzfixture #456, sechs Fragen, `de`) und ein Modell. Ob das Modell bei anderen Daten die Form „Lead: Text“ trifft, zeigt der Lauf nicht. Ebenso wenig, ob die Inhalte der verworfenen Antworten brauchbar wären: Das Gate entscheidet nach Form, nicht nach Qualität, und dieses Protokoll urteilt nicht über Qualität.
- Die Kontrolle ohne Proxy fehlt wieder (Abweichung 1); die Runtime lief nicht als ein unterbrechungsfreier Prozess.

## KI-Nutzung

Claude Code (Anthropic, Modell Claude Opus 5.5) hat den Lauf gestartet und überwacht, die Rohdaten ausgewertet, die verworfenen Antworten mit den Prüffunktionen von Client und Gate nachgeprüft (Hilfsskripte, nicht eingecheckt; Code-Stellen mit codebase-memory und Serena belegt), Kernel-Log und Speicherprotokoll gelesen und dieses Protokoll geschrieben. Der Autor hat Design, Codestand und Start freigegeben und die Angaben zur Nebenlast gemacht; die Entscheidungen folgen den vor dem Lauf freigegebenen Regeln.
