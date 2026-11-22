# 1C Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add executable tests T1–T5 that confirm or refute the 1C claims. Each group gets a recorded mutation probe and an evidence protocol, and no production code changes.

**Architecture:**

- **Unit tests (T1–T4):** These extend the existing co-located test files. They inject behaviour only through the queue, client and context test hooks that already exist.
- **PostgreSQL suite (T5):** One new opt-in suite drives real DB functions and router paths. Only the auth boundaries are mocked.
- **Mutation probes:** Every group is proven able to fail by a local, never-committed mutation of production code.
- **Evidence:** Every run is recorded in `docs/referat-thema-1/evidenz/1C/2026-10-24-tests.md`.

**Tech Stack:** Vitest 4, TypeScript 6.0, Prisma, PostgreSQL 16, Redis 7.4, tRPC, Node 24.18.0.

**Spec:** [`2026-10-24-1c-tests-design.md`](./2026-10-24-1c-tests-design.md). It defines the H/G/K of every case, read it first. Case numbers (T1.1 …) below refer to it.

## Global Constraints

- **No production code changes.** Mutations are local only and reverted with `git checkout -- <file>` before every commit. Check with `git diff --stat apps libs` (must be test files only).
- **Language and style:**
  - Test titles follow the file's language. German: `qaSummaryQueue.test.ts`, `moderationSummaryContext.test.ts`, `openWeightLlmClient.test.ts`, `qa.summary.test.ts`, `wordCloudAnalysisCache.test.ts`. English: `qa-summary-v2.test.ts`, `moderationQaContext.test.ts`.
  - pg suites use an English `describe` with `(PostgreSQL)` and German `it`.
- **Negative probes** say so in the title (`Negativprobe:` or `negative probe:`). They are built only with `structuredClone` of valid fixtures.
- **Types:** no `any` (lint error). Use `as unknown as …` or `as never`.
- **Commands:** run every command with Node 24: `mise exec node@24.18.0 -- <cmd>`.
- **Commits:** Conventional Commits, one per task, never with AI attribution lines.
- **Refuted hypotheses:** if a case's H is refuted (G occurs), keep the test asserting H as `it.fails(...)`. It must name the finding and carry a TODO with the issue link. Record it as a finding in the protocol (spec 5.5). Never weaken K to make it pass.
- **Pre-registered criteria:** H/G/K are fixed by the spec. Any deviation goes into the protocol with a reason.

## Review Focus

1. **Test pollution through shared module state.** The queue, client and packing cache are module-global, so every new test must reset them (`resetQaSummaryQueueForTests`, `resetOpenWeightLlmClientForTests`, `afterEach`). Task 7 adds an order-independence check: run the file with `--sequence.shuffle`.
2. **Timing flakiness** in T3.1, T3.4 and T4.1, which use real timers and latches. Use small `timeoutMs` (≥ 20 ms, as the existing test does) and explicit latches, never sleeps. Task 7 runs the file 20 times (`--repeat=20`, or a loop).
3. **pg suite leaking data or depending on other suites.** Every T5 test creates its own session and the suite deletes it in `afterAll`. Task 8 runs the suite twice in a row; the second run must pass too.
4. **Redis state left over** from earlier runs changes T5 (topic snapshot, Blitzlicht). Task 8 deletes the session's Redis keys in `beforeEach` (pattern `*<sessionId>*` and `qf:<code>`) and asserts empty topic/feedback sections in T5.0.
5. **Mutation not reverted before commit.** Every task's commit step first runs `git diff --name-only apps libs` and expects only `*.test.ts`, `ci.yml` (Task 8) and docs.

---

### Task 1: Evidence protocol and baseline

**Files:**

- Create: `docs/referat-thema-1/evidenz/1C/2026-10-24-tests.md`

**Interfaces:**

- Produces: the protocol file. Each later task appends one section: `## Tn.x – <title>` with H/G/K copied from the spec, the result (bestätigt / widerlegt), the test name, the command, the mutation diff (fenced), the red run excerpt and the green run excerpt.

- [ ] **Step 1: Write the protocol header**

It records:

- the commit (`git rev-parse HEAD`) and the branch;
- `node --version`, `npx tsc --version`, `npx vitest --version`;
- `docker compose exec postgres postgres --version` and `docker compose exec redis redis-server --version`;
- a link to the spec;
- validity limits copied from spec 5.4;
- a sentence that all data is synthetic.

- [ ] **Step 2: Record the baseline run**

Run: `mise exec node@24.18.0 -- npm run test -w @arsnova/backend -- --run src/lib/qaSummaryQueue.test.ts src/lib/moderationSummaryContext.test.ts src/lib/openWeightLlmClient.test.ts src/lib/moderationQaContext.test.ts src/lib/wordCloudAnalysisCache.test.ts src/__tests__/qa.summary.test.ts && mise exec node@24.18.0 -- npm run test -w @arsnova/shared-types -- --run src/qa-summary-v2.test.ts`
Expected: all pass. Record the counts (`Tests N passed`) as "Baseline vor neuen Tests".

- [ ] **Step 3: Commit**

```bash
git add docs/referat-thema-1/evidenz/1C/2026-10-24-tests.md
git commit -m "docs(referat): start 1C test evidence protocol with baseline run"
```

### Task 2: T1.1 — request schema rejects incompatible versions

**Files:**

- Modify: `libs/shared-types/src/qa-summary-v2.test.ts` (extend the block at lines 88–100)

**Interfaces:**

- Consumes: the existing fixture `requestV2()` (lines 44–56).

- [ ] **Step 1: Add the cases**

```ts
it('negative probe: rejects an incompatible request schemaVersion and requestContract', () => {
  for (const patch of [{ schemaVersion: 3 }, { requestContract: 'qa-summary-context-v3' }]) {
    const result = QaSummaryInferenceRequestV2Schema.safeParse({ ...requestV2(), ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toContain(Object.keys(patch)[0]);
  }
});
```

- [ ] **Step 2: Run, expect PASS** (characterization)

Run: `mise exec node@24.18.0 -- npm run test -w @arsnova/shared-types -- --run src/qa-summary-v2.test.ts`

- [ ] **Step 3: Mutation probe**

In `libs/shared-types/src/qa-summary-v2.ts`, replace the `z.literal` of `schemaVersion` and `requestContract` in `QaSummaryInferenceRequestV2Schema` (around lines 79–91) with `z.number()` / `z.string()`. Run step 2 again: expected FAIL. Revert with `git checkout -- libs/shared-types/src/qa-summary-v2.ts` and run again: expected PASS. Record the diff and both runs in the protocol.

- [ ] **Step 4: Commit**

```bash
git add libs/shared-types/src/qa-summary-v2.test.ts docs/referat-thema-1/evidenz/1C/2026-10-24-tests.md
git commit -m "test(shared-types): reject incompatible summary request versions"
```

### Task 3: T1.2 and T1.3 — assembly throws, job ends rule-based

**Files:**

- Modify: `apps/backend/src/lib/moderationSummaryContext.test.ts` (next to the `assemble…` test at about line 544)
- Modify: `apps/backend/src/lib/qaSummaryQueue.test.ts`

**Interfaces:**

- Consumes:
  - in `moderationSummaryContext.test.ts`: `analysisFixture`, `plan`, `prepareModerationSummaryContextFromAnalysis`, `assemblePreparedModerationSummaryContext({ promptContext, cache, plan })`;
  - in `qaSummaryQueue.test.ts`: `preparedReference`, `testConfig`, `fullContextPlan`, `SESSION_ID`, `ACCESS`.
- Produces: `incompatiblePromptContext(prepared: PreparedModerationSummaryContext): ModerationPromptContextV1`, a local helper in `moderationSummaryContext.test.ts`. It returns a clone with `contractVersion: 'moderation-prompt-context-v2'`. Its type is cast with `as unknown as ModerationPromptContextV1`.

- [ ] **Step 1: T1.2 test**

```ts
it('Negativprobe: wirft beim Zusammenbau mit inkompatibler Kontextversion statt ein Ergebnis zu liefern', async () => {
  const base = await prepareModerationSummaryContextFromAnalysis({
    analysis: analysisFixture(),
    plan,
    packedAt: new Date('2026-01-15T10:06:00.000Z'),
  });
  for (const promptContext of [
    incompatiblePromptContext(base),
    {
      ...structuredClone(base.request.promptContext),
      schemaVersion: 2,
    } as unknown as typeof base.request.promptContext,
  ]) {
    expect(() =>
      assemblePreparedModerationSummaryContext({ promptContext, cache: 'miss', plan }),
    ).toThrow(ZodError);
  }
});
```

- [ ] **Step 2: T1.3 test** (in `qaSummaryQueue.test.ts`)

- **Setup:** `prepare` resolves `preparedReference()` once (request), then rejects with `new ZodError([])` (prepare 2). `processor` is a `vi.fn()`.
- **Title:** `'Negativprobe: beendet den Job regelbasiert mit context_unavailable, wenn der Kontext nicht schemakonform gebaut werden kann'`.
- **Assertions:**
  - `result.status === 'failed'`;
  - `result.execution` matches `{ effectiveMode: 'rule-based', fallback: { reason: 'context_unavailable' } }`;
  - `processor` was not called;
  - `waitForQaSummaryIdleForTests()` resolves.

- [ ] **Step 3: Run both files, expect PASS**

Run: `mise exec node@24.18.0 -- npm run test -w @arsnova/backend -- --run src/lib/moderationSummaryContext.test.ts src/lib/qaSummaryQueue.test.ts`

- [ ] **Step 4: Mutation probe**

In `moderationSummaryContext.ts:802`, change `QaSummaryInferenceRequestV2Schema.parse(` so the object is returned unvalidated (cast). Expected: T1.2 FAIL. Revert. For T1.3, map `fallbackReasonForError` to `'unavailable'` (`qaSummaryQueue.ts:256`). Expected: T1.3 FAIL. Revert. Record both in the protocol.

- [ ] **Step 5: Commit**

`test(qa-summary): reject incompatible context versions during assembly and in the job`

### Task 4: T1.4 — request-time schema error reaches the host

**Files:**

- Modify: `apps/backend/src/__tests__/qa.summary.test.ts`

**Interfaces:**

- Consumes: `trpcDodIt`, `hostCaller`, `activeSession()`, and the `prepare` mock injected in `beforeEach` through `resetQaSummaryQueueForTests({ prepare, plan, processor })`.

- [ ] **Step 1: Test**

`trpcDodIt({ procedure: 'qa.requestSummary', case: 'error', mode: 'direct', contract: 'INTERNAL_SERVER_ERROR', title: 'Negativprobe: liefert INTERNAL_SERVER_ERROR, wenn der Kontext beim Anfordern nicht schemakonform ist' }, …)`

- **Setup:** `prepare.mockRejectedValueOnce(new ZodError([]))`.
- **Assertions:**
  - `hostCaller.requestSummary(...)` rejects with `{ code: 'INTERNAL_SERVER_ERROR' }`;
  - afterwards `summaryRuntime` returns `result: null` (no job created).

- [ ] **Step 2: Run the file and the DoD audit**

Run: `mise exec node@24.18.0 -- npm run test -w @arsnova/backend -- --run src/__tests__/qa.summary.test.ts && mise exec node@24.18.0 -- npm run audit:trpc-dod`
Expected: PASS. If the audit reports a changed DoD baseline, regenerate it as the audit's message says (the repo commit `chore(audit): refresh … tRPC DoD baseline` is the pattern) and include the baseline file in this task's commit.

- [ ] **Step 3: Mutation probe**

Wrap the `requestQaSummary(...)` call in `qa.ts:1710` in a `try/catch` that returns `getQaSummaryRuntime(...)`. Expected: FAIL. Revert and record.

- [ ] **Step 4: Commit**

`test(qa): cover request-time schema violations for qa.requestSummary`

### Task 5: T1.5 and T1.6 — client rejects incompatible request and answer

**Files:**

- Modify: `apps/backend/src/lib/openWeightLlmClient.test.ts` (after the test at about lines 404–423)

**Interfaces:**

- Consumes:
  - the V2 request built as at lines 294–311;
  - `defaultConfig`, `completionResponse(output)`, `resetOpenWeightLlmClientForTests`.

- [ ] **Step 1: T1.5**

- **Title:** `'Negativprobe: weist eine V2-Anfrage mit fremdem requestContract vor Config, Slot und Modellaufruf ab'`.
- **Setup:** `config` and `request` hooks as `vi.fn`. The request is a clone with `requestContract: 'qa-summary-context-v3'`.
- **Assertions:** `runOpenWeightLlmSummaryV2(request)` resolves to `{ status: 'invalid_response' }`; neither hook is called.

- [ ] **Step 2: T1.6**

- **Title:** `'Negativprobe: verwirft eine Modellantwort mit fremder Ausgabe-Version als invalid_response'`.
- **Setup:** the transport returns `completionResponse(...)` with a valid qa_summary output whose `schemaVersion` is `1`.
- **Assertions:** the result equals `{ status: 'invalid_response' }`.

- [ ] **Step 3: Run, expect PASS**

Run: `mise exec node@24.18.0 -- npm run test -w @arsnova/backend -- --run src/lib/openWeightLlmClient.test.ts`

- [ ] **Step 4: Mutation probes**

- T1.5: make `OpenWeightLlmRequestSchema.safeParse` success unconditional (`openWeightLlmClient.ts:469-470`). Expected: FAIL.
- T1.6: return `{ ...result, output: result.output }` for every completed result (`openWeightLlmClient.ts:651-656`). Expected: FAIL.

Revert both and record.

- [ ] **Step 5: Commit**

`test(open-weight-llm): reject incompatible summary request and answer versions`

### Task 6: T2.1 and T2.2 — missing or failed topic section keeps state and reason

**Files:**

- Modify: `apps/backend/src/lib/moderationQaContext.test.ts` (extend lines 506–529; add T2.2 in the N7 block)

**Interfaces:**

- Consumes: `collectQaTopicContext`, `txWithTopicRows`, `state()`, `candidates()`, `topicSnapshot()`.
- Produces: `oversizedTopicSnapshot(memberCount: number)`, a local helper. It builds a snapshot valid under `QaSemanticTopicSnapshotSchema` with ⌈n/500⌉ topics, distinct `topicId`s, every question in exactly one topic, and `analyzedQuestionCount = eligibleQuestionCount = n`.

- [ ] **Step 1: T2.1 assertions added to the existing test**

For `semanticEnabled: false`:

- `topics` is `{ state: 'disabled', reason: expect.any(String) }`;
- `revision.state` is `'not-applicable'`;
- the limitations contain `{ code: 'module-disabled', section: 'topics' }`;
- the projected Q&A sources equal those of the candidates;
- `qaQuestion.findMany` was not called.

- [ ] **Step 2: T2.2 test**

- **Title:** `'keeps the topic section as failed with a reason when the snapshot exceeds 500 members'`.
- **Setup:** `oversizedTopicSnapshot(501)`.
- **Assertions:**
  - `topics.state === 'failed'` with a reason;
  - the limitation `analysis-failed` is present;
  - `findMany` was not called.

- [ ] **Step 3: Run, expect PASS**

Run: `mise exec node@24.18.0 -- npm run test -w @arsnova/backend -- --run src/lib/moderationQaContext.test.ts`

- [ ] **Step 4: Mutation probes**

- T2.1: drop the `limitations` array in the disabled branch (`moderationQaContext.ts:645-651`). Expected: FAIL.
- T2.2: raise `MODERATION_QA_TOPIC_SNAPSHOT_MEMBER_LIMIT` to `100_000`. Expected: FAIL.

Revert both and record.

- [ ] **Step 5: Commit**

`test(moderation): keep disabled and oversized topic sections with state and reason`

### Task 7: T2.3, T3 and T4 — stale snapshot, precedence, host does not wait

**Files:**

- Modify: `apps/backend/src/lib/wordCloudAnalysisCache.test.ts` (T2.3, cache level)
- Modify: `apps/backend/src/lib/moderationQaContext.test.ts` (T2.3, context level)
- Modify: `apps/backend/src/lib/qaSummaryQueue.test.ts` (T3.1–T3.4, T4.1)

**Interfaces:**

- Consumes: `withHash`, `completedRun`, `testConfig`, and the existing Redis mock pattern in `wordCloudAnalysisCache.test.ts`.
- Produces two local helpers in `qaSummaryQueue.test.ts`:
  - `failedRun(prepared, reason: QaSummaryFallbackReason): QaSummaryPreparedRun` builds `{ output: <extractive output>, execution: QaSummaryExecutionV2Schema.parse({ attemptedMode: 'full-context', effectiveMode: 'extractive', fallback: createQaSummaryFallback('extractive', reason, 'manual') }) }`, mirroring `extractiveRun` (`qaSummaryRuntimeAdapter.ts:79-95`);
  - `latch()` returns `{ promise, release }`.

- [ ] **Step 1: T2.3 tests**

- **Cache level:** a Redis value that is a structurally valid snapshot with a different `version` makes `getLatestQaSemanticTopicSnapshot` resolve to `null`.
- **Context level:** with `snapshot: null`, `collectQaTopicContext` yields topics `{ state: 'unavailable', reason: 'no-data' }`.
- **Then** add the case that asserts H, a distinguishable state or reason for an unusable snapshot, as `it.fails('stale snapshot is distinguishable from no data (finding: version conflict is silent)', …)` with `// TODO(kqc-real issue): …`. This applies only if H is refuted, as the spec expects. If H holds, use a normal `it`.

- [ ] **Step 2: T3 tests** (titles in German, cases as in the spec)

`prepare` sequences:

- T3.1 and T3.2: `before, before, after` with `withHash('a'|'b')`.
- T3.3: `before` three times.
- T3.4: `before, before`.

Per case:

- **T3.1:** `testConfig({ timeoutMs: 20 })`; the processor resolves only on abort. Assert `fallback.reason === 'source_changed'` and `result.snapshotHash === 'b'.repeat(64)`.
- **T3.2:** the processor resolves with `failedRun(before, 'unavailable')`. Same assertions as T3.1.
- **T3.3:** same processor. Assert `fallback.reason === 'unavailable'`.
- **T3.4:** the processor rejects with `new Error('unexpected')`. Assert `status === 'failed'`, reason `context_unavailable` and `prepare` called exactly twice.

- [ ] **Step 3: T4.1 test**

- **Setup:** the processor calls `started.release()` and then `await gate.promise`. A flag `processorStarted` is set inside.
- **Assertions:**
  1. Right after `await requestQaSummary(...)`: `processorStarted === false` and `result.status === 'pending'`.
  2. After `await started.promise`, the status is still `'pending'`.
  3. After `gate.release()` and idle, the status is `'ready'`.

- [ ] **Step 4: Run with stability checks**

Run: `mise exec node@24.18.0 -- npm run test -w @arsnova/backend -- --run src/lib/qaSummaryQueue.test.ts src/lib/moderationQaContext.test.ts src/lib/wordCloudAnalysisCache.test.ts`, then the queue file 20 times (`for i in $(seq 20); do … --run src/lib/qaSummaryQueue.test.ts || break; done`), then once with `--sequence.shuffle`.
Expected: all pass every time.

- [ ] **Step 5: Mutation probes**

- T3: check `run.status === 'timeout'` before `sourceChanged` (`qaSummaryQueue.ts:341-353`). Expected: T3.1 FAIL, T3.3 PASS.
- T4: replace `pump()` in `requestQaSummary` with `await processJob(job)` (`qaSummaryQueue.ts:538`). Expected: T4.1 FAIL or timeout.
- T2.3: only if H held (see spec).

Revert all and record.

- [ ] **Step 6: Commit**

`test(qa-summary): cover source_changed precedence, decoupled host call and stale topic snapshots`

### Task 8: T5 — real database changes alter the snapshot hash

**Files:**

- Create: `apps/backend/src/__tests__/qa.summary-hash.pg.test.ts`
- Modify: `.github/workflows/ci.yml` (job `migration`, add a step after lines 380–390)
- Modify: `docs/TESTING.md` (new paragraph after lines 98–121)

**Interfaces:**

- Consumes:
  - from the `qa.scale.pg.test.ts` pattern, re-declared locally (not imported): `createQuestion`, `changeVote`, `code(prefix)`;
  - `prepareFreshModerationSummaryContext({ sessionId, locale: 'de', access: { hostToken: 'host-token' } })`;
  - `packModerationPromptContext` for the uncached determinism check;
  - `qaRouter.createCaller` for T5.4a (`moderate`, action `DELETE`) and T5.4b (`deleteOwn`).
- Mocks:
  - `../lib/hostAuth` with `buildHostAuthTestMock`, and `extractHostToken.mockReturnValue('host-token')`, as in `session.finalization-race.pg.test.ts:85`;
  - `assertParticipantCapability` (module of `qa.ts`'s import), resolving for T5.4b.
  - Nothing else is mocked.
- Flag: `RUN_PG_QA_SUMMARY_HASH_TESTS`. Requires `DATABASE_URL` and `REDIS_URL`.

- [ ] **Step 1: Suite skeleton**

- `describe.skipIf(process.env['RUN_PG_QA_SUMMARY_HASH_TESTS'] !== '1')('Q&A summary snapshot hash (PostgreSQL)', …)` with a German JSDoc header (flag, purpose, link to spec), as `sessionCleanup.orphan-scope.pg.test.ts` does.
- Per test: its own `Q_AND_A` session with `qaEnabled`, `qaOpen` and `qaModerationMode: false`, three participants and three questions (the minimum corpus).
- `beforeEach` deletes the session's Redis keys.
- `afterAll` deletes the sessions.

- [ ] **Step 2: T5.0–T5.5 tests**

`h(sessionId)` is the `request.promptContext.snapshotHash` of a fresh prepare, and `qv` is `request.promptContext.context.meta.revisions.questionVotes`.

| Case  | Assertion                                                                                                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T5.0  | `h` twice is equal. Two direct `packModerationPromptContext` calls on the same analysis give equal `snapshotHash`. Topic and feedback sections are `unavailable`.                                                 |
| T5.1  | After `changeVote(q1, p2, 'UP')`, `h` differs and `qv` contains the new `qaRankingRevision` read from `session`.                                                                                                  |
| T5.2  | After `createQuestion(...)`, `h` differs and the new question's id appears among the sources.                                                                                                                     |
| T5.3  | After `prisma.participant.create(...)`, `h` differs and `qv` ends with the new `participantRevision:participantCount`.                                                                                            |
| T5.4a | After `moderate({ action: 'DELETE' })` on q1, `h` differs and q1 is absent from the sources.                                                                                                                      |
| T5.4b | After `deleteOwn` on q2 by its author, `h` differs and q2 is absent from the sources.                                                                                                                             |
| T5.5  | Only if a QUIZ+Q&A setup is feasible within this suite; otherwise record it as a documented limitation (spec 5.5). After a quiz vote on the running question (`Vote` for a question not COMPLETED), `h` is equal. |

- [ ] **Step 3: Run locally twice**

Run: `docker compose up -d postgres redis && mise exec node@24.18.0 -- npx prisma migrate deploy && RUN_PG_QA_SUMMARY_HASH_TESTS=1 REDIS_URL=redis://localhost:6379 mise exec node@24.18.0 -- npm run test -w @arsnova/backend -- --run src/__tests__/qa.summary-hash.pg.test.ts` (twice)
Expected: PASS both times. Without the flag the suite is skipped.

- [ ] **Step 4: Mutation probes** (spec 5.3, T5 rows)

- Vote counters and revision removed: T5.1 FAIL.
- Participant revision and count removed from `questionVotes`: T5.3 FAIL.
- `meta` removed from `hashModerationPromptContextMaterial`: T5.3 FAIL and T5.0 PASS.

Revert all and record.

- [ ] **Step 5: CI and docs**

- In `ci.yml`, add a step in the `migration` job, modelled on lines 380–390: `env: { REDIS_URL: redis://localhost:6379, RUN_PG_QA_SUMMARY_HASH_TESTS: '1' }`, `working-directory: apps/backend`, `run: npx vitest run src/__tests__/qa.summary-hash.pg.test.ts`.
- In `docs/TESTING.md`, add a German paragraph with the purpose, the local command and the spec link.

Then run `mise exec node@24.18.0 -- npx prettier --check docs/TESTING.md .github/workflows/ci.yml` and the existing workflow lint, if available locally (`actionlint`).

- [ ] **Step 6: Commit**

`test(qa-summary): verify real database changes alter the summary snapshot hash`

### Task 9: Validation, findings, documentation

**Files:**

- Modify: `docs/referat-thema-1/evidenz/1C/2026-10-24-tests.md` (summary table)
- Modify: `docs/referat-thema-1/1C/1C-diagrams.md`, only if a hypothesis was refuted (e.g. T2.3, T5.5) or a finding needs a test reference

- [ ] **Step 1: Full validation**

Run: `mise exec node@24.18.0 -- npm run typecheck && mise exec node@24.18.0 -- npm run lint && mise exec node@24.18.0 -- npm test`
Expected: all exit 0. Record the summary lines.

- [ ] **Step 2: Production code untouched**

Run: `git diff --stat origin/main...HEAD -- apps libs | tail -1` and `git diff --name-only origin/main...HEAD -- apps libs`.
Expected: only `*.test.ts` files.

- [ ] **Step 3: Protocol summary**

Add a table: case | H confirmed / refuted | test name | mutation red → green. Add the findings with next steps (issue drafts for refuted hypotheses).

- [ ] **Step 4: Update the Referat document where outcomes require it**

In `1C/1C-diagrams.md`, link findings 3 and 4 to their test names, and correct any statement a refuted hypothesis contradicts.

- [ ] **Step 5: Commit, push, open the draft PR**

- Commit: `docs(referat): record 1C test results and findings`.
- Push.
- Open a draft PR into the fork's `main` with the full template, `Refs #10` (point 2 is still open) and the protocol linked under "Nachweise".
- After CI finishes, record the run ID in the protocol (follow-up commit).

## Nachtrag: KI-Nutzung (2026-10-24, nach der Ausführung)

Dieser Plan wurde mit Claude Code (Anthropic, Modell Claude Opus 5.5) entworfen und vom Autor vor der Ausführung freigegeben. Der übrige Inhalt ist seit der Freigabe unverändert; dieser Abschnitt ist der einzige Nachtrag. Einzelheiten zur KI-Nutzung: [`1C/1C-diagrams.md`](../1C/1C-diagrams.md#method-verification-and-ai-use). Der Hinweis „For agentic workers: REQUIRED SUB-SKILL …“ am Anfang ist eine Steueranweisung für den ausführenden KI-Agenten.
