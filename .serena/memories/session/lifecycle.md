# Session Lifecycle

- Session status flow: `LOBBY` -> optional `QUESTION_OPEN` -> `ACTIVE` -> `RESULTS` -> optional `DISCUSSION`/`PAUSED` -> next question or `FINISHED`.
- Reading phase: when `readingPhaseEnabled=true`, host action for next question first enters `QUESTION_OPEN` and only shows the question stem. Host then reveals answers to enter `ACTIVE`.
- Without reading phase, next question can enter `ACTIVE` directly.
- Important live events/subscriptions include question revealed, answers revealed, results revealed, status changed, participant joined, and personal result/scorecard updates.
- Peer Instruction can use multiple rounds; preserve the effective-vote rule for scoring, leaderboards, bonus tokens, and exports.
- Canonical live state is in PostgreSQL; websocket/subscription clients must tolerate reconnect/resync behavior.
- Participant DTO shape depends on phase; read `mem:security/dto-stripping` before changing session payloads.

## Verwandte Memories:

- `mem:core`
- `mem:security/dto-stripping`
- `mem:backend/api-router`
- `mem:frontend/routing-components`
- `mem:modules/data-runtime`
- `mem:quality/dod`
