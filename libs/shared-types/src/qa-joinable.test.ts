import { describe, expect, it } from 'vitest';
import { isQaChannelJoinable, isQaOpenForParticipants } from './qa-joinable.js';

const NOW = new Date('2026-09-19T08:00:00.000Z');

describe('isQaChannelJoinable', () => {
  it('erkennt einen offenen Q&A-Kanal aus dem Session-DTO', () => {
    expect(
      isQaChannelJoinable(
        {
          channels: {
            qa: {
              enabled: true,
              open: true,
              state: 'OPEN',
              closesAt: '2026-09-20T08:00:00.000Z',
            },
          },
        },
        NOW,
      ),
    ).toBe(true);
  });

  it('lehnt beendete oder geschlossene Q&A-Kanäle ab', () => {
    expect(
      isQaChannelJoinable(
        {
          channels: {
            qa: {
              enabled: true,
              open: false,
              state: 'MANUALLY_CLOSED',
              closesAt: '2026-09-20T08:00:00.000Z',
            },
          },
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      isQaChannelJoinable(
        {
          qaEnabled: true,
          qaOpen: true,
          qaClosesAt: '2026-09-19T07:00:00.000Z',
        },
        NOW,
      ),
    ).toBe(false);
  });

  it('laesst offenes Q&A nach Quizende nur vor dem globalen Sessionende zu', () => {
    expect(
      isQaOpenForParticipants(
        {
          qaEnabled: true,
          qaOpen: true,
          qaClosesAt: '2026-09-20T08:00:00.000Z',
          expiresAt: '2026-09-20T08:00:00.000Z',
        },
        NOW,
      ),
    ).toBe(true);
    expect(
      isQaOpenForParticipants(
        {
          qaEnabled: true,
          qaOpen: true,
          qaClosesAt: '2026-09-20T08:00:00.000Z',
          expiresAt: '2026-09-19T07:00:00.000Z',
        },
        NOW,
      ),
    ).toBe(false);
  });
});
