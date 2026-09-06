/**
 * ProductFeedback — Epic 12 / Story 12.1
 * Strikt getrennt von SessionFeedback (4.8) und quickFeedback/Blitzlicht.
 */
import { z } from 'zod';

export const PRODUCT_FEEDBACK_POST_SESSION_MESSAGE_MAX = 300;
export const PRODUCT_FEEDBACK_IN_APP_MESSAGE_MAX = 500;
/** @deprecated Für den Post-Session-Flow aus Story 12.1. */
export const PRODUCT_FEEDBACK_MESSAGE_MAX = PRODUCT_FEEDBACK_POST_SESSION_MESSAGE_MAX;
export const PRODUCT_FEEDBACK_INVITE_TTL_SECONDS = 86_400;
export const PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS = 900;
export const PRODUCT_FEEDBACK_IN_APP_CHALLENGE_TTL_SECONDS = 300;
export const PRODUCT_FEEDBACK_OUTBOX_RETENTION_DAYS = 7;
/** ~13 Monate für semesterbezogene Vergleiche */
export const PRODUCT_FEEDBACK_STRUCTURED_RETENTION_DAYS = 395;
export const PRODUCT_FEEDBACK_MESSAGE_RETENTION_DAYS = 90;
/** Fein segmentierte Admin-Statistik erst ab dieser Antwortanzahl */
export const PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT = 5;
/** Kanonische Fälle in einer LLM-Exportdatei (Story 12.3). */
export const PRODUCT_FEEDBACK_LLM_EXPORT_MAX_CASES = 300;
/** Maximal gelesene Filtertreffer vor der Fallauswahl (Story 12.3). */
export const PRODUCT_FEEDBACK_LLM_EXPORT_MAX_SCAN = 2_000;
export const PRODUCT_FEEDBACK_LLM_EXPORT_PROMPT_VERSION = 2;
export const PRODUCT_FEEDBACK_LLM_EXPORT_MARKDOWN_MAX = 500_000;
export const PRODUCT_FEEDBACK_PARTICIPANT_SAMPLE_RATE = 0.1;
export const PRODUCT_FEEDBACK_PARTICIPANT_SAMPLE_MAX = 25;
/** Ab dieser Anzahl Geeigneter mind. eine Einladung */
export const PRODUCT_FEEDBACK_PARTICIPANT_SAMPLE_MIN_ELIGIBLE = 3;

export const ProductFeedbackSourceEnum = z.enum(['POST_SESSION', 'IN_APP']);
export type ProductFeedbackSource = z.infer<typeof ProductFeedbackSourceEnum>;

export const ProductFeedbackRoleEnum = z.enum(['HOST', 'PARTICIPANT', 'GENERAL']);
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
    participantClaimToken: z.string().trim().min(32).max(128).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.role === 'PARTICIPANT' && !value.participantId) {
      ctx.addIssue({
        code: 'custom',
        path: ['participantId'],
        message: 'participantId ist für PARTICIPANT erforderlich.',
      });
    }
    if (value.role === 'PARTICIPANT' && !value.participantClaimToken) {
      ctx.addIssue({
        code: 'custom',
        path: ['participantClaimToken'],
        message: 'participantClaimToken ist für PARTICIPANT erforderlich.',
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

// ─── Story 12.2: jederzeit erreichbarer IN_APP-Kanal ────────────────────────

export const ProductFeedbackKindEnum = z.enum([
  'NOT_WORKING',
  'UNCLEAR',
  'MISSING_FEATURE',
  'PRAISE',
]);
export type ProductFeedbackKind = z.infer<typeof ProductFeedbackKindEnum>;

export const ProductFeedbackImpactEnum = z.enum(['CONTINUED', 'RETRIED', 'BLOCKED']);
export type ProductFeedbackImpact = z.infer<typeof ProductFeedbackImpactEnum>;

export const ProductFeedbackInAppParticipantAreaEnum = z.enum([
  'JOIN',
  'QUIZ_OR_ANSWER',
  'QA',
  'QUICK_FEEDBACK',
  'RESULTS_OR_SCORE',
  'DISPLAY_OR_ACCESSIBILITY',
  'TECH_OR_CONNECTION',
  'OTHER',
]);
export type ProductFeedbackInAppParticipantArea = z.infer<
  typeof ProductFeedbackInAppParticipantAreaEnum
>;

export const ProductFeedbackInAppHostAreaEnum = z.enum([
  'QUIZ_LIBRARY_OR_EDITOR',
  'SESSION_START_OR_INVITE',
  'LIVE_CONTROL',
  'QA',
  'QUICK_FEEDBACK',
  'RESULTS',
  'PDF_OR_EXPORT',
  'DISPLAY_OR_ACCESSIBILITY',
  'TECH_OR_CONNECTION',
  'OTHER',
]);
export type ProductFeedbackInAppHostArea = z.infer<typeof ProductFeedbackInAppHostAreaEnum>;

export const ProductFeedbackInAppGeneralAreaEnum = z.enum([
  'HOME_OR_ORIENTATION',
  'HELP',
  'QUIZ_LIBRARY_OR_EDITOR',
  'DISPLAY_OR_ACCESSIBILITY',
  'TECH_OR_CONNECTION',
  'OTHER',
]);
export type ProductFeedbackInAppGeneralArea = z.infer<typeof ProductFeedbackInAppGeneralAreaEnum>;

export const ProductFeedbackInAppAreaEnum = z.union([
  ProductFeedbackInAppParticipantAreaEnum,
  ProductFeedbackInAppHostAreaEnum,
  ProductFeedbackInAppGeneralAreaEnum,
]);
export type ProductFeedbackInAppArea = z.infer<typeof ProductFeedbackInAppAreaEnum>;

export const PRODUCT_FEEDBACK_IN_APP_PARTICIPANT_AREAS = [
  'JOIN',
  'QUIZ_OR_ANSWER',
  'QA',
  'QUICK_FEEDBACK',
  'RESULTS_OR_SCORE',
  'DISPLAY_OR_ACCESSIBILITY',
  'TECH_OR_CONNECTION',
  'OTHER',
] as const satisfies readonly ProductFeedbackInAppParticipantArea[];

export const PRODUCT_FEEDBACK_IN_APP_HOST_AREAS = [
  'QUIZ_LIBRARY_OR_EDITOR',
  'SESSION_START_OR_INVITE',
  'LIVE_CONTROL',
  'QA',
  'QUICK_FEEDBACK',
  'RESULTS',
  'PDF_OR_EXPORT',
  'DISPLAY_OR_ACCESSIBILITY',
  'TECH_OR_CONNECTION',
  'OTHER',
] as const satisfies readonly ProductFeedbackInAppHostArea[];

export const PRODUCT_FEEDBACK_IN_APP_GENERAL_AREAS = [
  'HOME_OR_ORIENTATION',
  'HELP',
  'QUIZ_LIBRARY_OR_EDITOR',
  'DISPLAY_OR_ACCESSIBILITY',
  'TECH_OR_CONNECTION',
  'OTHER',
] as const satisfies readonly ProductFeedbackInAppGeneralArea[];

export function isInAppAreaAllowedForRole(
  role: ProductFeedbackRole,
  area: ProductFeedbackInAppArea,
): boolean {
  const areas =
    role === 'HOST'
      ? PRODUCT_FEEDBACK_IN_APP_HOST_AREAS
      : role === 'PARTICIPANT'
        ? PRODUCT_FEEDBACK_IN_APP_PARTICIPANT_AREAS
        : PRODUCT_FEEDBACK_IN_APP_GENERAL_AREAS;
  return (areas as readonly string[]).includes(area);
}

export const ProductFeedbackRouteGroupEnum = z.enum([
  'HOME',
  'HELP',
  'QUIZ_LIBRARY',
  'QUIZ_EDITOR',
  'SESSION_JOIN',
  'SESSION_HOST',
  'SESSION_VOTE',
  'SESSION_RESULTS',
  'QA',
  'QUICK_FEEDBACK',
  'OTHER',
]);
export type ProductFeedbackRouteGroup = z.infer<typeof ProductFeedbackRouteGroupEnum>;

export const ProductFeedbackSessionPhaseEnum = z.enum([
  'NONE',
  'LOBBY',
  'READING',
  'ACTIVE',
  'RESULTS',
  'FINISHED',
]);
export type ProductFeedbackSessionPhase = z.infer<typeof ProductFeedbackSessionPhaseEnum>;

export const ProductFeedbackActiveChannelEnum = z.enum([
  'NONE',
  'QUIZ',
  'QA',
  'QUICK_FEEDBACK',
  'MIXED',
]);
export type ProductFeedbackActiveChannel = z.infer<typeof ProductFeedbackActiveChannelEnum>;

export const ProductFeedbackBrowserFamilyEnum = z.enum([
  'CHROME',
  'EDGE',
  'FIREFOX',
  'SAFARI',
  'OTHER',
  'UNKNOWN',
]);
export type ProductFeedbackBrowserFamily = z.infer<typeof ProductFeedbackBrowserFamilyEnum>;

export const ProductFeedbackOsFamilyEnum = z.enum([
  'ANDROID',
  'CHROMEOS',
  'IOS',
  'LINUX',
  'MACOS',
  'WINDOWS',
  'OTHER',
  'UNKNOWN',
]);
export type ProductFeedbackOsFamily = z.infer<typeof ProductFeedbackOsFamilyEnum>;

export const ProductFeedbackOnlineStateEnum = z.enum(['ONLINE', 'OFFLINE']);
export type ProductFeedbackOnlineState = z.infer<typeof ProductFeedbackOnlineStateEnum>;

export const ProductFeedbackInAppContextSchema = z
  .object({
    locale: ProductFeedbackLocaleEnum,
    appVersion: z.string().trim().min(1).max(64).optional(),
    routeGroup: ProductFeedbackRouteGroupEnum,
    sessionPhase: ProductFeedbackSessionPhaseEnum,
    activeChannel: ProductFeedbackActiveChannelEnum,
    deviceClass: ProductFeedbackDeviceClassEnum,
    browserFamily: ProductFeedbackBrowserFamilyEnum,
    browserMajorVersion: z.number().int().min(1).max(999).optional(),
    osFamily: ProductFeedbackOsFamilyEnum,
    onlineState: ProductFeedbackOnlineStateEnum,
    errorRequestId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/)
      .optional(),
  })
  .strict();
export type ProductFeedbackInAppContext = z.infer<typeof ProductFeedbackInAppContextSchema>;

export const ProductFeedbackInAppChallengeInputSchema = z
  .object({
    idempotencyKey: z.uuid(),
  })
  .strict();
export type ProductFeedbackInAppChallengeInput = z.infer<
  typeof ProductFeedbackInAppChallengeInputSchema
>;

export const ProductFeedbackInAppChallengeOutputSchema = z.object({
  challengeToken: z.string().min(32).max(128),
  expiresAt: z.string().datetime(),
});
export type ProductFeedbackInAppChallengeOutput = z.infer<
  typeof ProductFeedbackInAppChallengeOutputSchema
>;

export const ProductFeedbackInAppSubmitInputSchema = z
  .object({
    challengeToken: z.string().trim().min(32).max(128),
    idempotencyKey: z.uuid(),
    role: ProductFeedbackRoleEnum,
    kind: ProductFeedbackKindEnum,
    area: ProductFeedbackInAppAreaEnum,
    context: ProductFeedbackInAppContextSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!isInAppAreaAllowedForRole(value.role, value.area)) {
      ctx.addIssue({
        code: 'custom',
        path: ['area'],
        message: 'Bereich passt nicht zur Rolle.',
      });
    }
  });
export type ProductFeedbackInAppSubmitInput = z.infer<typeof ProductFeedbackInAppSubmitInputSchema>;

export const ProductFeedbackInAppSubmitOutputSchema = z.object({
  ok: z.literal(true),
  followUpCapability: z.string().min(32).max(128),
  followUpExpiresAt: z.string().datetime(),
});
export type ProductFeedbackInAppSubmitOutput = z.infer<
  typeof ProductFeedbackInAppSubmitOutputSchema
>;

export const ProductFeedbackInAppFollowUpInputSchema = z
  .object({
    followUpCapability: z.string().trim().min(32).max(128),
    idempotencyKey: z.uuid(),
    message: z.string().trim().min(1).max(PRODUCT_FEEDBACK_IN_APP_MESSAGE_MAX).optional(),
    impact: ProductFeedbackImpactEnum.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.message && !value.impact) {
      ctx.addIssue({
        code: 'custom',
        path: ['message'],
        message: 'Mindestens Anmerkung oder Auswirkung ist erforderlich.',
      });
    }
  });
export type ProductFeedbackInAppFollowUpInput = z.infer<
  typeof ProductFeedbackInAppFollowUpInputSchema
>;

export const ProductFeedbackQuarantineStatusEnum = z.enum(['NONE', 'FLAGGED', 'CLEARED']);
export type ProductFeedbackQuarantineStatus = z.infer<typeof ProductFeedbackQuarantineStatusEnum>;

export const ProductFeedbackTriageStatusEnum = z.enum([
  'NEW',
  'REVIEWED',
  'PLANNED',
  'RESOLVED',
  'DISCARDED',
]);
export type ProductFeedbackTriageStatus = z.infer<typeof ProductFeedbackTriageStatusEnum>;

export const ProductFeedbackAuditActionEnum = z.enum([
  'STATUS_CHANGED',
  'DUPLICATE_LINKED',
  'ISSUE_LINKED',
  'ISSUE_DRAFTED',
  'RESOLUTION_LINKED',
  'QUARANTINE_CLEARED',
  'DELETED',
]);
export type ProductFeedbackAuditAction = z.infer<typeof ProductFeedbackAuditActionEnum>;

export const AdminProductFeedbackListInputSchema = z
  .object({
    cursor: z.string().trim().min(1).max(64).optional(),
    limit: z.number().int().min(1).max(100).default(25),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    source: ProductFeedbackSourceEnum.optional(),
    role: ProductFeedbackRoleEnum.optional(),
    kind: ProductFeedbackKindEnum.optional(),
    area: z.union([ProductFeedbackAreaEnum, ProductFeedbackInAppAreaEnum]).optional(),
    impact: ProductFeedbackImpactEnum.optional(),
    appVersion: z.string().trim().min(1).max(64).optional(),
    locale: ProductFeedbackLocaleEnum.optional(),
    status: ProductFeedbackTriageStatusEnum.optional(),
  })
  .strict();
export type AdminProductFeedbackListInput = z.infer<typeof AdminProductFeedbackListInputSchema>;

export const AdminProductFeedbackListItemSchema = z.object({
  id: z.uuid(),
  source: ProductFeedbackSourceEnum,
  role: ProductFeedbackRoleEnum,
  kind: ProductFeedbackKindEnum.nullable(),
  primaryAnswer: z.string().nullable(),
  area: z.string(),
  impact: ProductFeedbackImpactEnum.nullable(),
  locale: ProductFeedbackLocaleEnum,
  appVersion: z.string().nullable(),
  routeGroup: ProductFeedbackRouteGroupEnum.nullable(),
  status: ProductFeedbackTriageStatusEnum,
  quarantineStatus: ProductFeedbackQuarantineStatusEnum,
  duplicateOfId: z.uuid().nullable(),
  duplicateCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AdminProductFeedbackListItem = z.infer<typeof AdminProductFeedbackListItemSchema>;

export const AdminProductFeedbackListOutputSchema = z.object({
  items: z.array(AdminProductFeedbackListItemSchema),
  nextCursor: z.string().nullable(),
});
export type AdminProductFeedbackListOutput = z.infer<typeof AdminProductFeedbackListOutputSchema>;

export const AdminProductFeedbackByIdInputSchema = z.object({ id: z.uuid() }).strict();
export type AdminProductFeedbackByIdInput = z.infer<typeof AdminProductFeedbackByIdInputSchema>;

export const AdminProductFeedbackDetailSchema = AdminProductFeedbackListItemSchema.extend({
  message: z.string().max(PRODUCT_FEEDBACK_IN_APP_MESSAGE_MAX).nullable(),
  sessionPhase: ProductFeedbackSessionPhaseEnum.nullable(),
  activeChannel: ProductFeedbackActiveChannelEnum.nullable(),
  deviceClass: ProductFeedbackDeviceClassEnum.nullable(),
  browserFamily: ProductFeedbackBrowserFamilyEnum.nullable(),
  browserMajorVersion: z.number().int().nullable(),
  osFamily: ProductFeedbackOsFamilyEnum.nullable(),
  onlineState: ProductFeedbackOnlineStateEnum.nullable(),
  errorRequestId: z.string().nullable(),
  githubIssueNumber: z.number().int().positive().nullable(),
  githubIssueUrl: z.url().nullable(),
  resolvedInVersion: z.string().nullable(),
  publicResolutionUrl: z.url().nullable(),
});
export type AdminProductFeedbackDetail = z.infer<typeof AdminProductFeedbackDetailSchema>;

export const AdminProductFeedbackUpdateTriageInputSchema = z
  .object({
    id: z.uuid(),
    status: ProductFeedbackTriageStatusEnum,
    resolvedInVersion: z.string().trim().min(1).max(64).nullable().optional(),
    publicResolutionUrl: z.url().max(512).nullable().optional(),
  })
  .strict();
export type AdminProductFeedbackUpdateTriageInput = z.infer<
  typeof AdminProductFeedbackUpdateTriageInputSchema
>;

export const AdminProductFeedbackLinkDuplicateInputSchema = z
  .object({
    id: z.uuid(),
    duplicateOfId: z.uuid().nullable(),
  })
  .strict()
  .refine((value) => value.duplicateOfId !== value.id, {
    path: ['duplicateOfId'],
    message: 'Eine Rückmeldung kann nicht ihr eigenes Duplikat sein.',
  });
export type AdminProductFeedbackLinkDuplicateInput = z.infer<
  typeof AdminProductFeedbackLinkDuplicateInputSchema
>;

export const AdminProductFeedbackLinkIssueInputSchema = z
  .object({
    id: z.uuid(),
    issueNumber: z.number().int().positive(),
    issueUrl: z.url().max(512),
  })
  .strict();
export type AdminProductFeedbackLinkIssueInput = z.infer<
  typeof AdminProductFeedbackLinkIssueInputSchema
>;

export const AdminProductFeedbackIssueDraftOutputSchema = z.object({
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(5_000),
});
export type AdminProductFeedbackIssueDraftOutput = z.infer<
  typeof AdminProductFeedbackIssueDraftOutputSchema
>;

export const AdminProductFeedbackMutationOutputSchema = z.object({
  ok: z.literal(true),
});
export type AdminProductFeedbackMutationOutput = z.infer<
  typeof AdminProductFeedbackMutationOutputSchema
>;

export const AdminProductFeedbackPublishIssueInputSchema = AdminProductFeedbackByIdInputSchema;
export type AdminProductFeedbackPublishIssueInput = z.infer<
  typeof AdminProductFeedbackPublishIssueInputSchema
>;

export const AdminProductFeedbackPublishIssueOutputSchema = z.object({
  issueNumber: z.number().int().positive(),
  issueUrl: z.url(),
});
export type AdminProductFeedbackPublishIssueOutput = z.infer<
  typeof AdminProductFeedbackPublishIssueOutputSchema
>;

export const AdminProductFeedbackTriageStatsInputSchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    appVersion: z.string().trim().min(1).max(64).optional(),
  })
  .strict();
export type AdminProductFeedbackTriageStatsInput = z.infer<
  typeof AdminProductFeedbackTriageStatsInputSchema
>;

const AdminProductFeedbackTriageCountBucketSchema = z.object({
  key: z.string().min(1),
  count: z.number().int().nonnegative(),
});

export const AdminProductFeedbackTriageStatsDTOSchema = z.object({
  totals: z.number().int().nonnegative(),
  blocking: z.number().int().nonnegative(),
  byKind: z.array(AdminProductFeedbackTriageCountBucketSchema),
  byArea: z.array(AdminProductFeedbackTriageCountBucketSchema),
  byStatus: z.array(AdminProductFeedbackTriageCountBucketSchema),
  byAppVersion: z.array(AdminProductFeedbackTriageCountBucketSchema),
});
export type AdminProductFeedbackTriageStatsDTO = z.infer<
  typeof AdminProductFeedbackTriageStatsDTOSchema
>;

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
  byPositiveArea: z.array(AdminProductFeedbackCountBucketSchema),
  byHurdleArea: z.array(AdminProductFeedbackCountBucketSchema),
  bySurveyKey: z.array(AdminProductFeedbackCountBucketSchema),
  /** Feinere Segmente nur bei count >= PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT */
  byLocale: z.array(AdminProductFeedbackCountBucketSchema),
  bySessionSizeClass: z.array(AdminProductFeedbackCountBucketSchema),
  byDeviceClass: z.array(AdminProductFeedbackCountBucketSchema),
  bySessionKind: z.array(AdminProductFeedbackCountBucketSchema),
  byFeatureArea: z.array(AdminProductFeedbackCountBucketSchema),
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

export const AdminProductFeedbackLlmExportInputSchema = AdminProductFeedbackListInputSchema.omit({
  cursor: true,
  limit: true,
})
  .extend({
    includeMessages: z.boolean().default(false),
    excludeDiscarded: z.boolean().default(true),
  })
  .strict();
export type AdminProductFeedbackLlmExportInput = z.infer<
  typeof AdminProductFeedbackLlmExportInputSchema
>;

export const AdminProductFeedbackLlmExportOutputSchema = z.object({
  fileName: z.string().trim().min(1).max(128),
  markdown: z.string().min(1).max(PRODUCT_FEEDBACK_LLM_EXPORT_MARKDOWN_MAX),
  prompt: z.string().min(1).max(20_000),
  promptVersion: z.number().int().positive(),
  caseCount: z.number().int().nonnegative(),
  clusterCount: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  includeMessages: z.boolean(),
});
export type AdminProductFeedbackLlmExportOutput = z.infer<
  typeof AdminProductFeedbackLlmExportOutputSchema
>;

/** ASCII-Phrase, sprachunabhängig — analog `ALLE SESSIONS LOESCHEN`. */
export const PRODUCT_FEEDBACK_PURGE_CONFIRMATION = 'RUECKMELDUNGEN LOESCHEN';

export const ProductFeedbackPurgeScopeEnum = z.enum(['UNTIL', 'ALL']);
export type ProductFeedbackPurgeScope = z.infer<typeof ProductFeedbackPurgeScopeEnum>;

export const AdminProductFeedbackPurgePreviewInputSchema = z.discriminatedUnion('scope', [
  z
    .object({
      scope: z.literal('UNTIL'),
      until: z.string().datetime(),
    })
    .strict(),
  z.object({ scope: z.literal('ALL') }).strict(),
]);
export type AdminProductFeedbackPurgePreviewInput = z.infer<
  typeof AdminProductFeedbackPurgePreviewInputSchema
>;

export const AdminProductFeedbackPurgePreviewOutputSchema = z.object({
  count: z.number().int().nonnegative(),
  scope: ProductFeedbackPurgeScopeEnum,
});
export type AdminProductFeedbackPurgePreviewOutput = z.infer<
  typeof AdminProductFeedbackPurgePreviewOutputSchema
>;

export const AdminProductFeedbackPurgeInputSchema = z.discriminatedUnion('scope', [
  z
    .object({
      scope: z.literal('UNTIL'),
      until: z.string().datetime(),
      expectedCount: z.number().int().min(0).max(1_000_000),
      confirmationText: z.string().trim().min(1).max(80),
    })
    .strict(),
  z
    .object({
      scope: z.literal('ALL'),
      expectedCount: z.number().int().min(0).max(1_000_000),
      confirmationText: z.string().trim().min(1).max(80),
    })
    .strict(),
]);
export type AdminProductFeedbackPurgeInput = z.infer<typeof AdminProductFeedbackPurgeInputSchema>;

export const AdminProductFeedbackPurgeOutputSchema = z.object({
  deletedCount: z.number().int().nonnegative(),
  scope: ProductFeedbackPurgeScopeEnum,
});
export type AdminProductFeedbackPurgeOutput = z.infer<typeof AdminProductFeedbackPurgeOutputSchema>;
