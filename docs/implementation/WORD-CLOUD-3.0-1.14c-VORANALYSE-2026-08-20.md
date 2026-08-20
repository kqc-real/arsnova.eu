<!-- markdownlint-disable MD013 -->

# Voranalyse Story 1.14c (Word Cloud 3.0)

**Status:** Voranalyse / Architekturmeinung, **keine** Produktfreigabe

**Stand:** 2026-08-20, 15:20 Europe/Berlin

**Autor:** Lead-Architektur (Chat 2026-08-20)

**Gilt nicht statt:** [Backlog Story 1.14c](../../Backlog.md), [WORD-CLOUD-3.0-STORY-VORSCHLAG.md](WORD-CLOUD-3.0-STORY-VORSCHLAG.md), [ADR-0032](../architecture/decisions/0032-optional-nlp-cascade-for-qa-moderation-signals.md)

Diese Datei hält die am 20. August 2026 verdichteten Erkenntnisse fest: KI-Bestand der App, Zieltechnik 1.14c, Zusammenspiel mit der Kompass-Kurzfassung (8.9c), Modellwahl unter 8 vCPU / 16 GB, Vergleich zum Dev-Gemini, Open-Weight-Lage (inkl. chinesischer Labs) und ein konkretes Implementierungsvorgehen. Messwerte auf dem Hetzner-Zielhost und dem Q&A-Seed stehen noch aus.

---

## 1. Zeitstrahl der Erkenntnisse

| Zeit (Europe/Berlin) | Thema                     | Kern                                                                                                                                        |
| -------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-20 ~14:29    | KI-Bestand der App        | Produktion ohne LLM. Klassisches ML/NLP optional und default aus. Gemini nur im lokalen 8.9c-Helfer.                                        |
| 2026-08-20 ~14:36    | Technik/Architektur 1.14c | Kanonisch: Encoder + Clustering + optional LLM-Labels; eigener privater Inferenzserver; Host-Q&A first. Story offen.                        |
| 2026-08-20 ~14:42    | Benannte Modelle          | Kein RoBERTa im Repo. ADR-0032 nennt E5/GTE/BGE/Jina/mDeBERTa/SetFit. 1.14c nagelt kein Checkpoint fest.                                    |
| 2026-08-20 ~14:47    | Zielvorstellung 1.14c     | Semantik = Mitgliedschaft, nicht Chat. Stufe 1 ohne LLM mergen. Hash-k-NN (8.9b) ist kein Paraphrasen-Cluster.                              |
| 2026-08-20 ~14:52    | LLM auf 8 vCPU / 16 GB    | Kein LLM auf dem Live-Host. Lokal höchstens 3B–4B Q4, 2–4 Threads, ein Job. 7B/8B auf CPU ungeeignet.                                       |
| 2026-08-20 ~14:57    | vs. Gemini Dev-Helfer     | `gemini-3.5-flash-lite` bleibt Qualitäts-/Tempo-Referenz für 8.9c. 3B-CPU ersetzt den Auftrag unter 3–8 s nicht.                            |
| 2026-08-20 ~15:03    | Open Weight 2026          | Chinesische Labs führen die Flagschiffe (DeepSeek V4, Qwen3.x, Kimi, GLM). Auf 16 GB CPU zählt `Qwen3-4B-Instruct-2507`, nicht V4-Flash.    |
| 2026-08-20 ~15:20    | Zusammenspiel 8.9c        | Orthogonal zur Wortwolke: gleiche private Serverrolle, getrennte Verträge. Slice 4 folgt nach 1.14c-Stufe 1, nicht als deren Voraussetzung. |

Quellen im Repo: `docs/features/word-cloud-spacy.md`, `qa-nlp-moderation.md`, `qa-summary.md`, `docs/ENVIRONMENT.md`, `docs/capacity-estimate-16gb-16cores.md`, `scripts/qa-summary-dev-server.mjs`. Externe Lage 15:03: Hugging-Face-Karte [Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507), DeepSeek-V4-Flash Open Weights ~Juli 2026 (~160 GB).

---

## 2. Was die App heute an KI hat

Drei Kill-Switches, absichtlich getrennt. Live-Hotpaths (`qa.submit`, Join, Vote, WebSocket) warten nie auf Inferenz. Kein Sentence-Transformer, kein ONNX, kein scikit-learn im App-Prozess. Öffentliche SaaS-Hosts für `QA_SUMMARY_INFERENCE_URL` sind blockiert.

| Schicht                     | Story           | Typ                                            | Default                    |
| --------------------------- | --------------- | ---------------------------------------------- | -------------------------- |
| Wortwolke 2.5, Kompass 8.9a | 1.14a / 8.9a    | Regeln, DF, N-Gramme                           | an                         |
| Sprachformen glätten        | 1.14b           | spaCy `*_sm` (de/en/fr/es), Sidecar            | `NLP_ENABLED=false`        |
| Q&A-Kategorie               | 8.9b            | Naive Bayes + k-NN im Hash-n-Gramm-Raum        | `QA_NLP_ENABLED=false`     |
| Kompass-Kurzfassung         | 8.9c Slices 1–3 | Vertrag, extraktiv; Gemini nur Loopback-Helfer | `QA_SUMMARY_ENABLED=false` |
| KI-Quiz-Import              | 1.9a/1.9b       | Prompt + Zod, LLM **außerhalb** (ADR-0007)     | an, ohne Server-KI         |
| Semantische Themen          | **1.14c**       | Encoder + Cluster, optional LLM-Label          | **nicht gebaut**           |

RoBERTa / XLM-R kommen in Backlog, ADR-0032 und Word-Cloud-3.0 **nicht** vor. MiniLM/mBERT gelten im Praktikum als zu schwache Encoder-Baseline, nicht als Ziel. `mDeBERTa-v3-base-mnli-xnli` ist Zero-shot-Kandidat für **8.9b**, nicht für Themencluster.

---

## 3. Zielbild 1.14c (verdichtet)

**Fachlich:** Der Host sieht in der Q&A-Wortwolke orthogonal zur Gewichtung (TOP / BEST / Umstritten) einen dritten Analysemodus **Themen**. Paraphrasen werden ein erklärbares Thema mit Mitgliedsliste. Presenter und Quiz-Freitext bleiben auf 2.x. Pflichtlocales der ersten Stufe: `de`, `en`.

**Technisch — Kaskade, kein LLM-Monolith:**

```text
lexikalische 2.x-Wolke (sofort)
        → optional spaCy 1.14b
        → mehrsprachige Embeddings
        → deterministisches Clustering + Unsicherheit
        → optional Open-Weight-LLM nur für Labels aus Mitgliedsfragen
        → Zod → UI (Label, Konfidenz, Mitglieder, Modellversion)
```

Mitgliedschaft entsteht durch Encoder + Clustering. Das LLM darf keine Cluster erfinden. Eine Variante ohne generatives Modell bleibt Default und Ausfallbaseline.

**Betrieb:** Heutige Baseline bleibt Single Host (Nginx, App, PostgreSQL, Redis; ~10–11 GB laut Kapazitätsschätzung). 1.14c sieht einen **zweiten, privaten** Inferenzserver vor (kein öffentlicher Port, Credential/mTLS, Queue, Timeout, Kill-Switch). Browser sprechen ihn nie an. Dieselbe **Serverrolle** darf später 8.9b-Transformer-Fallback und 8.9c Slice 4 tragen — mit **getrennten** Schemas, Queues, Caches und Lebenszyklen. Details: §4.

Zustände 1.14c: `pending` | `ready` | `uncertain` | `stale` | `disabled` | `failed` | `fallback`. Das sind nicht die 8.9b-Zustände (`classified` / …).

Nicht-Ziele: LLM im Participant-Hotpath, automatische Moderation, Sentiment, SaaS-Fallback, Presenter-/Freitext-Rollout in derselben Story.

---

## 4. Zusammenspiel mit Story 8.9c

Kanonisch (Backlog, ADR-0032, [qa-summary.md](../features/qa-summary.md)): **8.9c besitzt nur den Zusammenfassungsvertrag.** Betrieb, Modelllebenszyklus und Servergrenze des späteren privaten Inferenzservers liegen bei **1.14c**. Slice 4 (echtes Modell) folgt **mit** 1.14c auf derselben Rolle, **anderem Auftrag**. Das ist Kopplung der **Infrastruktur**, nicht der **Produktflächen**.

### 4.1 Zwei Host-Fragen, zwei Oberflächen

|                  | **8.9c Kurzfassung**                                                                                 | **1.14c Semantische Themen**                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Ort              | Moderationskompass, Block **Kurzfassung der offenen Fragen**                                         | Q&A-Wortwolke, dritter Analysemodus                                          |
| Host-Frage       | _Was sage ich in einem Blick?_                                                                       | _Welche sichtbaren Fragen meinen dasselbe?_                                  |
| Ausgabe          | 2–4 quellengebundene Stichpunkte (`Thema: Klausel`) plus **Zugehörige Fragen**                       | 5–12 erklärbare Cluster mit Konfidenz und Mitgliedsliste                     |
| Auslöser         | Button **Zusammenfassung**, on demand                                                                | Toggle **Themen**, Snapshot-Job                                              |
| Snapshot         | bis `QA_SUMMARY_MAX_SOURCES` sichtbare `PENDING`/`ACTIVE`/`PINNED`; Ranking und Near-Duplicate-Kanon | `PINNED`/`ACTIVE`; Gewichtung `TOP`/`BEST`/`CONTROVERSIAL` bleibt orthogonal |
| Persistenz       | ephemer im Speicher, TTL, kein Prisma                                                                | Cache über Snapshot-Hash; Zustand `stale` bei neuen Daten                    |
| Kill-Switch      | `QA_SUMMARY_ENABLED`                                                                                 | **neuer**, getrennter Env (nicht `QA_SUMMARY_*`)                             |
| Stand 2026-08-20 | Slices 1–3 plus Loopback-Helfer; Slice 4 offen                                                       | nicht gebaut                                                                 |

Keines ersetzt das andere. 8.9a bleibt Fallback, wenn 8.9c fehlt oder fehlschlägt. Die lexikalische 2.x-Wolke bleibt Fallback, wenn 1.14c fehlt oder fehlschlägt. Der Kompass darf keine Wortwolken-Cluster voraussetzen; die Wolke darf keine Kurzfassung voraussetzen.

### 4.2 Verträge nicht vermischen

- **Eigene Zod-Schemas.** Den 8.9c-Vertrag (`qa.requestSummary` / `qa.summaryRuntime`, Aussagen `{ text, sourceIds }`) nicht für Cluster wiederverwenden. 1.14c braucht Mitgliedschaft, `snapshotHash`, `stale`/`fallback`, Modellversion.
- **Zustände:** 8.9c: `pending` \| `ready` \| `uncertain` \| `disabled` \| `failed`. 1.14c zusätzlich `stale` und `fallback`. Nicht 8.9b (`classified` / …).
- **Quellen-IDs** dürfen dasselbe Format `qa-question:{uuid}` nutzen. 8.9c verwirft Aussagen ohne belegte Snapshot-Quelle. 1.14c erklärt Mitgliedschaft über dieselben IDs in Tooltip/CSV.
- **8.9b** darf 8.9c nur als Ranking-Tie-Break (`CLASSIFIED`) beeinflussen. NLP-Status und Kategorie gehen **nicht** ins Modell. 1.14c-Mitgliedschaft entsteht durch Encoder + Clustering, nicht durch 8.9b-Kategorien.
- **Teilnehmer-DTOs** bleiben frei von Summary- und Cluster-Feldern.

### 4.3 Gleiche Serverrolle, getrennte Aufträge

Wiederverwendbar: privates HTTP (kein öffentlicher Port), Credential/mTLS, SaaS-Host-Sperre, Timeout, Queue-Limit, Concurrency 1 pro Auftrag, Circuit Breaker, Zod, extraktiver Fallback, Host-only.

Getrennt halten:

| Baustein      | 8.9c                                                          | 1.14c                                                                     |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Env / URL     | `QA_SUMMARY_INFERENCE_URL`                                    | eigene URL oder eigener Pfad, **nicht** dieselbe Env für Cluster-Jobs     |
| Queue / Cache | Summary-Queue, Cooldown auf Snapshot-Hash, TTL 30 min Default | Cluster-Queue, ein Inflight pro Session, `stale` statt stiller Neuanalyse |
| HTTP-Auftrag  | Summary-JSON (2–4 Bullets, Quell-IDs, Locale, Duzen)          | Embeddings + Cluster (+ optional Kurzlabel)                               |
| Modellpfad    | Slice 1–3: Adapter ohne geliefertes LLM; Slice 4: LLM         | Stufe 1: Encoder; Stufe 2: optionales LLM nur für Labels                  |

**Reihenfolge:** 1.14c-Stufe 1 (Encoder + Clustering) **nicht** auf Slice 4 warten. Slice 4 ist der generative Summary-Job, nicht der Encoder. Ein gemergter Themenmodus ohne LLM ist zulässig, während 8.9c weiter extraktiv bzw. über den lokalen Gemini-Helfer läuft.

**Hardware:** Encoder (ONNX) und LLM (llama.cpp) als **getrennte Prozesse** auf der Inferenzbox. Prefill eines 8.9c-Prompts darf Encoder-Cluster nicht blockieren. Teilen sich beide LLM-Jobs später **einen** `llama-server`, serialisieren und priorisieren: Timeout/Fallback pro Auftrag, kein gemeinsames „ein Request hängt alles“.

Gemini-Loopback (`npm run qa-summary:dev`, `gemini-3.5-flash-lite`) bleibt **nur** der lokale 8.9c-Helfer. Er ist kein 1.14c-Produktionspfad und kein stiller Cloud-Fallback.

### 4.4 Was 1.14c von 8.9c übernehmen soll

- Adapter-Ablehnung öffentlicher SaaS-Hosts; leere URL → `failed`/`disabled`, nicht Cloud.
- Hartes Timeout; Helfer/Inferenz bricht **vor** dem Backend-Timeout ab, sonst extraktiver Fallback statt `stub:timeout` als Normalfall.
- Cooldown gilt nicht für Timeout-`failed` (sofort wiederholbar).
- Scanbare Host-Sprache, Quellenklick springt zur Frage, Chrome-Hinweise in XLF.
- Live-Hotpath (`qa.submit`, Join, Vote, WS) awaitet nie Inferenz — analog 8.9c `qa.requestSummary`.

### 4.5 Was nicht gekoppelt werden darf

- `QA_SUMMARY_ENABLED=true` ist **keine** Voraussetzung für den Themenmodus.
- Cluster-Labels sind keine 8.9c-Bullets; Summary-Sätze sind keine Wolken-Einträge.
- Erster 1.14c-PR füttert 8.9c **nicht** mit Clusterlabels als Pseudo-Quellen und die Wolke **nicht** mit Summary-Text.
- Später denkbar (offen, Folgestory): 8.9c wählt Quellen clusterbewusst (ein Bullet pro großem Thema). Das ändert den Summary-Vertrag und gehört nicht in Stufe 0–1.
- Ein gemeinsames Cache-Key-Schema über beide Snapshots hinweg ist falsch: 8.9c enthält `PENDING` und andere Rankingregeln als 1.14c.

### 4.6 Implementierungsfolge gegenüber 8.9c

1. **1.14c Stufe 0–1** mergen. 8.9c bleibt Slices 1–3 (extraktiv / optional Gemini-Dev). Beide Kill-Switches unabhängig.
2. **1.14c Stufe 2** (optionale Kurzlabels auf Qwen3-4B). Mitgliedschaft unverändert.
3. **8.9c Slice 4** auf derselben Box, **eigener** Prompt und Zod-Vertrag. Extraktive Kurzfassung bleibt Fallback. DoD **nicht** „gleich Gemini Flash-Lite unter 3–8 s“.
4. GPU-Box erst danach, wenn der Summary-Auftrag messbar an CPU-Prefill scheitert.

Solange Slice 4 fehlt, ist 8.9c produktseitig unvollständig — das blockiert 1.14c-Stufe 1 nicht.

---

## 5. Modellwahl (Empfehlung 2026-08-20)

### 5.1 Encoder (Pflicht für Stufe 1)

Konservativer Start laut ADR-0032 und dieser Voranalyse:

1. **`intfloat/multilingual-e5-small`**, CPU, ONNX, fester Image-/Gewichte-Digest.
2. `e5-base` nur, wenn small das Seed (Kapitel-4-/Klausur-Paraphrasen) nicht bündelt.
3. GTE-multilingual-base, bge-m3, jina-embeddings-v3 nur in erweiterter Qualitäts-/Lastmessung.

Clustering: agglomerativ, Cosinus, Schwelle aus Fixtures, Mindestgröße 2, Rest Einzelthemen mit niedriger Konfidenz. Kein festes _k_. Labels in Stufe 1 **ohne LLM** (kürzeste zentrale Mitgliedsfrage oder häufige Nominalphrase).

### 5.2 LLM (optional, Stufe 2)

Live-Host **8 vCPU / 16 GB:** kein LLM neben Node/Postgres/Redis.

Eigene 8/16-CPU-Inferenzrolle oder streng gedeckelter Sidecar (cgroup: 2–4 Threads, ~4 GB):

| Priorität    | Modell                                                                           | Begründung                                                                                    |
| ------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1            | **`Qwen3-4B-Instruct-2507` Q4_K_M**, llama.cpp, non-thinking                     | Apache 2.0; Nachfolger von Qwen2.5-3B; passt in 16 GB; besserer Instruktionsfolger als 2.5-3B |
| 2 zum Messen | Gemma-3-4B-IT Q4                                                                 | oft etwas bessere Labels, unbequemere Lizenz für MIT-Auslieferung                             |
| nicht        | 7B/8B+ auf CPU, Llama-3.2-3B als Ziel, Phi-4-mini, DeepSeek V4-\* auf dieser Box | Timeout, RAM, DE/Mehrsprachigkeit oder ~160 GB Gewichte                                       |

Auftrag des LLM: nur 3–6-Wörter-Label aus schon geclusterten Mitgliedern. Der **8.9c-Summary-JSON-Job** (2–4 Bullets) ist ein **anderer** Auftrag auf derselben Box (Slice 4, §4.3), nicht Teil von Stufe 2. **Thinking-Modi aus** (sprengen 3–8 s).

### 5.3 Gemini im Dev-Helfer (Referenz, nicht Produktion)

`scripts/qa-summary-dev-server.mjs`: `gemini-3.5-flash-lite`, Thinking `MINIMAL`. Backend-Default `QA_SUMMARY_TIMEOUT_MS=8000`, Helfer bricht 5 s früher ab (oft **3 s**), sonst extraktiver Fallback.

Flash-Lite ist die **Qualitäts- und Tempo-Decke** für den 8.9c-Scan-Auftrag (2–4 Bullets, Duzen, Quell-IDs). Ein 3B/4B-Q4 auf CPU liegt eine Modellklasse darunter, reißt das Fenster für den vollen Summary-Prompt regelmäßig und darf nicht als DoD „gleich Gemini“ stehen. Für **kurze Cluster-Labels** ist 4B-CPU der passende lokale Job.

### 5.4 Open-Weight-Flagschiffe 2026 (nicht die 16-GB-CPU-Antwort)

Leistungsfähigere offene Gewichte existieren, vor allem aus China: DeepSeek V4-Flash/Pro, Qwen3/3.6 (27B, 35B-A3B, große MoEs), Kimi, GLM. V4-Flash (~13B aktiv, Gewichte in der Größenordnung 160 GB) ist eine GPU-Geschichte. Qwen3.6-35B-A3B ist ein Self-Host-Kandidat **mit GPU** (wenig aktive Parameter, große Datei). Llama 4: Custom License, EU-Vorbehalt bei Multimodal-Rechten prüfen.

Produktion: kein stiller Cloud-Fallback (auch nicht DeepSeek-/Qwen-API). Self-Host oder aus.

---

## 6. Konkretes Vorgehen für die Implementierung

Reihenfolge ist mergefähig. Jede Stufe hat eigenen Kill-Switch-Pfad und lexikalischen Fallback. Kein Anheben des Angular-Initial-Bundle-`maximumError`.

### Stufe 0 — Vertrag und UI-Rahmen (ohne Semantik)

**Umgesetzt 2026-08-20** (kein Encoder, kein LLM, kein 8.9c-Slice-4). Host-Q&A und Host-Freitext.

- Analysemodus im Host-Q&A sichtbar trennen: `Einzelwörter` | `Begriffe & Phrasen` | `Themen` (letzterer darf zuerst `pending`/`disabled`/`fallback` zeigen).
- Shared-Zod um Snapshot-Clustervertrag erweitern oder bestehenden `AnalyzeWordCloud*`-Vertrag versioniert um Cluster-Felder ergänzen (`status`, `modelVersion`, `snapshotHash`, `confidence`, `members`, `fallbackUsed`). Nicht den 8.9b- oder 8.9c-Vertrag wiederverwenden (siehe §4.2).
- `app-word-cloud` bleibt Renderer. Keine Encoder-Logik im Browser.
- Tests: lexikalischer 2.x-Pfad regressionsfrei.

**Done wenn:** Toggle existiert, Themenmodus fällt ohne Server auf 2.x, keine leere Karte.

### Stufe 1 — Encoder + Clustering (das eigentliche 1.14c)

- Privater Inferenzdienst (Compose-Profil, Unix-Socket oder internes HTTP wie spaCy/8.9c-Adapter). Nur Backend darf ihn erreichen.
- Pipeline: Host-Snapshot (`PINNED`/`ACTIVE`, Gewichtung, Locale) → Hash → Cache → `e5-small` → agglomeratives Clustering → extraktive Labels → Zod.
- Höchstens ein aktiver Job pro Session. Neue Daten → `stale`, Button **Neu analysieren**, keine Dauerschleife.
- Snapshot nur `{ id, text }` plus anonyme Quellschlüssel. Keine Tokens, IPs, Nicknames, Participant-IDs.
- Kill-Switch (neuer Env, nicht `NLP_ENABLED` / `QA_NLP_ENABLED` / `QA_SUMMARY_ENABLED`). 8.9c bleibt unabhängig schaltbar.
- Timeout, Parallelität 1, CPU-/RAM-cgroup, Circuit Breaker.
- Fixtures: die drei Klausur-Paraphrasen zu Kapitel 4 müssen zusammenfallen; Folien vs. Beamer-Hänger nicht.
- Last: Join/Vote/`qa.submit`/WS unverändert bei tot/langsam/überlastetem Encoder (künstliche Verzögerung wie 1.14b).

**Done wenn:** Host bekommt 5–12 erklärbare Themen, Tooltip/CSV mit Mitgliedern, Fallback hart, `de`/`en`-Fixtures grün, Encoder-Digest versioniert.

### Stufe 2 — optionales LLM-Label (nur nach Stufe 1)

- Hinter Early-Exit: nur Cluster mit ≥2 Mitgliedern und unsicherem extraktivem Label.
- Modell: `Qwen3-4B-Instruct-2507` Q4, non-thinking, max. wenige Dutzend Ausgabetokens, JSON-Schema, serverseitig Zod.
- Timeout strenger als Encoder (Ziel: im 8-s-Backend-Fenster bleiben; lieber extraktiv als `stub:timeout`).
- Schemawidrige, quellenlose, widersprüchliche Antworten verwerfen.
- Variante `LLM=off` bleibt Default.

**Done wenn:** Labels lesbarer ohne geänderte Mitgliedschaft; bei Timeout identische Cluster mit extraktivem Label.

### Stufe 3 — dieselbe Serverrolle, 8.9c Slice 4 und 8.9b (nicht im ersten 1.14c-PR)

Reihenfolge und Entkopplung: §4.6.

- **8.9c Slice 4:** privater Adapter auf denselben Host, **eigener** Prompt/Vertrag/`QA_SUMMARY_INFERENCE_*`. 4B-CPU nicht als Gemini-Ersatz versprechen; extraktiv bleibt Fallback. Encoder-Prozess und Summary-LLM nicht in einer Warteschlange vermischen.
- **8.9b:** `multilingual-e5-*` nur als gemessener Qualitätskandidat, kein Hotpath-Zwang nach dem Hash-k-NN-Lasttest.
- GPU-Box (eine 24-GB-Karte) erst hier als Option für Qwen3-8B oder Qwen3.6-35B-A3B — gesonderte FinOps-/Security-Entscheidung, vor allem wenn Slice 4 am CPU-Prefill scheitert.

### Freigabestufen (Backlog, unverändert)

1. Offline-/Notebook-Vergleich auf synthetischem Seed.
2. Isolierter Zwei-Server-Laborpfad.
3. Produktionsnahe Last, Fehler, Security, Privacy, Kosten.
   Danach erst bewusste Produktivaktivierung. Eine Demo schließt die Story nicht.

---

## 7. Tests und Nachweise (mitliefern)

- Shared-Contract: Erfolg, leerer Snapshot, unsichere Cluster, Timeout, ungültige Modellantwort, Kill-Switch aus.
- Frontend: Toggle, `pending` → `ready`/`fallback`/`failed`, Tooltip, CSV, Fokus; 2.x-Regression.
- Security: Prompt-Injection durch Fragetext, überlange Eingabe, kein Datenabfluss in Logs, kein öffentlicher Port.
- Qualität: Pairwise Precision/Recall oder begründete Clustermetrik auf kuratiertem DE/EN-Seed; menschliche Rubrik für Labeltreue. 8.9c-Slice-4-Qualität getrennt messen, nicht als 1.14c-DoD.
- Betrieb: Queue-Latenz, Cache-Hit, Timeout-/Fallback-Rate, CPU/RAM; Live-Baselines mit deaktiviertem Server.
- Isolation 8.9c: Cluster-Job bei tot/langsamem Summary-Adapter unverändert; Summary-Job bei tot/langsamem Encoder unverändert; beide Kill-Switches unabhängig; kein gemeinsames Cache-Key.
- Lizenz: Encoder- und LLM-Karten in NOTICE; Apache-2.0 vs. Gemma vs. Llama-4 vor Image-Bau.

---

## 8. Offene Entscheidungen (nicht in dieser Voranalyse getroffen)

- Endgültiger Env-Name und Compose-Profil des Inferenzdienstes.
- Socket vs. internes HTTP; ob Encoder und 8.9c-Adapter getrennte Ports/Pfade auf derselben Box teilen.
- Ob Presenter später denselben Cache lesen darf (eigene Folgestory).
- Ob 8.9c Slice 4 denselben `llama-server` wie 1.14c-Labels nutzt oder bei extraktiv bleibt, bis GPU da ist.
- Ob 8.9c später clusterbewusst Quellen wählt (Folgestory, Vertragänderung).
- Produktivaktivierung und Unit Economics (Kurs-Messprogramm).

---

## 9. Kanonische Verweise

- Story: [Backlog.md](../../Backlog.md) 1.14c, Abgrenzung 8.9c
- Zielbild: [WORD-CLOUD-3.0-STORY-VORSCHLAG.md](WORD-CLOUD-3.0-STORY-VORSCHLAG.md)
- Kaskade/Encoder-Kandidaten: [ADR-0032](../architecture/decisions/0032-optional-nlp-cascade-for-qa-moderation-signals.md) (Abschnitt „Bezug zu Story 8.9c“)
- 1.14b / 8.9a–c: [word-cloud-spacy.md](../features/word-cloud-spacy.md), [moderation-compass.md](../features/moderation-compass.md), [qa-nlp-moderation.md](../features/qa-nlp-moderation.md), [qa-summary.md](../features/qa-summary.md)
- Host-RAM: [capacity-estimate-16gb-16cores.md](../capacity-estimate-16gb-16cores.md), [deployment-debian-root-server.md](../deployment-debian-root-server.md) §12
- Diagramm: [diagrams.md](../diagrams/diagrams.md) §1.3
