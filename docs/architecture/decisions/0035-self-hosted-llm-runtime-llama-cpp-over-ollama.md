<!-- markdownlint-disable MD013 -->

# ADR-0035: Selbstgehosteter Open-Weight-LLM-Server — `llama.cpp` (`llama-server`) statt Ollama

**Status:** Accepted
**Datum:** 2026-08-22
**Entscheider:** Projektteam (Architekturentscheid auf Basis der 1.14c-Voranalyse, PO-Auftrag 2026-08-22)
**Letzter Repo-Abgleich:** 2026-10-17 (Runtime R und alle drei Consumer `topic_label` inkl. Multi-Cluster-Batching V2, `qa_summary` V2 `qa-summary-model-output-v3` und `learning_objectives` implementiert und auf dem privaten 8-vCPU-Produktionshost real vermessen; PO-Entscheidung: `topic_label` gilt für Host-Q&A und Host-Freitext)
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
- Drei fachlich getrennte Aufträge (Cluster-Label, Summary-Bullet, Lernzielableitung) sollen sich **eine**
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

`llama-server`-Flags (WebUI, Slots, `--host …sock`, `--ctx-size`, `--parallel`, Schema pro Request) gegen die aktuelle Server-README von `ggml-org/llama.cpp` geprüft (2026-08-22); das tatsächlich funktionierende b10524-Wire-Format wurde am 2026-10-05 mit dem gepinnten Modell nachgeprüft.

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

Label-, Summary- und Lernziel-Jobs dürfen sich **einen** `llama-server` teilen. Sie behalten getrennte
Prompts, Zod-Verträge, Queues und Cooldowns. `QA_SUMMARY_CONCURRENCY=1` und
`WORD_CLOUD_ENCODER_MAX_IN_FLIGHT=1` sind **getrennte** Zähler; zwei Host-Klicks würden sonst
zwei Requests in denselben Server schicken.

`llama-server` queued intern. Default `--parallel -1` (auto) plus `--slot-prompt-similarity`
(Default 0,10) sind für diesen Sidecar falsch.

Verbindlich:

- `--parallel 1` fest, nicht auto. `--parallel 2` verdoppelt den KV-Cache und sprengt das
  ~4-GB-Budget leicht.
- **Ein** gemeinsames Inflight über Label-, Summary- und Lernzieladapter. Ist der Slot belegt,
  bekommen Live-Aufträge sofort Fallback und Lernzielaufträge einen manuellen Retry-Zustand —
  nicht `pending` hinter einer versteckten llama.cpp-Queue.
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

Story 8.9d liefert einen schmalen **Node-Client** (`openWeightLlmClient`): Chat-Completions
plus **pro Request** schemaerzwungenes JSON/GBNF. Label-, Summary- und Lernzielschema sind
verschieden — **kein** globales `--json-schema` am Serverprozess. Der Realtest mit b10524
zeigte, dass `type: "json_schema"` plus `schema` HTTP 200 liefern kann, ohne die Grammatik
anzuwenden. Verbindlich ist daher das ebenfalls dokumentierte und real geprüfte
`type: "json_object"` plus `schema`; die nachgelagerte Zod-Prüfung bleibt Pflicht.

`scripts/qa-summary-dev-server.mjs` bleibt Qualitätsorakel und lokaler Extraktor, kein
Produktionspfad und keine Übersetzerschicht in Produktion.

**Umsetzungsabgleich #456 Slice 7:** Summary V2 verwendet den Node-Client direkt und bindet
`qa-summary-context-v2`, `qa-summary-model-output-v3`,
`moderation-prompt-context-v1`, die technische Instruktionsversion und das
Bedeutungslexikon ausdrücklich. Die Runtime erhält genau zwei Systemnachrichten
(Instruktion und Definition) sowie als Usernachricht ausschließlich das kanonische JSON
des gepackten Domainkontexts. Der Legacy-HTTP-Adapter bleibt als explizit ausgehandelter
`legacy-text`-Modus erhalten; `QA_SUMMARY_INFERENCE_URL` zeigt weiterhin nicht auf llama.cpp.

#### 2.4 Kontext, Timeout und Promptgröße sind nicht Gemini-förmig

Qwen3-4B-Instruct-2507 hat nativ sehr großen Kontext. `--ctx-size` Default `0` lädt den
Modellwert und sprengt den KV-Cache im 4-GB-cgroup. Encoder-Timeout in Compose ist bereits
120 s, weil e5 auf CPU langsam ist. `QA_SUMMARY_TIMEOUT_MS` Default 90 s / Max 300 s ist an
`OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS` und CPU-Prefill unter dem 8k-Packingprofil angeglichen
(früher 8 s / 30 s aus der Gemini-Flash-Lite-Ära).

Voranalyse §4.6/§5.3 bleibt: DoD ist **nicht** „gleich Gemini unter 3–8 s“. CPU-Prefill eines
vollen 8.9c-Snapshots (`QA_SUMMARY_MAX_SOURCES` Default 20) passt in 2048 Tokens oft nicht.

Verbindlich:

- `--ctx-size` explizit setzen (aktuell 8192), nach gemessener KV-Größe und unter dem
  praxisnahen 8k-Arbeitsfenster von Qwen3-4B Q4; nie Modelldefault (nativ 32k / RoPE bis 128k).
- `--n-predict` als harte Obergrenze (Richtung 256); Label-Requests setzen zusätzlich ein
  deutlich kleineres `max_tokens`.
- Getrennte Backend-Timeouts für Label-, Summary- und Lernziel-Job; Werte erst nach Prefill-Messung auf
  der echten 8-vCPU-Box, nicht als Kopie der Gemini-Fenster.
- Der Summary-V2-Packer sendet eine **deterministisch ausgewählte, dependency-geschlossene**
  Teilmenge, nicht automatisch alle 20 Legacy-Snapshot-Quellen.
- Das feste Implementierungsprofil verwendet 8.192, 640 Antwortreserve und 128
  Sicherheitsmarge. Instruktion und Definition belegen konservativ weitere 314 und 203
  UTF-8-Einheiten; für das kanonische Kontext-JSON bleiben höchstens 6.907.
- Der reichhaltige Referenzkontext kann trotz 8k noch an Basismetadaten scheitern. Der Packer
  degradiert dann sichtbar auf eine Q&A-Textbaseline bzw. Force-Fit-Mindestbelege. Das ist
  kein Nachweis eines nutzbaren reichhaltigen Vollkontextprofils.
- Eine Produktivaktivierung startet erst, wenn die Messung auf der vorgesehenen CPU-Box
  und eine ausdrückliche Profilentscheidung vorliegen. 1.14c Stufe 2 (kurze Labels) bleibt
  der passendere erste generative Auftrag auf CPU.

#### 2.5 Fallback sitzt in der App, nicht nur im Dev-Helfer

Der extraktive Fallback ist mit #456 Slice 7 in der Backend-Queue umgesetzt. Der
Entwicklungshilfsserver ist dafür nicht mehr erforderlich.

- **Summary V2:** llama-Timeout, belegter Slot, ungültige Antwort, fehlender Adapter oder
  Backpressure → quellengebundene extraktive Belege mit typisiertem Fallback, nicht leere
  Karte. Quellenänderung während des Laufs verwirft die alte Modellantwort; Rechteverlust
  liefert keine alten Quellen.
- **Stufe 2:** Das LLM darf nur das **Label** ersetzen. Clustering und Mitgliedschaft bleiben
  Stufe 1 (`wordCloudSemanticCluster.ts`). LLM-Ausfall → extraktives Label, **nicht** lexikalisch
  2.x.
- Modellantworten ändern keine Cluster-Mitgliedschaft. Unbekannte IDs und quellenlose Sätze
  werden serverseitig verworfen (bestehendes `bindQaSummaryModelOutput`-Muster).

#### 2.6 Kill-Switch-Matrix

Eigener Schalter `OPEN_WEIGHT_LLM_ENABLED` (nur exakt `true`), Compose-Profil `llm`, eigenes
Image. Er wird mit keinem der vier bestehenden Schalter verwechselt oder wiederverwendet.

| Schalter                         | Ohne LLM-Prozess / Schalter aus                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `WORD_CLOUD_SEMANTIC_ENABLED`    | Stufe 1 bleibt (Encoder + extraktive Labels)                                         |
| `QA_SUMMARY_ENABLED`             | Summary bleibt aus, wenn dieses Produktflag aus ist                                  |
| `OPEN_WEIGHT_LLM_ENABLED`        | Bei aktiviertem Summary-Produktflag bleibt der lokale extraktive V2-Fallback nutzbar |
| `NLP_ENABLED` / `QA_NLP_ENABLED` | unberührt                                                                            |

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
- Freitext-Encoder-Clustering (Story 1.14d) als eigener Modellauftrag. Die Mitgliedschaft bleibt der Encoder. Seit der Produktentscheidung vom 2026-10-13 benennt derselbe Auftrag `topic_label` auch Host-Freitext-Cluster; das ist kein zweiter Pfad und keine Änderung dieser Runtime-Wahl.

Implementierungsfolge: **Runtime-Baustein zuerst** (Image, Profil,
Flags, gemeinsames Inflight, Health, Tests ohne Modell-Download) → 1.14c Stufe 2 (kurze Labels)
→ 8.9c Slice 4 nach Prefill-Messung. Runtime R sowie der ausdrücklich gestartete
Lernziel-Consumer und der Summary-V2-Consumer sind umgesetzt; diese ADR autorisiert weiterhin
keine allgemeine Produktivfreigabe. Label benötigt seine eigene Ausbaustufe. Der
Lernzielpfad erzeugte am 12.10.2026 auf dem privaten Produktionshost für das
vollständige Demo-Quiz zehn Entwürfe; seine vollständige Mess- und Qualitätsabnahme
bleibt offen. Summary V2 benötigt weiterhin einen realen Consumer-/Hardwarelauf;
das reichhaltige 8.192-Summaryprofil ist derzeit nicht belegt.

## Performance-Steckbrief

- **Lastklasse:** performance-kritisch (ADR-0025), solange nicht durch Messung entschärft.
- **Pfadtyp:** privater Hintergrund-/On-Demand-Dienst, kein synchroner Live-Hotpath.
- **Kostenprofil:** CPU-Threads (4 im Same-Host-Labor `docker-compose.yml`/`docker-compose.prod.yml`, bis zu 8 auf dem dedizierten Zweit-Host `docker-compose.llm.yml`), RAM (5 GiB im Labor bzw. 8 GiB RAM / 10 GiB RAM+Swap auf dem Zweit-Host plus KV für den gepinnten 8.192-Kontext), Image ohne eingebettetes GGUF.
- **Skalierungsprofil:** ein Slot, ein Inflight über drei Auftragstypen. Drei Auftragstypen
  teilen sich denselben Prozess; ein konkurrierender Job fällt sofort auf Fallback beziehungsweise manuellen Retry, statt in llama.cpp
  zu warten (Voranalyse §4.3, geschärft).
- **Worst Case:** drei Aufträge gleichzeitig, Slot belegt → Live-Aufträge sofort extraktiv
  beziehungsweise Stufe-1-Label, Lernzielauftrag manueller Retry. Prefill eines ungekürzten
  20-Quellen-Prompts auf CPU reißt 8 s fast immer.
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
- Ein Slot für drei Aufträge bleibt ein Betriebsrisiko. Es ist durch gemeinsames Inflight und
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
- URL-Ziele nach Auflösung nur Loopback/RFC1918/ULA; DNS-Auflösung unterliegt demselben Caller-Abbruch und Auftrags-Timeout wie der Request; SaaS-Hosts gesperrt; Token nicht in der URL. Das einzelne Credential verwendet ausschließlich `A–Z`, `a–z`, `0–9`, `.`, `_`, `~`, `-`, damit llama.cpp es nicht als CSV-Schlüsselliste zerlegt.
- Kein LLM auf dem Live-Host neben Node/PostgreSQL/Redis, auch nicht „streng gedeckelt“ zusammen
  mit spaCy- und Encoder-Sidecar (Voranalyse §5.2, Kapazitätsschätzung).
- Eigenes Compose-Profil `llm` und eigenes Image, getrennt von `SPACY_IMAGE` /
  `WORD_CLOUD_ENCODER_IMAGE` / `ARSNOVA_IMAGE`; `deploy.sh` startet es nicht automatisch.
  Image-Digest pinnen; GGUF als Volume, nicht CI-Layer. Der Runtime-Container erhält ausschließlich
  seine eigenen Variablen und insbesondere keine App-, Datenbank-, Admin- oder Capability-Secrets.
- `OPEN_WEIGHT_LLM_ENABLED` ist der fünfte Kill-Switch; siehe Matrix in §2.6.
- `--parallel 1`, `--ctx-size` gepinnt, `--n-predict` gedeckelt, `--no-webui`, `--slots`,
  `--api-key`, `--reasoning off`, `--n-gpu-layers 0`, `--slot-prompt-similarity 0`. Ein
  gemeinsames Inflight; `GET /slots?fail_on_no_slot=1` vor dem POST (ohne `--slots`: 501, nicht
  503); Abbruch gibt den Slot frei.
- Node-Client übersetzt App-Verträge nach Chat-Completions; `json_object` plus `schema`
  **pro Request**, danach strikte Zod- und Referenzprüfung.
  `QA_SUMMARY_INFERENCE_URL` zeigt nicht auf `/v1/chat/completions`.
- 1.14c Stufe 2 und 8.9c Slice 4 behalten getrennte Prompts, Zod-Verträge, Queues und Cooldowns;
  diese ADR autorisiert **keine** Zusammenlegung der beiden Aufträge und **kein** 8.9b auf dem
  Slot.
- Stufe-2-Ausfall → extraktives Label (Stufe 1 bleibt). Slice-4-Ausfall → extraktive Bullets in
  der Queue. LLM ändert keine Mitgliedschaft.
- Produktivaktivierung erst nach Prefill-/Speichermessung; DoD nicht „Gemini unter 8 s“.
  Summary V2 nutzt den deterministischen Packer, nicht den vollen 20er-Legacy-Snapshot.
- Tests analog `test:spacy-sidecar` / `test:wordcloud-encoder`: ohne Modell-Download, kein
  öffentlicher Port, Ressourcenlimits, Hotpath-Isolation, Lastfall „drei Aufträge gleichzeitig“.
- Freigabestufen unverändert: Offline-Vergleich → isolierter Zwei-Server-Laborpfad →
  produktionsnahe Last-/Fehler-/Security-/Privacy-/Kostenprüfung, erst danach bewusste
  Produktivaktivierung.
- Runtime R setzt diese Leitplanken technisch um. Die ADR autorisiert weder die Aktivierung
  noch den offenen Label-Consumer aus 1.14c Stufe 2. Lernziel- und Summary-V2-Consumer sind
  implementiert, bleiben aber bis zu realen Consumer-/Hardwaremessungen und einer getrennten
  Betreiberentscheidung produktiv aus.

---

**Referenzen:** [WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md](../../implementation/WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md),
[ADR-0032](0032-optional-nlp-cascade-for-qa-moderation-signals.md),
[ADR-0025](0025-treat-future-extensions-as-performance-critical-until-proven-otherwise.md),
[ADR-0026](0026-prioritize-performance-hotpaths-and-de-escalate-telemetry-side-load.md),
[word-cloud-semantic.md](../../features/word-cloud-semantic.md), [qa-summary.md](../../features/qa-summary.md),
[open-weight-llm-runtime.md](../../features/open-weight-llm-runtime.md),
[capacity-estimate-16gb-16cores.md](../../capacity-estimate-16gb-16cores.md),
[github.com/ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp) (`tools/server/README.md`),
[github.com/ollama/ollama](https://github.com/ollama/ollama),
[github.com/vllm-project/vllm](https://github.com/vllm-project/vllm),
[github.com/huggingface/text-generation-inference](https://github.com/huggingface/text-generation-inference).

## Ergänzung 2026-09-22: Runtime-Voraussetzung für Issue #456

**Status:** Runtime R am 2026-10-05 technisch implementiert und lokal mit echtem kurzem Labelauftrag geprüft; Lernziel- und Summary-V2-Consumer implementiert, aber noch keine Produktivaktivierung oder reale Consumer-/Slice-8-Betriebsfreigabe.
[Issue #456](https://github.com/kqc-real/arsnova.eu/issues/456) erweitert den bisherigen
Geltungsbereich (Labels und Summary) um einen dritten Auftrag: **Lernzielableitung**.
Frühere Aussagen über zwei Aufträge beschreiben den bisherigen Scope; die übrigen
Betriebsleitplanken bleiben verbindlich.

### Runtime-PR R und Abnahme

Story 8.9d liefert die gemeinsame Runtime in einem separaten **Runtime-PR R**.
Die Kontext-Slices 1–4 aus #456 können ohne Modell umgesetzt werden. **Vor Slice 5**
muss R implementiert und technisch abgenommen sein.
HTTP-Adapter, Encoder und Gemini-Dev-Helfer ersetzen diese Abnahme nicht.

R umfasst Image/Compose-Profil, gepinntes GGUF, privaten authentisierten Transport,
Node-Übersetzer mit Schema pro Auftrag, gemeinsamen Slot-Schutz, Health, Abbruch,
Timeout und Circuit Breaker. Modellfreie Vertrags-/Isolationstests und ein realer lokaler
Lauf mit Modell-/Image-Digest, Hardware, Tokenumfang, Prefill/TTFT, Laufzeit und Speicher
sind nachzuweisen. Produktivaktivierung bleibt eine separate Betreiberentscheidung.

R enthält bereits versionierte Shared-Ein-/Ausgabeschemas, Auftragserkennung und
Adapterübersetzung für **Label, Summary und Lernzielableitung**. Dies umfasst technische
Vertragstests für gültige und schemainkompatible Antworten sowie unzulässige Referenzen.
Lernziel-Fixtures reichen für diese technische Prüfung. Fachlicher Ableitungsprompt,
Lebenszyklus und Host-UI sind in #456 Slice 5 umgesetzt; reale Ableitungsqualität und
Zielhostmessung bleiben Teil der kombinierten Slice-8-Abnahme.

Die Slot-Abnahme prüft alle drei Auftragspaarungen in beiden Belegungsreihenfolgen,
drei gleichzeitige Anfragen und die Freigabe nach Abbruch/Timeout jedes Auftragstyps.
Es läuft höchstens ein Modellaufruf; Live-Aufträge erhalten ihren Fallback und
Lernzielaufträge einen typisierten Belegt-Zustand für manuellen Retry.

### Lernzielauftrag auf derselben Runtime

- Bewusste Host-Aktion in der Quizvorbereitung; eigener versionierter Vertrag, Prompt,
  Tokenbudget und Timeout. Kein automatischer Aufruf bei Vote, Summary oder Quizwechsel.
- Derselbe globale Slot wie für Labels und Summary; kein zweiter Server, keine erhöhte
  Parallelität und weiterhin kein 8.9b-Auftrag auf diesem Slot.
- Slot belegt: Ableitung startet nicht; verständlicher Zustand mit manuellem Retry.
  Keine interne Modellwarteschlange und keine erfundenen extraktiven Lernziele.
- Laufende Ableitung ist abbrechbar; Abbruch/Timeout gibt den Slot tatsächlich frei.
  Keine automatische Präemption. Live-Aufträge nutzen bei belegtem Slot ihren
  definierten Label-/Summary-Fallback.
- Bestätigte/manuelle Ziele bleiben bei Fehler oder erneuter Ableitung erhalten.
- Bewusst bereitgestellte Lösungen sind im Vorbereitungsauftrag zulässig; der
  Live-Kontext übernimmt nur zulässige Ziele/Referenzen und wahrt Freigabegrenzen.

### Messprofil und Rollout

8.192 Kontexttokens und Qwen3-4B-Instruct-2507 Q4_K_M sind das aktuelle Laufzeit-/Packing-Profil
(unter dem praxisnahen 8k-Arbeitsfenster; nativ 32k wird nicht als Default geladen).
Keine Eignungsgarantie für den reicheren Modellkontext. Instruktionen, Metadaten,
Quellen, Antwort- und Sicherheitsreserve gemeinsam budgetieren. „Richtung acht Quellen“
ist keine feste neue Quellenzahl.

Kurze Labels bleiben der erste generative Betriebsnachweis. Lernzielableitung und
angereicherte Summary benötigen eigene Messungen. Die produktionsnahe 8-vCPU-Prefill-Abnahme
der Summary bleibt Voraussetzung für 8.9c Slice 4 und die Gesamt-/Betriebsabnahme von #456;
der lokale Lauf für R ersetzt sie nicht. Kein stilles Hochsetzen auf Modelldefault (32k/128k)
oder GPU-/SaaS-Wechsel. Bei fehlender Eignung bleibt der betreffende generative Pfad
deaktiviert und seine Abnahme offen; Kompass, extraktive Labels und manuelle Ziele bleiben nutzbar.

Der integrierte Summary-V2-Packer bestätigt die Budgetgrenze konkret: Wenn der reichhaltige
Referenzkontext nicht passt, wird kontrolliert die ausgewiesene Q&A-Textbaseline bzw. ein
Force-Fit-Mindestbeleg gepackt. Für `qa_summary` V2 und `learning_objectives` stand in der
Slice-8-Integration keine reale Zielruntime zur Verfügung. Beide Betriebsnachweise bleiben
offen; Details stehen in
[Issue #456 – Slice-8-Abnahme](../../implementation/ISSUE-456-SLICE-8-ABNAHME.md).

Der finale Moderationsprompt bleibt Folgearbeit; der Lernzielauftrag gehört zu #456.
