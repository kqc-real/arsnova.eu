import { describe, expect, it } from 'vitest';
import {
  AdminProductFeedbackLinkDuplicateInputSchema,
  PRODUCT_FEEDBACK_IN_APP_MESSAGE_MAX,
  ProductFeedbackInAppFollowUpInputSchema,
  ProductFeedbackInAppSubmitInputSchema,
  ProductFeedbackRoleEnum,
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

    const parsed = ProductFeedbackInAppSubmitInputSchema.safeParse({
      challengeToken: 'c'.repeat(43),
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      role: 'PARTICIPANT',
      kind: 'NOT_WORKING',
      area: 'LIVE_CONTROL',
      context,
    });
    expect(parsed.success).toBe(false);
  });

  it('lehnt nicht freigegebene Kontextfelder strikt ab', () => {
    const parsed = ProductFeedbackInAppSubmitInputSchema.safeParse({
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
    });
    expect(parsed.success).toBe(false);
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
