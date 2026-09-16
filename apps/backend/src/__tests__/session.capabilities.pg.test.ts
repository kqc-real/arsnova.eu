import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../db';
import { hashCapability, createOpaqueCapability } from '../lib/capabilityCrypto';
import {
  activateHostCredential,
  createInitialHostCredentialMaterial,
  issueHostTokenFromBrowserCapability,
  prepareHostCredentialExchange,
  resetSessionHostAccess,
} from '../lib/hostCredentialRecovery';
import { hashHostSessionToken } from '../lib/hostAuth';
import { prepareParticipantJoin } from '../lib/participantJoin';
import { getRedis } from '../redis';

const RUN_PG = process.env['RUN_PG_CAPABILITY_TESTS'] === '1';
const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public';

function sessionCode(prefix: string): string {
  return `${prefix}${randomUUID().replaceAll('-', '').slice(0, 5).toUpperCase()}`;
}

describe.skipIf(!RUN_PG)('host and participant capabilities (PostgreSQL + Redis)', () => {
  const rawClients = Array.from(
    { length: 4 },
    () => new Client({ connectionString: DATABASE_URL }),
  );
  const sessionIds: string[] = [];

  beforeAll(async () => {
    await Promise.all(rawClients.map((client) => client.connect()));
  });

  afterAll(async () => {
    if (sessionIds.length > 0) {
      await prisma.session.deleteMany({ where: { id: { in: sessionIds } } });
    }
    await Promise.all(rawClients.map((client) => client.end()));
  });

  it('linearisiert automatische Kennungen über Verbindungen und rollt Fehlversuche zurück', async () => {
    const session = await prisma.session.create({
      data: {
        id: randomUUID(),
        code: sessionCode('P'),
        type: 'Q_AND_A',
        status: 'ACTIVE',
        qaEnabled: true,
        qaOpen: true,
        onboardingProfileConfigured: true,
        onboardingNicknameTheme: 'KINDERGARTEN',
        onboardingAllowCustomNicknames: false,
        onboardingAnonymousMode: false,
      },
    });
    sessionIds.push(session.id);

    await Promise.all(
      rawClients.map(async (client, shard) => {
        for (let offset = 0; offset < 10; offset += 1) {
          const index = shard * 10 + offset;
          await client.query(
            `INSERT INTO "Participant" (id, nickname, "sessionId")
             VALUES ($1, $2, $3)`,
            [randomUUID(), `Legacy ${index}`, session.id],
          );
        }
      }),
    );
    const bridgeNumbers = await prisma.participant.findMany({
      where: { sessionId: session.id },
      orderBy: { participantNumber: 'asc' },
      select: { participantNumber: true },
    });
    expect(bridgeNumbers.map((entry) => entry.participantNumber)).toEqual(
      Array.from({ length: 40 }, (_, index) => index + 1),
    );

    const joined = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        prisma.$transaction((tx) =>
          prepareParticipantJoin({
            tx,
            sessionId: session.id,
            requestedNickname: 'Roter Drache',
            profile: { allowCustomNicknames: false, anonymousMode: false },
            joinIdempotencyKey: `join-key-${index.toString().padStart(4, '0')}-${createOpaqueCapability()}`,
          }),
        ),
      ),
    );
    expect(new Set(joined.map((entry) => entry.participantNumber)).size).toBe(20);
    expect(joined.map((entry) => entry.participantNumber).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 41),
    );
    expect(new Set(joined.map((entry) => entry.nickname)).size).toBe(20);
    expect(joined.every((entry) => /^Roter Drache \d+$/u.test(entry.nickname))).toBe(true);

    const beforeRollback = await prisma.session.findUniqueOrThrow({
      where: { id: session.id },
      select: { nextParticipantNumber: true },
    });
    await expect(
      prisma.$transaction(async (tx) => {
        await prepareParticipantJoin({
          tx,
          sessionId: session.id,
          requestedNickname: 'Rollback',
          profile: { allowCustomNicknames: false, anonymousMode: false },
          joinIdempotencyKey: `rollback-${createOpaqueCapability()}`,
        });
        throw new Error('ROLLBACK_EXPECTED');
      }),
    ).rejects.toThrow('ROLLBACK_EXPECTED');
    const afterRollback = await prisma.session.findUniqueOrThrow({
      where: { id: session.id },
      select: { nextParticipantNumber: true },
    });
    expect(afterRollback.nextParticipantNumber).toBe(beforeRollback.nextParticipantNumber);
  }, 30_000);

  it('replayed einen Commit exakt, lehnt abgelaufene Schlüssel ab und bindet Rejoin an die Session', async () => {
    const sessionA = await prisma.session.create({
      data: {
        id: randomUUID(),
        code: sessionCode('A'),
        type: 'Q_AND_A',
        status: 'ACTIVE',
        qaEnabled: true,
        qaOpen: true,
      },
    });
    const sessionB = await prisma.session.create({
      data: {
        id: randomUUID(),
        code: sessionCode('B'),
        type: 'Q_AND_A',
        status: 'ACTIVE',
        qaEnabled: true,
        qaOpen: true,
      },
    });
    sessionIds.push(sessionA.id, sessionB.id);
    const idempotencyKey = createOpaqueCapability();
    const first = await prisma.$transaction((tx) =>
      prepareParticipantJoin({
        tx,
        sessionId: sessionA.id,
        requestedNickname: 'Ada',
        profile: { allowCustomNicknames: true, anonymousMode: false },
        joinIdempotencyKey: idempotencyKey,
      }),
    );
    const replay = await prisma.$transaction((tx) =>
      prepareParticipantJoin({
        tx,
        sessionId: sessionA.id,
        requestedNickname: 'Ignoriert',
        profile: { allowCustomNicknames: true, anonymousMode: false },
        joinIdempotencyKey: idempotencyKey,
      }),
    );
    expect(replay).toEqual({ ...first, rejoined: true });
    expect(await prisma.participant.count({ where: { sessionId: sessionA.id } })).toBe(1);

    await prisma.participantJoinReplay.updateMany({
      where: { sessionId: sessionA.id },
      data: {
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
        expiresAt: new Date(Date.now() - 10 * 60 * 1000),
        encryptedEnvelope: null,
      },
    });
    await expect(
      prisma.$transaction((tx) =>
        prepareParticipantJoin({
          tx,
          sessionId: sessionA.id,
          requestedNickname: 'Ignoriert',
          profile: { allowCustomNicknames: true, anonymousMode: false },
          joinIdempotencyKey: idempotencyKey,
        }),
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    const foreignSessionJoin = await prisma.$transaction((tx) =>
      prepareParticipantJoin({
        tx,
        sessionId: sessionB.id,
        requestedNickname: 'Neue Identität',
        profile: { allowCustomNicknames: true, anonymousMode: false },
        rejoinCapability: first.rejoinCapability,
        joinIdempotencyKey: createOpaqueCapability(),
      }),
    );
    expect(foreignSessionJoin.participantId).not.toBe(first.participantId);

    const guessedIdJoin = await prisma.$transaction((tx) =>
      prepareParticipantJoin({
        tx,
        sessionId: sessionB.id,
        requestedNickname: 'Noch eine Identität',
        profile: { allowCustomNicknames: true, anonymousMode: false },
        rejoinCapability: first.participantId,
        joinIdempotencyKey: createOpaqueCapability(),
      }),
    );
    expect(guessedIdJoin.participantId).not.toBe(first.participantId);
  });

  it('rotiert Host-Credentials idempotent und stellt nach Redis-Verlust aus PostgreSQL wieder her', async () => {
    const material = createInitialHostCredentialMaterial();
    const session = await prisma.session.create({
      data: {
        id: randomUUID(),
        code: sessionCode('H'),
        type: 'Q_AND_A',
        status: 'ACTIVE',
        qaEnabled: true,
        qaOpen: true,
        hostCredentialVersion: material.credentialData.hostCredentialVersion,
        hostSupportId: material.credentialData.hostSupportId,
        hostCredentials: material.credentialData.hostCredentials,
      },
    });
    sessionIds.push(session.id);

    const initialToken = await issueHostTokenFromBrowserCapability({
      code: session.code,
      browserCapability: material.browserCapability,
    });
    const exchangeId = createOpaqueCapability();
    const prepared = await prepareHostCredentialExchange({
      supportId: material.recoveryCard.supportId,
      recoveryExchangeId: exchangeId,
      source: { kind: 'RECOVERY', recoveryCode: material.recoveryCard.recoveryCode },
    });
    const replay = await prepareHostCredentialExchange({
      supportId: material.recoveryCard.supportId,
      recoveryExchangeId: exchangeId,
      source: { kind: 'RECOVERY', recoveryCode: material.recoveryCard.recoveryCode },
    });
    expect(replay).toEqual(prepared);
    expect(
      await issueHostTokenFromBrowserCapability({
        code: session.code,
        browserCapability: material.browserCapability,
      }),
    ).toBeDefined();

    const activated = await activateHostCredential({
      supportId: prepared.recoveryCard.supportId,
      browserCapability: prepared.browserCapability,
    });
    expect(activated.generation).toBe(2);
    await expect(
      issueHostTokenFromBrowserCapability({
        code: session.code,
        browserCapability: material.browserCapability,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    const issued = await issueHostTokenFromBrowserCapability({
      code: session.code,
      browserCapability: prepared.browserCapability,
    });
    await getRedis().del(`host:access:v2:${hashHostSessionToken(issued.hostToken)}`);
    const recoveredAfterRedisLoss = await issueHostTokenFromBrowserCapability({
      code: session.code,
      browserCapability: prepared.browserCapability,
    });
    expect(recoveredAfterRedisLoss.hostToken).not.toBe(issued.hostToken);

    expect(initialToken.hostToken).not.toContain(material.browserCapability);
    const stored = await prisma.hostCredential.findMany({
      where: { sessionId: session.id },
      select: { browserCapabilityHash: true, recoveryCodeHash: true, status: true },
    });
    expect(stored).toContainEqual(
      expect.objectContaining({
        browserCapabilityHash: hashCapability(prepared.browserCapability),
        recoveryCodeHash: hashCapability(prepared.recoveryCard.recoveryCode),
        status: 'ACTIVE',
      }),
    );
  });

  it('widerruft beim auditierten Admin-Reset atomar und lehnt ihn nach Nachbereitungsende ab', async () => {
    const material = createInitialHostCredentialMaterial();
    const session = await prisma.session.create({
      data: {
        id: randomUUID(),
        code: sessionCode('R'),
        type: 'Q_AND_A',
        status: 'ACTIVE',
        qaEnabled: true,
        qaOpen: true,
        hostCredentialVersion: 1,
        hostSupportId: material.recoveryCard.supportId,
        hostCredentials: material.credentialData.hostCredentials,
      },
    });
    sessionIds.push(session.id);
    const reset = await resetSessionHostAccess({
      adminIdentifier: 'admin:test',
      input: {
        supportId: material.recoveryCard.supportId,
        evidenceCategory: 'PREEXISTING_VERIFIED_SUPPORT_CASE',
        requesterIdentityVerificationReference: 'verified-contact-4711',
        sessionAuthorizationEvidenceReference: 'support-case-before-loss-4711',
        supportCaseReference: 'support-case-before-loss-4711',
        reason: 'Beide Host-Zugangsebenen wurden nachweislich verloren.',
      },
    });
    expect(reset.revokedCredentialVersion).toBe(1);
    await expect(
      issueHostTokenFromBrowserCapability({
        code: session.code,
        browserCapability: material.browserCapability,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    const exchangeId = createOpaqueCapability();
    const prepared = await prepareHostCredentialExchange({
      supportId: reset.supportId,
      recoveryExchangeId: exchangeId,
      source: { kind: 'ADMIN_HANDOFF', handoffCapability: reset.handoffCapability },
    });
    expect(
      await prepareHostCredentialExchange({
        supportId: reset.supportId,
        recoveryExchangeId: exchangeId,
        source: { kind: 'ADMIN_HANDOFF', handoffCapability: reset.handoffCapability },
      }),
    ).toEqual(prepared);
    await activateHostCredential({
      supportId: reset.supportId,
      browserCapability: prepared.browserCapability,
    });
    expect(
      await issueHostTokenFromBrowserCapability({
        code: session.code,
        browserCapability: prepared.browserCapability,
      }),
    ).toBeDefined();

    const audit = await prisma.adminAuditLog.findFirstOrThrow({
      where: { sessionId: session.id, action: 'HOST_ACCESS_RESET' },
      select: { adminIdentifier: true, reason: true },
    });
    expect(audit.adminIdentifier).toBe('admin:test');
    expect(audit.reason).not.toContain(reset.handoffCapability);
    expect(audit.reason).not.toContain(prepared.browserCapability);
    expect(audit.reason).not.toContain(prepared.recoveryCard.recoveryCode);

    const expiredMaterial = createInitialHostCredentialMaterial();
    const expired = await prisma.session.create({
      data: {
        id: randomUUID(),
        code: sessionCode('E'),
        type: 'Q_AND_A',
        status: 'FINISHED',
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        endedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        qaEnabled: true,
        qaOpen: false,
        hostCredentialVersion: 1,
        hostSupportId: expiredMaterial.recoveryCard.supportId,
        hostCredentials: expiredMaterial.credentialData.hostCredentials,
      },
    });
    sessionIds.push(expired.id);
    await expect(
      resetSessionHostAccess({
        adminIdentifier: 'admin:test',
        input: {
          supportId: expiredMaterial.recoveryCard.supportId,
          evidenceCategory: 'INDEPENDENT_OFFICIAL_ORGANIZATION_CONFIRMATION',
          requesterIdentityVerificationReference: 'verified-contact-9911',
          sessionAuthorizationEvidenceReference: 'official-confirmation-9911',
          supportCaseReference: 'support-case-9911',
          reason: 'Test des harten Endes der Nachbereitungsfrist.',
        },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      issueHostTokenFromBrowserCapability({
        code: expired.code,
        browserCapability: expiredMaterial.browserCapability,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
