/**
 * Admin — ProductFeedback-Statistik (Story 12.1).
 */
import {
  AdminProductFeedbackStatsDTOSchema,
  AdminProductFeedbackStatsInputSchema,
} from '@arsnova/shared-types';
import { buildProductFeedbackAdminStats } from '../lib/productFeedbackStats';
import { adminProcedure, router } from '../trpc';

export const adminProductFeedbackRouter = router({
  getStats: adminProcedure
    .input(AdminProductFeedbackStatsInputSchema)
    .output(AdminProductFeedbackStatsDTOSchema)
    .query(async ({ input }) => buildProductFeedbackAdminStats(input)),
});
