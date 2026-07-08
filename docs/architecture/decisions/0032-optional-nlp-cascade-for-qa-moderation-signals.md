<!-- markdownlint-disable MD013 -->

# ADR-0032: Optionale NLP-Kaskade fuer Q&A-Moderationssignale

**Status:** Proposed
**Datum:** 2026-07-08
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-07-08
**Kontext-Tags:** Machine Learning, Natural Language Processing, Q&A, Backend-Architektur, Datenschutz, Performance

## Kontext

Der Q&A-Kanal von arsnova.eu sammelt schriftliche Fragen, die Lehrende oder Moderator:innen im Raum muendlich beantworten. Der Kanal ist Teil derselben Live-Session wie Quiz und Blitzlicht (ADR-0009) und damit ein potentiell lastkritischer Live-Pfad.

Fachlich gibt es ein sinnvolles Zielbild fuer eine semantische Moderationshilfe:

- thematische Einordnung eingereichter Q&A-Fragen, z. B. `Inhalt`, `Organisation`, `Technik`
- Hinweise auf Themenballungen oder wiederkehrende Verstaendnisprobleme
- optional aggregierte Stimmungstendenzen als Moderationssignal
- keine automatische Moderationsentscheidung und kein automatisches Bewerten einzelner Teilnehmender

Gleichzeitig gelten fuer diese Erweiterung harte Grenzen:

- Externe KI-APIs oder stille SaaS-Fallbacks sind ausgeschlossen.
- Inferenz darf nicht synchron im Teilnehmer-Hotpath laufen.
- Die Host-Ansicht muss bei fehlender, langsamer oder deaktivierter NLP-Komponente voll nutzbar bleiben.
- Es gibt keine personenbezogene Sentimentanalyse, kein Profiling, kein Scoring einzelner Teilnehmender und keine automatische Aktion wie Pinnen, Archivieren oder Loeschen.
- Datenschutz wird nicht allein dadurch geloest, dass Modelle lokal laufen; Zweckbindung, Datenminimierung, Transparenz, Retention und Betriebsabschaltbarkeit bleiben Teil der Architektur.

ADR-0025 behandelt KI- und Inferenzfunktionen standardmaessig als performance-kritisch. ADR-0026 priorisiert Live-Hotpaths wie Join, Vote, Sessionstatus und Frage-/Antwortpfade gegenueber Nebenlast. Diese ADR muss deshalb nicht nur Modellwahl, sondern auch Pfadtyp, Degradation und Messstrategie festlegen.

## Entscheidung

Wir fuehren keine synchrone "Analyse jeder eingehenden Frage" im Q&A-Request-Pfad ein. Stattdessen wird eine optionale, asynchrone NLP-Kaskade als Nebenkomponente fuer Host-/Moderator-Signale vorgesehen.

### 1. Pfadtyp und Hotpath-Grenze

Q&A-Fragen werden zunaechst ohne NLP-Ergebnis angenommen, gespeichert und an die bestehenden Q&A-Listen ausgeliefert.

Die NLP-Analyse darf erst nachgelagert laufen:

- nach erfolgreicher Persistenz einer `QaQuestion`
- ueber eine interne Queue, einen Worker oder einen getrennten lokalen NLP-Service
- mit hartem Timeout, begrenzter Parallelitaet und Backpressure
- ohne Blockade von `qa.submit`, `qa.list` oder `qa.onQuestionsUpdated`

Wenn die NLP-Komponente nicht verfuegbar ist, bleibt die Frage schlicht unklassifiziert. Die UI darf daraus keinen Fehlerzustand fuer Teilnehmende ableiten.

### 2. Modellkaskade

Die Zielarchitektur ist eine zweistufige Kaskade. Die Stufen sind
architektonisch festgelegt; die konkreten Modelle sind versionierte
Betriebsartefakte und muessen gegen Q&A-Daten evaluiert werden.

1. **Level 1: guenstiger Gatekeeper**
   Ein schneller supervised Klassifikator klassifiziert kurze Q&A-Texte in die vereinbarten Kategorien. `fastText` bleibt eine sinnvolle Baseline, ist aber wegen archiviertem Upstream nicht automatisch die Zielimplementierung. Alternativen wie Hashing-/n-Gram-Features mit linearem Klassifikator oder SetFit mit multilingualem Sentence-Transformer werden mitbewertet. Ein Early Exit ist nur zulaessig, wenn Konfidenz, Kalibrierung und Fehlerprofil auf echten oder realistisch kuratierten Q&A-Daten belegt sind.

2. **Level 2: semantischer Fallback**
   Unsichere Faelle koennen an ein kompaktes multilingual nutzbares Transformer-Modell uebergeben werden, das lokal auf CPU laeuft. ONNX Runtime bleibt eine moegliche Laufzeit, wird aber zusammen mit OpenVINO/Optimum Intel und einem lokalen Text-Embeddings-Service evaluiert. Ein reines Sentence-Embedding-Modell reicht nicht als fertiger Klassifikator; erforderlich ist entweder ein feinabgestimmter Klassifikationskopf, eine SetFit-/linear-probing-Variante oder eine explizit evaluierte Embedding- plus Klassifikationslogik.

Der Schwellenwert fuer Level 1 ist kein Architekturkonstante wie `0.85`. Er ist ein versionierter, messbarer Betriebsparameter, der aus Evaluation, Fallback-Budget und Fehlertoleranz abgeleitet wird.

### 3. Aktuelle Modell- und Runtime-Findings

Stand 2026-07-08 werden folgende Kandidaten in die Evaluation aufgenommen:

#### Gatekeeper-Kandidaten

- **`fastText`:** sehr schnelle supervised Baseline fuer kurze Texte; wegen archiviertem Upstream als Risiko behandeln und nicht ohne Wartungsbewertung als Zielmodell festlegen.
- **scikit-learn `HashingVectorizer`/`FeatureHasher` plus linearer Klassifikator:** wartbare klassische CPU-Baseline mit niedrigem Speicherbedarf; Hashing reduziert Speicher und Startkosten, kostet aber Rueckwaerts-Inspektierbarkeit der Features.
- **SetFit mit multilingualem Sentence-Transformer:** wenige gelabelte Beispiele koennen fuer eine staerkere fachliche Klassifikation reichen; Inferenz ist teurer als klassische lineare Modelle und gehoert deshalb nur als Gatekeeper-Kandidat in die Messung, nicht ungeprueft in den Hotpath.

#### Semantische Fallback-Kandidaten

- **`intfloat/multilingual-e5-small|base|large`:** pragmatische Embedding-Familie fuer multilingualen Semantic-Fallback. `small`/`base` sind die CPU-naeheren Kandidaten; `large` ist nur sinnvoll, wenn Last- und Speicherbudget das tragen.
- **`Alibaba-NLP/gte-multilingual-base`:** moderner multilingualer Embedding-Kandidat mit langem Kontext, dichten und sparse Signalen; die Nutzung von `trust_remote_code` ist vor produktiver Nutzung separat als Supply-Chain-Risiko zu bewerten.
- **`BAAI/bge-m3`:** leistungsfaehiger Kandidat fuer dense, sparse und multi-vector Retrieval mit langer Kontextlaenge; wegen hoeherer Komplexitaet eher semantischer Fallback als Standardstufe.
- **`jinaai/jina-embeddings-v3`:** leistungsfaehiger, aber groesserer Embedding-Kandidat mit Task-LoRA und reduzierbaren Embedding-Dimensionen; nur aufnehmen, wenn Modellgroesse, Lizenz, Exportpfad und CPU-Latenz zum Betriebsmodell passen.

#### Zero-shot- und Cold-start-Kandidat

- **`MoritzLaurer/mDeBERTa-v3-base-mnli-xnli`:** sinnvoll fuer Experimente mit neuen Labelsets ohne sofortiges Training; fuer produktive Q&A-Klassifikation nur nach Messung gegen feinabgestimmte oder klassische Baselines verwenden, weil Zero-shot-Konfidenzen nicht automatisch kalibriert sind.

#### Runtime-Kandidaten

- **ONNX Runtime:** bisherige naheliegende CPU-Laufzeit; Quantisierung bleibt qualitaetsrelevant und muss gegen ein Referenzmodell getestet werden.
- **OpenVINO/Optimum Intel:** besonders fuer Intel-CPU-Deployments zu pruefen; 8-bit/4-bit-Quantisierung kann Speicher und Rechenkosten reduzieren, erfordert aber Qualitaetsmessung.
- **Text Embeddings Inference (TEI):** moeglicher lokaler Sidecar fuer Embedding-Modelle mit Dynamic Batching und Prometheus-Metriken; nur verwenden, wenn der zusaetzliche Service-Betrieb einfacher ist als ein interner Worker.

Die konservative Startvariante fuer einen MVP ist:

1. deterministische oder klassische CPU-Baseline als Vergleichspunkt,
2. `fastText` oder Hashing-/n-Gram-Linear-Modell als Gatekeeper,
3. `multilingual-e5-small` oder `multilingual-e5-base` als erster semantischer Fallback,
4. `gte-multilingual-base`, `bge-m3` und `jina-embeddings-v3` nur in einer erweiterten Qualitaets-/Lastmessung.

### 4. Ergebnisvertrag

NLP-Ergebnisse sind Hilfssignale, keine fachliche Wahrheit.

Ein Ergebnis darf enthalten:

- Kategorie oder Themenlabel
- Konfidenz
- Modellversion
- Analysezeitpunkt
- Status wie `pending`, `classified`, `uncertain`, `disabled` oder `failed`

Ein Ergebnis darf nicht enthalten:

- Teilnehmerprofil
- personenbezogenes Sentiment
- Host-, Admin- oder Session-Tokens
- IP-Adressen oder technische Identifikatoren
- automatische Moderationsaktion

Sentiment darf, falls ueberhaupt, nur als aggregierter und erklaerter Moderationshinweis erscheinen, nicht als dauerhaft gespeichertes Urteil ueber eine einzelne Frage oder Person.

### 5. Betriebs- und Deployment-Modell

Die erste produktionsnahe Umsetzung muss zwischen zwei Betriebsmodellen entscheiden und diese in Code/Deployment sichtbar machen:

- separater lokaler NLP-Service im Docker-Stack
- oder interner Backend-Worker mit klar begrenzter CPU-/RAM-Nutzung

In beiden Varianten gelten:

- Feature-Flag oder Konfigurationsschalter, produktiv standardmaessig deaktivierbar
- Healthcheck und Warmup fuer Modellverfuegbarkeit
- Ressourcenlimits fuer CPU, RAM und parallele Inferenz
- Queue-Limit und Drop-/Skip-Strategie bei Ueberlast
- Metriken fuer Latenz, Fallback-Rate, Fehler, Queue-Laenge und Early-Exit-Anteil
- keine dauerhafte Speicherung von Debug-Snapshots oder Modellinputs ohne expliziten Audit-/Debug-Modus des Betreibers

Die Modelle selbst werden als versionierte Artefakte behandelt. Modellversion, Trainingsdatenstand, Kalibrierung und bekannte Grenzen muessen nachvollziehbar sein.

### 6. Evaluation und Freigabekriterien

Synthetische Daten duerfen Trainings- und Testdaten ergaenzen, sind aber keine ausreichende Freigabebasis.

Vor einer Aktivierung ausserhalb lokaler Experimente braucht die Kaskade mindestens:

- kuratiertes, gelabeltes Q&A-Seed-Set mit deutschen, englischen und gemischtsprachigen Beispielen
- separate Auswertung nach kurzen Fragen, Tippfehlern, Slang, Code-Switching und mehrdeutigen Fragen
- Confusion Matrix pro Kategorie
- Precision/Recall oder F1 pro Kategorie
- Kalibrierkurve fuer Gatekeeper-Konfidenzen, z. B. `fastText`, lineares Modell oder SetFit
- Vergleich mindestens eines klassischen Gatekeepers gegen mindestens einen SetFit- oder Embedding-basierten Kandidaten
- gemessene Fallback-Rate und CPU-/RAM-Kosten
- Lasttest fuer Q&A-Spitzen gemaess ADR-0013, ADR-0025 und ADR-0026
- manuelle Review-Stichprobe fuer Fehlklassifikationen und Datenschutzwirkung

Ironie, Sarkasmus und doppelte Verneinungen gelten nicht als garantiert geloest. Wenn sie fachlich relevant sind, muessen sie als eigene Evaluationsslices gemessen werden.

## Performance-Steckbrief

- **Lastklasse:** performance-kritisch, solange nicht durch Messung deeskaliert
- **Pfadtyp:** Hintergrundjob oder lokaler Nebenservice; nicht synchroner Request- oder Live-Fan-out-Pfad
- **Kostenprofil:** CPU, RAM, Container-Image-Groesse, Queue-Latenz
- **Skalierungsprofil:** pro Q&A-Frage, mit Spitzen bei Feedback-Phasen und grossen Veranstaltungen
- **Worst Case:** 500 Teilnehmende, viele gleichzeitige Q&A-Einreichungen, zusaetzlich laufende Q&A-Subscriptions
- **Entlastungsstrategie:** Feature-Flag, Queue-Limit, Sampling/Skipping bei Ueberlast, Timeout, Early Exit, Fallback `unclassified`
- **Messstrategie:** Mikrobenchmark fuer Modelle, Node-/k6-Smoke fuer Q&A-Einreichungen, Artillery-Zielbild fuer Realtime-Q&A, Telemetrie fuer Queue und Inferenz

## Konsequenzen

### Positiv

- Q&A kann um semantische Host-/Moderator-Signale erweitert werden, ohne den Teilnehmerfluss von der Inferenz abhaengig zu machen.
- Lokale Inferenz vermeidet Drittanbieteruebertragung und passt besser zu selbsthostbaren Hochschulinstallationen.
- Die Kaskade erlaubt eine wirtschaftliche CPU-first-Strategie: schnelle Standardfaelle zuerst, teurere semantische Pruefung nur bei Unsicherheit.
- Modellversionen, Schwellenwerte und Degradation werden explizite Betriebsartefakte statt versteckter Annahmen.
- Die Architektur bleibt vereinbar mit Story 8.9a–8.9c: Moderationshilfe, keine Blackbox-Entscheidung.

### Negativ / Risiken

- Zwei Modellstufen, Queue/Worker, Artefaktversionierung und Telemetrie erhoehen Betriebs- und Review-Aufwand.
- `fastText` ist schnell, aber supervised und nicht zero-shot-faehig; neue Kategorien brauchen neue Trainings- und Kalibrierlaeufe. Wegen archiviertem Upstream braucht es einen aktuellen Baseline-Vergleich.
- ONNX-Quantisierung kann Genauigkeit kosten und muss gegen das unquantisierte Referenzmodell geprueft werden.
- Transformer-Fallback auf CPU kann bei Spitzenlast trotz Quantisierung teuer werden, wenn Modellgroesse, Fallback-Rate oder Parallelitaet nicht begrenzt sind.
- Moderne Embedding-Modelle wie E5, GTE, BGE-M3 oder Jina v3 liefern bessere semantische Signale als MiniLM-Baselines, sind aber nicht automatisch Klassifikatoren und duerfen nur mit expliziter Klassifikationslogik verwendet werden.
- Fehlklassifikationen koennen Hosts in die falsche Richtung lenken; die UI muss Unsicherheit sichtbar machen.
- Lokale Inferenz reduziert Datenschutzrisiken, ersetzt aber keine Datenschutz- und Governance-Entscheidung.

## Alternativen (geprueft)

- **Keine NLP-Komponente:** technisch am einfachsten und datenschutzseitig am robustesten, verworfen als alleiniges Zielbild, weil Themenballungen und Moderationshinweise fachlich nuetzlich sein koennen.
- **SaaS-LLM fuer Q&A-Analyse:** verworfen, weil externe KI-APIs, stille Drittanbieteruebertragung und unklare Datenkontrolle nicht zum Projektziel passen.
- **Generatives self-hosted LLM direkt im Live-Pfad:** verworfen fuer diese Entscheidung, weil Latenz, CPU/GPU-Kosten und Degradation schwerer beherrschbar sind.
- **Nur fastText:** verworfen als Zielbild, weil kurze, mehrdeutige oder semantisch komplexe Fragen nicht allein ueber ein schnelles supervised Modell abgedeckt werden sollten und der Upstream-Status ein Wartungsrisiko ist.
- **Nur Transformer/ONNX:** verworfen als Standardpfad, weil jede Q&A-Frage dann die teurere Inferenz nimmt und der Live-Betrieb unnoetig belastet wird.
- **Nur modernes Embedding-Modell:** verworfen als Zielbild, weil Embeddings semantische Naehe liefern, aber ohne Klassifikationskopf, SetFit, lineares Probing oder andere explizite Logik keine belastbare Kategorieentscheidung sind.
- **Regelbasierte Keyword-Listen:** sinnvoll als Fallback oder Baseline, aber fuer robuste Mehrsprachigkeit, Tippfehler und semantische Naehe zu begrenzt.

## Umsetzungsleitplanken

- Neue Persistenzfelder fuer NLP-Ergebnisse muessen in `libs/shared-types` und Prisma schema-first modelliert werden.
- Bestehende Q&A-DTOs duerfen Teilnehmern keine internen Moderations- oder Analyseartefakte ausliefern.
- Host-/Moderator-UI muss `pending`, `uncertain`, `disabled` und `failed` ruhig darstellen koennen.
- Produktive Aktivierung erfolgt erst nach Last- und Qualitaetsmessung, nicht allein nach erfolgreichem Modellstart.
- Die Funktion muss jederzeit abschaltbar sein, ohne bestehende Q&A-Flows zu beeintraechtigen.

## Referenzen

- [ADR-0009: Einheitliche Live-Session mit Tabs fuer Quiz, Q&A und Blitzlicht](./0009-unified-live-session-channels.md)
- [ADR-0013: k6 und Artillery als Standard-Stack fuer Last- und Performance-Tests](./0013-use-k6-and-artillery-for-load-and-performance-testing.md)
- [ADR-0025: Zukuenftige Erweiterungen standardmaessig als performance-kritisch behandeln](./0025-treat-future-extensions-as-performance-critical-until-proven-otherwise.md)
- [ADR-0026: Performance-Hotpaths priorisieren und Telemetrie-Nebenlast konsequent entkoppeln](./0026-prioritize-performance-hotpaths-and-de-escalate-telemetry-side-load.md)
- `Backlog.md` Story 8.9a: Deterministischer Live-Moderationskompass
- `Backlog.md` Story 8.9b: Optionale Q&A-NLP-Kaskade fuer Moderationssignale
- `Backlog.md` Story 8.9c: Optionale generative Moderationszusammenfassung
- fastText: <https://github.com/facebookresearch/fastText>
- scikit-learn Feature Extraction: <https://scikit-learn.org/stable/modules/feature_extraction.html>
- Hugging Face SetFit: <https://huggingface.co/docs/setfit/index>
- multilingual-e5-base: <https://huggingface.co/intfloat/multilingual-e5-base>
- GTE multilingual base: <https://huggingface.co/Alibaba-NLP/gte-multilingual-base>
- BGE-M3: <https://huggingface.co/BAAI/bge-m3>
- mDeBERTa-v3-base-mnli-xnli: <https://huggingface.co/MoritzLaurer/mDeBERTa-v3-base-mnli-xnli>
- jina-embeddings-v3 Paper: <https://arxiv.org/abs/2409.10173>
- ONNX Runtime Quantization: <https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html>
- Hugging Face Text Embeddings Inference: <https://huggingface.co/docs/text-embeddings-inference/index>
- Optimum Intel OpenVINO Optimization: <https://huggingface.co/docs/optimum-intel/en/openvino/optimization>
