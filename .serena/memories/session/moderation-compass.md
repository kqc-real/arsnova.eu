# Moderationskompass und optionale Q&A-Inferenz (8.9 / 1.14)

- Canonical docs: `docs/features/moderation-compass.md` (8.9a), `docs/features/qa-nlp-moderation.md` (8.9b), `docs/features/qa-summary.md` (8.9c), `docs/features/word-cloud-spacy.md` (1.14b). Diagram: `docs/diagrams/diagrams.md` §1.3.
- 8.9a is done: host-only rule-based compass cards from already loaded signals. No auto pin/archive/phase actions. Cards appear only with evidence; the button stays visible. Present/Vote/FINISHED have no compass. Moderator access waits for story 8.5. First-user Host-UI: next-step banner first, cards Tempo→Reibung→Klärung→Themen, tappable source rows (3 visible), optional 8.9c summary collapsed with the button at the top, prominent return-to-compass, one-time sessionStorage first-open hint.
- 8.9b is done, `QA_NLP_ENABLED` default false. Async queue after `qa.submit` persist; participant DTOs never include `nlp`. Gatekeeper plus in-process k-NN fallback. Separate from spaCy `NLP_ENABLED`.
- 8.9c slices 1–3 plus local loopback helper and snapshot ranking are in repo; `QA_SUMMARY_ENABLED` default false; no SaaS fallback. Slice 4 uses the `llama-server` runtime from story 8.9d / ADR-0035 via a Node translator (not `QA_SUMMARY_INFERENCE_URL` pointed at `/v1/chat/completions`); extractive fallback must move into the backend queue. Planned kill-switch `OPEN_WEIGHT_LLM_ENABLED` does not hide 8.9a or Stufe-1 topics. The compass summary card shows only with kill-switch, configured private inference URL, and at least 3 visible Q&A posts (`PENDING`/`ACTIVE`/`PINNED`); pending/ready results stay visible if the count later drops. No live sidecar ping. Slice 4 (real model) waits for 1.14c on a private inference server with a separate contract. Results are ephemeral in memory, not Prisma. Local helper Gemini timeout is backend `QA_SUMMARY_TIMEOUT_MS` minus 5s; Gemini `failed` falls back to extractive bullets. Queue cooldown does not apply to `failed` (timeout) so the host can retry immediately. Display rewriter `toQaSummaryScanBullet` reformats essay-style cached text for scan bullets without cutting at und/von. Host order follows snapshot rank then source count.
- 1.14/1.14a lexical word cloud is production; 1.14b optional lemma smoothing; 1.14c semantic topics remain open. Do not mix the three kill switches.
- Live hot paths must not await inference.

## Related Memories

- `mem:core`
- `mem:session/word-cloud-spacy`
- `mem:security/dto-stripping`
- `mem:backend/api-router`
