# Frontend Quiz Editor Save Flow

- Canonical ADR: `docs/architecture/decisions/0031-centralized-quiz-editor-save-detection.md`.
- Scope: `QuizEditComponent` under `apps/frontend/src/app/features/quiz/quiz-edit/` and preview inline edits in `QuizPreviewComponent` under `apps/frontend/src/app/features/quiz/quiz-preview/`.
- Public save path for editor state is `saveAll()`. Do not reintroduce parallel public save methods for metadata/settings/questions such as `saveMetadata()`, `saveSettings()`, or one-off question save helpers.
- Global bottom save CTA is driven by `hasPendingChanges()`, not by direct `FormGroup.dirty` checks in templates or call sites.
- Successful central saves must show user confirmation. Current contract: `saveAll()` opens a snackbar stating that changes are now applied in preview and live quiz.
- Preview inline edits must follow the same UX contract: after `finishInlineEditMode()` commits real changes (`inlineEditHasChanges()`), `QuizPreviewComponent` shows a snackbar confirmation that the change is applied in preview and live quiz.
- Metadata/settings change detection must compare normalized persisted shape against the current quiz document. `FormGroup.dirty` alone is insufficient because handlers, selects, pseudo-radio controls, presets, and conditional fields can update controls without reliable dirty state.
- New persisted quiz metadata/settings fields must be added in the same slice to:
  - form/control setup and patch/read methods,
  - normalized comparable state used by `hasPendingChanges()`/`saveAll()`,
  - actual persistence payload,
  - focused specs proving a change activates/saves through `saveAll()`.
- New question type fields must be added to `buildQuestionInputFromForm()`, `toComparableQuestionInput()`, form patch/reset paths, validation as needed, and specs through `saveAll()`.
- Editor preview actions call `openPreview()`, which must persist through `saveAll()` before navigating. Do not introduce a preview-only draft source that lets preview/live-start diverge from the saved quiz collection state.
- Unsaved-leave protection: Edit/New/Preview use `confirmDiscardUnsavedChanges` (`shared/confirm-leave-dialog/confirm-unsaved-changes.ts`) via `canDeactivate`, `beforeunload`, and Preview in-view exits (question change, back, live start, Escape). LocaleSwitchGuard accepts multiple getters and includes Preview routes. Explicit discard buttons stay confirmation-free.
- Immediate list actions such as activate/deactivate, delete, and reorder are explicit exceptions for now; keep them obviously immediate-commit if touched, or extend ADR-0031 before moving them into global save.
- Risk pattern to test: a value set through a handler or select changes the persisted value while Angular `dirty` remains false; `hasPendingChanges()` and `saveAll()` must still catch it.
- Preview risk pattern to test: an active editor type change, e.g. `FREETEXT` -> `NUMERIC_ESTIMATE`, must call the central question persistence path before preview navigation.
- Demo quiz risk pattern: `ensureDemoQuiz()` runs on navigation and must not reseed a locally modified demo quiz. Content-changing store methods mark `DEMO_QUIZ_ID` as user-modified so saved editor changes survive preview/live-start/collection return.

## Verwandte Memories

- `mem:frontend/core`
- `mem:modules/frontend`
- `mem:quality/workflow`
- `mem:testing/core`
- `mem:session/numeric-estimate-story-1-2d`
