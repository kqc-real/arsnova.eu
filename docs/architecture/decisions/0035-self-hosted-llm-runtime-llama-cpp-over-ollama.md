<!-- markdownlint-disable MD013 -->

# ADR-0035: Selbstgehosteter Open-Weight-LLM-Server — `llama.cpp` (`llama-server`) statt Ollama

**Status:** Accepted
**Datum:** 2026-08-22
**Entscheider:** Projektteam (Architekturentscheid auf Basis der 1.14c-Voranalyse, PO-Auftrag 2026-08-22)
**Letzter Repo-Abgleich:** 2026-08-22 (Leitplanken nach 1.14b, 1.14c Stufe 1 und 8.9c Slices 1–3)
**Kontext-Tags:** Machine Learning, Inferenz-Runtime, Selbst-Hosting, Backend-Architektur, Betrieb, Open-Weight-LLM

**Ersetzt keine Produktentscheidung, nur die Runtime:** [WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md](../../implementation/WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md), [ADR-0032](0032-optional-nlp-cascade-for-qa-moderation-signals.md), Backlog Story 1.14c, Story 8.9c, Story 8.9d.

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

- Live-Host bleibt **8 vCPU / 16 GB RAM** (Node-App, PostgreSQL, Redis). **Kein LLM auf
  diesem Host** (Voranalyse §5.2). Die kanonische Inferenzrolle ist ein **zweiter, privater**
  Host derselben Größenordnung. Ein streng gedeckelter Same-Host-Sidecar (cgroup: 2–4 Threads,
  ~4 GB) bleibt nur Labor, nicht die Produktionsannahme. Keine GPU im aktuellen Betrieb.
- Live-Hotpfade (`qa.submit`, Join, Vote, WebSocket) dürfen nie auf Inferenz warten.
- Kein öffentlicher Port, kein stiller SaaS-Fallback, kein zweites Modellserver-Silo neben dem
  bereits beschlossenen privaten Encoder-Sidecar (1.14c Stufe 1, `docker/wordcloud-encoder`).
- Zwei fachlich getrennte Aufträge (Cluster-Label, Summary-Bullet) sollen sich **eine**
  Serverrolle teilen dürfen, aber eigene Prompts, Verträge, Queues und Timeouts behalten
  (Voranalyse §4.3/§4.6) — das bleibt durch diese ADR unverändert.

Diese ADR entscheidet **ausschließlich über die Serving-Runtime** für dieses selbstgehostete
Modell, nicht über das Modell selbst, nicht über Story-Umfang oder Freigabestufen. Die
Betriebsleitplanken in §2 und am Ende sind verbindlich, sobald Story 8.9d beauftragt wird.

## Recherchegrundlage (2026-08-22)

Direkt anhand der aktuellen Projektquellen geprüft (nicht nur aus Trainingswissen):

| Projekt                                                                                             | Lizenz     | Status (heute)                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ggml-org/llama.cpp`](https://github.com/ggml-org/llama.cpp)                                       | MIT        | Sehr aktiv (Commits im Stundentakt), 125k Stars, breiteste Backend-Matrix (CPU/BLAS/CUDA/HIP/Metal/Vulkan/SYCL/CANN/OpenVINO u. a.)                                                                                                                      |
| [`ollama/ollama`](https://github.com/ollama/ollama)                                                 | MIT        | Sehr aktiv, 179k Stars. Eigener Commit-Verlauf: _"runner: Remove CGO engines, use llama-server exclusively for GGML models"_ — nutzt intern selbst `llama-server` als GGML-Engine                                                                        |
| [`vllm-project/vllm`](https://github.com/vllm-project/vllm)                                         | Apache-2.0 | Sehr aktiv, 89.7k Stars, explizit GPU-first (PagedAttention, CUDA-Graphs, Tensor-/Pipeline-Parallelism); CPU offiziell mitunterstützt, aber nicht der Entwurfsschwerpunkt                                                                                |
| [`huggingface/text-generation-inference`](https://github.com/huggingface/text-generation-inference) | Apache-2.0 | **Vom Betreiber selbst archiviert (21.03.2026), "maintenance mode"**; README verweist explizit auf `vllm`/`SGLang` (GPU) oder **`llama.cpp`**/MLX (lokal) als Nachfolgeempfehlung; eigenes README: _"CPU is not the intended platform for this project"_ |

`llama-server`-Flags (WebUI, Slots, `--host …sock`, `--ctx-size`, `--parallel`, `--json-schema` pro Request) gegen die aktuelle Server-README von `ggml-org/llama.cpp` geprüft (2026-08-22).

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
| Betriebsumfang                                               | ein Binary, ein HTTP-Server, GBNF/JSON-Schema pro Request, OpenAI-kompatible API                          | Modell-Registry/Pull von `ollama.com`, Auth/Keypairs, Desktop-App, Agent-Framework, "launch"-Integrationen für Claude Code/Codex/Copilot CLI/DeepSeek Harness, Web-Search in der Responses-API, MLX-Runner, signierte Cloud-Modellempfehlungen |
| Angriffs-/Wartungsfläche                                     | klein, ein Prozess, ein Zweck — Defaults (WebUI, Slots, kein API-Key) müssen hart abgeschaltet werden     | groß: Registry-Client, Auth-Subsystem, Agent-/Tool-Layer, mehrere Netzwerk-Integrationspunkte, die für einen internen Single-Model-Sidecar einzeln stillgelegt/auditiert werden müssten                                                        |
| Modellbezug in Produktion                                    | gepinnte lokale GGUF-Datei, Digest versionierbar (passt zu ADR-0032: "Modelle... versionierte Artefakte") | Standardweg ist `ollama pull` gegen `ollama.com`; manuelles Pinnen/Offline-Betrieb geht, ist aber gegen den Werkzeug-Standardpfad                                                                                                              |
| Ressourcenkontrolle                                          | direkte Thread-/Kontext-/Batch-Flags, `--parallel` und `--ctx-size` müssen explizit gesetzt werden        | eigene Scheduler-/Keep-Alive-/Parallelitätslogik zusätzlich zur darunterliegenden Engine                                                                                                                                                       |
| Passung zum bestehenden Sidecar-Muster (1.14b/1.14c Stufe 1) | gleicher Zweck (ein Prozess, kein öffentlicher Port, eigener Kill-Switch); Transport folgt der Topologie  | zusätzlicher Produktrahmen, den man erst auf "nur ein internes Modell, kein Registry-Zugriff" zurückschneiden müsste                                                                                                                           |
| Hardware-Rückwärtskompatibilität für eine spätere GPU-Stufe  | ja, dieselbe Engine trägt CUDA/HIP/Vulkan/Metal ohne Werkzeugwechsel                                      | ja, aber über den zusätzlichen Ollama-Layer                                                                                                                                                                                                    |

**vLLM** ist explizit GPU-first entworfen (PagedAttention, CUDA-Graphs, Tensor-/Pipeline-/Expert-Parallelism)
und für 8 vCPU/16 GB ohne GPU der falsche Werkzeugtyp — hervorragend geeignet, **sobald** arsnova.eu
tatsächlich eine GPU-Box einführt (Voranalyse §5.4 sieht das bereits als spätere, eigene
FinOps-/Security-Entscheidung vor). Für die aktuelle Inferenz-CPU-Rolle verworfen.

**TGI** ist vom eigenen Betreiber (Hugging Face) am 21.03.2026 archiviert und in "maintenance
mode" versetzt worden; das README selbst empfiehlt für lokale/CPU-Einsätze ausdrücklich
`llama.cpp` oder MLX statt TGI. Damit entfällt TGI unabhängig von allen sonstigen Kriterien.

**Kurz mitbewertet, verworfen:** `llamafile` (portables Einzel-Binary auf `llama.cpp`-Basis) löst
ein Distributionsproblem, das wir bereits über Docker/Compose-Profile gelöst haben — kein
Mehrwert. `LocalAI` (OpenAI-kompatible Mehr-Backend-Wrapper-Schicht) hat dasselbe
Zusatzschicht-Problem wie Ollama, ohne dessen Ökosystemgröße auszugleichen.

### 2. Betriebsmodell: Sidecar-Härte, nicht Sidecar-Topologie 1:1

spaCy (1.14b) und der Encoder (1.14c Stufe 1) bleiben das **Härtemuster**: eigener Container,
eigenes Image, eigenes Compose-Profil, kein öffentlicher Port, `deploy.sh` startet nichts,
cgroup-Limits, eigener Kill-Switch. Die **Topologie** des LLM ist eine andere als bei spaCy.

#### 2.1 Zwei Topologien, nicht „Socket oder HTTP, egal“

| Topologie                                         | Wann                                                                                         | Transport                                                                                     | `network_mode: none` |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------- |
| **Zweiter privater Host (kanonische Produktion)** | Voranalyse §5.2; Encoder darf über das bereits gebaute `WORD_CLOUD_ENCODER_URL` mit umziehen | privates HTTP plus Credential; Bind nur intern, kein öffentliches DNAT, kein `--host 0.0.0.0` | nein (braucht Netz)  |
| **Same-Host-Sidecar (nur Labor)**                 | gedeckelte cgroup, **nicht** zusammen mit `nlp`+`encoder` auf dem 16-GB-Live-Host            | Unix-Socket (`llama-server --host /run/…sock`) analog spaCy                                   | ja                   |
| **macOS Host-npm**                                | Docker-Volume-Sockets sind für Host-Node unsichtbar (Lehre aus 1.14b)                        | Loopback-HTTP `127.0.0.1`, analog `npm run qa-summary:dev` / `WORD_CLOUD_ENCODER_URL`         | entfällt             |

`llama-server` kann Unix-Sockets (`--host` endet auf `.sock`). Das gilt nur auf **demselben**
Host. Die Produktionsannahme „zweite Box“ braucht privates HTTP.

**URL-Allowlist für den LLM-HTTP-Pfad:** nicht 1:1 die Encoder-Regel „nur IP-Literale“ (die
private DNS-Namen der Inferenzbox zerlegen würde) und nicht die heutige 8.9c-SaaS-Denylist
allein (die öffentliche DNS-Namen durchlässt). Ziel: Hostname auflösen, danach nur Loopback /
RFC1918 / Unique-Local-IPv6; SaaS-Hosts bleiben gesperrt; Token nie in der URL.

Live-Host-RAM (Kapazitätsschätzung ~10–11 GB Baseline plus spaCy 1 GB, Encoder 2 GB, PDF-Worker
1 GB) trägt **kein** zusätzliches ~4-GB-LLM. Same-Host-LLM plus `nlp` plus `encoder` ist
unzulässig.

#### 2.2 Ein Slot, ein Inflight — nicht Concurrency 1 pro Auftrag

Label- und Summary-Jobs dürfen sich **einen** `llama-server` teilen. Sie behalten getrennte
Prompts, Zod-Verträge, Queues und Cooldowns. `QA_SUMMARY_CONCURRENCY=1` und
`WORD_CLOUD_ENCODER_MAX_IN_FLIGHT=1` sind **getrennte** Zähler; zwei Host-Klicks würden sonst
zwei Requests in denselben Server schicken.

`llama-server` queued intern. Default `--parallel -1` (auto) plus `--slot-prompt-similarity`
(Default 0,10) sind für diesen Sidecar falsch.

Verbindlich:

- `--parallel 1` fest, nicht auto. `--parallel 2` verdoppelt den KV-Cache und sprengt das
  ~4-GB-Budget leicht.
- **Ein** gemeinsames Inflight über Label- **und** Summary-Adapter. Ist der Slot belegt, bekommt
  der zweite Auftrag sofort Fallback — nicht `pending` hinter einer versteckten llama.cpp-Queue.
  Vor dem POST: `GET /slots?fail_on_no_slot=1` (503 → Backpressure). Dafür muss `--slots` gesetzt
  sein; ohne den Endpunkt antwortet `llama-server` mit 501 `not_supported_error`, nicht mit 503.
  Das App-Inflight bleibt die erste Sperre. Die Slot-Sonde fängt Belegung ab, die der Node-Zähler
  nicht sieht (zweiter Prozess, Slot nach Client-Abort noch belegt).
- `--slot-prompt-similarity 0`, damit Summary-KV nicht an Label-Prompts klebt.
- Client-Abort muss den Slot freigeben. Node-Timeout ohne Abbruch auf der Engine lässt Prefill
  weiterlaufen.
- 8.9b (Gatekeeper/k-NN) liegt **nicht** auf diesem Slot.

#### 2.3 `llama-server` ist kein Drop-in für `QA_SUMMARY_INFERENCE_URL`

Der 8.9c-Adapter spricht den eigenen Vertrag `POST /summary` → `QaSummaryModelOutput`.
`llama-server` spricht `/v1/chat/completions`. Die URL auf den OpenAI-Endpunkt zu legen zerbricht
Zod, den Gemini-Helfer und die Quellenbindung.

Story 8.9d liefert einen schmalen **Node-Client** (Arbeitsname `openWeightLlmClient`): Chat-
Completions plus **pro Request** `json_schema` / GBNF. Label-Schema und Summary-Schema sind
verschieden — **kein** globales `--json-schema` am Serverprozess.

`scripts/qa-summary-dev-server.mjs` bleibt Qualitätsorakel und lokaler Extraktor, kein
Produktionspfad und keine Übersetzerschicht in Produktion.

#### 2.4 Kontext, Timeout und Promptgröße sind nicht Gemini-förmig

Qwen3-4B-Instruct-2507 hat nativ sehr großen Kontext. `--ctx-size` Default `0` lädt den
Modellwert und sprengt den KV-Cache im 4-GB-cgroup. Encoder-Timeout in Compose ist bereits
120 s, weil e5 auf CPU langsam ist. `QA_SUMMARY_TIMEOUT_MS` Default 8 s / Max 30 s ist um
Gemini Flash-Lite und den Helferabbruch 5 s vorher gebaut.

Voranalyse §4.6/§5.3 bleibt: DoD ist **nicht** „gleich Gemini unter 3–8 s“. CPU-Prefill eines
vollen 8.9c-Snapshots (`QA_SUMMARY_MAX_SOURCES` Default 20) passt in 2048 Tokens oft nicht.

Verbindlich:

- `--ctx-size` explizit 2048 oder 4096, nach gemessener KV-Größe, nie Modelldefault.
- `--n-predict` als harte Obergrenze (Richtung 256); Label-Requests setzen zusätzlich ein
  deutlich kleineres `max_tokens`.
- Getrennte Backend-Timeouts für Label- und Summary-Job; Werte erst nach Prefill-Messung auf
  der echten 8-vCPU-Box, nicht als Kopie der Gemini-Fenster.
- Slice 4 sendet dem LLM eine **kürzere, schon gerankte** Quellenliste (Richtung 8), nicht
  automatisch alle 20 Snapshot-Quellen. Das Ranking aus 8.9c Slice 3 bleibt die Auswahl.
- Slice 4 startet erst, wenn diese Messung vorliegt. 1.14c Stufe 2 (kurze Labels) ist der
  passendere erste generative Auftrag auf CPU.

#### 2.5 Fallback sitzt in der App, nicht nur im Dev-Helfer

Die extraktive 8.9c-Kurzfassung lebt heute nur in `scripts/qa-summary-dev-server.mjs`. Backend
bei Timeout/Fehler: `failed` / `stub:timeout`. ADR und Voranalyse versprechen extraktiven
Fallback als Standard.

- **Slice 4:** Extraktion in die Summary-Queue. llama-Timeout oder Backpressure → scanbare
  Bullets, nicht leere Karte. Der Gemini-Helfer bleibt dafür nicht zuständig.
- **Stufe 2:** Das LLM darf nur das **Label** ersetzen. Clustering und Mitgliedschaft bleiben
  Stufe 1 (`wordCloudSemanticCluster.ts`). LLM-Ausfall → extraktives Label, **nicht** lexikalisch
  2.x.
- Modellantworten ändern keine Cluster-Mitgliedschaft. Unbekannte IDs und quellenlose Sätze
  werden serverseitig verworfen (bestehendes `bindQaSummaryModelOutput`-Muster).

#### 2.6 Kill-Switch-Matrix

Eigener Schalter `OPEN_WEIGHT_LLM_ENABLED` (nur exakt `true`), Compose-Profil `llm`, eigenes
Image. Er wird mit keinem der vier bestehenden Schalter verwechselt oder wiederverwendet.

| Schalter                         | Ohne LLM-Prozess / Schalter aus                       |
| -------------------------------- | ----------------------------------------------------- |
| `WORD_CLOUD_SEMANTIC_ENABLED`    | Stufe 1 bleibt (Encoder + extraktive Labels)          |
| `QA_SUMMARY_ENABLED`             | Karte/Queue wie 8.9c Slices 1–3; ohne URL keine Karte |
| `NLP_ENABLED` / `QA_NLP_ENABLED` | unberührt                                             |

LLM aus darf den Themenmodus nicht abschalten und 8.9a nicht verstecken.

#### 2.7 `llama-server`-Hartflags

Mindestens, gegen die Server-Defaults:

- `--no-webui` (WebUI ist default an)
- `--slots` (sonst fehlt `GET /slots`. In älteren Builds default aus, [llama.cpp#9776](https://github.com/ggml-org/llama.cpp/pull/9776); seit [llama.cpp#15630](https://github.com/ggml-org/llama.cpp/pull/15630) default an. 8.9d darf nicht vom Image-Default abhängen.)
- `--api-key` gesetzt; Token analog `QA_SUMMARY_INFERENCE_TOKEN` / `WORD_CLOUD_ENCODER_TOKEN`
- `--reasoning off` (auch beim Instruct-GGUF; Thinking-Gewichte sprengen jedes Timeout)
- `--n-gpu-layers 0` explizit
- `--jinja` (Chat-Template; bei Qwen3 Instruct die Modellmetadaten)
- kein `--embedding`, kein `--props`, kein `--metrics` auf erreichbaren Schnittstellen
- Image-Digest pinnen, nicht `master` / ungetaggtes `ghcr.io/ggml-org/llama.cpp:server`
- GGUF als **Volume**/Ops-Artefakt, nicht wie e5-small (~100 MB) ins CI-Image backen (~2,5 GB)
- Health über `/health`, ausreichend `start_period` für CPU-Load
- Offizielles Docker-Beispiel mit `--host 0.0.0.0` und `-p 8080:8080` nicht übernehmen

### 3. Geltungsbereich

Diese Entscheidung betrifft ausschließlich die **Betreiber-seitige** Serving-Runtime für
1.14c Stufe 2 und 8.9c Slice 4. Sie berührt nicht:

- die bereits getroffene Encoder-Wahl für 1.14c Stufe 1 (`intfloat/multilingual-e5-small`, ONNX,
  eigener Sidecar) — bleibt unverändert,
- den Gemini-Dev-Helfer (`scripts/qa-summary-dev-server.mjs`) — bleibt ausschließlich lokales
  Entwicklerwerkzeug, kein Produktionspfad,
- die verworfene Bring-your-own-LLM-Option für Hosts,
- 8.9b (in-process Gatekeeper/k-NN) — kein dritter Auftrag auf dem llama.cpp-Slot,
- Freitext-Encoder-Clustering (Story 1.14d) — kein LLM-Label.

Implementierungsfolge, sobald 8.9d beauftragt ist: **Runtime-Baustein zuerst** (Image, Profil,
Flags, gemeinsames Inflight, Health, Tests ohne Modell-Download) → 1.14c Stufe 2 (kurze Labels)
→ 8.9c Slice 4 nach Prefill-Messung. Diese ADR autorisiert keine der drei Stufen von selbst.

## Performance-Steckbrief

- **Lastklasse:** performance-kritisch (ADR-0025), solange nicht durch Messung entschärft.
- **Pfadtyp:** privater Hintergrund-/On-Demand-Dienst, kein synchroner Live-Hotpath.
- **Kostenprofil:** CPU-Threads (2–4 laut Voranalyse), RAM (~4 GB Modell plus KV für den
  gepinnten Kontext, nicht für den nativen Modellkontext), Image ohne eingebettetes GGUF.
- **Skalierungsprofil:** ein Slot, ein Inflight über beide Auftragstypen. Zwei Auftragstypen
  teilen sich denselben Prozess; der zweite Job fällt sofort auf Fallback, statt in llama.cpp
  zu warten (Voranalyse §4.3, geschärft).
- **Worst Case:** beide Aufträge gleichzeitig, Slot belegt → zweiter Auftrag sofort extraktiv
  bzw. Stufe-1-Label. Prefill eines ungekürzten 20-Quellen-Prompts auf CPU reißt 8 s fast immer.
- **Entlastungsstrategie:** hartes Timeout, Abbruch vor dem Backend-Timeout, Circuit Breaker,
  Slot-503, gekürzte gerankte Promptquellen, extraktiver Fallback in der App.
- **Messstrategie:** Offline-/Notebook-Vergleich → isolierter Zwei-Server-Laborpfad (kanonisch)
  → produktionsnahe Last-/Fehler-/Security-/Privacy-/Kostenprüfung einschließlich TTFT/Prefill
  auf der echten 8-vCPU-Box (Voranalyse §6). Slice-4-DoD hängt an dieser Messung.

## Konsequenzen

### Positiv

- Kleinste sinnvolle Angriffs- und Wartungsfläche: ein MIT-Binary, ein Zweck, härtbar wie spaCy
  und Encoder, ohne deren Same-Host-Annahme zu kopieren.
- Keine Inferenzqualitäts-Einbuße gegenüber Ollama, da beide dieselbe Engine ausführen.
- Kein erzwungener Netzwerkpfad zu einer externen Modell-Registry in Produktion.
- Dieselbe Engine trägt spätere GPU-Backends (CUDA/HIP/Vulkan/Metal), falls arsnova.eu je eine
  GPU-Box einführt — kein Werkzeugwechsel für diesen Schritt nötig.
- Modellwahl (`Qwen3-4B-Instruct-2507`, Apache-2.0) aus der Voranalyse bleibt gültig und wird
  durch die aktuelle Recherche nicht in Frage gestellt.
- Bestehende 8.9c-/1.14c-Verträge bleiben die App-Grenze; `llama-server` wird dahinter
  übersetzt, nicht an die Host-UI durchgereicht.

### Negativ / Risiken

- Kein eingebauter Modell-Registry-/Pull-Komfort wie bei Ollama — Modellbezug, Checksum-Prüfung
  und Ablage müssen als expliziter Ops-Schritt dokumentiert werden (einmaliger Aufwand, passt
  zum "gepinntes Artefakt"-Prinzip aus ADR-0032).
- Kein eingebauter Multi-Model-Hotswap — irrelevant, solange arsnova.eu bewusst nur ein
  gepinntes Modell betreibt; würde sich bei künftigem Modellvergleich als Mehraufwand zeigen.
- Weniger vorgefertigte Client-Bibliotheken als im Ollama-Ökosystem — arsnova.eu braucht den
  schmalen Node-Client ohnehin, weil der App-Vertrag nicht OpenAI-native ist.
- Ein Slot für zwei Aufträge bleibt ein Betriebsrisiko. Es ist durch gemeinsames Inflight und
  sofortigen Fallback **begrenzt**, nicht verschwunden. `--parallel 2` ist dafür kein Ausweg
  im 4-GB-Budget.
- CPU-Prefill kann Slice 4 auf der 8-vCPU-Box dauerhaft unbrauchbar machen. Dann bleibt die
  extraktive Kurzfassung der Produktpfad, bis eine gesonderte GPU-Entscheidung fällt
  (Voranalyse §5.4). Das ist kein stiller SaaS-Fallback.

## Alternativen (geprüft)

- **Ollama:** verworfen als Serving-Layer für diesen Anwendungsfall. Läuft intern selbst auf
  `llama-server`, bringt aber Registry-/Auth-/Agent-/Cloud-Funktionsumfang mit, der für einen
  internen, ops-gepinnten Single-Model-Sidecar überdimensioniert ist und zusätzliche
  Audit-/Lockdown-Arbeit erzeugen würde, ohne einen Inferenzvorteil zu liefern.
- **vLLM:** verworfen für die aktuelle Inferenz-CPU-Rolle (8 vCPU/16 GB, ohne GPU); explizit für
  eine spätere GPU-Stufe vorgemerkt (Voranalyse §5.4).
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
- **`QA_SUMMARY_INFERENCE_URL` direkt auf `/v1/chat/completions`:** verworfen; der 8.9c-Vertrag
  und der Gemini-Helfer bleiben die App-Grenze.
- **Concurrency 1 je Auftragstyp ohne gemeinsamen Slot-Lock:** verworfen; erzeugt versteckte
  llama.cpp-Warteschlangen und gekoppelte Timeouts.

## Umsetzungsleitplanken

- Kanonische Produktion: zweiter privater Host, privates HTTP, Credential, kein öffentlicher
  Port. Unix-Socket nur Same-Host-Labor. macOS-Dev: Loopback-HTTP, nicht Docker-Volume-Socket.
- URL-Ziele nach Auflösung nur Loopback/RFC1918/ULA; SaaS-Hosts gesperrt; Token nicht in der URL.
- Kein LLM auf dem Live-Host neben Node/PostgreSQL/Redis, auch nicht „streng gedeckelt“ zusammen
  mit spaCy- und Encoder-Sidecar (Voranalyse §5.2, Kapazitätsschätzung).
- Eigenes Compose-Profil `llm` und eigenes Image, getrennt von `SPACY_IMAGE` /
  `WORD_CLOUD_ENCODER_IMAGE` / `ARSNOVA_IMAGE`; `deploy.sh` startet es nicht automatisch.
  Image-Digest pinnen; GGUF als Volume, nicht CI-Layer.
- `OPEN_WEIGHT_LLM_ENABLED` ist der fünfte Kill-Switch; siehe Matrix in §2.6.
- `--parallel 1`, `--ctx-size` gepinnt, `--n-predict` gedeckelt, `--no-webui`, `--slots`,
  `--api-key`, `--reasoning off`, `--n-gpu-layers 0`, `--slot-prompt-similarity 0`. Ein
  gemeinsames Inflight; `GET /slots?fail_on_no_slot=1` vor dem POST (ohne `--slots`: 501, nicht
  503); Abbruch gibt den Slot frei.
- Node-Client übersetzt App-Verträge nach Chat-Completions; `json_schema` **pro Request**.
  `QA_SUMMARY_INFERENCE_URL` zeigt nicht auf `/v1/chat/completions`.
- 1.14c Stufe 2 und 8.9c Slice 4 behalten getrennte Prompts, Zod-Verträge, Queues und Cooldowns;
  diese ADR autorisiert **keine** Zusammenlegung der beiden Aufträge und **kein** 8.9b auf dem
  Slot.
- Stufe-2-Ausfall → extraktives Label (Stufe 1 bleibt). Slice-4-Ausfall → extraktive Bullets in
  der Queue. LLM ändert keine Mitgliedschaft.
- Slice 4 erst nach Prefill-Messung; DoD nicht „Gemini unter 8 s“. LLM-Prompt nutzt das
  bestehende Ranking, nicht den vollen 20er-Snapshot.
- Tests analog `test:spacy-sidecar` / `test:wordcloud-encoder`: ohne Modell-Download, kein
  öffentlicher Port, Ressourcenlimits, Hotpath-Isolation, Lastfall „beide Aufträge gleichzeitig“.
- Freigabestufen unverändert: Offline-Vergleich → isolierter Zwei-Server-Laborpfad →
  produktionsnahe Last-/Fehler-/Security-/Privacy-/Kostenprüfung, erst danach bewusste
  Produktivaktivierung.
- Diese ADR autorisiert keine Implementierung; sie legt Runtime und Leitplanken fest, sobald
  Story 8.9d, 1.14c Stufe 2 oder 8.9c Slice 4 beauftragt werden.

---

**Referenzen:** [WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md](../../implementation/WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md),
[ADR-0032](0032-optional-nlp-cascade-for-qa-moderation-signals.md),
[ADR-0025](0025-treat-future-extensions-as-performance-critical-until-proven-otherwise.md),
[ADR-0026](0026-prioritize-performance-hotpaths-and-de-escalate-telemetry-side-load.md),
[word-cloud-semantic.md](../../features/word-cloud-semantic.md), [qa-summary.md](../../features/qa-summary.md),
[capacity-estimate-16gb-16cores.md](../../capacity-estimate-16gb-16cores.md),
[github.com/ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp) (`tools/server/README.md`),
[github.com/ollama/ollama](https://github.com/ollama/ollama),
[github.com/vllm-project/vllm](https://github.com/vllm-project/vllm),
[github.com/huggingface/text-generation-inference](https://github.com/huggingface/text-generation-inference).
