<!-- markdownlint-disable MD013 MD060 -->

# Moderationskompass 8.9a–8.9d als Lehr- und Praktikumsobjekt

**Zielgruppe:** Lehrende der Bachelormodule Statistik, Data Analytics und Big Data sowie Cloud Computing  
**Stand:** 2026-09-08  
**Produktbasis:** [Storys 8.9a–8.9d](../../Backlog.md) · [8.9a](../features/moderation-compass.md) · [8.9b](../features/qa-nlp-moderation.md) · [8.9c](../features/qa-summary.md) · [ADR-0035 / 8.9d](../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md)  
**Praktika:** [Data Analytics und NLP](../praktikum/PRAKTIKUM-DATA-ANALYTICS.md) · [Cloud Computing, 36 UE](./BACHELOR-VORLESUNG-CLOUD-COMPUTING-36-UE-PRAKTIKUM.md)

## 1. Verbindlicher Projektstand

| Story    | Rolle im Gesamtsystem                                                         | Stand                                                                                       | Didaktische Grenze                                                     |
| -------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **8.9a** | deterministischer, quellenbelegter Moderationskompass                         | umgesetzt                                                                                   | keine NLP-/LLM-Inferenz                                                |
| **8.9b** | asynchrone Q&A-Klassifikation mit Hash-/n-Gramm-Naive-Bayes und k-NN-Fallback | umgesetzt; Kill-Switch produktiv default aus                                                | kein Transformer und kein Auftrag auf dem LLM-Slot                     |
| **8.9c** | on-demand, schema- und quellengebundene Moderationszusammenfassung            | Vertrag, Host-UI, Snapshot-Ranking, Queue und privater Adapter im Repo; echtes Modell offen | Slice 4 folgt erst nach 8.9d und Prefill-Messung                       |
| **8.9d** | private Open-Weight-LLM-Runtime für 1.14c Stufe 2 und 8.9c Slice 4            | geplant; Runtime durch ADR-0035 festgelegt, nicht implementiert                             | kein LLM auf dem Live-Host, kein öffentlicher Port, kein SaaS-Fallback |

8.9d entscheidet nach ADR-0035 über die Serving-Runtime `llama.cpp`/`llama-server`, nicht über eine automatische Produktivfreigabe. Kanonische Produktion ist ein zweiter privater Host. Label- und Summary-Auftrag teilen höchstens einen Server-Slot, behalten aber getrennte Prompts, Zod-Verträge, Queues, Timeouts und Fallbacks. 8.9b bleibt davon unabhängig.

## 2. Gemeinsame Lehrdramaturgie

Die Storyfolge bildet eine kontrollierte Steigerung der Systemkomplexität:

1. **8.9a:** erklärbare Regeln ohne neue Infrastruktur,
2. **8.9b:** statistische Textklassifikation mit asynchroner CPU-Verarbeitung,
3. **8.9c:** quellengebundener generativer Vertrag mit Validierung und Fallback,
4. **8.9d:** privates Model Serving mit Ressourcen-, Sicherheits- und Kostenentscheidung.

In allen Modulen gilt: 8.9d ist eine zu prüfende Hypothese über zusätzlichen Nutzen, kein vorweggenommener Qualitätsgewinn. Der Vergleich muss mindestens 8.9a als deterministische Basis und eine nicht generative Alternative enthalten.

## 3. Bachelor-Modul Statistik

### 3.1 Methoden, Berechnungen und Demonstrationen

| Gegenstand              | Formel oder Verfahren                                        | Demonstration mit 8.9a–d                                |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| Lage und Streuung       | Mittelwert, Median, Varianz, Standardabweichung, Quantile    | Quiz-, Latenz- und Token-Durchsatzverteilungen          |
| Anteilswerte            | \(\hat p=x/n\), Konfidenzintervalle                          | Zustimmung, Coverage, Fehler- und Fallback-Rate         |
| Kontroversität          | \(K=2\min(U,D)/(U+D+C)\)                                     | kleine und große Sitzungen vergleichen                  |
| Klassifikation          | Konfusionsmatrix, Precision, Recall, Macro-F1                | 8.9b gegen LLM-Variante aus 8.9d                        |
| Kalibrierung            | Reliability Diagram, Brier Score, ECE                        | Konfidenzwerte der Kaskaden vergleichen                 |
| Versuchsplanung         | randomisierte Reihenfolge, Messwiederholung, Blockbildung    | gleiche Moderationsfälle mit 8.9a, 8.9b und 8.9c/d      |
| Inferenz                | Konfidenzintervall, Bootstrap, gepaarter Test                | Differenz von Qualität, TTFT und Gesamtzeit             |
| Effektgröße             | Cohen-\(d\), Cliff’s Delta oder rangbasierte Effektgröße     | CPU- gegen GPU- oder extraktiv gegen generativ          |
| Interrater-Reliabilität | Cohen-\(\kappa\), Fleiss-\(\kappa\), Krippendorff-\(\alpha\) | menschliche Bewertung von Quellentreue und Nützlichkeit |
| Survival-/Timeoutsicht  | Anteil fristgerecht abgeschlossener Jobs                     | 8.9d unter verschiedenen Promptgrößen                   |

Für die Modellgüte einer Klasse \(c\):

\[
\operatorname{Precision}_c=\frac{TP_c}{TP_c+FP_c},
\qquad
\operatorname{Recall}_c=\frac{TP_c}{TP_c+FN_c},
\]

\[
F_{1,c}
=

2\frac{\operatorname{Precision}_c\operatorname{Recall}_c}
{\operatorname{Precision}_c+\operatorname{Recall}_c}.
\]

Für einen gepaarten Vergleich von 8.9c extraktiv und 8.9c/d generativ ist nicht nur der Mittelwert, sondern die Verteilung der Differenzen

\[
d_i=x_{i,\mathrm{LLM}}-x_{i,\mathrm{Fallback}}
\]

zu analysieren. Wegen schiefer Latenzen sind Median, Bootstrap-Konfidenzintervall oder ein rangbasierter Test häufig angemessener als ein ungeprüfter t-Test.

### 3.2 Geeignete Studienprojekte und Referate

- **TTFT und Token-Durchsatz:** Verteilungen, Ausreißer, p95/p99 und Bootstrap-Intervalle auf der vorgesehenen 8-vCPU-Inferenzbox.
- **Promptgröße als Einflussfaktor:** faktorieller Versuch mit Quellenzahl, Kontextgröße und Ausgabegrenze.
- **Quellentreue:** menschliche Annotation mit Interrater-Reliabilität und Konfidenzintervallen.
- **Fallback als statistische Auswahl:** Bias untersuchen, weil nur schwierige oder langsame Fälle in den Fallback gelangen.
- **Praktische Signifikanz:** Qualitätsgewinn des LLM gegen zusätzliche Wartezeit und Kosten abwägen.
- **CPU versus spätere GPU-Stufe:** Hypothesentest und Effektgröße statt Einzelbenchmark.
- **Timeout-Zensierung:** abgeschlossene und abgebrochene Inferenzjobs gemeinsam auswerten.
- **Drift:** Stabilität von Qualität und Laufzeit über Modell-, Prompt- und Runtimeversionen.

## 4. Bachelor-Modul Data Analytics und Big Data

### 4.1 Methoden, Verfahren und Techniken

| Analyseebene         | 8.9a–d als Demonstrationsobjekt                                               |
| -------------------- | ----------------------------------------------------------------------------- |
| Datenaufnahme        | Q&A-, Vote-, Quiz-, Feedback-, Queue- und Inferenzereignisse                  |
| Datenmodellierung    | gemeinsame Fakten mit Session-, Zeit-, Modell-, Prompt- und Hardwaredimension |
| Feature Engineering  | Normalisierung, n-Gramme, Hashing, Embeddings und Prompt-Snapshots            |
| Batch Analytics      | Modell- und Promptversionen über reproduzierbare Korpora vergleichen          |
| Stream Analytics     | Queue-Länge, Ankunftsrate, Durchsatz, Timeout und Backpressure                |
| Predictive Analytics | 8.9b-Klassifikation, Unsicherheit und Selective Classification                |
| Generative Analytics | 8.9c-Ausgabe auf 8.9d-Runtime mit Quellenbindung                              |
| Data Quality         | Dubletten, fehlende Quellen, Sprachslices, Labelrauschen und Domain Shift     |
| MLOps Analytics      | Modellversion, Laufzeit, Fallback, Drift und Rollbackindikatoren              |
| FinOps Analytics     | Qualität-Latenz-Kosten-Paretofront für CPU, GPU und Managed Alternative       |

Ein gemeinsames analytisches Ereignisschema sollte mindestens enthalten:

```text
timestamp, sessionHash, jobType, modelVersion, promptVersion,
sourceCount, inputTokens, outputTokens, queueWaitMs, ttftMs,
inferenceMs, status, fallbackReason, qualitySlice
```

Personen-, Token-, IP-, Nickname- und Klartext-Sessiondaten gehören nicht in diesen Telemetriepfad.

Die Kosten pro 1.000 erfolgreiche Ergebnisse können als

\[
C_{1000}
=

\frac{C_{\mathrm{fix}}+C_{\mathrm{compute}}+C_{\mathrm{storage}}+C_{\mathrm{egress}}}
{N_{\mathrm{ready}}}
\cdot 1000
\]

berechnet werden. Als Mehrzielproblem ist eine Variante nur dann dominant, wenn keine andere zugleich günstiger, schneller und qualitativ mindestens gleichwertig ist.

### 4.2 Geeignete Studienprojekte und Referate

- **Forum-Korpus-Pipeline:** lizenzierte Stack-Exchange-, Wikimedia- oder Civil-Comments-Daten in ein anonymisiertes ARSnova-Replay überführen.
- **Lambda-/Kappa-Vergleich:** Batchauswertung und Live-Telemetrie auf identische Kennzahlen prüfen.
- **Data Lakehouse:** Rohereignisse, bereinigte Fakten und aggregierte Lehr-Dashboards in Bronze/Silver/Gold strukturieren.
- **Prompt- und Model Lineage:** jede Kennzahl auf Daten-, Schema-, Prompt-, Modell- und Runtimeversion zurückführen.
- **Paretoanalyse:** Qualität, p95-Latenz, Energie und Kosten von 8.9b, extraktivem 8.9c und 8.9d vergleichen.
- **Anomalieerkennung:** Queue-, Timeout- oder Fallback-Anstiege erkennen, ohne Inhaltsdaten zu speichern.
- **Domain Shift:** Hörsaalfragen gegen Nachrichten-, Technik- und Wikipedia-Diskussionen evaluieren.
- **Sampling Bias:** Einfluss des 8.9c-Snapshot-Rankings und der gekürzten 8.9d-Quellenliste analysieren.
- **Approximate Analytics:** skalierbare Quantile oder Stichproben gegen exakte Berechnungen prüfen.
- **Big-Data-Grenze:** zeigen, welche Probleme aus Volume, Velocity, Variety und Veracity entstehen und welche lediglich normale Anwendungsanalyse sind.

## 5. Bachelor-Modul Cloud Computing

### 5.1 Methoden, Berechnungen und Demonstrationen

| Cloud-Thema          | Demonstration mit 8.9a–d                                                     |
| -------------------- | ---------------------------------------------------------------------------- |
| Servicegrenzen       | Live-App, Encoder und 8.9d-Inferenzrolle trennen                             |
| Private/Hybrid Cloud | privates HTTP zur zweiten Inferenzbox; kein öffentlicher Modellport          |
| Container und IaC    | eigenes Image und Compose-Profil `llm`; GGUF als Ops-Artefakt                |
| Queueing             | getrennte App-Queues, aber ein gemeinsames Inflight auf dem LLM-Slot         |
| Backpressure         | Slot-Sonde liefert bei Belegung 503; sofortiger Fallback                     |
| Resilienz            | Kill-Switch, Timeout, Abort, Circuit Breaker und extraktiver Fallback        |
| Security             | API-Key, URL-Allowlist, kein WebUI, gepinnter Image-Digest                   |
| Capacity Planning    | Threads, RAM, KV-Cache, Kontextgröße und `n-predict`                         |
| Observability        | Queue-Wartezeit, TTFT, Prefill, Tokens/s, Fehler und Fallback                |
| FinOps               | zweiter CPU-Host gegen GPU- oder Managed-Variante                            |
| SLO                  | Kernfunktion 8.9a getrennt von optionalem KI-SLO bewerten                    |
| Rollout              | Offline → Zwei-Server-Labor → produktionsnahe Abnahme → bewusste Aktivierung |

Für \(c\) Worker, Ankunftsrate \(\lambda\) und Bedienrate \(\mu\):

\[
\rho=\frac{\lambda}{c\mu}<1.
\]

Die Mindestzahl von Worker-Slots bei Zielauslastung \(\rho_{\mathrm{Ziel}}\) ist näherungsweise

\[
c_{\min}
=

\left\lceil
\frac{\lambda}{\mu\rho_{\mathrm{Ziel}}}
\right\rceil.
\]

Für 8.9d ist jedoch zunächst bewusst \(c=1\) vorgesehen: `--parallel 1` begrenzt den KV-Cache. Skalierung darf daher nicht durch unkontrolliertes Hochsetzen der Parallelität erfolgen, sondern verlangt eine neue Ressourcen- und Architekturentscheidung.

Das Ende-zu-Ende-Latenzbudget lautet

\[
T_{\mathrm{gesamt}}
=

T_{\mathrm{Queue}} +
T_{\mathrm{Netz}} +
T_{\mathrm{Prefill}} +
T_{\mathrm{Decode}} +
T_{\mathrm{Validierung}}.
\]

### 5.2 Geeignete Studienprojekte und Referate

- **8.9d als Zwei-Server-Labor:** reproduzierbares Deployment ohne öffentlichen Port.
- **`llama-server` versus Ollama:** gleicher Kern, aber unterschiedliche Betriebs- und Angriffsfläche.
- **CPU-Kapazitätsplanung:** Kontextgröße 2048/4096, KV-Cache, Threads und Promptkürzung messen.
- **Ein Slot, zwei Aufträge:** Fairness, Priorität und sofortigen Fallback für Label und Summary entwerfen.
- **Fault Injection:** 503, Timeout, Client-Abort, ungültiges Schema und Prozessausfall.
- **Supply Chain:** Image-Digest, GGUF-Checksumme, SBOM, Modelllizenz und Rollback.
- **Private Endpoint Security:** DNS-Auflösung, RFC1918/ULA-Allowlist, Credential und SSRF-Abwehr.
- **Unit Economics:** zweiter CPU-Host gegen GPU-Instanz und Managed AI.
- **SLO-Kaskade:** Kern-SLO von 8.9a und optionales KI-SLO getrennt spezifizieren.
- **Noisy Neighbor:** 1.14c-Label und 8.9c-Summary konkurrieren um denselben Slot.

## 6. Einbindung in die Praktika

### Data Analytics und NLP

8.9d ist eine optionale Vertiefung, keine neue Pflicht zur produktiven LLM-Implementierung. Das Praktikum muss mindestens eine erklärbare Baseline und eine nicht generative Alternative bewerten. Ein 8.9d-Versuch ergänzt:

- strukturierte Ausgabe mit JSON-Schema pro Request,
- Prompt-/Modell-/Runtimeversionierung,
- TTFT, Prefill und Tokens/s,
- Quellenbindung und Halluzinationsprüfung,
- extraktiven Fallback,
- Kosten- und Datenschutzvergleich.

### Cloud Computing

8.9d ist das konkrete Infrastruktur-Labor für privaten Model-Betrieb. Der Pflichtnachweis besteht nicht aus einer attraktiven Modellantwort, sondern aus:

- reproduzierbarem Deployment oder IaC,
- Ressourcenlimits,
- nicht öffentlicher Netzgrenze,
- Slot- und Backpressure-Nachweis,
- Timeout mit echtem Client-Abort,
- Fault-Injection,
- Messdaten und Unit Economics,
- dokumentiertem Rollback.

## 7. Gemeinsame Abnahmegrenzen

- Der Live-Hotpath wartet nie auf Inferenz.
- 8.9a bleibt bei Ausfall aller optionalen Dienste verfügbar.
- 8.9b wird nicht auf den 8.9d-LLM-Slot verschoben.
- LLM-Ausfall verändert weder Clusterzugehörigkeit noch Quellenranking.
- Unbekannte Quellen-IDs und quellenlose Aussagen werden serverseitig verworfen.
- Modelltext allein beweist keine semantische Quellentreue.
- Produktivdaten und Secrets gehören nicht in Praktikumsartefakte.
- 8.9d bleibt bis zu gemessener Last-, Fehler-, Security-, Privacy- und Kostenabnahme produktiv deaktiviert.
