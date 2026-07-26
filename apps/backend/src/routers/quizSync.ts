import { TRPCError } from '@trpc/server';
import {
  RegisterYjsShareInputSchema,
  RegisterYjsShareOutputSchema,
  RotateYjsShareInputSchema,
  RotateYjsShareOutputSchema,
} from '@arsnova/shared-types';
import { publicProcedure, router, resolveClientIp } from '../trpc';
import { registerYjsShare, rotateYjsShare } from '../lib/yjsShareToken';
import { checkYjsShareRegisterRate, checkYjsShareRotateRate } from '../lib/rateLimit';
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
    case 'MUST_REKEY':
      return new TRPCError({
        code: 'CONFLICT',
        message:
          'Dieser Sync-Raum wurde bereits ohne Token genutzt. Bitte einen neuen Sync-Link erstellen.',
      });
    case 'GLOBAL_CAP':
      return new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Sync-Freigaben sind vorübergehend ausgelastet. Bitte später erneut versuchen.',
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

async function assertYjsShareRegisterAllowed(ip: string): Promise<void> {
  const limit = await checkYjsShareRegisterRate(ip);
  if (!limit.allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Zu viele Sync-Freigaben. Bitte später erneut versuchen.',
      cause: { retryAfterSeconds: limit.retryAfterSeconds },
    });
  }
}

async function assertYjsShareRotateAllowed(ip: string): Promise<void> {
  const limit = await checkYjsShareRotateRate(ip);
  if (!limit.allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Zu viele Sync-Link-Rotationen. Bitte später erneut versuchen.',
      cause: { retryAfterSeconds: limit.retryAfterSeconds },
    });
  }
}

export const quizSyncRouter = router({
  registerShare: publicProcedure
    .input(RegisterYjsShareInputSchema)
    .output(RegisterYjsShareOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertYjsShareRegisterAllowed(resolveClientIp(ctx.req).ip);
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
    .mutation(async ({ ctx, input }) => {
      await assertYjsShareRotateAllowed(resolveClientIp(ctx.req).ip);
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
