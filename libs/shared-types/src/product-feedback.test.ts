import { describe, expect, it } from 'vitest';
import {
  AdminProductFeedbackLinkDuplicateInputSchema,
  AdminProductFeedbackLlmExportInputSchema,
  AdminProductFeedbackPurgeInputSchema,
  AdminProductFeedbackPurgePreviewInputSchema,
  PRODUCT_FEEDBACK_IN_APP_MESSAGE_MAX,
  PRODUCT_FEEDBACK_PURGE_CONFIRMATION,
  ProductFeedbackFollowUpInputSchema,
  ProductFeedbackInAppFollowUpInputSchema,
  ProductFeedbackInAppSubmitInputSchema,
  ProductFeedbackInviteClaimInputSchema,
  ProductFeedbackRoleEnum,
  ProductFeedbackSubmitInputSchema,
  isInAppAreaAllowedForRole,
} from './product-feedback';

const context = {
  locale: 'de' as const,
  appVersion: '2026.9.0',
  routeGroup: 'SESSION_VOTE' as const,
  sessionPhase: 'ACTIVE' as const,
  activeChannel: 'QUIZ' as const,
  deviceClass: 'PHONE' as const,
  browserFamily: 'SAFARI' as const,
  browserMajorVersion: 26,
  osFamily: 'IOS' as const,
  onlineState: 'ONLINE' as const,
  errorRequestId: 'vote.submit:timeout-42',
};

describe('ProductFeedback Story 12.2 contracts', () => {
  it('akzeptiert ausschließlich rollengerechte IN_APP-Bereiche', () => {
    expect(isInAppAreaAllowedForRole('PARTICIPANT', 'QUIZ_OR_ANSWER')).toBe(true);
    expect(isInAppAreaAllowedForRole('PARTICIPANT', 'LIVE_CONTROL')).toBe(false);
    expect(isInAppAreaAllowedForRole('HOST', 'PDF_OR_EXPORT')).toBe(true);
    expect(isInAppAreaAllowedForRole('GENERAL', 'HELP')).toBe(true);
    expect(
      ProductFeedbackInAppSubmitInputSchema.safeParse({
        challengeToken: 'c'.repeat(43),
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        role: 'PARTICIPANT',
        kind: 'NOT_WORKING',
        area: 'LIVE_CONTROL',
        context,
      }).success,
    ).toBe(false);
  });

  it('lehnt nicht freigegebene Kontextfelder strikt ab', () => {
    expect(
      ProductFeedbackInAppSubmitInputSchema.safeParse({
        challengeToken: 'c'.repeat(43),
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        role: 'PARTICIPANT',
        kind: 'NOT_WORKING',
        area: 'QUIZ_OR_ANSWER',
        context: {
          ...context,
          sessionCode: 'ABC123',
          url: 'https://example.test/session/ABC123/vote',
          nickname: 'Ada',
        },
      }).success,
    ).toBe(false);
  });

  it('begrenzt IN_APP-Freitext auf 500 Zeichen und erlaubt Impact ohne Text', () => {
    expect(
      ProductFeedbackInAppFollowUpInputSchema.safeParse({
        followUpCapability: 'f'.repeat(43),
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
        impact: 'RETRIED',
      }).success,
    ).toBe(true);
    expect(
      ProductFeedbackInAppFollowUpInputSchema.safeParse({
        followUpCapability: 'f'.repeat(43),
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
        message: 'x'.repeat(PRODUCT_FEEDBACK_IN_APP_MESSAGE_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      ProductFeedbackInAppFollowUpInputSchema.safeParse({
        followUpCapability: 'f'.repeat(43),
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
      }).success,
    ).toBe(false);
  });

  it('erweitert Rollen additiv und verhindert Selbst-Duplikate', () => {
    expect(ProductFeedbackRoleEnum.parse('GENERAL')).toBe('GENERAL');
    expect(
      AdminProductFeedbackLinkDuplicateInputSchema.safeParse({
        id: '33333333-3333-4333-8333-333333333333',
        duplicateOfId: '33333333-3333-4333-8333-333333333333',
      }).success,
    ).toBe(false);
  });
});

describe('ProductFeedback contracts', () => {
  it('verlangt für Teilnehmer-Claims ID und separaten Besitznachweis', () => {
    expect(
      ProductFeedbackInviteClaimInputSchema.safeParse({
        sessionCode: 'ABC123',
        role: 'PARTICIPANT',
        participantId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(false);
    expect(
      ProductFeedbackInviteClaimInputSchema.safeParse({
        sessionCode: 'ABC123',
        role: 'PARTICIPANT',
        participantId: '11111111-1111-4111-8111-111111111111',
        participantClaimToken: 'participant-claim-token-value-1234567890',
      }).success,
    ).toBe(true);
  });

  it('verwirft unzulässigen Session- und Personenbezug beim Submit', () => {
    const base = {
      inviteToken: 'invite-token-value-123456789012345',
      primaryAnswer: 'EASY',
      area: 'JOIN',
      locale: 'de',
      deviceClass: 'DESKTOP',
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
    };
    expect(ProductFeedbackSubmitInputSchema.safeParse(base).success).toBe(true);
    expect(
      ProductFeedbackSubmitInputSchema.safeParse({
        ...base,
        sessionCode: 'ABC123',
        participantId: '11111111-1111-4111-8111-111111111111',
        questionText: 'Nicht zulässig',
      }).success,
    ).toBe(false);
  });

  it('begrenzt die Ergänzung auf Nachricht und Idempotency-Key', () => {
    expect(
      ProductFeedbackFollowUpInputSchema.safeParse({
        followUpCapability: 'follow-up-capability-value-1234567890',
        message: 'Kurze Ergänzung',
        idempotencyKey: '33333333-3333-4333-8333-333333333333',
        area: 'TECH',
      }).success,
    ).toBe(false);
  });

  it('unterscheidet Purge bis Datum und vollständig und verlangt die Phrase', () => {
    expect(
      AdminProductFeedbackPurgePreviewInputSchema.safeParse({
        scope: 'UNTIL',
        until: '2026-09-06T21:59:59.999Z',
      }).success,
    ).toBe(true);
    expect(AdminProductFeedbackPurgePreviewInputSchema.safeParse({ scope: 'ALL' }).success).toBe(
      true,
    );
    expect(
      AdminProductFeedbackPurgePreviewInputSchema.safeParse({
        scope: 'ALL',
        until: '2026-09-06T21:59:59.999Z',
      }).success,
    ).toBe(false);
    expect(
      AdminProductFeedbackPurgeInputSchema.safeParse({
        scope: 'ALL',
        expectedCount: 12,
        confirmationText: PRODUCT_FEEDBACK_PURGE_CONFIRMATION,
      }).success,
    ).toBe(true);
    expect(
      AdminProductFeedbackPurgeInputSchema.safeParse({
        scope: 'UNTIL',
        until: '2026-09-06T21:59:59.999Z',
        expectedCount: 12,
        confirmationText: 'falsch',
      }).success,
    ).toBe(true);
  });

  it('setzt LLM-Export-Defaults ohne Freitext und ohne Cursor', () => {
    const parsed = AdminProductFeedbackLlmExportInputSchema.parse({});
    expect(parsed.includeMessages).toBe(false);
    expect(parsed.excludeDiscarded).toBe(true);
    expect(
      AdminProductFeedbackLlmExportInputSchema.safeParse({
        cursor: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(false);
  });
});
