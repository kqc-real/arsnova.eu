/**
 * ProductFeedback — öffentlicher Post-Session-Kanal (Story 12.1).
 */
import { TRPCError } from '@trpc/server';
import {
  PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS,
  PRODUCT_FEEDBACK_INVITE_TTL_SECONDS,
  PRODUCT_FEEDBACK_MESSAGE_MAX,
  ProductFeedbackFollowUpInputSchema,
  ProductFeedbackFollowUpOutputSchema,
  ProductFeedbackGetSurveyInputSchema,
  ProductFeedbackGetSurveyOutputSchema,
  ProductFeedbackInviteClaimInputSchema,
  ProductFeedbackInviteClaimOutputSchema,
  ProductFeedbackSubmitInputSchema,
  ProductFeedbackSubmitOutputSchema,
  isAreaAllowedForSurvey,
  isPrimaryAnswerAllowedForSurvey,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import { extractHostTokenFromContext, isHostSessionTokenValid } from '../lib/hostAuth';
import {
  claimProductFeedbackInvite,
  createFollowUpCapability,
  getIdempotentResult,
  getInvitePayloadByToken,
  finalizeInviteUsed,
  releaseInviteReservation,
  reserveInviteForSubmit,
  consumeFollowUpCapability,
  releaseFollowUpReservation,
  setIdempotentResult,
  surveyDtoForKey,
} from '../lib/productFeedbackTokens';
import { checkProductFeedbackClaimRate, checkProductFeedbackMutateRate } from '../lib/rateLimit';
import { publicProcedure, resolveClientIp, router, type Context } from '../trpc';

async function enforceClaimRate(ctx: Context): Promise<void> {
  const ip = resolveClientIp(ctx.req).ip;
  const result = await checkProductFeedbackClaimRate(ip);
  if (!result.allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Zu viele Anfragen. Bitte kurz warten.',
    });
  }
}

async function enforceMutateRate(ctx: Context): Promise<void> {
  const ip = resolveClientIp(ctx.req).ip;
  const result = await checkProductFeedbackMutateRate(ip);
  if (!result.allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Zu viele Anfragen. Bitte kurz warten.',
    });
  }
}

export const productFeedbackRouter = router({
  /**
   * Claim einer serverseitig ausgestellten Einladung (Stichprobe).
   * Host: gültiges x-host-token. Teilnehmer: participantId muss zur Session gehören.
   */
  claimInvite: publicProcedure
    .input(ProductFeedbackInviteClaimInputSchema)
    .output(ProductFeedbackInviteClaimOutputSchema)
    .query(async ({ input, ctx }) => {
      await enforceClaimRate(ctx);
      const code = input.sessionCode.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
        select: { id: true, status: true },
      });
      if (!session || session.status !== 'FINISHED') {
        return { inviteToken: null, survey: null };
      }

      let subjectId: string;
      if (input.role === 'HOST') {
        const token = extractHostTokenFromContext(ctx);
        if (!token || !(await isHostSessionTokenValid(code, token))) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Host-Token fehlt oder ist ungültig.',
          });
        }
        subjectId = 'host';
      } else {
        if (!input.participantId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'participantId ist für Teilnehmende erforderlich.',
          });
        }
        const participant = await prisma.participant.findFirst({
          where: { id: input.participantId, sessionId: session.id },
          select: { id: true },
        });
        if (!participant) {
          return { inviteToken: null, survey: null };
        }
        subjectId = participant.id;
      }

      const inviteToken = await claimProductFeedbackInvite({
        sessionId: session.id,
        role: input.role,
        subjectId,
      });
      if (!inviteToken) return { inviteToken: null, survey: null };
      const payload = await getInvitePayloadByToken(inviteToken);
      if (!payload) return { inviteToken: null, survey: null };
      return {
        inviteToken,
        survey: surveyDtoForKey(payload.surveyKey),
      };
    }),

  getSurvey: publicProcedure
    .input(ProductFeedbackGetSurveyInputSchema)
    .output(ProductFeedbackGetSurveyOutputSchema)
    .query(async ({ input, ctx }) => {
      await enforceClaimRate(ctx);
      const payload = await getInvitePayloadByToken(input.inviteToken);
      if (!payload) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Einladung abgelaufen oder ungültig.',
        });
      }
      return {
        inviteToken: input.inviteToken,
        survey: surveyDtoForKey(payload.surveyKey),
      };
    }),

  submit: publicProcedure
    .input(ProductFeedbackSubmitInputSchema)
    .output(ProductFeedbackSubmitOutputSchema)
    .mutation(async ({ input, ctx }) => {
      await enforceMutateRate(ctx);

      const cached = await getIdempotentResult<{
        ok: true;
        followUpCapability: string;
      }>('submit', input.idempotencyKey);
      if (cached) return cached;

      const payload = await getInvitePayloadByToken(input.inviteToken);
      if (!payload) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Einladung abgelaufen oder ungültig.',
        });
      }
      if (!isPrimaryAnswerAllowedForSurvey(payload.surveyKey, input.primaryAnswer)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Primärantwort passt nicht zur Fragefamilie.',
        });
      }
      if (!isAreaAllowedForSurvey(payload.surveyKey, input.area)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Bereich passt nicht zur Rolle.',
        });
      }

      const reserved = await reserveInviteForSubmit(input.inviteToken);
      if (!reserved) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Einladung wurde bereits verwendet.',
        });
      }

      try {
        const row = await prisma.productFeedback.create({
          data: {
            source: 'POST_SESSION',
            role: reserved.role,
            surveyKey: reserved.surveyKey,
            surveyVersion: reserved.surveyVersion,
            primaryAnswer: input.primaryAnswer,
            area: input.area,
            locale: input.locale,
            appVersion: input.appVersion?.slice(0, 64) ?? null,
            sessionKind: reserved.sessionKind,
            featureAreas: reserved.featureAreas,
            sessionSizeClass: reserved.sessionSizeClass,
            deviceClass: input.deviceClass,
          },
          select: { id: true },
        });

        await finalizeInviteUsed(input.inviteToken, reserved);

        const followUpCapability = await createFollowUpCapability(row.id);
        const output = { ok: true as const, followUpCapability };
        await setIdempotentResult(
          'submit',
          input.idempotencyKey,
          output,
          PRODUCT_FEEDBACK_INVITE_TTL_SECONDS,
        );
        return output;
      } catch (err) {
        await releaseInviteReservation(input.inviteToken);
        throw err;
      }
    }),

  followUp: publicProcedure
    .input(ProductFeedbackFollowUpInputSchema)
    .output(ProductFeedbackFollowUpOutputSchema)
    .mutation(async ({ input, ctx }) => {
      await enforceMutateRate(ctx);

      const cached = await getIdempotentResult<{ ok: true }>('followUp', input.idempotencyKey);
      if (cached) return cached;

      const message = input.message.trim().slice(0, PRODUCT_FEEDBACK_MESSAGE_MAX);
      if (!message) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Anmerkung darf nicht leer sein.',
        });
      }

      const capability = await consumeFollowUpCapability(input.followUpCapability);
      if (!capability) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ergänzung abgelaufen oder ungültig.',
        });
      }

      try {
        const existing = await prisma.productFeedback.findUnique({
          where: { id: capability.feedbackId },
          select: { id: true, message: true },
        });
        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Rückmeldung nicht gefunden.',
          });
        }
        if (!existing.message) {
          await prisma.productFeedback.update({
            where: { id: existing.id },
            data: { message },
          });
        }

        const output = { ok: true as const };
        await setIdempotentResult(
          'followUp',
          input.idempotencyKey,
          output,
          PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS,
        );
        return output;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        await releaseFollowUpReservation(input.followUpCapability);
        throw err;
      }
    }),
});
