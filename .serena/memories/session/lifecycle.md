# Session Lifecycle

- Session status flow: `LOBBY` -> optional `QUESTION_OPEN` -> `ACTIVE` -> `RESULTS` -> optional `DISCUSSION` -> next question or `FINISHED`.
- `PAUSED` is an interrupt state for the same `QUESTION_OPEN` or `ACTIVE` phase, not a between-question phase. Persist `pausedFromStatus`; reject votes while paused; on resume shift `activeQuestionStartedAt` by the pause duration so room and personal timers retain their exact remaining time.
- Reading phase: when `readingPhaseEnabled=true`, host action for next question first enters `QUESTION_OPEN` and only shows the question stem. Host then reveals answers to enter `ACTIVE`.
- Without reading phase, next question can enter `ACTIVE` directly.
- Important live events/subscriptions include question revealed, answers revealed, results revealed, status changed, participant joined, and personal result/scorecard updates.
- Peer Instruction can use multiple rounds; preserve the effective-vote rule for scoring, leaderboards, bonus tokens, and exports.
- Canonical live state is in PostgreSQL; websocket/subscription clients must tolerate reconnect/resync behavior.
- Host views must keep a stable HTTP snapshot fallback (`session.getInfo` with neutral `currentQuestion`/`currentRound`) for active quiz sessions. Do not rely solely on websocket status events after reload/reconnect.
- Host-only realtime channels can fail because of host-token/WS reconnect timing. On subscription errors, avoid immediate recursive resubscribe + full refresh loops; use serialized fallback refreshes and throttled resubscribe, and only disable fallback once the host current-question subscription yields data again.
- Under high vote load, do not invalidate or emit the full host current-question DTO for every vote. Use the lightweight host vote-progress channel (`HostVoteProgressDTO`) for live `ACTIVE` counts, coalesce vote-driven progress signals briefly, and keep full question/result DTO refreshes tied to phase/question changes or explicit result loading.
- `onCurrentQuestionForHostChanged` also has periodic resync wakeups. During `ACTIVE`, its change key must ignore live progress-only fields (`totalVotes`, correctness counts, peer suggestion, distributions/stats) so a long join/vote burst cannot re-emit a full question DTO with only vote-count changes.
- Participant DTO shape depends on phase; read `mem:security/dto-stripping` before changing session payloads.

## Verwandte Memories:

- `mem:core`
- `mem:security/dto-stripping`
- `mem:backend/api-router`
- `mem:frontend/routing-components`
- `mem:modules/data-runtime`
- `mem:quality/dod`
