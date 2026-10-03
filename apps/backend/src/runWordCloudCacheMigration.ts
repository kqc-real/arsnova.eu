/**
 * Fail-closed production rollout gate after the previous app writer drained.
 * It clears every persistent word-cloud analysis-cache generation and removes
 * pre-sessionId, session-bound quick-feedback rounds before the replacement
 * process accepts traffic. Standalone and already identity-bound rounds stay
 * intact; the analysis cache deliberately starts cold.
 */
import './load-env';
import { closeRedis } from './redis';
import { logger } from './lib/logger';
import { evictLegacySessionBoundQuickFeedbackForRollout } from './lib/quickFeedbackSessionPurge';
import { evictAllWordCloudAnalysisCacheForRollout } from './lib/wordCloudAnalysisCache';

async function main(): Promise<void> {
  const wordCloudDeleted = await evictAllWordCloudAnalysisCacheForRollout();
  const quickFeedbackDeleted = await evictLegacySessionBoundQuickFeedbackForRollout();
  logger.info('wordcloud:rollout_cache_purge_complete', {
    wordCloudDeleted,
    quickFeedbackDeleted,
  });
}

main()
  .then(() => closeRedis())
  .catch(async (error: unknown) => {
    logger.error('wordcloud:rollout_cache_purge_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    await closeRedis().catch(() => undefined);
    process.exit(1);
  });
