# Word Cloud spaCy (Story 1.14b)

- Story 1.14b is done (analysis version `1.14b.12`). Canonical doc: `docs/features/word-cloud-spacy.md`. Sentence-initial capitalized finite verbs (`Zählt`, `Läuft der`, `Macht das`) stay VERB even when spaCy tags them NOUN/PROPN/X. Bare numbers (`10`) and punctuation (`..`) are not unigrams; participles (`Gelernt`) stay VERB. THEME/Q&A **Wörter & Phrasen** never uses unique full questions as cloud labels; only short shared anchors (2–3 tokens) plus lemma unigrams when smoothing is on.
- spaCy is optional lemma smoothing, not semantics. Default **on** when the host shows the cloud (freetext expanded/maximized, Q&A dialog open) and a lemma locale exists; the host can turn it off. New answers/questions still mark stale (no auto-recompute). Story 1.14c Stufe 1 is the semantic topic path (`mem:session/word-cloud-semantic`). Never call the UI feature spaCy/NLP/Lemma.
- Default stays lexical 2.x. `NLP_ENABLED` default false; `deploy.sh` does not start the sidecar. Compose profile `nlp`; Unix socket `NLP_SOCKET_PATH`; no TCP (`network_mode: none`). Bundled models `de`/`en` (MIT), `fr` (LGPL-LR), `es` (GPL-3.0); `it` excluded. Image is not pure MIT.
- Pipeline: fetch → clean/protect terms → optional lemma/POS → lexical aggregate → render. Renderer never analyzes raw text. `THEME + LEMMA` is `MODE_UNSUPPORTED`.
- Freitext: in-place maximize of the same `app-word-cloud`; modes WORDS/PHRASES map to `maxNgramLength` 1 vs 3. Mode switch with smoothing active re-analyzes the same snapshot.
- Q&A: separate MatDialog. Smoothing on `LEXICAL` and `THEME` (does not force `LEXICAL`). THEME + smoothing keeps THEME phrases and replaces unigrams with lemma nouns; `THEME + LEMMA` stays `MODE_UNSUPPORTED`. Sort TOP/BEST/CONTROVERSIAL with active lemma re-smooths. THEME sort change stays `normalization: NONE` for phrases and re-runs lemma for unigrams.
- New incoming answers/questions mark stale; no auto-recompute on live input.
- Shared contract: `libs/shared-types/src/word-cloud-normalization.ts`. Sidecar: `docker/spacy/`.
- Host cloud language is explicit next to Smooth word forms (freetext + Q&A), independent of quiz and participant browser. Default is the host UI locale when a lemma model exists (de/en/fr/es). Under /it/ smoothing stays off until the host picks DE/EN/FR/ES. The choice is session-wide and stored in sessionStorage; changing it while smoothing is on re-analyzes the same snapshot.
- macOS Host-npm: `npm run spacy:macos-dev` (`scripts/macos-spacy-wordcloud-dev.sh`). Not `ng serve`. After Postgres/Redis it runs `prisma:push` (otherwise `public.Quiz` is missing). Localized dist via `serve:localize:api` on `http://localhost:4200/de/` … `/it/` plus `start:prod` on 3000. Smoothing de/en/fr/es; Italian UI needs an explicit cloud language. Docker volume socket is invisible to host Node; do not expect `docker:up:nlp`. Canonical: `docs/features/word-cloud-spacy.md` section “Lokale Prüfung auf macOS”.

## Related Memories

- `mem:core`
- `mem:modules/backend`
- `mem:modules/frontend`
- `mem:modules/shared-types`
- `mem:deployment/core`
- `mem:testing/core`
