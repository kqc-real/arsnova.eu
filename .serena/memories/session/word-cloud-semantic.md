# Word Cloud semantic topics (Story 1.14c Stufe 1)

- Canonical: `docs/features/word-cloud-semantic.md`. Analysis version `1.14c.2` (Complete-Linkage, Kosinus 0,87).
- UI label is **Themen**; internal variant `SEMANTIC`. `THEME` stays 2.x phrases. Do not call the UI “Semantische Themen”.
- Kill-switch `WORD_CLOUD_SEMANTIC_ENABLED` (exact `true` only). Do not reuse `NLP_ENABLED`, `QA_NLP_ENABLED`, `QA_SUMMARY_ENABLED`, or `QA_SUMMARY_INFERENCE_URL`.
- Sidecar: Compose profile `encoder`, Unix socket `/run/wordcloud-encoder/encoder.sock`, `network_mode: none`, 1 CPU / 2 GiB / 64 PIDs. Optional private HTTP `WORD_CLOUD_ENCODER_URL` (loopback/RFC1918 literals only; public DNS and SaaS blocked). Image `WORD_CLOUD_ENCODER_IMAGE`, not `ARSNOVA_IMAGE`/`SPACY_IMAGE`. `deploy.sh` does not start it.
- Encoder returns embeddings only (ONNX `intfloat/multilingual-e5-small`). Clustering and extractive labels run in TypeScript (`wordCloudSemanticCluster.ts`). No encoder code in the browser.
- Host Q&A only for locales `de`/`en`. Freitext currently falls back lexically (`channel: FREETEXT` → `status: fallback`); Story 1.14d lifts that. `fr`/`es`/`it` fall back until fixtures exist. Without a cluster of size ≥2 (single item or only singletons) also `fallback`, not `uncertain`. Without kill-switch: `disabled` + 2.x. Dead/timeout encoder: `failed` + 2.x.
- Snapshot `{ id, text }` with `qa-question:{uuid}`. No tokens, IPs, nicknames, participant IDs. `hostProcedure`. Participant DTOs have no cluster fields.
- Max one inflight job per session; new data → stale + “Neu analysieren”. Ready topics also keep “Neu analysieren” (`refresh` bypasses snapshot cache; locale change is a different hash). Circuit breaker 3 failures / 30 s. Live hotpath (`qa.submit`, Join, Vote, WS) never awaits inference.
- `SEMANTIC + LEMMA` is `MODE_UNSUPPORTED`. Smoothing controls stay hidden in Themenmodus (Q&A like Freitext). While topics are pending or the 2.x phrase fallback is shown, an already-on lemma smoothing still applies to that words-and-phrases cloud.
- CI fixtures: geometric unit vectors, no model download. Three Kapitel-4 exam paraphrases cluster; Folien vs Beamer do not.
- Stufe 2 LLM labels, Presenter topics, and 8.9c Slice 4 remain out of 1.14c. Host-Freitext encoder clustering is Story 1.14d (open): same kill-switch and sidecar, lift `channel: FREETEXT` hard fallback; no second public service.
