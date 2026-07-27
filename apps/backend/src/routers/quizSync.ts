import { TRPCError } from '@trpc/server';
import {
  CreateYjsShareInputSchema,
  CreateYjsShareOutputSchema,
  RotateYjsShareInputSchema,
  RotateYjsShareOutputSchema,
  ValidateYjsShareInputSchema,
  ValidateYjsShareOutputSchema,
} from '@arsnova/shared-types';
import { publicProcedure, router, resolveClientIp } from '../trpc';
import { authorizeYjsRoomUpgrade, createYjsShare, rotateYjsShare } from '../lib/yjsShareToken';
import {
  checkYjsShareRegisterRate,
  checkYjsShareRotateRate,
  checkYjsShareValidateRate,
} from '../lib/rateLimit';
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
  validateShare: publicProcedure
    .input(ValidateYjsShareInputSchema)
    .output(ValidateYjsShareOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const limit = await checkYjsShareValidateRate(resolveClientIp(ctx.req).ip);
      if (!limit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zu viele Sync-Token-Prüfungen. Bitte später erneut versuchen.',
          cause: { retryAfterSeconds: limit.retryAfterSeconds },
        });
      }
      try {
        const authorization = await authorizeYjsRoomUpgrade({
          roomId: input.roomId,
          shareToken: input.shareToken,
        });
        return { valid: authorization.ok };
      } catch {
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Sync-Freigabe kann vorübergehend nicht geprüft werden.',
        });
      }
    }),

  createShare: publicProcedure
    .input(CreateYjsShareInputSchema)
    .output(CreateYjsShareOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertYjsShareRegisterAllowed(resolveClientIp(ctx.req).ip);
      try {
        const result = await createYjsShare(input);
        logger.info('[security] yjs_share_created', {
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
