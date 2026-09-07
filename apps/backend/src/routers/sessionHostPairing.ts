/**
 * Story 2.10 Slice 1 — Pairing-Prozeduren (ohne Host-UI).
 */
import { TRPCError } from '@trpc/server';
import {
  ApproveHostPairingInputSchema,
  ApproveHostPairingOutputSchema,
  CreateHostPairingInviteInputSchema,
  CreateHostPairingInviteOutputSchema,
  GetHostPairingRequestInputSchema,
  GetHostPairingRequestOutputSchema,
  ListPairedHostsInputSchema,
  ListPairedHostsOutputSchema,
  RejectHostPairingInputSchema,
  RejectHostPairingOutputSchema,
  RequestHostPairingInputSchema,
  RequestHostPairingOutputSchema,
  RevokePairedHostInputSchema,
  RevokePairedHostOutputSchema,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import {
  approveHostPairing,
  createHostPairingInvite,
  getHostPairingCaps,
  getHostPairingRequest,
  isHostPairingServiceError,
  listHostPairingState,
  rejectHostPairing,
  requestHostPairing,
  revokePairedHost,
} from '../lib/hostPairing';
import {
  checkHostPairingClaimRate,
  checkHostPairingDecisionRate,
  checkHostPairingInviteRate,
  checkHostPairingRequestRate,
} from '../lib/rateLimit';
import { getClientIp, originalHostProcedure, publicProcedure, router } from '../trpc';

function throwPairingError(error: unknown): never {
  if (isHostPairingServiceError(error)) {
    const code =
      error.pairingCode === 'NOT_ORIGINAL_HOST' || error.pairingCode === 'PAIRING_CAP_REACHED'
        ? 'FORBIDDEN'
        : error.pairingCode === 'RATE_LIMITED'
          ? 'TOO_MANY_REQUESTS'
          : error.pairingCode === 'HOST_REQUIRED'
            ? 'UNAUTHORIZED'
            : error.pairingCode === 'SESSION_NOT_FOUND' || error.pairingCode === 'REQUEST_NOT_FOUND'
              ? 'NOT_FOUND'
              : error.pairingCode === 'ALREADY_PENDING'
                ? 'CONFLICT'
                : 'BAD_REQUEST';
    throw new TRPCError({ code, message: error.message });
  }
  throw error;
}

async function assertLiveSession(code: string): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { code },
    select: { id: true, status: true },
  });
  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
  }
  if (session.status === 'FINISHED') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Die Veranstaltung ist bereits beendet.',
    });
  }
}

function throwIfLimited(limit: { allowed: boolean; retryAfterSeconds?: number }): void {
  if (!limit.allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Zu viele Verbindungsversuche. Bitte später erneut versuchen.',
      cause: { retryAfterSeconds: limit.retryAfterSeconds },
    });
  }
}

export const sessionHostPairingRouter = router({
  createHostPairingInvite: originalHostProcedure
    .input(CreateHostPairingInviteInputSchema)
    .output(CreateHostPairingInviteOutputSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      throwIfLimited(await checkHostPairingInviteRate(code));
      await assertLiveSession(code);
      try {
        const created = await createHostPairingInvite({
          sessionCode: code,
          screenVisibility: input.screenVisibility,
        });
        return {
          inviteId: created.inviteId,
          pairingSecret: created.pairingSecret,
          expiresAt: created.expiresAt,
          state: 'PAIRING_INVITE_CREATED' as const,
          screenVisibility: created.screenVisibility,
          caps: getHostPairingCaps(),
        };
      } catch (error) {
        throwPairingError(error);
      }
    }),

  requestHostPairing: publicProcedure
    .input(RequestHostPairingInputSchema)
    .output(RequestHostPairingOutputSchema)
    .mutation(async ({ ctx, input }) => {
      throwIfLimited(await checkHostPairingRequestRate(getClientIp(ctx)));
      const code = input.code.toUpperCase();
      await assertLiveSession(code);
      try {
        const requested = await requestHostPairing({
          sessionCode: code,
          pairingSecret: input.pairingSecret,
          deviceLabel: input.deviceLabel,
        });
        return {
          requestId: requested.requestId,
          requestSecret: requested.requestSecret,
          confirmationIndicator: requested.confirmationIndicator,
          state: 'PENDING_APPROVAL' as const,
          alreadyPending: requested.alreadyPending,
          expiresAt: requested.expiresAt,
        };
      } catch (error) {
        throwPairingError(error);
      }
    }),

  getHostPairingRequest: publicProcedure
    .input(GetHostPairingRequestInputSchema)
    .output(GetHostPairingRequestOutputSchema)
    .query(async ({ ctx, input }) => {
      throwIfLimited(await checkHostPairingClaimRate(getClientIp(ctx)));
      const code = input.code.toUpperCase();
      try {
        return await getHostPairingRequest({
          sessionCode: code,
          requestId: input.requestId,
          requestSecret: input.requestSecret,
        });
      } catch (error) {
        throwPairingError(error);
      }
    }),

  approveHostPairing: originalHostProcedure
    .input(ApproveHostPairingInputSchema)
    .output(ApproveHostPairingOutputSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      throwIfLimited(await checkHostPairingDecisionRate(code));
      await assertLiveSession(code);
      try {
        const approved = await approveHostPairing({
          sessionCode: code,
          requestId: input.requestId,
        });
        return {
          requestId: input.requestId,
          tokenId: approved.tokenId,
          state: 'CONNECTED' as const,
          confirmationIndicator: approved.confirmationIndicator,
        };
      } catch (error) {
        throwPairingError(error);
      }
    }),

  rejectHostPairing: originalHostProcedure
    .input(RejectHostPairingInputSchema)
    .output(RejectHostPairingOutputSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      throwIfLimited(await checkHostPairingDecisionRate(code));
      try {
        await rejectHostPairing({
          sessionCode: code,
          requestId: input.requestId,
        });
        return { requestId: input.requestId, state: 'REJECTED' as const };
      } catch (error) {
        throwPairingError(error);
      }
    }),

  revokePairedHost: originalHostProcedure
    .input(RevokePairedHostInputSchema)
    .output(RevokePairedHostOutputSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      throwIfLimited(await checkHostPairingDecisionRate(code));
      try {
        await revokePairedHost({
          sessionCode: code,
          tokenId: input.tokenId,
        });
        return { tokenId: input.tokenId, state: 'REVOKED' as const };
      } catch (error) {
        throwPairingError(error);
      }
    }),

  listPairedHosts: originalHostProcedure
    .input(ListPairedHostsInputSchema)
    .output(ListPairedHostsOutputSchema)
    .query(async ({ input }) => {
      const code = input.code.toUpperCase();
      const state = await listHostPairingState(code);
      return {
        devices: state.pairedHosts.map((device) => ({
          tokenId: device.tokenId,
          deviceLabel: device.deviceLabel,
          pairedAt: device.pairedAt,
          state: 'CONNECTED' as const,
        })),
        pending: state.pending
          ? {
              requestId: state.pending.requestId,
              confirmationIndicator: state.pending.confirmationIndicator,
              deviceLabel: state.pending.deviceLabel,
              state: 'PENDING_APPROVAL' as const,
              expiresAt: state.pending.expiresAt,
              createdAt: state.pending.createdAt,
            }
          : null,
        invite: state.invite
          ? {
              inviteId: state.invite.inviteId,
              state: state.invite.state,
              screenVisibility: state.invite.screenVisibility,
              expiresAt: state.invite.expiresAt,
            }
          : null,
        caps: getHostPairingCaps(),
      };
    }),
});
