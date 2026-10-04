import { describe, expect, it, vi } from 'vitest';
import { loadQuickFeedbackModerationSnapshot } from './quickFeedbackModerationSnapshot';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const OBSERVED_AT = new Date('2026-10-04T10:00:00.000Z');
const ROUND_STARTED_AT = '2026-10-04T09:55:00.000Z';

function redisResult(status: 'OK' | 'MISSING' | 'PURGED', value = '') {
  return { eval: vi.fn().mockResolvedValue([status, value]) };
}

function stored(overrides: Record<string, unknown> = {}) {
  const totalVotes = typeof overrides.totalVotes === 'number' ? overrides.totalVotes : 0;
  return JSON.stringify({
    type: 'STARS',
    locked: false,
    showLiveResults: false,
    totalVotes: 0,
    distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    sessionBound: true,
    sessionId: SESSION_ID,
    roundStartedAt: ROUND_STARTED_AT,
    participantVotesValidated: true,
    validatedParticipantVoteCount: totalVotes,
    ...overrides,
  });
}

describe('loadQuickFeedbackModerationSnapshot', () => {
  it('returns a measured available zero distribution independent of participant visibility', async () => {
    const redis = redisResult('OK', stored());
    const result = await loadQuickFeedbackModerationSnapshot({
      sessionId: SESSION_ID,
      sessionCode: 'ABC123',
      enabled: true,
      eligibleResponses: 12,
      observedAt: OBSERVED_AT,
      redis,
    });

    expect(result.feedback).toEqual({
      state: 'available',
      aggregates: [{ sourceId: expect.stringMatching(/^feedback-aggregate:/) }],
    });
    expect(result.ruleInput).toMatchObject({ type: 'STARS', totalVotes: 0 });
    expect(result.sources[0]).toMatchObject({
      kind: 'feedback-aggregate',
      population: { eligible: 12, included: 0 },
      aggregation: {
        feedbackType: 'STARS',
        buckets: [
          { value: '1', count: 0 },
          { value: '2', count: 0 },
          { value: '3', count: 0 },
          { value: '4', count: 0 },
          { value: '5', count: 0 },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain('showLiveResults');
    expect(redis.eval).toHaveBeenCalledOnce();
    expect(redis.eval.mock.calls[0]?.[2]).toBe('qf:ABC123');
    expect(redis.eval.mock.calls[0]?.[3]).toBe(`qf:purged-session:v1:${SESSION_ID}`);
  });

  it.each([
    ['wrong session', { sessionId: '22222222-2222-4222-8222-222222222222' }],
    ['legacy missing timestamp', { roundStartedAt: undefined }],
    ['legacy missing participant-vote provenance', { participantVotesValidated: undefined }],
    [
      'mixed-version unvalidated vote',
      {
        totalVotes: 1,
        validatedParticipantVoteCount: 0,
        distribution: { '1': 1, '2': 0, '3': 0, '4': 0, '5': 0 },
      },
    ],
    ['incomplete distribution', { distribution: { '1': 0 }, totalVotes: 0 }],
    ['inconsistent count', { distribution: { '1': 1, '2': 0, '3': 0, '4': 0, '5': 0 } }],
  ])('degrades %s data without exposing a source', async (_name, overrides) => {
    const result = await loadQuickFeedbackModerationSnapshot({
      sessionId: SESSION_ID,
      sessionCode: 'ABC123',
      enabled: true,
      eligibleResponses: 12,
      observedAt: OBSERVED_AT,
      redis: redisResult('OK', stored(overrides)),
    });

    expect(result.feedback).toEqual({ state: 'unavailable', reason: 'not-collected' });
    expect(result.sources).toEqual([]);
    expect(result.ruleInput).toBeNull();
  });

  it('rejects response counts larger than the authorized participant basis', async () => {
    const result = await loadQuickFeedbackModerationSnapshot({
      sessionId: SESSION_ID,
      sessionCode: 'ABC123',
      enabled: true,
      eligibleResponses: 0,
      observedAt: OBSERVED_AT,
      redis: redisResult(
        'OK',
        stored({ totalVotes: 1, distribution: { '1': 1, '2': 0, '3': 0, '4': 0, '5': 0 } }),
      ),
    });

    expect(result.feedback).toEqual({ state: 'unavailable', reason: 'not-collected' });
  });

  it('honors the purge fence and never returns retained feedback', async () => {
    const result = await loadQuickFeedbackModerationSnapshot({
      sessionId: SESSION_ID,
      sessionCode: 'ABC123',
      enabled: true,
      eligibleResponses: 12,
      observedAt: OBSERVED_AT,
      redis: redisResult('PURGED'),
    });

    expect(result.feedback).toEqual({ state: 'unavailable', reason: 'not-collected' });
    expect(result.limitations).toContainEqual(
      expect.objectContaining({ code: 'source-redacted', section: 'feedback' }),
    );
  });

  it('degrades TEMPO instead of reading an unbounded choices hash', async () => {
    const result = await loadQuickFeedbackModerationSnapshot({
      sessionId: SESSION_ID,
      sessionCode: 'ABC123',
      enabled: true,
      eligibleResponses: 4,
      observedAt: OBSERVED_AT,
      redis: redisResult(
        'OK',
        stored({
          type: 'TEMPO',
          totalVotes: 4,
          distribution: { SPEED_UP: 0, FOLLOWING: 4, SLOW_DOWN: 0, LOST: 0 },
        }),
      ),
    });

    expect(result.feedback).toEqual({ state: 'unavailable', reason: 'not-supported' });
    expect(result.sources).toEqual([]);
    expect(result.ruleInput).toBeNull();
  });

  it('does not access Redis when quick feedback is disabled', async () => {
    const redis = redisResult('OK', stored());
    const result = await loadQuickFeedbackModerationSnapshot({
      sessionId: SESSION_ID,
      sessionCode: 'ABC123',
      enabled: false,
      eligibleResponses: 12,
      observedAt: OBSERVED_AT,
      redis,
    });

    expect(result.feedback.state).toBe('disabled');
    expect(redis.eval).not.toHaveBeenCalled();
  });
});
