/**
 * ProductFeedback — Epic 12 / Story 12.1
 * Strikt getrennt von SessionFeedback (4.8) und quickFeedback/Blitzlicht.
 */
import { z } from 'zod';

export const PRODUCT_FEEDBACK_MESSAGE_MAX = 300;
export const PRODUCT_FEEDBACK_INVITE_TTL_SECONDS = 86_400;
export const PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS = 900;
/** ~13 Monate für semesterbezogene Vergleiche */
export const PRODUCT_FEEDBACK_STRUCTURED_RETENTION_DAYS = 395;
export const PRODUCT_FEEDBACK_MESSAGE_RETENTION_DAYS = 90;
/** Fein segmentierte Admin-Statistik erst ab dieser Antwortanzahl */
export const PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT = 5;
export const PRODUCT_FEEDBACK_PARTICIPANT_SAMPLE_RATE = 0.1;
export const PRODUCT_FEEDBACK_PARTICIPANT_SAMPLE_MAX = 25;
/** Ab dieser Anzahl Geeigneter mind. eine Einladung */
export const PRODUCT_FEEDBACK_PARTICIPANT_SAMPLE_MIN_ELIGIBLE = 3;

export const ProductFeedbackSourceEnum = z.enum(['POST_SESSION', 'IN_APP']);
export type ProductFeedbackSource = z.infer<typeof ProductFeedbackSourceEnum>;

export const ProductFeedbackRoleEnum = z.enum(['HOST', 'PARTICIPANT']);
export type ProductFeedbackRole = z.infer<typeof ProductFeedbackRoleEnum>;

export const ProductFeedbackSurveyKeyEnum = z.enum([
  'POST_SESSION_EASE_PARTICIPANT_V1',
  'POST_SESSION_VALUE_PARTICIPANT_V1',
  'POST_SESSION_EASE_HOST_V1',
  'POST_SESSION_VALUE_HOST_V1',
]);
export type ProductFeedbackSurveyKey = z.infer<typeof ProductFeedbackSurveyKeyEnum>;

export const ProductFeedbackPrimaryAnswerEnum = z.enum([
  'EASY',
  'MINOR_FRICTION',
  'HARD',
  'YES',
  'PARTIAL',
  'NO',
]);
export type ProductFeedbackPrimaryAnswer = z.infer<typeof ProductFeedbackPrimaryAnswerEnum>;

export const ProductFeedbackAreaParticipantEnum = z.enum([
  'JOIN',
  'ORIENTATION',
  'ANSWER',
  'QA_OR_QUICKFEEDBACK',
  'RESULTS',
  'TECH',
  'ACCESSIBILITY',
  'OTHER',
]);
export type ProductFeedbackAreaParticipant = z.infer<typeof ProductFeedbackAreaParticipantEnum>;

export const ProductFeedbackAreaHostEnum = z.enum([
  'PREPARE_QUIZ',
  'START_SESSION',
  'INVITE',
  'LIVE_CONTROL',
  'QA_OR_QUICKFEEDBACK',
  'RESULTS',
  'PDF_EXPORT',
  'TECH',
  'ACCESSIBILITY',
  'OTHER',
]);
export type ProductFeedbackAreaHost = z.infer<typeof ProductFeedbackAreaHostEnum>;

export const ProductFeedbackAreaEnum = z.union([
  ProductFeedbackAreaParticipantEnum,
  ProductFeedbackAreaHostEnum,
]);
export type ProductFeedbackArea = z.infer<typeof ProductFeedbackAreaEnum>;

/**
 * Explizite UI-/DTO-Reihenfolge entlang des Nutzungsflows (nicht alphabetisch).
 * Teilnehmende: Beitritt → Orientierung → Mitmachen → Ergebnis → Meta.
 * Hosts: Vorbereiten → Starten → Einladen → Live → Auswerten → Meta.
 */
export const PRODUCT_FEEDBACK_PARTICIPANT_AREAS_FLOW = [
  'JOIN',
  'ORIENTATION',
  'ANSWER',
  'QA_OR_QUICKFEEDBACK',
  'RESULTS',
  'TECH',
  'ACCESSIBILITY',
  'OTHER',
] as const satisfies readonly ProductFeedbackAreaParticipant[];

export const PRODUCT_FEEDBACK_HOST_AREAS_FLOW = [
  'PREPARE_QUIZ',
  'START_SESSION',
  'INVITE',
  'LIVE_CONTROL',
  'QA_OR_QUICKFEEDBACK',
  'RESULTS',
  'PDF_EXPORT',
  'TECH',
  'ACCESSIBILITY',
  'OTHER',
] as const satisfies readonly ProductFeedbackAreaHost[];

export const ProductFeedbackSessionSizeClassEnum = z.enum(['XS', 'S', 'M', 'L', 'XL']);
export type ProductFeedbackSessionSizeClass = z.infer<typeof ProductFeedbackSessionSizeClassEnum>;

export const ProductFeedbackDeviceClassEnum = z.enum(['PHONE', 'TABLET', 'DESKTOP', 'UNKNOWN']);
export type ProductFeedbackDeviceClass = z.infer<typeof ProductFeedbackDeviceClassEnum>;

export const ProductFeedbackSessionKindEnum = z.enum([
  'QUIZ',
  'QUICK_FEEDBACK',
  'MIXED',
  'UNKNOWN',
]);
export type ProductFeedbackSessionKind = z.infer<typeof ProductFeedbackSessionKindEnum>;

export const ProductFeedbackAreaPromptKindEnum = z.enum(['hurdle', 'strength']);
export type ProductFeedbackAreaPromptKind = z.infer<typeof ProductFeedbackAreaPromptKindEnum>;

/** Identisch zu AppLocaleEnum (schemas.ts) — hier lokal, um Zyklen zu vermeiden. */
export const ProductFeedbackLocaleEnum = z.enum(['de', 'en', 'fr', 'es', 'it']);
export type ProductFeedbackLocale = z.infer<typeof ProductFeedbackLocaleEnum>;

/** Positiv → ambivalent → negativ (Leserichtung LTR / oben→unten). */
const EASE_ANSWERS = ['EASY', 'MINOR_FRICTION', 'HARD'] as const;
const VALUE_ANSWERS = ['YES', 'PARTIAL', 'NO'] as const;

const PRIMARY_QUESTION_KEYS: Record<ProductFeedbackSurveyKey, string> = {
  POST_SESSION_EASE_PARTICIPANT_V1: 'productFeedback.ease.participant.primary',
  POST_SESSION_VALUE_PARTICIPANT_V1: 'productFeedback.value.participant.primary',
  POST_SESSION_EASE_HOST_V1: 'productFeedback.ease.host.primary',
  POST_SESSION_VALUE_HOST_V1: 'productFeedback.value.host.primary',
};

export const ProductFeedbackSurveyDTOSchema = z.object({
  surveyKey: ProductFeedbackSurveyKeyEnum,
  surveyVersion: z.number().int().positive(),
  role: ProductFeedbackRoleEnum,
  primaryQuestionKey: z.string().min(1).max(128),
  primaryAnswers: z.array(ProductFeedbackPrimaryAnswerEnum).min(3).max(3),
  areaPromptKind: ProductFeedbackAreaPromptKindEnum,
  areas: z.array(ProductFeedbackAreaEnum).min(1),
});
export type ProductFeedbackSurveyDTO = z.infer<typeof ProductFeedbackSurveyDTOSchema>;

export function resolveProductFeedbackAreaPromptKind(
  primaryAnswer: ProductFeedbackPrimaryAnswer,
): ProductFeedbackAreaPromptKind {
  if (primaryAnswer === 'EASY' || primaryAnswer === 'YES') return 'strength';
  return 'hurdle';
}

export function getProductFeedbackSurveyDefinition(
  surveyKey: ProductFeedbackSurveyKey,
  primaryAnswer?: ProductFeedbackPrimaryAnswer,
): ProductFeedbackSurveyDTO {
  const areaPromptKind = primaryAnswer
    ? resolveProductFeedbackAreaPromptKind(primaryAnswer)
    : 'hurdle';
  switch (surveyKey) {
    case 'POST_SESSION_EASE_PARTICIPANT_V1':
      return {
        surveyKey,
        surveyVersion: 1,
        role: 'PARTICIPANT',
        primaryQuestionKey: PRIMARY_QUESTION_KEYS[surveyKey],
        primaryAnswers: [...EASE_ANSWERS],
        areaPromptKind,
        areas: [...PRODUCT_FEEDBACK_PARTICIPANT_AREAS_FLOW],
      };
    case 'POST_SESSION_VALUE_PARTICIPANT_V1':
      return {
        surveyKey,
        surveyVersion: 1,
        role: 'PARTICIPANT',
        primaryQuestionKey: PRIMARY_QUESTION_KEYS[surveyKey],
        primaryAnswers: [...VALUE_ANSWERS],
        areaPromptKind,
        areas: [...PRODUCT_FEEDBACK_PARTICIPANT_AREAS_FLOW],
      };
    case 'POST_SESSION_EASE_HOST_V1':
      return {
        surveyKey,
        surveyVersion: 1,
        role: 'HOST',
        primaryQuestionKey: PRIMARY_QUESTION_KEYS[surveyKey],
        primaryAnswers: [...EASE_ANSWERS],
        areaPromptKind,
        areas: [...PRODUCT_FEEDBACK_HOST_AREAS_FLOW],
      };
    case 'POST_SESSION_VALUE_HOST_V1':
      return {
        surveyKey,
        surveyVersion: 1,
        role: 'HOST',
        primaryQuestionKey: PRIMARY_QUESTION_KEYS[surveyKey],
        primaryAnswers: [...VALUE_ANSWERS],
        areaPromptKind,
        areas: [...PRODUCT_FEEDBACK_HOST_AREAS_FLOW],
      };
  }
}

export function isPrimaryAnswerAllowedForSurvey(
  surveyKey: ProductFeedbackSurveyKey,
  primaryAnswer: ProductFeedbackPrimaryAnswer,
): boolean {
  const def = getProductFeedbackSurveyDefinition(surveyKey);
  return def.primaryAnswers.includes(primaryAnswer);
}

export function isAreaAllowedForSurvey(surveyKey: ProductFeedbackSurveyKey, area: string): boolean {
  const def = getProductFeedbackSurveyDefinition(surveyKey);
  return (def.areas as string[]).includes(area);
}

export function mapParticipantCountToSizeClass(count: number): ProductFeedbackSessionSizeClass {
  if (count <= 10) return 'XS';
  if (count <= 30) return 'S';
  if (count <= 80) return 'M';
  if (count <= 200) return 'L';
  return 'XL';
}

export const ProductFeedbackInviteClaimInputSchema = z
  .object({
    sessionCode: z.string().trim().length(6),
    role: ProductFeedbackRoleEnum,
    participantId: z.uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === 'PARTICIPANT' && !value.participantId) {
      ctx.addIssue({
        code: 'custom',
        path: ['participantId'],
        message: 'participantId ist für PARTICIPANT erforderlich.',
      });
    }
  });
export type ProductFeedbackInviteClaimInput = z.infer<typeof ProductFeedbackInviteClaimInputSchema>;

export const ProductFeedbackInviteClaimOutputSchema = z.object({
  inviteToken: z.string().min(1).nullable(),
  survey: ProductFeedbackSurveyDTOSchema.nullable(),
});
export type ProductFeedbackInviteClaimOutput = z.infer<
  typeof ProductFeedbackInviteClaimOutputSchema
>;

export const ProductFeedbackGetSurveyInputSchema = z.object({
  inviteToken: z.string().trim().min(1).max(128),
});
export type ProductFeedbackGetSurveyInput = z.infer<typeof ProductFeedbackGetSurveyInputSchema>;

export const ProductFeedbackGetSurveyOutputSchema = z.object({
  inviteToken: z.string().min(1),
  survey: ProductFeedbackSurveyDTOSchema,
});
export type ProductFeedbackGetSurveyOutput = z.infer<typeof ProductFeedbackGetSurveyOutputSchema>;

export const ProductFeedbackSubmitInputSchema = z
  .object({
    inviteToken: z.string().trim().min(1).max(128),
    primaryAnswer: ProductFeedbackPrimaryAnswerEnum,
    area: ProductFeedbackAreaEnum,
    locale: ProductFeedbackLocaleEnum,
    appVersion: z.string().trim().max(64).optional(),
    deviceClass: ProductFeedbackDeviceClassEnum,
    idempotencyKey: z.uuid(),
  })
  .strict();
export type ProductFeedbackSubmitInput = z.infer<typeof ProductFeedbackSubmitInputSchema>;

export const ProductFeedbackSubmitOutputSchema = z.object({
  ok: z.literal(true),
  followUpCapability: z.string().min(1),
});
export type ProductFeedbackSubmitOutput = z.infer<typeof ProductFeedbackSubmitOutputSchema>;

export const ProductFeedbackFollowUpInputSchema = z
  .object({
    followUpCapability: z.string().trim().min(1).max(128),
    message: z.string().trim().min(1).max(PRODUCT_FEEDBACK_MESSAGE_MAX),
    idempotencyKey: z.uuid(),
  })
  .strict();
export type ProductFeedbackFollowUpInput = z.infer<typeof ProductFeedbackFollowUpInputSchema>;

export const ProductFeedbackFollowUpOutputSchema = z.object({
  ok: z.literal(true),
});
export type ProductFeedbackFollowUpOutput = z.infer<typeof ProductFeedbackFollowUpOutputSchema>;

export const AdminProductFeedbackStatsInputSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  surveyKey: ProductFeedbackSurveyKeyEnum.optional(),
  role: ProductFeedbackRoleEnum.optional(),
});
export type AdminProductFeedbackStatsInput = z.infer<typeof AdminProductFeedbackStatsInputSchema>;

export const AdminProductFeedbackCountBucketSchema = z.object({
  key: z.string(),
  count: z.number().int().nonnegative(),
});
export type AdminProductFeedbackCountBucket = z.infer<typeof AdminProductFeedbackCountBucketSchema>;

export const AdminProductFeedbackStatsDTOSchema = z.object({
  totals: z.number().int().nonnegative(),
  byPrimaryAnswer: z.array(AdminProductFeedbackCountBucketSchema),
  byArea: z.array(AdminProductFeedbackCountBucketSchema),
  bySurveyKey: z.array(AdminProductFeedbackCountBucketSchema),
  /** Feinere Segmente nur bei count >= PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT */
  byLocale: z.array(AdminProductFeedbackCountBucketSchema),
  bySessionSizeClass: z.array(AdminProductFeedbackCountBucketSchema),
  byDeviceClass: z.array(AdminProductFeedbackCountBucketSchema),
  bySurveyAndPrimary: z.array(
    z.object({
      surveyKey: z.string(),
      primaryAnswer: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  byRole: z.array(AdminProductFeedbackCountBucketSchema),
  bySurveyVersion: z.array(AdminProductFeedbackCountBucketSchema),
  byAppVersion: z.array(AdminProductFeedbackCountBucketSchema),
  invitationsIssued: z.number().int().nonnegative().nullable(),
  invitationCompletionRate: z.number().min(0).max(1).nullable(),
});
export type AdminProductFeedbackStatsDTO = z.infer<typeof AdminProductFeedbackStatsDTOSchema>;
