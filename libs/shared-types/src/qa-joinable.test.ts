import { describe, expect, it } from 'vitest';
import {
  isQaChannelJoinable,
  isQaConfiguredForHostResume,
  isQaOpenForParticipants,
} from './qa-joinable.js';

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

  it('lehnt einen als offen markierten, aber geschlossenen Q&A-Kanal ab', () => {
    expect(
      isQaChannelJoinable(
        {
          channels: {
            qa: {
              enabled: true,
              open: false,
              state: 'OPEN',
              closesAt: '2026-09-20T08:00:00.000Z',
            },
          },
        },
        NOW,
      ),
    ).toBe(false);
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

describe('isQaConfiguredForHostResume', () => {
  it('erkennt eingerichtetes Q&A auch nach Fristende', () => {
    expect(
      isQaConfiguredForHostResume({
        channels: {
          qa: {
            enabled: true,
            open: false,
            state: 'DEADLINE_EXPIRED',
            closesAt: '2026-09-18T08:00:00.000Z',
          },
        },
      }),
    ).toBe(true);
  });

  it('lehnt Quiz- und Blitzlichtkanäle ohne Q&A-Einrichtung ab', () => {
    expect(
      isQaConfiguredForHostResume({
        type: 'QUIZ',
        qaEnabled: false,
        channels: {
          qa: { enabled: false, open: false, state: 'DISABLED' },
        },
      }),
    ).toBe(false);
    expect(
      isQaConfiguredForHostResume({
        type: 'QUIZ',
        qaEnabled: true,
        qaClosesAt: null,
        channels: {
          qa: { enabled: true, open: false, state: 'UNCONFIGURED' },
        },
      }),
    ).toBe(false);
  });
});
