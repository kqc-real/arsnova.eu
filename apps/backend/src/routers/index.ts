import { router } from '../trpc';
import { healthRouter } from './health';
import { quizRouter } from './quiz';
import { sessionRouter } from './session';
import { voteRouter } from './vote';
import { quickFeedbackRouter } from './quickFeedback';
import { qaRouter } from './qa';
import { adminRouter } from './admin';
import { motdRouter } from './motd';
import { wordCloudRouter } from './wordCloud';
import { quizSyncRouter } from './quizSync';

/**
 * Der zentrale App-Router.
 * Alle Sub-Router werden hier zusammengeführt.
 * Der Typ `AppRouter` wird vom Frontend importiert (via @arsnova/api).
 */
export const appRouter = router({
  health: healthRouter,
  quiz: quizRouter,
  quizSync: quizSyncRouter,
  session: sessionRouter,
  vote: voteRouter,
  qa: qaRouter,
  quickFeedback: quickFeedbackRouter,
  wordCloud: wordCloudRouter,
  admin: adminRouter,
  motd: motdRouter,
});

/** Der exportierte Typ für den tRPC-Client im Frontend */
export type AppRouter = typeof appRouter;
