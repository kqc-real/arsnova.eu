import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkSessionCreateRate: vi.fn(),
  isSessionCodeLockedOut: vi.fn(),
  recordFailedSessionCodeAttempt: vi.fn(),
}));

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: {} as never });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';

describe('session.enable channel mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
  });

  it('aktiviert den Q&A-Kanal für eine Quiz-Session', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: '11111111-1111-4111-8111-111111111111',
      qaEnabled: false,
      qaTitle: null,
      qaModerationMode: false,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
    });
    prismaMock.session.update.mockResolvedValue({
      type: 'QUIZ',
      quizId: '11111111-1111-4111-8111-111111111111',
      qaEnabled: true,
      qaTitle: null,
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
    });

    const result = await caller.enableQaChannel({ code: 'abc123' });

    expect(prismaMock.session.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { qaEnabled: true, qaModerationMode: false },
      select: expect.any(Object),
    });
    expect(result.qa.enabled).toBe(true);
    expect(result.quickFeedback.enabled).toBe(false);
  });

  it('aktiviert den Blitzlicht-Kanal für eine Session', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: '11111111-1111-4111-8111-111111111111',
      qaEnabled: false,
      qaTitle: null,
      qaModerationMode: false,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
    });
    prismaMock.session.update.mockResolvedValue({
      type: 'QUIZ',
      quizId: '11111111-1111-4111-8111-111111111111',
      qaEnabled: false,
      qaTitle: null,
      qaModerationMode: false,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: true,
    });

    const result = await caller.enableQuickFeedbackChannel({ code: 'ABC123' });

    expect(prismaMock.session.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { quickFeedbackEnabled: true },
      select: expect.any(Object),
    });
    expect(result.quickFeedback.enabled).toBe(true);
    expect(result.qa.enabled).toBe(false);
  });

  it('ist idempotent, wenn der Kanal bereits aktiv ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: '11111111-1111-4111-8111-111111111111',
      qaEnabled: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: true,
    });

    const result = await caller.enableQaChannel({ code: 'ABC123' });

    expect(prismaMock.session.update).not.toHaveBeenCalled();
    expect(result.qa.enabled).toBe(true);
    expect(result.quickFeedback.enabled).toBe(true);
  });
});
