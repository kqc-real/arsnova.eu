# Word Cloud spaCy (Story 1.14b)

- Story 1.14b is done (analysis version `1.14b.7`). Canonical doc: `docs/features/word-cloud-spacy.md`.
- spaCy is optional host-triggered lemma smoothing, not semantics. Story 1.14c remains the semantic topic path. Never call the UI feature spaCy/NLP/Lemma.
- Default stays lexical 2.x. `NLP_ENABLED` default false; `deploy.sh` does not start the sidecar. Compose profile `nlp`; Unix socket `NLP_SOCKET_PATH`; no TCP (`network_mode: none`). MIT models `de`/`en` only.
- Pipeline: fetch → clean/protect terms → optional lemma/POS → lexical aggregate → render. Renderer never analyzes raw text. `THEME + LEMMA` is `MODE_UNSUPPORTED`.
- Freitext: in-place maximize of the same `app-word-cloud`; modes WORDS/PHRASES map to `maxNgramLength` 1 vs 3. Mode switch with smoothing active re-analyzes the same snapshot.
- Q&A: separate MatDialog. Smoothing only on `LEXICAL` (forces `LEXICAL`). Sort TOP/BEST/CONTROVERSIAL with active lemma re-smooths. THEME sort change stays `normalization: NONE`.
- New incoming answers/questions mark stale; no auto-recompute on live input.
- Shared contract: `libs/shared-types/src/word-cloud-normalization.ts`. Sidecar: `docker/spacy/`.
- macOS Host-npm: `npm run spacy:macos-dev` (`scripts/macos-spacy-wordcloud-dev.sh`). Not `ng serve`. Localized dist via `serve:localize:api` on `http://localhost:4200/de/` … `/it/` plus `start:prod` on 3000. Smoothing only de/en. Docker volume socket is invisible to host Node; do not expect `docker:up:nlp`. Canonical: `docs/features/word-cloud-spacy.md` section “Lokale Prüfung auf macOS”.

## Related Memories

- `mem:core`
- `mem:modules/backend`
- `mem:modules/frontend`
- `mem:modules/shared-types`
- `mem:deployment/core`
- `mem:testing/core`
