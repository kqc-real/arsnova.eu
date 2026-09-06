/**
 * ProductFeedback — öffentlicher Post-Session-Kanal (Story 12.1).
 */
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import {
  PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS,
  PRODUCT_FEEDBACK_IN_APP_CHALLENGE_TTL_SECONDS,
  PRODUCT_FEEDBACK_IN_APP_MESSAGE_MAX,
  PRODUCT_FEEDBACK_INVITE_TTL_SECONDS,
  PRODUCT_FEEDBACK_MESSAGE_MAX,
  ProductFeedbackFollowUpInputSchema,
  ProductFeedbackFollowUpOutputSchema,
  ProductFeedbackGetSurveyInputSchema,
  ProductFeedbackGetSurveyOutputSchema,
  ProductFeedbackInviteClaimInputSchema,
  ProductFeedbackInviteClaimOutputSchema,
  ProductFeedbackInAppChallengeInputSchema,
  ProductFeedbackInAppChallengeOutputSchema,
  ProductFeedbackInAppFollowUpInputSchema,
  ProductFeedbackInAppSubmitInputSchema,
  ProductFeedbackInAppSubmitOutputSchema,
  ProductFeedbackSubmitInputSchema,
  ProductFeedbackSubmitOutputSchema,
  isAreaAllowedForSurvey,
  isPrimaryAnswerAllowedForSurvey,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import { extractHostTokenFromContext, isHostSessionTokenValid } from '../lib/hostAuth';
import {
  createInAppChallenge,
  finalizeInAppChallenge,
  isProductFeedbackOriginAllowed,
  releaseInAppChallenge,
  reserveInAppChallenge,
  shouldQuarantineProductFeedbackMessage,
} from '../lib/productFeedbackInApp';
import {
  claimProductFeedbackInvite,
  createFollowUpCapability,
  finalizeFollowUpCapability,
  getIdempotentResult,
  getInvitePayloadByToken,
  finalizeInviteUsed,
  releaseInviteReservation,
  reserveInviteForSubmit,
  consumeFollowUpCapability,
  releaseFollowUpReservation,
  setIdempotentResult,
  surveyDtoForKey,
  hashToken,
} from '../lib/productFeedbackTokens';
import { checkProductFeedbackClaimRate, checkProductFeedbackMutateRate } from '../lib/rateLimit';
import { resolveAppVersion } from '../lib/appVersion';
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

function enforceInAppOrigin(ctx: Context): void {
  if (!isProductFeedbackOriginAllowed(ctx.req)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Produktfeedback ist nur aus der arsnova.eu-App zulässig.',
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
    .mutation(async ({ input, ctx }) => {
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
          where: {
            id: input.participantId,
            sessionId: session.id,
            productFeedbackClaimTokenHash: hashToken(input.participantClaimToken ?? ''),
          },
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
        ...(input.role === 'PARTICIPANT'
          ? { participantClaimToken: input.participantClaimToken }
          : {}),
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
      const inviteFingerprint = hashToken(input.inviteToken);
      const submitIdempotencyHash = hashToken(input.idempotencyKey);
      const idempotencyKind = `submit:${inviteFingerprint}`;

      const cached = await getIdempotentResult<{
        ok: true;
        followUpCapability: string;
      }>(idempotencyKind, input.idempotencyKey);
      if (cached) return cached;

      const finishExistingSubmit = async (row: {
        id: string;
        createdAt: Date;
        inviteFingerprint: string | null;
      }) => {
        if (row.inviteFingerprint !== inviteFingerprint) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Idempotency-Key gehört zu einer anderen Einladung.',
          });
        }
        const storedInvite = await getInvitePayloadByToken(input.inviteToken, {
          includeUsed: true,
        });
        if (storedInvite && !storedInvite.used) {
          await finalizeInviteUsed(input.inviteToken, storedInvite);
        }
        const expiresAt = new Date(
          row.createdAt.getTime() + PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS * 1000,
        );
        const followUpCapability = await createFollowUpCapability(
          row.id,
          input.inviteToken,
          expiresAt,
        );
        const output = { ok: true as const, followUpCapability };
        await setIdempotentResult(
          idempotencyKind,
          input.idempotencyKey,
          output,
          PRODUCT_FEEDBACK_INVITE_TTL_SECONDS,
        );
        return output;
      };

      const existing = await prisma.productFeedback.findUnique({
        where: { submitIdempotencyHash },
        select: { id: true, createdAt: true, inviteFingerprint: true },
      });
      if (existing) return finishExistingSubmit(existing);

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
            inviteFingerprint,
            submitIdempotencyHash,
            source: 'POST_SESSION',
            role: reserved.role,
            surveyKey: reserved.surveyKey,
            surveyVersion: reserved.surveyVersion,
            primaryAnswer: input.primaryAnswer,
            area: input.area,
            locale: input.locale,
            appVersion: resolveAppVersion(input.appVersion),
            sessionKind: reserved.sessionKind,
            featureAreas: reserved.featureAreas,
            sessionSizeClass: reserved.sessionSizeClass,
            deviceClass: input.deviceClass,
          },
          select: { id: true, createdAt: true, inviteFingerprint: true },
        });

        await finalizeInviteUsed(input.inviteToken, reserved);
        return finishExistingSubmit(row);
      } catch (err) {
        await releaseInviteReservation(input.inviteToken);
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const raced = await prisma.productFeedback.findFirst({
            where: {
              OR: [{ inviteFingerprint }, { submitIdempotencyHash }],
            },
            select: { id: true, createdAt: true, inviteFingerprint: true },
          });
          if (raced?.inviteFingerprint === inviteFingerprint) {
            return finishExistingSubmit(raced);
          }
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Einladung wurde bereits verwendet.',
          });
        }
        throw err;
      }
    }),

  followUp: publicProcedure
    .input(ProductFeedbackFollowUpInputSchema)
    .output(ProductFeedbackFollowUpOutputSchema)
    .mutation(async ({ input, ctx }) => {
      await enforceMutateRate(ctx);

      const followUpFingerprint = hashToken(input.followUpCapability);
      const followUpIdempotencyHash = hashToken(`${followUpFingerprint}:${input.idempotencyKey}`);
      const idempotencyKind = `followUp:${followUpFingerprint}`;
      const cached = await getIdempotentResult<{ ok: true }>(idempotencyKind, input.idempotencyKey);
      if (cached) return cached;
      const prior = await prisma.productFeedback.findUnique({
        where: { followUpIdempotencyHash },
        select: { id: true },
      });
      if (prior) {
        const output = { ok: true as const };
        await finalizeFollowUpCapability(input.followUpCapability);
        await setIdempotentResult(
          idempotencyKind,
          input.idempotencyKey,
          output,
          PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS,
        );
        return output;
      }

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
          select: { id: true, message: true, followUpIdempotencyHash: true },
        });
        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Rückmeldung nicht gefunden.',
          });
        }
        if (existing.message && existing.followUpIdempotencyHash !== followUpIdempotencyHash) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Diese Rückmeldung wurde bereits ergänzt.',
          });
        }
        await prisma.productFeedback.update({
          where: { id: existing.id },
          data: { message, followUpIdempotencyHash },
        });

        const output = { ok: true as const };
        await finalizeFollowUpCapability(input.followUpCapability);
        await setIdempotentResult(
          idempotencyKind,
          input.idempotencyKey,
          output,
          PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS,
        );
        return output;
      } catch (err) {
        if (err instanceof TRPCError) {
          await finalizeFollowUpCapability(input.followUpCapability);
          throw err;
        }
        await releaseFollowUpReservation(input.followUpCapability);
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const raced = await prisma.productFeedback.findUnique({
            where: { followUpIdempotencyHash },
            select: { id: true },
          });
          if (raced?.id === capability.feedbackId) return { ok: true as const };
        }
        throw err;
      }
    }),

  /**
   * Stellt eine kurzlebige, an den Idempotency-Key gebundene IN_APP-Challenge aus.
   * Die Mutation ist auf Browser-Same-Origin begrenzt.
   */
  getInAppChallenge: publicProcedure
    .input(ProductFeedbackInAppChallengeInputSchema)
    .output(ProductFeedbackInAppChallengeOutputSchema)
    .mutation(async ({ input, ctx }) => {
      enforceInAppOrigin(ctx);
      await enforceClaimRate(ctx);
      const cached = await getIdempotentResult<{
        challengeToken: string;
        expiresAt: string;
      }>('inAppChallenge', input.idempotencyKey);
      if (cached) return cached;

      const output = await createInAppChallenge(input.idempotencyKey);
      await setIdempotentResult(
        'inAppChallenge',
        input.idempotencyKey,
        output,
        PRODUCT_FEEDBACK_IN_APP_CHALLENGE_TTL_SECONDS,
      );
      return output;
    }),

  /**
   * Speichert nach zwei bewussten Auswahlen ein anonymes, strukturiertes IN_APP-Signal.
   * Es werden ausschließlich Felder aus dem Shared-Context-Whitelist-Schema persistiert.
   */
  submitInApp: publicProcedure
    .input(ProductFeedbackInAppSubmitInputSchema)
    .output(ProductFeedbackInAppSubmitOutputSchema)
    .mutation(async ({ input, ctx }) => {
      enforceInAppOrigin(ctx);
      await enforceMutateRate(ctx);
      const cached = await getIdempotentResult<{
        ok: true;
        followUpCapability: string;
        followUpExpiresAt: string;
      }>('inAppSubmit', input.idempotencyKey);
      if (cached) return cached;

      const reserved = await reserveInAppChallenge(input.challengeToken, input.idempotencyKey);
      if (!reserved) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Challenge ist abgelaufen, ungültig oder wurde bereits verwendet.',
        });
      }

      try {
        const row = await prisma.productFeedback.create({
          data: {
            source: 'IN_APP',
            role: input.role,
            surveyKey: null,
            primaryAnswer: null,
            feedbackKind: input.kind,
            area: input.area,
            locale: input.context.locale,
            appVersion: input.context.appVersion ?? null,
            deviceClass: input.context.deviceClass,
            routeGroup: input.context.routeGroup,
            sessionPhase: input.context.sessionPhase,
            activeChannel: input.context.activeChannel,
            browserFamily: input.context.browserFamily,
            browserMajorVersion: input.context.browserMajorVersion ?? null,
            osFamily: input.context.osFamily,
            onlineState: input.context.onlineState,
            errorRequestId: input.context.errorRequestId ?? null,
          },
          select: { id: true },
        });

        const followUpExpiresAt = new Date(
          Date.now() + PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS * 1_000,
        );
        const followUpCapability = await createFollowUpCapability(
          row.id,
          input.challengeToken,
          followUpExpiresAt,
        );
        const output = {
          ok: true as const,
          followUpCapability,
          followUpExpiresAt: followUpExpiresAt.toISOString(),
        };
        await finalizeInAppChallenge(input.challengeToken);
        await setIdempotentResult(
          'inAppSubmit',
          input.idempotencyKey,
          output,
          PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS,
        );
        return output;
      } catch (error) {
        await releaseInAppChallenge(input.challengeToken);
        throw error;
      }
    }),

  /**
   * Ergänzt genau einmal optionalen Plaintext und/oder die Auswirkung.
   * Die Capability gewährt weder Lesezugriff noch Änderungen am strukturierten Signal.
   */
  followUpInApp: publicProcedure
    .input(ProductFeedbackInAppFollowUpInputSchema)
    .output(ProductFeedbackFollowUpOutputSchema)
    .mutation(async ({ input, ctx }) => {
      enforceInAppOrigin(ctx);
      await enforceMutateRate(ctx);
      const idempotencyScope = `${hashToken(input.followUpCapability)}:${input.idempotencyKey}`;
      const cached = await getIdempotentResult<{ ok: true }>('inAppFollowUp', idempotencyScope);
      if (cached) return cached;

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
          select: {
            id: true,
            source: true,
            feedbackKind: true,
            message: true,
            impact: true,
          },
        });
        if (!existing || existing.source !== 'IN_APP') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Rückmeldung nicht gefunden.',
          });
        }
        if (input.impact && existing.feedbackKind !== 'NOT_WORKING') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Eine Auswirkung ist nur bei Funktionsproblemen zulässig.',
          });
        }

        const message = input.message?.trim().slice(0, PRODUCT_FEEDBACK_IN_APP_MESSAGE_MAX);
        await prisma.productFeedback.update({
          where: { id: existing.id },
          data: {
            ...(message && !existing.message ? { message } : {}),
            ...(input.impact && !existing.impact ? { impact: input.impact } : {}),
            ...(message && shouldQuarantineProductFeedbackMessage(message)
              ? { quarantineStatus: 'FLAGGED' }
              : {}),
          },
        });

        const output = { ok: true as const };
        await setIdempotentResult(
          'inAppFollowUp',
          idempotencyScope,
          output,
          PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS,
        );
        return output;
      } catch (error) {
        await releaseFollowUpReservation(input.followUpCapability);
        throw error;
      }
    }),
});
