import { describe, expect, it } from 'vitest';
import {
  ProductFeedbackFollowUpInputSchema,
  ProductFeedbackInviteClaimInputSchema,
  ProductFeedbackSubmitInputSchema,
} from './product-feedback';

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
});
