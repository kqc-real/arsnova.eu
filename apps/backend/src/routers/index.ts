import { router } from '../trpc';
import { healthRouter } from './health';
import { sessionRouter } from './session';
import { voteRouter } from './vote';
import { quickFeedbackRouter } from './quickFeedback';

/**
 * Der zentrale App-Router.
 * Alle Sub-Router werden hier zusammengeführt.
 * Der Typ `AppRouter` wird vom Frontend importiert (via @arsnova/api).
 */
export const appRouter = router({
  health: healthRouter,
  session: sessionRouter,
  vote: voteRouter,
  quickFeedback: quickFeedbackRouter,
});

/** Der exportierte Typ für den tRPC-Client im Frontend */
export type AppRouter = typeof appRouter;
