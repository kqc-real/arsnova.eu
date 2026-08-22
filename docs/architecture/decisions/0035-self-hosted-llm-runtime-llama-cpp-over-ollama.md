<!-- markdownlint-disable MD013 -->

# ADR-0035: Selbstgehosteter Open-Weight-LLM-Server — `llama.cpp` (`llama-server`) statt Ollama

**Status:** Accepted
**Datum:** 2026-08-22
**Entscheider:** Projektteam (Architekturentscheid auf Basis der 1.14c-Voranalyse, PO-Auftrag 2026-08-22)
**Letzter Repo-Abgleich:** 2026-08-22
**Kontext-Tags:** Machine Learning, Inferenz-Runtime, Selbst-Hosting, Backend-Architektur, Betrieb, Open-Weight-LLM

**Ersetzt keine Produktentscheidung, nur die Runtime:** [WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md](../implementation/WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md), [ADR-0032](0032-optional-nlp-cascade-for-qa-moderation-signals.md), Backlog Story 1.14c, Story 8.9c.

## Kontext

Die Voranalyse vom 2026-08-20 hat für den optionalen, selbstgehosteten LLM-Baustein von
**Story 1.14c Stufe 2** (kurze Cluster-Labels) und **Story 8.9c Slice 4** (generative
Moderations-Kurzfassung) bereits `llama.cpp` als Runtime und `Qwen3-4B-Instruct-2507` Q4_K_M als
Modell vorgeschlagen — als informelle Architekturmeinung, ohne Produktfreigabe und ohne
expliziten Vergleich zu Ollama. Der Betreiber wollte zusätzlich prüfen lassen, ob ein
**Ollama-Server in der eigenen Produktionsinfrastruktur** die passendere Wahl ist, um
Open-Weight-Modelle wahlweise anzubinden. Eine **Bring-your-own-LLM-Option für Hosts** (eigene
Endpunkt-/Key-Eingabe pro Session) wurde vom PO am 2026-08-22 aus Zielgruppengründen verworfen
und ist **nicht** Gegenstand dieser ADR.

Randbedingungen, die für diese Entscheidung unverändert aus ADR-0032 und der Voranalyse gelten:

- Zielhost bleibt eine einzelne Produktionsmaschine mit **8 vCPU / 16 GB RAM**, geteilt mit
  Node-App, PostgreSQL und Redis. Keine GPU im aktuellen Betrieb.
- Live-Hotpfade (`qa.submit`, Join, Vote, WebSocket) dürfen nie auf Inferenz warten.
- Kein öffentlicher Port, kein stiller SaaS-Fallback, kein zweites Modellserver-Silo neben dem
  bereits beschlossenen privaten Encoder-Sidecar (1.14c Stufe 1, `docker/wordcloud-encoder`).
- Zwei fachlich getrennte Aufträge (Cluster-Label, Summary-Bullet) sollen sich **eine**
  Serverrolle teilen dürfen, aber eigene Prompts, Verträge, Queues und Timeouts behalten
  (Voranalyse §4.3/§4.6) — das bleibt durch diese ADR unverändert.

Diese ADR entscheidet **ausschließlich über die Serving-Runtime** für dieses selbstgehostete
Modell, nicht über das Modell selbst, nicht über Story-Umfang oder Freigabestufen.

## Recherchegrundlage (2026-08-22)

Direkt anhand der aktuellen Projektquellen geprüft (nicht nur aus Trainingswissen):

| Projekt                                                                                             | Lizenz     | Status (heute)                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ggml-org/llama.cpp`](https://github.com/ggml-org/llama.cpp)                                       | MIT        | Sehr aktiv (Commits im Stundentakt), 125k Stars, breiteste Backend-Matrix (CPU/BLAS/CUDA/HIP/Metal/Vulkan/SYCL/CANN/OpenVINO u. a.)                                                                                                                      |
| [`ollama/ollama`](https://github.com/ollama/ollama)                                                 | MIT        | Sehr aktiv, 179k Stars. Eigener Commit-Verlauf: _"runner: Remove CGO engines, use llama-server exclusively for GGML models"_ — nutzt intern selbst `llama-server` als GGML-Engine                                                                        |
| [`vllm-project/vllm`](https://github.com/vllm-project/vllm)                                         | Apache-2.0 | Sehr aktiv, 89.7k Stars, explizit GPU-first (PagedAttention, CUDA-Graphs, Tensor-/Pipeline-Parallelism); CPU offiziell mitunterstützt, aber nicht der Entwurfsschwerpunkt                                                                                |
| [`huggingface/text-generation-inference`](https://github.com/huggingface/text-generation-inference) | Apache-2.0 | **Vom Betreiber selbst archiviert (21.03.2026), "maintenance mode"**; README verweist explizit auf `vllm`/`SGLang` (GPU) oder **`llama.cpp`**/MLX (lokal) als Nachfolgeempfehlung; eigenes README: _"CPU is not the intended platform for this project"_ |

## Entscheidung

### 1. Runtime: `llama.cpp` (`llama-server`) direkt, nicht Ollama

Wir betreiben den selbstgehosteten LLM-Baustein für 1.14c Stufe 2 und 8.9c Slice 4 über den in
`llama.cpp` enthaltenen `llama-server` (OpenAI-kompatible HTTP-API, GGUF-Quantisierung, MIT).
**Nicht** über Ollama.

**Kernbefund gegen eine separate Ollama-vs-llama.cpp-Qualitätsdebatte:** Ollama ist inzwischen
selbst auf `llama-server` als alleinige GGML-Ausführungsschicht umgestiegen. Die Wahl ist damit
**keine Entscheidung über Inferenzqualität** — beide laufen auf derselben Engine —, sondern eine
Entscheidung über **wie viel zusätzliche Produktschicht** um dieselbe Engine herum betrieben wird.

| Kriterium                                                    | `llama.cpp` / `llama-server` direkt                                                                       | Ollama                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kernengine                                                   | ist die Engine                                                                                            | wrapt dieselbe Engine (`llama-server` intern für GGML)                                                                                                                                                                                         |
| Lizenz                                                       | MIT                                                                                                       | MIT                                                                                                                                                                                                                                            |
| Betriebsumfang                                               | ein Binary, ein HTTP-Server, GBNF-Grammatiken, OpenAI-kompatible API                                      | Modell-Registry/Pull von `ollama.com`, Auth/Keypairs, Desktop-App, Agent-Framework, "launch"-Integrationen für Claude Code/Codex/Copilot CLI/DeepSeek Harness, Web-Search in der Responses-API, MLX-Runner, signierte Cloud-Modellempfehlungen |
| Angriffs-/Wartungsfläche                                     | klein, ein Prozess, ein Zweck                                                                             | groß: Registry-Client, Auth-Subsystem, Agent-/Tool-Layer, mehrere Netzwerk-Integrationspunkte, die für einen internen Single-Model-Sidecar einzeln stillgelegt/auditiert werden müssten                                                        |
| Modellbezug in Produktion                                    | gepinnte lokale GGUF-Datei, Digest versionierbar (passt zu ADR-0032: "Modelle... versionierte Artefakte") | Standardweg ist `ollama pull` gegen `ollama.com`; manuelles Pinnen/Offline-Betrieb geht, ist aber gegen den Werkzeug-Standardpfad                                                                                                              |
| Ressourcenkontrolle                                          | direkte Thread-/Kontext-/Batch-Flags, passt zum bestehenden cgroup-Muster von spaCy/Encoder               | eigene Scheduler-/Keep-Alive-/Parallelitätslogik zusätzlich zur darunterliegenden Engine                                                                                                                                                       |
| Passung zum bestehenden Sidecar-Muster (1.14b/1.14c Stufe 1) | deckungsgleich: ein Zweck, kein öffentlicher Port, ein Kill-Switch                                        | zusätzlicher Produktrahmen, den man erst auf "nur ein internes Modell, kein Registry-Zugriff" zurückschneiden müsste                                                                                                                           |
| Hardware-Rückwärtskompatibilität für eine spätere GPU-Stufe  | ja, dieselbe Engine trägt CUDA/HIP/Vulkan/Metal ohne Werkzeugwechsel                                      | ja, aber über den zusätzlichen Ollama-Layer                                                                                                                                                                                                    |

**vLLM** ist explizit GPU-first entworfen (PagedAttention, CUDA-Graphs, Tensor-/Pipeline-/Expert-Parallelism)
und für 8 vCPU/16 GB ohne GPU der falsche Werkzeugtyp — hervorragend geeignet, **sobald** arsnova.eu
tatsächlich eine GPU-Box einführt (Voranalyse §5.4 sieht das bereits als spätere, eigene
FinOps-/Security-Entscheidung vor). Für den aktuellen Zielhost verworfen.

**TGI** ist vom eigenen Betreiber (Hugging Face) am 21.03.2026 archiviert und in "maintenance
mode" versetzt worden; das README selbst empfiehlt für lokale/CPU-Einsätze ausdrücklich
`llama.cpp` oder MLX statt TGI. Damit entfällt TGI unabhängig von allen sonstigen Kriterien.

**Kurz mitbewertet, verworfen:** `llamafile` (portables Einzel-Binary auf `llama.cpp`-Basis) löst
ein Distributionsproblem, das wir bereits über Docker/Compose-Profile gelöst haben — kein
Mehrwert. `LocalAI` (OpenAI-kompatible Mehr-Backend-Wrapper-Schicht) hat dasselbe
Zusatzschicht-Problem wie Ollama, ohne dessen Ökosystemgröße auszugleichen.

### 2. Betriebsmodell: gleiches Muster wie spaCy (1.14b) und Encoder (1.14c Stufe 1)

- Eigener Container/Prozess, **kein öffentlicher Port**, Unix-Socket oder internes HTTP wie beim
  Encoder-Adapter (`WORD_CLOUD_ENCODER_URL`-Muster), `network_mode: none` wo möglich.
- Eigenes Compose-Profil (z. B. `llm`), eigenes Image (nicht `ARSNOVA_IMAGE`, nicht
  `SPACY_IMAGE`, nicht `WORD_CLOUD_ENCODER_IMAGE`).
- Eigener Kill-Switch, unabhängig von `NLP_ENABLED`, `QA_NLP_ENABLED`,
  `WORD_CLOUD_SEMANTIC_ENABLED`, `QA_SUMMARY_ENABLED` (Prinzip aus ADR-0032 und
  `word-cloud-semantic.md` fortgeführt: getrennte Schalter, keine stille Kopplung).
- Modell bleibt ein **gepinntes, digest-versioniertes Artefakt** (`Qwen3-4B-Instruct-2507`
  Q4_K_M, Apache-2.0, non-thinking, laut Voranalyse §5.2). Kein Laufzeit-`pull` gegen ein
  öffentliches Registry in Produktion — Modellbezug ist ein expliziter, dokumentierter
  Deploy-Schritt, kein automatischer Netzwerkzugriff des Servers selbst.
- Timeout, Concurrency-1-pro-Auftrag, Circuit Breaker analog Encoder-Client
  (`wordCloudEncoderClient.ts`) und Summary-Adapter (`qaSummaryAdapter.ts`).
- Zwei Aufträge (Cluster-Label, Summary-Bullet) dürfen sich den Prozess teilen, behalten aber
  getrennte Prompts/Zod-Verträge/Queues (Voranalyse §4.2–§4.6 bleibt unverändert gültig).

### 3. Geltungsbereich

Diese Entscheidung betrifft ausschließlich die **Betreiber-seitige** Serving-Runtime für
1.14c Stufe 2 und 8.9c Slice 4. Sie berührt nicht:

- die bereits getroffene Encoder-Wahl für 1.14c Stufe 1 (`intfloat/multilingual-e5-small`, ONNX,
  eigener Sidecar) — bleibt unverändert,
- den Gemini-Dev-Helfer (`scripts/qa-summary-dev-server.mjs`) — bleibt ausschließlich lokales
  Entwicklerwerkzeug, kein Produktionspfad,
- die verworfene Bring-your-own-LLM-Option für Hosts.

## Performance-Steckbrief

- **Lastklasse:** performance-kritisch (ADR-0025), solange nicht durch Messung entschärft.
- **Pfadtyp:** privater Hintergrund-/On-Demand-Dienst, kein synchroner Live-Hotpath.
- **Kostenprofil:** CPU-Threads (2–4 laut Voranalyse), RAM (~4 GB Modellbudget), Container-Image-Größe.
- **Skalierungsprofil:** ein Inflight-Job pro Auftragstyp; zwei Auftragstypen (Label, Summary)
  teilen sich denselben Prozess und müssen serialisiert/priorisiert werden, damit ein hängender
  Request nicht beide Aufträge blockiert (Voranalyse §4.3).
- **Worst Case:** beide Aufträge gleichzeitig angefragt, Modell bereits ausgelastet → zweiter
  Auftrag bekommt sofort `pending`/Fallback statt Warteschlange, analog dem bestehenden
  `MAX_IN_FLIGHT`-Muster des Encoders.
- **Entlastungsstrategie:** hartes Timeout unterhalb des jeweiligen Backend-Timeouts (analog
  8.9c-Helferregel: Modellaufruf bricht vor `QA_SUMMARY_TIMEOUT_MS` ab), Circuit Breaker,
  extraktiver bzw. labelloser Fallback bleibt Standard.
- **Messstrategie:** Offline-/Notebook-Vergleich → isolierter Zwei-Server-Laborpfad →
  produktionsnahe Last-/Fehler-/Security-/Privacy-/Kostenprüfung (Voranalyse §6, unverändert).

## Konsequenzen

### Positiv

- Kleinste sinnvolle Angriffs- und Wartungsfläche: ein MIT-Binary, ein Zweck, passt exakt in das
  bereits etablierte Sidecar-Muster von spaCy und Encoder.
- Keine Inferenzqualitäts-Einbuße gegenüber Ollama, da beide dieselbe Engine ausführen.
- Kein erzwungener Netzwerkpfad zu einer externen Modell-Registry in Produktion.
- Dieselbe Engine trägt spätere GPU-Backends (CUDA/HIP/Vulkan/Metal), falls arsnova.eu je eine
  GPU-Box einführt — kein Werkzeugwechsel für diesen Schritt nötig.
- Modellwahl (`Qwen3-4B-Instruct-2507`, Apache-2.0) aus der Voranalyse bleibt gültig und wird
  durch die aktuelle Recherche nicht in Frage gestellt.

### Negativ / Risiken

- Kein eingebauter Modell-Registry-/Pull-Komfort wie bei Ollama — Modellbezug, Checksum-Prüfung
  und Ablage müssen als expliziter Ops-Schritt dokumentiert werden (einmaliger Aufwand, passt
  zum "gepinntes Artefakt"-Prinzip aus ADR-0032).
- Kein eingebauter Multi-Model-Hotswap — irrelevant, solange arsnova.eu bewusst nur ein
  gepinntes Modell betreibt; würde sich bei künftigem Modellvergleich als Mehraufwand zeigen.
- Weniger vorgefertigte Client-Bibliotheken als im Ollama-Ökosystem — arsnova.eu schreibt für
  8.9c ohnehin einen eigenen schmalen Adapter (`qaSummaryAdapter.ts`-Muster), der Unterschied
  wirkt sich praktisch nicht aus.
- Die Ein-Prozess-für-zwei-Aufträge-Kopplung (Voranalyse §4.3) bleibt ein Betriebsrisiko
  unabhängig von der Runtime-Wahl dieser ADR — nicht neu, aber nicht durch diese Entscheidung
  gelöst.

## Alternativen (geprüft)

- **Ollama:** verworfen als Serving-Layer für diesen Anwendungsfall. Läuft intern selbst auf
  `llama-server`, bringt aber Registry-/Auth-/Agent-/Cloud-Funktionsumfang mit, der für einen
  internen, ops-gepinnten Single-Model-Sidecar überdimensioniert ist und zusätzliche
  Audit-/Lockdown-Arbeit erzeugen würde, ohne einen Inferenzvorteil zu liefern.
- **vLLM:** verworfen für die aktuelle CPU-only-8-vCPU/16-GB-Box; explizit für eine spätere
  GPU-Stufe vorgemerkt (Voranalyse §5.4).
- **Hugging Face TGI:** verworfen — vom eigenen Betreiber archiviert/in Wartungsmodus, verweist
  selbst auf `vllm`/`SGLang` oder `llama.cpp`; eigenes README schließt CPU als Zielplattform aus.
- **`llamafile`:** verworfen; löst ein Distributions-/Portabilitätsproblem, das Docker/Compose
  hier bereits abdeckt.
- **`LocalAI`:** verworfen aus denselben Gründen wie Ollama (zusätzliche Wrapper-Schicht ohne
  Mehrwert für einen internen Single-Model-Sidecar).
- **Bring-your-own-LLM (Host liefert eigenen SaaS-Endpunkt/Key):** vom PO am 2026-08-22 wegen
  Zielgruppe (Lehrkräfte, Konferenzvortragende) verworfen; nicht Gegenstand dieser ADR.
- **Kein selbstgehostetes LLM, dauerhaft nur extraktiv/Gemini-Dev-Helfer:** verworfen als
  Zielbild, weil 1.14c Stufe 2 und 8.9c Slice 4 damit produktiv nie fertig würden; bleibt aber
  der harte Fallback, falls die LLM-Stufe fehlt oder ausfällt.

## Umsetzungsleitplanken

- Kein öffentlicher Port; Unix-Socket oder internes HTTP mit demselben Loopback-/RFC1918-Literal-
  Prinzip wie beim Encoder-Adapter.
- Eigenes Compose-Profil und eigenes Image, getrennt von `SPACY_IMAGE`/`WORD_CLOUD_ENCODER_IMAGE`/
  `ARSNOVA_IMAGE`; `deploy.sh` startet es nicht automatisch.
- Modell als gepinntes, digest-versioniertes Artefakt; kein automatischer Laufzeit-Pull aus einer
  Registry in Produktion.
- Eigener Kill-Switch, der mit keinem der vier bestehenden Schalter
  (`NLP_ENABLED`/`QA_NLP_ENABLED`/`WORD_CLOUD_SEMANTIC_ENABLED`/`QA_SUMMARY_ENABLED`) verwechselt
  oder wiederverwendet wird.
- 1.14c Stufe 2 und 8.9c Slice 4 behalten getrennte Prompts, Zod-Verträge, Queues und
  Cooldowns; diese ADR autorisiert **keine** Zusammenlegung der beiden Aufträge.
- Freigabestufen unverändert: Offline-Vergleich → isolierter Zwei-Server-Laborpfad →
  produktionsnahe Last-/Fehler-/Security-/Privacy-/Kostenprüfung, erst danach bewusste
  Produktivaktivierung.
- Diese ADR autorisiert keine Implementierung; sie legt nur die Runtime fest, sobald 1.14c
  Stufe 2 oder 8.9c Slice 4 beauftragt werden.

---

**Referenzen:** [WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md](../implementation/WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md),
[ADR-0032](0032-optional-nlp-cascade-for-qa-moderation-signals.md),
[ADR-0025](0025-treat-future-extensions-as-performance-critical-until-proven-otherwise.md),
[ADR-0026](0026-prioritize-performance-hotpaths-and-de-escalate-telemetry-side-load.md),
[word-cloud-semantic.md](../features/word-cloud-semantic.md), [qa-summary.md](../features/qa-summary.md),
[github.com/ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp),
[github.com/ollama/ollama](https://github.com/ollama/ollama),
[github.com/vllm-project/vllm](https://github.com/vllm-project/vllm),
[github.com/huggingface/text-generation-inference](https://github.com/huggingface/text-generation-inference).
