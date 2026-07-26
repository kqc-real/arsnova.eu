import { TRPCError } from '@trpc/server';
import {
  RegisterYjsShareInputSchema,
  RegisterYjsShareOutputSchema,
  RotateYjsShareInputSchema,
  RotateYjsShareOutputSchema,
} from '@arsnova/shared-types';
import { publicProcedure, router } from '../trpc';
import { registerYjsShare, rotateYjsShare } from '../lib/yjsShareToken';
import { logger } from '../lib/logger';

function mapShareError(code: string): TRPCError {
  switch (code) {
    case 'INVALID_ROOM':
    case 'INVALID_CAPABILITY':
      return new TRPCError({ code: 'BAD_REQUEST', message: 'Ungültige Sync-Freigabe.' });
    case 'CAPABILITY_MISMATCH':
      return new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Sync-Link darf auf diesem Gerät nicht verwaltet werden.',
      });
    case 'NOT_REGISTERED':
      return new TRPCError({
        code: 'NOT_FOUND',
        message: 'Für diese Sammlung gibt es noch keinen Sync-Share.',
      });
    default:
      return new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Sync-Freigabe fehlgeschlagen.',
      });
  }
}

export const quizSyncRouter = router({
  registerShare: publicProcedure
    .input(RegisterYjsShareInputSchema)
    .output(RegisterYjsShareOutputSchema)
    .mutation(async ({ input }) => {
      try {
        const result = await registerYjsShare(input);
        logger.info('[security] yjs_share_registered', {
          created: result.created,
          generation: result.generation,
        });
        return result;
      } catch (error) {
        const code = error instanceof Error ? error.message : 'UNKNOWN';
        throw mapShareError(code);
      }
    }),

  rotateShare: publicProcedure
    .input(RotateYjsShareInputSchema)
    .output(RotateYjsShareOutputSchema)
    .mutation(async ({ input }) => {
      try {
        const result = await rotateYjsShare(input);
        logger.info('[security] yjs_share_rotated', {
          generation: result.generation,
        });
        return result;
      } catch (error) {
        const code = error instanceof Error ? error.message : 'UNKNOWN';
        throw mapShareError(code);
      }
    }),
});
